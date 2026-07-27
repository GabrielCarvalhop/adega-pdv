import { Router } from 'express';
import { z } from 'zod';
import { withSystemTransaction, withTenantTransaction } from '../../db/connection';
import { requireAuth, requireRole, requireTenant } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { rateLimit } from '../../middlewares/rateLimit';
import { perfMark } from '../../middlewares/serverTiming';
import { validateBody } from '../../middlewares/validate';
import * as service from './users.service';

const loginSchema = z.object({
  userId: z.number().int().positive(),
  pin: z.string().min(4),
});

const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/),
});

// SUPER_ADMIN nunca é criado por aqui — é papel único, atribuído por migration.
const TENANT_ROLES = ['ADMIN_LOJA', 'GERENTE', 'FUNCIONARIO'] as const;

const createUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(TENANT_ROLES),
  pin: z.string().regex(/^\d{4,8}$/),
  maxDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  canSellWithoutStock: z.boolean().optional(),
  /** Força a troca do PIN no primeiro login — padrão true para novos usuários. */
  mustChangePin: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(TENANT_ROLES).optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  active: z.boolean().optional(),
  maxDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  canSellWithoutStock: z.boolean().optional(),
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

// Login do dono da plataforma — sem loja, por e-mail/senha. Rate-limited como
// o login por PIN, mesma proteção contra força bruta.
sessionRouter.post(
  '/super-admin-login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'super-admin-login' }),
  validateBody(superAdminLoginSchema),
  async (req, res) => {
    res.json(await service.superAdminLogin(req.body.email, req.body.password));
  }
);

sessionRouter.get('/me', requireAuth, async (req, res) => {
  const { userId, name, role, tenantId } = req.auth!;
  // Uma única transação com uma única query: antes eram DUAS transações
  // paralelas (7 comandos SQL no total, 2 conexões do pool) — em produção o
  // banco fica em outra região e cada comando paga ~100ms só de rede, então
  // /me chegava a ~2s. Subselects independentes preservam o comportamento:
  // cada campo vem NULL se a linha não existir, sem derrubar o outro.
  const t0 = performance.now();
  const row =
    tenantId === null
      ? await withSystemTransaction(async (client) => {
          const { rows } = await client.query(
            'SELECT (SELECT must_change_pin FROM users WHERE id = $1) AS must_change_pin, NULL AS store_name',
            [userId]
          );
          return rows[0];
        })
      : await withTenantTransaction(tenantId, async (client) => {
          const { rows } = await client.query(
            `SELECT (SELECT must_change_pin FROM users WHERE id = $1) AS must_change_pin,
                    (SELECT store_name FROM tenants WHERE id = $2) AS store_name`,
            [userId, tenantId]
          );
          return rows[0];
        });
  perfMark('me_db', performance.now() - t0);
  res.json({
    id: userId,
    name,
    role,
    tenantId,
    storeName: (row?.store_name as string | null) ?? null,
    mustChangePin: (row?.must_change_pin as boolean | null) ?? false,
  });
});

// Logout com JWT é client-side (descartar o token); endpoint mantido por
// compatibilidade com o frontend.
sessionRouter.post('/logout', requireAuth, (_req, res) => {
  res.status(204).end();
});

// Troca do próprio PIN — usada tanto voluntariamente quanto pelo fluxo
// obrigatório de primeiro acesso (must_change_pin).
sessionRouter.post('/change-pin', requireAuth, validateBody(changePinSchema), async (req, res) => {
  await service.changeOwnPin(req.auth!.userId, req.auth!.tenantId, req.body.pin);
  res.status(204).end();
});

// Gestão de usuários — somente admin do tenant (SUPER_ADMIN passa por requireRole,
// mas precisa ter "entrado" numa loja primeiro — ver requireTenant).
export const usersRouter = Router();

usersRouter.use(requireAuth, requireTenant, requireRole('ADMIN_LOJA'));

usersRouter.get('/', async (req, res) => {
  res.json(await service.listAllUsers(req.auth!.tenantId!));
});

usersRouter.post('/', validateBody(createUserSchema), async (req, res) => {
  res.status(201).json(await service.createUser(req.auth!.tenantId!, req.body, req.auth!.userId));
});

usersRouter.put('/:id', validateBody(updateUserSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  res.json(await service.updateUser(req.auth!.tenantId!, id, req.body, req.auth!.userId));
});
