// Reset password admin lokal tanpa menaruh password di source atau log.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, '.pglite-dev');
const ADMIN_EMAIL = 'admin@avahealth.sbs';

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || !output.isTTY) return reject(new Error('Jalankan dari terminal interaktif.'));
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    let value = '';
    const onData = chunk => {
      for (const key of chunk.toString()) {
        if (key === '\u0003') {
          input.setRawMode(false);
          input.removeListener('data', onData);
          output.write('\n');
          reject(new Error('Dibatalkan.'));
          return;
        }
        if (key === '\r' || key === '\n') {
          input.setRawMode(false);
          input.removeListener('data', onData);
          output.write('\n');
          resolve(value);
          return;
        }
        if (key === '\u007f' || key === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += key;
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  const password = await readSecret('Password baru admin lokal: ');
  if (password.length < 12) throw new Error('Password minimal 12 karakter.');
  const confirm = await readSecret('Ulangi password baru: ');
  if (password !== confirm) throw new Error('Konfirmasi password tidak sama.');

  const { PGlite } = await import('@electric-sql/pglite');
  const pg = await PGlite.create({ dataDir: DATA_DIR });
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const result = await pg.query(
      `UPDATE public.local_auth_users
       SET password_hash=$1, password_salt=$2, failed_attempts=0, locked_until=NULL
       WHERE lower(email)=lower($3)
       RETURNING id`,
      [hash, salt, ADMIN_EMAIL]
    );
    if (!result.rows[0]) throw new Error(`Akun ${ADMIN_EMAIL} tidak ditemukan.`);
    console.log(`Password lokal untuk ${ADMIN_EMAIL} berhasil diubah.`);
  } finally {
    await pg.close();
  }
}

main().catch(error => {
  console.error(`Reset gagal: ${error.message}`);
  process.exitCode = 1;
});
