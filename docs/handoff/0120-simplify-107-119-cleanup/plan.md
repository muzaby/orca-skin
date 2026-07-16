# Plan — 0120-simplify-107-119-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0120-simplify-107-119-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | PHASES Phase 4 행 (0107~0119 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify handoff 107~119 까지 리팩토링` — 0107~0119 가 도입한 코드 변경을 4관점(재사용·단순화·효율·altitude)으로 리뷰하고 발견을 적용 | 라이브 세션 요청 (2026-07-16) |
| 추론 의도 | /simplify 는 동작 보존 품질 정리 — IPC 계약·타입 표면·런타임 방출값·UI 표시는 불변이어야 한다 (추론: /simplify 스킬 정의 + 0092/0093/0100/0106 선례) | `docs/handoff/0106-simplify-101-105-cleanup/plan.md` |

## Context (왜)

0107~0119 범위(`8121461..0078a90`, 코드 91파일 · +3185/−486 — 성능 시리즈 0107~0110 ·
사용량 0111~0112 · CI/빌드/릴리스 0113~0116 · settingSources/래퍼 플러그인 0117 · provider
respawn 0118 · steer gate 0119)를 4관점 병렬 리뷰한 결과, 핵심 설계(마감 1회 FTS 기록·증분
블록 분할·청크 인코딩·비동기 fs 전환·shared usage 순수층)는 건전했다. dedup 후 적용 대상은
**15건**: 마감+리셋 3중복(F1)·턴 종료 리셋 4중복(F2)·복구 순서 불변식 콜러 중복(F3) 같은
불변식 소유권 정리와, 0109 sync→async 전환이 남긴 직렬 fs(F9~F11), day-key/주경계 파서
재구현(F4~F5), 렌더 파생값 미메모(F6~F7), 죽은 배관(F8)·경로 이중 정의(F15) 등이다.
스킵 3건(S1~S3)은 동작 변경 수반·의도된 설계로 판정해 기록만 남긴다.

## 자료조사 (Research)

> 4관점 리뷰(재사용·단순화·효율·altitude) 에이전트 4기 병렬 실행 결과의 dedup. 모든 발견은
> 현재 파일 내용 기준 재검증됨.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `commitUserMessage`(가드 포함)·telemetry 분기가 신규 `finalizeTurn` 의 몸체(마감+id/text 리셋)를 인라인 — 0107 "content 는 마감 시 1회" 불변식이 3곳에 산개 | `app/src/main/features/history/writer.ts:70-74,302-305` (수정 전) |
| `inflight:false·turnProviderKey:null·turnStartedAt:null·retry:undefined` 가 턴 종료 4경로(telemetry/turn.aborted/error/CANCEL_CHAT)에 복붙 — 0119 가 4곳에 손으로 필드 추가. 스냅샷 초기화 누락 시 steer 영구 차단 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:411-416,476-484,489-498,528-536` (수정 전) |
| "rebuild → recover 순서 + live 세션 스킵" 복합 불변식이 bootstrap·chat-turn 두 콜러에 주석 복붙으로만 강제 | `app/src/main/app/chat-turn.ts:402-412`·`app/src/main/app/bootstrap.ts:172-180` (수정 전) |
| `TokensPerDayChart.dayKeyToMs` 가 `stats.ts` 의 미export `parseDayKey` 를 라인 동일 재구현 (이미 같은 모듈에서 `totalTokens` import 중) | `TokensPerDayChart.tsx:19-22` (수정 전) ↔ `app/src/shared/usage/stats.ts:44` |
| `aggregateWeekly` 가 월요일 주 시작 계산(`(getDay()+6)%7`)을 인라인 — `clock.ts` `boundaries().weekStart` 와 동일 정의의 두 번째 사본 (주석이 "clock.ts 와 동일 기준" 자인) | `stats.ts:97-100` (수정 전) ↔ `app/src/shared/time/clock.ts:21-27` |
| `UsageTab` 파생값(제로필 최대 730행 ×2 Date 할당·주간 집계·합계 reduce ×2)이 매 렌더 재계산 — 입력(stats/range)은 안정 | `UsageTab.tsx:130-134` (수정 전) |
| `TokensPerDayChart.data` 매 렌더 새 배열 → recharts 전체 재대조 | `TokensPerDayChart.tsx:54-59` (수정 전) |
| `Tweaks.scheduler` 는 0112 cron UI 제거 후 렌더러 읽는 곳/쓰는 곳 0 (grep 유일 언급 = useTweaks 자신). main 스케줄러는 settings store 직읽 | `app/src/renderer/src/shared/hooks/useTweaks.ts:22,34,56` (수정 전) |
| `deploy()` 의 `validateMcp`·`scanProviderSettings` 는 독립 읽기인데 직렬 await — 부팅 + 모든 skill/MCP/engine CRUD 경로 | `app/src/main/features/extensions/deployer.ts:115-116` (수정 전) |
| user-skills 액션 문자열 2종이 dry-run/실행 분기에 복붙 — deploy 테스트가 두 경로 문구를 대조 | `deployer.ts:139-143,198-202` (수정 전) |
| 0109 sync→async 전환이 mkdir ×3·스킬별 재귀 cp 를 전부 직렬 await 로 — 대상 경로 서로소라 병렬 안전 | `app/src/main/features/extensions/claude-plugin-package.ts:58-61,41-47` (수정 전) |
| seed 도 스킬별 rm+cp 직렬 — 스킬 디렉토리 서로소, seeded 순서만 보존하면 병렬 안전 | `app/src/main/features/extensions/skills/seed.ts:81-88` (수정 전) |
| `bufferToBase64Chunked` 가 마지막 청크 *뒤에도* setImmediate 양보 — 결과를 한 틱 지연 | `app/src/main/features/chat/attachments.ts:43-46` (수정 전) |
| `lastFetchOk: Map<string,boolean>` 은 부재=false 인 2상태 사실의 3상태 모델 — `!(get(k) ?? false)` 이중 부정 | `app/src/main/features/usage/external-usage-service.ts:25,48,104,145` (수정 전) |
| `paths.distUserClaudePluginDir` 가 `'claude'` 하드코드로 `userClaudePluginRoot`(`CLAUDE_USER_PLUGIN_NAME` 파생)와 같은 경로를 이중 정의 — 이름 불일치 시 adaptPlugins 매니페스트 가드가 조용히 스킵(스킬 무증상 소실). orca 쌍(`distOrcaPluginDir`↔`orcaPluginRoot`)도 동일 패턴(선재) | `app/src/main/infra/config/paths.ts:138-140` (수정 전) ↔ `features/extensions/claude-user-skills-plugin.ts:28-29` |
| infra 는 adapters 를 import 할 수 없어(paths.ts 에서 상수 파생 불가) 해소는 app(bootstrap)이 feature 헬퍼를 쓰는 방향 | `app/src/main/AGENTS.md` 레이어 DAG |
| `caf99df refactor(usage)` 가 이미 사용량 계산(clock/limits/external-usage-service 일부)에 /simplify 1회 기적용 — 그 범위 재발견 없음 | 커밋 `caf99df` |

## 인수 기준 (Acceptance Criteria)

> 전부 동작 보존(관찰 가능 동작·타입 표면·IPC·UI 무변경) 전제. "잔존 grep 0" 은 치환 원형이
> 해당 파일에 남지 않음을 뜻한다.

1. **F1** — `writer.ts` 의 user 커밋·telemetry 분기가 `this.finalizeTurn(turn)` 호출로 수렴하고, `finalizeAssistantMessage(turn)` 직접 호출 + id/text 수동 리셋 조합이 `finalizeTurn` 밖에 잔존 grep 0. 기존 writer 테스트 무수정 green.
2. **F2** — `chatReducer.ts` 에 `TURN_END_RESET`(Pick 타입 상수)가 생기고 4개 턴 종료 분기가 이를 스프레드. `turnProviderKey: null` 인라인 나열이 BEGIN_TURN/initialState 밖 잔존 grep 0. reducer 테스트(0119 `chatReducer.model.test.ts` 포함) 무수정 green.
3. **F3** — `recovery.ts` 에 복합 진입점 `recoverSessionHistory(db, options)` 가 추가되고 rebuild→recover 순서 + live 가드를 내부 소유. bootstrap·chat-turn 콜러가 1회 호출로 축소, 두 파일에서 `rebuildIncompleteMessageContent`/`recoverDanglingToolCalls` 직접 import 잔존 grep 0. 기존 recovery 테스트 무수정 green.
4. **F4** — `stats.ts` 의 `parseDayKey` 가 export 되고 `TokensPerDayChart` 의 `dayKeyToMs` 재구현이 삭제(잔존 grep 0), 차트는 `parseDayKey(...).getTime()` 사용.
5. **F5** — `aggregateWeekly` 의 주 시작 인라인 계산이 `boundaries(parseDayKey(row.day)).weekStart` 재사용으로 대체(`(getDay()+6)%7` 이 stats.ts 잔존 grep 0). `stats.test.ts` 무수정 green.
6. **F6** — `UsageTab` 의 series/weekly/grandTotal/totalCost 파생이 `useMemo([stats, range])` 로 감싸진다.
7. **F7** — `TokensPerDayChart.data` 가 `useMemo([days])` 로 identity 고정.
8. **F8** — 렌더러 `Tweaks` 인터페이스·DEFAULTS·get 매핑에서 `scheduler` 제거(useTweaks.ts 에서 잔존 grep 0). shared `SchedulerSettings` 스키마·main 스케줄러 무변경.
9. **F9** — `deploy()` 의 두 검증 읽기가 `Promise.all` 병렬화. `deployer.test.ts` 무수정 green.
10. **F10** — user-skills 액션 문자열이 단일 헬퍼(`userSkillsAction`)로 수렴, 리터럴 2종이 헬퍼 밖 잔존 grep 0(문구 불변 — 테스트 무수정 green 이 증거).
11. **F11** — `renderClaudePluginPackage` 의 mkdir ×3 + `copyOrcaSkills` 가 `Promise.all` 1군, 매니페스트/.mcp.json writeFile 이 `Promise.all` 1군. `copyOrcaSkills` 는 같은 root 내 entry 병렬(root 간 직렬 유지 — 이름 충돌 승자 순서 보존). `claude-plugin-package` 관련 테스트 무수정 green.
12. **F12** — `seedBuiltinSkills` 의 스킬별 rm+cp 가 스킬 간 병렬(스킬 내 rm→cp 직렬 유지), `seeded` 순서는 manifest 순서 보존. `seed.test.ts` 무수정 green.
13. **F13** — `bufferToBase64Chunked` 가 청크 *사이*에서만 양보(마지막 청크 뒤 setImmediate 없음). `attachments.test.ts` 무수정 green(출력 문자열 불변).
14. **F14** — `lastFetchOk` Map 이 `freshProviderKeys` Set 으로 대체, `?? false` 이중 부정 소멸. `external-usage-service.test.ts` 무수정 green.
15. **F15** — bootstrap 의 plugin 루트 2개가 feature 소유 헬퍼(`orcaPluginRoot`·`userClaudePluginRoot`)에서 파생, `paths.ts` 의 `distUserClaudePluginDir`(+동일 패턴 `distOrcaPluginDir`·소비자 0 이 된 `distPluginsDir`) 제거 — `distUserClaudePluginDir|distOrcaPluginDir|distPluginsDir` 저장소 잔존 grep 0. 산출 경로 문자열 불변.
16. **게이트 green** — lint 0 error · typecheck 3분할 0 · vitest 934/934 + scripts 25/25(electron 1스위트 로드 실패 = egress 403 환경 베이스라인, 0117~0119 verify 동일 기준). 레이어 경계 0 · 신규 의존성 0 · IPC 채널/스키마 무변경.

## 범위 / 비범위 (스킵 판정 기록)

- **범위**: 위 인수 1~16.
- **비범위 (스킵 3건 — 발견했으나 적용하지 않음)**:
  - **S1 (altitude — 파생 이슈 D1 로 이관)**: `app/handlers/engine.ts` `refreshProviderSettings` 가 bare `deploy('claude')` 로 `ExtensionDeploymentService` chokepoint 를 우회 — `mcpConfig`/`skillRoots` 미주입이라 engine CRUD 후 dist 의 `.mcp.json` 이 비고 user-skills 플러그인이 스킵되며, 서비스의 직렬화된 배포와 경합. **수정은 관찰 가능 동작 변경(dist 내용물)이라 /simplify 범위 밖** — 0109 plan 의 연기 항목 D1("engine 경로도 서비스 경유")과 동일 사안이며 0117 이후 드리프트 폭이 커져 후속 핸드오프를 권고한다.
  - **S2 (재사용)**: `shared/ui/markdown/themeStore.ts` 의 MutationObserver 기반 테마 구독 — `useTweakContext().t.theme` 재사용이 가능하나, context 구독은 *모든* tweak 변경에 CodeBlock(스트리밍 핫패스)을 재렌더한다. 테마 단독 구독의 재렌더 정밀도가 0108(성능 핸드오프)의 의도로 판단 — 유지.
  - **S3 (효율, 부분 적용)**: `TokensPerDayChart` tickFormatter 의 틱당 재파싱 — 라벨 사전계산(축 dataKey 변경)은 recharts 축 타입 거동 리스크 대비 이득이 미미(틱 수 소량)해 미적용. 공유 `parseDayKey` 재사용(F4)과 data 메모(F7)로 갈음.
  - `caf99df` 기적용 범위(사용량 한도 계산)·`toStatsDay`/`toStatsModel` 근사 쌍둥이(필드셋 상이)·0119 Composer+store 이중 방어(문서화된 의도)·`adaptSettingSources()` 매 턴 fresh 객체(공유 배열 aliasing 방지) — 발견 아님으로 판정.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 편집(신규 파일 0·신규 export 는 `parseDayKey`·`recoverSessionHistory`·모듈 내부 상수/헬퍼뿐). **신규 의존성: 없음.**
- 병렬화(F9~F12) 전제: 대상 경로가 서로소(같은 root 내 entry.name 유일, 스킬 디렉토리 이름별 서로소, manifest.skills 는 빌드 산출물이라 중복 없음) — 코드 주석에 명기.
- F15 전제: app 레이어는 features·infra 둘 다 import 가능(레이어 DAG) — bootstrap 이 feature 헬퍼로 경로 파생.

## 설계

- 불변식 소유권 이동: F1(마감+리셋 쌍 → `finalizeTurn` 단일 소유) · F2(`TURN_END_RESET` 상수) · F3(`recoverSessionHistory` 가 순서+가드 내부화) · F15(플러그인 경로 = 레이아웃 소유 feature 렌더러의 헬퍼가 SSOT).
- 재사용: F4/F5 는 `src/shared` 내부 하향 참조(usage → time)로 레이어 무위반 — `limits.ts` 가 이미 `../time/clock` import 선례.
- 병렬화는 전부 `await` 지점의 `Promise.all` 치환 — 실패 전파 의미(첫 reject 로 throw)는 기존 직렬과 동일하게 상위 catch 로 흐른다.
- 레이어 경계: 전 항목 하향 의존 유지(boundaries lint 로 기계 검증).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- N/A — 순수 내부 리팩토링. F6~F7 메모이제이션은 렌더 결과 불변(입력 동일 시 파생 동일 — `fillDailySeries` 의 now 는 `stats.updatedAt` 고정이라 `Date.now()` 비의존).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| F11/F12 병렬화가 복사 충돌 순서를 바꿀 가능성 | 서로소 경로만 병렬(같은 root 내 entry·스킬 간). 이름 충돌 의미가 있는 root 간 루프는 직렬 유지. 기존 deployer/seed 테스트 무수정 green 으로 기계 검증 |
| F3 복합 진입점의 가드 의미 변화 | bootstrap(무옵션)=이전과 동일 전역 rebuild+recover, chat-turn(sessionId+live)=이전과 동일(스코프 rebuild 스킵 + per-row recover 가드) — 분기 1:1 대응을 코드 주석에 명기 |
| F15 가 선재 `distOrcaPluginDir` 까지 제거(리뷰 diff 약간 밖) | 소비자 grep 0 확인 + 산출 문자열 불변(`orcaPluginRoot` 동일 값). typecheck/lint 로 기계 검증 |

- 되돌리기 어려운 결정: 없음 (내부 구조 이동, 시그니처·동작·IPC·DB 무변경).
- **단독 결정 금지 항목**: 없음 (S1 은 적용하지 않고 파생 이슈로 기록만).

## 영향 받는 파일

- main: `features/history/writer.ts` · `features/chat/{recovery,attachments}.ts` · `features/extensions/{deployer,claude-plugin-package,skills/seed}.ts` · `features/usage/external-usage-service.ts` · `app/{bootstrap,chat-turn}.ts` · `infra/config/paths.ts`
- renderer: `features/chat/reducer/chatReducer.ts` · `features/settings/components/{UsageTab,TokensPerDayChart}.tsx` · `shared/hooks/useTweaks.ts`
- shared: `usage/stats.ts`

## 참고 문서

- `docs/handoff/0106-simplify-101-105-cleanup/{plan,verify}.md` — /simplify 정리 선례(스킵 판정 관례)
- `docs/handoff/{0107,0109,0111,0112,0117,0118,0119}-*/plan.md` — 리뷰 대상 코드의 원 설계
- `app/src/main/AGENTS.md` — main 레이어 DAG (F15 해소 방향 근거)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (+ `node --test scripts/*.test.mjs`).
- 신규 테스트: 불필요 — 전 항목 동작 보존 리팩토링이라 기존 스위트(무수정 green)가 회귀 가드.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·커밋·핸드오프 문서)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다(grep 0·무수정 green).
- [x] 의존 기술 — 신규 의존성 0·서로소 경로 전제를 식별했다.
- [x] 파생 UX — 순수 내부 리팩토링이라 N/A 로 표기했다(메모 불변 근거 포함).
- [x] 리스크 — 병렬화 순서·복합 진입점 의미·선재 헬퍼 제거 리스크와 완화책을 적었다.

---

> **[구현자 기입]** 본 건은 비기능 = Claude 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 전 항목. 발견이 15건으로 많지만 각각 독립·소규모라 단일 구현 커밋으로 통합(0106 선례).
- 이견 / 우려: F15 에서 `distOrcaPluginDir`·`distPluginsDir`(선재)까지 제거하는 것은 리뷰 diff 를 약간 벗어나지만, `distUserClaudePluginDir` 만 제거하면 같은 줄의 두 경로가 다른 스타일로 갈라져 오히려 혼란 — 소비자 0 을 확인하고 함께 제거했다(리스크 표 반영).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | S1(engine CRUD 배포 우회)은 리팩토링이 아니라 기능 결함 계열 — /simplify 에서 고치면 dist 내용물이 바뀐다 | ⚠️ 보고만·**후속 핸드오프 권고** (파생 이슈 D1) | 0109 plan 연기 항목 D1 과 동일 사안, 0117 이후 드리프트 확대 |

## [구현자 기입] 구현 체크리스트

- [x] F1~F15 적용 (15파일, +157/−143)
- [x] 스킵 3건(S1~S3) 근거 기록
- [x] 게이트 + 영향 스위트 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 15개 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅ 0 error(경고 1 = 0102 TanStack↔React Compiler 기존) / typecheck 3종 ✅ 0 / vitest ✅ **934/934**(122파일 — `chat-turn.continuity` 1스위트 로드 실패는 electron 바이너리 egress 403 환경 베이스라인, 0117~0119 verify 동일) / scripts ✅ 25/25 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `184230e` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | engine CRUD(`handlers/engine.ts` `refreshProviderSettings`)가 bare `deploy('claude')` 로 `ExtensionDeploymentService` 를 우회 — `mcpConfig`/`skillRoots` 미주입이라 engine add/update/delete 후 dist `.mcp.json` 이 비고(0117 이후엔 user-skills 플러그인도 스킵) 다음 skill/MCP CRUD 까지 열화, 서비스 직렬화와도 경합 | altitude 리뷰 / 0109 plan 연기 D1 | `ctx.deployExtensions()` 경유 + `providerSettings.invalidateAll()` — 동작 변경이므로 **별도 핸드오프**(버그수정, Claude 비기능) 권고 | open |
