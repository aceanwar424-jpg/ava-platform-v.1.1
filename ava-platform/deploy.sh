#!/bin/bash
# ═══════════════════════════════════════
# OneLab Deploy Script — push changed files only
# Usage: bash deploy.sh "pesan commit"
# ═══════════════════════════════════════

MSG="${1:-update}"

echo "🔍 Cek file yang berubah..."
CHANGED=$(git diff --name-only HEAD 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)

ALL="$CHANGED"$'\n'"$UNTRACKED"
ALL=$(echo "$ALL" | grep -v '^$' | sort -u)

if [ -z "$ALL" ]; then
  echo "✅ Tidak ada perubahan. Sudah up to date."
  exit 0
fi

echo ""
echo "📋 File yang akan di-push:"
echo "$ALL" | while read f; do
  if git ls-files --error-unmatch "$f" &>/dev/null 2>&1; then
    echo "  ✏️  MODIFIED: $f"
  else
    echo "  ➕ NEW:      $f"
  fi
done

echo ""
read -p "Lanjut push dengan pesan: \"$MSG\" ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Dibatalkan."
  exit 1
fi

git add $ALL
git commit -m "$MSG"
git push

echo ""
echo "✅ Deploy selesai!"
