// ═══════════════════════════════════════════
// MODULE: Marketing Kit v2
// - Field dinamis per tipe konten
// - Upload file JPG/PDF/DOC
// - Supabase Storage
// ═══════════════════════════════════════════

const MKT_TYPES = [
  { key:'wa_message',  label:'💬 Pesan WA', icon:'💬',
    fields:['content'],
    hint:'Template pesan WhatsApp. Gunakan *teks* untuk bold.',
    contentLabel:'Isi Pesan WA',
    contentPlaceholder:'Halo [NAMA],\n\nBerikut informasi dari OneLab...',
    hasFile: false },

  { key:'script',      label:'🎤 Skrip Health Talk', icon:'🎤',
    fields:['content'],
    hint:'Skrip untuk dibacakan dokter/perawat saat health talk komunitas.',
    contentLabel:'Isi Skrip',
    contentPlaceholder:'Pembukaan (3 menit):\n"Bapak/Ibu selamat pagi..."',
    hasFile: false },

  { key:'email',       label:'📧 Email', icon:'📧',
    fields:['subject','content'],
    hint:'Template email formal. Bisa pakai placeholder [NAMA], [PERUSAHAAN].',
    contentLabel:'Isi Email',
    contentPlaceholder:'Dengan hormat,\n\n...',
    hasFile: false },

  { key:'proposal',    label:'📋 Proposal Mitra', icon:'📋',
    fields:['content','file'],
    hint:'Proposal kerjasama. Bisa upload file DOC/PDF sebagai template visual.',
    contentLabel:'Isi Proposal (teks)',
    contentPlaceholder:'Dengan hormat,\n\nKami dari OneLab Diagnostics...',
    hasFile: true,
    fileLabel: 'Upload Proposal (DOC/PDF)',
    fileBucket: 'templates',
    fileFolder: 'proposals',
    fileAccepts: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },

  { key:'flyer',       label:'📄 Flyer / Brosur', icon:'📄',
    fields:['content','file'],
    hint:'Upload desain flyer dalam format JPG/PNG/PDF.',
    contentLabel:'Deskripsi / Caption',
    contentPlaceholder:'Flyer untuk event health talk bulan Mei...',
    hasFile: true,
    fileLabel: 'Upload Flyer (JPG/PNG/PDF)',
    fileBucket: 'templates',
    fileFolder: 'flyers',
    fileAccepts: ['image/jpeg','image/png','image/webp','application/pdf'] },

  { key:'surat',       label:'✉️ Surat Penawaran', icon:'✉️',
    fields:['letter_meta','content','file'],
    hint:'Template surat penawaran kerjasama (Rujukan Spesimen, MCU Korporat, dll). Upload file DOCX dengan {{VARIABEL}} sebagai placeholder — terisi otomatis saat surat dibuat di modul Surat Keluar.',
    contentLabel:'Isi Surat (teks fallback jika tanpa file DOCX)',
    contentPlaceholder:'Dengan hormat,\n\nKami memahami bahwa di balik setiap keputusan klinis yang tepat...',
    hasFile: true,
    fileLabel: 'Upload Template Surat (DOCX)',
    fileBucket: 'templates',
    fileFolder: 'surat',
    fileAccepts: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    isLetterType: true },

  { key:'mou_template',label:'📜 Template MOU', icon:'📜',
    fields:['content','file'],
    hint:'Upload template MOU dalam format DOC/DOCX.',
    contentLabel:'Ringkasan / Catatan MOU',
    contentPlaceholder:'Template MOU untuk kerjasama MCU korporat...',
    hasFile: true,
    fileLabel: 'Upload Template MOU (DOC/DOCX)',
    fileBucket: 'templates',
    fileFolder: 'mou',
    fileAccepts: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf'] },
];

// Variabel placeholder per kategori — panduan ditampilkan di form
const MKT_PLACEHOLDER_GUIDE = {
  surat: ['NO_SURAT','TANGGAL','LAMPIRAN','PERIHAL','NAMA_TUJUAN','PIC_TUJUAN','ALAMAT_TUJUAN','ORG_NAMA','ORG_ALAMAT','PENANDATANGAN','JABATAN'],
  mou_template: ['NAMA_MITRA','TANGGAL_MULAI','TANGGAL_BERAKHIR','PIC_MITRA','NILAI_KERJASAMA'],
  email: ['NAMA','PERUSAHAAN','TANGGAL'],
  proposal: ['NAMA','PERUSAHAAN','TANGGAL'],
  default: ['NAMA','TANGGAL','PERUSAHAAN','PRODUK'],
};

// Bentuk Kerjasama — sesuai struktur template Surat Penawaran OneLab
const KERJASAMA_OPTIONS = [
  'Rujukan Spesimen','Rujukan Pasien','Medical Check Up Korporat','Paket Skrining Komunitas'
];

const MKT_CHANNELS = [
  'Semua Channel','Komunitas & Warga','Dokter & Klinik',
  'Apotek','Perusahaan SME','Gym & Sport','Sekolah / Kampus','Internal'
];

// ── Tombol Tambah Template — split-button per kategori ────────
function renderAddTemplateBtn() {
  return `
    <div class="mkt-add-dropdown" style="position:relative;display:inline-block">
      <button class="btn btn-teal" onclick="toggleMktAddMenu()">+ Tambah Template ▾</button>
      <div id="mkt-add-menu" style="display:none;position:absolute;top:calc(100% + 6px);right:0;
        background:#fff;border:1px solid var(--border);border-radius:var(--r-md);
        box-shadow:var(--shadow-md);min-width:220px;z-index:300;overflow:hidden">
        ${MKT_TYPES.map(t => `
          <button onclick="closeMktAddMenu();openMktForm(null,'${t.key}')"
            style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 16px;
              background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;
              color:var(--text2);text-align:left;transition:background .12s"
            onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='none'">
            <span style="font-size:16px">${t.icon||'📄'}</span>${t.label}
          </button>`).join('')}
      </div>
    </div>`;
}

function toggleMktAddMenu() {
  const menu = document.getElementById('mkt-add-menu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) setTimeout(() => document.addEventListener('click', closeMktAddMenuOutside, {once:true}), 10);
}
function closeMktAddMenuOutside(e) {
  const wrap = document.querySelector('.mkt-add-dropdown');
  if (wrap && !wrap.contains(e.target)) closeMktAddMenu();
}
function closeMktAddMenu() {
  const menu = document.getElementById('mkt-add-menu');
  if (menu) menu.style.display = 'none';
}

let mktAll = [];
let mktActiveType = 'all';
let mktSearch = '';

async function renderMarketing() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>📣 Marketing &amp; Voucher</h1>
        <p>Template konten, proposal, skrip, dan manajemen voucher campaign</p>
      </div>
      <div class="btn-row" id="mkt-header-btns">
        ${renderAddTemplateBtn()}
      </div>
    </div>

    <!-- Section Tabs — Virtu style -->
    <div class="ms-topbar" style="margin-bottom:20px">
      <button id="mkt-section-template" class="ms-tab active"
        onclick="switchMktSection('template')">
        📣 Template &amp; Konten
      </button>
      <button id="mkt-section-voucher" class="ms-tab"
        onclick="switchMktSection('voucher')">
        🎟 Voucher Builder
      </button>
    </div>

    <!-- Template section -->
    <div id="mkt-section-template-content">
      <div class="tabs" id="mkt-tabs">
        <button class="tab-btn active" onclick="filterMkt('all',this)">Semua</button>
        ${MKT_TYPES.map(t=>`
          <button class="tab-btn" onclick="filterMkt('${t.key}',this)">${t.label}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <input class="table-search" id="mkt-q" placeholder="Cari template..."
          oninput="mktSearch=this.value.toLowerCase();renderMktGrid(applyMktFilter())" style="flex:1;min-width:200px">
        <select class="table-filter" id="mkt-ch" onchange="renderMktGrid(applyMktFilter())">
          ${MKT_CHANNELS.map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
      <div id="mkt-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
        <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Voucher section (hidden by default) -->
    <div id="mkt-section-voucher-content" style="display:none"></div>
  `;

  await loadMktTemplates();
}


// ── Section Switcher ─────────────────────────
function switchMktSection(section) {
  // Update tab buttons
  document.querySelectorAll('[id^="mkt-section-"]').forEach(el => {
    if (!el.id.endsWith('-content')) el.classList.remove('active');
  });
  const tabBtn = document.getElementById(`mkt-section-${section}`);
  if (tabBtn) tabBtn.classList.add('active');

  // Show/hide content divs
  const tpl = document.getElementById('mkt-section-template-content');
  const vch = document.getElementById('mkt-section-voucher-content');

  if (section === 'template') {
    if (tpl) tpl.style.display = '';
    if (vch) vch.style.display = 'none';
    // Update header button
    const hdr = document.getElementById('mkt-header-btns');
    if (hdr) hdr.innerHTML = renderAddTemplateBtn();
  } else if (section === 'voucher') {
    if (tpl) tpl.style.display = 'none';
    if (vch) {
      vch.style.display = '';
      // Inject voucher UI into the content div
      vch.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
      renderVoucherInline(vch);
    }
    // Update header button
    const hdr = document.getElementById('mkt-header-btns');
    if (hdr) hdr.innerHTML = `<button class="btn btn-teal" onclick="openCampaignForm()">+ Campaign Baru</button>`;
  }
}

async function renderVoucherInline(container) {
  try {
    // Same DOM structure as renderVoucher() in voucher.js — keeps loadAllVouchers/filterVouchers compatible
    container.innerHTML = `
      <div class="page-header" style="margin-bottom:16px">
        <div><p style="color:var(--text3);font-size:13px">Buat campaign, generate voucher massal, share WA/Email, dan tracking redeem</p></div>
        <div class="btn-row">
          <button class="btn btn-teal" onclick="openCampaignForm()">+ Campaign Baru</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" onclick="switchVoucherTab('campaigns',this)">🎯 Campaign</button>
        <button class="tab-btn" onclick="switchVoucherTab('vouchers',this)">🎟 Daftar Voucher</button>
      </div>
      <div id="campaigns-tab">
        <div id="campaigns-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
          <div class="loading-row"><div class="spinner"></div></div>
        </div>
      </div>
      <div id="vouchers-tab" style="display:none">
        <div class="table-wrap">
          <div class="table-toolbar">
            <input class="table-search" id="vc-search" placeholder="🔍 Cari kode, nama penerima..."
              oninput="filterVouchers(this.value)">
            <select class="table-filter" id="vc-campaign" onchange="filterVouchers()">
              <option value="">Semua Campaign</option>
            </select>
            <select class="table-filter" id="vc-status" onchange="filterVouchers()">
              <option value="">Semua Status</option>
              <option>Active</option><option>Used</option><option>Expired</option><option>Cancelled</option>
            </select>
          </div>
          <div id="vouchers-table"><div class="loading-row"><div class="spinner"></div></div></div>
        </div>
      </div>`;
    // Load campaigns AND vouchers — both needed since this mirrors the standalone page
    if (typeof loadCampaigns === 'function') await loadCampaigns();
    if (typeof loadAllVouchers === 'function') await loadAllVouchers();
  } catch(e) {
    container.innerHTML = `<div class="status-box status-err">❌ ${e.message}</div>`;
  }
}

async function loadMktTemplates() {
  try {
    const data = await sbGet('marketing_templates','select=*&order=created_at.desc');
    mktAll = Array.isArray(data) ? data : [];
    renderMktGrid(mktAll);
  } catch(e) {
    document.getElementById('mkt-grid').innerHTML =
      `<div class="status-box status-err" style="grid-column:1/-1">❌ ${e.message}</div>`;
  }
}

function applyMktFilter() {
  const ch = document.getElementById('mkt-ch')?.value || '';
  return mktAll.filter(t =>
    (mktActiveType === 'all' || t.type === mktActiveType) &&
    (ch === 'Semua Channel' || !ch || t.channel === ch) &&
    (!mktSearch || (t.title||'').toLowerCase().includes(mktSearch) ||
                   (t.content||'').toLowerCase().includes(mktSearch))
  );
}

function filterMkt(type, btn) {
  mktActiveType = type;
  document.querySelectorAll('#mkt-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderMktGrid(applyMktFilter());
}

function renderMktGrid(templates) {
  const grid = document.getElementById('mkt-grid');
  if (!grid) return;

  if (!templates.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="ico">📣</div>
        <h3>${mktAll.length ? 'Tidak ada hasil' : 'Belum ada template'}</h3>
        <p>Klik "+ Tambah Template" untuk mulai.</p>
      </div>`;
    return;
  }

  grid.innerHTML = templates.map(t => {
    const typeInfo = MKT_TYPES.find(x => x.key === t.type) || {label: t.type, hasFile: false};
    const preview  = (t.content||'').substring(0,100).replace(/\n/g,' ');
    const isImage  = t.file_type && t.file_type.startsWith('image/');

    return `
      <div class="card" style="transition:box-shadow .15s;display:flex;flex-direction:column;gap:10px"
        onmouseover="this.style.boxShadow='0 4px 20px rgba(0,0,0,.12)'"
        onmouseout="this.style.boxShadow=''">

        <!-- File preview -->
        ${t.file_url ? (isImage
          ? `<img src="${t.file_url}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;background:var(--lgray)">`
          : `<div style="height:80px;background:var(--lgray);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:8px">
              <span style="font-size:32px">${t.file_type?.includes('pdf')?'📄':'📝'}</span>
              <div><div style="font-size:12px;font-weight:600;color:var(--navy)">${t.file_name||'File template'}</div>
              <a href="${t.file_url}" target="_blank" style="font-size:11px;color:var(--teal)">Buka file ↗</a></div>
            </div>`)
          : ''}

        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${t.title}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <span class="badge badge-teal" style="font-size:10px">${typeInfo.label}</span>
              ${t.channel ? `<span class="badge badge-gray" style="font-size:10px">${t.channel}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="act-btn edit" onclick="openMktForm(${t.id})">✏️</button>
            <button class="act-btn del" onclick="deleteMkt(${t.id},'${(t.title||'').replace(/'/g,"\\'")}')">🗑</button>
          </div>
        </div>

        ${preview ? `<div style="font-size:12px;color:var(--gray);line-height:1.5;background:var(--lgray);padding:8px;border-radius:6px;max-height:60px;overflow:hidden">${preview}${(t.content||'').length>100?'...':''}</div>` : ''}

        <div style="display:flex;gap:6px;margin-top:auto">
          <button class="btn btn-teal btn-sm" style="flex:1" onclick="previewMkt(${t.id})">👁 Lihat</button>
          <button class="btn btn-outline btn-sm" onclick="copyMktContent(${t.id})">📋 Salin</button>
          ${t.type==='wa_message'||t.type==='email' ? `<button class="btn btn-ghost btn-sm" onclick="shareMktWA(${t.id})">💬</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Preview ───────────────────────────────────────
function previewMkt(id) {
  const t = mktAll.find(x=>x.id===id); if(!t) return;
  const typeInfo = MKT_TYPES.find(x=>x.key===t.type)||{label:t.type};
  const isImage  = t.file_type && t.file_type.startsWith('image/');

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${typeInfo.label} — ${t.title}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    ${t.file_url ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">File Template</div>
        ${isImage
          ? `<img src="${t.file_url}" style="width:100%;border-radius:8px;max-height:300px;object-fit:contain;background:var(--lgray)">`
          : `<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--lgray);border-radius:8px">
              <span style="font-size:28px">${t.file_type?.includes('pdf')?'📄':'📝'}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--navy)">${t.file_name||'File template'}</div>
                <a href="${t.file_url}" target="_blank" class="btn btn-teal btn-sm" style="margin-top:4px;text-decoration:none;display:inline-block">⬇️ Download / Buka</a>
              </div>
            </div>`}
      </div>` : ''}
    ${t.content ? `
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">Konten</div>
      <div style="background:${t.type==='wa_message'?'#E7F8EE':'var(--lgray)'};border-radius:8px;padding:14px;
        font-size:13px;line-height:1.8;white-space:pre-wrap;max-height:50vh;overflow-y:auto">
${t.content}
      </div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      ${t.content ? `<button class="btn btn-outline" onclick="copyMktContent(${id});closeModalForce()">📋 Salin</button>` : ''}
      ${t.type==='wa_message' ? `<button class="btn btn-teal" onclick="shareMktWA(${id})">💬 Buka WA</button>` : ''}
    </div>`);
}

function copyMktContent(id) {
  const t = mktAll.find(x=>x.id===id);
  if(!t || !t.content) { toast('Tidak ada konten teks','warn'); return; }
  navigator.clipboard.writeText(t.content).then(()=>toast('📋 Tersalin!','ok')).catch(()=>toast('Gagal','err'));
}

function shareMktWA(id) {
  const t = mktAll.find(x=>x.id===id);
  if(!t) return;
  window.open('https://wa.me/?text='+encodeURIComponent(t.content||''),'_blank');
}

// ── Form Add / Edit ───────────────────────────────
async function openMktForm(id=null, defaultType=null) {
  let t = {};
  if (id) {
    const data = await sbGet('marketing_templates',`select=*&id=eq.${id}`);
    t = data[0] || {};
  }

  const currentType = t.type || defaultType || 'wa_message';
  const typeInfo = MKT_TYPES.find(x=>x.key===currentType) || MKT_TYPES[0];
  const placeholders = MKT_PLACEHOLDER_GUIDE[currentType] || MKT_PLACEHOLDER_GUIDE.default;
  // Lock the type dropdown when launched from a category-specific button (new template only)
  const lockType = !id && !!defaultType;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${typeInfo.icon||'📄'} ${id?'Edit':'Tambah'} ${typeInfo.label.replace(/^\S+\s/,'')}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-group">
      <label>Tipe Konten *</label>
      ${lockType ? `
        <input type="text" value="${typeInfo.label}" disabled style="background:var(--bg2);color:var(--text2);font-weight:600">
        <input type="hidden" id="mf-type" value="${currentType}">
      ` : `
        <select id="mf-type" onchange="updateMktFormFields()">
          ${MKT_TYPES.map(x=>`<option value="${x.key}"${currentType===x.key?' selected':''}>${x.label}</option>`).join('')}
        </select>
      `}
      <div id="mf-type-hint" style="font-size:12px;color:var(--gray);margin-top:4px">${typeInfo.hint}</div>
    </div>

    <div class="form-group">
      <label>Judul Template *</label>
      <input type="text" id="mf-title" value="${t.title||''}"
        placeholder="${currentType==='surat'?'Contoh: Penawaran Rujukan Spesimen — Klinik Pratama':'Nama template yang mudah diingat'}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Channel Target</label>
        <select id="mf-channel">
          ${MKT_CHANNELS.slice(1).map(c=>`<option${t.channel===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tags (pisah koma)</label>
        <input type="text" id="mf-tags" value="${t.tags||''}" placeholder="komunitas, edukasi, dm">
      </div>
    </div>

    <!-- Subject (email only) -->
    <div class="form-group" id="mf-subject-group" style="display:${currentType==='email'?'flex':'none'};flex-direction:column;gap:5px">
      <label>Subject Email</label>
      <input type="text" id="mf-subject" value="${t.subject||''}" placeholder="Penawaran Kerjasama OneLab Diagnostics">
    </div>

    <!-- Letter metadata (Surat Penawaran only) -->
    <div id="mf-letter-meta-group" style="display:${typeInfo.isLetterType?'block':'none'}">
      <div class="status-box status-info" style="font-size:12px;margin-bottom:14px">
        📌 Field di bawah ini sebagai <strong>katalog acuan</strong> — saat surat aktual dibuat,
        isi spesifik (nomor, tanggal, nama faskes) diinput di modul <strong>Surat Keluar</strong>.
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kode Prefix Nomor Surat</label>
          <input type="text" id="mf-letter-prefix" value="${t.letter_prefix||'REF-S'}" placeholder="REF-S">
          <div class="form-hint">Contoh: 001/<strong>REF-S</strong>/MKT-SDI/OLD/IV/2026</div>
        </div>
        <div class="form-group">
          <label>Bentuk Kerjasama</label>
          <select id="mf-letter-kerjasama">
            ${KERJASAMA_OPTIONS.map(k=>`<option${t.letter_kerjasama===k?' selected':''}>${k}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Catatan SLA / Lampiran Standar</label>
        <textarea id="mf-letter-sla" rows="3"
          placeholder="Penjemputan Spesimen ≤4 Jam, Same Day Result, Notifikasi Critical Value <30 Menit...">${t.letter_sla||''}</textarea>
        <div class="form-hint">Dicatat sebagai referensi tim — tidak otomatis masuk ke DOCX kecuali ditulis sebagai {{VARIABEL}} di file template.</div>
      </div>
    </div>

    <!-- Content -->
    <div class="form-group" id="mf-content-group">
      <label id="mf-content-label">${typeInfo.contentLabel}</label>
      <textarea id="mf-content" rows="8"
        placeholder="${typeInfo.contentPlaceholder}">${t.content||''}</textarea>
      <div id="mf-placeholder-guide" style="font-size:11px;color:var(--gray);margin-top:3px">
        Placeholder: ${placeholders.map(p=>`<code>{{${p}}}</code>`).join(' ')}
      </div>
    </div>

    <!-- File upload -->
    <div id="mf-file-group" style="display:${typeInfo.hasFile?'block':'none'}">
      <div class="form-group">
        <label id="mf-file-label">${typeInfo.fileLabel||'Upload File'}</label>
        ${renderUploadArea('mf-file', 'mf-file-preview',
          typeInfo.fileAccepts||['image/jpeg','image/png','application/pdf'])}
        ${t.file_url ? renderExistingFile(t.file_url, t.file_name, t.file_type) : ''}
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="mf-save-btn" onclick="saveMkt(${id||'null'})">
        ${id?'💾 Simpan':'➕ Tambah'}
      </button>
    </div>`);
}

function updateMktFormFields() {
  const type = document.getElementById('mf-type')?.value;
  const typeInfo = MKT_TYPES.find(x=>x.key===type)||MKT_TYPES[0];
  const placeholders = MKT_PLACEHOLDER_GUIDE[type] || MKT_PLACEHOLDER_GUIDE.default;

  document.getElementById('mf-type-hint').textContent = typeInfo.hint;
  document.getElementById('mf-content-label').textContent = typeInfo.contentLabel;
  document.getElementById('mf-content').placeholder = typeInfo.contentPlaceholder;
  document.getElementById('mf-subject-group').style.display = type==='email'?'flex':'none';
  document.getElementById('mf-file-group').style.display = typeInfo.hasFile?'block':'none';
  document.getElementById('mf-letter-meta-group').style.display = typeInfo.isLetterType?'block':'none';

  const guideEl = document.getElementById('mf-placeholder-guide');
  if (guideEl) guideEl.innerHTML = 'Placeholder: ' + placeholders.map(p=>`<code>{{${p}}}</code>`).join(' ');

  if (typeInfo.hasFile) {
    const label = document.getElementById('mf-file-label');
    if (label) label.textContent = typeInfo.fileLabel||'Upload File';
  }
}

async function saveMkt(id) {
  const title   = document.getElementById('mf-title').value.trim();
  const type    = document.getElementById('mf-type').value;
  const content = document.getElementById('mf-content').value.trim();
  if (!title) { toast('Judul wajib diisi','err'); return; }

  const btn = document.getElementById('mf-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }

  const typeInfo = MKT_TYPES.find(x=>x.key===type)||{};
  let fileData = null;

  // Upload file jika ada
  if (typeInfo.hasFile) {
    try {
      const fileInput = document.getElementById('mf-file');
      if (fileInput?.files?.[0]) {
        fileData = await uploadFile(
          fileInput.files[0],
          typeInfo.fileBucket || BUCKETS.templates,
          typeInfo.fileFolder || 'misc'
        );
      }
    } catch(e) {
      toast('❌ Gagal upload file: '+e.message,'err');
      if (btn) { btn.disabled=false; btn.textContent=id?'💾 Simpan':'➕ Tambah'; }
      return;
    }
  }

  const payload = {
    title,
    type,
    channel:    document.getElementById('mf-channel').value,
    content:    content || null,
    tags:       document.getElementById('mf-tags').value.trim(),
    updated_at: new Date().toISOString(),
    created_by_name: getUserName ? getUserName() : 'User',
    ...(type==='surat' ? {
      letter_prefix:    document.getElementById('mf-letter-prefix')?.value.trim()||'REF-S',
      letter_kerjasama: document.getElementById('mf-letter-kerjasama')?.value||null,
      letter_sla:       document.getElementById('mf-letter-sla')?.value.trim()||null,
    } : {}),
    ...(fileData ? {
      file_url:  fileData.url,
      file_name: fileData.name,
      file_type: fileData.type,
    } : {})
  };

  try {
    if (id) {
      await sbPatch('marketing_templates', id, payload);
      toast('✅ Template diupdate','ok');
    } else {
      await sbPost('marketing_templates', payload);
      toast('✅ Template ditambahkan','ok');
    }
    closeModalForce();
    await loadMktTemplates();
  } catch(e) {
    toast('❌ '+e.message,'err');
    if (btn) { btn.disabled=false; btn.textContent=id?'💾 Simpan':'➕ Tambah'; }
  }
}

async function deleteMkt(id, title) {
  if (!confirm(`Hapus template "${title}"?`)) return;
  try {
    await sbDelete('marketing_templates', id);
    toast('🗑 Template dihapus','info');
    await loadMktTemplates();
  } catch(e) { toast('❌ '+e.message,'err'); }
}
