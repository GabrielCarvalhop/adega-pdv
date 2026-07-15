import type { Product, ProductCategory } from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
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
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', { search, category, active: true }],
    queryFn: () => productsApi.list({ search: search || undefined, category: category || undefined, active: true }),
  });

  const filtered = (products ?? []).filter(
    (p) => !onlyLowStock || p.stockQuantity <= p.minStock
  );

  const lowStockCount = (products ?? []).filter((p) => p.stockQuantity <= p.minStock).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Estoque / Produtos</h1>
        <div className="flex gap-2">
          <Link to="/estoque/movimentacoes" className="text-sm text-blue-600 self-center">
            Histórico de movimentações
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
          className="w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todas categorias</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
          />
          Somente estoque baixo {lowStockCount > 0 && `(${lowStockCount})`}
        </label>
      </div>

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Produto</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Preço venda</th>
              <th className="py-2">Estoque</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const low = product.stockQuantity <= product.minStock;
              return (
                <tr key={product.id} className="border-b border-neutral-100">
                  <td className="py-2">
                    <div className="font-medium text-neutral-800">{product.name}</div>
                    <div className="text-neutral-400">
                      {product.brand} {product.volumeMl ? `· ${product.volumeMl}ml` : ''}
                    </div>
                  </td>
                  <td className="py-2">{categoryLabels[product.category]}</td>
                  <td className="py-2">{formatBRL(product.salePriceCents)}</td>
                  <td className={`py-2 ${low ? 'font-semibold text-red-600' : ''}`}>
                    {product.stockQuantity} {low && '⚠'}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => setMovementProduct(product)}
                      className="mr-3 text-blue-600 hover:underline"
                    >
                      Movimentar
                    </button>
                    <Link to={`/estoque/${product.id}/editar`} className="text-blue-600 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-400">
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
