import type { CreateSurchargeRuleRequest, UpdateSurchargeRuleRequest } from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import * as repo from './surchargeRules.repository';

export function listAll(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listAll(client));
}

export function create(tenantId: number, data: CreateSurchargeRuleRequest) {
  if (data.percent <= 0 || data.percent > 100) throw new AppError('Percentual inválido');
  return withTenantTransaction(tenantId, async (client) => {
    try {
      return await repo.create(client, data);
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        throw new AppError('Já existe uma regra para este tipo de venda e meio de pagamento', 409);
      }
      throw err;
    }
  });
}

export function update(tenantId: number, id: number, data: UpdateSurchargeRuleRequest) {
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.update(client, id, data);
    if (!updated) throw new AppError('Regra não encontrada', 404);
    return updated;
  });
}

export function remove(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, (client) => repo.remove(client, id));
}
