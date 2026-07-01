# Plan — 0058-orca-plugin-restructure

> claude dist 확장 배포 계층을 **Claude Code 플러그인(`plugins/orca/`)** 형식으로 재구성하고,
> 런타임에 SDK `options.plugins` 로 로드하며, dist→cwd 파일 싱크를 제거한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0058-orca-plugin-restructure` |
| 작성자 | Claude Code |
| 일자 | 2026-07-01 |
| 매핑 | PHASES — 배포 계층(standardization) 후속 / PR (미정) |
| 상태 | DRAFT → READY |
| 구현 주체 | Codex (기능 — 런타임 로딩 동작 변경 포함). 사용자 재지정 가능. |
| 선행 | 배포 계층 스테이지 A(`docs/arch/backend/standardization.md §5.1`, PR #47) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① `~/.config/orca/dist/claude/` 하위를 `plugins/orca/` 로 재구성 — 하위에 `.claude-plugin/plugin.json`·`skills/`·`agents/`·`hooks/`·`.mcp.json` 기본 구성. plugin.json 은 name:`orca`, description:`orca에서 구성된 skill 및 mcp`, version:`1.0.0`. | 라이브 세션 요청("핸드오프 문서 생성" 본문 1항) |
| 명시 요구 | ② 재구성된 플러그인 폴더를 런타임에 로드하는 형태로 구현 변경. | 라이브 세션 요청 2항 |
| 명시 요구 | ③ 기존 cwd 파일 싱크 기능 제거. | 라이브 세션 요청 3항 |
| 명시 요구 | ④ `sources/` 의 skill·mcp 를 **세션 런타임 시작 전(`query()` 호출 전)** 에 dist 로 전개(deploy)하도록 보장. | 라이브 세션 추가 요청 |
| 명시 결정 | MCP 처리 = 런타임 주입(`options.mcpServers`, 비밀 확장) 유지 + 플러그인엔 placeholder `.mcp.json`. | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | 플러그인 skill 은 SDK 가 `orca:<name>` 로 네임스페이스하므로 `options.skills` 필터도 그 형식으로 맞춰야 함(아래 조사 근거). *추론이 아니라 조사 근거지만, 요구엔 없던 파생 필수 변경이라 여기 표기.* | `skills.md:77` |

## Context (왜)

Orca 는 사람이 편집하는 `sources/`(skill·mcp SSOT)를 `dist/claude/` 로 배포하고, 그것을 세션 cwd 로 복사(싱크)해 SDK 가 cwd 의 `.claude/skills`·`.mcp.json` 표준 경로에서 발견하게 해 왔다. 이 방식은 (a) 세션 cwd 마다 파일을 복사·오염시키고, (b) skill·mcp·agent·hook 을 하나의 배포 단위로 묶지 못한다. Claude Code 플러그인은 이 네 자산을 `.claude-plugin/plugin.json` 매니페스트 아래 하나의 이식 가능한 패키지로 묶고, SDK `options.plugins` 로 **cwd 오염 없이** 로드한다. `docs/arch/backend/standardization.md:106,109` 는 이미 "agents·commands·hooks·plugin … **추후 claude plugin 지원으로 연기**" 라고 이 방향을 예고했다 — 본 핸드오프가 그 "추후" 를 실행한다. 결과: dist 를 플러그인 레이아웃으로 재구성 → 런타임 `options.plugins` 로드 → cwd 싱크 제거(전개는 유지·선행 보장).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| SDK `Options.plugins?: SdkPluginConfig[]` 지원. 값 = `{ type: "local", path }`, `type` 은 `"local"` 만 허용. path 는 `.claude-plugin/plugin.json` 을 **포함하는 루트 디렉토리**. 상대/절대 경로 가능(상대는 cwd 기준). | `@docs/spec/claude/agent-sdk/plugins.md:28,37-39,78` · `@docs/spec/claude/agent-sdk/typescript.md:471` |
| 플러그인 skill 은 충돌 회피 위해 **플러그인 이름으로 자동 네임스페이스** — 슬래시/필터 형식 `plugin-name:skill-name`. `options.skills` 필터도 "플러그인에서 제공하는 Skills 의 경우 `plugin:skill` 을 사용" 한다. | `@docs/spec/claude/agent-sdk/plugins.md:135,330` · `@docs/spec/claude/agent-sdk/skills.md:77` |
| 플러그인 구조 참조: `.claude-plugin/plugin.json`(필수) + `skills/<skill>/SKILL.md`·`agents/`·`hooks/hooks.json`·`.mcp.json`(선택). `commands/` 는 레거시 — 신규는 `skills/`. | `@docs/spec/claude/agent-sdk/plugins.md:264-280` |
| 현재 배포: `deploy(engine, opts, root)` 가 skill→`dist/<engine>/.claude/skills/`, mcp→`dist/<engine>/.mcp.json` 렌더. `agents/commands/hooks/plugin/settings` 는 배포 안 함. backup(.bak 1개 롤링) + MCP 키 검증 + `.orca-deploy.json` 마커. | `@app/src/main/deploy/deployer.ts:131-212` |
| 경로 헬퍼: `distDir(engine)`→`dist/<engine>`, `distSkillsDir`→`dist/<engine>/.claude/skills`, `distMcpJsonPath`→`dist/<engine>/.mcp.json`. | `@app/src/main/config/paths.ts:111-123` |
| cwd 싱크: `syncWorkspaceExtensions(engine, cwd)` 가 dist 의 `.claude/skills`·`.mcp.json` 을 cwd 로 overwrite-merge(force). | `@app/src/main/deploy/workspace-sync.ts:10-20` |
| 싱크 배선: router `syncExtensions(cwd)`(=deploy+syncWorkspaceExtensions+게이트마킹) / `syncExtensionsForTurn(cwd)`(cwd 단위 1회 게이트, `syncedCwds` Set). boot 에서 `this.syncExtensions()` 1회, 턴 진입 시 `ctx.syncExtensionsForTurn(turn.cwd)`. | `@app/src/main/ipc/router.ts:56-118,164` · `@app/src/main/ipc/chat/send.ts:353` |
| MCP 런타임 주입: `toClaudeConfig`(${VAR} 확장·비밀 복호화) → `adaptMcp` → `options.mcpServers` + `allowedTools: mcp__<name>__*`. **비밀은 어댑트 시점에만 확장** — 디스크 미잔류. | `@app/src/main/adapters/claude.ts:284,303` · `@app/src/main/adapters/claude-adapt.ts:35-39` |
| skill 필터: `adaptSkills(skills)` 가 skills.length>0 이면 활성(`sourceKind!=='orca' \|\| enabled`) skill 의 **bare `name`** 배열을 `options.skills` 로, 스캔 0 이면 `'all'`. | `@app/src/main/adapters/claude-adapt.ts:54-58` |
| skill 스캔은 `sourcesSkillsDir()`(sources 원본)·`~/.claude/skills`(어댑터)를 **직접** 읽는다 — cwd 거울이 아니다. 따라서 cwd 싱크 제거가 스캔/가시화에 영향 없음. | `@app/src/main/ipc/router.ts:70-85` · `@app/src/main/skills/scan.ts:52-98` |
| 어댑터 아웃바운드 변환기는 `...spread` 로 합성될 옵션 조각(object)을 반환하는 순수 함수(테스트 대상): `adaptMcp/adaptSkills/adaptSettings/adaptEnv/adaptHooks/adaptSystemPrompt`. | `@app/src/main/adapters/claude-adapt.ts:1-8,35-117` |
| 레이어 규칙: 엔진 리터럴(`'claude'`)은 adapters·deploy·컴포지션 루트에 한함. adapters(L2)는 config/paths(L1 domain) 의존 가능. | `@app/src/main/AGENTS.md` (레이어 DAG·작업 규칙) |
| 기존 dist 레이아웃/소유 모델(호환자산=Orca SSOT projection, 비호환=엔진 SSOT·plugin 연기)·MCP `${VAR}` subprocess 확장 서술 | `@docs/arch/backend/standardization.md:100-136` |
| 배포계층 테스트: `deployer.test.ts` 가 현 레이아웃(`.claude/skills`·`.mcp.json`) 검증. | `@app/src/main/deploy/deployer.test.ts` |

## 인수 기준 (Acceptance Criteria)

1. `deploy('claude', …)` 가 `dist/claude/plugins/orca/.claude-plugin/plugin.json` 을 렌더한다 — 내용 `{ "name": "orca", "description": "orca에서 구성된 skill 및 mcp", "version": "1.0.0" }`.
2. Orca skill 이 `dist/claude/plugins/orca/skills/<skill>/SKILL.md` 로 복사된다. 구 `dist/claude/.claude/skills/` 경로는 더 이상 생성되지 않는다.
3. MCP placeholder 미러가 `dist/claude/plugins/orca/.mcp.json` 로 기록된다 — `${VAR}` placeholder 보존, 평문 비밀 0(기존 mcp 배포 규칙 유지 + 키 검증 유지).
4. `dist/claude/plugins/orca/agents/`·`dist/claude/plugins/orca/hooks/` 디렉토리가 생성된다(현재 소스 자산이 없어 비어 있음 — 기본 구조).
5. 런타임 `query()` 옵션에 `plugins: [{ type: 'local', path: <plugins/orca 절대경로> }]` 가 주입된다(플러그인 루트가 존재할 때만; 부재 시 옵션 생략).
6. `adaptSkills` 가 활성 Orca skill 을 `orca:<name>` 형식으로 `options.skills` 에 넣는다. 어댑터 skill(`~/.claude/skills`)은 bare `name` 유지. 스캔 0 이면 `'all'` 폴백 유지.
7. dist→cwd 파일 싱크가 제거된다 — `workspace-sync.ts`(및 `syncWorkspaceExtensions`) 삭제, `syncedCwds`·cwd 복사 경로 제거. cwd 에 `.claude/skills`·`.mcp.json` 을 더 이상 쓰지 않는다.
8. **sources→dist deploy 선행 보장**: `sources/skills`·`sources/mcp` 의 dist(플러그인) 전개가 매 `query()` 호출 **전에** 완료돼 있다 — boot 1회 deploy(모든 turn 선행) + skill/mcp CRUD 재-deploy + 턴 진입 멱등 가드. 플러그인 경로가 cwd 독립이므로 게이트는 cwd 단위가 아니라 실행(run) 단위.
9. MCP 실제 주입 경로는 무변 — `options.mcpServers`(비밀 확장) + `allowedTools` 가 권위 소스. 플러그인 `.mcp.json` 은 구조적 미러일 뿐 런타임 MCP 를 구동하지 않는다(동작 회귀 0).
10. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`. 레이어 경계(boundaries)·`import/no-cycle` 위반 0. 신규 의존성 0.
11. 문서 정합: `docs/arch/backend/standardization.md`(dist 레이아웃 §100-136·소유 모델 §109)·`docs/PHASES.md` 가 신 레이아웃(plugin)으로 갱신된다. IPC 채널 변경 없음(무 → `IPC_CONTRACT.md` 무변).

## 범위 / 비범위

- **범위**: dist 레이아웃 재구성(paths·deployer)·런타임 `options.plugins` 로드(claude-adapt·claude)·skill 네임스페이스 필터 수정·cwd 싱크 제거·deploy 선행 보장(router·send)·배포 테스트 갱신·관련 문서 정합.
- **비범위**:
  - agents/hooks **자산 자체의 소스·변환 파이프라인**(현재 소스 없음 → 빈 디렉토리만; 실제 agents/hooks 배포는 후속 핸드오프).
  - 플러그인 `.mcp.json` 을 유일 MCP 소스로 승격(사용자 결정으로 런타임 주입 유지 — placeholder 만).
  - `commands/`(레거시) 지원.
  - 다중 엔진(opencode) 플러그인 — `'claude'` 단일.
  - 마켓플레이스/원격 플러그인.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 SDK 옵션: `Options.plugins`(`SdkPluginConfig = { type: 'local'; path: string }`) — `typescript.md:471`, `plugins.md`. **이미 설치된 `@anthropic-ai/claude-agent-sdk`(package.json `latest`) 가 제공** → 신규 의존성 0.
- 재사용 모듈: `config/paths.ts`(경로 SSOT)·`deploy/deployer.ts`(deploy 파이프라인·backup·검증)·`adapters/claude-adapt.ts`(아웃바운드 변환기 패턴)·`skills/scan.ts`(sources 직접 스캔).
- 전제: 플러그인 로드 경로는 **절대경로** 사용(안정성 — `plugins.md:339` 권고). skill 스캔은 sources 직접 읽으므로 재구성 무영향.
- **신규 의존성**: 없음.

## 설계

접근: 기존 `sources→dist` 배포 파이프라인을 **플러그인 레이아웃 렌더러**로 바꾸고, 어댑터 아웃바운드 변환기에 `adaptPlugins` 를 추가해 `options.plugins` 를 주입하며, cwd 싱크 배선을 deploy-only 로 축소한다. 레이어 경계 유지(엔진/플러그인 리터럴은 adapters·deploy·컴포지션 루트에 한함).

- **`config/paths.ts`** (재사용·확장): `distPluginDir(engine)`→`dist/<engine>/plugins/orca`, `pluginManifestPath(engine)`→`…/.claude-plugin/plugin.json`, `distPluginSkillsDir`→`…/skills`, `distPluginMcpJsonPath`→`…/.mcp.json` 헬퍼 추가. 구 `distSkillsDir`/`distMcpJsonPath` 는 플러그인 경로로 대체하거나 참조처와 함께 교체. 플러그인명 `'orca'` 상수화.
- **`deploy/deployer.ts`** (재사용·수정): `copyOrcaSkills` dest 를 `plugins/orca/skills` 로, mcp write dest 를 `plugins/orca/.mcp.json` 로. `plugin.json` 매니페스트 write 추가(name/description/version 상수). `agents/`·`hooks/` `mkdirSync(recursive)`. backup(.bak)·MCP 키 검증·`.orca-deploy.json` 마커·dryRun 계획 문자열은 신 경로로 갱신하되 로직 보존.
- **`adapters/claude-adapt.ts`** (재사용 패턴·추가/수정): `adaptPlugins(pluginDir: string): object` 신설 — `existsSync(join(pluginDir,'.claude-plugin','plugin.json'))` 이면 `{ plugins: [{ type: 'local', path: pluginDir }] }`, 아니면 `{}`(다른 adapt* 와 동일한 "빈 조각 생략" 계약). `adaptSkills` 수정 — 활성 Orca skill 은 `orca:${s.name}`, 어댑터 skill 은 `s.name`. 순수 함수 → 단위 테스트(`claude-adapt.test.ts`) 갱신.
- **`adapters/claude.ts`** (재사용·수정): `sendMessage` 의 query options 에 `...adaptPlugins(distPluginDir('claude'))` 스프레드 추가(`adaptMcp`/`adaptSkills` 인접). `runCompletion`(title 등 maxTurns:1 경로)은 플러그인 불필요 → 미주입(스코프 최소).
- **`ipc/router.ts` + `ipc/chat/send.ts`** (deploy 선행 보장): `syncExtensions`→`deployExtensions`(deploy-only, `syncWorkspaceExtensions` 호출 제거). boot 의 `this.syncExtensions()` 호출은 handler 등록·첫 query 이전이라 선행 1차 보장. cwd 독립이므로 `syncedCwds`(Set)+`syncExtensionsForTurn(cwd)` 를 실행 단위 멱등 가드(`private deployed = false` 또는 플러그인 매니페스트 존재 확인)로 단순화 — 턴 진입에서 미전개면 deploy, 이미면 skip. `RouterContext.syncExtensions/syncExtensionsForTurn` 시그니처·CRUD 호출처(skill/mcp 핸들러)도 deploy-only 로 정합.
- **레이어 준수**: `adaptPlugins`(L2 adapters)가 `config/paths`(L1 domain) 의존 — 하향 OK. `deployer`(L1)는 엔진/플러그인 리터럴 허용(레지스트리 성격). renderer 무관.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **빈 플러그인 자산**: agents/hooks 소스가 없어 빈 디렉토리 → 플러그인은 skill+mcp 만 실효. `plugin.json` 은 유효(빈 하위 디렉토리 허용, `plugins.md:264`).
- **플러그인 루트 부재**: deploy 실패/미실행 시 `adaptPlugins` 가 `{}` 반환 → query 는 플러그인 없이 진행(현행 무-skill 상태와 동형, 크래시 없음). AC#5.
- **skill 네임스페이스 회귀**: Orca skill 이 `orca:name` 로 안 바뀌면 SDK 필터가 매칭 실패해 **전 skill 숨김** 가능 → AC#6 + 단위 테스트. impl 은 SDK init 메시지의 `slash_commands` 로 `orca:<name>` 노출 확인 권장(`plugins.md:100-102`).
- **skill 토글**: 활성/비활성은 여전히 `options.skills` 리스트(런타임 필터)로 반영 → 파일 재전개 불필요(현행 불변식 유지).
- **cwd 잔재**: 기존 세션 cwd 에 남은 `.claude/skills`·`.mcp.json`(이전 싱크 산물) 정리는 비범위(무해 — 더 이상 참조 안 함). 필요 시 후속.
- **동시성**: deploy 는 backup-then-write(비원자적)지만 boot 1회 + CRUD 시점이라 턴과 경합 낮음. 멱등 가드가 중복 deploy 억제.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 플러그인 skill 네임스페이스(`orca:`) 미스매치 → skill 전량 숨김 | AC#6 명시 + `adaptSkills` 단위 테스트 + impl 이 init `slash_commands` 확인. |
| 플러그인 `.mcp.json` 의 미확장 `${VAR}` 서버를 SDK 가 로드 시도 → 인증 실패 서버 등록/경고 | 런타임 `options.mcpServers`(확장본)가 권위 소스로 공존(현행 cwd 미러와 동일 패턴). placeholder 는 구조 완결용. **필요 시 impl 이 플러그인 `.mcp.json` 을 빈 `{"mcpServers":{}}` 로 낮출지 검토(⚠️ 보고만 — 사용자/설계 결정)**. |
| 문서(standardization.md)와 코드가 잠시 어긋남 | AC#11 로 같은 PR 에서 문서 동시 갱신. |
| deploy 비원자성(backup-then-write) 중 크래시 | 기존 .bak 롤링·현행과 동일 위험도(신규 아님). |

- 되돌리기 어려운 결정: dist 레이아웃 변경(구 `.claude/skills`·`.mcp.json` 경로 폐기). — 완화: paths 헬퍼 단일 출처라 되돌림도 국소적.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: 플러그인 `.mcp.json` 을 placeholder 로 둘지 vs 빈 오브젝트로 둘지(위 리스크 표) — 기본값 = placeholder(사용자 확정), impl 이 실측 후 이견 시 ⚠️ 보고.

## 영향 받는 파일

- `app/src/main/config/paths.ts` — 플러그인 경로 헬퍼.
- `app/src/main/deploy/deployer.ts` — 플러그인 레이아웃 렌더 + plugin.json.
- `app/src/main/deploy/workspace-sync.ts` — **삭제**.
- `app/src/main/adapters/claude-adapt.ts` — `adaptPlugins` 신설 · `adaptSkills` 네임스페이스.
- `app/src/main/adapters/claude.ts` — `options.plugins` 주입.
- `app/src/main/ipc/router.ts` · `app/src/main/ipc/chat/send.ts` — deploy-only 축소 + 선행 보장 가드.
- `app/src/main/ipc/context.ts`(RouterContext 시그니처, 필요 시) · skill/mcp 핸들러 호출처.
- `app/src/main/deploy/deployer.test.ts` · `app/src/main/adapters/claude-adapt.test.ts` — 신 레이아웃/네임스페이스 테스트.
- `docs/arch/backend/standardization.md` · `docs/PHASES.md` — 문서 정합.

## 참고 문서

- `@docs/spec/claude/agent-sdk/plugins.md` (플러그인 로드·구조·네임스페이스·트러블슈팅)
- `@docs/spec/claude/agent-sdk/skills.md §77` (플러그인 skill 필터 형식)
- `@docs/spec/claude/agent-sdk/typescript.md:471` (`Options.plugins`)
- `@docs/arch/backend/standardization.md §5.1-§5.2` (배포 계층·소유 모델)
- `@app/src/main/AGENTS.md` (레이어 DAG)
- IPC 변경: **없음**(채널 무변 → `IPC_CONTRACT.md` 갱신 불필요).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: `adaptPlugins`(존재/부재 분기)·`adaptSkills` 네임스페이스(orca vs 어댑터) 순수 함수 테스트, `deployer` 신 레이아웃(plugin.json 내용·skills/.mcp.json 경로·agents/hooks 디렉토리) 테스트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(①~④)를 라이브 세션 요청으로 인용, 추론(skill 네임스페이스)은 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`·SDK 미러)를 붙였다.
- [x] 인수 기준 — 11개 번호, 자료조사 근거, 검증 가능.
- [x] 의존 기술 — SDK `Options.plugins` 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 빈 자산·루트 부재·네임스페이스·토글·cwd 잔재·동시성 엣지케이스 전개.
- [x] 리스크 — 네임스페이스·placeholder MCP 트레이드오프 기재, Open Question(플러그인 `.mcp.json` 형태)은 사용자 결정으로 분리.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint … / typecheck … / test … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | 구현자 코멘트 §… / 사용자 / verify r<N> | … | open / 구현중 / 해결 |
