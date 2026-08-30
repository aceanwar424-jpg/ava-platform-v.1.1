// ═══════════════════════════════════════════════════════════════
// CORE: RBAC Service — 18 Standard Roles & Clinical K4 Data Guard
// Sesuai Blueprint AVA-DOC-ARCH-2026-V5.1 Bab 16.5, 19 & Bab 20
// ═══════════════════════════════════════════════════════════════

(function(root) {
  const ROLES_DEFINITIONS = {
    SUPERADMIN: {
      name: 'Super Administrator',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['*']
    },
    HQ_EXECUTIVE: {
      name: 'Executive Holding HQ',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['hq/*', '*/dashboard', '*/analytics/*']
    },
    BRAND_MANAGER: {
      name: 'Brand Business Unit Manager',
      brandScope: 'BRAND',
      isClinical: false,
      permissions: ['{brand}/*']
    },
    LEGAL_COMPLIANCE: {
      name: 'Legal & Compliance Officer',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['hq/legal/*', '*/qms/*', '*/compliance/*']
    },
    FINANCE_STAFF: {
      name: 'Finance & Billing Staff',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['*/billing/*', '*/finance/*', 'hq/finance/*']
    },
    HR_ADMIN: {
      name: 'Human Resources Admin',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['*/hr/*', '*/staff/*']
    },
    REGISTRATION: {
      name: 'Front Office & Admisi',
      brandScope: 'BRAND',
      isClinical: false,
      permissions: ['*/pre/registration', '*/pre/checkin', '*/his/admission', '*/queue/*']
    },
    LAB_ANALYST: {
      name: 'Analis Laboratorium',
      brandScope: 'LAB',
      isClinical: true,
      permissions: ['lab/pre/*', 'lab/ana/*', 'lab/qc/*', 'lab/inv/*']
    },
    LAB_SUPERVISOR: {
      name: 'Penyelia Laboratorium',
      brandScope: 'LAB',
      isClinical: true,
      permissions: ['lab/pre/*', 'lab/ana/*', 'lab/qc/*', 'lab/post/validation', 'lab/qms/*']
    },
    DOCTOR_SPPK: {
      name: 'Dokter Sp.PK',
      brandScope: 'LAB',
      isClinical: true,
      permissions: ['lab/post/*', 'lab/ref/*', 'lab/ana/*', 'lab/qms/*']
    },
    DOCTOR_CLINICIAN: {
      name: 'Dokter Poliklinik',
      brandScope: 'HEALTH',
      isClinical: true,
      permissions: ['health/his/*', 'health/corp/fitwork', 'health/apps/doctor']
    },
    NURSE: {
      name: 'Perawat / Bidan',
      brandScope: 'HEALTH',
      isClinical: true,
      permissions: ['health/his/*', 'health/queue/*']
    },
    FIELD_NAKES: {
      name: 'Nakes Lapangan / Home Care',
      brandScope: 'CARE',
      isClinical: true,
      permissions: ['care/service/*', 'care/dispatch/*', 'health/apps/nakes']
    },
    CASHIER: {
      name: 'Kasir POS',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['*/billing/cashier', '*/billing/shift', 'sanct/commerce/pos']
    },
    SALES_CORPORATE: {
      name: 'Corporate MCU Sales',
      brandScope: 'HEALTH',
      isClinical: false,
      permissions: ['health/corp/*', 'crm/*'] // DILARANG akses hasil lab K4 individual
    },
    QUALITY_MANAGER: {
      name: 'Manajer Mutu ISO 15189',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['*/qms/*', '*/qc/*', 'hq/governance/*']
    },
    TECH_ENGINEER: {
      name: 'Software Engineer',
      brandScope: 'TECH',
      isClinical: false,
      permissions: ['tech/*']
    },
    AUDITOR_READONLY: {
      name: 'Auditor Eksternal',
      brandScope: 'ALL',
      isClinical: false,
      permissions: ['*/audit', '*/qms/documents', '*/readiness']
    }
  };

  const RBACService = {
    getRoleDefinition(roleCode) {
      return ROLES_DEFINITIONS[roleCode] || null;
    },

    /**
     * Memeriksa apakah pengguna memiliki hak akses ke route tertentu
     */
    canAccessRoute(userRole, targetRoute, userBrand = 'ALL') {
      if (!userRole) return false;
      const role = ROLES_DEFINITIONS[userRole];
      if (!role) return false;

      // Superadmin memiliki akses universal
      if (role.permissions.includes('*')) return true;

      // Pengecekan brand scope
      const routeBrand = targetRoute.split('/')[0].toUpperCase();
      if (role.brandScope !== 'ALL' && role.brandScope !== routeBrand && userBrand !== 'ALL') {
        return false;
      }

      // Pengecekan pattern permission
      return role.permissions.some(perm => {
        const regex = new RegExp('^' + perm.replace(/\*/g, '.*').replace('{brand}', userBrand.toLowerCase()) + '$');
        return regex.test(targetRoute);
      });
    },

    /**
     * Penegakan ADR-07: Memeriksa apakah peran berhak membaca data medis spesifik K4
     */
    canAccessClinicalData(userRole) {
      const role = ROLES_DEFINITIONS[userRole];
      return role ? Boolean(role.isClinical) : false;
    }
  };

  root.RBACService = RBACService;
})(typeof window !== 'undefined' ? window : global);
