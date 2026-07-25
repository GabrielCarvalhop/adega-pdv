// Testes de concorrência do caixa: (1) sangrias simultâneas não podem
// estourar o saldo disponível; (2) dois fechamentos simultâneos do mesmo
// caixa não podem ambos suceder (last-write-wins). Uso: npm run cash-race-test -w server
import { pool, withSystemTransaction, withTenantTransaction } from '../src/db/connection';
import * as cashRepo from '../src/modules/cash/cash.repository';
import * as cashService from '../src/modules/cash/cash.service';

async function newTenant(label: string): Promise<number> {
  return withSystemTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO tenants (slug, store_name, status, trial_ends_at)
       VALUES ($1, $2, 'active', now() + interval '1 day') RETURNING id`,
      [`${label}-${Date.now()}`, label]
    );
    return rows[0].id as number;
  });
}

async function testSangriaRace(): Promise<boolean> {
  const tenantId = await newTenant('sangria-race');
  const sessionId = await withTenantTransaction(tenantId, async (c) => {
    const s = await cashRepo.openSession(c, 10000, null, 'Caixa 1'); // fundo de R$100
    return s.id;
  });

  const actor = { userId: null, role: 'ADMIN_LOJA' as const };
  // 4 sangrias de R$30 concorrentes contra um saldo de R$100 — só 3 cabem.
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      cashService.addMovement(tenantId, sessionId, { type: 'sangria', amountCents: 3000, reason: 'teste' }, actor)
    )
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const expected = await cashService.getExpected(tenantId, sessionId);

  console.log(`Sangrias concorrentes: 4 tentativas de R$30 contra fundo de R$100 | sucesso: ${ok}`);
  console.log(`Saldo esperado final: ${expected} centavos`);

  const pass = ok === 3 && expected === 1000 && expected >= 0;
  console.log(pass ? 'PASS: sangria nunca estourou o saldo disponível.' : 'FAIL: overdraft detectado!');
  return pass;
}

async function testCloseRace(): Promise<boolean> {
  const tenantId = await newTenant('close-race');
  const sessionId = await withTenantTransaction(tenantId, async (c) => {
    const s = await cashRepo.openSession(c, 5000, null, 'Caixa 1');
    return s.id;
  });

  const actor = { userId: null, role: 'ADMIN_LOJA' as const };
  // Dois fechamentos simultâneos do MESMO caixa — só um pode suceder.
  const results = await Promise.allSettled([
    cashService.close(tenantId, sessionId, { countedAmountCents: 5000 }, actor),
    cashService.close(tenantId, sessionId, { countedAmountCents: 5000 }, actor),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Fechamentos concorrentes no mesmo caixa: sucesso: ${ok} | recusados: ${failed}`);

  const pass = ok === 1 && failed === 1;
  console.log(pass ? 'PASS: apenas um fechamento venceu a corrida.' : 'FAIL: os dois fechamentos passaram!');
  return pass;
}

async function main() {
  const pass1 = await testSangriaRace();
  const pass2 = await testCloseRace();

  await pool.end();
  process.exit(pass1 && pass2 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
