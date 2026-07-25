import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import * as service from './stock.service';

const movementSchema = z.object({
  productId: z.number().int().positive(),
  type: z.enum([
    'entrada_manual',
    'saida_manual',
    'ajuste',
    'devolucao',
    'perda',
    'avaria',
    'consumo_interno',
  ]),
  quantity: z.number().int().refine((v) => v !== 0, 'Quantidade não pode ser zero'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  unitCostCents: z.number().int().min(0).optional(),
});

export const stockRouter = Router();

stockRouter.get('/movements', async (req, res) => {
  const { productId, type, from, to } = req.query;
  res.json(
    await service.listMovements(req.auth!.tenantId!, {
      productId: productId ? Number(productId) : undefined,
      type: typeof type === 'string' ? type : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    })
  );
});

stockRouter.post('/movements', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(movementSchema), async (req, res) => {
  res
    .status(201)
    .json(await service.registerManualMovement(req.auth!.tenantId!, req.body, req.auth!.userId));
});
