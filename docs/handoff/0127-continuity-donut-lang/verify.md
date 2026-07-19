# Verify — 0127-continuity-donut-lang

## 메타

| 항목 | 값 |
|---|---|
| slug | `0127-continuity-donut-lang` |
| 검증자 | Claude Code |
| 일자 | 2026-07-19 |
| 대상 커밋 | `8aaa0c8` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ✅ #1 — claude.fork 배선 테스트용 queryMock 주입 큐 | 타당 — 기존 케이스는 빈 큐 기본값으로 무영향, MapContext 전달을 실 스트림 소비로 증명 | 매트릭스 #4 증거로 채택 |
| 선조치 ✅ #2 — chatStore 테스트 languageCache afterEach ko 재시드 | 타당 — 모듈 전역 캐시의 테스트 간 오염 차단, bootstrapChat 실경로 재사용이라 시드 로직 자체도 검증됨 | 매트릭스 #6 증거로 채택 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 핸드오프 도착 턴(경계 미도달) telemetry 에 컨텍스트 3종 부재, cost/durationMs/modelUsage 유지 | ✅ | `claude-map.ts:433-443`(3번째 분기 delete) · `claude-map.test.ts` "경계 이전 assistant usage 는 스냅샷으로 캡처되지 않고…" (inputTokens/cacheRead/cacheCreation undefined + costUsd 0.4·durationMs 7000·modelUsage 유지 단언) |
| 2 | 경계 이전 스냅샷 미캡처·경계 이후 실측 우선·압축-후 근사 무회귀 | ✅ | `claude-map.ts:261`(캡처 가드 `!(handoffArrival && !compacted)`) · 테스트 "경계 통과 시 기존 압축 후 근사(post_tokens 우선)"(9,000 근사)·"경계 이후 assistant usage(압축 후 실측)"(80/9000 우선) |
| 3 | fork 무회귀 — draft `lastTelemetry` 승계 유지 + 플래그 없는 턴 telemetry 불변 | ✅ | `chatStore.ts:794`(승계 유지, 무변경) · `claude-map.test.ts` "플래그 없는 턴(fork 포함)은 기존 경로 그대로" · `claude.fork.test.ts` "handoff 미설정 fork 는 기존대로 컨텍스트 usage 를 승계"(1200/150k) |
| 4 | `TurnRequest.handoff` 배선 — handoffFrom 시 세팅·연속 턴 delete·query options 불변·MapContext 전달 | ✅ | `turn.ts:109` · `chat-turn.ts:698`(세팅)·`:785`(`delete contRequest.handoff`, forkFrom 동렬) · `claude.ts:292` · `claude.fork.test.ts` "handoff:true 는 query 옵션을 바꾸지 않는다" + "MapContext 로 전달돼 telemetry 컨텍스트 3종이 제거된다" |
| 5 | `src/shared/continuity-lang.ts` — 판정 휴리스틱·마커 테이블·continuityTitle 단일 조립점 | ✅ | `continuity-lang.ts` + `continuity-lang.test.ts` 9케이스(ko 계열/공백→ko·비한국어→en·'kokoro' 오탐 방지·ko 마커 바이트 동일·en 마커) |
| 6 | 제목 마커 언어화 + draft↔물질화 일치 — 양측 shared 헬퍼 + payload `continuityLang`(main 폴백) | ✅ | renderer `chatStore.ts:759-767`(languageCache 스냅샷+continuityTitle)·`:1121`(bootstrapChat 시드) / main `chat-turn.ts:405`(payload 우선·settings 파생 폴백)·`:486`(initialTitle→continuityTitle) / `chatStore.test.ts` 0127 describe 3케이스([Fork]/[Handoff] 제목 + payload 동봉 + ko 무회귀) |
| 7 | `/compact` 템플릿 언어화 — ko 바이트 불변·en 동일 구조·`Write the summary in {language}.`·English 폴백 | ✅ | `handoff.ts`(KO 리네임 내용 불변·EN 신설·시그니처 `lang='ko'` 하위호환) · `handoff.test.ts` en describe 3케이스 + "lang 미전달은 'ko' 기본" 회귀 |
| 8 | 문서 동기 — IPC_CONTRACT chat send payload | ✅ | `docs/IPC_CONTRACT.md` §2.1 payload 에 `continuityLang?: 'ko' \| 'en'` + 설명 · `docs/arch/backend/provider-runtime.md` §8 에 핸드오프 도착 턴 무효화 규칙 1항 추가 |
| 9 | 게이트 — lint 0 / typecheck 3분할 / vitest 순수 스위트 green | ✅ | 아래 게이트 재실행 결과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 에러 0 / typecheck 3분할 ✅ / vitest 1032/1032 + scripts 25/25 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | eslint boundaries 에러 0 (shared 신설 모듈은 최하층 — 양측 import 적법) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT·provider-runtime·plan/verify 한국어 표 형식 |
| AGENTS.md 위생 스캔 | — | — | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사용자 결정 A/B(언어 소스·ko/en 2종) 반영 — 실기 확인 대기 |
| UI/UX 시각·실기 검증 | ✖ | ✅ | **사람 실기 대기**: ① 핸드오프 직후 도넛/경고 비표시(미측정) → 압축 완료 후 압축-후 근사 표시 → 다음 턴 실측 ② en 환경(settings.json 의 `language` 를 'English' 등으로 수정) fork/handoff 제목 `[Fork]/[Handoff]` + 자동 메시지 en 템플릿 ③ 핸드오프 세션 재로드 시 도넛 미복원(원장 미오염) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # 에러 0 (warning 1 = 기존 react-compiler 비호환 라이브러리, 변경 무관)
$ npm run typecheck               # typecheck:node + web + test 모두 0 에러
$ ./node_modules/.bin/vitest run  # Tests 1032 passed (1032)
  # Test Files 131 passed | 1 failed: src/main/app/chat-turn.continuity.test.ts 는 테스트 0개 실행 —
  # "Electron failed to install correctly" 로드 실패 = electron 바이너리 egress 차단 베이스라인
  # (0125/0126 verify 와 동일 서명, 코드 무관. DB 스위트는 npm rebuild better-sqlite3 소스 리빌드로 전체 green)
$ node --test scripts/*.test.mjs  # 25 pass / 0 fail
```

## PHASES.md 정합성

- INDEX `verify/PASS` 행 갱신 + PHASES "현재 작업 중" 소관 확인(보드 링크 유지). 완료 이력 정본은 `git log`.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: SDK 실기(핸드오프 도착 턴의 compact_boundary 발화 여부·순서)는 이 환경에서 관측 불가라 "경계 유무 양쪽 보장" 설계로 우회했다 — 실기에서 어느 경로가 실제로 타는지 확인되면 주석의 서술을 실측으로 좁힐 수 있다.
- 구현 단계: `chat-turn.ts` 의 request 조립(플래그 세팅·initialTitle 언어 분기)은 순수 단위 테스트가 직접 커버하지 못한다(전체 send 핸들러가 electron 의존) — claude.fork/claude-map/continuity-lang/chatStore 테스트 + CI 실기의 간접 검증에 의존.
- 검증 단계: en 템플릿의 문안 어감(영어 품질)·`Write the summary in 한국어` 류 조합의 모델 수용성은 기계 판정 불가 — 사람 실기 항목.

## 결론 / 다음 단계

- 상태: **PASS** — INDEX `verify/PASS`, PHASES 승격. 사람 확인 대기: 실기 3건(위 책임 분리표) + PR 머지.
