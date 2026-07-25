import fs from 'node:fs';
import path from 'node:path';
import { adminPool, APP_DB_ROLE, getAppDbPassword } from './connection';

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Garante o role não-privilegiado usado pela aplicação em runtime.
 * O RLS só funciona porque a app NÃO conecta como superuser — superusers
 * ignoram policies. Idempotente: seguro rodar a cada deploy.
 */
async function ensureAppRole(client: import('pg').PoolClient) {
  const { rows } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_DB_ROLE]);
  if (rows.length === 0) {
    await client.query(
      `CREATE ROLE ${APP_DB_ROLE} LOGIN PASSWORD ${quoteLiteral(getAppDbPassword())} NOSUPERUSER NOBYPASSRLS`
    );
  } else {
    await client.query(
      `ALTER ROLE ${APP_DB_ROLE} WITH LOGIN PASSWORD ${quoteLiteral(getAppDbPassword())} NOSUPERUSER NOBYPASSRLS`
    );
  }
  await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_DB_ROLE}`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_DB_ROLE}`
  );
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_DB_ROLE}`);

  // Tabelas imutáveis para a aplicação: só INSERT/SELECT. Correções são
  // sempre um novo registro (ex.: lançamento 'ajuste'), nunca edição.
  for (const table of ['audit_logs', 'customer_ledger_entries']) {
    const exists = await client.query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    );
    if (exists.rows.length > 0) {
      await client.query(`REVOKE UPDATE, DELETE ON ${table} FROM ${APP_DB_ROLE}`);
    }
  }

  // Tabelas de sistema (sem tenant_id): no Supabase a Data API (PostgREST)
  // expõe o schema public, então elas ficam com RLS habilitada e SEM policy
  // pública — invisíveis para anon/authenticated. A app (adega_app) acessa
  // via policy explícita de acesso total, criada aqui de forma idempotente.
  for (const table of ['tenants', 'account_owners', 'subscriptions', 'billing_events']) {
    const exists = await client.query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
      ['public', table]
    );
    if (exists.rows.length === 0) continue;
    await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    const policy = await client.query(
      'SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2 AND policyname = $3',
      ['public', table, 'app_full_access']
    );
    if (policy.rows.length === 0) {
      await client.query(
        `CREATE POLICY app_full_access ON ${table} FOR ALL TO ${APP_DB_ROLE} USING (true) WITH CHECK (true)`
      );
    }
  }
}

export async function runMigrations() {
  const client = await adminPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r: { name: string }) => r.name));

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migration aplicada: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    await ensureAppRole(client);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      console.log('Migrations concluídas.');
      await adminPool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

