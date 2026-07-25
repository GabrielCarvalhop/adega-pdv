import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './cash.service';

const openSchema = z.object({
  openingAmountCents: z.number().int().min(0),
  registerLabel: z.string().min(1).max(40),
});

const movementSchema = z.object({
  type: z.enum(['sangria', 'suprimento']),
  amountCents: z.number().int().positive(),
  reason: z.string().min(1),
});

const closeSchema = z.object({
  countedAmountCents: z.number().int().min(0),
  notes: z.string().optional(),
});

export const cashRouter = Router();

cashRouter.get('/open-sessions', async (req, res) => {
  res.json(await service.getOpenSessions(req.auth!.tenantId!));
});

cashRouter.get('/history', async (req, res) => {
  const { from, to } = req.query;
  res.json(
    await service.getHistory(
      req.auth!.tenantId!,
      typeof from === 'string' ? from : undefined,
      typeof to === 'string' ? to : undefined
    )
  );
});

cashRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getSession(req.auth!.tenantId!, id));
});

cashRouter.get('/:id/expected', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json({ expectedAmountCents: await service.getExpected(req.auth!.tenantId!, id) });
});

cashRouter.get('/:id/movements', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getMovements(req.auth!.tenantId!, id));
});

cashRouter.get('/:id/summary', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getSummary(req.auth!.tenantId!, id));
});

cashRouter.post('/open', validateBody(openSchema), async (req, res) => {
  res.status(201).json(await service.open(req.auth!.tenantId!, req.body, req.auth!.userId));
});

cashRouter.post('/:id/movements', validateBody(movementSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res
    .status(201)
    .json(
      await service.addMovement(req.auth!.tenantId!, id, req.body, {
        userId: req.auth!.userId,
        role: req.auth!.role,
      })
    );
});

cashRouter.post('/:id/close', validateBody(closeSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(
    await service.close(req.auth!.tenantId!, id, req.body, {
      userId: req.auth!.userId,
      role: req.auth!.role,
    })
  );
});

const reopenSchema = z.object({ reason: z.string().min(1) });

cashRouter.post('/:id/reopen', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(reopenSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.reopen(req.auth!.tenantId!, id, req.body.reason, req.auth!.userId));
});
