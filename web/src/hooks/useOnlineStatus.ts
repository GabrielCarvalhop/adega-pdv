import { useEffect, useState } from 'react';

const HEALTH_CHECK_INTERVAL_MS = 20000;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Sistema é 100% online (sem modo offline) — este hook só detecta e sinaliza
 * a perda de conexão, nunca tenta operar sem servidor. `navigator.onLine`
 * sozinho não cobre "wifi conectado mas sem internet/servidor fora do ar",
 * por isso soma um health check ativo contra /api/health.
 */
export function useOnlineStatus(): boolean {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    function handleOnline() {
      setBrowserOnline(true);
    }
    function handleOffline() {
      setBrowserOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkServer() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        if (!cancelled) setServerReachable(res.ok);
      } catch {
        if (!cancelled) setServerReachable(false);
      } finally {
        clearTimeout(timeout);
      }
    }

    checkServer();
    const interval = setInterval(checkServer, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return browserOnline && serverReachable;
}
