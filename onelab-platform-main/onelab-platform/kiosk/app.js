// ═══════════════════════════════════════════
// KIOSK APP - Logic & Interactivity
// ═══════════════════════════════════════════

// Update Date & Clock
function updateClock() {
  const clockEl = document.getElementById('kiosk-time');
  const dateEl = document.getElementById('kiosk-date');
  
  if (!clockEl || !dateEl) return;

  const now = new Date();
  
  // Format Clock: HH:MM:SS
  const hrs = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  clockEl.textContent = `${hrs}:${mins}:${secs}`;

  // Format Date (ID Locale)
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateEl.textContent = now.toLocaleDateString('id-ID', options);
}

// Queue Counter (Local Storage state just for mockup demo)
function getNextQueueNumber(type) {
  const key = `kiosk_queue_${type.toLowerCase()}`;
  let current = parseInt(localStorage.getItem(key)) || 0;
  current += 1;
  localStorage.setItem(key, current);
  return current;
}

// Print queue action
function ambilAntrian(layanan) {
  const overlay = document.getElementById('print-modal');
  const preview = document.getElementById('ticket-preview');
  
  if (!overlay || !preview) return;

  // Generate Prefix and Ticket number
  let prefix = 'A';
  let deskripsi = 'Klinik Umum / Spesialis';
  if (layanan === 'Laboratorium') {
    prefix = 'B';
    deskripsi = 'Laboratorium';
  } else if (layanan === 'MCU') {
    prefix = 'C';
    deskripsi = 'Medical Check Up';
  }

  const num = getNextQueueNumber(layanan);
  const formattedNum = `${prefix}-${String(num).padStart(3, '0')}`;
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Inject Ticket Preview
  preview.innerHTML = `
    <div class="ticket-header">AVAHEALTH</div>
    <div class="ticket-type">NOMOR ANTRIAN - ${deskripsi}</div>
    <div class="ticket-number">${formattedNum}</div>
    <div style="font-size: 13px; color: #475569; margin-bottom: 8px;">Silakan tunggu nomor Anda dipanggil</div>
    <div class="ticket-date">${dateStr} &bull; ${timeStr} WIB</div>
  `;

  // Open Modal
  overlay.classList.add('open');

  // Auto close modal after 6 seconds
  setTimeout(() => {
    closeModal();
  }, 6000);
}

function closeModal() {
  const overlay = document.getElementById('print-modal');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
});
