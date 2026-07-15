import type { CreateCustomerAddressRequest } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customersApi } from '../../api/customers.api';
import { Button } from '../../components/ui/Button';
import { formatBRL } from '../../utils/money';

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
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-lg border border-dashed border-neutral-300 p-3">
      <div className="grid grid-cols-3 gap-2">
        <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua *" className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Bairro" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Apelido (Casa, Trabalho...)" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referência" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-600">
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

  if (isLoading || !customer) return <div className="p-8 text-neutral-500">Carregando...</div>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">{customer.name}</h1>
          <p className="text-sm text-neutral-500">
            {customer.phone ?? 'sem telefone'}
            {customer.email ? ` · ${customer.email}` : ''}
            {customer.document ? ` · ${customer.document}` : ''}
          </p>
          {customer.notes && <p className="mt-1 text-sm italic text-neutral-500">"{customer.notes}"</p>}
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
        <div className="rounded-lg border border-neutral-200 p-4 text-center">
          <p className="text-2xl font-bold text-neutral-800">{stats?.totalPurchases ?? '—'}</p>
          <p className="text-xs text-neutral-500">Compras</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 text-center">
          <p className="text-2xl font-bold text-neutral-800">
            {stats ? formatBRL(stats.totalSpentCents) : '—'}
          </p>
          <p className="text-xs text-neutral-500">Total gasto</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 text-center">
          <p className="text-2xl font-bold text-neutral-800">
            {stats ? formatBRL(stats.avgTicketCents) : '—'}
          </p>
          <p className="text-xs text-neutral-500">Ticket médio</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 text-center">
          <p className="text-lg font-bold text-neutral-800">
            {stats?.lastPurchaseAt
              ? new Date(stats.lastPurchaseAt).toLocaleDateString('pt-BR')
              : 'Nunca'}
          </p>
          <p className="text-xs text-neutral-500">Última compra</p>
        </div>
      </div>

      {stats && stats.topProducts.length > 0 && (
        <div className="mb-6 rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Produtos mais comprados</h2>
          <ul className="space-y-1 text-sm">
            {stats.topProducts.map((p) => (
              <li key={p.name} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-neutral-500">{p.quantity}x</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Endereços</h2>
          {!addingAddress && (
            <button onClick={() => setAddingAddress(true)} className="text-sm text-blue-600 hover:underline">
              + Adicionar
            </button>
          )}
        </div>
        {addresses?.length === 0 && !addingAddress && (
          <p className="text-sm text-neutral-400">Nenhum endereço cadastrado.</p>
        )}
        <ul className="space-y-2 text-sm">
          {addresses?.map((a) => (
            <li key={a.id} className="flex items-start justify-between rounded-md bg-neutral-50 px-3 py-2">
              <div>
                <p className="font-medium text-neutral-800">
                  {a.label ?? 'Endereço'}
                  {a.isPrimary && (
                    <span className="ml-2 rounded-full bg-blue-100 px-1.5 text-xs text-blue-700">principal</span>
                  )}
                </p>
                <p className="text-neutral-600">
                  {a.street}
                  {a.number ? `, ${a.number}` : ''}
                  {a.district ? ` — ${a.district}` : ''}
                  {a.city ? `, ${a.city}` : ''}
                </p>
                {a.reference && <p className="text-xs text-neutral-400">Ref: {a.reference}</p>}
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
