import type {
  CatalogProduct,
  CreatePublicOrderRequest,
  DeliveryCheckResult,
  PublicOrderStatus,
  PublicStoreInfo,
} from '@adega/shared';

// Cardápio público: sem token, caminhos próprios por slug.
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/public${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Erro ao carregar');
  }
  return res.json();
}

async function post<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Erro ao processar');
  }
  return res.json();
}

export const publicApi = {
  store: (slug: string) => get<PublicStoreInfo>(`/${slug}/store`),
  catalog: (slug: string) => get<CatalogProduct[]>(`/${slug}/catalog`),
  orderStatus: (slug: string, id: number) => get<PublicOrderStatus>(`/${slug}/orders/${id}/status`),
  deliveryCheck: (slug: string, district: string, subtotalCents?: number) =>
    post<DeliveryCheckResult>(`/${slug}/delivery-check`, { district, subtotalCents }),
  createOrder: async (slug: string, data: CreatePublicOrderRequest) => {
    const res = await fetch(`/api/public/${slug}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Não foi possível enviar o pedido');
    }
    return res.json() as Promise<{ id: number; totalCents: number }>;
  },
};
