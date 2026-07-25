import type { CustomerLedgerEntry, LedgerEntryType } from '@adega/shared';
import type { PoolClient } from 'pg';

interface LedgerRow {
  id: number;
  customer_id: number;
  type: LedgerEntryType;
  amount_cents: number;
  balance_after_cents: number;
  due_date: string | null;
  sale_id: number | null;
  notes: string | null;
  user_id: number | null;
  created_at: string;
}

function mapRow(row: LedgerRow): CustomerLedgerEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    amountCents: row.amount_cents,
    balanceAfterCents: row.balance_after_cents,
    dueDate: row.due_date,
    saleId: row.sale_id,
    notes: row.notes,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export async function listByCustomer(client: PoolClient, customerId: number): Promise<CustomerLedgerEntry[]> {
  const { rows } = await client.query(
    'SELECT * FROM customer_ledger_entries WHERE customer_id = $1 ORDER BY id DESC',
    [customerId]
  );
  return rows.map(mapRow);
}

export interface AddEntryInput {
  customerId: number;
  type: LedgerEntryType;
  amountCents: number;
  dueDate?: string | null;
  saleId?: number | null;
  notes?: string | null;
  userId: number | null;
}

/**
 * Ajusta o saldo do cliente e registra o lançamento na mesma transação,
 * usando UPDATE atômico (mesmo padrão de adjustStockQuantity) para não
 * perder atualização sob vendas simultâneas do mesmo cliente.
 */
export async function addEntry(client: PoolClient, input: AddEntryInput): Promise<CustomerLedgerEntry> {
  const { rows: balanceRows } = await client.query(
    'UPDATE customers SET balance_cents = balance_cents + $1, updated_at = now() WHERE id = $2 RETURNING balance_cents',
    [input.amountCents, input.customerId]
  );
  const balanceAfterCents = balanceRows[0].balance_cents;

  const { rows } = await client.query(
    `INSERT INTO customer_ledger_entries
      (customer_id, type, amount_cents, balance_after_cents, due_date, sale_id, notes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.customerId,
      input.type,
      input.amountCents,
      balanceAfterCents,
      input.dueDate ?? null,
      input.saleId ?? null,
      input.notes ?? null,
      input.userId,
    ]
  );
  return mapRow(rows[0]);
}
