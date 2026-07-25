import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import * as service from './products.service';

const categoryEnum = z.enum(['vinho', 'cerveja', 'destilado', 'espumante', 'licor', 'outro']);

const createProductSchema = z.object({
  name: z.string().min(1),
  category: categoryEnum,
  brand: z.string().optional(),
  volumeMl: z.number().int().positive().optional(),
  barcode: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  costPriceCents: z.number().int().min(0),
  salePriceCents: z.number().int().min(0),
  stockQuantity: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
  visibleInCatalog: z.boolean().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  catalogSubtitle: z.string().max(120).nullable().optional(),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  isCombo: z.boolean().optional(),
});

const linkAddonGroupSchema = z.object({
  addonGroupId: z.number().int().positive(),
});

const replaceComboItemsSchema = z.object({
  items: z
    .array(
      z.object({
        componentProductId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .default([]),
});

const createQuantityDiscountSchema = z.object({
  minQuantity: z.number().int().min(2),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().int().positive(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const updateQuantityDiscountSchema = createQuantityDiscountSchema.partial().extend({
  active: z.boolean().optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const productsRouter = Router();

productsRouter.put('/reorder', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(reorderSchema), async (req, res) => {
  await service.reorderProducts(req.auth!.tenantId!, req.body.ids);
  res.status(204).end();
});

productsRouter.get('/low-stock', async (req, res) => {
  res.json(await service.getLowStock(req.auth!.tenantId!));
});

productsRouter.get('/barcode/:code', async (req, res) => {
  res.json(await service.getByBarcode(req.auth!.tenantId!, req.params.code));
});

productsRouter.get('/', async (req, res) => {
  const { search, category, active } = req.query;
  res.json(
    await service.listProducts(req.auth!.tenantId!, {
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      active: active === undefined ? undefined : active === 'true',
    })
  );
});

productsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getProduct(req.auth!.tenantId!, id));
});

productsRouter.post('/', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(createProductSchema), async (req, res) => {
  res.status(201).json(await service.createProduct(req.auth!.tenantId!, req.body));
});

productsRouter.put('/:id', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(updateProductSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.updateProduct(req.auth!.tenantId!, id, req.body));
});

productsRouter.delete('/:id', requireRole('GERENTE', 'ADMIN_LOJA'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  await service.deleteProduct(req.auth!.tenantId!, id);
  res.status(204).end();
});

productsRouter.get('/:id/quantity-discounts', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.listQuantityDiscounts(req.auth!.tenantId!, id));
});

productsRouter.post(
  '/:id/quantity-discounts',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(createQuantityDiscountSchema),
  async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError('ID inválido');
    res.status(201).json(await service.createQuantityDiscount(req.auth!.tenantId!, id, req.body));
  }
);

productsRouter.put(
  '/quantity-discounts/:tierId',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(updateQuantityDiscountSchema),
  async (req, res) => {
    const tierId = Number(req.params.tierId);
    if (Number.isNaN(tierId)) throw new AppError('ID inválido');
    res.json(await service.updateQuantityDiscount(req.auth!.tenantId!, tierId, req.body));
  }
);

productsRouter.delete(
  '/quantity-discounts/:tierId',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  async (req, res) => {
    const tierId = Number(req.params.tierId);
    if (Number.isNaN(tierId)) throw new AppError('ID inválido');
    await service.deleteQuantityDiscount(req.auth!.tenantId!, tierId);
    res.status(204).end();
  }
);

productsRouter.get('/:id/available-addons', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.listAvailableAddons(req.auth!.tenantId!, id));
});

productsRouter.get('/:id/addon-groups', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.listAddonGroupLinks(req.auth!.tenantId!, id));
});

productsRouter.post(
  '/:id/addon-groups',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(linkAddonGroupSchema),
  async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError('ID inválido');
    res.status(201).json(await service.linkAddonGroup(req.auth!.tenantId!, id, req.body.addonGroupId));
  }
);

productsRouter.delete(
  '/:id/addon-groups/:addonGroupId',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  async (req, res) => {
    const id = Number(req.params.id);
    const addonGroupId = Number(req.params.addonGroupId);
    if (Number.isNaN(id) || Number.isNaN(addonGroupId)) throw new AppError('ID inválido');
    await service.unlinkAddonGroup(req.auth!.tenantId!, id, addonGroupId);
    res.status(204).end();
  }
);

productsRouter.get('/:id/combo-items', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.listComboItems(req.auth!.tenantId!, id));
});

productsRouter.put(
  '/:id/combo-items',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(replaceComboItemsSchema),
  async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError('ID inválido');
    res.json(await service.replaceComboItems(req.auth!.tenantId!, id, req.body.items));
  }
);
