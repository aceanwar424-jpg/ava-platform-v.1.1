// ═══════════════════════════════════════════════════════════════
// MODULE: Pusat Kendali Operasional
//
// Dasbor yang ada hanya berorientasi penjualan (leads, deals, invoices).
// Tidak ada satu layar pun yang menjawab pertanyaan paling sering diucapkan
// di lantai operasional: "apa yang perlu ditangani SEKARANG?"
// Akibatnya petugas membuka enam layar bergantian untuk menyusunnya sendiri
// — setiap pagi, setiap shift.
//
// ── Prinsip layar ini ────────────────────────────────────────
// Bukan laporan, melainkan DAFTAR TINDAKAN. Tiap angka harus bisa dijawab
// dengan "siapa mengerjakan apa berikutnya". Angka yang tidak bisa
// ditindaklanjuti sengaja tidak ditampilkan di sini.
//
// Prefiks "ops" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

let opsData = null;
let opsAmbang = 4;      // jam — batas "tertahan"
let opsTimer = null;

const opsRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

async function renderOpsKendali() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Pusat Kendali Operasional</h1>
        <p style="color:var(--text3);font-size:13px">
          Apa yang perlu ditangani sekarang — lintas lab, klinik, stok, dan tagihan</p></div>
      <div class="btn-row">
        <select id="ops-ambang" onchange="opsUbahAmbang(this.value)"
          style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
                 padding:6px 10px;font-size:12px;color:var(--text)">
          <option value="2">Tertahan > 2 jam</option>
          <option value="4" selected>Tertahan > 4 jam</option>
          <option value="8">Tertahan > 8 jam</option>
          <option value="24">Tertahan > 24 jam</option>
        </select>
        <label style="font-size:12px;color:var(--text3);display:flex;align-items:center;gap:5px">
          <input type="checkbox" id="ops-live" onchange="opsToggleLive(this.checked)"> Segarkan otomatis
        </label>
        <button class="btn btn-teal btn-sm" onclick="opsSegarkan()">Muat Ulang</button>
      </div>
    </div>
    <div id="ops-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await opsSegarkan();
}

async function opsSegarkan() {
  try {
    const d = await sbRpc('ops_kendali', { p_ambang_jam: opsAmbang });
    opsData = (d && typeof d === 'object') ? d : null;
  } catch (e) { opsData = { _galat: e.message || String(e) }; }
  opsGambar();
}

function opsUbahAmbang(v) { opsAmbang = parseInt(v, 10) || 4; opsSegarkan(); }

function opsToggleLive(on) {
  if (opsTimer) { clearInterval(opsTimer); opsTimer = null; }
  // 60 detik: cukup untuk lantai operasional, tanpa memukul basis data terus.
  if (on) opsTimer = setInterval(opsSegarkan, 60000);
}

function opsGambar() {
  const el = document.getElementById('ops-isi');
  if (!el) { if (opsTimer) { clearInterval(opsTimer); opsTimer = null; } return; }

  if (opsData && opsData._galat) {
    el.innerHTML = `<div class="card" style="padding:18px;border-color:var(--danger-tint)">
      <strong style="color:var(--danger-strong)">Gagal memuat</strong>
      <div style="font-size:12.5px;color:var(--text3);margin-top:6px">${opsData._galat}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:8px">
        Jalankan migrasi <code>0013_kendali_ops_corong.sql</code> bila fungsi belum tersedia.</div></div>`;
    return;
  }
  if (!opsData) { el.innerHTML = ''; return; }

  const s = opsData.sampel || {}, h = opsData.hasil || {}, k = opsData.kunjungan || {},
        st = opsData.stok || {}, u = opsData.keuangan || {};
  const tertahan = opsData.tertahan_terlama || [];

  // Kartu disusun menurut MENDESAK, bukan menurut modul. Yang menahan
  // pasien dan yang menahan uang naik ke atas.
  const kartu = [
    ['Sampel tertahan', s.tertahan, `> ${opsAmbang} jam belum ada hasil`, 'lab', s.tertahan > 0],
    ['Menunggu validasi', h.menunggu_validasi, 'hasil siap divalidasi', 'lab', h.menunggu_validasi > 0],
    ['Menunggu approval', h.menunggu_approval, 'sudah divalidasi', 'lab', h.menunggu_approval > 0],
    ['Belum bayar', k.belum_bayar, 'kunjungan belum lunas', 'cashier', k.belum_bayar > 0],
    ['Tagihan lewat tempo', u.tagihan_lewat_tempo, opsRp(u.nilai_lewat_tempo), 'ar-aging', u.tagihan_lewat_tempo > 0],
    ['Stok di bawah minimum', st.di_bawah_minimum, `${st.habis || 0} item habis`, 'inventory', st.di_bawah_minimum > 0],
  ];

  const totalPerhatian = kartu.filter(c => c[4]).length;

  el.innerHTML = `
    <div class="card" style="padding:13px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;
      border-color:${totalPerhatian ? 'var(--gold)' : 'var(--success-strong)'}">
      <span style="width:10px;height:10px;border-radius:50%;
        background:${totalPerhatian ? 'var(--gold)' : 'var(--success-strong)'}"></span>
      <strong style="font-size:14px">${totalPerhatian
        ? `${totalPerhatian} hal perlu perhatian`
        : 'Tidak ada yang menunggu tindakan'}</strong>
      <span style="margin-left:auto;font-size:11.5px;color:var(--text3)">
        diperbarui ${new Date(opsData.diambil_pada || Date.now()).toLocaleTimeString('id-ID')}</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px">
      ${kartu.map(([label, nilai, sub, tujuan, perhatian]) => `
        <div class="card" onclick="navigate('${tujuan}')" style="padding:14px;cursor:pointer;
             border-color:${perhatian ? 'var(--gold)' : 'var(--border)'};
             transition:border-color var(--dur,.22s) var(--ease,ease)">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${label}</div>
          <div style="font-size:24px;font-weight:800;margin-top:2px;
               color:${perhatian ? 'var(--danger-strong)' : 'var(--text2)'}">${Number(nilai || 0)}</div>
          <div style="font-size:11.5px;color:var(--text3)">${sub}</div>
        </div>`).join('')}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:14px">
      ${opsRingkas('Alur Sampel Hari Ini', [
        ['Belum diterima', s.belum_diterima], ['Sedang diproses', s.diproses],
        ['Ditolak hari ini', s.ditolak_hari_ini]])}
      ${opsRingkas('Hasil', [
        ['Menunggu validasi', h.menunggu_validasi], ['Menunggu approval', h.menunggu_approval],
        ['Selesai hari ini', h.selesai_hari_ini]])}
      ${opsRingkas('Kunjungan', [
        ['Hari ini', k.hari_ini], ['Belum bayar', k.belum_bayar]])}
    </div>

    ${tertahan.length ? `<div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;font-weight:700">Sampel tertahan terlama</span>
        <span style="font-size:11.5px;color:var(--text3);margin-left:8px">
          sudah diterima tapi belum ada hasil</span></div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="color:var(--text3);text-align:left">
          <th style="padding:9px 16px">Barcode</th><th>Pasien</th>
          <th>Pemeriksaan</th><th style="padding-right:16px;text-align:right">Tertahan</th></tr></thead>
        <tbody>${tertahan.map(t => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:9px 16px;font-family:monospace">${t.barcode || '—'}</td>
          <td>${t.pasien || '—'}</td>
          <td style="color:var(--text3)">${t.pemeriksaan || '—'}</td>
          <td style="padding-right:16px;text-align:right;font-weight:700;color:var(--danger-strong)">
            ${t.jam} jam</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card" style="padding:20px;text-align:center;color:var(--text3);font-size:12.5px">
           Tidak ada sampel yang tertahan lebih dari ${opsAmbang} jam.</div>`}`;
}

function opsRingkas(judul, baris) {
  return `<div class="card" style="padding:14px">
    <div style="font-size:12.5px;font-weight:700;margin-bottom:8px">${judul}</div>
    ${baris.map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;
        border-bottom:1px solid var(--border);font-size:12.5px">
        <span style="color:var(--text3)">${l}</span>
        <strong>${Number(v || 0)}</strong></div>`).join('')}</div>`;
}

window.renderOpsKendali = renderOpsKendali;
window.opsSegarkan = opsSegarkan;
window.opsUbahAmbang = opsUbahAmbang;
window.opsToggleLive = opsToggleLive;
