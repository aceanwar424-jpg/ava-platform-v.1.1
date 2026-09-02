// ═══════════════════════════════════════════════════════════════
// DIBANGKITKAN OTOMATIS dari config/menu.json — jangan disunting tangan.
// Jalankan ulang: node scripts/bangun-menu.js
//
// Struktur menu seluruh ruang kerja. Sebelumnya ditulis tangan sebagai
// FLYOUT_MENUS di dalam index.html, terpisah dari dokumen pemetaannya —
// dan keduanya sudah menyimpang.
// ═══════════════════════════════════════════════════════════════
window.PETA_MENU = {
  "ruang": {
    "ops": {
      "nama": "Holding HQ — CEO Cockpit",
      "subdomain": "ops.avahealth.sbs",
      "peran": "Pemantauan penuh lintas seluruh unit usaha. SATU-SATUNYA ruang yang melihat semua kategori.",
      "lihat_semua": true,
      "kategori": [
        "utama",
        "tech",
        "his",
        "lis",
        "korporat",
        "wellness",
        "keuangan",
        "logistik",
        "sdm",
        "mutu",
        "agentic",
        "konsumen",
        "konfigurasi",
        "marketing",
        "avahealth",
        "radiologi",
        "support-medical"
      ]
    },
    "tech": {
      "nama": "AVA Tech — Pembangun & Penjual Sistem",
      "subdomain": "tech.avahealth.sbs",
      "peran": "Tim brand Tech: penguasa pengembangan sistem sekaligus komersialisasinya. Langsung ke halaman masuk.",
      "kategori": [
        "tech",
        "marketing",
        "keuangan",
        "sdm",
        "konfigurasi",
        "agentic"
      ]
    },
    "his": {
      "nama": "HIS — Klinik & Seluruh Layanan Non-Lab",
      "subdomain": "his.avahealth.sbs",
      "peran": "Seluruh sistem klinik: rawat jalan, rawat inap, radiologi, farmasi, home care, MCU korporat. Semua yang BUKAN laboratorium.",
      "kategori": [
        "his",
        "radiologi",
        "support-medical",
        "avahealth",
        "korporat",
        "marketing",
        "keuangan",
        "mutu",
        "sdm",
        "konfigurasi"
      ]
    },
    "lis": {
      "nama": "LIS — Laboratorium Diagnostik",
      "subdomain": "lis.avahealth.sbs",
      "peran": "Seluruh alur laboratorium: pra-analitik, analitik, pasca-analitik, master data tes, rujukan, dan logistik reagen.",
      "kategori": [
        "lis"
      ]
    },
    "wellness": {
      "nama": "Wellness — Nutrition & Personal Care",
      "subdomain": "wellness.avahealth.sbs",
      "peran": "Gabungan AVA Nutrition dan AVA Care di bawah satu payung wellness, ditambah Sanctuary. Sebelumnya terpecah tiga subdomain dengan isi yang sama.",
      "kategori": [
        "wellness",
        "marketing",
        "keuangan",
        "logistik",
        "konfigurasi"
      ]
    }
  },
  "kategori": {
    "utama": {
      "label": "Holding HQ",
      "ikon": "home",
      "grup": [
        {
          "nama": "Pemantauan",
          "menu": [
            {
              "id": "dashboard",
              "label": "Dashboard Operasional Holding",
              "status": "ada",
              "ket": "Ringkasan lintas 6 pilar dari kueri nyata"
            },
            {
              "id": "ops-kendali",
              "label": "Pusat Kendali Operasional",
              "status": "ada",
              "ket": "Apa yang perlu ditangani sekarang, lintas unit"
            },
            {
              "id": "executive-dashboard",
              "label": "CEO Master Cockpit",
              "status": "ada",
              "ket": "P&L 6 pilar, tenant aktif, burn rate, BEP"
            },
            {
              "id": "holding-finance",
              "label": "Konsolidasi Finansial 6 Pilar",
              "status": "ada",
              "ket": "EBITDA konsolidasi & metrik investor"
            }
          ]
        },
        {
          "nama": "Gerbang Sistem Lain",
          "menu": [
            {
              "id": "apps-hub",
              "label": "Portal Konsumen",
              "status": "belum",
              "ket": "Pintasan ke portal pasien, korporat & wellness"
            },
            {
              "id": "support-hub",
              "label": "Perangkat Pendukung",
              "status": "belum",
              "ket": "Pintasan ke kiosk, TV antrian, monitor CRM"
            }
          ]
        }
      ],
      "pendek": "Holding"
    },
    "tech": {
      "label": "AVA Tech",
      "ikon": "sliders",
      "grup": [
        {
          "nama": "Pengembangan Sistem",
          "menu": [
            {
              "id": "saas-console",
              "label": "Cockpit AVA Tech",
              "status": "ada",
              "ket": "Kesehatan mesin platform & ringkasan klien"
            },
            {
              "id": "tech-roadmap",
              "label": "Roadmap & Rilis",
              "status": "belum",
              "ket": "Rencana versi, catatan rilis, status fase"
            },
            {
              "id": "tech-modul",
              "label": "Katalog Modul & Versi",
              "status": "belum",
              "ket": "Daftar modul yang dilisensikan beserta versinya"
            },
            {
              "id": "tech-isu",
              "label": "Lacak Bug & Permintaan",
              "status": "belum",
              "ket": "Antrean perbaikan dan permintaan fitur dari klien"
            },
            {
              "id": "db-studio",
              "label": "Database Studio",
              "status": "ada",
              "ket": "Inspeksi tabel Postgres & SQL editor",
              "admin": true
            },
            {
              "id": "audit",
              "label": "Jejak Audit Sistem",
              "status": "ada",
              "ket": "Log kronologis perubahan data sensitif",
              "admin": true
            }
          ]
        },
        {
          "nama": "Klien & Lisensi",
          "menu": [
            {
              "id": "tenants",
              "label": "Tenant & Klien Faskes",
              "status": "ada",
              "ket": "Faskes pemakai sistem, paket, kuota & pemakaian"
            },
            {
              "id": "lisensi",
              "label": "Lisensi Instalasi",
              "status": "ada",
              "ket": "Status lisensi Ed25519 & sidik mesin",
              "admin": true
            },
            {
              "id": "tech-aktivasi",
              "label": "Penerbitan & Aktivasi Lisensi",
              "status": "ada",
              "ket": "Buat berkas lisensi untuk mesin klien",
              "admin": true
            },
            {
              "id": "tech-telemetri",
              "label": "Telemetri Instalasi Klien",
              "status": "ada",
              "ket": "Versi terpasang, kesehatan, dan pemakaian per klien",
              "admin": true
            }
          ]
        },
        {
          "nama": "Komersial Sistem",
          "menu": [
            {
              "id": "leads",
              "label": "Prospek Klien SaaS",
              "status": "ada",
              "ket": "Faskes calon pengguna, dari perkenalan ke kontrak"
            },
            {
              "id": "penawaran",
              "label": "Penawaran Lisensi",
              "status": "ada",
              "ket": "Surat penawaran paket SaaS HIS/LIS"
            },
            {
              "id": "mou",
              "label": "Kontrak & PKS Lisensi",
              "status": "ada",
              "ket": "Perjanjian lisensi & pengingat perpanjangan"
            },
            {
              "id": "tech-harga",
              "label": "Paket & Daftar Harga",
              "status": "ada",
              "ket": "Definisi paket lisensi beserta kuota dan tarifnya"
            },
            {
              "id": "finance",
              "label": "Tagihan Langganan",
              "status": "ada",
              "ket": "Faktur langganan klien & status pelunasan"
            }
          ]
        },
        {
          "nama": "Interoperabilitas",
          "menu": [
            {
              "id": "catalog-export",
              "label": "Ekspor Katalog LOINC/UCUM",
              "status": "ada",
              "ket": "Aset utama yang dilisensikan ke klien"
            },
            {
              "id": "satusehat",
              "label": "Jembatan SATUSEHAT",
              "status": "ada",
              "ket": "Kirim Patient, Encounter, Condition, Observation ke Kemenkes lewat FHIR R4"
            },
            {
              "id": "tech-analyzer",
              "label": "Konektor Analyzer",
              "status": "parsial",
              "ket": "ASTM E1381/E1394 di porta 9999; layar pengaturannya belum ada"
            },
            {
              "id": "agentic-apimonitor",
              "label": "Monitor Kuota AI Gateway",
              "status": "ada",
              "ket": "Pemakaian kunci API & rotasi terpusat",
              "rute": "agentic",
              "aksi": "AIGateway.renderMonitorUI()"
            }
          ]
        },
        {
          "nama": "Tim Tech",
          "menu": [
            {
              "id": "hrd",
              "label": "Anggota Tim Tech",
              "status": "ada",
              "ket": "Data personel unit Tech"
            },
            {
              "id": "tech-sprint",
              "label": "Sprint & Beban Kerja",
              "status": "belum",
              "ket": "Pembagian tugas dan kapasitas tim"
            }
          ]
        }
      ],
      "pendek": "AVA Tech"
    },
    "his": {
      "label": "Klinik & HIS",
      "ikon": "hospital",
      "grup": [
        {
          "nama": "Alur Pasien",
          "menu": [
            {
              "id": "admission",
              "label": "Pendaftaran & Admisi",
              "status": "ada",
              "ket": "Registrasi pasien, general consent, gelang identitas"
            },
            {
              "id": "queue",
              "label": "Antrian Poli",
              "status": "ada",
              "ket": "Pemanggilan bersuara & layar ruang tunggu"
            },
            {
              "id": "queue-console",
              "label": "Konsol Panggilan Antrean",
              "status": "ada",
              "ket": "Panggil berikutnya, panggil ulang, tandai tidak hadir, dan pindah loket — dengan pemanggilan bersuara"
            },
            {
              "id": "queue-kiosk",
              "label": "Kiosk Mandiri Pasien",
              "status": "ada",
              "ket": "Ambil nomor sendiri di lobi"
            },
            {
              "id": "appointments",
              "label": "Jadwal Dokter & Perjanjian",
              "status": "ada",
              "ket": "Reservasi konsultasi & pengingat"
            },
            {
              "id": "queue-config",
              "label": "Konfigurasi Antrean",
              "status": "ada",
              "ket": "Loket, prefiks nomor, kuota harian, dan urutan prioritas panggilan"
            }
          ]
        },
        {
          "nama": "Pelayanan Klinis",
          "menu": [
            {
              "id": "emr-soap",
              "label": "EMR SOAP & CPPT",
              "status": "ada",
              "ket": "Rekam medis elektronik dokter, ICD-10/9CM"
            },
            {
              "id": "anamnesa",
              "label": "Anamnesa & Tanda Vital",
              "status": "ada",
              "ket": "Keluhan, riwayat, dan pemeriksaan awal"
            },
            {
              "id": "inpatient",
              "label": "Rawat Inap & Bed Management",
              "status": "ada",
              "ket": "Mutasi tempat tidur & resume pulang"
            },
            {
              "id": "medrecord",
              "label": "Arsip Rekam Medis",
              "status": "ada",
              "ket": "Riwayat kunjungan dan berkas pasien"
            },
            {
              "id": "his-orders",
              "label": "Order Terintegrasi",
              "status": "ada",
              "ket": "Satu layar untuk memesan lab, radiologi, obat, dan tindakan sekaligus; order lab langsung membuat order di LIS"
            },
            {
              "id": "his-procedures",
              "label": "Tindakan & Prosedur",
              "status": "ada",
              "ket": "Katalog tindakan, informed consent digital, catatan tindakan, dan biayanya"
            },
            {
              "id": "his-immunization",
              "label": "Vaksinasi & Imunisasi",
              "status": "ada",
              "ket": "Jadwal, stok vaksin per lot, pelaporan KIPI, sertifikat, dan push ke SATUSEHAT"
            }
          ]
        },
        {
          "nama": "Gawat Darurat & Keselamatan Pasien",
          "menu": [
            {
              "id": "igd-triase",
              "label": "Triase IGD",
              "status": "ada",
              "ket": "Level kegawatan, target waktu tunggu, EWS, dan triase ulang"
            },
            {
              "id": "skrining-risiko",
              "label": "Skrining Risiko",
              "status": "ada",
              "ket": "Jatuh, nyeri, dan gizi — wajib saat admisi"
            },
            {
              "id": "mar",
              "label": "Catatan Pemberian Obat",
              "status": "ada",
              "ket": "Siapa memberikan obat apa, jam berapa; dosis terlewat ikut tercatat"
            }
          ]
        },
        {
          "nama": "Farmasi",
          "menu": [
            {
              "id": "farmasi",
              "label": "Farmasi & E-Prescription",
              "status": "ada",
              "ket": "Resep elektronik, skrining interaksi, stok FEFO"
            }
          ]
        },
        {
          "nama": "Home Care",
          "menu": [
            {
              "id": "homecare",
              "label": "Order Kunjungan Rumah",
              "status": "ada",
              "ket": "Sampling, infus, perawatan luka ke rumah"
            },
            {
              "id": "hc-schedule",
              "label": "Penjadwalan & Dispatch Nakes",
              "status": "ada",
              "ket": "Plotting nakes dan pelacakan keberangkatan"
            },
            {
              "id": "hc-staff",
              "label": "Master Tenaga Kesehatan",
              "status": "ada",
              "ket": "STR/SIP, kompetensi, zona layanan"
            },
            {
              "id": "hc-tariff",
              "label": "Tarif & Komisi Home Care",
              "status": "ada",
              "ket": "Tarif tindakan, zonasi, bagi hasil"
            },
            {
              "id": "hc-billing",
              "label": "Penagihan & Fee Nakes",
              "status": "ada",
              "ket": "Rekap fee kunjungan dan pencairan"
            },
            {
              "id": "hc-report",
              "label": "Laporan Kinerja & CSAT",
              "status": "ada",
              "ket": "Volume kunjungan, ketepatan waktu, kepuasan"
            }
          ]
        },
        {
          "nama": "Kepatuhan & Klaim",
          "menu": [
            {
              "id": "bpjs-claim",
              "label": "Klaim BPJS & INA-CBG",
              "status": "ada",
              "ket": "Grouper tarif & bridging VClaim"
            },
            {
              "id": "satusehat",
              "label": "Integrasi SATUSEHAT",
              "status": "ada",
              "ket": "Kirim Patient, Encounter, Condition, Observation ke Kemenkes lewat FHIR R4"
            },
            {
              "id": "compliance-tracker",
              "label": "Izin & Kepatuhan Faskes",
              "status": "ada",
              "ket": "Masa berlaku izin operasional dan SIP nakes"
            },
            {
              "id": "rl-reports",
              "label": "Laporan RL Kemenkes",
              "status": "ada",
              "ket": "Rekapitulasi RL terisi dari data operasional"
            },
            {
              "id": "his-mpi",
              "label": "Master Rekam Medis (MPI)",
              "status": "ada",
              "ket": "Penggabungan pasien duplikat, riwayat merge, dan penomoran rekam medis"
            },
            {
              "id": "his-mr-governance",
              "label": "Kelengkapan &amp; Retensi Rekam Medis",
              "status": "ada",
              "ket": "Audit kelengkapan RM, jadwal retensi/pemusnahan, dan permintaan salinan oleh pasien atau asuransi"
            }
          ]
        }
      ],
      "pendek": "Klinik"
    },
    "lis": {
      "label": "Laboratorium LIS",
      "ikon": "flask",
      "grup": [
        {
          "nama": "Pra-Analitik & Sampling",
          "menu": [
            {
              "id": "lab",
              "label": "Penerimaan & Barcode",
              "status": "ada",
              "ket": "Check-in spesimen dan cetak barcode tabung CLSI"
            },
            {
              "id": "lis-admission",
              "label": "Order Pemeriksaan",
              "status": "ada",
              "ket": "Pendaftaran order spesimen & auto-split tabung"
            },
            {
              "id": "lis-phlebotomy",
              "label": "Flebotomi & Sampling",
              "status": "ada",
              "ket": "Verifikasi tabung, lokasi flebotomi & timestamp sampling"
            },
            {
              "id": "lis-kelayakan",
              "label": "Kriteria Kelayakan Spesimen",
              "status": "ada",
              "ket": "Verifikasi penerimaan/penolakan spesimen (hemolisis/lipemik/clot)"
            }
          ]
        },
        {
          "nama": "Analitik & Interfacing",
          "menu": [
            {
              "id": "worklist",
              "label": "Worklist Analyzer",
              "status": "ada",
              "ket": "Daftar antrean kerja batch analyzer per instrumen"
            },
            {
              "id": "lab-result",
              "label": "Entry Hasil & Delta Check",
              "status": "ada",
              "ket": "Input hasil, kalkulator pengenceran & deteksi delta check"
            },
            {
              "id": "lis-analyzer",
              "label": "Interfacing Alat (:9999)",
              "status": "ada",
              "ket": "Konfigurasi protokol ASTM E1381/E1394 & channel mapping"
            },
            {
              "id": "lis-lot-verification",
              "label": "Verifikasi Lot Reagen",
              "status": "ada",
              "ket": "Evaluasi bias lot-to-lot & uji paralel kontrol"
            }
          ]
        },
        {
          "nama": "Pasca-Analitik & Otorisasi",
          "menu": [
            {
              "id": "lab-validation",
              "label": "Otorisasi Dokter Sp.PK",
              "status": "ada",
              "ket": "Expert clinical impression & otorisasi medis Sp.PK"
            },
            {
              "id": "lis-critical-value",
              "label": "Logbook Nilai Kritis",
              "status": "ada",
              "ket": "Pencatatan eskalasi nilai kritis SLA < 15 menit & TBaK"
            },
            {
              "id": "lab-approval",
              "label": "Validasi & TTE Digital",
              "status": "ada",
              "ket": "Tanda tangan kriptografis QR & rilis hasil resmi"
            },
            {
              "id": "lab-tat",
              "label": "Monitoring TAT",
              "status": "ada",
              "ket": "Turnaround time pra-analitik, analitik, dan pasca-analitik"
            }
          ]
        },
        {
          "nama": "Quality Control (QC)",
          "menu": [
            {
              "id": "lab-qc",
              "label": "QC Harian & Westgard",
              "status": "ada",
              "ket": "Plot Levey-Jennings, evaluasi 6 multi-rules Westgard & Six Sigma"
            },
            {
              "id": "lis-pme",
              "label": "Uji Profisiensi (PME)",
              "status": "ada",
              "ket": "Kalkulasi Z-Score uji profisiensi eksternal ISO 15189"
            }
          ]
        },
        {
          "nama": "Bio-Bank & Arsip",
          "menu": [
            {
              "id": "lis-sample-archive",
              "label": "Rak Penyimpanan Spesimen",
              "status": "ada",
              "ket": "Manajemen slot freezer -20°C & retrieval add-on test"
            },
            {
              "id": "lab-report",
              "label": "Riwayat Hasil Kumulatif",
              "status": "ada",
              "ket": "Tren analit longitudinal & riwayat kumulatif pasien"
            }
          ]
        },
        {
          "nama": "Master Data & Konfigurasi",
          "menu": [
            {
              "id": "refrange",
              "label": "Reference Range Matrix",
              "status": "ada",
              "ket": "Nilai rujukan multi-tier per usia, gender, dan metode"
            },
            {
              "id": "product",
              "label": "Katalog Tes & LOINC/UCUM",
              "status": "ada",
              "ket": "Master analit & pemetaan standar LOINC OBX-3 / UCUM OBX-6"
            },
            {
              "id": "package",
              "label": "Panel & Paket Pemeriksaan",
              "status": "ada",
              "ket": "Konfigurasi profil panel organ, hemostasis, dan MCU"
            },
            {
              "id": "inventory",
              "label": "Inventori Reagen & BHP",
              "status": "ada",
              "ket": "Logistik reagen, lot number, expired date & suhu simpan"
            },
            {
              "id": "referral",
              "label": "Rujukan Laboratorium",
              "status": "ada",
              "ket": "Outsource spesimen ke lab rujukan & rekonsiliasi"
            },
            {
              "id": "catalog-export",
              "label": "Ekspor Standar LOINC",
              "status": "ada",
              "ket": "Generator dataset LIS-ready dalam format CSV/TSV"
            },
            {
              "id": "lis-settings",
              "label": "Konfigurasi LIS & Gateway",
              "status": "ada",
              "ket": "Profil instansi, DPJP Sp.PK, critical limits & installer service :9999"
            }
          ]
        }
      ],
      "pendek": "Lab LIS"
    },
    "korporat": {
      "label": "Korporat & MCU",
      "ikon": "building-2",
      "catatan": "Terintegrasi utamanya ke HIS — peserta MCU masuk sebagai pasien klinik.",
      "grup": [
        {
          "nama": "Klien & Proyek",
          "menu": [
            {
              "id": "corporate",
              "label": "Database Klien Korporat",
              "status": "ada",
              "ket": "Perusahaan klien, PIC, dan kontraknya"
            },
            {
              "id": "mcu",
              "label": "Proyek MCU & Roster",
              "status": "ada",
              "ket": "MCU massal, import roster, sertifikat sehat"
            },
            {
              "id": "portal-akses",
              "label": "Akses Portal Korporat",
              "status": "ada",
              "ket": "Tautan bertoken; izin kelola roster per tautan",
              "admin": true
            }
          ]
        },
        {
          "nama": "Komersial B2B",
          "menu": [
            {
              "id": "leads",
              "label": "Prospek Korporat",
              "status": "ada",
              "ket": "Funnel klien perusahaan baru"
            },
            {
              "id": "penawaran",
              "label": "Penawaran Paket MCU",
              "status": "ada",
              "ket": "Quotation resmi sampai terbit PO"
            },
            {
              "id": "mou",
              "label": "MOU & PKS Korporat",
              "status": "ada",
              "ket": "Perjanjian kerja sama dan perpanjangannya"
            },
            {
              "id": "bpjs-claim",
              "label": "Klaim Asuransi & TPA",
              "status": "ada",
              "ket": "Penagihan jaminan korporat"
            }
          ]
        }
      ],
      "pendek": "Korporat"
    },
    "wellness": {
      "label": "Wellness — Nutrition & Care",
      "ikon": "sparkles",
      "catatan": "Penggabungan AVA Nutrition, AVA Care (FMCG), dan Queen Sanctuary. Ketiganya sebelumnya berdiri sebagai subdomain terpisah dengan isi yang sama.",
      "grup": [
        {
          "nama": "Produk & Penjualan",
          "menu": [
            {
              "id": "ecommerce-oms",
              "label": "Pesanan Multi-Channel D2C",
              "status": "ada",
              "ket": "Shopee, TikTok Shop, Tokopedia, web sendiri"
            },
            {
              "id": "ecommerce-oms-apotek",
              "label": "Konsinyasi Apotek Mitra",
              "status": "ada",
              "ket": "Stok titipan di jaringan apotek",
              "rute": "ecommerce-oms",
              "aksi": "navigate('ecommerce-oms',{tab:'apotek'})"
            },
            {
              "id": "ecommerce-oms-batch",
              "label": "Batch & Stok FEFO",
              "status": "ada",
              "ket": "Lot produksi dan peringatan kedaluwarsa",
              "rute": "ecommerce-oms",
              "aksi": "navigate('ecommerce-oms',{tab:'batch'})"
            },
            {
              "id": "ecommerce-oms-shipping",
              "label": "Ekspedisi & Resi",
              "status": "ada",
              "ket": "Ongkir multi-kurir dan cetak label",
              "rute": "ecommerce-oms",
              "aksi": "navigate('ecommerce-oms',{tab:'shipping'})"
            },
            {
              "id": "subscription",
              "label": "Langganan & Auto-Refill",
              "status": "ada",
              "ket": "Pengiriman rutin bulanan member"
            }
          ]
        },
        {
          "nama": "Layanan Wellness",
          "menu": [
            {
              "id": "sanctuary-booking",
              "label": "Reservasi Treatment",
              "status": "ada",
              "ket": "Jadwal sesi terapi dan alokasi terapis"
            },
            {
              "id": "sanctuary-members",
              "label": "Member VIP & Saldo Sesi",
              "status": "ada",
              "ket": "Tier member dan kuota sesi tersisa",
              "rute": "sanctuary-booking",
              "aksi": "navigate('sanctuary-booking',{tab:'members'})"
            },
            {
              "id": "sanctuary-rooms",
              "label": "Okupansi Ruangan",
              "status": "ada",
              "ket": "Status suite dan waktu sanitasi",
              "rute": "sanctuary-booking",
              "aksi": "navigate('sanctuary-booking',{tab:'rooms'})"
            },
            {
              "id": "sanctuary-menu",
              "label": "Katalog Paket Terapi",
              "status": "ada",
              "ket": "Paket pemulihan dan perawatan",
              "rute": "sanctuary-booking",
              "aksi": "navigate('sanctuary-booking',{tab:'menu'})"
            }
          ]
        },
        {
          "nama": "Formulasi & Produksi",
          "menu": [
            {
              "id": "pabrik",
              "label": "Perintah Produksi",
              "status": "ada",
              "ket": "Work order, pemakaian bahan baku, rendemen, dan hasil batch"
            },
            {
              "id": "wellness-rnd",
              "label": "Formulasi & R&D Produk",
              "status": "ada",
              "ket": "Resep berversi + BOM. Versi baru = baris baru, supaya batch lama tetap terlacak resepnya."
            },
            {
              "id": "wellness-maklon",
              "label": "Kemitraan Maklon",
              "status": "ada",
              "ket": "Produksi untuk merek pihak lain. Hasilnya milik klien, tidak masuk stok AVA."
            },
            {
              "id": "wellness-mutu",
              "label": "Uji Mutu Produk ke Lab",
              "status": "ada",
              "ket": "Batch karantina sampai SELURUH uji lulus, bukan uji pertama."
            }
          ]
        }
      ],
      "pendek": "Wellness"
    },
    "keuangan": {
      "label": "Keuangan",
      "ikon": "wallet",
      "grup": [
        {
          "nama": "Kasir",
          "menu": [
            {
              "id": "cashier",
              "label": "Kasir POS Multi-Payment",
              "status": "ada",
              "ket": "Tunai, QRIS, kartu, split bill"
            },
            {
              "id": "cashier-shift",
              "label": "Shift Kasir & Berita Acara",
              "status": "ada",
              "ket": "Buka/tutup shift dengan rekonsiliasi",
              "rute": "cashier",
              "aksi": "navigate('cashier',{buka:'shift'})"
            }
          ]
        },
        {
          "nama": "Piutang & Tagihan",
          "menu": [
            {
              "id": "finance",
              "label": "Invoice & Tagihan",
              "status": "ada",
              "ket": "Faktur resmi dan monitoring pelunasan"
            },
            {
              "id": "ar-aging",
              "label": "Umur Piutang",
              "status": "ada",
              "ket": "Tagihan lewat tempo per kelompok umur"
            },
            {
              "id": "payables",
              "label": "Hutang Usaha",
              "status": "ada",
              "ket": "Jadwal pembayaran supplier"
            }
          ]
        },
        {
          "nama": "Pembukuan",
          "menu": [
            {
              "id": "accounting",
              "label": "Buku Besar & Akuntansi",
              "status": "ada",
              "ket": "Jurnal otomatis terintegrasi COA"
            },
            {
              "id": "finance-report",
              "label": "Laporan Laba Rugi",
              "status": "ada",
              "ket": "Pendapatan, HPP, beban, net margin",
              "rute": "finance",
              "aksi": "navigate('finance',{tab:'report'})"
            },
            {
              "id": "assets",
              "label": "Aset Tetap & Kalibrasi",
              "status": "ada",
              "ket": "Inventaris alat, penyusutan, kalibrasi"
            },
            {
              "id": "payroll",
              "label": "Penggajian",
              "status": "ada",
              "ket": "Gaji, tunjangan, BPJS, PPh 21"
            }
          ]
        }
      ],
      "pendek": "Keuangan"
    },
    "logistik": {
      "label": "Inventori & Logistik",
      "ikon": "box",
      "grup": [
        {
          "nama": "Persediaan",
          "menu": [
            {
              "id": "inventory",
              "label": "Stok Barang",
              "status": "ada",
              "ket": "Saldo stok dan batas minimum"
            },
            {
              "id": "inventory-issue",
              "label": "Pengeluaran Barang",
              "status": "ada",
              "ket": "Bon mutasi ke unit pemakai",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'issue'})"
            },
            {
              "id": "inventory-opname",
              "label": "Stock Opname",
              "status": "ada",
              "ket": "Hitung fisik dan berita acara selisih",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'opname'})"
            },
            {
              "id": "inventory-ledger",
              "label": "Kartu Stok",
              "status": "ada",
              "ket": "Mutasi per lot/batch",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'ledger'})"
            }
          ]
        },
        {
          "nama": "Pengadaan",
          "menu": [
            {
              "id": "inventory-pr",
              "label": "Permintaan Pembelian",
              "status": "ada",
              "ket": "Pengajuan berjenjang",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'pr'})"
            },
            {
              "id": "inventory-po",
              "label": "Pesanan Pembelian",
              "status": "ada",
              "ket": "PO, penerimaan, retur",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'po'})"
            },
            {
              "id": "inventory-supplier",
              "label": "Master Supplier",
              "status": "ada",
              "ket": "Data pemasok dan kategorinya",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'supplier'})"
            },
            {
              "id": "inventory-mrp",
              "label": "Perencanaan MRP",
              "status": "ada",
              "ket": "Reorder point dan rekomendasi beli",
              "rute": "inventory",
              "aksi": "navigate('inventory',{tab:'mrp'})"
            }
          ]
        }
      ],
      "pendek": "Inventori"
    },
    "sdm": {
      "label": "SDM & HRD",
      "ikon": "users",
      "grup": [
        {
          "nama": "Personalia",
          "menu": [
            {
              "id": "hrd",
              "label": "Database Karyawan",
              "status": "ada",
              "ket": "Biodata staf seluruh unit"
            },
            {
              "id": "org-structure",
              "label": "Struktur Organisasi",
              "status": "ada",
              "ket": "Bagan hierarki departemen"
            }
          ]
        },
        {
          "nama": "Kehadiran",
          "menu": [
            {
              "id": "work-schedule",
              "label": "Jadwal Kerja & Roster",
              "status": "ada",
              "ket": "Shift jaga dan jadwal fleksibel"
            },
            {
              "id": "shift-calendar",
              "label": "Kalender Shift",
              "status": "ada",
              "ket": "Kalender bulanan staf bertugas"
            },
            {
              "id": "attendance",
              "label": "Presensi GPS",
              "status": "ada",
              "ket": "Log kehadiran dengan validasi lokasi"
            }
          ]
        },
        {
          "nama": "Produktivitas",
          "menu": [
            {
              "id": "tasks",
              "label": "Manajemen Tugas",
              "status": "ada",
              "ket": "Penugasan, tenggat, dan status pekerjaan tim"
            }
          ]
        }
      ],
      "pendek": "SDM"
    },
    "mutu": {
      "label": "Administrasi, Mutu & Legal",
      "ikon": "shield-check",
      "grup": [
        {
          "nama": "Kepatuhan",
          "menu": [
            {
              "id": "keselamatan-ikp",
              "label": "Insiden Keselamatan Pasien",
              "status": "ada",
              "ket": "Pelaporan boleh anonim; grading dihitung, RCA ditegakkan"
            },
            {
              "id": "mutu-indikator",
              "label": "Indikator Mutu",
              "status": "ada",
              "ket": "Capaian per periode; yang di bawah target wajib punya rencana perbaikan"
            },
            {
              "id": "compliance-tracker",
              "label": "Compliance & Legal Tracker",
              "status": "ada",
              "ket": "Izin operasional, SIP, BPOM, Halal"
            },
            {
              "id": "regulatory",
              "label": "Pelaporan & Audit Regulator",
              "status": "ada",
              "ket": "Laporan wajib ke regulator"
            },
            {
              "id": "audit",
              "label": "Jejak Audit",
              "status": "ada",
              "ket": "Log perubahan data sensitif",
              "admin": true
            }
          ]
        },
        {
          "nama": "Dokumen",
          "menu": [
            {
              "id": "wiki",
              "label": "Dokumen Mutu & SOP",
              "status": "ada",
              "ket": "SOP, instruksi kerja, formulir mutu"
            },
            {
              "id": "surat",
              "label": "Surat Keluar & Penomoran",
              "status": "ada",
              "ket": "Korespondensi resmi bernomor"
            },
            {
              "id": "partners",
              "label": "Master Rekanan & Vendor",
              "status": "ada",
              "ket": "Mitra bisnis dan supplier"
            }
          ]
        }
      ],
      "pendek": "Administrasi"
    },
    "agentic": {
      "label": "AI Agentic Suite",
      "ikon": "sparkles",
      "grup": [
        {
          "nama": "Orkestrasi",
          "menu": [
            {
              "id": "agentic",
              "label": "Agentic Orchestrator",
              "status": "ada",
              "ket": "Pusat orkestrasi multi-agent"
            },
            {
              "id": "agentic-apimonitor",
              "label": "Monitor Kuota API",
              "status": "ada",
              "ket": "Sisa kuota dan rotasi kunci",
              "rute": "agentic",
              "aksi": "AIGateway.renderMonitorUI()"
            },
            {
              "id": "agentic-inbox",
              "label": "Approval Inbox",
              "status": "ada",
              "ket": "Mandat R1-R3 yang menunggu persetujuan",
              "rute": "agentic",
              "aksi": "navigate('agentic',{tab:'inbox'})"
            }
          ]
        }
      ],
      "pendek": "AI Agent"
    },
    "konsumen": {
      "label": "Portal Konsumen",
      "ikon": "user",
      "catatan": "Aplikasi terpisah, bukan rel menu internal. Didaftarkan di sini agar pemetaannya terlihat utuh.",
      "grup": [
        {
          "nama": "Portal",
          "menu": [
            {
              "id": "portal-pasien",
              "label": "Portal Pasien Individual",
              "status": "ada",
              "ket": "apps.avahealth.sbs — booking, hasil, telekonsul"
            },
            {
              "id": "portal-korporat",
              "label": "Portal Klien Korporat",
              "status": "ada",
              "ket": "corp.avahealth.sbs — kelola karyawan, requestor & approver"
            },
            {
              "id": "portal-wellness",
              "label": "Portal Wellness",
              "status": "belum",
              "ket": "wellness.avahealth.sbs — nutrition & personal care"
            }
          ]
        }
      ],
      "pendek": "Portal"
    },
    "konfigurasi": {
      "label": "Pengaturan Sistem",
      "ikon": "settings",
      "grup": [
        {
          "nama": "Sistem",
          "menu": [
            {
              "id": "settings",
              "label": "Pusat Pengaturan",
              "status": "ada",
              "ket": "Profil faskes, kop surat, format PDF",
              "admin": true
            },
            {
              "id": "users",
              "label": "Pengguna & Hak Akses",
              "status": "ada",
              "ket": "RBAC per peran dan per halaman",
              "rute": "settings",
              "aksi": "navigate('settings',{tab:'users'})",
              "admin": true
            },
            {
              "id": "import",
              "label": "Impor & Ekspor Data",
              "status": "ada",
              "ket": "Unggah data awal via XLSX/CSV",
              "admin": true
            },
            {
              "id": "family",
              "label": "Registri Keluarga",
              "status": "ada",
              "ket": "Relasi antar pasien satu keluarga"
            }
          ]
        }
      ],
      "pendek": "Pengaturan"
    },
    "marketing": {
      "label": "Marketing, CRM & Growth",
      "pendek": "Marketing",
      "ikon": "megaphone",
      "grup": [
        {
          "nama": "Prospecting",
          "menu": [
            {
              "id": "maps",
              "label": "Maps Prospecting",
              "status": "ada",
              "ket": "Pencarian faskes/apotek calon klien di peta, radius overlay & seleksi massal"
            },
            {
              "id": "leads",
              "label": "Leads & Pipeline CRM",
              "status": "ada",
              "ket": "Prospek masuk, tahap tindak lanjut, dan penanggung jawabnya"
            },
            {
              "id": "crm-pipeline",
              "label": "Papan Pipeline CRM",
              "status": "ada",
              "ket": "Papan kanban tahap penjualan"
            },
            {
              "id": "sales-corong",
              "label": "Corong Penjualan",
              "status": "ada",
              "ket": "Konversi per tahap: inquiry, presentasi, penawaran, closing"
            }
          ]
        },
        {
          "nama": "Kampanye & Promo",
          "menu": [
            {
              "id": "marketing",
              "label": "Pusat Marketing",
              "status": "ada",
              "ket": "Ringkasan kanal, materi promosi, dan aktivitas kampanye"
            },
            {
              "id": "campaigns",
              "label": "Campaign & Voucher",
              "status": "ada",
              "rute": "voucher",
              "aksi": "navigate('voucher')",
              "ket": "Kupon diskon, promo musiman, dan broadcast voucher"
            },
            {
              "id": "penawaran",
              "label": "Penawaran Harga",
              "status": "ada",
              "ket": "Quotation resmi sampai terbit PO"
            }
          ]
        },
        {
          "nama": "Kemitraan & Kinerja",
          "menu": [
            {
              "id": "perujuk",
              "label": "Dokter & Klinik Perujuk",
              "status": "ada",
              "admin": true,
              "ket": "Tarif komisi rujukan dan pencairannya"
            },
            {
              "id": "okr",
              "label": "Target & OKR Tim",
              "status": "ada",
              "ket": "Sasaran kuartal dan capaiannya"
            },
            {
              "id": "mkt-crmtv",
              "label": "Monitor CRM Layar Besar",
              "status": "ada",
              "rute": "leads",
              "aksi": "window.open('monitor/crm.html','_blank')",
              "ket": "Layar target omzet & closing rate harian"
            }
          ]
        }
      ]
    },
    "avahealth": {
      "label": "AVA Health — Telehealth & Trust Layer",
      "pendek": "AVA Health",
      "ikon": "stethoscope",
      "catatan": "KBLI 86910. Modulnya sudah ada dengan tujuh tampilan, tetapi tidak pernah punya satu pun entri menu.",
      "grup": [
        {
          "nama": "Layanan Jarak Jauh",
          "menu": [
            {
              "id": "ava-consult",
              "label": "Telekonsultasi Dokter",
              "status": "ada",
              "ket": "Konsultasi jarak jauh pasien-dokter"
            },
            {
              "id": "ava-caregiver",
              "label": "Caregiver & Pendamping",
              "status": "ada",
              "ket": "Penugasan pendamping perawatan di rumah"
            }
          ]
        },
        {
          "nama": "Perangkat & Kalibrasi",
          "menu": [
            {
              "id": "ava-devices",
              "label": "Alat Medis & Wearables",
              "status": "ada",
              "ket": "Telemetri IoT perangkat pasien"
            },
            {
              "id": "ava-calibration",
              "label": "Badge AVA Verified",
              "status": "ada",
              "ket": "Sertifikasi kalibrasi alat oleh lab"
            },
            {
              "id": "ava-marketplace",
              "label": "Marketplace Alkes",
              "status": "ada",
              "ket": "Katalog alat kesehatan dan portal vendor"
            }
          ]
        },
        {
          "nama": "Kanal & Mitra",
          "menu": [
            {
              "id": "ava-corporate",
              "label": "Kanal Korporat B2B",
              "status": "ada",
              "ket": "Paket telehealth untuk perusahaan"
            },
            {
              "id": "ava-portals",
              "label": "Portal Multi-Peran",
              "status": "ada",
              "ket": "Tampilan admin, pelanggan, dokter, dan vendor"
            }
          ]
        }
      ]
    },
    "radiologi": {
      "label": "Radiologi & Pencitraan",
      "pendek": "Radiologi",
      "ikon": "scan",
      "catatan": "Berdiri sendiri, bukan lagi satu grup di bawah Klinik. Alur radiologi punya rantai kerjanya sendiri: order, modalitas, akuisisi citra, bacaan radiolog, lalu rilis ekspertise.",
      "grup": [
        {
          "nama": "Alur Pemeriksaan",
          "menu": [
            {
              "id": "radiology",
              "label": "Order & Worklist Radiologi",
              "status": "ada",
              "ket": "Permintaan foto dari poli, antrean kerja per modalitas, dan status pengerjaan"
            },
            {
              "id": "pacs-viewer",
              "label": "PACS & DICOM Viewer",
              "status": "ada",
              "ket": "Viewer siap dengan preset windowing & ukur CTR; sumber citra DICOM belum tersambung"
            },
            {
              "id": "rad-unggah",
              "label": "Unggah Citra & Studi",
              "status": "ada",
              "ket": "Unggah manual berkas DICOM/JPEG untuk modalitas yang belum terhubung jaringan"
            },
            {
              "id": "rad-ekspertise",
              "label": "Bacaan & Ekspertise Radiolog",
              "status": "ada",
              "ket": "Lembar bacaan dokter Sp.Rad, tanda tangan elektronik, dan rilis hasil ke pengirim order"
            }
          ]
        },
        {
          "nama": "Master & Alat",
          "menu": [
            {
              "id": "rad-modalitas",
              "label": "Modalitas & Jadwal Alat",
              "status": "ada",
              "ket": "Daftar alat (rontgen, USG, CT), DICOM Modality Worklist, dan jadwal pemakaian"
            },
            {
              "id": "rad-katalog",
              "label": "Katalog Pemeriksaan Radiologi",
              "status": "ada",
              "ket": "Jenis pemeriksaan, persiapan pasien, dosis radiasi, dan tarifnya"
            },
            {
              "id": "assets",
              "label": "Kalibrasi & Perawatan Alat",
              "status": "ada",
              "ket": "Jadwal kalibrasi alat radiologi dan riwayat perawatannya"
            }
          ]
        }
      ]
    },
    "support-medical": {
      "label": "Support Medical — Penunjang Non-Radiologi",
      "pendek": "Support Medical",
      "ikon": "heart",
      "catatan": "Pemeriksaan penunjang di luar laboratorium dan radiologi.",
      "grup": [
        {
          "nama": "Jantung, Paru & Indera",
          "menu": [
            {
              "id": "supportive",
              "label": "EKG, Treadmill, Audiometri & Spirometri",
              "status": "ada",
              "ket": "Satu layar input untuk keempat pemeriksaan, lengkap dengan interpretasi terstruktur"
            },
            {
              "id": "sm-usg",
              "label": "USG Non-Radiologi",
              "status": "ada",
              "ket": "USG yang dikerjakan dokter poli sendiri (obgyn, abdomen) di luar alur radiologi"
            }
          ]
        },
        {
          "nama": "Rehabilitasi & Tindakan",
          "menu": [
            {
              "id": "sm-fisioterapi",
              "label": "Fisioterapi & Rehabilitasi Medik",
              "status": "ada",
              "ket": "Program terapi, jadwal sesi, dan catatan perkembangan pasien"
            },
            {
              "id": "sm-endoskopi",
              "label": "Endoskopi",
              "status": "ada",
              "ket": "Jadwal, persiapan pasien, dan laporan temuan"
            }
          ]
        }
      ]
    }
  }
};

// Kategori yang boleh tampil di sebuah ruang. Ruang dengan lihat_semua
// mendapat seluruh kategori — dipakai Holding HQ.
window.kategoriRuang = function (kunci) {
  const r = window.PETA_MENU.ruang[kunci];
  if (!r) return Object.keys(window.PETA_MENU.kategori);
  if (r.lihat_semua) return Object.keys(window.PETA_MENU.kategori);
  return r.kategori || [];
};
