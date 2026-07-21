# AGENTIC VISION — Proyeksi Kesehatan 100 Tahun
### Ke mana organisasi agent OneLab berkembang, dan apa yang harus ditambahkan

Dokumen acuan strategis jangka panjang. Melengkapi `AGENTIC_ROADMAP.md` (yang
mencakup horizon dekat). Diperbarui saat asumsi/teknologi berubah.

---

## 0. Titik tolak (2026)

11 departemen "operational excellence" — sebagian besar **reaktif**: memantau &
menandai (flag) apa yang sudah terjadi, dengan **manusia memegang keputusan
klinis/finansial**. Evolusi 100 tahun bergerak di 3 sumbu:

1. **Reaktif → Prediktif → Preskriptif**
2. **Internal → Terhubung (interoperable) → Ekosistem**
3. **Operasional → Klinis-lanjut → Terprogram**

…dengan satu **tulang punggung kepercayaan** yang tumbuh sebanding otonomi.

---

## 1. Horizon 1 — 2026–2035: Terhubung & Prediktif

**Tren:** interoperabilitas wajib (SATUSEHAT/BPJS/FHIR di Indonesia), analitik
prediktif, UU PDP & tata kelola AI, telemedicine & home-diagnostics.

| Tambahkan | Fungsi | Grounding data |
|---|---|---|
| 🔮 **Predictive Intelligence** | forecast stockout, demand/kunjungan, TAT, risiko piutang, LOS | ada (avg_monthly_usage, timestamp, admissions) |
| 🔌 **Interoperability & Claims** | sinkron SATUSEHAT/BPJS/FHIR, watch klaim ditolak, map ICD | perlu kredensial SATUSEHAT/BPJS |
| 🛡️ **Data Governance & Privacy** | kepatuhan UU PDP, consent, minimisasi PII | perlu model consent |
| 🩺 **Clinical Decision Support (R3)** | bantu interpretasi hasil — SELALU konfirmasi manusia | lab_results (ada) |
| 🏘️ **Population Health / Preventif** | kohort skrining, recall follow-up | perlu data recall/riwayat |

## 2. Horizon 2 — 2035–2075: P4 Medicine (Prediktif·Preventif·Personal·Partisipatif)

**Tren:** multi-omics rutin, wearable/IoT streaming, liquid biopsy & deteksi dini,
longevity biomarkers, digital twin pasien, resistensi antimikroba (AMR), climate-health.

| Tambahkan | Fungsi |
|---|---|
| 🧬 **Genomics & Pharmacogenomics** | lab jadi hub omics; dosis obat berbasis gen |
| ⌚ **Continuous Monitoring** | ingest wearable/implant, deteksi anomali dini |
| 🦠 **Epidemiologi & AMR Surveillance** | pantau wabah & resistensi antibiotik |
| 👥 **Digital Twin / Risiko Longitudinal** | prediksi risiko individual sepanjang waktu |
| 🤖 **AI/Model Governance (MLOps)** | pantau drift/bias model & agent itu sendiri |

## 3. Horizon 3 — 2075–2125: Kesehatan Terprogram & Otonom

**Tren:** gene/cell therapy point-of-care, synthetic biology, nanomedicine & sensor
in-vivo, BCI/neuro-data, regenerative/organ printing, lab robotik otonom, kesehatan luar-Bumi.

| Tambahkan | Fungsi |
|---|---|
| ⚗️ **Autonomous Lab Orchestration** | robotik lab dengan **supervisor keselamatan** wajib |
| 🧪 **Advanced Therapy QA** | mutu terapi gen/sel yang diproduksi di tempat |
| 🧠 **Neuro-data & Bio-sensor Governance** | data paling sensitif dalam sejarah |
| ♻️ **Sustainability / Climate-Health** | jejak karbon lab, kesiapan iklim |

---

## 4. Tulang punggung yang WAJIB tumbuh (lintas semua horizon)

1. **Provenance & Trust Ledger** — audit tak-terubah, *explainability*, silsilah data.
   Makin otonom sistem, makin krusial.
2. **Ethics & Equity Governance** — bioetika, consent, keadilan akses. Keputusan berat = dewan manusia.
3. **Security berlipat** — data genomik/neuro = identitas permanen; kebocoran tak bisa "diganti password".
4. **Human-in-the-loop klinis/finansial/etis TIDAK PERNAH hilang** — justru makin dalam.
   Ini invariant desain OneLab sejak awal (Matriks Mandat R1/R2/R3).

## 5. Pola besarnya

> Jumlah **agent** berlipat, tapi dua hal tetap: **otoritas manusia** atas keputusan
> klinis/finansial/etis, dan **infrastruktur kepercayaan** (provenance, governance,
> keamanan) yang tumbuh sebanding otonomi. Sistem yang menang bukan yang paling
> **otomatis** — tapi yang paling **tepercaya & dapat dipertanggungjawabkan**.

## 6. Urutan build yang disarankan

| Fase | Bangun | Kesiapan |
|---|---|---|
| **8A** | 🔮 Predictive Intelligence | ✅ **SELESAI** — INSIGHT (stockout/demand/collection-risk) |
| **8B** | 🔌 Interoperability & Claims (SATUSEHAT/BPJS) | perlu kredensial API dari user |
| **8C** | 🛡️ Data Governance & Privacy (UU PDP) | perlu model consent |
| **8D** | 🩺 Clinical Decision Support (advisory) | ✅ **SELESAI** — LAB_CDS (delta check + konsistensi data; flag, klinis=manusia) |
| 9+ | Horizon 2 (genomics · wearables · AMR · digital twin) | perlu skema data baru |
| 10+ | Horizon 3 (autonomous lab · advanced therapy · governance) | riset & regulasi |

**Prinsip eksekusi:** setiap agent baru mengikuti Matriks Mandat + guardrail
(klinis/finansial/etis = manusia), dan menambah, bukan mengurangi, jejak audit.
