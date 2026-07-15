// Teste de concorrência: dois caixas vendendo e fechando ao mesmo tempo.
// Prova que o fechamento de um caixa não altera os valores do outro e que os
// valores esperados são independentes. Uso: npm run close-race-test -w server
import { pool, withSystemTransaction, withTenantTransaction } from '../src/db/connection';
import * as cashRepo from '../src/modules/cash/cash.repository';
import * as cashService from '../src/modules/cash/cash.service';
import * as productsRepo from '../src/modules/products/products.repository';
import * as salesService from '../src/modules/sales/sales.service';

async function main() {
  const tenantId = await withSystemTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO tenants (slug, store_name, status, trial_ends_at)
       VALUES ($1, 'Close Race', 'active', now() + interval '1 day') RETURNING id`,
      [`close-race-${Date.now()}`]
    );
    return rows[0].id as number;
  });

  // Dois caixas abertos com fundos diferentes e um produto com estoque de sobra.
  const { c1, c2, productId } = await withTenantTransaction(tenantId, async (c) => {
    const s1 = await cashRepo.openSession(c, 10000, null, 'Caixa 1');
    const s2 = await cashRepo.openSession(c, 5000, null, 'Caixa 2');
    const p = await productsRepo.create(c, {
      name: 'Produto Comum',
      category: 'outro',
      costPriceCents: 500,
      salePriceCents: 1000,
      stockQuantity: 100,
    });
    return { c1: s1.id, c2: s2.id, productId: p.id };
  });

  const sell = (cashSessionId: number, qty: number) =>
    salesService.completeSale(
      tenantId,
      {
        items: [{ productId, quantity: qty, unitPriceCents: 1000 }],
        payments: [{ method: 'dinheiro', amountCents: qty * 1000, amountReceivedCents: qty * 1000 }],
        cashSessionId,
      },
      null
    );

  // Caixa 1 faz 3 vendas em dinheiro (3000), Caixa 2 faz 2 (2000), tudo concorrente.
  await Promise.all([sell(c1, 1), sell(c1, 1), sell(c1, 1), sell(c2, 1), sell(c2, 1)]);

  const exp1 = await cashService.getExpected(tenantId, c1); // 10000 + 3000 = 13000
  const exp2 = await cashService.getExpected(tenantId, c2); // 5000 + 2000 = 7000

  // Fecha os dois ao mesmo tempo, cada um com seu valor contado.
  const [close1, close2] = await Promise.all([
    cashService.close(tenantId, c1, { countedAmountCents: exp1 }, null),
    cashService.close(tenantId, c2, { countedAmountCents: exp2 }, null),
  ]);

  console.log(`Caixa 1: esperado ${exp1} | contado ${close1.countedAmountCents} | diferença ${close1.differenceCents}`);
  console.log(`Caixa 2: esperado ${exp2} | contado ${close2.countedAmountCents} | diferença ${close2.differenceCents}`);

  const pass =
    exp1 === 13000 &&
    exp2 === 7000 &&
    close1.differenceCents === 0 &&
    close2.differenceCents === 0 &&
    close1.status === 'fechado' &&
    close2.status === 'fechado';

  if (pass) {
    console.log('PASS: caixas independentes — o fechamento de um não afetou o outro.');
  } else {
    console.error('FAIL: interferência entre caixas detectada!');
  }

  await pool.end();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
