-- "Fiado" vira um kind de meio de pagamento: vender fiado é escolher esse
-- método no fechamento da venda, o que gera automaticamente um lançamento de
-- débito no saldo do cliente (ver customer_ledger_entries).
ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_kind_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_kind_check
  CHECK (kind IN ('dinheiro', 'pix', 'cartao', 'outro', 'fiado'));

-- Seed do método fiado para tenants existentes — inativo por padrão (loja
-- decide se quer oferecer fiado).
INSERT INTO payment_methods (tenant_id, code, label, kind, active, sort_order)
SELECT t.id, 'fiado', 'Fiado (conta do cliente)', 'fiado', FALSE, 6
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM payment_methods pm WHERE pm.tenant_id = t.id AND pm.code = 'fiado'
);
