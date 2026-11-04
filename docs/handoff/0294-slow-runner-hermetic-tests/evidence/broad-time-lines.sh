#!/usr/bin/env bash
# 0294 ΔV2 독립 재열거 — 게이트·스캔과 다른 방법(텍스트 술어)으로 시간 문맥 줄을 모아 scan-deadlines-v2 자리 줄(슬롯·값)을 뺀다.
# 남은 줄은 사람이 분류한다(plan §7-C 설계 근거 표). 사용: bash broad-time-lines.sh <app 디렉토리>
set -euo pipefail
app=$(cd "${1:-.}" && pwd)
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
node "$here/scan-deadlines-v2.mjs" "$app" 2>/dev/null |
  awk -F'\t' '{split($2,a,":"); print a[1]":"a[2]; if ($6!="-") {sub("값:","",$6); print a[1]":"$6}}' | sort -u > "$tmp/site"
(cd "$app" && find src \( -name '*.test.ts' -o -name '*.testfixture.ts' -o -name '*.testfixture.tsx' \) | sort |
  xargs grep -naE "(^|[^0-9A-Za-z_.])[1-9][0-9_]{3,}([^0-9_]|$)" |
  grep -iE "timeout|delay|deadline|elapsed|sleep|wait|Date\.now|performance\.now|setTimeout|setInterval|[a-z]Ms\b|_ms\b|Seconds|\bnow\b") > "$tmp/broad"
cut -d: -f1,2 "$tmp/broad" | sort -u > "$tmp/broadlines"
echo "broad $(wc -l < "$tmp/broad") · 자리 줄과 겹침 $(comm -12 "$tmp/broadlines" "$tmp/site" | wc -l)" >&2
comm -23 "$tmp/broadlines" "$tmp/site" | sed 's/$/:/' > "$tmp/rest"
grep -F -f "$tmp/rest" "$tmp/broad"
rm -rf "$tmp"
