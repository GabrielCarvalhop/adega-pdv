-- Entrega por bairro/CEP (fase 1, sem geocodificação): a loja pode bloquear
-- bairros/prefixos de CEP específicos e/ou sobrepor a taxa de entrega padrão
-- por zona. Sem nenhuma zona cadastrada, o comportamento é o de hoje (taxa
-- fixa única para toda entrega).
ALTER TABLE store_settings
  ADD COLUMN delivery_zone_mode TEXT NOT NULL DEFAULT 'off' CHECK (delivery_zone_mode IN ('off', 'bairro', 'cep'));

ALTER TABLE orders ADD COLUMN district TEXT;

CREATE TABLE delivery_zones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('bairro', 'cep_prefix')),
  value TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  fee_cents INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type, value)
);

CREATE INDEX idx_delivery_zones_tenant ON delivery_zones(tenant_id, type, active);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON delivery_zones
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
