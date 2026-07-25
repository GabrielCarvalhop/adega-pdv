-- Fase 6: prazo padrão (em dias) para vencimento de vendas fiadas — usado
-- para preencher automaticamente customer_ledger_entries.due_date.
ALTER TABLE store_settings ADD COLUMN fiado_due_days INTEGER NOT NULL DEFAULT 30;
