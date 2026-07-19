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
      <button class="btn btn-ghost btn-sm" onclick="navigate('labreport')">🖨️ Setting PDF</button>
    </div>
    <div id="report-cards">
    ${groups.length ? groups.map(pt=>{
      const critCount=pt.results.filter(isCriticalResult).length;
      return `
      <div class="card report-card" data-search="${(pt.name+' '+(pt.visit||'')).toLowerCase()}" style="margin-bottom:10px;padding:0;overflow:hidden">
        <div onclick="toggleReportCard(this)" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer" title="Klik untuk lihat detail hasil">
          <div style="display:flex;align-items:center;gap:11px;min-width:0">
            <span class="rc-chev" style="color:var(--gray);transition:transform .15s;font-size:12px">▶</span>
            <div style="min-width:0">
              <div style="font-size:14.5px;font-weight:700;color:var(--navy)">${pt.name}
                ${critCount?`<span style="background:#FEF2F2;color:#DC2626;padding:1px 8px;border-radius:8px;font-size:10px;margin-left:6px">🚨 ${critCount} kritis</span>`:''}</div>
              <div style="font-size:11px;color:var(--gray)">${pt.visit||'—'} · ${pt.results.length} pemeriksaan · ${pt.released_at?new Date(pt.released_at).toLocaleString('id-ID'):''}</div>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" style="flex-shrink:0" onclick="event.stopPropagation();printLabReport('${(pt.name||'').replace(/'/g,'')}','${pt.visit||''}')">🖨 Cetak Hasil</button>
        </div>
        <div class="rc-detail" style="display:none;padding:0 16px 14px;border-top:1px solid var(--border)">
        <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:10px">
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
              <td style="padding:6px 10px"><button class="btn btn-xs btn-ghost" onclick="showTrend('${(r.patient_name||'').replace(/'/g,'')}',${r.product_id},'${((r.item_name||r.product_name)||'').replace(/'/g,'')}',${r.product_item_id||'null'})">📈</button></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
        </div>
      </div>`;
    }).join('') : `<div class="empty-state"><div class="ico">📁</div><h3>Belum ada hasil yang diapprove</h3></div>`}
    </div>`;
}

// Buka/tutup detail satu kartu rekam medis. Kartu ringkas (nama saja) sampai diklik.
function toggleReportCard(head){
  const detail=head.parentElement.querySelector('.rc-detail');
  const chev=head.querySelector('.rc-chev');
  if(!detail) return;
  const open=detail.style.display==='none';
  detail.style.display=open?'block':'none';
  if(chev) chev.style.transform=open?'rotate(90deg)':'';
}

function filterReportCards(q){
  q=(q||'').toLowerCase();
  document.querySelectorAll('#report-cards .report-card').forEach(c=>{
    c.style.display=c.dataset.search.includes(q)?'block':'none';
  });
}

// ── Cumulative / Trend: riwayat 1 tes pada 1 pasien ──────────────
async function showTrend(patientName, productId, productName, itemId=null){
  let data=[];
  try {
    let q=`select=result_value,result_numeric,unit,normal_min,normal_max,color_code,created_at&patient_name=eq.${encodeURIComponent(patientName)}&product_id=eq.${productId}&result_value=not.is.null`;
    q += (itemId!=null) ? `&product_item_id=eq.${itemId}` : '';
    q += '&order=created_at.asc&limit=30';
    data=await sbGet('lab_results',q)||[];
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

// ── Konfigurasi cetak PDF (dari localStorage, dikelola di menu Setting Hasil PDF) ──
const LAB_REPORT_DEFAULTS = {
  org_name:'OneLab Diagnostics', address:'', phone:'', email:'', website:'',
  logo_url:'', accreditation:'', header_color:'#0A2342', accent_color:'#00897B',
  footer_note:'Hasil pemeriksaan ini hanya berlaku untuk sampel yang diterima. Konsultasikan dengan dokter untuk interpretasi klinis.',
  show_loinc:false, show_method:false, show_flag_legend:true, show_qr:false, paper:'A4',
  sign1_role:'Diperiksa oleh (Analis)', sign2_role:'Divalidasi oleh', sign3_role:'Disetujui oleh (Dokter PJ)',
  sign1_name:'', sign2_name:'', sign3_name:'',
};
function labReportCfg(){
  try { return Object.assign({}, LAB_REPORT_DEFAULTS, JSON.parse(localStorage.getItem('ol_lab_report_cfg')||'{}')); }
  catch(e){ return {...LAB_REPORT_DEFAULTS}; }
}

// ── Cetak hasil (report profesional, config-driven) ──────────────
// sampleRows: opsional (untuk preview di Setting PDF) — jika ada, dipakai apa adanya.
function printLabReport(patientName, visitNumber, sampleRows){
  const cfg = labReportCfg();
  const results = sampleRows || labResults.filter(r=>r.patient_name===patientName&&isReleased(r)&&(!visitNumber||r.visit_number===visitNumber));
  if(!results.length){ toast('Tidak ada hasil','warn'); return; }
  const first=results[0]||{};
  const hc=cfg.header_color||'#0A2342', ac=cfg.accent_color||'#00897B';

  const byCat={};
  results.forEach(r=>{ const cat=(labProduct?labProduct(r.product_id):null)?.kategori||r._cat||'Pemeriksaan Lain'; (byCat[cat]=byCat[cat]||[]).push(r); });

  const contact=[cfg.phone?'☎ '+cfg.phone:'',cfg.email||'',cfg.website||''].filter(Boolean).join(' · ');
  const w=window.open('','_blank','width=920,height=760');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hasil Lab — ${patientName}</title>
    <style>
      @page{ size:${cfg.paper||'A4'}; margin:14mm 12mm; }
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#1A2B3C;margin:0;padding:22px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${hc};padding-bottom:12px;margin-bottom:14px;gap:16px}
      .brand{display:flex;gap:12px;align-items:center}
      .brand img{max-height:56px;max-width:150px;object-fit:contain}
      .brand h2{color:${hc};margin:0;font-size:19px;font-weight:800}
      .brand .addr{font-size:11px;color:#546E7A;margin-top:3px;line-height:1.35;max-width:340px}
      .brand .acc{font-size:10px;color:${ac};font-weight:700;margin-top:3px}
      .doc-title{text-align:right}
      .doc-title .t{font-size:16px;font-weight:800;color:${hc}}
      .doc-title .d{font-size:11px;color:#546E7A}
      .pinfo{background:#F4F7FA;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:6px}
      .pinfo span{font-size:9px;color:#546E7A;text-transform:uppercase;letter-spacing:.04em}
      .pinfo strong{font-size:12.5px}
      table{width:100%;border-collapse:collapse;margin-bottom:4px}
      th{background:${hc};color:#fff;padding:6px 9px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.02em}
      td{padding:5px 9px;border-bottom:1px solid #edf1f5;font-size:12px}
      .cat{background:${ac}18;color:${ac};font-weight:800;padding:5px 10px;font-size:11.5px;margin-top:12px;border-left:3px solid ${ac}}
      .flag{font-weight:800}.crit{color:#DC2626}
      .legend{font-size:9.5px;color:#94A3B8;margin-top:8px}
      .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:12px}
      .signs{display:flex;justify-content:space-between;gap:20px;margin-top:16px}
      .signs > div{flex:1;font-size:11px}
      .signs .line{margin-top:44px;border-top:1px solid #94A3B8;padding-top:3px}
      .signs em{color:#546E7A}
      .disc{margin-top:16px;font-size:9.5px;color:#94A3B8;line-height:1.4}
      @media print{ .noprint{display:none} body{padding:0} }
    </style></head><body>
    <button class="noprint" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:${hc};color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
    <div class="header">
      <div class="brand">
        ${cfg.logo_url?`<img src="${cfg.logo_url}" alt="logo">`:''}
        <div>
          <h2>${cfg.org_name||'Laboratorium'}</h2>
          ${cfg.address?`<div class="addr">${cfg.address}</div>`:''}
          ${contact?`<div class="addr">${contact}</div>`:''}
          ${cfg.accreditation?`<div class="acc">${cfg.accreditation}</div>`:''}
        </div>
      </div>
      <div class="doc-title">
        <div class="t">HASIL PEMERIKSAAN LABORATORIUM</div>
        <div class="d">Dicetak: ${new Date().toLocaleString('id-ID',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>
    <div class="pinfo">
      <div><span>Nama Pasien</span><br><strong>${patientName}</strong></div>
      <div><span>No. MR</span><br><strong>${first.mr_number||'—'}</strong></div>
      <div><span>No. Kunjungan</span><br><strong>${first.visit_number||'—'}</strong></div>
      <div><span>Tgl Rilis</span><br><strong>${first.released_at||first.approved_at?new Date(first.released_at||first.approved_at).toLocaleDateString('id-ID'):new Date().toLocaleDateString('id-ID')}</strong></div>
    </div>
    ${Object.entries(byCat).map(([cat,rows])=>`
      <div class="cat">${cat}</div>
      <table><thead><tr><th>Pemeriksaan</th><th>Hasil</th><th>Flag</th><th>Satuan</th><th>Rentang Normal</th><th>Interpretasi</th>${cfg.show_loinc?'<th>LOINC</th>':''}</tr></thead>
      <tbody>${_labPrintCatRows(rows, cfg)}</tbody></table>`).join('')}
    ${cfg.show_flag_legend?`<div class="legend">Keterangan: H = di atas rentang normal · L = di bawah rentang normal · 🚨 = nilai kritis</div>`:''}
    <div class="footer">
      <div class="signs">
        <div><div>${cfg.sign1_role}:</div><div class="line"><em>${cfg.sign1_name||first.entered_by||'—'}</em></div></div>
        <div style="text-align:center"><div>${cfg.sign2_role}:</div><div class="line"><em>${cfg.sign2_name||first.validated_by||'—'}</em></div></div>
        <div style="text-align:right"><div>${cfg.sign3_role}:</div><div class="line"><em>${cfg.sign3_name||first.approved_by||'—'}</em></div></div>
      </div>
      ${cfg.footer_note?`<div class="disc">${cfg.footer_note}</div>`:''}
      <div class="disc" style="text-align:center">Dokumen digenerate elektronik oleh ${cfg.org_name||'OneLab'} · ${new Date().toLocaleString('id-ID')}</div>
    </div>
    </body></html>`);
  w.document.close();
}

// Baris cetak per hasil (indent=analit di dalam panel)
function _labPrintRow(r, indent, cfg){
  cfg=cfg||{};
  const col=labColor(r.color_code);
  const crit=isCriticalResult(r);
  const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
            :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
  const name=indent?`<span style="padding-left:16px">${r.item_name||'—'}</span>`:`<strong>${r.product_name||'—'}</strong>`;
  const span=cfg.show_loinc?7:6;
  return `<tr>
    <td>${name}${cfg.show_method&&r.method?`<div style="font-size:9px;color:#94A3B8">${r.method}</div>`:''}</td>
    <td><strong style="color:${col};font-size:14px">${r.result_value||'—'}</strong>${crit?' <span class="crit">🚨</span>':''}</td>
    <td class="flag" style="color:${flag==='H'?'#EF4444':flag==='L'?'#0EA5E9':'#94A3B8'}">${flag||'—'}</td>
    <td style="color:#546E7A">${r.unit||'—'}</td>
    <td style="color:#546E7A">${r.normal_min!=null&&r.normal_max!=null?`${r.normal_min}–${r.normal_max}`:'—'}</td>
    <td><span style="background:${col}20;color:${col};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${r.interpretation||'—'}</span></td>
    ${cfg.show_loinc?`<td style="color:#94A3B8;font-family:monospace;font-size:10px">${r.loinc_code||'—'}</td>`:''}
  </tr>${r.notes?`<tr><td colspan="${span}" style="padding:2px 10px 6px ${indent?'26px':'10px'};font-size:10.5px;color:#7A5B00;font-style:italic">Catatan: ${r.notes}</td></tr>`:''}`;
}
// Kelompokkan hasil dalam 1 kategori per tes; panel diberi sub-header + analit terindent
function _labPrintCatRows(rows, cfg){
  cfg=cfg||{};
  const span=cfg.show_loinc?7:6;
  const byProd={};
  rows.forEach(r=>{ const k=r.product_name||'—'; (byProd[k]=byProd[k]||[]).push(r); });
  return Object.entries(byProd).map(([prod,prows])=>{
    const isPanel = prows.length>1 || prows.some(r=>r.item_name);
    if(isPanel){
      return `<tr><td colspan="${span}" style="background:#EEF2FF;font-weight:700;color:#3730A3;padding:5px 10px">${prod}</td></tr>`
        + prows.map(r=>_labPrintRow(r,true,cfg)).join('');
    }
    return prows.map(r=>_labPrintRow(r,false,cfg)).join('');
  }).join('');
}
