# Plan — 0117-claude-settingsources-project-local

> `_templates/plan.template.md` 복사본. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.
> 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0117-claude-settingsources-project-local` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | PHASES 행 / PR (구현 후) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | claude query 호출 시 `options.sourceSettings`(=SDK `settingSources`) 에 `project`, `local` **만** 주입한다. 현재 미입력이라 `user` 소스가 자동 적용돼 provider 전용 `settings.json` 이 반영되지 않는다. | **라이브 세션 요청**(2026-07-16): "options.sourceSettings 필드에 project, local 만 주입 … 현재 미입력으로 user 옵션이 자동으로 적용되고 있어 provider의 전용 settings.json이 반영이 안되고 있음" |
| 명시 요구 | `user` 를 빼면 `~/.claude/skills` 가 노출되지 않으므로, 이를 극복하려 `options.plugins` 필드에 `~/.claude` 를 주입한다. | 동 세션 "주의 사항: sourceSettings 필두에 user를 제외하면 ~/.claude/skills 는 노출이 안 되게 된다. 이를 극복하기 위해 options.plugins 필드에 ~/.claude를 주입한다" |
| 명시 요구 | settingSources 는 **양쪽 query 경로 모두**(runCompletion + sendMessage) 적용. | 동 세션 확인 질문 답변("양쪽 모두 (권장)") |
| 명시 요구 | `~/.claude`-as-plugin 이 스킬을 정상 노출함은 **이미 검증됨** — 폴백 없이 지시대로 진행. | 동 세션 확인 질문 답변("확인됨 — 그대로 진행") |
| 추론 의도 | 필드명은 사용자가 `sourceSettings` 로 칭했으나 실제 SDK 옵션명은 `settingSources` 다(아래 조사). 의도는 "user 소스 배제 + skills 보전" 이므로 실제 옵션명으로 구현한다. | 추론 — 조사 `@app/src/main/adapters/claude-adapt.ts:65` |
| 추론 의도 | `~/.claude` plugin 은 스킬이 필요한 **sendMessage 경로에만** 주입(제목 생성 1-shot 은 도구/스킬/MCP 미로드). | 추론 — 조사 `@app/src/main/adapters/claude.ts:240-241` |

## Context (왜)

Orca 의 claude 어댑터는 `query()` 호출 시 `options.settingSources` 를 **의도적으로 생략**해
SDK 기본(user/project/local) 소스를 상속해 왔다(handoff 0023/0028 결정, `@app/src/main/adapters/claude-adapt.ts:63-66`).
이 때문에 사용자 전역 `~/.claude/settings.json`(user 소스)이 자동 로드되어, provider 전용
`settings.json`(앱이 `options.settings` flag 로 주입) 이 **깔끔하게 반영되지 않는** 문제가 관측됐다.

해법: `settingSources` 에 `project`, `local` 만 명시해 `user` 소스를 배제한다. 단 `user` 배제는
`~/.claude/skills`(어댑터/네이티브 스킬) 탐색까지 끊는다 — 이 스킬들은 dist 로 복사되지 않고
오직 user 소스로만 발견되기 때문(`@app/src/main/features/extensions/deployer.test.ts:146`).
보전책으로 `options.plugins` 에 `~/.claude` 를 로컬 플러그인으로 함께 주입한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| SDK 는 `@anthropic-ai/claude-agent-sdk`(package.json `"latest"`). `query()` 호출은 `claude.ts` 단일 파일 2개 call site. | `@app/package.json:33`, `@app/src/main/adapters/claude.ts:252`·`:322` |
| **runCompletion**(제목 생성 1-shot): 옵션 조립 `claude.ts:235-248`. plugins/skills/MCP 미로드(1-shot 요약이라 불필요, 주석 명시). `adaptSettings`·`adaptEnv` 만 spread. | `@app/src/main/adapters/claude.ts:235-248` (특히 240-241 주석) |
| **sendMessage**(실채팅): 옵션 조립 `claude.ts:322-388`. `adaptPlugins`(348)·`adaptSkills`(349)·`adaptSettings`(354)·`adaptEnv`(355) spread. | `@app/src/main/adapters/claude.ts:322-388` |
| `settingSources`/`SettingSource` 는 코드 어디에도 세팅되지 않음 — **의도적 생략**. flag settings(`options.settings`)가 상속된 user/project/local 위에 얹힌다는 설계. | `@app/src/main/adapters/claude-adapt.ts:63-66`, `claude.ts:232-233`·`:351-353`, `conformance.ts:31`·`:63` |
| `adaptSettings`(claude-adapt.ts:77-79)는 provider settings 를 **인라인 JSON 문자열**(`options.settings`)로 주입. settingSources 는 다루지 않음(반환에 부재). | `@app/src/main/adapters/claude-adapt.ts:77-79` |
| `adaptPlugins`(claude-adapt.ts:36-40)는 orca plugin root 하나를 `{plugins:[{type:'local',path}]}` 로. `.claude-plugin/plugin.json` 이 **없으면 생략**(가드). | `@app/src/main/adapters/claude-adapt.ts:36-40` |
| `adaptSkills`(claude-adapt.ts:55-61)는 `options.skills` 를 활성 목록/`'all'` 로 필터. plugin 스킬은 `orca:` prefix, 어댑터/네이티브 스킬은 **bare name**(prefix 없음) 유지. | `@app/src/main/adapters/claude-adapt.ts:50-61` |
| 어댑터/네이티브 스킬은 dist 로 복사하지 않고 **SDK settingSources:user 가 `~/.claude` 에서 직접 탐색**한다는 것이 코드 자신의 전제 — user 배제 시 이 스킬 유실 확정. | `@app/src/main/features/extensions/deployer.test.ts:146` |
| `~/.claude` 경로 조립 패턴 = `join(homedir(), '.claude', …)`. 재사용 가능. | `@app/src/main/adapters/claude-settings.ts:56` |
| `mergeHooks`(claude-adapt.ts:148-160)는 여러 `{hooks}` 조각을 이벤트별 배열 concat 으로 병합 — **plugins 배열 병합의 복제 원본**. | `@app/src/main/adapters/claude-adapt.ts:146-160` |
| 기존 테스트 `claude-adapt.test.ts:110` 가 `adaptSettings` 출력에 `'settingSources' in out === false` 를 단언 — settingSources 를 `adaptSettings` 와 **분리**하면 이 단언은 그대로 유효. | `@app/src/main/adapters/claude-adapt.test.ts:98-120` |
| conformance `settings.mechanism` 유니온 리터럴 `'sdk_flag_settings_default_sources'` 및 주석이 "기본 소스 상속" 서술. 의미 반전 필요. | `@app/src/main/features/extensions/conformance.ts:31`·`:60-65` |
| MCP 는 `options.mcpServers` 가 아니라 plugin `.mcp.json` 렌더 경로로 소비 — 본 변경과 직접 무관하나 `~/.claude` plugin 로딩 부작용(아래 리스크)에서 재고. | `@app/src/main/adapters/turn.ts:69-71` |

## 인수 기준 (Acceptance Criteria)

1. `runCompletion`·`sendMessage` 양쪽 query 옵션에 `settingSources: ['project', 'local']` 가 존재한다(`user` 부재).
2. `sendMessage` 의 `options.plugins` 가 orca 플러그인(배포·매니페스트 존재 시)과 `~/.claude`(디렉토리 존재 시)를 **둘 다** 담는다(하나가 다른 하나를 덮어쓰지 않는다).
3. `~/.claude` 디렉토리 부재 시 해당 plugin 엔트리를 생략하고 오류 없이 진행한다(orca plugin 도 동일 — 둘 다 없으면 `plugins` 키 자체 생략).
4. provider 전용 `settings.json` 값이 `~/.claude/settings.json` 개입 없이 `options.settings` flag 로 그대로 적용된다.
5. `~/.claude/skills`(어댑터/네이티브 스킬)가 채팅 세션에서 계속 노출된다(사람 실기 검증 — §검증 책임 분리).
6. settingSources 관련 오래된 주석·테스트 설명 문자열이 새 설계("`['project','local']` 명시·user 배제·skills 는 plugins 로 보전")와 정합한다.
7. 신규 순수 함수(`adaptSettingSources`·`adaptUserClaudePlugin`·`mergePlugins`)에 단위 테스트가 동반된다.

## 범위 / 비범위

- **범위**: `claude.ts` 2개 call site 의 옵션 조립 + `claude-adapt.ts` 신규 어댑터 조각 3종 + 관련 주석/테스트 문자열 정합 + 단위 테스트.
- **비범위**:
  - conformance `settings.mechanism` **유니온 타입 리터럴** 자체 rename(`'sdk_flag_settings_default_sources'` → 신 명칭) — 타입·소비처 파급이라 선택적 후속(주석만 이번에 정정).
  - `~/.claude` plugin 이 딸려 노출할 수 있는 agents/commands/hooks/.mcp.json 의 취사 필터링(관찰 대상, 아래 리스크).
  - opencode 등 타 어댑터. mock 어댑터.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 SDK 옵션: `Options.settingSources`(`SettingSource[]` = `('user'|'project'|'local')[]`), `Options.plugins`(`{type:'local', path}[]`). **신규 의존성 없음**(기존 SDK 옵션 사용).
- 재사용 모듈: `homedir`+`join`(`claude-settings.ts:56` 패턴), `existsSync`(claude-adapt.ts 기존 import), `mergeHooks` 구조(병합 헬퍼 복제 원본).
- 전제: `~/.claude` 를 `options.plugins` 로 주입하면 `~/.claude/skills` 가 노출되고 `adaptSkills` 필터와 어긋나지 않음 — **사용자 검증 완료**(확인 답변). 매니페스트(`.claude-plugin/plugin.json`) 부재에도 SDK plugin 로더가 수용한다는 전제 역시 사용자 검증에 근거.
- 레이어: 전부 `adapters` 레이어 내부(순수 함수 + 조립) — main DAG 하향 의존 준수, 신규 IPC/계약 없음.

## 설계

접근: `claude-adapt.ts` 에 순수 어댑터 조각 3종을 추가하고, `claude.ts` 2개 call site 에서 spread 한다.

### `app/src/main/adapters/claude-adapt.ts` (신규 함수)

- **`adaptSettingSources(): object`** → `{ settingSources: ['project', 'local'] }` 를 항상 반환.
  provider settings 유무와 **무관**(그래서 `adaptSettings` 와 분리 — 기존 반환·`claude-adapt.test.ts:110` 단언 불변).
- **`adaptUserClaudePlugin(dir = join(homedir(), '.claude')): object`** → `existsSync(dir)` 이면
  `{ plugins: [{ type: 'local' as const, path: dir }] }`, 아니면 `{}`. 인자 주입 가능(테스트용).
  - 기존 `adaptPlugins`(36-40)의 `.claude-plugin/plugin.json` 가드는 **적용하지 않는다**(`~/.claude` 엔 매니페스트 없음 — 사용자 검증으로 수용).
- **`mergePlugins(...fragments: object[]): object`** → 각 조각의 `plugins` 배열을 concat, 있으면 `{plugins}` 없으면 `{}`.
  `mergeHooks`(148-160) 구조 그대로 복제. `options.plugins` 는 단일 배열이라 두 `{plugins}` 조각을 그냥 spread 하면 뒤가 앞을 덮어써 orca plugin 유실 → 병합 필수.

### `app/src/main/adapters/claude.ts` (query 조립)

- `runCompletion`(235-248): 옵션 객체에 `...adaptSettingSources()` 추가(plugins 주입 없음 — 1-shot).
- `sendMessage`(322-388): `...adaptSettingSources()` 추가 + 기존 `...adaptPlugins(extensions.pluginRoot)`(348) 을
  `...mergePlugins(adaptPlugins(extensions.pluginRoot), adaptUserClaudePlugin())` 로 교체.

### 주석·계약 정합 (설계 결정 반전 반영)

"settingSources 생략 → 기본 소스 상속" 서술을 "`['project','local']` 명시·user 배제·skills 는 plugins 로 보전" 으로 갱신:
- `claude.ts:232-233`, `claude.ts:351-353` (주석)
- `conformance.ts:31`, `conformance.ts:60-65` (주석 — 유니온 리터럴 값 자체는 비범위)
- `deployer.test.ts:146` (테스트 설명 문자열: "settingSources:user 가 … 직접 탐색" → "~/.claude plugin 으로 탐색"; 어서션 로직 불변)
- `turn.ts:113`, `types.ts:43` (주석)
- `claude-adapt.ts:63-66` (`adaptSettings` 상단 주석)

### 테스트

- 신규(→ `claude-adapt.test.ts`): `adaptSettingSources` 반환값 / `adaptUserClaudePlugin`(존재·부재 분기, path 주입) / `mergePlugins`(0·1·2 조각 concat + 빈 조각 스킵).
- 기존 `adaptSettings` 테스트(98-120)·`adaptPlugins` 테스트는 불변.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **빈 상태**: `~/.claude` 미존재(신규 사용자) → plugin 엔트리 생략, orca plugin 만(또는 plugins 키 생략). 오류 없이 진행(AC#3).
- **동시성/멀티세션**: 순수 옵션 조립이라 세션 간 공유 상태 없음 — 영향 N/A.
- **부작용 노출**: `~/.claude` plugin 로딩이 skills 외 `agents`/`commands`/`hooks`/`.mcp.json` 까지 끌어올 수 있음(아래 리스크 — 관찰 대상).
- 테마/접근성/키보드: 백엔드 옵션 변경이라 해당 없음(N/A).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `~/.claude` 엔 `.claude-plugin/plugin.json` 없음 → SDK plugin 로더가 스킵/거부할 수 있음 | **사용자 검증 완료**로 수용. 사람 실기(AC#5)로 최종 확인. |
| `~/.claude` plugin 로딩이 스킬 외 agents/commands/hooks/.mcp.json 까지 노출 → 예기치 않은 도구/MCP 유입 | 관찰 대상(비범위). 부작용 확인 시 후속 핸드오프로 필터링. |
| plugin 스킬 네임스페이스(`plugin:skill`) vs `adaptSkills` bare-name 필터 어긋남 가능 | **사용자 검증 완료**로 수용. 어긋남 발견 시 `adaptSkills` 네이밍 재검토(후속). |
| user 소스 배제로 provider blob 이 불완전하면 이전 `~/.claude/settings.json` 이 채우던 값 소실 | **의도된 동작**(provider 전용 settings 우선). provider settings.json 완결성 전제. |
| handoff 0023/0028 의 "settingSources 생략" 결정을 반전 | 본 plan 이 supersede — 0023/0028 은 historical 보존(미수정), 주석/문자열만 현행화. |

- 되돌리기 어려운 결정: 없음(옵션 조립 변경 — 역전 용이).
- **단독 결정 금지 항목(Open Question)**: 없음(핵심 2건은 사용자 확인 완료).

## 영향 받는 파일

- `app/src/main/adapters/claude-adapt.ts` (신규 함수 3종 + `adaptSettings` 주석)
- `app/src/main/adapters/claude.ts` (2 call site + 주석)
- `app/src/main/adapters/claude-adapt.test.ts` (신규 테스트)
- `app/src/main/features/extensions/conformance.ts` (주석)
- `app/src/main/features/extensions/deployer.test.ts` (설명 문자열)
- `app/src/main/adapters/turn.ts`·`app/src/main/adapters/types.ts` (주석)

## 참고 문서

- `docs/arch/backend/standardization.md §2/§5` (skill/settings 표준·배포 계층)
- `docs/arch/backend/system-prompt.md §5` (settingSources Open Question 계열)
- `docs/handoff/0023-skill-mcp-isolation-docs/`·`0024-skill-mcp-isolation-impl/`·`0028-*` (본 plan 이 반전하는 이전 결정)
- IPC 변경 없음 → `IPC_CONTRACT.md` 갱신 불요.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
  - 제약 환경(egress 차단) 시 lint + typecheck + 순수(비-DB) vitest 로 판정, DB 로드 스위트 실패는 알려진 ABI 베이스라인으로 분리 보고(`app/AGENTS.md` 게이트 가이드).
- 신규 테스트 요구: `adaptSettingSources`·`adaptUserClaudePlugin`·`mergePlugins` 단위 테스트(어댑터 순수 변환기).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스 부착.
- [x] 인수 기준 — 번호 매김, 조사 근거, 검증 가능(사람 실기 항목은 §검증 분리로 명시).
- [x] 의존 기술 — SDK 옵션·재사용 모듈·전제 식별, 신규 의존성 0.
- [x] 파생 UX — 빈 상태·부작용 노출·동시성 엣지케이스 전개(무관 항목 N/A 표기).
- [x] 리스크 — 트레이드오프·supersede·수용 근거 기재, Open Question 0(사용자 확인 완료).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 작업은 **기능/어댑터 옵션 변경 → Codex 구현**(다음=Codex). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] `adaptSettingSources` 신규 + 양쪽 call site spread
- [ ] `adaptUserClaudePlugin` 신규(존재 가드·path 주입)
- [ ] `mergePlugins` 신규 + sendMessage plugins 병합 교체
- [ ] 주석/테스트 문자열 정합(claude.ts·conformance.ts·deployer.test.ts·turn.ts·types.ts·claude-adapt.ts)
- [ ] 단위 테스트 3종 추가
- [ ] 게이트 lint/typecheck/test

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
| | | | | |
