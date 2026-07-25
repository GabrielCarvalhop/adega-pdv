import type { Customer, CreateSalePaymentInput, SaleType } from '@adega/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { paymentMethodsApi } from '../../api/paymentMethods.api';
import { surchargeRulesApi } from '../../api/surchargeRules.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatBRL, parseMoneyInput } from '../../utils/money';

interface PaymentLine {
  paymentMethodId: number;
  amount: string;
  amountReceived: string;
}

interface PaymentModalProps {
  totalCents: number;
  saleType?: SaleType;
  customerId: number | '';
  customers: Customer[];
  onCustomerChange: (id: number | '') => void;
  onClose: () => void;
  onConfirm: (payments: CreateSalePaymentInput[]) => void;
  submitting: boolean;
  error: string | null;
}

const LAST_METHOD_KEY = 'adega_last_payment_method';

export function PaymentModal({
  totalCents,
  saleType = 'varejo',
  customerId,
  customers,
  onCustomerChange,
  onClose,
  onConfirm,
  submitting,
  error,
}: PaymentModalProps) {
  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.list(),
  });
  const { data: surchargeRules } = useQuery({
    queryKey: ['surcharge-rules'],
    queryFn: () => surchargeRulesApi.list(),
    enabled: saleType === 'atacado',
  });
  const activeMethods = (methods ?? []).filter((m) => m.active);
  const methodsById = new Map(activeMethods.map((m) => [m.id, m]));
  const atacadoPercentByMethod = new Map(
    (surchargeRules ?? []).filter((r) => r.saleType === 'atacado' && r.active).map((r) => [r.paymentMethodId, r.percent])
  );

  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [splitMode, setSplitMode] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const receivedRef = useRef<HTMLInputElement>(null);

  // Pré-popula a primeira linha assim que os métodos carregam, lembrando o
  // último meio usado neste terminal (na maioria dos balcões é sempre o mesmo).
  useEffect(() => {
    if (activeMethods.length > 0 && lines.length === 0) {
      const savedId = Number(localStorage.getItem(LAST_METHOD_KEY));
      const initial = activeMethods.find((m) => m.id === savedId) ?? activeMethods[0];
      setLines([
        {
          paymentMethodId: initial.id,
          amount: (totalCents / 100).toFixed(2).replace('.', ','),
          amountReceived: '',
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMethods.length]);

  // Mesma regra do backend: acréscimo só quando TODAS as linhas usam meios
  // com o mesmo percentual ativo — evita mostrar valor ambíguo em split.
  const percents = lines.map((l) => atacadoPercentByMethod.get(l.paymentMethodId) ?? 0);
  const uniquePercents = [...new Set(percents.filter((p) => p > 0))];
  const surchargePercent = saleType === 'atacado' && uniquePercents.length === 1 ? uniquePercents[0] : 0;
  const surchargeCents = Math.round((totalCents * surchargePercent) / 100);
  const targetTotalCents = totalCents + surchargeCents;

  // Fora do split, o valor da linha única acompanha o total-alvo (que muda
  // com o acréscimo de atacado) — zero digitação no caso comum.
  useEffect(() => {
    if (!splitMode && lines.length === 1) {
      const expected = (targetTotalCents / 100).toFixed(2).replace('.', ',');
      if (lines[0].amount !== expected) {
        setLines((prev) => [{ ...prev[0], amount: expected }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTotalCents, splitMode]);

  const paidCents = lines.reduce((sum, l) => sum + parseMoneyInput(l.amount), 0);
  const remainingCents = targetTotalCents - paidCents;

  function updateLine(index: number, patch: Partial<PaymentLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function chooseMethod(methodId: number) {
    localStorage.setItem(LAST_METHOD_KEY, String(methodId));
    updateLine(0, { paymentMethodId: methodId });
    // Dinheiro pede o valor recebido para calcular troco; nos demais o Enter
    // já confirma direto.
    const allowsChange = methodsById.get(methodId)?.allowsChange ?? false;
    setTimeout(() => {
      if (allowsChange) receivedRef.current?.focus();
      else confirmRef.current?.focus();
    }, 0);
  }

  function addLine() {
    const remaining = Math.max(0, remainingCents);
    setSplitMode(true);
    setLines((prev) => [
      ...prev,
      {
        paymentMethodId: activeMethods[0]?.id ?? 0,
        amount: (remaining / 100).toFixed(2).replace('.', ','),
        amountReceived: '',
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length <= 1) setSplitMode(false);
      return next;
    });
  }

  const cashLine = lines.find((l) => methodsById.get(l.paymentMethodId)?.allowsChange);
  const cashChange =
    cashLine && cashLine.amountReceived
      ? parseMoneyInput(cashLine.amountReceived) - parseMoneyInput(cashLine.amount)
      : 0;

  const hasFiado = lines.some((l) => methodsById.get(l.paymentMethodId)?.kind === 'fiado');
  const missingCustomerForFiado = hasFiado && customerId === '';
  const canConfirm =
    remainingCents === 0 && !submitting && lines.length > 0 && !missingCustomerForFiado && cashChange >= 0;

  function handleConfirm() {
    if (!canConfirm) return;
    const payments: CreateSalePaymentInput[] = lines.map((l) => {
      const amountCents = parseMoneyInput(l.amount);
      const isCash = methodsById.get(l.paymentMethodId)?.allowsChange ?? false;
      const amountReceivedCents = isCash && l.amountReceived ? parseMoneyInput(l.amountReceived) : undefined;
      return { paymentMethodId: l.paymentMethodId, amountCents, amountReceivedCents };
    });
    onConfirm(payments);
  }

  // Teclado: 1-9 escolhe o meio de pagamento (fora do split), Enter/F9 confirma.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F9') {
        e.preventDefault();
        handleConfirm();
        return;
      }
      if (e.key === 'Enter') {
        // Enter em qualquer lugar do modal confirma (inputs de valor incluídos).
        e.preventDefault();
        handleConfirm();
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      if (!splitMode && !typing && /^[1-9]$/.test(e.key)) {
        const method = activeMethods[Number(e.key) - 1];
        if (method) {
          e.preventDefault();
          chooseMethod(method.id);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMethods, lines, splitMode, canConfirm, customerId]);

  const selectedMethod = lines[0] ? methodsById.get(lines[0].paymentMethodId) : undefined;

  return (
    <Modal title="Pagamento" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-3xl font-bold text-gray-900">{formatBRL(targetTotalCents)}</p>
          {surchargeCents > 0 && (
            <p className="text-sm font-medium text-amber-600">
              Inclui acréscimo de {surchargePercent}% (atacado): +{formatBRL(surchargeCents)}
            </p>
          )}
        </div>

        {!splitMode && lines.length === 1 ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {activeMethods.map((m, index) => {
                const selected = lines[0].paymentMethodId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => chooseMethod(m.id)}
                    className={`flex items-center justify-between rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold ${
                      selected
                        ? 'border-amber-600 bg-amber-50 text-gray-900'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span>{m.label}</span>
                    {index < 9 && (
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold ${
                          selected ? 'bg-amber-600 text-white' : 'bg-gray-100 text-slate-400'
                        }`}
                      >
                        {index + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedMethod?.allowsChange && (
              <div>
                <label className="text-sm text-slate-500">Valor recebido (p/ calcular troco)</label>
                <input
                  ref={receivedRef}
                  value={lines[0].amountReceived}
                  onChange={(e) => updateLine(0, { amountReceived: e.target.value })}
                  placeholder={(targetTotalCents / 100).toFixed(2).replace('.', ',')}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-lg"
                  autoFocus
                />
                {cashChange > 0 && (
                  <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-lg font-bold text-green-700">
                    Troco: {formatBRL(cashChange)}
                  </p>
                )}
                {cashChange < 0 && lines[0].amountReceived && (
                  <p className="mt-2 text-sm font-medium text-red-600">
                    Recebido menor que o total — faltam {formatBRL(-cashChange)}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="rounded-xl border border-gray-300 p-3">
                <div className="flex items-center gap-2">
                  <select
                    value={line.paymentMethodId}
                    onChange={(e) => updateLine(index, { paymentMethodId: Number(e.target.value) })}
                    className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {activeMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={line.amount}
                    onChange={(e) => updateLine(index, { amount: e.target.value })}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      aria-label="Remover forma de pagamento"
                      className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {methodsById.get(line.paymentMethodId)?.allowsChange && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-500">Valor recebido (p/ calcular troco)</label>
                    <input
                      value={line.amountReceived}
                      onChange={(e) => updateLine(index, { amountReceived: e.target.value })}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={addLine} className="text-sm text-amber-600 hover:underline">
          + Dividir em mais de uma forma de pagamento
        </button>

        {hasFiado && (
          <div className="rounded-xl border border-gray-300 p-3">
            <label className="block text-sm font-medium text-slate-500">
              Cliente (obrigatório para fiado)
            </label>
            <select
              value={customerId}
              onChange={(e) => onCustomerChange(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
              autoFocus
            >
              <option value="">Selecione o cliente...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {customerId !== '' &&
              (() => {
                const selected = customers.find((c) => c.id === customerId);
                if (!selected || selected.balanceCents === 0) return null;
                const isDebt = selected.balanceCents < 0;
                return (
                  <p className={`mt-1 text-xs ${isDebt ? 'text-red-600' : 'text-green-600'}`}>
                    {isDebt
                      ? `Já deve ${formatBRL(-selected.balanceCents)}`
                      : `Crédito de ${formatBRL(selected.balanceCents)}`}
                  </p>
                );
              })()}
          </div>
        )}

        {(splitMode || remainingCents !== 0) && (
          <div className="space-y-1 border-t border-gray-300 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Saldo restante</span>
              <span className={remainingCents !== 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>
                {formatBRL(Math.abs(remainingCents))} {remainingCents < 0 ? '(pago a mais)' : ''}
              </span>
            </div>
            {splitMode && cashChange > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Troco</span>
                <span className="font-semibold text-gray-900">{formatBRL(cashChange)}</span>
              </div>
            )}
          </div>
        )}

        {missingCustomerForFiado && (
          <p className="text-sm text-red-600">Selecione o cliente acima para vender fiado.</p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">1-9 escolhe o meio · Enter confirma · Esc volta</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Voltar (Esc)
            </Button>
            <Button ref={confirmRef} type="button" onClick={handleConfirm} disabled={!canConfirm}>
              {submitting ? 'Registrando...' : 'Confirmar (Enter)'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
