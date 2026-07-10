# Plan — 0092-main-simplify-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 비기능(리팩토링) = Claude 직접 plan → impl → verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0092-main-simplify-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | PR (본 브랜치 `claude/simplify-app-src-main-s2dua2`) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify @./app/src/main` — main 프로세스 코드를 reuse/simplification/efficiency/altitude 4관점으로 리뷰하고 발견 사항을 수정하라. 버그 헌팅은 비범위(그건 `/code-review` 소관). | 라이브 세션 요청 (2026-07-10) |
| 추론 의도 | "수정"은 동작 보존 정리(cleanup)에 한정하고, 설계 변경이 수반되는 발견은 적용하지 않고 기록만 한다 — 추론. 근거: /simplify 규칙 "intended behavior 를 바꾸는 수정은 스킵하고 노트". | (추론) |

## Context (왜)

`app/src/main` (~203파일 / 21k줄) 을 4개 독립 리뷰 에이전트로 스캔한 결과 18건이 보고되었고, 교차 검증(양쪽 사이트 실독·grep 소비자 확인) 후 **15건 적용 / 3건 스킵**으로 판정했다. 목적은 유지보수 비용 절감(중복 제거·데드코드 삭제)과 hot path 낭비 제거(설정 read 가 디스크 write 를 유발하는 문제 등)이며, 동작 변경은 §리스크에 명시한 1건(설정 캐시) 외 없다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `err instanceof Error ? err.message : String(err)` 4중복 | `app/src/main/app/boot-report.ts:14` · `app/updater.ts:37` · `features/scheduler/scheduler.ts:99` · `adapters/error-classifier.ts:26` |
| `isRecord` 가드 4중복 (명명판 1 + 인라인 3) | `features/extensions/skills/seed.ts:24` · `adapters/claude-settings.ts:28` · `features/extensions/scaffold.ts:44` · `features/providers/provider-registry.ts:35` |
| read+JSON.parse+undefined 폴백 보일러플레이트 ~5중복, `json-file.ts` 에 read 짝 부재 | `infra/config/json-file.ts` (`writeJsonAtomic` 만 존재) · `adapters/claude-settings.ts:24` · `features/extensions/skills/seed.ts:44` · `features/extensions/deployer.ts:95,160` · `features/providers/provider-registry.ts:21` · `infra/config/orca-file.ts:72` |
| `onUnframedCb`/`onUnframedEvent` 프로덕션 미배선 — 자동 연속 턴은 `pendingMessages.pending()` 폴링, `:78` 코멘트가 오도 | `features/sessions/session-runtime.ts:78,91,140-142,281` · `app/chat-turn.ts:652-688` · 소비자 grep 결과 테스트(`session-runtime.test.ts:226`)뿐 |
| `adaptMcp` 프로덕션 미호출 (plugin `.mcp.json` 경로가 기본, 0058) | `adapters/claude-adapt.ts:5,46-50` · 소비자 grep 결과 `claude-adapt.test.ts` 뿐 |
| `abortCause` getter 2개 무소비 (`cancelled`/`timedOut` 이 소비 경로) | `features/sessions/session-runtime.ts:123-125` · `contracts/session-state.ts:12-14` · grep 결과 정의부 외 0 |
| `RuntimePool.onReap` 항상 no-op — 유일 프로덕션 호출부가 미전달 (0055/0067 IdleCloseTimer 삭제 잔재) | `features/sessions/runtime-pool.ts:16,37,40,80` · `features/sessions/supervisor.ts:128` |
| chat-turn 무회귀 re-export 5종 — 대상 경로 `./send` 부재, 소비자는 테스트 1파일 | `app/chat-turn.ts:55-58` · `app/chat-turn.runtime-resilience.test.ts` |
| `distOrcaPluginManifestPath`/`SkillsDir`/`McpJsonPath` 소비자 0 (테스트 포함), `distOrcaPluginDir` 만 bootstrap 사용. `claude-plugin-package.ts` 가 동일 레이아웃을 독자 소유 주장 | `infra/config/paths.ts:120-134` · `app/bootstrap.ts:199` · `features/extensions/claude-plugin-package.ts:25-67` |
| `TurnContext` 턴-로컬 초기화 필드 ~10개가 신규 턴/연속 턴 두 리터럴에 중복 | `app/chat-turn.ts:384-440` · `:700-727` |
| `SettingsStore.getAll()` = write-on-read — 매 read 가 full zod 마이그레이션 + electron-store 동기 디스크 쓰기(`this.store.store =` 대입은 conf 가 매번 원자 쓰기). 턴당 2회+(builder·mcp enabledConfig) | `infra/settings-store.ts:24-32` · `features/extensions/builder.ts:51` · `features/extensions/mcp/store.ts:240` · electron-store(conf) 문서: store setter 는 대입 시 디스크 직렬화 |
| `McpStore.list()` 가 서버당 `getAll()` 호출 (O(n) 증폭) | `features/extensions/mcp/store.ts:61,76-79` |
| `enabledConfig()` 매 턴 `readFileSync`+parse+zod, 캐시 없음 (변이점은 `write()` 단일) | `features/extensions/mcp/store.ts:239-247` · `features/extensions/mcp/file.ts:15-28` |
| `scanSkills` 스킬당 순차 `readFile`+`stat` 2왕복, root 간에도 순차 — 부팅 `skill-scan` 스텝 지연 | `features/extensions/skills/scan.ts:52-93` |
| `adapters()` 목록 미캐시 (`list(adapter)` 는 `listCache` 로 캐시, 비대칭) | `features/providers/provider-registry.ts:44` · `features/providers/provider-settings.ts` (`listCache`·`invalidateAll`) |
| main 레이어 DAG·리터럴 격리 규칙 (신규 헬퍼 배치 근거: errors=infra, obj=shared, json-file=infra) | `@app/src/main/AGENTS.md` §레이어 DAG·작업 규칙 |

## 인수 기준 (Acceptance Criteria)

**A. 재사용 통합**

1. `infra/errors.ts` 에 `errorMessage(err: unknown): string` 신설, 4개 사본(`boot-report.ts` `formatError` · `updater.ts` `asErrorMessage` · `scheduler.ts` `errorMessage` · `error-classifier.ts` 인라인) 이 이를 사용하고 로컬 정의는 삭제된다.
2. `src/shared/obj.ts` 에 `isRecord(v: unknown): v is Record<string, unknown>` 신설, 4개 사이트(`skills/seed.ts` · `claude-settings.ts` · `scaffold.ts` · `provider-registry.ts`) 가 이를 사용한다.
3. `infra/config/json-file.ts` 에 `readJsonFile(path: string): unknown | undefined` (부재/파싱 실패 = undefined) 신설, 시맨틱이 동일한 사이트가 채택한다(후보 5곳 — ENOENT/파싱실패를 구분하거나 에러를 전파하는 사이트는 제외하고, 채택/제외를 구현 보고에 명시). 각 사이트의 후속 스키마 검증은 유지.

**B. 데드 코드 제거**

4. `session-runtime.ts` 의 `onUnframedCb`/`onUnframedEvent`/`this.onUnframedCb?.(ev)` 삭제 + `:78` 오도 코멘트 정정. `unframed` 버퍼는 유지. 해당 테스트 케이스 제거.
5. `claude-adapt.ts` 의 `adaptMcp` 삭제 + 테스트의 해당 describe 삭제 (+ 헤더 코멘트 정합).
6. `abortCause` getter 2개(`session-runtime.ts:123-125` · `contracts/session-state.ts:12-14`) 삭제. backing 필드(`cancelled`/`timedOut` 경로)는 유지.
7. `runtime-pool.ts` 의 `onReap` 파라미터/필드/호출 삭제, `runtime-pool.test.ts` 는 `runtime.close()` 단언으로 조정.
8. `chat-turn.ts:55-58` 의 re-export 5종(`IDLE_TIMEOUT_MS`·`createIdleTimer`·`MAX_RETRIES`·`RETRY_BACKOFF_MS`·`abortableDelay`) 삭제, `chat-turn.runtime-resilience.test.ts` 는 실제 홈(`features/chat/timers`·`features/chat/turn-coordinator`)에서 import.
9. `paths.ts` 의 미사용 3종(`distOrcaPluginManifestPath`·`distOrcaPluginSkillsDir`·`distOrcaPluginMcpJsonPath`) 삭제. `distOrcaPluginDir` 유지.

**C. 단순화**

10. `chat-turn.ts` 두 `TurnContext` 리터럴의 공통 턴-로컬 초기화 필드를 단일 팩토리로 추출해 spread. 두 리터럴의 기존 값 차이는 그대로 보존(동작 무변경).

**D. 효율**

11. `SettingsStore`: 마이그레이션+디스크 쓰기는 최초 1회(lazy) + `patch()` 시에만 수행, `getAll()` 은 메모리 캐시 반환 — read 가 디스크 쓰기를 유발하지 않음을 단위 테스트로 고정.
12. `McpStore.list()`(및 CRUD 내 반복 호출)가 `getAll()` 을 루프 밖 1회로 호이스트.
13. `McpStore.enabledConfig()` 의 mcp.json 파스 결과를 캐시하고 `write()` 에서 무효화 — CRUD 후 신선값 반환을 테스트로 확인.
14. `scanSkills`: 같은 파일 이중 fs 왕복 제거 + 스킬/루트 병렬화(`Promise.all`). 결과 집합 동일(기존 테스트 green).
15. `ProviderSettingsService` 에 어댑터 목록 메모이즈 추가, `invalidateAll()` 에서 해제.

**공통**

16. 게이트 3종(lint/typecheck/test) green. 레이어 경계 위반 0(신규 import 전부 하향).

## 범위 / 비범위

- **범위**: 위 15건 — 전부 `app/src/main/**` + `app/src/shared/obj.ts` + 짝 테스트.
- **비범위** (파생 이슈로 기록, 별도 핸드오프감):
  - turn-coordinator 의 `'AskUserQuestion'` raw 리터럴 매칭 → 중립 시맨틱 마커 설계(shared/ipc 스키마 + 어댑터 + renderer 동시 변경).
  - `provider-registry` 의 `parseClaudeModels`/`'anthropic'` 하드코딩 → 어댑터별 `parseModels` seam (contracts 설계 변경, 0021 구조·opencode Future Scope).
  - slugify 3종 통합 → 문자클래스·캡이 실제 동작 차이, 통합 실익 낮아 미채택.
  - `distOrcaPluginDir` 의 Claude 레이아웃 소유권을 `claude-plugin-package.ts` 로 이관하는 문제.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용: `infra/errors.ts` · `src/shared/obj.ts` · `infra/config/json-file.ts` · `ProviderSettingsService.listCache/invalidateAll` 패턴.
- electron-store(conf) 의 `.store` setter 가 대입마다 동기 디스크 쓰기라는 전제(AC11 의 근거) — 라이브러리 문서 기준.
- **신규 의존성: 없음.**

## 설계

- 신규 헬퍼 배치는 레이어 DAG 하향 유지: `errorMessage`=infra(4 소비자 전부 infra 위 레이어), `isRecord`=src/shared(전 레이어 접근 가능), `readJsonFile`=infra/config(기존 `writeJsonAtomic` 짝).
- `SettingsStore` 는 `cached: Settings | null` 필드 + private `load()` (첫 접근 시 migrate+write 1회) 로 전환. `patch()` 는 캐시 기반 merge → migrate → write → 캐시 갱신. 깨진 디스크 데이터 복원(헤더 코멘트의 불변식)은 첫 load 에서 그대로 수행된다.
- `McpStore` 는 `configCache: McpFileConfig | null` + `write()` 무효화. `toDto` 는 settings 객체를 파라미터로 받는다.
- `freshTurnLocalState()` 는 `chat-turn.ts` 내 로컬 함수(반환 타입은 `TurnContext` 의 해당 필드 Pick) — 컴포지션 루트 내부라 레이어 이동 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- UI 변경 없음. 동시성: `McpStore` 캐시는 main 단일 스레드 + `write()` 단일 변이점이라 레이스 없음. 설정 파일을 앱 실행 중 외부 편집하는 흐름은 §리스크 참조.
- `scanSkills` 병렬화로 결과 배열 순서가 바뀔 수 있음 → 기존 정렬/키 소비를 확인하고 필요 시 결정적 정렬 유지.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| AC11: 캐시 도입으로 *앱 실행 중* `orca-settings.json` 수동 편집이 반영되지 않음 (현재는 매 read 재파싱이라 반영됨) | 설정 쓰기는 앱 UI(`settingsSet`) 단일 경로가 설계 의도(TRD §6.7) — 수용. verify 에 동작 변경으로 명시 |
| AC13: mcp.json 을 외부에서 직접 편집하면 캐시가 stale | 변이 경로는 앱 CRUD(`write()`) 단일 — 동일 근거로 수용 |
| AC14: 병렬화로 스캔 결과 순서 비결정 가능 | 결과를 이름 기준 결정적 정렬로 고정(또는 기존 소비가 순서 비의존임을 확인) |
| 데드코드 삭제(AC4~9)가 실은 미래 배선 예정이었을 가능성 | 각각 잔재 근거(0055/0067·`./send` 부재·grep 0) 를 자료조사에 기록 — 필요 시 git 이력에서 복원 가능 |

- 되돌리기 어려운 결정: 없음 (전부 git 이력에서 복원 가능한 삭제/이동).
- **단독 결정 금지 항목**: 없음 (Open Question 무접촉, 신규 의존성 0).

## 영향 받는 파일

- `app/src/main/infra/errors.ts` · `app/src/shared/obj.ts` · `app/src/main/infra/config/json-file.ts` (헬퍼 신설)
- `app/src/main/app/{boot-report,updater,chat-turn}.ts` · `app/src/main/features/scheduler/scheduler.ts` · `app/src/main/adapters/{error-classifier,claude-settings,claude-adapt}.ts`
- `app/src/main/features/extensions/{scaffold,deployer}.ts` · `features/extensions/skills/{seed,scan}.ts` · `features/extensions/mcp/store.ts`
- `app/src/main/features/providers/{provider-registry,provider-settings}.ts`
- `app/src/main/features/sessions/{session-runtime,runtime-pool}.ts` · `app/src/main/contracts/session-state.ts`
- `app/src/main/infra/{settings-store.ts,config/paths.ts,config/orca-file.ts}`
- 짝 테스트: `session-runtime.test.ts` · `runtime-pool.test.ts` · `claude-adapt.test.ts` · `chat-turn.runtime-resilience.test.ts` · (신규) settings-store/mcp-store 캐시 테스트

## 참고 문서

- `@app/src/main/AGENTS.md` (레이어 DAG · 리터럴 격리 · 네이밍)
- `docs/TRD.md §6.7` (Settings 영속화)
- IPC 변경: 없음 (`IPC_CONTRACT.md` 무접촉)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: AC11(read 무쓰기)·AC13(캐시 무효화) 단위 테스트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론(동작 보존 한정)은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`/문서 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·자료조사 근거.
- [x] 의존 기술 — 신규 의존성 0 확인.
- [x] 파생 UX — UI 무변경·동시성·순서 비결정 검토.
- [x] 리스크 — 캐시 동작 변경 2건·순서·데드코드 복원성 기록, Open Question 무접촉.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 15건 전부 설계대로 구현. AC3 의 "시맨틱 동일 사이트만 채택" 원칙이 실사 결과 중요했다 — 후보 6곳 중 3곳만 채택(아래 보고).
- 이견 / 우려: 없음. AC5(adaptMcp)의 헤더 코멘트("레거시 제거 전까지 남겨둔다")는 제거 조건 성립으로 판단(플러그인 `.mcp.json` 경로가 0058 이후 기본이고 프로덕션 소비자 0).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | AC3 후보 중 `claude-settings.ts flatRead`·`provider-registry.ts modelsForProvider`·`orca-file.ts parseOrcaFile` 은 실패 원인별 경고/원문 문자열 입력이라 시맨틱 불일치 | ✅ 채택 제외(3곳: `skills/seed.ts`·`deployer.ts` 2곳만 채택), 헬퍼 주석에 제외 기준 명시 | plan §인수기준 3 의 제외 조항 |
| 2 | AC5·AC12 부수: `deployer.ts` mcp 소스가 JSON 원시값(비객체)일 때 기존엔 `.mcpServers` 접근 예외로 'invalid source' 폴백 — `isRecord` 가드로 동일 폴백을 명시화(액션 문자열만 미세 차이 가능) | ✅ 구현함 (동작 등가·명시적) | `deployer.ts` deploy() |
| 3 | AC8 부수 효과: `chat-turn.runtime-resilience.test.ts` 가 electron 의존(`chat-turn.ts`) import 를 벗어나 **본 환경(electron 바이너리 403)에서도 로드·실행 가능**해짐 — 기존 "3 suite 환경 제한"이 2 suite 로 감소 | ✅ 확인(7/7 green) | 게이트 결과 |
| 4 | AC11: `patch()` 반환값이 기존 `next`(merge 결과) → `migrated.settings` 로 변경 — 유효 Settings 에 대해 `migrateRawSettings` 는 내용 동일(schema parse 재통과)이라 등가 | ✅ 구현함 (등가 확인) | `settings-migration.ts:32-41` |
| 5 | AC13: 캐시 원본 오염 방지를 위해 `read()` 가 shallow copy 반환(호출부가 엔트리 추가/삭제 후 write 하는 기존 패턴 유지) | ✅ 구현함 | `mcp/store.ts read()` |

## [구현자 기입] 구현 체크리스트

- [x] A1~A3 재사용 통합
- [x] B4~B9 데드 코드 제거
- [x] C10 턴 상태 팩토리
- [x] D11~D15 효율
- [x] 게이트 3종 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신설 2(`infra/settings-store.test.ts`·`extensions/mcp/store.test.ts`), 수정 24 — `infra/{errors,settings-store}.ts`·`infra/config/{json-file,paths}.ts`·`shared/obj.ts`·`app/{boot-report,updater,chat-turn}.ts`(+resilience test)·`adapters/{error-classifier,claude-settings,claude-adapt}.ts`(+test)·`features/scheduler/scheduler.ts`·`features/extensions/{scaffold,deployer}.ts`·`extensions/skills/{seed,scan}.ts`·`extensions/mcp/store.ts`·`features/providers/{provider-registry,provider-settings}.ts`·`features/sessions/{session-runtime,runtime-pool}.ts`(+tests)·`contracts/session-state.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ 0 / typecheck ✅ 3종 0 / test ✅ vitest **801 passed** + node --test **24/24** (2 suite=`chat-turn.continuity`·`history/writer` 는 electron 바이너리 403 환경 제한 — 무변경 베이스라인에서도 동일 실패 확인, 0019/0087/0091 동일 계열. 기존 3 suite 제한이 AC8 로 2 로 감소) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | 본 구현 커밋 (hash 는 INDEX.md·verify.md 에 기재) |
