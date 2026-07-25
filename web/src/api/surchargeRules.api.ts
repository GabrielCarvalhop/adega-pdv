import type { CreateSurchargeRuleRequest, SurchargeRule, UpdateSurchargeRuleRequest } from '@adega/shared';
import { api } from './client';

export const surchargeRulesApi = {
  list: () => api.get<SurchargeRule[]>('/surcharge-rules'),
  create: (data: CreateSurchargeRuleRequest) => api.post<SurchargeRule>('/surcharge-rules', data),
  update: (id: number, data: UpdateSurchargeRuleRequest) =>
    api.put<SurchargeRule>(`/surcharge-rules/${id}`, data),
  remove: (id: number) => api.delete<void>(`/surcharge-rules/${id}`),
};
