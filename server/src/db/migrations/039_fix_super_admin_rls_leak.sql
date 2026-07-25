-- BUG: a policy de 038 liberava a linha do SUPER_ADMIN em QUALQUER contexto
-- (`role = 'SUPER_ADMIN' OR ...`), inclusive dentro de withTenantTransaction
-- de uma loja — vazando "Administrador do sistema" na lista pública de
-- login de toda loja (GET /api/t/:slug/auth/users). Corrige: a linha do
-- SUPER_ADMIN só é visível quando NENHUM tenant está setado na transação
-- (contexto de sistema); dentro de uma loja, só as linhas daquela loja.
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (
    (role = 'SUPER_ADMIN' AND current_setting('app.tenant_id', true) IS NULL)
    OR tenant_id = current_setting('app.tenant_id', true)::bigint
  )
  WITH CHECK (
    (role = 'SUPER_ADMIN' AND current_setting('app.tenant_id', true) IS NULL)
    OR tenant_id = current_setting('app.tenant_id', true)::bigint
  );
