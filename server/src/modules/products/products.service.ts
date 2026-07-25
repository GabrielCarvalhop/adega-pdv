import type {
  CreateProductRequest,
  CreateQuantityDiscountRequest,
  UpdateProductRequest,
  UpdateQuantityDiscountRequest,
} from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import * as repo from './products.repository';
import * as discountsRepo from './quantityDiscounts.repository';
import * as addonsRepo from '../addons/addons.repository';
import * as comboItemsRepo from './comboItems.repository';

// 23505 = unique_violation no Postgres
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export function listProducts(tenantId: number, filters: repo.ProductFilters) {
  return withTenantTransaction(tenantId, (client) => repo.findAll(client, filters));
}

export function getProduct(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const product = await repo.findById(client, id);
    if (!product) throw new AppError('Produto não encontrado', 404);
    return product;
  });
}

export function getByBarcode(tenantId: number, barcode: string) {
  return withTenantTransaction(tenantId, async (client) => {
    const product = await repo.findByBarcode(client, barcode);
    if (!product) throw new AppError('Produto não encontrado para este código de barras', 404);
    return product;
  });
}

export function getLowStock(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.findLowStock(client));
}

export async function createProduct(tenantId: number, data: CreateProductRequest) {
  try {
    return await withTenantTransaction(tenantId, (client) => repo.create(client, data));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError('Já existe um produto com este código de barras ou SKU', 409);
    }
    throw err;
  }
}

export async function updateProduct(tenantId: number, id: number, data: UpdateProductRequest) {
  try {
    return await withTenantTransaction(tenantId, async (client) => {
      const updated = await repo.update(client, id, data);
      if (!updated) throw new AppError('Produto não encontrado', 404);
      return updated;
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new AppError('Já existe um produto com este código de barras ou SKU', 409);
    }
    throw err;
  }
}

export function reorderProducts(tenantId: number, ids: number[]) {
  return withTenantTransaction(tenantId, (client) => repo.reorder(client, ids));
}

export function deleteProduct(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const product = await repo.findById(client, id);
    if (!product) throw new AppError('Produto não encontrado', 404);
    await repo.softDelete(client, id);
  });
}

export function listQuantityDiscounts(tenantId: number, productId: number) {
  return withTenantTransaction(tenantId, (client) => discountsRepo.listByProduct(client, productId));
}

export function createQuantityDiscount(
  tenantId: number,
  productId: number,
  data: CreateQuantityDiscountRequest
) {
  if (data.minQuantity < 2) throw new AppError('Quantidade mínima deve ser maior que 1');
  if (data.discountType === 'percent' && (data.discountValue < 1 || data.discountValue > 100)) {
    throw new AppError('Percentual deve estar entre 1 e 100');
  }
  if (data.discountType === 'fixed' && data.discountValue < 1) {
    throw new AppError('Valor de desconto deve ser positivo');
  }
  return withTenantTransaction(tenantId, async (client) => {
    const product = await repo.findById(client, productId);
    if (!product) throw new AppError('Produto não encontrado', 404);
    try {
      return await discountsRepo.create(client, { productId, ...data });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new AppError('Já existe uma faixa para esta quantidade mínima', 409);
      }
      throw err;
    }
  });
}

export function updateQuantityDiscount(
  tenantId: number,
  tierId: number,
  data: UpdateQuantityDiscountRequest
) {
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await discountsRepo.update(client, tierId, data);
    if (!updated) throw new AppError('Faixa de desconto não encontrada', 404);
    return updated;
  });
}

export function deleteQuantityDiscount(tenantId: number, tierId: number) {
  return withTenantTransaction(tenantId, (client) => discountsRepo.remove(client, tierId));
}

export function listAddonGroupLinks(tenantId: number, productId: number) {
  return withTenantTransaction(tenantId, (client) => addonsRepo.listLinksForProduct(client, productId));
}

/** Grupos ativos (com opções ativas) vinculados ao produto — usado para
 * montar o seletor de complementos no PDV antes de adicionar ao carrinho. */
export function listAvailableAddons(tenantId: number, productId: number) {
  return withTenantTransaction(tenantId, (client) => addonsRepo.listActiveGroupsForProduct(client, productId));
}

export function linkAddonGroup(tenantId: number, productId: number, addonGroupId: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const product = await repo.findById(client, productId);
    if (!product) throw new AppError('Produto não encontrado', 404);
    const group = await addonsRepo.findGroupById(client, addonGroupId);
    if (!group) throw new AppError('Grupo de complemento não encontrado', 404);
    return addonsRepo.linkGroupToProduct(client, productId, addonGroupId);
  });
}

export function unlinkAddonGroup(tenantId: number, productId: number, addonGroupId: number) {
  return withTenantTransaction(tenantId, (client) => addonsRepo.unlinkGroupFromProduct(client, productId, addonGroupId));
}

export function listComboItems(tenantId: number, comboProductId: number) {
  return withTenantTransaction(tenantId, (client) => comboItemsRepo.listByCombo(client, comboProductId));
}

export function replaceComboItems(
  tenantId: number,
  comboProductId: number,
  items: { componentProductId: number; quantity: number }[]
) {
  if (items.some((i) => i.componentProductId === comboProductId)) {
    throw new AppError('Um combo não pode conter a si mesmo como item');
  }
  return withTenantTransaction(tenantId, async (client) => {
    const combo = await repo.findById(client, comboProductId);
    if (!combo) throw new AppError('Produto não encontrado', 404);
    if (!combo.isCombo) throw new AppError('Produto não está marcado como combo');
    for (const item of items) {
      const component = await repo.findById(client, item.componentProductId);
      if (!component) throw new AppError(`Produto componente ${item.componentProductId} não encontrado`, 404);
      if (item.quantity < 1) throw new AppError('Quantidade do item deve ser ao menos 1');
    }
    return comboItemsRepo.replaceComboItems(client, comboProductId, items);
  });
}
