#!/usr/bin/env bash
# 0292 ΔV4 자리 검색 — repo root 에서 실행한다. `N=` 이 ΔV4 §10 의 N 과 같아야 한다.
# S03‴(VP-03): S03″ 술어 + 마지막 백엔드 기록 helper 호출·정의(`rememberLandingBackend(`) +
#   시드·재시드·기록 판정의 이어가기 초안 제외 항(`isContinuityDraft(entry` · `isContinuityDraft(getState`).
#   r2 verify N6: helper 로 접힌 기록 호출 줄과 초안 제외 줄을 S03″ 술어가 잡지 못했다.
#   초안 관리 함수(활성화·폐기·목록)의 `isContinuityDraft(e)` 는 마지막 백엔드를 운반하지 않아 뺀다.
# 범위 = renderer src 전체. import·주석 줄과 테스트·testfixture·가용성 store 정의 파일(VP-04 소관)은 제외한다.
set -u
cd "$(git rev-parse --show-toplevel)"
count() { local label=$1; shift; local out; out=$("$@" 2>/dev/null | sort -t: -k1,1 -k2,2n); local n; n=$(printf '%s' "$out" | grep -c . || true); echo "== $label N=$n"; [ -n "$out" ] && printf '%s\n' "$out"; }

s03() {
  rg -n 'seedLandingBackend\(|applyHarnessAvailability\b|useHarnessAvailabilityStore\b|HARNESS_IDS\.map|<Composer\b|agent\.supported|agent\.unavailable|unavailableReason|lastBackend\b|\blandingBackend\b|selected !== beforeSession|onPick=\{\(selection\)|subscribeAvailability|rememberLandingBackend\(|isContinuityDraft\((entry|getState)' \
    app/src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*' --glob '!**/shared/stores/harnessAvailabilityStore.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(import |//|/\*|\*)'
}
count "S03‴ VP-03 renderer exposure · fallback · last backend · record targets" s03
