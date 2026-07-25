-- Esqueleto de combo: um combo é uma linha normal em `products` (herda
-- preço de venda, cardápio, complementos vinculáveis via product_addon_groups
-- já existente) marcada com is_combo=true. Quando is_combo=true, o próprio
-- stock_quantity do produto NÃO é usado/baixado — em vez disso, cada
-- combo_item é baixado (quantity * quantidade vendida do combo).
ALTER TABLE products ADD COLUMN is_combo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE combo_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  combo_product_id BIGINT NOT NULL REFERENCES products(id),
  component_product_id BIGINT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (tenant_id, combo_product_id, component_product_id)
);

CREATE INDEX idx_combo_items_tenant_combo ON combo_items(tenant_id, combo_product_id);

ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON combo_items
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
