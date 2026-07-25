import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ordersApi } from '../../api/orders.api';
import { NewSaleTab } from './NewSaleTab';
import { OpenOrdersTab } from './OpenOrdersTab';
import { SalesHistoryTab } from './SalesHistoryTab';

type Tab = 'nova' | 'historico' | 'pedidos';

export function SalePage() {
  const [tab, setTab] = useState<Tab>('nova');

  const { data: pending } = useQuery({
    queryKey: ['orders', 'pending-count'],
    queryFn: () => ordersApi.pendingCount(),
    refetchInterval: 15000,
  });
  const pendingCount = pending?.count ?? 0;

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-300 bg-white px-6">
        {(
          [
            { id: 'nova' as const, label: 'Nova venda' },
            { id: 'historico' as const, label: 'Histórico' },
            { id: 'pedidos' as const, label: `Pedidos em aberto${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === t.id
                ? 'border-amber-600 text-gray-900'
                : 'border-transparent text-slate-500 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'nova' && <NewSaleTab />}
      {tab === 'historico' && <SalesHistoryTab />}
      {tab === 'pedidos' && <OpenOrdersTab />}
    </div>
  );
}
