import type { ComboItem } from '@adega/shared';
import type { PoolClient } from 'pg';

interface ComboItemRow {
  id: number;
  combo_product_id: number;
  component_product_id: number;
  component_product_name: string;
  quantity: number;
}

function mapRow(row: ComboItemRow): ComboItem {
  return {
    id: row.id,
    comboProductId: row.combo_product_id,
    componentProductId: row.component_product_id,
    componentProductName: row.component_product_name,
    quantity: row.quantity,
  };
}

export async function listByCombo(client: PoolClient, comboProductId: number): Promise<ComboItem[]> {
  const { rows } = await client.query(
    `SELECT ci.*, p.name AS component_product_name
     FROM combo_items ci
     JOIN products p ON p.id = ci.component_product_id
     WHERE ci.combo_product_id = $1
     ORDER BY p.name ASC`,
    [comboProductId]
  );
  return rows.map(mapRow);
}

/** Itens de combo para vários combos de uma vez — usado na baixa de estoque
 * (stockComposition.service.ts) e para evitar N+1 no catálogo. */
export async function listByCombos(
  client: PoolClient,
  comboProductIds: number[]
): Promise<Map<number, ComboItem[]>> {
  const map = new Map<number, ComboItem[]>();
  if (comboProductIds.length === 0) return map;
  const { rows } = await client.query(
    `SELECT ci.*, p.name AS component_product_name
     FROM combo_items ci
     JOIN products p ON p.id = ci.component_product_id
     WHERE ci.combo_product_id = ANY($1)
     ORDER BY ci.combo_product_id ASC, p.name ASC`,
    [comboProductIds]
  );
  for (const row of rows) {
    const item = mapRow(row);
    const list = map.get(item.comboProductId) ?? [];
    list.push(item);
    map.set(item.comboProductId, list);
  }
  return map;
}

export async function replaceComboItems(
  client: PoolClient,
  comboProductId: number,
  items: { componentProductId: number; quantity: number }[]
): Promise<ComboItem[]> {
  await client.query('DELETE FROM combo_items WHERE combo_product_id = $1', [comboProductId]);
  for (const item of items) {
    await client.query(
      `INSERT INTO combo_items (combo_product_id, component_product_id, quantity)
       VALUES ($1, $2, $3)`,
      [comboProductId, item.componentProductId, item.quantity]
    );
  }
  return listByCombo(client, comboProductId);
}
