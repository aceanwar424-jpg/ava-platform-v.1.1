// ═══════════════════════════════════════════
// MODULE: MOU / Perjanjian Kerjasama
// ═══════════════════════════════════════════

const MOU_STATUSES = ['Draft','Review Internal','Review Partner','Revisi','Ditandatangani','Aktif','Expired','Terminasi'];
const MOU_STATUS_COLORS = {
  'Draft':'#94A3B8','Review Internal':'#0EA5E9','Review Partner':'#8B5CF6',
  'Revisi':'#F97316','Ditandatangani':'#06B6D4','Aktif':'#22C55E','Expired':'#EF4444','Terminasi':'#6B7280'
};

let mouAll = [];

async function renderMOU() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>MOU / Perjanjian Kerjasama</h1>
        <p>Kelola semua dokumen perjanjian dengan mitra OneLab</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="exportMOUCSV()">📥 CSV</button>
        <button class="btn btn-teal" onclick="openMOUForm()">+ Buat MOU</button>
      </div>
    </div>

    <!-- Status summary -->
    <div id="mou-summary" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"></div>

    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="mou-q" placeholder="🔍 Cari nomor, partner, judul..."
          oninput="filterMOU()" style="flex:1">
        <select class="table-filter" id="mou-status-f" onchange="filterMOU()">
          <option value="">Semua Status</option>
          ${MOU_STATUSES.map(s=>`<option>${s}</option>`).join('')}
        </select>
      </div>
      <div id="mou-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadMOUs();
}

async function loadMOUs() {
  try {
    const data = await sbGet('mous','select=*&order=created_at.desc');
    mouAll = Array.isArray(data) ? data : [];
    renderMOUSummary();
    filterMOU();
  } catch(e) {
    document.getElementById('mou-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function renderMOUSummary() {
  const el = document.getElementById('mou-summary');
  if (!el) return;
  const counts = {};
  MOU_STATUSES.forEach(s=>counts[s]=0);
  mouAll.forEach(m=>{ if(counts[m.status]!==undefined) counts[m.status]++; });
  el.innerHTML = ['Aktif','Ditandatangani','Review Internal','Expired'].map(s=>`
    <div style="padding:8px 14px;background:#fff;border-radius:8px;border:1.5px solid ${MOU_STATUS_COLORS[s]}30">
      <div style="font-size:18px;font-weight:800;color:${MOU_STATUS_COLORS[s]}">${counts[s]}</div>
      <div style="font-size:10px;color:var(--gray)">${s}</div>
    </div>`).join('');
}

function filterMOU() {
  const q = (document.getElementById('mou-q')?.value||'').toLowerCase();
  const st = document.getElementById('mou-status-f')?.value||'';
  const filtered = mouAll.filter(m=>
    (!q || ['mou_number','title','partner_name'].some(k=>(m[k]||'').toLowerCase().includes(q))) &&
    (!st || m.status===st)
  );
  renderMOUTable(filtered);
}

function renderMOUTable(data) {
  const el = document.getElementById('mou-tbody');
  if (!data.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">📜</div>
      <h3>${mouAll.length?'Tidak ada hasil':'Belum ada MOU'}</h3>
      <p>Buat MOU baru atau generate dari Output Kerjasama.</p></div>`; return;
  }
  el.innerHTML = `<table>
    <thead><tr>
      <th>No. MOU</th><th>Judul</th><th>Partner</th><th>Nilai</th>
      <th>Periode</th><th>Status</th><th>Dibuat</th><th>Aksi</th>
    </tr></thead>
    <tbody>${data.map(m=>{
      const col = MOU_STATUS_COLORS[m.status]||'#94A3B8';
      const expiring = m.end_date && new Date(m.end_date) < new Date(Date.now()+30*86400000);
      return `<tr>
        <td style="font-family:monospace;font-size:11px;font-weight:700;color:var(--teal)">${m.mou_number||'DRAFT'}</td>
        <td><div style="font-weight:600;color:var(--navy)">${m.title}</div></td>
        <td style="font-size:12px">${m.partner_name||'—'}</td>
        <td style="font-size:12px;font-weight:600">${m.value?formatCurrency(m.value):'—'}</td>
        <td style="font-size:11px;color:var(--gray)">
          ${formatDateShort(m.start_date)} → ${formatDateShort(m.end_date)}
          ${expiring&&m.status==='Aktif'?'<br><span style="color:#F59E0B;font-size:10px">⚠️ Segera expired</span>':''}
        </td>
        <td><span style="background:${col}20;color:${col};padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700">${m.status}</span></td>
        <td style="font-size:11px;color:var(--gray)">${m.created_by_name||'—'}</td>
        <td><div class="act-row">
          ${m.file_url?`<a href="${m.file_url}" target="_blank" class="act-btn" title="Download">📥</a>`:''}
          <button class="act-btn edit" onclick="openMOUForm(${m.id})">✏️</button>
          <button class="act-btn del" onclick="deleteMOU(${m.id})">🗑</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function openMOUForm(id=null) {
  let m = {};
  if (id) { const d = await sbGet('mous',`select=*&id=eq.${id}`); m=d[0]||{}; }

  let partnerOpts = '<option value="">-- Pilih Partner --</option>';
  try {
    const pts = await sbGet('partners','select=id,partner_name&order=partner_name&limit=200');
    partnerOpts += (pts||[]).map(p=>`<option value="${p.id}"${m.partner_id===p.id?' selected':''}>${p.partner_name}</option>`).join('');
  } catch(e) {}

  const today = new Date().toISOString().split('T')[0];
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit MOU':'📜 Buat MOU Baru'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>No. MOU</label>
        <input type="text" id="mf-num" value="${m.mou_number||''}" placeholder="Otomatis jika kosong">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="mf-status">
          ${MOU_STATUSES.map(s=>`<option${(m.status||'Draft')===s?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Judul MOU *</label>
        <input type="text" id="mf-title" value="${m.title||''}"
          placeholder="MOU Kerjasama Layanan MCU Karyawan PT. ABC">
      </div>
      <div class="form-group">
        <label>Partner</label>
        <select id="mf-partner" onchange="autoFillMOUPartner(this)">${partnerOpts}</select>
      </div>
      <div class="form-group">
        <label>Nama Partner (manual)</label>
        <input type="text" id="mf-partner-name" value="${m.partner_name||''}" placeholder="Jika tidak ada di database">
      </div>
      <div class="form-group">
        <label>Nilai Kerjasama (Rp)</label>
        <input type="number" id="mf-value" value="${m.value||''}" placeholder="0">
      </div>
      <div class="form-group">
        <label>Tanggal Ditandatangani</label>
        <input type="date" id="mf-signed" value="${m.signed_date||''}">
      </div>
      <div class="form-group">
        <label>Berlaku Mulai</label>
        <input type="date" id="mf-start" value="${m.start_date||today}">
      </div>
      <div class="form-group">
        <label>Berlaku Sampai</label>
        <input type="date" id="mf-end" value="${m.end_date||''}">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Ringkasan / Ketentuan</label>
        <textarea id="mf-terms" rows="3" placeholder="Ruang lingkup, hak dan kewajiban, ketentuan utama...">${m.terms||''}</textarea>
      </div>
    </div>
    <!-- File upload -->
    <div class="form-group">
      <label>Upload Dokumen MOU (DOC/PDF)</label>
      ${renderUploadArea('mf-file','mf-file-prev',
        ['application/pdf','application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])}
      ${m.file_url?renderExistingFile(m.file_url,m.file_name,'application/pdf'):''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" id="mf-save" onclick="saveMOU(${id||'null'})">💾 Simpan</button>
    </div>`);
}

function autoFillMOUPartner(sel) {
  const opt = sel.options[sel.selectedIndex];
  const nameEl = document.getElementById('mf-partner-name');
  if (nameEl && opt.value) nameEl.value = opt.textContent.trim();
}

async function saveMOU(id) {
  const title = document.getElementById('mf-title').value.trim();
  if (!title) { toast('Judul MOU wajib diisi','err'); return; }
  const btn = document.getElementById('mf-save');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }

  let fileUrl='', fileName='';
  try {
    const fi = document.getElementById('mf-file');
    if (fi?.files?.[0]) {
      const up = await uploadFile(fi.files[0],'documents','mou');
      fileUrl=up.url; fileName=up.name;
    }
  } catch(e) { toast('❌ Upload gagal: '+e.message,'err'); if(btn){btn.disabled=false;btn.textContent='💾 Simpan';} return; }

  const partnerSel = document.getElementById('mf-partner');
  const payload = {
    title,
    mou_number: document.getElementById('mf-num').value.trim() || `MOU/${Date.now().toString().slice(-6)}`,
    status: document.getElementById('mf-status').value,
    partner_id: parseInt(partnerSel?.value)||null,
    partner_name: document.getElementById('mf-partner-name').value.trim(),
    value: parseFloat(document.getElementById('mf-value').value)||0,
    signed_date: document.getElementById('mf-signed').value||null,
    start_date: document.getElementById('mf-start').value||null,
    end_date: document.getElementById('mf-end').value||null,
    terms: document.getElementById('mf-terms').value.trim(),
    ...(fileUrl?{file_url:fileUrl,file_name:fileName}:{}),
    created_by_name: getUserName(),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) { await sbPatch('mous',id,payload); toast('✅ MOU diupdate','ok'); }
    else { await sbPost('mous',payload); toast('✅ MOU dibuat','ok'); }
    closeModalForce(); await loadMOUs();
  } catch(e) {
    toast('❌ '+e.message,'err');
    if(btn){btn.disabled=false;btn.textContent='💾 Simpan';}
  }
}

async function deleteMOU(id) {
  if (!confirm('Hapus MOU ini?')) return;
  try { await sbDelete('mous',id); toast('🗑 MOU dihapus','info'); await loadMOUs(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

function exportMOUCSV() {
  if (!mouAll.length) { toast('Tidak ada data','warn'); return; }
  const h = ['No. MOU','Judul','Partner','Nilai','Mulai','Selesai','Status','Dibuat'];
  const rows = mouAll.map(m=>[
    m.mou_number||'',m.title||'',m.partner_name||'',m.value||0,
    m.start_date||'',m.end_date||'',m.status||'',m.created_by_name||''
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`));
  const csv = [h,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download = `MOU_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
  a.click();
}

async function checkMOURenewals() {
  try {
    const today = new Date();
    const in30  = new Date(today.getTime() + 30*86400000).toISOString().split('T')[0];
    const data  = await sbGet('mous',
      `select=mou_number,title,partner_name,end_date&status=eq.Active&end_date=lte.${in30}&end_date=gte.${today.toISOString().split('T')[0]}`);
    if (data?.length) {
      toast(`⚠️ ${data.length} MOU akan berakhir dalam 30 hari!`,'warn', 5000);
    }
  } catch(e) {}
}
