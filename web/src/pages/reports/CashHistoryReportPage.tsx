import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { reportsApi } from '../../api/reports.api';
import { useAuth } from '../../auth/AuthContext';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { formatBRL } from '../../utils/money';
import { ReportsNav } from './ReportsNav';

const LARGE_DIFFERENCE_CENTS = 2000;

export function CashHistoryReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'cash-history', { from, to }],
    queryFn: () => reportsApi.cashHistory({ from: from || undefined, to: to || undefined }),
  });

  const canReopen = user?.role === 'GERENTE' || user?.role === 'ADMIN_LOJA';

  const reopen = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => cashApi.reopen(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'cash-history'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
    onError: (err: Error) => alert(err.message),
  });

  return (
    <div className="p-8">
      <ReportsNav />

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {isLoading && <p className="mt-4 text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Abertura</th>
              <th className="py-2">Operador</th>
              <th className="py-2">Fechamento</th>
              <th className="py-2">Status</th>
              <th className="py-2">Esperado</th>
              <th className="py-2">Contado</th>
              <th className="py-2">Diferença</th>
              {canReopen && <th className="py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {data?.map((session) => {
              const diff = session.differenceCents ?? 0;
              const isLarge = Math.abs(diff) >= LARGE_DIFFERENCE_CENTS;
              return (
                <tr key={session.id} className="border-b border-gray-200">
                  <td className="py-2">{new Date(session.openedAt).toLocaleString('pt-BR')}</td>
                  <td className="py-2">{session.openedByUserName ?? '—'}</td>
                  <td className="py-2">
                    {session.closedAt ? new Date(session.closedAt).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="py-2">{session.status === 'aberto' ? 'Aberto' : 'Fechado'}</td>
                  <td className="py-2">
                    {session.expectedAmountCents !== null ? formatBRL(session.expectedAmountCents) : '—'}
                  </td>
                  <td className="py-2">
                    {session.countedAmountCents !== null ? formatBRL(session.countedAmountCents) : '—'}
                  </td>
                  <td className={`py-2 font-medium ${isLarge ? 'text-red-600' : diff !== 0 ? 'text-amber-600' : ''}`}>
                    {session.differenceCents !== null ? formatBRL(session.differenceCents) : '—'}
                    {isLarge && ' ⚠'}
                  </td>
                  {canReopen && (
                    <td className="py-2 text-right">
                      {session.status === 'fechado' && (
                        <button
                          onClick={() => {
                            const reason = prompt('Motivo da reabertura do caixa:');
                            if (reason) reopen.mutate({ id: session.id, reason });
                          }}
                          className="text-xs text-amber-600 hover:underline"
                        >
                          Reabrir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {data?.length === 0 && (
              <tr>
                <td colSpan={canReopen ? 8 : 7} className="py-6 text-center text-slate-400">
                  Nenhum fechamento de caixa no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
