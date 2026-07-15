import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as service from './account.service';

const signupSchema = z.object({
  ownerName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  storeName: z.string().min(1),
  storeSlug: z.string().min(2),
  pin: z.string().regex(/^\d{4,8}$/),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface AccountAuth {
  ownerId: number;
  tenantId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      accountAuth?: AccountAuth;
    }
  }
}

function requireAccountAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError('Não autenticado', 401);
  req.accountAuth = service.verifyAccountToken(header.slice(7));
  next();
}

export const accountRouter = Router();

accountRouter.post('/signup', validateBody(signupSchema), async (req, res) => {
  res.status(201).json(await service.signup(req.body));
});

accountRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  res.json(await service.login(req.body.email, req.body.password));
});

accountRouter.get('/me', requireAccountAuth, async (req, res) => {
  res.json(await service.getAccountInfo(req.accountAuth!.ownerId));
});
