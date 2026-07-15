import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '../../api/reports.api';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

export function TopProductsReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'top-products', { from, to }],
    queryFn: () => reportsApi.topProducts({ from: from || undefined, to: to || undefined, limit: 20 }),
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-800">Relatórios</h1>
      <ReportsNav />

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {isLoading && <p className="mt-4 text-neutral-500">Carregando...</p>}

      {!isLoading && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">#</th>
              <th className="py-2">Produto</th>
              <th className="py-2">Quantidade vendida</th>
              <th className="py-2">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row, index) => (
              <tr key={row.productId} className="border-b border-neutral-100">
                <td className="py-2 text-neutral-400">{index + 1}</td>
                <td className="py-2">{row.name}</td>
                <td className="py-2">{row.totalQuantity}</td>
                <td className="py-2 font-medium">{formatBRL(row.totalRevenueCents)}</td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-400">
                  Nenhuma venda no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
