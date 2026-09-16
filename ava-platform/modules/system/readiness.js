/* AVA Readiness & Integration Control Hub
   OWNED_BY: ava | Control surface only. Does not mutate clinical data. */
(function () {
  'use strict';

  const PANELS = {
    'his-integration': {
      eyebrow: 'HIS · LIS · BILLING', title: 'Hub Integrasi & Rekonsiliasi',
      intro: 'Satu tempat untuk melihat status order, hasil, billing handoff, retry, dan pengecualian lintas HIS–LIS. Pembayaran tetap dimiliki HIS; panel ini hanya menunjukkan kontrak dan status.',
      steps: ['Order diterima HIS', 'Order diteruskan ke LIS', 'Hasil dikirim kembali', 'Billing diproses HIS', 'Rekonsiliasi selesai'],
      owners: ['HIS Admission', 'LIS Supervisor', 'Finance / HIS'],
    },
    'lis-integration': {
      eyebrow: 'LIS · TRACEABILITY', title: 'Inbox Order & Hasil LIS',
      intro: 'Daftar kerja untuk memantau order dari HIS, kelayakan spesimen, hasil yang perlu dikirim kembali, koreksi, retry, dan jejak audit.',
      steps: ['Inbox order HIS', 'Sampling & chain of custody', 'Analitik / QC', 'Validasi & rilis', 'Callback ke HIS'],
      owners: ['LIS Front Desk', 'Analis / Validator', 'LIS Supervisor'],
    },
    'wellness-program': {
      eyebrow: 'CARE · WELLNESS', title: 'Program, Peserta & Tindak Lanjut',
      intro: 'Ruang kendali program kesehatan yang menghubungkan peserta, consent, jadwal, kehadiran, catatan layanan, follow-up dan evaluasi pengalaman.',
      steps: ['Rancang program', 'Daftarkan peserta & consent', 'Jalankan sesi', 'Tindak lanjut', 'Evaluasi mutu'],
      owners: ['Care Coordinator', 'Wellness Supervisor', 'Quality Lead'],
    },
    'partner-rewards': {
      eyebrow: 'PARTNERSHIP · REWARD', title: 'Challenge & Rekonsiliasi Mitra',
      intro: 'Kerangka operasional untuk challenge, kuota voucher, verifikasi pemenuhan, penukaran, rekonsiliasi mitra dan perlindungan data peserta.',
      steps: ['Definisikan challenge', 'Tetapkan kuota & masa berlaku', 'Verifikasi peserta', 'Terbitkan / tukar voucher', 'Rekonsiliasi mitra'],
      owners: ['Program Owner', 'Partner Manager', 'Finance / Reconciliation'],
    },
    'nutrition-quality': {
      eyebrow: 'NUTRITION · PLANT', title: 'Batch, Release & Product Quality',
      intro: 'Kontrol kesiapan produksi dan mutu: formula berversi, bahan, batch record, karantina, release, deviasi, complaint dan recall.',
      steps: ['Formula & BOM disetujui', 'Bahan diverifikasi', 'Batch diproduksi', 'QC & deviasi', 'Release / quarantine'],
      owners: ['R&D', 'Production', 'QA / QC'],
    },
    'sanctuary-operations': {
      eyebrow: 'SANCTUARY · SERVICE', title: 'Operasional Sanctuary',
      intro: 'Alur operasional untuk booking, screening, consent, kapasitas ruang, penugasan therapist, hygiene, no-show, saldo paket dan follow-up.',
      steps: ['Booking & screening', 'Consent & package ledger', 'Penugasan ruang/staf', 'Sesi & hygiene', 'Follow-up & CSAT'],
      owners: ['Front Desk', 'Therapist Lead', 'Sanctuary Supervisor'],
    },
    'tech-delivery': {
      eyebrow: 'AVA TECH · DELIVERY', title: 'Delivery, SLA & Customer Success',
      intro: 'Pusat kesiapan komersialisasi sistem: implementasi, scope, acceptance, SLA, incident, release, adopsi tenant dan rekonsiliasi lisensi.',
      steps: ['Discovery & scope', 'Pilot & acceptance', 'Go-live', 'SLA & incident', 'Adopsi & renewal'],
      owners: ['Implementation Lead', 'Support Lead', 'Customer Success'],
    },
    'evidence-register': {
      eyebrow: 'HQ · QUALITY GOVERNANCE', title: 'Evidence Register & Risk',
      intro: 'Registri bukti untuk SOP, izin, sertifikasi, audit, CAPA, risiko, pemilik dokumen dan tanggal kedaluwarsa. Status bukti harus jelas sebelum dipakai sebagai klaim.',
      steps: ['Daftarkan bukti', 'Tetapkan pemilik & masa berlaku', 'Review / audit', 'CAPA & mitigasi', 'Publikasikan status terverifikasi'],
      owners: ['Quality Lead', 'Legal / Compliance', 'Unit Owner'],
    },
  };

  function esc(v) { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  function renderReadiness(params = {}) {
    const key = params.panel || params.focus || 'evidence-register';
    const panel = PANELS[key] || PANELS['evidence-register'];
    const root = document.getElementById('main-content');
    if (!root) return;
    root.innerHTML = `<div class="page-header"><div><p class="readiness-eyebrow">${esc(panel.eyebrow)}</p><h1>${esc(panel.title)}</h1><p>${esc(panel.intro)}</p></div><div class="btn-row"><button class="btn btn-ghost" onclick="navigate('dashboard')">Kembali ke dashboard</button></div></div>
      <section class="readiness-hero card"><div><span class="readiness-status">KERANGKA KENDALI · SIAP DIISI DATA OPERASIONAL</span><h2>Urutan kerja yang dapat ditelusuri.</h2><p>Panel ini memisahkan status proses, pemilik tindak lanjut, dan bukti yang diperlukan. Tidak menampilkan klaim operasional tanpa data sumber.</p></div><div class="readiness-mark" aria-hidden="true">◎</div></section>
      <section class="readiness-grid">${panel.steps.map((s,i)=>`<article class="readiness-step"><span>${String(i+1).padStart(2,'0')}</span><h3>${esc(s)}</h3><p>Status: <b>Belum tersambung ke event sumber</b></p><small>Pemilik: ${esc(panel.owners[i % panel.owners.length])}</small></article>`).join('')}</section>
      <section class="card readiness-checklist"><div class="card-title">Checklist penerimaan</div><div class="readiness-check-row"><label><input type="checkbox" disabled> ID korelasi / nomor transaksi tersedia</label><span>Belum diverifikasi</span></div><div class="readiness-check-row"><label><input type="checkbox" disabled> Retry, exception dan pemilik tindak lanjut ditetapkan</label><span>Belum diverifikasi</span></div><div class="readiness-check-row"><label><input type="checkbox" disabled> Jejak audit dan bukti perubahan tersedia</label><span>Belum diverifikasi</span></div><div class="readiness-check-row"><label><input type="checkbox" disabled> Uji penerimaan disetujui supervisor</label><span>Belum diverifikasi</span></div></section>`;
  }

  window.renderReadiness = renderReadiness;
})();
