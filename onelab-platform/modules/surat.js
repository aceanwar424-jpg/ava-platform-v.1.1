// ═══════════════════════════════════════════
// MODULE: Surat Keluar v2
// - Upload DOCX template
// - Replace variabel via docxtemplater
// - Download DOCX terisi
// - Arsip & log
// ═══════════════════════════════════════════

const LETTER_TYPES = [
  { key:'SP',  label:'Surat Penawaran' },
  { key:'SPK', label:'Surat Permohonan Kerjasama' },
  { key:'SPN', label:'Surat Pemberitahuan' },
  { key:'MOU', label:'MOU / Perjanjian' },
  { key:'SI',  label:'Surat Izin' },
  { key:'SK',  label:'Surat Keterangan' },
  { key:'SL',  label:'Surat Lainnya' },
];

const ORG = {
  name:  'OneLab Diagnostics by Plebo',
  addr:  'Bintaro Jaya, Jl. Elang Raya No.15, Pd. Pucung, Kec. Pd. Aren, Kota Tangerang Selatan',
  city:  'Tangerang Selatan',
  phone: '(021) xxxx-xxxx',
  email: 'info@onelab.id',
};

// Variabel yang bisa dipakai di template DOCX
const TEMPLATE_VARS = [
  { key:'NO_SURAT',       label:'Nomor Surat',         example:'001/SP/OPS/OL/VI/2026' },
  { key:'TANGGAL',        label:'Tanggal Surat',        example:'13 Juni 2026' },
  { key:'TANGGAL_KOTA',   label:'Tanggal + Kota',       example:'Tangerang Selatan, 13 Juni 2026' },
  { key:'PERIHAL',        label:'Perihal / Judul',      example:'Penawaran Kerjasama' },
  { key:'NAMA_TUJUAN',    label:'Nama Perusahaan',      example:'PT. Contoh Maju' },
  { key:'ALAMAT_TUJUAN',  label:'Alamat Tujuan',        example:'Jl. Contoh No.1' },
  { key:'PIC_TUJUAN',     label:'Nama PIC / Jabatan',   example:'Bapak/Ibu HRD Manager' },
  { key:'ORG_NAMA',       label:'Nama Organisasi',      example:ORG.name },
  { key:'ORG_ALAMAT',     label:'Alamat Organisasi',    example:ORG.addr },
  { key:'PENANDATANGAN',  label:'Nama Penandatangan',   example:'dr. Ahmad, SpPK' },
  { key:'JABATAN',        label:'Jabatan Penandatangan',example:'Direktur' },
  { key:'BULAN_TAHUN',    label:'Bulan & Tahun',        example:'Juni 2026' },
  { key:'TAHUN',          label:'Tahun',                example:'2026' },
];

async function renderSurat() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Surat Keluar</h1>
        <p>Generate surat dari template DOCX — penomoran otomatis, arsip terpusat</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openSuratForm()">+ Buat Surat</button>
      </div>
    </div>

    <div class="tabs" id="surat-tabs">
      <button class="tab-btn active" onclick="switchSuratTab('list',this)">📋 Arsip Surat</button>
      <button class="tab-btn" onclick="switchSuratTab('templates',this)">📄 Template Surat</button>
      <button class="tab-btn" onclick="switchSuratTab('numbering',this)">⚙️ Pengaturan Nomor</button>
      <button class="tab-btn" onclick="switchSuratTab('panduan',this)">❓ Panduan</button>
    </div>

    <!-- List -->
    <div id="tab-list">
      <div class="table-wrap">
        <div class="table-toolbar">
          <input class="table-search" id="sl-q" placeholder="🔍 Cari nomor, tujuan, perihal..."
            oninput="filterSurat()" style="flex:1">
          <select class="table-filter" id="sl-type" onchange="filterSurat()">
            <option value="">Semua Tipe</option>
            ${LETTER_TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join('')}
          </select>
          <select class="table-filter" id="sl-status" onchange="filterSurat()">
            <option value="">Semua Status</option>
            <option>Draft</option><option>Sent</option><option>Archived</option>
          </select>
        </div>
        <div id="surat-tbody">
          <div class="loading-row"><div class="spinner"></div></div>
        </div>
      </div>
    </div>

    <!-- Templates -->
    <div id="tab-templates" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:14px;font-weight:700;color:var(--navy)">Template Surat Tersimpan</div>
        <button class="btn btn-teal btn-sm" onclick="openUploadTemplateForm()">
          ⬆ Upload Template DOCX
        </button>
      </div>
      <div id="templates-grid"
        style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Pengaturan Nomor -->
    <div id="tab-numbering" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">

        <div class="card">
          <div class="card-title" style="margin-bottom:4px">🔢 Format Penomoran Surat</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:14px">
            Susun urutan token sesuai kebutuhan, dipisah tanda "/". Klik token untuk menambahkan ke akhir format.
          </div>
          <div class="form-group">
            <label>Format Template</label>
            <input type="text" id="nf-template" style="font-family:monospace;font-size:13px">
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px">
            ${NUMBER_FORMAT_TOKENS.map(t=>`
              <button class="btn btn-ghost btn-xs" onclick="addNumberFormatToken('${t.token}')"
                style="font-family:monospace;font-size:11px" title="${t.label}">${t.token}</button>`).join('')}
          </div>
          <div class="status-box status-info" style="font-size:12px;margin-bottom:14px">
            <strong>Preview:</strong> <span id="nf-preview" style="font-family:monospace;font-weight:700"></span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Kode Organisasi</label>
              <input type="text" id="nf-orgcode" placeholder="OL" style="font-family:monospace">
            </div>
            <div class="form-group">
              <label>Kota (untuk Tanggal+Kota)</label>
              <input type="text" id="nf-orgcity" placeholder="Tangerang Selatan">
            </div>
          </div>
          <div class="form-group">
            <label>Reset Nomor Urut</label>
            <select id="nf-reset">
              <option value="monthly">Setiap Bulan</option>
              <option value="yearly">Setiap Tahun</option>
              <option value="never">Tidak Pernah (terus naik)</option>
            </select>
          </div>
          <button class="btn btn-teal" style="width:100%;margin-top:8px" onclick="saveNumberFormat()">💾 Simpan Format</button>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div class="card-title">🏢 Departemen</div>
            <button class="btn btn-ghost btn-xs" onclick="openDeptForm()">+ Tambah</button>
          </div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:14px">
            Setiap departemen punya kode sendiri untuk dipakai di token {DEPT}.
          </div>
          <div id="dept-list"><div class="loading-row"><div class="spinner"></div></div></div>
        </div>

      </div>
    </div>

    <!-- Panduan -->
    <div id="tab-panduan" style="display:none">
      <div class="card" style="max-width:700px">
        <div class="card-title" style="margin-bottom:16px">📖 Cara Membuat Template Surat DOCX</div>
        <div style="font-size:13px;line-height:1.8;color:var(--text)">
          <p style="margin-bottom:12px">
            Buat template surat di <strong>Microsoft Word</strong> atau <strong>Google Docs</strong>
            dengan desain bebas — logo, header, footer, tanda tangan, semua bisa diatur.
          </p>
          <p style="margin-bottom:8px;font-weight:700;color:var(--navy)">
            Gunakan placeholder berikut di dalam template:
          </p>
          <div style="background:var(--lgray);border-radius:8px;padding:14px;margin-bottom:14px">
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <thead>
                <tr style="background:var(--navy);color:#fff">
                  <th style="padding:8px 10px;text-align:left;border-radius:4px 0 0 0">Placeholder</th>
                  <th style="padding:8px 10px;text-align:left">Keterangan</th>
                  <th style="padding:8px 10px;text-align:left;border-radius:0 4px 0 0">Contoh</th>
                </tr>
              </thead>
              <tbody>
                ${TEMPLATE_VARS.map((v,i)=>`
                  <tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
                    <td style="padding:7px 10px;font-family:monospace;color:var(--teal);font-weight:700">
                      [[${v.key}]]
                    </td>
                    <td style="padding:7px 10px;color:var(--gray)">${v.label}</td>
                    <td style="padding:7px 10px;color:var(--text)">${v.example}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div style="background:#FFF8E1;border-radius:8px;padding:12px 14px;font-size:12px;color:#5D4037">
            <strong>Contoh penggunaan di Word:</strong><br>
            "Kepada Yth. <strong>[[PIC_TUJUAN]]</strong><br>
            <strong>[[NAMA_TUJUAN]]</strong><br>
            <strong>[[ALAMAT_TUJUAN]]</strong>"<br><br>
            Setelah generate, teks ini akan otomatis terisi dengan data yang Anda input.
          </div>
          <div style="margin-top:14px;padding:12px 14px;background:#E3F2FD;border-radius:8px;font-size:12px;color:#0D47A1">
            <strong>💡 Tips:</strong> Simpan template dalam format <strong>.docx</strong> (bukan .doc).
            Setelah upload, template bisa digunakan berkali-kali — tinggal ganti tujuan dan tanggal.
            Gunakan tanda kurung siku ganda <strong>[[ ]]</strong>, bukan kurung kurawal <strong>{{ }}</strong> —
            format kurung kurawal punya bug yang menyebabkan error "Duplicate tag" pada beberapa kasus.
          </div>
          <div style="margin-top:14px;padding:12px 14px;background:#FEF2F2;border-radius:8px;font-size:12px;color:#991B1B">
            <strong>⚠️ Punya template lama dengan format {{NAMA}}?</strong><br><br>
            Buka file Word-nya, gunakan Find &amp; Replace (Ctrl+H): ganti semua <strong>{{</strong> menjadi <strong>[[</strong>,
            lalu ganti semua <strong>}}</strong> menjadi <strong>]]</strong>. Simpan, lalu upload ulang.
          </div>
          <div style="margin-top:14px;padding:12px 14px;background:#F0FDF4;border-radius:8px;font-size:12px;color:#166534">
            <strong>📄 Setup Download PDF (sekali saja)</strong><br><br>
            Tombol "Download PDF" (ikon 📄 di Arsip Surat) butuh setup satu kali di Supabase:
            <ol style="margin:6px 0 0 18px;padding:0">
              <li>Daftar akun gratis di <strong>convertapi.com</strong>, ambil API token dari dashboard mereka</li>
              <li>Di dashboard Supabase: <strong>Edge Functions</strong> → "Deploy a new function" → "Via Editor"</li>
              <li>Beri nama function: <strong>docx-to-pdf</strong>, lalu paste kode dari file
                <code>supabase/functions/docx-to-pdf/index.ts</code> (ada di paket project)</li>
              <li>Klik Deploy</li>
              <li>Di <strong>Settings → Edge Functions → Secrets</strong>, tambahkan secret baru:
                key <code>CONVERTAPI_TOKEN</code>, value token dari ConvertAPI</li>
            </ol>
            Setelah itu, Download PDF akan menghasilkan file pixel-perfect sesuai desain template Word Anda.
            Token API tersimpan aman di server Supabase, tidak pernah terlihat di browser.
          </div>
        </div>
      </div>
    </div>`;

  await loadSuratList();
}

// ── Load List ─────────────────────────────────────
let suratAll = [];

async function loadSuratList() {
  try {
    const data = await sbGet('outgoing_letters','select=*&order=created_at.desc');
    suratAll = Array.isArray(data) ? data : [];
    renderSuratTable(suratAll);
  } catch(e) {
    document.getElementById('surat-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function filterSurat() {
  const q      = (document.getElementById('sl-q')?.value||'').toLowerCase();
  const type   = document.getElementById('sl-type')?.value||'';
  const status = document.getElementById('sl-status')?.value||'';
  const filtered = suratAll.filter(s=>
    (!q || (s.doc_number||'').toLowerCase().includes(q) ||
           (s.to_name||'').toLowerCase().includes(q) ||
           (s.title||'').toLowerCase().includes(q)) &&
    (!type   || s.letter_type === type) &&
    (!status || s.status === status)
  );
  renderSuratTable(filtered);
}

function renderSuratTable(data) {
  const el = document.getElementById('surat-tbody');
  if (!el) return;
  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="ico">📄</div>
        <h3>${suratAll.length?'Tidak ada hasil':'Belum ada surat'}</h3>
        <p>Klik "+ Buat Surat" untuk membuat surat pertama.</p>
      </div>`; return;
  }
  el.innerHTML = `
    <table>
      <thead><tr>
        <th>No. Dokumen</th><th>Perihal</th><th>Tujuan</th>
        <th>Tipe</th><th>Tanggal</th><th>Dibuat Oleh</th><th>Status</th><th>Aksi</th>
      </tr></thead>
      <tbody>
        ${data.map(s=>{
          const stBadge = s.status==='Sent'?'badge-green':s.status==='Archived'?'badge-gray':'badge-gold';
          const tLabel  = LETTER_TYPES.find(t=>t.key===s.letter_type)?.label || s.letter_type || '—';
          return `<tr>
            <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--navy)">
              ${s.doc_number||'DRAFT'}
            </td>
            <td><div class="td-name">${s.title||'—'}</div></td>
            <td>
              <div style="font-size:13px">${s.to_name||'—'}</div>
              <div class="td-sub">${s.to_pic||''}</div>
            </td>
            <td><span class="badge badge-navy" style="font-size:10px">${tLabel}</span></td>
            <td style="font-size:12px;color:var(--gray)">${formatDateShort(s.letter_date)}</td>
            <td style="font-size:11px;color:var(--gray)">${s.created_by_name||'—'}</td>
            <td><span class="badge ${stBadge}">${s.status||'Draft'}</span></td>
            <td>
              <div class="act-row">
                <button class="act-btn" onclick="regenerateSurat(${s.id})" title="Download DOCX">📥</button>
                <button class="act-btn" onclick="downloadSuratPDF(${s.id})" title="Download PDF">📄</button>
                <button class="act-btn edit" onclick="openSuratForm(${s.id})" title="Edit">✏️</button>
                <button class="act-btn" onclick="updateSuratStatus(${s.id},'Sent')"
                  title="Tandai Terkirim" style="color:#22C55E">✓</button>
                <button class="act-btn del" onclick="deleteSurat(${s.id})">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function switchSuratTab(tab, btn) {
  document.querySelectorAll('#surat-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['list','templates','numbering','panduan'].forEach(t=>{
    const el = document.getElementById(`tab-${t}`);
    if(el) el.style.display = t===tab?'block':'none';
  });
  if(tab==='templates') loadLetterTemplates();
  if(tab==='numbering') loadNumberingSettings();
}

// ── Letter Numbering — Departments, Format Config, Dynamic Generation ──
let letterDepts = [];
let letterNumberFormat = null;

async function loadLetterNumberingConfig() {
  try {
    [letterDepts, letterNumberFormat] = await Promise.all([
      sbGet('letter_departments','select=*&is_active=eq.true&order=dept_name').catch(()=>[]),
      sbGet('letter_number_format','select=*&is_active=eq.true&limit=1').then(d=>d?.[0]).catch(()=>null),
    ]);
    if (!letterNumberFormat) {
      letterNumberFormat = { format_template:'{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}', org_code:'OL', org_city:'Tangerang Selatan', seq_reset_period:'monthly' };
    }
  } catch(e) {
    letterDepts = [];
    letterNumberFormat = { format_template:'{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}', org_code:'OL', org_city:'Tangerang Selatan', seq_reset_period:'monthly' };
  }
}

const NUMBER_FORMAT_TOKENS = [
  { token:'{SEQ}',         label:'Nomor urut (3 digit)',     example:'001' },
  { token:'{SEQ2}',        label:'Nomor urut (2 digit)',     example:'01' },
  { token:'{SEQ4}',        label:'Nomor urut (4 digit)',     example:'0001' },
  { token:'{TYPE}',        label:'Kode tipe surat',          example:'SP' },
  { token:'{DEPT}',        label:'Kode departemen',          example:'OPS' },
  { token:'{ORG}',         label:'Kode organisasi',          example:'OL' },
  { token:'{MONTH}',       label:'Bulan (angka)',            example:'6' },
  { token:'{MONTH_ROMAN}', label:'Bulan (romawi)',           example:'VI' },
  { token:'{YEAR}',        label:'Tahun (4 digit)',          example:'2026' },
  { token:'{YEAR_SHORT}',  label:'Tahun (2 digit)',          example:'26' },
];

async function generateDocNumber(typeCode, deptCode) {
  if (!letterNumberFormat) await loadLetterNumberingConfig();
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth()+1;
  const moR = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][mo];
  const fmt = letterNumberFormat.format_template || '{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}';
  const resetPeriod = letterNumberFormat.seq_reset_period || 'monthly';
  // Sequence key depends on reset period: monthly resets every month, yearly resets every year, never = always increments
  const seqYear  = yr;
  const seqMonth = resetPeriod === 'monthly' ? mo : (resetPeriod === 'yearly' ? 0 : -1);

  try {
    const filters = [`year=eq.${seqYear}`, `month=eq.${seqMonth}`, `type_code=eq.${typeCode}`,
      deptCode ? `dept_code=eq.${deptCode}` : `dept_code=is.null`].join('&');
    const ex = await sbGet('letter_sequences', `select=*&${filters}`);
    let seq = 1;
    if(ex && ex.length > 0){
      seq = (ex[0].last_seq||0) + 1;
      await sbPatch('letter_sequences', ex[0].id, { last_seq: seq });
    } else {
      await sbPost('letter_sequences', { year:seqYear, month:seqMonth, type_code:typeCode, dept_code:deptCode||null, last_seq:1 });
    }
    return applyNumberFormat(fmt, { seq, typeCode, deptCode, orgCode: letterNumberFormat.org_code||'OL', month:mo, monthRoman:moR, year:yr });
  } catch(e) {
    return applyNumberFormat(fmt, { seq: parseInt(Date.now().toString().slice(-4)), typeCode, deptCode, orgCode: letterNumberFormat.org_code||'OL', month:mo, monthRoman:moR, year:yr });
  }
}

function applyNumberFormat(template, { seq, typeCode, deptCode, orgCode, month, monthRoman, year }) {
  return template
    .replace(/\{SEQ4\}/g, String(seq).padStart(4,'0'))
    .replace(/\{SEQ2\}/g, String(seq).padStart(2,'0'))
    .replace(/\{SEQ\}/g,  String(seq).padStart(3,'0'))
    .replace(/\{TYPE\}/g, typeCode||'')
    .replace(/\{DEPT\}/g, deptCode||'')
    .replace(/\{ORG\}/g,  orgCode||'')
    .replace(/\{MONTH_ROMAN\}/g, monthRoman||'')
    .replace(/\{MONTH\}/g, String(month||''))
    .replace(/\{YEAR_SHORT\}/g, String(year||'').slice(-2))
    .replace(/\{YEAR\}/g, String(year||''))
    .replace(/\/\/+/g, '/')   // collapse accidental double slashes (e.g. empty DEPT)
    .replace(/^\/|\/$/g, ''); // trim leading/trailing slash
}

// ── Pengaturan Nomor — UI logic ───────────────────────────
async function loadNumberingSettings() {
  await loadLetterNumberingConfig();
  const tplInput = document.getElementById('nf-template');
  const orgInput = document.getElementById('nf-orgcode');
  const cityInput = document.getElementById('nf-orgcity');
  const resetSel = document.getElementById('nf-reset');
  if (tplInput)  tplInput.value  = letterNumberFormat.format_template || '{SEQ}/{TYPE}/{DEPT}/{ORG}/{MONTH_ROMAN}/{YEAR}';
  if (orgInput)  orgInput.value  = letterNumberFormat.org_code || 'OL';
  if (cityInput) cityInput.value = letterNumberFormat.org_city || 'Tangerang Selatan';
  if (resetSel)  resetSel.value  = letterNumberFormat.seq_reset_period || 'monthly';
  if (tplInput)  tplInput.oninput = updateNumberFormatPreview;
  updateNumberFormatPreview();
  renderDeptList();
}

function addNumberFormatToken(token) {
  const input = document.getElementById('nf-template');
  if (!input) return;
  input.value = input.value ? `${input.value}/${token}` : token;
  updateNumberFormatPreview();
}

function updateNumberFormatPreview() {
  const tpl = document.getElementById('nf-template')?.value || '';
  const preview = document.getElementById('nf-preview');
  if (!preview) return;
  const now = new Date();
  const moR = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][now.getMonth()+1];
  preview.textContent = applyNumberFormat(tpl, {
    seq: 1, typeCode: 'SP', deptCode: 'OPS',
    orgCode: document.getElementById('nf-orgcode')?.value||'OL',
    month: now.getMonth()+1, monthRoman: moR, year: now.getFullYear(),
  }) || '(format kosong)';
}

async function saveNumberFormat() {
  const tpl = document.getElementById('nf-template')?.value.trim();
  if (!tpl) { toast('Format tidak boleh kosong','err'); return; }
  const payload = {
    format_template: tpl,
    org_code:  document.getElementById('nf-orgcode')?.value.trim()||'OL',
    org_city:  document.getElementById('nf-orgcity')?.value.trim()||'Tangerang Selatan',
    seq_reset_period: document.getElementById('nf-reset')?.value||'monthly',
    updated_at: new Date().toISOString(),
  };
  try {
    if (letterNumberFormat?.id) {
      await sbPatch('letter_number_format', letterNumberFormat.id, payload);
    } else {
      await sbPost('letter_number_format', payload);
    }
    toast('✅ Format penomoran disimpan','ok');
    await loadLetterNumberingConfig();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// ── Departemen CRUD ────────────────────────────────
function renderDeptList() {
  const el = document.getElementById('dept-list'); if (!el) return;
  if (!letterDepts.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:14px;text-align:center">Belum ada departemen — klik "+ Tambah"</div>`;
    return;
  }
  el.innerHTML = letterDepts.map(d=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <div>
        <span style="font-family:monospace;font-weight:700;color:var(--teal)">${d.dept_code}</span>
        <span style="color:var(--text3);margin-left:8px">${d.dept_name}</span>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-ghost btn-xs" onclick="openDeptForm(${d.id})">✏️</button>
        <button class="btn btn-ghost btn-xs" onclick="deleteDept(${d.id})" style="color:#EF4444">🗑</button>
      </div>
    </div>`).join('');
}

function openDeptForm(id=null) {
  const d = id ? letterDepts.find(x=>x.id===id) : {};
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit':'+ Tambah'} Departemen</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Kode Departemen *</label>
      <input type="text" id="df-code" value="${d?.dept_code||''}" placeholder="OPS" style="font-family:monospace;text-transform:uppercase" maxlength="6">
    </div>
    <div class="form-group">
      <label>Nama Departemen *</label>
      <input type="text" id="df-name" value="${d?.dept_name||''}" placeholder="Operasional">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveDept(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function saveDept(id) {
  const code = document.getElementById('df-code').value.trim().toUpperCase();
  const name = document.getElementById('df-name').value.trim();
  if (!code || !name) { toast('Kode dan nama wajib diisi','err'); return; }
  try {
    if (id) await sbPatch('letter_departments', id, { dept_code:code, dept_name:name });
    else    await sbPost('letter_departments', { dept_code:code, dept_name:name });
    toast('✅ Departemen disimpan','ok');
    closeModalForce();
    await loadLetterNumberingConfig();
    renderDeptList();
  } catch(e) {
    if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
      toast('❌ Kode departemen sudah dipakai','err');
    } else {
      toast('❌ '+e.message,'err');
    }
  }
}

async function deleteDept(id) {
  if (!confirm('Hapus departemen ini? Surat yang sudah memakai kode ini tidak akan berubah.')) return;
  try {
    await sbPatch('letter_departments', id, { is_active:false });
    toast('🗑 Departemen dihapus','info');
    await loadLetterNumberingConfig();
    renderDeptList();
  } catch(e) { toast('❌ '+e.message,'err'); }
}


// ── Form Buat / Edit ──────────────────────────────
async function openSuratForm(id=null) {
  let s = {};
  if(id){
    const d = await sbGet('outgoing_letters',`select=*&id=eq.${id}`);
    s = d[0]||{};
  }
  await loadLetterNumberingConfig();

  // Load templates
  let tmplOpts = '<option value="">-- Pilih Template DOCX --</option>';
  try {
    const tmpls = await sbGet('marketing_templates',
      'select=id,title,file_url,file_name,content&type=eq.surat&order=title');
    tmplOpts += (tmpls||[]).map(t=>
      `<option value="${t.id}"
        data-url="${t.file_url||''}"
        data-name="${t.file_name||''}"
        data-content="${encodeURIComponent(t.content||'')}">
        ${t.title}
       </option>`).join('');
  } catch(e){}

  // Load partners
  let partnerOpts = '<option value="">-- Pilih dari database partner --</option>';
  try {
    const pts = await sbGet('partners',
      'select=id,partner_name,address,pic_name&order=partner_name&limit=200');
    partnerOpts += (pts||[]).map(p=>
      `<option value="${p.id}"
        data-name="${p.partner_name||''}"
        data-addr="${p.address||''}"
        data-pic="${p.pic_name||''}">
        ${p.partner_name}
       </option>`).join('');
  } catch(e){}

  const today = new Date().toISOString().split('T')[0];
  const user  = getUserName ? getUserName() : 'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Surat':'📄 Buat Surat Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Tipe Surat *</label>
        <select id="sf-type">
          ${LETTER_TYPES.map(t=>`<option value="${t.key}"${s.letter_type===t.key?' selected':''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Departemen</label>
        <select id="sf-dept">
          <option value="">-- Tanpa Kode Departemen --</option>
          ${letterDepts.map(d=>`<option value="${d.dept_code}"${s.dept_code===d.dept_code?' selected':''}>${d.dept_code} — ${d.dept_name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tanggal Surat</label>
        <input type="date" id="sf-date" value="${s.letter_date||today}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>No. Surat</label>
        <input type="text" id="sf-docnumber" value="${s.doc_number||'Otomatis saat disimpan'}" disabled
          style="background:var(--bg2);color:var(--text3);font-style:${s.doc_number?'normal':'italic'}">
      </div>
      <div class="form-group">
        <label>Lampiran</label>
        <input type="text" id="sf-lampiran" value="${s.lampiran||''}" placeholder="1 (satu) berkas / -">
      </div>
    </div>

    <div class="form-group">
      <label>Perihal / Judul *</label>
      <input type="text" id="sf-title" value="${s.title||''}"
        placeholder="Penawaran Kerjasama Layanan Kesehatan Korporat">
    </div>

    <div class="form-group">
      <label>Pilih dari Partner Database</label>
      <select id="sf-partner" onchange="fillSuratPartner(this)">
        ${partnerOpts}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nama Perusahaan / Instansi *</label>
        <input type="text" id="sf-to-name" value="${s.to_name||''}"
          placeholder="PT. Contoh Perusahaan">
      </div>
      <div class="form-group">
        <label>Kepada Yth. (PIC)</label>
        <input type="text" id="sf-to-pic" value="${s.to_pic||''}"
          placeholder="Bapak/Ibu HRD Manager">
      </div>
    </div>

    <div class="form-group">
      <label>Alamat Tujuan</label>
      <input type="text" id="sf-to-addr" value="${s.to_address||''}" placeholder="Jl. ...">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Penandatangan (Atas Nama)</label>
        <input type="text" id="sf-signer" value="${s.signer||user}"
          placeholder="Nama yang tanda tangan surat">
      </div>
      <div class="form-group">
        <label>Jabatan Penandatangan</label>
        <input type="text" id="sf-signer-jabatan" value="${s.signer_jabatan||'Head of Operations'}"
          placeholder="Head of Operations">
      </div>
    </div>

    <!-- Template DOCX -->
    <div style="border:1.5px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">
        📄 Template DOCX
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label>Pilih Template yang Sudah Diupload</label>
        <select id="sf-template" onchange="onSelectSuratTemplate(this)">
          ${tmplOpts}
        </select>
      </div>
      <div id="sf-template-info" style="display:none;padding:10px;background:var(--mint);border-radius:8px;font-size:12px;color:#085041;margin-bottom:10px"></div>

      <div style="font-size:12px;color:var(--gray);margin-bottom:8px">— atau upload template baru —</div>
      ${renderUploadArea('sf-file','sf-file-preview',
        ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword'])}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-outline" onclick="previewSuratHTML()" title="Preview generik — bukan render dari file DOCX yang diupload">👁 Preview HTML (Generik)</button>
      <button class="btn btn-teal" id="sf-save-btn" onclick="saveSurat(${id||'null'})">
        ${id?'💾 Simpan':'📄 Buat & Download'}
      </button>
    </div>`);
}

function fillSuratPartner(sel) {
  const opt = sel.options[sel.selectedIndex];
  if(!opt.value) return;
  document.getElementById('sf-to-name').value = opt.dataset.name||'';
  document.getElementById('sf-to-addr').value = opt.dataset.addr||'';
  document.getElementById('sf-to-pic').value  = opt.dataset.pic
    ? `Bapak/Ibu ${opt.dataset.pic}` : '';
}

function onSelectSuratTemplate(sel) {
  const opt  = sel.options[sel.selectedIndex];
  const info = document.getElementById('sf-template-info');
  if(!opt.value){ info.style.display='none'; return; }
  info.style.display = 'block';
  info.innerHTML = `✅ Template dipilih: <strong>${opt.textContent.trim()}</strong><br>
    File: <strong>${opt.dataset.name||'—'}</strong>`;
}

// ── Save Surat ────────────────────────────────────
async function saveSurat(id) {
  const title  = document.getElementById('sf-title').value.trim();
  const toName = document.getElementById('sf-to-name').value.trim();
  if(!title)  { toast('Perihal wajib diisi','err'); return; }
  if(!toName) { toast('Nama tujuan wajib diisi','err'); return; }

  const btn  = document.getElementById('sf-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }

  const user      = getUserName ? getUserName() : 'User';
  const typeCode  = document.getElementById('sf-type').value;
  const deptCode  = document.getElementById('sf-dept')?.value || null;
  const docNumber = id
    ? (await sbGet('outgoing_letters',`select=doc_number&id=eq.${id}`))[0]?.doc_number
    : await generateDocNumber(typeCode, deptCode);

  // Upload template baru jika ada
  let fileUrl  = '';
  let fileName = '';
  const tmplSel = document.getElementById('sf-template');
  const tmplOpt = tmplSel?.options[tmplSel.selectedIndex];

  if(tmplOpt?.value) {
    fileUrl  = tmplOpt.dataset.url  || '';
    fileName = tmplOpt.dataset.name || '';
  }

  const newFile = document.getElementById('sf-file')?.files?.[0];
  if(newFile) {
    try {
      const up = await uploadFile(newFile, 'templates', 'surat');
      fileUrl  = up.url;
      fileName = up.name;
    } catch(e) {
      toast('❌ Gagal upload template: '+e.message,'err');
      if(btn){ btn.disabled=false; btn.textContent=id?'💾 Simpan':'📄 Buat & Download'; }
      return;
    }
  }

  // Warn explicitly if no template selected — avoids silent fallback to generic HTML
  if (!fileUrl && !id) {
    const proceed = confirm(
      'Belum ada template DOCX yang dipilih atau diupload.\n\n' +
      'Surat akan dibuat dengan PREVIEW HTML generik (bukan dari file template Anda).\n\n' +
      'Lanjutkan tanpa template DOCX?'
    );
    if (!proceed) {
      if(btn){ btn.disabled=false; btn.textContent='📄 Buat & Download'; }
      return;
    }
  }

  const payload = {
    doc_number:      docNumber,
    title,
    letter_type:     typeCode,
    dept_code:       deptCode,
    letter_date:     document.getElementById('sf-date').value,
    lampiran:        document.getElementById('sf-lampiran').value.trim(),
    to_name:         toName,
    to_pic:          document.getElementById('sf-to-pic').value.trim(),
    to_address:      document.getElementById('sf-to-addr').value.trim(),
    signer:          document.getElementById('sf-signer').value.trim()||user,
    signer_jabatan:  document.getElementById('sf-signer-jabatan').value.trim()||'Head of Operations',
    file_url:        fileUrl,
    file_name:       fileName,
    status:          'Draft',
    created_by_name: user,
    updated_at:      new Date().toISOString(),
  };

  try {
    let savedId = id;
    if(id) {
      await sbPatch('outgoing_letters', id, payload);
      toast('✅ Surat diupdate','ok');
    } else {
      const res = await sbPost('outgoing_letters', payload);
      savedId = res[0]?.id;
      toast('✅ Surat dibuat: '+docNumber,'ok');
      await logActivity('create','outgoing_letters', savedId,
        `Surat baru: ${docNumber} — ${title}`, title);
    }
    closeModalForce();
    await loadSuratList();

    // Generate DOCX
    if(fileUrl) {
      setTimeout(() => generateDocx(savedId, payload, fileUrl), 400);
    } else {
      // Fallback HTML print
      setTimeout(() => previewSuratHTMLDirect(payload), 400);
    }
  } catch(e) {
    toast('❌ '+e.message,'err');
    if(btn){ btn.disabled=false; btn.textContent=id?'💾 Simpan':'📄 Buat & Download'; }
  }
}

// ── Generate DOCX dari template ───────────────────
async function generateDocx(id, data, templateUrl, mode='download') {
  try {
    toast('⏳ Memuat library DOCX...','info',4000);
    // Load library docxtemplater + pizzip
    await loadDocxLibraries();

    if (!window.PizZip || !window.docxtemplater) {
      throw new Error('Library DOCX gagal dimuat (kemungkinan CDN diblokir/offline).');
    }

    toast('⏳ Memproses template DOCX...','info',5000);

    // Fetch template file
    const res = await fetch(templateUrl);
    if (!res.ok) {
      throw new Error(`File template tidak bisa diakses (HTTP ${res.status}). Cek apakah bucket "templates" sudah di-set Public di Supabase Storage.`);
    }
    const blob = await res.arrayBuffer();

    const PizZip = window.PizZip;
    const Docxtemplater = window.docxtemplater;

    const zip = new PizZip(blob);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      // IMPORTANT: explicit [[ ]] delimiters instead of default {{ }}.
      // The default {{ }} delimiter has a confirmed lexer bug in this version
      // of docxtemplater that throws false "Duplicate open/close tag" errors
      // even on perfectly valid templates (reproduced on a minimal hand-built
      // test file with a single placeholder). [[ ]] avoids this entirely.
      delimiters: { start: '[[', end: ']]' },
    });

    // Build variables
    const dateStr = data.letter_date
      ? new Date(data.letter_date).toLocaleDateString('id-ID',
          {day:'numeric',month:'long',year:'numeric'})
      : new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    if (!letterNumberFormat) await loadLetterNumberingConfig();
    const dateKotaStr = `${letterNumberFormat?.org_city||ORG.city}, ${dateStr}`;

    const now  = new Date();
    const moR  = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'][now.getMonth()];

    doc.render({
      NO_SURAT:      data.doc_number   || '',
      TANGGAL:       dateStr,
      TANGGAL_KOTA:  dateKotaStr,
      LAMPIRAN:      data.lampiran     || '-',
      PERIHAL:       data.title        || '',
      NAMA_TUJUAN:   data.to_name      || '',
      ALAMAT_TUJUAN: data.to_address   || '',
      PIC_TUJUAN:    data.to_pic       || 'Bapak/Ibu Pimpinan',
      ORG_NAMA:      ORG.name,
      ORG_ALAMAT:    ORG.addr,
      PENANDATANGAN: data.signer || data.created_by_name || 'Pimpinan',
      JABATAN:       data.signer_jabatan || data.jabatan || 'Head of Operations',
      BULAN_TAHUN:   `${moR} ${now.getFullYear()}`,
      TAHUN:         String(now.getFullYear()),
    });

    const output = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const fname = `${data.doc_number||'Surat'}_${data.to_name||''}.docx`
      .replace(/[\/\\:*?"<>|]/g,'_');

    if (mode === 'blob') {
      return { blob: output, fileName: fname };
    }

    // Show preview modal with the actual rendered DOCX (via docx-preview library),
    // plus Download DOCX + Print/Save PDF buttons.
    // This gives the user a chance to review before downloading, and lets them
    // save as PDF directly using the browser's print dialog (vector quality,
    // searchable text, exact layout from their Word template).
    await showDocxPreviewModal(output, fname);

  } catch(e) {
    console.error('[generateDocx] Failed:', e);
    let hint = e.message;

    // Try to extract the specific broken tag name from docxtemplater's detailed
    // error list, so the user knows exactly which placeholder to fix in Word.
    let brokenTagInfo = '';
    const errList = e.properties?.errors || (Array.isArray(e.errors) ? e.errors : null);
    if (errList?.length) {
      const tagNames = errList
        .map(err => err.properties?.context || err.properties?.xtag)
        .filter(Boolean);
      if (tagNames.length) brokenTagInfo = ` Tag bermasalah: "${tagNames.join('", "')}".`;
    }

    if (e.message?.includes('Duplicate') || errList?.some(err=>err.name==='TemplateError'&&/duplicate/i.test(err.message||''))) {
      hint = `Template ini masih pakai format placeholder lama {{NAMA}}.${brokenTagInfo} Format kurung kurawal punya bug — sistem sekarang pakai format [[NAMA]] (kurung siku ganda). `
           + `Buka file Word, ganti semua {{ jadi [[ dan }} jadi ]] (pakai Find & Replace Ctrl+H), simpan, lalu upload ulang. `
           + `Lihat tab Panduan untuk detail.`;
    } else if (e.message?.includes('Multi error') || e.properties?.errors) {
      // Docxtemplater template syntax error — usually wrong [[VARIABEL]] naming
      hint = `Template DOCX punya placeholder tidak valid.${brokenTagInfo} Pastikan pakai format [[NO_SURAT]], [[TANGGAL]], [[PERIHAL]], dst (lihat panduan placeholder di tab Panduan).`;
    }
    toast('❌ Gagal generate DOCX: '+hint,'err',9000);

    if (mode === 'blob') {
      // Called from PDF download flow — don't show the HTML-fallback confirm
      // dialog (irrelevant there), just propagate the error upward.
      throw new Error(hint);
    }

    if (confirm('Gagal generate dari template DOCX.\n\nError: ' + hint + '\n\nTampilkan layout cadangan generik sebagai gantinya? (Catatan: ini BUKAN tampilan dari file Word asli Anda, hanya placeholder darurat)')) {
      previewSuratHTMLDirect(data);
    }
  }
}

async function regenerateSurat(id) {
  toast('⏳ Memproses dokumen...','info',2000);
  try {
    const d = await sbGet('outgoing_letters',`select=*&id=eq.${id}`);
    const s = d[0];
    if (!s) { toast('❌ Surat tidak ditemukan (mungkin sudah dihapus)','err'); return; }
    if (s.file_url) {
      await generateDocx(id, s, s.file_url);
    } else {
      toast('⚠️ Surat ini tidak punya file template DOCX terlampir — menampilkan preview HTML generik.','warn',5000);
      previewSuratHTMLDirect(s);
    }
  } catch(e) {
    console.error('[regenerateSurat] Failed:', e);
    toast('❌ Gagal memuat surat: '+e.message,'err',6000);
  }
}

// ── Download sebagai PDF (via Supabase Edge Function -> ConvertAPI) ──
// Menghasilkan PDF pixel-perfect sesuai template Word asli, bukan layout
// generik. Membutuhkan Edge Function "docx-to-pdf" sudah di-deploy dan
// secret CONVERTAPI_TOKEN sudah diset di dashboard Supabase.
async function downloadSuratPDF(id) {
  toast('⏳ Menyiapkan PDF...','info',3000);
  try {
    const d = await sbGet('outgoing_letters',`select=*&id=eq.${id}`);
    const s = d[0];
    if (!s) { toast('❌ Surat tidak ditemukan','err'); return; }
    if (!s.file_url) {
      toast('⚠️ Surat ini tidak punya template DOCX — tidak bisa diconvert ke PDF pixel-perfect. Gunakan preview HTML generik sebagai alternatif.','warn',6000);
      return;
    }

    toast('⏳ Membuat dokumen DOCX...','info',4000);
    const { blob, fileName } = await generateDocx(id, s, s.file_url, 'blob');

    toast('⏳ Mengonversi ke PDF...','info',8000);
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const fileBase64 = btoa(binary);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/docx-to-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, fileName }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(()=>({}));
      throw new Error(errBody.error || `Edge Function error (HTTP ${res.status}). Pastikan function "docx-to-pdf" sudah di-deploy.`);
    }

    const result = await res.json();
    if (!result.pdfBase64) throw new Error('Edge Function tidak mengembalikan file PDF.');

    // Convert base64 -> blob -> trigger download
    const pdfBinary = atob(result.pdfBase64);
    const pdfBytes = new Uint8Array(pdfBinary.length);
    for (let i = 0; i < pdfBinary.length; i++) pdfBytes[i] = pdfBinary.charCodeAt(i);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    const pdfName = fileName.replace(/\.docx$/i, '.pdf');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdfBlob);
    a.download = pdfName;
    a.click();
    toast('✅ PDF berhasil didownload!','ok');

  } catch(e) {
    console.error('[downloadSuratPDF] Failed:', e);
    let hint = e.message;
    if (hint?.includes('Failed to fetch') || hint?.includes('404')) {
      hint = 'Edge Function "docx-to-pdf" belum ter-deploy di Supabase. Lihat tab Panduan untuk cara setup.';
    }
    toast('❌ Gagal download PDF: '+hint,'err',8000);
  }
}

// ── Load docxtemplater libraries ──────────────────
// ── DOCX Preview Modal — shows the actual rendered DOCX then offers
// Download DOCX or Print/Save PDF via browser print dialog ──────────

let _docxPreviewBlobUrl = null; // track for revoke on close

function loadDocxPreviewLibrary() {
  return new Promise((resolve, reject) => {
    if (window.docx?.renderAsync) { resolve(); return; }
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout memuat docx-preview library'));
    }, 10000);

    // JSZip must load first (docx-preview depends on it)
    function loadJSZip() {
      if (window.JSZip) { loadDocxPreviewLib(); return; }
      const s = document.createElement('script');
      s.src = 'vendor/jszip.min.js';
      s.onerror = () => { clearTimeout(timeoutId); reject(new Error('Gagal memuat JSZip dari vendor/')); };
      s.onload = loadDocxPreviewLib;
      document.head.appendChild(s);
    }
    function loadDocxPreviewLib() {
      const s = document.createElement('script');
      s.src = 'vendor/docx-preview.min.js';
      s.onerror = () => { clearTimeout(timeoutId); reject(new Error('Gagal memuat docx-preview dari vendor/')); };
      s.onload = () => { clearTimeout(timeoutId); resolve(); };
      document.head.appendChild(s);
    }
    loadJSZip();
  });
}

async function showDocxPreviewModal(blob, fileName) {
  // Open modal immediately with loading state so user sees feedback right away
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📄 Preview Surat — ${fileName}</div>
      <button class="modal-close" onclick="closeDocxPreviewModal()">✕</button>
    </div>
    <div id="docx-preview-toolbar" style="display:flex;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);margin-bottom:10px;flex-wrap:wrap">
      <button class="btn btn-teal" onclick="downloadCurrentDocx()" id="btn-dl-docx">
        ⬇️ Download DOCX
      </button>
      <button class="btn btn-outline" onclick="printDocxPreview()" id="btn-pdf">
        🖨 Print / Save PDF
      </button>
      <div style="font-size:11px;color:var(--text3);margin-left:auto">
        Untuk save sebagai PDF: klik Print → pilih "Save as PDF" di printer
      </div>
    </div>
    <div id="docx-preview-container"
      style="min-height:400px;background:#f5f5f5;border-radius:8px;overflow:auto;padding:20px;display:flex;justify-content:center">
      <div class="spinner" style="margin-top:80px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeDocxPreviewModal()">Tutup</button>
    </div>
  `, 'docx-preview-modal');
  if (_docxPreviewBlobUrl) URL.revokeObjectURL(_docxPreviewBlobUrl);
  _docxPreviewBlobUrl = URL.createObjectURL(blob);
  window.__docxPreviewBlob = blob;
  window.__docxPreviewFileName = fileName;

  // Load docx-preview library then render
  try {
    await loadDocxPreviewLibrary();
  } catch(e) {
    document.getElementById('docx-preview-container').innerHTML =
      `<div class="status-box status-warn" style="margin:20px">
        ⚠️ Tidak bisa menampilkan preview DOCX (${e.message}).
        Anda masih bisa <button class="btn btn-teal btn-sm" onclick="downloadCurrentDocx()">⬇️ Download DOCX</button> langsung.
      </div>`;
    return;
  }

  // Render DOCX blob into the preview container
  const container = document.getElementById('docx-preview-container');
  if (!container) return;
  try {
    container.innerHTML = ''; // clear spinner
    // docx-preview renders into the container element with full Word-like styling
    await window.docx.renderAsync(blob, container, null, {
      className: 'docx-preview-content',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      useBase64URL: true,
    });
    toast('✅ Surat berhasil dirender — siap download atau print sebagai PDF','ok',4000);
  } catch(e) {
    container.innerHTML =
      `<div class="status-box status-warn" style="margin:20px">
        ⚠️ Preview gagal: ${e.message}.<br>
        Anda masih bisa <button class="btn btn-teal btn-sm" onclick="downloadCurrentDocx()">⬇️ Download DOCX</button>.
      </div>`;
    console.error('[showDocxPreviewModal] renderAsync failed:', e);
  }
}

function closeDocxPreviewModal() {
  if (_docxPreviewBlobUrl) {
    URL.revokeObjectURL(_docxPreviewBlobUrl);
    _docxPreviewBlobUrl = null;
  }
  window.__docxPreviewBlob = null;
  closeModalForce();
}

function downloadCurrentDocx() {
  const blob     = window.__docxPreviewBlob;
  const fileName = window.__docxPreviewFileName;
  if (!blob) { toast('File tidak tersedia','err'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  toast('✅ DOCX didownload!','ok');
}

function printDocxPreview() {
  // Open a new window with just the docx-preview content + print CSS,
  // then trigger window.print() so the user can Save as PDF from the browser dialog.
  const container = document.getElementById('docx-preview-container');
  if (!container) { toast('Preview belum tersedia','warn'); return; }

  const w = window.open('','_blank','width=900,height=700');
  if (!w) {
    toast('⚠️ Popup diblokir — izinkan popup untuk domain ini, lalu coba lagi','warn',5000);
    return;
  }
  // Copy the rendered HTML including all inline styles from docx-preview
  w.document.write(`
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${window.__docxPreviewFileName||'Surat'}</title>
    <style>
      @page { size: A4; margin: 0 }
      body { margin: 0; padding: 0; background: white }
      .docx-preview-content { width: 100% !important }
      @media print { button { display: none !important } }
    </style>
    </head><body>
    ${container.innerHTML}
    <script>window.print()<\/script>
    </body></html>`);
  w.document.close();
}

function loadDocxLibraries() {
  return new Promise((resolve, reject) => {
    if(window.PizZip && window.docxtemplater){ resolve(); return; }

    // Safety net: if scripts never fire onload/onerror, don't hang forever.
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout memuat library DOCX (10 detik). Cek apakah folder /vendor/ ter-deploy dengan benar.'));
    }, 10000);

    // Bundled locally — no external CDN dependency, so this works even when
    // cdnjs.cloudflare.com (or any external CDN) is blocked by firewall/network
    // policy. This was the root cause of "Gagal memuat PizZip dari CDN" errors.
    const localBase = 'vendor/';
    const cdnBase = 'https://cdnjs.cloudflare.com/ajax/libs/';
    let triedFallback = false;

    function loadScript(src, onSuccess, onFail) {
      const tag = document.createElement('script');
      tag.src = src;
      tag.onerror = onFail;
      tag.onload = onSuccess;
      document.head.appendChild(tag);
    }

    function loadPizZip(useFallback) {
      const src = useFallback ? cdnBase+'pizzip/3.1.4/pizzip.min.js' : localBase+'pizzip.min.js';
      loadScript(src, loadDocxtemplater, () => {
        if (!useFallback) { loadPizZip(true); return; } // try CDN as fallback
        clearTimeout(timeoutId);
        reject(new Error('Gagal memuat PizZip baik dari lokal (/vendor/) maupun CDN cdnjs.cloudflare.com. Cek deployment atau koneksi internet.'));
      });
    }

    function loadDocxtemplater(useFallback) {
      useFallback = useFallback === true || triedFallback;
      const src = useFallback ? cdnBase+'docxtemplater/3.37.12/docxtemplater.js' : localBase+'docxtemplater.min.js';
      loadScript(src, () => { clearTimeout(timeoutId); resolve(); }, () => {
        if (!useFallback) { triedFallback = true; loadDocxtemplater(true); return; }
        clearTimeout(timeoutId);
        reject(new Error('Gagal memuat Docxtemplater baik dari lokal (/vendor/) maupun CDN cdnjs.cloudflare.com. Cek deployment atau koneksi internet.'));
      });
    }

    loadPizZip(false);
  });
}

// ── Fallback: Preview HTML ────────────────────────
function previewSuratHTML() {
  const data = {
    doc_number:  'PREVIEW',
    title:       document.getElementById('sf-title')?.value||'',
    letter_type: document.getElementById('sf-type')?.value||'',
    letter_date: document.getElementById('sf-date')?.value||'',
    to_name:     document.getElementById('sf-to-name')?.value||'',
    to_pic:      document.getElementById('sf-to-pic')?.value||'',
    to_address:  document.getElementById('sf-to-addr')?.value||'',
    created_by_name: getUserName?getUserName():'User',
  };
  previewSuratHTMLDirect(data);
}

function previewSuratHTMLDirect(s) {
  const html = buildSuratPreviewHTML(s);

  // Try opening as a popup window first (lets the user print/save as PDF easily).
  // If the browser/extension blocks it, window.open returns null instead of
  // throwing — that null was previously crashing on w.document.write with
  // "Cannot read properties of null (reading 'document')". Fall back to an
  // in-page modal instead of failing silently.
  let w = null;
  try { w = window.open('','_blank','width=900,height=700'); } catch(e) { w = null; }

  if (w) {
    try {
      w.document.write(html);
      w.document.close();
      return;
    } catch(e) {
      console.error('[previewSuratHTMLDirect] Popup write failed:', e);
      // fall through to inline modal below
    }
  }

  // Popup blocked or failed — show inline instead, with a clear explanation
  // and a manual "open as popup" retry button.
  toast('⚠️ Popup diblokir browser — preview ditampilkan di dalam halaman','warn',4000);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📄 Preview Generik (Bukan Template Asli)</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="status-box status-warn" style="margin-bottom:10px;font-size:12px">
      ⚠️ Ini adalah <strong>layout cadangan generik</strong>, BUKAN rendering dari file Word/DOCX yang Anda upload.
      Tampilan ini hanya jalan darurat saat generate dari template asli gagal — desainnya tidak akan sama
      dengan template Word Anda. Browser juga memblokir popup, jadi tampil di dalam halaman ini.
      Untuk fitur Print, izinkan popup untuk domain ini di pengaturan browser, lalu klik "Buka di Tab Baru" di bawah.
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;max-height:60vh;overflow:auto">
      <iframe id="surat-preview-iframe" style="width:100%;height:60vh;border:none"></iframe>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal" onclick="retryOpenSuratPreviewPopup()">↗️ Coba Buka di Tab Baru</button>
    </div>`,'wide');

  // Render the same HTML into the iframe so the user can still see/print it
  window.__lastSuratPreviewHTML = html;
  setTimeout(() => {
    const iframe = document.getElementById('surat-preview-iframe');
    if (iframe) {
      const doc = iframe.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
    }
  }, 50);
}

function retryOpenSuratPreviewPopup() {
  const html = window.__lastSuratPreviewHTML;
  if (!html) return;
  const w = window.open('','_blank','width=900,height=700');
  if (!w) {
    toast('❌ Popup masih diblokir — izinkan popup untuk domain ini di pengaturan browser (ikon 🚫 di address bar)','err',6000);
    return;
  }
  w.document.write(html);
  w.document.close();
  closeModalForce();
}

function buildSuratPreviewHTML(s) {
  const tLabel  = LETTER_TYPES.find(t=>t.key===s.letter_type)?.label||s.letter_type||'';
  const dateStr = s.letter_date
    ? new Date(s.letter_date).toLocaleDateString('id-ID',
        {day:'numeric',month:'long',year:'numeric'}) : '';
  const moR     = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember']
                   [new Date().getMonth()];

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${s.doc_number}</title>
    <style>
      @page{size:A4;margin:2.5cm 2.5cm 2.5cm 3cm}
      *{box-sizing:border-box}
      body{font-family:'Times New Roman',serif;font-size:12pt;color:#000;line-height:1.6;margin:0;padding:20px}
      .header{border-bottom:3px double #0A2342;padding-bottom:10px;margin-bottom:20px;display:flex;gap:14px;align-items:center}
      .logo{width:52px;height:52px;background:#0A2342;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:Arial;flex-shrink:0}
      .org-name{font-size:14pt;font-weight:bold;color:#0A2342}
      .org-sub{font-size:9pt;color:#555;margin-top:2px}
      .info{margin-bottom:20px}
      .info table td{padding:2px 0;vertical-align:top}
      .info td:first-child{width:150px;color:#333}
      .salut{margin:20px 0 8px}
      .sig{margin-top:50px}
      .sig-line{border-top:1px solid #000;display:inline-block;min-width:180px;padding-top:4px;margin-top:60px}
      @media print{.no-print{display:none}}
    </style></head><body>
    <button class="no-print" onclick="window.print()"
      style="position:fixed;top:16px;right:16px;padding:10px 20px;background:#0A2342;
      color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;z-index:999">
      🖨 Print / Save PDF
    </button>
    <div class="header">
      <div class="logo">OL</div>
      <div>
        <div class="org-name">${ORG.name}</div>
        <div class="org-sub">${ORG.addr}</div>
        <div class="org-sub">Tel: ${ORG.phone} | ${ORG.email}</div>
      </div>
    </div>
    <div class="info"><table>
      <tr><td>Nomor</td><td>: ${s.doc_number||'—'}</td></tr>
      <tr><td>Lampiran</td><td>: ${s.lampiran||'-'}</td></tr>
      <tr><td>Perihal</td><td>: ${s.title||'—'}</td></tr>
      <tr><td>Tanggal</td><td>: ${dateStr}</td></tr>
      <tr><td>Jenis</td><td>: ${tLabel}</td></tr>
    </table></div>
    <p>Kepada Yth.<br>
    <strong>${s.to_pic||'Bapak/Ibu Pimpinan'}</strong><br>
    <strong>${s.to_name||'—'}</strong><br>
    ${s.to_address||''}<br>di Tempat</p>
    <div class="salut"><p>Dengan hormat,</p></div>
    <p>Sehubungan dengan hal tersebut di atas, kami dari <strong>${ORG.name}</strong>
    dengan ini mengajukan penawaran kerjasama layanan kesehatan preventif.</p>
    <p>Demikian surat ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
    <div class="sig">
      <p>Tangerang Selatan, ${dateStr}</p>
      <p>Hormat kami,<br><strong>${ORG.name}</strong></p>
      <div class="sig-line">${s.signer||s.created_by_name||'Pimpinan'}<br>
      <span style="font-size:10pt;font-weight:normal">${s.signer_jabatan||'Head of Operations'}</span></div>
    </div>
    </body></html>`;
}

// ── Templates ─────────────────────────────────────
async function loadLetterTemplates() {
  const el = document.getElementById('templates-grid');
  if(!el) return;
  try {
    const data = await sbGet('marketing_templates',
      'select=*&type=eq.surat&order=created_at.desc');
    if(!data?.length){
      el.innerHTML=`
        <div class="empty-state" style="grid-column:1/-1">
          <div class="ico">📄</div>
          <h3>Belum ada template surat</h3>
          <p>Klik "⬆ Upload Template DOCX" untuk mulai.<br>
          Lihat tab <strong>Panduan</strong> untuk cara membuat template.</p>
        </div>`; return;
    }
    el.innerHTML = data.map(t=>`
      <div class="card">
        <div style="font-size:16px;margin-bottom:8px">📝</div>
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${t.title}</div>
        <div style="font-size:11px;color:var(--gray);margin-bottom:10px">
          ${t.file_name||'—'} · ${timeAgo(t.created_at)}
        </div>
        ${t.file_url?`
          <a href="${t.file_url}" target="_blank" download
            class="btn btn-teal btn-sm" style="text-decoration:none;display:block;text-align:center;margin-bottom:6px">
            ⬇️ Download Template
          </a>`:'' }
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" onclick="openMktForm(${t.id})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMkt(${t.id},'${(t.title||'').replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </div>`).join('');
  } catch(e){ el.innerHTML=`<div class="status-box status-err">❌ ${e.message}</div>`; }
}

function openUploadTemplateForm() {
  // Pakai form marketing dengan tipe surat
  openMktForm(null, 'surat');
}

async function updateSuratStatus(id, status) {
  try {
    await sbPatch('outgoing_letters', id, {status, updated_at:new Date().toISOString()});
    toast(`✅ Status → ${status}`,'ok');
    await loadSuratList();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function deleteSurat(id) {
  if(!confirm('Hapus surat dari arsip?')) return;
  try {
    await sbDelete('outgoing_letters', id);
    toast('🗑 Surat dihapus','info');
    await loadSuratList();
  } catch(e){ toast('❌ '+e.message,'err'); }
}
