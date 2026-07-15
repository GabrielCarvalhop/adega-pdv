import type { User } from '@adega/shared';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth.api';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client';

const SLUG_KEY = 'adega_slug';

export function getSavedSlug(): string | null {
  return localStorage.getItem(SLUG_KEY);
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (slug: string, userId: number, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(slug: string, userId: number, pin: string) {
    const { token, user: loggedUser } = await authApi.login(slug, userId, pin);
    setToken(token);
    localStorage.setItem(SLUG_KEY, slug);
    setUser(loggedUser);
  }

  function logout() {
    authApi.logout().catch(() => undefined);
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
