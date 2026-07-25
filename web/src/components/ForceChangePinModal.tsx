import { FormEvent, useState } from 'react';
import { authApi } from '../api/auth.api';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui/Button';

// Bloqueia o uso do sistema até o PIN inicial (repassado por WhatsApp/e-mail)
// ser trocado por um escolhido pelo próprio usuário — sem Esc, sem botão de
// fechar, de propósito.
export function ForceChangePinModal() {
  const { refresh } = useAuth();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,8}$/.test(pin)) {
      setError('O PIN deve ter de 4 a 8 dígitos numéricos');
      return;
    }
    if (pin !== confirm) {
      setError('Os PINs não coincidem');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePin(pin);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar o PIN');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Escolha seu PIN</h2>
        <p className="mt-1 text-sm text-slate-500">
          Por segurança, defina um PIN novo antes de continuar — o inicial foi repassado por fora do sistema.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Novo PIN (4 a 8 dígitos)"
            autoFocus
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center text-lg tracking-widest"
          />
          <input
            type="password"
            inputMode="numeric"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            placeholder="Confirme o novo PIN"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-center text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Definir PIN e continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
