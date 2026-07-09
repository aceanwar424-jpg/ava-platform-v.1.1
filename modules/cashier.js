// ═══════════════════════════════════════════
// MODULE: Cashier
// Payment, Refund, Cancel, Corporate Billing
// Terintegrasi ke Admission & Finance
// ═══════════════════════════════════════════

const PAYMENT_METHODS = [
  {id:'cash',    label:'Cash',              icon:'💵'},
  {id:'debit',   label:'Kartu Debit',       icon:'💳'},
  {id:'credit',  label:'Kartu Kredit',      icon:'💳'},
  {id:'transfer',label:'Transfer Bank',     icon:'🏦'},
  {id:'qris',    label:'QRIS',              icon:'📱'},
  {id:'ovo',     label:'OVO',               icon:'💜'},
  {id:'gopay',   label:'GoPay',             icon:'💚'},
  {id:'dana',    label:'DANA',              icon:'💙'},
  {id:'xendit',  label:'Xendit/VA',         icon:'🔵'},
  {id:'bpjs',    label:'BPJS Kesehatan',    icon:'🏥'},
  {id:'corporate',label:'Tagihan Korporat', icon:'🏢'},
  {id:'voucher', label:'Voucher',           icon:'🎟'},
];

const TXN_TYPES = ['Payment','Refund','Cancellation','Corporate Bill'];
let cashierAll = [], cashierQueue = [];

async function renderCashier() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Kasir</h1>
        <p>Pembayaran, refund, dan tagihan korporat</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="openCashierReport()">📊 Laporan</button>
        <button class="btn btn-teal" onclick="openPaymentForm()">+ Transaksi Baru</button>
      </div>
    </div>

    <!-- KPI -->
    <div id="cashier-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Queue - Pasien Menunggu Bayar -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--navy)">⏳ Antrian Pembayaran</div>
        <button class="btn btn-ghost btn-sm" onclick="loadCashierQueue()">🔄 Refresh</button>
      </div>
      <div id="cashier-queue">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="cash-q" placeholder="🔍 Cari no. transaksi, nama pasien..."
          oninput="filterCashier()" style="flex:1">
        <select class="table-filter" id="cash-type" onchange="filterCashier()">
          <option value="">Semua Tipe</option>
          ${TXN_TYPES.map(t=>`<option>${t}</option>`).join('')}
        </select>
        <input type="date" class="table-filter" id="cash-date"
          value="${new Date().toISOString().split('T')[0]}" onchange="loadCashierTxn()">
      </div>
      <div id="cashier-tbody">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>`;

  await Promise.all([loadCashierQueue(), loadCashierTxn()]);
}

async function loadCashierQueue() {
  try {
    const data = await sbGet('admissions',
      `select=*&payment_status=eq.Unpaid&status=neq.Cancelled&order=created_at.asc&limit=20`);
    cashierQueue = Array.isArray(data)?data:[];
    renderQueue();
  } catch(e) { cashierQueue=[]; renderQueue(); }
}

function renderQueue() {
  const el = document.getElementById('cashier-queue'); if (!el) return;
  if (!cashierQueue.length) {
    el.innerHTML=`<div style="text-align:center;padding:14px;color:var(--gray);font-size:13px">
      ✅ Tidak ada antrian pembayaran
    </div>`; return;
  }
  el.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${cashierQueue.map(a=>`
      <div style="background:var(--lgray);border-radius:8px;padding:10px 14px;cursor:pointer;
        border:1.5px solid var(--border);transition:all .15s;min-width:180px"
        onclick="openPaymentForm(${a.id})"
        onmouseover="this.style.borderColor='var(--teal)';this.style.background='var(--mint)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--lgray)'">
        <div style="font-weight:700;color:var(--navy)">${a.patient_name||'—'}</div>
        <div style="font-size:11px;color:var(--gray)">${a.visit_number||'—'}</div>
        <div style="font-size:14px;font-weight:800;color:var(--teal);margin-top:4px">${formatCurrency(a.net_amount||0)}</div>
        <div style="font-size:10px;color:#F59E0B;margin-top:2px">● Menunggu Bayar</div>
      </div>`).join('')}
  </div>`;
}

async function loadCashierTxn() {
  try {
    const date = document.getElementById('cash-date')?.value||new Date().toISOString().split('T')[0];
    const data = await sbGet('cashier_transactions',
      `select=*&created_at=gte.${date}T00:00:00&created_at=lte.${date}T23:59:59&order=created_at.desc`);
    cashierAll = Array.isArray(data)?data:[];
    renderCashierKPI();
    filterCashier();
  } catch(e) { cashierAll=[]; renderCashierKPI(); filterCashier(); }
}

function renderCashierKPI() {
  const el=document.getElementById('cashier-kpi'); if (!el) return;
  const payments   = cashierAll.filter(t=>t.transaction_type==='Payment');
  const refunds    = cashierAll.filter(t=>t.transaction_type==='Refund');
  const corpBills  = cashierAll.filter(t=>t.transaction_type==='Corporate Bill');
  const totalIn    = payments.reduce((s,t)=>s+(t.total_amount||0),0);
  const totalOut   = refunds.reduce((s,t)=>s+(t.total_amount||0),0);
  const cashTotal  = payments.filter(t=>t.payment_method==='cash').reduce((s,t)=>s+(t.total_amount||0),0);
  const nonCash    = totalIn - cashTotal;

  el.innerHTML=[
    {icon:'💰',val:formatCurrency(totalIn),  label:'Total Revenue',   color:'#22C55E'},
    {icon:'💵',val:formatCurrency(cashTotal),label:'Cash',            color:'#0EA5E9'},
    {icon:'📱',val:formatCurrency(nonCash),  label:'Non-Cash',        color:'#8B5CF6'},
    {icon:'🔄',val:refunds.length,           label:'Refund',          color:'#F59E0B'},
    {icon:'🏢',val:corpBills.length,         label:'Tagihan Korporat',color:'#F97316'},
    {icon:'📋',val:payments.length,          label:'Transaksi',       color:'#0A2342'},
  ].map(k=>`
    <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
      <div style="font-size:18px">${k.icon}</div>
      <div style="font-size:${String(k.val).length>8?'11px':'14px'};font-weight:800;color:${k.color}">${k.val}</div>
      <div style="font-size:10px;color:var(--gray)">${k.label}</div>
    </div>`).join('');
}

function filterCashier() {
  const q  = (document.getElementById('cash-q')?.value||'').toLowerCase();
  const tp = document.getElementById('cash-type')?.value||'';
  const f  = cashierAll.filter(t=>
    (!q  || (t.patient_name||'').toLowerCase().includes(q)||(t.transaction_number||'').includes(q)) &&
    (!tp || t.transaction_type===tp)
  );
  renderCashierTable(f);
}

function renderCashierTable(data) {
  const el=document.getElementById('cashier-tbody'); if (!el) return;
  if (!data.length) {
    el.innerHTML=`<div class="empty-state" style="padding:40px">
      <div class="ico">💰</div>
      <h3>${cashierAll.length?'Tidak ada hasil':'Belum ada transaksi hari ini'}</h3>
    </div>`; return;
  }
  const typeColors={Payment:'#22C55E',Refund:'#F59E0B',Cancellation:'#EF4444','Corporate Bill':'#8B5CF6'};
  el.innerHTML=`<table><thead><tr>
    <th>No. Transaksi</th><th>Pasien</th><th>Tipe</th>
    <th>Metode</th><th>Total</th><th>Kasir</th><th>Waktu</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(t=>{
    const pm=PAYMENT_METHODS.find(m=>m.id===t.payment_method)||{icon:'💰',label:t.payment_method||'—'};
    const tc=typeColors[t.transaction_type]||'#94A3B8';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;font-weight:700">${t.transaction_number||'—'}</td>
      <td>
        <div style="font-weight:600">${t.patient_name||'—'}</div>
        <div style="font-size:10px;color:var(--gray)">${t.visit_number||'—'}</div>
      </td>
      <td><span style="background:${tc}20;color:${tc};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${t.transaction_type||'—'}</span></td>
      <td style="font-size:12px">${pm.icon} ${pm.label}</td>
      <td style="font-weight:800;color:${t.transaction_type==='Refund'?'#EF4444':'var(--navy)'}">${formatCurrency(t.total_amount||0)}</td>
      <td style="font-size:11px;color:var(--gray)">${t.cashier_name||'—'}</td>
      <td style="font-size:11px;color:var(--gray)">${t.created_at?new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):''}</td>
      <td>
        <div class="act-row">
          <button class="act-btn" onclick="printReceipt(${t.id})" title="Print Struk">🖨</button>
          ${t.transaction_type==='Payment'?`<button class="act-btn del" onclick="openRefundForm(${t.id})" title="Refund">🔄</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function openPaymentForm(admissionId=null) {
  let a={};
  if (admissionId) {
    const d=await sbGet('admissions',`select=*&id=eq.${admissionId}`); a=d[0]||{};
  }

  let admOpts='<option value="">-- Pilih Kunjungan --</option>';
  try {
    const adms=await sbGet('admissions','select=id,visit_number,patient_name,net_amount,payment_status&payment_status=eq.Unpaid&status=neq.Cancelled&order=created_at.desc&limit=50');
    admOpts+=(adms||[]).map(ad=>`<option value="${ad.id}" data-amount="${ad.net_amount||0}" data-name="${ad.patient_name}" data-visit="${ad.visit_number}" ${a.id==ad.id?'selected':''}>${ad.visit_number} — ${ad.patient_name} (${formatCurrency(ad.net_amount||0)})</option>`).join('');
  } catch(e){}

  const txnNum = `TXN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`;
  const user   = getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">💰 Transaksi Pembayaran</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>

    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1">
        <label>Kunjungan Pasien *</label>
        <select id="pay-adm" onchange="fillPayAmount(this)">
          ${admOpts}
        </select>
      </div>
    </div>

    <!-- Amount -->
    <div style="background:var(--lgray);border-radius:10px;padding:14px;margin-bottom:14px">
      <div class="form-row">
        <div class="form-group">
          <label>Total Tagihan (Rp)</label>
          <input type="number" id="pay-total" value="${a.net_amount||0}" readonly
            style="font-size:18px;font-weight:800;color:var(--teal);background:#fff">
        </div>
        <div class="form-group">
          <label>Jumlah Bayar (Rp)</label>
          <input type="number" id="pay-paid" value="${a.net_amount||0}"
            oninput="calcChange()" style="font-size:16px;font-weight:700">
        </div>
        <div class="form-group">
          <label>Kembalian (Rp)</label>
          <input type="number" id="pay-change" value="0" readonly
            style="font-size:16px;font-weight:700;color:#22C55E;background:#fff">
        </div>
      </div>
    </div>

    <!-- Payment Method -->
    <div class="form-group">
      <label>Metode Pembayaran *</label>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        ${PAYMENT_METHODS.map(m=>`
          <button type="button" id="pm-${m.id}"
            onclick="selectPayMethod('${m.id}')"
            style="padding:8px 6px;border-radius:8px;border:2px solid var(--border);
              background:var(--lgray);cursor:pointer;font-size:11px;font-weight:600;
              transition:all .15s;text-align:center">
            <div style="font-size:16px">${m.icon}</div>
            ${m.label}
          </button>`).join('')}
        <input type="hidden" id="pay-method" value="cash">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Referensi / No. Transaksi Metode</label>
        <input type="text" id="pay-ref" placeholder="No. approval, ref transfer...">
      </div>
      <div class="form-group">
        <label>Diskon Tambahan (Rp)</label>
        <input type="number" id="pay-disc" value="0" oninput="calcPayTotal()">
      </div>
    </div>

    <div class="form-group">
      <label>Catatan</label>
      <input type="text" id="pay-notes" placeholder="Catatan kasir...">
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="processPayment('${txnNum}','${user}')">💰 Proses Pembayaran</button>
    </div>`);

  // Auto-select cash
  selectPayMethod('cash');
  if (admissionId) fillPayAmount(document.getElementById('pay-adm'));
}

function selectPayMethod(id) {
  PAYMENT_METHODS.forEach(m=>{
    const el=document.getElementById(`pm-${m.id}`);
    if (!el) return;
    if (m.id===id) {
      el.style.borderColor='var(--teal)';
      el.style.background='var(--mint)';
    } else {
      el.style.borderColor='var(--border)';
      el.style.background='var(--lgray)';
    }
  });
  const el=document.getElementById('pay-method');
  if (el) el.value=id;
}

function fillPayAmount(sel) {
  const opt   = sel.options[sel.selectedIndex];
  const amount= parseFloat(opt?.dataset.amount||0);
  const tEl   = document.getElementById('pay-total');
  const pEl   = document.getElementById('pay-paid');
  if (tEl) tEl.value=amount;
  if (pEl) pEl.value=amount;
  calcChange();
}

function calcPayTotal() {
  const total = parseFloat(document.getElementById('pay-total')?.value||0);
  const disc  = parseFloat(document.getElementById('pay-disc')?.value||0);
  const net   = total - disc;
  const pEl   = document.getElementById('pay-paid');
  if (pEl && parseFloat(pEl.value)===total) pEl.value=net;
  calcChange();
}

function calcChange() {
  const total  = parseFloat(document.getElementById('pay-total')?.value||0);
  const disc   = parseFloat(document.getElementById('pay-disc')?.value||0);
  const paid   = parseFloat(document.getElementById('pay-paid')?.value||0);
  const net    = total-disc;
  const change = paid-net;
  const el     = document.getElementById('pay-change');
  if (el) {
    el.value  = Math.max(0,change);
    el.style.color = change<0?'#EF4444':'#22C55E';
  }
}

async function processPayment(txnNum, cashierName) {
  const admSel= document.getElementById('pay-adm');
  const admId = admSel?.value;
  if (!admId) { toast('Pilih kunjungan dulu','err'); return; }

  const admOpt = admSel.options[admSel.selectedIndex];
  const patName  = admOpt?.dataset.name||'';
  const visitNum = admOpt?.dataset.visit||'';
  const method   = document.getElementById('pay-method').value;
  const total    = parseFloat(document.getElementById('pay-total').value)||0;
  const disc     = parseFloat(document.getElementById('pay-disc').value)||0;
  const paid     = parseFloat(document.getElementById('pay-paid').value)||0;
  const change   = Math.max(0, paid-(total-disc));
  const net      = total-disc;

  if (paid < net) {
    if (!confirm(`Pembayaran kurang Rp ${formatCurrency(net-paid)}. Simpan sebagai DP?`)) return;
  }

  try {
    // Create transaction
    const txn = await sbPost('cashier_transactions',{
      transaction_number: txnNum,
      admission_id:       parseInt(admId),
      visit_number:       visitNum,
      patient_name:       patName,
      subtotal:           total,
      discount_amount:    disc,
      total_amount:       net,
      paid_amount:        paid,
      change_amount:      change,
      payment_method:     method,
      payment_ref:        document.getElementById('pay-ref').value.trim()||null,
      transaction_type:   'Payment',
      status:             'Completed',
      cashier_name:       cashierName,
      notes:              document.getElementById('pay-notes').value.trim()||null,
      created_at:         new Date().toISOString(),
    });

    // Update admission payment status
    const payStatus = paid >= net ? 'Paid' : 'DP';
    await sbPatch('admissions',admId,{
      payment_status: payStatus,
      updated_at: new Date().toISOString(),
    });

    // Create invoice if paid full
    if (paid >= net) {
      await sbPost('invoices',{
        invoice_number:  txnNum.replace('TXN','INV'),
        invoice_date:    new Date().toISOString().split('T')[0],
        partner_name:    patName,
        service_type:    'Layanan Klinik/Lab',
        total_amount:    net,
        status:          'Dibayar',
        paid_at:         new Date().toISOString(),
        created_by_name: cashierName,
        updated_at:      new Date().toISOString(),
      }).catch(()=>{}); // Non-critical
    }

    toast('✅ Pembayaran berhasil','ok');
    closeModalForce();
    await Promise.all([loadCashierQueue(), loadCashierTxn()]);
    // Auto print receipt
    if (txn?.[0]?.id) printReceipt(txn[0].id);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function openRefundForm(txnId) {
  const d = await sbGet('cashier_transactions',`select=*&id=eq.${txnId}`);
  const t = d[0]; if (!t) return;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">🔄 Refund — ${t.patient_name}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="background:#FFF8E1;border-radius:8px;padding:12px;margin-bottom:14px">
      <div>Transaksi: <strong>${t.transaction_number}</strong></div>
      <div>Total Bayar: <strong>${formatCurrency(t.total_amount||0)}</strong></div>
      <div>Metode: <strong>${t.payment_method||'—'}</strong></div>
    </div>
    <div class="form-group">
      <label>Jumlah Refund (Rp)</label>
      <input type="number" id="ref-amount" value="${t.total_amount||0}" max="${t.total_amount||0}">
    </div>
    <div class="form-group">
      <label>Alasan Refund *</label>
      <select id="ref-reason">
        <option>Pembatalan layanan</option>
        <option>Kelebihan bayar</option>
        <option>Layanan tidak sesuai</option>
        <option>Permintaan pasien</option>
        <option>Lainnya</option>
      </select>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <textarea id="ref-notes" rows="2" placeholder="Detail alasan refund..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-danger" onclick="processRefund(${txnId})">🔄 Proses Refund</button>
    </div>`);
}

async function processRefund(originalTxnId) {
  const amount = parseFloat(document.getElementById('ref-amount').value)||0;
  const reason = document.getElementById('ref-reason').value;
  const notes  = document.getElementById('ref-notes').value.trim();
  const user   = getUserName?getUserName():'User';
  if (!amount) { toast('Jumlah refund wajib diisi','err'); return; }

  const d = await sbGet('cashier_transactions',`select=*&id=eq.${originalTxnId}`);
  const t = d[0]; if (!t) return;

  const refundNum = `REF-${Date.now().toString().slice(-8)}`;
  try {
    await sbPost('cashier_transactions',{
      transaction_number: refundNum,
      admission_id:       t.admission_id,
      visit_number:       t.visit_number,
      patient_name:       t.patient_name,
      total_amount:       amount,
      payment_method:     t.payment_method,
      transaction_type:   'Refund',
      status:             'Completed',
      cashier_name:       user,
      notes:              `Refund dari ${t.transaction_number}. Alasan: ${reason}. ${notes}`,
      created_at:         new Date().toISOString(),
    });

    // Update admission payment status back
    if (t.admission_id) {
      await sbPatch('admissions',t.admission_id,{
        payment_status:'Unpaid',updated_at:new Date().toISOString()
      });
    }

    toast('✅ Refund berhasil diproses','ok');
    closeModalForce();
    await Promise.all([loadCashierQueue(), loadCashierTxn()]);
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function printReceipt(txnId) {
  let t;
  if (typeof txnId === 'number') {
    const d = await sbGet('cashier_transactions',`select=*&id=eq.${txnId}`);
    t = d[0];
  } else t = txnId;
  if (!t) return;

  const orgName = localStorage.getItem('ol_org_name')||'OneLab Diagnostics';
  const orgAddr = localStorage.getItem('ol_org_addr')||'';
  const pm      = PAYMENT_METHODS.find(m=>m.id===t.payment_method)||{icon:'💰',label:t.payment_method||'—'};

  const w=window.open('','_blank','width=400,height:600');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Struk — ${t.transaction_number}</title>
    <style>
      body{font-family:'Courier New',monospace;padding:20px;font-size:12px;max-width:300px;margin:0 auto}
      .center{text-align:center}.bold{font-weight:700}.line{border-top:1px dashed #999;margin:8px 0}
      .row{display:flex;justify-content:space-between}
      @media print{button{display:none}body{padding:0}}
    </style></head><body>
    <button onclick="window.print()" style="display:block;width:100%;padding:8px;background:#0A2342;color:#fff;border:none;cursor:pointer;margin-bottom:14px;border-radius:4px">🖨 Print Struk</button>
    <div class="center bold" style="font-size:14px">${orgName}</div>
    <div class="center" style="font-size:10px;color:#546E7A">${orgAddr}</div>
    <div class="line"></div>
    <div class="center bold">${t.transaction_type==='Refund'?'*** REFUND ***':'BUKTI PEMBAYARAN'}</div>
    <div class="line"></div>
    <div class="row"><span>No. Transaksi</span><span>${t.transaction_number}</span></div>
    <div class="row"><span>Tanggal</span><span>${t.created_at?new Date(t.created_at).toLocaleDateString('id-ID'):''}</span></div>
    <div class="row"><span>Jam</span><span>${t.created_at?new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):''}</span></div>
    <div class="row"><span>Pasien</span><span>${t.patient_name||'—'}</span></div>
    <div class="row"><span>No. Kunjungan</span><span>${t.visit_number||'—'}</span></div>
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>${formatCurrency(t.subtotal||t.total_amount||0)}</span></div>
    ${t.discount_amount?`<div class="row"><span>Diskon</span><span>-${formatCurrency(t.discount_amount)}</span></div>`:''}
    <div class="row bold" style="font-size:14px"><span>TOTAL</span><span>${formatCurrency(t.total_amount||0)}</span></div>
    <div class="row"><span>Metode</span><span>${pm.icon} ${pm.label}</span></div>
    ${t.paid_amount?`<div class="row"><span>Bayar</span><span>${formatCurrency(t.paid_amount)}</span></div>`:''}
    ${t.change_amount?`<div class="row bold"><span>Kembalian</span><span>${formatCurrency(t.change_amount)}</span></div>`:''}
    ${t.payment_ref?`<div class="row"><span>Ref</span><span>${t.payment_ref}</span></div>`:''}
    <div class="line"></div>
    <div class="row" style="font-size:10px"><span>Kasir</span><span>${t.cashier_name||'—'}</span></div>
    <div class="line"></div>
    <div class="center" style="font-size:10px;margin-top:8px">Terima kasih atas kepercayaan Anda</div>
    <div class="center" style="font-size:10px">Semoga lekas sehat 🙏</div>
    </body></html>`);
  w.document.close();
}

async function openCashierReport() {
  const today     = new Date().toISOString().split('T')[0];
  const payments  = cashierAll.filter(t=>t.transaction_type==='Payment');
  const refunds   = cashierAll.filter(t=>t.transaction_type==='Refund');
  const totalIn   = payments.reduce((s,t)=>s+(t.total_amount||0),0);
  const totalOut  = refunds.reduce((s,t)=>s+(t.total_amount||0),0);
  const byMethod  = {};
  payments.forEach(t=>{ byMethod[t.payment_method]=(byMethod[t.payment_method]||0)+(t.total_amount||0); });

  openModal(`
    <div class="modal-header">
      <div class="modal-title">📊 Laporan Kasir — ${today}</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:#E8F5E9;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:#2E7D32">${formatCurrency(totalIn)}</div>
        <div style="font-size:11px;color:#2E7D32">Total Pemasukan</div>
      </div>
      <div style="background:#FFEBEE;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:#C62828">${formatCurrency(totalOut)}</div>
        <div style="font-size:11px;color:#C62828">Total Refund</div>
      </div>
      <div style="background:#E3F2FD;border-radius:8px;padding:12px;text-align:center;grid-column:1/-1">
        <div style="font-size:20px;font-weight:800;color:#1565C0">${formatCurrency(totalIn-totalOut)}</div>
        <div style="font-size:12px;color:#1565C0">NET REVENUE</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">Per Metode Pembayaran</div>
    ${Object.entries(byMethod).map(([method,amount])=>{
      const pm=PAYMENT_METHODS.find(m=>m.id===method)||{icon:'💰',label:method};
      return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
        <span>${pm.icon} ${pm.label}</span>
        <span style="font-weight:700">${formatCurrency(amount)}</span>
      </div>`;
    }).join('')||'<div style="color:var(--gray);font-size:13px">Belum ada transaksi</div>'}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal btn-sm" onclick="window.print()">🖨 Print</button>
    </div>`);
}
