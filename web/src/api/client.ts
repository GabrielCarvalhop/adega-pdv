export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const TOKEN_KEY = 'adega_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Callback disparado quando o servidor rejeita o token (401) — usado para
// deslogar o usuário e voltar à tela de login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Callback disparado quando a assinatura da loja está pendente (402) —
// usado para exibir o aviso de regularização.
let onSubscriptionBlocked: (() => void) | null = null;
export function setSubscriptionBlockedHandler(handler: () => void) {
  onSubscriptionBlocked = handler;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    // fetch rejeita (TypeError) em falha de rede/DNS/servidor fora do ar —
    // sistema é 100% online, então falha fechado com mensagem clara em vez
    // de deixar o operador achar que a ação foi concluída. status 0 permite
    // distinguir de erros HTTP reais se algum chamador precisar.
    throw new ApiError('Sem conexão com o servidor — verifique sua internet e tente novamente', 0);
  }

  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    onUnauthorized?.();
  }

  if (res.status === 402) {
    onSubscriptionBlocked?.();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Erro na requisição', res.status, body.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
