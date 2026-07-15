import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { getSavedSlug } from '../../auth/AuthContext';
import { settingsApi } from '../../api/settings.api';
import { uploadsApi, type UploadPurpose } from '../../api/uploads.api';
import { Button } from '../../components/ui/Button';
import { formatBRL, parseMoneyInput } from '../../utils/money';

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
  const [minOrder, setMinOrder] = useState('');
  const [pendingTtl, setPendingTtl] = useState('30');
  const [whatsapp, setWhatsapp] = useState('');
  const [addressText, setAddressText] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [cityText, setCityText] = useState('');
  const [catalogLogoUrl, setCatalogLogoUrl] = useState<string | null>(null);
  const [catalogBannerUrl, setCatalogBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<UploadPurpose | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setCatalogEnabled(settings.catalogEnabled);
    setDeliveryEnabled(settings.deliveryEnabled);
    setPickupEnabled(settings.pickupEnabled);
    setDeliveryFee(settings.deliveryFeeCents ? (settings.deliveryFeeCents / 100).toFixed(2).replace('.', ',') : '');
    setMinOrder(settings.minOrderCents ? (settings.minOrderCents / 100).toFixed(2).replace('.', ',') : '');
    setPendingTtl(String(settings.pendingTtlMinutes));
    setWhatsapp(settings.whatsapp ?? '');
    setAddressText(settings.addressText ?? '');
    setOpeningHours(settings.openingHoursText ?? '');
    setCityText(settings.cityText ?? '');
    setCatalogLogoUrl(settings.catalogLogoUrl);
    setCatalogBannerUrl(settings.catalogBannerUrl);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.update({
        catalogEnabled,
        deliveryEnabled,
        pickupEnabled,
        deliveryFeeCents: parseMoneyInput(deliveryFee),
        minOrderCents: parseMoneyInput(minOrder),
        pendingTtlMinutes: Math.max(5, Number(pendingTtl) || 30),
        whatsapp: whatsapp.trim() || null,
        addressText: addressText.trim() || null,
        openingHoursText: openingHours.trim() || null,
        cityText: cityText.trim() || null,
        catalogLogoUrl,
        catalogBannerUrl,
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

  if (user?.role !== 'admin') {
    return <div className="p-8 text-neutral-500">Somente administradores acessam as configurações.</div>;
  }
  if (isLoading) return <div className="p-8 text-neutral-500">Carregando...</div>;

  const catalogUrl = `${window.location.origin}/c/${slug}`;

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-800">Configurações da loja</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-neutral-200 p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={catalogEnabled}
              onChange={(e) => setCatalogEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <div>
              <p className="font-medium text-neutral-800">Cardápio online ativo</p>
              <p className="text-sm text-neutral-500">
                Clientes fazem pedidos pelo link do cardápio.
              </p>
            </div>
          </label>
          {catalogEnabled && (
            <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 font-mono text-xs text-blue-700">
              {catalogUrl}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
          <div>
            <p className="font-medium text-neutral-800">Visual do cardápio</p>
            <p className="text-sm text-neutral-500">
              Logo e banner que o cliente vê no menu online. JPG/PNG/WebP · máx. 500 KB.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700">Cidade / região</label>
            <input
              value={cityText}
              onChange={(e) => setCityText(e.target.value)}
              placeholder="Ex.: Vargem Grande Paulista - SP"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700">Logo</label>
            {catalogLogoUrl && (
              <img
                src={catalogLogoUrl}
                alt=""
                className="mt-2 h-16 w-16 rounded-lg object-contain bg-black"
              />
            )}
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
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
            <label className="block text-sm font-medium text-neutral-700">Banner</label>
            {catalogBannerUrl && (
              <img
                src={catalogBannerUrl}
                alt=""
                className="mt-2 h-24 w-full rounded-lg object-cover bg-neutral-900"
              />
            )}
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
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
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
            />
            Aceita entrega
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={pickupEnabled}
              onChange={(e) => setPickupEnabled(e.target.checked)}
            />
            Aceita retirada
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Taxa de entrega (R$)</label>
          <input
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-40 rounded-md border border-neutral-300 px-3 py-2"
          />
          {parseMoneyInput(deliveryFee) > 0 && (
            <p className="mt-1 text-xs text-neutral-400">
              Cobrado do cliente: {formatBRL(parseMoneyInput(deliveryFee))}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Pedido mínimo (R$)</label>
            <input
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              Pedido pendente expira em (min)
            </label>
            <input
              type="number"
              min={5}
              value={pendingTtl}
              onChange={(e) => setPendingTtl(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">WhatsApp da loja</label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-9999"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Endereço da loja</label>
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Horário de funcionamento</label>
          <input
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            placeholder="Seg a Sáb, 10h às 22h"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Configurações salvas.</p>}

        <Button type="submit" disabled={mutation.isPending || Boolean(uploading)}>
          Salvar configurações
        </Button>
      </form>
    </div>
  );
}
