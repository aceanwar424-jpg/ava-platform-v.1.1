// ═══════════════════════════════════════════════════════════════
// DIBANGKITKAN OTOMATIS dari config/domain.json — jangan disunting tangan.
// Jalankan ulang: node scripts/bangun-vercel.js
//
// Memberi tahu index.html dan portal.html subdomain mana yang sedang
// membukanya, sehingga lingkup menu dan halaman awalnya mengikuti
// pembagian di config/domain.json — bukan menampilkan semuanya.
// ═══════════════════════════════════════════════════════════════
window.PETA_SUBDOMAIN = {
  "avahealth.sbs": {
    "nama": "Web Utama (Company Profile)",
    "sorot": "semua"
  },
  "www.avahealth.sbs": {
    "nama": "Web Utama (Company Profile)",
    "sorot": "semua"
  },
  "avahelath.sbs": {
    "nama": "Web Utama (Company Profile)",
    "sorot": "semua"
  },
  "www.avahelath.sbs": {
    "nama": "Web Utama (Company Profile)",
    "sorot": "semua"
  },
  "web.localhost": {
    "nama": "Web Utama (Company Profile)",
    "sorot": "semua"
  },
  "his.avahealth.sbs": {
    "nama": "Sistem Utama (HIS + RIS + PACS)",
    "workspace": "his",
    "awal": "emr-soap"
  },
  "his.avahelath.sbs": {
    "nama": "Sistem Utama (HIS + RIS + PACS)",
    "workspace": "his",
    "awal": "emr-soap"
  },
  "his.localhost": {
    "nama": "Sistem Utama (HIS + RIS + PACS)",
    "workspace": "his",
    "awal": "emr-soap"
  },
  "lis.avahealth.sbs": {
    "nama": "Sistem Laboratorium (LIS)",
    "workspace": "lis",
    "awal": "lab"
  },
  "lis.avahelath.sbs": {
    "nama": "Sistem Laboratorium (LIS)",
    "workspace": "lis",
    "awal": "lab"
  },
  "lab.avahealth.sbs": {
    "nama": "Sistem Laboratorium (LIS)",
    "workspace": "lis",
    "awal": "lab"
  },
  "lab.avahelath.sbs": {
    "nama": "Sistem Laboratorium (LIS)",
    "workspace": "lis",
    "awal": "lab"
  },
  "lis.localhost": {
    "nama": "Sistem Laboratorium (LIS)",
    "workspace": "lis",
    "awal": "lab"
  },
  "ops.avahealth.sbs": {
    "nama": "Master Holding & CEO Cockpit",
    "workspace": "ops",
    "awal": "dashboard"
  },
  "ops.avahelath.sbs": {
    "nama": "Master Holding & CEO Cockpit",
    "workspace": "ops",
    "awal": "dashboard"
  },
  "ops.localhost": {
    "nama": "Master Holding & CEO Cockpit",
    "workspace": "ops",
    "awal": "dashboard"
  },
  "care.avahealth.sbs": {
    "nama": "AVA Care (Personal Care & Home Care)",
    "workspace": "his",
    "awal": "homecare"
  },
  "care.avahelath.sbs": {
    "nama": "AVA Care (Personal Care & Home Care)",
    "workspace": "his",
    "awal": "homecare"
  },
  "care.localhost": {
    "nama": "AVA Care (Personal Care & Home Care)",
    "workspace": "his",
    "awal": "homecare"
  },
  "nutri.avahealth.sbs": {
    "nama": "AVA Nutrition (Nutraseutikal & Pabrik)",
    "workspace": "wellness",
    "awal": "pabrik"
  },
  "nutri.avahelath.sbs": {
    "nama": "AVA Nutrition (Nutraseutikal & Pabrik)",
    "workspace": "wellness",
    "awal": "pabrik"
  },
  "nutri.localhost": {
    "nama": "AVA Nutrition (Nutraseutikal & Pabrik)",
    "workspace": "wellness",
    "awal": "pabrik"
  },
  "sanctuary.avahealth.sbs": {
    "nama": "AVA Sanctuary (Medical Spa & Estetika)",
    "workspace": "wellness",
    "awal": "sanctuary-booking"
  },
  "sanctuary.avahelath.sbs": {
    "nama": "AVA Sanctuary (Medical Spa & Estetika)",
    "workspace": "wellness",
    "awal": "sanctuary-booking"
  },
  "sanctuary.localhost": {
    "nama": "AVA Sanctuary (Medical Spa & Estetika)",
    "workspace": "wellness",
    "awal": "sanctuary-booking"
  },
  "tech.avahealth.sbs": {
    "nama": "AVA Tech (Pembangun & Penjual Sistem)",
    "workspace": "tech",
    "awal": "saas-console"
  },
  "tech.avahelath.sbs": {
    "nama": "AVA Tech (Pembangun & Penjual Sistem)",
    "workspace": "tech",
    "awal": "saas-console"
  },
  "tech.localhost": {
    "nama": "AVA Tech (Pembangun & Penjual Sistem)",
    "workspace": "tech",
    "awal": "saas-console"
  },
  "console.avahealth.sbs": {
    "nama": "AVA Tech Console (Lisensi & Telemetri)",
    "workspace": "tech",
    "awal": "lisensi"
  },
  "console.avahelath.sbs": {
    "nama": "AVA Tech Console (Lisensi & Telemetri)",
    "workspace": "tech",
    "awal": "lisensi"
  },
  "console.localhost": {
    "nama": "AVA Tech Console (Lisensi & Telemetri)",
    "workspace": "tech",
    "awal": "lisensi"
  },
  "corp.avahealth.sbs": {
    "nama": "Portal Klien Korporat (Login PIC)",
    "peran": "corporate"
  },
  "corp.avahelath.sbs": {
    "nama": "Portal Klien Korporat (Login PIC)",
    "peran": "corporate"
  },
  "korporat.avahealth.sbs": {
    "nama": "Portal Klien Korporat (Login PIC)",
    "peran": "corporate"
  },
  "korporat.avahelath.sbs": {
    "nama": "Portal Klien Korporat (Login PIC)",
    "peran": "corporate"
  },
  "corp.localhost": {
    "nama": "Portal Klien Korporat (Login PIC)",
    "peran": "corporate"
  },
  "wellness.avahealth.sbs": {
    "nama": "Wellness (Nutrition & Personal Care)",
    "workspace": "wellness",
    "awal": "ecommerce-oms"
  },
  "wellness.avahelath.sbs": {
    "nama": "Wellness (Nutrition & Personal Care)",
    "workspace": "wellness",
    "awal": "ecommerce-oms"
  },
  "wellness.localhost": {
    "nama": "Wellness (Nutrition & Personal Care)",
    "workspace": "wellness",
    "awal": "ecommerce-oms"
  }
};

// Mengembalikan { nama, workspace, awal, sorot, peran } untuk host ini, atau
// null bila host-nya tidak terdaftar (mis. dibuka lewat 127.0.0.1 langsung).
window.situsSaatIni = function () {
  const h = String(location.hostname || '').toLowerCase();
  return window.PETA_SUBDOMAIN[h] || null;
};
