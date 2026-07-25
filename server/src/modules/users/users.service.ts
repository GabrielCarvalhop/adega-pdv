import type { CreateUserRequest, UpdateUserRequest, User } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withSystemTransaction, withTenantTransaction } from '../../db/connection';
import { signOperatorToken } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import { hashPin, verifyPin } from './pin';
import * as repo from './users.repository';

export function listActiveUsers(tenantId: number): Promise<User[]> {
  return withTenantTransaction(tenantId, (client) => repo.findActive(client));
}

export function listAllUsers(tenantId: number): Promise<User[]> {
  return withTenantTransaction(tenantId, (client) => repo.findAll(client));
}

export async function login(tenantId: number, userId: number, pin: string) {
  return withTenantTransaction(tenantId, async (client) => {
    const row = await repo.findRowById(client, userId);
    if (!row || !row.active) throw new AppError('Usuário inválido', 401);
    if (!row.pin_hash || !verifyPin(pin, row.pin_hash)) {
      throw new AppError('PIN incorreto', 401);
    }
    const user = (await repo.findById(client, userId))!;
    const token = signOperatorToken({
      userId: user.id,
      tenantId,
      role: user.role,
      name: user.name,
    });
    return { token, user };
  });
}

/** Login do dono da plataforma — sem loja, por e-mail/senha (mesmo hash scrypt do PIN). */
export async function superAdminLogin(email: string, password: string) {
  return withSystemTransaction(async (client) => {
    const row = await repo.findSuperAdminByEmail(client, email);
    if (!row || !row.pin_hash || !verifyPin(password, row.pin_hash)) {
      throw new AppError('E-mail ou senha inválidos', 401);
    }
    const user: User = {
      id: row.id,
      name: row.name,
      role: 'SUPER_ADMIN',
      active: row.active,
      maxDiscountPercent: null,
      canSellWithoutStock: false,
      mustChangePin: row.must_change_pin,
      createdAt: row.created_at,
    };
    const token = signOperatorToken({ userId: user.id, tenantId: null, role: 'SUPER_ADMIN', name: user.name });
    return { token, user };
  });
}

export function createUser(
  tenantId: number,
  data: CreateUserRequest,
  actorId: number | null
): Promise<User> {
  if (!data.name.trim()) throw new AppError('Nome é obrigatório');
  if (!/^\d{4,8}$/.test(data.pin)) throw new AppError('PIN deve ter de 4 a 8 dígitos numéricos');
  return withTenantTransaction(tenantId, async (client) => {
    const user = await repo.create(
      client,
      data.name.trim(),
      data.role,
      hashPin(data.pin),
      data.maxDiscountPercent,
      data.canSellWithoutStock,
      data.mustChangePin
    );
    await logAction(client, actorId, 'usuario.criacao', 'user', user.id, {
      name: user.name,
      role: user.role,
    });
    return user;
  });
}

export function updateUser(
  tenantId: number,
  id: number,
  data: UpdateUserRequest,
  actorId: number | null
): Promise<User> {
  if (data.pin !== undefined && !/^\d{4,8}$/.test(data.pin)) {
    throw new AppError('PIN deve ter de 4 a 8 dígitos numéricos');
  }
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.update(client, id, {
      name: data.name?.trim(),
      role: data.role,
      pinHash: data.pin ? hashPin(data.pin) : undefined,
      active: data.active,
      maxDiscountPercent: data.maxDiscountPercent,
      canSellWithoutStock: data.canSellWithoutStock,
    });
    if (!updated) throw new AppError('Usuário não encontrado', 404);
    await logAction(client, actorId, 'usuario.alteracao', 'user', id, {
      name: updated.name,
      role: updated.role,
      active: updated.active,
      pinChanged: Boolean(data.pin),
    });
    return updated;
  });
}

/**
 * Troca o próprio PIN/senha — usado tanto voluntariamente quanto pelo fluxo
 * obrigatório de primeiro acesso (must_change_pin). tenantId nulo = SUPER_ADMIN,
 * roda fora de escopo de tenant; senão precisa da transação da própria loja
 * (a policy de RLS de `users` só libera a linha dentro do tenant certo).
 */
export function changeOwnPin(userId: number, tenantId: number | null, newPin: string): Promise<void> {
  if (!/^.{4,72}$/.test(newPin)) throw new AppError('PIN/senha inválido');
  const fn = async (client: PoolClient) => {
    await repo.setPinAndClearMustChange(client, userId, hashPin(newPin));
  };
  return tenantId === null ? withSystemTransaction(fn) : withTenantTransaction(tenantId, fn);
}
