// ═══════════════════════════════════════════════════════════════
// UJI: Wellness (produk/stok/pesanan), Sanctuary, dan Pabrik
//      migrasi 0034 – 0037
//
//   W1  keempat migrasi terpasang di atas skema yang sudah ada
//   W2  batch baru masuk KARANTINA, tidak langsung bisa dijual
//   W3  FEFO — yang paling dekat kedaluwarsa keluar lebih dulu
//   W4  stok kurang ditolak sebelum ada batch yang terpotong
//   W5  batch ditolak tidak bisa terambil lagi
//   W6  harga pesanan diambil dari master kanal, bukan dari klien
//   W7  kemas dua kali tidak memotong stok dua kali
//   W8  kemas gagal di barang kedua → potongan barang pertama batal
//   S1  terapis tanpa kompetensi ditolak
//   S2  terapis bentrok jam ditolak
//   S3  sesi yang bersambung (selesai = mulai) TIDAK dianggap bentrok
//   S4  saldo sesi kurang ditolak
//   S5  saldo dipotong saat SELESAI, bukan saat memesan
//   S6  pembatalan biasa MENOLAK sesi yang sudah ditutup
//   S7  koreksi sesi tertutup wajib beralasan & mengembalikan sesi
//   P1  kebutuhan bahan dihitung dengan susut
//   P2  produksi tanpa bahan cukup ditolak
//   P3  produksi memotong bahan baku dan mencatat di stock_ledger
//   P4  batch belum lulus selama masih ada uji yang tertunda
//   P5  seluruh uji lulus → batch keluar karantina
//   P6  satu uji tidak lulus → batch ditolak
//   P7  hasil maklon TIDAK masuk stok sendiri
//
// Jalankan: node scripts/uji/test_wellness_pabrik.js
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

// Prasyarat yang sudah ada di repo (database.sql / arsip logistik).
const PRASYARAT = `
CREATE TABLE public.employees (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name text NOT NULL, nik text UNIQUE, position text, division text,
  status text DEFAULT 'Aktif', created_at timestamp DEFAULT now());

CREATE TABLE public.inventory_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_code text, item_name text NOT NULL, unit text DEFAULT 'pcs',
  stock_qty numeric DEFAULT 0, unit_price numeric DEFAULT 0,
  updated_at timestamp DEFAULT now());

CREATE TABLE public.stock_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint, item_code text, item_name text, movement_type text,
  qty numeric DEFAULT 0, balance_after numeric DEFAULT 0, unit_price numeric DEFAULT 0,
  ref_type text, ref_id bigint, ref_number text, notes text, created_by text,
  created_at timestamp DEFAULT now());
`;

(async () => {
  console.log('\n═══ UJI WELLNESS · SANCTUARY · PABRIK (0034–0037) ═══\n');

  const { PGlite } = await import(
    'file://' + path.join(PGLITE, 'dist', 'index.js').replace(/\\/g, '/'));
  const pg = new PGlite();
  const satu  = async (s, a) => (await pg.query(s, a)).rows[0];
  const semua = async (s, a) => (await pg.query(s, a)).rows;
  const rpc   = async (s, a) => (await satu(`SELECT public.${s} AS d`, a)).d;

  for (const r of ['anon', 'authenticated', 'service_role']) {
    try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {}
  }
  await pg.exec(PRASYARAT);

  const MIGRASI = [
    '0034_wellness_produk_batch_stok.sql',
    '0035_wellness_pesanan_d2c.sql',
    '0036_sanctuary_reservasi_member.sql',
    '0037_pabrik_produksi_maklon.sql',
  ];
  try {
    for (const m of MIGRASI) {
      await pg.exec(fs.readFileSync(path.join(AKAR, 'db', 'migrations', m), 'utf8'));
    }
    cek('W1  migrasi 0034–0037 terpasang', true);
  } catch (e) { cek('W1  migrasi 0034–0037 terpasang', false, e.message); process.exit(1); }

  // ═══════════════ WELLNESS — STOK & FEFO ═══════════════
  console.log('\n── Wellness: stok & FEFO ──');

  const P1 = (await satu(`INSERT INTO public.wellness_produk
      (sku,nama,merek,masa_simpan_bulan,harga_normal) VALUES
      ('AVA-N01','Kapsul Herbal','AVA Nutrition',24,120000) RETURNING id`)).id;
  const P2 = (await satu(`INSERT INTO public.wellness_produk
      (sku,nama,merek,harga_normal) VALUES
      ('AVA-C01','Feminine Wash','AVA Care',85000) RETURNING id`)).id;

  const b1 = await rpc('wellness_terima_batch($1,$2,$3,$4,$5)',
    [P1, 'B-LAMA', 50, '2026-01-10', '2026-12-31']);
  const b2 = await rpc('wellness_terima_batch($1,$2,$3,$4,$5)',
    [P1, 'B-BARU', 50, '2026-02-10', '2027-06-30']);

  const stok0 = await satu(`SELECT * FROM public.wellness_stok WHERE produk_id=$1`, [P1]);
  cek('W2  batch baru masuk KARANTINA, belum bisa dijual',
      Number(stok0.stok_siap_jual) === 0 && Number(stok0.stok_karantina) === 100,
      `siap=${stok0.stok_siap_jual} karantina=${stok0.stok_karantina}`);

  await rpc('wellness_putuskan_batch($1,$2)', [b1.batch_id, 'lulus']);
  await rpc('wellness_putuskan_batch($1,$2)', [b2.batch_id, 'lulus']);

  // Minta 60: harus habiskan B-LAMA (50, exp lebih dulu) lalu 10 dari B-BARU.
  const amb = await rpc('wellness_ambil_stok($1,$2)', [P1, 60]);
  const urutBatch = (amb.batch || []).map(x => `${x.no_batch}:${x.qty}`);
  cek('W3  FEFO — kedaluwarsa terdekat keluar lebih dulu',
      JSON.stringify(urutBatch) === JSON.stringify(['B-LAMA:50', 'B-BARU:10']),
      urutBatch.join(' , '));

  const kurang = await rpc('wellness_ambil_stok($1,$2)', [P1, 999]);
  const sisaSetelahGagal = (await satu(
    `SELECT COALESCE(SUM(qty_sisa),0) s FROM public.wellness_batch WHERE produk_id=$1`, [P1])).s;
  cek('W4  stok kurang ditolak TANPA memotong batch mana pun',
      !!kurang.error && Number(sisaSetelahGagal) === 40,
      `error=${kurang.error} sisa=${sisaSetelahGagal}`);

  await rpc('wellness_putuskan_batch($1,$2,$3)', [b2.batch_id, 'ditolak', 'uji gagal']);
  const setelahTolak = await rpc('wellness_ambil_stok($1,$2)', [P1, 1]);
  cek('W5  batch yang ditolak tidak bisa terambil lagi',
      !!setelahTolak.error, JSON.stringify(setelahTolak));

  // ═══════════════ WELLNESS — PESANAN ═══════════════
  console.log('\n── Wellness: pesanan D2C ──');

  await pg.exec(`INSERT INTO public.wellness_harga_kanal (produk_id,kanal,harga)
                 VALUES (${P2},'shopee',99000)`);
  const bP2 = await rpc('wellness_terima_batch($1,$2,$3)', [P2, 'C-001', 20]);
  await rpc('wellness_putuskan_batch($1,$2)', [bP2.batch_id, 'lulus']);

  // Klien mengirim harga 1 rupiah — harus diabaikan.
  const ps = await rpc('wellness_buat_pesanan($1)', [JSON.stringify({
    kanal: 'shopee', no_kanal: 'SPX-1', pembeli_nama: 'Uji',
    item: [{ produk_id: P2, qty: 2, harga: 1 }],
  })]);
  const itemHarga = (await satu(
    `SELECT harga, subtotal FROM public.wellness_pesanan_item WHERE pesanan_id=$1`, [ps.id]));
  cek('W6  harga diambil dari master kanal, bukan dari klien',
      Number(itemHarga.harga) === 99000 && Number(itemHarga.subtotal) === 198000,
      `harga=${itemHarga.harga}`);

  await rpc('wellness_kemas_pesanan($1)', [ps.id]);
  const kemas2 = await rpc('wellness_kemas_pesanan($1)', [ps.id]);
  const sisaP2 = (await satu(
    `SELECT COALESCE(SUM(qty_sisa),0) s FROM public.wellness_batch WHERE produk_id=$1`, [P2])).s;
  cek('W7  kemas dua kali tidak memotong stok dua kali',
      !!kemas2.error && Number(sisaP2) === 18, `sisa=${sisaP2} err=${kemas2.error}`);

  // Pesanan dengan barang kedua yang stoknya tidak cukup.
  const ps2 = await rpc('wellness_buat_pesanan($1)', [JSON.stringify({
    kanal: 'web', pembeli_nama: 'Uji2',
    item: [{ produk_id: P2, qty: 2 }, { produk_id: P1, qty: 9999 }],
  })]);
  let gagalKemas = null;
  try { await rpc('wellness_kemas_pesanan($1)', [ps2.id]); }
  catch (e) { gagalKemas = e.message; }
  const sisaP2b = (await satu(
    `SELECT COALESCE(SUM(qty_sisa),0) s FROM public.wellness_batch WHERE produk_id=$1`, [P2])).s;
  cek('W8  gagal di barang kedua → potongan barang pertama ikut batal',
      !!gagalKemas && Number(sisaP2b) === 18,
      `sisa=${sisaP2b} (harus tetap 18)`);

  // ═══════════════ SANCTUARY ═══════════════
  console.log('\n── Sanctuary: reservasi & saldo sesi ──');

  const E1 = (await satu(`INSERT INTO public.employees (full_name,position)
      VALUES ('Terapis Satu','Terapis') RETURNING id`)).id;
  const T1 = (await satu(`INSERT INTO public.spa_terapis (employee_id,nama)
      VALUES ($1,'Terapis Satu') RETURNING id`, [E1])).id;
  const TR1 = (await satu(`INSERT INTO public.spa_treatment
      (kode,nama,durasi_menit,harga,sesi_terpakai) VALUES
      ('RATUS','Empress Ratus',60,350000,1) RETURNING id`)).id;
  const TR2 = (await satu(`INSERT INTO public.spa_treatment
      (kode,nama,durasi_menit,harga) VALUES ('PELVIC','Pelvic Reformer',60,400000) RETURNING id`)).id;
  const RM1 = (await satu(`INSERT INTO public.spa_ruangan (kode,nama)
      VALUES ('R1','Ruang Melati') RETURNING id`)).id;
  const M1 = (await satu(`INSERT INTO public.spa_member (no_member,nama)
      VALUES ('MB-001','Member Uji') RETURNING id`)).id;

  const tanpaKompetensi = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR1, terapis_id: T1, ruangan_id: RM1, mulai: '2026-09-01 10:00',
  })]);
  cek('S1  terapis tanpa kompetensi ditolak',
      !!tanpaKompetensi.error, JSON.stringify(tanpaKompetensi));

  await pg.exec(`INSERT INTO public.spa_terapis_kompetensi (terapis_id,treatment_id)
                 VALUES (${T1},${TR1}),(${T1},${TR2})`);

  const r1 = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR1, terapis_id: T1, ruangan_id: RM1,
    mulai: '2026-09-01 10:00', tamu_nama: 'Tamu A',
  })]);
  const bentrok = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR2, terapis_id: T1, mulai: '2026-09-01 10:30', tamu_nama: 'Tamu B',
  })]);
  cek('S2  terapis bentrok jam ditolak',
      r1.ok === true && !!bentrok.error, JSON.stringify(bentrok));

  const bersambung = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR2, terapis_id: T1, mulai: '2026-09-01 11:00', tamu_nama: 'Tamu C',
  })]);
  cek('S3  sesi bersambung (11:00 tepat setelah 10:00–11:00) diterima',
      bersambung.ok === true, JSON.stringify(bersambung));

  const saldoKurang = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR1, terapis_id: T1, member_id: M1,
    mulai: '2026-09-02 10:00', bayar_dengan: 'sesi',
  })]);
  cek('S4  saldo sesi kurang ditolak', !!saldoKurang.error, JSON.stringify(saldoKurang));

  await rpc('spa_beli_paket_sesi($1,$2,$3)', [M1, 10, 3000000]);
  const rSesi = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR1, terapis_id: T1, member_id: M1,
    mulai: '2026-09-02 10:00', bayar_dengan: 'sesi',
  })]);
  const saldoSetelahPesan = (await satu(
    `SELECT sesi_tersisa FROM public.spa_saldo WHERE member_id=$1`, [M1])).sesi_tersisa;
  await rpc('spa_selesaikan_sesi($1)', [rSesi.id]);
  const saldoSetelahSelesai = (await satu(
    `SELECT sesi_tersisa FROM public.spa_saldo WHERE member_id=$1`, [M1])).sesi_tersisa;
  cek('S5  saldo dipotong saat SELESAI, bukan saat memesan',
      Number(saldoSetelahPesan) === 10 && Number(saldoSetelahSelesai) === 9,
      `pesan=${saldoSetelahPesan} selesai=${saldoSetelahSelesai}`);

  const rBatal = await rpc('spa_buat_reservasi($1)', [JSON.stringify({
    treatment_id: TR1, terapis_id: T1, member_id: M1,
    mulai: '2026-09-03 10:00', bayar_dengan: 'sesi',
  })]);
  await rpc('spa_selesaikan_sesi($1)', [rBatal.id]);
  const sblmBatal = (await satu(
    `SELECT sesi_tersisa FROM public.spa_saldo WHERE member_id=$1`, [M1])).sesi_tersisa;
  // Batal biasa HARUS menolak sesi yang sudah ditutup — membatalkannya
  // diam-diam akan menghapus jejak bahwa layanan tercatat diberikan.
  const batalDitolak = await rpc('spa_batal_reservasi($1,$2)', [rBatal.id, 'salah input']);
  const stlhBatal = (await satu(
    `SELECT sesi_tersisa FROM public.spa_saldo WHERE member_id=$1`, [M1])).sesi_tersisa;
  cek('S6  pembatalan biasa menolak sesi yang sudah ditutup',
      !!batalDitolak.error && Number(stlhBatal) === 8,
      `err=${batalDitolak.error} saldo=${stlhBatal}`);

  const tanpaAlasan = await rpc('spa_koreksi_sesi_selesai($1,$2)', [rBatal.id, '']);
  const kor = await rpc('spa_koreksi_sesi_selesai($1,$2,$3)',
    [rBatal.id, 'petugas salah menutup sesi', 'Spv']);
  const stlhKoreksi = (await satu(
    `SELECT sesi_tersisa FROM public.spa_saldo WHERE member_id=$1`, [M1])).sesi_tersisa;
  const jejak = (await satu(
    `SELECT count(*) n FROM public.spa_saldo_mutasi
      WHERE reservasi_id=$1 AND jenis='kembali'`, [rBatal.id])).n;
  cek('S7  koreksi wajib beralasan, mengembalikan sesi, dan meninggalkan jejak',
      !!tanpaAlasan.error && kor.ok === true
      && Number(sblmBatal) === 8 && Number(stlhKoreksi) === 9 && Number(jejak) === 1,
      `saldo ${sblmBatal}→${stlhKoreksi}, mutasi kembali=${jejak}`);

  // ═══════════════ PABRIK ═══════════════
  console.log('\n── Pabrik: produksi, maklon & uji mutu ──');

  const I1 = (await satu(`INSERT INTO public.inventory_items
      (item_code,item_name,unit,stock_qty,unit_price)
      VALUES ('BB-01','Ekstrak Herbal','gram',10000,50) RETURNING id`)).id;
  const I2 = (await satu(`INSERT INTO public.inventory_items
      (item_code,item_name,unit,stock_qty,unit_price)
      VALUES ('BB-02','Cangkang Kapsul','pcs',100,20) RETURNING id`)).id;

  const F1 = (await satu(`INSERT INTO public.pabrik_formula
      (kode,versi,nama,produk_id,batch_standar,satuan_batch,status)
      VALUES ('FM-01',1,'Kapsul Herbal v1',$1,1000,'kapsul','Disetujui') RETURNING id`, [P1])).id;
  await pg.exec(`INSERT INTO public.pabrik_bom (formula_id,item_id,nama_bahan,qty,satuan,susut_pct)
    VALUES (${F1},${I1},'Ekstrak Herbal',500,'gram',10),
           (${F1},${I2},'Cangkang Kapsul',1000,'pcs',0)`);

  // 2000 kapsul = faktor 2 → ekstrak 500*2*1.1 = 1100, cangkang 1000*2 = 2000
  const cekBahan = await rpc('pabrik_cek_bahan($1,$2)', [F1, 2000]);
  const ekstrak = cekBahan.bahan.find(b => b.item_id === I1);
  cek('P1  kebutuhan bahan dihitung dengan susut (500×2×1,1 = 1100)',
      Number(ekstrak.butuh) === 1100, JSON.stringify(ekstrak));

  const WO1 = (await satu(`INSERT INTO public.pabrik_wo
      (no_wo,formula_id,produk_id,qty_rencana,status)
      VALUES ('WO-001',$1,$2,2000,'Direncanakan') RETURNING id`, [F1, P1])).id;
  const kurangBahan = await rpc('pabrik_mulai_produksi($1)', [WO1]);
  cek('P2  produksi ditolak saat bahan tidak cukup (cangkang 100 < 2000)',
      !!kurangBahan.error, kurangBahan.error);

  await pg.exec(`UPDATE public.inventory_items SET stock_qty=5000 WHERE id=${I2}`);
  const mulai = await rpc('pabrik_mulai_produksi($1,$2)', [WO1, 'Operator A']);
  const sisaEkstrak = (await satu(
    `SELECT stock_qty FROM public.inventory_items WHERE id=$1`, [I1])).stock_qty;
  const ledger = await semua(
    `SELECT * FROM public.stock_ledger WHERE ref_id=$1 AND ref_type='produksi'`, [WO1]);
  cek('P3  produksi memotong bahan & mencatat di stock_ledger',
      mulai.ok === true && Number(sisaEkstrak) === 8900 && ledger.length === 2,
      `ekstrak=${sisaEkstrak} ledger=${ledger.length}`);

  const selesai = await rpc('pabrik_selesai_produksi($1,$2,$3)', [WO1, 1900, 'BATCH-A']);
  // HPP = (1100×50 + 2000×20) / 1900 = (55000+40000)/1900 = 50
  cek('P3b hasil produksi jadi batch karantina dengan HPP dari bahan nyata',
      selesai.ok === true && Number(selesai.hpp_per_unit) === 50
      && selesai.batch.status === 'Karantina',
      JSON.stringify({ hpp: selesai.hpp_per_unit, rendemen: selesai.rendemen_pct }));

  const batchA = selesai.batch.batch_id;
  const U1 = (await satu(`INSERT INTO public.pabrik_uji_mutu
      (no_uji,batch_id,wo_id,jenis_uji) VALUES ('UJI-1',$1,$2,'Mikrobiologi') RETURNING id`,
      [batchA, WO1])).id;
  const U2 = (await satu(`INSERT INTO public.pabrik_uji_mutu
      (no_uji,batch_id,wo_id,jenis_uji) VALUES ('UJI-2',$1,$2,'Kadar Bahan Aktif') RETURNING id`,
      [batchA, WO1])).id;

  const uji1 = await rpc('pabrik_catat_uji($1,$2)', [U1, 'lulus']);
  const stBatch1 = (await satu(
    `SELECT status FROM public.wellness_batch WHERE id=$1`, [batchA])).status;
  cek('P4  batch tetap karantina selama masih ada uji tertunda',
      uji1.batch === 'Karantina' && stBatch1 === 'Karantina',
      `${uji1.batch} / ${stBatch1}`);

  await rpc('pabrik_catat_uji($1,$2)', [U2, 'lulus']);
  const stBatch2 = (await satu(
    `SELECT status FROM public.wellness_batch WHERE id=$1`, [batchA])).status;
  cek('P5  seluruh uji lulus → batch keluar karantina', stBatch2 === 'Lulus', stBatch2);

  // Batch kedua, satu ujinya gagal.
  const b3 = await rpc('wellness_terima_batch($1,$2,$3)', [P1, 'BATCH-B', 100]);
  const U3 = (await satu(`INSERT INTO public.pabrik_uji_mutu
      (no_uji,batch_id,jenis_uji) VALUES ('UJI-3',$1,'Logam Berat') RETURNING id`,
      [b3.batch_id])).id;
  await rpc('pabrik_catat_uji($1,$2,$3)', [U3, 'tidak lulus', 'Timbal di atas ambang']);
  const b3st = await satu(
    `SELECT status, qty_sisa FROM public.wellness_batch WHERE id=$1`, [b3.batch_id]);
  cek('P6  satu uji tidak lulus → batch ditolak dan sisanya dinolkan',
      b3st.status === 'Ditolak' && Number(b3st.qty_sisa) === 0, JSON.stringify(b3st));

  // Maklon
  const MK = (await satu(`INSERT INTO public.pabrik_maklon
      (no_kontrak,klien_nama,merek_klien,formula_id,qty_kontrak,status)
      VALUES ('MK-01','PT Mitra Sehat','SehatKu',$1,500,'Produksi') RETURNING id`, [F1])).id;
  const WO2 = (await satu(`INSERT INTO public.pabrik_wo
      (no_wo,formula_id,produk_id,qty_rencana,maklon_id,status)
      VALUES ('WO-002',$1,$2,500,$3,'Direncanakan') RETURNING id`, [F1, P1, MK])).id;
  await rpc('pabrik_mulai_produksi($1)', [WO2]);
  const stokSebelumMaklon = (await satu(
    `SELECT stok_karantina FROM public.wellness_stok WHERE produk_id=$1`, [P1])).stok_karantina;
  const mk = await rpc('pabrik_selesai_produksi($1,$2)', [WO2, 480]);
  const stokSesudahMaklon = (await satu(
    `SELECT stok_karantina FROM public.wellness_stok WHERE produk_id=$1`, [P1])).stok_karantina;
  const terkirim = (await satu(
    `SELECT qty_terkirim FROM public.pabrik_maklon WHERE id=$1`, [MK])).qty_terkirim;
  cek('P7  hasil maklon TIDAK masuk stok sendiri, tercatat di kontrak klien',
      mk.ok === true && Number(stokSebelumMaklon) === Number(stokSesudahMaklon)
      && Number(terkirim) === 480,
      `stok ${stokSebelumMaklon}→${stokSesudahMaklon}, terkirim=${terkirim}`);

  await pg.close();
  console.log(`\n─────────────────────────────────────────`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`─────────────────────────────────────────\n`);
  process.exit(gagal ? 1 : 0);
})().catch(e => { console.error('\nGALAT UJI:', e); process.exit(1); });
