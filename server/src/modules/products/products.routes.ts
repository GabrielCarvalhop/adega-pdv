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
});

export const productsRouter = Router();

productsRouter.get('/low-stock', async (req, res) => {
  res.json(await service.getLowStock(req.auth!.tenantId));
});

productsRouter.get('/barcode/:code', async (req, res) => {
  res.json(await service.getByBarcode(req.auth!.tenantId, req.params.code));
});

productsRouter.get('/', async (req, res) => {
  const { search, category, active } = req.query;
  res.json(
    await service.listProducts(req.auth!.tenantId, {
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      active: active === undefined ? undefined : active === 'true',
    })
  );
});

productsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getProduct(req.auth!.tenantId, id));
});

productsRouter.post('/', requireRole('gerente', 'admin'), validateBody(createProductSchema), async (req, res) => {
  res.status(201).json(await service.createProduct(req.auth!.tenantId, req.body));
});

productsRouter.put('/:id', requireRole('gerente', 'admin'), validateBody(updateProductSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.updateProduct(req.auth!.tenantId, id, req.body));
});

productsRouter.delete('/:id', requireRole('gerente', 'admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  await service.deleteProduct(req.auth!.tenantId, id);
  res.status(204).end();
});
