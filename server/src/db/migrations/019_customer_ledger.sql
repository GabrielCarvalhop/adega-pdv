-- Saldo do cliente (conta-corrente): separado do histórico de compras
-- (customers stats já existente, calculado ao vivo a partir de sales).
-- balance_cents: negativo = cliente deve à loja (fiado); positivo = crédito
-- a favor do cliente.
ALTER TABLE customers ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0;

-- Extrato imutável — mesma política de audit_logs (só INSERT/SELECT para a
-- app; correções são sempre um novo lançamento tipo 'ajuste', nunca edição).
CREATE TABLE customer_ledger_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL CHECK (type IN ('fiado_venda', 'pagamento', 'credito_adicionado', 'ajuste')),
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  due_date DATE,
  sale_id BIGINT REFERENCES sales(id),
  notes TEXT,
  user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_ledger_tenant_customer ON customer_ledger_entries(tenant_id, customer_id);

ALTER TABLE customer_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledger_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_ledger_entries
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
