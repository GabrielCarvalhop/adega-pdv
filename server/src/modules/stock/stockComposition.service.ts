import type { AddonGroupWithOptions, CreateItemAddonSelection, StockMovementType } from '@adega/shared';
import type { PoolClient } from 'pg';
import { AppError } from '../../middlewares/errorHandler';
import * as addonsRepo from '../addons/addons.repository';
import * as comboItemsRepo from '../products/comboItems.repository';
import * as productsRepo from '../products/products.repository';
import * as stockRepo from './stock.repository';

export interface ResolvedAddonSelection {
  addonOptionId: number | null;
  labelSnapshot: string;
  extraPriceCentsSnapshot: number;
  productIdSnapshot: number | null;
  quantity: number;
}

/**
 * Valida as opções escolhidas contra os grupos de complemento vinculados ao
 * produto (obrigatório/opcional, único/múltiplo, mín/máx — nunca confia só
 * no que o cliente mandou) e devolve as seleções resolvidas com snapshot de
 * rótulo/preço, prontas para gravar em sale_item_addons/order_item_addons.
 */
export async function resolveAddonSelections(
  client: PoolClient,
  productId: number,
  selections: CreateItemAddonSelection[] | undefined
): Promise<{ resolved: ResolvedAddonSelection[]; extraPriceCentsTotal: number }> {
  const groups = await addonsRepo.listActiveGroupsForProduct(client, productId);
  const chosen = selections ?? [];

  const optionIndex = new Map<
    number,
    { option: AddonGroupWithOptions['options'][number]; group: AddonGroupWithOptions }
  >();
  for (const group of groups) {
    for (const option of group.options) {
      optionIndex.set(option.id, { option, group });
    }
  }

  const countByGroup = new Map<number, number>();
  const resolved: ResolvedAddonSelection[] = [];
  for (const sel of chosen) {
    const found = optionIndex.get(sel.addonOptionId);
    if (!found) throw new AppError('Opção de complemento inválida para este produto', 400);
    const { option, group } = found;
    countByGroup.set(group.id, (countByGroup.get(group.id) ?? 0) + 1);
    resolved.push({
      addonOptionId: option.id,
      labelSnapshot: option.label,
      extraPriceCentsSnapshot: option.extraPriceCents,
      productIdSnapshot: option.productId,
      quantity: option.quantityPerSelection,
    });
  }

  for (const group of groups) {
    const count = countByGroup.get(group.id) ?? 0;
    if (count < group.minSelect) {
      throw new AppError(`Selecione ao menos ${group.minSelect} opção(ões) em "${group.name}"`, 400);
    }
    if (count > group.maxSelect) {
      throw new AppError(`Selecione no máximo ${group.maxSelect} opção(ões) em "${group.name}"`, 400);
    }
  }

  const extraPriceCentsTotal = resolved.reduce((sum, r) => sum + r.extraPriceCentsSnapshot, 0);
  return { resolved, extraPriceCentsTotal };
}

export interface ApplyItemStockInput {
  productId: number;
  isCombo: boolean;
  quantity: number;
  /** -1 baixa estoque (venda concluída / pedido aceito); +1 estorna (cancelamento). */
  sign: 1 | -1;
  addons: ResolvedAddonSelection[];
  movementType: StockMovementType;
  reason: string | null;
  saleId?: number | null;
  orderId?: number | null;
  idempotencyPrefix: string;
  userId: number | null;
  /** Custo unitário do item principal (não se aplica a componentes de combo
   * nem a produtos vinculados a complementos, cujo custo é o próprio deles). */
  unitCostCents?: number | null;
  /** Permite o produto principal ficar negativo (permissão "vender sem
   * estoque" do usuário) — nunca se aplica a componentes de combo/complemento. */
  allowNegative?: boolean;
}

/**
 * Baixa/estorna o estoque de um item vendido/pedido, combo-aware e
 * addon-aware: produto combo baixa os `combo_items` (componentes fixos) em
 * vez do próprio `stock_quantity` (que fica sem uso); cada complemento
 * escolhido com produto real vinculado baixa `quantityPerSelection *
 * quantidade do item` desse produto. Usado nos 5 pontos de baixa/estorno do
 * sistema (completeSale, cancelSale, cancelSaleItem, acceptOrder,
 * cancelOrder) para nunca duplicar/dessincronizar a regra combo+addon.
 * Os produtos envolvidos são sempre travados/ajustados em ordem crescente de
 * id para evitar deadlock entre transações concorrentes que envolvam os
 * mesmos produtos em papéis diferentes (item principal vs. componente).
 */
export async function applyItemStock(client: PoolClient, input: ApplyItemStockInput): Promise<void> {
  const delta = input.sign * input.quantity;

  const movements: { productId: number; delta: number; idempotencySuffix: string }[] = [];

  if (input.isCombo) {
    const comboItems = await comboItemsRepo.listByCombo(client, input.productId);
    for (const item of comboItems) {
      movements.push({
        productId: item.componentProductId,
        delta: delta * item.quantity,
        idempotencySuffix: `combo:${item.componentProductId}`,
      });
    }
  } else {
    movements.push({ productId: input.productId, delta, idempotencySuffix: 'main' });
  }

  for (const addon of input.addons) {
    if (addon.productIdSnapshot === null) continue;
    movements.push({
      productId: addon.productIdSnapshot,
      delta: delta * addon.quantity,
      idempotencySuffix: `addon:${addon.addonOptionId}`,
    });
  }

  movements.sort((a, b) => a.productId - b.productId);

  for (const movement of movements) {
    const allowNegative = movement.idempotencySuffix === 'main' && (input.allowNegative ?? false);
    const adj = await productsRepo.adjustStockQuantity(client, movement.productId, movement.delta, allowNegative);
    await stockRepo.insertMovement(client, {
      productId: movement.productId,
      type: input.movementType,
      quantity: Math.abs(movement.delta),
      prevQuantity: adj.prevQuantity,
      nextQuantity: adj.nextQuantity,
      reason: input.reason,
      unitCostCents: movement.idempotencySuffix === 'main' ? input.unitCostCents ?? null : null,
      saleId: input.saleId ?? null,
      orderId: input.orderId ?? null,
      idempotencyKey: `${input.idempotencyPrefix}:${movement.idempotencySuffix}`,
      userId: input.userId,
    });
  }
}
