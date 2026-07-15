// Dados de desenvolvimento: lojas demo/vinharia + catálogo rico no demo para
// testar o cardápio online. Uso: npm run seed -w server
// Seguro rodar de novo: tenants existentes são reutilizados; produtos do
// catálogo demo são inseridos só se ainda não existirem (por sku).
import type { ProductCategory } from '@adega/shared';
import { pool, withSystemTransaction, withTenantTransaction } from '../src/db/connection';
import { hashPin } from '../src/modules/users/pin';

interface CatalogSeedProduct {
  name: string;
  category: ProductCategory;
  brand?: string;
  volumeMl?: number;
  sku: string;
  costCents: number;
  saleCents: number;
  stock: number;
  subtitle?: string;
}

/** Produtos fictícios no estilo do cardápio A7 — só para teste visual. */
const DEMO_CATALOG: CatalogSeedProduct[] = [
  // Cervejas
  { name: 'ITAIPAVA 269ML - FARDO C/12 UN', category: 'cerveja', brand: 'Itaipava', volumeMl: 269, sku: 'CER-ITA-269-F12', costCents: 2200, saleCents: 2890, stock: 40, subtitle: 'FARDO GELADO!!' },
  { name: 'SKOL 269ML - FARDO C/12 UN', category: 'cerveja', brand: 'Skol', volumeMl: 269, sku: 'CER-SKO-269-F12', costCents: 2300, saleCents: 2990, stock: 35, subtitle: 'FARDO GELADO!!' },
  { name: 'BRAHMA 350ML - UNIDADE', category: 'cerveja', brand: 'Brahma', volumeMl: 350, sku: 'CER-BRA-350-U', costCents: 280, saleCents: 450, stock: 120, subtitle: 'LATÃO GELADO' },
  { name: 'HEINEKEN LONG NECK 330ML', category: 'cerveja', brand: 'Heineken', volumeMl: 330, sku: 'CER-HEI-330-LN', costCents: 550, saleCents: 899, stock: 80, subtitle: 'LONG NECK' },
  { name: 'ORIGINAL 600ML - UNIDADE', category: 'cerveja', brand: 'Original', volumeMl: 600, sku: 'CER-ORI-600-U', costCents: 700, saleCents: 1090, stock: 50, subtitle: 'GARRAFA' },
  { name: 'CORONA EXTRA 330ML', category: 'cerveja', brand: 'Corona', volumeMl: 330, sku: 'CER-COR-330', costCents: 650, saleCents: 999, stock: 60, subtitle: 'LONG NECK' },
  { name: 'BUDWEISER 350ML - UNIDADE', category: 'cerveja', brand: 'Budweiser', volumeMl: 350, sku: 'CER-BUD-350', costCents: 320, saleCents: 549, stock: 90, subtitle: 'LATA' },
  { name: 'SPATEN 350ML - UNIDADE', category: 'cerveja', brand: 'Spaten', volumeMl: 350, sku: 'CER-SPA-350', costCents: 380, saleCents: 649, stock: 70, subtitle: 'LATA' },

  // Destilados — whisky / vodka / gin / cachaça
  { name: 'ROYAL SALUTE SIGNATURE - 700ML', category: 'destilado', brand: 'Royal Salute', volumeMl: 700, sku: 'DES-RS-SIG-700', costCents: 38000, saleCents: 49999, stock: 5, subtitle: 'WHISKY 21 ANOS' },
  { name: 'JACK DANIELS N°7 - 1L', category: 'destilado', brand: "Jack Daniel's", volumeMl: 1000, sku: 'DES-JD-1L', costCents: 11000, saleCents: 15990, stock: 12, subtitle: 'WHISKY' },
  { name: 'REDBREAST 12 ANOS - 700ML', category: 'destilado', brand: 'Redbreast', volumeMl: 700, sku: 'DES-RB-12-700', costCents: 22000, saleCents: 29990, stock: 6, subtitle: 'WHISKY IRLANDÊS' },
  { name: 'CHIVAS REGAL 12 - 1L', category: 'destilado', brand: 'Chivas', volumeMl: 1000, sku: 'DES-CHI-12-1L', costCents: 12000, saleCents: 16990, stock: 10, subtitle: 'WHISKY' },
  { name: 'BLACK LABEL - 1L', category: 'destilado', brand: 'Johnnie Walker', volumeMl: 1000, sku: 'DES-BL-1L', costCents: 10000, saleCents: 13990, stock: 14, subtitle: 'WHISKY' },
  { name: 'ABSOLUT VODKA - 1L', category: 'destilado', brand: 'Absolut', volumeMl: 1000, sku: 'DES-ABS-1L', costCents: 5500, saleCents: 7990, stock: 20, subtitle: 'VODKA' },
  { name: 'SMIRNOFF RED - 998ML', category: 'destilado', brand: 'Smirnoff', volumeMl: 998, sku: 'DES-SMI-998', costCents: 3800, saleCents: 5490, stock: 25, subtitle: 'VODKA' },
  { name: 'TANQUERAY LONDON DRY - 750ML', category: 'destilado', brand: 'Tanqueray', volumeMl: 750, sku: 'DES-TAN-750', costCents: 9000, saleCents: 12990, stock: 15, subtitle: 'GIN' },
  { name: 'BEEFEATER - 750ML', category: 'destilado', brand: 'Beefeater', volumeMl: 750, sku: 'DES-BEE-750', costCents: 7000, saleCents: 9990, stock: 18, subtitle: 'GIN' },
  { name: '51 ICE - 275ML', category: 'destilado', brand: '51', volumeMl: 275, sku: 'DES-51-ICE', costCents: 350, saleCents: 599, stock: 100, subtitle: 'DRINK PRONTO' },
  { name: 'CACHAÇA 51 OURO - 965ML', category: 'destilado', brand: '51', volumeMl: 965, sku: 'DES-51-OURO', costCents: 1800, saleCents: 2890, stock: 30, subtitle: 'CACHAÇA' },
  { name: 'YPIÓCA OURO - 965ML', category: 'destilado', brand: 'Ypióca', volumeMl: 965, sku: 'DES-YPI-OURO', costCents: 2200, saleCents: 3490, stock: 22, subtitle: 'CACHAÇA' },
  { name: 'DOSE WHISKY (COPO)', category: 'destilado', brand: 'Dose', volumeMl: 50, sku: 'DES-DOSE-WHK', costCents: 800, saleCents: 1500, stock: 200, subtitle: 'DOSE' },
  { name: 'DOSE VODKA (COPO)', category: 'destilado', brand: 'Dose', volumeMl: 50, sku: 'DES-DOSE-VOD', costCents: 400, saleCents: 800, stock: 200, subtitle: 'DOSE' },
  { name: 'DOSE GIN (COPO)', category: 'destilado', brand: 'Dose', volumeMl: 50, sku: 'DES-DOSE-GIN', costCents: 700, saleCents: 1200, stock: 200, subtitle: 'DOSE' },

  // Vinhos
  { name: 'VINHO TINTO SECO CASA VALDUGA - 750ML', category: 'vinho', brand: 'Casa Valduga', volumeMl: 750, sku: 'VIN-CV-TIN-750', costCents: 4500, saleCents: 6990, stock: 20, subtitle: 'TINTO SECO' },
  { name: 'VINHO BRANCO CHARDONNAY - 750ML', category: 'vinho', brand: 'Miolo', volumeMl: 750, sku: 'VIN-MIO-CHA-750', costCents: 3800, saleCents: 5990, stock: 18, subtitle: 'BRANCO' },
  { name: 'VINHO ROSE SUAVE - 750ML', category: 'vinho', brand: 'Pérgola', volumeMl: 750, sku: 'VIN-PER-ROS-750', costCents: 1800, saleCents: 2990, stock: 25, subtitle: 'SUAVE' },
  { name: 'SANGUE DE BOI TINTO - 750ML', category: 'vinho', brand: 'Sangue de Boi', volumeMl: 750, sku: 'VIN-SDB-750', costCents: 1200, saleCents: 1990, stock: 40, subtitle: 'TINTO' },

  // Espumantes
  { name: 'ESPUMANTE BRUT CHANDON - 750ML', category: 'espumante', brand: 'Chandon', volumeMl: 750, sku: 'ESP-CHA-BRUT', costCents: 7000, saleCents: 9990, stock: 12, subtitle: 'BRUT' },
  { name: 'ESPUMANTE MOSCATEL - 750ML', category: 'espumante', brand: 'Aurora', volumeMl: 750, sku: 'ESP-AUR-MOS', costCents: 2500, saleCents: 3990, stock: 20, subtitle: 'MOSCATEL' },
  { name: 'PROSECCO FREIXENET - 750ML', category: 'espumante', brand: 'Freixenet', volumeMl: 750, sku: 'ESP-FRE-PRO', costCents: 5500, saleCents: 7990, stock: 10, subtitle: 'PROSECCO' },

  // Licores
  { name: 'LICOR 43 - 700ML', category: 'licor', brand: 'Licor 43', volumeMl: 700, sku: 'LIC-43-700', costCents: 9000, saleCents: 12990, stock: 8, subtitle: 'LICOR' },
  { name: 'AMARULA - 750ML', category: 'licor', brand: 'Amarula', volumeMl: 750, sku: 'LIC-AMA-750', costCents: 7000, saleCents: 9990, stock: 10, subtitle: 'CREME' },
  { name: 'DOSE LICOR (COPO)', category: 'licor', brand: 'Dose', volumeMl: 50, sku: 'LIC-DOSE', costCents: 500, saleCents: 1000, stock: 150, subtitle: 'DOSE' },

  // Outros (mixers, gelo, snacks — mapeados em "outro")
  { name: 'REFRIGERANTE COCA-COLA 2L', category: 'outro', brand: 'Coca-Cola', volumeMl: 2000, sku: 'OUT-COCA-2L', costCents: 700, saleCents: 1190, stock: 50, subtitle: 'REFRIGERANTE' },
  { name: 'REFRIGERANTE GUARANÁ 2L', category: 'outro', brand: 'Guaraná Antarctica', volumeMl: 2000, sku: 'OUT-GUA-2L', costCents: 650, saleCents: 1090, stock: 45, subtitle: 'REFRIGERANTE' },
  { name: 'ENERGÉTICO RED BULL 250ML', category: 'outro', brand: 'Red Bull', volumeMl: 250, sku: 'OUT-RB-250', costCents: 700, saleCents: 1190, stock: 60, subtitle: 'ENERGÉTICO' },
  { name: 'ENERGÉTICO MONSTER 473ML', category: 'outro', brand: 'Monster', volumeMl: 473, sku: 'OUT-MON-473', costCents: 800, saleCents: 1290, stock: 40, subtitle: 'ENERGÉTICO' },
  { name: 'ÁGUA MINERAL 500ML', category: 'outro', brand: 'Crystal', volumeMl: 500, sku: 'OUT-AGU-500', costCents: 100, saleCents: 250, stock: 100, subtitle: 'ÁGUA' },
  { name: 'GELO 5KG', category: 'outro', brand: 'Gelo', sku: 'OUT-GELO-5', costCents: 500, saleCents: 1000, stock: 30, subtitle: 'GELO' },
  { name: 'TORRESMO PACOTE', category: 'outro', brand: 'Casa', sku: 'OUT-TORR', costCents: 400, saleCents: 899, stock: 25, subtitle: 'SALGADO' },
  { name: 'AMENDOIM JAPONES 150G', category: 'outro', brand: 'Yoki', sku: 'OUT-AME-150', costCents: 350, saleCents: 699, stock: 35, subtitle: 'SALGADO' },
  { name: 'COMBO WHISKY + ENERGÉTICO', category: 'outro', brand: 'Combo', sku: 'OUT-CMB-WHK', costCents: 12000, saleCents: 16990, stock: 8, subtitle: 'COMBO' },
  { name: 'COMBO GIN + TÔNICA', category: 'outro', brand: 'Combo', sku: 'OUT-CMB-GIN', costCents: 10000, saleCents: 14990, stock: 8, subtitle: 'COMBO' },
];

async function ensureTenant(slug: string, storeName: string): Promise<number> {
  const existing = await withSystemTransaction(async (c) => {
    const { rows } = await c.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    return rows[0] as { id: number } | undefined;
  });
  if (existing) {
    console.log(`Tenant "${slug}" já existe (id ${existing.id}).`);
    return existing.id;
  }

  const tenantId = await withSystemTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO tenants (slug, store_name, status, trial_ends_at)
       VALUES ($1, $2, 'trialing', now() + interval '14 days') RETURNING id`,
      [slug, storeName]
    );
    return rows[0].id as number;
  });

  await withTenantTransaction(tenantId, async (c) => {
    await c.query('INSERT INTO users (name, pin_hash, role) VALUES ($1, $2, $3)', [
      'Administrador',
      hashPin('1234'),
      'admin',
    ]);
    await c.query('INSERT INTO users (name, pin_hash, role) VALUES ($1, $2, $3)', [
      'Maria Operadora',
      hashPin('5678'),
      'operador',
    ]);
  });

  console.log(`Tenant "${slug}" criado (id ${tenantId}): admin PIN 1234, operadora PIN 5678.`);
  return tenantId;
}

async function seedCatalogProducts(tenantId: number, products: CatalogSeedProduct[]) {
  let inserted = 0;
  await withTenantTransaction(tenantId, async (c) => {
    for (const p of products) {
      const { rowCount } = await c.query(
        `INSERT INTO products
          (name, category, brand, volume_ml, sku, cost_price_cents, sale_price_cents,
           stock_quantity, min_stock, visible_in_catalog, catalog_subtitle)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2, TRUE, $9)
         ON CONFLICT (tenant_id, sku) DO NOTHING`,
        [
          p.name,
          p.category,
          p.brand ?? null,
          p.volumeMl ?? null,
          p.sku,
          p.costCents,
          p.saleCents,
          p.stock,
          p.subtitle ?? null,
        ]
      );
      if (rowCount && rowCount > 0) inserted += 1;
    }

    // Ativa cardápio online + dados de vitrine para o teste visual.
    await c.query(
      `INSERT INTO store_settings
        (catalog_enabled, delivery_enabled, pickup_enabled, delivery_fee_cents,
         min_order_cents, pending_ttl_minutes, whatsapp, address_text,
         opening_hours_text, city_text)
       VALUES (TRUE, TRUE, TRUE, 1000, 2500, 30, '11999998888',
               'Rua das Adegas, 100', 'Aberto até amanhã às 23:59',
               'Vargem Grande Paulista - SP')
       ON CONFLICT (tenant_id) DO UPDATE SET
         catalog_enabled = TRUE,
         delivery_enabled = TRUE,
         pickup_enabled = TRUE,
         delivery_fee_cents = COALESCE(store_settings.delivery_fee_cents, 1000),
         min_order_cents = COALESCE(NULLIF(store_settings.min_order_cents, 0), 2500),
         whatsapp = COALESCE(store_settings.whatsapp, '11999998888'),
         address_text = COALESCE(store_settings.address_text, 'Rua das Adegas, 100'),
         opening_hours_text = COALESCE(store_settings.opening_hours_text, 'Aberto até amanhã às 23:59'),
         city_text = COALESCE(store_settings.city_text, 'Vargem Grande Paulista - SP'),
         updated_at = now()`
    );

    // Promoções de demonstração (preço "de" riscado).
    const promos: { sku: string; compareAt: number }[] = [
      { sku: 'CER-ITA-269-F12', compareAt: 3300 },
      { sku: 'CER-SKO-269-F12', compareAt: 3490 },
      { sku: 'DES-RS-SIG-700', compareAt: 69900 },
      { sku: 'DES-JD-1L', compareAt: 18990 },
      { sku: 'DES-CHI-12-1L', compareAt: 19990 },
      { sku: 'DES-ABS-1L', compareAt: 9490 },
      { sku: 'DES-TAN-750', compareAt: 14990 },
      { sku: 'VIN-CV-TIN-750', compareAt: 8990 },
      { sku: 'ESP-CHA-BRUT', compareAt: 12990 },
      { sku: 'OUT-CMB-WHK', compareAt: 19990 },
      { sku: 'OUT-RB-250', compareAt: 1490 },
      { sku: 'LIC-AMA-750', compareAt: 11990 },
    ];
    for (const promo of promos) {
      await c.query(
        `UPDATE products SET compare_at_price_cents = $1, updated_at = now()
         WHERE sku = $2 AND (compare_at_price_cents IS NULL OR compare_at_price_cents <> $1)`,
        [promo.compareAt, promo.sku]
      );
    }
  });
  console.log(`Catálogo demo: ${inserted} produto(s) novo(s); cardápio online ativo.`);
}

async function main() {
  const demoId = await ensureTenant('demo', 'Adega Demo');
  await seedCatalogProducts(demoId, DEMO_CATALOG);

  const vinhariaId = await ensureTenant('vinharia', 'Vinharia do Zé');
  await withTenantTransaction(vinhariaId, async (c) => {
    await c.query(
      `INSERT INTO products (name, category, cost_price_cents, sale_price_cents, stock_quantity, min_stock, sku, visible_in_catalog)
       VALUES ('Espumante do Zé', 'espumante', 2000, 4000, 10, 2, 'VINHARIA-ESP-1', TRUE)
       ON CONFLICT (tenant_id, sku) DO NOTHING`
    );
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
