import { Router } from 'express';
import { z } from 'zod';
import { withTenantTransaction } from '../../db/connection';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as repo from './payables.repository';

const createSchema = z.object({
  description: z.string().min(1),
  category: z.string().optional(),
  amountCents: z.number().int().positive(),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

const setPaidSchema = z.object({
  paid: z.boolean(),
});

export const payablesRouter = Router();

payablesRouter.use(requireRole('GERENTE', 'ADMIN_LOJA'));

payablesRouter.get('/', async (req, res) => {
  const { paid, from, to } = req.query;
  const payables = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.findAll(client, {
      paid: paid === undefined ? undefined : paid === 'true',
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    })
  );
  res.json(payables);
});

payablesRouter.post('/', validateBody(createSchema), async (req, res) => {
  const payable = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.create(client, req.body)
  );
  res.status(201).json(payable);
});

payablesRouter.put('/:id', validateBody(updateSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  const updated = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.update(client, id, req.body)
  );
  if (!updated) throw new AppError('Conta não encontrada', 404);
  res.json(updated);
});

payablesRouter.post('/:id/pay', validateBody(setPaidSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  const updated = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.setPaid(client, id, req.body.paid)
  );
  if (!updated) throw new AppError('Conta não encontrada', 404);
  res.json(updated);
});

payablesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  await withTenantTransaction(req.auth!.tenantId!, (client) => repo.remove(client, id));
  res.status(204).end();
});
