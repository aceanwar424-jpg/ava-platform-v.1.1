/**
 * Headless PDF Exporter for SMM Documents & E-Hasil Lab Certificates
 * Menggunakan engine browser Edge / Chromium headless bawaan sistem
 * Menghasilkan file biner PDF siap-cetak A4 resmi berstandar ISO 15189:2022.
 * 
 * OWNED_BY: generic
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('../../scripts/lib/playwright.cjs');
const { ConfigurableDocGenerator } = require('./configurable_doc_generator');

class PdfExporter {
  constructor(options = {}) {
    this.generator = new ConfigurableDocGenerator(options);
    this.defaultBrowserChannel = options.browserChannel || 'msedge';
  }

  /**
   * Menghasilkan biner PDF dari string HTML
   * @param {string} htmlContent - Konten HTML lengkap
   * @param {Object} [pdfOptions={}] - Opsi layout PDF Playwright
   * @returns {Promise<Buffer>} Buffer biner PDF
   */
  async generatePdfFromHtml(htmlContent, pdfOptions = {}) {
    if (!htmlContent || typeof htmlContent !== 'string') {
      throw new Error('Konten HTML wajib diisi dan berupa string');
    }

    const browser = await chromium.launch({
      channel: this.defaultBrowserChannel,
      headless: true
    });

    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 1600 }
      });

      // Muat konten HTML ke halaman
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle'
      });

      // Pastikan media print dievaluasi
      await page.emulateMedia({ media: 'print' });

      const defaultOptions = {
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '15mm',
          bottom: '15mm',
          left: '15mm',
          right: '15mm'
        }
      };

      const mergedOptions = { ...defaultOptions, ...pdfOptions };
      const pdfBuffer = await page.pdf(mergedOptions);

      if (pdfOptions.outputPath) {
        const outDir = path.dirname(pdfOptions.outputPath);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(pdfOptions.outputPath, pdfBuffer);
      }

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Ekspor langsung Dokumen Paket SMM ke PDF
   * @param {Object} smmPackage - Paket rakitan SMMPackAssembler
   * @param {Object} tenantConfig - Konfigurasi tenant faskes
   * @param {string} outputPath - Lokasi penyimpanan file .pdf
   * @param {Object} [customLayout={}] - Override tata letak deklaratif
   * @returns {Promise<Buffer>}
   */
  async exportSmmBundleToPdf(smmPackage, tenantConfig, outputPath, customLayout = {}) {
    const htmlBundle = this.generator.renderSmmBundleHtml(smmPackage, tenantConfig, customLayout);
    return this.generatePdfFromHtml(htmlBundle, { outputPath });
  }

  /**
   * Ekspor langsung Sertifikat Hasil Lab (E-Hasil) ke PDF
   * Mendukung pemanggilan fleksibel:
   * 1. exportLabResultToPdf(compositeResult, tenantConfig, outputPath, customLayout)
   * 2. exportLabResultToPdf(patientData, analytesList, tenantConfig, outputPath, customLayout)
   */
  async exportLabResultToPdf(arg1, arg2, arg3, arg4, arg5 = {}) {
    let patientData = arg1;
    let analytesList = arg2;
    let tenantConfig = arg3;
    let outputPath = arg4;
    let customLayout = arg5;

    // Jika arg1 adalah objek hasil terpadu (memiliki properti items/pasien)
    if (arg1 && (arg1.items || arg1.analytes) && !Array.isArray(arg2)) {
      patientData = arg1.pasien || arg1.patientData || arg1;
      analytesList = arg1.items || arg1.analytes || [];
      tenantConfig = arg2;
      outputPath = arg3;
      customLayout = arg4 || {};
    }

    const htmlResult = this.generator.renderLabResultHtml(patientData, analytesList, tenantConfig, customLayout);
    return this.generatePdfFromHtml(htmlResult, { outputPath });
  }
}

module.exports = { PdfExporter };
