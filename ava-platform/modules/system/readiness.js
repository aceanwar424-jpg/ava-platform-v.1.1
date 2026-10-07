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
      sources: [
        { label: 'Order lintas layanan', table: 'order_terintegrasi_papan', query: 'select=id,status&order=created_at.desc&limit=200', status: 'status' },
      ],
      destination: [
        { label: 'Order terintegrasi', page: 'his-orders' },
        { label: 'Laboratorium', page: 'lab' },
      ],
    },
    'lis-integration': {
      eyebrow: 'LIS · TRACEABILITY', title: 'Inbox Order & Hasil LIS',
      intro: 'Daftar kerja untuk memantau order dari HIS, kelayakan spesimen, hasil yang perlu dikirim kembali, koreksi, retry, dan jejak audit.',
      steps: ['Inbox order HIS', 'Sampling & chain of custody', 'Analitik / QC', 'Validasi & rilis', 'Callback ke HIS'],
      owners: ['LIS Front Desk', 'Analis / Validator', 'LIS Supervisor'],
      sources: [
        { label: 'Sampel laboratorium', table: 'lab_samples', query: 'select=id,status&limit=200', status: 'status' },
      ],
      destination: [
        { label: 'Laboratorium', page: 'lab' },
        { label: 'Otorisasi hasil', page: 'lab-validation' },
      ],
    },
    'wellness-program': {
      eyebrow: 'CARE · WELLNESS', title: 'Program, Peserta & Tindak Lanjut',
      intro: 'Ruang kendali program kesehatan yang menghubungkan peserta, consent, jadwal, kehadiran, catatan layanan, follow-up dan evaluasi pengalaman.',
      steps: ['Rancang program', 'Daftarkan peserta & consent', 'Jalankan sesi', 'Tindak lanjut', 'Evaluasi mutu'],
      owners: ['Care Coordinator', 'Wellness Supervisor', 'Quality Lead'],
      sources: [
        { label: 'Program dan agregat wellness', rpc: 'wellness_admin_dashboard' },
      ],
      destination: [
        { label: 'Orkestrasi wellness', page: 'his-wellness' },
        { label: 'Portal wellness', page: 'portal-wellness' },
      ],
    },
    'partner-rewards': {
      eyebrow: 'PARTNERSHIP · REWARD', title: 'Challenge & Rekonsiliasi Mitra',
      intro: 'Kerangka operasional untuk challenge, kuota voucher, verifikasi pemenuhan, penukaran, rekonsiliasi mitra dan perlindungan data peserta.',
      steps: ['Definisikan challenge', 'Tetapkan kuota & masa berlaku', 'Verifikasi peserta', 'Terbitkan / tukar voucher', 'Rekonsiliasi mitra'],
      owners: ['Program Owner', 'Partner Manager', 'Finance / Reconciliation'],
      sources: [
        { label: 'Campaign voucher', table: 'voucher_campaigns', query: 'select=id&order=created_at.desc&limit=200' },
        { label: 'Voucher', table: 'vouchers', query: 'select=id,status,used_at&order=created_at.desc&limit=200', status: 'status' },
      ],
      destination: [
        { label: 'Voucher', page: 'voucher' },
        { label: 'Marketing', page: 'marketing' },
      ],
    },
    'nutrition-quality': {
      eyebrow: 'NUTRITION · PLANT', title: 'Batch, Release & Product Quality',
      intro: 'Kontrol kesiapan produksi dan mutu: formula berversi, bahan, batch record, karantina, release, deviasi, complaint dan recall.',
      steps: ['Formula & BOM disetujui', 'Bahan diverifikasi', 'Batch diproduksi', 'QC & deviasi', 'Release / quarantine'],
      owners: ['R&D', 'Production', 'QA / QC'],
      sources: [
        { label: 'Batch produksi', table: 'wellness_batch', query: 'select=id,status&order=created_at.desc&limit=200', status: 'status' },
        { label: 'Uji mutu produksi', table: 'pabrik_uji_mutu', query: 'select=id,status&order=tgl_kirim.desc&limit=200', status: 'status' },
      ],
      destination: [
        { label: 'Pabrik', page: 'pabrik' },
        { label: 'Uji mutu produk', page: 'wellness-mutu' },
      ],
    },
    'sanctuary-operations': {
      eyebrow: 'SANCTUARY · SERVICE', title: 'Operasional Sanctuary',
      intro: 'Alur operasional untuk booking, screening, consent, kapasitas ruang, penugasan therapist, hygiene, no-show, saldo paket dan follow-up.',
      steps: ['Booking & screening', 'Consent & package ledger', 'Penugasan ruang/staf', 'Sesi & hygiene', 'Follow-up & CSAT'],
      owners: ['Front Desk', 'Therapist Lead', 'Sanctuary Supervisor'],
      sources: [
        { label: 'Reservasi', table: 'spa_reservasi', query: 'select=id,status&order=mulai.desc&limit=200', status: 'status' },
        { label: 'Okupansi ruangan', table: 'spa_okupansi_ruangan', query: 'select=id,status,sesi_hari_ini,jam_terpakai_hari_ini&limit=200', status: 'status' },
      ],
      destination: [
        { label: 'Reservasi Sanctuary', page: 'sanctuary-booking' },
        { label: 'Okupansi ruangan', page: 'sanctuary-booking', params: { tab: 'rooms' } },
      ],
    },
    'tech-delivery': {
      eyebrow: 'AVA TECH · DELIVERY', title: 'Delivery, SLA & Customer Success',
      intro: 'Pusat kesiapan komersialisasi sistem: implementasi, scope, acceptance, SLA, incident, release, adopsi tenant dan rekonsiliasi lisensi.',
      steps: ['Discovery & scope', 'Pilot & acceptance', 'Go-live', 'SLA & incident', 'Adopsi & renewal'],
      owners: ['Implementation Lead', 'Support Lead', 'Customer Success'],
      sources: [
        { label: 'Tenant', table: 'tenants', query: 'select=id,is_active&order=nama&limit=200' },
        { label: 'Tiket support', table: 'tech_support_tickets', query: 'select=id,status&order=created_at.desc&limit=200', status: 'status' },
        { label: 'Perubahan / rilis', table: 'tech_changes', query: 'select=id,status&order=created_at.desc&limit=200', status: 'status' },
      ],
      destination: [
        { label: 'Tenant & klien', page: 'tenants' },
        { label: 'Tiket & permintaan', page: 'tech-isu' },
      ],
    },
    'evidence-register': {
      eyebrow: 'HQ · QUALITY GOVERNANCE', title: 'Evidence Register & Risk',
      intro: 'Registri bukti untuk SOP, izin, sertifikasi, audit, CAPA, risiko, pemilik dokumen dan tanggal kedaluwarsa. Status bukti harus jelas sebelum dipakai sebagai klaim.',
      steps: ['Daftarkan bukti', 'Tetapkan pemilik & masa berlaku', 'Review / audit', 'CAPA & mitigasi', 'Publikasikan status terverifikasi'],
      owners: ['Quality Lead', 'Legal / Compliance', 'Unit Owner'],
      sources: [
        { label: 'Izin fasilitas', table: 'permits', query: 'select=id,expires_at&order=expires_at&limit=200' },
        { label: 'Kredensial tenaga', table: 'staff_credentials', query: 'select=id,expiry_date&order=expiry_date&limit=200' },
      ],
      destination: [
        { label: 'Compliance & legal', page: 'compliance-tracker' },
        { label: 'Jejak audit', page: 'audit' },
      ],
    },
  };

  function esc(v) { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  function sourceSummary(source, value) {
    if (source.rpc === 'wellness_admin_dashboard') {
      if (!value || !Array.isArray(value.programs)) throw new Error('Respons dashboard wellness tidak sesuai kontrak.');
      const programs = value.programs;
      const sum = field => programs.reduce((total, row) => {
        const count = Number(row[field] || 0);
        return total + (Number.isFinite(count) ? count : 0);
      }, 0);
      return {
        total: programs.length,
        detail: [
          `${sum('enrolled')} enrollment`,
          `${sum('observations')} pengukuran`,
          `${sum('open_tasks')} tindak lanjut terbuka`,
        ].join(' · '),
      };
    }
    if (!Array.isArray(value)) throw new Error(`Respons sumber ${source.table} bukan daftar.`);
    const states = source.status
      ? [...value.reduce((counts, row) => {
          const status = String(row[source.status] || 'Tidak diketahui');
          counts.set(status, (counts.get(status) || 0) + 1);
          return counts;
        }, new Map())].map(([label, count]) => `${label}: ${count}`)
      : [];
    return { total: value.length, detail: states.join(' · ') || 'Jumlah record yang dapat dibaca' };
  }

  async function readSource(source) {
    if (source.rpc) {
      if (typeof window.sbRpc !== 'function') throw new Error('Layanan RPC belum tersedia.');
      return window.sbRpc(source.rpc, {});
    }
    if (typeof window.sbGetStrict !== 'function') throw new Error('Layanan data terverifikasi belum tersedia.');
    return window.sbGetStrict(source.table, source.query);
  }

  async function renderReadiness(params = {}) {
    const key = params.panel || params.focus || 'evidence-register';
    const panel = PANELS[key];
    const root = document.getElementById('main-content');
    if (!root) return;
    if (!panel) {
      root.innerHTML = '<section class="card" role="alert"><h1>Panel readiness tidak dikenal</h1><p>Kembali ke menu sebelumnya dan pilih panel yang tersedia.</p></section>';
      return;
    }
    root.innerHTML = `<div class="page-header"><div><p class="readiness-eyebrow">${esc(panel.eyebrow)}</p><h1>${esc(panel.title)}</h1><p>${esc(panel.intro)}</p></div><div class="btn-row"><button class="btn btn-ghost" onclick="navigate('dashboard')">Kembali ke dashboard</button></div></div>
      <section class="readiness-hero card"><div><span class="readiness-status">RINGKASAN SUMBER · STATUS WORKFLOW TETAP PERLU VERIFIKASI</span><h2>Data sumber dan langkah kendali.</h2><p>Angka di bawah adalah agregat record yang dapat dibaca. Jumlah data bukan bukti bahwa handoff, retry, rekonsiliasi, atau persetujuan sudah selesai.</p></div><div class="readiness-mark" aria-hidden="true">◎</div></section>
      <section class="readiness-grid">${panel.steps.map((s,i)=>`<article class="readiness-step"><span>${String(i+1).padStart(2,'0')}</span><h3>${esc(s)}</h3><p>Status: <b>Belum diverifikasi dari sumber end-to-end</b></p><small>Pemilik: ${esc(panel.owners[i % panel.owners.length])}</small></article>`).join('')}</section>
      <section class="card readiness-checklist"><div class="card-title">Ringkasan sumber data</div><p class="muted">Daftar tabel dibatasi maksimal 200 baris per sumber; RPC mengikuti kontrak respons server. Angka ini bukan jumlah historis keseluruhan.</p><div id="readiness-sources" aria-live="polite">Memuat ringkasan sumber…</div></section>
      <section class="card readiness-checklist"><div class="card-title">Buka modul sumber</div><div class="btn-row">${panel.destination.map((destination,index)=>`<button class="btn btn-ghost" data-readiness-destination="${index}">${esc(destination.label)}</button>`).join('')}</div></section>
      <section class="card readiness-checklist"><div class="card-title">Checklist penerimaan</div><div class="readiness-check-row"><label><input type="checkbox" disabled> ID korelasi / nomor transaksi tersedia</label><span>Belum diverifikasi</span></div><div class="readiness-check-row"><label><input type="checkbox" disabled> Retry, exception dan pemilik tindak lanjut ditetapkan</label><span>Belum diverifikasi</span></div><div class="readiness-check-row"><label><input type="checkbox" disabled> Jejak audit dan bukti perubahan tersedia</label><span>Belum diverifikasi</span></div><div class="readiness-check-row"><label><input type="checkbox" disabled> Uji penerimaan disetujui supervisor</label><span>Belum diverifikasi</span></div></section>`;
    root.querySelectorAll('[data-readiness-destination]').forEach(button => {
      const destination = panel.destination[Number(button.dataset.readinessDestination)];
      button.addEventListener('click', () => window.navigate(destination.page, destination.params || {}));
    });

    const epoch = (window.readinessRenderEpoch || 0) + 1;
    window.readinessRenderEpoch = epoch;
    const results = await Promise.all(panel.sources.map(async source => {
      try {
        const value = await readSource(source);
        return { source, summary: sourceSummary(source, value) };
      } catch (error) {
        return { source, error: error.message || String(error) };
      }
    }));
    if (epoch !== window.readinessRenderEpoch || !root.isConnected) return;
    const target = root.querySelector('#readiness-sources');
    if (!target) return;
    target.innerHTML = `<div class="readiness-grid">${results.map(result => `<article class="readiness-step" ${result.error ? 'role="alert"' : ''}><h3>${esc(result.source.label)}</h3>${result.error
      ? `<p><b>Tidak dapat dibaca</b></p><small>${esc(result.error)}</small>`
      : `<p><b>${result.summary.total}</b> record terjangkau</p><small>${esc(result.summary.detail)}</small>`}</article>`).join('')}</div>`;
  }

  window.renderReadiness = renderReadiness;
})();
