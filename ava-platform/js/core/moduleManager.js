// ═══════════════════════════════════════════════════════════════
// AVA GLOBAL ECOSYSTEM — Modular Package & Licensing Manager
// Memungkinkan aktivasi modul fleksibel untuk klien B2B SaaS (AVA Tech)
// dan mode 'master_holding' untuk operasional penuh internal holding.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const PRESETS = {
    starter_lis: {
      name: "Starter LIS (Diagnostic Laboratory)",
      enabled_modules: ["lab", "inventory", "produktivitas", "wiki", "konfigurasi"],
      features: {
        all_modules: false,
        worklist: true,
        barcode_sampling: true,
        lab_connector_astm_hl7: true,
        smart_qc_westgard: true,
        delta_check: true,
        critical_alarm: true,
        emr_soap: false,
        pharmacy: false,
        wellness_spa: false,
        ceo_cockpit: false
      }
    },
    clinic_pratama: {
      name: "Clinic Pratama HIS",
      enabled_modules: ["utama", "klinik", "finance", "produktivitas", "konfigurasi"],
      features: {
        all_modules: false,
        pendaftaran: true,
        kiosk_antrian: true,
        emr_soap: true,
        billing_pos: true,
        lab_connector_astm_hl7: false,
        satusehat_integration: true,
        pharmacy: true,
        wellness_spa: false,
        ceo_cockpit: false
      }
    },
    enterprise_faskes: {
      name: "Enterprise Faskes (Klinik Utama / RS)",
      enabled_modules: ["utama", "marketing", "administration", "lab", "klinik", "homecare", "finance", "inventory", "hrd", "produktivitas", "wiki", "agentic", "konfigurasi"],
      features: {
        all_modules: false,
        worklist: true,
        lab_connector_astm_hl7: true,
        emr_soap: true,
        e_prescription: true,
        satusehat_integration: true,
        corporate_portal: true,
        sap_mm_logistics: true,
        sap_fico_finance: true,
        sap_hcm_hrd: true
      }
    },
    master_holding: {
      name: "Master Holding (Internal & CEO Console)",
      enabled_modules: ["utama", "ceo_cockpit", "marketing", "administration", "lab", "klinik", "homecare", "avahealth", "fmcg", "sanctuary", "corporate", "finance", "inventory", "hrd", "produktivitas", "wiki", "agentic", "konfigurasi"],
      features: {
        all_modules: true,
        ceo_cockpit: true
      }
    }
  };

  const DEFAULT_CONFIG = {
    platform: "AVA GLOBAL ECOSYSTEM",
    active_preset: "master_holding",
    client_id: "AVA-HOLDING-MASTER",
    client_name: "PT AVA HEALTH SOLUTION",
    enabled_modules: PRESETS.master_holding.enabled_modules,
    features: PRESETS.master_holding.features
  };

  class ModuleManager {
    constructor() {
      this.config = Object.assign({}, DEFAULT_CONFIG);
      this.loadConfig();
      this.detectSubdomainContext();
    }

    loadConfig() {
      try {
        const stored = localStorage.getItem('AVA_MODULES_CONFIG');
        if (stored) {
          this.config = Object.assign({}, DEFAULT_CONFIG, JSON.parse(stored));
        }
      } catch (e) {
        console.warn('[AVA ModuleManager] Memakai konfigurasi default:', e);
      }
    }

    detectSubdomainContext() {
      try {
        const host = window.location.hostname.toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);
        const appParam = urlParams.get('app');
        const presetParam = urlParams.get('preset');

        if (presetParam && PRESETS[presetParam]) {
          this.setPreset(presetParam, PRESETS[presetParam]);
          return;
        }

        // Auto-isolate for LIS Subdomain
        if (host.startsWith('lis.') || appParam === 'lis') {
          console.log('[AVA ModuleManager] Subdomain LIS Terdeteksi -> Mengaktifkan Preset Starter LIS');
          this.setPreset('starter_lis', PRESETS.starter_lis);
          return;
        }

        // Auto-isolate for HIS Subdomain
        if (host.startsWith('his.') || appParam === 'his') {
          if (this.config.active_preset === 'starter_lis') {
            this.setPreset('master_holding', PRESETS.master_holding);
          }
        }
      } catch (e) {
        console.warn('[AVA ModuleManager] Gagal mendeteksi subdomain:', e);
      }
    }

    saveConfig(newConfig) {
      this.config = Object.assign({}, this.config, newConfig);
      try {
        localStorage.setItem('AVA_MODULES_CONFIG', JSON.stringify(this.config));
      } catch (e) {
        console.error('[AVA ModuleManager] Gagal menyimpan config:', e);
      }
    }

    setPreset(presetKey, presetData) {
      if (presetData && presetData.enabled_modules) {
        this.config.active_preset = presetKey;
        this.config.enabled_modules = presetData.enabled_modules;
        this.config.features = presetData.features || {};
        this.saveConfig(this.config);
        this.applyModuleVisibility();
      }
    }

    isModuleEnabled(moduleId) {
      if (this.config.features && this.config.features.all_modules) return true;
      if (!this.config.enabled_modules) return true;
      return this.config.enabled_modules.includes(moduleId);
    }

    hasFeature(featureKey) {
      if (this.config.features && this.config.features.all_modules) return true;
      if (!this.config.features) return false;
      return !!this.config.features[featureKey];
    }

    applyModuleVisibility() {
      // Sembunyikan atau tampilkan menu rail navigasi berdasarkan modul aktif
      const railButtons = document.querySelectorAll('.rail-item[data-cat]');
      railButtons.forEach(btn => {
        const cat = btn.getAttribute('data-cat');
        if (cat) {
          if (this.isModuleEnabled(cat)) {
            btn.style.display = '';
          } else {
            btn.style.display = 'none';
          }
        }
      });
    }
  }

  window.avaModuleManager = new ModuleManager();

  document.addEventListener('DOMContentLoaded', () => {
    window.avaModuleManager.detectSubdomainContext();
    window.avaModuleManager.applyModuleVisibility();
  });
})();
