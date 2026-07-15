import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limit simples em memória por IP+rota. Suficiente para um processo
 * único; se um dia houver múltiplas instâncias, trocar por Redis.
 */
export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  const buckets = new Map<string, Bucket>();

  // Limpeza periódica para não acumular IPs antigos.
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, options.windowMs).unref();

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      throw new AppError('Muitas tentativas — aguarde um instante e tente novamente', 429);
    }
    next();
  };
}
