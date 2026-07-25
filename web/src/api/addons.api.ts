import type {
  AddonGroupWithOptions,
  AddonOption,
  CreateAddonGroupRequest,
  CreateAddonOptionRequest,
  UpdateAddonGroupRequest,
  UpdateAddonOptionRequest,
} from '@adega/shared';
import { api } from './client';

export const addonsApi = {
  list: () => api.get<AddonGroupWithOptions[]>('/addon-groups'),
  getById: (id: number) => api.get<AddonGroupWithOptions>(`/addon-groups/${id}`),
  create: (data: CreateAddonGroupRequest) => api.post<AddonGroupWithOptions>('/addon-groups', data),
  update: (id: number, data: UpdateAddonGroupRequest) =>
    api.put<AddonGroupWithOptions>(`/addon-groups/${id}`, data),
  createOption: (groupId: number, data: CreateAddonOptionRequest) =>
    api.post<AddonOption>(`/addon-groups/${groupId}/options`, data),
  updateOption: (optionId: number, data: UpdateAddonOptionRequest) =>
    api.put<AddonOption>(`/addon-groups/options/${optionId}`, data),
  removeOption: (optionId: number) => api.delete<void>(`/addon-groups/options/${optionId}`),
};
