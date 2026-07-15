import type { CashMovementType, CashSession } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { Button } from '../../components/ui/Button';
import { formatBRL, parseMoneyInput } from '../../utils/money';
import { CashMovementModal } from './CashMovementModal';
import { CloseCashModal } from './CloseCashModal';

const movementLabels: Record<CashMovementType, string> = {
  sangria: 'Sangria',
  suprimento: 'Suprimento',
};

function OpenCashForm({ suggestedLabel }: { suggestedLabel: string }) {
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState(suggestedLabel);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      cashApi.open({ openingAmountCents: parseMoneyInput(amount), registerLabel: label.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      setAmount('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) return setError('Dê um nome ao caixa (ex: Caixa 1)');
    mutation.mutate();
  }

  return (
    <div className="max-w-sm rounded-lg border border-dashed border-neutral-300 p-6">
      <h2 className="mb-1 text-lg font-semibold text-neutral-800">Abrir caixa</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Cada terminal da loja pode ter o próprio caixa aberto ao mesmo tempo.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Nome do caixa</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Caixa 1"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Valor inicial (fundo de troco)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          Abrir caixa
        </Button>
      </form>
    </div>
  );
}

function SessionCard({ session }: { session: CashSession }) {
  const [movementType, setMovementType] = useState<CashMovementType | null>(null);
  const [showClose, setShowClose] = useState(false);

  const { data: movements } = useQuery({
    queryKey: ['cash', 'movements', session.id],
    queryFn: () => cashApi.getMovements(session.id),
  });

  return (
    <div className="rounded-lg border border-neutral-200 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">{session.registerLabel}</h2>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          Aberto
        </span>
      </div>
      <p className="text-sm text-neutral-500">
        Desde {new Date(session.openedAt).toLocaleString('pt-BR')}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        Abertura: <span className="font-medium">{formatBRL(session.openingAmountCents)}</span>
      </p>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => setMovementType('suprimento')}>
          + Suprimento
        </Button>
        <Button variant="secondary" onClick={() => setMovementType('sangria')}>
          − Sangria
        </Button>
        <Button variant="danger" onClick={() => setShowClose(true)}>
          Fechar
        </Button>
      </div>

      {movements && movements.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 pt-2 text-sm">
          {movements.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <div>
                <span className={m.type === 'sangria' ? 'text-red-600' : 'text-green-600'}>
                  {movementLabels[m.type]}
                </span>
                <span className="ml-2 text-neutral-500">{m.reason}</span>
              </div>
              <span className="font-medium">{formatBRL(m.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {movementType && (
        <CashMovementModal
          sessionId={session.id}
          type={movementType}
          onClose={() => setMovementType(null)}
        />
      )}
      {showClose && <CloseCashModal sessionId={session.id} onClose={() => setShowClose(false)} />}
    </div>
  );
}

export function CashPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['cash', 'open-sessions'],
    queryFn: () => cashApi.openSessions(),
  });

  if (isLoading) return <div className="p-8 text-neutral-500">Carregando...</div>;

  const suggestedLabel = `Caixa ${(sessions?.length ?? 0) + 1}`;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-800">Caixa</h1>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sessions?.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
        <OpenCashForm suggestedLabel={suggestedLabel} />
      </div>
    </div>
  );
}
