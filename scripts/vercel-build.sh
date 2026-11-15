#!/usr/bin/env bash
# Vercel build: the new design at the root, the classic app at /classic/.
# Every push to main (including the data refreshes every 3 hours) redeploys.
set -euo pipefail
rm -rf vercel-dist
(cd web && npx vite build --outDir ../vercel-dist/classic --emptyOutDir)
(cd web-v2 && BIOME_TARGET=vercel VITE_BASE_HREF=/ npx vite build --outDir ../vercel-dist --emptyOutDir false)
echo "built: $(du -sh vercel-dist | cut -f1)"
