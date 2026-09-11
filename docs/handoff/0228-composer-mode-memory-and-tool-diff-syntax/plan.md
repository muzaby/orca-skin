# Plan — 0228-composer-mode-memory-and-tool-diff-syntax

## 메타

| 항목 | 값 |
|---|---|
| slug | `0228-composer-mode-memory-and-tool-diff-syntax` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 상태 | READY |
| V mode | Baseline V |
| 기준 V | none |
| 이번 V revision | V1 |
| 유효 V | V1 |

# Part I — Product & UX Contract

## 1. Context / 목표

- composer 랜딩이 앱을 다시 열거나 새 대화를 만들 때 사용자가 마지막으로 고른 Work/Code를 잊고 Code로 돌아간다.
- Code 대화의 Read 카드는 파일 확장자 기반 문법 강조를 하지만 Write/Edit/MultiEdit 카드는 본문 문법 강조가 없고, Edit 줄 축은 실제 파일 위치가 아닌 입력 조각의 1부터 시작한다.
- 완료 상태는 첫 설치의 랜딩은 Work이고, 이후 랜딩은 마지막 명시 선택을 복원하며, 파일 편집 카드는 우측 Git diff와 같은 언어·줄 축 렌더 원칙을 따른다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 마지막 활성 Work/Code를 기억하고 첫 실행은 Work로 고정한다. | 현재 사용자 턴 |
| 명시 요구 | Code의 Write/Edit 도구를 파일 언어 문법에 맞게 렌더한다. | 현재 사용자 턴의 `write, sdit`를 주변 문장에 따라 Write/Edit로 해석 |
| 명시 요구 | Edit의 본문 타깃과 줄번호를 정확히 표시한다. | 현재 사용자 턴 |
| 명시 요구 | 우측 Git diff와 Read의 기존 언어 렌더를 참조한다. | 현재 사용자 턴 |
| 추론 의도 | MultiEdit도 같은 편집 도구 집합의 여러 Edit이므로 동일 계약을 적용한다. | `FILE_EDIT_TOOLS`와 현행 `DiffBody.buildPairs` |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 설치 후 설정값이 없는 최초 랜딩은 Work다. | 사용자의 “첫 실행은 work” | 사용자 턴 | ACTIVE | — |
| D-002 | 랜딩에서 Work/Code를 명시 선택하면 그 값을 앱 설정에 저장하고 이후 새 랜딩에 사용한다. | 프로세스 재시작을 포함한 “기억” | 사용자 턴 | ACTIVE | — |
| D-003 | 확정된 기존 세션의 `agentKind`는 세션 기록을 따르며 마지막 랜딩 선택으로 덮지 않는다. | 이력의 실행 종류 보존 | 현행 session load 계약에서 파생 | ACTIVE | — |
| D-004 | Read·Write·Edit·MultiEdit의 언어 판정은 파일 경로 확장자 SSOT를 공유한다. | 사용자 지정 참조 구현 재사용 | 사용자 턴 | ACTIVE | — |
| D-005 | Edit/MultiEdit는 각 입력의 실제 타깃 문자열을 diff하고 SDK가 시작 줄을 주지 않으므로 절대 파일 줄번호를 추측하지 않는다. | 부정확한 숫자보다 정직한 상대 축 | 현행 tool input 계약 조사 | ACTIVE | — |
| D-006 | Write는 빈 파일에서 새 내용으로의 diff, Edit는 `old_string→new_string`, MultiEdit는 각 edit 쌍의 diff를 유지한다. | 입력 의미와 현재 카드 구조 보존 | 현행 코드 | ACTIVE | — |

### 갱신 메모

- 새 결정은 D-001~D-006이며 대체된 결정과 OPEN 항목은 없다.
- ACTIVE 결정 ↔ AC 대조: D-001↔AC1, D-002·D-003↔AC2, D-004↔AC3, D-005·D-006↔AC4로 충돌 0건이다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 전제 정정 | `initialChatState.agentKind`가 Code이고 `NEW_CHAT`/`freshEntry`가 이를 복사하며 선택 액션은 영속하지 않는다. |
| 이미 충족하는가 | 일부 충족 | Read는 `extToLang`+`CodeBlock`, Git diff는 `useDiffSyntax`; 도구 diff는 `DiffTable` 평문이다. |
| 더 작은 해법이 있는가 | 있음 | 신규 저장소 없이 기존 `Settings`/`settingsApi`와 기존 Shiki 경로를 확장한다. |
| 정확한 Edit 절대 줄을 만들 수 있는가 | 입력만으로 불가 | `old_string/new_string`에는 파일 내 시작 offset이 없고 결과에도 패치가 없다. |
| 기존 결정과 충돌하는가 | 없음 | 세션 `agentKind` 잠금과 우측 diff SSOT를 보존한다. |

- 사용자에게 올릴 결정: 없음. “정확한 줄번호”는 존재하지 않는 절대 offset을 추측하지 않고 편집 조각의 old/new 상대 축을 명확히 표시하는 것으로 닫는다.
- 코드 조사로 닫은 사실: 카드의 잘못된 타깃은 `DiffBody`가 파일 경로를 `DiffTable`에 전달하지 않는 데서, 문법 미지원은 `DiffTable`이 Shiki 토큰을 소비하지 않는 데서 발생한다.

## 5. 동작 / 사용자 흐름

```text
최초 부팅 → settings.lastAgentKind 기본 Work → 새 composer 랜딩 Work
랜딩에서 Code 선택 → 즉시 Code 표시 + 설정 저장 → 새 대화/재시작 랜딩 Code
기존 Work 세션 열기 → 저장된 세션 종류 Work 표시(설정값과 무관)

Code 도구 카드 수신 → file_path 언어 판정 → old/new 축 diff + 문법 토큰 → 정확한 상대 줄 축 표시
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 보이는 결과 |
|---|---|---|
| 설정 키 부재·깨진 값 | 스키마 기본 Work로 정규화 | Work 버튼 활성 |
| 잠기지 않은 랜딩에서 선택 | 리듀서 전이 후 설정 patch | 선택 버튼 즉시 활성; 저장 실패도 현재 선택은 유지 |
| 새 대화 생성 | 마지막 선택 캐시를 draft에 주입 | 직전 선택이 활성 |
| 기존 세션 로드 | 세션의 `agentKind` 복원 | 세션 고유 종류가 활성 |
| 확장자 지원 편집 카드 | old/new 축을 별도 문법 토큰화 | 키워드·문자열 등 언어 강조 |
| 확장자 미지원/경로 부재 | 평문 diff 폴백 | 내용·상대 줄번호는 유지 |

### 파생 UX / 엣지케이스

- 설정 읽기가 비동기이므로 부팅 중 사용자가 먼저 고른 값을 늦은 읽기가 되돌리지 않는다.
- 설정 쓰기 실패는 선택 자체를 롤백하지 않으며 다음 부팅만 기본/이전 디스크 값으로 폴백한다.
- 다중 세션, 테마, 복사 동작은 기존 계약을 유지한다. 구문 강조는 현재 테마 변경을 따라간다.

## 6. 범위 / 비범위

- 범위: renderer draft seed, Settings 공개 타입·스키마, 편집 도구 카드의 파일 경로·문법 토큰·old/new 상대 축.
- 비범위: 기존 세션 종류 변경, 파일을 추가 read하여 절대 줄번호 계산, Git 우측 패널 UI 변경, 신규 언어/의존성 추가.

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 설정 없는 첫 실행의 랜딩은 Work 활성이다. | Settings 기본값과 bootstrap된 draft의 버튼 상태 단언 | SettingsStore→settings IPC→chat bootstrap→AgentModeToggle |
| R-02 | AT-02 / AC2 | 마지막 명시 선택이 새 대화·앱 재시작에 복원되고 기존 세션은 자체 종류를 유지한다. | 선택→patch, 늦은 bootstrap 경쟁, NEW_CHAT/freshEntry, LOAD_SESSION 사례 단언 | toggle→chatActions→store/cache/settings→draft; session.load→reducer |
| R-03 | AT-03 / AC3 | 지원 확장자의 Write/Edit/MultiEdit 카드가 Read·Git diff와 같은 언어 판정과 테마 토큰을 쓴다. | TS/TSX fixture의 키워드 토큰 색상과 미지원 확장자 평문 폴백 단언 | tool registry→DiffBody→DiffTable→useDiffSyntax/extToLang→Shiki |
| R-04 | AT-04 / AC4 | Write/Edit/MultiEdit가 각 입력의 정확한 old/new 본문과 상대 old/new 줄 축을 표시한다. | 삽입·삭제·문맥·다중 edit fixture에서 본문과 두 축 번호 단언 | tool input→buildPairs→buildDiffLines→DiffTable |

## 7-A. V / Trace Matrix

- V mode: 상속할 단일 V가 없으므로 Baseline V1이다.

### Node registry

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-01~R-04 | R | §7 사용자 결과 | NEW |
| AT-01~AT-04 | AT | §7 행동 검증 | NEW |
| SD-01 | SD | 마지막 선택 seed와 비동기 경쟁 수명주기 | NEW |
| ST-01 | ST | bootstrap/새 draft/기존 세션 통합 사례 | NEW |
| AR-01 | AR | Settings→store→composer 생산자/소비자 경로 | NEW |
| IT-01 | IT | settings IPC와 store 배선 시험 | NEW |
| AR-02 | AR | 도구 입력→diff 파생→Shiki 렌더 경로 | NEW |
| IT-02 | IT | 실제 registry/body 렌더 시험 | NEW |
| MD-01 | MD | 상대 old/new 줄 축과 확장자 판정 | NEW |
| UT-01 | UT | 순수 diff/lang 단위 사례 | NEW |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-01~04 | R-01~04 ↔ AT-01~04 | REQUIRED | §7 각 도달 경로 | 버튼 상태·렌더 결과 직접 단언 | not selected — 행동 oracle | EP-01~04 |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | bootstrap→cache→draft/new/load | 지연 promise 순서를 제어한 통합 시험 | required — 늦은 settings 응답이 새 선택을 덮는 변이 | EP-01 (4) |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | schema→IPC→store action→draft | Settings roundtrip과 patch 호출 단언 | required — patch 또는 seed 한쪽 제거 변이 | EP-01 (4) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | registry→DiffBody→DiffTable→syntax | 실제 TS 편집 카드 token style 단언 | required — filePath 전달 제거 변이 | EP-02·03 (5) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | pair→buildDiffLines/extToLang | old/new 축 및 언어 순수 결과 | not selected — 직접 값 oracle | EP-03·04 (4) |

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| renderer/app 정적 | TS·React·경계 변경 | `cd app && npm run lint && npm run typecheck` | 신규 error |
| 관련 Vitest | 비DB 순수/렌더 경로 | `cd app && ./node_modules/.bin/vitest run <관련 suite>` | 신규 실패 |
| repository/message-bus | plan·INDEX·커밋 | doc inventory, `git diff --check`, trailer parse | 이번 산출물 위반 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 기본 draft는 `DEFAULT_AGENT_KIND`를 복사하고 선택은 reducer 메모리에만 있다. | `chatReducer.ts`, `chatStore.ts`, `AgentModeToggle.tsx` |
| SettingsStore는 스키마 기본값, patch, 캐시를 이미 제공한다. | `shared/{ipc,protocol}.ts`, `main/infra/settings-store.ts` |
| Read는 `file_path→extToLang→CodeBlock`을 사용한다. | `FileBody.tsx`, `lib/lang.ts` |
| 편집 카드 registry는 Write/Edit/MultiEdit를 `DiffBody`로 보낸다. | `toolMeta.ts`, `transcript/registry.ts` |
| 도구 `DiffTable`은 `buildDiffLines`만 쓰고 file path와 syntax token이 없다. | `DiffBody.tsx`, `DiffTable.tsx` |
| Git diff는 `useDiffSyntax(lines,filePath)`로 old/new 축을 따로 토큰화한다. | `FileDiffSection.tsx`, `useDiffSyntax.ts`, `diffSyntax.ts` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `DiffTable` 생산 호출 | `rg -n '<DiffTable' app/src/renderer/src/features/chat` | 1 | 도구 카드 한 곳만 prop 확장 |
| 편집 도구 variants | `FILE_EDIT_TOOLS`와 `DiffBody.buildPairs` 대조 | 3 | Write/Edit/MultiEdit 전부 적용 |
| draft 생성/리셋 축 | `freshEntry`, `NEW_CHAT`, 초기 store 검색 | 3 | 마지막 선택 seed 강제 지점 |
| 세션 kind 확정 축 | `SET_AGENT_KIND`, `session.updated`, `LOAD_SESSION` 검색 | 3 | draft 선택과 이력 복원 분리 |

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
DEFAULT_AGENT_KIND(code) → initialChatState → freshEntry/NEW_CHAT → AgentModeToggle
toggle → SET_AGENT_KIND (메모리만)

tool input → DiffBody.buildPairs → DiffTable/buildDiffLines → 평문 <pre>
```

- 설정 응답과 draft mode가 연결되지 않고, 도구 diff는 파일 경로를 버린다.

### TO-BE

```text
Settings.lastAgentKind(default work) → bootstrap cache → draft seed → AgentModeToggle
toggle → SET_AGENT_KIND + cache 갱신 + settings patch
session.load → session.agentKind (항상 우선)

tool input + file_path → DiffBody pairs → DiffTable(filePath)
  → buildDiffLines → useDiffSyntax(old/new axis, current theme) → tokenized cells
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 상태 소유 | draft 자체 기본 Code | Settings가 마지막 랜딩 선택 소유 | VP-05·06 |
| lifecycle | 선택 휘발 | 선택 즉시 cache+patch, bootstrap 경쟁 보호 | VP-01·02·05 |
| diff 입력 | old/new만 | old/new+filePath | VP-07 |
| 렌더 | 평문 단일 축 번호 | 테마 syntax+명시 old/new 상대 축 | VP-03·04·07·08 |

### 핵심 책임 분리

| 모듈 | 책임 | 입력/출력 |
|---|---|---|
| Settings 계약/스토어 | `lastAgentKind` 검증·기본 Work·영속 | disk ↔ `AgentKind` |
| chatStore | 비동기 seed, 최신 선택 cache, draft 생성 | settings/action → ChatState |
| chatReducer | 세션 단위 유효 전이 | action → state |
| DiffBody | 도구별 정확한 pair와 file path 추출 | ToolCall → pairs/path |
| DiffTable/diffSyntax | 줄 파생과 언어별 old/new token 렌더 | pair/path/theme → table |

## 10. 계약 / 타입 / 강제 지점

| EP / Pair | 계약 | SSOT | 누가 / 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| EP-01 / VP-01·02·05·06 | 마지막 랜딩 종류, 기본 Work | `Settings.lastAgentKind` | schema 기본; bootstrap seed; 선택 cache+patch; 새 draft 생성 (4) | 첫 실행/재시작/경쟁 중 잘못된 버튼 |
| EP-02 / VP-03·07 | 언어 판정 | `extToLang`+Shiki `isLang` | DiffBody가 path 전달; DiffTable이 hook 호출 (2) | 편집 카드만 평문 또는 잘못된 언어 |
| EP-03 / VP-03·04·07·08 | 편집 내용과 old/new 축 | `buildPairs`+`buildDiffLines` | 3 tool variant 파싱; table token cell 렌더 (4) | 타깃 본문/줄 축 왜곡 |
| EP-04 / VP-04·08 | 절대 시작 줄을 추측하지 않음 | tool input shape | 라벨/시험; 파일 read 미도입 (2) | 실제 파일 위치처럼 보이는 거짓 숫자 |

- `lastAgentKind`는 필수 Settings 필드이며 디스크 부재/잘못된 값은 Work로 복구한다.
- Shiki 비지원 확장자는 token map이 비어 평문으로 렌더된다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | Settings 타입 | `lastAgentKind` 추가 | typecheck |
| `app/src/shared/protocol.ts` | 런타임 검증 | 기본 `work`, patch enum | schema test |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | mode cache/lifecycle | bootstrap seed, 선택 저장, draft seed | controlled promise/store test |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 새 대화 seed 수용 | 저장소가 넘긴 마지막 kind를 보존하는 전이 | reducer test |
| `app/src/renderer/src/features/chat/components/transcript/tool-bodies/DiffBody.tsx` | 도구 입력 파싱 | file path 전달, 3 variant pair 유지 | render test |
| `app/src/renderer/src/features/chat/components/DiffTable.tsx` | 도구 diff 렌더 | filePath 선택 prop, syntax token과 두 축 표시 | render test |
| 관련 `*.test.ts(x)` | 회귀 잠금 | AC1~4와 선택 변이 | Vitest |

### 테스트 가능성

- 기존 `diffLines`, `diffSyntax`, `lang` 순수 seam을 재사용하고 Electron/DB는 로드하지 않는다.
- settings 읽기 Promise를 수동 resolve해 사용자가 먼저 선택한 경쟁을 재현한다.
- 토큰 렌더는 실제 highlighter 결과의 style 존재와 원문 보존을 함께 단언한다.

## 12. End-to-end 영향

```text
settings disk → SettingsSchema → settingsApi.get → chatStore mode cache → draft → toggle
toggle → reducer + cache → settingsApi.set → next bootstrap

ToolCall → registry → DiffBody → DiffTable → diffLines/diffSyntax → DOM
```

- producer 기준은 세션 이력에는 `session.agentKind`, 새 랜딩에는 `Settings.lastAgentKind`다.
- consumer는 두 값을 합성하지 않고 draft/loaded session 경계에서 하나만 선택한다.
- 부팅 등록 수나 IPC 채널은 증가하지 않는다.

## 13. Lifecycle / 오류 / 정리

- 시작: 설정 응답 전 임시 draft는 Work이며 응답 후 아직 사용자가 선택하지 않은 draft만 seed한다.
- 선택: UI 전이를 먼저 적용하고 캐시·비동기 patch를 수행한다.
- 설정 실패: 현재 프로세스 cache는 유지하고 오류 때문에 composer를 막지 않는다.
- 세션 로드: 저장된 session kind가 최우선이며 last kind를 갱신하지 않는다.
- 다중 저장소: 현재 draft 메모리와 Settings 파일 두 쓰기다. patch 실패 시 현재 화면은 선택값, 재시작은 마지막 성공값이라는 허용 가능한 eventual 상태다.

## 14. 성능 / 상한 / 최적화

- 새 네트워크 요청은 없다. 설정 write는 사용자 선택 1회당 1회다.
- Shiki 입력 상한은 기존 도구 카드 본문 길이와 같고 old/new 두 축 토큰화는 기존 Git diff 알고리즘을 재사용한다.
- 같은 props의 줄 파생은 기존 `useMemo`를 유지하고 테마 토큰은 기존 hook lifecycle을 따른다.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음. IPC 채널과 외부 플러그인 계약은 바뀌지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 결과 |
|---|---|---|
| 세션이 `agentKind`를 영속하고 loaded session이 잠긴다 | 0224 구현·현행 reducer | 유지 |
| 도구 카드와 diff 타일은 줄 파생 SSOT를 공유한다 | `DiffBody.tsx` 0206 주석 | 유지·문법 렌더까지 재사용 확대 |
| renderer 4-layer·시맨틱 토큰 | renderer AGENTS | 유지 |
| Settings 공개 타입과 zod 검증 동시 변경 | 현행 settings-store | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 늦은 settings read가 클릭을 되돌림 | 사용자 선택 revision/cache guard 시험 |
| Edit 숫자가 절대 위치로 오인됨 | old/new 상대 축임을 DOM/aria에서 명시; 추측 금지 |
| syntax token과 word diff span 결합 복잡도 | 우측 Git diff의 axis token slicing을 재사용하고 원문 보존 시험 |
| 설정 키 확장이 fixture를 깨뜨림 | `SettingsSchema.parse({})` 기반 fixture와 전체 typecheck |

- 되돌리기 어려운 결정과 신규 의존성은 없다.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{ipc,protocol}.ts`
- `app/src/renderer/src/features/chat/{store,reducer,components,lib}` 관련 파일과 시험
- `docs/handoff/0228-composer-mode-memory-and-tool-diff-syntax/plan.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용 가이드: `app/AGENTS.md`, `app/src/renderer/AGENTS.md`.
- `cd app && npm run lint && npm run typecheck`
- `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat/store/chatStore.agentKind.test.ts src/renderer/src/features/chat/reducer/agentPolicy.r8.test.ts src/renderer/src/features/chat/lib/diffSyntax.test.ts src/renderer/src/features/chat/components/transcript`
- `cd app && node scripts/check-doc-inventory.mjs --check`
- `git diff --check`; 구현 커밋 후 trailer parse.
- 사람 실기: 두 테마에서 TS/TSX 편집 카드 시각 품질과 앱 재시작 복원 1회.

## READY self-review

- [x] ACTIVE 결정과 AC의 충돌이 없다.
- [x] AS-IS/TO-BE와 Delta가 같은 축으로 연결된다.
- [x] Baseline V의 모든 NEW 노드에 REQUIRED pair가 있다.
- [x] pair마다 production 경로·직접 oracle·§10 분모가 있다.
- [x] draft 생성 3축, 편집 도구 3종, `DiffTable` 호출부를 이번 턴에 전수 조사했다.
- [x] 순수 로직은 자동 시험으로 내리고 시각 품질만 사람 실기로 남겼다.
- [x] 신규 의존성·IPC 채널·DB 마이그레이션이 없다.

---

> **[구현자 기입]** 구현 턴에서 handoff-impl 절차에 따라 설계 리뷰, §10 전수,
> V-pair 자기확인, 선택 변이, AC 합계와 게이트 증거를 추가한다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: D-001~D-006, AC1~AC4, Baseline V1을 변경 없이 구현했다.
- 이견 / 현실성 문제: 없음. `DiffTable`이 이미 공유하는 `DiffLine`을 `useDiffSyntax`에 직접 전달해 우측 패널의 토큰화 경로를 재사용할 수 있었다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조, r1)

| Pair | 계약/필드 | §10 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---:|---:|---|---|
| VP-01·02·05·06 | 마지막 종류·기본 Work | 4 | 4/4 | schema 기본·bootstrap seed·선택 patch·`freshEntry`를 `rg`와 33-case suite로 관측 | — |
| VP-03·07 | 파일 언어 판정 | 2 | 2/2 | `DiffBody` path 전달·`DiffTable` hook 호출; render 3-case와 syntax 4-case | — |
| VP-03·04·07·08 | 본문·old/new 축 | 4 | 4/4 | Write/Edit/MultiEdit parser 3종·table 렌더 1곳; render 3-case | — |
| VP-04·08 | 절대 줄 추측 금지 | 2 | 2/2 | old/new nullable 축 셀·추가 파일 read 0건 확인 | — |

- 전수 검색: `rg -n 'freshEntry|NEW_CHAT|SET_AGENT_KIND|LOAD_SESSION|<DiffTable|FILE_EDIT_TOOLS|buildPairs' app/src/renderer/src/features/chat`.
- §10 밖에서 같은 불변식이 필요한 지점: 없음.

### V-pair 자기확인

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01~04 | REQUIRED | SELF_PASS | Settings·버튼 seed·도구 render 행동 시험 | not selected — 직접 결과 단언 |
| VP-05 | REQUIRED | SELF_PASS | 늦은 Code 설정 응답 뒤 최신 Work 유지 | revision guard 제거 시 1 red |
| VP-06 | REQUIRED | SELF_PASS | 기본 Work roundtrip·선택 patch payload | patch 제거 시 1 red |
| VP-07 | REQUIRED | SELF_PASS | 실제 DiffBody가 TS/TSX path와 token style 산출 | filePath 전달 제거 시 3 red |
| VP-08 | REQUIRED | SELF_PASS | parser 본문과 nullable old/new 축 값 | not selected — 직접 값 단언 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

| 심은 결함 | 출처 | 이전 결과 | 실패한 테스트 | 결과 |
|---|---|---|---|---|
| bootstrap의 선택 revision guard 제거 | VP-05 선택 증거 | 최초 | `does not let a late settings response...` 1건 | 잠김 |
| `settingsApi.set({lastAgentKind})` 제거 | VP-06 선택 증거 | 최초 | `persists an explicit landing choice...` 1건 | 잠김 |
| DiffBody→DiffTable `filePath` 전달 제거 | VP-07 선택 증거 | 최초 | `DiffBody.render` 3건 | 잠김 |

- 분모 검산: 선택 증거 3 · 인용 변이 0 · 새 구조 oracle 0 = 표 행 3; 3/3 red.
- 장치 교체/삭제: 없음.

## [구현자 기입] Product/UX 파생 검토 (r1)

- 설정 읽기 전 첫 프레임도 Work이며 늦은 응답은 사용자 클릭을 되돌리지 않는다.
- 설정 쓰기 실패는 현재 선택을 유지하며 composer를 무반응 상태로 만들지 않는다.
- 지원하지 않는 확장자와 문법 로드 실패는 기존 원문 diff로 폴백한다.
- 파생 이슈: 없음.

## [구현자 기입] 구현 결과 / 게이트 (r1)

- AC 자기합계: ✅ 4/4, 미충족 0. AC1 Settings 기본 Work; AC2 선택 patch·새 draft·loaded session 보존; AC3 syntax path/token; AC4 세 도구 본문·old/new 축.
- §10 합계: EP-01 4/4, EP-02 2/2, EP-03 4/4, EP-04 2/2.
- 게이트: lint 0 error, typecheck 3구성 통과, 관련 Vitest 6파일 33건 통과, transcript suite exit 0, doc inventory/prose/link 통과.
- 구현 커밋 좌표: `(r1 구현 — 좌표는 INDEX)`.
- 신규 의존성·IPC 채널·DB 마이그레이션: 없음.
- Review Signals: 없음. 다음 주체는 Claude 독립 검증이다.
