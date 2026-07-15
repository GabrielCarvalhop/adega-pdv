import type {
  CashMovement,
  CashSession,
  CashSessionSummary,
  CloseCashSessionRequest,
  CreateCashMovementRequest,
  OpenCashSessionRequest,
} from '@adega/shared';
import { api } from './client';

export const cashApi = {
  openSessions: () => api.get<CashSession[]>('/cash/open-sessions'),
  history: () => api.get<CashSession[]>('/cash/history'),
  getById: (id: number) => api.get<CashSession>(`/cash/${id}`),
  getExpected: (id: number) => api.get<{ expectedAmountCents: number }>(`/cash/${id}/expected`),
  getMovements: (id: number) => api.get<CashMovement[]>(`/cash/${id}/movements`),
  getSummary: (id: number) => api.get<CashSessionSummary>(`/cash/${id}/summary`),
  reopen: (id: number, reason: string) => api.post<CashSession>(`/cash/${id}/reopen`, { reason }),
  open: (data: OpenCashSessionRequest) => api.post<CashSession>('/cash/open', data),
  addMovement: (id: number, data: CreateCashMovementRequest) =>
    api.post<CashMovement>(`/cash/${id}/movements`, data),
  close: (id: number, data: CloseCashSessionRequest) =>
    api.post<CashSession>(`/cash/${id}/close`, data),
};
