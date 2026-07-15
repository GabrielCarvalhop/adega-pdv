// Gestão manual do status de assinatura de uma loja — usado enquanto a
// integração com o gateway de pagamentos não existe. Quando o gateway
// confirmar um pagamento, é este mesmo UPDATE que a integração fará.
//
// Uso:
//   npm run tenant:status -w server -- <slug>                (consultar)
//   npm run tenant:status -w server -- <slug> active         (ativar)
//   npm run tenant:status -w server -- <slug> past_due       (suspender)
//   npm run tenant:status -w server -- <slug> canceled       (cancelar)
import { pool, withSystemTransaction } from '../src/db/connection';

const VALID = ['trialing', 'active', 'past_due', 'canceled'];

async function main() {
  const [slug, status] = process.argv.slice(2);
  if (!slug) {
    console.error('Uso: npm run tenant:status -w server -- <slug> [novo-status]');
    process.exit(1);
  }

  await withSystemTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, slug, store_name, status, trial_ends_at FROM tenants WHERE slug = $1',
      [slug]
    );
    if (!rows[0]) {
      console.error(`Loja "${slug}" não encontrada.`);
      process.exit(1);
    }

    if (!status) {
      console.log(JSON.stringify(rows[0], null, 2));
      return;
    }

    if (!VALID.includes(status)) {
      console.error(`Status inválido. Use: ${VALID.join(', ')}`);
      process.exit(1);
    }

    await client.query('UPDATE tenants SET status = $1, updated_at = now() WHERE slug = $2', [
      status,
      slug,
    ]);
    console.log(`Loja "${slug}": ${rows[0].status} → ${status}`);
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
