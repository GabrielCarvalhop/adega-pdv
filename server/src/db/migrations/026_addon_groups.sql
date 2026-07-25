-- Complementos reutilizáveis (ex.: "Sabor do energético"): grupo de opções
-- vinculável a vários produtos/combos, com preço adicional e baixa de
-- estoque opcional por opção. min_select/max_select são a fonte única de
-- verdade para obrigatório/opcional e único/múltiplo — não há coluna
-- "required" separada (evitaria estado inconsistente); a UI deriva o toggle
-- "obrigatório" de min_select >= 1.
CREATE TABLE addon_groups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  selection_type TEXT NOT NULL DEFAULT 'single' CHECK (selection_type IN ('single', 'multiple')),
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_select >= min_select)
);

ALTER TABLE addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON addon_groups
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);

-- product_id nulo = opção sem baixa de estoque (ex.: "sem gelo"); preenchido
-- = baixa quantity_per_selection unidades desse produto por seleção.
CREATE TABLE addon_options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  addon_group_id BIGINT NOT NULL REFERENCES addon_groups(id),
  label TEXT NOT NULL,
  product_id BIGINT REFERENCES products(id),
  extra_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (extra_price_cents >= 0),
  quantity_per_selection INTEGER NOT NULL DEFAULT 1 CHECK (quantity_per_selection > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addon_options_tenant_group ON addon_options(tenant_id, addon_group_id, active);

ALTER TABLE addon_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_options FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON addon_options
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);

-- Vínculo grupo <-> produto (N:N) — um grupo cadastrado uma vez pode ser
-- usado em vários produtos, sem duplicar cadastro de sabor. Como um combo
-- também é uma linha em `products` (ver 027_combos.sql), esta mesma tabela
-- já serve para vincular grupos a combos.
CREATE TABLE product_addon_groups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  addon_group_id BIGINT NOT NULL REFERENCES addon_groups(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, product_id, addon_group_id)
);

CREATE INDEX idx_product_addon_groups_tenant_product ON product_addon_groups(tenant_id, product_id);

ALTER TABLE product_addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_addon_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_addon_groups
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);

-- Snapshot do que foi escolhido em cada item de venda/pedido — mesmo padrão
-- de product_name_snapshot, não muda se o grupo/opção for editado depois.
CREATE TABLE sale_item_addons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  sale_item_id BIGINT NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  addon_option_id BIGINT REFERENCES addon_options(id) ON DELETE SET NULL,
  label_snapshot TEXT NOT NULL,
  extra_price_cents_snapshot INTEGER NOT NULL DEFAULT 0,
  product_id_snapshot BIGINT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_item_addons_tenant_item ON sale_item_addons(tenant_id, sale_item_id);

ALTER TABLE sale_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_item_addons FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sale_item_addons
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);

CREATE TABLE order_item_addons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_option_id BIGINT REFERENCES addon_options(id) ON DELETE SET NULL,
  label_snapshot TEXT NOT NULL,
  extra_price_cents_snapshot INTEGER NOT NULL DEFAULT 0,
  product_id_snapshot BIGINT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_item_addons_tenant_item ON order_item_addons(tenant_id, order_item_id);

ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_item_addons
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
