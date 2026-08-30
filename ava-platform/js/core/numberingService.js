// ═══════════════════════════════════════════════════════════════
// CORE: Numbering Service — Centralized Atomic Document Numbering
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 15.2 & Bab 16.8
// ═══════════════════════════════════════════════════════════════

(function(root) {
  const NumberingService = {
    /**
     * Menerbitkan nomor dokumen resmi format:
     * AVA/{BRAND}/{JENIS}/{BULAN_ROMAWI}/{YYYY}/{URUT_5_DIGIT}
     * Atau untuk Invoice: INV/{BRAND}/{YYYYMM}/{URUT_5_DIGIT}
     * Atau untuk Lab: L{YYMMDD}-{URUT_5_DIGIT}
     */
    async issueNumber(docType, brandCode = 'LAB', customDate = new Date()) {
      const brand = String(brandCode).toUpperCase();
      const type = String(docType).toUpperCase();
      const year = customDate.getFullYear();
      const month = customDate.getMonth() + 1;

      // Jika terhubung ke database backend (PostgreSQL / Supabase / PGlite)
      if (root.dbClient && typeof root.dbClient.rpc === 'function') {
        try {
          const tenantId = root.currentTenantId ? root.currentTenantId() : '00000000-0000-0000-0000-000000000001';
          const { data, error } = await root.dbClient.rpc('issue_document_number', {
            p_tenant_id: tenantId,
            p_brand_code: brand,
            p_doc_type: type,
            p_year: year,
            p_month: month
          });
          if (!error && data) return data;
        } catch (e) {
          console.warn('[NumberingService] DB RPC fallback ke local sequence counter:', e);
        }
      }

      // Fallback Atomic Local Sequence (Offline/Desktop)
      const storageKey = `AVA_NUM_SEQ_${brand}_${type}_${year}_${month}`;
      let currentSeq = parseInt(localStorage.getItem(storageKey) || '0', 10) + 1;
      localStorage.setItem(storageKey, String(currentSeq));

      const romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][month - 1];
      const seqPad = String(currentSeq).padStart(5, '0');

      if (type === 'INVOICE') {
        const monthPad = String(month).padStart(2, '0');
        return `INV/${brand}/${year}${monthPad}/${seqPad}`;
      } else if (type === 'LAB_ORDER') {
        const yy = String(year).slice(-2);
        const mm = String(month).padStart(2, '0');
        const dd = String(customDate.getDate()).padStart(2, '0');
        return `L${yy}${mm}${dd}-${seqPad}`;
      } else {
        return `AVA/${brand}/${type}/${romawi}/${year}/${seqPad}`;
      }
    },

    /**
     * Membatalkan nomor dokumen (VOID) dengan alasan tercatat untuk audit
     */
    async voidNumber(docNumber, docType, brandCode, voidReason, actorUserId) {
      if (!docNumber || !voidReason) {
        throw new Error('Nomor dokumen dan alasan pembatalan (void) wajib diisi.');
      }
      
      const record = {
        doc_number: docNumber,
        doc_type: docType,
        brand_code: brandCode,
        void_reason: voidReason,
        void_by: actorUserId,
        void_at: new Date().toISOString()
      };

      if (root.dbClient && typeof root.dbClient.from === 'function') {
        try {
          await root.dbClient.from('sys_number_void').insert([record]);
        } catch (e) {
          console.warn('[NumberingService] Gagal simpan void ke DB:', e);
        }
      }

      // Simpan di local audit jika offline
      const voids = JSON.parse(localStorage.getItem('AVA_VOID_NUMBERS') || '[]');
      voids.push(record);
      localStorage.setItem('AVA_VOID_NUMBERS', JSON.stringify(voids));

      if (root.auditLogger && typeof root.auditLogger.log === 'function') {
        root.auditLogger.log('NUMBER_VOID', 'sys_number_void', docNumber, null, record, voidReason);
      }

      return { success: true, message: `Nomor ${docNumber} berhasil ditandai VOID.` };
    }
  };

  root.NumberingService = NumberingService;
})(typeof window !== 'undefined' ? window : global);
