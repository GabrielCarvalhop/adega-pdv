import type { CreateTenantRequest, CreateTenantResult, TenantStatus, TenantSummary } from '@adega/shared';
import { withSystemTransaction } from '../../db/connection';
import { signOperatorToken } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { RESERVED_SLUGS, SLUG_REGEX, TRIAL_DAYS } from '../account/account.service';
import { insertTenant, slugExists } from '../account/account.repository';
import { hashPin } from '../users/pin';
import { seedDefaults as seedDefaultPaymentMethods } from '../paymentMethods/paymentMethods.repository';
import * as repo from './platformAdmin.repository';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function toSummary(row: repo.TenantWithOwnerRow): TenantSummary {
  return {
    id: row.id,
    slug: row.slug,
    storeName: row.store_name,
    status: row.status as TenantStatus,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    ownerName: row.owner_name,
  };
}

export function listTenants(): Promise<TenantSummary[]> {
  return withSystemTransaction(async (client) => (await repo.listTenantsWithOwner(client)).map(toSummary));
}

export async function createTenant(input: CreateTenantRequest): Promise<CreateTenantResult> {
  if (!input.storeName.trim()) throw new AppError('Nome da loja é obrigatório');
  if (!input.ownerName.trim()) throw new AppError('Nome do responsável é obrigatório');

  return withSystemTransaction(async (client) => {
    let slug = (input.slug?.trim() || slugify(input.storeName)).toLowerCase();
    if (!SLUG_REGEX.test(slug) || RESERVED_SLUGS.has(slug)) {
      slug = slugify(input.storeName) || 'loja';
    }
    let candidate = slug;
    let suffix = 2;
    while (await slugExists(client, candidate)) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    slug = candidate;

    const tenant = await insertTenant(client, slug, input.storeName.trim(), TRIAL_DAYS);

    const initialPin = randomPin();
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenant.id)]);
    await client.query(
      `INSERT INTO users (tenant_id, name, pin_hash, role, must_change_pin)
       VALUES ($1, $2, $3, 'ADMIN_LOJA', TRUE)`,
      [tenant.id, input.ownerName.trim(), hashPin(initialPin)]
    );
    await seedDefaultPaymentMethods(client, tenant.id);

    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5175';
    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        storeName: tenant.store_name,
        status: tenant.status as TenantStatus,
        trialEndsAt: tenant.trial_ends_at,
        createdAt: new Date().toISOString(),
        ownerName: input.ownerName.trim(),
      },
      loginUrl: `${baseUrl}/t/${slug}/login`,
      ownerName: input.ownerName.trim(),
      initialPin,
    };
  });
}

export function updateTenantStatus(tenantId: number, status: TenantStatus): Promise<void> {
  return withSystemTransaction((client) => repo.updateTenantStatus(client, tenantId, status));
}

/** SUPER_ADMIN "entra" numa loja: token normal de operador, escopo da loja
 * alvo, sem impersonar um usuário específico — mesmas telas de sempre. */
export async function enterTenant(superAdmin: { userId: number; name: string }, tenantId: number) {
  const tenants = await listTenants();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) throw new AppError('Loja não encontrada', 404);
  const token = signOperatorToken({
    userId: superAdmin.userId,
    tenantId: tenant.id,
    role: 'SUPER_ADMIN',
    name: superAdmin.name,
  });
  return { token };
}
