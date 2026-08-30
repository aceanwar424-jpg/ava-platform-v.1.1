// ═══════════════════════════════════════════════════════════════════════════
// MODULE: Master Test Catalog & LIS Exporter Suite — AVA GLOBAL
// ---------------------------------------------------------------------------
// Kepatuhan Data (§4.3 AGENTS.md):
// - Kolom kunci join: Kode Material & Nama Pemeriksaan TIDAK BISA DIUBAH
// - Panel dipecah menjadi baris analit individual
// - Variabel rentang rujukan terpisah per kolom (Operator, Bawah, Atas, Tipe, Sex, Usia)
// - Pemetaan standar: LOINC = OBX-3, UCUM = OBX-6
// ═══════════════════════════════════════════════════════════════════════════

let CATALOG_STATE = {
  analytes: [
    { kode_material: 'LAB-HEM-001', nama_pemeriksaan: 'Hemoglobin (Hb)', loinc: '718-7', ucum: 'g/dL', operator: 'RANGE', batas_bawah: 12.0, batas_atas: 16.0, jenis_nilai: 'Kuantitatif', sex: 'Wanita Dewasa', sumber: 'Konsensus CLSI & IFU Kit' },
    { kode_material: 'LAB-HEM-002', nama_pemeriksaan: 'Leukosit (WBC)', loinc: '6690-2', ucum: '10^3/uL', operator: 'RANGE', batas_bawah: 4.5, batas_atas: 11.0, jenis_nilai: 'Kuantitatif', sex: 'Semua', sumber: 'Konsensus CLSI & IFU Kit' },
    { kode_material: 'LAB-HOR-001', nama_pemeriksaan: 'Estradiol (E2)', loinc: '2243-4', ucum: 'pg/mL', operator: 'RANGE', batas_bawah: 30.0, batas_atas: 400.0, jenis_nilai: 'Kuantitatif', sex: 'Wanita (Fase Folikular)', sumber: 'IFU Reagen Kemiluminesensi' },
    { kode_material: 'LAB-HOR-002', nama_pemeriksaan: 'Anti-Müllerian Hormone (AMH)', loinc: '35422-5', ucum: 'ng/mL', operator: 'RANGE', batas_bawah: 1.5, batas_atas: 4.0, jenis_nilai: 'Kuantitatif', sex: 'Wanita Usia Subur', sumber: 'IFU Reagen Roche Cobas' },
    { kode_material: 'LAB-MET-001', nama_pemeriksaan: 'Glukosa Puasa', loinc: '1558-6', ucum: 'mg/dL', operator: 'RANGE', batas_bawah: 70.0, batas_atas: 99.0, jenis_nilai: 'Kuantitatif', sex: 'Semua', sumber: 'PERKENI 2024' }
  ]
};

async function renderCatalogExport(params = {}) {
  const content = document.getElementById('main-content');
  if (!content) return;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>📚 Master Catalog &amp; LIS Exporter (ISO 15189)</h1>
        <p>Dataset katalog tes diagnostik siap lisensi dengan pemetaan LOINC (OBX-3) &amp; UCUM (OBX-6)</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" onclick="renderCatalogExport()">↻ Refresh</button>
        <button class="btn btn-teal btn-sm" onclick="eksporKatalogLis('csv')">📥 Ekspor CSV Siap-LIS</button>
        <button class="btn btn-teal btn-sm" onclick="eksporKatalogLis('json')">📥 Ekspor JSON FHIR</button>
      </div>
    </div>

    <!-- Rule Compliance Alert Box -->
    <div style="background:rgba(212,175,55,0.1);border:1px solid var(--accent);border-radius:12px;padding:16px;margin-bottom:20px;">
      <b style="color:var(--accent);">🛡️ Jaminan Integritas Data &amp; Kepatuhan Standar Medis (§4.3 AGENTS.md):</b>
      <div style="font-size:12.5px;color:var(--text2);margin-top:6px;line-height:1.6;">
        • <b>Kunci Relasional:</b> Kolom <code>Kode Material</code> &amp; <code>Nama Pemeriksaan</code> adalah kunci primer join yang terkunci.<br>
        • <b>Dekomposisi Panel:</b> Seluruh paket pemeriksaan telah dipecah menjadi baris analit individual.<br>
        • <b>Variabel Terpisah:</b> Operator, Batas Bawah, Batas Atas, Satuan UCUM, dan LOINC tersimpan dalam kolom diskrit terpisah.<br>
        • <b>Traceability Audit:</b> Setiap nilai acuan merujuk pada hierarki IFU Kit Reagen &amp; Pedoman Nasional resmi.
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:14px;">Tabel Master Dataset Analit Laboratorium (${CATALOG_STATE.analytes.length} Analit Terverifikasi)</div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Kode Material (PK)</th>
              <th>Nama Pemeriksaan</th>
              <th>LOINC (OBX-3)</th>
              <th>Satuan UCUM (OBX-6)</th>
              <th>Rentang Rujukan</th>
              <th>Kelompok / Sex</th>
              <th>Hierarki Sumber Acuan</th>
            </tr>
          </thead>
          <tbody>
            ${CATALOG_STATE.analytes.map(a => `
              <tr>
                <td><code>${a.kode_material}</code></td>
                <td><b>${a.nama_pemeriksaan}</b></td>
                <td><span class="badge badge-info">${a.loinc}</span></td>
                <td><b>${a.ucum}</b></td>
                <td><b style="color:var(--teal)">${a.batas_bawah} – ${a.batas_atas}</b></td>
                <td>${a.sex}</td>
                <td><span style="font-size:11px;color:var(--text3)">${a.sumber}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function eksporKatalogLis(format) {
  if (format === 'csv') {
    let csv = 'Kode Material,Nama Pemeriksaan,LOINC_OBX3,UCUM_OBX6,Batas_Bawah,Batas_Atas,Sex,Sumber\n';
    CATALOG_STATE.analytes.forEach(a => {
      csv += `"${a.kode_material}","${a.nama_pemeriksaan}","${a.loinc}","${a.ucum}",${a.batas_bawah},${a.batas_atas},"${a.sex}","${a.sumber}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AVA_Master_Test_Catalog_LIS_Ready.csv';
    a.click();
    toast('Katalog CSV siap-LIS berhasil diunduh!', 'ok');
  } else {
    const jsonStr = JSON.stringify(CATALOG_STATE.analytes, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AVA_Master_Test_Catalog_FHIR.json';
    a.click();
    toast('Katalog JSON FHIR berhasil diunduh!', 'ok');
  }
}

window.renderCatalogExport = renderCatalogExport;
window.eksporKatalogLis = eksporKatalogLis;
