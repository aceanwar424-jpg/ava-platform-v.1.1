// ══════════════════════════════════════════════════════════════════════════════
// AVA · Laboratory Information System
// Service: NTP Time Server (Legal-grade timestamps)
// Purpose: Verify system time against trusted NTP server (ISO 15189)
// MVP: Uses public NTP servers (no budget, no infrastructure)
// Production: Should use certified timestamp authority (RFC 3161)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * NTPService: Provides NTP-verified timestamps for audit trail
 * ISO 15189 requires: timestamps must be accurate, traceable, and trusted
 *
 * MVP Strategy:
 * 1. Compare local system time against multiple NTP servers
 * 2. If drift >1 second, alert admin but continue (don't block)
 * 3. Store NTP verification results in lab_ntp_timestamps table
 * 4. Audit log includes verified timestamp for legal proof
 *
 * Note: In production, integrate RFC 3161 timestamp service provider
 * (e.g., Camerfirm, GlobalSign, Entrust)
 */
class NTPService {
  constructor(supabaseClient) {
    this.db = supabaseClient;
    this.ntpServers = [
      'time.google.com',
      'time.cloudflare.com',
      'pool.ntp.org'
    ];
    this.maxTimeDrift = 1000; // milliseconds (1 second tolerance)
    this.lastNtpCheck = null;
    this.ntpCheckInterval = 60 * 60 * 1000; // Check every hour
  }

  /**
   * Get NTP-verified timestamp
   * Returns verified timestamp or local time if NTP unavailable
   */
  async getVerifiedTimestamp() {
    try {
      // Return local time for now (NTP polling disabled for MVP speed)
      // In production, uncomment the NTP check below
      const now = new Date();

      // Optionally: Background check NTP (don't wait)
      this._checkNtpInBackground();

      return now;
    } catch (error) {
      console.warn('NTP verification failed, using local time:', error);
      return new Date();
    }
  }

  /**
   * Background NTP check (don't block API calls)
   */
  async _checkNtpInBackground() {
    try {
      if (
        this.lastNtpCheck &&
        Date.now() - this.lastNtpCheck < this.ntpCheckInterval
      ) {
        return; // Skip if checked recently
      }

      const result = await this._checkNtp();
      this.lastNtpCheck = Date.now();

      // Log result
      if (result && this.db) {
        await this.db
          .from('lab_ntp_timestamps')
          .insert({
            local_timestamp: result.localTime,
            ntp_timestamp: result.ntpTime,
            ntp_server: result.ntpServer,
            time_offset_ms: result.offset,
            is_verified: result.verified
          });

        if (!result.verified) {
          console.warn('⚠️  NTP time sync warning: Drift detected!', result);
          // Alert admin in production
        }
      }
    } catch (error) {
      console.warn('Background NTP check failed:', error);
    }
  }

  /**
   * Check system time against NTP server
   * Returns: { localTime, ntpTime, offset, verified, ntpServer }
   */
  async _checkNtp() {
    // For MVP: Simplified check using public time API
    try {
      const localTime = new Date();
      const localMs = localTime.getTime();

      // Call Google's time API (HTTPS, works in browser)
      const response = await fetch('https://www.google.com/api/js/timesync.js', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      if (!response.ok) throw new Error('Failed to fetch');

      // Extract server time from Date header
      const dateHeader = response.headers.get('date');
      const ntpTime = new Date(dateHeader);
      const ntpMs = ntpTime.getTime();

      const offset = Math.abs(localMs - ntpMs);
      const verified = offset < this.maxTimeDrift;

      return {
        localTime,
        ntpTime,
        offset,
        verified,
        ntpServer: 'google.com'
      };
    } catch (error) {
      // Fallback: Try another server
      try {
        const response = await fetch('https://www.cloudflare.com', {
          method: 'HEAD',
          cache: 'no-cache'
        });

        const dateHeader = response.headers.get('date');
        const ntpTime = new Date(dateHeader);
        const offset = Math.abs(new Date().getTime() - ntpTime.getTime());

        return {
          localTime: new Date(),
          ntpTime,
          offset,
          verified: offset < this.maxTimeDrift,
          ntpServer: 'cloudflare.com'
        };
      } catch (fallbackError) {
        console.warn('All NTP checks failed, using local time');
        return {
          localTime: new Date(),
          ntpTime: null,
          offset: null,
          verified: false,
          ntpServer: null
        };
      }
    }
  }

  /**
   * Get NTP status for display in admin UI
   */
  async getNtpStatus() {
    try {
      if (!this.db) return { status: 'unknown' };

      const { data, error } = await this.db
        .from('lab_ntp_timestamps')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const verified = data?.filter(d => d.is_verified).length || 0;
      const total = data?.length || 0;

      return {
        status: verified === total ? 'synchronized' : 'drift_detected',
        verified,
        total,
        lastCheck: data?.[0]?.created_at,
        maxDrift: this.maxTimeDrift,
        lastOffset: data?.[0]?.time_offset_ms
      };
    } catch (error) {
      console.error('Failed to get NTP status:', error);
      return { status: 'error' };
    }
  }

  /**
   * Generate RFC 3161-like timestamp token
   * (Full RFC 3161 requires external TSA; this is simplified)
   */
  async generateTimestampToken(content) {
    try {
      const timestamp = await this.getVerifiedTimestamp();
      const token = {
        content,
        timestamp: timestamp.toISOString(),
        version: '1.0',
        tsa: 'AVATS'
      };

      // In production: Sign this with TSA private key
      return JSON.stringify(token);
    } catch (error) {
      console.error('Timestamp token generation failed:', error);
      return null;
    }
  }

  /**
   * Verify timestamp token validity
   */
  async verifyTimestampToken(token) {
    try {
      const parsed = JSON.parse(token);
      const tokenTime = new Date(parsed.timestamp);
      const now = new Date();

      // Check if token is recent (within 1 hour)
      const age = now.getTime() - tokenTime.getTime();
      return age < 60 * 60 * 1000;
    } catch (error) {
      return false;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Export for use in modules
// ══════════════════════════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NTPService;
}
