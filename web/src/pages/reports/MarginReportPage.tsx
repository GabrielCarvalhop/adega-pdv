import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '../../api/reports.api';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

export function MarginReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'margin', { from, to }],
    queryFn: () => reportsApi.margin({ from: from || undefined, to: to || undefined }),
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-800">Relatórios</h1>
      <ReportsNav />

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {isLoading && <p className="mt-4 text-neutral-500">Carregando...</p>}

      {!isLoading && data && (
        <>
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <p className="text-neutral-500">Receita</p>
              <p className="text-xl font-bold text-neutral-800">{formatBRL(data.totals.revenueCents)}</p>
            </div>
            <div>
              <p className="text-neutral-500">Custo</p>
              <p className="text-xl font-bold text-neutral-800">{formatBRL(data.totals.costCents)}</p>
            </div>
            <div>
              <p className="text-neutral-500">Margem</p>
              <p className="text-xl font-bold text-green-700">
                {formatBRL(data.totals.marginCents)} ({data.totals.marginPercent.toFixed(1)}%)
              </p>
            </div>
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2">Produto</th>
                <th className="py-2">Qtd</th>
                <th className="py-2">Receita</th>
                <th className="py-2">Custo</th>
                <th className="py-2">Margem</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((row) => (
                <tr key={row.productId} className="border-b border-neutral-100">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2">{row.totalQuantity}</td>
                  <td className="py-2">{formatBRL(row.revenueCents)}</td>
                  <td className="py-2">{formatBRL(row.costCents)}</td>
                  <td className="py-2 font-medium text-green-700">
                    {formatBRL(row.marginCents)} ({row.marginPercent.toFixed(1)}%)
                  </td>
                </tr>
              ))}
              {data.products.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral-400">
                    Nenhuma venda no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
