# Plan r7 — 모델명 변형과 Work 표시 보완

작성: **Codex**, 2026-09-09. 상태: **plan/READY**. 기준은 원격 r6 `86d47e04`의 V1~ΔV6이며 이번 피드백은 ΔV7이다. 사용자 지시대로 handoff-review는 사용하지 않는다.

## Part I — Product & UX Contract

| 결정 | 사용자 결과 | 승계 |
|---|---|---|
| D-047 | 사용자 정정의 `claudecode-sonnet-5`, `claudecode-opus-4.8`, `claudecode-4.8[1m]`을 지원한다. claude/claudecode 접두사, 네 계열 및 계열 없는 버전, 점·하이픈 구분자를 인식한다. | D-045/046의 모델명 형식 확장. 4.6 이상·custom/미확정 제외 유지. 최초 예시의 계열 뒤 하이픈 생략도 허용 |
| D-048 | Work의 현재 권한 버튼은 팝업과 동일한 수동 승인·자동 승인·모든 승인 건너뛰기 라벨을 사용한다. | Coding 라벨·승인 의미·bypass 확인 유지 |
| D-049 | Work 출력 목록 항목 간격을 줄인다. | 출력 행만 gap 8→4px, 세로 padding 8→4px. 트랜스크립트 카드·개별 동작·영역 상한 유지 |

사용자가 세 번째 ID를 `claudecode-4.8[1m]`으로 정정해 확정했다. 내부 개행을 임의로 지우거나 모델 ID를 SDK 전달 전에 바꾸지 않는다.

| AC | 행동 기준 | 실제 경로/검증 |
|---|---|---|
| AC-R7-1 | 명시한 모델명 변형과 1M이 두 모드에서 자동 승인 후보가 된다. 4.5 이하·잘못된 문자열·custom은 제외된다. | 공용 파싱→Main settings/runtime 분류→선택 shape→메뉴, 공용 실행 permission coercion 테스트와 실제 Composer |
| AC-R7-2 | Work 선택 후 버튼과 메뉴의 라벨이 같고 Coding의 기존 라벨은 유지된다. | permissionModeLabelKey/WORK_MODE_OPTIONS→Composer, 실제 선택과 표시 |
| AC-R7-3 | 출력 행 사이 간격과 행 padding이 줄고 메뉴·말줄임·상태 표시는 유지된다. | TaskOutputContent→ArtifactCards list→ArtifactCard, 실제 native bounds/style |

## Part II — Technical Design

| 조사 대상 | 현재 관측 | 최소 변경 |
|---|---|---|
| supportsAutoPermission / classifyModel | 공용 regex는 claude-계열-버전만 허용하고 계열 없는 모델은 Main이 custom으로 분류한다. | 기존 model-identity 파일에 버전 파싱을 공용 함수로 둔다. Main은 인식된 계열 없는 모델에 중립 alias `claude`를 주고 비custom으로 분류한다. ID 원문은 유지한다. |
| permissionModeLabelKey | Work bypass만 메뉴 라벨을 사용한다. Composer 소비 1곳. | Work 카탈로그에서 해당 mode의 labelKey 조회, 기존 카탈로그 fallback 유지. |
| ArtifactCards list | production 소비는 TaskOutputContent 1곳. gap-2와 py-2가 누적된다. | list 분기에 gap-1/py-1만 적용. 다른 variant는 그대로 둔다. |

네 계열 분류의 기존 부분문자열 호환은 유지하되 자동 승인은 전체 문자열이 공용 문법과 버전 기준을 통과해야 한다. 기본 alias/env·IPC·DB·의존성 추가는 없다. 목록의 비동기 수명·저장/삭제와 Git 캐시는 바꾸지 않는다.

## V pair와 §10 강제 지점

| Pair | 노드↔검사 | 속성 | 직접 oracle / EP |
|---|---|---|---|
| VP-R7-01 | R-R7-01↔AT-R7-01 | CHANGED/REQUIRED | 실제 Composer 모델별 메뉴와 Work 선택 라벨, 출력 bounds/style / EP1~3 |
| VP-R7-02 | AR-R7-01↔IT-R7-01 | CHANGED/REQUIRED | Main settings/runtime 모델→카탈로그→선택→메뉴, 문자열 identity 보존 / EP1 |
| VP-R7-03 | MD-R7-01↔UT-R7-01 | CHANGED/REQUIRED | 이름/버전 양·음성, permission coercion, 메뉴/버튼 라벨 / EP1~2 |
| VP-R7-04 | ΔV6 VP-R6-05/06 | INHERITED/REGRESSION | 기존 권한/모델 선택·출력 카드/상태/개별 동작 검사 |

| EP | 지점 수와 대상 | 실패 의미 |
|---|---|---|
| EP1 | 4 — 공용 파싱/판정, Main settings/runtime 공용 분류, 카탈로그/메뉴, 실제 실행 coercion | 메뉴만 열리거나 Main custom 판정 때문에 계속 숨김 |
| EP2 | 2 — Work 카탈로그/버튼 라벨, Coding 라벨 회귀 | 버튼과 메뉴가 불일치하거나 Coding 문구까지 변경 |
| EP3 | 2 — list 행 padding, 목록 gap/트랜스크립트 대조 | 바깥 여백만 줄이거나 트랜스크립트까지 축소 |
| EP4 | 4 — r7/root, r6 대체 링크/INDEX, 보고/증거, 현재 문서/trailer | 상태 사본 불일치 |

검사는 실제 반환값·메뉴 선택·DOM/style을 사용한다. 별도 mutation은 선택하지 않는다. 영향 Vitest, node/web/test 타입, 전체 lint, production build, Windows Chromium 인수, inventory/prose/links·diff·trailer를 확인한다. 새 외부 모델 실행과 사용자 DB는 필요하지 않다.

READY 대조: D-047→AC1, D-048→AC2, D-049→AC3. 기존 custom 제외는 명시 custom 메타를 유지하며 인정 모델 형식만 확장한다. Q-R5-01은 계속 미결이며 이번 변경과 독립이다.
