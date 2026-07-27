import type {
  AddLedgerAdjustmentRequest,
  AddLedgerCreditRequest,
  AddLedgerPaymentRequest,
  CreateCustomerAddressRequest,
  CreateCustomerRequest,
  Customer,
  CustomerAddress,
  CustomerLedgerEntry,
  CustomerStats,
  UpdateCustomerRequest,
} from '@adega/shared';
import { api, getToken } from './client';

export const customersApi = {
  list: (search?: string) =>
    api.get<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  // Sem o total gasto (agregação sobre todo o histórico de vendas) — usado
  // onde só se precisa do nome/saldo pra um seletor, ex.: tela de venda.
  listLite: () => api.get<Customer[]>('/customers?lite=1'),
  getById: (id: number) => api.get<Customer>(`/customers/${id}`),
  getStats: (id: number) => api.get<CustomerStats>(`/customers/${id}/stats`),
  findByPhone: (phone: string) =>
    api.get<Customer | null>(`/customers/by-phone/${encodeURIComponent(phone)}`),
  listAddresses: (id: number) => api.get<CustomerAddress[]>(`/customers/${id}/addresses`),
  addAddress: (id: number, data: CreateCustomerAddressRequest) =>
    api.post<CustomerAddress>(`/customers/${id}/addresses`, data),
  removeAddress: (id: number, addressId: number) =>
    api.delete<void>(`/customers/${id}/addresses/${addressId}`),
  getLedger: (id: number) => api.get<CustomerLedgerEntry[]>(`/customers/${id}/ledger`),
  addLedgerPayment: (id: number, data: AddLedgerPaymentRequest) =>
    api.post<CustomerLedgerEntry>(`/customers/${id}/ledger/payment`, data),
  addLedgerCredit: (id: number, data: AddLedgerCreditRequest) =>
    api.post<CustomerLedgerEntry>(`/customers/${id}/ledger/credit`, data),
  addLedgerAdjustment: (id: number, data: AddLedgerAdjustmentRequest) =>
    api.post<CustomerLedgerEntry>(`/customers/${id}/ledger/adjustment`, data),
  create: (data: CreateCustomerRequest) => api.post<Customer>('/customers', data),
  update: (id: number, data: UpdateCustomerRequest) => api.put<Customer>(`/customers/${id}`, data),
  remove: (id: number) => api.delete<void>(`/customers/${id}`),
  exportCsv: async () => {
    const res = await fetch('/api/customers/export.csv', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Sem permissão para exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
