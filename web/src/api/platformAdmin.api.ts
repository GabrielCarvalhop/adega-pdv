import type {
  CreateTenantRequest,
  CreateTenantResult,
  TenantStatus,
  TenantSummary,
} from '@adega/shared';
import { api } from './client';

export const platformAdminApi = {
  listTenants: () => api.get<TenantSummary[]>('/admin/lojas'),
  createTenant: (data: CreateTenantRequest) => api.post<CreateTenantResult>('/admin/lojas', data),
  updateStatus: (id: number, status: TenantStatus) =>
    api.put<void>(`/admin/lojas/${id}/status`, { status }),
  enterTenant: (id: number) => api.post<{ token: string }>(`/admin/lojas/${id}/entrar`, {}),
};
