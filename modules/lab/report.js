// ═══════════════════════════════════════════════════════════════
// LIS · REKAM MEDIS LAB & LAPORAN
// - Hasil released dikelompokkan per pasien
// - Cumulative report (tren tes antar-waktu)
// - Cetak hasil profesional (flag H/L, nilai kritis, TTD berjenjang)
// ═══════════════════════════════════════════════════════════════

function renderReportTab(){
  const el=document.getElementById('lab-report'); if(!el) return;
  const released=labResults.filter(r=>isReleased(r));

  const byPatient={};
  released.forEach(r=>{
    const key=(r.patient_name||'Unknown')+'|'+(r.visit_number||'');
    if(!byPatient[key]) byPatient[key]={name:r.patient_name||'Unknown',visit:r.visit_number,results:[],
      released_at:r.released_at||r.approved_at};
    byPatient[key].results.push(r);
  });

  const groups=Object.values(byPatient).sort((a,b)=>new Date(b.released_at||0)-new Date(a.released_at||0));

  el.innerHTML=`
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
      <input class="table-search" id="report-search" placeholder="🔍 Cari nama pasien / no. kunjungan..." oninput="filterReportCards(this.value)" style="flex:1">
      <span class="badge badge-navy">${groups.length} kunjungan selesai</span>
    </div>
    <div id="report-cards">
    ${groups.length ? groups.map(pt=>{
      const critCount=pt.results.filter(isCriticalResult).length;
      return `
      <div class="card report-card" data-search="${(pt.name+' '+(pt.visit||'')).toLowerCase()}" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--navy)">${pt.name}
              ${critCount?`<span style="background:#FEF2F2;color:#DC2626;padding:1px 8px;border-radius:8px;font-size:10px;margin-left:6px">🚨 ${critCount} kritis</span>`:''}</div>
            <div style="font-size:11px;color:var(--gray)">${pt.visit||'—'} · ${pt.results.length} pemeriksaan · ${pt.released_at?new Date(pt.released_at).toLocaleString('id-ID'):''}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="printLabReport('${(pt.name||'').replace(/'/g,'')}','${pt.visit||''}')">🖨 Cetak Hasil</button>
        </div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="background:var(--lgray)">
            <th style="padding:6px 10px;text-align:left">Pemeriksaan</th>
            <th style="padding:6px 10px;text-align:left">Hasil</th>
            <th style="padding:6px 10px;text-align:left">Flag</th>
            <th style="padding:6px 10px;text-align:left">Satuan</th>
            <th style="padding:6px 10px;text-align:left">Rentang Normal</th>
            <th style="padding:6px 10px;text-align:left">Interpretasi</th>
            <th style="padding:6px 10px;text-align:left">Tren</th>
          </tr></thead>
          <tbody>
          ${pt.results.map(r=>{
            const col=labColor(r.color_code);
            const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
                      :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
            const crit=isCriticalResult(r);
            return `<tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:6px 10px;font-weight:600">${r.item_name||r.product_name||'—'}${r.item_name?`<div style="font-size:9px;color:var(--gray);font-weight:400">${r.product_name}</div>`:''}</td>
              <td style="padding:6px 10px;font-weight:800;color:${col}">${r.result_value||'—'}${crit?' 🚨':''}</td>
              <td style="padding:6px 10px;font-weight:800;color:${flag==='H'?'#EF4444':flag==='L'?'#0EA5E9':'#94A3B8'}">${flag||'—'}</td>
              <td style="padding:6px 10px;color:var(--gray)">${r.unit||'—'}</td>
              <td style="padding:6px 10px;color:var(--gray)">${r.normal_min!=null&&r.normal_max!=null?`${r.normal_min}–${r.normal_max}`:'—'}</td>
              <td style="padding:6px 10px"><span style="background:${col}20;color:${col};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${r.interpretation||'—'}</span></td>
              <td style="padding:6px 10px"><button class="btn btn-xs btn-ghost" onclick="showTrend('${(r.patient_name||'').replace(/'/g,'')}',${r.product_id},'${(r.product_name||'').replace(/'/g,'')}')">📈</button></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('') : `<div class="empty-state"><div class="ico">📁</div><h3>Belum ada hasil yang diapprove</h3></div>`}
    </div>`;
}

function filterReportCards(q){
  q=(q||'').toLowerCase();
  document.querySelectorAll('#report-cards .report-card').forEach(c=>{
    c.style.display=c.dataset.search.includes(q)?'block':'none';
  });
}

// ── Cumulative / Trend: riwayat 1 tes pada 1 pasien ──────────────
async function showTrend(patientName, productId, productName){
  let data=[];
  try {
    data=await sbGet('lab_results',
      `select=result_value,result_numeric,unit,normal_min,normal_max,color_code,created_at&patient_name=eq.${encodeURIComponent(patientName)}&product_id=eq.${productId}&result_value=not.is.null&order=created_at.asc&limit=30`)||[];
  } catch(e){}
  if(!data.length){ toast('Belum ada riwayat','warn'); return; }

  const nums=data.filter(d=>d.result_numeric!=null);
  const min=Math.min(...nums.map(d=>d.result_numeric));
  const max=Math.max(...nums.map(d=>d.result_numeric));
  const range=(max-min)||1;
  const w=Math.max(320, data.length*60), h=140, pad=24;
  const pts=nums.map((d,i)=>{
    const x=pad+(nums.length>1?i/(nums.length-1):0.5)*(w-2*pad);
    const y=h-pad-((d.result_numeric-min)/range)*(h-2*pad);
    return {x,y,d};
  });
  const line=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
  const nmin=nums[0]?.normal_min, nmax=nums[0]?.normal_max;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📈 Tren — ${productName}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:8px">${patientName} · ${data.length} hasil${nmin!=null&&nmax!=null?` · normal ${nmin}–${nmax}`:''}</div>
    <div style="overflow-x:auto;background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px">
      <svg width="${w}" height="${h}" style="min-width:100%">
        ${nmin!=null&&nmax!=null&&nmax<=max&&nmin>=min?`
          <rect x="${pad}" y="${(h-pad-((nmax-min)/range)*(h-2*pad)).toFixed(0)}" width="${w-2*pad}"
            height="${(((nmax-nmin)/range)*(h-2*pad)).toFixed(0)}" fill="#22C55E10"/>`:''}
        <path d="${line}" fill="none" stroke="#00897B" stroke-width="2"/>
        ${pts.map(p=>{const c=labColor(p.d.color_code);
          return `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="4" fill="${c}"><title>${p.d.result_value} ${p.d.unit||''} · ${new Date(p.d.created_at).toLocaleDateString('id-ID')}</title></circle>`;}).join('')}
      </svg>
    </div>
    <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:12px">
      <thead><tr style="background:var(--lgray)"><th style="padding:5px 8px;text-align:left">Tanggal</th><th style="padding:5px 8px;text-align:left">Hasil</th></tr></thead>
      <tbody>${data.slice().reverse().map(d=>{const c=labColor(d.color_code);
        return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:5px 8px">${new Date(d.created_at).toLocaleString('id-ID')}</td>
        <td style="padding:5px 8px;font-weight:700;color:${c}">${d.result_value} ${d.unit||''}</td></tr>`;}).join('')}</tbody>
    </table>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`);
}

// ── Cetak hasil (report profesional) ─────────────────────────────
function printLabReport(patientName, visitNumber){
  const results=labResults.filter(r=>r.patient_name===patientName&&isReleased(r)&&(!visitNumber||r.visit_number===visitNumber));
  if(!results.length){ toast('Tidak ada hasil','warn'); return; }
  const orgName=localStorage.getItem('ol_org_name')||'OneLab Diagnostics';
  const orgAddr=localStorage.getItem('ol_org_addr')||'';
  const first=results[0]||{};

  // kelompokkan per kategori produk
  const byCat={};
  results.forEach(r=>{ const cat=labProduct(r.product_id)?.kategori||'Pemeriksaan Lain'; (byCat[cat]=byCat[cat]||[]).push(r); });

  const w=window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hasil Lab — ${patientName}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:30px;font-size:13px;color:#1A2B3C}
      h2{color:#0A2342;margin:0}
      .header{display:flex;justify-content:space-between;border-bottom:3px solid #0A2342;padding-bottom:14px;margin-bottom:16px}
      .pinfo{background:#F0F4F8;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
      .pinfo span{font-size:10px;color:#546E7A}
      table{width:100%;border-collapse:collapse;margin-bottom:6px}
      th{background:#0A2342;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px}
      .cat{background:#E0F2F1;color:#00695C;font-weight:800;padding:6px 10px;font-size:12px;margin-top:14px}
      .flag{font-weight:800}.crit{color:#DC2626}
      .footer{margin-top:36px;border-top:1px solid #e2e8f0;padding-top:14px;font-size:11px;color:#546E7A}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="position:fixed;top:16px;right:16px;padding:8px 18px;background:#0A2342;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
    <div class="header">
      <div><h2>${orgName}</h2><div style="font-size:12px;color:#546E7A;margin-top:4px">${orgAddr}</div></div>
      <div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#0A2342">HASIL PEMERIKSAAN LABORATORIUM</div>
        <div style="font-size:12px;color:#546E7A">${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div></div>
    </div>
    <div class="pinfo">
      <div><span>NAMA PASIEN</span><br><strong>${patientName}</strong></div>
      <div><span>NO. KUNJUNGAN</span><br><strong>${first.visit_number||'—'}</strong></div>
      <div><span>TANGGAL RILIS</span><br><strong>${first.released_at||first.approved_at?new Date(first.released_at||first.approved_at).toLocaleDateString('id-ID'):'—'}</strong></div>
    </div>
    ${Object.entries(byCat).map(([cat,rows])=>`
      <div class="cat">${cat}</div>
      <table><thead><tr><th>Pemeriksaan</th><th>Hasil</th><th>Flag</th><th>Satuan</th><th>Rentang Normal</th><th>Interpretasi</th></tr></thead>
      <tbody>${rows.map(r=>{
        const col=labColor(r.color_code);
        const crit=isCriticalResult(r);
        const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
                  :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
        return `<tr>
          <td><strong>${r.item_name||r.product_name||'—'}</strong>${r.item_name?` <span style="font-size:9px;color:#94A3B8">${r.product_name}</span>`:''}</td>
          <td><strong style="color:${col};font-size:14px">${r.result_value||'—'}</strong>${crit?' <span class="crit">🚨</span>':''}</td>
          <td class="flag" style="color:${flag==='H'?'#EF4444':flag==='L'?'#0EA5E9':'#94A3B8'}">${flag||'—'}</td>
          <td style="color:#546E7A">${r.unit||'—'}</td>
          <td style="color:#546E7A">${r.normal_min!=null&&r.normal_max!=null?`${r.normal_min}–${r.normal_max}`:'—'}</td>
          <td><span style="background:${col}20;color:${col};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.interpretation||'—'}</span></td>
        </tr>`;}).join('')}</tbody></table>`).join('')}
    <div style="font-size:10px;color:#94A3B8;margin-top:10px">Keterangan: H = di atas rentang normal · L = di bawah rentang normal · 🚨 = nilai kritis</div>
    <div class="footer">
      <div style="display:flex;justify-content:space-between;margin-top:30px">
        <div>Diperiksa oleh:<br><br><br>__________________________<br><em>${first.entered_by||'Analis'}</em></div>
        <div style="text-align:center">Divalidasi oleh:<br><br><br>__________________________<br><em>${first.validated_by||'Validator'}</em></div>
        <div style="text-align:right">Disetujui oleh:<br><br><br>__________________________<br><em>${first.approved_by||'Dokter PJ'}</em></div>
      </div>
      <div style="margin-top:20px;font-size:10px;color:#94A3B8;text-align:center">
        Dokumen digenerate elektronik oleh ${orgName} · ${new Date().toLocaleString('id-ID')}</div>
    </div>
    </body></html>`);
  w.document.close();
}
