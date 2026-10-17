# Archive Log — QMS artifacts (2026-10-17)

The following artifacts were marked for archival and pointer metadata files were created under `docs/archive/`.

- data/qms_registry_synced.json -> docs/archive/qms_registry_synced.json.meta
- data/sync_qms_to_db.sql -> docs/archive/sync_qms_to_db.sql.meta

Notes:
- These files are generated artifacts (SSOT & SQL seed). Originals remain in their original paths to preserve continuity for any CI/pipelines until an explicit deletion audit is requested and approved.
- Audit record: docs/audit-evidence/housekeeping-archive-qms-2026-10-17.json

Next steps:
1. Team review the pointers and decide which items are "obsolete" and safe to delete from repo history.
2. On approval, request a follow-up housekeeping run to remove originals and record deletion in audit-evidence.

Signed-off-by: aceanwar424-jpg
