#!/usr/bin/env bash
# 0294 ΔV3 — 판정을 바꾼 실험 사본 게이트로 트리 --report 가 달라지는지 잰다(달라지지 않으면 그 형태의 트리 자리 0).
# 사용: bash dv3-experiment.sh <app 디렉토리> <작업 디렉토리>
#   combos   — 산술 피연산자 값 조합마다 값(V33~V35 · W2·W2b)
#   wrappers — 래퍼 satisfies · ! · <T>x 를 벗기지 않음(L04 · V-satisfies·V-nonnull)
#   compound — 복합 대입 += -= *= /= 의 우변을 그 변수의 값 원천으로(L10 · W9)
# 실험이 판정을 실제로 바꿨는지는 verify-r3-probes.mjs 를 각 사본에 돌려 확인한다(W2·V-satisfies·W9).
set -euo pipefail
APP=$(cd "$1" && pwd); WORK=$2; mkdir -p "$WORK"
for e in base combos wrappers compound; do
  rm -rf "$WORK/exp-$e"; mkdir -p "$WORK/exp-$e/scripts"
  cp "$APP"/scripts/{check-test-budgets,test-budget-bindings}.mjs "$WORK/exp-$e/scripts/"
  ln -s "$APP/node_modules" "$WORK/exp-$e/node_modules"; ln -s "$APP/src" "$WORK/exp-$e/src"
  cp "$APP/package.json" "$WORK/exp-$e/"
done
python3 - "$WORK" <<'PY'
import sys
w = sys.argv[1]
def patch(e, old, new):
    p = f'{w}/exp-{e}/scripts/test-budget-bindings.mjs'
    s = open(p, encoding='utf8').read()
    assert old in s, (e, old[:40])
    open(p, 'w', encoding='utf8').write(s.replace(old, new))
patch('combos', """        if ([...left, ...right].some((v) => v.scaled))
          out.push({ literal: s, value: null, scaled: true })
        else if (left.length === 1 && right.length === 1) {
          const [a, b] = [left[0].value, right[0].value]""", """        for (const l of left) for (const r of right) {
          if (l.scaled || r.scaled) { out.push({ literal: s, value: null, scaled: true }); continue }
          const [a, b] = [l.value, r.value]""")
patch('wrappers', """      ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isNonNullExpression(n) ||
      ts.isTypeAssertionExpression(n))""", """      ts.isAsExpression(n))""")
patch('compound', "const ASSIGN_OPS = new Set([K.EqualsToken, K.QuestionQuestionEqualsToken, K.BarBarEqualsToken])",
      "const ASSIGN_OPS = new Set([K.EqualsToken, K.QuestionQuestionEqualsToken, K.BarBarEqualsToken, K.PlusEqualsToken, K.MinusEqualsToken, K.AsteriskEqualsToken, K.SlashEqualsToken])")
PY
(cd "$APP" && node scripts/check-test-budgets.mjs --report 2>/dev/null | sort > "$WORK/orig.txt")
echo "orig deadline $(grep -c '^deadline' "$WORK/orig.txt") · 전체 $(wc -l < "$WORK/orig.txt")"
for e in base combos wrappers compound; do
  (cd "$WORK/exp-$e" && node scripts/check-test-budgets.mjs --report 2>/dev/null | sort > report.txt) || true
  echo "$e deadline $(grep -c '^deadline' "$WORK/exp-$e/report.txt") · 원본과 diff $(diff "$WORK/orig.txt" "$WORK/exp-$e/report.txt" | grep -c '^[<>]' || true)줄"
done
