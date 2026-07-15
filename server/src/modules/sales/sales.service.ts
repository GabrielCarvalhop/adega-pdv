import type { CreateSaleRequest } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import * as cashRepo from '../cash/cash.repository';
import * as customersRepo from '../customers/customers.repository';
import * as productsRepo from '../products/products.repository';
import * as stockRepo from '../stock/stock.repository';
import * as repo from './sales.repository';

export function listSales(tenantId: number, filters: repo.SaleFilters) {
  return withTenantTransaction(tenantId, (client) => repo.listSales(client, filters));
}

async function loadSaleDetail(client: PoolClient, id: number) {
  const sale = await repo.findSaleById(client, id);
  if (!sale) throw new AppError('Venda não encontrada', 404);
  return {
    sale,
    items: await repo.findItemsBySale(client, id),
    payments: await repo.findPaymentsBySale(client, id),
  };
}

export function getSaleDetail(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, (client) => loadSaleDetail(client, id));
}

export function completeSale(tenantId: number, input: CreateSaleRequest, userId: number | null) {
  if (!input.items.length) throw new AppError('Venda precisa ter ao menos um item');
  if (!input.payments.length) throw new AppError('Venda precisa ter ao menos um pagamento');

  return withTenantTransaction(tenantId, async (client) => {
    const openSessions = await cashRepo.listOpenSessions(client);
    if (openSessions.length === 0) {
      throw new AppError('Não há caixa aberto — abra o caixa antes de vender', 409);
    }

    let cashSession;
    if (input.cashSessionId !== undefined) {
      cashSession = openSessions.find((s) => s.id === input.cashSessionId);
      if (!cashSession) throw new AppError('Caixa informado não está aberto', 409);
    } else if (openSessions.length === 1) {
      cashSession = openSessions[0];
    } else {
      throw new AppError('Há mais de um caixa aberto — informe em qual caixa registrar a venda', 400);
    }

    if (input.customerId !== undefined) {
      const customer = await customersRepo.findById(client, input.customerId);
      if (!customer) throw new AppError('Cliente não encontrado', 404);
    }

    const products = [];
    for (const item of input.items) {
      const product = await productsRepo.findById(client, item.productId);
      if (!product) throw new AppError(`Produto #${item.productId} não encontrado`, 404);
      if (!product.active) throw new AppError(`Produto "${product.name}" está inativo`);
      if (item.quantity <= 0) throw new AppError('Quantidade deve ser positiva');
      if (product.stockQuantity < item.quantity) {
        throw new AppError(
          `Estoque insuficiente para "${product.name}" (disponível: ${product.stockQuantity})`
        );
      }
      products.push({ item, product });
    }

    let subtotalCents = 0;
    const itemsToInsert = products.map(({ item, product }) => {
      const itemDiscount = item.discountCents ?? 0;
      const totalCents = item.unitPriceCents * item.quantity - itemDiscount;
      subtotalCents += totalCents;
      return {
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unitCostCents: product.costPriceCents,
        discountCents: itemDiscount,
        totalCents,
      };
    });

    const discountCents = input.discountCents ?? 0;
    const totalCents = subtotalCents - discountCents;
    if (totalCents < 0) throw new AppError('Desconto maior que o total da venda');

    const paymentsTotal = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
    if (paymentsTotal !== totalCents) {
      throw new AppError(
        `Total pago (${paymentsTotal}) não confere com o total da venda (${totalCents})`
      );
    }

    for (const payment of input.payments) {
      if (payment.method === 'dinheiro' && payment.amountReceivedCents !== undefined) {
        if (payment.amountReceivedCents < payment.amountCents) {
          throw new AppError('Valor recebido em dinheiro é menor que o valor a pagar nesse método');
        }
      }
    }

    const saleId = await repo.insertSale(client, {
      subtotalCents,
      discountCents,
      totalCents,
      cashSessionId: cashSession.id,
      userId,
      customerId: input.customerId ?? null,
      notes: input.notes?.trim() || null,
    });

    for (const itemInput of itemsToInsert) {
      await repo.insertSaleItem(client, { saleId, ...itemInput });
      const adj = await productsRepo.adjustStockQuantity(client, itemInput.productId, -itemInput.quantity);
      await stockRepo.insertMovement(client, {
        productId: itemInput.productId,
        type: 'venda',
        quantity: itemInput.quantity,
        prevQuantity: adj.prevQuantity,
        nextQuantity: adj.nextQuantity,
        reason: null,
        unitCostCents: itemInput.unitCostCents,
        saleId,
        idempotencyKey: `sale:${saleId}:${itemInput.productId}`,
        userId,
      });
    }

    for (const payment of input.payments) {
      const amountReceivedCents =
        payment.method === 'dinheiro' ? payment.amountReceivedCents ?? payment.amountCents : null;
      const changeCents = amountReceivedCents !== null ? amountReceivedCents - payment.amountCents : 0;
      await repo.insertPayment(client, {
        saleId,
        method: payment.method,
        amountCents: payment.amountCents,
        amountReceivedCents,
        changeCents,
      });
    }

    if (discountCents > 0) {
      await logAction(client, userId, 'venda.desconto', 'sale', saleId, {
        discountCents,
        totalCents,
      });
    }

    return loadSaleDetail(client, saleId);
  });
}

export function cancelSale(tenantId: number, id: number, reason: string, userId: number | null) {
  if (!reason.trim()) throw new AppError('Motivo do cancelamento é obrigatório');

  return withTenantTransaction(tenantId, async (client) => {
    const sale = await repo.findSaleById(client, id);
    if (!sale) throw new AppError('Venda não encontrada', 404);
    if (sale.status !== 'concluida') throw new AppError('Somente vendas concluídas podem ser canceladas');

    const items = (await repo.findItemsBySale(client, id)).filter((i) => !i.canceled);

    for (const item of items) {
      const adj = await productsRepo.adjustStockQuantity(client, item.productId, item.quantity);
      await stockRepo.insertMovement(client, {
        productId: item.productId,
        type: 'cancelamento_venda',
        quantity: item.quantity,
        prevQuantity: adj.prevQuantity,
        nextQuantity: adj.nextQuantity,
        reason: `Cancelamento da venda #${id}: ${reason.trim()}`,
        unitCostCents: item.unitCostCents,
        saleId: id,
        idempotencyKey: `sale-cancel:${id}:${item.id}`,
        userId,
      });
    }
    await repo.markAllItemsCanceled(client, id);
    await repo.markSaleCanceled(client, id, reason.trim());
    await logAction(client, userId, 'venda.cancelamento', 'sale', id, {
      reason: reason.trim(),
      totalCents: sale.totalCents,
    });
    return loadSaleDetail(client, id);
  });
}

export function cancelSaleItem(
  tenantId: number,
  saleId: number,
  itemId: number,
  reason: string,
  userId: number | null
) {
  if (!reason.trim()) throw new AppError('Motivo do cancelamento é obrigatório');

  return withTenantTransaction(tenantId, async (client) => {
    const sale = await repo.findSaleById(client, saleId);
    if (!sale) throw new AppError('Venda não encontrada', 404);
    if (sale.status !== 'concluida') {
      throw new AppError('Somente itens de vendas concluídas podem ser cancelados individualmente');
    }

    const item = await repo.findItemById(client, saleId, itemId);
    if (!item) throw new AppError('Item não encontrado', 404);
    if (item.canceled) throw new AppError('Este item já está cancelado');

    const adj = await productsRepo.adjustStockQuantity(client, item.productId, item.quantity);
    await stockRepo.insertMovement(client, {
      productId: item.productId,
      type: 'cancelamento_venda',
      quantity: item.quantity,
      prevQuantity: adj.prevQuantity,
      nextQuantity: adj.nextQuantity,
      reason: `Cancelamento do item #${itemId} da venda #${saleId}: ${reason.trim()}`,
      unitCostCents: item.unitCostCents,
      saleId,
      idempotencyKey: `sale-item-cancel:${itemId}`,
      userId,
    });
    await repo.markItemCanceled(client, itemId);

    const remainingItems = (await repo.findItemsBySale(client, saleId)).filter((i) => !i.canceled);
    const newSubtotal = remainingItems.reduce((sum, i) => sum + i.totalCents, 0);
    const newTotal = Math.max(0, newSubtotal - sale.discountCents);
    await repo.updateSaleTotalsAfterItemCancel(client, saleId, newSubtotal, newTotal);

    await logAction(client, userId, 'venda.cancelamento_item', 'sale_item', itemId, {
      saleId,
      reason: reason.trim(),
      itemTotalCents: item.totalCents,
    });

    return loadSaleDetail(client, saleId);
  });
}
