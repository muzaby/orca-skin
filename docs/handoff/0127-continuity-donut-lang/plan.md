# Plan — 0127-continuity-donut-lang

> 흐름: **의도 → 조사 → 설계 → 리스크**. 비기능(버그수정+사용자 직접 지시) — Claude 가 plan→impl→verify 전담(0121/0122 선례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0127-continuity-donut-lang` |
| 작성자 | Claude Code |
| 일자 | 2026-07-19 |
| 매핑 | PHASES 행 (verify PASS 시 승격) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | "핸드오프 분기 시, 컨텍스트 사용량까지 그대로 전달되고 있다. 도넛 패널 및 경고를 승계하지 않아야 한다. 반면 일반 분기의 경우 도넛패널 및 경고를 승계해야 한다." | 라이브 세션 요청 (2026-07-19) |
| 명시 요구 2 | "핸드오프/일반분기 분기 시, '/compact' 요구사항 및 대화명이 한글로 고정되어 있다. 사용자 언어를 따라가도록 설정하라. 다만 i18n 적용이 아니라 발생 당시의 선호 언어로만 변경하면 된다." | 라이브 세션 요청 (2026-07-19) |
| 사용자 결정 A | 언어 소스 = **`settings.language`** (선호 언어/LLM 응답 언어) — uiLocale 아님 | 라이브 세션 AskUserQuestion 응답 |
| 사용자 결정 B | **ko/en 2종 고정** — 한국어 계열 → 기존 한글 문구, 그 외 전부 → 영어 문구 + 영어 템플릿에 "요약은 {선호 언어}로 작성" 지시 포함 | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 1 | "승계하지 않아야 한다" = 핸드오프 새 세션의 도넛은 **비어(미측정) 시작**하고, 압축 완료 후의 압축-후 근사/실측 표시는 승계가 아닌 신규 세션 측정이므로 유지 (근거: 0064 r5/0065 의 기존 압축-후 근사 설계와 정합) | 추론 |
| 추론 의도 2 | "발생 당시의 선호 언어" = draft/물질화 **생성 시점 스냅샷으로 영속** — 이후 설정 변경·uiLocale 전환에 비반응 (근거: 요구 원문 "i18n 적용이 아니라") | 추론 |

## Context (왜)

핸드오프는 "컨텍스트가 가득 찬 대화를 요약해 새로 시작"하는 기능인데, 도착 턴의 telemetry 가 원본 세션의 압축 *전* 전체 이력 컨텍스트를 실어오면 새 세션의 도넛/경고가 원본 값 그대로 표시된다 — 갓 시작한 세션이 "컨텍스트 한계" 경고를 띄우는 자기모순. 또한 continuity 산출물(제목 마커·`/compact` 자동 메시지)이 한글 하드코딩이라 비한국어 사용자 환경에서 어긋난다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| fork draft 는 `lastTelemetry`(도넛 소스)를 의도적으로 승계 — 유지 대상 | `app/src/renderer/src/features/chat/store/chatStore.ts:784-785` |
| handoff draft 는 `lastTelemetry` 미승계(빈 시작) — 누수는 도착 턴 telemetry | `chatStore.ts:844-853` |
| 도착 턴에서 compact_boundary **이전** assistant usage 가 `lastAssistantUsage` 스냅샷으로 잡히고, 이 스냅샷이 result telemetry 의 컨텍스트 3종을 **compacted 분기보다 우선** 덮는다 | `app/src/main/adapters/claude-map.ts:401-406` |
| 경계 도달 시 스냅샷 소거 + 압축-후 근사(post_tokens→요약 크기) 존재 — 실제 버그 창은 **경계 부재/도달 전 result** 경로 | `claude-map.ts:169-195, 407-427` |
| telemetry 는 renderer `lastTelemetry` 저장(contextTokens>0 게이트) + main `turn_usage` 원장 영속 + 재로드 복원 3경로 — **소스(매퍼) 한 곳을 고쳐야 전부 정화** | `chatReducer.ts:423-439`, `features/usage/usage-map.ts:8`(hasContextTokens), `app/handlers/session.ts:55-57` |
| 컨텍스트 3종 제거 시 `hasContextTokens=false` → `recordTurnUsage` 가 행 전체(비용 포함) 스킵 — 기존 compacted 근사-0 엣지(`claude-map.ts:426`)와 동일 계열 트레이드오프 | `features/usage/subscriber.ts:24` |
| 제목 마커는 렌더러 draft ↔ main DB 초기 제목이 **문자열 단위 일치 계약**(0097 D3) — 한 쪽만 바꾸면 물질화 전후 표시가 깨진다 | `chatStore.ts:746-752`, `app/src/main/app/chat-turn.ts:467-477` |
| `/compact` 자동 메시지 템플릿(한글) 단일 출처 | `app/src/main/features/orchestration/handoff.ts:11-18` |
| `settings.language` 스키마(자유 문자열, 기본 '한국어') + main 이 매 턴 읽는 선례 | `app/src/shared/protocol.ts:436-438`, `features/extensions/builder.ts:52-55` |
| renderer 의 settings 접근: Tweaks 미러는 `language` 미투영 — chatStore 모듈 캐시(cwdCache 동형)가 적합 | `shared/hooks/useTweaks.ts`, `chatStore.ts:107, 1095` |
| `src/shared` 는 main·renderer 양측 import 가능(최하층, boundaries 비차단) | `chatStore.ts:27`(shared/ipc import 선례), `eslint.config.mjs` |
| mock 어댑터는 telemetry/forkFrom 미구현 — 무영향 | `adapters/mock.ts` (grep 0건) |
| 연속 턴은 `forkFrom` 을 delete 하고 재실행 — handoff 플래그도 동일 처리 필요 | `chat-turn.ts:765-767` |

## 인수 기준 (Acceptance Criteria)

1. **핸드오프 도착 턴(경계 미도달)의 telemetry 에 컨텍스트 3종(input/cacheRead/cacheCreation) 부재** — 도넛/경고 '미측정' 시작. costUsd/durationMs/modelUsage 는 유지. (claude-map 단위 테스트)
2. **경계 이전 assistant usage 는 스냅샷으로 캡처되지 않고, 경계 이후 assistant usage(실측)는 기존대로 캡처·우선** — handoffArrival + compact_boundary 조합에서 기존 압축-후 근사(post_tokens/요약 크기) 무회귀. (claude-map 단위 테스트)
3. **일반 분기(fork) 무회귀** — fork draft 의 `lastTelemetry` 승계 유지, `handoff` 플래그 없는 턴의 telemetry 경로 불변. (chatStore/claude-map 기존 테스트 green)
4. **`TurnRequest.handoff` 배선** — chat-turn 이 `handoffFrom` 일 때만 세팅, 자동 연속 턴에서 `delete contRequest.handoff`(forkFrom 동렬), 어댑터가 MapContext `handoffArrival` 로 전달하되 query options(resume+forkSession)는 불변. (claude.fork 테스트)
5. **신규 `src/shared/continuity-lang.ts`** — `continuityLangFor`(한국어 판정: 미정의/공백→ko, '한국'|'한글'|'korean' 포함·정확히 'ko'|'kor'·'ko-' 접두→ko, 그 외→en, 'ko' 부분 문자열 오탐 없음) + `CONTINUITY_TITLE_MARKER`(ko: 분기/핸드오프, en: Fork/Handoff) + `continuityTitle` 단일 조립점. (신규 단위 테스트)
6. **제목 마커 언어화 + draft↔물질화 일치 유지** — 렌더러 draft 제목과 main `initialTitle` 이 같은 shared 헬퍼로 조립되고, 렌더러가 draft 생성 시점 lang 을 `SendChatMessage.continuityLang`(zod enum, continuity 전용) 으로 전달, main 은 payload 우선·부재 시 `settings.language` 파생 폴백. (protocol/chatStore 테스트)
7. **`/compact` 템플릿 언어화** — `buildHandoffMessage(title, sourceSessionId, lang='ko', preferredLanguage?)`: ko 템플릿 바이트 불변, en 템플릿 동일 구조(①~⑤·verbatim 보존·`/compact [Handoff] ` 접두) + `Write the summary in {language}.`(공백 시 'English' 폴백). (handoff 단위 테스트)
8. **문서 동기** — `docs/IPC_CONTRACT.md` chat send payload 에 `continuityLang` 반영.
9. **게이트** — lint 에러 0 / typecheck 3분할 0 / vitest 순수 스위트 green (DB 스위트는 egress 베이스라인 분리 보고).

## 범위 / 비범위

- **범위**: 위 인수 기준 1~9. main 매퍼·어댑터 배선·orchestration 템플릿·IPC 스키마·renderer draft 경로·문서.
- **비범위**: `settings.language` 편집 UI 신설(현재 부재 — 별도 후속), turn_usage 원장 스키마 변경(cost-only 행 허용), uiLocale 기반 i18n 재렌더(요구가 명시적으로 배제), opencode 어댑터, 기존 영속 세션 제목의 소급 변환(스냅샷 의미론상 비대상).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `claude-map.ts` MapContext/compacted 경로, `chatStore` cwdCache 패턴, `ctx.settings.getAll()`, zod SendChatMessageSchema.
- 전제: SDK 핸드오프 도착 턴의 compact_boundary 발화 여부는 환경에 따라 다를 수 있다 — 설계는 **경계 유무 모두**에서 비승계를 보장(경계 부재 시 '미측정', 경계 도달 시 압축-후 근사).
- **신규 의존성**: 없음.

## 설계

**요구 1 — 소스(매퍼) 단일 지점 정화**: `TurnRequest.handoff?: boolean`(chat-turn 이 handoffFrom 일 때 세팅, 연속 턴 delete) → `claude.ts` 가 MapContext `handoffArrival` 로 전달 → `claude-map.ts` 에서 ① `handoffArrival && !compacted` 동안 assistant usage 스냅샷 미캡처(승계 컨텍스트) ② result 에 3번째 분기 `else if (telemetry && ctx.handoffArrival)` 로 컨텍스트 3종 delete. 렌더러/원장은 기존 게이트(contextTokens>0 / hasContextTokens)가 자연 스킵 — 코드 변경 불요.

**요구 2 — 발생 시점 스냅샷 언어**: 신규 `src/shared/continuity-lang.ts`(순수, 양측 import) 로 판정·마커·제목 조립을 단일화. 렌더러 draft 생성 시 lang 파생(`languageCache` — bootstrapChat 에서 `settingsApi.get()` 시드) → `ChatState.continuityLang` 스냅샷 → send payload `continuityLang` 동봉. main 은 payload 우선·settings 파생 폴백으로 `initialTitle`(continuityTitle)과 `buildHandoffMessage`(ko/en 템플릿 + preferredLanguage 원문) 조립. 기존 로컬 `CONTINUITY_TITLE_MARKER`(renderer)와 리터럴(initialTitle) 제거 — 이중 하드코딩 해소.

레이어 경계: shared(최하층) 신설 모듈만 양측 공유, main 은 adapters/app/features 기존 슬라이스 내 수정, renderer 는 features/chat 내 수정 — 경계 위반 0.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 핸드오프 직후(경계 미도달 엣지): 도넛 비표시('미측정') — 다음 실제 턴 실측이 채움. 정상 흐름(경계 도달): 압축-후 근사 표시(기존 0065 설계 유지).
- 핸드오프 세션의 자동 연속 턴: 플래그 미승계로 실측 telemetry 정상 유지.
- 핸드오프 도착 턴 중 auto 압축: trigger 무관 compact_boundary 가 compacted 를 세워 동일 경로 흡수.
- 부트 직후 draft 생성 race: languageCache 미시드 → ko 폴백(스키마 기본 '한국어' 정합, 창 수 ms).
- fork draft 장수명(이탈 생존) 중 language 변경: draft 제목은 생성 시점 스냅샷 — payload `continuityLang` 이 main initialTitle 과의 일치를 보장(발생 시점 의미론).
- 표시 라벨('분기된 지점'·lineage 배너 등)은 uiLocale i18n 그대로 — 영속 마커와 표시 라벨의 이원화가 설계 의도.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 경계 미도달 엣지에서 turn_usage 행(비용 포함) 스킵 → 글로벌 비용 재계산에서 해당 턴 비용 누락 | 기존 compacted 근사-0 엣지와 동일 계열로 수용, claude-map 주석 명기. 원장 스키마 변경은 비범위 |
| `delete contRequest.handoff` 누락 시 후속 자동 연속 턴이 실측 telemetry 를 버리는 누수 | forkFrom delete 동렬 배치 + 코드리뷰 체크포인트 |
| payload 스냅샷 vs send 시점 settings 불일치(극단 race): 제목 언어(payload 승) ↔ en 템플릿 `{language}` 원문(send 시점 settings) 이 갈릴 수 있음 | 수용(주석 명기) — 제목 일치 계약이 우선 |
| `continuityLangFor` 휴리스틱 오판(자유 문자열) | 보수적 규칙('ko' 부분 문자열 매칭 금지) + 단위 테스트 고정, 오판 시 en 폴백은 이해 가능한 영어 문구 |
| SDK 실기(경계 발화 순서)는 이 환경에서 검증 불가 | 경계 유무 양쪽을 모두 커버하는 설계 + verify 책임 분리(사람/CI 실기) |

- 되돌리기 어려운 결정: 없음 (telemetry 는 파생 표시값, 제목은 세션별 스냅샷 — 롤백 시 신규 세션부터 원복).
- 단독 결정 금지 항목: 언어 소스·비한국어 처리 — **사용자 결정 A/B 로 확정 완료**(위 Intent 표).

## 영향 받는 파일

- 신규: `app/src/shared/continuity-lang.ts` (+ `.test.ts`)
- main: `adapters/turn.ts` · `adapters/claude.ts` · `adapters/claude-map.ts` · `app/chat-turn.ts` · `features/orchestration/handoff.ts`
- shared: `protocol.ts` · `ipc.ts`
- renderer: `features/chat/reducer/chatReducer.ts` · `features/chat/store/chatStore.ts`
- 테스트: `adapters/claude-map.test.ts` · `adapters/claude.fork.test.ts` · `features/orchestration/handoff.test.ts` · `shared/protocol.send.test.ts` · renderer `chatStore.test.ts`
- 문서: `docs/IPC_CONTRACT.md` (+ `docs/arch/backend/provider-runtime.md` 해당 절 존재 시 1줄)

## 참고 문서

- `docs/IPC_CONTRACT.md` §2.1 (chat send payload — §6 변경 절차 동시 갱신)
- `docs/arch/backend/provider-runtime.md` (NormalizedEvent/telemetry)
- 핸드오프 0064(continuity)·0065(압축-후 근사)·0067(자동 메시지 커밋 경로)·0097(D3 마커 계약)

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립) + `./node_modules/.bin/vitest run` 순수 스위트 (DB 스위트는 egress 베이스라인 분리 보고, 최종 CI).
- 신규 테스트 요구: continuity-lang(순수 변환기) · claude-map handoffArrival(어댑터 정규화) · protocol continuityLang(IPC 스키마) · handoff en 템플릿 · chatStore draft/payload.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론(미측정 시작·스냅샷 영속)은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인`/문서 레퍼런스를 붙였다.
- [x] 인수 기준 — 번호 1~9, 자료조사 근거, 단위 테스트/게이트로 검증 가능.
- [x] 의존 기술 — 기존 모듈 재사용 명시, 신규 의존성 0.
- [x] 파생 UX — 미측정 시작·연속 턴·auto 압축·race·이원화 라벨을 펼쳤다.
- [x] 리스크 — 원장 스킵 트레이드오프·플래그 누수·휴리스틱 오판·실기 한계를 적고, Open Question 은 사용자 결정 A/B 로 해소했다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 전체(소스-매퍼 단일 지점 정화 + shared 단일 조립점 + payload 스냅샷). 특히 "렌더러만 고치면 재로드 원장 복원 구멍" 진단이 구현 중 재확인됨 — `recordTurnUsage` 의 `hasContextTokens` 게이트가 strip 된 telemetry 를 자연 스킵해 `getLatestTurnUsage` 복원 경로까지 한 번에 정화된다.
- 이견 없음. 인수 기준 7의 en 템플릿은 설계대로 ko 와 동일 구조(①~⑤·verbatim·`/compact [Handoff] ` 접두 + `Write the summary in {language}.`)로 작성.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 배선 테스트(claude.fork)가 기존 mock 으로는 SDK 메시지를 방출 못해 MapContext 전달을 증명할 수 없음 | ✅ queryMock 에 주입 큐(`sdkMessages`)를 추가해 assistant+result 스트림을 흘리고 telemetry 를 소비 검증(기존 케이스는 빈 큐 기본값으로 무영향) | `claude.fork.test.ts` |
| 2 | chatStore 의 `languageCache` 는 모듈 전역 — en 테스트가 후속 테스트를 오염할 수 있음 | ✅ 테스트 describe 의 afterEach 에서 ko 재시드(bootstrapChat 실경로 재사용) | `chatStore.test.ts` |

## [구현자 기입] 구현 체크리스트

- [x] `src/shared/continuity-lang.ts` + 테스트
- [x] 요구1 어댑터 체인(turn→claude→claude-map) + 테스트
- [x] 요구2 main(handoff.ts·protocol/ipc·chat-turn) + 테스트
- [x] 요구2 renderer(chatReducer·chatStore) + 테스트
- [x] 문서(IPC_CONTRACT·provider-runtime §8) + 게이트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `app/src/shared/continuity-lang.ts`(+test) · main `adapters/{turn,claude,claude-map}.ts`·`app/chat-turn.ts`·`features/orchestration/handoff.ts` · shared `{protocol,ipc}.ts` · renderer `features/chat/{reducer/chatReducer,store/chatStore}.ts` · 테스트 5파일 · 문서 `docs/IPC_CONTRACT.md`·`docs/arch/backend/provider-runtime.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run`(+`npm rebuild better-sqlite3` Node ABI 소스 리빌드) / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint 에러 0(warning 1 = 기존 react-compiler 비호환 라이브러리) / typecheck 3분할 ✅ / vitest **1032/1032**(`chat-turn.continuity` 1파일 로드 실패 = electron 바이너리 egress 베이스라인, 0125/0126 동일) / scripts 25/25 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (구현 커밋 hash — 검증 턴에서 기입) |
