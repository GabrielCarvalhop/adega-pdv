import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { accountApi, setAccountToken } from '../../api/account.api';
import { Button } from '../../components/ui/Button';

const statusLabels: Record<string, { label: string; className: string }> = {
  trialing: { label: 'Período de teste', className: 'bg-blue-100 text-blue-700' },
  active: { label: 'Assinatura ativa', className: 'bg-green-100 text-green-700' },
  past_due: { label: 'Pagamento pendente', className: 'bg-red-100 text-red-700' },
  canceled: { label: 'Cancelada', className: 'bg-gray-200 text-slate-500' },
};

export function AccountDashboardPage() {
  const navigate = useNavigate();

  const { data: account, isLoading, isError } = useQuery({
    queryKey: ['account', 'me'],
    queryFn: () => accountApi.me(),
    retry: false,
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Carregando...</div>;
  }

  if (isError || !account) {
    setAccountToken(null);
    navigate('/conta/login', { replace: true });
    return null;
  }

  const status = statusLabels[account.store.status] ?? statusLabels.canceled;
  const storeLoginPath = `/t/${account.store.slug}/login`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-gray-900">{account.store.name}</h1>
            <p className="text-sm text-slate-500">{account.owner.email}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>

        {account.store.status === 'trialing' && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Seu teste grátis termina em <strong>{account.store.trialDaysLeft} dia(s)</strong> (
            {new Date(account.store.trialEndsAt).toLocaleDateString('pt-BR')}). Em breve você
            poderá ativar a assinatura por aqui.
          </div>
        )}

        <div className="mb-6 rounded-xl border border-gray-300 p-4">
          <p className="mb-1 text-sm font-medium text-slate-500">Acesso do caixa (sua equipe)</p>
          <Link to={storeLoginPath} className="font-mono text-sm text-amber-600 hover:underline">
            {window.location.origin}
            {storeLoginPath}
          </Link>
          <p className="mt-2 text-xs text-slate-400">
            Compartilhe este endereço com seus operadores — cada um entra com o próprio PIN.
          </p>
        </div>

        <div className="flex gap-2">
          <Link to={storeLoginPath} className="flex-1">
            <Button className="w-full">Abrir o PDV</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setAccountToken(null);
              navigate('/conta/login', { replace: true });
            }}
          >
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
