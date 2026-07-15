// Teste de corrida de estoque: N vendas simultâneas disputando as últimas
// unidades de um produto. O esperado: apenas as vendas que cabem no estoque
// passam; o estoque NUNCA fica negativo. Uso: npm run race-test -w server
import { pool, withSystemTransaction, withTenantTransaction } from '../src/db/connection';
import * as productsRepo from '../src/modules/products/products.repository';
import * as salesService from '../src/modules/sales/sales.service';
import * as cashRepo from '../src/modules/cash/cash.repository';

const CONCURRENT_SALES = 5;
const INITIAL_STOCK = 2; // só 2 unidades para 5 compradores

async function main() {
  // Arranjo: tenant isolado para o teste, com produto de estoque curto e caixa aberto.
  const tenantId = await withSystemTransaction(async (c) => {
    const slug = `race-test-${Date.now()}`;
    const { rows } = await c.query(
      `INSERT INTO tenants (slug, store_name, status, trial_ends_at)
       VALUES ($1, 'Race Test', 'active', now() + interval '1 day') RETURNING id`,
      [slug]
    );
    return rows[0].id as number;
  });

  const productId = await withTenantTransaction(tenantId, async (c) => {
    await cashRepo.openSession(c, 0, null);
    const product = await productsRepo.create(c, {
      name: 'Última Garrafa',
      category: 'vinho',
      costPriceCents: 1000,
      salePriceCents: 2000,
      stockQuantity: INITIAL_STOCK,
    });
    return product.id;
  });

  // Ato: N vendas de 1 unidade disparadas ao mesmo tempo.
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT_SALES }, () =>
      salesService.completeSale(
        tenantId,
        {
          items: [{ productId, quantity: 1, unitPriceCents: 2000 }],
          payments: [{ method: 'pix', amountCents: 2000 }],
        },
        null
      )
    )
  );

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  const finalStock = await withTenantTransaction(tenantId, async (c) => {
    const p = await productsRepo.findById(c, productId);
    return p!.stockQuantity;
  });

  console.log(`Vendas simultâneas: ${CONCURRENT_SALES} | sucesso: ${ok} | recusadas: ${failed}`);
  console.log(`Estoque inicial: ${INITIAL_STOCK} | final: ${finalStock}`);

  const pass = ok === INITIAL_STOCK && finalStock === 0 && finalStock >= 0;
  if (pass) {
    console.log('PASS: nenhuma unidade vendida além do estoque, sem estoque negativo.');
  } else {
    console.error('FAIL: overselling detectado ou contagem incorreta!');
  }

  await pool.end();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
