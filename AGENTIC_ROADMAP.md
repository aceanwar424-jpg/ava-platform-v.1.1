# AGENTIC ROADMAP — OneLab
### Peta pengembangan organisasi agent lintas-domain (analisis menyeluruh)

Dokumen acuan strategis. Menyatukan kondisi sekarang, celah, katalog departemen
(existing + usulan), guardrail wajib, dan urutan build. Diperbarui saat fase selesai.

---

## 1. Prinsip & tingkat mandat

Organisasi: **CEO → HEAD → Kepala Departemen → anggota**. HEAD memutuskan sesuai
**Matriks Mandat**; peran QA jadi gerbang mutu di dalam departemennya.

| Tier | Arti | Contoh |
|---|---|---|
| **R1** | HEAD putuskan & jalankan sendiri (butuh QA PASS bila diset) | konten edukasi, analisis internal, log |
| **R2** | HEAD setujui; eksekusi/publish tetap **CEO** | dokumen QMS, draft PO, brief |
| **R3** | Hanya rekomendasi; keputusan **manusia** | klaim medis, keputusan klinis/finansial |

### Guardrail lintas-domain (mengalahkan matriks apa pun)
- **Klinis** (hasil, diagnosis, nilai kritis, nasihat medis) → **selalu R3 / manusia**. Agent hanya draft & flag.
- **Finansial** (bayar, transfer, refund, pembelian) → **agent tidak pernah eksekusi** — hanya analisis/draft.
- **Data pasien** → di bawah IT_SEC; minimalkan paparan PII.
- **Kredensial/SDM** → keputusan manusia; agent memantau & mengingatkan.

---

## 2. Kondisi sekarang (sudah dibangun)

| Departemen | Kode | Cakupan | Status |
|---|---|---|---|
| 🧪 Service Assurance | `SA_HEAD` · SA_DOC · SA_AUDIT · SA_REG · SA_CAPA · QA_MUTU | Dokumen QMS L1–L4, audit internal, CAPA, regulasi, template `.docx` fidelity | ✅ |
| ✍️ Marketing | `MKT_HEAD` · MKT_SEO · MKT_COPY · MKT_DESIGN · MKT_SOCIAL · QA_KONTEN | Analisis konten, carousel multi-kanal, SEO, blog | ✅ |
| 🖥️ IT Profesional | `IT_HEAD` · IT_SRE · IT_SEC · IT_DATA · IT_DEV | Keandalan, keamanan (audit postur), data, otomasi/self-heal prompt | ✅ (perlu perluasan) |
| 📋 TEAM_OPS · 🚚 LOGISTIK | lintas-fungsi | SLA/standup · inventory (nonaktif) | ⚠️ minimal |

Framework kepatuhan aktif: **ISO 15189:2022 · Akreditasi Klinik · ISO 9001:2015**.

---

## 3. Peta domain × cakupan agentic

| Domain | Modul inti | Agentic | Gap |
|---|---|---|---|
| Mutu & Dokumen | wiki/sop, regulatory_reports | Service Assurance | — |
| Marketing | marketing, wiki/studio | Marketing | CRM belum |
| Platform/IT | settings, lab/integration | IT | backup & integrasi belum di-wire |
| **Operasional Lab** | lab/qc, worklist, results, validation, report, mcu, radiology | — | ❌ core bisnis kosong |
| **Klinik/Medis** | admission, medrecord, anamnesa | — | ❌ (semua R3) |
| **Home Care** | homecare, maps, work_schedule | — | ❌ |
| **Finance & Billing** | finance, cashier, voucher | — | ❌ (advisory) |
| **CRM/Sales/Mitra** | leads, partners, deals, mou | — | ❌ |
| **Inventory & Procurement** | inventory, import_excel | LOGISTIK (mati) | ⚠️ scaffold |
| **HRD & Kredensial** | hrd, attendance, org_structure | — | ❌ feed akreditasi |
| **Executive/BI** | executive_dashboard | HEAD standup | ⚠️ minimal |
| **Customer Experience** | keluhan/hasil pasien | — | ❌ ISO §7.7 |

**Temuan:** agentic kuat di back-office mutu & konten, tetapi **belum menyentuh core operasional lab & mesin uang** — area bernilai tertinggi.

---

## 4. Katalog departemen usulan

### A. 🔬 Lab Operations Assurance — `LAB_*`
Misi: mutu & kecepatan operasional lab, real-time.
| Agen | Tugas | Task type | Mandat |
|---|---|---|---|
| LAB_HEAD | orkestrasi ops lab | `LAB_TICK` | R1 |
| LAB_QC | sentinel QC (Westgard), out-of-control → kait PMI/PME | `QC_WATCH` | R1 (analisis); tindakan klinis R3 |
| LAB_TAT | pantau turnaround time, hasil terlambat | `TAT_MONITOR` | R1 |
| LAB_CRIT | pengawas nilai kritis (draft alur eskalasi) | `CRITICAL_WATCH` | **R3** |
| LAB_WL | prioritas worklist, spesimen tertahan | `WORKLIST_TRIAGE` | R1 |
Dependency: skema lab/qc, results, worklist.

### B. 👥 People & Credentialing — `HR_*`
Misi: SDM & kredensial yang selalu compliant.
| Agen | Tugas | Task type | Mandat |
|---|---|---|---|
| HR_HEAD | orkestrasi HR | `HR_TICK` | R1 |
| HR_CRED | pantau kedaluwarsa STR/SIP, kompetensi, orientasi → alert | `CRED_WATCH` | R1 alert |
| HR_ROSTER | anomali absensi/jadwal, usul roster | `ROSTER_CHECK` | R1 |
Nilai: langsung menyuplai **Akreditasi Klinik (TKK)** & **ISO 15189 §6.2**.

### C. 📦 Supply Chain — aktifkan `LOGISTIK` → dept `SCM_*`
| Agen | Tugas | Task type | Mandat |
|---|---|---|---|
| SCM_HEAD | orkestrasi supply | `SCM_TICK` | R1 |
| SCM_STOCK | FEFO/kedaluwarsa reagen & BHP, reorder, prediksi stockout | `STOCK_WATCH` | R1 |
| SCM_PO | draft PO (harga `[[KONFIRMASI]]`) | `PO_DRAFT` | R2 (**beli = manusia**) |

### D. 💰 Revenue & Finance Intelligence — `FIN_*` (advisory)
| Agen | Tugas | Task type | Mandat |
|---|---|---|---|
| FIN_AR | aging piutang, draft pengingat | `AR_AGING` | R2 (kirim = manusia) |
| FIN_LEAK | kebocoran pendapatan (tes tanpa tagih, diskon janggal) | `REV_LEAK` | R1 analisis |
| FIN_RECON | rekonsiliasi kasir vs billing | `RECON` | R1 |
Guardrail: **tanpa transaksi/transfer oleh agent**.

### E. 🤝 Growth & CRM — perluas Marketing / `CRM_*`
| Agen | Tugas | Task type | Mandat |
|---|---|---|---|
| CRM_LEAD | skoring lead, draft follow-up | `LEAD_SCORE` | R2 |
| CRM_DEAL | higienis pipeline, deal mandek | `DEAL_HYGIENE` | R1 |
| CRM_MOU | pantau kedaluwarsa MOU/kontrak → alert perpanjangan | `MOU_WATCH` | R1 |

### F. 💬 Customer Experience — `CX_*` (ISO §7.7)
| Agen | Tugas | Task type | Mandat |
|---|---|---|---|
| CX_COMPLAINT | terima & klasifikasi keluhan, draft respons | `COMPLAINT_TRIAGE` | R2 (kirim = manusia) |
| CX_FEEDBACK | ringkas NPS/umpan balik → indikator mutu | `FEEDBACK_SUMMARY` | R1 |

### G. 📊 Executive Intelligence — evolusi `TEAM_OPS` / `BI_*`
Digest lintas-domain harian/mingguan: mutu, TAT lab, kas, stok kritis, kredensial jatuh tempo — satu ringkasan untuk CEO. `EXEC_DIGEST` R1.

### H. Perluasan IT (existing)
- IT_DATA → `BACKUP_VERIFY` (butuh sumber backup Anda), `INTEGRATION_HEALTH` (alat/LIS berhenti kirim).
- IT_SRE → uptime probe endpoint app + alert.
- IT_DEV → `DEPLOY_LOG` / regresi prompt.

---

## 5. Prioritas & urutan build

| Fase | Departemen | Dampak | Usaha | Risiko | Status |
|---|---|---|---|---|---|
| **7J** | Supply Chain (aktifkan LOGISTIK) | Tinggi | Rendah | Rendah | ✅ **SELESAI** |
| **7I** | People & Credentialing | Tinggi | Rendah | Rendah | ✅ **SELESAI** (tabel `staff_credentials` dibuat) |
| **7G** | Perluasan IT (integrasi + backup pg_dump) | Tinggi | Rendah | Rendah | ✅ **SELESAI** (Integration Health + Backup Verify) |
| **7H** | Lab Operations Assurance | Tinggi | Sedang | Sedang (klinis→R3) | ✅ **SELESAI** (QC Westgard · TAT · nilai kritis) |
| 7K+ | Finance · CRM · CX · Exec BI | Sedang | Sedang | Rendah | — (sisa roadmap) |

**Keputusan CEO (18 Jul 2026):** build 7G–7J disetujui.
**Build 7J SELESAI (18 Jul 2026):** `supabase_agentic_fase7j_scm.sql` + handler worker + org UI.
LOGISTIK diaktifkan jadi Kepala Supply Chain (SCM_STOCK · SCM_PO); RPC `agentic_scm_scan`
membaca `inventory_items`/`inventory_batches`/`suppliers` nyata; task SCM_TICK/STOCK_WATCH/PO_DRAFT.
Guardrail: pembelian/PR = manusia (agent hanya draft + alert).

Catatan blocker fase berikutnya:
- **7I** — `public.employees` BELUM punya field STR/SIP + kedaluwarsa → perlu tambah kolom / tabel `staff_credentials` dulu.
- **7G** — perlu tahu mekanisme backup (Supabase PITR / pg_dump / lain) sebelum `BACKUP_VERIFY`.

### Pola build tiap departemen (konsisten Fase 7)
1. SQL: agents (nesting `reports_to`), `department`, decision_rights, prompt, RPC data-scan.
2. Worker: handler `*_TICK` + task type domain, baca data via RPC.
3. UI: kartu departemen di org tree + panel/tab terkait.
4. Guardrail: klinis/finansial dipaksa R3/no-exec.
5. Dok: tambах bagian di AGENTIC_FASE7.md + update roadmap ini.

---

## 6. Prasyarat data per departemen (yang perlu dipastikan sebelum build)
- **Lab Ops**: struktur tabel QC (nilai kontrol, batas), results (TAT timestamps), worklist status, daftar nilai kritis.
- **Credentialing**: field STR/SIP + tanggal kedaluwarsa di modul HRD.
- **Supply Chain**: tabel stok reagen/BHP + tanggal kedaluwarsa + titik pesan ulang.
- **IT_DATA backup**: lokasi/mekanisme backup (Supabase PITR / pg_dump ke storage / lain).
