import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Sistema é 100% online — Storage é obrigatório em produção. Em dev sem as
// variáveis configuradas, uploads simplesmente falham com erro claro em vez
// de mascarar o problema com um fallback local.
export const supabaseStorage =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
    : null;

export const UPLOADS_BUCKET = 'uploads';

export function isStorageConfigured(): boolean {
  return supabaseStorage !== null;
}
