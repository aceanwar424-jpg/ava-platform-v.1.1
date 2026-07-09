async function renderSettings() {
  const role = getUserRole();
  const isSuperAdmin = role === 'super_admin';

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h1>Pengaturan</h1><p>Konfigurasi sistem, pengguna, dan koneksi</p></div>
    </div>

    <div class="tabs" id="set-tabs">
      <button class="tab-btn active" onclick="switchSetTab('general',this)">⚙️ Umum</button>
      <button class="tab-btn" onclick="switchSetTab('rolemenu',this)">🔐 Akses Menu</button>
      <button class="tab-btn" onclick="switchSetTab('activity',this)">📋 Log Aktivitas</button>
      <button class="tab-btn" onclick="switchSetTab('data',this)">🗄 Data</button>
      <button class="tab-btn" onclick="switchSetTab('masterdata',this)">📋 Master Data</button>
      ${isSuperAdmin ? `<button class="tab-btn" onclick="switchSetTab('admin',this)">🛠 Admin Tools</button>` : ''}
    </div>

    <div id="set-general">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:800px">
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">🔗 Supabase</div>
          <div class="form-group">
            <label>Project URL</label>
            <input value="${SUPABASE_URL}" readonly style="background:var(--lgray);font-size:12px">
          </div>
          <div id="set-conn" class="status-box status-info" style="margin-bottom:10px">Memeriksa...</div>
          <button class="btn btn-teal btn-sm" onclick="checkSetConn()">🔄 Cek</button>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">🗺 Google Maps API</div>
          <div class="form-group">
            <label>API Key</label>
            <input type="password" id="set-maps-key" value="${localStorage.getItem('ol_maps_key')||''}" placeholder="AIza...">
          </div>
          <div class="btn-row">
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('set-maps-key').type=document.getElementById('set-maps-key').type==='password'?'text':'password'">👁</button>
            <button class="btn btn-teal btn-sm" onclick="saveSetMapsKey()">💾 Simpan</button>
          </div>
        </div>
        <div class="card" style="grid-column:1/-1">
          <div class="card-title" style="margin-bottom:14px">📊 Statistik Database</div>
          <div id="set-stats" class="loading-row"><div class="spinner"></div></div>
        </div>
      </div>
    </div>

    <!-- Pengguna lama dipindah ke User Management (menu Konfigurasi → User Management) -->

    <div id="set-rolemenu" style="display:none">
      <div id="set-rolemenu-content"></div>
    </div>

    <div id="set-activity" style="display:none">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span style="font-size:13px;font-weight:700;color:var(--navy)">Log Aktivitas</span>
        </div>
        <div id="set-activity-list" class="loading-row"><div class="spinner"></div></div>
      </div>
    </div>

    <div id="set-data" style="display:none">
      <div class="card" style="max-width:500px">
        <div class="card-title" style="margin-bottom:14px;color:var(--danger)">⚠️ Manajemen Data</div>
        <p style="font-size:13px;color:var(--gray);margin-bottom:14px">Tindakan berikut tidak dapat dibatalkan. Lakukan dengan hati-hati.</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-danger btn-sm" onclick="exportAllData()">📥 Export Semua Data (Backup)</button>
        </div>
      </div>
    </div>

    <div id="set-masterdata" style="display:none">
      <div id="masterdata-content" class="loading-row"><div class="spinner"></div></div>
    </div>

    <div id="set-admin" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px">

        <!-- User & Role -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">👤 User & Role Management</div>
          <p style="font-size:13px;color:var(--gray);margin-bottom:14px">Kelola akun, role, dan hak akses semua pengguna platform.</p>
          <button class="btn btn-teal" onclick="navigate('users')">🔑 Buka User Management</button>
        </div>

        <!-- Bulk Delete -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px;color:var(--danger)">🗑 Bulk Delete</div>
          <p style="font-size:13px;color:var(--gray);margin-bottom:14px">Hapus massal data untuk reset atau pembersihan. Tidak bisa dibatalkan.</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('partners')">Hapus Semua Partner</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('partner_deals')">Hapus Semua Kerjasama</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('vouchers')">Hapus Semua Voucher</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('voucher_campaigns')">Hapus Semua Campaign</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('marketing_templates')">Hapus Semua Template</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('outgoing_letters')">Hapus Arsip Surat</button>
            <button class="btn btn-danger btn-sm" onclick="bulkDeleteTable('activity_logs')">Bersihkan Activity Log</button>
          </div>
        </div>

        <!-- Reset Password -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">🔒 Keamanan</div>
          <p style="font-size:13px;color:var(--gray);margin-bottom:14px">Info akun aktif dan koneksi Supabase.</p>
          <div style="font-size:12px;background:var(--lgray);border-radius:8px;padding:10px 12px;margin-bottom:10px">
            <div><strong>User ID:</strong> <span id="admin-uid" style="color:var(--teal)">—</span></div>
            <div style="margin-top:4px"><strong>Role:</strong> <span id="admin-role" style="color:var(--navy)">—</span></div>
            <div style="margin-top:4px"><strong>Email:</strong> <span id="admin-email" style="color:var(--gray)">—</span></div>
          </div>
        </div>

        <!-- Email Confirmation Fix -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">⚡ Quick Fix SQL</div>
          <p style="font-size:13px;color:var(--gray);margin-bottom:10px">SQL siap pakai untuk fix umum. Copy dan jalankan di Supabase SQL Editor.</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-outline btn-sm" onclick="copyAdminSQL('confirm_email')">📋 Fix Email Confirmation</button>
            <button class="btn btn-outline btn-sm" onclick="copyAdminSQL('disable_rls')">📋 Disable RLS semua tabel</button>
            <button class="btn btn-outline btn-sm" onclick="copyAdminSQL('check_tables')">📋 Check semua tabel</button>
          </div>
        </div>

      </div>
    </div>`;

  checkSetConn();
  loadSetStats();
  if (isSuperAdmin) loadAdminInfo();
}

function switchSetTab(tab, btn) {
  document.querySelectorAll('#set-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'rolemenu') { ['general','activity','data','masterdata','admin'].forEach(t=>{const d=document.getElementById('set-'+t);if(d)d.style.display='none';}); document.getElementById('set-rolemenu').style.display=''; renderRoleMenuConfig(); return; }
  ['general','activity','data','admin','masterdata'].forEach(t=>{
    const el = document.getElementById(`set-${t}`);
    if (el) el.style.display = t===tab?'block':'none';
  });
  document.getElementById('set-rolemenu').style.display='none';
  if(tab==='activity') loadSetActivity();
  if(tab==='masterdata') renderMasterData().then(html=>{
    const el=document.getElementById('masterdata-content');
    if(el) el.innerHTML=html;
  });
}

async function checkSetConn() {
  const el=document.getElementById('set-conn');
  if(!el)return;
  el.className='status-box status-info'; el.textContent='⏳ Memeriksa...';
  try {
    await sbGet('partners','select=count&limit=1');
    el.className='status-box status-ok'; el.textContent='✅ Supabase terhubung & normal.';
  } catch(e){
    el.className='status-box status-err'; el.textContent='❌ '+e.message;
  }
}

async function loadSetStats() {
  const el=document.getElementById('set-stats');
  if(!el)return;
  const tables=['partners','partner_deals','vouchers','voucher_campaigns','outgoing_letters','marketing_templates','activity_logs'];
  try {
    const counts=await Promise.all(tables.map(t=>sbGet(t,'select=count').catch(()=>[])));
    el.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap">
      ${tables.map((t,i)=>`
        <div style="text-align:center;padding:10px 14px;background:var(--lgray);border-radius:8px;min-width:100px">
          <div style="font-size:20px;font-weight:800;color:var(--navy)">${Array.isArray(counts[i])?counts[i].length:'?'}</div>
          <div style="font-size:11px;color:var(--gray);margin-top:2px">${t.replace(/_/g,' ')}</div>
        </div>`).join('')}
    </div>`;
  } catch(e){ el.innerHTML='<span style="color:var(--gray);font-size:13px">Gagal load</span>'; }
}

// loadSetUsers removed — User Management is now the single source of truth (navigate('users'))

async function loadSetActivity() {
  const el=document.getElementById('set-activity-list');
  if(!el)return;
  try {
    const data=await sbGet('activity_logs','select=*&order=created_at.desc&limit=50');
    el.innerHTML=(data&&data.length)?`
      <table>
        <thead><tr><th>Waktu</th><th>Aksi</th><th>Data</th><th>Deskripsi</th><th>User</th></tr></thead>
        <tbody>${(data||[]).map(a=>`
          <tr>
            <td style="font-size:11px;color:var(--gray);white-space:nowrap">${formatDateShort(a.created_at)}</td>
            <td><span class="badge ${a.action==='create'?'badge-green':a.action==='delete'?'badge-red':a.action==='update'?'badge-navy':'badge-gray'}">${a.action}</span></td>
            <td style="font-size:12px"><strong>${a.record_name||'—'}</strong></td>
            <td style="font-size:12px;color:var(--gray)">${a.description||'—'}</td>
            <td style="font-size:11px;color:var(--gray)">${a.user_name||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`:
      '<div class="empty-state"><div class="ico">📋</div><h3>Belum ada log</h3></div>';
  } catch(e){ el.innerHTML=`<div class="status-box status-err">❌ ${e.message}</div>`; }
}

async function saveSetMapsKey() {
  const k=document.getElementById('set-maps-key')?.value.trim();
  if(!k){toast('API key kosong','err');return;}
  localStorage.setItem('ol_maps_key',k);
  try {
    const ex=await sbGet('settings','select=id&key=eq.maps_api_key');
    if(ex?.length) await sbPatch('settings',ex[0].id,{value:k});
    else await sbPost('settings',{key:'maps_api_key',value:k,label:'Google Maps API Key'});
    toast('✅ API key tersimpan permanen','ok');
  } catch(e){ toast('✅ Tersimpan di browser','warn'); }
}

async function exportAllData() {
  if(!confirm('Export semua data partner sebagai backup CSV?'))return;
  try {
    const data=await sbGet('partners','select=*&order=created_at.desc');
    const h=['id','partner_code','partner_name','category','pic_name','phone','email','address','status','notes','created_at'];
    const rows=(data||[]).map(p=>h.map(k=>`"${String(p[k]||'').replace(/"/g,'""')}"`));
    const csv=[h,...rows].map(r=>r.join(',')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    a.download=`OneLab_Backup_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
    a.click(); toast('📥 Backup diunduh','ok');
  } catch(e){ toast('❌ '+e.message,'err'); }
}

// ── Admin helper functions ────────────────
function loadAdminInfo() {
  const u = window.currentUser;
  if (!u) return;
  const uid = document.getElementById('admin-uid');
  const rol = document.getElementById('admin-role');
  const eml = document.getElementById('admin-email');
  if (uid) uid.textContent = u.id?.substring(0,12)+'...';
  if (rol) rol.textContent = getUserRole();
  if (eml) eml.textContent = u.email || '—';
}

async function bulkDeleteTable(table) {
  const labels = {
    partners: 'Semua Partner',
    partner_deals: 'Semua Output Kerjasama',
    vouchers: 'Semua Voucher',
    voucher_campaigns: 'Semua Campaign Voucher',
    marketing_templates: 'Semua Template Marketing',
    outgoing_letters: 'Semua Arsip Surat',
    activity_logs: 'Semua Activity Log',
  };
  const label = labels[table] || table;
  const code = prompt(`⚠️ Hapus ${label}?\n\nKetik "HAPUS" untuk konfirmasi:`);
  if (code !== 'HAPUS') { toast('Dibatalkan','info'); return; }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gt.0`, {
      method: 'DELETE',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' }
    });
    if (res.ok || res.status === 204) {
      toast(`✅ ${label} berhasil dihapus`,'ok');
      await logActivity('bulk_delete', table, null, `Bulk delete ${table} oleh ${getUserName()}`, '');
    } else {
      const err = await res.text();
      throw new Error(err);
    }
  } catch(e) { toast('❌ '+e.message,'err'); }
}

const ADMIN_SQL = {
  confirm_email: `-- Fix email confirmation — jalankan di Supabase SQL Editor
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;`,

  disable_rls: `-- Disable RLS semua tabel
ALTER TABLE public.partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mous DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_letters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;`,

  check_tables: `-- Cek semua tabel dan jumlah kolom
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c 
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') as jumlah_kolom
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;`,
};

function copyAdminSQL(key) {
  const sql = ADMIN_SQL[key];
  if (!sql) return;
  navigator.clipboard.writeText(sql)
    .then(() => toast('📋 SQL tersalin — paste di Supabase SQL Editor','ok'))
    .catch(() => toast('❌ Gagal copy','err'));
}

// ── Master Data Management (in settings) ──
async function renderMasterData() {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">🏥 Master Kategori Partner</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
          Kelola jenis/kategori mitra yang tersedia di form Partner Database.
        </div>
        <div id="master-partner-cats" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
          ${['Apotek','Klinik Pratama','Klinik Utama','Dokter Praktik','Perusahaan SME',
             'Komunitas','Sekolah / Kampus','Gym & Sport Club','Lainnya']
            .map(c=>`<span style="background:var(--lgray);padding:3px 9px;border-radius:12px;font-size:11px">${c}</span>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--gray)">💡 Edit di source code PARTNER_CATEGORIES</div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">🔬 Master Layanan Lab</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
          Jenis pemeriksaan dan layanan yang tersedia untuk MCU, Home Care, dll.
        </div>
        <button class="btn btn-teal btn-sm" onclick="openMasterServices()">⚙️ Kelola Layanan</button>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">💰 Master Harga</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
          Tarif standar per jenis pemeriksaan untuk kalkulasi RAB otomatis.
        </div>
        <button class="btn btn-teal btn-sm" onclick="navigate('inventory')">📦 Kelola di Inventory</button>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">👤 Identitas Organisasi</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
          Nama, alamat, logo, kontak OneLab — dipakai di invoice, surat, voucher.
        </div>
        <button class="btn btn-teal btn-sm" onclick="openOrgSettings()">⚙️ Edit Identitas</button>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">📄 Nomor Urut Dokumen</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
          Reset atau lihat nomor urut surat, invoice, dan voucher.
        </div>
        <button class="btn btn-outline btn-sm" onclick="loadDocSequences()">👁 Lihat Urutan</button>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px">🌐 API & Integrasi</div>
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px">
          Google Maps API key, Supabase connection, dan integrasi eksternal.
        </div>
        <button class="btn btn-teal btn-sm" onclick="switchSetTab('general',document.querySelector('#set-tabs .tab-btn'))">⚙️ Ke Pengaturan Umum</button>
      </div>

    </div>`;
}

async function openMasterServices() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">🔬 Master Layanan Lab</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="font-size:13px;color:var(--gray);margin-bottom:14px">
      Daftar layanan standar OneLab — digunakan di Home Care, MCU, dan Voucher.
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${['Darah Lengkap','Urin Lengkap','Kolesterol Total','Gula Darah Puasa','HbA1c',
         'Asam Urat','Fungsi Hati (SGOT/SGPT)','Fungsi Ginjal (Ureum/Kreatinin)',
         'Thyroid (TSH/T4)','Rapid Test COVID','Swab PCR','EKG','Tekanan Darah',
         'Indeks Massa Tubuh','Skrining Kanker Serviks','Gene Solution Colon',
         'Gene Solution Cervical','Gut Health','Konsultasi Dokter']
        .map(s=>`<span style="background:var(--mint);color:var(--teal);padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600">${s}</span>`)
        .join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
    </div>`);
}

async function openOrgSettings() {
  const orgName  = localStorage.getItem('ol_org_name')  || 'OneLab Diagnostics by Plebo';
  const orgAddr  = localStorage.getItem('ol_org_addr')  || 'Bintaro Jaya, Jl. Elang Raya No.15, Tangsel';
  const orgPhone = localStorage.getItem('ol_org_phone') || '(021) xxxx-xxxx';
  const orgEmail = localStorage.getItem('ol_org_email') || 'info@onelab.id';

  openModal(`
    <div class="modal-header">
      <div class="modal-title">👤 Identitas Organisasi</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div class="form-group">
      <label>Nama Organisasi</label>
      <input type="text" id="org-name" value="${orgName}">
    </div>
    <div class="form-group">
      <label>Alamat</label>
      <input type="text" id="org-addr" value="${orgAddr}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>No. Telepon</label>
        <input type="text" id="org-phone" value="${orgPhone}">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="org-email" value="${orgEmail}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
      <button class="btn btn-teal" onclick="saveOrgSettings()">💾 Simpan</button>
    </div>`);
}

function saveOrgSettings() {
  localStorage.setItem('ol_org_name',  document.getElementById('org-name').value.trim());
  localStorage.setItem('ol_org_addr',  document.getElementById('org-addr').value.trim());
  localStorage.setItem('ol_org_phone', document.getElementById('org-phone').value.trim());
  localStorage.setItem('ol_org_email', document.getElementById('org-email').value.trim());
  toast('✅ Identitas organisasi disimpan','ok');
  closeModalForce();
}

async function loadDocSequences() {
  try {
    const data = await sbGet('letter_sequences','select=*&order=year.desc,month.desc,type_code');
    openModal(`
      <div class="modal-header">
        <div class="modal-title">📄 Nomor Urut Dokumen</div>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>
      <table><thead><tr><th>Tahun</th><th>Bulan</th><th>Tipe</th><th>Urutan Terakhir</th></tr></thead>
      <tbody>${(data||[]).map(d=>`<tr>
        <td>${d.year}</td><td>${d.month}</td>
        <td style="font-family:monospace">${d.type_code}</td>
        <td style="font-weight:700;color:var(--navy)">${d.last_seq}</td>
      </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--gray)">Belum ada data</td></tr>'}
      </tbody></table>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModalForce()">Tutup</button>
      </div>`);
  } catch(e){ toast('❌ '+e.message,'err'); }
}

// ═══════════════════════════════════════════════════════════════
// ROLE MENU ACCESS CONFIGURATOR
// ═══════════════════════════════════════════════════════════════

function renderRoleMenuConfig() {
  // super_admin excluded — always has full access, no need to config
  const roles = ['direktur','manager','spv','sales','operasional','hrd_staff','finance_staff','viewer'];
  const el = document.getElementById('set-rolemenu-content');
  if (!el) return;

  ['general','users','activity','data','masterdata','admin'].forEach(t => {
    const d = document.getElementById(`set-${t}`);
    if (d) d.style.display = 'none';
  });
  document.getElementById('set-rolemenu').style.display = '';

  const groups = {};
  Object.entries(ALL_PAGES).forEach(([key, [group, label, icon]]) => {
    if (!groups[group]) groups[group] = [];
    groups[group].push({key, label, icon});
  });

  el.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <div>
        <div style="font-weight:800;font-size:15px">🔐 Konfigurasi Akses Menu per Role</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">
          ✅ Centang = role bisa akses menu tersebut · Super Admin selalu punya akses penuh (tidak perlu diatur)
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="resetAllRolePages()">↩ Reset Default</button>
        <button class="btn btn-teal btn-sm" onclick="saveAllRolePages()">💾 Simpan Semua</button>
      </div>
    </div>

    <div style="overflow-x:auto;border-radius:var(--r-md);border:1px solid var(--border)">
      <table class="role-access-table" style="border-collapse:collapse;min-width:900px;font-size:12.5px;width:100%">
        <thead>
          <tr style="background:var(--navy)">
            <th style="padding:12px 16px;color:#fff;text-align:left;min-width:200px;
              position:sticky;left:0;background:var(--navy);z-index:2;border-right:2px solid rgba(255,255,255,.1)">
              <div style="font-size:12px;font-weight:700">Menu / Halaman</div>
            </th>
            ${roles.map(r => {
              const rc = ROLES[r] || {};
              const count = getRolePages(r).length;
              return `<th style="padding:10px 8px;color:#fff;text-align:center;min-width:100px;
                border-right:1px solid rgba(255,255,255,.08)">
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <div style="width:10px;height:10px;border-radius:50%;background:${rc.color||'#94A3B8'}"></div>
                  <div style="font-size:11px;font-weight:800;color:#fff;line-height:1.2">${rc.label||r}</div>
                  <div style="font-size:9px;color:rgba(255,255,255,.5)">${count} menu</div>
                </div>
              </th>`;
            }).join('')}
          </tr>
          <!-- Select All row -->
          <tr style="background:var(--bg2);border-bottom:2px solid var(--border)">
            <td style="padding:6px 16px;font-size:11px;font-weight:700;color:var(--text3);
              position:sticky;left:0;background:var(--bg2);border-right:2px solid var(--border)">
              Pilih / Hapus Semua ↓
            </td>
            ${roles.map(r => {
              const rc = ROLES[r]||{};
              return `<td style="padding:6px 8px;text-align:center;border-right:1px solid var(--border)">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button onclick="selectRoleAll('${r}',true)"
                    style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid ${rc.color||'var(--teal)'};
                      background:${rc.color||'var(--teal)'}20;color:${rc.color||'var(--teal)'};cursor:pointer">✓ All</button>
                  <button onclick="selectRoleAll('${r}',false)"
                    style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid var(--border);
                      background:transparent;color:var(--text3);cursor:pointer">✗</button>
                </div>
              </td>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${Object.entries(groups).map(([group, pages]) => `
            <tr>
              <td colspan="${roles.length + 1}" style="padding:7px 16px;background:var(--navy)22;
                font-size:10.5px;font-weight:800;color:var(--text3);text-transform:uppercase;
                letter-spacing:.08em;border-bottom:1px solid var(--border);
                border-top:2px solid var(--border);position:sticky;left:0">
                ${group}
              </td>
            </tr>
            ${pages.map((p, pi) => `
              <tr style="background:${pi%2===0?'#fff':'var(--bg2)'};border-bottom:1px solid var(--border);
                transition:background .1s"
                onmouseover="this.style.background='#EFF9FC'"
                onmouseout="this.style.background='${pi%2===0?'#fff':'var(--bg2)'}'">
                <td style="padding:9px 16px;position:sticky;left:0;background:inherit;
                  border-right:2px solid var(--border)">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:15px">${p.icon}</span>
                    <div>
                      <div style="font-weight:600;font-size:12.5px;color:var(--text)">${p.label}</div>
                      <div style="font-size:10px;color:var(--text3);font-family:monospace">${p.key}</div>
                    </div>
                  </div>
                </td>
                ${roles.map(r => {
                  const currentPages = getRolePages(r);
                  const checked = currentPages.includes(p.key);
                  const rc = ROLES[r]||{};
                  return `<td style="padding:9px 8px;text-align:center;border-right:1px solid var(--border)">
                    <input type="checkbox"
                      id="rp-${r}-${p.key.replace(/[^a-z0-9]/g,'_')}"
                      data-role="${r}" data-page="${p.key}"
                      ${checked ? 'checked' : ''}
                      onchange="updateRoleCount('${r}')"
                      style="width:16px;height:16px;cursor:pointer;accent-color:${rc.color||'var(--teal)'}">
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Role summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:16px">
      ${roles.map(r => {
        const rc = ROLES[r]||{};
        const pages = getRolePages(r);
        return `
          <div style="border-left:4px solid ${rc.color||'#94A3B8'};padding:10px 12px;
            background:#fff;border-radius:0 var(--r) var(--r) 0;
            border:1px solid var(--border);border-left-width:4px">
            <div style="font-weight:700;font-size:12.5px;color:${rc.color||'var(--text)'}">${rc.label||r}</div>
            <div style="font-size:10.5px;color:var(--text3);margin-top:2px;line-height:1.4">${rc.desc||''}</div>
            <div style="margin-top:6px">
              <span id="role-count-${r}" style="background:${rc.color||'#94A3B8'}20;color:${rc.color||'#94A3B8'};
                padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">
                ${pages.length} menu
              </span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// Update count badge when checkbox changes
function updateRoleCount(role) {
  const checked = document.querySelectorAll(`[data-role="${role}"]:checked`).length;
  const el = document.getElementById(`role-count-${role}`);
  if (el) el.textContent = checked + ' menu';
}

function selectRoleAll(role, val) {
  document.querySelectorAll(`[data-role="${role}"]`).forEach(cb => { cb.checked = val; });
  updateRoleCount(role);
}


function saveAllRolePages() {
  const roles = ['direktur','manager','spv','sales','operasional','hrd_staff','finance_staff','viewer'];
  let saved = 0;
  roles.forEach(role => {
    const pages = [];
    document.querySelectorAll(`[data-role="${role}"]`).forEach(cb => {
      if (cb.checked) pages.push(cb.getAttribute('data-page'));
    });
    if (!pages.includes('dashboard')) pages.unshift('dashboard');
    saveRolePages(role, pages);
    saved++;
  });
  // Re-render count badges
  roles.forEach(r => updateRoleCount(r));
  toast(`✅ Akses menu ${saved} role disimpan`, 'ok', 3000);
  // Re-apply for current user so sidebar updates instantly
  if (typeof applyRoleMenu === 'function') applyRoleMenu();
}

function resetAllRolePages() {
  if (!confirm('Reset semua konfigurasi akses menu ke default?')) return;
  const roles = Object.keys(ROLES);
  roles.forEach(r => localStorage.removeItem('ol_role_pages_' + r));
  toast('↩ Semua role direset ke default', 'info');
  renderRoleMenuConfig();
  applyRoleMenu();
}
