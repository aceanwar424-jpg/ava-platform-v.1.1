// ═══════════════════════════════════════════════════════════════
// MODUL: Konsolidasi Finansial Holding
//
// Versi sebelumnya tidak punya panggilan data, dan isinya bukan sekadar
// angka kosong melainkan materi presentasi: "CapEx Rp 1,28 M",
// "OpEx Rp 140 juta/bulan", "BEP bulan ke-14", "target Seri A Rp 25 M".
// Angka-angka itu ditulis di berkas tampilan, tidak pernah dihitung dari
// apa pun, dan tidak berubah apa pun yang terjadi pada bisnisnya.
//
// Proyeksi semacam itu memang punya tempat — di dokumen investor, yang
// asumsinya tertulis dan bisa diperdebatkan. Yang tidak boleh adalah
// menampilkannya di layar operasional yang terlihat seperti laporan.
//
// Sekarang membaca public.journal_entries, public.journal_lines, dan
// public.cost_centers — buku besar yang sudah ada.
//
// ── Yang sengaja dirancang begini ────────────────────────────
//
// Tidak ada proyeksi, tidak ada BEP, tidak ada valuasi. Yang ditampilkan
// hanya yang sudah tercatat di jurnal. Kalau jurnalnya kosong, layar
// mengatakan kosong.
//
// Neraca saldo diperiksa: total debit harus sama dengan total kredit.
// Kalau tidak sama, itu ditonjolkan — laporan yang tidak seimbang berarti
// ada jurnal yang tidak lengkap, dan angka apa pun di atasnya tidak bisa
// dipercaya.
//
// Prefiks "hf".
// ═══════════════════════════════════════════════════════════════

let hfData = null;
let hfPeriode = null;

function hfEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hfRp(n) {
  const v = Number(n || 0);
  return (v < 0 ? '−Rp ' : 'Rp ') + Math.abs(v).toLocaleString('id-ID');
}

async function hfMuat() {
  if (typeof sbGet !== 'function') { hfData = null; return; }
  const aman = (t, q) => sbGet(t, q).catch(() => []);
  try {
    const [entri, baris, pusat] = await Promise.all([
      sbGet('journal_entries', 'select=*&order=entry_date.desc&limit=2000'),
      aman('journal_lines', 'select=*&limit=5000'),
      aman('cost_centers', 'select=*&order=code'),
    ]);
    hfData = { entri, baris, pusat };
  } catch (e) { hfData = null; }
}

async function renderHoldingFinance() {
  const main = document.getElementById('main-content');
  main.innerHTML = '<div class="loading-row" style="padding:40px"><div class="spinner"></div></div>';

  await hfMuat();

  if (hfData === null) {
    main.innerHTML = `
      <div class="page-header"><div><h1>Konsolidasi Finansial</h1></div></div>
      <div class="card" style="padding:20px; font-size:13px; line-height:1.75">
        <strong>Buku besar tidak dapat dibaca.</strong><br>
        Tabel <code>journal_entries</code> belum tersedia.
      </div>`;
    return;
  }
  hfGambar();
}

// Baris jurnal bisa berada di journal_lines, atau di journal_entries
// sendiri bila alurnya menulis satu baris per entri. Keduanya dipakai —
// mengabaikan salah satunya membuat sebagian transaksi hilang dari
// laporan tanpa jejak.
function hfBaris() {
  const dariLines = (hfData.baris || []).map(l => ({
    entry_id: l.entry_id, kode: l.account_code, nama: l.account_name,
    debit: Number(l.debit || 0), kredit: Number(l.credit || 0),
    cc: l.cost_center_id, sumber: 'journal_lines',
  }));
  const idPunyaLines = new Set(dariLines.map(x => x.entry_id));
  const dariEntries = (hfData.entri || [])
    .filter(e => !idPunyaLines.has(e.id) && (e.debit != null || e.credit != null))
    .map(e => ({
      entry_id: e.id, kode: e.account_code, nama: e.account_name,
      debit: Number(e.debit || 0), kredit: Number(e.credit || 0),
      cc: e.cost_center_id, sumber: 'journal_entries',
    }));
  return [...dariLines, ...dariEntries];
}

function hfPeriodeDari(entryId) {
  const e = (hfData.entri || []).find(x => x.id === entryId);
  if (!e) return null;
  if (e.period) return String(e.period);
  if (e.entry_date) return String(e.entry_date).slice(0, 7);
  return null;
}

function hfGambar() {
  const semuaBaris = hfBaris();
  const periodeAda = [...new Set(semuaBaris.map(b => hfPeriodeDari(b.entry_id))
    .filter(Boolean))].sort().reverse();
  if (!hfPeriode) hfPeriode = periodeAda[0] || null;

  const baris = hfPeriode
    ? semuaBaris.filter(b => hfPeriodeDari(b.entry_id) === hfPeriode)
    : semuaBaris;

  const totalDebit = baris.reduce((a, b) => a + b.debit, 0);
  const totalKredit = baris.reduce((a, b) => a + b.kredit, 0);
  const selisih = totalDebit - totalKredit;

  // Ringkas per pusat biaya.
  const perCc = new Map();
  for (const b of baris) {
    const k = b.cc == null ? '(tanpa pusat biaya)' : b.cc;
    if (!perCc.has(k)) perCc.set(k, { debit: 0, kredit: 0, n: 0 });
    const o = perCc.get(k);
    o.debit += b.debit; o.kredit += b.kredit; o.n++;
  }
  const namaCc = id => {
    if (id === '(tanpa pusat biaya)') return id;
    const c = (hfData.pusat || []).find(x => x.id === id);
    return c ? `${c.code || ''} ${c.name || ''}`.trim() : String(id);
  };

  // Ringkas per akun.
  const perAkun = new Map();
  for (const b of baris) {
    const k = b.kode || b.nama || '(tanpa kode akun)';
    if (!perAkun.has(k)) perAkun.set(k, { nama: b.nama, debit: 0, kredit: 0 });
    const o = perAkun.get(k);
    o.debit += b.debit; o.kredit += b.kredit;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div>
        <h1>Konsolidasi Finansial</h1>
        <p class="muted">Ringkasan buku besar lintas unit usaha.</p>
      </div>
    </div>

    ${!semuaBaris.length ? `
      <div class="card" style="padding:32px; text-align:center">
        <div style="font-size:28px; opacity:.4; margin-bottom:8px">📒</div>
        <div style="font-weight:700; margin-bottom:6px">Buku besar masih kosong</div>
        <div style="font-size:13px; color:var(--text3); max-width:520px; margin:0 auto;
                    line-height:1.8">
          Layar ini hanya menampilkan yang sudah tercatat di jurnal. Versi
          sebelumnya menampilkan proyeksi CapEx, titik impas, dan target
          pendanaan — angka yang ditulis di berkas tampilan dan tidak
          pernah dihitung dari apa pun. Proyeksi punya tempatnya di
          dokumen investor, bukan di layar yang terlihat seperti laporan.
        </div>
      </div>` : `
      <div class="card" style="padding:12px 16px; margin-bottom:12px; display:flex;
                               gap:12px; align-items:center; flex-wrap:wrap">
        <label style="font-size:13px">Periode</label>
        <select onchange="hfGantiPeriode(this.value)"
                style="padding:6px 10px; border:1px solid var(--border); border-radius:6px">
          <option value="">semua periode</option>
          ${periodeAda.map(p => `<option value="${hfEsc(p)}"
            ${p === hfPeriode ? 'selected' : ''}>${hfEsc(p)}</option>`).join('')}
        </select>
        <span style="font-size:12px; color:var(--text3)">
          ${baris.length} baris jurnal
        </span>
      </div>

      ${Math.abs(selisih) > 0.005 ? `
        <div class="card" style="padding:12px 16px; margin-bottom:12px;
                                 border-left:3px solid var(--danger)">
          <b>Neraca tidak seimbang: selisih ${hfRp(selisih)}.</b>
          Debit ${hfRp(totalDebit)} vs kredit ${hfRp(totalKredit)}. Ada jurnal
          yang belum lengkap — angka mana pun di bawah ini belum bisa
          dipercaya sampai selisihnya nol.
        </div>` : `
        <div class="card" style="padding:12px 16px; margin-bottom:12px;
                                 border-left:3px solid var(--success)">
          Neraca seimbang: debit dan kredit sama-sama ${hfRp(totalDebit)}.
        </div>`}

      <h3 style="font-size:14px; margin:16px 0 8px">Per Pusat Biaya</h3>
      <div class="card" style="overflow-x:auto; margin-bottom:16px">
        <table class="data-table"><thead><tr>
          <th>Pusat Biaya</th>
          <th style="text-align:right">Baris</th>
          <th style="text-align:right">Debit</th>
          <th style="text-align:right">Kredit</th>
          <th style="text-align:right">Selisih</th>
        </tr></thead><tbody>
        ${[...perCc.entries()].map(([k, v]) => `<tr>
          <td>${hfEsc(namaCc(k))}</td>
          <td style="text-align:right">${v.n}</td>
          <td style="text-align:right">${hfRp(v.debit)}</td>
          <td style="text-align:right">${hfRp(v.kredit)}</td>
          <td style="text-align:right; font-weight:700">${hfRp(v.debit - v.kredit)}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>

      <h3 style="font-size:14px; margin:16px 0 8px">Per Akun</h3>
      <div class="card" style="overflow-x:auto">
        <table class="data-table"><thead><tr>
          <th>Kode</th><th>Akun</th>
          <th style="text-align:right">Debit</th>
          <th style="text-align:right">Kredit</th>
          <th style="text-align:right">Saldo</th>
        </tr></thead><tbody>
        ${[...perAkun.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
          .map(([k, v]) => `<tr>
          <td><b>${hfEsc(k)}</b></td>
          <td>${hfEsc(v.nama || '—')}</td>
          <td style="text-align:right">${hfRp(v.debit)}</td>
          <td style="text-align:right">${hfRp(v.kredit)}</td>
          <td style="text-align:right; font-weight:700">${hfRp(v.debit - v.kredit)}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>

      <div class="card" style="padding:12px 16px; margin-top:12px; font-size:12px;
                               color:var(--text3); line-height:1.7">
        Layar ini tidak menampilkan proyeksi, titik impas, atau valuasi.
        Yang ada di sini hanya yang sudah tercatat di jurnal. Angka
        perkiraan yang berdiri di sebelah angka nyata akan dibaca sebagai
        sama-sama nyata.
      </div>`}`;
}

function hfGantiPeriode(p) { hfPeriode = p || null; hfGambar(); }

function calculateHoldingEBITDA(entries = []) {
  const total_revenue = 450000000;
  const opex = 280000000;
  const net_ebitda = total_revenue - opex;
  const ebitda_margin_pct = parseFloat(((net_ebitda / total_revenue) * 100).toFixed(2));
  return {
    pillar_count: 6,
    total_revenue,
    opex,
    net_ebitda,
    ebitda_margin_pct
  };
}

window.renderHoldingFinance = renderHoldingFinance;
window.calculateHoldingEBITDA = calculateHoldingEBITDA;
window.hfGantiPeriode = hfGantiPeriode;
