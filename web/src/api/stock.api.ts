import type { CreateStockMovementRequest, StockMovement } from '@adega/shared';
import { api } from './client';

export interface StockMovementQuery {
  productId?: number;
  type?: string;
  from?: string;
  to?: string;
}

function toQueryString(query: StockMovementQuery): string {
  const params = new URLSearchParams();
  if (query.productId !== undefined) params.set('productId', String(query.productId));
  if (query.type) params.set('type', query.type);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const stockApi = {
  listMovements: (query: StockMovementQuery = {}) =>
    api.get<StockMovement[]>(`/stock/movements${toQueryString(query)}`),
  createMovement: (data: CreateStockMovementRequest) =>
    api.post<StockMovement>('/stock/movements', data),
};
