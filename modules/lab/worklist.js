// ═══════════════════════════════════════════════════════════════
// LIS · WORKLIST & TURNAROUND TIME (TAT)
// - Sampel "In Process" dikelompokkan per analyzer / kategori
// - Monitoring TAT: target vs elapsed, sorot yang terlambat
// - Input hasil batch (satu worklist sekaligus)
// ═══════════════════════════════════════════════════════════════

function renderWorklistTab(){
  const el=document.getElementById('lab-worklist'); if(!el) return;
  const inProc=labSamples.filter(s=>s.status==='In Process');

  if(!inProc.length){
    el.innerHTML=`<div class="empty-state" style="padding:40px">
      <div class="ico">🔬</div><h3>Worklist kosong</h3>
      <p style="color:var(--gray)">Sampel yang sudah "Diproses" di tab Penerimaan akan muncul di sini.</p></div>`;
    return;
  }

  // Kelompokkan per analyzer (fallback: kategori produk / 'Manual')
  const groups={};
  inProc.forEach(s=>{
    const p=labProduct(s.product_id);
    const key=s.analyzer_name || (p?.kategori) || 'Manual / Belum Ditentukan';
    (groups[key]=groups[key]||[]).push(s);
  });

  const overdueTotal=inProc.filter(s=>tatStatus(s).overdue).length;

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <span class="badge badge-teal">${inProc.length} sampel diproses</span>
        ${overdueTotal?`<span class="badge" style="background:#FEF2F2;color:#DC2626;margin-left:6px">⏰ ${overdueTotal} TAT terlambat</span>`:''}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="openAnalyzerIntake()">🔌 Terima Hasil Alat</button>
    </div>
    ${Object.entries(groups).map(([name,items])=>{
      const od=items.filter(s=>tatStatus(s).overdue).length;
      return `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--navy)">🧬 ${name}
            <span style="font-size:11px;color:var(--gray);font-weight:500">· ${items.length} tes${od?` · ${od} telat`:''}</span></div>
          <button class="btn btn-teal btn-sm" onclick="openBatchEntry('${encodeURIComponent(name)}')">📝 Input Batch</button>
        </div>
        <div class="table-wrap"><table><thead><tr>
          <th>Barcode</th><th>Pasien</th><th>Tes</th><th>Sampel</th><th>TAT</th><th>Aksi</th>
        </tr></thead><tbody>
        ${items.map(s=>`<tr>
          <td style="font-family:monospace;font-size:11px;font-weight:700">${s.barcode||'—'}</td>
          <td><div style="font-weight:600">${s.patient_name||'—'}</div>
              <div style="font-size:10px;color:var(--gray)">${s.visit_number||'—'}</div></td>
          <td style="font-size:12px">${s.product_name||'—'}</td>
          <td style="font-size:11px;color:var(--gray)">${s.sampel_type||'—'}</td>
          <td>${tatBadge(s)}</td>
          <td><div class="act-row">
            <button class="act-btn" style="color:#00897B;font-size:11px" onclick="entryFromSample(${s.id})">Input Hasil</button>
          </div></td>
        </tr>`).join('')}
        </tbody></table></div>
      </div>`;
    }).join('')}`;
}

// Buka input hasil per-tes (panel terpecah per parameter) untuk sebuah sampel
function entryFromSample(sampleId){
  const s=labSamples.find(x=>x.id==sampleId); if(!s) return;
  openResultEntry(s.admission_id, s.product_id);
}

// ── Input Batch: satu tabel utk seluruh worklist group ───────────
async function openBatchEntry(nameEnc){
  const name=decodeURIComponent(nameEnc);
  const inProc=labSamples.filter(s=>s.status==='In Process').filter(s=>{
    const p=labProduct(s.product_id);
    const key=s.analyzer_name || (p?.kategori) || 'Manual / Belum Ditentukan';
    return key===name;
  });
  if(!inProc.length){ toast('Tidak ada sampel','warn'); return; }

  // preload ref ranges tiap produk unik
  await Promise.all([...new Set(inProc.map(s=>s.product_id))].map(pid=>labLoadRR(pid)));

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📝 Input Batch — ${name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
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
            <td colspan="2"><button class="btn btn-teal btn-xs" onclick="closeModalForce();openResultEntry(${s.admission_id},${s.product_id})">📝 Input per parameter →</button></td>
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
      <button class="btn btn-teal" onclick="saveBatchEntry()">💾 Simpan Semua</button>
    </div>`);
}

// interpretasi live per baris batch
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
  cell.innerHTML=`<span style="color:${c};font-weight:700">${m.condition_name||m.interpretation||'—'}${crit?' 🚨':''}</span>`;
  input.style.borderColor=c;
}

async function saveBatchEntry(){
  const rows=[...document.querySelectorAll('#modal-box tbody tr')];
  const toSave=rows.filter(tr=>{ const i=tr.querySelector('.be-val'); return i && i.value.trim(); });
  if(!toSave.length){ toast('Belum ada nilai diisi (panel diinput lewat tombol per parameter)','warn'); return; }
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
      // update draft result yg ada, atau buat baru
      let r=labResults.find(x=>x.sample_id==sid) ||
            labResults.find(x=>x.admission_id==s.admission_id && x.product_id==pid && x.status==='Draft');
      if(r) await sbPatch('lab_results',r.id,payload);
      else  await sbPost('lab_results',{...payload, sample_id:sid, admission_id:s.admission_id,
              visit_number:s.visit_number, patient_name:s.patient_name, product_id:pid, product_name:s.product_name});
      await sbPatch('lab_samples',sid,{status:'Done',updated_at:new Date().toISOString()});
      ok++;
    } catch(e){ /* skip baris gagal */ }
  }
  toast(`✅ ${ok} hasil tersimpan → siap divalidasi`,'ok');
  closeModalForce(); labRefresh();
}
