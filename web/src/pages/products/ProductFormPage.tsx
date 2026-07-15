import type { ProductCategory } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { uploadsApi } from '../../api/uploads.api';
import { Button } from '../../components/ui/Button';
import { centsToDisplay, parseMoneyInput } from '../../utils/money';

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
      <h1 className="mb-6 text-2xl font-bold text-neutral-800">
        {isEdit ? 'Editar produto' : 'Novo produto'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Nome *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Marca</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Volume (ml)</label>
            <input
              type="number"
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Código de barras</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">SKU (código interno)</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Preço de custo (R$)</label>
            <input
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Preço de venda (R$) *</label>
            <input
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-neutral-700">Estoque inicial</label>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700">Estoque mínimo</label>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={visibleInCatalog}
            onChange={(e) => setVisibleInCatalog(e.target.checked)}
          />
          Mostrar no cardápio online
        </label>

        <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
          <p className="text-sm font-medium text-neutral-800">Cardápio online</p>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              Subtítulo no cardápio
            </label>
            <input
              value={catalogSubtitle}
              onChange={(e) => setCatalogSubtitle(e.target.value)}
              placeholder="Ex.: FARDO GELADO!!"
              maxLength={120}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              Preço “de” (promoção)
            </label>
            <input
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              placeholder="Ex.: 33,00 — deixe vazio se não estiver em promo"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Se for maior que o preço de venda, o item entra em Promoções no cardápio.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Foto do produto</label>
            <p className="mt-0.5 text-xs text-neutral-400">JPG/PNG/WebP · máx. 500 KB</p>
            {(imageUrl || pendingImage) && (
              <img
                src={pendingImage ? URL.createObjectURL(pendingImage) : imageUrl!}
                alt=""
                className="mt-2 h-24 w-24 rounded-md object-contain bg-neutral-50 border border-neutral-200"
              />
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
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
                  className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
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
    </div>
  );
}
