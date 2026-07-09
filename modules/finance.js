// ═══════════════════════════════════════════
// MODULE: Finance & Billing
// ═══════════════════════════════════════════

const FIN_TABS = ['invoice','payment','report','commission'];
let finInvoices=[], finPayments=[];

async function renderFinance() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Finance & Billing</h1>
        <p>Invoice, pembayaran, laporan keuangan, dan komisi sales</p></div>
      <div class="btn-row">
        <button class="btn btn-teal" onclick="openInvoiceForm()">+ Buat Invoice</button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px">
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">Total Tagihan</div>
        <div style="font-size:20px;font-weight:800;color:var(--navy);margin-top:4px" id="fin-total-inv">—</div>
      </div>
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">Sudah Dibayar</div>
        <div style="font-size:20px;font-weight:800;color:#22C55E;margin-top:4px" id="fin-paid">—</div>
      </div>
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">Belum Dibayar</div>
        <div style="font-size:20px;font-weight:800;color:#F59E0B;margin-top:4px" id="fin-unpaid">—</div>
      </div>
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">Overdue</div>
        <div style="font-size:20px;font-weight:800;color:#EF4444;margin-top:4px" id="fin-overdue">—</div>
      </div>
    </div>

    <div class="tabs" id="fin-tabs">
      <button class="tab-btn active" onclick="switchFinTab('invoice',this)">💰 Invoice</button>
      <button class="tab-btn" onclick="switchFinTab('payment',this)">💳 Pembayaran</button>
      <button class="tab-btn" onclick="switchFinTab('report',this)">📊 Laporan</button>
      <button class="tab-btn" onclick="switchFinTab('commission',this)">🏆 Komisi Sales</button>
    </div>

    <div id="fin-invoice">
      <div class="table-wrap">
        <div class="table-toolbar">
          <input class="table-search" id="fin-q" placeholder="🔍 Cari nomor invoice, partner..."
            oninput="filterInvoices()" style="flex:1">
          <select class="table-filter" id="fin-status" onchange="filterInvoices()">
            <option value="">Semua Status</option>
            <option>Draft</option><option>Dikirim</option>
            <option>Dibayar</option><option>Overdue</option><option>Dibatalkan</option>
          </select>
        </div>
        <div id="fin-inv-tbody">
          <div class="loading-row"><div class="spinner"></div></div>
        </div>
      </div>
    </div>

    <div id="fin-payment" style="display:none">
      <div id="fin-pay-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>

    <div id="fin-report" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px">
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">📈 Revenue Bulanan</div>
          <div id="fin-chart-monthly" style="height:180px;display:flex;align-items:flex-end;gap:4px;padding:10px 0">
            <div style="color:var(--gray);font-size:12px">Data akan tampil setelah ada invoice</div>
          </div>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">🥧 Revenue per Tipe Layanan</div>
          <div id="fin-chart-type" style="font-size:12px;color:var(--gray)">Data akan tampil setelah ada invoice</div>
        </div>
      </div>
    </div>

    <div id="fin-commission" style="display:none">
      <div id="fin-comm-tbody"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`;

  await loadInvoices();
}

async function loadInvoices() {
  try {
    const data = await sbGet('invoices','select=*,partners(partner_name)&order=created_at.desc');
    finInvoices = Array.isArray(data) ? data : [];
    renderInvoiceTable(finInvoices);
    calcFinKPIs(finInvoices);
  } catch(e) {
    document.getElementById('fin-inv-tbody').innerHTML =
      `<div class="status-box status-err" style="margin:16px">❌ ${e.message}</div>`;
  }
}

function calcFinKPIs(data) {
  const total   = data.reduce((s,i)=>s+(i.total_amount||0),0);
  const paid    = data.filter(i=>i.status==='Dibayar').reduce((s,i)=>s+(i.total_amount||0),0);
  const unpaid  = data.filter(i=>['Draft','Dikirim'].includes(i.status)).reduce((s,i)=>s+(i.total_amount||0),0);
  const overdue = data.filter(i=>i.status==='Overdue').reduce((s,i)=>s+(i.total_amount||0),0);
  document.getElementById('fin-total-inv').textContent = formatCurrency(total);
  document.getElementById('fin-paid').textContent      = formatCurrency(paid);
  document.getElementById('fin-unpaid').textContent    = formatCurrency(unpaid);
  document.getElementById('fin-overdue').textContent   = formatCurrency(overdue);
}

function filterInvoices() {
  const q  = (document.getElementById('fin-q')?.value||'').toLowerCase();
  const st = document.getElementById('fin-status')?.value||'';
  const f  = finInvoices.filter(i=>
    (!q || (i.invoice_number||'').toLowerCase().includes(q) || (i.partner_name||'').toLowerCase().includes(q)) &&
    (!st || i.status===st));
  renderInvoiceTable(f);
}

function renderInvoiceTable(data) {
  const el = document.getElementById('fin-inv-tbody');
  if(!data.length){
    el.innerHTML=`<div class="empty-state"><div class="ico">💰</div>
      <h3>Belum ada invoice</h3><p>Klik "+ Buat Invoice" untuk membuat invoice pertama.</p></div>`;
    return;
  }
  const stColors = {'Draft':'#94A3B8','Dikirim':'#0EA5E9','Dibayar':'#22C55E','Overdue':'#EF4444','Dibatalkan':'#6B7280'};
  el.innerHTML = `<table><thead><tr>
    <th>No. Invoice</th><th>Partner</th><th>Layanan</th>
    <th>Total</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(i=>{
    const sc = stColors[i.status]||'#94A3B8';
    const overdue = i.due_date && new Date(i.due_date)<new Date() && i.status!=='Dibayar';
    return `<tr>
      <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--navy)">${i.invoice_number||'—'}</td>
      <td>${i.partners?.partner_name||i.partner_name||'—'}</td>
      <td style="font-size:12px;color:var(--gray)">${i.service_type||'—'}</td>
      <td style="font-weight:700;color:var(--navy)">${formatCurrency(i.total_amount||0)}</td>
      <td style="font-size:12px;color:${overdue?'#EF4444':'var(--gray)'}">${i.due_date?formatDateShort(i.due_date):'—'}</td>
      <td><span class="badge" style="background:${sc}20;color:${sc}">${i.status||'Draft'}</span></td>
      <td><div class="act-row">
        <button class="act-btn" onclick="markInvoicePaid(${i.id})" title="Tandai Dibayar" style="color:#22C55E">✓</button>
        <button class="act-btn edit" onclick="openInvoiceForm(${i.id})">✏️</button>
        <button class="act-btn del" onclick="deleteInvoice(${i.id})">🗑</button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function switchFinTab(tab, btn) {
  document.querySelectorAll('#fin-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['invoice','payment','report','commission'].forEach(t=>{
    const el=document.getElementById(`fin-${t}`);
    if(el) el.style.display=t===tab?'block':'none';
  });
  if(tab==='payment') loadPayments();
  if(tab==='commission') loadCommissions();
  if(tab==='report') renderFinReport();
}

async function openInvoiceForm(id=null) {
  let inv={};
  if(id){ const d=await sbGet('invoices',`select=*&id=eq.${id}`); inv=d[0]||{}; }
  let partnerOpts='<option value="">-- Pilih Partner --</option>';
  try {
    const pts=await sbGet('partners','select=id,partner_name&order=partner_name&limit=200');
    partnerOpts+=(pts||[]).map(p=>`<option value="${p.id}" ${inv.partner_id==p.id?'selected':''}>${p.partner_name}</option>`).join('');
  } catch(e){}

  const invNum = id ? inv.invoice_number : await generateInvNumber();
  const today  = new Date().toISOString().split('T')[0];
  const due    = new Date(Date.now()+30*86400000).toISOString().split('T')[0];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id?'✏️ Edit Invoice':'➕ Buat Invoice'}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>No. Invoice</label>
        <input type="text" id="if-num" value="${invNum}" readonly style="background:var(--lgray)">
      </div>
      <div class="form-group">
        <label>Tanggal</label>
        <input type="date" id="if-date" value="${inv.invoice_date||today}">
      </div>
    </div>
    <div class="form-group">
      <label>Partner / Klien *</label>
      <select id="if-partner">${partnerOpts}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipe Layanan</label>
        <select id="if-type">
          <option>MCU Karyawan</option><option>Health Day</option><option>Screening</option>
          <option>Wellness</option><option>Home Care</option><option>Lab Diagnostik</option><option>Lainnya</option>
        </select>
      </div>
      <div class="form-group">
        <label>Jatuh Tempo</label>
        <input type="date" id="if-due" value="${inv.due_date||due}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Subtotal (Rp)</label>
        <input type="number" id="if-sub" value="${inv.subtotal||0}" oninput="calcInvTotal()">
      </div>
      <div class="form-group">
        <label>Diskon (Rp)</label>
        <input type="number" id="if-disc" value="${inv.discount||0}" oninput="calcInvTotal()">
      </div>
      <div class="form-group">
        <label>PPN 11%</label>
        <select id="if-ppn" onchange="calcInvTotal()">
          <option value="0">Tidak</option><option value="11">Ya (11%)</option>
        </select>
      </div>
    </div>
    <div style="background:var(--mint);border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;font-weight:700;color:var(--navy)">Total Invoice:</span>
      <span style="font-size:18px;font-weight:800;color:var(--teal)" id="if-total-display">Rp 0</span>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <textarea id="if-notes" rows="2">${inv.notes||''}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveInvoice(${id||'null'})">💾 Simpan</button>
    </div>`);
  calcInvTotal();
}

function calcInvTotal() {
  const sub  = parseFloat(document.getElementById('if-sub')?.value)||0;
  const disc = parseFloat(document.getElementById('if-disc')?.value)||0;
  const ppn  = parseInt(document.getElementById('if-ppn')?.value)||0;
  const tax  = (sub-disc)*(ppn/100);
  const total= sub-disc+tax;
  const el   = document.getElementById('if-total-display');
  if(el) el.textContent = formatCurrency(total);
  return total;
}

async function generateInvNumber() {
  const now=new Date();
  const yr=now.getFullYear();
  const mo=String(now.getMonth()+1).padStart(2,'0');
  try {
    const ex=await sbGet('invoices',`select=invoice_number&invoice_number=like.INV/${yr}/${mo}/*&order=invoice_number.desc&limit=1`);
    const last=ex?.[0]?.invoice_number;
    const seq=last?parseInt(last.split('/').pop()||'0')+1:1;
    return `INV/${yr}/${mo}/${String(seq).padStart(4,'0')}`;
  } catch(e){ return `INV/${yr}/${mo}/${Date.now().toString().slice(-4)}`; }
}

async function saveInvoice(id) {
  const partnerId=document.getElementById('if-partner').value;
  if(!partnerId){ toast('Pilih partner dulu','err'); return; }
  const sub  = parseFloat(document.getElementById('if-sub').value)||0;
  const disc = parseFloat(document.getElementById('if-disc').value)||0;
  const ppn  = parseInt(document.getElementById('if-ppn').value)||0;
  const total= sub-disc+(sub-disc)*(ppn/100);
  const payload={
    invoice_number: document.getElementById('if-num').value,
    invoice_date:   document.getElementById('if-date').value,
    partner_id:     partnerId,
    service_type:   document.getElementById('if-type').value,
    due_date:       document.getElementById('if-due').value,
    subtotal: sub, discount: disc, ppn_percent: ppn, total_amount: total,
    notes:          document.getElementById('if-notes').value.trim(),
    status:         'Draft',
    created_by_name: getUserName?getUserName():'User',
    updated_at:     new Date().toISOString(),
  };
  try {
    if(id) { await sbPatch('invoices',id,payload); toast('✅ Invoice diupdate','ok'); }
    else   { await sbPost('invoices',payload);     toast('✅ Invoice dibuat','ok'); }
    closeModalForce();
    await loadInvoices();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function markInvoicePaid(id) {
  if(!confirm('Tandai invoice ini sebagai Dibayar?')) return;
  try {
    await sbPatch('invoices',id,{status:'Dibayar',paid_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    toast('✅ Invoice ditandai Dibayar','ok');
    await loadInvoices();
  } catch(e){ toast('❌ '+e.message,'err'); }
}

async function deleteInvoice(id) {
  if(!confirm('Hapus invoice ini?')) return;
  try { await sbDelete('invoices',id); toast('🗑 Invoice dihapus','info'); await loadInvoices(); }
  catch(e){ toast('❌ '+e.message,'err'); }
}

async function loadPayments() {
  const el=document.getElementById('fin-pay-tbody');
  if(!el) return;
  try {
    const data=await sbGet('invoices','select=*&status=eq.Dibayar&order=paid_at.desc');
    if(!data?.length){ el.innerHTML=`<div class="empty-state"><div class="ico">💳</div><h3>Belum ada pembayaran</h3></div>`; return; }
    el.innerHTML=`<table><thead><tr><th>Invoice</th><th>Partner</th><th>Jumlah</th><th>Tanggal Bayar</th></tr></thead>
    <tbody>${(data||[]).map(i=>`<tr>
      <td style="font-family:monospace;font-size:12px">${i.invoice_number}</td>
      <td>${i.partner_name||'—'}</td>
      <td style="font-weight:700;color:#22C55E">${formatCurrency(i.total_amount||0)}</td>
      <td style="font-size:12px;color:var(--gray)">${i.paid_at?new Date(i.paid_at).toLocaleDateString('id-ID'):'—'}</td>
    </tr>`).join('')}</tbody></table>`;
  } catch(e){ el.innerHTML=`<div class="status-box status-err">${e.message}</div>`; }
}

async function loadCommissions() {
  const el=document.getElementById('fin-comm-tbody');
  if(!el) return;
  try {
    const data=await sbGet('invoices','select=created_by_name,total_amount,status&status=eq.Dibayar');
    if(!data?.length){ el.innerHTML=`<div class="empty-state"><div class="ico">🏆</div><h3>Belum ada data komisi</h3></div>`; return; }
    const byUser={};
    data.forEach(i=>{ byUser[i.created_by_name]=(byUser[i.created_by_name]||0)+(i.total_amount||0); });
    el.innerHTML=`<table><thead><tr><th>Sales</th><th>Total Revenue</th><th>Komisi 3%</th></tr></thead>
    <tbody>${Object.entries(byUser).map(([name,total])=>`<tr>
      <td style="font-weight:600">${name}</td>
      <td>${formatCurrency(total)}</td>
      <td style="color:#22C55E;font-weight:700">${formatCurrency(total*0.03)}</td>
    </tr>`).join('')}</tbody></table>`;
  } catch(e){ el.innerHTML=`<div class="status-box status-err">${e.message}</div>`; }
}

async function renderFinReport() {
  const el=document.getElementById('fin-chart-monthly');
  if(!el) return;
  try {
    const data=await sbGet('invoices','select=invoice_date,total_amount,status');
    if(!data?.length) return;
    const byMonth={};
    data.forEach(i=>{
      if(i.status!=='Dibayar') return;
      const m=i.invoice_date?.substring(0,7)||'';
      byMonth[m]=(byMonth[m]||0)+(i.total_amount||0);
    });
    const months=Object.keys(byMonth).sort().slice(-6);
    const max=Math.max(...months.map(m=>byMonth[m]),1);
    el.innerHTML=months.map(m=>{
      const h=Math.round((byMonth[m]/max)*140);
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="font-size:10px;color:var(--navy);font-weight:700">${formatCurrency(byMonth[m]).replace('Rp ','')}</div>
        <div style="width:100%;height:${h}px;background:var(--teal);border-radius:4px 4px 0 0;min-height:4px"></div>
        <div style="font-size:10px;color:var(--gray)">${m.substring(5)}</div>
      </div>`;
    }).join('');
  } catch(e){}
}
