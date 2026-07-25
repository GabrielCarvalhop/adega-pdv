import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './paymentMethods.service';

const kindSchema = z.enum(['dinheiro', 'pix', 'cartao', 'outro', 'fiado', 'link_pagamento']);

const createSchema = z.object({
  code: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  kind: kindSchema,
  icon: z.string().max(8).optional(),
  allowsChange: z.boolean().optional(),
  creditsAccount: z.boolean().optional(),
  retentionPercent: z.number().min(0).max(100).optional(),
  settlementDays: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  kind: kindSchema.optional(),
  active: z.boolean().optional(),
  icon: z.string().max(8).optional(),
  allowsChange: z.boolean().optional(),
  creditsAccount: z.boolean().optional(),
  retentionPercent: z.number().min(0).max(100).optional(),
  settlementDays: z.number().int().min(0).optional(),
});

export const paymentMethodsRouter = Router();

paymentMethodsRouter.get('/', async (req, res) => {
  res.json(await service.listAll(req.auth!.tenantId!));
});

paymentMethodsRouter.post('/', requireRole('ADMIN_LOJA'), validateBody(createSchema), async (req, res) => {
  res.status(201).json(await service.create(req.auth!.tenantId!, req.body));
});

paymentMethodsRouter.put('/:id', requireRole('ADMIN_LOJA'), validateBody(updateSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.update(req.auth!.tenantId!, id, req.body));
});
