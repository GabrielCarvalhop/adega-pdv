import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * Métricas de performance por request, propagadas por AsyncLocalStorage para
 * que qualquer camada (ex.: connection.ts) registre tempos sem receber o
 * `res` por parâmetro. Saem no header Server-Timing (visível na aba Network
 * do Chrome DevTools) e, para requests lentos, no log do servidor.
 */
interface PerfContext {
  marks: Map<string, number>;
}

const storage = new AsyncLocalStorage<PerfContext>();

/** Soma `durMs` à métrica `name` do request atual. No-op fora de um request. */
export function perfMark(name: string, durMs: number): void {
  const ctx = storage.getStore();
  if (ctx) ctx.marks.set(name, (ctx.marks.get(name) ?? 0) + durMs);
}

export function serverTiming(req: Request, res: Response, next: NextFunction): void {
  const ctx: PerfContext = { marks: new Map() };
  const start = performance.now();

  const originalWriteHead = res.writeHead.bind(res);
  // Header precisa ser gravado antes dos headers irem pro socket — writeHead
  // é o último ponto onde isso é garantido, independente de res.json/send/sendFile.
  (res as unknown as { writeHead: (...args: unknown[]) => Response }).writeHead = (
    ...args: unknown[]
  ) => {
    const total = performance.now() - start;
    const parts = [...ctx.marks].map(([name, dur]) => `${name};dur=${dur.toFixed(1)}`);
    parts.push(`app_total;dur=${total.toFixed(1)}`);
    if (!res.headersSent) res.setHeader('Server-Timing', parts.join(', '));
    if (total > 500 && req.path.startsWith('/api/')) {
      console.log(`[perf] ${req.method} ${req.originalUrl} ${parts.join(' ')}`);
    }
    return (originalWriteHead as (...a: unknown[]) => Response)(...args);
  };

  storage.run(ctx, next);
}
