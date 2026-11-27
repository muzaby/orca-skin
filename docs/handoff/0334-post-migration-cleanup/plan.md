# 0334 · 실행 주체 분리 이후 남은 코드 정리

| 항목 | 값 |
| --- | --- |
| 기준 | `e2de2377` · 0324~0330 기계 검증이 반영된 작업 브랜치 |
| 단계 | plan / READY · V1 |
| 성격 | 동작 보존 리팩터링. 완료 증거는 구현 diff와 verify에 기록한다. |

## 목표와 사용자 계약

사용자는 기존 Claude·OpenCode 세션을 같은 방식으로 열고, 읽고, 보내고, 검색하고, 복사하고, 패널을 조작할 수 있다. 기존 DB로 재개한 대화도 같은 결과를 보인다. 프로세스 경계를 지키면서 이중 구현을 없애고, 테스트와 계측이 출시본에서 사용하는 경로를 검증하도록 한다.

| 결정 | 인수 조건 |
| --- | --- |
| D1 · 0324 이전부터 0330까지 바뀐 코드와 그 소비자를 조사한다. 구 구현을 삭제할 때에는 하위 함수·분기·테스트·도구에 남은 소비자까지 추적한다. | AC1 · 삭제 후보마다 제품 진입점, 타입·등록·동적 로드·빌드·테스트·과거 측정·기존 데이터 소비 여부, 대체 경로 및 처리 결과를 남긴다. 제거로 단언이 사라지면 현행 제품 경로에서 해당 동작이 회귀할 때 실패하는 테스트로 옮긴다. |
| D2 · 하나의 정책은 그 실행 주체의 한 모듈이 소유한다. 비슷한 이름의 하네스별 표현과 서로 다른 포트의 수명 규칙은 각각 검증한다. | AC2 · 셸에 SDK·DB가 들어오지 않는다. 에이전트는 턴 진행·중계, 데이터 호스트는 저장·조회, 창은 입력과 DOM, 워커는 지정된 고비용 계산을 담당한다. 현재 [실행 모델](../../arch/execution-model.md)의 채널별 소유자와 재시작·취소 동작을 보존한다. |
| D3 · 사용자 동작과 0324~0330의 반응성 기준을 승계한다. | AC3 · 양 하네스의 라이브 응답, 기존 세션의 히스토리 페이지, 선택 취소·브라우저 복사, Work/Code 표시·오류·산출물·복사 시점이 현행 경로에서 동작한다. 입력 크기 경계, 비활성 세션, 대체 화면 및 워커 실패 경로를 확인한다. |
| D4 · 원본 파일·저장 형식·기존 계측 기준선은 별도 소비자로 본다. | AC4 · 이전 DB, 스킬/플러그인 설정, 기존 버전 성능 측정이 계속 동작한다. 설치 데이터 삭제나 새 스키마 전환 없이 소스에서 구 경로를 걷는다. |

## 기준선 및 조사 범위

0324 첫 계획의 부모는 `a9ce2426`이다. `git diff --name-status --find-renames a9ce2426 e2de2377 -- app/src app/scripts`로 조사 분모를 고정한다. 변경 목록에서 시작해 미변경 파일에 남은 이전 소비자와 같은 파일 안의 비사용 export·조건 분기까지 추적한다. 목표 트리에서 제품 모듈의 값·타입 import, 재수출, 정적 문자열 dynamic import, Worker URL을 따라간 예비 조사에서 변경된 소스의 비도달 파일 네 개를 추렸다. 이 수치는 정적으로 보이는 파일 단위 후보 수다. 문자열 경로를 읽는 도구, 제품에 도달하는 파일 안의 구 함수, Electron 빌드의 별도 진입점은 별도로 대조해야 한다.

| 실행 소유자 | 조사할 실제 진입점과 경계 | 제거·보존 판정 |
| --- | --- | --- |
| main 셸·preload | `app/electron.vite.config.ts`, `main/index.ts`, `preload/index.ts`, `main/app/shell/`, `shared/channel-owner.ts` | 수명·창·OS 서비스, 셸 전용 IPC, 호스트 포트 전달을 확인한다. preload 다리와 창의 전송 클라이언트는 역할이 다르다. |
| 에이전트·데이터 호스트 | 각 `entry.ts`·`bootstrap.ts`, `agent-host/data-link.ts`·`data-host/agent-link.ts`, `persistence-sender.ts`·`persistence-receiver.ts` | 양 진입점의 process 어댑터는 동일하다. 기존 `host-process.ts`에서 중복을 줄일 수 있다. 실제 호스트 조립은 분리한다. 저장 순서, 확인 응답, 재접속 시 설정 사본, 조회만으로 에이전트를 기동하지 않는 정책을 보전한다. |
| renderer·공용 transcript | 하네스 registry → 각 `Timeline.tsx` → `createClaudeBlockModel` 또는 `createOpenCodeBlockModel` → `TranscriptViewport` | 예전 전체 턴 컴포넌트와 새 블록 모델을 구별한다. 두 `AssistantSegment.tsx`의 compact·fork·subagent notice는 같은 표현이다. 본문 원문 위치, 추론, 도구 그룹, 오류 모양은 하네스별 책임을 보전한다. |
| Web Worker | `shared/compute/client.ts` → compute·markdown·image 워커, `protocol.ts`, `worker/state.ts` | 사용이 끝난 요청은 생산자·wire 타입·캐시 키·크기 추정·워커 핸들러·검사기를 한 묶음으로 확인한다. 크기 제한 내 인라인 diff와 문서 참조로 처리하는 대형 diff, 각 레인의 취소·우선순위·실패 동작을 보전한다. |

## 구현 단위와 직접 검증 지점

저장소 루트에서 `node docs/handoff/0334-post-migration-cleanup/evidence/reachability.mjs`를 실행하면 제품 진입점에서 닿지 않는 변경 파일과 이를 참조하는 모듈을 다시 구할 수 있다. 타입 import도 연결로 취급하므로 미사용 코드 전체를 찾는 검사는 아니다. 번들 설정, IPC·동적 등록과 성능 측정용 소스 경로는 별도로 확인한다.

아래 경로의 `chat/`는 `app/src/renderer/src/features/chat/`이다. 파일 수가 줄더라도 동일 동작을 하는 구 구현을 테스트 폴더로 그대로 옮겨 남기지 않는다.

| 단위 | 근거·범위 | 구현 후 검증 |
| --- | --- | --- |
| A · Claude 구 transcript | `chat/harnesses/claude/transcript/Exchange.tsx → AssistantTurn.tsx`는 제품 루트에서 도달하지 않는다. `WorkActivity.render`, `Exchange.compare`, `AssistantTurn.copy`, `TurnOutputCards`, `ArtifactCards.lifecycle`가 구 코드에 결합했다. | 각 단언을 현재 Timeline·블록·카드·메타 경로에 대응한다. 예약 공간·대기 입력 복원 및 마지막 턴 fork, 공백/큰 입력의 클릭 시 복사, 턴별 산출물 소유·최근 카드 저장, Work 그룹 접기·Code 표시·스트리밍 순서를 확인한다. 이전 memo 함수 자체에만 적용된 단언은 대응하는 사용자 결과를 확인한 뒤 정리한다. |
| B · OpenCode 구 투영 | `chat/harnesses/opencode/transcript/projection.ts`는 실제 화면 대신 테스트에서 전체 메시지를 다시 투영한다. `Timeline.selection.test.ts`의 타입은 현행 블록과 같다. | 현행 모델의 reset·prepend와 실제 라이브 행으로 자동 피드, 같은 시각의 다른 ID, prepend 키 보존, 라이브 본문·추론을 확인한다. `measure-ui-inputs.mjs`의 `priorTranscriptModules`는 과거 Git 트리에서만 구 파일을 읽으므로 그 좌표를 보존한다. |
| C · 구 diff 조회 | `chat/hooks/useDiffLines.ts`를 제품 컴포넌트가 호출하지 않는다. 현행 Claude DiffBody·OpenCode ToolBody와 DiffTable은 작은 diff와 큰 문서 경로를 나눈다. | 400/401줄, 64,000/64,001자 및 화면 교체·취소·실패를 현재 소비자에서 검증한다. 구 `kind: 'diffLines'` 값이 예제·도구 등에서 현행 소비되는지 확인한 뒤 요청과 전용 분기를 제거한다. 실제 줄 계산 함수와 현재 사용되는 요청은 보전한다. |
| D · 이주 중 생긴 경유 파일 | chat 아래 `hooks/usePanelSelection`, `lib/{diffDisplay,diffHunks,unifiedDiffLines}`, `lib/transcript/{turnStart,viewEqual,viewport/selectionGuard}`가 현재 정본을 재수출한다. | 운영 import와 테스트의 vi.mock·소스 경로 검사·측정용 문자열을 함께 바꾼다. 구·신 소스 트리를 읽는 측정기는 각 트리의 경로를 택한다. 하네스 설정 전용 `adapters/opencode/config.ts` 및 타입 경계를 제공하는 `contracts/client.ts`는 손대지 않는다. |
| E · 실제 중복 | 호스트 두 entry의 오류 및 종료 배선, 두 AssistantSegment의 동일한 세 가지 표시 분기를 조사한다. | 공통 소비부에 같은 표현을 두고 각 호스트의 bootstrap·하네스별 표시 분기는 그대로 전달한다. 불필요한 런타임 등록소, 양쪽 호스트 동시 import, 새 React 구독/효과를 만들지 않는다. |
| F · 기존 저장 데이터 및 도구 | `SubAgentTileContent.tsx`는 canonical 증거가 없는 상태에서 실제로 `LegacySubAgentTile.tsx` 헤더와 본문을 선택한다. `transcriptIndex.legacy.testfixture.ts`는 과거 결과를 비교하는 테스트에서 사용한다. | 빈 canonical 상태에서 저장된 서브에이전트 정보가 보이는지, canonical 정보가 있는 상태에서 중복 행이 없는지 확인한다. 옛 DB 읽기·마이그레이션 SQL, 구 트리에 대한 측정, 독립적인 테스트 비교 기준은 근거를 기록해 유지한다. |

### V 추적과 완료 기준

| Pair | 경로 | 직접 증거 |
| --- | --- | --- |
| R1 ↔ AT1 | 두 하네스의 기존·진행 중 세션 → 현행 Timeline → 실제 행·패널·동작 | 위 A·B·F의 표시·클릭·복원 결과. 자동화된 Chromium/Windows 측정은 기존 0330 판정 범위와 증거 구분을 따른다. |
| SD1 ↔ ST1 | 부팅·호스트 재연결·턴 저장 → 데이터 호스트 페이지 → 창 / 워커 | 기존 host smoke·history paging·streaming·visible views·worker 실패/취소 테스트. 데이터 조회 때문에 SDK가 뜨거나 큰 계산이 창에 복귀하면 실패다. |
| AR1 ↔ IT1 | 셸·preload·호스트·renderer·워커의 각 번들 진입점 | 실행 위치 가드, 하네스 경계, 구조적 소비자 검사, 실제 번들 및 CI의 `node scripts/smoke-hosts.mjs out/main`, `node scripts/smoke-preload.mjs out/preload`. 테스트 전용 코드가 제품에서 도달하거나 중복 리스너가 붙으면 실패다. |
| MD1 ↔ UT1 | 구 정규화·diff·블록을 대체한 현행 함수 | 파일·export·요청 단위로 참조를 재조회하고 동형 입력·경계값·순서·취소로 비교한다. 모호한 동적 소비자는 삭제 전까지 확인한다. |

0326~0329의 기존 acceptance가 적용되는 파일은 기존 oracle의 입력과 통과 조건을 이어받는다. 0331 transcript UX, 0332 패널 depth, 0333 SDK 토글의 행위 변경은 별도 핸드오프가 소유한다. 같은 파일에 후속 구현이 먼저 들어오면 재기준화하고 그쪽의 호출자를 다시 센다.

### 검증과 인계

- 구현 전후 동일 표본으로 시간·렌더 수·워커 왕복·저장/조회 행 수를 비교한다. 단순 이동만으로 성능 향상을 주장하지 않는다.
- 작업 단위마다 smoke 또는 기존 직접 테스트를 먼저 수행한다. 마지막에 `app/AGENTS.md`와 `.github/workflows/ci.yml`의 lint·typecheck·Vitest·Node 검사·bundle·host/preload 및 영향받은 성능 게이트를 대조한다. skip·Windows 미측정은 통과 건수에서 분리한다.
- 최종 원장에는 삭제·통합·유지·미확정으로 나눠 파일/심볼, 현재/이전 소유자, 마지막 제품/테스트/도구 소비자, 이유, 실행한 증거를 적는다. 이주 대상 중 미확정 및 제품 우회 실행이 남으면 전체 정리를 완료 처리하지 않는다.

### 설계 기준선에서 수행한 검증

| 실행 | 결과 |
| --- | --- |
| [변경된 모듈의 정적 도달 검사](evidence/reachability.mjs) | 셸·두 호스트·preload·창에서 시작했다. 워커 3개가 창의 Worker URL로 연결됐다. 변경된 제품 소스 중 비도달 파일은 A의 두 파일과 B·C의 각 한 파일이었다. |
| `cd app && node scripts/check-ui-thread.mjs` | 실행 위치 가드 통과. 현재 가드의 범위에서 보고된 위반은 0건이다. |
| `node --test scripts/{harness-boundary,check-ui-thread,measure-ui-inputs}.test.mjs` (app) | 145건 통과, 실패·skip 0건. |
| 기존 Vitest 대상 10개 (app) | 67건 통과, 실패·skip 0건. Claude Timeline.viewport·Exchange.compare·AssistantTurn.copy·WorkActivity.render, OpenCode projection·Timeline.selection, useDiffCompute·usePanelSelection·TurnOutputCards·ArtifactCards.lifecycle. |

이 결과는 정리 전의 기준선이다. 제품 코드 변경 후에는 같은 결과와 새 경로의 직접 단언을 함께 기록한다.

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
