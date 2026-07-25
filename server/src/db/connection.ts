import { Pool, PoolClient, types } from 'pg';

// TIMESTAMPTZ/DATE chegam como string ISO (não Date), preservando o formato
// que os mapRow dos repositories já esperam.
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
types.setTypeParser(types.builtins.DATE, (v) => v);
// BIGINT (int8) vem como string por padrão; nossos ids cabem em Number.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

const adminUrl = process.env.DATABASE_URL ?? 'postgres://adega:adega@localhost:5433/adega';

export const APP_DB_ROLE = 'adega_app';
const appDbPassword = process.env.APP_DB_PASSWORD ?? 'adega_app_dev';

const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;

// Força UTF8 na sessão — sem isto, o client_encoding herda o locale do SO
// (WIN1252 em Windows), que aceita acentos (subset de Latin-1) mas quebra em
// qualquer caractere fora dele, como emoji de 4 bytes (ex.: ícone de meio de
// pagamento) — erro 22P05 "no equivalent in encoding WIN1252".
const encodingOptions = '-c client_encoding=UTF8';

/**
 * Pool ADMIN (superuser do provedor): usado SOMENTE por migrations/bootstrap.
 * Superusers ignoram RLS — nunca use este pool para servir requests.
 */
export const adminPool = new Pool({ connectionString: adminUrl, ssl, options: encodingOptions });

// Pool da APLICAÇÃO: conecta com role não-privilegiado (adega_app), sujeito a
// RLS. Mesmo host/porta/database do admin, credenciais próprias.
const parsed = new URL(adminUrl);
export const pool = new Pool({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 5432,
  database: parsed.pathname.slice(1),
  user: APP_DB_ROLE,
  password: appDbPassword,
  ssl,
  options: encodingOptions,
});

export function getAppDbPassword(): string {
  return appDbPassword;
}

/**
 * Executa `fn` numa transação escopada ao tenant: o SET LOCAL app.tenant_id
 * ativa as policies de RLS, então NENHUMA query dentro de `fn` enxerga (ou
 * consegue gravar) linhas de outro tenant, mesmo que esqueça o filtro.
 * Todo acesso a dados de negócio DEVE passar por aqui.
 */
export async function withTenantTransaction<T>(
  tenantId: number,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transação SEM escopo de tenant — para tabelas de sistema (tenants,
 * account_owners, subscriptions, billing_events). Roda no pool da aplicação,
 * então tabelas de negócio continuam protegidas por RLS aqui dentro.
 */
export async function withSystemTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
