import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from './AuthContext';

function StoreForm({ onSwitchToAdmin }: { onSwitchToAdmin: () => void }) {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (clean) navigate(`/t/${clean}/login`);
  }

  return (
    <>
      <h1 className="mb-1 text-center text-2xl font-serif font-semibold text-gray-900">Adega PDV</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Digite o endereço da sua loja para entrar</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ex: minha-adega"
          autoFocus
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center"
        />
        <Button type="submit" className="w-full" disabled={!slug.trim()}>
          Continuar
        </Button>
      </form>
      <button
        type="button"
        onClick={onSwitchToAdmin}
        className="mt-4 block w-full text-center text-sm text-slate-400 hover:text-amber-600"
      >
        Sou administrador do sistema
      </button>
    </>
  );
}

function SuperAdminForm({ onBack }: { onBack: () => void }) {
  const { superAdminLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await superAdminLogin(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mb-1 text-center text-2xl font-serif font-semibold text-gray-900">
        Administrador do sistema
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">Acesso do dono da plataforma</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail"
          autoFocus
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center"
        />
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting || !email.trim() || !password}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 block w-full text-center text-sm text-slate-400 hover:text-amber-600"
      >
        Voltar
      </button>
    </>
  );
}

export function StoreEntryPage() {
  const [mode, setMode] = useState<'loja' | 'admin'>('loja');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        {mode === 'loja' ? (
          <StoreForm onSwitchToAdmin={() => setMode('admin')} />
        ) : (
          <SuperAdminForm onBack={() => setMode('loja')} />
        )}
      </div>
    </div>
  );
}
