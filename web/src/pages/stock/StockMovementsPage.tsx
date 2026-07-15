import type { StockMovementType } from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products.api';
import { stockApi } from '../../api/stock.api';

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

const typeColors: Record<StockMovementType, string> = {
  entrada_manual: 'text-green-600',
  saida_manual: 'text-red-600',
  ajuste: 'text-amber-600',
  venda: 'text-red-600',
  cancelamento_venda: 'text-green-600',
  pedido: 'text-red-600',
  cancelamento_pedido: 'text-green-600',
  devolucao: 'text-green-600',
  perda: 'text-red-600',
  avaria: 'text-red-600',
  consumo_interno: 'text-red-600',
};

export function StockMovementsPage() {
  const [type, setType] = useState('');

  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements', { type }],
    queryFn: () => stockApi.listMovements({ type: type || undefined }),
  });

  const { data: products } = useQuery({
    queryKey: ['products', { active: undefined }],
    queryFn: () => productsApi.list(),
  });

  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Histórico de movimentações</h1>
        <Link to="/estoque" className="text-sm text-blue-600">
          Voltar ao estoque
        </Link>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="mb-4 rounded-md border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="">Todos os tipos</option>
        {Object.entries(typeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Data</th>
              <th className="py-2">Produto</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Quantidade</th>
              <th className="py-2">Estoque</th>
              <th className="py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movements?.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100">
                <td className="py-2 text-neutral-500">{new Date(m.createdAt).toLocaleString('pt-BR')}</td>
                <td className="py-2">{productName(m.productId)}</td>
                <td className={`py-2 ${typeColors[m.type]}`}>{typeLabels[m.type]}</td>
                <td className="py-2">{m.quantity}</td>
                <td className="py-2 text-neutral-500">
                  {m.prevQuantity !== null && m.nextQuantity !== null
                    ? `${m.prevQuantity} → ${m.nextQuantity}`
                    : '—'}
                </td>
                <td className="py-2 text-neutral-500">{m.reason ?? '—'}</td>
              </tr>
            ))}
            {movements?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-400">
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
