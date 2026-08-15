/**
 * Provider-Agnostic LLM Adapter (Rule §4.4)
 * Menjamin sistem tidak terkunci pada satu vendor AI.
 * Mendukung OpenAI, Anthropic, Gemini API, dan Local/Mock Provider.
 * Menggunakan parsing berbasis Delimiter [[SECTION_NAME]] bukan JSON murni.
 */

class LLMAdapter {
  constructor(config = {}) {
    this.provider = config.provider || process.env.LLM_PROVIDER || 'gemini';
    this.apiKey = config.apiKey || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
    this.model = config.model || process.env.LLM_MODEL || 'gemini-1.5-flash';
    this.fallbackProvider = config.fallbackProvider || 'mock';
  }

  /**
   * Universal completion wrapper
   * @param {Object} options 
   * @param {string} options.prompt 
   * @param {string} [options.systemPrompt] 
   * @param {number} [options.temperature=0.2] 
   * @param {number} [options.maxTokens=4096] 
   * @returns {Promise<{text: string, sections: Object, provider: string, model: string}>}
   */
  async generateCompletion(options) {
    const { prompt, systemPrompt = '', temperature = 0.2, maxTokens = 4096 } = options;

    try {
      let rawText = '';
      if (this.provider === 'gemini') {
        rawText = await this._callGemini(prompt, systemPrompt, temperature, maxTokens);
      } else if (this.provider === 'openai') {
        rawText = await this._callOpenAI(prompt, systemPrompt, temperature, maxTokens);
      } else if (this.provider === 'anthropic') {
        rawText = await this._callAnthropic(prompt, systemPrompt, temperature, maxTokens);
      } else {
        rawText = await this._callMock(prompt);
      }

      const sections = this.parseDelimiters(rawText);
      return {
        text: rawText,
        sections,
        provider: this.provider,
        model: this.model,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.warn(`[LLMAdapter] Error pada provider ${this.provider}: ${err.message}. Menggunakan fallback mock.`);
      const rawText = await this._callMock(prompt);
      return {
        text: rawText,
        sections: this.parseDelimiters(rawText),
        provider: 'mock-fallback',
        model: 'mock',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Menelaah teks bertanda [[SECTION_NAME]] menjadi objek terstruktur (Rule §4.4)
   * @param {string} text 
   * @returns {Object<string, string>}
   */
  parseDelimiters(text) {
    const sections = {};
    if (!text || typeof text !== 'string') return sections;

    const regex = /\[\[([A-Z0-9_]+)\]\]\s*([\s\S]*?)(?=\[\[[A-Z0-9_]+\]\]|$)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const sectionName = match[1].trim().toUpperCase();
      const content = match[2].trim();
      sections[sectionName] = content;
    }

    if (Object.keys(sections).length === 0) {
      sections['CONTENT'] = text.trim();
    }

    return sections;
  }

  async _callGemini(prompt, systemPrompt, temperature, maxTokens) {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY tidak dikonfigurasi');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: (systemPrompt ? `${systemPrompt}\n\n` : '') + prompt }] }
        ],
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async _callOpenAI(prompt, systemPrompt, temperature, maxTokens) {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY tidak dikonfigurasi');
    const url = 'https://api.openai.com/v1/chat/completions';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model || 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async _callAnthropic(prompt, systemPrompt, temperature, maxTokens) {
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY tidak dikonfigurasi');
    const url = 'https://api.anthropic.com/v1/messages';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model || 'claude-3-5-sonnet-20241022',
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async _callMock(prompt) {
    return `[[STATUS]]\nCOMPLETED_MOCK\n\n[[RESULT_HEADER]]\nSimulasi Eksekusi Multi-Lab Engine\n\n[[CONTENT]]\nHasil analisis dokumen sintetis berdasarkan prompt: ${prompt.slice(0, 100)}...\n\n[[ISO_CLAUSE_SUMMARY]]\nLolos Pengecekan ISO 15189:2022 Klausul 5.3 (Fasilitas) & 6.4 (Peralatan).`;
  }
}

module.exports = { LLMAdapter };
