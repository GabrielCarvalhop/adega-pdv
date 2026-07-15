ALTER TABLE stock_movements
  ADD COLUMN prev_quantity INTEGER,
  ADD COLUMN next_quantity INTEGER,
  ADD COLUMN idempotency_key TEXT;

-- Reprocessamento (retry de rede, evento duplicado) não pode duplicar movimento.
CREATE UNIQUE INDEX idx_stock_movements_idempotency
  ON stock_movements (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN (
    'entrada_manual', 'saida_manual', 'ajuste', 'venda', 'cancelamento_venda',
    'pedido', 'cancelamento_pedido', 'devolucao', 'perda', 'avaria', 'consumo_interno'
  ));
