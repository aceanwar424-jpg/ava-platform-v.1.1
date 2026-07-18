// ═══════════════════════════════════════════════════════════════
// LIS · AUTOVERIFIKASI (Fase 5.5)
// Hasil normal yang lolos SELURUH syarat dapat divalidasi otomatis, sehingga
// analis memusatkan perhatian pada yang menyimpang.
//
// Dibuat konservatif dengan sengaja:
//   · nonaktif secara bawaan
//   · diatur per pemeriksaan, bukan global
//   · setiap kelolosan tercatat di jejak audit untuk ditinjau berkala
// Autoverifikasi tanpa peninjauan adalah risiko, bukan efisiensi.
// ═══════════════════════════════════════════════════════════════

let _avRules = [];

async function loadAutoverifyRules() {
  try { _avRules = await sbGet('autoverify_rules', 'select=*') || []; }
  catch (e) { _avRules = null; }   // null = tabel belum ada
  return _avRules;
}

// Menilai satu hasil terhadap aturannya. Alasan TIDAK lolos ikut dikembalikan
// supaya keputusannya bisa dijelaskan — bukan kotak hitam.
function autoverifyCheck(r, rule) {
  if (!rule || !rule.is_active) return { pass: false, why: 'aturan tidak aktif' };

  if (typeof isCriticalResult === 'function' && isCriticalResult(r))
    return { pass: false, why: 'nilai kritis' };
  if (rule.require_not_critical && r.is_critical)
    return { pass: false, why: 'ditandai kritis' };

  if (rule.require_in_range) {
    const v = (r.result_numeric != null) ? r.result_numeric : parseFloat(r.result_value);
    if (isNaN(v)) return { pass: false, why: 'hasil bukan angka' };
    if (r.ref_low != null && v < r.ref_low)   return { pass: false, why: 'di bawah rentang rujukan' };
    if (r.ref_high != null && v > r.ref_high) return { pass: false, why: 'di atas rentang rujukan' };
    if (r.ref_low == null && r.ref_high == null)
      return { pass: false, why: 'rentang rujukan belum diatur' };
  }

  if (rule.require_delta_ok && r.delta_flag)
    return { pass: false, why: 'delta check mencurigakan' };

  return { pass: true, why: 'dalam rentang rujukan, tidak kritis' };
}

// Panel ringkas; dipasang di tab Validasi
async function renderAutoverifyPanel(containerId, results) {
  const el = document.getElementById(containerId); if (!el) return;
  const rules = await loadAutoverifyRules();

  if (rules === null) {
    el.innerHTML = '<div class="status-box status-warn" style="margin-bottom:12px">' +
      'Autoverifikasi belum tersedia — jalankan <code>supabase_fase5_lis.sql</code>.</div>';
    return;
  }

  const drafts = (results || []).filter(r => r.status === 'Draft');
  const eligible = drafts.filter(r => {
    const rule = rules.find(x => String(x.product_id) === String(r.product_id));
    return autoverifyCheck(r, rule).pass;
  });
  window._avEligible = eligible;

  const aktif = rules.filter(r => r.is_active).length;
  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
      padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;
      align-items:center;gap:10px;flex-wrap:wrap">
      <div style="font-size:12.5px">
        <b>Autoverifikasi</b> — ${aktif} pemeriksaan aktif ·
        <b style="color:${eligible.length ? '#15803D' : 'var(--gray)'}">${eligible.length}</b> hasil memenuhi syarat
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="openAutoverifyRules()">⚙️ Atur Aturan</button>
        ${eligible.length ? `<button class="btn btn-teal btn-sm" onclick="runAutoverify()">✅ Verifikasi Otomatis (${eligible.length})</button>` : ''}
      </div>
    </div>`;
}

async function runAutoverify() {
  const list = window._avEligible || [];
  if (!list.length) { toast('Tidak ada hasil yang memenuhi syarat', 'info'); return; }
  const konfirmasi = 'Verifikasi otomatis ' + list.length +
    ' hasil yang seluruhnya dalam rentang rujukan dan tidak kritis?\n\n' +
    'Setiap kelolosan tercatat di jejak audit untuk ditinjau berkala.';
  if (!confirm(konfirmasi)) return;

  let ok = 0, lewat = 0;
  for (const r of list) {
    const rule = (_avRules || []).find(x => String(x.product_id) === String(r.product_id));
    const chk = autoverifyCheck(r, rule);
    if (!chk.pass) { lewat++; continue; }
    try { await sbRpc('mark_autoverified', { p_result_id: r.id, p_note: chk.why }); ok++; }
    catch (e) { lewat++; }
  }
  toast('✅ ' + ok + ' hasil terverifikasi otomatis' + (lewat ? ' · ' + lewat + ' dilewati' : ''), 'ok');
  if (typeof labRefresh === 'function') await labRefresh();
}

async function openAutoverifyRules() {
  const rules = await loadAutoverifyRules();
  if (rules === null) { toast('Jalankan supabase_fase5_lis.sql dulu', 'warn'); return; }

  let prods = [];
  try { prods = await sbGet('products', 'select=id,nama_tes&is_active=eq.true&order=nama_tes&limit=500') || []; }
  catch (e) { prods = []; }

  const belumDiatur = prods.filter(p => !rules.some(r => String(r.product_id) === String(p.id)));

  openModal(`
    <div class="modal-header"><div class="modal-title">⚙️ Aturan Autoverifikasi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>

    <div style="background:#FBF1E4;border:1px solid #E0A75E55;border-radius:8px;padding:10px 13px;
      margin-bottom:12px;font-size:12.5px;color:#7a4a12">
      Mulailah dari sedikit pemeriksaan yang paling stabil. Hasil yang lolos otomatis tetap
      tercatat di jejak audit dan sebaiknya ditinjau berkala.
    </div>

    <div class="form-group"><label>Tambahkan pemeriksaan</label>
      <select id="av-prod">
        <option value="">-- Pilih pemeriksaan --</option>
        ${belumDiatur.map(p => `<option value="${p.id}">${p.nama_tes}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="addAutoverifyRule()">+ Tambahkan</button>
    </div>

    <div class="table-wrap" style="max-height:320px;overflow:auto">
      <table><thead><tr><th>Pemeriksaan</th><th>Aktif</th><th>Syarat</th><th></th></tr></thead>
      <tbody>${rules.length ? rules.map(r => {
        const p = prods.find(x => String(x.id) === String(r.product_id));
        const nama = p ? p.nama_tes : '(tes id ' + r.product_id + ')';
        return `<tr>
          <td style="font-size:12.5px">${nama}</td>
          <td style="text-align:center"><input type="checkbox" ${r.is_active ? 'checked' : ''}
            onchange="toggleAutoverify(${r.id},this.checked)"></td>
          <td style="font-size:11.5px;color:var(--gray)">dalam rentang · tidak kritis · delta aman</td>
          <td><button class="act-btn del" onclick="deleteAutoverifyRule(${r.id})">🗑</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--gray)">
        Belum ada aturan. Selama kosong, tidak ada hasil yang diverifikasi otomatis.</td></tr>`}
      </tbody></table>
    </div>

    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');
}

async function addAutoverifyRule() {
  const pid = document.getElementById('av-prod') ? document.getElementById('av-prod').value : '';
  if (!pid) { toast('Pilih pemeriksaan dulu', 'err'); return; }
  try {
    await sbPost('autoverify_rules', {
      product_id: parseInt(pid), is_active: false,
      require_in_range: true, require_not_critical: true, require_delta_ok: true,
      updated_at: new Date().toISOString(),
    });
    toast('✅ Aturan ditambahkan — masih nonaktif, aktifkan bila sudah yakin', 'ok');
    _avRules = []; openAutoverifyRules();
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

async function toggleAutoverify(id, active) {
  try {
    await sbPatch('autoverify_rules', id, { is_active: active, updated_at: new Date().toISOString() });
    await logActivity('autoverify_rule', 'autoverify_rules', id,
      active ? 'Autoverifikasi diaktifkan' : 'Autoverifikasi dinonaktifkan');
    _avRules = [];
  } catch (e) { toast('❌ ' + e.message, 'err'); }
}

async function deleteAutoverifyRule(id) {
  if (!confirm('Hapus aturan autoverifikasi ini?')) return;
  try { await sbDelete('autoverify_rules', id); _avRules = []; openAutoverifyRules(); }
  catch (e) { toast('❌ ' + e.message, 'err'); }
}
