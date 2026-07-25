import type { CreateStockMovementRequest } from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import * as cashRepo from '../cash/cash.repository';
import * as productsRepo from '../products/products.repository';
import * as repo from './stock.repository';

export function listMovements(tenantId: number, filters: repo.StockMovementFilters) {
  return withTenantTransaction(tenantId, (client) => repo.listMovements(client, filters));
}

export function registerManualMovement(
  tenantId: number,
  input: CreateStockMovementRequest,
  userId: number | null
) {
  const ENTRADAS = new Set(['entrada_manual', 'devolucao']);
  const SAIDAS = new Set(['saida_manual', 'perda', 'avaria', 'consumo_interno']);

  return withTenantTransaction(tenantId, async (client) => {
    const product = await productsRepo.findById(client, input.productId);
    if (!product) throw new AppError('Produto não encontrado', 404);

    // Rastreia em qual caixa/terminal a movimentação foi feita, quando dá pra
    // saber sem ambiguidade (exatamente um caixa aberto no momento).
    const openSessions = await cashRepo.listOpenSessions(client);
    const cashSessionId = openSessions.length === 1 ? openSessions[0].id : null;

    let delta: number;
    if (ENTRADAS.has(input.type)) {
      if (input.quantity <= 0) throw new AppError('Quantidade de entrada deve ser positiva');
      delta = input.quantity;
    } else if (SAIDAS.has(input.type)) {
      if (input.quantity <= 0) throw new AppError('Quantidade de saída deve ser positiva');
      if (product.stockQuantity - input.quantity < 0) {
        throw new AppError('Estoque insuficiente para esta saída');
      }
      delta = -input.quantity;
    } else {
      // ajuste: quantity é o delta assinado (pode ser positivo ou negativo)
      if (input.quantity === 0) throw new AppError('Quantidade de ajuste não pode ser zero');
      if (product.stockQuantity + input.quantity < 0) {
        throw new AppError('Ajuste resultaria em estoque negativo');
      }
      delta = input.quantity;
    }

    const adj = await productsRepo.adjustStockQuantity(client, product.id, delta);
    const movement = await repo.insertMovement(client, {
      productId: product.id,
      type: input.type,
      quantity: Math.abs(input.quantity),
      prevQuantity: adj.prevQuantity,
      nextQuantity: adj.nextQuantity,
      reason: input.reason,
      unitCostCents: input.unitCostCents ?? null,
      saleId: null,
      userId,
      cashSessionId,
    });
    await logAction(client, userId, 'estoque.movimento_manual', 'stock_movement', movement.id, {
      productId: product.id,
      productName: product.name,
      type: input.type,
      delta,
      reason: input.reason,
    });
    return movement;
  });
}
