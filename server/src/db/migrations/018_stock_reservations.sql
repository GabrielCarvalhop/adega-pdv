-- Reserva de estoque para pedidos online pendentes: permite validar
-- disponibilidade na criação do pedido sem alterar products.stock_quantity
-- até o aceite (que continua sendo o desconto real e definitivo).
CREATE TABLE stock_reservations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  order_id BIGINT NOT NULL REFERENCES orders(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_reservations_tenant_product ON stock_reservations(tenant_id, product_id);
-- Um pedido reserva no máximo uma linha por produto (quantidade agregada).
CREATE UNIQUE INDEX idx_stock_reservations_order_product ON stock_reservations(order_id, product_id);

ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_reservations
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
