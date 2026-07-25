import type { CreateStockMovementRequest, Product } from '@adega/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { stockApi } from '../api/stock.api';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface StockMovementModalProps {
  product: Product;
  onClose: () => void;
}

const typeLabels: Record<CreateStockMovementRequest['type'], string> = {
  entrada_manual: 'Entrada de mercadoria',
  saida_manual: 'Saída manual',
  ajuste: 'Ajuste (correção de contagem)',
  devolucao: 'Devolução de cliente',
  perda: 'Perda',
  avaria: 'Avaria',
  consumo_interno: 'Consumo interno',
};

export function StockMovementModal({ product, onClose }: StockMovementModalProps) {
  const [mode, setMode] = useState<'movimento' | 'inventario'>('movimento');
  const [type, setType] = useState<CreateStockMovementRequest['type']>('entrada_manual');
  const [quantity, setQuantity] = useState('');
  const [countedQuantity, setCountedQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateStockMovementRequest) => stockApi.createMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const inventoryDelta =
    countedQuantity.trim() !== '' ? Number(countedQuantity) - product.stockQuantity : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'inventario') {
      if (countedQuantity.trim() === '' || Number.isNaN(Number(countedQuantity))) {
        setError('Informe a quantidade contada fisicamente');
        return;
      }
      if (inventoryDelta === 0) {
        setError('A contagem já bate com o estoque atual — nada a ajustar');
        return;
      }
      mutation.mutate({
        productId: product.id,
        type: 'ajuste',
        quantity: inventoryDelta!,
        reason: reason.trim() || 'Inventário — contagem física',
      });
      return;
    }

    const qty = Number(quantity);
    if (!qty || (type !== 'ajuste' && qty <= 0)) {
      setError('Informe uma quantidade válida');
      return;
    }
    if (!reason.trim()) {
      setError('Informe o motivo');
      return;
    }
    mutation.mutate({ productId: product.id, type, quantity: qty, reason: reason.trim() });
  }

  return (
    <Modal title={`Movimentar estoque — ${product.name}`} onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode('movimento')}
          className={`px-3 py-2 text-sm font-medium ${
            mode === 'movimento' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-slate-500'
          }`}
        >
          Movimento
        </button>
        <button
          type="button"
          onClick={() => setMode('inventario')}
          className={`px-3 py-2 text-sm font-medium ${
            mode === 'inventario' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-slate-500'
          }`}
        >
          Inventário (contagem)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Estoque atual (sistema): <span className="font-semibold">{product.stockQuantity}</span>
        </p>

        {mode === 'inventario' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-500">
                Quantidade contada fisicamente
              </label>
              <input
                type="number"
                value={countedQuantity}
                onChange={(e) => setCountedQuantity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                autoFocus
              />
              {inventoryDelta !== null && inventoryDelta !== 0 && (
                <p className={`mt-1 text-sm ${inventoryDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Ajuste: {inventoryDelta > 0 ? '+' : ''}
                  {inventoryDelta} un.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500">Observação (opcional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Inventário — contagem física"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-500">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CreateStockMovementRequest['type'])}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500">
                Quantidade {type === 'ajuste' && '(use negativo para reduzir)'}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-500">Motivo</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: compra fornecedor X, quebra, vencido..."
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
          </>
        )}

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
