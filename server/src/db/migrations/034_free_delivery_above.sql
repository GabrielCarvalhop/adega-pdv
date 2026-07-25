-- Fase 11: entrega grátis acima de um valor de subtotal (0 = desativado).
ALTER TABLE store_settings ADD COLUMN free_delivery_above_cents INTEGER NOT NULL DEFAULT 0;
