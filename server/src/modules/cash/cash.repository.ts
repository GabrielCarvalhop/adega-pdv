import type { CashMovement, CashMovementType, CashSession } from '@adega/shared';
import type { PoolClient } from 'pg';

interface CashSessionRow {
  id: number;
  status: string;
  register_label: string;
  opening_amount_cents: number;
  expected_amount_cents: number | null;
  counted_amount_cents: number | null;
  difference_cents: number | null;
  opened_at: string;
  closed_at: string | null;
  opened_by_user_id: number | null;
  closed_by_user_id: number | null;
  notes: string | null;
  opened_by_user_name?: string | null;
  closed_by_user_name?: string | null;
}

function mapSessionRow(row: CashSessionRow): CashSession {
  return {
    id: row.id,
    status: row.status as CashSession['status'],
    registerLabel: row.register_label,
    openingAmountCents: row.opening_amount_cents,
    expectedAmountCents: row.expected_amount_cents,
    countedAmountCents: row.counted_amount_cents,
    differenceCents: row.difference_cents,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openedByUserId: row.opened_by_user_id,
    closedByUserId: row.closed_by_user_id,
    openedByUserName: row.opened_by_user_name ?? null,
    closedByUserName: row.closed_by_user_name ?? null,
    notes: row.notes,
  };
}

const SESSION_SELECT = `
  SELECT cs.*, ou.name AS opened_by_user_name, cu.name AS closed_by_user_name
  FROM cash_sessions cs
  LEFT JOIN users ou ON ou.id = cs.opened_by_user_id
  LEFT JOIN users cu ON cu.id = cs.closed_by_user_id
`;

interface CashMovementRow {
  id: number;
  cash_session_id: number;
  type: string;
  amount_cents: number;
  reason: string;
  user_id: number | null;
  created_at: string;
}

function mapMovementRow(row: CashMovementRow): CashMovement {
  return {
    id: row.id,
    cashSessionId: row.cash_session_id,
    type: row.type as CashMovementType,
    amountCents: row.amount_cents,
    reason: row.reason,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export async function listOpenSessions(client: PoolClient): Promise<CashSession[]> {
  const { rows } = await client.query(
    `${SESSION_SELECT} WHERE cs.status = 'aberto' ORDER BY cs.register_label ASC`
  );
  return rows.map(mapSessionRow);
}

export async function findById(client: PoolClient, id: number): Promise<CashSession | undefined> {
  const { rows } = await client.query(`${SESSION_SELECT} WHERE cs.id = $1`, [id]);
  return rows[0] ? mapSessionRow(rows[0]) : undefined;
}

/** Trava a linha da sessão até o fim da transação — serializa chamadas
 * concorrentes de sangria/suprimento/fechamento no mesmo caixa. */
export async function lockById(client: PoolClient, id: number): Promise<CashSession | undefined> {
  const { rows } = await client.query('SELECT * FROM cash_sessions WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ? mapSessionRow(rows[0]) : undefined;
}

export async function listHistory(
  client: PoolClient,
  from?: string,
  to?: string
): Promise<CashSession[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (from) {
    params.push(from);
    clauses.push(`cs.opened_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`cs.opened_at <= $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await client.query(
    `${SESSION_SELECT} ${where} ORDER BY cs.opened_at DESC`,
    params
  );
  return rows.map(mapSessionRow);
}

export async function openSession(
  client: PoolClient,
  openingAmountCents: number,
  userId: number | null,
  registerLabel = 'Caixa 1'
): Promise<CashSession> {
  const { rows } = await client.query(
    `INSERT INTO cash_sessions (status, opening_amount_cents, opened_by_user_id, register_label)
     VALUES ('aberto', $1, $2, $3) RETURNING *`,
    [openingAmountCents, userId, registerLabel]
  );
  return mapSessionRow(rows[0]);
}

export async function closeSession(
  client: PoolClient,
  id: number,
  expectedAmountCents: number,
  countedAmountCents: number,
  differenceCents: number,
  notes: string | null,
  userId: number | null
): Promise<CashSession | undefined> {
  const { rows } = await client.query(
    `UPDATE cash_sessions SET
      status = 'fechado', expected_amount_cents = $1, counted_amount_cents = $2,
      difference_cents = $3, notes = $4, closed_at = now(), closed_by_user_id = $5
     WHERE id = $6 AND status = 'aberto' RETURNING *`,
    [expectedAmountCents, countedAmountCents, differenceCents, notes, userId, id]
  );
  return rows[0] ? mapSessionRow(rows[0]) : undefined;
}

export async function listMovements(client: PoolClient, sessionId: number): Promise<CashMovement[]> {
  const { rows } = await client.query(
    'SELECT * FROM cash_movements WHERE cash_session_id = $1 ORDER BY created_at DESC',
    [sessionId]
  );
  return rows.map(mapMovementRow);
}

export async function insertMovement(
  client: PoolClient,
  sessionId: number,
  type: CashMovementType,
  amountCents: number,
  reason: string,
  userId: number | null
): Promise<CashMovement> {
  const { rows } = await client.query(
    `INSERT INTO cash_movements (cash_session_id, type, amount_cents, reason, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sessionId, type, amountCents, reason, userId]
  );
  return mapMovementRow(rows[0]);
}

export async function sumMovements(
  client: PoolClient,
  sessionId: number,
  type: CashMovementType
): Promise<number> {
  const { rows } = await client.query(
    'SELECT COALESCE(SUM(amount_cents), 0)::int AS total FROM cash_movements WHERE cash_session_id = $1 AND type = $2',
    [sessionId, type]
  );
  return rows[0].total;
}

export async function sumCashSales(client: PoolClient, sessionId: number): Promise<number> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(p.amount_cents), 0)::int AS total
     FROM payments p
     JOIN sales s ON s.id = p.sale_id
     JOIN payment_methods pm ON pm.id = p.payment_method_id
     WHERE s.cash_session_id = $1 AND s.status = 'concluida' AND pm.kind = 'dinheiro'`,
    [sessionId]
  );
  return rows[0].total;
}

export interface PaymentBreakdownRow {
  method: string;
  total: number;
}

/** Soma de pagamentos por código de meio de pagamento das vendas concluídas
 * de uma sessão — chaves dinâmicas, dependem dos payment_methods do tenant. */
export async function paymentBreakdown(
  client: PoolClient,
  sessionId: number
): Promise<PaymentBreakdownRow[]> {
  const { rows } = await client.query(
    `SELECT pm.code AS method, COALESCE(SUM(p.amount_cents), 0)::int AS total
     FROM payments p
     JOIN sales s ON s.id = p.sale_id
     JOIN payment_methods pm ON pm.id = p.payment_method_id
     WHERE s.cash_session_id = $1 AND s.status = 'concluida'
     GROUP BY pm.code`,
    [sessionId]
  );
  return rows;
}

export interface SessionSalesAgg {
  salesCount: number;
  salesTotalCents: number;
  canceledCount: number;
}

export async function sessionSalesAgg(
  client: PoolClient,
  sessionId: number
): Promise<SessionSalesAgg> {
  const { rows } = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'concluida')::int AS sales_count,
       COALESCE(SUM(total_cents) FILTER (WHERE status = 'concluida'), 0)::int AS sales_total,
       COUNT(*) FILTER (WHERE status = 'cancelada')::int AS canceled_count
     FROM sales WHERE cash_session_id = $1`,
    [sessionId]
  );
  return {
    salesCount: rows[0].sales_count,
    salesTotalCents: rows[0].sales_total,
    canceledCount: rows[0].canceled_count,
  };
}
