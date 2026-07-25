import type { TenantUserRole, User } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { usersApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

function UserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<TenantUserRole>((user?.role as TenantUserRole) ?? 'FUNCIONARIO');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(user?.active ?? true);
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(
    user?.maxDiscountPercent !== null && user?.maxDiscountPercent !== undefined
      ? String(user.maxDiscountPercent)
      : ''
  );
  const [canSellWithoutStock, setCanSellWithoutStock] = useState(user?.canSellWithoutStock ?? false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const permissionFields = {
        maxDiscountPercent: maxDiscountPercent.trim() ? Number(maxDiscountPercent) : null,
        canSellWithoutStock,
      };
      if (isEdit) {
        return usersApi.update(user!.id, {
          name: name.trim(),
          role,
          active,
          pin: pin ? pin : undefined,
          ...permissionFields,
        });
      }
      return usersApi.create({ name: name.trim(), role, pin, ...permissionFields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Nome é obrigatório');
    if (!isEdit && !/^\d{4,8}$/.test(pin)) return setError('PIN deve ter de 4 a 8 dígitos');
    if (isEdit && pin && !/^\d{4,8}$/.test(pin)) return setError('PIN deve ter de 4 a 8 dígitos');
    mutation.mutate();
  }

  return (
    <Modal title={isEdit ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-500">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">Perfil</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TenantUserRole)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          >
            <option value="FUNCIONARIO">Funcionário (vende e atende pedidos)</option>
            <option value="GERENTE">Gerente (+ estoque, clientes, relatórios, cancelamentos)</option>
            <option value="ADMIN_LOJA">Administrador (acesso total)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500">
            PIN {isEdit && '(deixe vazio para manter o atual)'}
          </label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            placeholder="4 a 8 dígitos"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="rounded-xl border border-gray-300 p-3 space-y-3">
          <p className="text-sm font-medium text-gray-900">Permissões (opcional)</p>
          <div>
            <label className="block text-xs text-slate-500">
              Limite de desconto (%) — vazio usa o padrão do perfil
            </label>
            <input
              value={maxDiscountPercent}
              onChange={(e) => setMaxDiscountPercent(e.target.value)}
              placeholder={role === 'ADMIN_LOJA' ? 'Sem limite' : role === 'GERENTE' ? '50 (padrão)' : '10 (padrão)'}
              className="mt-1 w-32 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={canSellWithoutStock}
              onChange={(e) => setCanSellWithoutStock(e.target.checked)}
            />
            Pode vender mesmo sem estoque disponível
          </label>
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Usuário ativo
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setShowNew(true)}>+ Novo usuário</Button>
      </div>

      {isLoading && <p className="text-slate-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-slate-500">
              <th className="py-2">Nome</th>
              <th className="py-2">Perfil</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-gray-200">
                <td className="py-2 font-medium text-gray-900">{user.name}</td>
                <td className="py-2">
                  {user.role === 'ADMIN_LOJA' ? 'Administrador' : user.role === 'GERENTE' ? 'Gerente' : 'Funcionário'}
                </td>
                <td className="py-2">
                  {user.active ? (
                    <span className="text-green-600">Ativo</span>
                  ) : (
                    <span className="text-slate-400">Inativo</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => setModalUser(user)} className="text-amber-600 hover:underline">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showNew && <UserModal user={null} onClose={() => setShowNew(false)} />}
      {modalUser && <UserModal user={modalUser} onClose={() => setModalUser(null)} />}
    </div>
  );
}
