import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '../../api/reports.api';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(date: string, data: NonNullable<ReturnType<typeof useConsolidated>['data']>): string {
  const codes = data.paymentMethods.map((m) => m.code);
  const header = ['caixa', 'status', 'total', ...codes, 'divergencia'].join(';');
  const lines = data.registers.map((r) =>
    [
      r.registerLabel,
      r.status,
      (r.salesTotalCents / 100).toFixed(2),
      ...codes.map((code) => ((r.paymentBreakdown[code] ?? 0) / 100).toFixed(2)),
      r.differenceCents !== null ? (r.differenceCents / 100).toFixed(2) : '',
    ].join(';')
  );
  return '﻿' + [`Consolidado ${date}`, header, ...lines].join('\r\n');
}

function useConsolidated(date: string) {
  return useQuery({
    queryKey: ['reports', 'daily-consolidated', date],
    queryFn: () => reportsApi.dailyConsolidated(date),
  });
}

export function DailyConsolidatedPage() {
  const [date, setDate] = useState(todayISO());
  const { data, isLoading } = useConsolidated(date);

  function exportCsv() {
    if (!data) return;
    const blob = new Blob([toCsv(date, data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidado-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8">
      <ReportsNav />

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-500">Dia:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
        />
        {data && data.registers.length > 0 && (
          <button onClick={exportCsv} className="text-sm text-amber-600 hover:underline">
            Exportar CSV
          </button>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {data && data.registers.length === 0 && (
        <p className="text-slate-400">Nenhum caixa aberto neste dia.</p>
      )}

      {data && data.registers.length > 0 && (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-slate-500">
                <th className="py-2">Caixa</th>
                <th className="py-2">Status</th>
                {data.paymentMethods.map((m) => (
                  <th key={m.id} className="py-2 text-right">{m.label}</th>
                ))}
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Diverg.</th>
              </tr>
            </thead>
            <tbody>
              {data.registers.map((r) => (
                <tr key={r.cashSessionId} className="border-b border-gray-200">
                  <td className="py-2 font-medium text-gray-900">{r.registerLabel}</td>
                  <td className="py-2">{r.status === 'aberto' ? 'Aberto' : 'Fechado'}</td>
                  {data.paymentMethods.map((m) => (
                    <td key={m.id} className="py-2 text-right">
                      {formatBRL(r.paymentBreakdown[m.code] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 text-right font-medium">{formatBRL(r.salesTotalCents)}</td>
                  <td
                    className={`py-2 text-right ${
                      r.differenceCents ? 'font-medium text-amber-600' : 'text-slate-400'
                    }`}
                  >
                    {r.differenceCents !== null ? formatBRL(r.differenceCents) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="py-2" colSpan={2}>
                  Total do dia
                </td>
                {data.paymentMethods.map((m) => (
                  <td key={m.id} className="py-2 text-right">
                    {formatBRL(data.totals.paymentBreakdown[m.code] ?? 0)}
                  </td>
                ))}
                <td className="py-2 text-right">{formatBRL(data.totals.salesTotalCents)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.totalDifferenceCents)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-6 grid grid-cols-2 gap-4 md:w-96">
            <div className="rounded-xl border border-gray-300 p-4 text-center">
              <p className="text-xl font-bold text-gray-900">{formatBRL(data.totals.balcaoCents)}</p>
              <p className="text-xs text-slate-500">Balcão</p>
            </div>
            <div className="rounded-xl border border-gray-300 p-4 text-center">
              <p className="text-xl font-bold text-gray-900">{formatBRL(data.totals.onlineCents)}</p>
              <p className="text-xs text-slate-500">Pedidos online</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
