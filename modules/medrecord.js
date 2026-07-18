// ═══════════════════════════════════════════
// MODULE: Medical Record — Rekam Medis Gabungan
// Lab + Klinik + Anamnesa per pasien per kunjungan
// ═══════════════════════════════════════════

let mrPatients = [], mrActivePatient = null;

async function renderMedRecord() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Rekam Medis</h1>
        <p>Rekam medis gabungan per pasien — anamnesa, lab, radiologi, EKG, semua dalam satu</p></div>
    </div>

    <!-- Search Patient -->
    <div class="card" style="margin-bottom:16px;padding:16px">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">🔍 Cari Pasien</div>
      <div style="display:flex;gap:8px">
        <input class="table-search" id="mr-search" placeholder="Nama pasien, no. KTP, no. HP..."
          oninput="searchPatientMR(this.value)" style="flex:1">
        <input type="date" class="table-filter" id="mr-date" title="Filter tanggal kunjungan" onchange="searchPatientMR(document.getElementById('mr-search').value)">
      </div>
      <div id="mr-search-results" style="margin-top:10px"></div>
    </div>

    <!-- Patient Record -->
    <div id="mr-content">
      <div style="text-align:center;padding:60px 20px;color:var(--gray)">
        <div style="font-size:48px">📋</div>
        <div style="font-size:14px;margin-top:12px">Cari dan pilih pasien untuk melihat rekam medisnya</div>
      </div>
    </div>`;
}

async function searchPatientMR(q) {
  const el = document.getElementById('mr-search-results'); if (!el) return;
  if (!q || q.length < 2) { el.innerHTML=''; return; }
  try {
    const data = await sbGet('admissions',
      `select=id,visit_number,patient_name,patient_dob,patient_gender,patient_age,patient_phone,patient_id_number,visit_date,status&patient_name=ilike.${encodeURIComponent('%'+q+'%')}&order=visit_date.desc&limit=20`);
    if (!data?.length) {
      el.innerHTML=`<div style="color:var(--gray);font-size:13px;padding:8px">Pasien tidak ditemukan</div>`; return;
    }
    // Group by patient name
    const byPat={};
    data.forEach(a=>{
      const key=a.patient_name;
      if (!byPat[key]) byPat[key]={name:key,dob:a.patient_dob,gender:a.patient_gender,phone:a.patient_phone,id_num:a.patient_id_number,visits:[]};
      byPat[key].visits.push(a);
    });
    el.innerHTML=Object.values(byPat).map(p=>`
      <div onclick="loadPatientMR(${JSON.stringify(p.visits.map(v=>v.id)).replace(/"/g,'&quot;')},'${p.name.replace(/'/g,"\\'")}')"
        style="padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;
          display:flex;align-items:center;gap:12px;transition:all .15s"
        onmouseover="this.style.borderColor='var(--teal)';this.style.background='var(--mint)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background=''">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--teal);color:#fff;
          display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">
          ${p.name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <div style="font-weight:700;color:var(--navy)">${p.name}</div>
          <div style="font-size:11px;color:var(--gray)">
            ${p.gender==='M'?'♂':'♀'} ${p.dob?Math.floor((new Date()-new Date(p.dob))/31557600000)+' tahun':''} 
            ${p.phone?' · '+p.phone:''}
            ${p.id_num?' · '+p.id_num:''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--gray)">${p.visits.length} kunjungan</div>
          <div style="font-size:10px;color:var(--teal)">${p.visits[0].visit_date||''}</div>
        </div>
      </div>`).join('');
  } catch(e) { el.innerHTML=`<div class="status-box status-err">${e.message}</div>`; }
}

async function loadPatientMR(admissionIds, patientName) {
  document.getElementById('mr-search-results').innerHTML='';
  document.getElementById('mr-search').value=patientName;
  const el=document.getElementById('mr-content');
  el.innerHTML=`<div class="loading-row"><div class="spinner"></div></div>`;

  try {
    // Load all admissions
    const adms = await Promise.all(admissionIds.map(id=>
      sbGet('admissions',`select=*&id=eq.${id}`).then(d=>d[0]).catch(()=>null)
    ));
    const validAdms = adms.filter(Boolean);

    // Load anamnesa
    const anamnesas = await sbGet('anamnesas',
      `select=*&admission_id=in.(${admissionIds.join(',')})`).catch(()=>[]);

    // Load lab results
    const results = await sbGet('lab_results',
      `select=*&admission_id=in.(${admissionIds.join(',')})&order=created_at.asc`).catch(()=>[]);

    renderPatientMR(validAdms, anamnesas||[], results||[], patientName);
  } catch(e) {
    el.innerHTML=`<div class="status-box status-err">${e.message}</div>`;
  }
}

function renderPatientMR(adms, anamnesas, results, patientName) {
  const el=document.getElementById('mr-content'); if (!el) return;
  const latest=adms[0]||{};
  const cMap={green:'#22C55E',yellow:'#F59E0B',orange:'#F97316',red:'#EF4444'};

  // Group results by visit
  const byVisit={};
  adms.forEach(a=>{
    byVisit[a.id]={admission:a,anamnesa:anamnesas.find(an=>an.admission_id===a.id)||null,results:results.filter(r=>r.admission_id===a.id)};
  });

  // Split results by type
  const getLabResults   = (r) => !['Rontgen Thorax','Rontgen Extremitas','Rontgen Vertebra','USG Abdomen','USG Pelvis','EKG 12 Lead','EKG Treadmill','Audiometri','Spirometri'].includes(r.product_name) && !r.notes?.includes('[RADIO]') && !r.notes?.includes('[SUPP:');
  const getRadioResults = (r) => r.notes?.includes('[RADIO]') || ['Rontgen','USG'].some(x=>r.product_name?.includes(x));
  const getSuppResults  = (r) => r.notes?.includes('[SUPP:') || ['EKG','Audiometri','Spirometri'].some(x=>r.product_name?.includes(x));

  el.innerHTML=`
    <!-- Patient Header -->
    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--teal)">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--teal);color:#fff;
          display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0">
          ${patientName.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;color:var(--navy)">${patientName}</div>
          <div style="font-size:12px;color:var(--gray);margin-top:2px">
            ${latest.patient_gender==='M'?'♂ Laki-laki':'♀ Perempuan'} 
            ${latest.patient_age?' · '+latest.patient_age+' tahun':''} 
            ${latest.patient_phone?' · '+latest.patient_phone:''}
            ${latest.patient_id_number?' · KTP: '+latest.patient_id_number:''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-outline btn-sm" onclick="printFullMedRecord('${patientName.replace(/'/g,"\\'")}')">🖨 Cetak Rekam Medis</button>
        </div>
      </div>
    </div>

    <!-- Visit Timeline -->
    ${Object.entries(byVisit).map(([admId,visit])=>{
      const a  = visit.admission;
      const an = visit.anamnesa;
      const labR   = visit.results.filter(getLabResults);
      const radioR = visit.results.filter(getRadioResults);
      const suppR  = visit.results.filter(getSuppResults);

      return `
      <div class="card" style="margin-bottom:14px" id="visit-${admId}">
        <!-- Visit Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--navy);color:#fff;
              display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">
              ${adms.indexOf(a)+1}
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--navy)">${a.visit_number||'—'}</div>
              <div style="font-size:11px;color:var(--gray)">${a.visit_date?formatDateShort(a.visit_date):''} · ${a.visit_type||'Walk-in'} · ${a.package_name||'Layanan Individual'}</div>
            </div>
          </div>
          <span style="background:${a.status==='Done'?'#E8F5E9':'#FFF8E1'};color:${a.status==='Done'?'#2E7D32':'#92400E'};padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700">${a.status||'—'}</span>
        </div>

        <!-- Anamnesa -->
        ${an?`
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">🩺 Anamnesa & TTV</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin-bottom:8px">
              ${[
                {l:'Tensi',    v:`${an.systole||'—'}/${an.diastole||'—'} mmHg`},
                {l:'Nadi',     v:`${an.heart_rate||'—'} bpm`},
                {l:'Suhu',     v:`${an.temperature||'—'} °C`},
                {l:'SpO2',     v:`${an.spo2||'—'} %`},
                {l:'BB/TB',    v:`${an.weight||'—'} kg / ${an.height||'—'} cm`},
                {l:'BMI',      v:an.bmi||'—'},
              ].map(k=>`<div style="background:var(--lgray);border-radius:6px;padding:6px 8px;text-align:center">
                <div style="font-size:10px;color:var(--gray)">${k.l}</div>
                <div style="font-size:12px;font-weight:700;color:var(--navy)">${k.v}</div>
              </div>`).join('')}
            </div>
            ${an.chief_complaint?`<div style="font-size:12px;color:var(--text)"><strong>Keluhan:</strong> ${an.chief_complaint}</div>`:''}
          </div>`:''}

        <!-- Lab Results -->
        ${labR.length?`
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">🧪 Hasil Laboratorium (${labR.length} tes)</div>
            <div style="overflow-x:auto">
              <table style="width:100%;font-size:12px;border-collapse:collapse">
                <thead><tr style="background:var(--lgray)">
                  <th style="padding:5px 10px;text-align:left">Tes</th>
                  <th style="padding:5px 10px;text-align:center">Hasil</th>
                  <th style="padding:5px 10px;text-align:center">Satuan</th>
                  <th style="padding:5px 10px;text-align:left">Interpretasi</th>
                  <th style="padding:5px 10px;text-align:left">Normal</th>
                </tr></thead>
                <tbody>
                ${labR.map(r=>{
                  const c=cMap[r.color_code]||'#94A3B8';
                  return `<tr style="border-bottom:1px solid #F1F5F9">
                    <td style="padding:5px 10px;font-weight:600">${r.product_name||'—'}</td>
                    <td style="padding:5px 10px;text-align:center;font-weight:800;color:${c}">${r.result_value||'—'}</td>
                    <td style="padding:5px 10px;text-align:center;color:var(--gray)">${r.unit||'—'}</td>
                    <td style="padding:5px 10px"><span style="background:${c}20;color:${c};padding:2px 7px;border-radius:6px;font-size:10px;font-weight:700">${r.interpretation||'—'}</span></td>
                    <td style="padding:5px 10px;color:var(--gray)">${r.normal_min!==null&&r.normal_max!==null?`${r.normal_min}–${r.normal_max}`:'—'}</td>
                  </tr>`;
                }).join('')}
                </tbody>
              </table>
            </div>
          </div>`:''}

        <!-- Radiology -->
        ${radioR.length?`
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">🫁 Radiologi (${radioR.length})</div>
            ${radioR.map(r=>{
              const c=cMap[r.color_code]||'#94A3B8';
              const fileUrl=r.notes?.match(/\[FILE:(.*?)\]/)?.[1]||'';
              return `<div style="background:var(--lgray);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;gap:10px">
                ${fileUrl?`<img src="${fileUrl}" style="width:50px;height:50px;border-radius:4px;object-fit:cover;flex-shrink:0">`:''}
                <div>
                  <div style="font-size:12px;font-weight:700">${r.product_name||'—'}</div>
                  <div style="font-size:11px;color:var(--text);margin-top:2px">${(r.result_value||'').substring(0,100)}${(r.result_value||'').length>100?'...':''}</div>
                  <span style="background:${c}20;color:${c};padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700;margin-top:4px;display:inline-block">${r.interpretation||'—'}</span>
                </div>
              </div>`;
            }).join('')}
          </div>`:''}

        <!-- Supportive -->
        ${suppR.length?`
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">❤️ Pemeriksaan Supportive (${suppR.length})</div>
            ${suppR.map(r=>{
              const c=cMap[r.color_code]||'#94A3B8';
              const cfg=Object.entries(SUPPORTIVE_TYPES||{}).find(([t])=>r.product_name===t)?.[1]||{icon:'📋'};
              return `<div style="background:var(--lgray);border-radius:8px;padding:10px 12px;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:18px">${cfg.icon}</span>
                  <div style="flex:1">
                    <div style="font-size:12px;font-weight:700">${r.product_name||'—'}</div>
                    <div style="font-size:11px;color:var(--text)">${(r.result_value||'').substring(0,80)}</div>
                  </div>
                  <span style="background:${c}20;color:${c};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.interpretation||'—'}</span>
                </div>
              </div>`;
            }).join('')}
          </div>`:''}

        ${!an&&!labR.length&&!radioR.length&&!suppR.length?
          `<div style="color:var(--gray);font-size:12px;text-align:center;padding:14px">Belum ada data pemeriksaan untuk kunjungan ini</div>`:''
        }
      </div>`;
    }).join('')}`;

  // Fase 3 — panel klinis yang bisa DITULIS, disisipkan di atas riwayat kunjungan
  const mr = latest.mr_number || null;
  const panel = document.createElement('div');
  panel.id = 'mr-clinical';
  el.insertBefore(panel, el.firstChild?.nextSibling || null);
  renderMRClinical(mr, patientName, latest.id);
}

// ══════════════════════════════════════════════════════════════
// FASE 3 — Catatan klinis, alergi, masalah, tanda vital
// Semua menempel di mr_number agar bertahan lintas kunjungan.
// ══════════════════════════════════════════════════════════════
let mrClinical = { mr:null, name:'', admId:null, allergies:[], problems:[], vitals:[], notes:[] };

async function renderMRClinical(mrNumber, patientName, admissionId) {
  const el = document.getElementById('mr-clinical'); if (!el) return;
  mrClinical = { mr:mrNumber, name:patientName, admId:admissionId, allergies:[], problems:[], vitals:[], notes:[] };

  if (!mrNumber) {
    el.innerHTML = `<div class="status-box status-warn" style="margin-bottom:14px">
      Pasien ini belum memiliki nomor rekam medis (MR). Catatan klinis memerlukan nomor MR —
      lengkapi lewat Admission terlebih dulu.</div>`;
    return;
  }

  el.innerHTML = `<div class="loading-row"><div class="spinner"></div></div>`;
  const q = `mr_number=eq.${encodeURIComponent(mrNumber)}`;
  try {
    const [alg, prb, vit, nts] = await Promise.all([
      sbGet('patient_allergies', `select=*&${q}&is_active=eq.true&order=created_at.desc`).catch(()=>null),
      sbGet('patient_problems',  `select=*&${q}&order=created_at.desc`).catch(()=>null),
      sbGet('vital_signs',       `select=*&${q}&order=recorded_at.desc&limit=30`).catch(()=>null),
      sbGet('clinical_notes',    `select=*&${q}&order=created_at.desc&limit=50`).catch(()=>null),
    ]);
    if (alg === null && prb === null) {
      el.innerHTML = `<div class="status-box status-warn" style="margin-bottom:14px">
        Tabel rekam medis klinis belum ada — jalankan <code>supabase_fase3.sql</code> di Supabase SQL Editor.</div>`;
      return;
    }
    mrClinical.allergies = alg||[]; mrClinical.problems = prb||[];
    mrClinical.vitals = vit||[];    mrClinical.notes = nts||[];
    paintMRClinical();
  } catch(e) {
    el.innerHTML = `<div class="status-box status-err">${e.message}</div>`;
  }
}

function paintMRClinical() {
  const el = document.getElementById('mr-clinical'); if (!el) return;
  const { allergies:alg, problems:prb, vitals:vit, notes:nts } = mrClinical;
  const aktif = prb.filter(p=>p.status==='Aktif');
  const sevCol = { Berat:'#B91C1C', Sedang:'#B45309', Ringan:'#6B7A8B' };

  el.innerHTML = `
    ${alg.length ? `
    <div style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-left:5px solid #DC2626;
      border-radius:10px;padding:11px 15px;margin-bottom:14px">
      <div style="font-weight:800;color:#B91C1C;font-size:12.5px;margin-bottom:5px">⚠️ ALERGI</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${alg.map(a=>`<span style="background:#fff;border:1px solid #FCA5A5;border-radius:6px;
          padding:3px 9px;font-size:12px"><b>${a.allergen}</b>${a.reaction?` — ${a.reaction}`:''}
          <span style="color:${sevCol[a.severity]||'#6B7A8B'};font-weight:700">· ${a.severity||''}</span></span>`).join('')}
      </div>
    </div>` : ''}

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div class="card-title">🩺 Rekam Klinis</div>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" onclick="openAllergyForm()">+ Alergi</button>
          <button class="btn btn-ghost btn-sm" onclick="openProblemForm()">+ Masalah</button>
          <button class="btn btn-ghost btn-sm" onclick="openVitalForm()">+ Tanda Vital</button>
          <button class="btn btn-teal btn-sm" onclick="openNoteForm()">+ Catatan SOAP</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">Daftar Masalah Aktif</div>
          ${aktif.length ? aktif.map(p=>`
            <div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12.5px">
              <span>${p.icd_code?`<code style="font-size:11px">${p.icd_code}</code> `:''}${p.diagnosis}</span>
              <button class="btn btn-ghost btn-xs" onclick="resolveProblem(${p.id})">Teratasi</button>
            </div>`).join('') : '<div style="color:var(--gray);font-size:12px">Tidak ada masalah aktif</div>'}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">Tanda Vital Terakhir</div>
          ${vit.length ? (()=>{ const v=vit[0]; return `
            <div style="font-size:12.5px;line-height:1.7">
              ${v.bp_systolic?`TD <b>${v.bp_systolic}/${v.bp_diastolic||'—'}</b> mmHg · `:''}
              ${v.pulse?`Nadi <b>${v.pulse}</b> · `:''}
              ${v.temperature?`Suhu <b>${v.temperature}</b>°C · `:''}
              ${v.spo2?`SpO₂ <b>${v.spo2}</b>% · `:''}
              ${v.weight?`BB <b>${v.weight}</b> kg`:''}
              <div style="color:var(--gray);font-size:11px">${v.recorded_at?new Date(v.recorded_at).toLocaleString('id-ID'):''} · ${v.recorded_by||''}</div>
            </div>
            ${vit.length>1?`<button class="btn btn-ghost btn-xs" style="margin-top:6px" onclick="showVitalTrend()">📈 Lihat tren (${vit.length} data)</button>`:''}`;
          })() : '<div style="color:var(--gray);font-size:12px">Belum ada tanda vital tercatat</div>'}
        </div>
      </div>

      <div style="border-top:1px solid var(--border);margin-top:14px;padding-top:12px">
        <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:8px">
          Catatan Klinis (${nts.length})</div>
        ${nts.length ? nts.slice(0,8).map(n=>`
          <div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;
            ${n.locked?'background:var(--bg2)':''}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:12px;font-weight:700">
                ${n.locked?'🔒':'✏️'} ${n.note_type}
                <span style="font-weight:400;color:var(--gray)">· ${n.author_name||'—'}${n.author_role?` (${n.author_role})`:''}
                · ${new Date(n.created_at).toLocaleString('id-ID')}</span>
              </div>
              ${!n.locked?`<button class="btn btn-teal btn-xs" onclick="signNote(${n.id})">Tanda tangani</button>`:''}
            </div>
            ${n.subjective?`<div style="font-size:12.5px;margin-top:5px"><b>S:</b> ${n.subjective}</div>`:''}
            ${n.objective ?`<div style="font-size:12.5px"><b>O:</b> ${n.objective}</div>`:''}
            ${n.assessment?`<div style="font-size:12.5px"><b>A:</b> ${n.assessment}</div>`:''}
            ${n.plan      ?`<div style="font-size:12.5px"><b>P:</b> ${n.plan}</div>`:''}
          </div>`).join('') : '<div style="color:var(--gray);font-size:12px">Belum ada catatan klinis</div>'}
      </div>
    </div>`;
}

function openNoteForm() {
  openModal(`
    <div class="modal-header"><div class="modal-title">✏️ Catatan Klinis — ${mrClinical.name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Jenis</label>
        <select id="cn-type">${['SOAP','CPPT'].map(x=>`<option>${x}</option>`).join('')}</select></div>
      <div class="form-group"><label>Peran Penulis</label>
        <select id="cn-role">${['Dokter','Perawat','Analis','Gizi','Fisioterapis'].map(x=>`<option>${x}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label>S — Subjective (keluhan pasien)</label><textarea id="cn-s" rows="2"></textarea></div>
    <div class="form-group"><label>O — Objective (temuan pemeriksaan)</label><textarea id="cn-o" rows="2"></textarea></div>
    <div class="form-group"><label>A — Assessment (penilaian / diagnosis kerja)</label><textarea id="cn-a" rows="2"></textarea></div>
    <div class="form-group"><label>P — Plan (rencana tindakan)</label><textarea id="cn-p" rows="2"></textarea></div>
    <div class="form-hint">Setelah ditandatangani, catatan terkunci. Koreksi dibuat sebagai adendum.</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveNote()">💾 Simpan Draft</button>
    </div>`, 'wide');
}

async function saveNote() {
  const s = document.getElementById('cn-s').value.trim();
  const o = document.getElementById('cn-o').value.trim();
  const a = document.getElementById('cn-a').value.trim();
  const p = document.getElementById('cn-p').value.trim();
  if (!s && !o && !a && !p) { toast('Isi minimal satu bagian catatan','err'); return; }
  try {
    await sbPost('clinical_notes', {
      admission_id: mrClinical.admId, mr_number: mrClinical.mr, patient_name: mrClinical.name,
      note_type: document.getElementById('cn-type').value,
      subjective:s, objective:o, assessment:a, plan:p,
      author_name: getUserName?getUserName():'User',
      author_role: document.getElementById('cn-role').value,
      locked:false, updated_at:new Date().toISOString(),
    });
    await logActivity('note','clinical_notes',mrClinical.mr,`Catatan klinis ${mrClinical.name}`,mrClinical.name);
    toast('✅ Catatan tersimpan sebagai draft','ok');
    closeModalForce(); await renderMRClinical(mrClinical.mr, mrClinical.name, mrClinical.admId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function signNote(id) {
  if (!confirm('Tanda tangani catatan ini? Setelah ditandatangani tidak bisa diubah — koreksi hanya lewat adendum.')) return;
  try {
    await sbRpc('sign_clinical_note', { p_note_id: id });
    toast('✅ Catatan ditandatangani & terkunci','ok');
    await renderMRClinical(mrClinical.mr, mrClinical.name, mrClinical.admId);
  } catch(e) {
    toast('❌ '+(/not find the function/i.test(e.message)?'Jalankan supabase_fase3.sql dulu':e.message),'err');
  }
}

function openAllergyForm() {
  openModal(`
    <div class="modal-header"><div class="modal-title">⚠️ Tambah Alergi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Alergen *</label><input type="text" id="al-agent" placeholder="Penisilin, seafood, debu..."></div>
    <div class="form-group"><label>Reaksi</label><input type="text" id="al-react" placeholder="Ruam, sesak, bengkak..."></div>
    <div class="form-group"><label>Tingkat</label>
      <select id="al-sev">${['Ringan','Sedang','Berat'].map(x=>`<option${x==='Sedang'?' selected':''}>${x}</option>`).join('')}</select></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveAllergy()">💾 Simpan</button>
    </div>`);
}

async function saveAllergy() {
  const agent = document.getElementById('al-agent').value.trim();
  if (!agent) { toast('Alergen wajib diisi','err'); return; }
  try {
    await sbPost('patient_allergies', {
      mr_number: mrClinical.mr, allergen: agent,
      reaction: document.getElementById('al-react').value.trim(),
      severity: document.getElementById('al-sev').value,
      noted_by: getUserName?getUserName():'User', is_active:true,
      updated_at:new Date().toISOString(),
    });
    toast('✅ Alergi dicatat','ok'); closeModalForce();
    await renderMRClinical(mrClinical.mr, mrClinical.name, mrClinical.admId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

function openProblemForm() {
  openModal(`
    <div class="modal-header"><div class="modal-title">📋 Tambah Masalah / Diagnosis Kronis</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Kode ICD-10</label><input type="text" id="pb-icd" placeholder="E11.9"></div>
      <div class="form-group"><label>Sejak</label><input type="date" id="pb-onset"></div>
    </div>
    <div class="form-group"><label>Diagnosis *</label><input type="text" id="pb-dx" placeholder="Diabetes Melitus Tipe 2"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveProblem()">💾 Simpan</button>
    </div>`);
}

async function saveProblem() {
  const dx = document.getElementById('pb-dx').value.trim();
  if (!dx) { toast('Diagnosis wajib diisi','err'); return; }
  try {
    await sbPost('patient_problems', {
      mr_number: mrClinical.mr, diagnosis: dx,
      icd_code: document.getElementById('pb-icd').value.trim()||null,
      onset_date: document.getElementById('pb-onset').value||null,
      status:'Aktif', noted_by: getUserName?getUserName():'User',
      updated_at:new Date().toISOString(),
    });
    toast('✅ Masalah dicatat','ok'); closeModalForce();
    await renderMRClinical(mrClinical.mr, mrClinical.name, mrClinical.admId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function resolveProblem(id) {
  if (!confirm('Tandai masalah ini sebagai teratasi?')) return;
  try {
    await sbPatch('patient_problems', id, { status:'Teratasi', resolved_at:new Date().toISOString().split('T')[0], updated_at:new Date().toISOString() });
    toast('✅ Ditandai teratasi','ok');
    await renderMRClinical(mrClinical.mr, mrClinical.name, mrClinical.admId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

function openVitalForm() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🩺 Catat Tanda Vital</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div class="form-group"><label>Sistolik</label><input type="number" id="vt-sys" placeholder="120"></div>
      <div class="form-group"><label>Diastolik</label><input type="number" id="vt-dia" placeholder="80"></div>
      <div class="form-group"><label>Nadi</label><input type="number" id="vt-pulse"></div>
      <div class="form-group"><label>Suhu (°C)</label><input type="number" step="0.1" id="vt-temp"></div>
      <div class="form-group"><label>Napas</label><input type="number" id="vt-resp"></div>
      <div class="form-group"><label>SpO₂ (%)</label><input type="number" id="vt-spo2"></div>
      <div class="form-group"><label>Berat (kg)</label><input type="number" step="0.1" id="vt-weight"></div>
      <div class="form-group"><label>Tinggi (cm)</label><input type="number" step="0.1" id="vt-height"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveVital()">💾 Simpan</button>
    </div>`, 'wide');
}

async function saveVital() {
  const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n)?null:n; };
  const w = num('vt-weight'), h = num('vt-height');
  const payload = {
    admission_id: mrClinical.admId, mr_number: mrClinical.mr,
    bp_systolic:num('vt-sys'), bp_diastolic:num('vt-dia'), pulse:num('vt-pulse'),
    temperature:num('vt-temp'), resp_rate:num('vt-resp'), spo2:num('vt-spo2'),
    weight:w, height:h,
    bmi: (w && h) ? Math.round((w/Math.pow(h/100,2))*10)/10 : null,
    recorded_by: getUserName?getUserName():'User', recorded_at:new Date().toISOString(),
  };
  if (Object.values(payload).every(v=>v===null||typeof v!=='number')) { toast('Isi minimal satu nilai','err'); return; }
  try {
    await sbPost('vital_signs', payload);
    toast('✅ Tanda vital tercatat','ok'); closeModalForce();
    await renderMRClinical(mrClinical.mr, mrClinical.name, mrClinical.admId);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

// Tren sederhana — tabel berurut waktu; grafik menyusul bila diperlukan
function showVitalTrend() {
  const v = mrClinical.vitals;
  openModal(`
    <div class="modal-header"><div class="modal-title">📈 Tren Tanda Vital — ${mrClinical.name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="table-wrap"><table><thead><tr>
      <th>Waktu</th><th>TD</th><th>Nadi</th><th>Suhu</th><th>SpO₂</th><th>BB</th><th>IMT</th>
    </tr></thead><tbody>${v.map(x=>`<tr>
      <td style="font-size:11.5px;color:var(--gray)">${x.recorded_at?new Date(x.recorded_at).toLocaleString('id-ID'):'—'}</td>
      <td>${x.bp_systolic?`${x.bp_systolic}/${x.bp_diastolic||'—'}`:'—'}</td>
      <td>${x.pulse||'—'}</td><td>${x.temperature||'—'}</td>
      <td>${x.spo2||'—'}</td><td>${x.weight||'—'}</td><td>${x.bmi||'—'}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

async function printFullMedRecord(patientName) {
  const orgName = localStorage.getItem('ol_org_name')||'OneLab Diagnostics';
  const orgAddr = localStorage.getItem('ol_org_addr')||'';
  // Get current rendered content
  const content = document.getElementById('mr-content')?.innerHTML||'';
  const w=window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Rekam Medis — ${patientName}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:12px;color:#1A2B3C}
      .header{border-bottom:3px solid #0A2342;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between}
      h2{color:#0A2342;margin:0}.card{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}td,th{padding:5px 8px}
      thead tr{background:#0A2342;color:#fff}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="position:fixed;top:12px;right:12px;padding:6px 14px;background:#0A2342;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">🖨 Print</button>
    <div class="header">
      <div><h2>${orgName}</h2><div style="font-size:11px;color:#546E7A">${orgAddr}</div></div>
      <div style="text-align:right">
        <strong style="font-size:16px;color:#0A2342">REKAM MEDIS PASIEN</strong>
        <div style="font-size:11px;color:#546E7A">Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
    </div>
    ${content}
    </body></html>`);
  w.document.close();
}
