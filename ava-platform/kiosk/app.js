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

// Print queue action
async function ambilAntrian(layanan) {
  const overlay = document.getElementById('print-modal');
  const preview = document.getElementById('ticket-preview');
  if (!overlay || !preview) return;

  // Generate Prefix and Ticket number
  const SERVICE_CONFIG = {
    'Umum': { prefix: 'A', desc: 'Pendaftaran Poliklinik Rawat Jalan', wait: 2 },
    'Laboratorium': { prefix: 'B', desc: 'Laboratorium & Sampling Patologi', wait: 1 },
    'MCU': { prefix: 'C', desc: 'Medical Check Up & Skrining', wait: 3 },
    'Sanctuary': { prefix: 'S', desc: 'Queen Sanctuary VIP Wellness', wait: 0 },
    'Spesialis': { prefix: 'D', desc: 'Konsultasi Dokter Spesialis', wait: 2 },
    'Farmasi': { prefix: 'F', desc: 'Farmasi & Pelunasan Kasir', wait: 4 }
  };

  const cfg = SERVICE_CONFIG[layanan] || { prefix: 'A', desc: 'Layanan Umum' };
  const tombol = Array.from(document.querySelectorAll('.kiosk-card'));
  const status = document.getElementById('queue-status');
  tombol.forEach(x => { x.disabled = true; });
  if (status) status.textContent = 'Menerbitkan nomor antrean…';

  let tiket;
  try {
    if (!window.AVA_QUEUE_PUBLIC) throw new Error('Modul antrean belum termuat');
    tiket = await window.AVA_QUEUE_PUBLIC.issue(layanan);
  } catch (e) {
    const pesan = `Nomor belum diterbitkan: ${e.message || 'layanan antrean tidak tersedia'}`;
    if (status) status.textContent = pesan;
    alert(pesan);
    return;
  } finally {
    tombol.forEach(x => { x.disabled = false; });
  }

  const formattedNum = tiket.queue_number;
  const ahead = Number.isFinite(Number(tiket.ahead)) ? Number(tiket.ahead) : 0;
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Inject Ticket Preview
  preview.innerHTML = `
    <div class="ticket-header" style="font-weight:800; color:#0A2342; font-size:15px; letter-spacing:0.5px;">PT AVA HEALTH SOLUTION</div>
    <div class="ticket-type" style="font-size:12px; font-weight:700; color:#0E7C86; margin:8px 0;">${cfg.desc.toUpperCase()}</div>
    <div class="ticket-number" style="font-size:52px; font-weight:900; color:#0A2342; line-height:1; margin:14px 0; letter-spacing:-1px;">${formattedNum}</div>
    <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">Sisa antrian di depan Anda: <strong>${ahead} orang</strong></div>
    <div style="font-size: 12px; color: #64748B; margin-bottom: 10px;">Silakan perhatikan layar monitor antrian di ruang tunggu</div>
    <div class="ticket-date" style="font-size:11px; color:#94A3B8; border-top:1.5px dashed #CBD5E1; padding-top:8px;">${dateStr} &bull; ${timeStr} WIB</div>
  `;

  // Play Sound / Voice Output
  if ('speechSynthesis' in window) {
    try {
      const speech = new SpeechSynthesisUtterance(`Nomor antrian ${formattedNum.replace('-', ' ')}, layanan ${cfg.desc}. Silakan ambil tiket Anda.`);
      speech.lang = 'id-ID';
      speech.rate = 1.0;
      window.speechSynthesis.speak(speech);
    } catch(e){}
  }

  // Trigger Direct Thermal ESC/POS Print (via Port 9999 / WebUSB / Driver)
  if (typeof ESCPOS_PRINTER !== 'undefined') {
    try {
      const rawTicket = ESCPOS_PRINTER.buildQueueTicket({
        faskesName: 'PT AVA HEALTH SOLUTION',
        queueNumber: formattedNum,
        serviceName: cfg.desc.toUpperCase(),
        waitCount: ahead
      });
      ESCPOS_PRINTER.printDirect(rawTicket, 'kiosk_queue');
    } catch(e){}
  }

  // Open Modal
  overlay.classList.add('open');
  if (status) {
    const mode = window.AVA_QUEUE_PUBLIC?.mode === 'simulasi-lokal' ? 'Mode simulasi lokal aktif' : 'Terhubung ke antrean layanan';
    status.textContent = `${mode} · Nomor ${formattedNum} berhasil diterbitkan.`;
  }

  // Auto close modal after 5 seconds
  setTimeout(() => {
    closeModal();
  }, 5000);
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
  const status = document.getElementById('queue-status');
  if (status) {
    status.textContent = window.AVA_QUEUE_PUBLIC?.mode === 'simulasi-lokal'
      ? 'Mode simulasi lokal · tiket akan muncul pada antrian.localhost.'
      : 'Kiosk terhubung ke antrean layanan.';
  }
});
