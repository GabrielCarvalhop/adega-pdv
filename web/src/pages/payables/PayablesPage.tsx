import type { Payable } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { payablesApi } from '../../api/payables.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatBRL, parseMoneyInput } from '../../utils/money';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function NewPayableModal({ onClose }: { onClose: () => void }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      payablesApi.create({
        description: description.trim(),
        category: category.trim() || undefined,
        amountCents: parseMoneyInput(amount),
        dueDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) return setError('Descrição é obrigatória');
    if (parseMoneyInput(amount) <= 0) return setError('Informe um valor válido');
    mutation.mutate();
  }

  return (
    <Modal title="Nova conta a pagar" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Descrição</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Categoria</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Fixo, Fornecedor"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Valor (R$)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Vencimento</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PayablesPage() {
  const [filter, setFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [showNew, setShowNew] = useState(false);
  const queryClient = useQueryClient();

  const { data: payables, isLoading } = useQuery({
    queryKey: ['payables', { filter }],
    queryFn: () =>
      payablesApi.list(filter === 'all' ? {} : { paid: filter === 'paid' }),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) => payablesApi.setPaid(id, paid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payables'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => payablesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payables'] }),
  });

  const today = todayISO();
  const isOverdue = (p: Payable) => !p.paid && p.dueDate < today;
  const totalPending = (payables ?? []).filter((p) => !p.paid).reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Contas a pagar</h1>
        <Button onClick={() => setShowNew(true)}>+ Nova conta</Button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1">
          {(['pending', 'paid', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filter === f ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {f === 'pending' ? 'Pendentes' : f === 'paid' ? 'Pagas' : 'Todas'}
            </button>
          ))}
        </div>
        {filter !== 'paid' && (
          <p className="text-sm text-neutral-500">
            Total pendente: <span className="font-semibold text-neutral-800">{formatBRL(totalPending)}</span>
          </p>
        )}
      </div>

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Descrição</th>
              <th className="py-2">Categoria</th>
              <th className="py-2">Vencimento</th>
              <th className="py-2">Valor</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payables?.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="py-2 font-medium text-neutral-800">{p.description}</td>
                <td className="py-2 text-neutral-500">{p.category ?? '—'}</td>
                <td className={`py-2 ${isOverdue(p) ? 'font-semibold text-red-600' : ''}`}>
                  {new Date(p.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {isOverdue(p) && ' ⚠'}
                </td>
                <td className="py-2">{formatBRL(p.amountCents)}</td>
                <td className="py-2">
                  {p.paid ? (
                    <span className="text-green-600">Paga</span>
                  ) : isOverdue(p) ? (
                    <span className="text-red-600">Vencida</span>
                  ) : (
                    <span className="text-amber-600">Pendente</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => payMutation.mutate({ id: p.id, paid: !p.paid })}
                    className="mr-3 text-blue-600 hover:underline"
                  >
                    {p.paid ? 'Reabrir' : 'Marcar paga'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remover "${p.description}"?`)) removeMutation.mutate(p.id);
                    }}
                    className="text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {payables?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-neutral-400">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showNew && <NewPayableModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
