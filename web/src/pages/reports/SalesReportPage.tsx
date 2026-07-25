import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '../../api/reports.api';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

export function SalesReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'sales', { from, to, groupBy }],
    queryFn: () => reportsApi.sales({ from: from || undefined, to: to || undefined, groupBy }),
  });

  const totalRevenue = data?.reduce((sum, r) => sum + r.totalCents, 0) ?? 0;
  const totalSales = data?.reduce((sum, r) => sum + r.saleCount, 0) ?? 0;

  return (
    <div className="p-8">
      <ReportsNav />

      <div className="mb-4 flex items-center justify-between">
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as 'hour' | 'day' | 'week' | 'month')}
          className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="hour">Por horário (pico do dia)</option>
          <option value="day">Por dia</option>
          <option value="week">Por semana</option>
          <option value="month">Por mês</option>
        </select>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <>
          <div className="mb-4 flex gap-6 text-sm">
            <div>
              <p className="text-slate-500">Total de vendas</p>
              <p className="text-xl font-bold text-gray-900">{totalSales}</p>
            </div>
            <div>
              <p className="text-slate-500">Faturamento total</p>
              <p className="text-xl font-bold text-gray-900">{formatBRL(totalRevenue)}</p>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-slate-500">
                <th className="py-2">Período</th>
                <th className="py-2">Nº de vendas</th>
                <th className="py-2">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.period} className="border-b border-gray-200">
                  <td className="py-2">{row.period}</td>
                  <td className="py-2">{row.saleCount}</td>
                  <td className="py-2 font-medium">{formatBRL(row.totalCents)}</td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400">
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
