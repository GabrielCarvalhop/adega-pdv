import cors from 'cors';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './db/migrate';
import { requireAuth } from './middlewares/auth';
import { billingGate, startTrialSweepJob } from './middlewares/billingGate';
import { errorHandler } from './middlewares/errorHandler';
import { rateLimit } from './middlewares/rateLimit';
import { resolveTenantBySlug } from './middlewares/tenant';
import { accountRouter } from './modules/account/account.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { publicRouter } from './modules/public/public.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { cashRouter } from './modules/cash/cash.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { payablesRouter } from './modules/payables/payables.routes';
import { productsRouter } from './modules/products/products.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { stockRouter } from './modules/stock/stock.routes';
import { sessionRouter, tenantAuthRouter, usersRouter } from './modules/users/users.routes';
import { sweepExpiredOrders } from './modules/orders/orders.service';
import { uploadsRoot, uploadsRouter } from './modules/uploads/uploads.routes';
import { withSystemTransaction } from './db/connection';

function startOrderExpiryJob() {
  const listTenantIds = () =>
    withSystemTransaction(async (client) => {
      const { rows } = await client.query("SELECT id FROM tenants WHERE status <> 'canceled'");
      return rows.map((r: { id: number }) => r.id);
    });
  const run = async () => {
    try {
      const count = await sweepExpiredOrders(listTenantIds);
      if (count > 0) console.log(`Pedidos pendentes expirados: ${count}`);
    } catch (err) {
      console.error('Erro ao expirar pedidos pendentes:', err);
    }
  };
  void run();
  setInterval(run, 5 * 60 * 1000);
}

async function main() {
  await runMigrations();

  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;

  app.use(cors());
  // Base64 de fotos do cardápio (até ~500 KB) precisa de limite maior que o default.
  app.use(express.json({ limit: '800kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Conta do dono da loja (signup público, login, perfil).
  app.use('/api/account', accountRouter);

  // Rotas públicas por loja (pré-login): lista de operadores + login por PIN.
  // Rate limit no login: PIN de 4 dígitos exige proteção contra força bruta.
  app.use(
    '/api/t/:slug/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'pin-auth' }),
    resolveTenantBySlug,
    tenantAuthRouter
  );

  // Cardápio público (cliente final, sem login).
  app.use(
    '/api/public/:slug',
    rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'public' }),
    resolveTenantBySlug,
    publicRouter
  );

  // Sessão do operador logado (me/logout).
  app.use('/api/auth', sessionRouter);

  // Módulos de negócio — exigem JWT de operador; tenant vem do token.
  // billingGate: assinatura vencida bloqueia escrita (leitura sempre passa).
  app.use('/api/users', usersRouter);
  app.use('/api/products', requireAuth, billingGate, productsRouter);
  app.use('/api/stock', requireAuth, billingGate, stockRouter);
  app.use('/api/cash', requireAuth, billingGate, cashRouter);
  app.use('/api/sales', requireAuth, billingGate, salesRouter);
  app.use('/api/reports', requireAuth, billingGate, reportsRouter);
  app.use('/api/customers', requireAuth, billingGate, customersRouter);
  app.use('/api/payables', requireAuth, billingGate, payablesRouter);
  app.use('/api/settings', requireAuth, billingGate, settingsRouter);
  app.use('/api/orders', requireAuth, billingGate, ordersRouter);
  app.use('/api/audit', requireAuth, auditRouter);
  app.use('/api/uploads', requireAuth, billingGate, uploadsRouter);

  fs.mkdirSync(uploadsRoot, { recursive: true });
  app.use('/uploads', express.static(uploadsRoot, { maxAge: '7d', fallthrough: false }));

  const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    // Express 5: '*' não é mais aceito; usa regex para o fallback da SPA.
    // Não captura /api nem /uploads (estáticos já montados acima).
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  startTrialSweepJob();
  startOrderExpiryJob();

  app.listen(PORT, () => {
    console.log(`Adega PDV rodando em http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
