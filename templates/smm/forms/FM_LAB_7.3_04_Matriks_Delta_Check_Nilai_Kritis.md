# FORMULIR REKAMAN MUTU (LEVEL 4)
## MATRIKS AMBANG BATAS DELTA CHECK DAN NILAI KRITIS (PANIC VALUES)
**Kode Formulir:** FM/{{TENANT_CODE}}/LAB-7.3/04  
**Edisi / Revisi:** 01 / 00  
**Terkait SOP:** SOP/{{TENANT_CODE}}/LAB-7.3-002 (Autoverifikasi) & SOP/{{TENANT_CODE}}/LAB-7.4-001 (Nilai Kritis)  
**Klausul ISO 15189:2022:** 7.3.7 Autoverification & 7.4.1.6 Critical Results  
**Kepemilikan Aset:** OWNED_BY: generic  

---

### I. Matriks Ambang Batas Delta Check Rutin (CLSI AUTO10-A)
*Digunakan oleh aturan LIS untuk menahan (*HOLD*) rilis hasil otomatis bila riwayat pasien melompat:*

| Parameter Analit | Satuan | Rentang Waktu Maksimal | Batas Delta Absolut | Batas Delta Persentase | Tindakan Saat Pelanggaran |
|---|---|---|---|---|---|
| **Hemoglobin (Hb)** | g/dL | 48 Jam | > 2.0 g/dL | > 20% | Tahan, cek riwayat perdarahan / transfusi |
| **Kreatinin Serum** | mg/dL | 72 Jam | > 0.5 mg/dL | > 50% | Tahan, cek riwayat hemodialisis / AKI |
| **Kalium (K+)** | mmol/L | 24 Jam | > 1.0 mmol/L | > 25% | Tahan, cek indeks hemolisis / kontaminasi EDTA |
| **Natrium (Na+)** | mmol/L | 24 Jam | > 10.0 mmol/L | > 8% | Tahan, konfirmasi status hidrasi |
| **Trombosit (Platelet)** | 10*3/µL | 48 Jam | > 100.000 /µL | > 50% | Tahan, cek apusan bekuan mikro darah tepi |

---

### II. Matriks Batas Pelaporan Nilai Kritis Cito (SLA < 30 Menit)
| Parameter Analit | Satuan | Batas Kritis Bawah (Panic Low) | Batas Kritis Atas (Panic High) | Bahaya Klinis Mengancam Jiwa |
|---|---|---|---|---|
| **Glukosa Dewasa** | mg/dL | < 45 | > 450 | Koma hipoglikemik / Ketoasidosis Diabetikum |
| **Kalium (K+)** | mmol/L | < 2.8 | > 6.2 | Aritmia ventrikel fatal / Asistol |
| **Natrium (Na+)** | mmol/L | < 120 | > 160 | Edema serebri / Kejang metabolik |
| **Hemoglobin (Hb)** | g/dL | < 7.0 | > 20.0 | Syok hipoksia / Krisis hiperviskositas |
| **Trombosit** | 10*3/µL | < 20.0 | > 1.000.0 | Perdarahan intrakranial spontan |
| **Troponin T / I** | ng/mL | — | > 0.1 | Infark Miokard Akut (NSTEMI / STEMI) |

---

### III. Pengesahan Kebijakan Laboratorium
Disahkan pada tanggal: {{EFFECTIVE_DATE}}  
Dokter Penanggung Jawab Laboratorium (dr. Sp.PK): {{LAB_DIRECTOR_NAME}}
