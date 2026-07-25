-- Substitui o enum fixo de meio de pagamento por referência à tabela
-- payment_methods (configurável por loja). 'pix' antigo vira 'pix_direto'.
ALTER TABLE payments ADD COLUMN payment_method_id BIGINT REFERENCES payment_methods(id);
UPDATE payments p
SET payment_method_id = pm.id
FROM payment_methods pm
WHERE pm.tenant_id = p.tenant_id
  AND pm.code = (CASE WHEN p.method = 'pix' THEN 'pix_direto' ELSE p.method END);
ALTER TABLE payments ALTER COLUMN payment_method_id SET NOT NULL;
ALTER TABLE payments DROP COLUMN method;

ALTER TABLE orders ADD COLUMN payment_method_intent_id BIGINT REFERENCES payment_methods(id);
UPDATE orders o
SET payment_method_intent_id = pm.id
FROM payment_methods pm
WHERE pm.tenant_id = o.tenant_id
  AND pm.code = (CASE WHEN o.payment_method_intent = 'pix' THEN 'pix_direto' ELSE o.payment_method_intent END);
ALTER TABLE orders ALTER COLUMN payment_method_intent_id SET NOT NULL;
ALTER TABLE orders DROP COLUMN payment_method_intent;
