// Cria (ou atualiza a senha de) o usuário SUPER_ADMIN — dono da plataforma,
// sem loja. Rodar uma vez por ambiente (dev local, Supabase de produção).
// Uso: npm run seed:super-admin -w server -- <email> <senha>
import { pool } from '../src/db/connection';
import { hashPin } from '../src/modules/users/pin';

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: npm run seed:super-admin -w server -- <email> <senha>');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pinHash = hashPin(password);
    const { rows } = await client.query(
      `INSERT INTO users (tenant_id, name, email, pin_hash, role, active)
       VALUES (NULL, 'Administrador do sistema', $1, $2, 'SUPER_ADMIN', TRUE)
       ON CONFLICT (email) DO UPDATE SET pin_hash = EXCLUDED.pin_hash
       RETURNING id, email`,
      [email, pinHash]
    );
    await client.query('COMMIT');
    console.log(`SUPER_ADMIN pronto: id=${rows[0].id} email=${rows[0].email}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
