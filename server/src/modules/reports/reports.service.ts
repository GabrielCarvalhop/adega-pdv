import type { DailyConsolidated, PaymentBreakdown } from '@adega/shared';
import { withTenantTransaction } from '../../db/connection';
import * as cashRepo from '../cash/cash.repository';
import * as repo from './reports.repository';

export function getSalesByPeriod(tenantId: number, range: repo.DateRange, groupBy: repo.GroupBy) {
  return withTenantTransaction(tenantId, (client) => repo.salesByPeriod(client, range, groupBy));
}

export function getTopProducts(tenantId: number, range: repo.DateRange, limit: number) {
  return withTenantTransaction(tenantId, (client) => repo.topProducts(client, range, limit));
}

export function getMargin(tenantId: number, range: repo.DateRange) {
  return withTenantTransaction(tenantId, async (client) => {
    const rows = await repo.marginByProduct(client, range);
    const totals = rows.reduce(
      (acc, r) => {
        acc.revenueCents += r.revenueCents;
        acc.costCents += r.costCents;
        return acc;
      },
      { revenueCents: 0, costCents: 0 }
    );
    const marginCents = totals.revenueCents - totals.costCents;
    const marginPercent = totals.revenueCents > 0 ? (marginCents / totals.revenueCents) * 100 : 0;

    return {
      products: rows.map((r) => ({
        ...r,
        marginCents: r.revenueCents - r.costCents,
        marginPercent: r.revenueCents > 0 ? ((r.revenueCents - r.costCents) / r.revenueCents) * 100 : 0,
      })),
      totals: {
        revenueCents: totals.revenueCents,
        costCents: totals.costCents,
        marginCents,
        marginPercent,
      },
    };
  });
}

export function getCashHistory(tenantId: number, from?: string, to?: string) {
  return withTenantTransaction(tenantId, (client) => cashRepo.listHistory(client, from, to));
}

export function getDailyConsolidated(tenantId: number, date: string): Promise<DailyConsolidated> {
  return withTenantTransaction(tenantId, async (client) => {
    const registerRows = await repo.consolidatedByDay(client, date);
    const channel = await repo.channelSplitByDay(client, date);

    const totals: PaymentBreakdown = { dinheiro: 0, debito: 0, credito: 0, pix: 0 };
    let salesTotalCents = 0;
    let totalDifferenceCents = 0;

    const registers = registerRows.map((r) => {
      totals.dinheiro += r.dinheiro;
      totals.debito += r.debito;
      totals.credito += r.credito;
      totals.pix += r.pix;
      salesTotalCents += r.sales_total;
      if (r.difference_cents !== null) totalDifferenceCents += r.difference_cents;
      return {
        cashSessionId: r.cash_session_id,
        registerLabel: r.register_label,
        status: r.status as 'aberto' | 'fechado',
        openedAt: r.opened_at,
        closedAt: r.closed_at,
        salesTotalCents: r.sales_total,
        paymentBreakdown: {
          dinheiro: r.dinheiro,
          debito: r.debito,
          credito: r.credito,
          pix: r.pix,
        },
        differenceCents: r.difference_cents,
      };
    });

    return {
      date,
      registers,
      totals: {
        salesTotalCents,
        paymentBreakdown: totals,
        balcaoCents: channel.balcao,
        onlineCents: channel.online,
        totalDifferenceCents,
      },
    };
  });
}
