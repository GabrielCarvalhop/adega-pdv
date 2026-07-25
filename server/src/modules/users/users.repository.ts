import type { User, UserRole } from '@adega/shared';
import type { PoolClient } from 'pg';

interface UserRow {
  id: number;
  name: string;
  email: string | null;
  pin_hash: string | null;
  role: string;
  active: boolean;
  created_at: string;
  max_discount_percent: string | number | null;
  can_sell_without_stock: boolean;
  must_change_pin: boolean;
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role as UserRole,
    active: row.active,
    maxDiscountPercent: row.max_discount_percent === null ? null : Number(row.max_discount_percent),
    canSellWithoutStock: row.can_sell_without_stock,
    mustChangePin: row.must_change_pin,
    createdAt: row.created_at,
  };
}

export async function findAll(client: PoolClient): Promise<User[]> {
  const { rows } = await client.query('SELECT * FROM users ORDER BY name ASC');
  return rows.map(mapRow);
}

export async function findActive(client: PoolClient): Promise<User[]> {
  const { rows } = await client.query('SELECT * FROM users WHERE active = TRUE ORDER BY name ASC');
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<User | undefined> {
  const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

// SUPER_ADMIN só é buscado fora de escopo de tenant (withSystemTransaction) —
// a policy de RLS libera role='SUPER_ADMIN' independente de app.tenant_id.
export async function findSuperAdminByEmail(
  client: PoolClient,
  email: string
): Promise<UserRow | undefined> {
  const { rows } = await client.query(
    `SELECT * FROM users WHERE role = 'SUPER_ADMIN' AND email = $1 AND active = TRUE`,
    [email]
  );
  return rows[0];
}

export async function setPinAndClearMustChange(
  client: PoolClient,
  id: number,
  pinHash: string
): Promise<void> {
  await client.query(
    'UPDATE users SET pin_hash = $1, must_change_pin = FALSE WHERE id = $2',
    [pinHash, id]
  );
}

export async function findRowById(client: PoolClient, id: number): Promise<UserRow | undefined> {
  const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

export async function create(
  client: PoolClient,
  name: string,
  role: UserRole,
  pinHash: string,
  maxDiscountPercent?: number | null,
  canSellWithoutStock?: boolean,
  mustChangePin?: boolean
): Promise<User> {
  const { rows } = await client.query(
    `INSERT INTO users (name, pin_hash, role, max_discount_percent, can_sell_without_stock, must_change_pin)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, pinHash, role, maxDiscountPercent ?? null, canSellWithoutStock ?? false, mustChangePin ?? false]
  );
  return mapRow(rows[0]);
}

export interface UpdateUserFields {
  name?: string;
  role?: UserRole;
  pinHash?: string;
  active?: boolean;
  maxDiscountPercent?: number | null;
  canSellWithoutStock?: boolean;
  mustChangePin?: boolean;
}

export async function update(
  client: PoolClient,
  id: number,
  fields: UpdateUserFields
): Promise<User | undefined> {
  const existing = await findRowById(client, id);
  if (!existing) return undefined;
  const { rows } = await client.query(
    `UPDATE users SET
      name = $1, role = $2, pin_hash = $3, active = $4, max_discount_percent = $5,
      can_sell_without_stock = $6, must_change_pin = $7
     WHERE id = $8 RETURNING *`,
    [
      fields.name ?? existing.name,
      fields.role ?? existing.role,
      fields.pinHash ?? existing.pin_hash,
      fields.active ?? existing.active,
      fields.maxDiscountPercent !== undefined ? fields.maxDiscountPercent : existing.max_discount_percent,
      fields.canSellWithoutStock ?? existing.can_sell_without_stock,
      fields.mustChangePin ?? existing.must_change_pin,
      id,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}
