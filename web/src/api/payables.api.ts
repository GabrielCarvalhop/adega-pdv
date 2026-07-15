import type { CreatePayableRequest, Payable, UpdatePayableRequest } from '@adega/shared';
import { api } from './client';

export interface PayableQuery {
  paid?: boolean;
  from?: string;
  to?: string;
}

function toQueryString(query: PayableQuery): string {
  const params = new URLSearchParams();
  if (query.paid !== undefined) params.set('paid', String(query.paid));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const payablesApi = {
  list: (query: PayableQuery = {}) => api.get<Payable[]>(`/payables${toQueryString(query)}`),
  create: (data: CreatePayableRequest) => api.post<Payable>('/payables', data),
  update: (id: number, data: UpdatePayableRequest) => api.put<Payable>(`/payables/${id}`, data),
  setPaid: (id: number, paid: boolean) => api.post<Payable>(`/payables/${id}/pay`, { paid }),
  remove: (id: number) => api.delete<void>(`/payables/${id}`),
};
