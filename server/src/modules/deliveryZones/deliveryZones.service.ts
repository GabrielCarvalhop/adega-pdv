import type { CreateDeliveryZoneRequest, DeliveryCheckResult, UpdateDeliveryZoneRequest } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import * as settingsService from '../settings/settings.service';
import * as repo from './deliveryZones.repository';

export function listAll(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listAll(client));
}

export function create(tenantId: number, data: CreateDeliveryZoneRequest) {
  if (!data.value.trim()) throw new AppError('Informe o bairro ou CEP');
  return withTenantTransaction(tenantId, async (client) => {
    try {
      return await repo.create(client, data);
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        throw new AppError('Já existe uma zona cadastrada com este valor', 409);
      }
      throw err;
    }
  });
}

export function update(tenantId: number, id: number, data: UpdateDeliveryZoneRequest) {
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.update(client, id, data);
    if (!updated) throw new AppError('Zona não encontrada', 404);
    return updated;
  });
}

export function remove(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, (client) => repo.remove(client, id));
}

/**
 * Valida um bairro/CEP contra o modo de zona configurado. baseFeeCents é a
 * taxa padrão da loja (aplicada quando nenhuma zona sobrepõe). subtotalCents,
 * quando informado, zera a taxa se a loja tiver entrega grátis configurada
 * acima de um valor (o bloqueio de área continua valendo mesmo assim).
 */
export async function checkDelivery(
  client: PoolClient,
  district: string | undefined,
  baseFeeCents: number,
  subtotalCents?: number
): Promise<DeliveryCheckResult> {
  const settings = await settingsService.loadSettings(client);
  const freeDelivery =
    settings.freeDeliveryAboveCents > 0 &&
    subtotalCents !== undefined &&
    subtotalCents >= settings.freeDeliveryAboveCents;

  if (settings.deliveryZoneMode === 'off') {
    return { allowed: true, feeCents: freeDelivery ? 0 : baseFeeCents };
  }
  const type = settings.deliveryZoneMode === 'cep' ? 'cep_prefix' : 'bairro';
  if (!district?.trim()) {
    return {
      allowed: false,
      reason: type === 'cep_prefix' ? 'Informe o CEP para calcular a entrega' : 'Informe o bairro para calcular a entrega',
      feeCents: baseFeeCents,
    };
  }
  const zone = await repo.matchZone(client, type, district);
  if (zone?.blocked) {
    return { allowed: false, reason: 'Não entregamos nessa região no momento', feeCents: baseFeeCents };
  }
  return { allowed: true, feeCents: freeDelivery ? 0 : zone?.feeCents ?? baseFeeCents };
}
