// ═══════════════════════════════════════════
// CORE: Supabase Storage — File Upload Helper
// ═══════════════════════════════════════════

const STORAGE_URL = `${SUPABASE_URL}/storage/v1`;

const STORAGE_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

// Bucket names
const BUCKETS = {
  templates:  'templates',   // template surat, flyer, proposal
  voucherBg:  'voucher-bg',  // background image voucher
  documents:  'documents',   // dokumen umum
  avatars:    'avatars',
};

/**
 * Upload file ke Supabase Storage
 * @param {File} file - File object dari input
 * @param {string} bucket - nama bucket
 * @param {string} folder - subfolder opsional (misal: 'surat', 'voucher')
 * @returns {Object} { url, path, name, size, type }
 */
async function uploadFile(file, bucket = BUCKETS.documents, folder = '') {
  const ext     = file.name.split('.').pop().toLowerCase();
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path    = folder ? `${folder}/${safeName}` : safeName;

  const res = await fetch(`${STORAGE_URL}/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      ...STORAGE_HEADERS,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `Upload gagal: ${res.status}`);
  }

  const publicUrl = `${STORAGE_URL}/object/public/${bucket}/${path}`;
  return {
    url:    publicUrl,
    path:   path,
    name:   file.name,
    size:   file.size,
    type:   file.type,
    bucket: bucket,
  };
}

/**
 * Delete file dari Supabase Storage
 */
async function deleteFile(bucket, path) {
  const res = await fetch(`${STORAGE_URL}/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: STORAGE_HEADERS,
  });
  return res.ok;
}

/**
 * Render upload area yang bisa drag & drop
 * @param {string} inputId - id element input file
 * @param {string} previewId - id element preview
 * @param {string[]} accepts - array mime types
 * @param {Function} onUpload - callback setelah upload berhasil
 */
function renderUploadArea(inputId, previewId, accepts = [], onUpload = null) {
  const acceptStr = accepts.join(',');
  const acceptLabel = accepts.map(a => {
    if (a.includes('jpeg') || a.includes('png')) return 'JPG/PNG';
    if (a.includes('pdf'))  return 'PDF';
    if (a.includes('word') || a.includes('docx')) return 'DOC/DOCX';
    return a;
  }).filter((v,i,a) => a.indexOf(v)===i).join(', ');

  return `
    <div id="${previewId}-area"
      style="border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;background:var(--lgray)"
      onclick="document.getElementById('${inputId}').click()"
      ondragover="event.preventDefault();this.style.borderColor='var(--teal)';this.style.background='var(--mint)'"
      ondragleave="this.style.borderColor='var(--border)';this.style.background='var(--lgray)'"
      ondrop="handleFileDrop(event,'${inputId}','${previewId}')">
      <div style="font-size:32px;margin-bottom:8px">📁</div>
      <div style="font-size:13px;font-weight:600;color:var(--navy)">Klik atau drag & drop file di sini</div>
      <div style="font-size:12px;color:var(--gray);margin-top:4px">Format: ${acceptLabel} · Maks 50MB</div>
      <input type="file" id="${inputId}" accept="${acceptStr}" style="display:none"
        onchange="handleFileSelect(this,'${previewId}')">
    </div>
    <div id="${previewId}" style="display:none;margin-top:10px"></div>`;
}

function handleFileDrop(event, inputId, previewId) {
  event.preventDefault();
  const area = event.currentTarget;
  area.style.borderColor = 'var(--border)';
  area.style.background = 'var(--lgray)';
  const files = event.dataTransfer.files;
  if (files.length) {
    const input = document.getElementById(inputId);
    // Create DataTransfer to set files on input
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    input.files = dt.files;
    handleFileSelect(input, previewId);
  }
}

function handleFileSelect(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById(previewId);
  if (!preview) return;

  const isImage = file.type.startsWith('image/');
  const isPDF   = file.type === 'application/pdf';
  const isDoc   = file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx');

  const icon = isImage ? '🖼' : isPDF ? '📄' : isDoc ? '📝' : '📁';
  const size  = (file.size / 1024 / 1024).toFixed(2);

  preview.style.display = 'block';
  preview.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1.5px solid var(--border);border-radius:8px">
      ${isImage
        ? `<img src="${URL.createObjectURL(file)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px">`
        : `<div style="width:48px;height:48px;background:var(--lgray);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px">${icon}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${file.name}</div>
        <div style="font-size:11px;color:var(--gray)">${size} MB · ${file.type||'unknown'}</div>
      </div>
      <button onclick="clearFileInput('${input.id}','${previewId}')"
        style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--gray);padding:4px">✕</button>
    </div>`;
}

function clearFileInput(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (input) input.value = '';
  const preview = document.getElementById(previewId);
  if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
}

/**
 * Upload file dan return URL — used in form save handlers
 */
async function uploadAndGetUrl(inputId, bucket, folder = '') {
  const input = document.getElementById(inputId);
  if (!input || !input.files || !input.files[0]) return null;
  const result = await uploadFile(input.files[0], bucket, folder);
  return result;
}

/**
 * Render file preview dari URL yang sudah ada
 */
function renderExistingFile(url, name, type) {
  if (!url) return '';
  const isImage = type && type.startsWith('image/');
  const icon = isImage ? '' : type?.includes('pdf') ? '📄' : '📝';
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--lgray);border-radius:8px;margin-top:8px">
      ${isImage
        ? `<img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px">`
        : `<span style="font-size:20px">${icon}</span>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name||'File tersimpan'}</div>
      </div>
      <a href="${url}" target="_blank" class="act-btn" style="text-decoration:none">👁 Lihat</a>
    </div>`;
}
