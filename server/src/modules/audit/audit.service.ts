import type { AuditLog } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';

/**
 * Registra uma ação sensível na trilha de auditoria. DEVE ser chamado dentro
 * da MESMA transação da operação auditada — se a operação falhar, o log some
 * junto (nunca há log de algo que não aconteceu). A tabela é imutável para a
 * aplicação (sem UPDATE/DELETE — garantido por grants no banco).
 */
export async function logAction(
  client: PoolClient,
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  details?: Record<string, unknown>
): Promise<void> {
  await client.query(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
    [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
  );
}

interface AuditRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilters {
  action?: string;
  from?: string;
  to?: string;
}

export function listLogs(tenantId: number, filters: AuditFilters) {
  return withTenantTransaction(tenantId, async (client) => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.action) {
      params.push(filters.action);
      clauses.push(`a.action = $${params.length}`);
    }
    if (filters.from) {
      params.push(filters.from);
      clauses.push(`a.created_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      clauses.push(`a.created_at <= $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT a.*, u.name AS user_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT 500`,
      params
    );
    return (rows as AuditRow[]).map(
      (r): AuditLog & { userName: string | null } => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        details: r.details,
        createdAt: r.created_at,
      })
    );
  });
}
