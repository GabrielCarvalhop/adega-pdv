import type { CreatePayableRequest, Payable, UpdatePayableRequest } from '@adega/shared';
import type { PoolClient } from 'pg';

interface PayableRow {
  id: number;
  description: string;
  category: string | null;
  amount_cents: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PayableRow): Payable {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amountCents: row.amount_cents,
    dueDate: row.due_date,
    paid: row.paid,
    paidAt: row.paid_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PayableFilters {
  paid?: boolean;
  from?: string;
  to?: string;
}

export async function findAll(client: PoolClient, filters: PayableFilters): Promise<Payable[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.paid !== undefined) {
    params.push(filters.paid);
    clauses.push(`paid = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`due_date >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`due_date <= $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await client.query(
    `SELECT * FROM payables ${where} ORDER BY paid ASC, due_date ASC`,
    params
  );
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<Payable | undefined> {
  const { rows } = await client.query('SELECT * FROM payables WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function create(client: PoolClient, data: CreatePayableRequest): Promise<Payable> {
  const { rows } = await client.query(
    `INSERT INTO payables (description, category, amount_cents, due_date, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.description, data.category ?? null, data.amountCents, data.dueDate, data.notes ?? null]
  );
  return mapRow(rows[0]);
}

export async function update(
  client: PoolClient,
  id: number,
  data: UpdatePayableRequest
): Promise<Payable | undefined> {
  const existing = await findById(client, id);
  if (!existing) return undefined;
  const { rows } = await client.query(
    `UPDATE payables SET description = $1, category = $2, amount_cents = $3, due_date = $4,
      notes = $5, updated_at = now()
     WHERE id = $6 RETURNING *`,
    [
      data.description ?? existing.description,
      data.category ?? existing.category,
      data.amountCents ?? existing.amountCents,
      data.dueDate ?? existing.dueDate,
      data.notes ?? existing.notes,
      id,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function setPaid(
  client: PoolClient,
  id: number,
  paid: boolean
): Promise<Payable | undefined> {
  const { rows } = await client.query(
    `UPDATE payables SET paid = $1, paid_at = CASE WHEN $1 THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [paid, id]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function remove(client: PoolClient, id: number): Promise<void> {
  await client.query('DELETE FROM payables WHERE id = $1', [id]);
}
