import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './surchargeRules.service';

const createSchema = z.object({
  saleType: z.enum(['varejo', 'atacado']),
  paymentMethodId: z.number().int().positive(),
  percent: z.number().positive().max(100),
});

const updateSchema = z.object({
  percent: z.number().positive().max(100).optional(),
  active: z.boolean().optional(),
});

export const surchargeRulesRouter = Router();

surchargeRulesRouter.get('/', async (req, res) => {
  res.json(await service.listAll(req.auth!.tenantId!));
});

surchargeRulesRouter.post('/', requireRole('ADMIN_LOJA'), validateBody(createSchema), async (req, res) => {
  res.status(201).json(await service.create(req.auth!.tenantId!, req.body));
});

surchargeRulesRouter.put('/:id', requireRole('ADMIN_LOJA'), validateBody(updateSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.update(req.auth!.tenantId!, id, req.body));
});

surchargeRulesRouter.delete('/:id', requireRole('ADMIN_LOJA'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  await service.remove(req.auth!.tenantId!, id);
  res.status(204).end();
});
