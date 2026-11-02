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

---

# r2 재검증 (2026-11-02)

> r1 본문(위)은 그대로 둔다. 재현 자료는 [`verify-evidence/r2/`](verify-evidence/r2/) — 변이 정의·결과 JSON, 기준선 차감 러너, 재현 매트릭스, 정적 재측정 스크립트, 재현 테스트 2개.

## r2 메타

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-11-02 |
| 대상 커밋/range | `0eb7dc2..c6070f4` — r2 구현 `0fa04db`(코드·테스트·증거) · `c6070f4`(문서만, app 트리 = `0fa04db`) |
| 구현 전 plan 기준 | `0eb7dc2` (규범부 = `a2e8464` V1+ΔV1) |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1` |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 구현 Codex(D-017), 검증 Claude. 구현 보고 밖 축 16건(Z01~Z17, Z13 결번)과 재현 2건을 §r2-4에 넣었다 |

## r2-0. 기준선 / plan 변경 확인

- **판정: 기준선 성립, 규범 변경 0.** plan 1~774행(`> **[구현자 기입]**` 표식까지) `0eb7dc2`↔`c6070f4` diff 0줄.
- 구현 커밋의 plan 변경: `## r2 구현 보완` 절 신설과 `[검증자 기입] 파생 이슈` D1~D5 상태 칸(`closed (… 독립 verify 대기)`)뿐 — impl skill §5가 정한 닫힘 표기다.
- Decision·Product/UX·AC·V node/pair·§10 변경: 없음. 채점 기준은 `a2e8464`의 V1+ΔV1 규범 행 원문(r1과 같다).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | r1 판정 유지 — 규범부 변경 0 |
| §10 자리 목록(기록 검색 재실행 차집합) | 유효 | 기록 검색 47줄을 `0eb7dc2`·`c6070f4` 스냅샷에서 재실행 — 두 트리 값 전부 같고 목표값 충족([`ep-search.sh`](verify-evidence/ep-search.sh)) |
| r2 수정이 만든 운반 자리의 목록 귀속 | 유효 | 수정 자리 전부 기존 고정 자리 안 — `discovery-cache.ts`·`fingerprint-watch.ts`(VP-07 ④·SSOT), `project-resource-sync.ts`(VP-07 ②·VP-04 #8), `ScrollController.tsx`(VP-14 #3), `project-path.ts`(VP-09 #5-7·VP-11 #3) |
| 선택 적대 증거·운영 gate | 유효 | r1 판정 유지 |

- root PLAN_GAP: 없음. 아래 D6·D7은 VP-07 §10 ④ 고정 자리와 ACTIVE D-003 안에서 구현자가 고칠 수 있다.

## r2-1. Product & UX / ACTIVE Decision

| Decision / 요구 | 기대 결과 | r2 판정 |
|---|---|---|
| D-003 관측 동작 보존 | 화면·대화 흐름 불변 | **위반 1건(D7)** — 진행 중 poll이 본 설정 변경을 동시 재로드가 있으면 통보하지 않음(구 코드 1회 → r2 0회). D1·D2는 해소 |
| D-005·D-006·D-008·D-012·D-015·D-016 | r1 판정 | 유지 — r2 diff가 해당 경로를 건드리지 않음(`git diff --stat 0eb7dc2..0fa04db -- app` 16파일) |
| D-007 push 갱신 | 주기 0, push·focus | ✅ M001·M002·M093 잡음, Claude 감시 파일 3항 잠김(M090~M092·Z07) |

```text
외부 설정 변경 ─┬ discovery hold: FingerprintWatch(기준선 = probe stat) → poll → holder notify → server.retire
               ├ ProjectResourceSync: watcher.ready 뒤 policy.read → dirty() = openCodeDiscovery.invalidate()
               └ OpenCode 전역 감시: dirty = invalidateOpenCodeDiscovery → 재로드(run)가 hold poll과 겹칠 수 있다
```

## r2-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| D1 수정의 기준선이 소비자가 읽은 상태인가 | 성립 · **미잠금(D6)** | `discovery-cache.ts:40` stat → `:52` 읽기 순서가 맞다. 순서를 뒤집는 Z01이 9파일 45케이스 green, 재현 A는 HEAD green·Z01 red |
| 새 가드가 다른 실패 모드를 만들었는가 | **결함 D7** | `discovery-cache.ts:262` — manifest가 바뀌면 그 pass가 본 변경을 버리고 다음 pass는 새 manifest와 비교. 재현 B: HEAD 통보 0회, `a2e8464`·`0eb7dc2`·Z03 1회 |
| D7 경쟁의 production 트리거 | 실재 | 같은 파일 변경을 hold 감시와 함께 보는 `invalidate()` 호출자 2곳 — `bootstrap.ts:1250` 전역 감시 `dirty`, `project-settings.ts:43` 프로젝트 정책 `dirty` |
| D2 수정이 다른 순서에서 회귀하는가 | 없음 | 가드는 capture 대기 중에만 복원을 건너뛴다 — 같은 프레임의 구 동기 capture 뒤 복원 delta 0과 같다. 가드 뒤집기 Z06 red 2 |
| project 감시 기준선 대기가 큐를 막는가 | 새 위험 없음 | `await entry.watching`(`project-resource-sync.ts:208`)은 같은 파일 stat 뒤 — `policy.read`도 같은 파일을 읽는다 |
| poll 반복의 worst-case | 유한 | `do … while (pollRequested)` 는 pass 중 들어온 요청 수만큼 반복 — 변경 이벤트가 상한 |
| false success | 없음 | 감시 실패는 기존 `failed → poll` 경로, release 실패 보고 1회(R2-07) |

### D6 — D1 수정의 순서 불변식이 테스트에 잠기지 않는다

- 재현 A: [`discovery-cache.read-stat-order.verify.test.ts`](verify-evidence/r2/repro/discovery-cache.read-stat-order.verify.test.ts) — 내용 읽기 직후 편집 → hold → 통보 1회 기대. HEAD 통과(3/3 반복) · Z01 실패 `got 0 times` · `a2e8464` 통과 · `0eb7dc2` 실패(D1).
- 기존 스위트: Z01(probe stat을 `load()` 뒤로) 아래 discovery 관련 9파일 45케이스 전부 green — r2 회귀 테스트 `during-load`는 편집을 `discoveryReadFile` 해석 뒤에 넣어 이 순서를 재지 않는다.

### D7 — 진행 중 poll이 본 변경을 동시 재로드가 있으면 통보하지 않는다

- 재현 B: [`discovery-cache.reload-during-poll.verify.test.ts`](verify-evidence/r2/repro/discovery-cache.reload-during-poll.verify.test.ts) — hold → 편집 → poll pass의 읽기 대기 중 `invalidate()`+`run()` 재로드 → 통보 1회 기대.
- 관측([`repro-matrix.json`](verify-evidence/r2/repro-matrix.json)): HEAD `expected "vi.fn()" to be called once, but got 0 times`(3/3 반복) · Z03(가드 제거)·`0eb7dc2`·`a2e8464` 통과.
- 결과: hold 콜백(`session-context.ts:508-512` `server.retire`)이 불리지 않아 그 scope의 OpenCode 서버가 옛 설정으로 남는다 — r1 D1과 같은 실패 의미다.
- 기존 스위트: 가드 제거 Z03 아래 45케이스 green — `R2-01a` 근거 테스트(`rechecks a newly held scope…`)는 합류 표시(Z02)만 잰다.

## r2-3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 0eb7dc2..c6070f4` — 대상 6파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| 1a `selectClaudePlugins` 값 export 참조 0 | 정상 | 스캐너 `local-only`(기준선과 같은 범주, `plugin-catalog.ts:194` 사용) |
| 2 `claudePluginProjectRoot`·`OpenCodeDiscoveryCache` 테스트 전용 | 정상 | 둘 다 `test+local` — 파일 안 소비 `project-path.ts:13`·`discovery-cache.ts:301` |
| 형제 정책 비대칭 | 없음 | 스크립트 출력 `(없음)` |
| 동일 규칙 중복 | D5 해소 | 플랫폼 분기 1벌 `project-path.ts:8-10`, 동기·비동기 모두 그 함수 경유 |
| 구현자 정적 민감도 3건(`VP04-ipc-sweep` 등) | 증거 약함 → N3 | 임시 probe 파일에서 rg만 확인 — 실제 트리·기록 명령이 아니다. 검증자가 실제 트리로 S3 재측정(0→1) |

## r2-4. 기존 테스트 / semantic 검증

- **직전 `못 잡음` 8행 재실행: 8/8 잡음.** M091·M092·M097·M098·M100·M101(M101은 코드 이동으로 r1 정의 NOAPPLY — 구현자 재지정 정의와 SSOT 안 Z17로 재측정), F1·F2(재현 테스트 HEAD green · 수정 되돌림 red).
- **이전 라운드 `잡음` 재실행(덮개 회귀): 101/101 + S1~S3 잡음 — red→green 0.** 단 M102·M104는 r1 기록이 측정 오류였다(아래 ‡).
- ‡ r1 러너는 무변이 실패를 빼지 않았다. M102(Y12)·M104(Y14)의 r1 실패 6·2건은 전부 Linux 기준선 red 케이스였다 — r1 실제 결과는 못 잡음. r2는 같은 환경의 무변이 실패 22건을 빼고 판정했고 두 변이는 R2-06·R2-07 케이스로 잡혔다.
- **r2 구현자 신규 정의 5건 독립 재실행: 5/5 잡음.** `D1-startup-check`는 구현자가 `fingerprint-watch.test.ts`에만 심었다 — 소비자 좌표(hold-race)에서도 Z12로 red 2.
- **검증자 축 16건: 잡음 13 · 못 잡음 2(Z01·Z03) · 동치 1(Z16).** 형제 맞바꿈 Z06·Z07·Z10·Z14·Z15 포함.
- Z16 동치 근거: lease `release`의 호출자가 모두 1회다 — `channel.ts:454` finally, `adapter.ts:302`·`:321`·`:371` finally, `composer-preparation-service.ts:71-80` `released` 표식+참조 수. `??=`는 중복 방어이며 0/53 green이 같은 관측이다.

**고장 이력** — r2에서 시도한 고장 전부. `범위` = 실행한 테스트 파일 수, `이번 결과` = 무변이 실패를 뺀 실패 케이스/실행 케이스. 정의·전체 실패명은 [`r2-verify-mutations.json`](verify-evidence/r2/r2-verify-mutations.json)·[`r2-mutation-rerun.json`](verify-evidence/r2/r2-mutation-rerun.json), 러너는 [`mutate-r2.py`](verify-evidence/r2/mutate-r2.py)(환경: Linux · Node ABI better-sqlite3 · Electron 바이너리).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 결과 | 이번 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M001 VP02-interval | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:92` | 호출 대체 | `window.addEventListener('focus', focus) → setInterval(() => void refresh(), 5000)⏎    w` | 1파일 | 잡음 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 등록(구현 목록) |
| M002 VP02-subscribe | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:87` | 제거 | `void refreshBackend(backend) → void backend` | 1파일 | 잡음 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 등록(구현 목록) |
| M003 VP07-comparison | `main/infra/config/fingerprint-watch.ts:85` | 제거 | `this.closed \|\| next === this.fingerprint → this.closed` | 2파일 | 잡음 | 잡음 2/5 | fingerprint-watch.test.ts — compares a supplied consumer baseline on | VP-07 등록(구현 목록) |
| M004 VP09-BOM | `main/infra/config/json-file.ts:15` | 제거 | `text.replace(/^\uFEFF/, '') → text` | 6파일 | 잡음 | 잡음 5/33 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록(구현 목록) |
| M005 VP09-missing-async | `main/infra/config/json-file.ts:40` | 고정값 | `text = await readFile(path, 'utf8')⏎  } catch → text = await readFile(path, 'utf8')⏎  } catch` | 6파일 | 잡음 | 잡음 15/33 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록(구현 목록) |
| M006 VP09-git | `main/adapters/common/git-root.ts:7` | 고정값 | `yield current → yield current⏎    return` | 4파일 | 잡음 | 잡음 4/20 | native-config-boundaries.test.ts — finds the Git root through the Claude pr | VP-09 등록(구현 목록) |
| M007 VP10-membership | `main/adapters/opencode/v1/adapter.ts:203` | 뒤집기 | `return active(item.managedSource, current) → return !active(item.managedSource, current)` | 1파일 | 잡음 | 잡음 1/26 | adapter.test.ts — projects disabled global MCP overrides a | VP-10 등록(구현 목록) |
| M008 VP10-choices | `main/adapters/opencode/v1/adapter.ts:174` | 뒤집기 | `[id, active(identity, current)] → [id, !active(identity, current)]` | 1파일 | 잡음 | 잡음 1/26 | adapter.test.ts — projects disabled global MCP overrides a | VP-10 등록(구현 목록) |
| M009 VP11-double-config | `main/adapters/opencode/v1/channel.ts:492` | 제거 | `openCodeNativePlugins(client, req.cwd, env, s → openCodeNativePlugins(client, req.cwd, env, s` | 1파일 | 잡음 | 잡음 1/1 | channel.native-resources.test.ts — shares one configuration read between pl | VP-11 등록(구현 목록) |
| M010 VP11-serial | `main/adapters/opencode/v1/native-resources.ts:27` | 뒤집기 | `client.app.skills({ directory }, options), → await client.app.skills({ directory }, option` | 1파일 | 잡음 | 잡음 1/6 | native-resources.test.ts — OpenCode native resources > starts skill | VP-11 등록(구현 목록) |
| M011 VP15-client-first | `main/adapters/opencode/v1/native-history.ts:185` | 뒤집기 | `let probeFailed = false → await deps.client(request)⏎    let probeFaile` | 1파일 | 잡음 | 잡음 4/35 | native-history.test.ts — skips SDK messages only when the committ | VP-15 등록(구현 목록) |
| M012 VP16-targets | `main/app/project-resource-sync.ts:179` | 제거 | `void this.apply(entry, runtimeTargets) → void this.apply(entry)` | 1파일 | 잡음 | 잡음 1/17 | project-resource-sync.test.ts — captures runtime targets once per stable | VP-16 등록(구현 목록) |
| M013 VP16-list | `main/app/handlers/skills.ts:46` | 호출 대체 | `listing ?? refresh() → refresh()` | 1파일 | 잡음 | 잡음 5/16 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 등록(구현 목록) |
| M014 VP16-parse | `main/adapters/claude/project-settings.ts:18` | 고정값 | `if (cached?.fingerprint === fingerprint) retu → if (false) return cached!.value` | 1파일 | 잡음 | 잡음 1/5 | project-settings.test.ts — parses shared native state once per file | VP-16 등록(구현 목록) |
| M015 VP16-candidate | `main/adapters/claude/native-history.ts:167` | 다른 값 | `offset (\+=\|\+) 16 → offset $1 1` | 1파일 | 잡음 | 잡음 1/16 | native-history.test.ts — Claude native history reads > bounds con | VP-16 등록(구현 목록) |
| M016 VP16-hash | `main/adapters/claude/native-history.ts:100` | 호출 대체 | `prefixRevision = hash.copy().digest('hex') → prefixRevision = createHash('sha256').update(` | 1파일 | 잡음 | 잡음 1/16 | native-history.test.ts — commits UTF-8 byte checkpoints, reuses c | VP-16 등록(구현 목록) |
| M017 VP16-skill-path | `main/app/skill-catalog.ts:66` | 호출 대체 | `path: await realpath(skill.skillPath).catch(( → path: await realpath(skill.skillPath).then(()` | 1파일 | 잡음 | 잡음 1/1 | skill-catalog.test.ts — assembles the real catalog from lock, ha | VP-16 등록(구현 목록) |
| M018 VP16-event-cap | `main/adapters/opencode/v1/map.ts:94` | 다른 값 | `if (event.id) this.seenEvents.add(event.id) → if (event.id) this.seenEvents.add(event.id)⏎ ` | 1파일 | 잡음 | 잡음 1/1 | map.replay.test.ts — ignores an old text delta replay after m | VP-16 등록(구현 목록) |
| M019 VP16-roots | `main/adapters/opencode/v1/native-resources.ts:62` | 호출 대체 | `skillRoots ??= openCodeSkillRoots(directory,  → skillRoots = openCodeSkillRoots(directory, en` | 1파일 | 잡음 | 잡음 1/6 | native-resources.test.ts — OpenCode native resources > classifies o | VP-16 등록(구현 목록) |
| M020 VP16-SSE | `main/adapters/opencode/v1/session-context.ts:383` | 호출 대체 | `subscriber.directory !== directory → nativePathKey(subscriber.directory) !== direc` | 1파일 | 잡음 | 잡음 1/15 | session-context.test.ts — OpenCode server context with the install | VP-16 등록(구현 목록) |
| M021 VP16-peek | `main/features/extensions/common/mcp/managed-source.ts:77` | 다른 값 | `peek: () => current → peek: () => ({ ...current, users: structuredC` | 1파일 | 잡음 | 잡음 1/2 | managed-source.test.ts — peeks at membership without cloning and  | VP-16 등록(구현 목록) |
| M022 VP17-memo | `renderer/src/features/chat/harnesses/opencode/rightpanel/tiles.tsx:28` | 빈 값 | `let model = inputs.get(backgroundKey) → let model = undefined as ReturnType<typeof se` | 1파일 | 잡음 | 잡음 1/1 | tiles.memo.test.ts — shares one projection across four compon | VP-17 등록(구현 목록) |
| M023 VP18-canonical-harness-config | `main/adapters/common/harness-config.ts:72` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 잡음 | 잡음 7/54 | harness-config.test.ts — env 우선순위 (AC15) > options.env 를 만들지 않는 턴 | VP-18 등록(구현 목록) |
| M024 VP18-canonical-background-task-queries | `main/infra/db/background-task-queries.ts:13` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 잡음 | 잡음 1/1 | background-journal-key.test.ts — preserves persisted journal keys across  | VP-18 등록(구현 목록) |
| M025 VP18-canonical-composer-catalog | `main/app/composer-catalog.ts:46` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 잡음 | 잡음 1/8 | composer-catalog.test.ts — shares preparation identity for reordere | VP-18 등록(구현 목록) |
| M026 VP18-variant-settings | `main/adapters/opencode/v1/settings.ts:84` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 잡음 | 잡음 2/5 | settings.test.ts — OpenCode native model catalogs > uses na | VP-18 등록(구현 목록) |
| M027 VP18-variant-model-listing | `main/adapters/opencode/v1/model-listing.ts:29` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 잡음 | 잡음 1/6 | model-listing.test.ts — parseOpenCodeModelListing (0291 MD-02) > | VP-18 등록(구현 목록) |
| M028 VP18-variant-composer-catalog | `main/adapters/opencode/v1/composer-catalog.ts:42` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 잡음 | 잡음 1/2 | composer-catalog.test.ts — reads plugin-resolved primary agents and | VP-18 등록(구현 목록) |
| M029 VP18-version | `main/adapters/opencode/v1/server.ts:165` | 다른 값 | `['--version'] → ['-v']` | 1파일 | 잡음 | 잡음 1/1 | server.cli.test.ts — probes the installed version through the | VP-18 등록(구현 목록) |
| M030 VP18-db-path | `main/adapters/opencode/v1/server.ts:425` | 다른 값 | `['db', 'path'] → ['db', 'wrong']` | 1파일 | 잡음 | 잡음 1/1 | server.database-path.test.ts — OpenCode native database path (0262 EP56 | VP-18 등록(구현 목록) |
| M031 VP18-auth-plugin | `main/features/auth/runtime.ts:268` | 맞바꿈 | `snapshot: () => loginFreeSnapshot(authId) → snapshot: () => (connections.has(authId) ? al` | 1파일 | 잡음 | 잡음 6/26 | login-free.test.ts — 로그인 프리 런타임 — lifecycle 분리 (0248 AC4·AC8· | VP-18 등록(구현 목록) |
| M032 VP18-auth-runtime | `main/features/auth/runtime.ts:317` | 맞바꿈 | `return loginFreeSnapshot(authId) → return (connections.has(authId) ? alwaysConne` | 1파일 | 잡음 | 잡음 2/26 | login-free.test.ts — 로그인 프리 호스트 연결 — 런타임 경유 (0291) > snapshot | VP-18 등록(구현 목록) |
| M033 VP18-connection-list | `main/app/connection-views.ts:86` | 다른 값 | `providerConnectionInfo(snapshot.connection) → ({ ...providerConnectionInfo(snapshot.connect` | 1파일 | 잡음 | 잡음 1/12 | connection-views.test.ts — host connection (0291) > carries connect | VP-18 등록(구현 목록) |
| M034 VP18-connection-handler | `main/app/handlers/providers.ts:83` | 다른 값 | `return providerConnectionInfo(status) → return { ...providerConnectionInfo(status), m` | 1파일 | 잡음 | 잡음 1/4 | providers.test.ts — registerConnectionHandlers > connect는 최종 | VP-18 등록(구현 목록) |
| M035 VP18-skill-order | `renderer/src/features/chat/lib/attachMenuModel.ts:100` | 뒤집기 | `skillGroups.unshift(next) → skillGroups.push(next)` | 1파일 | 잡음 | 잡음 1/20 | attachMenuModel.test.ts — buildAttachMenu > merges groups that sha | VP-18 등록(구현 목록) |
| M036 VP19-bootstrap-opencode | `main/app/bootstrap.ts:1257` | 빈 값 | `broadcastExtensionsChanged({ backend: 'openco → undefined` | 1파일 | 잡음 | 잡음 1/22 | bootstrap.native-history.test.ts — broadcasts each OpenCode plugin revision | VP-19 등록(구현 목록) |
| M037 VP19-bootstrap-claude | `main/app/bootstrap.ts:1275` | 빈 값 | `broadcastExtensionsChanged({ backend: 'claude → undefined` | 1파일 | 잡음 | 잡음 5/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-19 등록(구현 목록) |
| M038 VP19-preload | `preload/index.ts:281` | 빈 값 | `subscribe(CHANNELS.extensionsChanged, handler → (() => undefined)` | 1파일 | 잡음 | 잡음 1/29 | index.test.ts — forwards backend extension changes throu | VP-19 등록(구현 목록) |
| M039 VP19-api | `renderer/src/shared/api/ipc.ts:238` | 빈 값 | `globalThis.window?.orca?.session?.onExtension → undefined` | 1파일 | 잡음 | 잡음 1/29 | index.test.ts — forwards backend extension changes throu | VP-19 등록(구현 목록) |
| M040 VP15-whole-delete | `main/infra/db/native-history-queries.ts:88` | 고정값 | `AND native_id NOT IN (SELECT value FROM json_ → AND length(?) >= 0` | 1파일 | 잡음 | 잡음 1/15 | native-history.db.test.ts — native history with the migrated SQLite  | VP-15 등록(구현 목록) |
| M041 VP16-identity | `main/adapters/opencode/v1/server-profile.ts:51` | 호출 대체 | `profileComponents(executableIdentity, cwd, en → profileComponents(openCodeExecutableIdentity(` | 1파일 | 잡음 | 잡음 1/1 | server-profile.test.ts — computes executable identity once and de | VP-16 등록(구현 목록) |
| M042 VP16-defaults | `main/adapters/claude/plugin-catalog.ts:26` | 호출 대체 | `const defaults = pluginDefaults(readObject(jo → readClaudePluginCatalog(process.cwd(), native` | 1파일 | 잡음 | 잡음 1/8 | plugin-catalog.test.ts — native plugin catalog > reads defaults f | VP-16 등록(구현 목록) |
| M043 VP12-mark | `renderer/src/shared/ui/HarnessLogo.tsx:16` | 뒤집기 | `backend === 'claude' ? ( → backend !== 'claude' ? (` | 1파일 | 잡음 | 잡음 2/2 | HarnessLogo.render.test.ts — preserves claude artwork and default or  | VP-12 등록(구현 목록) |
| M044 VP12-color | `renderer/src/shared/ui/HarnessLogo.tsx:14` | 맞바꿈 | `backend === 'claude' ? 'text-spinner' : 'text → backend === 'claude' ? 'text-oc-ink' : 'text-` | 1파일 | 잡음 | 잡음 2/2 | HarnessLogo.render.test.ts — preserves claude artwork and default or  | VP-12 등록(구현 목록) |
| M045 VP12-engine | `renderer/src/features/engine/common/components/EngineCard.tsx:30` | 맞바꿈 | `backend={agent.adapter} → backend={agent.adapter === 'claude' ? 'openco` | 1파일 | 잡음 | 잡음 2/3 | EngineCard.render.test.ts — preserves the claude card label and edit | VP-12 등록(구현 목록) |
| M046 VP12-engine-menu | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:101` | 맞바꿈 | `backend={engine} → backend={engine === 'claude' ? 'opencode' : '` | 1파일 | 잡음 | 잡음 1/1 | AgentEnvironmentView.interaction.test.ts — selects Claude or OpenCode before openin | VP-12 등록(구현 목록) |
| M047 VP12-source-claude | `renderer/src/features/skills/components/customize/SourceHeading.tsx:20` | 맞바꿈 | `backend="claude" → backend="opencode"` | 1파일 | 잡음 | 잡음 1/2 | SourceHeading.render.test.ts — preserves the native:claude source mark  | VP-12 등록(구현 목록) |
| M048 VP12-source-opencode | `renderer/src/features/skills/components/customize/SourceHeading.tsx:22` | 맞바꿈 | `backend="opencode" → backend="claude"` | 1파일 | 잡음 | 잡음 1/2 | SourceHeading.render.test.ts — preserves the native:opencode source mar | VP-12 등록(구현 목록) |
| M049 VP12-agent-toggle | `renderer/src/features/chat/components/AgentModeToggle.tsx:57` | 맞바꿈 | `backend="claude" → backend="opencode"` | 1파일 | 잡음 | 잡음 2/5 | AgentModeToggle.test.ts — actual draft mode toggle > places the wo | VP-12 등록(구현 목록) |
| M050 VP12-model-menu | `renderer/src/features/chat/components/composer/ModelMenu.tsx:46` | 맞바꿈 | `backend={agent.adapter} → backend={agent.adapter === 'claude' ? 'openco` | 1파일 | 잡음 | 잡음 2/9 | modelMenu0215.render.test.ts — preserves the claude provider heading br | VP-12 등록(구현 목록) |
| M051 VP12-composer-icon | `renderer/src/features/chat/harnesses/registries/composer.ts:20` | 맞바꿈 | `backend: sourceBackend → backend: sourceBackend === 'claude' ? 'openco` | 1파일 | 잡음 | 잡음 2/3 | brand-surfaces.test.ts — carries each source brand through the cl | VP-12 등록(구현 목록) |
| M052 VP12-sidebar | `renderer/src/app/SidebarUserButton.tsx:137` | 맞바꿈 | `backend={backend} → backend={backend === 'claude' ? 'opencode' : ` | 1파일 | 잡음 | 잡음 1/1 | SidebarUserButton.brand.test.ts — passes each settings brand with the orig | VP-12 등록(구현 목록) |
| M053 VP13-claude-variant | `renderer/src/features/chat/harnesses/claude/surfaces.ts:11` | 맞바꿈 | `variant: 'outlined' → variant: 'flat'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M054 VP13-claude-chipVariant | `renderer/src/features/chat/harnesses/claude/surfaces.ts:12` | 맞바꿈 | `chipVariant: 'segment' → chipVariant: 'flat'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M055 VP13-claude-showChevron | `renderer/src/features/chat/harnesses/claude/surfaces.ts:13` | 맞바꿈 | `showChevron: false → showChevron: true` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M056 VP13-claude-trailingDivider | `renderer/src/features/chat/harnesses/claude/surfaces.ts:14` | 맞바꿈 | `trailingDivider: true → trailingDivider: false` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M057 VP13-claude-contextRow | `renderer/src/features/chat/harnesses/claude/surfaces.ts:15` | 맞바꿈 | `contextRow: landingFrame.contextRow → contextRow: ''` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M058 VP13-claude-chipGroup | `renderer/src/features/chat/harnesses/claude/surfaces.ts:16` | 맞바꿈 | `chipGroup: chipGroupSurface → chipGroup: 'inline-flex h-7 max-w-full items-` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M059 VP13-claude-landing | `renderer/src/features/chat/harnesses/claude/landing/presentation.ts:6` | 맞바꿈 | `contextLayout: 'inline' → contextLayout: 'below'` | 1파일 | 잡음 | 잡음 1/3 | brand-surfaces.test.ts — keeps the context location in the landin | VP-13 등록(구현 목록) |
| M060 VP13-opencode-variant | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:9` | 맞바꿈 | `variant: 'flat' → variant: 'outlined'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M061 VP13-opencode-chipVariant | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:10` | 맞바꿈 | `chipVariant: 'flat' → chipVariant: 'segment'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M062 VP13-opencode-showChevron | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:11` | 맞바꿈 | `showChevron: true → showChevron: false` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M063 VP13-opencode-trailingDivider | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:12` | 맞바꿈 | `trailingDivider: false → trailingDivider: true` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M064 VP13-opencode-contextRow | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:13` | 다른 값 | `contextRow: '' → contextRow: 'gap-g3'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M065 VP13-opencode-chipGroup | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:14` | 다른 값 | `chipGroup: 'inline-flex h-7 max-w-full items- → chipGroup: 'border'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M066 VP13-opencode-landing | `renderer/src/features/chat/harnesses/opencode/landing/presentation.ts:6` | 맞바꿈 | `contextLayout: 'below' → contextLayout: 'inline'` | 1파일 | 잡음 | 잡음 1/3 | brand-surfaces.test.ts — keeps the context location in the landin | VP-13 등록(구현 목록) |
| M067 VP13-seed-kind | `renderer/src/features/chat/store/chatStore.ts:200` | 뒤집기 | `supportsAgentKind(landingBackend, entry.sessi → !supportsAgentKind(landingBackend, entry.sess` | 1파일 | 잡음 | 잡음 2/12 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M068 VP13-fresh-kind | `renderer/src/features/chat/store/chatStore.ts:255` | 뒤집기 | `!supportsAgentKind(landingBackend, landingAge → supportsAgentKind(landingBackend, landingAgen` | 1파일 | 잡음 | 잡음 2/12 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M069 VP13-handoff | `renderer/src/features/chat/store/chatStore.ts:1566` | 제거 | `sessionBusy\(src\) \\|\\|\s*src\.loadingSessi → sessionBusy(src) \|\| src.loadingSession \|\|` | 2파일 | 잡음 | 잡음 4/70 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M070 VP13-open-subagent | `renderer/src/features/chat/store/chatStore.ts:2108` | 맞바꿈 | `.subagentTile === 'task' → .subagentTile === 'subagent'` | 2파일 | 잡음 | 잡음 1/9 | chatStore.panelTiles.test.ts — OpenCode independent panel state > keeps | VP-13 등록(구현 목록) |
| M071 VP13-reducer-subagent | `renderer/src/features/chat/reducer/chatReducer.ts:1996` | 맞바꿈 | `HARNESS_CAPABILITIES[state.backend ?? 'claude → HARNESS_CAPABILITIES[state.backend === 'claud` | 2파일 | 잡음 | 잡음 1/40 | chatReducer.harness.test.ts — harness identity and panel enforcement > | VP-13 등록(구현 목록) |
| M072 VP13-permissions | `renderer/src/features/chat/reducer/chatReducer.ts:1653` | 뒤집기 | `HARNESS_CAPABILITIES[backend].permissionModes → !HARNESS_CAPABILITIES[backend].permissionMode` | 2파일 | 잡음 | 잡음 2/37 | chatReducer.harness.test.ts — harness identity and panel enforcement > | VP-13 등록(구현 목록) |
| M073 VP13-composer-frame | `renderer/src/features/chat/components/Composer.tsx:234` | 뒤집기 | `contextLayout === 'below' && contextBelow ? l → contextLayout !== 'below' && contextBelow ? l` | 1파일 | 잡음 | 잡음 1/5 | NewChatLandingPage.harness.test.ts — shares the landing frame and hero slot a | VP-13 등록(구현 목록) |
| M074 VP13-composer-inline | `renderer/src/features/chat/components/Composer.tsx:255` | 뒤집기 | `showLandingCwdPanel && !(contextLayout === 'b → showLandingCwdPanel && (contextLayout === 'be` | 1파일 | 잡음 | 잡음 1/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M075 VP13-composer-below | `renderer/src/features/chat/components/Composer.tsx:407` | 뒤집기 | `showLandingCwdPanel && contextLayout === 'bel → showLandingCwdPanel && contextLayout !== 'bel` | 1파일 | 잡음 | 잡음 3/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M076 VP13-landing-forward | `renderer/src/features/chat/components/Landing.tsx:27` | 다른 값 | `{...presentation.composer} → {...presentation.composer} contextLayout='inl` | 1파일 | 잡음 | 잡음 2/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M077 VP12-label-copy | `renderer/src/features/chat/components/ChatTitleBar.tsx:115` | 맞바꿈 | `HARNESS_CAPABILITIES[conversationBackend ?? ' → HARNESS_CAPABILITIES[conversationBackend === ` | 1파일 | 잡음 | 잡음 2/3 | ChatTitleBar.copy.test.ts — copies the claude conversation with its  | VP-12 등록(구현 목록) |
| M078 VP12-label-engine | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:102` | 맞바꿈 | `HARNESS_CAPABILITIES[engine].shortLabel → HARNESS_CAPABILITIES[engine === 'claude' ? 'o` | 1파일 | 잡음 | 잡음 1/1 | AgentEnvironmentView.interaction.test.ts — selects Claude or OpenCode before openin | VP-12 등록(구현 목록) |
| M079 VP12-label-source | `shared/extension-sources.ts:6` | 맞바꿈 | `HARNESS_CAPABILITIES[backend].shortLabel → HARNESS_CAPABILITIES[backend === 'claude' ? '` | 2파일 | 잡음 | 잡음 5/25 | attachMenuModel.test.ts — buildAttachMenu > merges groups that sha | VP-12 등록(구현 목록) |
| M080 VP12-plan-hint-claude | `renderer/src/features/chat/harnesses/claude/rightpanel/tileRegistry.ts:15` | 맞바꿈 | `selectHintKey: harnessCatalog('claude') → selectHintKey: harnessCatalog('opencode')` | 1파일 | 잡음 | 잡음 2/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록(구현 목록) |
| M081 VP12-plan-hint-opencode | `renderer/src/features/chat/harnesses/opencode/rightpanel/tileRegistry.ts:20` | 맞바꿈 | `selectHintKey: harnessCatalog('opencode') → selectHintKey: harnessCatalog('claude')` | 1파일 | 잡음 | 잡음 2/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록(구현 목록) |
| M082 R-VP09-missing-sync-all | `main/infra/config/json-file.ts:28` | 고정값 | `if ((error as NodeJS.ErrnoException).code === → if (false) return {}` | 6파일 | 잡음 | 잡음 22/33 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록 재지정 |
| M083 R-VP09-missing-sync-only | `main/infra/config/json-file.ts:28` | 고정값 | `if ((error as NodeJS.ErrnoException).code === → if (false) return {}` | 6파일 | 잡음 | 잡음 12/33 | native-config-boundaries.test.ts — carries BOM JSON through synchronous and | VP-09 등록 재지정 |
| M084 R-VP18-plugin-order-native | `renderer/src/features/chat/lib/attachMenuModel.ts:182` | 뒤집기 | `pluginItems.push( → pluginItems.unshift(` | 2파일 | 잡음 | 잡음 4/35 | attachMenuModel.test.ts — buildAttachMenu > puts the Orcinus orca  | VP-18 등록 재지정 |
| M085 R-VP13-fork-only | `renderer/src/features/chat/store/chatStore.ts:1513` | 뒤집기 | `!HARNESS_CAPABILITIES[src.backend ?? 'claude' → HARNESS_CAPABILITIES[src.backend ?? 'claude']` | 2파일 | 잡음 | 잡음 6/70 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록 재지정 |
| M086 R-VP12-plan-claude-desc | `renderer/src/features/chat/harnesses/claude/rightpanel/tileRegistry.ts:14` | 맞바꿈 | `harnessCatalog('claude') → harnessCatalog('opencode')` | 1파일 | 잡음 | 잡음 1/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록 재지정 |
| M087 R-VP12-plan-opencode-desc | `renderer/src/features/chat/harnesses/opencode/rightpanel/tileRegistry.ts:19` | 맞바꿈 | `harnessCatalog('opencode') → harnessCatalog('claude')` | 1파일 | 잡음 | 잡음 1/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록 재지정 |
| M088 Y01-VP07-revision-sibling | `main/app/harnesses/opencode/global-watch.ts:29` | 고정값 | `if (current !== previous) { → if (true) {` | 2파일 | 잡음 | 잡음 1/25 | bootstrap.native-history.test.ts — broadcasts each OpenCode plugin revision | VP-07 재량(검증자 축) |
| M089 Y02-VP19-claude-close | `main/app/bootstrap.ts:945` | 제거 | `this.claudeGlobalWatch?.close() → ∅` | 1파일 | 잡음 | 잡음 5/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-19 재량(검증자 축) |
| M090 Y03-VP07-claude-settings-file | `main/app/bootstrap.ts:1269` | 제거 | `nativeClaude.settings, → ∅` | 1파일 | 잡음 | 잡음 1/22 | bootstrap.native-history.test.ts — broadcasts Claude global changes only on | VP-07 재량(검증자 축) |
| M091 Y04-VP07-claude-installed-file | `main/app/bootstrap.ts:1270` | 제거 | `join(nativeClaude.root, 'plugins', 'installed → ∅` | 1파일 | 못 잡음 | 잡음 2/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-07 재량(검증자 축) |
| M092 Y05-VP07-claude-state-path-swap | `main/app/bootstrap.ts:1272` | 맞바꿈 | `? join(nativeClaude.root, '.claude.json')⏎    → ? join(homedir(), '.claude.json')⏎          :` | 1파일 | 못 잡음 | 잡음 4/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-07 재량(검증자 축) |
| M093 Y06-VP02-toggle-pending | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:147` | 제거 | `if (pending.current.has(backend)) void refres → ∅` | 1파일 | 잡음 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 재량(검증자 축) |
| M094 Y07-VP15-cold-recovery-bypass | `main/app/chat-turn/native-session.ts:46` | 제거 | `recovery && !recovery.accepted ? undefined :  → readNativeHistoryPrevious(db, request.session` | 1파일 | 잡음 | 잡음 1/12 | native-session.test.ts — native retention recovery through the mi | VP-15 재량(검증자 축) |
| M095 Y08-VP15-handler-snapshot | `main/app/handlers/session.ts:95` | 빈 값 | `sync.snapshot → undefined` | 1파일 | 잡음 | 잡음 1/11 | session.load.test.ts — session load IPC refreshes native histor | VP-15 재량(검증자 축) |
| M096 Y09-VP16-skills-generation | `main/app/bootstrap.ts:296` | 제거 | `if (revision === this.skillsRevision) this.sk → this.skillsCache = skills` | 1파일 | 잡음 | 잡음 1/22 | bootstrap.native-history.test.ts — keeps the newer skill scan in the cache  | VP-16 재량(검증자 축) |
| M097 Y10-VP16-author-joins-stale | `main/app/handlers/skills.ts:49` | 호출 대체 | `await writeAuthoredSkill(req)⏎    await ctx.d → await writeAuthoredSkill(req)⏎    await ctx.d` | 1파일 | 못 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 재량(검증자 축) |
| M098 Y10b-VP16-upload-joins-stale | `main/app/handlers/skills.ts:57` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 못 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:u | VP-16 재량(검증자 축) |
| M099 Y10c-VP16-setEnabled-joins-stale | `main/app/handlers/skills.ts:76` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 잡음 | 잡음 2/16 | skills.test.ts — catalog skill target IPC > orca:skills:s | VP-16 재량(검증자 축) |
| M100 Y10d-VP16-remove-joins-stale | `main/app/handlers/skills.ts:97` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 못 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:r | VP-16 재량(검증자 축) |
| M101 Y11-VP11-async-project-root | `main/adapters/claude/plugin-catalog.ts:321` | 호출 대체 | `const projectRoot = await claudeLocalSettings → const projectRoot = resolve(cwd)` | 3파일 | 못 잡음 | 잡음 1/16 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 재량(검증자 축) |
| M102 Y12-VP10-binding-project | `main/app/session-binding.ts:10` | 고정값 | `current.project_id === expected.project_id → true` | 5파일 | 잡음‡ | 잡음 1/49 | bootstrap.native-history.test.ts — reads native configuration through the r | VP-10 재량(검증자 축) |
| M103 Y13-VP04-serialize | `main/app/project-resource-sync.ts:72` | 제거 | `(this.mutations.get(key) ?? Promise.resolve() → Promise.resolve()` | 1파일 | 잡음 | 잡음 7/17 | project-resource-sync.test.ts — holds watcher broadcasts behind an in-fl | VP-04 재량(검증자 축) |
| M104 Y14-VP10-dispose-report | `main/adapters/opencode/v1/adapter.ts:223` | 제거 | `releasing ??= lease.release().catch(reportDis → releasing ??= lease.release().catch(() => und` | 2파일 | 잡음‡ | 잡음 1/53 | adapter.persistent.test.ts — OpenCode persistent SDK channel > report | VP-10 재량(검증자 축) |
| M105 Y15-VP17-reduced-motion | `renderer/src/shared/hooks/useReducedMotion.ts:12` | 뒤집기 | `setReduced(query.matches) → setReduced(!query.matches)` | 1파일 | 잡음 | 잡음 1/1 | useReducedMotion.test.ts — reads the motion preference, follows cha | VP-17 재량(검증자 축) |
| M106 Y16-VP14-row-remove | `renderer/src/features/engine/harnesses/opencode/ProviderForm.tsx:101` | 고정값 | `disabled={rows.length <= 1} → disabled={false}` | 1파일 | 잡음 | 잡음 1/10 | ProviderForm.interaction.test.ts — OpenCode provider form through productio | VP-14 재량(검증자 축) |
| M107 Y17-VP09-flag-array | `main/adapters/claude/plugin-flag.ts:4` | 제거 | `value === true \|\| Array.isArray(value) \|\| → value === true \|\| isRecord(value)` | 3파일 | 잡음 | 잡음 1/27 | project-reconciliation.test.ts — projects native plugin flag undefined du | VP-09 재량(검증자 축) |
| S1 VP06-ownership | `main/app/harnesses/common/contracts.ts:43` | 다른 값 | 공통 모듈에 이동 모듈 5종 import를 하나씩 추가 | eslint 1파일 | 잡음 | 잡음 5/5 — 각 `harness/ownership` error 1 | `harness/ownership` | VP-06 등록 |
| S2 VP08-dead | `renderer/src/features/chat/lib/parts.ts` 끝 | 다른 값 | 삭제한 `partsStructured` export 복원 | 스캐너 | 잡음 | 잡음 dead 33→34, 신규 행 1 | `scan/dead-exports.cjs` | VP-08 등록 |
| S3 VP04-sweep | `renderer/src/shared/api/ipc.ts` 끝 | 다른 값 | `openNativePlugin` 토큰 복원 | rg | 잡음 | 잡음 0→1 | VP-04 기록 검색(G) | VP-04 등록 |
| F1 D1-hold-race | `main/adapters/opencode/v1/discovery-cache.ts:229` | 회귀 재현 | r1 재현 V1·V2를 HEAD에서 실행 + D1 수정(`initialFingerprint`) 되돌림 | 1파일 | 못 잡음 | 잡음 — HEAD green 2/2 · 되돌림 red 1/2(V1) | 재현 V1 · `discovery-cache.hold-race.test.ts` 2케이스(R2I F1) | VP-07 ④ · D1 |
| F2 D2-scroll-race | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:171` | 회귀 재현 | r1 재현을 HEAD에서 실행 + 가드 되돌림 | 1파일 | 못 잡음 | 잡음 — HEAD green 1/1 · 되돌림 red 1/1 | 재현 · `ScrollController.restore-race.test.ts`(R2I F2) | VP-14 #3 · D2 |
| R2I F1-D1-loaded-baseline | `main/adapters/opencode/v1/discovery-cache.ts:229` | 제거 | `initialFingerprint: JSON.stringify(dependenci → ∅` | 1파일 | 신규 | 잡음 2/3 | discovery-cache.hold-race.test.ts — notifies once about a dependency changed | D1 인용(구현자 정의) |
| R2I F2-D2-scroll-order | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:171` | 제거 | `captureFrame.current === null && state.anchor → state.anchor` | 1파일 | 신규 | 잡음 1/2 | ScrollController.restore-race.test.ts — preserves the latest user scroll with re | D2 인용(구현자 정의) |
| R2I D1-project-baseline-order | `main/app/project-resource-sync.ts:208` | 호출 대체 | `await entry.watching → void entry.watching` | 1파일 | 신규 | 잡음 1/1 | project-resource-sync.initialization.test.ts — establishes the watcher baseline before  | D1 보완 oracle(구현자 정의) |
| R2I D1-startup-check | `main/infra/config/fingerprint-watch.ts:70` | 제거 | `if (deps.initialFingerprint !== undefined) sc → ∅` | 1파일 | 신규 | 잡음 1/2 | fingerprint-watch.test.ts — compares a supplied consumer baseline on | D1 보완 oracle(구현자 정의) |
| R2I D1-pending-scope-check | `main/adapters/opencode/v1/discovery-cache.ts:276` | 고정값 | `} while (this.pollRequested) → } while (false)` | 1파일 | 신규 | 잡음 1/7 | discovery-cache.test.ts — rechecks a newly held scope when its sta | D1 보완 oracle(구현자 정의) |
| Z01 VP07-4-probe-stat-after-load | `main/adapters/opencode/v1/discovery-cache.ts:53` | 뒤집기 | `(value) => ({ value, signature: hash(describe → async (value) => ({ value, signature: hash(de` | 9파일 | 신규 | **못 잡음** 0/45 | — · 재현 A는 Z01에서 red(HEAD green) | VP-07 ④ 재량(검증자 축) |
| Z02 VP07-4-poll-join-flag | `main/adapters/opencode/v1/discovery-cache.ts:243` | 제거 | `poll(): Promise<void> {⏎    this.pollRequeste → poll(): Promise<void> {` | 9파일 | 신규 | 잡음 1/45 | discovery-cache.test.ts — rechecks a newly held scope when its sta | VP-07 ④ 재량(검증자 축) |
| Z03 VP07-4-stale-manifest-guard | `main/adapters/opencode/v1/discovery-cache.ts:262` | 제거 | `if (observer.dependencies !== dependencies) { → ∅` | 9파일 | 신규 | **못 잡음** 0/45 | — · 재현 B는 Z03에서 green(HEAD red) | VP-07 ④ 재량(검증자 축) |
| Z04 VP07-2-ready-collect | `main/app/project-resource-sync.ts:173` | 제거 | `ready.push(watcher.ready) → ∅` | 7파일 | 신규 | 잡음 1/47 | project-resource-sync.initialization.test.ts — establishes the watcher baseline before  | VP-07 ② 재량(검증자 축) |
| Z05 VP07-2-ready-early | `main/infra/config/fingerprint-watch.ts:53` | 호출 대체 | `this.ready = this.tail = ( → this.ready = Promise.resolve(); this.tail = (` | 7파일 | 신규 | 잡음 1/47 | project-resource-sync.initialization.test.ts — establishes the watcher baseline before  | VP-07 ② 재량(검증자 축) |
| Z06 VP14-3-guard-flip | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:171` | 뒤집기 | `captureFrame.current === null && state.anchor → captureFrame.current !== null && state.anchor` | 4파일 | 신규 | 잡음 2/9 | ScrollController.restore-race.test.ts — preserves the latest user scroll with re | VP-14 #3 재량(형제 맞바꿈) |
| Z07 VP07-3-default-state-arm | `main/app/bootstrap.ts:1273` | 다른 값 | `: join(homedir(), '.claude.json') → : join(nativeClaude.root, '.claude.json')` | 1파일 | 신규 | 잡음 2/22 | bootstrap.native-history.test.ts — broadcasts Claude false config / install | VP-07 ③ 재량(M092 형제 갈래) |
| Z08 VP16-2-flight-identity | `main/app/handlers/skills.ts:41` | 제거 | `if (listing === task) listing = undefined → listing = undefined` | 2파일 | 신규 | 잡음 4/38 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 #2 재량(검증자 축) |
| Z09 VP16-2-author-scan-before-deploy | `main/app/handlers/skills.ts:49` | 뒤집기 | `await writeAuthoredSkill(req)⏎    await ctx.d → await writeAuthoredSkill(req)⏎    const scan ` | 1파일 | 신규 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 #2 재량(검증자 축) |
| Z10 VP11-3-platform-flip | `main/adapters/claude/project-path.ts:9` | 뒤집기 | `process.platform === 'win32' ? resolve(cwd) : → process.platform !== 'win32' ? resolve(cwd) :` | 8파일 | 신규 | 잡음 3/51 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 #3·VP-09 재량(형제 맞바꿈) |
| Z11 VP11-3-sync-root-cwd | `main/adapters/claude/project-path.ts:13` | 고정값 | `localSettingsRoot(cwd, () => claudePluginProj → localSettingsRoot(cwd, () => resolve(cwd))` | 8파일 | 신규 | 잡음 2/51 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 #3·VP-09 재량(검증자 축) |
| Z12 VP07-4-startup-check-consumer | `main/infra/config/fingerprint-watch.ts:70` | 제거 | `if (deps.initialFingerprint !== undefined) sc → ∅` | 9파일 | 신규 | 잡음 2/45 | discovery-cache.hold-race.test.ts — notifies once about a dependency changed | VP-07 ④ 재량(소비자 좌표) |
| Z14 VP10-9-binding-cwd | `main/app/session-binding.ts:9` | 고정값 | `current.cwd === expected.cwd → true` | 5파일 | 신규 | 잡음 1/49 | bootstrap.native-history.test.ts — reads native configuration through the r | VP-10 #9 재량(형제 항) |
| Z15 VP10-9-binding-backend | `main/app/session-binding.ts:8` | 고정값 | `current.backend === expected.backend → true` | 5파일 | 신규 | 잡음 1/49 | bootstrap.native-history.test.ts — reads native configuration through the r | VP-10 #9 재량(형제 항) |
| Z16 VP10-5-release-once | `main/adapters/opencode/v1/adapter.ts:223` | 뒤집기 | `releasing ??= lease.release().catch(reportDis → releasing = lease.release().catch(reportDispo` | 2파일 | 신규 | 동치 0/53 | — · lease release 호출자 전부 1회(§r2-4 근거) | VP-10 #5-6 재량(검증자 축) |
| Z17 VP11-3-async-helper-root | `main/adapters/claude/project-path.ts:17` | 고정값 | `async () => (await gitRootLineage(cwd)).root → async () => resolve(cwd)` | 8파일 | 신규 | 잡음 1/51 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 #3 재량(M101 SSOT 안) |
| F3 D7-reload-during-poll | `main/adapters/opencode/v1/discovery-cache.ts:262` | 회귀 재현 | poll pass 읽기 대기 중 `invalidate()`+`run()` 재로드 | 1파일 | 신규 | **못 잡음** — 기존 스위트 green(Z03 0/45), 재현 B HEAD red(통보 0) · `a2e8464`·`0eb7dc2` green | 재현 B | VP-07 ④ · D-003 |

- 검산: 시도 134 = r1 이력 재실행 112(변이 107 · 정적 3 · 재현 2) + r2 구현자 정의 5 + 검증자 축 16 + 회귀 재현 1. 잡음 130 · 못 잡음 3(Z01·Z03·F3) · 동치 1(Z16).
- 재현 A(Z01의 관측 근거)는 고장 행이 아니라 Z01 행의 근거다 — HEAD green · Z01 red([`repro-matrix.json`](verify-evidence/r2/repro-matrix.json)).
- 소거 변이 잔여물: 판정은 assertion 실패만 셌다 — typecheck 잔여물이 red 근거가 된 행 없음.
- `N회` 관측 주체: R2-04 `refreshSkills` mock 호출 수, R2-07 `reportError` mock, D7 holder 콜백 `vi.fn` 호출 수.

## r2-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-08 | MD↔UT | REQUIRED | PASS | 검색 47줄 목표값 · S2 · dead/test-only 33/45 신규 0 · i18n present 0·56 신규 0 | 29/29 |
| VP-09 | MD↔UT | REQUIRED | PASS(재판정) | M004~M006·M082·M083·M107 잡음 + Z10·Z11(공유 플랫폼 분기) | 14/14 |
| VP-10 | MD↔UT | REQUIRED | PASS(재판정) | M007·M008 · M102·M104 실제 잡음(r1 ‡ 정정) · Z14·Z15 · Z16 동치 | 11/11 |
| VP-11 | MD↔UT | REQUIRED | PASS | #1 M009 · #2 M010 · #3 **M101 잡음**(r1 못 잡음)·Z10·Z11·Z17 · #4 `skill-catalog.test.ts` green | 4/4 |
| VP-12 | MD↔UT | REQUIRED | PASS | M043~M052·M077~M081·M086·M087 잡음 17 | 15/15 |
| VP-13 | MD↔UT | REQUIRED | PASS | M053~M076·M085 잡음 25 | 29/29 |
| VP-14 | MD↔UT | REQUIRED | PASS | M106 · **F2 해소**(HEAD green·되돌림 red) · R2I F2 · Z06 | 3/3 |
| VP-15 | MD↔UT | REQUIRED | PASS | M011·M040·M094·M095 · DB 스위트 Node ABI green | 6/6 |
| VP-16 | MD↔UT | REQUIRED | PASS | M012~M021·M041·M042·M096 · **M097·M098·M100 잡음**(r1 못 잡음)·M099 · Z08·Z09 | 11/11 |
| VP-17 | MD↔UT | REQUIRED | PASS | M022·M105 | 4/4 |
| VP-18 | MD↔UT | REQUIRED | PASS | M023~M035·M084 잡음 14 · journal golden green | 19/19 |
| VP-04 | AR↔IT | REQUIRED | PASS(재판정) | 사슬 검색 0 · S3 · M103 잡음 7 — 큐 안 `await entry.watching` 뒤에도 직렬화 유지 | 19/19 |
| VP-05 | AR↔IT | REQUIRED | PASS | 구 조립 0 · Linux 기준선 red 6케이스의 판정 환경인 Windows CI(run `41363264661`) Test 단계 success | 3/3 |
| VP-06 | AR↔IT | REQUIRED | PASS | 구 경로 0 · S1 5/5 | 5/5 |
| VP-07 | AR↔IT | REQUIRED | **PAIR_FAIL** | ①② M003·M088·R2I·Z04·Z05 · ③ **M091·M092 잡음**·M090·Z07 · ④ D1 해소(F1) — **Z01 못 잡음(D6) · D7 회귀(F3·Z03)** | 3/4 |
| VP-19 | SD↔ST | REQUIRED | PASS | M036~M039·M089 · Claude 입력 항 M090~M092·Z07 | 6/6 |
| VP-02 | R↔AT | REQUIRED | PASS | M001·M002·M093 | 3/3 |
| VP-03 | R↔AT | REQUIRED | PASS | legacy 0 · `native-history.test.ts` missing·probe 케이스 green — r2 diff 밖 | 2/2 |
| VP-01 | R↔AT | REGRESSION | BLOCKED_BY:VP-07 | gate 전부 green이나 D7이 R-01(D-003) 반례 | 0(집계) |

- root `PAIR_FAIL`: VP-07(D6·D7). 종속: VP-01 → BLOCKED_BY VP-07.
- 실행 범위: r1 root 4(VP-07·11·14·16) · 종속 VP-01 · r2 diff가 닿은 VP-04·09·10·19 재판정, 나머지는 r1 좌표(O-01~O-19)를 실제 실행 집합으로 재확인 — 해당 r1 `잡음` 행 101건을 전부 재실행했다.
- 좌표의 실행 구간: R2-03은 실제 `Bootstrap.register`의 감시를 `check()`로 구동하고 경로 4조합·decoy를 구별 입력으로 준다. R2-06의 `composer-catalog` 좌표는 Linux 기준선 red라 Windows CI로만 판정, bootstrap 좌표가 Linux에서 M102·Z14·Z15를 잡는다.

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ❌ | gate 전부 green이나 D7이 기존 동작(설정 변경 시 서버 retire)을 바꿨다 |
| AC2 | ✅ | dead 33·test-only 45, 신규 `(name,kind,category)` 0 · S2 |
| AC3 | ✅ | `--absent` present 0, 미참조 56, 신규 0, CSS 토큰 0 |
| AC4 | ✅ | 사슬 검색 0 · session-resources 4파일(Linux 1케이스는 Windows 전용 이름, CI green) · doc-inventory OK |
| AC5 | ✅ | M103 잡음 7 · 직렬화 케이스 green |
| AC6 | ✅ | legacy 0 · 404→missing green |
| AC7 | ✅ | VP-09 변이 6 + Z10·Z11 잡음 |
| AC8 | ✅ | VP-10 변이 4(M102·M104 실측 정정) + Z14·Z15 잡음, Z16 동치 |
| AC9 | ✅ | 구 조립 0 · Windows CI green |
| AC10 | ✅ | config 1회·병렬 잠김 · 비Windows 루트 M101·Z10·Z11·Z17 잡음 |
| AC11 | ✅ | M001·M002·M093 잡음 |
| AC12 | ❌ | D1·D3 해소, 그러나 discovery hold가 경쟁 중 변경 통보를 잃는다(D7)·순서 불변식 미잠금(D6) |
| AC13 | ✅ | 구 파일 0 · S1 5/5 |
| AC14 | ✅ | 마크·색 맞바꿈 잡음 |
| AC15 | ✅ | 표시명 맞바꿈 잡음 |
| AC16 | ✅ | cwd 슬롯 12변이 잡음 |
| AC17 | ✅ | capability 7자리 잡음 |
| AC18 | ✅ | D2 해소(F2·R2I F2·Z06) · M106 |
| AC19 | ✅ | doc-inventory generated/prose/links OK, r2 문서 변경은 handoff만 |
| AC20 | ✅ | VP-15 변이 4 · DB 스위트 Node ABI green |
| AC21 | ✅ | D4 해소 — CRUD 4경로 M097~M100 · Z08·Z09 잡음 |
| AC22 | ✅ | M022·M105 |
| AC23 | ✅ | VP-18 변이 14 · journal golden green |

- 합계 재측정: ✅ 21 · ⚠️ 0 · ❌ 2 = 23. 자기보고 23/23 ✅ — 불일치(AC1·AC12).
- 사본 대조: plan r2 구현 보고 `✅ 23` ↔ `c6070f4` trailer `Criteria-Met: 23/23` ↔ INDEX 비고 `AC 23/23` — 세 사본은 서로 일치. `0fa04db` trailer `22/23`·`Status: partial`은 CI 전 사본이다.

### pair별 plan §10 강제 지점 분모

| Pair | §10 자리 목록 | 자리별 확인 | 목록 밖 발견 | 결과 |
|---|---|---|---|---|
| VP-07 | ① global watch ② project sync ③ Claude 전역 감시 ④ discovery hold (4) | ① M003·M088 · ② R2I D1-project·Z04·Z05 · ③ M090~M092·Z07 · ④ F1 해소, **Z01·Z03·F3 못 잡음** | 없음 | PAIR_FAIL(④) |
| VP-11 | #1~#4 (4) | #3 M101·Z10·Z11·Z17 잡음 | 없음 | PASS |
| VP-14 | #1~#3 (3) | #3 F2·R2I F2·Z06 잡음 | 없음 | PASS |
| VP-16 | #1~#11 (11) | #2 CRUD 4경로 전부 잡음 · Z08·Z09 | 없음 | PASS |
| 그 밖 15 pair | §10·ΔV1 표 그대로(합 187 중 위 4 pair 22) | §r2-5 표 | 없음 | PASS · VP-01 BLOCKED_BY |

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` 3구성 `error TS` 0 |
| eslint(무수정) | PASS | 1,978파일 0 error · warning 2(`Timeline.tsx:49`·`useTranscriptVirtualizer.ts:22`, r1과 같음) |
| vitest 차집합 | PASS(환경 분리) | §r2-9 — 신규 ID는 r1과 같은 ABI 2 + Windows 전용 5, Node ABI에서 ABI 2 green |
| scripts | PASS | `node --test scripts/*.test.mjs` 144/144 |
| migration·budget·doc-inventory | PASS | sync OK · 16 suites OK · generated/prose/links OK |
| CI | PASS | run `41363264661` head `0fa04db` windows-latest `gate` 전 단계 success(Migration·Doc inventory·Test budget·Lint·Typecheck·Test). 로그 끝 scripts 144/144 관측, vitest 집계 줄은 로그 아카이브 호스트가 egress 정책에 막혀 못 봤다 |
| message-bus | PASS | `0fa04db`·`c6070f4` trailer 파싱 5·6키(§r2-11) |

## r2-6. 외부 포트 / 문서 계약

- 변경 없음 — r2 diff에 IPC·문서 계약 변경 0(app 16파일, docs는 handoff만).

## r2-7. 숫자 / 음성 기준 / 상한 재측정

| 항목 | r1 HEAD(`0eb7dc2`) | r2 HEAD(`c6070f4`) |
|---|---|---|
| §10 기록 검색 47줄 | 목표값 | 같은 값 — `watchFile(` 1 · discovery `setInterval(` 0 · 고아 사슬 0 · prepare 16 |
| dead / test-only | 33 / 45 | 33 / 45 |
| i18n 키 / 미참조 | 1171 / 56 | 1171 / 56 |
| vitest 파일 / 케이스(Node ABI) | 891 / 8,281 | 894 / 8,300 — r2 신규 파일 3·케이스 19 전부 green |

## r2-8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| D6·D7 discovery 경쟁 | fs/promises mock·Date.now 고정으로 결정적 재현(재현 A·B, 각 3/3) | 없음 |
| D2 스크롤 | fake rAF 두 순서 재현 green | 실제 스트리밍 중 휠 확인은 선택 |

## r2-9. 게이트 재실행

- 환경: Linux · `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall Electron ABI rebuilt). 이후 `npm rebuild better-sqlite3`(Node ABI)·`node node_modules/electron/install.js` — 저장소 밖 `node_modules`만 바꿨다.
- vitest ① 기준선 환경(Electron ABI): 894파일 · 8,176케이스(통과 7,770 · 실패 311 · 건너뜀 95) · 실패 ID 340. 기준선 338과 차집합: 신규 7 = ABI 2(`native-history.db`·`session.load` 신규 케이스) + Windows 전용 5 · 사라짐 5 — r1과 같은 집합.
- vitest ② Node ABI + Electron 바이너리: 894파일 · 8,300케이스(통과 8,269 · 실패 22 · 건너뜀 9) → 기준선 대비 신규 5 = Windows 전용 5(`claude/native-resources.ts:39` win32 조건). 변이 판정의 무변이 실패 집합도 이 22건이다.
- 게이트가 트리를 바꿨는가: 없음 — 각 단계 뒤 `git status --short -- app` 빈 출력, 변이 러너·정적 스크립트·재현 매트릭스 모두 끝에서 `''`.
- 잔여물: `verify-evidence/r2/`(커밋 대상) 외 없음 — 재현 테스트는 실행 때만 app에 복사하고 지웠다.

## r2-10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트·변이·재현 | 에이전트 수행(§r2-4·§r2-9) |
| 제품 의도 / Open Question | 해당 없음 — D7 기대값은 D-003(구 코드 통보 1회)이 정한다 |
| PR merge | 사람 |

## r2-11. Repository operation checks

- AGENTS.md 변경: 없음(r2 diff 0).
- trailer: `0fa04db` 6키(`Agent: codex`·`Status: partial`·`Criteria-Met: 22/23`·`Criteria-Pending`·`Verified-By: pending`), `c6070f4` 5키(`Status: implemented`·`Criteria-Met: 23/23`) — `git log -1 --format='%(trailers:only=true)'` 파싱 확인, 허용값.
- 인용 해시: `ae103f3`·`a2e8464`·`291b721`·`4d308eb`·`00bb2a9`·`0eb7dc2`·`0fa04db`·`c6070f4` 모두 `git cat-file -t` = commit. 얕은 clone(50커밋)이라 plan 메타의 `0b3fdeae`는 이 환경에서 확인 불가.
- `[구현자 기입]` r2 7필드: 설계 리뷰·강제 지점 전수(19 pair·§10 수·`남긴 곳`)·잠금(분모 124 검산)·Product/UX·놓친 잠재 문제·구현 보고·Review Signals 전부 존재.
- INDEX: `impl/IMPL_DONE`·다음 주체 `Claude`·`(r2 구현 — 검증자 기입)` — 실제 상태와 일치, 비고 2줄. 이번 턴에 좌표를 기입한다.

## r2-12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 |
|---|---|
| R2-01a "갱신된 manifest를 옛 poll이 덮지 않음" | 가드의 목적은 타당하나 그 pass가 본 변경 통보까지 버린다(D7) — 근거 테스트는 합류 표시만 잰다 |
| R2-02a·R2-02b r1 Y12·Y14 기록이 Windows에서 green | 타당 — r1 측정 오류(기준선 red 계수) 확인, r2 러너로 실제 잡음 |
| "설계 대비 명시적 차이: 없음" | 타당 — 규범부 diff 0 |
| 정적 민감도 12/12 | S1 5건은 실제 lint로 타당, sweep 3건은 임시 파일 probe(N3) |

## r2-13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | discovery hold 전 변경 누락 | VP-07 ④ · D-003 | 해소 | F1 HEAD green·되돌림 red, R2I F1·Z12 잡음 |
| D2 | 대기 복원이 사용자 스크롤을 되돌림 | VP-14 #3 · D-003 | 해소 | F2 HEAD green·되돌림 red, Z06 잡음 |
| D3 | Claude 감시 파일 2항 미잠금 | VP-07 ③ | 해소 | M091·M092·Z07 잡음 |
| D4 | skills CRUD 3경로 미잠금 | VP-16 #2 | 해소 | M097·M098·M100·Z08·Z09 잡음 |
| D5 | 비동기 카탈로그 루트 분기 사본·미잠금 | VP-11 #3 | 해소 | M101·Z10·Z11·Z17 잡음 |
| D6 | D1 수정의 순서 불변식(probe stat → 내용 읽기)이 테스트에 잠기지 않음 — Z01 45케이스 green | VP-07 ④ | BLOCKING (PAIR_FAIL) | 재현 A를 회귀 테스트로 둔다 |
| D7 | 진행 중 poll pass가 본 변경을 동시 재로드가 있으면 holder에 통보하지 않음 — 구 코드·r1 1회, r2 0회 | VP-07 ④ · D-003 | BLOCKING (PAIR_FAIL) | 새 manifest를 지키되 그 pass의 통보는 유지, 재현 B를 회귀 테스트로 두고 가드(Z03)도 잠근다 |
| N1·N2 | r1 기록 | 비귀속 | NON_BLOCKING | 유지 |
| N3 | 구현자 정적 민감도 `VP04-ipc-sweep`·`VP08-symbol-sweep`·`VP08-token-sweep`이 임시 probe 파일만 검사 | VP-04·VP-08 증거 품질 | NON_BLOCKING | 검증자 S3·S2로 실제 트리 민감도 확인 — 다음 보고는 기록 명령을 실제 트리에 |

## r2-14. Review Signals — 사실만

- 이전 라운드와 유사 증상: D7은 r1 D1과 같은 실패 의미(설정 변경 뒤 서버 retire 누락)이고 같은 자리(VP-07 ④)다. D6은 D1 수정의 다른 지점이다.
- 관련 plan 지침: VP-07 `실패 의미`에 "누락", D-003 ACTIVE.
- 검증 측 사실: r1 러너는 무변이 실패를 빼지 않아 M102·M104를 잡음으로 잘못 적었다 — r2 구현자가 Windows 재실행에서 먼저 보고했다(R2-02a·b).
- 반복 환경 한계: CI 로그 아카이브 호스트가 egress 정책에 막혀 vitest 집계 줄을 직접 못 봤다.

## r2-15. 결론

- 상태: **FAIL** — 다음 주체 Codex(D-017), 라운드 3. verify 2회째(review 의무 3·6회째 아님).
- pair: REQUIRED/REGRESSION 19 중 PASS 17 · root PAIR_FAIL 1(VP-07) · BLOCKED_BY 1(VP-01). PLAN_GAP 0.
- ACTIVE Decision: D-003 위반 1건(D7), 나머지 충족.
- AC: ✅ 21 · ⚠️ 0 · ❌ 2(AC1·AC12).
- 운영 gate: 전부 green(환경 분리 포함).
- 다음 단계: 구현자가 D6·D7을 닫는다. 다음 verify는 이번 `못 잡음` 3행(Z01·Z03·F3)·`동치` 1행(Z16)과 `잡음` 행을 다시 실행한다.

---

# r3 재검증 (2026-11-02)

> r1·r2 본문(위)은 그대로 둔다. 재현 자료는 [`verify-evidence/r3/`](verify-evidence/r3/) — 변이 정의 생성기·정의·결과 JSON, 재현 테스트 2개(C·D), 버전 매트릭스 러너와 결과, 정적 재측정 로그, 표 생성기. 변이 러너는 r2의 [`mutate-r2.py`](verify-evidence/r2/mutate-r2.py)를 그대로 썼다.

## r3 메타

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-11-02 |
| 대상 커밋/range | `16acb8c..dc9f29b` — r3 구현 `feaca09`(코드·테스트) · `dc9f29b`(문서만, app 트리 = `feaca09`). 사이의 `64047af`·`3c50653`은 0292 문서 |
| 구현 전 plan 기준 | `16acb8c`(r2 verify) — 규범부 = `46b3784`(PR 해시 `a2e8464`) V1+ΔV1 |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1` |
| 라운드 | 3 (verify 3회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 구현 Codex(D-017), 검증 Claude. 구현 보고 밖 축 3건(재현 C=F4 · X06 · X07+재현 D)을 §r3-4에 넣었다 |

## r3-0. 기준선 / plan 변경 확인

- **판정: 기준선 성립, 규범 변경 0.** `16acb8c..dc9f29b`의 plan diff는 hunk 1개(`@@ -1091,6 +1091,157 @@`) — `## r3 구현 보완` 절 151줄 추가뿐이다.
- `[검증자 기입] 파생 이슈` 표는 r3에서 바뀌지 않았다 — D6·D7 상태 칸 `open (r2 verify)` 그대로.
- Decision·Product/UX·AC·V node/pair·§10 변경: 없음. 채점 기준은 V1+ΔV1 규범 행 원문(r1·r2와 같다).
- 좌표: plan 메타·이전 verify·INDEX가 적은 `ae103f3`·`a2e8464`·`291b721`…`4d308eb`·`0eb7dc2`·`0fa04db`·`c6070f4`는 PR 브랜치 커밋이고, `main`에는 rebase 병합된 다른 해시로 있다 — 대응표는 §r3-11.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 규범부 변경 0 — r1 판정 유지 |
| §10 자리 목록(기록 검색 재실행 차집합) | 유효 | [`ep-search.sh`](verify-evidence/ep-search.sh) 47줄을 `16acb8c`·HEAD 트리에서 재실행 — 두 출력 diff 0, 구현자 [`r3-ep-search.txt`](scan/r3-ep-search.txt)와도 같다 |
| r3 수정·D8·D9 자리의 목록 귀속 | 유효 | `discovery-cache.ts:164`·`:262-274` 모두 VP-07 ④ 고정 자리(hold 동안 의존 파일 stat 변화로 probe 구동) 안 |
| 선택 적대 증거·운영 gate | 유효 | r1 판정 유지 |

- root PLAN_GAP: 없음. D8·D9는 VP-07 계약("지문 변화마다 콜백 1회", 실패 의미 "중복 방송·누락")·AC12 안에서 구현자가 R3-03(새 의존 파일 보존)과 함께 맞출 수 있다 — 서로 모순된 기준이 아니다.

## r3-1. Product & UX / ACTIVE Decision

| Decision / 요구 | 기대 결과 | r3 판정 |
|---|---|---|
| D-003 관측 동작 보존 | 화면·대화 흐름 불변 | 충족 — D7 해소(설정 변경 뒤 서버 retire 1회). D8의 두 번째 통보는 소비자 콜백이 멱등이라 관측 차이를 찾지 못했다(§r3-2) |
| VP-07 ④ · AC12 "변경마다 1회" | holder 통보 1회 | **위반(D8)** — 편집 전 내용을 읽은 재로드가 진행 중 poll pass와 겹치면 2회 · **미잠금(D9)** — 재로드 뒤 감시 재설정 edge |
| D-005·D-006·D-007·D-008·D-012·D-015·D-016 | r1·r2 판정 | 유지 — r3 app diff는 2파일(`discovery-cache.ts` · 신규 `discovery-cache.poll-race.test.ts`) |

```text
설정 편집 ─┬ hold 감시(FingerprintWatch) → poll pass → holder 통보 → server.retire · instances.retire
           └ 전역/프로젝트 감시 dirty → invalidate() → run() 재로드 → observer manifest 교체 + watch(key) 재설정
편집 전 내용을 읽은 재로드가 pass 도중 끝나면: pass 1 통보(r3 분기) → pollRequested → pass 2가 낡은 manifest와 pass 1 probe를 비교해 다시 통보(D8)
```

## r3-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| D7 수정이 진행 중 pass가 본 변경을 통보하는가 | 성립 | `discovery-cache.ts:262-274` — manifest가 바뀌어도 `changed`면 통보. 재현 B HEAD green 3/3, D7 되돌림 red 3/3 |
| 새 manifest를 지키는 선택이 다른 실패 모드를 만들었는가 | **결함 D8** | 보존한 manifest가 편집 전 내용이면 다음 pass가 같은 변경을 다시 센다. 재현 C HEAD 통보 2회(3/3) · r2·r1·`a2e8464` 1회 |
| D6 순서 불변식이 잠겼는가 | 성립·잠김 | Z01 잡음 1/49(R3-01) · 재현 A HEAD green 3/3·Z01 red 3/3 |
| 재로드가 의존 파일을 바꾼 뒤의 감시 | 성립 · **미잠금(D9)** | `:164` `this.watch(key)` 삭제(X07)에 discovery 10파일 49케이스 green. 재현 D(실제 감시) HEAD green·X07 red 3/3 |
| D8의 production 트리거 | 실재 | D7과 같은 `invalidate()` 호출자(`bootstrap.ts:1250` 전역 감시 dirty · `project-settings.ts:43` 프로젝트 정책 dirty) + 다중 파일 load 도중 같은 파일의 연속 저장 |
| D8의 사용자 영향 | 미발견 | 콜백 `session-context.ts:508-512` 세 문장이 멱등 — `server.ts:218-220` 가드 · `session-context.ts:510` 가드 · `instance-lifecycle.ts:153-157` 플래그. 남는 것은 entry 재무효화·추가 pass |
| false success | 없음 | 새 오류 경로 없음 — 실패는 기존 `failed → poll` |
| poll 반복 worst-case | 유한 | manifest 교체마다 `pollRequested` 1회 — 재로드 수가 상한(r2와 같음) |

### D8 — 편집 전 내용을 읽은 재로드가 진행 중 poll pass와 겹치면 holder에 2회 통보한다

- 재현 C: [`discovery-cache.stale-reload-during-poll.verify.test.ts`](verify-evidence/r3/repro/discovery-cache.stale-reload-during-poll.verify.test.ts) — 재로드가 `a`(편집 전)를 읽고 멈춤 → `a` 편집 → poll pass가 새 `a` 읽기에서 대기 → 재로드 완료 → pass 재개 → 통보 1회 기대.
- 관측([`repro-matrix-r3.json`](verify-evidence/r3/repro-matrix-r3.json), 변형마다 3회): HEAD `expected "vi.fn()" to be called once, but got 2 times` 3/3, 실패 위치는 `await polling` 직후 단언(92행) — 겹친 poll 한 번 안에서 2회다.
- 대조: r2 `68b886b`·r1 `6eb0409`·`a2e8464`(0290 전)·HEAD+Z03 모두 green — r3 수정이 만든 순서다.
- 메커니즘: pass 1이 바뀐 manifest(`a` 편집 전 서명)를 보존한 채 통보하고 `pollRequested`(`:262-274`) → pass 2가 그 manifest를 pass 1 probe(`:41-47` 같은 지문 재사용)와 비교해 다시 통보(`:265-274`).
- 기존 스위트: r3 poll-race 4케이스는 재로드가 같은·더 최신·다른 파일을 읽는 순서만 다룬다 — 편집 전 내용을 읽는 형제 순서가 없다.

### D9 — 재로드가 바꾼 의존 파일로 감시를 다시 거는 edge가 잠기지 않는다

- 변이 X07: `run()`의 `this.watch(key)`(`discovery-cache.ts:164`) 삭제 → discovery 10파일 49케이스 전부 green.
- 재현 D: [`discovery-cache.reload-rewatch.verify.test.ts`](verify-evidence/r3/repro/discovery-cache.reload-rewatch.verify.test.ts) — hold 뒤 재로드가 다른 파일에 의존 → 그 파일 편집 → 실제 `watchFile`·타이머로 4초 안 통보 1회. HEAD·r2·r1·`a2e8464` green 3/3, HEAD+X07 red 3/3.
- R3-03 `new-file`이 이 edge를 닫지 못하는 이유: `watchFile`을 mock하고 `poll()`을 직접 불러, 새 파일 편집 → 감시 → poll edge가 실행 구간 밖이다(`discovery-cache.poll-race.test.ts:7-11`·`:98`).
- 이 edge는 r1부터 있었다(`6eb0409` `discovery-cache.ts:156`) — r1·r2 verify가 시도하지 않은 축이다. 0290 전 코드는 1초 주기 poll이 manifest를 직접 돌아 같은 동작을 냈다.

## r3-3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 16acb8c..dc9f29b` — 대상 1파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| 1a·1b 미사용 export | 없음 | 스크립트 출력 `(없음)` |
| 2 `OpenCodeDiscoveryCache` 테스트 전용 | 정상 | `test+local` — 파일 안 소비 `discovery-cache.ts:302`(r2와 같음) |
| 3 형제 정책 비대칭 | 없음 | 스크립트 출력 `(없음)` |
| 구현자 정적 민감도(N3) | 해소 | [`r3-static-sensitivity.json`](scan/r3-static-sensitivity.json) `after`가 실제 `ipc.ts:374`·`mcp-config.ts:6` — 검증자 S2·S3 재측정과 같은 방향 |

## r3-4. 기존 테스트 / semantic 검증

- **직전 `못 잡음` 3행 재실행: 3/3 잡음.** Z01 1/49(R3-01) · Z03 r3 형태 2/49(R3-03) · F3(재현 B HEAD green·D7 되돌림 red).
- **직전 `동치` 1행: Z16 동치 유지** 0/53 — 근거는 §r2-4와 같고 `adapter.ts` 등 해당 파일 r3 diff 0.
- **이전 라운드 `잡음` 재실행(덮개 회귀): 130/130 잡음 — red→green 0.** M 107 · R2I 5 · Z 13 · F1·F2 · S1~S3.
- **D7 인용 변이 C1(r2 조기 반환 복원): 잡음 3/49** — R3-02·R3-03 세 갈래.
- **검증자 축 3건: 잡음 1(X06 7/49) · 못 잡음 2(X07 · F4).**
- 구현자 보고 대조: [`r3-mutation-evidence.json`](scan/r3-mutation-evidence.json) 134 ID = CAUGHT 130 · GREEN 3 · EQUIVALENT 1 — 보고 문장(결함 131 = red 130 + 동치 1, 정상 재현 3)과 같다.
- 형제 갈래: r3 분기(manifest 바뀜 = 보존+통보 ↔ 그대로 = 교체+통보)는 Z03(바뀐 갈래도 교체 — 맞바꿈)·C1(바뀐 갈래 통보 제거)이 각각 red.

**고장 이력** — r3에서 시도한 고장 전부. `범위` = 실행한 테스트 파일 수, `이번 결과` = 무변이 실패 22건(Node ABI, [`clean-failed-ids-node.txt`](verify-evidence/r3/clean-failed-ids-node.txt) — r2와 같은 집합)을 뺀 실패 케이스/실행 케이스. 정의는 [`r3-verify-mutations.json`](verify-evidence/r3/r3-verify-mutations.json)([생성기](verify-evidence/r3/build-r3-mutations.py)), 결과·전체 실패명은 [`r3-mutation-rerun.json`](verify-evidence/r3/r3-mutation-rerun.json), 정적은 [`static-r3.log`](verify-evidence/r3/static-r3.log)(환경: Linux · Node ABI better-sqlite3 · Electron 바이너리).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 결과 | 이번 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M001 VP02-interval | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:92` | 호출 대체 | `window.addEventListener('focus', focus) → setInterval(() => void refresh(), 5000)⏎    w` | 1파일 | 잡음 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 등록(구현 목록) |
| M002 VP02-subscribe | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:87` | 제거 | `void refreshBackend(backend) → void backend` | 1파일 | 잡음 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 등록(구현 목록) |
| M003 VP07-comparison | `main/infra/config/fingerprint-watch.ts:85` | 제거 | `this.closed \|\| next === this.fingerprint → this.closed` | 2파일 | 잡음 | 잡음 2/5 | fingerprint-watch.test.ts — compares a supplied consumer baseline on | VP-07 등록(구현 목록) |
| M004 VP09-BOM | `main/infra/config/json-file.ts:15` | 제거 | `text.replace(/^\uFEFF/, '') → text` | 6파일 | 잡음 | 잡음 5/33 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록(구현 목록) |
| M005 VP09-missing-async | `main/infra/config/json-file.ts:40` | 고정값 | `text = await readFile(path, 'utf8')⏎  } catch → text = await readFile(path, 'utf8')⏎  } catch` | 6파일 | 잡음 | 잡음 15/33 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록(구현 목록) |
| M006 VP09-git | `main/adapters/common/git-root.ts:7` | 고정값 | `yield current → yield current⏎    return` | 4파일 | 잡음 | 잡음 4/20 | native-config-boundaries.test.ts — finds the Git root through the Claude pr | VP-09 등록(구현 목록) |
| M007 VP10-membership | `main/adapters/opencode/v1/adapter.ts:203` | 뒤집기 | `return active(item.managedSource, current) → return !active(item.managedSource, current)` | 1파일 | 잡음 | 잡음 1/26 | adapter.test.ts — projects disabled global MCP overrides a | VP-10 등록(구현 목록) |
| M008 VP10-choices | `main/adapters/opencode/v1/adapter.ts:174` | 뒤집기 | `[id, active(identity, current)] → [id, !active(identity, current)]` | 1파일 | 잡음 | 잡음 1/26 | adapter.test.ts — projects disabled global MCP overrides a | VP-10 등록(구현 목록) |
| M009 VP11-double-config | `main/adapters/opencode/v1/channel.ts:492` | 제거 | `openCodeNativePlugins(client, req.cwd, env, s → openCodeNativePlugins(client, req.cwd, env, s` | 1파일 | 잡음 | 잡음 1/1 | channel.native-resources.test.ts — shares one configuration read between pl | VP-11 등록(구현 목록) |
| M010 VP11-serial | `main/adapters/opencode/v1/native-resources.ts:27` | 뒤집기 | `client.app.skills({ directory }, options), → await client.app.skills({ directory }, option` | 1파일 | 잡음 | 잡음 1/6 | native-resources.test.ts — OpenCode native resources > starts skill | VP-11 등록(구현 목록) |
| M011 VP15-client-first | `main/adapters/opencode/v1/native-history.ts:185` | 뒤집기 | `let probeFailed = false → await deps.client(request)⏎    let probeFaile` | 1파일 | 잡음 | 잡음 4/35 | native-history.test.ts — skips SDK messages only when the committ | VP-15 등록(구현 목록) |
| M012 VP16-targets | `main/app/project-resource-sync.ts:179` | 제거 | `void this.apply(entry, runtimeTargets) → void this.apply(entry)` | 1파일 | 잡음 | 잡음 1/17 | project-resource-sync.test.ts — captures runtime targets once per stable | VP-16 등록(구현 목록) |
| M013 VP16-list | `main/app/handlers/skills.ts:46` | 호출 대체 | `listing ?? refresh() → refresh()` | 1파일 | 잡음 | 잡음 5/16 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 등록(구현 목록) |
| M014 VP16-parse | `main/adapters/claude/project-settings.ts:18` | 고정값 | `if (cached?.fingerprint === fingerprint) retu → if (false) return cached!.value` | 1파일 | 잡음 | 잡음 1/5 | project-settings.test.ts — parses shared native state once per file | VP-16 등록(구현 목록) |
| M015 VP16-candidate | `main/adapters/claude/native-history.ts:167` | 다른 값 | `offset (\+=\|\+) 16 → offset $1 1` | 1파일 | 잡음 | 잡음 1/16 | native-history.test.ts — Claude native history reads > bounds con | VP-16 등록(구현 목록) |
| M016 VP16-hash | `main/adapters/claude/native-history.ts:100` | 호출 대체 | `prefixRevision = hash.copy().digest('hex') → prefixRevision = createHash('sha256').update(` | 1파일 | 잡음 | 잡음 1/16 | native-history.test.ts — commits UTF-8 byte checkpoints, reuses c | VP-16 등록(구현 목록) |
| M017 VP16-skill-path | `main/app/skill-catalog.ts:66` | 호출 대체 | `path: await realpath(skill.skillPath).catch(( → path: await realpath(skill.skillPath).then(()` | 1파일 | 잡음 | 잡음 1/1 | skill-catalog.test.ts — assembles the real catalog from lock, ha | VP-16 등록(구현 목록) |
| M018 VP16-event-cap | `main/adapters/opencode/v1/map.ts:94` | 다른 값 | `if (event.id) this.seenEvents.add(event.id) → if (event.id) this.seenEvents.add(event.id)⏎ ` | 1파일 | 잡음 | 잡음 1/1 | map.replay.test.ts — ignores an old text delta replay after m | VP-16 등록(구현 목록) |
| M019 VP16-roots | `main/adapters/opencode/v1/native-resources.ts:62` | 호출 대체 | `skillRoots ??= openCodeSkillRoots(directory,  → skillRoots = openCodeSkillRoots(directory, en` | 1파일 | 잡음 | 잡음 1/6 | native-resources.test.ts — OpenCode native resources > classifies o | VP-16 등록(구현 목록) |
| M020 VP16-SSE | `main/adapters/opencode/v1/session-context.ts:383` | 호출 대체 | `subscriber.directory !== directory → nativePathKey(subscriber.directory) !== direc` | 1파일 | 잡음 | 잡음 1/15 | session-context.test.ts — OpenCode server context with the install | VP-16 등록(구현 목록) |
| M021 VP16-peek | `main/features/extensions/common/mcp/managed-source.ts:77` | 다른 값 | `peek: () => current → peek: () => ({ ...current, users: structuredC` | 1파일 | 잡음 | 잡음 1/2 | managed-source.test.ts — peeks at membership without cloning and  | VP-16 등록(구현 목록) |
| M022 VP17-memo | `renderer/src/features/chat/harnesses/opencode/rightpanel/tiles.tsx:28` | 빈 값 | `let model = inputs.get(backgroundKey) → let model = undefined as ReturnType<typeof se` | 1파일 | 잡음 | 잡음 1/1 | tiles.memo.test.ts — shares one projection across four compon | VP-17 등록(구현 목록) |
| M023 VP18-canonical-harness-config | `main/adapters/common/harness-config.ts:72` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 잡음 | 잡음 7/54 | harness-config.test.ts — env 우선순위 (AC15) > options.env 를 만들지 않는 턴 | VP-18 등록(구현 목록) |
| M024 VP18-canonical-background-task-queries | `main/infra/db/background-task-queries.ts:13` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 잡음 | 잡음 1/1 | background-journal-key.test.ts — preserves persisted journal keys across  | VP-18 등록(구현 목록) |
| M025 VP18-canonical-composer-catalog | `main/app/composer-catalog.ts:46` | 호출 대체 | `canonicalJson( → JSON.stringify(` | 1파일 | 잡음 | 잡음 1/8 | composer-catalog.test.ts — shares preparation identity for reordere | VP-18 등록(구현 목록) |
| M026 VP18-variant-settings | `main/adapters/opencode/v1/settings.ts:84` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 잡음 | 잡음 2/5 | settings.test.ts — OpenCode native model catalogs > uses na | VP-18 등록(구현 목록) |
| M027 VP18-variant-model-listing | `main/adapters/opencode/v1/model-listing.ts:29` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 잡음 | 잡음 1/6 | model-listing.test.ts — parseOpenCodeModelListing (0291 MD-02) > | VP-18 등록(구현 목록) |
| M028 VP18-variant-composer-catalog | `main/adapters/opencode/v1/composer-catalog.ts:42` | 호출 대체 | `enabledVariantNames\(([^()]+)\) → Object.keys($1 ?? {})` | 1파일 | 잡음 | 잡음 1/2 | composer-catalog.test.ts — reads plugin-resolved primary agents and | VP-18 등록(구현 목록) |
| M029 VP18-version | `main/adapters/opencode/v1/server.ts:165` | 다른 값 | `['--version'] → ['-v']` | 1파일 | 잡음 | 잡음 1/1 | server.cli.test.ts — probes the installed version through the | VP-18 등록(구현 목록) |
| M030 VP18-db-path | `main/adapters/opencode/v1/server.ts:425` | 다른 값 | `['db', 'path'] → ['db', 'wrong']` | 1파일 | 잡음 | 잡음 1/1 | server.database-path.test.ts — OpenCode native database path (0262 EP56 | VP-18 등록(구현 목록) |
| M031 VP18-auth-plugin | `main/features/auth/runtime.ts:268` | 맞바꿈 | `snapshot: () => loginFreeSnapshot(authId) → snapshot: () => (connections.has(authId) ? al` | 1파일 | 잡음 | 잡음 6/26 | login-free.test.ts — 로그인 프리 런타임 — lifecycle 분리 (0248 AC4·AC8· | VP-18 등록(구현 목록) |
| M032 VP18-auth-runtime | `main/features/auth/runtime.ts:317` | 맞바꿈 | `return loginFreeSnapshot(authId) → return (connections.has(authId) ? alwaysConne` | 1파일 | 잡음 | 잡음 2/26 | login-free.test.ts — 로그인 프리 호스트 연결 — 런타임 경유 (0291) > snapshot | VP-18 등록(구현 목록) |
| M033 VP18-connection-list | `main/app/connection-views.ts:86` | 다른 값 | `providerConnectionInfo(snapshot.connection) → ({ ...providerConnectionInfo(snapshot.connect` | 1파일 | 잡음 | 잡음 1/12 | connection-views.test.ts — host connection (0291) > carries connect | VP-18 등록(구현 목록) |
| M034 VP18-connection-handler | `main/app/handlers/providers.ts:83` | 다른 값 | `return providerConnectionInfo(status) → return { ...providerConnectionInfo(status), m` | 1파일 | 잡음 | 잡음 1/4 | providers.test.ts — registerConnectionHandlers > connect는 최종 | VP-18 등록(구현 목록) |
| M035 VP18-skill-order | `renderer/src/features/chat/lib/attachMenuModel.ts:100` | 뒤집기 | `skillGroups.unshift(next) → skillGroups.push(next)` | 1파일 | 잡음 | 잡음 1/20 | attachMenuModel.test.ts — buildAttachMenu > merges groups that sha | VP-18 등록(구현 목록) |
| M036 VP19-bootstrap-opencode | `main/app/bootstrap.ts:1257` | 빈 값 | `broadcastExtensionsChanged({ backend: 'openco → undefined` | 1파일 | 잡음 | 잡음 1/22 | bootstrap.native-history.test.ts — broadcasts each OpenCode plugin revision | VP-19 등록(구현 목록) |
| M037 VP19-bootstrap-claude | `main/app/bootstrap.ts:1275` | 빈 값 | `broadcastExtensionsChanged({ backend: 'claude → undefined` | 1파일 | 잡음 | 잡음 5/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-19 등록(구현 목록) |
| M038 VP19-preload | `preload/index.ts:281` | 빈 값 | `subscribe(CHANNELS.extensionsChanged, handler → (() => undefined)` | 1파일 | 잡음 | 잡음 1/29 | index.test.ts — forwards backend extension changes throu | VP-19 등록(구현 목록) |
| M039 VP19-api | `renderer/src/shared/api/ipc.ts:238` | 빈 값 | `globalThis.window?.orca?.session?.onExtension → undefined` | 1파일 | 잡음 | 잡음 1/29 | index.test.ts — forwards backend extension changes throu | VP-19 등록(구현 목록) |
| M040 VP15-whole-delete | `main/infra/db/native-history-queries.ts:88` | 고정값 | `AND native_id NOT IN (SELECT value FROM json_ → AND length(?) >= 0` | 1파일 | 잡음 | 잡음 1/15 | native-history.db.test.ts — native history with the migrated SQLite  | VP-15 등록(구현 목록) |
| M041 VP16-identity | `main/adapters/opencode/v1/server-profile.ts:51` | 호출 대체 | `profileComponents(executableIdentity, cwd, en → profileComponents(openCodeExecutableIdentity(` | 1파일 | 잡음 | 잡음 1/1 | server-profile.test.ts — computes executable identity once and de | VP-16 등록(구현 목록) |
| M042 VP16-defaults | `main/adapters/claude/plugin-catalog.ts:26` | 호출 대체 | `const defaults = pluginDefaults(readObject(jo → readClaudePluginCatalog(process.cwd(), native` | 1파일 | 잡음 | 잡음 1/8 | plugin-catalog.test.ts — native plugin catalog > reads defaults f | VP-16 등록(구현 목록) |
| M043 VP12-mark | `renderer/src/shared/ui/HarnessLogo.tsx:16` | 뒤집기 | `backend === 'claude' ? ( → backend !== 'claude' ? (` | 1파일 | 잡음 | 잡음 2/2 | HarnessLogo.render.test.ts — preserves claude artwork and default or  | VP-12 등록(구현 목록) |
| M044 VP12-color | `renderer/src/shared/ui/HarnessLogo.tsx:14` | 맞바꿈 | `backend === 'claude' ? 'text-spinner' : 'text → backend === 'claude' ? 'text-oc-ink' : 'text-` | 1파일 | 잡음 | 잡음 2/2 | HarnessLogo.render.test.ts — preserves claude artwork and default or  | VP-12 등록(구현 목록) |
| M045 VP12-engine | `renderer/src/features/engine/common/components/EngineCard.tsx:30` | 맞바꿈 | `backend={agent.adapter} → backend={agent.adapter === 'claude' ? 'openco` | 1파일 | 잡음 | 잡음 2/3 | EngineCard.render.test.ts — preserves the claude card label and edit | VP-12 등록(구현 목록) |
| M046 VP12-engine-menu | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:101` | 맞바꿈 | `backend={engine} → backend={engine === 'claude' ? 'opencode' : '` | 1파일 | 잡음 | 잡음 1/1 | AgentEnvironmentView.interaction.test.ts — selects Claude or OpenCode before openin | VP-12 등록(구현 목록) |
| M047 VP12-source-claude | `renderer/src/features/skills/components/customize/SourceHeading.tsx:20` | 맞바꿈 | `backend="claude" → backend="opencode"` | 1파일 | 잡음 | 잡음 1/2 | SourceHeading.render.test.ts — preserves the native:claude source mark  | VP-12 등록(구현 목록) |
| M048 VP12-source-opencode | `renderer/src/features/skills/components/customize/SourceHeading.tsx:22` | 맞바꿈 | `backend="opencode" → backend="claude"` | 1파일 | 잡음 | 잡음 1/2 | SourceHeading.render.test.ts — preserves the native:opencode source mar | VP-12 등록(구현 목록) |
| M049 VP12-agent-toggle | `renderer/src/features/chat/components/AgentModeToggle.tsx:57` | 맞바꿈 | `backend="claude" → backend="opencode"` | 1파일 | 잡음 | 잡음 2/5 | AgentModeToggle.test.ts — actual draft mode toggle > places the wo | VP-12 등록(구현 목록) |
| M050 VP12-model-menu | `renderer/src/features/chat/components/composer/ModelMenu.tsx:46` | 맞바꿈 | `backend={agent.adapter} → backend={agent.adapter === 'claude' ? 'openco` | 1파일 | 잡음 | 잡음 2/9 | modelMenu0215.render.test.ts — preserves the claude provider heading br | VP-12 등록(구현 목록) |
| M051 VP12-composer-icon | `renderer/src/features/chat/harnesses/registries/composer.ts:20` | 맞바꿈 | `backend: sourceBackend → backend: sourceBackend === 'claude' ? 'openco` | 1파일 | 잡음 | 잡음 2/3 | brand-surfaces.test.ts — carries each source brand through the cl | VP-12 등록(구현 목록) |
| M052 VP12-sidebar | `renderer/src/app/SidebarUserButton.tsx:137` | 맞바꿈 | `backend={backend} → backend={backend === 'claude' ? 'opencode' : ` | 1파일 | 잡음 | 잡음 1/1 | SidebarUserButton.brand.test.ts — passes each settings brand with the orig | VP-12 등록(구현 목록) |
| M053 VP13-claude-variant | `renderer/src/features/chat/harnesses/claude/surfaces.ts:11` | 맞바꿈 | `variant: 'outlined' → variant: 'flat'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M054 VP13-claude-chipVariant | `renderer/src/features/chat/harnesses/claude/surfaces.ts:12` | 맞바꿈 | `chipVariant: 'segment' → chipVariant: 'flat'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M055 VP13-claude-showChevron | `renderer/src/features/chat/harnesses/claude/surfaces.ts:13` | 맞바꿈 | `showChevron: false → showChevron: true` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M056 VP13-claude-trailingDivider | `renderer/src/features/chat/harnesses/claude/surfaces.ts:14` | 맞바꿈 | `trailingDivider: true → trailingDivider: false` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M057 VP13-claude-contextRow | `renderer/src/features/chat/harnesses/claude/surfaces.ts:15` | 맞바꿈 | `contextRow: landingFrame.contextRow → contextRow: ''` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M058 VP13-claude-chipGroup | `renderer/src/features/chat/harnesses/claude/surfaces.ts:16` | 맞바꿈 | `chipGroup: chipGroupSurface → chipGroup: 'inline-flex h-7 max-w-full items-` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for defau | VP-13 등록(구현 목록) |
| M059 VP13-claude-landing | `renderer/src/features/chat/harnesses/claude/landing/presentation.ts:6` | 맞바꿈 | `contextLayout: 'inline' → contextLayout: 'below'` | 1파일 | 잡음 | 잡음 1/3 | brand-surfaces.test.ts — keeps the context location in the landin | VP-13 등록(구현 목록) |
| M060 VP13-opencode-variant | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:9` | 맞바꿈 | `variant: 'flat' → variant: 'outlined'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M061 VP13-opencode-chipVariant | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:10` | 맞바꿈 | `chipVariant: 'flat' → chipVariant: 'segment'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M062 VP13-opencode-showChevron | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:11` | 맞바꿈 | `showChevron: true → showChevron: false` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M063 VP13-opencode-trailingDivider | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:12` | 맞바꿈 | `trailingDivider: false → trailingDivider: true` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M064 VP13-opencode-contextRow | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:13` | 다른 값 | `contextRow: '' → contextRow: 'gap-g3'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M065 VP13-opencode-chipGroup | `renderer/src/features/chat/harnesses/opencode/surfaces.ts:14` | 다른 값 | `chipGroup: 'inline-flex h-7 max-w-full items- → chipGroup: 'border'` | 1파일 | 잡음 | 잡음 1/2 | CwdPanel.surface.test.ts — preserves every rendered class for openc | VP-13 등록(구현 목록) |
| M066 VP13-opencode-landing | `renderer/src/features/chat/harnesses/opencode/landing/presentation.ts:6` | 맞바꿈 | `contextLayout: 'below' → contextLayout: 'inline'` | 1파일 | 잡음 | 잡음 1/3 | brand-surfaces.test.ts — keeps the context location in the landin | VP-13 등록(구현 목록) |
| M067 VP13-seed-kind | `renderer/src/features/chat/store/chatStore.ts:200` | 뒤집기 | `supportsAgentKind(landingBackend, entry.sessi → !supportsAgentKind(landingBackend, entry.sess` | 1파일 | 잡음 | 잡음 2/12 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M068 VP13-fresh-kind | `renderer/src/features/chat/store/chatStore.ts:255` | 뒤집기 | `!supportsAgentKind(landingBackend, landingAge → supportsAgentKind(landingBackend, landingAgen` | 1파일 | 잡음 | 잡음 2/12 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M069 VP13-handoff | `renderer/src/features/chat/store/chatStore.ts:1566` | 제거 | `sessionBusy\(src\) \\|\\|\s*src\.loadingSessi → sessionBusy(src) \|\| src.loadingSession \|\|` | 2파일 | 잡음 | 잡음 4/70 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록(구현 목록) |
| M070 VP13-open-subagent | `renderer/src/features/chat/store/chatStore.ts:2108` | 맞바꿈 | `.subagentTile === 'task' → .subagentTile === 'subagent'` | 2파일 | 잡음 | 잡음 1/9 | chatStore.panelTiles.test.ts — OpenCode independent panel state > keeps | VP-13 등록(구현 목록) |
| M071 VP13-reducer-subagent | `renderer/src/features/chat/reducer/chatReducer.ts:1996` | 맞바꿈 | `HARNESS_CAPABILITIES[state.backend ?? 'claude → HARNESS_CAPABILITIES[state.backend === 'claud` | 2파일 | 잡음 | 잡음 1/40 | chatReducer.harness.test.ts — harness identity and panel enforcement > | VP-13 등록(구현 목록) |
| M072 VP13-permissions | `renderer/src/features/chat/reducer/chatReducer.ts:1653` | 뒤집기 | `HARNESS_CAPABILITIES[backend].permissionModes → !HARNESS_CAPABILITIES[backend].permissionMode` | 2파일 | 잡음 | 잡음 2/37 | chatReducer.harness.test.ts — harness identity and panel enforcement > | VP-13 등록(구현 목록) |
| M073 VP13-composer-frame | `renderer/src/features/chat/components/Composer.tsx:234` | 뒤집기 | `contextLayout === 'below' && contextBelow ? l → contextLayout !== 'below' && contextBelow ? l` | 1파일 | 잡음 | 잡음 1/5 | NewChatLandingPage.harness.test.ts — shares the landing frame and hero slot a | VP-13 등록(구현 목록) |
| M074 VP13-composer-inline | `renderer/src/features/chat/components/Composer.tsx:255` | 뒤집기 | `showLandingCwdPanel && !(contextLayout === 'b → showLandingCwdPanel && (contextLayout === 'be` | 1파일 | 잡음 | 잡음 1/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M075 VP13-composer-below | `renderer/src/features/chat/components/Composer.tsx:407` | 뒤집기 | `showLandingCwdPanel && contextLayout === 'bel → showLandingCwdPanel && contextLayout !== 'bel` | 1파일 | 잡음 | 잡음 3/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M076 VP13-landing-forward | `renderer/src/features/chat/components/Landing.tsx:27` | 다른 값 | `{...presentation.composer} → {...presentation.composer} contextLayout='inl` | 1파일 | 잡음 | 잡음 2/5 | NewChatLandingPage.harness.test.ts — new conversation harness layout > render | VP-13 등록(구현 목록) |
| M077 VP12-label-copy | `renderer/src/features/chat/components/ChatTitleBar.tsx:115` | 맞바꿈 | `HARNESS_CAPABILITIES[conversationBackend ?? ' → HARNESS_CAPABILITIES[conversationBackend === ` | 1파일 | 잡음 | 잡음 2/3 | ChatTitleBar.copy.test.ts — copies the claude conversation with its  | VP-12 등록(구현 목록) |
| M078 VP12-label-engine | `renderer/src/features/engine/common/components/AgentEnvironmentView.tsx:102` | 맞바꿈 | `HARNESS_CAPABILITIES[engine].shortLabel → HARNESS_CAPABILITIES[engine === 'claude' ? 'o` | 1파일 | 잡음 | 잡음 1/1 | AgentEnvironmentView.interaction.test.ts — selects Claude or OpenCode before openin | VP-12 등록(구현 목록) |
| M079 VP12-label-source | `shared/extension-sources.ts:6` | 맞바꿈 | `HARNESS_CAPABILITIES[backend].shortLabel → HARNESS_CAPABILITIES[backend === 'claude' ? '` | 2파일 | 잡음 | 잡음 5/25 | attachMenuModel.test.ts — buildAttachMenu > merges groups that sha | VP-12 등록(구현 목록) |
| M080 VP12-plan-hint-claude | `renderer/src/features/chat/harnesses/claude/rightpanel/tileRegistry.ts:15` | 맞바꿈 | `selectHintKey: harnessCatalog('claude') → selectHintKey: harnessCatalog('opencode')` | 1파일 | 잡음 | 잡음 2/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록(구현 목록) |
| M081 VP12-plan-hint-opencode | `renderer/src/features/chat/harnesses/opencode/rightpanel/tileRegistry.ts:20` | 맞바꿈 | `selectHintKey: harnessCatalog('opencode') → selectHintKey: harnessCatalog('claude')` | 1파일 | 잡음 | 잡음 2/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록(구현 목록) |
| M082 R-VP09-missing-sync-all | `main/infra/config/json-file.ts:28` | 고정값 | `if ((error as NodeJS.ErrnoException).code === → if (false) return {}` | 6파일 | 잡음 | 잡음 22/33 | native-config-boundaries.test.ts — carries BOM JSON through configured Clau | VP-09 등록 재지정 |
| M083 R-VP09-missing-sync-only | `main/infra/config/json-file.ts:28` | 고정값 | `if ((error as NodeJS.ErrnoException).code === → if (false) return {}` | 6파일 | 잡음 | 잡음 12/33 | native-config-boundaries.test.ts — carries BOM JSON through synchronous and | VP-09 등록 재지정 |
| M084 R-VP18-plugin-order-native | `renderer/src/features/chat/lib/attachMenuModel.ts:182` | 뒤집기 | `pluginItems.push( → pluginItems.unshift(` | 2파일 | 잡음 | 잡음 4/35 | attachMenuModel.test.ts — buildAttachMenu > puts the Orcinus orca  | VP-18 등록 재지정 |
| M085 R-VP13-fork-only | `renderer/src/features/chat/store/chatStore.ts:1513` | 뒤집기 | `!HARNESS_CAPABILITIES[src.backend ?? 'claude' → HARNESS_CAPABILITIES[src.backend ?? 'claude']` | 2파일 | 잡음 | 잡음 6/70 | chatStore.harness.test.ts — remembered harness and request routing > | VP-13 등록 재지정 |
| M086 R-VP12-plan-claude-desc | `renderer/src/features/chat/harnesses/claude/rightpanel/tileRegistry.ts:14` | 맞바꿈 | `harnessCatalog('claude') → harnessCatalog('opencode')` | 1파일 | 잡음 | 잡음 1/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록 재지정 |
| M087 R-VP12-plan-opencode-desc | `renderer/src/features/chat/harnesses/opencode/rightpanel/tileRegistry.ts:19` | 맞바꿈 | `harnessCatalog('opencode') → harnessCatalog('claude')` | 1파일 | 잡음 | 잡음 1/9 | plan0215.render.test.ts — PlanTileContent — 본문 미해소 표시 (AT-03 · D-0 | VP-12 등록 재지정 |
| M088 Y01-VP07-revision-sibling | `main/app/harnesses/opencode/global-watch.ts:29` | 고정값 | `if (current !== previous) { → if (true) {` | 2파일 | 잡음 | 잡음 1/25 | bootstrap.native-history.test.ts — broadcasts each OpenCode plugin revision | VP-07 재량(검증자 축) |
| M089 Y02-VP19-claude-close | `main/app/bootstrap.ts:945` | 제거 | `this.claudeGlobalWatch?.close() → ∅` | 1파일 | 잡음 | 잡음 5/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-19 재량(검증자 축) |
| M090 Y03-VP07-claude-settings-file | `main/app/bootstrap.ts:1269` | 제거 | `nativeClaude.settings, → ∅` | 1파일 | 잡음 | 잡음 1/22 | bootstrap.native-history.test.ts — broadcasts Claude global changes only on | VP-07 재량(검증자 축) |
| M091 Y04-VP07-claude-installed-file | `main/app/bootstrap.ts:1270` | 제거 | `join(nativeClaude.root, 'plugins', 'installed → ∅` | 1파일 | 잡음 | 잡음 2/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-07 재량(검증자 축) |
| M092 Y05-VP07-claude-state-path-swap | `main/app/bootstrap.ts:1272` | 맞바꿈 | `? join(nativeClaude.root, '.claude.json')⏎    → ? join(homedir(), '.claude.json')⏎          :` | 1파일 | 잡음 | 잡음 4/22 | bootstrap.native-history.test.ts — broadcasts Claude true config / installe | VP-07 재량(검증자 축) |
| M093 Y06-VP02-toggle-pending | `renderer/src/features/skills/hooks/useNativeMcpCatalog.ts:147` | 제거 | `if (pending.current.has(backend)) void refres → ∅` | 1파일 | 잡음 | 잡음 1/11 | useNativeMcpCatalog.test.ts — refreshes on backend push and focus, coa | VP-02 재량(검증자 축) |
| M094 Y07-VP15-cold-recovery-bypass | `main/app/chat-turn/native-session.ts:46` | 제거 | `recovery && !recovery.accepted ? undefined :  → readNativeHistoryPrevious(db, request.session` | 1파일 | 잡음 | 잡음 1/12 | native-session.test.ts — native retention recovery through the mi | VP-15 재량(검증자 축) |
| M095 Y08-VP15-handler-snapshot | `main/app/handlers/session.ts:95` | 빈 값 | `sync.snapshot → undefined` | 1파일 | 잡음 | 잡음 1/11 | session.load.test.ts — session load IPC refreshes native histor | VP-15 재량(검증자 축) |
| M096 Y09-VP16-skills-generation | `main/app/bootstrap.ts:296` | 제거 | `if (revision === this.skillsRevision) this.sk → this.skillsCache = skills` | 1파일 | 잡음 | 잡음 1/22 | bootstrap.native-history.test.ts — keeps the newer skill scan in the cache  | VP-16 재량(검증자 축) |
| M097 Y10-VP16-author-joins-stale | `main/app/handlers/skills.ts:49` | 호출 대체 | `await writeAuthoredSkill(req)⏎    await ctx.d → await writeAuthoredSkill(req)⏎    await ctx.d` | 1파일 | 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 재량(검증자 축) |
| M098 Y10b-VP16-upload-joins-stale | `main/app/handlers/skills.ts:57` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:u | VP-16 재량(검증자 축) |
| M099 Y10c-VP16-setEnabled-joins-stale | `main/app/handlers/skills.ts:76` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 잡음 | 잡음 2/16 | skills.test.ts — catalog skill target IPC > orca:skills:s | VP-16 재량(검증자 축) |
| M100 Y10d-VP16-remove-joins-stale | `main/app/handlers/skills.ts:97` | 호출 대체 | `return refresh() → return listing ?? refresh()` | 1파일 | 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:r | VP-16 재량(검증자 축) |
| M101 Y11-VP11-async-project-root | `main/adapters/claude/plugin-catalog.ts:321` | 호출 대체 | `const projectRoot = await claudeLocalSettings → const projectRoot = resolve(cwd)` | 3파일 | 잡음 | 잡음 1/16 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 재량(검증자 축) |
| M102 Y12-VP10-binding-project | `main/app/session-binding.ts:10` | 고정값 | `current.project_id === expected.project_id → true` | 5파일 | 잡음 | 잡음 1/49 | bootstrap.native-history.test.ts — reads native configuration through the r | VP-10 재량(검증자 축) |
| M103 Y13-VP04-serialize | `main/app/project-resource-sync.ts:72` | 제거 | `(this.mutations.get(key) ?? Promise.resolve() → Promise.resolve()` | 1파일 | 잡음 | 잡음 7/17 | project-resource-sync.test.ts — holds watcher broadcasts behind an in-fl | VP-04 재량(검증자 축) |
| M104 Y14-VP10-dispose-report | `main/adapters/opencode/v1/adapter.ts:223` | 제거 | `releasing ??= lease.release().catch(reportDis → releasing ??= lease.release().catch(() => und` | 2파일 | 잡음 | 잡음 1/53 | adapter.persistent.test.ts — OpenCode persistent SDK channel > report | VP-10 재량(검증자 축) |
| M105 Y15-VP17-reduced-motion | `renderer/src/shared/hooks/useReducedMotion.ts:12` | 뒤집기 | `setReduced(query.matches) → setReduced(!query.matches)` | 1파일 | 잡음 | 잡음 1/1 | useReducedMotion.test.ts — reads the motion preference, follows cha | VP-17 재량(검증자 축) |
| M106 Y16-VP14-row-remove | `renderer/src/features/engine/harnesses/opencode/ProviderForm.tsx:101` | 고정값 | `disabled={rows.length <= 1} → disabled={false}` | 1파일 | 잡음 | 잡음 1/10 | ProviderForm.interaction.test.ts — OpenCode provider form through productio | VP-14 재량(검증자 축) |
| M107 Y17-VP09-flag-array | `main/adapters/claude/plugin-flag.ts:4` | 제거 | `value === true \|\| Array.isArray(value) \|\| → value === true \|\| isRecord(value)` | 3파일 | 잡음 | 잡음 1/27 | project-reconciliation.test.ts — projects native plugin flag undefined du | VP-09 재량(검증자 축) |
| S1 VP06-ownership | `main/app/harnesses/common/contracts.ts:43` | 다른 값 | 공통 모듈에 이동 모듈 5종 import를 하나씩 추가 | eslint 1파일 | 잡음 | 잡음 5/5 — 각 `harness/ownership` error 1 | `harness/ownership` | VP-06 등록 |
| S2 VP08-dead | `renderer/src/features/chat/lib/parts.ts` 끝 | 다른 값 | 삭제한 `partsStructured` export 복원 | 스캐너 | 잡음 | 잡음 dead 33→34, 신규 행 1 | `scan/dead-exports.cjs` | VP-08 등록 |
| S3 VP04-sweep | `renderer/src/shared/api/ipc.ts` 끝 | 다른 값 | `openNativePlugin` 토큰 복원 | rg | 잡음 | 잡음 0→1 | VP-04 기록 검색(G) | VP-04 등록 |
| F1 D1-hold-race | `main/adapters/opencode/v1/discovery-cache.ts:229` | 회귀 재현 | r1 재현 V1·V2를 HEAD에서 실행 + D1 수정(`initialFingerprint`) 되돌림 | 1파일 | 잡음 | 잡음 — HEAD green 2/2 · 되돌림 red 1/2 | discovery-cache.hold-race.verify.test.ts — V1: notifies a holder about a dependency | VP-07 ④ · D1 |
| F2 D2-scroll-race | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:171` | 회귀 재현 | r1 재현을 HEAD에서 실행 + 가드 되돌림 | 1파일 | 잡음 | 잡음 — HEAD green 1/1 · 되돌림 red 1/1 | ScrollController.restore-race.verify.test.ts — VERIFY: keeps a user scroll that lands w | VP-14 #3 · D2 |
| R2I F1-D1-loaded-baseline | `main/adapters/opencode/v1/discovery-cache.ts:229` | 제거 | `initialFingerprint: JSON.stringify(dependenci → ∅` | 1파일 | 잡음 | 잡음 2/3 | discovery-cache.hold-race.test.ts — notifies once about a dependency changed | D1 인용(구현자 정의) |
| R2I F2-D2-scroll-order | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:171` | 제거 | `captureFrame.current === null && state.anchor → state.anchor` | 1파일 | 잡음 | 잡음 1/2 | ScrollController.restore-race.test.ts — preserves the latest user scroll with re | D2 인용(구현자 정의) |
| R2I D1-project-baseline-order | `main/app/project-resource-sync.ts:208` | 호출 대체 | `await entry.watching → void entry.watching` | 1파일 | 잡음 | 잡음 1/1 | project-resource-sync.initialization.test.ts — establishes the watcher baseline before  | D1 보완 oracle(구현자 정의) |
| R2I D1-startup-check | `main/infra/config/fingerprint-watch.ts:70` | 제거 | `if (deps.initialFingerprint !== undefined) sc → ∅` | 1파일 | 잡음 | 잡음 1/2 | fingerprint-watch.test.ts — compares a supplied consumer baseline on | D1 보완 oracle(구현자 정의) |
| R2I D1-pending-scope-check | `main/adapters/opencode/v1/discovery-cache.ts:276` | 고정값 | `} while (this.pollRequested) → } while (false)` | 1파일 | 잡음 | 잡음 1/7 | discovery-cache.test.ts — rechecks a newly held scope when its sta | D1 보완 oracle(구현자 정의) |
| Z01 VP07-4-probe-stat-after-load | `main/adapters/opencode/v1/discovery-cache.ts:53` | 뒤집기 | `(value) => ({ value, signature: hash(describe → async (value) => ({ value, signature: hash(de` | 10파일 | 못 잡음 | 잡음 1/49 | discovery-cache.poll-race.test.ts — notifies an edit made after the content  | VP-07 ④ 재량(검증자 축) |
| Z02 VP07-4-poll-join-flag | `main/adapters/opencode/v1/discovery-cache.ts:243` | 제거 | `poll(): Promise<void> {⏎    this.pollRequeste → poll(): Promise<void> {` | 10파일 | 잡음 | 잡음 1/49 | discovery-cache.test.ts — rechecks a newly held scope when its sta | VP-07 ④ 재량(검증자 축) |
| Z03 VP07-4-stale-manifest-guard | `main/adapters/opencode/v1/discovery-cache.ts:265` | 제거 | `} else if (changed) {⏎ observer.dependencies = next⏎ } → }⏎ if (changed) observer.dependencies = next`(r3 형태) | 10파일 | 못 잡음 | 잡음 2/49 | discovery-cache.poll-race.test.ts — notifies an overlapping reload once and  | VP-07 ④ 재량(검증자 축) |
| Z04 VP07-2-ready-collect | `main/app/project-resource-sync.ts:173` | 제거 | `ready.push(watcher.ready) → ∅` | 7파일 | 잡음 | 잡음 1/47 | project-resource-sync.initialization.test.ts — establishes the watcher baseline before  | VP-07 ② 재량(검증자 축) |
| Z05 VP07-2-ready-early | `main/infra/config/fingerprint-watch.ts:53` | 호출 대체 | `this.ready = this.tail = ( → this.ready = Promise.resolve(); this.tail = (` | 7파일 | 잡음 | 잡음 1/47 | project-resource-sync.initialization.test.ts — establishes the watcher baseline before  | VP-07 ② 재량(검증자 축) |
| Z06 VP14-3-guard-flip | `renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx:171` | 뒤집기 | `captureFrame.current === null && state.anchor → captureFrame.current !== null && state.anchor` | 4파일 | 잡음 | 잡음 2/9 | ScrollController.restore-race.test.ts — preserves the latest user scroll with re | VP-14 #3 재량(형제 맞바꿈) |
| Z07 VP07-3-default-state-arm | `main/app/bootstrap.ts:1273` | 다른 값 | `: join(homedir(), '.claude.json') → : join(nativeClaude.root, '.claude.json')` | 1파일 | 잡음 | 잡음 2/22 | bootstrap.native-history.test.ts — broadcasts Claude false config / install | VP-07 ③ 재량(M092 형제 갈래) |
| Z08 VP16-2-flight-identity | `main/app/handlers/skills.ts:41` | 제거 | `if (listing === task) listing = undefined → listing = undefined` | 2파일 | 잡음 | 잡음 4/38 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 #2 재량(검증자 축) |
| Z09 VP16-2-author-scan-before-deploy | `main/app/handlers/skills.ts:49` | 뒤집기 | `await writeAuthoredSkill(req)⏎    await ctx.d → await writeAuthoredSkill(req)⏎    const scan ` | 1파일 | 잡음 | 잡음 1/16 | skills.test.ts — catalog skill target IPC > orca:skills:a | VP-16 #2 재량(검증자 축) |
| Z10 VP11-3-platform-flip | `main/adapters/claude/project-path.ts:9` | 뒤집기 | `process.platform === 'win32' ? resolve(cwd) : → process.platform !== 'win32' ? resolve(cwd) :` | 8파일 | 잡음 | 잡음 3/51 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 #3·VP-09 재량(형제 맞바꿈) |
| Z11 VP11-3-sync-root-cwd | `main/adapters/claude/project-path.ts:13` | 고정값 | `localSettingsRoot(cwd, () => claudePluginProj → localSettingsRoot(cwd, () => resolve(cwd))` | 8파일 | 잡음 | 잡음 2/51 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 #3·VP-09 재량(검증자 축) |
| Z12 VP07-4-startup-check-consumer | `main/infra/config/fingerprint-watch.ts:70` | 제거 | `if (deps.initialFingerprint !== undefined) sc → ∅` | 10파일 | 잡음 | 잡음 2/49 | discovery-cache.hold-race.test.ts — notifies once about a dependency changed | VP-07 ④ 재량(소비자 좌표) |
| Z14 VP10-9-binding-cwd | `main/app/session-binding.ts:9` | 고정값 | `current.cwd === expected.cwd → true` | 5파일 | 잡음 | 잡음 1/49 | bootstrap.native-history.test.ts — reads native configuration through the r | VP-10 #9 재량(형제 항) |
| Z15 VP10-9-binding-backend | `main/app/session-binding.ts:8` | 고정값 | `current.backend === expected.backend → true` | 5파일 | 잡음 | 잡음 1/49 | bootstrap.native-history.test.ts — reads native configuration through the r | VP-10 #9 재량(형제 항) |
| Z16 VP10-5-release-once | `main/adapters/opencode/v1/adapter.ts:223` | 뒤집기 | `releasing ??= lease.release().catch(reportDis → releasing = lease.release().catch(reportDispo` | 2파일 | 동치 | 동치 0/53 — 근거 §r2-4, `adapter.ts` r3 diff 0 | — | VP-10 #5-6 재량(검증자 축) |
| Z17 VP11-3-async-helper-root | `main/adapters/claude/project-path.ts:17` | 고정값 | `async () => (await gitRootLineage(cwd)).root → async () => resolve(cwd)` | 8파일 | 잡음 | 잡음 1/51 | plugin-catalog.test.ts — native plugin catalog > keeps nested cwd | VP-11 #3 재량(M101 SSOT 안) |
| F3 D7-reload-during-poll | `main/adapters/opencode/v1/discovery-cache.ts:262` | 회귀 재현 | poll pass 읽기 대기 중 `invalidate()`+`run()` 재로드 | 1파일 | 못 잡음 | 잡음 — 재현 B HEAD green 1/1 · D7 되돌림 red 1/1 | discovery-cache.reload-during-poll.verify.test.ts — VERIFY: a held scope is notified when it | VP-07 ④ · D-003 |
| C1 D7-early-return-restore | `main/adapters/opencode/v1/discovery-cache.ts:263` | 제거 | `this.pollRequested = true` 뒤 `return` 복원(r2 조기 반환) | 10파일 | 신규 | 잡음 3/49 | discovery-cache.poll-race.test.ts — notifies an overlapping reload once and  | D7 인용 변이 |
| X06 VP07-4-force-reuse-ignores-fingerprint | `main/adapters/opencode/v1/discovery-cache.ts:44` | 고정값 | `cached.fingerprint === fingerprint && → true &&` | 10파일 | 신규 | 잡음 7/49 | discovery-cache.hold-race.test.ts — notifies once about a dependency changed | VP-07 ④ 재량(검증자 축 — D6 계약의 다른 지점) |
| X07 VP07-4-reload-rewatch-removed | `main/adapters/opencode/v1/discovery-cache.ts:164` | 제거 | `run()` 재로드 뒤 `this.watch(key)` 삭제 | 10파일 | 신규 | **못 잡음** 0/49 — 재현 D HEAD green 3/3 · X07 red 3/3 | — | VP-07 ④ 재량(검증자 축 — R3-03 운반 edge) |
| F4 D8-stale-reload-during-poll | `main/adapters/opencode/v1/discovery-cache.ts:262-274` | 회귀 재현 | 재로드가 편집 전 `a`를 읽고 poll pass 대기 중 완료 → pass 재개 | 1파일 | 신규 | **못 잡음** — 기존 스위트 green, 재현 C HEAD red 1/1(통보 2회) · r2·r1·`a2e8464` green | 재현 C(검증자 축) | VP-07 ④ · AC12 |

- 검산: 시도 138 = r2 이력 재실행 134(M 107 · S 3 · F1·F2 2 · R2I 5 · Z 16 · F3 1) + D7 인용 1(C1) + 검증자 축 3(X06 · X07 · F4). 잡음 135 · 못 잡음 2(X07 · F4) · 동치 1(Z16).
- 재현 A(Z01 근거)·재현 D(X07 근거)는 고장 행이 아니라 해당 행의 근거다 — [`repro-matrix-r3.json`](verify-evidence/r3/repro-matrix-r3.json): A는 HEAD green·Z01 red, D는 HEAD green·X07 red(각 3/3).
- 소거 변이 잔여물: 판정은 assertion 실패만 셌다 — typecheck 잔여물이 red 근거가 된 행 없음.
- `N회` 관측 주체: holder 콜백 `vi.fn` 호출 수(재현 B·C·D, R3-01~03).

## r3-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-08 | MD↔UT | REQUIRED | PASS | 검색 47줄 목표값 · S2 · dead/test-only 33/45 신규 0 · i18n present 0·미참조 56 신규 0 | 29/29 |
| VP-09 | MD↔UT | REQUIRED | PASS | M004~M006·M082·M083·M107·Z10·Z11 잡음 | 14/14 |
| VP-10 | MD↔UT | REQUIRED | PASS | M007·M008·M102·M104·Z14·Z15 잡음 · Z16 동치 | 11/11 |
| VP-11 | MD↔UT | REQUIRED | PASS | M009·M010·M101·Z10·Z11·Z17 잡음 · `skill-catalog.test.ts` green | 4/4 |
| VP-12 | MD↔UT | REQUIRED | PASS | M043~M052·M077~M081·M086·M087 잡음 17 | 15/15 |
| VP-13 | MD↔UT | REQUIRED | PASS | M053~M076·M085 잡음 25 | 29/29 |
| VP-14 | MD↔UT | REQUIRED | PASS | M106 · F2 · R2I F2 · Z06 잡음 | 3/3 |
| VP-15 | MD↔UT | REQUIRED | PASS | M011·M040·M094·M095 잡음 · DB 스위트 Node ABI green(`native-history.db` 15/15 · `session.load` 11/11) | 6/6 |
| VP-16 | MD↔UT | REQUIRED | PASS | M012~M021·M041·M042·M096~M100·Z08·Z09 잡음 | 11/11 |
| VP-17 | MD↔UT | REQUIRED | PASS | M022·M105 잡음 | 4/4 |
| VP-18 | MD↔UT | REQUIRED | PASS | M023~M035·M084 잡음 14 · journal golden green | 19/19 |
| VP-04 | AR↔IT | REQUIRED | PASS | 사슬 검색 0 · S3 0→1 · M103 잡음 7 | 19/19 |
| VP-05 | AR↔IT | REQUIRED | PASS | 구 조립 0 · Linux 기준선 red 6케이스의 판정 환경 Windows CI run `41378268434`(head `feaca09`) Test 단계 success | 3/3 |
| VP-06 | AR↔IT | REQUIRED | PASS | 구 경로 0 · S1 5/5 | 5/5 |
| VP-07 | AR↔IT | REQUIRED | **PAIR_FAIL** | ①② M003·M088·R2I D1-project·Z04·Z05 · ③ M090~M092·Z07 · ④ D6·D7 해소(Z01·Z03·C1·F3·X06·Z02·Z12·F1·R2I 2) — **F4 통보 2회(D8) · X07 못 잡음(D9)** | 3/4 |
| VP-19 | SD↔ST | REQUIRED | PASS | M036~M039·M089 · Claude 입력 항 M090~M092·Z07 | 6/6 |
| VP-02 | R↔AT | REQUIRED | PASS | M001·M002·M093 잡음 | 3/3 |
| VP-03 | R↔AT | REQUIRED | PASS | legacy 0 · `native-history.test.ts` missing·probe 케이스 green — r3 diff 밖 | 2/2 |
| VP-01 | R↔AT | REGRESSION | PASS | gate 전부 green(§r3-9) · D-003 관측 반례 0 — D8은 멱등 소비자의 내부 콜백 횟수, D9는 HEAD 동작은 맞고(재현 D green) 잠금만 없다 | 0(집계) |

- root `PAIR_FAIL`: VP-07(D8·D9). 종속 `BLOCKED_BY`: 없음 — VP-01은 gate와 D-003 관측 목록으로 독립 판정했다.
- 실행 범위: r2 root VP-07 · 종속이던 VP-01 · r3 diff가 닿은 VP-07 ④ 재판정. 나머지 17 pair는 r2 좌표(O-02~O-19)를 실제 실행 집합(vitest ② 895파일)에서 확인하고 해당 r2 `잡음` 행 130건을 전부 재실행했다.
- 좌표의 실행 구간: R3-01~03(`discovery-cache.poll-race.test.ts`)은 `watchFile`을 mock하고 `poll()`을 직접 불러 감시 → poll edge 밖이다 — 그 edge의 기존 좌표는 실제 감시를 쓰는 `discovery-cache.test.ts`·`hold-race.test.ts`이며 재로드 뒤 재설정(`:164`)은 어느 좌표에도 없다(D9).

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ✅ | gate 전부 green · D7 해소 · D8·D9는 D-003 관측 목록 밖(소비자 멱등 · HEAD 동작 정상) |
| AC2 | ✅ | dead 33·test-only 45, 신규 `(name,kind,category)` 0 · S2 |
| AC3 | ✅ | `--absent` present 0, 미참조 56, 신규 0, CSS 토큰 0 |
| AC4 | ✅ | 사슬 검색 0 · session-resources 4파일 · doc-inventory OK |
| AC5 | ✅ | M103 잡음 7 |
| AC6 | ✅ | legacy 0 · 404→missing green |
| AC7 | ✅ | VP-09 변이 6 + Z10·Z11 잡음 |
| AC8 | ✅ | VP-10 변이 4 + Z14·Z15 잡음, Z16 동치 |
| AC9 | ✅ | 구 조립 0 · Windows CI green |
| AC10 | ✅ | M009·M010·M101·Z10·Z11·Z17 잡음 |
| AC11 | ✅ | M001·M002·M093 잡음 |
| AC12 | ❌ | D6·D7 해소, 그러나 겹친 재로드에서 holder 통보 2회(D8) · 재로드 뒤 감시 재설정 미잠금(D9) |
| AC13 | ✅ | 구 파일 0 · S1 5/5 |
| AC14 | ✅ | 마크·색 맞바꿈 잡음 |
| AC15 | ✅ | 표시명 맞바꿈 잡음 |
| AC16 | ✅ | cwd 슬롯 12변이 잡음 |
| AC17 | ✅ | capability 7자리 잡음 |
| AC18 | ✅ | F2·R2I F2·Z06·M106 잡음 |
| AC19 | ✅ | doc-inventory generated/prose/links OK, r3 문서 변경은 handoff만 |
| AC20 | ✅ | VP-15 변이 4 · DB 스위트 Node ABI green |
| AC21 | ✅ | CRUD 4경로 M097~M100 · Z08·Z09 잡음 |
| AC22 | ✅ | M022·M105 |
| AC23 | ✅ | VP-18 변이 14 · journal golden green |

- 합계 재측정: ✅ 22 · ⚠️ 0 · ❌ 1 = 23. 자기보고 23/23 ✅ — 불일치(AC12).
- 사본 대조: plan r3 구현 보고 `✅ 23` ↔ `dc9f29b` trailer `Criteria-Met: 23/23` ↔ INDEX 비고 `AC 23/23` — 세 사본은 서로 일치. `feaca09` trailer `1/23`·`Status: partial`은 CI 전 사본이다.

### pair별 plan §10 강제 지점 분모

| Pair | §10 자리 목록 | 자리별 확인 | 목록 밖 발견 | 결과 |
|---|---|---|---|---|
| VP-07 | ① global watch ② project sync ③ Claude 전역 감시 ④ discovery hold (4) | ①②③ r2 좌표 잡음 · ④ D6(Z01)·D7(Z03·C1·F3) 닫힘, **F4 통보 2회 · X07 못 잡음** | 없음 — D8·D9 모두 ④ 안 | PAIR_FAIL(④) |
| 그 밖 18 pair | §10·ΔV1 표 그대로(합 187 중 VP-07 4) | §r3-5 표 | 없음 | PASS |

## r3-6. 외부 포트 / 문서 계약

- 변경 없음 — r3 diff에 IPC·문서 계약 변경 0(app 2파일, docs는 handoff만).

## r3-7. 숫자 / 음성 기준 / 상한 재측정

| 항목 | r2 HEAD(`16acb8c`) | r3 HEAD(`dc9f29b`) |
|---|---|---|
| §10 기록 검색 47줄 | 목표값 | 같은 값(diff 0) — `watchFile(` 1 · discovery `setInterval(` 0 · 고아 사슬 0 · prepare 16 |
| dead / test-only | 33 / 45 | 33 / 45 |
| i18n 키 / 미참조 | 1171 / 56 | 1171 / 56 |
| vitest 파일 / 케이스(Node ABI) | 894 / 8,300 | 895 / 8,304 — r3 신규 1파일·4케이스 전부 green |
| vitest 실패 ID(Electron ABI) | 340 | 340 — 집합 동일(신규 0 · 사라짐 0) |

## r3-8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| D8 겹친 재로드 | `fs/promises` mock·`Date.now` 고정으로 결정적 재현(재현 C, 3/3) | 없음 |
| D9 감시 재설정 | 실제 `watchFile`·타이머로 재현(재현 D, 3/3) | 없음 |

## r3-9. 게이트 재실행

- 환경: Linux · `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall `[sqlite-abi] electron: rebuilt`). 이후 `npm rebuild better-sqlite3`(Node ABI)·`node node_modules/electron/install.js` — 저장소 밖 `node_modules`만 바꿨다.
- typecheck: `npm run typecheck` 3구성(node·web·test) exit 0, `error TS` 0.
- eslint(무수정 `./node_modules/.bin/eslint ./src ./scripts -f json`): 1,979파일 0 error · warning 2(`Timeline.tsx:49`·`useTranscriptVirtualizer.ts:22`, r1·r2와 같음).
- scripts·repo gate: `node --test scripts/*.test.mjs` 144/144 · doc-inventory `--check` generated/prose/links OK · migrations sync OK · test-budgets 16 suites OK.
- vitest ① 기준선 환경(Electron ABI): 895파일 · 8,180케이스(통과 7,774 · 실패 311 · 건너뜀 95) · 실패 ID 340 — r2 [`failed-ids-electron-abi.txt`](verify-evidence/r2/failed-ids-electron-abi.txt)와 집합 동일. 기준선 338 대비 신규 7 = ABI 2 + Windows 전용 5(r1·r2와 같다).
- vitest ② Node ABI + Electron 바이너리: 895파일 · 8,304케이스(통과 8,273 · 실패 22 · 건너뜀 9) — 실패 22 = r2 무변이 집합과 동일, 기준선 대비 신규 5 = Windows 전용 5.
- CI: run `41378268434` push `main` head `feaca09` windows-latest `gate` 전 단계 success. 로그 끝 scripts 144/144 관측. vitest 집계 줄은 로그 아카이브 호스트가 egress 403이라 못 봤다(r2와 같은 한계).
- 게이트가 트리를 바꿨는가: 없음 — 각 단계 뒤 `git status --short -- app` 빈 출력. 변이 러너·정적 스크립트·재현 매트릭스 모두 끝에서 `''`.
- 잔여물: `verify-evidence/r3/`(커밋 대상) 외 없음 — 재현 테스트는 실행 때만 app에 복사하고 지웠다.

## r3-10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트·변이·재현 | 에이전트 수행(§r3-4·§r3-9) |
| 제품 의도 / Open Question | 해당 없음 — D8 기대값은 VP-07·AC12 "1회", D9는 기존 동작(재현 D green)의 잠금 |
| PR merge | 사람 |

## r3-11. Repository operation checks

- AGENTS.md 변경: 없음(r3 diff 0).
- trailer: `feaca09` 6키(`Agent: codex`·`Status: partial`·`Criteria-Met: 1/23`·`Criteria-Pending`·`Verified-By: pending`), `dc9f29b` 5키(`Status: implemented`·`Criteria-Met: 23/23`·`Verified-By: pending`) — `git log -1 --format='%(trailers:only=true)'` 파싱 확인, 허용값.
- `[구현자 기입]` r3 7필드: 설계 리뷰·강제 지점 전수(19 pair·§10 수·`남긴 곳`)·잠금(분모 검산)·Product/UX·놓친 잠재 문제·구현 보고·Review Signals 전부 존재.
- INDEX: `impl/IMPL_DONE`·다음 주체 `Claude`·`(r3 구현 — 검증자 기입)` — 실제 상태와 일치, 비고 4줄. 이번 턴에 좌표를 기입한다.
- **좌표 교정**: 이전 INDEX 좌표 7개는 PR 브랜치에만 있다(`refs/pull/520·522/head`로만 해석, `main`의 조상 아님). `main`은 rebase 병합 커밋이다 — 아래 대응으로 INDEX를 고쳤고 모든 `main` 해시는 `git cat-file -t` = commit.

| 역할 | PR 해시 | `main` 해시 |
|---|---|---|
| V1 설계 · ΔV1 설계 | `ae103f3` · `a2e8464` | `e6aab6b` · `46b3784` |
| r1 구현 19커밋 · CI head | `291b721`…`4d308eb` · `00bb2a9` | `9c09b5a`…`e222e53`(`46b3784..e222e53` 19) · `127a579` |
| r1 verify · r2 구현 · r2 문서 · r2 verify | `0eb7dc2` · `0fa04db` · `c6070f4` · `14b251d` | `6eb0409` · `68b886b` · `87939ac` · `16acb8c` |
| r3 구현 · r3 문서 | — | `feaca09` · `dc9f29b` |

- plan 메타의 `기준 V … ae103f3c`는 규범 행이라 검증자가 고치지 않는다 — `main`의 `e6aab6b`와 같은 커밋 메시지·내용이다.

## r3-12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 |
|---|---|
| "PLAN_GAP 없음" · "설계 대비 명시적 차이: 없음" | 타당 — 규범부 diff 0 |
| 놓친 잠재 문제 R3-01a "가드를 지우면 옛 결과가 새 목록을 덮음" | 타당(Z03 잡음) — 그러나 보존한 새 목록이 편집 전 내용일 때의 중복(D8)은 다루지 않았다 |
| Product/UX "늦은 결과가 새 상태를 덮는가 — 옛 pass는 새 manifest를 보존" | 보존은 성립, 보존한 manifest가 낡았을 때 재통보(D8) |
| R3-03 "최신 파일 후속 편집 1회" | 단언은 직접 `poll()` 기준 — production의 감시 재설정 edge는 실행 구간 밖(D9) |
| N3 보완 | 타당 — 실제 트리 경로로 기록 |

## r3-13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D6 | probe stat → 내용 읽기 순서 미잠금 | VP-07 ④ | 해소 | Z01 잡음 1/49(R3-01) · 재현 A HEAD green·Z01 red |
| D7 | 겹친 재로드 시 통보 0회 | VP-07 ④ · D-003 | 해소 | 재현 B HEAD green·D7 되돌림 red · C1 잡음 3 · Z03 잡음 2 |
| D8 | 편집 전 내용을 읽은 재로드가 진행 중 poll pass와 겹치면 holder 통보 2회 — r2·r1·`a2e8464` 1회 | VP-07 ④ · AC12(실패 의미 "중복") | BLOCKING (PAIR_FAIL) | 구현 — 한 변경을 한 번 통보하면서 R3-03·재현 B를 함께 지킨다. 재현 C를 회귀 테스트로 둔다 |
| D9 | 재로드 뒤 감시 재설정(`discovery-cache.ts:164`)이 어떤 테스트에도 잠기지 않음 — X07 49케이스 green | VP-07 ④ · AC12 | BLOCKING (PAIR_FAIL) | 구현 — 실제 감시 경로로 새 의존 파일 편집 → 통보를 단언(재현 D 형태) |
| N1·N2 | r1 기록 | 비귀속 | NON_BLOCKING | 유지 |
| N3 | 구현자 정적 민감도가 임시 probe 파일만 검사 | VP-04·VP-08 증거 품질 | 해소 | r3 기록이 실제 `ipc.ts`·`mcp-config.ts` · 검증자 S2·S3와 일치 |

## r3-14. Review Signals — 사실만

- 이전 라운드와 유사 증상: D8·D9는 r1 D1·r2 D7과 같은 자리(VP-07 ④)·같은 경쟁(설정 편집 ↔ 재로드 ↔ poll)이다. r1·r2는 통보 누락, r3 D8은 통보 중복.
- 관련 plan 지침: VP-07 실패 의미 "중복 방송·누락", AC12 "변경마다 방송 1회".
- 검증 측 사실: r2 D7 대응 방향은 "새 manifest는 덮지 않되 통보 유지(구 코드와 같은 1회)"였고 재현 B(재로드가 새 내용을 읽음)만 들었다 — 편집 전 내용을 읽는 형제 순서와 재로드 뒤 감시 재설정은 r1·r2 verify도 시도하지 않았다.
- 반복 환경 한계: CI 로그 아카이브 호스트 egress 403(r2와 같음).
- 커밋 좌표: rebase 병합으로 r1·r2 verify가 적은 PR 해시 전부가 `main`에 없다.

## r3-15. 결론

- 상태: **FAIL** — 다음 주체 Claude(`handoff-review`), 라운드 4. verify **3회째** `FAIL`이라 r4 착수 전 review 1회가 의무다(`docs/handoff/AGENTS.md §라운드`). review 뒤 Codex r4(D-017).
- pair: REQUIRED/REGRESSION 19 중 PASS 18 · root PAIR_FAIL 1(VP-07) · BLOCKED_BY 0. PLAN_GAP 0.
- ACTIVE Decision: D-003 충족, VP-07 ④ 계약(1회) 위반(D8)·미잠금(D9).
- AC: ✅ 22 · ⚠️ 0 · ❌ 1(AC12).
- 운영 gate: 전부 green(환경 분리 포함).
- 다음 단계: 구현자가 D8·D9를 닫는다. 다음 verify는 이번 `못 잡음` 2행(X07·F4)·`동치` 1행(Z16)과 `잡음` 행을 다시 실행한다.

---

# r4 재검증 (2026-11-02)

> r1~r3 본문(위)은 그대로 둔다. 재현 자료는 [`verify-evidence/r4/`](verify-evidence/r4/) — 형제 순서 재현 테스트([`r4-siblings`](verify-evidence/r4/repro/discovery-cache.r4-siblings.verify.test.ts) E·G·H·I·J), 버전 매트릭스 러너·결과, 변이 정의·결과 JSON, 무변이 실패 ID, §10 검색 출력. 변이 러너는 r2의 [`mutate-r2.py`](verify-evidence/r2/mutate-r2.py) 그대로다.

## r4 메타

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-11-02 |
| 대상 커밋/range | `97271b8..7f81b46` — r4 구현 `7f81b46`(app 2파일 + plan·INDEX·scan). 사이의 `ca89d34`는 handoff-review round 39(지침만) |
| 구현 전 plan 기준 | `97271b8`(r3 verify) — 규범부 = `46b3784` V1+ΔV1 |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1` |
| 라운드 | 4 (verify 4회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예** — 구현 Claude(사용자 `/handoff-impl 290`), 검증 Claude. 보고 밖 축: 변이 Y1~Y7(보고는 C2~C4·X07·F4만 명명) · 형제 순서 E·G·H·I·J(보고는 `a` 편집 6순서만) |

## r4-0. 기준선 / plan 변경 확인

- **판정: 기준선 성립, 규범 변경 0.** `97271b8..7f81b46`의 plan diff는 hunk 1개(`@@ -1244,6 +1244,86 @@`) — `## r4 구현 보완` 절 80줄 추가뿐이다.
- Decision·Product/UX·AC·V node/pair·§10 변경 없음. 채점 기준은 V1+ΔV1 규범 행 원문(r1~r3와 같다).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 규범부 변경 0 |
| §10 자리 목록(기록 검색 재실행 차집합) | 유효 | [`ep-search.sh`](verify-evidence/ep-search.sh) HEAD 출력 47행([`ep-search-r4.txt`](verify-evidence/r4/ep-search-r4.txt))이 구현자 [`r3-ep-search.txt`](scan/r3-ep-search.txt)와 diff 0 |
| r4 수정·D10 자리의 목록 귀속 | 유효 | `discovery-cache.ts:262-280` 채택 루프는 VP-07 ④(hold 동안 의존 파일 변화로 probe 구동) 안 |

- root PLAN_GAP: 없음. D10은 VP-07 "변화마다 1회"·AC12 안에서 회귀 테스트 추가로 닫힌다.

## r4-1. Product & UX / ACTIVE Decision

| Decision / 요구 | 기대 결과 | r4 판정 |
|---|---|---|
| D-003 관측 동작 보존 | 화면·대화 흐름 불변 | 충족 — 겹친 재로드 형제 순서 11개(구현 6 + 검증 5) 모두 HEAD 통보 수 = `a2e8464` |
| VP-07 ④ · AC12 "변경마다 1회" | holder 통보 1회 | 동작 충족 · **미잠금(D10)** — 채택 판정 항(내용 서명)을 바꾼 Y1이 스위트 green |
| 그 밖 ACTIVE Decision | r3 판정 | 유지 — r4 app diff는 `discovery-cache.ts`(+13)·`discovery-cache.poll-race.test.ts`(+116)뿐 |

## r4-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| D8 수정이 중복 통보를 없앴는가 | 성립 | 재현 C HEAD green 3/3 · C2(채택 루프 제거) red 3/3 — [`repro-matrix-r4.json`](verify-evidence/r4/repro-matrix-r4.json) |
| 채택이 더 최신·다른 의존을 덮는가 | 아니오 | 조건 `current.signature === before.signature`(`:271`) — C3(`true`) 잡음 1/56(R3-03 newer-value) |
| 채택이 다른 실패 모드를 만들었는가 | 발견 0 | 형제 E(두 번째 편집 2회)·G(`b` 편집)·H(두 key 공유 파일)·I(touch 뒤)·J(채택 뒤 두 번째 hold) 전부 HEAD = `a2e8464` 기대값 3/3 |
| 채택이 observer manifest 밖을 바꾸는가 | 아니오 | 대상 Map은 `run()`(`:163`)·`hold()`(`:205`)가 만든 observer 사본 — entry manifest와 공유 없음 |
| 채택 판정 항이 잠겼는가 | **미잠금(D10)** | Y1(서명 → 지문 비교) discovery 10파일 56케이스 green, 재현 I red(통보 2회) |
| 채택된 지문 항 | 동치 | Y2(지문 미이관)·Y4(`changed` 가드 제거) — observer 지문은 `watch()` 기준선(`:229`)에서만 읽히고 불일치는 poll 1회만 낳으며 poll은 서명으로 판정한다. 재현 J green(두 holder 통보 [1,0]→[2,1]) |
| false success · worst-case | 없음 · 유한 | 새 오류 경로 0 · 루프 반복 = observer 의존 수 |

### D10 — 채택 판정 항(내용 서명)이 잠기지 않는다

- 변이 Y1: `discovery-cache.ts:271` `current.signature === before.signature` → `current.fingerprint === before.fingerprint` — discovery 10파일 56케이스 전부 green([결과](verify-evidence/r4/r4-verify-axes-result.json)).
- 재현 I: 내용을 바꾸지 않는 touch(`utimes`) 뒤 D8 순서(재로드가 편집 전 읽기 → pass 도중 완료). HEAD 통보 1회 · `a2e8464`·r2 1회 · Y1 2회([결과](verify-evidence/r4/r4-sibling-mutations-result.json)) · r3·C2 2회.
- 메커니즘: touch로 재로드 지문 ≠ hold 기준 지문 → 지문 비교는 채택하지 않음 → 다음 pass가 편집 전 서명과 다시 비교해 재통보(D8과 같은 결과).
- 기존 스위트: r4 6순서 테스트는 재로드와 기준선의 지문이 항상 같아 서명·지문 판정을 가르지 못한다.

## r4-3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 97271b89..7f81b460` — 대상 1파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| 1a·1b 미사용 export | 없음 | 출력 `(없음)` |
| 2 `OpenCodeDiscoveryCache` 테스트 전용 | 정상 | 파일 안 소비 `discovery-cache.ts:315` `openCodeDiscovery`(r2·r3와 같다) |
| 3 형제 정책 비대칭 | 없음 | 출력 `(없음)` |
| 새 테스트의 production 진입 | 성립 | 재감시 테스트는 `watchFile` mock 인자에서 실제 listener를 꺼내 `FingerprintWatch` → `poll()` 경로를 실행 — X07·Y5·Y6 잡음 |

## r4-4. 기존 테스트 / semantic 검증 — 고장 이력

### 직전 이력 재실행 (r3 138행)

[`r4-rerun-r3history.json`](verify-evidence/r4/r4-rerun-r3history.json) — CAUGHT 133 · GREEN 4(F1~F4 repro@HEAD) · MISSED 1(Z16).

| 행 | r3 | r4 | 판정 |
|---|---|---|---|
| r3 `잡음` 132행 | CAUGHT | CAUGHT 132 | 덮개 회귀 0 |
| X07 재로드 재감시 제거 (r3 `못 잡음`) | MISSED 0/49 | **CAUGHT 1/56** | D9 닫힘 |
| F4 재현 C @HEAD (r3 red) | RED | **GREEN** | D8 닫힘 |
| F1~F3 재현 @HEAD | GREEN | GREEN | 유지 |
| Z16 release 1회 (r3 `동치`) | MISSED 0/53 | MISSED 0/53 | 동치 유지 — `adapter.ts` r4 diff 0, r1 근거 그대로 |

### 이번 라운드 고장 (구현자 인용 + 검증자 축)

| ID | 파일:줄 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| C2 | `discovery-cache.ts:265-277` | 제거 | 채택 루프 삭제 | 잡음 1/56 | `poll-race` before-edit/during-pass |
| F4-revert | 같은 자리 | 제거 | 재현 C + C2 | 잡음 1/1 | 재현 C |
| C3 | `:271` | 고정값 | 조건 → `true` | 잡음 1/56 | R3-03 newer-value |
| Y1 | `:271` | 다른 값 | 서명 비교 → 지문 비교 | **못 잡음** 0/56 · 재현 I red | 없음 (D10) |
| Y2 | `:275` | 제거 | 채택에서 `fingerprint` 항 삭제 | 동치 0/56 · 재현 J green | — |
| Y3 | `:270` | 호출 대체 | `next.get` → `dependencies.get` | 잡음 2/56 | `poll-race` before-edit/during-pass · 재감시 테스트 |
| Y4 | `:267` | 제거 | `if (changed)` 가드 삭제 | 동치 0/56 · 재현 J green | — |
| Y5 | `:163` | 다른 값 | 재로드가 observer manifest를 옛 것으로 유지(X07 형제 지점) | 잡음 4/56 | `poll-race` newer-value·new-file·after-edit/before-pass·재감시 |
| Y6 | `:228` | 제거 | 감시 파일을 첫 의존만 | 잡음 1/56 | `poll-race` 재감시 테스트 |
| Y7 | `:264` | 제거 | 재로드 갈래 재poll 요청 삭제 | 잡음 1/56 | `poll-race` 재감시 테스트 |

- 분모: r3 이력 138 + 구현자 인용 3(C2·F4-revert·C3) + 검증자 축 7(Y1~Y7) = 148. 재현 매트릭스 5변형 × 16케이스 × 3회는 별도([`repro-matrix-r4.json`](verify-evidence/r4/repro-matrix-r4.json)).
- 동치 근거(Y2·Y4): observer `fingerprint`는 `watch()`의 `initialFingerprint`(`:229`)로만 소비되고, 기준선 불일치는 시작 확인의 `poll()` 1회로 끝나며 그 poll은 `signature`로 통보를 판정한다(`:257`). 재현 J(채택 뒤 두 번째 hold → 500ms 진행 → poll → 다음 편집)가 Y2·Y4에서 HEAD와 같은 [1,0]·[2,1].
- C4(구현자가 정의에서 뺀 동치 후보)는 코드에서 절이 사라져 재실행 대상이 없다.

## r4-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-08~VP-18 (11) | MD↔UT | REQUIRED | PASS | r3 좌표 · 해당 r3 `잡음` 행 재실행 전부 CAUGHT · Z16 동치 유지 | r3 값 그대로 |
| VP-04·VP-05·VP-06 | AR↔IT | REQUIRED | PASS | r3 좌표 · 해당 행 CAUGHT · Windows CI run `41403052602`(head `7f81b46`) gate success | r3 값 그대로 |
| VP-07 | AR↔IT | REQUIRED | **PAIR_FAIL** | ①②③ r3 좌표 행 CAUGHT · ④ D8(C2·F4)·D9(X07·Y5·Y6) 닫힘 — **Y1 못 잡음(D10)** | 3/4 |
| VP-19 | SD↔ST | REQUIRED | PASS | r3 행 CAUGHT | 6/6 |
| VP-02·VP-03 | R↔AT | REQUIRED | PASS | r3 행 CAUGHT | 3/3 · 2/2 |
| VP-01 | R↔AT | REGRESSION | PASS | gate 전부 green · D-003 형제 순서 11개 HEAD = `a2e8464` · D10은 HEAD 동작 정상(재현 I green), 잠금만 없다 | 0(집계) |

- root `PAIR_FAIL`: VP-07(D10). 종속 `BLOCKED_BY`: 없음.
- 실행 범위: VP-07 ④ 재판정 + r3 이력 138행 전부(나머지 17 pair 좌표를 실제 실행 집합에서 재확인).
- 좌표 실행 구간: r4 6순서 테스트는 `poll()` 직접 호출, 재감시 테스트는 `watchFile` listener → `FingerprintWatch` → `poll()`까지 production — D9 edge가 구간 안이다.

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1~AC11 · AC13~AC23 | ✅ | r3 근거 유지 · 해당 r3 변이 행 재실행 전부 CAUGHT · r4 diff 밖 |
| AC12 | ❌ | D8·D9 닫힘, 그러나 채택 판정 항 미잠금(D10) — 동작은 맞고 Y1이 green |

- 합계 재측정: ✅ 22 · ⚠️ 0 · ❌ 1 = 23. 자기보고 23/23 — 불일치(AC12).
- 사본 대조: plan r4 보고 `✅ 23` ↔ `7f81b46` trailer `Criteria-Met: 23/23` ↔ INDEX 비고 `AC 23/23` — 세 사본 일치.

### pair별 plan §10 강제 지점 분모

| Pair | §10 자리 목록 | 자리별 확인 | 목록 밖 발견 | 결과 |
|---|---|---|---|---|
| VP-07 | ①~④ (4) | ①②③ r3 행 CAUGHT · ④ C2·C3·Y3·Y5~Y7·X07 잡음, **Y1 못 잡음** | 없음 — D10은 ④ 안 | PAIR_FAIL(④) |
| 그 밖 18 pair | 합 187 중 183 | §r4-5 표 | 없음 | PASS |

## r4-6. 외부 포트 / 문서 계약

- 변경 없음 — r4 diff에 IPC·문서 계약 변경 0.

## r4-7. 숫자 / 음성 기준 / 상한 재측정

| 항목 | r3 HEAD(`dc9f29b`) | r4 HEAD(`7f81b46`) |
|---|---|---|
| §10 기록 검색 47행 | 목표값 | diff 0 |
| vitest 파일 / 케이스(Node ABI) | 895 / 8,304 | 895 / 8,311 — 통과 8,280 · 실패 22 · 건너뜀 9 |
| vitest 실패 ID | 22 | 22 — r3 [`clean-failed-ids-node.txt`](verify-evidence/r3/clean-failed-ids-node.txt)와 집합 동일 |
| discovery 10파일 케이스 | 49 | 56 (+7 = r4 신규) |

## r4-8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| D10 touch + 겹친 재로드 | `utimes`·`fs/promises` mock·`Date.now` 고정으로 결정적 재현(재현 I, 3/3) | 없음 |

## r4-9. 게이트 재실행

- 환경: Linux · Node ABI better-sqlite3 · Electron 바이너리(r3와 같은 `node_modules`).
- typecheck: `npm run typecheck` 3구성 `error TS` 0.
- eslint(무수정 `-f json`): 1,979파일 0 error · warning 2(`Timeline.tsx:49`·`useTranscriptVirtualizer.ts:22`, 기존).
- scripts·repo gate: `node --test scripts/*.test.mjs` 144/144 · doc-inventory `--check` generated/prose/links OK.
- vitest 전체(무변이): 895파일 · 8,311케이스 · 실패 22 = r3 무변이 집합(신규 0 · 사라짐 0).
- CI: run `41403052602`(PR #523, head `7f81b46`) windows-latest `gate` 전 단계 success — Lint·Typecheck·Test·doc/migration/test-budget guard.
- 게이트가 트리를 바꿨는가: 없음 — 변이 러너·매트릭스 끝 `git status --short -- app` 빈 출력. 검증자 실험은 별도 worktree에서 돌리고 제거했다.

## r4-10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트·변이·재현 | 에이전트 수행(§r4-4·§r4-9) |
| 제품 의도 / Open Question | 해당 없음 — D10 기대값은 VP-07·AC12 "1회", HEAD 동작은 이미 맞다 |
| PR merge | 사람 |

## r4-11. Repository operation checks

- AGENTS.md 변경: 없음.
- trailer: `7f81b46` 7키(`Agent: claude`·`Handoff`·`Status: implemented`·`Criteria-Met: 23/23`·`Verified-By: pending`·`Co-Authored-By`·`Claude-Session`) — `%(trailers:only=true)` 파싱 확인, 허용값.
- `[구현자 기입]` r4 7필드: 설계 리뷰·강제 지점 전수(VP-07 4 + 183 · `남긴 곳`)·잠금(분모 검산 141)·Product/UX·놓친 잠재 문제·구현 보고·Review Signals 전부 존재.
- INDEX: `impl/IMPL_DONE`·다음 주체 `Claude`·자리표시자 2개 — 실제 상태와 일치, 비고 4줄.
- **좌표**: r3 verify `97271b8` · review `ca89d34` · r4 `7f81b46`은 이 PR 브랜치(PR #523)에만 있고 `origin/main`(`dc9f29b`)의 조상이 아니다 — `git merge-base --is-ancestor` 실패. rebase 병합 뒤 해시가 바뀌므로 INDEX에는 자리표시자를 유지하고 PR 해시는 여기만 둔다.

## r4-12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 |
|---|---|
| "6순서 기대값 = `a2e8464`" | 타당 — 매트릭스에서 6순서 `a2e8464` green 3/3 재현 |
| C4 "동치 후보 제거, 절 삭제로 단순화" | 타당 — 그러나 남은 조건의 판정 항(서명/지문)은 잠기지 않았다(D10) |
| 순서 `after-edit/before-pass` 0회 | 타당 — `a2e8464`도 0회, D-003 기준 |
| "PLAN_GAP 0 · 설계 대비 차이 없음" | 타당 — 규범부 diff 0 |

## r4-13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D8 | 겹친 재로드 중복 통보 | VP-07 ④ · AC12 | 해소 | F4 GREEN · C2·F4-revert 잡음 · 형제 E·H·I·J HEAD = `a2e8464` |
| D9 | 재로드 뒤 재감시 미잠금 | VP-07 ④ · AC12 | 해소 | X07 잡음 1/56 · 형제 지점 Y5·Y6 잡음 |
| D10 | 채택 판정 항(내용 서명) 미잠금 — Y1 못 잡음, 재현 I에서 통보 2회 | VP-07 ④ · AC12 | BLOCKING (PAIR_FAIL) | 구현 — 재현 I 형태(touch 뒤 D8 순서 통보 1회)를 회귀 테스트로 둔다 |
| N1·N2 | r1 기록 | 비귀속 | NON_BLOCKING | 유지 |

## r4-14. Review Signals — 사실만

- 이전 라운드와 유사 증상: D10은 r1 D1·r2 D7·r3 D8·D9와 같은 자리(VP-07 ④)다. 이번엔 동작 결함이 아니라 새 조건 항의 잠금 누락.
- 관련 plan 지침: VP-07 실패 의미 "중복 방송", AC12 "변경마다 1회".
- 구현자=검증자(같은 에이전트): 보고 밖 축 Y1~Y7·형제 5순서 중 Y1만 결함을 드러냈다 — 보고가 명명한 변이(C2·C3·X07·F4)는 전부 red였다.
- 반복 환경 한계: 없음 — 이번 CI는 job 단계 결과를 API로 확인했다.

## r4-15. 결론

- 상태: **FAIL** — 다음 주체 구현자, 라운드 5. verify 4회째라 review 의무 없음(3·6회째만).
- pair: REQUIRED/REGRESSION 19 중 PASS 18 · root PAIR_FAIL 1(VP-07) · BLOCKED_BY 0. PLAN_GAP 0.
- ACTIVE Decision: D-003 충족 · VP-07 ④ 동작 충족, 잠금 1항 누락(D10).
- AC: ✅ 22 · ⚠️ 0 · ❌ 1(AC12).
- 운영 gate: 전부 green(Linux 로컬 + Windows CI).
- 다음 단계: 구현자가 D10을 닫는다. 다음 verify는 `못 잡음` Y1 · `동치` Y2·Y4·Z16과 이번 `잡음` 행을 다시 실행한다.

---

# r5 재검증 (2026-11-02)

> r1~r4 본문(위)은 그대로 둔다. 재현 자료는 [`verify-evidence/r5/`](verify-evidence/r5/) — 변이 정의 164행·결과, 무변이 실패 ID, 버전 매트릭스 결과, §10 검색 출력. 러너는 [`mutate-r2.py`](verify-evidence/r2/mutate-r2.py)·[`repro-matrix-r4.py`](verify-evidence/r4/repro-matrix-r4.py) 그대로다.

## r5 메타

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-11-02 |
| 대상 커밋/range | `9e77792..3b26b45` — r5 구현 `046c80e`(테스트 2파일 + plan·INDEX·증거) · `3b26b45`(CI 기록, 문서만 — app 트리 = `046c80e`). production diff 0 |
| 구현 전 plan 기준 | `9e77792`(r4 verify) — 규범부 = `46b3784` V1+ΔV1 |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1` |
| 라운드 | 5 (verify 5회째) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니오 — 구현 Codex(D-017), 검증 Claude. 원격 `origin/ccr-fb7b0aa8-2aha7d`로 rebase(fast-forward) 뒤 검증 |

## r5-0. 기준선 / plan 변경 확인

- **판정: 기준선 성립, 규범 변경 0.** plan diff는 `## r5 구현 보완` 절 146줄 추가뿐이다(`[검증자 기입]` 표 변경 0).
- §10 기록 검색: [`ep-search-r5.txt`](verify-evidence/r5/ep-search-r5.txt) 47행이 r4 출력과 diff 0. 고정 187자리 유지.
- PLAN_GAP: 없음.

## r5-1. Product & UX / ACTIVE Decision

| Decision / 요구 | r5 판정 |
|---|---|
| D-003 관측 동작 보존 | 충족 — production 코드가 r4와 같고, 12순서(touch 유무 × 6) 기대값이 `a2e8464` 코드에서도 12/12 green([매트릭스](verify-evidence/r5/repro-matrix-r5.json)) |
| VP-07 ④ · AC12 "변경마다 1회" | 충족·잠김 — D10 Y1 잡음 3/3 |
| 그 밖 ACTIVE Decision | r4 판정 유지 — app diff는 테스트 2파일 |

## r5-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 단언이 production 경로를 지나는가 | 성립 | R5-01은 실제 `discoveryReadFile`·`utimes`·`poll()`, R5-02는 `watchFile` 인자 listener → `FingerprintWatch` → `poll()`, R5-03은 보류된 pass + 재로드 → 재검사 요청 |
| R5-03이 0290 전 코드와 갈리는 이유 | 기대 범위 안 | `a2e8464`는 1초 주기 poll이라 즉시 재검사가 없어 0회 — r3 감시 설계의 재검사 edge(`discovery-cache.ts:264`)를 잠그는 기제 단언이고 HEAD green 3/3 |
| `setImmediate` 200회 → `vi.waitFor` | 성립 | X07·Y6·Y7 각 3회 반복 모두 잡음 — 대기 시간 의존 제거 |
| `project-reconciliation` fixture `.git` 추가가 루트 판정 잠금을 약화하는가 | 아니오 | 같은 파일을 포함한 Z10·Z11·Z17(루트 판정 변이) 잡음 유지 · M107 잡음 |
| false success | 없음 | production diff 0 |

## r5-3. 역방향 탐색

- `scan-surface.sh 9e77792..046c80e`: `변경된 소스 파일이 없습니다` — 변경은 테스트 파일뿐이다.

## r5-4. 고장 이력 재실행

[`r5-mutation-rerun.json`](verify-evidence/r5/r5-mutation-rerun.json) — 정의 152행(r3 이력 138 + r4 구현자 인용 3 + r4 검증자 축 Y1~Y7 + 형제 재현 4) + 반복 12행(X07·Y1·Y3·Y5·Y6·Y7 × 2) = 164. CAUGHT 154 · GREEN 5(재현 @HEAD) · MISSED 5(동치 행).

| 행 | r4 | r5 | 판정 |
|---|---|---|---|
| r3·r4 `잡음` 전 행 | CAUGHT | CAUGHT | 덮개 회귀 0 |
| Y1 서명 → 지문 비교 (r4 `못 잡음`) | MISSED 0/56 | **CAUGHT 1/63 ×3** | D10 닫힘 — `reports one edit once … before-edit … during-pass (touch: true)` |
| X07 · Y6 · Y7 | CAUGHT | CAUGHT ×3 | R5-02(X07·Y6) · R5-03(Y7) |
| Y2 · Y4 (r4 `동치`) | MISSED 0/56 | MISSED 0/63 · 형제 재현 5/5 green | 동치 유지 — r4 근거(`:229` 기준선만 소비) 그대로, 해당 줄 diff 0 |
| Z16 (`동치`) | MISSED 0/53 | MISSED 0/53 | 동치 유지 |
| 재현 F1~F4 · 형제 E·G·H·I·J @HEAD | GREEN | GREEN | 유지 |

- 새로 시도한 고장: 없음 — production diff 0이라 새 자리가 없고, 새 단언의 민감도는 Y1·X07·Y6·Y7·M107이 직접 잰다.

## r5-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-08~VP-18 (11) | MD↔UT | REQUIRED | PASS | r3 좌표 · 해당 이력 행 CAUGHT · Z16 동치 | r3 값 |
| VP-04·VP-05·VP-06 | AR↔IT | REQUIRED | PASS | 이력 행 CAUGHT · Windows CI `41408758721` success | r3 값 |
| VP-07 | AR↔IT | REQUIRED | PASS | ①②③ 이력 행 CAUGHT · ④ R5-01~03 — C2·C3·Y1·Y3·Y5~Y7·X07 잡음, Y2·Y4 동치 | 4/4 |
| VP-19 | SD↔ST | REQUIRED | PASS | 이력 행 CAUGHT | 6/6 |
| VP-02·VP-03 | R↔AT | REQUIRED | PASS | 이력 행 CAUGHT | 3/3 · 2/2 |
| VP-01 | R↔AT | REGRESSION | PASS | 로컬 gate green · Windows CI `41408758721`(head `046c80e`) 전 단계 success · D-003 순서 반례 0 | 0(집계) |

- root `PAIR_FAIL` 0 · `BLOCKED_BY` 0 · PASS 19/19.
- §10 분모: 187/187 — 목록 밖 발견 0.

### AT / AC 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ✅ | 구현자 ⚠️(CI 대기)였던 항목 — CI `41408758721` Test 단계 success 관측으로 닫음 |
| AC2~AC11 · AC13~AC23 | ✅ | r4 근거 유지 · 해당 이력 행 CAUGHT |
| AC12 | ✅ | D10 닫힘(Y1 잡음) · D8·D9 유지 |

- 합계: ✅ 23 · ⚠️ 0 · ❌ 0 = 23 — 자기보고와 일치.
- 사본 대조: plan r5 보고 `✅23`(`3b26b45`가 CI 뒤 갱신) ↔ `3b26b45` trailer `Criteria-Met: 23/23` ↔ INDEX 비고(같은 커밋) — 일치. `046c80e` trailer `22/23`·`partial`은 CI 전 사본이다.

## r5-6. 외부 포트 / 문서 계약

- 변경 없음.

## r5-7. 숫자 재측정

| 항목 | r4 HEAD(`7f81b46`) | r5 HEAD(`046c80e`) |
|---|---|---|
| vitest 파일 / 케이스(Node ABI) | 895 / 8,311 | 895 / 8,318 — 통과 8,287 · 실패 22 · 건너뜀 9 |
| vitest 실패 ID | 22 | 22 — r4 집합과 diff 0 |
| discovery 10파일 케이스 | 56 | 63 |

- 구현자 보고의 "기존 실패 59"는 구현자 환경(상위 `/tmp/.git` 등) 값이다. 이 환경엔 `/tmp/.git`이 없고 실패 집합은 r3 이래 22로 같다.

## r5-8. 사람 실기

- 남은 사람 실기 없음. r1 §8의 스트리밍 중 휠 스크롤 확인은 "선택"으로 남아 있다.

## r5-9. 게이트 재실행

- typecheck 3구성 `error TS` 0 · eslint 1,979파일 0 error · warning 2(기존) · scripts 144/144 · doc-inventory generated/prose/links OK.
- vitest 전체 무변이: §r5-7.
- CI: run `41408758721`(PR #523, head `046c80e`) windows-latest `gate` 전 단계 success.
- 트리 변경: 없음 — 러너 끝 `git status --short -- app` 빈 출력. 매트릭스는 별도 worktree에서 돌리고 제거했다.

## r5-10. Repository operation checks

- trailer: `046c80e` 6키(`Status: partial`·`Criteria-Met: 22/23`·`Criteria-Pending`…) · `3b26b45` 5키(`Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 23/23`·`Verified-By: pending`) — 둘 다 파싱 확인, 허용값.
- `[구현자 기입]` r5 7필드 전부 존재 — 강제 지점 표는 19 pair 전부와 `남긴 곳`을 담는다.
- INDEX: `impl/IMPL_DONE`·다음 주체 `Claude`·`(r5 구현 — 검증자 기입)` — 실제 상태와 일치.
- 좌표: r3 verify 이후 커밋(`97271b8`·`ca89d34`·`7f81b46`·`9e77792`·`046c80e`·`3b26b45`)은 PR #523 브랜치에만 있고 `origin/main`(`dc9f29b`)의 조상이 아니다. archive 행은 자리표시자를 유지하고 PR 해시는 이 절에만 둔다.

## r5-11. Finding disposition

| # | finding | disposition | 후속 |
|---|---|---|---|
| D10 | 채택 판정 항 미잠금 | 해소 | Y1 잡음 3/3 |
| D8·D9 | r4 해소 | 해소 유지 | F4 GREEN · X07 잡음 |
| N1·N2 | r1 기록 | NON_BLOCKING | 유지 |

## r5-12. Review Signals — 사실만

- D1·D7·D8·D10이 모두 VP-07 ④ 경쟁 자리였다. 이번 라운드는 테스트만 바꿔 닫혔다.
- 반복 환경 차이: 구현자 환경의 상위 `/tmp/.git`이 fixture 판정을 바꿨다(R5-B) — 이 환경에서는 재현되지 않는다.

## r5-13. 결론

- 상태: **PASS** — pair 19/19 PASS · PLAN_GAP 0 · AC ✅23 · 운영 gate 전부 green · 고장 이력 `못 잡음` 0(동치 3).
- 남은 것: NON_BLOCKING N1·N2 · `main` 병합 뒤 좌표 교정. 보드 행을 archive로 옮긴다.
