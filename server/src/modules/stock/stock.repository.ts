import type { StockMovement, StockMovementType } from '@adega/shared';
import type { PoolClient } from 'pg';

interface StockMovementRow {
  id: number;
  product_id: number;
  type: string;
  quantity: number;
  prev_quantity: number | null;
  next_quantity: number | null;
  reason: string | null;
  unit_cost_cents: number | null;
  sale_id: number | null;
  order_id: number | null;
  user_id: number | null;
  created_at: string;
}

function mapRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type as StockMovementType,
    quantity: row.quantity,
    prevQuantity: row.prev_quantity,
    nextQuantity: row.next_quantity,
    reason: row.reason,
    unitCostCents: row.unit_cost_cents,
    saleId: row.sale_id,
    orderId: row.order_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export interface StockMovementFilters {
  productId?: number;
  type?: string;
  from?: string;
  to?: string;
}

export async function listMovements(
  client: PoolClient,
  filters: StockMovementFilters
): Promise<StockMovement[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.productId !== undefined) {
    params.push(filters.productId);
    clauses.push(`product_id = $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    clauses.push(`type = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`created_at <= $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await client.query(
    `SELECT * FROM stock_movements ${where} ORDER BY created_at DESC`,
    params
  );
  return rows.map(mapRow);
}

export interface InsertMovementInput {
  productId: number;
  type: StockMovementType;
  quantity: number;
  prevQuantity?: number | null;
  nextQuantity?: number | null;
  reason: string | null;
  unitCostCents: number | null;
  saleId: number | null;
  orderId?: number | null;
  idempotencyKey?: string | null;
  userId: number | null;
}

export async function insertMovement(
  client: PoolClient,
  input: InsertMovementInput
): Promise<StockMovement> {
  const { rows } = await client.query(
    `INSERT INTO stock_movements
      (product_id, type, quantity, prev_quantity, next_quantity, reason, unit_cost_cents, sale_id, order_id, idempotency_key, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.productId,
      input.type,
      input.quantity,
      input.prevQuantity ?? null,
      input.nextQuantity ?? null,
      input.reason,
      input.unitCostCents,
      input.saleId,
      input.orderId ?? null,
      input.idempotencyKey ?? null,
      input.userId,
    ]
  );
  return mapRow(rows[0]);
}
