// ═══════════════════════════════════════════════════════════════
// MODULE: KONFIGURASI PAKET & HARGA SAAS B2B (PRICING & TIERS)
// Standar Komersialisasi — Pengaturan Kuota Transaksi & Paket Langganan Faskes
// ═══════════════════════════════════════════════════════════════

const SAAS_PRICING_PLANS = [
  {
    tier_id: 'TIER-STARTER',
    name: 'Starter Lab Edition',
    target: 'Laboratorium Mandiri & Klinik Pratama Kecil',
    monthly_price: 2500000,
    annual_price: 25000000,
    order_quota_monthly: 1000,
    overage_per_order: 1500,
    modules: ['lis', 'lab-qc', 'catalog-export', 'lab-tat'],
    support_sla: 'Email Support (24 Jam)'
  },
  {
    tier_id: 'TIER-PRO',
    name: 'Pro Clinic & Lab Suite',
    target: 'Klinik Utama & Laboratorium Rujukan Menengah',
    monthly_price: 5500000,
    annual_price: 55000000,
    order_quota_monthly: 5000,
    overage_per_order: 1000,
    modules: ['his', 'lis', 'lab-qc', 'satusehat', 'farmasi', 'cashier', 'catalog-export'],
    support_sla: 'Priority WhatsApp & Remote Assist (4 Jam)'
  },
  {
    tier_id: 'TIER-ENTERPRISE',
    name: 'Enterprise Health System',
    target: 'Rumah Sakit & Jaringan Laboratorium Nasional',
    monthly_price: 12500000,
    annual_price: 125000000,
    order_quota_monthly: 50000,
    overage_per_order: 500,
    modules: ['his', 'lis', 'radiology', 'pacs', 'lab-qc', 'satusehat', 'farmasi', 'accounting', 'payroll', 'agentic'],
    support_sla: '24/7 Dedicated Account Manager & On-site SLA'
  }
];

/**
 * Kalkulasi Biaya Langganan & Tagihan Kelebihan Kuota (Overage)
 */
function calculateSubscriptionBilling(tierId, actualMonthlyOrders = 0, billingCycle = 'MONTHLY') {
  const plan = SAAS_PRICING_PLANS.find(p => p.tier_id === tierId);
  if (!plan) throw new Error(`Paket dengan ID ${tierId} tidak ditemukan.`);

  const basePrice = billingCycle === 'ANNUAL' ? plan.annual_price : plan.monthly_price;
  const quota = plan.order_quota_monthly * (billingCycle === 'ANNUAL' ? 12 : 1);
  const overageOrders = Math.max(0, actualMonthlyOrders - quota);
  const overageCost = overageOrders * plan.overage_per_order;
  const totalBill = basePrice + overageCost;

  return {
    tier_id: plan.tier_id,
    plan_name: plan.name,
    billing_cycle: billingCycle,
    base_price: basePrice,
    quota_limit: quota,
    actual_orders: actualMonthlyOrders,
    overage_orders: overageOrders,
    overage_cost: overageCost,
    total_bill: totalBill
  };
}

async function renderTechPricingPlans() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#f59e0b; margin-bottom:6px;">
            💰 KOMERSIAL SAAS &bull; PAKET LANGGANAN &amp; DAFTAR HARGA
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Paket Lisensi &amp; Daftar Harga Faskes Klien
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Definisi tier lisensi, batasan kuota transaksi bulanan, tarif overage, dan bundling modul platform.
          </p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-top:20px;">
        ${SAAS_PRICING_PLANS.map(p => `
          <div class="card" style="padding:24px; display:flex; flex-direction:column; justify-content:space-between; border-top:4px solid var(--sky);">
            <div>
              <b style="font-size:18px; color:var(--text);">${p.name}</b>
              <div style="font-size:12px; color:var(--text3); margin-top:4px; margin-bottom:16px;">${p.target}</div>
              
              <div style="margin-bottom:16px;">
                <span style="font-size:26px; font-weight:800; color:var(--text);">Rp ${Number(p.monthly_price).toLocaleString('id-ID')}</span>
                <span style="font-size:12px; color:var(--text3);"> / bulan</span>
                <div style="font-size:11.5px; color:#10b981; margin-top:2px;">Atau Rp ${Number(p.annual_price).toLocaleString('id-ID')} / tahun (Hemat 2 Bulan)</div>
              </div>

              <div style="font-size:12.5px; margin-bottom:16px; border-top:1px solid var(--card-border); padding-top:12px;">
                <div style="margin-bottom:6px;"><b>Kuota:</b> ${Number(p.order_quota_monthly).toLocaleString('id-ID')} order / bulan</div>
                <div style="margin-bottom:6px;"><b>Overage:</b> Rp ${p.overage_per_order} / order kelebihan</div>
                <div style="margin-bottom:6px;"><b>Support:</b> ${p.support_sla}</div>
              </div>

              <div style="background:var(--bg2); padding:10px; border-radius:8px; font-size:11.5px; margin-bottom:16px;">
                <b style="display:block; margin-bottom:4px; color:var(--text);">Modul Termasuk:</b>
                ${p.modules.map(m => `<span class="badge" style="background:#334155; color:#fff; font-size:10px; margin:2px;">${m}</span>`).join('')}
              </div>
            </div>

            <button class="btn btn-teal" style="width:100%;">Pilih &amp; Buat Penawaran</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderTechPricingPlans = renderTechPricingPlans;
  window.calculateSubscriptionBilling = calculateSubscriptionBilling;
  window.SAAS_PRICING_PLANS = SAAS_PRICING_PLANS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderTechPricingPlans,
    calculateSubscriptionBilling,
    SAAS_PRICING_PLANS
  };
}
