-- Meios de pagamento configuráveis por loja (substituirá o enum fixo de
-- payments.method / orders.payment_method_intent numa migration futura).
CREATE TABLE payment_methods (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dinheiro', 'pix', 'cartao', 'outro')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_payment_methods_tenant_active ON payment_methods(tenant_id, active);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payment_methods
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);

-- Seed dos métodos padrão para tenants já existentes. 'pix_direto' assume o
-- lugar do antigo 'pix' genérico; 'pix_maquininha' é o novo meio separado.
INSERT INTO payment_methods (tenant_id, code, label, kind, sort_order)
SELECT t.id, v.code, v.label, v.kind, v.sort_order
FROM tenants t
CROSS JOIN (VALUES
  ('dinheiro', 'Dinheiro', 'dinheiro', 1),
  ('debito', 'Débito', 'cartao', 2),
  ('credito', 'Crédito', 'cartao', 3),
  ('pix_direto', 'Pix direto', 'pix', 4),
  ('pix_maquininha', 'Pix maquininha/QR', 'pix', 5)
) AS v(code, label, kind, sort_order);
