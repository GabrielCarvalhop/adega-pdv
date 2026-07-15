import { FormEvent, useEffect, useState } from 'react';
import {
  type CatalogCustomerProfile,
  clearCustomerProfile,
  formatPhoneMask,
  hashPassword,
  isValidBrazilPhone,
  saveCustomerProfile,
} from './customerProfile';

type AuthStep = 'phone' | 'register' | 'account';

export function CustomerAuthFlow({
  slug,
  profile,
  onClose,
  onProfileChange,
}: {
  slug: string;
  profile: CatalogCustomerProfile | null;
  onClose: () => void;
  onProfileChange: (next: CatalogCustomerProfile | null) => void;
}) {
  const [step, setStep] = useState<AuthStep>(profile ? 'account' : 'phone');
  const [phone, setPhone] = useState(profile ? formatPhoneMask(profile.phone) : '');
  const [name, setName] = useState(profile?.name ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [usePassword, setUsePassword] = useState(Boolean(profile?.passwordHash));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function handlePhoneContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidBrazilPhone(phone)) {
      setError('Informe um telefone válido com DDD');
      return;
    }
    // Mesmo aparelho + mesmo número → já “logado”; senão pede cadastro/complemento.
    if (profile && profile.phone === phone.replace(/\D/g, '')) {
      setStep('account');
      return;
    }
    setName(profile?.name ?? '');
    setAddress(profile?.address ?? '');
    setUsePassword(Boolean(profile?.passwordHash));
    setPassword('');
    setPasswordConfirm('');
    setStep('register');
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || name.trim().length < 2) {
      setError('Informe seu nome');
      return;
    }
    if (!address.trim() || address.trim().length < 5) {
      setError('Informe o endereço para entrega');
      return;
    }
    if (usePassword) {
      if (password.length < 4) {
        setError('A senha deve ter pelo menos 4 caracteres');
        return;
      }
      if (password !== passwordConfirm) {
        setError('As senhas não conferem');
        return;
      }
    }
    setSaving(true);
    try {
      const passwordHash = usePassword ? await hashPassword(password) : null;
      const saved = saveCustomerProfile(slug, {
        phone,
        name,
        address,
        passwordHash,
        createdAt: profile?.createdAt,
      });
      onProfileChange(saved);
      setStep('account');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearCustomerProfile(slug);
    onProfileChange(null);
    setPhone('');
    setName('');
    setAddress('');
    setPassword('');
    setPasswordConfirm('');
    setUsePassword(false);
    setStep('phone');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/45 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 mb-0 w-[min(100%-1.5rem,420px)] rounded-2xl bg-white p-6 shadow-2xl sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-lg leading-none text-neutral-500 hover:bg-neutral-200"
          aria-label="Fechar"
        >
          ×
        </button>

        {step === 'phone' && (
          <form onSubmit={handlePhoneContinue} className="space-y-5 pt-2">
            <div>
              <h2 className="pr-8 text-xl font-bold text-neutral-900">
                Informe seu número de telefone
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Ele é importante para falarmos com você caso necessário
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Telefone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="(00) 90000-0000"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                className="w-full rounded-xl border border-neutral-800 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-black/20"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-black py-3.5 text-sm font-bold uppercase tracking-wide text-white"
            >
              Confirmar
            </button>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 pt-2">
            <div>
              <h2 className="pr-8 text-xl font-bold text-neutral-900">Complete seu cadastro</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Salvo neste celular para agilizar seus pedidos. Sem e-mail.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">Telefone</span>
              <input
                value={formatPhoneMask(phone)}
                readOnly
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-600"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">Seu nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-neutral-300 px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">
                Endereço de entrega
              </span>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                rows={2}
                placeholder="Rua, número, bairro, referência"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
              />
              Quero proteger com senha (opcional)
            </label>

            {usePassword && (
              <>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3"
                />
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Confirmar senha"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3"
                />
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-semibold"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-[1.4] rounded-xl bg-black py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        )}

        {step === 'account' && profile && (
          <div className="space-y-4 pt-2">
            <div>
              <h2 className="pr-8 text-xl font-bold text-neutral-900">Minha conta</h2>
              <p className="mt-1 text-sm text-neutral-500">Dados salvos neste aparelho</p>
            </div>

            <div className="rounded-xl bg-neutral-50 p-4 text-sm">
              <p className="font-semibold text-neutral-900">{profile.name}</p>
              <p className="mt-1 text-neutral-600">{formatPhoneMask(profile.phone)}</p>
              <p className="mt-2 text-neutral-600">{profile.address}</p>
              {profile.passwordHash && (
                <p className="mt-2 text-xs text-emerald-700">Senha de proteção ativa</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setPhone(formatPhoneMask(profile.phone));
                setName(profile.name);
                setAddress(profile.address);
                setUsePassword(Boolean(profile.passwordHash));
                setPassword('');
                setPasswordConfirm('');
                setStep('register');
              }}
              className="w-full rounded-xl border border-neutral-200 py-3 text-sm font-semibold"
            >
              Editar dados
            </button>

            <button
              type="button"
              onClick={() => {
                setPhone('');
                setStep('phone');
              }}
              className="w-full rounded-xl border border-neutral-200 py-3 text-sm font-semibold"
            >
              Entrar com outro número
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl py-3 text-sm font-semibold text-red-600"
            >
              Sair deste aparelho
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-black py-3.5 text-sm font-bold uppercase text-white"
            >
              Continuar comprando
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
