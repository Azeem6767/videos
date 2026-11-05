#!/usr/bin/env bash
# scripts/contact_sheet.sh — low-res contact sheet across a composition (README §7: always make a
# low-res contact sheet first; full res only after approval).
# usage: scripts/contact_sheet.sh <compId> <frames> <out.jpg> [scale]
set -euo pipefail
cd "$(dirname "$0")/.."
comp="$1"; frames="$2"; out="$3"; scale="${4:-0.25}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
n=12
for i in $(seq 0 $((n - 1))); do
  f=$(( i * (frames - 1) / (n - 1) ))
  npx remotion still src/index.ts "$comp" "$tmp/f$i.png" --frame="$f" --scale="$scale" --log=error
done
cols=4; rows=$(( (n + cols - 1) / cols ))
ffmpeg -y -loglevel error -i "$tmp/f%d.png" -filter_complex "tile=${cols}x${rows}" -frames:v 1 "$out"
echo "contact sheet: $out"
