# OpenCode 컴포저 메뉴 캐시와 새로고침 제거

## 메타

| 항목 | 값 |
|---|---|
| 작성 | Codex / 2026-10-22 |
| 상태 | READY — ΔV1 에이전트 메뉴 정정, 구현 전. V1 구현 보고는 과거 증거 |
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
