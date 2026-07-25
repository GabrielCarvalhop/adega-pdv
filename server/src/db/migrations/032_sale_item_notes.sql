-- Fase 5: observação livre por item de venda (ex.: "sem gelo", "cliente pediu embalar separado").
ALTER TABLE sale_items ADD COLUMN notes TEXT;
