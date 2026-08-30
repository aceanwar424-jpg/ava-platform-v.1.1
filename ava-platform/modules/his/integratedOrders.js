// ═══════════════════════════════════════════════════════════════
// MODULE: ORDER TERINTEGRASI (INTEGRATED CLINICAL ORDERING)
// Standar PMK 24/2022 — Satu Klik untuk Lab LIS, RIS Radiologi, Farmasi & Tindakan
// ═══════════════════════════════════════════════════════════════

let integratedOrders = [
  {
    order_id: 'ORD-2026-001',
    encounter_id: 'ENC-20260830-01',
    patient_name: 'Tn. Budi Setiawan',
    ava_id: 'AVA-7K3M2P9QX4',
    doctor_name: 'dr. Hendra Pratama, Sp.PD',
    created_at: '2026-08-30 09:30',
    lab_items: [
      { code: 'LAB-HEM-001', name: 'Darah Lengkap / CBC', price: 120000, loinc: '58410-2' },
      { code: 'LAB-KIM-010', name: 'Glukosa Darah Puasa', price: 45000, loinc: '1558-6' }
    ],
    radiology_items: [
      { code: 'RAD-THORAX-01', name: 'Foto Thorax AP/PA', price: 185000, modality: 'CR/DR' }
    ],
    pharmacy_items: [
      { code: 'MED-PCM-500', name: 'Paracetamol 500mg (10 Tab)', price: 15000, rule: '3x1 sesudah makan' },
      { code: 'MED-AMX-500', name: 'Amoxicillin 500mg (10 Kap)', price: 35000, rule: '3x1 habiskan' }
    ],
    procedure_items: [
      { code: 'PROC-NEB-01', name: 'Inhalasi Nebulizer Dewasa', price: 75000 }
    ],
    total_amount: 475000,
    payment_coverage: 'BPJS Kesehatan (Ter-cover)',
    status: 'DISPATCHED_TO_ALL_UNITS'
  }
];

/**
 * Buat dan sebar order terpadu ke seluruh unit penunjang
 */
function createIntegratedOrder(orderPayload) {
  const {
    encounter_id = `ENC-${Date.now().toString().slice(-6)}`,
    patient_name,
    ava_id = 'AVA-PATIENT',
    doctor_name = 'dr. Jaga Poli',
    lab_items = [],
    radiology_items = [],
    pharmacy_items = [],
    procedure_items = [],
    payment_coverage = 'Mandiri / Tunai'
  } = orderPayload;

  if (!patient_name) throw new Error('Nama pasien wajib diisi.');

  const labTotal = lab_items.reduce((s, i) => s + (i.price || 0), 0);
  const radTotal = radiology_items.reduce((s, i) => s + (i.price || 0), 0);
  const pharmTotal = pharmacy_items.reduce((s, i) => s + (i.price || 0), 0);
  const procTotal = procedure_items.reduce((s, i) => s + (i.price || 0), 0);
  const grandTotal = labTotal + radTotal + pharmTotal + procTotal;

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const orderId = `ORD-${new Date().getFullYear()}-${String(integratedOrders.length + 1).padStart(3, '0')}`;

  const newOrder = {
    order_id: orderId,
    encounter_id,
    patient_name,
    ava_id,
    doctor_name,
    created_at: now,
    lab_items,
    radiology_items,
    pharmacy_items,
    procedure_items,
    breakdown: {
      lab: labTotal,
      radiology: radTotal,
      pharmacy: pharmTotal,
      procedure: procTotal
    },
    total_amount: grandTotal,
    payment_coverage,
    dispatches: {
      lis_accession: lab_items.length ? `L${now.slice(2, 4)}${now.slice(5, 7)}${now.slice(8, 10)}-${String(integratedOrders.length + 1).padStart(4, '0')}` : null,
      ris_order_no: radiology_items.length ? `RAD-${now.slice(2, 4)}${now.slice(5, 7)}${now.slice(8, 10)}-${String(integratedOrders.length + 1).padStart(4, '0')}` : null,
      pharmacy_rx: pharmacy_items.length ? `RX-${orderId}` : null
    },
    status: 'DISPATCHED_TO_ALL_UNITS'
  };

  integratedOrders.unshift(newOrder);

  return {
    success: true,
    order: newOrder,
    message: `Order terintegrasi ${orderId} untuk ${patient_name} berhasil diteruskan ke Lab, Radiologi, dan Farmasi.`
  };
}

async function renderIntegratedOrders() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#10b981; margin-bottom:6px;">
            ⚡ PMK 24/2022 &bull; ORDER KLINIS TERINTEGRASI
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Order Terintegrasi (Lab + Radiologi + Resep + Tindakan)
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Pemesanan satu pintu dari ruang dokter poliklinik langsung terdistribusi ke LIS, RIS, Antrean Farmasi, dan Billing Kasir.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Riwayat Order Terpadu Terakhir</h3>
        <table class="table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg2);">
              <th>ID Order</th>
              <th>Pasien (AVA-ID)</th>
              <th>Dokter Pengirim</th>
              <th>Rincian Layanan Dipesan</th>
              <th>Total Biaya</th>
              <th>Penjamin</th>
              <th>Status Dispatched</th>
            </tr>
          </thead>
          <tbody>
            ${integratedOrders.map(o => `
              <tr>
                <td style="font-family:monospace; font-weight:700; color:var(--sky);">${o.order_id}</td>
                <td><b>${o.patient_name}</b><div style="font-size:11px; color:var(--text3); font-family:monospace;">${o.ava_id}</div></td>
                <td>${o.doctor_name}</td>
                <td>
                  <div style="font-size:11.5px;">
                    ${o.lab_items.length ? `<span class="badge" style="background:#0284c7; color:#fff; font-size:10px; margin-right:4px;">🔬 ${o.lab_items.length} Lab</span>` : ''}
                    ${o.radiology_items.length ? `<span class="badge" style="background:#8b5cf6; color:#fff; font-size:10px; margin-right:4px;">🩻 ${o.radiology_items.length} Rad</span>` : ''}
                    ${o.pharmacy_items.length ? `<span class="badge" style="background:#10b981; color:#fff; font-size:10px; margin-right:4px;">💊 ${o.pharmacy_items.length} Obat</span>` : ''}
                    ${o.procedure_items.length ? `<span class="badge" style="background:#f59e0b; color:#fff; font-size:10px;">🩺 ${o.procedure_items.length} Tindakan</span>` : ''}
                  </div>
                </td>
                <td><b>Rp ${Number(o.total_amount).toLocaleString('id-ID')}</b></td>
                <td><span class="badge badge-success">${o.payment_coverage}</span></td>
                <td><span style="color:#10b981; font-weight:700; font-size:11px;">✓ Otomatis ke LIS &amp; RIS</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderIntegratedOrders = renderIntegratedOrders;
  window.createIntegratedOrder = createIntegratedOrder;
  window.integratedOrders = integratedOrders;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderIntegratedOrders,
    createIntegratedOrder,
    integratedOrders
  };
}
