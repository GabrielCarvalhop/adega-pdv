import type { DeliveryZoneMode, DeliveryZoneType, PaymentMethodConfig, PaymentMethodKind } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getSavedSlug } from '../../auth/AuthContext';
import { deliveryZonesApi } from '../../api/deliveryZones.api';
import { paymentMethodsApi } from '../../api/paymentMethods.api';
import { settingsApi } from '../../api/settings.api';
import { surchargeRulesApi } from '../../api/surchargeRules.api';
import { uploadsApi, type UploadPurpose } from '../../api/uploads.api';
import { Button } from '../../components/ui/Button';
import { formatBRL, parseMoneyInput } from '../../utils/money';

const kindLabels: Record<PaymentMethodKind, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  fiado: 'Fiado',
  link_pagamento: 'Link de pagamento',
  outro: 'Outro',
};

function PaymentMethodEditor({ method, onClose }: { method: PaymentMethodConfig; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [icon, setIcon] = useState(method.icon ?? '');
  const [allowsChange, setAllowsChange] = useState(method.allowsChange);
  const [creditsAccount, setCreditsAccount] = useState(method.creditsAccount);
  const [retentionPercent, setRetentionPercent] = useState(String(method.retentionPercent));
  const [settlementDays, setSettlementDays] = useState(String(method.settlementDays));
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      paymentMethodsApi.update(method.id, {
        icon: icon.trim() || undefined,
        allowsChange,
        creditsAccount,
        retentionPercent: Number(retentionPercent) || 0,
        settlementDays: Number(settlementDays) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500">Ícone</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="💳"
            maxLength={4}
            className="mt-1 w-16 rounded-lg border border-gray-300 px-2 py-1 text-center"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Taxa de retenção (%)</label>
          <input
            value={retentionPercent}
            onChange={(e) => setRetentionPercent(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Prazo p/ recebimento (dias)</label>
          <input
            value={settlementDays}
            onChange={(e) => setSettlementDays(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-gray-300 px-2 py-1"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" checked={allowsChange} onChange={(e) => setAllowsChange(e.target.checked)} />
          Aceita troco
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={creditsAccount}
            onChange={(e) => setCreditsAccount(e.target.checked)}
          />
          Credita em conta do cliente (oposto do fiado)
        </label>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Salvar
        </Button>
      </div>
    </div>
  );
}

function PaymentMethodsSection() {
  const queryClient = useQueryClient();
  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.list(),
  });
  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<PaymentMethodKind>('outro');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleActive = useMutation({
    mutationFn: (m: PaymentMethodConfig) => paymentMethodsApi.update(m.id, { active: !m.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-methods'] }),
  });

  const createMutation = useMutation({
    mutationFn: () => paymentMethodsApi.create({ code: newLabel, label: newLabel.trim(), kind: newKind }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      setNewLabel('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="rounded-xl border border-gray-300 p-4 space-y-3">
      <div>
        <p className="font-medium text-gray-900">Meios de pagamento</p>
        <p className="text-sm text-slate-500">
          Ative, desative ou crie meios personalizados. Usados no PDV, cardápio, caixa e relatórios.
        </p>
      </div>
      <ul className="space-y-1">
        {methods?.map((m) => (
          <li key={m.id} className="rounded-lg bg-gray-100 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <div>
                {m.icon && <span className="mr-1">{m.icon}</span>}
                <span className="font-medium text-gray-900">{m.label}</span>
                <span className="ml-2 text-xs uppercase text-slate-400">{kindLabels[m.kind]}</span>
                {m.retentionPercent > 0 && (
                  <span className="ml-2 text-xs text-amber-600">retém {m.retentionPercent}%</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                  className="text-xs text-amber-600 hover:underline"
                >
                  {editingId === m.id ? 'Fechar' : 'Editar'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(m)}
                  disabled={toggleActive.isPending}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    m.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-slate-500'
                  }`}
                >
                  {m.active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            </div>
            {editingId === m.id && (
              <PaymentMethodEditor method={m} onClose={() => setEditingId(null)} />
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nome (ex.: Vale-refeição)"
          className="flex-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as PaymentMethodKind)}
          className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="cartao">Cartão</option>
          <option value="fiado">Fiado</option>
          <option value="link_pagamento">Link de pagamento</option>
          <option value="outro">Outro</option>
        </select>
        <Button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!newLabel.trim() || createMutation.isPending}
        >
          + Adicionar
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SurchargeRulesSection() {
  const queryClient = useQueryClient();
  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.list(),
  });
  const { data: rules } = useQuery({
    queryKey: ['surcharge-rules'],
    queryFn: () => surchargeRulesApi.list(),
  });
  const activeMethods = (methods ?? []).filter((m) => m.active);
  const methodsById = new Map((methods ?? []).map((m) => [m.id, m]));

  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['surcharge-rules'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      surchargeRulesApi.create({
        saleType: 'atacado',
        paymentMethodId: Number(paymentMethodId),
        percent: Number(percent.replace(',', '.')),
      }),
    onSuccess: () => {
      invalidate();
      setPaymentMethodId('');
      setPercent('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (r: { id: number; active: boolean }) =>
      surchargeRulesApi.update(r.id, { active: !r.active }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => surchargeRulesApi.remove(id),
    onSuccess: invalidate,
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!paymentMethodId) return setError('Selecione o meio de pagamento');
    const value = Number(percent.replace(',', '.'));
    if (!value || value <= 0) return setError('Informe um percentual válido');
    createMutation.mutate();
  }

  return (
    <div className="rounded-xl border border-gray-300 p-4 space-y-3">
      <div>
        <p className="font-medium text-gray-900">Acréscimo no atacado</p>
        <p className="text-sm text-slate-500">
          Percentual aplicado automaticamente quando a venda é marcada como atacado e paga no meio
          selecionado (ex.: +2% no crédito).
        </p>
      </div>

      {rules && rules.length > 0 && (
        <ul className="space-y-1 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
              <span>
                {methodsById.get(r.paymentMethodId)?.label ?? `#${r.paymentMethodId}`}: +{r.percent}%
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(r)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-slate-500'
                  }`}
                >
                  {r.active ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(r.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-3">
        <div>
          <label className="block text-xs text-slate-500">Meio de pagamento</label>
          <select
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Selecione</option>
            {activeMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Percentual</label>
          <input
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="2"
            className="mt-1 w-20 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          + Adicionar regra
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function DeliveryZonesSection({
  mode,
  onModeChange,
}: {
  mode: DeliveryZoneMode;
  onModeChange: (mode: DeliveryZoneMode) => void;
}) {
  const queryClient = useQueryClient();
  const { data: zones } = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: () => deliveryZonesApi.list(),
  });
  const [value, setValue] = useState('');
  const [blocked, setBlocked] = useState(true);
  const [feeCents, setFeeCents] = useState('');
  const [error, setError] = useState<string | null>(null);

  const zoneType: DeliveryZoneType = mode === 'cep' ? 'cep_prefix' : 'bairro';

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      deliveryZonesApi.create({
        type: zoneType,
        value: value.trim(),
        blocked,
        feeCents: !blocked && feeCents.trim() ? parseMoneyInput(feeCents) : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setValue('');
      setFeeCents('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (z: { id: number; active: boolean }) => deliveryZonesApi.update(z.id, { active: !z.active }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => deliveryZonesApi.remove(id),
    onSuccess: invalidate,
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!value.trim()) return setError(mode === 'cep' ? 'Informe o CEP ou prefixo' : 'Informe o bairro');
    createMutation.mutate();
  }

  return (
    <div className="rounded-xl border border-gray-300 p-4 space-y-3">
      <div>
        <p className="font-medium text-gray-900">Entrega por bairro/CEP</p>
        <p className="text-sm text-slate-500">
          Bloqueie bairros/regiões específicas ou defina uma taxa diferente da padrão para eles.
        </p>
      </div>

      <div>
        <label className="block text-xs text-slate-500">Validar entrega por</label>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as DeliveryZoneMode)}
          className="mt-1 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="off">Não validar (taxa única para toda entrega)</option>
          <option value="bairro">Bairro</option>
          <option value="cep">CEP</option>
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Clique em "Salvar configurações" no topo da página para aplicar esta escolha.
        </p>
      </div>

      {mode !== 'off' && (
        <>
          {zones && zones.filter((z) => z.type === zoneType).length > 0 && (
            <ul className="space-y-1 text-sm">
              {zones
                .filter((z) => z.type === zoneType)
                .map((z) => (
                  <li key={z.id} className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
                    <span>
                      {z.value}
                      {z.blocked ? (
                        <span className="ml-2 text-xs font-semibold text-red-600">BLOQUEADO</span>
                      ) : z.feeCents !== null ? (
                        <span className="ml-2 text-xs text-slate-500">taxa {formatBRL(z.feeCents)}</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive.mutate(z)}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          z.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-slate-500'
                        }`}
                      >
                        {z.active ? 'Ativo' : 'Inativo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(z.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remover
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
          )}

          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-3">
            <div>
              <label className="block text-xs text-slate-500">{mode === 'cep' ? 'CEP/prefixo' : 'Bairro'}</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mode === 'cep' ? '06000' : 'Centro'}
                className="mt-1 w-36 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-1 text-sm text-slate-500">
              <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} />
              Bloquear
            </label>
            {!blocked && (
              <div>
                <label className="block text-xs text-slate-500">Taxa própria (R$, opcional)</label>
                <input
                  value={feeCents}
                  onChange={(e) => setFeeCents(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-28 rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              + Adicionar zona
            </Button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

export function StoreSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const slug = getSavedSlug();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  const [catalogEnabled, setCatalogEnabled] = useState(false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [pendingTtl, setPendingTtl] = useState('30');
  const [fiadoDueDays, setFiadoDueDays] = useState('30');
  const [whatsapp, setWhatsapp] = useState('');
  const [addressText, setAddressText] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [cityText, setCityText] = useState('');
  const [catalogLogoUrl, setCatalogLogoUrl] = useState<string | null>(null);
  const [catalogBannerUrl, setCatalogBannerUrl] = useState<string | null>(null);
  const [deliveryZoneMode, setDeliveryZoneMode] = useState<DeliveryZoneMode>('off');
  const [uploading, setUploading] = useState<UploadPurpose | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setCatalogEnabled(settings.catalogEnabled);
    setDeliveryEnabled(settings.deliveryEnabled);
    setPickupEnabled(settings.pickupEnabled);
    setDeliveryFee(settings.deliveryFeeCents ? (settings.deliveryFeeCents / 100).toFixed(2).replace('.', ',') : '');
    setFreeDeliveryAbove(
      settings.freeDeliveryAboveCents ? (settings.freeDeliveryAboveCents / 100).toFixed(2).replace('.', ',') : ''
    );
    setMinOrder(settings.minOrderCents ? (settings.minOrderCents / 100).toFixed(2).replace('.', ',') : '');
    setPendingTtl(String(settings.pendingTtlMinutes));
    setFiadoDueDays(String(settings.fiadoDueDays));
    setWhatsapp(settings.whatsapp ?? '');
    setAddressText(settings.addressText ?? '');
    setOpeningHours(settings.openingHoursText ?? '');
    setCityText(settings.cityText ?? '');
    setCatalogLogoUrl(settings.catalogLogoUrl);
    setCatalogBannerUrl(settings.catalogBannerUrl);
    setDeliveryZoneMode(settings.deliveryZoneMode);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.update({
        catalogEnabled,
        deliveryEnabled,
        pickupEnabled,
        deliveryFeeCents: parseMoneyInput(deliveryFee),
        freeDeliveryAboveCents: freeDeliveryAbove.trim() ? parseMoneyInput(freeDeliveryAbove) : 0,
        minOrderCents: parseMoneyInput(minOrder),
        pendingTtlMinutes: Math.max(5, Number(pendingTtl) || 30),
        fiadoDueDays: Math.max(1, Number(fiadoDueDays) || 30),
        whatsapp: whatsapp.trim() || null,
        addressText: addressText.trim() || null,
        openingHoursText: openingHours.trim() || null,
        cityText: cityText.trim() || null,
        catalogLogoUrl,
        catalogBannerUrl,
        deliveryZoneMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  async function handleImageUpload(purpose: 'logo' | 'banner', file: File) {
    setUploading(purpose);
    setError(null);
    try {
      const { url } = await uploadsApi.uploadFile(purpose, file);
      if (purpose === 'logo') setCatalogLogoUrl(url);
      else setCatalogBannerUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(null);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (user?.role !== 'ADMIN_LOJA' && user?.role !== 'SUPER_ADMIN') {
    return <div className="p-8 text-slate-500">Somente administradores acessam as configurações.</div>;
  }
  if (isLoading) return <div className="p-8 text-slate-500">Carregando...</div>;

  const catalogUrl = `${window.location.origin}/c/${slug}`;

  return (
    <div className="mx-auto max-w-lg p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-gray-300 p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={catalogEnabled}
              onChange={(e) => setCatalogEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <p className="font-medium text-gray-900">Cardápio online ativo</p>
              <p className="text-sm text-slate-500">
                Clientes fazem pedidos pelo link do cardápio.
              </p>
            </div>
          </label>
          {catalogEnabled && (
            <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-amber-700">
              {catalogUrl}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-300 p-4 space-y-4">
          <div>
            <p className="font-medium text-gray-900">Visual do cardápio</p>
            <p className="text-sm text-slate-500">
              Logo e banner que o cliente vê no menu online. JPG/PNG/WebP · máx. 500 KB.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500">Cidade / região</label>
            <input
              value={cityText}
              onChange={(e) => setCityText(e.target.value)}
              placeholder="Ex.: Vargem Grande Paulista - SP"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500">Logo</label>
            {catalogLogoUrl && (
              <img
                src={catalogLogoUrl}
                alt=""
                className="mt-2 h-16 w-16 rounded-lg object-contain bg-gray-900"
              />
            )}
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                {uploading === 'logo' ? 'Enviando...' : catalogLogoUrl ? 'Trocar logo' : 'Enviar logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={Boolean(uploading)}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleImageUpload('logo', file);
                  }}
                />
              </label>
              {catalogLogoUrl && (
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => setCatalogLogoUrl(null)}
                >
                  Remover
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500">Banner</label>
            {catalogBannerUrl && (
              <img
                src={catalogBannerUrl}
                alt=""
                className="mt-2 h-24 w-full rounded-lg object-cover bg-gray-900"
              />
            )}
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
                {uploading === 'banner'
                  ? 'Enviando...'
                  : catalogBannerUrl
                    ? 'Trocar banner'
                    : 'Enviar banner'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={Boolean(uploading)}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleImageUpload('banner', file);
                  }}
                />
              </label>
              {catalogBannerUrl && (
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => setCatalogBannerUrl(null)}
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
            />
            Aceita entrega
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={pickupEnabled}
              onChange={(e) => setPickupEnabled(e.target.checked)}
            />
            Aceita retirada
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">Taxa de entrega (R$)</label>
          <input
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-40 rounded-xl border border-gray-300 px-3 py-2"
          />
          {parseMoneyInput(deliveryFee) > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Cobrado do cliente: {formatBRL(parseMoneyInput(deliveryFee))}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">
            Entrega grátis a partir de (R$)
          </label>
          <input
            value={freeDeliveryAbove}
            onChange={(e) => setFreeDeliveryAbove(e.target.value)}
            placeholder="0,00 (deixe vazio para desativar)"
            className="mt-1 w-56 rounded-xl border border-gray-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-slate-400">
            Pedidos com subtotal igual ou maior não pagam taxa de entrega.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">Pedido mínimo (R$)</label>
            <input
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">
              Pedido pendente expira em (min)
            </label>
            <input
              type="number"
              min={5}
              value={pendingTtl}
              onChange={(e) => setPendingTtl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">
              Prazo padrão do fiado (dias)
            </label>
            <input
              type="number"
              min={1}
              value={fiadoDueDays}
              onChange={(e) => setFiadoDueDays(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Usado para calcular o vencimento de vendas fiadas na conta-corrente do cliente.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">WhatsApp da loja</label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-9999"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">Endereço da loja</label>
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-500">Horário de funcionamento</label>
          <input
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            placeholder="Seg a Sáb, 10h às 22h"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Configurações salvas.</p>}

        <Button type="submit" disabled={mutation.isPending || Boolean(uploading)}>
          Salvar configurações
        </Button>
      </form>

      <div className="mt-5">
        <PaymentMethodsSection />
      </div>
      <div className="mt-5">
        <SurchargeRulesSection />
      </div>
      <div className="mt-5">
        <DeliveryZonesSection mode={deliveryZoneMode} onModeChange={setDeliveryZoneMode} />
      </div>
    </div>
  );
}
