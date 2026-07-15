-- Fotos e branding do cardápio online (gerenciados pelo admin da loja).
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_subtitle TEXT;

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS catalog_logo_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS catalog_banner_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS city_text TEXT;
