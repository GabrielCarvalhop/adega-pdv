-- Atributos configuráveis por meio de pagamento (Fase 2 do roadmap): troco,
-- crédito em conta, taxa de retenção, prazo para recebimento e ícone.
-- allows_change nasce TRUE só onde kind='dinheiro' para preservar o
-- comportamento atual (hoje hardcoded por kind) sem quebrar tenants existentes.
ALTER TABLE payment_methods
  ADD COLUMN icon TEXT,
  ADD COLUMN allows_change BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN credits_account BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN retention_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (retention_percent >= 0 AND retention_percent <= 100),
  ADD COLUMN settlement_days INTEGER NOT NULL DEFAULT 0 CHECK (settlement_days >= 0);

UPDATE payment_methods SET allows_change = TRUE WHERE kind = 'dinheiro';

ALTER TABLE payment_methods DROP CONSTRAINT payment_methods_kind_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_kind_check
  CHECK (kind IN ('dinheiro', 'pix', 'cartao', 'outro', 'fiado', 'link_pagamento'));

-- Valor líquido do pagamento após a taxa de retenção do meio, snapshotado no
-- momento da venda (não recalcula se a taxa do meio mudar depois — mesmo
-- princípio de product_name_snapshot). Histórico existente: retenção 0.
ALTER TABLE payments ADD COLUMN net_amount_cents INTEGER NOT NULL DEFAULT 0;
UPDATE payments SET net_amount_cents = amount_cents;
