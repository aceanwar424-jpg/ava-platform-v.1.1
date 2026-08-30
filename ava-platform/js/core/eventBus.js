// ═══════════════════════════════════════════════════════════════
// CORE: Event Bus — Asynchronous Outbox & ADR-07 Payload Enforcer
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.8 & Bab 17
// ═══════════════════════════════════════════════════════════════

(function(root) {
  const EventBus = {
    subscribers: {},

    /**
     * Memvalidasi isi payload event sebelum dikirim (Penegakan ADR-07)
     * Tidak boleh memuat nilai hasil medis numerik, catatan dokter, atau NIK mentah
     */
    validatePayloadADR07(eventName, payload) {
      const FORBIDDEN_KEYS = ['hasil_angka', 'nilai_hasil', 'hasil_lab', 'catatan_dokter', 'diagnosa_icd', 'nik'];
      
      const payloadKeys = Object.keys(payload || {}).map(k => k.toLowerCase());
      for (const key of payloadKeys) {
        if (FORBIDDEN_KEYS.includes(key)) {
          throw new Error(`[ADR-07 VIOLATION] Payload event '${eventName}' dilarang memuat data klinis mentah: '${key}'`);
        }
      }
      return true;
    },

    /**
     * Menerbitkan event ke outbox
     */
    async publish(eventName, aggregateType, aggregateId, brandCode, payload = {}, actor = {}) {
      this.validatePayloadADR07(eventName, payload);

      const eventEnvelope = {
        event_id: 'evt_' + Math.random().toString(36).substring(2, 15),
        event_name: eventName,
        event_version: 1,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        brand_code: brandCode,
        actor: {
          user_id: actor.user_id || 'system',
          role: actor.role || 'SYSTEM'
        },
        payload,
        occurred_at: new Date().toISOString(),
        status: 'PENDING'
      };

      // Simpan ke outbox database jika tersedia
      if (root.dbClient && typeof root.dbClient.from === 'function') {
        try {
          await root.dbClient.from('sys_event_outbox').insert([eventEnvelope]);
        } catch (e) {
          console.warn('[EventBus] Gagal simpan ke DB outbox:', e);
        }
      }

      // Dispatch ke in-memory subscribers lokal
      if (this.subscribers[eventName]) {
        this.subscribers[eventName].forEach(callback => {
          try {
            callback(eventEnvelope);
          } catch (err) {
            console.error(`[EventBus] Error in subscriber for ${eventName}:`, err);
          }
        });
      }

      return eventEnvelope;
    },

    /**
     * Mendaftarkan subscriber untuk mendengarkan event tertentu
     */
    subscribe(eventName, callback) {
      if (!this.subscribers[eventName]) {
        this.subscribers[eventName] = [];
      }
      this.subscribers[eventName].push(callback);
    }
  };

  root.EventBus = EventBus;
})(typeof window !== 'undefined' ? window : global);
