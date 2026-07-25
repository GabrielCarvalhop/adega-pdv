-- Fase 3: permissões configuráveis por usuário, além do papel (role). Nulo =
-- usa o padrão do papel (definido em código, não no banco, pra poder ajustar
-- sem migration). can_sell_without_stock nasce FALSE — vender sem estoque é
-- uma exceção, não o padrão.
ALTER TABLE users
  ADD COLUMN max_discount_percent NUMERIC(5,2) CHECK (max_discount_percent >= 0 AND max_discount_percent <= 100),
  ADD COLUMN can_sell_without_stock BOOLEAN NOT NULL DEFAULT FALSE;
