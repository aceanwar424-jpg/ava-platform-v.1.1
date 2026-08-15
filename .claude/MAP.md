# Repo Map — OneLab Platform

> **Cara pakai (baca ini dulu sebelum buka file):** untuk tugas apa pun, cari areanya di
> **§1 Routing** → langsung buka file + fungsi yang disebut (pakai Grep nama fungsi, bukan
> baca seluruh file). Cek **§4 Jebakan** sebelum menulis kode. Setelah mengubah struktur
> (tambah/hapus fungsi/kolom/konvensi), **update baris MAP terkait**. Peta ini menyimpan hal
> yang TIDAK bisa di-derive dari AST (realita skema, konvensi, jebakan) — graphify hanya untuk
> "cari simbol X" di file yang belum dikenal.

Anchor = **nama fungsi**, bukan nomor baris (baris cepat bergeser). Grep nama fungsinya.

---

## 1. Routing (task → file → fungsi kunci)

**Dua frontend terpisah:**
- **Main app (staff/admin):** `index.html` + `modules/*.js` + `js/core/*.js` + `css/style.css`.
- **Client portal:** `apps/index.html` + `apps/app.js` + `apps/style.css`. Peran: patient / corporate / referral.

| Area | File | Fungsi kunci |
|---|---|---|
| Portal corporate — Home | `apps/app.js` | `renderCorporateHome`, `switchCiTab`, `loadCorporateData` |
| Portal corporate — Master Employee | `apps/app.js` | `renderCorporateList`, `openAddEmployeeModal`, `submitAddEmployeeForm`, `editEmployeePortal`, `empPosition` |
| Portal corporate — Book/Approval/History | `apps/app.js` | `renderBookExamination`+`submitExamBooking`, `renderExamApproval`+`saveExamApproval`, `renderExamHistory`, `filterBookExam`, `genBatchCode` |
| Hasil MCU & Account Statement (ADMIN, tab di Config Corporate) | `modules/config_package.js` | `renderCorpResultsAdmin`+`exportCorpResultsAdmin` (lab_results via admisi corporate), `renderCorpStatementAdmin`+`exportCorpStatementAdmin` (invoices+saldo), `_csvDownload`. Tab via `switchCorpDetailTab('results'/'statement')`. (Dulu di portal — dipindah ke admin.) |
| Portal — menu/peran/login | `apps/app.js` | `renderSidebarMenu`, `showView`, `handleLogin` |
| Config corporate (admin) | `modules/config_package.js` | `openCorpForm` (multi-tab), `openCorpEmployees`, `saveCorpEmpInline`, `_caStyleTag` |
| Import karyawan (admin, 9-kolom) | `modules/import_excel.js` | `_importCorpEmployees`, `IMPORT_TEMPLATES` |
| Admisi (registrasi pasien) | `modules/admission.js` | `saveAdmission`, `renderAdmList`, `computeAdmBill`, `addPackageLines` (urai paket→services) |
| Finance / Invoice | `modules/finance.js` | `renderFinance`, `saveInvoice`, `loadInvoices`, `openCorpMcuInvoicing`+`generateBatchInvoice` (invoice MCU korporat per batch → link `corp_exam_requests.invoice_id`) |
| Admisi — no-show & backfill | `modules/admission.js` | `sweepNoShowBookings` (auto-cancel 1×24j), `backfillBookingServices` + `buildServicesFromPkg` (lengkapi paket booking lama) — dipanggil 1×/sesi di `loadAdmissions` |
| Portal — buat admisi dari booking | `apps/app.js` | `buildPackageServices` (urai paket→services+total), dipakai `saveExamApproval` & `scheduleMcuBookingPortal` |
| Anamnesa → barcode lab | `modules/anamnesa.js` | `ensureSampleLabels`, `printAnamnesaLabels` |
| Lab check-in / hasil / cetak | `modules/lab/checkin.js`, `results.js`, `report.js` | `checkInBarcode`, `printLabReport` |
| Barcode / label | `js/core/barcode.js` | `code128B_SVG`, `printLabBarcodes` (lab), `printClinicLabel` (klinik) |
| Helper Supabase | `js/core/api.js` | `sbGet`, `sbPost`, `sbPatch`, `sbDelete`, `sbRpc` |
| Modal / toast | `js/core/utils.js` | `openModal(html, size)` (size: `'wide'`/`'narrow'`), `closeModalForce`, `toast` |

Modul lain: `modules/hrd.js` (karyawan OneLab internal, ≠ corporate), `cashier.js`, `mcu.js`, `ris.js`/`radiology.js`, `finance.js`/`accounting.js`, `mou.js`, `partners/`, dll — buka sesuai nama.

**Connector alat lab** (Node.js daemon terpisah, bukan frontend): `connector/onelab-connector.js` — TCP listener ASTM/HL7 → Supabase `analyzer_messages`. Punya halaman status lokal `localhost:9999` (`STATUS_HTML`) dengan tab **LIS** parsing manual offline (`lisParse`/`lisExport`, no backtick/`${}` di dalam template literal). Ada 2 salinan identik: repo `connector/` (tracked) + `D:\onelab-platform-main\connector` (live/dijalankan) — edit repo lalu `cp` ke live.

---

## 2. Data model — REALITA (bukan skema arsip)

- **`corporate_employees`** — kolom NYATA: `corporate_id, corporate_name, full_name, employee_id, department, gender (M/F), birth_date, phone, email, status (Aktif/Non-Aktif), notes, package_id, package_name, mcu_date, booking_admission_id, assigned_by/at, created_at, updated_at`.
  ⚠️ Field karyawan lain (**job_position, level, blood_type, marital, religion, place_of_birth, id_type, id_number**) **BUKAN kolom** — di-pack ke `notes`: `Position: X, Level: Y · Blood: Z · Marital: W · ID: KTP 123 · POB: Kota`. Baca via `empPosition(e)` di apps.
- **`admissions`** — `patient_*` (name/gender/dob/phone/email/id_type/id_number/address/city/…), `visit_type` (`'Project MCU'` utk corporate), `status` (`Booking`/`Registered`/`Cancelled`), `mr_number`, `visit_number`, `corporate_id`, `corporate_employee_id`, `package_id/name`, `discount_scheme='corporate'`, `scheme_ref_id`.
- **`corp_exam_requests`** (alur requestor→approval) — `corporate_id, booking_batch, branch, book_date, type_of_test, package_id/name, corporate_employee_id, patient_name, patient_id_number, department, job_position, exam_status (Requested/Approved/Rejected), requested_by, approved_by, reject_reason, admission_id`.
- **`user_profiles`** — `id (uuid), full_name, role, phone, avatar_url, corporate_id, corp_role ('requestor'|'approver')`.
- **`corporates`** — `kode_corp, corporate_name, industry, pic_name/phone/email, billing_type, payment_terms, credit_limit, discount_type/value, status`; + `sap_id, brand, npwp, bank_*, cashback_balance` bila migrasi terkait sudah dijalankan.
- **`packages` / `package_items`** — master paket MCU (sumber dropdown paket di Book Examination).

**Format:** MR = `MR-` + 8 digit · Visit = `VISIT-YYYYMMDD-xxxx` · Batch = `XXXX.YYYYMMDD.NNNN`.

---

## 3. Konvensi

- **Cache-bust `?v=`** — tiap `<script src="x.js?v=YYYYMMDDx">` di `index.html` & `apps/index.html`. **Bump `?v=` setiap kali edit** JS/CSS-nya, kalau tidak browser/Vercel sajikan versi lama. (Pola: `20260726a`→`b`→…)
- **Helper Supabase** (`api.js`) melempar error saat non-2xx. Selalu lewat `sbGet/sbPost/sbPatch/sbDelete` — jangan `fetch` mentah.
- **Modal** via `openModal(html,'wide')`; tutup `closeModalForce()`.
- **Peran portal**: `renderSidebarMenu` gate berdasarkan `currentRole` (patient/corporate/referral) + `currentCorpRole` (requestor/approver). Superadmin = `currentUserEmail === 'aceanwar424@gmail.com'`.
- **Verifikasi**: `node --check <file>` untuk sintaks. Preview `file://` sering TIDAK jalankan script → verifikasi via cek `typeof fn` + `fn.toString()` di browser, atau harness Node (`vm`).
- **Deploy**: Vercel statis. Push ke `main` → auto-deploy. `apps.avahealth.sbs`→`/apps/`, host utama→`/index.html` (lihat `vercel.json`).

---

## 4. Jebakan (yang sudah pernah menggigit)

1. **Kolom `corporate_employees` terbatas** — jangan POST job_position/level/blood/dll sebagai kolom (→ 400). Pack ke `notes` (lihat §2). Selalu samakan dengan `saveCorpEmpInline` di config.
2. **Var `let` module-scoped** (`currentCorporateId`, `currentCorporateName`, `currentCorpRole`, `currentUsername`, `currentUserProfile`, `currentUserEmail`) **tidak** ada di `window` → tak bisa di-set dari console/test; renderer guard padanya (early-return kalau null).
3. **`?v=` wajib bump** — perubahan tak muncul di web tanpa itu (bukan bug).
4. **Preview statis strip script** — jangan andalkan render live untuk verifikasi; pakai `node --check` + inspeksi source fungsi.
5. **Dua jalur import karyawan** — `import_excel.js` (9-kolom, cocokkan `kode_corp`) vs importer scoped. Template & format beda.
6. **Paket ≠ data master** — paket muncul di Book Examination & Examination History, BUKAN di Master Employee.
7. **Skema arsip ≠ DB live** — file di `sql_arsip/` bisa beda dari tabel nyata. Sumber kebenaran kolom = payload `sbPost`/`sbPatch` yang terbukti bekerja.
8. **graphify** bisa basi & tak simpan skema/konvensi — sekunder saja.
9. **Booking korporat WAJIB isi `services`** — admisi dari paket harus mengisi field `services` (JSON tes komponen) via `buildPackageServices`/`addPackageLines`, kalau tidak tab Services kosong & tagihan Rp 0. Paket harus punya `package_items` agar terurai.

---

## 5. Flow inti

- **MCU korporat:** Requestor (*Book Examination*) → `corp_exam_requests` (Requested) → Approver (*Examination Approval*: centang tolak+alasan, sisa auto-approve) → Approved ⇒ buat `admissions` (Booking) ⇒ pipeline lab ⇒ *Examination History*. **1 layer** (Manager).
- **Lab:** admisi → Anamnesa (generate & cetak barcode) → check-in → input hasil → validasi → cetak (`printLabReport`, layout thead/tfoot berulang).
- **Label:** klinik (`printClinicLabel`, saat registrasi) vs sampel lab (`printLabBarcodes`, di Anamnesa). Beda peruntukan.
