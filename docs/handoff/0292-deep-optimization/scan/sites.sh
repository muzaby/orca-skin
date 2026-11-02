#!/usr/bin/env bash
# 0292 §10 자리 검색 — repo root 에서 실행한다. 각 줄의 `N=` 이 §10 `설계 시점 N` 과 같아야 한다.
# 구현 착수 HEAD 에서 다시 돌려 N 이 다르면 `[구현자 기입]` 에 출력 차이를 적는다(D-010).
set -u
cd "$(git rev-parse --show-toplevel)"
G=(--glob '!*.test.*' --glob '!*.testfixture.*')
count() { local label=$1; shift; local out; out=$("$@" 2>/dev/null); local n; n=$(printf '%s' "$out" | grep -c . || true); echo "== $label N=$n"; [ -n "$out" ] && printf '%s\n' "$out"; }

# VP-02 부팅 대기
count 'S02a refreshInstallState' rg -n 'refreshInstallState' app/src/main "${G[@]}"
count 'S02b adapter-registry step' rg -n "'adapter-registry'" app/src/main "${G[@]}"
# VP-05 설치 판정 소비자(가용성 SSOT 로 옮길 자리)
count 'S05a install consumers' rg -n 'isInstalled\(\)|installState|registry\.list\(\)\.map' app/src/main/app app/src/main/adapters/common/registry.ts "${G[@]}"
count 'S05b supported producers' rg -n 'supported: supported\.has|supported: true, source' app/src/main "${G[@]}"
count 'S05c OpenCode background starts' rg -n 'new OpenCodeWarmup\(|new OpenCodeGlobalWatch\(|void auth\.connectAll\(\)|resolveComposerPreparation\(ctx' app/src/main/app "${G[@]}"
count 'S05d app direct install probes' rg -n 'isInstalled\(\)' app/src/main/app "${G[@]}"
# VP-03 renderer 노출 자리
count 'S03 renderer exposure' rg -n 'seedLandingBackend\(settings|HARNESS_IDS\.map|<Composer\b|agent\.supported' app/src/renderer/src "${G[@]}"
# VP-06 보관 raw
count 'S06a raw producers/consumers' rg -n 'raw: (entries|second)\b|snapshot\.raw\b|raw\?: unknown' app/src/main/adapters app/src/main/features/history "${G[@]}"
count 'S06b snapshot payload IO' rg -n 'payload_json|payloadJson' app/src/main/infra/db/native-history-queries.ts app/src/main/features/history/native-sync.ts app/src/main/features/history/reader.ts
count 'S06c latest migration' bash -c 'ls app/src/main/infra/db/migrations | tail -1'
# VP-07 renderer 번들
count 'S07a minify config' rg -n 'minify' app/electron.vite.config.ts
count 'S07b recharts static imports' rg -n "from 'recharts'|^import \{ TokensPerDayChart \}" app/src/renderer "${G[@]}"
count 'S07c shiki static value import' rg -n "^import \{.*\} from 'shiki'" app/src/renderer "${G[@]}"
# VP-08 OpenCode Timeline 프레임 비용
count 'S08 timeline per-frame' rg -n 'useLiveText\(\)|useLiveReasoning\(\)|projectTimeline\(|findIndex\(\(row\) => row\.key|turnCopyText\(' app/src/renderer/src/features/chat/harnesses/opencode/transcript "${G[@]}"
# VP-09 주기 타이머
count 'S09a setInterval main' rg -n 'setInterval\(' app/src/main "${G[@]}"
count 'S09b admission 20ms poll' rg -n 'waitBounded\(\[\], combined, 20\)' app/src/main "${G[@]}"
# VP-10 Claude SDK 지연 로드
count 'S10a SDK static value imports' rg -n '^import \{ createSdkMcpServer|^  query,$' app/src/main/adapters/claude/adapter.ts app/src/main/adapters/claude/runtime-tools.ts
count 'S10b SDK dynamic imports' rg -n "import\('@anthropic-ai/claude-agent-sdk'\)" app/src/main "${G[@]}"
# VP-11 0290 N1
count 'S11 canonical copies' rg -n '^const canonical = |^function stable\(' app/src/main/adapters/claude "${G[@]}"
