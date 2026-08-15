import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';

const ENGINE_PORT = 54329;   // shim PostgREST lokal (lihat local-engine.js)
const PLATFORM_PORT = 5174;  // server statis platform

// ── Penentuan lokasi (TANPA path absolut) ───────────────────────────────────
// Aplikasi harus jalan di komputer mana pun, dari folder mana pun. Urutan cari
// dibuat agar instalasi lama (data di desktop-app/pglite-data) tetap terbaca.

// Titik awal penelusuran folder proyek.
// PENTING: pada build terpaket, __dirname berada DI DALAM app.asar
// (…\win-unpacked\resources\app.asar\dist-electron) sehingga menelusuri
// induknya tidak pernah sampai ke folder proyek. Karena itu jangkarnya
// memakai lokasi exe, bukan __dirname.
function anchorDir(): string {
  try {
    if (app.isPackaged) return path.dirname(app.getPath('exe'));
  } catch (_) { /* dipanggil sangat awal → jatuh ke __dirname */ }
  return __dirname;
}

// Telusuri dari `start` ke atas sampai menemukan salah satu kandidat.
// `probe` = berkas penanda yang harus ada di dalam folder kandidat.
function findUp(start: string, kandidat: string[][], probe?: string): string {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    for (const bagian of kandidat) {
      const full = path.join(dir, ...bagian);
      if (fs.existsSync(probe ? path.join(full, probe) : full)) return full;
    }
    const induk = path.dirname(dir);
    if (induk === dir) break;   // sudah di akar drive
    dir = induk;
  }
  return '';
}

// Lokasi frontend OneLab (platform statis) — disajikan ke iframe React shell.
// 1. ONELAB_PLATFORM_PATH  → override manual / bundle klien
// 2. resources/platform    → hasil paket produksi (electron-builder extraResources)
// 3. telusuri ke atas      → tata letak repo saat ini
function resolvePlatformDir(): string {
  const fromEnv = process.env.ONELAB_PLATFORM_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const packaged = path.join(process.resourcesPath || '', 'platform');
  if (fs.existsSync(path.join(packaged, 'index.html'))) return packaged;

  return findUp(anchorDir(),
    [['onelab-platform-main', 'onelab-platform'], ['onelab-platform']],
    'index.html');
}

// DB PGlite persisten. Dipisah dari kode supaya update aplikasi tidak menyentuh data.
// 1. ONELAB_DATA_DIR            → override manual (mis. drive data klien)
// 2. desktop-app/pglite-data    → instalasi yang sudah ada; WAJIB ditemukan
//                                 lebih dulu, kalau tidak aplikasi akan diam-diam
//                                 membuat basis data kosong baru
// 3. userData/pglite-data       → instalasi benar-benar baru
function resolveDataDir(): string {
  const fromEnv = process.env.ONELAB_DATA_DIR;
  if (fromEnv) return fromEnv;

  const lama = findUp(anchorDir(), [['desktop-app', 'pglite-data'], ['pglite-data']], 'PG_VERSION');
  if (lama) return lama;

  return path.join(app.getPath('userData'), 'pglite-data');
}

const ONELAB_PLATFORM_PATH = resolvePlatformDir();
const PGLITE_DATA_DIR = resolveDataDir();

// local-engine.js = CommonJS murni (PGlite dimuat lewat dynamic import ESM).
// require relatif → dist-electron/local-engine.js saat runtime (disalin oleh build script).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createEngine } = require('./local-engine.js');

let pg: any = null;                 // handle PGlite (Postgres WASM)
let mainWindow: BrowserWindow | null = null;

// ── Server statis untuk platform OneLab (dipakai iframe di React shell) ──────
const mimeTypes: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function startLocalPlatformServer() {
  const server = http.createServer((req, res) => {
    const rawUrl = (req.url || '/').split('?')[0];

    // Tanpa pesan ini, folder platform yang tak ketemu muncul sebagai
    // "403 Forbidden" yang menyesatkan (path menjadi relatif → keluar folder).
    if (!ONELAB_PLATFORM_PATH) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Folder platform OneLab tidak ditemukan</h1>' +
        '<p>Setel variabel <code>ONELAB_PLATFORM_PATH</code> ke folder yang berisi ' +
        '<code>index.html</code>, atau jalankan lewat <code>ONELAB.bat</code>.</p>');
    }

    const filePath = path.join(ONELAB_PLATFORM_PATH, rawUrl === '/' ? 'index.html' : rawUrl);

    // Tahan path traversal (../). Penting begitu server ini dibuka ke LAN.
    if (!path.resolve(filePath).startsWith(path.resolve(ONELAB_PLATFORM_PATH))) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      return res.end('<h1>403 Forbidden</h1>');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'text/plain';
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/html' });
        res.end(err.code === 'ENOENT' ? '<h1>404 File Not Found</h1>' : `Server Error: ${err.code}`);
      } else {
        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
        res.end(content, 'utf-8');
      }
    });
  });
  server.listen(PLATFORM_PORT, '127.0.0.1', () => {
    console.log(`OneLab Platform static server → http://127.0.0.1:${PLATFORM_PORT}`);
  });
}

// ── IPC untuk React shell (GUI Table Editor + SQL Studio) di atas PGlite ─────
function registerIpc() {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('db:getTables', async () => {
    if (!pg) return [];
    const r = await pg.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
    return r.rows.map((x: any) => x.tablename);
  });

  ipcMain.handle('db:getTableColumns', async (_e: any, tableName: string) => {
    if (!pg) return [];
    const safe = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    const r = await pg.query(
      `SELECT (ordinal_position - 1) AS cid, column_name AS name, data_type AS type,
              CASE WHEN is_nullable='NO' THEN 1 ELSE 0 END AS notnull,
              column_default AS dflt_value, 0 AS pk
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position`, [safe]);
    return r.rows;
  });

  ipcMain.handle('db:getTableData', async (_e: any, tableName: string) => {
    if (!pg) return [];
    const safe = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    const r = await pg.query(`SELECT * FROM "${safe}" LIMIT 200`);
    return r.rows;
  });

  ipcMain.handle('db:execSql', async (_e: any, sqlQuery: string) => {
    const start = Date.now();
    try {
      const trimmed = (sqlQuery || '').trim();
      const isSelect = /^(SELECT|WITH|PRAGMA|EXPLAIN|TABLE|SHOW|VALUES)\b/i.test(trimmed);
      if (isSelect) {
        const res = await pg.query(trimmed);
        return { success: true, isSelect: true, rows: res.rows, rowCount: res.rows.length, executionTimeMs: Date.now() - start };
      }
      await pg.exec(trimmed);
      const stmts = trimmed.split(';').map(s => s.trim()).filter(Boolean).length;
      return { success: true, isSelect: false, affectedStatements: stmts, executionTimeMs: Date.now() - start };
    } catch (e: any) {
      return { success: false, error: e.message || String(e), executionTimeMs: Date.now() - start };
    }
  });

  ipcMain.handle('db:getProducts', async () => {
    if (!pg) return [];
    const r = await pg.query(`SELECT * FROM products ORDER BY created_at DESC NULLS LAST LIMIT 1000`);
    return r.rows;
  });

  ipcMain.handle('db:createProduct', async (_e: any, data: any) => {
    const r = await pg.query(
      `INSERT INTO products (kode_internal, kode_material, kategori, sub_kategori, nama_tes, nama_singkat, harga_normal, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.kode_internal, data.kode_material || data.kode_internal, data.kategori,
       data.sub_kategori || '', data.nama_tes, data.nama_singkat || data.nama_tes,
       parseFloat(data.harga_normal) || 0, data.is_active ?? true]);
    return r.rows[0];
  });

  ipcMain.handle('db:updateProduct', async (_e: any, payload: any) => {
    const { id, data } = payload;
    const cols = Object.keys(data);
    if (!cols.length) return null;
    const vals = cols.map(c => (c === 'harga_normal' ? (parseFloat(data[c]) || 0) : data[c]));
    const sets = cols.map((c, i) => `"${c}"=$${i + 1}`);
    vals.push(id);
    const r = await pg.query(`UPDATE products SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    return r.rows[0];
  });

  ipcMain.handle('db:deleteProduct', async (_e: any, id: any) => {
    const r = await pg.query(`DELETE FROM products WHERE id=$1 RETURNING *`, [id]);
    return r.rows[0];
  });

  ipcMain.handle('db:seedInitialData', async () => {
    const r = await pg.query(`SELECT count(*)::int AS c FROM products`);
    return { success: true, count: r.rows[0].c };
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 650,
    title: 'OneLab Desktop Platform',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f172a', symbolColor: '#94a3b8', height: 38 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, webSecurity: false,
    },
    backgroundColor: '#020617', show: false,
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Tab awal dipilih lewat argumen: --view=app | tableEditor | sql
  // Dipakai ONELAB.bat agar satu exe melayani beberapa pintu masuk menu.
  const viewArg = process.argv.find(a => a.startsWith('--view='));
  const view = viewArg ? viewArg.split('=')[1] : '';
  const query = view ? `?view=${encodeURIComponent(view)}` : '';

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) await mainWindow.loadURL(`http://localhost:5173/${query}`);
  else await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'),
                                 view ? { search: query } : undefined);
}

app.whenReady().then(async () => {
  if (!ONELAB_PLATFORM_PATH) {
    console.error('[main] Folder platform OneLab tidak ditemukan. ' +
      'Setel ONELAB_PLATFORM_PATH ke folder berisi index.html, atau jalankan lewat ONELAB.bat.');
  }
  console.log(`[main] platform: ${ONELAB_PLATFORM_PATH || '(tidak ketemu)'}`);
  console.log(`[main] data    : ${PGLITE_DATA_DIR}`);
  startLocalPlatformServer();
  registerIpc();
  try {
    const eng = await createEngine({ platformDir: ONELAB_PLATFORM_PATH, dataDir: PGLITE_DATA_DIR, port: ENGINE_PORT, log: console.log });
    pg = eng.pg;
  } catch (err) {
    console.error('[main] gagal start local engine:', err);
  }
  await createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
