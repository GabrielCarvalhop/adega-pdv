import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import * as service from './addons.service';

const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  selectionType: z.enum(['single', 'multiple']),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(1),
});

const updateGroupSchema = createGroupSchema.partial().extend({
  active: z.boolean().optional(),
});

const createOptionSchema = z.object({
  label: z.string().min(1),
  productId: z.number().int().positive().optional(),
  extraPriceCents: z.number().int().min(0).optional(),
  quantityPerSelection: z.number().int().positive().optional(),
});

const updateOptionSchema = createOptionSchema.partial().extend({
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const addonsRouter = Router();

addonsRouter.get('/', async (req, res) => {
  res.json(await service.listGroups(req.auth!.tenantId!));
});

addonsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.getGroup(req.auth!.tenantId!, id));
});

addonsRouter.post('/', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(createGroupSchema), async (req, res) => {
  res.status(201).json(await service.createGroup(req.auth!.tenantId!, req.body));
});

addonsRouter.put('/:id', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(updateGroupSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.updateGroup(req.auth!.tenantId!, id, req.body));
});

addonsRouter.get('/:id/options', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.listOptions(req.auth!.tenantId!, id));
});

addonsRouter.post(
  '/:id/options',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(createOptionSchema),
  async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError('ID inválido');
    res.status(201).json(await service.createOption(req.auth!.tenantId!, id, req.body));
  }
);

addonsRouter.put(
  '/options/:optionId',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(updateOptionSchema),
  async (req, res) => {
    const optionId = Number(req.params.optionId);
    if (Number.isNaN(optionId)) throw new AppError('ID inválido');
    res.json(await service.updateOption(req.auth!.tenantId!, optionId, req.body));
  }
);

addonsRouter.delete('/options/:optionId', requireRole('GERENTE', 'ADMIN_LOJA'), async (req, res) => {
  const optionId = Number(req.params.optionId);
  if (Number.isNaN(optionId)) throw new AppError('ID inválido');
  await service.deleteOption(req.auth!.tenantId!, optionId);
  res.status(204).end();
});
