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
      <input class="table-search" id="report-search" placeholder="Cari nama pasien / no. kunjungan..." oninput="filterReportCards(this.value)" style="flex:1">
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
                ${critCount?`<span style="background:#FEF2F2;color:#DC2626;padding:1px 8px;border-radius:8px;font-size:10px;margin-left:6px">${critCount} kritis</span>`:''}</div>
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
              <td style="padding:6px 10px;font-weight:800;color:${col}">${r.result_value||'—'}${crit?' ':''}</td>
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
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
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
  show_sign1:true, show_sign2:true, show_sign3:true,
  
  // Layout Advanced
  bg_image_url: '',
  paper_width: '210mm',
  paper_height: '297mm',
  margin_top: '20mm',
  margin_bottom: '20mm',
  margin_left: '15mm',
  margin_right: '15mm',
  hide_default_header: false,
  hide_default_footer: false,
  patient_info_y: '55mm',
  table_y: '90mm',
  table_font_size: '12px',
  show_test_code: false,
  signature_y: '20mm',
};
function labReportCfg(){
  try { return Object.assign({}, LAB_REPORT_DEFAULTS, JSON.parse(localStorage.getItem('ol_lab_report_cfg')||'{}')); }
  catch(e){ return {...LAB_REPORT_DEFAULTS}; }
}

// ── Cetak hasil (report profesional, config-driven) ──────────────
// sampleRows: opsional (untuk preview di Setting PDF) — jika ada, dipakai apa adanya.
async function printLabReport(patientName, visitNumber, sampleRows){
  const cfg = labReportCfg();
  const results = sampleRows || labResults.filter(r=>r.patient_name===patientName&&isReleased(r)&&(!visitNumber||r.visit_number===visitNumber));
  if(!results.length){ toast('Tidak ada hasil','warn'); return; }
  const first=results[0]||{};
  
  // Buka window secara sinkron untuk menghindari popup blocker
  const w=window.open('','_blank','width=920,height=760');
  w.document.write('<!DOCTYPE html><html><head><title>Memuat Hasil...</title></head><body><div style="font-family:sans-serif;padding:30px;text-align:center">Memuat dokumen hasil pemeriksaan...</div></body></html>');
  w.document.close();

  // Load admission details dari DB secara asinkron
  let adm = null;
  try {
    const list = await sbGet('admissions', `select=*&visit_number=eq.${first.visit_number}`);
    if(list && list.length) adm = list[0];
  } catch(e) {
    console.error('Failed to load admission details:', e);
  }

  // Demografik & Fallbacks
  const dob = adm?.patient_dob || '';
  const age = adm?.patient_age || first.patient_age || '';
  const gender = adm?.patient_gender === 'M' ? 'Laki-laki' : (adm?.patient_gender === 'F' ? 'Perempuan' : '—');
  const ageText = age ? `${age} Th` : '—';
  
  const requestingDoc = adm?.doctor_referral || '—';
  const diagnosis = adm?.diagnosis || '—';
  const address = adm?.patient_address || '—';
  
  const regDate = adm?.created_at ? new Date(adm.created_at) : (first.created_at ? new Date(first.created_at) : new Date());
  const regDateStr = regDate.toLocaleString('id-ID', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace(/\./g, ':');
  
  const releasedTime = first.released_at || first.approved_at || first.updated_at;
  const finishDate = releasedTime ? new Date(releasedTime) : new Date();
  const finishDateStr = finishDate.toLocaleString('id-ID', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}).replace(/\./g, ':');
  
  const mrNumber = adm?.mr_number || first.mr_number || '—';
  const roomClass = adm?.patient_class ? `Poliklinik Umum / ${adm.patient_class}` : 'Poliklinik Umum / —';
  
  let penjamin = 'Umum - UMUM';
  if (adm?.discount_scheme === 'corporate') {
    penjamin = `Corporate - ${adm.scheme_name || 'KORPORAT'}`;
  } else if (adm?.discount_scheme === 'family') {
    penjamin = `Family - ${adm.scheme_name || 'KELUARGA'}`;
  } else if (adm?.scheme_name) {
    penjamin = `${adm.discount_scheme.toUpperCase()} - ${adm.scheme_name}`;
  }

  // Pengambil validator & approval dari log hasil
  const validator = first.validated_by || '—';
  const approver = first.approved_by || '—';

  const hc=cfg.header_color||'#0A2342', ac=cfg.accent_color||'#00897B';

  const byCat={};
  results.forEach(r=>{ const cat=(labProduct?labProduct(r.product_id):null)?.kategori||r._cat||'Pemeriksaan Lain'; (byCat[cat]=byCat[cat]||[]).push(r); });

  const contact=[cfg.phone?'☎ '+cfg.phone:'',cfg.email||'',cfg.website||''].filter(Boolean).join(' · ');
  
  // Hitung padding/margin
  const pTop = cfg.bg_image_url ? (cfg.margin_top || '20mm') : '22px';
  const pBottom = cfg.bg_image_url ? (cfg.margin_bottom || '20mm') : '22px';
  const pLeft = cfg.bg_image_url ? (cfg.margin_left || '15mm') : '22px';
  const pRight = cfg.bg_image_url ? (cfg.margin_right || '15mm') : '22px';

  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hasil Lab — ${patientName}</title>
    <style>
      @page{ 
        size: ${cfg.paper === 'Custom' ? `${cfg.paper_width} ${cfg.paper_height}` : cfg.paper || 'A4'}; 
        margin: ${cfg.bg_image_url ? '0' : '14mm 12mm'}; 
      }
      *{box-sizing:border-box}
      body{
        font-family:Arial,Helvetica,sans-serif;
        font-size:12px;
        color:#1A2B3C;
        margin:0;
        padding: ${pTop} ${pRight} ${pBottom} ${pLeft};
        ${cfg.bg_image_url ? `width: ${cfg.paper_width || '210mm'}; height: ${cfg.paper_height || '297mm'}; position: relative;` : ''}
      }
      .header{
        display:${cfg.hide_default_header ? 'none' : 'flex'};
        justify-content:space-between;
        align-items:flex-start;
        border-bottom:3px solid ${hc};
        padding-bottom:12px;
        margin-bottom:14px;
        gap:16px;
      }
      .brand{display:flex;gap:12px;align-items:center}
      .brand img{max-height:56px;max-width:150px;object-fit:contain}
      .brand h2{color:${hc};margin:0;font-size:19px;font-weight:800}
      .brand .addr{font-size:11px;color:#546E7A;margin-top:3px;line-height:1.35;max-width:340px}
      .brand .acc{font-size:10px;color:${ac};font-weight:700;margin-top:3px}
      .doc-title{text-align:right}
      .doc-title .t{font-size:16px;font-weight:800;color:${hc}}
      .doc-title .d{font-size:11px;color:#546E7A}
      
      .pinfo-container {
        width: 100%;
        margin-bottom: 14px;
        ${cfg.bg_image_url && cfg.patient_info_y ? `position: absolute; top: ${cfg.patient_info_y}; left: ${pLeft}; right: ${pRight}; margin: 0;` : ''}
      }
      .pinfo-title {
        text-align: center;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.05em;
        margin-bottom: 10px;
        text-transform: uppercase;
        color: #1a2a3a;
      }
      .pinfo{
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        border-top: 1.5px solid #000;
        border-bottom: 1.5px solid #000;
        padding: 8px 0;
        font-size: 11.5px;
        line-height: 1.55;
      }
      .pinfo-col {
        display: flex;
        flex-direction: column;
      }
      .pinfo-row {
        display: flex;
      }
      .pinfo-label {
        width: 170px;
        color: #000;
      }
      .pinfo-sep {
        width: 15px;
        color: #000;
      }
      .pinfo-val {
        flex: 1;
        font-weight: bold;
        color: #000;
      }
      
      .results-container {
        ${cfg.bg_image_url && cfg.table_y ? `position: absolute; top: ${cfg.table_y}; left: ${pLeft}; right: ${pRight}; margin: 0;` : ''}
      }
      
      table{width:100%;border-collapse:collapse;margin-bottom:4px}
      th{border-bottom: 1.5px solid #000; background:none; color:#000; padding:6px 9px;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.02em}
      td{padding:5px 9px;border-bottom:1px solid #edf1f5;font-size:${cfg.table_font_size || '12px'}}
      .cat{background:${ac}18;color:${ac};font-weight:800;padding:5px 10px;font-size:11.5px;margin-top:12px;border-left:3px solid ${ac}}
      .flag{font-weight:800}.crit{color:#DC2626}
      .legend{font-size:9.5px;color:#000;margin-top:8px}
      
      .footer{
        ${cfg.bg_image_url && cfg.signature_y ? `position: absolute; bottom: ${cfg.signature_y}; left: ${pLeft}; right: ${pRight}; margin: 0;` : 'margin-top: 30px;'}
      }
      .signs{display:flex;justify-content:flex-end;margin-top:16px}
      .signs > div{width: 250px; font-size:11px; text-align: center;}
      .signs .line{margin-top:54px;border-top:1px solid #000;padding-top:3px;font-weight:bold;}
      .signs em{color:#546E7A}
      .disc{display:${cfg.hide_default_footer ? 'none' : 'block'};margin-top:16px;font-size:9.5px;color:#94A3B8;line-height:1.4}
      @media print{ .noprint{display:none} body{padding:0} }
    </style></head><body>
    <button class="noprint" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:${hc};color:#fff;border:none;border-radius:6px;cursor:pointer;z-index:9999">🖨 Print</button>
    
    ${cfg.bg_image_url ? `<div class="print-bg-template" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background-image:url('${cfg.bg_image_url}');background-size:100% 100%;background-repeat:no-repeat;z-index:-9999;pointer-events:none"></div>` : ''}
    
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
    
    <div class="pinfo-container">
      <div class="pinfo-title">HASIL LABORATORIUM</div>
      <div class="pinfo">
        <div class="pinfo-col">
          <div class="pinfo-row"><div class="pinfo-label">Nama Pasien</div><div class="pinfo-sep">:</div><div class="pinfo-val">${patientName}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Tgl.Lahir Umur Kelamin</div><div class="pinfo-sep">:</div><div class="pinfo-val">${dob ? new Date(dob).toLocaleDateString('id-ID') : '—'} / ${ageText} / ${gender}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Dokter Peminta</div><div class="pinfo-sep">:</div><div class="pinfo-val">${requestingDoc}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Diagnosa</div><div class="pinfo-sep">:</div><div class="pinfo-val">${diagnosis}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Alamat</div><div class="pinfo-sep">:</div><div class="pinfo-val">${address}</div></div>
        </div>
        <div class="pinfo-col">
          <div class="pinfo-row"><div class="pinfo-label">Tanggal Registrasi</div><div class="pinfo-sep">:</div><div class="pinfo-val">${regDateStr}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Tanggal Selesai</div><div class="pinfo-sep">:</div><div class="pinfo-val">${finishDateStr}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">No. RM</div><div class="pinfo-sep">:</div><div class="pinfo-val">${mrNumber}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Ruangan / Kelas</div><div class="pinfo-sep">:</div><div class="pinfo-val">${roomClass}</div></div>
          <div class="pinfo-row"><div class="pinfo-label">Penjamin</div><div class="pinfo-sep">:</div><div class="pinfo-val">${penjamin}</div></div>
        </div>
      </div>
    </div>
    
    <div class="results-container">
      ${Object.entries(byCat).map(([cat,rows])=>`
        <div class="cat">${cat}</div>
        <table style="width:100%;margin-top:6px"><thead><tr><th>Pemeriksaan</th><th>Hasil</th><th>Satuan</th><th>Nilai Rujukan</th>${cfg.show_loinc?'<th>LOINC</th>':''}</tr></thead>
        <tbody>${_labPrintCatRows(rows, cfg)}</tbody></table>`).join('')}
      ${cfg.show_flag_legend?`<div class="legend">Keterangan: H = di atas rentang normal · L = di bawah rentang normal · * = nilai kritis</div>`:''}
    </div>
    
    <div class="footer">
      <div class="signs">
        <div>
          <div>${cfg.sign3_role || 'Penanggung Jawab'}:</div>
          <div class="line">${cfg.sign3_name || first.approved_by || '—'}</div>
        </div>
      </div>
      <div class="disc" style="display:block;margin-top:16px;font-size:10px;color:#000;border-top:1px dashed #000;padding-top:6px">
        <div style="display:flex;justify-content:space-between">
          <span><strong>Validator:</strong> ${validator}</span>
          <span><strong>Approval:</strong> ${approver}</span>
          <span>Dokumen elektronik valid tanpa ttd basah · Dicetak: ${new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
    </body></html>`);
  w.document.close();
}

// Baris cetak per hasil (indent=analit di dalam panel)
function _labPrintRow(r, indent, cfg){
  cfg=cfg||{};
  const col=labColor(r.color_code);
  const flag=r.result_numeric!=null&&r.normal_max!=null&&r.result_numeric>r.normal_max?'H'
            :r.result_numeric!=null&&r.normal_min!=null&&r.result_numeric<r.normal_min?'L':'';
            
  let codeStr = '';
  if (cfg.show_test_code) {
    const p = labProduct(r.product_id);
    const code = p ? (p.kode_internal || p.host_code || '') : '';
    if (code) codeStr = ` <span style="font-size:10px;color:#64748b;font-family:monospace">[${code}]</span>`;
  }
  
  const name=indent?`<span style="padding-left:16px">${r.item_name||'—'}${codeStr}</span>`:`<strong>${r.product_name||'—'}${codeStr}</strong>`;
  const span=cfg.show_loinc?5:4;
  
  // Format Nilai Rujukan
  let refRange = '—';
  if (r.normal_min != null && r.normal_max != null) {
    refRange = `${r.normal_min} – ${r.normal_max}`;
  } else if (r.normal_min != null) {
    refRange = `> ${r.normal_min}`;
  } else if (r.normal_max != null) {
    refRange = `< ${r.normal_max}`;
  }
  
  return `<tr>
    <td>${name}${cfg.show_method&&r.method?`<div style="font-size:9px;color:#94A3B8">${r.method}</div>`:''}</td>
    <td><strong style="color:${col};font-size:13px">${r.result_value||'—'}</strong>${flag ? ` <span style="color:${flag==='H'?'#EF4444':flag==='L'?'#0EA5E9':'#94A3B8'};font-weight:800;font-size:11px;margin-left:4px">${flag}</span>` : ''}</td>
    <td style="color:#546E7A">${r.unit||'—'}</td>
    <td style="color:#546E7A">${refRange}</td>
    ${cfg.show_loinc?`<td style="color:#94A3B8;font-family:monospace;font-size:10px">${r.loinc_code||'—'}</td>`:''}
  </tr>${r.notes?`<tr><td colspan="${span}" style="padding:2px 10px 6px ${indent?'26px':'10px'};font-size:10.5px;color:#7A5B00;font-style:italic">Catatan: ${r.notes}</td></tr>`:''}`;
}
// Kelompokkan hasil dalam 1 kategori per tes; panel diberi sub-header + analit terindent
function _labPrintCatRows(rows, cfg){
  cfg=cfg||{};
  const span=cfg.show_loinc?5:4;
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