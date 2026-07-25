import type { StoreSettings, UpdateStoreSettingsRequest } from '@adega/shared';
import type { PoolClient } from 'pg';
import { withTenantTransaction } from '../../db/connection';

interface SettingsRow {
  catalog_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee_cents: number;
  min_order_cents: number;
  pending_ttl_minutes: number;
  whatsapp: string | null;
  address_text: string | null;
  opening_hours_text: string | null;
  catalog_logo_url: string | null;
  catalog_banner_url: string | null;
  city_text: string | null;
  delivery_zone_mode: string;
  fiado_due_days: number;
  free_delivery_above_cents: number;
}

const DEFAULTS: StoreSettings = {
  catalogEnabled: false,
  deliveryEnabled: true,
  pickupEnabled: true,
  deliveryFeeCents: 0,
  minOrderCents: 0,
  pendingTtlMinutes: 30,
  whatsapp: null,
  addressText: null,
  openingHoursText: null,
  catalogLogoUrl: null,
  catalogBannerUrl: null,
  cityText: null,
  deliveryZoneMode: 'off',
  fiadoDueDays: 30,
  freeDeliveryAboveCents: 0,
};

function mapRow(row: SettingsRow): StoreSettings {
  return {
    catalogEnabled: row.catalog_enabled,
    deliveryEnabled: row.delivery_enabled,
    pickupEnabled: row.pickup_enabled,
    deliveryFeeCents: row.delivery_fee_cents,
    minOrderCents: row.min_order_cents,
    pendingTtlMinutes: row.pending_ttl_minutes,
    whatsapp: row.whatsapp,
    addressText: row.address_text,
    openingHoursText: row.opening_hours_text,
    catalogLogoUrl: row.catalog_logo_url ?? null,
    catalogBannerUrl: row.catalog_banner_url ?? null,
    cityText: row.city_text ?? null,
    deliveryZoneMode: row.delivery_zone_mode as StoreSettings['deliveryZoneMode'],
    fiadoDueDays: row.fiado_due_days,
    freeDeliveryAboveCents: row.free_delivery_above_cents,
  };
}

export async function loadSettings(client: PoolClient): Promise<StoreSettings> {
  const { rows } = await client.query('SELECT * FROM store_settings LIMIT 1');
  return rows[0] ? mapRow(rows[0]) : DEFAULTS;
}

export function getSettings(tenantId: number): Promise<StoreSettings> {
  return withTenantTransaction(tenantId, (client) => loadSettings(client));
}

export function updateSettings(
  tenantId: number,
  data: UpdateStoreSettingsRequest
): Promise<StoreSettings> {
  return withTenantTransaction(tenantId, async (client) => {
    const current = await loadSettings(client);
    const next: StoreSettings = { ...current, ...data };
    const { rows } = await client.query(
      `INSERT INTO store_settings
        (catalog_enabled, delivery_enabled, pickup_enabled, delivery_fee_cents, min_order_cents,
         pending_ttl_minutes, whatsapp, address_text, opening_hours_text,
         catalog_logo_url, catalog_banner_url, city_text, delivery_zone_mode, fiado_due_days,
         free_delivery_above_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (tenant_id) DO UPDATE SET
         catalog_enabled = EXCLUDED.catalog_enabled,
         delivery_enabled = EXCLUDED.delivery_enabled,
         pickup_enabled = EXCLUDED.pickup_enabled,
         delivery_fee_cents = EXCLUDED.delivery_fee_cents,
         min_order_cents = EXCLUDED.min_order_cents,
         pending_ttl_minutes = EXCLUDED.pending_ttl_minutes,
         whatsapp = EXCLUDED.whatsapp,
         address_text = EXCLUDED.address_text,
         opening_hours_text = EXCLUDED.opening_hours_text,
         catalog_logo_url = EXCLUDED.catalog_logo_url,
         catalog_banner_url = EXCLUDED.catalog_banner_url,
         city_text = EXCLUDED.city_text,
         delivery_zone_mode = EXCLUDED.delivery_zone_mode,
         fiado_due_days = EXCLUDED.fiado_due_days,
         free_delivery_above_cents = EXCLUDED.free_delivery_above_cents,
         updated_at = now()
       RETURNING *`,
      [
        next.catalogEnabled,
        next.deliveryEnabled,
        next.pickupEnabled,
        next.deliveryFeeCents,
        next.minOrderCents,
        next.pendingTtlMinutes,
        next.whatsapp,
        next.addressText,
        next.openingHoursText,
        next.catalogLogoUrl,
        next.catalogBannerUrl,
        next.cityText,
        next.deliveryZoneMode,
        next.fiadoDueDays,
        next.freeDeliveryAboveCents,
      ]
    );
    return mapRow(rows[0]);
  });
}
