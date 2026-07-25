import type { ProductCategory, QuantityDiscountType } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addonsApi } from '../../api/addons.api';
import { productsApi } from '../../api/products.api';
import { uploadsApi } from '../../api/uploads.api';
import { Button } from '../../components/ui/Button';
import { centsToDisplay, formatBRL, parseMoneyInput } from '../../utils/money';

function LinkedAddonGroupsSection({ productId }: { productId: number }) {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const { data: allGroups } = useQuery({
    queryKey: ['addon-groups'],
    queryFn: () => addonsApi.list(),
  });
  const { data: links } = useQuery({
    queryKey: ['products', productId, 'addon-groups'],
    queryFn: () => productsApi.listAddonGroups(productId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['products', productId, 'addon-groups'] });
  }

  const linkMutation = useMutation({
    mutationFn: (addonGroupId: number) => productsApi.linkAddonGroup(productId, addonGroupId),
    onSuccess: () => {
      invalidate();
      setSelectedGroupId('');
    },
  });
  const unlinkMutation = useMutation({
    mutationFn: (addonGroupId: number) => productsApi.unlinkAddonGroup(productId, addonGroupId),
    onSuccess: invalidate,
  });

  const linkedIds = new Set((links ?? []).map((l) => l.addonGroupId));
  const linkedGroups = (allGroups ?? []).filter((g) => linkedIds.has(g.id));
  const availableGroups = (allGroups ?? []).filter((g) => !linkedIds.has(g.id));

  return (
    <div className="rounded-xl border border-gray-300 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">Complementos vinculados</p>
        <p className="text-xs text-slate-400">
          Grupos já cadastrados na aba Complementos — reutilizados aqui sem recadastrar sabores.
        </p>
      </div>

      {linkedGroups.length > 0 && (
        <ul className="space-y-1 text-sm">
          {linkedGroups.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
              <span>
                {g.name}{' '}
                <span className="text-xs text-slate-400">
                  ({g.selectionType === 'single' ? 'única' : `até ${g.maxSelect}`}
                  {g.minSelect >= 1 ? ', obrigatório' : ''})
                </span>
              </span>
              <button
                type="button"
                onClick={() => unlinkMutation.mutate(g.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Desvincular
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 border-t border-gray-200 pt-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500">Vincular grupo existente</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Selecione...</option>
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          disabled={!selectedGroupId || linkMutation.isPending}
          onClick={() => selectedGroupId && linkMutation.mutate(Number(selectedGroupId))}
        >
          Vincular
        </Button>
      </div>
      {availableGroups.length === 0 && linkedGroups.length === 0 && (
        <p className="text-xs text-slate-400">
          Nenhum grupo cadastrado ainda — crie um na aba Complementos.
        </p>
      )}
    </div>
  );
}

function ComboItemsSection({
  productId,
  salePriceCents,
  onUseCost,
}: {
  productId: number;
  salePriceCents: number;
  onUseCost: (costCents: number) => void;
}) {
  const queryClient = useQueryClient();
  const [componentProductId, setComponentProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ['products', 'all-for-combo'],
    queryFn: () => productsApi.list({ active: true }),
  });
  const { data: items } = useQuery({
    queryKey: ['products', productId, 'combo-items'],
    queryFn: () => productsApi.listComboItems(productId),
  });

  const totalCostCents = (items ?? []).reduce((sum, i) => {
    const component = products?.find((p) => p.id === i.componentProductId);
    return sum + (component?.costPriceCents ?? 0) * i.quantity;
  }, 0);
  const marginCents = salePriceCents - totalCostCents;
  const marginPercent = salePriceCents > 0 ? (marginCents / salePriceCents) * 100 : 0;

  const otherProducts = (products ?? []).filter((p) => p.id !== productId && !p.isCombo);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['products', productId, 'combo-items'] });
  }

  const saveMutation = useMutation({
    mutationFn: (nextItems: { componentProductId: number; quantity: number }[]) =>
      productsApi.replaceComboItems(productId, nextItems),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  function addItem() {
    setError(null);
    if (!componentProductId) return setError('Selecione o produto componente');
    const qty = Number(quantity) || 1;
    const current = items ?? [];
    if (current.some((i) => i.componentProductId === Number(componentProductId))) {
      return setError('Este produto já está no combo');
    }
    saveMutation.mutate([
      ...current.map((i) => ({ componentProductId: i.componentProductId, quantity: i.quantity })),
      { componentProductId: Number(componentProductId), quantity: qty },
    ]);
    setComponentProductId('');
    setQuantity('1');
  }

  function removeItem(id: number) {
    const current = items ?? [];
    saveMutation.mutate(
      current.filter((i) => i.componentProductId !== id).map((i) => ({ componentProductId: i.componentProductId, quantity: i.quantity }))
    );
  }

  return (
    <div className="rounded-xl border border-gray-300 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">Itens do combo</p>
        <p className="text-xs text-slate-400">
          O combo não usa estoque próprio — cada item fixo abaixo é baixado ao vender.
        </p>
      </div>

      {items && items.length > 0 && (
        <>
          <ul className="space-y-1 text-sm">
            {items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2"
              >
                <span>
                  {i.quantity}× {i.componentProductName}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i.componentProductId)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm">
            <div>
              <span className="text-slate-500">Custo somado dos itens: </span>
              <span className="font-medium text-gray-900">{formatBRL(totalCostCents)}</span>
              {salePriceCents > 0 && (
                <span className={`ml-2 ${marginCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  margem {formatBRL(marginCents)} ({marginPercent.toFixed(0)}%)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onUseCost(totalCostCents)}
              className="text-xs text-amber-600 hover:underline"
            >
              Usar como custo do combo
            </button>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500">Produto componente</label>
          <select
            value={componentProductId}
            onChange={(e) => setComponentProductId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Selecione...</option>
            {otherProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Quantidade</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-20 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <Button type="button" onClick={addItem} disabled={saveMutation.isPending}>
          + Adicionar item
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function QuantityDiscountsSection({ productId }: { productId: number }) {
  const queryClient = useQueryClient();
  const [minQuantity, setMinQuantity] = useState('3');
  const [discountType, setDiscountType] = useState<QuantityDiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tiers } = useQuery({
    queryKey: ['products', productId, 'quantity-discounts'],
    queryFn: () => productsApi.listQuantityDiscounts(productId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['products', productId, 'quantity-discounts'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      productsApi.createQuantityDiscount(productId, {
        minQuantity: Number(minQuantity),
        discountType,
        discountValue: discountType === 'percent' ? Number(discountValue) : parseMoneyInput(discountValue),
      }),
    onSuccess: () => {
      invalidate();
      setDiscountValue('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (t: { id: number; active: boolean }) =>
      productsApi.updateQuantityDiscount(t.id, { active: !t.active }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => productsApi.removeQuantityDiscount(id),
    onSuccess: invalidate,
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (Number(minQuantity) < 2) return setError('Quantidade mínima deve ser maior que 1');
    if (!discountValue.trim()) return setError('Informe o valor do desconto');
    createMutation.mutate();
  }

  return (
    <div className="rounded-xl border border-gray-300 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">Desconto por quantidade</p>
        <p className="text-xs text-slate-400">
          Aplicado automaticamente no PDV (se o operador não informar outro desconto) e no cardápio online.
        </p>
      </div>

      {tiers && tiers.length > 0 && (
        <ul className="space-y-1 text-sm">
          {tiers.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
              <span>
                A partir de {t.minQuantity} un.:{' '}
                {t.discountType === 'percent' ? `${t.discountValue}% off` : `${formatBRL(t.discountValue)} off/un.`}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(t)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    t.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-slate-500'
                  }`}
                >
                  {t.active ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(t.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-3">
        <div>
          <label className="block text-xs text-slate-500">A partir de (un.)</label>
          <input
            type="number"
            min={2}
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            className="mt-1 w-20 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Tipo</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as QuantityDiscountType)}
            className="mt-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="percent">% percentual</option>
            <option value="fixed">R$ por unidade</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">
            {discountType === 'percent' ? 'Percentual' : 'Valor (R$)'}
          </label>
          <input
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === 'percent' ? '10' : '1,00'}
            className="mt-1 w-24 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          + Adicionar faixa
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

const categories: { value: ProductCategory; label: string }[] = [
  { value: 'vinho', label: 'Vinho' },
  { value: 'cerveja', label: 'Cerveja' },
  { value: 'destilado', label: 'Destilado' },
  { value: 'espumante', label: 'Espumante' },
  { value: 'licor', label: 'Licor' },
  { value: 'outro', label: 'Outro' },
];

export function ProductFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('vinho');
  const [brand, setBrand] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [barcode, setBarcode] = useState(searchParams.get('barcode') ?? '');
  const [sku, setSku] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [visibleInCatalog, setVisibleInCatalog] = useState(false);
  const [catalogSubtitle, setCatalogSubtitle] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [isCombo, setIsCombo] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ['products', id],
    queryFn: () => productsApi.getById(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setCategory(existing.category);
    setBrand(existing.brand ?? '');
    setVolumeMl(existing.volumeMl ? String(existing.volumeMl) : '');
    setBarcode(existing.barcode ?? '');
    setSku(existing.sku ?? '');
    setCostPrice(centsToDisplay(existing.costPriceCents));
    setSalePrice(centsToDisplay(existing.salePriceCents));
    setMinStock(String(existing.minStock));
    setVisibleInCatalog(existing.visibleInCatalog);
    setCatalogSubtitle(existing.catalogSubtitle ?? '');
    setCompareAtPrice(
      existing.compareAtPriceCents ? centsToDisplay(existing.compareAtPriceCents) : ''
    );
    setIsCombo(existing.isCombo);
    setImageUrl(existing.imageUrl);
  }, [existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const catalogFields = {
        visibleInCatalog,
        catalogSubtitle: catalogSubtitle.trim() || null,
        imageUrl,
        compareAtPriceCents: compareAtPrice.trim()
          ? parseMoneyInput(compareAtPrice)
          : null,
        isCombo,
      };
      const payload = {
        name: name.trim(),
        category,
        brand: brand.trim() || undefined,
        volumeMl: volumeMl ? Number(volumeMl) : undefined,
        barcode: barcode.trim() || undefined,
        sku: sku.trim() || undefined,
        costPriceCents: parseMoneyInput(costPrice),
        salePriceCents: parseMoneyInput(salePrice),
        minStock: Number(minStock) || 0,
        ...(isEdit ? {} : { stockQuantity: Number(stockQuantity) || 0 }),
      };
      const saved = isEdit
        ? await productsApi.update(Number(id), { ...payload, ...catalogFields })
        : await productsApi.create(payload).then((created) =>
            productsApi.update(created.id, catalogFields)
          );
      if (pendingImage) {
        await uploadsApi.uploadFile('product', pendingImage, saved.id);
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/estoque');
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    if (!salePrice) {
      setError('Preço de venda é obrigatório');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isEdit ? 'Editar produto' : 'Novo produto'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-500">Nome *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Marca</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">Volume (ml)</label>
            <input
              type="number"
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Código de barras</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">SKU (código interno)</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">Preço de custo (R$)</label>
            <input
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Preço de venda (R$) *</label>
            <input
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-500">Estoque inicial</label>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-500">Estoque mínimo</label>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={visibleInCatalog}
            onChange={(e) => setVisibleInCatalog(e.target.checked)}
          />
          Mostrar no cardápio online
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={isCombo} onChange={(e) => setIsCombo(e.target.checked)} />
          É um combo (composto por outros produtos — não usa estoque próprio)
        </label>

        <div className="rounded-xl border border-gray-300 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Cardápio online</p>
          <div>
            <label className="block text-sm font-medium text-slate-500">
              Subtítulo no cardápio
            </label>
            <input
              value={catalogSubtitle}
              onChange={(e) => setCatalogSubtitle(e.target.value)}
              placeholder="Ex.: FARDO GELADO!!"
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">
              Preço “de” (promoção)
            </label>
            <input
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              placeholder="Ex.: 33,00 — deixe vazio se não estiver em promo"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Se for maior que o preço de venda, o item entra em Promoções no cardápio.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Foto do produto</label>
            <p className="mt-0.5 text-xs text-slate-400">JPG/PNG/WebP · máx. 500 KB</p>
            {(imageUrl || pendingImage) && (
              <img
                src={pendingImage ? URL.createObjectURL(pendingImage) : imageUrl!}
                alt=""
                className="mt-2 h-24 w-24 rounded-lg object-contain bg-gray-100 border border-gray-300"
              />
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                {uploading ? 'Enviando...' : imageUrl || pendingImage ? 'Trocar foto' : 'Enviar foto'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading || mutation.isPending}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setError(null);
                    if (!isEdit) {
                      if (file.size > 500_000) {
                        setError('Imagem muito grande — máximo 500 KB');
                        return;
                      }
                      setPendingImage(file);
                      return;
                    }
                    setUploading(true);
                    try {
                      const result = await uploadsApi.uploadFile('product', file, Number(id));
                      setImageUrl(result.url);
                      setPendingImage(null);
                      queryClient.invalidateQueries({ queryKey: ['products'] });
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              {(imageUrl || pendingImage) && (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setImageUrl(null);
                    setPendingImage(null);
                  }}
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/estoque')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>

      {isEdit && (
        <div className="mt-4 space-y-4">
          <QuantityDiscountsSection productId={Number(id)} />
          <LinkedAddonGroupsSection productId={Number(id)} />
          {isCombo && (
            <ComboItemsSection
              productId={Number(id)}
              salePriceCents={parseMoneyInput(salePrice) || 0}
              onUseCost={(costCents) => setCostPrice(centsToDisplay(costCents))}
            />
          )}
        </div>
      )}
    </div>
  );
}
