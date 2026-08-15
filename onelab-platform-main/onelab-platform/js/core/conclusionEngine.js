// ══════════════════════════════════════════════════════════════════════════════
// OneLab · Laboratory Information System
// Service: Auto-Conclusion Generation Engine (AI-powered clinical summaries)
// Purpose: Generate clinically appropriate conclusions for lab results
// Trigger: Called on result validation; doctor can review/edit on approval
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ConclusionEngine: Rule-based AI conclusion generation
 * Analyzes result values, reference ranges, delta changes, critical flags
 * Generates professional clinical summaries for doctor review
 */
class ConclusionEngine {
  constructor(db, supabaseClient) {
    this.db = db;
    this.supabaseClient = supabaseClient;
    this.templates = new Map();
    this.rules = this._buildRuleEngine();
  }

  /**
   * Main entry point: Generate conclusion for a single result
   * @param {Object} result - lab_results row from DB
   * @param {Object} previousResult - last result for this patient/test (for delta)
   * @param {Object} refRange - reference range applied
   * @returns {Promise<{conclusion: string, generated_at: Date, generated_by: string}>}
   */
  async generateConclusion(result, previousResult, refRange) {
    try {
      // Step 1: Load templates for this test
      const templates = await this._loadTemplatesForProduct(result.product_id);
      if (!templates || templates.length === 0) {
        console.warn(`No templates found for product ${result.product_id}, generating generic`);
        return this._generateGenericConclusion(result, previousResult, refRange);
      }

      // Step 2: Determine result pattern (high/low/critical/delta/abnormal)
      const pattern = this._classifyResult(result, refRange, previousResult);

      // Step 3: Match best template for pattern
      const bestTemplate = this._selectBestTemplate(pattern, templates);

      // Step 4: Render conclusion from template
      const conclusion = await this._renderConclusion(
        bestTemplate,
        result,
        previousResult,
        refRange,
        pattern
      );

      return {
        conclusion,
        generated_at: new Date(),
        generated_by: 'system/ai',
        pattern_used: pattern
      };
    } catch (error) {
      console.error('ConclusionEngine.generateConclusion error:', error);
      // Fallback to generic conclusion if AI fails
      return this._generateGenericConclusion(result, previousResult, refRange);
    }
  }

  /**
   * Classify result into pattern category
   * Returns: 'critical' | 'high' | 'low' | 'delta_high' | 'delta_low' | 'abnormal' | 'normal'
   */
  _classifyResult(result, refRange, previousResult) {
    const numeric = result.result_numeric;

    // Check 1: Critical values (highest priority)
    if (result.is_critical || numeric >= result.critical_high || numeric <= result.critical_low) {
      return 'critical';
    }

    // Check 2: High/Low values (vs normal range)
    if (numeric > refRange?.normal_max) {
      return 'high';
    }
    if (numeric < refRange?.normal_min) {
      return 'low';
    }

    // Check 3: Delta check (significant change from previous)
    if (previousResult?.result_numeric) {
      const deltaPct = Math.abs((numeric - previousResult.result_numeric) / previousResult.result_numeric * 100);
      if (deltaPct > 30) {
        return numeric > previousResult.result_numeric ? 'delta_high' : 'delta_low';
      }
    }

    // Check 4: Abnormal interpretation (qualitative tests)
    if (result.interpretation && result.interpretation.toLowerCase() !== 'normal') {
      return 'abnormal';
    }

    return 'normal';
  }

  /**
   * Select best matching template for the result pattern
   */
  _selectBestTemplate(pattern, templates) {
    // Priority: exact pattern match > generic template
    let best = templates.find(t => t.pattern_type === pattern);
    if (!best) {
      best = templates.find(t => t.pattern_type === 'normal');
    }
    if (!best) {
      best = templates[0]; // fallback to first
    }
    return best;
  }

  /**
   * Render conclusion by substituting template variables with actual values
   * Template variables:
   *   {{TEST}} = test name
   *   {{VALUE}} = result value
   *   {{UNIT}} = unit
   *   {{NORMAL_RANGE}} = e.g. "70-100"
   *   {{TREND}} = "Increased from..." or "Decreased from..."
   *   {{INTERPRETATION}} = Clinical interpretation
   *   {{RECOMMENDATION}} = Suggested action
   *   {{STATUS}} = Normal/Abnormal/Critical
   */
  async _renderConclusion(template, result, previousResult, refRange, pattern) {
    let text = template.conclusion_template || '';

    // Build context variables
    const ctx = {
      TEST: result.product_name || 'Test',
      VALUE: result.result_numeric?.toFixed(2) || result.result_value,
      UNIT: result.unit || '',
      NORMAL_RANGE: refRange ? `${refRange.normal_min}-${refRange.normal_max}` : 'N/A',
      INTERPRETATION: this._getInterpretationText(pattern, result),
      RECOMMENDATION: template.recommendation || '',
      STATUS: this._getStatusEmoji(pattern) + ' ' + pattern.toUpperCase(),
      TREND: this._getTrendText(result, previousResult),
      CONDITION: result.condition_name || 'Abnormality detected',
      CLINICAL_NOTE: template.clinical_note || ''
    };

    // Substitute variables
    for (const [key, value] of Object.entries(ctx)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      text = text.replace(placeholder, value);
    }

    return text;
  }

  /**
   * Generate generic conclusion if templates unavailable
   */
  _generateGenericConclusion(result, previousResult, refRange) {
    const pattern = this._classifyResult(result, refRange, previousResult);
    const status = this._getStatusEmoji(pattern);

    let conclusion = `${status} ${result.product_name}: `;

    if (pattern === 'critical') {
      conclusion += `KRITIS ${result.result_numeric}${result.unit}. Perlu evaluasi URGENT.`;
    } else if (pattern === 'high') {
      conclusion += `Tinggi ${result.result_numeric}${result.unit} (Normal: ${refRange?.normal_max}). `;
      conclusion += `Lakukan follow-up sesuai protokol.`;
    } else if (pattern === 'low') {
      conclusion += `Rendah ${result.result_numeric}${result.unit} (Normal: ${refRange?.normal_min}). `;
      conclusion += `Lakukan follow-up sesuai protokol.`;
    } else if (pattern === 'delta_high') {
      conclusion += `Meningkat signifikan ke ${result.result_numeric}${result.unit}. `;
      if (previousResult) {
        conclusion += `Sebelumnya ${previousResult.result_numeric}. Perlu evaluasi.`;
      }
    } else if (pattern === 'delta_low') {
      conclusion += `Menurun signifikan ke ${result.result_numeric}${result.unit}. `;
      if (previousResult) {
        conclusion += `Sebelumnya ${previousResult.result_numeric}. Perlu evaluasi.`;
      }
    } else {
      conclusion += `Normal ${result.result_numeric}${result.unit}.`;
    }

    return {
      conclusion,
      generated_at: new Date(),
      generated_by: 'system/ai',
      pattern_used: pattern
    };
  }

  /**
   * Get emoji/icon for status
   */
  _getStatusEmoji(pattern) {
    const emojis = {
      'critical': '🚨',
      'high': '⬆️',
      'low': '⬇️',
      'delta_high': '📈',
      'delta_low': '📉',
      'abnormal': '⚠️',
      'normal': '✅'
    };
    return emojis[pattern] || '⚪';
  }

  /**
   * Get interpretation text
   */
  _getInterpretationText(pattern, result) {
    const texts = {
      'critical': 'HASIL KRITIS - Perlu tindakan segera',
      'high': `Meningkat di atas batas normal (${result.unit})`,
      'low': `Menurun di bawah batas normal (${result.unit})`,
      'delta_high': 'Peningkatan signifikan dari hasil sebelumnya',
      'delta_low': 'Penurunan signifikan dari hasil sebelumnya',
      'abnormal': result.interpretation || 'Tidak normal',
      'normal': 'Dalam batas normal'
    };
    return texts[pattern] || 'Hasil lab diperoleh';
  }

  /**
   * Get trend text (comparing to previous result)
   */
  _getTrendText(result, previousResult) {
    if (!previousResult?.result_numeric) {
      return '';
    }

    const prev = previousResult.result_numeric;
    const curr = result.result_numeric;
    const delta = curr - prev;
    const deltaPct = (delta / prev * 100).toFixed(1);

    if (delta > 0) {
      return `(↑ ${Math.abs(deltaPct)}% dari ${prev} sebelumnya)`;
    } else if (delta < 0) {
      return `(↓ ${Math.abs(deltaPct)}% dari ${prev} sebelumnya)`;
    }
    return '';
  }

  /**
   * Load templates from database for a product
   */
  async _loadTemplatesForProduct(productId) {
    try {
      if (!this.db) return [];

      const { data, error } = await this.db
        .from('lab_conclusion_templates')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  }

  /**
   * Build rule engine for complex patterns
   * (Can be extended for advanced ML/rules)
   */
  _buildRuleEngine() {
    return {
      // Add custom rules as needed
      evaluatePattern: (result, refRange) => {
        // This can be extended with complex business logic
        // For now, uses classification in _classifyResult
        return true;
      }
    };
  }

  /**
   * Batch generate conclusions for multiple results
   */
  async generateConclusionsForBatch(results, previousResults = {}, refRanges = {}) {
    const conclusions = {};

    for (const result of results) {
      const prevResult = previousResults[result.id];
      const refRange = refRanges[result.id];

      conclusions[result.id] = await this.generateConclusion(result, prevResult, refRange);
    }

    return conclusions;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Export for use in modules
// ══════════════════════════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConclusionEngine;
}
