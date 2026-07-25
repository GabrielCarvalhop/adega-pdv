-- Ordem de exibição dos produtos no cardápio público, editável pela loja.
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_products_tenant_sort ON products(tenant_id, sort_order);
