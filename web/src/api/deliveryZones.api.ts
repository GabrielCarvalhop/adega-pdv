import type { CreateDeliveryZoneRequest, DeliveryZone, UpdateDeliveryZoneRequest } from '@adega/shared';
import { api } from './client';

export const deliveryZonesApi = {
  list: () => api.get<DeliveryZone[]>('/delivery-zones'),
  create: (data: CreateDeliveryZoneRequest) => api.post<DeliveryZone>('/delivery-zones', data),
  update: (id: number, data: UpdateDeliveryZoneRequest) =>
    api.put<DeliveryZone>(`/delivery-zones/${id}`, data),
  remove: (id: number) => api.delete<void>(`/delivery-zones/${id}`),
};
