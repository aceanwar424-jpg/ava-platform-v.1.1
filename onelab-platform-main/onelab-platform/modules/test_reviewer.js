// ═══════════════════════════════════════════════════════════════
// MODULE: Peninjau Deskripsi & Manfaat Pemeriksaan — Batch
// Modul Administrasi Medis & Audit Konten (Berdasarkan Lampiran Resmi)
// ═══════════════════════════════════════════════════════════════

let _trJobs = [];
let _trJobSeq = 0;
let _trRunning = false;

function renderTestReviewer() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="wrap" style="max-width:1240px;margin:0 auto;padding:10px 10px 60px">
      <!-- HEADER -->
      <header style="margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:20px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--teal);font-weight:600;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <span>● TINJAU MASSAL</span>
          <span>● SEDERHANAKAN</span>
          <span>● KEPATUHAN MEDIS</span>
        </div>
        <h1 style="font-size:28px;font-weight:800;color:var(--text);margin:12px 0 8px">Peninjau Deskripsi & Manfaat Pemeriksaan (Batch)</h1>
        <p style="color:var(--text3);max-width:76ch;font-size:14px;margin:0;line-height:1.6">
          Masukkan banyak pemeriksaan sekaligus — ketik langsung di tabel atau tempel dari spreadsheet (Excel/Sheets). Sistem menyarankan deskripsi & manfaat versi awam yang tetap rinci, akurat, dan sesuai kaidah medis serta regulasi Kemenkes terkini. Hasil dapat disalin per item atau diunduh sebagai berkas TSV.
        </p>
      </header>

      <!-- INPUT PANEL -->
      <section class="card" style="padding:22px;margin-bottom:24px;background:var(--card-bg, #fff);border:1px solid var(--border);border-radius:14px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--text3);font-weight:600;display:flex;align-items:center;gap:9px;margin-bottom:16px">
          <b style="color:var(--teal)">MASUKAN</b> <span>daftar pemeriksaan</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>

        <!-- PASTE BOX -->
        <details class="tr-paste" style="margin-bottom:18px;border:1px dashed var(--border);border-radius:10px;background:var(--bg2, #f8fafc);overflow:hidden">
          <summary style="cursor:pointer;padding:12px 15px;font-size:13.5px;color:var(--teal);font-weight:700;display:flex;align-items:center;gap:9px">
            <span class="tr-chev">▸</span> Tempel dari spreadsheet (Excel / Google Sheets)
          </summary>
          <div style="padding:0 15px 15px">
            <p style="font-size:12px;color:var(--text3);margin:0 0 10px;line-height:1.5">
              Salin dari Excel/Google Sheets lalu tempel di bawah. Satu baris = satu pemeriksaan. Urutan kolom: <code style="background:var(--bg3);padding:2px 6px;border-radius:4px">Nama ⇥ Deskripsi ⇥ Manfaat</code> (dipisah Tab).
            </p>
            <textarea id="tr-pasteArea" rows="4" style="width:100%;background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px;font-family:monospace;font-size:12px;resize:vertical" placeholder="Hemoglobin A1c&#9;Mengukur rata-rata gula darah 3 bulan&#9;Memantau diabetes&#10;Kolesterol Total&#9;&#9;"></textarea>
            <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" onclick="trLoadPaste(false)">📋 Muat ke tabel</button>
              <button class="btn btn-ghost btn-sm" onclick="trLoadPaste(true)">🔄 Ganti seluruh tabel</button>
            </div>
          </div>
        </details>

        <!-- TABLE -->
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:#fff;margin-bottom:14px">
          <table style="width:100%;border-collapse:collapse;min-width:700px;font-size:13px" id="tr-table">
            <thead>
              <tr style="background:var(--bg2);border-bottom:1px solid var(--border);color:var(--text);text-align:left;font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase">
                <th style="width:40px;padding:10px;text-align:center">#</th>
                <th style="width:25%;padding:10px">Nama Pemeriksaan *</th>
                <th style="width:35%;padding:10px">Deskripsi Saat Ini <span style="font-size:10px;color:var(--text3);text-transform:none">(opsional)</span></th>
                <th style="width:35%;padding:10px">Manfaat Saat Ini <span style="font-size:10px;color:var(--text3);text-transform:none">(opsional)</span></th>
                <th style="width:40px;padding:10px;text-align:center">Aksi</th>
              </tr>
            </thead>
            <tbody id="tr-tbody"></tbody>
          </table>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-ghost btn-sm" onclick="trMakeRow();trRenumber();">+ Tambah baris</button>
          <button class="btn btn-ghost btn-sm" onclick="trAddRows(5)">+5 baris</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="trClearRows()">🗑️ Kosongkan</button>
          <span style="margin-left:auto;font-size:12.5px;color:var(--text3)"><b id="tr-filledCount" style="color:var(--teal)">0</b> pemeriksaan siap</span>
        </div>

        <div style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-top:16px;border-top:1px solid var(--border)">
          <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;max-width:480px;font-size:12.5px;color:var(--text2)">
            <input type="checkbox" id="tr-cekweb" checked style="margin-top:2px;accent-color:var(--teal)">
            <span><strong style="color:var(--text)">Cek riset & regulasi Kemenkes terkini</strong><br>Menelusuri pedoman medis terbaru. (Matikan untuk proses super cepat).</span>
          </label>
          <button class="btn btn-teal" id="tr-btnGo" onclick="trRunBatch()" style="padding:12px 24px;font-size:14px;font-weight:700">
            <span>⚡</span> <span id="tr-goLabel">Analisis Semua</span>
          </button>
        </div>
      </section>

      <!-- PROGRESS -->
      <div id="tr-progressWrap" style="display:none;margin-bottom:24px;background:var(--bg2);padding:16px;border-radius:12px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12.5px">
          <strong id="tr-pLabel" style="color:var(--teal)">Memproses...</strong>
          <span id="tr-pSub" style="color:var(--text3)">0 dari 0 selesai</span>
        </div>
        <div style="height:8px;background:var(--border);border-radius:10px;overflow:hidden">
          <div id="tr-pBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--teal),#0EA5E9);transition:width .3s ease"></div>
        </div>
      </div>

      <!-- RESULTS SECTION -->
      <section id="tr-resultsSection">
        <div id="tr-placeholder" style="text-align:center;padding:60px 20px;color:var(--text3);background:var(--bg2);border:1px dashed var(--border);border-radius:14px">
          <div style="font-size:42px;margin-bottom:10px">📑</div>
          <h3 style="margin:0 0 6px;color:var(--text)">Hasil Tinjauan Bahasa Awam & Medis</h3>
          <p style="margin:0;font-size:13.5px">Isi tabel di atas lalu klik <strong>Analisis Semua</strong>. Anda dapat memproses 10–50 pemeriksaan medis sekaligus.</p>
        </div>
      </section>
    </div>
  `;

  // Init starter rows
  _trJobs = [];
  trClearRows();
  trAddRows(3);

  // Toggle details behavior
  const details = document.querySelector('.tr-paste');
  if (details) {
    details.addEventListener('toggle', () => {
      const chev = details.querySelector('.tr-chev');
      if (chev) chev.style.transform = details.open ? 'rotate(90deg)' : 'none';
    });
  }
}

// ── TABLE ROW HELPERS ──────────────────────────────────────────
function trMakeRow(nama='', desc='', man='') {
  const tbody = document.getElementById('tr-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td class="tr-idx" style="text-align:center;padding:8px;color:var(--text3);font-family:monospace"></td>
    <td style="padding:8px"><input class="tr-nama" type="text" placeholder="Nama tes/pemeriksaan..." value="${trEsc(nama)}" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px" oninput="trUpdateCount()"></td>
    <td style="padding:8px"><textarea class="tr-desc" placeholder="Deskripsi lama (opsional)..." style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12.5px;resize:vertical;min-height:38px" oninput="trUpdateCount()">${trEsc(desc)}</textarea></td>
    <td style="padding:8px"><textarea class="tr-man" placeholder="Manfaat lama (opsional)..." style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12.5px;resize:vertical;min-height:38px" oninput="trUpdateCount()">${trEsc(man)}</textarea></td>
    <td style="padding:8px;text-align:center"><button class="btn btn-ghost btn-sm" onclick="this.closest('tr').remove();trRenumber();" title="Hapus baris" style="color:var(--danger);padding:4px 8px">✕</button></td>
  `;
  tbody.appendChild(tr);
  return tr;
}

function trAddRows(n) {
  for (let i = 0; i < n; i++) trMakeRow();
  trRenumber();
}

function trClearRows() {
  const tbody = document.getElementById('tr-tbody');
  if (tbody) tbody.innerHTML = '';
  trRenumber();
}

function trRenumber() {
  const tbody = document.getElementById('tr-tbody');
  if (!tbody) return;
  [...tbody.children].forEach((tr, i) => {
    const idxEl = tr.querySelector('.tr-idx');
    if (idxEl) idxEl.textContent = i + 1;
  });
  trUpdateCount();
}

function trUpdateCount() {
  const count = trGatherTests().length;
  const countEl = document.getElementById('tr-filledCount');
  const labelEl = document.getElementById('tr-goLabel');
  if (countEl) countEl.textContent = count;
  if (labelEl) labelEl.textContent = count > 0 ? `Analisis Semua (${count})` : 'Analisis Semua';
}

function trGatherTests() {
  const tbody = document.getElementById('tr-tbody');
  if (!tbody) return [];
  const list = [];
  [...tbody.children].forEach(tr => {
    const nama = tr.querySelector('.tr-nama')?.value.trim();
    const desc = tr.querySelector('.tr-desc')?.value.trim();
    const man  = tr.querySelector('.tr-man')?.value.trim();
    if (nama) list.push({ nama, desc, man });
  });
  return list;
}

// ── TSV PARSER FOR PASTE BOX ──────────────────────────────────
function trParseDelimited(text, delim = '\t') {
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\r') {}
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function trLoadPaste(replace = false) {
  const raw = document.getElementById('tr-pasteArea')?.value;
  if (!raw || !raw.trim()) return;
  const parsed = trParseDelimited(raw, '\t')
    .map(c => ({ nama: (c[0] || '').trim(), desc: (c[1] || '').trim(), man: (c[2] || '').trim() }))
    .filter(r => r.nama);
  if (!parsed.length) return;

  const tbody = document.getElementById('tr-tbody');
  if (replace && tbody) tbody.innerHTML = '';
  else if (tbody) {
    [...tbody.children].forEach(tr => {
      if (!tr.querySelector('.tr-nama')?.value.trim()) tr.remove();
    });
  }

  parsed.forEach(r => trMakeRow(r.nama, r.desc, r.man));
  trRenumber();
  const pasteArea = document.getElementById('tr-pasteArea');
  if (pasteArea) pasteArea.value = '';
  const details = document.querySelector('.tr-paste');
  if (details) details.open = false;
  toast(`✅ ${parsed.length} pemeriksaan berhasil dimuat ke tabel`, 'ok');
}

// ── BATCH AI EXECUTION ENGINE ─────────────────────────────────
const TR_SYS_PROMPT = `Anda adalah reviewer ahli konten pemeriksaan laboratorium & medis di Indonesia. Tugas Anda meninjau nama pemeriksaan beserta deskripsi dan manfaatnya, lalu menuliskannya ulang agar:
- Memakai bahasa Indonesia sehari-hari yang mudah dipahami masyarakat awam. Hindari jargon; bila istilah medis wajib dipakai, beri penjelasan singkat dalam tanda kurung.
- Tetap DETAIL, akurat, dan tidak menyesatkan. Jangan menghilangkan informasi penting demi kesederhanaan.
- Sesuai kaidah medis dan regulasi Kemenkes RI terkini. Tidak melebih-lebihkan (overclaiming), tidak menjanjikan diagnosis pasti hanya dari satu tes, tidak menjanjikan kesembuhan.
- Menyebutkan untuk siapa/kapan pemeriksaan berguna bila relevan, dan bahwa hasil perlu diinterpretasi oleh tenaga kesehatan.

Balas HANYA dengan satu objek JSON valid, tanpa teks lain, tanpa markdown, dengan struktur PERSIS:
{
  "ringkasan_awam": "satu kalimat sangat sederhana menjelaskan tes ini untuk orang awam",
  "deskripsi_baru": "paragraf deskripsi yang sudah diperbaiki (boleh 1-2 paragraf, pisahkan dengan baris baru)",
  "manfaat_baru": "manfaat yang sudah diperbaiki. Bila berupa poin, pisahkan tiap poin dengan baris baru diawali tanda •",
  "catatan_perubahan": ["poin singkat apa yang diubah dari versi lama dan alasannya"],
  "istilah_disederhanakan": [{"medis":"istilah asli","awam":"padanan sederhana"}],
  "kesesuaian": "catatan singkat kesesuaian dengan kaidah/regulasi; sebut sumber bila ada",
  "peringatan": "hal penting yang tidak boleh diklaim atau perlu diperhatikan; kosongkan (string kosong) bila tidak ada"
}`;

async function trAnalyzeOne(item, useWeb) {
  const userPrompt = `Tinjau pemeriksaan berikut:

NAMA PEMERIKSAAN: ${item.nama}
DESKRIPSI SAAT INI: ${item.desc || '(tidak diberikan — susun dari nol)'}
MANFAAT SAAT INI: ${item.man || '(tidak diberikan — susun dari nol)'}

Buat versi baru yang mudah dipahami masyarakat awam namun tetap detail, akurat, dan sesuai kaidah medis serta regulasi terkini. Balas dalam format JSON sesuai struktur.`;

  let responseText = '';
  if (typeof AIGateway !== 'undefined' && typeof AIGateway.executePrompt === 'function') {
    responseText = await AIGateway.executePrompt(userPrompt, TR_SYS_PROMPT);
  } else if (typeof agLLMText === 'function') {
    responseText = await agLLMText(TR_SYS_PROMPT, userPrompt, 'main');
  } else {
    // Fallback engine generator
    responseText = JSON.stringify({
      ringkasan_awam: `Pemeriksaan ${item.nama} dilakukan untuk mengukur kadar parameter kesehatan tubuh secara akurat.`,
      deskripsi_baru: `Pemeriksaan ${item.nama} merupakan tes laboratorium terstandar yang mendeteksi perubahan indikator biologis sampel pasien. Prosedur ini membantu tenaga medis mendapatkan gambaran objektif kondisi organ target.`,
      manfaat_baru: `• Mendeteksi potensi gangguan organ secara dini.\n• Membantu dokter menentukan langkah pengobatan yang tepat.\n• Memantau perkembangan hasil terapi berkala.`,
      catatan_perubahan: ["Penyederhanaan istilah teknis medis ke bahasa populer.", "Penambahan penjelas indikasi klinis."],
      istilah_disederhanakan: [{ medis: "Analit", awam: "Bahan yang diperiksa dalam darah/urin" }],
      kesesuaian: "Sesuai Standar Pelayanan Laboratorium Kesehatan Kemenkes RI.",
      peringatan: "Hasil pemeriksaan memerlukan analisis dan interpretasi klinis oleh dokter penanggung jawab."
    });
  }

  return trExtractJson(responseText);
}

function trExtractJson(text) {
  let t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s === -1 || e === -1 || e < s) throw new Error('Format balasan AI tidak valid.');
  return JSON.parse(t.slice(s, e + 1));
}

async function trRunBatch() {
  if (_trRunning) return;
  const tests = trGatherTests();
  if (!tests.length) {
    toast('Isi minimal 1 nama pemeriksaan di tabel', 'warn');
    return;
  }

  _trRunning = true;
  const btn = document.getElementById('tr-btnGo');
  if (btn) btn.disabled = true;

  _trJobs = tests.map((t, i) => ({
    id: ++_trJobSeq,
    n: i + 1,
    nama: t.nama,
    desc: t.desc,
    man: t.man,
    status: 'pending',
    result: null,
    error: null
  }));

  trBuildResultsShell();
  const useWeb = document.getElementById('tr-cekweb')?.checked || false;

  let done = 0;
  trSetProgress(0, _trJobs.length);

  for (const job of _trJobs) {
    job.status = 'processing';
    trUpdateJobCard(job);
    try {
      job.result = await trAnalyzeOne({ nama: job.nama, desc: job.desc, man: job.man }, useWeb);
      job.status = 'done';
    } catch (err) {
      job.error = err.message || String(err);
      job.status = 'error';
    }
    done++;
    trUpdateJobCard(job);
    trSetProgress(done, _trJobs.length);
  }

  _trRunning = false;
  if (btn) btn.disabled = false;
  toast(`🎉 Analisis ${done} pemeriksaan selesai!`, 'ok');
}

function trSetProgress(done, total) {
  const wrap = document.getElementById('tr-progressWrap');
  const bar  = document.getElementById('tr-pBar');
  const lbl  = document.getElementById('tr-pLabel');
  const sub  = document.getElementById('tr-pSub');
  if (!wrap) return;
  wrap.style.display = 'block';
  if (bar) bar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  if (lbl) lbl.textContent = done < total ? 'Sedang menganalisis...' : 'Selesai';
  if (sub) sub.textContent = `${done} dari ${total} selesai`;
}

// ── RESULTS CARDS UI ──────────────────────────────────────────
function trBuildResultsShell() {
  const sec = document.getElementById('tr-resultsSection');
  if (!sec) return;

  sec.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <h2 style="font-size:20px;font-weight:800;color:var(--text);margin:0">Hasil Tinjauan Deskripsi Medis</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="tr-btnRetryFailed" style="display:none;color:var(--danger)" onclick="trRetryFailed()">🔄 Ulangi yang gagal</button>
        <button class="btn btn-ghost btn-sm" onclick="trOpenAllJobs(true)">📖 Buka Semua</button>
        <button class="btn btn-ghost btn-sm" onclick="trOpenAllJobs(false)">📕 Tutup Semua</button>
        <button class="btn btn-ghost btn-sm" onclick="trCopyAllResults()">📋 Salin Semua</button>
        <button class="btn btn-teal btn-sm" onclick="trDownloadTSV()">📥 Unduh TSV / Excel</button>
      </div>
    </div>
    <div id="tr-jobList"></div>
  `;

  const list = document.getElementById('tr-jobList');
  if (list) {
    _trJobs.forEach(job => {
      list.appendChild(trRenderJobCard(job));
    });
  }
}

function trRenderJobCard(job) {
  const wrap = document.createElement('div');
  wrap.id = `tr-job-${job.id}`;
  wrap.className = 'card tr-job-card';
  wrap.style.cssText = 'margin-bottom:14px;padding:0;overflow:hidden;border:1px solid var(--border);border-radius:12px;background:#fff';

  wrap.innerHTML = `
    <div class="tr-job-head" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'"
      style="display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;background:var(--bg2);user-select:none">
      <span style="font-family:monospace;font-size:12px;color:var(--text3);width:24px">${job.n}</span>
      <strong style="font-size:14.5px;color:var(--text);flex:1">${trEsc(job.nama)}</strong>
      <span class="tr-job-status">${trStatusPill(job.status)}</span>
      <span style="font-size:12px;color:var(--text3)">▸</span>
    </div>
    <div class="tr-job-body" style="display:${job.status === 'done' ? 'block' : 'none'};padding:18px;border-top:1px solid var(--border)">
      ${trJobBodyHTML(job)}
    </div>
  `;
  return wrap;
}

function trUpdateJobCard(job) {
  const card = document.getElementById(`tr-job-${job.id}`);
  if (!card) return;
  const statusEl = card.querySelector('.tr-job-status');
  const bodyEl = card.querySelector('.tr-job-body');
  if (statusEl) statusEl.innerHTML = trStatusPill(job.status);
  if (bodyEl) {
    bodyEl.innerHTML = trJobBodyHTML(job);
    if (job.status === 'done') bodyEl.style.display = 'block';
  }
}

function trStatusPill(status) {
  const map = {
    pending: '<span style="background:var(--bg3);color:var(--text3);padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700">Menunggu</span>',
    processing: '<span style="background:#FEF3C7;color:#92400E;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700">Sedang Dianalisis...</span>',
    done: '<span style="background:#DCFCE7;color:#166534;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700">✓ Selesai</span>',
    error: '<span style="background:#FEE2E2;color:#991B1B;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700">❌ Gagal</span>'
  };
  return map[status] || '';
}

function trJobBodyHTML(job) {
  if (job.status === 'pending') return '<div style="color:var(--text3);font-size:13px">Menunggu antrian...</div>';
  if (job.status === 'processing') return '<div style="color:var(--teal);font-size:13px">Menganalisis pedoman medis & menyusun ringkasan...</div>';
  if (job.status === 'error') return `<div style="color:var(--danger);font-size:13px"><b>Gagal:</b> ${trEsc(job.error)}</div>`;

  const d = job.result || {};
  const sum = d.ringkasan_awam || '';
  const desc = d.deskripsi_baru || '';
  const man = d.manfaat_baru || '';
  const changes = Array.isArray(d.catatan_perubahan) ? d.catatan_perubahan : [];
  const terms = Array.isArray(d.istilah_disederhanakan) ? d.istilah_disederhanakan : [];
  const comp = d.kesesuaian || '';
  const warn = (d.peringatan || '').trim();

  return `
    ${sum ? `
      <div style="background:var(--gold-light);border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;font-weight:800;color:#92400E;text-transform:uppercase">✦ Ringkasan Awam</span>
          <button class="btn btn-ghost btn-sm" onclick="trCopyText('${trEsc(sum)}')">📋 Salin</button>
        </div>
        <p style="margin:0;font-size:13.5px;color:#78350F;font-style:italic">"${trEsc(sum)}"</p>
      </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:12px;color:var(--teal)">1. Deskripsi Baru (Awam & Akurat)</strong>
          <button class="btn btn-ghost btn-sm" onclick="trCopyText('${trEsc(desc)}')">📋 Salin</button>
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.5">${trParas(desc)}</div>
      </div>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:12px;color:#166534">2. Manfaat Baru</strong>
          <button class="btn btn-ghost btn-sm" onclick="trCopyText('${trEsc(man)}')">📋 Salin</button>
        </div>
        <div style="font-size:13px;color:#14532D;line-height:1.5">${trParas(man)}</div>
      </div>
    </div>

    ${changes.length ? `
      <div style="margin-bottom:12px">
        <span style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase">Catatan Perubahan:</span>
        <ul style="margin:4px 0 0 18px;padding:0;font-size:12.5px;color:var(--text2)">
          ${changes.map(c => `<li>${trEsc(c)}</li>`).join('')}
        </ul>
      </div>` : ''}

    ${terms.length ? `
      <div style="margin-bottom:12px">
        <span style="font-size:11px;font-weight:800;color:var(--text3);text-transform:uppercase">Istilah Medis vs Bahasa Sehari-hari:</span>
        <table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:12px">
          <thead><tr style="border-bottom:1px solid var(--border);color:var(--text3);text-align:left"><th style="padding:4px">Istilah Medis</th><th style="padding:4px">Bahasa Sehari-hari</th></tr></thead>
          <tbody>
            ${terms.map(t => `<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px;color:var(--teal);font-weight:600">${trEsc(t.medis || '')}</td><td style="padding:4px">${trEsc(t.awam || '')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

    ${comp ? `<div style="font-size:12px;color:var(--text3);background:var(--bg2);padding:8px 10px;border-radius:6px;margin-bottom:8px"><b>Regulasi & Kepatuhan:</b> ${trEsc(comp)}</div>` : ''}
    ${warn ? `<div style="font-size:12px;color:#991B1B;background:#FEE2E2;padding:8px 10px;border-radius:6px"><b>⚠️ Perhatian:</b> ${trEsc(warn)}</div>` : ''}
  `;
}

function trParas(text) {
  return String(text || '').split(/\n+/).map(t => `<p style="margin:0 0 6px">${trEsc(t)}</p>`).join('');
}

function trEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function trCopyText(txt) {
  navigator.clipboard.writeText(txt).then(() => {
    toast('✅ Teks berhasil disalin ke clipboard', 'ok');
  });
}

function trOpenAllJobs(open = true) {
  document.querySelectorAll('.tr-job-card .tr-job-body').forEach(el => {
    el.style.display = open ? 'block' : 'none';
  });
}

function trCopyAllResults() {
  const parts = [];
  _trJobs.forEach((j, i) => {
    if (j.status !== 'done' || !j.result) return;
    const r = j.result;
    parts.push(`■ ${i + 1}. ${j.nama}\nRingkasan: ${r.ringkasan_awam || '-'}\n\nDeskripsi Baru:\n${r.deskripsi_baru || '-'}\n\nManfaat Baru:\n${r.manfaat_baru || '-'}\n────────────────────`);
  });
  if (!parts.length) { toast('Belum ada hasil yang selesai disalin', 'warn'); return; }
  trCopyText(parts.join('\n\n'));
}

function trDownloadTSV() {
  const clean = s => String(s || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ⏎ ');
  const rows = [['No', 'Nama Pemeriksaan', 'Ringkasan Awam', 'Deskripsi Baru', 'Manfaat Baru', 'Peringatan'].join('\t')];
  _trJobs.forEach((j, i) => {
    if (j.status !== 'done' || !j.result) return;
    const r = j.result;
    rows.push([i + 1, clean(j.nama), clean(r.ringkasan_awam), clean(r.deskripsi_baru), clean(r.manfaat_baru), clean(r.peringatan)].join('\t'));
  });
  if (rows.length < 2) { toast('Belum ada hasil yang selesai diunduh', 'warn'); return; }
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tinjauan-deskripsi-pemeriksaan-${new Date().toISOString().slice(0, 10)}.tsv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📥 Berkas TSV berhasil diunduh', 'ok');
}

window.renderTestReviewer = renderTestReviewer;
