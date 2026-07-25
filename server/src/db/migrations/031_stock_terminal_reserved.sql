-- Fase 4: rastreia em qual caixa/terminal aberto uma movimentação manual de
-- estoque foi feita (nulo para vendas/pedidos, que já têm sale_id/order_id
-- ligando indiretamente à sessão via sales.cash_session_id).
ALTER TABLE stock_movements ADD COLUMN cash_session_id BIGINT REFERENCES cash_sessions(id);
