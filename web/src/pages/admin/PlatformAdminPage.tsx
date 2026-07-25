import type { CreateTenantResult, TenantStatus, TenantSummary } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformAdminApi } from '../../api/platformAdmin.api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

const statusLabels: Record<TenantStatus, { label: string; className: string }> = {
  trialing: { label: 'Em teste', className: 'bg-blue-100 text-blue-700' },
  active: { label: 'Ativa', className: 'bg-green-100 text-green-700' },
  past_due: { label: 'Vencida', className: 'bg-amber-100 text-amber-700' },
  canceled: { label: 'Cancelada', className: 'bg-gray-200 text-slate-500' },
};

function NewTenantModal({ onClose }: { onClose: () => void }) {
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTenantResult | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => platformAdminApi.createTenant({ storeName: storeName.trim(), ownerName: ownerName.trim() }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!storeName.trim() || !ownerName.trim()) {
      setError('Preencha o nome da loja e do responsável');
      return;
    }
    mutation.mutate();
  }

  if (result) {
    const credentialsText = `Loja: ${result.tenant.storeName}\nAcesso: ${result.loginUrl}\nUsuário: ${result.ownerName}\nPIN: ${result.initialPin}\n(o sistema vai pedir para trocar o PIN no primeiro acesso)`;
    return (
      <Modal title="Loja criada" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Repasse estes dados para o cliente (WhatsApp, e-mail...). O PIN só aparece agora, uma única vez.
          </p>
          <pre className="whitespace-pre-wrap rounded-xl border border-gray-300 bg-gray-50 p-3 text-sm">
            {credentialsText}
          </pre>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(credentialsText)}
            >
              Copiar
            </Button>
            <Button type="button" onClick={onClose}>
              Concluir
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nova loja" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-500">Nome da loja</label>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex: Adega do João"
            autoFocus
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">Nome do responsável</label>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Ex: João Silva"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Criando...' : 'Criar loja'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TenantRow({ tenant }: { tenant: TenantSummary }) {
  const { applyToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: (status: TenantStatus) => platformAdminApi.updateStatus(tenant.id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
    onError: (err: Error) => setError(err.message),
  });

  const enterMutation = useMutation({
    mutationFn: () => platformAdminApi.enterTenant(tenant.id),
    onSuccess: async ({ token }) => {
      await applyToken(token);
      navigate('/venda');
    },
    onError: (err: Error) => setError(err.message),
  });

  const status = statusLabels[tenant.status];

  return (
    <tr className="border-b border-gray-200">
      <td className="py-2">
        <div className="font-medium text-gray-900">{tenant.storeName}</div>
        <div className="text-xs text-slate-400">/t/{tenant.slug}</div>
      </td>
      <td className="py-2 text-slate-500">{tenant.ownerName ?? '—'}</td>
      <td className="py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </td>
      <td className="py-2 text-slate-500">{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          {error && <span className="text-xs text-red-600">{error}</span>}
          <select
            value={tenant.status}
            onChange={(e) => statusMutation.mutate(e.target.value as TenantStatus)}
            disabled={statusMutation.isPending}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="trialing">Em teste</option>
            <option value="active">Ativa</option>
            <option value="past_due">Vencida</option>
            <option value="canceled">Cancelada</option>
          </select>
          <button
            type="button"
            onClick={() => enterMutation.mutate()}
            disabled={enterMutation.isPending}
            className="text-amber-600 hover:underline disabled:opacity-50"
          >
            Entrar
          </button>
        </div>
      </td>
    </tr>
  );
}

export function PlatformAdminPage() {
  const [showNew, setShowNew] = useState(false);
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: () => platformAdminApi.listTenants(),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Todas as lojas cadastradas na plataforma.</p>
        <Button onClick={() => setShowNew(true)}>+ Nova loja</Button>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Loja</th>
              <th className="py-2">Responsável</th>
              <th className="py-2">Status</th>
              <th className="py-2">Criada em</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tenants?.map((t) => (
              <TenantRow key={t.id} tenant={t} />
            ))}
            {tenants?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Nenhuma loja cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showNew && <NewTenantModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
