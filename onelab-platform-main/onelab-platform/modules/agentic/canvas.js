// ═══════════════════════════════════════════════════════════════
// MODULE: KANVAS ORKESTRATOR AGENTIC (gaya Obsidian Graph)
//
// Menggantikan tab "Orchestrator & A2A" yang lama, yang menampilkan data
// KARANGAN: daftar agen diketik langsung di orchestrator.js, semua status
// 'ACTIVE', dan angka closedLoopCount (1420, 890, …) hanyalah angka yang
// diketik. Layar itu tampak seperti pemantauan langsung padahal tidak
// membaca apa pun — jenis kebohongan paling berbahaya di panel monitoring,
// karena orang mengambil keputusan berdasarkan angka yang tidak ada.
//
// Kanvas ini membaca agentic.agents / tasks / agent_messages / task_events
// lewat satu RPC (agentic_canvas). Bila kosong, ia MENGATAKAN kosong.
//
// Empat lapis sesuai kebutuhan pemantauan:
//   1. Node agen        — siapa (nama, peran, tier model)
//   2. State & eksekusi — sedang mengerjakan apa (aktif/antre/gagal)
//   3. Aliran data      — jalur delegasi A2A + hubungan induk-anak tugas
//   4. Log monitor      — jejak perpindahan status tiap keputusan
//
// SVG murni tanpa pustaka eksternal: aplikasi ini berjalan offline di
// komputer klinik, dan menambah dependensi CDN akan mematikannya di sana.
// ═══════════════════════════════════════════════════════════════

let agkData = null;
let agkPilih = null;         // kode agen yang dipilih
let agkTimer = null;
let agkRentang = 24;         // jam

const AGK_WARNA = {
  sibuk:  '#38BDF8',   // ada tugas berjalan
  antre:  '#F59E0B',   // ada antrean, belum jalan
  gagal:  '#EF4444',   // ada kegagalan dalam rentang
  diam:   '#64748B',   // tidak ada aktivitas
  nonaktif: '#475569',
};

function agkStatusAgen(a) {
  if (!a.active) return 'nonaktif';
  if (a.gagal > 0) return 'gagal';
  if (a.aktif > 0) return 'sibuk';
  if (a.antre > 0) return 'antre';
  return 'diam';
}

// ── Tata letak hierarkis dari reports_to ────────────────────────
// Dipilih ketimbang tata letak acak/gaya-pegas karena hierarki agen memang
// ADA di data. Menampilkan struktur yang sesungguhnya lebih berguna
// daripada gumpalan node yang terlihat canggih tapi tidak berarti apa-apa.
function agkTataLetak(agents, lebar, tinggi) {
  const anak = new Map();
  const akar = [];
  agents.forEach(a => {
    if (a.reports_to && agents.some(x => x.code === a.reports_to)) {
      if (!anak.has(a.reports_to)) anak.set(a.reports_to, []);
      anak.get(a.reports_to).push(a);
    } else akar.push(a);
  });

  const tingkat = [];
  let kini = akar;
  let batas = 0;
  while (kini.length && batas++ < 8) {           // batas: cegah siklus reports_to
    tingkat.push(kini);
    kini = kini.flatMap(a => anak.get(a.code) || []);
  }

  const posisi = new Map();
  const padY = 70;
  const jarakY = tingkat.length > 1 ? (tinggi - padY * 2) / (tingkat.length - 1) : 0;
  tingkat.forEach((baris, iy) => {
    const jarakX = lebar / (baris.length + 1);
    baris.forEach((a, ix) => {
      posisi.set(a.code, { x: jarakX * (ix + 1), y: padY + jarakY * iy });
    });
  });
  // Agen yang tidak masuk hierarki (siklus/ganda) tetap ditampilkan di bawah.
  agents.filter(a => !posisi.has(a.code)).forEach((a, i, arr) => {
    posisi.set(a.code, { x: lebar / (arr.length + 1) * (i + 1), y: tinggi - 40 });
  });
  return posisi;
}

async function agkMuat() {
  try {
    const d = await agRpc('agentic_canvas', { p_jam: agkRentang });
    agkData = d && typeof d === 'object' ? d : null;
  } catch (e) {
    agkData = { _galat: e.message || String(e) };
  }
}

function renderAgCanvasTab() {
  const c = document.getElementById('ag-tab-content');
  if (!c) return;
  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <strong style="font-size:14px">Kanvas Orkestrator</strong>
      <span style="font-size:12px;color:var(--text3)">Node agen, status, jalur delegasi, dan jejak keputusan</span>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <select id="agk-rentang" onchange="agkUbahRentang(this.value)"
                style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;
                       padding:6px 10px;font-size:12px;color:var(--text)">
          <option value="6">6 jam</option>
          <option value="24" selected>24 jam</option>
          <option value="72">3 hari</option>
          <option value="168">7 hari</option>
        </select>
        <label style="font-size:12px;color:var(--text3);display:flex;align-items:center;gap:5px">
          <input type="checkbox" id="agk-live" onchange="agkToggleLive(this.checked)"> Pantau langsung
        </label>
        <button class="btn btn-ghost btn-sm" onclick="agkSegarkan()">Muat Ulang</button>
      </div>
    </div>
    <div id="agk-isi"><div class="loading-row"><div class="spinner"></div></div></div>`;

  agkSegarkan();
}

async function agkSegarkan() {
  await agkMuat();
  agkGambar();
}

function agkUbahRentang(v) { agkRentang = parseInt(v, 10) || 24; agkSegarkan(); }

function agkToggleLive(on) {
  if (agkTimer) { clearInterval(agkTimer); agkTimer = null; }
  // 15 detik: cukup terasa "langsung" tanpa memukul basis data terus-menerus.
  if (on) agkTimer = setInterval(agkSegarkan, 15000);
}

function agkGambar() {
  const wrap = document.getElementById('agk-isi');
  if (!wrap) { if (agkTimer) { clearInterval(agkTimer); agkTimer = null; } return; }

  if (agkData && agkData._galat) {
    wrap.innerHTML = `<div class="card" style="padding:18px;border-color:rgba(239,68,68,.4)">
      <strong style="color:#f87171">Gagal memuat kanvas</strong>
      <div style="font-size:12.5px;color:var(--text3);margin-top:6px">${agkData._galat}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:10px">
        Jalankan migrasi <code>0010_agentic_canvas.sql</code> bila RPC belum tersedia.</div></div>`;
    return;
  }

  const agents = (agkData && agkData.agents) || [];
  const tasks  = (agkData && agkData.tasks)  || [];
  const edges  = (agkData && agkData.edges)  || [];
  const events = (agkData && agkData.events) || [];

  if (!agents.length) {
    wrap.innerHTML = `<div class="card" style="padding:26px;text-align:center">
      <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">Belum ada agen terdaftar</div>
      <div style="font-size:12.5px;color:var(--text3);line-height:1.6">
        Kanvas ini membaca tabel <code>agentic.agents</code> yang sesungguhnya.<br>
        Selama belum ada agen yang terdaftar, tidak ada yang bisa ditampilkan —
        dan menampilkan node contoh hanya akan menyesatkan.</div></div>`;
    return;
  }

  const W = 900, H = Math.max(340, 120 + agents.length * 26);
  const pos = agkTataLetak(agents, W, H);

  // Garis hierarki (reports_to) — tipis, sebagai latar struktur.
  const garisHier = agents.filter(a => a.reports_to && pos.has(a.reports_to)).map(a => {
    const p = pos.get(a.reports_to), q = pos.get(a.code);
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"
      stroke="var(--border2)" stroke-width="1" stroke-dasharray="3 4" opacity=".55"/>`;
  }).join('');

  // Jalur delegasi A2A — tebalnya mengikuti jumlah pesan.
  const maks = Math.max(1, ...edges.map(e => e.jumlah || 1));
  const garisA2A = edges.filter(e => pos.has(e.dari) && pos.has(e.ke)).map(e => {
    const p = pos.get(e.dari), q = pos.get(e.ke);
    const w = 1 + (e.jumlah / maks) * 3.5;
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"
      stroke="#38BDF8" stroke-width="${w.toFixed(1)}" opacity=".45" marker-end="url(#agk-panah)">
      <title>${e.dari} → ${e.ke} · ${e.jumlah} pesan (${e.jenis})</title></line>`;
  }).join('');

  const node = agents.map(a => {
    const p = pos.get(a.code);
    const st = agkStatusAgen(a);
    const r = 15 + Math.min(11, (a.aktif + a.antre) * 2.2);
    const dipilih = agkPilih === a.code;
    return `<g class="agk-node" style="cursor:pointer" onclick="agkPilihAgen('${a.code}')">
      ${st === 'sibuk' ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 7}" fill="${AGK_WARNA.sibuk}" opacity=".14">
        <animate attributeName="r" values="${r + 4};${r + 12};${r + 4}" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".20;.03;.20" dur="2.4s" repeatCount="indefinite"/></circle>` : ''}
      <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${AGK_WARNA[st]}"
        stroke="${dipilih ? '#fff' : 'rgba(255,255,255,.30)'}" stroke-width="${dipilih ? 2.5 : 1.2}"/>
      <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-weight="800"
        fill="#0B1220">${a.aktif || ''}</text>
      <text x="${p.x}" y="${p.y + r + 15}" text-anchor="middle" font-size="10.5"
        fill="var(--text2)" font-weight="600">${a.code}</text>
      <title>${a.name} — ${a.role}\naktif ${a.aktif} · antre ${a.antre} · selesai ${a.selesai} · gagal ${a.gagal}</title>
    </g>`;
  }).join('');

  const legenda = Object.entries({ sibuk: 'Berjalan', antre: 'Antre', gagal: 'Ada gagal', diam: 'Diam', nonaktif: 'Nonaktif' })
    .map(([k, t]) => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text3)">
      <span style="width:9px;height:9px;border-radius:50%;background:${AGK_WARNA[k]}"></span>${t}</span>`).join('');

  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start">
      <div class="card" style="padding:10px">
        <div style="display:flex;gap:14px;flex-wrap:wrap;padding:2px 4px 10px">${legenda}</div>
        <div style="overflow:auto">
          <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;min-height:320px;display:block">
            <defs><marker id="agk-panah" viewBox="0 0 10 10" refX="26" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#38BDF8" opacity=".7"/></marker></defs>
            ${garisHier}${garisA2A}${node}
          </svg>
        </div>
        <div style="font-size:11.5px;color:var(--text3);padding:6px 4px 2px">
          Garis putus-putus = garis pelaporan · garis biru = delegasi A2A (tebal = lebih sering) ·
          ukuran node = beban tugas · data ${agkRentang} jam terakhir
        </div>
      </div>
      <div id="agk-panel">${agkPanel(agents, tasks, events)}</div>
    </div>
    <div class="card" style="margin-top:14px;padding:0;overflow:hidden">
      <div style="padding:11px 14px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:center">
        <strong style="font-size:13px">Log Monitor</strong>
        <span style="font-size:11.5px;color:var(--text3)">jejak perpindahan status — ${events.length} peristiwa</span>
      </div>
      ${events.length ? `<div style="max-height:260px;overflow:auto">
        ${events.map(ev => `<div style="display:flex;gap:10px;padding:7px 14px;border-top:1px solid var(--line);font-size:12px">
          <span style="color:var(--text3);white-space:nowrap">${new Date(ev.waktu).toLocaleTimeString('id-ID')}</span>
          <span style="font-family:monospace;color:var(--text3)">${ev.pelaku}</span>
          <span><span style="color:var(--text3)">${ev.dari || '—'}</span>
                <span style="color:#38BDF8">→</span> <strong>${ev.ke}</strong></span>
          <span style="color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ev.catatan || ''}</span>
        </div>`).join('')}</div>`
        : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12.5px">
             Belum ada peristiwa dalam ${agkRentang} jam terakhir.</div>`}
    </div>`;
}

function agkPanel(agents, tasks, events) {
  if (!agkPilih) {
    const totalAktif = agents.reduce((s, a) => s + a.aktif, 0);
    const totalAntre = agents.reduce((s, a) => s + a.antre, 0);
    const totalGagal = agents.reduce((s, a) => s + a.gagal, 0);
    return `<div class="card" style="padding:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Ringkasan</div>
      ${[['Agen terdaftar', agents.length], ['Tugas berjalan', totalAktif],
         ['Tugas antre', totalAntre], ['Gagal (${jam} jam)'.replace('${jam}', agkRentang), totalGagal],
         ['Jalur delegasi', ((agkData && agkData.edges) || []).length]]
        .map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">
          <span style="font-size:12.5px;color:var(--text3)">${k}</span>
          <strong style="font-size:12.5px">${v}</strong></div>`).join('')}
      <div style="font-size:12px;color:var(--text3);margin-top:12px;line-height:1.6">
        Klik sebuah node untuk melihat piagam agen, tugas aktifnya, dan jejak keputusannya.</div>
    </div>`;
  }

  const a = agents.find(x => x.code === agkPilih);
  if (!a) return '';
  const milik = tasks.filter(t => t.agent === a.code).slice(0, 8);
  const idMilik = new Set(milik.map(t => t.id));
  const jejak = events.filter(e => idMilik.has(e.task_id)).slice(0, 8);

  return `<div class="card" style="padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
      <div><div style="font-size:13.5px;font-weight:800">${a.name}</div>
        <div style="font-size:12px;color:var(--text3)">${a.role}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="agkPilihAgen(null)">✕</button>
    </div>
    <div style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap">
      <span class="badge">${a.tier}</span>
      <span class="badge">${a.active ? 'aktif' : 'nonaktif'}</span>
      ${a.reports_to ? `<span class="badge">↑ ${a.reports_to}</span>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      ${[['aktif', a.aktif, AGK_WARNA.sibuk], ['antre', a.antre, AGK_WARNA.antre],
         ['selesai', a.selesai, '#34D399'], ['gagal', a.gagal, AGK_WARNA.gagal]]
        .map(([l, v, c]) => `<div style="text-align:center;background:var(--bg2);border-radius:8px;padding:7px 3px">
          <div style="font-size:15px;font-weight:800;color:${c}">${v}</div>
          <div style="font-size:10px;color:var(--text3)">${l}</div></div>`).join('')}
    </div>
    ${a.charter ? `<div style="font-size:11.5px;color:var(--text3);line-height:1.6;margin-bottom:12px">
      <strong style="color:var(--text2)">Piagam.</strong> ${a.charter}</div>` : ''}

    <div style="font-size:12px;font-weight:700;margin-bottom:6px">Tugas terkini</div>
    ${milik.length ? milik.map(t => `
      <div style="border-top:1px solid var(--line);padding:7px 0;font-size:11.5px">
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge" style="font-size:9.5px">${t.status}</span>
          ${t.induk ? '<span style="font-size:10px;color:#38BDF8" title="tugas turunan dari delegasi">↳ delegasi</span>' : ''}
          ${t.perlu_review ? '<span style="font-size:10px;color:#F59E0B">perlu review manusia</span>' : ''}
        </div>
        <div style="margin-top:3px">${t.judul || t.jenis}</div>
        <div style="color:var(--text3);font-size:10.5px;margin-top:2px">
          ${t.ada_masukan ? 'ada masukan' : 'tanpa masukan'} ·
          ${t.ada_keluaran ? 'ada keluaran' : 'belum ada keluaran'}
          ${t.galat ? ` · <span style="color:#f87171">${t.galat}</span>` : ''}
        </div>
      </div>`).join('')
      : `<div style="font-size:11.5px;color:var(--text3);padding:6px 0">Tidak ada tugas dalam rentang ini.</div>`}

    ${jejak.length ? `<div style="font-size:12px;font-weight:700;margin:12px 0 6px">Jejak keputusan</div>
      ${jejak.map(e => `<div style="font-size:11px;color:var(--text3);padding:3px 0">
        ${new Date(e.waktu).toLocaleString('id-ID')} · ${e.dari || '—'} → <strong style="color:var(--text2)">${e.ke}</strong>
        ${e.catatan ? ' · ' + e.catatan : ''}</div>`).join('')}` : ''}
  </div>`;
}

function agkPilihAgen(code) {
  agkPilih = (code === agkPilih) ? null : code;
  agkGambar();
}

window.renderAgCanvasTab = renderAgCanvasTab;
window.agkSegarkan = agkSegarkan;
window.agkPilihAgen = agkPilihAgen;
window.agkToggleLive = agkToggleLive;
window.agkUbahRentang = agkUbahRentang;
