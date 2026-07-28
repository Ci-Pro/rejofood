#!/bin/bash
# Switch Prisma provider antara SQLite (dev) dan PostgreSQL (production)
#
# Usage:
#   ./scripts/switch-db.sh sqlite     # untuk local dev
#   ./scripts/switch-db.sh postgres   # untuk production (Neon/Vercel)
#
# Setelah switch, jalankan: bun run db:generate && bun run db:push

set -e

SCHEMA="prisma/schema.prisma"
TARGET="${1:-postgres}"

if [ ! -f "$SCHEMA" ]; then
  echo "❌ File $SCHEMA tidak ditemukan"
  exit 1
fi

case "$TARGET" in
  sqlite|postgres|postgresql)
    if [ "$TARGET" = "postgresql" ]; then TARGET="postgres"; fi
    ;;
  *)
    echo "Usage: $0 [sqlite|postgres]"
    echo "  sqlite   — untuk local development"
    echo "  postgres — untuk production (Neon, Vercel, dll)"
    exit 1
    ;;
esac

# Backup current schema
cp "$SCHEMA" "${SCHEMA}.bak"

# Replace provider
if [ "$(uname)" = "Darwin" ]; then
  # macOS sed
  sed -i '' "s/provider = \"sqlite\"/provider = \"$TARGET\"/" "$SCHEMA"
  sed -i '' "s/provider = \"postgres\"/provider = \"$TARGET\"/" "$SCHEMA"
else
  # GNU sed (Linux)
  sed -i "s/provider = \"sqlite\"/provider = \"$TARGET\"/" "$SCHEMA"
  sed -i "s/provider = \"postgres\"/provider = \"$TARGET\"/" "$SCHEMA"
fi

# Verify
CURRENT=$(grep "^provider" "$SCHEMA" | head -1 | awk -F'"' '{print $2}')
echo "✅ Schema switched to: $CURRENT"
echo "Current provider line:"
grep -n "provider" "$SCHEMA" | head -2

echo ""
echo "Next steps:"
echo "  bun run db:generate   # regenerate Prisma Client"
echo "  bun run db:push       # sync schema to DB"
echo ""
if [ "$TARGET" = "postgres" ]; then
  echo "⚠️  Pastikan DATABASE_URL di .env points ke Neon Postgres connection string"
else
  echo "⚠️  Pastikan DATABASE_URL di .env = file:./db/custom.db"
fi
