-- Renomeia os papéis de loja pros novos nomes definitivos e adiciona
-- SUPER_ADMIN: dono da plataforma, não pertence a nenhuma loja específica.

-- Remove a constraint ANTES do UPDATE — senão o UPDATE tenta gravar os
-- valores novos (ADMIN_LOJA etc.) contra a constraint antiga, que só
-- aceitava os valores minúsculos, e falha.
ALTER TABLE users DROP CONSTRAINT users_role_check;

UPDATE users SET role = CASE role
  WHEN 'admin' THEN 'ADMIN_LOJA'
  WHEN 'gerente' THEN 'GERENTE'
  WHEN 'operador' THEN 'FUNCIONARIO'
  ELSE role
END;

-- tenant_id só é obrigatório pra papéis de loja — SUPER_ADMIN não tem.
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN', 'ADMIN_LOJA', 'GERENTE', 'FUNCIONARIO'));
ALTER TABLE users ADD CONSTRAINT users_tenant_required_unless_super
  CHECK (role = 'SUPER_ADMIN' OR tenant_id IS NOT NULL);

-- Identidade do SUPER_ADMIN: e-mail/senha (reaproveita pin_hash — é só um
-- hash scrypt genérico, "PIN" pode ser qualquer segredo, não só 4 dígitos).
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;

-- Força troca do PIN/senha no primeiro login — usado quando o SUPER_ADMIN
-- cria a loja e repassa uma credencial inicial pro cliente por fora do sistema.
ALTER TABLE users ADD COLUMN must_change_pin BOOLEAN NOT NULL DEFAULT FALSE;

-- Policy de tenant_isolation original quebraria para o SUPER_ADMIN (tenant_id
-- NULL nunca bate com current_setting) e também explode se app.tenant_id
-- nunca foi setado na transação (current_setting sem o 2º argumento é
-- estrito). Recriada para: (a) sempre liberar linhas de SUPER_ADMIN, e
-- (b) tolerar transação sem tenant setado (retorna NULL em vez de erro).
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (role = 'SUPER_ADMIN' OR tenant_id = current_setting('app.tenant_id', true)::bigint)
  WITH CHECK (role = 'SUPER_ADMIN' OR tenant_id = current_setting('app.tenant_id', true)::bigint);
