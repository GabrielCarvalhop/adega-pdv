import type { PoolClient } from 'pg';

export interface AccountOwnerRow {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export async function findByEmail(client: PoolClient, email: string): Promise<AccountOwnerRow | undefined> {
  const { rows } = await client.query('SELECT * FROM account_owners WHERE email = $1', [
    email.toLowerCase(),
  ]);
  return rows[0];
}

export async function findById(client: PoolClient, id: number): Promise<AccountOwnerRow | undefined> {
  const { rows } = await client.query('SELECT * FROM account_owners WHERE id = $1', [id]);
  return rows[0];
}

export async function insertOwner(
  client: PoolClient,
  tenantId: number,
  name: string,
  email: string,
  passwordHash: string
): Promise<AccountOwnerRow> {
  const { rows } = await client.query(
    `INSERT INTO account_owners (tenant_id, name, email, password_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, name, email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

export interface TenantRow {
  id: number;
  slug: string;
  store_name: string;
  status: string;
  trial_ends_at: string;
}

export async function findTenantById(client: PoolClient, id: number): Promise<TenantRow | undefined> {
  const { rows } = await client.query(
    'SELECT id, slug, store_name, status, trial_ends_at FROM tenants WHERE id = $1',
    [id]
  );
  return rows[0];
}

export async function slugExists(client: PoolClient, slug: string): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
  return rows.length > 0;
}

export async function insertTenant(
  client: PoolClient,
  slug: string,
  storeName: string,
  trialDays: number
): Promise<TenantRow> {
  const { rows } = await client.query(
    `INSERT INTO tenants (slug, store_name, status, trial_ends_at)
     VALUES ($1, $2, 'trialing', now() + ($3 || ' days')::interval)
     RETURNING id, slug, store_name, status, trial_ends_at`,
    [slug, storeName, String(trialDays)]
  );
  return rows[0];
}
