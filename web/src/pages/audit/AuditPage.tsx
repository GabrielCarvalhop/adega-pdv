import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';

interface AuditEntry {
  id: number;
  userName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  'caixa.abertura': 'Abertura de caixa',
  'caixa.fechamento': 'Fechamento de caixa',
  'caixa.reabertura': 'Reabertura de caixa',
  'caixa.sangria': 'Sangria',
  'caixa.suprimento': 'Suprimento',
  'venda.desconto': 'Desconto em venda',
  'venda.cancelamento': 'Cancelamento de venda',
  'venda.cancelamento_item': 'Cancelamento de item',
  'pedido.recusa': 'Recusa de pedido',
  'pedido.cancelamento': 'Cancelamento de pedido',
  'estoque.movimento_manual': 'Movimentação manual de estoque',
  'usuario.criacao': 'Criação de usuário',
  'usuario.alteracao': 'Alteração de usuário',
};

export function AuditPage() {
  const [action, setAction] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', { action }],
    queryFn: () =>
      api.get<AuditEntry[]>(`/audit${action ? `?action=${encodeURIComponent(action)}` : ''}`),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-end">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todas as ações</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Quando</th>
              <th className="py-2">Ação</th>
              <th className="py-2">Quem</th>
              <th className="py-2">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((log) => (
              <tr key={log.id} className="border-b border-gray-200 align-top">
                <td className="whitespace-nowrap py-2 text-slate-500">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="py-2 font-medium text-gray-900">
                  {actionLabels[log.action] ?? log.action}
                  <span className="ml-1 text-xs text-slate-400">
                    #{log.entityId ?? '—'}
                  </span>
                </td>
                <td className="py-2">{log.userName ?? '—'}</td>
                <td className="max-w-md py-2 font-mono text-xs text-slate-500">
                  {log.details ? JSON.stringify(log.details) : '—'}
                </td>
              </tr>
            ))}
            {logs?.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
