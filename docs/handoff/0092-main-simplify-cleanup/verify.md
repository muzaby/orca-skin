# Verify — 0092-main-simplify-cleanup

## 메타

| 항목 | 값 |
|---|---|
| slug | `0092-main-simplify-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-10 |
| 대상 커밋 | `2681732` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> 본 핸드오프는 비기능 = Claude 직접 plan→impl→verify. 구현자 기입 5건 전부 ✅ 선조치(경계 내 구현 세부)로, ⚠️ 결정-필요 항목 없음.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 AC3 후보 6곳 중 3곳만 채택(경고/원문입력 시맨틱 불일치 제외) | 타당 — plan §인수기준 3 의 제외 조항 그대로 | 매트릭스 #3 증거에 채택/제외 명시 |
| #2 deployer mcp 비객체 소스의 액션 문자열 미세 차이 | 타당 — config 결과 등가, 폴백 명시화 | 동작 변경 아님으로 판정 |
| #3 AC8 부수: resilience 테스트가 본 환경에서 실행 가능해짐(3→2 suite) | 타당 — 격리 실행 7/7 확인 | 게이트 절에 기록 |
| #4 patch() 반환 등가(migrate 는 유효 Settings 에 내용 동일) | 타당 — `settings-migration.ts:32-41` parse 재통과 확인 | — |
| #5 read() shallow copy 로 캐시 오염 방지 | 타당 | — |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `errorMessage` 신설 + 4개 사본 대체 | ✅ | `infra/errors.ts:24-26` 신설. `boot-report.ts`·`updater.ts`·`scheduler.ts` 로컬 정의 삭제 + import, `error-classifier.ts:26` 인라인 대체. grep `instanceof Error ? .* : String(` main 내 잔존 = errors.ts 정의부 1곳 |
| 2 | `isRecord` 신설 + 4개 사이트 대체 | ✅ | `src/shared/obj.ts:13-16` 신설. `skills/seed.ts`(정의 삭제)·`claude-settings.ts`(flatRead+classifyClaudeEnv)·`scaffold.ts`·`provider-registry.ts` 대체 |
| 3 | `readJsonFile` 신설 + 시맨틱 일치 사이트 채택 | ✅ | `infra/config/json-file.ts:14-22` 신설(제외 기준 주석 포함). 채택 3: `skills/seed.ts readBuiltinJson`·`deployer.ts` 2곳. 제외 3(경고 유지·원문 입력): `claude-settings.ts flatRead`·`provider-registry.ts modelsForProvider`·`orca-file.ts parseOrcaFile` — 구현자 기입 #1 |
| 4 | `onUnframedCb`/`onUnframedEvent` 삭제 + 코멘트 정정 + 버퍼 유지 | ✅ | `session-runtime.ts` 필드/메서드/호출 3곳 삭제, `:74-79` 코멘트를 실 배선(pendingMessages 폴링)으로 정정, `unframed.push` 유지. 테스트는 버퍼 합류 단언으로 개편 |
| 5 | `adaptMcp` 삭제 + 테스트 삭제 + 헤더 정합 | ✅ | `claude-adapt.ts` 함수·`ClaudeMcpConfig` import 삭제, 헤더 코멘트 갱신, `claude-adapt.test.ts` describe 삭제. grep `adaptMcp` = 0 |
| 6 | `abortCause` getter 2개 삭제, backing 유지 | ✅ | `session-runtime.ts`·`contracts/session-state.ts` getter 삭제. `cancelled`/`timedOut` 는 `currentAbortCause` 로 동작(기존 테스트 green) |
| 7 | `RuntimePool.onReap` 제거 | ✅ | `runtime-pool.ts` — entry 인터페이스 자체 제거(Map<string, RT> 로 단순화), `supervisor.ts:128` 무변경, `runtime-pool.test.ts` close 단언으로 조정 |
| 8 | chat-turn re-export 5종 삭제 + 테스트 리포인트 | ✅ | `chat-turn.ts:55-58` 삭제, resilience 테스트가 `features/chat/timers`·`turn-coordinator` 직접 import(실명 `createStallTimer`/`STALL_TIMEOUT_MS` 로 개명). 부수: electron 비의존화로 본 환경에서 7/7 실행 |
| 9 | 미사용 dist 헬퍼 3종 삭제, `distOrcaPluginDir` 유지 | ✅ | `paths.ts` — Manifest/Skills/McpJson 3종 삭제 + 레이아웃 소유권(claude-plugin-package) 주석. `bootstrap.ts:199` 소비 유지 |
| 10 | 턴-로컬 상태 팩토리 추출(동작 무변경) | ✅ | `chat-turn.ts` `freshTurnLocalState()`(공통 10필드 Pick) + 양쪽 spread. 차이 필드(`blockedSubagents` 시드·`pendingAttachmentViews` 등)는 호출부 명시 유지 |
| 11 | SettingsStore write-on-read 제거 + 테스트 | ✅ | `settings-store.ts` — lazy `load()` 1회 + `patch()` 만 쓰기, `RawSettingsBackend` 주입 seam. `settings-store.test.ts` 3건: getAll N회=쓰기 1회·patch 후 무쓰기 반영·깨진 데이터 복원 |
| 12 | McpStore `getAll()` 루프 밖 호이스트 | ✅ | `store.ts` — `toDto(name, server, s)` 파라미터화, `list()` 1회 read, add/update 는 `patch()` 반환값 전달(패치 후 상태 정확성 유지) |
| 13 | `enabledConfig()` 파스 캐시 + write 무효화 + 테스트 | ✅ | `store.ts` — `cache` 필드 + `read()` shallow copy + `write()` 갱신. `store.test.ts` 2건: 반복 호출 1회 파싱·CRUD 후 재파싱 없이 신선값 |
| 14 | scanSkills 병렬화 + 이중 왕복 제거 | ✅ | `scan.ts` — 스킬별 `readFile`+`stat` 동시 실행, 스킬/루트 `Promise.all`, dedup 순서(뒤 root 승리·readdir 순) 보존 주석. 기존 `scan.test.ts` green |
| 15 | `adapters()` 메모이즈 + invalidateAll 해제 | ✅ | `provider-settings.ts` — `adaptersCache` + `invalidateAll()` 에서 null 리셋 |
| 16 | 게이트 3종 green + 레이어 경계 0 | ✅ | 아래 게이트 절. 신규 import 방향 전부 하향(shared←전층·infra←상위) — boundaries lint 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 16/16 |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0 |
| 문서 형식/링크/한국어 | ✅ | — | 정합 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 동작-보존 리팩토링 — 리스크 2건(아래) 확인 대기 |
| Open Questions | ✖ | ✅ | 무접촉 |
| UI/UX 시각 검증 | ✖ | ✅ | 해당 없음(UI 무변경) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint       : 0 error
typecheck  : node/web/test 3종 0 error
vitest     : 801 passed (105 files) — 2 suite(chat-turn.continuity·history/writer) 로드 실패는
             electron 바이너리 403 환경 제한(0019/0087/0091 동일 계열). 무변경 베이스라인
             (git stash)에서도 동일 실패 확인 = 본 변경 무관. 기존 "3 suite 제한"은 AC8 의
             electron 비의존화로 2 suite 로 감소.
node --test: scripts 24/24 pass
```

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 무변경. 키/토큰/이메일/IP 혼입 해당 없음.

## PHASES.md 정합성

- 비기능 리팩토링 단건 — PHASES 승격은 PR 머지 시점 기준으로 생략(0092 는 INDEX + handoff 문서가 추적). 필요 시 머지 후 승격.

## 사람 확인 대기 (동작 변경 2건 — plan §리스크에 사전 명시)

1. **설정 캐시**: 앱 실행 중 `orca-settings.json` 수동 편집이 반영되지 않음(쓰기는 앱 UI 단일 경로 — TRD §6.7 설계 의도와 정합).
2. **mcp.json 캐시**: 앱 실행 중 mcp.json 외부 편집이 반영되지 않음(변이는 앱 CRUD 단일 경로).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: AC3 후보를 "시맨틱 일치 시"로 열어둔 것이 옳았다 — 실사에서 6곳 중 3곳 제외. 후보 나열 시점에 시맨틱을 다 확정했으면 더 좋았다.
- 구현 단계: scheduler.ts 의 import 누락을 typecheck 가 잡음(1회 왕복). 사전 grep 으로 방지 가능했다.
- 검증 단계: 실기(electron 구동) 검증은 본 환경에서 불가 — 설정/MCP 캐시의 실환경 확인은 사람 몫으로 남는다.

## 결론 / 다음 단계

- **PASS** — 인수 16/16, 게이트 green, 레이어 경계 0, 신규 의존성 0, IPC 무변경.
- 스킵 3건(설계 변경 수반 — plan §비범위): ① turn-coordinator `'AskUserQuestion'` 리터럴 → 중립 시맨틱 마커 설계 ② provider-registry Claude 파서 하드코딩 → 어댑터별 parseModels seam ③ slugify 3종(통합 실익 낮음 — 종결). ①②는 별도 핸드오프 후보로 남긴다.
