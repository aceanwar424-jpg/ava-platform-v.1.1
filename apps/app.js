// ═══════════════════════════════════════════
// MOBILE APPS - Logic & Multi-Role Datasets
// ═══════════════════════════════════════════

// --- MOCK DATASETS ---
const MOCK_CORPORATES = [
  { name: 'Ahmad Subarjo', id: 'EMP-001', test: 'Paket MCU Eksekutif A', status: 'fit', remark: 'Fit to Work &bull; Sehat' },
  { name: 'Siti Rahma', id: 'EMP-002', test: 'Paket MCU Dasar', status: 'fit', remark: 'Fit to Work &bull; Sehat' },
  { name: 'Bambang Wijaya', id: 'EMP-003', test: 'Paket MCU Driver', status: 'unfit', remark: 'Unfit / Review (Hipertensi Gr. II)' },
  { name: 'Indah Permata', id: 'EMP-004', test: 'Paket MCU Dasar', status: 'pending', remark: 'Proses Analisa Lab' },
  { name: 'Dedi Kurniawan', id: 'EMP-005', test: 'Paket MCU Eksekutif B', status: 'fit', remark: 'Fit to Work &bull; Sehat' }
];

const MOCK_REFERRALS = [
  { name: 'Budi Santoso', phone: '08123456789', test: 'Darah Lengkap + Urinalisis', status: 'finished', fee: 150000, date: '19/07/2026' },
  { name: 'Rian Hidayat', phone: '08567890123', test: 'Profil Lipid + Asam Urat', status: 'waiting', fee: 100000, date: '19/07/2026' },
  { name: 'Citra Kirana', phone: '08789012345', test: 'HBsAg + Anti-HBs', status: 'finished', fee: 80000, date: '18/07/2026' }
];

// --- APP RUNTIME STATE ---
let currentRole = 'patient';
let currentPhase = 'fase1';
let referrals = [...MOCK_REFERRALS];
let queueSimulatorInterval = null;
let currentCalledQueue = 40; // Counter queue starts at A-040

// Switch Screens
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

// Switch Timeline Phase
function switchTimelinePhase(phaseId) {
  currentPhase = phaseId;

  // Sync tab active states
  document.querySelectorAll('.t-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === `btn-${phaseId}`);
  });

  // Hide all panels
  document.querySelectorAll('.phase-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Show active panel matching role + phase
  let prefix = 'p';
  if (currentRole === 'corporate') prefix = 'c';
  if (currentRole === 'referral') prefix = 'r';

  const targetPanel = document.getElementById(`${prefix}-${phaseId}-panel`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
}

// Update Login Form UI dynamically based on role selection
function updateLoginFormUI(role) {
  const formTitleEl = document.getElementById('login-form-title');
  const labelEl = document.getElementById('username-label');
  const inputEl = document.getElementById('username');
  const footerEl = document.getElementById('login-footer-desc');

  if (!formTitleEl || !labelEl || !inputEl || !footerEl) return;

  // Clear inputs on role change
  inputEl.value = '';
  document.getElementById('password').value = '';

  if (role === 'corporate') {
    formTitleEl.textContent = 'Portal Kemitraan Corporate';
    labelEl.textContent = 'ID Kemitraan / Email Perusahaan';
    inputEl.placeholder = 'Contoh: MITRA-0293 atau email kantor';
    footerEl.innerHTML = 'Pengajuan mitra baru? Hubungi <a href="#">Tim Marketing</a>';
  } else if (role === 'referral') {
    formTitleEl.textContent = 'Portal Faskes Referral';
    labelEl.textContent = 'NPA ID / Email Faskes';
    inputEl.placeholder = 'Contoh: NPA-12948 atau email klinik';
    footerEl.innerHTML = 'Pengajuan dokter perujuk? Hubungi <a href="#">Layanan Medis</a>';
  } else {
    // Patient
    formTitleEl.textContent = 'Portal Pasien';
    labelEl.textContent = 'No. Rekam Medis / Email';
    inputEl.placeholder = 'Contoh: RM-12948 atau email Anda';
    footerEl.innerHTML = 'Belum memiliki akun? <a href="#" onclick="openRegisterModal()">Daftar Pasien Baru</a>';
  }
}

// Open/Close Registration Modal
function openRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (modal) modal.classList.add('open');
}

function closeRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (modal) modal.classList.remove('open');
}

function handleRegistrationSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  
  closeRegisterModal();
  alert(`Registrasi Akun Mandiri berhasil! No. Rekam Medis (RM) Anda adalah RM-12948. Silakan gunakan untuk masuk.`);
  
  // Fill the login form with the mock RM number
  const inputEl = document.getElementById('username');
  if (inputEl) inputEl.value = 'RM-12948';
}

// Render Corporate List
function renderCorporateList() {
  const container = document.getElementById('corporate-list-container');
  if (!container) return;

  container.innerHTML = MOCK_CORPORATES.map(emp => {
    let badgeClass = 'badge-pending';
    if (emp.status === 'fit') badgeClass = 'badge-fit';
    if (emp.status === 'unfit') badgeClass = 'badge-unfit';

    return `
      <div class="list-row">
        <div class="list-row-avatar">${emp.name[0]}</div>
        <div class="list-row-details">
          <h5>${emp.name}</h5>
          <p>${emp.id} &bull; ${emp.test}</p>
          <p style="font-size:11px; margin-top:2px; color: var(--text-muted);">${emp.remark}</p>
        </div>
        <span class="badge ${badgeClass}">${emp.status}</span>
      </div>
    `;
  }).join('');
}

// Render Referral List
function renderReferralList() {
  const container = document.getElementById('referral-list-container');
  if (!container) return;

  container.innerHTML = referrals.map(ref => {
    let badgeClass = 'badge-pending';
    let statusText = 'Menunggu';
    if (ref.status === 'finished') {
      badgeClass = 'badge-finished';
      statusText = 'Selesai';
    }

    return `
      <div class="list-row">
        <div class="list-row-avatar">👤</div>
        <div class="list-row-details">
          <h5>${ref.name}</h5>
          <p>${ref.test}</p>
          <p style="font-size:11px; margin-top:2px; color: var(--teal);">Fee Rujukan: Rp ${ref.fee.toLocaleString('id-ID')}</p>
        </div>
        <div style="text-align:right; display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
          <span class="badge ${badgeClass}">${statusText}</span>
          <span style="font-size:10px; color: var(--text-muted);">${ref.date}</span>
        </div>
      </div>
    `;
  }).join('');

  // Update Stats
  const totalEl = document.getElementById('r-total-referrals');
  const feeEl = document.getElementById('r-commission');
  
  if (totalEl) totalEl.textContent = `${referrals.length} Pasien`;
  
  if (feeEl) {
    const totalFee = referrals.reduce((sum, r) => sum + r.fee, 0);
    feeEl.textContent = `Rp ${totalFee.toLocaleString('id-ID')}`;
  }
}

// Handle Login Submission
function handleLogin(event) {
  event.preventDefault();
  
  const usernameInput = document.getElementById('username').value.trim();
  const selectedRole = document.querySelector('input[name="login-role"]:checked').value;
  
  currentRole = selectedRole;
  
  const avatarEl = document.getElementById('user-avatar');
  const welcomeEl = document.getElementById('user-welcome');
  const roleBadgeEl = document.getElementById('user-role-badge');
  
  // Hide all panels first
  document.querySelectorAll('.view-panel').forEach(el => {
    el.classList.remove('active');
  });

  // Check if credentials match the super admin
  const isSuperAdmin = (usernameInput === 'aceanwar424@gmail.com');
  const adminRealName = 'Ace Darojatun Anwar';

  if (selectedRole === 'corporate') {
    avatarEl.textContent = 'C';
    avatarEl.style.background = 'linear-gradient(135deg, #f59e0b, #ea580c)';
    welcomeEl.textContent = isSuperAdmin ? `PT. AvaHealth (${adminRealName})` : (usernameInput || 'PT. Sukses Mandiri');
    roleBadgeEl.textContent = isSuperAdmin ? 'Super Admin Korporasi' : 'Mitra Korporasi';
    roleBadgeEl.style.color = '#f59e0b';
    
    // Render Corporate List
    renderCorporateList();
    document.getElementById('corporate-view').classList.add('active');
  } 
  else if (selectedRole === 'referral') {
    avatarEl.textContent = 'R';
    avatarEl.style.background = 'linear-gradient(135deg, #14b8a6, #0d9488)';
    welcomeEl.textContent = isSuperAdmin ? `Dr. ${adminRealName}` : (usernameInput || 'Klinik Medika Pratama');
    roleBadgeEl.textContent = isSuperAdmin ? 'Super Admin Referral' : 'Faskes / Dokter Perujuk';
    roleBadgeEl.style.color = '#14b8a6';
    
    // Render Referral List
    renderReferralList();
    document.getElementById('referral-view').classList.add('active');
  } 
  else {
    // Default: Patient
    const finalName = isSuperAdmin ? adminRealName : (usernameInput || 'Budi Santoso');
    avatarEl.textContent = 'P';
    avatarEl.style.background = 'linear-gradient(135deg, #0ea5e9, #0284c7)';
    welcomeEl.textContent = isSuperAdmin ? `Halo, ${finalName}` : finalName;
    roleBadgeEl.textContent = isSuperAdmin ? 'Super Admin Pasien' : 'Pasien Terverifikasi';
    roleBadgeEl.style.color = '#38bdf8';
    
    // Initialize Member Card Name
    const memberNameEl = document.getElementById('p-member-name');
    if (memberNameEl) memberNameEl.textContent = finalName;
    
    document.getElementById('patient-view').classList.add('active');
  }
  
  // Always reset timeline phase to Fase 1 on login
  switchTimelinePhase('fase1');
  showScreen('dashboard-screen');
}

// Logout
function handleLogout() {
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  if (queueSimulatorInterval) {
    clearInterval(queueSimulatorInterval);
    queueSimulatorInterval = null;
  }
  // Hide active queue ticket on logout
  document.getElementById('p-active-ticket-box').style.display = 'none';
  showScreen('login-screen');
}

// --- BOOKING MODAL & QUEUE SIMULATOR ---
function openBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (modal) modal.classList.add('open');
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (modal) modal.classList.remove('open');
}

function submitBookingForm(event) {
  event.preventDefault();
  
  const serviceName = document.getElementById('book-service').value.trim();
  if (!serviceName) return;

  // Show ticket widget
  const ticketBox = document.getElementById('p-active-ticket-box');
  const ticketNumEl = document.getElementById('p-ticket-number');
  const ticketServiceEl = document.getElementById('p-ticket-service');
  const ticketTimeEl = document.getElementById('p-ticket-time');
  const ticketCurrentEl = document.getElementById('p-ticket-current');

  const myQueueNum = 45; // Fixed queue ticket: A-045
  currentCalledQueue = 40; // Reset simulator

  ticketNumEl.textContent = `A-0${myQueueNum}`;
  ticketServiceEl.textContent = serviceName;
  ticketTimeEl.textContent = '12 Menit lagi';
  ticketCurrentEl.textContent = `A-0${currentCalledQueue}`;
  ticketBox.style.display = 'block';

  closeBookingModal();
  alert('Booking berhasil! Tiket antrean aktif Anda telah dibuat.');

  // Start live simulator
  if (queueSimulatorInterval) clearInterval(queueSimulatorInterval);
  
  queueSimulatorInterval = setInterval(() => {
    if (currentCalledQueue < myQueueNum) {
      currentCalledQueue += 1;
      ticketCurrentEl.textContent = `A-0${currentCalledQueue}`;
      
      const minutesLeft = (myQueueNum - currentCalledQueue) * 2.5;
      if (minutesLeft > 0) {
        ticketTimeEl.textContent = `${Math.ceil(minutesLeft)} Menit lagi`;
      } else {
        ticketTimeEl.textContent = 'Silakan menuju Counter!';
        ticketTimeEl.style.color = 'var(--success)';
        clearInterval(queueSimulatorInterval);
      }
    }
  }, 10000); // Progress queue counter every 10 seconds
}

// --- LAB RESULTS & AI ASSESSOR ---
function openLabResultsModal() {
  const modal = document.getElementById('lab-results-modal');
  if (!modal) return;

  const aiTextEl = document.getElementById('ai-assessment-text');
  aiTextEl.innerHTML = '<span style="color: var(--text-muted);">🤖 Membaca hasil lab dan memproses analisis medis...</span>';
  
  modal.classList.add('open');

  // Simulate AI typing after 1.8 seconds
  setTimeout(() => {
    aiTextEl.innerHTML = `
      <p style="margin-bottom:8px; font-weight: 600; color:var(--error);">⚠️ Temuan Utama:</p>
      <ul style="margin-left: 16px; margin-bottom: 12px; display:flex; flex-direction:column; gap:4px;">
        <li><strong>Hiperkolesterolemia Ringan:</strong> Kolesterol Total Anda (245 mg/dL) berada di atas batas normal (&lt;200).</li>
        <li><strong>Batas Glukosa Puasa Tinggi:</strong> Gula darah puasa Anda (126 mg/dL) mengindikasikan kondisi Prediabetes.</li>
      </ul>
      <p style="margin-bottom:8px; font-weight: 600; color:var(--teal);">💡 Rekomendasi AvaHealth:</p>
      <p style="color: var(--text-muted); font-size:12px; line-height:1.4;">
        Kurangi asupan lemak jenuh dan karbohidrat sederhana. Lakukan aktivitas fisik sedang (jalan cepat) minimal 150 menit per minggu. Jadwalkan konsultasi dengan dokter untuk memverifikasi kondisi gula darah puasa Anda.
      </p>
    `;
  }, 1800);
}

function closeLabResultsModal() {
  const modal = document.getElementById('lab-results-modal');
  if (modal) modal.classList.remove('open');
}

// --- REFERRAL MODAL FORM ---
function openReferralForm() {
  const modal = document.getElementById('referral-modal');
  if (modal) modal.classList.add('open');
}

function closeReferralForm() {
  const modal = document.getElementById('referral-modal');
  if (modal) modal.classList.remove('open');
}

function submitReferralForm(event) {
  event.preventDefault();
  
  const name = document.getElementById('ref-patient-name').value.trim();
  const phone = document.getElementById('ref-patient-phone').value.trim();
  const test = document.getElementById('ref-lab-test').value.trim();
  
  if (!name || !phone || !test) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Add new referral
  referrals.unshift({
    name: name,
    phone: phone,
    test: test,
    status: 'waiting',
    fee: 90000,
    date: dateStr
  });

  // Re-render
  renderReferralList();

  // Reset form inputs
  document.getElementById('ref-patient-name').value = '';
  document.getElementById('ref-patient-phone').value = '';
  document.getElementById('ref-lab-test').value = '';

  // Close modal
  closeReferralForm();
  
  alert('Rujukan pasien berhasil dikirim!');
}

// --- PEER-TO-PEER CHAT CONSULTATION ---
function sendConsultMessage(event) {
  event.preventDefault();
  
  const inputEl = document.getElementById('chat-input');
  const messageText = inputEl.value.trim();
  if (!messageText) return;

  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Append sent message
  const msgSent = document.createElement('div');
  msgSent.className = 'chat-msg msg-sent';
  msgSent.innerHTML = `
    <p>${messageText}</p>
    <span class="msg-time">${timeStr}</span>
  `;
  container.appendChild(msgSent);
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  
  // Reset input
  inputEl.value = '';

  // Simulate Pathology Response after 2.5 seconds
  setTimeout(() => {
    const responseTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const msgReceived = document.createElement('div');
    msgReceived.className = 'chat-msg msg-received';
    msgReceived.innerHTML = `
      <p>Baik Dokter, kami segera lakukan konfirmasi mikroskopis manual sediaan apus darah tepi. Hasil koreksinya akan kami unggah langsung ke sistem rujukan dalam waktu 30 menit.</p>
      <span class="msg-time">${responseTime}</span>
    `;
    container.appendChild(msgReceived);
    container.scrollTop = container.scrollHeight;
  }, 2500);
}

// --- WEARABLE SENSOR DATA SYNC SIMULATOR ---
function syncWearableData() {
  const stepsEl = document.getElementById('w-steps');
  const stepsBarEl = document.getElementById('w-steps-bar');
  const heartEl = document.getElementById('w-heart');

  if (!stepsEl || !heartEl) return;

  stepsEl.textContent = 'Syncing...';
  heartEl.textContent = 'Syncing...';

  setTimeout(() => {
    // Generate random realistic metrics
    const randomSteps = Math.floor(Math.random() * (9900 - 7500 + 1)) + 7500;
    const stepsPercent = Math.min(Math.round((randomSteps / 10000) * 100), 100);
    const randomHeart = Math.floor(Math.random() * (86 - 66 + 1)) + 66;

    stepsEl.textContent = randomSteps.toLocaleString('id-ID');
    if (stepsBarEl) stepsBarEl.style.width = `${stepsPercent}%`;
    heartEl.innerHTML = `${randomHeart} <small>bpm</small>`;

    alert('Data kesehatan dari Smartwatch berhasil disinkronkan!');
  }, 1200);
}

// ════════════════════════ FUTURISTIC SIMULATORS ════════════════════════

// Fase 2: Continuous Biosensor Pulse Scanner
function simulateBiosensorPulse() {
  const sugarEl = document.getElementById('f2-sugar-val');
  const uricEl = document.getElementById('f2-uric-val');

  if (!sugarEl || !uricEl) return;

  sugarEl.textContent = 'Scanning...';
  uricEl.textContent = 'Scanning...';

  setTimeout(() => {
    const randomSugar = Math.floor(Math.random() * (116 - 92 + 1)) + 92;
    const randomUric = (Math.random() * (6.6 - 5.0) + 5.0).toFixed(1);

    sugarEl.textContent = `${randomSugar} mg/dL`;
    uricEl.textContent = `${randomUric} mg/dL`;

    alert('Scan sensor tubuh selesai. Data biosensor Anda stabil dan sinkron.');
  }, 1200);
}

// Fase 4: CRISPR Age Reversal
function simulateAgeReversal() {
  const ageEl = document.getElementById('f4-bio-age');
  if (!ageEl) return;

  let currentAge = parseInt(ageEl.textContent) || 25;
  
  if (currentAge > 21) {
    currentAge -= 1;
    ageEl.textContent = `${currentAge} Tahun`;
    alert(`Terapi sel penuaan berhasil dipicu. Usia biologis Anda ter-update menjadi ${currentAge} tahun.`);
  } else {
    alert('Usia biologis Anda telah mencapai performa puncak seluler (21 tahun). Terapi optimal tercapai!');
  }
}
