// ═══════════════════════════════════════════════════════════════
// LIS · VALIDASI & APPROVAL BERJENJANG
// - Validasi teknis (analis)  : Draft → Validated
// - Approval klinis (dokter)  : Validated → Approved (Released)
// - Nilai kritis wajib di-acknowledge sebelum validasi
// ═══════════════════════════════════════════════════════════════

function renderValidationTab(){
  const el=document.getElementById('lab-validation'); if(!el) return;
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value);
  const unackCrit=toValidate.filter(r=>isCriticalResult(r)&&!r.critical_ack_at).length;

  el.innerHTML=`
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-gold">${toValidate.length} hasil siap divalidasi</span>
        ${unackCrit?`<span class="badge" style="background:#FEF2F2;color:#DC2626;margin-left:6px">🚨 ${unackCrit} kritis belum di-ack</span>`:''}
      </div>
      ${toValidate.length?`<button class="btn btn-teal btn-sm" onclick="validateAllResults()">✅ Validasi Semua (non-kritis)</button>`:''}
    </div>
    ${renderResultReviewTable(toValidate,'validated')}`;
}

function renderApprovalTab(){
  const el=document.getElementById('lab-approval'); if(!el) return;
  const toApprove=labResults.filter(r=>r.status==='Validated');
  el.innerHTML=`
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <span class="badge badge-purple">${toApprove.length} hasil siap diapprove &amp; rilis</span>
      ${toApprove.length?`<button class="btn btn-teal btn-sm" onclick="approveAllResults()">🔏 Approve &amp; Rilis Semua</button>`:''}
    </div>
    ${renderResultReviewTable(toApprove,'approved')}`;
}

function renderResultReviewTable(data, nextStatus){
  if(!data.length) return `<div class="empty-state" style="padding:40px">
    <div class="ico">✅</div><h3>Tidak ada yang perlu di-${nextStatus==='validated'?'validasi':'approve'}</h3></div>`;

  const actionLabel=nextStatus==='validated'?'Validasi':'Approve';
  const actionColor=nextStatus==='validated'?'#22C55E':'#8B5CF6';

  return `<div class="table-wrap"><table>
    <thead><tr><th>Pasien</th><th>Tes</th><th>Hasil</th><th>Interpretasi</th><th>Flag</th><th>Status</th><th>Aksi</th></tr></thead>
    <tbody>
    ${data.map(r=>{
      const col=labColor(r.color_code);
      const crit=isCriticalResult(r);
      const blocked=nextStatus==='validated'&&crit&&!r.critical_ack_at;
      const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
                :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
      return `<tr>
        <td><div style="font-weight:600">${r.patient_name||'—'}</div>
            <div style="font-size:10px;color:var(--gray)">${r.visit_number||'—'}</div></td>
        <td style="font-size:12px">${r.item_name?`${r.item_name} <span style="font-size:9px;color:var(--gray)">· ${r.product_name}</span>`:(r.product_name||'—')}</td>
        <td style="font-size:14px;font-weight:800;color:${col}">${r.result_value||'—'} <span style="font-size:11px;color:var(--gray)">${r.unit||''}</span></td>
        <td><span style="background:${col}20;color:${col};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.interpretation||'—'}</span></td>
        <td>${crit?'<span title="Nilai kritis" style="color:#DC2626;font-weight:800">🚨</span>':''}${flag?`<span style="color:${flag==='H'?'#EF4444':'#0EA5E9'};font-weight:800;margin-left:2px">${flag}</span>`:(!crit?'—':'')}</td>
        <td><span class="badge badge-gray">${r.status}</span></td>
        <td>${blocked
            ? `<button onclick="ackCritical(${r.id})" style="background:#DC2626;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Ack Kritis</button>`
            : `<button onclick="updateResultStatus(${r.id},'${nextStatus}')" style="background:${actionColor};color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">${actionLabel}</button>`}
        </td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

async function updateResultStatus(id, status){
  const now=new Date().toISOString();
  const updates={updated_at:now};
  if(status==='validated'){ updates.status='Validated'; updates.validated_by=labUser(); updates.validated_at=now; }
  if(status==='approved'){  updates.status='Approved';  updates.approved_by=labUser();  updates.approved_at=now; updates.released_by=labUser(); updates.released_at=now; }
  try {
    await sbPatch('lab_results',id,updates);
    if(typeof logActivity==='function') logActivity(status,'lab_results',id,`Hasil di-${status}`);
    toast(`✅ Status → ${updates.status}`,'ok');
    await loadLabResults();
    renderValidationTab(); renderApprovalTab(); renderReportTab(); renderLabKPI(); renderCriticalBanner();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function validateAllResults(){
  // hanya non-kritis (kritis wajib ack manual dulu)
  const toValidate=labResults.filter(r=>r.status==='Draft'&&r.result_value&&!(isCriticalResult(r)&&!r.critical_ack_at));
  const now=new Date().toISOString();
  for(const r of toValidate){
    await sbPatch('lab_results',r.id,{status:'Validated',validated_by:labUser(),validated_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toValidate.length} hasil tervalidasi`,'ok');
  await loadLabResults();
  renderValidationTab(); renderApprovalTab(); renderReportTab(); renderLabKPI();
}

async function approveAllResults(){
  const toApprove=labResults.filter(r=>r.status==='Validated');
  const now=new Date().toISOString();
  for(const r of toApprove){
    await sbPatch('lab_results',r.id,{status:'Approved',approved_by:labUser(),approved_at:now,released_by:labUser(),released_at:now,updated_at:now}).catch(()=>{});
  }
  toast(`✅ ${toApprove.length} hasil approved & rilis`,'ok');
  await loadLabResults();
  renderApprovalTab(); renderReportTab(); renderLabKPI();
}
