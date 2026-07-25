import type { CreateAddonGroupRequest, CreateAddonOptionRequest, UpdateAddonGroupRequest, UpdateAddonOptionRequest } from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import { AppError } from '../../middlewares/errorHandler';
import * as repo from './addons.repository';

function validateGroupCardinality(minSelect: number, maxSelect: number) {
  if (minSelect < 0) throw new AppError('Mínimo de seleções não pode ser negativo');
  if (maxSelect < 1) throw new AppError('Máximo de seleções deve ser ao menos 1');
  if (maxSelect < minSelect) throw new AppError('Máximo de seleções não pode ser menor que o mínimo');
}

export function listGroups(tenantId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listGroupsWithOptions(client));
}

export function getGroup(tenantId: number, id: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const group = await repo.findGroupById(client, id);
    if (!group) throw new AppError('Grupo de complemento não encontrado', 404);
    const options = await repo.listOptions(client, id);
    return { ...group, options };
  });
}

export function createGroup(tenantId: number, data: CreateAddonGroupRequest) {
  validateGroupCardinality(data.minSelect, data.maxSelect);
  return withTenantTransaction(tenantId, (client) => repo.createGroup(client, data));
}

export function updateGroup(tenantId: number, id: number, data: UpdateAddonGroupRequest) {
  return withTenantTransaction(tenantId, async (client) => {
    const existing = await repo.findGroupById(client, id);
    if (!existing) throw new AppError('Grupo de complemento não encontrado', 404);
    const minSelect = data.minSelect ?? existing.minSelect;
    const maxSelect = data.maxSelect ?? existing.maxSelect;
    validateGroupCardinality(minSelect, maxSelect);
    const updated = await repo.updateGroup(client, id, data);
    if (!updated) throw new AppError('Grupo de complemento não encontrado', 404);
    return updated;
  });
}

export function listOptions(tenantId: number, groupId: number) {
  return withTenantTransaction(tenantId, (client) => repo.listOptions(client, groupId));
}

export function createOption(tenantId: number, groupId: number, data: CreateAddonOptionRequest) {
  if (data.extraPriceCents !== undefined && data.extraPriceCents < 0) {
    throw new AppError('Preço adicional não pode ser negativo');
  }
  return withTenantTransaction(tenantId, async (client) => {
    const group = await repo.findGroupById(client, groupId);
    if (!group) throw new AppError('Grupo de complemento não encontrado', 404);
    return repo.createOption(client, groupId, data);
  });
}

export function updateOption(tenantId: number, optionId: number, data: UpdateAddonOptionRequest) {
  if (data.extraPriceCents !== undefined && data.extraPriceCents < 0) {
    throw new AppError('Preço adicional não pode ser negativo');
  }
  return withTenantTransaction(tenantId, async (client) => {
    const updated = await repo.updateOption(client, optionId, data);
    if (!updated) throw new AppError('Opção de complemento não encontrada', 404);
    return updated;
  });
}

export function deleteOption(tenantId: number, optionId: number) {
  return withTenantTransaction(tenantId, async (client) => {
    const existing = await repo.findOptionById(client, optionId);
    if (!existing) throw new AppError('Opção de complemento não encontrada', 404);
    await repo.deleteOption(client, optionId);
  });
}
