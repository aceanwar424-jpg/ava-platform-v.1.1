// ═══════════════════════════════════════════════════════════════
// UJI: LIS (flebotomi/kelayakan/PME/arsip) & Tech & Order Terintegrasi
//      migrasi 0038 – 0039
//
//   L1  kedua migrasi terpasang di atas skema yang ada
//   L2  penolakan HARUS merujuk kriteria yang ditetapkan lab
//   L3  sampel yang sudah selesai TIDAK bisa ditolak surut
//   L4  penolakan menandai perlu ambil ulang sesuai kriterianya
//   L5  sampel yang sudah ditolak tidak bisa diterima
//   L6  arsip tanpa lokasi ditolak
//   L7  pemusnahan sebelum masa simpan habis ditolak
//   L8  pemusnahan wajib menyebut petugas, dan tidak bisa dua kali
//   L9  papan arsip menghitung status & sisa hari
//   P1  z-score tanpa SD ditolak
//   P2  |z| <= 2 memuaskan
//   P3  2 < |z| <= 3 dipertanyakan, wajib tindakan
//   P4  |z| > 3 tidak memuaskan, wajib tindakan
//   T1  aktivasi lisensi menghidupkan tenant
//   T2  aktivasi dua kali ditolak
//   T3  lisensi kedaluwarsa tidak bisa diaktifkan
//   T4  lisensi dicabut tidak bisa diaktifkan
//   T5  pencabutan wajib beralasan & TIDAK mematikan tenant
//   O1  order kosong ditolak
//   O2  harga item diambil dari master, bukan dari klien
//   O3  status induk mengikuti itemnya (sebagian → selesai)
//   O4  seluruh item batal → order batal
//
// Jalankan: node scripts/uji/test_lis_tech_order.js
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

// Prasyarat sesuai bentuk aslinya di repo.
const PRASYARAT = `
CREATE TABLE public.admissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_number text, patient_name text);

CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_internal text UNIQUE, nama_tes text NOT NULL,
  harga_normal numeric DEFAULT 0, loinc_code text);

CREATE TABLE public.analyzers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text);

CREATE TABLE public.lab_samples (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  barcode text UNIQUE, admission_id bigint REFERENCES public.admissions(id),
  visit_number text, patient_name text,
  product_id bigint REFERENCES public.products(id), product_name text,
  sampel_type text, collected_at timestamp, collected_by text, volume_ml numeric,
  analyzer_id bigint REFERENCES public.analyzers(id), analyzer_name text,
  received_at timestamp, status text DEFAULT 'Pending');

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY, kode text UNIQUE NOT NULL, nama text NOT NULL,
  jenis text DEFAULT 'klinik', is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now());
`;

(async () => {
  console.log('\n═══ UJI LIS · TECH · ORDER TERINTEGRASI (0038–0039) ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu = async (s, a) => (await pg.query(s, a)).rows[0];
  const rpc  = async (s, a) => (await satu(`SELECT public.${s} AS d`, a)).d;

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }
  await pg.exec(PRASYARAT);

  try {
    for (const m of ['0038_lis_flebotomi_kelayakan_pme_arsip.sql',
                     '0039_tech_lisensi_harga_order_terintegrasi.sql']) {
      await pg.exec(fs.readFileSync(path.join(AKAR, 'db', 'migrations', m), 'utf8'));
    }
    cek('L1  migrasi 0038–0039 terpasang', true);
  } catch (e) { cek('L1  migrasi 0038–0039 terpasang', false, e.message); process.exit(1); }

  // ═══════════════ LIS — KELAYAKAN SPESIMEN ═══════════════
  console.log('\n── LIS: kelayakan spesimen ──');

  const PR = (await satu(`INSERT INTO public.products (kode_internal,nama_tes,harga_normal)
      VALUES ('LAB-001','Darah Lengkap',120000) RETURNING id`)).id;
  const PR2 = (await satu(`INSERT INTO public.products (kode_internal,nama_tes,harga_normal)
      VALUES ('RAD-001','Thorax PA',180000) RETURNING id`)).id;

  const smp = async (bc, st) => (await satu(
    `INSERT INTO public.lab_samples (barcode,patient_name,product_id,product_name,status)
     VALUES ($1,'Pasien Uji',$2,'Darah Lengkap',$3) RETURNING id`, [bc, PR, st])).id;

  const S1 = await smp('BC-001', 'Pending');
  const S2 = await smp('BC-002', 'Done');
  const S3 = await smp('BC-003', 'Pending');

  const tanpaKriteria = await rpc('lab_tolak_spesimen($1,$2)', [S1, 999]);
  cek('L2  penolakan tanpa kriteria yang ditetapkan lab ditolak',
      !!tanpaKriteria.error, JSON.stringify(tanpaKriteria));

  const K1 = (await satu(`INSERT INTO public.lab_kriteria_tolak
      (kode,nama,kategori,tindakan,wajib_ambil_ulang)
      VALUES ('REJ-01','Volume tidak cukup','Volume','Ambil ulang',true)
      RETURNING id`)).id;
  const K2 = (await satu(`INSERT INTO public.lab_kriteria_tolak
      (kode,nama,kategori,tindakan,wajib_ambil_ulang)
      VALUES ('REJ-02','Identitas tidak terbaca','Identitas','Konfirmasi ke ruangan',false)
      RETURNING id`)).id;

  const tolakDone = await rpc('lab_tolak_spesimen($1,$2)', [S2, K1]);
  cek('L3  sampel yang sudah selesai tidak bisa ditolak surut',
      !!tolakDone.error, tolakDone.error);

  const t1 = await rpc('lab_tolak_spesimen($1,$2,$3,$4)', [S1, K1, null, 'Analis A']);
  const s1st = await satu(
    `SELECT status, diambil_ulang, alasan_tolak FROM public.lab_samples WHERE id=$1`, [S1]);
  const t2 = await rpc('lab_tolak_spesimen($1,$2,$3,$4)', [S3, K2, null, 'Analis A']);
  const s3st = await satu(
    `SELECT diambil_ulang FROM public.lab_samples WHERE id=$1`, [S3]);
  cek('L4  penolakan menandai perlu-ambil-ulang sesuai kriterianya',
      t1.ok && t1.perlu_ambil_ulang === true && s1st.status === 'Rejected'
      && s1st.diambil_ulang === true
      && t2.ok && t2.perlu_ambil_ulang === false && s3st.diambil_ulang === false,
      `S1=${s1st.diambil_ulang} S3=${s3st.diambil_ulang}`);

  const terimaDitolak = await rpc('lab_terima_spesimen($1)', [S1]);
  cek('L5  sampel yang sudah ditolak tidak bisa diterima',
      !!terimaDitolak.error, terimaDitolak.error);

  // ═══════════════ LIS — ARSIP ═══════════════
  console.log('\n── LIS: arsip & pemusnahan ──');

  const A1 = await smp('BC-010', 'Done');
  const tanpaLokasi = await rpc('lab_arsipkan_sampel($1,$2)', [A1, '   ']);
  cek('L6  arsip tanpa lokasi ditolak', !!tanpaLokasi.error, tanpaLokasi.error);

  await rpc('lab_arsipkan_sampel($1,$2,$3,$4,$5,$6)',
    [A1, 'Freezer -20', 'R1', 'B3', 'A5', 7]);
  const musnahDini = await rpc('lab_musnahkan_sampel($1,$2,$3)',
    [A1, 'BA-001', 'Analis A']);
  cek('L7  pemusnahan sebelum masa simpan habis ditolak',
      !!musnahDini.error, musnahDini.error);

  // Majukan masa simpan supaya bisa dimusnahkan.
  await pg.exec(`UPDATE public.lab_samples
                    SET simpan_sampai = current_date - 1 WHERE id = ${A1}`);
  const tanpaPetugas = await rpc('lab_musnahkan_sampel($1,$2,$3)', [A1, 'BA-001', '']);
  const musnah1 = await rpc('lab_musnahkan_sampel($1,$2,$3)', [A1, 'BA-001', 'Analis A']);
  const musnah2 = await rpc('lab_musnahkan_sampel($1,$2,$3)', [A1, 'BA-001', 'Analis A']);
  cek('L8  pemusnahan wajib menyebut petugas dan tidak bisa dua kali',
      !!tanpaPetugas.error && musnah1.ok === true && !!musnah2.error,
      `${tanpaPetugas.error} / ${musnah2.error}`);

  const A2 = await smp('BC-011', 'Done');
  await rpc('lab_arsipkan_sampel($1,$2,$3,$4,$5,$6)',
    [A2, 'Kulkas 4C', 'R2', 'B1', 'C2', 30]);
  const papan = await satu(
    `SELECT status_arsip, sisa_hari FROM public.lab_arsip_papan WHERE id=$1`, [A2]);
  const papanMusnah = await satu(
    `SELECT status_arsip FROM public.lab_arsip_papan WHERE id=$1`, [A1]);
  cek('L9  papan arsip menghitung status & sisa hari',
      papan.status_arsip === 'Tersimpan' && Number(papan.sisa_hari) === 30
      && papanMusnah.status_arsip === 'Dimusnahkan',
      `${papan.status_arsip}/${papan.sisa_hari}, ${papanMusnah.status_arsip}`);

  // ═══════════════ LIS — PME ═══════════════
  console.log('\n── LIS: PME / uji profisiensi ──');

  const PG1 = (await satu(`INSERT INTO public.lab_pme_program
      (kode,nama,penyelenggara,lingkup) VALUES
      ('PME-1','PME Kimia Klinik','Penyelenggara A','Kimia Klinik') RETURNING id`)).id;
  const SK1 = (await satu(`INSERT INTO public.lab_pme_siklus
      (program_id,kode_siklus) VALUES ($1,'S1') RETURNING id`, [PG1])).id;

  const tanpaSd = await rpc('lab_pme_catat_hasil($1,$2,$3,$4,$5)',
    [SK1, 'Glukosa', 100, 98, null]);
  cek('P1  z-score tanpa SD ditolak', !!tanpaSd.error, tanpaSd.error);

  const z1 = await rpc('lab_pme_catat_hasil($1,$2,$3,$4,$5,$6)',
    [SK1, 'Glukosa', 100, 98, 2, 'mg/dL']);          // z = 1
  const z2 = await rpc('lab_pme_catat_hasil($1,$2,$3,$4,$5,$6)',
    [SK1, 'Kolesterol', 105, 100, 2, 'mg/dL']);      // z = 2.5
  const z3 = await rpc('lab_pme_catat_hasil($1,$2,$3,$4,$5,$6)',
    [SK1, 'Trigliserida', 120, 100, 5, 'mg/dL']);    // z = 4

  cek('P2  |z| <= 2 memuaskan',
      Number(z1.z_score) === 1 && z1.evaluasi === 'Memuaskan'
      && z1.wajib_tindakan === false, JSON.stringify(z1));
  cek('P3  2 < |z| <= 3 dipertanyakan dan wajib tindakan',
      Number(z2.z_score) === 2.5 && z2.evaluasi === 'Dipertanyakan'
      && z2.wajib_tindakan === true, JSON.stringify(z2));
  cek('P4  |z| > 3 tidak memuaskan dan wajib tindakan',
      Number(z3.z_score) === 4 && z3.evaluasi === 'Tidak Memuaskan'
      && z3.wajib_tindakan === true, JSON.stringify(z3));

  // ═══════════════ TECH — LISENSI ═══════════════
  console.log('\n── AVA Tech: paket & lisensi ──');

  const TID = '11111111-1111-1111-1111-111111111111';
  await pg.exec(`INSERT INTO public.tenants (id,kode,nama,jenis,is_active)
                 VALUES ('${TID}','klinikA','Klinik A','klinik',false)`);
  const PK = (await satu(`INSERT INTO public.tech_paket
      (kode,nama,untuk,harga_bulanan,batas_pengguna)
      VALUES ('PRO','Paket Pro','klinik',2500000,25) RETURNING id`)).id;

  const mkLis = async (kode, akhir, status) => (await satu(
    `INSERT INTO public.tech_lisensi (tenant_id,paket_id,kode_lisensi,tgl_berakhir,status)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [TID, PK, kode, akhir, status || 'Belum Aktif'])).id;

  const L_ok = await mkLis('LIC-OK', '2027-12-31');
  const akt = await rpc('tech_aktifkan_lisensi($1,$2,$3)', ['LIC-OK', 'abc123', 'Admin']);
  const tenantAktif = (await satu(
    `SELECT is_active FROM public.tenants WHERE id=$1`, [TID])).is_active;
  cek('T1  aktivasi lisensi menghidupkan tenant',
      akt.ok === true && tenantAktif === true, JSON.stringify(akt));

  const akt2 = await rpc('tech_aktifkan_lisensi($1)', ['LIC-OK']);
  cek('T2  aktivasi dua kali ditolak', !!akt2.error, akt2.error);

  await mkLis('LIC-EXP', '2020-01-01');
  const aktExp = await rpc('tech_aktifkan_lisensi($1)', ['LIC-EXP']);
  cek('T3  lisensi kedaluwarsa tidak bisa diaktifkan', !!aktExp.error, aktExp.error);

  const L_cabut = await mkLis('LIC-CAB', '2027-12-31');
  const cabutTanpaAlasan = await rpc('tech_cabut_lisensi($1,$2)', [L_cabut, '']);
  const cabut = await rpc('tech_cabut_lisensi($1,$2,$3)',
    [L_cabut, 'tunggakan 3 bulan', 'Admin']);
  const tenantMasihAktif = (await satu(
    `SELECT is_active FROM public.tenants WHERE id=$1`, [TID])).is_active;
  const aktCabut = await rpc('tech_aktifkan_lisensi($1)', ['LIC-CAB']);

  cek('T4  lisensi dicabut tidak bisa diaktifkan', !!aktCabut.error, aktCabut.error);
  cek('T5  pencabutan wajib beralasan dan TIDAK mematikan tenant',
      !!cabutTanpaAlasan.error && cabut.ok === true && tenantMasihAktif === true,
      `tenant_aktif=${tenantMasihAktif}`);

  // ═══════════════ ORDER TERINTEGRASI ═══════════════
  console.log('\n── HIS: order terintegrasi ──');

  const kosong = await rpc('order_terintegrasi_buat($1)', [JSON.stringify({
    patient_name: 'Pasien Uji', item: [] })]);
  cek('O1  order tanpa item ditolak', !!kosong.error, kosong.error);

  const ord = await rpc('order_terintegrasi_buat($1)', [JSON.stringify({
    patient_name: 'Pasien Uji', dokter_perujuk: 'dr. A', prioritas: 'Cito',
    item: [
      { layanan: 'lab',       product_id: PR,  harga: 1 },
      { layanan: 'radiologi', product_id: PR2, harga: 1 },
    ],
  })]);
  const items = (await pg.query(
    `SELECT * FROM public.order_terintegrasi_item WHERE order_id=$1 ORDER BY id`,
    [ord.id])).rows;
  cek('O2  harga item diambil dari master, bukan dari klien',
      Number(items[0].harga) === 120000 && Number(items[1].harga) === 180000
      && Number(ord.total) === 300000,
      `${items[0].harga}/${items[1].harga}/${ord.total}`);

  const st1 = await rpc('order_terintegrasi_status_item($1,$2,$3,$4)',
    [items[0].id, 'Selesai', 'lab_samples', S1]);
  const st2 = await rpc('order_terintegrasi_status_item($1,$2)',
    [items[1].id, 'Selesai']);
  cek('O3  status induk mengikuti itemnya',
      st1.status_order === 'Sebagian Selesai' && st2.status_order === 'Selesai',
      `${st1.status_order} → ${st2.status_order}`);

  const ord2 = await rpc('order_terintegrasi_buat($1)', [JSON.stringify({
    patient_name: 'Pasien Dua', item: [{ layanan: 'lab', product_id: PR }] })]);
  const it2 = (await pg.query(
    `SELECT id FROM public.order_terintegrasi_item WHERE order_id=$1`, [ord2.id])).rows;
  const stB = await rpc('order_terintegrasi_status_item($1,$2)', [it2[0].id, 'Batal']);
  cek('O4  seluruh item batal → order batal',
      stB.status_order === 'Batal', stB.status_order);

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
