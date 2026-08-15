// ═══════════════════════════════════════════════════════════════
// CORE: Icon Set — SVG garis monokrom, menggantikan emoji di menu
// Semua ikon mewarisi warna teks (currentColor) sehingga ikut
// berubah saat item aktif, hover, atau dinonaktifkan.
// Pakai: icon('box')  ·  icon('box', 20)
// ═══════════════════════════════════════════════════════════════

const ICON_PATHS = {
  // — Umum & navigasi —
  home:        '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/>',
  'home-heart':'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M12 18s-2.6-1.7-2.6-3.4a1.5 1.5 0 0 1 2.6-.9 1.5 1.5 0 0 1 2.6.9C14.6 16.3 12 18 12 18Z"/>',
  settings:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',

  // — Orang & organisasi —
  users:       '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  'users-round':'<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1.5A4.5 4.5 0 0 1 6.5 15h5a4.5 4.5 0 0 1 4.5 4.5V21"/><path d="M18 21v-1a3 3 0 0 1 3-3"/>',
  user:        '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  'user-square':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19a5.5 5.5 0 0 1 11 0"/>',
  sitemap:     '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 7v4M5 16v-2h14v2"/><path d="M12 11v3"/>',
  briefcase:   '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M2 12h20"/>',

  // — Lab & klinik —
  flask:       '<path d="M9 3h6"/><path d="M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7.5 15h9"/>',
  microscope:  '<path d="M6 21h12"/><path d="M9 21v-3"/><path d="M13 5.5 9.5 9 8 7.5 11.5 4a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3l-3 3-2-2"/><path d="M7 18a6 6 0 0 0 9-5"/>',
  stethoscope: '<path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M5 3H3.5M13 3h1.5"/><path d="M9 12v3a5 5 0 0 0 5 5 4 4 0 0 0 4-4v-2"/><circle cx="18" cy="12" r="2"/>',
  avahealth:   '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  scan:        '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
  heart:       '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5c0 5-7 9.5-7 9.5Z"/>',
  hospital:    '<path d="M3 21h18"/><path d="M5 21V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15"/><path d="M12 8v5M9.5 10.5h5"/><path d="M10 21v-4h4v4"/>',
  building:    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/><path d="M10 21v-3h4v3"/>',
  'building-2':'<path d="M3 21h18"/><path d="M5 21V8l6-4v17"/><path d="M11 21V11l8 3v7"/><path d="M8 11h.01M8 15h.01M15 15h.01M15 18h.01"/>',
  landmark:    '<path d="M3 21h18"/><path d="M4 10h16"/><path d="M12 3 3 8h18Z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  dna:         '<path d="M5 3c0 6 14 6 14 12M5 21c0-6 14-6 14-12"/><path d="M7 5h10M7 19h10M9 9h6M9 15h6"/>',
  sliders:     '<path d="M4 20V13M4 9V4M12 20v-8M12 8V4M20 20v-4M20 12V4"/><path d="M2 13h4M10 8h4M18 16h4"/>',

  // — Dokumen & Administrasi —
  administration: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  'file-check':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
  scroll:      '<path d="M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6"/><path d="M4 6a2 2 0 0 1 4 0v2H4Z"/><path d="M9 9h7M9 13h7M9 17h4"/>',
  folder:      '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  folders:     '<path d="M2 6a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v1"/><path d="M6 10a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/>',
  clipboard:   '<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="9" y="2" width="6" height="4" rx="1"/>',
  'clipboard-check':'<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  'check-square':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
  'book-open':  '<path d="M12 6.5C10.5 5 8.5 4.5 4 4.5V19c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2V4.5c-4.5 0-6.5.5-8 2Z"/><path d="M12 6.5V21"/>',
  receipt:     '<path d="M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  printer:     '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 15h12v6H6Z"/>',
  edit:        '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  'pen-tool':  '<path d="m12 3 8 8-7 9-7-3Z"/><path d="m12 3-1 6 4 2Z"/><path d="M6 17 3 20"/>',
  image:       '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 5 4"/>',

  // — Status & aksi —
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  'shield-check':'<path d="M12 3 5 6v6c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  inbox:       '<path d="M3 12h5l1.5 3h5L16 12h5"/><path d="M4.5 6h15l1.5 6v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/>',
  upload:      '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>',
  download:    '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>',
  refresh:     '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  trash:       '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  wrench:      '<path d="M15 6a4 4 0 0 0 5.2 5.2L11 20.4a2.5 2.5 0 0 1-3.5-3.5L16.8 7.6A4 4 0 0 0 15 6Z"/><path d="m15 6 3-3 3 3-3 3"/>',
  clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  calendar:    '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  'calendar-off':'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><path d="m10 14 4 4M14 14l-4 4"/>',
  sparkles:    '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M18 16.5 18.8 19l2.2.8-2.2.8L18 23l-.8-2.4-2.2-.8 2.2-.8Z"/>',
  gauge:       '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-4"/><circle cx="12" cy="15" r="1.5"/>',
  target:      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  megaphone:   '<path d="M4 10v4a1 1 0 0 0 1 1h3l7 4V5L8 9H5a1 1 0 0 0-1 1Z"/><path d="M18.5 9a4 4 0 0 1 0 6"/>',
  map:         '<path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6Z"/><path d="M9 4v14M15 6v14"/>',
  trophy:      '<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M10 14h4l.5 4h-5Z"/><path d="M8 21h8"/>',
  palette:     '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-1.7 1.4-2.2 2.7-2.2H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/>',
  list:        '<path d="M8 6h13M8 12h13M8 18h9"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  layers:      '<path d="m12 3 9 4.5-9 4.5-9-4.5Z"/><path d="m3 12.5 9 4.5 9-4.5"/><path d="m3 17 9 4.5 9-4.5"/>',
  tag:         '<path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9Z"/><circle cx="7.5" cy="7.5" r="1.3"/>',

  // — Keuangan —
  wallet:      '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2"/><path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5"/><circle cx="16.5" cy="13.5" r="1.3"/>',
  banknote:    '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  'credit-card':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',

  // — Logistik —
  box:         '<path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'box-out':   '<path d="M21 12v4a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l3 1.7"/><path d="M12 22V12 3.3"/><path d="M17 10V4M14.5 6.5 17 4l2.5 2.5"/>',
  cart:        '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h2.5l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H5.2"/>',
  factory:     '<path d="M3 21h18"/><path d="M4 21V10l6 4V10l6 4V7h4v14"/><path d="M7.5 17h.01M13.5 17h.01"/>',
  truck:       '<path d="M3 6h10v10H3Z"/><path d="M13 9h4l3 3v4h-7Z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',

  // — Rawat inap & farmasi —
  bed:         '<path d="M3 20V8"/><path d="M3 12h15a3 3 0 0 1 3 3v5"/><path d="M3 16h18"/><circle cx="7.5" cy="9.5" r="1.8"/>',
  pill:        '<path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  syringe:     '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 9 19a2 2 0 0 1-3 0l-1-1a2 2 0 0 1 0-3L15 5Z"/><path d="m9 11 2 2M12 8l2 2M6 14l2 2"/><path d="m5 15-3 3 2 2 3-3"/>',
  activity:    '<path d="M3 12h4l3 8 4-16 3 8h4"/>',

  // — Analitik —
  kanban:      '<rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="9" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
  funnel:      '<path d="M3 4h18l-7 8v7l-4 2v-9Z"/>',
  'bar-chart': '<path d="M3 21h18"/><path d="M6 21V11M11 21V4M16 21v-6"/>',
  'line-chart':'<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>',
  'trending-up':'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
};

// Bentuk <svg> lengkap; ukuran & warna mengikuti konteks pemakaian.
function icon(name, size) {
  const p = ICON_PATHS[name];
  const s = size || 18;
  if (!p) return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

if (typeof window !== 'undefined') { window.icon = icon; window.ICON_PATHS = ICON_PATHS; }
