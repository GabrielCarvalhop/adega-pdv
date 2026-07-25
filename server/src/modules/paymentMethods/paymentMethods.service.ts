import type { CreatePaymentMethodRequest, UpdatePaymentMethodRequest } from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import * as repo from './paymentMethods.repository';

export function listAll(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listAll(client));
}

export function create(tenantId: number, data: CreatePaymentMethodRequest) {
  const code = data.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  if (!code) throw new AppError('Código inválido');
  if (!data.label.trim()) throw new AppError('Nome é obrigatório');

  return withTenantTransaction(tenantId, async (client) => {
    try {
      return await repo.create(client, {
        code,
        label: data.label.trim(),
        kind: data.kind,
        icon: data.icon,
        allowsChange: data.allowsChange,
        creditsAccount: data.creditsAccount,
        retentionPercent: data.retentionPercent,
        settlementDays: data.settlementDays,
      });
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        throw new AppError('Já existe um meio de pagamento com este código', 409);
      }
      throw err;
    }
  });
}

export function update(tenantId: number, id: number, data: UpdatePaymentMethodRequest) {
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.update(client, id, data);
    if (!updated) throw new AppError('Meio de pagamento não encontrado', 404);
    return updated;
  });
}
