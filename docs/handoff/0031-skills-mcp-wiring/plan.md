# Plan — 0031-skills-mcp-wiring

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 커밋 trailer 는 [`../git-template.md`](../git-template.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0031-skills-mcp-wiring` |
| 작성자 | Claude Code |
| 일자 | 2026-06-19 |
| 구현 주체 | **Codex** (기능 구현) |
| 매핑 | PHASES "Skills & MCP 실배선" 행 / PR (있으면) |
| 상태 | DRAFT → READY |

## Context (왜)

`features/skills/components/customize/` 의 "Skills & MCP"(맞춤설정) 페이지는 현재 **정적 스킨**이다 — `data.ts` 의 `SEED_SKILLS`/`SEED_CONNECTORS` 상수로 로컬 `useState` 를 초기화하고, 추가/토글은 메모리상 append(새로고침 시 소실). 페이지는 좌측 레일(depth1) → 중앙 목록(depth2) → 우측 상세(depth3) 의 3-pane 으로 표현된다(`SkillsCustomizeView.tsx`).

백엔드(`McpStore`, `scanSkills`, `ExtensionDeployer`)는 이미 존재하지만 이 페이지는 어디에도 연결돼 있지 않다. 이 작업의 목표는 **목업을 전부 제거하고 실제 IPC/파일 백엔드에 배선**하는 것이다. 페이지는 `~/.config/orca/sources/`(사람이 편집하는 SSOT)를 직접 관리하는 화면이 되고, deployer 가 `sources → dist/<engine> → cwd` 로 렌더·싱크한다. 부수적으로 UI/식별자를 정리한다(커넥터/connector → MCP/mcp, claude/클로드 제거, "개인 스킬" → "Orca 스킬").

범위가 커서 **4 페이즈**로 나눈다. 각 페이즈는 독립 커밋·게이트 통과 가능 — P1(프론트 라벨/목업 제거) → P2(스킬 sources 백엔드) → P3(MCP 모달/sources) → P4(싱크 파이프라인 + workspace cwd).

## 사용자 결정 (확정)

1. **스킬 소스**: `scanSkills` 가 **지원 어댑터에서 경로를 받아** 스캔하고 **소스별 그룹 헤더**로 분류한다. Orca 자체 `sources/skills` = "Orca 스킬" 그룹, 어댑터 네이티브 경로(claude → `~/.claude/skills`) = 어댑터별 그룹.
2. **MCP 목록 구조**: **활성/비활성** 2그룹.
3. **MCP 모달 입력**: textarea 에 **단일 서버 항목** JSON 을 붙여넣고 sources mcp.json 에 `{ "mcpServers": { <name>: <entry> } }` 형태로 병합 추가. placeholder 로 기본 스키마 템플릿 제공.
4. **author 플로우**: '스킬 지침 작성'도 `sources/skills/<name>/SKILL.md` 로 실제 저장.
5. **싱크 파이프라인**: 스킬/MCP enabled 토글 → sources 에서 enabled 만 **filter → dist 생성 → cwd 복사**. 앱 시작 시 **cwd 기본값 = `~/.config/orca/workspace`**(현재 home). 새 대화 시작 / 토글 후 첫 대화 시 cwd 로 싱크(`./.claude/skills/<skill>`, `./.mcp.json` — adapter=claude 기준). cwd 사용자 변경은 **현재 미구현(후속)**.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능한 항목.

### P1 — UI 라벨/식별자 정리 + 목업 제거 + 기존 IPC 배선 (frontend)
1. `data.ts` 의 `SEED_SKILLS`·`SEED_CONNECTORS` 및 정적 초기화 제거. `SkillsCustomizeView` 는 실데이터(스킬 IPC + `useMcpServers`)로 목록을 채운다 — 잔존 시드/하드코딩 목업 0.
2. "커넥터"/"connector" 표현을 **"MCP"/`mcp`** 로 전면 변경 — **UI 한국어 라벨 + 영문 식별자 모두**. UI: `CustomizeRail`(nav 라벨), `CustomizeList`(헤더 타이틀), `CustomizeLanding`(카드/문구), 모달 제목. 식별자: `ConnectorItem`→`McpItem`, `ConnectorDetail`→`McpDetail`(+파일명), `ConnectorRow`/`ConnectorGroup`/`CONNECTOR_GROUP_*`/`SEED_CONNECTORS`/`addConnector`/`connectorModalOpen`/`CustomConnectorModal`→`CustomMcpModal`(+파일명) 등 `connector` 어휘 전부 `mcp` 로 리네임. 실 DTO `McpServer`(`shared/ipc.ts`)를 가급적 직접 사용. `rg -i "connector|커넥터"` 가 이 feature 범위에서 0.
3. "claude"/"클로드" UI 표현 제거: `SkillAddMenu` 의 "Claude와 함께 창작하기" 행 제거(또는 중립 문구), `addedBy: '로컬 (~/.claude/skills)'` 류 하드코딩 문자열 제거(실 스캔 메타로 대체). 이 feature 범위 UI 문자열에서 claude/클로드 0(SDK 경로 어휘 `.claude/` 는 백엔드 한정으로 허용).
4. 스킬 depth2 목록의 "개인 스킬" 그룹 헤더 → **"Orca 스킬"**(`CustomizeList.tsx`).

### P2 — 스킬 소스 백엔드 (sources/skills + 어댑터 그룹 + 업로드/author IPC)
5. `paths.ts` 에 `sourcesSkillsDir()`(`~/.config/orca/sources/skills`) 헬퍼 추가.
6. `scanSkills` 를 **(어댑터 제공 경로 + Orca 소스) 목록**을 받도록 일반화하고, 결과 항목에 **소스 출처(`group: 'orca' | <adapter>`) 메타**를 부여. SDK 슬래시 카탈로그용 기존 호출 호환 유지(시그니처 변경 시 호출부 동기 수정).
7. **스킬 업로드 IPC**: 업로드 파일/폴더(.md/.zip/.skill)를 `sources/skills/<name>/` 로 복사. `SkillUploadModal` 이 stub append 대신 이 IPC 호출 → 성공 시 목록 refresh.
8. **스킬 author IPC**: `SkillAuthorModal` 입력을 `sources/skills/<name>/SKILL.md`(frontmatter + 본문)로 작성 → refresh.
9. 목록이 **소스별 그룹 헤더**("Orca 스킬" + 어댑터별)로 렌더된다.
10. 스킬 enabled 토글이 영속화된다(settings 신규 `skillEnabled` record — `mcpEnabled` 패턴 미러).

### P3 — MCP 모달 재작성 + sources 배선
11. `CustomMcpModal`(구 `CustomConnectorModal`) 의 기존 폼(이름/URL/OAuth 고급) **전부 제거**, **단일 textarea**로 교체. placeholder = MCP 기본 스키마 템플릿(§설계). 추가 시 JSON 파싱 → `CreateMcpServerSchema` 검증 → `mcpApi.add` 로 sources mcp.json 에 병합. 파싱/검증 실패는 인라인 에러.
12. MCP 탭 목록을 `useMcpServers` 실데이터 + **활성/비활성** 2그룹으로 렌더. 상세(`McpDetail`)의 연결/해제 토글을 `toggle(id, enabled)` 로 배선.

### P4 — 싱크 파이프라인 + workspace cwd
13. 앱 시작 시 `defaultCwd = ~/.config/orca/workspace`(없으면 생성). `router.ts` 의 `app.getPath('home')` 대체.
14. enabled 필터 반영: deployer/싱크가 **enabled 스킬·MCP만** dist 로 렌더(MCP 는 `McpStore.enabledConfig()` 재사용, 스킬은 `skillEnabled` 필터).
15. **cwd 싱크 트리거**: 새 대화 시작 / 토글 후 첫 대화 시 dist → cwd 복사(`./.claude/skills/<skill>`, `./.mcp.json`, adapter=claude). 턴 시작 cwd 사용 지점(`chat/send.ts`) 직전에 멱등 싱크.
16. 게이트 통과 + 레이어 경계 0.

## 범위 / 비범위

- **범위**: P1–P4. 페이지 전체 실배선, 스킬/MCP sources CRUD, dist 렌더 enabled 필터, cwd 싱크, workspace 기본 cwd.
- **비범위**: cwd **사용자 변경 UI/설정**(후속), opencode 어댑터(claude 만), 스킬 마켓("스킬 둘러보기"/"플러그인 탐색"은 placeholder 유지), `.zip/.skill` 압축 해제 고도화(최소 동작만), 멀티 어댑터 동시 배포.

## 설계

### MCP 모달 placeholder 템플릿 (단일 항목)
`ClaudeMcpSchema`(`app/src/main/mcp/schema.ts`) 기준. textarea placeholder 예시:

```jsonc
{
  "my-server": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
    "env": { "API_KEY": "${MY_TOKEN}" }
  }
}
// 또는 원격:
// { "my-server": { "type": "http", "url": "https://...", "headers": { "Authorization": "Bearer ${TOKEN}" } } }
```

파싱: 입력을 `{ <name>: <entry> }` 로 받아 name·entry 분리 → `CreateMcpServerSchema` 로 검증 후 `mcpApi.add`. `mcpServers` 래퍼가 있으면 벗겨내는 입력 정규화를 둔다.

### 재사용할 기존 자산
- MCP: `useMcpServers`(`features/skills/hooks/useMcpServers.ts`), `McpStore`(`main/mcp/store.ts`, `enabledConfig()`), `CreateMcpServerSchema`(`shared/protocol.ts`), `mcpApi`(`shared/api/ipc.ts`).
- 스킬 스캔: `main/skills/scan.ts`(`scanRoot` 재사용), `SkillInfo`(`shared/ipc.ts`), `ctx.getSkills`(`router.ts`).
- 배포/경로: `deploy()`(`main/deploy/deployer.ts` — `copyDir(sources/skills → dist/.claude/skills)`·`distMcpJsonPath`), `paths.ts`(`sourcesDir`/`distDir`/`distSkillsDir`/`mcpJsonPath`).
- 모달 셸: `shared/ui/Modal.tsx`(`Modal`/`ModalActions`/`MODAL_INPUT`).
- 턴 cwd: `router.ts`(`defaultCwd`/`getCwd`), `chat/send.ts`(`cwd: ctx.getCwd()`).

### 레이어 경계 (`app`/`pages`/`features`/`shared` + main DAG)
- 신규 스킬 sources IPC: 핸들러 `main/ipc/handlers/`(L3), 파일 복사/작성 로직 `main/skills/`(L1), 경로 헬퍼 `main/config/paths.ts`(L1).
- renderer 는 `features/skills` 내부 + `shared` 만 import(4-layer 유지). cross-feature 없음.
- 신규 IPC 채널은 `shared/ipc.ts` `CHANNELS` + `protocol.ts` zod + `docs/IPC_CONTRACT.md` **동시 갱신**.

## 영향 받는 파일

- **renderer (features/skills/components/customize/)**: `data.ts`(목업 제거/타입 리네임), `SkillsCustomizeView.tsx`(실배선), `CustomizeRail.tsx`·`CustomizeList.tsx`·`CustomizeLanding.tsx`(라벨/그룹), `CustomConnectorModal.tsx`→`CustomMcpModal.tsx`(textarea 재작성), `SkillUploadModal.tsx`·`SkillAuthorModal.tsx`·`SkillAddMenu.tsx`(IPC·문구), `ConnectorDetail.tsx`→`McpDetail.tsx`(toggle 배선). 신규 hook `useSkills`(`features/skills/hooks/`).
- **renderer api**: `shared/api/ipc.ts`(스킬 IPC 추가).
- **main**: `skills/scan.ts`(시그니처 일반화), `skills/`(신규 sources 작성/복사 모듈), `ipc/handlers/`(스킬 핸들러 — `misc.ts` 또는 신규 `skills.ts`), `config/paths.ts`(`sourcesSkillsDir`), `settings/store.ts`(`skillEnabled`), `deploy/deployer.ts`(enabled 필터), `ipc/router.ts`(workspace cwd + 싱크 훅), `ipc/chat/send.ts`(턴 전 싱크).
- **shared**: `ipc.ts`(`CHANNELS`·`SkillInfo` 확장), `protocol.ts`(스킬 zod 스키마).
- **테스트**: scan(어댑터 경로+그룹)·sources 작성/복사·MCP 단일항목 파싱·병합·deployer enabled 필터 단위 테스트.
- **문서**: `docs/IPC_CONTRACT.md`(채널 추가), 필요 시 `docs/arch/backend/standardization.md`(싱크 흐름).

## 참고 문서

- [`../AGENTS.md`](../AGENTS.md)(상태 머신), [`../git-template.md`](../git-template.md)(trailer), `docs/IPC_CONTRACT.md`(§6 변경 절차 — **반드시 동시 갱신**), `app/src/main/AGENTS.md`(레이어 DAG), handoff `0023`/`0024`(skill/mcp 표준 정렬·deployer 레이아웃), `docs/arch/backend/standardization.md §5.1`(sources/dist).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`.
- 신규 테스트 요구: scan(어댑터 경로+그룹), sources 스킬 작성/복사, MCP 단일항목 파싱·병합, deployer enabled 필터.

## Open Questions (구현 전 1건 확정 필요)

- **mcp.json 위치**: 사용자 답변에 `~/.config/orca/sources/.mcp.json` 언급. 현행 헬퍼는 `sources/mcp/mcp.json`(`mcpJsonPath`), dist 거울은 `.mcp.json`(`distMcpJsonPath`). **기본안 = 현행 `sources/mcp/mcp.json` 유지 + dist `.mcp.json` 렌더**(McpStore 무회귀). sources 평면 `.mcp.json` 을 원하면 경로 헬퍼/McpStore 동시 변경 필요 — 구현 착수 전 사용자 재확인.

---

## [Codex 기입] 구현 체크리스트

- [ ] P1: 목업 제거 + connector→mcp 리네임 + 라벨/그룹/claude 제거
- [ ] P2: sourcesSkillsDir + scanSkills 일반화 + 업로드/author IPC + skillEnabled
- [ ] P3: CustomMcpModal textarea + 활성/비활성 그룹 + toggle 배선
- [ ] P4: workspace cwd + enabled 필터 dist + cwd 싱크 트리거
- [ ] IPC_CONTRACT.md 동기화 + 신규 단위 테스트

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `typecheck:test` / `test` |
| 게이트 결과 | lint … / typecheck … / test … (N passed) |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |
