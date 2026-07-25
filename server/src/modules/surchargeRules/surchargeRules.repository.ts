import type { SaleType, SurchargeRule } from '@adega/shared';
import type { PoolClient } from 'pg';

interface RuleRow {
  id: number;
  sale_type: SaleType;
  payment_method_id: number;
  percent: string;
  active: boolean;
}

function mapRow(row: RuleRow): SurchargeRule {
  return {
    id: row.id,
    saleType: row.sale_type,
    paymentMethodId: row.payment_method_id,
    percent: Number(row.percent),
    active: row.active,
  };
}

export async function listAll(client: PoolClient): Promise<SurchargeRule[]> {
  const { rows } = await client.query('SELECT * FROM surcharge_rules ORDER BY id ASC');
  return rows.map(mapRow);
}

/** Mapa paymentMethodId -> percent, só das regras ativas de um sale_type. */
export async function activePercentsByType(
  client: PoolClient,
  saleType: SaleType
): Promise<Map<number, number>> {
  const { rows } = await client.query(
    'SELECT * FROM surcharge_rules WHERE sale_type = $1 AND active = TRUE',
    [saleType]
  );
  return new Map(rows.map((r) => [r.payment_method_id, Number(r.percent)]));
}

export interface CreateRuleInput {
  saleType: SaleType;
  paymentMethodId: number;
  percent: number;
}

export async function create(client: PoolClient, input: CreateRuleInput): Promise<SurchargeRule> {
  const { rows } = await client.query(
    `INSERT INTO surcharge_rules (sale_type, payment_method_id, percent)
     VALUES ($1, $2, $3) RETURNING *`,
    [input.saleType, input.paymentMethodId, input.percent]
  );
  return mapRow(rows[0]);
}

export interface UpdateRuleInput {
  percent?: number;
  active?: boolean;
}

export async function findById(client: PoolClient, id: number): Promise<SurchargeRule | undefined> {
  const { rows } = await client.query('SELECT * FROM surcharge_rules WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function update(
  client: PoolClient,
  id: number,
  input: UpdateRuleInput
): Promise<SurchargeRule | undefined> {
  const current = await findById(client, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  const { rows } = await client.query(
    'UPDATE surcharge_rules SET percent = $1, active = $2 WHERE id = $3 RETURNING *',
    [next.percent, next.active, id]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function remove(client: PoolClient, id: number): Promise<void> {
  await client.query('DELETE FROM surcharge_rules WHERE id = $1', [id]);
}
