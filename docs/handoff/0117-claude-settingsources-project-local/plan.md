# Plan — 0117-claude-settingsources-project-local

> `_templates/plan.template.md` 복사본. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.
> 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0117-claude-settingsources-project-local` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 (r2 개정 — 같은 날) |
| 매핑 | PHASES 행 / PR (구현 후) |
| 상태 | DRAFT → READY |

> **r2 개정 요지**: 초안(r1)은 `~/.claude` 디렉토리를 매니페스트 없이 `options.plugins` 에 **직주입**하는 설계였다.
> 사용자 후속 지시(아래 의도 표)로 **얇은 래퍼 플러그인 패턴**으로 전환한다 — 앱 진입(부팅) 준비과정에서
> `~/.config/orca/dist/claude/plugins/claude/` 플러그인(매니페스트 + `skills` 심볼릭링크/정션 → `~/.claude/skills`)을
> 생성해 정식 local plugin 으로 주입한다. 구현 세부는 사용자 제공 가이드
> [`skills-loading-guide.md`](skills-loading-guide.md)(본 디렉토리 보존 원문, 편집 금지) 를 따른다.
> r1 의 `adaptUserClaudePlugin`(매니페스트 가드 미적용)·`mergePlugins` 설계와 "`~/.claude`-as-plugin 검증 완료" 전제는 **폐기**.

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | claude query 호출 시 `options.sourceSettings`(=SDK `settingSources`) 에 `project`, `local` **만** 주입한다. 현재 미입력이라 `user` 소스가 자동 적용돼 provider 전용 `settings.json` 이 반영되지 않는다. | **라이브 세션 요청**(2026-07-16): "options.sourceSettings 필드에 project, local 만 주입 … 현재 미입력으로 user 옵션이 자동으로 적용되고 있어 provider의 전용 settings.json이 반영이 안되고 있음" |
| 명시 요구 (r2 — r1 의 "~/.claude 직주입" supersede) | **앱 진입 시 준비과정에서** `~/.config/orca/dist/claude/plugins/claude` 에 플러그인을 만들고, 그 안에서 `~/.claude/skills` 를 **심볼릭링크**해 플러그인으로 다룬다. 구현 방안은 첨부 가이드를 참고한다. | **라이브 세션 후속 요청**(2026-07-16): "앱 진입시 준비과정에서 ~/.claude/skills를 ~/.config/orca/dist/claude/plugins/claude 플러그인을 만들어 ~/.claude/skills를 심볼릭링크하여 플러그인으로 다룰것. 구현 방안은 첨부 가이드를 참고할 것" + [`skills-loading-guide.md`](skills-loading-guide.md) |
| 명시 요구 | settingSources 는 **양쪽 query 경로 모두**(runCompletion + sendMessage) 적용. | 동 세션 확인 질문 답변("양쪽 모두 (권장)") |
| 추론 의도 | 필드명은 사용자가 `sourceSettings` 로 칭했으나 실제 SDK 옵션명은 `settingSources` 다(아래 조사). 의도는 "user 소스 배제 + skills 보전" 이므로 실제 옵션명으로 구현한다. | 추론 — 조사 `@app/src/main/adapters/claude-adapt.ts:65` |
| 추론 의도 | 래퍼 플러그인은 스킬이 필요한 **sendMessage 경로에만** 주입(제목 생성 1-shot 은 도구/스킬/MCP 미로드). | 추론 — 조사 `@app/src/main/adapters/claude.ts:240-241` |
| 추론 의도 | "앱 진입시 준비과정" = 부팅 배포 스텝. 단 dist 는 매 배포마다 backup-then-write 로 **전체 재생성**되므로(아래 조사), 래퍼 생성을 부팅 1회가 아니라 **deploy 파이프라인 내부**에 두어야 스킬/MCP CRUD 재배포 후에도 살아남는다 — 부팅 배포(`ensureDeployed`)가 이를 포함하므로 "앱 진입시 준비" 요구는 그대로 충족된다. | 추론 — 조사 `@app/src/main/features/extensions/deployer.ts:133-146`, `@app/src/main/app/bootstrap.ts:139-149` |

## Context (왜)

Orca 의 claude 어댑터는 `query()` 호출 시 `options.settingSources` 를 **의도적으로 생략**해
SDK 기본(user/project/local) 소스를 상속해 왔다(handoff 0023/0028 결정, `@app/src/main/adapters/claude-adapt.ts:63-66`).
이 때문에 사용자 전역 `~/.claude/settings.json`(user 소스)이 자동 로드되어, provider 전용
`settings.json`(앱이 `options.settings` flag 로 주입) 이 **깔끔하게 반영되지 않는** 문제가 관측됐다.

해법: `settingSources` 에 `project`, `local` 만 명시해 `user` 소스를 배제한다. 단 `user` 배제는
`~/.claude/skills`(어댑터/네이티브 스킬) 탐색까지 끊는다 — 이 스킬들은 dist 로 복사되지 않고
오직 user 소스로만 발견되기 때문(`@app/src/main/features/extensions/deployer.test.ts:146`).
SDK 의 skill 탐색 경로는 settingSources 에 하드와이어링되어 있고 skill 디렉토리만 지정하는 옵션은
없으며, settingSources 외에 skill 을 세션에 넣는 유일한 공식 경로는 `plugins` 옵션이다
(가이드 §2 — `.claude-plugin/plugin.json` 매니페스트 + `skills/<이름>/SKILL.md` 구조 필수).

보전책(r2): **얇은 래퍼 플러그인 패턴**(가이드 §3). deploy 파이프라인이
`dist/claude/plugins/claude/` 에 매니페스트(`.claude-plugin/plugin.json`)와
`skills` 링크(Windows 정션 / POSIX 심링크 → `~/.claude/skills`)만 담은 최소 플러그인을 생성하고,
sendMessage 가 orca 플러그인과 함께 `options.plugins` 로 주입한다. 매니페스트가 있는 정규
플러그인이므로 기존 `adaptPlugins` 매니페스트 가드를 그대로 재사용할 수 있다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| SDK 는 `@anthropic-ai/claude-agent-sdk`(package.json `"latest"`). `query()` 호출은 `claude.ts` 단일 파일 2개 call site. | `@app/package.json:33`, `@app/src/main/adapters/claude.ts:252`·`:322` |
| **runCompletion**(제목 생성 1-shot): 옵션 조립 `claude.ts:235-248`. plugins/skills/MCP 미로드(1-shot 요약이라 불필요, 주석 명시). `adaptSettings`·`adaptEnv` 만 spread. | `@app/src/main/adapters/claude.ts:235-248` (특히 240-241 주석) |
| **sendMessage**(실채팅): 옵션 조립 `claude.ts:322-388`. `adaptPlugins`(348)·`adaptSkills`(349)·`adaptSettings`(354)·`adaptEnv`(355) spread. | `@app/src/main/adapters/claude.ts:322-388` |
| `settingSources`/`SettingSource` 는 코드 어디에도 세팅되지 않음 — **의도적 생략**. flag settings(`options.settings`)가 상속된 user/project/local 위에 얹힌다는 설계. | `@app/src/main/adapters/claude-adapt.ts:63-66`, `claude.ts:232-233`·`:351-353`, `conformance.ts:31`·`:63` |
| `adaptSettings`(claude-adapt.ts:77-79)는 provider settings 를 **인라인 JSON 문자열**(`options.settings`)로 주입. settingSources 는 다루지 않음(반환에 부재). | `@app/src/main/adapters/claude-adapt.ts:77-79` |
| `adaptPlugins`(claude-adapt.ts:36-40)는 plugin root 하나를 `{plugins:[{type:'local',path}]}` 로. `.claude-plugin/plugin.json` 이 **없으면 생략**(가드) — 래퍼 플러그인은 매니페스트를 가지므로 이 가드를 그대로 태울 수 있다. | `@app/src/main/adapters/claude-adapt.ts:36-40` |
| plugins 로 로드된 skill 은 `플러그인이름:skill이름` 네임스페이스가 붙는다. `skills` 필터에 이름을 넣을 때 네임스페이스를 고려해야 한다. | 가이드 §2 ([`skills-loading-guide.md`](skills-loading-guide.md)) |
| `adaptSkills`(claude-adapt.ts:55-61)는 `options.skills` 를 활성 목록/`'all'` 로 필터. plugin 스킬은 `orca:` prefix, 어댑터/네이티브 스킬은 현재 **bare name** — 래퍼 플러그인 전환 시 어댑터 스킬도 `claude:` 네임스페이스가 붙으므로 `adaptSkillNameForClaude` 를 함께 바꿔야 필터가 어긋나지 않는다. | `@app/src/main/adapters/claude-adapt.ts:50-61`, `@app/src/main/adapters/claude-plugin.ts:12-14` |
| 어댑터/네이티브 스킬은 dist 로 복사하지 않고 **SDK settingSources:user 가 `~/.claude` 에서 직접 탐색**한다는 것이 코드 자신의 전제 — user 배제 시 이 스킬 유실 확정. | `@app/src/main/features/extensions/deployer.test.ts:146` |
| `~/.claude/skills` 는 이미 skill 스캔 루트(`sourceId: 'adapter:claude'`, `sourceKind: 'adapter'`)로 등록되어 UI 목록에 노출 중 — 스캔 경로 상수 재사용 가능. | `@app/src/main/app/bootstrap.ts:113-128` |
| plugin 패키지 레이아웃(.claude-plugin/plugin.json·skills·.mcp.json) 소유자는 `features/extensions/claude-plugin-package.ts`(`renderClaudePluginPackage`) — 래퍼 플러그인 렌더도 같은 슬라이스에 둔다. | `@app/src/main/features/extensions/claude-plugin-package.ts:51-77`, `@app/src/main/infra/config/paths.ts:129-133` |
| deploy 는 **backup-then-write**: 기존 `dist/<engine>` 전체를 `.bak` 으로 rename 후 재렌더. 부팅 스텝(`ensureDeployed`)과 스킬/MCP CRUD(`deployNow`)가 호출 — 래퍼 플러그인을 deploy 밖(부팅 1회)에서 만들면 첫 CRUD 재배포에서 소실된다. | `@app/src/main/features/extensions/deployer.ts:133-146`, `@app/src/main/features/extensions/extension-deployment-service.ts:20-59`, `@app/src/main/app/bootstrap.ts:139-149` |
| deployer/plugin-package 는 **동기 fs 금지**(0109 — 부팅·CRUD 경로 이벤트 루프 보호). 링크 생성도 `node:fs/promises` 의 `symlink(target, path, 'junction')` 를 쓴다. | `@app/src/main/features/extensions/deployer.ts:15-18`, `@app/src/main/features/extensions/claude-plugin-package.ts:5` |
| Windows 심볼릭 링크는 관리자 권한/개발자 모드 필요 → 배포 앱에서 전제 불가. **디렉토리 정션(Junction)** 은 일반 권한으로 생성 가능. Node `symlink(target, path, 'junction')` 이 지원하며 macOS/Linux 에선 세 번째 인자가 무시되고 일반 심링크로 동작 — 크로스 플랫폼 코드 1벌. | 가이드 §3 ([`skills-loading-guide.md`](skills-loading-guide.md)) |
| 정션 경유 skill 로딩은 SDK 문서에 명시 보장된 사항은 아님 — init 메시지 검증에서 미인식이면 **복사 동기화 폴백**으로 전환한다(가이드 §6). | 가이드 §4.3·§6 |
| sendMessage 의 plugin root 전달 경로: bootstrap `() => distOrcaPluginDir('claude')` → `ExtensionBuilder.pluginRoot` → `TurnExtensions.pluginRoot`(단수 string) → `adaptPlugins`. 두 번째 플러그인을 넣으려면 이 배선을 복수화해야 한다. | `@app/src/main/app/bootstrap.ts:211`, `@app/src/main/features/extensions/builder.ts:24`·`:60-65`, `@app/src/main/adapters/turn.ts:73` |
| 기존 테스트 `claude-adapt.test.ts:110` 가 `adaptSettings` 출력에 `'settingSources' in out === false` 를 단언 — settingSources 를 `adaptSettings` 와 **분리**하면 이 단언은 그대로 유효. | `@app/src/main/adapters/claude-adapt.test.ts:98-120` |
| conformance `settings.mechanism` 유니온 리터럴 `'sdk_flag_settings_default_sources'` 및 주석이 "기본 소스 상속" 서술. 의미 반전 필요. | `@app/src/main/features/extensions/conformance.ts:31`·`:60-65` |
| 디버그 wire log(0025) 로 init 계열 이벤트를 터미널에서 관찰 가능 — 가이드 §4.3 의 로딩 검증(플러그인/skills/plugin_errors)을 실기에서 확인하는 채널. | `@docs/handoff/0025-debug-wire-log-toggle/`, 가이드 §4.3 |

## 인수 기준 (Acceptance Criteria)

1. `runCompletion`·`sendMessage` 양쪽 query 옵션에 `settingSources: ['project', 'local']` 가 존재한다(`user` 부재).
2. deploy 실행 후(`~/.claude/skills` 존재 시) `dist/claude/plugins/claude/` 에 래퍼 플러그인이 생성된다 — `.claude-plugin/plugin.json`(name=`claude`) + `skills` 링크(Windows 정션/POSIX 심링크)가 `~/.claude/skills` 를 가리킨다. 부팅 배포(`ensureDeployed`)와 CRUD 재배포(`deployNow`) 모두에서 재생성된다.
3. `~/.claude/skills` 부재 시 래퍼 플러그인을 만들지 않고 오류 없이 진행한다. 링크 생성 실패(권한·볼륨 등)도 경고 로그 후 스킬 없이 계속한다(graceful degradation — 앱 크래시 금지).
4. `sendMessage` 의 `options.plugins` 가 orca 플러그인과 `claude` 래퍼 플러그인을 **둘 다** 담는다(각각 매니페스트 존재 시 — 하나만 있으면 그것만, 둘 다 없으면 `plugins` 키 생략).
5. provider 전용 `settings.json` 값이 `~/.claude/settings.json` 개입 없이 `options.settings` flag 로 그대로 적용된다.
6. `adaptSkillNameForClaude` 가 어댑터 스킬(`sourceKind: 'adapter'`)에 `claude:` 네임스페이스를 부여해 `options.skills` 필터가 래퍼 플러그인의 발견 이름과 일치한다.
7. deploy 의 backup(`rename dist → .bak`)·`rm`(.bak 롤링 삭제) 사이클이 링크 **대상**(`~/.claude/skills` 원본)을 삭제·변형하지 않는다(링크 자체만 이동/삭제 — 단위 테스트로 고정).
8. `~/.claude/skills` 스킬이 채팅 세션에서 `claude:*` 네임스페이스로 계속 노출된다(사람 실기 — wire log 로 init 의 plugins/skills/plugin_errors 확인, §검증 책임 분리).
9. settingSources 관련 오래된 주석·테스트 설명 문자열이 새 설계("`['project','local']` 명시·user 배제·skills 는 래퍼 플러그인으로 보전")와 정합한다.
10. 신규 함수(`adaptSettingSources`·복수 root `adaptPlugins`·`renderClaudeUserSkillsPlugin`·`adaptSkillNameForClaude` 변경)에 단위 테스트가 동반된다.

## 범위 / 비범위

- **범위**: `claude.ts` 2개 call site 옵션 조립 + `claude-adapt.ts`(settingSources 조각·plugins 복수화) + `features/extensions` 래퍼 플러그인 렌더(+deployer 편입) + `claude-plugin.ts` 네임스페이스 + plugin root 배선 복수화(paths/builder/bootstrap/turn) + 관련 주석/테스트 문자열 정합 + 단위 테스트.
- **비범위**:
  - conformance `settings.mechanism` **유니온 타입 리터럴** 자체 rename(`'sdk_flag_settings_default_sources'` → 신 명칭) — 타입·소비처 파급이라 선택적 후속(주석만 이번에 정정).
  - 정션 미동작 시 **복사 동기화 폴백**(가이드 §6) 구현 — 실기 검증(AC#8) 실패 시 후속 라운드/핸드오프로 전환.
  - opencode 등 타 어댑터 스킬 래핑(가이드 §4.2 의 opencode-skills 예시), mock 어댑터.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 SDK 옵션: `Options.settingSources`(`SettingSource[]` = `('user'|'project'|'local')[]`), `Options.plugins`(`{type:'local', path}[]` — plugin 루트에 `.claude-plugin/plugin.json` 필수, skill 은 `skills/<이름>/SKILL.md` 구조, 가이드 §2). **신규 의존성 없음**(기존 SDK 옵션 + node:fs).
- 재사용 모듈: `node:fs/promises` 의 `symlink`·`lstat`·`readlink`·`rm`·`mkdir`·`writeFile`(0109 — 동기 fs 금지), `homedir`+`join`(bootstrap `skillRoots` 패턴), `renderClaudePluginPackage` 의 레이아웃 관례, `adaptPlugins` 매니페스트 가드.
- 전제: Windows 정션은 일반 권한으로 생성 가능하고 SDK plugin 로더가 정션 경유 skills 디렉토리를 투명하게 스캔한다(가이드 §3 — 단 SDK 보장 아님 → AC#8 실기 + 폴백 §6 을 비범위 후속으로 명시). Electron main 프로세스에서 수행(가이드 §3 둘째 — 현행 deploy 가 이미 main).
- 레이어: 래퍼 렌더=`features/extensions`(deploy 파이프라인), 옵션 조각=`adapters`(순수 함수), 배선=`app`(컴포지션 루트) — main DAG 하향 의존 준수, 신규 IPC/계약 없음.

## 설계

접근: (a) deploy 파이프라인이 래퍼 플러그인을 렌더하고, (b) `claude-adapt.ts` 에 settingSources 조각을 추가하며 plugins 조각을 복수 root 로 일반화하고, (c) `claude.ts` 2개 call site 에서 spread 한다. r1 의 `adaptUserClaudePlugin`·`mergePlugins` 는 만들지 않는다(래퍼가 정규 매니페스트를 가지므로 `adaptPlugins` 가드 재사용 + 복수화로 충분).

### `app/src/main/features/extensions/claude-user-skills-plugin.ts` (신규)

- **`renderClaudeUserSkillsPlugin(input: { root: string; engine: Backend; skillsTarget?: string }): Promise<string | null>`**
  — `skillsTarget` 기본값 `join(homedir(), '.claude', 'skills')`(테스트는 임시 디렉토리 주입, deployer 의 root 주입 관례와 동일).
  1. `skillsTarget` 부재(디렉토리 아님 포함) → **null 반환, 아무것도 만들지 않음**(가이드 §4.1 — 클린 머신 정상).
  2. `dist/<engine>/plugins/claude/.claude-plugin/plugin.json` 기록 — `{ name: 'claude', description: '사용자 ~/.claude/skills 래퍼', version: '1.0.0' }`(매니페스트 상수는 `ORCA_PLUGIN_MANIFEST` 관례를 따라 본 모듈이 소유).
  3. `dist/<engine>/plugins/claude/skills` 에 `symlink(skillsTarget, link, 'junction')` — Windows 정션(관리자 권한 불필요)/POSIX 심링크. 기존 링크가 있으면(잔존·깨진 링크 포함) `rm` 후 재생성(멱등 — 가이드 §4.1). deploy 가 dist 를 매번 재생성하므로 보통은 빈 자리지만, 백업 실패로 dist 를 지우지 못한 경로(deployer.ts:143-145)도 방어한다.
  4. 링크 생성 실패(EPERM 등) → **경고 로그 + null 반환**(가이드 §5 — graceful degradation, 크래시 금지). 이때 매니페스트만 남으면 `adaptPlugins` 가드가 통과시키므로 실패 시 플러그인 디렉토리를 `rm` 으로 정리한다.
- 전부 `node:fs/promises`(0109 — 동기 fs 금지).
- **호출 지점 = `deploy()`**(`deployer.ts`) — `renderClaudePluginPackage` 다음에 호출하고 결과를 `actions` 에 기록(`render user-skills plugin → dist/plugins/claude` / `skip user-skills plugin (no ~/.claude/skills)`). dryRun 분기에도 계획 문구 추가. 부팅 배포(`ensureDeployed`)가 이 경로를 지나므로 "앱 진입시 준비과정" 요구 충족, CRUD 재배포마다 재생성되어 정션 무효화(사용자가 `~/.claude/skills` 삭제 후 재생성)도 다음 배포에서 자가 치유된다(가이드 §5).

### `app/src/main/infra/config/paths.ts`

- **`distUserClaudePluginDir(engine: Backend): string`** = `join(distPluginsDir(engine), 'claude')` — `distOrcaPluginDir` 대칭. 파일 상단 레이아웃 다이어그램에 `plugins/claude/` 줄 추가.

### `app/src/main/adapters/claude-plugin.ts`

- **`CLAUDE_USER_PLUGIN_NAME = 'claude'`** 상수 신설(플러그인 이름 = 네임스페이스 prefix 의 SSOT — extensions 렌더와 어댑터 필터가 공유).
- **`adaptSkillNameForClaude` 변경**: `sourceKind === 'orca'` → `orca:` prefix(불변), **`sourceKind === 'adapter'` → `claude:` prefix**(래퍼 플러그인 경유 발견 이름과 일치). 그 외 sourceKind 는 bare 유지.

### `app/src/main/adapters/claude-adapt.ts`

- **`adaptSettingSources(): object`** → `{ settingSources: ['project', 'local'] }` 를 항상 반환.
  provider settings 유무와 **무관**(그래서 `adaptSettings` 와 분리 — 기존 반환·`claude-adapt.test.ts:110` 단언 불변).
- **`adaptPlugins` 복수화**: 시그니처를 `adaptPlugins(pluginRoots?: readonly (string | null | undefined)[])` 로 — 각 root 에 기존 가드(비어있지 않음 + `.claude-plugin/plugin.json` 존재)를 적용해 통과한 것만 `{plugins:[…]}` 배열로 합치고, 전부 탈락이면 `{}`(AC#4). 단일 root 호출자는 배열로 감싼다.

### `app/src/main/adapters/turn.ts` · `features/extensions/builder.ts` · `app/bootstrap.ts` (배선 복수화)

- `TurnExtensions.pluginRoot?: string` → **`pluginRoots?: string[]`**.
- `ExtensionBuilder` 생성자 콜백 `pluginRoot?: () => string | undefined` → `pluginRoots?: () => string[]`.
- bootstrap 주입: `() => [distOrcaPluginDir('claude'), distUserClaudePluginDir('claude')]` — 존재 검증은 `adaptPlugins` 가드 몫(builder 는 백엔드 중립·fs 비접촉 유지).

### `app/src/main/adapters/claude.ts` (query 조립)

- `runCompletion`(235-248): 옵션 객체에 `...adaptSettingSources()` 추가(plugins 주입 없음 — 1-shot).
- `sendMessage`(322-388): `...adaptSettingSources()` 추가 + `...adaptPlugins(extensions.pluginRoot)`(348) → `...adaptPlugins(extensions.pluginRoots)`.

### 주석·계약 정합 (설계 결정 반전 반영)

"settingSources 생략 → 기본 소스 상속" 서술을 "`['project','local']` 명시·user 배제·skills 는 래퍼 플러그인(정션)으로 보전" 으로 갱신:
- `claude.ts:232-233`, `claude.ts:351-353` (주석)
- `conformance.ts:31`, `conformance.ts:60-65` (주석 — 유니온 리터럴 값 자체는 비범위), `conformance.ts:54` `compatibilityPaths` 서술 점검
- `deployer.test.ts:146` (테스트 설명 문자열: "settingSources:user 가 … 직접 탐색" → "dist/plugins/claude 래퍼 플러그인(정션)으로 탐색"; 어서션 로직 불변)
- `claude-adapt.ts:50-54`(`adaptSkills` 상단)·`:63-66`(`adaptSettings` 상단), `claude-plugin.ts` 상단
- `turn.ts:113`, `types.ts:43` (주석)

### 로딩 검증 (가이드 §4.3)

앱 로직 검증 내장은 이번 범위에서 **wire log 실기 절차로 갈음**한다 — 디버그 패널 "Wire 메시지" 토글(0025) 후 세션 시작 → init 이벤트의 plugins 배열·skills 목록(`claude:*` 포함)·plugin_errors 빈 값 확인. 배포 빌드 1회 검증(asar 패키징 후, 가이드 §5)은 사람 실기 항목.

### 테스트

- 신규 `claude-user-skills-plugin.test.ts`: 대상 부재 → null·미생성 / 생성 → 매니페스트 내용 + 링크가 대상 가리킴(`readlink`) / 잔존 링크 재생성(멱등) / **백업·삭제 안전성**: 링크를 담은 dist 를 `rename`→`rm` 해도 대상 디렉토리 원본이 살아있음(AC#7 — POSIX 심링크로 검증, Windows 정션 동등성은 CI windows-latest 가 커버).
- `claude-adapt.test.ts`: `adaptSettingSources` 반환값 / `adaptPlugins` 복수 root(0·1·2개, 매니페스트 유무 조합, 전부 탈락 시 `{}`).
- `claude-plugin` 네임스페이스: adapter 스킬 → `claude:` prefix, orca → `orca:`(기존), 기타 bare.
- `deployer.test.ts`: deploy 후 래퍼 플러그인 산출(대상 주입) + actions 문구.
- 기존 `adaptSettings` 테스트(98-120) 불변. `adaptPlugins` 기존 테스트는 배열 시그니처로 조정.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **빈 상태**: `~/.claude/skills` 미존재(신규 사용자/클린 머신) → 래퍼 미생성, orca plugin 만. 오류 없이 진행(AC#3, 가이드 §5 "배포 앱에서는 부재가 정상").
- **정션 무효화**: 사용자가 `~/.claude/skills` 를 앱 실행 중 삭제 → 링크가 깨지지만 크래시 없음(SDK 는 스킬 미발견으로 강등). 다음 배포(부팅/CRUD)에서 대상 부재 → 래퍼 미생성으로 수렴, 재생성 시 복구(가이드 §5).
- **네임스페이스 전환**: 어댑터 스킬 이름이 세션 관점에서 bare → `claude:*` 로 바뀐다. 모델의 description 기반 자율 호출은 영향 없음(가이드 §2). 사용자가 스킬을 이름으로 명시 호출하는 경우 네임스페이스 표기가 필요할 수 있다 — UI 스킬 목록(`SkillInfo`) 표기는 불변, 실기에서 관찰.
- **타 도구 frontmatter**: `~/.claude/skills` 에 비표준 frontmatter SKILL.md 가 있으면 SDK 인식이 불확실 — init 검증에서 미인식 시 개별 스킬 문제로 취급(가이드 §5), 앱 동작엔 영향 없음.
- **동시성/멀티세션**: 래퍼 렌더는 deploy 직렬화(`ExtensionDeploymentService` in-flight 코얼레스) 안에서 수행 — 경합 없음. 옵션 조각은 순수 함수라 세션 간 공유 상태 없음.
- 테마/접근성/키보드: 백엔드 변경이라 해당 없음(N/A).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 정션/심링크 경유 skill 로딩이 SDK 문서에 명시 보장되지 않음 | 실기 검증(AC#8 — wire log 로 init skills/plugin_errors 확인). 미인식 시 **복사 동기화 폴백**(가이드 §6)으로 후속 전환(비범위 명시). |
| deploy 백업/삭제 사이클이 링크를 따라가 `~/.claude/skills` **원본을 삭제**할 위험 | Node `rename`/`rm` 은 링크 자체를 이동/삭제하고 대상을 따라가지 않는다 — AC#7 단위 테스트로 고정(POSIX), Windows 정션은 CI(windows-latest)로 확인. `cp` 계열(copyOrcaSkills)은 래퍼 경로를 건드리지 않음. |
| Windows 에서 정션 생성 실패(권한·비NTFS 볼륨 등) | 경고 로그 + 래퍼 생략(스킬 없이 동작 — 가이드 §5 graceful degradation). 크래시 금지(AC#3). |
| 어댑터 스킬 네임스페이스 전환(`bare` → `claude:*`)이 스킬 명시 호출·기존 사용 습관과 어긋날 가능성 | 자율 호출은 무영향(가이드 §2). UI 표기는 `SkillInfo` 기준 불변. 실기 관찰 후 문제 시 후속. |
| 플러그인 이름 `claude` 가 SDK 예약어/기존 플러그인과 충돌할 가능성 | 사용자 지정 경로·이름(명시 요구). 실기(AC#8)에서 plugin_errors 로 확인 — 충돌 시 이름만 후속 조정(경로 상수 1곳). |
| user 소스 배제로 provider blob 이 불완전하면 이전 `~/.claude/settings.json` 이 채우던 값 소실 | **의도된 동작**(provider 전용 settings 우선). provider settings.json 완결성 전제. |
| asar 패키징 빌드에서 dev 와 다른 거동(SDK spawn·경로) | 기존 배포 검증 절차(0105 실행파일 해석) 위에서 배포 빌드 1회 사람 실기(가이드 §5·§8-5). |
| handoff 0023/0028 의 "settingSources 생략" 결정을 반전 | 본 plan 이 supersede — 0023/0028 은 historical 보존(미수정), 주석/문자열만 현행화. |

- 되돌리기 어려운 결정: 없음(옵션 조립 + dist 산출물 변경 — dist 는 매 배포 재생성이라 역전 용이).
- **단독 결정 금지 항목(Open Question)**: 없음(방식·경로는 사용자 명시 지시 + 첨부 가이드).

## 영향 받는 파일

- `app/src/main/features/extensions/claude-user-skills-plugin.ts` (신규 — 래퍼 플러그인 렌더)
- `app/src/main/features/extensions/deployer.ts` (래퍼 렌더 호출 + actions/dryRun 문구)
- `app/src/main/infra/config/paths.ts` (`distUserClaudePluginDir` + 레이아웃 다이어그램)
- `app/src/main/adapters/claude-plugin.ts` (`CLAUDE_USER_PLUGIN_NAME` + `adaptSkillNameForClaude`)
- `app/src/main/adapters/claude-adapt.ts` (`adaptSettingSources` 신규 + `adaptPlugins` 복수화 + 주석)
- `app/src/main/adapters/claude.ts` (2 call site + 주석)
- `app/src/main/adapters/turn.ts` (`pluginRoots` 복수화 + 주석) · `app/src/main/adapters/types.ts` (주석)
- `app/src/main/features/extensions/builder.ts` · `app/src/main/app/bootstrap.ts` (배선 복수화)
- `app/src/main/features/extensions/conformance.ts` (주석)
- 테스트: `claude-user-skills-plugin.test.ts`(신규) · `claude-adapt.test.ts` · `deployer.test.ts` · claude-plugin 네임스페이스 테스트

## 참고 문서

- [`skills-loading-guide.md`](skills-loading-guide.md) — **사용자 제공 구현 가이드 원문**(본 디렉토리 보존, 편집 금지). 래퍼 플러그인 패턴·정션·검증·폴백의 1차 출처.
- `docs/arch/backend/standardization.md §2/§5` (skill/settings 표준·배포 계층)
- `docs/arch/backend/system-prompt.md §5` (settingSources Open Question 계열)
- `docs/handoff/0023-skill-mcp-isolation-docs/`·`0024-skill-mcp-isolation-impl/`·`0028-*` (본 plan 이 반전하는 이전 결정), `0025-debug-wire-log-toggle/` (실기 검증 채널), `0109-boot-window-first-async-deploy/` (동기 fs 금지)
- IPC 변경 없음 → `IPC_CONTRACT.md` 갱신 불요.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
  - 제약 환경(egress 차단) 시 lint + typecheck + 순수(비-DB) vitest 로 판정, DB 로드 스위트 실패는 알려진 ABI 베이스라인으로 분리 보고(`app/AGENTS.md` 게이트 가이드).
- 신규 테스트 요구: 위 "테스트" 절 — 래퍼 렌더(부재/생성/멱등/백업 안전성)·`adaptSettingSources`·복수 root `adaptPlugins`·네임스페이스.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청 + 첨부 가이드로 인용, 추론은 추론으로 표기, r1 폐기 사항 명시.
- [x] 자료조사 — 모든 발견에 `파일:라인` 또는 가이드 절 레퍼런스 부착.
- [x] 인수 기준 — 번호 매김, 조사 근거, 검증 가능(사람 실기 항목은 §검증 분리로 명시).
- [x] 의존 기술 — SDK 옵션·node:fs·재사용 모듈·전제(정션) 식별, 신규 의존성 0.
- [x] 파생 UX — 빈 상태·정션 무효화·네임스페이스 전환·동시성 엣지케이스 전개(무관 항목 N/A 표기).
- [x] 리스크 — 트레이드오프·supersede·폴백 경로 기재, Open Question 0(방식은 사용자 명시 지시).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 작업은 기능/어댑터 옵션 변경으로 Codex 몫이었으나, **사용자 명시 지시(2026-07-16 "수석엔지니어의 실무적 관점에서, orca 규칙을 준수하여 구현하라")로 Claude 가 직접 구현**했다 — 핸드오프 절차(plan→impl→verify)와 구현 커밋 trailer 는 동일하게 따른다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 래퍼 렌더의 deploy 파이프라인 편입(§설계 — dist wipe 생존), `adaptPlugins` 복수화로 `mergePlugins` 불요, 어댑터 스킬 `claude:` 네임스페이스 전환, 실패 시 플러그인 디렉토리째 정리(매니페스트 잔존 → 가드 오통과 방지). 전부 설계대로 구현.
- 이견 / 우려(경미·설계 취지 내 정제): 설계는 `renderClaudeUserSkillsPlugin` 의 `skillsTarget` 기본값을 `join(homedir(), '.claude', 'skills')` 로 뒀으나, **deployer 는 homedir 비의존이 자기 원칙**(deployer.ts 상단 주석 — root 주입으로 테스트 용이성 확보)이다. 기본값 대신 `deploy()` 가 `opts.skillRoots` 의 `adapter:<engine>` 루트에서 파생해 명시 전달하도록 했다 — homedir 리터럴은 기존대로 bootstrap(`skillRoots()`) 단독 소유, 테스트는 임시 경로 주입. 프로덕션 경로는 동일 결과(bootstrap 이 항상 adapter:claude 루트를 skillRoots 로 전달).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `skillsTarget` homedir 기본값이 deployer 의 homedir 비의존 원칙과 충돌 | ✅ 구현함 — `deploy()` 가 skillRoots(adapter:claude)에서 파생·명시 전달, 렌더러는 기본값 없음 | `deployer.ts` 상단 주석("root 를 받아 상대 경로로 계산 — homedir 비의존"), 설계 리뷰 참조 |
| 2 | 링크 실패 후 매니페스트만 잔존하면 `adaptPlugins` 가드가 **빈 플러그인을 통과**시킴 | ✅ 구현함 — 실패 catch 에서 플러그인 디렉토리째 `rm`(설계에 명시된 사항의 코드화) | `claude-user-skills-plugin.ts` catch 절 |
| 3 | 백업 실패 폴백(deployer 가 dist 를 rm 으로만 정리) 경로에서 잔존 링크/실디렉토리 위에 재렌더 가능 | ✅ 구현함 — 렌더러가 `rm(skillsLink)` 후 `symlink`(멱등), 실디렉토리 잔존물(복사 폴백 잔재)도 교체. 테스트 고정 | `claude-user-skills-plugin.test.ts` "잔존 링크"·"실디렉토리 잔존물" 케이스 |

## [구현자 기입] 구현 체크리스트

- [x] `renderClaudeUserSkillsPlugin` 신규(부재 스킵·정션/심링크·graceful 실패) + `deploy()` 편입(actions/dryRun)
- [x] `distUserClaudePluginDir` + paths 레이아웃 다이어그램
- [x] `CLAUDE_USER_PLUGIN_NAME` + `adaptSkillNameForClaude` adapter → `claude:` 네임스페이스
- [x] `adaptSettingSources` 신규 + 양쪽 call site spread
- [x] `adaptPlugins` 복수 root 화 + `TurnExtensions.pluginRoots`·builder·bootstrap 배선
- [x] 주석/테스트 문자열 정합(claude.ts·conformance.ts·deployer.test.ts·turn.ts·types.ts·claude-adapt.ts·claude-plugin.ts·paths.ts)
- [x] 단위 테스트(래퍼 렌더·백업 안전성·settingSources·복수 plugins·네임스페이스)
- [x] 게이트 lint/typecheck/test

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규: `features/extensions/claude-user-skills-plugin.ts`(+`.test.ts`), `adapters/claude-plugin.test.ts`. 수정: `features/extensions/deployer.ts`(+`.test.ts`), `infra/config/paths.ts`, `adapters/claude-plugin.ts`, `adapters/claude-adapt.ts`(+`.test.ts`), `adapters/claude.ts`, `adapters/turn.ts`, `adapters/types.ts`, `features/extensions/builder.ts`, `features/extensions/conformance.ts`, `app/bootstrap.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` + `node --test scripts/*.test.mjs` (제약 환경 — `npm ci` 의 electron ABI postinstall 403 실패 후 `npm rebuild better-sqlite3` Node ABI 소스 컴파일) |
| 게이트 결과 | lint ✅(에러 0 — 경고 1건은 기존 `useTranscriptVirtualizer` react-hooks 라이브러리 경고, 무관) / typecheck ✅(node·web·test 3분할 전부) / test **915/915 passed**(119 파일) + scripts node:test 25/25 — 실패 스위트 1건(`chat-turn.continuity.test.ts`)은 electron 바이너리 egress 403 로드 불가(알려진 환경 베이스라인, `app/AGENTS.md` 게이트 가이드 — 본 변경 무관) |
| 블로커 / 역질문 | 없음. AC#5(provider settings 실기)·AC#8(스킬 `claude:*` 노출 실기 — wire log)은 사람 실기 대기. 배포 빌드(asar) 검증도 사람 몫(가이드 §5). |
| 대상 커밋 | push 후 INDEX 기재 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| | | | | |
