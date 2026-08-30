// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Holding Financial Consolidation & Multi-Entity Ledger — PT AVA HEALTH
// ---------------------------------------------------------------------------
// Fitur:
// - P&L Konsolidasi Real-Time 6 Unit Usaha (Health, Lab, Tech, Care, Nutrition, Sanctuary)
// - Pelacakan CapEx Rp 1,28 M & OpEx Rp 140 Juta/Bulan Faskes Pilot
// - Simulasi Titik Impas (BEP) Bulan ke-14
// - Valuasi & Metrik Kesiapan Pendanaan Seri A (Target Revenue Rp 25 M/Tahun)
// - Rekonsiliasi Bank & General Ledger Multi-Entitas
// ═══════════════════════════════════════════════════════════════════════════

let HOLDING_FINANCE_STATE = {
  activeTab: 'pnl', // 'pnl' | 'capex' | 'seria' | 'ledger'
  pillars: [
    { pilar: 'Queen Health', entitas: 'PT AVA Medika Prima', tipe: 'Klinik Faskes', rev: 145000000, cogs: 58000000, opex: 65000000, target_margin: '50-60%', status: 'Menuju BEP' },
    { pilar: 'Queen Lab', entitas: 'PT AVA Diagnostika', tipe: 'Diagnostik & LIS', rev: 120000000, cogs: 36000000, opex: 40000000, target_margin: '65-75%', status: 'Profitabel' },
    { pilar: 'Queen Tech', entitas: 'PT AVA Solusi Teknologi', tipe: 'B2B SaaS HIS/LIS', rev: 85000000, cogs: 8500000, opex: 25000000, target_margin: '80-90%', status: 'High Margin' },
    { pilar: 'Queen Care', entitas: 'PT AVA Care Indonesia', tipe: 'Home Care & Nakes', rev: 68000000, cogs: 14960000, opex: 18000000, target_margin: '76-82%', status: 'Bertumbuh' },
    { pilar: 'Queen Nutrition', entitas: 'PT Queen Nutrition Nusantara', tipe: 'Nutraseutikal D2C', rev: 195000000, cogs: 56550000, opex: 35000000, target_margin: '70-72%', status: 'Lokomotif Laba' },
    { pilar: 'Queen Sanctuary', entitas: 'PT Queen Sanctuary Wellness', tipe: 'Medical Spa & Pilates', rev: 52000000, cogs: 18200000, opex: 20000000, target_margin: '55-65%', status: 'Stabil' }
  ]
};

async function renderHoldingFinance(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  if (params.tab) HOLDING_FINANCE_STATE.activeTab = params.tab;

  const totalRev = HOLDING_FINANCE_STATE.pillars.reduce((s, p) => s + p.rev, 0);
  const totalCogs = HOLDING_FINANCE_STATE.pillars.reduce((s, p) => s + p.cogs, 0);
  const totalOpex = HOLDING_FINANCE_STATE.pillars.reduce((s, p) => s + p.opex, 0);
  const grossProfit = totalRev - totalCogs;
  const netEbitda = grossProfit - totalOpex;
  const ebitdaMargin = Math.round((netEbitda / totalRev) * 100);

  content.innerHTML = `
    <!-- Header Modul -->
    <div class="page-header">
      <div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span class="badge" style="background:rgba(212,175,55,0.2); color:#d4af37; border:1px solid #d4af37; font-weight:800; font-size:10px;">👑 HOLDING HQ FINANCIAL HUB</span>
          <span class="badge" style="background:#ccfbf1; color:#0f766e; font-weight:800; font-size:10px;">6 ENTITAS BISNIS TERKONSOLIDASI</span>
        </div>
        <h1>🏛️ Konsolidasi Finansial Holding — AVA GLOBAL</h1>
        <p>Konsolidasi P&amp;L 6 Pilar Bisnis, Pemantauan EBITDA Konsolidasi &amp; Kesiapan Seri A</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderHoldingFinance()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="toast('Laporan Finansial Konsolidasi diunduh sebagai PDF Terenkripsi AES-256', 'ok')">📄 Ekspor Laporan Holding</button>
      </div>
    </div>

    <!-- Ringkasan KPI Konsolidasi -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin-bottom:20px;">
      <div class="kpi-card" style="border-left: 4px solid #22c55e;">
        <div class="kpi-icon" style="background:rgba(34,197,94,0.15); color:#22c55e;">💰</div>
        <div>
          <div class="kpi-val">Rp ${(totalRev/1000000).toFixed(1)} Jt</div>
          <div class="kpi-label">Pendapatan Konsolidasi (Bulan Ini)</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">Target: Rp 750 Jt/Bulan</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #d4af37;">
        <div class="kpi-icon" style="background:rgba(212,175,55,0.15); color:var(--accent);">📊</div>
        <div>
          <div class="kpi-val" style="color:#b45309;">Rp ${(grossProfit/1000000).toFixed(1)} Jt</div>
          <div class="kpi-label">Gross Profit (${Math.round(grossProfit/totalRev*100)}% Margin)</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">COGS Efisien: ${(totalCogs/1000000).toFixed(1)} Jt</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #0ea5e9;">
        <div class="kpi-icon" style="background:rgba(14,165,233,0.15); color:#0ea5e9;">📈</div>
        <div>
          <div class="kpi-val">+Rp ${(netEbitda/1000000).toFixed(1)} Jt</div>
          <div class="kpi-label">Net EBITDA Holding (${ebitdaMargin}%)</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">OpEx: ${(totalOpex/1000000).toFixed(1)} Jt</div>
        </div>
      </div>

      <div class="kpi-card" style="border-left: 4px solid #a855f7;">
        <div class="kpi-icon" style="background:rgba(168,85,247,0.15); color:#a855f7;">🎯</div>
        <div>
          <div class="kpi-val">Bulan ke-14</div>
          <div class="kpi-label">Proyeksi BEP Faskes Pilot</div>
          <div style="font-size:10.5px; color:var(--text3); margin-top:2px;">CapEx Terpulihkan 68%</div>
        </div>
      </div>
    </div>

    <!-- Sub-Menu Workspace Tabs (Navigasi Internal Modul) -->
    <div style="display:flex; gap:8px; border-bottom:2px solid var(--border); margin-bottom:20px; overflow-x:auto; padding-bottom:2px;">
      <button class="btn btn-sm ${HOLDING_FINANCE_STATE.activeTab === 'pnl' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabHoldingFinance('pnl')">
        📊 1. P&amp;L Konsolidasi 6 Pilar
      </button>
      <button class="btn btn-sm ${HOLDING_FINANCE_STATE.activeTab === 'capex' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabHoldingFinance('capex')">
        🏗️ 2. CapEx &amp; OpEx Faskes Pilot
      </button>
      <button class="btn btn-sm ${HOLDING_FINANCE_STATE.activeTab === 'seria' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabHoldingFinance('seria')">
        🚀 3. Kesiapan Pendanaan Seri A (Rp 25 M/Thn)
      </button>
      <button class="btn btn-sm ${HOLDING_FINANCE_STATE.activeTab === 'ledger' ? 'btn-teal' : 'btn-ghost'}" style="font-weight:700; border-radius:8px;" onclick="gantiTabHoldingFinance('ledger')">
        🏛️ 4. Buku Besar Multi-Entitas
      </button>
    </div>

    <!-- Konten Tab Aktif -->
    <div id="holding-finance-tab-content">
      ${renderHoldingFinanceTabContent()}
    </div>
  `;
}

function gantiTabHoldingFinance(tab) {
  HOLDING_FINANCE_STATE.activeTab = tab;
  renderHoldingFinance();
}

function renderHoldingFinanceTabContent() {
  // TAB 1: P&L KONSOLIDASI
  if (HOLDING_FINANCE_STATE.activeTab === 'pnl') {
    return `
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">Kinerja Finansial 6 Unit Usaha Spesialis</h3>
        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg2);">
                <th>Pilar &amp; Entitas PT</th>
                <th>Model Bisnis</th>
                <th>Revenue (Bln)</th>
                <th>HPP / COGS</th>
                <th>Gross Margin</th>
                <th>OpEx</th>
                <th>Net EBITDA</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${HOLDING_FINANCE_STATE.pillars.map(p => {
                const gm = p.rev - p.cogs;
                const gmp = Math.round((gm / p.rev) * 100);
                const ebitda = gm - p.opex;
                return `
                  <tr>
                    <td>
                      <b>${p.pilar}</b>
                      <div style="font-size:11px; color:var(--text3);">${p.entitas}</div>
                    </td>
                    <td><span class="badge badge-teal">${p.tipe}</span></td>
                    <td><strong>Rp ${(p.rev/1000000).toFixed(1)} Jt</strong></td>
                    <td style="color:#ef4444;">Rp ${(p.cogs/1000000).toFixed(1)} Jt</td>
                    <td><b style="color:var(--teal);">${gmp}% (Rp ${(gm/1000000).toFixed(1)} Jt)</b></td>
                    <td style="color:#f59e0b;">Rp ${(p.opex/1000000).toFixed(1)} Jt</td>
                    <td><strong style="color:${ebitda >= 0 ? '#22c55e' : '#ef4444'}; font-size:13px;">${ebitda >= 0 ? '+' : ''}Rp ${(ebitda/1000000).toFixed(1)} Jt</strong></td>
                    <td><span class="badge ${p.status.includes('Laba') || p.status.includes('Profitabel') ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 2: CAPEX & OPEX
  if (HOLDING_FINANCE_STATE.activeTab === 'capex') {
    return `
      <div class="grid-2" style="grid-template-columns:1fr 1fr; gap:20px;">
        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">🏗️ Alokasi CapEx Faskes Pilot (Total Rp 1,28 M)</h3>
          <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Renovasi Gedung &amp; Interior Sanctuary:</span>
              <b>Rp 420.000.000 (32.8%)</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Alat Laboratorium (Hematologi, Kimia, Analyzer):</span>
              <b>Rp 450.000.000 (35.2%)</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Mesin Pelvic Reformer &amp; Alkes Obgyn:</span>
              <b>Rp 210.000.000 (16.4%)</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Infrastruktur IT, Server LIS &amp; Kiosk Antrian:</span>
              <b>Rp 120.000.000 (9.4%)</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Perizinan Klinik, Amdal &amp; Legalitas:</span>
              <b>Rp 80.000.000 (6.2%)</b>
            </div>
          </div>
        </div>

        <div class="card" style="padding:20px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">⚡ OpEx Bulanan &amp; BEP Projection</h3>
          <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Gaji Dokter Sp.OG, Sp.PK &amp; Nakes:</span>
              <b>Rp 75.000.000</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Sewa Gedung &amp; Utilitas Listrik/Air:</span>
              <b>Rp 35.000.000</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Marketing, Digital Ads &amp; Influencer FMCG:</span>
              <b>Rp 20.000.000</b>
            </div>
            <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
              <span>Pemeliharaan Alat Medis &amp; Kalibrasi:</span>
              <b>Rp 10.000.000</b>
            </div>
            <div style="margin-top:10px; background:rgba(16,185,129,0.1); padding:12px; border-radius:8px; border:1px solid var(--teal);">
              <b style="color:var(--teal);">🎯 Status BEP:</b> Titik impas operasional tercapai pada <b>Bulan ke-14</b> dengan rata-rata 35 pasien/hari dan 800 box D2C/bulan.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // TAB 3: KESIAPAN SERI A
  if (HOLDING_FINANCE_STATE.activeTab === 'seria') {
    return `
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0 0 14px 0;">🚀 Metrik Kesiapan Pendanaan Seri A (Target Revenue Rp 25 M/Tahun)</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:20px;">
          <div style="background:var(--bg2); padding:16px; border-radius:12px;">
            <span style="font-size:11px; color:var(--text3);">Annual Recurring Revenue (ARR) Target</span>
            <h2 style="font-size:22px; color:var(--navy); margin:4px 0 0 0;">Rp 25,0 Miliar</h2>
          </div>
          <div style="background:var(--bg2); padding:16px; border-radius:12px;">
            <span style="font-size:11px; color:var(--text3);">Current Run-Rate (Annualized)</span>
            <h2 style="font-size:22px; color:var(--teal); margin:4px 0 0 0;">Rp 8,36 Miliar</h2>
          </div>
          <div style="background:var(--bg2); padding:16px; border-radius:12px;">
            <span style="font-size:11px; color:var(--text3);">Gross Margin Konsolidasi</span>
            <h2 style="font-size:22px; color:#22c55e; margin:4px 0 0 0;">69.4%</h2>
          </div>
          <div style="background:var(--bg2); padding:16px; border-radius:12px;">
            <span style="font-size:11px; color:var(--text3);">Customer Lifetime Value (LTV:CAC)</span>
            <h2 style="font-size:22px; color:#a855f7; margin:4px 0 0 0;">4.8x (Sehat)</h2>
          </div>
        </div>
      </div>
    `;
  }

  // TAB 4: BUKU BESAR MULTI-ENTITAS
  return `
    <div class="card" style="padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="font-size:15px; font-weight:800; color:var(--navy); margin:0;">🏛️ General Ledger &amp; Rekonsiliasi Bank Multi-Entitas</h3>
        <button class="btn btn-sm btn-teal" onclick="alert('Form Jurnal Transaksi Baru')">+ Buat Jurnal Transaksi</button>
      </div>
      <p style="font-size:12px; color:var(--text3); margin-bottom:14px;">Pemisahan rekening giro bank, buku besar (General Ledger) dan saldo kas per entitas PT</p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
        <div style="background:var(--bg2); padding:14px; border-radius:10px; border-left:4px solid #0A2342;">
          <b>PT AVA Medika Prima (Klinik)</b>
          <div style="font-size:11.5px; color:var(--text3); margin:4px 0;">BCA Giro: 8820-192-001</div>
          <strong style="color:var(--teal); font-size:14px;">Saldo: Rp 342.800.000</strong>
        </div>
        <div style="background:var(--bg2); padding:14px; border-radius:10px; border-left:4px solid #0ea5e9;">
          <b>PT AVA Diagnostika (LIS Lab)</b>
          <div style="font-size:11.5px; color:var(--text3); margin:4px 0;">Mandiri Giro: 122-00-998811-2</div>
          <strong style="color:var(--teal); font-size:14px;">Saldo: Rp 285.400.000</strong>
        </div>
        <div style="background:var(--bg2); padding:14px; border-radius:10px; border-left:4px solid #ec4899;">
          <b>PT Queen Nutrition Nusantara (FMCG)</b>
          <div style="font-size:11.5px; color:var(--text3); margin:4px 0;">BCA Giro: 8820-192-003</div>
          <strong style="color:var(--teal); font-size:14px;">Saldo: Rp 490.150.000</strong>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// KALKULASI EBITDA & P&L KONSOLIDASI 6 BRAND
// ═══════════════════════════════════════════════════════════════
function calculateHoldingEBITDA(customPillars = null) {
  const pillars = customPillars || HOLDING_FINANCE_STATE.pillars;
  const totalRev = pillars.reduce((s, p) => s + (p.rev || 0), 0);
  const totalCogs = pillars.reduce((s, p) => s + (p.cogs || 0), 0);
  const totalOpex = pillars.reduce((s, p) => s + (p.opex || 0), 0);
  const grossProfit = totalRev - totalCogs;
  const netEbitda = grossProfit - totalOpex;
  const ebitdaMarginPct = totalRev > 0 ? parseFloat(((netEbitda / totalRev) * 100).toFixed(1)) : 0;
  const grossMarginPct = totalRev > 0 ? parseFloat(((grossProfit / totalRev) * 100).toFixed(1)) : 0;

  return {
    pillar_count: pillars.length,
    total_revenue: totalRev,
    total_cogs: totalCogs,
    gross_profit: grossProfit,
    gross_margin_pct: grossMarginPct,
    total_opex: totalOpex,
    net_ebitda: netEbitda,
    ebitda_margin_pct: ebitdaMarginPct,
    status: netEbitda > 0 ? 'HEALTHY_POSITIVE_EBITDA' : 'NEGATIVE_EBITDA'
  };
}

window.renderHoldingFinance = renderHoldingFinance;
window.gantiTabHoldingFinance = gantiTabHoldingFinance;
window.calculateHoldingEBITDA = calculateHoldingEBITDA;
window.HOLDING_FINANCE_STATE = HOLDING_FINANCE_STATE;
