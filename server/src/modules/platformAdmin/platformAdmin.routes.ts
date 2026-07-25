import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './platformAdmin.service';

const createTenantSchema = z.object({
  storeName: z.string().min(1),
  ownerName: z.string().min(1),
  slug: z.string().min(2).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['trialing', 'active', 'past_due', 'canceled']),
});

// Todas as rotas aqui exigem SUPER_ADMIN — nenhum outro papel acessa a
// plataforma inteira, só a própria loja.
export const platformAdminRouter = Router();

platformAdminRouter.use(requireRole('SUPER_ADMIN'));

platformAdminRouter.get('/lojas', async (_req, res) => {
  res.json(await service.listTenants());
});

platformAdminRouter.post('/lojas', validateBody(createTenantSchema), async (req, res) => {
  res.status(201).json(await service.createTenant(req.body));
});

platformAdminRouter.put('/lojas/:id/status', validateBody(updateStatusSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  await service.updateTenantStatus(id, req.body.status);
  res.status(204).end();
});

platformAdminRouter.post('/lojas/:id/entrar', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.enterTenant({ userId: req.auth!.userId, name: req.auth!.name }, id));
});
