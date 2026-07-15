import type {
  CatalogProduct,
  OrderFulfillment,
  PaymentMethod,
  ProductCategory,
  StoreSettings,
} from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../../api/public.api';
import { formatBRL } from '../../utils/money';
import { whatsappLink } from '../../utils/whatsapp';
import { CustomerAuthFlow } from './CustomerAuthFlow';
import {
  type CatalogCustomerProfile,
  formatPhoneMask,
  loadCustomerProfile,
} from './customerProfile';

interface CartItem {
  product: CatalogProduct;
  quantity: number;
}

interface SavedOrder {
  id: number;
  totalCents: number;
  createdAt: string;
}

type Tab = 'inicio' | 'pedidos';

const categoryLabels: Record<string, string> = {
  vinho: 'Vinhos',
  cerveja: 'Cervejas',
  destilado: 'Destilados',
  espumante: 'Espumantes',
  licor: 'Licores',
  outro: 'Outros',
};

/** Tiles de vitrine (home) — agrupam produtos por subtítulo/categoria no estilo A7. */
const showcaseTiles: { id: string; label: string; match: (p: CatalogProduct) => boolean }[] = [
  { id: 'cer-fardo', label: 'Cerveja 269ml · Fardos', match: (p) => p.category === 'cerveja' && (p.catalogSubtitle ?? '').includes('FARDO') },
  { id: 'cer-un', label: 'Cerveja · Unidade', match: (p) => p.category === 'cerveja' && !(p.catalogSubtitle ?? '').includes('FARDO') && !(p.catalogSubtitle ?? '').includes('LONG') },
  { id: 'cer-ln', label: 'Cerveja Long Neck', match: (p) => p.category === 'cerveja' && (p.catalogSubtitle ?? '').includes('LONG') },
  { id: 'whisky', label: 'Garrafas · Whisky', match: (p) => p.category === 'destilado' && (p.catalogSubtitle ?? '').includes('WHISKY') && !(p.catalogSubtitle ?? '').includes('DOSE') },
  { id: 'vodka', label: 'Garrafas · Vodka', match: (p) => p.category === 'destilado' && (p.catalogSubtitle ?? '').includes('VODKA') && !(p.catalogSubtitle ?? '').includes('DOSE') },
  { id: 'gin', label: 'Garrafas · Gin', match: (p) => p.category === 'destilado' && (p.catalogSubtitle ?? '').includes('GIN') && !(p.catalogSubtitle ?? '').includes('DOSE') },
  { id: 'cachaca', label: 'Cachaças', match: (p) => p.category === 'destilado' && (p.catalogSubtitle ?? '').includes('CACHAÇA') },
  { id: 'dose-w', label: 'Doses · Whisky', match: (p) => (p.catalogSubtitle ?? '') === 'DOSE' && p.name.includes('WHISKY') },
  { id: 'dose-v', label: 'Doses · Vodka', match: (p) => (p.catalogSubtitle ?? '') === 'DOSE' && p.name.includes('VODKA') },
  { id: 'dose-g', label: 'Doses · Gin', match: (p) => (p.catalogSubtitle ?? '') === 'DOSE' && p.name.includes('GIN') },
  { id: 'dose-l', label: 'Doses · Licor', match: (p) => p.category === 'licor' && (p.catalogSubtitle ?? '') === 'DOSE' },
  { id: 'vinho', label: 'Vinhos', match: (p) => p.category === 'vinho' },
  { id: 'espumante', label: 'Espumantes', match: (p) => p.category === 'espumante' },
  { id: 'licor', label: 'Licores', match: (p) => p.category === 'licor' && (p.catalogSubtitle ?? '') !== 'DOSE' },
  { id: 'refri', label: 'Refrigerantes', match: (p) => (p.catalogSubtitle ?? '').includes('REFRIGERANTE') },
  { id: 'energ', label: 'Energéticos', match: (p) => (p.catalogSubtitle ?? '').includes('ENERGÉTICO') },
  { id: 'agua', label: 'Água', match: (p) => (p.catalogSubtitle ?? '').includes('ÁGUA') },
  { id: 'gelo', label: 'Gelo', match: (p) => (p.catalogSubtitle ?? '').includes('GELO') },
  { id: 'salgado', label: 'Doces / Salgados', match: (p) => (p.catalogSubtitle ?? '').includes('SALGADO') },
  { id: 'combo', label: 'Combos', match: (p) => (p.catalogSubtitle ?? '').includes('COMBO') },
];

function ordersKey(slug: string) {
  return `adega_catalog_orders_${slug}`;
}

function loadSavedOrders(slug: string): SavedOrder[] {
  try {
    const raw = localStorage.getItem(ordersKey(slug));
    return raw ? (JSON.parse(raw) as SavedOrder[]) : [];
  } catch {
    return [];
  }
}

function saveOrder(slug: string, order: SavedOrder) {
  const list = loadSavedOrders(slug).filter((o) => o.id !== order.id);
  localStorage.setItem(ordersKey(slug), JSON.stringify([order, ...list].slice(0, 20)));
}

export function PublicCatalogPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<Tab>('inicio');
  const [promosOpen, setPromosOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [profile, setProfile] = useState<CatalogCustomerProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [tileFilter, setTileFilter] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<{ id: number; totalCents: number } | null>(null);
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);

  useEffect(() => {
    if (!slug) return;
    setSavedOrders(loadSavedOrders(slug));
    setProfile(loadCustomerProfile(slug));
  }, [slug]);

  function openCheckout() {
    if (!profile) {
      setPendingCheckout(true);
      setAuthOpen(true);
      return;
    }
    setCheckout(true);
  }

  const { data: store, isError: storeError } = useQuery({
    queryKey: ['public', 'store', slug],
    queryFn: () => publicApi.store(slug!),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: products } = useQuery({
    queryKey: ['public', 'catalog', slug],
    queryFn: () => publicApi.catalog(slug!),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const wa = store?.settings.whatsapp ? whatsappLink(store.settings.whatsapp) : null;

  const categories = useMemo(() => {
    const set = new Set((products ?? []).map((p) => p.category));
    return [...set] as ProductCategory[];
  }, [products]);

  const browsing = Boolean(search.trim()) || category !== 'all' || Boolean(tileFilter);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tile = tileFilter ? showcaseTiles.find((t) => t.id === tileFilter) : null;
    return (products ?? []).filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (tile && !tile.match(p)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.catalogSubtitle?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, search, category, tileFilter]);

  const highlights = useMemo(() => {
    return [...(products ?? [])]
      .filter((p) => p.available)
      .sort((a, b) => b.salePriceCents - a.salePriceCents)
      .slice(0, 4);
  }, [products]);

  const promotions = useMemo(() => {
    return (products ?? []).filter(
      (p) =>
        p.compareAtPriceCents != null &&
        p.compareAtPriceCents > p.salePriceCents &&
        p.available
    );
  }, [products]);

  const activeTiles = useMemo(() => {
    const list = products ?? [];
    return showcaseTiles.filter((t) => list.some(t.match));
  }, [products]);

  function add(product: CatalogProduct) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  function clearFilters() {
    setSearch('');
    setCategory('all');
    setTileFilter(null);
  }

  const subtotalCents = cart.reduce((s, c) => s + c.product.salePriceCents * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  if (storeError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
        <p className="text-neutral-500">Cardápio indisponível — confira o endereço da loja.</p>
      </div>
    );
  }

  if (placedOrder) {
    return (
      <OrderStatusScreen
        slug={slug!}
        order={placedOrder}
        wa={wa}
        onBack={() => {
          setPlacedOrder(null);
          setTab('pedidos');
          setSavedOrders(loadSavedOrders(slug!));
        }}
        onHome={() => {
          setPlacedOrder(null);
          setTab('inicio');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-neutral-900">
      <header className="sticky top-0 z-40 bg-black text-white">
        <nav className="mx-auto flex max-w-6xl items-stretch justify-center gap-1 px-2 py-1.5 sm:gap-2 sm:py-2">
          <NavItem
            active={tab === 'inicio' && !promosOpen}
            label="Início"
            onClick={() => {
              setTab('inicio');
              setPromosOpen(false);
              clearFilters();
            }}
          />
          <NavItem
            active={promosOpen}
            label="Promoções"
            onClick={() => {
              setTab('inicio');
              setPromosOpen(true);
            }}
          />
          <NavItem
            active={tab === 'pedidos' && !promosOpen && !authOpen}
            label="Pedidos"
            onClick={() => {
              setPromosOpen(false);
              setAuthOpen(false);
              setTab('pedidos');
            }}
          />
          <NavItem
            active={authOpen}
            label={profile ? 'Minha conta' : 'Entrar'}
            onClick={() => {
              setPromosOpen(false);
              setTab('inicio');
              setAuthOpen(true);
            }}
          />
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className={`flex min-w-[4.5rem] items-center justify-center rounded-lg px-4 py-2.5 text-xs font-medium sm:min-w-[6rem] sm:text-sm ${
                'text-white/90 hover:bg-white/10'
              }`}
            >
              WhatsApp
            </a>
          )}
        </nav>
      </header>

      {tab === 'inicio' ? (
        <>
          <div className="mx-auto grid max-w-6xl gap-5 px-3 py-4 lg:grid-cols-[1fr_300px] lg:gap-6 lg:px-4 lg:py-6">
            <div className="min-w-0 space-y-5 pb-28 lg:pb-6">
              <div className="relative">
                <Banner settings={store?.settings} storeName={store?.storeName} />
                <StoreHeader
                  storeName={store?.storeName}
                  settings={store?.settings}
                  className="-mt-8 sm:-mt-10"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setTileFilter(null);
                  }}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm shadow-sm sm:w-52"
                >
                  <option value="all">Lista de categorias</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabels[c] ?? c}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (e.target.value.trim()) setTileFilter(null);
                    }}
                    placeholder="Busque por um produto"
                    className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm"
                  />
                </div>
              </div>

              {browsing ? (
                <ProductBrowse
                  products={filtered}
                  cart={cart}
                  tileLabel={showcaseTiles.find((t) => t.id === tileFilter)?.label}
                  onBack={clearFilters}
                  onAdd={add}
                  onChangeQty={changeQty}
                />
              ) : (
                <>
                  {highlights.length > 0 && (
                    <section>
                      <h2 className="mb-3 text-base font-bold text-neutral-800">Destaques</h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {highlights.map((p) => (
                          <HighlightCard
                            key={p.id}
                            product={p}
                            inCart={cart.find((c) => c.product.id === p.id)}
                            onAdd={() => add(p)}
                            onChangeQty={(d) => changeQty(p.id, d)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {activeTiles.length > 0 && (
                    <section>
                      <h2 className="mb-3 text-base font-bold text-neutral-800">Categorias</h2>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {activeTiles.map((tile) => (
                          <button
                            key={tile.id}
                            type="button"
                            onClick={() => {
                              setTileFilter(tile.id);
                              setCategory('all');
                              setSearch('');
                            }}
                            className="group overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-neutral-200 transition hover:ring-neutral-400"
                          >
                            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 p-4">
                              <span className="text-center text-sm font-semibold uppercase tracking-wide text-orange-400 group-hover:text-orange-300">
                                {tile.label.split('·')[0]?.trim() ?? tile.label}
                              </span>
                            </div>
                            <p className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase leading-tight text-neutral-800 sm:text-xs">
                              {tile.label}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {(!products || products.length === 0) && (
                    <p className="py-12 text-center text-neutral-400">Nenhum produto no cardápio ainda.</p>
                  )}
                </>
              )}
            </div>

            <aside className="hidden lg:block">
              <CartPanel
                cart={cart}
                settings={store?.settings}
                subtotalCents={subtotalCents}
                onChangeQty={changeQty}
                onCheckout={openCheckout}
              />
            </aside>
          </div>

          <footer className="mt-4 border-t border-neutral-800 bg-black px-4 py-6 text-center text-xs text-white/70">
            <p className="font-medium text-white/90">
              {(store?.storeName ?? 'Adega').toUpperCase()} — cardápio online
            </p>
            {store?.settings.addressText && <p className="mt-1">{store.settings.addressText}</p>}
            {store?.settings.cityText && <p>{store.settings.cityText}</p>}
          </footer>
        </>
      ) : (
        <OrdersTab
          slug={slug!}
          orders={savedOrders}
          onOpen={(order) => setPlacedOrder({ id: order.id, totalCents: order.totalCents })}
        />
      )}

      {authOpen && slug && (
        <CustomerAuthFlow
          slug={slug}
          profile={profile}
          onClose={() => {
            setAuthOpen(false);
            setPendingCheckout(false);
          }}
          onProfileChange={(next) => {
            setProfile(next);
            if (next && pendingCheckout) {
              setPendingCheckout(false);
              setAuthOpen(false);
              setCheckout(true);
            }
          }}
        />
      )}

      {promosOpen && (
        <PromotionsModal
          products={promotions}
          cart={cart}
          onClose={() => setPromosOpen(false)}
          onAdd={add}
          onChangeQty={changeQty}
        />
      )}

      {tab === 'inicio' && cart.length > 0 && !checkout && !promosOpen && !authOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white p-3 lg:hidden">
          <button
            type="button"
            onClick={openCheckout}
            className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-3.5 text-white"
          >
            <span className="text-sm font-medium">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
            <span className="font-semibold">Ver sacola · {formatBRL(subtotalCents)}</span>
          </button>
        </div>
      )}

      {checkout && store && (
        <CheckoutSheet
          slug={slug!}
          cart={cart}
          settings={store.settings}
          profile={profile}
          subtotalCents={subtotalCents}
          onClose={() => setCheckout(false)}
          onChangeQty={changeQty}
          onPlaced={(order) => {
            const saved: SavedOrder = {
              id: order.id,
              totalCents: order.totalCents,
              createdAt: new Date().toISOString(),
            };
            saveOrder(slug!, saved);
            setSavedOrders(loadSavedOrders(slug!));
            setPlacedOrder(order);
            setCart([]);
            setCheckout(false);
          }}
        />
      )}
    </div>
  );
}

function NavItem({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-[4.5rem] items-center justify-center rounded-lg px-4 py-2.5 text-xs font-medium sm:min-w-[6rem] sm:text-sm ${
        active ? 'bg-neutral-200 text-black' : 'text-white/90 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function ProductThumb({
  product,
  className = 'h-20 w-20',
}: {
  product: Pick<CatalogProduct, 'imageUrl' | 'catalogSubtitle' | 'category'>;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(product.imageUrl) && !broken;

  return (
    <div className={`shrink-0 overflow-hidden rounded-xl bg-neutral-50 ${className}`}>
      {showImg ? (
        <img
          src={product.imageUrl!}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-orange-950 px-2 text-center text-[10px] font-bold uppercase leading-tight text-orange-400">
          {product.catalogSubtitle || product.category}
        </div>
      )}
    </div>
  );
}

function discountPercent(sale: number, compareAt: number) {
  return Math.max(1, Math.round(((compareAt - sale) / compareAt) * 100));
}

function PromotionsModal({
  products,
  cart,
  onClose,
  onAdd,
  onChangeQty,
}: {
  products: CatalogProduct[];
  cart: CartItem[];
  onClose: () => void;
  onAdd: (p: CatalogProduct) => void;
  onChangeQty: (id: number, delta: number) => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar promoções"
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promos-title"
        className="relative z-10 mt-14 flex max-h-[min(85vh,720px)] w-[min(100%-1.5rem,920px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 id="promos-title" className="text-lg font-bold text-neutral-900">
            Promoções
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-xl leading-none text-neutral-600 hover:bg-neutral-200"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {products.length === 0 ? (
            <p className="py-16 text-center text-neutral-400">
              Nenhuma promoção ativa no momento.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const inCart = cart.find((c) => c.product.id === p.id);
                const compareAt = p.compareAtPriceCents!;
                const pct = discountPercent(p.salePriceCents, compareAt);
                return (
                  <article
                    key={p.id}
                    className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                  >
                    <div className="relative">
                      <ProductThumb product={p} className="h-24 w-20 rounded-lg" />
                      <span className="absolute left-1 top-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        -{pct}%
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="line-clamp-2 text-sm font-bold uppercase leading-snug text-neutral-900">
                        {p.name}
                      </p>
                      {(p.catalogSubtitle || p.brand) && (
                        <p className="truncate text-xs text-neutral-500">
                          {p.catalogSubtitle || p.brand}
                        </p>
                      )}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div>
                          <p className="text-base font-bold text-emerald-600">
                            {formatBRL(p.salePriceCents)}
                          </p>
                          <p className="text-xs text-neutral-400 line-through">
                            {formatBRL(compareAt)}
                          </p>
                        </div>
                        {inCart ? (
                          <QtyControl qty={inCart.quantity} onChange={(d) => onChangeQty(p.id, d)} />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAdd(p)}
                            className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold uppercase text-white"
                          >
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Banner({
  settings,
  storeName,
}: {
  settings?: StoreSettings;
  storeName?: string;
}) {
  if (settings?.catalogBannerUrl) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black">
        <img
          src={settings.catalogBannerUrl}
          alt=""
          className="max-h-52 w-full object-cover sm:max-h-64"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-neutral-950 sm:h-52">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-600/30 via-transparent to-transparent" />
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: 'linear-gradient(110deg, transparent 40%, rgba(255,140,0,0.15) 50%, transparent 60%)',
      }} />
      <p
        className="relative px-4 text-center text-3xl font-black uppercase tracking-[0.12em] text-transparent sm:text-5xl"
        style={{
          backgroundImage: 'linear-gradient(180deg, #ffb347 0%, #ff8c00 45%, #e65c00 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          textShadow: '0 0 40px rgba(255,140,0,0.35)',
        }}
      >
        {storeName ?? 'Cardápio'}
      </p>
    </div>
  );
}

function StoreHeader({
  storeName,
  settings,
  className = '',
}: {
  storeName?: string;
  settings?: StoreSettings;
  className?: string;
}) {
  return (
    <section
      className={`relative z-10 mx-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-md ring-1 ring-black/5 sm:mx-4 ${className}`}
    >
      {settings?.catalogLogoUrl ? (
        <img
          src={settings.catalogLogoUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-contain bg-black sm:h-16 sm:w-16"
          loading="lazy"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black text-lg font-black text-orange-400 sm:h-16 sm:w-16">
          {(storeName ?? 'AD').slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold uppercase tracking-wide text-neutral-900 sm:text-xl">
          {storeName ?? '...'}
        </h1>
        <p className="truncate text-xs text-emerald-600 sm:text-sm">
          {settings?.openingHoursText || 'Horário sob consulta'}
        </p>
        {settings?.cityText && (
          <p className="truncate text-xs text-neutral-500">{settings.cityText}</p>
        )}
      </div>
    </section>
  );
}

function HighlightCard({
  product,
  inCart,
  onAdd,
  onChangeQty,
}: {
  product: CatalogProduct;
  inCart?: CartItem;
  onAdd: () => void;
  onChangeQty: (delta: number) => void;
}) {
  return (
    <article className="flex gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200">
      <ProductThumb product={product} className="h-28 w-24 sm:h-32 sm:w-28" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 text-sm font-bold uppercase leading-snug text-neutral-900">
          {product.name}
        </p>
        {(product.catalogSubtitle || product.brand) && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {product.catalogSubtitle || product.brand}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="text-lg font-bold text-emerald-600">{formatBRL(product.salePriceCents)}</p>
          {product.available ? (
            inCart ? (
              <QtyControl qty={inCart.quantity} onChange={onChangeQty} />
            ) : (
              <button
                type="button"
                onClick={onAdd}
                className="rounded-lg bg-black px-3 py-2 text-xs font-semibold uppercase text-white"
              >
                Adicionar
              </button>
            )
          ) : (
            <span className="text-xs font-medium text-red-500">Esgotado</span>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductBrowse({
  products,
  cart,
  tileLabel,
  onBack,
  onAdd,
  onChangeQty,
}: {
  products: CatalogProduct[];
  cart: CartItem[];
  tileLabel?: string;
  onBack: () => void;
  onAdd: (p: CatalogProduct) => void;
  onChangeQty: (id: number, delta: number) => void;
}) {
  const grouped = products.reduce<Record<string, CatalogProduct[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-neutral-800">
          {tileLabel ?? 'Produtos'}
        </h2>
        <button type="button" onClick={onBack} className="text-sm font-medium text-neutral-500 hover:text-black">
          ← Voltar
        </button>
      </div>

      {products.length === 0 && (
        <p className="py-10 text-center text-neutral-400">Nenhum produto encontrado.</p>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          {!tileLabel && (
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {categoryLabels[cat] ?? cat}
            </h3>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((p) => {
              const inCart = cart.find((c) => c.product.id === p.id);
              return (
                <article
                  key={p.id}
                  className="flex gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-200"
                >
                  <ProductThumb product={p} className="h-20 w-20 rounded-lg" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-bold uppercase leading-snug">{p.name}</p>
                    {(p.catalogSubtitle || p.brand) && (
                      <p className="truncate text-xs text-neutral-500">{p.catalogSubtitle || p.brand}</p>
                    )}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <p className="font-bold text-emerald-600">{formatBRL(p.salePriceCents)}</p>
                      {p.available ? (
                        inCart ? (
                          <QtyControl qty={inCart.quantity} onChange={(d) => onChangeQty(p.id, d)} />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAdd(p)}
                            className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold uppercase text-white"
                          >
                            Adicionar
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-red-500">Esgotado</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function QtyControl({ qty, onChange }: { qty: number; onChange: (delta: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold"
      >
        −
      </button>
      <span className="w-5 text-center text-sm font-semibold">{qty}</span>
      <button
        type="button"
        onClick={() => onChange(1)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-lg font-semibold text-white"
      >
        +
      </button>
    </div>
  );
}

function CartPanel({
  cart,
  settings,
  subtotalCents,
  onChangeQty,
  onCheckout,
}: {
  cart: CartItem[];
  settings?: StoreSettings;
  subtotalCents: number;
  onChangeQty: (id: number, delta: number) => void;
  onCheckout: () => void;
}) {
  const fee = settings?.deliveryFeeCents ?? 0;
  return (
    <div className="sticky top-16 flex min-h-[420px] flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      {fee > 0 && (
        <div className="mb-3 flex items-start justify-between gap-2 border-b border-neutral-100 pb-3 text-sm">
          <div>
            <p className="font-medium text-neutral-800">Entrega</p>
            <p className="text-xs text-neutral-500">Taxa calculada no checkout</p>
          </div>
          <p className="font-semibold text-neutral-800">{formatBRL(fee)}</p>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-neutral-400">
          <svg className="h-12 w-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 11H6L5 9z" />
          </svg>
          <p className="mt-3 text-sm">Sacola vazia</p>
        </div>
      ) : (
        <ul className="max-h-72 flex-1 space-y-3 overflow-y-auto">
          {cart.map((c) => (
            <li key={c.product.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium uppercase">{c.product.name}</p>
                <p className="text-neutral-500">
                  {c.quantity} × {formatBRL(c.product.salePriceCents)}
                </p>
              </div>
              <QtyControl qty={c.quantity} onChange={(d) => onChangeQty(c.product.id, d)} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={cart.length === 0}
        onClick={onCheckout}
        className="mt-4 w-full rounded-xl bg-black py-3.5 text-sm font-semibold uppercase tracking-wide text-white disabled:bg-neutral-300"
      >
        {cart.length === 0 ? 'Sacola vazia' : `Continuar · ${formatBRL(subtotalCents)}`}
      </button>
    </div>
  );
}

function OrdersTab({
  slug,
  orders,
  onOpen,
}: {
  slug: string;
  orders: SavedOrder[];
  onOpen: (order: SavedOrder) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4">
      <h1 className="mb-4 text-2xl font-bold">Seus pedidos</h1>
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-neutral-400 shadow-sm">
          Nenhum pedido neste aparelho ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} slug={slug} order={order} onOpen={() => onOpen(order)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({
  slug,
  order,
  onOpen,
}: {
  slug: string;
  order: SavedOrder;
  onOpen: () => void;
}) {
  const { data: status } = useQuery({
    queryKey: ['public', 'order-status', slug, order.id],
    queryFn: () => publicApi.orderStatus(slug, order.id),
    refetchInterval: 15000,
  });

  const label = statusLabel(status?.status ?? 'pendente');
  const date = new Date(order.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
        #
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Pedido Nº {order.id}</p>
        <p className="text-sm text-neutral-500">
          Feito em {date}
          {status ? ` · Tipo: ${status.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}` : ''}
        </p>
        <p className="text-sm font-medium">Total: {formatBRL(order.totalCents)}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {label}
        </p>
      </div>
      <span className="text-neutral-300">›</span>
    </button>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pendente: 'Aguardando confirmação',
    aceito: 'Pedido aceito',
    pronto: 'Pedido pronto',
    saiu_entrega: 'Saiu para entrega',
    concluido: 'Pedido concluído',
    recusado: 'Pedido recusado',
    cancelado: 'Pedido cancelado',
    expirado: 'Pedido expirado',
  };
  return map[status] ?? status;
}

function OrderStatusScreen({
  slug,
  order,
  wa,
  onBack,
  onHome,
}: {
  slug: string;
  order: { id: number; totalCents: number };
  wa: string | null;
  onBack: () => void;
  onHome: () => void;
}) {
  const { data: orderStatus } = useQuery({
    queryKey: ['public', 'order-status', slug, order.id],
    queryFn: () => publicApi.orderStatus(slug, order.id),
    refetchInterval: 10000,
  });
  const current = orderStatus?.status ?? 'pendente';
  const waWithText =
    wa &&
    `${wa}${wa.includes('?') ? '&' : '?'}text=${encodeURIComponent(`Olá! Sobre meu pedido #${order.id}.`)}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5]">
      <header className="bg-black px-4 py-3 text-white">
        <button type="button" onClick={onBack} className="text-sm text-white/80">
          ← Seus pedidos
        </button>
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="w-full rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Pedido #{order.id}</p>
          <p className="mt-2 text-xl font-bold">{statusLabel(current)}</p>
          <p className="mt-2 text-neutral-500">Total: {formatBRL(order.totalCents)}</p>
          <p className="mt-4 text-xs text-neutral-400">Esta página atualiza sozinha.</p>
          {waWithText && (
            <a
              href={waWithText}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block w-full rounded-xl border border-neutral-200 py-3 text-sm font-semibold"
            >
              Falar no WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={onHome}
            className="mt-3 w-full rounded-xl bg-black py-3 text-sm font-semibold uppercase text-white"
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>
    </div>
  );
}

function parseMoney(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function CheckoutSheet({
  slug,
  cart,
  settings,
  profile,
  subtotalCents,
  onClose,
  onChangeQty,
  onPlaced,
}: {
  slug: string;
  cart: CartItem[];
  settings: StoreSettings;
  profile: CatalogCustomerProfile | null;
  subtotalCents: number;
  onClose: () => void;
  onChangeQty: (id: number, delta: number) => void;
  onPlaced: (order: { id: number; totalCents: number }) => void;
}) {
  const defaultFulfillment: OrderFulfillment = settings.deliveryEnabled ? 'entrega' : 'retirada';
  const [fulfillment, setFulfillment] = useState<OrderFulfillment>(defaultFulfillment);
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile ? formatPhoneMask(profile.phone) : '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publicKey] = useState(() => crypto.randomUUID());

  const feeCents = fulfillment === 'entrega' ? settings.deliveryFeeCents : 0;
  const totalCents = subtotalCents + feeCents;
  const belowMinimum = settings.minOrderCents > 0 && subtotalCents < settings.minOrderCents;
  const wa = settings.whatsapp ? whatsappLink(settings.whatsapp) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (payment === 'dinheiro' && needsChange) {
      const changeCents = parseMoney(changeFor);
      if (changeCents < totalCents) {
        setError('O valor para troco deve ser maior ou igual ao total do pedido');
        return;
      }
    }
    setSubmitting(true);
    try {
      const order = await publicApi.createOrder(slug, {
        fulfillment,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethodIntent: payment,
        changeForCents:
          payment === 'dinheiro' && needsChange ? parseMoney(changeFor) : undefined,
        publicKey,
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      });
      onPlaced(order);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Finalizar pedido</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-neutral-400">
            ×
          </button>
        </div>

        <ul className="mb-4 space-y-2 border-b border-neutral-100 pb-4">
          {cart.map((c) => (
            <li key={c.product.id} className="flex items-center justify-between text-sm">
              <span className="truncate pr-2">
                {c.quantity}× {c.product.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatBRL(c.product.salePriceCents * c.quantity)}</span>
                <button type="button" onClick={() => onChangeQty(c.product.id, -1)} className="text-neutral-400">
                  −
                </button>
                <button type="button" onClick={() => onChangeQty(c.product.id, 1)} className="text-neutral-400">
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {settings.deliveryEnabled && (
              <button
                type="button"
                onClick={() => setFulfillment('entrega')}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  fulfillment === 'entrega'
                    ? 'border-black bg-black text-white'
                    : 'border-neutral-200 text-neutral-600'
                }`}
              >
                Entrega
                {settings.deliveryFeeCents > 0 && ` (+${formatBRL(settings.deliveryFeeCents)})`}
              </button>
            )}
            {settings.pickupEnabled && (
              <button
                type="button"
                onClick={() => setFulfillment('retirada')}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  fulfillment === 'retirada'
                    ? 'border-black bg-black text-white'
                    : 'border-neutral-200 text-neutral-600'
                }`}
              >
                Retirada
              </button>
            )}
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            required
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
            placeholder="Telefone / WhatsApp"
            required
            inputMode="tel"
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
          />
          {fulfillment === 'entrega' && (
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço de entrega"
              required
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
            />
          )}
          {profile && (
            <p className="text-xs text-neutral-500">
              Dados preenchidos da sua conta neste aparelho.
            </p>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações (opcional)"
            rows={2}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"
          />

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Pagamento na {fulfillment === 'entrega' ? 'entrega' : 'retirada'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['pix', 'Pix'],
                  ['dinheiro', 'Dinheiro'],
                  ['credito', 'Cartão'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPayment(value === 'credito' ? 'credito' : value)}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-semibold sm:text-sm ${
                    payment === value ||
                    (value === 'credito' && (payment === 'credito' || payment === 'debito'))
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(payment === 'credito' || payment === 'debito') && (
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value as PaymentMethod)}
                className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="credito">Cartão crédito</option>
                <option value="debito">Cartão débito</option>
              </select>
            )}
          </div>

          {payment === 'dinheiro' && (
            <div className="rounded-xl border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={needsChange}
                  onChange={(e) => setNeedsChange(e.target.checked)}
                />
                Preciso de troco
              </label>
              {needsChange && (
                <input
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                  placeholder={`Troco para quanto? (mín. ${formatBRL(totalCents)})`}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                />
              )}
            </div>
          )}

          {belowMinimum && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Pedido mínimo de {formatBRL(settings.minOrderCents)} (sem contar a entrega).
            </p>
          )}

          <div className="rounded-xl bg-neutral-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(subtotalCents)}</span>
            </div>
            {feeCents > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>Entrega</span>
                <span>{formatBRL(feeCents)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-semibold">
              <span>Total</span>
              <span>{formatBRL(totalCents)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || belowMinimum || cart.length === 0}
            className="w-full rounded-xl bg-black py-3.5 text-sm font-semibold uppercase text-white disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar pedido'}
          </button>

          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm text-neutral-500 underline"
            >
              Falar no WhatsApp da loja
            </a>
          )}
        </form>
      </div>
    </div>
  );
}
