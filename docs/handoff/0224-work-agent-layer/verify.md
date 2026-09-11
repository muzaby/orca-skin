# Verify — 0224-work-agent-layer

## 메타

| 항목 | 값 |
|---|---|
| slug | `0224-work-agent-layer` |
| 검증자 | Claude Code |
| 일자 | 2026-09-09 |
| 대상 커밋/range | `4e9e51fa`(ΔV8 설계) → `4313e953`(r8 구현). diff range `4e9e51f..4313e95` |
| 구현 전 plan 기준 | `4e9e51fa` — 이 커밋의 `structural-plan-r8.md`가 채점 기준이다 (현재는 [plan.md](plan.md) §27) |
| V mode / 유효 V | Delta V / V1 `51268488` + ΔV2~ΔV7 + **ΔV8** (현재는 [plan.md](plan.md) §27로 병합) |
| 검증 기준 plan revision | `4e9e51fa`:ΔV8 |
| 라운드 | impl r8 / **verify r1** — 이 핸드오프의 첫 독립 검증 턴이다 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다 — 설계·구현은 Codex, 검증은 Claude Code다. §4의 자기검증 분모 규칙은 적용되지 않으나 적대 축은 별도로 만들었다 |

## 0. 기준선 / plan 변경 확인

**기준선이 diff로 성립한다.** 설계 커밋 `4e9e51fa`(`Status: designed`)와 구현 커밋 `4313e953`(`Status: implemented`)이 분리돼 있다.

- 구현 커밋이 `plan.md`를 변경했는가: 예, **상태 문자열 2줄뿐**이다 — `plan/READY → impl/IMPL_DONE`과 "현재 Codex 자기확인은 r7 → r8" 링크(`git diff 4e9e51f 4313e95 -- docs/handoff/0224-work-agent-layer/plan.md`, 4줄 변경).
- `structural-plan-r8.md` 변경: 머리말 1줄(`plan/READY → impl/IMPL_DONE` + 설계 기준 `4e9e51fa` 명시).
- Decision Ledger 변경: **없음**. D-050~054 원문이 설계 커밋과 동일하다.
- Product/UX Contract 변경: **없음**. ΔV8 「동작과 실패」 7행이 그대로다.
- AC 변경: **없음**. AC-R8-1~7 문안이 그대로다.
- V node/pair·requiredness·EP 변경: **없음**. VP-R8-01~06과 EP 1~7 표가 그대로다.
- 채점에 사용할 원 기준: `4e9e51fa`의 ΔV8 — AC-R8-1~7 · VP-R8-01~06 · EP 1~7.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 V를 `0c24aaa2`의 V1~ΔV7로 명시하고 ΔV8만 증분으로 적는다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | CHANGED 5노드(R·SD·AR×2·MD)에 같은 레벨 REQUIRED pair 5개가 1:1로 붙는다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-R8-06이 V1 VP-03/04/05/07/11/14 · ΔV6 VP-R6-05/06 · ΔV7 VP-R7-03/04를 열거해 재실행한다 |
| pair별 path·EP·직접 oracle | 유효 | 6행 모두 production path와 EP 번호를 갖고, EP 표가 지점을 문장으로 열거한다 |
| 선택적 적대 증거·선택 이유 | 유효 | "모든 pair는 실제 결과 oracle을 사용하므로 별도 결함 변이는 선택하지 않는다"고 이유를 적었다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | ΔV8 §구현 순서/검증 5·6이 vitest·SQLite·native·typecheck·lint·build·inventory·append-only·trailer를 열거한다 |

- ΔV8의 EP 표는 V1 §10과 달리 **숫자 분모를 적지 않고** "구현 시 각 소비처 재열거"를 요구한다. 이는 누락이 아니라 명시된 위임이므로 `PLAN_GAP`이 아니다 — 검증자 재열거는 §5의 EP 분모 절에 있다.
- root PLAN_GAP과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-050 종류 이름을 code로 이행 | 내부값·IPC·저장값·라벨이 `code` | `agent-kind.ts` → `protocol.AgentKindSchema` → `0023` DB → `dto/reader` → `ko/en.chat.agent.code` |
| D-051 정책을 소유 모듈에 명시 | 조립 지점이 정책을 **선택**한다 | `permission-mode`·`agent-session-policy`·`profiles`·`agentPresentation`·`rightPanelTiles` |
| D-052 양쪽 완전 정의·unknown 거부 | Work의 반대로 Code를 추론하지 않는다 | 5개 정책표가 `satisfies Record<AgentKind, …>` · 읽기 경계는 `parseAgentKind` throw |
| D-053 경량·회귀 방지 | 실행기·카드·store·캐시·마운트 수명 보존 | 정적 참조 재사용, memo 비교가 정책 객체 identity |
| D-054 작성자 Codex | plan·impl·커밋 trailer가 Codex | `Agent: codex` 3커밋에서 파싱 확인 |

### end-to-end 흐름

```text
랜딩 AgentModeToggle(좌 work / 우 code)
  → chatReducer SET_AGENT_KIND(parseAgentKind)
  → chat:send(AgentKindSchema) → send.ts resolveAgentKind → lease 출생 잠금
  → resolveAgentProfile → ExtensionBuilder(agentInstructions/agentProfileKey) → SessionRuntime
  → TurnCoordinator(persistResponseBoundaries) → HistoryWriter → sessions.agent_kind(CHECK code|work)
  → dto/reader parseAgentKind → LOAD_SESSION readLegacyAgentKind
  → agentUiPolicy / RIGHT_PANEL_POLICY / agentPermissionPolicy → Composer·Transcript·RightPanel·SessionRow
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 명시적 오류 | 오염된 `agent_kind`는 `TypeError: Invalid agent kind`로 끊긴다. 조용한 Code 대체가 없다 |
| false success 가능성 | 없음 | 0023이 `CASE` 미매칭을 NULL로 만들고 `NOT NULL`/CHECK가 트랜잭션을 되돌린다 |
| partial failure/rollback | 안전 | 오염 행 1개를 심고 0023을 돌리자 `CHECK constraint failed`로 실패하고 **구 컬럼·데이터가 그대로 남았다** |
| Product/UX의 A가 아닌 B | 아니다 | 메뉴 순서·라벨·패널 가시성이 이행 전 동작과 값 단위로 일치한다(§5 AC-R8-5) |
| 증상만 제거하고 상태가 남았는가 | 아니다 | 분기 삭제가 아니라 정책 조회로 치환됐고 5개 정책표가 타입 전수를 강제한다 |
| 캐시/축소가 잃은 관측 | 없음 | `agentUiPolicy(kind).transcript`가 모듈 정적 객체라 memo 비교가 오히려 안정된다 |
| 출력/요청 상한 | 불변 | 정책 선택은 순수 조회다. 타이머·쿼리·프로세스가 늘지 않는다 |

- 0023의 `CASE … END`에 `ELSE`가 없는 것은 결함이 아니라 D-052의 설계다 — 도메인 밖 값을 조용히 Code로 접지 않고 마이그레이션을 실패시킨다. 위 rollback 관측이 그 증거다.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 4e9e51f..4313e95   # 54파일
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `isRightPanelTileId` 참조 0 | 죽은 코드 · **r8 무관** | `git log -S`가 `d542bfc`(저장소/브랜치 메뉴)를 가리킨다 → D6 |
| `AgentPresentation`·`AgentSessionPolicy` 타입 export | 정상 | 같은 파일의 `satisfies` 대상이다 |
| `SessionAgentAppearance` | 정상 | `AgentAppearanceResolver`와 `SessionRowProps.appearance`가 소비한다 |
| 형제 정책 비대칭 | 없음 | 스크립트 3절 "(없음)" |
| 신규 정책표의 기존 소비처 | 무영향 | `agentUiPolicy` 7파일 9지점 배선 확인(`useSidebarSlots`·`TranscriptView`·`GitRow`·`ApprovalCard`·`SubAgentTileContent`·`ChatTile`·`CwdPanel`·`Composer`) |
| producer ↔ consumer 파생 불일치 | 없음 | draft row는 인메모리 `AgentKind`를 join/split한다 — §4 D2 참조 |
| 동일 규칙 중복 구현 | SSOT 유지 | production에 `agentKind === '…'` 분기 **0건**(엄격 스윕은 §7) |

**미배선 검사.** 이번 라운드가 만든 5개 정책표는 전부 production 소비처를 갖는다. `agentPermissionPolicy`는 `permissionModeForAgent`/`planApprovedMode`/`coercePermissionMode`와 Composer `modes.ts`가, `agentSessionPolicy`는 `chatReducer`·`chatStore`·`files.ts`·`session-directory.ts`가, `RIGHT_PANEL_POLICY`는 `chatReducer`·`rightPanelLayout`·`rightPanelTiles`가 부른다.

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 suite 실존: `builder`·`system-header.agent`·`respawn-policy`·`continuation`·`writer`/`reader`·`session.load`·`turns`·`rightPanelTiles.render` 모두 실행됐다(§9).
- structural proxy만으로 통과시킨 AC: **없음**. 구현자가 "구조 검색은 조사 보조"라고 적었고, 실제로 이번 라운드의 oracle은 전부 반환값·DB 내용·렌더 결과다.
- **선택된 적대 증거 재측정**: ΔV8이 등록한 변이는 **0건**(직접 결과 oracle 선언). 닫는 파생 이슈도 없다. 그래서 분모를 검증자가 새로 만들었다.
- **이전 라운드 대조**: 이전 verify 라운드가 없어 red였던 변이가 없다. 덮개 회귀 검사 **수행 불가**.
- **구현 보고가 이름을 대지 않은 적대 축**: 구현자는 변이를 하나도 심지 않았다. 아래 **16개 전부**가 검증자 독립 축이다.

전 스위트(441파일·4123케이스)를 변이마다 다시 돌렸다. 재현: `python3 mutate.py <M> && ./node_modules/.bin/vitest run`.

| 변이 | 무엇을 바꿨나 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 | `readLegacyAgentKind`에서 `'coding'` 분기 제거 | 미실행 | **red** 2파일 | EP-1 |
| M2 | `parseAgentKind`가 throw 대신 `DEFAULT_AGENT_KIND` 반환 | 미실행 | **red** 6파일·7케이스 | EP-1 |
| M3 | **형제 맞바꿈** — `persistResponseBoundaries` code↔work | 미실행 | **red** 2파일 | EP-3 |
| M4 | **형제 맞바꿈** — `agentSessionPolicy` work↔code 본문 | 미실행 | **red** 5파일·35케이스 | EP-3·5·6 |
| M5 | **형제 맞바꿈** — `agentPermissionPolicy` work↔code 본문 | 미실행 | **red** 13파일·49케이스 | EP-4 |
| M6 | **형제 맞바꿈** — `agentPresentation` work↔code 본문 | 미실행 | **red** 9파일·22케이스 | EP-5 |
| M7 | **형제 맞바꿈** — `RIGHT_PANEL_POLICY` work↔code 본문 | 미실행 | **red** 9파일·38케이스 | EP-5·6 |
| M8 | 0023이 `'coding' → 'work'`로 이행 | 미실행 | **red** `migrate.test.ts` 3케이스 | EP-2 |
| M9 | `DEFAULT_AGENT_KIND = 'work'` | 미실행 | **red** 16파일·43케이스 | EP-1 |
| M10 | `dto.toSessionListItem`이 검증 없이 cast | 미실행 | **red** `dto.test.ts` | EP-1 |
| M11 | `reader.loadSession`이 검증 없이 cast | 미실행 | **red** `reader.test.ts` | EP-1 |
| M12 | `resolveAgentKind`의 mismatch 거부 삭제 | 미실행 | **red** 3파일·7케이스 | EP-3 |
| M13 | 출생 우선순위를 `requested ?? inherited`로 뒤집기 | 미실행 | green | **등가 변이** — 위 mismatch 가드가 두 값이 다를 때 이미 반환한다 |
| M14 | draft row 디코드를 `kind==='work'?'work':'code'`로 | 미실행 | green | **도달 불가 등가** → D2 |
| M15 | `files.ts`의 `allowContextFileOpen` 검사 무력화 | 미실행 | **red** 2케이스 | EP-3 |
| M16 | bootstrap 승인 resolver를 검증 없이 cast | 미실행 | green | **도달 불가 등가** → D2 |

**16건 중 13 red.** green 3건은 모두 도달 가능한 입력에서 동작이 동일함을 코드로 확인했다(M13은 가드가 선행, M14·M16은 입력이 이미 canonical). 새 mutation이 현재 계약 위반을 드러낸 사례는 **0건**이다.

- 동작 보존 추출 라운드인가: **부분적으로 그렇다** — 그래서 hunk 되돌림 대신 **형제 슬롯 맞바꿈 4종(M4~M7)**을 썼다. 값 존재만 보는 단언이면 침묵했을 자리에서 94케이스가 red다.
- 소거 변이의 잔여물 수렴: M15·M10·M11은 타입 진단 0인 상태에서 red다(typecheck는 cast로 통과시킨 뒤 vitest만 red).
- `N회`·순서 기준: 이번 ΔV8에 횟수/순서 AC가 없다.

## 5. V-pair closeout — `UT → IT → ST → AT`

첫 검증 라운드이므로 ΔV8의 REQUIRED·REGRESSION **6 pair 전건**과 이번 변경의 운영 gate를 실행했다.

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / EP |
|---|---|---|---|---|---|
| VP-R8-05 | MD-R8-01 ↔ UT-R8-01 / UT | REQUIRED | **PASS** | `agent-kind.test.ts` 2 · `permission-mode.r8.test.ts` 2 · `agentPresentation.r8.test.ts` 2 · M1·M2·M5·M6 red | strict/legacy 입력표 · 양쪽 반환값·정적 참조 / EP 1·4·5 |
| VP-R8-03 | AR-R8-01 ↔ IT-R8-01 / IT | REQUIRED | **PASS** | `migrate.test.ts` 3 · `dto.test.ts` · `reader.test.ts` · 검증자 SQLite fixture · M8·M10·M11 red | DB→DTO/reader→IPC→store, profile→runtime / EP 1·2·3 |
| VP-R8-04 | AR-R8-02 ↔ IT-R8-02 / IT | REQUIRED | **PASS** | `modes.test.ts`·`modes.r6/r7` · `ApprovalCard`·`RightPanel`·`navSections.render` · M5·M6·M7 red | 정책→Composer/본문/패널/nav 클릭 결과 / EP 4·5 |
| VP-R8-02 | SD-R8-01 ↔ ST-R8-01 / ST | REQUIRED | **PASS** | `send.busy.test.ts` 5 · `resolve-turn.agent.test.ts` · `chat-turn.continuity` · `ChatTile.workLifetime` · M12·M4 red | 초안→send/lease→load/continuation·전환/닫기 / EP 1·3·6 |
| VP-R8-01 | R-R8-01 ↔ AT-R8-01 / AT | REQUIRED | **PASS** | `agentPolicy.r8.test.ts` 4 · `agentModeLanding.render` · i18n `code` · native 재현 153/154 | 선택/저장/복원→UI / EP 1·2·5 |
| VP-R8-06 | V1 VP-03/04/05/07/11/14 · ΔV6 05/06 · ΔV7 03/04 | REGRESSION | **PASS** | 전 스위트 441파일·4123케이스 green — 인용된 원 계약의 행동 suite가 모두 포함된다 | 종류 고정·계승·지침·warm·identity / EP 3·4·5·6 |

- root `PAIR_FAIL`: **없음**. 종속 `BLOCKED_BY`: **없음**.
- 하나의 증거가 여러 pair를 닫은 경우: 전 스위트 green은 VP-R8-06의 직접 증거이자 나머지 5 pair의 배경이다. 각 pair는 위 표의 **개별 파일**로 독립 판정했다.

### AT / AC 세부와 합계

| AC | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AC-R8-1 | code/work 정상, 구형 `coding`은 지정 경계에서만 code, unknown 오류 | ✅ | `agent-kind.test.ts`·`agentPolicy.r8.test.ts`·`protocol.send.test.ts` · M1·M2 red |
| AC-R8-2 | 업그레이드/빈 DB의 값·기본값·CHECK가 code/work, 데이터·FK·검색·재열기 보존 | ✅ | 검증자 SQLite fixture(아래) · `migrate.test.ts` 3 · M8 red |
| AC-R8-3 | 양쪽 권한·세션·UI/패널 정의가 완전하고 소비자가 선택 결과를 쓴다 | ✅ | 5표 `satisfies Record<AgentKind,…>` · typecheck exit 0 · M4~M7 red 144케이스 |
| AC-R8-4 | 정상/자동 연속 턴의 종류·지침·warm key·도구와 Work 경계 기록 유지 | ✅ | `builder`·`system-header.agent`·`response-boundary.integration`·`continuation` · M3 red |
| AC-R8-5 | Work/Code 메뉴·본문·패널·상세·nav가 같은 역할로 연결 | ✅ | `modes`·`ApprovalCard`·`RightPanel`·`SessionRow`·`navSections` · 검증자 native 재현 **153/154**(D5) |
| AC-R8-6 | 토글·조회 중 전환·패널 닫기·세션 이동에서 입력/폴더/Git 캐시·계승 유지 | ✅ | `CwdPanel.visibility`·`CwdPanel.isolation`·`ChatTile.workLifetime`·`chatReducer.panelPolicy` |
| AC-R8-7 | 정적 참조 재사용, 기존 투영/memo·가상화·실행 재사용 보존 | ✅ | `agentUiPolicy('work') toBe agentPresentation.work` · `AssistantTurn` memo가 정책 identity 비교 |

- **합계 재측정**: `✅ 7 · ⚠️ 0 · ❌ 0 = 총 7`. 분모는 ΔV8 「Acceptance Criteria」 표를 직접 세었다.
- **합계 사본 대조**: 본문 `7/7` ↔ 커밋 trailer `Criteria-Met: 7/7` ↔ impl-r8 §6 `7/7` ↔ INDEX 비고 `자기확인 7/7` — **네 사본 일치**.

#### 검증자 SQLite fixture (AC-R8-2 독립 재현)

0001~0022를 실제 better-sqlite3 3.53.2에 적용하고 `coding`/`work`/fork 자식 3행 + 메시지 2행 + FTS를 심은 뒤 0023을 트랜잭션으로 돌렸다.

| 관측 | 값 |
|---|---|
| 이행 결과 | `s-coding→code` · `s-child→code` · `s-work→work` |
| 컬럼 계약 | `TEXT NOT NULL DEFAULT 'code' CHECK (agent_kind IN ('code','work'))` |
| 인덱스 | `idx_sessions_updated`·`idx_sessions_project` 전후 동일 |
| FTS / 메시지 | `MATCH 'haystack'` 2건 전후 동일, 메시지 2행 유지 |
| 무결성 | `foreign_key_check` 0건 · `integrity_check` ok |
| CHECK 강제 | `'coding'`·`'bogus'` 거부, `NULL` 거부 |
| 신규 행 기본값 | `code` |
| close/open | 4행·FTS 2건 그대로 |
| 오염 행 rollback | 0023 실패 후 **구 컬럼·2행 원값 보존** |

### pair별 EP 강제 지점 분모 — 검증자 재열거

ΔV8은 숫자 분모 대신 "각 소비처 재열거"를 요구한다. 아래는 검증자가 코드에서 다시 센 값이다.

| EP | 계약 | 검증자 재열거 | 결과 |
|---|---|---|---|
| 1 | 종류 검증 경계 | `parseAgentKind` production 호출 **8** · `readLegacyAgentKind` **1** · `AgentKindSchema` admission **1** · `resolveAgentKind` **3** | PASS(8 중 6이 변이로 red, 2는 도달 불가 → D2) |
| 2 | 저장 이행 | migration 등록 **23**(`dir == migrate.ts imports`) · 0023 SQL 1 · 0022 미변경 | PASS |
| 3 | 실행/경계 guard | `resolveAgentKind` send·resolve·재확인 **3** · `persistResponseBoundaries` 주입 **2**(coordinator·writer) · directory/files await 전후 **3** | PASS |
| 4 | 권한 정책 | `agentPermissionPolicy` 소비 **4**(`permissionModeForAgent`·`planApprovedMode`·`coercePermissionMode`·`modes.ts`) | PASS |
| 5 | 표시 정책 | `agentUiPolicy` 소비 **9지점/7파일** · `RIGHT_PANEL_POLICY` 소비 **5지점** · `VISIBLE_TILE_REGISTRY` 2키 | PASS |
| 6 | 상태·캐시 수명 | `agentSessionPolicy` 소비 **5지점** · BranchChip `hidden` 1 · transcript remount key 1 | PASS |
| 7 | 문서·메시지 버스 | root plan·r8 plan·INDEX·IPC_CONTRACT·arch 5문서·i18n 2 · trailer 3커밋 | PASS(문구 1건 → D3) |

- 표 밖인데 같은 불변식이 필요한 지점: **없음**. production `agentKind === '…'` 분기 0건이 그 근거다(§7).
- "다른 게이트가 막는다"고 적은 행: ΔV8에 없다.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 결과 | 관측 |
|---|---|---|---|
| `npm run typecheck` | `app/**` 수정 | **PASS** | node·web·test 3분할 exit 0 |
| `eslint --no-fix ./src ./scripts` | 레이어 경계 강제 | **PASS** | **error 0 · warning 1**(기존 `useTranscriptVirtualizer`) |
| `vitest run` | 로직·DB·렌더 회귀 | **PASS** | **441파일**(440 pass·1 skip) · **4123케이스**(4121 pass·2 skip) |
| `node --test scripts/*.test.mjs` | 위생 스크립트 | **PASS** | 116 pass · 0 fail |
| `electron-vite build` | ΔV8 §검증 5의 production build | **PASS** | main·preload·renderer exit 0 |
| `check-doc-inventory.mjs --check` | docs 수정 | **PASS** | generated 9항목·89채널 · prose ok · **링크 전건 해석** |
| `check-migrations-appendonly.mjs` | migration 추가 | **PASS** | 23 migrations · dir == imports · git 이력 비교는 태그 부재로 skip → D7 |
| 커밋 trailer 파싱 | 메시지 버스 | **PASS** | `4e9e51f` 3키 · `4313e95` 5키가 `%(trailers:only=true)`로 그대로 반환 |
| native Chromium | ΔV8 §검증 5 | **PASS(재현)** | Linux/Xvfb에서 **checks 154 중 153 true** · `observed.errors []` · `sendCalls 0` · 1건은 D5 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `chat:send` `agentKind?: 'code' \| 'work'` | `AgentKindSchema` zod enum | `protocol.send.test.ts`가 `'coding'`·`'cowork'`·`''`·`null`·`true` 거부 | PASS |
| `SessionListItem`/`LoadedSession.agentKind` 필수화 | 타입 optional 제거 | Main이 `parseAgentKind`로 항상 채우고 renderer가 `LOAD_SESSION`에서만 누락 허용 | PASS |
| `sessions.agent_kind` 컬럼 | 0023 DDL | 위 SQLite fixture | PASS |
| `docs/IPC_CONTRACT.md`·`arch/*` | inventory link gate | 본문의 code/work 서술이 코드와 일치 | PASS(문구 1건 D3) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **production `'coding'` 리터럴 = 4**: `agent-kind.ts:19`(명명된 legacy 디코더) · `0023` 이행 SQL · `0022` 2줄(머지된 파일, 수정 금지). 전부 정당하다.
- **production `agentKind|agent_kind === '…'` 분기 = 0**. 느슨한 스윕 0건을 **한 단계 엄격하게**(주석 제외 + 모든 `===`/`switch`/삼항/리터럴 대입) 다시 돌렸고 차집합은 `TaskPanelContent`의 `mode: 'work' \| 'plan'`(제품 종류가 아닌 배치 모드)과 OAuth `kind: 'code'`·오류 `code`·Confluence `code` 태그 같은 **동음이의 4건**뿐이다. 이 스윕은 *전수임*을 재지 *잠금*을 재지 않는다 — 잠금은 §4의 M4~M7이 판정했다.
- 내역 합 = 총계: AC 7 = ✅7 · pair 6 = PASS 6 · gate 9 = PASS 9.
- 0건 게이트가 지운 정당한 이력: 없다. `0022`의 `'coding'` 2줄을 예외로 남겼다.
- 상한: 정책 조회는 O(1) 정적 인덱싱이다. 타이머·프로세스·요청 fan-out 증가 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

"electron이라 불가"로 넘기지 않고 세 층을 기계로 끌어왔다.

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| DB 이행 | 실제 better-sqlite3로 0001→0023 + 오염 rollback | 사용자 실 DB 첫 부팅(백업 파일 생성·WAL) | Windows 앱을 기존 프로필로 실행하고 세션 목록 확인 |
| native 렌더 | Linux/Xvfb Electron으로 fixture 153/154 재현 | Windows 실물 창의 시각 품질·좁은 창·다크 | 검증 시점 fixture `structural-r8-native.mjs` 실행 후 Electron 전달 (fixture는 이후 정리됨) |
| 실제 모델 | 해당 없음 | ΔV8이 `NOT_REQUIRED`로 둔 VP-15는 이전 상태 유지 | 이번 handoff가 닫지 않는다 |

- egress 차단이 아니었다. 프록시로 electron 바이너리를 받아 native fixture를 직접 돌렸다.

## 9. 게이트 재실행

```bash
cd app
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci        # node_modules 부재 → 설치
node scripts/ensure-sqlite-abi.mjs node       # DB 스위트용 Node ABI
npm run typecheck
./node_modules/.bin/eslint --no-fix ./src ./scripts
./node_modules/.bin/vitest run
node --test scripts/*.test.mjs
./node_modules/.bin/electron-vite build
node scripts/check-doc-inventory.mjs --check && node scripts/check-migrations-appendonly.mjs
```

- **관측한 실행 산출**(exit code 아님): 위 gate 표의 파일 수·케이스 수·error/warning 수를 그대로 적었다.
- `npm test`를 쓰지 않았다. `pretest`를 우회해 ABI 전환을 한 번(Node)만 했고, `npm run lint`(`--fix`) 대신 `eslint --no-fix`를 써서 **작업 트리를 쓰지 않았다**.
- 환경 기인 실패 분리: 첫 전 스위트에서 6파일이 `Electron failed to install correctly`로 red였다. `node node_modules/electron/install.js`로 바이너리를 받은 뒤 같은 6파일이 25케이스 green이 됐고, 최종 측정에는 red 0이다. **변경 무관 환경 실패였다**.
- **게이트가 작업 트리를 바꿨는가**: 아니다. 모든 실행 후 `git status --short`가 비어 있다.
- **검증 중 실행한 명령의 잔여물**: `app/out/`·`app/node_modules/.cache/orca/`(둘 다 gitignore)를 만들었고 **삭제했다**. `xvfb`를 컨테이너에 설치했으나 저장소 산출물이 아니다. better-sqlite3는 현재 **Node ABI**다 — Windows에서 `dev`/`build`를 하려면 `npm run predev`가 Electron ABI로 되돌린다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트/빌드 | 실행·산출 관측 | — | 전건 실행 |
| AC ↔ production path | 7행 1:1 대조 | — | 일치 |
| 정책 전수·레이어 경계 | 스윕 + 변이 16종 | — | 13 red |
| 문서 형식/링크/inventory | 기계 검증 | — | PASS |
| 제품 의도 / Open Question | 보조 | **결정** | ΔV8에 미해결 Open Question 없음 |
| UI 시각 품질 | 로직·DOM 계약 기계 검증 | **Windows 시각 확인** | 남음 |
| PR merge | 상태 보고 | **승인** | 남음 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 범위에서 `AGENTS.md`를 **변경하지 않았다**(`git diff --name-only 4e9e51f 4313e95`에 없음). 위생 검사 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 라운드: 검증 전 `impl` · `IMPL_DONE` · `Claude (verify)` · `8`로 실제와 일치했다.
- 「다음 주체」 칸이 주체 하나만 담는가: 예.
- **대상 커밋 좌표 기입**: 구현자가 남긴 `(r8 구현 — 검증자 기입)`을 `4e9e51f`(설계)·`4313e95`(r8)로 채웠다. `git cat-file -t` 두 건 모두 `commit`.
- 비고 5줄 이내: 이번 턴 갱신분을 5줄 이내로 다시 썼다.
- PASS archive 이동: **보류** — 남은 사람 실기(§8) 뒤에 옮긴다.

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Handoff: docs/handoff/0224-work-agent-layer/` · `Status: designed|implemented` · `Criteria-Met: 7/7` · `Verified-By: pending` 모두 root `AGENTS.md` 표 안이다.
- trailer 파싱: `git log -1 --format='%(trailers:only=true)' 4313e95`가 5키를 그대로 반환한다(0건 아님).
- 인용 해시 실재: `4e9e51fa`·`0c24aaa2`·`4313e953` 모두 `git cat-file -t` = commit.
- `[구현자 기입]` 7필드: impl-r8.md가 설계 대조 · 강제 지점/V-pair · 이번 라운드 잠금 · Product/UX 파생 · 발견한 문제 · 구현 보고 · 후속 신호 **7/7**을 갖는다. 산문으로 접힌 필드 0.
- reference: `check-doc-inventory.mjs`의 링크 검사가 상대 링크 전건 해석을 확인했다. r8 evidence 20파일·fixture 4파일이 impl-r8.md에서 참조된다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| Composer 카탈로그의 `Object.fromEntries as Record`가 타입 완전성을 우회 → 정적 카탈로그로 교체 | 타당 | `modes.ts`가 `Record<NormalizedPermissionMode, …>` 전수를 강제한다. 라벨/순서 이행 전과 동일 |
| HistoryWriter의 기본 false 정책이 조립 누락을 숨김 → 필수 인자로 변경 | 타당·**검증 강화** | M3(형제 맞바꿈)이 red인 이유다 |
| `TaskPanelContent`의 `work/plan`은 배치 모드라 유지 | 타당 | 유니온이 `'work' \| 'plan'`이라 AgentKind와 축이 다르다(§7 차집합) |
| 확대 Main 회귀가 오래된 mock을 드러냄 → 실제 컨트롤러 사용 | 타당 | 후속 턴 수·모델·지침·worktree 단언 유지 확인 |
| "별도 결함 변이는 선택하지 않았다" | 계획대로이나 **증거 부족** | 그래서 검증자가 16종을 심었다(§4) |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `SessionInsert.agentKind`가 여전히 optional이고 `queries.ts:386`이 `?? DEFAULT_AGENT_KIND`를 적용한다. 현재 유일한 production 호출부(`writer.ts:253`)는 항상 값을 넘긴다 | D-052 인접 | NON_BLOCKING | 필수 필드로 좁히면 D-052가 write 축까지 닫힌다 |
| D2 | `parseAgentKind` 8지점 중 2지점(`chatStore.ts:1817` draft row, `bootstrap.ts:934` 승인 resolver)은 어떤 테스트도 잠그지 않는다(M14·M16 green) | EP-1 | NON_BLOCKING | 두 입력이 이미 canonical이라 등가 변이다. 잠그려면 비정상 값을 주입할 seam이 필요하다 |
| D3 | `docs/arch/backend/persistence.md:87`이 "구형 coding 값의 이행은 **후속** 컬럼 migration에서 수행"이라 적는다. 0023이 이번 라운드에 이미 수행했다 | EP-7 | NON_BLOCKING | 85행이 0023을 현재 컬럼 계약으로 명시해 모순은 아니다. "0023이 수행했다"로 바꾸면 단독으로도 읽힌다 |
| D4 | `plan.md`의 `## [구현자 기입]`이 r1·r2만 담는다. r3~r8은 `impl-rN.md`에만 있다 | EP-7 | NON_BLOCKING | plan 메타가 r8 보고를 링크해 증거는 살아 있다 |
| D5 | native fixture의 `panel:code:retained-dom-scroll-focus`가 Linux/Xvfb에서 **결정적으로** red다(3/3). work 씬 뒤에 code 씬을 돌릴 때만 발생하고, code 단독·역순은 green이다 | AC-R8-5 | NON_BLOCKING | 4개 conjunct를 분해해 원인을 특정했다 — 아래 상세 |
| D6 | `rightPanelTiles.ts:50` `isRightPanelTileId`가 production·테스트 모두 참조 0 | 비귀속 | NON_BLOCKING | `git log -S`가 `d542bfc`를 가리킨다. r8 산출이 아니다 |
| D7 | `check-migrations-appendonly.mjs`가 "no previous v* tag"로 git 이력 비교를 skip했다 | 환경 | NON_BLOCKING | 검증자가 `git log -- 0022_session_agent_kind.sql`로 대신 확인했다(마지막 변경 `16d72d6`, r8 아님) |

### D5 상세 — 왜 제품 결함이 아닌가

패치한 fixture 사본으로 conjunct 4개를 분리 기록했다.

| 관측 | code 단독(green) | work→code(red) |
|---|---|---|
| `sameNode` / `notHidden` / `focusEqual` | true / true / true | true / true / **true** |
| `before`(샘플 시점 최대 스크롤) | 51 | **61** |
| 복귀 후 `scrollTop` | 51 | 51 |
| 샘플 시점 `clientHeight` / 카드 높이 | 1035 / 1079 | **1025 / 1069** |
| 정착 후 `clientHeight` / 카드 높이 | 1035 / 1079 | **1035 / 1079** |
| `scrollHeight` | 1086 | 1086 |

fixture가 `scrollTop = 80`을 넣는 순간 패널 카드가 **아직 10px 낮았고**, 그래서 클램프 최대가 61이 됐다. 상세 왕복 뒤 카드가 1079로 정착하자 최대가 51로 줄어 브라우저가 다시 클램프했다. 콘텐츠 높이(`scrollHeight` 1086)와 정착 기하는 두 경우가 **완전히 같다**. 즉 스크롤 복원은 정착 레이아웃의 최대값을 정확히 돌려주며, 실패한 것은 *전이 중에 읽은 기준값*이다. DOM identity·hidden·포커스 복원 3개 conjunct는 red 실행에서도 참이었다. Windows 실행에서 같은 씬 순서가 통과한 구현자 보고와도 모순되지 않는다.

## 14. Review Signals — 사실만

- **impl 라운드 8회 동안 verify 턴이 0회였다.** 이번이 첫 독립 검증이고, `docs/handoff/AGENTS.md`가 사례로 든 0188과 같은 형태다.
- 이전 라운드와 동일/유사 증상: 비교할 이전 verify 판정이 없어 **대조 불가**.
- 관련 plan 지침/AC: ΔV8이 "모든 pair는 실제 결과 oracle"이라며 적대 증거를 0건 등록했다. 그래서 이번 검증의 변이 16종은 전부 검증자 신설이다.
- 사용자 결정 변경 근거: D-050~054가 사용자 발화 인용을 갖는다. 무단 변경 없음.
- 반복된 검증 환경 한계: 없다. 이번에는 electron 바이너리·xvfb·Node ABI를 모두 확보해 native까지 재현했다.
- 라운드 8 > 3이라 `docs/handoff/AGENTS.md`는 다음 재구현 전 `handoff-review`를 요구하지만, ΔV8은 "기존 사용자 지시에 따라 handoff-review는 사용하지 않는다"고 적는다. **사실만 기록한다.**

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED 5 PASS · REGRESSION 1 PASS · root `PAIR_FAIL` 0 · `BLOCKED_BY` 0
- PLAN_GAP: **없음**
- Product/UX 및 ACTIVE Decision: D-050~054 전건 충족. production `agentKind` 분기 0건이 D-051·D-052의 직접 증거다
- AC 충족: **✅ 7 / 7**(본문·trailer·impl 보고·INDEX 네 사본 일치)
- 현재 변경 운영 gate: 9/9 PASS — typecheck 0 · eslint error 0 · vitest 441파일 4123케이스 · scripts 116 · build exit 0 · inventory·append-only·trailer·native 재현
- 적대 증거: 검증자 변이 **16종 중 13 red**, green 3은 도달 가능 입력에서 등가임을 코드로 확인
- NON_BLOCKING: 7건(D1~D7). NEXT_HANDOFF: 없음
- repository operation checks: INDEX 좌표 기입 완료 · trailer 파싱 확인 · `[구현자 기입]` 7/7 · AGENTS 변경 없음
- 남은 사람 확인: **Windows 실기 2건** — ① 기존 사용자 DB 첫 부팅에서 0023 이행과 백업 파일, ② 실물 창의 `코드`/`작업` 라벨·좁은 창·다크 시각 품질
- 다음 단계: 보드를 `verify/PASS`·다음 주체 **사람**으로 두고, 실기 완료 후 archive로 옮긴다
