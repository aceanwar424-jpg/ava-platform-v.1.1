/**
 * Configurable Document & Lab Result Generator (Work Item P3)
 * Menghasilkan:
 * 1. Bundel Dokumen SMM ISO 15189 Siap-Cetak (HTML/PDF)
 * 2. Lembar Sertifikat E-Hasil Laboratorium ISO 15189 Siap-Cetak (HTML/PDF)
 * 
 * Sepenuhnya dikendalikan oleh konfigurasi deklaratif (logo, spasi, posisi, kolom, dll.)
 */

const fs = require('fs');
const path = require('path');
const { TemplateManager } = require('./template_manager');

class ConfigurableDocGenerator {
  constructor(options = {}) {
    this.templateManager = new TemplateManager(options);
    this.defaultConfig = this.templateManager.defaultConfig;
  }

  /**
   * Menggabungkan konfigurasi template bawaan dengan opsi override kustom
   */
  resolveConfig(customConfig = {}) {
    return this.templateManager.mergeConfigs(this.defaultConfig, customConfig);
  }

  /**
   * 1. Render Header Kop Resmi Laboratorium
   * Mendukung posisi logo: 'left', 'center', 'right', 'dual' (kiri & kanan)
   */
  renderKopHtml(tenantConfig, templateConfig = {}) {
    const cfg = this.resolveConfig(templateConfig);
    const kop = cfg.header_kop;
    const info = tenantConfig.lab_info || {};

    const logoHtml = `
      <div style="flex-shrink:0; width:${kop.logo_width_px}px; height:${kop.logo_height_px}px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; border-radius:10px; border:1px solid #cbd5e1; font-weight:800; font-size:24px; color:${cfg.layout.primary_color};">
        🔬
      </div>
    `;

    const secondaryLogoHtml = `
      <div style="flex-shrink:0; width:${kop.logo_width_px}px; height:${kop.logo_height_px}px; display:flex; align-items:center; justify-content:center; background:#eff6ff; border-radius:10px; border:1px solid #bfdbfe; font-weight:800; font-size:14px; color:#1d4ed8; text-align:center; padding:4px;">
        ${kop.secondary_logo_text || '🏅 KAN'}
      </div>
    `;

    const textHtml = `
      <div style="flex:1; text-align:${kop.kop_text_align}; line-height:1.35;">
        <h1 style="margin:0; font-size:${kop.institution_name_size_pt}pt; font-weight:${kop.institution_name_weight}; color:${cfg.layout.primary_color}; text-transform:uppercase; letter-spacing:0.5px;">
          ${info.name || 'LABORATORIUM KLINIK'}
        </h1>
        <div style="font-size:9.5pt; color:#475569; margin-top:2px;">
          <strong>${info.legal_entity || 'Badan Hukum Faskes'}</strong> &bull; Izin Operasional: ${info.license_number || '-'}
        </div>
        <div style="font-size:8.5pt; color:#64748b; margin-top:2px;">
          ${info.address || 'Alamat Faskes'} ${info.phone ? '&bull; Telp: ' + info.phone : ''} ${info.email ? '&bull; Email: ' + info.email : ''}
        </div>
        ${kop.show_accreditation_kan ? `
          <div style="display:inline-block; margin-top:4px; padding:2px 8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:4px; font-size:7.5pt; font-weight:700; color:#1d4ed8;">
            🏅 ${kop.accreditation_kan_text}
          </div>
        ` : ''}
      </div>
    `;

    let kopContent = '';
    if (kop.logo_position === 'center') {
      kopContent = `
        <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;">
          ${logoHtml}
          ${textHtml}
        </div>
      `;
    } else if (kop.logo_position === 'right') {
      kopContent = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
          ${textHtml}
          ${logoHtml}
        </div>
      `;
    } else if (kop.logo_position === 'dual') {
      kopContent = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
          ${logoHtml}
          ${textHtml}
          ${secondaryLogoHtml}
        </div>
      `;
    } else {
      // Default: logo left
      kopContent = `
        <div style="display:flex; align-items:center; gap:16px;">
          ${logoHtml}
          ${textHtml}
        </div>
      `;
    }

    const dividerBorder = kop.divider_line_style === 'double'
      ? `3px double ${kop.divider_line_color}`
      : `${kop.divider_line_thickness_px}px solid ${kop.divider_line_color}`;

    return `
      <header class="doc-header-kop" style="margin-bottom:${kop.kop_spacing_bottom_px}px; ${kop.show_divider_line ? 'border-bottom:' + dividerBorder + '; padding-bottom:12px;' : ''}">
        ${kopContent}
      </header>
    `;
  }

  /**
   * 2. Render Lembar E-Hasil Laboratorium Pasien (ISO 15189)
   * Kolom tabel dapat diaktifkan/dinonaktifkan (enabled: true/false), diubah urutan & lebarnya.
   */
  renderLabResultHtml(patientData, analytesList, tenantConfig, customTemplateConfig = {}) {
    const cfg = this.resolveConfig(customTemplateConfig);
    const kopHtml = this.renderKopHtml(tenantConfig, cfg);
    const tableCfg = cfg.lab_results_table;
    const sigCfg = cfg.signature_box;
    const qms = tenantConfig.qms_headers || {};

    const patientInfoHtml = `
      <section class="patient-info-box" style="margin-bottom:18px; padding:12px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:9pt; line-height:1.6;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:18%; color:#64748b;">Nama Pasien</td>
            <td style="width:32%; font-weight:700; color:#0f172a;">: ${patientData.name || '—'}</td>
            <td style="width:18%; color:#64748b;">No. Rekam Medis (RM)</td>
            <td style="width:32%; font-weight:700; color:#0f172a;">: ${patientData.mr_number || 'MR-892401'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;">Tanggal Lahir / Umur</td>
            <td>: ${patientData.dob || '—'} (${patientData.age || '35'} Th)</td>
            <td style="color:#64748b;">Jenis Kelamin</td>
            <td>: ${patientData.gender || 'Laki-laki'}</td>
          </tr>
          <tr>
            <td style="color:#64748b;">Dokter Pengirim</td>
            <td>: ${patientData.doctor_referrer || 'dr. Konsultan Medis, Sp.PK'}</td>
            <td style="color:#64748b;">Tanggal Pemeriksaan</td>
            <td>: ${patientData.test_date || new Date().toISOString().slice(0, 10)}</td>
          </tr>
        </table>
      </section>
    `;

    // Filter kolom aktif saja
    const activeColumns = (tableCfg.columns || []).filter(c => c.enabled !== false);

    // Render Table Rows based on columns config
    const tableHeaderHtml = `
      <thead>
        <tr style="background:${tableCfg.header_bg_color}; border-top:1.5px solid ${tableCfg.header_border_color}; border-bottom:1.5px solid ${tableCfg.header_border_color}; color:${tableCfg.header_text_color}; font-size:8.5pt; font-weight:800;">
          ${activeColumns.map(c => `
            <th style="width:${c.width_pct}%; text-align:${c.align}; padding:${tableCfg.row_padding_vertical_px}px ${tableCfg.row_padding_horizontal_px}px;">
              ${c.label}
            </th>
          `).join('')}
        </tr>
      </thead>
    `;

    const tableRowsHtml = analytesList.map((a, idx) => {
      const isAbnormal = a.flag && a.flag !== 'Normal' && a.flag !== 'N' && a.flag !== '-';
      const rowBg = tableCfg.alternate_row_bg && idx % 2 === 1 ? tableCfg.alternate_row_bg_color : '#ffffff';
      
      return `
        <tr style="background:${rowBg}; border-bottom:1px solid #f1f5f9; font-size:9pt;">
          ${activeColumns.map(c => {
            let val = '';
            if (c.id === 'analyte') {
              val = `<strong style="color:${cfg.layout.primary_color};">${a.analyte_name}</strong>`;
              if (c.show_loinc && a.loinc) {
                val += `<br><small style="color:#64748b; font-size:7.5pt;">LOINC: ${a.loinc}</small>`;
              }
            } else if (c.id === 'result') {
              val = `<span style="${c.bold ? 'font-weight:700;' : ''} ${isAbnormal && tableCfg.highlight_abnormal ? 'color:' + tableCfg.abnormal_text_color + ';' : 'color:#0f172a;'}">${a.result_value}</span>`;
            } else if (c.id === 'flag') {
              if (isAbnormal) {
                val = `<span style="display:inline-block; padding:1px 6px; border-radius:4px; font-size:7.5pt; font-weight:800; background:${tableCfg.abnormal_badge_color}; color:${tableCfg.abnormal_text_color};">${a.flag}</span>`;
              } else {
                val = `<span style="color:#10b981; font-size:7.5pt; font-weight:700;">Normal</span>`;
              }
            } else if (c.id === 'unit') {
              val = `<span style="color:#475569;">${a.unit || '—'}</span>`;
            } else if (c.id === 'ref_range') {
              val = `<span style="color:#475569;">${a.ref_range || '—'}</span>`;
            } else if (c.id === 'method') {
              val = `<span style="color:#64748b; font-size:8pt;">${a.method || 'ECLIA / Photometry'}</span>`;
            } else if (c.id === 'specimen') {
              val = `<span style="color:#64748b; font-size:8pt;">${a.specimen || 'Serum Darah'}</span>`;
            } else if (c.id === 'loinc') {
              val = `<code style="font-size:8pt; background:#f1f5f9; padding:2px 4px; border-radius:3px;">${a.loinc || '—'}</code>`;
            }
            return `<td style="text-align:${c.align}; padding:${tableCfg.row_padding_vertical_px}px ${tableCfg.row_padding_horizontal_px}px;">${val}</td>`;
          }).join('')}
        </tr>
      `;
    }).join('');

    const resultsTableHtml = `
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        ${tableHeaderHtml}
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    `;

    // Signature Box
    const sigBoxHtml = `
      <div style="display:flex; justify-content:${sigCfg.position === 'left' ? 'flex-start' : (sigCfg.position === 'center' ? 'center' : 'flex-end')}; margin-top:${sigCfg.spacing_top_px}px;">
        <div style="width:${sigCfg.width_pct}%; text-align:center; font-size:8.5pt;">
          <div style="color:#64748b; margin-bottom:4px;">${tenantConfig.lab_info?.city || 'Jakarta'}, ${new Date().toISOString().slice(0, 10)}</div>
          <div style="font-weight:700; color:${cfg.layout.primary_color}; margin-bottom:8px;">${sigCfg.doctor_role_title}</div>
          ${sigCfg.show_qr_tte ? `
            <div style="margin:8px auto; width:${sigCfg.qr_size_px}px; height:${sigCfg.qr_size_px}px; border:1px solid #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; background:#f8fafc; font-size:24px;">
              📱
            </div>
            <div style="font-size:7pt; color:#64748b; margin-bottom:6px;">${sigCfg.qr_caption}</div>
          ` : '<div style="height:48px;"></div>'}
          <div style="font-weight:800; color:#0f172a; text-decoration:underline;">${qms.lab_director_name || 'dr. Penanggung Jawab, Sp.PK'}</div>
          <div style="color:#64748b;">${qms.lab_director_sip || 'SIP.000/SP.PK/2026'}</div>
        </div>
      </div>
    `;

    const watermarkHtml = cfg.layout.watermark?.enabled ? `
      <div style="position:fixed; top:45%; left:50%; transform:translate(-50%, -50%) rotate(${cfg.layout.watermark.angle_deg || -30}deg); font-size:52pt; font-weight:900; color:${cfg.layout.watermark.color || 'rgba(15,41,99,0.04)'}; pointer-events:none; z-index:0; white-space:nowrap; text-transform:uppercase; letter-spacing:4px;">
        ${cfg.layout.watermark.text || 'SALINAN TERKENDALI'}
      </div>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>E-Hasil Laboratorium - ${patientData.name || 'Pasien'}</title>
  <style>
    @page {
      size: ${cfg.layout.page_size} ${cfg.layout.orientation};
      margin: ${cfg.layout.page_margin_mm.top}mm ${cfg.layout.page_margin_mm.right}mm ${cfg.layout.page_margin_mm.bottom}mm ${cfg.layout.page_margin_mm.left}mm;
    }
    body {
      font-family: ${cfg.layout.font_family};
      color: ${cfg.layout.text_color};
      font-size: ${cfg.layout.font_size_pt}pt;
      line-height: ${cfg.layout.line_height};
      margin: 0;
      padding: 0;
      background: #fff;
      position: relative;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${watermarkHtml}
  <div style="position:relative; z-index:1;">
    ${kopHtml}
    ${patientInfoHtml}
    ${resultsTableHtml}
    ${sigBoxHtml}
    ${cfg.footer.show_page_number ? `
      <footer style="margin-top:30px; ${cfg.footer.show_border_top ? 'border-top:1px solid ' + cfg.footer.border_color + ';' : ''} padding-top:6px; font-size:7.5pt; color:#94a3b8; display:flex; justify-content:space-between;">
        <span>${cfg.footer.footer_note}</span>
        <span>ISO 15189:2022 Verified</span>
      </footer>
    ` : ''}
  </div>
</body>
</html>
    `;
  }

  /**
   * 3. Render Bundel Dokumen SMM ISO 15189 Lengkap Siap-Cetak
   * Dilengkapi Kotak Kendali Dokumen ISO Standar (SOP Control Header Box)
   */
  renderSmmBundleHtml(smmPackage, tenantConfig, customTemplateConfig = {}) {
    const cfg = this.resolveConfig(customTemplateConfig);
    const info = tenantConfig.lab_info || {};
    const qms = tenantConfig.qms_headers || {};
    const docs = smmPackage.documents || [];

    const coverHtml = cfg.smm_document_layout.cover_page.enabled ? `
      <div class="smm-cover-page" style="page-break-after:always; height:90vh; display:flex; flex-direction:column; justify-content:space-between; text-align:center; padding:40px 20px; border:2px solid ${cfg.layout.primary_color}; border-radius:12px;">
        <div>
          <div style="font-size:32px; margin-bottom:12px;">🏥</div>
          <h1 style="font-size:${cfg.smm_document_layout.cover_page.title_size_pt}pt; color:${cfg.layout.primary_color}; margin:0; text-transform:uppercase;">
            ${info.name}
          </h1>
          <p style="font-size:12pt; color:#64748b; margin-top:6px;">${info.legal_entity}</p>
        </div>

        <div style="margin:40px 0; padding:24px; background:#f8fafc; border-radius:10px; border:1px solid #cbd5e1;">
          <h2 style="font-size:16pt; color:${cfg.layout.primary_color}; margin:0;">
            ${cfg.smm_document_layout.cover_page.subtitle}
          </h2>
          <div style="margin-top:10px; font-size:11pt; color:${cfg.layout.accent_color}; font-weight:700;">
            Klausul Standar Akreditasi KAN • SNI ISO 15189:2022
          </div>
          <div style="margin-top:14px; font-size:9.5pt; color:#475569;">
            Total Modul Mutu Terkompilasi: <strong>${docs.length} Dokumen Standar</strong>
          </div>
        </div>

        <div style="font-size:9pt; color:#64748b;">
          <div>Ditetapkan di: ${info.city || 'Jakarta'} &bull; Tanggal Berlaku: ${qms.effective_date || new Date().toISOString().slice(0, 10)}</div>
          <div style="margin-top:4px; font-weight:700; color:#0f172a;">Penanggung Jawab: ${qms.lab_director_name || 'dr. Sp.PK'}</div>
        </div>
      </div>
    ` : '';

    const tocHtml = cfg.smm_document_layout.table_of_contents.enabled ? `
      <div class="smm-toc-page" style="page-break-after:always; padding:20px 0;">
        <h2 style="color:${cfg.layout.primary_color}; border-bottom:2px solid ${cfg.layout.primary_color}; padding-bottom:6px; font-size:14pt;">
          ${cfg.smm_document_layout.table_of_contents.title}
        </h2>
        <table style="width:100%; border-collapse:collapse; font-size:9.5pt; margin-top:16px;">
          <thead>
            <tr style="background:#f1f5f9; text-align:left; color:#475569;">
              <th style="padding:8px 12px; width:15%;">Klausul</th>
              <th style="padding:8px 12px; width:20%;">Kode Dokumen</th>
              <th style="padding:8px 12px; width:50%;">Judul Prosedur / Dokumen Mutu</th>
              <th style="padding:8px 12px; width:15%; text-align:right;">Status Audit</th>
            </tr>
          </thead>
          <tbody>
            ${docs.map(d => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px 12px; font-weight:700; color:${cfg.layout.accent_color};">ISO ${d.clause}</td>
                <td style="padding:8px 12px; color:#475569;">${d.module_id}</td>
                <td style="padding:8px 12px; font-weight:600; color:#0f172a;">${d.title}</td>
                <td style="padding:8px 12px; text-align:right;"><span style="color:#10b981; font-weight:700; font-size:8pt;">✓ PATUH</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    // Render Each Module with ISO 15189 Standard Document Control Header
    const modulePagesHtml = docs.map((d, idx) => {
      const docControlHeader = cfg.smm_document_layout?.document_control_header?.enabled !== false ? `
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; border:1.5px solid ${cfg.layout.primary_color}; font-size:8pt; line-height:1.35;">
          <tr>
            <td rowspan="2" style="width:18%; border:1px solid #cbd5e1; text-align:center; padding:6px; background:#f8fafc; font-weight:700; color:${cfg.layout.primary_color};">
              🔬 ${info.name || 'LAB KLINIK'}
            </td>
            <td rowspan="2" style="width:48%; border:1px solid #cbd5e1; padding:6px 10px; vertical-align:middle;">
              <div style="font-size:7.5pt; color:#64748b; text-transform:uppercase; font-weight:600;">SISTEM MANAJEMEN MUTU ISO 15189:2022</div>
              <div style="font-size:10.5pt; font-weight:800; color:${cfg.layout.primary_color};">${d.title}</div>
              <div style="font-size:7.5pt; color:${cfg.layout.accent_color};">Klausul Acuan: <strong>ISO ${d.clause}</strong></div>
            </td>
            <td style="width:16%; border:1px solid #cbd5e1; padding:4px 6px; color:#475569;">No. Dokumen:</td>
            <td style="width:18%; border:1px solid #cbd5e1; padding:4px 6px; font-weight:700;">${d.module_id}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:4px 6px; color:#475569;">Edisi / Revisi:</td>
            <td style="border:1px solid #cbd5e1; padding:4px 6px; font-weight:700;">${qms.document_code_prefix || 'SOP'}-REV01</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="border:1px solid #cbd5e1; padding:4px 6px; text-align:center; color:#64748b;">Tanggal Berlaku:</td>
            <td style="border:1px solid #cbd5e1; padding:4px 10px; font-weight:600;">${qms.effective_date || new Date().toISOString().slice(0, 10)}</td>
            <td style="border:1px solid #cbd5e1; padding:4px 6px; color:#475569;">Penanggung Jawab:</td>
            <td style="border:1px solid #cbd5e1; padding:4px 6px; font-weight:700;">${qms.lab_director_name || 'dr. Sp.PK'}</td>
          </tr>
        </table>
      ` : '';

      return `
        <div class="smm-module-doc" style="${idx < docs.length - 1 ? 'page-break-after:always;' : ''} padding:16px 0;">
          ${docControlHeader}
          <div style="font-size:9.5pt; line-height:1.6; color:#334155;">
            ${this._markdownToHtml(d.content)}
          </div>
        </div>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Paket Sistem Manajemen Mutu ISO 15189 - ${info.name}</title>
  <style>
    @page {
      size: ${cfg.layout.page_size} ${cfg.layout.orientation};
      margin: ${cfg.layout.page_margin_mm.top}mm ${cfg.layout.page_margin_mm.right}mm ${cfg.layout.page_margin_mm.bottom}mm ${cfg.layout.page_margin_mm.left}mm;
    }
    body {
      font-family: ${cfg.layout.font_family};
      color: ${cfg.layout.text_color};
      font-size: ${cfg.layout.font_size_pt}pt;
      line-height: ${cfg.layout.line_height};
      margin: 0;
      padding: 0;
      background: #fff;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${coverHtml}
  ${tocHtml}
  ${modulePagesHtml}
</body>
</html>
    `;
  }

  _markdownToHtml(md) {
    if (!md) return '';
    return md
      .replace(/^# (.*$)/gim, '<h2 style="color:#0f2963; font-size:13pt; margin-top:20px;">$1</h2>')
      .replace(/^## (.*$)/gim, '<h3 style="color:#0f2963; font-size:11pt; margin-top:16px;">$1</h3>')
      .replace(/^### (.*$)/gim, '<h4 style="color:#0284c7; font-size:10pt; margin-top:12px;">$1</h4>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code style="background:#f1f5f9; padding:2px 4px; border-radius:3px;">$1</code>')
      .replace(/\n\n/gim, '<br><br>')
      .replace(/\[\[(.*?)\]\]/gim, '<span style="display:inline-block; padding:2px 8px; background:#eff6ff; color:#1d4ed8; border-radius:4px; font-weight:700; font-size:8pt; margin:4px 0;">[$1]</span>');
  }
}

module.exports = { ConfigurableDocGenerator };
