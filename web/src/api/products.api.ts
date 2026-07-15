import type { CreateProductRequest, Product, UpdateProductRequest } from '@adega/shared';
import { api } from './client';

export interface ProductQuery {
  search?: string;
  category?: string;
  active?: boolean;
}

function toQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.active !== undefined) params.set('active', String(query.active));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const productsApi = {
  list: (query: ProductQuery = {}) => api.get<Product[]>(`/products${toQueryString(query)}`),
  lowStock: () => api.get<Product[]>('/products/low-stock'),
  getById: (id: number) => api.get<Product>(`/products/${id}`),
  getByBarcode: (barcode: string) => api.get<Product>(`/products/barcode/${barcode}`),
  create: (data: CreateProductRequest) => api.post<Product>('/products', data),
  update: (id: number, data: UpdateProductRequest) => api.put<Product>(`/products/${id}`, data),
  remove: (id: number) => api.delete<void>(`/products/${id}`),
};
