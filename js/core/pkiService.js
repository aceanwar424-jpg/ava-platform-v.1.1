// ══════════════════════════════════════════════════════════════════════════════
// OneLab · Laboratory Information System
// Service: PKI (Public Key Infrastructure) for Digital Signatures
// Purpose: Non-repudiation for legal compliance (ISO 15189)
// Note: This uses self-signed certificates for MVP (no budget)
// Production: Should integrate with commercial CA or gov't PKI
// ══════════════════════════════════════════════════════════════════════════════

/**
 * PKIService: Digital signature generation and verification
 * Used for:
 * 1. Approval signatures (doctor approval binding)
 * 2. Audit log signatures (non-repudiation)
 * 3. Certificate management
 *
 * MVP Implementation: Self-signed RSA-256
 * - Uses built-in Web Crypto API (no external dependency)
 * - Generates base64-encoded signatures
 * - Stores public keys in lab_pki_keys table
 */
class PKIService {
  constructor(supabaseClient) {
    this.db = supabaseClient;
    this.keyCache = new Map(); // Cache public keys in memory
    this.algorithm = {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256'
    };
  }

  /**
   * Generate key pair for a user
   * Called once per doctor/analyst when account created
   * Private key never stored in DB (security!)
   * Private key stored in browser sessionStorage or passed via env
   */
  async generateKeyPair(userId, userName) {
    try {
      // Generate keypair
      const keyPair = await window.crypto.subtle.generateKey(
        this.algorithm,
        true, // extractable
        ['sign', 'verify']
      );

      // Export public key to PEM
      const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const publicKeyPem = this._jwkToPem(publicKeyJwk);

      // Calculate fingerprint (for quick lookup)
      const fingerprint = await this._calculateFingerprint(publicKeyPem);

      // Save public key to DB
      const { data, error } = await this.db
        .from('lab_pki_keys')
        .insert({
          key_id: userId,
          key_type: 'User',
          key_owner: userName,
          public_key_pem: publicKeyPem,
          public_key_fingerprint: fingerprint,
          algorithm: 'RS256',
          key_size: 2048,
          created_at: new Date(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        })
        .select()
        .single();

      if (error) throw error;

      // IMPORTANT: Return private key for storage in session/local secure storage
      // Client must save this securely
      const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

      return {
        userId,
        userName,
        publicKey: publicKeyPem,
        publicKeyFingerprint: fingerprint,
        privateKeyJwk, // Client stores this securely
        expiresAt: data.expires_at
      };
    } catch (error) {
      console.error('PKI key generation failed:', error);
      throw error;
    }
  }

  /**
   * Sign a document or action
   * Requires private key in JWK format (stored in browser)
   */
  async sign(content, privateKeyJwk) {
    try {
      // Import private key
      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        this.algorithm,
        false, // not extractable again
        ['sign']
      );

      // Sign the content
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const signature = await window.crypto.subtle.sign(
        this.algorithm.name,
        privateKey,
        data
      );

      // Return as base64
      return btoa(String.fromCharCode.apply(null, new Uint8Array(signature)));
    } catch (error) {
      console.error('Signing failed:', error);
      throw error;
    }
  }

  /**
   * Verify a signature against a document
   * Uses public key from DB
   */
  async verify(content, signature, userId) {
    try {
      // Get public key
      let publicKey = this.keyCache.get(userId);
      if (!publicKey) {
        publicKey = await this._loadPublicKey(userId);
        if (!publicKey) return false;
      }

      // Decode signature from base64
      const binaryString = atob(signature);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Verify
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const isValid = await window.crypto.subtle.verify(
        this.algorithm.name,
        publicKey,
        bytes.buffer,
        data
      );

      return isValid;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Create approval signature
   * Data includes: result_id, approved_by, timestamp, conclusion
   */
  async signApproval(resultId, approvedBy, timestamp, conclusion, privateKeyJwk) {
    const contentToSign = `APPROVAL|${resultId}|${approvedBy}|${timestamp}|${conclusion}`;
    return this.sign(contentToSign, privateKeyJwk);
  }

  /**
   * Verify approval signature
   */
  async verifyApproval(resultId, approvedBy, timestamp, conclusion, signature) {
    const contentToVerify = `APPROVAL|${resultId}|${approvedBy}|${timestamp}|${conclusion}`;
    return this.verify(contentToVerify, signature, approvedBy);
  }

  /**
   * Load public key from DB and cache it
   */
  async _loadPublicKey(userId) {
    try {
      const { data, error } = await this.db
        .from('lab_pki_keys')
        .select('*')
        .eq('key_id', userId)
        .eq('revoked', false)
        .single();

      if (error) {
        console.error('Public key not found:', error);
        return null;
      }

      // Import PEM to WebCrypto format
      const publicKey = await this._pemToKey(data.public_key_pem);
      this.keyCache.set(userId, publicKey);
      return publicKey;
    } catch (error) {
      console.error('Failed to load public key:', error);
      return null;
    }
  }

  /**
   * Revoke a key (when user leaves or compromised)
   */
  async revokeKey(userId, reason) {
    try {
      const { error } = await this.db
        .from('lab_pki_keys')
        .update({
          revoked: true,
          revoke_reason: reason,
          revoked_at: new Date()
        })
        .eq('key_id', userId);

      if (error) throw error;
      this.keyCache.delete(userId);
      console.log(`Key revoked for ${userId}: ${reason}`);
    } catch (error) {
      console.error('Key revocation failed:', error);
    }
  }

  /**
   * Calculate SHA-256 fingerprint of public key
   */
  async _calculateFingerprint(pemKey) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pemKey);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
    } catch (error) {
      console.error('Fingerprint calculation failed:', error);
      return null;
    }
  }

  /**
   * Convert JWK public key to PEM format
   */
  _jwkToPem(jwk) {
    // Simplified JWK to PEM conversion
    // In production, use a library like jsrsasign
    const binaryString = String.fromCharCode.apply(null, new Uint8Array(
      Buffer.from(jwk.n, 'base64')
    ));
    return `-----BEGIN PUBLIC KEY-----\n${btoa(binaryString)}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Convert PEM public key to WebCrypto format
   */
  async _pemToKey(pem) {
    try {
      // Extract base64 content from PEM
      const pemBody = pem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\n/g, '');

      const binaryString = atob(pemBody);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Import as SPKI format
      return await window.crypto.subtle.importKey(
        'spki',
        bytes.buffer,
        this.algorithm,
        true,
        ['verify']
      );
    } catch (error) {
      console.error('PEM to Key conversion failed:', error);
      return null;
    }
  }

  /**
   * List all valid keys (for debugging/admin)
   */
  async listAllKeys() {
    try {
      const { data, error } = await this.db
        .from('lab_pki_keys')
        .select('key_id, key_owner, created_at, expires_at, revoked')
        .eq('revoked', false);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to list keys:', error);
      return [];
    }
  }

  /**
   * Check expiry of all keys
   * Returns keys about to expire (within 30 days)
   */
  async getExpiringKeys() {
    try {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await this.db
        .from('lab_pki_keys')
        .select('key_id, key_owner, expires_at')
        .eq('revoked', false)
        .lt('expires_at', thirtyDaysFromNow.toISOString());

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to check expiring keys:', error);
      return [];
    }
  }

  /**
   * Renew/rotate a key (generate new key, keep old as archived)
   */
  async rotateKey(userId, userName) {
    try {
      // Revoke old key
      await this.revokeKey(userId, 'Key rotated - new key generated');

      // Generate new key
      return await this.generateKeyPair(userId, userName);
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Export for use in modules
// ══════════════════════════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PKIService;
}
