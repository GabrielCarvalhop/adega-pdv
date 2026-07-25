import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import { isStorageConfigured, supabaseStorage, UPLOADS_BUCKET } from '../../storage';
import * as productsService from '../products/products.service';

const MAX_BYTES = 500_000; // ~500 KB — leve para 4G
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const uploadSchema = z.object({
  purpose: z.enum(['product', 'logo', 'banner']),
  productId: z.number().int().positive().optional(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  dataBase64: z.string().min(1),
});

export const uploadsRouter = Router();

uploadsRouter.post('/', requireRole('GERENTE', 'ADMIN_LOJA'), validateBody(uploadSchema), async (req, res) => {
  if (!isStorageConfigured()) {
    throw new AppError(
      'Storage não configurado no servidor (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes)',
      500
    );
  }

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
  const path = `${tenantId}/${purpose}-${randomUUID()}.${ext}`;

  const { error } = await supabaseStorage!.storage
    .from(UPLOADS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new AppError(`Falha ao enviar imagem: ${error.message}`, 502);

  const { data: publicUrlData } = supabaseStorage!.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
  const url = publicUrlData.publicUrl;

  if (purpose === 'product' && productId) {
    const product = await productsService.updateProduct(tenantId, productId, { imageUrl: url });
    res.status(201).json({ url, product });
    return;
  }

  res.status(201).json({ url });
});
