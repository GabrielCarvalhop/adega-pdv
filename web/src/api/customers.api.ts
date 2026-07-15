import type {
  CreateCustomerAddressRequest,
  CreateCustomerRequest,
  Customer,
  CustomerAddress,
  CustomerStats,
  UpdateCustomerRequest,
} from '@adega/shared';
import { api, getToken } from './client';

export const customersApi = {
  list: (search?: string) =>
    api.get<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getById: (id: number) => api.get<Customer>(`/customers/${id}`),
  getStats: (id: number) => api.get<CustomerStats>(`/customers/${id}/stats`),
  findByPhone: (phone: string) =>
    api.get<Customer | null>(`/customers/by-phone/${encodeURIComponent(phone)}`),
  listAddresses: (id: number) => api.get<CustomerAddress[]>(`/customers/${id}/addresses`),
  addAddress: (id: number, data: CreateCustomerAddressRequest) =>
    api.post<CustomerAddress>(`/customers/${id}/addresses`, data),
  removeAddress: (id: number, addressId: number) =>
    api.delete<void>(`/customers/${id}/addresses/${addressId}`),
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
