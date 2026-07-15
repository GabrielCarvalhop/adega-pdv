/**
 * Baixa fotos gratuitas (Unsplash) para o catálogo demo e grava em
 * server/data/uploads/{tenantId}/ + atualiza products.image_url.
 * Uso: npx tsx server/scripts/seed-catalog-images.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { pool, withSystemTransaction, withTenantTransaction } from '../src/db/connection';

const uploadsRoot = path.join(__dirname, '..', 'data', 'uploads');

function u(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;
}

/** Fotos Unsplash (uso livre) — bebidas. IDs verificáveis no CDN. */
const BEER = u('photo-1608270586620-248524c67de9');
const BEER2 = u('photo-1618885472179-5e474019f2a9');
const BEER3 = u('photo-1535958636474-b021ee887b13');
const BEER4 = BEER2; // reuse — URL específica 404
const WHISKY = u('photo-1527281400683-1aae777175f8');
const WHISKY2 = u('photo-1523480717984-24cba35ae1ef');
const COCKTAIL = u('photo-1514362545857-3bc16c4c7d1b');
const VODKA = u('photo-1551538827-9c037cb4f32a');
const GIN = u('photo-1551024709-8f23befc6f87');
const SHOT = u('photo-1470337458703-46ad1756a187');
const WINE_RED = u('photo-1510812431401-41d2bd2722f3');
const WINE_WHITE = u('photo-1566995541428-f2246c17cda1');
const WINE_GLASS = u('photo-1474722883778-792e7990302f');
const CHAMPAGNE = u('photo-1578911373434-0cb395d2cbfb');
const SODA = u('photo-1629203851122-3726ecdf080e');
const ENERGY = u('photo-1622483767028-3f66f32aef97');
const WATER = u('photo-1548839140-29a749e1cf4d');
const ICE = u('photo-1560008581-09826d1de69e');
const NUTS = u('photo-1599599810769-bcde5a160d32');
const SNACK = NUTS; // reuse — URL específica 404

const IMAGE_BY_SKU: Record<string, string> = {
  'CER-ITA-269-F12': BEER,
  'CER-SKO-269-F12': BEER2,
  'CER-BRA-350-U': BEER3,
  'CER-HEI-330-LN': BEER2,
  'CER-ORI-600-U': BEER3,
  'CER-COR-330': BEER4,
  'CER-BUD-350': BEER,
  'CER-SPA-350': BEER3,
  'DES-RS-SIG-700': WHISKY,
  'DES-JD-1L': WHISKY,
  'DES-RB-12-700': WHISKY2,
  'DES-CHI-12-1L': WHISKY2,
  'DES-BL-1L': WHISKY,
  'DES-ABS-1L': VODKA,
  'DES-SMI-998': VODKA,
  'DES-TAN-750': GIN,
  'DES-BEE-750': GIN,
  'DES-51-ICE': COCKTAIL,
  'DES-51-OURO': WHISKY2,
  'DES-YPI-OURO': WHISKY2,
  'DES-DOSE-WHK': SHOT,
  'DES-DOSE-VOD': COCKTAIL,
  'DES-DOSE-GIN': GIN,
  'VIN-CV-TIN-750': WINE_RED,
  'VIN-MIO-CHA-750': WINE_WHITE,
  'VIN-PER-ROS-750': WINE_GLASS,
  'VIN-SDB-750': WINE_RED,
  'ESP-CHA-BRUT': CHAMPAGNE,
  'ESP-AUR-MOS': CHAMPAGNE,
  'ESP-FRE-PRO': CHAMPAGNE,
  'LIC-43-700': COCKTAIL,
  'LIC-AMA-750': GIN,
  'LIC-DOSE': SHOT,
  'OUT-COCA-2L': SODA,
  'OUT-GUA-2L': SODA,
  'OUT-RB-250': ENERGY,
  'OUT-MON-473': ENERGY,
  'OUT-AGU-500': WATER,
  'OUT-GELO-5': ICE,
  'OUT-TORR': SNACK,
  'OUT-AME-150': NUTS,
  'OUT-CMB-WHK': WHISKY,
  'OUT-CMB-GIN': GIN,
};

const IMAGE_BY_CATEGORY: Record<string, string> = {
  cerveja: BEER,
  destilado: WHISKY,
  vinho: WINE_RED,
  espumante: CHAMPAGNE,
  licor: COCKTAIL,
  outro: SODA,
};

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AdegaPDV-Seed/1.0 (dev catalog images)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`arquivo pequeno (${buf.length}b)`);
  fs.writeFileSync(dest, buf);
}

async function main() {
  const tenant = await withSystemTransaction(async (c) => {
    const { rows } = await c.query(`SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1`);
    return rows[0] as { id: number } | undefined;
  });
  if (!tenant) {
    console.error('Tenant demo não encontrado. Rode npm run seed -w server antes.');
    process.exit(1);
  }

  const dir = path.join(uploadsRoot, String(tenant.id));
  fs.mkdirSync(dir, { recursive: true });

  const products = await withTenantTransaction(tenant.id, async (c) => {
    const { rows } = await c.query(
      `SELECT id, sku, name, category FROM products WHERE visible_in_catalog = TRUE ORDER BY id`
    );
    return rows as { id: number; sku: string | null; name: string; category: string }[];
  });

  let ok = 0;
  let fail = 0;

  for (const p of products) {
    const url =
      (p.sku && IMAGE_BY_SKU[p.sku]) ||
      IMAGE_BY_CATEGORY[p.category] ||
      IMAGE_BY_CATEGORY.outro;

    const filename = `product-${p.id}.jpg`;
    const abs = path.join(dir, filename);
    const publicUrl = `/uploads/${tenant.id}/${filename}`;

    try {
      process.stdout.write(`[${ok + fail + 1}/${products.length}] ${p.name.slice(0, 42)}... `);
      await download(url, abs);
      await withTenantTransaction(tenant.id, async (c) => {
        await c.query(`UPDATE products SET image_url = $1, updated_at = now() WHERE id = $2`, [
          publicUrl,
          p.id,
        ]);
      });
      console.log('ok');
      ok += 1;
    } catch (err) {
      console.log('falhou:', (err as Error).message);
      fail += 1;
    }
  }

  console.log(`\nConcluído: ${ok} foto(s), ${fail} falha(s).`);
  console.log('Abra http://localhost:5175/c/demo');
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
