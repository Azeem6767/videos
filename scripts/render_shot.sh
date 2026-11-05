#!/usr/bin/env bash
# scripts/render_shot.sh — render one shot of a composition (README §7: per-shot renders,
# concurrency 1 is already set in remotion.config.ts).
# usage: scripts/render_shot.sh <compId> <fromFrame> <toFrame> <out.mp4>
set -euo pipefail
cd "$(dirname "$0")/.."
comp="$1"; from="$2"; to="$3"; out="$4"
mkdir -p "$(dirname "$out")"
npx remotion render src/index.ts "$comp" "$out" --frames="$from-$to" --log=verbose
