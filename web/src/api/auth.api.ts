import type {
  AuthUser,
  CreateUserRequest,
  SuperAdminLoginRequest,
  UpdateUserRequest,
  User,
  UserRole,
} from '@adega/shared';
import { api } from './client';

export interface LoginUser {
  id: number;
  name: string;
  role: 'ADMIN_LOJA' | 'FUNCIONARIO' | 'GERENTE';
}

export interface SessionUser {
  id: number;
  name: string;
  role: UserRole;
  /** null só para SUPER_ADMIN que ainda não "entrou" em nenhuma loja. */
  tenantId: number | null;
  storeName: string | null;
  mustChangePin: boolean;
}

export const authApi = {
  listLoginUsers: (slug: string) =>
    api.get<LoginUser[]>(`/t/${encodeURIComponent(slug)}/auth/users`),
  login: (slug: string, userId: number, pin: string) =>
    api.post<AuthUser>(`/t/${encodeURIComponent(slug)}/auth/login`, { userId, pin }),
  superAdminLogin: (data: SuperAdminLoginRequest) => api.post<AuthUser>('/auth/super-admin-login', data),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<SessionUser>('/auth/me'),
  changePin: (pin: string) => api.post<void>('/auth/change-pin', { pin }),
};

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  create: (data: CreateUserRequest) => api.post<User>('/users', data),
  update: (id: number, data: UpdateUserRequest) => api.put<User>(`/users/${id}`, data),
};
