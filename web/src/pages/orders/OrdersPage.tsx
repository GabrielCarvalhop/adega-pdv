import type { OrderDetail, OrderStatus } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { ordersApi } from '../../api/orders.api';
import { paymentMethodsApi } from '../../api/paymentMethods.api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { formatBRL } from '../../utils/money';

const statusLabels: Record<OrderStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  aceito: { label: 'Em preparo', className: 'bg-blue-100 text-blue-700' },
  pronto: { label: 'Pronto', className: 'bg-purple-100 text-purple-700' },
  saiu_entrega: { label: 'Saiu p/ entrega', className: 'bg-cyan-100 text-cyan-700' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-700' },
  recusado: { label: 'Recusado', className: 'bg-red-100 text-red-600' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-200 text-slate-500' },
  expirado: { label: 'Expirado', className: 'bg-gray-200 text-slate-500' },
};

const SOUND_KEY = 'adega_order_sound';

export function isOrderSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'off';
}

function elapsedLabel(createdAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

function printOrder(detail: OrderDetail, paymentLabels: Record<string, string>, storeName: string | null) {
  const { order, items } = detail;
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  const lines = items
    .map((i) => {
      const addonLines = i.addons
        .map((a) => `<tr><td style="padding-left:8px;font-size:10px">+ ${a.labelSnapshot}</td><td></td></tr>`)
        .join('');
      return `<tr><td>${i.quantity}x ${i.productNameSnapshot}</td><td style="text-align:right">${formatBRL(i.totalCents)}</td></tr>${addonLines}`;
    })
    .join('');
  win.document.write(`
    <html><head><title>Pedido #${order.id}</title>
    <style>body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0;padding:4mm}
    table{width:100%;border-collapse:collapse}h2{text-align:center;font-size:14px}hr{border:none;border-top:1px dashed #000}</style>
    </head><body>
    ${storeName ? `<h2>${storeName}</h2><p style="text-align:center;margin:0">PEDIDO #${order.id}</p>` : `<h2>PEDIDO #${order.id}</h2>`}
    <p>${new Date(order.createdAt).toLocaleString('pt-BR')}<br>
    ${order.fulfillment === 'entrega' ? 'ENTREGA' : 'RETIRADA'}<br>
    ${order.customerName} — ${order.customerPhone}
    ${order.address ? `<br>${order.address}` : ''}</p>
    ${order.notes ? `<p>Obs: ${order.notes}</p>` : ''}
    <hr><table>${lines}
    ${order.deliveryFeeCents > 0 ? `<tr><td>Taxa entrega</td><td style="text-align:right">${formatBRL(order.deliveryFeeCents)}</td></tr>` : ''}
    <tr><td><b>TOTAL (${paymentLabels[order.paymentMethodIntent] ?? order.paymentMethodIntent})</b></td><td style="text-align:right"><b>${formatBRL(order.totalCents)}</b></td></tr>
    ${order.changeForCents ? `<tr><td>Troco para</td><td style="text-align:right">${formatBRL(order.changeForCents)}</td></tr>` : ''}
    </table><hr></body></html>
  `);
  win.document.close();
  win.print();
}

function OrderCard({ detail, paymentLabels }: { detail: OrderDetail; paymentLabels: Record<string, string> }) {
  const { order, items } = detail;
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: openSessions } = useQuery({
    queryKey: ['cash', 'open-sessions'],
    queryFn: () => cashApi.openSessions(),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['cash'] });
  }

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (err: Error) => setError(err.message),
  });

  function concludeWithRegister() {
    if (!openSessions || openSessions.length === 0) {
      setError('Abra um caixa antes de concluir o pedido');
      return;
    }
    let cashSessionId = openSessions[0].id;
    if (openSessions.length > 1) {
      const saved = localStorage.getItem('adega_register_session');
      const savedId = saved ? Number(saved) : NaN;
      if (openSessions.some((s) => s.id === savedId)) cashSessionId = savedId;
    }
    act.mutate(() => ordersApi.conclude(order.id, { cashSessionId }));
  }

  const status = statusLabels[order.status];
  const active = ['pendente', 'aceito', 'pronto', 'saiu_entrega'].includes(order.status);

  return (
    <div className="rounded-xl border border-gray-300 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-gray-900">
          Pedido #{order.id} · {order.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}
          {active && <span className="ml-2 text-xs font-normal text-slate-400">{elapsedLabel(order.createdAt)}</span>}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-slate-500">
        {order.customerName} · {order.customerPhone}
      </p>
      {order.address && <p className="text-sm text-slate-500">{order.address}</p>}
      {order.notes && <p className="text-sm italic text-slate-500">"{order.notes}"</p>}
      {order.rejectReason && (
        <p className="text-sm text-red-500">Motivo: {order.rejectReason}</p>
      )}

      <ul className="mt-2 border-t border-gray-200 pt-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="py-0.5">
            <div className="flex justify-between">
              <span>
                {item.quantity}x {item.productNameSnapshot}
              </span>
              <span>{formatBRL(item.totalCents)}</span>
            </div>
            {item.addons.map((addon) => (
              <div key={addon.id} className="pl-3 text-xs text-slate-400">
                + {addon.labelSnapshot}
              </div>
            ))}
          </li>
        ))}
        {order.deliveryFeeCents > 0 && (
          <li className="flex justify-between py-0.5 text-slate-500">
            <span>Taxa de entrega</span>
            <span>{formatBRL(order.deliveryFeeCents)}</span>
          </li>
        )}
        <li className="flex justify-between border-t border-gray-200 py-1 font-semibold">
          <span>Total ({paymentLabels[order.paymentMethodIntent] ?? order.paymentMethodIntent})</span>
          <span>{formatBRL(order.totalCents)}</span>
        </li>
        {order.changeForCents !== null && order.changeForCents > 0 && (
          <li className="flex justify-between py-0.5 text-amber-700">
            <span>Troco para {formatBRL(order.changeForCents)}</span>
            <span>levar {formatBRL(order.changeForCents - order.totalCents)}</span>
          </li>
        )}
      </ul>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === 'pendente' && (
          <>
            <Button onClick={() => act.mutate(() => ordersApi.accept(order.id))}>Aceitar</Button>
            <Button
              variant="danger"
              onClick={() => {
                const reason = prompt('Motivo da recusa:');
                if (reason) act.mutate(() => ordersApi.reject(order.id, reason));
              }}
            >
              Recusar
            </Button>
          </>
        )}
        {order.status === 'aceito' && (
          <Button onClick={() => act.mutate(() => ordersApi.ready(order.id))}>Marcar pronto</Button>
        )}
        {(order.status === 'aceito' || order.status === 'pronto') &&
          order.fulfillment === 'entrega' && (
            <Button onClick={() => act.mutate(() => ordersApi.outForDelivery(order.id))}>
              Saiu p/ entrega
            </Button>
          )}
        {['aceito', 'pronto', 'saiu_entrega'].includes(order.status) && (
          <>
            <Button onClick={concludeWithRegister}>
              {order.fulfillment === 'entrega' ? 'Entregue' : 'Retirado'} (concluir)
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const reason = prompt('Motivo do cancelamento:');
                if (reason) act.mutate(() => ordersApi.cancel(order.id, reason));
              }}
            >
              Cancelar
            </Button>
          </>
        )}
        {active && (
          <Button variant="secondary" onClick={() => printOrder(detail, paymentLabels, user?.storeName ?? null)}>
            Imprimir
          </Button>
        )}
      </div>
    </div>
  );
}

const ACTIVE_STATUSES: OrderStatus[] = ['pendente', 'aceito', 'pronto', 'saiu_entrega'];

export function OrdersPage() {
  const [tab, setTab] = useState<'ativos' | 'historico'>('ativos');
  const [search, setSearch] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('');
  const [soundOn, setSoundOn] = useState(isOrderSoundEnabled());

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', tab],
    queryFn: () => ordersApi.list(tab === 'ativos' ? ACTIVE_STATUSES : undefined),
    refetchInterval: 15000,
  });

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.list(),
  });
  const paymentLabels = useMemo(
    () => Object.fromEntries((methods ?? []).map((m) => [m.code, m.label])),
    [methods]
  );

  const visible = useMemo(() => {
    let list = orders ?? [];
    if (tab === 'historico') {
      list = list.filter((o) =>
        ['concluido', 'recusado', 'cancelado', 'expirado'].includes(o.order.status)
      );
    }
    if (fulfillmentFilter) {
      list = list.filter((o) => o.order.fulfillment === fulfillmentFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          String(o.order.id) === q ||
          o.order.customerName.toLowerCase().includes(q) ||
          o.order.customerPhone.includes(q)
      );
    }
    return list;
  }, [orders, tab, search, fulfillmentFilter]);

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, OrderDetail[]>();
    for (const status of ACTIVE_STATUSES) map.set(status, []);
    for (const detail of visible) {
      map.get(detail.order.status)?.push(detail);
    }
    return map;
  }, [visible]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
  }

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            title="Som de novo pedido"
            className={`rounded-lg px-3 py-1.5 text-sm ${soundOn ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-slate-400'}`}
          >
            {soundOn ? '🔔 Som ligado' : '🔕 Som desligado'}
          </button>
          <div className="flex gap-1">
            {(['ativos', 'historico'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === t ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-gray-100'
                }`}
              >
                {t === 'ativos' ? 'Ativos' : 'Histórico'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nº, nome ou telefone..."
          className="w-64 rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={fulfillmentFilter}
          onChange={(e) => setFulfillmentFilter(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">Entrega e retirada</option>
          <option value="entrega">Só entrega</option>
          <option value="retirada">Só retirada</option>
        </select>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && visible.length === 0 && (
        <p className="text-slate-400">
          {tab === 'ativos' ? 'Nenhum pedido ativo no momento.' : 'Nenhum pedido encontrado.'}
        </p>
      )}

      {!isLoading && tab === 'ativos' && visible.length > 0 && (
        <div className="grid grid-cols-1 divide-y divide-gray-300 rounded-xl border border-gray-300 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {ACTIVE_STATUSES.map((status) => {
            const columnOrders = byStatus.get(status) ?? [];
            return (
              <div key={status} className="flex min-w-0 flex-col">
                <div className="flex items-center justify-between border-b border-gray-300 bg-gray-50 px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusLabels[status].className}`}>
                    {statusLabels[status].label}
                  </span>
                  <span className="text-xs font-medium text-slate-400">{columnOrders.length}</span>
                </div>
                <div className="flex-1 space-y-3 p-3">
                  {columnOrders.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">Nenhum pedido</p>
                  )}
                  {columnOrders.map((detail) => (
                    <OrderCard key={detail.order.id} detail={detail} paymentLabels={paymentLabels} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && tab === 'historico' && visible.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((detail) => (
            <OrderCard key={detail.order.id} detail={detail} paymentLabels={paymentLabels} />
          ))}
        </div>
      )}
    </div>
  );
}
