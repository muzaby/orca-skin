# Plan — 0023-skill-mcp-isolation-docs

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0023-skill-mcp-isolation-docs` |
| 작성자 | Claude Code |
| 일자 | 2026-06-16 |
| 매핑 | PHASES "Skill/MCP 표준 정렬 + settingSources 격리 해제 (문서 선행)" |
| 상태 | DRAFT → READY → (Claude 단독: 구현=문서 + verify) |

## Context (왜)

기존 설계는 `~/.config/orca/sources/` 를 모든 확장 자산의 단일 SSOT 로 삼고 claude 세션을 `settingSources: []` 격리모드(handoff 0014/0015)로 실행한다. 이로 인해 (1) `dist` 레이아웃이 SDK 표준 경로와 어긋나고, (2) 사용자가 `~/.claude` 에 전역 설치한 skill·설정을 Orca 세션이 못 쓴다.

**핵심 원칙 — 자산 호환성에 따라 SSOT 소유 주체를 분리한다**: 호환 자산(skill·mcp·AGENTS.md — 엔진 밖에서도 표준) = Orca SSOT, 비호환 자산(agents·commands·hooks·plugin — 엔진 고유) = 각 엔진 SSOT(Orca 비관여, 추후 claude plugin 지원으로 연기).

본 작업은 **문서 선행 라운드**다 — 위 설계를 arch/TRD 문서에 먼저 반영한다(`app/AGENTS.md` 원칙 1 "TRD 먼저, 코드 나중"). 코드(deployer/claude-adapt/paths)·테스트 정렬은 후속 핸드오프 [`0024-skill-mcp-isolation-impl`](../0024-skill-mcp-isolation-impl/plan.md).

> 본 핸드오프는 사용자 결정으로 **핸드오프 문서 미생성 → 사후 정식화**했다(설계 토의·검토는 세션 트랜스크립트, 결정은 사용자 사인오프 3회). 구현 주체 = Claude(문서). handoff 0014/0015 는 historical 보존(미수정) — supersession 만 arch/TRD/PHASES 에 기재.

## 인수 기준 (Acceptance Criteria)

1. `standardization.md` §5.1: sources/dist 레이아웃을 신 설계로 재작성 — dist=설치 스테이징(SDK 표준 거울: skill→`.claude/skills/`, mcp→루트 `.mcp.json`/${VAR} 보존), settings.json 은 거울 예외(flag 주입), `plugin/` 컨테이너·agents·commands·hooks 제거. 소유 모델·격리 해제·구현-대기 노트 포함.
2. `standardization.md` §5.2: deployer 축별 동작을 신 레이아웃으로(skill→`.claude/skills`, mcp `.mcp.json` placeholder 배포; manifest·agents·commands·hooks·settings 복사 제거). §2: skill·mcp·AGENTS.md=cross-engine(Orca SSOT) / agents·commands·hooks·plugin=engine-specific(연기) 분류 명시.
3. `TRD.md` §6.8: 런타임 주입을 격리 해제로 — `settingSources` 옵션 생략(SDK 기본 user/project/local), 사용자 allow 규칙은 `disallowedTools` 차단, settings.json dist 미배포(flag 주입), handoff 0014/0015 `settingSources: []` 격리모드 폐기(supersede) 명시.
4. `adapters.md` §1.3·§1.7·§3.1·§3.2: 신 설계 정렬 — skill 은 `settingSources` 경로 발견(`plugins` 제거), `disallowedTools` 채택 행, agents·commands·hooks·plugin 은 engine-specific 연기, 런타임 hook(`options.hooks`)은 별개 유지.
5. `security.md` §1.4: 격리 해제(settingSources 생략 + disallowedTools 게이팅) + `.mcp.json` placeholder 디스크 배포 + 비밀 subprocess env 확장 모델. argv 평문 불변식·branded 타입은 유지.
6. `PHASES.md`: 신규 행("문서 확정 / 코드 대기") 추가.
7. **정합성**: `docs/` 전역에서 `settingSources: []`·"격리모드"·`plugin/`(운반 그릇)·`plugins:[{local}]` 잔여 언급이 신 설계와 모순되지 않음(현행-코드 상태 서술은 "구현 대기" 마커로 가시화, 0014/0015·PHASES 이력·외부 SDK 미러는 historical 예외).
8. **코드 무변경**: 본 라운드는 문서만 — `app/**` 변경 0. doc↔code 의도적 불일치는 각 섹션 "구현 대기" 마커로 표기.

## 범위 / 비범위

- **범위**: 위 6개 문서의 신 설계 반영 + 상호참조 정합.
- **비범위**: 코드(deployer/claude-adapt/paths)·테스트 정렬(→ 0024). "cwd 설치(복사)" 기능·project/local settingSource 활성·agents/commands/hooks/plugin per-adapter 주입·`~/.claude/plugins` 스캔(추후 별건).

## 설계

- 문서가 SSOT 이고 코드가 따른다 — 신 설계를 정본으로 서술하되, 현행 코드와의 차이는 "구현 대기(코드 다음 라운드)" 마커로 명시해 의도적 불일치를 가시화.
- 재사용/참조: 기존 §5.1/§5.2/§2 구조·표 형식 유지, handoff 0015·0018 의 branded 타입(`ArgvSafeSettings`/`SubprocessEnv`) 서술은 보존(flag/env 분리는 격리 해제 후에도 유지).
- 레이어 경계: 문서 작업이라 무관.

## 영향 받는 파일

- `docs/arch/backend/standardization.md` (§2·§5.1·§5.2)
- `docs/TRD.md` (§6.8 + §7 anchor)
- `docs/arch/backend/adapters.md` (§1.3·§1.7·§2.1·§3.1·§3.2)
- `docs/arch/backend/security.md` (§1.4)
- `docs/PHASES.md`

## 참고 문서

- `docs/spec/claude/agent-sdk/skills.md` (settingSources vs plugins skill 로드 통로)
- `docs/spec/claude/agent-sdk/` (settingSources 허용값 user/project/local, disallowedTools, .mcp.json `${VAR}` 확장)

## 게이트

- 코드 게이트 없음(문서 라운드). 대신 **정합성 검증**: `docs/` 전역 grep 으로 잔여 모순 0 + TRD §6.8 ↔ standardization §5.1/§5.2 ↔ adapters §1.3/§3.1 ↔ security §1.4 상호참조 일치.

---

## 구현 보고 (Claude)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `standardization.md`·`TRD.md`·`adapters.md`·`security.md`·`PHASES.md` (5건) |
| 실행 명령 | `git diff --stat` (문서 5건 53+/42-) · `docs/` 정합성 grep ×2 |
| 게이트 결과 | 코드 게이트 N/A(문서). 정합성 grep: 잔여 매치는 전부 "구현 대기" 현행-코드 서술·0014/0015·PHASES 이력·외부 SDK 미러(의도적) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `12c7e65` |
