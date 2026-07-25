import type {
  AddonGroup,
  AddonGroupWithOptions,
  AddonOption,
  AddonSelectionType,
  CreateAddonGroupRequest,
  CreateAddonOptionRequest,
  ProductAddonGroupLink,
  UpdateAddonGroupRequest,
  UpdateAddonOptionRequest,
} from '@adega/shared';
import type { PoolClient } from 'pg';

interface GroupRow {
  id: number;
  name: string;
  description: string | null;
  selection_type: AddonSelectionType;
  min_select: number;
  max_select: number;
  active: boolean;
}

function mapGroup(row: GroupRow): AddonGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    selectionType: row.selection_type,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    active: row.active,
  };
}

interface OptionRow {
  id: number;
  addon_group_id: number;
  label: string;
  product_id: number | null;
  extra_price_cents: number;
  quantity_per_selection: number;
  active: boolean;
  sort_order: number;
}

function mapOption(row: OptionRow): AddonOption {
  return {
    id: row.id,
    addonGroupId: row.addon_group_id,
    label: row.label,
    productId: row.product_id,
    extraPriceCents: row.extra_price_cents,
    quantityPerSelection: row.quantity_per_selection,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

// ---- Grupos ----

export async function listGroups(client: PoolClient): Promise<AddonGroup[]> {
  const { rows } = await client.query('SELECT * FROM addon_groups ORDER BY name ASC');
  return rows.map(mapGroup);
}

export async function findGroupById(client: PoolClient, id: number): Promise<AddonGroup | undefined> {
  const { rows } = await client.query('SELECT * FROM addon_groups WHERE id = $1', [id]);
  return rows[0] ? mapGroup(rows[0]) : undefined;
}

export async function createGroup(client: PoolClient, input: CreateAddonGroupRequest): Promise<AddonGroup> {
  const { rows } = await client.query(
    `INSERT INTO addon_groups (name, description, selection_type, min_select, max_select)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.name, input.description ?? null, input.selectionType, input.minSelect, input.maxSelect]
  );
  return mapGroup(rows[0]);
}

export async function updateGroup(
  client: PoolClient,
  id: number,
  input: UpdateAddonGroupRequest
): Promise<AddonGroup | undefined> {
  const existing = await findGroupById(client, id);
  if (!existing) return undefined;
  const next = { ...existing, ...input };
  const { rows } = await client.query(
    `UPDATE addon_groups SET name = $1, description = $2, selection_type = $3,
      min_select = $4, max_select = $5, active = $6
     WHERE id = $7 RETURNING *`,
    [next.name, next.description, next.selectionType, next.minSelect, next.maxSelect, next.active, id]
  );
  return rows[0] ? mapGroup(rows[0]) : undefined;
}

// ---- Opções ----

export async function listOptions(client: PoolClient, groupId: number): Promise<AddonOption[]> {
  const { rows } = await client.query(
    'SELECT * FROM addon_options WHERE addon_group_id = $1 ORDER BY sort_order ASC, id ASC',
    [groupId]
  );
  return rows.map(mapOption);
}

export async function findOptionById(client: PoolClient, id: number): Promise<AddonOption | undefined> {
  const { rows } = await client.query('SELECT * FROM addon_options WHERE id = $1', [id]);
  return rows[0] ? mapOption(rows[0]) : undefined;
}

export async function createOption(
  client: PoolClient,
  groupId: number,
  input: CreateAddonOptionRequest
): Promise<AddonOption> {
  const { rows } = await client.query(
    `INSERT INTO addon_options (addon_group_id, label, product_id, extra_price_cents, quantity_per_selection)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      groupId,
      input.label,
      input.productId ?? null,
      input.extraPriceCents ?? 0,
      input.quantityPerSelection ?? 1,
    ]
  );
  return mapOption(rows[0]);
}

export async function updateOption(
  client: PoolClient,
  id: number,
  input: UpdateAddonOptionRequest
): Promise<AddonOption | undefined> {
  const existing = await findOptionById(client, id);
  if (!existing) return undefined;
  const next = { ...existing, ...input };
  const { rows } = await client.query(
    `UPDATE addon_options SET label = $1, product_id = $2, extra_price_cents = $3,
      quantity_per_selection = $4, active = $5, sort_order = $6
     WHERE id = $7 RETURNING *`,
    [
      next.label,
      next.productId,
      next.extraPriceCents,
      next.quantityPerSelection,
      next.active,
      next.sortOrder,
      id,
    ]
  );
  return rows[0] ? mapOption(rows[0]) : undefined;
}

export async function deleteOption(client: PoolClient, id: number): Promise<void> {
  await client.query('DELETE FROM addon_options WHERE id = $1', [id]);
}

// ---- Grupos com opções (leitura combinada) ----

export async function listGroupsWithOptions(client: PoolClient): Promise<AddonGroupWithOptions[]> {
  const groups = await listGroups(client);
  const { rows: optionRows } = await client.query('SELECT * FROM addon_options ORDER BY sort_order ASC, id ASC');
  const optionsByGroup = new Map<number, AddonOption[]>();
  for (const row of optionRows) {
    const option = mapOption(row);
    const list = optionsByGroup.get(option.addonGroupId) ?? [];
    list.push(option);
    optionsByGroup.set(option.addonGroupId, list);
  }
  return groups.map((g) => ({ ...g, options: optionsByGroup.get(g.id) ?? [] }));
}

/** Grupos ativos (com opções ativas) vinculados a um produto — usado na
 * validação de venda/pedido e no cardápio público. */
export async function listActiveGroupsForProduct(
  client: PoolClient,
  productId: number
): Promise<AddonGroupWithOptions[]> {
  const map = await listActiveGroupsForProducts(client, [productId]);
  return map.get(productId) ?? [];
}

/** Versão em lote — evita N+1 ao montar o catálogo público. */
export async function listActiveGroupsForProducts(
  client: PoolClient,
  productIds: number[]
): Promise<Map<number, AddonGroupWithOptions[]>> {
  const result = new Map<number, AddonGroupWithOptions[]>();
  if (productIds.length === 0) return result;

  const { rows: linkRows } = await client.query(
    `SELECT pag.product_id, ag.*
     FROM product_addon_groups pag
     JOIN addon_groups ag ON ag.id = pag.addon_group_id
     WHERE pag.product_id = ANY($1) AND ag.active = TRUE
     ORDER BY pag.sort_order ASC, ag.name ASC`,
    [productIds]
  );
  if (linkRows.length === 0) return result;

  const groupIds = [...new Set(linkRows.map((r: GroupRow & { product_id: number }) => r.id))];
  const { rows: optionRows } = await client.query(
    'SELECT * FROM addon_options WHERE addon_group_id = ANY($1) AND active = TRUE ORDER BY sort_order ASC, id ASC',
    [groupIds]
  );
  const optionsByGroup = new Map<number, AddonOption[]>();
  for (const row of optionRows) {
    const option = mapOption(row);
    const list = optionsByGroup.get(option.addonGroupId) ?? [];
    list.push(option);
    optionsByGroup.set(option.addonGroupId, list);
  }

  for (const row of linkRows as (GroupRow & { product_id: number })[]) {
    const group: AddonGroupWithOptions = { ...mapGroup(row), options: optionsByGroup.get(row.id) ?? [] };
    const list = result.get(row.product_id) ?? [];
    list.push(group);
    result.set(row.product_id, list);
  }
  return result;
}

// ---- Vínculo produto <-> grupo ----

export async function listLinksForProduct(client: PoolClient, productId: number): Promise<ProductAddonGroupLink[]> {
  const { rows } = await client.query(
    'SELECT * FROM product_addon_groups WHERE product_id = $1 ORDER BY sort_order ASC, id ASC',
    [productId]
  );
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    addonGroupId: r.addon_group_id,
    sortOrder: r.sort_order,
  }));
}

export async function linkGroupToProduct(
  client: PoolClient,
  productId: number,
  addonGroupId: number
): Promise<ProductAddonGroupLink> {
  const { rows } = await client.query(
    `INSERT INTO product_addon_groups (product_id, addon_group_id)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id, product_id, addon_group_id) DO UPDATE SET addon_group_id = EXCLUDED.addon_group_id
     RETURNING *`,
    [productId, addonGroupId]
  );
  const r = rows[0];
  return { id: r.id, productId: r.product_id, addonGroupId: r.addon_group_id, sortOrder: r.sort_order };
}

export async function unlinkGroupFromProduct(
  client: PoolClient,
  productId: number,
  addonGroupId: number
): Promise<void> {
  await client.query('DELETE FROM product_addon_groups WHERE product_id = $1 AND addon_group_id = $2', [
    productId,
    addonGroupId,
  ]);
}
