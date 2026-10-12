# INSTRUKSI KERJA (WORK INSTRUCTION)
**NOMOR: IK-ALAT/MAINT/004/2026**

## TENTANG
### PEMELIHARAAN HARIAN, BACKGROUND CHECK & KENDALI MUTU ALAT ANALYZER
**ISO 15189:2022 KLAUSUL 6.4 & CLSI AUTO10-A**

---

## [[METADATA]]
- **Laboratorium:** {{TENANT_NAME}}
- **Dokumen:** IK-ALAT/MAINT/004/2026
- **Tanggal Efektif:** {{EFFECTIVE_DATE}}
- **Klausul ISO:** 6.4 (Equipment & Calibration)
- **Tag IP:** `OWNED_BY: generic`

---

## [[PENDAHULUAN]]
Instruksi kerja ini merupakan pedoman wajib bagi teknisi laboratorium / analis sebelum memulai operasional pemeriksaan sampel klinis setiap hari. Seluruh instrumen analitik otomatis (Hematology Analyzer & Clinical Chemistry Analyzer) wajib melalui pemeriksaan lingkungan, *maintenance* harian, uji nilai latar belakang (*background check*), dan validasi kontrol mutu (QC) harian.

---

## [[PROSEDUR]]

### 1. Pengecekan Lingkungan & Kelistrikan (Pre-startup Check)
Setiap pagi sebelum instrumen dihidupkan:
1. **Suhu Ruang Operasional:** Periksa termohigrometer digital dinding:
   - Suhu ruang analitik wajib berada pada rentang **20.0°C – 25.0°C**.
   - Kelembaban udara (*relative humidity*) wajib berada pada rentang **40% – 70%**.
   - Catat nilai pada logbook pemantauan suhu lingkungan.
2. **Kestabilan Tegangan Listrik (UPS):**
   - Pastikan pasokan listrik melewati Uninterruptible Power Supply (UPS) online.
   - Tegangan input/output stabil pada **220 V ± 5%** dan grounding < 2 Volt.
3. **Pneumatik & Tekanan Kompresor (Bila Ada):**
   - Pastikan tekanan vakum dan tekanan kompresor udara sesuai spesifikasi pabrik.

### 2. Startup & Background Count (Analyzer Hematologi)
1. Nyalakan analyzer sesuai tombol power utama dan tunggu proses inisialisasi / *self-check* selesai.
2. Lakukan aspirasi reagen blanking (*diluent*) untuk uji latar belakang (*background count*).
3. **Ambang Batas Nilai Background yang Diizinkan:**
   - **WBC (Leukosit):** ≤ 0.2 × 10³/µL
   - **RBC (Eritrosit):** ≤ 0.02 × 10⁶µL
   - **HGB (Hemoglobin):** ≤ 0.1 g/dL
   - **PLT (Trombosit):** ≤ 10 × 10³/µL
4. **Keputusan Tindakan:**
   - Jika background ≤ ambang batas: Status instrumen **READY**.
   - Jika background melampaui batas: Lakukan *probe rinse* / siklus pencucian dengan cairan deproteinisasi (*cleaning solution*), lalu ulangi pembacaan background. Jangan periksa sampel pasien bila background belum lolos.

### 3. Startup & Water Blank Check (Analyzer Kimia Klinik)
1. Periksa volume air bebas ion (*aquabidest / DI water*) pada sistem purifikasi (resistivitas ≥ 10 MΩ·cm).
2. Periksa level reagen pada *reagent tray* dan pastikan tidak ada busa (*bubble*) di permukaan reagen.
3. Jalankan prosedur **Photometer Water Blank / Air Blank**:
   - Nilai absorbansi seluruh kuvet wajib berada pada rentang spesifikasi pabrik (variasi antar kuvet < 0.005 Abs).
   - Bila terdapat kuvet kotor atau tergores: tandai kuvet kotor pada LIS dan lakukan siklus pencucian kuvet otomatis (*cell wash*).

### 4. Pelaksanaan Pemantapan Mutu Internal (QC Harian)
1. Keluarkan vial kontrol komersial (Level Normal dan Level Patologis) dari kulkas 2-8°C, biarkan mencapai suhu ruang 15-20 menit.
2. Homogenisasi vial kontrol secara gentle (putar perlahan 10-15 kali, jangan dikocok kasar).
3. Jalankan pemeriksaan QC pada analyzer:
   - Evaluasi terhadap grafik Levey-Jennings dan aturan Westgard (1-2s warning, 1-3s reject, 2-2s reject, R-4s reject, 10x reject).
4. **Keputusan:**
   - **IN CONTROL:** Simpan grafik QC dan mulai analisis spesimen pasien.
   - **OUT OF CONTROL:** Tahan pemeriksaan sampel pasien, lakukan *troubleshooting* (cek reagen, ganti vial kontrol baru, atau re-kalibrasi), dan catat tindakan perbaikan pada logbook CAPA.

### 5. Shutdown & Pembersihan Harian (End-of-Day Maintenance)
Pada akhir shift operasional:
1. Jalankan siklus pencucian harian (*daily shutdown / auto-clean*) menggunakan larutan pembersih enzimatis / natrium hipoklorit sesuai petunjuk manual alat.
2. Bersihkan jarum sampel (*sample probe*) dan jarum reagen (*reagent probe*) menggunakan swab alkohol atau deproteinizer.
3. Kosongkan wadah limbah cair (*waste container*) dan buang ke saluran pengolahan air limbah (IPAL) medis faskes.
4. Matikan instrumen (atau atur ke mode *standby / sleep*) dan catat log pemeliharaan harian.

---

## [[PENGESAHAN]]
Ditetapkan di: {{CITY}}  
Pada tanggal: {{EFFECTIVE_DATE}}  

**Penanggung Jawab Alat Medis & Laboratorium**  
**{{LAB_DIRECTOR_NAME}}**  
SIP: {{LAB_DIRECTOR_SIP}}
