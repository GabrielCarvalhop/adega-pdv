import type { PoolClient } from 'pg';

export type GroupBy = 'day' | 'week' | 'month';

// to_char no Postgres substitui o strftime do SQLite. IYYY-IW = ano/semana ISO.
const groupByFormat: Record<GroupBy, string> = {
  day: 'YYYY-MM-DD',
  week: 'IYYY-"W"IW',
  month: 'YYYY-MM',
};

export interface DateRange {
  from?: string;
  to?: string;
}

function dateClause(
  range: DateRange,
  params: unknown[],
  column = 'created_at'
): string {
  const clauses: string[] = [];
  if (range.from) {
    params.push(range.from);
    clauses.push(`${column} >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    clauses.push(`${column} <= $${params.length}`);
  }
  return clauses.length ? `AND ${clauses.join(' AND ')}` : '';
}

export interface SalesByPeriodRow {
  period: string;
  saleCount: number;
  totalCents: number;
}

export async function salesByPeriod(
  client: PoolClient,
  range: DateRange,
  groupBy: GroupBy
): Promise<SalesByPeriodRow[]> {
  const params: unknown[] = [];
  const clause = dateClause(range, params);
  const format = groupByFormat[groupBy];
  const { rows } = await client.query(
    `SELECT to_char(created_at, '${format}') AS period,
            COUNT(*)::int AS "saleCount",
            SUM(total_cents)::int AS "totalCents"
     FROM sales
     WHERE status = 'concluida' ${clause}
     GROUP BY period
     ORDER BY period ASC`,
    params
  );
  return rows;
}

export interface TopProductRow {
  productId: number;
  name: string;
  totalQuantity: number;
  totalRevenueCents: number;
}

export async function topProducts(
  client: PoolClient,
  range: DateRange,
  limit: number
): Promise<TopProductRow[]> {
  const params: unknown[] = [];
  const clause = dateClause(range, params, 's.created_at');
  params.push(limit);
  const { rows } = await client.query(
    `SELECT si.product_id AS "productId", p.name AS name,
            SUM(si.quantity)::int AS "totalQuantity",
            SUM(si.total_cents)::int AS "totalRevenueCents"
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.status = 'concluida' AND si.canceled = FALSE ${clause}
     GROUP BY si.product_id, p.name
     ORDER BY "totalQuantity" DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

export interface ConsolidatedRegisterRow {
  cash_session_id: number;
  register_label: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  sales_total: number;
  dinheiro: number;
  debito: number;
  credito: number;
  pix: number;
  difference_cents: number | null;
}

/** Todos os caixas abertos/fechados num dia (por opened_at), com quebra de
 * pagamento por caixa. Uma subquery agrega pagamentos por sessão para não
 * multiplicar linhas no JOIN. */
export async function consolidatedByDay(
  client: PoolClient,
  date: string
): Promise<ConsolidatedRegisterRow[]> {
  const { rows } = await client.query(
    `SELECT
       cs.id AS cash_session_id,
       cs.register_label,
       cs.status,
       cs.opened_at,
       cs.closed_at,
       cs.difference_cents,
       COALESCE(pb.sales_total, 0)::int AS sales_total,
       COALESCE(pb.dinheiro, 0)::int AS dinheiro,
       COALESCE(pb.debito, 0)::int AS debito,
       COALESCE(pb.credito, 0)::int AS credito,
       COALESCE(pb.pix, 0)::int AS pix
     FROM cash_sessions cs
     LEFT JOIN (
       SELECT s.cash_session_id,
              SUM(p.amount_cents) AS sales_total,
              SUM(p.amount_cents) FILTER (WHERE p.method = 'dinheiro') AS dinheiro,
              SUM(p.amount_cents) FILTER (WHERE p.method = 'debito') AS debito,
              SUM(p.amount_cents) FILTER (WHERE p.method = 'credito') AS credito,
              SUM(p.amount_cents) FILTER (WHERE p.method = 'pix') AS pix
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE s.status = 'concluida'
       GROUP BY s.cash_session_id
     ) pb ON pb.cash_session_id = cs.id
     WHERE cs.opened_at >= $1::date AND cs.opened_at < ($1::date + interval '1 day')
     ORDER BY cs.register_label ASC`,
    [date]
  );
  return rows;
}

export interface ChannelSplitRow {
  balcao: number;
  online: number;
}

/** Total vendido dividido entre balcão e pedido online (via orders.sale_id),
 * sobre as MESMAS vendas do consolidado: as vinculadas a caixas abertos no dia.
 * Assim balcão + online reconcilia com a soma dos caixas. */
export async function channelSplitByDay(client: PoolClient, date: string): Promise<ChannelSplitRow> {
  const { rows } = await client.query(
    `SELECT
       COALESCE(SUM(s.total_cents) FILTER (WHERE o.id IS NULL), 0)::int AS balcao,
       COALESCE(SUM(s.total_cents) FILTER (WHERE o.id IS NOT NULL), 0)::int AS online
     FROM sales s
     JOIN cash_sessions cs ON cs.id = s.cash_session_id
     LEFT JOIN orders o ON o.sale_id = s.id
     WHERE s.status = 'concluida'
       AND cs.opened_at >= $1::date AND cs.opened_at < ($1::date + interval '1 day')`,
    [date]
  );
  return rows[0];
}

export interface MarginRow {
  productId: number;
  name: string;
  totalQuantity: number;
  revenueCents: number;
  costCents: number;
}

export async function marginByProduct(client: PoolClient, range: DateRange): Promise<MarginRow[]> {
  const params: unknown[] = [];
  const clause = dateClause(range, params, 's.created_at');
  const { rows } = await client.query(
    `SELECT si.product_id AS "productId", p.name AS name,
            SUM(si.quantity)::int AS "totalQuantity",
            SUM(si.total_cents)::int AS "revenueCents",
            SUM(si.unit_cost_cents * si.quantity)::int AS "costCents"
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.status = 'concluida' AND si.canceled = FALSE ${clause}
     GROUP BY si.product_id, p.name
     ORDER BY (SUM(si.total_cents) - SUM(si.unit_cost_cents * si.quantity)) DESC`,
    params
  );
  return rows;
}
