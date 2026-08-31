// ═══════════════════════════════════════════════════════════════
// UJI: alur tagihan & penerusan order (migrasi 0044)
//
//   A1  migrasi terpasang di atas 0039/0041/0042
//   A2  biaya tanpa kunjungan/perawatan ditolak
//   A3  tarif negatif ditolak
//   A4  tindakan selesai menerbitkan biaya sekali
//   A5  posting ulang untuk layanan yang sama TIDAK menggandakan
//   A6  tindakan tanpa kunjungan: biaya tidak hilang diam-diam, disebutkan
//   A7  imunisasi menerbitkan biaya dan tetap memakai penjagaan aslinya
//   A8  pembatalan biaya wajib beralasan dan tidak menghapus baris
//   A9  ringkasan tagihan hanya menghitung yang aktif
//   O1  order lab diteruskan → lab_samples terbit & item jadi Diproses
//   O2  order radiologi diteruskan → radiology_orders terbit
//   O3  penerusan dua kali ditolak
//   O4  tindakan tanpa katalog ditolak dengan alasan yang bisa ditindak
//
// Jalankan: node scripts/uji/test_alur_tagihan_order.js
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

const PRASYARAT = `
CREATE TABLE public.admissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_number text, patient_name text, mr_number text,
  visit_date date DEFAULT current_date, is_inpatient boolean DEFAULT false);

CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_internal text UNIQUE, nama_tes text NOT NULL,
  kategori text, harga_normal numeric DEFAULT 0,
  loinc_code text, sampel_type text);

CREATE TABLE public.analyzers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text);

CREATE TABLE public.lab_samples (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamp DEFAULT now(),
  barcode text UNIQUE, admission_id bigint, visit_number text,
  patient_name text, product_id bigint, product_name text,
  sampel_type text, collected_at timestamp, collected_by text,
  volume_ml numeric, analyzer_id bigint, analyzer_name text,
  received_at timestamp, status text DEFAULT 'Pending');

CREATE TABLE public.modalities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamp DEFAULT now());
ALTER TABLE public.modalities
  ADD COLUMN IF NOT EXISTS code text, ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS room text, ADD COLUMN IF NOT EXISTS slot_minutes int,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS updated_at timestamp;

CREATE TABLE public.radiology_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamp DEFAULT now());
ALTER TABLE public.radiology_orders
  ADD COLUMN IF NOT EXISTS accession_no text, ADD COLUMN IF NOT EXISTS admission_id bigint,
  ADD COLUMN IF NOT EXISTS patient_name text, ADD COLUMN IF NOT EXISTS mr_number text,
  ADD COLUMN IF NOT EXISTS procedure_name text, ADD COLUMN IF NOT EXISTS product_id bigint,
  ADD COLUMN IF NOT EXISTS clinical_info text, ADD COLUMN IF NOT EXISTS referring_doctor text,
  ADD COLUMN IF NOT EXISTS priority text, ADD COLUMN IF NOT EXISTS scheduled_at timestamp,
  ADD COLUMN IF NOT EXISTS performed_at timestamp, ADD COLUMN IF NOT EXISTS modality_id bigint,
  ADD COLUMN IF NOT EXISTS modality_code text, ADD COLUMN IF NOT EXISTS created_by text;

CREATE TABLE public.radiology_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamp DEFAULT now());
ALTER TABLE public.radiology_reports
  ADD COLUMN IF NOT EXISTS order_id bigint, ADD COLUMN IF NOT EXISTS signed_at timestamp;

CREATE TABLE public.radiology_images (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamp DEFAULT now());
ALTER TABLE public.radiology_images
  ADD COLUMN IF NOT EXISTS order_id bigint, ADD COLUMN IF NOT EXISTS accession_no text;

CREATE TABLE public.anamnesas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, admission_id bigint);
CREATE TABLE public.vital_signs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, admission_id bigint);
CREATE TABLE public.icd_diagnostics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, admission_id bigint);

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY, kode text UNIQUE, nama text,
  jenis text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now());

-- inpatient_charges seperti bentuk aslinya di arsip
CREATE TABLE public.inpatient_charges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamp DEFAULT now());
ALTER TABLE public.inpatient_charges
  ADD COLUMN IF NOT EXISTS stay_id bigint,
  ADD COLUMN IF NOT EXISTS charge_date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS charge_type text DEFAULT 'Tindakan',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS qty numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS posted_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp;
`;

(async () => {
  console.log('\n═══ UJI ALUR TAGIHAN & PENERUSAN ORDER (0044) ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu = async (s, a) => (await pg.query(s, a)).rows[0];
  const semua = async (s, a) => (await pg.query(s, a)).rows;
  const rpc = async (s, a) => (await satu(`SELECT public.${s} AS d`, a)).d;

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }
  await pg.exec(PRASYARAT);

  try {
    for (const m of ['0039_tech_lisensi_harga_order_terintegrasi.sql',
                     '0041_tindakan_informed_consent.sql',
                     '0042_imunisasi.sql',
                     '0044_alur_tagihan_dan_teruskan_order.sql']) {
      await pg.exec(fs.readFileSync(path.join(AKAR, 'db', 'migrations', m), 'utf8'));
    }
    cek('A1  migrasi 0044 terpasang di atas 0039/0041/0042', true);
  } catch (e) { cek('A1  migrasi 0044 terpasang', false, e.message); process.exit(1); }

  const ADM = (await satu(`INSERT INTO public.admissions (visit_number,patient_name,mr_number)
      VALUES ('V-001','Pasien Uji','MR-001') RETURNING id`)).id;
  const PR_LAB = (await satu(`INSERT INTO public.products
      (kode_internal,nama_tes,kategori,harga_normal,sampel_type)
      VALUES ('LAB-001','Darah Lengkap','Hematologi',120000,'Darah vena') RETURNING id`)).id;
  const PR_RAD = (await satu(`INSERT INTO public.products
      (kode_internal,nama_tes,kategori,harga_normal)
      VALUES ('RAD-001','Thorax PA','Radiologi',180000) RETURNING id`)).id;

  // ═══════════ TAGIHAN ═══════════
  console.log('\n── Tagihan ──');

  const tanpaInduk = await rpc('tagihan_posting($1,$2,$3,$4)',
    ['tindakan', 999, 'Tindakan', 'Uji']);
  cek('A2  biaya tanpa kunjungan/perawatan ditolak', !!tanpaInduk.error, tanpaInduk.error);

  const negatif = await rpc('tagihan_posting($1,$2,$3,$4,$5,$6,$7)',
    ['tindakan', 998, 'Tindakan', 'Uji', 1, -5000, ADM]);
  cek('A3  tarif negatif ditolak', !!negatif.error, negatif.error);

  const KT = (await satu(`INSERT INTO public.tindakan_katalog
      (kode,nama,kategori,butuh_consent,tarif) VALUES
      ('BM-01','Jahit Luka','Bedah Minor',false,250000) RETURNING id`)).id;

  const t1 = await rpc('tindakan_buat($1)', [JSON.stringify({
    katalog_id: String(KT), admission_id: String(ADM),
    patient_name: 'Pasien Uji', operator: 'dr. A' })]);
  await rpc('tindakan_mulai($1,$2)', [t1.id, 'dr. A']);
  const sel = await rpc('tindakan_selesai($1,$2,$3)', [t1.id, 'luka bersih', 'jahit 3 simpul']);
  const charge = await satu(
    `SELECT * FROM public.inpatient_charges WHERE ref_tabel='tindakan' AND ref_id=$1`, [t1.id]);
  cek('A4  tindakan selesai menerbitkan biaya',
      sel.ok === true && sel.tagihan.ok === true && Number(charge.amount) === 250000
      && charge.source === 'otomatis' && Number(charge.admission_id) === Number(ADM),
      JSON.stringify({ tagihan: sel.tagihan, amount: charge && charge.amount }));

  const ulang = await rpc('tagihan_posting($1,$2,$3,$4,$5,$6,$7)',
    ['tindakan', t1.id, 'Tindakan', 'Jahit Luka', 1, 250000, ADM]);
  const jml = (await satu(
    `SELECT count(*) n FROM public.inpatient_charges WHERE ref_tabel='tindakan' AND ref_id=$1`,
    [t1.id])).n;
  cek('A5  posting ulang tidak menggandakan biaya',
      ulang.ok === true && ulang.sudah_ada === true && Number(jml) === 1,
      `baris=${jml}`);

  const t2 = await rpc('tindakan_buat($1)', [JSON.stringify({
    katalog_id: String(KT), patient_name: 'Pasien Tanpa Kunjungan', operator: 'dr. A' })]);
  await rpc('tindakan_mulai($1,$2)', [t2.id, 'dr. A']);
  const sel2 = await rpc('tindakan_selesai($1,$2,$3)', [t2.id, '-', 'jahit']);
  cek('A6  tindakan tanpa kunjungan: biaya disebutkan, tidak hilang diam-diam',
      sel2.ok === true && sel2.tagihan.ok === false && !!sel2.tagihan.catatan,
      JSON.stringify(sel2.tagihan));

  // Imunisasi
  const VK = (await satu(`INSERT INTO public.vaksin
      (kode,nama,rute,total_dosis,interval_min_hari,tarif) VALUES
      ('HEPB','Hepatitis B','IM',3,28,175000) RETURNING id`)).id;
  const BT = (await satu(`INSERT INTO public.vaksin_batch
      (vaksin_id,no_batch,tgl_kedaluwarsa,qty_terima,qty_sisa,vvm)
      VALUES ($1,'B-OK','2027-12-31',10,10,'A') RETURNING id`, [VK])).id;
  const BT_EXP = (await satu(`INSERT INTO public.vaksin_batch
      (vaksin_id,no_batch,tgl_kedaluwarsa,qty_terima,qty_sisa,vvm)
      VALUES ($1,'B-EXP','2020-01-01',10,10,'A') RETURNING id`, [VK])).id;

  const imKedaluwarsa = await rpc('imunisasi_beri_dan_tagih($1)', [JSON.stringify({
    batch_id: String(BT_EXP), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C', admission_id: String(ADM) })]);
  const im = await rpc('imunisasi_beri_dan_tagih($1)', [JSON.stringify({
    batch_id: String(BT), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C', admission_id: String(ADM) })]);
  const cIm = await satu(
    `SELECT amount FROM public.inpatient_charges WHERE ref_tabel='imunisasi'`);
  cek('A7  imunisasi menagih dan tetap memakai penjagaan aslinya',
      !!imKedaluwarsa.error && im.ok === true
      && im.tagihan.ok === true && Number(cIm.amount) === 175000,
      `exp=${imKedaluwarsa.error} amount=${cIm && cIm.amount}`);

  const batalTanpaAlasan = await rpc('tagihan_batalkan($1,$2)', [charge.id, '']);
  const batal = await rpc('tagihan_batalkan($1,$2,$3)', [charge.id, 'salah input', 'Kasir']);
  const masihAda = await satu(
    `SELECT dibatalkan_at, alasan_batal FROM public.inpatient_charges WHERE id=$1`, [charge.id]);
  cek('A8  pembatalan wajib beralasan dan tidak menghapus baris',
      !!batalTanpaAlasan.error && batal.ok === true
      && !!masihAda.dibatalkan_at && masihAda.alasan_batal === 'salah input',
      JSON.stringify(masihAda));

  const ringkas = await satu(
    `SELECT jml_item, total FROM public.tagihan_ringkas WHERE admission_id=$1`, [ADM]);
  cek('A9  ringkasan hanya menghitung biaya yang aktif',
      Number(ringkas.jml_item) === 1 && Number(ringkas.total) === 175000,
      JSON.stringify(ringkas));

  // ═══════════ PENERUSAN ORDER ═══════════
  console.log('\n── Penerusan order ke layanan ──');

  const ord = await rpc('order_terintegrasi_buat($1)', [JSON.stringify({
    patient_name: 'Pasien Uji', admission_id: String(ADM), visit_number: 'V-001',
    mr_number: 'MR-001', dokter_perujuk: 'dr. A', klinis: 'anemia?',
    item: [
      { layanan: 'lab', product_id: PR_LAB },
      { layanan: 'radiologi', product_id: PR_RAD },
      { layanan: 'tindakan', nama: 'Tindakan Tak Dikenal' },
    ],
  })]);
  const items = await semua(
    `SELECT * FROM public.order_terintegrasi_item WHERE order_id=$1 ORDER BY id`, [ord.id]);

  const tLab = await rpc('order_terintegrasi_teruskan($1,$2)', [items[0].id, 'Perawat']);
  const sampel = await satu(
    `SELECT * FROM public.lab_samples WHERE id=$1`, [tLab.id]);
  const itemLab = await satu(
    `SELECT status, ref_tabel, ref_id FROM public.order_terintegrasi_item WHERE id=$1`,
    [items[0].id]);
  cek('O1  order lab diteruskan → lab_samples terbit & item jadi Diproses',
      tLab.ok === true && sampel && Number(sampel.admission_id) === Number(ADM)
      && sampel.status === 'Pending' && itemLab.status === 'Diproses'
      && itemLab.ref_tabel === 'lab_samples',
      JSON.stringify({ t: tLab, item: itemLab }));

  const tRad = await rpc('order_terintegrasi_teruskan($1,$2)', [items[1].id, 'Perawat']);
  const ro = await satu(`SELECT * FROM public.radiology_orders WHERE id=$1`, [tRad.id]);
  cek('O2  order radiologi diteruskan → radiology_orders terbit',
      tRad.ok === true && ro && ro.procedure_name === 'Thorax PA'
      && ro.clinical_info === 'anemia?' && ro.referring_doctor === 'dr. A',
      JSON.stringify({ nomor: tRad.nomor, proc: ro && ro.procedure_name }));

  const lagi = await rpc('order_terintegrasi_teruskan($1)', [items[0].id]);
  cek('O3  penerusan dua kali ditolak', !!lagi.error, lagi.error);

  const tTdk = await rpc('order_terintegrasi_teruskan($1)', [items[2].id]);
  cek('O4  tindakan tanpa katalog ditolak dengan alasan yang bisa ditindak',
      !!tTdk.error && /katalog/i.test(tTdk.error), tTdk.error);

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
