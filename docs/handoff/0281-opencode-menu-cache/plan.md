# OpenCode 컴포저 메뉴 캐시와 새로고침 제거

## 메타

| 항목 | 값 |
|---|---|
| 작성 | Codex / 2026-10-22 |
| 상태 | IMPL_DONE — ΔV1 r2, verify r1 D1–D5 재구현 자기확인 완료 |
| V | Delta V / V1@256ddd24 + ΔV1 |

# Part I — Product & UX Contract

## 1. 목표·출처

사용자: “opencode composer에서 제공하는 팝업메뉴들에서 새로고침 항목은 모두 제거하라. 한 번 로드한 내용은 캐싱하라.” 메뉴 재개방은 준비된 목록을 사용한다.

## 2. Decision Ledger

| ID | 결정 | 상태 |
|---|---|---|
| D1 | 컴포저 팝업의 새로고침 액션 제거 | ACTIVE — 0276의 수동 팝업 재조회 대체 |
| D2 | 성공 목록은 같은 작업폴더·실행 세대에서 재사용 | ACTIVE |
| D3 | 로딩·실패 안내와 스피너 없음 | SUPERSEDED → D5. 에이전트 제목 우측 회전 스피너만 예외 |
| D4 | 인스턴스 종료·경로 전환 때 이전 실행 목록을 현재 목록으로 사용하지 않음 | ACTIVE — 기존 수명 정책 유지 |
| D5 | agent 로딩 중 ‘에이전트’ 그룹 타이틀 우측에 회전 스피너. 나머지 팝업 안내·오류 문구는 없음 | ACTIVE — 2026-10-22 사용자 annotation |
| D6 | ‘기본 에이전트’ 선택 항목 제거 | ACTIVE — 같은 사용자 annotation. 기본 variant 제거 요구는 아님 |

## 3. 동작·상태

| 동작 | 관측 |
|---|---|
| 최초 표시 | agent/provider 독립 준비. agent loading이면 제목 우측 스피너, 완료된 실제 agent 행만 표시 |
| 메뉴 닫기·열기·선택 | 캐시 재사용, 수동 갱신 행 없음 |
| 실패 | 스피너 종료, 오류 안내 없음, 이미 성공한 값 보존 |
| directory/generation 전환 | 기존 격리·소유권 정리 유지 |

오른쪽 상태 패널과 nav MCP의 새로고침은 컴포저 팝업이 아니므로 유지한다. 전역 정책·MCP 관측의 나머지 합의는 0278·0277에서 이어서 구현한다.

## 4. AC

| AC | 관측 기준 | 직접 증거 |
|---|---|---|
| AC1 | agent/variant 팝업의 선택·키보드·초점 복귀 정상. 제목 스피너와 agent 행 구성은 AC4–6으로 정정 | Controls.interaction tests |
| AC2 | 같은 메뉴를 반복 개방해도 목록 재요청 없음 | Module.integration에서 실제 hook/state와 IPC spy |
| AC3 | 캐시의 독립 응답·경로/세대 격리·해제 유지 | composerCatalogState 및 main cache/context tests |

## 5. V trace

| Pair | 노드·상태 | 경로·oracle |
|---|---|---|
| VP1 | R1↔AT1 NEW REQUIRED | Controls 공개 컴포넌트→Popover→선택/닫기, loading/error/ready에서 행 내용·키 입력 관측(AC1) |
| VP2 | SD1↔ST1 NEW REQUIRED | 등록 Module→실제 useComposerCatalog→state→IPC; agent/provider 지연·재개방 반복의 응답·호출 관측(AC2) |
| VP3 | AR1↔IT1 NEW REQUIRED | module의 ModeControl/EffortControl→hook snapshot→Control props→메뉴 옵션(AC1·2); Module.integration |
| VP4 | MD1↔UT1 INHERITED REGRESSION | 0280 state/cache의 성공·실패·generation·scope·release, 기존 composerCatalogState/session-context 테스트(AC3) |

# Part II — Technical Design

## 8. 변경

Controls의 onRetry 입력·전달·메뉴 행을 제거한다. popup 내부 상태 변화와 조회 트리거를 연결하지 않는다. 성공값 재사용은 기존 ComposerCatalogState의 ready 슬롯과 directory cache가 담당한다.

## 9. 수명

캐시 영속 저장·다른 directory 재사용·인스턴스 강제 유지 없음. 상태 패널의 MCP/plugin retry 포트는 유지한다. 실패값은 성공한 빈 목록으로 저장하지 않는다.

## 10. 강제 지점

검색: `rg 'catalogRefresh|onRetry|useComposerCatalog' app/src/renderer/src/features/chat`.

| EP | 자리 목록 | N | 직접 oracle |
|---|---|---|---|
| EP1 | ModeControl→AgentControl, EffortControl→VariantControl, 공통 OpenCodeSelect | 3 | Module.integration의 실제 두 control + Controls.interaction의 두 팝업 행/선택 |
| EP2 | hook→ComposerCatalogState, ready slot→IPC read | 2 | Module.integration의 재개방 호출 수·표시 내용; state scope/generation tests |

5자리. 삭제 검증은 새로고침 음성 검색만으로 닫지 않고 실제 메뉴의 전체 선택 행·사용자 선택을 함께 단언한다. 구조적 proxy 없음, 선택 mutation 없음.

## 11. 게이트·정합성

관련 Vitest, typecheck, lint, build, 문서 링크/inventory, diff/trailer. D1→AC1, D2→AC2, D3→AC1, D4→AC3 대조. 기준 테스트 파일·등록 Module·현재 두 Controls 호출부를 읽어 READY로 확정했다.

## ΔV1 — 기본 에이전트 제거·제목 로딩 표시

사용자 원문: “‘기본 에이전트’ 항목 제거. ‘에이전트’ 그룹 분류 타이틀의 우측에서 회전 spinner를 로딩중일때 표시”. 기존 표시 금지를 이 위치에 한해 대체한다. popup 새로고침 제거와 성공 목록 캐시·provider 독립 응답은 유지한다.

### 동작·AC

| AC | 동작 기준 | 직접 oracle |
|---|---|---|
| AC4 | 모든 상태에서 합성 ‘기본 에이전트’ 행 없음. native /agent 목록의 실제 visible 이름만 표시 | Controls.interaction.test.ts: agents undefined/empty/nonempty, loading/ready/error 각각 전체 menuitemradio 값·텍스트 |
| AC5 | agents.status=loading인 동안 ‘에이전트’ 제목 오른쪽에 회전 indicator 1개. ready/error에서는 제거 | 같은 테스트: 제목 내부 좌우 DOM 구조·animation class·조건 전이. models loading만으로 agent spinner가 켜지면 실패 |
| AC6 | 항목 없는 loading/empty/error에도 제목은 유지. 선택을 자동 변경하지 않고 Escape/Tab으로 닫기·초점 복귀 가능 | 실제 control·store, agent 미지정→loading→ready 및 선택 후 재개방. 선택 클릭 전 harnessAgent 불변 |
| AC2·3 | 성공 캐시·동일 scope 재개방 요청 재사용·세대 격리·독립 응답 | Module.integration.test.ts의 실제 module/hook/state/IPC 경로, agent 먼저 성공·model 지연·A/B 결과 역전 |

미선택 의미는 native default 사용으로 유지하며, 제거하는 것은 가상의 메뉴 행이다. 선택되지 않은 컨트롤 버튼은 ‘에이전트’ 라벨을 사용하고 첫 반환 agent를 임의로 선택하지 않는다. 성공한 빈 목록에서 무효 선택을 정리하는 기존 동작은 유지한다.

캐시가 있고 실제 재조회가 진행 중인 경우 캐시 행을 유지하며 제목 indicator만 표시한다. 에이전트 실패를 무한 loading으로 남기지 않고 models/MCP/plugin 진행률과 섞지 않는다. 스피너는 액션·메뉴 항목·키보드 탐색 대상이 아니며 reduced motion에서는 회전을 멈추고 busy 의미는 유지한다.

### AS-IS → TO-BE

| 경계 | AS-IS@256ddd24 | TO-BE |
|---|---|---|
| OpenCodeModeControl | agents.status를 넘기지만 AgentControl은 사용하지 않음 | 현재 agent slot status를 title busy까지 전달 |
| OpenCodeAgentControl | options 앞에 value=''의 defaultAgent 합성 | 합성 행 제거, 미선택 버튼 label과 실제 agent 선택 분리 |
| OpenCodeSelect | MenuTitle label만 렌더, trigger fallback이 options에 의존 | 선택 라벨/미선택 라벨을 분리하고 선택적 title busy 전달 |
| MenuTitle | leading만 지원 | 선택적 trailing 슬롯, 기존 제목·leading 동작 유지 |
| state/cache | agent/models 독립 status·ready cache | 변경 없음. spinner를 위해 timer·추가 IPC·재조회 만들지 않음 |

shared MenuTitle의 trailing은 표시 슬롯만 소유하고 OpenCode 도메인 상태를 import하지 않는다. 회전 표시는 기존 Icon/모션 유틸을 사용하며 새 의존성·raw 색·독립 타이머를 추가하지 않는다. 제목과 indicator의 배치는 기존 메뉴 인셋·시맨틱 토큰을 따르고, busy 접근성 의미는 제목/그룹에 제공하며 visible 안내 문구는 만들지 않는다.

### V trace

| Pair | 노드·상태 / requiredness | production path·직접 oracle |
|---|---|---|
| DV1-P1 | R2↔AT2 NEW REQUIRED | AC4–6. Module→control→Popover→MenuTitle/선택행→store·초점 |
| DV1-P2 | SD2↔ST2 NEW REQUIRED | loading→agent ready/model pending→error/close→reopen. Module.integration.test.ts의 서로 다른 slot 결과·IPC 횟수·DOM |
| DV1-P3 | AR2↔IT2 NEW REQUIRED | snapshot.agents.status→ModeControl→AgentControl→Select→MenuTitle trailing. Controls.interaction.test.ts와 실제 Module 배선 |
| V1 VP1·3 | INHERITED REGRESSION | 선택·초점·variant 유지. ‘기본 agent 행 있음’과 ‘어느 제목에도 spinner 없음’ 단언만 AC4·5로 대체 |
| V1 VP2·4 | INHERITED REGRESSION | 준비·캐시·scope/generation/해제 불변. 기존 state/context 테스트 |

V1 AC1의 ‘선택 항목만’ 표현 중 header spinner 금지와 기본 agent 보존은 SUPERSEDED다. 해당 UI oracle은 AC4–6/DV1-P1–P3으로 이관하며 새로고침 금지·정상 선택·캐시·provider 독립이라는 기존 증거 하한은 유지한다. 선택 변이는 별도로 추가하지 않고 실제 상태별 DOM·입력·IPC 결과를 직접 단언한다.

### §10 ΔV1 강제 지점 — 6자리

기준 디렉터리는 `app/src/renderer/src/features/chat/harnesses/opencode/composer/`다. 검색: `rg -n 'snapshot.agents|OpenCodeAgentControl|OpenCodeSelect|MenuTitle|defaultAgent|options.find' app/src/renderer/src/features/chat/harnesses/opencode/composer app/src/renderer/src/shared/ui/MenuItem.tsx`. 테스트 선언을 제외한 현재 운반 경계를 다음과 같이 고정한다.

| 자리 | 계약값 | 예정 oracle 좌표·구별 입력 |
|---|---|---|
| Controls.tsx:OpenCodeModeControl→AgentControl | agent slot.status와 목록 | Module.integration: agents loading/models ready와 반대 조합, 제목 indicator 결과 |
| Controls.tsx:AgentControl→Select | 실제 agent options·title busy·selected | Controls.interaction: agents undefined/[]/build·review, default 합성 행 부재·busy |
| Controls.tsx:Select trigger label | selected 이름 또는 미선택 label | Controls.interaction: 미선택에 빈 버튼·기본 agent 문자열·임의 선택 없음 |
| Controls.tsx:Select→MenuTitle | label·trailing indicator | Controls.interaction: 제목 안 label 다음 위치, ready/error 없음, radio focus 제외 |
| shared/ui/MenuItem.tsx:MenuTitle | leading/children/trailing 레이아웃 | 신규 shared/ui/MenuItem.render.test.ts: 실제 세 슬롯에 다른 표시·순서·키보드 비대상, trailing 없는 기존 heading 회귀 |
| Controls.tsx:Select focus/keyboard→onChange | options가 빈 경우·실제 agent 선택 | Controls.interaction: 빈 메뉴 Escape/Tab, ready Arrow/Home/End/Enter, store 값·초점 복귀 |

### gate·READY 검토

문서 변경 자체는 links/inventory/prose/diff/INDEX/trailer를 검사한다. 구현은 renderer 가이드와 디자인 시스템·컴포넌트 카탈로그를 적용하고 Controls/Module/state 관련 테스트·typecheck·lint·build를 수행한다. 두 테마의 좁은 메뉴·제목 우측 위치·회전 및 reduced-motion은 실제 창 시각 인수로 남긴다.

D1→AC1, D2→AC2, D4→AC3, D5→AC5, D6→AC4·6 대조했다. 현재 Controls의 defaultAgent 삽입과 미소비 status, MenuTitle의 leading-only 형상을 직접 확인했다. ΔV1 설계는 READY이며 아래 V1 구현 보고는 새 요구의 구현 완료 증거가 아니다.

## [구현자 기입] — V1 이력

### 1. 설계 리뷰

기존 ready 슬롯과 directory 캐시는 이미 성공 결과를 보관한다. 재개방에 연결돼 있던 UI 새로고침 입력만 제거하면 기존 세대·수명 경계를 유지할 수 있어 별도 영속 캐시는 추가하지 않았다.

### 2. 강제 지점 전수·V pair 자기확인

| 지점 | 확인 | 직접 결과 |
|---|---|---|
| EP1 | 3/3 | 실제 Module의 ModeControl/EffortControl과 공통 Select를 렌더. agent/variant 선택 행 전체, 키보드 이동·선택·Escape 초점 복귀 확인 |
| EP2 | 2/2 | Module→실제 hook/state→IPC에서 agent를 먼저 반영. 두 메뉴를 반복 개방해도 초기 두 조회 이후 추가 호출 없음 |

VP1–VP3 SELF_PASS: `Controls.interaction.test.ts`, `Module.integration.test.ts`. VP4 SELF_PASS: `composerCatalogState.test.ts`, main `session-context.test.ts`의 성공 슬롯·실패 부분·directory/generation·최종 owner 해제. 전수 5/5, 잔여 0.

### 3. 이번 라운드 수정의 잠금

loading/error/ready 각각 메뉴의 전체 내용을 단언해 새로고침·상태 행 삽입을 검출한다. 음성 텍스트 검색에만 의존하지 않는다. 반복 개방 검사는 실제 표시 내용과 IPC 호출 수를 함께 확인한다. 선택 mutation 없음.

### 4. Product/UX 파생 검토

팝업에는 로딩·오류 문구·스피너가 없다. 실패한 조회를 빈 성공값으로 만들지 않고 이미 받은 목록은 유지한다. 사용자가 선택하는 기본 agent/variant 항목과 키보드 조작은 보존했다. 우측 상태 패널의 새로고침은 별개 기능으로 유지한다.

### 5. 놓친 잠재 문제·대응

메뉴 캐시를 앱 전역으로 올리면 다른 폴더의 plugin agent가 섞일 수 있다. 기존 scope/generation 캐시를 그대로 사용하고, 늦은 응답 폐기·마지막 owner 정리 회귀를 실행했다. 실제 창의 두 테마 시각 인수는 별도다.

### 6. 구현 보고

AC3/3 자기확인. 팝업 관련 최초 검사 3파일 13개 통과, 이후 main context와 renderer 통합 회귀에서도 통과했다. node/web/test 타입 검사와 production build 통과. lint·문서 gate의 최종 공통 결과는 함께 구현한 [0278 구현 보고](../0278-harness-extension-isolation/plan.md#구현자-기입--v1-r1)에 기록한다. 독립 검증 PASS를 뜻하지 않는다.

### 7. Review Signals

새 dependency·설정 형식·서버 초기화 변경 없음. 캐시 구현을 복제하지 않았으며 삭제한 UI 경로 외의 MCP 상태 조회·재시도는 유지했다.


## [구현자 기입] — ΔV1 r1.2 (2026-10-22)

### 1. 설계 리뷰

합성 기본 에이전트 행을 제거하고 agent loading에만 제목 오른쪽 indicator를 표시했다. 에이전트 미지정 시 버튼은 에이전트 라벨을 사용한다. 정책 정본은 [0278 §27](../0278-harness-extension-isolation/plan.md#27-δv5--ready-확정과-구현-경계-잠금)이다.

### 2. 강제 지점·V pair

직접 oracle: `Controls.interaction/Module.integration/composerCatalogState 및 main composer-catalog tests`. loading/error/ready에서 실제 선택행 전체와 제목 내부 표시를 검사했다. 빈 메뉴에 초점을 줄 수 있고 Escape/Tab으로 복귀하며 model 대기와 agent 캐시를 분리한다. 최신 Delta pair와 기존 회귀 pair를 0278 r2의 실행 집합으로 SELF_PASS(자동 검사 범위)로 기록한다. 독립 검증 PASS가 아니다.

### 3. 수정의 잠금

최신 합의로 대체된 기대값만 변경했고 기존 실패 이력은 보존했다. 저장·SDK 인자·UI 내용·조회 횟수/세대·실패 원본을 직접 단언한다.

### 4. Product/UX

읽기 전용은 상태를 숨기지 않는다. popup refresh/안내 문구 금지는 유지하고 0281에서 허용한 agent 제목 indicator만 예외다. 공통 MenuTitle/Popover/Icon/기존 자원 상태 표면을 재사용했다.

### 5. 잠재 문제

실제 Electron 두 테마 시각 인수와 사용자의 custom executable은 미확인이다. 네이티브 원본 설정을 외부 프로그램이 편집하는 경우의 적용 수명은 0278 r2 보고에 명시했다.

### 6. 검사 보고

관련 회귀 1,177개와 SQLite 7개 통과. 전체 결과·native 버전 실측·최종 gate·외부 참고 checkout 링크 실패는 [0278 r2 구현 보고](../0278-harness-extension-isolation/plan.md#구현자-기입--δv5-r2-2026-10-22)에 기록한다. 이 plan의 READY 설계에 대한 구현을 완료했고 다음 주체는 검증자다.

### 7. Review Signals

새 사용자 선택 JSON·추가 서버 시작·강제 재시작을 도입하지 않았다. 검증자는 위 직접 oracle에서 생산 경계와 실제 입력/출력의 대응을 다시 확인한다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md). 고장 ID는 그 문서 §4 고장 이력이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | M1 `snapshot.agents.status`→`models.status` 맞바꿈 green — models 대기만으로 agent 스피너 | ΔV1 seat 1 · AC5 · DV1-P3 | Module에서 agents/models 반대 조합의 `[data-agent-loading]` 단언 | BLOCKING | open |
| D2 | M4 미선택 trigger에 첫 agent 표시 green | seat 3 · AC6 · DV1-P1 | 비어 있지 않은 agents + 미선택 trigger 텍스트 | BLOCKING | open |
| D3 | M5 회전 class 제거 green | seat 4 · AC5 · DV1-P1 | indicator class(reduced-motion 포함) 단언 | BLOCKING | open |
| D4 | M6 Tab 닫기 분기 제거 green | seat 6 · AC6 · DV1-P1 | Tab 닫기·초점 복귀 관측 | BLOCKING | open |
| D5 | M9 MenuTitle trailing↔label 순서 뒤집기 green, 계획 oracle `shared/ui/MenuItem.render.test.ts` 부재 | seat 5 · DV1-P3 | MenuTitle 세 슬롯 순서 render 테스트 | BLOCKING | open |
| D6 | `harness.defaultAgent` i18n 키 소비처 0 | 비귀속 | 정리 권고 | NON_BLOCKING | open |
| D7 | ΔV1 구현이 0278 `Handoff:` trailer로만 커밋, ΔV1 r1.2 강제 지점 필드가 산문으로 접힘 | repository operation | 다음 구현 커밋에 0281 trailer·6자리 표 | NON_BLOCKING | open |

## [구현자 기입] — ΔV1 r2 (2026-10-23)

### 1. 설계 리뷰

D1–D5는 현재 동작을 다른 값으로 바꿔도 검사에 걸리지 않는 문제였다. 기존 production 경로를 그대로 렌더하는 테스트를 보강했다. 유효 V는 V1+ΔV1이며 Decision·AC·§10의 규범 행은 변경하지 않았다. PLAN_GAP 없음.

### 2. 강제 지점 전수와 V-pair 자기확인

아래 파일은 `app/src/` 기준이다. `Controls.interaction`과 `Module.integration`은 `renderer/src/features/chat/harnesses/opencode/composer/`에 있다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 / 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| DV1-P2·P3 | slot status | ΔV1 seat 1 ModeControl→AgentControl | 1/1 | Module.integration.test.ts: uses only the agent slot for title loading when %s completes first | agent/model 응답을 각각 보류. agent ready/model loading은 indicator 0, 반대는 1 | 없음 |
| DV1-P1·P3 | 실제 목록·busy | seat 2 AgentControl→Select | 1/1 | Controls.interaction.test.ts: shows only real agents and a heading spinner only while %s | loading/error/ready에서 실제 build만 표시. 합성 default 없음 | 없음 |
| DV1-P1 | 미선택 trigger | seat 3 Select trigger label | 1/1 | Controls.interaction.test.ts: keeps the unselected label with real agents until the user selects an agent | build/review가 있어도 버튼은 harness.agent, 두 radio unchecked. 클릭 후에만 review 전달 | 없음 |
| DV1-P1·P3 | 제목 우측 회전 표시 | seat 4 Select→MenuTitle | 1/1 | Controls.interaction.test.ts: shows only real agents…loading | label 다음 trailing 안 indicator, animate-spin·motion-reduce:animate-none, group busy와 aria-hidden | 실제 창의 프레임·테마 인수 별도 |
| DV1-P3 | 공통 세 슬롯 | seat 5 MenuTitle leading/children/trailing | 1/1 | renderer/src/shared/ui/MenuItem.render.test.ts: renders leading, label and trailing in order… / preserves existing headings… | brand·Agents·busy 순서, 우측 ml-auto, 키보드 대상 0. 슬롯 없는 Models 회귀 | 없음 |
| DV1-P1 | 선택·닫기·초점 | seat 6 Select focus/keyboard→onChange | 1/1 | Controls.interaction.test.ts: closes the %s agent menu on Tab… / opens at the current agent… / keeps an empty loading menu… | loading/empty/error/실제 행에서 Tab 닫힘·trigger 복귀, Escape·방향키·정확한 선택 유지 | 없음 |
| V1 VP1·3 | Mode/Effort→Agent/Variant·공통 Select | EP1 3자리 | 3/3 | Module.integration.test.ts: prepares draft agents before providers…; Controls.interaction.test.ts의 agent/variant 선택 | 실제 등록 두 control·선택 행·기본 variant·선택 payload·초점 | 없음 |
| V1 VP2·4 | hook→state·ready slot→IPC | EP2 2자리 | 2/2 | Module.integration.test.ts: prepares draft agents before providers…; composerCatalogState.test.ts의 scope/generation·오류 보존 | 재마운트/메뉴 반복 후 query 2회, agent 먼저 표시·model 후속 반영 | 없음 |

§10 검색을 재실행해 Controls의 status/options/label/keyboard와 공통 MenuTitle을 고정 6자리와 대조했다. 선언·import를 제외한 목록 차집합은 `[]`이며 production 변경은 없다. V1 5/5와 ΔV1 6/6을 분리해 센다. DV1-P1–P3 및 V1 VP1–4는 위 직접 oracle의 기계 범위에서 SELF_PASS다. 독립 verify 결과는 아니다.

### 3. 이번 라운드 수정의 잠금

공유 작업 트리를 변경하지 않고 소스·tsconfig 사본과 같은 dependency를 사용하는 임시 디렉터리에서 `vitest run --pool=threads --maxWorkers=1 <좌표>`를 실행했다.

| 심은 결함 | 출처 | 이전 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| agents.status→models.status | D1·M1 | 못 잡음 | Module.integration의 세 케이스 / 3 | red |
| 미선택 label→첫 agent | D2·M4 | 못 잡음 | keeps the unselected label… / 1 | red |
| indicator 회전·축소모션 class 제거 | D3·M5 | 못 잡음 | shows only real agents…loading / 1 | red |
| Tab 닫기 분기 제거 | D4·M6 | 못 잡음 | closes the %s agent menu on Tab… / 4 | red |
| MenuTitle trailing을 label 앞으로 이동 | D5·M9 | 못 잡음 | renders leading, label and trailing in order… / 1 | red |

선택 증거 0 · 인용 변이 5 · 새 구조 proxy 0 = 5행. 새 검사는 실제 DOM·입력·IPC 결과를 관측한다. D1–D5는 자기보고상 closed이며 과거 verify 판정은 보존한다. 원본 바이트 복원 뒤 이 handoff와 0267의 같은 실행 집합 41/41 green을 확인했다.

### 4. Product/UX 파생 검토

Popover·MenuTitle·Icon의 기존 화면을 그대로 사용한다. 제목 indicator는 agent 준비 상태만 나타내고 model 진행을 대신하지 않는다. 실제 항목이 있는 미선택 상태에서도 자동 선택·가상 default를 만들지 않는다. Tab과 Escape는 메뉴를 닫고 trigger로 초점을 돌린다. 표시 문자열·상태·원격 호출을 추가하지 않았다.

### 5. 놓친 잠재 문제 + 대응

| 문제 | 대응 / 관측 |
|---|---|
| 두 status가 같은 fixture는 형제 슬롯 맞바꿈을 숨김 | 서로 반대인 ready/loading 조합을 실제 hook/state 경로로 생성. M1 red 3 |
| 색/문구 존재만으로는 위치와 소유자를 구별 못함 | MenuTitle 세 슬롯과 label 다음 indicator의 DOM 관계를 관측 |
| 임시 사본의 tsconfig 누락 | 첫 React is not defined 실행은 증거에서 제외. 설정 복사 후 baseline green부터 다시 실행 |
| 소비처 없는 harness.defaultAgent 번역 키 | D6 NON_BLOCKING 유지. 이번 UI 잠금 수정과 무관 |

설계 메커니즘 대체 없음. cache의 만료·공유·재진입·다른 무효화 축은 변경하지 않았다. 실제 창 white/dark·좁은 폭·회전 프레임·reduced motion 시각 인수는 이번 테스트 실행으로 주장하지 않는다.

### 6. 구현 보고

| 항목 | 관측 |
|---|---|
| 변경 파일 | Controls.interaction·Module.integration, 신규 MenuItem.render 테스트와 본 보고 |
| 실행 명령 / 산출 | 담당 UI 6파일 26/26. 타입 fixture 보정 후 영향 3파일 19/19 재통과 |
| V-pair / 강제 지점 | DV1-P1–P3 및 V1 VP1–4 SELF_PASS, ΔV1 6/6·V1 5/5 |
| 블로커 / 역질문 | 없음. 다음 주체는 독립 검증자 |
| 실제 검증 한계 | fake DOM/SSR는 생산 컴포넌트를 실행하지만 설치 창 시각 인수가 아님 |

| AC | 자기보고 / 직접 관측 |
|---|---|
| AC1 | ✅ Controls agent/variant 선택·방향키·Escape·초점 복귀 |
| AC2 | ✅ Module 실제 query 2회·반복 개방·재마운트 후 증가 0 |
| AC3 | ✅ 기존 state/context의 scope·generation·오류·해제 회귀. 캐시 production 무변경 |
| AC4 | ✅ 상태별 실제 radio 목록·가상 default 부재 |
| AC5 | ✅ 독립 slot 응답·spinner class·DOM 위치, M1/M5 red |
| AC6 | ✅ 미선택 label·Tab·Escape·선택 전 불변, M4/M6 red |

검산: ✅6 · ⚠️0 · ❌0 = 총6(기계 범위). `Criteria-Met: 6/6`은 자기보고다. 최종 공통 운영 gate는 [통합 검증 기록](evidence/verify-fail-validation.md)에 있다.

### 7. Review Signals

r2 첫 구현 턴이다. 기존 테스트는 두 slot의 완료 상태를 구별하지 않았고 클래스·Tab·세 슬롯 순서를 읽지 않았다. 요구된 계약은 ΔV1에 이미 있었다. 검사 대역의 selector/타입 제약은 fixture 보정으로 해결했으며 production 정책은 변경하지 않았다. D7의 문서 부분은 자리별 표로 보완하고 구현 커밋은 이 handoff를 별도로 가리킨다.
