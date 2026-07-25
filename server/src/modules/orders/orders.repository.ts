import type { Order, OrderItem, OrderItemAddon } from '@adega/shared';
import type { PoolClient } from 'pg';

interface OrderRow {
  id: number;
  status: string;
  fulfillment: string;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  district: string | null;
  notes: string | null;
  payment_method_intent_id: number;
  payment_method_code: string;
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
    district: row.district,
    notes: row.notes,
    paymentMethodIntentId: row.payment_method_intent_id,
    paymentMethodIntent: row.payment_method_code,
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
    addons: [],
  };
}

interface OrderItemAddonRow {
  id: number;
  order_item_id: number;
  addon_option_id: number | null;
  label_snapshot: string;
  extra_price_cents_snapshot: number;
  product_id_snapshot: number | null;
  quantity: number;
}

function mapAddonRow(row: OrderItemAddonRow): OrderItemAddon {
  return {
    id: row.id,
    orderItemId: row.order_item_id,
    addonOptionId: row.addon_option_id,
    labelSnapshot: row.label_snapshot,
    extraPriceCentsSnapshot: row.extra_price_cents_snapshot,
    productIdSnapshot: row.product_id_snapshot,
    quantity: row.quantity,
  };
}

const ORDER_SELECT = `
  SELECT o.*, pm.code AS payment_method_code
  FROM orders o
  JOIN payment_methods pm ON pm.id = o.payment_method_intent_id
`;

export async function listOrders(client: PoolClient, statuses?: string[]): Promise<Order[]> {
  if (statuses && statuses.length > 0) {
    const { rows } = await client.query(
      `${ORDER_SELECT} WHERE o.status = ANY($1) ORDER BY o.created_at DESC`,
      [statuses]
    );
    return rows.map(mapRow);
  }
  const { rows } = await client.query(`${ORDER_SELECT} ORDER BY o.created_at DESC LIMIT 200`);
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<Order | undefined> {
  const { rows } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function findItems(client: PoolClient, orderId: number): Promise<OrderItem[]> {
  const { rows } = await client.query(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC',
    [orderId]
  );
  const items = rows.map(mapItemRow);
  const addonsByItem = await findAddonsByItems(client, items.map((i) => i.id));
  return items.map((item) => ({ ...item, addons: addonsByItem.get(item.id) ?? [] }));
}

export async function findAddonsByItems(
  client: PoolClient,
  orderItemIds: number[]
): Promise<Map<number, OrderItemAddon[]>> {
  const map = new Map<number, OrderItemAddon[]>();
  if (orderItemIds.length === 0) return map;
  const { rows } = await client.query(
    'SELECT * FROM order_item_addons WHERE order_item_id = ANY($1) ORDER BY id ASC',
    [orderItemIds]
  );
  for (const row of rows) {
    const addon = mapAddonRow(row);
    const list = map.get(addon.orderItemId) ?? [];
    list.push(addon);
    map.set(addon.orderItemId, list);
  }
  return map;
}

export interface InsertItemAddonInput {
  orderItemId: number;
  addonOptionId: number | null;
  labelSnapshot: string;
  extraPriceCentsSnapshot: number;
  productIdSnapshot: number | null;
  quantity: number;
}

export async function insertItemAddon(client: PoolClient, input: InsertItemAddonInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO order_item_addons
      (order_item_id, addon_option_id, label_snapshot, extra_price_cents_snapshot, product_id_snapshot, quantity)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.orderItemId,
      input.addonOptionId,
      input.labelSnapshot,
      input.extraPriceCentsSnapshot,
      input.productIdSnapshot,
      input.quantity,
    ]
  );
  return rows[0].id;
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
  district: string | null;
  notes: string | null;
  paymentMethodIntentId: number;
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
      (fulfillment, customer_name, customer_phone, address, district, notes, payment_method_intent_id,
       change_for_cents, public_key, expires_at, subtotal_cents, delivery_fee_cents, total_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      input.fulfillment,
      input.customerName,
      input.customerPhone,
      input.address,
      input.district,
      input.notes,
      input.paymentMethodIntentId,
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
): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price_cents, total_cents)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [orderId, productId, nameSnapshot, quantity, unitPriceCents, totalCents]
  );
  return rows[0].id;
}

/** Soma reservada de um produto (pedidos pendentes não expirados) — usada
 * para calcular "disponível" = stock_quantity - reservado sem tocar no
 * estoque real, que só é debitado de fato no aceite do pedido. */
export async function reservedQuantity(client: PoolClient, productId: number): Promise<number> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(quantity), 0)::int AS total
     FROM stock_reservations
     WHERE product_id = $1 AND expires_at > now()`,
    [productId]
  );
  return rows[0].total;
}

/** Soma à reserva existente (não sobrescreve) — um produto pode ser
 * consumido por mais de uma linha do pedido (item principal de uma linha e
 * complemento/componente de combo de outra). */
export async function insertReservation(
  client: PoolClient,
  orderId: number,
  productId: number,
  quantity: number,
  expiresAt: string
): Promise<void> {
  await client.query(
    `INSERT INTO stock_reservations (product_id, order_id, quantity, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (order_id, product_id)
     DO UPDATE SET quantity = stock_reservations.quantity + EXCLUDED.quantity`,
    [productId, orderId, quantity, expiresAt]
  );
}

export async function releaseReservations(client: PoolClient, orderId: number): Promise<void> {
  await client.query('DELETE FROM stock_reservations WHERE order_id = $1', [orderId]);
}

export async function releaseReservationsForOrders(client: PoolClient, orderIds: number[]): Promise<void> {
  if (orderIds.length === 0) return;
  await client.query('DELETE FROM stock_reservations WHERE order_id = ANY($1)', [orderIds]);
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
  const { rowCount } = await client.query(
    `UPDATE orders SET
       status = $1,
       reject_reason = COALESCE($2, reject_reason),
       sale_id = COALESCE($3, sale_id),
       accepted_at = CASE WHEN $1 = 'aceito' THEN now() ELSE accepted_at END,
       concluded_at = CASE WHEN $1 IN ('concluido', 'recusado', 'cancelado') THEN now() ELSE concluded_at END
     WHERE id = $4 AND status = ANY($5)`,
    [to, extra?.rejectReason ?? null, extra?.saleId ?? null, id, from]
  );
  if (!rowCount) return undefined;
  return findById(client, id);
}
