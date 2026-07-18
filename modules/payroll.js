// ═══════════════════════════════════════════════════════════════
// MODULE: Penggajian (Fase 4.6) + Komisi Nakes (Fase 2.3)
// Menggantikan tabel estimasi lama yang memukul rata BPJS 4%.
// Seluruh tarif adalah PARAMETER, bukan angka yang dipatri di kode — karena
// peraturan pajak berubah dan tidak boleh ditebak.
// ═══════════════════════════════════════════════════════════════

let payPeriod = new Date().toISOString().slice(0, 7);
let payRun = null, payItems = [], paySettings = [];

async function renderPayroll() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Penggajian</h1>
        <p>Gaji pokok, tunjangan, komisi nakes, BPJS, dan PPh 21</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="openPayrollSettings()">⚙️ Parameter</button>
        <button class="btn btn-ghost btn-sm" onclick="openEmployeeComponents()">💼 Tunjangan Karyawan</button>
      </div>
    </div>
    <div id="pay-warn"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <input type="month" class="table-filter" id="pay-period" value="${payPeriod}" onchange="loadPayroll()">
      <button class="btn btn-teal btn-sm" onclick="runPayroll()">🧮 Hitung Gaji Periode Ini</button>
      <span id="pay-status" style="font-size:12.5px;color:var(--text3)"></span>
    </div>
    <div id="pay-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadPayrollSettings();
  await loadPayroll();
}

async function loadPayrollSettings() {
  try { paySettings = await sbGet('payroll_settings', 'select=*&order=setting_key') || []; }
  catch (e) { paySettings = null; }
  const el = document.getElementById('pay-warn'); if (!el) return;

  if (paySettings === null) {
    el.innerHTML = `<div class="status-box status-warn" style="margin-bottom:14px">
      Modul penggajian belum tersedia — jalankan <code>supabase_fase4b.sql</code>.</div>`;
    return;
  }
  const belum = paySettings.filter(s => !s.confirmed).length;
  el.innerHTML = belum ? `
    <div style="background:#FBF1E4;border:1px solid #E0A75E;border-radius:8px;padding:11px 14px;
      margin-bottom:14px;font-size:12.5px;color:#7a4a12;display:flex;justify-content:space-between;
      align-items:center;gap:10px;flex-wrap:wrap">
      <span><b>${belum} parameter belum dikonfirmasi.</b>
        Tarif BPJS dan PPh 21 terpasang sebagai titik awal dan wajib diperiksa konsultan pajak
        Anda. Gaji tidak dapat difinalkan sebelum parameter pajak dikonfirmasi.</span>
      <button class="btn btn-ghost btn-sm" onclick="openPayrollSettings()">Periksa Sekarang</button>
    </div>` : '';
}

async function loadPayroll() {
  payPeriod = document.getElementById('pay-period')?.value || payPeriod;
  const el = document.getElementById('pay-content'); if (!el) return;
  el.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  try {
    const runs = await sbGet('payroll_runs', `select=*&period=eq.${payPeriod}`);
    payRun = runs?.[0] || null;
    payItems = payRun
      ? (await sbGet('payroll_items', `select=*&run_id=eq.${payRun.id}&order=employee_name.asc`) || [])
      : [];
    paintPayroll();
  } catch (e) {
    el.innerHTML = `<div class="status-box status-warn">
      Jalankan <code>supabase_fase4b.sql</code> terlebih dahulu.</div>`;
  }
}

function paintPayroll() {
  const el = document.getElementById('pay-content');
  const st = document.getElementById('pay-status');

  if (!payRun) {
    if (st) st.textContent = '';
    el.innerHTML = `<div class="empty-state"><div class="ico">💵</div>
      <h3>Belum ada perhitungan gaji untuk ${payPeriod}</h3>
      <p>Klik "Hitung Gaji Periode Ini". Perhitungan dapat diulang selama belum final.</p></div>`;
    return;
  }

  const final = payRun.status === 'Final';
  if (st) st.innerHTML = final
    ? `<span style="color:#15803D;font-weight:600">🔒 Final</span> · dikunci ${payRun.finalized_at ? new Date(payRun.finalized_at).toLocaleString('id-ID') : ''}`
    : `<span style="color:#B45309;font-weight:600">Draft</span> · masih bisa dihitung ulang`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:16px">
      ${[{ l: 'Karyawan', v: payRun.employee_count || 0, c: '#123A5C', money: false },
         { l: 'Total Bruto', v: payRun.total_gross || 0, c: '#0E7C86', money: true },
         { l: 'Total PPh 21', v: payRun.total_tax || 0, c: '#B45309', money: true },
         { l: 'Total Diterima', v: payRun.total_net || 0, c: '#15803D', money: true }]
        .map(k => `<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};
          border-radius:10px;padding:13px">
          <div style="font-size:10.5px;color:var(--gray);text-transform:uppercase;letter-spacing:.08em">${k.l}</div>
          <div style="font-size:17px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">
            ${k.money ? formatCurrency(k.v) : k.v}</div>
        </div>`).join('')}
    </div>

    ${!final ? `<div style="text-align:right;margin-bottom:12px">
      <button class="btn btn-teal" onclick="finalizePayroll(${payRun.id})">🔒 Finalkan &amp; Catat Jurnal</button>
    </div>` : ''}

    <div class="table-wrap"><table><thead><tr>
      <th>Karyawan</th>
      <th style="text-align:right">Gaji Pokok</th>
      <th style="text-align:right">Tunjangan</th>
      <th style="text-align:right">Komisi</th>
      <th style="text-align:right">Bruto</th>
      <th style="text-align:right">BPJS</th>
      <th style="text-align:right">PPh 21</th>
      <th style="text-align:right">Diterima</th>
      <th></th>
    </tr></thead><tbody>${payItems.map(i => `<tr>
      <td style="font-weight:600">${i.employee_name || '—'}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(i.base_salary)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(i.allowances)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;color:${i.commission ? 'var(--teal)' : 'var(--gray)'}">${i.commission ? formatCurrency(i.commission) : '—'}</td>
      <td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${formatCurrency(i.gross)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;color:#B45309">${formatCurrency(i.bpjs_employee)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;color:#B45309">${formatCurrency(i.pph21)}</td>
      <td style="text-align:right;font-weight:800;font-variant-numeric:tabular-nums;color:#15803D">${formatCurrency(i.net)}</td>
      <td><button class="btn btn-ghost btn-xs" onclick="printPayslip(${i.id})">🧾 Slip</button></td>
    </tr>`).join('') || '<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--gray)">Tidak ada karyawan aktif</td></tr>'}
    </tbody></table></div>`;
}

async function runPayroll() {
  const p = document.getElementById('pay-period').value;
  if (!confirm(`Hitung gaji periode ${p}?\n\nPerhitungan sebelumnya pada periode ini akan diganti. Komisi nakes home care ikut ditarik otomatis.`)) return;
  try {
    const r = await sbRpc('calculate_payroll', { p_period: p });
    toast(`✅ ${r?.employees || 0} karyawan dihitung — bruto ${formatCurrency(r?.gross || 0)}`, 'ok');
    await loadPayroll();
  } catch (e) {
    toast('❌ ' + (/not find the function/i.test(e.message) ? 'Jalankan supabase_fase4b.sql dulu' : e.message), 'err');
  }
}

async function finalizePayroll(runId) {
  if (!confirm('Finalkan gaji periode ini?\n\nSetelah final, perhitungan terkunci dan jurnal beban gaji tercatat. Koreksi hanya lewat jurnal balik.')) return;
  try {
    await sbRpc('finalize_payroll', { p_run_id: runId });
    toast('🔒 Gaji difinalkan dan jurnal tercatat', 'ok');
    await loadPayroll();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

async function openPayrollSettings() {
  const rows = paySettings || [];
  if (!rows.length) { toast('Jalankan supabase_fase4b.sql dulu', 'warn'); return; }
  openModal(`
    <div class="modal-header"><div class="modal-title">⚙️ Parameter Penggajian</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div style="background:#FBF1E4;border:1px solid #E0A75E55;border-radius:8px;padding:10px 13px;
      margin-bottom:12px;font-size:12.5px;color:#7a4a12">
      Nilai di bawah adalah <b>titik awal</b>, bukan angka resmi. Peraturan pajak dan iuran BPJS
      berubah, jadi mintalah konsultan pajak Anda memeriksanya lalu centang <b>Dikonfirmasi</b>.
      Gaji tidak dapat difinalkan selama parameter pajak belum dicentang.
    </div>
    <div class="table-wrap" style="max-height:55vh;overflow:auto"><table><thead><tr>
      <th>Parameter</th><th style="width:130px">Nilai</th><th style="width:110px">Dikonfirmasi</th>
    </tr></thead><tbody>${rows.map(s => `<tr>
      <td><div style="font-size:12.5px">${s.label || s.setting_key}</div>
        <div style="font-size:10.5px;color:var(--gray)">${s.notes || ''}</div></td>
      <td><input type="number" step="0.01" value="${s.value ?? 0}" data-ps-id="${s.id}" data-ps-f="value"
        style="width:100%;text-align:right;font-size:12px;padding:5px"></td>
      <td style="text-align:center"><input type="checkbox" ${s.confirmed ? 'checked' : ''}
        data-ps-id="${s.id}" data-ps-f="confirmed"></td>
    </tr>`).join('')}</tbody></table></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="savePayrollSettings()">💾 Simpan</button>
    </div>`, 'wide');
}

async function savePayrollSettings() {
  const inputs = document.querySelectorAll('[data-ps-id]');
  const byId = {};
  inputs.forEach(i => {
    const id = i.getAttribute('data-ps-id');
    const f = i.getAttribute('data-ps-f');
    byId[id] = byId[id] || {};
    byId[id][f] = (f === 'confirmed') ? i.checked : (parseFloat(i.value) || 0);
  });
  try {
    for (const [id, patch] of Object.entries(byId)) {
      await sbPatch('payroll_settings', id, { ...patch, updated_at: new Date().toISOString() });
    }
    await logActivity('payroll_settings', 'payroll_settings', 0, 'Parameter penggajian diperbarui');
    toast('✅ Parameter tersimpan', 'ok');
    closeModalForce(); await loadPayrollSettings();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

async function openEmployeeComponents() {
  let emps = [], comps = [];
  try {
    [emps, comps] = await Promise.all([
      sbGet('employees', 'select=id,full_name&status=eq.Aktif&order=full_name'),
      sbGet('employee_components', 'select=*&order=employee_id'),
    ]);
  } catch (e) { toast('Jalankan supabase_fase4b.sql dulu', 'warn'); return; }

  openModal(`
    <div class="modal-header"><div class="modal-title">💼 Tunjangan &amp; Potongan Karyawan</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Karyawan</label>
        <select id="ec-emp">${(emps || []).map(e => `<option value="${e.id}">${e.full_name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Jenis</label>
        <select id="ec-type"><option>Tunjangan</option><option>Potongan</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Nama Komponen</label>
        <input type="text" id="ec-name" placeholder="Tunjangan Transport"></div>
      <div class="form-group"><label>Nominal (Rp)</label><input type="number" id="ec-amt" value="0"></div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="addEmployeeComponent()">+ Tambahkan</button>
    <div class="table-wrap" style="max-height:40vh;overflow:auto;margin-top:12px"><table><thead><tr>
      <th>Karyawan</th><th>Komponen</th><th>Jenis</th><th style="text-align:right">Nominal</th><th></th>
    </tr></thead><tbody>${(comps || []).map(c => {
      const e = (emps || []).find(x => x.id === c.employee_id);
      return `<tr>
        <td style="font-size:12.5px">${e ? e.full_name : '(id ' + c.employee_id + ')'}</td>
        <td style="font-size:12.5px">${c.component || '—'}</td>
        <td style="font-size:11.5px;color:${c.comp_type === 'Potongan' ? '#B45309' : 'var(--teal)'}">${c.comp_type}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(c.amount)}</td>
        <td><button class="act-btn del" onclick="deleteEmployeeComponent(${c.id})">🗑</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--gray)">Belum ada komponen</td></tr>'}
    </tbody></table></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

async function addEmployeeComponent() {
  const name = document.getElementById('ec-name').value.trim();
  if (!name) { toast('Nama komponen wajib diisi', 'err'); return; }
  try {
    await sbPost('employee_components', {
      employee_id: parseInt(document.getElementById('ec-emp').value),
      component: name,
      comp_type: document.getElementById('ec-type').value,
      amount: parseFloat(document.getElementById('ec-amt').value) || 0,
      is_active: true, updated_at: new Date().toISOString(),
    });
    toast('✅ Komponen ditambahkan', 'ok'); openEmployeeComponents();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

async function deleteEmployeeComponent(id) {
  if (!confirm('Hapus komponen ini?')) return;
  try { await sbDelete('employee_components', id); openEmployeeComponents(); }
  catch (e) { toast('❌ ' + e.message, 'err'); }
}

function printPayslip(itemId) {
  const i = payItems.find(x => x.id === itemId); if (!i) return;
  const org = localStorage.getItem('ol_org_name') || 'OneLab Diagnostics';
  const w = window.open('', '_blank');
  const row = (l, v, neg) => `<tr><td>${l}</td><td class="r" style="${neg ? 'color:#B91C1C' : ''}">${neg ? '(' : ''}${formatCurrency(v)}${neg ? ')' : ''}</td></tr>`;
  w.document.write(`<html><head><meta charset="utf-8"><title>Slip Gaji — ${i.employee_name}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:26px;max-width:640px;margin:auto}
      h2{margin:0 0 2px} .sub{color:#666;margin-bottom:18px;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-bottom:14px}
      td{padding:5px 6px;border-bottom:1px solid #eee} .r{text-align:right}
      .tot{font-weight:800;border-top:2px solid #333;font-size:13px}
      .sign{margin-top:44px;display:flex;justify-content:space-between}
      .sign div{width:190px;text-align:center;border-top:1px solid #333;padding-top:4px}</style>
    </head><body>
    <h2>Slip Gaji — ${org}</h2>
    <div class="sub">${i.employee_name} · Periode ${payPeriod}</div>
    <table>
      ${row('Gaji Pokok', i.base_salary)}
      ${row('Tunjangan', i.allowances)}
      ${i.commission ? row('Komisi Home Care', i.commission) : ''}
      ${i.overtime ? row('Lembur', i.overtime) : ''}
      <tr class="tot"><td>Penghasilan Bruto</td><td class="r">${formatCurrency(i.gross)}</td></tr>
    </table>
    <table>
      ${row('BPJS (porsi karyawan)', i.bpjs_employee, true)}
      ${i.other_deduction ? row('Potongan lain', i.other_deduction, true) : ''}
      ${row('PPh 21', i.pph21, true)}
      <tr class="tot"><td>Diterima</td><td class="r">${formatCurrency(i.net)}</td></tr>
    </table>
    <div class="sub">Iuran BPJS porsi perusahaan ${formatCurrency(i.bpjs_company)} tidak mengurangi penghasilan diterima.</div>
    <div class="sign"><div>Karyawan<br><br><br>${i.employee_name}</div><div>HRD<br><br><br>&nbsp;</div></div>
    <script>window.print()</script></body></html>`);
  w.document.close();
}
