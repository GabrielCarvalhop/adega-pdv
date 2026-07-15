// Sobe um PostgreSQL local de desenvolvimento sem Docker: baixa binários na
// primeira execução e persiste os dados em server/data/pg. Uso: npm run db:dev
import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';

const dataDir = path.join(__dirname, '..', 'data', 'pg');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'adega',
  password: 'adega',
  port: 5433,
  persistent: true,
});

async function main() {
  const isNew = !require('node:fs').existsSync(path.join(dataDir, 'PG_VERSION'));
  if (isNew) {
    console.log('Inicializando cluster PostgreSQL de desenvolvimento...');
    await pg.initialise();
  }
  await pg.start();
  if (isNew) {
    await pg.createDatabase('adega');
  }
  console.log('PostgreSQL de dev rodando em postgres://adega:adega@localhost:5433/adega');
  console.log('Ctrl+C para parar.');

  const stop = async () => {
    console.log('\nParando PostgreSQL...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
