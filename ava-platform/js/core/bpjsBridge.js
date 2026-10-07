// BPJS is not provisioned. Credentials/signing belong on a tenant-authorized server.
const BPJS_BRIDGE = {
  configKey: 'ava_bpjs_bridge_config',
  getConfig() { return { enabled: false, status: 'not_connected' }; },
  integrationError() {
    const error = new Error('Integrasi BPJS belum tersambung. Gunakan proses resmi dan catat SEP/tarif secara manual pada modul klaim.');
    error.code = 'BPJS_NOT_CONNECTED';
    return error;
  },
  saveConfig() { throw this.integrationError(); },
  async generateSignature() { throw this.integrationError(); },
  async getAuthHeaders() { throw this.integrationError(); },
  async cariPesertaByNIK() { throw this.integrationError(); },
  async createSEP() { throw this.integrationError(); }
};
// Remove obsolete browser credential cache without reading/exporting its values.
try { localStorage.removeItem(BPJS_BRIDGE.configKey); } catch (_) {}
window.BPJS_BRIDGE = BPJS_BRIDGE;
