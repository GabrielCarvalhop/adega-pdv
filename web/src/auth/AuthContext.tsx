import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi, type SessionUser } from '../api/auth.api';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client';

const SLUG_KEY = 'adega_slug';

export function getSavedSlug(): string | null {
  return localStorage.getItem(SLUG_KEY);
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (slug: string, userId: number, pin: string) => Promise<void>;
  superAdminLogin: (email: string, password: string) => Promise<void>;
  /** Troca o token por um escopado à loja (SUPER_ADMIN "entrando" numa loja). */
  applyToken: (token: string, slug?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
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
    const { token } = await authApi.login(slug, userId, pin);
    setToken(token);
    localStorage.setItem(SLUG_KEY, slug);
    // Busca de novo via /me para incluir storeName (não vem no retorno do login).
    setUser(await authApi.me());
  }

  async function superAdminLogin(email: string, password: string) {
    const { token } = await authApi.superAdminLogin({ email, password });
    setToken(token);
    localStorage.removeItem(SLUG_KEY);
    setUser(await authApi.me());
  }

  async function applyToken(token: string, slug?: string) {
    setToken(token);
    // Sem isso, telas que montam links a partir do slug salvo (ex.: link do
    // cardápio em Configurações) ficam com "/c/null" quando o SUPER_ADMIN
    // entra numa loja pelo painel — o login normal salva o slug, esse fluxo
    // alternativo tinha ficado de fora.
    if (slug) localStorage.setItem(SLUG_KEY, slug);
    setUser(await authApi.me());
  }

  function logout() {
    authApi.logout().catch(() => undefined);
    setToken(null);
    setUser(null);
  }

  async function refresh() {
    setUser(await authApi.me());
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, superAdminLogin, applyToken, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
