// A conta do dono usa um token separado do token de operador do PDV — o dono
// pode estar logado na conta e no caixa ao mesmo tempo sem conflito.
const ACCOUNT_TOKEN_KEY = 'adega_account_token';

export function getAccountToken(): string | null {
  return localStorage.getItem(ACCOUNT_TOKEN_KEY);
}

export function setAccountToken(token: string | null) {
  if (token) localStorage.setItem(ACCOUNT_TOKEN_KEY, token);
  else localStorage.removeItem(ACCOUNT_TOKEN_KEY);
}

export interface AccountInfo {
  owner: { id: number; name: string; email: string };
  store: {
    slug: string;
    name: string;
    status: string;
    trialEndsAt: string;
    trialDaysLeft: number;
  };
}

export interface SignupRequest {
  ownerName: string;
  email: string;
  password: string;
  storeName: string;
  storeSlug: string;
  pin: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccountToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/account${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Erro na requisição');
  }
  return res.json();
}

export const accountApi = {
  signup: (data: SignupRequest) =>
    request<{ token: string; account: AccountInfo }>('/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; account: AccountInfo }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AccountInfo>('/me'),
};
