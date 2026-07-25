import type { CreatePaymentMethodRequest, PaymentMethodConfig, UpdatePaymentMethodRequest } from '@adega/shared';
import { api } from './client';

export const paymentMethodsApi = {
  list: () => api.get<PaymentMethodConfig[]>('/payment-methods'),
  create: (data: CreatePaymentMethodRequest) => api.post<PaymentMethodConfig>('/payment-methods', data),
  update: (id: number, data: UpdatePaymentMethodRequest) =>
    api.put<PaymentMethodConfig>(`/payment-methods/${id}`, data),
};
