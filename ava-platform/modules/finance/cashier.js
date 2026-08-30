// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODULE: Cashier
// Payment, Refund, Cancel, Corporate Billing
// Terintegrasi ke Admission & Finance
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const PAYMENT_METHODS = [
  {id:'cash',    label:'Cash',              icon:''},
  {id:'debit',   label:'Kartu Debit',       icon:'ðŸ’³'},
  {id:'credit',  label:'Kartu Kredit',      icon:'ðŸ’³'},
  {id:'transfer',label:'Transfer Bank',     icon:'ðŸ¦'},
  {id:'qris',    label:'QRIS',              icon:'ðŸ“±'},
  {id:'ovo',     label:'OVO',               icon:'ðŸ’œ'},
  {id:'gopay',   label:'GoPay',             icon:'ðŸ’š'},
  {id:'dana',    label:'DANA',              icon:'ðŸ’™'},
  {id:'xendit',  label:'Xendit/VA',         icon:'ðŸ”µ'},
  {id:'bpjs',    label:'BPJS Kesehatan',    icon:''},
  {id:'corporate',label:'Tagihan Korporat', icon:'ðŸ¢'},
  {id:'voucher', label:'Voucher',           icon:''},
];

const TXN_TYPES = ['Payment','Refund','Cancellation','Corporate Bill'];
let cashierAll = [], cashierQueue = [];

async function renderCashier(buka) {
  document.getElementById('main-content').innerHTML = `
    <div class="lis-header" style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#0A2342,#0d2d54);color:var(--on-accent);border-radius:8px;padding:8px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" style="color:var(--on-accent);border-color:rgba(255,255,255,0.2)" onclick="openCategory('cashier')" title="Kembali ke daftar menu Kasir">â† Menu Kasir</button>
        <div>
          <h1 style="margin:0;font-size:15px;color:var(--on-accent);font-weight:800">Kasir &amp; Pembayaran</h1>
          <span class="lis-sub" style="font-size:11px;color:#9db4d0">Pembayaran, refund, dan tagihan korporat</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="cash-date-badge" class="lis-date" style="font-size:11px;color:#cfe0f2"></span>
        <button class="btn btn-ghost btn-sm" style="color:var(--on-accent);border-color:rgba(255,255,255,0.2)" onclick="openShiftPanel()">Shift Kas</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--on-accent);border-color:rgba(255,255,255,0.2)" onclick="openCashierReport()">Laporan</button>
        <button class="btn btn-teal btn-sm" onclick="openPaymentForm()">+ Transaksi Baru</button>
      </div>
    </div>

    <div id="shift-banner"></div>

    <!-- KPI -->
    <div id="cashier-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="loading-row" style="grid-column:1/-1"><div class="spinner"></div></div>
    </div>

    <!-- Queue - Pasien Menunggu Bayar -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--navy)">â³ Antrian Pembayaran</div>
        <button class="btn btn-ghost btn-sm" onclick="loadCashierQueue()">Refresh</button>
      </div>
      <div id="cashier-queue">
        <div class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="table-wrap">
      <div class="table-toolbar">
        <input class="table-search" id="cash-q" placeholder="Cari no. transaksi, nama pasien..."
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

  // Menu "Shift Kas" dulu memakai setTimeout(openShiftPanel, 600) â€” balapan:
  // bila pemuatan data lebih lama dari 600 ms, panel terbuka di atas layar
  // yang belum siap, atau fungsinya belum ada dan gagal diam-diam. Kini
  // dibuka SESUDAH data selesai dimuat.
  if (buka === 'shift' && typeof openShiftPanel === 'function') openShiftPanel();
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
      âœ… Tidak ada antrian pembayaran
    </div>`; return;
  }
  el.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${cashierQueue.map(a=>`
      <div style="background:var(--lgray);border-radius:8px;padding:10px 14px;cursor:pointer;
        border:1.5px solid var(--border);transition:all .15s;min-width:180px"
        onclick="openPaymentForm(${a.id})"
        onmouseover="this.style.borderColor='var(--teal)';this.style.background='var(--mint)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--lgray)'">
        <div style="font-weight:700;color:var(--navy)">${a.patient_name||'â€”'}</div>
        <div style="font-size:11px;color:var(--gray)">${a.visit_number||'â€”'}</div>
        <div style="font-size:14px;font-weight:800;color:var(--teal);margin-top:4px">${formatCurrency(a.net_amount||0)}</div>
        <div style="font-size:10px;color:var(--gold);margin-top:2px">â— Menunggu Bayar</div>
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
    {icon:'',val:formatCurrency(totalIn),  label:'Total Revenue',   color:'#22C55E'},
    {icon:'',val:formatCurrency(cashTotal),label:'Cash',            color:'#0EA5E9'},
    {icon:'ðŸ“±',val:formatCurrency(nonCash),  label:'Non-Cash',        color:'#8B5CF6'},
    {icon:'',val:refunds.length,           label:'Refund',          color:'#F59E0B'},
    {icon:'ðŸ¢',val:corpBills.length,         label:'Tagihan Korporat',color:'#F97316'},
    {icon:'',val:payments.length,          label:'Transaksi',       color:'#0A2342'},
  ].map(k=>`
    <div style="background:var(--white);border-radius:10px;padding:12px;border:1px solid var(--border);border-left:4px solid ${k.color}">
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
      <div class="ico"></div>
      <h3>${cashierAll.length?'Tidak ada hasil':'Belum ada transaksi hari ini'}</h3>
    </div>`; return;
  }
  const typeColors={Payment:'#22C55E',Refund:'#F59E0B',Cancellation:'#EF4444','Corporate Bill':'#8B5CF6'};
  el.innerHTML=`<table><thead><tr>
    <th>No. Transaksi</th><th>Pasien</th><th>Tipe</th>
    <th>Metode</th><th>Total</th><th>Kasir</th><th>Waktu</th><th>Aksi</th>
  </tr></thead><tbody>
  ${data.map(t=>{
    const pm=PAYMENT_METHODS.find(m=>m.id===t.payment_method)||{icon:'',label:t.payment_method||'â€”'};
    const tc=typeColors[t.transaction_type]||'#94A3B8';
    return `<tr>
      <td style="font-family:monospace;font-size:11px;font-weight:700">${t.transaction_number||'â€”'}</td>
      <td>
        <div style="font-weight:600">${t.patient_name||'â€”'}</div>
        <div style="font-size:10px;color:var(--gray)">${t.visit_number||'â€”'}</div>
      </td>
      <td><span style="background:${tc}20;color:${tc};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${t.transaction_type||'â€”'}</span></td>
      <td style="font-size:12px">${pm.icon} ${pm.label}</td>
      <td style="font-weight:800;color:${t.transaction_type==='Refund'?'#EF4444':'var(--navy)'}">${formatCurrency(t.total_amount||0)}</td>
      <td style="font-size:11px;color:var(--gray)">${t.cashier_name||'â€”'}</td>
      <td style="font-size:11px;color:var(--gray)">${t.created_at?new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):''}</td>
      <td>
        <div class="act-row">
          <button class="act-btn" onclick="printReceipt(${t.id})" title="Print Struk">ðŸ–¨</button>
          ${t.transaction_type==='Payment'?`<button class="act-btn del" onclick="openRefundForm(${t.id})" title="Refund"></button>`:''}
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
    admOpts+=(adms||[]).map(ad=>`<option value="${ad.id}" data-amount="${ad.net_amount||0}" data-name="${ad.patient_name}" data-visit="${ad.visit_number}" ${a.id==ad.id?'selected':''}>${ad.visit_number} â€” ${ad.patient_name} (${formatCurrency(ad.net_amount||0)})</option>`).join('');
  } catch(e){}

  const txnNum = `TXN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`;
  const user   = getUserName?getUserName():'User';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Transaksi Pembayaran</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
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
            style="font-size:18px;font-weight:800;color:var(--teal);background:var(--white)">
        </div>
        <div class="form-group">
          <label>Jumlah Bayar (Rp)</label>
          <input type="number" id="pay-paid" value="${a.net_amount||0}"
            oninput="calcChange()" style="font-size:16px;font-weight:700">
        </div>
        <div class="form-group">
          <label>Kembalian (Rp)</label>
          <input type="number" id="pay-change" value="0" readonly
            style="font-size:16px;font-weight:700;color:var(--success-strong);background:var(--white)">
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

    <!-- Voucher Bridge â€” disambungkan ke voucher.js -->
    <div class="form-group" id="voucher-field-wrap">
      <label>Kode Voucher (Opsional)</label>
      <div style="display:flex;gap:8px">
        <input type="text" id="pay-voucher" placeholder="Masukkan kode voucher..." style="flex:1;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
        <button type="button" class="btn btn-ghost btn-sm" onclick="applyCashierVoucher()">Cek & Pakai</button>
      </div>
      <div id="voucher-status" style="font-size:11.5px;margin-top:4px;min-height:16px"></div>
    </div>

    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label>No. HP Pasien (Untuk Struk WA)</label>
        <input type="tel" id="pay-phone" placeholder="08xxx â€” opsional" style="font-size:13px">
      </div>
    </div>

    <div class="form-group">
      <label>Catatan</label>
      <input type="text" id="pay-notes" placeholder="Catatan kasir...">
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="processPayment('${txnNum}','${user}')">Proses Pembayaran</button>
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

    // â”€â”€ FINANCE BRIDGE: Posting jurnal ke Akuntansi (Phase F) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Sebelumnya: pembayaran masuk kasir tapi TIDAK masuk buku besar
    // Sekarang: setiap transaksi lunas otomatis posting jurnal revenue
    try {
      if (typeof postToLedger === 'function' && paid >= net) {
        await postToLedger(
          (method === 'cash' ? 'cashier.cash' : 'cashier.bank'),
          net,
          `Pembayaran layanan - ${patName} (${visitNum || txnNum})`,
          'cashier_transactions',
          txn?.[0]?.id || null
        );
      }
    } catch(eLedger) { console.warn('[Cashier] postToLedger skip:', eLedger.message); }

    toast('âœ… Pembayaran berhasil','ok');
    closeModalForce();
    await Promise.all([loadCashierQueue(), loadCashierTxn()]);
    // Auto print receipt (browser popup)
    if (txn?.[0]?.id) printReceipt(txn[0].id);

    // â”€â”€ ESC/POS Thermal Print (jika connector port 9999 aktif) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      if (typeof ESCPOS_PRINTER !== 'undefined' && paid >= net) {
        const orgName = localStorage.getItem('ol_org_name') || 'AVA GLOBAL Health & Lab';
        const rawEsc = ESCPOS_PRINTER.buildReceipt({
          faskesName: orgName,
          txnNumber: txnNum,
          patientName: patName,
          visitNumber: visitNum,
          totalAmount: net,
          paidAmount: paid,
          changeAmount: change,
          paymentMethod: method,
          cashierName: cashierName,
          datetime: new Date().toLocaleString('id-ID')
        });
        if (rawEsc) ESCPOS_PRINTER.printDirect(rawEsc, 'kasir_receipt').catch(()=>{});
      }
    } catch(eEsc) { console.warn('[Cashier] ESC/POS skip:', eEsc.message); }

    // â”€â”€ WhatsApp Struk Digital (jika ada nomor HP pasien) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      const phone = document.getElementById('pay-phone')?.value?.trim();
      if (phone && typeof WA_GATEWAY !== 'undefined') {
        const orgName = localStorage.getItem('ol_org_name') || 'AVA GLOBAL Health & Lab';
        const waCfg = WA_GATEWAY.getConfig();
        if (waCfg.autoSendLabResult !== false) {
          const msg = `ðŸ§¾ *STRUK PEMBAYARAN â€” ${orgName}*\n` +
            `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
            `No. Transaksi : ${txnNum}\n` +
            `Pasien        : ${patName}\n` +
            `No. Kunjungan : ${visitNum || 'â€”'}\n` +
            `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
            `Total Tagihan : Rp ${net.toLocaleString('id-ID')}\n` +
            `Bayar         : Rp ${paid.toLocaleString('id-ID')}\n` +
            `Kembalian     : Rp ${change.toLocaleString('id-ID')}\n` +
            `Metode        : ${method.toUpperCase()}\n` +
            `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
            `Kasir: ${cashierName}\n` +
            `${new Date().toLocaleString('id-ID')}\n\n` +
            `Terima kasih atas kepercayaan Anda ðŸ™\nSemoga lekas sehat!`;
          WA_GATEWAY.sendMessage({ to: phone, message: msg }).catch(()=>{});
          toast('ðŸ“± Struk WA terkirim ke ' + phone, 'ok');
        }
      }
    } catch(eWa) { console.warn('[Cashier] WA skip:', eWa.message); }

  } catch(e) { toast('âŒ '+e.message,'err'); }
}

async function openRefundForm(txnId) {
  const d = await sbGet('cashier_transactions',`select=*&id=eq.${txnId}`);
  const t = d[0]; if (!t) return;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Refund â€” ${t.patient_name}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="background:var(--warn-soft2);border-radius:8px;padding:12px;margin-bottom:14px">
      <div>Transaksi: <strong>${t.transaction_number}</strong></div>
      <div>Total Bayar: <strong>${formatCurrency(t.total_amount||0)}</strong></div>
      <div>Metode: <strong>${t.payment_method||'â€”'}</strong></div>
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
      <button class="btn btn-danger" onclick="processRefund(${txnId})">Proses Refund</button>
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

    toast('âœ… Refund berhasil diproses','ok');
    closeModalForce();
    await Promise.all([loadCashierQueue(), loadCashierTxn()]);
  } catch(e) { toast('âŒ '+e.message,'err'); }
}

async function printReceipt(txnId) {
  let t;
  if (typeof txnId === 'number') {
    const d = await sbGet('cashier_transactions',`select=*&id=eq.${txnId}`);
    t = d[0];
  } else t = txnId;
  if (!t) return;

  const orgName = localStorage.getItem('ol_org_name')||'AVA Health & Lab Diagnostics';
  const orgAddr = localStorage.getItem('ol_org_addr')||'';
  const pm      = PAYMENT_METHODS.find(m=>m.id===t.payment_method)||{icon:'',label:t.payment_method||'â€”'};

  const w=window.open('','_blank','width=400,height:600');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Struk â€” ${t.transaction_number}</title>
    <style>
      body{font-family:'Courier New',monospace;padding:20px;font-size:12px;max-width:300px;margin:0 auto}
      .center{text-align:center}.bold{font-weight:700}.line{border-top:1px dashed #999;margin:8px 0}
      .row{display:flex;justify-content:space-between}
      @media print{button{display:none}body{padding:0}}
    </style></head><body>
    <button onclick="window.print()" style="display:block;width:100%;padding:8px;background:var(--navy-deep);color:var(--on-accent);border:none;cursor:pointer;margin-bottom:14px;border-radius:4px">ðŸ–¨ Print Struk</button>
    <div class="center bold" style="font-size:14px">${orgName}</div>
    <div class="center" style="font-size:10px;color:var(--slate)">${orgAddr}</div>
    <div class="line"></div>
    <div class="center bold">${t.transaction_type==='Refund'?'*** REFUND ***':'BUKTI PEMBAYARAN'}</div>
    <div class="line"></div>
    <div class="row"><span>No. Transaksi</span><span>${t.transaction_number}</span></div>
    <div class="row"><span>Tanggal</span><span>${t.created_at?new Date(t.created_at).toLocaleDateString('id-ID'):''}</span></div>
    <div class="row"><span>Jam</span><span>${t.created_at?new Date(t.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):''}</span></div>
    <div class="row"><span>Pasien</span><span>${t.patient_name||'â€”'}</span></div>
    <div class="row"><span>No. Kunjungan</span><span>${t.visit_number||'â€”'}</span></div>
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>${formatCurrency(t.subtotal||t.total_amount||0)}</span></div>
    ${t.discount_amount?`<div class="row"><span>Diskon</span><span>-${formatCurrency(t.discount_amount)}</span></div>`:''}
    <div class="row bold" style="font-size:14px"><span>TOTAL</span><span>${formatCurrency(t.total_amount||0)}</span></div>
    <div class="row"><span>Metode</span><span>${pm.icon} ${pm.label}</span></div>
    ${t.paid_amount?`<div class="row"><span>Bayar</span><span>${formatCurrency(t.paid_amount)}</span></div>`:''}
    ${t.change_amount?`<div class="row bold"><span>Kembalian</span><span>${formatCurrency(t.change_amount)}</span></div>`:''}
    ${t.payment_ref?`<div class="row"><span>Ref</span><span>${t.payment_ref}</span></div>`:''}
    <div class="line"></div>
    <div class="row" style="font-size:10px"><span>Kasir</span><span>${t.cashier_name||'â€”'}</span></div>
    <div class="line"></div>
    <div class="center" style="font-size:10px;margin-top:8px">Terima kasih atas kepercayaan Anda</div>
    <div class="center" style="font-size:10px">Semoga lekas sehat ðŸ™</div>
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
      <div class="modal-title">Laporan Kasir â€” ${today}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--tint-04);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--ink-19)">${formatCurrency(totalIn)}</div>
        <div style="font-size:11px;color:var(--ink-19)">Total Pemasukan</div>
      </div>
      <div style="background:#FFEBEE;border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--ink-21)">${formatCurrency(totalOut)}</div>
        <div style="font-size:11px;color:var(--ink-21)">Total Refund</div>
      </div>
      <div style="background:#E3F2FD;border-radius:8px;padding:12px;text-align:center;grid-column:1/-1">
        <div style="font-size:20px;font-weight:800;color:var(--ink-22)">${formatCurrency(totalIn-totalOut)}</div>
        <div style="font-size:12px;color:var(--ink-22)">NET REVENUE</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">Per Metode Pembayaran</div>
    ${Object.entries(byMethod).map(([method,amount])=>{
      const pm=PAYMENT_METHODS.find(m=>m.id===method)||{icon:'',label:method};
      return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
        <span>${pm.icon} ${pm.label}</span>
        <span style="font-weight:700">${formatCurrency(amount)}</span>
      </div>`;
    }).join('')||'<div style="color:var(--gray);font-size:13px">Belum ada transaksi</div>'}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      <button class="btn btn-teal btn-sm" onclick="window.print()">ðŸ–¨ Print</button>
    </div>`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SHIFT KAS â€” buka & tutup dengan berita acara selisih (Fase 4.7)
// Total sistem dihitung dari transaksi, bukan diketik petugas, supaya
// selisih benar-benar berarti.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let activeShift = null;

async function loadActiveShift() {
  try {
    const rows = await sbGet('cashier_shifts','select=*&status=eq.Buka&order=opened_at.desc&limit=1');
    activeShift = rows?.[0] || null;
  } catch(e) { activeShift = undefined; }   // undefined = tabel belum ada
  paintShiftBanner();
}

function paintShiftBanner() {
  const el = document.getElementById('shift-banner'); if (!el) return;
  if (activeShift === undefined) { el.innerHTML = ''; return; }
  if (!activeShift) {
    el.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
      padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:12.5px;color:var(--text3)">Belum ada shift kas yang dibuka hari ini.</span>
      <button class="btn btn-teal btn-sm" onclick="openShiftPanel()">Buka Shift</button></div>`;
    return;
  }
  const since = activeShift.opened_at ? new Date(activeShift.opened_at).toLocaleString('id-ID') : 'â€”';
  el.innerHTML = `<div style="background:#E6F2F3;border:1px solid var(--teal-deep);border-radius:8px;
    padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
    <span style="font-size:12.5px"><b>Shift terbuka</b> â€” ${activeShift.cashier_name||''} sejak ${since}
      Â· saldo awal ${formatCurrency(activeShift.opening_balance||0)}</span>
    <button class="btn btn-teal btn-sm" onclick="openCloseShiftForm()">Tutup Shift</button></div>`;
}

async function openShiftPanel() {
  await loadActiveShift();
  if (activeShift === undefined) {
    toast('Tabel shift belum ada â€” jalankan supabase_fase2b.sql','warn'); return;
  }
  if (activeShift) { openCloseShiftForm(); return; }
  openModal(`
    <div class="modal-header"><div class="modal-title">ðŸ” Buka Shift Kas</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div class="form-group"><label>Kasir</label>
      <input type="text" id="sh-name" value="${getUserName?getUserName():''}"></div>
    <div class="form-group"><label>Saldo Awal Laci (Rp)</label>
      <input type="number" id="sh-open" value="0">
      <div class="form-hint">Uang tunai yang sudah ada di laci sebelum shift dimulai.</div></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="openShift()">Buka Shift</button>
    </div>`);
}

async function openShift() {
  try {
    await sbPost('cashier_shifts', {
      cashier_name: document.getElementById('sh-name').value.trim() || (getUserName?getUserName():'Kasir'),
      cashier_id: window.currentUser?.id || null,
      opened_at: new Date().toISOString(),
      opening_balance: parseFloat(document.getElementById('sh-open').value)||0,
      status:'Buka', updated_at: new Date().toISOString(),
    });
    toast('âœ… Shift dibuka','ok'); closeModalForce(); await loadActiveShift();
  } catch(e) { toast('âŒ '+e.message,'err'); }
}

function openCloseShiftForm() {
  if (!activeShift) { toast('Tidak ada shift terbuka','warn'); return; }
  openModal(`
    <div class="modal-header"><div class="modal-title">ðŸ” Tutup Shift â€” ${activeShift.cashier_name||''}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      Dibuka ${activeShift.opened_at?new Date(activeShift.opened_at).toLocaleString('id-ID'):''}
      Â· saldo awal ${formatCurrency(activeShift.opening_balance||0)}
    </div>
    <div class="form-group"><label>Uang Tunai Hasil Hitung Fisik (Rp) *</label>
      <input type="number" id="sh-count" placeholder="0">
      <div class="form-hint">Total sistem dihitung otomatis dari transaksi tunai selama shift.
        Bila berbeda, penjelasan wajib diisi.</div></div>
    <div class="form-group"><label>Penjelasan Selisih</label>
      <textarea id="sh-note" rows="2" placeholder="Wajib bila ada selisih"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="closeShift()">Tutup Shift</button>
    </div>`);
}

async function closeShift() {
  const counted = parseFloat(document.getElementById('sh-count').value);
  if (isNaN(counted)) { toast('Isi hasil hitung fisik','err'); return; }
  try {
    const res = await sbRpc('close_cashier_shift', {
      p_shift_id: activeShift.id, p_counted: counted,
      p_note: document.getElementById('sh-note').value.trim() || null,
    });
    const v = res?.variance||0;
    toast(v===0 ? 'âœ… Shift ditutup â€” kas cocok'
                : `âš ï¸ Shift ditutup dengan selisih ${formatCurrency(v)}`, v===0?'ok':'warn');
    closeModalForce(); await loadActiveShift();
  } catch(e) {
    toast('âŒ '+(/not find the function/i.test(e.message)?'Jalankan supabase_fase2b.sql dulu':e.message),'err');
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// =============================================================================
// VOUCHER BRIDGE -- Sambungkan kode voucher ke kasir
// Schema aktual:
//   vouchers: code, status, expires_at, campaign_id, used_at
//   voucher_campaigns: discount_type, discount_value, min_purchase,
//                      valid_from, valid_until, max_usage
// =============================================================================
let _appliedVoucher = null;

async function applyCashierVoucher() {
  const code = document.getElementById('pay-voucher')?.value?.trim().toUpperCase();
  const statusEl = document.getElementById('voucher-status');
  if (!code) { if (statusEl) statusEl.innerHTML = ''; return; }
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text3)">Memeriksa voucher...</span>';
  try {
    // Query vouchers + JOIN voucher_campaigns untuk info diskon
    const rows = await sbGet('vouchers',
      'select=*,voucher_campaigns(discount_type,discount_value,min_purchase,valid_from,valid_until,max_usage)&code=eq.' + code + '&status=eq.Active&limit=1'
    ).catch(() => []);

    if (!rows || !rows.length) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Kode voucher tidak valid atau tidak aktif</span>';
      _appliedVoucher = null; return;
    }
    const v = rows[0];
    const camp = v.voucher_campaigns || {};
    const now = new Date();

    // Cek expires_at (kolom di tabel vouchers)
    if (v.expires_at && new Date(v.expires_at) < now) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Voucher sudah kedaluwarsa</span>';
      return;
    }
    // Cek valid_from dan valid_until dari campaign
    if (camp.valid_from && new Date(camp.valid_from) > now) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Voucher belum berlaku (mulai ' + new Date(camp.valid_from).toLocaleDateString('id-ID') + ')</span>';
      return;
    }
    if (camp.valid_until && new Date(camp.valid_until) < now) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Kampanye voucher sudah berakhir</span>';
      return;
    }
    // Cek kuota (hitung voucher yang sudah used dari campaign ini)
    if (camp.max_usage > 0 && v.campaign_id) {
      const usedRows = await sbGet('vouchers', 'select=id&campaign_id=eq.' + v.campaign_id + '&used_at=not.is.null').catch(() => []);
      if ((usedRows?.length || 0) >= camp.max_usage) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Kuota voucher sudah habis</span>';
        return;
      }
    }
    // Hitung nilai diskon
    const total = parseFloat(document.getElementById('pay-total')?.value || 0);
    const discType = camp.discount_type || 'percent';
    const discVal = parseFloat(camp.discount_value) || 0;
    const minPurchase = parseFloat(camp.min_purchase) || 0;
    if (minPurchase > 0 && total < minPurchase) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Min. pembelian Rp ' + minPurchase.toLocaleString('id-ID') + ' untuk voucher ini</span>';
      return;
    }
    let discValue = (discType === 'percent' || discType === 'percentage')
      ? Math.round(total * discVal / 100) : Math.round(discVal);
    discValue = Math.max(0, Math.min(discValue, total));

    const discEl = document.getElementById('pay-disc');
    if (discEl) { discEl.value = discValue; calcPayTotal(); }
    _appliedVoucher = Object.assign({}, v, { _camp: camp, _disc: discValue });
    if (statusEl) statusEl.innerHTML = '<span style="color:#22C55E">Voucher <b>' + v.code + '</b> aktif &mdash; hemat Rp ' + discValue.toLocaleString('id-ID') + '</span>';
    toast('Voucher aktif -- hemat Rp ' + discValue.toLocaleString('id-ID'), 'ok');
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#EF4444">Gagal memeriksa voucher</span>';
    console.warn('[CashierVoucher]', e);
  }
}
