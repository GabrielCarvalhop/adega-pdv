import type { CatalogProduct } from '@adega/shared';
import { Router } from 'express';
import { z } from 'zod';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as ordersService from '../orders/orders.service';
import * as settingsService from '../settings/settings.service';

const createOrderSchema = z.object({
  fulfillment: z.enum(['entrega', 'retirada']),
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(8).max(20),
  address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  paymentMethodIntent: z.enum(['dinheiro', 'debito', 'credito', 'pix']),
  changeForCents: z.number().int().min(0).optional(),
  publicKey: z.string().uuid(),
  items: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
});

// Rotas públicas do cardápio (sem autenticação; tenant vem do slug na URL,
// resolvido pelo middleware resolveTenantBySlug na montagem).
// NUNCA expor custo, quantidade de estoque ou dados internos aqui.
export const publicRouter = Router({ mergeParams: true });

publicRouter.get('/store', async (req, res) => {
  const settings = await settingsService.getSettings(req.tenantId!);
  if (!settings.catalogEnabled) throw new AppError('Cardápio indisponível', 404);
  res.json({ storeName: req.tenant!.storeName, settings });
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
       ORDER BY category ASC, name ASC`
    );
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
      })
    );
  });
  if (result === null) throw new AppError('Cardápio indisponível', 404);
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
