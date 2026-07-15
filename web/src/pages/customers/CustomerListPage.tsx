import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '../../api/customers.api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';

export function CustomerListPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canExport = user?.role === 'admin' || user?.role === 'gerente';

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Clientes</h1>
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
        className="mb-4 w-80 rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Nome</th>
              <th className="py-2">Telefone</th>
              <th className="py-2">Documento</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => (
              <tr key={customer.id} className="border-b border-neutral-100">
                <td className="py-2 font-medium text-neutral-800">
                  <Link to={`/clientes/${customer.id}`} className="hover:text-blue-600 hover:underline">
                    {customer.name}
                  </Link>
                </td>
                <td className="py-2">{customer.phone ?? '—'}</td>
                <td className="py-2">{customer.document ?? '—'}</td>
                <td className="py-2 text-right">
                  <Link to={`/clientes/${customer.id}/editar`} className="mr-3 text-blue-600 hover:underline">
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
            ))}
            {customers?.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-neutral-400">
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
