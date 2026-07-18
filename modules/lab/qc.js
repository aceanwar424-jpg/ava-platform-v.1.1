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
          <th>Waktu</th><th>Alat</th><th>Tes</th><th>Level</th><th>Target±SD</th><th>Terukur</th><th>Z-score</th><th>Evaluasi</th><th></th>
        </tr></thead><tbody>
        ${qcRuns.length?qcRuns.map(q=>{
          const z=(q.sd&&q.target!=null)?((q.measured-q.target)/q.sd):null;
          // Evaluasi kini mempertimbangkan pola antar run pada alat+tes yang sama,
          // bukan hanya titik ini sendiri (aturan Westgard 2-2s, R-4s, 4-1s, 10x).
          const seri = qcRuns.filter(x=>x.analyzer_id===q.analyzer_id && x.test_name===q.test_name
                                     && new Date(x.run_at) <= new Date(q.run_at));
          const ev = (typeof westgardEvaluate==='function') ? westgardEvaluate(seri) : qcVerdict(z);
          return `<tr>
            <td style="font-size:11px;color:var(--gray)">${q.run_at?new Date(q.run_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</td>
            <td style="font-size:12px">${q.analyzer_name||'—'}</td>
            <td style="font-size:12px">${q.test_name||'—'}</td>
            <td style="font-size:11px">${q.qc_level||'—'}</td>
            <td style="font-size:12px">${q.target??'—'} ± ${q.sd??'—'}</td>
            <td style="font-size:13px;font-weight:700">${q.measured??'—'}</td>
            <td style="font-size:12px;font-weight:700;color:${ev.color}">${z!=null?z.toFixed(2):'—'}</td>
            <td><span style="background:${ev.color}20;color:${ev.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700"
              title="${(ev.detail||'').replace(/"/g,'')}">${ev.label}${ev.rule?' · '+ev.rule:''}</span></td>
            <td>${q.analyzer_id&&q.test_name?`<button class="btn btn-ghost btn-xs"
              onclick="openLJChart(${q.analyzer_id},'${String(q.test_name).replace(/'/g,"\\'")}')">📈</button>`:''}</td>
          </tr>`;
        }).join(''):`<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--gray)">Belum ada log QC. Klik "+ Log QC".</td></tr>`}
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

// ══════════════════════════════════════════════════════════════
// WESTGARD MULTI-RUN & LEVEY-JENNINGS (Fase 5.5)
// qcVerdict() yang ada hanya menilai SATU titik (1-2s / 1-3s). Aturan Westgard
// yang sesungguhnya menilai POLA antar run berurutan — pergeseran sistematis
// justru tidak terlihat bila hanya melihat satu titik.
// ══════════════════════════════════════════════════════════════

// runs: urut dari TERBARU ke terlama (sesuai query renderQCTab)
function westgardEvaluate(runs) {
  const z = runs.map(r => r.z_score).filter(v => v != null);
  if (!z.length) return { label:'—', color:'#94A3B8', rule:null, detail:'Belum ada data QC' };

  const cur = z[0], a = Math.abs(cur);

  // 1-3s — satu titik di luar 3SD → tolak
  if (a > 3) return { label:'TOLAK', color:'#B91C1C', rule:'1-3s',
    detail:'Satu titik melewati 3SD. Jangan keluarkan hasil; ulangi QC dan periksa alat.' };

  // 2-2s — dua run berurutan di sisi sama, keduanya >2SD
  if (z.length >= 2 && Math.abs(z[0]) > 2 && Math.abs(z[1]) > 2 && Math.sign(z[0]) === Math.sign(z[1]))
    return { label:'TOLAK', color:'#B91C1C', rule:'2-2s',
      detail:'Dua run berurutan melewati 2SD pada sisi yang sama — indikasi kesalahan sistematis.' };

  // R-4s — selisih dua run berurutan melebihi 4SD (kesalahan acak)
  if (z.length >= 2 && Math.abs(z[0] - z[1]) > 4)
    return { label:'TOLAK', color:'#B91C1C', rule:'R-4s',
      detail:'Rentang antar dua run melebihi 4SD — indikasi kesalahan acak.' };

  // 4-1s — empat run berurutan di sisi sama, semuanya >1SD
  if (z.length >= 4 && z.slice(0,4).every(v => Math.abs(v) > 1) &&
      z.slice(0,4).every(v => Math.sign(v) === Math.sign(z[0])))
    return { label:'PERINGATAN', color:'#B45309', rule:'4-1s',
      detail:'Empat run berurutan melewati 1SD pada sisi yang sama — mulai bergeser.' };

  // 10x — sepuluh run berurutan pada sisi rata-rata yang sama
  if (z.length >= 10 && z.slice(0,10).every(v => Math.sign(v) === Math.sign(z[0]) && v !== 0))
    return { label:'PERINGATAN', color:'#B45309', rule:'10x',
      detail:'Sepuluh run berurutan pada sisi yang sama — pergeseran sistematis.' };

  // 1-2s — peringatan awal, belum menolak
  if (a > 2) return { label:'PERINGATAN', color:'#B45309', rule:'1-2s',
    detail:'Satu titik melewati 2SD. Amati run berikutnya.' };

  return { label:'TERKENDALI', color:'#15803D', rule:null, detail:'QC dalam kendali.' };
}

// Grafik kendali sederhana — SVG, tanpa pustaka luar
function ljChartSVG(runs, w = 720, h = 220) {
  const pts = runs.slice().reverse().filter(r => r.z_score != null); // lama → baru
  if (!pts.length) return '<div style="color:var(--gray);font-size:12px">Belum ada data QC</div>';

  const pad = { l:38, r:12, t:12, b:24 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const yOf = z => pad.t + ch/2 - (Math.max(-4, Math.min(4, z)) / 4) * (ch/2);
  const xOf = i => pad.l + (pts.length === 1 ? cw/2 : (i/(pts.length-1)) * cw);

  const band = (z, col, dash) =>
    `<line x1="${pad.l}" y1="${yOf(z)}" x2="${w-pad.r}" y2="${yOf(z)}"
      stroke="${col}" stroke-width="1" ${dash?'stroke-dasharray="4 3"':''}/>`;

  const line = pts.map((p,i)=>`${i?'L':'M'}${xOf(i).toFixed(1)},${yOf(p.z_score).toFixed(1)}`).join(' ');
  const dots = pts.map((p,i)=>{
    const a = Math.abs(p.z_score);
    const c = a > 3 ? '#B91C1C' : a > 2 ? '#B45309' : '#0E7C86';
    return `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.z_score).toFixed(1)}" r="3.5" fill="${c}">
      <title>${new Date(p.run_at).toLocaleString('id-ID')} · z=${(+p.z_score).toFixed(2)} · ${p.verdict||''}</title>
    </circle>`;
  }).join('');

  const lbl = z => `<text x="4" y="${yOf(z)+3.5}" font-size="9" fill="#6B7A8B">${z>0?'+':''}${z}SD</text>`;

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;background:#fff;border:1px solid var(--border);border-radius:8px">
    ${band(3,'#FCA5A5')}${band(2,'#FDE68A')}${band(1,'#E3E7EC',true)}
    ${band(0,'#0E7C86')}
    ${band(-1,'#E3E7EC',true)}${band(-2,'#FDE68A')}${band(-3,'#FCA5A5')}
    ${lbl(3)}${lbl(2)}${lbl(0)}${lbl(-2)}${lbl(-3)}
    <path d="${line}" fill="none" stroke="#123A5C" stroke-width="1.5"/>
    ${dots}
  </svg>`;
}

// Dipanggil dari tombol di tabel QC
async function openLJChart(analyzerId, testName) {
  let runs = [];
  try {
    runs = await sbGet('lab_qc_runs',
      `select=*&analyzer_id=eq.${analyzerId}&test_name=eq.${encodeURIComponent(testName)}&order=run_at.desc&limit=40`) || [];
  } catch(e) { toast('Gagal memuat data QC','err'); return; }

  const ev = westgardEvaluate(runs);
  openModal(`
    <div class="modal-header"><div class="modal-title">📈 Levey-Jennings — ${testName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="background:${ev.color}14;border:1px solid ${ev.color}55;border-radius:8px;
      padding:10px 14px;margin-bottom:12px">
      <div style="font-weight:800;color:${ev.color};font-size:13px">
        ${ev.label}${ev.rule?` · aturan ${ev.rule}`:''}</div>
      <div style="font-size:12.5px;color:var(--text2);margin-top:3px">${ev.detail}</div>
    </div>
    ${ljChartSVG(runs)}
    <div style="font-size:11.5px;color:var(--gray);margin-top:8px">
      Menampilkan ${runs.length} run terakhir, kiri ke kanan dari yang terlama.
      Arahkan kursor ke titik untuk melihat detailnya.
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}
