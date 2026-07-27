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
  cash_session_id: number | null;
  created_at: string;
  register_label?: string | null;
  product_name?: string | null;
}

function mapRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name ?? null,
    type: row.type as StockMovementType,
    quantity: row.quantity,
    prevQuantity: row.prev_quantity,
    nextQuantity: row.next_quantity,
    reason: row.reason,
    unitCostCents: row.unit_cost_cents,
    saleId: row.sale_id,
    orderId: row.order_id,
    userId: row.user_id,
    cashSessionId: row.cash_session_id,
    registerLabel: row.register_label ?? null,
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
    clauses.push(`sm.product_id = $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    clauses.push(`sm.type = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`sm.created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`sm.created_at <= $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  // JOIN com products traz o nome direto — antes o frontend baixava o
  // catálogo inteiro só pra montar esse lookup por id. LIMIT como rede de
  // segurança contra crescimento sem fim (a tela ainda não pagina).
  const { rows } = await client.query(
    `SELECT sm.*, cs.register_label, p.name AS product_name
     FROM stock_movements sm
     LEFT JOIN cash_sessions cs ON cs.id = sm.cash_session_id
     LEFT JOIN products p ON p.id = sm.product_id
     ${where}
     ORDER BY sm.created_at DESC
     LIMIT 1000`,
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
  cashSessionId?: number | null;
}

export async function insertMovement(
  client: PoolClient,
  input: InsertMovementInput
): Promise<StockMovement> {
  const { rows } = await client.query(
    `INSERT INTO stock_movements
      (product_id, type, quantity, prev_quantity, next_quantity, reason, unit_cost_cents, sale_id, order_id, idempotency_key, user_id, cash_session_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      input.cashSessionId ?? null,
    ]
  );
  return mapRow(rows[0]);
}
