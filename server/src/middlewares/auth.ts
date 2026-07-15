import type { UserRole } from '@adega/shared';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface OperatorAuth {
  userId: number;
  tenantId: number;
  role: UserRole;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: OperatorAuth;
      tenantId?: number;
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
  tenantId: number;
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
  return jwt.sign(payload, getJwtSecret(), { subject: String(auth.userId), expiresIn: '12h' });
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
    if (!roles.includes(req.auth.role)) {
      throw new AppError('Você não tem permissão para esta ação', 403);
    }
    next();
  };
}
