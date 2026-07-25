import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './db/migrate';
import { requireAuth, requireTenant } from './middlewares/auth';
import { billingGate, startTrialSweepJob } from './middlewares/billingGate';
import { errorHandler } from './middlewares/errorHandler';
import { rateLimit } from './middlewares/rateLimit';
import { resolveTenantBySlug } from './middlewares/tenant';
import { accountRouter } from './modules/account/account.routes';
import { addonsRouter } from './modules/addons/addons.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { deliveryZonesRouter } from './modules/deliveryZones/deliveryZones.routes';
import { platformAdminRouter } from './modules/platformAdmin/platformAdmin.routes';
import { publicRouter } from './modules/public/public.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { cashRouter } from './modules/cash/cash.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { payablesRouter } from './modules/payables/payables.routes';
import { paymentMethodsRouter } from './modules/paymentMethods/paymentMethods.routes';
import { productsRouter } from './modules/products/products.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { stockRouter } from './modules/stock/stock.routes';
import { surchargeRulesRouter } from './modules/surchargeRules/surchargeRules.routes';
import { sessionRouter, tenantAuthRouter, usersRouter } from './modules/users/users.routes';
import { sweepExpiredOrders } from './modules/orders/orders.service';
import { uploadsRouter } from './modules/uploads/uploads.routes';
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

  // Painel do SUPER_ADMIN: lojas de toda a plataforma, sem tenant no token.
  app.use('/api/admin', requireAuth, platformAdminRouter);

  // Módulos de negócio — exigem JWT de operador DENTRO de uma loja (tenant
  // vem do token; requireTenant recusa um SUPER_ADMIN que não "entrou" em
  // nenhuma loja ainda). billingGate: assinatura vencida bloqueia escrita.
  app.use('/api/users', usersRouter);
  app.use('/api/products', requireAuth, requireTenant, billingGate, productsRouter);
  app.use('/api/addon-groups', requireAuth, requireTenant, billingGate, addonsRouter);
  app.use('/api/stock', requireAuth, requireTenant, billingGate, stockRouter);
  app.use('/api/cash', requireAuth, requireTenant, billingGate, cashRouter);
  app.use('/api/sales', requireAuth, requireTenant, billingGate, salesRouter);
  app.use('/api/reports', requireAuth, requireTenant, billingGate, reportsRouter);
  app.use('/api/customers', requireAuth, requireTenant, billingGate, customersRouter);
  app.use('/api/payables', requireAuth, requireTenant, billingGate, payablesRouter);
  app.use('/api/settings', requireAuth, requireTenant, billingGate, settingsRouter);
  app.use('/api/payment-methods', requireAuth, requireTenant, billingGate, paymentMethodsRouter);
  app.use('/api/surcharge-rules', requireAuth, requireTenant, billingGate, surchargeRulesRouter);
  app.use('/api/delivery-zones', requireAuth, requireTenant, billingGate, deliveryZonesRouter);
  app.use('/api/orders', requireAuth, requireTenant, billingGate, ordersRouter);
  app.use('/api/audit', requireAuth, requireTenant, auditRouter);
  app.use('/api/uploads', requireAuth, requireTenant, billingGate, uploadsRouter);

  const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    // Express 5: '*' não é mais aceito; usa regex para o fallback da SPA.
    // Não captura /api (estático já montado acima) — uploads agora vêm do
    // Supabase Storage, não são mais servidos por este processo.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
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

