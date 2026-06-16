# Plan — 0024-skill-mcp-isolation-impl

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 설계 정본은 핸드오프 [`0023-skill-mcp-isolation-docs`](../0023-skill-mcp-isolation-docs/plan.md) 가 반영한 arch/TRD 문서.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0024-skill-mcp-isolation-impl` |
| 작성자 | Claude Code |
| 일자 | 2026-06-16 |
| 매핑 | PHASES "Skill/MCP 표준 정렬 + settingSources 격리 해제" 코드 라운드 |
| 상태 | READY (단 **D1 사용자 확정 후** disallowedTools 부분 착수) |

## Context (왜)

[`0023`](../0023-skill-mcp-isolation-docs/plan.md) 가 신 설계를 arch/TRD 문서에 먼저 반영했다(문서 선행). 본 라운드는 **코드를 그 문서에 정렬**한다 — 현행 코드(deployer 의 `plugin/` 컨테이너+manifest, claude-adapt 의 `plugins:[{local}]`·`settingSources:[]`)를 신 레이아웃(skill→`.claude/skills`, mcp→`.mcp.json`)·격리 해제(settingSources 옵션 생략 + disallowedTools)로 바꾸고, doc↔code "구현 대기" 불일치를 해소한다.

설계 근거·상세는 문서가 정본: `standardization.md` §2/§5.1/§5.2, `TRD.md` §6.8, `adapters.md` §1.3/§1.7/§3.1/§3.2, `security.md` §1.4. **이 plan 은 그 결정을 반복하지 않고 코드 변경점만 적는다.**

## 인수 기준 (Acceptance Criteria)

1. **deployer 레이아웃**(`deploy/deployer.ts`): skill 복사 대상을 `dist/<engine>/plugin/skills` → `dist/<engine>/.claude/skills/` 로 변경. `.mcp.json` 을 `${VAR}` placeholder 보존 상태로 `dist/<engine>/.mcp.json` 에 **배포**(현재는 키 검증만 → 검증 + 배포). manifest(`plugin/.claude-plugin/plugin.json`) 작성 + agents/commands/hooks 복사 + provider settings.json 의 dist 복사를 **제거**.
2. **경로 헬퍼**(`config/paths.ts`): dist 경로 헬퍼를 신 레이아웃으로 — `distPluginDir` 제거(또는 type-b plugin scan 용으로 의미 재정의), skill/mcp dist 경로 추가(`distSkillsDir`/`distMcpJson` 류), provider settings dist 경로(`distProviderDir`) 정리.
3. **adaptSkills**(`adapters/claude-adapt.ts`): `plugins:[{type:'local', path: distPluginDir}]` 제거 → `{ skills: 'all' }` 만 반환(skill 은 `settingSources` 경로로 발견). `skills:'all'` 필터 유지 검토.
4. **adaptSettings**(`adapters/claude-adapt.ts`): `settingSources: []` 제거 → 옵션 자체를 주입하지 않음(SDK 기본 user/project/local). `options.settings`(인라인 JSON 문자열, flag 레이어) 주입은 유지. **`disallowedTools` 추가**(아래 D1).
5. **settings 읽기 경로**(`adapters/claude-settings.ts`·`settings/provider-settings.ts`): provider settings 가 dist 미배포가 되므로 읽기 출처를 `sources/settings/<adapter>/<provider>/settings.json` 으로 정합(현행 dist 우선 → sources 폴백 로직 정리). `resolveSettings`/flat 폴백·`filterEscalatingDefaultMode`·`${VAR}`/secret 주입·branded 분리(`splitProviderSettings`)는 동작 보존.
6. **adaptMcp 정합**(`adapters/claude-adapt.ts`): 현행 `mcpServers` 객체 + `allowedTools` 주입 유지. 격리 해제로 사용자 `~/.claude` MCP 도 로드될 수 있으므로 Orca SSOT MCP 와의 머지/우선순위 동작 확인(외부 MCP readonly 인지·중복 키 처리).
7. **conformance**(`deploy/conformance.ts`): `compatibilityPaths`(`['.claude/skills']`) 등 신 레이아웃 정합.
8. **테스트**: `deployer.test.ts`(신 레이아웃 — `.claude/skills` 복사·`.mcp.json` placeholder 배포·manifest/agents/commands/hooks/settings 복사 부재), `claude-adapt.test.ts`(adaptSkills plugins 제거·adaptSettings settingSources 부재 + disallowedTools·adaptMcp), `conformance.test.ts`. 순수 변환기 단위 테스트.
9. **게이트**: `cd app && npm run lint && npm run typecheck && npm test` 통과(+ build), 레이어 경계(main L0~L3) 위반 0, 신규 의존성 0.
10. **문서 정합**: 본 코드가 0023 의 "구현 대기" 마커를 해소 — 해당 마커 문구를 "구현됨"으로 갱신(standardization §5.1/§5.2·TRD §6.8·adapters §1.3/§3.1·security §1.4).

## 착수 전 확정 필요 (Open Decisions)

- **D1 (사람 결정 — 보안 의도)**: `disallowedTools` 차단 목록 확정. 격리 해제로 사용자 `~/.claude/settings.json` 의 **allow 규칙이 Orca 의 canUseTool 승인 게이트를 우회**할 수 있다(SDK 평가: allow > canUseTool). 따라서 (a) Orca 가 *확정 차단*할 도구 목록(disallowedTools), (b) 현재 canUseTool 로 *게이트*하는 RISKY_TOOLS(Bash/Write/Edit/MultiEdit/NotebookEdit, handoff 0022)가 사용자 allow 규칙에 의해 우회되는 문제의 대응 정책을 사용자가 정해야 한다. **이 결정 전까지 #4 의 disallowedTools 부분은 보류**(나머지 #1~#3·#5~#8 구조 변경은 선행 가능).

## 범위 / 비범위

- **범위**: 위 코드/테스트 정렬 + 0023 문서 마커 해소.
- **비범위**(추후 별건): ① "cwd 설치(복사)" 기능 — dist→설치대상 복사 실행 + `project`/`local` settingSource 로 Orca-SSOT skill/mcp 로드(현 범위는 `~/.claude` 전역 자산 상속까지). ② agents·commands·hooks·plugin 의 per-adapter 배포·`~/.claude/plugins` 스캔 + query 주입(claude plugin 지원). ③ opencode 어댑터.

## 설계

- 문서(0023 반영분)가 정본 — 코드는 그 레이아웃/주입 모델을 그대로 구현.
- 재사용: 기존 deployer 의 `copyDir`/`validateMcp`/backup-then-write 골격, `mcp/` 의 `${VAR}` 미확장 디스크 쓰기 불변식(`writeMcpFile` 패턴), `splitProviderSettings`(branded 분리), `ProviderSettingsService` 캐시.
- **비밀 불변식 유지**: `.mcp.json` 디스크 배포는 `${VAR}` placeholder 그대로(평문 0), settings 는 argv 평문 차단(env 는 subprocess env) — `security.md` §1.4 불변식·0018 branded 타입 보존.
- 레이어 경계: deployer/paths=L1 domain, claude-adapt/claude-settings=L2 adapters — 하향 의존 유지(eslint-boundaries).

## 영향 받는 파일

- `app/src/main/deploy/deployer.ts`
- `app/src/main/config/paths.ts`
- `app/src/main/adapters/claude-adapt.ts`
- `app/src/main/adapters/claude-settings.ts`
- `app/src/main/settings/{provider-settings.ts, provider-registry.ts}` (dist settings 경로 정리분만)
- `app/src/main/deploy/conformance.ts`
- 테스트: `app/src/main/deploy/{deployer,conformance}.test.ts`, `app/src/main/adapters/claude-adapt.test.ts`

## 참고 문서

- `docs/arch/backend/standardization.md` §2·§5.1·§5.2 (신 레이아웃·소유 모델 — **정본**)
- `docs/TRD.md` §6.8 (격리 해제·flag 주입·disallowedTools)
- `docs/arch/backend/adapters.md` §1.3·§1.7·§3.1 (adapt 함수·SDK 채택)
- `docs/arch/backend/security.md` §1.4 (.mcp.json placeholder·subprocess env·argv 불변식)
- `docs/spec/claude/agent-sdk/skills.md`(settingSources skill 로드) · `.../mcp.md`(${VAR} 확장)
- IPC 변경 없음(deployer/adapt 는 IPC 채널 무관) — `IPC_CONTRACT.md` 무변경 예상. 변경 발생 시 §6 절차로 동시 갱신.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (+ `npm run build`). better-sqlite3 ABI 는 0019 패턴(`pretest` self-ABI)로 green 가정.
- 신규 테스트: deployer 레이아웃 변경 + `adaptSkills`/`adaptSettings`/`adaptMcp` 순수 변환기.

---

## [구현 기입] 구현 체크리스트

- [x] #1 deployer 레이아웃(skill→`.claude/skills`·`.mcp.json` 배포·manifest/agents/commands/hooks/settings 복사 제거)
- [x] #2 paths 헬퍼 신 레이아웃
- [x] #3 adaptSkills plugins 제거
- [x] #4 adaptSettings settingSources 제거 / [ ] disallowedTools 는 D1 사용자 확정 전 보류
- [x] #5 settings 읽기 경로 sources 정합
- [x] #6 adaptMcp 정합(기존 mcpServers+allowedTools 순수 변환 유지; settingSources 생략으로 외부 MCP 상속 가능)
- [x] #7 conformance compatibilityPaths
- [x] #8 테스트(deployer/claude-adapt/conformance + settings 경로)
- [x] #10 0023 문서 "구현 대기" 마커 해소(단 D1 disallowedTools 보류 표기)

## [구현 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/deploy/deployer.ts`, `app/src/main/config/paths.ts`, `app/src/main/adapters/claude-adapt.ts`, `app/src/main/adapters/claude-settings.ts`, `app/src/main/settings/provider-settings.ts`, `app/src/main/deploy/conformance.ts`, 관련 테스트, 문서 정합 마커 |
| 실행 명령 | `cd app && npm run lint`; `cd app && npm run typecheck`; `cd app && npm test -- --run src/main/deploy/deployer.test.ts src/main/adapters/claude-adapt.test.ts src/main/adapters/claude-settings.test.ts src/main/settings/provider-settings.test.ts src/main/deploy/conformance.test.ts`; `cd app && npm test`; `cd app && npm rebuild better-sqlite3 && npm test`; `cd app && npm run build` |
| 게이트 결과 | lint PASS / typecheck PASS / targeted test 50 PASS / first full test FAIL(9건 better-sqlite3 Node ABI mismatch) / `npm rebuild better-sqlite3` 후 full test PASS / 최종 full test 390 PASS / build PASS |
| 블로커 / 역질문 | D1 미확정: `disallowedTools` 차단 목록과 사용자 allow 규칙 우회 대응 정책은 보류. 나머지 구조 변경은 구현 완료. |
| 대상 커밋 | `2705a3b` |
