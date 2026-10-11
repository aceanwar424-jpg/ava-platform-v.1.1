/**
 * Template Manager (Work Item P3)
 * Pengelola konfigurasi deklaratif tata letak dokumen & hasil lab.
 * Mendukung preset siap pakai, override konfigurasi mudah, validasi kolom, logo, spasi, dan posisi.
 */

const fs = require('fs');
const path = require('path');

class TemplateManager {
  constructor(options = {}) {
    this.defaultConfigPath = options.defaultConfigPath || path.join(__dirname, '../../config/template.default.config.json');
    this.presetsPath = options.presetsPath || path.join(__dirname, '../../config/template.presets.json');
    
    this.defaultConfig = this._readJson(this.defaultConfigPath);
    this.presetsData = this._readJson(this.presetsPath);
  }

  _readJson(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.error(`Error reading ${filePath}:`, e.message);
    }
    return {};
  }

  /**
   * Mengambil seluruh daftar preset yang tersedia
   */
  getPresets() {
    return this.presetsData.presets || {};
  }

  /**
   * Mengambil preset tertentu berdasarkan key (misal 'standard_navy', 'formal_center', 'dual_logo_partnership')
   */
  getPreset(presetKey) {
    const presets = this.getPresets();
    if (!presets[presetKey]) {
      throw new Error(`Preset '${presetKey}' tidak ditemukan. Pilihan: ${Object.keys(presets).join(', ')}`);
    }
    return this.mergeConfigs(this.defaultConfig, presets[presetKey]);
  }

  /**
   * Menggabungkan konfigurasi dasar dengan override pengguna
   * @param {Object} base - Konfigurasi awal
   * @param {Object} override - Nilai yang ditimpa (partial)
   */
  mergeConfigs(base, override = {}) {
    if (!override) return JSON.parse(JSON.stringify(base));

    const merged = { ...base, ...override };

    // Deep merge untuk sub-objek utama
    const subObjects = ['layout', 'header_kop', 'lab_results_table', 'smm_document_layout', 'signature_box', 'footer', 'critical_alert_banner', 'specimen_timing_audit'];
    for (const key of subObjects) {
      if (base[key] || override[key]) {
        merged[key] = { ...(base[key] || {}), ...(override[key] || {}) };
      }
    }

    // Merge nested margin objek jika ada
    if (base.layout?.page_margin_mm || override.layout?.page_margin_mm) {
      merged.layout.page_margin_mm = {
        ...(base.layout?.page_margin_mm || {}),
        ...(override.layout?.page_margin_mm || {})
      };
    }

    // Merge nested logo margin jika ada
    if (base.header_kop?.logo_margin_px || override.header_kop?.logo_margin_px) {
      merged.header_kop.logo_margin_px = {
        ...(base.header_kop?.logo_margin_px || {}),
        ...(override.header_kop?.logo_margin_px || {})
      };
    }

    // Jika override menyediakan kolom tabel baru, gunakan override
    if (override.lab_results_table?.columns) {
      merged.lab_results_table.columns = override.lab_results_table.columns;
    }

    return merged;
  }

  /**
   * Helper cepat untuk membuat konfigurasi baru dari preset + kustomisasi
   * Contoh:
   *   createCustomConfig({
   *     preset: 'standard_navy',
   *     logo_position: 'center',
   *     primary_color: '#0284c7',
   *     enable_specimen_column: true
   *   })
   */
  createQuickConfig(options = {}) {
    let base = this.defaultConfig;
    if (options.preset && this.getPresets()[options.preset]) {
      base = this.getPreset(options.preset);
    }

    const overrides = {};

    // Layout
    if (options.primary_color || options.page_size || options.margins) {
      overrides.layout = {};
      if (options.primary_color) overrides.layout.primary_color = options.primary_color;
      if (options.page_size) overrides.layout.page_size = options.page_size;
      if (options.margins) overrides.layout.page_margin_mm = options.margins;
    }

    // Kop Logo
    if (options.logo_position || options.logo_width || options.logo_url) {
      overrides.header_kop = {};
      if (options.logo_position) overrides.header_kop.logo_position = options.logo_position;
      if (options.logo_width) {
        overrides.header_kop.logo_width_px = options.logo_width;
        overrides.header_kop.logo_height_px = options.logo_width;
      }
      if (options.logo_url) overrides.header_kop.logo_url = options.logo_url;
      if (options.kop_text_align) overrides.header_kop.kop_text_align = options.kop_text_align;
    }

    // Table columns toggling
    if (options.hidden_columns || options.enabled_columns || options.enable_specimen_column) {
      overrides.lab_results_table = {};
      const currentCols = JSON.parse(JSON.stringify(base.lab_results_table?.columns || []));
      
      currentCols.forEach(col => {
        if (options.hidden_columns && options.hidden_columns.includes(col.id)) {
          col.enabled = false;
        }
        if (options.enabled_columns && options.enabled_columns.includes(col.id)) {
          col.enabled = true;
        }
        if (col.id === 'specimen' && options.enable_specimen_column !== undefined) {
          col.enabled = Boolean(options.enable_specimen_column);
        }
      });
      overrides.lab_results_table.columns = currentCols;
    }

    // Signature box
    if (options.signature_position || options.show_qr !== undefined) {
      overrides.signature_box = {};
      if (options.signature_position) overrides.signature_box.position = options.signature_position;
      if (options.show_qr !== undefined) overrides.signature_box.show_qr_tte = Boolean(options.show_qr);
    }

    return this.mergeConfigs(base, overrides);
  }

  /**
   * Validasi struktur dan nilai konfigurasi template
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Validasi Layout
    if (!config.layout) {
      errors.push("Missing 'layout' section");
    } else {
      if (!['A4', 'Letter', 'Legal'].includes(config.layout.page_size)) {
        warnings.push(`Ukuran kertas '${config.layout.page_size}' tidak standar, disarankan 'A4'`);
      }
      const margins = config.layout.page_margin_mm || {};
      ['top', 'bottom', 'left', 'right'].forEach(side => {
        if (typeof margins[side] !== 'number' || margins[side] < 5 || margins[side] > 40) {
          warnings.push(`Margin ${side} (${margins[side]}mm) di luar batas rekomendasi (5mm - 40mm)`);
        }
      });
    }

    // Validasi Header Kop
    if (!config.header_kop) {
      errors.push("Missing 'header_kop' section");
    } else {
      const validPositions = ['left', 'center', 'right', 'dual'];
      if (!validPositions.includes(config.header_kop.logo_position)) {
        errors.push(`logo_position harus salah satu dari: ${validPositions.join(', ')} (diterima: ${config.header_kop.logo_position})`);
      }
    }

    // Validasi Kolom Tabel
    if (!config.lab_results_table || !Array.isArray(config.lab_results_table.columns)) {
      errors.push("Missing 'lab_results_table.columns' array");
    } else {
      const activeCols = config.lab_results_table.columns.filter(c => c.enabled !== false);
      if (activeCols.length === 0) {
        errors.push("Setidaknya harus ada minimal 1 kolom aktif pada tabel hasil lab");
      }
      const hasAnalyte = activeCols.some(c => c.id === 'analyte');
      const hasResult = activeCols.some(c => c.id === 'result');
      if (!hasAnalyte || !hasResult) {
        errors.push("Kolom 'analyte' dan 'result' wajib diaktifkan pada tabel hasil pemeriksaan");
      }
    }

    // Validasi Tanda Tangan
    if (config.signature_box) {
      const validSigPos = ['left', 'center', 'right'];
      if (!validSigPos.includes(config.signature_box.position)) {
        errors.push(`Posisi tanda tangan harus salah satu dari: ${validSigPos.join(', ')}`);
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Format config sebagai string JSON cantik untuk disimpan atau disalin
   */
  exportToJsonString(config) {
    return JSON.stringify(config, null, 2);
  }
}

module.exports = { TemplateManager };
