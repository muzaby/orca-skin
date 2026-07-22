# Verify — 0139-context-window-multimodel-turn

## 메타

| 항목 | 값 |
|---|---|
| slug | `0139-context-window-multimodel-turn` |
| 검증자 | Claude Code |
| 일자 | 2026-07-22 |
| 대상 커밋 | (커밋 시 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ✅ #1 — `normalizeResultTelemetry` 는 `ctx` 비접근 순수 함수라 `ctx.mainModel` 직접 참조가 `ReferenceError` → `mainModel` 파라미터 전달로 수정 | 타당 — 최종 코드가 `normalizeResultTelemetry(r, ctx.mainModel)` 로 전달, 함수 시그니처에 `mainModel?: string` 추가 확인. vitest 68/68 재확인 | 매트릭스 AC2 증거로 반영 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `MapContext.mainModel` + non-child assistant 캡처(child 제외) | ✅ | `claude-map.ts` MapContext `mainModel?: string`(턴-스코프 주석) + assistant 분기 `if (parentToolRunId === undefined && typeof m?.model === 'string' && m.model !== '') ctx.mainModel = m.model` |
| 2 | result 승격 `primary` 선택(단일/멀티-메인/미판정) + `mainModel` 파라미터 | ✅ | `normalizeResultTelemetry(r, mainModel)` — `primary = models.length===1 ? models[0] : (mainModel!==undefined && modelUsage[mainModel] ? mainModel : undefined)`, `primary!==undefined` 시 `out.model`/`out.contextWindow` 승격. 호출부 `normalizeResultTelemetry(r, ctx.mainModel)` |
| 3 | 멀티모델 턴(메인 sonnet-5 + child haiku) → model=sonnet-5·contextWindow=1M | ✅ | `claude-map.test.ts` "멀티모델 턴이라도 이번 턴 메인(non-child assistant)으로 top-level 승격 (0139)" |
| 4 | 누적 modelUsage(haiku 잔류) 순수 대화 턴 → 1M (고착 방지) | ✅ | `claude-map.test.ts` "누적 modelUsage 에 haiku 가 남아도 순수 대화 턴은 메인(sonnet-5) 분모 유지 — 200k 고착 방지 (0139)" |
| 5 | 모델 전환 — 이번 턴 메인 haiku → 200k 추종 | ✅ | `claude-map.test.ts` "세션 중 모델 전환 — 이번 턴 메인이 haiku 면 분모도 haiku(200k) 추종 (0139)" |
| 6 | 메인이 modelUsage 부재 → 미승격(폴백) | ✅ | `claude-map.test.ts` "메인 모델이 modelUsage 에 없으면 미승격(방어) → renderer 폴백 (0139)" (model/contextWindow 모두 undefined) |
| 7 | 렌더러 무변경 + 테스트 재정의/승격 케이스 + 무회귀 | ✅ | `contextWindow.ts` 무변경. `contextWindow.test.ts` "top-level 부재 + modelUsage 다중(복원/비정상)은 폴백" 재정의 + "멀티모델이라도 top-level model 이 채워지면 그 모델 window" 추가. 기존 2 claude-map 테스트 제목을 "메인 미판정" 조건으로 정정(동작 무회귀) |
| 8 | 게이트 | ✅ | lint 0 error(1 pre-existing warning) / typecheck 3분할 0 / vitest **1104/1104**(`chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) / scripts 25/25 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 매트릭스 #8 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| 레이어 경계 위반 0 | ✅ | — | lint(boundaries) 0 error — adapters 내부 변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 실기 대기 — 도구/서브에이전트 턴 후 도넛 1M·순수 대화로도 유지 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 실기 대기 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # 1 problem (0 errors, 1 warning) — TanStack Virtual pre-existing
$ npm run typecheck               # node/web/test 3분할 모두 0 error
$ ./node_modules/.bin/vitest run  # Test Files 137 passed / 1 failed(로드) · Tests 1104/1104
                                  #   실패 1파일 = chat-turn.continuity.test.ts (electron 바이너리
                                  #   egress 차단 — 0127~0138 verify 와 동일 베이스라인)
$ node --test scripts/*.test.mjs  # 25/25
```

`npm test` 전체(pretest ABI 플립 포함)·electron 실기는 egress 차단 제약으로 CI/사람 몫.

## PHASES.md 정합성

- "현재 작업 중" 보드 링크 유지, 완료 행을 페이즈 표 말미에 승격(0138 형식 동일).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 제목 haiku 오염 벡터를 처음 "격리"로 오판 → 사용자 실증(haiku 제거 시 소멸)으로 정정. 최종 수정(A)은 벡터 무관하게 도넛을 정정하므로 오판이 결과물엔 무영향, 다만 벡터 확정(B)은 사람 실기 몫으로 남음.
- 구현 단계: `ctx` 스코프 밖 승격 참조 실수(선조치 #1)로 1라운드 내 자가 교정.
- 검증 단계: SDK 가 멀티모델 턴에서 실제로 `modelUsage[main].contextWindow` 를 채워 보내는지는 고정 픽스처 밖 — 실 세션 1턴 실기(사람)로 확정 필요.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 실기 대기: ① Sonnet 5 세션에서 도구/서브에이전트 긴 턴 후 도넛 분모 `xxk/1000k` ② 그 뒤 도구 없는 순수 대화 턴에서도 1M 유지(복원) ③ 모델 전환 시 분모 추종 ④ PR 머지.
- **후속 여지(비차단)**: B(제목 haiku 오염 벡터 차단 — maybeStart 타이밍/cwd 격리)는 A 적용 후 실기에서 메인 턴 raw `modelUsage` 에 haiku 가 남는지 로그 확인한 뒤 필요 시 별도 핸드오프. 분자 스냅샷 child 오염 가드도 같은 후속.
