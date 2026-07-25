import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import * as service from './settings.service';

const updateSchema = z.object({
  catalogEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  deliveryFeeCents: z.number().int().min(0).optional(),
  minOrderCents: z.number().int().min(0).optional(),
  pendingTtlMinutes: z.number().int().min(5).max(24 * 60).optional(),
  whatsapp: z.string().nullable().optional(),
  addressText: z.string().nullable().optional(),
  openingHoursText: z.string().nullable().optional(),
  catalogLogoUrl: z.string().max(500).nullable().optional(),
  catalogBannerUrl: z.string().max(500).nullable().optional(),
  cityText: z.string().max(120).nullable().optional(),
  deliveryZoneMode: z.enum(['off', 'bairro', 'cep']).optional(),
  fiadoDueDays: z.number().int().min(1).max(365).optional(),
  freeDeliveryAboveCents: z.number().int().min(0).optional(),
});

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  res.json(await service.getSettings(req.auth!.tenantId!));
});

settingsRouter.put('/', requireRole('ADMIN_LOJA'), validateBody(updateSchema), async (req, res) => {
  res.json(await service.updateSettings(req.auth!.tenantId!, req.body));
});
