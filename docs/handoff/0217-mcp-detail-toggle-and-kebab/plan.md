# Plan — 0217-mcp-detail-toggle-and-kebab

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0217-mcp-detail-toggle-and-kebab` |
| 작성자 | Claude Code |
| 일자 | 2026-09-06 |
| 매핑 | `claude/transcript-spinner-attachment-27cc38` |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 이 표면을 다루는 0031·0159 계열 plan 에 V registry 가 없다(`rg 'V mode' docs/handoff/0159-*/plan.md` = 0건) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

> **이 plan 은 구현 뒤에 쓰였다.** 사용자가 "plan 작업을 하지마라 / 이것외에 몇개의 요구사항을
> 만족후 plan 및 verify 작성하겠다" 로 순서를 지정했다(D-305). 규범 행(Decision·AC·V node/pair·§10)은
> 이 문서가 정본이다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: nav → 플러그인 → MCP 에서 서버를 추가한 뒤 **삭제할 UI 경로가 없다**. 활성 상태는 텍스트 버튼이 갖고 있어 파괴적 동작을 놓을 자리도 없다.
- 완료 후 달라지는 것: 활성 상태는 토글이 갖고, 제거·편집은 케밥 메뉴에 모인다. 배치가 skills 상세와 같아진다.
- 성공을 사용자 관점 한 문장으로: MCP 상세에서 토글로 켜고 끄고, 케밥에서 편집하거나 확인 후 삭제할 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "nav의 플러그인->mcp 에서 mcp 추가 시 삭제할 수 있는 메뉴가 없다." | 라이브 세션 |
| 명시 요구 | "화성화 버튼을 토글버튼으로 대체하라" (오타 — '활성화 버튼') | 라이브 세션 |
| 명시 요구 | "그외 추가적인 메뉴는 케밥버튼으로 배치할것 (skills 참조)" | 라이브 세션 |
| 추론 의도 | "skills 참조" = `SkillDetail` 의 헤더 배치(Toggle + 케밥 + Popover 메뉴 + 제거 확인 모달)를 그대로 따른다 | 설계자 판단 (D-303) |
| 추론 의도 | "그외 추가적인 메뉴" 의 구체 항목은 **편집**과 **제거** 둘이다 — 편집은 모달·IPC·문구가 이미 있는데 진입점만 없었다 | 설계자 판단 (D-304) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-301 | MCP 상세에 **제거 경로**를 만든다 — 케밥 메뉴 항목 + 확인 모달 | 사용자 "삭제할 수 있는 메뉴가 없다" | 사용자 턴 | ACTIVE | — |
| D-302 | 활성/비활성 **텍스트 버튼을 `Toggle` 로 대체**한다 | 사용자 "화성화 버튼을 토글버튼으로 대체하라" | 사용자 턴 | ACTIVE | — |
| D-303 | 헤더 배치는 `SkillDetail` 과 같다 — 우측에 Toggle, 그 옆 케밥, 케밥이 Popover 메뉴를 연다 | 사용자 "(skills 참조)" | 사용자 턴 | ACTIVE | — |
| D-304 | 케밥 항목은 **편집 · 제거** 둘이다. 편집은 죽어 있던 `AddMcpServerModal` 을 진입점으로 되살린다 | 사용자 "그외 추가적인 메뉴". `mcpUpdate` IPC·편집 모드·`titleEdit` 문구가 이미 있고 소비자만 0곳이었다 | 설계자 판단 + 실측 | ACTIVE | — |
| D-305 | 이번 작업은 **구현 → plan 순서**로 진행한다 | 사용자 "plan 작업을 하지마라" · "…plan 및 verify 작성하겠다" | 사용자 턴 | ACTIVE | 이 handoff 한정 |
| D-306 | 메뉴 항목은 **공용 `MenuItem`**(0121)을 쓴다 — `SkillDetail` 의 로컬 `MenuRow` 를 복사하지 않는다 | 0121 이 "파일마다 재정의되던 로컬 MENU_ITEM 상수를 단일화한다" 고 못박았다. 세 번째 사본을 만들지 않는다 | 저장소 규칙 | ACTIVE | — |
| D-307 | `SkillDetail` 의 로컬 `MenuRow` 는 **이번에 옮기지 않는다** | 사용자가 요청하지 않은 표면의 시각 변경이다. 차이는 gap 10px→8px · `text-ink`→`text-t8` 로 작다 | 설계자 판단 | ACTIVE | 후속 후보(§파생 이슈 D1) |
| D-308 | 이름 변경 후 상세 선택을 **새 id 로 따라간다** | `McpServer.id` 가 곧 서버 이름이라 rename 이 재키잉이다(`store.ts:172·89`). 안 따라가면 저장 직후 상세가 사라지고 목록으로 튕긴다 | 실측 | ACTIVE | — |

### 갱신 메모

- 새로 추가된 결정: D-301~D-308.
- 변경된 결정: 없음 — 기존 handoff 의 ACTIVE 결정과 충돌하지 않는다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** D-301↔AT-301·AT-306 · D-302↔AT-302 · D-303↔AT-303·AT-305 · D-304↔AT-304 · D-305↔해당 AC 없음(절차) · D-306↔AT-305 · D-307↔해당 AC 없음(비범위 선언) · D-308↔AT-304.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 삭제가 **없는** 것이 맞다. 다만 없는 것은 UI 뿐이고 IPC 는 이미 끝까지 있다(§8 전수) |
| 이미 기존 코드가 충족하는가 | 부분 충족 — 백엔드만 | `mcpDelete` 채널·main 핸들러·preload·`useMcpServers.remove` 4단이 모두 존재하고 소비자만 0곳이다. **새로 만들 IPC 가 없다** |
| 더 작은 해법이 있는가 | 아니오 | 토글 대체는 사용자 명시 요구이고, 제거를 버튼으로 나란히 두면 파괴적 동작이 일상 동작과 같은 무게가 된다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | `SkillDetail` 의 케밥 구성과 `MenuItem`(0121) 표준을 코드에서 직접 읽었다 |
| ACTIVE 결정·기존 규칙과 충돌하는가 | 아니오 | renderer 4-layer·시맨틱 토큰·그룹 스코프 규칙을 모두 지킨다 |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: `mcpDelete` 배선 존재 · `AddMcpServerModal` 소비자 0 · `McpServer.id` = 서버 이름 · `MenuItem` 이 메뉴 항목 표준.

## 5. 동작 / 사용자 흐름

```text
[플러그인 → MCP → 서버 선택]
  → [상세: 이름·전송방식·활성 상태 · 우측 Toggle + 케밥]
  → 토글 클릭 → mcp.toggle → 목록 refresh → Dot·문구 갱신
  → 케밥 → 편집 → AddMcpServerModal(initial) → 저장 → mcp.update → 상세 갱신
                                                   ↘ 이름 변경 시 상세 선택이 새 id 를 따라간다
  → 케밥 → 제거 → 확인 모달(서버 이름 표시) → mcp.remove → 목록으로 복귀
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 상세 진입 | `McpDetail` 마운트, 메뉴·모달 닫힘 | Toggle 이 서버의 활성 상태를 그대로 표시 |
| 토글 클릭 | `mcp.toggle(id, !enabled)` → `refresh()` | Toggle·Dot·활성 문구가 함께 바뀐다 |
| 케밥 클릭 | `menuOpen` 토글 | 편집·제거 두 항목이 뜬다(제거는 danger 톤) |
| 편집 저장 | `mcp.update(...)` → `refresh()` | 상세가 새 값으로 갱신. 이름을 바꿨으면 선택이 새 id 를 따라간다 |
| 제거 확인 | `mcp.remove(id)` → `refresh()` | 목록에서 사라지고 상세가 언마운트돼 목록 화면으로 돌아간다 |
| 제거 진행 중 | `removing` 참 | 확인 버튼이 "제거 중…" 으로 바뀌고 비활성 |

### 파생 UX / 엣지케이스

- cancel: 확인 모달은 Esc·백드롭·취소로 닫힌다(공용 `Modal` 계약). 닫으면 아무 것도 지우지 않는다.
- error: `mcp.remove` 가 던지면 `removing` 이 `finally` 에서 풀려 버튼이 되살아난다. 확인 모달은 열린 채 남는다.
- a11y: 케밥은 `aria-haspopup="menu"` · `aria-expanded` · `aria-label=common.more`. Toggle 은 `role="switch"` · `aria-checked` · 서버 이름을 담은 `aria-label`.
- 비범위 표면: 목록 행에는 케밥을 두지 않는다 — skills 목록 행도 두지 않는다(같은 배치 유지).

## 6. 범위 / 비범위

- **범위**: `McpDetail` 헤더 액션(Toggle + 케밥 + 메뉴 + 제거 확인 모달), `ExtensionsCatalogView` 의 편집·제거 배선, ko/en 문구, 렌더 테스트.
- **비범위**: MCP IPC·store(이미 존재) · 목록 행 액션 · `SkillDetail` 의 로컬 `MenuRow` 이설(D-307) · providers 탭.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `SkillDetail` 을 공용 `MenuItem` 으로 이설 | 아니오 | D-307 — 후속(§파생 이슈 D1) |
| 케밥 **메뉴 항목**의 자동 검증 | 아니오 | vitest 환경이 `node` 라 포털을 렌더하지 못한다. AT-307 사람 실기 + §17 명시 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-301 | AT-301 | 상세에서 서버를 제거할 수 있다 | 케밥 메뉴에 danger 톤 제거 항목이 있고, 확인 모달을 거쳐 `mcp.remove(id)` 가 불린다. 모달은 **닫힌 채로** 시작한다 | 케밥 → 메뉴 → 모달 → `mcpApi.delete` → main → `deployExtensions` |
| R-302 | AT-302 | 활성 상태는 토글이 갖는다 | 렌더 출력에 `role="switch" aria-checked="true|false"` 가 서버 상태와 일치. **두 상태 모두**에서 옛 텍스트 버튼(`>활성화<`·`>비활성화<`)이 0건 | `McpDetail` → `Toggle` → `mcp.toggle` |
| R-303 | AT-303 | 그 밖의 동작은 케밥에 모인다 | 렌더 출력에 `aria-haspopup="menu"` · `aria-expanded="false"` · `aria-label=common.more` 를 가진 트리거가 있다 | `McpDetail` → `Popover` |
| R-304 | AT-304 | 편집 경로가 살아난다 | `AddMcpServerModal` 의 프로덕션 소비자가 **1곳**(0곳 → 1곳). 저장이 `mcp.update` 를 부르고, 이름을 바꾸면 상세 선택이 새 id 를 따라간다 | 케밥 → 모달 → `mcpApi.update` → main |
| R-305 | AT-305 | 배치가 skills 상세와 같다 | 헤더 우측이 `Toggle` + 케밥 순서이고, 메뉴 항목이 공용 `MenuItem` 이다(로컬 사본 신설 0) | `McpDetail` ↔ `SkillDetail` 대조 |
| R-306 | AT-306 | 문구가 두 로케일에 갖춰지고 죽은 키가 없다 | `resources.test.ts` 의 ko↔en 리프 키 일치·빈 값 0·플레이스홀더 일치가 green. 제거된 `enable`/`disable` 키의 참조 0건 | `useI18n` → `tr('skills.mcpDetail.*')` |
| R-307 | AT-307 | 실행 앱에서 케밥 메뉴가 편집·제거를 보여주고 제거가 실제로 지운다 | 사람 실기 — 메뉴를 열어 두 항목 확인, 제거 후 목록에서 사라지는지 확인 | 앱 실행 |

### AC 검증 주의사항

- **AT-301·AT-305 의 메뉴 항목 축은 자동 검증되지 않는다.** `Popover` 는 열렸을 때만 `document.body` 로 포털하는데 vitest 환경이 `node` 라 DOM 이 없다(`app/vitest.config.ts`). 렌더 테스트는 **닫힌 상태에서 관측 가능한 것**(토글 상태·케밥 트리거·모달 부재)만 단언하고, 항목 자체는 AT-307 실기가 닫는다. 이 경계를 §17 에 남긴다.
- AT-302 의 술어는 **엘리먼트 텍스트**(`>활성화<`)를 본다. 부분 문자열로 재면 Toggle 의 `aria-label`("<이름> 활성화")에 걸려 회귀와 구분하지 못한다.
- AT-302 는 `enabled` 두 상태를 모두 렌더해 본다 — 한쪽만 보면 반대 상태에 남은 버튼을 놓친다.
- AT-304 의 "소비자 1곳" 은 프로덕션 파일 기준 전수 검색이다. 0곳이었다는 사실을 함께 관측해 증가 방향을 고정한다.
- AT-306 은 기존 `resources.test.ts` 를 재사용한다 — describe 3개(`ko↔en 리프 키 집합 일치` · `빈 문자열 값 없음` · `보간 플레이스홀더({{x}}) 일치`)가 실재함을 확인했다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — 이 표면을 다룬 0031·0159 계열 plan 에 V registry 가 없어 상속할 노드가 없다.
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: **R** — 사용자가 받는 동작(삭제 경로·토글)이 새로 생긴다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-301~R-307 | R | §7 | NEW | — |
| AT-301~AT-307 | AT | §7 | NEW | — |
| SD-301 | SD | §5 상태 전이 · §13 | NEW | 상세 → 제거 → 목록 복귀의 수명주기 |
| AR-301 | AR | §9·§10 | NEW | `McpDetail` props ↔ `ExtensionsCatalogView` 배선 ↔ 기존 `mcpApi` |
| AR-302 | AR | §10 | NEW | rename 재키잉 ↔ 상세 선택 추적 |
| MD-301 | MD | §10·§11 | NEW | `McpDetail` 로컬 상태(menuOpen·confirmOpen·removing) 불변식 |
| ST-301·IT-301·UT-301 | ST/IT/UT | §7·§10 | NEW | 아래 pair 의 증거 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-301 | R-301·SD-301 ↔ AT-301·ST-301 | REQUIRED | 케밥 → 메뉴 → 확인 모달 → `mcp.remove` → `mcpApi.delete` → main → 목록 refresh | 렌더 출력에 모달 부재(닫힌 시작) + 소스의 `onRemove` 배선 | not selected — 항목 축은 DOM 부재로 자동 관측 불가. AT-307 실기가 닫는다 | EP-301 (3) |
| VP-302 | R-302 ↔ AT-302·UT-301 | REQUIRED | `McpDetail` → `Toggle` → `mcp.toggle` | `role="switch" aria-checked` 두 상태 + 옛 버튼 텍스트 0건 | required — 음성 술어라 방향 입증 필요. 변이: Toggle 을 옛 텍스트 버튼으로 되돌림 | EP-302 (3) |
| VP-303 | R-303 ↔ AT-303 | REQUIRED | `McpDetail` → 케밥 → `Popover` | `aria-haspopup`·`aria-expanded`·`aria-label` | required — 존재 주장. 변이: 케밥 트리거 속성 제거 | EP-303 (2) |
| VP-304 | R-304·AR-301·AR-302 ↔ AT-304·IT-301 | REQUIRED | 케밥 → `AddMcpServerModal(initial)` → `mcp.update` → refresh → 선택 추적 | 소비자 전수 1(이전 0) + `auth === undefined` 미전달 + rename 시 `openDetail(state, values.name)` | not selected — 전수 검색과 배선이 곧 계약. rename 축은 AT-307 실기 | EP-304 (4) |
| VP-305 | R-305 ↔ AT-305 | REQUIRED | `McpDetail` ↔ `SkillDetail` | 헤더 순서 Toggle→케밥 + 공용 `MenuItem` import(로컬 사본 신설 0) | not selected — 소스 전수가 곧 계약 | EP-305 (2) |
| VP-306 | R-306 ↔ AT-306 | REGRESSION | `ko`/`en` → `useI18n` → `tr` | `resources.test.ts` 3 케이스 + 죽은 키 참조 0건 | not selected — 기존 위생 테스트가 직접 oracle | EP-306 (2) |
| VP-307 | R-307 ↔ AT-307 | REQUIRED | 실행 앱 플러그인 → MCP → 상세 | 사람 실기 | not selected — DOM 없는 환경의 보완 경로 | 0 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree (`app/**`) | renderer 컴포넌트·i18n·테스트를 바꾼다 | `npm run lint && npm run typecheck` → `./node_modules/.bin/vitest run src/renderer` | 이번 변경이 낸 실패만 blocking. `@opencode-ai/sdk` 미설치 기인 typecheck 2건은 분리 보고 |
| repository (docs) | plan·INDEX 를 추가한다 | `cd app && node scripts/check-doc-inventory.mjs --check` | 이번 diff 가 낸 오류 |
| message bus | 설계 커밋과 구현 커밋을 분리한다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 삭제 IPC 가 **끝까지 이미 있다** — 채널·main 핸들러·preload·훅 | `shared/ipc.ts:79` · `main/app/handlers/mcp.ts:23` · `preload/index.ts:226` · `features/skills/hooks/useMcpServers.ts` `remove` |
| `AddMcpServerModal` 은 편집 모드까지 구현돼 있고 **소비자가 0곳**이다 | `features/skills/components/AddMcpServerModal.tsx:22`(`initial?: McpServer`) |
| `McpServer.id` 는 서버 **이름**이다 — rename 이 재키잉이다 | `main/features/extensions/mcp/store.ts:172`(`const prevName = data.id`) · `:89`(`Object.entries(servers).map(([name, ...]))`) |
| `store.update` 는 `data.X ?? prev` 라 미전달 필드를 보존하고, `auth` 는 `undefined` 가 곧 미변경이다 | `store.ts:187-198` |
| 메뉴 항목 표준은 공용 `MenuItem`(0121) — 파일마다의 로컬 상수를 단일화한 것 | `shared/ui/MenuItem.tsx:5-9` |
| `SkillDetail` 은 아직 로컬 `MenuRow` 를 쓴다 | `features/skills/components/customize/SkillDetail.tsx:25` |
| `Popover` 는 열렸을 때만 `document.body` 로 포털한다 | `shared/ui/Popover.tsx` `createPortal` |
| vitest 환경이 `node` 라 DOM 이 없다 | `app/vitest.config.ts` `environment: 'node'` |
| 목록 행에는 액션이 없다 — 그룹 접힘 토글뿐 | `customize/CustomizeList.tsx` (`kebab` 0건) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `AddMcpServerModal` 프로덕션 소비자 (변경 전) | `rg 'AddMcpServerModal' --include=*.tsx --include=*.ts` 에서 자기 파일·주석 제외 | 0 | 죽은 컴포넌트였다 — D-304 의 근거 |
| `McpDetail` 소비자 | `rg 'McpDetail'` | 1 | `ExtensionsCatalogView.tsx` |
| `mcpDetail.*` i18n 참조 (변경 전) | `rg "mcpDetail\." --include=*.tsx` | 3 | `active`/`inactive` · `disable`/`enable` · `configSummary` — `enable`/`disable` 은 이번에 죽는다 |
| `KebabButton` 소비자 | `rg 'KebabButton' --include=*.tsx` | 2 | 목록 행 전용(`SessionRow`·`PinnedProjectsSection`) — 상세 패널은 `SkillDetail` 처럼 직접 버튼을 만든다 |
| 목록 행 케밥 | `rg 'kebab' customize/CustomizeList.tsx` | 0 | 비범위 근거 |

### 수치 / 전칭 표현 검산

- "삭제 메뉴가 없다" 는 **UI 한정**이다: IPC 4단이 모두 존재하고 UI 소비자만 0이었다(위 표).
- "이미 있다" 는 주장의 반례 검색: `rg 'mcpDelete|mcpApi.delete'` 로 채널·preload·훅 3자리를 전수 확인했다.
- 기존 테스트 케이스 존재 확인: `resources.test.ts` 의 `it` 3개 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 변경 전 구조

- 관련 V node: `AR-301`.
- 책임 소유자: `McpDetail` 이 헤더·요약·설정 표시만 갖고, 상태 변경은 `onToggle` 하나뿐이다. `ExtensionsCatalogView` 가 선택·목록·추가 모달을 갖는다.
- 경로: 상세 → `onToggle` → `mcp.toggle` → `mcpApi.update` → main → `refresh`.
- 문제: `mcp.remove` 와 `AddMcpServerModal` 이 존재하는데 호출부가 없다. 제거·편집이 **도달 불가능한 코드**다.

```text
[ExtensionsCatalogView] --server, onToggle--> [McpDetail]
                                                  └─ 활성화/비활성화 텍스트 버튼
[useMcpServers.remove]  ← 호출부 0
[AddMcpServerModal]     ← 소비자 0
```

### TO-BE — 변경 후 구조

- 관련 V node: `AR-301` · `AR-302` · `MD-301` · `SD-301`.
- 책임 소유자: `McpDetail` 이 헤더 액션(Toggle·케밥·메뉴)과 **제거 확인 모달**을 갖는다(`SkillDetail` 과 같은 소유 구조). `ExtensionsCatalogView` 가 편집 모달과 선택 추적을 갖는다.
- 경로: 상세 → 케밥 → 메뉴 → (편집 모달 | 확인 모달) → `mcp.update` / `mcp.remove` → `refresh`.
- 유지: IPC·store·훅 전부 불변. 목록 행 배치 불변.

```text
[ExtensionsCatalogView] --server, onToggle, onEdit, onRemove--> [McpDetail]
        │                                                          ├─ Toggle
        │                                                          ├─ 케밥 → Popover → MenuItem(편집·제거)
        │                                                          └─ 제거 확인 Modal → onRemove
        └─ mcpEditId → AddMcpServerModal(initial) → mcp.update → (rename 시 openDetail(새 id))
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 활성 상태 조작 | 텍스트 버튼 1개 | `Toggle` | D-302 | `R-302` / VP-302 · `McpDetail.tsx` |
| 그 밖의 동작 | 없음 | 케밥 → `MenuItem` 편집·제거 | D-301·D-303·D-304 | `R-301`·`R-303` / VP-301·VP-303 |
| 제거 도달성 | `mcp.remove` 호출부 0 | 확인 모달 경유 1 | D-301 | `AR-301` / VP-301 · `ExtensionsCatalogView.tsx` |
| 편집 도달성 | `AddMcpServerModal` 소비자 0 | 1 | D-304 | `AR-301` / VP-304 |
| rename 후 선택 | 상세가 사라짐(스테일 id) | 새 id 를 따라감 | D-308 | `AR-302` / VP-304 |
| 메뉴 항목 컴포넌트 | 해당 없음 | 공용 `MenuItem` | D-306 | `R-305` / VP-305 |
| i18n | `enable`/`disable` | `toggleAria`·`edit`·`remove`·`removing`·`removeTitle`·`removeConfirmBody` | D-301·D-302 | `R-306` / VP-306 |
| IPC·store·훅 | 4단 존재 | **불변** | 새로 만들 것이 없다 | `AR-301` / VP-301 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `customize/McpDetail.tsx` | 헤더 액션 · 메뉴 · 제거 확인 모달 | `server`·`onToggle`·`onEdit`·`onRemove` → JSX | `ExtensionsCatalogView` |
| `customize/ExtensionsCatalogView.tsx` | 선택·편집 모달·배선 | store/hook → props | `pages/` |
| `shared/ui/MenuItem.tsx` | 메뉴 항목 표준 | props → button | `McpDetail` 외 |
| `hooks/useMcpServers.ts` | MCP CRUD (**불변**) | IPC → 상태 | `ExtensionsCatalogView` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| R-301 / VP-301 (**EP-301**) | 제거 도달성 | `McpDetail` + `ExtensionsCatalogView` | `mcpDetail.render.test.ts` + 실기 | 테스트 · 실기 | 3 지점: 확인 모달 닫힌 시작 · `onRemove` prop 배선 · 실기의 메뉴 항목. 앞 둘만 닫으면 항목이 없어도 통과한다 |
| R-302 / VP-302 (**EP-302**) | 활성 상태 소유 | 렌더 출력 | `mcpDetail.render.test.ts` | 테스트 | 3 지점: `role="switch"` 존재 · `aria-checked` 가 두 상태를 따름 · 옛 버튼 텍스트 0건 |
| R-303 / VP-303 (**EP-303**) | 케밥 트리거 | 렌더 출력 | `mcpDetail.render.test.ts` | 테스트 | 2 지점: `aria-haspopup="menu"` · `aria-expanded="false"` |
| AR-301·AR-302 / VP-304 (**EP-304**) | 편집 배선 | `ExtensionsCatalogView` | 소스 전수 + 실기 | 테스트 · 실기 | 4 지점: 소비자 1 · `id` 전달 · `auth` 미변경 시 키 미전달 · rename 시 선택 추적 |
| R-305 / VP-305 (**EP-305**) | 배치·컴포넌트 표준 | 소스 | 소스 전수 | 리뷰·테스트 | 2 지점: 헤더 순서(Toggle→케밥) · 공용 `MenuItem` 사용(로컬 사본 신설 0) |
| R-306 / VP-306 (**EP-306**) | 문구 패리티 | `ko`/`en` | `resources.test.ts` | 테스트 | 2 지점: 리프 키 일치 · 죽은 키 참조 0 |

- SSOT 공유 방법: 메뉴 항목의 시각 정책은 `shared/ui/MenuItem.tsx` 한 곳이다. 문구는 `ko.ts` 가 정본이고 `en.ts` 가 `typeof ko` 로 컴파일 강제된다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: **없음**.
- 선택적 필드 의미: `McpFormValues.auth` 는 `undefined` = 비밀 미변경, `''` = 비밀 제거다(`AddMcpServerModal.tsx:69` 주석). 배선은 `undefined` 일 때 **키 자체를 넣지 않는다** — 넣으면 `''` 이 "제거" 로 읽힌다.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `customize/McpDetail.tsx` | 헤더 액션 | 텍스트 버튼 → `Toggle` + 케밥. `Popover` + `MenuItem` 2개(편집·제거 danger) + 제거 확인 `Modal`. 로컬 상태 `menuOpen`·`confirmOpen`·`removing` | 렌더 출력(순수) |
| `customize/ExtensionsCatalogView.tsx` | 배선 | `onEdit`→`setMcpEditId` · `onRemove`→`mcp.remove` · `mcpEditId` 상태 · `AddMcpServerModal` 마운트 · rename 시 `openDetail` | 소스 전수 |
| `i18n/resources/ko.ts` · `en.ts` | 문구 | `toggleAria`·`edit`·`remove`·`removing`·`removeTitle`·`removeConfirmBody` 추가, `enable`·`disable` 삭제 | `resources.test.ts` |
| `customize/mcpDetail.render.test.ts` (신규) | 렌더 대조 | EP-301(부분)·302·303 | 순수 |

### 편집 배선의 형상

- 편집 대상은 **id 로 들고 목록에서 되찾는다**(`mcp.list.find`). 서버 객체를 복사해 두면 갱신 후 낡은 값이 남는다.
- `McpFormValues` → `UpdateMcpServerRequest` 매핑에서 `auth` 만 조건부 전개한다. 나머지 필드는 그대로 넘겨도 `store.buildSource` 가 `transport` 에 따라 골라 쓰므로 stdio 서버의 빈 `url` 은 무해하다.
- rename 후 `setSelection((s) => openDetail(s, values.name))` — `id` 가 이름이라 새 키가 곧 새 id 다(D-308).

### 테스트 가능성

- **DOM 이 없다.** `Popover`·`Modal` 이 `createPortal` 로 `document.body` 에 붙는데 vitest 환경이 `node` 다. 그래서 렌더 테스트는 `renderToStaticMarkup` 으로 **닫힌 상태**만 본다.
- JSX 미사용: include 가 `src/**/*.test.ts` 라 `createElement` 로 렌더한다.
- 기대 문구는 `ko` 카탈로그를 직접 import 해 쓴다 — 테스트에 문구를 다시 전사하지 않는다.

## 12. End-to-end 영향

```text
McpDetail(onRemove) → ExtensionsCatalogView → useMcpServers.remove → mcpApi.delete
  → main handlers/mcp.ts → McpStore.remove → deployExtensions() → refresh → 목록
```

- producer 기준: `McpStore` 가 서버 목록의 정본이고 `id` = 이름이다.
- consumer 파생 규칙: 상세는 `mcp.list` 에서 `id` 로 찾는다 — 제거·rename 이 곧 목록 변화로 나타난다.
- 정본 우회 가능성: 없음 — 상세가 서버 객체를 자기 상태로 복사하지 않는다.

### 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `ExtensionsCatalogView` skills 분기 | 무영향 — `SkillDetail` 을 건드리지 않는다 | AT-305 |
| `ExtensionsCatalogView` providers 분기 | 무영향 | — |
| `CustomMcpModal`(추가) | 무영향 — 추가 경로는 그대로다 | — |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 상세 진입 시 `McpDetail` 마운트, 메뉴·모달 닫힘.
- 취소: 확인 모달은 Esc·백드롭·취소로 닫힌다. 편집 모달은 `onClose` → `setMcpEditId(null)` 로 언마운트되어 폼이 리셋된다.
- 오류: `remove` 는 `try/finally` 로 `removing` 을 반드시 푼다 — 실패해도 버튼이 잠기지 않는다.
- 제거 후: `selectedMcp` 가 `undefined` 가 되어 상세가 언마운트되고 목록이 렌더된다. `selection.selectedId` 는 스테일로 남지만 어떤 서버와도 매칭되지 않는다(skills 제거와 같은 동작).
- **다중 저장소 쓰기**: 코드 축에는 없다(단일 store). 문서 축에 판정 사본 둘 — `plan.md` 와 `INDEX.md` 보드 행을 같은 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력 상한: 메뉴 항목 2개 · 모달 1개. 모두 열렸을 때만 마운트되고 닫히면 `null` 이다.
- 새 요청 수: 제거 1회 · 편집 1회 — 둘 다 사용자 행동당 1회이고 뒤이어 기존 `refresh()` 1회다(현행 add/update 와 같은 형태).
- 재렌더: `mcpEditId` 는 `ExtensionsCatalogView` 로컬 상태라 편집 모달 개폐가 그 서브트리에 한정된다.
- 캐시/최적화로 잃는 부수 효과: 없음.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 메뉴 항목은 공용 `MenuItem` 로 단일화 | 0121 · `shared/ui/MenuItem.tsx:5-9` | §11 · D-306 | 유지 — 세 번째 로컬 사본을 만들지 않는다 |
| 상세 패널이 큰 제목을 소유(중복 heading 제거) | `ExtensionsCatalogView.tsx` 헤더 주석 | §9 TO-BE | 유지 |
| renderer 4-layer · 시맨틱 토큰 · 인라인 style 은 동적 값만 | `app/src/renderer/AGENTS.md` | §11 | 유지 |
| UI 는 시각 검증으로 갈음(자동 시각 회귀 없음) | `app/src/renderer/AGENTS.md §테스트` | §7 AT-307 · §17 | 유지 — 메뉴 항목 축을 실기로 둔 근거 |
| 설계 커밋과 구현 커밋 분리 | `handoff-plan/SKILL.md` 마무리 | §19 | 유지 — D-305 는 순서만 바꿨다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| **케밥 메뉴 항목이 자동 검증되지 않는다** — 편집·제거가 사라져도 렌더 테스트는 green | vitest `node` 환경 + 포털의 구조적 한계다. AT-307 실기로 닫고 §7 주의사항·§10 EP-301 에 지점을 남겼다. jsdom 도입은 별도 결정이라 이번에 하지 않는다 |
| 죽어 있던 `AddMcpServerModal` 을 되살려 미검증 경로가 드러난다 | 편집은 기존 `mcpUpdate` 계약을 그대로 쓴다. `auth` 의 `undefined`/`''` 의미차를 §10 에 고정하고 조건부 전개로 구현한다 |
| rename 이 재키잉이라 선택이 스테일이 된다 | D-308 — 저장 후 새 id 로 선택을 옮긴다 |
| `McpDetail` 과 `SkillDetail` 의 메뉴 시각이 미세하게 다르다 | D-307 로 이번엔 두 사본을 유지한다(gap 10→8px · `text-ink`→`text-t8`). 후속에서 `SkillDetail` 을 표준으로 옮긴다 |

- 되돌리기 어려운 결정: 없음 — 표시 계층이고 저장 포맷·IPC 계약을 바꾸지 않는다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/skills/components/customize/McpDetail.tsx`
- `app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx`
- `app/src/renderer/src/features/skills/components/customize/mcpDetail.render.test.ts` (신규)
- `app/src/renderer/src/shared/i18n/resources/ko.ts`
- `app/src/renderer/src/shared/i18n/resources/en.ts`
- `docs/handoff/0217-mcp-detail-toggle-and-kebab/plan.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md`.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/renderer`.
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AT-307 — 케밥 메뉴에 편집·제거가 보이고, 제거가 목록에서 실제로 지우는지.
- 커밋: 설계 커밋과 구현 커밋을 분리한다.

## READY self-review

- [x] Decision Ledger 가 이번 턴 결정 8건을 보존한다.
- [x] Part I 만 읽어도 완료 상태가 이해된다.
- [x] 사용자 문장(오타 포함)을 재해석하지 않고 §2 에 원문으로 인용했다.
- [x] 물어야 할 제품 결정이 없다 — "그외 추가적인 메뉴" 의 항목은 기존 코드(죽은 편집 모달)가 답을 줬고 §8 에 관측을 남겼다.
- [x] Technical Design 에 AS-IS·TO-BE 가 같은 축으로 있고 Delta 8행이 전부 파일 또는 AC 로 이어진다.
- [x] 전수 수치를 이번 세션에 측정했다 — `AddMcpServerModal` 소비자 0 · `McpDetail` 소비자 1 · `mcpDetail.*` 참조 3 · 목록 행 케밥 0.
- [x] "삭제 메뉴가 없다" 의 범위를 UI 로 좁히고 IPC 4단 존재를 반례로 확인했다.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] 상속할 V 가 없어 Baseline V 를 만들었고 근거(`0159` plan 에 V registry 0건)를 적었다.
- [x] 모든 NEW node 에 같은 레벨 REQUIRED pair 가 있다.
- [x] 각 pair 가 경로·§10 전수 분모·직접 oracle 을 갖고, 적대 증거를 고른 pair 는 이유와 변이를 적었다.
- [x] **자동 검증되지 않는 축(메뉴 항목)을 침묵하지 않고 §7 주의사항·§10 EP-301·§17 에 명시**했다.
- [x] 음성 술어(AT-302)가 `aria-label` 에 걸리지 않도록 엘리먼트 텍스트를 보게 설계했다.
- [x] 선택적 필드(`auth`)의 `undefined`/`''` 의미를 §10 에 고정했다.
- [x] 게이트 명령이 `app/AGENTS.md` 현행 지침과 충돌하지 않는다.
- [x] 본문 완성 후 Decision ↔ AC 를 교차검증하고 결과를 §3 갱신 메모에 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> D-305 로 구현이 먼저 끝나 있으므로, 구현 턴은 작업 트리 산출을 이 문서의 Decision·AC·§10 에
> 대조해 필드를 채운다. 필드를 줄이지 않는다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: (구현 턴 기입)
- 이견 / 현실성 문제: (구현 턴 기입)
- ACTIVE Decision 과 충돌하는 설계 발견: (구현 턴 기입)

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| (구현 턴 기입) | | | | | |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| (구현 턴 기입) | | | | |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| (구현 턴 기입) | | |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| (구현 턴 기입) | | | |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| (구현 턴 기입) | |

## [구현자 기입] Review Signals — 사실만

- (구현 턴 기입)

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | `SkillDetail` 이 아직 로컬 `MenuRow` 를 쓴다 — 같은 화면의 두 메뉴가 미세하게 다르다 | D-307 · VP-305 | 공용 `MenuItem` 으로 이설 | NEXT_HANDOFF | open |
| D2 | 케밥 메뉴 항목이 자동 검증 밖이다(포털 + `node` 환경) | §17 · EP-301 | jsdom 도입 또는 메뉴 본문 분리 렌더 검토 | NEXT_HANDOFF | open |
