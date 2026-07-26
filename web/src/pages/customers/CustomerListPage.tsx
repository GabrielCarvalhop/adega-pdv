import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '../../api/customers.api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { formatBRL } from '../../utils/money';

export function CustomerListPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canExport = user?.role === 'ADMIN_LOJA' || user?.role === 'GERENTE' || user?.role === 'SUPER_ADMIN';

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', { search }],
    queryFn: () => customersApi.list(search || undefined),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => customersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-end">
        <div className="flex gap-2">
          {canExport && (
            <Button variant="secondary" onClick={() => customersApi.exportCsv().catch(() => undefined)}>
              Exportar CSV
            </Button>
          )}
          <Link to="/clientes/novo">
            <Button>+ Novo cliente</Button>
          </Link>
        </div>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome, telefone ou documento..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-80 rounded-xl border border-gray-300 px-3 py-2 text-sm"
      />

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Nome</th>
              <th className="py-2">Telefone</th>
              <th className="py-2">Documento</th>
              <th className="py-2 text-right">Total gasto</th>
              <th className="py-2 text-right">Saldo</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => {
              const isDebt = customer.balanceCents < 0;
              return (
                <tr key={customer.id} className="border-b border-gray-200">
                  <td className="py-2 font-medium text-gray-900">
                    <Link to={`/clientes/${customer.id}`} className="hover:text-amber-600 hover:underline">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="py-2">{customer.phone ?? '—'}</td>
                  <td className="py-2">{customer.document ?? '—'}</td>
                  <td className="py-2 text-right">{formatBRL(customer.totalSpentCents)}</td>
                  <td className="py-2 text-right">
                    {customer.balanceCents === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className={isDebt ? 'font-medium text-red-600' : 'font-medium text-green-600'}>
                        {isDebt ? '-' : '+'}
                        {formatBRL(Math.abs(customer.balanceCents))}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Link to={`/clientes/${customer.id}/editar`} className="mr-3 text-amber-600 hover:underline">
                      Editar
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm(`Remover o cliente "${customer.name}"?`)) removeMutation.mutate(customer.id);
                      }}
                      className="text-red-500 hover:underline"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
            {customers?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
