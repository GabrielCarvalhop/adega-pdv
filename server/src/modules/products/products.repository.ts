import type { CreateProductRequest, Product, UpdateProductRequest } from '@adega/shared';
import type { PoolClient } from 'pg';
import { AppError } from '../../middlewares/errorHandler';

interface ProductRow {
  id: number;
  name: string;
  category: string;
  brand: string | null;
  volume_ml: number | null;
  barcode: string | null;
  sku: string | null;
  cost_price_cents: number;
  sale_price_cents: number;
  stock_quantity: number;
  min_stock: number;
  active: boolean;
  visible_in_catalog: boolean;
  image_url: string | null;
  catalog_subtitle: string | null;
  compare_at_price_cents: number | null;
  sort_order: number;
  is_combo: boolean;
  created_at: string;
  updated_at: string;
  reserved_quantity?: number;
}

const PRODUCT_SELECT = `
  SELECT p.*, COALESCE(r.reserved, 0)::int AS reserved_quantity
  FROM products p
  LEFT JOIN (
    SELECT product_id, SUM(quantity) AS reserved
    FROM stock_reservations
    WHERE expires_at > now()
    GROUP BY product_id
  ) r ON r.product_id = p.id
`;

function mapRow(row: ProductRow): Product {
  const reservedQuantity = row.reserved_quantity ?? 0;
  return {
    id: row.id,
    name: row.name,
    category: row.category as Product['category'],
    brand: row.brand,
    volumeMl: row.volume_ml,
    barcode: row.barcode,
    sku: row.sku,
    costPriceCents: row.cost_price_cents,
    salePriceCents: row.sale_price_cents,
    stockQuantity: row.stock_quantity,
    minStock: row.min_stock,
    active: row.active,
    visibleInCatalog: row.visible_in_catalog,
    imageUrl: row.image_url,
    catalogSubtitle: row.catalog_subtitle,
    compareAtPriceCents: row.compare_at_price_cents ?? null,
    sortOrder: row.sort_order,
    isCombo: row.is_combo,
    reservedQuantity,
    availableQuantity: row.stock_quantity - reservedQuantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function reorder(client: PoolClient, ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await client.query('UPDATE products SET sort_order = $1 WHERE id = $2', [i, ids[i]]);
  }
}

export interface ProductFilters {
  search?: string;
  category?: string;
  active?: boolean;
}

// Nenhuma query menciona tenant_id: o SELECT é filtrado pela policy de RLS e o
// INSERT herda o tenant do DEFAULT current_setting('app.tenant_id').

export async function findAll(client: PoolClient, filters: ProductFilters): Promise<Product[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`, filters.search);
    clauses.push(`(p.name ILIKE $${params.length - 1} OR p.barcode = $${params.length} OR p.sku = $${params.length})`);
  }
  if (filters.category) {
    params.push(filters.category);
    clauses.push(`p.category = $${params.length}`);
  }
  if (filters.active !== undefined) {
    params.push(filters.active);
    clauses.push(`p.active = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await client.query(`${PRODUCT_SELECT} ${where} ORDER BY p.name ASC`, params);
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<Product | undefined> {
  const { rows } = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

/** Trava a linha do produto até o fim da transação — usado para serializar
 * checagens de disponibilidade (estoque - reservas) contra concorrência. */
export async function lockById(client: PoolClient, id: number): Promise<Product | undefined> {
  const { rows } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function findByBarcode(client: PoolClient, barcode: string): Promise<Product | undefined> {
  const { rows } = await client.query(
    `${PRODUCT_SELECT} WHERE p.barcode = $1 AND p.active = TRUE`,
    [barcode]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function findLowStock(client: PoolClient): Promise<Product[]> {
  const { rows } = await client.query(
    `${PRODUCT_SELECT} WHERE p.active = TRUE AND p.stock_quantity <= p.min_stock ORDER BY p.name ASC`
  );
  return rows.map(mapRow);
}

export async function create(client: PoolClient, data: CreateProductRequest): Promise<Product> {
  const { rows } = await client.query(
    `INSERT INTO products
      (name, category, brand, volume_ml, barcode, sku, cost_price_cents, sale_price_cents, stock_quantity, min_stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.category,
      data.brand ?? null,
      data.volumeMl ?? null,
      data.barcode ?? null,
      data.sku ?? null,
      data.costPriceCents,
      data.salePriceCents,
      data.stockQuantity ?? 0,
      data.minStock ?? 0,
    ]
  );
  return mapRow(rows[0]);
}

export async function update(
  client: PoolClient,
  id: number,
  data: UpdateProductRequest
): Promise<Product | undefined> {
  const existing = await findById(client, id);
  if (!existing) return undefined;

  const { rows } = await client.query(
    `UPDATE products SET
      name = $1, category = $2, brand = $3, volume_ml = $4, barcode = $5, sku = $6,
      cost_price_cents = $7, sale_price_cents = $8, min_stock = $9, active = $10,
      visible_in_catalog = $11, image_url = $12, catalog_subtitle = $13,
      compare_at_price_cents = $14, is_combo = $15, updated_at = now()
     WHERE id = $16
     RETURNING *`,
    [
      data.name ?? existing.name,
      data.category ?? existing.category,
      data.brand !== undefined ? data.brand ?? null : existing.brand,
      data.volumeMl !== undefined ? data.volumeMl ?? null : existing.volumeMl,
      data.barcode !== undefined ? data.barcode ?? null : existing.barcode,
      data.sku !== undefined ? data.sku ?? null : existing.sku,
      data.costPriceCents ?? existing.costPriceCents,
      data.salePriceCents ?? existing.salePriceCents,
      data.minStock ?? existing.minStock,
      data.active ?? existing.active,
      data.visibleInCatalog ?? existing.visibleInCatalog,
      data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
      data.catalogSubtitle !== undefined ? data.catalogSubtitle : existing.catalogSubtitle,
      data.compareAtPriceCents !== undefined ? data.compareAtPriceCents : existing.compareAtPriceCents,
      data.isCombo ?? existing.isCombo,
      id,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function softDelete(client: PoolClient, id: number): Promise<void> {
  await client.query('UPDATE products SET active = FALSE, updated_at = now() WHERE id = $1', [id]);
}

export interface StockAdjustment {
  prevQuantity: number;
  nextQuantity: number;
}

/**
 * Ajusta o estoque com guarda no próprio UPDATE: se o resultado ficaria
 * negativo, nenhuma linha é afetada e lançamos erro (a transação inteira faz
 * rollback). É esta condição — não a validação prévia do service — que
 * impede overselling quando dois caixas/pedidos disputam a última unidade.
 * Retorna as quantidades anterior/posterior capturadas atomicamente, para a
 * trilha de movimentações.
 */
export async function adjustStockQuantity(
  client: PoolClient,
  id: number,
  delta: number,
  allowNegative = false
): Promise<StockAdjustment> {
  const guard = allowNegative ? '' : 'AND stock_quantity + $1 >= 0';
  const { rows } = await client.query(
    `UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = now()
     WHERE id = $2 ${guard}
     RETURNING stock_quantity AS next_quantity`,
    [delta, id]
  );
  if (rows.length === 0) {
    throw new AppError('Estoque insuficiente — outra venda pode ter consumido o produto', 409);
  }
  const nextQuantity: number = rows[0].next_quantity;
  return { prevQuantity: nextQuantity - delta, nextQuantity };
}
