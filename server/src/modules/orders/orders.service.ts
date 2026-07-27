import type { CreatePublicOrderRequest, OrderDetail, PublicOrderStatus } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import * as cashRepo from '../cash/cash.repository';
import * as customersRepo from '../customers/customers.repository';
import * as ledgerRepo from '../customers/ledger.repository';
import * as comboItemsRepo from '../products/comboItems.repository';
import * as deliveryZonesService from '../deliveryZones/deliveryZones.service';
import * as paymentMethodsRepo from '../paymentMethods/paymentMethods.repository';
import * as productsRepo from '../products/products.repository';
import * as discountsRepo from '../products/quantityDiscounts.repository';
import * as salesRepo from '../sales/sales.repository';
import * as salesService from '../sales/sales.service';
import * as stockComposition from '../stock/stockComposition.service';
import * as settingsService from '../settings/settings.service';
import * as repo from './orders.repository';

const MAX_ITEMS_PER_ORDER = 50;
const MAX_QTY_PER_ITEM = 99;

async function loadDetail(client: PoolClient, id: number): Promise<OrderDetail> {
  const order = await repo.findById(client, id);
  if (!order) throw new AppError('Pedido não encontrado', 404);
  return { order, items: await repo.findItems(client, id) };
}

/** Criação pública (cliente final). Preços e totais SEMPRE do servidor. */
export function createPublicOrder(tenantId: number, input: CreatePublicOrderRequest) {
  return withTenantTransaction(tenantId, async (client) => {
    // Idempotência: reenvio (duplo clique, retry de rede) devolve o pedido já criado.
    const existingId = await repo.findIdByPublicKey(client, input.publicKey);
    if (existingId !== undefined) return loadDetail(client, existingId);

    const settings = await settingsService.loadSettings(client);
    if (!settings.catalogEnabled) throw new AppError('Cardápio indisponível', 404);
    if (input.fulfillment === 'entrega' && !settings.deliveryEnabled) {
      throw new AppError('Esta loja não está fazendo entregas no momento');
    }
    if (input.fulfillment === 'retirada' && !settings.pickupEnabled) {
      throw new AppError('Esta loja não está aceitando retirada no momento');
    }
    if (input.fulfillment === 'entrega' && !input.address?.trim()) {
      throw new AppError('Endereço é obrigatório para entrega');
    }
    if (input.items.length === 0) throw new AppError('Pedido vazio');
    if (input.items.length > MAX_ITEMS_PER_ORDER) throw new AppError('Pedido com itens demais');

    const paymentMethod = await paymentMethodsRepo.findById(client, input.paymentMethodIntentId);
    if (!paymentMethod || !paymentMethod.active) {
      throw new AppError('Meio de pagamento inválido ou indisponível', 400);
    }

    let subtotalCents = 0;
    const resolved = [];
    for (const item of input.items) {
      if (item.quantity < 1 || item.quantity > MAX_QTY_PER_ITEM) {
        throw new AppError('Quantidade inválida');
      }
      // Trava a linha do produto para serializar a checagem de disponibilidade
      // (estoque - reservas de outros pedidos pendentes) contra concorrência.
      const product = await productsRepo.lockById(client, item.productId);
      if (!product || !product.active || !product.visibleInCatalog) {
        throw new AppError('Produto indisponível no cardápio', 400);
      }

      const { resolved: addons, extraPriceCentsTotal } = await stockComposition.resolveAddonSelections(
        client,
        product.id,
        item.addons
      );

      // Produtos que efetivamente consomem estoque para esta linha: o
      // próprio produto (ou os itens fixos do combo) + complementos
      // vinculados a produto real — cada um precisa de reserva própria para
      // não vender além do disponível entre a criação e o aceite do pedido.
      const stockConsumption: { productId: number; qty: number }[] = [];
      if (product.isCombo) {
        const comboItems = await comboItemsRepo.listByCombo(client, product.id);
        for (const ci of comboItems) {
          stockConsumption.push({ productId: ci.componentProductId, qty: ci.quantity * item.quantity });
        }
      } else {
        stockConsumption.push({ productId: product.id, qty: item.quantity });
      }
      for (const addon of addons) {
        if (addon.productIdSnapshot !== null) {
          stockConsumption.push({ productId: addon.productIdSnapshot, qty: addon.quantity * item.quantity });
        }
      }

      for (const consumption of stockConsumption) {
        const consumedProduct =
          consumption.productId === product.id ? product : await productsRepo.lockById(client, consumption.productId);
        if (!consumedProduct) throw new AppError('Produto indisponível no cardápio', 400);
        const reserved = await repo.reservedQuantity(client, consumedProduct.id);
        const available = consumedProduct.stockQuantity - reserved;
        if (available < consumption.qty) {
          throw new AppError(
            `"${consumedProduct.name}" está com estoque insuficiente no momento (disponível: ${Math.max(0, available)})`,
            409
          );
        }
      }

      // Desconto por faixa de quantidade sempre aplicado automaticamente —
      // não há operador no checkout público para decidir manualmente.
      const tier = await discountsRepo.findBestTier(client, product.id, item.quantity);
      const itemDiscount = tier
        ? discountsRepo.computeDiscountCents(tier, item.quantity, product.salePriceCents)
        : 0;
      const unitPriceCents = product.salePriceCents + extraPriceCentsTotal;
      const totalCents = unitPriceCents * item.quantity - itemDiscount;
      subtotalCents += totalCents;
      resolved.push({ product, quantity: item.quantity, totalCents, unitPriceCents, addons, stockConsumption });
    }

    let deliveryFeeCents = 0;
    if (input.fulfillment === 'entrega') {
      const check = await deliveryZonesService.checkDelivery(
        client,
        input.district,
        settings.deliveryFeeCents,
        subtotalCents
      );
      if (!check.allowed) throw new AppError(check.reason ?? 'Entrega indisponível para este endereço', 400);
      deliveryFeeCents = check.feeCents;
    }
    const totalCents = subtotalCents + deliveryFeeCents;

    if (settings.minOrderCents > 0 && subtotalCents < settings.minOrderCents) {
      throw new AppError(
        `Pedido mínimo de R$ ${(settings.minOrderCents / 100).toFixed(2).replace('.', ',')} (sem contar a entrega)`
      );
    }
    if (paymentMethod.allowsChange && input.changeForCents !== undefined) {
      if (input.changeForCents < totalCents) {
        throw new AppError('O valor para troco não pode ser menor que o total do pedido');
      }
    }

    const expiresAt = new Date(Date.now() + settings.pendingTtlMinutes * 60 * 1000).toISOString();
    const orderId = await repo.insertOrder(client, {
      fulfillment: input.fulfillment,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      address: input.address?.trim() || null,
      district: input.district?.trim() || null,
      notes: input.notes?.trim() || null,
      paymentMethodIntentId: input.paymentMethodIntentId,
      changeForCents: paymentMethod.allowsChange ? input.changeForCents ?? null : null,
      publicKey: input.publicKey,
      expiresAt,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
    });

    for (const r of resolved) {
      const itemId = await repo.insertOrderItem(
        client,
        orderId,
        r.product.id,
        r.product.name,
        r.quantity,
        r.unitPriceCents,
        r.totalCents
      );
      for (const addon of r.addons) {
        await repo.insertItemAddon(client, { orderItemId: itemId, ...addon });
      }
      for (const consumption of r.stockConsumption) {
        await repo.insertReservation(client, orderId, consumption.productId, consumption.qty, expiresAt);
      }
    }

    return loadDetail(client, orderId);
  });
}

export function getPublicStatus(tenantId: number, orderId: number): Promise<PublicOrderStatus> {
  return withTenantTransaction(tenantId, async (client) => {
    const order = await repo.findById(client, orderId);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    return {
      id: order.id,
      status: order.status,
      fulfillment: order.fulfillment,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
    };
  });
}

export function listOrders(tenantId: number, statuses?: string[]) {
  return withTenantTransaction(tenantId, async (client) => {
    const orders = await repo.listOrders(client, statuses);
    const details: OrderDetail[] = [];
    for (const order of orders) {
      details.push({ order, items: await repo.findItems(client, order.id) });
    }
    return details;
  });
}

export function countPending(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.countByStatus(client, 'pendente'));
}

/** Aceite atômico: muda status E baixa estoque na mesma transação. */
export function acceptOrder(tenantId: number, id: number, userId: number | null) {
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.transitionStatus(client, id, ['pendente'], 'aceito');
    if (!updated) {
      throw new AppError('Pedido já foi tratado por outro operador ou não está pendente', 409);
    }
    const items = await repo.findItems(client, id);
    for (const item of items) {
      const product = await productsRepo.findById(client, item.productId);
      // applyItemStock lança 409 se ficaria negativo → rollback do aceite
      await stockComposition.applyItemStock(client, {
        productId: item.productId,
        isCombo: product?.isCombo ?? false,
        quantity: item.quantity,
        sign: -1,
        addons: item.addons,
        movementType: 'pedido',
        reason: `Pedido online #${id}`,
        orderId: id,
        idempotencyPrefix: `order:${id}:${item.productId}`,
        userId,
      });
    }
    // Estoque já foi debitado de verdade acima — a reserva "soft" não é mais necessária.
    await repo.releaseReservations(client, id);
    return loadDetail(client, id);
  });
}

export function rejectOrder(tenantId: number, id: number, reason: string, userId: number | null) {
  if (!reason.trim()) throw new AppError('Informe o motivo da recusa');
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.transitionStatus(client, id, ['pendente'], 'recusado', {
      rejectReason: reason.trim(),
    });
    if (!updated) throw new AppError('Pedido não está mais pendente', 409);
    await repo.releaseReservations(client, id);
    await logAction(client, userId, 'pedido.recusa', 'order', id, { reason: reason.trim() });
    return loadDetail(client, id);
  });
}

export function markReady(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.transitionStatus(client, id, ['aceito'], 'pronto');
    if (!updated) throw new AppError('Pedido precisa estar aceito para ficar pronto', 409);
    return loadDetail(client, id);
  });
}

export function markOutForDelivery(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const order = await repo.findById(client, id);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    if (order.fulfillment !== 'entrega') {
      throw new AppError('Somente pedidos de entrega saem para entrega');
    }
    const updated = await repo.transitionStatus(client, id, ['aceito', 'pronto'], 'saiu_entrega');
    if (!updated) throw new AppError('Pedido precisa estar aceito ou pronto', 409);
    return loadDetail(client, id);
  });
}

/**
 * Expira pedidos pendentes vencidos (loja não respondeu no prazo). Pendente
 * nunca baixou estoque, então não há nada a estornar. Roda por tenant para
 * respeitar o RLS.
 */
export async function sweepExpiredOrders(
  listTenantIds: () => Promise<number[]>
): Promise<number> {
  const tenantIds = await listTenantIds();
  // Cada tenant abre sua própria transação/conexão — independentes entre si,
  // então rodar em paralelo é seguro e não serializa o tempo do job pelo
  // número de lojas cadastradas na plataforma.
  const counts = await Promise.all(
    tenantIds.map((tenantId) =>
      withTenantTransaction(tenantId, async (client) => {
        const { rows } = await client.query(
          `UPDATE orders SET status = 'expirado', concluded_at = now()
           WHERE status = 'pendente' AND expires_at IS NOT NULL AND expires_at < now()
           RETURNING id`
        );
        await repo.releaseReservationsForOrders(client, rows.map((r: { id: number }) => r.id));
        return rows.length;
      })
    )
  );
  return counts.reduce((sum, c) => sum + c, 0);
}

/**
 * Conclui o pedido (entregue/retirado): gera a venda no caixa informado SEM
 * nova baixa de estoque — a baixa aconteceu no aceite e o stock_movement
 * daquele momento já referencia o pedido.
 */
export function concludeOrder(
  tenantId: number,
  id: number,
  input: { cashSessionId?: number; paymentMethodId?: number; amountReceivedCents?: number },
  userId: number | null
) {
  return withTenantTransaction(tenantId, async (client) => {
    const order = await repo.findById(client, id);
    if (!order) throw new AppError('Pedido não encontrado', 404);
    if (!['aceito', 'pronto', 'saiu_entrega'].includes(order.status)) {
      throw new AppError('Pedido precisa estar aceito, pronto ou em entrega para ser concluído', 409);
    }

    const openSessions = await cashRepo.listOpenSessions(client);
    if (openSessions.length === 0) {
      throw new AppError('Abra um caixa antes de concluir pedidos', 409);
    }
    let cashSession;
    if (input.cashSessionId !== undefined) {
      cashSession = openSessions.find((s) => s.id === input.cashSessionId);
      if (!cashSession) throw new AppError('Caixa informado não está aberto', 409);
    } else if (openSessions.length === 1) {
      cashSession = openSessions[0];
    } else {
      throw new AppError('Há mais de um caixa aberto — informe em qual caixa registrar', 400);
    }

    const items = await repo.findItems(client, id);
    const paymentMethodId = input.paymentMethodId ?? order.paymentMethodIntentId;
    const method = await paymentMethodsRepo.findById(client, paymentMethodId);
    if (!method) throw new AppError('Meio de pagamento inválido', 400);
    const feeNote =
      order.deliveryFeeCents > 0 ? ` (inclui taxa de entrega de R$ ${(order.deliveryFeeCents / 100).toFixed(2)})` : '';

    // Vincula (ou cria) o cliente pelo telefone do pedido — o histórico de
    // compras do cliente passa a incluir pedidos online automaticamente.
    let customerId = order.customerId;
    if (customerId === null && order.customerPhone) {
      const existing = await customersRepo.findByPhone(client, order.customerPhone);
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await customersRepo.create(client, {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.address ?? undefined,
        });
        customerId = created.id;
      }
      await client.query('UPDATE orders SET customer_id = $1 WHERE id = $2', [customerId, id]);
    }

    const saleId = await salesRepo.insertSale(client, {
      saleType: 'varejo',
      subtotalCents: order.totalCents,
      discountCents: 0,
      surchargeCents: 0,
      totalCents: order.totalCents,
      cashSessionId: cashSession.id,
      userId,
      customerId,
      notes: `Pedido online #${id}${feeNote}`,
    });

    for (const item of items) {
      const product = await productsRepo.findById(client, item.productId);
      const saleItemId = await salesRepo.insertSaleItem(client, {
        saleId,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unitCostCents: product?.costPriceCents ?? 0,
        discountCents: 0,
        totalCents: item.totalCents,
      });
      for (const addon of item.addons) {
        await salesRepo.insertItemAddon(client, {
          saleItemId,
          addonOptionId: addon.addonOptionId,
          labelSnapshot: addon.labelSnapshot,
          extraPriceCentsSnapshot: addon.extraPriceCentsSnapshot,
          productIdSnapshot: addon.productIdSnapshot,
          quantity: addon.quantity,
        });
      }
      // Sem adjustStockQuantity aqui: baixa já ocorreu no aceite do pedido.
    }

    const amountReceivedCents = method.allowsChange
      ? input.amountReceivedCents ?? order.totalCents
      : null;
    const netAmountCents = Math.round(order.totalCents * (1 - method.retentionPercent / 100));
    await salesRepo.insertPayment(client, {
      saleId,
      paymentMethodId: method.id,
      amountCents: order.totalCents,
      amountReceivedCents,
      changeCents: amountReceivedCents !== null ? amountReceivedCents - order.totalCents : 0,
      netAmountCents,
    });
    if (method.kind === 'fiado') {
      await ledgerRepo.addEntry(client, {
        customerId: customerId!,
        type: 'fiado_venda',
        amountCents: -order.totalCents,
        saleId,
        dueDate: await salesService.computeFiadoDueDate(client),
        notes: `Pedido online #${id}`,
        userId,
      });
    }
    if (method.creditsAccount) {
      await ledgerRepo.addEntry(client, {
        customerId: customerId!,
        type: 'credito_adicionado',
        amountCents: order.totalCents,
        saleId,
        notes: `Pedido online #${id}`,
        userId,
      });
    }

    const updated = await repo.transitionStatus(
      client,
      id,
      ['aceito', 'pronto', 'saiu_entrega'],
      'concluido',
      { saleId }
    );
    if (!updated) throw new AppError('Pedido foi alterado por outro operador', 409);

    return loadDetail(client, id);
  });
}

/** Cancela pedido aceito/pronto, estornando o estoque baixado no aceite. */
export function cancelOrder(tenantId: number, id: number, reason: string, userId: number | null) {
  if (!reason.trim()) throw new AppError('Informe o motivo do cancelamento');
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.transitionStatus(
      client,
      id,
      ['aceito', 'pronto', 'saiu_entrega'],
      'cancelado',
      { rejectReason: reason.trim() }
    );
    if (!updated) throw new AppError('Somente pedidos aceitos/prontos/em entrega podem ser cancelados', 409);
    const items = await repo.findItems(client, id);
    for (const item of items) {
      const product = await productsRepo.findById(client, item.productId);
      await stockComposition.applyItemStock(client, {
        productId: item.productId,
        isCombo: product?.isCombo ?? false,
        quantity: item.quantity,
        sign: 1,
        addons: item.addons,
        movementType: 'cancelamento_pedido',
        reason: `Cancelamento do pedido online #${id}: ${reason.trim()}`,
        orderId: id,
        idempotencyPrefix: `order-cancel:${id}:${item.productId}`,
        userId,
      });
    }
    await logAction(client, userId, 'pedido.cancelamento', 'order', id, {
      reason: reason.trim(),
      totalCents: updated.totalCents,
    });
    return loadDetail(client, id);
  });
}
