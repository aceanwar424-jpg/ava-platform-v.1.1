// ═══════════════════════════════════════════════════════════════
// UJI: Antrean — loket, prioritas, dan tindakan panggilan (migrasi 0032)
//
//   T1  migrasi terpasang di atas queue_tickets yang sudah ada
//   T2  prioritas menang atas nomor urut (cito dipanggil lebih dulu)
//   T3  ibu hamil & disabilitas di atas lansia, lansia di atas normal
//   T4  dua loket bersamaan TIDAK mendapat tiket yang sama
//   T5  loket hanya memanggil tiket dari layanannya sendiri
//   T6  panggil ulang menaikkan hitungan, tidak membuat tiket baru
//   T7  'lewati' tidak menutup tiket — masih bisa dikembalikan
//   T8  pindah loket TIDAK mengubah nomor antrean
//   T9  setiap tindakan tercatat di queue_log
//   T10 loket nonaktif ditolak
//
// Jalankan: node scripts/uji/test_antrian_panggilan.js
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

// queue_tickets seperti yang dibuat supabase_fase3.sql.
const SKEMA = `
CREATE TABLE public.queue_tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamp DEFAULT now(),
  queue_date date DEFAULT current_date,
  queue_number text,
  seq integer,
  service_type text,
  admission_id bigint,
  patient_name text,
  status text DEFAULT 'Menunggu',
  counter text,
  called_at timestamp,
  served_at timestamp,
  updated_at timestamp DEFAULT now()
);
`;

(async () => {
  console.log('\n═══ UJI ANTREAN — LOKET, PRIORITAS & PANGGILAN ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu = async (sql, args) => (await pg.query(sql, args)).rows[0];
  const semua = async (sql, args) => (await pg.query(sql, args)).rows;

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }
  await pg.exec(SKEMA);

  try {
    await pg.exec(fs.readFileSync(
      path.join(AKAR, 'db', 'migrations', '0032_antrian_loket_prioritas_panggilan.sql'), 'utf8'));
    cek('T1  migrasi 0032 terpasang', true);
  } catch (e) { cek('T1  migrasi 0032 terpasang', false, e.message); process.exit(1); }

  const rpc = async (fn, args) => (await satu(`SELECT public.${fn} AS d`, args)).d;

  // Dua loket untuk layanan Dokter, satu untuk Lab.
  await pg.exec(`
    INSERT INTO public.queue_counters (kode, nama, layanan, ruang) VALUES
      ('LOKET-1','Loket 1','Dokter','Lantai 1'),
      ('LOKET-2','Loket 2','Dokter','Lantai 1'),
      ('LAB-1','Loket Lab','Lab','Lantai 2'),
      ('TUTUP','Loket Tutup','Dokter',NULL);
    UPDATE public.queue_counters SET is_active = false WHERE kode = 'TUTUP';
  `);

  const tiket = async (no, seq, layanan, prioritas, nama) => (await satu(
    `INSERT INTO public.queue_tickets
       (queue_number, seq, service_type, prioritas, patient_name, status)
     VALUES ($1,$2,$3,$4,$5,'Menunggu') RETURNING id`,
    [no, seq, layanan, prioritas, nama])).id;

  // Sengaja: nomor kecil = normal, nomor besar = prioritas tinggi.
  // Kalau urutan panggil ikut nomor, cito tidak akan pernah didahulukan.
  const A1 = await tiket('A001', 1, 'Dokter', 'normal',      'Normal Satu');
  const A2 = await tiket('A002', 2, 'Dokter', 'lansia',      'Lansia');
  const A3 = await tiket('A003', 3, 'Dokter', 'hamil',       'Ibu Hamil');
  const A4 = await tiket('A004', 4, 'Dokter', 'cito',        'Gawat');
  const A5 = await tiket('A005', 5, 'Dokter', 'disabilitas', 'Disabilitas');
  const L1 = await tiket('L001', 1, 'Lab',    'normal',      'Pasien Lab');

  // ── T2: cito lebih dulu meski nomornya paling belakang ──
  const p1 = await rpc('queue_panggil_berikutnya($1,$2)', ['LOKET-1', 'Uji']);
  cek('T2  prioritas menang atas nomor urut (cito lebih dulu)',
      p1.ok === true && p1.nomor === 'A004', JSON.stringify(p1));

  // ── T3: urutan berikutnya hamil/disabilitas → lansia → normal ──
  const urut = [p1.nomor];
  for (let i = 0; i < 4; i++) {
    const r = await rpc('queue_panggil_berikutnya($1,$2)', ['LOKET-1', 'Uji']);
    if (r.ok) urut.push(r.nomor);
  }
  // A003 (hamil) & A005 (disabilitas) berbobot sama → urutan di antara
  // keduanya ditentukan seq, jadi A003 lebih dulu.
  cek('T3  urutan prioritas benar: cito, hamil, disabilitas, lansia, normal',
      JSON.stringify(urut) === JSON.stringify(['A004','A003','A005','A002','A001']),
      urut.join(' → '));

  // ── T4: dua loket bersamaan tidak dapat tiket sama ──
  await pg.exec(`UPDATE public.queue_tickets SET status='Menunggu', jml_panggil=0
                  WHERE service_type='Dokter'`);
  const [a, b] = await Promise.all([
    rpc('queue_panggil_berikutnya($1,$2)', ['LOKET-1', 'A']),
    rpc('queue_panggil_berikutnya($1,$2)', ['LOKET-2', 'B']),
  ]);
  cek('T4  dua loket bersamaan mendapat tiket BERBEDA',
      a.ok && b.ok && a.id !== b.id, `${a.nomor} vs ${b.nomor}`);

  // ── T5: loket Lab tidak boleh mengambil antrean Dokter ──
  const pLab = await rpc('queue_panggil_berikutnya($1,$2)', ['LAB-1', 'Uji']);
  cek('T5  loket hanya memanggil layanannya sendiri',
      pLab.ok === true && pLab.nomor === 'L001', JSON.stringify(pLab));

  // ── T6: panggil ulang menaikkan hitungan ──
  const u1 = await rpc('queue_panggil_ulang($1,$2)', [a.id, 'Uji']);
  const u2 = await rpc('queue_panggil_ulang($1,$2)', [a.id, 'Uji']);
  const jml = (await satu(`SELECT jml_panggil FROM public.queue_tickets WHERE id=$1`, [a.id])).jml_panggil;
  cek('T6  panggil ulang menaikkan hitungan (1 → 3)',
      u1.ok && u2.ok && Number(jml) === 3, `jml_panggil=${jml}`);

  // ── T7: lewati lalu kembalikan ──
  const lw = await rpc('queue_lewati($1,$2,$3)', [a.id, 'tidak muncul', 'Uji']);
  const st1 = (await satu(`SELECT status FROM public.queue_tickets WHERE id=$1`, [a.id])).status;
  const kb = await rpc('queue_kembalikan($1,$2)', [a.id, 'Uji']);
  const st2 = (await satu(`SELECT status FROM public.queue_tickets WHERE id=$1`, [a.id])).status;
  cek('T7  lewati tidak menutup tiket dan bisa dikembalikan',
      lw.ok && st1 === 'Lewat' && kb.ok && st2 === 'Menunggu', `${st1} → ${st2}`);

  // ── T8: pindah loket tidak mengubah nomor ──
  const sebelum = (await satu(`SELECT queue_number FROM public.queue_tickets WHERE id=$1`, [a.id])).queue_number;
  const pd = await rpc('queue_pindah($1,$2,$3)', [a.id, 'LAB-1', 'Uji']);
  const sesudah = await satu(
    `SELECT queue_number, counter, service_type, pindah_dari FROM public.queue_tickets WHERE id=$1`, [a.id]);
  cek('T8  pindah loket TIDAK mengubah nomor antrean',
      pd.ok && sesudah.queue_number === sebelum
      && sesudah.counter === 'Loket Lab' && sesudah.service_type === 'Lab',
      JSON.stringify(sesudah));

  // ── T9: jejak tercatat ──
  const log = await semua(
    `SELECT tindakan FROM public.queue_log WHERE ticket_id=$1 ORDER BY id`, [a.id]);
  const tindakan = log.map(x => x.tindakan);
  cek('T9  setiap tindakan tercatat di queue_log',
      ['panggil','panggil_ulang','panggil_ulang','lewati','kembalikan','pindah']
        .every(t => tindakan.includes(t)),
      tindakan.join(', '));

  // ── T10: loket nonaktif ditolak ──
  const mati = await rpc('queue_panggil_berikutnya($1,$2)', ['TUTUP', 'Uji']);
  cek('T10 loket nonaktif ditolak', !!mati.error, JSON.stringify(mati));

  // ── Bonus: view papan hanya berisi hari ini ──
  const papan = await semua(`SELECT * FROM public.queue_papan`);
  cek('B1  view queue_papan terbaca dan berisi tiket hari ini',
      papan.length === 6, `${papan.length} baris`);

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
