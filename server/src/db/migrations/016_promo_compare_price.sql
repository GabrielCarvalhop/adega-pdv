-- Preço "de" para promoções no cardápio (quando > sale_price_cents).
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER;
