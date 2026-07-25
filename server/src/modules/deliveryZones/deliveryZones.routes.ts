import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './deliveryZones.service';

const createSchema = z.object({
  type: z.enum(['bairro', 'cep_prefix']),
  value: z.string().min(1).max(80),
  blocked: z.boolean(),
  feeCents: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  blocked: z.boolean().optional(),
  feeCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

export const deliveryZonesRouter = Router();

deliveryZonesRouter.get('/', async (req, res) => {
  res.json(await service.listAll(req.auth!.tenantId!));
});

deliveryZonesRouter.post('/', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(createSchema), async (req, res) => {
  res.status(201).json(await service.create(req.auth!.tenantId!, req.body));
});

deliveryZonesRouter.put('/:id', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(updateSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.update(req.auth!.tenantId!, id, req.body));
});

deliveryZonesRouter.delete('/:id', requireRole('GERENTE', 'ADMIN_LOJA'), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  await service.remove(req.auth!.tenantId!, id);
  res.status(204).end();
});
