// ═══════════════════════════════════════════════════════════════
// LIS · QUALITY CONTROL & MANAJEMEN ANALYZER
// - Daftar analyzer + status kalibrasi (jatuh tempo)
// - Log QC harian + evaluasi Westgard sederhana (1-2s / 1-3s)
//   → butuh tabel lab_qc_runs (lihat supabase_lab_lis.sql)
// ═══════════════════════════════════════════════════════════════

let _labAnalyzers=[];

async function renderQCTab(){
  const el=document.getElementById('lab-qc'); if(!el) return;
  el.innerHTML=`<div class="loading-row"><div class="spinner"></div> Memuat QC...</div>`;

  try { _labAnalyzers=await sbGet('analyzers','select=*&order=nama_alat')||[]; } catch(e){ _labAnalyzers=[]; }
  let qcRuns=[];
  let qcAvailable=true;
  try { qcRuns=await sbGet('lab_qc_runs','select=*&order=run_at.desc&limit=100')||[]; }
  catch(e){ qcAvailable=false; }

  const today=new Date();
  const dueSoon=_labAnalyzers.filter(a=>a.kalibrasi_berikutnya&&new Date(a.kalibrasi_berikutnya)<=new Date(today.getTime()+7*864e5));

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-teal">${_labAnalyzers.length} analyzer</span>
        ${dueSoon.length?`<span class="badge" style="background:#FFF8E1;color:#92400E;margin-left:6px">🔧 ${dueSoon.length} kalibrasi jatuh tempo</span>`:''}
      </div>
      <div>
        <button class="btn btn-ghost btn-sm" onclick="openAnalyzerForm()">+ Analyzer</button>
        ${qcAvailable?`<button class="btn btn-teal btn-sm" onclick="openQCForm()">+ Log QC</button>`:''}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">🧬 Analyzer &amp; Status Kalibrasi</div>
      <div class="table-wrap"><table><thead><tr>
        <th>Alat</th><th>Kategori</th><th>Lokasi</th><th>Integrasi</th><th>Kalibrasi Berikutnya</th><th>Status</th>
      </tr></thead><tbody>
      ${_labAnalyzers.length?_labAnalyzers.map(a=>{
        const due=a.kalibrasi_berikutnya&&new Date(a.kalibrasi_berikutnya)<=new Date(today.getTime()+7*864e5);
        const overdue=a.kalibrasi_berikutnya&&new Date(a.kalibrasi_berikutnya)<today;
        const st={Aktif:'#22C55E',Maintenance:'#F59E0B',Rusak:'#EF4444'}[a.status]||'#94A3B8';
        return `<tr>
          <td><div style="font-weight:600">${a.nama_alat}</div><div style="font-size:10px;color:var(--gray)">${a.merk||''} ${a.model||''}</div></td>
          <td style="font-size:12px">${a.kategori||'—'}</td>
          <td style="font-size:12px">${a.lokasi||'—'}</td>
          <td style="font-size:11px">${a.integrasi_aktif?`<span class="badge badge-teal">${a.integrasi_protocol||'ON'}</span>`:'<span class="badge badge-gray">Manual</span>'}</td>
          <td style="font-size:12px;color:${overdue?'#EF4444':due?'#F59E0B':'var(--gray)'};font-weight:${due||overdue?'700':'400'}">
            ${a.kalibrasi_berikutnya?new Date(a.kalibrasi_berikutnya).toLocaleDateString('id-ID'):'—'}${overdue?' ⚠️':due?' 🔧':''}</td>
          <td><span style="background:${st}20;color:${st};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${a.status||'—'}</span></td>
        </tr>`;
      }).join(''):`<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray)">Belum ada analyzer. Klik "+ Analyzer".</td></tr>`}
      </tbody></table></div>
    </div>

    ${!qcAvailable?`
      <div style="background:#FFF8E1;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;font-size:12.5px;color:#92400E">
        ⚙️ Modul <strong>Log QC</strong> memerlukan tabel <code>lab_qc_runs</code>.
        Jalankan <code>supabase_lab_lis.sql</code> di Supabase SQL Editor untuk mengaktifkannya.
      </div>` : `
      <div class="card">
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">📊 Log Quality Control (Westgard)</div>
        <div class="table-wrap"><table><thead><tr>
          <th>Waktu</th><th>Alat</th><th>Tes</th><th>Level</th><th>Target±SD</th><th>Terukur</th><th>Z-score</th><th>Evaluasi</th>
        </tr></thead><tbody>
        ${qcRuns.length?qcRuns.map(q=>{
          const z=(q.sd&&q.target!=null)?((q.measured-q.target)/q.sd):null;
          const ev=qcVerdict(z);
          return `<tr>
            <td style="font-size:11px;color:var(--gray)">${q.run_at?new Date(q.run_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</td>
            <td style="font-size:12px">${q.analyzer_name||'—'}</td>
            <td style="font-size:12px">${q.test_name||'—'}</td>
            <td style="font-size:11px">${q.qc_level||'—'}</td>
            <td style="font-size:12px">${q.target??'—'} ± ${q.sd??'—'}</td>
            <td style="font-size:13px;font-weight:700">${q.measured??'—'}</td>
            <td style="font-size:12px;font-weight:700;color:${ev.color}">${z!=null?z.toFixed(2):'—'}</td>
            <td><span style="background:${ev.color}20;color:${ev.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${ev.label}</span></td>
          </tr>`;
        }).join(''):`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray)">Belum ada log QC. Klik "+ Log QC".</td></tr>`}
        </tbody></table></div>
      </div>`}`;
}

// Evaluasi Westgard sederhana berbasis z-score
function qcVerdict(z){
  if(z==null) return {label:'—',color:'#94A3B8'};
  const a=Math.abs(z);
  if(a>3)   return {label:'REJECT (1-3s)',color:'#EF4444'};
  if(a>2)   return {label:'Warning (1-2s)',color:'#F59E0B'};
  return {label:'In Control',color:'#22C55E'};
}

async function openAnalyzerForm(){
  openModal(`
    <div class="modal-header"><div class="modal-title">🧬 Tambah Analyzer</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode Alat</label><input id="az-kode" placeholder="ANZ-001"></div>
      <div class="form-group" style="grid-column:2/-1"><label>Nama Alat *</label><input id="az-nama" placeholder="Sysmex XN-550"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Merk</label><input id="az-merk" placeholder="Sysmex"></div>
      <div class="form-group"><label>Model</label><input id="az-model"></div>
      <div class="form-group"><label>Kategori</label>
        <select id="az-kat"><option>Hematology</option><option>Chemistry</option><option>Immunology</option><option>Urinalysis</option><option>Coagulation</option><option>Lainnya</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Lokasi</label><input id="az-lokasi" placeholder="Lab Utama"></div>
      <div class="form-group"><label>Kalibrasi Berikutnya</label><input type="date" id="az-kalib"></div>
      <div class="form-group"><label>Status</label>
        <select id="az-status"><option>Aktif</option><option>Maintenance</option><option>Rusak</option></select></div>
    </div>
    <div class="form-group"><label><input type="checkbox" id="az-integ"> Integrasi analyzer aktif (HL7/ASTM)</label></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveAnalyzer()">💾 Simpan</button>
    </div>`);
}

async function saveAnalyzer(){
  const nama=document.getElementById('az-nama').value.trim();
  if(!nama){ toast('Nama alat wajib','err'); return; }
  try {
    await sbPost('analyzers',{
      kode_alat:document.getElementById('az-kode').value.trim()||null,
      nama_alat:nama, merk:document.getElementById('az-merk').value.trim()||null,
      model:document.getElementById('az-model').value.trim()||null,
      kategori:document.getElementById('az-kat').value,
      lokasi:document.getElementById('az-lokasi').value.trim()||null,
      kalibrasi_berikutnya:document.getElementById('az-kalib').value||null,
      status:document.getElementById('az-status').value,
      integrasi_aktif:document.getElementById('az-integ').checked,
      integrasi_protocol:document.getElementById('az-integ').checked?'HL7':null,
    });
    toast('✅ Analyzer tersimpan','ok'); closeModalForce(); renderQCTab();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function openQCForm(){
  const azOpts=(_labAnalyzers||[]).map(a=>`<option value="${a.id}" data-name="${a.nama_alat}">${a.nama_alat}</option>`).join('');
  openModal(`
    <div class="modal-header"><div class="modal-title">📊 Log QC Run</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label>Analyzer *</label>
        <select id="qc-az"><option value="">-- Pilih --</option>${azOpts}</select></div>
      <div class="form-group" style="grid-column:1/-1"><label>Nama Tes / Parameter *</label><input id="qc-test" placeholder="Glucose, WBC, ..."></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Level QC</label>
        <select id="qc-level"><option>Level 1 (Normal)</option><option>Level 2 (Abnormal)</option><option>Level 3</option></select></div>
      <div class="form-group"><label>Nilai Target</label><input type="number" step="any" id="qc-target"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>SD (1 sigma)</label><input type="number" step="any" id="qc-sd"></div>
      <div class="form-group"><label>Nilai Terukur *</label><input type="number" step="any" id="qc-measured" oninput="qcPreview()"></div>
    </div>
    <div id="qc-preview" style="margin-bottom:12px"></div>
    <div class="form-group"><label>Lot / Catatan</label><input id="qc-notes" placeholder="Lot reagen, tindakan..."></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveQCRun()">💾 Simpan Log QC</button>
    </div>`);
}

function qcPreview(){
  const t=parseFloat(document.getElementById('qc-target').value);
  const sd=parseFloat(document.getElementById('qc-sd').value);
  const m=parseFloat(document.getElementById('qc-measured').value);
  const box=document.getElementById('qc-preview');
  if(isNaN(t)||isNaN(sd)||isNaN(m)||sd===0){ box.innerHTML=''; return; }
  const z=(m-t)/sd; const ev=qcVerdict(z);
  box.innerHTML=`<div style="background:${ev.color}15;border:2px solid ${ev.color}40;border-radius:10px;padding:10px 14px">
    <strong style="color:${ev.color}">${ev.label}</strong> · Z-score = ${z.toFixed(2)}</div>`;
}

async function saveQCRun(){
  const azSel=document.getElementById('qc-az');
  const azId=azSel?.value;
  const test=document.getElementById('qc-test').value.trim();
  const measured=parseFloat(document.getElementById('qc-measured').value);
  if(!azId){ toast('Pilih analyzer','err'); return; }
  if(!test){ toast('Nama tes wajib','err'); return; }
  if(isNaN(measured)){ toast('Nilai terukur wajib','err'); return; }
  const target=parseFloat(document.getElementById('qc-target').value);
  const sd=parseFloat(document.getElementById('qc-sd').value);
  const z=(!isNaN(target)&&!isNaN(sd)&&sd!==0)?(measured-target)/sd:null;
  try {
    await sbPost('lab_qc_runs',{
      analyzer_id:parseInt(azId), analyzer_name:azSel.options[azSel.selectedIndex]?.dataset.name||'',
      test_name:test, qc_level:document.getElementById('qc-level').value,
      target:isNaN(target)?null:target, sd:isNaN(sd)?null:sd, measured,
      z_score:z, verdict:qcVerdict(z).label,
      notes:document.getElementById('qc-notes').value.trim()||null,
      run_by:labUser(), run_at:new Date().toISOString(),
    });
    toast('✅ Log QC tersimpan','ok'); closeModalForce(); renderQCTab();
  } catch(e){ toast('❌ '+e.message,'err'); }
}
