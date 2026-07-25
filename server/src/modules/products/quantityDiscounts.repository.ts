import type { QuantityDiscountTier, QuantityDiscountType } from '@adega/shared';
import type { PoolClient } from 'pg';

interface TierRow {
  id: number;
  product_id: number;
  min_quantity: number;
  discount_type: QuantityDiscountType;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

function mapRow(row: TierRow): QuantityDiscountTier {
  return {
    id: row.id,
    productId: row.product_id,
    minQuantity: row.min_quantity,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    active: row.active,
  };
}

export async function listByProduct(client: PoolClient, productId: number): Promise<QuantityDiscountTier[]> {
  const { rows } = await client.query(
    'SELECT * FROM product_quantity_discounts WHERE product_id = $1 ORDER BY min_quantity ASC',
    [productId]
  );
  return rows.map(mapRow);
}

/** Faixas ativas e dentro do período de vigência, para todos os produtos
 * informados — usado para montar o catálogo público sem N+1 queries. */
export async function listActiveByProducts(
  client: PoolClient,
  productIds: number[]
): Promise<Map<number, QuantityDiscountTier[]>> {
  const map = new Map<number, QuantityDiscountTier[]>();
  if (productIds.length === 0) return map;
  const { rows } = await client.query(
    `SELECT * FROM product_quantity_discounts
     WHERE product_id = ANY($1) AND active = TRUE
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at >= now())
     ORDER BY product_id ASC, min_quantity ASC`,
    [productIds]
  );
  for (const row of rows) {
    const tier = mapRow(row);
    const list = map.get(tier.productId) ?? [];
    list.push(tier);
    map.set(tier.productId, list);
  }
  return map;
}

export interface CreateTierInput {
  productId: number;
  minQuantity: number;
  discountType: QuantityDiscountType;
  discountValue: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function create(client: PoolClient, input: CreateTierInput): Promise<QuantityDiscountTier> {
  const { rows } = await client.query(
    `INSERT INTO product_quantity_discounts
      (product_id, min_quantity, discount_type, discount_value, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.productId,
      input.minQuantity,
      input.discountType,
      input.discountValue,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ]
  );
  return mapRow(rows[0]);
}

export interface UpdateTierInput {
  minQuantity?: number;
  discountType?: QuantityDiscountType;
  discountValue?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
}

export async function findById(client: PoolClient, id: number): Promise<QuantityDiscountTier | undefined> {
  const { rows } = await client.query('SELECT * FROM product_quantity_discounts WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function update(
  client: PoolClient,
  id: number,
  input: UpdateTierInput
): Promise<QuantityDiscountTier | undefined> {
  const current = await findById(client, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  const { rows } = await client.query(
    `UPDATE product_quantity_discounts SET
      min_quantity = $1, discount_type = $2, discount_value = $3,
      starts_at = $4, ends_at = $5, active = $6
     WHERE id = $7 RETURNING *`,
    [next.minQuantity, next.discountType, next.discountValue, next.startsAt, next.endsAt, next.active, id]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function remove(client: PoolClient, id: number): Promise<void> {
  await client.query('DELETE FROM product_quantity_discounts WHERE id = $1', [id]);
}

/** Melhor faixa aplicável para uma quantidade — a de maior min_quantity que
 * ainda seja <= quantity, dentre as ativas e vigentes. */
export async function findBestTier(
  client: PoolClient,
  productId: number,
  quantity: number
): Promise<QuantityDiscountTier | undefined> {
  const { rows } = await client.query(
    `SELECT * FROM product_quantity_discounts
     WHERE product_id = $1 AND active = TRUE AND min_quantity <= $2
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at >= now())
     ORDER BY min_quantity DESC
     LIMIT 1`,
    [productId, quantity]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

/** Calcula o desconto (em centavos) para uma faixa aplicada a uma quantidade
 * de itens vendidos a unitPriceCents cada. */
export function computeDiscountCents(
  tier: QuantityDiscountTier,
  quantity: number,
  unitPriceCents: number
): number {
  if (tier.discountType === 'fixed') {
    return Math.min(tier.discountValue * quantity, unitPriceCents * quantity);
  }
  const lineTotal = unitPriceCents * quantity;
  return Math.round((lineTotal * tier.discountValue) / 100);
}
