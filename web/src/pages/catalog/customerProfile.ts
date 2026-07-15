/** Perfil do cliente do cardápio — fica só neste aparelho (localStorage). */

export interface CatalogCustomerProfile {
  phone: string;
  name: string;
  address: string;
  /** Hash SHA-256 opcional; nunca guarda a senha em texto. */
  passwordHash: string | null;
  createdAt: string;
  updatedAt: string;
}

function profileKey(slug: string) {
  return `adega_catalog_customer_${slug}`;
}

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Máscara BR: (00) 90000-0000 */
export function formatPhoneMask(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidBrazilPhone(phone: string): boolean {
  const d = digitsOnly(phone);
  return d.length === 10 || d.length === 11;
}

export function loadCustomerProfile(slug: string): CatalogCustomerProfile | null {
  try {
    const raw = localStorage.getItem(profileKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCustomerProfile;
    if (!parsed?.phone || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCustomerProfile(
  slug: string,
  data: Omit<CatalogCustomerProfile, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
  }
): CatalogCustomerProfile {
  const existing = loadCustomerProfile(slug);
  const now = new Date().toISOString();
  const profile: CatalogCustomerProfile = {
    phone: digitsOnly(data.phone),
    name: data.name.trim(),
    address: data.address.trim(),
    passwordHash: data.passwordHash ?? null,
    createdAt: data.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };
  localStorage.setItem(profileKey(slug), JSON.stringify(profile));
  return profile;
}

export function clearCustomerProfile(slug: string) {
  localStorage.removeItem(profileKey(slug));
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null
): Promise<boolean> {
  if (!passwordHash) return true;
  const hash = await hashPassword(password);
  return hash === passwordHash;
}
