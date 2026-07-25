import type { CashSession, DailyConsolidated, ReconciliationReport } from '@adega/shared';
import { api } from './client';

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, string | number | undefined>)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface SalesByPeriod {
  period: string;
  saleCount: number;
  totalCents: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  totalQuantity: number;
  totalRevenueCents: number;
}

export interface MarginProduct {
  productId: number;
  name: string;
  totalQuantity: number;
  revenueCents: number;
  costCents: number;
  marginCents: number;
  marginPercent: number;
}

export interface MarginReport {
  products: MarginProduct[];
  totals: {
    revenueCents: number;
    costCents: number;
    marginCents: number;
    marginPercent: number;
  };
}

export const reportsApi = {
  sales: (query: DateRangeQuery & { groupBy?: 'hour' | 'day' | 'week' | 'month' }) =>
    api.get<SalesByPeriod[]>(`/reports/sales${toQueryString(query)}`),
  topProducts: (query: DateRangeQuery & { limit?: number }) =>
    api.get<TopProduct[]>(`/reports/top-products${toQueryString(query)}`),
  margin: (query: DateRangeQuery) => api.get<MarginReport>(`/reports/margin${toQueryString(query)}`),
  cashHistory: (query: DateRangeQuery) => api.get<CashSession[]>(`/reports/cash-history${toQueryString(query)}`),
  dailyConsolidated: (date: string) =>
    api.get<DailyConsolidated>(`/reports/daily-consolidated?date=${date}`),
  reconciliation: (query: DateRangeQuery & { cashSessionId?: number; paymentMethodId?: number }) =>
    api.get<ReconciliationReport>(`/reports/reconciliation${toQueryString(query)}`),
};
