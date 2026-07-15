import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsApi } from '../../api/reports.api';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(date: string, data: NonNullable<ReturnType<typeof useConsolidated>['data']>): string {
  const header = 'caixa;status;total;dinheiro;debito;credito;pix;divergencia';
  const lines = data.registers.map((r) =>
    [
      r.registerLabel,
      r.status,
      (r.salesTotalCents / 100).toFixed(2),
      (r.paymentBreakdown.dinheiro / 100).toFixed(2),
      (r.paymentBreakdown.debito / 100).toFixed(2),
      (r.paymentBreakdown.credito / 100).toFixed(2),
      (r.paymentBreakdown.pix / 100).toFixed(2),
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
      <h1 className="mb-6 text-2xl font-bold text-neutral-800">Relatórios</h1>
      <ReportsNav />

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-neutral-600">Dia:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        {data && data.registers.length > 0 && (
          <button onClick={exportCsv} className="text-sm text-blue-600 hover:underline">
            Exportar CSV
          </button>
        )}
      </div>

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {data && data.registers.length === 0 && (
        <p className="text-neutral-400">Nenhum caixa aberto neste dia.</p>
      )}

      {data && data.registers.length > 0 && (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2">Caixa</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Dinheiro</th>
                <th className="py-2 text-right">Débito</th>
                <th className="py-2 text-right">Crédito</th>
                <th className="py-2 text-right">Pix</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Diverg.</th>
              </tr>
            </thead>
            <tbody>
              {data.registers.map((r) => (
                <tr key={r.cashSessionId} className="border-b border-neutral-100">
                  <td className="py-2 font-medium text-neutral-800">{r.registerLabel}</td>
                  <td className="py-2">{r.status === 'aberto' ? 'Aberto' : 'Fechado'}</td>
                  <td className="py-2 text-right">{formatBRL(r.paymentBreakdown.dinheiro)}</td>
                  <td className="py-2 text-right">{formatBRL(r.paymentBreakdown.debito)}</td>
                  <td className="py-2 text-right">{formatBRL(r.paymentBreakdown.credito)}</td>
                  <td className="py-2 text-right">{formatBRL(r.paymentBreakdown.pix)}</td>
                  <td className="py-2 text-right font-medium">{formatBRL(r.salesTotalCents)}</td>
                  <td
                    className={`py-2 text-right ${
                      r.differenceCents ? 'font-medium text-amber-600' : 'text-neutral-400'
                    }`}
                  >
                    {r.differenceCents !== null ? formatBRL(r.differenceCents) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 font-semibold">
                <td className="py-2" colSpan={2}>
                  Total do dia
                </td>
                <td className="py-2 text-right">{formatBRL(data.totals.paymentBreakdown.dinheiro)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.paymentBreakdown.debito)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.paymentBreakdown.credito)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.paymentBreakdown.pix)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.salesTotalCents)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.totalDifferenceCents)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-6 grid grid-cols-2 gap-4 md:w-96">
            <div className="rounded-lg border border-neutral-200 p-4 text-center">
              <p className="text-xl font-bold text-neutral-800">{formatBRL(data.totals.balcaoCents)}</p>
              <p className="text-xs text-neutral-500">Balcão</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 text-center">
              <p className="text-xl font-bold text-neutral-800">{formatBRL(data.totals.onlineCents)}</p>
              <p className="text-xs text-neutral-500">Pedidos online</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
