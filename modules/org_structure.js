// ═══════════════════════════════════════════════════════════════
// MODULE: Org Structure — Jabatan, Hierarki, Org Chart
// Sub-menu HRD
// ═══════════════════════════════════════════════════════════════

const ORG_DEPARTMENTS = ['Operations','Medis','Lab & Analis','Finance','CS & Ops','Support','Management'];
const ORG_LEVELS = [
  {value:1, label:'Level 1 — Direktur / CEO'},
  {value:2, label:'Level 2 — Manager / Head'},
  {value:3, label:'Level 3 — Staff / PIC'},
  {value:4, label:'Level 4 — Support / Helper'},
];

// Seed data dari Excel sheet Jadwal Shift
const ORG_SEED_POSITIONS = [
  {title:'Head of Operations / Lab Manager', department:'Management',  level:2, is_medical:false},
  {title:'Dokter Penanggung Jawab (PJ)',      department:'Medis',       level:3, is_medical:true },
  {title:'Perawat',                           department:'Medis',       level:3, is_medical:true },
  {title:'Analis Laboratorium',               department:'Lab & Analis',level:3, is_medical:true },
  {title:'Analis Phlebotomy & Koordinasi',    department:'Lab & Analis',level:3, is_medical:true },
  {title:'Finance Operations',                department:'Finance',     level:3, is_medical:false},
  {title:'Customer Service',                  department:'CS & Ops',   level:3, is_medical:false},
  {title:'Kurir',                             department:'Support',     level:4, is_medical:false},
  {title:'Security',                          department:'Support',     level:4, is_medical:false},
  {title:'Cleaning Service',                  department:'Support',     level:4, is_medical:false},
];

let orgPositions = [], orgEmployees = [];

// ── RENDER UTAMA ──────────────────────────────────────────────
async function renderOrgStructure() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>🏛️ Struktur Organisasi</h1>
        <p>Jabatan, hierarki, dan org chart OneLab Diagnostics</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="seedOrgPositions()">📥 Import dari Template</button>
        <button class="btn btn-teal" onclick="openPositionForm()">+ Tambah Jabatan</button>
      </div>
    </div>

    <div class="tabs" id="org-tabs">
      <button class="tab-btn active" onclick="switchOrgTab('chart',this)">🗂️ Org Chart</button>
      <button class="tab-btn" onclick="switchOrgTab('list',this)">📋 Daftar Jabatan</button>
    </div>

    <div id="org-chart">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>
    <div id="org-list" style="display:none">
      <div class="loading-row"><div class="spinner"></div></div>
    </div>`;

  await loadOrgData();
  renderOrgChart();
}

async function loadOrgData() {
  const [pos, emps] = await Promise.all([
    sbGet('positions','select=*&order=level,department,title').catch(()=>[]),
    sbGet('employees','select=id,full_name,position,division,status&status=eq.Aktif&order=full_name').catch(()=>[]),
  ]);
  orgPositions = Array.isArray(pos)  ? pos  : [];
  orgEmployees = Array.isArray(emps) ? emps : [];
}

function switchOrgTab(tab, btn) {
  document.querySelectorAll('#org-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('org-chart').style.display = tab==='chart' ? '' : 'none';
  document.getElementById('org-list').style.display  = tab==='list'  ? '' : 'none';
  if (tab==='chart') renderOrgChart();
  if (tab==='list')  renderOrgList();
}

// ── ORG CHART VIEW ────────────────────────────────────────────
function renderOrgChart() {
  const el = document.getElementById('org-chart'); if (!el) return;
  if (!orgPositions.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="ico">🏛️</div>
      <h3>Belum ada data jabatan</h3>
      <p>Klik "Import dari Template" untuk load jabatan dari data klinik.</p>
      <button class="btn btn-teal" style="margin-top:14px" onclick="seedOrgPositions()">📥 Import Template</button>
    </div>`; return;
  }

  // Group by level then department
  const byLevel = {};
  orgPositions.forEach(p=>{
    if (!byLevel[p.level]) byLevel[p.level] = [];
    byLevel[p.level].push(p);
  });

  const LEVEL_COLORS = {1:'#0891B2',2:'#7C3AED',3:'#059669',4:'#94A3B8'};

  el.innerHTML = `
    <div class="card" style="overflow-x:auto;padding:20px">
      ${[1,2,3,4].filter(l=>byLevel[l]?.length).map(l=>`
        <div style="margin-bottom:24px">
          <div style="text-align:center;margin-bottom:12px">
            <span style="background:${LEVEL_COLORS[l]};color:#fff;padding:4px 14px;
              border-radius:20px;font-size:11px;font-weight:700">
              ${ORG_LEVELS.find(ol=>ol.value===l)?.label||`Level ${l}`}
            </span>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
            ${byLevel[l].map(pos=>{
              const holders = orgEmployees.filter(e=>
                (e.position||'').toLowerCase().includes(pos.title.toLowerCase().slice(0,10))
              );
              return `
                <div style="background:#fff;border:2px solid ${LEVEL_COLORS[l]};border-radius:var(--r-md);
                  padding:12px 16px;min-width:160px;max-width:200px;text-align:center;cursor:pointer;
                  box-shadow:var(--shadow-xs);transition:all .15s"
                  onmouseover="this.style.boxShadow='var(--shadow-md)'"
                  onmouseout="this.style.boxShadow='var(--shadow-xs)'"
                  onclick="openPositionForm(${pos.id})">
                  <div style="font-size:11px;color:${LEVEL_COLORS[l]};font-weight:700;
                    text-transform:uppercase;margin-bottom:6px">${pos.department}</div>
                  <div style="font-size:12.5px;font-weight:800;color:var(--text);margin-bottom:8px;
                    line-height:1.3">${pos.title}</div>
                  ${holders.length ? holders.map(h=>`
                    <div style="display:flex;align-items:center;gap:6px;justify-content:center;
                      background:${LEVEL_COLORS[l]}15;border-radius:6px;padding:4px 8px;margin-bottom:4px">
                      <div style="width:20px;height:20px;border-radius:50%;
                        background:${LEVEL_COLORS[l]};color:#fff;font-size:9px;
                        display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">
                        ${h.full_name.charAt(0)}
                      </div>
                      <span style="font-size:11px;font-weight:600;color:${LEVEL_COLORS[l]}">${h.full_name.split(' ')[0]}</span>
                    </div>`).join('') :
                    `<div style="font-size:11px;color:var(--text3);font-style:italic">Kosong</div>`}
                  ${pos.is_medical?`<div style="margin-top:6px"><span class="badge badge-teal" style="font-size:9px">Tenaga Medis</span></div>`:''}
                </div>`;
            }).join('')}
          </div>
        </div>
        ${l < 4 && byLevel[l+1]?.length ? `
          <div style="text-align:center;margin-bottom:12px">
            <div style="width:2px;height:24px;background:var(--border);margin:0 auto"></div>
          </div>` : ''}
      `).join('')}
    </div>`;
}

// ── LIST VIEW ─────────────────────────────────────────────────
function renderOrgList() {
  const el = document.getElementById('org-list'); if (!el) return;
  if (!orgPositions.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">📋</div><h3>Belum ada jabatan</h3></div>`;
    return;
  }
  const LEVEL_COLORS = {1:'#0891B2',2:'#7C3AED',3:'#059669',4:'#94A3B8'};
  el.innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <span style="font-size:13px;color:var(--text3)">${orgPositions.length} jabatan terdaftar</span>
        <button class="btn btn-ghost btn-sm" onclick="openPositionForm()">+ Tambah Jabatan</button>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            ${['JABATAN','DEPARTEMEN','LEVEL','PEMEGANG','MEDIS','AKSI'].map(h=>`
              <th style="padding:10px 14px;background:var(--bg);font-size:11px;color:var(--text3);
                text-align:left;border-bottom:1px solid var(--border)">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${orgPositions.map((pos,i)=>{
            const holders = orgEmployees.filter(e=>
              (e.position||'').toLowerCase().includes(pos.title.toLowerCase().slice(0,10))
            );
            const lc = LEVEL_COLORS[pos.level]||'#94A3B8';
            return `
              <tr style="background:${i%2?'var(--bg2)':'#fff'};border-bottom:1px solid var(--border)">
                <td style="padding:10px 14px;font-weight:700;font-size:13px">${pos.title}</td>
                <td style="padding:10px 14px;color:var(--text3)">${pos.department}</td>
                <td style="padding:10px 14px">
                  <span style="background:${lc}20;color:${lc};padding:2px 8px;border-radius:10px;
                    font-size:11px;font-weight:700">L${pos.level}</span>
                </td>
                <td style="padding:10px 14px">
                  ${holders.length
                    ? holders.map(h=>`<span style="font-size:12px;margin-right:6px">👤 ${h.full_name.split(' ').slice(0,2).join(' ')}</span>`).join('')
                    : '<span style="color:var(--text3);font-size:12px">—</span>'}
                </td>
                <td style="padding:10px 14px;text-align:center">
                  ${pos.is_medical
                    ? '<span class="badge badge-teal" style="font-size:10px">✓ Medis</span>'
                    : '<span style="color:var(--text3);font-size:12px">—</span>'}
                </td>
                <td style="padding:10px 14px">
                  <div class="act-row">
                    <button class="act-btn edit" onclick="openPositionForm(${pos.id})">✏️</button>
                    <button class="act-btn del" onclick="deletePosition(${pos.id},'${pos.title.replace(/'/g,'').slice(0,20)}')">🗑</button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── FORM JABATAN ──────────────────────────────────────────────
async function openPositionForm(id=null) {
  let p = {};
  if (id) { const d=await sbGet('positions',`select=*&id=eq.${id}`); p=d[0]||{}; }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🏛️ ${id?'Edit':'Tambah'} Jabatan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Nama Jabatan *</label>
      <input type="text" id="pos-title" value="${p.title||''}" placeholder="Contoh: Analis Laboratorium">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Departemen *</label>
        <select id="pos-dept">
          ${ORG_DEPARTMENTS.map(d=>`<option${(p.department||'')=== d?' selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Level Hierarki *</label>
        <select id="pos-level">
          ${ORG_LEVELS.map(l=>`<option value="${l.value}"${(p.level||3)===l.value?' selected':''}>${l.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Gaji Minimum (Rp)</label>
        <input type="number" id="pos-min-sal" value="${p.min_salary||0}">
      </div>
      <div class="form-group">
        <label>Gaji Maksimum (Rp)</label>
        <input type="number" id="pos-max-sal" value="${p.max_salary||0}">
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pos-medical" ${p.is_medical?'checked':''}>
        Tenaga Medis (STR/SIP diperlukan)
      </label>
    </div>
    <div class="form-group">
      <label>Deskripsi Singkat</label>
      <textarea id="pos-desc" rows="2">${p.description||''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePosition(${id||'null'})">💾 Simpan</button>
    </div>`);
}

async function savePosition(id) {
  const title = document.getElementById('pos-title')?.value.trim();
  if (!title) { toast('Nama jabatan wajib','err'); return; }
  const payload = {
    title,
    department:  document.getElementById('pos-dept')?.value,
    level:       parseInt(document.getElementById('pos-level')?.value||3),
    min_salary:  parseFloat(document.getElementById('pos-min-sal')?.value||0),
    max_salary:  parseFloat(document.getElementById('pos-max-sal')?.value||0),
    is_medical:  document.getElementById('pos-medical')?.checked||false,
    description: document.getElementById('pos-desc')?.value.trim()||null,
    updated_at:  new Date().toISOString(),
  };
  try {
    if (id) await sbPatch('positions',id,payload);
    else    await sbPost('positions',{...payload,created_at:new Date().toISOString()});
    toast(`✅ Jabatan ${id?'diupdate':'ditambahkan'}`,'ok');
    closeModalForce();
    await loadOrgData();
    const activeTab = document.querySelector('#org-tabs .tab-btn.active')?.textContent;
    activeTab?.includes('Chart') ? renderOrgChart() : renderOrgList();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function deletePosition(id, title) {
  if (!confirm(`Hapus jabatan "${title}"?`)) return;
  try {
    await sbDelete('positions',id);
    toast('🗑 Jabatan dihapus','info');
    await loadOrgData();
    renderOrgChart();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function seedOrgPositions() {
  if (!confirm(`Import ${ORG_SEED_POSITIONS.length} jabatan dari template klinik?\nJabatan yang sudah ada tidak akan duplikat.`)) return;
  const user = getUserName?getUserName():'System';
  let added = 0, skipped = 0;
  for (const pos of ORG_SEED_POSITIONS) {
    const existing = await sbGet('positions',`select=id&title=eq.${encodeURIComponent(pos.title)}&limit=1`).catch(()=>[]);
    if (existing?.length) { skipped++; continue; }
    await sbPost('positions',{...pos,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:user}).catch(()=>{});
    added++;
  }
  toast(`✅ ${added} jabatan diimport, ${skipped} sudah ada`,'ok');
  await loadOrgData();
  renderOrgChart();
}
