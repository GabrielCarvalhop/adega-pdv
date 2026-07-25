import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import { logAction } from '../audit/audit.service';
import * as customersRepo from './customers.repository';
import * as repo from './ledger.repository';

async function requireCustomer(client: PoolClient, id: number) {
  const customer = await customersRepo.findById(client, id);
  if (!customer) throw new AppError('Cliente não encontrado', 404);
  return customer;
}

export function getLedger(tenantId: number, customerId: number) {
  return withTenantTransaction(tenantId, async (client) => {
    await requireCustomer(client, customerId);
    return repo.listByCustomer(client, customerId);
  });
}

export function addPayment(
  tenantId: number,
  customerId: number,
  amountCents: number,
  notes: string | undefined,
  userId: number | null
) {
  if (amountCents <= 0) throw new AppError('Valor deve ser positivo');
  return withTenantTransaction(tenantId, async (client) => {
    await requireCustomer(client, customerId);
    const entry = await repo.addEntry(client, {
      customerId,
      type: 'pagamento',
      amountCents,
      notes: notes?.trim() || null,
      userId,
    });
    await logAction(client, userId, 'cliente.pagamento', 'customer', customerId, {
      amountCents,
      balanceAfterCents: entry.balanceAfterCents,
    });
    return entry;
  });
}

export function addCredit(
  tenantId: number,
  customerId: number,
  amountCents: number,
  notes: string | undefined,
  userId: number | null
) {
  if (amountCents <= 0) throw new AppError('Valor deve ser positivo');
  return withTenantTransaction(tenantId, async (client) => {
    await requireCustomer(client, customerId);
    const entry = await repo.addEntry(client, {
      customerId,
      type: 'credito_adicionado',
      amountCents,
      notes: notes?.trim() || null,
      userId,
    });
    await logAction(client, userId, 'cliente.credito', 'customer', customerId, {
      amountCents,
      balanceAfterCents: entry.balanceAfterCents,
    });
    return entry;
  });
}

export function addAdjustment(
  tenantId: number,
  customerId: number,
  amountCents: number,
  notes: string,
  userId: number | null
) {
  if (amountCents === 0) throw new AppError('Valor do ajuste não pode ser zero');
  if (!notes.trim()) throw new AppError('Ajuste de saldo exige justificativa');
  return withTenantTransaction(tenantId, async (client) => {
    await requireCustomer(client, customerId);
    const entry = await repo.addEntry(client, {
      customerId,
      type: 'ajuste',
      amountCents,
      notes: notes.trim(),
      userId,
    });
    await logAction(client, userId, 'cliente.ajuste_saldo', 'customer', customerId, {
      amountCents,
      balanceAfterCents: entry.balanceAfterCents,
      notes: notes.trim(),
    });
    return entry;
  });
}
