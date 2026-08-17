// ═══════════════════════════════════════════════════════════════
// LIS · KESIMPULAN PEMERIKSAAN TINGKAT PANEL
//
// lab_results.ai_conclusion memberi kesimpulan PER-TEST. Yang dibutuhkan di
// tab Approval adalah impresi klinis MENYELURUH untuk satu kunjungan — misalnya
// "Dislipidemia" yang muncul dari POLA beberapa test sekaligus (kolesterol dan
// trigliserida tinggi), bukan dari satu angka.
//
// ── Kejujuran tentang "AI" di sini ────────────────────────────
// Kesimpulan dibuat dari ATURAN POLA deterministik, bukan model bahasa. Ia
// menautkan pola hasil yang lazim ke istilah klinis yang lazim pula. Karena itu
// hasilnya konsisten dan dapat ditelusuri — tapi TIDAK menggantikan penilaian
// dokter. Teks yang dihasilkan berstatus DRAF: wajib dibaca, boleh disunting,
// dan harus dikonfirmasi dokter sebelum sah. Itu invarian R3 OneLab.
//
// Semua nama global diawali "lpi" agar tidak bertabrakan dengan modul lain.
// Butuh: supabase_lab_panel_conclusion.sql sudah dijalankan.
// ═══════════════════════════════════════════════════════════════

let _lpiCache = {};       // admission_id → baris lab_panel_conclusions
let _lpiTableOk = null;   // null=belum dicek, true/false

function lpiEsc(s){
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// Arah kelainan sebuah hasil terhadap rentang rujukan yang sudah tersimpan di
// baris (rentang itu sudah dicocokkan gender/umur saat input).
function lpiDir(r){
  const n = r.result_numeric;
  if (n == null) return 0;
  if (r.normal_max != null && n > r.normal_max) return 1;   // tinggi
  if (r.normal_min != null && n < r.normal_min) return -1;  // rendah
  return 0;
}
const lpiHigh = r => lpiDir(r) === 1;
const lpiLow  = r => lpiDir(r) === -1;

// Cari satu hasil dalam panel berdasarkan kata kunci nama test.
function lpiFind(rows, ...keywords){
  const kw = keywords.map(k => k.toLowerCase());
  return rows.find(r => {
    const nm = `${r.item_name||''} ${r.product_name||''}`.toLowerCase();
    return kw.some(k => nm.includes(k));
  });
}

function lpiValStr(r){
  if (!r) return '';
  const arrow = lpiHigh(r) ? '↑' : lpiLow(r) ? '↓' : '';
  return `${r.result_value ?? '—'} ${r.unit||''} ${arrow}`.trim();
}

// ── Detektor pola ─────────────────────────────────────────────
// Mengembalikan { findings:[{code,label,severity,basis}], impression, abnormalCount }
// Setiap aturan menyebutkan DASAR angkanya supaya dapat diperiksa dokter, bukan
// sekadar melempar label.
function lpiDetect(rows){
  const findings = [];
  const add = (code, label, severity, basis) => findings.push({ code, label, severity, basis });

  // — Metabolisme glukosa —
  const gdp = lpiFind(rows, 'gula darah puasa', 'gdp', 'glukosa puasa');
  const gd2 = lpiFind(rows, 'gula darah 2 jam', 'gd2pp', 'post prandial');
  const a1c = lpiFind(rows, 'hba1c', 'a1c');
  const dm = (gdp && gdp.result_numeric >= 126) || (a1c && a1c.result_numeric >= 6.5) || (gd2 && gd2.result_numeric >= 200);
  const pradm = !dm && ((gdp && gdp.result_numeric >= 100) || (a1c && a1c.result_numeric >= 5.7));
  if (dm) add('dm','Diabetes melitus','tinggi',
    [gdp&&`GDP ${lpiValStr(gdp)}`, a1c&&`HbA1c ${lpiValStr(a1c)}`, gd2&&`GD2PP ${lpiValStr(gd2)}`].filter(Boolean).join(', '));
  else if (pradm) add('prediabetes','Glukosa darah puasa terganggu (prediabetes)','sedang',
    [gdp&&`GDP ${lpiValStr(gdp)}`, a1c&&`HbA1c ${lpiValStr(a1c)}`].filter(Boolean).join(', '));

  // — Profil lipid —
  const kol  = lpiFind(rows, 'kolesterol total', 'total kolesterol');
  const ldl  = lpiFind(rows, 'ldl');
  const trig = lpiFind(rows, 'trigliserida', 'trigliserid');
  const hdl  = lpiFind(rows, 'hdl');
  const lipidBits = [];
  if (kol  && lpiHigh(kol))  lipidBits.push(`kolesterol total ${lpiValStr(kol)}`);
  if (ldl  && lpiHigh(ldl))  lipidBits.push(`LDL ${lpiValStr(ldl)}`);
  if (trig && lpiHigh(trig)) lipidBits.push(`trigliserida ${lpiValStr(trig)}`);
  if (hdl  && lpiLow(hdl))   lipidBits.push(`HDL ${lpiValStr(hdl)} (rendah)`);
  if (lipidBits.length) add('dislipidemia','Dislipidemia', lipidBits.length>=2?'tinggi':'sedang', lipidBits.join(', '));

  // — Hematologi —
  const hgb = lpiFind(rows, 'hemoglobin', 'hgb');
  if (hgb && lpiLow(hgb))  add('anemia','Anemia','sedang',`Hemoglobin ${lpiValStr(hgb)}`);
  if (hgb && lpiHigh(hgb)) add('eritrositosis','Eritrositosis / polisitemia','sedang',`Hemoglobin ${lpiValStr(hgb)}`);
  const leu = lpiFind(rows, 'leukosit', 'wbc');
  if (leu && lpiHigh(leu)) add('leukositosis','Leukositosis','sedang',`Leukosit ${lpiValStr(leu)}`);
  if (leu && lpiLow(leu))  add('leukopenia','Leukopenia','sedang',`Leukosit ${lpiValStr(leu)}`);
  const plt = lpiFind(rows, 'trombosit', 'platelet', 'plt');
  if (plt && lpiLow(plt))  add('trombositopenia','Trombositopenia','tinggi',`Trombosit ${lpiValStr(plt)}`);

  // — Ginjal & asam urat —
  const kre = lpiFind(rows, 'kreatinin');
  const ure = lpiFind(rows, 'ureum', 'urea', 'bun');
  if ((kre && lpiHigh(kre)) || (ure && lpiHigh(ure))) add('ginjal','Peningkatan penanda fungsi ginjal','tinggi',
    [kre&&lpiHigh(kre)&&`kreatinin ${lpiValStr(kre)}`, ure&&lpiHigh(ure)&&`ureum ${lpiValStr(ure)}`].filter(Boolean).join(', '));
  const au = lpiFind(rows, 'asam urat', 'uric');
  if (au && lpiHigh(au)) add('hiperurisemia','Hiperurisemia','sedang',`Asam urat ${lpiValStr(au)}`);

  // — Hati —
  const sgot = lpiFind(rows, 'sgot', 'ast', 'aspartat');
  const sgpt = lpiFind(rows, 'sgpt', 'alt', 'alanin');
  if ((sgot && lpiHigh(sgot)) || (sgpt && lpiHigh(sgpt))) add('hati','Peningkatan enzim hati','sedang',
    [sgot&&lpiHigh(sgot)&&`SGOT ${lpiValStr(sgot)}`, sgpt&&lpiHigh(sgpt)&&`SGPT ${lpiValStr(sgpt)}`].filter(Boolean).join(', '));

  // — Kelainan lain yang belum terpetakan ke sindrom, agar tidak hilang —
  const known = new Set([gdp,gd2,a1c,kol,ldl,trig,hdl,hgb,leu,plt,kre,ure,au,sgot,sgpt].filter(Boolean));
  const lainAbn = rows.filter(r => !known.has(r) && lpiDir(r) !== 0);
  const critAny = rows.some(r => r.is_critical);

  // — Susun teks —
  const abnormalCount = rows.filter(r => lpiDir(r) !== 0).length;
  let impression;
  if (!findings.length && !lainAbn.length) {
    impression = 'Kesan: seluruh parameter dalam batas rujukan. Tidak ditemukan kelainan bermakna pada panel ini.';
  } else {
    const lines = findings.map(f => `• ${f.label} (${f.basis})`);
    if (lainAbn.length) {
      lines.push('• Nilai di luar rujukan lain: ' +
        lainAbn.map(r => `${r.item_name||r.product_name} ${lpiValStr(r)}`).join(', '));
    }
    impression = 'Kesan:\n' + lines.join('\n');
  }
  if (critAny) impression = '⚠️ Terdapat NILAI KRITIS pada panel ini — perlu perhatian segera.\n\n' + impression;
  impression += '\n\nSaran: korelasikan dengan keadaan klinis pasien.';

  return { findings, impression, abnormalCount, critAny };
}

// ── Muat / simpan penyimpanan ─────────────────────────────────
async function lpiLoad(admId){
  if (_lpiTableOk === false) return null;
  try {
    const rows = await sbGet('lab_panel_conclusions', `select=*&admission_id=eq.${admId}&limit=1`);
    _lpiTableOk = true;
    const row = rows?.[0] || null;
    _lpiCache[admId] = row;
    return row;
  } catch(e) {
    // Tabel belum dibuat → tandai supaya panel menampilkan petunjuk, bukan error.
    if (/lab_panel_conclusions/.test(e.message) || /schema cache/.test(e.message)) _lpiTableOk = false;
    return null;
  }
}

// ── Panel di bawah grid tab Approval ──────────────────────────
// containerId = `${prefix}-concl`. Hanya dipakai mode 'approve'.
async function lpiRenderPanel(containerId, admId){
  const el = document.getElementById(containerId); if(!el) return;
  const rows = labResults.filter(r => r.admission_id == admId &&
                                 ['Validated','Approved'].includes(r.status) && r.result_value);

  const existing = await lpiLoad(admId);

  if (_lpiTableOk === false) {
    el.innerHTML = `
      <div style="margin:10px 14px;padding:10px 12px;background:#FEF9E7;border:1px solid #F5D77E;border-radius:8px;font-size:11.5px;color:var(--ink-25)">
        Fitur kesimpulan panel belum aktif. Jalankan <code>supabase_lab_panel_conclusion.sql</code> di Supabase SQL Editor.
      </div>`;
    return;
  }

  const confirmed = existing?.confirmed_by;
  const text = existing?.impression || '';
  const findings = existing?.findings || [];

  el.innerHTML = `
    <div style="margin:10px 14px 16px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;
        padding:9px 12px;background:#F3F0FB;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div style="font-size:12.5px;font-weight:800;color:var(--ink-20)">
          🧠 Kesimpulan Pemeriksaan (Keseluruhan)
          <span style="font-weight:600;color:var(--gray);font-size:10.5px">— dibuat otomatis dari pola hasil, wajib dikonfirmasi dokter</span>
        </div>
        <button class="btn btn-sm" style="background:var(--violet-deep);color:var(--on-accent)"
          onclick="lpiGenerate(${admId})">✨ Buat Otomatis</button>
      </div>

      <div style="padding:12px">
        ${findings.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
          ${findings.map(f => `<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;
            background:${f.severity==='tinggi'?'#FEE2E2':'#FEF3C7'};color:${f.severity==='tinggi'?'#B91C1C':'#92400E'}">
            ${lpiEsc(f.label)}</span>`).join('')}
        </div>` : ''}

        <textarea id="lpi-text-${admId}" rows="5"
          style="width:100%;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:8px;
          font-family:inherit;line-height:1.5;resize:vertical"
          placeholder="Klik 'Buat Otomatis' untuk menyusun kesan dari pola hasil, atau ketik manual…">${lpiEsc(text)}</textarea>

        <div style="font-size:11px;color:var(--gray);margin-top:8px">
          ${confirmed
            ? `✅ Dikonfirmasi oleh <b>${lpiEsc(confirmed)}</b>${existing.confirmed_at?` · ${new Date(existing.confirmed_at).toLocaleString('id-ID')}`:''}`
            : `ℹ️ Kesimpulan ini akan <b>tersimpan & dikonfirmasi otomatis</b> saat Anda menekan <b>Approve &amp; Rilis</b> di bawah.`}
        </div>
      </div>
    </div>`;
}

// Isi textarea dari detektor pola (tidak langsung menyimpan — dokter meninjau dulu).
function lpiGenerate(admId){
  const rows = labResults.filter(r => r.admission_id == admId &&
                                 ['Validated','Approved'].includes(r.status) && r.result_value);
  if (!rows.length){ toast('Belum ada hasil untuk disimpulkan','warn'); return; }
  const { impression, findings, critAny } = lpiDetect(rows);
  const ta = document.getElementById(`lpi-text-${admId}`);
  if (ta) ta.value = impression;
  // Simpan findings sementara di elemen agar ikut tersimpan saat Approve & Rilis.
  if (ta) ta.dataset.findings = JSON.stringify(findings);
  toast(critAny ? '⚠️ Kesan dibuat — ADA nilai kritis, tinjau saksama' : '✨ Kesan dibuat — silakan tinjau & sunting', critAny?'warn':'ok');
}

// Simpan + konfirmasi kesimpulan panel. Dipanggil OTOMATIS oleh Approve & Rilis
// (approvePatientResults) — tidak ada lagi tombol konfirmasi terpisah, karena
// approval oleh dokter itulah konfirmasinya. Membaca textarea SEBELUM tab dimuat
// ulang. Mengembalikan true bila ada yang disimpan. Senyap: tidak menampilkan
// toast/redraw sendiri (approve yang mengurus notifikasi & render).
async function lpiSaveConclusion(admId, { confirm = true } = {}){
  if (_lpiTableOk === false) return false;                 // tabel belum dibuat → lewati
  const ta = document.getElementById(`lpi-text-${admId}`);
  const impression = ta ? ta.value.trim() : '';
  if (!impression) return false;                            // dokter tidak mengisi → tidak apa-apa

  const rows = labResults.filter(r => r.admission_id == admId);
  const sample = rows[0] || {};
  let findings = [];
  try { findings = ta.dataset.findings ? JSON.parse(ta.dataset.findings) : (_lpiCache[admId]?.findings || []); } catch(e){}

  const now = new Date().toISOString();
  const body = {
    admission_id: admId, visit_number: sample.visit_number||null,
    mr_number: sample.mr_number||null, patient_name: sample.patient_name||null,
    impression, findings,
    is_ai_generated: !!ta.dataset.findings,
    generated_at: now, generated_by: labUser(), updated_at: now,
  };
  if (confirm){ body.confirmed_by = labUser(); body.confirmed_at = now; }

  try {
    const existing = _lpiCache[admId] || await lpiLoad(admId);
    if (existing?.id) await sbPatch('lab_panel_conclusions', existing.id, body);
    else { body.created_at = now; await sbPost('lab_panel_conclusions', body); }
    if (typeof logActivity==='function')
      logActivity('panel_conclusion_confirm','lab_panel_conclusions', admId,
        'Kesimpulan panel dikonfirmasi saat approval', sample.patient_name);
    _lpiCache[admId] = null;
    return true;
  } catch(e){
    // Tidak menggagalkan approval hanya karena kesimpulan gagal tersimpan.
    console.warn('Gagal menyimpan kesimpulan panel:', e.message);
    return false;
  }
}