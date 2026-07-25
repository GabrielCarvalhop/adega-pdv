import type { CashMovementType } from '@adega/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { parseMoneyInput } from '../../utils/money';

interface CashMovementModalProps {
  sessionId: number;
  type: CashMovementType;
  onClose: () => void;
}

const titles: Record<CashMovementType, string> = {
  sangria: 'Sangria (retirada de caixa)',
  suprimento: 'Suprimento (adição ao caixa)',
};

export function CashMovementModal({ sessionId, type, onClose }: CashMovementModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      cashApi.addMovement(sessionId, { type, amountCents: parseMoneyInput(amount), reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (parseMoneyInput(amount) <= 0) {
      setError('Informe um valor válido');
      return;
    }
    if (!reason.trim()) {
      setError('Informe o motivo');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal title={titles[type]} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-500">Valor (R$)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">Motivo</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
