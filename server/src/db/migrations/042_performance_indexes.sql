-- Índices para consultas frequentes que hoje fazem sequential scan em
-- tabelas que crescem sem limite (histórico de estoque, vendas, caixa,
-- pedidos). Nenhuma mudança de comportamento, só de plano de execução.

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_created
  ON stock_movements (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant_opened
  ON cash_sessions (tenant_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_status_created
  ON sales (tenant_id, status, created_at DESC);

-- Parcial: casa exatamente o WHERE de sweepExpiredOrders (só pedidos
-- pendentes com expiração definida entram nesse filtro).
CREATE INDEX IF NOT EXISTS idx_orders_tenant_expires_pending
  ON orders (tenant_id, expires_at)
  WHERE status = 'pendente' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_expires
  ON stock_reservations (product_id, expires_at);
