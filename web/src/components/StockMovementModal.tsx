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
  const [type, setType] = useState<CreateStockMovementRequest['type']>('entrada_manual');
  const [quantity, setQuantity] = useState('');
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-500">
          Estoque atual: <span className="font-semibold">{product.stockQuantity}</span>
        </p>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CreateStockMovementRequest['type'])}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          >
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Quantidade {type === 'ajuste' && '(use negativo para reduzir)'}
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Motivo</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: compra fornecedor X, quebra, vencido..."
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
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
