import type { DeliveryZone, DeliveryZoneType } from '@adega/shared';
import type { PoolClient } from 'pg';

interface ZoneRow {
  id: number;
  type: DeliveryZoneType;
  value: string;
  blocked: boolean;
  fee_cents: number | null;
  active: boolean;
}

function mapRow(row: ZoneRow): DeliveryZone {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    blocked: row.blocked,
    feeCents: row.fee_cents,
    active: row.active,
  };
}

export async function listAll(client: PoolClient): Promise<DeliveryZone[]> {
  const { rows } = await client.query('SELECT * FROM delivery_zones ORDER BY type ASC, value ASC');
  return rows.map(mapRow);
}

export interface CreateZoneInput {
  type: DeliveryZoneType;
  value: string;
  blocked: boolean;
  feeCents?: number | null;
}

export async function create(client: PoolClient, input: CreateZoneInput): Promise<DeliveryZone> {
  const { rows } = await client.query(
    `INSERT INTO delivery_zones (type, value, blocked, fee_cents)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.type, normalize(input.type, input.value), input.blocked, input.feeCents ?? null]
  );
  return mapRow(rows[0]);
}

export interface UpdateZoneInput {
  blocked?: boolean;
  feeCents?: number | null;
  active?: boolean;
}

export async function findById(client: PoolClient, id: number): Promise<DeliveryZone | undefined> {
  const { rows } = await client.query('SELECT * FROM delivery_zones WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function update(
  client: PoolClient,
  id: number,
  input: UpdateZoneInput
): Promise<DeliveryZone | undefined> {
  const current = await findById(client, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  const { rows } = await client.query(
    'UPDATE delivery_zones SET blocked = $1, fee_cents = $2, active = $3 WHERE id = $4 RETURNING *',
    [next.blocked, next.feeCents, next.active, id]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function remove(client: PoolClient, id: number): Promise<void> {
  await client.query('DELETE FROM delivery_zones WHERE id = $1', [id]);
}

function normalize(type: DeliveryZoneType, value: string): string {
  return type === 'cep_prefix' ? value.replace(/\D/g, '') : value.trim().toUpperCase();
}

/** Casa um bairro/CEP contra as zonas ativas. Retorna a zona bloqueada se
 * houver match de bloqueio; senão a primeira zona com taxa própria; senão
 * undefined (usa a taxa padrão da loja). */
export async function matchZone(
  client: PoolClient,
  type: DeliveryZoneType,
  rawValue: string
): Promise<DeliveryZone | undefined> {
  const value = normalize(type, rawValue);
  if (!value) return undefined;
  const { rows } = await client.query(
    `SELECT * FROM delivery_zones
     WHERE type = $1 AND active = TRUE
       AND ($2 = value OR ($1 = 'cep_prefix' AND $2 LIKE value || '%'))
     ORDER BY blocked DESC, length(value) DESC
     LIMIT 1`,
    [type, value]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}
