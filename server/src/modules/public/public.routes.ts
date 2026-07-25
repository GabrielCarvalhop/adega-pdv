import type { CatalogProduct } from '@adega/shared';
import { Router } from 'express';
import { z } from 'zod';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as addonsRepo from '../addons/addons.repository';
import * as deliveryZonesService from '../deliveryZones/deliveryZones.service';
import * as ordersService from '../orders/orders.service';
import * as paymentMethodsRepo from '../paymentMethods/paymentMethods.repository';
import * as discountsRepo from '../products/quantityDiscounts.repository';
import * as settingsService from '../settings/settings.service';

const createOrderSchema = z.object({
  fulfillment: z.enum(['entrega', 'retirada']),
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(8).max(20),
  address: z.string().max(300).optional(),
  district: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  paymentMethodIntentId: z.number().int().positive(),
  changeForCents: z.number().int().min(0).optional(),
  publicKey: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
        addons: z.array(z.object({ addonOptionId: z.number().int().positive() })).optional(),
      })
    )
    .min(1)
    .max(50),
});

const deliveryCheckSchema = z.object({
  district: z.string().max(80).optional(),
  subtotalCents: z.number().int().min(0).optional(),
});

// Rotas públicas do cardápio (sem autenticação; tenant vem do slug na URL,
// resolvido pelo middleware resolveTenantBySlug na montagem).
// NUNCA expor custo, quantidade de estoque ou dados internos aqui.
export const publicRouter = Router({ mergeParams: true });

publicRouter.get('/store', async (req, res) => {
  const settings = await settingsService.getSettings(req.tenantId!);
  if (!settings.catalogEnabled) throw new AppError('Cardápio indisponível', 404);
  const paymentMethods = await withTenantTransaction(req.tenantId!, (client) =>
    paymentMethodsRepo.listActive(client)
  );
  res.json({ storeName: req.tenant!.storeName, settings, paymentMethods });
});

publicRouter.get('/catalog', async (req, res) => {
  const result = await withTenantTransaction(req.tenantId!, async (client) => {
    const settings = await settingsService.loadSettings(client);
    if (!settings.catalogEnabled) return null;
    const { rows } = await client.query(
      `SELECT id, name, category, brand, volume_ml, sale_price_cents, compare_at_price_cents,
              (stock_quantity > 0) AS available, image_url, catalog_subtitle
       FROM products
       WHERE active = TRUE AND visible_in_catalog = TRUE
       ORDER BY sort_order ASC, category ASC, name ASC`
    );
    const productIds = rows.map((r) => r.id);
    const tiersByProduct = await discountsRepo.listActiveByProducts(client, productIds);
    const addonGroupsByProduct = await addonsRepo.listActiveGroupsForProducts(client, productIds);
    return rows.map(
      (r): CatalogProduct => ({
        id: r.id,
        name: r.name,
        category: r.category,
        brand: r.brand,
        volumeMl: r.volume_ml,
        salePriceCents: r.sale_price_cents,
        compareAtPriceCents: r.compare_at_price_cents,
        available: r.available,
        imageUrl: r.image_url,
        catalogSubtitle: r.catalog_subtitle,
        quantityDiscounts: (tiersByProduct.get(r.id) ?? []).map((t) => ({
          minQuantity: t.minQuantity,
          discountType: t.discountType,
          discountValue: t.discountValue,
        })),
        addonGroups: addonGroupsByProduct.get(r.id) ?? [],
      })
    );
  });
  if (result === null) throw new AppError('Cardápio indisponível', 404);
  res.json(result);
});

publicRouter.post('/delivery-check', validateBody(deliveryCheckSchema), async (req, res) => {
  const result = await withTenantTransaction(req.tenantId!, async (client) => {
    const settings = await settingsService.loadSettings(client);
    return deliveryZonesService.checkDelivery(
      client,
      req.body.district,
      settings.deliveryFeeCents,
      req.body.subtotalCents
    );
  });
  res.json(result);
});

publicRouter.post('/orders', validateBody(createOrderSchema), async (req, res) => {
  const detail = await ordersService.createPublicOrder(req.tenantId!, req.body);
  res.status(201).json({ id: detail.order.id, totalCents: detail.order.totalCents });
});

publicRouter.get('/orders/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('Pedido não encontrado', 404);
  res.json(await ordersService.getPublicStatus(req.tenantId!, id));
});
