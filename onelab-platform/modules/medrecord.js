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
