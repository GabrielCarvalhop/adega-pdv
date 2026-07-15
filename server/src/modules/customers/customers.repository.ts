import type {
  CreateCustomerAddressRequest,
  CreateCustomerRequest,
  Customer,
  CustomerAddress,
  CustomerStats,
  UpdateCustomerRequest,
} from '@adega/shared';
import type { PoolClient } from 'pg';

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  document: string | null;
  birthdate: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  blocked: boolean;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    document: row.document,
    birthdate: row.birthdate,
    address: row.address,
    notes: row.notes,
    active: row.active,
    blocked: row.blocked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(client: PoolClient, search?: string): Promise<Customer[]> {
  if (search) {
    const { rows } = await client.query(
      `SELECT * FROM customers
       WHERE active = TRUE AND (name ILIKE $1 OR phone ILIKE $1 OR document ILIKE $1 OR email ILIKE $1)
       ORDER BY name ASC`,
      [`%${search}%`]
    );
    return rows.map(mapRow);
  }
  const { rows } = await client.query('SELECT * FROM customers WHERE active = TRUE ORDER BY name ASC');
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<Customer | undefined> {
  const { rows } = await client.query('SELECT * FROM customers WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

/** Normaliza telefone para comparação: só dígitos. */
function digits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function findByPhone(client: PoolClient, phone: string): Promise<Customer | undefined> {
  const { rows } = await client.query(
    `SELECT * FROM customers
     WHERE active = TRUE AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
     LIMIT 1`,
    [digits(phone)]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function create(client: PoolClient, data: CreateCustomerRequest): Promise<Customer> {
  const { rows } = await client.query(
    `INSERT INTO customers (name, phone, whatsapp, email, document, birthdate, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.name,
      data.phone ?? null,
      data.whatsapp ?? null,
      data.email ?? null,
      data.document ?? null,
      data.birthdate ?? null,
      data.address ?? null,
      data.notes ?? null,
    ]
  );
  return mapRow(rows[0]);
}

export async function update(
  client: PoolClient,
  id: number,
  data: UpdateCustomerRequest
): Promise<Customer | undefined> {
  const existing = await findById(client, id);
  if (!existing) return undefined;
  const { rows } = await client.query(
    `UPDATE customers SET name = $1, phone = $2, whatsapp = $3, email = $4, document = $5,
      birthdate = $6, address = $7, notes = $8, active = $9, blocked = $10, updated_at = now()
     WHERE id = $11 RETURNING *`,
    [
      data.name ?? existing.name,
      data.phone ?? existing.phone,
      data.whatsapp ?? existing.whatsapp,
      data.email ?? existing.email,
      data.document ?? existing.document,
      data.birthdate ?? existing.birthdate,
      data.address ?? existing.address,
      data.notes ?? existing.notes,
      data.active ?? existing.active,
      data.blocked ?? existing.blocked,
      id,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function softDelete(client: PoolClient, id: number): Promise<void> {
  await client.query('UPDATE customers SET active = FALSE, updated_at = now() WHERE id = $1', [id]);
}

// ---- Endereços ----

interface AddressRow {
  id: number;
  customer_id: number;
  label: string | null;
  zip: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
  is_primary: boolean;
}

function mapAddress(row: AddressRow): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label,
    zip: row.zip,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    reference: row.reference,
    isPrimary: row.is_primary,
  };
}

export async function listAddresses(client: PoolClient, customerId: number): Promise<CustomerAddress[]> {
  const { rows } = await client.query(
    'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_primary DESC, id ASC',
    [customerId]
  );
  return rows.map(mapAddress);
}

export async function insertAddress(
  client: PoolClient,
  customerId: number,
  data: CreateCustomerAddressRequest
): Promise<CustomerAddress> {
  if (data.isPrimary) {
    await client.query('UPDATE customer_addresses SET is_primary = FALSE WHERE customer_id = $1', [
      customerId,
    ]);
  }
  const { rows } = await client.query(
    `INSERT INTO customer_addresses
      (customer_id, label, zip, street, number, complement, district, city, state, reference, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      customerId,
      data.label ?? null,
      data.zip ?? null,
      data.street,
      data.number ?? null,
      data.complement ?? null,
      data.district ?? null,
      data.city ?? null,
      data.state ?? null,
      data.reference ?? null,
      data.isPrimary ?? false,
    ]
  );
  return mapAddress(rows[0]);
}

export async function deleteAddress(client: PoolClient, customerId: number, addressId: number): Promise<void> {
  await client.query('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [
    addressId,
    customerId,
  ]);
}

// ---- Estatísticas (calculadas sobre vendas concluídas) ----

export async function getStats(client: PoolClient, customerId: number): Promise<CustomerStats> {
  const { rows: totals } = await client.query(
    `SELECT COUNT(*)::int AS purchases,
            COALESCE(SUM(total_cents), 0)::int AS spent,
            MAX(completed_at) AS last_purchase
     FROM sales WHERE customer_id = $1 AND status = 'concluida'`,
    [customerId]
  );
  const { rows: top } = await client.query(
    `SELECT si.product_name_snapshot AS name, SUM(si.quantity)::int AS quantity
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.customer_id = $1 AND s.status = 'concluida' AND si.canceled = FALSE
     GROUP BY si.product_name_snapshot
     ORDER BY quantity DESC
     LIMIT 5`,
    [customerId]
  );
  const purchases: number = totals[0].purchases;
  const spent: number = totals[0].spent;
  return {
    totalPurchases: purchases,
    totalSpentCents: spent,
    avgTicketCents: purchases > 0 ? Math.round(spent / purchases) : 0,
    lastPurchaseAt: totals[0].last_purchase,
    topProducts: top,
  };
}
