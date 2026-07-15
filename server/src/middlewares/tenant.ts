import { NextFunction, Request, Response } from 'express';
import { withSystemTransaction } from '../db/connection';
import { AppError } from './errorHandler';

export interface TenantInfo {
  id: number;
  slug: string;
  storeName: string;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantInfo;
    }
  }
}

/**
 * Resolve o tenant a partir do slug na URL (/api/t/:slug/...).
 * Único ponto do sistema onde o tenant vem de input do cliente — usado apenas
 * nas rotas públicas pré-login (lista de operadores e login por PIN).
 */
export async function resolveTenantBySlug(req: Request, _res: Response, next: NextFunction) {
  const slug = req.params.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)) {
    throw new AppError('Loja não encontrada', 404);
  }

  const tenant = await withSystemTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT id, slug, store_name, status FROM tenants WHERE slug = $1 AND status <> 'canceled'",
      [slug]
    );
    return rows[0] as { id: number; slug: string; store_name: string; status: string } | undefined;
  });

  if (!tenant) throw new AppError('Loja não encontrada', 404);

  req.tenant = {
    id: tenant.id,
    slug: tenant.slug,
    storeName: tenant.store_name,
    status: tenant.status,
  };
  req.tenantId = tenant.id;
  next();
}
