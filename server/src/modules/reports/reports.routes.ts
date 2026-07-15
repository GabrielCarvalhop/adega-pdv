import { Router } from 'express';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import * as service from './reports.service';
import type { GroupBy } from './reports.repository';

export const reportsRouter = Router();

reportsRouter.use(requireRole('gerente', 'admin'));

function parseRange(req: import('express').Request) {
  const { from, to } = req.query;
  return {
    from: typeof from === 'string' ? from : undefined,
    to: typeof to === 'string' ? to : undefined,
  };
}

reportsRouter.get('/sales', async (req, res) => {
  const range = parseRange(req);
  const groupBy = (req.query.groupBy as string) || 'day';
  if (!['day', 'week', 'month'].includes(groupBy)) {
    throw new AppError('groupBy inválido — use day, week ou month');
  }
  res.json(await service.getSalesByPeriod(req.auth!.tenantId, range, groupBy as GroupBy));
});

reportsRouter.get('/top-products', async (req, res) => {
  const range = parseRange(req);
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  res.json(await service.getTopProducts(req.auth!.tenantId, range, limit));
});

reportsRouter.get('/margin', async (req, res) => {
  const range = parseRange(req);
  res.json(await service.getMargin(req.auth!.tenantId, range));
});

reportsRouter.get('/cash-history', async (req, res) => {
  const range = parseRange(req);
  res.json(await service.getCashHistory(req.auth!.tenantId, range.from, range.to));
});

reportsRouter.get('/daily-consolidated', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Data inválida (use YYYY-MM-DD)');
  res.json(await service.getDailyConsolidated(req.auth!.tenantId, date));
});
