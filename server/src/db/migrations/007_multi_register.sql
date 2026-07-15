ALTER TABLE cash_sessions ADD COLUMN register_label TEXT NOT NULL DEFAULT 'Caixa 1';

-- Um mesmo caixa (label) não pode ter duas sessões abertas ao mesmo tempo na
-- mesma loja; caixas diferentes podem. Também elimina a corrida de dupla
-- abertura que existia na checagem em aplicação.
CREATE UNIQUE INDEX idx_cash_sessions_open_register
  ON cash_sessions (tenant_id, register_label)
  WHERE status = 'aberto';
