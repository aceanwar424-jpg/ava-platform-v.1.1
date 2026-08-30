# Repo Map (BACA DULU sebelum eksplorasi)
Untuk tugas apa pun di codebase ini, **konsultasi `.claude/MAP.md` lebih dulu** untuk menemukan
file + nama fungsi yang relevan, lalu Grep fungsi itu dan baca hanya bagiannya — **jangan baca
seluruh file besar**. Cek bagian "Jebakan" di MAP sebelum menulis kode. Setelah mengubah struktur
(tambah/hapus fungsi, kolom DB, atau konvensi), **perbarui baris `.claude/MAP.md` yang terkait**.
MAP.md menyimpan realita skema, konvensi, dan jebakan yang tidak bisa di-derive dari kode.

# graphify (sekunder)
- **graphify** (`.claude/skills/graphify/SKILL.md`) - knowledge graph untuk "cari simbol X" di file
  yang belum dikenal. Trigger: `/graphify`. Utamakan MAP.md; graphify hanya pelengkap.
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
