ALTER TABLE orders
  ADD COLUMN change_for_cents INTEGER,
  ADD COLUMN public_key UUID,
  ADD COLUMN expires_at TIMESTAMPTZ;

-- Idempotência do checkout público: reenvio com a mesma chave não duplica.
CREATE UNIQUE INDEX idx_orders_public_key ON orders (public_key) WHERE public_key IS NOT NULL;

ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pendente', 'aceito', 'pronto', 'saiu_entrega', 'concluido', 'recusado', 'cancelado', 'expirado'));

ALTER TABLE store_settings
  ADD COLUMN min_order_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN pending_ttl_minutes INTEGER NOT NULL DEFAULT 30;
