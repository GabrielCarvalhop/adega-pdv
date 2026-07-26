-- O pooler da Supabase (Supavisor) pode resetar GUCs customizadas pra string
-- vazia entre sessões compartilhadas, em vez de deixá-las indefinidas —
-- current_setting(..., true) então retorna '' em vez de NULL, e ''::bigint
-- lança erro (22P02) ao invés de simplesmente não casar com nenhuma linha.
-- NULLIF trata nulo e vazio da mesma forma antes do cast.
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (
    (role = 'SUPER_ADMIN' AND NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint
  )
  WITH CHECK (
    (role = 'SUPER_ADMIN' AND NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::bigint
  );
