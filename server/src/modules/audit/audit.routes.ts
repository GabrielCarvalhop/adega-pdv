import { Router } from 'express';
import { requireRole } from '../../middlewares/auth';
import * as service from './audit.service';

export const auditRouter = Router();

auditRouter.use(requireRole('ADMIN_LOJA'));

auditRouter.get('/', async (req, res) => {
  const { action, from, to } = req.query;
  res.json(
    await service.listLogs(req.auth!.tenantId!, {
      action: typeof action === 'string' ? action : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    })
  );
});
