import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as productsService from '../products/products.service';

const MAX_BYTES = 500_000; // ~500 KB — leve para 4G
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const uploadsRoot = path.join(__dirname, '..', '..', '..', 'data', 'uploads');

const uploadSchema = z.object({
  purpose: z.enum(['product', 'logo', 'banner']),
  productId: z.number().int().positive().optional(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  dataBase64: z.string().min(1),
});

export const uploadsRouter = Router();

uploadsRouter.post('/', requireRole('gerente', 'admin'), validateBody(uploadSchema), async (req, res) => {
  const tenantId = req.auth!.tenantId!;
  const { purpose, productId, contentType, dataBase64 } = req.body as z.infer<typeof uploadSchema>;

  if (purpose === 'product' && !productId) {
    throw new AppError('productId é obrigatório para foto de produto');
  }

  const raw = dataBase64.replace(/^data:image\/\w+;base64,/, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw new AppError('Imagem inválida');
  }
  if (buffer.length === 0) throw new AppError('Imagem vazia');
  if (buffer.length > MAX_BYTES) {
    throw new AppError('Imagem muito grande — use até 500 KB (webp/jpg recomendado)');
  }

  const ext = ALLOWED.get(contentType)!;
  const dir = path.join(uploadsRoot, String(tenantId));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${purpose}-${randomUUID()}.${ext}`;
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buffer);

  const url = `/uploads/${tenantId}/${filename}`;

  if (purpose === 'product' && productId) {
    const product = await productsService.updateProduct(tenantId, productId, { imageUrl: url });
    res.status(201).json({ url, product });
    return;
  }

  res.status(201).json({ url });
});
