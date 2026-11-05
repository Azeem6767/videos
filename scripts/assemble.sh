#!/usr/bin/env bash
# scripts/assemble.sh — stitch per-shot renders and mix voiceover + sfx (README §5 steps 7-8).
# usage: scripts/assemble.sh <shotsDir> <vo.mp3> <out.mp4> [sfx.tsv]
#   shotsDir contains shotNNN.mp4 in order (rendered with scripts/render_shot.sh, same codec/crf)
#   sfx.tsv (optional): lines "file:seconds:volume" — files relative to public/
set -euo pipefail
cd "$(dirname "$0")/.."
dir="$1"; vo="$2"; out="$3"; sfx="${4:-}"
list=$(mktemp); trap 'rm -f "$list"' EXIT
for f in "$dir"/*.mp4; do echo "file '$PWD/$f'" >> "$list"; done
video=$(mktemp --suffix=.mp4); trap 'rm -f "$list" "$video"' EXIT
ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -c copy "$video"
if [ -n "$sfx" ]; then
  args=(); filters=()
  i=2
  while IFS=: read -r file at vol; do
    [ -z "${file:-}" ] && continue
    args+=(-i "public/$file")
    filters+=("[$i:a]adelay=$(awk -v s="$at" 'BEGIN{printf "%d|%d", s*1000, s*1000}'),volume=${vol}[s$i]")
    i=$((i + 1))
  done < "$sfx"
  filters+=("[1:a]volume=1[a1]")
  n=$((i - 2))
  if [ "$n" -gt 0 ]; then
    inputs="[a1]"; for j in $(seq 0 $((n - 1))); do inputs="$inputs[s$j]"; done
    filters+=("${inputs}amix=inputs=$((n + 1)):duration=first:dropout_transition=0[aout]")
  else
    filters+=("[a1]anull[aout]")
  fi
  ffmpeg -y -loglevel error -i "$video" -i "$vo" "${args[@]}" \
    -filter_complex "$(IFS=';'; echo "${filters[*]}")" \
    -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 160k -shortest "$out"
else
  ffmpeg -y -loglevel error -i "$video" -i "$vo" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest "$out"
fi
echo "assembled: $out"
