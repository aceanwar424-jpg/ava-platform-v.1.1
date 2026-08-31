// ═══════════════════════════════════════════════════════════════
// UJI: keselamatan pasien — IKP, mutu, triase, skrining, EWS, MAR
//      migrasi 0045 – 0046
//
//   K1  kedua migrasi terpasang
//   K2  laporan IKP boleh ANONIM (tanpa nama pelapor)
//   K3  kronologi wajib; kejadian di masa depan ditolak
//   K4  grading dihitung dari dampak x peluang, tidak diketik
//   K5  sentinel selalu band Merah berapa pun angkanya
//   K6  insiden tidak bisa ditutup tanpa investigasi
//   K7  band Kuning/Merah menuntut RCA, bukan investigasi sederhana
//   K8  tidak bisa ditutup tanpa akar masalah dan CAPA selesai
//   K9  insiden lengkap bisa ditutup
//   M1  denominator nol ditolak, bukan dihitung 0%
//   M2  arah "turun" dinilai terbalik dengan benar
//   T1  level triase di luar 1-5 ditolak
//   T2  petugas triase wajib diisi
//   T3  EWS dihitung dan target waktu tunggu mengikuti level
//   T4  EWS tinggi pada level rendah memunculkan peringatan
//   T5  EWS menandai tanda vital yang belum lengkap
//   S1  risiko tinggi wajib punya tindak lanjut
//   S2  instrumen wajib disebutkan
//   A1  pemberian obat wajib menyebut pemberi
//   A2  yang tidak diberikan wajib beralasan
//   A3  satu jadwal-jam tidak bisa dicatat dua kali
//
// Jalankan: node scripts/uji/test_keselamatan_pasien.js
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
  visit_number text, patient_name text, mr_number text);
`;

(async () => {
  console.log('\n═══ UJI KESELAMATAN PASIEN (0045–0046) ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu = async (s, a) => (await pg.query(s, a)).rows[0];
  const rpc = async (s, a) => (await satu(`SELECT public.${s} AS d`, a)).d;

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }
  await pg.exec(PRASYARAT);

  try {
    for (const m of ['0045_insiden_keselamatan_pasien.sql',
                     '0046_triase_skrining_ews_mar.sql']) {
      await pg.exec(fs.readFileSync(path.join(AKAR, 'db', 'migrations', m), 'utf8'));
    }
    cek('K1  migrasi 0045–0046 terpasang', true);
  } catch (e) { cek('K1  migrasi 0045–0046 terpasang', false, e.message); process.exit(1); }

  const ADM = (await satu(`INSERT INTO public.admissions (visit_number,patient_name,mr_number)
      VALUES ('V-001','Pasien Uji','MR-001') RETURNING id`)).id;

  // ═══════════ IKP ═══════════
  console.log('\n── Insiden keselamatan pasien ──');

  const anon = await rpc('ikp_lapor($1)', [JSON.stringify({
    jenis: 'KNC', tgl_kejadian: '2026-08-30 09:00',
    kronologi: 'Obat hampir tertukar antar pasien, ketahuan saat verifikasi gelang.',
    lokasi: 'Bangsal A' })]);
  const barisAnon = await satu(
    `SELECT pelapor_nama, anonim FROM public.ikp WHERE id=$1`, [anon.id]);
  cek('K2  laporan IKP boleh anonim',
      anon.ok === true && anon.anonim === true && barisAnon.pelapor_nama === null,
      JSON.stringify(barisAnon));

  const tanpaKronologi = await rpc('ikp_lapor($1)', [JSON.stringify({
    jenis: 'KNC', tgl_kejadian: '2026-08-30 09:00' })]);
  const masaDepan = await rpc('ikp_lapor($1)', [JSON.stringify({
    jenis: 'KNC', tgl_kejadian: '2099-01-01 09:00', kronologi: 'uji' })]);
  cek('K3  kronologi wajib; kejadian masa depan ditolak',
      !!tanpaKronologi.error && !!masaDepan.error,
      `${tanpaKronologi.error} / ${masaDepan.error}`);

  // Grading: dampak 2 x peluang 2 = 4 → Hijau
  const gHijau = await rpc('ikp_grading($1,$2,$3)', [anon.id, 2, 2]);
  cek('K4  grading dihitung dari dampak × peluang',
      gHijau.ok === true && gHijau.band === 'Hijau' && gHijau.skor === 4
      && gHijau.metode_wajib === 'Sederhana', JSON.stringify(gHijau));

  const sent = await rpc('ikp_lapor($1)', [JSON.stringify({
    jenis: 'Sentinel', tgl_kejadian: '2026-08-29 14:00',
    kronologi: 'Pasien jatuh dari tempat tidur, cedera kepala berat.',
    pelapor_nama: 'Ns. B' })]);
  const gSent = await rpc('ikp_grading($1,$2,$3)', [sent.id, 1, 1]);
  cek('K5  sentinel selalu Merah berapa pun angkanya',
      gSent.band === 'Merah' && gSent.metode_wajib === 'RCA',
      JSON.stringify(gSent));

  const tutupTanpaInv = await rpc('ikp_tutup($1)', [anon.id]);
  cek('K6  tidak bisa ditutup tanpa investigasi',
      !!tutupTanpaInv.error && /investigasi/i.test(tutupTanpaInv.error),
      tutupTanpaInv.error);

  await pg.exec(`INSERT INTO public.ikp_investigasi (ikp_id,metode,akar_masalah)
                 VALUES (${sent.id},'Sederhana','pagar tempat tidur tidak terpasang')`);
  const tutupSalahMetode = await rpc('ikp_tutup($1)', [sent.id]);
  cek('K7  band Merah menuntut RCA, bukan investigasi sederhana',
      !!tutupSalahMetode.error && /RCA/i.test(tutupSalahMetode.error),
      tutupSalahMetode.error);

  await pg.exec(`UPDATE public.ikp_investigasi SET metode='RCA' WHERE ikp_id=${sent.id}`);
  const tutupTanpaCapa = await rpc('ikp_tutup($1)', [sent.id]);
  await pg.exec(`INSERT INTO public.ikp_tindakan (ikp_id,jenis,uraian,penanggung_jawab)
                 VALUES (${sent.id},'Korektif','Pasang pagar & audit harian','Karu')`);
  const tutupCapaBelum = await rpc('ikp_tutup($1)', [sent.id]);
  cek('K8  tidak bisa ditutup tanpa CAPA, dan CAPA harus selesai',
      !!tutupTanpaCapa.error && /tindakan perbaikan/i.test(tutupTanpaCapa.error)
      && !!tutupCapaBelum.error && /belum selesai/i.test(tutupCapaBelum.error),
      `${tutupTanpaCapa.error} | ${tutupCapaBelum.error}`);

  await pg.exec(`UPDATE public.ikp_tindakan SET selesai_at=now() WHERE ikp_id=${sent.id}`);
  const tutupOk = await rpc('ikp_tutup($1)', [sent.id]);
  cek('K9  insiden lengkap bisa ditutup', tutupOk.ok === true, JSON.stringify(tutupOk));

  // ═══════════ INDIKATOR MUTU ═══════════
  console.log('\n── Indikator mutu ──');

  const IND = (await satu(`INSERT INTO public.mutu_indikator
      (kode,nama,target,arah_baik,ditetapkan_oleh) VALUES
      ('KPT','Kepatuhan Kebersihan Tangan',85,'naik','Komite Mutu') RETURNING id`)).id;
  const INDT = (await satu(`INSERT INTO public.mutu_indikator
      (kode,nama,target,arah_baik,ditetapkan_oleh) VALUES
      ('IDO','Infeksi Daerah Operasi',2,'turun','Komite Mutu') RETURNING id`)).id;

  const nol = await rpc('mutu_catat($1,$2,$3,$4)', [IND, '2026-08', 0, 0]);
  cek('M1  denominator nol ditolak, bukan dihitung 0%',
      !!nol.error && /tidak ada data/i.test(nol.error), nol.error);

  const naik = await rpc('mutu_catat($1,$2,$3,$4)', [IND, '2026-08', 80, 100]);
  const turun = await rpc('mutu_catat($1,$2,$3,$4)', [INDT, '2026-08', 1, 100]);
  cek('M2  arah "turun" dinilai terbalik dengan benar',
      naik.capaian === 80 && naik.tercapai === false && naik.wajib_analisis === true
      && turun.capaian === 1 && turun.tercapai === true,
      `naik=${naik.capaian}/${naik.tercapai} turun=${turun.capaian}/${turun.tercapai}`);

  // ═══════════ TRIASE & EWS ═══════════
  console.log('\n── Triase, EWS & skrining ──');

  const lvSalah = await rpc('triase_catat($1)', [JSON.stringify({
    patient_name: 'Pasien IGD', keluhan_utama: 'sesak', level: 9,
    petugas_triase: 'Ns. C' })]);
  cek('T1  level triase di luar 1–5 ditolak', !!lvSalah.error, lvSalah.error);

  const tanpaPetugas = await rpc('triase_catat($1)', [JSON.stringify({
    patient_name: 'Pasien IGD', keluhan_utama: 'sesak', level: 2 })]);
  cek('T2  petugas triase wajib diisi', !!tanpaPetugas.error, tanpaPetugas.error);

  const tr = await rpc('triase_catat($1)', [JSON.stringify({
    patient_name: 'Pasien IGD', keluhan_utama: 'sesak napas', level: 2,
    petugas_triase: 'Ns. C', napas: 26, spo2: 92, suhu: 38.5,
    td_sistol: 105, nadi: 115, kesadaran: 'Sadar' })]);
  // napas 26→3, spo2 92→2, suhu 38.5→1, sistol 105→1, nadi 115→2, sadar→0 = 9
  cek('T3  EWS dihitung dan target waktu mengikuti level',
      tr.ok === true && tr.target_menit === 10 && tr.ews.skor === 9
      && tr.ews.tingkat === 'Tinggi' && tr.ews.lengkap === true,
      JSON.stringify(tr.ews));

  const trSalahLevel = await rpc('triase_catat($1)', [JSON.stringify({
    patient_name: 'Pasien Dua', keluhan_utama: 'lemas', level: 5,
    petugas_triase: 'Ns. C', napas: 28, spo2: 90, suhu: 39.5,
    td_sistol: 85, nadi: 135, kesadaran: 'Suara' })]);
  cek('T4  EWS tinggi pada level rendah memunculkan peringatan',
      !!trSalahLevel.peringatan && /tinjau ulang/i.test(trSalahLevel.peringatan),
      trSalahLevel.peringatan);

  const trKurang = await rpc('triase_catat($1)', [JSON.stringify({
    patient_name: 'Pasien Tiga', keluhan_utama: 'pusing', level: 4,
    petugas_triase: 'Ns. C', nadi: 88 })]);
  cek('T5  EWS menandai tanda vital yang belum lengkap',
      trKurang.ews.lengkap === false && /belum lengkap/i.test(trKurang.peringatan || ''),
      `terisi=${trKurang.ews.parameter_terisi}`);

  const skTinggi = await rpc('skrining_catat($1)', [JSON.stringify({
    admission_id: String(ADM), jenis: 'jatuh', instrumen: 'Morse Fall Scale',
    skor: 55, kategori: 'Tinggi', dinilai_oleh: 'Ns. C' })]);
  const skTinggiOk = await rpc('skrining_catat($1)', [JSON.stringify({
    admission_id: String(ADM), jenis: 'jatuh', instrumen: 'Morse Fall Scale',
    skor: 55, kategori: 'Tinggi', tindak_lanjut: 'Pasang gelang kuning, pagar naik',
    dinilai_oleh: 'Ns. C' })]);
  cek('S1  risiko tinggi wajib punya tindak lanjut',
      !!skTinggi.error && skTinggiOk.ok === true, skTinggi.error);

  const tanpaInstrumen = await rpc('skrining_catat($1)', [JSON.stringify({
    admission_id: String(ADM), jenis: 'nyeri', kategori: 'Rendah', skor: 2 })]);
  cek('S2  instrumen wajib disebutkan', !!tanpaInstrumen.error, tanpaInstrumen.error);

  // ═══════════ MAR ═══════════
  console.log('\n── Catatan pemberian obat ──');

  const JD = (await satu(`INSERT INTO public.mar_jadwal
      (admission_id,patient_name,nama_obat,dosis,rute,frekuensi,jam_pemberian)
      VALUES ($1,'Pasien Uji','Ceftriaxone','1 g','IV','2x1','["06:00","18:00"]')
      RETURNING id`, [ADM])).id;

  const tanpaPemberi = await rpc('mar_catat($1,$2,$3,$4,$5)',
    [JD, '2026-08-31', '06:00', 'Diberikan', '']);
  cek('A1  pemberian wajib menyebut pemberi', !!tanpaPemberi.error, tanpaPemberi.error);

  const lewatTanpaAlasan = await rpc('mar_catat($1,$2,$3,$4,$5)',
    [JD, '2026-08-31', '06:00', 'Dilewati', 'Ns. D']);
  cek('A2  yang tidak diberikan wajib beralasan',
      !!lewatTanpaAlasan.error, lewatTanpaAlasan.error);

  const beri1 = await rpc('mar_catat($1,$2,$3,$4,$5)',
    [JD, '2026-08-31', '06:00', 'Diberikan', 'Ns. D']);
  const beri2 = await rpc('mar_catat($1,$2,$3,$4,$5)',
    [JD, '2026-08-31', '06:00', 'Diberikan', 'Ns. E']);
  cek('A3  satu jadwal-jam tidak bisa dicatat dua kali',
      beri1.ok === true && !!beri2.error && /sudah tercatat/i.test(beri2.error),
      beri2.error);

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
