---
name: audit-lis-workflow
description: Prosedur teknis audit otomatis alur operasional LIS end-to-end (Pra-Analitik, Analitik ASTM :9999 & Westgard QC, Pasca-Analitik Nilai Kritis & TTE).
---

# Skill: Audit LIS Workflow (End-to-End Lab Lifecycle)

Skill ini digunakan untuk mengaudit dan memverifikasi integritas operasional subsistem Laboratorium Information System (LIS) secara komprehensif, mencakup 29 menu operasional dan 3 fase utama siklus laboratorium klinis sesuai standar ISO 15189:2022 dan Permenkes 411/2010.

---

## Prasyarat & Lingkup Arsitektur
- Workspace LIS kanonikal: `workspace: 'lis'`, landing page: `lab`.
- Total Menu Operasional: 29 modul lintas 8 grup fungsional (`reg-lis`, `pre-analitik`, `analitik-lis`, `pasca-analitik`, `qc-pme-lis`, `bank-darah`, `mikro-pa`, `lis-admin`).
- Antarmuka Alat Analitik: Bidirectional TCP port `9999` (protokol ASTM E1381/E1394).

---

## Langkah-Langkah Audit

### 1. Audit Tahap Pra-Analitik (Pre-Analytical Gate)
Verifikasi bahwa seluruh sampel pasien melalui gerbang kelayakan spesimen yang ketat:
```javascript
// Memastikan kriteria penolakan spesimen (specimen rejection criteria) ditegakkan
const rejectionCriteria = [
  'LISIS / HEMOLISIS BERAT',
  'BEKUAN (CLOTTED EDTA)',
  'VOLUME KURANG (QNS)',
  'SALAH TABUNG / ANTIKOAGULAN',
  'LABEL / IDENTITAS TIDAK COCOK'
];

// Verifikasi: Sampel yang ditolak tidak boleh masuk ke pipa analitik
// Sampel wajib menerbitkan status perlunya pengambilan ulang (re-draw).
```

### 2. Audit Tahap Analitik & Antarmuka Alat (ASTM Interface & QC)
Verifikasi koneksi bidirectional instrumen dan validasi kontrol mutu harian:
```javascript
const net = require('net');

// 1. Verifikasi handshake listener ASTM pada port 9999
const client = new net.Socket();
client.connect(9999, '127.0.0.1', () => {
  // Kirim frame ENQ (0x05)
  client.write(Buffer.from([0x05]));
});

client.on('data', (data) => {
  // Instrumen/Bridge merespons ACK (0x06)
  if (data[0] === 0x06) {
    console.log('ASTM :9999 Interface Online & Responsive');
  }
  client.destroy();
});

// 2. Evaluasi Aturan Kontrol Mutu Westgard (IQC)
// Aturan: 1-3s (Reject), 2-2s (Reject), R-4s (Reject), 4-1s (Warning), 10x (Warning)
```

### 3. Audit Autoverifikasi & Delta Check (CLSI AUTO10-A)
Verifikasi bahwa hasil otomatis yang dirilis telah lolos evaluasi delta check terhadap riwayat pasien sebelumnya:
$$\Delta\% = \left| \frac{R_{saat\_ini} - R_{sebelumnya}}{R_{sebelumnya}} \right| \times 100\%$$
- Ambang batas: Hemoglobin $\Delta > 2.0\text{ g/dL}$ atau $> 20\%$, Kalium $\Delta > 1.0\text{ mEq/L}$, Trombosit $\Delta > 50\%$.
- Hasil yang memicu delta check wajib ditahan (**HOLD**) untuk telaah manual Sp.PK.

### 4. Audit Tahap Pasca-Analitik (Critical Values SLA & Digital Sign-off)
1. **SLA Nilai Kritis (Panic Values):**
   - Maksimal 30 menit dari penetapan hasil hingga dokter pengirim terhubung.
   - Wajib mencatat metode konfirmasi **TBaK (Tulis, Baca, Konfirmasi)** dengan identitas penerima pesan.
2. **Validasi Tanda Tangan Elektronik (TTE):**
   - TTE Dokter Penanggung Jawab wajib memuat hash kriptografi dan QR code verifikasi verlid.
3. **Retensi & Pemusnahan Limbah B3 (Klausul 7.5):**
   - Serum disimpan minimal 7 hari (2-8°C).
   - Manifes elektronik pemusnahan limbah B3 (Festronik) tercatat rapi.

---

## Skrip Otomatisasi Audit LIS
Untuk menjalankan audit headless 56 titik pada UI dan modul LIS:
```bash
node scripts/audit_lis_subdomain.cjs
```
Laporan bukti tersimpan di `docs/audit-evidence/lis-subdomain-audit-report.json`.
