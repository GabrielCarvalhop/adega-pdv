import type {
  AuthUser,
  CreateUserRequest,
  UpdateUserRequest,
  User,
} from '@adega/shared';
import { api } from './client';

export interface LoginUser {
  id: number;
  name: string;
  role: 'admin' | 'operador';
}

export const authApi = {
  listLoginUsers: (slug: string) =>
    api.get<LoginUser[]>(`/t/${encodeURIComponent(slug)}/auth/users`),
  login: (slug: string, userId: number, pin: string) =>
    api.post<AuthUser>(`/t/${encodeURIComponent(slug)}/auth/login`, { userId, pin }),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
};

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  create: (data: CreateUserRequest) => api.post<User>('/users', data),
  update: (id: number, data: UpdateUserRequest) => api.put<User>(`/users/${id}`, data),
};
