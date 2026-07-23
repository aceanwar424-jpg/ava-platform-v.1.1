// ═══════════════════════════════════════════════════════════════
// LIS · WORKLIST & TURNAROUND TIME (TAT)
// - Worklist berbasis daftar pasien beserta status keseluruhan
// - Kolom kanan: Daftar test yang dipesan dan statusnya per-test
//   (Pending, Enter Result, Validate, Approve)
// ═══════════════════════════════════════════════════════════════

let _wlSelPatient = null;
let _wlStatusFilter = 'ALL';
let _wlSearchQuery = '';

function getWorklistPatientsData() {
  const patientMap = {};

  // 1. Ambil dari labSamples (sampel terdaftar)
  (labSamples || []).forEach(s => {
    const k = s.admission_id || s.visit_number || s.patient_name;
    if (!k) return;
    if (!patientMap[k]) {
      patientMap[k] = {
        admission_id: s.admission_id,
        patient_name: s.patient_name,
        visit_number: s.visit_number,
        mr_number: s.mr_number,
        created_at: s.created_at,
        collected_at: s.collected_at,
        received_at: s.received_at,
        testsMap: {}
      };
    }
    const pid = s.product_id || s.product_name;
    if (!patientMap[k].testsMap[pid]) {
      patientMap[k].testsMap[pid] = {
        product_id: s.product_id,
        product_name: s.product_name,
        barcode: s.barcode,
        sampel_type: s.sampel_type,
        sample_id: s.id,
        sample_status: s.status,
        results: []
      };
    } else {
      if (s.barcode && !patientMap[k].testsMap[pid].barcode) {
        patientMap[k].testsMap[pid].barcode = s.barcode;
      }
    }
  });

  // 2. Ambil dari labResults (hasil terdaftar)
  (labResults || []).forEach(r => {
    const k = r.admission_id || r.visit_number || r.patient_name;
    if (!k) return;
    if (!patientMap[k]) {
      patientMap[k] = {
        admission_id: r.admission_id,
        patient_name: r.patient_name,
        visit_number: r.visit_number,
        mr_number: r.mr_number,
        created_at: r.created_at,
        collected_at: null,
        received_at: null,
        testsMap: {}
      };
    }
    const pid = r.product_id || r.product_name;
    if (!patientMap[k].testsMap[pid]) {
      patientMap[k].testsMap[pid] = {
        product_id: r.product_id,
        product_name: r.product_name,
        barcode: null,
        sampel_type: null,
        sample_id: r.sample_id,
        sample_status: null,
        results: [r]
      };
    } else {
      patientMap[k].testsMap[pid].results.push(r);
    }
  });

  // 3. Hitung status per-test & status pasien keseluruhan
  const patients = Object.values(patientMap).map(p => {
    const tests = Object.values(p.testsMap).map(t => {
      let status = 'Pending';
      const results = t.results || [];
      if (results.some(r => r.status === 'Approved' || r.status === 'Released')) {
        status = 'Approve';
      } else if (results.some(r => r.status === 'Validated')) {
        status = 'Validate';
      } else if (results.some(r => r.result_value || r.status === 'Draft')) {
        status = 'Enter Result';
      } else {
        status = 'Pending';
      }

      const firstRes = results.find(r => r.result_value);
      const resultVal = firstRes ? `${firstRes.result_value} ${firstRes.unit || ''}`.trim() : null;

      return {
        ...t,
        status,
        resultVal
      };
    });

    let patientStatus = 'Pending';
    if (tests.length > 0) {
      if (tests.every(t => t.status === 'Approve')) {
        patientStatus = 'Approve';
      } else if (tests.every(t => t.status === 'Validate' || t.status === 'Approve')) {
        patientStatus = 'Validate';
      } else if (tests.some(t => t.status === 'Enter Result' || t.status === 'Validate' || t.status === 'Approve')) {
        patientStatus = 'Enter Result';
      } else {
        patientStatus = 'Pending';
      }
    }

    return {
      ...p,
      tests,
      patientStatus
    };
  });

  // Filter pencarian
  let filtered = patients;
  if (_wlSearchQuery) {
    const q = _wlSearchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      (p.patient_name || '').toLowerCase().includes(q) ||
      (p.mr_number || '').toLowerCase().includes(q) ||
      (p.visit_number || '').toLowerCase().includes(q) ||
      p.tests.some(t => (t.product_name || '').toLowerCase().includes(q) || (t.barcode || '').toLowerCase().includes(q))
    );
  }

  if (_wlStatusFilter !== 'ALL') {
    filtered = filtered.filter(p => p.patientStatus === _wlStatusFilter || p.tests.some(t => t.status === _wlStatusFilter));
  }

  filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return filtered;
}

function wlStatusBadge(status) {
  const BADGES = {
    'Pending':      { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    'Enter Result': { bg: '#EDE9FE', color: '#6D28D9', label: 'Enter Result' },
    'Validate':     { bg: '#E0F2FE', color: '#0369A1', label: 'Validated' },
    'Approve':      { bg: '#DCFCE7', color: '#166534', label: 'Approved' },
  };
  const b = BADGES[status] || BADGES['Pending'];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;background:${b.bg};color:${b.color}">${b.label}</span>`;
}

function renderWorklistTab(){
  const el = document.getElementById('lab-worklist'); if(!el) return;
  const patients = getWorklistPatientsData();

  if(!patients.some(p => p.admission_id == _wlSelPatient)) {
    _wlSelPatient = patients.length ? patients[0].admission_id : null;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <input type="text" id="wl-search-input" value="${_wlSearchQuery}" placeholder="Cari Pasien / RM / Barcode / Test..."
          oninput="_wlSearchQuery=this.value;renderWorklistTab()"
          style="padding:6px 12px;font-size:12px;border:1px solid var(--border);border-radius:6px;width:240px">
        <div style="display:flex;gap:4px">
          ${['ALL','Pending','Enter Result','Validate','Approve'].map(st => `
            <button onclick="_wlStatusFilter='${st}';renderWorklistTab()"
              class="btn btn-xs ${st===_wlStatusFilter?'btn-teal':'btn-ghost'}" style="font-weight:600">
              ${st==='ALL'?'Semua':st}
            </button>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="openAnalyzerIntake()">Terima Hasil Alat</button>
      </div>
    </div>

    ${patients.length ? `
    <div style="display:grid;grid-template-columns:1fr 340px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff">
      <!-- Kolom Kiri: Daftar Pasien & Status -->
      <div style="border-right:1px solid var(--border);overflow-y:auto;max-height:650px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#0A2342;color:#fff;position:sticky;top:0;z-index:1;font-size:11px;text-transform:uppercase">
              <th style="padding:7px 10px;text-align:left">No. Visit / RM</th>
              <th style="padding:7px 10px;text-align:left">Pasien</th>
              <th style="padding:7px 10px;text-align:left">Status Pasien</th>
              <th style="padding:7px 10px;text-align:left">Test &amp; Status</th>
              <th style="padding:7px 10px;text-align:left">TAT</th>
              <th style="padding:7px 10px;text-align:center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${patients.map(p => {
              const sel = p.admission_id == _wlSelPatient;
              return `
              <tr onclick="selectWorklistPatient(${p.admission_id})"
                style="cursor:pointer;border-bottom:1px solid #f1f5f9;${sel?'background:var(--mint)':''}">
                <td style="padding:8px 10px;font-family:monospace;font-weight:700">${p.visit_number||'—'}
                  <div style="font-size:10px;color:var(--gray)">${p.mr_number||''}</div></td>
                <td style="padding:8px 10px;font-weight:700;color:var(--navy)">${p.patient_name||'—'}</td>
                <td style="padding:8px 10px">${wlStatusBadge(p.patientStatus)}</td>
                <td style="padding:8px 10px">
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${p.tests.map(t => `<span title="${t.product_name}: ${t.status}" style="font-size:10px">${wlStatusBadge(t.status)} <span style="color:var(--navy);font-weight:600">${t.product_name}</span></span>`).join('<span style="color:#cbd5e1">|</span>')}
                  </div>
                </td>
                <td style="padding:8px 10px">${tatBadge(p.tests[0]||{})}</td>
                <td style="padding:8px 10px;text-align:center">
                  <button class="btn btn-teal btn-xs" onclick="event.stopPropagation();selectWorklistPatient(${p.admission_id})">Detail →</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Kolom Kanan: Detail Test Dipesan & Status Per-Test -->
      <div id="wl-right-panel" style="background:#F8FAFC;padding:14px;overflow-y:auto;max-height:650px">
      </div>
    </div>` : `
    <div class="empty-state" style="padding:40px;background:#fff;border-radius:10px;border:1px solid var(--border)">
      <h3>Worklist Kosong</h3>
      <p style="color:var(--gray);font-size:12px">Belum ada order pasien atau sampel yang sesuai dengan filter.</p>
    </div>`}
  `;

  if(_wlSelPatient != null) renderWorklistRightPanel(_wlSelPatient);
}

function selectWorklistPatient(admId) {
  _wlSelPatient = admId;
  renderWorklistTab();
}

function renderWorklistRightPanel(admId) {
  const panel = document.getElementById('wl-right-panel'); if(!panel) return;
  const patients = getWorklistPatientsData();
  const p = patients.find(x => x.admission_id == admId);
  if(!p) {
    panel.innerHTML = `<div style="color:var(--gray);font-size:12px;text-align:center;padding:30px">Pilih pasien di sebelah kiri untuk melihat daftar test yang dipesan.</div>`;
    return;
  }

  panel.innerHTML = `
    <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-size:14px;font-weight:800;color:var(--navy)">${p.patient_name||'—'}</div>
      <div style="font-size:11px;color:var(--gray);font-family:monospace;margin-top:2px">${p.mr_number||''} · ${p.visit_number||''}</div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--gray);font-weight:600">Status Pasien:</span>
        ${wlStatusBadge(p.patientStatus)}
      </div>
    </div>

    <div style="font-size:11px;font-weight:800;color:#0A2342;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
      Daftar Test Dipesan &amp; Status (${p.tests.length})
    </div>

    <div style="display:flex;flex-direction:column;gap:8px">
      ${p.tests.map(t => {
        return `
        <div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${t.status==='Approve'?'#22C55E':t.status==='Validate'?'#0EA5E9':t.status==='Enter Result'?'#8B5CF6':'#F59E0B'};border-radius:8px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:12.5px;font-weight:700;color:var(--navy)">${t.product_name||'—'}</div>
              <div style="font-size:10.5px;color:var(--gray);font-family:monospace;margin-top:2px">
                Barcode: ${t.barcode||'—'} · Sampel: ${t.sampel_type||'—'}
              </div>
            </div>
            ${wlStatusBadge(t.status)}
          </div>

          ${t.resultVal ? `<div style="font-size:11.5px;color:var(--teal);font-weight:700;margin-top:6px;background:#F0FDF4;padding:4px 8px;border-radius:4px;display:inline-block">Hasil: ${t.resultVal}</div>` : ''}

          <div style="margin-top:8px;display:flex;justify-content:flex-end">
            ${t.status === 'Pending' || t.status === 'Enter Result' ? `
              <button class="btn btn-teal btn-xs" onclick="openResultEntry(${p.admission_id}, ${t.product_id})">Input Hasil</button>
            ` : t.status === 'Validate' ? `
              <button class="btn btn-ghost btn-xs" style="color:#0369A1;border-color:#0369A1" onclick="switchLabTab('validation')">Ke Validasi →</button>
            ` : `
              <button class="btn btn-ghost btn-xs" style="color:#166534;border-color:#166534" onclick="switchLabTab('approval')">Ke Approval →</button>
            `}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// Buka input hasil per-tes
function entryFromSample(sampleId){
  const s=labSamples.find(x=>x.id==sampleId); if(!s) return;
  openResultEntry(s.admission_id, s.product_id);
}

// Input Batch
async function openBatchEntry(nameEnc){
  const name=decodeURIComponent(nameEnc);
  const inProc=labSamples.filter(s=>s.status==='In Process').filter(s=>{
    const p=labProduct(s.product_id);
    const key=s.analyzer_name || (p?.kategori) || 'Manual / Belum Ditentukan';
    return key===name;
  });
  if(!inProc.length){ toast('Tidak ada sampel','warn'); return; }

  await Promise.all([...new Set(inProc.map(s=>s.product_id))].map(pid=>labLoadRR(pid)));

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Input Batch — ${name}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
      Masukkan nilai lalu tekan <strong>Simpan Semua</strong>. Interpretasi & nilai kritis dihitung otomatis dari rentang rujukan.</div>
    <div class="table-wrap" style="max-height:420px;overflow-y:auto">
      <table><thead><tr>
        <th>Pasien</th><th>Tes</th><th style="width:120px">Hasil</th><th>Unit</th><th>Interpretasi</th>
      </tr></thead><tbody>
      ${inProc.map(s=>{
        const p=labProduct(s.product_id);
        if(p?.is_panel){
          return `<tr data-sample="${s.id}" data-prod="${s.product_id}">
            <td style="font-size:12px"><div style="font-weight:600">${s.patient_name||'—'}</div>
              <div style="font-size:10px;color:var(--gray)">${s.visit_number||''}</div></td>
            <td style="font-size:12px">${s.product_name||'—'} <span style="background:#EDE9FE;color:#6D28D9;padding:1px 6px;border-radius:6px;font-size:9px;font-weight:700">PANEL</span></td>
            <td colspan="2"><button class="btn btn-teal btn-xs" onclick="closeModalForce();openResultEntry(${s.admission_id},${s.product_id})">Input per parameter →</button></td>
            <td class="be-interp" style="font-size:11px;color:var(--gray)">panel</td>
          </tr>`;
        }
        return `<tr data-sample="${s.id}" data-prod="${s.product_id}">
          <td style="font-size:12px"><div style="font-weight:600">${s.patient_name||'—'}</div>
            <div style="font-size:10px;color:var(--gray)">${s.visit_number||''}</div></td>
          <td style="font-size:12px">${s.product_name||'—'}</td>
          <td><input type="text" class="be-val" style="width:110px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px"
            oninput="beInterpret(this)" placeholder="—"></td>
          <td style="font-size:11px;color:var(--gray)">${p?.satuan_hasil||''}
            <input type="hidden" class="be-unit" value="${p?.satuan_hasil||''}"></td>
          <td class="be-interp" style="font-size:11px;color:var(--gray)">—</td>
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveBatchEntry()">Simpan Semua</button>
    </div>`);
}

function beInterpret(input){
  const tr=input.closest('tr');
  const pid=tr.dataset.prod;
  const cell=tr.querySelector('.be-interp');
  const raw=input.value.trim();
  const rrs=_rrCache[pid]||[];
  if(raw===''||!rrs.length){ cell.textContent='—'; cell.style.color='var(--gray)'; input.style.borderColor='var(--border)'; return; }
  const m=matchRefRange(rrs,raw);
  if(!m){ cell.textContent='—'; cell.style.color='var(--gray)'; input.style.borderColor='var(--border)'; return; }
  const num=parseFloat(raw);
  const c=labColor(m.color_code);
  const crit=(!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical';
  cell.innerHTML=`<span style="color:${c};font-weight:700">${m.condition_name||m.interpretation||'—'}${crit?' [KRITIS]':''}</span>`;
  input.style.borderColor=c;
}

async function saveBatchEntry(){
  const rows=[...document.querySelectorAll('#modal-box tbody tr')];
  const toSave=rows.filter(tr=>{ const i=tr.querySelector('.be-val'); return i && i.value.trim(); });
  if(!toSave.length){ toast('Belum ada nilai diisi','warn'); return; }
  let ok=0;
  for(const tr of toSave){
    const sid=parseInt(tr.dataset.sample);
    const pid=parseInt(tr.dataset.prod);
    const val=tr.querySelector('.be-val').value.trim();
    const unit=tr.querySelector('.be-unit').value||null;
    const s=labSamples.find(x=>x.id==sid)||{};
    const num=parseFloat(val);
    const rrs=_rrCache[pid]||[];
    const m=matchRefRange(rrs, val);
    const crit=m?((!isNaN(num)&&((m.critical_low!=null&&num<=m.critical_low)||(m.critical_high!=null&&num>=m.critical_high)))||m.condition_type==='critical'):false;
    const payload={
      result_value:val, result_numeric:isNaN(num)?null:num, unit,
      ref_range_id:m?.id||null, normal_min:m?.range_min??null, normal_max:m?.range_max??null,
      critical_low:m?.critical_low??null, critical_high:m?.critical_high??null,
      interpretation:m?.interpretation||m?.condition_name||null, color_code:m?.color_code||'green',
      condition_name:m?.condition_name||null, condition_type:m?.condition_type||null,
      is_critical:crit, is_auto:false, status:'Draft',
      entered_by:labUser(), entered_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    };
    try {
      let r=labResults.find(x=>x.sample_id==sid) ||
            labResults.find(x=>x.admission_id==s.admission_id && x.product_id==pid && x.status==='Draft');
      if(r) await sbPatch('lab_results',r.id,payload);
      else  await sbPost('lab_results',{...payload, sample_id:sid, admission_id:s.admission_id,
              visit_number:s.visit_number, patient_name:s.patient_name, product_id:pid, product_name:s.product_name});
      await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()});
      ok++;
    } catch(e){ }
  }
  toast(`${ok} hasil tersimpan → siap divalidasi`,'ok');
  closeModalForce(); labRefresh();
}