#!/usr/bin/env bash
# 0290 r2 verify — 정적 oracle 재측정(S1~S3 재실행 + AC2·AC3 스캐너 전후 집합).
# 실제 트리에 한 번에 한 결함만 넣고 판정한 뒤 바이트 그대로 되돌린다. 인자: 산출 디렉터리.
set -u
OUT="$1"; mkdir -p "$OUT"
REPO="$(git rev-parse --show-toplevel)"; cd "$REPO" || exit 1
E=docs/handoff/0290-simplify-0254-0289
restore() { cp "$OUT/.orig" "$1"; cmp -s "$OUT/.orig" "$1" && echo "  restored: $1"; }

echo "## S1 — 공통 모듈이 이동한 하네스 모듈을 import (harness/ownership)"
F=app/src/main/app/harnesses/common/contracts.ts
for mod in ../opencode/warmup ../opencode/mcp-reconcile ../opencode/global-watch ../opencode/prepared-mcp-resources ../claude/processes; do
  cp "$F" "$OUT/.orig"; printf "import '%s'\n" "$mod" >> "$F"
  (cd app && ./node_modules/.bin/eslint "${F#app/}" -f json -o "$OUT/s1.json" >/dev/null 2>&1)
  n=$(python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); print(sum(1 for f in d for m in f['messages'] if m.get('ruleId')=='harness/ownership'))" "$OUT/s1.json")
  echo "  $mod → harness/ownership errors: $n"; restore "$F"
done

echo "## S2 — 삭제한 partsStructured export 복원 (dead-exports 스캐너)"
node $E/scan/dead-exports.cjs --out "$OUT/dead-head.tsv" >/dev/null
F=app/src/renderer/src/features/chat/lib/parts.ts
cp "$F" "$OUT/.orig"; printf "export function partsStructured(): boolean {\n  return false\n}\n" >> "$F"
node $E/scan/dead-exports.cjs --out "$OUT/dead-s2.tsv" >/dev/null
restore "$F"
python3 -I - "$OUT/dead-head.tsv" "$OUT/dead-s2.tsv" <<'EOF'
import sys
def cats(p):
    rows=[l.rstrip('\n').split('\t') for l in open(p)][1:]
    return {r[-1]:sum(1 for x in rows if x[-1]==r[-1]) for r in rows}, {(r[0],r[1],r[-1]) for r in rows}
h,hs=cats(sys.argv[1]); s,ss=cats(sys.argv[2])
print('  head dead', h.get('dead'), 'test-only', h.get('test-only'), '| S2 dead', s.get('dead'))
print('  S2 new rows:', sorted(ss-hs))
EOF

echo "## S3 — 고아 IPC 토큰 복원 (VP-04 0건 스윕, 기록 명령 그대로)"
F=app/src/renderer/src/shared/api/ipc.ts
P='setNativeResource|nativePluginDirectory|SetNativeResource\b|OpenNativePlugin\b|SetNativeResourceSchema|OpenNativePluginSchema|sessionSetNativeResource|sessionOpenNativePlugin|shareNativeResource|openNativePlugin|open-native-plugin|set-native-resource|configuredPluginDirectory|configuredMcpFile|draftPluginDirectory|configuredClaudePluginDirectory|configuredClaudeMcpFile|configuredOpenCodeMcpFile'
echo "  before: $(rg -n "$P" app/src --glob '!*.test.*' --glob '!*.testfixture.*' | wc -l)"
cp "$F" "$OUT/.orig"; printf "export const openNativePlugin = undefined\n" >> "$F"
echo "  with token: $(rg -n "$P" app/src --glob '!*.test.*' --glob '!*.testfixture.*' | wc -l)"
restore "$F"

echo "## AC2 — dead/test-only (name,kind) 집합: head − baseline"
python3 -I - "$OUT/dead-head.tsv" "$E/baseline/dead-exports.tsv" <<'EOF'
import sys
def load(p):
    rows=[l.rstrip('\n').split('\t') for l in open(p)]
    hdr=rows[0]; rows=rows[1:]
    return hdr,[r for r in rows if r[-1] in ('dead','test-only')]
hh,h=load(sys.argv[1]); bh,b=load(sys.argv[2])
print('  header head:', hh[:4], '... baseline:', bh[:4])
key=lambda r:(r[1],r[2] if len(r)>2 else '',r[-1])
hk={key(r) for r in h}; bk={key(r) for r in b}
print('  head dead', sum(1 for r in h if r[-1]=='dead'), 'test-only', sum(1 for r in h if r[-1]=='test-only'))
print('  new (name,kind,category) not in baseline:', sorted(hk-bk))
EOF

echo "## AC3 — i18n"
node $E/scan/i18n-unreferenced.cjs --absent $E/baseline/i18n-remove-keys.txt; echo "  --absent exit=$?"
node $E/scan/i18n-unreferenced.cjs > "$OUT/i18n-head.txt"; echo "  unreferenced: $(grep -c . "$OUT/i18n-head.txt")"
echo "  new vs baseline: $(comm -23 <(sort -u "$OUT/i18n-head.txt") <(sort -u $E/baseline/i18n-unreferenced.txt) | tr '\n' ' ')"
rm -f "$OUT/.orig"
echo "app tree: '$(git status --short -- app)'"
