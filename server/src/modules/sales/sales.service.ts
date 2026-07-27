import type { CreateSaleRequest } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import * as cashRepo from '../cash/cash.repository';
import * as customersRepo from '../customers/customers.repository';
import * as ledgerRepo from '../customers/ledger.repository';
import type { UserRole } from '@adega/shared';
import * as paymentMethodsRepo from '../paymentMethods/paymentMethods.repository';
import * as productsRepo from '../products/products.repository';
import * as discountsRepo from '../products/quantityDiscounts.repository';
import * as settingsService from '../settings/settings.service';
import * as stockComposition from '../stock/stockComposition.service';
import * as surchargeRulesRepo from '../surchargeRules/surchargeRules.repository';
import * as usersRepo from '../users/users.repository';
import * as repo from './sales.repository';

/** Vencimento de uma venda fiada = hoje + prazo padrão configurado na loja. */
export async function computeFiadoDueDate(client: PoolClient): Promise<string> {
  const settings = await settingsService.loadSettings(client);
  const due = new Date();
  due.setDate(due.getDate() + settings.fiadoDueDays);
  return due.toISOString().slice(0, 10);
}

// Fase 3: teto de desconto manual quando o usuário não tem um valor próprio
// configurado (User.maxDiscountPercent nulo). Admin sem teto (null = ilimitado).
const DEFAULT_MAX_DISCOUNT_PERCENT: Record<UserRole, number | null> = {
  FUNCIONARIO: 10,
  GERENTE: 50,
  ADMIN_LOJA: null,
  SUPER_ADMIN: null,
};

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

    const actingUser = userId !== null ? await usersRepo.findById(client, userId) : undefined;
    const allowNegativeStock = actingUser?.canSellWithoutStock ?? false;

    // Um único round-trip pra todos os produtos do carrinho em vez de um por
    // item — a checagem atômica de estoque continua acontecendo depois, em
    // adjustStockQuantity, então isso não muda nenhuma garantia de concorrência.
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const foundProducts = await productsRepo.findByIds(client, productIds);
    const productsById = new Map(foundProducts.map((p) => [p.id, p]));
    const tiersByProduct = await discountsRepo.listActiveByProducts(client, productIds);

    const products = [];
    for (const item of input.items) {
      const product = productsById.get(item.productId);
      if (!product) throw new AppError(`Produto #${item.productId} não encontrado`, 404);
      if (!product.active) throw new AppError(`Produto "${product.name}" está inativo`);
      if (item.quantity <= 0) throw new AppError('Quantidade deve ser positiva');
      // Combo não usa o próprio stock_quantity — a baixa acontece nos combo_items.
      if (!product.isCombo && !allowNegativeStock && product.stockQuantity < item.quantity) {
        throw new AppError(
          `Estoque insuficiente para "${product.name}" (disponível: ${product.stockQuantity})`
        );
      }
      const { resolved: addons, extraPriceCentsTotal } = await stockComposition.resolveAddonSelections(
        client,
        product.id,
        item.addons
      );
      products.push({ item, product, addons, extraPriceCentsTotal });
    }

    let subtotalCents = 0;
    const itemsToInsert = [];
    for (const { item, product, addons, extraPriceCentsTotal } of products) {
      // Desconto manual do operador tem prioridade; sem ele, aplica a melhor
      // faixa de quantidade vigente automaticamente (maior min_quantity <=
      // quantidade, dentre as ativas e vigentes já buscadas em lote acima).
      let itemDiscount = item.discountCents ?? 0;
      if (itemDiscount === 0) {
        const tiers = tiersByProduct.get(product.id) ?? [];
        const tier = [...tiers].reverse().find((t) => t.minQuantity <= item.quantity);
        if (tier) {
          itemDiscount = discountsRepo.computeDiscountCents(tier, item.quantity, item.unitPriceCents);
        }
      }
      const unitPriceCents = item.unitPriceCents + extraPriceCentsTotal;
      const totalCents = unitPriceCents * item.quantity - itemDiscount;
      subtotalCents += totalCents;
      itemsToInsert.push({
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: item.quantity,
        unitPriceCents,
        unitCostCents: product.costPriceCents,
        discountCents: itemDiscount,
        totalCents,
        isCombo: product.isCombo,
        addons,
        notes: item.notes?.trim() || null,
      });
    }

    const discountCents = input.discountCents ?? 0;
    const baseTotalCents = subtotalCents - discountCents;
    if (baseTotalCents < 0) throw new AppError('Desconto maior que o total da venda');

    if (discountCents > 0 && subtotalCents > 0) {
      const maxDiscountPercent =
        actingUser?.maxDiscountPercent ?? DEFAULT_MAX_DISCOUNT_PERCENT[actingUser?.role ?? 'FUNCIONARIO'];
      if (maxDiscountPercent !== null) {
        const discountPercent = (discountCents / subtotalCents) * 100;
        if (discountPercent > maxDiscountPercent + 0.01) {
          throw new AppError(
            `Desconto de ${discountPercent.toFixed(1)}% excede seu limite de ${maxDiscountPercent}%`,
            403
          );
        }
      }
    }

    const methods = await paymentMethodsRepo.listAll(client);
    const methodsById = new Map(methods.map((m) => [m.id, m]));
    let hasFiado = false;
    let hasCreditsAccount = false;
    for (const payment of input.payments) {
      const method = methodsById.get(payment.paymentMethodId);
      if (!method || !method.active) {
        throw new AppError('Meio de pagamento inválido ou inativo', 400);
      }
      if (method.allowsChange && payment.amountReceivedCents !== undefined) {
        if (payment.amountReceivedCents < payment.amountCents) {
          throw new AppError('Valor recebido é menor que o valor a pagar nesse método');
        }
      }
      if (method.kind === 'fiado') hasFiado = true;
      if (method.creditsAccount) hasCreditsAccount = true;
    }
    if (hasFiado && input.customerId === undefined) {
      throw new AppError('Selecione o cliente para vender fiado');
    }
    if (hasCreditsAccount && input.customerId === undefined) {
      throw new AppError('Selecione o cliente para creditar em conta');
    }

    // Acréscimo automático no atacado: só quando todos os pagamentos usam
    // meios com a MESMA regra ativa — evita cálculo ambíguo em split payment
    // com métodos de taxas diferentes.
    const saleType = input.saleType ?? 'varejo';
    let surchargeCents = 0;
    if (saleType === 'atacado') {
      const rules = await surchargeRulesRepo.activePercentsByType(client, 'atacado');
      const percents = input.payments.map((p) => rules.get(p.paymentMethodId) ?? 0);
      const uniquePercents = new Set(percents.filter((p) => p > 0));
      if (uniquePercents.size === 1) {
        const [percent] = uniquePercents;
        surchargeCents = Math.round((baseTotalCents * percent) / 100);
      }
    }
    const totalCents = baseTotalCents + surchargeCents;

    const paymentsTotal = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
    if (paymentsTotal !== totalCents) {
      throw new AppError(
        `Total pago (${paymentsTotal}) não confere com o total da venda (${totalCents})`
      );
    }

    const saleId = await repo.insertSale(client, {
      saleType,
      subtotalCents,
      discountCents,
      surchargeCents,
      totalCents,
      cashSessionId: cashSession.id,
      userId,
      customerId: input.customerId ?? null,
      notes: input.notes?.trim() || null,
    });

    for (const itemInput of itemsToInsert) {
      const itemId = await repo.insertSaleItem(client, {
        saleId,
        productId: itemInput.productId,
        productNameSnapshot: itemInput.productNameSnapshot,
        quantity: itemInput.quantity,
        unitPriceCents: itemInput.unitPriceCents,
        unitCostCents: itemInput.unitCostCents,
        discountCents: itemInput.discountCents,
        totalCents: itemInput.totalCents,
        notes: itemInput.notes,
      });
      for (const addon of itemInput.addons) {
        await repo.insertItemAddon(client, { saleItemId: itemId, ...addon });
      }
      await stockComposition.applyItemStock(client, {
        productId: itemInput.productId,
        isCombo: itemInput.isCombo,
        quantity: itemInput.quantity,
        sign: -1,
        addons: itemInput.addons,
        movementType: 'venda',
        reason: null,
        saleId,
        idempotencyPrefix: `sale:${saleId}:${itemInput.productId}`,
        userId,
        unitCostCents: itemInput.unitCostCents,
        allowNegative: allowNegativeStock,
      });
    }

    const fiadoDueDate = hasFiado ? await computeFiadoDueDate(client) : null;

    for (const payment of input.payments) {
      const method = methodsById.get(payment.paymentMethodId)!;
      const amountReceivedCents = method.allowsChange
        ? payment.amountReceivedCents ?? payment.amountCents
        : null;
      const changeCents = amountReceivedCents !== null ? amountReceivedCents - payment.amountCents : 0;
      const netAmountCents = Math.round(payment.amountCents * (1 - method.retentionPercent / 100));
      await repo.insertPayment(client, {
        saleId,
        paymentMethodId: payment.paymentMethodId,
        amountCents: payment.amountCents,
        amountReceivedCents,
        changeCents,
        netAmountCents,
      });
      if (method.kind === 'fiado') {
        await ledgerRepo.addEntry(client, {
          customerId: input.customerId!,
          type: 'fiado_venda',
          amountCents: -payment.amountCents,
          saleId,
          dueDate: fiadoDueDate,
          notes: `Venda #${saleId}`,
          userId,
        });
      }
      if (method.creditsAccount) {
        await ledgerRepo.addEntry(client, {
          customerId: input.customerId!,
          type: 'credito_adicionado',
          amountCents: payment.amountCents,
          saleId,
          notes: `Venda #${saleId}`,
          userId,
        });
      }
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
      const product = await productsRepo.findById(client, item.productId);
      await stockComposition.applyItemStock(client, {
        productId: item.productId,
        isCombo: product?.isCombo ?? false,
        quantity: item.quantity,
        sign: 1,
        addons: item.addons,
        movementType: 'cancelamento_venda',
        reason: `Cancelamento da venda #${id}: ${reason.trim()}`,
        saleId: id,
        idempotencyPrefix: `sale-cancel:${id}:${item.id}`,
        userId,
        unitCostCents: item.unitCostCents,
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

    const product = await productsRepo.findById(client, item.productId);
    await stockComposition.applyItemStock(client, {
      productId: item.productId,
      isCombo: product?.isCombo ?? false,
      quantity: item.quantity,
      sign: 1,
      addons: item.addons,
      movementType: 'cancelamento_venda',
      reason: `Cancelamento do item #${itemId} da venda #${saleId}: ${reason.trim()}`,
      saleId,
      idempotencyPrefix: `sale-item-cancel:${itemId}`,
      userId,
      unitCostCents: item.unitCostCents,
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
