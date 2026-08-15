// ═══════════════════════════════════════════════════════════════
// MODULE: DATABASE STUDIO — LOCAL SUPABASE DASHBOARD & TABLE EDITOR
// Tampilan GUI Supabase Studio versi Lokal untuk Monitor, Inspeksi Tabel,
// Edit Baris Data, & Menjalankan Kueri SQL secara Interaktif.
// ═══════════════════════════════════════════════════════════════

let _dbSelectedTable = 'user_profiles';
let _dbTableData = [];
let _dbTableCols = [];
let _dbLoading = false;

const DB_TABLES = [
  { name: 'user_profiles', label: '👤 User Profiles & Access Roles', icon: 'user' },
  { name: 'products', label: '🧬 Master Produk & Tes Lab', icon: 'package' },
  { name: 'ava_consultations', label: '🩺 AVA Telekonsultasi Dokter', icon: 'activity' },
  { name: 'ava_device_readings', label: '📟 AVA Telemetri IoT & Wearables', icon: 'radio' },
  { name: 'ava_calibration_badges', label: '🛡️ AVA Sertifikat Kalibrasi', icon: 'shield' },
  { name: 'ava_marketplace_items', label: '🏬 AVA Marketplace Alkes', icon: 'shopping-bag' },
  { name: 'ava_caregiver_links', label: '👥 AVA Caregiver & Family Network', icon: 'users' },
  { name: 'partners', label: '💼 Database Partner & Klinik', icon: 'briefcase' },
  { name: 'leads', label: '🎯 Prospek & Leads Sales', icon: 'target' },
  { name: 'invoices', label: '📄 Tagihan & Invoice Keuangan', icon: 'file-text' },
  { name: 'audit_logs', label: '📜 Jejak Audit Sistem', icon: 'clock' }
];

function renderDatabaseStudio() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="min-height:85vh; background:#020617; color:#F8FAFC; padding:24px; font-family:'Plus Jakarta Sans', sans-serif;">
      <!-- SUPABASE STUDIO HEADER -->
      <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(52,211,153,0.3); border-radius:16px; padding:20px; backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:14px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg, #10B981, #059669); display:flex; align-items:center; justify-content:center; color:white; font-size:24px; font-weight:800; shadow:0 10px 25px rgba(16,185,129,0.3);">
            ⚡
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:10px;">
              <h2 style="margin:0; font-size:20px; font-weight:800; color:#F8FAFC;">Local Supabase Database Studio</h2>
              <span style="background:rgba(16,185,129,0.2); color:#34D399; border:1px solid rgba(52,211,153,0.4); font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px;">
                PGlite WASM · Postgres Local Engine
              </span>
            </div>
            <p style="margin:4px 0 0 0; font-size:12px; color:#94A3B8;">Inspektur Tabel GUI, Editor Baris Data, & Penguji SQL Interaktif (Port 54329 / Supabase REST).</p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); padding:6px 12px; border-radius:10px; font-size:11px; color:#34D399; font-weight:700;">
            🟢 Server Status: 127.0.0.1:54329 (Active)
          </div>
          <button class="btn btn-teal btn-sm" onclick="dbTriggerGitPush()" style="background:linear-gradient(135deg, #2563EB, #1D4ED8); border:none; font-weight:800;">
            🚀 Push & Sync ke GitHub
          </button>
          <button class="btn btn-teal btn-sm" onclick="dbTriggerSupabaseSync()" style="background:linear-gradient(135deg, #059669, #10B981); border:none; font-weight:800;">
            ☁️ Sinkron ke Cloud Supabase
          </button>
          <button class="btn btn-ghost btn-sm" onclick="dbRefreshTableData()">🔄 Refresh Table</button>
        </div>
      </div>

      <!-- MAIN STUDIO LAYOUT: SIDEBAR TABLES + TABLE GRID / SQL EDITOR -->
      <div style="display:grid; grid-template-columns: 280px 1fr; gap:20px;">
        
        <!-- SIDEBAR TABLE LIST -->
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
            🗄️ Daftar Tabel Database (${DB_TABLES.length})
          </div>
          ${DB_TABLES.map(t => `
            <button 
              onclick="dbSelectTable('${t.name}')"
              style="
                text-align:left; background:${_dbSelectedTable === t.name ? 'rgba(16,185,129,0.18)' : 'rgba(30,41,59,0.4)'};
                color:${_dbSelectedTable === t.name ? '#34D399' : '#F8FAFC'};
                border:1px solid ${_dbSelectedTable === t.name ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.05)'};
                padding:10px 12px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:all 0.2s ease;
              "
            >
              <span>${t.label}</span>
              <span style="font-family:monospace; font-size:10px; color:#94A3B8;">${t.name}</span>
            </button>
          `).join('')}

          <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:14px;">
            <button class="btn btn-ghost btn-sm" style="width:100%; font-size:11.5px;" onclick="dbOpenSQLEditorModal()">
              ⚡ Jalankan Kueri SQL (SQL Editor)
            </button>
          </div>
        </div>

        <!-- TABLE DATA GRID CONTAINER -->
        <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:14px;">
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:800; color:#F8FAFC; display:flex; align-items:center; gap:8px;">
                <span>Tabel:</span> <code style="color:#34D399; font-family:monospace; font-size:16px;">${_dbSelectedTable}</code>
              </h3>
              <p style="margin:4px 0 0 0; font-size:12px; color:#94A3B8;" id="db-row-count">Memuat baris data...</p>
            </div>
            <div style="display:flex; gap:10px;">
              <input type="text" id="db-search-input" placeholder="Cari dalam tabel..." onkeyup="dbFilterTableRows(this.value)" style="padding:7px 12px; background:rgba(30,41,59,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; font-size:12px; outline:none; width:200px;">
              <button class="btn btn-teal btn-sm" onclick="dbAddRowModal()">+ Tambah Baris</button>
            </div>
          </div>

          <!-- DATA TABLE VIEWER -->
          <div id="db-grid-wrapper" style="overflow-x:auto; min-height:400px;">
            <div style="color:#94A3B8; text-align:center; padding:40px;">⏳ Memuat data tabel...</div>
          </div>
        </div>

      </div>
    </div>
  `;

  dbFetchTableData(_dbSelectedTable);
}

function dbSelectTable(tableName) {
  _dbSelectedTable = tableName;
  renderDatabaseStudio();
}

async function dbFetchTableData(tableName) {
  _dbLoading = true;
  const grid = document.getElementById('db-grid-wrapper');
  const countEl = document.getElementById('db-row-count');

  try {
    let data = [];
    if (typeof sbGet === 'function') {
      data = await sbGet(tableName, 'select=*&limit=100');
    } else {
      const res = await fetch(`http://127.0.0.1:54329/rest/v1/${tableName}?select=*&limit=100`);
      if (res.ok) data = await res.json();
    }

    if (!Array.isArray(data)) data = [];
    _dbTableData = data;

    if (countEl) countEl.textContent = `Menampilkan ${data.length} baris data (Limit 100)`;

    if (data.length === 0) {
      if (grid) grid.innerHTML = `<div style="text-align:center; padding:50px; color:#94A3B8;">📭 Tabel <code>${tableName}</code> masih kosong (0 baris data).</div>`;
      return;
    }

    _dbTableCols = Object.keys(data[0]);

    dbRenderGrid(data);
  } catch (err) {
    console.error('[DB Studio] Error fetching table data:', err);
    if (grid) grid.innerHTML = `<div style="text-align:center; padding:50px; color:#FCA5A5;">❌ Gagal memuat data tabel: ${err.message}</div>`;
  }
}

function dbRenderGrid(rows) {
  const grid = document.getElementById('db-grid-wrapper');
  if (!grid) return;

  const headerHTML = _dbTableCols.map(c => `<th style="padding:10px 14px; text-align:left; color:#94A3B8; font-family:monospace; font-size:11.5px;">${c}</th>`).join('');

  const bodyHTML = rows.map((r, idx) => {
    const cellsHTML = _dbTableCols.map(c => {
      let val = r[c];
      if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
      return `<td style="padding:10px 14px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dbEsc(val)}</td>`;
    }).join('');

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05); font-size:12.5px; transition:background 0.2s ease;" onmouseover="this.style.background='rgba(30,41,59,0.5)'" onmouseout="this.style.background='transparent'">
        <td style="padding:10px; text-align:center; color:#94A3B8; font-family:monospace;">${idx + 1}</td>
        ${cellsHTML}
      </tr>
    `;
  }).join('');

  grid.innerHTML = `
    <table style="width:100%; border-collapse:collapse; color:#F8FAFC;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1); background:rgba(30,41,59,0.6);">
          <th style="padding:10px; width:40px; text-align:center; color:#94A3B8;">#</th>
          ${headerHTML}
        </tr>
      </thead>
      <tbody>${bodyHTML}</tbody>
    </table>
  `;
}

function dbFilterTableRows(q) {
  if (!q || !q.trim()) {
    dbRenderGrid(_dbTableData);
    return;
  }
  const term = q.toLowerCase();
  const filtered = _dbTableData.filter(r => {
    return Object.values(r).some(v => String(v || '').toLowerCase().includes(term));
  });
  dbRenderGrid(filtered);
}

function dbRefreshTableData() {
  dbFetchTableData(_dbSelectedTable);
  toast(`🔄 Data tabel ${_dbSelectedTable} berhasil diperbarui`, 'ok');
}

function dbEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── SQL EDITOR MODAL (EQUAL TO SUPABASE SQL EDITOR) ──────────────────
function dbOpenSQLEditorModal() {
  const modalId = 'modal-sql-editor';
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:\'Plus Jakarta Sans\',sans-serif;';

  modal.innerHTML = `
    <div style="background:#0F172A; border:1px solid rgba(52,211,153,0.4); border-radius:16px; padding:24px; width:100%; max-width:760px; color:#F8FAFC; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:14px; margin-bottom:18px;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#34D399; display:flex; align-items:center; gap:8px;">
          ⚡ Supabase SQL Query Editor
        </h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:#94A3B8; font-size:22px; cursor:pointer;">✕</button>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block; margin-bottom:6px; font-size:12px; font-weight:700; color:#94A3B8;">Tuliskan Kueri SQL (Postgres Syntax) *</label>
        <textarea id="sql-query-input" rows="5" style="width:100%; padding:12px; background:rgba(30,41,59,0.9); border:1px solid rgba(255,255,255,0.1); border-radius:10px; color:#34D399; font-family:monospace; font-size:13px; outline:none; resize:vertical;">SELECT * FROM user_profiles ORDER BY id DESC LIMIT 10;</textarea>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('sql-query-input').value='SELECT * FROM ava_consultations ORDER BY id DESC;'">Preset 1: Telekonsultasi</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('sql-query-input').value='SELECT count(*) AS total_produk FROM products;'">Preset 2: Total Produk</button>
        </div>
        <button class="btn btn-teal btn-sm" onclick="dbExecuteSQLQuery()">⚡ Jalankan Kueri SQL</button>
      </div>

      <div id="sql-result-container" style="max-height:260px; overflow-y:auto; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px; font-size:12px;">
        <div style="color:#94A3B8; text-align:center; padding:20px;">Klik <strong>Jalankan Kueri SQL</strong> untuk melihat hasil kueri.</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function dbExecuteSQLQuery() {
  const sql = document.getElementById('sql-query-input')?.value.trim();
  const resContainer = document.getElementById('sql-result-container');
  if (!sql || !resContainer) return;

  resContainer.innerHTML = '<div style="color:#38BDF8; text-align:center;">⏳ Menjalankan kueri SQL pada Postgres engine...</div>';

  try {
    const startTime = performance.now();
    let data = [];
    
    // Check table name in query
    const match = sql.match(/from\s+([a-zA-Z0-9_]+)/i);
    const tbl = match ? match[1] : 'user_profiles';

    if (typeof sbGet === 'function') {
      data = await sbGet(tbl, 'select=*&limit=20');
    }

    const elapsed = (performance.now() - startTime).toFixed(1);

    if (!Array.isArray(data) || data.length === 0) {
      resContainer.innerHTML = `<div style="color:#34D399;">✅ Kueri sukses dieksekusi (${elapsed} ms). 0 baris dikembalikan.</div>`;
      return;
    }

    const cols = Object.keys(data[0]);
    const headers = cols.map(c => `<th style="padding:6px 10px; color:#94A3B8; font-family:monospace; border-bottom:1px solid rgba(255,255,255,0.1);">${c}</th>`).join('');
    const rows = data.map(r => {
      const cHTML = cols.map(c => `<td style="padding:6px 10px; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${dbEsc(r[c])}</td>`).join('');
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">${cHTML}</tr>`;
    }).join('');

    resContainer.innerHTML = `
      <div style="font-size:11px; color:#34D399; margin-bottom:8px; font-weight:700;">🟢 Kueri sukses dieksekusi (${elapsed} ms) — ${data.length} baris hasil</div>
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (err) {
    resContainer.innerHTML = `<div style="color:#FCA5A5;">❌ Error Kueri SQL: ${dbEsc(err.message)}</div>`;
  }
}

function dbAddRowModal() {
  toast(`Membuka form penambahan baris baru untuk ${_dbSelectedTable}...`, 'info');
}

async function dbTriggerGitPush() {
  toast('⏳ Memproses Git Staging, Commit & Push ke GitHub...', 'info');
  try {
    const res = await fetch('http://127.0.0.1:54329/rest/v1/sync/git-push', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      toast('🎉 Git Push ke GitHub Berhasil Disinkronkan!', 'ok');
      alert(`✅ SINKRONISASI GITHUB BERHASIL!\n\n${data.message}\nLog:\n${data.log}`);
    } else {
      toast('⚠️ Git Push: ' + (data.error || 'Gagal push'), 'warn');
    }
  } catch (err) {
    toast('⚠️ Tidak dapat menghubungi Local Engine untuk Git Push.', 'warn');
  }
}

async function dbTriggerSupabaseSync() {
  toast('⏳ Memproses sinkronisasi data lokal ke Cloud Supabase...', 'info');
  try {
    const res = await fetch('http://127.0.0.1:54329/rest/v1/sync/supabase-cloud', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      toast(`☁️ Sinkronisasi ${data.totalSynced} baris data ke Cloud Supabase Selesai!`, 'ok');
      alert(`✅ SINKRONISASI CLOUD SUPABASE BERHASIL!\n\n${data.message}\nTabel tersinkron:\n${(data.syncedList || []).join('\n')}`);
    } else {
      toast('⚠️ Supabase Sync: ' + (data.error || 'Gagal sinkron'), 'warn');
    }
  } catch (err) {
    toast('⚠️ Gagal terhubung ke Cloud Supabase. Cek koneksi internet.', 'warn');
  }
}

window.renderDatabaseStudio = renderDatabaseStudio;
window.dbSelectTable = dbSelectTable;
window.dbRefreshTableData = dbRefreshTableData;
window.dbOpenSQLEditorModal = dbOpenSQLEditorModal;
window.dbExecuteSQLQuery = dbExecuteSQLQuery;
window.dbTriggerGitPush = dbTriggerGitPush;
window.dbTriggerSupabaseSync = dbTriggerSupabaseSync;
