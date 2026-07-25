-- Faixas de desconto automático por quantidade, por produto. discount_value
-- é percentual inteiro (1-100) quando discount_type='percent', ou centavos
-- de desconto por unidade quando discount_type='fixed'.
CREATE TABLE product_quantity_discounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 1),
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_id, min_quantity)
);

CREATE INDEX idx_product_qty_discounts_tenant_product ON product_quantity_discounts(tenant_id, product_id, active);

ALTER TABLE product_quantity_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_quantity_discounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_quantity_discounts
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
