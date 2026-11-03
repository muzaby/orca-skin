#!/usr/bin/env bash
# 0292 ΔV3 자리 검색 — repo root 에서 실행한다. `N=` 이 ΔV3 §10 의 N 과 같아야 한다.
# S03″(VP-03): renderer 가 가용성·supported·사유를 읽어 노출/폴백을 정하는 문장 + 마지막 백엔드
#   (메모리 `landingBackend` · 설정 `lastBackend`)를 읽고 쓰는 문장 + setModel 의 기록 대상 판정 줄.
#   범위 = renderer src 전체. S03′ 대비: 폴백 표식(`unavailableLandingFallback`)은 D-019 로 삭제 대상이라 뺐고,
#   `lastBackend:` 를 `lastBackend\b` 로, `landingBackend\b` 와 기록 대상 판정(`selected !== beforeSession`)을 더했다.
# import·주석 줄과 테스트·testfixture·가용성 store 정의 파일(VP-04 소관)은 제외한다.
set -u
cd "$(git rev-parse --show-toplevel)"
count() { local label=$1; shift; local out; out=$("$@" 2>/dev/null | sort -t: -k1,1 -k2,2n); local n; n=$(printf '%s' "$out" | grep -c . || true); echo "== $label N=$n"; [ -n "$out" ] && printf '%s\n' "$out"; }

s03() {
  rg -n 'seedLandingBackend\(|applyHarnessAvailability\b|useHarnessAvailabilityStore\b|HARNESS_IDS\.map|<Composer\b|agent\.supported|agent\.unavailable|unavailableReason|lastBackend\b|\blandingBackend\b|selected !== beforeSession|onPick=\{\(selection\)|subscribeAvailability' \
    app/src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*' --glob '!**/shared/stores/harnessAvailabilityStore.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(import |//|/\*|\*)'
}
count "S03″ VP-03 renderer exposure · fallback · last backend" s03
