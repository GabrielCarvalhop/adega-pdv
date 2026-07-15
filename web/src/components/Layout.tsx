import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { setSubscriptionBlockedHandler } from '../api/client';
import { ordersApi } from '../api/orders.api';
import { useAuth } from '../auth/AuthContext';
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

const navItems = [
  { to: '/venda', label: 'Venda' },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/estoque', label: 'Estoque' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/caixa', label: 'Caixa' },
  { to: '/contas', label: 'Contas a pagar' },
  { to: '/relatorios', label: 'Relatórios' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  useEffect(() => {
    setSubscriptionBlockedHandler(() => setSubscriptionBlocked(true));
    return () => setSubscriptionBlockedHandler(() => undefined);
  }, []);

  const { data: pending } = useQuery({
    queryKey: ['orders', 'pending-count'],
    queryFn: () => ordersApi.pendingCount(),
    refetchInterval: 15000,
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

  return (
    <div className="min-h-screen bg-white">
      {subscriptionBlocked && (
        <div className="bg-red-600 px-6 py-2 text-center text-sm font-medium text-white print:hidden">
          Assinatura pendente — vendas e cadastros estão bloqueados.{' '}
          <Link to="/conta/login" className="underline">
            Regularizar agora
          </Link>
        </div>
      )}
      <header className="border-b border-neutral-200 bg-neutral-50 print:hidden">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <NavLink to="/venda" className="text-lg font-bold text-neutral-800">
              Adega PDV
            </NavLink>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
                    }`
                  }
                >
                  {item.label}
                  {item.to === '/pedidos' && pendingCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
              {user?.role === 'admin' && (
                <>
                  <NavLink
                    to="/usuarios"
                    className={({ isActive }) =>
                      `rounded-md px-3 py-1.5 text-sm font-medium ${
                        isActive ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
                      }`
                    }
                  >
                    Usuários
                  </NavLink>
                  <NavLink
                    to="/configuracoes"
                    className={({ isActive }) =>
                      `rounded-md px-3 py-1.5 text-sm font-medium ${
                        isActive ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
                      }`
                    }
                  >
                    Configurações
                  </NavLink>
                  <NavLink
                    to="/auditoria"
                    className={({ isActive }) =>
                      `rounded-md px-3 py-1.5 text-sm font-medium ${
                        isActive ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
                      }`
                    }
                  >
                    Auditoria
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-500">{user?.name}</span>
            <button onClick={logout} className="text-neutral-500 hover:text-red-600">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
