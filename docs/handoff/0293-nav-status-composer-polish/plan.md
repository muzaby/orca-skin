# Plan — 0293-nav-status-composer-polish

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0293-nav-status-composer-polish` |
| 작성자 | Claude Code |
| 일자 | 2026-11-02 |
| 매핑 | 기준 커밋 `origin/main@8e5cefa`(`git cat-file -t` = commit, 설계 시점 `HEAD`와 같음) · 브랜치 `claude/nav-session-items-ui-g26zhn` |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none`. 기존 동작은 `INHERITED` 회귀 노드로만 참조한다 — 출처는 `origin/main@8e5cefa`의 0249·0254·0285·0287·0291 plan |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Codex (기능 구현) |

---

# Part I — Product & UX Contract

## 1. Context / 목표

| 요구 | 지금 문제 | 완료 후 |
|---|---|---|
| A. 세션 행 진행/완료 표시 | 왼쪽 work/code 아이콘이 생성 중엔 노란 점 3개로 바뀌고 비열람 완료·응답 대기엔 굵은 파랑이 된다(`SessionRow.tsx:65-83`) | 왼쪽 아이콘은 늘 종류·기본 색이다. 오른쪽 끝 칸에 생성 중 회색 회전 원호, 비열람 완료·응답 대기 파란 공. hover·메뉴 열림이면 그 칸이 케밥이다 |
| B. 모델 팝업 순서 | 플러그인 연결로 생긴 런타임 모델 행이 settings 행 뒤에 붙어 Claude 행이 OpenCode 뒤에 보인다 | 팝업 그룹이 Claude → OpenCode → 그 밖 순서다 |
| C. OpenCode 권한 자동 수락 | 저장값이 없으면 끔이다(`protocol.ts:721`) | 저장값이 없으면 켬이다 |
| D. 프로젝트 랜딩 cwd 버튼 | 폴더 선택 대화상자를 바로 연다(`CwdPanel.tsx:56-64`) | 새 대화와 같은 프로젝트 팝업(검색·목록·추가)을 연다 |

- 성공을 한 문장으로: **행 왼쪽은 종류만, 오른쪽은 상태만 말하고, 모델 팝업·자동 수락·프로젝트 랜딩 cwd 버튼이 다른 화면과 같은 규칙을 따른다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 A | "nav의 세션 항목들에 대해 진행/완료 표시를 변경하겠다. asis: 항목 좌측의 work/code 아이콘을 파란색 표시하거나 dot 애니메이션으로 표현하고 있음 tobe: 항목 좌측의 work/code 아이콘의 상태/색상을 고정. 우측정렬로 파란색 공을 완료표시로, 수행 중을 스피너 표시로 변경. 스피너 아이콘은 opencode composer의 에이전트 팝업에서 렌더링 되는 것과 똑같이. 마우스 호버 시 우측정렬로 표시되던 아이콘를 케밥버튼으로 변경하고 케밥버튼의 기능으로 동작하도록 할 것." | `/handoff-plan` 인자 2026-11-02 |
| 명시 요구 B | "composer의 모델 팝업에서 claude, opencode 순서대로 정렬되도록 하라. 현재 플러그인으로 추가된 모델에 대해서는 정렬적용이 안되고 있음." | 같은 턴 |
| 명시 요구 C | "opencode 설정에서 '권한 자동 수락'을 기본 승인으로 설정." | 같은 턴 |
| 명시 요구 D | "nav->프로젝트->개별 프로젝트 항목 클릭시 랜딩페이지에서 표시되고 있는 composer에서 텍스트 입력 상단의 cwd 버튼이, 새 대화 랜딩페이지의 cwd버튼처럼 팝업으로 수행되지 않고 있다. 보완하도록." | 같은 턴 |
| 결정 ① | 스피너 색 = "팝업과 동일한 회색 (Recommended)" — 0254의 노란색 결정을 대체 | AskUserQuestion |
| 결정 ② | 적용 범위 = "nav + 프로젝트 목록 모두 (Recommended)" | AskUserQuestion |
| 결정 ③ | 프로젝트 팝업 선택 = "새 대화와 동일 — 초안만 변경 (Recommended)" | AskUserQuestion |
| 추론 | "완료표시" 파란 공은 응답 대기도 덮는다 — 0249 D-003 "응답 대기 표시는 비열람 완료 표시와 **같은 시각**" 승계 | 0249 plan §3 |
| 추론 | "플러그인으로 추가된 모델" = 플러그인 탭 '연결'로 생기는 배포 런타임 모델 행 | `harness-runtime.ts:121-123` · 0291 plan:31 |
| 추론 | "기본 승인" = 저장값이 없을 때의 값이다. 사용자가 저장한 끔은 유지한다 | §4 C 행 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 행 왼쪽 work/code 아이콘은 상태와 무관하게 종류 SVG·기본 색이다. 접근성 이름은 종류 label뿐이다 | "항목 좌측의 work/code 아이콘의 상태/색상을 고정" | 요구 A | ACTIVE | 0254 D-003의 "아이콘 자리" 부분 대체 |
| D-002 | 상태는 행 오른쪽 끝, 케밥과 같은 20px 칸에 그린다. 생성 중 = 회전 원호 스피너, 비열람 완료 = 파란 공 | "우측정렬로 파란색 공을 완료표시로, 수행 중을 스피너 표시로" | 요구 A | ACTIVE | — |
| D-003 | 응답 대기(도구 승인·질문·계획 승인, child 포함)도 같은 파란 공이다 | 0249 D-003 유지 — 이번 요구는 시각의 자리·형태만 바꾼다 | 0249·추론 | ACTIVE | — |
| D-004 | 스피너 = OpenCode 에이전트 팝업과 같은 출력: `Icon spinner` 12px · `animate-spin` · `motion-reduce:animate-none` · `text-ink3`. 두 자리가 한 원자 `ArcSpinner`를 쓴다 | "에이전트 팝업에서 렌더링 되는 것과 똑같이" + 결정① | 요구 A·결정① | ACTIVE | 0254 D-003(노란 점 3개·`text-warn`)·D-009 대체 |
| D-005 | hover·메뉴 열림 동안 상태 칸 자리를 케밥이 대신하고 기존 케밥 메뉴(고정/해제·이름 변경·삭제)가 열린다. 메뉴 항목이 없는 행은 hover에도 상태를 유지한다 | "마우스 호버 시 … 케밥버튼으로 변경하고 케밥버튼의 기능으로 동작". 메뉴 없는 행은 바꿀 케밥이 없다(`SessionRow.tsx:92`) | 요구 A·추론 | ACTIVE | — |
| D-006 | 적용 범위 = nav 4구획(최근·고정·고정 프로젝트 하위·draft) + 프로젝트 랜딩 '이 프로젝트의 대화' 목록 | 결정② · 0254 D-006 범위 승계 | 결정② | ACTIVE | — |
| D-007 | 상태 판정·우선순위·수명은 바꾸지 않는다 | 요구는 표시 형태다. 0254 D-001·D-002·D-004·D-005·D-007·D-008, 0249 D-002·D-004·D-005·D-006 유지 | 추론 | ACTIVE | — |
| D-008 | 이름 변경 중인 행도 오른쪽 끝에 같은 상태 칸을 그린다(케밥 없음) | 0254 EP-03 "세 분기가 같은 상태" 승계 | 추론 | ACTIVE | — |
| D-009 | 상태 칸 접근성 이름 = 생성 중 '답변 생성 중' · 비열람 완료 '답변 완료' · 응답 대기 '응답 대기'(en 대응) | 아이콘이 상태를 더 이상 말하지 않는다. 공은 같은 시각이라 이름이 둘을 가른다 | 추론 | ACTIVE | 0254 D-010 대체 |
| D-010 | 점 스피너 `DotsSpinner`와 `dot-wave` 토큰을 제거한다 | 소비처가 SessionRow 하나다(§8 F-09) | 추론 | ACTIVE | — |
| D-011 | 모델 팝업 그룹 순서 = Claude → OpenCode → 그 밖, 같은 하네스 안 입력 순서 유지, 플러그인 런타임 행 포함. 엔진&모델 카드와 같은 함수를 쓴다 | 요구 B · 0291 D-018 규칙 공유 | 요구 B | ACTIVE | — |
| D-012 | 정렬은 팝업 표시에만 적용한다 — agent store·`agent:list` 순서·기본 모델 선택은 그대로다 | 요구는 팝업 정렬이다. 기본 선택은 현재 하네스의 첫 행이고(`modelSelection.ts:22-39`) 새 대화는 늘 하네스가 정해져 있어(기본 Claude, `chatStore.ts:182-187`) 정렬해도 결과가 같다 — 목록 원본을 바꿀 이유가 없다 | 추론 | ACTIVE | — |
| D-013 | OpenCode '권한 자동 수락'의 기본값 = 켬. 응답은 `once`, 질문은 계속 묻고, 이미 뜬 카드는 그대로다 | 요구 C · 0285 D-011의 나머지 유지 | 요구 C | ACTIVE | 0285 D-011 "기본 off" 부분 대체 |
| D-014 | 저장된 명시 값(켬/끔)은 유지한다. 손상 값은 기본값(켬)이다. 일괄 마이그레이션은 하지 않는다 | 저장된 opencode 값의 renderer writer는 토글 하나다(`GeneralTab.tsx:316`, 0285 plan:247 "renderer 쓰기 0") — 저장된 끔은 사용자가 고른 값이다 | 추론 | ACTIVE | 0285 §10 "손상 → false" 대체 |
| D-015 | 프로젝트 랜딩 composer의 cwd 버튼 = 새 대화와 같은 프로젝트 팝업(검색·폴더 프로젝트 목록·프로젝트 추가) | 요구 D | 요구 D | ACTIVE | 0287 §6 비범위 "프로젝트 상세 랜딩의 기존 버튼" 해제 |
| D-016 | 팝업 선택·추가는 이번 초안의 작업 폴더·프로젝트만 바꾸고 페이지는 머문다. 첫 전송 대화는 고른 프로젝트(또는 추가 폴더) 소속이다 | 결정③ · 0287 D-007·D-009와 같은 규칙 | 결정③ | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-016(신규 handoff).
- 다른 handoff 결정 변경(사용자 요구): 0254 D-003 → D-001·D-002·D-004 · 0254 D-009(점만 정지) → D-004(원호 회전 정지) · 0254 D-010 → D-009 · 0285 D-011 "기본 off"·§10 "부재·손상 → false" → D-013·D-014 · 0287 §6 비범위 한 항목 → D-015.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0254 D-001·D-002·D-004·D-005·D-007·D-008 · 0249 D-002·D-003·D-004·D-005·D-006 · 0291 D-018 · 0287 D-005~D-009 · 0285 D-011의 `once`·질문 제외·이미 뜬 카드 유지.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001 ↔ AC1(왼쪽 class·이름) · D-002 ↔ AC2·AC3·AC4 · D-003 ↔ AC3(대기 = 같은 공) · D-004 ↔ AC2·AC9(같은 svg 속성·`text-ink3`) → 일치.
  - D-005 ↔ AC4·AC5 · D-006 ↔ AC1~AC4(5 사이트, 프로젝트 목록 포함) · D-007 ↔ AC7·AC11 · D-008 ↔ AC6 · D-009 ↔ AC1·AC2·AC3(이름) · D-010 ↔ AC8 → 일치.
  - D-011 ↔ AC12·AC13 · D-012 ↔ AC12(입력 배열 불변) · D-013 ↔ AC14~AC16 · D-014 ↔ AC14(저장된 false 유지·손상 true) · D-015 ↔ AC17 · D-016 ↔ AC18(`navigate` 0회)·AC19 → 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| A — 이미 충족하는가 | 아니다. 상태가 왼쪽 아이콘의 class·자식에 산다 | `SessionRow.tsx:63-83` |
| A — "똑같이"의 대상 | 에이전트 팝업 로딩 표시 = `Icon spinner` 12px + `animate-spin motion-reduce:animate-none`, 색은 `MenuTitle`의 `text-ink3` 상속 | `Controls.tsx:155-165` · `MenuItem.tsx:76` · 0287 D-004 "화살표 없는 회전 원호" |
| A — 더 작은 해법 | 두 자리에 같은 JSX를 복사하면 갈라진다. 원자 하나를 두 자리가 쓰면 "똑같이"가 구조로 보장된다 | renderer AGENTS "재사용 우선" |
| B — 원인 | `mergeAgentEnvironments`가 런타임 행을 settings 행 뒤에 붙인다. settings 행은 디렉터리 이름순이라 우연히 claude→opencode다 | `models.ts:112-118` · `settings.ts:200-235` |
| B — 이미 충족하는가 | 엔진&모델 카드만 정렬한다. 팝업은 입력 순서다 | `AgentEnvironmentView.tsx:119` · `ModelMenu.tsx:28-41` |
| B — 더 작은 해법 | 같은 함수를 팝업에 적용한다. 함수가 `features/engine`에 있어 chat이 import할 수 없으므로 `src/shared/harness.ts`로 옮긴다(복붙 금지) | renderer AGENTS 4-layer · `ChatTitleBar.tsx:2`가 이미 `shared/harness` import |
| B — producer/store 정렬 | 택하지 않는다 — 필요 없다. 기본 선택은 현재 하네스로 먼저 거르고, 그 하네스에 모델이 없을 때만 남은 다른 하네스 첫 행으로 넘어간다. 같은 하네스 안 순서는 정렬 전후 같아 결과가 같다(D-012) | `modelSelection.ts:22-39`·`:79-85` · `chatStore.ts:182-187`·`:249-257` · 팝업은 새 대화에서 전 그룹 표시 `Composer.tsx:432` |
| C — 기본값의 자리 | 소비자(`=== true`)를 fail-open으로 바꾸면 preferences 없는 adapter 테스트가 전부 자동 승인으로 뒤집히고 포트 의미가 바뀐다. 스키마가 opencode 값을 물질화하면 production은 늘 명시 boolean을 받고 포트는 fail-closed로 남는다 | `channel.ts:393-399` · `bootstrap.ts:216` |
| C — 기존 사용자 | 저장된 끔은 토글로만 생긴다 → 유지(D-014). 일괄 켬은 명시 선택을 지우는 one-way라 택하지 않는다 | `rg -n "opencode: \{" app/src/renderer/src --glob '!*.test.*'` 8행 중 설정 patch는 `GeneralTab.tsx:316` 1행 |
| D — 원인 | 프로젝트 랜딩은 `showLandingCwdPanel`만 켜고 `landingProjects`를 넘기지 않아 `CwdButton`이 렌더된다 | `ProjectLandingPage.tsx:111-119` · `CwdPanel.tsx:48-65` |
| D — 더 작은 해법 | 페이지가 프로젝트 목록을 넘기면 기존 `LandingProjectPicker`가 그대로 쓰인다 | `NewChatLandingPage.tsx:50-60` |
| D — 화면 불일치 | 다른 프로젝트를 골라 보낸 직후 `ChatTile`이 URL 프로젝트 이름을 받지만 화면 소비처가 없다 | `rg -n "projectName\|projectPath" app/src/renderer/src --glob '!*.test.*'` → 통과 props만, 렌더 0 |
| ACTIVE 결정 충돌 | 0254 D-003·D-009·D-010, 0285 D-011 일부, 0287 §6 한 항목은 사용자 요구로 대체(§3 갱신 메모) | §16 |

- 사용자에게 올릴 결정: 3건 질의 완료(결정①②③). 남은 것 없음.
- 코드 조사로 닫은 사실: §8 F-01~F-27.

## 5. 동작 / 사용자 흐름

### A. 세션 행 (nav 4구획 + 프로젝트 목록)

```text
[행]  [종류 아이콘 — 고정] [제목 …………] [상태 칸 20px]
  생성 중                → 상태 칸 = 회색 회전 원호(12px) — 열람 중 행 포함
  비열람 완료 · 응답 대기  → 상태 칸 = 파란 공
  그 밖                  → 상태 칸 없음
  hover · 메뉴 열림       → 상태 칸 자리에 케밥 → 클릭 = 기존 메뉴(고정/해제 · 이름 변경 · 삭제)
  메뉴 항목 없는 행        → hover에도 상태 칸 유지(케밥 없음)
  이름 변경 중            → [아이콘][입력][상태 칸] — 케밥 없음
```

### B. 모델 팝업

```text
agent:list 입력 [claude settings… · opencode settings… · 플러그인 런타임 행…]
  → 그룹 [claude 전부(입력 순) · opencode 전부(입력 순) · 그 밖(입력 순)]
```

### C. OpenCode 권한 자동 수락

```text
저장값 없음(새 설치·토글 안 함) → 켬 → permission.asked 에 카드 없이 once
저장된 끔 → 끔(카드) · 저장된 켬 → 켬 · 손상 값 → 켬
```

### D. 프로젝트 랜딩

```text
/projects/A 진입 → 초안 = A 폴더 · A 프로젝트
  → cwd 칩(라벨 = A 이름 ▾) → 팝업[검색 · 폴더 프로젝트 목록(A 체크) · 프로젝트 추가]
  → B 선택 → 초안 = B 폴더 · B 프로젝트, 페이지는 A에 머문다 → 첫 전송 대화는 B 소속 → /chat/<id>
  → 프로젝트 추가 → 폴더 선택 → 초안 = 그 폴더(등록 프로젝트면 그 프로젝트, 아니면 없음 — 0287 D-007)
  ↘ 대화상자 취소 → 변화 없음
```

### 상태와 전이 (A)

| 시작 상태/이벤트 | 시스템 동작 | 보이는 결과 |
|---|---|---|
| send(낙관 `BEGIN_TURN`)·턴 활동 이벤트 | 생성 중 집합에 S (0254 무변경) | S 상태 칸 = 회색 원호, 왼쪽 아이콘 그대로 |
| 생성 중 S에 `permission.requested`(3종·child) | 생성 중 집합에서 제외 · 비열람이면 주의 표시 | 비열람: 파란 공('응답 대기') / 열람: 상태 칸 없음 |
| `permission.resolved`, 턴 유지 | 생성 중 집합 재진입 | 원호 |
| `telemetry`·`turn.aborted`·`error`·`CANCEL_CHAT` | 종료 리셋 | 남은 주의 표시가 있으면 파란 공, 없으면 없음 |
| `turn.ended`(비열람) | `markCompleted` | 파란 공('답변 완료') |
| S를 연다 | 주의 표시 해제 | 상태 칸 없음 |
| 상태 칸 있는 행에 hover | CSS `group-hover/<scope>:hidden` · 케밥 `:grid` | 같은 자리에 케밥 |
| 케밥 클릭 | `menuOpen=true` | 메뉴 열림 · 상태 칸 없음 · 케밥 유지 |
| 메뉴 닫힘 | `menuOpen=false` | 상태 칸 복귀 |

### 파생 UX / 엣지케이스

- loading / empty / error: 새 상태 문구는 접근성 이름 3개뿐이다(D-009).
- keyboard / a11y: 케밥은 지금처럼 hover·메뉴 열림에서만 보인다(변경 없음). 상태 칸은 `role="img"` + 이름이다.
- theme: `text-ink3`·`bg-selected`는 white·dark 모두 정의돼 있다(§8 F-08).
- 감속 모션: 원호 회전이 멈춘다(`motion-reduce:animate-none`) — 에이전트 팝업과 같다.
- 긴 제목: 제목은 말줄임, 상태 칸과 케밥이 같은 20px 칸이라 hover 교체에 제목 폭이 바뀌지 않는다.
- B: 세션이 하네스에 묶이면 그 하네스 그룹만 보인다 — 순서 무관(기존 필터).
- D: cwd 없는 과거 프로젝트(0287 D-008)는 목록에 없다. 그 랜딩에서 등록 안 된 폴더를 추가하면 초안의 프로젝트가 비워진다 — 새 대화와 같다(D-016). 지금의 `CwdButton`은 프로젝트를 유지했다(§17).

## 6. 범위 / 비범위

- **범위**: SessionRow 표시 구조 · `ArcSpinner` 원자(에이전트 팝업과 공유) · `Dot` blue tone · i18n 3키 · `DotsSpinner`/`dot-wave` 제거 · 정렬 함수 위치 이동 + ModelMenu 적용 · 설정 스키마 기본값·물질화 + GeneralTab 기본 표시 · ProjectLandingPage `landingProjects` · 문서 12자리.
- **비범위**: 생성 중·주의 표시 판정과 수명(D-007) · agent store·`agent:list` 순서·기본 모델 선택(D-012) · 저장된 자동 수락 값 마이그레이션(D-014) · 케밥 키보드 접근(기존 동작) · 프로젝트 랜딩의 정보·대화 목록 전환(D-016) · `/` 자동완성·`+` 메뉴 순서.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `data-context="session-status"`·`data-state` 값 | 아니오 — renderer DOM 마커, 영속·IPC 없음 | 지금 확정 |
| `harnesses.opencode` 물질화 | 디스크 형태가 바뀐다 — 같은 키·같은 의미라 이전 버전도 읽는다 | 지금 확정(§17) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 5 렌더 사이트 × 상태 4종(생성 중·비열람 완료·응답 대기·없음) × 열람/비열람에서 왼쪽 `[data-context="session-agent-kind"]`는 종류 SVG 1개(work = Checklist, code = Terminal 2 path), class = `inline-flex shrink-0`, `data-state` 없음, `aria-label` = 종류 label | T-01·T-02·T-03(§11) — 한 렌더에 네 상태를 섞은 행들의 왼쪽 markup 동일성 | `sessionsStore` → `SessionRow` → 5 사이트 |
| R-02 | AT-02 / AC2 | 생성 중이면 오른쪽 `[data-context="session-status"][data-state="in-progress"]` 1개, `role="img"`·이름 '답변 생성 중', 안 svg 1개가 `ArcSpinner` 단독 렌더와 같은 속성(width·height 12, path d, class 토큰 {`text-ink3`,`animate-spin`,`motion-reduce:animate-none`}) — 열람 중 행 포함 | T-01·T-02 | `subscribeGeneratingSessions` → `generatingSessionIds` → 상태 칸 |
| R-02 | AT-02 / AC3 | 비열람 완료 = `unseen-complete`·'답변 완료', 응답 대기(3종·child) = `awaiting-response`·'응답 대기', 둘 다 `Dot` blue(`bg-selected`) 1개·svg 0개. 열람 중이거나 사유 없으면 상태 칸 0개 | T-01·T-02 | `unseenAttention` → 상태 칸 |
| R-03 | AT-03 / AC4 | 상태 칸은 nav 행에서 `group-hover/session:hidden`, 프로젝트 목록 행에서 `group-hover/catalog-row:hidden`을 갖고 다른 변형의 class는 없다. 케밥 노출 class는 지금 그대로. 메뉴 항목이 없는 행의 상태 칸은 `group-hover/` class가 없다 | T-01(nav 4·catalog 1·draft) | `SessionRow` 분기 → class |
| R-03 | AT-03 / AC5 | 케밥을 누르면 핸들러 있는 기존 메뉴 항목(고정/해제·이름 변경·삭제)이 열리고 열린 동안 상태 칸 0개·케밥 표시. 닫으면 같은 `data-state`로 복귀. 항목 동작은 불변. nav·catalog 각각 | T-03 | `KebabButton.onToggle` → `menuOpen` → 분기 |
| R-03 | AT-03 / AC6 | 이름 변경 중 행은 상태 칸 1개(같은 `data-state`, `group-hover/` class 없음)와 입력을 그리고 케밥 0개 | T-03 | 메뉴 '이름 변경' → `renaming` 분기 |
| SD-01 | ST-01 / AC7 | 비열람 S의 send → 승인 요청 → 해소 → telemetry → turn.ended에서 상태 칸 `data-state` 열 = `[in-progress, awaiting-response, in-progress, awaiting-response, unseen-complete]`, 열람 S 열 = `[in-progress, 없음, in-progress, 없음, 없음]`. 왼쪽 아이콘 markup은 전 구간 같다 | T-02 | chat 이벤트 → chat store → app 투영·주의 리스너 → 행 |
| AR-02 | IT-02 / AC8 | `DotsSpinner`·`dot-wave` 흔적 0(Q-EP07). 양성 짝: `ArcSpinner` production 소비 2자리(Q-EP05)와 AC2·AC9 렌더 단언 | gate 스윕 + T-01·T-05 | 빌드 산출 |
| AR-02 | IT-02 / AC9 | OpenCode 에이전트 팝업 로딩 중 `[data-agent-loading]` 안 svg가 `ArcSpinner` 단독 렌더와 같은 속성이다(AC2와 같은 기대값). 로딩이 아니면 0개(기존) | T-05 | `OpenCodeAgentControl` → `OpenCodeSelect` → `MenuTitle afterLabel` |
| AR-02 | IT-02 / AC10 | `sessions.status.generating`·`completed`·`awaitingResponse`가 ko·en에 비어 있지 않게 있고 `sessions.generating`은 없다. 리프 키 집합·플레이스홀더 파리티 green | T-06 `resources.test.ts` 기존 3케이스 + Q-EP08 | i18n 리소스 → `tr` |
| 회귀 | AT-0254·0249 / AC11 | 0249·0254·0255 주의 표시·생성 중 투영 케이스가 상태 칸 마커로 같은 결과다 | `useSessionCompletion.test.ts` 4 describe · `navIconState.test.ts` · `sessionsStore.completion.test.ts` · `chatStore.generating.test.ts` | 기존 경로 |
| R-04 | AT-04 / AC12 | 입력 `[claude settings, opencode settings, 그 밖 adapter(supported), claude 플러그인 런타임]`이면 그룹 제목 순서 = `[claude settings, claude 런타임, opencode settings, 그 밖]`, 항목 수 불변, 입력 배열 순서 불변. `sessionBackend='opencode'`면 opencode 그룹만 | T-08 | `agent:list` → `agentStore` → `ModelMenu` |
| AR-03 | IT-03 / AC13 | `orderAgentEnvironments` 정의는 `app/src/shared/harness.ts` 1곳, production 소비는 `ModelMenu.tsx`·`AgentEnvironmentView.tsx` 2곳, `features/engine/common/lib/agentOrder.ts` 없음. 순위 = `HARNESS_IDS` 순·모르는 adapter 뒤·같은 하네스 안정 정렬. 엔진 카드 순서 기존 테스트 green | T-07·T-08·T-09 + Q-EP09 | 두 화면 렌더 |
| MD-04 | UT-04 / AC14 | `SettingsStore`가 (a) 설정 없음 (b) claude만 (c) opencode `instructions`만 (d) 손상 `'true'`(문자열)을 읽으면 `harnesses.opencode.autoApprovePermissions === true`이고 디스크 raw에도 `true`가 쓰인다. 저장된 `false`·`true`는 그대로, 형제 필드 보존, 손상 patch 거부(기존) | T-10 | `SettingsStore.load` → `migrateRawSettings` → `SettingsSchema` |
| SD-02 | ST-02 / AC15 | 새 `SettingsStore`의 opencode preferences를 adapter getter로 주면 `permission.asked`(root·child)에 `requestApproval` 0회·`reply:'once'`. `autoApprovePermissions:false` patch 뒤 다음 요청은 `requestApproval` 1회. `question.asked`는 켬에서도 `requestApproval`(0285) | T-11·T-12 | `bootstrap.ts:216` getter → `opencode/module.ts:29` → `channel.ts:394` |
| R-05 | AT-05 / AC16 | 설정 > 일반 > OpenCode 토글은 로드 전과 opencode 저장값 없는 로드 뒤 켬(`aria-checked=true`), 누르면 `{harnesses:{opencode:{autoApprovePermissions:false}}}` patch 뒤 끔. 저장된 끔을 로드하면 끔. 저장 실패 시 이전 값 유지(기존) | T-13 | `settings:get` → `GeneralTab` → `Toggle` |
| R-06 | AT-06 / AC17 | `/projects/A` 랜딩 composer(claude·opencode)의 cwd 칩은 `[data-component="landing-project-picker"]` 1개(라벨 = A 이름, chevron)이고 `CwdButton`은 0개다. 누르면 검색·폴더 프로젝트 목록(A `aria-checked=true`)·'프로젝트 추가' 팝업이 열린다 | T-14 | `ProjectLandingPage` → `Composer` → `CwdPanel` → `LandingProjectPicker` |
| SD-03 | ST-03 / AC18 | 팝업에서 B를 고르면 초안 `cwd` = B 폴더·`pendingProjectId` = B, 팝업 닫힘, `navigate` 0회. 이어서 보내면 `chat:send` 요청 `projectId` = B, `cwd` = B 폴더 | T-14 | picker → `selectPendingProject` → `chatActions.send` → `chat:send` |
| R-06 | AT-06 / AC19 | '프로젝트 추가'에서 대화상자가 등록 안 된 폴더를 주면 초안 `cwd` = 그 폴더·`pendingProjectId` = null, 등록 프로젝트 폴더면 그 프로젝트, 취소(null)면 A 그대로. `/new` 팝업 기존 테스트 green | T-14·T-15 | `useLandingProjectPicker.add` → `fileApi.pickDirectory` |
| AR-06 | IT-06 / AC20 | 문서 12자리(Q-EP13)가 현재 동작을 적는다 — IPC_CONTRACT 자동 수락 기본 true · 행 상태 표시(rendering·state·overview) · 카탈로그의 `ArcSpinner`·`Dot` blue·SessionRow·ModelMenu 순서·AgentEnvironmentView 경로·LandingProjectPicker 범위. doc inventory `--check` green | gate | 문서 |
| 전체 | AC21 | 게이트: lint 0 error · typecheck 3종 0 · 관련 vitest green · doc inventory `--check` · trailer 파싱 | 명령 산출(파일·케이스 수) | §7-A 운영 gate |
| R-07 | AT-07 / AC22 | 실기 — white·dark에서 nav·프로젝트 목록 행의 회색 원호(에이전트 팝업과 나란히)·파란 공·hover 케밥 교체(제목 흔들림 없음) · Windows 애니메이션 효과 끔에서 원호 정지 · 플러그인 연결 런타임 행이 있는 배포에서 모델 팝업 Claude→OpenCode · 새 프로필 OpenCode 자동 수락 켬과 첫 권한 요청 자동 진행 · 프로젝트 랜딩 팝업 B 선택 → 전송 → B 소속 대화 | 사람 실기(§19) | Electron 실행 |

### AC 검증 주의사항

- 기존 테스트 재사용(실재 확인): `useSessionCompletion.test.ts`의 `icon()` 헬퍼(102-120행)와 describe 4개('0254 생성 중 스피너'·'0249 response attention across app features'·'0255 attention and generation while the login gate is shown'·'0249 ΔV3.1 — draft 승격 뒤 승인 주의 표시') 실재. `navSections.render.test.ts:257-301` `renderers` 5개 실재. `resources.test.ts:'ko↔en 리프 키 집합 일치'`·`'보간 플레이스홀더({{x}}) 일치'` 실재. `AgentEnvironmentView.render.test.ts:'orders engine cards Claude, OpenCode, then others'` 실재. `NewChatLandingPage.project-picker.test.ts:'carries the page catalog through the %s composer and sends selection with preserved draft and attachments'`(claude·opencode) 실재.
- 사람 실기 항목: 시각(색·회전·hover 교체)·OS 감속 설정·실제 폐쇄망 배포 행·실 OpenCode 권한 진행뿐이다. 판정·매핑·순서·기본값·배선은 전부 테스트로 내렸다.
- N회 기준: AC15의 `requestApproval` 횟수는 adapter fixture가 주입한 sink 하나를 센다 — production 호출부 `channel.ts:396-399` 분기 1곳이고 fixture가 그 분기를 그대로 실행한다.
- 0건 기준(AC8): 제거 대상 = Q-EP07 출력 18행 전부. 허용 예외 없음. 양성 짝 = Q-EP05 `<ArcSpinner` 2행.

## 7-A. V / Trace Matrix

- V mode 판정: 신규 handoff라 상속할 V가 없다 → Baseline V. 바뀌지 않는 기존 동작은 `INHERITED` 회귀 노드로만 둔다.
- 기준 V 상속 근거: 없음. INHERITED 출처 = `origin/main@8e5cefa`의 각 plan 파일.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음(이 V 안에 SUPERSEDED node 없음).
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 왼쪽 아이콘 고정(AC1) | NEW | — |
| R-02 | R | §7 오른쪽 상태 칸(AC2·AC3·AC10) | NEW | — |
| R-03 | R | §7 hover·메뉴 케밥 교체(AC4·AC5·AC6) | NEW | — |
| R-04 | R | §7 모델 팝업 순서(AC12) | NEW | — |
| R-05 | R | §7 자동 수락 기본 켬 화면(AC16) | NEW | — |
| R-06 | R | §7 프로젝트 랜딩 팝업(AC17·AC19) | NEW | — |
| R-07 | R | §7 실기(AC22) | NEW | — |
| AT-01~AT-07 | AT | §7 검증 수단 칸 | NEW | — |
| SD-01 / ST-01 | SD/ST | §5 A 상태와 전이 → 상태 칸 열(AC7) | NEW | — |
| SD-02 / ST-02 | SD/ST | §5 C 저장소 → getter → 권한 응답(AC15) | NEW | — |
| SD-03 / ST-03 | SD/ST | §5 D 초안 → 전송 대상(AC18) | NEW | — |
| AR-01 / IT-01 | AR/IT | §9 A SessionRow 3 분기 × 5 사이트 조립 | NEW | — |
| AR-02 / IT-02 | AR/IT | §9 A 원자 공유·제거·i18n(AC8·AC9·AC10) | NEW | — |
| AR-03 / IT-03 | AR/IT | §9 B 정렬 SSOT 두 소비(AC13) | NEW | — |
| AR-04 / IT-04 | AR/IT | §9 C 기본값 상수 → 스키마 → 화면(AC14·AC16) | NEW | — |
| AR-05 / IT-05 | AR/IT | §9 D 랜딩 조립 → CwdPanel(AC17) | NEW | — |
| AR-06 / IT-06 | AR/IT | §10 EP-13 문서(AC20) | NEW | — |
| MD-03 / UT-03 | MD/UT | §10 `orderAgentEnvironments` | NEW | 0291 MD-07 본문 이동 |
| MD-04 / UT-04 | MD/UT | §10 스키마 기본값·물질화 | NEW | — |
| MD-05 / UT-05 | MD/UT | §10 `ArcSpinner` 출력 | NEW | — |
| R-0254 / AT-0254 | R/AT | 0254 생성 중 투영·판정 | INHERITED | 0254 plan §7 AC1·AC4·AC5·AC6·AC8·AC11·AC12 — 표시 단언만 마커 이동 |
| R-0249 / AT-0249 | R/AT | 0249 주의 표시 수명 | INHERITED | 0249 plan §3 D-002~D-006 |
| MD-0254 / UT-0254 | MD/UT | 0254 `navIconState` 우선순위 | INHERITED | 0254 plan §10 EP-03 · `navIconState.test.ts` |
| R-0291 / AT-0291 | R/AT | 0291 엔진 카드 순서 | INHERITED | 0291 plan §7 AC21 · D-018 |
| R-0287 / AT-0287 | R/AT | 0287 `/new` 프로젝트 팝업·에이전트 로딩 표시 | INHERITED | 0287 plan §3 D-004~D-009 |
| R-0285 / AT-0285 | R/AT | 0285 자동 수락 의미(once·질문 제외·요청마다 읽기) | INHERITED | 0285 plan §7 AC11 |

### Pair registry

`§10 강제 지점 전수`의 N은 §10에 고정한 자리 목록의 수다. 검색 명령 Q-EPnn은 §10 아래 코드 블록에 있다. 테스트 T-nn은 §11에 있다.

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `sessionsStore` → `SessionRow` `modeIcon` → 분기 3 → 5 사이트 | 정의·nav·catalog → T-01 `'0293 %s keeps the agent icon fixed and puts status in the right slot'`(네 상태 행) · 열람 → T-02 `'0293 projects optimistic send and delta activity to the arc spinner including viewed rows'` · rename → T-03 `'0293 rename keeps the status slot and drops the kebab'` | required — 부재 성질(상태 class 0). M-A1: unseen에 `text-selected` 복원 · M-A2: 생성 중 왼쪽에 `ArcSpinner` — `SessionRow.tsx` modeIcon 정의에 심는다 | EP-01 (4) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `navIconState` → 상태 칸 매핑 → `ArcSpinner`/`Dot` | 세 상태·없음 → T-01(한 렌더) · 열람·child → T-02 `'child $kind also suspends the spinner'`(마커 갱신) · 이름 → T-01 `aria-label` | required — 형제 맞바꿈. M-A3: 원호↔공 · M-A5: '답변 완료'↔'응답 대기' 이름 | EP-02 (3) · EP-03 (3) · EP-08 (10) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | CSS `group-hover/<scope>:hidden` ↔ 케밥 `:grid` · `menuOpen` · `hasMenu` | (a)(b) → T-01 nav 4·catalog 1 · (c) → T-03 `'0293 opening the kebab menu hides the status slot until it closes'`(nav·catalog) · (d) → T-01 draft 사이트(삭제 불가) | required — class는 구조 proxy. M-A6: 두 변형 class 맞바꿈 · M-A7: `menuOpen` 조건 제거 · M-A8: `hasMenu=false`에도 숨김 | EP-04 (4) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 입력 순서 → `ModelMenu` `visible` → `orderAgentEnvironments` → 그룹 렌더 | T-08 `'0293 orders provider groups Claude, OpenCode, then others with plugin runtime rows'` | required — M-B1: ModelMenu 정렬 호출 제거 · M-B3: 입력 배열 제자리 정렬 | EP-09 (3) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | `settings:get` → `GeneralTab` state → `Toggle` | 초기 → T-13 `generalTab.render.test.ts:'shows Claude and OpenCode groups after updates with defaults'`(SSR `aria-checked="true"`) · 로드·클릭 → `generalTab.interaction.test.ts:'saves only the chosen harness field'` · 저장된 끔·폴백 → 신규 `'0293 shows a saved off choice and falls back to the default without OpenCode preferences'` | required — M-C4: `useState(false)` · M-C5: `:96` `?? false` | EP-10 (5) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | `ProjectLandingPage` → `Composer` → `CwdPanel` → `LandingProjectPicker` | T-14 `'0293 project landing opens the project popup with the current project checked'`(claude·opencode) | required — M-D1: `landingProjects` 공급 제거 → `CwdButton` | EP-12 (7) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | Electron 실행 | §19 실기 결과 | not selected — 사람 실기 | 0 + 이유: 시각·실환경 |
| VP-08 | SD-01 ↔ ST-01 | REQUIRED | `ingestChatEvent`/`send` → chat store → `subscribeSessionAttention` → sessionsStore → 상태 칸 | T-02 `'observes the full non-viewed state sequence'`(마커 갱신·기대 열 불변) · 신규 `'0293 keeps the agent icon identical across the viewed state sequence'` | required — M-A9: `navIconState` 우선순위 뒤집기 | EP-02 (3) · EP-03 (3) |
| VP-09 | SD-02 ↔ ST-02 | REQUIRED | 새 `SettingsStore` → preferences getter → `OpenCodeAdapter` channel → `permission.asked` → reply | T-12 `adapter.test.ts:'0293 auto-approves with a fresh settings store and asks after an explicit off'` · T-11 `registry.preferences.test.ts:'0293 passes the default OpenCode auto-approve before any preference is saved'` | required — M-C1: `harnesses` `.default({})` 복원 · M-C2: `opencode` `.optional()` 복원 | EP-11 (5) |
| VP-10 | SD-03 ↔ ST-03 | REQUIRED | `/projects/A` 초안 → picker 선택/추가 → `selectPendingProject` → `chatActions.send` → `chat:send` | T-14 `'0293 selecting another project changes only the draft and the first send targets it'` · `'0293 adding a folder follows the new chat rule'` | required — M-D2: 선택 시 `navigate` 호출 · M-D3: 추가 결과 `projectId`를 A로 고정 | EP-12 (7) |
| VP-11 | AR-01 ↔ IT-01 | REQUIRED | 5 사이트 × 3 분기 조립 | nav·catalog·draft → T-01 · rename·메뉴 → T-03 | required — M-A10a: rename 분기 상태 칸 누락 · M-A10b: catalog `actions`에서 상태 칸 누락 | EP-01 (4) · EP-02 (3) · EP-04 (4) |
| VP-12 | AR-02 ↔ IT-02 | REQUIRED | `ArcSpinner` 2 소비 · `Dot` blue · 점 스피너 제거 · i18n | T-04 `arcSpinner.test.ts:'renders the agent popup arc spinner'` · T-05 `Controls.interaction.test.ts` 로딩 케이스(svg 속성 = `ArcSpinner`) · T-01 상태 칸 svg 속성 · T-06 `resources.test.ts` 3케이스 · gate Q-EP07 = 0 | required — 0건 스윕 + 공유 원자. M-A11: SessionRow 인라인 `Icon spinner size={14}` · M-A12: Controls 인라인 `Icon spinner` 다른 size · 스윕 감도: `DotsSpinner.tsx` 남김 → Q-EP07 1+ | EP-05 (3) · EP-06 (2) · EP-07 (18) · EP-08 (10) |
| VP-13 | AR-03 ↔ IT-03 | REQUIRED | `src/shared/harness.ts` 정의 → `ModelMenu`·`AgentEnvironmentView` | 팝업 → T-08 · 엔진 → T-09 `AgentEnvironmentView.render.test.ts:'orders engine cards Claude, OpenCode, then others'`(기존) · 정의 1곳 → gate Q-EP09 | not selected — 두 소비 자리 모두 행동 oracle이 정렬 제거에 red(M-B1·0291 VP-27) | EP-09 (3) |
| VP-14 | AR-04 ↔ IT-04 | REQUIRED | 상수 → 스키마 `.catch`·`.default` → store load → renderer state | 스키마·store → T-10 · 화면 → T-13 | required — M-C3: `.catch(false)` | EP-10 (5) · EP-11 (5) |
| VP-15 | AR-05 ↔ IT-05 | REQUIRED | 공급 2 → `Landing` 중계 → Composer 전달 2(inline·below) → CwdPanel 분기·picker 전달 | `NewChatLandingPage:53`·`Landing:27`·`Composer:256`·`:416`·`CwdPanel:48`·`:52` → T-15 `NewChatLandingPage.project-picker.test.ts:'carries the page catalog through the %s composer and sends selection with preserved draft and attachments'`(기존, claude = inline · opencode = below) · `ProjectLandingPage` 공급·`Composer:256`·`CwdPanel:48`·`:52` → T-14 · 플래그 → T-16 `CwdPanel.landing.test.ts:'새 대화의 Landing 중계와 프로젝트 랜딩에서만 플래그를 켠다'`(기존) | required — M-D1 공유 | EP-12 (7) |
| VP-16 | AR-06 ↔ IT-06 | REQUIRED | 문서 12자리 | gate Q-EP13 재실행 + 각 자리 문장 대조 · `check-doc-inventory --check` | not selected — 문서 gate | EP-13 (12) |
| VP-17 | MD-03 ↔ UT-03 | REQUIRED | 순수 | T-07 `harness.test.ts:'0293 orderAgentEnvironments ranks claude, opencode, then unknown adapters and keeps order within a harness'` | required — M-B2: rank를 adapter 문자열 정렬로 교체 → `legacy`가 `opencode` 앞(0291 VP-27 변이 승계) | EP-09 (3) |
| VP-18 | MD-04 ↔ UT-04 | REQUIRED | 순수(스키마) + store load | T-10 `settings-store.test.ts:'0293 turns OpenCode auto-approve on by default while keeping saved choices'` · 갱신 `'defaults absent or damaged harness preferences and rejects damaged patches'` | required — M-C1·M-C2·M-C3 공유 | EP-10 (5) · EP-11 (5) |
| VP-19 | MD-05 ↔ UT-05 | REQUIRED | 순수 | T-04 | not selected — 속성 직접 단언. 소비 쪽 맞바꿈은 VP-12 M-A11·M-A12 | EP-05 (3) |
| VP-20 | R-0254 ↔ AT-0254 | REGRESSION | 0254 투영 경로(무변경) → 상태 칸 | `useSessionCompletion.test.ts` describe '0254 생성 중 스피너' 전 케이스(마커 갱신·기대값 불변) · `chatStore.generating.test.ts` · `responseProgress.test.ts` | not selected — 기존 행동 테스트 | 0 + 이유: 판정·투영 코드 무변경(D-007) |
| VP-21 | R-0249 ↔ AT-0249 | REGRESSION | 0249 리스너 → `unseenAttention` → 상태 칸 | describe '0249 response attention across app features'·'0249 ΔV3.1'·'0255 …' · `sessionsStore.completion.test.ts` | not selected — 기존 행동 테스트 | 0 + 이유: 수명 코드 무변경 |
| VP-22 | MD-0254 ↔ UT-0254 | REGRESSION | 순수 | `navIconState.test.ts` 12조합(무변경) | not selected | 0 + 이유: 함수 무변경 |
| VP-23 | R-0291 ↔ AT-0291 | REGRESSION | 엔진 카드 | T-09(기존) | not selected — VP-13이 덮는다 | EP-09 (3) |
| VP-24 | R-0287 ↔ AT-0287 | REGRESSION | `/new` 팝업 · 에이전트 로딩 표시 위치 | T-15 전 케이스 · `Controls.interaction.test.ts` 로딩 위치 단언(heading 두 번째 자식) | not selected | EP-05 (3) · EP-12 (7) |
| VP-25 | R-0285 ↔ AT-0285 | REGRESSION | preferences 직접 주입 → channel | `adapter.test.ts:'reads the auto-accept preference per request including child sessions'`·`'handles only the exact native settled permission: $id/$tag/auto=$auto'`(무변경) | not selected | 0 + 이유: `channel.ts:394` 무변경, 기본값은 스키마가 정한다 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/**` 수정(boundaries·`no-cycle` 포함) | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error만 blocking |
| 관련 vitest(비-DB) | 수정 모듈 — 대상 스위트는 DB를 로드하지 않는다(§8 전수) | §19 명령 | 같음 |
| 스윕 | AC8·AC13·AC20의 0건/1곳 주장 | Q-EP05·Q-EP07·Q-EP09·Q-EP13 | 같음 |
| doc inventory | `docs/arch/**`·`IPC_CONTRACT.md`·`docs/handoff/**` 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus | 설계·구현·검증 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| F-01 | 행 상태는 왼쪽 아이콘 하나에 산다 — `data-state`, 생성 중 `text-warn` + `DotsSpinner`, 비열람 `text-selected` + 굵은 stroke | `SessionRow.tsx:63-83` |
| F-02 | 왼쪽 아이콘은 정의 1곳·소비 3분기(rename·catalog·nav) | `SessionRow.tsx:65`·`:122`·`:210`·`:234` |
| F-03 | 케밥은 `hidden` + `group-hover/<scope>:grid`, 열리면 `grid`. scope는 변형마다 literal | `KebabButton.tsx:28-30` · `SessionRow.tsx:144-146` |
| F-04 | 메뉴 없는 행 = 이름 변경 불가 + 삭제·고정 핸들러 없음 — 삭제 불가 draft | `SessionRow.tsx:92` · `SessionList.tsx:62-71` |
| F-05 | 에이전트 팝업 로딩 = `<span data-agent-loading aria-hidden>` 안 `Icon spinner size 12` + `animate-spin motion-reduce:animate-none`, 색은 `MenuTitle` `text-ink3` 상속 | `Controls.tsx:155-165` · `MenuItem.tsx:76` |
| F-06 | `Icon` spinner = 화살표 없는 3/4 원호 path, svg `fill=currentColor`, `aria-hidden` 없음 | `Icon.tsx:75-76` · `:218-228` |
| F-07 | `Dot` = 7px + ring-2, tone `green`·`amber`·`red`·`slate`(파랑 없음). 카탈로그 "연결 상태 공" | `Status.tsx:1-16` · `design-components.md:86` |
| F-08 | `--color-ink3`·`--color-selected`는 white·dark 모두 정의 | `tokens.css:103`·`:315` · `:125`·`:328` |
| F-09 | `DotsSpinner` production 소비 = SessionRow 1. `dot-wave` 토큰 소비 = DotsSpinner 1 | Q-EP07 출력 |
| F-10 | `agent:list` = settings 행(adapter·provider 디렉터리 이름순) + runtime 행(key 순)을 Map으로 합쳐 새 key를 끝에 붙인다 | `misc.ts:43-49` · `settings.ts:200-235` · `models.ts:112-118` · `runtime-catalog.ts:149-150` |
| F-11 | runtime 행 = 플러그인 탭 연결 성공 시 배포 선언이 카탈로그에 투영하는 행(기본 배포는 빈 배열) | `harness-runtime.ts:121-123` · 0291 plan:31·:70 |
| F-12 | ModelMenu는 입력 순서로 그룹을 그린다. 엔진 카드만 `orderAgentEnvironments` | `ModelMenu.tsx:28-41` · `AgentEnvironmentView.tsx:9`·`:119` · `agentOrder.ts:6-17` |
| F-13 | 기본 모델 선택 = 입력 순서 첫 supported 행(backend 필터 먼저) | `modelSelection.ts:22-39`·`:79-85` |
| F-14 | feature 교차 import 금지. renderer는 이미 `src/shared/harness`를 import한다 | renderer AGENTS 4-layer · `ChatTitleBar.tsx:2` · `agentOrder.ts:1` |
| F-15 | `shared/harness.ts`는 `./ipc`에서 type만 가져오고 `ipc.ts`는 harness·protocol을 import하지 않는다 → 순환 없음 | `harness.ts:1-2` · `ipc.ts:5-13` |
| F-16 | 자동 수락 스키마 `.catch(false).default(false)`, opencode `.optional()`, `harnesses` `.default({})` — zod 4 `.default`는 내부 parse 없이 출력값을 돌려준다 | `protocol.ts:713-722`·`:741` · 같은 파일 `:699-701` 주석 |
| F-17 | 소비자는 `preferences?.()?.autoApprovePermissions === true` — 미정이면 카드 | `channel.ts:393-399` |
| F-18 | production getter = `settings.getAll().harnesses?.[harnessId]` → OpenCode 모듈 | `bootstrap.ts:216` · `opencode/module.ts:29` |
| F-19 | renderer 기본 끔 3자리: 초기 state·로드·저장 뒤 `?? false`. writer는 토글 1자리 | `GeneralTab.tsx:83`·`:96`·`:128`·`:316` |
| F-20 | `load()`는 parse 결과를 디스크 raw에 쓴다(최초 접근 1회) | `settings-store.ts:49-55` |
| F-21 | `Settings` TS 타입은 손으로 쓴 interface(`harnesses?`·`opencode?`) — 스키마 출력이 넓어져도 대입 가능 | `ipc.ts:1122-1123` · `harness.ts:64-71` |
| F-22 | OpenCode `instructions` 선호값은 어댑터가 읽지 않는다 — `''` 물질화는 무해 | `rg -n "instructions" app/src/main/adapters/opencode app/src/main/app/harnesses app/src/main/features/harnesses --glob '!*.test.*'` → claude `extension-profile.ts:13` 1건 |
| F-23 | 프로젝트 랜딩은 `landingProjects` 없이 `showLandingCwdPanel`, 새 대화는 공급 | `ProjectLandingPage.tsx:111-119` · `NewChatLandingPage.tsx:50-60` · `Landing.tsx:27` |
| F-24 | CwdPanel은 `landingProjects`가 있으면 picker, 없으면 `CwdButton`(대화상자 → `setPendingCwd`, 프로젝트 유지) | `CwdPanel.tsx:48-65` · `CwdButton.tsx:44-64` · `chatStore.ts:1180-1187` |
| F-25 | picker 선택·추가 = `selectPendingProject({cwd, projectId})` — 초안 cwd·`pendingProjectId`만 | `useLandingProjectPicker.ts:26-59` · `chatStore.ts:1203-1222` |
| F-26 | 프로젝트 라우트는 진입 때만 `newChat(A, A.cwd)` — 같은 경로 재실행은 리셋하지 않는다. 전송 payload `projectId: cur.pendingProjectId` | `useChatRouteSync.ts:77-83` · `chatStore.ts:977` |
| F-27 | 0287 §6 비범위 "프로젝트 상세 랜딩의 기존 버튼" · 0285 §10 "부재·손상 → false(fail-closed)" | 0287 plan:97 · 0285 plan:325 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| SessionRow 렌더 사이트 | `rg -n "<SessionRow" app/src/renderer/src/features/sessions --glob '!*.test.*'` | 5 | ProjectSessionsPanel(catalog) · PinnedProjectsSection · SessionList 2(draft·recent) · PinnedSection — T-01 분모 |
| 왼쪽 아이콘 정의·소비 | Q-EP01 | 4 | 정의 1 + 분기 3 |
| spinner 아이콘 사용 | `rg -n 'name="spinner"' app/src/renderer/src --glob '!*.test.*'` | 1 | `Controls.tsx:159` |
| 점 스피너 흔적 | Q-EP07 | 18행/7파일 | 제거 대상 전부 |
| 정렬 함수 | Q-EP09 | 3행 | 정의 1 · import 1 · 호출 1 |
| 자동 수락 값 | `rg -n "autoApprovePermissions" app/src --glob '!*.test.*'` | 7 | protocol 2 · harness 1 · GeneralTab 3 · channel 1 |
| opencode 설정 writer | `rg -n "opencode: \{" app/src/renderer/src --glob '!*.test.*'` | 8행 중 1 | 설정 patch는 `GeneralTab.tsx:316`뿐(나머지 i18n·하네스 registry) |
| 랜딩 cwd 패널 운반 edge | Q-EP12 | 15행 | 운반 6(`NewChatLandingPage.tsx:53` · `Landing.tsx:27` · `Composer.tsx:256`·`:416` · `CwdPanel.tsx:48`·`:52`) + 비운반 9 — 프로젝트 랜딩 공급은 0(원인 D) |
| 대상 main 스위트의 DB 의존 | `grep -n "better-sqlite3\|infra/db" adapter.test.ts settings-store.test.ts registry.preferences.test.ts` | 0 | 비-DB — `vitest run` 직접 실행 |
| 문서 자리 | Q-EP13 | 12 | IPC_CONTRACT 1 · overview 1 · design-components 6 · state 3 · rendering 1 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 렌더 사이트 5 = SessionList 2 + PinnedSection 1 + PinnedProjectsSection 1 + ProjectSessionsPanel 1. 문서 12 = 1 + 1 + 6 + 3 + 1. Q-EP07 18 = design-components 1 + tokens.css 2 + navSections.render.test 1 + SessionRow 2 + dotsSpinner.test 8 + DotsSpinner 3 + useSessionCompletion.test 1.
- "유일한 writer" 반례 검색: 위 `opencode: \{` 8행 중 설정 patch 외 7행은 i18n·`catalog.ts`·registry 객체 리터럴이다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: §7 AC 검증 주의사항 첫 항목.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`~`SD-03`, `AR-01`~`AR-05`.
- 현재 책임 소유자: 상태 판정 = chat lib·sessions lib(0254) · 표시 = `SessionRow` 왼쪽 아이콘 · 정렬 = engine feature 전용 · 자동 수락 기본값 = 스키마 `false` + renderer `false` · 프로젝트 랜딩 cwd = `CwdButton`.
- 문제의 직접 원인: A 상태와 종류가 한 요소에 섞였다(F-01). B 정렬 함수가 한 화면에만 있다(F-12). C 기본값이 false이고 opencode 객체가 없으면 값이 아예 없다(F-16). D 페이지가 프로젝트 목록을 넘기지 않는다(F-23).

```text
A  sessionsStore{unseenAttention, generatingSessionIds}
     → SessionRow navIconState → modeIcon <span data-context="session-agent-kind" data-state=…
          class = in-progress ? text-warn : unseen ? text-selected+stroke : ''>
          in-progress ? <DotsSpinner 14|20/> : <Icon navIcon/>
     → rename [modeIcon][input] · catalog CatalogListRow(icon=modeIcon, actions=kebab) · nav [modeIcon][title][kebab]
   OpenCodeSelect MenuTitle afterLabel <span data-agent-loading><Icon spinner 12 animate-spin/></span>
B  agent:list [settings(이름순) + runtime(append)] → agentStore → ModelMenu(입력 순)
                                                              → AgentEnvironmentView(orderAgentEnvironments @ engine/lib)
C  SettingsStore.load → SettingsSchema(harnesses .default({}) · opencode optional · false)
     → getter → channel `=== true` → 저장값 없으면 카드 · GeneralTab useState(false) · ?? false
D  /projects/A → newChat(A) → <Composer showLandingCwdPanel/> → CwdPanel → CwdButton → pickDirectory → setPendingCwd
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`~`SD-03`, `AR-01`~`AR-06`.
- 변경 후 책임 소유자: 종류 = 왼쪽 아이콘(고정) · 상태 = 오른쪽 상태 칸 · 원호 = shared `ArcSpinner`(두 소비) · 공 = shared `Dot` blue · 정렬 = `src/shared/harness.ts`(두 소비) · 기본값 = `DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS`(스키마·화면) · 프로젝트 랜딩 cwd = `LandingProjectPicker`.
- 유지: 0254·0249 판정·투영·수명, `KebabButton`, agent store·`agent:list` 순서, `channel.ts` 소비자, picker·`selectPendingProject`.

```text
A  sessionsStore(무변경) → SessionRow navIconState(무변경)
     → modeIcon <span data-context="session-agent-kind" class="inline-flex shrink-0"><Icon navIcon/></span>
     → statusSlot: state ≠ default ∧ ¬(hasMenu ∧ menuOpen) 일 때만
          <span role=img aria-label=STATUS_LABEL[state] data-context="session-status" data-state=state
                class="grid h-5 w-5 shrink-0 place-items-center {hide}">
            in-progress ? <ArcSpinner/> : <Dot tone="blue"/>
          hide = hasMenu ? 'group-hover/session:hidden'(nav) | 'group-hover/catalog-row:hidden'(catalog) : ''
     → rename [modeIcon][input][statusSlot ml-auto, hide 없음]
       catalog CatalogListRow(icon=modeIcon, actions=[statusSlot][kebab][popover])
       nav [modeIcon][title][statusSlot][kebab][popover]
   OpenCodeSelect MenuTitle afterLabel <span data-agent-loading aria-hidden><ArcSpinner/></span>
B  (producer·store 무변경) → ModelMenu visible = orderAgentEnvironments(agents.filter(…)) ← src/shared/harness.ts
                          → AgentEnvironmentView orderAgentEnvironments(agents)       ← 같은 함수
C  SettingsSchema: harnesses .prefault({}) → opencode .prefault({}) → autoApprovePermissions .catch(D).default(D)
     → load 가 {instructions:'', autoApprovePermissions:true} 를 읽고 디스크에 쓴다(기존 load)
     → getter·channel 무변경 → once · GeneralTab useState(D) · ?? D        (D = DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS = true)
D  /projects/A → newChat(A) → <Composer showLandingCwdPanel landingProjects={{items, loading}}/>
     → CwdPanel → LandingProjectPicker → selectPendingProject (navigate 없음)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 왼쪽 아이콘 = 종류 + 상태 | 왼쪽 = 종류, 오른쪽 상태 칸 = 상태 | D-001·D-002 | AR-01 / VP-01·VP-11 · `SessionRow.tsx` |
| 책임/소유권 | 원호가 Controls 인라인, 점은 shared `DotsSpinner` | 원호 = shared `ArcSpinner` 두 소비, 점 삭제 | D-004·D-010 | AR-02 / VP-12 · `ArcSpinner.tsx`·`Controls.tsx` |
| 책임/소유권 | 정렬 = engine feature 전용 | 정렬 = `src/shared/harness.ts`, engine 파일 삭제(이동) | D-011 | AR-03 / VP-13·VP-17 |
| data/control flow | 팝업 = 입력 순 | 팝업 = 정렬 사본, 입력 불변 | D-011·D-012 | R-04 / VP-04 |
| state/contract | 설정에 opencode 없으면 값 없음(카드) | 스키마가 opencode를 물질화, 기본 true | D-013·D-014 | AR-04 / VP-09·VP-14·VP-18 |
| state/contract | 프로젝트 랜딩 cwd = 대화상자 직행 | 프로젝트 팝업 | D-015·D-016 | AR-05 / VP-06·VP-10·VP-15 |
| error/lifecycle | 메뉴 열림·hover와 상태가 다른 요소 | 메뉴 열림 = 상태 칸 미렌더, hover = CSS 교체 | D-005 | R-03 / VP-03 |
| test seam/관측점 | 왼쪽 아이콘 `data-state` | 상태 칸 `data-context="session-status"` `data-state` | 마커 이동 | VP-08·VP-20·VP-21 · `useSessionCompletion.test.ts` 헬퍼 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `renderer/src/shared/ui/ArcSpinner.tsx`(신규) | 회전 원호 출력 | 없음 → svg | `SessionRow`·OpenCode `Controls` |
| `renderer/src/shared/ui/Status.tsx` | 공 tone | `tone` → span | `SessionRow`·기존 3곳 |
| `renderer/src/features/sessions/components/SessionRow.tsx` | 행 조립 | 상태 → 왼쪽·상태 칸·케밥 | 5 사이트 |
| `app/src/shared/harness.ts` | 정렬·기본값 상수 | 행 배열 → 정렬 사본 / boolean | `ModelMenu`·`AgentEnvironmentView`·`protocol.ts`·`GeneralTab` |
| `app/src/shared/protocol.ts` | 설정 스키마 | raw → `Settings` | `SettingsStore`·renderer 테스트 |
| `renderer/src/pages/ProjectLandingPage.tsx` | 조립 | projects store → `Composer` props | 라우터 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-01·VP-11 | **EP-01** 왼쪽 아이콘은 상태 무관 — class `inline-flex shrink-0`, `data-state` 없음, 자식 = `Icon navIcon`, 이름 = 종류 | `SessionRow.tsx` modeIcon | SessionRow | 4자리: 정의(`:65`) · rename 소비(`:122`) · catalog 소비(`:210`) · nav 소비(`:234`) — 렌더마다 | Q-EP01 → 4 | 어느 분기·상태에서 종류 아이콘이 바뀐다 |
| AR-01 / VP-02·VP-08·VP-11 | **EP-02** 세 분기 모두 상태 칸을 그린다 | `SessionRow.tsx` statusSlot | SessionRow | 3자리: rename(입력 뒤 `ml-auto`) · catalog(`actions` 앞머리) · nav(제목 뒤, 케밥 앞) | Q-EP02 → 3(왼쪽 아이콘을 놓는 분기 = 상태 칸을 놓을 분기) | 한 분기에서 상태가 사라진다 |
| MD-0254 / VP-02·VP-08 | **EP-03** 상태 → 내용·이름: `in-progress` → `ArcSpinner`·'답변 생성 중' · `unseen-complete` → `Dot` blue·'답변 완료' · `awaiting-response` → `Dot` blue·'응답 대기' · `default` → 없음 | `SessionRow.tsx` `STATUS_LABEL`·분기 | SessionRow | 3자리(표시 상태 3, `NavIconState` 4값 중 `default` 제외) | Q-EP03 → 1(union 정의) | 다른 상태의 내용·이름 |
| R-03 / VP-03·VP-11 | **EP-04** hover·메뉴 교체 | `SessionRow.tsx` | SessionRow | 4자리: (a) nav 숨김 literal `group-hover/session:hidden` (b) catalog 숨김 literal `group-hover/catalog-row:hidden` (c) `menuOpen`이면 상태 칸 미렌더 (d) `hasMenu=false`면 숨김 class 없음. 케밥 노출 literal 2개(`:144-146`)는 유지 대상 | Q-EP04 → 현재 5행(`:58`·`:92`·`:139`·`:145`·`:149`). 구현 뒤 (a)(b) literal 각 1행과 상태 칸 조건의 `menuOpen`·`hasMenu`가 더해진다 | hover에 상태·케밥이 겹치거나 둘 다 사라진다 |
| AR-02 / VP-12·VP-19·VP-24 | **EP-05** 원호 한 원자 | `shared/ui/ArcSpinner.tsx` | 구현자 | 3자리: 정의 1 · 소비 `Controls.tsx` `OpenCodeSelect` afterLabel · 소비 `SessionRow.tsx` 상태 칸 | Q-EP05 → 현재 `name="spinner"` 1(`Controls.tsx:159`) → 목표 `name="spinner"` 1(`ArcSpinner.tsx`) · `<ArcSpinner` 2 | 두 스피너가 갈라진다 |
| AR-02 / VP-12 | **EP-06** 파란 공 | `shared/ui/Status.tsx` `DOT_TONE.blue = 'bg-selected ring-selected/20'` | 구현자 | 2자리: tone 정의 · SessionRow 소비 | Q-EP06 → 현재 2행(`Status.tsx:3` 정의·`:13` 사용), SessionRow 0 → 목표 `blue:` 1 · SessionRow `<Dot` 1 추가 | 공 색이 다른 토큰 |
| AR-02 / VP-12 | **EP-07** 점 스피너 흔적 0 | — | 구현자 | 18자리(Q-EP07 현재 출력 전 행): `DotsSpinner.tsx` 3 · `dotsSpinner.test.ts` 8 · `tokens.css:47-48` 2 · `SessionRow.tsx:4`·`:78` 2 · `navSections.render.test.ts:311` 1 · `useSessionCompletion.test.ts:154` 1 · `design-components.md:68` 1 | Q-EP07 → 18 → 목표 0 | 죽은 토큰·원자가 남는다 |
| AR-02 / VP-02·VP-12 | **EP-08** i18n | `resources/ko.ts`·`en.ts` | 구현자 | 10자리: 추가 ko 3 · en 3 · SessionRow 소비 1(`STATUS_LABEL`) / 제거 ko `:154` · en `:154` · `SessionRow.tsx:70` | Q-EP08 → 현재 3(제거 대상) → 목표 `sessions.generating` 0 · `generating: '` ko·en 각 1(새 `status` 묶음) · `sessions.status.` SessionRow 소비 | 파리티 red·이름 누락 |
| AR-03 / VP-04·VP-13·VP-17·VP-23 | **EP-09** 정렬 한 함수 | `app/src/shared/harness.ts` `orderAgentEnvironments` | 구현자 | 3자리: 정의 1 · `ModelMenu.tsx` `visible` · `AgentEnvironmentView.tsx:119` | Q-EP09 → 현재 3행(정의 `agentOrder.ts:6`·import·호출) → 목표 정의 `harness.ts` 1 + 호출 2 | 두 화면 순서가 갈라지거나 팝업만 미정렬 |
| AR-04 / VP-05·VP-14·VP-18 | **EP-10** 기본값 상수 | `app/src/shared/harness.ts` `DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS = true` | 구현자 | 5자리: `protocol.ts:721` `.catch` · `.default` · `GeneralTab.tsx:83` 초기 state · `:96` 로드 폴백 · `:128` 저장 폴백 | Q-EP10 → 현재 6행 = 자리 5(`:721`에 2) + 제외 2: `protocol.ts:806`(patch 스키마 — 기본값 없음) · `GeneralTab.tsx:316`(writer) | 화면·스키마 기본값이 갈라진다 |
| AR-04 / VP-09·VP-14·VP-18 | **EP-11** opencode 물질화 · 읽기 경로 | `protocol.ts` | 구현자 | 5자리: `opencode` `.optional()` → `.prefault({})`(`:720-722`) · `harnesses` `.default({})` → `.prefault({})`(`:741`) · 읽기(무변경, path 위) `bootstrap.ts:216` · `opencode/module.ts:29` · `channel.ts:394` | Q-EP11 → 6행 | 새 사용자가 카드를 본다 / 포트가 fail-open이 된다 |
| AR-05 / VP-06·VP-10·VP-15·VP-24 | **EP-12** 랜딩 composer는 프로젝트 목록을 받는다 | 페이지 조립 | 구현자 | 7자리: 공급 `NewChatLandingPage.tsx:53`(기존) · 공급 `ProjectLandingPage.tsx:111-119`(신규) · 중계 `Landing.tsx:27` · Composer 전달 `:256`(inline) · `:416`(OpenCode below) · CwdPanel 분기 `:48` · picker 전달 `:52` | Q-EP12 → 현재 15행 = 자리 6(신규 공급 제외) + 비운반 9: prop 선언 `Composer.tsx:68`·`:69`·`:118`·`:119` · 조건 `:255`·`:407` · `CwdPanel.tsx:18`·`:28` · `ProjectLandingPage.tsx:118`(플래그만) | 한 랜딩이 대화상자 버튼으로 남는다 |
| AR-06 / VP-16 | **EP-13** 문서 현재 상태 | 각 문서 | 구현자 | 12자리: `IPC_CONTRACT.md:665` · `overview.md:81` · `design-components.md:68`·`:86`·`:108`·`:116`·`:327`·`:357` · `state.md:67`·`:176`·`:186` · `rendering.md:71` | Q-EP13 → 12 | 문서 드리프트 |

```text
Q-EP01  rg -n 'data-context="session-agent-kind"|\{modeIcon\}|icon=\{modeIcon\}' app/src/renderer/src --glob '!*.test.*'
Q-EP02  rg -n '\{modeIcon\}|icon=\{modeIcon\}' app/src/renderer/src/features/sessions/components/SessionRow.tsx
Q-EP03  rg -n "export type NavIconState" app/src/renderer/src/features/sessions/lib/navIconState.ts
Q-EP04  rg -n "group-hover/(session|catalog-row):|const hasMenu|menuOpen" app/src/renderer/src/features/sessions/components/SessionRow.tsx
Q-EP05  rg -n 'name="spinner"|<ArcSpinner' app/src/renderer/src --glob '!*.test.*'
Q-EP06  rg -n "DOT_TONE|blue:|<Dot\b" app/src/renderer/src/shared/ui/Status.tsx app/src/renderer/src/features/sessions/components/SessionRow.tsx
Q-EP07  rg -n 'DotsSpinner|dot-wave|data-spinner="dots"' app/src docs/arch
Q-EP08  rg -n "sessions\.generating|sessions\.status\.|generating: '" app/src/renderer/src --glob '!*.test.*'
Q-EP09  rg -n "orderAgentEnvironments" app/src --glob '!*.test.*'
Q-EP10  rg -n "autoApprovePermissions|DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS|\[autoApprove, setAutoApprove\]" app/src/shared/protocol.ts app/src/renderer/src/features/settings/components/GeneralTab.tsx
Q-EP11  rg -n "HarnessSettingsSchema|opencode: HarnessPreferencesSchema|preferences: \(harnessId\)|options\.preferences\('opencode'\)|autoApprovePermissions === true" app/src --glob '!*.test.*'
Q-EP12  rg -n "showLandingCwdPanel|landingProjects" app/src/renderer/src --glob '!*.test.*'
Q-EP13  rg -n 'DotsSpinner|lib/agentOrder|굵은 파란 아이콘|행 상태 아이콘|아이콘으로 알린다|행 아이콘에서|행 아이콘 —|autoApprovePermissions`\(기본|/new`의 양 하네스|상태 점·rename|— `Dot` \||— `ModelMenu` \|' docs/arch docs/IPC_CONTRACT.md
```

- 자리 목록은 그 검색 출력과 차집합 0이어야 한다. Q-EP13은 구현 뒤 0이 아니라 **각 자리의 새 문장**으로 판정한다(검색 표지 문구가 사라지므로 목록 12자리를 줄 번호로 대조). verify가 시도해 테스트가 잡지 못한 고장은 목록 안팎 모두 다음 구현이 고친다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- 같은 규칙의 SSOT: 원호 = `ArcSpinner` 하나, 정렬 = `orderAgentEnvironments` 하나, 기본값 = 상수 하나. 소비처는 복사하지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 의미: `OpenCodePreferences.autoApprovePermissions?` — 포트 수준 `undefined` = 카드(fail-closed, 무변경). production은 스키마가 늘 boolean을 채운다. `unseenAttention.get()` `undefined` = 표시 없음(기존).
- 외부 SDK 경계: 해당 없음 — `permission.reply({reply:'once'})` 호출 형태 무변경(0285).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/shared/ui/ArcSpinner.tsx`(신규) | 원호 원자 | `export function ArcSpinner(): React.JSX.Element` → `<Icon name="spinner" size={12} className="text-ink3 animate-spin motion-reduce:animate-none" />`. props 없음 — 두 소비가 같은 출력을 갖게 한다 | T-04 |
| `.../shared/ui/Status.tsx` | 공 tone | `StatusTone`에 `'blue'`, `DOT_TONE.blue = 'bg-selected ring-selected/20'` | T-01 |
| `.../features/sessions/components/SessionRow.tsx` | 행 조립 | modeIcon 상태 분기 제거 · `STATUS_LABEL: Record<Exclude<NavIconState,'default'>, MessageKey>` · `statusSlot(hide: string)` · 세 분기 배치(§9 TO-BE) · `DotsSpinner` import 삭제. Tailwind 스캔을 위해 두 숨김 class는 소스 literal로 둔다 | T-01·T-02·T-03 |
| `.../features/chat/harnesses/opencode/composer/Controls.tsx` | 팝업 로딩 | `<span data-agent-loading aria-hidden="true">` 안을 `<ArcSpinner />`로 교체 | T-05 |
| `.../shared/ui/DotsSpinner.tsx`·`dotsSpinner.test.ts`(삭제) | — | 삭제 | Q-EP07 |
| `.../styles/tokens.css` | 토큰 | `--animate-dot-wave`·`@keyframes dot-wave` 삭제 | Q-EP07 |
| `.../shared/i18n/resources/ko.ts`·`en.ts` | 문구 | `sessions.status = { generating: '답변 생성 중' / 'Generating response', completed: '답변 완료' / 'Response complete', awaitingResponse: '응답 대기' / 'Awaiting your response' }` · `sessions.generating` 삭제 | `resources.test.ts` |
| `app/src/shared/harness.ts` | 정렬·기본값 | `orderAgentEnvironments` 이동(본문·제네릭 그대로, type import `AgentEnvironment` from `./ipc`) · `export const DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS = true` | T-07 |
| `.../features/engine/common/lib/agentOrder.ts`·`.test.ts`(삭제) | — | 삭제 — 케이스는 T-07로 이동 | Q-EP09 |
| `.../features/engine/common/components/AgentEnvironmentView.tsx` | 소비 | import 경로만 교체 | T-09 |
| `.../features/chat/components/composer/ModelMenu.tsx` | 소비 | `const visible = orderAgentEnvironments(agents.filter(…))` — 필터 결과 사본을 정렬, 입력 불변 | T-08 |
| `app/src/shared/protocol.ts` | 스키마 | `opencode: HarnessPreferencesSchema.extend({ autoApprovePermissions: z.boolean().catch(D).default(D) }).prefault({})` · `harnesses: HarnessSettingsSchema.prefault({})` · D import | T-10 |
| `.../features/settings/components/GeneralTab.tsx` | 화면 | `useState(D)` · `:96`·`:128` `?? D` | T-13 |
| `.../pages/ProjectLandingPage.tsx` | 조립 | `const projects = useProjectsState((s) => s.list)` · `<Composer … landingProjects={{ items: projects, loading: projectsLoading }} />` | T-14 |
| 문서 12자리(EP-13) | 현재 상태 | §10 EP-13 자리마다 TO-BE 문장. IPC_CONTRACT는 "OpenCode는 `autoApprovePermissions`(기본 true)" | gate |

### 신규·변경 테스트

| ID | 파일 | pair | 내용 — 진입점 · 구별 입력 · 관측 |
|---|---|---|---|
| T-01 | `features/sessions/components/navSections.render.test.ts` | VP-01·02·03·11·12 | '0254 %s uses a warning spinner…'·'only the non-viewed completed icon…' 대체. `it.each(renderers)('0293 %s keeps the agent icon fixed and puts status in the right slot')` — 시드 `generatingSessionIds={work}`·`unseenAttention={code:completed, wait:awaiting-response}`·행 `work(work)·code·wait·idle`. 관측: 왼쪽 path·class·`data-state` 없음 / 상태 칸 `data-state`·이름·`ArcSpinner` svg 속성(별도 SSR 기대값)·`span.bg-selected` / 변형별 숨김 class / draft 사이트는 숨김 class 없음. 열람 행(`isActive`) 1케이스 |
| T-02 | `app/hooks/useSessionCompletion.test.ts` | VP-01·02·08·20·21 | 헬퍼 `status(id, active)` = `[data-context="session-status"]` `data-state ?? 'default'`로 교체 — 기존 4 describe 기대값 그대로. '…to warning dots…' → '0293 projects optimistic send and delta activity to the arc spinner including viewed rows'(원호 속성·이름·왼쪽 불변). '$kind uses the same blue icon as completion' → '$kind uses the same blue ball as completion'(같은 공 class, 이름 다름). 신규 '0293 keeps the agent icon identical across the viewed state sequence' |
| T-03 | `features/sessions/components/SessionRow.interaction.test.ts`(신규) | VP-01·03·11 | `renderHarness.testfixture` fake DOM. '0293 opening the kebab menu hides the status slot until it closes'(nav·catalog, 핸들러 3 → 항목 3, 열림 동안 상태 칸 0, Escape/바깥 클릭 뒤 같은 `data-state`) · '0293 rename keeps the status slot and drops the kebab' · '0293 rows without menu items keep the status slot on hover'(삭제 불가 draft) |
| T-04 | `shared/ui/arcSpinner.test.ts`(신규) | VP-12·19 | 'renders the agent popup arc spinner' — SSR: width·height 12, path d = spinner path, class 토큰 집합 = {`text-ink3`,`animate-spin`,`motion-reduce:animate-none`} |
| T-05 | `features/chat/harnesses/opencode/composer/Controls.interaction.test.ts` | VP-12·24 | 기존 로딩 케이스에 `[data-agent-loading]` 안 svg width 12·path d·class 토큰 = T-04 기대값 단언 추가(위치 단언 유지) |
| T-06 | `shared/i18n/resources/resources.test.ts` | VP-12 | 기존 'ko↔en 리프 키 집합 일치'·'빈 문자열 값 없음'·'보간 플레이스홀더({{x}}) 일치' — 새 키 3개 추가·`sessions.generating` 삭제 뒤 green(테스트 무변경) |
| T-07 | `app/src/shared/harness.test.ts` | VP-17 | '0293 orderAgentEnvironments ranks claude, opencode, then unknown adapters and keeps order within a harness' — `agentOrder.test.ts` 입력·기대값 이동 + 입력 배열 불변 |
| T-08 | `features/chat/components/composer/modelMenu0215.render.test.ts` | VP-04·13 | '0293 orders provider groups Claude, OpenCode, then others with plugin runtime rows' — 입력 `[claude-anthropic(settings), opencode-local(settings), legacy-x(adapter 'legacy', supported), claude-plugin(runtime·readOnly)]`, 그룹 제목 텍스트 열 = `[claude-anthropic, claude-plugin, opencode-local, legacy-x]`, `menuitemradio` 수 = 모델 합, 렌더 뒤 `agents[1].key === 'opencode-local'`. `sessionBackend:'opencode'` → `[opencode-local]` |
| T-09 | `features/engine/common/components/AgentEnvironmentView.render.test.ts` | VP-13·23 | 기존 'orders engine cards Claude, OpenCode, then others' — import 이동 뒤 green |
| T-10 | `main/infra/settings-store.test.ts` | VP-14·18 | 신규 '0293 turns OpenCode auto-approve on by default while keeping saved choices' — backend (a) `{}` (b) `{harnesses:{claude:{outputStyle:'Learning'}}}` (c) `{harnesses:{opencode:{instructions:'keep'}}}` → `true`·raw `true`·형제 보존 / (d) `{…opencode:{autoApprovePermissions:false}}` → false / (e) `true` → true. 갱신 'defaults absent or damaged…' — 손상 `'true'` → `true` |
| T-11 | `main/app/harnesses/registry.preferences.test.ts` | VP-09 | 신규 '0293 passes the default OpenCode auto-approve before any preference is saved' — 새 store → `captured.opencode!()` `{autoApprovePermissions:true}` → false patch → false |
| T-12 | `main/adapters/opencode/v1/adapter.test.ts` | VP-09 | 신규 '0293 auto-approves with a fresh settings store and asks after an explicit off' — `electron-store` mock + `new SettingsStore('test', {store:{}})`, `fixture(undefined, () => store.getAll().harnesses?.opencode)` · root·child `permission.asked` → `/permission/<id>/reply` `once`·`requestApproval` 0 → false patch → 다음 요청 `requestApproval` 1 |
| T-13 | `features/settings/components/generalTab.render.test.ts`·`generalTab.interaction.test.ts` | VP-05·14 | render: `aria-checked="true"`. interaction 'saves only the chosen harness field': 초기 true → 클릭 → `{harnesses:{opencode:{autoApprovePermissions:false}}}` → false, 실패 시 false 유지. 신규 '0293 shows a saved off choice and falls back to the default without OpenCode preferences' — 로드 `autoApprovePermissions:false` → 끔 / 로드·저장 응답이 `harnesses:{}`(unparsed) → 켬 |
| T-14 | `pages/ProjectLandingPage.project-picker.test.ts`(신규) | VP-06·10·15 | `NewChatLandingPage.project-picker.test.ts` 하네스 재사용 · `useParams → {projectId:'p-a'}`·`useNavigate → spy` · 무거운 형제(`ProjectInfoHero`·`ProjectSessionsPanel`·`LandingHeader`) stub · projects `[A(p-a,'C:/A'), B(p-b,'D:/B')]` · `chatActions.newChat('p-a','C:/A')`. 케이스: 'opens the project popup with the current project checked'(claude·opencode) · 'selecting another project changes only the draft and the first send targets it'(B → cwd·pending·navigate 0·`chat:send` payload) · 'adding a folder follows the new chat rule'(`/selected` → null, `D:/B` → p-b, 취소 → A) |
| T-15 | `pages/NewChatLandingPage.project-picker.test.ts` | VP-15·24 | 기존 전 케이스 green(무변경) |
| T-16 | `features/chat/components/CwdPanel.landing.test.ts` | VP-15 | 기존 전 케이스 green(무변경) |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `orderAgentEnvironments`(`src/shared/harness.ts`) · 스키마(`protocol.ts`) · `navIconState.ts`(무변경). T-12는 `electron-store`만 mock(선례 `registry.preferences.test.ts:8`).
- 기존 메커니즘 재사용 형상/시점: `LandingProjectPicker`는 페이지가 넘긴 `items`를 `latest` ref로 읽어(`useLandingProjectPicker.ts:15-18`) 렌더마다 새 객체여도 같다 — 새 대화 페이지가 이미 같은 형태로 넘긴다.
- 순서를 관측할 경계: AC7은 이벤트 열 → `data-state` 열 비교. hover는 CSS라 class 존재로만 기계 판정하고 실제 교체는 AC22 실기다.

## 12. End-to-end 영향

### producer → consumer

```text
A  chat events → chat store → app 투영 → sessionsStore → SessionRow(왼쪽 고정 · 상태 칸)
B  main agent:list(무변경) → agentStore(무변경) → ModelMenu(정렬 사본) · AgentEnvironmentView(같은 함수)
C  settings 파일 → SettingsStore.load(스키마 물질화) → getter → OpenCode channel · settings:get → GeneralTab
D  projects store → ProjectLandingPage → Composer → CwdPanel → LandingProjectPicker → chat store 초안 → chat:send
```

- producer 기준: A 판정은 0254·0249 그대로다. C의 정본은 스키마가 채운 boolean이다.
- consumer 파생 규칙: A 표시는 `navIconState` 한 함수(무변경) + `STATUS_LABEL` 한 표. B 순서는 `orderAgentEnvironments` 한 함수.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 팝업은 정렬 사본만 그린다 — 선택 식별자(`providerKey`·`modelKey`)는 행에서 그대로 온다(`ModelMenu.tsx:56-69`).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `SettingsStore` 최초 load | `harnesses.opencode`가 생겨 디스크에 1회 쓰인다(기존 load 쓰기) | AC14 |
| `settings:get` renderer 소비(`GeneralTab`·`TweakProvider` 등) | `harnesses.opencode` 객체가 항상 있다 — 다른 키 무변경 | AC16 · 기존 `TweakProvider.store.test.ts` |
| OpenCode 서버 `preferences()`(`server.ts:147` executablePath) | `executablePath` 미지정 그대로(`undefined`) | 기존 OpenCode 서버 테스트 |
| `migrateRawSettings` `SETTINGS_KEYS` | 최상위 키 집합 불변(`harnesses` 이미 존재) | doc inventory `settings 키` 불변 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 상태 칸은 렌더 파생이다. 설정 물질화는 최초 load 1회 쓰기(기존)다.
- 취소/중단: 메뉴 닫힘 = `menuOpen=false` → 상태 칸 복귀. 대화상자 취소 = 초안 무변경(기존 picker).
- 종료/quit/restart: 상태·주의 표시는 휘발(0254·0249). 자동 수락 값은 디스크에 남는다.
- retry/timeout/partial failure: 토글 저장 실패 → 이전 값 유지(기존 `GeneralTab`).
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 코드 — 해당 없음(설정 파일 1곳). 산출 문서 — 상태 사본은 이 plan 메타 `상태`와 `INDEX.md` 0293 행(단계·상태·다음 주체)이다. 설계 커밋에서 두 곳을 `plan/READY`·다음 주체 Codex로 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력: 행마다 상태 칸 span 0~1개. 생성 중 집합 쓰기 빈도는 0254 D-008 그대로다.
- 새 계산: 팝업을 열 때 `O(n log n)`, n = provider 행 수(settings 디렉터리 + 배포 선언).
- 최적화로 잃는 부수 효과: 없음 — 정렬은 사본이고 store·선택 입력은 그대로다(D-012, AC12 입력 불변).

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port: 없음. `RUNTIME_MODEL_CONTRIBUTIONS` 행은 표시 순서만 바뀐다(Claude 런타임 행이 OpenCode 앞).
- 문서 계약: `IPC_CONTRACT.md:665` `settings.harnesses` 기본값 문장(EP-13). patch 의미("생략한 필드에 기본값을 주입하지 않는다")는 그대로다 — 기본값은 읽기 parse가 채운다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0254 D-003 노란 점 3개·아이콘 자리·`text-warn` | 0254 plan §3 | §3 D-001·D-002·D-004 | 변경(사용자 요구 A·결정①) |
| 0254 D-009 감속 모션에 점 정지 | 0254 plan §3 | §3 D-004 `motion-reduce:animate-none` | 변경(원호 회전 정지) |
| 0254 D-010 아이콘 이름 `{{agent}} · 답변 생성 중` | 0254 plan §3 | §3 D-009 | 변경(이름이 상태 칸으로) |
| 0254 D-001·D-002·D-004·D-005·D-007·D-008 판정·우선순위·투영 | 0254 plan §3 | §3 D-007 · VP-20 | 유지 |
| 0249 D-003 응답 대기 = 완료와 같은 시각 | 0249 plan §3 | §3 D-003 | 유지(공으로 같은 시각) |
| 0249 D-002·D-004·D-005·D-006 | 0249 plan §3 | §3 D-007 · VP-21 | 유지 |
| 0291 D-018 엔진 카드 Claude → OpenCode → 그 밖 | 0291 plan §3 | §3 D-011 · VP-13·VP-23 | 유지(함수 위치만 이동) |
| 0285 D-011 자동 수락 기본 off · §10 부재·손상 → false | 0285 plan:55·:325 | §3 D-013·D-014 | 변경(사용자 요구 C) — once·질문·이미 뜬 카드는 유지 |
| 0287 §6 비범위 "프로젝트 상세 랜딩의 기존 버튼" | 0287 plan:97 | §3 D-015 | 변경(사용자 요구 D) |
| 0287 D-004·D-007·D-009 | 0287 plan §3 | §3 D-004·D-016 | 유지 |
| 시맨틱 토큰·새 CSS 규칙 금지·두 테마 | renderer AGENTS §스타일 | §11 `text-ink3`·`bg-selected`(기존 토큰), `dot-wave` 삭제 | 유지 |
| 그룹 스코프 격리 `group/<이름>` | renderer AGENTS | §10 EP-04 literal | 유지 |
| feature 교차 import 금지 | renderer AGENTS 4-layer | §11 정렬 함수 `src/shared` 이동 | 유지 |
| 카탈로그 행 갱신(컴포넌트 신설·삭제) | renderer AGENTS 6 | §10 EP-13 `design-components.md` 6자리 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 자동 수락 기본 켬은 새 사용자의 OpenCode 권한 요청(편집·명령)을 묻지 않고 승인한다 | 사용자 요구(D-013). 설정에서 끄면 다음 요청부터 즉시 반영(요청마다 getter, 0285) |
| 토글을 켰다 끈 기존 사용자는 끔으로 남는다 | 명시 선택 유지(D-014). 저장된 끔의 유일한 출처가 토글이다(§4) |
| 다운그레이드 시 디스크의 `autoApprovePermissions:true`를 이전 버전도 켬으로 읽는다 | 같은 키·같은 의미라 호환된다 |
| 프로젝트 랜딩에서 등록 안 된 폴더를 추가하면 초안이 A에서 빠진다 — 지금 `CwdButton`은 A를 유지했다 | 결정③ "새 대화와 동일"(D-016). 첫 전송 때 새 폴더 프로젝트로 등록된다(0287 D-007) |
| 회색 원호(`ink3`)의 사이드바 위 시인성 | 사용자 지정(결정①). AC22 실기 |
| 0292(READY)와 `ModelMenu.tsx`·`ProjectLandingPage.tsx` 겹침 | 서로 다른 줄(0292는 `supported` 소비·OpenCode 가용성 게이트). 독립이며 착수 순서 무관 |

- 되돌리기 어려운 결정: `harnesses.opencode` 디스크 물질화(§6) — 하위 호환.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/ui/ArcSpinner.tsx`(신규) · `arcSpinner.test.ts`(신규) · `Status.tsx` · `DotsSpinner.tsx`·`dotsSpinner.test.ts`(삭제)
- `app/src/renderer/src/features/sessions/components/SessionRow.tsx` · `navSections.render.test.ts` · `SessionRow.interaction.test.ts`(신규)
- `app/src/renderer/src/app/hooks/useSessionCompletion.test.ts`
- `app/src/renderer/src/features/chat/harnesses/opencode/composer/Controls.tsx` · `Controls.interaction.test.ts`
- `app/src/renderer/src/styles/tokens.css` · `app/src/renderer/src/shared/i18n/resources/ko.ts`·`en.ts`
- `app/src/shared/harness.ts` · `harness.test.ts` · `app/src/shared/protocol.ts`
- `app/src/renderer/src/features/engine/common/lib/agentOrder.ts`·`.test.ts`(삭제) · `AgentEnvironmentView.tsx`
- `app/src/renderer/src/features/chat/components/composer/ModelMenu.tsx` · `modelMenu0215.render.test.ts`
- `app/src/renderer/src/features/settings/components/GeneralTab.tsx` · `generalTab.render.test.ts` · `generalTab.interaction.test.ts`
- `app/src/main/infra/settings-store.test.ts` · `app/src/main/app/harnesses/registry.preferences.test.ts` · `app/src/main/adapters/opencode/v1/adapter.test.ts`
- `app/src/renderer/src/pages/ProjectLandingPage.tsx` · `ProjectLandingPage.project-picker.test.ts`(신규)
- `docs/IPC_CONTRACT.md` · `docs/arch/frontend/{overview,design-components,state,rendering}.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`·`§Renderer 제작 시 필수 디자인 계약`.
- ABI/네트워크 등 환경 제약: 대상 스위트 DB 로드 0(§8) — `npm test` 불필요.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트(`cd app`):

```text
./node_modules/.bin/vitest run \
  src/renderer/src/features/sessions src/renderer/src/app/hooks/useSessionCompletion.test.ts \
  src/renderer/src/shared/ui src/renderer/src/shared/i18n \
  src/renderer/src/features/chat/harnesses/opencode/composer src/renderer/src/features/chat/components \
  src/renderer/src/features/engine src/renderer/src/features/settings src/renderer/src/pages \
  src/shared/harness.test.ts src/main/infra/settings-store.test.ts src/main/infra/settings-migration.test.ts \
  src/main/app/harnesses/registry.preferences.test.ts src/main/adapters/opencode/v1/adapter.test.ts
```

- 스윕: Q-EP05(`<ArcSpinner` 2) · Q-EP07(0) · Q-EP09(정의 `harness.ts` 1 + 호출 2) · Q-EP13(12자리 줄 대조).
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(AC22): ① white·dark nav·프로젝트 목록에서 생성 중 회색 원호를 OpenCode 에이전트 팝업 로딩 원호와 나란히 비교 ② 비열람 완료·승인 요청에서 파란 공, 행을 열면 사라짐 ③ 상태 있는 행 hover → 같은 자리 케밥, 제목 폭 불변, 메뉴 열고 닫기 ④ Windows 설정 > 접근성 > 시각 효과 > 애니메이션 효과 끔 → 원호 정지 ⑤ 플러그인 연결 런타임 행이 있는 로컬 임시 배포(커밋 금지)에서 새 대화 모델 팝업 Claude → OpenCode ⑥ 새 프로필(설정 파일 없음)에서 설정 > 일반 > OpenCode 자동 수락 켬, 첫 OpenCode 권한 요청 자동 진행 ⑦ 프로젝트 A 랜딩 cwd 칩 → 팝업 → B 선택 → 전송 → B 소속 대화.

## READY self-review

- [x] Decision Ledger가 요구 원문·결정①②③과 대체 관계를 보존한다 — D-004(결정①)·D-006(결정②)·D-016(결정③), 대체 5건은 §3 갱신 메모.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1 표·§5 흐름 4개.
- [x] 조건절을 재해석하지 않았다 — "기본 승인"은 저장값 없을 때(D-014 근거 = writer 1자리), "똑같이"는 같은 원자(D-004).
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design — §5 A↔AC1~AC7 ↔ §9 A, B↔AC12·13, C↔AC14~16, D↔AC17~19.
- [x] AS-IS와 TO-BE가 같은 축(A~D)이고 Delta 8행이 §11 파일에 이어진다.
- [x] 사라진 책임: 점 스피너·engine 정렬 파일 — 삭제/이동을 §9 Delta·§11에 명시.
- [x] 수치 실측 — 렌더 사이트 5 · Q-EP01 4 · Q-EP07 18 · Q-EP09 3 · 문서 12 · writer 1(§8).
- [x] 각 AC에 행동 단언·검증 수단·도달 경로가 있다(§7).
- [x] Baseline V, NEW node 전부 같은 레벨 REQUIRED pair(VP-01~VP-19), 영향받는 기존 동작은 REGRESSION(VP-20~VP-25).
- [x] pair마다 경로·§10 자리 수·자리별 oracle 좌표(T-nn + 테스트명), 적대 증거는 부재 성질·형제 맞바꿈·구조 proxy·0건 스윕·배선에만.
- [x] 운영 gate 열거 — 관련 없는 기존 실패는 blocking 아님.
- [x] 사람 실기로 미룬 순수 로직 없음 — 실기는 시각·OS 설정·실배포·실 OpenCode.
- [x] semantic 목표를 proxy만으로 보지 않는다 — hover class(proxy)에 메뉴 열림 행동 oracle(T-03)과 실기를 짝지었다.
- [x] "X가 쓰인다"(ArcSpinner 두 소비·정렬 두 소비·landingProjects 공급)의 장치가 X 제거에 red — M-A11·M-A12·M-B1·M-D1. 자리 불변식(nav/catalog class, 완료/대기 이름, 원호/공)은 맞바꿈 변이 M-A3·M-A5·M-A6.
- [x] 상호배타 상태는 `NavIconState` union 하나 — 불가능 조합 없음.
- [x] 신규 모듈마다 레이어·강제 지점·seam(§9 책임 표·§10·§11).
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙 — 표 위주, Part I은 관측, Part II는 경로·계약.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(최초 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K = 표 행 T`
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
