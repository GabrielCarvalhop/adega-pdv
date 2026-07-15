import type { CreateSalePaymentInput, PaymentMethod } from '@adega/shared';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatBRL, parseMoneyInput } from '../../utils/money';

interface PaymentLine {
  method: PaymentMethod;
  amount: string;
  amountReceived: string;
}

interface PaymentModalProps {
  totalCents: number;
  onClose: () => void;
  onConfirm: (payments: CreateSalePaymentInput[]) => void;
  submitting: boolean;
  error: string | null;
}

const methodLabels: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Cartão débito',
  credito: 'Cartão crédito',
  pix: 'Pix',
};

export function PaymentModal({ totalCents, onClose, onConfirm, submitting, error }: PaymentModalProps) {
  const [lines, setLines] = useState<PaymentLine[]>([
    { method: 'dinheiro', amount: (totalCents / 100).toFixed(2).replace('.', ','), amountReceived: '' },
  ]);

  const paidCents = lines.reduce((sum, l) => sum + parseMoneyInput(l.amount), 0);
  const remainingCents = totalCents - paidCents;

  function updateLine(index: number, patch: Partial<PaymentLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    const remaining = Math.max(0, remainingCents);
    setLines((prev) => [
      ...prev,
      { method: 'dinheiro', amount: (remaining / 100).toFixed(2).replace('.', ','), amountReceived: '' },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm() {
    const payments: CreateSalePaymentInput[] = lines.map((l) => {
      const amountCents = parseMoneyInput(l.amount);
      const amountReceivedCents =
        l.method === 'dinheiro' && l.amountReceived ? parseMoneyInput(l.amountReceived) : undefined;
      return { method: l.method, amountCents, amountReceivedCents };
    });
    onConfirm(payments);
  }

  const cashLine = lines.find((l) => l.method === 'dinheiro');
  const cashChange =
    cashLine && cashLine.amountReceived
      ? parseMoneyInput(cashLine.amountReceived) - parseMoneyInput(cashLine.amount)
      : 0;

  return (
    <Modal title="Pagamento" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-2xl font-bold text-neutral-800">{formatBRL(totalCents)}</p>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="rounded-md border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <select
                  value={line.method}
                  onChange={(e) => updateLine(index, { method: e.target.value as PaymentMethod })}
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  {Object.entries(methodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={line.amount}
                  onChange={(e) => updateLine(index, { amount: e.target.value })}
                  placeholder="0,00"
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-red-500 hover:underline"
                  >
                    ✕
                  </button>
                )}
              </div>
              {line.method === 'dinheiro' && (
                <div className="mt-2">
                  <label className="text-xs text-neutral-500">Valor recebido em dinheiro (p/ calcular troco)</label>
                  <input
                    value={line.amountReceived}
                    onChange={(e) => updateLine(index, { amountReceived: e.target.value })}
                    placeholder="0,00"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                    autoFocus={index === 0}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:underline">
          + Adicionar outra forma de pagamento
        </button>

        <div className="space-y-1 border-t border-neutral-200 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Saldo restante</span>
            <span className={remainingCents !== 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>
              {formatBRL(Math.abs(remainingCents))} {remainingCents < 0 ? '(pago a mais)' : ''}
            </span>
          </div>
          {cashChange > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Troco</span>
              <span className="font-semibold text-neutral-800">{formatBRL(cashChange)}</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar (Esc)
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={remainingCents !== 0 || submitting}
          >
            Confirmar venda
          </Button>
        </div>
      </div>
    </Modal>
  );
}
