// ═══════════════════════════════════════════
// MODULE: Supportive — EKG, Audiometri,
//         Spirometri, EKG Treadmill
// ═══════════════════════════════════════════

const SUPPORTIVE_TYPES = {
  'EKG 12 Lead': {
    icon:'', color:'#EF4444',
    fields:[
      {id:'rhythm',    label:'Irama',          type:'select', opts:['Sinus Normal','Sinus Takikardi','Sinus Bradikardi','Atrial Fibrillation','Atrial Flutter','VT','Lainnya']},
      {id:'rate',      label:'Heart Rate (bpm)',type:'number', placeholder:'72'},
      {id:'axis',      label:'Axis',            type:'select', opts:['Normal','Left Axis Deviation','Right Axis Deviation']},
      {id:'pr',        label:'PR Interval (ms)',type:'number', placeholder:'160'},
      {id:'qrs',       label:'QRS Duration (ms)',type:'number',placeholder:'80'},
      {id:'qt',        label:'QTc (ms)',         type:'number',placeholder:'400'},
      {id:'st',        label:'ST Segment',       type:'select',opts:['Normal','ST Elevasi','ST Depresi']},
      {id:'twaves',    label:'T Waves',          type:'select',opts:['Normal','Inversi','Flat','Tinggi']},
      {id:'kesan',     label:'Kesan / Kesimpulan',type:'textarea',placeholder:'Sinus rhythm, rate 72 bpm, within normal limit...'},
      {id:'rec',       label:'Rekomendasi',      type:'text',  placeholder:'Kontrol SpJP, tidak ada kelainan...'},
    ]
  },
  'EKG Treadmill': {
    icon:'', color:'#F97316',
    fields:[
      {id:'protocol',  label:'Protokol',         type:'select',opts:['Bruce','Modified Bruce','Balke']},
      {id:'duration',  label:'Durasi Test (menit)',type:'number',placeholder:'9'},
      {id:'max_hr',    label:'HR Maks Tercapai', type:'number',placeholder:'150'},
      {id:'target_hr', label:'HR Target (85% max)',type:'number',placeholder:'145'},
      {id:'max_bp',    label:'TD Maks (mmHg)',   type:'text',  placeholder:'180/90'},
      {id:'mets',      label:'METs Tercapai',    type:'number',placeholder:'10'},
      {id:'stop_reason',label:'Alasan Stop',     type:'select',opts:['Target HR tercapai','Kelelahan','Nyeri dada','Aritmia','Perubahan ST']},
      {id:'st_change', label:'Perubahan ST',     type:'select',opts:['Tidak ada','Depresi <1mm','Depresi ≥1mm','Elevasi']},
      {id:'kesan',     label:'Interpretasi',     type:'select',opts:['Negatif (Normal)','Positif (Iskemia)','Non-diagnostik','Equivocal']},
      {id:'rec',       label:'Rekomendasi',      type:'text',  placeholder:'Repeat test, konsul SpJP...'},
    ]
  },
  'Audiometri': {
    icon:'', color:'#8B5CF6',
    fields:[
      // Telinga Kanan
      {id:'r_500',   label:'Kanan 500 Hz (dB)',  type:'number',placeholder:'10'},
      {id:'r_1000',  label:'Kanan 1000 Hz (dB)', type:'number',placeholder:'10'},
      {id:'r_2000',  label:'Kanan 2000 Hz (dB)', type:'number',placeholder:'15'},
      {id:'r_4000',  label:'Kanan 4000 Hz (dB)', type:'number',placeholder:'20'},
      {id:'r_8000',  label:'Kanan 8000 Hz (dB)', type:'number',placeholder:'20'},
      {id:'r_pta',   label:'PTA Kanan (dB)',      type:'number',placeholder:'14'},
      // Telinga Kiri
      {id:'l_500',   label:'Kiri 500 Hz (dB)',   type:'number',placeholder:'10'},
      {id:'l_1000',  label:'Kiri 1000 Hz (dB)',  type:'number',placeholder:'10'},
      {id:'l_2000',  label:'Kiri 2000 Hz (dB)',  type:'number',placeholder:'15'},
      {id:'l_4000',  label:'Kiri 4000 Hz (dB)',  type:'number',placeholder:'20'},
      {id:'l_8000',  label:'Kiri 8000 Hz (dB)',  type:'number',placeholder:'20'},
      {id:'l_pta',   label:'PTA Kiri (dB)',       type:'number',placeholder:'14'},
      {id:'kesan_r', label:'Klasifikasi Kanan',   type:'select',opts:['Normal (<25dB)','Tuli Ringan (26-40dB)','Tuli Sedang (41-60dB)','Tuli Berat (61-80dB)','Tuli Total (>80dB)']},
      {id:'kesan_l', label:'Klasifikasi Kiri',    type:'select',opts:['Normal (<25dB)','Tuli Ringan (26-40dB)','Tuli Sedang (41-60dB)','Tuli Berat (61-80dB)','Tuli Total (>80dB)']},
      {id:'kesan',   label:'Kesimpulan Umum',     type:'textarea',placeholder:'Pendengaran normal bilateral...'},
      {id:'rec',     label:'Rekomendasi',         type:'text',  placeholder:'Proteksi pendengaran, hindari kebisingan...'},
    ]
  },
  'Spirometri': {
    icon:'', color:'#0EA5E9',
    fields:[
      {id:'fvc',     label:'FVC (L)',             type:'number',placeholder:'4.2',step:'0.01'},
      {id:'fvc_pct', label:'FVC % Prediksi',      type:'number',placeholder:'95'},
      {id:'fev1',    label:'FEV1 (L)',             type:'number',placeholder:'3.5',step:'0.01'},
      {id:'fev1_pct',label:'FEV1 % Prediksi',     type:'number',placeholder:'90'},
      {id:'ratio',   label:'FEV1/FVC (%)',         type:'number',placeholder:'83',step:'0.1'},
      {id:'pef',     label:'PEF (L/mnt)',          type:'number',placeholder:'500'},
      {id:'pef_pct', label:'PEF % Prediksi',      type:'number',placeholder:'92'},
      {id:'pola',    label:'Pola Gangguan',        type:'select',opts:['Normal','Obstruksi','Restriksi','Mixed','Borderline']},
      {id:'severity',label:'Derajat',              type:'select',opts:['—','Ringan','Sedang','Berat','Sangat Berat']},
      {id:'file_grafik',label:'Upload Grafik Spirometri',type:'file'},
      {id:'kesan',   label:'Interpretasi',         type:'textarea',placeholder:'Fungsi paru normal...'},
      {id:'rec',     label:'Rekomendasi',          type:'text',  placeholder:'Bronkodilator, kontrol SpP...'},
    ]
  },
};

let suppAll = [];
let suppFormDefaultType = 'EKG 12 Lead';
// Workspace pemeriksaan sengaja menyimpan state UI terpisah dari payload. Dengan
// begitu berpindah bagian form tidak mengubah nilai klinis yang akan disimpan.
let suppWorkspaceState = null;

async function renderSupportive(params = {}) {
  if (typeof injectProShell==='function') injectProShell();
  const focusedType = SUPPORTIVE_TYPES[params.type] ? params.type : '';
  suppFormDefaultType = focusedType || 'EKG 12 Lead';
  suppActiveType = focusedType;
  const focusedCfg = focusedType ? SUPPORTIVE_TYPES[focusedType] : null;
  document.getElementById('main-content').innerHTML = `
    <div class="pro-shell">
    <div class="pro-header">
      <div><h1>${focusedCfg ? focusedType : 'Pemeriksaan Penunjang'}</h1>
        <span class="pro-sub">${focusedCfg ? `Daftar dan input ${focusedType}. Gunakan dashboard penunjang untuk melihat seluruh jenis pemeriksaan.` : 'EKG 12 Lead · EKG Treadmill · Audiometri · Spirometri'}</span></div>
      <button class="btn btn-teal btn-sm" onclick="openSupportiveForm()">Input pemeriksaan</button>
    </div>

    <div class="pro-kpi" id="supp-type-cards">
      ${Object.entries(SUPPORTIVE_TYPES).map(([type,cfg])=>`
        <div onclick="filterSuppType('${type}',this)" class="supp-type-card"
          style="background:var(--white);border-radius:8px;padding:8px 10px;cursor:pointer;border:1px solid var(--border);border-left:4px solid ${cfg.color};transition:all .15s">
          <div style="font-size:11px;font-weight:700;color:var(--navy)">${type}</div>
          <div style="font-size:18px;font-weight:800;color:${cfg.color}" id="supp-count-${type.replace(/\s/g,'_')}">—</div>
        </div>`).join('')}
    </div>

    <div class="pro-toolbar">
      <input class="table-search" id="supp-q" placeholder="Cari nama pasien..."
        oninput="filterSupp()" style="flex:1;min-width:220px">
      <select class="table-filter" id="supp-status" onchange="filterSupp()">
        <option value="">Semua Status</option>
        <option>Draft</option><option>Validated</option><option>Approved</option>
      </select>
    </div>

    <div id="supp-list"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadSupportive();
}

let suppActiveType = '';
async function loadSupportive() {
  try {
    const data = await sbGet('lab_results',
      `select=*&order=created_at.desc&limit=200`);
    suppAll = (Array.isArray(data)?data:[]).filter(r=>
      Object.keys(SUPPORTIVE_TYPES).some(t=>r.product_name===t||r.notes?.includes(`[SUPP:${t}]`))
    );
    // Update counts
    Object.keys(SUPPORTIVE_TYPES).forEach(type=>{
      const el = document.getElementById(`supp-count-${type.replace(/\s/g,'_')}`);
      if (el) el.textContent = suppAll.filter(r=>r.product_name===type||r.notes?.includes(`[SUPP:${type}]`)).length;
    });
    filterSupp();
  } catch(e) { suppAll=[]; filterSupp(); }
}

function filterSuppType(type, card) {
  // reset highlight tanpa menghapus aksen border-left tiap kartu
  document.querySelectorAll('.supp-type-card').forEach(c=>{
    c.style.background='var(--white)';
    c.style.boxShadow='none';
  });
  if (suppActiveType===type) {
    suppActiveType='';
  } else {
    suppActiveType=type;
    const cfg=SUPPORTIVE_TYPES[type];
    card.style.background=cfg.color+'12';
    card.style.boxShadow=`0 0 0 2px ${cfg.color}55`;
  }
  filterSupp();
}

function filterSupp() {
  const q  = (document.getElementById('supp-q')?.value||'').toLowerCase();
  const st = document.getElementById('supp-status')?.value||'';
  const f  = suppAll.filter(r=>
    (!suppActiveType || r.product_name===suppActiveType || r.notes?.includes(`[SUPP:${suppActiveType}]`)) &&
    (!q  || (r.patient_name||'').toLowerCase().includes(q)) &&
    (!st || r.status===st)
  );
  renderSuppList(f);
}

function renderSuppList(data) {
  const el = document.getElementById('supp-list'); if (!el) return;
  if (!data.length) {
    el.innerHTML=`<div class="empty-state">
      <h3>${suppAll.length?'Tidak ada hasil':'Belum ada pemeriksaan supportive'}</h3>
      <button class="btn btn-teal" style="margin-top:12px" onclick="openSupportiveForm()">Input pemeriksaan</button>
    </div>`; return;
  }

  el.innerHTML=`<div class="table-wrap"><table>
    <thead><tr>
      <th>Pasien</th><th>Pemeriksaan</th><th>Hasil Utama</th>
      <th>Interpretasi</th><th>Dokter</th><th>Status</th><th>Aksi</th>
    </tr></thead><tbody>
    ${data.map(r=>{
      const cfg = Object.entries(SUPPORTIVE_TYPES).find(([t])=>r.product_name===t||r.notes?.includes(`[SUPP:${t}]`))?.[1]||{icon:'',color:'#94A3B8'};
      const notes = tryParseJSON(r.notes)||{};
      const mainResult = r.product_name==='EKG 12 Lead'?`${notes.rate||'—'} bpm, ${notes.rhythm||'—'}`:
                        r.product_name==='Spirometri'?`FEV1/FVC: ${notes.ratio||'—'}%, ${notes.pola||'—'}`:
                        r.product_name==='Audiometri'?`PTA Ka: ${notes.r_pta||'—'} dB, Ki: ${notes.l_pta||'—'} dB`:
                        r.product_name==='EKG Treadmill'?`${notes.kesan||'—'}`: r.result_value||'—';
      const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'}[r.color_code]||'#94A3B8';
      return `<tr>
        <td>
          <div style="font-weight:600">${r.patient_name||'—'}</div>
          <div style="font-size:10px;color:var(--gray)">${r.visit_number||'—'}</div>
        </td>
        <td>
          <span style="background:${cfg.color}15;color:${cfg.color};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">
            ${r.product_name||'—'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text);max-width:200px">${mainResult}</td>
        <td>
          ${r.interpretation?`<span style="background:${c}20;color:${c};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.interpretation}</span>`:'—'}
        </td>
        <td style="font-size:11px;color:var(--gray)">${r.approved_by||'—'}</td>
        <td>
          <span style="background:${r.status==='Approved'?'var(--success-soft)':r.status==='Validated'?'var(--teal-light)':'var(--warn-soft2)'};
            color:${r.status==='Approved'?'var(--success-deep)':r.status==='Validated'?'var(--info)':'var(--warn-deeper)'};
            padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.status||'Draft'}</span>
        </td>
        <td>
          <div class="act-row">
            <button class="act-btn edit" onclick="openSupportiveForm(${r.id})">Ubah</button>
            ${r.status==='Draft'?`<button class="act-btn" style="color:var(--success-strong);font-size:10px" onclick="updateResultStatus(${r.id},'Validated')">Validasi</button>`:''}
            ${r.status==='Validated'?`<button class="act-btn" style="color:var(--violet);font-size:10px" onclick="updateResultStatus(${r.id},'Approved')">Approve</button>`:''}
            <button class="act-btn" onclick="printSuppResult(${r.id})">Cetak</button>
          </div>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

async function openSupportiveForm(id=null) {
  let r = {}, existingData = {};
  if (id) {
    const d=await sbGet('lab_results',`select=*&id=eq.${id}`); r=d[0]||{};
    existingData = tryParseJSON(r.notes)||{};
  }

  let admOpts='<option value="">-- Pilih Kunjungan --</option>';
  try {
    const adms=await sbGet('admissions','select=id,visit_number,patient_name,patient_gender,patient_age&order=created_at.desc&limit=100');
    admOpts+=(adms||[]).map(a=>`<option value="${a.id}"
      data-name="${a.patient_name}" data-visit="${a.visit_number}"
      ${r.admission_id==a.id?'selected':''}>${a.visit_number} — ${a.patient_name}</option>`).join('');
  } catch(e){}

  const user=getUserName?getUserName():'User';
  const currentType = r.product_name || suppFormDefaultType || 'EKG 12 Lead';
  suppWorkspaceState = { id, activeTab:'context', existingData, returnType:suppActiveType };
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div class="pro-shell" style="max-width:1280px;margin:0 auto">
      <header style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 2px 12px;border-bottom:1px solid var(--border);margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <button class="btn btn-ghost btn-sm" type="button" onclick="closeSupportiveWorkspace()">← Daftar pemeriksaan</button>
          <div style="min-width:0"><h1 style="font-size:16px;margin:0;color:var(--navy)">${id?'Ubah':'Input'} Pemeriksaan Supportive</h1>
            <div style="font-size:11px;color:var(--gray);margin-top:2px">Data tersimpan sebagai hasil pemeriksaan dan mengikuti alur Draft → Validated → Approved.</div></div>
        </div>
        <span style="font-size:11px;color:var(--gray);white-space:nowrap">${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</span>
      </header>

      <div style="display:grid;grid-template-columns:174px minmax(0,1fr);gap:12px;align-items:start">
        <aside style="position:sticky;top:10px;border:1px solid var(--border);border-radius:10px;background:var(--white);padding:7px">
          <div style="font-size:10px;font-weight:800;color:var(--gray);letter-spacing:.06em;text-transform:uppercase;padding:5px 7px 7px">Input hasil</div>
          ${[['context','Kunjungan & jenis','1'],['measurement','Pengukuran','2'],['interpretation','Interpretasi','3'],['review','Tinjau & simpan','4']].map(([key,label,no])=>`
            <button type="button" id="sf-nav-${key}" onclick="switchSupportiveWorkspaceTab('${key}')" style="width:100%;display:flex;align-items:center;gap:8px;text-align:left;padding:8px 7px;border:0;border-radius:7px;background:${key==='context'?'var(--teal-soft)':'transparent'};color:${key==='context'?'var(--teal-deep)':'var(--text)'};font-size:11px;font-weight:700;cursor:pointer">
              <span style="width:18px;height:18px;display:inline-grid;place-items:center;border-radius:50%;background:${key==='context'?'var(--teal)':'var(--bg2)'};color:${key==='context'?'#fff':'var(--gray)'};font-size:10px">${no}</span>${label}
            </button>`).join('')}
          <div style="font-size:10px;color:var(--gray);line-height:1.45;padding:10px 7px 3px">Kolom wajib hanya kunjungan. Nilai klinis dapat dilengkapi bertahap sebelum disimpan.</div>
        </aside>

        <section style="min-width:0;border:1px solid var(--border);border-radius:10px;background:var(--white);overflow:hidden">
          <div style="padding:14px 16px 10px" id="sf-workspace-body">
            <section id="sf-section-context">
              <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:3px">Konteks pemeriksaan</div>
              <div style="font-size:11px;color:var(--gray);margin-bottom:12px">Pilih kunjungan, jenis pemeriksaan, dan pemeriksa terlebih dahulu.</div>
              <div class="form-row">
                <div class="form-group" style="grid-column:1/-1"><label>Pasien / Kunjungan *</label>
                  <select id="sf-adm" onchange="document.getElementById('sf-patient').value=this.options[this.selectedIndex].dataset.name||'';document.getElementById('sf-visit').value=this.options[this.selectedIndex].dataset.visit||''">${admOpts}</select>
                  <input type="hidden" id="sf-patient" value="${r.patient_name||''}"><input type="hidden" id="sf-visit" value="${r.visit_number||''}">
                </div>
                <div class="form-group"><label>Tipe Pemeriksaan *</label>
                  <select id="sf-type" onchange="renderSuppFields(this.value, suppWorkspaceState ? suppWorkspaceState.existingData : {})">
                    ${Object.entries(SUPPORTIVE_TYPES).map(([t,cfg])=>`<option value="${t}" ${currentType===t?'selected':''}>${cfg.icon} ${t}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label>Dokter Pemeriksa</label><input type="text" id="sf-doctor" value="${r.approved_by||''}" placeholder="dr. Nama SpJP"></div>
                <div class="form-group"><label>Status</label><select id="sf-status" disabled title="Perubahan status dilakukan dari daftar hasil sesuai urutan validasi"><option value="Draft" ${(r.status||'Draft')==='Draft'?'selected':''}>Draft</option><option value="Validated" ${r.status==='Validated'?'selected':''}>Validated</option><option value="Approved" ${r.status==='Approved'?'selected':''}>Approved</option></select><div style="font-size:10px;color:var(--gray);margin-top:4px">Status berubah dari daftar hasil: Draft → Validated → Approved.</div></div>
              </div>
            </section>
            <section id="sf-section-measurement" style="display:none"><div id="sf-measurement-fields"></div></section>
            <section id="sf-section-interpretation" style="display:none"><div id="sf-interpretation-fields"></div></section>
            <section id="sf-section-review" style="display:none">
              <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px">Tinjau sebelum simpan</div>
              <div style="font-size:11px;color:var(--gray);line-height:1.5;max-width:720px">Pastikan kunjungan dan nilai pemeriksaan sudah tepat. Penyimpanan mempertahankan mekanisme status yang ada; validasi dan persetujuan akhir tetap dilakukan dari daftar hasil.</div>
              <div id="sf-review-summary" style="margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--bg2);font-size:11px;color:var(--text)"></div>
            </section>
          </div>
          <footer style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid var(--border);padding:9px 16px;background:var(--bg)">
            <button class="btn btn-ghost btn-sm" type="button" onclick="closeSupportiveWorkspace()">Batal</button>
            <div style="display:flex;gap:7px"><button class="btn btn-ghost btn-sm" type="button" id="sf-prev" onclick="moveSupportiveWorkspace(-1)" style="display:none">← Kembali</button><button class="btn btn-teal btn-sm" type="button" id="sf-next" onclick="moveSupportiveWorkspace(1)">Lanjut →</button><button class="btn btn-teal btn-sm" type="button" id="sf-save" onclick="saveSuppResult(${id||'null'})" style="display:none">Simpan Hasil</button></div>
          </footer>
        </section>
      </div>
    </div>`;
  renderSuppFields(currentType, existingData);
}

async function closeSupportiveWorkspace() {
  const type = suppWorkspaceState?.returnType || suppActiveType || '';
  suppWorkspaceState = null;
  await renderSupportive(type ? { type } : {});
}

function switchSupportiveWorkspaceTab(tab) {
  if (!suppWorkspaceState) return;
  const tabs=['context','measurement','interpretation','review'];
  if (!tabs.includes(tab)) return;
  suppWorkspaceState.activeTab=tab;
  document.querySelectorAll('[id^="sf-section-"]').forEach(el=>el.style.display=el.id===`sf-section-${tab}`?'':'none');
  tabs.forEach((key,index)=>{
    const btn=document.getElementById(`sf-nav-${key}`); if (!btn) return;
    const active=key===tab;
    btn.style.background=active?'var(--teal-soft)':'transparent'; btn.style.color=active?'var(--teal-deep)':'var(--text)';
    const badge=btn.querySelector('span'); if (badge) { badge.style.background=active?'var(--teal)':'var(--bg2)'; badge.style.color=active?'#fff':'var(--gray)'; }
  });
  const index=tabs.indexOf(tab);
  const prev=document.getElementById('sf-prev'), next=document.getElementById('sf-next'), save=document.getElementById('sf-save');
  if (prev) prev.style.display=index?'':'none';
  if (next) next.style.display=index===tabs.length-1?'none':'';
  if (save) save.style.display=index===tabs.length-1?'':'none';
  if (tab==='review') renderSupportiveReview();
}

function moveSupportiveWorkspace(direction) {
  const tabs=['context','measurement','interpretation','review'];
  const current=tabs.indexOf(suppWorkspaceState?.activeTab||'context');
  switchSupportiveWorkspaceTab(tabs[Math.max(0,Math.min(tabs.length-1,current+direction))]);
}

function renderSupportiveReview() {
  const el=document.getElementById('sf-review-summary'); if (!el) return;
  const adm=document.getElementById('sf-adm'), type=document.getElementById('sf-type'), doctor=document.getElementById('sf-doctor'), status=document.getElementById('sf-status');
  const label=adm?.options?.[adm.selectedIndex]?.text||'Belum memilih kunjungan';
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><div><b>Kunjungan</b><br>${label}</div><div><b>Pemeriksaan</b><br>${type?.value||'—'}</div><div><b>Pemeriksa</b><br>${doctor?.value||'Belum diisi'}</div><div><b>Status awal</b><br>${status?.value||'Draft'}</div></div>`;
}

function renderSuppFields(type, existing={}) {
  const measurementEl = document.getElementById('sf-measurement-fields');
  const interpretationEl = document.getElementById('sf-interpretation-fields');
  if (!measurementEl || !interpretationEl) return;
  const cfg = SUPPORTIVE_TYPES[type]; if (!cfg) return;
  if (typeof existing==='string') existing=tryParseJSON(existing)||{};
  if (suppWorkspaceState) suppWorkspaceState.existingData=existing;

  const fieldMarkup = (f) => {
    const val = existing[f.id]||'';
    if (f.type==='textarea') return `<div class="form-group" style="grid-column:1/-1"><label>${f.label}</label><textarea id="sff-${f.id}" rows="3" placeholder="${f.placeholder||''}">${val}</textarea></div>`;
    if (f.type==='select') return `<div class="form-group"><label>${f.label}</label><select id="sff-${f.id}">${(f.opts||[]).map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('')}</select></div>`;
    if (f.type==='file') return `<div class="form-group" style="grid-column:1/-1"><label>${f.label}</label><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><input type="file" id="sff-${f.id}" accept=".jpg,.jpeg,.png,.pdf" onchange="handleSuppFile(this,'${f.id}')"><input type="hidden" id="sff-${f.id}-url" value="${val}">${val?`<a href="${val}" target="_blank" style="font-size:11px;color:var(--teal)">📎 File tersimpan</a>`:''}</div></div>`;
    return `<div class="form-group"><label>${f.label}</label><input type="${f.type}" id="sff-${f.id}" value="${val}" placeholder="${f.placeholder||''}" step="${f.step||'1'}"></div>`;
  };
  const interpretationIds=['kesan','rec'];
  const measurement=cfg.fields.filter(f=>!interpretationIds.includes(f.id));
  const interpretation=cfg.fields.filter(f=>interpretationIds.includes(f.id));

  measurementEl.innerHTML = `<div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:3px">Parameter ${type}</div><div style="font-size:11px;color:var(--gray);margin-bottom:12px">Masukkan hasil pengukuran sesuai pemeriksaan yang dilakukan.</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${measurement.map(fieldMarkup).join('')}</div>`;
  interpretationEl.innerHTML = `<div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:3px">Interpretasi klinis</div><div style="font-size:11px;color:var(--gray);margin-bottom:12px">Tuliskan kesimpulan dan rekomendasi pemeriksa bila diperlukan.</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${interpretation.map(fieldMarkup).join('') || '<div style="font-size:11px;color:var(--gray)">Tidak ada kolom interpretasi khusus.</div>'}</div>`;
}

function handleSuppFile(input, fieldId) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const urlEl = document.getElementById(`sff-${fieldId}-url`);
    if (urlEl) urlEl.value = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveSuppResult(id) {
  const admSel = document.getElementById('sf-adm');
  const admId  = admSel?.value;
  const type   = document.getElementById('sf-type').value;
  if (!admId) { toast('Pilih kunjungan pasien dulu','err'); return; }

  const patName  = document.getElementById('sf-patient').value||admSel.options[admSel.selectedIndex]?.dataset.name||'';
  const visitNum = document.getElementById('sf-visit').value||admSel.options[admSel.selectedIndex]?.dataset.visit||'';
  const doctor   = document.getElementById('sf-doctor').value.trim();
  const status   = document.getElementById('sf-status').value;
  const user     = getUserName?getUserName():'User';
  const cfg      = SUPPORTIVE_TYPES[type];

  // Collect all field values
  const data = {};
  (cfg?.fields||[]).forEach(f => {
    const el = document.getElementById(`sff-${f.id}`);
    const urlEl = document.getElementById(`sff-${f.id}-url`);
    if (urlEl) data[f.id] = urlEl.value;
    else if (el) data[f.id] = el.value;
  });

  // Determine interpretation and color
  let interp = data.kesan||'';
  let color  = 'green';
  if (type==='EKG 12 Lead') {
    const abnormal=['Sinus Takikardi','Sinus Bradikardi','Atrial Fibrillation','VT'];
    if (abnormal.some(a=>data.rhythm?.includes(a.split(' ')[0]))) { color='yellow'; }
    if (data.st==='ST Elevasi') { color='red'; interp='Abnormal — ST Elevasi'; }
  } else if (type==='Spirometri') {
    const pola = data.pola||'Normal';
    color = pola==='Normal'?'green':pola==='Obstruksi'||pola==='Restriksi'?'yellow':'orange';
    interp = pola;
    if (data.severity&&data.severity!=='—') interp += ` (${data.severity})`;
  } else if (type==='Audiometri') {
    const maxPTA = Math.max(parseFloat(data.r_pta||0),parseFloat(data.l_pta||0));
    color = maxPTA<25?'green':maxPTA<41?'yellow':maxPTA<61?'orange':'red';
    interp = data.kesan_r||data.kesan||'';
  } else if (type==='EKG Treadmill') {
    color = data.kesan?.includes('Negatif')?'green':data.kesan?.includes('Positif')?'red':'yellow';
    interp = data.kesan||'';
  }

  const notesStr = JSON.stringify({...data, _type:`[SUPP:${type}]`});

  const payload = {
    admission_id:  parseInt(admId),
    visit_number:  visitNum,
    patient_name:  patName,
    product_name:  type,
    result_value:  data.kesan||interp||'—',
    interpretation:interp||data.kesan||'—',
    color_code:    color,
    is_auto:       false,
    status,
    entered_by:    user,
    entered_at:    new Date().toISOString(),
    approved_by:   doctor||null,
    notes:         notesStr,
    updated_at:    new Date().toISOString(),
  };

  try {
    if (id) { await sbPatch('lab_results',id,payload); toast('✅ Data diupdate','ok'); }
    else    { await sbPost('lab_results',payload);    toast('✅ Data disimpan','ok'); }
    await closeSupportiveWorkspace();
    await loadSupportive();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// Validasi dan persetujuan hasil penunjang.
//
// Tombolnya sudah ada di daftar sejak lama, tapi fungsi ini tidak pernah
// ditulis — menekannya tidak melakukan apa pun dan tidak memberi tahu
// bahwa tidak terjadi apa-apa. Petugas mengira hasilnya sudah divalidasi.
//
// Urutannya ditegakkan: Draft → Validated → Approved. Melompat langsung
// ke Approved berarti melewati pemeriksaan analis, dan hasil yang keluar
// tanpa diperiksa siapa pun adalah hasil yang tidak bisa
// dipertanggungjawabkan.
async function updateResultStatus(id, status) {
  const r = (suppAll || []).find(x => x.id === id);
  if (!r) return;

  const urutan = { 'Draft': 0, 'Validated': 1, 'Approved': 2 };
  const sekarang = urutan[r.status] ?? 0;
  const tujuan = urutan[status];

  if (tujuan === undefined) { toast('Status tidak dikenal', 'err'); return; }
  if (tujuan !== sekarang + 1) {
    toast(`Hasil berstatus "${r.status}" tidak bisa langsung ke "${status}".`, 'warn');
    return;
  }

  const siapa = (window.currentUsername || '').trim();
  if (!siapa) { toast('Akun tidak dikenali — masuk ulang.', 'err'); return; }

  const label = status === 'Validated' ? 'memvalidasi' : 'menyetujui';
  if (!confirm(`Anda ${label} hasil ${r.product_name || ''} atas nama `
    + `${r.patient_name || 'pasien ini'}.\n\nNama Anda akan tercatat pada hasil.`)) return;

  const kini = new Date().toISOString();
  const payload = status === 'Validated'
    ? { status, validated_by: siapa, validated_at: kini }
    : { status, approved_by: siapa, released_at: kini };

  try {
    await sbPatch('lab_results', id, payload);
    toast(status === 'Validated' ? '✅ Hasil divalidasi' : '✅ Hasil disetujui', 'ok');
    await loadSupportive();
  } catch (e) {
    toast('❌ ' + e.message, 'err');
  }
}

function printSuppResult(id) {
  const r = suppAll.find(s=>s.id===id); if (!r) return;
  const data = tryParseJSON(r.notes)||{};
  const cfg  = SUPPORTIVE_TYPES[r.product_name]||{icon:'',color:'#0A2342',fields:[]};
  const orgName = localStorage.getItem('ol_org_name')||'AVA Health & Lab Diagnostics';
  const c={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'}[r.color_code]||'#94A3B8';

  const rows = cfg.fields.filter(f=>f.type!=='file'&&data[f.id]).map(f=>`
    <tr><td style="color:var(--slate);font-size:12px;padding:6px 10px">${f.label}</td>
    <td style="font-weight:600;padding:6px 10px">${data[f.id]||'—'}</td></tr>`).join('');

  const w=window.open('','_blank','width=800,height:600');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${r.product_name} — ${r.patient_name}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;font-size:13px}
    .header{border-bottom:3px solid ${cfg.color};padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between}
    h2{color:var(--navy-deep);margin:0}table{width:100%;border-collapse:collapse}
    tr:nth-child(even){background:var(--bg)}
    .badge{padding:4px 14px;border-radius:10px;font-size:13px;font-weight:700}
    @media print{button{display:none}}</style></head><body>
    <button onclick="window.print()" style="position:fixed;top:16px;right:16px;padding:8px 18px;background:var(--navy-deep);color:var(--on-accent);border:none;border-radius:6px;cursor:pointer">Cetak</button>
    <div class="header">
      <div><h2>${orgName}</h2></div>
      <div style="text-align:right"><strong style="font-size:16px;color:var(--navy-deep)">${cfg.icon} ${r.product_name}</strong>
      <div style="font-size:12px;color:var(--slate)">${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div></div>
    </div>
    <div style="background:#F0F4F8;border-radius:8px;padding:12px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><span style="font-size:11px;color:var(--slate)">PASIEN</span><br><strong>${r.patient_name}</strong></div>
      <div><span style="font-size:11px;color:var(--slate)">NO. KUNJUNGAN</span><br><strong>${r.visit_number||'—'}</strong></div>
    </div>
    <table>${rows}</table>
    <div style="margin-top:16px;padding:12px;background:${c}15;border-radius:8px;border-left:4px solid ${c}">
      <span style="font-size:11px;color:var(--slate)">INTERPRETASI:</span><br>
      <span class="badge" style="background:${c}20;color:${c}">${r.interpretation||'—'}</span>
    </div>
    ${data.rec?`<div style="margin-top:12px"><strong>Rekomendasi:</strong> ${data.rec}</div>`:''}
    <div style="margin-top:50px;text-align:right">
      <div>________________________</div>
      <div style="font-size:12px;color:var(--slate)">${r.approved_by||'Dokter Pemeriksa'}</div>
    </div>
    </body></html>`);
  w.document.close();
}
