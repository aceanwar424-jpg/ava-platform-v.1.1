// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Queen Sanctuary & Medical Spa Booking Management — AVA GLOBAL
// ---------------------------------------------------------------------------
// Pilar 5: PT QUEEN SANCTUARY WELLNESS — Postpartum & Women Holistic Care
// Integrasi:
// - Session Lifecycle: Booking -> Check-In (Room Occ.) -> Complete -> Billing
// - VIP Member Session Balance Deduction (Otomatis potong saldo kuota)
// - Finance Bridge (postToLedger / Kasir POS)
// - WhatsApp Gateway Notification (Konfirmasi booking & struk digital)
// ═══════════════════════════════════════════════════════════════════════════

let SANCTUARY_STATE = {
  activeTab: 'jadwal', // 'jadwal' | 'members' | 'rooms' | 'menu'
  bookings: [
    {
      id: 'SNC-2026-001',
      jam: '10:00 - 11:30 (90 Menit)',
      tamu: 'Ny. Siska Melani',
      tipe_member: 'VIP Gold Member',
      telepon: '081299880011',
      treatment: 'Empress Ratus & Lymphatic Drainage Spa',
      room: 'Private Suite Rose 01',
      terapis: 'Terapis Maya (Senior)',
      biaya: 750000,
      status: 'Sedang Berlangsung',
      member_no: 'M-AVA-0081'
    },
    {
      id: 'SNC-2026-002',
      jam: '13:00 - 14:00 (60 Menit)',
      tamu: 'dr. Amanda Clarissa',
      tipe_member: 'VIP Black Diamond',
      telepon: '081299887711',
      treatment: 'Pelvic Reformer Pilates (Post-Partum Recovery)',
      room: 'Reformer Studio 02',
      terapis: 'Instruktur Ratih',
      biaya: 600000,
      status: 'Terkonfirmasi',
      member_no: 'M-AVA-0092'
    },
    {
      id: 'SNC-2026-003',
      jam: '15:30 - 17:00 (90 Menit)',
      tamu: 'Ibu Ratna Juwita',
      tipe_member: 'VIP Gold Member',
      telepon: '081344556677',
      treatment: 'Aromatherapy Sleep Healing & Head Reflexology',
      room: 'Private Suite Lavender 03',
      terapis: 'Terapis Dewi',
      biaya: 650000,
      status: 'Menunggu Tamu',
      member_no: 'M-AVA-0104'
    }
  ],
  vipMembers: [
    { noMember: 'M-AVA-0081', nama: 'Ny. Siska Melani', tier: 'VIP Gold', sisaSesi: 6, joinDate: '2026-01-15', totalSpend: 8500000, status: 'Aktif', telepon: '081299880011' },
    { noMember: 'M-AVA-0092', nama: 'dr. Amanda Clarissa', tier: 'Black Diamond', sisaSesi: 12, joinDate: '2025-11-20', totalSpend: 16800000, status: 'Aktif', telepon: '081299887711' },
    { noMember: 'M-AVA-0104', nama: 'Ibu Ratna Juwita', tier: 'VIP Gold', sisaSesi: 4, joinDate: '2026-03-10', totalSpend: 6200000, status: 'Aktif', telepon: '081344556677' },
    { noMember: 'M-AVA-0118', nama: 'Nn. Aurelia Putri', tier: 'Silver Care', sisaSesi: 2, joinDate: '2026-06-05', totalSpend: 3400000, status: 'Aktif', telepon: '081233445566' }
  ],
  rooms: [
    { nama: 'Private Suite Rose 01', fasilitas: 'Bathtub Onsen, Ratus Chair, Aromatherapy Diffuser', status: 'Terpakai', tamu: 'Ny. Siska Melani' },
    { nama: 'Reformer Studio 02', fasilitas: 'Allegro 2 Reformer, Pelvic Trapeze, Mirror Wall', status: 'Tersedia', tamu: '-' },
    { nama: 'Private Suite Lavender 03', fasilitas: 'Heated Massage Bed, Singing Bowl, Herbal Steam', status: 'Tersedia', tamu: '-' },
    { nama: 'VIP Royal Suite Jasmine 04', fasilitas: 'Couple Bed, Jacuzzi, Private Restroom', status: 'Tersedia', tamu: '-' }
  ],
  menuLayanan: [
    { nama: 'Empress Ratus Keraton & V-Steam', durasi: '45 Menit', harga: 350000, desc: 'Perawatan organ intim herbal rempah keraton untuk kesehatan dan keseimbangan flora alami.' },
    { nama: 'Pelvic Reformer Pilates (Post-Partum)', durasi: '60 Menit', harga: 600000, desc: 'Latihan penguatan otot dasar panggul dengan mesin reformer klinis dipandu instruktur bersertifikasi.' },
    { nama: 'Lymphatic Drainage Body Glow Massage', durasi: '90 Menit', harga: 750000, desc: 'Pemijatan limfatik untuk melancarkan sirkulasi, mengurangi retensi cairan & detoksifikasi tubuh.' },
    { nama: 'Aromatherapy Sleep Healing & Head Spa', durasi: '60 Menit', harga: 500000, desc: 'Terapi relaksasi kepala, scalp reflexology, dan minyak atsiri lavender murni untuk mengatasi insomnia.' }
  ]
};

async function renderSanctuaryBooking(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  if (params.tab) SANCTUARY_STATE.activeTab = params.tab;

  const totalOmzet = SANCTUARY_STATE.bookings.reduce((sum, b) => sum + (b.biaya || 0), 0);
  const roomsOccupied = SANCTUARY_STATE.rooms.filter(r => r.status === 'Terpakai').length;

  content.innerHTML = `
    <!-- Header Modul -->
    <div class="page-header">
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span class="badge" style="background:rgba(212,175,55,0.15); color:#b45309; border:1px solid #d4af37; font-weight:800; font-size:10px;">PILAR 5 &bull; PT QUEEN SANCTUARY WELLNESS</span>
          <span class="badge" style="background:#ccfbf1; color:#0f766e; font-weight:800; font-size:10px;">EXCELLENCE IN POSTPARTUM &amp; WOMEN WELLNESS</span>
        </div>
        <h1>🌿 Queen Sanctuary &amp; Medical Spa</h1>
        <p>Manajemen sesi terapi pemulihan holistik, pelvic reformer, alokasi private suite &amp; VIP membership</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderSanctuaryBooking()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="openBookingBaruModal()">+ Reservasi Sesi Baru</button>
        <button class="btn btn-primary btn-sm" style="background:#0A2342; border-color:#0A2342; color:#fff;" onclick="openTambahMemberModal()">+ Registrasi VIP Member</button>
      </div>
    </div>

    <!-- Ringkasan KPI Sanctuary -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin-bottom:20px;">
      <div class="kpi-card" style="border-left: 4px solid #d4af37;">
        <div class="kpi-icon" style="background:rgba(212,175,55,0.15); color:var(--accent);">👑</div>
        <div>
          <div class="kpi-val" style="color:#b45309;">${SANCTUARY_STATE.vipMembers.length} Member</div>
          <div class="kpi-label">VIP Sanctuary Active Members</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Diamond &bull; Gold &bull; Silver</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #14b8a6;">
        <div class="kpi-icon" style="background:rgba(20,184,166,0.15); color:var(--teal);">🛋️</div>
        <div>
          <div class="kpi-val">${roomsOccupied} / ${SANCTUARY_STATE.rooms.length} Suite</div>
          <div class="kpi-label">Okupansi Ruang Terapi Hari Ini</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">${SANCTUARY_STATE.rooms.length - roomsOccupied} Suite Tersedia</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #0ea5e9;">
        <div class="kpi-icon" style="background:rgba(14,165,233,0.15); color:#0ea5e9;">🧘‍♀️</div>
        <div>
          <div class="kpi-val">${SANCTUARY_STATE.bookings.length} Sesi</div>
          <div class="kpi-label">Total Reservasi Hari Ini</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Omzet Hari Ini: Rp ${totalOmzet.toLocaleString('id-ID')}</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #a855f7;">
        <div class="kpi-icon" style="background:rgba(168,85,247,0.15); color:#a855f7;">⭐</div>
        <div>
          <div class="kpi-val">4.9 / 5.0</div>
          <div class="kpi-label">Tingkat Kepuasan Tamu (CSAT)</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">100% Highly Recommended</div>
        </div>
      </div>
    </div>

    <!-- Sub-Menu Workspace Tabs (Navigasi Internal Modul) -->
    <div style="display:flex; gap:8px; border-bottom:2px solid var(--border); margin-bottom:20px; overflow-x:auto; padding-bottom:2px;">
      <button class="btn btn-sm ${SANCTUARY_STATE.activeTab === 'jadwal' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabSanctuary('jadwal')">
        📅 1. Jadwal Reservasi Hari Ini (${SANCTUARY_STATE.bookings.length})
      </button>
      <button class="btn btn-sm ${SANCTUARY_STATE.activeTab === 'members' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabSanctuary('members')">
        👑 2. Manajemen Member VIP (${SANCTUARY_STATE.vipMembers.length})
      </button>
      <button class="btn btn-sm ${SANCTUARY_STATE.activeTab === 'rooms' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabSanctuary('rooms')">
        🛋️ 3. Status Private Suite (${SANCTUARY_STATE.rooms.length})
      </button>
      <button class="btn btn-sm ${SANCTUARY_STATE.activeTab === 'menu' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabSanctuary('menu')">
        📜 4. Menu Layanan &amp; Paket Terapi
      </button>
    </div>

    <!-- Konten Tab Aktif -->
    <div id="sanctuary-tab-content">
      ${renderSanctuaryTabContent()}
    </div>
  `;
}

function gantiTabSanctuary(tab) {
  SANCTUARY_STATE.activeTab = tab;
  renderSanctuaryBooking();
}

function renderSanctuaryTabContent() {
  // TAB 1: JADWAL RESERVASI
  if (SANCTUARY_STATE.activeTab === 'jadwal') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Jadwal Reservasi Sesi Terapi Hari Ini</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Alokasi private room, check-in, selesai sesi &amp; billing otomatis</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="openBookingBaruModal()">+ Reservasi Sesi Baru</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>Waktu / Jam</th>
                <th>Nama Tamu &amp; Membership</th>
                <th>Paket Treatment</th>
                <th>Ruangan Suite</th>
                <th>Terapis / Nakes</th>
                <th>Biaya Sesi</th>
                <th>Status</th>
                <th style="text-align:center;">Aksi &amp; Billing</th>
              </tr>
            </thead>
            <tbody>
              ${SANCTUARY_STATE.bookings.map((b, idx) => `
                <tr>
                  <td><b>${b.jam}</b></td>
                  <td>
                    <b>${b.tamu}</b>
                    <div><span class="badge" style="background:rgba(212,175,55,0.2); color:#b45309; font-size:9.5px; font-weight:800;">${b.tipe_member}</span></div>
                    <div style="font-size:11px; color:var(--text3);">${b.telepon || '-'}</div>
                  </td>
                  <td>${b.treatment}</td>
                  <td><span style="font-weight:700; color:#0ea5e9;">${b.room}</span></td>
                  <td>${b.terapis}</td>
                  <td><strong>Rp ${b.biaya.toLocaleString('id-ID')}</strong></td>
                  <td>
                    <span class="badge ${b.status === 'Selesai & Billed' ? 'badge-success' : b.status === 'Sedang Berlangsung' ? 'badge-teal' : b.status === 'Terkonfirmasi' ? 'badge-info' : 'badge-warning'}">
                      ${b.status}
                    </span>
                  </td>
                  <td style="text-align:center;">
                    <div style="display:flex; gap:4px; justify-content:center;">
                      ${b.status !== 'Sedang Berlangsung' && b.status !== 'Selesai & Billed' ? `
                        <button class="btn btn-xs btn-teal" onclick="checkinTamuSanctuary(${idx})">▶ Check-in</button>
                      ` : ''}
                      ${b.status === 'Sedang Berlangsung' ? `
                        <button class="btn btn-xs btn-primary" style="background:#15803d; border-color:#15803d;" onclick="selesaikanSesiSanctuary(${idx})">✓ Selesai &amp; Bill</button>
                      ` : ''}
                      ${b.status === 'Selesai & Billed' ? `
                        <button class="btn btn-xs btn-ghost" onclick="kirimStrukWASanctuary(${idx})">📱 WA Struk</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 2: MANAJEMEN MEMBER VIP
  if (SANCTUARY_STATE.activeTab === 'members') {
    return `
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">Daftar Member VIP Sanctuary &amp; Saldo Sesi</h3>
            <p style="font-size:12px; color:var(--text3); margin:2px 0 0 0;">Tier keanggotaan, sisa saldo kuota treatment, dan riwayat kunjungan</p>
          </div>
          <button class="btn btn-sm btn-teal" onclick="openTambahMemberModal()">+ Tambah Member VIP</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>No. Member</th>
                <th>Nama Member</th>
                <th>Tier Membership</th>
                <th>Sisa Kuota Sesi</th>
                <th>Bergabung Sejak</th>
                <th>Total Akumulasi Spend</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${SANCTUARY_STATE.vipMembers.map((m, mIdx) => `
                <tr>
                  <td><code>${m.noMember}</code></td>
                  <td><b>${m.nama}</b></td>
                  <td><span class="badge" style="background:rgba(212,175,55,0.2); color:#b45309; font-weight:800;">${m.tier}</span></td>
                  <td><strong style="color:var(--teal); font-size:13px;">${m.sisaSesi} Sesi</strong></td>
                  <td>${m.joinDate}</td>
                  <td><strong>Rp ${m.totalSpend.toLocaleString('id-ID')}</strong></td>
                  <td><span class="badge badge-success">${m.status}</span></td>
                  <td>
                    <button class="btn btn-xs btn-ghost" onclick="topupSesiMember(${mIdx})">+ Top-up Sesi</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 3: STATUS PRIVATE SUITE
  if (SANCTUARY_STATE.activeTab === 'rooms') {
    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
        ${SANCTUARY_STATE.rooms.map((r, rIdx) => `
          <div class="card" style="padding:20px; border-left: 4px solid ${r.status === 'Terpakai' ? '#ef4444' : '#22c55e'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">${r.nama}</h3>
              <span class="badge ${r.status === 'Terpakai' ? 'badge-danger' : 'badge-success'}">${r.status}</span>
            </div>
            <p style="font-size:12px; color:var(--text3); margin:8px 0 12px 0;">${r.fasilitas}</p>
            <div style="border-top:1px solid var(--border); padding-top:10px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>Tamu Aktif: <b>${r.tamu}</b></div>
              ${r.status === 'Terpakai' ? `
                <button class="btn btn-xs btn-ghost" onclick="resetRoomStatus(${rIdx})">Kosongkan</button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // TAB 4: MENU LAYANAN & PAKET TERAPI
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
      ${SANCTUARY_STATE.menuLayanan.map(m => `
        <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">${m.nama}</h3>
              <span class="badge badge-teal">${m.durasi}</span>
            </div>
            <p style="font-size:12px; color:var(--text3); margin:10px 0 14px 0; line-height:1.4;">${m.desc}</p>
          </div>
          <div style="border-top:1px solid var(--border); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:15px; color:var(--teal);">Rp ${m.harga.toLocaleString('id-ID')}</strong>
            <button class="btn btn-xs btn-teal" onclick="openBookingBaruModal('${m.nama}', ${m.harga})">Pilih Layanan</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Check-in & Lifecycle Terapi ──────────────────────────────────────────────
function checkinTamuSanctuary(idx) {
  const b = SANCTUARY_STATE.bookings[idx];
  if (!b) return;
  b.status = 'Sedang Berlangsung';

  // Alokasikan room
  const rm = SANCTUARY_STATE.rooms.find(r => r.nama.includes(b.room) || b.room.includes(r.nama));
  if (rm) {
    rm.status = 'Terpakai';
    rm.tamu = b.tamu;
  }

  if (typeof toast === 'function') toast(`✅ Check-in berhasil: ${b.tamu} menempati ${b.room}`, 'ok');
  renderSanctuaryBooking();
}

async function selesaikanSesiSanctuary(idx) {
  const b = SANCTUARY_STATE.bookings[idx];
  if (!b) return;

  if (!confirm(`Selesaikan sesi terapi untuk ${b.tamu}?\n\n- Sesi: ${b.treatment}\n- Biaya: Rp ${b.biaya.toLocaleString('id-ID')}\n\nSaldo kuota member akan dipotong / dicatat ke transaksi pendapatan.`)) return;

  b.status = 'Selesai & Billed';

  // Kosongkan ruangan
  const rm = SANCTUARY_STATE.rooms.find(r => r.nama.includes(b.room) || b.room.includes(r.nama));
  if (rm) {
    rm.status = 'Tersedia';
    rm.tamu = '-';
  }

  // Jika member: potong saldo kuota sesi
  let memberFound = false;
  if (b.member_no) {
    const mem = SANCTUARY_STATE.vipMembers.find(m => m.noMember === b.member_no);
    if (mem && mem.sisaSesi > 0) {
      mem.sisaSesi -= 1;
      memberFound = true;
      if (typeof toast === 'function') toast(`👑 1 Sesi kuota ${mem.nama} dipotong. Sisa: ${mem.sisaSesi} sesi.`, 'info');
    }
  }

  // Finance Bridge: Catat jurnal pendapatan sanctuary
  try {
    if (typeof postToLedger === 'function' && b.biaya > 0) {
      await postToLedger(
        'cashier.bank',
        b.biaya,
        `Pendapatan Queen Sanctuary - ${b.treatment} (${b.tamu})`,
        'sanctuary_bookings',
        b.id
      );
    }
  } catch(eLedger) { console.warn('[Sanctuary Ledger skip]', eLedger.message); }

  // WhatsApp Bridge: Kirim struk & ucapan terima kasih
  kirimStrukWASanctuary(idx);

  if (typeof toast === 'function') toast(`✅ Sesi ${b.tamu} selesai & tercatat di billing!`, 'ok');
  renderSanctuaryBooking();
}

function kirimStrukWASanctuary(idx) {
  const b = SANCTUARY_STATE.bookings[idx];
  if (!b || !b.telepon) {
    if (typeof toast === 'function') toast('Nomor telepon tamu tidak tersedia', 'warn');
    return;
  }

  try {
    if (typeof WA_GATEWAY !== 'undefined') {
      const orgName = localStorage.getItem('ol_org_name') || 'Queen Sanctuary & Medical Spa - AVA GLOBAL';
      const waMsg =
        `*${orgName}*\n` +
        `Yth. *${b.tamu}*,\n\n` +
        `Terima kasih telah mempercayakan perawatan pemulihan Anda bersama Queen Sanctuary 🌿\n\n` +
        `📋 *Sesi:* ${b.treatment}\n` +
        `🛋️ *Suite:* ${b.room}\n` +
        `💆‍♀️ *Terapis:* ${b.terapis}\n` +
        `💵 *Biaya:* Rp ${b.biaya.toLocaleString('id-ID')}\n` +
        `✨ *Status:* Lunas / Selesai\n\n` +
        `Semoga perawatan hari ini memberikan kesegaran holistik bagi tubuh dan pikiran Anda. Sampai jumpa di sesi berikutnya! 🙏`;

      WA_GATEWAY.sendMessage({ to: b.telepon, message: waMsg })
        .then(r => { if (r?.success) toast(`📱 Struk WA terkirim ke ${b.tamu}`, 'ok'); })
        .catch(e => console.warn('[Sanctuary WA skip]', e.message));
    }
  } catch(e) { console.warn('[Sanctuary WA]', e); }
}

function resetRoomStatus(rIdx) {
  const r = SANCTUARY_STATE.rooms[rIdx];
  if (!r) return;
  r.status = 'Tersedia';
  r.tamu = '-';
  if (typeof toast === 'function') toast(`Ruangan ${r.nama} siap digunakan`, 'ok');
  renderSanctuaryBooking();
}

function topupSesiMember(mIdx) {
  const m = SANCTUARY_STATE.vipMembers[mIdx];
  if (!m) return;
  const add = prompt(`Tambah kuota sesi untuk ${m.nama} (saat ini ${m.sisaSesi} sesi):`, '4');
  if (add && !isNaN(add) && Number(add) > 0) {
    const num = Number(add);
    m.sisaSesi += num;
    m.totalSpend += (num * 600000);
    if (typeof toast === 'function') toast(`✅ Berhasil menambah ${num} sesi untuk ${m.nama}. Total saldo: ${m.sisaSesi} sesi`, 'ok');
    renderSanctuaryBooking();
  }
}

// Modal Reservasi Baru
function openBookingBaruModal(defaultTreatment = '', defaultPrice = 650000) {
  const memberOpts = SANCTUARY_STATE.vipMembers.map(m =>
    `<option value="${m.nama}" data-phone="${m.telepon}" data-no="${m.noMember}" data-tier="${m.tier}">${m.nama} (${m.tier} - Sisa ${m.sisaSesi} Sesi)</option>`
  ).join('');

  const modalHtml = `
    <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <div class="modal-title" style="font-size:16px; font-weight:800;">+ Reservasi Sesi Treatment Baru</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>Pilih Tamu (Member VIP atau Tamu Baru)</label>
        <select id="modal-snc-member-select" class="input" onchange="onSanctuaryMemberSelected(this)">
          <option value="">-- Tamu Walk-in / Non-Member --</option>
          ${memberOpts}
        </select>
      </div>
      <div class="form-group">
        <label>Nama Lengkap Tamu *</label>
        <input type="text" id="modal-snc-name" class="input" placeholder="Nama Lengkap Tamu">
      </div>
      <div class="form-group">
        <label>Nomor WhatsApp *</label>
        <input type="text" id="modal-snc-phone" class="input" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Paket Treatment</label>
        <select id="modal-snc-pkg" class="input" onchange="onSanctuaryPkgChanged(this)">
          ${SANCTUARY_STATE.menuLayanan.map(m => `
            <option value="${m.nama}" data-price="${m.harga}" ${m.nama === defaultTreatment ? 'selected' : ''}>
              ${m.nama} (${m.durasi}) - Rp ${m.harga.toLocaleString('id-ID')}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="grid-2" style="gap:10px;">
        <div class="form-group">
          <label>Ruangan Suite</label>
          <select id="modal-snc-room" class="input">
            ${SANCTUARY_STATE.rooms.map(r => `
              <option value="${r.nama}">${r.nama} (${r.status})</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Jam Sesi</label>
          <input type="text" id="modal-snc-time" class="input" value="14:00 - 15:30">
        </div>
      </div>
      <div class="form-group">
        <label>Biaya Sesi (Rp)</label>
        <input type="number" id="modal-snc-price" class="input" value="${defaultPrice}">
      </div>
      <div class="modal-footer" style="margin-top:10px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
        <button class="btn btn-teal" onclick="simpanBookingBaru()">💾 Konfirmasi Reservasi &amp; Kirim WA</button>
      </div>
    </div>
  `;
  if (typeof openModal === 'function') openModal(modalHtml, 'medium');
}

function onSanctuaryMemberSelected(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (sel.value) {
    document.getElementById('modal-snc-name').value = sel.value;
    document.getElementById('modal-snc-phone').value = opt.dataset.phone || '';
  }
}

function onSanctuaryPkgChanged(sel) {
  const opt = sel.options[sel.selectedIndex];
  const price = opt.dataset.price || 650000;
  const priceEl = document.getElementById('modal-snc-price');
  if (priceEl) priceEl.value = price;
}

function simpanBookingBaru() {
  const name = document.getElementById('modal-snc-name')?.value?.trim();
  const phone = document.getElementById('modal-snc-phone')?.value?.trim();
  const pkg = document.getElementById('modal-snc-pkg')?.value;
  const room = document.getElementById('modal-snc-room')?.value;
  const time = document.getElementById('modal-snc-time')?.value;
  const price = Number(document.getElementById('modal-snc-price')?.value || 650000);
  const memSel = document.getElementById('modal-snc-member-select');
  const memOpt = memSel ? memSel.options[memSel.selectedIndex] : null;
  const memNo = memOpt?.dataset?.no || null;
  const memTier = memOpt?.dataset?.tier ? memOpt.dataset.tier + ' Member' : 'VIP Sanctuary Guest';

  if (!name) {
    if (typeof toast === 'function') toast('Nama tamu wajib diisi', 'err');
    return;
  }

  const bookingId = 'SNC-2026-' + Math.floor(100 + Math.random() * 900);

  SANCTUARY_STATE.bookings.push({
    id: bookingId,
    jam: time || '14:00 - 15:30 (90 Menit)',
    tamu: name,
    tipe_member: memTier,
    telepon: phone || '0812-9900-1122',
    treatment: pkg,
    room: room || 'Private Suite Lavender 03',
    terapis: 'Terapis Senior On-Duty',
    biaya: price,
    status: 'Terkonfirmasi',
    member_no: memNo
  });

  // Kirim WA konfirmasi booking
  if (phone && typeof WA_GATEWAY !== 'undefined') {
    const orgName = localStorage.getItem('ol_org_name') || 'Queen Sanctuary & Medical Spa - AVA GLOBAL';
    const waMsg =
      `*${orgName}*\n` +
      `Yth. *${name}*,\n\n` +
      `Reservasi sesi perawatan Anda telah kami konfirmasi ✅\n\n` +
      `📋 *Booking ID:* ${bookingId}\n` +
      `🌿 *Treatment:* ${pkg}\n` +
      `🛋️ *Ruangan:* ${room}\n` +
      `⏰ *Waktu:* ${time}\n` +
      `💵 *Estimasi Biaya:* Rp ${price.toLocaleString('id-ID')}\n\n` +
      `Mohon hadir 10 menit sebelum waktu reservasi untuk relaksasi awal. Terima kasih! 🙏`;

    WA_GATEWAY.sendMessage({ to: phone, message: waMsg }).catch(()=>{});
  }

  if (typeof closeModalForce === 'function') closeModalForce();
  if (typeof toast === 'function') toast(`✅ Reservasi untuk ${name} berhasil dikonfirmasi!`, 'ok');
  renderSanctuaryBooking();
}

function openTambahMemberModal() {
  const modalHtml = `
    <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
      <div class="modal-title" style="font-size:16px; font-weight:800;">+ Registrasi VIP Member Sanctuary</div>
      <button class="modal-close" onclick="closeModalForce()">✕</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>Nama Lengkap Member *</label>
        <input type="text" id="modal-vip-name" class="input" placeholder="Nama Member">
      </div>
      <div class="form-group">
        <label>Nomor WhatsApp *</label>
        <input type="text" id="modal-vip-phone" class="input" placeholder="08xxxxxxxxxx">
      </div>
      <div class="form-group">
        <label>Tier Membership</label>
        <select id="modal-vip-tier" class="input" onchange="onTierChange(this)">
          <option value="VIP Gold" data-sessions="8">VIP Gold (Paket 8 Sesi + Free V-Steam)</option>
          <option value="Black Diamond" data-sessions="16">Black Diamond (Paket 16 Sesi Unlimited Suite)</option>
          <option value="Silver Care" data-sessions="4">Silver Care (Paket 4 Sesi Dasar)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Jumlah Kuota Sesi Awal</label>
        <input type="number" id="modal-vip-sessions" class="input" value="8">
      </div>
      <div class="modal-footer" style="margin-top:10px;">
        <button class="btn btn-ghost" onclick="closeModalForce()">Batal</button>
        <button class="btn btn-teal" onclick="simpanMemberBaru()">💾 Aktivasi Membership</button>
      </div>
    </div>
  `;
  if (typeof openModal === 'function') openModal(modalHtml, 'medium');
}

function onTierChange(sel) {
  const opt = sel.options[sel.selectedIndex];
  const sessions = opt.dataset.sessions || 8;
  const sessEl = document.getElementById('modal-vip-sessions');
  if (sessEl) sessEl.value = sessions;
}

function simpanMemberBaru() {
  const name = document.getElementById('modal-vip-name')?.value?.trim();
  const phone = document.getElementById('modal-vip-phone')?.value?.trim();
  const tier = document.getElementById('modal-vip-tier')?.value;
  const sessions = Number(document.getElementById('modal-vip-sessions')?.value || 8);

  if (!name) {
    if (typeof toast === 'function') toast('Nama member wajib diisi', 'err');
    return;
  }

  const memNo = 'M-AVA-0' + Math.floor(120 + Math.random() * 800);
  const totalSpend = sessions * 650000;

  SANCTUARY_STATE.vipMembers.unshift({
    noMember: memNo,
    nama: name,
    tier: tier || 'VIP Gold',
    sisaSesi: sessions,
    joinDate: new Date().toISOString().slice(0,10),
    totalSpend: totalSpend,
    status: 'Aktif',
    telepon: phone || '0812-9900-1122'
  });

  // Posting pendapatan membership baru ke buku besar
  try {
    if (typeof postToLedger === 'function' && totalSpend > 0) {
      postToLedger('cashier.bank', totalSpend, `Pembelian Membership VIP Sanctuary ${tier} (${name})`, 'sanctuary_members', memNo).catch(()=>{});
    }
  } catch(e) {}

  if (typeof closeModalForce === 'function') closeModalForce();
  if (typeof toast === 'function') toast(`✅ Member VIP ${name} (${memNo}) berhasil diaktivasi!`, 'ok');
  renderSanctuaryBooking();
}

// ═══════════════════════════════════════════════════════════════
// PENGAKUAN PENDAPATAN BERTAHAP PSAK 72 (DEFERRED REVENUE AMORTIZATION)
// ═══════════════════════════════════════════════════════════════
function recognizeSanctuaryRevenue(bookingId) {
  const booking = SANCTUARY_STATE.bookings.find(b => b.id === bookingId);
  if (!booking) return null;

  const sessionFee = booking.biaya || 650000;
  const journalRecognition = {
    entry_no: `JV/SANCT/${new Date().toISOString().slice(0,7).replace('-','')}/${booking.id.replace(/[^0-9]/g,'').padStart(5,'0')}`,
    date: new Date().toISOString().slice(0, 10),
    brand_code: 'SANCT',
    kbli_code: '96122',
    cost_center_code: 'CC-SNC-SPA',
    location_code: 'LOC-PST-01',
    description: `Pengakuan Pendapatan Sesi Treatment ${booking.treatment} - ${booking.tamu} (${booking.member_no || 'Non-Member'})`,
    lines: [
      {
        account_code: '2105',
        account_name: 'Pendapatan Diterima Dimuka - Queen Sanctuary',
        debit: sessionFee,
        credit: 0
      },
      {
        account_code: '4105',
        account_name: 'Pendapatan Jasa Sanctuary & Medical Spa',
        debit: 0,
        credit: sessionFee
      }
    ]
  };

  return journalRecognition;
}

window.renderSanctuaryBooking = renderSanctuaryBooking;
window.gantiTabSanctuary = gantiTabSanctuary;
window.openBookingBaruModal = openBookingBaruModal;
window.simpanBookingBaru = simpanBookingBaru;
window.openTambahMemberModal = openTambahMemberModal;
window.simpanMemberBaru = simpanMemberBaru;
window.checkinTamuSanctuary = checkinTamuSanctuary;
window.selesaikanSesiSanctuary = selesaikanSesiSanctuary;
window.kirimStrukWASanctuary = kirimStrukWASanctuary;
window.resetRoomStatus = resetRoomStatus;
window.topupSesiMember = topupSesiMember;
window.onSanctuaryMemberSelected = onSanctuaryMemberSelected;
window.onSanctuaryPkgChanged = onSanctuaryPkgChanged;
window.onTierChange = onTierChange;
window.recognizeSanctuaryRevenue = recognizeSanctuaryRevenue;
