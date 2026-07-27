import type { SaleStatus } from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { customersApi } from '../../api/customers.api';
import { salesApi } from '../../api/sales.api';
import { formatBRL } from '../../utils/money';
import { ReceiptPrint } from './ReceiptPrint';

const statusLabels: Record<SaleStatus, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', className: 'bg-gray-200 text-slate-500' },
};

export function SalesHistoryTab() {
  const [search, setSearch] = useState('');
  const [openSaleId, setOpenSaleId] = useState<number | null>(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => salesApi.list(),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', 'lite'],
    queryFn: () => customersApi.listLite(),
  });
  const customerName = (id: number | null) =>
    id === null ? 'Consumidor' : customers?.find((c) => c.id === id)?.name ?? `Cliente #${id}`;

  const { data: openDetail } = useQuery({
    queryKey: ['sales', openSaleId],
    queryFn: () => salesApi.getById(openSaleId!),
    enabled: openSaleId !== null,
  });

  const filtered = (sales ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return String(s.id) === q || customerName(s.customerId).toLowerCase().includes(q);
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nº ou cliente..."
          className="w-64 rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="py-10 text-center text-slate-400">Nenhuma venda encontrada.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Nº</th>
              <th className="py-2">Data</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const status = statusLabels[s.status];
              return (
                <tr key={s.id} className="border-b border-gray-200">
                  <td className="py-2 font-medium text-gray-900">#{s.id}</td>
                  <td className="py-2 text-slate-500">
                    {new Date(s.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2">{customerName(s.customerId)}</td>
                  <td className="py-2 text-slate-500">{s.saleType === 'atacado' ? 'Atacado' : 'Varejo'}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">{formatBRL(s.totalCents)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => setOpenSaleId(s.id)}
                      className="text-amber-600 hover:underline"
                    >
                      Ver recibo
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {openDetail && <ReceiptPrint detail={openDetail} onClose={() => setOpenSaleId(null)} />}
    </div>
  );
}
