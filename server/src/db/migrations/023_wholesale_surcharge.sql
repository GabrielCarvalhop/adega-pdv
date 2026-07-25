-- Acréscimo automático no atacado: sale_type marca a venda; surcharge_rules
-- define o percentual por meio de pagamento (ex.: +2% no crédito).
ALTER TABLE sales
  ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'varejo' CHECK (sale_type IN ('varejo', 'atacado')),
  ADD COLUMN surcharge_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE surcharge_rules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  sale_type TEXT NOT NULL CHECK (sale_type IN ('varejo', 'atacado')),
  payment_method_id BIGINT NOT NULL REFERENCES payment_methods(id),
  percent NUMERIC(5, 2) NOT NULL CHECK (percent > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sale_type, payment_method_id)
);

CREATE INDEX idx_surcharge_rules_tenant ON surcharge_rules(tenant_id, sale_type, active);

ALTER TABLE surcharge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE surcharge_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON surcharge_rules
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
