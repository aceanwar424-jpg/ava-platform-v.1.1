/**
 * SMM Pack Assembler (Work Item P3)
 * "Rakit Paket SMM": Menggabungkan modul-modul SMM per-klausul ISO 15189:2022
 * menjadi satu paket dokumen mutu siap-pakai yang terparameterisasi per tenant.
 */

const fs = require('fs');
const path = require('path');
const { ISO15189Checker } = require('../compliance/iso15189_checker');

class SMMPackAssembler {
  constructor(options = {}) {
    this.manifestPath = options.manifestPath || path.join(__dirname, '../../templates/smm/iso15189_modules_manifest.json');
    this.templateDir = options.templateDir || path.join(__dirname, '../../templates/smm/iso15189');
    this.checker = new ISO15189Checker();
  }

  /**
   * Rakit paket dokumen SMM berdasarkan daftar modul dan konfigurasi tenant
   * @param {Object} tenantConfig - Objek konfigurasi tenant
   * @param {Array<string>} [selectedModuleIds] - ID modul yang dipilih (opsional, default: semua)
   * @returns {Object} Hasil Rakitan Paket SMM
   */
  assemble(tenantConfig, selectedModuleIds = null) {
    if (!fs.existsSync(this.manifestPath)) {
      throw new Error(`Manifest pustaka modul tidak ditemukan di ${this.manifestPath}`);
    }

    const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
    let modulesToAssemble = manifest.modules;

    if (selectedModuleIds && Array.isArray(selectedModuleIds) && selectedModuleIds.length > 0) {
      modulesToAssemble = manifest.modules.filter(m => selectedModuleIds.includes(m.module_id));
    }

    const compiledDocs = [];
    let combinedContent = '';

    modulesToAssemble.forEach(mod => {
      const filePath = path.join(this.templateDir, mod.filename);
      let rawText = '';
      if (fs.existsSync(filePath)) {
        rawText = fs.readFileSync(filePath, 'utf-8');
      } else {
        rawText = `# DOKUMEN MODUL: ${mod.title}\n\n[[METADATA]]\n- Clause: ${mod.clause}\n- Level: ${mod.level}\n\n[[PENDAHULUAN]]\nDokumen prosedur standar untuk ${mod.title}.\n\n[[PROSEDUR]]\nLangkah-langkah teknis pengoperasian sesuai standar ISO 15189:2022 Klausul ${mod.clause}.`;
      }

      // Variable Replacement per-Tenant
      const processedText = this._replaceVariables(rawText, tenantConfig);
      const evalResult = this.checker.evaluateDocument(processedText, {
        title: mod.title,
        doc_number: mod.module_id
      });

      compiledDocs.push({
        module_id: mod.module_id,
        clause: mod.clause,
        title: mod.title,
        filename: mod.filename,
        content: processedText,
        evaluation: evalResult
      });

      combinedContent += processedText + '\n\n---\n\n';
    });

    const overallEval = this.checker.evaluateDocument(combinedContent, {
      title: `Paket SMM - ${tenantConfig.lab_info?.name || 'Laboratorium Client'}`,
      doc_number: `SMM-PACK-${Date.now()}`
    });

    return {
      assembled_at: new Date().toISOString(),
      tenant_id: tenantConfig.tenant_id || 'DEFAULT',
      lab_name: tenantConfig.lab_info?.name || 'Laboratorium Klinik',
      total_modules: compiledDocs.length,
      overall_compliance_score: overallEval.compliance_score,
      is_audit_ready: overallEval.is_compliant,
      documents: compiledDocs,
      combined_bundle: combinedContent
    };
  }

  _replaceVariables(text, tenantConfig) {
    const info = tenantConfig.lab_info || {};
    const qms = tenantConfig.qms_headers || {};

    let replaced = text;
    replaced = replaced.replace(/\{\{TENANT_NAME\}\}/g, info.name || 'Laboratorium Klinik');
    replaced = replaced.replace(/\{\{LEGAL_ENTITY\}\}/g, info.legal_entity || 'PT Akselerator Kesehatan');
    replaced = replaced.replace(/\{\{LICENSE_NUMBER\}\}/g, info.license_number || 'PJK3/KLINIK/2026/001');
    replaced = replaced.replace(/\{\{EFFECTIVE_DATE\}\}/g, new Date().toISOString().slice(0, 10));
    replaced = replaced.replace(/\{\{CITY\}\}/g, 'Jakarta');
    replaced = replaced.replace(/\{\{LAB_DIRECTOR_NAME\}\}/g, 'dr. Penanggung Jawab Sp.PK');
    replaced = replaced.replace(/\{\{LAB_DIRECTOR_SIP\}\}/g, 'SIP.449/123/2026');

    return replaced;
  }
}

module.exports = { SMMPackAssembler };
