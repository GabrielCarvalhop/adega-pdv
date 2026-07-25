import type { Product, ProductCategory } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { Button } from '../../components/ui/Button';
import { StockMovementModal } from '../../components/StockMovementModal';
import { formatBRL } from '../../utils/money';

const categoryLabels: Record<ProductCategory, string> = {
  vinho: 'Vinho',
  cerveja: 'Cerveja',
  destilado: 'Destilado',
  espumante: 'Espumante',
  licor: 'Licor',
  outro: 'Outro',
};

export function ProductListPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [onlyCatalog, setOnlyCatalog] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', { search, category, active: true }],
    queryFn: () => productsApi.list({ search: search || undefined, category: category || undefined, active: true }),
  });

  const toggleCatalog = useMutation({
    mutationFn: (product: Product) =>
      productsApi.update(product.id, { visibleInCatalog: !product.visibleInCatalog }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const filtered = (products ?? []).filter(
    (p) =>
      (!onlyLowStock || p.stockQuantity <= p.minStock) &&
      (!onlyCatalog || p.visibleInCatalog)
  );

  const lowStockCount = (products ?? []).filter((p) => p.stockQuantity <= p.minStock).length;
  const catalogCount = (products ?? []).filter((p) => p.visibleInCatalog).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-end">
        <div className="flex gap-2">
          <Link to="/estoque/movimentacoes" className="text-sm text-amber-600 self-center">
            Ver estoque e movimentações
          </Link>
          <Link to="/estoque/novo">
            <Button>+ Novo produto</Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nome ou código de barras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todas categorias</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
          />
          Somente estoque baixo {lowStockCount > 0 && `(${lowStockCount})`}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            checked={onlyCatalog}
            onChange={(e) => setOnlyCatalog(e.target.checked)}
          />
          Somente no cardápio {catalogCount > 0 && `(${catalogCount})`}
        </label>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Produto</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Preço venda</th>
              <th className="py-2">Estoque</th>
              <th className="py-2">Cardápio</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const low = product.stockQuantity <= product.minStock;
              return (
                <tr key={product.id} className="border-b border-gray-200">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-8 w-8 flex-shrink-0 rounded-md border border-gray-200 object-contain bg-gray-100"
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-slate-400">
                          {product.brand} {product.volumeMl ? `· ${product.volumeMl}ml` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2">{categoryLabels[product.category]}</td>
                  <td className="py-2">{formatBRL(product.salePriceCents)}</td>
                  <td className={`py-2 ${low ? 'font-semibold text-red-600' : ''}`}>
                    {product.stockQuantity} {low && '⚠'}
                    {product.reservedQuantity > 0 && (
                      <div className="text-xs font-normal text-slate-400">
                        {product.reservedQuantity} reservado · {product.availableQuantity} disp.
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        product.visibleInCatalog
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-200 text-slate-500'
                      }`}
                    >
                      {product.visibleInCatalog ? 'No cardápio' : 'Oculto'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => toggleCatalog.mutate(product)}
                      disabled={toggleCatalog.isPending}
                      className="mr-3 text-amber-600 hover:underline disabled:opacity-50"
                    >
                      {product.visibleInCatalog ? 'Remover do cardápio' : 'Mostrar no cardápio'}
                    </button>
                    <button
                      onClick={() => setMovementProduct(product)}
                      className="mr-3 text-amber-600 hover:underline"
                    >
                      Movimentar
                    </button>
                    <Link to={`/estoque/${product.id}/editar`} className="text-amber-600 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {movementProduct && (
        <StockMovementModal product={movementProduct} onClose={() => setMovementProduct(null)} />
      )}
    </div>
  );
}
