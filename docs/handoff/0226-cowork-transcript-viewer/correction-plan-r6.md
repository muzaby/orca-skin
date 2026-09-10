# 0226 도구 노출과 spark 순서 정정 — Delta V7

READY · Codex · 2026-09-10 · 기준 `b727adbb`. 사용자가 같은 작업의 요구를 명시적으로 정정했으므로 r6에서 이어간다. V1~V6의 비충돌 계약과 독립 verify pending을 승계한다.

## Decision Ledger와 동작

| 결정 | 출처 / 결과 |
|---|---|
| D-35 ACTIVE | “항상 허용이 아닌 도구 노출이 목적” — D-33의 PowerShell 자동 허용을 대체한다. Claude Work·Code는 Bash/WebSearch를 제외하고 SDK 기본 도구와 PowerShell을 노출한다. 앱이 PowerShell을 allowedTools로 자동 허용하지 않는다. 기존 permission mode와 승인 경로를 따른다. PS 활성화 환경값, WebFetch preflight 기본값, 명시 설정 우선순위는 승계한다. |
| D-36 ACTIVE | “사용자 메시지 버블, 어시스턴트 메시지 버블, 카드 ui, 스파크 순서” — D-31/AC37의 spark 앞 카드 배치를 대체한다. 확정/live 본문 → 일반/게시 카드 → spark/status가 같은 응답의 순서다. 완료 메타는 기존처럼 완료한 본문과 카드 사이에 둔다. idle/background ready에서 진행 spark를 숨기는 기존 정책은 유지한다. |

노출과 승인을 분리한다. 기본 도구 이름을 수동으로 전부 나열하면 SDK의 기본 도구가 누락될 수 있으므로 SDK 기본 집합을 유지하고 제외 목록만 적용한다. PowerShell은 env로 활성화한다. `allowedTools` 제거 후에도 Orca의 `canUseTool` 안전 도구 fallback이 자동 승인하지 않도록 PowerShell을 기존 shell 승인 분류에 넣는다. 승인/거절과 사용자가 선택한 permission mode는 그대로 전달한다.

화면은 PendingAssistant의 본문과 status 사이에 출력 카드를 조립할 수 있게 하여 live 리프 구독을 보존한다. 첫 응답의 assistant 메시지가 아직 없으면 기존 본문/status fallback을 사용하고 spark는 한 번만 표시한다. 파일 소유권·수집·영속·Temp 작업 경로는 바꾸지 않는다.

## 인수 기준과 V

| AC / 노드 | 사용자 관측 / oracle |
|---|---|
| AC41 / R41↔AT41 NEW | Work·Code에서 Bash/WebSearch를 제외한 SDK 기본 도구와 PowerShell을 노출하고 PowerShell을 자동 허용하지 않는다. 실제 query 옵션, canUseTool의 승인/거절 전달 및 기존 completion 도구 비활성 검사 |
| AC42 / R42↔AT42 NEW | 사용자→확정/live 본문→일반/게시 카드→spark 순서이며 spark는 하나다. 늦은 카드·첫 전송·reload·background ready 및 카드 액션 유지. 실제 React 조립과 Electron DOM/수직 순서 |

| Pair | requiredness / production path / oracle |
|---|---|
| VP79 | REQUIRED · NEW R41↔AT41 · Work/Code 요청→query 기본 도구+제외/활성화→SDK 권한 callback→기존 승인 응답, 실제 옵션과 spy 결과 |
| VP80 | REQUIRED · NEW R42↔AT42 · Exchange→AssistantTurn→PendingAssistant 본문/카드/status, SSR+native DOM/수직 순서 |
| VP81 | REQUIRED · NEW AR10↔IT10 · query와 canUseTool의 노출/권한 분리, PendingAssistant 일반 fallback/카드 삽입 경로. 해당 integration tests |
| VP82 | REGRESSION · R37~39↔AT37~39의 비충돌 부분 · 원래 턴 귀속·중복·메타·idle·Temp·설정 우선순위·completion 도구 없음, 기존 테스트 및 r5 증거 승계 |

선택 적대 증거 없음. 실제 반환 옵션·호출 결과·렌더 DOM을 직접 관측한다. DB·파일 수집·nav·다른 패널은 비영향이며 V6 증거를 승계한다.

## §10 강제 지점

| EP | 언제 강제 / N | 실패 의미 |
|---|---|---|
| EP33 | conversation query·PowerShell 권한 분류/callback·completion query / 3 | 자동 허용 잔존, 기본 도구 누락, 제외 도구 재노출, completion 도구 활성화 |
| EP34 | pending assistant의 카드 삽입·assistant 없는 fallback·완료 메타/카드·늦은 카드 갱신 / 4 | 카드 뒤 본문, spark 앞 카드 누락, 중복 spark, 새 출력이 다른 턴으로 이동 |

## 작업과 gate

기존 테스트의 query/승인 및 spark 순서를 새 계약으로 먼저 바꾸어 red 확인 후 최소 구현한다. PendingAssistant의 공통 합성과 기존 ArtifactCards를 사용하며 새로운 store/IPC/의존성은 만들지 않는다. 영향 Vitest, node/web/test 타입, 변경 파일 ESLint/Prettier, Electron native 순서·스크린, build, inventory/test-budget/whitespace를 수행한다. 현재 ABI와 기존 브랜치를 유지하고 설계·구현 커밋을 분리한 뒤 원격에 푸시한다.

handoff-review DIAGNOSE_ONLY: 이번 정정은 D(User decision change)다. 기존 명시 결정의 supersede만 기록하며 스킬/지침을 바꾸지 않는다. READY self-review: D35/36→AC41/42→VP79~82→EP33/34의 생산·소비·실패 경로를 대조했다.

## [구현자 기입] Delta V7 결과

AC41·42 자기확인 2/2, VP79~82 SELF_PASS, EP33 3/3·EP34 4/4. [구현 보고](impl-r6.md)에 승인 fallback 보강, 카드 부모 유지, 영향 Vitest 198건·native 46건 및 운영 gate 결과를 기록했다. 독립 verify는 pending이다.
