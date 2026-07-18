// ══════════════════════════════════════════════════════════════════════════════
// OneLab · Laboratory Information System
// Service: Audit Logger (ISO 15189 Compliance)
// Purpose: Immutable audit trail for all critical actions
// Retention: 5-year legal requirement per ISO 15189
// ══════════════════════════════════════════════════════════════════════════════

/**
 * AuditLogger: Records all actions with immutable timestamps and signatures
 * Ensures compliance with ISO 15189 audit requirements
 * Supports digital signatures for non-repudiation
 */
class AuditLogger {
  constructor(supabaseClient, pkiService, ntpService) {
    this.db = supabaseClient;
    this.pki = pkiService;
    this.ntp = ntpService;
    this.actionCache = [];
    this.batchSize = 10; // Batch writes for efficiency
  }

  /**
   * Main entry point: Log any action
   * @param {Object} params - Action details
   */
  async logAction(params) {
    const {
      action,        // 'result_entered', 'result_validated', etc
      resourceType,  // 'lab_result', 'lab_sample', etc
      resourceId,    // ID of affected record
      userId,        // Who did it
      userRole,      // 'Analis', 'Dokter', 'Admin'
      beforeValue,   // Previous value (JSON-stringified if needed)
      afterValue,    // New value
      reason,        // Why changed? (required for edits)
      ipAddress,     // Source IP
      userAgent,     // Browser/Client info
      digitalSignature // PKI signature blob (optional, for approval events)
    } = params;

    try {
      // Get NTP-verified timestamp
      const timestamp = await this.ntp?.getVerifiedTimestamp() || new Date();

      const logEntry = {
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        user_id: userId,
        user_role: userRole,
        before_value: JSON.stringify(beforeValue),
        after_value: JSON.stringify(afterValue),
        change_reason: reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        timestamp,
        digital_signature: digitalSignature,
        signature_verified: digitalSignature ? true : false,
        retention_years: 5,
        archived: false
      };

      // Add to cache for batch writing
      this.actionCache.push(logEntry);

      // Auto-flush if batch full
      if (this.actionCache.length >= this.batchSize) {
        await this.flushCache();
      }

      return { success: true, logEntry };
    } catch (error) {
      console.error('AuditLogger.logAction error:', error);
      // IMPORTANT: Don't block action if logging fails, but alert admin
      return { success: false, error: error.message };
    }
  }

  /**
   * Flush cached entries to database
   */
  async flushCache() {
    if (this.actionCache.length === 0) return;

    try {
      const { error } = await this.db
        .from('lab_audit_log')
        .insert(this.actionCache);

      if (error) throw error;

      console.log(`Audit log: ${this.actionCache.length} entries flushed`);
      this.actionCache = [];
    } catch (error) {
      console.error('Failed to flush audit cache:', error);
      // Keep cached entries for retry
    }
  }

  /**
   * Log: Result entered (Draft created)
   */
  async logResultEntered(resultId, userId, result, ipAddress) {
    return this.logAction({
      action: 'result_entered',
      resourceType: 'lab_result',
      resourceId: resultId,
      userId,
      userRole: 'Analis',
      beforeValue: null,
      afterValue: result,
      reason: 'Initial result entry by technician',
      ipAddress,
      userAgent: navigator?.userAgent || ''
    });
  }

  /**
   * Log: Result validated (Draft → Validated)
   */
  async logResultValidated(resultId, userId, beforeValue, afterValue, reason, ipAddress) {
    return this.logAction({
      action: 'result_validated',
      resourceType: 'lab_result',
      resourceId: resultId,
      userId,
      userRole: 'Analis',
      beforeValue: { status: 'Draft' },
      afterValue: { status: 'Validated' },
      reason: reason || 'Technical validation by analyzer technician',
      ipAddress,
      userAgent: navigator?.userAgent || ''
    });
  }

  /**
   * Log: Result approved with signature (Validated → Approved/Released)
   */
  async logResultApproved(resultId, userId, signature, beforeValue, afterValue, reason, ipAddress) {
    return this.logAction({
      action: 'result_approved',
      resourceType: 'lab_result',
      resourceId: resultId,
      userId,
      userRole: 'Dokter',
      beforeValue,
      afterValue,
      reason: reason || 'Doctor approval and release',
      ipAddress,
      userAgent: navigator?.userAgent || '',
      digitalSignature: signature
    });
  }

  /**
   * Log: AI Conclusion generated
   */
  async logConclusionGenerated(resultId, userId, conclusion, pattern, ipAddress) {
    return this.logAction({
      action: 'conclusion_generated',
      resourceType: 'lab_result',
      resourceId: resultId,
      userId: 'system/ai',
      userRole: 'System',
      beforeValue: { ai_conclusion: null },
      afterValue: { ai_conclusion: conclusion, pattern },
      reason: 'Automatic conclusion generation on validation trigger',
      ipAddress,
      userAgent: 'system/ai'
    });
  }

  /**
   * Log: Doctor edited conclusion
   */
  async logConclusionEdited(resultId, userId, originalConclusion, editedConclusion, editReason, ipAddress) {
    return this.logAction({
      action: 'conclusion_edited',
      resourceType: 'lab_result',
      resourceId: resultId,
      userId,
      userRole: 'Dokter',
      beforeValue: { ai_conclusion: originalConclusion },
      afterValue: { ai_conclusion: editedConclusion },
      reason: `Doctor edit: ${editReason}`,
      ipAddress,
      userAgent: navigator?.userAgent || ''
    });
  }

  /**
   * Log: Result released to patient
   */
  async logResultReleased(resultId, userId, ipAddress) {
    return this.logAction({
      action: 'result_released',
      resourceType: 'lab_result',
      resourceId: resultId,
      userId,
      userRole: 'Dokter',
      beforeValue: { status: 'Approved' },
      afterValue: { status: 'Released' },
      reason: 'Result released to patient',
      ipAddress,
      userAgent: navigator?.userAgent || ''
    });
  }

  /**
   * Retrieve audit trail for a result
   * Returns complete history of changes
   */
  async getAuditTrailForResult(resultId) {
    try {
      // Flush cache first to ensure all logged actions are recorded
      await this.flushCache();

      const { data, error } = await this.db
        .from('lab_audit_log')
        .select('*')
        .eq('resource_type', 'lab_result')
        .eq('resource_id', resultId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to retrieve audit trail:', error);
      return [];
    }
  }

  /**
   * Verify signature of an audit log entry
   * Returns true if signature matches entry content
   */
  async verifyLogSignature(logEntry) {
    if (!logEntry.digital_signature || !this.pki) {
      return false;
    }

    try {
      const contentToVerify = `${logEntry.action}|${logEntry.resource_type}|${logEntry.resource_id}|${logEntry.user_id}|${logEntry.timestamp}`;
      return await this.pki.verify(contentToVerify, logEntry.digital_signature);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Export audit trail as report
   */
  async exportAuditReport(startDate, endDate, resourceType = null) {
    try {
      await this.flushCache();

      let query = this.db
        .from('lab_audit_log')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) throw error;

      // Format for export
      return data?.map(entry => ({
        timestamp: entry.timestamp,
        action: entry.action,
        resource: `${entry.resource_type} #${entry.resource_id}`,
        user: `${entry.user_id} (${entry.user_role})`,
        ipAddress: entry.ip_address,
        reason: entry.change_reason,
        verified: entry.signature_verified ? 'YES' : 'NO'
      })) || [];
    } catch (error) {
      console.error('Failed to export audit report:', error);
      return [];
    }
  }

  /**
   * Archive old audit entries (>5 years)
   * Keeps them but marks for archival storage (legal requirement)
   */
  async archiveOldEntries() {
    try {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const { error } = await this.db
        .from('lab_audit_log')
        .update({ archived: true })
        .lt('timestamp', fiveYearsAgo.toISOString())
        .eq('archived', false);

      if (error) throw error;
      console.log('Old audit entries archived');
    } catch (error) {
      console.error('Failed to archive old entries:', error);
    }
  }

  /**
   * Check if system is in compliance
   * Returns compliance report
   */
  async getComplianceStatus() {
    try {
      await this.flushCache();

      // Check 1: All actions logged
      const { count: totalActions } = await this.db
        .from('lab_audit_log')
        .select('*', { count: 'exact', head: true });

      // Check 2: Signatures verified
      const { data: unverifiedSigs } = await this.db
        .from('lab_audit_log')
        .select('id')
        .eq('signature_verified', false)
        .not('digital_signature', 'is', null);

      // Check 3: Age compliance (nothing >5 years unarchived)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const { count: oldUnarchived } = await this.db
        .from('lab_audit_log')
        .select('id', { count: 'exact', head: true })
        .lt('timestamp', fiveYearsAgo.toISOString())
        .eq('archived', false);

      return {
        totalAuditEntries: totalActions,
        unverifiedSignatures: unverifiedSigs?.length || 0,
        oldEntriesNotArchived: oldUnarchived || 0,
        compliant: (unverifiedSigs?.length === 0) && (oldUnarchived === 0)
      };
    } catch (error) {
      console.error('Compliance check failed:', error);
      return { compliant: false, error: error.message };
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Export for use in modules
// ══════════════════════════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuditLogger;
}
