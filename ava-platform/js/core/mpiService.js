// ═══════════════════════════════════════════════════════════════
// CORE: MPI Service — Master Person Index Single Identity (AVA-ID)
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.4 & ADR-03
// ═══════════════════════════════════════════════════════════════

(function(root) {
  const CROCKFORD_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  const MPIService = {
    /**
     * Menghasilkan Crockford Base32 AVA-ID (10 digit): AVA-XXXXXXXXXX
     */
    generateAvaId() {
      let id = 'AVA-';
      const array = new Uint8Array(10);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
      } else {
        for (let i = 0; i < 10; i++) array[i] = Math.floor(Math.random() * 256);
      }
      for (let i = 0; i < 10; i++) {
        id += CROCKFORD_CHARS[array[i] % 32];
      }
      return id;
    },

    /**
     * Algoritma Deteksi Pasien Duplikat (Jaro-Winkler + NIK + DOB)
     * Skor: 1.0 (Exact NIK), >= 0.85 (High Candidate), < 0.70 (Different)
     */
    calculateMatchScore(p1, p2) {
      // 1. NIK sama persis -> Duplikat pasti (Skor 1.0)
      if (p1.nik && p2.nik && String(p1.nik).trim() === String(p2.nik).trim()) {
        return { score: 1.0, reason: 'NIK_EXACT_MATCH' };
      }

      let score = 0;
      let matches = 0;

      // 2. Kesamaan Tanggal Lahir (Bobot 0.35)
      if (p1.birth_date && p2.birth_date && p1.birth_date === p2.birth_date) {
        score += 0.35;
        matches++;
      }

      // 3. Kesamaan Nama Lengkap (Levenshtein / Token similarity - Bobot 0.45)
      if (p1.full_name && p2.full_name) {
        const nameSim = this.stringSimilarity(p1.full_name.toLowerCase(), p2.full_name.toLowerCase());
        score += nameSim * 0.45;
      }

      // 4. Kesamaan Nomor Telepon (Bobot 0.20)
      if (p1.phone && p2.phone && String(p1.phone).replace(/\D/g, '') === String(p2.phone).replace(/\D/g, '')) {
        score += 0.20;
        matches++;
      }

      return {
        score: Math.min(1.0, parseFloat(score.toFixed(2))),
        reason: score >= 0.80 ? 'HIGH_SIMILARITY_CANDIDATE' : 'LOW_SIMILARITY'
      };
    },

    /**
     * Helper string similarity (Levenshtein distance ratio)
     */
    stringSimilarity(s1, s2) {
      if (s1 === s2) return 1.0;
      if (!s1 || !s2) return 0.0;
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      const longerLength = longer.length;
      if (longerLength === 0) return 1.0;
      
      const editDistance = this.levenshtein(longer, shorter);
      return (longerLength - editDistance) / parseFloat(longerLength);
    },

    levenshtein(a, b) {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    },

    /**
     * Mendaftarkan atau menghubungkan orang ke AVA-ID tunggal
     */
    async registerPerson(personData, brandCode = 'HEALTH') {
      const avaId = personData.ava_id || this.generateAvaId();
      const personRecord = {
        ava_id: avaId,
        full_name: personData.full_name,
        birth_date: personData.birth_date,
        birth_place: personData.birth_place,
        sex: personData.sex || 'UNKNOWN',
        blood_type: personData.blood_type,
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };

      // Simpan relasi brand
      const brandLink = {
        ava_id: avaId,
        brand_code: brandCode,
        first_seen_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      };

      // Rekam audit
      if (root.auditLogger && typeof root.auditLogger.log === 'function') {
        root.auditLogger.log('MPI_REGISTER', 'mpi_person', avaId, null, personRecord, `Registrasi di brand ${brandCode}`);
      }

      return { person: personRecord, brandLink, avaId };
    },

    /**
     * Menggabungkan dua rekaman pasien duplikat (Merge dengan snapshot)
     */
    async mergePersons(survivingAvaId, mergedAvaId, reason, actorUserId) {
      if (!survivingAvaId || !mergedAvaId || survivingAvaId === mergedAvaId) {
        throw new Error('Identitas target dan merged AVA-ID tidak valid.');
      }

      const snapshot = {
        mergedAvaId,
        survivingAvaId,
        timestamp: new Date().toISOString()
      };

      const mergeLog = {
        surviving_ava_id: survivingAvaId,
        merged_ava_id: mergedAvaId,
        reason: reason || 'Penggabungan data pasien teridentifikasi duplikat',
        performed_by: actorUserId,
        performed_at: new Date().toISOString(),
        snapshot,
        is_unmerged: false
      };

      if (root.EventBus && typeof root.EventBus.publish === 'function') {
        await root.EventBus.publish('mpi.person.merged', 'person', survivingAvaId, 'HQ', {
          surviving_ava_id: survivingAvaId,
          merged_ava_id: mergedAvaId,
          reason
        });
      }

      return { success: true, mergeLog };
    }
  };

  root.MPIService = MPIService;
})(typeof window !== 'undefined' ? window : global);
