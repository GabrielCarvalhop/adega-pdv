-- Índices para as consultas adicionadas nos relatórios v2 e estatísticas de
-- cliente, que hoje fariam Seq Scan à medida que os dados crescem.

-- Estatísticas do cliente e histórico de compras (WHERE customer_id + status).
CREATE INDEX idx_sales_tenant_customer ON sales(tenant_id, customer_id);

-- Split balcão × online do consolidado (JOIN orders ON orders.sale_id = sales.id).
CREATE INDEX idx_orders_sale_id ON orders(sale_id) WHERE sale_id IS NOT NULL;
