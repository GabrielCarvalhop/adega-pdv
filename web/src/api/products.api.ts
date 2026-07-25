import type {
  AddonGroupWithOptions,
  ComboItem,
  CreateComboItemRequest,
  CreateProductRequest,
  CreateQuantityDiscountRequest,
  Product,
  ProductAddonGroupLink,
  QuantityDiscountTier,
  UpdateProductRequest,
  UpdateQuantityDiscountRequest,
} from '@adega/shared';
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
  listQuantityDiscounts: (id: number) =>
    api.get<QuantityDiscountTier[]>(`/products/${id}/quantity-discounts`),
  createQuantityDiscount: (id: number, data: CreateQuantityDiscountRequest) =>
    api.post<QuantityDiscountTier>(`/products/${id}/quantity-discounts`, data),
  updateQuantityDiscount: (tierId: number, data: UpdateQuantityDiscountRequest) =>
    api.put<QuantityDiscountTier>(`/products/quantity-discounts/${tierId}`, data),
  removeQuantityDiscount: (tierId: number) =>
    api.delete<void>(`/products/quantity-discounts/${tierId}`),
  reorder: (ids: number[]) => api.put<void>('/products/reorder', { ids }),
  listAddonGroups: (id: number) => api.get<ProductAddonGroupLink[]>(`/products/${id}/addon-groups`),
  listAvailableAddons: (id: number) => api.get<AddonGroupWithOptions[]>(`/products/${id}/available-addons`),
  linkAddonGroup: (id: number, addonGroupId: number) =>
    api.post<ProductAddonGroupLink>(`/products/${id}/addon-groups`, { addonGroupId }),
  unlinkAddonGroup: (id: number, addonGroupId: number) =>
    api.delete<void>(`/products/${id}/addon-groups/${addonGroupId}`),
  listComboItems: (id: number) => api.get<ComboItem[]>(`/products/${id}/combo-items`),
  replaceComboItems: (id: number, items: CreateComboItemRequest[]) =>
    api.put<ComboItem[]>(`/products/${id}/combo-items`, { items }),
};
