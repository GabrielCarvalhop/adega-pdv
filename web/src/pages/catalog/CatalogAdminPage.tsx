import type { Product, UpdateProductRequest } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getSavedSlug } from '../../auth/AuthContext';
import { productsApi } from '../../api/products.api';
import { Button } from '../../components/ui/Button';
import { formatBRL, parseMoneyInput } from '../../utils/money';

const categoryLabels: Record<string, string> = {
  vinho: 'Vinho',
  cerveja: 'Cerveja',
  destilado: 'Destilado',
  espumante: 'Espumante',
  licor: 'Licor',
  outro: 'Outro',
};

function centsToInput(cents: number | null | undefined): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function ProductEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(centsToInput(product.salePriceCents));
  const [comparePrice, setComparePrice] = useState(centsToInput(product.compareAtPriceCents));
  const [subtitle, setSubtitle] = useState(product.catalogSubtitle ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: UpdateProductRequest) => productsApi.update(product.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function save() {
    const salePriceCents = parseMoneyInput(price);
    if (salePriceCents <= 0) {
      setError('Informe um preço de venda válido');
      return;
    }
    const compareAtPriceCents = comparePrice.trim() ? parseMoneyInput(comparePrice) : null;
    if (compareAtPriceCents !== null && compareAtPriceCents <= salePriceCents) {
      setError('O preço "de" (promoção) precisa ser maior que o preço de venda');
      return;
    }
    mutation.mutate({
      salePriceCents,
      compareAtPriceCents,
      catalogSubtitle: subtitle.trim() || null,
    });
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Preço de venda</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="0,00"
            inputMode="decimal"
            autoFocus
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Preço "de" (promoção, opcional)
          </label>
          <input
            value={comparePrice}
            onChange={(e) => setComparePrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="deixe vazio se não houver"
            inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Subtítulo no cardápio</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Ex.: gelado, garrafa 1L..."
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex items-center justify-between">
        <Link to={`/estoque/${product.id}/editar`} className="text-xs text-amber-600 hover:underline">
          Edição completa (foto, estoque, descontos) ↗
        </Link>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CatalogAdminPage() {
  const slug = getSavedSlug();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', { active: true }],
    queryFn: () => productsApi.list({ active: true }),
  });

  const visible = (products ?? [])
    .filter((p) => p.visibleInCatalog)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const hidden = (products ?? [])
    .filter((p) => !p.visibleInCatalog)
    .sort((a, b) => a.name.localeCompare(b.name));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const toggleVisible = useMutation({
    mutationFn: ({ id, visibleInCatalog }: { id: number; visibleInCatalog: boolean }) =>
      productsApi.update(id, { visibleInCatalog }),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => productsApi.reorder(ids),
    onSuccess: invalidate,
  });

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= visible.length) return;
    const ids = visible.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  }

  const catalogUrl = slug ? `/c/${slug}` : null;

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-500">
          Ordene, edite preço e promoções, e controle o que aparece no cardápio online. A edição de
          foto e estoque continua na edição completa do produto.
        </p>
        {catalogUrl && (
          <a
            href={catalogUrl}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap text-sm text-amber-600 hover:underline"
          >
            Ver cardápio real ↗
          </a>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && visible.length === 0 && (
        <p className="text-slate-400">
          Nenhum produto no cardápio ainda. Use "Adicionar ao cardápio" abaixo para incluir produtos.
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((p, index) => (
          <li key={p.id}>
            <div className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white p-3">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={index === 0 || reorderMutation.isPending}
                  onClick={() => move(index, -1)}
                  aria-label="Subir"
                  className="rounded bg-gray-100 px-1.5 text-xs text-slate-500 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === visible.length - 1 || reorderMutation.isPending}
                  onClick={() => move(index, 1)}
                  aria-label="Descer"
                  className="rounded bg-gray-100 px-1.5 text-xs text-slate-500 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-10 w-10 flex-shrink-0 rounded-md border border-gray-200 object-contain bg-gray-100"
                />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-slate-400">
                  sem foto
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-slate-400">
                  {categoryLabels[p.category]}
                  {p.catalogSubtitle ? ` · ${p.catalogSubtitle}` : ''}
                </p>
              </div>
              <div className="text-right text-sm">
                {p.compareAtPriceCents && p.compareAtPriceCents > p.salePriceCents ? (
                  <>
                    <p className="text-xs text-slate-400 line-through">
                      {formatBRL(p.compareAtPriceCents)}
                    </p>
                    <p className="font-semibold text-amber-600">{formatBRL(p.salePriceCents)}</p>
                  </>
                ) : (
                  <p className="font-semibold text-gray-900">{formatBRL(p.salePriceCents)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                className="text-xs font-medium text-amber-600 hover:underline"
              >
                {editingId === p.id ? 'Fechar' : 'Editar'}
              </button>
              <button
                type="button"
                onClick={() => toggleVisible.mutate({ id: p.id, visibleInCatalog: false })}
                disabled={toggleVisible.isPending}
                className="text-xs text-red-500 hover:underline"
              >
                Ocultar
              </button>
            </div>
            {editingId === p.id && <ProductEditor product={p} onClose={() => setEditingId(null)} />}
          </li>
        ))}
      </ul>

      {!isLoading && hidden.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="text-sm font-semibold text-gray-900 hover:text-amber-600"
          >
            {showHidden ? '▾' : '▸'} Produtos fora do cardápio ({hidden.length})
          </button>

          {showHidden && (
            <ul className="mt-3 space-y-2">
              {hidden.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-md border border-gray-200 object-contain bg-white"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-slate-400">
                      sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {categoryLabels[p.category]} · {formatBRL(p.salePriceCents)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleVisible.mutate({ id: p.id, visibleInCatalog: true })}
                    disabled={toggleVisible.isPending}
                    className="text-xs font-medium text-amber-600 hover:underline"
                  >
                    + Adicionar ao cardápio
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
