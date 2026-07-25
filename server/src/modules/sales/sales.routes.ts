import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './sales.service';

const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).optional(),
  notes: z.string().max(300).optional(),
  addons: z.array(z.object({ addonOptionId: z.number().int().positive() })).optional(),
});

const paymentSchema = z.object({
  paymentMethodId: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  amountReceivedCents: z.number().int().min(0).optional(),
});

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  payments: z.array(paymentSchema).min(1),
  discountCents: z.number().int().min(0).optional(),
  customerId: z.number().int().positive().optional(),
  cashSessionId: z.number().int().positive().optional(),
  notes: z.string().optional(),
  saleType: z.enum(['varejo', 'atacado']).optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(1),
});

export const salesRouter = Router();

salesRouter.get('/', async (req, res) => {
  const { from, to, status } = req.query;
  res.json(
    await service.listSales(req.auth!.tenantId!, {
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      status: typeof status === 'string' ? status : undefined,
    })
  );
});

salesRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getSaleDetail(req.auth!.tenantId!, id));
});

salesRouter.post('/', validateBody(createSaleSchema), async (req, res) => {
  res.status(201).json(await service.completeSale(req.auth!.tenantId!, req.body, req.auth!.userId));
});

salesRouter.post('/:id/cancel', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(cancelSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.cancelSale(req.auth!.tenantId!, id, req.body.reason, req.auth!.userId));
});

salesRouter.post('/:id/items/:itemId/cancel', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(cancelSchema), async (req, res) => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (Number.isNaN(id) || Number.isNaN(itemId)) throw new AppError('ID inválido');
  res.json(
    await service.cancelSaleItem(req.auth!.tenantId!, id, itemId, req.body.reason, req.auth!.userId)
  );
});
