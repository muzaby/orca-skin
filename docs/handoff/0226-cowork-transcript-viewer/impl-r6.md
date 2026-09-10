# 0226 r6 구현 보고 — Delta V7

[정정 설계](correction-plan-r6.md)의 AC41·42 자기확인 2/2, VP79~82 SELF_PASS다. 기존 V의 비충돌 결과와 독립 verify pending을 승계한다.

## [구현자 기입] 설계 리뷰

도구 노출과 자동 승인을 분리했다. 대화 query의 `allowedTools: ['PowerShell']`을 제거하고 PowerShell을 기존 shell 승인 분류에 추가했다. SDK 기본 도구를 제한하는 `tools`는 지정하지 않고 Bash/WebSearch 제외를 유지한다. 설정 기본값·명시 환경값·permission mode·completion 도구 없음은 그대로다.

spark는 기존 `PendingAssistantStatus`를 재사용하여 카드 다음에 조립한다. `PendingAssistant`의 기본 호출은 본문과 status를 함께 유지하고, `AssistantTurn`만 `showStatus={false}`로 본문을 조립한다. 새 저장소·IPC·의존성은 없다.

구현 세부 조정: 카드를 PendingAssistant 안으로 옮기지 않고 기존 부모·위치를 유지했다. pending 전환에서 카드가 다시 mount되어 진행 중 저장 결과를 잃는 위험을 피하기 위해서다. 제품 결정·AC·V·§10 변경은 없다.

| 조정의 실패 축 | 확인 |
|---|---|
| 만료 | 해당 없음. 새 캐시·시간 조건·저장 상태가 없다. |
| 공유 | status는 기존 session 리프 구독을 사용한다. 첫 user/빈 transcript fallback은 기본 status 한 개를 유지한다. |
| 재진입 | pending true→false→true에서 일반/게시 카드 DOM, 저장 busy, 늦은 실패 결과와 성공 재시도 유지. native 직접 관측 |
| 무효화 | 늦은 part·목록 교체·reload에서 기존 소유권과 카드 갱신 경로 유지. reducer/store 및 native 직접 관측 |

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

| EP / 닫힘 | 생산 경로와 관측 |
|---|---|
| EP33 3/3 | conversation query: 기본 도구 무제한·Bash/WebSearch 제외·PowerShell 자동 승인 없음. `claude.executable-option.test.ts`의 Work/Code 실제 옵션과 콜백 결과 |
| EP33 계속 | 권한 분류/callback: `risky-tools.test.ts`와 `claude.canusetool.test.ts`의 승인·updatedInput·거절·interrupt·signal. completion: query의 빈 tools/allowedTools 유지 검사 |
| EP34 4/4 | pending 합성, assistant 없는 두 fallback, 완료 메타/카드, 늦은 카드 갱신. `TurnOutputCards.test.ts`와 native의 DOM·수직 순서·단일 spark·완료/재시작 왕복 |

검색은 `rg "allowedTools|disallowedTools|PowerShell|canUseTool|tools: \[\]" app/src/main/adapters/{claude.ts,risky-tools.ts,claude-adapt.ts}`와 `rg "PendingAssistant|PendingAssistantStatus|ArtifactCards" app/src/renderer/src/features/chat/components/transcript`를 기준으로 호출부와 분류 소비자를 대조했다. 실제 PowerShell 승인 전달은 query 옵션에 연결된 callback을 호출하여 확인했다.

| pair | 자기결과 / 증거 |
|---|---|
| VP79 REQUIRED | SELF_PASS — 두 profile의 실제 query 옵션과 PowerShell 승인/거절 callback |
| VP80 REQUIRED | SELF_PASS — user→확정/live 본문→일반/게시 카드→spark; SSR 및 native Work/Code |
| VP81 REQUIRED | SELF_PASS — 기본 도구 노출/권한 분리와 공통 pending/fallback 경로. 카드 DOM·진행 중 액션 수명 유지 |
| VP82 REGRESSION | SELF_PASS — 원래 턴·중복·메타·reload·idle·설정 우선순위·completion. Temp 수집·원본 검사 코드는 무변경이며 r5 증거 승계 |

| AC | 자기확인 / 관측 |
|---|---|
| AC41 | ✅ Work/Code 자동 승인 없음, 실제 승인·거절 전달, SDK 기본 도구 및 제외·활성화 기본값 유지 |
| AC42 | ✅ 두 화면의 본문·카드·spark DOM/수직 순서와 첫 응답·늦은 카드·reload·idle·액션 상태 검사 |

✅ 2 · ⚠️ 0 · ❌ 0 = 이번 Delta AC 총 2. 이전 r5의 AC36~40 분모와 합산하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금

별도 변이는 해당 없음 — 실제 query 옵션·승인 반환값·React/native DOM을 직접 관측한다. 수정 전 새 정책 단언 9건, SSR 순서 2건이 red였고 native도 순서 oracle에서 red를 관측했다. 구현 후 통합 결과와 native가 green이다.

선택 적대 증거 0 · 인용 변이 0 · 새 구조적 proxy oracle 0 = 잠금 표 행 0. native manifest는 기존 r5 방식의 증거 현재성 검사이며 사용자 행동 oracle은 실제 DOM이다.

## [구현자 기입] Product/UX 파생 검토

진행 상태의 순서만 변경하고 idle/background ready의 spark 숨김은 유지했다. 새 문구나 승인 모드는 추가하지 않는다. 늦은 일반 출력은 원래 턴에 남고 게시 카드는 같은 공통 카드 UI를 사용한다. 새 요청이 다시 시작되어도 카드 저장 버튼의 busy와 실패/재시도 상태가 유지된다.

## [구현자 기입] 놓친 잠재 문제와 대응

PowerShell은 SDK 자동 승인 옵션만 제거해도 기존 안전 도구 fallback에서 승인 없이 통과할 수 있었다. 기존 위험 도구 분류에 추가하고 실제 query callback을 통해 승인/거절 경로를 잠갔다. 코드 리뷰에서 추가 수정이 필요한 확정 finding은 없었다.

실제 모델의 원격 PowerShell 실행 성공은 이번 증거에 포함하지 않는다. 설치 SDK 옵션 계약과 생산 adapter의 query/권한 콜백을 검증했다. native는 실제 renderer와 합성 IPC/reload payload를 사용하며 Main/DB 계보는 r5 증거를 승계한다.

## [구현자 기입] 구현 보고

| gate | 관측 |
|---|---|
| 최종 Vitest | 10파일 **198/198**, 실패 0. [로그](evidence/r6-vitest.log) |
| 타입 | node·web·test 모두 exit 0 |
| ESLint / Prettier | 변경 app/src TS/TSX scoped 검사 통과, lint error/warning 0 |
| Native | **46/46**, 9장, runtime/browser/console 오류와 외부 요청 0. [결과](evidence/r6-turn-native.json) |
| 시각 | [Work](evidence/r6-turn-work-live.png)·[Code](evidence/r6-turn-code-live.png) 캡처에서 카드 아래 spark 확인 |
| 증거 현재성 | [manifest](evidence/r6-turn-manifest.json)의 소스·CSS 237개를 현재 파일과 대조, 불일치 목록 `[]` |
| Build | electron-vite main/preload/renderer exit 0. 기존 SubAgentTileContent 정적/동적 import 경고 한 건 유지 |
| 운영 | inventory·test budgets·whitespace 통과. 새 의존성·ABI rebuild 없음 |

최종 Vitest 집합은 `risky-tools`, `claude.canusetool`, `claude.executable-option`, `claude-adapt`, `harness-config`, `scaffold`, `TurnOutputCards`, `chatReducer.artifacts`, `chatStore.artifacts`, `statusLine.render`다. 처음 통합 명령에서 reducer/store 경로를 잘못 지정하여 8파일만 실행된 결과는 최종 증거로 사용하지 않았다. 파일 존재를 먼저 확인한 수정 명령으로 10파일 실행을 확인했다.

## [구현자 기입] Review Signals

- r6은 사용자 정정에 따른 동일 축의 변경이다. r5의 명시 결정 D31·D33은 D36·D35로 대체됐다.
- 권한 분류 fallback과 카드 mount 수명은 코드 조사에서 확인하여 기존 경로 안에서 처리했다.
- 새 환경 차단은 없다. 기존 ABI를 유지하고 해당 집합은 직접 Vitest로 실행했다.
- 현재 라운드 6. 독립 코드 리뷰는 handoff verify를 대체하지 않으며 보드는 검증자 차례로 넘긴다.
