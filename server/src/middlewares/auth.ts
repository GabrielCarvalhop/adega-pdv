import type { UserRole } from '@adega/shared';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface OperatorAuth {
  userId: number;
  /** null somente para SUPER_ADMIN — não pertence a nenhuma loja específica. */
  tenantId: number | null;
  role: UserRole;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: OperatorAuth;
      tenantId?: number | null;
    }
  }
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET é obrigatório em produção');
    }
    return 'dev-secret-nao-usar-em-producao';
  }
  return secret;
}

interface OperatorTokenPayload {
  sub: string;
  tenantId: number | null;
  role: UserRole;
  name: string;
  type: 'operator';
}

export function signOperatorToken(auth: OperatorAuth): string {
  const payload: Omit<OperatorTokenPayload, 'sub'> = {
    tenantId: auth.tenantId,
    role: auth.role,
    name: auth.name,
    type: 'operator',
  };
  // SUPER_ADMIN não tem loja — sessão mais longa (não faz login por PIN todo turno).
  const expiresIn = auth.role === 'SUPER_ADMIN' ? '7d' : '12h';
  return jwt.sign(payload, getJwtSecret(), { subject: String(auth.userId), expiresIn });
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) throw new AppError('Não autenticado', 401);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as unknown as OperatorTokenPayload;
    if (payload.type !== 'operator') throw new AppError('Não autenticado', 401);
    req.auth = {
      userId: Number(payload.sub),
      tenantId: payload.tenantId,
      role: payload.role,
      name: payload.name,
    };
    req.tenantId = payload.tenantId;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Sessão expirada — faça login novamente', 401);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new AppError('Não autenticado', 401);
    // SUPER_ADMIN passa em qualquer checagem de papel — é superset de todos
    // os papéis de loja. Acesso a dados de uma loja específica continua
    // exigindo um token com tenantId daquela loja (ver rota "entrar na loja").
    if (req.auth.role === 'SUPER_ADMIN') return next();
    if (!roles.includes(req.auth.role)) {
      throw new AppError('Você não tem permissão para esta ação', 403);
    }
    next();
  };
}

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.tenantId == null) {
    throw new AppError('Esta ação exige estar dentro de uma loja', 400);
  }
  next();
}
