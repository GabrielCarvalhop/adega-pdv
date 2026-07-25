import type { PoolClient } from 'pg';

export interface TenantWithOwnerRow {
  id: number;
  slug: string;
  store_name: string;
  status: string;
  trial_ends_at: string;
  created_at: string;
  owner_name: string | null;
}

export async function listTenantsWithOwner(client: PoolClient): Promise<TenantWithOwnerRow[]> {
  const { rows } = await client.query(`
    SELECT t.id, t.slug, t.store_name, t.status, t.trial_ends_at, t.created_at,
      (SELECT u.name FROM users u WHERE u.tenant_id = t.id AND u.role = 'ADMIN_LOJA' ORDER BY u.id ASC LIMIT 1) AS owner_name
    FROM tenants t
    ORDER BY t.created_at DESC
  `);
  return rows;
}

export async function updateTenantStatus(client: PoolClient, tenantId: number, status: string): Promise<void> {
  await client.query('UPDATE tenants SET status = $1, updated_at = now() WHERE id = $2', [status, tenantId]);
}
