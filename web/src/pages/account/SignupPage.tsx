import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accountApi, setAccountToken } from '../../api/account.api';
import { Button } from '../../components/ui/Button';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function SignupPage() {
  const navigate = useNavigate();
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleStoreName(value: string) {
    setStoreName(value);
    if (!slugTouched) setStoreSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Senha deve ter pelo menos 8 caracteres');
    if (!/^\d{4,8}$/.test(pin)) return setError('PIN deve ter de 4 a 8 dígitos numéricos');
    setSubmitting(true);
    try {
      const { token } = await accountApi.signup({
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        storeName: storeName.trim(),
        storeSlug: storeSlug.trim(),
        pin,
      });
      setAccountToken(token);
      navigate('/conta', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-serif font-semibold text-gray-900">Crie sua adega</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          14 dias grátis — sem cartão de crédito
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">Seu nome</label>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Nome da loja</label>
            <input
              value={storeName}
              onChange={(e) => handleStoreName(e.target.value)}
              placeholder="Ex: Adega do João"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Endereço da loja</label>
            <input
              value={storeSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setStoreSlug(slugify(e.target.value));
              }}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-sm"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              Sua equipe entrará em: /t/{storeSlug || 'sua-loja'}/login
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">
              PIN do caixa (seu acesso como administrador)
            </label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              placeholder="4 a 8 dígitos"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar minha loja'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link to="/conta/login" className="text-amber-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
