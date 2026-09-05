# AVA Health public website redesign — 2026-09-05

OWNED_BY: ava

## Sources and limits
- `ava-platform/portal.html` before redesign: PT AVA Health Solution; six AVA/Queen brand pairs; clinical, diagnostic, technology, personal care, nutrition and sanctuary business descriptions; WhatsApp +62 821-2007-1009 and admin@avahealth.sbs.
- `config/domain.json`: www/apex routes to portal.html; apps.avahealth.sbs is the customer application. HIS/LIS and other subdomains remain operational.
- Direct public website inspection was attempted through web retrieval and HTTPS. Retrieval failed; the local network reported socket access forbidden. No claim that the deployed site was visually inspected.
- Existing `apps/doctors.jpg` reused as a clearly labelled illustration, not a representation of the actual AVA team.

## Editorial decisions
- Use AVA brand naming consistently; do not invent Queen-to-AVA rebranding chronology or separate legal subsidiaries.
- Retain six business areas and broad service/product categories. Describe development areas without claiming product launch, stock availability, clinical efficacy, or licensing readiness.
- Replace unsubstantiated 2020–2026 timeline with a qualitative account of origins and direction. Exact incorporation/founding dates require primary corporate records.
- No accreditation seals or registration numbers without verified supporting documents. The certification section explicitly states that verified certificates are not displayed.
- Do not publish fabricated address, opening hours, leadership title, registration number, patient testimonial, or performance statistic.

## Remaining content verification
Obtain official brand history and naming, corporate registration details, service locations, approved product catalogue, current contact ownership, and certification documents (holder, scope, number, issuer, validity, verification link). This is an editorial checklist, not a claim that AVA lacks these credentials.

## Scope and delivery
No master data, clinical reference ranges, patient records, authentication implementation, vendor integration, or operational application changes. Public assets remain static and use the existing Vercel routing. Standalone web export includes only the public entry and required assets. Production publication has not been performed.

## Verification
`node scripts/verify-public-profile.js`; `node --check ava-platform/js/public-profile.js`; `node scripts/bangun-vercel.js --periksa`. Local HTTP preview and asset responses checked separately. Browser visual/interaction testing not performed.
