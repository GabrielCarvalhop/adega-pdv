import type { User, UserRole } from '@adega/shared';
import type { PoolClient } from 'pg';

interface UserRow {
  id: number;
  name: string;
  pin_hash: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role as UserRole,
    active: row.active,
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

export async function findRowById(client: PoolClient, id: number): Promise<UserRow | undefined> {
  const { rows } = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

export async function create(
  client: PoolClient,
  name: string,
  role: UserRole,
  pinHash: string
): Promise<User> {
  const { rows } = await client.query(
    'INSERT INTO users (name, pin_hash, role) VALUES ($1, $2, $3) RETURNING *',
    [name, pinHash, role]
  );
  return mapRow(rows[0]);
}

export interface UpdateUserFields {
  name?: string;
  role?: UserRole;
  pinHash?: string;
  active?: boolean;
}

export async function update(
  client: PoolClient,
  id: number,
  fields: UpdateUserFields
): Promise<User | undefined> {
  const existing = await findRowById(client, id);
  if (!existing) return undefined;
  const { rows } = await client.query(
    'UPDATE users SET name = $1, role = $2, pin_hash = $3, active = $4 WHERE id = $5 RETURNING *',
    [
      fields.name ?? existing.name,
      fields.role ?? existing.role,
      fields.pinHash ?? existing.pin_hash,
      fields.active ?? existing.active,
      id,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}
