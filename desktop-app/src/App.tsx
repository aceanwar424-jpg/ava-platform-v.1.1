import React, { useEffect, useState, useRef } from 'react';
import { Product, SqlResult, TableColumn, SitusPeta } from './types';
import { 
  Database, 
  FlaskConical, 
  Plus, 
  Search, 
  Trash2, 
  RefreshCw, 
  Layers, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle,
  X,
  Code2,
  Play,
  Terminal,
  Table as TableIcon,
  LayoutDashboard,
  ExternalLink,
  Sparkles,
  RotateCw,
  FolderTree,
  ChevronRight,
  Download,
  Filter,
  Smartphone
} from 'lucide-react';

type TabId = 'app' | 'portal' | 'connector' | 'tableEditor' | 'sql';

// Lab Connector berjalan sebagai layanan terpisah dan sudah menyajikan
// halaman status sendiri di porta ini. Tab di bawah membungkus halaman itu
// alih-alih membuat tampilan kedua yang harus ikut dirawat.
const CONNECTOR_URL = 'http://127.0.0.1:9999';

// Tab awal boleh ditentukan lewat ?view= (dikirim main.ts dari argumen --view=).
// Default 'app' supaya sekali klik langsung mendarat di sistem utama.
function initialTab(): TabId {
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'app' || v === 'portal' || v === 'connector' || v === 'tableEditor' || v === 'sql' ? v : 'app';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [products, setProducts] = useState<Product[]>([]);
  const [seeding, setSeeding] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Table Editor & Inspector States
  const [tablesList, setTablesList] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string>('Product');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');

  // Lab Connector — null = belum dicek, false = layanan mati
  const [connectorUp, setConnectorUp] = useState<boolean | null>(null);

  // SQL Runner States
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM Product LIMIT 50;');
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlRunning, setSqlRunning] = useState<boolean>(false);
  const [selectedSqlTable, setSelectedSqlTable] = useState<string>('Product');

  // Form Modal State (Product Add)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    kode_internal: '',
    kode_material: '',
    kategori: 'HEMATOLOGY',
    sub_kategori: 'ROUTINE',
    nama_tes: '',
    nama_singkat: '',
    harga_normal: '',
  });

  const fetchTables = async () => {
    if (window.api?.getTables) {
      const tbls = await window.api.getTables();
      setTablesList(tbls || ['Product', 'Transaction']);
    }
  };

  const loadTableDetails = async (tableName: string) => {
    setTableLoading(true);
    setActiveTable(tableName);
    try {
      if (window.api?.getTableData && window.api?.getTableColumns) {
        const [data, cols] = await Promise.all([
          window.api.getTableData(tableName),
          window.api.getTableColumns(tableName)
        ]);
        setTableData(data || []);
        setTableColumns(cols || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      if (window.api) {
        const data = await window.api.getProducts();
        setProducts(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchProducts();
    loadTableDetails('Product');
  }, []);

  const handleSelectSqlTable = (tableName: string) => {
    setSelectedSqlTable(tableName);
    const query = `SELECT * FROM "${tableName}" LIMIT 50;`;
    setSqlQuery(query);
    executeQuery(query);
  };

  const executeQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setSqlRunning(true);
    setSqlResult(null);
    try {
      if (window.api?.execSql) {
        const res = await window.api.execSql(queryText);
        setSqlResult(res);
        fetchTables();
        fetchProducts();
      }
    } catch (err: any) {
      setSqlResult({
        success: false,
        error: String(err)
      });
    } finally {
      setSqlRunning(false);
    }
  };

  // ── Bilah simulator subdomain ────────────────────────────────────────────
  //
  // Daftarnya DIBANGUN dari config/domain.json (lewat IPC platform:getSitus),
  // bukan ditulis ulang di sini. Dua daftar terpisah sudah pernah menyimpang:
  // simulator sempat punya corporate/crm/antrian yang tidak ada peta domainnya
  // — jadi jalan di simulator tapi 404 di produksi — sementara console punya
  // peta tapi tidak punya tombol.
  //
  // Alamatnya memakai <lokal>.localhost:5174, BUKAN 127.0.0.1:5174. Ini inti
  // gunanya: server statis memilih berkas masuk berdasarkan header Host, jadi
  // membuka path mentah di 127.0.0.1 melewati seluruh aturan subdomain yang
  // justru sedang ingin diuji. Peramban mengarahkan semua *.localhost ke
  // 127.0.0.1 tanpa perlu menyunting berkas hosts.
  const [situs, setSitus] = useState<SitusPeta[]>([]);
  const [platformPort, setPlatformPort] = useState<number>(5174);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.api?.getSitus?.();
        if (r?.situs?.length) { setSitus(r.situs); setPlatformPort(r.port || 5174); }
      } catch (err) { console.error('[simulator] peta domain tidak terbaca', err); }
    })();
  }, []);

  // Hiasan per subdomain: ikon, kelompok, dan warna aktif. Murni tampilan —
  // kunci yang tidak terdaftar di sini tetap muncul dengan gaya bawaan,
  // sehingga menambah subdomain di domain.json tidak menuntut sunting di sini.
  const HIAS: Record<string, { ico: string; grup: string; warna: string; label?: string }> = {
    ops:       { ico: '👑', grup: 'Holding',            warna: 'amber',   label: 'ops (CEO)' },
    tech:      { ico: '💻', grup: 'Holding',            warna: 'sky',     label: 'tech (SaaS)' },
    web:       { ico: '🌐', grup: 'Holding',            warna: 'teal',    label: 'web (SSO)' },
    console:   { ico: '🎛️', grup: 'Holding',            warna: 'violet',  label: 'console' },
    his:       { ico: '🩺', grup: 'Faskes & Lab',       warna: 'teal',    label: 'his (Klinik)' },
    lis:       { ico: '🔬', grup: 'Faskes & Lab',       warna: 'sky',     label: 'lis (Lab)' },
    sanctuary: { ico: '🏛️', grup: 'Faskes & Lab',       warna: 'amber',   label: 'sanctuary' },
    app:       { ico: '📱', grup: 'Consumer & B2B',     warna: 'sky',     label: 'apps (Pasien)' },
    corporate: { ico: '🏢', grup: 'Consumer & B2B',     warna: 'indigo',  label: 'corporate' },
    care:      { ico: '🌸', grup: 'Consumer & B2B',     warna: 'rose',    label: 'care (FMCG)' },
    nutri:     { ico: '🌿', grup: 'Consumer & B2B',     warna: 'amber',   label: 'nutri' },
    kiosk:     { ico: '🖥️', grup: 'Hardware & Monitor', warna: 'sky',     label: 'kiosk' },
    antrian:   { ico: '📺', grup: 'Hardware & Monitor', warna: 'amber',   label: 'antrian tv' },
    crm:       { ico: '📊', grup: 'Hardware & Monitor', warna: 'violet',  label: 'crm monitor' },
    nakes:     { ico: '🧑‍⚕️', grup: 'Hardware & Monitor', warna: 'teal',  label: 'nakes' },
    lacak:     { ico: '📍', grup: 'Hardware & Monitor', warna: 'teal',    label: 'lacak' },
  };
  const URUT_GRUP = ['Holding', 'Faskes & Lab', 'Consumer & B2B', 'Hardware & Monitor', 'Lainnya'];

  const SUB_APPS = situs.map(s => {
    const h = HIAS[s.kunci] || { ico: '🔗', grup: 'Lainnya', warna: 'slate' };
    return {
      id: s.kunci,
      name: s.nama || s.kunci,
      // Host lokal + '/' — berkas masuknya ditentukan server dari peta, sama
      // persis seperti yang akan terjadi di produksi.
      url: `http://${s.lokal}.localhost:${platformPort}/`,
      host: (s.host && s.host[0]) || `${s.lokal}.localhost`,
      masuk: s.masuk || '/',
      ket: s.keterangan || '',
      ico: h.ico, grup: h.grup, warna: h.warna,
      label: h.label || s.kunci,
    };
  });

  const [selectedSubAppId, setSelectedSubAppId] = useState<string>('web');
  const [deviceMode, setDeviceMode] = useState<'responsive' | 'mobile' | 'tablet'>('responsive');

  const subAppAktif = SUB_APPS.find(s => s.id === selectedSubAppId);
  const currentPreviewUrl = subAppAktif?.url || `http://web.localhost:${platformPort}/`;

  // Kelas ditulis utuh, bukan dirangkai (`bg-${warna}-500/20`). Tailwind
  // memindai kode sebagai teks; kelas yang baru terbentuk saat runtime tidak
  // pernah ikut terbangun, dan tombolnya akan tampil tanpa warna sama sekali.
  const WARNA_AKTIF: Record<string, string> = {
    amber:  'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm',
    sky:    'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm',
    teal:   'bg-teal-500/20 border-teal-500 text-teal-300 shadow-sm',
    rose:   'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm',
    indigo: 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-sm',
    violet: 'bg-violet-500/20 border-violet-500 text-violet-300 shadow-sm',
    slate:  'bg-slate-500/20 border-slate-500 text-slate-200 shadow-sm',
  };

  const kelasTombol = (id: string, warna: string) =>
    `flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border transition whitespace-nowrap ${
      selectedSubAppId === id
        ? (WARNA_AKTIF[warna] || WARNA_AKTIF.slate)
        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
    }`;

  // Cek apakah layanan connector hidup
  const probeConnector = async () => {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2500);
      const r = await fetch(`${CONNECTOR_URL}/api/status`, { signal: ac.signal });
      clearTimeout(t);
      setConnectorUp(r.ok);
    } catch { setConnectorUp(false); }
  };

  useEffect(() => { if (activeTab === 'connector') probeConnector(); }, [activeTab]);

  const handleReloadIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = currentPreviewUrl + (currentPreviewUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    }
  };

  const handleSeedData = async () => {
    if (!window.api) return;
    setSeeding(true);
    try {
      await window.api.seedDatabase();
      await fetchProducts();
      await loadTableDetails(activeTable);
    } catch (err) {
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return;
    try {
      if (window.api) {
        await window.api.deleteProduct(id);
        fetchProducts();
        loadTableDetails(activeTable);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kode_internal || !formData.nama_tes) {
      alert('Kode Internal dan Nama Tes wajib diisi!');
      return;
    }
    const dataProduk = {
      ...formData,
      harga_normal: parseFloat(formData.harga_normal) || 0,
    };
    try {
      if (window.api) {
        await window.api.createProduct(dataProduk);
        setIsModalOpen(false);
        setFormData({
          kode_internal: '',
          kode_material: '',
          kategori: 'HEMATOLOGY',
          sub_kategori: 'ROUTINE',
          nama_tes: '',
          nama_singkat: '',
          harga_normal: '',
        });
        fetchProducts();
        loadTableDetails(activeTable);
      }
    } catch (err) {
      alert('Gagal menyimpan data: ' + err);
    }
  };

  // Export Table Data to JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tableData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeTable}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter rows for Table Editor
  const filteredTableRows = tableData.filter((row) => {
    if (!tableSearch.trim()) return true;
    return Object.values(row).some((val) => 
      String(val).toLowerCase().includes(tableSearch.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 select-none font-sans">
      {/* ═══ MASTER ELECTRON TITLEBAR ═══ */}
      <div 
        className="h-12 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between px-4 text-xs shadow-md z-50"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Brand & Engine Badge */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <span className="text-slate-100 font-extrabold tracking-wide text-sm bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
              AVA GLOBAL ECOSYSTEM
            </span>
          </div>
          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
            ● PGLITE WASM ACTIVE
          </span>
        </div>

        {/* Primary Workspace Navigation Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
              activeTab === 'app' 
                ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-lg shadow-sky-900/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Simulator {SUB_APPS.length} Subdomain
          </button>
          <button
            onClick={() => setActiveTab('tableEditor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
              activeTab === 'tableEditor' 
                ? 'bg-sky-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Table Editor ({tablesList.length})
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
              activeTab === 'sql' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            SQL Studio
          </button>
          <button
            onClick={() => setActiveTab('connector')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
              activeTab === 'connector' 
                ? 'bg-amber-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Lab Connector (:9999)
          </button>
        </div>

        {/* Engine Status */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <span className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono font-bold bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5" /> 127.0.0.1:5174
          </span>
        </div>
      </div>

      {/* ═══ MAIN WORKSPACE VIEWPORT ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* TAB 1: UI SIMULATOR EKOSISTEM */}
        {activeTab === 'app' && (
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            {/* Subdomain Toolbar (Categorized & Modern) */}
            <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 flex flex-col gap-2 shadow-sm">
              {/* Row 1: Address Bar + Device Controls */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Simulated URL Address Bar */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/90 flex-1 max-w-2xl shadow-inner">
                  <span className="text-emerald-400 font-mono text-[11px] font-bold flex items-center gap-1">
                    🔒 https://
                  </span>
                  <select
                    value={selectedSubAppId}
                    onChange={(e) => setSelectedSubAppId(e.target.value)}
                    className="bg-transparent text-sky-300 font-mono font-bold text-xs focus:outline-none flex-1 cursor-pointer"
                  >
                    {URUT_GRUP.map((grup) => {
                      const anggota = SUB_APPS.filter((s) => s.grup === grup);
                      if (!anggota.length) return null;
                      return (
                        <optgroup key={grup} label={grup}>
                          {anggota.map((s) => (
                            <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                              {s.host} — {s.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                {/* Viewport Modes & Action Buttons */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setDeviceMode('responsive')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${deviceMode === 'responsive' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Desktop Full View"
                    >
                      🖥️ Desktop
                    </button>
                    <button
                      onClick={() => setDeviceMode('tablet')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${deviceMode === 'tablet' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Tablet iPad View"
                    >
                      💻 Tablet
                    </button>
                    <button
                      onClick={() => setDeviceMode('mobile')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${deviceMode === 'mobile' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Mobile Phone View"
                    >
                      📱 Mobile
                    </button>
                  </div>

                  <button
                    onClick={handleReloadIframe}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition active:scale-95"
                    title="Segarkan halaman simulasi"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                    Refresh
                  </button>
                  <a
                    href={currentPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-500/30 transition"
                    title="Buka di peramban sistem (Chrome/Edge)"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Tab Baru
                  </a>
                </div>
              </div>

              {/* Row 2: Subdomain Clusters (Grouped Pills) */}
              <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin">
                {SUB_APPS.length === 0 && (
                  <span className="text-[11px] text-slate-500 pl-1">
                    Memuat peta subdomain dari config/domain.json…
                  </span>
                )}
                {URUT_GRUP.map((grup) => {
                  const anggota = SUB_APPS.filter((s) => s.grup === grup);
                  if (!anggota.length) return null;
                  return (
                    <React.Fragment key={grup}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 whitespace-nowrap">
                        {grup}:
                      </span>
                      {anggota.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSubAppId(s.id)}
                          className={kelasTombol(s.id, s.warna)}
                          title={`${s.host} → ${s.masuk}${s.ket ? ' — ' + s.ket : ''}`}
                        >
                          {s.ico} {s.label}
                        </button>
                      ))}
                      <div className="h-3 w-px bg-slate-800 mx-1"></div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Simulation Canvas Viewport */}
            <div className="flex-1 w-full bg-slate-950 relative flex items-center justify-center p-3 overflow-hidden">
              <div 
                className={`transition-all duration-200 h-full flex flex-col ${
                  deviceMode === 'mobile'
                    ? 'w-[414px] max-w-[414px] rounded-[36px] border-[6px] border-slate-800 shadow-2xl overflow-hidden bg-slate-900 p-1.5'
                    : deviceMode === 'tablet'
                    ? 'w-[840px] max-w-[840px] rounded-[24px] border-[6px] border-slate-800 shadow-2xl overflow-hidden bg-slate-900 p-1.5'
                    : 'w-full rounded-xl border border-slate-800/80 shadow-xl overflow-hidden'
                }`}
              >
                {deviceMode !== 'responsive' && (
                  <div className="h-5 bg-slate-900 flex items-center justify-center">
                    <div className="w-20 h-1 bg-slate-700 rounded-full"></div>
                  </div>
                )}
                <iframe
                  key={selectedSubAppId}
                  ref={iframeRef}
                  src={currentPreviewUrl}
                  title="AVA GLOBAL ECOSYSTEM Simulator"
                  className="w-full flex-1 border-none bg-slate-950"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PORTAL APPS */}
        {activeTab === 'portal' && (
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-slate-200">Portal Apps:</span>
                <span className="text-slate-400">Pasien / Customer, Dokter Telehealth, Vendor Alkes</span>
              </div>
              <a
                href="http://127.0.0.1:5174/apps/index.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 px-3 py-1 rounded-lg text-xs font-medium border border-teal-500/30 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka di Tab Baru
              </a>
            </div>
            <div className="flex-1 w-full bg-slate-900 relative flex items-center justify-center p-4">
              <div className="w-[410px] h-full max-h-[840px] rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden bg-slate-900 flex flex-col">
                <div className="h-4 bg-slate-900 flex items-center justify-center">
                  <div className="w-16 h-1 bg-slate-700 rounded-full"></div>
                </div>
                <iframe
                  src="http://127.0.0.1:5174/apps/index.html"
                  title="AVA GLOBAL ECOSYSTEM Mobile Apps Portal"
                  className="w-full flex-1 border-none bg-slate-950"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LAB CONNECTOR — membungkus halaman status milik layanan itu sendiri */}
        {activeTab === 'connector' && (
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-200">Lab Connector:</span>
                <span className="font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                  {CONNECTOR_URL}
                </span>
                <span className={`flex items-center gap-1.5 text-[11px] font-mono ${
                  connectorUp ? 'text-emerald-400' : connectorUp === false ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {connectorUp ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {connectorUp ? 'Layanan aktif' : connectorUp === false ? 'Layanan mati' : 'Memeriksa...'}
                </span>
              </div>
              <button
                onClick={probeConnector}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 transition"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                Cek Ulang
              </button>
            </div>

            <div className="flex-1 w-full bg-slate-900 relative">
              {connectorUp ? (
                <iframe
                  src={CONNECTOR_URL}
                  title="AVA Lab Connector"
                  className="w-full h-full border-none bg-slate-950"
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="max-w-lg text-center">
                    <FlaskConical className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-slate-200 font-bold mb-2">
                      {connectorUp === false ? 'Layanan Lab Connector belum berjalan' : 'Memeriksa layanan...'}
                    </h3>
                    {connectorUp === false && (
                      <>
                        <p className="text-slate-400 text-sm mb-4">
                          Connector adalah jembatan yang menangkap kiriman hasil dari alat lab.
                          Ia berjalan sebagai layanan terpisah agar alat tetap terlayani
                          walaupun antarmuka desktop sedang ditutup.
                        </p>
                        <p className="text-slate-400 text-xs font-mono bg-slate-900 p-2.5 rounded border border-slate-800">
                          Nyalakan lewat <code>AVAPLATFORM.bat</code> atau jalankan manual:{' '}
                          <code className="text-amber-400">node ava-platform/connector/ava-connector.js</code>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: GUI TABLE EDITOR (SUPABASE TABLE EDITOR STYLE FOR ALL 178 TABLES) */}
        {activeTab === 'tableEditor' && (
          <div className="flex-1 flex overflow-hidden bg-slate-950">
            {/* Left Sidebar - Table Selector */}
            <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between p-3 select-none">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <FolderTree className="w-4 h-4 text-sky-400" />
                    <span>TABLE EDITOR ({tablesList.length})</span>
                  </div>
                  <button 
                    onClick={fetchTables}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
                    title="Refresh daftar tabel"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">Pilih Tabel Data</p>
                  {tablesList.length === 0 ? (
                    <div className="text-xs text-slate-500 px-2 py-2">Memuat tabel...</div>
                  ) : (
                    tablesList.map((tableName) => (
                      <button
                        key={tableName}
                        onClick={() => loadTableDetails(tableName)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition ${
                          activeTable === tableName
                            ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <TableIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="truncate">{tableName}</span>
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="glass-card p-3 rounded-lg border-sky-500/20 bg-sky-500/5 space-y-2 text-xs">
                <button
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white py-1.5 rounded text-[11px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
                  {seeding ? 'Importing...' : 'Sync 532 Produk Master'}
                </button>
              </div>
            </aside>

            {/* Main Data Table Workspace */}
            <div className="flex-1 flex flex-col p-5 overflow-hidden space-y-4">
              {/* Header & Controls */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
                    <TableIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 font-mono flex items-center gap-2">
                      {activeTable}
                      <span className="text-xs font-normal text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full font-sans">
                        {tableData.length} Baris Data
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      {tableColumns.length} Kolom Skema: {tableColumns.map(c => c.name).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={`Cari di tabel ${activeTable}...`}
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    onClick={handleExportJson}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
                    title="Export data tabel ke JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    Export JSON
                  </button>

                  {activeTable === 'Product' && (
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-lg shadow-sky-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Data
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table Grid */}
              <div className="flex-1 glass-panel rounded-xl overflow-hidden border border-slate-800 flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs text-slate-300 font-mono">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        {tableColumns.length === 0 ? (
                          <th className="p-3">Kolom</th>
                        ) : (
                          tableColumns.map((col) => (
                            <th key={col.cid} className="p-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{col.name}</span>
                                <span className="text-[10px] text-slate-500 font-normal lowercase bg-slate-950 px-1 rounded">
                                  {col.type || 'text'}
                                </span>
                              </div>
                            </th>
                          ))
                        )}
                        {activeTable === 'Product' && <th className="p-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {tableLoading ? (
                        <tr>
                          <td colSpan={tableColumns.length || 1} className="text-center py-12 text-slate-500">
                            Memuat data tabel {activeTable}...
                          </td>
                        </tr>
                      ) : filteredTableRows.length === 0 ? (
                        <tr>
                          <td colSpan={tableColumns.length || 1} className="text-center py-12 text-slate-500">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-sky-400" />
                            <p className="text-slate-300 font-semibold mb-1">Tabel {activeTable} Kosong</p>
                            {activeTable === 'Product' && (
                              <button
                                onClick={handleSeedData}
                                disabled={seeding}
                                className="mt-2 bg-sky-600 hover:bg-sky-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition"
                              >
                                {seeding ? 'Mengimpor Data...' : 'Import 532 Master Produk (Supabase SQL)'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredTableRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50 transition">
                            {tableColumns.map((col) => {
                              const val = row[col.name];
                              return (
                                <td key={col.cid} className="p-3 max-w-xs truncate whitespace-nowrap">
                                  {val === null || val === undefined ? (
                                    <span className="text-slate-600 italic">null</span>
                                  ) : typeof val === 'object' ? (
                                    JSON.stringify(val)
                                  ) : col.name === 'harga_normal' ? (
                                    <span className="text-emerald-400 font-semibold">
                                      Rp {Number(val).toLocaleString('id-ID')}
                                    </span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                            {activeTable === 'Product' && (
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteProduct(row.id)}
                                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUPABASE-STYLE SQL RUNNER & STUDIO */}
        {activeTab === 'sql' && (
          <div className="flex-1 flex overflow-hidden bg-slate-950">
            {/* Left Sidebar - DB Tables List */}
            <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between p-3 select-none">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <FolderTree className="w-4 h-4 text-purple-400" />
                    <span>DATABASE TABLES</span>
                  </div>
                  <button 
                    onClick={fetchTables}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
                    title="Refresh tabel"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">Daftar Tabel ({tablesList.length})</p>
                  {tablesList.length === 0 ? (
                    <div className="text-xs text-slate-500 px-2 py-2">Memuat tabel...</div>
                  ) : (
                    tablesList.map((tableName) => (
                      <button
                        key={tableName}
                        onClick={() => handleSelectSqlTable(tableName)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition ${
                          selectedSqlTable === tableName
                            ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <TableIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">{tableName}</span>
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* DB Quick Info */}
              <div className="glass-card p-3 rounded-lg border-purple-500/20 bg-purple-500/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-purple-400" /> Schema
                  </span>
                  <span className="font-mono text-purple-300 font-semibold">SQLite (dev.db)</span>
                </div>
                <button
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded text-[11px] font-bold transition disabled:opacity-50"
                >
                  {seeding ? 'Importing...' : '⚡ Sync 532 Data Master'}
                </button>
              </div>
            </aside>

            {/* Right Main SQL Editor & Execution Workspace */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* SQL Toolbar */}
              <div className="bg-slate-900/90 border-b border-slate-800 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-200">SQL Query Editor</span>
                  <span className="text-[11px] text-slate-500">(Supabase Console Offline)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const q = 'SELECT * FROM Product LIMIT 50;';
                      setSqlQuery(q);
                      executeQuery(q);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded border border-slate-700 font-mono"
                  >
                    SELECT Product
                  </button>
                  <button
                    onClick={() => {
                      const q = "PRAGMA table_info('Product');";
                      setSqlQuery(q);
                      executeQuery(q);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded border border-slate-700 font-mono"
                  >
                    Column Schema Info
                  </button>
                  <button
                    onClick={() => executeQuery(sqlQuery)}
                    disabled={sqlRunning}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {sqlRunning ? 'Running...' : 'Run SQL'}
                  </button>
                </div>
              </div>

              {/* Editor Workspace */}
              <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                {/* Textarea Editor */}
                <div className="h-44 bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col">
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="Tulis query SQL di sini (contoh: SELECT * FROM Product; atau CREATE TABLE ...)"
                    className="w-full flex-1 bg-transparent font-mono text-sm text-purple-300 focus:outline-none resize-none placeholder-slate-600"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
                    <span>Tekan "Run SQL" untuk mengeksekusi query.</span>
                    <span>Database: dev.db (SQLite)</span>
                  </div>
                </div>

                {/* Result Output Area */}
                <div className="flex-1 glass-panel border border-slate-800 rounded-xl flex flex-col overflow-hidden">
                  <div className="bg-slate-900/70 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Hasil Query ({sqlResult?.rowCount ?? 0} baris)</span>
                    {sqlResult?.executionTimeMs !== undefined && (
                      <span className="font-mono text-emerald-400">
                        Execution: {sqlResult.executionTimeMs} ms
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                    {!sqlResult ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                        <Terminal className="w-8 h-8 mb-2 opacity-40" />
                        Ketik query SQL di atas lalu klik "Run SQL"
                      </div>
                    ) : !sqlResult.success ? (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-mono text-xs space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-red-300">
                          <AlertCircle className="w-4 h-4" /> Error Execution:
                        </p>
                        <p className="whitespace-pre-wrap">{sqlResult.error}</p>
                      </div>
                    ) : sqlResult.isSelect && sqlResult.rows ? (
                      sqlResult.rows.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs py-8">
                          Query berhasil (0 baris data ditemukan).
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300 font-mono">
                            <thead className="bg-slate-900 text-slate-400 uppercase border-b border-slate-800">
                              <tr>
                                {Object.keys(sqlResult.rows[0]).map((key) => (
                                  <th key={key} className="p-3 font-semibold whitespace-nowrap">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {sqlResult.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-900/40">
                                  {Object.values(row).map((val: any, colIdx) => (
                                    <td key={colIdx} className="p-3 max-w-xs truncate whitespace-nowrap">
                                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Eksekusi SQL Sukses! Total {sqlResult.affectedStatements} statement berhasil di-run.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form Tambah Data */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" /> Tambah Data Tes Lab Baru
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Kode Internal *</label>
                  <input
                    type="text"
                    required
                    placeholder="ODL1001-RGN-0099"
                    value={formData.kode_internal}
                    onChange={(e) => setFormData({ ...formData, kode_internal: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Kategori</label>
                  <input
                    type="text"
                    required
                    placeholder="HEMATOLOGY"
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nama Tes Laboratorium *</label>
                <input
                  type="text"
                  required
                  placeholder="PEMERIKSAAN HEMOGLOBIN LENGKAP"
                  value={formData.nama_tes}
                  onChange={(e) => setFormData({ ...formData, nama_tes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nama Singkat / Inggris</label>
                <input
                  type="text"
                  placeholder="HEMOGLOBIN TEST"
                  value={formData.nama_singkat}
                  onChange={(e) => setFormData({ ...formData, nama_singkat: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Harga Normal (IDR)</label>
                <input
                  type="number"
                  placeholder="150000"
                  value={formData.harga_normal}
                  onChange={(e) => setFormData({ ...formData, harga_normal: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-semibold transition"
                >
                  Simpan ke SQLite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
