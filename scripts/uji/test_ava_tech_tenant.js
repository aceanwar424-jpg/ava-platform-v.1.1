// ═══════════════════════════════════════════════════════════════
// UJI: AVA Tech — pendaftaran tenant & pencatatan pemakaian (migrasi 0029)
//
// Menggantikan bagian "PILAR 1" di test_fase4_e2e.js, yang dulu menguji
// array JavaScript di dalam memori dan selalu lulus tanpa membuktikan apa pun.
//
//   T1 migrasi 0029 terpasang di atas skema tenants yang sudah ada
//   T2 pemakaian tercatat dan BERTAHAN (bukan angka di memori)
//   T3 pencatatan berulang menjumlah, bukan menimpa
//   T4 kuota 0 berarti tanpa batas — tidak pernah dilaporkan terlampaui
//   T5 kuota terbatas dilaporkan terlampaui saat memang lewat
//   T6 metrik tak dikenal ditolak
//   T7 view tenant_ringkasan menghitung status langganan dengan benar
//   T8 instalasi sendiri ('lokal') tidak ikut terhitung sebagai klien
//
// Jalankan: node scripts/uji/test_ava_tech_tenant.js
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

// Skema tenants seperti yang dibuat 0004_tenancy.sql. Ditulis ulang di sini
// supaya uji ini hanya bergantung pada apa yang benar-benar dipakai 0029.
const SKEMA_DASAR = `
CREATE TABLE public.tenants (
  id         uuid PRIMARY KEY,
  kode       text UNIQUE NOT NULL,
  nama       text NOT NULL,
  jenis      text DEFAULT 'klinik',
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
INSERT INTO public.tenants (id, kode, nama, jenis)
VALUES ('00000000-0000-0000-0000-000000000001', 'lokal', 'Instalasi Lokal', 'suite');
`;

(async () => {
  console.log('\n═══ UJI AVA TECH — TENANT & PEMAKAIAN ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu = async (sql, args) => (await pg.query(sql, args)).rows[0];

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }
  await pg.exec(SKEMA_DASAR);

  // ── T1 ──
  try {
    await pg.exec(fs.readFileSync(
      path.join(AKAR, 'db', 'migrations', '0029_ava_tech_penjualan_lisensi.sql'), 'utf8'));
    cek('T1  migrasi 0029 terpasang di atas skema tenants yang ada', true);
  } catch (e) {
    cek('T1  migrasi 0029 terpasang', false, e.message);
    process.exit(1);
  }

  const panggil = async (fn, args) => (await satu(`SELECT public.${fn} AS d`, args)).d;

  // Dua klien: satu berkuota, satu tanpa batas.
  const idA = '11111111-1111-4111-8111-111111111111';
  const idB = '22222222-2222-4222-8222-222222222222';
  await pg.query(
    `INSERT INTO public.tenants (id, kode, nama, paket, kuota_tes, kuota_kunjungan,
       nilai_langganan, habis_langganan)
     VALUES ($1,'alfa','Klinik Alfa','CLINIC_PRATAMA',100,200,12000000, CURRENT_DATE + 400)`, [idA]);
  await pg.query(
    `INSERT INTO public.tenants (id, kode, nama, paket, kuota_tes, kuota_kunjungan,
       nilai_langganan, habis_langganan)
     VALUES ($1,'beta','Lab Beta','ENTERPRISE_RS',0,0,50000000, CURRENT_DATE + 10)`, [idB]);

  // ── T2: tercatat dan bertahan ──
  const r1 = await panggil('tenant_catat_pemakaian($1::uuid,$2,$3::int)', [idA, 'tes_lab', 30]);
  const tersimpan = await satu(
    `SELECT jumlah FROM public.tenant_pemakaian
      WHERE tenant_id=$1 AND metrik='tes_lab' AND periode=to_char(now(),'YYYY-MM')`, [idA]);
  cek('T2  pemakaian tercatat dan bertahan di tabel',
      r1.ok === true && r1.terpakai === 30 && tersimpan && Number(tersimpan.jumlah) === 30,
      JSON.stringify({ r1, tersimpan }));

  // ── T3: menjumlah, bukan menimpa ──
  const r2 = await panggil('tenant_catat_pemakaian($1::uuid,$2,$3::int)', [idA, 'tes_lab', 45]);
  cek('T3  pencatatan berulang menjumlah (30 + 45 = 75)',
      r2.terpakai === 75 && r2.terlampaui === false, JSON.stringify(r2));

  // ── T4: kuota 0 = tanpa batas ──
  const r3 = await panggil('tenant_catat_pemakaian($1::uuid,$2,$3::int)', [idB, 'tes_lab', 999999]);
  cek('T4  kuota 0 berarti tanpa batas, tidak pernah terlampaui',
      r3.ok === true && r3.kuota === 0 && r3.terlampaui === false, JSON.stringify(r3));

  // ── T5: kuota terbatas benar-benar ditegakkan pelaporannya ──
  const r4 = await panggil('tenant_catat_pemakaian($1::uuid,$2,$3::int)', [idA, 'tes_lab', 40]);
  cek('T5  kuota terbatas dilaporkan terlampaui saat lewat (115 > 100)',
      r4.terpakai === 115 && r4.terlampaui === true, JSON.stringify(r4));

  // ── T6: metrik asing ditolak ──
  const r5 = await panggil('tenant_catat_pemakaian($1::uuid,$2,$3::int)', [idA, 'metrik_ngawur', 5]);
  cek('T6  metrik tidak dikenal ditolak', !!r5.error, JSON.stringify(r5));

  // ── T7: status langganan dihitung view, bukan ditebak layar ──
  const baris = (await pg.query(
    `SELECT kode, status_langganan, pakai_tes FROM public.tenant_ringkasan ORDER BY kode`)).rows;
  const alfa = baris.find(b => b.kode === 'alfa');
  const beta = baris.find(b => b.kode === 'beta');
  cek('T7  status langganan dihitung benar (alfa aktif, beta segera-berakhir)',
      alfa && alfa.status_langganan === 'aktif' && Number(alfa.pakai_tes) === 115
      && beta && beta.status_langganan === 'segera-berakhir',
      JSON.stringify({ alfa, beta }));

  // ── T8: instalasi sendiri bukan klien ──
  const lokal = baris.find(b => b.kode === 'lokal');
  const lokalRow = await satu(`SELECT paket, catatan FROM public.tenants WHERE kode='lokal'`);
  cek('T8  instalasi sendiri ditandai MASTER_HOLDING, bukan klien berbayar',
      !!lokal && lokalRow.paket === 'MASTER_HOLDING' && /bukan klien/i.test(lokalRow.catatan || ''),
      JSON.stringify(lokalRow));

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
