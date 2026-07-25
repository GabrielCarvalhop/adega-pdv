import type { OrderDetail } from '@adega/shared';
import { api } from './client';

export const ordersApi = {
  list: (statuses?: string[]) =>
    api.get<OrderDetail[]>(`/orders${statuses?.length ? `?status=${statuses.join(',')}` : ''}`),
  pendingCount: () => api.get<{ count: number }>('/orders/pending-count'),
  accept: (id: number) => api.post<OrderDetail>(`/orders/${id}/accept`),
  reject: (id: number, reason: string) => api.post<OrderDetail>(`/orders/${id}/reject`, { reason }),
  ready: (id: number) => api.post<OrderDetail>(`/orders/${id}/ready`),
  outForDelivery: (id: number) => api.post<OrderDetail>(`/orders/${id}/out-for-delivery`),
  conclude: (id: number, data: { cashSessionId?: number; paymentMethodId?: number }) =>
    api.post<OrderDetail>(`/orders/${id}/conclude`, data),
  cancel: (id: number, reason: string) => api.post<OrderDetail>(`/orders/${id}/cancel`, { reason }),
};
