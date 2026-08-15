// ═══════════════════════════════════════════════════════════════
// GARIS WAKTU PASIEN (Fase 3.4)
// Menjawab satu pertanyaan yang sebelumnya tidak bisa dijawab satu layar pun:
// "apa saja yang pernah terjadi pada pasien ini?"
//
// Riwayat tersebar di banyak tabel dan modul. Fungsi ini menggabungkannya
// menjadi satu urutan waktu, dan tetap berjalan meski sebagian tabel belum ada
// (fase yang belum dijalankan tidak menggagalkan seluruh tampilan).
// ═══════════════════════════════════════════════════════════════

const TL_KIND = {
  kunjungan: { label: 'Kunjungan',      icon: 'building',     c: '#123A5C' },
  anamnesa:  { label: 'Anamnesa',       icon: 'stethoscope',  c: '#0E7C86' },
  catatan:   { label: 'Catatan Klinis', icon: 'edit',         c: '#7C3AED' },
  vital:     { label: 'Tanda Vital',    icon: 'heart',        c: '#B45309' },
  lab:       { label: 'Hasil Lab',      icon: 'flask',        c: '#0E7C86' },
  radiologi: { label: 'Radiologi',      icon: 'scan',         c: '#1D4ED8' },
  homecare:  { label: 'Home Care',      icon: 'home-heart',   c: '#15803D' },
  diagnosis: { label: 'Diagnosis',      icon: 'clipboard',    c: '#B91C1C' },
};

let tlEvents = [], tlFilter = '';

async function openMRTimeline() {
  const mr = (typeof mrClinical !== 'undefined') ? mrClinical.mr : null;
  const nama = (typeof mrClinical !== 'undefined') ? mrClinical.name : '';
  if (!mr) { toast('Pasien belum punya nomor rekam medis', 'warn'); return; }

  openModal(`
    <div class="modal-header"><div class="modal-title">🕒 Garis Waktu — ${nama}</div>
      <button class="modal-close" onclick="closeModalForce()" style="font-size:10.5px;font-weight:700"></button></div>
    <div id="tl-filter" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px"></div>
    <div id="tl-body" style="max-height:60vh;overflow:auto">
      <div class="loading-row"><div class="spinner"></div></div></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button></div>`, 'wide');

  await loadMRTimeline(mr, nama);
}

async function loadMRTimeline(mr, nama) {
  const enc = encodeURIComponent(mr);
  // Setiap sumber dibungkus catch sendiri: tabel dari fase yang belum
  // dijalankan hanya menghasilkan daftar kosong, bukan menggagalkan semuanya.
  const q = (t, s) => sbGet(t, s).catch(() => []);

  const [adms, notes, vitals, rads, hcs] = await Promise.all([
    q('admissions', `select=id,visit_number,visit_date,created_at,patient_name&mr_number=eq.${enc}&order=created_at.desc&limit=100`),
    q('clinical_notes', `select=*&mr_number=eq.${enc}&order=created_at.desc&limit=100`),
    q('vital_signs', `select=*&mr_number=eq.${enc}&order=recorded_at.desc&limit=100`),
    q('radiology_orders', `select=*&mr_number=eq.${enc}&order=created_at.desc&limit=50`),
    q('homecare_orders', `select=*&mr_number=eq.${enc}&order=created_at.desc&limit=50`),
  ]);

  const admIds = (adms || []).map(a => a.id);
  const [anams, labs, dxs] = admIds.length ? await Promise.all([
    q('anamnesas', `select=*&admission_id=in.(${admIds.join(',')})&order=created_at.desc`),
    q('lab_results', `select=*&admission_id=in.(${admIds.join(',')})&order=created_at.desc&limit=200`),
    q('icd_diagnostics', `select=*&admission_id=in.(${admIds.join(',')})&order=created_at.desc`),
  ]) : [[], [], []];

  const ev = [];
  const push = (kind, at, title, detail, extra) => {
    if (!at) return;
    ev.push({ kind, at, title, detail: detail || '', extra: extra || '' });
  };

  (adms || []).forEach(a => push('kunjungan', a.visit_date || a.created_at,
    'Pendaftaran ' + (a.visit_number || ''), ''));

  (anams || []).forEach(a => push('anamnesa', a.created_at, 'Anamnesa',
    a.keluhan_utama || a.chief_complaint || a.notes || ''));

  (notes || []).forEach(n => push('catatan', n.created_at,
    `${n.note_type}${n.locked ? ' ' : ' (draft)'}`,
    [n.subjective && 'S: ' + n.subjective, n.assessment && 'A: ' + n.assessment]
      .filter(Boolean).join(' · '),
    `${n.author_name || ''}${n.author_role ? ' · ' + n.author_role : ''}`));

  (vitals || []).forEach(v => push('vital', v.recorded_at, 'Tanda vital',
    [v.bp_systolic && `TD ${v.bp_systolic}/${v.bp_diastolic || '—'}`,
     v.pulse && `Nadi ${v.pulse}`, v.temperature && `Suhu ${v.temperature}°C`,
     v.spo2 && `SpO₂ ${v.spo2}%`, v.weight && `BB ${v.weight}kg`]
      .filter(Boolean).join(' · '), v.recorded_by || ''));

  // Hasil lab dikelompokkan per kunjungan supaya satu panel darah lengkap
  // tidak memenuhi garis waktu dengan puluhan baris.
  const labByAdm = {};
  (labs || []).forEach(r => {
    const k = r.admission_id || 'x';
    labByAdm[k] = labByAdm[k] || { at: r.created_at, items: [], crit: 0 };
    labByAdm[k].items.push(r);
    if (r.is_critical) labByAdm[k].crit++;
  });
  Object.values(labByAdm).forEach(g => push('lab', g.at,
    `${g.items.length} pemeriksaan laboratorium`,
    g.items.slice(0, 6).map(r => `${r.product_name}: ${r.result_value || '—'} ${r.unit || ''}`).join(' · ')
      + (g.items.length > 6 ? ` +${g.items.length - 6} lainnya` : ''),
    g.crit ? `${g.crit} nilai kritis` : ''));

  (rads || []).forEach(r => push('radiologi', r.performed_at || r.scheduled_at || r.created_at,
    r.procedure_name || 'Pemeriksaan radiologi',
    `${r.modality_code || ''} · ${r.status || ''}`, r.accession_no || ''));

  (hcs || []).forEach(h => push('homecare', h.scheduled_date || h.created_at,
    h.service_type || 'Kunjungan Home Care',
    `${h.status || ''}${h.assigned_staff ? ' · ' + h.assigned_staff : ''}`, ''));

  // Penanda diagnosis utama ada dua bentuk: `diagnose_type` yang diisi modul
  // Anamnesa, dan `is_primary` turunannya. Dibaca keduanya supaya tetap benar
  // walau penyelarasan di basis data belum dijalankan.
  const utama = d => d.is_primary === true ||
    String(d.diagnose_type || '').toUpperCase() === 'PRIMARY';
  (dxs || []).forEach(d => push('diagnosis', d.created_at,
    `${d.icd_code || ''} ${d.diagnose_name || d.diagnosis || ''}`.trim(),
    utama(d) ? 'Diagnosis utama' : 'Diagnosis sekunder', ''));

  tlEvents = ev.sort((a, b) => new Date(b.at) - new Date(a.at));
  paintTimelineFilter();
  paintTimeline();
}

function paintTimelineFilter() {
  const el = document.getElementById('tl-filter'); if (!el) return;
  const counts = {};
  tlEvents.forEach(e => counts[e.kind] = (counts[e.kind] || 0) + 1);
  el.innerHTML = `
    <button class="btn ${tlFilter ? 'btn-ghost' : 'btn-teal'} btn-xs" onclick="setTLFilter('')">
      Semua (${tlEvents.length})</button>
    ${Object.entries(counts).map(([k, n]) => {
      const t = TL_KIND[k] || { label: k, c: '#6B7A8B' };
      return `<button class="btn ${tlFilter === k ? 'btn-teal' : 'btn-ghost'} btn-xs"
        onclick="setTLFilter('${k}')">${t.label} (${n})</button>`;
    }).join('')}`;
}

function setTLFilter(k) { tlFilter = k; paintTimelineFilter(); paintTimeline(); }

function paintTimeline() {
  const el = document.getElementById('tl-body'); if (!el) return;
  const list = tlFilter ? tlEvents.filter(e => e.kind === tlFilter) : tlEvents;

  if (!list.length) {
    el.innerHTML = `<div class="empty-state" style="padding:30px"><div class="ico">🕒</div>
      <h3>Belum ada riwayat</h3></div>`;
    return;
  }

  // Kelompokkan per tanggal agar urutan harinya terbaca
  const byDay = {};
  list.forEach(e => {
    const d = new Date(e.at).toISOString().split('T')[0];
    (byDay[d] = byDay[d] || []).push(e);
  });

  el.innerHTML = Object.entries(byDay).map(([d, items]) => `
    <div style="margin-bottom:16px">
      <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;
        text-transform:uppercase;color:var(--gray);margin-bottom:8px;position:sticky;top:0;
        background:#fff;padding:3px 0;z-index:2">${formatDateShort(d)}</div>
      <div style="border-left:2px solid var(--border);padding-left:14px;margin-left:5px">
        ${items.map(e => {
          const t = TL_KIND[e.kind] || { label: e.kind, icon: 'list', c: '#6B7A8B' };
          const jam = new Date(e.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          return `<div style="position:relative;padding:8px 0 10px">
            <span style="position:absolute;left:-21px;top:11px;width:11px;height:11px;border-radius:50%;
              background:${t.c};border:2px solid #fff;box-shadow:0 0 0 1px ${t.c}55"></span>
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
              <span style="color:${t.c};line-height:0">${typeof icon === 'function' ? icon(t.icon, 14) : ''}</span>
              <span style="font-size:10.5px;font-weight:700;color:${t.c};text-transform:uppercase;
                letter-spacing:.05em">${t.label}</span>
              <span style="font-size:11px;color:var(--gray);font-variant-numeric:tabular-nums">${jam}</span>
              ${e.extra ? `<span style="font-size:11px;color:var(--gray)">· ${e.extra}</span>` : ''}
            </div>
            <div style="font-size:13px;font-weight:600;margin-top:2px">${e.title}</div>
            ${e.detail ? `<div style="font-size:12px;color:var(--text2);margin-top:1px">${e.detail}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}