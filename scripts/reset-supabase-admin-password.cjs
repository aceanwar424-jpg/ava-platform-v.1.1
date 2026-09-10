// Reset a Supabase Auth password without storing credentials in the repository.
// Requires a server-only SUPABASE_SERVICE_ROLE_KEY and an explicit confirmation.

const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const SUPABASE_URL = (process.env.AVA_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@avahealth.sbs';

function fail(message) {
  console.error(`GAGAL: ${message}`);
  process.exitCode = 1;
}

async function main() {
  if (!/^https:\/\/[^/]+$/.test(SUPABASE_URL)) {
    throw new Error('Set SUPABASE_URL atau AVA_SUPABASE_URL ke URL Supabase production.');
  }
  if (!SERVICE_KEY) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY di environment. Jangan masukkan ke source code.');
  }
  if (!process.argv.includes('--confirm-production')) {
    throw new Error('Perubahan production ditahan. Jalankan ulang dengan --confirm-production setelah memastikan URL benar.');
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const email = (await rl.question(`Email akun [${ADMIN_EMAIL}]: `)).trim() || ADMIN_EMAIL;
    const password = await rl.question('Password baru (minimal 12 karakter): ');
    if (password.length < 12) throw new Error('Password minimal 12 karakter.');
    const confirm = await rl.question('Ulangi password baru: ');
    if (password !== confirm) throw new Error('Konfirmasi password tidak sama.');
    const approval = await rl.question(`Ketik RESET untuk mengubah password ${email} di ${SUPABASE_URL}: `);
    if (approval !== 'RESET') throw new Error('Konfirmasi tidak cocok; tidak ada perubahan dilakukan.');

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };
    const usersResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!usersResponse.ok) throw new Error(`Gagal membaca daftar user (${usersResponse.status}).`);
    const users = await usersResponse.json();
    const user = (users.users || []).find(item => item.email?.toLowerCase() === email.toLowerCase());
    if (!user?.id) throw new Error(`Akun ${email} tidak ditemukan di Supabase.`);

    const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!updateResponse.ok) {
      const detail = await updateResponse.text();
      throw new Error(`Gagal mengubah password (${updateResponse.status}): ${detail.slice(0, 300)}`);
    }
    console.log(`Password Supabase untuk ${email} berhasil diubah.`);
  } finally {
    rl.close();
  }
}

main().catch(error => fail(error.message));
