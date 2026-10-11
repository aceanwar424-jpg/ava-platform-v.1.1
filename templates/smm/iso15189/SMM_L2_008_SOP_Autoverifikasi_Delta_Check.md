# STANDAR OPERASIONAL PROSEDUR (SOP)
## AUTOVERIFIKASI HASIL LABORATORIUM DAN SISTEM UJI DELTA (DELTA CHECK)
**Nomor Dokumen:** SOP/{{TENANT_CODE}}/LAB-7.3-002  
**Edisi / Revisi:** 01 / 00  
**Tanggal Berlaku:** 2026-10-10  
**Halaman:** 1 dari 4  
**Klausul ISO 15189:2022:** 7.3.7 Quality control, Autoverification and Examination Processes  
**Kepemilikan Aset:** OWNED_BY: generic  

---

[[METADATA]]
- Dokumen: SOP Autoverifikasi Hasil Laboratorium dan Delta Check
- Level Dokumen: L2 (Prosedur Operasional Standar)
- Klausul Acuan: ISO 15189:2022 Klausul 7.3.7 & 7.4.1, CLSI AUTO10-A (Autoverification of Clinical Laboratory Results)
- Pemilik: {{LAB_NAME}} ({{TENANT_NAME}})
- Penanggung Jawab Teknis: Penanggung Jawab Laboratorium (dr. Sp.PK)

---

[[TUJUAN]]
Prosedur ini menetapkan kriteria, batasan, mekanisme pengujian, dan penanganan algoritma autoverifikasi hasil pemeriksaan laboratorium di LIS guna mempercepat Turnaround Time (TAT) hasil rutin normal tanpa mengurangi keselamatan pasien (patient safety), serta mendeteksi kesalahan analitik atau perubahan fisiologis mendadak melalui sistem peringatan Delta Check otomatis.

---

[[RUANG_LINGKUP]]
Prosedur ini berlaku untuk seluruh pemeriksaan kimia klinik, hematologi, urinalisis rutin, dan imunologi di {{LAB_NAME}} yang terhubung secara bidirectional interface ke LIS. Pemeriksaan mikrobiologi kultur, patologi anatomi, dan hasil yang memicu batas kritis (panic values) dikecualikan dari autoverifikasi.

---

[[TANGGUNG_JAWAB]]
1. **Penanggung Jawab Laboratorium (Sp.PK):** Merumuskan, menyetujui, mengaudit tahunan algoritma autoverifikasi dan batas ambang delta check; melakukan validasi klinis manual pada hasil yang ditahan (*held results*).
2. **Supervisor Mutu Laboratorium:** Memastikan instrumen analitik lolos kontrol mutu harian (Westgard multi-rule) sebelum mesin diizinkan melepaskan hasil ke pipa autoverifikasi.
3. **Analis Laboratorium (ATLM):** Memantau dashboard antrean hasil LIS, melakukan evaluasi spesimen pada sampel yang memicu bendera *delta check alert* atau *instrument flag* (ikterik, lipemik, hemolitik).

---

[[PROSEDUR]]
### 1. Kriteria Gerbang Autoverifikasi (Gating Rules)
Hasil pemeriksaan pasien hanya dapat diverifikasi otomatis oleh modul LIS bila **SELURUH** syarat berikut terpenuhi:
1.1. **Status Kontrol Mutu (IQC):** Sesi pemeriksaan instrumen terkait memiliki hasil QC harian pada hari yang sama berstatus **VALID** (tidak ada pelanggaran aturan Westgard 1-3s, 2-2s, atau R-4s).  
1.2. **Indeks Serum (HIL):** Nilai interferensi Hemolisis, Ikterik, dan Lipemik berada di bawah batas interferensi kit reagen pabrikan.  
1.3. **Pesan Bendera Alat (Instrument Flags):** Tidak terdapat bendera abnormalitas morfologi sel atau peringatan linieritas instrumen (mis. *clot detected*, *short sample*, *reagent volume low*, *linearity exceeded*).  
1.4. **Rentang Normal / Non-Kritis:** Hasil berada dalam rentang acuan fisiologis atau rentang pelaporan normal yang telah disetujui Sp.PK dan berada di luar ambang batas Nilai Kritis (*Critical/Panic Values*).  
1.5. **Evaluasi Delta Check:** Hasil lolos perhitungan algoritma perbandingan riwayat pasien sebelumnya tanpa memicu bendera *Delta Check Violation*.

### 2. Aturan Perhitungan dan Ambang Batas Delta Check
2.1. LIS secara otomatis membandingkan hasil saat ini ($R_{saat\_ini}$) dengan hasil pemeriksaan sebelumnya ($R_{sebelumnya}$) milik pasien yang sama dalam jangka waktu retensi delta (maksimal 7 hari atau 168 jam):
$$\Delta\% = \left| \frac{R_{saat\_ini} - R_{sebelumnya}}{R_{sebelumnya}} \right| \times 100\%$$
2.2. Batas Ambang Delta Check Standar:
- **Hemoglobin (Hb):** Perubahan $> 2.0\text{ g/dL}$ atau $> 20\%$ dalam 48 jam $\rightarrow$ HOLD (Waspada perdarahan akut atau hemodilusi).
- **Kreatinin Serum:** Perubahan $> 0.5\text{ mg/dL}$ atau $> 50\%$ $\rightarrow$ HOLD (Waspada Acute Kidney Injury).
- **Kalium ($K^+$):** Perubahan $> 1.0\text{ mEq/L}$ atau $> 25\%$ $\rightarrow$ HOLD (Waspada kontaminasi EDTA atau hemolisis terselubung).
- **Trombosit:** Perubahan $> 50\%$ atau penurunan di bawah $100.000/\mu\text{L}$ $\rightarrow$ HOLD (Waspada clumping trombosit / pseudotrombositopenia).

### 3. Penanganan Hasil yang Ditahan (Held / Flagged Results)
3.1. Hasil yang berada di luar batas kriteria autoverifikasi akan berstatus **HOLD (Tertahan)** pada antrean LIS dan diberi kode alasan penahanan (mis. `ERR_DELTA_CHECK_HB`, `ERR_HIL_LIPEMIC`, `ERR_PANIC_GLUCOSE`).  
3.2. Analis melakukan investigasi langkah pertama:
- Periksa kesesuaian identitas tabung dan barcode spesimen.
- Periksa kondisi fisik sampel (bekuan mikro, lipemia berat, atau lisis).
- Lakukan pemeriksaan ulang (re-run) bila ada kecurigaan kesalahan pipetasi atau kontaminasi.
3.3. Jika hasil konfirmasi tetap menunjukkan perubahan nyata, analis segera meneruskan kasus tersebut ke Penanggung Jawab Laboratorium (dr. Sp.PK) untuk validasi klinis manual dan konsultasi dengan dokter pengirim.

### 4. Jejak Audit dan Validasi Sistem (Audit Trail)
4.1. Seluruh transaksi autoverifikasi wajib mencatat metadata secara otomatis:
- Waktu autoverifikasi (timestamp presisi detik)
- Versi aturan mesin yang mengeksekusi (`ENGINE_VER_AUTO10`)
- Identitas sistem (`VERIFIED_BY: SYSTEM_AUTOVERIFY`)
4.2. Evaluasi berkala: Komite Mutu Laboratorium melakukan uji petik (sampling) minimal 50 hasil autoverifikasi setiap bulan untuk memvalidasi spesifisitas dan sensitivitas aturan.

---

[[DOKUMEN_TERKAIT]]
1. Matriks Batas Ambang Delta Check dan Rentang Kritis (FM/LAB-7.3/04)
2. Log Harian Hasil Tertahan dan Investigasi Delta Check (FM/LAB-7.3/05)
3. Laporan Validasi Algoritma Autoverifikasi LIS Tahunan (FM/LAB-7.3/06)
4. Dokumen Prosedur Pasca-Analitik & Pelaporan Nilai Kritis (SMM_L2_005)
