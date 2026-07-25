import type {
  CashSession,
  CashSessionSummary,
  CloseCashSessionRequest,
  CreateCashMovementRequest,
  OpenCashSessionRequest,
  PaymentBreakdown,
  UserRole,
} from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import * as paymentMethodsRepo from '../paymentMethods/paymentMethods.repository';
import * as repo from './cash.repository';

export interface ActingUser {
  userId: number | null;
  role: UserRole;
}

/** Um funcionário só pode agir no próprio caixa; gerente/admin podem agir em
 * qualquer caixa da loja (ex.: funcionário esqueceu de fechar e foi embora). */
function assertCanAct(session: CashSession, auth: ActingUser) {
  if (auth.role !== 'FUNCIONARIO') return;
  if (session.openedByUserId !== auth.userId) {
    throw new AppError('Este caixa foi aberto por outro operador', 403);
  }
}

export function getOpenSessions(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listOpenSessions(client));
}

export function getSession(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const session = await repo.findById(client, id);
    if (!session) throw new AppError('Sessão de caixa não encontrada', 404);
    return session;
  });
}

export function getHistory(tenantId: number, from?: string, to?: string) {
  return withTenantTransaction(tenantId, (client) => repo.listHistory(client, from, to));
}

export function getMovements(tenantId: number, sessionId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listMovements(client, sessionId));
}

/** Resumo do caixa para conferência no fechamento: quebra por forma de pagamento,
 * suprimentos, sangrias e cancelamentos da sessão. */
export function getSummary(tenantId: number, sessionId: number): Promise<CashSessionSummary> {
  return withTenantTransaction(tenantId, async (client) => {
    const session = await repo.findById(client, sessionId);
    if (!session) throw new AppError('Sessão de caixa não encontrada', 404);

    const methods = await paymentMethodsRepo.listActive(client);
    const breakdownRows = await repo.paymentBreakdown(client, sessionId);
    const paymentBreakdown: PaymentBreakdown = {};
    for (const m of methods) paymentBreakdown[m.code] = 0;
    for (const row of breakdownRows) paymentBreakdown[row.method] = row.total;

    const agg = await repo.sessionSalesAgg(client, sessionId);
    return {
      session,
      salesCount: agg.salesCount,
      salesTotalCents: agg.salesTotalCents,
      paymentBreakdown,
      paymentMethods: methods,
      suprimentosCents: await repo.sumMovements(client, sessionId, 'suprimento'),
      sangriasCents: await repo.sumMovements(client, sessionId, 'sangria'),
      canceledCount: agg.canceledCount,
    };
  });
}

export async function open(tenantId: number, data: OpenCashSessionRequest, userId: number | null) {
  if (data.openingAmountCents < 0) throw new AppError('Valor de abertura inválido');
  const label = data.registerLabel.trim();
  if (!label) throw new AppError('Nome do caixa é obrigatório');

  try {
    return await withTenantTransaction(tenantId, async (client) => {
      const session = await repo.openSession(client, data.openingAmountCents, userId, label);
      await logAction(client, userId, 'caixa.abertura', 'cash_session', session.id, {
        registerLabel: label,
        openingAmountCents: data.openingAmountCents,
      });
      return session;
    });
  } catch (err) {
    // 23505 = índice único parcial (tenant, register_label) WHERE aberto
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      throw new AppError(`O caixa "${label}" já está aberto`, 409);
    }
    throw err;
  }
}

export function addMovement(
  tenantId: number,
  sessionId: number,
  data: CreateCashMovementRequest,
  auth: ActingUser
) {
  return withTenantTransaction(tenantId, async (client) => {
    // Trava a linha da sessão: serializa sangrias/suprimentos concorrentes no
    // mesmo caixa para que o saldo esperado lido abaixo esteja sempre atualizado.
    const session = await repo.lockById(client, sessionId);
    if (!session) throw new AppError('Sessão de caixa não encontrada', 404);
    assertCanAct(session, auth);
    if (session.status !== 'aberto') throw new AppError('Este caixa já está fechado');
    if (data.amountCents <= 0) throw new AppError('Valor deve ser positivo');
    if (!data.reason.trim()) throw new AppError('Motivo é obrigatório');

    if (data.type === 'sangria') {
      const expected = await computeExpected(client, sessionId, session.openingAmountCents);
      if (expected - data.amountCents < 0) {
        throw new AppError('Sangria maior que o valor disponível em caixa');
      }
    }

    const movement = await repo.insertMovement(
      client,
      sessionId,
      data.type,
      data.amountCents,
      data.reason.trim(),
      auth.userId
    );
    await logAction(client, auth.userId, `caixa.${data.type}`, 'cash_movement', movement.id, {
      cashSessionId: sessionId,
      amountCents: data.amountCents,
      reason: data.reason.trim(),
      ...(session.openedByUserId !== auth.userId ? { actingOnOtherOperator: true } : {}),
    });
    return movement;
  });
}

export function getExpected(tenantId: number, sessionId: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const session = await repo.findById(client, sessionId);
    if (!session) throw new AppError('Sessão de caixa não encontrada', 404);
    return computeExpected(client, sessionId, session.openingAmountCents);
  });
}

async function computeExpected(
  client: PoolClient,
  sessionId: number,
  openingAmountCents: number
): Promise<number> {
  const cashSales = await repo.sumCashSales(client, sessionId);
  const suprimentos = await repo.sumMovements(client, sessionId, 'suprimento');
  const sangrias = await repo.sumMovements(client, sessionId, 'sangria');
  return openingAmountCents + cashSales + suprimentos - sangrias;
}

export function close(
  tenantId: number,
  sessionId: number,
  data: CloseCashSessionRequest,
  auth: ActingUser
) {
  return withTenantTransaction(tenantId, async (client) => {
    // Trava a linha da sessão: serializa contra sangrias/suprimentos e contra
    // outro fechamento concorrente do mesmo caixa (ver closeSession abaixo).
    const session = await repo.lockById(client, sessionId);
    if (!session) throw new AppError('Sessão de caixa não encontrada', 404);
    assertCanAct(session, auth);
    if (session.status !== 'aberto') throw new AppError('Este caixa já está fechado');
    if (data.countedAmountCents < 0) throw new AppError('Valor contado inválido');

    const expected = await computeExpected(client, sessionId, session.openingAmountCents);
    const difference = data.countedAmountCents - expected;

    if (difference !== 0 && !data.notes?.trim()) {
      throw new AppError('Há divergência no fechamento — informe uma observação');
    }

    const closed = await repo.closeSession(
      client,
      sessionId,
      expected,
      data.countedAmountCents,
      difference,
      data.notes?.trim() ?? null,
      auth.userId
    );
    // WHERE status = 'aberto' no UPDATE: 0 linhas = outra chamada fechou primeiro.
    if (!closed) throw new AppError('Este caixa já foi fechado por outra operação', 409);
    await logAction(client, auth.userId, 'caixa.fechamento', 'cash_session', sessionId, {
      registerLabel: closed.registerLabel,
      expectedAmountCents: expected,
      countedAmountCents: data.countedAmountCents,
      differenceCents: difference,
      ...(session.openedByUserId !== auth.userId ? { actingOnOtherOperator: true } : {}),
    });
    return closed;
  });
}

/** Reabre um caixa fechado — exclusivo de admin, sempre com motivo auditado. */
export async function reopen(
  tenantId: number,
  sessionId: number,
  reason: string,
  userId: number | null
) {
  if (!reason.trim()) throw new AppError('Informe o motivo da reabertura');
  try {
    return await reopenTx(tenantId, sessionId, reason, userId);
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      throw new AppError('Já existe um caixa aberto com este nome — feche-o antes de reabrir', 409);
    }
    throw err;
  }
}

function reopenTx(tenantId: number, sessionId: number, reason: string, userId: number | null) {
  return withTenantTransaction(tenantId, async (client) => {
    const session = await repo.findById(client, sessionId);
    if (!session) throw new AppError('Sessão de caixa não encontrada', 404);
    if (session.status !== 'fechado') throw new AppError('Este caixa não está fechado');

    const { rows } = await client.query(
      `UPDATE cash_sessions SET
        status = 'aberto', expected_amount_cents = NULL, counted_amount_cents = NULL,
        difference_cents = NULL, closed_at = NULL, closed_by_user_id = NULL
       WHERE id = $1 AND status = 'fechado' RETURNING id`,
      [sessionId]
    );
    if (rows.length === 0) throw new AppError('Não foi possível reabrir o caixa', 409);

    await logAction(client, userId, 'caixa.reabertura', 'cash_session', sessionId, {
      registerLabel: session.registerLabel,
      reason: reason.trim(),
      previousDifferenceCents: session.differenceCents,
    });
    return repo.findById(client, sessionId);
  });
}
