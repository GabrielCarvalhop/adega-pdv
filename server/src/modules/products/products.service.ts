import type { CreateProductRequest, UpdateProductRequest } from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import * as repo from './products.repository';

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

export function deleteProduct(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const product = await repo.findById(client, id);
    if (!product) throw new AppError('Produto não encontrado', 404);
    await repo.softDelete(client, id);
  });
}
