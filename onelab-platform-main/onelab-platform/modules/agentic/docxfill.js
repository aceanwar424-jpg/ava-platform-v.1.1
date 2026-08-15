// ═══════════════════════════════════════════════════════════════
// AGENTIC — MESIN PERAKIT .DOCX (Fase 7D)
// Fidelity 100%: clone master .docx (ZIP), ganti {{PLACEHOLDER}} pada
// word/document.xml + header*.xml + footer*.xml, salin utuh semua entri
// lain (style, header/footer, font, gambar). Header/footer/margin/spasi
// TIDAK disentuh → identik dengan master.
//
// Pendekatan: hanya replace teks di dalam batas {{ }}; nama placeholder
// yang terpecah antar-run Word tetap terbaca (tag di dalamnya dibuang saat
// mengambil nama). Newline nilai → <w:br/> agar tetap satu paragraf.
//
// Ekspor global: agDocxFill(arrayBuffer, replacements) → Uint8Array (.docx)
// ═══════════════════════════════════════════════════════════════

// ── CRC32 (wajib untuk header ZIP) ───────────────────────────────
const _agCrcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function agCrc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _agCrcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── Baca SEMUA entri ZIP dari central directory ──────────────────
function agZipRead(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Bukan file .docx/ZIP valid');
  const cdCount = dv.getUint16(eocd + 10, true);
  let cdOfs = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let n = 0; n < cdCount; n++) {
    if (dv.getUint32(cdOfs, true) !== 0x02014b50) break;
    const method = dv.getUint16(cdOfs + 10, true);
    const crc = dv.getUint32(cdOfs + 16, true);
    const compSize = dv.getUint32(cdOfs + 20, true);
    const uncompSize = dv.getUint32(cdOfs + 24, true);
    const nameLen = dv.getUint16(cdOfs + 28, true);
    const extraLen = dv.getUint16(cdOfs + 30, true);
    const cmtLen = dv.getUint16(cdOfs + 32, true);
    const lhOfs = dv.getUint32(cdOfs + 42, true);
    const name = new TextDecoder().decode(buf.subarray(cdOfs + 46, cdOfs + 46 + nameLen));
    // Posisi data dari LOCAL header (panjang name/extra bisa beda dgn central)
    const lhNameLen = dv.getUint16(lhOfs + 26, true);
    const lhExtraLen = dv.getUint16(lhOfs + 28, true);
    const dataStart = lhOfs + 30 + lhNameLen + lhExtraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);
    entries.push({ name, method, crc, compSize, uncompSize, compData });
    cdOfs += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

async function agInflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined')
    throw new Error('Browser tidak mendukung DecompressionStream — gunakan Chrome/Edge terbaru');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ── Tulis ZIP (entri termodifikasi = STORED; sisanya disalin apa adanya) ──
function agZipWrite(entries) {
  const enc = new TextEncoder();
  const chunks = []; let offset = 0; const central = [];
  const push = (u8) => { chunks.push(u8); offset += u8.length; };
  const u16 = (v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xFFFF, true); return b; };
  const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; };
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const lhOfs = offset;
    push(u32(0x04034b50)); push(u16(20)); push(u16(0)); push(u16(e.method));
    push(u16(0)); push(u16(0));                       // time, date
    push(u32(e.crc)); push(u32(e.compSize)); push(u32(e.uncompSize));
    push(u16(nameBytes.length)); push(u16(0));         // name len, extra len
    push(nameBytes); push(e.compData);
    central.push({ e, lhOfs, nameBytes });
  }
  const cdStart = offset;
  for (const { e, lhOfs, nameBytes } of central) {
    push(u32(0x02014b50)); push(u16(20)); push(u16(20)); push(u16(0)); push(u16(e.method));
    push(u16(0)); push(u16(0));
    push(u32(e.crc)); push(u32(e.compSize)); push(u32(e.uncompSize));
    push(u16(nameBytes.length)); push(u16(0)); push(u16(0)); // name, extra, comment
    push(u16(0)); push(u16(0)); push(u32(0));                // disk, int/ext attr
    push(u32(lhOfs)); push(nameBytes);
  }
  const cdSize = offset - cdStart;
  push(u32(0x06054b50)); push(u16(0)); push(u16(0));
  push(u16(central.length)); push(u16(central.length));
  push(u32(cdSize)); push(u32(cdStart)); push(u16(0));
  let total = 0; for (const c of chunks) total += c.length;
  const out = new Uint8Array(total); let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

function agXmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Ganti {{KEY}} → nilai. Nama placeholder yang terpecah antar-run tetap terbaca
// (tag XML di dalamnya dibuang). Newline → <w:br/>. Placeholder tak dikenal dibiarkan.
// Word memecah teks ke banyak <w:r>/<w:t>, dan tag XML dapat jatuh DI TENGAH
// pasangan kurung — termasuk di antara dua "}" penutup. Pola lama menuntut "}}"
// berdampingan, sehingga penutup yang benar terlewat dan cocokan lari ke "}}"
// berikutnya: nama placeholder jadi rusak (ikut menelan teks penjelas di
// belakangnya) dan penggantian tidak pernah cocok. Pola ini mengizinkan tag di
// antara kedua "{" maupun kedua "}".
// Dibuat sebagai fungsi, bukan konstanta, agar lastIndex regex global tidak
// terbawa antar pemakaian.
function agPhRegex() { return /\{(?:<[^>]+>)*\{([\s\S]*?)\}(?:<[^>]+>)*\}/g; }

function agFillPlaceholders(xml, repl) {
  return xml.replace(agPhRegex(), (m, inner) => {
    const key = inner.replace(/<[^>]+>/g, '').trim();
    if (Object.prototype.hasOwnProperty.call(repl, key)) {
      return agXmlEscape(repl[key]).replace(/\r?\n/g, '</w:t><w:br/><w:t>');
    }
    return m;
  });
}

// Entri XML yang boleh diisi (body + header + footer)
const AG_DOCX_TARGET = /^word\/(document\.xml|header\d*\.xml|footer\d*\.xml)$/i;

// Ambil word/document.xml mentah dari sebuah .docx — dipakai pratinjau agar
// tidak perlu merakit ulang seluruh ZIP hanya untuk melihat isinya.
async function agDocxDocumentXml(arrayBuffer) {
  const src = new Uint8Array(arrayBuffer);
  for (const e of agZipRead(src)) {
    if (!/^word\/document\.xml$/i.test(e.name)) continue;
    let bytes = e.compData;
    if (e.method === 8) bytes = await agInflateRaw(e.compData);
    else if (e.method !== 0) throw new Error('Metode kompresi ZIP tak didukung: ' + e.method);
    return new TextDecoder().decode(bytes);
  }
  throw new Error('word/document.xml tidak ditemukan');
}

// UTAMA: isi master .docx dengan replacements → Uint8Array .docx baru
async function agDocxFill(arrayBuffer, replacements) {
  const src = new Uint8Array(arrayBuffer);
  const entries = agZipRead(src);
  const out = [];
  for (const e of entries) {
    if (AG_DOCX_TARGET.test(e.name)) {
      let bytes = e.compData;
      if (e.method === 8) bytes = await agInflateRaw(e.compData);
      else if (e.method !== 0) throw new Error('Metode kompresi ZIP tak didukung: ' + e.method);
      const xml = agFillPlaceholders(new TextDecoder().decode(bytes), replacements || {});
      const data = new TextEncoder().encode(xml);
      out.push({ name: e.name, method: 0, crc: agCrc32(data), compData: data, compSize: data.length, uncompSize: data.length });
    } else {
      out.push(e); // salin utuh (kompresi asli dipertahankan)
    }
  }
  return agZipWrite(out);
}

// Daftar placeholder yang benar-benar ada di master (untuk validasi UI)
async function agDocxScanPlaceholders(arrayBuffer) {
  const src = new Uint8Array(arrayBuffer);
  const found = new Set();
  for (const e of agZipRead(src)) {
    if (!AG_DOCX_TARGET.test(e.name)) continue;
    let bytes = e.compData;
    if (e.method === 8) bytes = await agInflateRaw(e.compData);
    else if (e.method !== 0) continue;
    const xml = new TextDecoder().decode(bytes);
    // Pola yang SAMA dengan mesin pengisi, supaya apa yang terpindai pasti dapat
    // diganti — kalau berbeda, pengguna melihat kolom yang ternyata tak pernah terisi.
    const re = agPhRegex(); let mm;
    while ((mm = re.exec(xml)) !== null) {
      const key = mm[1].replace(/<[^>]+>/g, '').trim();
      if (key) found.add(key);
    }
  }
  return [...found];
}

// Expose ke lingkungan non-module (node test / browser share global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { agDocxFill, agDocxScanPlaceholders, agZipRead, agZipWrite, agCrc32, agFillPlaceholders };
}
