const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const boundaryFile = path.join(ROOT, 'config', 'application-boundaries.json');
const domainFile = path.join(ROOT, 'config', 'domain.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
  throw new Error(message);
}

const registry = readJson(boundaryFile);
const domains = readJson(domainFile);
const sites = new Map(domains.situs.map((site) => [site.kunci, site]));
const assigned = new Map();

for (const [boundaryId, boundary] of Object.entries(registry.boundaries)) {
  if (!boundary.purpose || !boundary.owner) fail(`${boundaryId}: purpose/owner wajib diisi`);
  if (!Array.isArray(boundary.domains) || boundary.domains.length === 0) {
    fail(`${boundaryId}: domains wajib berisi minimal satu domain`);
  }
  for (const domainId of boundary.domains) {
    if (!sites.has(domainId)) fail(`${boundaryId}: domain '${domainId}' tidak ada di config/domain.json`);
    if (assigned.has(domainId)) fail(`Domain '${domainId}' terdaftar di dua boundary: ${assigned.get(domainId)}, ${boundaryId}`);
    assigned.set(domainId, boundaryId);
  }
  for (const entrypoint of boundary.entrypoints || []) {
    if (!fs.existsSync(path.join(ROOT, 'ava-platform', entrypoint))) {
      fail(`${boundaryId}: entrypoint tidak ditemukan: ava-platform/${entrypoint}`);
    }
  }
  for (const legacyRoot of boundary.legacy_roots || []) {
    if (!fs.existsSync(path.join(ROOT, legacyRoot))) {
      fail(`${boundaryId}: legacy root tidak ditemukan: ${legacyRoot}`);
    }
  }
}

for (const site of domains.situs) {
  if (!assigned.has(site.kunci)) fail(`Situs '${site.kunci}' belum memiliki boundary`);
}

console.log(`✓ ${Object.keys(registry.boundaries).length} application boundaries valid`);
console.log(`✓ ${assigned.size}/${sites.size} domain terpetakan satu kali`);
console.log('✓ Semua entrypoint dan legacy root tersedia');
