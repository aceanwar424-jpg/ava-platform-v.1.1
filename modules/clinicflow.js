// ═══════════════════════════════════════════════════════════════
// MODULE: Alur Klinik — Antrian & Perjanjian (Fase 3.5 & 3.6)
// Menutup temuan audit: kata "antrian" sebelumnya hanya label hitungan
// pendaftaran, tanpa nomor, urutan panggil, maupun layar tunggu.
// ═══════════════════════════════════════════════════════════════

const QUEUE_SERVICES = ['Lab','Radiologi','Dokter','Kasir'];
const Q_STATUS = {
  'Menunggu': {c:'#B45309', bg:'#FBF1E4'},
  'Dipanggil':{c:'#0E7C86', bg:'#E6F2F3'},
  'Dilayani': {c:'#123A5C', bg:'#EAF0F6'},
  'Selesai':  {c:'#15803D', bg:'#E8F5EC'},
  'Lewat':    {c:'#B91C1C', bg:'#FBEAEA'},
};

let qTickets = [], qService = '';

// ══════════════════════════════════════════════════════════════
// ANTRIAN
// ══════════════════════════════════════════════════════════════
async function renderQueuePage() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Antrian</h1><p>Nomor antrian harian per layanan, panggil, dan lewati</p></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="openQueueDisplay()">🖥️ Layar Ruang Tunggu</button>
        <button class="btn btn-teal" onclick="openQueueForm()">+ Ambil Nomor</button>
      </div>
    </div>
    <div class="tabs" id="q-tabs" style="margin-bottom:14px">
      <button class="tab-btn active" onclick="filterQueue('',this)">Semua</button>
      ${QUEUE_SERVICES.map(s=>`<button class="tab-btn" onclick="filterQueue('${s}',this)">${s}</button>`).join('')}
    </div>
    <div id="q-kpi" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px"></div>
    <div id="q-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadQueue();
}

async function loadQueue() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await sbGet('queue_tickets', `select=*&queue_date=eq.${today}&order=seq.asc`);
    qTickets = Array.isArray(data) ? data : [];
    paintQueue();
  } catch(e) {
    document.getElementById('q-content').innerHTML =
      `<div class="status-box status-warn">Tabel antrian belum ada — jalankan <code>supabase_fase3.sql</code>.</div>`;
  }
}

function filterQueue(svc, btn) {
  qService = svc;
  document.querySelectorAll('#q-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  paintQueue();
}

function paintQueue() {
  const list = qService ? qTickets.filter(t=>t.service_type===qService) : qTickets;
  const kpi = document.getElementById('q-kpi');
  if (kpi) {
    const menunggu = list.filter(t=>t.status==='Menunggu').length;
    const dilayani = list.filter(t=>['Dipanggil','Dilayani'].includes(t.status)).length;
    const selesai  = list.filter(t=>t.status==='Selesai').length;
    const skrg     = list.filter(t=>t.status==='Dipanggil').slice(-1)[0];
    kpi.innerHTML = [
      {l:'Sedang Dipanggil', v:skrg?skrg.queue_number:'—', c:'#0E7C86'},
      {l:'Menunggu', v:menunggu, c:'#B45309'},
      {l:'Dilayani', v:dilayani, c:'#123A5C'},
      {l:'Selesai',  v:selesai,  c:'#15803D'},
    ].map(k=>`<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${k.c};
      border-radius:10px;padding:12px">
      <div style="font-size:20px;font-weight:800;color:${k.c};font-variant-numeric:tabular-nums">${k.v}</div>
      <div style="font-size:10.5px;color:var(--gray)">${k.l}</div></div>`).join('');
  }

  const el = document.getElementById('q-content'); if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">🎫</div>
      <h3>Belum ada antrian hari ini</h3>
      <button class="btn btn-teal" style="margin-top:10px" onclick="openQueueForm()">+ Ambil Nomor</button></div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>No.</th><th>Layanan</th><th>Pasien</th><th>Status</th><th>Dipanggil</th><th>Aksi</th>
  </tr></thead><tbody>${list.map(t=>{
    const st = Q_STATUS[t.status]||Q_STATUS['Menunggu'];
    return `<tr>
      <td style="font-family:ui-monospace,monospace;font-size:15px;font-weight:800;color:var(--navy)">${t.queue_number}</td>
      <td style="font-size:12.5px">${t.service_type}</td>
      <td>${t.patient_name||'—'}</td>
      <td><span style="background:${st.bg};color:${st.c};padding:3px 9px;border-radius:5px;
        font-size:11px;font-weight:700">${t.status}</span></td>
      <td style="font-size:11.5px;color:var(--gray)">${t.called_at?new Date(t.called_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
      <td><div class="act-row">
        ${t.status==='Menunggu'?`<button class="btn btn-teal btn-xs" onclick="callTicket(${t.id})">📢 Panggil</button>`:''}
        ${t.status==='Dipanggil'?`<button class="btn btn-teal btn-xs" onclick="setTicket(${t.id},'Dilayani')">Mulai</button>
          <button class="btn btn-ghost btn-xs" onclick="callTicket(${t.id})">Panggil ulang</button>
          <button class="btn btn-ghost btn-xs" style="color:#B91C1C" onclick="setTicket(${t.id},'Lewat')">Lewati</button>`:''}
        ${t.status==='Dilayani'?`<button class="btn btn-teal btn-xs" onclick="setTicket(${t.id},'Selesai')">Selesai</button>`:''}
      </div></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function openQueueForm() {
  openModal(`
    <div class="modal-header"><div class="modal-title">🎫 Ambil Nomor Antrian</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-group"><label>Layanan *</label>
      <select id="qf-svc">${QUEUE_SERVICES.map(s=>`<option>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>Nama Pasien</label>
      <input type="text" id="qf-name" placeholder="Opsional — boleh dikosongkan"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="issueTicket()">🎫 Terbitkan</button>
    </div>`);
}

async function issueTicket() {
  try {
    // Nomor diterbitkan di server dengan advisory lock — dua loket bersamaan
    // tidak akan mendapat nomor kembar.
    const res = await sbRpc('issue_queue_ticket', {
      p_service: document.getElementById('qf-svc').value,
      p_patient: document.getElementById('qf-name').value.trim() || null,
    });
    toast(`🎫 Nomor ${res?.queue_number||''} diterbitkan`,'ok');
    closeModalForce(); await loadQueue();
  } catch(e) {
    toast('❌ '+(/not find the function/i.test(e.message)?'Jalankan supabase_fase3.sql dulu':e.message),'err');
  }
}

async function callTicket(id) {
  try {
    await sbPatch('queue_tickets', id, { status:'Dipanggil', called_at:new Date().toISOString(), updated_at:new Date().toISOString() });
    await loadQueue();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function setTicket(id, status) {
  const patch = { status, updated_at:new Date().toISOString() };
  if (status==='Dilayani') patch.served_at = new Date().toISOString();
  try { await sbPatch('queue_tickets', id, patch); await loadQueue(); }
  catch(e) { toast('❌ '+e.message,'err'); }
}

// Layar ruang tunggu — dibuka di tab terpisah untuk ditampilkan di TV
function openQueueDisplay() {
  const svc = qService || '';
  const now = qTickets.filter(t=>t.status==='Dipanggil' && (!svc||t.service_type===svc)).slice(-1)[0];
  const next = qTickets.filter(t=>t.status==='Menunggu' && (!svc||t.service_type===svc)).slice(0,5);
  const w = window.open('','_blank');
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
    <title>Antrian${svc?' — '+svc:''}</title>
    <meta http-equiv="refresh" content="15">
    <style>
      body{margin:0;font-family:system-ui,sans-serif;background:#0D1520;color:#E6EDF5;
        display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
      .lbl{font-size:18px;letter-spacing:.2em;text-transform:uppercase;color:#7F8FA0}
      .no{font-size:22vw;font-weight:800;line-height:1;letter-spacing:-.03em;color:#3FB3BC;
        font-variant-numeric:tabular-nums}
      .pt{font-size:28px;margin-top:8px;color:#AEBDCC}
      .nx{margin-top:48px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
      .nx div{background:#131E2B;border:1px solid #243243;border-radius:10px;
        padding:12px 20px;font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
      .ft{position:fixed;bottom:16px;font-size:13px;color:#7F8FA0}
    </style></head><body>
    <div class="lbl">Nomor Dipanggil${svc?' · '+svc:''}</div>
    <div class="no">${now?now.queue_number:'—'}</div>
    <div class="pt">${now?(now.patient_name||''):'Menunggu panggilan berikutnya'}</div>
    ${next.length?`<div class="lbl" style="margin-top:40px;font-size:14px">Berikutnya</div>
      <div class="nx">${next.map(t=>`<div>${t.queue_number}</div>`).join('')}</div>`:''}
    <div class="ft">Layar diperbarui otomatis setiap 15 detik</div>
    </body></html>`);
  w.document.close();
}

// ══════════════════════════════════════════════════════════════
// PERJANJIAN / BOOKING
// ══════════════════════════════════════════════════════════════
let apptAll = [];

async function renderAppointments() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Perjanjian</h1><p>Jadwalkan kunjungan pasien beserta pengingatnya</p></div>
      <button class="btn btn-teal" onclick="openApptForm()">+ Buat Perjanjian</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input type="date" class="table-filter" id="ap-from" value="${today}" onchange="loadAppointments()">
      <span style="align-self:center;color:var(--gray)">s/d</span>
      <input type="date" class="table-filter" id="ap-to"
        value="${new Date(Date.now()+14*86400000).toISOString().split('T')[0]}" onchange="loadAppointments()">
      <input class="table-search" id="ap-q" placeholder="🔍 Cari pasien..." oninput="paintAppointments()" style="flex:1;min-width:180px">
    </div>
    <div id="ap-content"><div class="loading-row"><div class="spinner"></div></div></div>`;
  await loadAppointments();
}

async function loadAppointments() {
  const from = document.getElementById('ap-from')?.value;
  const to   = document.getElementById('ap-to')?.value;
  try {
    const data = await sbGet('appointments',
      `select=*&scheduled_at=gte.${from}T00:00:00&scheduled_at=lte.${to}T23:59:59&order=scheduled_at.asc`);
    apptAll = Array.isArray(data)?data:[];
    paintAppointments();
  } catch(e) {
    document.getElementById('ap-content').innerHTML =
      `<div class="status-box status-warn">Tabel perjanjian belum ada — jalankan <code>supabase_fase3.sql</code>.</div>`;
  }
}

function paintAppointments() {
  const el = document.getElementById('ap-content'); if (!el) return;
  const q = (document.getElementById('ap-q')?.value||'').toLowerCase();
  const list = apptAll.filter(a=>!q || (a.patient_name||'').toLowerCase().includes(q));
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="ico">📅</div><h3>Belum ada perjanjian</h3></div>`;
    return;
  }
  const stCol = {'Terjadwal':'#0E7C86','Hadir':'#15803D','Tidak Hadir':'#B91C1C','Batal':'#6B7A8B'};
  // Kelompokkan per tanggal
  const byDay = {};
  list.forEach(a=>{ const d=(a.scheduled_at||'').split('T')[0]; (byDay[d]=byDay[d]||[]).push(a); });

  el.innerHTML = Object.entries(byDay).map(([d,items])=>`
    <div style="margin-bottom:18px">
      <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;
        text-transform:uppercase;color:var(--gray);margin-bottom:8px">${formatDateShort(d)} · ${items.length} perjanjian</div>
      ${items.map(a=>{
        const t = a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '—';
        const wa = a.patient_phone ? `https://wa.me/${a.patient_phone.replace(/\D/g,'').replace(/^0/,'62')}?text=${encodeURIComponent(`Halo ${a.patient_name}, mengingatkan perjanjian Anda di OneLab Diagnostics pada ${formatDateShort(d)} pukul ${t} untuk layanan ${a.service_type||''}. Terima kasih.`)}` : '';
        return `<div class="card" style="padding:12px 14px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <div style="display:flex;gap:12px;align-items:center">
              <div style="font-family:ui-monospace,monospace;font-size:16px;font-weight:800;color:var(--navy)">${t}</div>
              <div>
                <div style="font-weight:650">${a.patient_name||'—'}</div>
                <div style="font-size:11.5px;color:var(--gray)">${a.service_type||'—'}${a.resource?' · '+a.resource:''}${a.mr_number?' · '+a.mr_number:''}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="background:${stCol[a.status]||'#6B7A8B'}18;color:${stCol[a.status]||'#6B7A8B'};
                padding:3px 9px;border-radius:5px;font-size:11px;font-weight:700">${a.status}</span>
              ${wa?`<a href="${wa}" target="_blank" class="btn btn-ghost btn-xs" style="color:#15803D"
                onclick="markReminded(${a.id})">💬 Ingatkan</a>`:''}
              ${a.status==='Terjadwal'?`
                <button class="btn btn-teal btn-xs" onclick="setAppt(${a.id},'Hadir')">Hadir</button>
                <button class="btn btn-ghost btn-xs" onclick="setAppt(${a.id},'Tidak Hadir')">Tidak hadir</button>
                <button class="btn btn-ghost btn-xs" style="color:#B91C1C" onclick="setAppt(${a.id},'Batal')">Batal</button>`:''}
            </div>
          </div>
          ${a.reminder_sent_at?`<div style="font-size:10.5px;color:var(--gray);margin-top:4px">
            Pengingat terkirim ${new Date(a.reminder_sent_at).toLocaleString('id-ID')}</div>`:''}
        </div>`;
      }).join('')}
    </div>`).join('');
}

function openApptForm() {
  const now = new Date(Date.now() - new Date().getTimezoneOffset()*60000);
  openModal(`
    <div class="modal-header"><div class="modal-title">📅 Buat Perjanjian</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button></div>
    <div class="form-row">
      <div class="form-group"><label>Nama Pasien *</label><input type="text" id="af2-name"></div>
      <div class="form-group"><label>No. HP / WA</label><input type="text" id="af2-phone" placeholder="08xxxxxxxxxx"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>No. Rekam Medis</label><input type="text" id="af2-mr" placeholder="MR-xxxxxxxx (opsional)"></div>
      <div class="form-group"><label>Layanan *</label>
        <select id="af2-svc">${['Lab','Radiologi','Dokter','MCU','Home Care','Lainnya'].map(s=>`<option>${s}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Waktu *</label>
        <input type="datetime-local" id="af2-at" value="${now.toISOString().slice(0,16)}"></div>
      <div class="form-group"><label>Durasi (menit)</label><input type="number" id="af2-dur" value="30"></div>
    </div>
    <div class="form-group"><label>Dokter / Alat / Ruang</label><input type="text" id="af2-res" placeholder="Opsional"></div>
    <div class="form-group"><label>Catatan</label><textarea id="af2-notes" rows="2"></textarea></div>
    <div id="af2-clash"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveAppt()">💾 Simpan</button>
    </div>`, 'wide');
}

async function saveAppt() {
  const name = document.getElementById('af2-name').value.trim();
  const at   = document.getElementById('af2-at').value;
  if (!name) { toast('Nama pasien wajib diisi','err'); return; }
  if (!at)   { toast('Waktu perjanjian wajib diisi','err'); return; }

  const res = document.getElementById('af2-res').value.trim();
  const iso = new Date(at).toISOString();

  // Peringatkan bila sumber daya yang sama sudah dipakai pada jam itu
  if (res) {
    const clash = apptAll.filter(a=>a.resource===res && a.scheduled_at===iso && a.status==='Terjadwal');
    if (clash.length && !confirm(`${res} sudah punya perjanjian pada waktu tersebut (${clash[0].patient_name}). Tetap simpan?`)) return;
  }

  try {
    await sbPost('appointments', {
      patient_name: name,
      patient_phone: document.getElementById('af2-phone').value.trim()||null,
      mr_number: document.getElementById('af2-mr').value.trim()||null,
      service_type: document.getElementById('af2-svc').value,
      resource: res||null,
      scheduled_at: iso,
      duration_min: parseInt(document.getElementById('af2-dur').value)||30,
      status:'Terjadwal',
      notes: document.getElementById('af2-notes').value.trim()||null,
      created_by: getUserName?getUserName():'User',
      updated_at: new Date().toISOString(),
    });
    toast('✅ Perjanjian dibuat','ok');
    closeModalForce(); await loadAppointments();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function setAppt(id, status) {
  try {
    await sbPatch('appointments', id, { status, updated_at:new Date().toISOString() });
    toast(`Status → ${status}`,'ok'); await loadAppointments();
  } catch(e) { toast('❌ '+e.message,'err'); }
}

async function markReminded(id) {
  try { await sbPatch('appointments', id, { reminder_sent_at:new Date().toISOString() }); await loadAppointments(); }
  catch(e) { /* pengingat tetap terkirim walau penandaan gagal */ }
}
