// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODULE: Akuntansi (Fase 4) â€” Buku Besar, Neraca Saldo, Laba Rugi per Unit
// Angka di sini TIDAK diketik manusia: seluruhnya terbentuk otomatis dari
// transaksi kasir, pengeluaran barang, opname, dan komisi home care.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let accPeriod = new Date().toISOString().slice(0, 7);

async function renderAccounting() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Akuntansi</h1>
        <p>Buku besar, neraca saldo, dan laba rugi per unit layanan</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="openCOA()">Bagan Akun</button>
        <button class="btn btn-ghost btn-sm" onclick="openGLMappings()">Pemetaan Akun</button>
      </div>
    </div>

    <div style="background:#FBF1E4;border:1px solid #E0A75E55;border-radius:8px;padding:11px 14px;
      margin-bottom:14px;font-size:12.5px;color:var(--ink-03)">
      <b>Sebelum diandalkan:</b> bagan akun terpasang dengan template standar klinik.
      Minta akuntan Anda memeriksa nomor dan nama akunnya, lalu jalankan paralel dengan
      pembukuan manual selama satu periode penuh.
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <input type="month" class="table-filter" id="acc-period" value="${accPeriod}" onchange="loadAccounting()">
      <span id="acc-summary" style="font-size:12.5px;color:var(--text3)"></span>
    </div>

    <div class="tabs" id="acc-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="switchAccTab('tb',this)">Neraca Saldo</button>
      <button class="tab-btn" onclick="switchAccTab('pl',this)">Laba Rugi per Unit</button>
      <button class="tab-btn" onclick="switchAccTab('jv',this)">Jurnal</button>
    </div>
    <div id="acc-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadAccounting();
  // Sinkronkan jurnal pending dari operasi sebelumnya (cashier, payroll, inventory)
  setTimeout(() => { if (typeof flushLedgerQueue === 'function') flushLedgerQueue(); }, 1500);
}

let accTab = 'tb';
function switchAccTab(tab, btn) {
  accTab = tab;
  document.querySelectorAll('#acc-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadAccounting();
}

async function loadAccounting() {
  accPeriod = document.getElementById('acc-period')?.value || accPeriod;
  const el = document.getElementById('acc-content'); if (!el) return;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  try {
    if (accTab === 'tb') await paintTrialBalance(el);
    else if (accTab === 'pl') await paintProfitByUnit(el);
    else await paintJournals(el);
  } catch (e) {
    el.innerHTML = `<div class="status-box status-warn">
      ${/not find the function|does not exist/i.test(e.message)
        ? 'Modul akuntansi belum tersedia â€” jalankan <code>supabase_fase4.sql</code> di Supabase SQL Editor.'
        : e.message}</div>`;
  }
}

async function paintTrialBalance(el) {
  const rows = await sbRpc('trial_balance', { p_period: accPeriod });
  const sum = document.getElementById('acc-summary');
  if (!rows || !rows.length) {
    if (sum) sum.textContent = '';
    el.innerHTML = `<div class="empty-state"><div class="ico"></div>
      <h3>Belum ada jurnal pada periode ini</h3>
      <p>Jurnal terbentuk otomatis saat kasir menerima pembayaran, barang dikeluarkan,
         opname diselesaikan, atau kunjungan home care ditutup.</p></div>`;
    return;
  }
  const td = rows.reduce((s, r) => s + (+r.total_debit || 0), 0);
  const tc = rows.reduce((s, r) => s + (+r.total_credit || 0), 0);
  const seimbang = Math.abs(td - tc) < 0.01;
  if (sum) sum.innerHTML = seimbang
    ? `<span style="color:var(--success-deep);font-weight:600">âœ“ Debit = Kredit</span> Â· ${rows.length} akun bergerak`
    : `<span style="color:var(--danger-deep);font-weight:700">âš ï¸ Tidak seimbang: selisih ${formatCurrency(td - tc)}</span>`;

  el.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>Kode</th><th>Nama Akun</th><th>Jenis</th>
    <th style="text-align:right">Debit</th><th style="text-align:right">Kredit</th>
    <th style="text-align:right">Saldo</th>
  </tr></thead><tbody>${rows.map(r => `<tr>
    <td style="font-family:ui-monospace,monospace;font-size:12px;color:var(--teal)">${r.account_code}</td>
    <td>${r.account_name}</td>
    <td style="font-size:11.5px;color:var(--gray)">${r.acc_type}</td>
    <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(r.total_debit)}</td>
    <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(r.total_credit)}</td>
    <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${formatCurrency(r.balance)}</td>
  </tr>`).join('')}
  <tr style="background:var(--bg2);font-weight:800">
    <td colspan="3">TOTAL</td>
    <td style="text-align:right">${formatCurrency(td)}</td>
    <td style="text-align:right">${formatCurrency(tc)}</td>
    <td></td></tr>
  </tbody></table></div>`;
}

async function paintProfitByUnit(el) {
  const rows = await sbRpc('profit_by_cost_center', { p_period: accPeriod });
  const sum = document.getElementById('acc-summary');
  if (!rows || !rows.length) {
    if (sum) sum.textContent = '';
    el.innerHTML = `<div class="empty-state"><div class="ico"></div>
      <h3>Belum ada pendapatan atau beban pada periode ini</h3></div>`;
    return;
  }
  const tp = rows.reduce((s, r) => s + (+r.pendapatan || 0), 0);
  const tb = rows.reduce((s, r) => s + (+r.beban || 0), 0);
  if (sum) sum.innerHTML = `Margin total <b style="color:${tp - tb >= 0 ? '#15803D' : '#B91C1C'}">${formatCurrency(tp - tb)}</b>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:16px">
      ${[{ l: 'Pendapatan', v: tp, c: '#0E7C86' },
         { l: 'Beban', v: tb, c: '#B45309' },
         { l: 'Margin Kotor', v: tp - tb, c: tp - tb >= 0 ? '#15803D' : '#B91C1C' }]
        .map(k => `<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid ${k.c};
          border-radius:10px;padding:13px">
          <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.08em">${k.l}</div>
          <div style="font-size:19px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${formatCurrency(k.v)}</div>
        </div>`).join('')}
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>Unit Layanan</th><th style="text-align:right">Pendapatan</th>
      <th style="text-align:right">Beban</th><th style="text-align:right">Margin</th><th>Kontribusi</th>
    </tr></thead><tbody>${rows.map(r => {
      const m = +r.margin || 0;
      const pct = tp ? Math.round(((+r.pendapatan || 0) / tp) * 100) : 0;
      return `<tr>
        <td style="font-weight:650">${r.cost_center}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(r.pendapatan)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(r.beban)}</td>
        <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums;
          color:${m >= 0 ? '#15803D' : '#B91C1C'}">${formatCurrency(m)}</td>
        <td><div style="height:6px;background:var(--border);border-radius:3px;min-width:70px">
          <div style="height:100%;width:${pct}%;background:var(--teal);border-radius:3px"></div></div>
          <div style="font-size:10.5px;color:var(--gray)">${pct}% pendapatan</div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

async function paintJournals(el) {
  const entries = await sbGet('journal_entries',
    `select=*&period=eq.${accPeriod}&order=entry_date.desc,id.desc&limit=200`);
  const sum = document.getElementById('acc-summary');
  if (sum) sum.textContent = `${entries.length} jurnal pada periode ini`;
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico"></div><h3>Belum ada jurnal</h3></div>`;
    return;
  }
  const srcLabel = { cashier: 'Kasir', gi: 'Pengeluaran Barang', opname: 'Stock Opname',
                     homecare: 'Home Care', ap: 'Hutang Usaha', manual: 'Manual' };
  el.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>No. Jurnal</th><th>Tanggal</th><th>Keterangan</th><th>Sumber</th>
    <th style="text-align:right">Nilai</th><th></th>
  </tr></thead><tbody>${entries.map(e => `<tr>
    <td style="font-family:ui-monospace,monospace;font-size:11.5px;color:var(--teal)">${e.entry_no || 'â€”'}
      ${e.is_reversal ? '<span class="badge badge-gray" style="margin-left:4px">balik</span>' : ''}</td>
    <td style="font-size:11.5px;color:var(--gray)">${e.entry_date ? formatDateShort(e.entry_date) : 'â€”'}</td>
    <td style="font-size:12.5px">${e.description || 'â€”'}</td>
    <td style="font-size:11.5px;color:var(--gray)">${srcLabel[e.source_type] || e.source_type || 'â€”'}</td>
    <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${formatCurrency(e.total_debit)}</td>
    <td><div class="act-row">
      <button class="act-btn" onclick="openJournalDetail(${e.id})" title="Rincian">${icon('file-text', 12)}</button>
      ${!e.is_reversal ? `<button class="act-btn del" onclick="askReverseJournal(${e.id})" title="Balik">â†©</button>` : ''}
    </div></td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function openJournalDetail(id) {
  const [e, lines] = await Promise.all([
    sbGet('journal_entries', `select=*&id=eq.${id}`),
    sbGet('journal_lines', `select=*&entry_id=eq.${id}&order=id.asc`),
  ]);
  const j = e?.[0]; if (!j) return;
  openModal(`
    <div class="modal-header"><div class="modal-title">${j.entry_no || 'Jurnal'}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:12px">
      ${j.entry_date ? formatDateShort(j.entry_date) : ''} Â· ${j.description || ''}<br>
      Dicatat oleh ${j.posted_by || 'â€”'}
    </div>
    <table style="width:100%;font-size:12.5px"><thead><tr style="background:var(--bg2)">
      <th style="padding:6px;text-align:left">Akun</th>
      <th style="padding:6px;text-align:right">Debit</th>
      <th style="padding:6px;text-align:right">Kredit</th>
    </tr></thead><tbody>${(lines || []).map(l => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px"><span style="font-family:ui-monospace,monospace;color:var(--teal)">${l.account_code}</span>
        ${l.account_name}</td>
      <td style="padding:6px;text-align:right;font-variant-numeric:tabular-nums">${l.debit ? formatCurrency(l.debit) : 'â€”'}</td>
      <td style="padding:6px;text-align:right;font-variant-numeric:tabular-nums">${l.credit ? formatCurrency(l.credit) : 'â€”'}</td>
    </tr>`).join('')}</tbody></table>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

function askReverseJournal(id) {
  openModal(`
    <div class="modal-header"><div class="modal-title">â†© Balik Jurnal</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px">
      Jurnal tidak pernah dihapus. Koreksi dilakukan dengan mencatat jurnal balik
      pada periode berjalan, sehingga jejaknya tetap utuh.
    </div>
    <div class="form-group"><label>Alasan pembalikan *</label>
      <textarea id="rv-reason" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-danger" onclick="doReverseJournal(${id})">â†© Balik Jurnal</button>
    </div>`);
}

async function doReverseJournal(id) {
  const reason = document.getElementById('rv-reason').value.trim();
  if (!reason) { toast('Alasan wajib diisi', 'err'); return; }
  try {
    const r = await sbRpc('reverse_journal', { p_entry_id: id, p_reason: reason });
    toast('âœ… Jurnal balik ' + (r?.entry_no || '') + ' tercatat', 'ok');
    closeModalForce(); await loadAccounting();
  } catch (e) { toast('âŒ ' + e.message, 'err'); }
}

async function openCOA() {
  let rows = [];
  try { rows = await sbGet('chart_of_accounts', 'select=*&order=code.asc') || []; }
  catch (e) { toast('Jalankan supabase_fase4.sql dulu', 'warn'); return; }
  openModal(`
    <div class="modal-header"><div class="modal-title">Bagan Akun</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px">
      Template standar klinik. Silakan koreksi bersama akuntan sebelum periode pertama ditutup.
    </div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto"><table><thead><tr>
      <th>Kode</th><th>Nama</th><th>Jenis</th><th>Saldo Normal</th>
    </tr></thead><tbody>${rows.map(r => `<tr style="${r.parent_code ? '' : 'background:var(--bg2);font-weight:700'}">
      <td style="font-family:ui-monospace,monospace;font-size:12px;color:var(--teal)">${r.code}</td>
      <td style="${r.parent_code ? 'padding-left:16px' : ''}">${r.name}</td>
      <td style="font-size:11.5px;color:var(--gray)">${r.acc_type}</td>
      <td style="text-align:center;font-size:11.5px">${r.normal_side === 'D' ? 'Debit' : 'Kredit'}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

async function openGLMappings() {
  let rows = [];
  try { rows = await sbGet('gl_mappings', 'select=*&order=event_key.asc') || []; }
  catch (e) { toast('Jalankan supabase_fase4.sql dulu', 'warn'); return; }
  openModal(`
    <div class="modal-header"><div class="modal-title">Pemetaan Transaksi â†’ Akun</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div style="font-size:12.5px;color:var(--text3);margin-bottom:10px">
      Menentukan akun mana yang terpakai untuk tiap jenis transaksi. Disimpan sebagai data,
      sehingga mengubahnya tidak perlu menyentuh program.
    </div>
    <div class="table-wrap" style="max-height:60vh;overflow:auto"><table><thead><tr>
      <th>Kejadian</th><th>Debit</th><th>Kredit</th><th>Keterangan</th>
    </tr></thead><tbody>${rows.map(r => `<tr>
      <td style="font-family:ui-monospace,monospace;font-size:11.5px">${r.event_key}</td>
      <td><input type="text" value="${r.debit_code || ''}" data-map-id="${r.id}" data-map-f="debit_code"
        style="width:80px;font-size:11.5px;padding:4px;font-family:ui-monospace,monospace"></td>
      <td><input type="text" value="${r.credit_code || ''}" data-map-id="${r.id}" data-map-f="credit_code"
        style="width:80px;font-size:11.5px;padding:4px;font-family:ui-monospace,monospace"></td>
      <td style="font-size:11.5px;color:var(--gray)">${r.description || ''}</td>
    </tr>`).join('')}</tbody></table></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveGLMappings()">Simpan Pemetaan</button>
    </div>`, 'wide');
}

async function saveGLMappings() {
  const inputs = document.querySelectorAll('[data-map-id]');
  const byId = {};
  inputs.forEach(i => {
    const id = i.getAttribute('data-map-id');
    byId[id] = byId[id] || {};
    byId[id][i.getAttribute('data-map-f')] = i.value.trim();
  });
  try {
    for (const [id, patch] of Object.entries(byId)) {
      await sbPatch('gl_mappings', id, { ...patch, updated_at: new Date().toISOString() });
    }
    toast('âœ… Pemetaan tersimpan', 'ok'); closeModalForce();
  } catch (e) { toast('âŒ ' + e.message, 'err'); }
}

// =============================================================================
// FINANCE BRIDGE -- postToLedger(eventKey, amount, description, refType, refId)
// Wrapper di atas RPC post_journal() yang sudah ada (supabase_fase4.sql).
// RPC menangani: lookup gl_mappings, journal_entries, journal_lines, period check.
//
// EVENT KEYS valid di gl_mappings bawaan:
//   cashier.cash    = penerimaan kasir tunai
//   cashier.bank    = penerimaan kasir non-tunai (QRIS/transfer/debit)
//   cashier.refund  = pengembalian dana pasien
//   gi.expense      = pemakaian reagen & BHP (COGS inventory)
//   payroll.salary  = beban gaji karyawan
//   homecare.comm   = komisi nakes home care
//   invoice.issue   = faktur korporat diterbitkan
//   invoice.paid    = pelunasan faktur korporat
// =============================================================================
async function postToLedger(eventKey, amount, description, refType, refId) {
  if (!amount || amount <= 0) return;
  try {
    await sbRpc('post_journal', {
      p_event_key:   eventKey,
      p_amount:      Math.round(amount),
      p_description: description || eventKey,
      p_source_type: refType || 'manual',
      p_source_id:   (refId && !isNaN(refId)) ? parseInt(refId) : null,
    });
    console.log('[postToLedger] OK:', eventKey, 'Rp', Math.round(amount).toLocaleString('id-ID'));
  } catch(e) {
    var queue = JSON.parse(localStorage.getItem('_ledger_pending') || '[]');
    queue.push({ eventKey: eventKey, amount: Math.round(amount), description: description,
      refType: refType || 'manual', refId: (refId && !isNaN(refId)) ? parseInt(refId) : null,
      ts: new Date().toISOString() });
    localStorage.setItem('_ledger_pending', JSON.stringify(queue.slice(-100)));
    console.warn('[postToLedger] pending:', e.message, '| key:', eventKey);
  }
}

// Sync pending queue ke DB -- dipanggil otomatis saat modul Akuntansi dibuka
async function flushLedgerQueue() {
  var queue = JSON.parse(localStorage.getItem('_ledger_pending') || '[]');
  if (!queue.length) return;
  var flushed = 0; var remaining = [];
  for (var i = 0; i < queue.length; i++) {
    var item = queue[i];
    try {
      await sbRpc('post_journal', {
        p_event_key:   item.eventKey,
        p_amount:      item.amount,
        p_description: item.description,
        p_source_type: item.refType || 'manual',
        p_source_id:   item.refId || null,
      });
      flushed++;
    } catch(e) { remaining.push(item); }
  }
  localStorage.setItem('_ledger_pending', JSON.stringify(remaining));
  if (flushed > 0) {
    toast(flushed + ' jurnal pending berhasil disinkronkan ke akuntansi', 'ok');
    await loadAccounting();
  }
  if (remaining.length > 0) {
    console.warn('[flushLedgerQueue]', remaining.length, 'jurnal masih pending -- periksa Pemetaan Akun');
  }
}

window.postToLedger = postToLedger;
window.flushLedgerQueue = flushLedgerQueue;
