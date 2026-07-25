import type { CreateCustomerAddressRequest, LedgerEntryType } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customersApi } from '../../api/customers.api';
import { Button } from '../../components/ui/Button';
import { formatBRL, parseMoneyInput } from '../../utils/money';

const ledgerTypeLabels: Record<LedgerEntryType, string> = {
  fiado_venda: 'Venda fiado',
  pagamento: 'Pagamento',
  credito_adicionado: 'Crédito adicionado',
  ajuste: 'Ajuste',
};

function BalanceSection({ customerId, balanceCents }: { customerId: number; balanceCents: number }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'pagamento' | 'credito' | 'ajuste' | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: ledger } = useQuery({
    queryKey: ['customers', customerId, 'ledger'],
    queryFn: () => customersApi.getLedger(customerId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['customers', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'ledger'] });
  }

  const mutation = useMutation({
    mutationFn: () => {
      const amountCents = parseMoneyInput(amount);
      if (action === 'pagamento') return customersApi.addLedgerPayment(customerId, { amountCents, notes });
      if (action === 'credito') return customersApi.addLedgerCredit(customerId, { amountCents, notes });
      return customersApi.addLedgerAdjustment(customerId, { amountCents, notes });
    },
    onSuccess: () => {
      invalidate();
      setAction(null);
      setAmount('');
      setNotes('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = parseMoneyInput(amount);
    if (action === 'ajuste') {
      if (value === 0) return setError('Informe um valor diferente de zero');
      if (!notes.trim()) return setError('Ajuste exige justificativa');
    } else if (value <= 0) {
      return setError('Valor deve ser positivo');
    }
    mutation.mutate();
  }

  const isDebt = balanceCents < 0;

  return (
    <div className="mb-6 rounded-xl border border-gray-300 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500">Saldo (conta-corrente)</h2>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setAction('pagamento')} className="text-amber-600 hover:underline">
            + Registrar pagamento
          </button>
          <button onClick={() => setAction('credito')} className="text-amber-600 hover:underline">
            + Adicionar crédito
          </button>
          <button onClick={() => setAction('ajuste')} className="text-amber-600 hover:underline">
            Ajuste
          </button>
        </div>
      </div>

      <p className={`text-2xl font-bold ${isDebt ? 'text-red-600' : 'text-green-600'}`}>
        {formatBRL(Math.abs(balanceCents))}
      </p>
      <p className="text-xs text-slate-500">
        {isDebt ? 'Cliente deve à loja (fiado)' : balanceCents > 0 ? 'Crédito a favor do cliente' : 'Sem pendências'}
      </p>

      {action && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
          <p className="text-sm font-medium text-gray-900">
            {action === 'pagamento' && 'Registrar pagamento (reduz a dívida)'}
            {action === 'credito' && 'Adicionar crédito (a favor do cliente)'}
            {action === 'ajuste' && 'Ajuste manual (positivo ou negativo)'}
          </p>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={action === 'ajuste' ? '0,00 (use - para reduzir)' : '0,00'}
            className="w-40 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            autoFocus
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={action === 'ajuste' ? 'Justificativa (obrigatória)' : 'Observação (opcional)'}
            className="w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              Confirmar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {ledger && ledger.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-gray-200 pt-3 text-sm">
          {ledger.map((entry) => {
            const isOverdue =
              entry.dueDate !== null &&
              entry.balanceAfterCents < 0 &&
              new Date(entry.dueDate) < new Date(new Date().toDateString());
            return (
              <li key={entry.id} className="flex items-center justify-between">
                <div>
                  <span className="text-gray-900">{ledgerTypeLabels[entry.type]}</span>
                  {entry.notes && <span className="ml-2 text-xs text-slate-400">{entry.notes}</span>}
                  <span className="ml-2 text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  {entry.dueDate && (
                    <span className={`ml-2 text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-slate-400'}`}>
                      vence {new Date(entry.dueDate).toLocaleDateString('pt-BR')}
                      {isOverdue && ' — vencido'}
                    </span>
                  )}
                </div>
                <span className={entry.amountCents < 0 ? 'text-red-600' : 'text-green-600'}>
                  {entry.amountCents < 0 ? '-' : '+'}
                  {formatBRL(Math.abs(entry.amountCents))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddressForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [label, setLabel] = useState('');
  const [reference, setReference] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateCustomerAddressRequest) => customersApi.addAddress(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'addresses'] });
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!street.trim()) return setError('Rua é obrigatória');
    mutation.mutate({
      street: street.trim(),
      number: number.trim() || undefined,
      district: district.trim() || undefined,
      city: city.trim() || undefined,
      label: label.trim() || undefined,
      reference: reference.trim() || undefined,
      isPrimary,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
      <div className="grid grid-cols-3 gap-2">
        <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua *" className="col-span-2 rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Bairro" className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Apelido (Casa, Trabalho...)" className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referência" className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-500">
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
        Endereço principal
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>Salvar endereço</Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

export function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const [addingAddress, setAddingAddress] = useState(false);
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customers', customerId],
    queryFn: () => customersApi.getById(customerId),
  });
  const { data: stats } = useQuery({
    queryKey: ['customers', customerId, 'stats'],
    queryFn: () => customersApi.getStats(customerId),
  });
  const { data: addresses } = useQuery({
    queryKey: ['customers', customerId, 'addresses'],
    queryFn: () => customersApi.listAddresses(customerId),
  });

  const removeAddress = useMutation({
    mutationFn: (addressId: number) => customersApi.removeAddress(customerId, addressId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'addresses'] }),
  });

  if (isLoading || !customer) return <div className="p-8 text-slate-500">Carregando...</div>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-slate-500">
            {customer.phone ?? 'sem telefone'}
            {customer.email ? ` · ${customer.email}` : ''}
            {customer.document ? ` · ${customer.document}` : ''}
          </p>
          {customer.notes && <p className="mt-1 text-sm italic text-slate-500">"{customer.notes}"</p>}
        </div>
        <div className="flex gap-2">
          <Link to={`/clientes/${customer.id}/editar`}>
            <Button variant="secondary">Editar</Button>
          </Link>
          <Link to="/clientes">
            <Button variant="secondary">Voltar</Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-300 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats?.totalPurchases ?? '—'}</p>
          <p className="text-xs text-slate-500">Compras</p>
        </div>
        <div className="rounded-xl border border-gray-300 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats ? formatBRL(stats.totalSpentCents) : '—'}
          </p>
          <p className="text-xs text-slate-500">Total gasto</p>
        </div>
        <div className="rounded-xl border border-gray-300 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats ? formatBRL(stats.avgTicketCents) : '—'}
          </p>
          <p className="text-xs text-slate-500">Ticket médio</p>
        </div>
        <div className="rounded-xl border border-gray-300 p-4 text-center">
          <p className="text-lg font-bold text-gray-900">
            {stats?.lastPurchaseAt
              ? new Date(stats.lastPurchaseAt).toLocaleDateString('pt-BR')
              : 'Nunca'}
          </p>
          <p className="text-xs text-slate-500">Última compra</p>
        </div>
      </div>

      <BalanceSection customerId={customerId} balanceCents={customer.balanceCents} />

      {stats && stats.topProducts.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-300 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">Produtos mais comprados</h2>
          <ul className="space-y-1 text-sm">
            {stats.topProducts.map((p) => (
              <li key={p.name} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-slate-500">{p.quantity}x</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-300 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">Endereços</h2>
          {!addingAddress && (
            <button onClick={() => setAddingAddress(true)} className="text-sm text-amber-600 hover:underline">
              + Adicionar
            </button>
          )}
        </div>
        {addresses?.length === 0 && !addingAddress && (
          <p className="text-sm text-slate-400">Nenhum endereço cadastrado.</p>
        )}
        <ul className="space-y-2 text-sm">
          {addresses?.map((a) => (
            <li key={a.id} className="flex items-start justify-between rounded-lg bg-gray-100 px-3 py-2">
              <div>
                <p className="font-medium text-gray-900">
                  {a.label ?? 'Endereço'}
                  {a.isPrimary && (
                    <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700">principal</span>
                  )}
                </p>
                <p className="text-slate-500">
                  {a.street}
                  {a.number ? `, ${a.number}` : ''}
                  {a.district ? ` — ${a.district}` : ''}
                  {a.city ? `, ${a.city}` : ''}
                </p>
                {a.reference && <p className="text-xs text-slate-400">Ref: {a.reference}</p>}
              </div>
              <button
                onClick={() => removeAddress.mutate(a.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        {addingAddress && <AddressForm customerId={customerId} onDone={() => setAddingAddress(false)} />}
      </div>
    </div>
  );
}
