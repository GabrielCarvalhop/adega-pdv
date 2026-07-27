import { Router } from 'express';
import { z } from 'zod';
import { withTenantTransaction } from '../../db/connection';
import { requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import { validateBody } from '../../middlewares/validate';
import * as repo from './customers.repository';
import * as ledgerService from './ledger.service';

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  document: z.string().optional(),
  birthdate: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  active: z.boolean().optional(),
  blocked: z.boolean().optional(),
});

const ledgerAmountSchema = z.object({
  amountCents: z.number().int().positive(),
  notes: z.string().max(300).optional(),
});

const ledgerAdjustmentSchema = z.object({
  amountCents: z.number().int().refine((v) => v !== 0, 'Valor não pode ser zero'),
  notes: z.string().min(1).max(300),
});

const addressSchema = z.object({
  label: z.string().optional(),
  zip: z.string().optional(),
  street: z.string().min(1),
  number: z.string().optional(),
  complement: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  reference: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

function parseId(raw: string | string[]): number {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (Number.isNaN(id)) throw new AppError('ID inválido');
  return id;
}

export const customersRouter = Router();

customersRouter.get('/', async (req, res) => {
  const { search, lite } = req.query;
  const searchTerm = typeof search === 'string' ? search : undefined;
  const customers = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    lite === '1' ? repo.findAllLite(client, searchTerm) : repo.findAll(client, searchTerm)
  );
  res.json(customers);
});

// Exportação CSV — dados pessoais, restrita a gerente/admin.
customersRouter.get('/export.csv', requireRole('GERENTE', 'ADMIN_LOJA'), async (req, res) => {
  const customers = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.findAll(client)
  );
  const header = 'nome;telefone;whatsapp;email;documento;nascimento;observacoes';
  const lines = customers.map((c) =>
    [c.name, c.phone, c.whatsapp, c.email, c.document, c.birthdate, c.notes]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(';')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"');
  res.send('﻿' + [header, ...lines].join('\r\n'));
});

// Checagem de duplicidade por telefone (aviso no cadastro).
customersRouter.get('/by-phone/:phone', async (req, res) => {
  const phone = Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone;
  const customer = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.findByPhone(client, phone ?? '')
  );
  res.json(customer ?? null);
});

customersRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const customer = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.findById(client, id)
  );
  if (!customer) throw new AppError('Cliente não encontrado', 404);
  res.json(customer);
});

customersRouter.get('/:id/stats', async (req, res) => {
  const id = parseId(req.params.id);
  res.json(
    await withTenantTransaction(req.auth!.tenantId!, (client) => repo.getStats(client, id))
  );
});

customersRouter.get('/:id/addresses', async (req, res) => {
  const id = parseId(req.params.id);
  res.json(
    await withTenantTransaction(req.auth!.tenantId!, (client) => repo.listAddresses(client, id))
  );
});

customersRouter.post('/:id/addresses', validateBody(addressSchema), async (req, res) => {
  const id = parseId(req.params.id);
  const address = await withTenantTransaction(req.auth!.tenantId!, async (client) => {
    const customer = await repo.findById(client, id);
    if (!customer) throw new AppError('Cliente não encontrado', 404);
    return repo.insertAddress(client, id, req.body);
  });
  res.status(201).json(address);
});

customersRouter.delete('/:id/addresses/:addressId', async (req, res) => {
  const id = parseId(req.params.id);
  const addressId = parseId(req.params.addressId);
  await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.deleteAddress(client, id, addressId)
  );
  res.status(204).end();
});

customersRouter.post('/', validateBody(createSchema), async (req, res) => {
  const customer = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.create(client, req.body)
  );
  res.status(201).json(customer);
});

customersRouter.put('/:id', validateBody(updateSchema), async (req, res) => {
  const id = parseId(req.params.id);
  const updated = await withTenantTransaction(req.auth!.tenantId!, (client) =>
    repo.update(client, id, req.body)
  );
  if (!updated) throw new AppError('Cliente não encontrado', 404);
  res.json(updated);
});

customersRouter.delete('/:id', requireRole('GERENTE', 'ADMIN_LOJA'), async (req, res) => {
  const id = parseId(req.params.id);
  await withTenantTransaction(req.auth!.tenantId!, (client) => repo.softDelete(client, id));
  res.status(204).end();
});

customersRouter.get('/:id/ledger', async (req, res) => {
  const id = parseId(req.params.id);
  res.json(await ledgerService.getLedger(req.auth!.tenantId!, id));
});

customersRouter.post('/:id/ledger/payment', validateBody(ledgerAmountSchema), async (req, res) => {
  const id = parseId(req.params.id);
  const entry = await ledgerService.addPayment(
    req.auth!.tenantId!,
    id,
    req.body.amountCents,
    req.body.notes,
    req.auth!.userId
  );
  res.status(201).json(entry);
});

customersRouter.post('/:id/ledger/credit', validateBody(ledgerAmountSchema), async (req, res) => {
  const id = parseId(req.params.id);
  const entry = await ledgerService.addCredit(
    req.auth!.tenantId!,
    id,
    req.body.amountCents,
    req.body.notes,
    req.auth!.userId
  );
  res.status(201).json(entry);
});

customersRouter.post(
  '/:id/ledger/adjustment',
  requireRole('GERENTE', 'ADMIN_LOJA'),
  validateBody(ledgerAdjustmentSchema),
  async (req, res) => {
    const id = parseId(req.params.id);
    const entry = await ledgerService.addAdjustment(
      req.auth!.tenantId!,
      id,
      req.body.amountCents,
      req.body.notes,
      req.auth!.userId
    );
    res.status(201).json(entry);
  }
);
