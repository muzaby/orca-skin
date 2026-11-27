# 0334 · 실행 주체 분리 이후 남은 코드 정리

| 항목 | 값 |
| --- | --- |
| 상태 | plan / **DRAFT** · V1 + ΔV1 · 라운드 1 · 2026-11-27 |
| 대상 브랜치 / 제품 기준 | `ccr-59ce68d5-h1xutf` · `e2de23774057e208630eadd920a9648cf0b7f164` |
| 선행 문서 | `codex-0334-post-migration-cleanup`의 `149c7465`. 기존 D1~D4와 V1의 네 pair를 이어서 구체화한다. |
| 다음 주체 | 0333 완료 후 설계자와 사용자가 이 브랜치의 최종 호출자·외부 포트 계약을 다시 검토한다. 구현 착수 판단은 그때 한다. |

## 1. 사용자 계약과 결정

Claude와 OpenCode 사용자가 예전 대화를 열고 이전 턴을 더 읽을 때, 보고 있던 문장과 진행 중 응답이 보존되어야 한다. 정리 대상은 이주가 끝난 **실행 경로**다. 설치된 DB를 복구하는 경로, 하네스별 화면 차이, 과거 버전을 재는 측정기는 각각 실제 소비자가 있다.

| 결정 | 상태와 출처 | 구현 및 검증 계약 |
| --- | --- | --- |
| D1 | ACTIVE · 기존 0334 및 첨부 조사 범위 | 삭제 단위는 파일 또는 심볼이다. 변경 파일 밖의 호출자, 채널 등록·타입·mock·문자열 계측을 포함한다. AC1, AC4 |
| D2 | ACTIVE · 기존 0334 및 0324 실행 모델 | 한 책임에는 한 실행 소유자를 둔다. 공통 모듈은 두 호스트 bootstrap이나 두 하네스를 함께 import하지 않는다. AC2, AC8~10 |
| D3 | ACTIVE · 기존 0334 및 0325~0330 | 세션·선택·Work·Code·복사·fork·산출물의 사용자 결과와 크기·가시 범위 상한을 보존한다. AC3, AC5~9 |
| D4 | ACTIVE · 기존 0334 | 원본·로컬 저장·구 설정과 독립 비교 fixture를 보존한다. AC4, AC9~11 |
| D5 | ACTIVE · 사용자 “Draft 상태로 생성할것. 333 완료 후 다시 검토한 후 진행 예정.” | 과거 V1의 READY를 이번 DRAFT로 대체한다. §11의 재검토가 다음 작업이다. |
| D6 | OPEN · `IPC_CONTRACT.md`의 직접 포트 계약 | 지원되는 외부 소비자에 따라 구 채널 제거 또는 호환 경로 유지로 범위가 갈린다. §9의 해소 조건을 적용한다. AC4, AC11 |

### 인수 조건

합격 기준은 구현 후 같은 입력으로 관측한다. 아래의 §10 번호는 실제 경로와 실행 명령을 연결한다.

| AC | 사용자 시나리오와 관찰할 결과 | §10 |
| --- | --- | --- |
| AC1 | 삭제 후보를 다시 찾으면 제품·테스트·현재 측정기에 폐기한 경로가 남지 않고, 옛 Git 트리에서는 당시 경로로 같은 입력을 잴 수 있다. | E1, E4, E7 |
| AC2 | 앱을 켜면 데이터 → 에이전트 순으로 준비되고 설정 조회와 턴 전송이 각 호스트에 도달한다. 셸의 전이 의존 그래프에 SDK·DB가 없고 sandbox preload가 `ooBridge`를 노출한다. | E2, E6 |
| AC3 | Claude Work·Code와 OpenCode에서 기존 세션을 열고 위로 이동해 이전 이력을 추가한다. 직전에 읽던 메시지 키와 화면 위치, 같은 시각에 작성된 서로 다른 메시지, 피드 표시 설정이 유지된다. 끝에 있던 사용자는 해당 하네스의 스크롤 규칙을 따른다. | E1, E3, E5 |
| AC4 | 빈 세션·삭제된 세션·구 DB를 각각 열고 호스트를 재접속한다. 빈 세션은 정체성을 유지하고 없는 세션은 missing/null이다. 갱신 실패 시 이미 보이던 이력을 읽을 수 있고, 뒤늦게 끝난 조회가 새 활성 세션이나 라이브 상태를 덮지 않는다. | E5, E6 |
| AC5 | A에서 답변을 받다가 B로 전환한 뒤 A로 돌아온다. A의 본문·도구 결과가 한 번씩 이어지고 B에 섞이지 않는다. 과거 블록을 매 델타마다 재생성하지 않는다. Claude Work에서 도구 묶음을 접고 펴거나 질문에 답할 수 있고, 경계 없는 구 대화도 읽을 수 있다. | E1 |
| AC6 | transcript·diff·산출물에서 텍스트를 선택하고 복사한다. 마운트 집합이 안정적이면 브라우저 기본 복사가 선택한 문자열을 준다. 선택 중 가상 행이 새로 마운트되면 선택이 취소되고 같은 드래그 중 복원되지 않는다. 패널 밖 선택은 보존된다. | E3 |
| AC7 | 턴 복사 버튼을 누르면 해당 턴의 비어 있지 않은 텍스트가 순서대로 복사된다. 큰 텍스트 조합은 클릭 때 수행한다. Claude의 fork는 기존 허용 턴·세션에서 동작하고 OpenCode는 기존 지원 정책을 따른다. 산출물 카드는 해당 턴에 표시되고 재개 후에도 저장한 파일을 열 수 있다. | E1, E6 |
| AC8 | 도구 카드·파일 패널에서 작은 diff와 큰 diff를 연다. 작은 입력은 제한 안에서 줄·통계를 표시하고, 큰 입력은 문서 참조와 가시 행으로 스크롤·좌우 강조·줄 위치 이동을 처리한다. 도중 파일·테마 변경 또는 워커 실패 시 이전 결과가 새 화면에 섞이지 않고 원문/해당 실패 표시를 쓸 수 있다. | E4 |
| AC9 | Work 산출물을 게시하고 설정·모델·스킬 목록을 다시 연다. 저장 성공 후 원래 세션에 게시되고, 취소·실패 시 유령 카드가 생기지 않는다. 온전한·없는·깨진 manifest와 옛 설정의 현재 해석, 두 하네스의 서로 다른 본문·추론·도구 표시가 보존된다. | E1, E6 |
| AC10 | 호스트의 정상·실패 기동과 종료를 거친다. 호스트별 ready·오류·종료가 한 번씩 전달되고, 초기 설정 사본이 도착하기 전에 보낸 요청도 올바른 호스트에서 끝난다. | E2 |
| AC11 | 네이티브 원본이 사라진 구 DB 세션에서 다음 입력을 보낸다. 보관 대화로 복구하고 원래 raw·표시 메시지·순서·중복 방지 정보가 유지된다. 세션을 바꾸면 이전 페이지 요청만 취소되며 취소 통지가 다른 창의 같은 번호에 영향을 주지 않는다. | E5 |

## 7-A. V 추적

기존 V1(`149c7465`)의 네 경로를 기준으로 한 Delta V다. 왼쪽과 오른쪽 노드의 상태를 함께 표기했다. 사용자 결과는 REGRESSION으로 다시 관찰하고, 변경할 내부 경계는 REQUIRED로 확인한다. 조건부 삭제의 최종 자리 목록은 D6 판정 뒤 고정한다.

| Pair / 노드 | 상태 · 의무 | 제품 경로와 직접 판정 위치 | AC |
| --- | --- | --- | --- |
| VP-01 · R1 ↔ AT1 | INHERITED · REGRESSION | 두 하네스 세션 열기·라이브·선택 → Timeline/패널 → 실제 DOM·클립보드·카드. E1·E3·E4·E6의 화면 시나리오 | 3, 5~9 |
| VP-02 · SD1 ↔ ST1 | CHANGED · REQUIRED | 호스트 재접속/세션 전환 → 공개 load·refresh·cancel → DB 페이지 → store. 네이티브 소실 → archive → 복원. E2·E5 | 2~5, 10, 11 |
| VP-03 · AR1 ↔ IT1 | CHANGED · REQUIRED | 셸/다리 → 호스트 포트·피어 → 등록된 작업, renderer → 문서 등록 → 워커 응답 → 가시 행. E2·E4~E7 | 1, 2, 4, 7~11 |
| VP-04 · MD1 ↔ UT1 | CHANGED · REQUIRED | 증분 블록·선택·상한·설정 파서·구 DB 행 → 현재 소비자. E1·E3~E7의 분기 입력 및 증거 | 1, 3~9, 11 |

## 8. 기준선과 호출 경로 조사

착수 시 `git ls-remote origin refs/heads/{main,ccr-59ce68d5-h1xutf,codex-0334-post-migration-cleanup} refs/pull/656/head`를 확인했다. main은 `d8684684`이고 요청 브랜치와 PR #656은 `e2de2377`이다. 0330 r3 구현 `07377db7`이 이 커밋의 조상이며 두 커밋의 `app` 트리는 모두 `39e318f5`다. `149c7465`는 `e2de2377` 위에 문서만 더한 커밋이다.

| 근거 | 재현 방법 / 관찰 |
| --- | --- |
| 이주 전후 | `git diff --name-status --find-renames a9ce2426 e2de2377 -- app/src app/scripts`에 1,031행. [도달 검사](evidence/reachability.mjs)는 셸·두 호스트·preload·renderer에서 정적 import·재수출·리터럴 동적 import/require와 Worker URL을 따라간다. 변경 소스 중 비도달은 Claude `Exchange.tsx`·`AssistantTurn.tsx`, OpenCode `projection.ts`, `useDiffLines.ts`다. |
| 변경 밖 역추적 | 같은 도구에 `--all`을 주면 미변경 소스도 출력한다. `git grep -n createWorkOutputFiles a9ce2426 -- app/src`에는 구 bootstrap 호출, 현재는 정의만 있다. 같은 스크립트를 이주 전 checkout에서 `--all --before-0324`로 실행하고, 각 출력의 `^app/` 행을 정렬해 `comm -13 이전 현재`로 비교했다. 위 네 경로와 `features/artifacts/output-files.ts`가 두 비도달 목록의 차이다. `useDiffLines`는 0324 도중 생겨 `671ee43d`의 실제 카드 호출까지 확인했다. |
| 셸·호스트 | `electron.vite.config.ts` → `main/index.ts`의 `createHostBoot`·감독자 → 각 `entry.ts`의 `runHostProcess` → 자기 `bootstrap.ts`. 창 포트는 `host-port-server`, 피어 저장은 `persistence-sender/receiver`. SDK의 실제 동적 로드(예: `adapters/claude/sdk.ts`)와 데이터 전용 설정 import를 별도로 확인했다. |
| 창·워커 | `preload/index.ts`의 `ooBridge` → `renderer/src/main.tsx`의 API 설치 → `shared/api/transport/oo.ts`가 소유 표를 보고 포트를 택한다. `chat/harnesses/registries/transcript.tsx` → 두 Timeline → 각 증분 모델 → `TranscriptViewport`. `shared/compute/client.ts`의 `new Worker(new URL(...))`에서 compute·markdown·image 세 레인에 도달한다. |
| 측정·문서 | 정적 그래프 밖의 `vi.mock`, `readFile` 소스 가드, `SOURCE_MODULES/priorTranscriptModules`, Stage E 직접 포트, `IPC_CONTRACT.md`의 load·chunk·cancel 행을 별도 대조했다. 타입 재수출과 테스트 호출만으로 제품 도달을 확정할 수 없다. |

### 선행 핸드오프의 검증 범위

| 계획 / 검증 | 승계할 관찰 또는 경계 |
| --- | --- |
| [0324 계획](../0324-execution-contexts-ui-responsiveness/plan.md) · [검증](../0324-execution-contexts-ui-responsiveness/verify.md) | 셸·preload, 두 호스트의 기동·재접속·종료, 표시와 저장의 분리. |
| [0325 계획](../0325-ui-responsiveness-followup/plan.md) · [검증](../0325-ui-responsiveness-followup/verify.md) | 제한 계산·작업량 계측. 옛 데이터 전송과 현재 페이지의 표본 크기를 따로 기록한다. |
| [0326 계획](../0326-transcript-incremental-model/plan.md) · [검증](../0326-transcript-incremental-model/verify.md) | 증분 모델, 메시지 키, 라이브 세션 격리, 공통 가상 뷰포트와 선택 취소. |
| [0327 계획](../0327-worker-protocol-visible-views/plan.md) · [검증](../0327-worker-protocol-visible-views/verify.md) | 레인·문서 버전·가시 범위·토큰 예산, DOM 기본 복사. D-039 긴 코드 펜스 가상화는 별도 후속이다. |
| [0328 계획](../0328-composer-panels-lists-shell/plan.md) · [검증](../0328-composer-panels-lists-shell/verify.md) | 패널/목록의 선택 소유자와 셸 작업량. |
| [0329 계획](../0329-turn-history-paging/plan.md) · [검증](../0329-turn-history-paging/verify.md) | 최신/이전 턴, 표적·지연 본문, 실시간 상태 우선. 첫 페이지에서 전체 native snapshot 읽기·raw 분리 금지. |
| [0330 계획](../0330-windows-responsiveness-verdict/plan.md) · [검증](../0330-windows-responsiveness-verdict/verify.md) | **WU-M 기계 PASS**(verify 3). **WU-W Windows 실측 대기**. W-004 사전 합의와 H1 필수 셀 고정 뒤 측정한다. 0334의 Linux 검사 결과는 이 칸을 닫지 않는다. |
| [0331](../0331-transcript-feedback-followup/plan.md) · [0332](../0332-right-panel-global-depth/plan.md) · [0333](../0333-global-plugin-mcp-turns/plan.md) | 0331은 큰 완료 Markdown의 워커 이주·당김·첫 화면, 0332는 패널 폭·스택·복원, 0333은 다음 입력에 적용할 SDK 플러그인/MCP 선택을 소유한다. 현재 INDEX에서 셋은 plan/READY다. 이들이 바꾼 최종 동작을 0334의 회귀 기준으로 삼는다. |

### 후보별 판정표

경로의 `chat/`는 `app/src/renderer/src/features/chat/`, `compute/`는 `app/src/renderer/src/shared/compute/`, `main/`과 `shared/`는 `app/src/` 아래다. 삭제 9행, 부분 삭제 12행, 공통화 2행, 조건부 3행, 유지 10행이다. 한 행에 묶은 심볼은 소유자·처분·선행 조건이 같다. E 번호는 §10의 테스트 진입점이다.

| 파일·심볼 | 이전 호출자 / 남은 소비자 | 현재 실행 소유자와 대체 경로 | 판정 | 삭제·이관 전제와 회귀 검증 |
| --- | --- | --- | --- | --- |
| T1 · Claude `transcript/Exchange.tsx`·`AssistantTurn.tsx` | 구 Timeline → Exchange → AssistantTurn. 현재 직접 소비는 구 화면 테스트 | renderer `createClaudeBlockModel.advance → TranscriptViewport → Timeline`의 블록별 표시 | 삭제 | 테스트를 먼저 이전한다. E1의 예약 공간·pending/반환 입력·복사·마지막 턴 fork·카드 단언 |
| T2 · 같은 디렉터리 `WorkActivity.tsx:WorkActivity` | AssistantTurn과 테스트가 메시지 전체를 다시 투영. 같은 파일의 `ActivityDisclosure`는 현재 Timeline이 호출 | `claudeBlocks.ts`가 `createWorkProjector`를 턴별 보유 → activity 블록 → `ActivityDisclosure`·`WorkToolTimeline` | 부분 삭제 | 구 래퍼와 전용 imports만 제거. E1의 그룹 접기·질문·늦은 결과·경계 없는 이력 |
| T3 · `chat/lib/turns.ts:groupTurns, visibleMessage, turnRenderKey, exchangeRenderKey, exchangeEquals` 및 타입 `Exchange, TranscriptProjectionOptions` | 구 groupExchanges/Exchange·OpenCode 전체 투영, turns 테스트. `exchangeRenderKey`도 현행 행 생성자가 읽지 않음 | renderer 블록 모델의 피드 필터·안정 키·변경 기록이 대체 | 부분 삭제 | T1·T5와 함께 정리. E1에서 자동 피드 on/off, 같은 시각 다른 ID, prepend 키·DOM 유지 |
| T4 · 같은 파일 `Turn, turnEquals, turnCopyText` | 구 AssistantTurn도 사용. 현행 공통 `UserTurn`이 타입·memo 비교·복사, 양 Timeline의 `MessageMeta`가 복사 사용 | renderer의 현재 사용자 턴 및 메타 블록 | 유지 | E1에서 동일 턴의 불필요한 렌더, 실제 버튼 클릭 시 공백/대용량 텍스트·소유 턴 검사 |
| T5 · OpenCode `transcript/projection.ts:projectTimeline, materializeTimelineRows, TimelineRow, TimelineLivePresence` | 과거 Timeline, 현재 `projection.test`와 `Timeline.selection.test`의 타입. `TimelineLivePresence`는 선언만 존재. 과거 측정은 파일명을 문자열로 사용 | `createOpenCodeBlockModel → advance → blockAt → OpenCodeTimelineRow`가 보이는 행과 라이브 본문을 결합 | 삭제 | 타입 사용은 `OpenCodeBlock`으로, 전체 열거 단언은 reset·append·prepend·현행 행으로. 증분 모델을 검증하는 `projection.golden.test` 유지. E1·E7 |
| T6 · `chat/lib/parts.ts:messageSegments` | 구 메시지 전체 투영, parts·editPreview 테스트 및 옛 트리 성능 표본 | renderer의 `segmentCache.segmentsFor`가 `segmentForPart/extendSegment` 등을 사용. 두 블록 모델·Work projector·공통 `AssistantMessage`(서브에이전트 상세 포함)가 소비 | 부분 삭제 | 일괄 래퍼만 제거. 단일 파트·도구 결과 병합·캐시의 이전 수정 위치 기록 보존. E1의 순서·서명·결과 변경 및 E7 이전/현재 표본 |
| T7 · 두 하네스 `transcript/AssistantSegment.tsx`의 `compact, fork, subagent_notice` | 양쪽 switch가 같은 marker/notice와 props 전달 | renderer `harnesses/common/transcript`에 세 변형의 표시를 두고 양 하네스에서 호출. 본문 원천 위치·추론·오류·질문·도구/Work 표현은 각 하네스가 소유 | 공통화 | 공통 쪽에서 하네스 import·새 상태 구독 없이 trigger, 전후 토큰, toolRunId·status·duration·summary·policy 전달. E1 양쪽 실제 행 |
| W1 · `chat/hooks/useDiffLines.ts`와 `DiffLinesRequest` | 이주 중 Claude `DiffBody`·OpenCode `ToolBody`가 두 전체 문자열을 전송. 현재 `useDiffCompute.test` | 소형 pair는 `diffLinesWithinCap`, 큰 pair는 문서 등록 → `diffView` → 가시 행. 실제 jsdiff `diffLines`는 워커 모델 및 제한 내 계산에서 사용 | 삭제 | W3와 함께 전용 훅·상태/요청만 제거. E4 소형과 대형 콘텐츠를 실제 카드에서 검사 |
| W2 · `useDiffSyntax.ts:useDiffSyntax`, `lib/diffSyntax.ts:diffTokensRequest, mapDiffTokens, AXES, axisLines, axisText` | 구 DiffTable/FileDiffSection가 old/new 문자열 전체를 만들고 옛 훅이 `diffTokens` 요청. 현행은 context·타입만 소비 | `useSmallDiffSyntax/useWindowTokens`, 큰 모델의 축 참조 → `tokens` 범위. `DiffSyntaxContext`와 `DiffSyntaxTokens`를 현행 렌더 소유 모듈에서 제공 | 부분 삭제 | 두 축을 매칭하는 현재 로직·context provider/reader 유지. E4: 좌우 문법 상태, 지원/미지원, 공백·테마 전환. 오류 수집 가드 `reportSites.registry.test`의 옛 catch 좌표 동시 갱신 |
| W3 · `compute/protocol.ts, worker/handler.ts`의 `diffLines/diffTokens` | 위 두 훅 → client → compute worker. 잔여 입력은 client·handler·diffSyntax 테스트 | 문서 등록/해제, `diffView/diffLocate/diffContext/tokens` 및 worker/state의 실제 줄 계산 | 부분 삭제 | 두 request interface/union, `ComputeResults`, `requestKey/requestSize`, `resultSize`의 전용 `lines`·`old/new` 분기와 handler cases 동시 제거. `TokenRows`·범위 응답 비용·cache/cancel/우선순위·Shiki highlight 유지. E4 |
| W4 · `compute/codeView.ts, diffView.ts, protocol.ts:charsBefore` | 예전 가상 복사 계약의 접두 글자 수. 현재 두 생산자와 결과 타입·fixture/단언에만 존재 | DOM 기본 복사. `textChars`는 코드/레이아웃의 전체 본문 문자 메타(줄바꿈 제외), code의 starts·chars 차이는 해당 줄 문자열 절단, diff positions는 locate에서 사용 | 부분 삭제 | 입력 문서의 `chars/lines` 표본으로 `requestSize`가 작업량을 추정한다. 이는 응답 `textChars`의 UI 읽기와 별개다. 전체 길이·줄 좌표 보존 후 접두 필드만 제거. E3·E4 CRLF·빈 줄·좌우 짝·접힌 gap·0 밖 시작점 |
| W5 · `diffModel.ts:countLines`·`inline.ts:diffStatWithinCap` | 전체 줄 수 유틸과 한 쌍 통계용 래퍼. 현재 inline 테스트가 직접 사용 | `countLinesUpTo/withinDiffCap/diffLinesWithinCap` 및 `diffStatsWithinBudget`가 소형 렌더와 OpenCode 파일 통계를 담당 | 부분 삭제 | 테스트의 단일 pair/합산/초과·대형 한 줄을 현행 API로 옮긴다. E4 |
| W6 · `common/transcript/DiffLinesStatus.tsx` | 구 훅과 이름이 비슷하나 `DiffTable`·`FileDiffSection`의 가시 모델 대기에 실제 표시 | renderer 모델 초기 응답을 기다리는 상태 | 유지 | E4에서 첫 응답 전·성공/실패 화면을 구분 |
| H1 · `main/features/artifacts/output-files.ts:createWorkOutputFiles` | `a9ce2426:main/app/bootstrap.ts`에서 서비스와 게시 함수를 주입. 파일은 전후 동일하지만 현재 호출자는 없음 | `agent-host/bootstrap.prepareOutputFiles`가 작업 디렉터리·실제 세션을 획득 → `data.query.captureOutput` → `data-host/data-ops` 등록 → `ArtifactService.captureOutput`이 파일·DB 등록 → 에이전트가 취소 여부 확인 후 `artifact.published` → 창의 턴 카드 | 삭제 | 데이터 호스트의 파일 검증·등록과 에이전트의 게시 순서를 보존. E6 성공/취소/내용 불일치 |
| H2 · `main/adapters/claude/output-files.ts:makeOutputFilesHook` | Claude `adapter.ts`가 SDK 훅을 조립하고 `outputFiles.capture` 호출 | 에이전트의 SDK 도구 완료가 H1의 새 경로로 산출물을 보낸다 | 유지 | 훅에서 실제 capture로 도달하고 카드가 한 번 게시되는지 E6 |
| H3 · `main/adapters/claude/native-settings-file.ts:readClaudePluginManifest` | 옛 동기 plugin-catalog, 현재 sync/async 표 테스트 | `plugin-catalog.ts`·`configured-resources.ts`가 `readClaudePluginManifestAsync`를 await. `readSync`는 현행 `readClaudeSettingsObject`에서도 사용 | 부분 삭제 | 동기 manifest export/테스트 행만 제거. async manifest의 없음 `{}`·손상 `undefined`·정상 값 및 동일 경고 중복 방지, 동기 settings 판독 유지. E6 |
| H4 · `main/adapters/opencode/index.ts`의 `loadOpenCodeProviderSettings, parseOpenCodeModels, parseOpenCodeRuntimeModels` | 구 `app/harnesses/opencode/module.ts`. 현재 deployment 테스트의 동적 import는 첫 이름을 사용 | 데이터 호스트의 `app/harnesses/opencode/config.ts → adapters/opencode/config.ts → v1/settings.ts`. 모델 파서의 catalog 소비도 유지 | 부분 삭제 | 0333 후 다시 검색하고 테스트 import를 config로 전환. `implementation.ts` 계약·`v1/index.ts` 객체의 `loadSettings, parseModels, parseRuntimeModels` 전달층만 정리. E6 |
| H5 · 같은 `index.ts`의 `openCodeSkillDirectories, openCodePluginSkillDirectories` | 과거 `app/skill-catalog.ts`가 adapter index를 사용 | 현재 같은 카탈로그는 config의 `v1/skill-sources`, `v1/configured-resources` export를 읽는다 | 부분 삭제 | `implementation.ts`·`v1/index.ts`의 `skillDirectories, pluginSkillDirectories` 전달만 제거. 루트·플러그인 스킬 스캔, 다른 현행 implementation 멤버 유지. E6 |
| H6 · `adapters/opencode/config.ts`·`app/harnesses/opencode/config.ts`, `main/contracts/client.ts` | 설정·모델/스킬 검색 및 타입 소비자 | SDK 없는 설정 진입점은 data, 실행 adapter·SDK는 agent. 타입 계약은 하향 참조 | 유지 | H4·H5 정리 시 `index.ts` 재수출로 우회하면 가드·번들 검사 실패. E2·E6 |
| H7 · `main/app/{agent-host,data-host}/entry.ts` | 각 entry가 `parentPort, argv, exit`와 rejection/exception 리스너를 각각 배선 | 기존 `app/host-process.ts`에 프로세스 인자를 조립하는 작은 진입 함수를 둔다. 각 entry → 공통 함수에 자기 이름과 `create(context)` 전달 → 기존 `runHostProcess(deps)` | 공통화 | `AgentBootstrap/DataBootstrap`의 설정·DB·SDK·종료 및 시작 순서는 각자 소유. 기존 deps 주입 seam 유지. E2에서 실제 두 번들 및 두 오류 종류를 검사 |
| S1 · `oo.ts:session.load`와 `SessionLoadClient.loadLatest/page` | 예전 공개 load는 전체 본문. 현재 `chatStore.loadSession → sessionApi.load → window.oo.session.load` | renderer가 `loadLatest`로 latest 요청 → data `HistoryIndex.prepare/readHistoryPage` → store가 현재 요청일 때만 반영 | 유지 | 이전 페이지·표적/본문·메타/패널 조회, 요청 번호/세대 검사 유지. E5 |
| S2 · 내부 `SessionLoadClient.load`·`CHANNELS.sessionLoad`·data의 전체 `loadSession` 핸들러 | 전송 클라이언트의 구 메서드, 번호 없는 직접 호출, 구 테스트 및 Stage E baseline. 현 공개 load에서 도달하지 않음 | 지원되는 호출자라면 응답 형상까지 호환해야 한다. 앱의 일반 열기는 S1, raw 정리와 복구는 S5·S6 | 조건부 | D6 해소 후에만 등록·소유 표·스키마·mock/직접 포트·문서 정리. E5·E7 |
| S3 · `sessionRefresh`의 전체 snapshot fallback·`boundedSessions` | 성공한 latest/target/visit가 set을 채운 뒤에는 bounded. 그 전에 `refresh`하거나 번호·세대를 빼고 직접 호출하면, sync ready 뒤 `loadSession(..., sync.snapshot) → deliver`가 여전히 가능 | renderer가 refresh 식별자를 발급, data가 native 동기화 뒤 최신 페이지를 조회하고 store가 기존 캐시·live를 보호. 상세 §9 | 조건부 | 콜드 refresh·재접속·직접 호출의 full/partial 계약 먼저 검증. `refreshHistory`와 busy/unchanged/missing/unavailable 유지. E5 |
| S4 · `deliver, nextSessionChunkEnd, sessionLoadChunk, assembleSession, isChunkedSession`·chunk 타입/수신 구독 | 구 load와 S3의 전체 갱신. 번호 있는 요청은 조각+머리, 없는 요청은 전체 응답 | S2·S3 소비가 끝나면 페이지 응답 하나와 페이지용 pending/cancel만 남긴다 | 조건부 | 전송·조립·비용계산·채널 표·직접 포트 테스트를 양끝 같은 변경에서 정리. 구 지원이 남으면 해당 호출자와 조각 순서/누락 검사를 유지. E5·E7 |
| S5 · `native-history-queries.ts:compactLegacyRaw` | 현재 제품 호출은 구 `sessionLoad` 핸들러에서 `loadSession` 직전. 일반 latest는 호출하지 않음 | data가 네이티브 이전 이력 읽기 직전 세션별로 승계. `readNativeHistoryPrevious`를 통해 peer의 previous/raw 요청과 native refresh가 같은 규칙을 사용 | 유지 | 이전 DB 호환 책임은 확정. §9의 기존 DB fixture가 새 진입점에서 통과해야 S2 제거 가능. E5 |
| S6 · `loadSessionArchive`·`sessionLoadCancel` | native 원본 소실 시 다음 전송, 세션 전환·표적 탐색 취소에서 각각 실제 호출 | agent `native-session.ts` → data query → archive, renderer pending → data의 창별 sending map → 최신/표적 페이지 취소 | 유지 | 전체 조회 구 코드와 함께 지우지 않는다. E5에서 원본 소실 및 두 창에 같은 requestId 입력 |
| S7 · `shared/data-host.ts:splitSessionMessages`·과거 측정 지원 | 현재 chunk 생산자는 `nextSessionChunkEnd`로 지연 분할. 전체 배열 wrapper는 `measure-ui-inputs.mjs`의 I1·테스트가 사용 | 과거 트리의 분할/조립은 그 트리로 재생. 현행 지표는 history page bytes/rows/왕복으로 측정 | 부분 삭제 | I1 현재 행에는 폐기 사유, 과거 행에는 실제 측정값. `estimateWireChars` 등 인접 export는 각 직접 소비를 확인. E5·E7 |
| P1 · `chat/lib/transcript/viewport/pin.ts:OPENCODE_PIN_POLICY` | 공용 pin 정책 테스트가 OpenCode 상수를 대입. 현행 OpenCode 화면에 연결 없음 | registry의 `OpenCodeScrollController → scrollPolicy.nextTimelinePin`. Claude의 pin 정책 및 공용 geometry는 독립 소비 | 부분 삭제 | 상수/그 가상 정책 테스트만 삭제. E3 실제 위쪽 입력·선택·resize·jump에서 pin/anchor 확인 |
| P2 · `chat/hooks/usePanelSelection` | `ArtifactViewer, DiffReview`, `ArtifactViewer.actions.test`의 `vi.mock` | renderer `shared/ui/virtual/usePanelSelection` | 삭제 | 제품과 mock을 같은 모듈로 옮기고 실제 범위 선택을 E3에서 확인 |
| P3 · `chat/lib/diffDisplay` 및 `chat/lib/diffHunks` | `FileDiffSection` 및 diff 표시·hunks 테스트. 계측 `SOURCE_MODULES.diffHunks`는 옛 경로 문자열 | renderer `shared/compute/diffDisplay, diffHunks`. worker의 상대 import는 이미 정본 | 삭제 | 양 import 갱신, 기존 git 트리에서만 구 경로 선택. E4·E7 |
| P4 · `chat/lib/unifiedDiffLines` | OpenCode `filePresentation.ts` 및 단위 테스트. UI 가드의 금지 경로 합성 fixture | `shared/compute/unifiedDiffLines`. 워커도 여기서 patch 줄을 읽음 | 삭제 | 직접 import로 바꾸고 금지 위치에 `diff` import를 심는 가드의 음성 대조 유지. E4·E7 |
| P5 · `chat/lib/transcript/turnStart` 및 `viewEqual` | reducer와 두 블록 모델이 `isTurnStart`, OpenCode 모델이 `deepEqual` 사용 | `app/src/shared/history-turn.ts` 및 `shared/history-panels/view-equal.ts` | 삭제 | 소비자·테스트를 바로 연결. 턴 시작과 반복 갱신의 블록 identity를 E1에서 대조 |
| P6 · `chat/lib/transcript/viewport/selectionGuard` | `TranscriptViewport` 및 선택 테스트 | renderer `shared/ui/virtual/selectionGuard`가 범위·gesture 규칙 소유 | 삭제 | 제품·테스트 import 이동, E3의 실제 브라우저 복사/새 키 마운트 |
| K1 · `LegacySubAgentTile`·`messageOrder.idOf` | 저장된 canonical 근거가 빈 세션, ID 없이 로드된 구 메시지 | `SubAgentTileContent`의 fallback, user clientId 또는 메시지 객체별 WeakMap 키. canonical·정식 ID 경로도 함께 사용 | 유지 | E1에서 구 타일/신 타일 중복, id 없는 사용자/assistant와 prepend 확인 |
| K2 · `infra/settings-migration.ts:migrateRawSettings`·DB의 기존 마이그레이션 | `settings-store` 재개 및 data-host DB 부팅이 읽음 | data가 저장 형식·설치별 이관을 소유 | 유지 | 옛 설정으로 재시작·DB reopen 후 값, 기존 SQL append-only 가드. E5·E6 |
| K3 · `host-process.ts:HostProcessDeps`·워커 클라이언트 주입점·`transcriptIndex.legacy.testfixture.ts` | 호스트 오류·worker 실패/취소 제어, `transcriptIndex.test`·store 등 독립 비교 | 실행 주체의 테스트에서 실제 동작을 일으키거나 이전 결과와 대조. 제품에서 fixture를 import하지 않음 | 유지 | E1·E2·E4·E7. `session-load.ts:yieldTurn`은 S4 전용이므로 S4를 없앨 때만 그 전용 seam을 같이 걷고 페이지 지연/취소 시험은 유지 |

## 9. 구 세션 전송을 제거할 순서

1. **공개 load/refresh의 계약을 먼저 고정한다.** `oo.session.load`의 최신 페이지 반환을 기준으로 한다. 새 renderer 클라이언트의 첫 호출이 refresh여도 고유 `requestId/openGeneration`을 부여한다. data는 native sync의 ready에서만 최신 페이지를 반환한다. 기존의 busy/unchanged, missing/unavailable/error는 각각 원래 상태와 메시지를 돌려준다. `complete/history` 경계와 캐시 우선 규칙을 유지한다.
2. **재접속은 store가 소유한다.** 기존 `onHostLifecycle → loadSession(..., {revalidate:true})`에서 최신 페이지를 받고 유휴·현재 요청에서만 native refresh한다. A를 열고 B로 바꾸는 도중 A의 갱신이 끝나거나 live delta가 먼저 오면, 늦은 응답을 폐기한다. 에이전트 종료 때 대기 델타를 비운 뒤 각 진행 턴의 오류·입력 가능 상태를 유지한다. 페이지의 `cancel`과 취소 대상이 아닌 refresh를 분리한다.
3. **구 DB의 raw 분리는 data의 네이티브 이력 판독에 귀속한다.** `readNativeHistoryPrevious`가 해당 세션의 payload를 읽기 직전 `compactLegacyRaw(sessionId)`를 실행하는 설계다. SQL의 `raw_json IS NULL` 조건으로 이미 분리한 행은 변경 0건이다. 최신 페이지·이전 페이지·부팅 때 모든 세션을 훑는 경로에는 넣지 않는다. 기존 inline raw 판독도 호환 증거가 확보될 때까지 보존한다.
4. **릴리스 호환 범위를 판정한다.** `IPC_CONTRACT.md`에 전체 `oo:session:load`와 chunk가 기재돼 있고 포트를 직접 호출하면 핸들러가 응답한다. 저장소 검색으로 별도 배포 도구·플러그인의 사용 여부는 알 수 없다. 0333 완료 후 지원 클라이언트와 패키징/측정 도구 소유자가 전체 snapshot, 무번호·무세대 refresh를 사용하는 버전/호출자를 확인한다. 지원 중이면 구 응답을 유지하고 삭제 시점을 별도로 정한다. 해당 계약을 쓰는 지원 대상이 없거나 지원 종료가 확인되면 app 클라이언트는 bounded로 통일하고 구 직접 요청·전체 fallback·chunk를 함께 제거한다. 무세대 전체 응답을 조용히 부분 응답으로 바꾸지 않는다.
5. **구 DB fixture를 새 경로에 붙인다.** `native-history.db.test.ts`의 `raw_json=NULL` 행과 `handlers/session.load.test.ts`의 과거 payload를 사용한다. 새 DB의 최신 스키마에 구 행을 넣은 경우와 실제 구 스키마에서 정식 마이그레이션 후 reopen한 경우를 각각 검증한다. payload.raw에 객체·배열·문자열·수·false·null이 있는 세션, 이미 분리된 세션, 영향받지 않을 이웃 세션을 준비한다. latest에서 전체 payload 판독·분리 0회 → native refresh 또는 다음 턴에서 한 행 이관 → 같은 세션 재시도·재접속 때 변경 0행을 관측한다. raw, cursor, frontier, 정렬된 메시지와 복원 prompt를 대조하고 원본 소실 때 `loadSessionArchive`를 거쳐 실제 복구되는지 본다.
6. **측정·등록을 마지막에 정리한다.** 구 직접 호출과 `sessionLoadChunk` 양 끝, `shared/{ipc,channel-owner,data-host,protocol}` 및 해당 가드·테스트·`IPC_CONTRACT.md`·[실행 모델](../../arch/execution-model.md)의 조각 설명을 한 변경으로 갱신한다. `sessionHistoryPage/sessionLoadCancel`은 계속 data 채널이다. 호환 분기를 유지한 경우 삭제한 채널처럼 문서화하지 않는다.

## 10. 구현·검증 강제 지점

아래 검색은 저장소 루트에서 `rg -n '<표의 검색식>' app/src app/scripts`로 실행한다. 타입·재수출·mock·소스 텍스트 검사와 제품 호출을 따로 읽는다. 테스트 명령은 `app/`에서 실행하며, `V`는 `./node_modules/.bin/vitest run`이다. ‘추가’는 후속 구현에서 그 진입점에 보강할 단언이다.

| 지점 / 대상 | 자리 검색식 · 제품의 운반 경로 | 직접 oracle · 합격/실패 의미 |
| --- | --- | --- |
| E1 · T1~T7, P5, K1·K3 | `createClaudeBlockModel\|createOpenCodeBlockModel\|createWorkProjector\|turnCopyText\|messageSegments\|subagent_notice`. registry → 두 Timeline → change log/advance → viewport → 실제 Work disclosure·메타·카드 | `V blockModelCatchup blockUpdateCost streamingSessions TranscriptViewport.prepend TranscriptViewport.disclosure openCodeBlocks projection.golden blockBranchRegressions`. A/B에 다른 텍스트·도구·ID를 주고 비활성 델타, reset/prepend/append, live 종료 뒤 DOM 순서·이전 행 키·영향받은 블록 수를 본다. 추가: 두 Timeline에서 compact 전후 토큰·fork·notice 값을 구별하고 클릭 복사·fork 대상·턴별 카드 파일을 단언한다. |
| E2 · H6~H7 | `parentPort\|unhandledRejection\|uncaughtException\|new AgentBootstrap\|new DataBootstrap`. 각 entry → runHostProcess → 자기 조립 → ready/오류/종료, shell 감독과 창·피어 포트 | `V host-process host-assemblies.order` 및 §19 bundle/smoke. 정상, create/start 실패, rejection/exception을 각각 주입해 실제 호스트 이름·오류 종류·종료 순서를 본다. 한 호스트가 다른 bootstrap·SDK·DB를 끌어오거나 잘못된 포트 요청을 처리하면 실패. |
| E3 · P1~P2, P6, W4 | `nextTimelinePin\|CLAUDE_PIN_POLICY\|shouldCancelSelection\|usePanelSelection\|selectionGuard`. 실제 등록 scroll controller·viewport·패널 → 새 DOM 키/선택/브라우저 copy | `V ScrollController.interaction ScrollController.restore-race TranscriptViewport.selection usePanelSelection ArtifactViewer.actions`, `node scripts/check-transcript-selection.mjs`. 패널 안/밖, 마운트 유지/신규, 드래그 중 교체, 위 이동/resize/jump를 구별. 브라우저 선택 문자열·취소·읽던 위치를 확인한다. |
| E4 · W1~W6, P3~P4 | `diffTokens\|diffLines\|diffView\|tokens\|charsBefore\|textChars\|diffStatWithinCap`. tool body/FileDiffSection → cap/문서 등록 → client → compute.worker/state → 가시 행 및 축별 token → DiffTable/패널 | `V useDiffView useDiffRowTokens useWindowTokens DiffTable.virtual fileDiffVirtual diffSyntax.render VirtualCodeView shared/compute`. 두 입력 합 400/401줄·64,000/64,001자, 긴 단일 줄, 합산 예산, CRLF, 미지원 언어, 창 중간 행을 입력한다. 큰 pair는 문서를 등록한 뒤 참조와 범위만 반복 전송한다. 준비된 행/patch의 모델 경계(5,000행·200,000자)와 가시 요청 상한(diff 400행·tokens 200줄)을 따로 시험한다. 작은 표는 old/new를 구별해 칠한다. 취소·revision 교체·실패 시 늦은 토큰 무시, 기존 fallback·원문 동작 유지. |
| E5 · S1~S7, K2 | `sessionLoad\|sessionRefresh\|readHistoryPage\|compactLegacyRaw\|loadSessionArchive\|onHostLifecycle`. 공개 API → 창 포트 → data → store, 별도로 agent 다음 전송 → data archive. §9의 시점·실패 분기 | `V history-port.integration session-load.test session.load.test chatStore.native-history turn-page.db native-history.db native-session.restored-history.db`. 추가: 두 창/같은 requestId, 세대 없는 첫 refresh, 재접속 후 A→B, raw 이관 전후와 native 소실. 전송 frame의 ID·세대·메시지 수와 DB 행·archive를 함께 단언한다. 구 호환을 유지하면 무번호 전체/번호 있는 chunk·조립 실패도 실행한다. |
| E6 · H1~H6, K2 | `prepareOutputFiles\|captureOutput\|makeOutputFilesHook\|readClaudePluginManifest\|parseOpenCodeModels\|openCodeSkillDirectories`. SDK 훅 → peer query → 파일·DB → agent 통지 → 해당 턴 카드. 별도로 data config → 모델·스킬 목록 | `V output-files.test features/artifacts/service.test native-settings-file plugin-catalog opencode-connection-deployment settings-migration`, `node --test scripts/harness-boundary.test.mjs`. 추가: 실제 등록한 peer 연산에 sessionId·경로·expectedContent를 구별해 전달하고 저장 완료 전 통지 0, 저장 후 해당 세션 카드 1, abort 후 게시 0. 설정 읽기만으로 SDK 초기화 0, fixture 모델·스킬 값 일치. |
| E7 · P2~P6, S2~S4·S7, T5~T6, K3 | `priorTranscriptModules\|SOURCE_MODULES\|sessionLoadChunk\|splitSessionMessages\|vi.mock\|reportSites`. 제품 import·mock·문자열 측정과 bundle entry를 각각 대조 | `node --test scripts/{measure-ui-inputs,measure-stage-e,check-ui-thread}.test.mjs`. `node scripts/measure-ui-inputs.mjs --src .`와 고정 구 app 트리에 같은 runner를 사용. Stage E는 현재 `node scripts/measure-stage-e.mjs --old-db long`, 구 `7db1c7ce`의 app/src와 현 측정 도구로 `node scripts/measure-stage-e.mjs --baseline --old-db long`을 실행하고 양쪽 모두 small로 반복한다. 삭제한 제품 함수를 테스트에 복제하지 않고, 비교 표본의 값·출처 또는 현행에서 폐기된 이유가 남아야 한다. |

공개 load·구 DB 이관·archive·취소의 기준선 호출 자리는 아래 명령으로 재현한다.

```sh
node .agents/skills/handoff-verify/scripts/site_census.mjs \
  --search "rg -n 'sessionLoads\.loadLatest|compactLegacyRaw\(|data\.query\.loadSessionArchive\(|sending\.get\(event\.sender\.id\)' app/src -g '!*.test.*'" \
  --sites app/src/renderer/src/shared/api/transport/oo.ts:367,app/src/main/app/data-host/session-load.ts:145,app/src/main/app/data-host/session-load.ts:153,app/src/main/app/chat-turn/native-session.ts:62
```

기준선에서 위 검색은 5줄(운반 4, 선언 1), 운반 목록 4, 미분류 0이었다. 0333 완료 후 §10의 자리 분모를 최종 커밋으로 다시 고정한다. 정적 import 가드만으로 순서·렌더 비용·외부 소비를 입증할 수 없다. 회귀 검증 때 공개 load를 구 full load로 연결하면 E5의 페이지 메시지 수가, 큰 pair를 renderer diff로 연결하면 E4의 worker 요청·가시 범위 단언이, 양 호스트의 create를 맞바꾸면 E2의 번들/ready가 각각 실패해야 한다.

### 구 단언을 옮길 제품 진입점

| 구 단언 | 이관 후 같은 회귀를 잡을 위치 |
| --- | --- |
| `Exchange.compare`·`turns.received` | `TranscriptViewport`의 안정 키/렌더 수, 피드 필터·반환 입력·pending 및 reserve. ID가 다른 같은 시각의 두 행을 사용한다. |
| `AssistantTurn.copy`·`TurnOutputCards`·`ArtifactCards.lifecycle` | Claude/OpenCode Timeline → `MessageMeta`의 실제 복사 버튼 및 해당 하네스 fork 지원, `ArtifactCards`의 열기·저장. 서로 다른 턴의 파일로 오귀속을 검출한다. |
| `WorkActivity.render/interaction/questionIpc` | 실제 Claude Work Timeline의 activity 블록에서 펼침→질문 응답→결과 귀속까지 확인한다. Code 표시 및 불완전한 옛 메시지도 같은 입력으로 대조한다. |
| OpenCode `projection.test`·`Timeline.selection.test` | `createOpenCodeBlockModel.advance`의 변경별 행과 실제 `OpenCodeTimelineRow`의 본문·추론·선택을 검사한다. 기존 golden 및 과거 모델 fixture는 독립 비교에 쓴다. |
| `useDiffCompute`·`diffSyntax.test`·worker `client/handler`의 전체 입력 테스트 | `DiffBody/ToolBody → DiffTable` 및 `FileDiffSection`에서 작은/큰 pair·테마·좌우 축을 검증한다. cache hit/cancel/실패는 살아 있는 종류의 실제 worker 요청·응답으로 계속 유발한다. |
| legacy chunk 단위·포트 테스트와 `pin.test`의 OpenCode 정책 | S4 지원을 끝내면 순서/취소/누락 단언은 history port에서 잘못된 세대·누락/늦은 페이지로 이관. OpenCode pin은 실제 등록된 ScrollController에서 검증한다. |

## 11. 구현 순서와 재검토 조건

| 순서 | 작업 · 결정 | 다음 단계로 넘어갈 증거 |
| --- | --- | --- |
| 0 | D5 · 0333 완료 SHA/verify와 그때의 0331·0332 변경을 기준선과 diff. T7·H3~H6 및 패널/선택 mock의 호출자 재조회. D6 지원 범위 판정 | 담당자가 §9의 직접 포트 소비자·무세대 응답 방침과 fixture 검증 경로를 기록. 설계자가 §10 분모·INDEX를 맞추고 사용자가 재검토한 뒤 착수 |
| 1 | D1·D3·D4 · 구 컴포넌트·프로토콜 테스트의 행위 단언과 측정기 경로를 현행 제품 진입점으로 먼저 이관 | E1·E3~E7에서 작은/큰 값·구/신 데이터·취소·늦은 응답이 구별되고 과거 트리 측정 재생 가능 |
| 2 | D1·D3 · T1~T6 및 P1~P6 정리. 이어 W1~W5의 요청·응답·handler·mock·fixture를 같은 변경으로 정리 | E1·E3·E4·E7. 공개·테스트·계측 직접 소비자를 다시 열거하고 뷰포트·diff에 전체 재계산 경로가 생기지 않았는지 비교 |
| 3 | D2·D3 · H1·H3~H5의 소유자를 정리. T7 표시와 H7 프로세스 배선은 독립 커밋으로 공통화 | E1·E2·E6. 두 번들 각각의 bootstrap 및 하네스별 본문·추론·도구 표현, 실제 산출물 게시를 확인 |
| 4 | D4·D6 · 먼저 §9의 세대 없는 갱신/재접속·raw 승계를 검증한다. 이후 결정한 범위에서만 S2~S4·S7을 정리 | E5·E7에서 구 DB·동시 취소·직접 호출 결과를 확인하고 IPC 문서와 등록·소유 표를 대조. 지원 중인 포트는 유지 목록에 표시 |
| 5 | D1~D4 · 동일 표본으로 기준선과 비교하고 저장소 운영 게이트 수행 | §19 기계 결과, 이전 실패와의 차집합, Windows 실측 상태를 verify와 INDEX에 별도 기록 |

**현재 미결정은 D6의 지원 범위다.** 이 결정에 따라 S2~S4 전체 삭제와 호환 경로 유지 중 구현 범위가 달라진다. S5의 소유자와 실행 시점, S6·K1~K3의 보존은 설계에 명시했다. 구 DB에서 새 S5 경로의 정합성은 후속 구현에서 증명해야 하며, 0333으로 생기는 새 소비자는 완료 SHA에서만 확정할 수 있다.

## 19. 정리 전 실행 기준선

2026-11-27, Linux, 제품 `e2de2377`에서 아래를 실행했다. 아래 결과는 0334 구현 후 PASS 판정에 합산하지 않는다.

| 실행 | 관측 |
| --- | --- |
| `node docs/handoff/0334-post-migration-cleanup/evidence/reachability.mjs` 및 `--all` | 변경 소스 비도달 4, 도달한 Worker URL 3. 전체 모드에서 미변경 H1을 추가로 확인했다. |
| `cd app && node scripts/check-ui-thread.mjs` / `node --test scripts/{harness-boundary,check-ui-thread,measure-ui-inputs}.test.mjs` | 실행 주체 가드 OK. Node 테스트 145 통과, 실패·skip 0. |
| `./node_modules/.bin/electron-vite build` / `node scripts/smoke-preload.mjs out/preload` | main 셸·data-host·agent-host, preload, renderer 및 compute/markdown/image 워커 번들 생성. renderer chunk 크기 경고. preload require는 electron만, `ooBridge` 키 7개 노출. |
| `node scripts/smoke-hosts.mjs out/main` | 데이터 → 에이전트 기동, 피어 이전 요청 처리, 잘못된 호스트의 설정 요청 거부, 에이전트 → 데이터 종료 OK. 작업 트리에는 Electron ABI 140 바인딩이 있어 Electron의 Node 모드로 먼저 확인했다. 같은 번들 사본과 임시 빌드한 Node ABI 127 SQLite로 Node 22.23.3에서도 OK. |
| `V Timeline.viewport.test.ts Exchange.compare.test.ts AssistantTurn.copy.test.ts WorkActivity.render.test.ts opencode/transcript/projection.test.ts opencode/transcript/Timeline.selection.test.ts useDiffCompute.test.ts usePanelSelection.test.ts TurnOutputCards.test.ts ArtifactCards.lifecycle.test.ts` | 기존 0334 표본 10파일·67케이스 통과. 구 구현 제거 전에 현재 화면의 직접 단언으로 옮길 비교 기준이다. |
| `V useWindowTokens.test.ts useDiffRowTokens.test.ts DiffTable.virtual.test.ts transport/session-load.test.ts host-process.test.ts adapters/claude/output-files.test.ts segmentCache.test.ts opencode/transcript/Timeline.render.test.ts WorkActivity.interaction.test.ts` | 지정한 9파일·102케이스 통과. 범위 토큰·가상 diff·포트·SDK 산출물 및 화면의 정리 전 결과다. |
| `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron node_modules/vitest/vitest.mjs run native-history.db.test.ts src/main/app/handlers/session.load.test.ts history-port.integration.test.ts native-session.restored-history.db.test.ts` | 구 DB·직접 핸들러·페이지·네이티브 복구 4파일·35케이스 통과. §9의 새 책임으로 옮긴 뒤에도 같은 데이터 결과를 증명해야 한다. |

추가로 `V ScrollController.interaction ScrollController.restore-race TranscriptViewport.selection usePanelSelection ArtifactViewer.actions blockModelCatchup blockUpdateCost streamingSessions TranscriptViewport.prepend TranscriptViewport.disclosure openCodeBlocks projection.golden blockBranchRegressions`에서 14파일·156케이스가 통과했다. `node --test scripts/measure-stage-e.test.mjs`에서 과거 소스 판별 및 실측 판정 테스트 4건이 통과했다.

후속 구현의 마지막 게이트는 `.github/workflows/ci.yml`와 `app/AGENTS.md`를 따른다. migration append-only·doc inventory·product naming·test budgets·UI thread 가드, lint·typecheck, Node ABI에서 전체 Vitest와 `node --test scripts/*.test.mjs`, 새 번들에서 host/preload smoke를 실행한다. 선택·스트리밍·이력은 해당 Chromium probe와 같은 입력의 이전/이후 가시 행·렌더 수·포트 전송량을 기록한다. Windows 설치본의 시간·IME·터치패드 판정은 0330 WU-W에서 담당한다.

**설계 검토 결과 — DRAFT.** D1~D4의 AC와 §10에서 상충하는 결정을 찾지 못했다. D5에 따라 다음 검토 시점은 0333 완료 뒤다. §9에서 직접 포트 계약을 결정하고 최신 트리에서 §10의 자리와 근거를 다시 고정할 때까지 구현 dispatch를 보류한다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: … (Part I/II의 정확한 절 인용)
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

> `§10`의 `언제 강제` 칸은 **하나의 불변식이 성립해야 하는 지점 목록**이다. 한 지점만 닫아도
> 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다.
> **각 행의 `재현 명령 / 관측`은 이번 턴에 실제로 실행한 것만 적는다** — 산출물에서 표식을 다시
> 찾지 못하면 그 행은 닫힌 것이 아니다.
> **그 관측이 구조적 proxy·0건/전수 스윕·배선 존재 oracle이고 이번 턴에 장치를 만들거나 고쳤다면,
> 등록된 결함을 심어 실패하는지 먼저 확인한다** — 눈이 없는 장치의 `0건`은 전수의 증거가 아니다.
> 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개는 oracle 종류와 무관하게 돌린다(impl §3 sweep). 그 밖의 직접 oracle에는 mutation을 더 발명하지 않는다.
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §9).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 목록·제외 줄과 함께 `site_census.mjs`로 다시 돌린 미분류 수를 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표, 자리 규칙이 적은 분기 중 입력이 없는 분기가 있는 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §9).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾸거나 블록·여러 항을 함께 지운 변이의 red로 그 안의 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 분류(impl §7): 목록 미고정 → PLAN_GAP · 현재 결함 → 선조치 또는 PLAN_GAP · 확장 후보 → 확장 창이 열려 있으면 PLAN_GAP 가능, 닫혔으면 보고 · 비귀속 → 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 분류가 이행·현재 결함이거나 설계자가 채택한 확장 행은 이번 턴에 닫는다. 후보 표로 간 행과 `경계` 행은 제외

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> **열거 sweep**: 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 그 항목만 지우는 기본 변이 1개(계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함 —
> 더 넓게 지우는 등록 변이로 갈음하지 않는다)를 심어 red인지 본다(impl §3, 하네스 `.agents/skills/handoff-verify/scripts/mutate.py`).
> red는 그 좌표가 변이 때문에 실패했을 때만 `잠김`이고, 상태를 공유하는 좌표는 하나씩 돌린다. 그 위에 pair가 선택한 적대 증거·
> 파생 이슈의 인용 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도를 심는다. 규칙 칸 분기와 여러 항을 적은
> §10 자리 문장의 항은 그것을 구현한 diff 자리(조건·조기 반환·후보를 합치는 항 — 이번 Delta V가 새로 열거하거나 바꾼 항목이면 앞 턴 코드 포함)마다
> 제거 변이를 심어 찾는다. 그 밖의 hunk에는 mutation을
> 새로 발명하지 않는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `sweep — §10 자리 / path edge / 규칙 칸 분기(diff 자리)` / `재앵커 — 원 ID` / `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 테스트 추가** / 동치 — 근거·확인 실행 |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K · sweep S = 표 행 T` — sweep은 `S/N`(N = 열거 항목 수)으로도 적고 S는 N과 같아야 한다(IMPL_DONE 전 전수). `S < N`이면 돌리지 못한 항목을 적는다. 남긴 항목이 있는 pair와 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §3·§9).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 분모는 직전 verify 고장 이력의 `잡음` 행 중 하한 ④와 같은 범위이고, 원문이 옮겨 갔으면 재앵커한 행이다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

> 범위 밖이라 이번에 고치지 않더라도 **적는다** — 적지 않으면 그 선택지가 존재한 적도 없게 된다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치(구현 세부) / 📝 **plan 수정 제안**(설계가 틀렸다는 증거) / ⚠️ 보고만(제품·AC·Decision·의존성) | … |

> 가운데 갈래가 구현 턴의 핵심 산출이다 — plan을 고치는 것은 설계자 책임이지만, **고쳐야
> 한다는 증거를 만드는 것은 구현자만 할 수 있다.** 무엇이 틀렸는지·코드에서 무엇을 봤는지·
> 어느 절을 어떻게 바꿔야 하는지를 함께 적는다.

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음 / …

> 차이가 있으면 **대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 한 줄씩** 적고, 그 축에서 다시 확인한
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §7).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … / 해당 없음 + 근거 | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … / 해당 없음 + 근거 | … |
| 재진입 | … / 해당 없음 + 근거 | … |
| 다른 무효화 축 | … / 해당 없음 + 근거 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | `ci.yml` 단계 전부의 로컬 대응(파일 필터 없는 테스트) — 테스트 N파일 / M케이스 · error·warning 수 · 돌리지 못한 단계와 이유 · 기준선 분리 근거(변경 전 실패 집합과 차집합 ∅ + 환경 원인, `docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only`로 뽑은 테스트 파일 N · 규칙별 위반 0(app: 시간 예산·호스트 격리·풀 분류) · 그 파일들의 규칙 가드 실패 0 — 테스트를 건드리지 않았으면 `해당 없음` |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다. 분모가 바뀌었으면(AC 분할·추가) 그 사실을 적고 이전 라운드 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r<N> 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다. 좌표 정본은 `INDEX.md` 한 곳이고 검증자가 채운다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k` (verify 3·6회째 FAIL/RETURN_TO_PLAN 또는 verify 없는 impl 턴 3 초과면 — 사용자 요구 변경 턴 제외 — 다음 재구현 전에 `handoff-review`. verify 9회째가 PASS가 아니면 `verify/CLOSED` 종료)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | 이행 / 현재 / 확장 / 경계 / 비귀속 | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 / 후보 표 |
