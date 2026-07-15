import type { OrderDetail, OrderStatus } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { cashApi } from '../../api/cash.api';
import { ordersApi } from '../../api/orders.api';
import { Button } from '../../components/ui/Button';
import { formatBRL } from '../../utils/money';

const statusLabels: Record<OrderStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  aceito: { label: 'Em preparo', className: 'bg-blue-100 text-blue-700' },
  pronto: { label: 'Pronto', className: 'bg-purple-100 text-purple-700' },
  saiu_entrega: { label: 'Saiu p/ entrega', className: 'bg-cyan-100 text-cyan-700' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-700' },
  recusado: { label: 'Recusado', className: 'bg-red-100 text-red-600' },
  cancelado: { label: 'Cancelado', className: 'bg-neutral-200 text-neutral-600' },
  expirado: { label: 'Expirado', className: 'bg-neutral-200 text-neutral-500' },
};

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Cartão débito',
  credito: 'Cartão crédito',
  pix: 'Pix',
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

function printOrder(detail: OrderDetail) {
  const { order, items } = detail;
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  const lines = items
    .map(
      (i) =>
        `<tr><td>${i.quantity}x ${i.productNameSnapshot}</td><td style="text-align:right">${formatBRL(i.totalCents)}</td></tr>`
    )
    .join('');
  win.document.write(`
    <html><head><title>Pedido #${order.id}</title>
    <style>body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0;padding:4mm}
    table{width:100%;border-collapse:collapse}h2{text-align:center;font-size:14px}hr{border:none;border-top:1px dashed #000}</style>
    </head><body>
    <h2>PEDIDO #${order.id}</h2>
    <p>${new Date(order.createdAt).toLocaleString('pt-BR')}<br>
    ${order.fulfillment === 'entrega' ? 'ENTREGA' : 'RETIRADA'}<br>
    ${order.customerName} — ${order.customerPhone}
    ${order.address ? `<br>${order.address}` : ''}</p>
    ${order.notes ? `<p>Obs: ${order.notes}</p>` : ''}
    <hr><table>${lines}
    ${order.deliveryFeeCents > 0 ? `<tr><td>Taxa entrega</td><td style="text-align:right">${formatBRL(order.deliveryFeeCents)}</td></tr>` : ''}
    <tr><td><b>TOTAL (${paymentLabels[order.paymentMethodIntent]})</b></td><td style="text-align:right"><b>${formatBRL(order.totalCents)}</b></td></tr>
    ${order.changeForCents ? `<tr><td>Troco para</td><td style="text-align:right">${formatBRL(order.changeForCents)}</td></tr>` : ''}
    </table><hr></body></html>
  `);
  win.document.close();
  win.print();
}

function OrderCard({ detail }: { detail: OrderDetail }) {
  const { order, items } = detail;
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
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-neutral-800">
          Pedido #{order.id} · {order.fulfillment === 'entrega' ? 'Entrega' : 'Retirada'}
          {active && <span className="ml-2 text-xs font-normal text-neutral-400">{elapsedLabel(order.createdAt)}</span>}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-neutral-600">
        {order.customerName} · {order.customerPhone}
      </p>
      {order.address && <p className="text-sm text-neutral-500">{order.address}</p>}
      {order.notes && <p className="text-sm italic text-neutral-500">"{order.notes}"</p>}
      {order.rejectReason && (
        <p className="text-sm text-red-500">Motivo: {order.rejectReason}</p>
      )}

      <ul className="mt-2 border-t border-neutral-100 pt-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between py-0.5">
            <span>
              {item.quantity}x {item.productNameSnapshot}
            </span>
            <span>{formatBRL(item.totalCents)}</span>
          </li>
        ))}
        {order.deliveryFeeCents > 0 && (
          <li className="flex justify-between py-0.5 text-neutral-500">
            <span>Taxa de entrega</span>
            <span>{formatBRL(order.deliveryFeeCents)}</span>
          </li>
        )}
        <li className="flex justify-between border-t border-neutral-100 py-1 font-semibold">
          <span>Total ({paymentLabels[order.paymentMethodIntent]})</span>
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
          <Button variant="secondary" onClick={() => printOrder(detail)}>
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

  const counters = useMemo(() => {
    const counts: Partial<Record<OrderStatus, number>> = {};
    for (const o of orders ?? []) {
      counts[o.order.status] = (counts[o.order.status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

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

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
  }

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-800">Pedidos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            title="Som de novo pedido"
            className={`rounded-md px-3 py-1.5 text-sm ${soundOn ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-400'}`}
          >
            {soundOn ? '🔔 Som ligado' : '🔕 Som desligado'}
          </button>
          <div className="flex gap-1">
            {(['ativos', 'historico'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === t ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {t === 'ativos' ? 'Ativos' : 'Histórico'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'ativos' && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {ACTIVE_STATUSES.map((s) => (
            <span key={s} className={`rounded-full px-2 py-1 font-medium ${statusLabels[s].className}`}>
              {statusLabels[s].label}: {counters[s] ?? 0}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nº, nome ou telefone..."
          className="w-64 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <select
          value={fulfillmentFilter}
          onChange={(e) => setFulfillmentFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="">Entrega e retirada</option>
          <option value="entrega">Só entrega</option>
          <option value="retirada">Só retirada</option>
        </select>
      </div>

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {!isLoading && visible.length === 0 && (
        <p className="text-neutral-400">
          {tab === 'ativos' ? 'Nenhum pedido ativo no momento.' : 'Nenhum pedido encontrado.'}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((detail) => (
          <OrderCard key={detail.order.id} detail={detail} />
        ))}
      </div>
    </div>
  );
}
