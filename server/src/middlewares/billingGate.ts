import { NextFunction, Request, Response } from 'express';
import { withSystemTransaction } from '../db/connection';
import { AppError } from './errorHandler';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface TenantBillingRow {
  status: string;
  trial_ends_at: string;
}

/**
 * Bloqueia ESCRITA quando a assinatura não está em dia (past_due/canceled ou
 * trial vencido). Leitura passa sempre — o lojista nunca perde acesso aos
 * próprios dados. Responde 402 com code SUBSCRIPTION_INACTIVE para o frontend
 * direcionar à tela de regularização.
 */
export async function billingGate(req: Request, _res: Response, next: NextFunction) {
  if (READ_METHODS.has(req.method)) {
    next();
    return;
  }

  const tenantId = req.tenantId;
  if (!tenantId) throw new AppError('Não autenticado', 401);

  const tenant = await withSystemTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT status, trial_ends_at FROM tenants WHERE id = $1',
      [tenantId]
    );
    return rows[0] as TenantBillingRow | undefined;
  });

  if (!tenant) throw new AppError('Loja não encontrada', 404);

  const trialExpired =
    tenant.status === 'trialing' && new Date(tenant.trial_ends_at).getTime() < Date.now();

  if (tenant.status === 'active' || (tenant.status === 'trialing' && !trialExpired)) {
    next();
    return;
  }

  throw new AppError(
    'Assinatura pendente — regularize o pagamento para continuar vendendo',
    402,
    'SUBSCRIPTION_INACTIVE'
  );
}

/**
 * Marca como past_due os trials vencidos. Chamado no boot e diariamente —
 * rede de segurança para o status nunca ficar "trialing" para sempre.
 */
export async function sweepExpiredTrials(): Promise<number> {
  return withSystemTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE tenants SET status = 'past_due', updated_at = now()
       WHERE status = 'trialing' AND trial_ends_at < now()`
    );
    return rowCount ?? 0;
  });
}

export function startTrialSweepJob() {
  const run = async () => {
    try {
      const count = await sweepExpiredTrials();
      if (count > 0) console.log(`Trials vencidos marcados como past_due: ${count}`);
    } catch (err) {
      console.error('Erro no sweep de trials vencidos:', err);
    }
  };
  void run();
  setInterval(run, 6 * 60 * 60 * 1000);
}
