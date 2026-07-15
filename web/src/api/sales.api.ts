import type { CreateSaleRequest, Payment, Sale, SaleItem } from '@adega/shared';
import { api } from './client';

export interface SaleDetail {
  sale: Sale;
  items: SaleItem[];
  payments: Payment[];
}

export const salesApi = {
  list: (query: { from?: string; to?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    return api.get<Sale[]>(`/sales${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) => api.get<SaleDetail>(`/sales/${id}`),
  create: (data: CreateSaleRequest) => api.post<SaleDetail>('/sales', data),
  cancel: (id: number, reason: string) => api.post<SaleDetail>(`/sales/${id}/cancel`, { reason }),
  cancelItem: (id: number, itemId: number, reason: string) =>
    api.post<SaleDetail>(`/sales/${id}/items/${itemId}/cancel`, { reason }),
};
