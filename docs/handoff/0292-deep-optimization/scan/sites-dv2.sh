#!/usr/bin/env bash
# 0292 ΔV2 자리 검색 — repo root 에서 실행한다. 각 줄의 `N=` 이 ΔV2 §10 의 N 과 같아야 한다.
# S04′(VP-04): 가용성 상태·재확인 트리거를 운반하는 문장. 범위 = 재확인 → registry → 방송 → preload → renderer store path 파일 전부.
# S03′(VP-03): renderer 가 가용성·supported·사유를 읽어 노출/폴백/lastBackend 기록을 정하는 문장. 범위 = renderer src 전체.
# 두 검색 모두 import·주석 줄과 테스트·testfixture 를 제외한다.
set -u
cd "$(git rev-parse --show-toplevel)"
count() { local label=$1; shift; local out; out=$("$@" 2>/dev/null | sort -t: -k1,1 -k2,2n); local n; n=$(printf '%s' "$out" | grep -c . || true); echo "== $label N=$n"; [ -n "$out" ] && printf '%s\n' "$out"; }

S04_FILES=(
  app/src/main/adapters/common/registry.ts
  app/src/main/adapters/common/types.ts
  app/src/main/adapters/opencode/v1/server.ts
  app/src/main/adapters/opencode/v1/adapter.ts
  app/src/main/adapters/opencode/implementation.ts
  app/src/main/adapters/claude/adapter.ts
  app/src/main/app/bootstrap.ts
  app/src/main/app/settings-reactions.ts
  app/src/main/app/handlers/misc.ts
  app/src/main/infra/ipc/send.ts
  app/src/preload/index.ts
  app/src/renderer/src/shared/api/ipc.ts
  app/src/renderer/src/shared/stores/harnessAvailabilityStore.ts
  app/src/renderer/src/features/backend/store/backendStore.ts
  app/src/renderer/src/features/chat/components/HarnessUnavailableNotice.tsx
)
s04() {
  rg -n 'refreshInstallState\(|focusRecheck\(|onAvailabilityChange\(|executableIdentity\(|isInstalled\(\)|installed\(\): Promise|browser-window-focus|recheckOpenCode|openCodeExecutablePath|broadcastHarnessAvailability|CHANNELS\.harness(Availability|Recheck)|harnessApi\.(recheck|onAvailability)|onAvailability:|recheck:|applyHarnessAvailabilitySnapshot\(|seedHarnessAvailability\(|subscribeHarnessAvailability\(' "${S04_FILES[@]}" \
    | rg -v '^[^:]+:[0-9]+:\s*(import |//|\*)' \
    | rg -v 'bootstrap\.ts:[0-9]+:.*app\.(on|off)\(.browser-window-focus., check\)' # 일일 게이트 wake 구독 — 가용성 아님(표본 확인)
}
s03() {
  rg -n 'seedLandingBackend\(|applyHarnessAvailability\b|useHarnessAvailabilityStore\b|HARNESS_IDS\.map|<Composer\b|agent\.supported|agent\.unavailable|unavailableReason|lastBackend:|unavailableLandingFallback|onPick=\{\(selection\)|subscribeAvailability' \
    app/src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*' --glob '!**/shared/stores/harnessAvailabilityStore.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(import |//|\*)'
}
count "S04' VP-04 availability recheck → broadcast → renderer store" s04
count "S03' VP-03 renderer exposure · fallback · lastBackend" s03
count "S05e VP-05 harness names inside common registry" rg -n "'claude'|'opencode'" app/src/main/adapters/common/registry.ts
