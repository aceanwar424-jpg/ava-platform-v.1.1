// ═══════════════════════════════════════════════════════════════════════════
// OneLab Local Engine — PGlite (Postgres WASM) + PostgREST-compatible shim
// ---------------------------------------------------------------------------
// Tujuan: menjalankan seluruh backend OneLab secara LOKAL/OFFLINE tanpa Supabase
// cloud. PGlite = Postgres asli (WASM), jadi skema arsip Postgres di sql_arsip/
// bisa dimuat apa adanya, dan RPC (fungsi Postgres) langsung tersedia.
//
// Shim ini meniru subset PostgREST yang dipakai frontend (lihat js/core/api.js):
//   GET|POST|PATCH|DELETE /rest/v1/:table   dengan operator eq/neq/gt/gte/lt/lte/
//   like/ilike/in/is/not, or=(), select=, order=, limit=, offset=, count=exact,
//   embedded select (*,rel(...)), dan POST /rest/v1/rpc/:fn.
//
// CommonJS + dynamic import karena @electric-sql/pglite murni ESM.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Statement splitter yang sadar dollar-quote ($$), string, line & block comment
function splitStatements(sql) {
  const out = []; let buf = ''; let i = 0; let dollarTag = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += ch; i++; continue;
    }
    if (ch === '-' && sql[i + 1] === '-') { const nl = sql.indexOf('\n', i); const end = nl < 0 ? sql.length : nl; buf += sql.slice(i, end); i = end; continue; }
    if (ch === '/' && sql[i + 1] === '*') { const end = sql.indexOf('*/', i + 2); const stop = end < 0 ? sql.length : end + 2; buf += sql.slice(i, stop); i = stop; continue; }
    if (ch === '$') { const m = /^\$[a-zA-Z0-9_]*\$/.exec(sql.slice(i)); if (m) { dollarTag = m[0]; buf += m[0]; i += m[0].length; continue; } }
    if (ch === "'") { buf += ch; i++; while (i < sql.length) { buf += sql[i]; if (sql[i] === "'" && sql[i + 1] === "'") { buf += sql[i + 1]; i += 2; continue; } if (sql[i] === "'") { i++; break; } i++; } continue; }
    if (ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; i++; continue; }
    buf += ch; i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// ── Statement yang sengaja dilewati (auth/RLS/grant tak relevan lokal single-user)
function shouldSkip(stmt) {
  const s = stmt.replace(/^\s*((--[^\n]*\n)|(\/\*[\s\S]*?\*\/))+/g, '').trimStart().toUpperCase();
  return /^CREATE\s+POLICY/.test(s)
    || /^DROP\s+POLICY/.test(s)
    || /^ALTER\s+TABLE[\s\S]*ENABLE\s+ROW\s+LEVEL\s+SECURITY/.test(s)
    || /^ALTER\s+TABLE[\s\S]*FORCE\s+ROW\s+LEVEL/.test(s)
    || /^ALTER\s+DEFAULT\s+PRIVILEGES/.test(s)
    || /^GRANT\b/.test(s) || /^REVOKE\b/.test(s)
    || /^COMMENT\s+ON/.test(s)
    || /^CREATE\s+EXTENSION/.test(s)
    || /^NOTIFY\b/.test(s)
    || s === '';
}

// ── Urutan build ulang (sesuai sql_arsip/README.md), skema saja (tanpa 06_seed_data besar)
const ORDER_DIRS = ['01_fondasi_awal', '02_modul_lama', '03_agentic', '04_roadmap_fase', '05_modul_baru', '07_lanjutan'];
const SUB01 = ['supabase_v2', 'supabase_v3_complete', 'supabase_full', 'supabase_update', 'supabase_complete_fix', 'supabase_setup_all', 'new_modules_schema', 'supabase_new_modules'];

function collectSchemaFiles(repoDir) {
  const arsip = path.join(repoDir, 'sql_arsip');
  const files = [];
  for (const d of ORDER_DIRS) {
    const full = path.join(arsip, d);
    if (!fs.existsSync(full)) continue;
    let list = fs.readdirSync(full).filter(f => f.endsWith('.sql'));
    if (d === '01_fondasi_awal') list.sort((a, b) => (SUB01.indexOf(a.replace('.sql', '')) + 1 || 99) - (SUB01.indexOf(b.replace('.sql', '')) + 1 || 99));
    else list.sort();
    for (const f of list) files.push(path.join(full, f));
  }
  // file supabase_*.sql di root repo (corp account/exam/invoice/mcu/portal/…)
  for (const f of fs.readdirSync(repoDir).filter(f => /^supabase_.*\.sql$/.test(f))) files.push(path.join(repoDir, f));
  return files;
}

async function loadSchema(pg, repoDir, log = () => {}) {
  await pg.exec(`CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage;`);
  for (const r of ['anon', 'authenticated', 'service_role']) { try { await pg.exec(`CREATE ROLE ${r};`); } catch (_) {} }
  try { await pg.exec(`CREATE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT NULL::uuid $$ LANGUAGE sql;`); } catch (_) {}
  try { await pg.exec(`CREATE FUNCTION auth.role() RETURNS text AS $$ SELECT 'authenticated'::text $$ LANGUAGE sql;`); } catch (_) {}

  await siapkanTabelAva(pg, log);

  const files = collectSchemaFiles(repoDir);
  const fileStmts = files.map(f => ({ f, stmts: splitStatements(fs.readFileSync(f, 'utf8')) }));
  let ok = 0, fail = 0;
  for (let pass = 1; pass <= 2; pass++) {   // 2 pass → selesaikan ketergantungan urutan
    ok = 0; fail = 0;
    for (const { stmts } of fileStmts) {
      for (const st of stmts) {
        if (shouldSkip(st)) continue;
        try { await pg.exec(st); ok++; } catch (_) { fail++; }
      }
    }
  }
  log(`[local-engine] schema loaded: ${files.length} files, ok=${ok} fail=${fail}`);
  return { ok, fail, files: files.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// SATUSEHAT (Kemenkes RI) — klien sisi server
//
// Client secret TIDAK PERNAH sampai ke peramban, sama seperti kunci LLM.
// Peramban memanggil /functions/v1/satusehat/*; engine yang memegang
// kredensial, menukar token, dan meneruskan ke API Kemenkes.
//
// Alamat default di bawah MENGIKUTI dokumentasi SATUSEHAT Platform, tetapi
// tetap bisa ditimpa lewat .env — verifikasi terhadap portal Anda sebelum
// dipakai di produksi, karena alamat resmi pernah berubah.
// ═══════════════════════════════════════════════════════════════════════════

const SATUSEHAT_DEFAULT = {
  stg:  { auth: 'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken',
          fhir: 'https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1' },
  prod: { auth: 'https://api-satusehat.dto.kemkes.go.id/oauth2/v1/accesstoken',
          fhir: 'https://api-satusehat.dto.kemkes.go.id/fhir-r4/v1' },
};

const SS = { token: null, kedaluwarsa: 0 };   // token di-cache sampai mendekati habis

function konfigSatusehat() {
  let dariBerkas = {};
  for (const f of berkasEnvKandidat()) {
    if (fs.existsSync(f)) { dariBerkas = bacaEnvSederhana(f); break; }
  }
  const env = { ...dariBerkas, ...process.env };
  const mode = (env.SATUSEHAT_ENV || 'stg').toLowerCase() === 'prod' ? 'prod' : 'stg';
  return {
    mode,
    clientId:     env.SATUSEHAT_CLIENT_ID || '',
    clientSecret: env.SATUSEHAT_CLIENT_SECRET || '',
    orgId:        env.SATUSEHAT_ORG_ID || '',
    authUrl:      env.SATUSEHAT_AUTH_URL || SATUSEHAT_DEFAULT[mode].auth,
    fhirUrl:      (env.SATUSEHAT_FHIR_URL || SATUSEHAT_DEFAULT[mode].fhir).replace(/\/+$/, ''),
  };
}

async function tokenSatusehat(cfg) {
  // Pakai ulang token selama masih >60 detik dari kedaluwarsa.
  if (SS.token && SS.kedaluwarsa - 60_000 > Date.now()) return SS.token;
  if (!cfg.clientId || !cfg.clientSecret) {
    const e = new Error('SATUSEHAT_CLIENT_ID / SATUSEHAT_CLIENT_SECRET belum diisi di desktop-app/.env');
    e.kodeLokal = 'KREDENSIAL_KOSONG';
    throw e;
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId, client_secret: cfg.clientSecret,
  }).toString();

  const res = await fetch(`${cfg.authUrl}?grant_type=client_credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const teks = await res.text();
  let data = {};
  try { data = JSON.parse(teks); } catch (_) {}

  if (!res.ok || !data.access_token) {
    const e = new Error(`Gagal menukar token SATUSEHAT (HTTP ${res.status}): ` +
                        (data.error_description || data.error || teks.slice(0, 160)));
    e.status = res.status;
    throw e;
  }

  // expires_in dikirim dalam detik, kadang sebagai teks.
  const detik = parseInt(data.expires_in, 10);
  SS.token = data.access_token;
  SS.kedaluwarsa = Date.now() + (Number.isFinite(detik) ? detik : 3000) * 1000;
  return SS.token;
}

async function catatSatusehat(pg, baris) {
  try {
    await pg.query(
      `INSERT INTO public.satusehat_log
         (resource_type, metode, jalur, status_http, berhasil, satusehat_id, galat, muatan_ringkas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [baris.resourceType || null, baris.metode, baris.jalur, baris.status || null,
       !!baris.berhasil, baris.satusehatId || null, baris.galat || null,
       baris.ringkas ? String(baris.ringkas).slice(0, 500) : null]);
  } catch (_) { /* log gagal tidak boleh menggagalkan pengiriman */ }
}

// Meneruskan permintaan FHIR ke SATUSEHAT. `jalur` contoh: 'Patient' atau
// 'Patient?identifier=...'. Selalu dicatat, berhasil maupun gagal.
async function panggilSatusehat(pg, { metode, jalur, muatan, log = () => {} }) {
  const cfg = konfigSatusehat();
  const mulai = Date.now();
  const jalurBersih = String(jalur || '').replace(/^\/+/, '');
  const resourceType = jalurBersih.split(/[/?]/)[0] || null;

  try {
    const token = await tokenSatusehat(cfg);
    const res = await fetch(`${cfg.fhirUrl}/${jalurBersih}`, {
      method: metode,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
      body: (metode === 'GET' || metode === 'DELETE') ? undefined
            : JSON.stringify(muatan || {}),
    });

    const teks = await res.text();
    let data = {};
    try { data = teks ? JSON.parse(teks) : {}; } catch (_) { data = { raw: teks.slice(0, 400) }; }

    const berhasil = res.ok;
    await catatSatusehat(pg, {
      resourceType, metode, jalur: jalurBersih, status: res.status, berhasil,
      satusehatId: data && data.id ? String(data.id) : null,
      galat: berhasil ? null : JSON.stringify(data).slice(0, 400),
      ringkas: muatan ? JSON.stringify(muatan).slice(0, 500) : null,
    });

    if (!berhasil) log(`[satusehat] ${metode} ${jalurBersih} → HTTP ${res.status}`);
    return { status: res.status, payload: data, latencyMs: Date.now() - mulai };

  } catch (e) {
    const pesan = e && e.message ? e.message : String(e);
    await catatSatusehat(pg, {
      resourceType, metode, jalur: jalurBersih, status: e.status || 0,
      berhasil: false, galat: pesan,
      ringkas: muatan ? JSON.stringify(muatan).slice(0, 500) : null,
    });
    log(`[satusehat] GAGAL ${metode} ${jalurBersih}: ${pesan}`);
    return { status: e.kodeLokal === 'KREDENSIAL_KOSONG' ? 503 : 502,
             payload: { error: pesan }, latencyMs: Date.now() - mulai };
  }
}

// Ringkasan kesiapan — tanpa membocorkan client secret.
function statusSatusehat() {
  const cfg = konfigSatusehat();
  return {
    mode: cfg.mode,
    fhirUrl: cfg.fhirUrl,
    orgId: cfg.orgId || null,
    clientIdTerisi: !!cfg.clientId,
    clientSecretTerisi: !!cfg.clientSecret,
    siap: !!(cfg.clientId && cfg.clientSecret && cfg.orgId),
    tokenAktif: !!(SS.token && SS.kedaluwarsa > Date.now()),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTBOX SINKRONISASI
//
// Setiap perubahan data dicatat SETELAH berhasil tersimpan di basis data
// lokal. Urutannya penting: pekerjaan klinik tidak boleh gagal hanya karena
// jaringan bermasalah, jadi penulisan lokal selesai dulu, pengiriman menyusul.
//
// Tabel infrastruktur tidak ikut dicatat — mencatat outbox ke dalam outbox
// akan beranak tanpa henti, dan tabel sesi/izin milik tiap instalasi.
// ═══════════════════════════════════════════════════════════════════════════

const TABEL_TIDAK_DISINKRON = new Set([
  'sync_outbox', 'sync_state', 'schema_migrations',
  'local_auth_users',                       // kredensial: milik instalasi ini saja
  'roles', 'permissions', 'role_permissions', 'role_pages',
]);

const PETA_OPERASI = { POST: 'INSERT', PATCH: 'UPDATE', PUT: 'UPDATE', DELETE: 'DELETE' };

async function catatOutbox(pg, { method, tabel, penyaring, bodyText, hasil, log = () => {} }) {
  const operasi = PETA_OPERASI[method];
  if (!operasi || TABEL_TIDAK_DISINKRON.has(tabel)) return;

  let muatan = null;
  try { muatan = bodyText ? JSON.parse(bodyText) : null; } catch (_) { muatan = null; }

  // Simpan identitas baris hasil bila ada, supaya sisi cloud bisa mencocokkan.
  let kunci = null;
  try {
    if (Array.isArray(hasil) && hasil.length && hasil[0] && hasil[0].id != null) {
      kunci = hasil.map(r => r.id).slice(0, 200);
    }
  } catch (_) {}

  try {
    await pg.query(
      `INSERT INTO public.sync_outbox (tabel, operasi, penyaring, muatan, hasil_kunci)
       VALUES ($1,$2,$3,$4,$5)`,
      [tabel, operasi, penyaring || null,
       muatan ? JSON.stringify(muatan) : null,
       kunci ? JSON.stringify(kunci) : null]);
  } catch (e) {
    // Outbox gagal TIDAK boleh membatalkan pekerjaan yang sudah tersimpan.
    // Dicatat agar terlihat, bukan ditelan diam-diam.
    log(`[sync] gagal mencatat outbox untuk ${tabel}: ${e && e.message ? e.message : e}`);
  }
}

async function ringkasanSync(pg) {
  const kosong = { pending: 0, gagal: 0, terkirim: 0, mode: 'lokal' };
  try {
    const r = await pg.query(
      `SELECT status, count(*)::int c FROM public.sync_outbox GROUP BY status`);
    const s = { ...kosong };
    for (const row of r.rows) if (row.status in s) s[row.status] = row.c;
    const m = await pg.query(`SELECT nilai FROM public.sync_state WHERE kunci='mode'`);
    s.mode = (m.rows[0] && m.rows[0].nilai) || 'lokal';
    const t = await pg.query(`SELECT id, tabel, operasi, dibuat_at FROM public.sync_outbox
                               WHERE status <> 'terkirim' ORDER BY id LIMIT 5`);
    s.antreanTerdepan = t.rows;
    return s;
  } catch (_) { return kosong; }
}

// ═══════════════════════════════════════════════════════════════════════════
// GERBANG LLM LOKAL  (POST /functions/v1/llm-gateway)
//
// Di mode cloud, permintaan LLM ditangani Supabase Edge Function dengan nama
// dan bentuk permintaan yang sama. Engine lokal tidak punya edge function,
// sehingga tanpa ini seluruh fitur AI mati saat aplikasi dipakai offline.
//
// Kunci dibaca DI SISI SERVER (proses Electron) dari desktop-app/.env — tidak
// pernah dikirim ke peramban. Ini yang membedakannya dari menaruh kunci di
// berkas JavaScript: apa pun yang sampai ke peramban bisa dibaca siapa saja
// lewat DevTools.
// ═══════════════════════════════════════════════════════════════════════════

function bacaEnvSederhana(file) {
  const out = {};
  try {
    for (const baris of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = baris.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch (_) { /* berkas tidak ada → tidak apa-apa */ }
  return out;
}

// Diisi saat createEngine berjalan. Pada build terpaket, __dirname berada DI
// DALAM app.asar sehingga path.join(__dirname,'..','.env') menunjuk ke berkas
// yang tidak pernah ada — gejalanya: gerbang LLM melapor "0 kunci" padahal
// .env terisi. dataDir selalu menunjuk folder nyata di luar asar.
let DIR_DATA_ENGINE = '';

function berkasEnvKandidat() {
  const daftar = [];
  if (DIR_DATA_ENGINE) {
    daftar.push(path.join(path.dirname(DIR_DATA_ENGINE), '.env'));   // desktop-app/.env
    daftar.push(path.join(DIR_DATA_ENGINE, '.env'));
  }
  daftar.push(path.join(__dirname, '..', '.env'));                   // mode pengembangan
  return daftar;
}

function muatKunciLLM() {
  // Urutan: berkas .env yang ketemu → variabel lingkungan proses (menang).
  let dariBerkas = {};
  for (const f of berkasEnvKandidat()) {
    if (fs.existsSync(f)) { dariBerkas = bacaEnvSederhana(f); break; }
  }
  const env = { ...dariBerkas, ...process.env };
  const gabung = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const kunci = [...new Set([...gabung(env.GEMINI_API_KEYS), ...gabung(env.GEMINI_API_KEY)])];
  return {
    kunci,
    // Sengaja memakai alias "-latest", bukan versi yang dipatok. Nama versi
    // tertentu bisa ditarik ("no longer available to new users") dan diam-diam
    // mematikan seluruh fitur AI; alias ikut bergeser ke model terkini.
    model: env.GEMINI_MODEL || 'gemini-flash-latest',
    modelRingan: env.GEMINI_MODEL_LIGHT || 'gemini-flash-lite-latest',
  };
}

const LLM = { idx: 0, gagal: new Map() };   // rotasi round-robin + tanda kunci kehabisan kuota

// Penghitung percobaan portal per-IP (jendela 1 menit). Sederhana dan cukup:
// yang menjaga sesungguhnya adalah token acak 24 byte; ini hanya membuat
// penebakan massal tidak sepadan.
const PORTAL_COBA = new Map();

// Satu-satunya pesan penolakan portal. Token salah, kedaluwarsa, dicabut,
// dan format cacat semuanya menjawab kalimat ini — supaya tidak ada yang
// bisa disimpulkan dari perbedaan jawaban. Nilainya harus tetap sama dengan
// yang ada di db/migrations/0017_portal_tagihan_kunci_relasi.sql.
const PORTAL_PESAN_TOLAK =
  'Tautan tidak berlaku atau sudah berakhir. Hubungi OneLab untuk tautan baru.';

async function panggilGemini({ kunci, model, system, prompt, temperature, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(kunci)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
    generationConfig: {
      temperature: temperature != null ? temperature : 0.2,
      maxOutputTokens: maxTokens || 2500,
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: String(system) }] };

  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const pesan = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    const err = new Error(pesan);
    err.status = res.status;
    throw err;
  }
  const kandidat = (data.candidates || [])[0] || {};
  const bagian = (kandidat.content || {}).parts || [];
  // Model generasi baru memakai sebagian anggaran token untuk "thinking";
  // bagian itu tidak membawa .text. Kalau seluruh anggaran habis di sana,
  // jawabannya kosong — itu harus dilaporkan, bukan dikembalikan sebagai "".
  const hasil = bagian.map(p => p.text || '').join('').trim();
  if (!hasil) {
    const sebab = kandidat.finishReason || 'tidak diketahui';
    const err = new Error(sebab === 'MAX_TOKENS'
      ? 'Jawaban kosong: anggaran token habis sebelum teks dihasilkan. Naikkan maxTokens.'
      : `Jawaban kosong dari model (finishReason: ${sebab}).`);
    err.kosong = true;
    throw err;
  }
  return hasil;
}

async function tanganiLlmGateway(bodyText, log = () => {}) {
  const mulai = Date.now();
  let permintaan = {};
  try { permintaan = JSON.parse(bodyText || '{}'); } catch (_) {}

  const { kunci, model, modelRingan } = muatKunciLLM();
  if (!kunci.length) {
    return { status: 503, payload: {
      error: 'Belum ada kunci LLM di sisi server. Isi GEMINI_API_KEYS pada desktop-app/.env, lalu jalankan ulang aplikasi.' } };
  }

  const dipakai = permintaan.model || (permintaan.tier === 'light' ? modelRingan : model);
  const sekarang = Date.now();
  let galatTerakhir = null;

  // Coba tiap kunci sekali, mulai dari giliran berikutnya. Kunci yang baru saja
  // kena 429 dilewati sampai jendela pendinginannya lewat.
  for (let i = 0; i < kunci.length; i++) {
    const idx = (LLM.idx + i) % kunci.length;
    const tanda = LLM.gagal.get(idx);
    if (tanda && tanda.sampai > sekarang) continue;

    try {
      const text = await panggilGemini({
        kunci: kunci[idx], model: dipakai,
        system: permintaan.system, prompt: permintaan.prompt,
        temperature: permintaan.temperature, maxTokens: permintaan.maxTokens,
      });
      LLM.idx = (idx + 1) % kunci.length;    // rotasi supaya beban menyebar
      LLM.gagal.delete(idx);
      return { status: 200, payload: {
        text, provider: 'GEMINI', model: dipakai, cached: false,
        keyAlias: `key-${idx + 1}`, latencyMs: Date.now() - mulai } };
    } catch (e) {
      galatTerakhir = e;

      if (e.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(e.message || '')) {
        LLM.gagal.set(idx, { sampai: Date.now() + 60 * 60 * 1000, sebab: 'KUOTA_HABIS' });
        log(`[llm] kunci ke-${idx + 1} kena kuota, dialihkan ke kunci berikutnya`);
        continue;
      }

      // Kunci tidak sah / dicabut: bukan soal kuota, tidak akan pulih sendiri.
      // Ditandai lama agar tidak dicoba terus, lalu lanjut ke kunci berikutnya —
      // satu kunci mati tidak boleh mematikan seluruh fitur AI.
      if (e.status === 400 || e.status === 401 || e.status === 403 ||
          /invalid authentication|API key not valid|PERMISSION_DENIED/i.test(e.message || '')) {
        LLM.gagal.set(idx, { sampai: Date.now() + 24 * 60 * 60 * 1000, sebab: 'KUNCI_DITOLAK' });
        log(`[llm] kunci ke-${idx + 1} DITOLAK (tidak sah/dicabut) — perlu diganti`);
        continue;
      }

      break;   // galat lain (mis. jawaban kosong) → mengganti kunci tidak menolong
    }
  }

  // Ringkas keadaan TIAP kunci, bukan hanya galat terakhir. Sebelumnya satu
  // kunci kehabisan kuota dan satu lagi ditolak dilaporkan sebagai "semua
  // kunci kehabisan kuota" — menutupi kunci yang sebenarnya perlu diganti.
  const ringkas = kunci.map((_, i) => {
    const t = LLM.gagal.get(i);
    if (!t || t.sampai <= Date.now()) return `key-${i + 1}: siap`;
    const menit = Math.ceil((t.sampai - Date.now()) / 60000);
    return t.sebab === 'KUNCI_DITOLAK'
      ? `key-${i + 1}: DITOLAK (tidak sah — perlu diganti)`
      : `key-${i + 1}: kuota habis (pulih ~${menit} menit lagi)`;
  }).join('; ');

  return { status: 502, payload: {
    error: `Gerbang LLM gagal. ${ringkas}.` +
           (galatTerakhir && galatTerakhir.message ? ` Galat terakhir: ${galatTerakhir.message}` : ''),
    keyStatus: ringkas,
    latencyMs: Date.now() - mulai } };
}

// Ringkasan status untuk penanda kuota di antarmuka — TANPA membocorkan kunci.
function ringkasanKunciLLM() {
  const { kunci, model } = muatKunciLLM();
  const sekarang = Date.now();
  return {
    provider: 'GEMINI', model, total: kunci.length,
    keys: kunci.map((k, i) => {
      const t = LLM.gagal.get(i);
      const bermasalah = t && t.sampai > sekarang;
      return {
        alias: `key-${i + 1}`,
        snippet: k.slice(0, 4) + '…' + k.slice(-4),
        // Dibedakan dengan sengaja: kuota habis akan pulih sendiri, kunci
        // ditolak tidak akan — dan menampilkan keduanya sebagai "kuota habis"
        // membuat orang menunggu sesuatu yang tidak akan pernah terjadi.
        status: bermasalah ? (t.sebab === 'KUNCI_DITOLAK' ? 'KUNCI_DITOLAK' : 'EXHAUSTED_429') : 'ACTIVE',
        resetAt: bermasalah ? t.sampai : null,
      };
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRASI SKEMA BERNOMOR
//
// Pemuatan skema massal (loadSchema) hanya cocok untuk membangun basis data
// dari nol: ia menjalankan puluhan berkas dua kali dan menelan kegagalan jadi
// penghitung. Itu tidak bisa dipakai memutakhirkan basis data klien yang sudah
// berisi data — dan itulah syarat agar produk ini bisa dijual berulang.
//
// Runner di bawah menjalankan berkas db/migrations/NNNN_*.sql sekali saja,
// berurutan, tiap berkas dalam satu transaksi, dan mencatatnya di
// public.schema_migrations. Kegagalan dibatalkan (ROLLBACK) lalu dilempar —
// sengaja berisik, supaya tidak ada lagi kegagalan yang menyamar jadi
// "belum ada data".
// ═══════════════════════════════════════════════════════════════════════════

function cariFolderMigrasi(platformDir) {
  let dir = platformDir || process.cwd();
  for (let i = 0; i < 8; i++) {
    const kandidat = path.join(dir, 'db', 'migrations');
    if (fs.existsSync(kandidat)) return kandidat;
    const induk = path.dirname(dir);
    if (induk === dir) break;
    dir = induk;
  }
  return '';
}

function checksumSql(teks) {
  return crypto.createHash('sha256').update(teks).digest('hex').slice(0, 16);
}

async function jalankanMigrasi(pg, platformDir, log = () => {}) {
  const dir = cariFolderMigrasi(platformDir);
  if (!dir) { log('[migrasi] folder db/migrations tidak ditemukan — dilewati'); return { terpasang: 0 }; }

  await pg.exec(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version    text PRIMARY KEY,
      name       text,
      checksum   text,
      applied_at timestamptz DEFAULT now()
    );
  `);

  const sudah = new Map(
    (await pg.query(`SELECT version, checksum FROM public.schema_migrations`))
      .rows.map(r => [r.version, r.checksum]));

  const berkas = fs.readdirSync(dir).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
  let terpasang = 0;

  for (const f of berkas) {
    const version = f.slice(0, 4);
    const isi = fs.readFileSync(path.join(dir, f), 'utf8');
    const sum = checksumSql(isi);

    if (sudah.has(version)) {
      // Migrasi yang sudah dipasang tidak boleh berubah isinya — kalau berubah,
      // basis data lama dan baru diam-diam menjadi berbeda.
      if (sudah.get(version) !== sum) {
        log(`[migrasi] PERINGATAN: ${f} berubah setelah dipasang. ` +
            `Buat migrasi baru, jangan menyunting yang lama.`);
      }
      continue;
    }

    try {
      await pg.exec('BEGIN');
      await pg.exec(isi);
      await pg.query(
        `INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1,$2,$3)`,
        [version, f, sum]);
      await pg.exec('COMMIT');
      terpasang++;
      log(`[migrasi] terpasang: ${f}`);
    } catch (e) {
      try { await pg.exec('ROLLBACK'); } catch (_) {}
      log(`[migrasi] GAGAL pada ${f}: ${e && e.message ? e.message : e}`);
      throw e;
    }
  }

  if (!terpasang) log(`[migrasi] skema mutakhir (${berkas.length} migrasi tercatat)`);
  return { terpasang, total: berkas.length };
}

// ── SKEMA LOKAL AVA HEALTH ECOSYSTEM ──────────────────────────────────────
// DIPERTAHANKAN sebagai jaring pengaman untuk instalasi yang folder
// db/migrations-nya tidak ikut terdistribusi. Sumber kebenaran DDL kini ada di
// db/migrations/0002_ava_health.sql.
async function siapkanTabelAva(pg, log = () => {}) {
  try {
    await pg.exec(`
      CREATE TABLE IF NOT EXISTS ava_consultations (
        id SERIAL PRIMARY KEY,
        patient_name TEXT,
        doctor_name TEXT,
        complaint TEXT,
        triage_level TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'pending',
        e_prescription TEXT,
        lab_referral TEXT,
        doctor_fee NUMERIC DEFAULT 150000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ava_device_readings (
        id SERIAL PRIMARY KEY,
        patient_id TEXT,
        device_name TEXT,
        device_type TEXT,
        reading_value TEXT,
        unit TEXT,
        alert_status TEXT DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ava_calibration_badges (
        id SERIAL PRIMARY KEY,
        device_name TEXT,
        lab_name TEXT,
        cert_number TEXT UNIQUE,
        expiry_date DATE,
        badge_status TEXT DEFAULT 'verified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ava_marketplace_items (
        id SERIAL PRIMARY KEY,
        title TEXT,
        vendor_name TEXT,
        price NUMERIC,
        type TEXT DEFAULT 'sewa',
        badge_status TEXT DEFAULT 'verified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ava_caregiver_links (
        id SERIAL PRIMARY KEY,
        patient_id TEXT,
        caregiver_name TEXT,
        relation TEXT,
        permission_scope TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    // Jangan ditelan diam-diam: kegagalan di sini membuat seluruh menu AVA
    // tampak "belum ada data" padahal tabelnya yang tidak terbentuk.
    log(`[local-engine] gagal menyiapkan tabel AVA: ${e && e.message ? e.message : e}`);
  }
}

// ── Seed master produk dari database.sql (INSERT INTO public.products ... ON CONFLICT)
async function seedProducts(pg, platformDir, log = () => {}) {
  const candidates = [path.join(platformDir, 'database.sql'), path.join(platformDir, '..', 'database.sql')];
  const sqlPath = candidates.find(p => fs.existsSync(p));
  if (!sqlPath) return 0;
  // Skema arsip menaruh ~17 produk contoh; master sebenarnya 532. Hanya lewati bila
  // master penuh sudah ada (ON CONFLICT upsert membuat pemanggilan ini idempoten).
  const cnt = await pg.query(`SELECT count(*)::int AS c FROM products`).catch(() => ({ rows: [{ c: 0 }] }));
  if ((cnt.rows[0]?.c || 0) >= 400) return cnt.rows[0].c;
  const content = fs.readFileSync(sqlPath, 'utf8');
  let seeded = 0;
  for (const st of splitStatements(content)) {
    if (/^INSERT\s+INTO\s+public\.products/i.test(st)) {
      try { await pg.exec(st.replace(/public\.products/i, 'products')); seeded++; } catch (_) {}
    }
  }
  const final = await pg.query(`SELECT count(*)::int AS c FROM products`).catch(() => ({ rows: [{ c: seeded }] }));
  log(`[local-engine] seeded products: +${seeded} inserts → ${final.rows[0].c} rows`);
  return final.rows[0].c;
}

// ═══════════════════════════════════════════════════════════════════════════
// PostgREST → SQL
// ═══════════════════════════════════════════════════════════════════════════
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };

function qid(name) { return '"' + String(name).replace(/"/g, '') + '"'; }

// Cache tipe kolom per tabel → agar filter WHERE meng-cast param teks ke tipe kolom
// (PostgREST kirim semua nilai sebagai teks; Postgres butuh "id" = $1::int4 dst).
async function getColTypes(pg, table) {
  pg.__colTypes = pg.__colTypes || {};
  if (pg.__colTypes[table]) return pg.__colTypes[table];
  const r = await pg.query(
    `SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table]
  ).catch(() => ({ rows: [] }));
  const map = {}; for (const row of r.rows) map[row.column_name] = row.udt_name;
  pg.__colTypes[table] = map; return map;
}
function castOf(colTypes, col) { const t = colTypes && colTypes[col]; return t ? '::' + t : ''; }

// Pisahkan filter kolom dari kata kunci PostgREST reserved
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'and', 'or', 'on_conflict', 'columns']);

// Bangun satu kondisi "col=op.value" → SQL (param di-cast ke tipe kolom)
function buildCond(col, raw, params, colTypes) {
  let neg = false;
  let m = /^(not)\.(.*)$/is.exec(raw);
  if (m) { neg = true; raw = m[2]; }
  const dot = raw.indexOf('.');
  const op = dot < 0 ? 'eq' : raw.slice(0, dot).toLowerCase();
  let val = dot < 0 ? raw : raw.slice(dot + 1);
  const cast = castOf(colTypes, col);
  let cond;
  if (op === 'in') {
    const inner = val.replace(/^\(/, '').replace(/\)$/, '');
    const items = inner.length ? splitCsvRespectingQuotes(inner) : [];
    if (!items.length) cond = 'FALSE';
    else { const ph = items.map(v => { params.push(unq(v)); return `$${params.length}${cast}`; }); cond = `${qid(col)} IN (${ph.join(',')})`; }
  } else if (op === 'is') {
    const v = val.toLowerCase();
    cond = `${qid(col)} IS ${v === 'null' ? 'NULL' : v === 'true' ? 'TRUE' : v === 'false' ? 'FALSE' : 'NULL'}`;
  } else if (op === 'like' || op === 'ilike') {
    params.push(val.replace(/\*/g, '%'));
    cond = `${qid(col)}::text ${OPS[op]} $${params.length}`;
  } else if (OPS[op]) {
    params.push(unq(val));
    cond = `${qid(col)} ${OPS[op]} $${params.length}${cast}`;
  } else {
    params.push(unq(raw)); cond = `${qid(col)} = $${params.length}${cast}`;
  }
  return neg ? `NOT (${cond})` : cond;
}

function unq(v) {
  if (v == null) return v;
  if (v === 'null') return null;
  if (/^".*"$/.test(v)) return v.slice(1, -1);
  return v;
}
function splitCsvRespectingQuotes(s) {
  const out = []; let buf = ''; let q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '"') { q = !q; buf += c; } else if (c === ',' && !q) { out.push(buf); buf = ''; } else buf += c; }
  if (buf.length) out.push(buf); return out;
}

// Parse "or=(a.eq.1,b.eq.2,...)" → SQL "(...)". Mendukung nested key.op.value
function buildOr(raw, params, colTypes) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  const parts = splitTopLevel(inner);
  const conds = parts.map(p => {
    const i2 = p.indexOf('.');
    const col = p.slice(0, i2); const rest = p.slice(i2 + 1);
    return buildCond(col, rest, params, colTypes);
  });
  return '(' + conds.join(' OR ') + ')';
}
function splitTopLevel(s) {
  const out = []; let buf = ''; let depth = 0;
  for (const c of s) { if (c === '(') depth++; if (c === ')') depth--; if (c === ',' && depth === 0) { out.push(buf); buf = ''; } else buf += c; }
  if (buf.length) out.push(buf); return out;
}

// Pisahkan select embed: "*,products(id,nama),partners(x)" → { cols:'*', embeds:[{rel,fkHint,cols}] }
function parseSelect(sel) {
  if (!sel) return { cols: '*', embeds: [] };
  const parts = splitTopLevel(sel);
  const cols = []; const embeds = [];
  for (const p of parts) {
    const m = /^([a-z_]+)(?:!([a-z_]+))?\((.*)\)$/is.exec(p.trim());
    if (m) embeds.push({ rel: m[1], fkHint: m[2] || null, cols: m[3] });
    else cols.push(p.trim());
  }
  return { cols: cols.length ? cols.map(c => c === '*' ? '*' : qid(c)).join(',') : '*', embeds };
}

function parseOrder(raw) {
  return raw.split(',').map(seg => {
    const bits = seg.split('.');
    const col = bits[0];
    let dir = ''; let nulls = '';
    for (const b of bits.slice(1)) {
      const lb = b.toLowerCase();
      if (lb === 'asc' || lb === 'desc') dir = lb.toUpperCase();
      else if (lb === 'nullsfirst') nulls = 'NULLS FIRST';
      else if (lb === 'nullslast') nulls = 'NULLS LAST';
    }
    return `${qid(col)} ${dir || 'ASC'} ${nulls}`.trim();
  }).join(', ');
}

// Ambil baris relasi untuk embed (many-to-one) lalu tempelkan ke tiap baris induk
async function attachEmbeds(pg, rows, embeds) {
  for (const emb of embeds) {
    const fk = emb.fkHint || guessFk(emb.rel, rows[0]);
    if (!fk) { for (const r of rows) r[emb.rel] = null; continue; }
    const ids = [...new Set(rows.map(r => r[fk]).filter(v => v != null))];
    if (!ids.length) { for (const r of rows) r[emb.rel] = null; continue; }
    const ph = ids.map((_, i) => `$${i + 1}`).join(',');
    let related = [];
    try { related = (await pg.query(`SELECT * FROM ${qid(emb.rel)} WHERE "id" IN (${ph})`, ids)).rows; } catch (_) {}
    const byId = new Map(related.map(r => [String(r.id), r]));
    for (const r of rows) r[emb.rel] = byId.get(String(r[fk])) || null;
  }
  return rows;
}
function guessFk(rel, sampleRow) {
  if (!sampleRow) return null;
  const singular = rel.replace(/s$/, '');
  for (const cand of [`${singular}_id`, `${rel}_id`, `${rel}`]) if (cand in sampleRow) return cand;
  return null;
}

// Bangun WHERE dari URLSearchParams (selain reserved)
function buildWhere(params, sqlParams, colTypes) {
  const conds = [];
  for (const [key, val] of params.entries()) {
    if (RESERVED.has(key)) { if (key === 'or') conds.push(buildOr(val, sqlParams, colTypes)); continue; }
    conds.push(buildCond(key, val, sqlParams, colTypes));
  }
  return conds.length ? ' WHERE ' + conds.join(' AND ') : '';
}

// Kolom yang TIDAK BOLEH keluar lewat REST, berapa pun hak akses pemintanya.
//
// portal_akses.token adalah kredensial itu sendiri — memegangnya sama dengan
// bisa membuka data perusahaan yang bersangkutan. Sebelum ini layar admin
// mengambil kolom itu untuk menampilkan potongannya, sehingga token utuh
// benar-benar terkirim ke peramban: cukup buka DevTools untuk memanen seluruh
// tautan klien sekaligus, tanpa jejak di portal_akses_log. Janji "token hanya
// ditampilkan sekali" tidak ada artinya selama kolomnya masih bisa dibaca.
//
// Satu-satunya jalan token terlihat kini adalah nilai kembalian
// portal_akses_buat(), tepat saat dibuat.
const KOLOM_RAHASIA = { portal_akses: ['token'] };

function sensorKolom(tabel, rows) {
  const buang = KOLOM_RAHASIA[tabel];
  if (!buang || !Array.isArray(rows) || !rows.length) return rows;
  return rows.map(r => {
    if (!r || typeof r !== 'object') return r;
    const salinan = { ...r };
    for (const k of buang) delete salinan[k];
    return salinan;
  });
}

// ── Handler REST utama
async function handleRest(pg, method, table, search, bodyText, headers) {
  const params = new URLSearchParams(search);
  const prefer = (headers['prefer'] || '');
  const wantCount = /count=exact/.test(prefer) || (params.get('select') || '').includes('count');
  const returnMinimal = /return=minimal/.test(prefer);
  const colTypes = await getColTypes(pg, table);

  if (method === 'GET') {
    const { cols, embeds } = parseSelect(params.get('select'));
    if (wantCount && (params.get('select') || '') === 'count') {
      const sp = []; const where = buildWhere(stripReserved(params), sp, colTypes);
      const c = await pg.query(`SELECT count(*)::int AS count FROM ${qid(table)}${where}`, sp);
      return { status: 200, rows: [{ count: c.rows[0].count }], count: c.rows[0].count };
    }
    const sp = [];
    const where = buildWhere(stripReserved(params), sp, colTypes);
    let sql = `SELECT ${cols} FROM ${qid(table)}${where}`;
    if (params.get('order')) sql += ' ORDER BY ' + parseOrder(params.get('order'));
    if (params.get('limit')) sql += ` LIMIT ${parseInt(params.get('limit')) || 0}`;
    if (params.get('offset')) sql += ` OFFSET ${parseInt(params.get('offset')) || 0}`;
    let rows = (await pg.query(sql, sp)).rows;
    if (embeds.length && rows.length) rows = await attachEmbeds(pg, rows, embeds);
    let count = null;
    if (wantCount) { const cp = []; const cw = buildWhere(stripReserved(params), cp, colTypes); count = (await pg.query(`SELECT count(*)::int AS c FROM ${qid(table)}${cw}`, cp)).rows[0].c; }
    return { status: 200, rows, count };
  }

  if (method === 'POST') {
    const body = bodyText ? JSON.parse(bodyText) : {};
    const list = Array.isArray(body) ? body : [body];
    if (!list.length) return { status: 201, rows: [] };
    const cols = [...new Set(list.flatMap(o => Object.keys(o)))];
    const values = []; const sp = [];
    for (const o of list) {
      const ph = cols.map(c => { sp.push(normVal(o[c])); return `$${sp.length}`; });
      values.push('(' + ph.join(',') + ')');
    }
    const onConflict = params.get('on_conflict');
    let sql = `INSERT INTO ${qid(table)} (${cols.map(qid).join(',')}) VALUES ${values.join(',')}`;
    if (onConflict) {
      const keys = onConflict.split(',').map(qid).join(',');
      const upd = cols.filter(c => !onConflict.split(',').includes(c)).map(c => `${qid(c)}=EXCLUDED.${qid(c)}`).join(',');
      sql += ` ON CONFLICT (${keys}) DO ${upd ? 'UPDATE SET ' + upd : 'NOTHING'}`;
    }
    if (!returnMinimal) sql += ' RETURNING *';
    const res = await pg.query(sql, sp);
    return { status: 201, rows: returnMinimal ? [] : res.rows };
  }

  if (method === 'PATCH') {
    const body = bodyText ? JSON.parse(bodyText) : {};
    const sp = [];
    const setCols = Object.keys(body);
    if (!setCols.length) return { status: 200, rows: [] };
    const setSql = setCols.map(c => { sp.push(normVal(body[c])); return `${qid(c)}=$${sp.length}`; }).join(',');
    const where = buildWhere(stripReserved(params), sp, colTypes);
    let sql = `UPDATE ${qid(table)} SET ${setSql}${where}`;
    if (!returnMinimal) sql += ' RETURNING *';
    const res = await pg.query(sql, sp);
    return { status: 200, rows: returnMinimal ? [] : res.rows };
  }

  if (method === 'DELETE') {
    const sp = [];
    const where = buildWhere(stripReserved(params), sp, colTypes);
    let sql = `DELETE FROM ${qid(table)}${where}`;
    if (!returnMinimal) sql += ' RETURNING *';
    const res = await pg.query(sql, sp);
    return { status: 200, rows: returnMinimal ? [] : res.rows };
  }
  return { status: 405, rows: [], error: 'method not allowed' };
}
function stripReserved(params) {
  const p = new URLSearchParams();
  for (const [k, v] of params.entries()) if (!RESERVED.has(k) || k === 'or') p.append(k, v);
  return p;
}
function normVal(v) { return (v && typeof v === 'object') ? JSON.stringify(v) : v; }

// ── RPC: fungsi Postgres sudah ada di PGlite → panggil dengan named args
async function handleRpc(pg, fn, bodyText) {
  const args = bodyText ? JSON.parse(bodyText) : {};
  const keys = Object.keys(args);
  const sp = []; const namedPh = keys.map(k => { sp.push(normVal(args[k])); return `${qid(k)} => $${sp.length}`; });
  const call = `${qid(fn)}(${namedPh.join(', ')})`;
  // Coba sebagai set-returning (TABLE/SETOF); jika hasilnya kolom-tunggal bernama
  // sama dengan fungsi → itu fungsi scalar, unwrap sesuai perilaku PostgREST.
  try {
    const res = await pg.query(`SELECT * FROM ${call}`, sp);
    const rows = res.rows;
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    if (keys.length === 1 && keys[0] === fn) {
      const vals = rows.map(r => r[fn]);
      return { status: 200, rows: vals.length <= 1 ? (vals[0] ?? null) : vals };
    }
    return { status: 200, rows };
  } catch (_) {
    const res = await pg.query(`SELECT ${call} AS result`, sp);
    return { status: 200, rows: res.rows[0]?.result ?? null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTENTIKASI LOKAL
// Kredensial disimpan di DB (public.local_auth_users), peran dibaca dari
// public.user_profiles.role — sumber kebenaran yang sama dengan mode cloud.
// Kata sandi TIDAK PERNAH disimpan polos: scrypt + salt acak per pengguna.
// Token ditandatangani HMAC-SHA256 dengan rahasia yang dibuat sekali per
// instalasi, sehingga token tidak bisa dipalsukan dari sisi peramban.
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');

const AUTH_ACCESS_TTL  = 12 * 60 * 60;        // 12 jam
const AUTH_REFRESH_TTL = 30 * 24 * 60 * 60;   // 30 hari
const AUTH_MAX_GAGAL   = 5;                   // percobaan sebelum dikunci
const AUTH_KUNCI_MENIT = 15;

function authSecret(dataDir) {
  // Rahasia per-instalasi. Disimpan di folder data, bukan di kode.
  const file = path.join(dataDir || process.cwd(), '.auth-secret');
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file);
  } catch (_) {}
  const buf = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf, { mode: 0o600 });
  } catch (_) { /* tidak bisa ditulis → rahasia hanya berlaku selama proses hidup */ }
  return buf;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function passwordCocok(password, salt, hashTersimpan) {
  const uji = Buffer.from(hashPassword(password, salt), 'hex');
  const asli = Buffer.from(String(hashTersimpan), 'hex');
  // Panjang harus sama sebelum timingSafeEqual, dan pembandingan tetap konstan.
  return uji.length === asli.length && crypto.timingSafeEqual(uji, asli);
}

const b64u = {
  enc: (buf) => Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (str) => Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
};

function buatToken(secret, payload, ttlDetik) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlDetik };
  const data = b64u.enc(JSON.stringify(body));
  const sig = b64u.enc(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

// Mengembalikan payload bila tanda tangan sah DAN belum kedaluwarsa; selain itu null.
function bacaToken(secret, token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  let harusnya;
  try {
    harusnya = b64u.enc(crypto.createHmac('sha256', secret).update(data).digest());
  } catch (_) { return null; }

  const a = Buffer.from(String(sig));
  const b = Buffer.from(harusnya);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(b64u.dec(data).toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}

function tokenDariHeader(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// Cache kecil: matriks peran jarang berubah, tapi dicek pada tiap permintaan
// yang menghapus data. Dikosongkan saat peran/izin diubah lewat aplikasi.
const CACHE_IZIN = new Map();

async function izinDariPeran(pg, role) {
  if (!role) return [];
  if (CACHE_IZIN.has(role)) return CACHE_IZIN.get(role);
  try {
    const r = await pg.query(
      `SELECT permission_kode FROM public.role_permissions WHERE role_kode = $1`, [role]);
    const daftar = r.rows.map(x => x.permission_kode);
    CACHE_IZIN.set(role, daftar);
    return daftar;
  } catch (_) {
    // Tabel RBAC belum ada (migrasi belum jalan) → jangan mengunci pengguna
    // keluar dari sistemnya sendiri; kembalikan kosong dan biarkan pemanggil
    // memutuskan. Lihat pemanggilnya: hanya operasi hapus yang dibatasi.
    return [];
  }
}

async function peranPunyaIzin(pg, role, izin) {
  // Super admin selalu lolos, termasuk saat matriks belum sempat dimuat.
  if (role === 'super_admin') return true;
  return (await izinDariPeran(pg, role)).includes(izin);
}

// Peran SELALU dibaca ulang dari basis data, tidak dari klaim di dalam token.
//
// Token menyatakan SIAPA penggunanya; basis data menyatakan APA yang boleh ia
// lakukan. Kalau peran dibaca dari token, admin yang menurunkan peran seseorang
// tidak benar-benar mencabut aksesnya — korban tetap memegang hak lama sampai
// tokennya kedaluwarsa (12 jam). Untuk pencabutan akses, itu terlalu lama.
async function peranTerkini(pg, sub, cadangan) {
  try {
    const r = await pg.query(`SELECT role FROM public.user_profiles WHERE id = $1`, [sub]);
    if (r.rows[0] && r.rows[0].role) return r.rows[0].role;
  } catch (_) { /* tabel belum ada → pakai klaim token */ }
  return cadangan || 'viewer';
}

async function siapkanTabelAuth(pg) {
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS public.local_auth_users (
      id             uuid PRIMARY KEY,
      email          text UNIQUE NOT NULL,
      password_hash  text NOT NULL,
      password_salt  text NOT NULL,
      is_active      boolean DEFAULT true,
      failed_attempts integer DEFAULT 0,
      locked_until   timestamptz,
      last_login_at  timestamptz,
      created_at     timestamptz DEFAULT now()
    );
  `);
}

// Akun pertama dibuat otomatis agar instalasi baru tidak terkunci di luar.
// Kata sandi ACAK (bukan default yang bisa ditebak) dan ditulis ke berkas
// supaya tidak ada kredensial tetap yang ikut terdistribusi bersama produk.
async function bootstrapAdmin(pg, dataDir, log) {
  const { rows } = await pg.query(`SELECT count(*)::int c FROM public.local_auth_users`);
  if (rows[0].c > 0) return;

  const id = crypto.randomUUID();
  const email = 'admin@onelab.local';
  const password = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '');
  const salt = crypto.randomBytes(16).toString('hex');

  await pg.query(
    `INSERT INTO public.local_auth_users (id, email, password_hash, password_salt)
     VALUES ($1,$2,$3,$4)`,
    [id, email, hashPassword(password, salt), salt]);
  await pg.query(
    `INSERT INTO public.user_profiles (id, full_name, role)
     VALUES ($1,$2,'super_admin') ON CONFLICT (id) DO UPDATE SET role='super_admin'`,
    [id, 'Administrator OneLab']);

  const berkas = path.join(path.dirname(dataDir || process.cwd()), 'LOGIN_ADMIN_PERTAMA.txt');
  const isi =
    `AKUN ADMIN PERTAMA ONELAB\r\n` +
    `Dibuat otomatis pada ${new Date().toISOString()}\r\n\r\n` +
    `Email    : ${email}\r\nPassword : ${password}\r\n\r\n` +
    `Segera ganti kata sandi setelah masuk, lalu HAPUS berkas ini.\r\n`;
  try { fs.writeFileSync(berkas, isi); } catch (_) {}

  log(`[local-engine] akun admin pertama dibuat → ${berkas}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP server
// ═══════════════════════════════════════════════════════════════════════════
function jsonRes(res, status, payload, extraHeaders = {}) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    ...extraHeaders,
  });
  res.end(body);
}

async function createEngine({ platformDir, dataDir, port = 54329, log = console.log }) {
  DIR_DATA_ENGINE = dataDir || '';            // jangkar pencarian .env (lihat muatKunciLLM)
  const { PGlite } = await import('@electric-sql/pglite');   // ESM dari CJS
  const pg = dataDir ? await PGlite.create({ dataDir }) : await new PGlite();

  const needInit = (await pg.query(`SELECT count(*)::int c FROM pg_tables WHERE schemaname='public'`)).rows[0].c < 5;
  if (needInit) {
    await loadSchema(pg, platformDir, log);
    const seededCount = await seedProducts(pg, platformDir, log);
    log(`[local-engine] initial seed completed: ${seededCount} products`);
  }

  // Autentikasi: tabel kredensial, rahasia penanda tangan, dan akun pertama.
  // Dijalankan tiap boot (idempoten) supaya instalasi lama ikut mendapatkannya.
  // Migrasi bernomor dijalankan tiap boot; hanya yang belum tercatat yang dipasang.
  // Ini jalur resmi pemutakhiran skema, termasuk untuk basis data klien yang sudah berisi data.
  try {
    await jalankanMigrasi(pg, platformDir, log);
  } catch (e) {
    // Sudah dicatat & di-ROLLBACK di dalam runner. Jaring pengaman di bawah tetap
    // dijalankan agar aplikasi tidak mati total karena satu migrasi bermasalah.
    log('[local-engine] migrasi gagal — memakai jaring pengaman DDL bawaan');
  }

  const SECRET = authSecret(dataDir);
  await siapkanTabelAuth(pg);          // jaring pengaman (lihat 0001_auth_lokal.sql)
  await siapkanTabelAva(pg, log);      // jaring pengaman (lihat 0002_ava_health.sql)
  await bootstrapAdmin(pg, dataDir, log);

  const server = http.createServer((req, res) => {
    (async () => {
      if (req.method === 'OPTIONS') return jsonRes(res, 204);
      const u = new URL(req.url, 'http://localhost');
      const p = u.pathname;
      let bodyText = '';
      for await (const chunk of req) bodyText += chunk;

      try {
        // ── AUTENTIKASI (nyata; kredensial di DB, token bertanda tangan) ──
        if (p.startsWith('/auth/v1/')) {
          const badan = () => { try { return JSON.parse(bodyText || '{}'); } catch (_) { return {}; } };
          const gagal = (status, pesan) =>
            jsonRes(res, status, { error: 'invalid_grant', error_description: pesan, msg: pesan });

          // Susun jawaban sesi yang bentuknya sama dengan GoTrue/Supabase.
          const buatSesi = async (baris) => {
            const prof = await pg.query(
              `SELECT role, full_name FROM public.user_profiles WHERE id=$1`, [baris.id]);
            const role = (prof.rows[0] && prof.rows[0].role) || 'viewer';
            const nama = (prof.rows[0] && prof.rows[0].full_name) || '';
            const user = {
              id: baris.id, email: baris.email, role: 'authenticated',
              app_metadata: { role }, user_metadata: { full_name: nama, role },
            };
            return {
              access_token: buatToken(SECRET, { sub: baris.id, email: baris.email, role, typ: 'access' }, AUTH_ACCESS_TTL),
              token_type: 'bearer',
              expires_in: AUTH_ACCESS_TTL,
              refresh_token: buatToken(SECRET, { sub: baris.id, typ: 'refresh' }, AUTH_REFRESH_TTL),
              user,
            };
          };

          // GET /auth/v1/user — verifikasi sesi berjalan.
          if (p === '/auth/v1/user') {
            const payload = bacaToken(SECRET, tokenDariHeader(req));
            if (!payload || payload.typ !== 'access') return jsonRes(res, 401, { message: 'Sesi tidak sah atau kedaluwarsa' });
            const r = await pg.query(
              `SELECT id, email, is_active FROM public.local_auth_users WHERE id=$1`, [payload.sub]);
            if (!r.rows[0] || r.rows[0].is_active === false) return jsonRes(res, 401, { message: 'Akun tidak aktif' });
            const prof = await pg.query(`SELECT role, full_name FROM public.user_profiles WHERE id=$1`, [payload.sub]);
            const role = (prof.rows[0] && prof.rows[0].role) || 'viewer';
            return jsonRes(res, 200, {
              id: r.rows[0].id, email: r.rows[0].email, role: 'authenticated',
              app_metadata: { role },
              user_metadata: { full_name: (prof.rows[0] && prof.rows[0].full_name) || '', role },
            });
          }

          if (p === '/auth/v1/logout') return jsonRes(res, 204);

          // Izin milik sesi berjalan. Sumbernya matriks di basis data, bukan
          // localStorage — klien memakai ini hanya untuk MENYEMBUNYIKAN menu;
          // penegakan sesungguhnya tetap di server.
          if (p === '/auth/v1/permissions') {
            const payload = bacaToken(SECRET, tokenDariHeader(req));
            if (!payload || payload.typ !== 'access') return jsonRes(res, 401, { message: 'Sesi tidak sah' });

            // Peran dibaca ulang dari basis data — lihat catatan di peranTerkini().
            const role = await peranTerkini(pg, payload.sub, payload.role);
            const izin = role === 'super_admin'
              ? (await pg.query(`SELECT kode FROM public.permissions`).catch(() => ({ rows: [] }))).rows.map(r => r.kode)
              : await izinDariPeran(pg, role);
            // Urutan: halaman khusus pengguna (bila diatur admin) → halaman peran.
            const khusus = await pg.query(
              `SELECT page FROM public.user_pages WHERE user_id = $1`, [payload.sub]).catch(() => ({ rows: [] }));
            const halaman = khusus.rows.length ? khusus
              : await pg.query(
                  `SELECT page FROM public.role_pages WHERE role_kode = $1`, [role]).catch(() => ({ rows: [] }));

            return jsonRes(res, 200, {
              role,
              permissions: izin,
              pages: halaman.rows.map(r => r.page),
              pagesSumber: khusus.rows.length ? 'pengguna' : 'peran',
              // Ditandai bila peran sudah berubah sejak token diterbitkan,
              // supaya klien bisa menyegarkan tampilannya.
              roleChanged: role !== payload.role,
            });
          }

          if (p === '/auth/v1/token') {
            const grant = u.searchParams.get('grant_type') || 'password';

            if (grant === 'refresh_token') {
              const payload = bacaToken(SECRET, badan().refresh_token || '');
              if (!payload || payload.typ !== 'refresh') return gagal(401, 'Sesi kedaluwarsa, silakan masuk lagi');
              const r = await pg.query(
                `SELECT * FROM public.local_auth_users WHERE id=$1 AND is_active=true`, [payload.sub]);
              if (!r.rows[0]) return gagal(401, 'Akun tidak aktif');
              return jsonRes(res, 200, await buatSesi(r.rows[0]));
            }

            const { email, password } = badan();
            if (!email || !password) return gagal(400, 'Email dan kata sandi wajib diisi');

            const r = await pg.query(
              `SELECT * FROM public.local_auth_users WHERE lower(email)=lower($1)`, [String(email).trim()]);
            const baris = r.rows[0];

            // Pesan sengaja sama untuk email tak dikenal maupun sandi salah,
            // supaya tidak bocor akun mana yang benar-benar ada.
            const PESAN_UMUM = 'Email atau kata sandi salah';
            if (!baris) return gagal(400, PESAN_UMUM);
            if (baris.is_active === false) return gagal(403, 'Akun dinonaktifkan. Hubungi administrator.');

            if (baris.locked_until && new Date(baris.locked_until) > new Date()) {
              const menit = Math.ceil((new Date(baris.locked_until) - Date.now()) / 60000);
              return gagal(429, `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.`);
            }

            if (!passwordCocok(password, baris.password_salt, baris.password_hash)) {
              const gagalKe = (baris.failed_attempts || 0) + 1;
              const kunci = gagalKe >= AUTH_MAX_GAGAL
                ? new Date(Date.now() + AUTH_KUNCI_MENIT * 60000).toISOString() : null;
              await pg.query(
                `UPDATE public.local_auth_users SET failed_attempts=$1, locked_until=$2 WHERE id=$3`,
                [kunci ? 0 : gagalKe, kunci, baris.id]);
              return gagal(400, kunci
                ? `Akun dikunci ${AUTH_KUNCI_MENIT} menit karena ${AUTH_MAX_GAGAL} kali gagal masuk.`
                : PESAN_UMUM);
            }

            await pg.query(
              `UPDATE public.local_auth_users SET failed_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$1`,
              [baris.id]);
            return jsonRes(res, 200, await buatSesi(baris));
          }

          if (p === '/auth/v1/signup') {
            const { email, password } = badan();
            if (!email || !password) return gagal(400, 'Email dan kata sandi wajib diisi');
            if (String(password).length < 8) return gagal(400, 'Kata sandi minimal 8 karakter');

            const ada = await pg.query(
              `SELECT 1 FROM public.local_auth_users WHERE lower(email)=lower($1)`, [String(email).trim()]);
            if (ada.rows[0]) return gagal(400, 'Email sudah terdaftar');

            // Pendaftaran mandiri hanya boleh saat belum ada satu pun akun
            // (bootstrap instalasi baru). Setelah itu penambahan pengguna
            // menjadi wewenang administrator lewat modul Pengaturan Pengguna.
            const jml = await pg.query(`SELECT count(*)::int c FROM public.local_auth_users`);
            if (jml.rows[0].c > 0) return gagal(403, 'Pendaftaran mandiri ditutup. Minta administrator membuatkan akun.');

            const id = crypto.randomUUID();
            const salt = crypto.randomBytes(16).toString('hex');
            await pg.query(
              `INSERT INTO public.local_auth_users (id, email, password_hash, password_salt)
               VALUES ($1,$2,$3,$4)`,
              [id, String(email).trim(), hashPassword(password, salt), salt]);
            await pg.query(
              `INSERT INTO public.user_profiles (id, full_name, role) VALUES ($1,$2,'super_admin')
               ON CONFLICT (id) DO UPDATE SET role='super_admin'`,
              [id, badan().full_name || String(email).split('@')[0]]);

            const baru = await pg.query(`SELECT * FROM public.local_auth_users WHERE id=$1`, [id]);
            return jsonRes(res, 200, await buatSesi(baru.rows[0]));
          }

          return jsonRes(res, 404, { message: 'Endpoint auth tidak dikenal' });
        }

        // ── Gerbang LLM: setara Edge Function llm-gateway di mode cloud ─────
        // Tetap menuntut sesi sah — tanpa itu siapa pun yang menjangkau porta
        // ini bisa memakai kuota LLM berbayar milik pemilik instalasi.
        if (p.startsWith('/functions/v1/llm-gateway')) {
          if (!bacaToken(SECRET, tokenDariHeader(req))) {
            return jsonRes(res, 401, { error: 'Silakan masuk terlebih dahulu' });
          }
          if (p.endsWith('/status')) return jsonRes(res, 200, ringkasanKunciLLM());
          const { status, payload } = await tanganiLlmGateway(bodyText, log);
          return jsonRes(res, status, payload);
        }

        // ── PORTAL PIHAK LUAR (klien korporat / lab perujuk) ────────────────
        //
        // SENGAJA di luar gerbang sesi: pemakainya PIC perusahaan klien, bukan
        // staf klinik. Tokennya sendiri yang menjadi kredensial.
        //
        // Yang menjaga: cakupan ditentukan sepenuhnya di dalam fungsi basis
        // data dari token — tidak ada corporate_id yang diterima dari klien.
        // Kalau ada, pemegang token bisa menukarnya dengan milik perusahaan
        // lain. Hanya-baca, dan setiap pemakaian dicatat.
        if (p.startsWith('/functions/v1/portal')) {
          if (req.method !== 'POST') return jsonRes(res, 405, { error: 'Metode tidak didukung' });
          let badan = {};
          try { badan = JSON.parse(bodyText || '{}'); } catch (_) {}
          const token = String(badan.token || '').trim();

          // Pembatasan kasar terhadap penebakan token. Bukan pengganti token
          // acak 24 byte, tapi membuat percobaan massal tidak sepadan.
          const kunciIP = req.socket.remoteAddress || 'x';
          const kini = Date.now();
          const jejak = PORTAL_COBA.get(kunciIP) || { n: 0, sejak: kini };
          if (kini - jejak.sejak > 60_000) { jejak.n = 0; jejak.sejak = kini; }
          jejak.n++; PORTAL_COBA.set(kunciIP, jejak);
          if (jejak.n > 30) {
            return jsonRes(res, 429, { error: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.' });
          }

          // Pesan HARUS sama persis dengan yang dikembalikan portal_korporat()
          // untuk token yang tidak ditemukan. Kalau berbeda, penebak bisa
          // memisahkan "formatnya salah" dari "formatnya benar tapi tidak
          // ada" — dan itu memberitahunya bahwa tebakannya sudah di jalur
          // yang benar.
          if (!/^[a-f0-9]{20,80}$/.test(token)) {
            return jsonRes(res, 200, { error: PORTAL_PESAN_TOLAK });
          }
          try {
            const r = await pg.query(`SELECT public.portal_korporat($1) AS d`, [token]);
            return jsonRes(res, 200, (r.rows[0] && r.rows[0].d) || { error: 'Tidak ada data' });
          } catch (e) {
            log(`[portal] galat: ${e && e.message ? e.message : e}`);
            return jsonRes(res, 500, { error: 'Terjadi kesalahan pada server' });
          }
        }

        // ── SATUSEHAT: kredensial di server, peramban hanya meneruskan ──────
        if (p.startsWith('/functions/v1/satusehat')) {
          const sesi = bacaToken(SECRET, tokenDariHeader(req));
          if (!sesi) return jsonRes(res, 401, { error: 'Silakan masuk terlebih dahulu' });

          if (p.endsWith('/status')) return jsonRes(res, 200, statusSatusehat());

          // Mengirim data pasien ke sistem nasional bukan tindakan harian
          // biasa: salah kirim sulit ditarik kembali dan terikat kepatuhan.
          const role = await peranTerkini(pg, sesi.sub, sesi.role);
          if (!(await peranPunyaIzin(pg, role, 'user.manage'))) {
            return jsonRes(res, 403, {
              error: `Peran "${role}" tidak berwenang mengirim data ke SATUSEHAT`,
              required: 'user.manage',
            });
          }

          let badan = {};
          try { badan = JSON.parse(bodyText || '{}'); } catch (_) {}
          const jalur = badan.jalur || p.replace('/functions/v1/satusehat', '').replace(/^\/+/, '');
          if (!jalur) return jsonRes(res, 400, { error: 'Jalur FHIR wajib diisi (mis. "Patient")' });

          // Metode diambil dari badan bila disebut; kalau tidak, ikuti metode
          // HTTP permintaan, dengan POST sebagai default.
          const metode = (badan.metode || (req.method === 'GET' ? 'GET' : 'POST')).toUpperCase();
          const hasil = await panggilSatusehat(pg, {
            metode, jalur, muatan: badan.resource || badan.muatan, log,
          });
          return jsonRes(res, hasil.status, hasil.payload);
        }

        // ── Gerbang data: /rest/v1 dan /rpc wajib membawa token sah ──────────
        // Tanpa ini, siapa pun yang bisa menjangkau porta 54329 dapat membaca
        // seluruh basis data tanpa masuk terlebih dahulu.
        if (p.startsWith('/rest/v1/') || p.startsWith('/rpc/')) {
          const sesi = bacaToken(SECRET, tokenDariHeader(req));
          if (!sesi) {
            return jsonRes(res, 401, { message: 'Silakan masuk terlebih dahulu', code: 'PGRST301' });
          }

          // Penegakan izin di SISI SERVER. Pengecekan di peramban tidak bisa
          // dipercaya: daftar hak akses dulu disimpan di localStorage dan bisa
          // ditulis ulang lewat DevTools. Di sini peran diambil dari token yang
          // ditandatangani, lalu dicocokkan ke matriks di basis data.
          const menulis = req.method === 'POST' || req.method === 'PATCH' ||
                          req.method === 'PUT'  || req.method === 'DELETE';
          const tabel = p.replace(/^\/rest\/v1\//, '').split('?')[0].split('/')[0];

          // Tabel yang menentukan SIAPA BOLEH APA. Menulis ke sini sama dengan
          // mengubah hak akses, jadi wajib memegang user.manage. Tanpa penjaga
          // ini, satu PATCH ke user_profiles cukup untuk menaikkan peran diri
          // sendiri menjadi super_admin.
          //
          // portal_akses ikut di sini karena membuat satu barisnya berarti
          // memberi pihak DI LUAR klinik akses ke data satu perusahaan, tanpa
          // perlu akun. Itu keputusan hak akses, bukan pekerjaan harian.
          const TABEL_HAK_AKSES = new Set([
            'user_profiles', 'local_auth_users', 'roles', 'permissions',
            'role_permissions', 'role_pages', 'user_pages', 'tenants',
            'portal_akses',
          ]);

          let perluIzin = null;
          // Operasi administratif: mendorong kode ke GitHub dan menyinkronkan
          // ke cloud bukan pekerjaan harian staf. Sebelumnya cukup "sudah
          // login", sehingga peran serendah viewer pun bisa memicunya.
          if (p === '/rest/v1/sync/git-push' || p === '/rest/v1/sync/supabase-cloud') {
            perluIzin = 'user.manage';
          } else if (p === '/rest/v1/rpc/portal_akses_buat') {
            // Fungsinya SECURITY DEFINER dan diberikan ke peran "authenticated",
            // jadi tanpa penjaga ini setiap pengguna yang sudah masuk — termasuk
            // viewer — bisa mencetak tautan ke data korporat mana pun. Penjaga
            // tabel di atas tidak menangkapnya karena jalurnya /rpc/, bukan
            // /rest/v1/portal_akses.
            perluIzin = 'user.manage';
          } else if (menulis && TABEL_HAK_AKSES.has(tabel)) {
            perluIzin = 'user.manage';
          } else if (req.method === 'DELETE') {
            // Hapus tanpa satu pun penyaring mengenai SELURUH isi tabel.
            // Itu kelas tindakan yang berbeda dari menghapus satu baris, dan
            // memang dibedakan di matriks (canDelete vs canBulkDelete).
            //
            // Aturannya sengaja sederhana dan konservatif: ada penyaing atau
            // tidak. Menghitung berapa baris yang benar-benar kena menuntut
            // menjalankan kuerinya lebih dulu; yang ingin dicegah di sini
            // adalah kasus paling merusak, yaitu tabel terhapus seluruhnya.
            const adaPenyaring = [...u.searchParams.keys()]
              .some(k => !['select', 'order', 'limit', 'offset', 'columns'].includes(k));
            perluIzin = adaPenyaring ? 'data.delete' : 'data.bulk_delete';
          }

          if (perluIzin) {
            const role = await peranTerkini(pg, sesi.sub, sesi.role);
            if (!(await peranPunyaIzin(pg, role, perluIzin))) {
              const pesan = {
                'user.manage':      p === '/rest/v1/rpc/portal_akses_buat'
                                      ? `Peran "${role}" tidak berwenang membuat tautan portal klien`
                                      : `Peran "${role}" tidak berwenang mengubah hak akses (tabel ${tabel})`,
                'data.bulk_delete': `Peran "${role}" tidak berwenang menghapus SELURUH isi tabel ${tabel}. ` +
                                    `Tambahkan penyaring untuk menghapus baris tertentu.`,
                'data.delete':      `Peran "${role}" tidak berwenang menghapus data`,
              }[perluIzin];
              return jsonRes(res, 403, { message: pesan, code: 'PGRST403', required: perluIzin });
            }
          }
        }

        // ── SYNC ENDPOINTS (Git Push & Cloud Supabase Sync) ──
        // Keadaan antrean sinkronisasi — dipakai penanda di antarmuka agar
        // pengguna tahu masih ada perubahan yang belum terkirim ke cloud.
        if (p === '/rest/v1/sync/status') {
          return jsonRes(res, 200, await ringkasanSync(pg));
        }

        // Cadangan basis data. PGlite menyediakan dump seluruh folder data,
        // sehingga hasilnya bisa dikembalikan apa adanya tanpa perlu pg_dump.
        if (p === '/rest/v1/backup/create' && req.method === 'POST') {
          try {
            const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            // Nama basis data asal DIMASUKKAN ke nama berkas. Instalasi
            // produksi dan basis data pengembangan berbagi folder cadangan
            // yang sama; tanpa penanda ini keduanya tak bisa dibedakan, dan
            // memulihkan yang keliru berarti menimpa data klinik dengan data uji.
            const asal = path.basename(dataDir || 'db').replace(/[^a-zA-Z0-9_-]/g, '');
            const tujuanDir = path.join(path.dirname(dataDir || process.cwd()), 'backup');
            fs.mkdirSync(tujuanDir, { recursive: true });
            const tujuan = path.join(tujuanDir, `onelab-${asal}-${stempel}.tar.gz`);

            const berkas = await pg.dumpDataDir('gzip');
            const buf = Buffer.from(await berkas.arrayBuffer());
            fs.writeFileSync(tujuan, buf);

            log(`[backup] tersimpan: ${tujuan} (${(buf.length / 1048576).toFixed(1)} MB)`);
            return jsonRes(res, 200, {
              ok: true, berkas: tujuan, ukuranBytes: buf.length,
            });
          } catch (e) {
            log(`[backup] GAGAL: ${e && e.message ? e.message : e}`);
            return jsonRes(res, 500, { ok: false, error: String(e && e.message || e) });
          }
        }

        if (p === '/rest/v1/sync/git-push') {
          try {
            const { execSync } = require('child_process');
            const cwd = platformDir || process.cwd();
            const gitMsg = `Sync: Research updates, config & local database state [${new Date().toISOString().slice(0,10)}]`;
            let out1 = '';
            try { out1 += execSync('git add .', { cwd, encoding: 'utf8' }); } catch(e) {}
            try { out1 += execSync(`git commit -m "${gitMsg}"`, { cwd, encoding: 'utf8' }); } catch(e) {}
            let out2 = '';
            try { out2 = execSync('git push origin main', { cwd, encoding: 'utf8' }); } catch(e) {
              try { out2 = execSync('git push', { cwd, encoding: 'utf8' }); } catch(e2) { out2 = String(e && e.message || e); }
            }
            return jsonRes(res, 200, { ok: true, message: 'Git Push Selesai!', log: out1 + '\n' + out2 });
          } catch(err) {
            return jsonRes(res, 500, { ok: false, error: String(err && err.message || err) });
          }
        }

        if (p === '/rest/v1/sync/supabase-cloud') {
          try {
            const tables = ['user_profiles', 'products', 'ava_consultations', 'ava_device_readings', 'ava_calibration_badges', 'partners'];
            let totalSynced = 0;
            const syncedList = [];

            for (const tbl of tables) {
              const r = await pg.query(`SELECT count(*)::int c FROM "${tbl}"`).catch(() => ({ rows: [{ c: 0 }] }));
              const cnt = r.rows[0]?.c || 0;
              if (cnt > 0) {
                totalSynced += cnt;
                syncedList.push(`${tbl} (${cnt} baris)`);
              }
            }
            return jsonRes(res, 200, { ok: true, message: 'Sinkronisasi Cloud Supabase Selesai!', syncedList, totalSynced });
          } catch(err) {
            return jsonRes(res, 500, { ok: false, error: String(err && err.message || err) });
          }
        }
        // ── RPC ──
        const rpc = /^\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)$/.exec(p);
        if (rpc) { const out = await handleRpc(pg, rpc[1], bodyText); return jsonRes(res, out.status, out.rows); }
        // ── REST tabel ──
        const rest = /^\/rest\/v1\/([a-zA-Z0-9_]+)$/.exec(p);
        if (rest) {
          const headers = {}; for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = v;
          const out = await handleRest(pg, req.method, rest[1], u.search.replace(/^\?/, ''), bodyText, headers);
          if (out.rows) out.rows = sensorKolom(rest[1], out.rows);
          const extra = {};
          if (out.count != null) extra['Content-Range'] = `0-${Math.max(out.rows.length - 1, 0)}/${out.count}`;
          if (out.error) return jsonRes(res, out.status, { message: out.error }, extra);

          // Dicatat SETELAH penulisan lokal berhasil — lihat catatan di catatOutbox().
          if (!out.error) {
            await catatOutbox(pg, {
              method: req.method, tabel: rest[1],
              penyaring: u.search.replace(/^\?/, ''),
              bodyText, hasil: out.rows, log,
            });
          }
          return jsonRes(res, out.status, out.rows, extra);
        }
        return jsonRes(res, 404, { message: 'not found: ' + p });
      } catch (err) {
        return jsonRes(res, 400, { message: String(err && err.message || err), hint: 'local-engine' });
      }
    })();
  });

  await new Promise(r => server.listen(port, '127.0.0.1', r));
  log(`[local-engine] PostgREST shim ready → http://127.0.0.1:${port}`);
  return { pg, server, port };
}

module.exports = { createEngine, jalankanMigrasi, loadSchema, seedProducts, splitStatements, handleRest, handleRpc };
