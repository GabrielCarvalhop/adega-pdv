import type { Payment, Sale, SaleItem, SaleItemAddon, SaleStatus, SaleType } from '@adega/shared';
import type { PoolClient } from 'pg';

interface SaleRow {
  id: number;
  status: string;
  sale_type: string;
  subtotal_cents: number;
  discount_cents: number;
  discount_percent: number | null;
  surcharge_cents: number;
  total_cents: number;
  cash_session_id: number;
  fiscal_status: string;
  fiscal_document_id: string | null;
  user_id: number | null;
  customer_id: number | null;
  notes: string | null;
  cancel_reason: string | null;
  created_at: string;
  completed_at: string | null;
  canceled_at: string | null;
}

function mapSaleRow(row: SaleRow): Sale {
  return {
    id: row.id,
    status: row.status as SaleStatus,
    saleType: row.sale_type as SaleType,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    discountPercent: row.discount_percent,
    surchargeCents: row.surcharge_cents,
    totalCents: row.total_cents,
    cashSessionId: row.cash_session_id,
    fiscalStatus: row.fiscal_status as Sale['fiscalStatus'],
    fiscalDocumentId: row.fiscal_document_id,
    userId: row.user_id,
    customerId: row.customer_id,
    notes: row.notes,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
  };
}

interface SaleItemRow {
  id: number;
  sale_id: number;
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents: number;
  discount_cents: number;
  total_cents: number;
  canceled: boolean;
  notes: string | null;
}

function mapItemRow(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productNameSnapshot: row.product_name_snapshot,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    unitCostCents: row.unit_cost_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    canceled: row.canceled,
    notes: row.notes,
    addons: [],
  };
}

interface SaleItemAddonRow {
  id: number;
  sale_item_id: number;
  addon_option_id: number | null;
  label_snapshot: string;
  extra_price_cents_snapshot: number;
  product_id_snapshot: number | null;
  quantity: number;
}

function mapAddonRow(row: SaleItemAddonRow): SaleItemAddon {
  return {
    id: row.id,
    saleItemId: row.sale_item_id,
    addonOptionId: row.addon_option_id,
    labelSnapshot: row.label_snapshot,
    extraPriceCentsSnapshot: row.extra_price_cents_snapshot,
    productIdSnapshot: row.product_id_snapshot,
    quantity: row.quantity,
  };
}

export async function findAddonsByItems(
  client: PoolClient,
  saleItemIds: number[]
): Promise<Map<number, SaleItemAddon[]>> {
  const map = new Map<number, SaleItemAddon[]>();
  if (saleItemIds.length === 0) return map;
  const { rows } = await client.query(
    'SELECT * FROM sale_item_addons WHERE sale_item_id = ANY($1) ORDER BY id ASC',
    [saleItemIds]
  );
  for (const row of rows) {
    const addon = mapAddonRow(row);
    const list = map.get(addon.saleItemId) ?? [];
    list.push(addon);
    map.set(addon.saleItemId, list);
  }
  return map;
}

export interface InsertItemAddonInput {
  saleItemId: number;
  addonOptionId: number | null;
  labelSnapshot: string;
  extraPriceCentsSnapshot: number;
  productIdSnapshot: number | null;
  quantity: number;
}

export async function insertItemAddon(client: PoolClient, input: InsertItemAddonInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO sale_item_addons
      (sale_item_id, addon_option_id, label_snapshot, extra_price_cents_snapshot, product_id_snapshot, quantity)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.saleItemId,
      input.addonOptionId,
      input.labelSnapshot,
      input.extraPriceCentsSnapshot,
      input.productIdSnapshot,
      input.quantity,
    ]
  );
  return rows[0].id;
}

interface PaymentRow {
  id: number;
  sale_id: number;
  payment_method_id: number;
  method_code: string;
  method_label: string;
  amount_cents: number;
  amount_received_cents: number | null;
  change_cents: number;
  net_amount_cents: number;
  created_at: string;
}

function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    saleId: row.sale_id,
    paymentMethodId: row.payment_method_id,
    method: row.method_code,
    methodLabel: row.method_label,
    amountCents: row.amount_cents,
    amountReceivedCents: row.amount_received_cents,
    changeCents: row.change_cents,
    netAmountCents: row.net_amount_cents,
    createdAt: row.created_at,
  };
}

const PAYMENT_SELECT = `
  SELECT p.*, pm.code AS method_code, pm.label AS method_label
  FROM payments p
  JOIN payment_methods pm ON pm.id = p.payment_method_id
`;

export interface SaleFilters {
  from?: string;
  to?: string;
  status?: string;
}

export async function listSales(client: PoolClient, filters: SaleFilters): Promise<Sale[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`created_at <= $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
  // LIMIT como rede de segurança contra crescimento sem fim — a tela de
  // histórico ainda não tem paginação; sem filtro de data/status nenhuma
  // loja em operação hoje chega perto disso, mas evita risco futuro.
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await client.query(
    `SELECT * FROM sales ${where} ORDER BY created_at DESC LIMIT 1000`,
    params
  );
  return rows.map(mapSaleRow);
}

export async function findSaleById(client: PoolClient, id: number): Promise<Sale | undefined> {
  const { rows } = await client.query('SELECT * FROM sales WHERE id = $1', [id]);
  return rows[0] ? mapSaleRow(rows[0]) : undefined;
}

export async function findItemsBySale(client: PoolClient, saleId: number): Promise<SaleItem[]> {
  const { rows } = await client.query(
    'SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id ASC',
    [saleId]
  );
  const items = rows.map(mapItemRow);
  const addonsByItem = await findAddonsByItems(client, items.map((i) => i.id));
  return items.map((item) => ({ ...item, addons: addonsByItem.get(item.id) ?? [] }));
}

export async function findItemById(
  client: PoolClient,
  saleId: number,
  itemId: number
): Promise<SaleItem | undefined> {
  const { rows } = await client.query('SELECT * FROM sale_items WHERE id = $1 AND sale_id = $2', [
    itemId,
    saleId,
  ]);
  if (!rows[0]) return undefined;
  const item = mapItemRow(rows[0]);
  const addonsByItem = await findAddonsByItems(client, [item.id]);
  return { ...item, addons: addonsByItem.get(item.id) ?? [] };
}

export async function findPaymentsBySale(client: PoolClient, saleId: number): Promise<Payment[]> {
  const { rows } = await client.query(
    `${PAYMENT_SELECT} WHERE p.sale_id = $1 ORDER BY p.id ASC`,
    [saleId]
  );
  return rows.map(mapPaymentRow);
}

export interface InsertSaleInput {
  saleType: SaleType;
  subtotalCents: number;
  discountCents: number;
  surchargeCents: number;
  totalCents: number;
  cashSessionId: number;
  userId: number | null;
  customerId: number | null;
  notes: string | null;
}

export async function insertSale(client: PoolClient, input: InsertSaleInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO sales
      (status, sale_type, subtotal_cents, discount_cents, surcharge_cents, total_cents,
       cash_session_id, user_id, customer_id, notes, completed_at)
     VALUES ('concluida', $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     RETURNING id`,
    [
      input.saleType,
      input.subtotalCents,
      input.discountCents,
      input.surchargeCents,
      input.totalCents,
      input.cashSessionId,
      input.userId,
      input.customerId,
      input.notes,
    ]
  );
  return rows[0].id;
}

export interface InsertSaleItemInput {
  saleId: number;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  discountCents: number;
  totalCents: number;
  notes?: string | null;
}

export async function insertSaleItem(client: PoolClient, input: InsertSaleItemInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO sale_items
      (sale_id, product_id, product_name_snapshot, quantity, unit_price_cents, unit_cost_cents, discount_cents, total_cents, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.saleId,
      input.productId,
      input.productNameSnapshot,
      input.quantity,
      input.unitPriceCents,
      input.unitCostCents,
      input.discountCents,
      input.totalCents,
      input.notes ?? null,
    ]
  );
  return rows[0].id;
}

export interface InsertPaymentInput {
  saleId: number;
  paymentMethodId: number;
  amountCents: number;
  amountReceivedCents: number | null;
  changeCents: number;
  netAmountCents: number;
}

export async function insertPayment(client: PoolClient, input: InsertPaymentInput): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO payments (sale_id, payment_method_id, amount_cents, amount_received_cents, change_cents, net_amount_cents)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.saleId,
      input.paymentMethodId,
      input.amountCents,
      input.amountReceivedCents,
      input.changeCents,
      input.netAmountCents,
    ]
  );
  return rows[0].id;
}

export async function markSaleCanceled(client: PoolClient, id: number, reason: string): Promise<void> {
  await client.query(
    "UPDATE sales SET status = 'cancelada', cancel_reason = $1, canceled_at = now() WHERE id = $2",
    [reason, id]
  );
}

export async function markAllItemsCanceled(client: PoolClient, saleId: number): Promise<void> {
  await client.query('UPDATE sale_items SET canceled = TRUE WHERE sale_id = $1', [saleId]);
}

export async function markItemCanceled(client: PoolClient, itemId: number): Promise<void> {
  await client.query('UPDATE sale_items SET canceled = TRUE WHERE id = $1', [itemId]);
}

export async function updateSaleTotalsAfterItemCancel(
  client: PoolClient,
  saleId: number,
  newSubtotalCents: number,
  newTotalCents: number
): Promise<void> {
  await client.query('UPDATE sales SET subtotal_cents = $1, total_cents = $2 WHERE id = $3', [
    newSubtotalCents,
    newTotalCents,
    saleId,
  ]);
}
