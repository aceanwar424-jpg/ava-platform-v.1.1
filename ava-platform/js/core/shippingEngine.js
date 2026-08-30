// ═══════════════════════════════════════════════════════════════════════════
// SERVICE: D2C Multi-Courier Logistics & Shipping Engine — AVA GLOBAL
// ---------------------------------------------------------------------------
// Fitur:
// - Kalkulator Ongkir Multi-Ekspedisi (J&T, Shopee Xpress, JNE, SiCepat, GoSend)
// - Generator Resi Otomatis (AWB) & Thermal Shipping Label 100x150mm
// - Tracking Status Pengiriman Paket Suplemen & Produk Nutrisi
// - Terintegrasi dengan E-Commerce OMS & Auto-Refill Engine
// ═══════════════════════════════════════════════════════════════════════════

const SHIPPING_ENGINE = {
  configKey: 'ava_shipping_engine_config',

  getConfig() {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {
      originCity: 'Jakarta Selatan',
      originDistrict: 'Pondok Indah',
      defaultWeightGram: 500,
      apiKeyBiteship: '',
      provider: 'simulation' // 'biteship' | 'rajaongkir' | 'simulation'
    };
  },

  saveConfig(cfg) {
    localStorage.setItem(this.configKey, JSON.stringify(cfg));
  },

  // Kalkulasi Ongkos Kirim Multi-Kurir
  async calculateRates({ destinationCity, destinationDistrict, weightGram = 500 }) {
    console.log(`[SHIPPING ENGINE] Menghitung tarif pengiriman ke ${destinationDistrict}, ${destinationCity} (${weightGram}g)...`);
    
    // Standar tarif multi-kurir Indonesia
    return [
      { courier: 'Shopee Xpress Standard', code: 'SPX', service: 'Standard', etd: '1-2 Hari', cost: 12000, logo: '🚚' },
      { courier: 'J&T Express EZ', code: 'JNT', service: 'Regular', etd: '1-2 Hari', cost: 13000, logo: '📦' },
      { courier: 'JNE Reguler', code: 'JNE', service: 'REG', etd: '2-3 Hari', cost: 14000, logo: '📬' },
      { courier: 'SiCepat REG', code: 'SICEPAT', service: 'Regular', etd: '1-2 Hari', cost: 12500, logo: '⚡' },
      { courier: 'GoSend Instant', code: 'GOSEND', service: 'Instant Motor', etd: '2-3 Jam', cost: 35000, logo: '🛵' }
    ];
  },

  // Generate Nomor Resi (AWB) Otomatis
  generateAWB(courierCode = 'SPX') {
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
    if (courierCode === 'SPX') return `SPXID02${randomDigits}`;
    if (courierCode === 'JNT') return `JNT${randomDigits}`;
    if (courierCode === 'JNE') return `JNE88${randomDigits}`;
    return `AWB${randomDigits}`;
  },

  // Modal Cetak Label Pengiriman 100x150mm (Thermal Resi Label)
  openShippingLabelModal({ orderId, customerName, customerPhone, customerAddress, items, courier, awb }) {
    const awbNumber = awb || this.generateAWB(courier.includes('Shopee') ? 'SPX' : 'JNT');
    
    const labelHtml = `
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:16px;">
        <div class="modal-title" style="font-size:16px; font-weight:800;">🏷️ Label Pengiriman Ekspedisi (Thermal 100x150mm)</div>
        <button class="modal-close" onclick="closeModalForce()">✕</button>
      </div>

      <!-- 100x150mm Shipping Label Preview -->
      <div id="thermal-shipping-label" style="background:#fff; color:#000; border:2px solid #000; border-radius:8px; padding:20px; font-family:'Courier New', monospace; max-width:400px; margin:0 auto 16px auto; font-size:12px;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:8px;">
          <div>
            <strong style="font-size:16px;">${courier.toUpperCase()}</strong><br>
            <span>STANDARD DELIVERY</span>
          </div>
          <div style="font-size:24px;">📦</div>
        </div>

        <!-- Barcode AWB -->
        <div style="text-align:center; padding:8px 0; border-bottom:2px solid #000; margin-bottom:8px;">
          <div style="font-size:28px; letter-spacing:4px; font-weight:900;">|||| | ||||| |||| |</div>
          <strong style="font-size:14px; letter-spacing:1px;">${awbNumber}</strong>
        </div>

        <!-- Penerima & Pengirim -->
        <div style="border-bottom:1px solid #000; padding-bottom:8px; margin-bottom:8px;">
          <span style="font-size:10px; font-weight:bold;">KEPADA PENERIMA:</span><br>
          <strong style="font-size:13px;">${customerName} (${customerPhone})</strong><br>
          <p style="margin:2px 0 0 0; font-size:11px; line-height:1.3;">${customerAddress}</p>
        </div>

        <div style="border-bottom:1px solid #000; padding-bottom:8px; margin-bottom:8px;">
          <span style="font-size:10px; font-weight:bold;">PENGIRIM:</span><br>
          <strong>QUEEN NUTRITION HQ &bull; AVA GLOBAL</strong><br>
          <span style="font-size:10.5px;">Jakarta Selatan (0812-9988-7711)</span>
        </div>

        <!-- Detail Paket -->
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
          <span>Order ID: <b>${orderId}</b></span>
          <span>Berat: <b>0.50 Kg</b></span>
        </div>
        <div style="font-size:10.5px; border-top:1px dashed #666; padding-top:4px;">
          <b>Isi Paket:</b> ${items || 'Queen Royal Collagen Glow / HerBalance'}
        </div>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="closeModalForce()">Tutup</button>
        <button class="btn btn-teal" style="flex:2; font-weight:800;" onclick="window.print()">
          🖨️ Cetak Thermal Label Resi
        </button>
      </div>
    `;

    if (typeof openModal === 'function') {
      openModal(labelHtml, 'medium');
    }
  }
};

window.SHIPPING_ENGINE = SHIPPING_ENGINE;
