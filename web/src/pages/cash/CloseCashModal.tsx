import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, FormEvent, useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatBRL, parseMoneyInput } from '../../utils/money';

interface CloseCashModalProps {
  sessionId: number;
  onClose: () => void;
}

export function CloseCashModal({ sessionId, onClose }: CloseCashModalProps) {
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: expected } = useQuery({
    queryKey: ['cash', 'expected', sessionId],
    queryFn: () => cashApi.getExpected(sessionId),
  });

  const { data: summary } = useQuery({
    queryKey: ['cash', 'summary', sessionId],
    queryFn: () => cashApi.getSummary(sessionId),
  });

  const countedCents = parseMoneyInput(counted);
  const difference = expected ? countedCents - expected.expectedAmountCents : 0;

  const mutation = useMutation({
    mutationFn: () => cashApi.close(sessionId, { countedAmountCents: countedCents, notes: notes.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!counted) {
      setError('Informe o valor contado');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal title="Fechar caixa" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Valor esperado em caixa:{' '}
          <span className="font-semibold">
            {expected ? formatBRL(expected.expectedAmountCents) : '...'}
          </span>
        </p>

        {summary && (
          <div className="rounded-lg bg-gray-100 p-3 text-sm">
            <p className="mb-1 font-medium text-slate-500">
              {summary.salesCount} venda(s) · {formatBRL(summary.salesTotalCents)}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-500">
              {summary.paymentMethods.map((m) => (
                <Fragment key={m.id}>
                  <span>{m.label}</span>
                  <span className="text-right">{formatBRL(summary.paymentBreakdown[m.code] ?? 0)}</span>
                </Fragment>
              ))}
            </div>
            {(summary.suprimentosCents > 0 || summary.sangriasCents > 0 || summary.canceledCount > 0) && (
              <div className="mt-1 border-t border-gray-300 pt-1 text-xs text-slate-500">
                Suprimentos {formatBRL(summary.suprimentosCents)} · Sangrias{' '}
                {formatBRL(summary.sangriasCents)} · {summary.canceledCount} cancelada(s)
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Só o dinheiro fica fisicamente no caixa — Pix e cartão não entram na contagem.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-500">Valor contado (R$)</label>
          <input
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            autoFocus
          />
        </div>

        {expected && counted && difference !== 0 && (
          <p className={`text-sm font-medium ${difference < 0 ? 'text-red-600' : 'text-amber-600'}`}>
            Diferença: {difference < 0 ? '-' : '+'}
            {formatBRL(Math.abs(difference))} ({difference < 0 ? 'falta' : 'sobra'})
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-500">
            Observação {expected && counted && difference !== 0 ? '(obrigatória)' : '(opcional)'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={mutation.isPending}>
            Fechar caixa
          </Button>
        </div>
      </form>
    </Modal>
  );
}
