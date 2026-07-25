import type { OrderStatus } from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../api/orders.api';
import { formatBRL } from '../../utils/money';

const statusLabels: Record<OrderStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  aceito: { label: 'Em preparo', className: 'bg-blue-100 text-blue-700' },
  pronto: { label: 'Pronto', className: 'bg-purple-100 text-purple-700' },
  saiu_entrega: { label: 'Saiu p/ entrega', className: 'bg-cyan-100 text-cyan-700' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-700' },
  recusado: { label: 'Recusado', className: 'bg-red-100 text-red-600' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-200 text-slate-500' },
  expirado: { label: 'Expirado', className: 'bg-gray-200 text-slate-500' },
};

const ACTIVE_STATUSES: OrderStatus[] = ['pendente', 'aceito', 'pronto', 'saiu_entrega'];

export function OpenOrdersTab() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', 'ativos'],
    queryFn: () => ordersApi.list(ACTIVE_STATUSES),
    refetchInterval: 15000,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Pedidos do cardápio online aguardando ação.</p>
        <Link to="/pedidos" className="text-sm text-amber-600 hover:underline">
          Gerenciar pedidos →
        </Link>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (orders?.length ?? 0) === 0 && (
        <p className="py-10 text-center text-slate-400">Não há pedidos do cardápio online para aceitar.</p>
      )}

      {!isLoading && orders && orders.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Nº</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(({ order }) => {
              const status = statusLabels[order.status];
              return (
                <tr key={order.id} className="border-b border-gray-200">
                  <td className="py-2 font-medium text-gray-900">#{order.id}</td>
                  <td className="py-2">
                    {order.customerName} · {order.customerPhone}
                  </td>
                  <td className="py-2 text-slate-500">
                    {order.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}
                  </td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">{formatBRL(order.totalCents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
