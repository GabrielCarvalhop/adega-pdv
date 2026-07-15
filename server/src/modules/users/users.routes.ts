import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './users.service';

const loginSchema = z.object({
  userId: z.number().int().positive(),
  pin: z.string().min(4),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['admin', 'gerente', 'operador']),
  pin: z.string().regex(/^\d{4,8}$/),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'gerente', 'operador']).optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  active: z.boolean().optional(),
});

// Rotas públicas por loja (montadas em /api/t/:slug/auth, após resolveTenantBySlug).
export const tenantAuthRouter = Router({ mergeParams: true });

tenantAuthRouter.get('/users', async (req, res) => {
  const users = await service.listActiveUsers(req.tenantId!);
  res.json(users.map((u) => ({ id: u.id, name: u.name, role: u.role })));
});

tenantAuthRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  res.json(await service.login(req.tenantId!, req.body.userId, req.body.pin));
});

// Rotas autenticadas de sessão (montadas em /api/auth).
export const sessionRouter = Router();

sessionRouter.get('/me', requireAuth, (req, res) => {
  const { userId, name, role, tenantId } = req.auth!;
  res.json({ id: userId, name, role, tenantId });
});

// Logout com JWT é client-side (descartar o token); endpoint mantido por
// compatibilidade com o frontend.
sessionRouter.post('/logout', requireAuth, (_req, res) => {
  res.status(204).end();
});

// Gestão de usuários — somente admin do tenant.
export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole('admin'));

usersRouter.get('/', async (req, res) => {
  res.json(await service.listAllUsers(req.auth!.tenantId));
});

usersRouter.post('/', validateBody(createUserSchema), async (req, res) => {
  res.status(201).json(await service.createUser(req.auth!.tenantId, req.body, req.auth!.userId));
});

usersRouter.put('/:id', validateBody(updateUserSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.updateUser(req.auth!.tenantId, id, req.body, req.auth!.userId));
});
