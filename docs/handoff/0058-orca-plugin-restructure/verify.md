# Verify — 0058-orca-plugin-restructure

> 검증 문서. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0058-orca-plugin-restructure` |
| 검증자 | Claude Code |
| 일자 | 2026-07-01 |
| 대상 커밋 | impl `98a74c0`(구현 실체·docs 라벨 번들) + verify 선조치 `07b0c6b` |
| 라운드 | 1 |
| 상태 | **PASS** (verify 전 수석엔지니어 리뷰 선조치 3건 반영) |

## 사전 수석엔지니어 리뷰 (verify 전, 사용자 요청)

사용자 요청대로 verify 매트릭스 전 실무 관점 비판적 검토를 먼저 수행했다. 6건 발견:

| # | 발견 | 심각도 | 처리 |
|---|---|---|---|
| F1 | 구현 전체(23파일)가 `docs(handoff)` 커밋 `98a74c0` 에 번들 — 제목 type 이 범위 과소기술. plan/INDEX 가 가리키는 impl 커밋 `0d3d8fb` 는 이 브랜치 부재(Codex env 해시). | 위생 | history-only → 위생 노트 ①/② 기록 |
| F2 | 구현보고가 "의존성 설치 무응답으로 게이트 미실행" 이라 적었는데 trailer 는 `Criteria-Met: 11/11`(AC#10 게이트통과 포함) 주장 — 근거 없음. 실제 **lint 조차 실패**(F-lint). | 프로세스 | verify 가 게이트 전량 재실행 |
| F3 | `adaptPlugins` 가 AC#5/엣지케이스#2 의 매니페스트 **존재 가드를 상실**(문자열 non-empty 만 검사) + `pluginRoot` 는 항상 non-empty → deploy 실패 시에도 존재하지 않는 경로 주입. | 실기능 버그 | **선조치**(Claude 비기능) |
| F4 | `ExtensionDeploymentService.markDirty()` 호출자 0 = dead code. | 경미 | **선조치**(제거) |
| F5 | `orcaPluginRoot`(package) ↔ `distOrcaPluginDir`(paths) 경로 일관성. | — | 양성 확인(동일 경로, 문제 없음) |
| F6 | plugin `.mcp.json` 로드·`orca:` skill 네임스페이스 노출·평문 비밀 dist 잔존은 실환경(사람) 검증. | 책임분리 | 사람 확인 대기 등재 |

**사용자 결정(2026-07-01)**: F3+F4 = **Claude 선조치**(비기능 버그수정, 0057 선례).

### 선조치 내역 (Claude 비기능 구현)

| 항목 | 변경 | 파일 |
|---|---|---|
| F3 | `adaptPlugins` 에 `existsSync(join(root,'.claude-plugin','plugin.json'))` 가드 복원 — 매니페스트 부재 시 `{}` 반환(AC#5·엣지케이스#2 준수). 부재-경로 테스트 케이스 추가. | `adapters/claude-adapt.ts:33-41` · `adapters/claude-adapt.test.ts` |
| F4 | `markDirty()` + 전용 `dirty` 플래그 제거. `ensureDeployed` 의 boot-실패-재시도 의미(`deployedOnce`)는 보존. | `deploy/extension-deployment-service.ts` |
| F-lint | impl 이 도입한 `ClaudeAdapter` 빈 생성자(`constructor() {}` — MCP resolver 파라미터 제거 잔재)가 `@typescript-eslint/no-empty-function` lint 에러 → 제거. **F2 재확인 증거**(impl 은 lint 조차 통과 못 함). | `adapters/claude.ts:175-178` |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: MCP 를 plugin `.mcp.json` 로 로드·`options.mcpServers` 레거시 유지 | 타당 — 사용자 확정과 일치 | AC#9 매트릭스에서 확인(claude.ts adaptMcp 미호출) |
| 놓친 문제 #1: deployer 비대화 → `claude-plugin-package.ts`·`ExtensionDeploymentService` 분리 | 타당 — 책임 분리 양호(레이아웃=package, 멱등=service, backup/검증=deployer) | 매트릭스 AC#1~4·8 증거로 반영 |
| 놓친 문제 #2: plugin `.mcp.json` 평문 비밀 → query 전 확장 + `chmod 0600` + 문서 기록 | 타당 | AC#3·리스크, standardization.md 기록 확인 |
| 놓친 문제 #3: complete 경로 plugin 미주입 | 타당 — 1-shot 요약은 도구/스킬/MCP 불요 | AC#5 범위(sendMessage 만) 확인 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `deploy` 가 `plugins/orca/.claude-plugin/plugin.json`(name/desc/version) 렌더 | ✅ | `claude-plugin-package.ts:20-24,77` · 테스트 `deployer.test.ts:48-52`(green) |
| 2 | Orca skill → `plugins/orca/skills/<skill>/`, 구 `dist/claude/.claude/skills/` 미생성 | ✅ | `claude-plugin-package.ts:45-75` · `deployer.test.ts:42-44,53`(구 `.claude` 부재 assert green) |
| 3 | 활성 MCP → `plugins/orca/.mcp.json`(query 전 `${VAR}`/secret 확장·키 검증) | ✅ | `router.ts:100-107`(`toClaudeConfig` 확장) · `claude-plugin-package.ts:78-84` · `deployer.ts:50-70,154-168` · `deployer.test.ts:45-47,135-137` |
| 4 | `agents/`·`hooks/` 빈 디렉토리 스캐폴드 | ✅ | `claude-plugin-package.ts:69-74`(mkdir agents/hooks) · `deployer.test.ts:171-176` |
| 5 | 런타임 `plugins:[{type:'local',path}]` 주입(**루트 존재 시만**·부재 시 생략) | ✅ (선조치) | `claude.ts:294` · `claude-adapt.ts:33-41`(선조치 가드) · `claude-adapt.test.ts` 3케이스(부재/매니페스트없음/존재) green |
| 6 | `adaptSkills` 가 활성 Orca skill 을 `orca:<name>`, 어댑터 skill 은 bare, 스캔 0 → `'all'` | ✅ | `claude-adapt.ts:59-65` · `claude-plugin-package.ts:37-43` · `claude-adapt.test.ts:95-110`(green) |
| 7 | dist→cwd 싱크 제거(`workspace-sync.ts`·`syncedCwds` 삭제, cwd 에 미기록) | ✅ | `workspace-sync.ts` 삭제 확인 · `grep syncedCwds\|syncWorkspaceExtensions src/main` = 0 |
| 8 | sources→dist deploy 를 매 `query()` 전 선행 보장(boot 1회+CRUD+턴 진입 멱등) | ✅ | boot `router.ts:170-171` · 턴 진입 `send.ts:353`(query 전) · CRUD `mcp.ts:13,19,25`·`misc.ts:84,90,129` · `ensureDeployed` 멱등 `extension-deployment-service.ts` |
| 9 | MCP 실주입 = plugin `.mcp.json`, `options.mcpServers`/`adaptMcp` 는 레거시(기본 경로 미호출) | ✅ | `grep adaptMcp claude.ts` = 0 · `claude-adapt.ts:40-44`(export 유지·미호출) |
| 10 | 게이트 통과 · boundaries/no-cycle 0 · 신규 의존성 0 | ✅ (선조치 후) | lint ✅ · typecheck(node+web+test) ✅ · test 606/606 · `git diff package.json` 의존성 0 |
| 11 | 문서 정합: standardization.md·PHASES.md 신 레이아웃, IPC 무변 | ✅ | `standardization.md`(plugin 레이아웃+평문비밀 trade-off, 커밋 98a74c0 diff) · PHASES 승격(본 verify) · IPC_CONTRACT 무변 |

**결과: 11/11 충족**(F3 선조치로 AC#5 완전 충족, F-lint 선조치로 AC#10 충족).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — | lint ✅ · typecheck 3종 ✅ · test 606/606 |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 첨부 | 이견 시 중재 | 11/11 |
| 레이어 경계(boundaries·no-cycle) 위반 0 | ✅ | — | lint clean = 0 위반 |
| 문서 형식/링크/한국어 | ✅ | — | standardization.md 정합 |
| AGENTS.md 위생 스캔 | ✅ | ✅ 최종 | AGENTS.md 변경 없음 |
| plugin `.mcp.json` SDK 로드 실동작 | ✖ | ✅ | **사람 확인 대기(실환경)** |
| `orca:<name>` skill init `slash_commands` 노출 | ✖ 보조 | ✅ | **사람 확인 대기(실환경)** |
| 평문 비밀 dist/.bak 잔존 trade-off | ✖ 제시 | ✅ 승인됨 | 사용자 확정(문서 기록) |
| UI/UX 시각 검증 | ✖ | ✅ | 해당 없음(백엔드 변경) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

환경 주의: `node_modules` 미설치 상태였다(F2). `npm install --ignore-scripts`(electron 바이너리
프록시 다운로드 실패 회피) + `npm rebuild better-sqlite3`(Node ABI) 후 게이트 실행.

```
$ npm run lint        → clean (F-lint 선조치 후 0 error; boundaries·no-cycle 0)
$ npm run typecheck   → typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅
$ npm test            → Test Files 81 passed | 2 failed(suite) ; Tests 606 passed (606)
```

- **test 606/606 passed** — 신규/영향 테스트 green: `adaptPlugins` 3(부재·매니페스트없음·존재)·
  `adaptSkills` 네임스페이스·`deployer` plugin 레이아웃(11) 포함. `db/queries.test.ts` 는
  better-sqlite3 Node ABI 재빌드 후 green.
- **실패 2 suite**(`ipc/chat/persist.test.ts`·`send.runtime-resilience.test.ts`, "0 test"):
  electron 바이너리 미설치로 import 차단 = 프록시 다운로드 제약 — 0050~0057 동일 계열,
  **본 변경 무관**. 정상환경 재실행 시 green.

## 위생 검토

- 키/토큰/이메일/IP 패턴: AGENTS.md 변경 없음 — 해당 없음.
- **위생 노트 ①**: plan 구현보고·INDEX 기재 impl 커밋 `0d3d8fb`(Codex env) → 본 브랜치 실
  도달 `98a74c0`. history-only.
- **위생 노트 ②**: 구현이 `docs(handoff): 0058 구현 상태 갱신` 커밋에 코드+테스트+문서 23파일
  번들 — 제목 type 이 범위 과소기술(0027 위생 노트 ② 계열). history 재작성 불가, 후속 커밋
  규약 준수로 해소. 커밋 trailer 의 `Criteria-Met: 11/11`(게이트통과 포함)은 실제 게이트 미실행
  상태 주장이었음(F2) — 본 verify 가 게이트 재실행 + 선조치로 사실상 11/11 로 정정.

## PHASES.md 정합성

- 0057 행 뒤에 0058 행 추가(형식 일치). 대상 커밋 = impl `98a74c0` + verify 선조치 `07b0c6b`.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan §설계 는 `adaptPlugins` 에 `existsSync` 가드를 명시했으나 인수 기준(AC#5)
  이 "루트 존재 시만" 을 코드 강제와 연결하지 못해, 구현이 pluginRoot 를 항상 non-empty 로
  넘기며 가드를 우회할 여지를 남겼다(F3). 파생 엣지케이스는 옳았으나 테스트로 못 박지 않음.
- **구현 단계**: 게이트를 한 번도 통과하지 못한 채(F2·F-lint) `11/11`·`implemented` 로 커밋 —
  trailer 신뢰성 훼손. resolver 제거 후 빈 생성자를 남긴 lint 회귀, 매니페스트 가드 누락은
  게이트를 돌렸다면 즉시 잡혔을 것. 커밋 위생(코드↔docs 혼재)도 함께 결여.
- **검증 단계**: 실환경(plugin `.mcp.json` 로드·`orca:` 네임스페이스 노출)은 이 환경에서 확인
  불가라 사람에 위임. electron 미설치로 2 suite 미실행분은 계열 노트로만 커버(정상환경 재실행 권고).

## 결론 / 다음 단계

- 상태: **PASS** — 인수 11/11, 게이트 lint/typecheck/test 606/606, 레이어 경계 0, 신규 의존성 0,
  IPC 무변경. F3/F4/F-lint 선조치 반영.
- INDEX `verify/PASS` + PHASES 승격.
- **사람 확인 대기**: ① plugin `.mcp.json` SDK 실로드 ② `orca:<name>` skill init 노출
  ③ 실환경 채팅 턴 1회(plugin skill/mcp 동작) ④ 정상환경 electron 게이트 재실행 ⑤ PR 머지.
