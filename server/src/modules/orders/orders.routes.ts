import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './orders.service';

const reasonSchema = z.object({ reason: z.string().min(1) });

const concludeSchema = z.object({
  cashSessionId: z.number().int().positive().optional(),
  paymentMethod: z.enum(['dinheiro', 'debito', 'credito', 'pix']).optional(),
  amountReceivedCents: z.number().int().min(0).optional(),
});

export const ordersRouter = Router();

ordersRouter.get('/', async (req, res) => {
  const { status } = req.query;
  const statuses = typeof status === 'string' ? status.split(',').filter(Boolean) : undefined;
  res.json(await service.listOrders(req.auth!.tenantId, statuses));
});

ordersRouter.get('/pending-count', async (req, res) => {
  res.json({ count: await service.countPending(req.auth!.tenantId) });
});

function parseId(raw: string | string[]): number {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  return id;
}

ordersRouter.post('/:id/accept', async (req, res) => {
  res.json(await service.acceptOrder(req.auth!.tenantId, parseId(req.params.id), req.auth!.userId));
});

ordersRouter.post('/:id/reject', validateBody(reasonSchema), async (req, res) => {
  res.json(
    await service.rejectOrder(req.auth!.tenantId, parseId(req.params.id), req.body.reason, req.auth!.userId)
  );
});

ordersRouter.post('/:id/ready', async (req, res) => {
  res.json(await service.markReady(req.auth!.tenantId, parseId(req.params.id)));
});

ordersRouter.post('/:id/out-for-delivery', async (req, res) => {
  res.json(await service.markOutForDelivery(req.auth!.tenantId, parseId(req.params.id)));
});

ordersRouter.post('/:id/conclude', validateBody(concludeSchema), async (req, res) => {
  res.json(
    await service.concludeOrder(req.auth!.tenantId, parseId(req.params.id), req.body, req.auth!.userId)
  );
});

ordersRouter.post('/:id/cancel', validateBody(reasonSchema), async (req, res) => {
  res.json(
    await service.cancelOrder(req.auth!.tenantId, parseId(req.params.id), req.body.reason, req.auth!.userId)
  );
});
