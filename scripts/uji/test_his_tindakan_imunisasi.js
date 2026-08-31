// ═══════════════════════════════════════════════════════════════
// UJI: Tindakan & informed consent, imunisasi, kelengkapan RM
//      migrasi 0041 – 0043
//
//   T1  ketiga migrasi terpasang
//   T2  tindakan butuh-consent TIDAK bisa dimulai tanpa persetujuan
//   T3  persetujuan tanpa pemberi penjelasan ditolak
//   T4  penolakan wajib beralasan, dan langsung membatalkan tindakan
//   T5  tindakan berjalan setelah persetujuan sah
//   T6  tindakan yang TIDAK butuh consent boleh langsung dimulai
//   T7  tindakan tanpa operator ditolak
//   T8  persetujuan menyalin risiko dari katalog SAAT ITU
//   T9  seri terapi menutup diri saat sesi terakhir selesai
//   I1  vaksin kedaluwarsa ditolak
//   I2  VVM tingkat C/D ditolak
//   I3  interval antar dosis ditegakkan
//   I4  dosis melebihi seri ditolak
//   I5  pemberian sah memotong stok batch & menghitung dosis berikutnya
//   I6  batch dibuang wajib beralasan dan menolkan sisa
//   R1  kelengkapan dihitung dari tabel sumber, bukan dari centang
//   R2  unsur manual dihitung dari centangnya
//   R3  pemusnahan sebelum masa simpan habis ditolak
//
// Jalankan: node scripts/uji/test_his_tindakan_imunisasi.js
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

CREATE TABLE public.anamnesas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id bigint, chief_complaint text);

CREATE TABLE public.vital_signs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id bigint, bp_systolic int);

CREATE TABLE public.icd_diagnostics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id bigint, icd_code text);

CREATE TABLE public.lab_samples (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, admission_id bigint);

CREATE TABLE public.modalities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamp DEFAULT now());
ALTER TABLE public.modalities
  ADD COLUMN IF NOT EXISTS code text, ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS room text, ADD COLUMN IF NOT EXISTS slot_minutes int,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS updated_at timestamp;

CREATE TABLE public.radiology_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id bigint, modality_id bigint,
  scheduled_at timestamp, performed_at timestamp);
`;

(async () => {
  console.log('\n═══ UJI HIS — TINDAKAN, IMUNISASI, KELENGKAPAN RM ═══\n');

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
    for (const m of ['0041_tindakan_informed_consent.sql',
                     '0042_imunisasi.sql',
                     '0043_rm_kelengkapan_rad_katalog.sql']) {
      await pg.exec(fs.readFileSync(path.join(AKAR, 'db', 'migrations', m), 'utf8'));
    }
    cek('T1  migrasi 0041–0043 terpasang', true);
  } catch (e) { cek('T1  migrasi 0041–0043 terpasang', false, e.message); process.exit(1); }

  // ═══════════════ TINDAKAN & CONSENT ═══════════════
  console.log('\n── Tindakan & persetujuan ──');

  const ADM = (await satu(`INSERT INTO public.admissions (visit_number,patient_name,mr_number)
      VALUES ('V-001','Pasien Uji','MR-001') RETURNING id`)).id;

  const KT = (await satu(`INSERT INTO public.tindakan_katalog
      (kode,nama,kategori,butuh_consent,risiko,alternatif)
      VALUES ('END-01','Endoskopi Saluran Cerna Atas','Endoskopi',true,
              'Perdarahan, perforasi, reaksi sedasi','Pemeriksaan radiologi kontras')
      RETURNING id`)).id;
  const KT_NOC = (await satu(`INSERT INTO public.tindakan_katalog
      (kode,nama,kategori,butuh_consent) VALUES
      ('USG-01','USG Abdomen','USG',false) RETURNING id`)).id;
  const KT_SERI = (await satu(`INSERT INTO public.tindakan_katalog
      (kode,nama,kategori,butuh_consent,berseri,sesi_standar) VALUES
      ('FIS-01','Fisioterapi Lutut','Fisioterapi',false,true,3) RETURNING id`)).id;

  const t1 = await rpc('tindakan_buat($1)', [JSON.stringify({
    katalog_id: String(KT), admission_id: String(ADM),
    patient_name: 'Pasien Uji', mr_number: 'MR-001', operator: 'dr. A',
  })]);

  const mulaiTanpaConsent = await rpc('tindakan_mulai($1,$2)', [t1.id, 'dr. A']);
  cek('T2  tindakan butuh-consent tidak bisa dimulai tanpa persetujuan',
      !!mulaiTanpaConsent.error, mulaiTanpaConsent.error);

  const consentTanpaPenjelas = await rpc('tindakan_catat_consent($1)', [JSON.stringify({
    tindakan_id: String(t1.id), keputusan: 'setuju', penerima_nama: 'Pasien Uji',
  })]);
  cek('T3  persetujuan tanpa pemberi penjelasan ditolak',
      !!consentTanpaPenjelas.error, consentTanpaPenjelas.error);

  // Penolakan
  const t2 = await rpc('tindakan_buat($1)', [JSON.stringify({
    katalog_id: String(KT), patient_name: 'Pasien Dua', operator: 'dr. A' })]);
  const tolakTanpaAlasan = await rpc('tindakan_catat_consent($1)', [JSON.stringify({
    tindakan_id: String(t2.id), keputusan: 'menolak',
    dijelaskan_oleh: 'dr. A', penerima_nama: 'Pasien Dua',
  })]);
  const tolak = await rpc('tindakan_catat_consent($1)', [JSON.stringify({
    tindakan_id: String(t2.id), keputusan: 'menolak', alasan_menolak: 'takut sedasi',
    dijelaskan_oleh: 'dr. A', penerima_nama: 'Pasien Dua',
  })]);
  const st2 = (await satu(`SELECT status FROM public.tindakan WHERE id=$1`, [t2.id])).status;
  cek('T4  penolakan wajib beralasan dan langsung membatalkan tindakan',
      !!tolakTanpaAlasan.error && tolak.ok === true
      && tolak.tindakan_dibatalkan === true && st2 === 'Batal',
      `${tolakTanpaAlasan.error} / status=${st2}`);

  const c1 = await rpc('tindakan_catat_consent($1)', [JSON.stringify({
    tindakan_id: String(t1.id), keputusan: 'setuju',
    dijelaskan_oleh: 'dr. A', penerima_nama: 'Pasien Uji',
    penerima_hubungan: 'Pasien', saksi_petugas: 'Ns. B',
  })]);
  const mulai = await rpc('tindakan_mulai($1,$2)', [t1.id, 'dr. A']);
  cek('T5  tindakan berjalan setelah persetujuan sah',
      c1.ok === true && mulai.ok === true, JSON.stringify(mulai));

  const salinan = await satu(
    `SELECT penjelasan_risiko, penjelasan_alternatif FROM public.tindakan_consent
      WHERE tindakan_id=$1`, [t1.id]);
  cek('T8  persetujuan menyalin risiko dari katalog saat itu',
      /perforasi/i.test(salinan.penjelasan_risiko || '')
      && /radiologi/i.test(salinan.penjelasan_alternatif || ''),
      JSON.stringify(salinan));

  const t3 = await rpc('tindakan_buat($1)', [JSON.stringify({
    katalog_id: String(KT_NOC), patient_name: 'Pasien Tiga' })]);
  const mulaiNoc = await rpc('tindakan_mulai($1,$2)', [t3.id, 'dr. C']);
  cek('T6  tindakan tanpa syarat consent boleh langsung dimulai',
      mulaiNoc.ok === true, JSON.stringify(mulaiNoc));

  const t4 = await rpc('tindakan_buat($1)', [JSON.stringify({
    katalog_id: String(KT_NOC), patient_name: 'Pasien Empat' })]);
  const tanpaOperator = await rpc('tindakan_mulai($1)', [t4.id]);
  cek('T7  tindakan tanpa operator ditolak', !!tanpaOperator.error, tanpaOperator.error);

  // Seri terapi: 2 sesi rencana
  const SERI = (await satu(`INSERT INTO public.tindakan_seri
      (no_seri,katalog_id,patient_name,sesi_rencana) VALUES
      ('SER-01',$1,'Pasien Seri',2) RETURNING id`, [KT_SERI])).id;
  for (let i = 0; i < 2; i++) {
    const s = await rpc('tindakan_buat($1)', [JSON.stringify({
      katalog_id: String(KT_SERI), seri_id: String(SERI),
      patient_name: 'Pasien Seri', operator: 'Fisioterapis' })]);
    await rpc('tindakan_mulai($1,$2)', [s.id, 'Fisioterapis']);
    await rpc('tindakan_selesai($1,$2,$3)', [s.id, 'latihan lutut', 'ROM exercise']);
  }
  const stSeri = (await satu(`SELECT status FROM public.tindakan_seri WHERE id=$1`, [SERI])).status;
  cek('T9  seri menutup diri saat sesi terakhir selesai',
      stSeri === 'Selesai', stSeri);

  // ═══════════════ IMUNISASI ═══════════════
  console.log('\n── Imunisasi ──');

  const VK = (await satu(`INSERT INTO public.vaksin
      (kode,nama,rute,total_dosis,interval_min_hari) VALUES
      ('HEPB','Hepatitis B','IM',3,28) RETURNING id`)).id;

  const bExp = (await satu(`INSERT INTO public.vaksin_batch
      (vaksin_id,no_batch,tgl_kedaluwarsa,qty_terima,qty_sisa)
      VALUES ($1,'B-EXP','2020-01-01',10,10) RETURNING id`, [VK])).id;
  const bVvm = (await satu(`INSERT INTO public.vaksin_batch
      (vaksin_id,no_batch,tgl_kedaluwarsa,qty_terima,qty_sisa,vvm)
      VALUES ($1,'B-VVM','2027-12-31',10,10,'C') RETURNING id`, [VK])).id;
  const bOk = (await satu(`INSERT INTO public.vaksin_batch
      (vaksin_id,no_batch,tgl_kedaluwarsa,qty_terima,qty_sisa,vvm)
      VALUES ($1,'B-OK','2027-12-31',10,10,'A') RETURNING id`, [VK])).id;

  const kedaluwarsa = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bExp), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  cek('I1  vaksin kedaluwarsa ditolak', !!kedaluwarsa.error, kedaluwarsa.error);

  const vvmRusak = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bVvm), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  cek('I2  VVM tingkat C ditolak', !!vvmRusak.error, vvmRusak.error);

  const d1 = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bOk), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  const sisaBatch = (await satu(
    `SELECT qty_sisa FROM public.vaksin_batch WHERE id=$1`, [bOk])).qty_sisa;
  cek('I5  pemberian sah memotong stok & menghitung dosis berikutnya',
      d1.ok === true && d1.dosis_ke === 1 && Number(sisaBatch) === 9
      && !!d1.dosis_berikut, JSON.stringify({ d: d1.dosis_ke, sisa: sisaBatch }));

  const terlaluCepat = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bOk), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  cek('I3  interval antar dosis ditegakkan', !!terlaluCepat.error, terlaluCepat.error);

  // Majukan dosis 1 & 2 ke masa lalu supaya dosis 3 boleh, lalu uji dosis 4.
  await pg.exec(`UPDATE public.imunisasi SET tgl_beri = now() - interval '200 days'
                  WHERE mr_number='MR-B1'`);
  const d2 = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bOk), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  await pg.exec(`UPDATE public.imunisasi SET tgl_beri = now() - interval '200 days'
                  WHERE mr_number='MR-B1'`);
  const d3 = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bOk), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  await pg.exec(`UPDATE public.imunisasi SET tgl_beri = now() - interval '200 days'
                  WHERE mr_number='MR-B1'`);
  const d4 = await rpc('imunisasi_beri($1)', [JSON.stringify({
    batch_id: String(bOk), patient_name: 'Bayi A', mr_number: 'MR-B1',
    penyuntik: 'Bidan C' })]);
  cek('I4  dosis melebihi seri ditolak',
      d2.ok && d3.ok && d3.seri_lengkap === true && !!d4.error,
      `d3.seri_lengkap=${d3.seri_lengkap} d4=${d4.error}`);

  const buangTanpaAlasan = await rpc('vaksin_batch_buang($1,$2)', [bVvm, '']);
  const buang = await rpc('vaksin_batch_buang($1,$2,$3,$4)',
    [bVvm, 'VVM tingkat C', 'C', 'Koordinator']);
  const sisaBuang = (await satu(
    `SELECT qty_sisa,status FROM public.vaksin_batch WHERE id=$1`, [bVvm]));
  cek('I6  batch dibuang wajib beralasan dan menolkan sisa',
      !!buangTanpaAlasan.error && buang.ok === true
      && Number(sisaBuang.qty_sisa) === 0 && sisaBuang.status === 'Dibuang',
      JSON.stringify(sisaBuang));

  // ═══════════════ KELENGKAPAN RM ═══════════════
  console.log('\n── Kelengkapan & retensi rekam medis ──');

  await pg.exec(`INSERT INTO public.rm_aturan_retensi
      (kode,nama,berlaku_untuk,simpan_tahun,dasar_hukum,ditetapkan_oleh)
      VALUES ('UMUM','Rekam Medis Umum','umum',5,'Ditetapkan PJ RM','Kepala RM')`);
  await pg.exec(`INSERT INTO public.rm_unsur
      (kode,nama,kelompok,cara_periksa,sumber_tabel,wajib,berlaku_rawat,urutan) VALUES
      ('ANM','Anamnesis','Anamnesis','otomatis','anamnesas',true,'Semua',1),
      ('VIT','Tanda Vital','Pemeriksaan','otomatis','vital_signs',true,'Semua',2),
      ('DX','Diagnosa','Pemeriksaan','otomatis','icd_diagnostics',true,'Semua',3),
      ('TTD','Lembar Persetujuan Terpindai','Tindakan','manual',NULL,true,'Semua',4)`);

  const h1 = await rpc('rm_hitung_kelengkapan($1,$2)', [ADM, 'Petugas RM']);
  cek('R1  kelengkapan dihitung dari tabel sumber',
      h1.ok === true && h1.wajib === 4 && h1.terpenuhi === 0
      && h1.hasil === 'Tidak Lengkap',
      JSON.stringify({ w: h1.wajib, t: h1.terpenuhi }));

  await pg.exec(`INSERT INTO public.anamnesas (admission_id,chief_complaint)
                 VALUES (${ADM},'nyeri perut')`);
  await pg.exec(`INSERT INTO public.vital_signs (admission_id,bp_systolic)
                 VALUES (${ADM},120)`);
  await pg.exec(`INSERT INTO public.icd_diagnostics (admission_id,icd_code)
                 VALUES (${ADM},'K29')`);
  const h2 = await rpc('rm_hitung_kelengkapan($1,$2)', [ADM, 'Petugas RM']);

  const UNSUR_TTD = (await satu(
    `SELECT id FROM public.rm_unsur WHERE kode='TTD'`)).id;
  await pg.exec(`INSERT INTO public.rm_kelengkapan_manual
      (admission_id,unsur_id,ada,dicek_oleh) VALUES (${ADM},${UNSUR_TTD},true,'Petugas RM')`);
  const h3 = await rpc('rm_hitung_kelengkapan($1,$2)', [ADM, 'Petugas RM']);

  cek('R2  unsur manual dihitung dari centangnya',
      h2.terpenuhi === 3 && h3.terpenuhi === 4 && h3.hasil === 'Lengkap'
      && Number(h3.persen) === 100,
      `otomatis=${h2.terpenuhi} +manual=${h3.terpenuhi}`);

  const musnahDini = await rpc('rm_musnahkan($1,$2,$3)', [ADM, 'BA-01', 'Petugas RM']);
  await pg.exec(`UPDATE public.rm_kelengkapan SET simpan_sampai = current_date - 1
                  WHERE admission_id = ${ADM}`);
  const musnah = await rpc('rm_musnahkan($1,$2,$3)', [ADM, 'BA-01', 'Petugas RM']);
  const papan = await satu(
    `SELECT status_retensi FROM public.rm_papan WHERE admission_id=$1`, [ADM]);
  cek('R3  pemusnahan sebelum masa simpan habis ditolak',
      !!musnahDini.error && musnah.ok === true
      && papan.status_retensi === 'Dimusnahkan',
      `${musnahDini.error} → ${papan.status_retensi}`);

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
