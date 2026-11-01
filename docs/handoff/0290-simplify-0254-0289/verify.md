# Verify — 0290-simplify-0254-0289

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업 규칙은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 재현 자료: [`verify-evidence/`](verify-evidence/) — 변이 정의·결과 JSON, 변이 러너, 회귀 재현 테스트 2개.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0290-simplify-0254-0289` |
| 검증자 | Claude Code |
| 일자 | 2026-11-01 |
| 대상 커밋/range | `a2e8464..4d308eb` — r1 구현 19커밋 `291b721`…`4d308eb`(마지막 `4d308eb`은 문서만, app 트리 = CI head `00bb2a9`) |
| 구현 전 plan 기준 | `a2e8464` (V1 `ae103f3` + ΔV1) |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1` |
| 검증 기준 plan revision | `a2e8464:V1+ΔV1` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — V1 설계 Claude, ΔV1·구현 Codex(D-017), 검증 Claude. 그래도 구현 보고 밖 축 20건을 §4에 넣었다 |

## 0. 기준선 / plan 변경 확인

- **판정: 기준선 성립.** ΔV1 설계 `a2e8464`가 구현 첫 커밋 `291b721` 앞의 단독 커밋이다(`git log`).
- 구현 커밋의 plan 변경: `[구현자 기입]` 이하만 — 규범부(첫 줄~`> **[구현자 기입]**`, 774행) `a2e8464`↔`4d308eb` `diff` 0줄.
- Decision 변경(ΔV1): D-001 SUPERSEDED→D-017, D-016 신설 — 사용자 원문 인용이 있고(§3 D-016·D-017) 구현과 분리 커밋이다.
- ΔV1 작성자가 구현자(Codex, `Agent: codex`·`Status: designed`)다 — D-017 "계획 검토·보완" 위임 범위로 본다.
- AC 변경: AC21에서 이벤트 상한만 제외(D-016) · 나머지는 강화(VP-02 busy/lock, VP-15 probe 경계, VP-19 신설).
- D-016 근거 재확인: 상한 변이 M018(`map.ts` FIFO 축출)이 `map.replay.test.ts`에서 red — 상한이 중복 출력을 만든다는 ΔV1 실측과 같다.
- 채점 기준: `a2e8464`의 V1+ΔV1 규범 행 원문.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 V1 `ae103f3`(`git cat-file -t` = commit) · ΔV1 증분 5행 |
| NEW/CHANGED ↔ 같은 레벨 REQUIRED | 유효 | VP-02·15·16 CHANGED REQUIRED · SD-01/VP-19 NEW REQUIRED |
| INHERITED ↔ REGRESSION | 유효 | R-01/VP-01 REGRESSION |
| §10 자리 목록(검색 재실행 차집합) | 유효 | §10·ΔV1 기록 검색 전부(보조 검색 포함 47줄, [`ep-search.sh`](verify-evidence/ep-search.sh))를 구현 전 트리에서 재실행 — 설계 시점 N과 전부 같음 |
| 술어·범위 | 유효 | VP-18 #1-3 술어가 선언 이름(`function canonical(ize)?\(`)이지만 pair path 3파일 안 차집합 0. 경로 밖 사본은 N1 |
| 선택 적대 증거 | 유효 | 0건 스윕·SSOT·맞바꿈 pair에 등록, VP-03·05·14 직접 oracle |
| `SUPERSEDED` pair 이관 | 해당 없음 | ΔV1은 CHANGED·NEW만 |
| 운영 gate | 유효 | typecheck·eslint·vitest 차집합·scripts·doc-inventory·CI·trailer |

- root PLAN_GAP: 없음. 아래 결함은 모두 명시된 Decision·§10 자리 안에서 구현자가 고칠 수 있다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path · 판정 |
|---|---|---|
| D-003 관측 동작 보존 | 화면·대화 흐름 불변 | **위반 2건** — D1 OpenCode 서버 재시작 누락, D2 스트리밍 중 사용자 스크롤 되돌림 |
| D-005 고아 IPC 2채널 삭제 | 채널·사슬 0, `native-resources` 불변 | ✅ 검색 74→0·문서 3→0, session-resources 4파일 green |
| D-006 격리 이관 삭제 | 404 → `missing` | ✅ legacy 파일 9→0, `native-history.test.ts` green |
| D-007 push 갱신 | 주기 0, push·focus | ✅ hook 경로 · ⚠️ Claude 감시 파일 2항 미잠금(D3) |
| D-008·D-015 배포 확장점 유지 | 지우지 않음 | ✅ `app/deployment`·`features/plugins` diff 0, `runtime-listing.ts` 두 함수 존재 |
| D-012 spawn 경계 동기 유지 | spawn 판 동기 | ✅ `plugin-catalog.ts` 동기 fs 5줄 = spawn 판 |
| D-016 이벤트 상한 제외 | 중복 방지 유지 | ✅ M018 red |

```text
외부 설정 변경 → FingerprintWatch(지문) → bootstrap changed → broadcastExtensionsChanged
  → preload subscribe → sessionApi.onExtensionsChanged → useNativeMcpCatalog.refreshBackend → globalExtensions
OpenCode 연결: configuredOpenCodeResources(load) → servers.acquire(spawn) → contexts.acquire → openCodeDiscovery.hold
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 감시 기준선이 소비자가 읽은 내용보다 새로울 수 있는가 | **결함 D1** | `discovery-cache.ts:214` `watch()`가 hold 시점의 stat을 기준선으로 잡는다(`fingerprint-watch.ts:50`) |
| 프레임 지연이 다른 프레임 작업과 순서를 바꾸는가 | **결함 D2** | `ScrollController.tsx:92` capture를 rAF로 미루어 `:164` resize 복원 프레임이 옛 앵커로 먼저 돈다 |
| false success | 없음 | push 구독 부재 시 `?.` 반환은 형제 구독(`onOpenCodePluginsChanged`)과 같은 관례, focus 재조회 유지 |
| partial failure/rollback | 유지 | DB upsert·DELETE는 한 transaction(`native-history-queries.ts` `replace`), rollback 케이스 green(Node ABI) |
| 다른 B 구현 | 없음 | `+` 메뉴 플러그인 순서: `pluginItems`가 Orca 그룹만 담은 뒤 native push — 결과 순서 동일 |
| 최적화가 잃은 재검증 | **D1** | 1s 내용 probe가 load 시점 서명과 비교하던 재검증을 잃었다 |
| worst-case 상한 | 유지 | 이벤트 id 집합 상한 없음(D-016), probe 캐시 4096 상한 유지(`discovery-cache.ts:60`) |

### D1 — OpenCode discovery hold가 load 뒤·hold 전 변경을 통보하지 않는다

- 재현: [`repro/discovery-cache.hold-race.verify.test.ts`](verify-evidence/repro/discovery-cache.hold-race.verify.test.ts) V1 — `run()` → 파일 변경 → `hold()` → 4초 동안 `changed` 0회(새 코드), 구 `a2e8464` 코드는 통과.
- 대조: 같은 파일 V2(hold 뒤 변경)는 새 코드에서도 통과한다 — 기준선 시점만의 문제다.
- production 구간: `adapter.ts:122` 설정 load → `:149` `servers.acquire`(필요 시 spawn+health) → `:177` `contexts.acquire` → `session-context.ts:508` hold. 이 구간의 `opencode.json` 편집은 서버 retire를 일으키지 않는다.
- 같은 구조의 인접 자리: `project-resource-sync.ts:163` 새 감시도 기준선을 비동기로 잡은 뒤 `refresh()`가 읽는다 — 이번 라운드에 재현하지 않았다. 불변식을 올려 함께 본다.

### D2 — 스트리밍 중 사용자 스크롤이 대기 중인 복원 프레임에 되돌려진다

- 재현: [`repro/ScrollController.restore-race.verify.test.ts`](verify-evidence/repro/ScrollController.restore-race.verify.test.ts) — `resize()`(복원 프레임 예약) 뒤 사용자 스크롤 240 → 프레임 후 `expected 200 to be 240`(새 코드), 구 코드 240 유지.
- 원인: 복원 rAF(먼저 예약)가 capture rAF보다 먼저 돌아 스크롤 전 앵커로 `writeTop`한다. 구 코드는 onScroll에서 동기 capture였다.
- 브라우저 순서: scroll 이벤트(렌더링 단계 scroll steps) → rAF 콜백 → layout → ResizeObserver — 직전 프레임에 내용이 자라면 같은 순서가 매 프레임 생긴다.

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh a2e8464..4d308eb` — 대상 126파일.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export(1a 13건) | 정상 | 기준선부터 같은 범주 — `dead-exports.cjs` 전후 대조 신규 dead·test-only 0 |
| 테스트 전용 참조(2절) | 정상 | 범주 변화 5건 모두 `test+local`(파일 내부 사용+테스트): `claudePluginProjectRoot`·`NativeMessages`·`nativeHistoryBusy`·`backgroundJournalKey`·`useBubbleExpansionStore` |
| 형제 정책 비대칭(3절) | 없음 | 스크립트 출력 `(없음)` |
| 동일 규칙 중복 | drift 2곳 → N1 | `claude/project-settings.ts:125` `canonical`, `claude/background.ts:20` `stable`(undefined 처리 다름) — VP-18 path 밖 |
| 동일 규칙 중복(동기/비동기) | drift → D5 | `plugin-catalog.ts:319` 비동기 판이 `claudeLocalSettingsRoot` 분기를 다시 적었다 |
| 신규 등록값의 기존 소비처 | 무영향 | `orca:extensions:changed` 소비 = preload·renderer api·hook 1벌 |

## 4. 기존 테스트 / semantic 검증 확인

- plan·구현 보고가 인용한 테스트 파일·케이스 실재: 확인 — 전체 실행 JSON에 해당 파일 전부 포함(891파일).
- **등록 적대 증거 재측정**: 구현 목록 86건 독립 재실행 — 그대로 적용 81건 잡음, 다중 일치로 미적용 5건은 같은 의미(전체/n번째 치환)로 재지정 6건 전부 잡음.
- **자리 미지정 등록 변이**: VP-16 "자리별 반복 복원"을 EP-16 #2 CRUD 4자리마다 심음 — setEnabled만 잡음, author·upload·remove 못 잡음(D4).
- **검증자 축**(구현 보고 밖): 20건 — 형제 계약 맞바꿈(Y01), 감시 파일 목록 항(Y03~Y05), 조립 분기·운반 항(Y07~Y17) 등. 잡음 14 · 못 잡음 6.
- **회귀 재현**: 변이가 아니라 구/신 코드 대조 적대 테스트 2건(F1=D1, F2=D2) — 둘 다 새 코드에서 red, 구 코드에서 green.
- 이전 라운드 대조: 해당 없음(최초 verify).
- 형제 슬롯: VP-12·13 claude↔opencode 맞바꿈·뒤집기 42건(구현 목록 39 + 재지정 3) 전부 잡음, 감시 두 방송(revision↔공용) 구분 Y01 잡음.
- 소거 변이 잔여물: 제거 변이는 typecheck 없이 vitest만 판정했다 — 잔여물 진단이 red 근거가 된 행 없음(전부 assertion 실패).

**고장 이력** — 시도 전부. `범위` = 실행한 테스트 파일 수, `이번 결과` = assertion 실패 케이스/실행 케이스. 정의·전체 실패명은 [`verify-mutations.json`](verify-evidence/verify-mutations.json)·[`mutation-rerun.json`](verify-evidence/mutation-rerun.json), 구현 목록 정의는 [`scan/mutation-evidence.json`](scan/mutation-evidence.json).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 결과 | 이번 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M001 VP02-interval | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:92` | 호출 대체 | `window.addEventListener('focus', focus) → setInterval(() => void refresh(), ` | 1파일 | 신규 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 등록(구현 목록) |
| M002 VP02-subscribe | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:87` | 제거 | `void refreshBackend(backend) → void backend` | 1파일 | 신규 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 등록(구현 목록) |
| M003 VP07-comparison | `main/infra/config/fingerprint-watch.ts:81` | 제거 | `this.closed \|\| next === this.fingerprint → this.closed` | 2파일 | 신규 | 잡음 1/4 | fingerprint-watch.test.ts — serializes checks, notifies once for a c | VP-07 등록(구현 목록) |
| M004 VP09-BOM | `main/infra/config/json-file.ts:15` | 제거 | `text.replace(/^\uFEFF/, '') → text` | 6파일 | 신규 | 잡음 5/31 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록(구현 목록) |
| M005 VP09-missing-async | `main/infra/config/json-file.ts:40` | 고정값 | `text = await readFile(path, 'utf8')⏎  } catch  → text = await readFile(path, 'utf8'` | 6파일 | 신규 | 잡음 13/31 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록(구현 목록) |
| M006 VP09-git | `main/adapters/common/git-root.ts:7` | 고정값 | `yield current → yield current⏎    return` | 4파일 | 신규 | 잡음 4/20 | native-config-boundaries.test.ts — finds the Git root through the Claude pr | VP-09 등록(구현 목록) |
| M007 VP10-membership | `main/adapters/opencode/v1/adapter.ts:203` | 뒤집기 | `return active(item.managedSource, current) → return !active(item.managedSource,` | 1파일 | 신규 | 잡음 2/26 | adapter.test.ts — projects disabled global MCP overrides a | VP-10 등록(구현 목록) |
| M008 VP10-choices | `main/adapters/opencode/v1/adapter.ts:174` | 뒤집기 | `[id, active(identity, current)] → [id, !active(identity, current)]` | 1파일 | 신규 | 잡음 2/26 | adapter.test.ts — projects disabled global MCP overrides a | VP-10 등록(구현 목록) |
| M009 VP11-double-config | `main/adapters/opencode/v1/channel.ts:492` | 제거 | `openCodeNativePlugins(client, req.cwd, env, si → openCodeNativePlugins(client, req.` | 1파일 | 신규 | 잡음 1/1 | channel.native-resources.test.ts — shares one configuration read between pl | VP-11 등록(구현 목록) |
| M010 VP11-serial | `main/adapters/opencode/v1/native-resources.ts:27` | 뒤집기 | `client.app.skills({ directory }, options), → await client.app.skills({ director` | 1파일 | 신규 | 잡음 1/6 | native-resources.test.ts — OpenCode native resources > starts skill | VP-11 등록(구현 목록) |
| M011 VP15-client-first | `main/adapters/opencode/v1/native-history.ts:185` | 뒤집기 | `let probeFailed = false → await deps.client(request)⏎    let` | 1파일 | 신규 | 잡음 4/35 | native-history.test.ts — skips SDK messages only when the committ | VP-15 등록(구현 목록) |
| M012 VP16-targets | `main/app/project-resource-sync.ts:174` | 제거 | `void this.apply(entry, runtimeTargets) → void this.apply(entry)` | 1파일 | 신규 | 잡음 1/17 | project-resource-sync.test.ts — captures runtime targets once per stable | VP-16 등록(구현 목록) |
| M013 VP16-list | `main/app/handlers/skills.ts:46` | 호출 대체 | `listing ?? refresh() → refresh()` | 1파일 | 신규 | 잡음 1/12 | skills.test.ts — catalog skill target IPC > joins concurr | VP-16 등록(구현 목록) |
| M014 VP16-parse | `main/adapters/claude/project-settings.ts:18` | 고정값 | `if (cached?.fingerprint === fingerprint) retur → if (false) return cached!.value` | 1파일 | 신규 | 잡음 1/5 | project-settings.test.ts — parses shared native state once per file | VP-16 등록(구현 목록) |
| M015 VP16-candidate | `main/adapters/claude/native-history.ts:167` | 다른 값 | `offset (\+=\|\+) 16 → offset $1 1` | 1파일 | 신규 | 잡음 1/16 | native-history.test.ts — Claude native history reads > bounds con | VP-16 등록(구현 목록) |
| M016 VP16-hash | `main/adapters/claude/native-history.ts:100` | 호출 대체 | `prefixRevision = hash.copy().digest('hex') → prefixRevision = createHash('sha25` | 1파일 | 신규 | 잡음 1/16 | native-history.test.ts — commits UTF-8 byte checkpoints, reuses c | VP-16 등록(구현 목록) |
| M017 VP16-skill-path | `main/app/skill-catalog.ts:66` | 호출 대체 | `path: await realpath(skill.skillPath).catch(() → path: await realpath(skill.skillPa` | 1파일 | 신규 | 잡음 1/1 | skill-catalog.test.ts — assembles the real catalog from lock, ha | VP-16 등록(구현 목록) |
| M018 VP16-event-cap | `main/adapters/opencode/v1/map.ts:94` | 다른 값 | `if (event.id) this.seenEvents.add(event.id) → if (event.id) this.seenEvents.add(` | 1파일 | 신규 | 잡음 1/1 | map.replay.test.ts — ignores an old text delta replay after m | VP-16 등록(구현 목록) |
| M019 VP16-roots | `main/adapters/opencode/v1/native-resources.ts:62` | 호출 대체 | `skillRoots ??= openCodeSkillRoots(directory, e → skillRoots = openCodeSkillRoots(di` | 1파일 | 신규 | 잡음 1/6 | native-resources.test.ts — OpenCode native resources > classifies o | VP-16 등록(구현 목록) |
| M020 VP16-SSE | `main/adapters/opencode/v1/session-context.ts:383` | 호출 대체 | `subscriber.directory !== directory → nativePathKey(subscriber.directory` | 1파일 | 신규 | 잡음 1/15 | session-context.test.ts — OpenCode server context with the install | VP-16 등록(구현 목록) |
| M021 VP16-peek | `main/features/extensions/common/mcp/managed-source.ts:77` | 다른 값 | `peek: () => current → peek: () => ({ ...current, users: ` | 1파일 | 신규 | 잡음 1/2 | managed-source.test.ts — peeks at membership without cloning and  | VP-16 등록(구현 목록) |
| M022 VP17-memo | `renderer/src/features/chat/harnesses/opencode/rightpanel/tiles.tsx:28` | 빈 값 | `let model = inputs.get(backgroundKey) → let model = undefined as ReturnTyp` | 1파일 | 신규 | 잡음 1/1 | tiles.memo.test.ts — shares one projection across four compon | VP-17 등록(구현 목록) |
| M023 VP18-canonical-harness-config | `main/adapters/common/harness-config.ts:72` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 신규 | 잡음 7/54 | harness-config.test.ts — env 우선순위 (AC15) > options.env 를 만들지 않는 턴 | VP-18 등록(구현 목록) |
| M024 VP18-canonical-background-task-queries | `main/infra/db/background-task-queries.ts:13` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 신규 | 잡음 1/1 | background-journal-key.test.ts — preserves persisted journal keys across  | VP-18 등록(구현 목록) |
| M025 VP18-canonical-composer-catalog | `main/app/composer-catalog.ts:46` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 신규 | 잡음 7/8 | composer-catalog.test.ts — shares preparation identity for reordere | VP-18 등록(구현 목록) |
| M026 VP18-variant-settings | `main/adapters/opencode/v1/settings.ts:84` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 신규 | 잡음 2/5 | settings.test.ts — OpenCode native model catalogs > uses na | VP-18 등록(구현 목록) |
| M027 VP18-variant-model-listing | `main/adapters/opencode/v1/model-listing.ts:29` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 신규 | 잡음 1/6 | model-listing.test.ts — parseOpenCodeModelListing (0291 MD-02) > | VP-18 등록(구현 목록) |
| M028 VP18-variant-composer-catalog | `main/adapters/opencode/v1/composer-catalog.ts:42` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 신규 | 잡음 1/2 | composer-catalog.test.ts — reads plugin-resolved primary agents and | VP-18 등록(구현 목록) |
| M029 VP18-version | `main/adapters/opencode/v1/server.ts:165` | 다른 값 | `['--version'] → ['-v']` | 1파일 | 신규 | 잡음 1/1 | server.cli.test.ts — probes the installed version through the | VP-18 등록(구현 목록) |
| M030 VP18-db-path | `main/adapters/opencode/v1/server.ts:425` | 다른 값 | `['db', 'path'] → ['db', 'wrong']` | 1파일 | 신규 | 잡음 1/1 | server.database-path.test.ts — OpenCode native database path (0262 EP56 | VP-18 등록(구현 목록) |
| M031 VP18-auth-plugin | `main/features/auth/runtime.ts:268` | 맞바꿈 | `snapshot: () => loginFreeSnapshot(authId) → snapshot: () => (connections.has(a` | 1파일 | 신규 | 잡음 6/26 | login-free.test.ts — 로그인 프리 런타임 — lifecycle 분리 (0248 AC4·AC8· | VP-18 등록(구현 목록) |
| M032 VP18-auth-runtime | `main/features/auth/runtime.ts:317` | 맞바꿈 | `return loginFreeSnapshot(authId) → return (connections.has(authId) ? ` | 1파일 | 신규 | 잡음 2/26 | login-free.test.ts — 로그인 프리 호스트 연결 — 런타임 경유 (0291) > snapshot | VP-18 등록(구현 목록) |
| M033 VP18-connection-list | `main/app/connection-views.ts:86` | 다른 값 | `providerConnectionInfo(snapshot.connection) → ({ ...providerConnectionInfo(snaps` | 1파일 | 신규 | 잡음 1/12 | connection-views.test.ts — host connection (0291) > carries connect | VP-18 등록(구현 목록) |
| M034 VP18-connection-handler | `main/app/handlers/providers.ts:83` | 다른 값 | `return providerConnectionInfo(status) → return { ...providerConnectionInfo` | 1파일 | 신규 | 잡음 1/4 | providers.test.ts — registerConnectionHandlers > connect는 최종 | VP-18 등록(구현 목록) |
| M035 VP18-skill-order | `renderer/src/features/chat/lib/attachMenuModel.ts:100` | 뒤집기 | `skillGroups.unshift(next) → skillGroups.push(next)` | 1파일 | 신규 | 잡음 1/20 | attachMenuModel.test.ts — buildAttachMenu > merges groups that sha | VP-18 등록(구현 목록) |
| M036 VP19-bootstrap-opencode | `main/app/bootstrap.ts:1257` | 빈 값 | `broadcastExtensionsChanged({ backend: 'opencod → undefined` | 1파일 | 신규 | 잡음 1/18 | bootstrap.native-history.test.ts — broadcasts each OpenCode plugin revision | VP-19 등록(구현 목록) |
| M037 VP19-bootstrap-claude | `main/app/bootstrap.ts:1275` | 빈 값 | `broadcastExtensionsChanged({ backend: 'claude' → undefined` | 1파일 | 신규 | 잡음 1/18 | bootstrap.native-history.test.ts — broadcasts Claude global changes only on | VP-19 등록(구현 목록) |
| M038 VP19-preload | `preload/index.ts:281` | 빈 값 | `subscribe(CHANNELS.extensionsChanged, handler) → (() => undefined)` | 1파일 | 신규 | 잡음 1/29 | index.test.ts — forwards backend extension changes throu | VP-19 등록(구현 목록) |
| M039 VP19-api | `renderer/src/shared/api/ipc.ts:238` | 빈 값 | `globalThis.window?.orca?.session?.onExtensions → undefined` | 1파일 | 신규 | 잡음 1/29 | index.test.ts — forwards backend extension changes throu | VP-19 등록(구현 목록) |
| M040 VP15-whole-delete | `main/infra/db/native-history-queries.ts:88` | 고정값 | `AND native_id NOT IN (SELECT value FROM json_e → AND length(?) >= 0` | 1파일 | 신규 | 잡음 1/15 | native-history.db.test.ts — native history with the migrated SQLite  | VP-15 등록(구현 목록) |
| M041 VP16-identity | `main/adapters/opencode/v1/server-profile.ts:51` | 호출 대체 | `profileComponents(executableIdentity, cwd, env → profileComponents(openCodeExecutab` | 1파일 | 신규 | 잡음 1/1 | server-profile.test.ts — computes executable identity once and de | VP-16 등록(구현 목록) |
| M042 VP16-defaults | `main/adapters/claude/plugin-catalog.ts:23` | 호출 대체 | `const defaults = pluginDefaults(readObject(joi → readClaudePluginCatalog(process.cw` | 1파일 | 신규 | 잡음 1/6 | plugin-catalog.test.ts — native plugin catalog > reads defaults f | VP-16 등록(구현 목록) |
| M043 VP12-mark | `renderer/src/shared/ui/HarnessLogo.tsx:16` | 뒤집기 | `backend === 'claude' ? ( → backend !== 'claude' ? (` | 1파일 | 신규 | 잡음 2/2 | HarnessLogo.render.test.ts — preserves claude artwork and default or  | VP-12 등록(구현 목록) |
| M044 VP12-color | `renderer/src/shared/ui/HarnessLogo.tsx:14` | 맞바꿈 | `backend === 'claude' ? 'text-spinner' : 'text- → backend === 'claude' ? 'text-oc-in` | 1파일 | 신규 | 잡음 2/2 | HarnessLogo.render.test.ts — preserves claude artwork and default or  | VP-12 등록(구현 목록) |
| M045 VP12-engine | `renderer/src/features/engine/common/components/EngineCard.tsx:30` | 맞바꿈 | `backend={agent.adapter} → backend={agent.adapter === 'claude` | 1파일 | 신규 | 잡음 2/3 | EngineCard.render.test.ts — preserves the claude card label and edit | VP-12 등록(구현 목록) |
| M046 VP12-engine-menu | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:101` | 맞바꿈 | `backend={engine} → backend={engine === 'claude' ? 'op` | 1파일 | 신규 | 잡음 1/1 | AgentEnvironmentView.interaction.test.ts — selects Claude or OpenCode before openin | VP-12 등록(구현 목록) |
| M047 VP12-source-claude | `renderer/src/features/skills/components/customize/SourceHeading.tsx:20` | 맞바꿈 | `backend="claude" → backend="opencode"` | 1파일 | 신규 | 잡음 1/2 | SourceHeading.render.test.ts — preserves the native:claude source mark  | VP-12 등록(구현 목록) |
| M048 VP12-source-opencode | `renderer/src/features/skills/components/customize/SourceHeading.tsx:22` | 맞바꿈 | `backend="opencode" → backend="claude"` | 1파일 | 신규 | 잡음 1/2 | SourceHeading.render.test.ts — preserves the native:opencode source mar | VP-12 등록(구현 목록) |
| M049 VP12-agent-toggle | `renderer/src/features/chat/components/AgentModeToggle.tsx:57` | 맞바꿈 | `backend="claude" → backend="opencode"` | 1파일 | 신규 | 잡음 2/5 | AgentModeToggle.test.ts — actual draft mode toggle > places the wo | VP-12 등록(구현 목록) |
| M050 VP12-model-menu | `renderer/src/features/chat/components/composer/ModelMenu.tsx:46` | 맞바꿈 | `backend={agent.adapter} → backend={agent.adapter === 'claude` | 1파일 | 신규 | 잡음 2/9 | modelMenu0215.render.test.ts — preserves the claude provider heading br | VP-12 등록(구현 목록) |
| M051 VP12-composer-icon | `renderer/src/features/chat/harnesses/registries/composer.ts:20` | 맞바꿈 | `backend: sourceBackend → backend: sourceBackend === 'claude` | 1파일 | 신규 | 잡음 2/3 | brand-surfaces.test.ts — carries each source brand through the cl | VP-12 등록(구현 목록) |
| M052 VP12-sidebar | `renderer/src/app/SidebarUserButton.tsx:137` | 맞바꿈 | `backend={backend} → backend={backend === 'claude' ? 'o` | 1파일 | 신규 | 잡음 1/1 | SidebarUserButton.brand.test.ts — passes each settings brand with the orig | VP-12 등록(구현 목록) |
| M053 VP13-claude-variant | `renderer/src/features/chat/harnesses/claude/surfaces.ts:11` | 맞바꿈 | `variant: 'outlined' → variant: 'flat'` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M054 VP13-claude-chipVariant | `renderer/src/features/chat/harnesses/claude/surfaces.ts:12` | 맞바꿈 | `chipVariant: 'segment' → chipVariant: 'flat'` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M055 VP13-claude-showChevron | `renderer/src/features/chat/harnesses/claude/surfaces.ts:13` | 맞바꿈 | `showChevron: false → showChevron: true` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M056 VP13-claude-trailingDivider | `renderer/src/features/chat/harnesses/claude/surfaces.ts:14` | 맞바꿈 | `trailingDivider: true → trailingDivider: false` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M057 VP13-claude-contextRow | `renderer/src/features/chat/harnesses/claude/surfaces.ts:15` | 맞바꿈 | `contextRow: landingFrame.contextRow → contextRow: ''` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M058 VP13-claude-chipGroup | `renderer/src/features/chat/harnesses/claude/surfaces.ts:16` | 맞바꿈 | `chipGroup: chipGroupSurface → chipGroup: 'inline-flex h-7 max-w-` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M059 VP13-claude-landing | `renderer/src/features/chat/harnesses/claude/landing/presentation.ts:6` | 맞바꿈 | `contextLayout: 'inline' → contextLayout: 'below'` | 1파일 | 신규 | 잡음 1/3 | brand-surfaces.test.ts — keeps the context location in the landin | VP-13 등록(구현 목록) |
| M060 VP13-opencode-variant | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:9` | 맞바꿈 | `variant: 'flat' → variant: 'outlined'` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M061 VP13-opencode-chipVariant | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:10` | 맞바꿈 | `chipVariant: 'flat' → chipVariant: 'segment'` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M062 VP13-opencode-showChevron | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:11` | 맞바꿈 | `showChevron: true → showChevron: false` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M063 VP13-opencode-trailingDivider | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:12` | 맞바꿈 | `trailingDivider: false → trailingDivider: true` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M064 VP13-opencode-contextRow | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:13` | 다른 값 | `contextRow: '' → contextRow: 'gap-g3'` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M065 VP13-opencode-chipGroup | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:14` | 다른 값 | `chipGroup: 'inline-flex h-7 max-w-full items-c → chipGroup: 'border'` | 1파일 | 신규 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M066 VP13-opencode-landing | `renderer/src/features/chat/harnesses/opencode/landing/presentation.ts:6` | 맞바꿈 | `contextLayout: 'below' → contextLayout: 'inline'` | 1파일 | 신규 | 잡음 1/3 | brand-surfaces.test.ts — keeps the context location in the landin | VP-13 등록(구현 목록) |
| M067 VP13-seed-kind | `renderer/src/features/chat/store/chatStore.ts:200` | 뒤집기 | `supportsAgentKind(landingBackend, entry.sessio → !supportsAgentKind(landingBackend,` | 1파일 | 신규 | 잡음 2/12 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M068 VP13-fresh-kind | `renderer/src/features/chat/store/chatStore.ts:255` | 뒤집기 | `!supportsAgentKind(landingBackend, landingAgen → supportsAgentKind(landingBackend, ` | 1파일 | 신규 | 잡음 2/12 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M069 VP13-handoff | `renderer/src/features/chat/store/chatStore.ts:1566` | 제거 | `sessionBusy\(src\) \\|\\|\s*src\.loadingSession  → sessionBusy(src) \|\| src.loadingSes` | 2파일 | 신규 | 잡음 4/70 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M070 VP13-open-subagent | `renderer/src/features/chat/store/chatStore.ts:2108` | 맞바꿈 | `.subagentTile === 'task' → .subagentTile === 'subagent'` | 2파일 | 신규 | 잡음 1/9 | chatStore.panelTiles.test.ts — OpenCode independent panel state > keeps | VP-13 등록(구현 목록) |
| M071 VP13-reducer-subagent | `renderer/src/features/chat/reducer/chatReducer.ts:1996` | 맞바꿈 | `HARNESS_CAPABILITIES[state.backend ?? 'claude' → HARNESS_CAPABILITIES[state.backend` | 2파일 | 신규 | 잡음 1/40 | chatReducer.harness.test.ts — harness identity and panel enforcement > | VP-13 등록(구현 목록) |
| M072 VP13-permissions | `renderer/src/features/chat/reducer/chatReducer.ts:1653` | 뒤집기 | `HARNESS_CAPABILITIES[backend].permissionModes → !HARNESS_CAPABILITIES[backend].per` | 2파일 | 신규 | 잡음 2/37 | chatReducer.harness.test.ts — harness identity and panel enforcement > | VP-13 등록(구현 목록) |
| M073 VP13-composer-frame | `renderer/src/features/chat/components/Composer.tsx:234` | 뒤집기 | `contextLayout === 'below' && contextBelow ? la → contextLayout !== 'below' && conte` | 1파일 | 신규 | 잡음 1/5 | NewChatLandingPage.harness.test.ts — shares the landing frame and hero slot a | VP-13 등록(구현 목록) |
| M074 VP13-composer-inline | `renderer/src/features/chat/components/Composer.tsx:255` | 뒤집기 | `showLandingCwdPanel && !(contextLayout === 'be → showLandingCwdPanel && (contextLay` | 1파일 | 신규 | 잡음 1/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M075 VP13-composer-below | `renderer/src/features/chat/components/Composer.tsx:407` | 뒤집기 | `showLandingCwdPanel && contextLayout === 'belo → showLandingCwdPanel && contextLayo` | 1파일 | 신규 | 잡음 3/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M076 VP13-landing-forward | `renderer/src/features/chat/components/Landing.tsx:27` | 다른 값 | `{...presentation.composer} → {...presentation.composer} context` | 1파일 | 신규 | 잡음 2/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M077 VP12-label-copy | `renderer/src/features/chat/components/ChatTitleBar.tsx:115` | 맞바꿈 | `HARNESS_CAPABILITIES[conversationBackend ?? 'c → HARNESS_CAPABILITIES[conversationB` | 1파일 | 신규 | 잡음 2/3 | ChatTitleBar.copy.test.ts — copies the claude conversation with its  | VP-12 등록(구현 목록) |
| M078 VP12-label-engine | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:102` | 맞바꿈 | `HARNESS_CAPABILITIES[engine].shortLabel → HARNESS_CAPABILITIES[engine === 'c` | 1파일 | 신규 | 잡음 1/1 | AgentEnvironmentView.interaction.test.ts — selects Claude or OpenCode before openin | VP-12 등록(구현 목록) |
| M079 VP12-label-source | `shared/extension-sources.ts:6` | 맞바꿈 | `HARNESS_CAPABILITIES[backend].shortLabel → HARNESS_CAPABILITIES[backend === '` | 2파일 | 신규 | 잡음 5/25 | attachMenuModel.test.ts — buildAttachMenu > merges groups that sha | VP-12 등록(구현 목록) |
| M080 VP12-plan-hint-claude | `renderer/src/features/chat/harnesses/claude/rightpanel/tileRegistry.ts:15` | 맞바꿈 | `selectHintKey: harnessCatalog('claude') → selectHintKey: harnessCatalog('ope` | 1파일 | 신규 | 잡음 2/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록(구현 목록) |
| M081 VP12-plan-hint-opencode | `renderer/src/features/chat/harnesses/opencode/rightpanel/tileRegistry.ts:20` | 맞바꿈 | `selectHintKey: harnessCatalog('opencode') → selectHintKey: harnessCatalog('cla` | 1파일 | 신규 | 잡음 2/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록(구현 목록) |
| M082 R-VP09-missing-sync-all | `main/infra/config/json-file.ts:28` | 고정값 | `if ((error as NodeJS.ErrnoException).code ===  → if (false) return {}` | 6파일 | 신규 | 잡음 20/31 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록 재지정 |
| M083 R-VP09-missing-sync-only | `main/infra/config/json-file.ts:28` | 고정값 | `if ((error as NodeJS.ErrnoException).code ===  → if (false) return {}` | 6파일 | 신규 | 잡음 10/31 | native-config-boundaries.test.ts — carries BOM JSON through synchronous and | VP-09 등록 재지정 |
| M084 R-VP18-plugin-order-native | `renderer/src/features/chat/lib/attachMenuModel.ts:182` | 뒤집기 | `pluginItems.push( → pluginItems.unshift(` | 2파일 | 신규 | 잡음 4/35 | attachMenuModel.test.ts — buildAttachMenu > puts the Orcinus orca  | VP-18 등록 재지정 |
| M085 R-VP13-fork-only | `renderer/src/features/chat/store/chatStore.ts:1513` | 뒤집기 | `!HARNESS_CAPABILITIES[src.backend ?? 'claude'] → HARNESS_CAPABILITIES[src.backend ?` | 2파일 | 신규 | 잡음 6/70 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록 재지정 |
| M086 R-VP12-plan-claude-desc | `renderer/src/features/chat/harnesses/claude/rightpanel/tileRegistry.ts:14` | 맞바꿈 | `harnessCatalog('claude') → harnessCatalog('opencode')` | 1파일 | 신규 | 잡음 1/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록 재지정 |
| M087 R-VP12-plan-opencode-desc | `renderer/src/features/chat/harnesses/opencode/rightpanel/tileRegistry.ts:19` | 맞바꿈 | `harnessCatalog('opencode') → harnessCatalog('claude')` | 1파일 | 신규 | 잡음 1/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록 재지정 |
| M088 Y01-VP07-revision-sibling | `main/app/harnesses/opencode/global-watch.ts:29` | 고정값 | `if (current !== previous) { → if (true) {` | 2파일 | 신규 | 잡음 1/21 | bootstrap.native-history.test.ts — broadcasts each OpenCode plugin revision | VP-07 재량(검증자 축) |
| M089 Y02-VP19-claude-close | `main/app/bootstrap.ts:945` | 제거 | `this.claudeGlobalWatch?.close() → ∅` | 1파일 | 신규 | 잡음 1/18 | bootstrap.native-history.test.ts — broadcasts Claude global changes only on | VP-19 재량(검증자 축) |
| M090 Y03-VP07-claude-settings-file | `main/app/bootstrap.ts:1269` | 제거 | `nativeClaude.settings, → ∅` | 1파일 | 신규 | 잡음 1/18 | bootstrap.native-history.test.ts — broadcasts Claude global changes only on | VP-07 재량(검증자 축) |
| M091 Y04-VP07-claude-installed-file | `main/app/bootstrap.ts:1270` | 제거 | `join(nativeClaude.root, 'plugins', 'installed_ → ∅` | 1파일 | 신규 | **못 잡음** 0/18 | — | VP-07 재량(검증자 축) |
| M092 Y05-VP07-claude-state-path-swap | `main/app/bootstrap.ts:1272` | 맞바꿈 | `? join(nativeClaude.root, '.claude.json')⏎     → ? join(homedir(), '.claude.json')⏎` | 1파일 | 신규 | **못 잡음** 0/18 | — | VP-07 재량(검증자 축) |
| M093 Y06-VP02-toggle-pending | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:147` | 제거 | `if (pending.current.has(backend)) void refresh → ∅` | 1파일 | 신규 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 재량(검증자 축) |
| M094 Y07-VP15-cold-recovery-bypass | `main/app/chat-turn/native-session.ts:46` | 제거 | `recovery && !recovery.accepted ? undefined : r → readNativeHistoryPrevious(db, requ` | 1파일 | 신규 | 잡음 1/12 | native-session.test.ts — native retention recovery through the mi | VP-15 재량(검증자 축) |
| M095 Y08-VP15-handler-snapshot | `main/app/handlers/session.ts:95` | 빈 값 | `sync.snapshot → undefined` | 1파일 | 신규 | 잡음 1/11 | session.load.test.ts — session load IPC refreshes native histor | VP-15 재량(검증자 축) |
| M096 Y09-VP16-skills-generation | `main/app/bootstrap.ts:296` | 제거 | `if (revision === this.skillsRevision) this.ski → this.skillsCache = skills` | 1파일 | 신규 | 잡음 1/18 | bootstrap.native-history.test.ts — keeps the newer skill scan in the cache  | VP-16 재량(검증자 축) |
| M097 Y10-VP16-author-joins-stale | `main/app/handlers/skills.ts:49` | 호출 대체 | `await writeAuthoredSkill(req)⏎    await ctx.de → await writeAuthoredSkill(req)⏎    ` | 1파일 | 신규 | **못 잡음** 0/12 | — | VP-16 재량(검증자 축) |
| M098 Y10b-VP16-upload-joins-stale | `main/app/handlers/skills.ts:57` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 신규 | **못 잡음** 0/12 | — | VP-16 재량(검증자 축) |
| M099 Y10c-VP16-setEnabled-joins-stale | `main/app/handlers/skills.ts:76` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 신규 | 잡음 1/12 | skills.test.ts — catalog skill target IPC > joins concurr | VP-16 재량(검증자 축) |
| M100 Y10d-VP16-remove-joins-stale | `main/app/handlers/skills.ts:97` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 신규 | **못 잡음** 0/12 | — | VP-16 재량(검증자 축) |
| M101 Y11-VP11-async-project-root | `main/adapters/claude/plugin-catalog.ts:321` | 호출 대체 | `projectRoot = (await gitRootLineage(cwd)).root → projectRoot = resolve(cwd)` | 3파일 | 신규 | **못 잡음** 0/14 | — | VP-11 재량(검증자 축) |
| M102 Y12-VP10-binding-project | `main/app/session-binding.ts:10` | 고정값 | `current.project_id === expected.project_id → true` | 5파일 | 신규 | 잡음 6/45 | composer-catalog.test.ts — preserves the configuration failure stag | VP-10 재량(검증자 축) |
| M103 Y13-VP04-serialize | `main/app/project-resource-sync.ts:71` | 제거 | `(this.mutations.get(key) ?? Promise.resolve()) → Promise.resolve()` | 1파일 | 신규 | 잡음 7/17 | project-resource-sync.test.ts — holds watcher broadcasts behind an in-fl | VP-04 재량(검증자 축) |
| M104 Y14-VP10-dispose-report | `main/adapters/opencode/v1/adapter.ts:223` | 제거 | `releasing ??= lease.release().catch(reportDisp → releasing ??= lease.release().catc` | 2파일 | 신규 | 잡음 2/52 | adapter.persistent.test.ts — exposes native resources from the live c | VP-10 재량(검증자 축) |
| M105 Y15-VP17-reduced-motion | `renderer/src/shared/hooks/useReducedMotion.ts:12` | 뒤집기 | `setReduced(query.matches) → setReduced(!query.matches)` | 1파일 | 신규 | 잡음 1/1 | useReducedMotion.test.ts — reads the motion preference, follows cha | VP-17 재량(검증자 축) |
| M106 Y16-VP14-row-remove | `renderer/src/features/engine/harnesses/opencode/ProviderForm.tsx:101` | 고정값 | `disabled={rows.length <= 1} → disabled={false}` | 1파일 | 신규 | 잡음 1/10 | ProviderForm.interaction.test.ts — OpenCode provider form through productio | VP-14 재량(검증자 축) |
| M107 Y17-VP09-flag-array | `main/adapters/claude/plugin-flag.ts:4` | 제거 | `value === true \|\| Array.isArray(value) \|\| isRe → value === true \|\| isRecord(value)` | 3파일 | 신규 | 잡음 3/25 | project-reconciliation.test.ts — shows external selection with actual sta | VP-09 재량(검증자 축) |
| S1 VP06-ownership | `main/app/harnesses/common/contracts.ts:43` | 다른 값 | 공통 모듈에 `../opencode/warmup` import 추가 | eslint 1파일 | 신규 | 잡음 1 error | `harness/ownership` | VP-06 등록 |
| S2 VP08-dead | `renderer/src/features/chat/lib/parts.ts` 끝 | 다른 값 | 삭제한 `partsStructured` export 복원 | 스캐너 | 신규 | 잡음 dead 33→34 | `scan/dead-exports.cjs` | VP-08 등록 |
| S3 VP04-sweep | `renderer/src/shared/api/ipc.ts` 끝 | 다른 값 | `openNativePlugin` 토큰 복원 | rg | 신규 | 잡음 0→1 | VP-04 자리 검색 | VP-04 등록 |
| F1 D1-hold-race | `main/adapters/opencode/v1/discovery-cache.ts:214` | 회귀 재현 | load 뒤·hold 전 파일 변경 | 1파일 | 신규 | **못 잡음** — 기존 스위트 green, 재현 테스트 red | 재현 V1(구 코드 green) | VP-07 #4 |
| F2 D2-scroll-race | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:92` | 회귀 재현 | 복원 프레임 대기 중 사용자 스크롤 | 1파일 | 신규 | **못 잡음** — 기존 스위트 green, 재현 테스트 red | 재현 테스트(구 코드 green) | VP-14 #3 |

- 검산: 시도 112 = 변이 107 + 정적 3 + 회귀 재현 2 · 잡음 104(변이 101 + 정적 3) · 못 잡음 8(변이 6 + 회귀 2) · 동치 0. 구현 목록 미적용 5건은 재지정 6건으로 대체해 시도 수에서 뺐다.
- `N회` 관측 주체: 호출 수 단언은 fake client·spy(`config.get`·`readSkillCatalog`·`realpath`·`structuredClone`) — M009·M013·M017·M021 red.
- 순서 관측: VP-04 직렬화는 deferred 2개(Y13 red 7), VP-11 병렬은 두 deferred 동시 pending(M010 red).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | PASS | 심볼 검색 44→8(하네스 동명 8줄, EP-08 제외 규칙)·하네스 제외 34→0 · 토큰 6→0 · dead/test-only 신규 0 · i18n present 0 · S2 | 29/29 |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | PASS | M004~M006·M082·M083·Y17 red | 14/14 |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | PASS | M007·M008·Y12·Y14 red · options typecheck 0 | 11/11 |
| VP-11 | MD-04 ↔ UT-04 | REQUIRED | **PAIR_FAIL** | M009·M010 red · **Y11 못 잡음**(비Windows 비동기 프로젝트 루트) | 3/4 |
| VP-12 | MD-05 ↔ UT-05 | REQUIRED | PASS | 구현 목록 15건 + 재지정 2건 red | 15/15 |
| VP-13 | MD-06 ↔ UT-06 | REQUIRED | PASS | 구현 목록 24건 + 재지정 1건(fork) red | 29/29 |
| VP-14 | MD-07 ↔ UT-07 | REQUIRED | **PAIR_FAIL** | Y16 red · **F2 회귀**(D-003) | 2/3 |
| VP-15 | MD-08 ↔ UT-08 | REQUIRED | PASS | M011·M040·Y07·Y08 red · DB 스위트 Node ABI 26케이스 green | 6/6 |
| VP-16 | MD-09 ↔ UT-09 | REQUIRED | **PAIR_FAIL** | 구현 목록 12건·Y09 red · **CRUD 3자리 못 잡음**(M097·M098·M100) | 10/11 |
| VP-17 | MD-10 ↔ UT-10 | REQUIRED | PASS | M022·Y15 red | 4/4 |
| VP-18 | MD-11 ↔ UT-11 | REQUIRED | PASS | 구현 목록 13건 + 재지정 1건 red · journal key golden 고정 | 19/19 |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | PASS | 검색 74→0·문서 3→0 · Y13 red · S3 | 19/19 |
| VP-05 | AR-02 ↔ IT-02 | REQUIRED | PASS | 구 조립 12→0 · `composer-catalog.test.ts` 6케이스 Windows CI green(Linux 기준선 red) | 3/3 |
| VP-06 | AR-03 ↔ IT-03 | REQUIRED | PASS | 구 경로 5→0 · S1 `harness/ownership` error | 5/5 |
| VP-07 | AR-04 ↔ IT-04 | REQUIRED | **PAIR_FAIL** | M003·Y01·Y03 red · **F1 회귀**(#4) · **Y04·Y05 못 잡음**(#3 파일 목록 항) | 2/4 |
| VP-19 | SD-01 ↔ ST-01 | REQUIRED | PASS | M036~M039·Y02 red — 6 edge 좌표 | 6/6 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | PASS | M001·M002·Y06 red | 3/3 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | PASS | legacy 9→0 · 404→missing 케이스 green | 2/2 |
| VP-01 | R-01 ↔ AT-01 | REGRESSION | BLOCKED_BY:VP-07·VP-14 | gate 전부 green이지만 D1·D2가 R-01(동작 보존) 반례 | 0(집계) |

- root `PAIR_FAIL`: VP-07(D1·D3) · VP-14(D2) · VP-11(D5) · VP-16(D4).
- 종속: VP-01 → BLOCKED_BY VP-07·VP-14. VP-19는 자기 6 edge를 독립 판정했다 — Claude 외부 변경 입력 항은 VP-07 #3 root로 센다.
- 실행 범위: 최초 검증 — 유효 V의 REQUIRED/REGRESSION 19 pair 전건.
- 좌표의 실행 구간: Claude 감시 테스트(`bootstrap.native-history.test.ts:180`)는 `settings.json`만 바꿔 `check()`를 직접 부른다 — 파일 목록의 나머지 두 항은 운반 값이 바뀌지 않아 닫히지 않는다(Y04·Y05).

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ❌ | gate는 green(아래 §9)이나 D1·D2가 기존 동작을 바꿨다 |
| AC2 | ✅ | dead 44→33·test-only 52→45, 신규 `(file,name,kind)` 0 |
| AC3 | ✅ | `--absent` present 0, 미참조 56 = 64−8, 신규 0, CSS 토큰 0 |
| AC4 | ✅ | 사슬 검색 0, session-resources 4파일 green, doc-inventory OK |
| AC5 | ✅ | 직렬화 케이스 green, Y13 red |
| AC6 | ✅ | 404→missing 케이스 green, legacy 0 |
| AC7 | ✅ | VP-09 변이 6건 red |
| AC8 | ✅ | VP-10 변이 4건 red |
| AC9 | ✅ | 구 조립 0, Windows CI green |
| AC10 | ⚠️ | config 1회·병렬은 잠금, 비동기 카탈로그의 비Windows 루트 항 미잠금(D5) |
| AC11 | ✅ | push·focus·busy/lock·unmount 변이 red |
| AC12 | ❌ | discovery hold 누락(D1) · Claude 감시 파일 2항 미잠금(D3) |
| AC13 | ✅ | 구 파일 0, ownership 변이 red |
| AC14 | ✅ | 마크·색 맞바꿈 red, shim 5파일 0 |
| AC15 | ✅ | 삼항 0, 표시명 맞바꿈 red |
| AC16 | ✅ | cwd 슬롯 12변이 red |
| AC17 | ✅ | capability 7자리 변이 red |
| AC18 | ⚠️ | 측정 1회/프레임은 충족, 그 변경이 D2 회귀를 만들었다 |
| AC19 | ✅ | IPC_CONTRACT·inventory·카탈로그·arch 문서 동기, 구 모듈 언급 0 |
| AC20 | ✅ | client 0·parse 1·previous·rowid — Node ABI DB 스위트 green |
| AC21 | ⚠️ | 반복 복원 13건 red, CRUD 3자리 미잠금(D4) |
| AC22 | ✅ | memo·reduced motion 변이 red |
| AC23 | ✅ | 변이 14건(구현 목록 13 + 재지정 1) red, journal golden 테스트 green |

- 합계 재측정: ✅ 18 · ⚠️ 3 · ❌ 2 = 23. 자기보고 23/23 ✅ — 불일치.
- 사본 대조: plan 구현 보고 `23/23` ↔ trailer `4d308eb` `Criteria-Met: 23/23` ↔ INDEX 비고 `AC23/23` — 세 사본은 서로 일치.

### pair별 plan §10 강제 지점 분모

| Pair | §10 자리 목록 | 자리별 확인 · 좌표 | 목록 밖 발견 · 이력 ID | 결과 |
|---|---|---|---|---|
| VP-07 | ① global watch ② project sync ③ Claude 전역 감시 ④ discovery hold (4) | ①② M003·Y01·실파일 테스트 · ③ settings 항만 Y03 · ④ F1 red | 없음 | PAIR_FAIL(③④) |
| VP-11 | #1 config 1회 #2 병렬 #3 메뉴 비동기 #4 skill-catalog (4) | #1 M009 · #2 M010 · #3 Y11 못 잡음 · #4 `skill-catalog.test.ts` green | 없음 | PAIR_FAIL(#3) |
| VP-14 | #1 모델 행 #2 헤더 행 #3 scroll capture (3) | #1·#2 Y16 · #3 F2 회귀 | 없음 | PAIR_FAIL(#3) |
| VP-16 | #1~#11 (11) | #2 CRUD 중 setEnabled만(Y10c), author·upload·remove 못 잡음 · 나머지 10자리 구현 목록 red | 없음 | PAIR_FAIL(#2) |
| 그 밖 15 pair | §10·ΔV1 표 그대로(합 187 중 위 4 pair 22) | §5 표 좌표 | 없음 | PASS |

- 표에 없는데 같은 불변식이 필요한 지점: `project-resource-sync.ts:163` 감시 기준선(D1과 같은 형태, 미재현) — D1 불변식으로 함께 닫는다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` 3구성 `error TS` 0 |
| eslint(무수정) | PASS | 0 error · warning 2(`Timeline.tsx:49`·`useTranscriptVirtualizer.ts:22`, 범위 diff 0인 기존 파일) |
| vitest 차집합 | PASS(환경 분리) | 아래 §9 — 신규 ID는 Windows 전용 경로 5건, Windows CI green |
| scripts | PASS | `node --test scripts/*.test.mjs` 144/144 |
| migration·budget·doc-inventory | PASS | append-only OK · 16 suites OK · generated/prose/links OK |
| CI | PASS | run `41288104219`(head `00bb2a9`) 888파일 통과·3 skip, 8,278케이스 통과·3 skip |
| message-bus | PASS | 20커밋 trailer 파싱(§11) |

## 6. 외부 포트 / 문서 계약

| 계약 | 결과 | 근거 |
|---|---|---|
| IPC 2채널 삭제 + `orca:extensions:changed` 신설 | ✅ | `IPC_CONTRACT.md:194` 신규 행, 구 채널 검색 0, `inventory.md` 재생성 |
| 배포 확장점(D-008·D-015) | ✅ | `createPluginBinding`·`harnessRows`·`usageRows`·`createConfigApiAugmenters`·`listedModelsOf`·`runtimeModelsFromListing`·`HostHarnessPort` 존재 |
| journal key 영속 바이트(AC23) | ✅ | `background-journal-key.test.ts` golden, M024 red |

## 7. 숫자 / 음성 기준 / 상한 재측정

| 항목 | 구현 전(`a2e8464`) | 구현 후(`4d308eb`) | plan 기록 |
|---|---|---|---|
| §10 기록 검색(보조 포함 47줄) | 설계 시점 N과 전부 같음 | 목표값 전부 충족 | §10 |
| VP-04 고아 사슬(G) | 74 | 0 | 74 / 0 |
| VP-08 심볼(하네스 제외) | 34 | 0 | 44 / 0(하네스 파일 제외 규칙) |
| dead / test-only | 44 / 52 | 33 / 45 | 44 / 52 |
| i18n 키 / 미참조 | 1193 / 64 | 1171 / 56 | 64 / ⊆ 64−8 |
| `native-history-queries.ts` prepare | 17 | 16(생성자 안) | 17 / 생성자만 |

- 자리 합: 3+2+19+3+5+4+29+14+11+4+15+29+3+6+11+4+19+6 = 187 — 구현 보고와 같다.
- 구현 보고 변이 합: 그룹 괄호 합 98 = 실행 86 + 정적 12 — 같다.
- 삭제 i18n 22키 = 계획 14 + BackendStatus 삭제로 소비처 0이 된 `backend.*` 8 — 비리소스 소스 검색 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| D2 스크롤 | fake rAF 순서로 재현(구/신 대조) | 수정 뒤 실제 스트리밍 중 휠 스크롤 확인은 선택 |
| DB 동작(VP-15) | better-sqlite3 Node ABI 재빌드 후 DB 스위트 직접 실행 | 없음 |

## 9. 게이트 재실행

- 환경: Linux · `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall Electron ABI). 이후 검증용으로 `npm rebuild better-sqlite3`(Node ABI)와 `node node_modules/electron/install.js`(Electron 바이너리)를 추가했다 — 저장소 밖 `node_modules`만 바꿨다.
- vitest ① 기준선 환경(Electron ABI): 891파일 · 8,157케이스 중 실패 311 · 실패 ID 340. 기준선 338과의 차집합: 신규 7 = ABI 2(`native-history.db`·`session.load` 신규 케이스) + Windows 전용 5 · 사라짐 5.
- vitest ② Node ABI + Electron 바이너리: 891파일 · 8,281케이스(Windows CI와 같은 분모) 중 통과 8,250 · 실패 22 → 신규 5 = Windows 전용 5.
- Windows 전용 5건: `claude/native-resources.ts:38` `canTogglePlugins = process.platform === 'win32'` — 기준선 red 케이스의 이름 변경·추가분(`adapter.native-plugins` 3 · `claude-assembly` 1 · `project-reconciliation` `false` 1), Windows CI green.
- 사라진 기준선 ID 5건: 같은 계열의 옛 이름 4 + 삭제한 `legacy-storage-migration.integration` 1.
- 게이트가 트리를 바꿨는가: 없음 — 매 단계 뒤 `git status --short` 빈 출력. 변이 러너도 매 변이 뒤 바이트 복원(실행 끝 `''`).
- 잔여물: `verify-evidence/`(커밋 대상) 외 없음.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트·변이 | 에이전트 수행(§4·§9) |
| 제품 의도 / Open Question | 해당 없음 |
| 시각 품질 | D2 수정 뒤 선택 확인 |
| PR merge | 사람 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음(범위 diff 0).
- trailer: `a2e8464`(3키) · 구현 19커밋(6키, 마지막 5키) 모두 `git log -1 --format='%(trailers:only=true)'`로 파싱 — `Agent: codex`·`Status` 허용값, 마지막 `implemented`·`Criteria-Met: 23/23`·`Verified-By: pending`.
- 인용 해시 실재: `ae103f3`·`a2e8464`·`291b721`·`00bb2a9`·`4d308eb` 모두 `git cat-file -t` = commit. 원격 `ccr-18541880-8za1ou` head = `4d308eb`.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals 전부 존재. 강제 지점 표는 pair별 §10 자리 수(합 187)를 담고 자리별 좌표는 `implementation-evidence.md` O-01~O-19.
- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 `Claude`·좌표 자리표시자 — 실제 상태와 일치, 비고 2줄. 이번 턴에 좌표를 기입한다.
- 구현자가 고친 스캐너(`dead-exports.cjs`·`vitest-failed-ids.mjs`)는 경로 구분자 정규화뿐 — Linux에서 구현 전 트리 재측정 결과가 기준선과 같다(dead 44·test-only 52, i18n 64).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 |
|---|---|
| "미해결 PLAN_GAP 없음" | 타당 — 이번 결함도 plan 안에서 고칠 수 있다 |
| 설계 대비 차이: 감시에 debounce·직렬 check 공유 | 공유 축은 맞지만 기준선 시점 축을 놓쳤다(D1) |
| 설계 대비 차이: preload/API 테스트를 `preload/index.test.ts`에 합침 | 타당 — M038·M039 red |
| `native-schema.testfixture.ts` 유지 | 타당 — 이관 로직·호출 0 |
| 로컬 doc-inventory 링크 실패(제3자 checkout) | 이 환경 재현 불가 — 깨끗한 checkout에서 links OK |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | discovery hold 감시 기준선이 hold 시점이라 load 뒤·hold 전 변경을 통보하지 않음(F1) | VP-07 §10 ④ · D-003 | BLOCKING(PAIR_FAIL) | 구현 — 기준선을 소비자가 읽은 상태(probe의 `fingerprint`)로 잡거나 생성 직후 재검증. `project-resource-sync.ts:163`도 같은 불변식으로 확인 |
| D2 | 복원 rAF가 사용자 스크롤 뒤 옛 앵커로 되돌림(F2) | VP-14 §10 #3 · D-003 | BLOCKING(PAIR_FAIL) | 구현 — 복원이 최신 앵커를 쓰게 하고 재현 테스트를 회귀 테스트로 승격 |
| D3 | Claude 전역 감시 파일 목록의 `installed_plugins.json`·`.claude.json` 경로 항 미잠금(M091·M092) | VP-07 §10 ③ | BLOCKING(PAIR_FAIL) | 구현 — 두 파일 변경·`CLAUDE_CONFIG_DIR` 유무로 방송을 단언 |
| D4 | `skills` CRUD author·upload·remove의 새 스캔 미잠금(M097·M098·M100) | VP-16 §10 #2 | BLOCKING(PAIR_FAIL) | 구현 — 진행 중 list와 겹친 CRUD 3경로 각각 단언 |
| D5 | 비동기 Claude 카탈로그의 비Windows 프로젝트 루트 미잠금, 동기 `claudeLocalSettingsRoot` 분기 사본(M101) | VP-11 §10 #3 | BLOCKING(PAIR_FAIL) | 구현 — 비동기 루트 헬퍼 1벌 + cwd≠git 루트 입력으로 단언 |
| N1 | 정규화 JSON 사본 2곳(`project-settings.ts:125`·`background.ts:20`) | 비귀속(VP-18 path 밖) | NON_BLOCKING | 기록 |
| N2 | EP-09 #11 신규 케이스가 Linux 기준선 red fixture를 써 `false` 갈래는 Windows CI에서만 판별(§7 주의사항 지시와 다름) | VP-09 AC 주의사항 | NON_BLOCKING | 기록 — Windows CI green |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(최초 verify). 감시 기준선(D1)은 구현 보고 "놓친 잠재 문제 #3"(stat 중간 상태)과 같은 파일·다른 축이다.
- 관련 plan 지침: VP-07 `실패 의미`에 "누락"이 있고, EP-16 #2가 CRUD 4줄을 자리로 적었다.
- 사용자 결정 변경: ΔV1 D-016·D-017(원문 인용 존재).
- 검증 환경: Linux 기준선 환경에서 DB·Electron 의존 스위트가 red였으나 이번 턴에 Node ABI 재빌드·Electron 바이너리 설치로 직접 실행했다.
- 설계 커밋 `a2e8464`의 trailer가 `Agent: codex`·`Status: designed`다(D-017 위임).

## 15. 결론

- 상태: **FAIL** — 다음 주체 Codex(D-017), 라운드 2.
- verify 횟수: 1회째.
- pair 결과: REQUIRED/REGRESSION 19 중 PASS 14 · root PAIR_FAIL 4(VP-07·VP-11·VP-14·VP-16) · BLOCKED_BY 1(VP-01).
- PLAN_GAP: 없음.
- ACTIVE Decision: D-003 위반 2건(D1·D2), 나머지 충족.
- AC: ✅ 18 · ⚠️ 3 · ❌ 2.
- 운영 gate: 전부 green(환경 분리 포함).
- 다음 단계: 구현자가 D1~D5를 닫고 고장 이력 `못 잡음` 8행(M091·M092·M097·M098·M100·M101·F1·F2)을 잡는 테스트를 만든다. 다음 verify는 이 8행과 이번 `잡음` 행을 다시 실행한다.
