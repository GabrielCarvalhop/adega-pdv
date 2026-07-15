import jwt from 'jsonwebtoken';
import { withSystemTransaction } from '../../db/connection';
import { getJwtSecret } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { hashPin, verifyPin } from '../users/pin';
import * as repo from './account.repository';

export const TRIAL_DAYS = 14;

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}$/;
const RESERVED_SLUGS = new Set(['api', 'admin', 'conta', 'cadastro', 'entrar', 'www', 'app']);

export interface SignupInput {
  ownerName: string;
  email: string;
  password: string;
  storeName: string;
  storeSlug: string;
  pin: string;
}

interface AccountTokenPayload {
  sub: string;
  tenantId: number;
  type: 'account';
}

function signAccountToken(ownerId: number, tenantId: number): string {
  const payload: Omit<AccountTokenPayload, 'sub'> = { tenantId, type: 'account' };
  return jwt.sign(payload, getJwtSecret(), { subject: String(ownerId), expiresIn: '7d' });
}

export function verifyAccountToken(token: string): { ownerId: number; tenantId: number } {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as unknown as AccountTokenPayload;
    if (payload.type !== 'account') throw new Error('tipo errado');
    return { ownerId: Number(payload.sub), tenantId: payload.tenantId };
  } catch {
    throw new AppError('Sessão expirada — faça login novamente', 401);
  }
}

export async function signup(input: SignupInput) {
  const slug = input.storeSlug.trim().toLowerCase();
  if (!SLUG_REGEX.test(slug) || RESERVED_SLUGS.has(slug)) {
    throw new AppError('Endereço da loja inválido — use letras minúsculas, números e hífens (mín. 2 caracteres)');
  }
  if (input.password.length < 8) throw new AppError('Senha deve ter pelo menos 8 caracteres');
  if (!/^\d{4,8}$/.test(input.pin)) throw new AppError('PIN deve ter de 4 a 8 dígitos numéricos');
  if (!input.ownerName.trim()) throw new AppError('Nome é obrigatório');
  if (!input.storeName.trim()) throw new AppError('Nome da loja é obrigatório');

  return withSystemTransaction(async (client) => {
    if (await repo.slugExists(client, slug)) {
      throw new AppError('Este endereço de loja já está em uso', 409);
    }
    if (await repo.findByEmail(client, input.email)) {
      throw new AppError('Já existe uma conta com este e-mail', 409);
    }

    const tenant = await repo.insertTenant(client, slug, input.storeName.trim(), TRIAL_DAYS);
    const owner = await repo.insertOwner(
      client,
      tenant.id,
      input.ownerName.trim(),
      input.email,
      hashPin(input.password)
    );

    // Cria o primeiro operador (admin) da loja na MESMA transação. O
    // set_config transaction-local satisfaz o RLS/DEFAULT da tabela users.
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenant.id)]);
    await client.query('INSERT INTO users (name, pin_hash, role) VALUES ($1, $2, $3)', [
      input.ownerName.trim(),
      hashPin(input.pin),
      'admin',
    ]);

    return {
      token: signAccountToken(owner.id, tenant.id),
      account: buildAccountInfo(owner, tenant),
    };
  });
}

export async function login(email: string, password: string) {
  return withSystemTransaction(async (client) => {
    const owner = await repo.findByEmail(client, email);
    if (!owner || !verifyPin(password, owner.password_hash)) {
      throw new AppError('E-mail ou senha incorretos', 401);
    }
    const tenant = await repo.findTenantById(client, owner.tenant_id);
    if (!tenant) throw new AppError('Conta sem loja associada', 500);
    return {
      token: signAccountToken(owner.id, tenant.id),
      account: buildAccountInfo(owner, tenant),
    };
  });
}

export async function getAccountInfo(ownerId: number) {
  return withSystemTransaction(async (client) => {
    const owner = await repo.findById(client, ownerId);
    if (!owner) throw new AppError('Conta não encontrada', 404);
    const tenant = await repo.findTenantById(client, owner.tenant_id);
    if (!tenant) throw new AppError('Conta sem loja associada', 500);
    return buildAccountInfo(owner, tenant);
  });
}

function buildAccountInfo(owner: repo.AccountOwnerRow, tenant: repo.TenantRow) {
  const trialEndsAt = new Date(tenant.trial_ends_at);
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  return {
    owner: { id: owner.id, name: owner.name, email: owner.email },
    store: {
      slug: tenant.slug,
      name: tenant.store_name,
      status: tenant.status,
      trialEndsAt: tenant.trial_ends_at,
      trialDaysLeft,
    },
  };
}
