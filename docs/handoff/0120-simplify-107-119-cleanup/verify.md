# Verify — 0120-simplify-107-119-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0120-simplify-107-119-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-16 |
| 대상 커밋 | `184230e` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견: F15 에서 선재 `distOrcaPluginDir`·`distPluginsDir` 동반 제거(diff 약간 밖) | 타당 — 소비자 grep 0 + 산출 문자열 불변, 반쪽 제거는 스타일 분열 | 매트릭스 #15 증거에 포함 |
| 선조치 ⚠️ #1: S1(engine CRUD 배포 우회)은 동작 변경이라 미적용 | 타당 — /simplify 불변식(동작 보존) 준수 | plan 파생 이슈 **D1** 로 이관(후속 핸드오프 권고) |

## 요구사항 충족 매트릭스

> 전 항목 동작 보존 검증 원칙: "치환 원형 잔존 grep 0" + "기존 테스트 무수정 green".

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | F1 writer `finalizeTurn` 수렴 | ✅ | `writer.ts:71`(user 커밋)·`:300`(telemetry) = `this.finalizeTurn(turn)`. 마감+수동리셋 조합 잔존 grep 0(`:95-97` = finalizeTurn 몸체, `:111` 은 ensureAssistantMessage 의 신규 메시지 초기화로 별개). writer 테스트 무수정 green |
| 2 | F2 reducer `TURN_END_RESET` | ✅ | `chatReducer.ts:195-201` 상수 + 4분기 스프레드. `turnProviderKey: null` 잔존 = initialState(:159)·상수(:198)뿐. `chatReducer.model.test.ts` 무수정 green |
| 3 | F3 `recoverSessionHistory` 복합 진입점 | ✅ | `recovery.ts:70-91`(순서+가드 내부 소유), `bootstrap.ts:173`·`chat-turn.ts` 1회 호출. 두 콜러에서 개별 함수 import 잔존 grep 0. recovery 테스트 무수정 green |
| 4 | F4 `parseDayKey` export 재사용 | ✅ | `stats.ts:45-50` export, `TokensPerDayChart.tsx` 의 `dayKeyToMs` 삭제(renderer 잔존 grep 0) |
| 5 | F5 `aggregateWeekly` → `boundaries().weekStart` | ✅ | `stats.ts:92`(주석)·`:96`, `getDay` stats.ts 잔존 grep 0. `stats.test.ts` 무수정 green |
| 6 | F6 UsageTab 파생 useMemo | ✅ | `UsageTab.tsx:130-143` `useMemo([stats, range])` |
| 7 | F7 차트 data useMemo | ✅ | `TokensPerDayChart.tsx` `useMemo([days])` |
| 8 | F8 렌더러 `Tweaks.scheduler` 제거 | ✅ | `useTweaks.ts` 잔존 grep 0(인터페이스·DEFAULTS·매핑). shared 스키마·main 스케줄러 무변경 |
| 9 | F9 deploy 검증 읽기 병렬화 | ✅ | `deployer.ts:115-118` `Promise.all`. `deployer.test.ts` 무수정 green |
| 10 | F10 user-skills 액션 문자열 단일화 | ✅ | `userSkillsAction` 헬퍼 1곳, 리터럴 2회 = 헬퍼 내부뿐(grep 2). 테스트 무수정 green = 문구 불변 |
| 11 | F11 plugin-package 병렬화 | ✅ | mkdir×3+copyOrcaSkills `Promise.all`, writeFile×2 `Promise.all`, entry 병렬(root 간 직렬 유지 주석 명기). 관련 테스트 무수정 green |
| 12 | F12 seed 스킬 간 병렬 | ✅ | `seed.ts` map+`Promise.all`, `seeded` 순서 = manifest 순서(map 순서 보존, filter 로 null 제거). `seed.test.ts` 무수정 green |
| 13 | F13 마지막 청크 뒤 양보 제거 | ✅ | `attachments.ts` `if (at + aligned < buf.length)` 가드. `attachments.test.ts` 무수정 green(출력 불변) |
| 14 | F14 Map→Set (`freshProviderKeys`) | ✅ | `external-usage-service.ts` `lastFetchOk` 잔존 grep 0, `?? false` 이중 부정 소멸. 테스트 무수정 green |
| 15 | F15 플러그인 경로 SSOT = feature 헬퍼 | ✅ | `bootstrap.ts` = `orcaPluginRoot(orcaConfigDir(),'claude')`·`userClaudePluginRoot(...)`, `dist{User,Orca,}Plugin*Dir` 저장소 잔존 grep 0. 경로 문자열 불변(동일 join 값) |
| 16 | 게이트 green | ✅ | 아래 "게이트 재실행 결과" — lint 0 error·typecheck 3분할 0·vitest **934/934**·scripts 25/25·boundaries 0·신규 의존성 0·IPC 무변경 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (베이스라인 분리 아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 16/16 |
| 레이어 경계 위반 0 | ✅ | — | boundaries lint 0 (F15 는 app→features 하향) |
| 문서 형식/링크/한국어 | ✅ | — | 준수 |
| AGENTS.md 위생 스캔 | — | — | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 동작 보존 리팩토링 — 해당 최소 |
| UI/UX 시각 검증 | ✖ | ✅ | 사용량 탭(차트/합계) 1회 실기 확인 권장(F6·F7 메모이제이션 시각 무변화 확인) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        → 0 error, 1 warning(기존 0102 TanStack↔React Compiler)
$ npm run typecheck             → node/web/test 3분할 모두 0
$ npm test                      → vitest 934/934 passed (122 파일)
                                  ※ chat-turn.continuity.test.ts 1스위트 로드 실패
                                    = electron 바이너리 egress 403 환경 베이스라인
                                    (0117~0119 verify 와 동일, 코드 무관)
$ node --test scripts/*.test.mjs → 25/25 pass
```

## PHASES.md 정합성

- Phase 4 표에 0120 행 승격(커밋 `184230e`), INDEX 행 `verify/PASS`. 형식 확인 ✅.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 4관점 리뷰를 병렬 에이전트로 돌려 발견 폭은 넓었으나, 각 발견의 라인 번호가 수정 전 기준이라 적용 시 재확인 비용이 있었다(다음엔 발견 시점에 앵커 코드 조각을 함께 수집).
- 구현 단계: F11/F12 병렬화는 "서로소 경로" 전제를 주석으로만 남겼다 — 전제가 깨지는 입력(중복 스킬명)의 명시적 가드는 두지 않았다(빌드 산출물 전제, 테스트 무수정 green 으로 갈음).
- 검증 단계: electron 로드 스위트(continuity)는 환경 제약으로 이번에도 미실행 — F3(chat-turn 경로)의 런타임 검증은 CI(windows, egress 열림)가 최종.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 파생 이슈 **D1**(engine CRUD 배포 chokepoint 우회 — 0109 D1 동일 사안)은 동작 변경이 필요한 버그수정 계열이라 후속 핸드오프로 분리 권고.
