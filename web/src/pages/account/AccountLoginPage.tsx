import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accountApi, setAccountToken } from '../../api/account.api';
import { Button } from '../../components/ui/Button';

export function AccountLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token } = await accountApi.login(email.trim(), password);
      setAccountToken(token);
      navigate('/conta', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-serif font-semibold text-gray-900">Conta da loja</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-500">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            Entrar
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Ainda não tem loja?{' '}
          <Link to="/cadastro" className="text-amber-600 hover:underline">
            Criar grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
