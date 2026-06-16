# Verify — 0024-skill-mcp-isolation-impl

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 설계 정본은 [`0023`](../0023-skill-mcp-isolation-docs/plan.md) 가 반영한 arch/TRD 문서. 본 문서는 그 코드 정렬 라운드(Claude 직접 구현)의 검증.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0024-skill-mcp-isolation-impl` |
| 검증자 | Claude Code |
| 일자 | 2026-06-16 |
| 대상 커밋 | `5d622cb`(브랜치 HEAD, 누적 — 구조 정렬 + 주석 정리). INDEX 기재 `2705a3b` 는 Codex/타 환경 hash(위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** (구현 범위 — `#4` disallowedTools 는 **D1 사람 결정 대기**로 계획상 보류) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | deployer 레이아웃 — skill→`.claude/skills`·`.mcp.json` placeholder 배포·manifest/agents/commands/hooks/settings 복사 제거 | ✅ | `deploy/deployer.ts:122`(`skillsDest=dist/.claude/skills`)·`:160-161` 복사; `:124`,`:163-166` `.mcp.json` `copyFileSync`(${VAR} 평문 보존); `:171` `'skip agents/commands/hooks/plugin/settings dist copy'`(manifest/agents/commands/hooks/settings 미배포). |
| 2 | paths 헬퍼 신 레이아웃 (distPlugin 제거·skill/mcp dist 추가) | ✅ | `config/paths.ts:61` `distSkillsDir`·`:66` `distMcpJsonPath`; `distPluginDir` 부재(grep 0). |
| 3 | adaptSkills — plugins 제거 → `{skills:'all'}` | ✅ | `adapters/claude-adapt.ts:55-57` `adaptSkills` = `{ skills: 'all' }`(`plugins:[{local}]` 제거). |
| 4 | adaptSettings — settingSources 제거 + inline settings 유지 / **disallowedTools 보류(D1)** | ◑ | `claude-adapt.ts:72-74` `settingSources` 부재·`{ settings: JSON.stringify(settings) }` 유지. `disallowedTools` 는 **D1 미확정으로 미주입**(grep 0) — 계획상 보류(아래 §보류). |
| 5 | settings 읽기 경로 → sources 정합 | ✅ | `adapters/claude-settings.ts:1-5`(주석)·`:70` `flatRead(sourcesSettingsFile)`(dist 미배포 → sources 직접 읽기). `resolveSettings`/flat 폴백·`splitProviderSettings`(branded) 동작 보존. |
| 6 | adaptMcp 정합 (mcpServers + allowedTools 유지) | ✅ | `claude-adapt.ts:38-42` `adaptMcp` 순수 변환 유지. settingSources 생략으로 외부 `~/.claude` MCP 상속 가능(설계 의도). |
| 7 | conformance compatibilityPaths | ✅ | `deploy/conformance.ts:54` `compatibilityPaths: ['.claude/skills']`. |
| 8 | 테스트 (deployer/claude-adapt/conformance + settings) | ✅ | `deployer.test.ts`(9)·`claude-adapt.test.ts`(23, incl. `:62` settingSources 미주입 단언)·`conformance.test.ts`·`claude-settings.test.ts`(6)·`provider-settings.test.ts`(12). |
| 9 | 게이트 + 레이어 경계 0 + 신규 의존성 0 | ✅ | 게이트 아래 ✅. lint(boundaries) 통과. package.json 무변경. |
| 10 | 0023 문서 "구현 대기" 마커 해소 | ✅ | skill/mcp/settingSources 범위 마커 잔존 0(standardization/TRD/adapters/security grep). 잔여 `adapters.md:104` "구현 대기" 는 `NormalizedEvent` 정규화 계층 스코프 — 0024 무관. |

## 보류 항목 (D1 — 계획상 사람 결정)

- **`#4` disallowedTools 미주입**: plan §"착수 전 확정 필요(D1)" 가 명시한 대로, settingSources 격리 해제로 사용자 `~/.claude/settings.json` 의 allow 규칙이 Orca canUseTool 게이트(RISKY_TOOLS)를 우회할 수 있는 보안 의도 결정이 미확정이라 **계획대로 보류**. 구조 변경(#1~#3·#5~#8)은 선행 완료. → 이 항목은 FAIL 이 아니라 **사람 결정 대기**(verify §책임 분리 "Open Questions" 행).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 통과(390/390) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9 충족 + 1 보류(D1) |
| 레이어 경계 위반 0 (main L0~L3) | ✅ | — | lint 통과(deployer/paths=L1, claude-adapt/settings=L2 하향) |
| 비밀 불변식(.mcp.json placeholder·env↛argv) | ✅ | — | `copyFileSync` 평문 보존·`adaptEnv` 분리 유지(0018 branded) |
| 문서 형식/링크/한국어 | ✅ | — | 0023 마커 정합 |
| **Open Question (D1 disallowedTools)** | ✖ 단독 결정 금지 | ✅ 결정 | **사람 확인 대기** |
| 실환경 동작 | ✖ | ✅ | **사람 확인 대기** (settingSources 생략 시 `~/.claude` skill/설정/MCP 상속 실기·turn 1회 settings 적용) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # PASS (boundaries 위반 0)
$ cd app && npm run typecheck   # PASS (node + web + test)
$ cd app && npm rebuild better-sqlite3 && npm test
  Test Files  53 passed (53)
       Tests  390 passed (390)
$ cd app && npm run build       # PASS
```

## 위생 검토

- 키/토큰/이메일/IP 스캔: 본 라운드 문서 변경에 비밀 혼입 0. `.mcp.json` 디스크 배포는 `${VAR}` placeholder 보존(평문 0) — security §1.4 불변식 유지.

## PHASES.md 정합성

- "Skill/MCP 표준 정렬 … (handoff 0023)" 행의 "코드 0024 대기" 를 코드 라운드 완료로 갱신(커밋 `5d622cb`, D1 보류 표기). 형식 정합.

## 결론 / 다음 단계

- **상태: PASS** — 구현 범위 인수 9/9 + D1 1건 계획상 보류. 게이트 4종 통과(390/390), 레이어 경계 0, 비밀 불변식 보존, 신규 의존성 0.
- INDEX `verify/PASS` → PHASES 승격. **사람 결정 대기: D1(disallowedTools 차단 목록 + allow 규칙 우회 대응 정책)** — 확정 시 후속 라운드로 `#4` 마저 구현. 사람 확인 대기: 실환경 `~/.claude` 상속·turn settings 적용.
