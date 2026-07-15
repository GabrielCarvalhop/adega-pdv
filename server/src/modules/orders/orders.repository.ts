import type { Order, OrderItem } from '@adega/shared';
import type { PoolClient } from 'pg';

interface OrderRow {
  id: number;
  status: string;
  fulfillment: string;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  notes: string | null;
  payment_method_intent: string;
  change_for_cents: number | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  customer_id: number | null;
  sale_id: number | null;
  reject_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  concluded_at: string | null;
}

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    status: row.status as Order['status'],
    fulfillment: row.fulfillment as Order['fulfillment'],
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    address: row.address,
    notes: row.notes,
    paymentMethodIntent: row.payment_method_intent as Order['paymentMethodIntent'],
    changeForCents: row.change_for_cents,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    customerId: row.customer_id,
    saleId: row.sale_id,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    concludedAt: row.concluded_at,
  };
}

interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

function mapItemRow(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productNameSnapshot: row.product_name_snapshot,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
  };
}

export async function listOrders(client: PoolClient, statuses?: string[]): Promise<Order[]> {
  if (statuses && statuses.length > 0) {
    const { rows } = await client.query(
      'SELECT * FROM orders WHERE status = ANY($1) ORDER BY created_at DESC',
      [statuses]
    );
    return rows.map(mapRow);
  }
  const { rows } = await client.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<Order | undefined> {
  const { rows } = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function findItems(client: PoolClient, orderId: number): Promise<OrderItem[]> {
  const { rows } = await client.query(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC',
    [orderId]
  );
  return rows.map(mapItemRow);
}

export async function countByStatus(client: PoolClient, status: string): Promise<number> {
  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS total FROM orders WHERE status = $1',
    [status]
  );
  return rows[0].total;
}

export interface InsertOrderInput {
  fulfillment: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  notes: string | null;
  paymentMethodIntent: string;
  changeForCents: number | null;
  publicKey: string;
  expiresAt: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export async function insertOrder(client: PoolClient, input: InsertOrderInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO orders
      (fulfillment, customer_name, customer_phone, address, notes, payment_method_intent,
       change_for_cents, public_key, expires_at, subtotal_cents, delivery_fee_cents, total_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      input.fulfillment,
      input.customerName,
      input.customerPhone,
      input.address,
      input.notes,
      input.paymentMethodIntent,
      input.changeForCents,
      input.publicKey,
      input.expiresAt,
      input.subtotalCents,
      input.deliveryFeeCents,
      input.totalCents,
    ]
  );
  return rows[0].id;
}

export async function findIdByPublicKey(client: PoolClient, publicKey: string): Promise<number | undefined> {
  const { rows } = await client.query('SELECT id FROM orders WHERE public_key = $1', [publicKey]);
  return rows[0]?.id;
}

export async function insertOrderItem(
  client: PoolClient,
  orderId: number,
  productId: number,
  nameSnapshot: string,
  quantity: number,
  unitPriceCents: number,
  totalCents: number
): Promise<void> {
  await client.query(
    `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price_cents, total_cents)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, productId, nameSnapshot, quantity, unitPriceCents, totalCents]
  );
}

/**
 * Transição de status com guarda otimista: só efetua se o status atual for o
 * esperado. rowCount 0 = outro operador mudou primeiro (nada acontece).
 */
export async function transitionStatus(
  client: PoolClient,
  id: number,
  from: string[],
  to: string,
  extra?: { rejectReason?: string; saleId?: number }
): Promise<Order | undefined> {
  const { rows } = await client.query(
    `UPDATE orders SET
       status = $1,
       reject_reason = COALESCE($2, reject_reason),
       sale_id = COALESCE($3, sale_id),
       accepted_at = CASE WHEN $1 = 'aceito' THEN now() ELSE accepted_at END,
       concluded_at = CASE WHEN $1 IN ('concluido', 'recusado', 'cancelado') THEN now() ELSE concluded_at END
     WHERE id = $4 AND status = ANY($5)
     RETURNING *`,
    [to, extra?.rejectReason ?? null, extra?.saleId ?? null, id, from]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}
