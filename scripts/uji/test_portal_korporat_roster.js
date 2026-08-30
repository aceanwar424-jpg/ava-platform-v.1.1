// ═══════════════════════════════════════════════════════════════
// UJI: Portal korporat bertoken — pengelolaan roster karyawan
//
// Menjalankan migrasi 0028 di atas PGlite bersih, lalu menguji kontrak
// keamanannya. Yang diuji bukan "apakah fungsinya jalan", tapi hal-hal
// yang kalau salah baru ketahuan setelah data klien bocor:
//
//   U1  token hanya-baca DITOLAK menulis
//   U2  penolakan itu TERCATAT di portal_akses_log (tidak ikut ter-rollback)
//   U3  token tidak dikenal ditolak dengan pesan yang sama persis
//   U4  tambah karyawan masuk ke perusahaan pemilik token
//   U5  NIK ganda dalam satu perusahaan ditolak
//   U6  impor melewati baris bermasalah, sisanya tetap masuk
//   U7  assign paket milik perusahaan LAIN ditolak
//   U8  kuota kontrak ditegakkan, bukan sekadar ditampilkan
//   U9  karyawan perusahaan lain tidak bisa disentuh lewat token ini
//   U10 nonaktifkan menandai 'Keluar', tidak menghapus baris
//
// Jalankan: node scripts/uji/test_portal_korporat_roster.js
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

// Skema minimum yang dibutuhkan migrasi 0028. Sengaja ditulis di sini dan
// tidak menarik seluruh berkas skema produksi: uji ini tentang kontrak
// keamanan 0028, dan skema besar hanya menambah sebab kegagalan yang tidak
// ada hubungannya dengan yang sedang diuji.
const SKEMA_DASAR = `
CREATE TABLE public.corporates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corporate_name text, kode_corp text, pic_name text, industry text);

CREATE TABLE public.corporate_contracts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corporate_id bigint REFERENCES public.corporates(id) ON DELETE CASCADE,
  contract_number text, contract_type text, start_date date, end_date date,
  max_peserta int, used_peserta int DEFAULT 0, nilai_kontrak numeric, status text);

CREATE TABLE public.packages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_paket text, nama_paket text NOT NULL, kategori_paket text,
  harga_normal numeric DEFAULT 0, harga_korporat numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  corporate_id bigint REFERENCES public.corporates(id) ON DELETE CASCADE);

CREATE TABLE public.corporate_employees (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corporate_id bigint REFERENCES public.corporates(id) ON DELETE CASCADE,
  corporate_name text, full_name text NOT NULL, employee_id text,
  department text, gender text, birth_date date, phone text, email text,
  status text DEFAULT 'Non-Aktif',
  package_id bigint REFERENCES public.packages(id), package_name text,
  notes text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());

CREATE TABLE public.corp_exam_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corporate_id bigint, booking_batch text, book_date date,
  patient_name text, department text, package_name text, exam_status text);

CREATE TABLE public.invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  corporate_id bigint, invoice_number text, invoice_date date,
  due_date date, total_amount numeric, status text);

CREATE TABLE public.portal_akses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token text UNIQUE, jenis text, ref_id bigint, label text,
  aktif boolean DEFAULT true, berlaku_sampai date,
  created_at timestamptz DEFAULT now(), terakhir_dipakai timestamptz,
  jumlah_akses int DEFAULT 0, token_petunjuk text);

CREATE TABLE public.portal_akses_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  akses_id bigint, jenis text, ref_id bigint,
  berhasil boolean, sebab text, created_at timestamptz DEFAULT now());
`;

(async () => {
  console.log('\n═══ UJI PORTAL KORPORAT — PENGELOLAAN ROSTER ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();          // in-memory, dibuang saat proses selesai
  const q = (sql, args) => pg.query(sql, args);
  const satu = async (sql, args) => (await q(sql, args)).rows[0];

  // Peran Supabase yang tidak ada di Postgres polos. Mesin lokal membuatnya
  // dengan cara yang sama sebelum menjalankan migrasi — lihat
  // desktop-app/electron/local-engine.js:76. Tanpa ini, setiap GRANT di
  // migrasi mana pun akan gagal dan uji ini akan menguji kondisi yang tidak
  // pernah terjadi di produksi.
  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }

  await pg.exec(SKEMA_DASAR);

  const migrasi = fs.readFileSync(
    path.join(AKAR, 'db', 'migrations', '0028_portal_korporat_kelola_karyawan.sql'), 'utf8');
  try {
    await pg.exec(migrasi);
    console.log('  ✅ migrasi 0028 terpasang tanpa galat\n');
    lulus++;
  } catch (e) {
    console.log('  ❌ migrasi 0028 GAGAL:', e.message, '\n');
    gagal++;
    process.exit(1);
  }

  // ── Data uji: dua perusahaan, supaya isolasi antar-tenant bisa diuji ──
  const pt = await satu(
    `INSERT INTO public.corporates (corporate_name, kode_corp, pic_name)
     VALUES ('PT Alfa Nusantara','ALF','Budi') RETURNING id`);
  const ptLain = await satu(
    `INSERT INTO public.corporates (corporate_name, kode_corp, pic_name)
     VALUES ('PT Beta Sejahtera','BET','Sari') RETURNING id`);

  await q(`INSERT INTO public.corporate_contracts
    (corporate_id, contract_number, start_date, end_date, max_peserta, status)
    VALUES ($1,'PKS-001', CURRENT_DATE, CURRENT_DATE + 365, 3, 'Active')`, [pt.id]);

  const pkUmum = await satu(
    `INSERT INTO public.packages (nama_paket, harga_normal) VALUES ('MCU Basic', 500000) RETURNING id`);
  const pkLain = await satu(
    `INSERT INTO public.packages (nama_paket, harga_normal, corporate_id)
     VALUES ('MCU Khusus Beta', 900000, $1) RETURNING id`, [ptLain.id]);

  const tBaca  = 'a'.repeat(48);   // token hanya-baca
  const tTulis = 'b'.repeat(48);   // token boleh kelola
  await q(`INSERT INTO public.portal_akses (token, jenis, ref_id, label, boleh_tulis)
           VALUES ($1,'korporat',$2,'Alfa baca', false)`, [tBaca, pt.id]);
  await q(`INSERT INTO public.portal_akses (token, jenis, ref_id, label, boleh_tulis)
           VALUES ($1,'korporat',$2,'Alfa kelola', true)`, [tTulis, pt.id]);

  const panggil = async (fn, args) =>
    (await satu(`SELECT public.${fn} AS d`, args)).d;

  // ── U1 & U2: tautan hanya-baca ditolak, DAN penolakannya tercatat ──
  const r1 = await panggil('portal_korporat_karyawan_tambah($1,$2)', [tBaca, 'Orang Baru']);
  cek('U1  token hanya-baca ditolak menulis',
      !!r1.error && /hanya dapat melihat/i.test(r1.error), JSON.stringify(r1));

  const log1 = await satu(
    `SELECT count(*)::int n FROM public.portal_akses_log
      WHERE berhasil = false AND sebab = 'tautan hanya-baca'`);
  cek('U2  penolakan tercatat di log (tidak ter-rollback)', log1.n === 1,
      `ditemukan ${log1.n} baris`);

  // ── U3: token tak dikenal → pesan identik dengan token kedaluwarsa ──
  const r3 = await panggil('portal_korporat_karyawan_tambah($1,$2)', ['c'.repeat(48), 'X']);
  cek('U3  token tidak dikenal ditolak dengan pesan generik',
      !!r3.error && /Tautan tidak berlaku atau sudah berakhir/.test(r3.error), JSON.stringify(r3));

  // ── U4: tambah karyawan masuk ke perusahaan pemilik token ──
  const r4 = await panggil('portal_korporat_karyawan_tambah($1,$2,$3,$4)',
    [tTulis, 'Andi Pratama', 'NIK-001', 'Produksi']);
  const kar4 = await satu(
    `SELECT corporate_id, status, full_name FROM public.corporate_employees WHERE id = $1`, [r4.id]);
  cek('U4  karyawan masuk ke perusahaan pemilik token',
      r4.ok === true && String(kar4.corporate_id) === String(pt.id) && kar4.status === 'Non-Aktif',
      JSON.stringify(kar4));

  // ── U5: NIK ganda ditolak ──
  const r5 = await panggil('portal_korporat_karyawan_tambah($1,$2,$3)',
    [tTulis, 'Andi Kembar', 'NIK-001']);
  cek('U5  NIK ganda dalam satu perusahaan ditolak',
      !!r5.error && /sudah terdaftar/i.test(r5.error), JSON.stringify(r5));

  // ── U6: impor melewati yang bermasalah, sisanya masuk ──
  const baris = JSON.stringify([
    { nama: 'Budi Santoso', nik: 'NIK-002', departemen: 'QC' },
    { nama: '',             nik: 'NIK-003' },              // nama kosong → dilewati
    { nama: 'Citra Dewi',   nik: 'NIK-001' },              // NIK ganda   → dilewati
    { nama: 'Dedi Kurnia',  nik: 'NIK-004', departemen: 'Gudang' },
  ]);
  const r6 = await panggil('portal_korporat_karyawan_impor($1,$2::jsonb)', [tTulis, baris]);
  cek('U6  impor: 2 masuk, 2 dilewati beserta alasannya',
      r6.masuk === 2 && Array.isArray(r6.dilewati) && r6.dilewati.length === 2,
      JSON.stringify(r6));

  // ── U7: paket milik perusahaan lain ditolak ──
  const r7 = await panggil('portal_korporat_karyawan_assign($1,$2::bigint,$3::bigint)',
    [tTulis, r4.id, pkLain.id]);
  cek('U7  paket milik perusahaan lain ditolak',
      !!r7.error && /tidak tersedia/i.test(r7.error), JSON.stringify(r7));

  // ── U8: kuota kontrak (3) ditegakkan ──
  const semua = (await q(
    `SELECT id FROM public.corporate_employees WHERE corporate_id = $1 ORDER BY id`, [pt.id])).rows;
  const hasilAssign = [];
  for (const k of semua) {
    hasilAssign.push(await panggil('portal_korporat_karyawan_assign($1,$2::bigint,$3::bigint)',
      [tTulis, k.id, pkUmum.id]));
  }
  const berhasil = hasilAssign.filter(h => h.ok).length;
  const ditolak  = hasilAssign.filter(h => h.error && /Kuota kontrak sudah penuh/i.test(h.error)).length;
  cek('U8  kuota kontrak ditegakkan (3 masuk, sisanya ditolak)',
      berhasil === 3 && ditolak === semua.length - 3,
      `${semua.length} karyawan → ${berhasil} berhasil, ${ditolak} ditolak kuota`);

  // ── U9: karyawan perusahaan lain tidak terjangkau ──
  const karBeta = await satu(
    `INSERT INTO public.corporate_employees (corporate_id, full_name, status)
     VALUES ($1,'Karyawan Beta','Non-Aktif') RETURNING id`, [ptLain.id]);
  const r9 = await panggil('portal_korporat_karyawan_assign($1,$2::bigint,$3::bigint)',
    [tTulis, karBeta.id, pkUmum.id]);
  const betaUtuh = await satu(
    `SELECT package_id, status FROM public.corporate_employees WHERE id = $1`, [karBeta.id]);
  cek('U9  karyawan perusahaan lain tidak bisa disentuh',
      !!r9.error && betaUtuh.package_id === null && betaUtuh.status === 'Non-Aktif',
      JSON.stringify({ r9, betaUtuh }));

  // ── U10: nonaktif = tandai Keluar, bukan hapus ──
  const r10 = await panggil('portal_korporat_karyawan_nonaktif($1,$2::bigint)', [tTulis, r4.id]);
  const kar10 = await satu(
    `SELECT status, package_id FROM public.corporate_employees WHERE id = $1`, [r4.id]);
  cek('U10 nonaktifkan menandai Keluar, baris tetap ada',
      r10.ok === true && kar10 && kar10.status === 'Keluar' && kar10.package_id === null,
      JSON.stringify(kar10));

  // ── Bonus: portal_korporat() mengembalikan roster & paket, tanpa data klinis ──
  const muatan = await panggil('portal_korporat($1)', [tTulis]);
  const kunci = Object.keys(muatan || {});
  const adaKlinis = JSON.stringify(muatan).match(/hasil_lab|diagnosa|icd|nilai_rujukan/i);
  cek('B1  portal_korporat() menyertakan roster & paket_tersedia',
      kunci.includes('karyawan') && kunci.includes('paket_tersedia') && muatan.boleh_tulis === true,
      kunci.join(','));
  cek('B2  muatan portal TIDAK memuat data klinis', !adaKlinis,
      adaKlinis ? 'ditemukan: ' + adaKlinis[0] : '');

  await pg.close();

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
