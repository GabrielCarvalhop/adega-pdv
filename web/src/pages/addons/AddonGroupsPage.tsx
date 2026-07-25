import type { AddonSelectionType, CreateAddonOptionRequest } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { addonsApi } from '../../api/addons.api';
import { productsApi } from '../../api/products.api';
import { Button } from '../../components/ui/Button';
import { formatBRL, parseMoneyInput } from '../../utils/money';

function OptionsEditor({ groupId }: { groupId: number }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [linkedProductId, setLinkedProductId] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [qtyPerSelection, setQtyPerSelection] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const { data: group } = useQuery({
    queryKey: ['addon-groups', groupId],
    queryFn: () => addonsApi.getById(groupId),
  });
  const { data: products } = useQuery({
    queryKey: ['products', 'all-for-addons'],
    queryFn: () => productsApi.list({ active: true }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['addon-groups'] });
    queryClient.invalidateQueries({ queryKey: ['addon-groups', groupId] });
  }

  const createOption = useMutation({
    mutationFn: () => {
      const payload: CreateAddonOptionRequest = {
        label: label.trim(),
        extraPriceCents: extraPrice.trim() ? parseMoneyInput(extraPrice) : 0,
        quantityPerSelection: Number(qtyPerSelection) || 1,
      };
      if (linkedProductId) payload.productId = Number(linkedProductId);
      return addonsApi.createOption(groupId, payload);
    },
    onSuccess: () => {
      invalidate();
      setLabel('');
      setLinkedProductId('');
      setExtraPrice('');
      setQtyPerSelection('1');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (o: { id: number; active: boolean }) => addonsApi.updateOption(o.id, { active: !o.active }),
    onSuccess: invalidate,
  });

  const removeOption = useMutation({
    mutationFn: (id: number) => addonsApi.removeOption(id),
    onSuccess: invalidate,
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) return setError('Informe o rótulo da opção');
    createOption.mutate();
  }

  return (
    <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
      {group && group.options.length > 0 && (
        <ul className="space-y-1 text-sm">
          {group.options.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
              <span>
                {o.label}
                {o.extraPriceCents > 0 && (
                  <span className="ml-1 text-slate-500">+ {formatBRL(o.extraPriceCents)}</span>
                )}
                {o.productId && (
                  <span className="ml-1 text-xs text-amber-700">
                    (baixa estoque × {o.quantityPerSelection})
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(o)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    o.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-slate-500'
                  }`}
                >
                  {o.active ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  type="button"
                  onClick={() => removeOption.mutate(o.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Rótulo *</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Red Bull tradicional"
            className="mt-1 w-48 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Produto vinculado (baixa estoque)</label>
          <select
            value={linkedProductId}
            onChange={(e) => setLinkedProductId(e.target.value)}
            className="mt-1 w-48 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Nenhum (sem baixa)</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {linkedProductId && (
          <div>
            <label className="block text-xs text-slate-500">Qtd. por seleção</label>
            <input
              type="number"
              min={1}
              value={qtyPerSelection}
              onChange={(e) => setQtyPerSelection(e.target.value)}
              className="mt-1 w-20 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500">Preço adicional (R$)</label>
          <input
            value={extraPrice}
            onChange={(e) => setExtraPrice(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-24 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <Button type="submit" disabled={createOption.isPending}>
          + Adicionar opção
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function AddonGroupsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectionType, setSelectionType] = useState<AddonSelectionType>('single');
  const [required, setRequired] = useState(true);
  const [maxSelect, setMaxSelect] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: groups } = useQuery({
    queryKey: ['addon-groups'],
    queryFn: () => addonsApi.list(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['addon-groups'] });
  }

  const createGroup = useMutation({
    mutationFn: () =>
      addonsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        selectionType,
        minSelect: required ? 1 : 0,
        maxSelect: selectionType === 'single' ? 1 : Number(maxSelect) || 1,
      }),
    onSuccess: (created) => {
      invalidate();
      setName('');
      setDescription('');
      setSelectionType('single');
      setRequired(true);
      setMaxSelect('1');
      setError(null);
      setExpandedId(created.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (g: { id: number; active: boolean }) => addonsApi.update(g.id, { active: !g.active }),
    onSuccess: invalidate,
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Informe o nome do grupo');
    createGroup.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="rounded-xl border border-gray-300 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-gray-900">Novo grupo de complemento</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500">Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Sabor do energético"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500">Descrição</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500">Seleção</label>
              <select
                value={selectionType}
                onChange={(e) => setSelectionType(e.target.value as AddonSelectionType)}
                className="mt-1 rounded-xl border border-gray-300 px-3 py-2"
              >
                <option value="single">Única opção</option>
                <option value="multiple">Múltiplas opções</option>
              </select>
            </div>
            {selectionType === 'multiple' && (
              <div>
                <label className="block text-sm font-medium text-slate-500">Máximo de opções</label>
                <input
                  type="number"
                  min={1}
                  value={maxSelect}
                  onChange={(e) => setMaxSelect(e.target.value)}
                  className="mt-1 w-24 rounded-xl border border-gray-300 px-3 py-2"
                />
              </div>
            )}
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-500">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              Obrigatório
            </label>
            <Button type="submit" disabled={createGroup.isPending}>
              Criar grupo
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>

      <div className="space-y-3">
        {groups?.map((g) => (
          <div key={g.id} className="rounded-xl border border-gray-300 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-slate-500">
                    {g.selectionType === 'single' ? 'Única' : `Múltipla (até ${g.maxSelect})`}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-slate-500">
                    {g.minSelect >= 1 ? 'Obrigatório' : 'Opcional'}
                  </span>
                </div>
                {g.description && <p className="mt-0.5 text-sm text-slate-400">{g.description}</p>}
                <p className="mt-0.5 text-xs text-slate-400">
                  {g.options.length} opção(ões) cadastrada(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(g)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    g.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-slate-500'
                  }`}
                >
                  {g.active ? 'Ativo' : 'Inativo'}
                </button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                >
                  {expandedId === g.id ? 'Fechar' : 'Gerenciar opções'}
                </Button>
              </div>
            </div>
            {expandedId === g.id && <OptionsEditor groupId={g.id} />}
          </div>
        ))}
        {groups?.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum grupo de complemento cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
