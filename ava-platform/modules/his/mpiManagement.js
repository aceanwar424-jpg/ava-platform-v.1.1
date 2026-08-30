// ═══════════════════════════════════════════════════════════════
// MODULE: TATA KELOLA MASTER PERSON INDEX (MPI DEDUPLIKASI & MERGE)
// Standar PMK 24/2022 — Satu Pasien Satu AVA-ID Base32 Lintas Seluruh Entitas
// ═══════════════════════════════════════════════════════════════

let duplicateCandidates = [
  {
    duplicate_pair_id: 'DUP-2026-01',
    confidence_score: 95,
    match_reasons: ['NIK Sama (3174051506850002)', 'Nama Mirip (Budi Setiawan vs Budi S.)', 'Tgl Lahir Sama (1985-06-15)'],
    primary_candidate: {
      ava_id: 'AVA-7K3M2P9QX4',
      name: 'Tn. Budi Setiawan',
      nik: '3174051506850002',
      dob: '1985-06-15',
      phone: '081288990011',
      total_encounters: 8
    },
    secondary_candidate: {
      ava_id: 'AVA-7K3M2P9QX9',
      name: 'Budi S.',
      nik: '3174051506850002',
      dob: '1985-06-15',
      phone: '081288990011',
      total_encounters: 2
    },
    status: 'PENDING_REVIEW'
  }
];

let mergeHistory = [
  {
    merge_id: 'MRG-2026-001',
    master_ava_id: 'AVA-7K3M2P9QX4',
    subsumed_ava_id: 'AVA-9988776655',
    reason: 'Penggabungan duplikat pendaftaran offline & online',
    merged_by: 'dr. Sarah (Admin Medrec)',
    merged_at: '2026-08-25 14:20',
    audit_hash: 'SHA256:4b22...88a1'
  }
];

/**
 * Eksekusi penggabungan (Merge) pasien ganda ke 1 AVA-ID Primer
 */
function mergePatientRecords(masterAvaId, subsumedAvaId, operator = 'Admin Medrec') {
  if (!masterAvaId || !subsumedAvaId) {
    throw new Error('Master AVA-ID dan Subsumed AVA-ID wajib disertakan.');
  }

  if (masterAvaId === subsumedAvaId) {
    throw new Error('Tidak dapat menggabungkan ID yang sama.');
  }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const mergeId = `MRG-${new Date().getFullYear()}-${String(mergeHistory.length + 1).padStart(3, '0')}`;

  const mergeEntry = {
    merge_id: mergeId,
    master_ava_id: masterAvaId,
    subsumed_ava_id: subsumedAvaId,
    reason: 'Penggabungan profil duplikat identitas',
    merged_by: operator,
    merged_at: now,
    audit_hash: `SHA256:MERGE_${masterAvaId}_${subsumedAvaId}_${Date.now()}`
  };

  mergeHistory.unshift(mergeEntry);

  // Update status kandidat jika ada
  const cand = duplicateCandidates.find(c => c.primary_candidate.ava_id === masterAvaId || c.secondary_candidate.ava_id === subsumedAvaId);
  if (cand) cand.status = 'MERGED_RESOLVED';

  return {
    success: true,
    merge_entry: mergeEntry,
    message: `Pasien ${subsumedAvaId} berhasil digabungkan ke profil primer ${masterAvaId}.`
  };
}

async function renderMpiManagement() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div style="padding:20px; font-family:'Plus Jakarta Sans',sans-serif;">
      <div class="page-header">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.3); padding:2px 8px; border-radius:999px; font-size:11px; font-weight:800; color:#0ea5e9; margin-bottom:6px;">
            🪪 MASTER PERSON INDEX &bull; PMK 24/2022
          </div>
          <h1 style="font-size:22px; font-weight:800; color:var(--text); margin:0 0 4px 0;">
            Deduplikasi &amp; Manajemen Master Person Index (MPI)
          </h1>
          <p style="font-size:13px; color:var(--text3); margin:0;">
            Deteksi otomatis profil pasien ganda dan penggabungan rekam medis ke satu identitas unik AVA-ID Base32.
          </p>
        </div>
      </div>

      <div class="card" style="padding:20px; margin-top:16px;">
        <h3 style="font-size:15px; font-weight:800; margin-bottom:12px;">Kandidat Pasien Duplikat Terdeteksi AI</h3>
        ${duplicateCandidates.map(c => `
          <div style="background:var(--bg2); padding:16px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(245,158,11,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <b style="color:var(--text);">Skor Kecocokan: <span style="color:#f59e0b;">${c.confidence_score}%</span></b>
              <span class="badge ${c.status === 'MERGED_RESOLVED' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
            </div>
            <div style="font-size:12px; color:var(--text3); margin-bottom:10px;">
              Alasan: ${c.match_reasons.join(' &bull; ')}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:12px;">
              <div style="background:var(--bg); padding:10px; border-radius:6px;">
                <b style="color:var(--sky);">Profil Primer: ${c.primary_candidate.name}</b>
                <div>AVA-ID: <code>${c.primary_candidate.ava_id}</code></div>
                <div>NIK: ${c.primary_candidate.nik} &bull; ${c.primary_candidate.total_encounters} Kunjungan</div>
              </div>
              <div style="background:var(--bg); padding:10px; border-radius:6px;">
                <b style="color:#ef4444;">Profil Duplikat: ${c.secondary_candidate.name}</b>
                <div>AVA-ID: <code>${c.secondary_candidate.ava_id}</code></div>
                <div>NIK: ${c.secondary_candidate.nik} &bull; ${c.secondary_candidate.total_encounters} Kunjungan</div>
              </div>
            </div>
            ${c.status === 'PENDING_REVIEW' ? `
              <button class="btn btn-teal btn-sm" style="margin-top:12px;" onclick="
                mergePatientRecords('${c.primary_candidate.ava_id}', '${c.secondary_candidate.ava_id}');
                renderMpiManagement();
              ">🔗 Gabungkan Rekam Medis (Merge to Primary)</button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderMpiManagement = renderMpiManagement;
  window.mergePatientRecords = mergePatientRecords;
  window.duplicateCandidates = duplicateCandidates;
  window.mergeHistory = mergeHistory;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderMpiManagement,
    mergePatientRecords,
    duplicateCandidates,
    mergeHistory
  };
}
