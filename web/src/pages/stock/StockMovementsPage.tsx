import type { Product, ProductCategory, StockMovement, StockMovementType } from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { stockApi } from '../../api/stock.api';
import { StockMovementModal } from '../../components/StockMovementModal';
import { Button } from '../../components/ui/Button';

const categoryLabels: Record<ProductCategory, string> = {
  vinho: 'Vinho',
  cerveja: 'Cerveja',
  destilado: 'Destilado',
  espumante: 'Espumante',
  licor: 'Licor',
  outro: 'Outro',
};

const typeLabels: Record<StockMovementType, string> = {
  entrada_manual: 'Entrada manual',
  saida_manual: 'Saída manual',
  ajuste: 'Ajuste',
  venda: 'Venda',
  cancelamento_venda: 'Cancelamento de venda',
  pedido: 'Pedido online',
  cancelamento_pedido: 'Cancelamento de pedido',
  devolucao: 'Devolução',
  perda: 'Perda',
  avaria: 'Avaria',
  consumo_interno: 'Consumo interno',
};

// Tipos que somam ao estoque (entrada) vs. tipos que subtraem (saída). Ajuste
// é classificado pelo efeito real (prev → next), pois pode ser + ou −.
const ENTRADA_TYPES: StockMovementType[] = [
  'entrada_manual',
  'cancelamento_venda',
  'cancelamento_pedido',
  'devolucao',
];

function movementDirection(m: StockMovement): 'entrada' | 'saida' {
  if (m.prevQuantity !== null && m.nextQuantity !== null) {
    return m.nextQuantity >= m.prevQuantity ? 'entrada' : 'saida';
  }
  return ENTRADA_TYPES.includes(m.type) ? 'entrada' : 'saida';
}

type Tab = 'posicao' | 'historico';
type Direction = 'todas' | 'entrada' | 'saida';

function PosicaoTab() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', { search, category, active: true }],
    queryFn: () =>
      productsApi.list({ search: search || undefined, category: category || undefined, active: true }),
  });

  const filtered = (products ?? []).filter(
    (p) => !p.isCombo && (!onlyLowStock || p.stockQuantity <= p.minStock)
  );
  const lowStockCount = (products ?? []).filter((p) => !p.isCombo && p.stockQuantity <= p.minStock).length;

  const totalUnidades = filtered.reduce((sum, p) => sum + p.stockQuantity, 0);
  const totalReservado = filtered.reduce((sum, p) => sum + p.reservedQuantity, 0);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-slate-500">Produtos em estoque</div>
          <div className="text-2xl font-bold text-gray-900">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-slate-500">Unidades no total</div>
          <div className="text-2xl font-bold text-gray-900">{totalUnidades}</div>
          {totalReservado > 0 && (
            <div className="text-xs text-slate-400">{totalReservado} reservado(s) em pedidos</div>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-slate-500">Abaixo do mínimo</div>
          <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {lowStockCount}
          </div>
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
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Produto</th>
              <th className="py-2">Categoria</th>
              <th className="py-2 text-right">Saldo total</th>
              <th className="py-2 text-right">Reservado</th>
              <th className="py-2 text-right">Disponível</th>
              <th className="py-2 text-right">Mínimo</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const low = product.stockQuantity <= product.minStock;
              return (
                <tr key={product.id} className="border-b border-gray-200">
                  <td className="py-2">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-slate-400">
                      {product.brand} {product.volumeMl ? `· ${product.volumeMl}ml` : ''}
                    </div>
                  </td>
                  <td className="py-2 text-slate-500">{categoryLabels[product.category]}</td>
                  <td className={`py-2 text-right font-semibold ${low ? 'text-red-600' : 'text-gray-900'}`}>
                    {product.stockQuantity} {low && '⚠'}
                  </td>
                  <td className="py-2 text-right text-slate-500">
                    {product.reservedQuantity > 0 ? product.reservedQuantity : '—'}
                  </td>
                  <td className="py-2 text-right text-slate-500">{product.availableQuantity}</td>
                  <td className="py-2 text-right text-slate-400">{product.minStock}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => setMovementProduct(product)}
                      className="text-amber-600 hover:underline"
                    >
                      Movimentar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
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

function HistoricoTab() {
  const [direction, setDirection] = useState<Direction>('todas');
  const [type, setType] = useState('');

  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements', { type }],
    queryFn: () => stockApi.listMovements({ type: type || undefined }),
  });

  const filtered = (movements ?? []).filter(
    (m) => direction === 'todas' || movementDirection(m) === direction
  );

  const directionTabs: { id: Direction; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'entrada', label: 'Entradas' },
    { id: 'saida', label: 'Saídas' },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-gray-300 p-0.5">
          {directionTabs.map((d) => (
            <button
              key={d.id}
              onClick={() => setDirection(d.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                direction === d.id ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-gray-900'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Data</th>
              <th className="py-2">Produto</th>
              <th className="py-2">Tipo</th>
              <th className="py-2 text-right">Quantidade</th>
              <th className="py-2 text-right">Estoque</th>
              <th className="py-2">Motivo</th>
              <th className="py-2">Caixa</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const dir = movementDirection(m);
              const isEntrada = dir === 'entrada';
              return (
                <tr key={m.id} className="border-b border-gray-200">
                  <td className="py-2 text-slate-500">{new Date(m.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="py-2">{m.productName ?? `#${m.productId}`}</td>
                  <td className="py-2">
                    <span className={isEntrada ? 'text-green-600' : 'text-red-600'}>
                      {typeLabels[m.type]}
                    </span>
                  </td>
                  <td className={`py-2 text-right font-medium ${isEntrada ? 'text-green-600' : 'text-red-600'}`}>
                    {isEntrada ? '+' : '−'}
                    {Math.abs(m.quantity)}
                  </td>
                  <td className="py-2 text-right text-slate-500">
                    {m.prevQuantity !== null && m.nextQuantity !== null
                      ? `${m.prevQuantity} → ${m.nextQuantity}`
                      : '—'}
                  </td>
                  <td className="py-2 text-slate-500">{m.reason ?? '—'}</td>
                  <td className="py-2 text-slate-500">{m.registerLabel ?? '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StockMovementsPage() {
  const [tab, setTab] = useState<Tab>('posicao');

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 border-b border-gray-300">
          <button
            onClick={() => setTab('posicao')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === 'posicao'
                ? 'border-amber-600 text-gray-900'
                : 'border-transparent text-slate-500 hover:text-gray-900'
            }`}
          >
            Estoque total
          </button>
          <button
            onClick={() => setTab('historico')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === 'historico'
                ? 'border-amber-600 text-gray-900'
                : 'border-transparent text-slate-500 hover:text-gray-900'
            }`}
          >
            Histórico
          </button>
        </div>
        <Link to="/estoque" className="text-sm text-amber-600">
          Ir para cadastro de produtos
        </Link>
      </div>

      {tab === 'posicao' ? <PosicaoTab /> : <HistoricoTab />}
    </div>
  );
}
