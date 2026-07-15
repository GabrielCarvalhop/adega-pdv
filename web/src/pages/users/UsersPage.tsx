import type { User, UserRole } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { usersApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

function UserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'operador');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return usersApi.update(user!.id, {
          name: name.trim(),
          role,
          active,
          pin: pin ? pin : undefined,
        });
      }
      return usersApi.create({ name: name.trim(), role, pin });
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
          <label className="block text-sm font-medium text-neutral-700">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Perfil</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          >
            <option value="operador">Operador (vende e atende pedidos)</option>
            <option value="gerente">Gerente (+ estoque, clientes, relatórios, cancelamentos)</option>
            <option value="admin">Administrador (acesso total)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            PIN {isEdit && '(deixe vazio para manter o atual)'}
          </label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            placeholder="4 a 8 dígitos"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Usuários</h1>
        <Button onClick={() => setShowNew(true)}>+ Novo usuário</Button>
      </div>

      {isLoading && <p className="text-neutral-500">Carregando...</p>}

      {!isLoading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Nome</th>
              <th className="py-2">Perfil</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-neutral-100">
                <td className="py-2 font-medium text-neutral-800">{user.name}</td>
                <td className="py-2">
                  {user.role === 'admin' ? 'Administrador' : user.role === 'gerente' ? 'Gerente' : 'Operador'}
                </td>
                <td className="py-2">
                  {user.active ? (
                    <span className="text-green-600">Ativo</span>
                  ) : (
                    <span className="text-neutral-400">Inativo</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => setModalUser(user)} className="text-blue-600 hover:underline">
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
