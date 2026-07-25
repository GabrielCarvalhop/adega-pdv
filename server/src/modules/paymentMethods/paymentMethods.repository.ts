import type { PaymentMethodConfig, PaymentMethodKind } from '@adega/shared';
import type { PoolClient } from 'pg';

interface PaymentMethodRow {
  id: number;
  code: string;
  label: string;
  kind: PaymentMethodKind;
  active: boolean;
  sort_order: number;
  icon: string | null;
  allows_change: boolean;
  credits_account: boolean;
  retention_percent: string | number;
  settlement_days: number;
}

function mapRow(row: PaymentMethodRow): PaymentMethodConfig {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    kind: row.kind,
    active: row.active,
    sortOrder: row.sort_order,
    icon: row.icon,
    allowsChange: row.allows_change,
    creditsAccount: row.credits_account,
    // NUMERIC vem como string do driver pg — normaliza pra number.
    retentionPercent: Number(row.retention_percent),
    settlementDays: row.settlement_days,
  };
}

const DEFAULT_METHODS: {
  code: string;
  label: string;
  kind: PaymentMethodKind;
  sortOrder: number;
  active: boolean;
  icon: string;
  allowsChange: boolean;
}[] = [
  // Ícones em texto simples (não emoji): o banco de dev local está com
  // encoding WIN1252 (achado da auditoria da Fase 15) e caracteres de 4 bytes
  // como emoji quebram o INSERT com erro 22P05. Trocar para UTF8 no servidor
  // resolve de vez — até lá, evitar emoji em qualquer dado gravado.
  { code: 'dinheiro', label: 'Dinheiro', kind: 'dinheiro', sortOrder: 1, active: true, icon: 'R$', allowsChange: true },
  { code: 'debito', label: 'Débito', kind: 'cartao', sortOrder: 2, active: true, icon: 'DEB', allowsChange: false },
  { code: 'credito', label: 'Crédito', kind: 'cartao', sortOrder: 3, active: true, icon: 'CRED', allowsChange: false },
  { code: 'pix_direto', label: 'Pix direto', kind: 'pix', sortOrder: 4, active: true, icon: 'PIX', allowsChange: false },
  { code: 'pix_maquininha', label: 'Pix maquininha/QR', kind: 'pix', sortOrder: 5, active: true, icon: 'PIX', allowsChange: false },
  // Inativo por padrão — loja decide se quer oferecer fiado.
  { code: 'fiado', label: 'Fiado (conta do cliente)', kind: 'fiado', sortOrder: 6, active: false, icon: 'FIAD', allowsChange: false },
];

/** Cria os meios de pagamento padrão para um tenant novo. Idempotente. */
export async function seedDefaults(client: PoolClient, tenantId: number): Promise<void> {
  for (const method of DEFAULT_METHODS) {
    await client.query(
      `INSERT INTO payment_methods (tenant_id, code, label, kind, sort_order, active, icon, allows_change)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, code) DO NOTHING`,
      [
        tenantId,
        method.code,
        method.label,
        method.kind,
        method.sortOrder,
        method.active,
        method.icon,
        method.allowsChange,
      ]
    );
  }
}

export async function listAll(client: PoolClient): Promise<PaymentMethodConfig[]> {
  const { rows } = await client.query(
    'SELECT * FROM payment_methods ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(mapRow);
}

export async function listActive(client: PoolClient): Promise<PaymentMethodConfig[]> {
  const { rows } = await client.query(
    'SELECT * FROM payment_methods WHERE active = TRUE ORDER BY sort_order ASC, id ASC'
  );
  return rows.map(mapRow);
}

export async function findById(client: PoolClient, id: number): Promise<PaymentMethodConfig | undefined> {
  const { rows } = await client.query('SELECT * FROM payment_methods WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export interface CreateMethodInput {
  code: string;
  label: string;
  kind: PaymentMethodKind;
  icon?: string;
  allowsChange?: boolean;
  creditsAccount?: boolean;
  retentionPercent?: number;
  settlementDays?: number;
}

export async function create(client: PoolClient, input: CreateMethodInput): Promise<PaymentMethodConfig> {
  const { rows } = await client.query(
    `INSERT INTO payment_methods
      (tenant_id, code, label, kind, sort_order, icon, allows_change, credits_account, retention_percent, settlement_days)
     VALUES (current_setting('app.tenant_id')::bigint, $1, $2, $3,
       COALESCE((SELECT MAX(sort_order) + 1 FROM payment_methods), 1), $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.code,
      input.label,
      input.kind,
      input.icon ?? null,
      input.allowsChange ?? false,
      input.creditsAccount ?? false,
      input.retentionPercent ?? 0,
      input.settlementDays ?? 0,
    ]
  );
  return mapRow(rows[0]);
}

export interface UpdateMethodInput {
  label?: string;
  kind?: PaymentMethodKind;
  active?: boolean;
  icon?: string;
  allowsChange?: boolean;
  creditsAccount?: boolean;
  retentionPercent?: number;
  settlementDays?: number;
}

export async function update(
  client: PoolClient,
  id: number,
  input: UpdateMethodInput
): Promise<PaymentMethodConfig | undefined> {
  const current = await findById(client, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  const { rows } = await client.query(
    `UPDATE payment_methods SET
      label = $1, kind = $2, active = $3, icon = $4, allows_change = $5,
      credits_account = $6, retention_percent = $7, settlement_days = $8
     WHERE id = $9 RETURNING *`,
    [
      next.label,
      next.kind,
      next.active,
      next.icon,
      next.allowsChange,
      next.creditsAccount,
      next.retentionPercent,
      next.settlementDays,
      id,
    ]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}
