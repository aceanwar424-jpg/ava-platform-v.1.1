// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SERVICE: Direct ESC/POS Thermal Printing & Label Engine â€” AVA GLOBAL
// ---------------------------------------------------------------------------
// Fitur:
// - Native ESC/POS Binary Command Builder
// - Format Cetak Tiket Antrian Kiosk (58mm & 80mm)
// - Format Cetak Label Barcode Tabung Darah Lab (50x20mm / 40x30mm)
// - Driver Cetak Struk Kasir & POS Billing Thermal
// - Komunikasi Direct WebSerial / WebUSB / Local WebSocket Bridge (Port 9999)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const ESCPOS_PRINTER = {
  // ESC/POS Command Constants
  ESC: '\x1B',
  GS:  '\x1D',
  INIT: '\x1B\x40',
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',
  EMPHASIZE_ON: '\x1B\x45\x01',
  EMPHASIZE_OFF: '\x1B\x45\x00',
  DOUBLE_HEIGHT: '\x1B\x21\x10',
  DOUBLE_WIDTH: '\x1B\x21\x20',
  DOUBLE_BOTH: '\x1B\x21\x30',
  NORMAL: '\x1B\x21\x00',
  CUT_FULL: '\x1D\x56\x00',
  CUT_PARTIAL: '\x1D\x56\x01',

  // 1. Format Cetak Tiket Antrian Kiosk (80mm / 58mm)
  buildQueueTicket({ faskesName = 'AVA GLOBAL HEALTH', queueNumber = 'A-042', serviceName = 'POLI SPESIALIS OBGYN', waitCount = 3 }) {
    let out = '';
    out += this.INIT;
    out += this.ALIGN_CENTER;
    out += this.EMPHASIZE_ON + faskesName + '\n' + this.EMPHASIZE_OFF;
    out += 'Sistem Antrian Terpadu\n';
    out += '================================\n';
    out += 'NOMOR ANTRIAN ANDA:\n\n';
    out += this.DOUBLE_BOTH + this.EMPHASIZE_ON + queueNumber + '\n\n' + this.NORMAL;
    out += this.EMPHASIZE_ON + serviceName + '\n' + this.EMPHASIZE_OFF;
    out += `Sisa Antrian di Depan: ${waitCount} Orang\n`;
    out += '================================\n';
    out += new Date().toLocaleString('id-ID') + '\n';
    out += 'Mohon menunggu nomor Anda dipanggil.\n\n\n\n';
    out += this.CUT_PARTIAL;
    return out;
  },

  // 2. Format Cetak Label Barcode Tabung Darah EDTA/Serum (50x20mm)
  buildTubeBarcodeLabel({ barcode = 'LAB-2026-0810', patientName = 'Ny. Siska Melani', noRM = 'RM-0041', tubeType = 'EDTA (Ungu)', tests = 'CBC, HbA1c' }) {
    let out = '';
    out += this.INIT;
    out += this.ALIGN_LEFT;
    out += this.EMPHASIZE_ON + patientName.slice(0, 20) + ` (${noRM})\n` + this.EMPHASIZE_OFF;
    out += `Tabung: ${tubeType} | ${new Date().toLocaleDateString('id-ID')}\n`;
    out += this.ALIGN_CENTER;
    // 1D Barcode Code128 Command
    out += this.GS + 'k' + '\x04' + barcode + '\x00';
    out += `*${barcode}*\n`;
    out += this.ALIGN_LEFT;
    out += `Pemeriksaan: ${tests.slice(0, 26)}\n\n`;
    return out;
  },


  // 4. Format Struk Kasir (Billing POS Receipt) — 80mm/58mm
  buildReceipt({ faskesName = 'AVA GLOBAL', txnNumber = '', patientName = '', visitNumber = '',
    totalAmount = 0, paidAmount = 0, changeAmount = 0, paymentMethod = '', cashierName = '', datetime = '' }) {
    let out = '';
    out += this.INIT;
    out += this.ALIGN_CENTER;
    out += this.EMPHASIZE_ON + faskesName.slice(0,32) + '\n' + this.EMPHASIZE_OFF;
    out += 'BUKTI PEMBAYARAN\n';
    out += '================================\n';
    out += this.ALIGN_LEFT;
    out += 'No.Txn : ' + txnNumber + '\n';
    out += 'Pasien : ' + patientName.slice(0,24) + '\n';
    if (visitNumber) out += 'Kunjungan: ' + visitNumber + '\n';
    out += 'Tgl    : ' + datetime + '\n';
    out += '================================\n';
    out += this.ALIGN_RIGHT;
    out += this.EMPHASIZE_ON + this.DOUBLE_HEIGHT;
    out += 'TOTAL: Rp ' + Number(totalAmount).toLocaleString('id-ID') + '\n';
    out += this.NORMAL + this.EMPHASIZE_OFF;
    out += this.ALIGN_LEFT;
    out += 'Bayar  : Rp ' + Number(paidAmount).toLocaleString('id-ID') + '\n';
    out += 'Kemb.  : Rp ' + Number(changeAmount).toLocaleString('id-ID') + '\n';
    out += 'Metode : ' + paymentMethod.toUpperCase() + '\n';
    out += '================================\n';
    out += this.ALIGN_CENTER;
    out += 'Kasir: ' + cashierName + '\n';
    out += 'Terima kasih - Semoga lekas sehat\n\n\n\n';
    out += this.CUT_PARTIAL;
    return out;
  },
  // 3. Eksekusi Direct Silent Print ke Printer Lokal / Fallback Browser
  async printDirect(rawString, targetType = 'kiosk_queue') {
    console.log('[ESCPOS PRINTER] Mengirim print job direct:', targetType);
    
    // A. Coba kirim via Local LIS Connector Socket (Port 9999) jika running
    try {
      const res = await fetch('http://127.0.0.1:9999/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: btoa(rawString), type: targetType })
      });
      if (res.ok) {
        console.log('[ESCPOS PRINTER] Cetak direct via Port 9999 berhasil!');
        return { success: true, method: 'connector_socket' };
      }
    } catch(e) {
      console.log('[ESCPOS PRINTER] Connector port 9999 offline, using browser driver fallback.');
    }

    // B. Fallback Dialog Cetak Virtual Bersih
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.write(`
      <html>
      <head>
        <title>Print Label</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; text-align: center; }
          .bold { font-weight: bold; }
          .big { font-size: 24px; }
        </style>
      </head>
      <body>
        <pre style="text-align:center;">${rawString.replace(/[\x00-\x1F\x7F]/g, '')}</pre>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      setTimeout(() => printFrame.remove(), 1000);
    }, 250);

    return { success: true, method: 'browser_print' };
  }
};

window.ESCPOS_PRINTER = ESCPOS_PRINTER;

