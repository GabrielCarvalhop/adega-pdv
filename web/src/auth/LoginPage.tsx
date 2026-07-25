import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authApi, LoginUser } from '../api/auth.api';
import { Button } from '../components/ui/Button';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ['auth', 'login-users', slug],
    queryFn: () => authApi.listLoginUsers(slug!),
    enabled: Boolean(slug),
    retry: false,
  });

  async function submit(finalPin: string) {
    if (!selected || !slug) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(slug, selected.id, finalPin);
      navigate('/venda', { replace: true });
    } catch {
      setError('PIN incorreto');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  function press(digit: string) {
    if (pin.length >= 8) return;
    setPin(pin + digit);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-serif font-semibold text-gray-900">Adega PDV</h1>
        <p className="mb-4 text-center text-xs uppercase tracking-wide text-slate-400">
          Loja: {slug}
        </p>

        {isError && (
          <p className="text-center text-sm text-red-600">
            Loja não encontrada — confira o endereço.
          </p>
        )}

        {!selected && !isError && (
          <>
            <p className="mb-4 text-center text-sm text-slate-500">Selecione o operador</p>
            {isLoading && <p className="text-center text-slate-400">Carregando...</p>}
            <div className="space-y-2">
              {users?.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelected(u);
                    setPin('');
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-300 px-4 py-3 text-left hover:bg-gray-100"
                >
                  <span className="font-medium text-gray-900">{u.name}</span>
                  <span className="text-xs uppercase text-slate-400">{u.role}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {selected && (
          <>
            <p className="mb-1 text-center text-sm text-slate-500">Olá,</p>
            <p className="mb-4 text-center text-lg font-semibold text-gray-900">{selected.name}</p>

            <div className="mb-4 flex justify-center gap-2">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-amber-600' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => press(d)}
                  className="rounded-lg bg-gray-100 py-4 text-xl font-semibold hover:bg-gray-200"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => setPin(pin.slice(0, -1))}
                className="rounded-lg bg-gray-100 py-4 text-xl hover:bg-gray-200"
              >
                ←
              </button>
              <button
                onClick={() => press('0')}
                className="rounded-lg bg-gray-100 py-4 text-xl font-semibold hover:bg-gray-200"
              >
                0
              </button>
              <button
                onClick={() => submit(pin)}
                disabled={pin.length < 4 || submitting}
                className="rounded-lg bg-amber-600 py-4 text-white hover:bg-amber-700 disabled:opacity-40"
              >
                Entrar
              </button>
            </div>

            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                setSelected(null);
                setPin('');
                setError(null);
              }}
            >
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
