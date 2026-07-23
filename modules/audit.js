// ═══════════════════════════════════════════════════════════════
// MODULE: Jejak Audit (Provenance / Trust Ledger)
//
// Sistem ini sudah lama menulis jejak perbuatan ke tabel activity_logs —
// lewat logActivity() di klien dan write_audit() di basis data. Isinya terus
// bertambah, tapi sampai sekarang TIDAK ADA satu layar pun untuk membacanya.
//
// Akibatnya lingkaran human-in-the-loop cuma separuh: manusia menyetujui
// sesuatu di Approval Inbox, lalu tidak punya cara memeriksa apa yang benar-
// benar terjadi sesudahnya. Layar ini menutup lingkaran itu.
//
// ── Yang JUJUR harus diketahui tentang layar ini ──────────────
// Jejak ini belum kebal-ubah. activity_logs tidak punya kebijakan RLS, dan
// logActivity() menulis langsung ke tabel (bukan lewat write_audit), sehingga
// siapa pun yang memegang kunci anon secara teknis masih bisa mengubah atau
// menghapus baris. Karena itu layar ini menampilkan peringatan terbuka, bukan
// mengaku sebagai buku besar yang tak dapat diganggu gugat.
// Jalankan supabase_audit_ledger.sql untuk menjadikannya benar-benar
// hanya-tambah; sesudah itu peringatannya hilang dengan sendirinya.
//
// Seluruh nama global diawali "aud" agar tidak bertabrakan dengan modul lain.
// ═══════════════════════════════════════════════════════════════

const AUD_PAGE = 60;

// Perbuatan dikelompokkan supaya penyaringnya bisa dibaca manusia, bukan
// menampilkan senarai mentah yang isinya bertambah tiap modul baru.
const AUD_ACTION_META = {
  create:        { label: 'Dibuat',            c: '#15803D', ic: 'check-circle' },
  update:        { label: 'Diubah',            c: '#B45309', ic: 'edit' },
  delete:        { label: 'Dihapus',           c: '#B91C1C', ic: 'box-out' },
  status_change: { label: 'Ubah Status',       c: '#1D4ED8', ic: 'activity' },
  validated:     { label: 'Divalidasi',        c: '#0E7C86', ic: 'clipboard-check' },
  note:          { label: 'Catatan',           c: '#7C3AED', ic: 'file-text' },
  anamnesa:      { label: 'Anamnesa',          c: '#0E7C86', ic: 'stethoscope' },
  checkin:       { label: 'Check-in',          c: '#123A5C', ic: 'clock' },
  whatsapp:      { label: 'WhatsApp',          c: '#15803D', ic: 'megaphone' },
};

// Nama tabel adalah istilah teknis. Diterjemahkan supaya layar ini terbaca
// oleh auditor dan manajemen, bukan hanya oleh yang menulis kodenya.
const AUD_TABLE_LABEL = {
  leads: 'Leads', partners: 'Partner', partner_deals: 'Deal Partner',
  outgoing_letters: 'Surat Keluar', lab_results: 'Hasil Lab',
  admissions: 'Pendaftaran', projects: 'Proyek', sample_labels: 'Label Sampel',
  anamnesas: 'Anamnesa', clinical_notes: 'Catatan Klinis',
  icd_diagnostics: 'Diagnosis', vital_signs: 'Tanda Vital',
  fixed_assets: 'Aset Tetap', depreciations: 'Penyusutan',
  invoices: 'Faktur', payments: 'Pembayaran', journals: 'Jurnal',
  radiology_orders: 'Order Radiologi', homecare_orders: 'Order Home Care',
  user_profiles: 'Pengguna', stock_ledger: 'Kartu Stok',
};

let audRows      = [];
let audTotal     = 0;
let audPage      = 0;
let audLedgerOk  = null;   // null = belum diperiksa
let audFilter    = { search: '', action: '', table: '', user: '', from: '', to: '' };
let audFacets    = { actions: [], tables: [], users: [] };

// ── Penolong kecil ────────────────────────────────────────────
function audEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function audActionMeta(a) {
  return AUD_ACTION_META[a] || { label: a || '—', c: '#6B7A8B', ic: 'list' };
}

function audTableLabel(t) {
  return AUD_TABLE_LABEL[t] || t || '—';
}

function audIco(name, size) {
  return typeof icon === 'function' ? icon(name, size) : '';
}

// Waktu penuh sampai detik: audit tanpa detik tidak bisa memisahkan dua
// perbuatan yang terjadi berdekatan.
function audFullTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function audRelative(ts) {
  const d = new Date(ts); if (isNaN(d)) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)     return 'baru saja';
  if (s < 3600)   return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400)  return Math.floor(s / 3600) + ' jam lalu';
  if (s < 2592000)return Math.floor(s / 86400) + ' hari lalu';
  return Math.floor(s / 2592000) + ' bulan lalu';
}

// ── Muat data ─────────────────────────────────────────────────
function audBuildQuery(withRange) {
  const p = [];
  const f = audFilter;
  if (f.action) p.push(`action=eq.${encodeURIComponent(f.action)}`);
  if (f.table)  p.push(`table_name=eq.${encodeURIComponent(f.table)}`);
  if (f.user)   p.push(`user_name=eq.${encodeURIComponent(f.user)}`);
  if (f.from)   p.push(`created_at=gte.${f.from}T00:00:00`);
  if (f.to)     p.push(`created_at=lte.${f.to}T23:59:59`);
  if (f.search) {
    // Cari di deskripsi, nama record, dan id record sekaligus.
    const q = encodeURIComponent(`*${f.search}*`);
    p.push(`or=(description.ilike.${q},record_name.ilike.${q},record_id.ilike.${q})`);
  }
  p.push('order=created_at.desc');
  if (withRange) {
    p.push(`limit=${AUD_PAGE}`, `offset=${audPage * AUD_PAGE}`);
  }
  return p.join('&');
}

async function audLoad() {
  try {
    const rows = await sbGet('activity_logs', 'select=*&' + audBuildQuery(true));
    audRows = rows || [];
  } catch (e) {
    audRows = [];
    toast('❌ Gagal memuat jejak audit: ' + e.message, 'err');
  }
  await audLoadCount();
}

// Jumlah total dihitung terpisah lewat header Content-Range supaya penomoran
// halaman benar tanpa harus menarik seluruh baris.
async function audLoadCount() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/activity_logs?select=id&${audBuildQuery(false)}`;
    const res = await fetch(url, {
      headers: { ...SB_HEADERS, 'Prefer': 'count=exact', 'Range': '0-0' },
    });
    const cr = res.headers.get('content-range') || '';
    audTotal = parseInt(cr.split('/')[1], 10) || 0;
  } catch (e) { audTotal = 0; }
}

// Isi penyaring diambil dari data yang benar-benar ada, bukan didaftar keras
// di kode — supaya modul baru otomatis muncul tanpa menyunting berkas ini.
async function audLoadFacets() {
  try {
    const rows = await sbGet('activity_logs',
      'select=action,table_name,user_name&order=created_at.desc&limit=2000');
    const uniq = (k) => [...new Set((rows || []).map(r => r[k]).filter(Boolean))].sort();
    audFacets = { actions: uniq('action'), tables: uniq('table_name'), users: uniq('user_name') };
  } catch (e) { /* penyaring kosong tidak menggagalkan layar */ }
}

// Uji apakah jejaknya sudah benar-benar hanya-tambah. Caranya dengan MENCOBA
// menghapus baris yang pasti tidak ada (id negatif): kalau ditolak izin, berarti
// penguncian sudah dijalankan. Tidak ada baris nyata yang tersentuh.
async function audCheckLedger() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs?id=eq.-1`, {
      method: 'DELETE', headers: { ...SB_HEADERS },
    });
    // 401/403 = izin dicabut → jejak sudah terkunci. 2xx = penghapusan diizinkan.
    audLedgerOk = (res.status === 401 || res.status === 403);
  } catch (e) {
    audLedgerOk = null;   // tidak dapat dipastikan; jangan mengaku aman
  }
}

// ── Layar utama ───────────────────────────────────────────────
async function renderAuditTrail() {
  if (typeof injectProShell === 'function') injectProShell();
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>${audIco('scroll', 20)} Jejak Audit</h1>
        <p style="color:var(--text3);font-size:13px">
          Catatan perbuatan pada sistem — siapa melakukan apa, kapan, pada data mana</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="audExportCSV()">${audIco('upload',14)} Ekspor CSV</button>
        <button class="btn btn-teal btn-sm" onclick="audRefresh()">${audIco('activity',14)} Muat Ulang</button>
      </div>
    </div>
    <div id="aud-ledger-note"></div>
    <div id="aud-filter" class="card" style="padding:12px;margin-bottom:12px"></div>
    <div id="aud-body"><div class="loading-row"><div class="spinner"></div></div></div>`;

  audPage = 0;
  await Promise.all([audLoadFacets(), audCheckLedger()]);
  await audLoad();
  audPaintLedgerNote();
  audPaintFilter();
  audPaintBody();
}

// Peringatan keterubahan. Ditampilkan terbuka karena layar audit yang
// menyembunyikan kelemahannya sendiri lebih berbahaya daripada tidak ada.
function audPaintLedgerNote() {
  const el = document.getElementById('aud-ledger-note'); if (!el) return;
  if (audLedgerOk === true) {
    el.innerHTML = `
      <div class="status-box status-ok" style="margin-bottom:12px">
        ${audIco('shield-check',15)} <b>Jejak terkunci.</b>
        Baris audit hanya dapat ditambah — pengubahan dan penghapusan sudah dicabut di basis data.
      </div>`;
    return;
  }
  if (audLedgerOk === false) {
    el.innerHTML = `
      <div class="status-box status-warn" style="margin-bottom:12px">
        ${audIco('shield-check',15)} <b>Jejak ini belum kebal-ubah.</b>
        Tabel <code>activity_logs</code> masih mengizinkan pengubahan dan penghapusan,
        sehingga catatan di bawah <u>belum dapat dijadikan bukti audit</u>.
        Jalankan <code>supabase_audit_ledger.sql</code> untuk menjadikannya hanya-tambah.
      </div>`;
    return;
  }
  el.innerHTML = '';   // tidak dapat dipastikan — lebih baik diam daripada salah menjamin
}

function audPaintFilter() {
  const el = document.getElementById('aud-filter'); if (!el) return;
  const opt = (list, cur, labelFn) =>
    list.map(v => `<option value="${audEsc(v)}" ${cur === v ? 'selected' : ''}>${audEsc(labelFn ? labelFn(v) : v)}</option>`).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;align-items:end">
      <div>
        <label>Cari</label>
        <input type="text" id="aud-q" value="${audEsc(audFilter.search)}"
          placeholder="deskripsi / nama / id" onkeydown="if(event.key==='Enter')audApplyFilter()">
      </div>
      <div>
        <label>Perbuatan</label>
        <select id="aud-action" onchange="audApplyFilter()">
          <option value="">Semua</option>
          ${opt(audFacets.actions, audFilter.action, a => audActionMeta(a).label)}
        </select>
      </div>
      <div>
        <label>Data</label>
        <select id="aud-table" onchange="audApplyFilter()">
          <option value="">Semua</option>
          ${opt(audFacets.tables, audFilter.table, audTableLabel)}
        </select>
      </div>
      <div>
        <label>Pelaku</label>
        <select id="aud-user" onchange="audApplyFilter()">
          <option value="">Semua</option>
          ${opt(audFacets.users, audFilter.user)}
        </select>
      </div>
      <div>
        <label>Dari</label>
        <input type="date" id="aud-from" value="${audFilter.from}" onchange="audApplyFilter()">
      </div>
      <div>
        <label>Sampai</label>
        <input type="date" id="aud-to" value="${audFilter.to}" onchange="audApplyFilter()">
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-teal btn-sm" onclick="audApplyFilter()">Terapkan</button>
        <button class="btn btn-ghost btn-sm" onclick="audResetFilter()">Reset</button>
      </div>
    </div>`;
}

async function audApplyFilter() {
  audFilter = {
    search: (document.getElementById('aud-q')?.value || '').trim(),
    action:  document.getElementById('aud-action')?.value || '',
    table:   document.getElementById('aud-table')?.value  || '',
    user:    document.getElementById('aud-user')?.value   || '',
    from:    document.getElementById('aud-from')?.value    || '',
    to:      document.getElementById('aud-to')?.value      || '',
  };
  audPage = 0;
  await audLoad();
  audPaintBody();
}

async function audResetFilter() {
  audFilter = { search: '', action: '', table: '', user: '', from: '', to: '' };
  audPage = 0;
  await audLoad();
  audPaintFilter();
  audPaintBody();
}

async function audRefresh() {
  await Promise.all([audLoadFacets(), audCheckLedger()]);
  await audLoad();
  audPaintLedgerNote();
  audPaintFilter();
  audPaintBody();
}

async function audGoPage(n) {
  const max = Math.max(0, Math.ceil(audTotal / AUD_PAGE) - 1);
  audPage = Math.min(Math.max(0, n), max);
  await audLoad();
  audPaintBody();
  document.getElementById('aud-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function audPaintBody() {
  const el = document.getElementById('aud-body'); if (!el) return;

  if (!audRows.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px">
      <div class="ico">${audIco('scroll', 30)}</div>
      <h3>Tidak ada jejak yang cocok</h3>
      <p>Coba longgarkan penyaring, atau perlebar rentang tanggalnya.</p></div>`;
    return;
  }

  // Dikelompokkan per hari supaya urutan kejadiannya terbaca sebagai cerita,
  // bukan sebagai tabel datar sepanjang ribuan baris.
  const byDay = {};
  audRows.forEach(r => {
    const d = (r.created_at || '').slice(0, 10);
    (byDay[d] = byDay[d] || []).push(r);
  });

  const first = audPage * AUD_PAGE + 1;
  const last  = audPage * AUD_PAGE + audRows.length;
  const maxPg = Math.max(1, Math.ceil(audTotal / AUD_PAGE));

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;
      font-size:12px;color:var(--gray)">
      <span>Menampilkan <b>${first}–${last}</b> dari <b>${audTotal}</b> jejak</span>
      <span>Halaman ${audPage + 1} dari ${maxPg}</span>
    </div>

    ${Object.entries(byDay).map(([d, items]) => `
      <div class="card" style="padding:14px;margin-bottom:12px">
        <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;
          text-transform:uppercase;color:var(--gray);margin-bottom:10px">
          ${typeof formatDateShort === 'function' ? formatDateShort(d) : d}
          <span style="text-transform:none;letter-spacing:0"> · ${items.length} jejak</span>
        </div>
        <div style="border-left:2px solid var(--border);padding-left:14px;margin-left:5px">
          ${items.map(audRowHtml).join('')}
        </div>
      </div>`).join('')}

    <div style="display:flex;justify-content:center;gap:6px;margin:14px 0 30px">
      <button class="btn btn-ghost btn-sm" ${audPage === 0 ? 'disabled' : ''}
        onclick="audGoPage(${audPage - 1})">← Sebelumnya</button>
      <button class="btn btn-ghost btn-sm" ${audPage + 1 >= maxPg ? 'disabled' : ''}
        onclick="audGoPage(${audPage + 1})">Berikutnya →</button>
    </div>`;
}

function audRowHtml(r) {
  const m = audActionMeta(r.action);
  const jam = (r.created_at || '').slice(11, 19);
  const punyaRincian = !!(r.before_data || r.after_data);

  return `
    <div style="position:relative;padding:9px 0 10px;border-bottom:1px solid var(--border)">
      <span style="position:absolute;left:-21px;top:13px;width:11px;height:11px;border-radius:50%;
        background:${m.c};border:2px solid #fff;box-shadow:0 0 0 1px ${m.c}55"></span>

      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
        <span style="color:${m.c};line-height:0">${audIco(m.ic, 14)}</span>
        <span style="font-size:10.5px;font-weight:700;color:${m.c};text-transform:uppercase;
          letter-spacing:.05em">${audEsc(m.label)}</span>
        <span style="font-size:11px;font-weight:600;color:var(--text2)">${audEsc(audTableLabel(r.table_name))}</span>
        <span style="font-size:11px;color:var(--gray);font-variant-numeric:tabular-nums">${jam}</span>
        <span style="font-size:11px;color:var(--gray)">· ${audEsc(audRelative(r.created_at))}</span>
      </div>

      <div style="font-size:13px;margin-top:3px">
        ${audEsc(r.description || '(tanpa keterangan)')}
        ${r.record_name ? `<span style="color:var(--text2)"> — ${audEsc(r.record_name)}</span>` : ''}
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-top:3px;font-size:11px;color:var(--gray)">
        <span>${audIco('user', 11)} ${audEsc(r.user_name || 'tidak tercatat')}</span>
        ${r.record_id ? `<span style="font-family:ui-monospace,monospace">#${audEsc(r.record_id)}</span>` : ''}
        ${punyaRincian
          ? `<button class="btn btn-ghost btn-xs" onclick="audShowDetail(${r.id})">Lihat perubahan</button>`
          : `<span style="font-style:italic">perubahan nilainya tidak terekam</span>`}
      </div>
    </div>`;
}

// ── Rincian perubahan ─────────────────────────────────────────
// Sebagian besar pemanggil logActivity() tidak mengirim before/after, jadi
// kebanyakan baris tidak punya rincian. Itu dinyatakan apa adanya di daftar,
// bukan disembunyikan seolah tidak ada perubahan.
async function audShowDetail(id) {
  const r = audRows.find(x => x.id === id);
  if (!r) { toast('Jejak tidak ditemukan', 'warn'); return; }

  const b = r.before_data, a = r.after_data;
  const keys = [...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])].sort();

  const baris = keys.map(k => {
    const vb = b?.[k], va = a?.[k];
    const berubah = JSON.stringify(vb) !== JSON.stringify(va);
    const fmt = v => v === undefined ? '<i style="color:var(--gray)">—</i>'
                   : v === null      ? '<i style="color:var(--gray)">kosong</i>'
                   : audEsc(typeof v === 'object' ? JSON.stringify(v) : v);
    return `<tr style="${berubah ? 'background:#FFFBEB' : ''}">
      <td style="font-family:ui-monospace,monospace;font-size:11px">${audEsc(k)}</td>
      <td style="font-size:12px">${fmt(vb)}</td>
      <td style="font-size:12px;${berubah ? 'font-weight:600' : ''}">${fmt(va)}</td>
    </tr>`;
  }).join('');

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${audIco('scroll',16)} Rincian Perubahan</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
      ${audEsc(audActionMeta(r.action).label)} pada <b>${audEsc(audTableLabel(r.table_name))}</b>
      #${audEsc(r.record_id || '')} · ${audEsc(audFullTime(r.created_at))}<br>
      oleh ${audEsc(r.user_name || 'tidak tercatat')}
    </div>
    ${keys.length ? `
      <div style="overflow-x:auto">
        <table class="tbl" style="width:100%">
          <thead><tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--gray);margin-top:8px">Baris berlatar kuning adalah nilai yang berubah.</p>`
    : `<div class="status-box status-warn">Jejak ini tidak menyimpan nilai sebelum/sesudah.</div>`}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

// ── Ekspor ────────────────────────────────────────────────────
// Mengekspor SELURUH hasil penyaring, bukan hanya halaman yang terlihat —
// auditor meminta rentang, bukan potongan layar.
async function audExportCSV() {
  toast('Menyiapkan berkas…', 'info');
  let rows = [];
  try {
    rows = await sbGet('activity_logs', 'select=*&' + audBuildQuery(false) + '&limit=10000') || [];
  } catch (e) {
    toast('❌ Gagal menarik data: ' + e.message, 'err'); return;
  }
  if (!rows.length) { toast('Tidak ada jejak untuk diekspor', 'warn'); return; }

  const q = v => {
    const s = v === null || v === undefined ? ''
            : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['Waktu','Perbuatan','Data','Keterangan','Nama Record','ID Record','Pelaku','Sebelum','Sesudah'];
  const csv  = [head.join(',')].concat(rows.map(r => [
    audFullTime(r.created_at), audActionMeta(r.action).label, audTableLabel(r.table_name),
    r.description, r.record_name, r.record_id, r.user_name, r.before_data, r.after_data,
  ].map(q).join(','))).join('\r\n');

  // BOM supaya Excel membaca huruf beraksen dengan benar.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jejak-audit-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);

  toast(`✅ ${rows.length} jejak diekspor`, 'ok');
}