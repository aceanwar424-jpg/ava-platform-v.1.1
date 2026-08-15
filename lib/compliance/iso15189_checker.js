/**
 * ISO 15189:2022 Compliance Checker Layer
 * Memeriksa keselarasan dokumen laboratorium klinik dengan klausul standar ISO 15189:2022.
 * Menghasilkan Laporan Gap Analysis yang dapat dibaca dan diaudit.
 */

const ISO_15189_2022_CLAUSES = [
  {
    code: '4.1',
    title: 'Impartiality and Confidentiality',
    category: 'General Requirements',
    keywords: ['ketidakberpihakan', 'kerahasiaan', 'impartiality', 'confidentiality', 'etika', 'konflik kepentingan']
  },
  {
    code: '5.1',
    title: 'Legal Entity and Laboratory Director',
    category: 'Structural Requirements',
    keywords: ['badan hukum', 'penanggung jawab', 'direktur laboratorium', 'izin operasional', 'struktur organisasi']
  },
  {
    code: '6.2',
    title: 'Personnel Competency & Training',
    category: 'Resource Requirements',
    keywords: ['personel', 'kompetensi', 'pelatihan', 'sttr', 'sip', 'kualifikasi', 'kaji ulang kompetensi']
  },
  {
    code: '6.4',
    title: 'Equipment & Calibration Traceability',
    category: 'Resource Requirements',
    keywords: ['kalibrasi', 'pemeriksaan harian', 'pemeliharaan alat', 'reagen', 'lot', 'pemasok', 'keterlacakan']
  },
  {
    code: '7.2',
    title: 'Pre-examination Processes (Specimen Handling)',
    category: 'Process Requirements',
    keywords: ['pra-analitik', 'pengambilan spesimen', 'kriteria penolakan', 'pengangkutan spesimen', 'stabilitas']
  },
  {
    code: '7.3',
    title: 'Examination Processes & Verification',
    category: 'Process Requirements',
    keywords: ['metode pemeriksaan', 'verifikasi metode', 'validasi', 'pmi', 'pme', 'kontrol mutu', 'pme/pmi']
  },
  {
    code: '7.4',
    title: 'Post-examination & Results Reporting',
    category: 'Process Requirements',
    keywords: ['pasca-analitik', 'rentang acuan', 'nilai kritis', 'laporan hasil', 'verifikasi hasil', 'retensi spesimen']
  },
  {
    code: '8.2',
    title: 'Management System Documentation & Control',
    category: 'Management Requirements',
    keywords: ['pengendalian dokumen', 'revisi', 'dokumen mutu', 'sop', 'panduan mutu', 'arsip']
  },
  {
    code: '8.5',
    title: 'Actions to Address Risks and Opportunities',
    category: 'Management Requirements',
    keywords: ['manajemen risiko', 'peluang', 'ktd', 'kpc', 'tindakan perbaikan', 'audit internal']
  }
];

class ISO15189Checker {
  /**
   * Evaluasi kelengkapan klausul ISO 15189 pada dokumen masukan
   * @param {string} docContent - Isi dokumen teks/HTML
   * @param {Object} [metadata={}] - Metadata dokumen
   * @returns {Object} Laporan Evaluasi Kepatuhan ISO
   */
  evaluateDocument(docContent, metadata = {}) {
    if (!docContent || typeof docContent !== 'string') {
      return {
        compliant: false,
        score: 0,
        summary: 'Dokumen kosong atau tidak valid',
        findings: []
      };
    }

    const contentLower = docContent.toLowerCase();
    const findings = [];
    let matchedCount = 0;

    ISO_15189_2022_CLAUSES.forEach(clause => {
      const matchedKeywords = clause.keywords.filter(kw => contentLower.includes(kw));
      const isFulfilled = matchedKeywords.length > 0;

      if (isFulfilled) matchedCount++;

      findings.push({
        clause_code: clause.code,
        clause_title: clause.title,
        category: clause.category,
        status: isFulfilled ? 'FULFILLED' : 'GAP_DETECTED',
        matched_keywords: matchedKeywords,
        missing_keywords: isFulfilled ? [] : clause.keywords,
        severity: isFulfilled ? 'NONE' : (['7.3', '8.2', '6.4'].includes(clause.code) ? 'HIGH' : 'MEDIUM')
      });
    });

    const scorePercent = Math.round((matchedCount / ISO_15189_2022_CLAUSES.length) * 100);
    const highGapCount = findings.filter(f => f.status === 'GAP_DETECTED' && f.severity === 'HIGH').length;

    return {
      doc_title: metadata.title || 'Dokumen Mutu Tanpa Judul',
      doc_number: metadata.doc_number || 'UNASSIGNED',
      evaluated_at: new Date().toISOString(),
      standard: 'ISO 15189:2022',
      compliance_score: scorePercent,
      is_compliant: scorePercent >= 80 && highGapCount === 0,
      summary: {
        total_clauses_checked: ISO_15189_2022_CLAUSES.length,
        fulfilled_clauses: matchedCount,
        gaps_detected: ISO_15189_2022_CLAUSES.length - matchedCount,
        high_severity_gaps: highGapCount
      },
      findings
    };
  }

  /**
   * Menghasilkan teks laporan Laporan Compliance Checker format Markdown / Text
   */
  generateMarkdownReport(evaluationResult) {
    let report = `# LAPORAN COMPLIANCE CHECKER ISO 15189:2022\n\n`;
    report += `**Dokumen:** ${evaluationResult.doc_title} (${evaluationResult.doc_number})\n`;
    report += `**Tanggal Evaluasi:** ${evaluationResult.evaluated_at}\n`;
    report += `**Skor Kepatuhan:** ${evaluationResult.compliance_score}%\n`;
    report += `**Status:** ${evaluationResult.is_compliant ? '✅ PATUH / LOLOS AUDIT' : '⚠️ MEMERLUKAN PERBAIKAN (GAP DETECTED)'}\n\n`;

    report += `--- \n\n### RINGKASAN TEMUAN\n\n`;
    report += `- Total Klausul Diuji: ${evaluationResult.summary.total_clauses_checked}\n`;
    report += `- Klausul Terpenuhi: ${evaluationResult.summary.fulfilled_clauses}\n`;
    report += `- Temuan Gap: ${evaluationResult.summary.gaps_detected} (Tinggi: ${evaluationResult.summary.high_severity_gaps})\n\n`;

    report += `### RINCIAN EVALUASI KLAUSUL\n\n`;

    evaluationResult.findings.forEach(f => {
      const icon = f.status === 'FULFILLED' ? '✅' : (f.severity === 'HIGH' ? '🚨' : '⚠️');
      report += `#### ${icon} Klausul ${f.clause_code} — ${f.clause_title}\n`;
      report += `- **Kategori:** ${f.category}\n`;
      report += `- **Status:** ${f.status} (Severity: ${f.severity})\n`;
      if (f.status === 'FULFILLED') {
        report += `- **Kata Kunci Terdeteksi:** ${f.matched_keywords.join(', ')}\n`;
      } else {
        report += `- **Rekomendasi:** Tambahkan klausul & kata kunci berikut pada dokumen: ${f.missing_keywords.slice(0, 3).join(', ')}\n`;
      }
      report += `\n`;
    });

    return report;
  }
}

module.exports = { ISO15189Checker, ISO_15189_2022_CLAUSES };
