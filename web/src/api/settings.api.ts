import type { StoreSettings, UpdateStoreSettingsRequest } from '@adega/shared';
import { api } from './client';

export const settingsApi = {
  get: () => api.get<StoreSettings>('/settings'),
  update: (data: UpdateStoreSettingsRequest) => api.put<StoreSettings>('/settings', data),
};
