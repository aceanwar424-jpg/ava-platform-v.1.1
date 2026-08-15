// ═══════════════════════════════════════════════════════════════════════════
// Pemulihan basis data dari berkas cadangan.
//
// Sengaja berupa skrip, BUKAN endpoint HTTP: memulihkan berarti menimpa basis
// data yang sedang dipakai klinik. Tindakan sebesar itu tidak boleh bisa
// dipicu dari jaringan, dan harus dijalankan saat aplikasi tertutup.
//
//   node scripts/pulihkan-cadangan.js                  → tampilkan daftar cadangan
//   node scripts/pulihkan-cadangan.js <berkas.tar.gz>  → pulihkan
//
// Basis data yang sekarang TIDAK dihapus: ia dipindahkan ke folder
// pglite-data-sebelum-pulih-<stempel> agar bisa dikembalikan bila keliru.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const AKAR = path.resolve(__dirname, '..');
const DIR_DATA = path.join(AKAR, 'desktop-app', 'pglite-data');
const DIR_CADANGAN = path.join(AKAR, 'desktop-app', 'backup');

function daftarCadangan() {
  if (!fs.existsSync(DIR_CADANGAN)) return [];
  return fs.readdirSync(DIR_CADANGAN)
    .filter(f => f.endsWith('.tar.gz'))
    .map(f => {
      const p = path.join(DIR_CADANGAN, f);
      return { nama: f, path: p, ukuran: fs.statSync(p).size, waktu: fs.statSync(p).mtime };
    })
    .sort((a, b) => b.waktu - a.waktu);
}

function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

(async () => {
  const arg = process.argv[2];
  const daftar = daftarCadangan();

  if (!arg) {
    if (!daftar.length) {
      console.log('Belum ada cadangan di ' + DIR_CADANGAN);
      console.log('Buat lewat aplikasi (Backup Database) atau: ONELAB.bat backup');
      process.exit(0);
    }
    console.log('Cadangan tersedia:\n');
    daftar.forEach((c, i) =>
      console.log(`  ${String(i + 1).padStart(2)}. ${c.nama}  ${mb(c.ukuran).padStart(9)}  ${c.waktu.toLocaleString('id-ID')}`));
    console.log('\nPulihkan dengan:\n  node scripts/pulihkan-cadangan.js ' + daftar[0].nama);
    process.exit(0);
  }

  const sumber = path.isAbsolute(arg) ? arg : path.join(DIR_CADANGAN, arg);
  if (!fs.existsSync(sumber)) {
    console.error('Berkas cadangan tidak ditemukan: ' + sumber);
    process.exit(1);
  }

  // Basis data sedang dipakai bila postmaster.pid menunjuk proses yang MASIH
  // HIDUP. Keberadaan berkasnya saja tidak cukup: setelah aplikasi berhenti
  // paksa atau crash, berkas itu tertinggal — dan justru sesudah crash-lah
  // pemulihan paling dibutuhkan. Menolak berdasarkan berkas saja akan
  // mengunci pengguna keluar tepat ketika ia perlu masuk.
  const berkasPid = path.join(DIR_DATA, 'postmaster.pid');
  if (fs.existsSync(berkasPid)) {
    const pid = parseInt(String(fs.readFileSync(berkasPid, 'utf8')).split(/\r?\n/)[0], 10);
    let hidup = false;
    if (Number.isFinite(pid) && pid > 0) {
      try { process.kill(pid, 0); hidup = true; }        // tidak membunuh; hanya menguji
      catch (e) { hidup = (e.code === 'EPERM'); }        // EPERM = ada, tapi milik pengguna lain
    }
    if (hidup) {
      console.error(`OneLab masih berjalan (proses ${pid}). Tutup aplikasi lebih dulu, lalu ulangi.`);
      process.exit(1);
    }
    console.log('  catatan: postmaster.pid tertinggal dari penghentian tidak wajar — dilanjutkan.');
  }

  // Cadangan membawa nama basis data asalnya (mis. onelab-pglite-data-…).
  // Memulihkan cadangan basis data PENGEMBANGAN ke folder produksi akan
  // menimpa data klinik dengan data uji — dan itu tidak kentara karena
  // keduanya berisi katalog produk yang sama.
  const namaTarget = path.basename(DIR_DATA);
  const cocok = path.basename(sumber).includes(namaTarget);
  if (!cocok) {
    console.error(`\nCadangan ini tampaknya BUKAN milik "${namaTarget}".`);
    console.error(`  berkas : ${path.basename(sumber)}`);
    console.error(`  tujuan : ${DIR_DATA}`);
    console.error('\nMemulihkan cadangan dari basis data lain akan menimpa data yang ada.');
    console.error('Bila memang disengaja, jalankan ulang dengan argumen --paksa.');
    if (!process.argv.includes('--paksa')) process.exit(1);
    console.error('  --paksa diberikan; dilanjutkan atas permintaan eksplisit.\n');
  }

  console.log('Memverifikasi isi cadangan sebelum menimpa apa pun...');
  const { PGlite } = await import(
    'file://' + path.join(AKAR, 'desktop-app', 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js').replace(/\\/g, '/'));

  const buf = fs.readFileSync(sumber);
  const uji = await PGlite.create({ loadDataDir: new Blob([buf]) });   // di memori
  const t = await uji.query(`SELECT count(*)::int c FROM pg_tables WHERE schemaname='public'`);
  const m = await uji.query(`SELECT count(*)::int c FROM public.schema_migrations`).catch(() => ({ rows: [{ c: 0 }] }));
  await uji.close();

  if (t.rows[0].c < 5) {
    console.error(`Cadangan tampak tidak sah: hanya ${t.rows[0].c} tabel. Pemulihan dibatalkan.`);
    process.exit(1);
  }
  console.log(`  isi cadangan: ${t.rows[0].c} tabel, ${m.rows[0].c} migrasi — terlihat sah.`);

  // Simpan yang lama, jangan hapus.
  if (fs.existsSync(DIR_DATA)) {
    const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const arsip = DIR_DATA + '-sebelum-pulih-' + stempel;
    fs.renameSync(DIR_DATA, arsip);
    console.log('  basis data lama dipindah ke: ' + path.basename(arsip));
  }

  fs.mkdirSync(DIR_DATA, { recursive: true });
  const pg = await PGlite.create({ loadDataDir: new Blob([buf]), dataDir: DIR_DATA });
  const cek = await pg.query(`SELECT count(*)::int c FROM pg_tables WHERE schemaname='public'`);
  await pg.close();

  console.log(`\nSelesai. ${cek.rows[0].c} tabel dipulihkan ke ${DIR_DATA}`);
  console.log('Jalankan ONELAB.bat seperti biasa.');
})().catch(e => { console.error('GAGAL: ' + (e && e.message ? e.message : e)); process.exit(1); });
