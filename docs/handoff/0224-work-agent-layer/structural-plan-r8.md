# Plan r8 — Work / Code 명시적 정책과 조립

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE**. Codex 자기확인과 증거는 [구현 보고 r8](impl-r8.md)에 있으며 독립 verify는 pending이다. 설계 기준은 `4e9e51fa`의 READY 문서다. 사용자가 [구조 진단](structural-diagnosis.md) 이후 “Plan 문서를 업데이트하고 구현을 이행하라”고 지시했다. 기준은 `0c24aaa2`의 V1~ΔV7이며 이번 변경은 **ΔV8**이다. 기존 사용자 지시에 따라 handoff-review는 사용하지 않는다.

## Part I — Product & UX Contract

### 결정과 승계

| 결정 | 사용자 요구 / 구현 계약 | 상태·연결 |
|---|---|---|
| D-050 | “에이전트 구분을 work, code … 내부 변수도 및 표현도 coding을 code로 변경” — 현재 내부 종류·IPC 출력·저장값·종류 라벨/키를 code로 이행한다. 외부 Claude Code/OpenCode 식별자와 과거 증거는 보존한다. | ACTIVE, AC1·2 |
| D-051 | “if else의 형태로 work를 그때그때 처리하지말고 구조적인 레이어” — 종류별 정책을 소유 모듈에 명시하고 실행/화면 조립에서 선택한다. | ACTIVE, AC3·4 |
| D-052 | “가능한한 Work가 아니면 code agent이다 라는 형태로 구조를 가져가지 말것” — 두 종류 모두 완전한 정의를 갖고 unknown은 거부한다. 구형 coding/필드 누락은 명명된 읽기 경계에서만 변환한다. | ACTIVE, AC1·3 |
| D-053 | 경량 리팩토링·회귀 방지 — 기존 실행기·카드·store·캐시·마운트 수명을 보존한다. 새 기반 클래스·동적 등록·모델 호출·watcher·의존성을 만들지 않는다. | ACTIVE, AC4~7; D-002 승계 |
| D-054 | 현재 계획을 갱신하고 구현한다. plan·impl·커밋의 작성자는 Codex다. | ACTIVE, 문서/커밋 gate; D-006 승계 |

D-050은 V1의 `coding` 종류 이름·기본값·DB/IPC 어휘를 대체한다. 새 대화 기본 선택은 code이며 Work의 반대 분기에서 추론하지 않는다. 첫 전송 이후 종류 고정·분기/핸드오프 상속과 ΔV2~7의 배치·권한·모델 판정·Git 캐시·추가 폴더 정책은 유지한다. Q-R5-01의 Work 전송 시 worktree 적용 여부는 변경하지 않는다.

### 동작과 실패

| 시작 / 상태 | 결과 |
|---|---|
| 새 대화 선택 | 좌 Work / 우 Code. 종류 라벨은 작업/코드, 기존 히어로·아이콘·툴팁 없음·색상·폰트 유지. 입력·첨부·cwd 보존 |
| 기존 DB 업그레이드 | coding 세션은 code, work는 work. ID·메시지·검색·lineage·게시 참조 보존 |
| 현재 IPC·메모리에서 정상 종류 | 그 종류의 명시 정책을 선택. 현재 목록/로드 출력에는 필수 종류 포함 |
| 지원하는 구형 읽기 데이터 | 정확한 coding 또는 문서화한 필드 누락만 code로 변환. arbitrary 문자열·오염된 값은 오류 |
| Main 종류 불일치 / 비동기 사이 상태 변화 | 기존 admission 오류·busy·경로 검사 유지. 다른 종류로 대체하거나 권한 확대하지 않음 |
| Code→Work→Code | Git BranchChip 마운트 유지. Work에서 새 조회는 시작하지 않고 이미 시작한 결과와 같은 cwd 캐시는 보존 |
| 패널 닫기 / 세션 이동 / 스트리밍 | raw 패널 상태·상세·스크롤·투영 캐시의 기존 소유자 유지. 표시 정책만 파생 |

### Acceptance Criteria

| AC | 관측 가능한 결과 | 실제 경로·oracle |
|---|---|---|
| AC-R8-1 | code/work 정상 입력은 그대로, 구형 coding은 정해진 읽기 경계에서 code, unknown은 오류. 현재 종류 라벨/키/IPC 출력은 code 사용 | shared parser→Main admission/DTO→renderer load·draft→nav/toggle; 종류·프로토콜·store 및 실제 렌더 |
| AC-R8-2 | 업그레이드/빈 DB에서 값·기본값·CHECK가 code/work이며 데이터·FK·검색·재열기 보존 | 실제 migration→queries→reader/DTO→close/open; SQLite fixture |
| AC-R8-3 | Work와 Code의 권한·세션 능력·UI/패널 정의가 각각 완전하며 소비자가 선택 결과를 사용 | 실제 정책→permission coercion/menu·reducer·패널 파생의 반환값; 타입 누락 검사 |
| AC-R8-4 | 정상/자동 연속 턴의 종류·지침·warm key·도구 경로 및 Work 표시 경계 기록이 유지 | send/resolve→profile→extensions/runtime, coordinator→writer; 기존 통합/경계/respawn 시험 |
| AC-R8-5 | 기존 Work/Code 메뉴·본문·패널·상세 진입·nav 표시가 같은 역할로 연결 | 실제 Composer/ApprovalCard/AssistantTurn/RightPanel/SessionRow 렌더와 클릭; native fixture |
| AC-R8-6 | 토글·조회 중 전환·패널 닫기·세션 이동 후 입력/폴더/Git 캐시와 종류 계승 유지 | BranchChip deferred 응답, store/reducer·fork/handoff·패널 수명 시험, native |
| AC-R8-7 | 정의 선택은 정적 참조를 재사용하고 기존 Work 투영/memo·가상화·실행 재사용을 보존 | policy 동일 참조·기존 identity/수명/respawn 동작 시험. 성능 향상 수치는 주장하지 않음 |

## Part II — Technical Design

### 모듈 책임과 변경 경로

```text
입력 / DB 읽기 → 종류 검증 (work | code)
   ├ shared permission-mode / agent-session-policy: 공용 순수 정책
   ├ Main profiles → app 실행 조립 → 기존 extensions/runtime/history
   └ Renderer agentPresentation / panel policy → 기존 화면 조립 → 공통 부품
```

| 소유자 / 파일 | 구현 |
|---|---|
| shared `agent-kind.ts` | canonical enum/type, strict parser, 명시 legacy reader. 새 출생 기본값과 legacy 읽기를 분리한다. current wire는 code/work만 허용 |
| shared `permission-mode.ts` | `Record<AgentKind, ...>`의 모드 정착표·계획 승인 목표·자동 미지원 대체. kind 인자를 필수로 받고 기존 모델 지원 판정을 재사용 |
| shared `agent-session-policy.ts` | `allowDirectoryUpdates`, `directoryIdentity: windows/exact`, `allowContextFileOpen`을 양쪽에 명시. 실제 busy·path·소유권 검증은 Main 경계에 남김 |
| Main profiles / app | code/work 프로필을 명시하고 실행 준비에서 response-boundary 정책을 전달. 지침 bytes·Work key·Code의 지침/key 없음 유지. Main feature 교차 import 금지 |
| DB / history / IPC | 후속 0023 migration; row 읽기 검증; 현재 목록/로드의 필수 kind. optional send는 신규 기본/기존 상속 의미 유지. preload typed bridge 재사용 |
| Renderer `agentPresentation.ts` | icon/navIcon/label/greeting/placeholder와 composer/transcript 선택 값을 명시. 컴포넌트 import 없는 순수 값 정의 |
| `rightPanelTiles.ts` / layout / registry | 양쪽 visibleIds/taskTarget/taskBadgeTile/columnMode/chrome 명시. 기존 component registry 유지, raw column 상태는 변환하지 않음 |
| Composer / 카드 / 본문 | 상위에서 선택한 Git 표시·본문 투영·상세 진입 값을 사용. 공통 leaf에는 필요한 semantic prop만 전달. 새 전역 Provider 없음 |
| store / reducer / nav | 내부 kind 기본 인자·non-work fallback 제거. draft selector에는 strict parse. app→sessions 표시 props 전달로 chat↔sessions 교차 import 방지 |

정적 선언 예시는 아래와 같다. Code는 전체 목록에서 Work를 제외해 계산하지 않는다.

```ts
const policy = {
  work: { allowDirectoryUpdates: true, directoryIdentity: 'windows', allowContextFileOpen: true },
  code: { allowDirectoryUpdates: false, directoryIdentity: 'exact', allowContextFileOpen: false }
} as const satisfies Record<AgentKind, AgentSessionPolicy>
```

### 저장 이행과 오류

0022는 변경하지 않는다. 0023은 sessions에 code/work CHECK를 가진 임시 이름의 컬럼을 추가하고 정확히 coding→code, work→work로 복사한 뒤 기존 컬럼 제거/새 컬럼 rename을 수행한다. sessions 테이블 자체와 PK를 유지해 참조 테이블 재생성을 피한다. bundled SQLite에서 이 DDL과 FK·인덱스·검색·재열기를 먼저 fixture로 검증한다.

기존 migrator의 백업·트랜잭션·`DB_SCHEMA_TOO_NEW`를 유지한다. 실패하면 기존 스키마/데이터가 남고 정상 새 스키마로 표시하지 않는다. 현재 migration 완료 후 DB 값과 IPC 출력에는 coding을 쓰지 않는다. 구형 DB/fixture 읽기 호환은 명시한 decoder로 한정하고 preload/UI마다 조용한 기본값을 추가하지 않는다.

### 수명과 성능

BranchChip은 표시 여부와 관계없이 같은 인스턴스다. Work에서는 hidden으로 새 조회만 중지하며 pending 응답/cwd snapshot 처리 방식은 그대로 둔다. Composer GitRow의 기존 조건부 mount와 Work transcript의 session key remount는 별도 선택 값으로 유지한다.

정책 객체는 모듈 정적 값으로 두고 state에 복제하지 않는다. 모델 지원 능력, backend, product kind는 서로 별도 축이다. policy 선택 때문에 타이머·프로세스·쿼리를 추가하지 않으며 UI 코드 이동이 기존 cache/memo 참조를 깨뜨리지 않는지 직접 동작 시험으로 확인한다.

## V pair / §10 강제 지점

기준 V1~ΔV7의 영향 없는 기능은 승계한다. 아래 NEW/CHANGED 노드만 ΔV8 REQUIRED로, 영향받는 기존 계약은 REGRESSION으로 재확인한다. 변경 없는 실제 모델의 게시 선택(기존 VP-15), SRT/OpenCode 실제 실행은 NOT_REQUIRED이며 이전 인수/미완료 상태를 바꾸지 않는다.

| Pair | 노드↔검사 / provenance | 속성 | 경로·직접 oracle | EP |
|---|---|---|---|---|
| VP-R8-01 | R-R8-01↔AT-R8-01 CHANGED (AC1·2·5) | REQUIRED | 선택/저장/복원→UI의 code/work 결과, migration fixture와 native | 1·2·5 |
| VP-R8-02 | SD-R8-01↔ST-R8-01 CHANGED (AC4·6) | REQUIRED | 초안→send/lease→load/continuation 및 전환/닫기; 기존 상태 보존 | 1·3·6 |
| VP-R8-03 | AR-R8-01↔IT-R8-01 CHANGED (AC1·2·4) | REQUIRED | DB→DTO/reader→current IPC→store 및 profile→runtime 왕복 | 1·2·3 |
| VP-R8-04 | AR-R8-02↔IT-R8-02 CHANGED (AC3·5) | REQUIRED | 정책→Composer/본문/패널/nav 실제 소비와 클릭 결과 | 4·5 |
| VP-R8-05 | MD-R8-01↔UT-R8-01 CHANGED (AC1·3·7) | REQUIRED | strict/legacy 입력표, 양쪽 권한/세션/표시 반환값·참조 | 1·4·5 |
| VP-R8-06 | V1 VP-03/04/05/07/11/14, ΔV6 VP-R6-05/06, ΔV7 VP-R7-03/04 | REGRESSION | 종류 고정·계승·지침·warm·Work identity 및 모델/권한/출력 행동 시험 | 3·4·5·6 |

VP-R8-06은 각 원래 계약의 행동 oracle을 재실행한다. 리팩토링이 변경하지 않는 실행 총량 benchmark/실모델 결과를 이번 속도 개선 증거로 재해석하지 않는다. 구조 검색은 조사 보조이며 `조건문 0`을 완료 oracle로 사용하지 않는다. 모든 pair는 실제 결과 oracle을 사용하므로 별도 결함 변이는 선택하지 않는다.

| EP | 강제 지점 (구현 시 각 소비처 재열거) | 실패 의미 |
|---|---|---|
| 1 | shared enum/parser; send schema/admission; DTO/reader; renderer load/list/draft; 새 출생·선택·일반/busy 전송 | unknown이 code가 되거나 같은 세션에서 종류가 달라짐 |
| 2 | migration 등록/SQL; insert/queries; FK/검색·lineage/게시 참조; 재열기·구형 앱 거부 | 저장 거부·데이터 손실·과거 migration 수정 |
| 3 | send/resolve; lease/context; 최초/자동 extensions/runtime; coordinator/writer; directory/files의 await 전후 guard | 실행/지침/권한/경계 차이 또는 stale 허용 |
| 4 | 공용 permission 정착/plan 목표/auto fallback; Composer 목록/라벨; session capability와 reducer | 메뉴와 실행 불일치·모델 지원 범위 변화 |
| 5 | presentation/toggle/nav; Composer/Cwd/Git; transcript/ApprovalCard/task/subagent; panel visible/target/badge/layout/chrome | 다른 역할 표시 또는 암묵 Code fallback |
| 6 | 입력/초안·추가폴더; pending Git/cwd cache; raw panel state/close; projection/memo/session key | 표시 변경으로 상태·캐시 수명 소멸 |
| 7 | root plan·r8 plan·INDEX; current arch/IPC/i18n; impl 보고·커밋 trailer | 현재 계약/상태/작성자 사본 불일치 |

## 구현 순서 / 검증

1. 종류·DB·UI 행동 시험을 먼저 준비해 기존 coding/unknown 결과를 관측한다. 기존 통합 fixture는 유지하고 새로운 요구의 실패를 확인한다.
2. shared 종류·현재 IPC·DB migration·Main 소비처와 Renderer canonical rename을 이행한다. 영속/외부 제품 이름은 구별한다.
3. 공용 권한/세션 정책, Main 실행 구성, Renderer 표시/패널 구성을 각각 소유 모듈로 모은다. 기존 공통 컴포넌트를 재사용한다.
4. store·nav·leaf의 종류 재해석을 제거하고 strict 경계·semantic prop 연결을 확인한다.
5. 관련 Vitest(ABI 중립), 실제 SQLite(Electron ABI fixture), native Chromium 회귀, node/web/test typecheck, lint, production build를 수행한다. 사용자의 실제 DB는 사용하지 않는다.
6. 현재 IPC/architecture 문서, inventory 재생성/검사, migration append-only·diff·trailer를 확인하고 Codex 구현 보고를 작성한다.

계획과 구현은 별도 커밋이다. 기존 브랜치에서 이어가며 새 worktree·PR·push는 이번 작업에 추가하지 않는다. 독립 verify 결과는 선점하지 않는다.

READY 대조: D-050→AC1·2, D-051→AC3·4, D-052→AC1·3, D-053→AC4~7, D-054→EP7. 기존 Git hidden/cache, Work 권한 라벨, Code 패널 배치와 Q-R5-01 유지가 Part I/II에서 일치한다. 영향 파일·시험 경로는 코드 조사와 구조 진단에서 확인했다.
