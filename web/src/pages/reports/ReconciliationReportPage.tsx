import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { paymentMethodsApi } from '../../api/paymentMethods.api';
import { reportsApi } from '../../api/reports.api';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function monthStartISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function toCsv(data: NonNullable<ReturnType<typeof useReconciliation>['data']>): string {
  const header = ['meio', 'qtd', 'bruto', 'liquido', 'retido'].join(';');
  const lines = data.rows.map((r) =>
    [
      r.label,
      r.count,
      (r.grossCents / 100).toFixed(2),
      (r.netCents / 100).toFixed(2),
      ((r.grossCents - r.netCents) / 100).toFixed(2),
    ].join(';')
  );
  return '﻿' + ['Conferência financeira', header, ...lines].join('\r\n');
}

function useReconciliation(filters: {
  from: string;
  to: string;
  cashSessionId: string;
  paymentMethodId: string;
}) {
  return useQuery({
    queryKey: ['reports', 'reconciliation', filters],
    queryFn: () =>
      reportsApi.reconciliation({
        from: filters.from || undefined,
        to: filters.to || undefined,
        cashSessionId: filters.cashSessionId ? Number(filters.cashSessionId) : undefined,
        paymentMethodId: filters.paymentMethodId ? Number(filters.paymentMethodId) : undefined,
      }),
  });
}

export function ReconciliationReportPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [cashSessionId, setCashSessionId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  const { data, isLoading } = useReconciliation({ from, to, cashSessionId, paymentMethodId });
  const { data: sessions } = useQuery({ queryKey: ['cash', 'history'], queryFn: () => cashApi.history() });
  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.list(),
  });

  function exportCsv() {
    if (!data) return;
    const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conferencia-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8">
      <div className="print:hidden">
        <ReportsNav />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => {
            setFrom(todayISO());
            setTo(todayISO());
          }}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-gray-100"
        >
          Hoje
        </button>
        <button
          onClick={() => {
            setFrom(daysAgoISO(7));
            setTo(todayISO());
          }}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-gray-100"
        >
          Últimos 7 dias
        </button>
        <button
          onClick={() => {
            setFrom(monthStartISO());
            setTo(todayISO());
          }}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-gray-100"
        >
          Este mês
        </button>

        <label className="ml-2 text-sm text-slate-500">De</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        />
        <label className="text-sm text-slate-500">Até</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        />

        <select
          value={cashSessionId}
          onChange={(e) => setCashSessionId(e.target.value)}
          className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos os caixas</option>
          {sessions?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.registerLabel} — {new Date(s.openedAt).toLocaleDateString('pt-BR')}
            </option>
          ))}
        </select>

        <select
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos os meios</option>
          {methods?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {data && data.rows.length > 0 && (
          <>
            <button onClick={exportCsv} className="text-sm text-amber-600 hover:underline">
              Exportar CSV
            </button>
            <button onClick={() => window.print()} className="text-sm text-amber-600 hover:underline">
              Imprimir
            </button>
          </>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {data && data.rows.length === 0 && (
        <p className="text-slate-400">Nenhum pagamento encontrado para o filtro selecionado.</p>
      )}

      {data && data.rows.length > 0 && (
        <div id="reconciliation-print">
          <p className="mb-2 hidden text-sm text-slate-500 print:block">
            Conferência financeira — {from} a {to}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-slate-500">
                <th className="py-2">Meio</th>
                <th className="py-2 text-right">Qtd.</th>
                <th className="py-2 text-right">Bruto</th>
                <th className="py-2 text-right">Líquido</th>
                <th className="py-2 text-right">Retido</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.paymentMethodId} className="border-b border-gray-200">
                  <td className="py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="py-2 text-right">{r.count}</td>
                  <td className="py-2 text-right">{formatBRL(r.grossCents)}</td>
                  <td className="py-2 text-right">{formatBRL(r.netCents)}</td>
                  <td className="py-2 text-right text-amber-600">
                    {r.grossCents !== r.netCents ? formatBRL(r.grossCents - r.netCents) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{data.totals.count}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.grossCents)}</td>
                <td className="py-2 text-right">{formatBRL(data.totals.netCents)}</td>
                <td className="py-2 text-right text-amber-600">
                  {formatBRL(data.totals.grossCents - data.totals.netCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
