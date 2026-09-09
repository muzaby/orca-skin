# 0224 구조 진단 — Work / Code 명시적 구성

작성: **Codex**. 진단 기준: `0c24aaa2`. 구현 전 조사와 권고안이며, 승인된 ΔV8 구현 계획이나 독립 verify 결과가 아니다. 제품 코드·DB·기존 R7 완료 상태는 변경하지 않았다.

## 결론

기능 골격과 재사용할 공통 컴포넌트는 갖춰져 있다. 그러나 에이전트별 지침과 문구만 표로 정의되어 있고 권한·화면·상태 전이에는 Work 예외 처리가 분산되어 있다. 기존 프로필과 표시 매핑을 확장해 **검증된 종류 → 명시적 정의 선택 → 실행/화면 조립** 흐름으로 정리하는 것이 적절하다.

사용자 추가 조건을 따라 Work와 Code는 각각 완전한 정의를 갖는다. `work가 아니면 code`, 정의 조회 실패 시 code fallback, `isWork` 하나로 모든 표시와 수명을 결정하는 구조는 도입하지 않는다.

## 1. 현재 구조와 진단

| 관측 | 구조적 영향 | 대응 |
|---|---|---|
| Main `features/agents/profiles.ts`는 명시적인 두 프로필을 갖지만 지침·key만 제공한다. | 실행 정책은 다른 모듈이 종류를 다시 판단한다. | 기존 프로필 해석을 유지하고 공용 정책에서 확정한 값을 실행 준비에 전달한다. |
| Renderer `agentPresentation.ts`는 랜딩 문구·아이콘만 정의한다. | Composer·nav·계획/작업 패널이 같은 종류를 별도로 해석한다. | 순수 표시 정의와 화면 조립 책임을 분리해 확장한다. |
| `permission-mode.ts`의 종류별 정착과 `composer/modes.ts`의 목록/라벨에 Work 분기가 있다. | 허용 모드·계획 승인 목표·자동 미지원 대체 모드·표시 문구의 변경 지점이 흩어진다. | 종류별 권한 정의는 공용 정책, i18n과 메뉴 구성은 Renderer가 소유한다. 모델 지원 판정은 별도 축으로 유지한다. |
| `rightPanelTiles.ts`는 Work에는 task, 나머지에는 task 이외를 허용한다. `rightPanelLayout.ts`도 Work 처리 후 공통 경로로 내려간다. | Code의 허용 목록이 독립된 정의가 아니며 타일 추가 시 뜻하지 않게 따라올 수 있다. | 양쪽 허용 타일·작업 진입 대상·배지 대상·배치 전략을 각각 명시한다. |
| AssistantTurn·ApprovalCard·서브에이전트 행에서 종류별 본문과 진입 방식이 결정된다. | 공통 컴포넌트가 제품 모드의 선택 책임까지 갖는다. | 상위 조립 지점에서 본문/상세 전략을 선택하고 공통 카드는 전달받은 역할을 수행한다. |
| `chatStore.ts`의 초안 목록 복원은 `kind === 'work' ? 'work' : 'coding'`이다. | 알려지지 않은 값까지 Coding으로 해석하는 형태다. | 명시적 검증/변환을 사용한다. 신규 기본값·구형 데이터 호환과 잘못된 입력을 구별한다. |
| 기존 DB 컬럼은 기본값 coding, CHECK coding/work이다. | TypeScript 문자열만 code로 바꾸면 저장 제약과 기존 세션의 해석이 어긋난다. | 기존 migration은 보존하고 후속 migration·경계 변환·왕복 검사를 함께 설계한다. |

대표 코드 좌표:

- Main 프로필: `app/src/main/features/agents/profiles.ts:9`, 종류 검증: 같은 파일 `:30`.
- 표시 정의: `app/src/renderer/src/features/chat/lib/agentPresentation.ts:5`.
- 권한 정책: `app/src/shared/permission-mode.ts:70`, 메뉴/칩: `app/src/renderer/src/features/chat/components/composer/modes.ts:75`.
- 패널: `app/src/renderer/src/features/chat/lib/rightPanelTiles.ts:66`, `rightPanelLayout.ts:33`.
- 본문 선택: `app/src/renderer/src/features/chat/components/transcript/AssistantTurn.tsx:42`.
- 초안 복원: `app/src/renderer/src/features/chat/store/chatStore.ts:1814`.
- DB 제약: `app/src/main/infra/db/migrations/0022_session_agent_kind.sql:1`.

아래 검색으로 직접 work/coding 문자열 비교의 분포를 재현할 수 있다. 검색 결과에는 종류 검증과 Work 전용 권한 가드처럼 필요한 조건도 포함하므로, 모든 일치를 결함으로 취급하지 않는다.

```text
rg -n "=== 'work'|!== 'work'|=== 'coding'|!== 'coding'" app/src -g '*.ts' -g '*.tsx' -g '!*.test.*' -g '!*.testfixture.*'
```

Main의 `resolveAgentKind`와 전송 입력 스키마는 이미 잘못된 종류와 세션 종류 불일치를 거부한다. 이 검증을 대체할 필요는 없다. 반면 DB의 목록 DTO는 누락 기본값만 처리하고 잘못된 비어 있지 않은 값을 검증하지 않으며, preload는 타입 기반 전달을 수행한다. DB/구형 데이터 읽기 경계에서 정상 종류로 확정한 뒤 현재 IPC 출력과 Renderer 내부에서는 필수 종류를 전달하는 것이 적절하다. 위 초안 목록 인코딩은 메모리 내 selector용이며 별도 영속 초안 저장소로 확인된 것은 아니다.

## 2. 권고 구조

```text
신규 선택 / 저장된 세션 / IPC
          ↓ 경계에서 검증·필요한 구형 값 변환
      AgentKind = work | code
          ↓ 각각 명시한 정의를 선택
  공용 제품 정책                 (순수 값·타입)
       ├ Main 프로필/실행 준비    (지침·권한 목표·응답 경계)
       └ Renderer 표시/화면 조립  (문구·메뉴·본문·패널)
                    ↓
       기존 Composer / 카드 / 패널 / 실행기 재사용
```

### 공용 제품 정책

`app/src/shared/agent-kind.ts`는 정체성과 검증을 소유한다. 종류별 권한 정착표·계획 승인 목표·자동 미지원 대체 모드처럼 Main과 Renderer가 함께 사용하는 정책은 기존 공용 모듈의 작은 순수 정의로 모은다. 폴더 추가처럼 양쪽에서 중복 판단하는 능력도 이 경계의 후보지만, 실제 검증은 Main이 수행한다. Main에서만 사용하는 응답 경계 기록 규칙은 Main 프로필/실행 준비에 남긴다. 범용 UI를 위한 `renderer/src/shared/`에는 제품 정책을 넣지 않는다.

Work와 Code를 모두 명시한 `Record<AgentKind, ...>`로 정의하고 필수 필드를 빠뜨리면 타입 검사에서 실패하게 한다. Code도 허용 모드와 기본 동작을 직접 정의하며 Work 설정의 반대나 전체 목록의 차집합으로 만들지 않는다. 에이전트 종류와 모델/백엔드의 실제 지원 능력은 분리한다.

### Main

기존 `features/agents/profiles.ts`와 app의 실행 조립을 활용한다. 세션/lease의 확정 종류로 실행 정책을 선택하고 정상 전송과 자동 연속 전송에 같은 값을 전달한다. 프로필 key와 지침 내용이 그대로인 역할은 기존 warm runtime과 append를 유지한다.

폴더 추가의 busy·소유권·경로 검증은 실제 Main 경계에 남긴다. `session-directory.ts`가 비동기 경로 검증 전후로 세션을 다시 확인하는 절차도 보존한다. 정책을 미리 선택한다는 이유로 최종 상태 재검사를 없애지 않는다.

### Renderer

기존 `agentPresentation`을 출발점으로 랜딩·nav 표현과 Composer·패널·트랜스크립트의 선택 값을 명시한다. 값 정의는 React 컴포넌트를 import하지 않고, 화면 조립 지점에서 선택한 컴포넌트/전략을 연결한다. 이렇게 해야 본문 → 도구 카드 → 종류별 레지스트리 → 본문의 순환 의존을 피할 수 있다.

nav의 SessionRow는 chat feature의 내부 정의를 직접 import하지 않는다. app 조립에서 종류별 표시 값을 sessions에 전달하는 기존 하향 의존을 따른다. 제품 정책을 범용 UI atom에 넣거나 feature 간 교차 import를 추가하지 않는다.

구체적으로 `rightPanelTiles.ts`에는 양쪽의 가시성·진입 대상·배지·배치 값을 담은 명시적 패널 정의를 두고, `modes.ts`는 공용 권한 정책에 Renderer 라벨을 연결한다. 기존 `tileRegistry`의 컴포넌트 등록은 유지한다. AssistantTurn·Composer·우측 패널 조립에서 선택한 본문/상세/표시 값을 하위로 전달해, 개별 카드가 다시 종류를 해석하는 일을 줄인다. 단일 거대 설정 객체나 모든 컴포넌트를 가져오는 중앙 registry는 만들지 않는다.

세션에는 `agentKind`만 저장하고 파생된 정의를 별도 상태로 중복 저장하지 않는다. 정적 정의의 참조는 안정적으로 유지하고, 번역 결과가 아닌 번역 키를 보관한다. 입력/초안/첨부/폴더·스크롤·상세 선택·캐시의 소유자는 기존 컴포넌트와 store를 유지한다.

## 3. 반드시 별도로 표현할 정책

| 항목 | Work | Code |
|---|---|---|
| 권한 메뉴 | 수동 승인·자동 승인·모든 승인 건너뛰기 | 기존 Code용 모드 구성 |
| 자동 승인 미지원 대체 | default | accept_edits |
| 계획 승인 목표 | default | accept_edits |
| 랜딩 Git 표시/새 조회 | 숨김/시작하지 않음 | 표시/조회 시작 |
| 이미 시작한 랜딩 Git 조회 | 결과와 같은 cwd 캐시 유지 | 같은 cwd 캐시 즉시 사용 |
| 패널 | task, 내용에 맞는 높이, 영역별 상한 | plan·subagent·diff, 기존 배치 |
| 작업 진입/배지 대상 | task | plan |
| 본문 | Work 활동 투영 | 기존 메시지 본문 |
| 계획·서브에이전트 상세 | 대화 내부 | 기존 패널 진입 |
| 확정 세션 폴더 추가 | 유휴 시 허용 | 현재 정책 유지 |

이는 현행 행동을 옮길 비교표다. 예를 들어 Git을 숨긴다고 BranchChip을 unmount하면 R6 캐시 요구가 다시 깨진다. 패널을 숨기는 것과 구독/상세 수명을 종료하는 것도 같은 값으로 합치면 안 된다.

## 4. coding → code 이행 범위

| 대상 | 처리 방향 |
|---|---|
| 실행 종류·변수·매핑 키 | `code/work`를 정본으로 사용한다. `isCoding` 같은 종류 식별 표현도 정리하며 불필요한 종류 boolean 자체를 줄인다. |
| UI/i18n·현재 계약 문서·테스트 | 제품 모드 명칭과 키를 Code 기준으로 맞춘다. 한국어 종류 라벨의 코딩은 코드로 정리하는 안이다. 기능 설명의 개발/디버깅 문장은 유지한다. |
| 저장 DB | 다음 migration에서 기존 coding을 code로 이행하고 기본값·CHECK도 일치시킨다. 기존 세션/메시지/lineage/게시 참조의 보존을 검증한다. |
| 구형 직렬화 입력 | 필요한 읽기 경계에서만 `coding → code`를 명시한다. 변환한 다음 내부에는 정상 AgentKind만 전달한다. |
| 누락과 오류 | 신규 출생의 명시적 기본 선택과 구형 데이터의 필드 누락 호환은 구분해 유지한다. unknown·오염된 문자열을 code로 보정하지 않는다. |
| 과거 증거·외부 계약 | 적용된 0022 migration, 완료된 과거 보고, SDK의 `claude_code` 같은 외부 식별자는 전역 치환하지 않는다. |

`coding`을 내부 union의 영구 별칭으로 남기는 방법은 권하지 않는다. DB 저장값만 coding으로 계속 유지하는 방법도 이름 이원화가 남는다. 최종 migration의 SQL 방식과 구형 데이터 변환 경계는 ΔV8 계획에서 실제 저장 경로를 기준으로 확정해야 한다.

기존 migration은 append-only 검사 대상이다. 후속 migration은 기존 DB 업그레이드와 빈 DB의 전체 migration 실행을 모두 검증해야 하며, sessions를 참조하는 외래 키·인덱스·메시지/검색·lineage·게시 참조를 보존해야 한다. 현행 migrator에는 사전 백업과 트랜잭션, 더 새 스키마를 구형 앱이 여는 것을 거부하는 `DB_SCHEMA_TOO_NEW`가 있다. 이 장치를 유지하며 실제 SQLite fixture로 SQL을 검증한다. rename만을 위해 과거 migration을 고치거나 구형 저장값으로 계속 쓰는 호환 계층을 두지 않는다.

## 5. 대안 비교

| 대안 | 평가 |
|---|---|
| 문자열 교체 + isWork helper | 분기 선택 책임과 Code의 암묵적 기본값이 그대로여서 요구를 충족하지 못한다. |
| 명시적 정적 정의 + 기존 조립 지점 정리 | **권고**. 정책/표시 변경의 소유자를 분명히 하면서 공통 실행기·컴포넌트를 재사용한다. |
| Agent 기반 클래스·등록 플러그인·동적 정책 엔진 | 현재 두 역할에 비해 수명과 의존성이 커진다. 후속 OpenCode/SRT를 위한 선제 플랫폼으로 만들 필요가 없다. |

Work/Code는 제품 역할이고 Claude/OpenCode는 실행 백엔드다. SRT는 향후 실행 격리 경계이므로 각각 직교한 축으로 유지한다. 이번 정리에서 미래 백엔드·도구·플러그인 등록 프레임워크를 만들지 않는다.

## 6. 성능과 회귀 관점

조건문 자체가 성능 문제라는 증거는 없다. 현재 코드에는 정적 registry, memo, Work 결과/투영 캐시와 transcript 가상화가 이미 있다. 진단에서는 실행 시간이나 렌더 성능 향상을 측정하지 않았으므로 속도 개선 수치를 주장하지 않는다.

더 큰 위험은 새 구성 객체를 매 렌더 생성하거나 모드 wrapper 교체로 공통 컴포넌트를 재마운트하는 것이다. 정의는 정적으로 두고 가변 캐시는 세션/컴포넌트 인스턴스가 소유하게 해야 한다. 과거 턴 참조, pending Git 응답, 패널 scroll/focus, 입력 DOM이 유지되는지를 행동으로 확인한다.

## 7. 다음 구현 단계와 완료 기준

1. 기존 두 역할의 행동표와 저장/복원 경계를 기준선으로 잠근다. 알 수 없는 종류 거부와 명시적 Code 정의를 인수 기준에 넣는다.
2. DB·타입·IPC·복원 경계를 묶어 code 명칭을 이행한다. 새 DB와 기존 DB 업그레이드, 세션 로드/목록/검색/분기/핸드오프를 확인한다.
3. 공용 정책과 Main 실행 준비를 정리한다. 권한의 메뉴·실제 실행 정착, 정상/자동 연속 턴의 종류와 지침·warm key를 대조한다.
4. Renderer의 값 정의와 조립을 옮긴다. 모드 선택 후 단일 Composer와 Git 캐시, 패널 닫기/상세/스크롤, 트랜스크립트와 nav 상태를 검증한다.
5. 중복 분기·기본 인자·현재 표현을 정리하고 영향 회귀·레이어 lint·타입·빌드·DB/native 인수를 수행한다.

모든 if문을 없애는 것이 완료 기준은 아니다. 종류 해석과 정책 선택의 소유자가 정해지고, 공통 하위 컴포넌트가 임의로 Work/Code를 재해석하지 않으며, unknown이 Code로 흘러가지 않는 것이 기준이다. Q-R5-01의 Work 전송 시 worktree 적용 여부는 별도 미결 정책으로 남겨 이번 구조 정리에서 변경하지 않는다.
