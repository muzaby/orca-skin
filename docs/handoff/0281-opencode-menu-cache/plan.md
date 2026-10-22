# OpenCode 컴포저 메뉴 캐시와 새로고침 제거

## 메타

| 항목 | 값 |
|---|---|
| 작성 | Codex / 2026-10-22 |
| 상태 | READY |
| V | Baseline V1 — 이번 제거 요구의 독립 기준선 |

# Part I — Product & UX Contract

## 1. 목표·출처

사용자: “opencode composer에서 제공하는 팝업메뉴들에서 새로고침 항목은 모두 제거하라. 한 번 로드한 내용은 캐싱하라.” 메뉴 재개방은 준비된 목록을 사용한다.

## 2. Decision Ledger

| ID | 결정 | 상태 |
|---|---|---|
| D1 | 컴포저 팝업의 새로고침 액션 제거 | ACTIVE — 0276의 수동 팝업 재조회 대체 |
| D2 | 성공 목록은 같은 작업폴더·실행 세대에서 재사용 | ACTIVE |
| D3 | 로딩·실패 안내와 스피너 없음 | ACTIVE — 기존 사용자 결정 유지 |
| D4 | 인스턴스 종료·경로 전환 때 이전 실행 목록을 현재 목록으로 사용하지 않음 | ACTIVE — 기존 수명 정책 유지 |

## 3. 동작·상태

| 동작 | 관측 |
|---|---|
| 최초 표시 | agent/provider 독립 준비, 완료된 종류만 표시 |
| 메뉴 닫기·열기·선택 | 캐시 재사용, 수동 갱신 행 없음 |
| 실패 | 안내 없음, 이미 성공한 값 보존 |
| directory/generation 전환 | 기존 격리·소유권 정리 유지 |

오른쪽 상태 패널과 nav MCP의 새로고침은 컴포저 팝업이 아니므로 유지한다. 전역 정책·MCP 관측의 나머지 합의는 0278·0277에서 이어서 구현한다.

## 4. AC

| AC | 관측 기준 | 직접 증거 |
|---|---|---|
| AC1 | agent/variant 팝업은 선택 항목만 표시, 키보드 선택·초점 복귀 정상 | Controls.interaction tests |
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

## [구현자 기입]

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
