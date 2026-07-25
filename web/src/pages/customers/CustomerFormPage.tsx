import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customersApi } from '../../api/customers.api';
import { Button } from '../../components/ui/Button';

export function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  async function checkDuplicatePhone() {
    setDuplicateWarning(null);
    const clean = phone.trim();
    if (clean.length < 8 || isEdit) return;
    try {
      const existing = await customersApi.findByPhone(clean);
      if (existing) {
        setDuplicateWarning(`Já existe um cliente com este telefone: ${existing.name}`);
      }
    } catch {
      // silencioso — só um aviso de conveniência
    }
  }

  const { data: existing } = useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.getById(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setPhone(existing.phone ?? '');
    setEmail(existing.email ?? '');
    setDocument(existing.document ?? '');
    setAddress(existing.address ?? '');
    setNotes(existing.notes ?? '');
  }, [existing]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        document: document.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      return isEdit ? customersApi.update(Number(id), payload) : customersApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/clientes');
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isEdit ? 'Editar cliente' : 'Novo cliente'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-500">Nome *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={checkDuplicatePhone}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
            {duplicateWarning && (
              <p className="mt-1 text-xs text-amber-600">{duplicateWarning}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Documento (CPF)</label>
            <input
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">Endereço</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/clientes')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
