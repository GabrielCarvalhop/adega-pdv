import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { setSubscriptionBlockedHandler } from '../api/client';
import { ordersApi } from '../api/orders.api';
import { useAuth } from '../auth/AuthContext';
import { ForceChangePinModal } from './ForceChangePinModal';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { isOrderSoundEnabled } from '../pages/orders/OrdersPage';

function playOrderBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => void ctx.close();
  } catch {
    // navegador pode bloquear áudio sem interação — silencioso
  }
}

interface NavItem {
  to: string;
  label: string;
  mono: string;
  /** Roles que enxergam o item. Ausente = todos. (A API é quem bloqueia de verdade.) */
  roles?: string[];
  /** Prefixo a excluir do match de "ativo" (ex.: Produtos não deve acender em /estoque/movimentacoes). */
  excludePrefix?: string;
}

const navItems: NavItem[] = [
  { to: '/admin', label: 'Painel de lojas', mono: 'PL', roles: ['SUPER_ADMIN'] },
  { to: '/venda', label: 'Venda', mono: 'VD' },
  { to: '/pedidos', label: 'Pedidos', mono: 'PD' },
  { to: '/estoque', label: 'Produtos', mono: 'PR', excludePrefix: '/estoque/movimentacoes' },
  { to: '/estoque/movimentacoes', label: 'Estoque', mono: 'ES' },
  { to: '/cardapio', label: 'Cardápio online', mono: 'CD', roles: ['GERENTE', 'ADMIN_LOJA'] },
  { to: '/complementos', label: 'Complementos', mono: 'CM', roles: ['GERENTE', 'ADMIN_LOJA'] },
  { to: '/clientes', label: 'Clientes', mono: 'CL' },
  { to: '/caixa', label: 'Caixa', mono: 'CX' },
  // Backend exige gerente/admin nessas rotas — esconder do operador evita
  // tela de erro 403 sem contexto.
  { to: '/contas', label: 'Contas a pagar', mono: 'CP', roles: ['GERENTE', 'ADMIN_LOJA'] },
  { to: '/relatorios', label: 'Relatórios', mono: 'RE', roles: ['GERENTE', 'ADMIN_LOJA'] },
  { to: '/usuarios', label: 'Usuários', mono: 'US', roles: ['ADMIN_LOJA'] },
  { to: '/configuracoes', label: 'Configurações', mono: 'CF', roles: ['ADMIN_LOJA'] },
  { to: '/auditoria', label: 'Auditoria', mono: 'AU', roles: ['ADMIN_LOJA'] },
];

const PAGE_META: { match: string; title: string; subtitle: string }[] = [
  { match: '/venda', title: 'Venda', subtitle: 'Registre a venda no balcão' },
  { match: '/pedidos', title: 'Pedidos', subtitle: 'Pedidos do cardápio online' },
  { match: '/estoque/movimentacoes', title: 'Estoque', subtitle: 'Saldo, reservas, entradas, saídas, perdas, avarias e inventário' },
  { match: '/estoque', title: 'Produtos', subtitle: 'Cadastro, preços, categorias e catálogo' },
  { match: '/cardapio', title: 'Cardápio online', subtitle: 'Ordem, visibilidade e pré-visualização' },
  { match: '/complementos', title: 'Complementos', subtitle: 'Grupos de opções reutilizáveis em produtos, combos e pedidos' },
  { match: '/clientes', title: 'Clientes', subtitle: 'Cadastro de clientes da loja' },
  { match: '/caixa', title: 'Caixa', subtitle: 'Terminais de caixa da loja' },
  { match: '/contas', title: 'Contas a pagar', subtitle: 'Contas e despesas da loja' },
  { match: '/relatorios', title: 'Relatórios', subtitle: 'Desempenho de vendas' },
  { match: '/usuarios', title: 'Usuários', subtitle: 'Equipe com acesso ao sistema' },
  { match: '/configuracoes', title: 'Configurações da loja', subtitle: 'Cardápio online e dados da loja' },
  { match: '/auditoria', title: 'Auditoria', subtitle: 'Histórico de ações do sistema' },
];

function usePageMeta() {
  const { pathname } = useLocation();
  return (
    PAGE_META.find((m) => pathname.startsWith(m.match)) ?? { title: 'Adega PDV', subtitle: '' }
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const { title, subtitle } = usePageMeta();
  const { pathname } = useLocation();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    setSubscriptionBlockedHandler(() => setSubscriptionBlocked(true));
    return () => setSubscriptionBlockedHandler(() => undefined);
  }, []);

  const { data: pending } = useQuery({
    queryKey: ['orders', 'pending-count'],
    queryFn: () => ordersApi.pendingCount(),
    refetchInterval: 15000,
    // SUPER_ADMIN fora de uma loja não tem pedidos pra contar.
    enabled: user?.tenantId != null,
  });
  const pendingCount = pending?.count ?? 0;

  // Toca o alerta quando o número de pendentes AUMENTA (novo pedido chegou).
  const prevPendingRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      prevPendingRef.current !== null &&
      pendingCount > prevPendingRef.current &&
      isOrderSoundEnabled()
    ) {
      playOrderBeep();
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount]);

  const visibleNavItems = navItems.filter(
    (item) =>
      !item.roles || user?.role === 'SUPER_ADMIN' || (user?.role && item.roles.includes(user.role))
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="flex w-[232px] flex-shrink-0 flex-col gap-[22px] bg-gray-900 p-[14px] py-[22px] print:hidden">
        <div className="px-2">
          <div className="font-serif text-[22px] font-semibold leading-tight text-[#f3ece6]">
            Adega <span className="text-amber-600">Fácil</span>
          </div>
          <div className="mt-[3px] text-[11px] uppercase tracking-[.08em] text-slate-500">Sistema PDV</div>
        </div>

        <nav className="flex flex-col gap-[3px]">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                const active = isActive && !(item.excludePrefix && pathname.startsWith(item.excludePrefix));
                return `flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-semibold ${
                  active ? 'bg-amber-600/[0.16] text-[#f3ece6]' : 'text-[#9a9a9e] hover:bg-white/5'
                }`;
              }}
            >
              {({ isActive }) => {
                const active = isActive && !(item.excludePrefix && pathname.startsWith(item.excludePrefix));
                return (
                  <>
                    <span
                      className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] text-[10.5px] font-extrabold ${
                        active ? 'bg-amber-600 text-gray-900' : 'bg-white/[0.06] text-slate-500'
                      }`}
                    >
                      {item.mono}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/pedidos' && pendingCount > 0 && (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                        {pendingCount}
                      </span>
                    )}
                  </>
                );
              }}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center justify-between border-t border-[#2a2b2e] px-2 pt-3">
          <div>
            <div className="text-[13px] font-semibold text-[#f3ece6]">{user?.name}</div>
            <div className="text-[11px] text-slate-500">{user?.storeName ?? 'Administrador do sistema'}</div>
          </div>
          <button onClick={logout} className="text-xs font-semibold text-amber-600 hover:text-amber-500">
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!isOnline && (
          <div className="bg-gray-900 px-6 py-2 text-center text-sm font-medium text-white print:hidden">
            Sem conexão — vendas, caixa e pedidos ficam bloqueados até a internet voltar.
          </div>
        )}
        {subscriptionBlocked && (
          <div className="bg-red-600 px-6 py-2 text-center text-sm font-medium text-white print:hidden">
            Assinatura pendente — vendas e cadastros estão bloqueados.{' '}
            <Link to="/conta/login" className="underline">
              Regularizar agora
            </Link>
          </div>
        )}

        <header className="flex items-center justify-between border-b border-gray-300 bg-white px-8 py-[22px] print:hidden">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-gray-900">{title}</h1>
            <div className="mt-0.5 text-[13px] text-slate-500">{subtitle}</div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {user?.mustChangePin && <ForceChangePinModal />}
    </div>
  );
}
