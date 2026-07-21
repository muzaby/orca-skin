# Verify — 0134-context-window-from-sdk

## 메타

| 항목 | 값 |
|---|---|
| slug | `0134-context-window-from-sdk` |
| 검증자 | Claude Code |
| 일자 | 2026-07-21 |
| 대상 커밋 | `31f0e3c` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ✅ #1 — lint `--fix` 가 무관 11파일 union 포맷을 리플로우(재생성 lock 의 신버전 프리티어/ESLint) → 커밋에서 제외, ipc.ts 만 수동 복원 | 타당 — 커밋 diff 를 `git show --stat` 로 대조, 의도 외 hunk 0 확인. 리플로우는 lint 재실행마다 재발하는 **레포 전반 툴체인 드리프트** — 0134 범위 아님 | 파생 관찰 O1 로 기록(아래 결론) — 후속 포맷 정리 핸드오프 권고 |
| 선조치 ✅ #2 — 0128 baseline TS2322 는 `c69f24d` 로 이미 해소 | 타당 — typecheck 3분할 0 error 재확인 | 반영 불요 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | claude-map 이 `modelUsage[].contextWindow` 추출 + 단일 모델 top-level 승격 | ✅ | `claude-map.ts` result 좁히기 `contextWindow?: number`(2곳) + `assignNums(entry, {..., contextWindow})` + `models.length === 1` 분기 승격. 테스트 3건(`claude-map.test.ts` "contextWindow → per-model 전달", "다중 모델이면 top-level 안 채움", "비숫자 드롭") |
| 2 | `ProviderReportedTelemetry`/`TelemetryModelUsage` 에 `contextWindow?` 추가, 기존 소비자 무변경 | ✅ | `shared/ipc.ts:487,500` (optional additive). typecheck 3분할 0 error + vitest 전 스위트 무회귀 |
| 3 | `contextWindowOf` 헬퍼 3단 우선순위 + 소비 3곳 치환 | ✅ | `contextWindow.ts` `contextWindowOf`(① top-level ② modelUsage[model] ③ 휴리스틱, `> 0` 가드). `Composer.tsx:216,641`·`UsagePanel.tsx:31` 치환 — `grep contextWindowFor` 렌더러 소비처 0(정의·테스트 제외) |
| 4 | 폴백 패밀리 갱신(1M 마커 + 200k 기본) | ✅ | `WINDOW_1M_MARKERS` = `1m`·`sonnet-5`·`sonnet-4-6`·`opus-4-6/7/8`·`fable`·`mythos`. 테스트: sonnet-5/4-6·opus 3종·fable·bedrock 프리픽스 → 1M, haiku·opus-4-5·**sonnet-4-5 오탐 없음**·mock-sonnet·미지 → 200k |
| 5 | mock 텔레메트리 `contextWindow: 200_000` 명시, 비율 시뮬레이션 불변 | ✅ | `mock-scenarios.ts` `usageForRatio` top-level + modelUsage 양쪽 `CONTEXT_WINDOW`(=200k, `mock-sonnet` 폴백값과 동일 → ratio 불변) |
| 6 | SDK 스펙 `"latest"` → `"0.3.215"` 핀, lock 정합 | ✅ | `package.json:33`·`package-lock.json:12` 동기. **`npm ci` 가 수정된 lock 으로 정합 검증 통과**(EUSAGE 없음, 설치 성공 — postinstall electron ABI 실패는 egress 베이스라인) |
| 7 | 신규 단위 테스트 + 무회귀 | ✅ | `contextWindow.test.ts`(폴백 매핑 + `contextWindowOf` 5케이스) + `claude-map.test.ts` 3건 — 대상 2파일 **60/60**. 전체 vitest 1077/1077 |
| 8 | 게이트 | ✅ | lint 0 error(1 warning = TanStack Virtual pre-existing, 0133 동일) / typecheck 3분할 0 / vitest **1077/1077**(`chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) / scripts 25/25 |
| 9 | 문서 동기 | ✅ | `IPC_CONTRACT.md` telemetry 행에 `contextWindow` 서술 + `provider-runtime.md` §8 인터페이스 코드블록·해설 갱신 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 위 매트릭스 #8 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 |
| 레이어 경계 위반 0 | ✅ | — | lint(boundaries 포함) 0 error — 변경은 adapters→shared→features/chat lib 하향 유지 |
| 문서 형식/링크/한국어 | ✅ | — | 한국어·표 형식 유지 |
| AGENTS.md 위생 스캔 | — | — | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 — 도넛 %가 1M 모델에서 1/5 로 줄어드는 것이 정답값임을 실기로 확인 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 — Sonnet 5 세션 도넛 분모 1M(팝오버 `xxk/1000k`) + 경고 임계 이동 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # ✖ 1 problem (0 errors, 1 warning) — pre-existing
$ npm run typecheck               # node/web/test 3분할 모두 0 error
$ ./node_modules/.bin/vitest run  # Test Files 136 passed / 1 failed(로드) · Tests 1077/1077
                                  #   실패 1파일 = chat-turn.continuity.test.ts (electron 바이너리
                                  #   egress 차단 — 0127~0133 verify 와 동일 베이스라인)
$ node --test scripts/*.test.mjs  # 25/25
```

`npm test` 전체(=pretest ABI 플립 포함)·electron 실기는 egress 차단 환경 제약으로 CI/사람 몫 (app/AGENTS.md 게이트 가이드).

## PHASES.md 정합성

- "현재 작업 중" 은 보드 링크 유지, 완료 행을 페이즈 표 말미에 승격 (0133 형식 동일).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: contextWindow DB 영속(마이그레이션) 트레이드오프를 비범위로 정리한 판단은 유효하나, 미지 신모델의 재로드 복원 분모가 폴백 기본값(200k)이 되는 잔여 갭은 후속 여지로 남음 — 라이브 턴 1회로 자가 치유되므로 수용.
- 구현 단계: lint `--fix` 툴체인 드리프트(O1)를 사전에 예상하지 못해 커밋 위생 복구 턴이 추가됨. 재발 방지는 별도 핸드오프 필요.
- 검증 단계: SDK 가 실제 런타임에 `contextWindow` 를 채워 보내는지는 단위 테스트(고정 픽스처) 밖 — 실 세션 1턴 실기(사람)로 확정 필요.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 실기 대기: ① Sonnet 5(또는 임의 1M 모델) 세션에서 도넛 분모 1M 확인 ② 재로드 복원 시 폴백 1M 유지 ③ PR 머지.
- **파생 관찰 O1 (비차단)**: 재생성된 lock(`5dee1af`)의 신버전 프리티어/ESLint 가 `npm run lint`(`--fix`) 실행 시 기존 코드 11+파일의 union 타입 포맷을 리플로우함. 0134 커밋에서는 제외했으나 lint 를 돌리는 모든 후속 세션에서 재발 — **레포 전반 재포맷 1회 커밋(또는 프리티어 버전 핀) 후속 핸드오프 권고**.
