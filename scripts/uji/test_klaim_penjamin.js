// ═══════════════════════════════════════════════════════════════
// UJI: Klaim penjamin — BPJS, asuransi, TPA (migrasi 0040)
//
//   K1  migrasi terpasang
//   K2  klaim tanpa penjamin ditolak
//   K3  daftar berkas disalin dari persyaratan penjamin
//   K4  pengajuan DITAHAN bila berkas wajib belum lengkap
//   K5  berkas opsional yang kosong TIDAK menahan pengajuan
//   K6  pengajuan lolos setelah berkas wajib lengkap
//   K7  status Dikembalikan/Ditolak wajib beralasan
//   K8  status Dibayar wajib menyebut jumlah
//   K9  klaim yang dikembalikan bisa diajukan ulang
//   K10 tiap perubahan status meninggalkan jejak di klaim_log
//   K11 papan menghitung selisih tagih vs bayar dan umur klaim
//
// Jalankan: node scripts/uji/test_klaim_penjamin.js
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');

const AKAR = path.resolve(__dirname, '..', '..');
const PGLITE = path.join(AKAR, 'desktop-app', 'node_modules', '@electric-sql', 'pglite');

let lulus = 0, gagal = 0;
function cek(nama, syarat, catatan) {
  if (syarat) { lulus++; console.log(`  ✅ ${nama}`); }
  else { gagal++; console.log(`  ❌ ${nama}${catatan ? ' — ' + catatan : ''}`); }
}

(async () => {
  console.log('\n═══ UJI KLAIM PENJAMIN (0040) ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu = async (s, a) => (await pg.query(s, a)).rows[0];
  const semua = async (s, a) => (await pg.query(s, a)).rows;
  const rpc  = async (s, a) => (await satu(`SELECT public.${s} AS d`, a)).d;

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }

  try {
    await pg.exec(fs.readFileSync(
      path.join(AKAR, 'db', 'migrations', '0040_klaim_penjamin.sql'), 'utf8'));
    cek('K1  migrasi 0040 terpasang', true);
  } catch (e) { cek('K1  migrasi 0040 terpasang', false, e.message); process.exit(1); }

  const PJ = (await satu(`INSERT INTO public.penjamin (kode,nama,jenis,tempo_hari)
      VALUES ('BPJS','BPJS Kesehatan','BPJS',30) RETURNING id`)).id;
  await pg.exec(`INSERT INTO public.penjamin_berkas_wajib
      (penjamin_id,jenis_berkas,wajib) VALUES
      (${PJ},'Resume Medis',true),
      (${PJ},'Billing',true),
      (${PJ},'Foto Kartu',false)`);

  const tanpaPenjamin = await rpc('klaim_buat($1)', [JSON.stringify({
    patient_name: 'Pasien Uji' })]);
  cek('K2  klaim tanpa penjamin ditolak', !!tanpaPenjamin.error, tanpaPenjamin.error);

  const kl = await rpc('klaim_buat($1)', [JSON.stringify({
    penjamin_id: String(PJ), patient_name: 'Pasien Uji',
    no_kartu: '000123', jenis_rawat: 'Rawat Inap',
    diagnosa_utama: 'A09', tarif_rs: 5000000, oleh: 'Petugas',
  })]);
  const berkas = await semua(
    `SELECT * FROM public.klaim_berkas WHERE klaim_id=$1 ORDER BY jenis_berkas`, [kl.id]);
  cek('K3  daftar berkas disalin dari persyaratan penjamin',
      kl.ok === true && berkas.length === 3 && kl.berkas_disiapkan === 3,
      `${berkas.length} berkas`);

  const ajuKurang = await rpc('klaim_ajukan($1)', [kl.id]);
  cek('K4  pengajuan ditahan saat berkas wajib belum lengkap',
      !!ajuKurang.error && Array.isArray(ajuKurang.kurang)
      && ajuKurang.kurang.length === 2,
      JSON.stringify(ajuKurang.kurang));

  // Lengkapi HANYA yang wajib; 'Foto Kartu' (opsional) sengaja dibiarkan.
  await pg.exec(`UPDATE public.klaim_berkas SET ada=true
                  WHERE klaim_id=${kl.id} AND jenis_berkas IN ('Resume Medis','Billing')`);
  const aju = await rpc('klaim_ajukan($1,$2)', [kl.id, 'Petugas']);
  const opsionalKosong = (await satu(
    `SELECT ada FROM public.klaim_berkas
      WHERE klaim_id=$1 AND jenis_berkas='Foto Kartu'`, [kl.id])).ada;
  cek('K5  berkas opsional yang kosong tidak menahan pengajuan',
      aju.ok === true && opsionalKosong === false, JSON.stringify(aju));
  cek('K6  pengajuan lolos setelah berkas wajib lengkap',
      aju.ok === true && (await satu(
        `SELECT status FROM public.klaim WHERE id=$1`, [kl.id])).status === 'Diajukan');

  const tanpaAlasan = await rpc('klaim_ubah_status($1,$2)', [kl.id, 'Dikembalikan']);
  cek('K7  Dikembalikan/Ditolak wajib beralasan', !!tanpaAlasan.error, tanpaAlasan.error);

  const bayarTanpaJumlah = await rpc('klaim_ubah_status($1,$2)', [kl.id, 'Dibayar']);
  cek('K8  Dibayar wajib menyebut jumlah', !!bayarTanpaJumlah.error, bayarTanpaJumlah.error);

  await rpc('klaim_ubah_status($1,$2,$3,$4,$5)',
    [kl.id, 'Dikembalikan', 'Resume medis tidak terbaca', null, 'Verifikator']);
  const ajuUlang = await rpc('klaim_ajukan($1,$2)', [kl.id, 'Petugas']);
  cek('K9  klaim yang dikembalikan bisa diajukan ulang',
      ajuUlang.ok === true, JSON.stringify(ajuUlang));

  await rpc('klaim_ubah_status($1,$2,$3,$4,$5)',
    [kl.id, 'Dibayar', null, 4200000, 'Keuangan']);

  const log = await semua(
    `SELECT dari,ke,alasan FROM public.klaim_log WHERE klaim_id=$1 ORDER BY id`, [kl.id]);
  const urutan = log.map(x => x.ke);
  cek('K10 tiap perubahan status meninggalkan jejak',
      urutan.join(' → ') === 'Draf → Diajukan → Dikembalikan → Diajukan → Dibayar'
      && log.some(x => x.alasan === 'Resume medis tidak terbaca'),
      urutan.join(' → '));

  const papan = await satu(
    `SELECT selisih, umur_hari, berkas_ada, berkas_total, penjamin_nama
       FROM public.klaim_papan WHERE id=$1`, [kl.id]);
  cek('K11 papan menghitung selisih tagih vs bayar',
      Number(papan.selisih) === 800000 && Number(papan.berkas_ada) === 2
      && Number(papan.berkas_total) === 3 && papan.penjamin_nama === 'BPJS Kesehatan',
      JSON.stringify(papan));

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
