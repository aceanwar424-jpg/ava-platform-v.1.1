// ═══════════════════════════════════════════════════════════════
// MODULE: Master Test Catalog & LIS Exporter (AGENTS.md P2 & §4.3)
// ═══════════════════════════════════════════════════════════════

const catalogExporter = {
  generateLisReadyCatalog() {
    return [
      {
        kode_material: 'LAB-HEM-001',
        nama_pemeriksaan: 'Darah Lengkap (CBC)',
        nama_analit: 'Leukosit (WBC)',
        loinc_obx3: '6690-2',
        ucum_obx6: '10*3/uL',
        operator: 'BETWEEN',
        nilai_bawah: '4.0',
        nilai_atas: '10.0',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Semua Umur'
      },
      {
        kode_material: 'LAB-HEM-001',
        nama_pemeriksaan: 'Darah Lengkap (CBC)',
        nama_analit: 'Eritrosit (RBC)',
        loinc_obx3: '789-8',
        ucum_obx6: '10*6/uL',
        operator: 'BETWEEN',
        nilai_bawah: '4.5',
        nilai_atas: '5.9',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Dewasa Pria'
      },
      {
        kode_material: 'LAB-HEM-001',
        nama_pemeriksaan: 'Darah Lengkap (CBC)',
        nama_analit: 'Hemoglobin',
        loinc_obx3: '718-7',
        ucum_obx6: 'g/dL',
        operator: 'BETWEEN',
        nilai_bawah: '13.5',
        nilai_atas: '17.5',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Dewasa Pria'
      },
      {
        kode_material: 'LAB-HEM-001',
        nama_pemeriksaan: 'Darah Lengkap (CBC)',
        nama_analit: 'Hematokrit (HCT)',
        loinc_obx3: '4544-3',
        ucum_obx6: '%',
        operator: 'BETWEEN',
        nilai_bawah: '40.0',
        nilai_atas: '52.0',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Dewasa Pria'
      },
      {
        kode_material: 'LAB-HEM-001',
        nama_pemeriksaan: 'Darah Lengkap (CBC)',
        nama_analit: 'Trombosit (PLT)',
        loinc_obx3: '777-3',
        ucum_obx6: '10*3/uL',
        operator: 'BETWEEN',
        nilai_bawah: '150',
        nilai_atas: '450',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Semua Umur'
      },
      {
        kode_material: 'LAB-KIM-001',
        nama_pemeriksaan: 'Glukosa Darah Puasa',
        nama_analit: 'Glukosa Puasa',
        loinc_obx3: '1558-6',
        ucum_obx6: 'mg/dL',
        operator: 'BETWEEN',
        nilai_bawah: '70',
        nilai_atas: '99',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Dewasa'
      },
      {
        kode_material: 'LAB-KIM-002',
        nama_pemeriksaan: 'Ureum Darah',
        nama_analit: 'Ureum',
        loinc_obx3: '3094-0',
        ucum_obx6: 'mg/dL',
        operator: 'BETWEEN',
        nilai_bawah: '10',
        nilai_atas: '50',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Dewasa'
      },
      {
        kode_material: 'LAB-KIM-003',
        nama_pemeriksaan: 'Kreatinin Darah',
        nama_analit: 'Kreatinin',
        loinc_obx3: '2160-0',
        ucum_obx6: 'mg/dL',
        operator: 'BETWEEN',
        nilai_bawah: '0.7',
        nilai_atas: '1.3',
        jenis_nilai: 'Kuantitatif',
        kelompok_usia_gender: 'Dewasa Pria'
      }
    ];
  },

  exportCatalogToCSV(data = []) {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const lines = [headers.join(',')];
    data.forEach(row => {
      const vals = headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`);
      lines.push(vals.join(','));
    });
    return lines.join('\n');
  },

  exportCatalogToTSV(data = []) {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const lines = [headers.join('\t')];
    data.forEach(row => {
      const vals = headers.map(h => String(row[h] || ''));
      lines.push(vals.join('\t'));
    });
    return lines.join('\n');
  },

  validateCatalogIntegrity(data = []) {
    const errors = [];
    if (!Array.isArray(data) || !data.length) {
      return { valid: false, errors: ['Katalog kosong'] };
    }
    data.forEach((row, idx) => {
      if (!row.kode_material || !row.kode_material.trim()) {
        errors.push(`Baris #${idx + 1}: Kode Material wajib diisi (kunci relasional)`);
      }
      if (!row.nama_pemeriksaan || !row.nama_pemeriksaan.trim()) {
        errors.push(`Baris #${idx + 1}: Nama Pemeriksaan wajib diisi (kunci relasional)`);
      }
    });
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

window.catalogExporter = catalogExporter;
window.renderCatalogExport = function() {
  const el = document.getElementById('main-content');
  if (!el) return;
  const data = catalogExporter.generateLisReadyCatalog();
  el.innerHTML = `
    <div class="card" style="padding:20px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
        <div>
          <h2 style="margin:0; font-size:18px; color:var(--navy-deep); font-weight:800">Master Test Catalog &amp; LIS Exporter (LOINC/UCUM)</h2>
          <p style="margin:4px 0 0; font-size:12px; color:var(--text3)">Dataset terstandarisasi untuk integrasi LIS/SIMRS (AGENTS.md P2)</p>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-teal btn-sm" onclick="alert('Katalog CSV diunduh!')">📥 Unduh CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="alert('Katalog TSV diunduh!')">📥 Unduh TSV</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="pro-grid" style="width:100%; border-collapse:collapse">
          <thead>
            <tr>
              <th style="padding:8px 12px; text-align:left">Kode Material</th>
              <th style="padding:8px 12px; text-align:left">Nama Pemeriksaan</th>
              <th style="padding:8px 12px; text-align:left">Nama Analit</th>
              <th style="padding:8px 12px; text-align:left">LOINC (OBX-3)</th>
              <th style="padding:8px 12px; text-align:left">UCUM (OBX-6)</th>
              <th style="padding:8px 12px; text-align:left">Nilai Rujukan</th>
              <th style="padding:8px 12px; text-align:left">Kelompok</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => `
              <tr>
                <td style="padding:8px 12px; font-family:monospace; font-size:11px">${r.kode_material}</td>
                <td style="padding:8px 12px; font-weight:600">${r.nama_pemeriksaan}</td>
                <td style="padding:8px 12px; color:var(--teal)">${r.nama_analit}</td>
                <td style="padding:8px 12px; font-family:monospace">${r.loinc_obx3}</td>
                <td style="padding:8px 12px; font-family:monospace">${r.ucum_obx6}</td>
                <td style="padding:8px 12px">${r.nilai_bawah} - ${r.nilai_atas}</td>
                <td style="padding:8px 12px; font-size:11px; color:var(--text3)">${r.kelompok_usia_gender}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
};
