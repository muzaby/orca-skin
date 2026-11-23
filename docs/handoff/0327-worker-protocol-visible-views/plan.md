# Plan — 0327-worker-protocol-visible-views

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력: [0325 plan §6-C C 행 · §6-D](../0325-ui-responsiveness-followup/plan.md) · 0325 첨부 [`input/0324-agent-requests.ko.md`](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md)(요청서 — 본문의 `T08`~`T33`) · [`input/0324-audit.ko.md`](../0325-ui-responsiveness-followup/input/0324-audit.ko.md)(감사) · [0326 plan §10 B9](../0326-transcript-incremental-model/plan.md)(스트리밍 꼬리 — "워커는 단계 C") · **PR #643 소유자 검토(2026-11-20) — rev 2 의 입력**(§4-A 항목별 판정) · **PR #643 소유자 후속 검토 2건(2026-11-20) — rev 3 의 입력**(§4-B 항목별 판정).
> 측정 수치는 실제 소스 함수 재측정이다 — M1~M13 은 V1 세션, M13b·M14~M21 은 rev 2 세션, M22~M25 는 rev 3 세션(§8). 측정 스크립트는 저장소에 두지 않았다 — 같은 입력을 구현 턴의 K1~K12(WU-10)가 다시 잰다.

## 유효 설계 — V1 rev 3 + ΔV1 (선택과 복사) + ΔV2 (꼬리 전환 회귀) + ΔV3 (G1 · 관측 시점 · 세션 귀속) + ΔV4 (G2 · 메시지 완료와 턴 종료) + ΔV5 (G3 · 마지막 토큰 작업의 완료 응답) + ΔV6 (H1 채택 · 선택 취소 경로의 자리 고정)

ΔV2는 ΔV1 적용표 바로 아래 절에 있고 V1 rev 3·ΔV1의 해당 행에 더한다(대체 아님). ΔV3는 ΔV2 바로 아래 절에 있고 그 절의 대체표에 적은 ΔV2 행만 대체한다. ΔV4는 ΔV3 바로 아래 절에 있고 그 절의 대체표에 적은 행만 대체한다. ΔV5는 ΔV4 바로 아래 절에 있고 AC4·D-031·EP-3 ③의 마지막 작업 규칙만 대체한다. ΔV6는 ΔV5 바로 아래 절에 있고 그 절의 대체표에 적은 행(VP-09·14·26·34 · EP-10·EP-20 · AC15·AC35 · ΔV1 VP-50 행의 AT 도구 문장)만 대체한다.

현재 상태는 plan/READY(ΔV6 · 라운드 2)다 — verify 1(RETURN_TO_PLAN)의 H1 을 채택하고 선택 취소 경로 EP-30 을 고정했다. r2 는 ΔV6 와 verify 1 I1·I3·I4 를 닫는다([verify.md](verify.md)). r1.4에서 ΔV5의 마지막 작업 완료와 양보 뒤 재개를 구현했다. r1.3(부분 구현)이 올린 PLAN_GAP G3(AC4 t5 양보 횟수 ↔ EP-3 ③)를 ΔV5로 정정했다. r1.3은 ΔV4의 완료 표시를 구현했다. r1.2(부분 구현)가 올린 PLAN_GAP G2(OpenCode 의 메시지 완료와 턴 종료 사이 표시)를 PR #652 소유자 댓글에 따라 ΔV4로 정정했다. r1이 올린 G1은 ΔV3가 정정했다. 기준은 PR #640의 `13502bc6`, 0326 verify r7의 기계 PASS 구현은 `7244c0c`다. D-003의 착수 선행조건을 충족했다. 0326 AC33 Windows 실기는 별도로 남아 있다.

### D-052 · 선택과 복사의 소유자

사용자 결정(2026-11-23). Claude Code·Claude Work·OpenCode의 transcript, 그 안의 코드·diff 카드, 우측 Git 리뷰(인라인·나란히), 산출물 코드·Markdown 미리보기에서 같은 정책을 쓴다. 사용자가 마운트된 텍스트를 선택하면 Chromium이 기본 복사를 수행한다. 카드나 코드의 명시적 전체 원문 복사 버튼은 기존 버튼 계약을 따른다.

- 각 가상 목록은 **직전 커밋에 없던 안정 행 키가 이번 커밋에 추가됐는지** 관찰한다(0326 D-103). 스크롤로 기존 행이 빠지고 새 행이 들어오는 교체도 이 조건에 해당한다. 제거만 일어난 커밋에는 앱이 별도 취소를 발동하지 않는다. 같은 키의 내용 변경, 행 집합을 유지한 스크롤도 취소 조건에서 제외한다.
- 소유 화면에 주 버튼 드래그가 진행 중이거나 비어 있지 않은 선택의 어느 한 끝이 그 화면 안에 있을 때 새 행이 들어오면 선택과 표시를 해제한다. 놓은 뒤 남은 선택·키보드 선택도 같은 기준이다. 취소된 드래그는 같은 제스처에서 되살아나지 않는다. 주 버튼 해제·pointercancel·창 blur 뒤 새 드래그가 가능하다. 세션·패널 문서 전환 시 이전 제스처와 억제를 정리한다.
- **공통 가상 행 뷰**는 행 키 변화를 소유 화면에 알린다. **transcript viewport·Git 리뷰·산출물 미리보기**는 각 영역 안의 선택만 판정하고 취소한다. 내부 카드·파일 목록의 알림은 해당 소유자 한 곳에서 처리한다. 다른 패널의 마운트로 현재 선택을 지우지 않는다. 기존 0326 선택 판정과 제스처 상태 전이를 공용화하거나 재사용한다.
- **Chromium**이 선택된 텍스트의 복사와 클립보드 기록을 소유한다. 앱이 선택 복사 이벤트를 가로채거나 선택 구간을 핀으로 고정·재구축하거나 복사 전용 DOM·워커·직렬화 작업을 만들지 않는다. Git 초안·요구사항 이동 핀, 스크롤 앵커, 표시용 워커 창은 각자의 기능으로 유지한다.

### ΔV1 적용표

아래 표가 구현·검증 기준이다. 뒤에 보존한 V1 rev 3의 모든 절에서 **선택 복사에 한해** 이 표가 이전 문장·타입·파일·변이·자가 점검을 대체한다. 다른 기능의 규칙과 gate는 승계한다.

| 기존 좌표 | 유효 계약과 검증 |
|---|---|
| D-029·040·049·050, D-013·028·038·051의 선택 핀, WU-8·10, §18 | D-052 적용. 제거된 0326 복사 호스트·viewport/copy 복원, 내부 목록 등록부, copy claim, 복사 조각 상수와 K12 상한 탐색을 구현 대상에서 제외한다. 스크롤·앵커에 쓰는 textOffset은 보존한다. |
| AC15·35 / R-09 ↔ AT-09 / VP-09 | Git 두 보기·산출물 두 보기·transcript 카드 안 및 본문→카드에 적용한다. 행 추가 없이 부분·역방향 선택 후 실제 Ctrl+C와 붙여넣기가 선택한 내용과 일치한다. 행 추가 뒤 선택이 비고 복사해도 기존 클립보드 값이 유지된다. |
| SD-05 ↔ ST-05 / VP-14 · AR-07 ↔ IT-07 / VP-26 · EP-20 | 바깥 행 키가 고정된 채 내부 행만 교체되는 경우, 바깥 목록 교체, 다른 패널만 교체되는 경우를 분리한다. 각 경우 취소·취소·유지 순으로 확인한다. 취소 후 같은 드래그의 move, 놓은 뒤 새 드래그, 키보드 선택과 문서 전환을 검증한다. |
| MD-05 ↔ UT-05 / VP-34 · EP-10 | 추가·교체·제거만·동일 키 갱신과 선택 위치(내부·외부)로 판정 함수를 검증한다. 추가 판정을 크기 비교로 바꾸거나 제거만으로도 참이 되게 바꾸면 테스트가 실패해야 한다. |
| VP-50 회귀 · AC29·30 · S-C8 · K12 | 0326 AT-07을 verify에서 회귀 실행한다. 새 화면은 실제 Electron 마우스·키 입력과 클립보드로 AC15·35를 검증한다. 취소 사례는 실제 새 행 키 관측을 증거로 남긴다. S-C8 Windows에는 정상 복사·취소·재선택·패널 격리 결과를 기록한다. K12 조각 탐색과 복사 전용 50ms 합격 판정은 폐기한다. 나머지 K 측정 및 전체 UI 응답성 검증은 승계한다. |

### ΔV2 · 꼬리 표시 전환의 스크롤·세션 회귀

> ΔV3 가 이 절의 AC39 · V2-6 기대 · EP-13 ④⑤⑧ · EP-26 ①②③ 좌표·술어 · EP-27 ②③ · 하네스 단계·관측·원자료 · 생산 코드 변경 문장을 대체한다(아래 ΔV3 대체표). 나머지 행은 그대로 유효하다.

판정: 제품 범위는 넓히지 않고 검증을 보탠다. 꼬리 표시가 바뀌는 순간과 세션 전환에서 0326의 하단 추적·읽기 위치·비활성 세션 누적이 유지되는지를 AC37~AC39로 잠근다. 새 제품 코드는 꼬리 표시 표지 `data-markdown-tail` 하나다(EP-13 ⑧).

| 항목 | 값 |
|---|---|
| 입력 | PR #640 소유자 댓글(2026-11-23 · 검토 기준 `322b19bd`) — "0327 구현 인계 — transcript 스트리밍 Markdown과 스크롤 회귀 검증" |
| V mode | `Delta V` — 기준 `V1 rev 3 + ΔV1`(구현·verify 0회) |
| 이번 V revision | `ΔV2` — 설계 커밋 `(ΔV2 설계 — 검증자 기입)` |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2` |
| 변경이 시작되는 수준 | R(R-05 CHANGED) → SD-07 NEW · MD-06 CHANGED · MD-15 NEW · 0326 INHERITED 회귀 3 |
| 줄 참조 트리 | `322b19bd` app 트리(이번 세션 `rg` 실측) |
| 신규 의존성 | 0 — 실측 하네스는 이미 devDependency 인 Electron·Vite 와 0326 하네스 틀을 쓴다 |

#### ΔV2 Decision Ledger

| ID | 결정 | 근거(원문) | 출처 | 상태 | 관계 |
|---|---|---|---|---|---|
| D-053 | 꼬리 표시가 바뀌는 순간(창 파싱 → 4,001자 진입 원문 → 워커 결과 반영 → 50,001자 원문 → 블록 확정 → 턴 완료)과 세션 전환에서 0326의 하단 추적·읽기 위치·비활성 세션 누적을 유지한다. 합격 기준은 화면의 본문과 스크롤이고 글자별 읽기 위치 저장 기능은 만들지 않는다 | "plan에 추가할 내용은 표시 방식이 바뀌는 순간에도 0326의 스크롤 동작이 유지되는지 확인하는 회귀 시나리오입니다" · "합격 기준은 사용자가 보는 본문과 스크롤입니다. 글자별 읽기 위치를 새로 저장하는 기능은 추가할 필요가 없습니다." | PR #640 소유자 댓글 | ACTIVE | D-035 검증 보완 · 0326 D-045·D-056 승계 |
| D-054 | 꼬리 경로의 판정 입력은 표시할 꼬리(열린 펜스가 아닌 미완성 꼬리)의 길이 하나다. 한 번에 받은 조각 크기·턴 전체 길이·확정 블록 길이는 쓰지 않는다 — ≤ 4,000 창 파싱 · 4,001~50,000 워커 · ≥ 50,001 요청 없이 원문 | "한 번에 수신한 조각의 크기와 한 턴 전체 길이는 워커 전환 기준에서 제외합니다." · "4,000자 이하는 기존 렌더러 파싱, 4,001~50,000자는 Markdown 워커 파싱, 50,001자부터는 새 파싱 요청 없이 해당 꼬리를 원문으로 표시합니다." | 같은 댓글 | ACTIVE | D-035 보완(대체 아님) · D-019·D-033 수치 그대로 |
| D-055 | 블록 확정·세션 전환 뒤 도착한 꼬리 결과는 현재 꼬리의 접두일 때만 표시한다. 이전 문장이 두 번 보이거나 다른 세션 화면에 보이면 실패다 | "결과가 현재 꼬리의 접두와 일치할 때만 해당 결과와 남은 원문을 함께 표시합니다. 블록 확정·세션 전환 뒤 늦은 결과가 이전 문장을 중복 표시하거나 다른 세션에 나타나면 실패입니다." | 같은 댓글 | ACTIVE | EP-13 ④⑤ 입력 확장 |

갱신 메모(ΔV2):

- 기존 ACTIVE 결정은 전부 유지한다 — SUPERSEDED 0 · OPEN 0. 댓글이 사용자에게 다시 물을 선택지를 남기지 않았다(아래 대조 표 전 행이 일치 또는 입력 보탬).
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-053 ↔ AC37·AC38·AC39(하단 거리·문장 위치·표지 횟수·요청 수만 단언하고 위치 저장을 요구하지 않음) · D-054 ↔ AC26 s11·s12 · D-055 ↔ AC39 bg3 · AC26 s14·s15 · D-035 ↔ AC26(문장 변경 없음) · D-052 ↔ ΔV2(선택을 만들지 않음 — U1 은 휠만 쓴다).
- 같은 대상 여러 절 대조: 임계 — D-019 "4,000" · D-033 "꼬리 > 50,000자는 원문" · D-035 "꼬리 > 4,000자만" · EP-13 ① `tail.length > MARKDOWN_WORKER_MIN_CHARS` · ⑥ `tail.length > MARKDOWN_BLOCK_MAX_CHARS` · D-054 "4,001~50,000 워커" · AC37 단계 `4,001`·`50,001` — 모두 같은 경계다.

#### 댓글 ↔ plan·코드 대조

| 댓글 문장 | 대조(plan · `322b19bd` 코드) | 판정 |
|---|---|---|
| 비활성 세션에 조각이 와도 활성 transcript 본문은 갱신되지 않는다 | `chatStore.test.ts:350-372` 활성 엔트리 identity 불변 단언 · 꼬리 원문 공급자 `useLiveText`(`chatStore.ts:2524`)·`useLiveTextFor`(`:2777`) 둘 다 `s.sessions[s.activeKey]` | 일치 — 화면까지 잇는 증거가 없다 → AC39 |
| 증분 스캐너로 확정 블록·꼬리 분리 · 열린 펜스 전용 뷰 | `StreamingMarkdown.tsx` `advanceStableBlocks` · `StreamingFence` · EP-13 ① | 일치 |
| 조각 크기·턴 전체 길이는 판정에서 제외 | EP-13 ① 술어는 `tail.length` — AC26 입력(s1~s10)에 꼬리 길이를 전체 길이·조각 크기와 가르는 입력이 없다 | 입력 보탬 — D-054 · s11·s12 |
| 공통 viewport 가 하단 추적·스크롤 보정을 소유 | 쓰기 함수 `writeScrollTop` 하나(0326 D-045) · 하단 추적은 하네스 설정 — Claude `useScrollAnchor.ts:103-106` · OpenCode `ScrollController.tsx:174-185` · TanStack 보정 끔 `TranscriptViewport.tsx:439` | 일치 — EP-26 ③~⑦ 이 회귀 자리 |
| 4,000/4,001/50,000/50,001 · 노드 예산 원문 · 산출물은 문서 전체 길이 | D-019 · D-033 · D-045 "꼬리 결과도 같다" · EP-13 ①⑥ | 일치 |
| 실행 1 + 최신 대기 1 · 접두 일치 · 블록 확정/세션 전환 뒤 늦은 결과 | D-035 · EP-13 ③④⑤ — 확정 뒤·세션 전환 뒤 입력이 s1~s10 에 없다 | 입력 보탬 — D-055 · s14·s15·bg3 |
| 턴 완료 뒤 완료 메시지 경로 | D-035 · AC26 s9 | 일치 |

#### 조사 결과 (`322b19bd`)

| 대상 | 검색 / 위치 | N | 의미 |
|---|---|---|---|
| Claude 하단 추적 | `rg -n "new ResizeObserver\(" …/claude/transcript/useScrollAnchor.ts` | 1 (`:103`) | 내용 높이가 바뀔 때마다 `shouldFollowGrowth`(pin + 생성 중)면 `writeScrollTop(el, el.scrollHeight)` — store 변경 없이 오는 워커 결과 높이도 따른다 |
| OpenCode 하단 추적 | `…/opencode/transcript/ScrollController.tsx` | 1 (`:185`, 콜백 `:174-183`) | 다음 프레임에 `state.pinned` 면 `writeTop(el.scrollHeight)` — 관측은 프레임 2개 뒤여야 한다 |
| 위로 읽는 위치 | `TranscriptViewport.tsx:439` · `:381-418` | — | TanStack 크기 보정 끔 · 화면 위에서 시작한 행의 크기 변화는 앵커 문자로 복원. 꼬리는 앵커 문자 아래라 복원 쓰기 0 이 기대값이다 |
| 세션 전환 | `liveBlockKey(sessionKey)` `claudeBlocks.ts:926`·`:1033` · `remountTranscriptBySession` | Work 만 true(`claude/presentation.ts:19`) · Code `:37`·OpenCode `opencode/presentation.ts:8` false | Code·OpenCode 는 transcript 를 다시 마운트하지 않는다. Claude 라이브 행 key 에 세션 키가 있어 세션마다 새 꼬리 인스턴스다 |
| 블록 확정 | `markdownBlocks.ts` 경계 — 빈 줄 뒤 비공백 줄에서 앞 줄·새 줄 모두 목록·들여쓰기가 아닐 때 | — | 목록 꼬리는 뒤에 문단이 와도 확정되지 않는다 → 회귀 fixture 는 빈 줄 없는 긴 문단 |
| 실측 하네스 틀 | `scripts/check-transcript-selection.mjs` — Vite 빌드 `worker: { format: 'es' }` · production `TranscriptView` · `sendInputEvent` | 0326 verify r4~r7 `xvfb-run` exit 0(Electron 39.8.10 · linux) | 실제 Markdown 레인 워커와 실제 layout 을 같은 틀로 잴 수 있다 |

#### ΔV2 Acceptance Criteria

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-05 | AT-05 / AC37 | **하단을 따라가며 봄.** 세 화면(Claude Code · Claude Work · OpenCode)에서 생성 중 하단의 사용자. 한 미확정 꼬리(빈 줄 없는 문단)가 4,000 → 4,001자(원문 진입 → 워커 결과 반영) → 50,000자(워커 결과) → 50,001자(원문) → 블록 확정 → delta 3개를 지나는 동안 매 전환 뒤 하단 거리 ≤ 1px(0326 D-109 ⑤) · 마지막 delta 표지가 화면 안 · 보낸 줄 표지가 본문에 한 번씩 | AT `check-transcript-streaming.mjs` P1 — 화면 3 × 3회 · 실제 Markdown 레인 워커 · 실제 layout(아래 하네스 계약) | delta → 활성 세션 live → 라이브 행 → `StreamingMarkdown` → `WorkerMarkdownTail` → 행 높이 → 하단 추적 쓰기 |
| R-05 | AT-05 / AC38 | **위로 올려 확정 문단을 읽음.** 같은 입력을 재생하되 실제 휠로 올려 같은 답변의 확정 문단 문장이 화면 맨 위, 꼬리 전체가 화면 아래에 있다. 매 전환 전후와 그 뒤 delta 3개 뒤에 그 문장의 화면 위치 차 ≤ 1px(0326 AC20·D-109 ⑤) — 하단 추적이 저절로 켜지지 않는다. 줄 표지 규칙은 AC37 과 같다 | AT 같은 하네스 U1 | 같은 경로 → 행 높이 → pin 아님: 하단 추적 쓰기 0 · TanStack 보정 끔 · 앵커 복원 쓰기 0 |
| R-05 | AT-05 / AC39 | **A를 보는 동안 B에 답변 도착.** 세 화면에서 B 의 delta(꼬리 4,001자 이상 포함)·완료는 B 엔트리에 누적되고, 그동안 `markdown` 요청 0 · 창 Markdown 파싱 0 · A 엔트리 identity 와 A 화면 텍스트 불변. 생성 중 B 로 돌아가면 B 최신 꼬리(보낸 줄 표지 한 번씩 · 마지막 표지 포함 · A 표지 0)가 원문 → 워커 결과로 보인다. 완료 뒤 돌아가면 완료 경로 렌더(꼬리 표지 없음)다. 전환 순간 실행 중이던 A 꼬리 결과가 늦게 와도 B 화면의 A 표지 0 | IT `streamingSessions.test.ts` bg1~bg4 — production store · 세 화면 `TranscriptView` · 가짜 계산 클라이언트 · `react-markdown` default spy | `ingestChatEvent(B)` → B 엔트리 · 활성 선택자 → A 화면 · 전환 → B 라이브 행 → 꼬리 |
| R-05 | AT-05 / AC26 (ΔV2 보탬) | V1 rev 3 문장 그대로 + 입력: 판정은 꼬리 길이만 쓴다(D-054) · 표지 세 값(EP-13 ⑧) · 확정 뒤 늦은 결과는 줄을 두 번 보이지 않는다(D-055) | `WorkerMarkdownTail.test.ts` s11~s15(EP-13 아래 표) | V1 rev 3 그대로 |

AC 검증 주의(ΔV2):

- 사람 실기 0이다. 위치·하단 거리는 에이전트가 띄울 수 있는 실제 Chromium(Electron)에서 잰다(0326 verify r4~r7 선례). Electron 바이너리가 없으면 exit 3 `환경 없음`이고 AC37·AC38 은 미완료로 남는다(PASS 아님).
- 음성 단언은 양성과 짝짓는다 — bg1 의 요청 0 은 B 로 돌아간 뒤 같은 꼬리의 `markdown` 요청 ≥ 1 과, U1 의 이동 0 은 같은 화면 P1 의 하단 추적과 등록 변이 V2-2~V2-4 red 로 방향을 확인한다.
- "전환 뒤" 관측 시점은 그 단계 커밋 뒤 animation frame 2개다 — OpenCode 하단 추적이 다음 프레임에 쓴다(`ScrollController.tsx:175-179`).

#### ΔV2 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-05 | R | 스트리밍 꼬리 — AC26·AC27 + AC37~AC39 | CHANGED | V1 rev 3 R-05 |
| AT-05 | AT | 위 AC 묶음 | CHANGED | V1 rev 3 AT-05 |
| SD-07 | SD | 꼬리 표시 전환 × 스크롤 소유자 × 세션 — 창 파싱 → 원문(진입) → 워커 반영 → 원문(50,001 · `tooLarge`) → 블록 확정 → 완료 경로 / 비활성 누적 → 복귀 → 늦은 결과 | NEW | — |
| ST-07 | ST | SD-07 종단 증거 | NEW | — |
| MD-06 | MD | 꼬리 상태 + 판정 입력 = 꼬리 길이(D-054) · 표시 표지(EP-13 ⑧) · 확정 뒤 늦은 결과(D-055) | CHANGED | V1 rev 3 MD-06 |
| UT-06 | UT | MD-06 국소 증거 | CHANGED | V1 rev 3 UT-06 |
| MD-15 | MD | 실측 판정기 — 기록 격자·단계·허용치·종료 코드 fail-closed(EP-27) | NEW | — |
| UT-15 | UT | MD-15 국소 증거 | NEW | — |
| MD-0326-PIN | MD | 0326 하단 추적 정책 p1·p2/p6·p9 | INHERITED | `0326:V1 rev 7` MD-11 — `pin.test.ts` 3건 |
| MD-0326-ANCHOR | MD | 0326 위쪽 변위 앵커 a1~a12 | INHERITED | `0326:V1 rev 7` MD-12 — `anchor.test.ts` 10건 |
| R-0326-BG | R | 비활성 세션 누적 · 활성 엔트리 불변 | INHERITED | `chatStore.test.ts:'비활성 세션의 이벤트는 그 엔트리에 백그라운드 누적되고 활성 엔트리는 불변'`(`322b19bd` 트리) |

SUPERSEDED 0 — pair 이관 해당 없음. VP-46(열린 펜스)·VP-47(transcript 단일 뷰포트)은 V1 rev 3 행 그대로 REGRESSION 이고, 꼬리 경로가 같은 뷰포트를 지나므로 ΔV2 뒤에도 다시 실행한다.

#### ΔV2 Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-05 | R-05 ↔ AT-05 | REQUIRED (ΔV2 CHANGED) | delta → 활성 세션 live → `StreamingMarkdown` → 임계(꼬리 길이) → `WorkerMarkdownTail`(원문 → hast · 원문 최종) → 행 높이 → 하단 추적 \| 위치 유지 · 완료 → 완료 경로 | V1 rev 3 좌표 + AC37 = AT P1 · AC38 = AT U1 · AC39 = IT bg1~bg4 · AC26 = s11~s15 | required — V1 rev 3 두 변이 + 임계 입력을 `source.length` 로 바꾸는 변이(s11 red) | EP-13 (8) · EP-26 (9) 공유 |
| VP-52 | SD-07 ↔ ST-07 | REQUIRED (ΔV2 NEW) | 위 경로 + 세션 전환(`activeKey` 바뀜 → 라이브 행 key 바뀜 → 새 꼬리 인스턴스) · 블록 확정(꼬리 시작 이동) | EP-26 자리별 좌표(아래 표) · EP-13 ④⑤ s14·s15·bg3 | required — 등록 변이 V2-1~V2-6(아래) — 이동 0·요청 0 주장의 방향 확인 | EP-26 (9) · EP-13 ④⑤ |
| VP-35 | MD-06 ↔ UT-06 | REQUIRED (ΔV2 CHANGED) | `StreamingMarkdown` 임계 · `WorkerMarkdownTail` 상태·표지 | V1 rev 3 좌표 + s11~s15 | VP-05 와 같음 + 표지 `final` 분기를 `raw` 로 바꾸는 변이(s13d red) | EP-13 (8) |
| VP-56 | MD-15 ↔ UT-15 | REQUIRED (ΔV2 NEW) | 원자료 기록 → `judgeStreamingRuns` → `stepShapeFailures`·`pinStepFailures`·`unpinStepFailures` → 판정 · `main` 종료 코드 | `check-transcript-streaming.test.mjs` ks1~ks9 | required — 허용치 `≤ 1` 을 `≤ 2` 로 바꾸는 변이(ks3·ks4 red) · 빠진 기록 검사 제거(ks2 red) | EP-27 (5) |
| VP-53 | MD-0326-PIN ↔ UT | REGRESSION | `pinPolicy` | `pin.test.ts` 3건 | not selected — VP-52 가 꼬리 경로에서 고른다 | — |
| VP-54 | MD-0326-ANCHOR ↔ UT | REGRESSION | `captureAnchor` → `restoreAnchor` | `anchor.test.ts` 10건 | not selected — 위쪽 변위 복원은 꼬리 입력이 부르지 않는다(EP-26 실패 의미) | — |
| VP-55 | R-0326-BG ↔ AT | REGRESSION | `ingestChatEvent(bg)` → bg 엔트리 | `chatStore.test.ts` 위 1건 | not selected — bg1 이 화면까지 잇는다 | — |

등록 변이(VP-52 — 자리 고정):

| ID | 자리 | 종류 · 바꾼 내용 | 기대 red |
|---|---|---|---|
| V2-1 | EP-26 ④ `useScrollAnchor.ts:105` | 제거 · `writeScrollTop(el, el.scrollHeight)` | P1 claude-code·claude-work(`parsed@4001` 부터) |
| V2-2 | EP-26 ⑤ `ScrollController.tsx:179` | 뒤집기 · `if (state.pinned)` → 늘 참 | U1 opencode-code |
| V2-3 | EP-26 ⑥ `pin.ts:69` | 제거 · `if (!state.pinned) return false` | U1 claude-code·claude-work |
| V2-4 | EP-26 ⑦ `TranscriptViewport.tsx:439` | 다른 값 · `() => false` → `() => true` | U1 세 화면 |
| V2-5 | EP-26 ③ `WorkerMarkdownTail` 뿌리 | 다른 값 · 뿌리에 `max-h-[384px] overflow-auto` | P1 세 화면(마지막 표지 화면 밖) |
| V2-6 | EP-13 ④ | 제거 · 접두 검사(`tail.startsWith(parsed.text)`) | s14·s15(줄 표지 2회) · bg3(B 화면에 A 표지) |

#### ΔV2 §10 강제 지점

**EP-13 보탬**(V1 rev 3 행에 더한다 · 자리 7 → 8):

| 자리 | 규칙(분기) | 직접 oracle 좌표 — 분기마다 입력 |
|---|---|---|
| ① (D-054 보탬) | 판정 입력 = 열린 펜스가 아닌 꼬리 길이. 조각 크기·`source.length`·확정 블록 길이를 쓰지 않는다 | s6(꼬리 4,000 → `Markdown`) · s11(전체 60,000 · 꼬리 3,999 → `Markdown` · 요청 0) · s12a(한 delta 10,000자가 블록을 확정해 꼬리 2,000 → 요청 0) · s12b(한 delta 로 만든 꼬리 4,001 → `WorkerMarkdownTail` · 요청 1 = 50자 delta 로 만든 같은 꼬리의 표지·요청 수) |
| ④⑤ (D-055 보탬) | 블록 확정 뒤 늦은 결과는 새 꼬리의 접두일 때만 쓴다 | s14(꼬리 10,000 결과 실행 중 → 확정 뒤 새 꼬리 ≤ 4,000 → `WorkerMarkdownTail` 언마운트 → 늦은 결과 → 줄 표지 한 번씩) · s15(확정 뒤 새 꼬리 5,000 → 같은 자리 인스턴스 → 이전 결과 → 새 꼬리 원문만 · 표지 `raw` → 새 결과 → `parsed`) · bg3(세션 전환) |
| ⑧ (신규) | 뿌리 요소 `data-markdown-tail` = `raw`(결과 없음 · 접두 아닌 결과) · `parsed`(접두 결과 hast + 나머지 원문) · `final`(꼬리 > 50,000 · 결과 `tooLarge`) | s13a(결과 전 → `raw`) · s13b(접두 결과 → `parsed`) · s13c(접두 아닌 결과 → `raw`) · s13d(50,001자 → `final` · 요청 0) · s13e(`tooLarge` → `final`) |

EP-13 검색 명령은 V1 rev 3 명령의 술어에 `|data-markdown-tail` 을 더한다(구현 뒤 자리 8).

**EP-26 · SD-07 / VP-52 — 꼬리 전환 × 스크롤 소유자 × 세션** — 자리 9. 0326 코드 자리는 고치지 않는다. 0327 꼬리 전환이 그 자리를 지나므로 이 pair 의 분모에 넣고 ST-07 좌표로 닫는다.

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 |
|---|---|---|---|
| ① | `chatStore.ts:2523-2525` `useLiveText` | Claude 라이브 행 원문 = 활성 세션 live text | bg1(claude-code·claude-work — B delta 동안 A 화면 텍스트 불변 · 요청 0) · bg2(B 복귀 → B 표지만) |
| ② | `chatStore.ts:2776-2778` `useLiveTextFor` | OpenCode 라이브 행 원문 = 활성 세션 live text(`enabled` 참) | bg1·bg2(opencode-code) |
| ③ | `WorkerMarkdownTail` 뿌리(`data-markdown-tail` 줄) | 흐름 배치 — 자기 스크롤·높이 상한이 없어 꼬리가 자라면 라이브 행이 자란다 | P1 `parsed@4001`·`final@50001` 의 마지막 표지 화면 안 |
| ④ | `useScrollAnchor.ts:100-107` 내용 RO | `shouldFollowGrowth` 참 → `writeScrollTop(el, el.scrollHeight)` · 거짓 → 쓰기 0 | P1(claude 두 화면 — `parsed@4001` 은 store 변경 없는 높이 변화) · U1(같은 두 화면) |
| ⑤ | `ScrollController.tsx:174-185` RO `resize` | `state.pinned` → 다음 프레임 `writeTop(el.scrollHeight)` · 아니면 쓰기 0 | P1 · U1(opencode-code) |
| ⑥ | `pin.ts:68-71` `shouldFollowGrowth` | pin 아님 → false · Claude pin + 생성 중 → true | U1 · P1(claude 두 화면) |
| ⑦ | `TranscriptViewport.tsx:439` | 화면 위에서 시작한 라이브 행이 커져도 TanStack 보정 쓰기 0 | U1 세 화면(전제 `rowTopAbove`) |
| ⑧ | `AssistantSegment.tsx:41` `case 'text'` | 완료 메시지 = 완료 경로 `<Markdown>` | bg4(claude-code·claude-work) |
| ⑨ | `opencode/transcript/Text.tsx:22` `streaming ?` | 생성 중 → `StreamingMarkdown` · 완료 → `Markdown` | P1(opencode — 생성 중) · bg4(opencode — 완료) |

- 자리 검색 명령(`app/` · bash): `rg -n "useChatStore\(\(s\) => (\(enabled \? )?s\.sessions\[s\.activeKey\]\.live\.text\b|shouldFollowGrowth\(state, generating\) \{|^\s+virtualizer\.shouldAdjustScrollPositionOnItemSizeChange = |case 'text':|streaming \?" src/renderer/src/features/chat/{store/chatStore.ts,lib/transcript/viewport/pin.ts,components/transcript/TranscriptViewport.tsx,harnesses/claude/transcript/AssistantSegment.tsx,harnesses/opencode/transcript/Text.tsx}; rg -n "new ResizeObserver\(" src/renderer/src/features/chat/harnesses/{claude/transcript/useScrollAnchor.ts,opencode/transcript/ScrollController.tsx}; rg -n "data-markdown-tail" src/renderer/src/features/chat/components/markdown --glob '!*.test.*'` → `322b19bd` 8줄(①②④~⑨) + 구현 뒤 ③ 1줄 = 9.
- 넓은 후보에서 뺀 줄(이유): `TranscriptViewport.tsx:592` 머리 자리 RO(꼬리 변화가 닿지 않음) · `useScrollAnchor.ts:94`·`:148`·`ScrollController.tsx:74`·`:115`(맨 아래로 버튼·진입 배치 — 꼬리 전환이 부르지 않음) · `TranscriptViewport.tsx:381-418` 앵커 복원 — 꼬리는 앵커 문자 아래라 복원 쓰기 0 이 기대값이고 복원을 지워도 U1 관측이 같다. 위쪽 변위 복원은 VP-54 가 잠근다.
- 실패 의미: ④~⑦ 이 빠지면 워커 결과처럼 store 변경 없이 오는 높이 변화에서 하단을 놓치거나(P1) 위로 읽는 사람의 문장이 꼬리 증가만큼 밀린다(U1). ①② 가 비활성 세션을 읽으면 A 화면에 B 글이 보이고 B delta 마다 요청이 생긴다. ⑧⑨ 가 꼬리 경로로 바뀌면 완료 뒤에도 원문 표시·요청이 남는다.
- 선언 경계 B25: U1 은 꼬리 전체가 화면 아래인 입력만 판정한다. 꼬리 일부가 화면 안에 보이는 unpin 상태와, 꼬리가 줄어 문서 끝이 화면 안으로 올라와 브라우저가 `scrollTop` 을 줄이는 경우는 다루지 않는다(보호 주장 없음).
- 선언 경계 B26: Claude 사고 본문 꼬리(`ReasoningBlock.tsx:38`)도 같은 `StreamingMarkdown` 을 지나지만 AC37~AC39 입력은 답변 본문뿐이다.

**EP-27 · MD-15 / VP-56 — 실측 판정기** — 자리 5. 이름은 계약이다.

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 |
|---|---|---|---|
| ① | `judgeStreamingRuns` 격자 | 화면 3 × {P1, U1} × 3회 — 모르는 기록 `reason: 'unknown record'` · 빠진 기록 `reason: 'missing record'` | ks1(통과 격자) · ks2(빠진 기록) |
| ② | `stepShapeFailures` 단계 | 단계 순서·꼬리 길이(4,000 · 4,001 · 4,001 · 50,000 · 50,001)·표지 기대(`null` · `raw` · `parsed` · `parsed` · `final` · `null`) 불일치 → 실패 | ks6(`parsed` 미관측) · ks7(꼬리 4,002) |
| ③ | `pinStepFailures` P1 | 하단 거리 ≤ 1 · 마지막 표지 화면 안 · 표지 1회 | ks3(하단 거리 1.5) · ks5(표지 2회) |
| ④ | `unpinStepFailures` U1 | `|offset − offset₀| ≤ 1`(`after` 포함) · 전제 `tailBelow`·`rowTopAbove` 참 | ks4(offset 1.5) · ks8(전제 거짓) |
| ⑤ | `main` 종료 코드 | 바이너리 없음 → `reason: '환경 없음'` exit 3 · 실행 실패 → exit 1 | ks9(둘 다) |

- 자리 검색 명령(`app/`): `rg -n "^export (async )?function (judgeStreamingRuns|stepShapeFailures|pinStepFailures|unpinStepFailures|main)\b|reason: '(unknown record|missing record|환경 없음)'" scripts/check-transcript-streaming.mjs` → 구현 뒤 8줄 — ① 정의 + 두 사유 줄 · ②③④ 정의 각 1 · ⑤ 정의 + `환경 없음` 줄.
- 실패 의미: 판정기가 느슨하면 나쁜 기록이 통과한다. 모르는 형태는 실패로 막는다(fail-closed) — 놓친 단계는 거짓 통과가 아니라 보이는 실패가 된다.

#### ΔV2 실측 하네스 계약 (AC37·AC38)

| 항목 | 계약 |
|---|---|
| 실행 | `cd app && xvfb-run -a node scripts/check-transcript-streaming.mjs` — exit 0 통과 · 1 판정 실패·하네스 오류·실행 실패 · 3 Electron 바이너리 없음. CI 단계에 넣지 않는 verify 실행 도구다(0326 D-107 과 같음) |
| 재사용 | `check-transcript-selection.mjs` 의 `resolveElectron`·`serveProbe`·`runElectron` 을 probe 경로만 바꿔 쓴다(공용 모듈 추출 가능). 새 probe `scripts/transcript-streaming/probe.tsx` 는 production `TranscriptView`·store·`ingestChatEvent`·실제 계산 클라이언트(Markdown 레인 워커)를 쓴다. 창은 0326 probe 와 같은 900 × 560px |
| fixture | 생성 중 세션에 text delta 로 답변을 넣는다. 답변 = 확정 문단 C01~C40(문단마다 3줄 · 줄마다 고유 표지 `Cnn-k`) + 빈 줄 + 꼬리 문단(빈 줄 없는 줄 · 줄마다 고유 표지 `T00001`… · 줄 ≈ 80자). 확정 delta = `\n\n` + `F0001 …\n`. 꼬리 길이는 probe 가 production `advanceStableBlocks` 로 계산해 기록한다 |
| 단계(순서 고정) | `sync@4000` → `enter@4001`(표지 `raw`) → `parsed@4001` → `parsed@50000` → `final@50001` → `finalized`(표지 없음 · 확정 블록 +1) → `after`(F 줄 delta 3개 뒤) |
| 관측 시점 | 단계 커밋 뒤 animation frame 2개. `parsed@…` 는 표지가 `parsed` 가 될 때까지 프레임마다 확인하고 5초를 넘으면 그 칸 `error: 'no worker result'` |
| P1 측정 | 매 단계 하단 거리 `scrollHeight − clientHeight − scrollTop` · 마지막 표지 rect 가 스크롤 요소 rect 안(±0.5px) · 보낸 표지마다 라이브 행(`[data-block-key]`) 텍스트(`[data-transcript-chrome]` 제외)의 출현 수 |
| U1 측정 | `sync@4000` 에서 실제 휠(`sendInputEvent` mouseWheel)로 올려 꼬리 뿌리 위끝 ≥ 스크롤 요소 아래끝 + 1px(`tailBelow`) · 라이브 행 위끝 < 스크롤 요소 위끝(`rowTopAbove`)인 위치에 멈춘다. 화면 위끝 아래 첫 `C` 표지를 기준 문장으로 정하고 매 단계 `offset` = 표지 rect top − 스크롤 요소 rect top |
| 원자료 | 기록마다 `{screen, scenario, run, steps[{step, tailLength, view, bottomDistance?, latestVisible?, offset?, missing[], duplicated[]}], preconditions?, error?}` 을 stdout JSON 으로 내고 판정기(EP-27)가 다시 계산한다 |

#### ΔV2 구현 설계 · 파일

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `features/chat/components/markdown/WorkerMarkdownTail.tsx`(신규 — V1 rev 3) | 꼬리 | + EP-13 ⑧ 표지. 뿌리는 흐름 배치(EP-26 ③) | s13 |
| `features/chat/components/markdown/WorkerMarkdownTail.test.ts` | 꼬리 UT | + s11~s15 | 가짜 계산 클라이언트(`fakeClient.testfixture`) · `react-markdown` spy |
| `features/chat/components/transcript/streamingSessions.test.ts`(신규) | AC39 IT | bg1~bg4 — production `useChatStore`·`ingestChatEvent` · 세 화면 `TranscriptView`(`TranscriptViewport.harness.test.ts` 의 production 하네스 조립) · 가짜 계산 클라이언트(요청 수·늦은 응답 제어) · `react-markdown` default spy | 렌더 하네스 |
| `app/scripts/check-transcript-streaming.mjs`(신규) · `.test.mjs`(신규) · `scripts/transcript-streaming/probe.tsx`(신규) | AC37·AC38 실측 · 판정기 | 위 하네스 계약 · EP-27 | ks1~ks9(순수 판정 · 주입 `MAIN_DEPS`) |
| `app/AGENTS.md` | 스크립트 목록 | `check-transcript-selection.mjs` 항목 옆에 새 verify 실행 도구 한 줄 | `check-doc-inventory.mjs --check` |

- 테스트 소스 규칙: 새 테스트 파일은 `[test-pools]`·예산 가드 위반 0 이어야 한다(§7-A 운영 gate). `streamingSessions.test.ts` 는 자식 프로세스·SQLite 를 쓰지 않는 unit 이다.
- 생산 코드 변경은 `WorkerMarkdownTail` 표지와 흐름 배치뿐이다. EP-26 의 0326 자리를 고쳐야 AC37~AC39 가 통과하면 그것은 0326 결함의 현재 결함 발견이다 — 구현자는 고치고 `[구현자 기입] 놓친 잠재 문제`에 적는다.

#### ΔV2 운영 gate (§7-A 표에 더한다)

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| 꼬리 전환 실측 | AC37·AC38 | `cd app && xvfb-run -a node scripts/check-transcript-streaming.mjs` → exit 0 · 원자료 JSON 을 verify `evidence/` 에 둔다 | exit 1 · exit 3 은 그 AC 미완료(환경 없음으로 보고 — PASS 아님) |
| 0326 선택 실측 회귀 | 꼬리 경로가 같은 transcript 를 지난다(ΔV1 VP-50 행과 같음) | `xvfb-run -a node scripts/check-transcript-selection.mjs` → exit 0 | 같음 |

#### ΔV2 READY self-review (관측)

- Decision: D-053~D-055 ACTIVE · 원문 인용 · SUPERSEDED 0 · OPEN 0 — 위 Ledger.
- 조건절 재해석 없음: "글자별 읽기 위치를 새로 저장하는 기능은 추가할 필요가 없습니다" → 저장 기능 0, 위치 단언만(AC38).
- V: Delta V(기준 V1 rev 3 + ΔV1) · NEW·CHANGED 왼쪽 노드 R-05·SD-07·MD-06·MD-15 ↔ REQUIRED VP-05·VP-52·VP-35·VP-56 · 영향받은 INHERITED VP-53~55 + VP-46·VP-47 REGRESSION · NOT_REQUIRED 0.
- 분모: EP-26 검색 `322b19bd` 8줄 실측 + 구현 뒤 1 · EP-13 7 → 8 · EP-27 구현 뒤 8줄(자리 5).
- 규칙 칸 ↔ 입력 칸: EP-13 ①(꼬리 ≤ 4,000 · 전체 > 4,000 · 큰 조각 확정 · 큰 조각 꼬리) ↔ s6·s11·s12a·s12b · ⑧(다섯 분기) ↔ s13a~e · EP-26 ④⑤⑥(pin · pin 아님) ↔ P1·U1 · ⑨(생성 중 · 완료) ↔ P1·bg4 · EP-27 ①~⑤ ↔ ks1~ks9.
- 방향: "쓰여야 한다"(하단 추적) 자리는 쓰기를 지우는 V2-1 이, "쓰지 않는다"(unpin) 자리는 늘 쓰게 바꾸는 V2-2~V2-4 가 red 여야 한다.
- 수치 계약 런타임: ±1px 는 실제 Chromium 에서 잰다 · 사람 실기로 미룬 것 0.
- 선언 경계: B25·B26(측정한 보호 주장 없음). 열린 입력 집합(판정기)은 fail-closed(EP-27 ①②).
- 후보 표 겹침: 0327 행(D-026 완료 블록 · D-039 펜스 가상화)은 완료 경로를 바꾸지 않는다 — ΔV2 는 완료 경로를 회귀로만 본다(EP-26 ⑧⑨).

### ΔV3 · G1 정정 · 하네스 관측 시점 · 비활성 세션 귀속

> ΔV4 가 이 절의 AC39 bg4 행을 대체한다(아래 ΔV4 대체표). 나머지 행은 그대로 유효하다.

판정: ΔV2 의 변이 기대·하네스 단계·AC39 입력을 정정한다. 제품 범위는 그대로이고, 새 생산 코드는 꼬리 표지 속성 하나(`data-markdown-tail-parsed`)가 늘어난다. 스크롤 코드는 0326 이 계속 소유한다.

| 항목 | 값 |
|---|---|
| 입력 | r1 `[구현자 기입] 설계 리뷰` G1(`66d8191d`) · PR #652 소유자 댓글 "0327 구현 재개 전 plan 보완 요청 · `66d8191d`"(2026-11-23) |
| V mode | `Delta V` — 기준 `V1 rev 3 + ΔV1 + ΔV2` |
| 이번 V revision | `ΔV3` — 설계 커밋 `(ΔV3 설계 — 검증자 기입)` |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2 + ΔV3` |
| 라운드 | 1 — verify 0회. 다음 impl 턴은 `r1.2` |
| 변경이 시작되는 수준 | R(AC39 CHANGED · AC37·AC38 완료 단계 보탬) → VP-52 V2-6 기대 · EP-13 ④⑤⑧ · EP-26 ③ 술어 · EP-27 ②③⑥ · 하네스 단계표 |

#### ΔV3 Decision Ledger

| ID | 결정 | 근거(원문) | 출처 | 상태 | 관계 |
|---|---|---|---|---|---|
| D-056 | AC39 입력은 A·B 가 동시에 생성 중인 상태다. 저장소는 B 이벤트 처리 직전·직후 A 엔트리 참조가 같고 B 원문이 누적된다. 화면은 세션별 고유 표지로 입력을 가려, B 가 비활성인 동안 B 입력이 유발한 `markdown` 요청·창 Markdown 파싱이 각각 0건이다. A 자체 갱신은 허용한다 | "A·B가 동시에 생성 중인 입력을 사용합니다. 0326 저장소에서는 B 이벤트 처리 직전·직후 A 엔트리 참조가 유지되고 B 원문이 누적되는지 확인합니다. 0327에서는 입력을 세션별로 식별해 B가 비활성인 동안 B 입력이 유발한 Markdown 워커 요청과 렌더러 파싱이 각각 0건인지 판정합니다. A 자체 갱신은 허용합니다." | PR #652 소유자 댓글 | ACTIVE | ΔV2 AC39 의 "A 화면 텍스트 불변"·전체 계수 0 을 대체 |
| D-057 | 하네스 관측 시점 — 4,001자에서는 실제 워커 응답의 전달을 보류해 `raw` 커밋을 관측하고, 50,000자에서는 그 50,000자 요청의 결과가 커밋된 시점을 식별한다. 턴 완료 단계는 실제 완료 이벤트로 블록 확정과 구별한다. 스크롤 동작은 0326 이 계속 소유한다 | "4,001자에서는 실제 워커 응답의 전달을 잠시 보류해 `raw` 커밋을 관측합니다. 50,000자에서는 기존 4,001자 결과도 `parsed` 표지를 유지할 수 있으므로, 해당 50,000자 요청의 결과가 화면에 커밋된 시점을 식별합니다." · "턴 완료를 판정하는 경로에는 실제 완료 이벤트를 넣어 블록 확정과 구별합니다. 스크롤 동작은 0326이 계속 소유합니다." | 같은 댓글 | ACTIVE | D-053 의 관측 방법 |
| D-058 | V2-6(접두 검사 제거)의 직접 검출은 s15 가 맡는다. s14·bg3 은 늦은 응답을 실제로 전달한 뒤 현재 본문을 확인하는 회귀이고 V2-6 의 필수 red 가 아니다 — 꼬리 인스턴스가 이미 사라져 접두 검사와 무관하게 막힌다 | "구현자 리뷰 G1에 동의합니다." · "V2-6의 직접 검출은 s15에 배정합니다." · s14·bg3 "V2-6 필수 실패 목록에서 제외합니다." | 같은 댓글 · r1 G1 | ACTIVE | D-055 유지 — 검증 배정만 바꾼다 |

갱신 메모(ΔV3):

- 결정 단위 SUPERSEDED 0 · OPEN 0 — D-053~D-055 는 ACTIVE 그대로다. ΔV2 의 행은 아래 대체표에 적은 것만 대체된다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-055 ↔ s15(검출) · s14·bg3(회귀) · D-056 ↔ AC39(ΔV3) · bg0~bg4 · D-057 ↔ AC37·AC38 단계표 · EP-27 ②⑥ · D-058 ↔ V2-6(ΔV3) · D-053 ↔ AC37·AC38(동작 기준 유지 · `completed` 는 본문만).
- G1 재현 대조: s14 는 새 꼬리 ≤ 4,000 이면 `StreamingMarkdown.tsx:84-89` 꼬리 분기가 `<Markdown>` 으로 바뀌어 `WorkerMarkdownTail` 이 언마운트된다. bg3 의 Claude 경로는 라이브 행 key `liveBlockKey(sessionKey)`(`claudeBlocks.ts:926`)라 세션 전환에서 A 인스턴스가 언마운트된다. 둘 다 구현자 최소 재현(`short` · `B`)과 같다.

#### ΔV3 대체표

| ΔV2 행 | ΔV3 유효 행 |
|---|---|
| AC39 | 아래 AC39(ΔV3) |
| AC37·AC38 동작 기준 | 그대로 + 끝에 실제 `message.completed` 단계 — 본문만 판정(단계표 `completed` · B27) |
| VP-52 등록 변이 V2-6 기대 "s14·s15 · bg3" | 아래 V2-6(ΔV3) |
| EP-13 ④⑤ 입력 s14·s15 | 아래 ④⑤(ΔV3) |
| EP-13 ⑧ | 아래 ⑧(ΔV3) — `data-markdown-tail-parsed` 추가 |
| EP-26 ①② 좌표 bg1·bg2 · ③ 검색 술어 `data-markdown-tail` | ①② = bg0·bg1·bg2(ΔV3) · ③ 술어 `data-markdown-tail=`(속성 이름 끝까지 — 자리 수 9 유지) |
| EP-27 ②③ · ks1~ks9 | 아래 EP-27(ΔV3) — ⑥ 단계표 SSOT 추가 · ks10~ks12 |
| 하네스 계약의 단계·관측 시점·원자료 | 아래 단계표·관측(ΔV3) |
| "EP-26 의 0326 자리를 고쳐야 AC37~AC39 가 통과하면 … 구현자는 고치고" | 0327 은 스크롤 코드를 고치지 않는다. EP-26 ③ 밖 자리(0326 소유)를 고쳐야만 AC37~AC39 가 통과하면 그 경로를 멈추고 `PLAN_GAP` 으로 설계자에게 돌린다(D-057) |

#### ΔV3 AC39

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-05 | AT-05 / AC39 (ΔV3) | **A·B 가 동시에 생성 중이고 A 를 봄.** 세 화면에서 A·B delta 를 번갈아 넣는다(각 꼬리 4,001자 이상 포함 · 세션별 고유 표지 `A0001`… · `B0001`…). 저장소: B 이벤트마다 처리 직전·직후 A 엔트리 참조가 같고 B live text = B delta 합. 화면: B 가 비활성인 동안 원문에 B 표지가 든 `markdown` 요청 0 · 창 Markdown 파싱 0 · A 화면의 B 표지 0(A 자체 요청·파싱·갱신은 허용). 생성 중 B 로 돌아가면 B 최신 꼬리가 표지 한 번씩(마지막 B 표지 포함 · A 표지 0) 원문 → 워커 결과로 보인다. 실제 `message.completed` 뒤 돌아가면 완료 본문이 표지 한 번씩 보인다(꼬리 표지 없음). 전환 순간 실행 중이던 A 꼬리 응답을 전환 뒤 전달해도 B 본문의 A 표지 0 | IT `streamingSessions.test.ts` bg0~bg4(아래) | `ingestChatEvent(A \| B)` → 세션 엔트리 · 활성 선택자 → 라이브 행 → 꼬리 · `message.completed` → 완료 경로 |

| 케이스 | 입력 · 단언 | seam |
|---|---|---|
| bg0 | 저장소 — A·B 동시 생성 · A 활성. B 이벤트마다 처리 직전·직후 `sessions[A]` 참조 같음 · B live text = B delta 합 · `activeKey` = A | production `useChatStore`·`ingestChatEvent` |
| bg1 | 세 화면 A 표시 · A·B delta 교대(B 꼬리 4,001자 이상 포함). B 표지 든 `markdown` 요청 0 · B 표지 든 창 파싱 0 · A 화면 B 표지 0. 양성: A 표지 든 요청 ≥ 1(A 자체 갱신) | 가짜 계산 클라이언트(요청 문서 원문 기록) · `react-markdown` default spy(인자 원문 기록) |
| bg2 | 생성 중 B 복귀 → B 표지 한 번씩 · 마지막 B 표지 · A 표지 0 · 표지 `raw` → 가짜 응답 전달 → `parsed`. 양성: B 표지 든 요청 ≥ 1 | 같음 |
| bg3 | A 꼬리 요청 실행 중(가짜 클라이언트가 응답 보류) → B 로 전환 → A 응답 전달 → B 본문의 A 표지 0 · B 표지 한 번씩. V2-6 아래 green 이 기대값(D-058) | 같음 |
| bg4 | A 표시 중 B 에 실제 `message.completed` → B 복귀 → 완료 경로 렌더(`data-markdown-tail` 없음) · B 표지 한 번씩 | 같음 |

- 귀속 규칙: 요청 문서 원문이나 파싱 인자 원문에 B 표지가 하나라도 있으면 B 입력이 유발한 것이다. 표지 집합은 서로 겹치지 않는다(`A`·`B` 접두).

#### ΔV3 등록 변이 V2-6 · EP-13 정정

| ID | 자리 | 종류 · 바꾼 내용 | 기대 |
|---|---|---|---|
| V2-6 (ΔV3) | EP-13 ④ | 제거 · 접두 검사(`tail.startsWith(parsed.text)`) | s15 red(이전 응답 뒤 `raw` · X 전용 표지 0 단언) · s14·bg3 은 green 이 기대값 — `동치`(인스턴스 소멸 · D-058) |

| 자리 | 규칙(분기) | 직접 oracle 좌표 — 분기마다 입력 |
|---|---|---|
| ④⑤ (ΔV3) | 블록 확정·세션 전환 뒤 늦은 결과는 현재 꼬리의 접두일 때만 쓴다 | s15(검출): 꼬리 X 앞 4,500자 요청 실행 중(가짜 클라이언트 보류 · X 는 6,000자까지 자람) → 확정 delta → 같은 인스턴스의 새 꼬리 Y 5,000자. X·Y 는 첫 문장이 같고 그 뒤 갈라진다. X 응답 전달 → Y 원문만 · 표지 `raw` · X 전용 표지 0 → Y 응답 전달 → `parsed` · 속성 값 = Y 길이. 전제로 확정 전후 꼬리 뿌리 DOM 노드가 같음을 단언한다 · s14(회귀): 새 꼬리 ≤ 4,000 → 언마운트 → 이전 응답 전달 → 새 꼬리 표지 한 번씩 · bg3(회귀) |
| ⑧ (ΔV3) | 뿌리 요소 `data-markdown-tail` = `raw` · `parsed` · `final`(ΔV2 그대로) + `data-markdown-tail-parsed` = 화면 hast 가 덮는 꼬리 글자 수 — `parsed` 일 때만 있고 그 밖에는 속성이 없다. 두 속성은 같은 요소에 둔다 | s13a~e(ΔV2) · s13b 속성 값 = 결과 원문 길이 · s13a·c·d·e 속성 없음 · s13f: 4,001 결과 표시 중 꼬리 50,000 → 값 4,001 유지 → 50,000 요청 결과 전달 → 값 50,000 |

- 꼬리 요소는 꼬리 시작에 묶인 key 를 갖지 않는다 — 블록 확정 뒤에도 같은 자리면 같은 인스턴스다(EP-13 ② · D-035 "꼬리 인스턴스마다"). s15 의 전제 단언이 이를 잠근다.
- EP-13 검색 명령의 술어 `data-markdown-tail` 은 두 속성을 모두 잡는다 — ⑧ 은 요소 하나라 구현 뒤 자리 수는 8 그대로이고, 두 속성이 다른 줄이면 검색 줄은 9다.

#### ΔV3 하네스 단계표 (AC37·AC38 — SSOT)

단계표는 `scripts/transcript-streaming/steps.mjs` 의 `STEPS` 하나다. probe 와 판정기가 같은 `STEPS` 를 import 하고, 원자료 단계 열은 `STEPS` 순서 그대로다.

| 단계 | 입력 | 대상 커밋 | 꼬리 길이 | 표지 · parsed 글자 | P1 단언 | U1 단언 |
|---|---|---|---|---|---|---|
| `sync@4000` | delta 로 꼬리 4,000자 | 그 delta 커밋 | 4,000 | 없음 | 하단 ≤ 1 · 최신 표지 화면 안 · 표지 1회 | 기준 문장(offset₀)·전제 기록 · 표지 1회 |
| `enter@4001` | 관문 닫고 1자 delta | 표지 `raw` 가 붙은 커밋 | 4,001 | `raw` | 같음 | `\|offset − offset₀\| ≤ 1` · 표지 1회 |
| `parsed@4001` | 관문 열기(보류 응답 전달) | 속성 값 4,001 이 붙은 커밋 | 4,001 | `parsed` · 4,001 | 같음 | 같음 |
| `parsed@50000` | 관문 연 채 delta 로 50,000자 | 속성 값 50,000 이 붙은 커밋 | 50,000 | `parsed` · 50,000 | 같음 | 같음 |
| `final@50001` | 1자 delta | 표지 `final` 이 붙은 커밋 | 50,001 | `final` | 같음 | 같음 |
| `finalized` | `\n\n` + `F0001 …\n` | 표지가 사라지고 확정 블록이 +1 된 커밋 | F0001 줄 길이 | 없음 | 같음 | 같음 |
| `after` | F 줄 delta 3개 | 마지막 delta 커밋 | F0001~F0004 길이 | 없음 | 같음 | 같음 |
| `completed` | 실제 `message.completed`(전체 원문) | 라이브 꼬리가 사라진 커밋 | — | 없음(완료 경로) | 표지 1회 · 최신 표지 존재 | 표지 1회 |

- 관문: probe 는 `computeClient()` 가 만든 실제 클라이언트를 감싼 위임 객체를 `setComputeClient` 로 넣는다. `markdown` 요청의 결과 전달만 관문에 묶고 다른 메서드는 그대로 위임한다 — 관문이 닫혀도 워커 계산은 끝나고 결과 전달만 보류된다. `new Worker(` 는 여전히 `client.ts` 만 부른다(규칙 (i)).
- 관측: 대상 커밋은 MutationObserver 가 표지·속성 변화(표지 변화가 없는 단계는 그 delta 커밋)를 받은 커밋이다. 측정은 그 뒤 animation frame 2개 뒤에 하고, 속성 값이 단계 값이 되지 않은 채 5초가 지나면 그 칸은 `error: 'no worker result'` 다.
- 원자료: 단계마다 `{step, tailLength, view, parsedChars, stableBlocks, bottomDistance?, latestVisible?, offset?, missing[], duplicated[]}`.
- 선언 경계 B27: `completed` 는 본문만 판정한다. 하단 거리·문장 위치는 판정하지 않는다 — 0326 에서 Claude 하단 추적은 생성 중에만 따라가고(p2), Claude 라이브 행은 확정 key 로 바뀐다(0326 y10). 이 전환은 0327 의 꼬리 전환이 아니다.

#### ΔV3 EP-27 정정 (판정기 · 자리 5 → 6)

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 |
|---|---|---|---|
| ② (ΔV3) | `stepShapeFailures` 단계 | 기록 단계 열 = `STEPS` 순서 · 단계마다 꼬리 길이·표지·parsed 글자·확정 블록 증감이 `STEPS` 기대와 같다 | ks6(`parsed@4001` 표지 `raw`) · ks7(꼬리 4,002) · ks10(`parsed@50000` 의 parsed 글자 4,001 — 이전 결과로 오인) · ks11(`completed` 단계 빠짐 · 완료 뒤 표지 남음) |
| ③ (ΔV3) | `pinStepFailures` P1 | `STEPS` P1 칸 — 하단 거리 ≤ 1 · 최신 표지 화면 안 · 표지 1회. `completed` 는 표지 1회·최신 표지 존재만 | ks3(하단 거리 1.5) · ks5(표지 2회) · ks12(`completed` 하단 거리 300 → 통과 — 판정하지 않는다) |
| ⑥ (신규) | `STEPS` 단계표 SSOT | `steps.mjs` 정의 1 · 판정기·probe 가 import | ks11 · gate `check-transcript-streaming.mjs`(probe 단계가 `STEPS` 와 다르면 빠진 단계 실패) |

- ①④⑤ 는 ΔV2 그대로다. 자리 검색 명령(`app/`): `rg -n "^export (async )?function (judgeStreamingRuns|stepShapeFailures|pinStepFailures|unpinStepFailures|main)\b|reason: '(unknown record|missing record|환경 없음)'|^export const STEPS\b|steps\.mjs'" scripts/check-transcript-streaming.mjs scripts/transcript-streaming/steps.mjs scripts/transcript-streaming/probe.tsx` → 구현 뒤 11줄(ΔV2 8 + `STEPS` 정의 1 + import 2).
- VP-56 적대 증거 보탬: parsed 글자 대조를 지우는 변이(ks10 red).

#### ΔV3 V 변경

| Node / pair | 변경 |
|---|---|
| R-05 / AT-05 · VP-05 | CHANGED(ΔV3) — AC39 대체 · AC39 좌표 bg0~bg4 · AC37·AC38 `completed` 단계 |
| VP-52 | V2-6 기대 정정(D-058) · EP-26 ③ 술어 `data-markdown-tail=` · ①② 좌표 bg0·bg1·bg2 |
| MD-06 / UT-06 · VP-35 | EP-13 ⑧ 속성 · s13f · s15 입력·전제 |
| MD-15 / UT-15 · VP-56 | EP-27 ②③⑥ · ks10~ks12 |
| VP-55(REGRESSION) | 기존 `chatStore.test.ts` 1건 그대로. bg0 이 동시 생성 입력으로 같은 노드를 화면 앞에서 다시 닫는다 |
| VP-37(REQUIRED · V1 rev 3) | 변경 없음 — r1 은 cb1 의 메모 제거 변이만 돌렸고 등록 변이(메모 deps 에 `theme`, VP-03)는 미실행이다. r1.2 가 수행한다 |

#### ΔV3 READY self-review (관측)

- Decision: D-056~D-058 ACTIVE · 원문 인용 · SUPERSEDED(결정) 0 · OPEN 0. ΔV2 행 대체는 대체표 9행.
- G1: V2-6 기대가 인스턴스 수명과 접두 검사를 한 변이에 묶었던 모순을 풀었다 — 검출 s15(같은 인스턴스 전제 단언) · 회귀 s14·bg3(`동치`).
- 규칙 칸 ↔ 입력 칸: ⑧(표지 세 값 · 속성 있음/없음 · 4,001 → 50,000 갱신) ↔ s13a~f · ④⑤(같은 인스턴스 늦은 결과 · 언마운트 · 세션 전환) ↔ s15·s14·bg3 · EP-27 ②③⑥ ↔ ks6·ks7·ks10~ks12.
- 단계 정합: 단계표 8단계 = 원자료 단계 열 = 판정기 기대(`STEPS` 하나 — EP-27 ⑥). ΔV2 의 길이 5개 · 표지 6개 목록 불일치는 이 표로 대체됐다.
- 음성 ↔ 양성: bg1 B 귀속 0 ↔ A 귀속 ≥ 1 · bg2 B 귀속 ≥ 1 · ks12 는 `completed` 에서 스크롤을 판정하지 않는 방향을 잠근다.
- 수치 계약 런타임: ±1px 는 실제 Chromium · 관문으로 4,001 `raw` 커밋을 실제 워커와 함께 관측한다.
- 스크롤 소유: 0327 생산 변경은 `WorkerMarkdownTail` 표지 두 속성과 흐름 배치뿐 — 0326 자리 수정이 필요하면 `PLAN_GAP`(D-057).

### ΔV4 · G2 정정 — 메시지 완료와 턴 종료

판정: 메시지가 완료되면(`message.completed`) 그 본문은 그 시점에 완료 Markdown 경로로 보이고, 턴 진행 표시(`inflight`)는 실제 턴 종료(`telemetry`)까지 남는다. 세 화면 공통이다. 생산 변경은 OpenCode 행 분류 한 자리(`openCodeBlocks.ts:526-534` text segment 의 `streaming`)가 늘어난다.

| 항목 | 값 |
|---|---|
| 입력 | r1.2 `[구현자 기입] 설계 리뷰` G2(`56042bc1`) · PR #652 소유자 댓글 "0327 r1.2 검토 · G2 설계 보완 요청 (`56042bc1`)"(2026-11-23) |
| V mode | `Delta V` — 기준 `V1 rev 3 + ΔV1 + ΔV2 + ΔV3` |
| 이번 V revision | `ΔV4` — 설계 커밋 `(ΔV4 설계 — 검증자 기입)` |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4` |
| 라운드 | 1 — verify 0회. 다음 impl 턴은 `r1.3` |
| 변경이 시작되는 수준 | R(AC26 완료 조항 · AC39 bg4) → SD-07 CHANGED · MD-16 NEW(OpenCode 행 분류) · 0326 OpenCode live 행 회귀 |

#### ΔV4 Decision Ledger

| ID | 결정 | 근거(원문) | 출처 | 상태 | 관계 |
|---|---|---|---|---|---|
| D-059 | `message.completed` 를 받은 본문은 그 시점에 완료 Markdown 으로 표시하고, 턴 진행 표시는 실제 턴 종료까지 유지한다 — Claude Code·Claude Work·OpenCode 공통. 같은 턴의 후속 텍스트는 새 라이브 텍스트만 스트리밍하고 앞서 확정한 본문은 한 번만 보인다. 턴 종료 뒤 `inflight=false` 이고 완성 본문은 중복 없이 남는다. 메시지 완료 직후와 턴 종료 뒤를 따로 단언한다 | "G2에 동의합니다. `message.completed`를 받은 본문은 그 시점에 완료 Markdown으로 표시하고, 턴 진행 표시는 실제 턴 종료까지 유지하는 방향으로 plan을 확정해 주세요." · "이 기준은 Claude Code·Claude Work·OpenCode에 공통으로 적용합니다." · "같은 턴에서 후속 텍스트가 오면 새 라이브 텍스트만 스트리밍되고 앞서 확정한 본문은 한 번만 표시돼야 합니다." · "메시지 완료 직후와 턴 종료 후를 별도로 단언해 주세요." | PR #652 소유자 댓글 | ACTIVE | D-035·AC26 의 "완료" 를 메시지 완료로 확정 |
| D-060 | 소유자 — 0326 세션 저장소는 원문 누적·메시지 확정·턴 상태를 소유한다. 0327 은 OpenCode `openCodeBlocks.ts` 에서 확정 텍스트와 라이브 텍스트의 행 분류를 정정하고, `Text.tsx` 는 그 결과로 Markdown 표시 경로를 고른다. 마지막 행이라는 위치와 턴 진행 여부만으로 확정 텍스트를 스트리밍으로 분류하지 않는다 | "0326 세션 저장소는 원문 누적·메시지 확정·턴 상태를 소유합니다. 0327은 OpenCode의 `openCodeBlocks.ts`에서 확정 텍스트와 라이브 텍스트의 행 분류를 정정하고, `Text.tsx`는 그 결과로 Markdown 표시 경로를 선택합니다. 마지막 행이라는 위치와 턴 진행 여부만으로 확정 텍스트가 다시 스트리밍으로 분류되는 경로를 수정해 주세요." | 같은 댓글 | ACTIVE | D-057 "스크롤은 0326" 과 같은 소유 원칙 · 저장소 변경 0 |

갱신 메모(ΔV4):

- 결정 단위 SUPERSEDED 0 · OPEN 0. D-059 는 D-035 "완료 뒤 표시는 완료 경로" 의 "완료" 를 메시지 완료로 정한 보완이다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-059 ↔ AC26(ΔV4 완료 조항) · AC39 bg4a·bg4b 의 ②~⑤ · D-060 ↔ EP-28 ①(행 분류) · EP-26 ⑨⑩(경로 선택) · 저장소 자리 수정 0 · D-056 ↔ bg4a ②(비활성 B 귀속 0 유지) · D-053 ↔ ΔV3 하네스 `completed`(실제 `message.completed` · 본문만 — B27 그대로).
- 관측(이번 세션): 턴을 닫는 이벤트는 `telemetry` 다 — `chatReducer.ts:1353-1374` `TURN_END_RESET` · `turn.ended` 는 계기만 올린다(`:1500-1503`). OpenCode text segment 의 `streaming` 은 `active && index === segments.length - 1`(`openCodeBlocks.ts:531`)이라 메시지 완료 뒤에도 턴이 진행 중이면 마지막 확정 text 가 스트리밍으로 남는다. 같은 블록의 live 판정은 `isLiveSeg = index === liveIndex`(`:499`)다.
- 기존 테스트 대조: `rg -n "streaming" …/opencode --glob '*.test.*'` 결과 중 "진행 중 턴의 확정 마지막 text = streaming" 을 단언한 케이스는 0 — `projection.test.ts` live 행 · `openCodeBlocks.test.ts` y10/y20·b9 는 `live` 표지만 본다.

#### ΔV4 대체표

| 대상 행 | ΔV4 유효 행 |
|---|---|
| V1 rev 3 AC26 "완료 뒤 DOM 은 완료 경로(`AssistantSegment` `<Markdown>`) 렌더와 같다" | 메시지 완료(`message.completed`) 뒤 그 본문 DOM 은 완료 경로 렌더와 같다 — 턴 종료(`telemetry`) 전에도. OpenCode 완료 경로는 `Text.tsx` 비스트리밍 분기 |
| ΔV3 AC39 bg4 행 · `streamingSessions.test.ts` bg4 의 OpenCode `telemetry` 선행 · `it.todo` | 아래 bg4a·bg4b(ΔV4) |
| ΔV2 EP-26 ⑨ | 아래 EP-26 ⑨⑩(ΔV4) — 자리 9 → 10 |
| (없음) | EP-28 · MD-16 / VP-57 신설 |

#### ΔV4 AC39 bg4 — 이벤트 순서와 단계별 단언

두 변형 모두 세 화면(Claude Code · Claude Work · OpenCode)에서 돌린다. B 의 미확정 꼬리는 워커 경로 범위(4,001~50,000자)인 10,000자 한 문단이고 표지는 `B0001`… 이다. 후속 텍스트는 새 메시지 번호(`b:M2`)로 오고 표지는 `C0001`… 이다.

| 단계 | 입력 | bg4a — B 비활성 중 완료 뒤 복귀 | bg4b — B 를 보는 중 완료 |
|---|---|---|---|
| ① | B delta 로 꼬리 10,000자 | A 표시 · B 귀속 `markdown` 요청 0 · 창 파싱 0 | B 표시 · 꼬리 표지 `parsed`(가짜 응답 전달 뒤) |
| ② | B 에 실제 `message.completed`(본문 = B live 전체) | 저장소: B live text `''` · B `inflight=true` · B 귀속 요청·파싱 0 그대로 | — (③과 같은 단언) |
| ③ | (bg4a 만) B 로 복귀 · 턴 종료 전 | B 본문 표지 한 번씩 · B 표지를 담은 본문 요소와 그 조상·자손에 `data-markdown-tail` 0 · 창 Markdown 파싱 인자에 B 본문 원문 전체가 1회 이상(완료 경로) · `inflight=true` | 같은 단언(같은 B 화면에서) |
| ④ | 같은 턴 후속 text delta(`b:M2` · `C0001`…) | 새 라이브 행만 스트리밍 — C 표지는 라이브 행에만 · B 본문 표지 한 번씩 · B 본문에 `data-markdown-tail` 0 · `inflight=true` | 같음 |
| ⑤ | 실제 `telemetry`(턴 종료) | `inflight=false` · B·C 표지 한 번씩 · `data-markdown-tail` 0 | 같음 |

- 단언 단위는 단계마다 따로다 — ③(메시지 완료 직후)과 ⑤(턴 종료 뒤)를 한 단언으로 합치지 않는다.
- 완료 경로 판정은 두 관측을 함께 쓴다: 10,000자 미확정 문단이 스트리밍 경로로 그려지면 꼬리 표지가 붙으므로 표지 0 이 경로를 가르고, 창 파싱 인자가 본문 원문 전체와 같다는 것이 완료 경로(`<Markdown source={본문}>`)를 직접 보인다.
- 구현자는 `streamingSessions.test.ts` 의 `it.todo('bg4 OpenCode …')` 와 OpenCode `telemetry` 선행 분기(`:189-195`)를 지우고 위 표로 바꾼다.

#### ΔV4 §10 강제 지점

**EP-28 · MD-16 / VP-57 — OpenCode text 행 분류** — 자리 4. 불변식: text segment 행의 `streaming` 은 그 행이 라이브 텍스트를 가질 때만 참이다(`live` 와 짝).

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 — 분기마다 입력 |
|---|---|---|---|
| ① | `openCodeBlocks.ts:526-534` text `appendSegment` 의 `streaming` 인자 | 그 segment 가 live text 를 가짐(`index === liveIndex`) → 참 · 아니면 거짓. 위치(`index === segments.length - 1`)와 `active` 는 쓰지 않는다 | `openCodeBlocks.test.ts` ob1(pending · 마지막 segment = 확정 text · liveText 없음 → 거짓) · ob2(pending · live 가 마지막 확정 text 에 이어 붙음 — 같은 소유 → 참 · `live`) · ob3(pending · 확정 text 뒤 다른 소유 live → 새 live 행 참 · 앞 확정 행 거짓) · ob4(pending 아님 → 거짓) |
| ② | `openCodeBlocks.ts:736` 첫 live 행(전체 구성) | `streaming: true` · `live: true` | ob5(사용자 메시지만 · live text → 첫 live 행 참 — 전체 구성 경로) |
| ③ | `openCodeBlocks.ts:897` 첫 live 행 교체(`liveTextKey` 바뀜) | 같음 | ob6(첫 live 중 `liveTextKey` 바뀜 → 교체 행 참) |
| ④ | `openCodeBlocks.ts:913` 첫 live 행 삽입(증분) | 같음 | ob5 증분 경로(`advance` 로 live 시작) |

- 자리 검색 명령(`app/`): `rg -n "^\s+appendSegment\($|^\s+streaming: true,$" src/renderer/src/features/chat/harnesses/opencode/transcript/openCodeBlocks.ts` → `56042bc1` 7줄 = 자리 4(`:526`·`:736`·`:897`·`:913`) + 뺀 3(`:482` 도구 · `:567` ask · `:579` 그 밖 — `streaming` 상수 거짓이고 표시는 text segment 만 `streaming` 을 쓴다 `Timeline.tsx:174-182`).
- 등록 변이(VP-57): ① 을 이전 식 `active && index === segments.length - 1` 로 되돌림(뒤집기) → ob1 · bg4a·bg4b ③ OpenCode red · ② 의 `streaming: true` → `false`(빈 값) → ob5 red.
- 실패 의미: ① 이 위치·턴 상태로 분류하면 메시지 완료 뒤에도 마지막 본문이 원문·워커 꼬리로 남고(G2), 턴 종료에서야 완료 경로로 바뀐다.

**EP-26 ⑨⑩ (ΔV4)** — EP-26 자리 9 → 10.

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 |
|---|---|---|---|
| ⑨ | `opencode/transcript/Text.tsx:22` `streaming ?` | 참 → `StreamingMarkdown` · 거짓 → 완료 경로 `Markdown` | P1(opencode — 생성 중) · bg4a·bg4b ③④⑤(opencode — 메시지 완료·턴 종료) |
| ⑩ (신규) | `opencode/transcript/Timeline.tsx:169` `useTimelineMarkdownMode` | 선택 없음 → 행 `streaming` 그대로 · 선택 중 참 → 거짓 바뀜 → 선택이 끝날 때까지 스트리밍 유지 | bg4b ③(선택 없음) · 기존 `Timeline.selection.test.ts:'keeps selected live content on completion, then resolves complete Markdown when selection clears'`(선택 중 유지) |

- EP-26 자리 검색 명령(ΔV4 — ΔV2·ΔV3 명령을 대체): `rg -n "useChatStore\(\(s\) => (\(enabled \? )?s\.sessions\[s\.activeKey\]\.live\.text\b|shouldFollowGrowth\(state, generating\) \{|^\s+virtualizer\.shouldAdjustScrollPositionOnItemSizeChange = |case 'text':|streaming \?|useTimelineMarkdownMode\(row" src/renderer/src/features/chat/{store/chatStore.ts,lib/transcript/viewport/pin.ts,components/transcript/TranscriptViewport.tsx,harnesses/claude/transcript/AssistantSegment.tsx,harnesses/opencode/transcript/Text.tsx,harnesses/opencode/transcript/Timeline.tsx}; rg -n "new ResizeObserver\(" src/renderer/src/features/chat/harnesses/{claude/transcript/useScrollAnchor.ts,opencode/transcript/ScrollController.tsx}; rg -n "data-markdown-tail=" src/renderer/src/features/chat/components/markdown --glob '!*.test.*'` → 자리 10(①~⑩).
- 선언 경계 B28: 완료된 메시지와 같은 메시지 번호로 다시 오는 text delta 는 이 계약의 입력이 아니다 — 그 live 는 같은 text segment 에 붙어(`openCodeBlocks.ts:382-388`) 확정 본문이 함께 스트리밍 렌더된다. 보호 주장 없음.

#### ΔV4 V 변경

| Node / pair | provenance · requiredness | 변경 |
|---|---|---|
| R-05 / AT-05 · VP-05 | CHANGED(ΔV4) · REQUIRED | AC26 완료 조항 · AC39 bg4a·bg4b |
| SD-07 / ST-07 · VP-52 | CHANGED(ΔV4) · REQUIRED | 수명에 "메시지 완료(턴 진행) → 후속 live → 턴 종료" 를 더한다 · EP-26 ⑨⑩ 좌표 bg4a·bg4b |
| MD-16 / UT-16 · VP-57 | NEW · REQUIRED | OpenCode text 행 분류 — production path `projectTimeline`·`advance` → `buildAssistantTurnBlocks` → text `appendSegment(streaming)` → 행 `streaming` · EP-28 (4) · 좌표 ob1~ob6 |
| R-0326-OCLIVE | INHERITED · VP-58 REGRESSION | 0326 OpenCode live 행 — key 인계(y10/y20) · 이어 붙는 live(b9) · 선택 중 유지 · live 리프만 재렌더. 좌표 `openCodeBlocks.test.ts` y10/y20·b9 · `Timeline.selection.test.ts` 2건 · `projection.test.ts:'projectTimeline emits live text row without reasoning prose when presence is active'` · `Timeline.memo.test.ts` live 리프 케이스(`322b19bd`·`56042bc1` 트리) |

#### ΔV4 구현 설계 · 파일

| 변경 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `features/chat/harnesses/opencode/transcript/openCodeBlocks.ts` | 행 분류 | EP-28 ① — text `appendSegment` 의 `streaming` 인자를 `isLiveSeg` 판정으로 바꾼다. 행 key·`live`·블록 재사용 비교(`prior.streaming === streaming`)는 그대로 | `openCodeBlocks.test.ts` ob1~ob6(순수 — `createOpenCodeBlocks`·`projectTimeline`) |
| `features/chat/components/transcript/streamingSessions.test.ts` | AC39 IT | bg4 → bg4a·bg4b(위 단계표) · `it.todo` 와 OpenCode `telemetry` 선행 분기 삭제 | production store · 세 화면 · 가짜 계산 클라이언트 · `react-markdown` spy |

- 저장소(`chatStore.ts`·`chatReducer.ts`)는 바꾸지 않는다(D-060). 이 정정으로 저장소를 고쳐야만 통과하면 그 경로를 멈추고 `PLAN_GAP` 으로 돌린다.
- 같은 메시지가 live 행에서 확정 행으로 바뀌어도 key 가 같으면 `OpenCodeTextSegment` 컴포넌트는 남고(`Timeline.tsx:210-212` 주석 — 0325 EP-2 ⑥⑦) 안쪽 표시만 `StreamingMarkdown` → `Markdown` 으로 바뀐다. 이 전환은 지금도 턴 종료 때 일어나며 ΔV4 는 그 시점을 메시지 완료로 앞당긴다.

#### ΔV4 READY self-review (관측)

- Decision: D-059·D-060 ACTIVE · 원문 인용 · SUPERSEDED 0 · OPEN 0.
- 소유: 저장소 변경 0 · 생산 변경은 EP-28 ① 한 자리(D-060). 스크롤 소유(D-057) 그대로.
- 규칙 칸 ↔ 입력 칸: EP-28 ①(live 보유 · 확정 마지막 · 이어 붙는 live · 다른 소유 live · 턴 종료) ↔ ob1~ob4 · ②③④ ↔ ob5·ob6 · EP-26 ⑨(참·거짓) ↔ P1·bg4 · ⑩(선택 없음·선택 중) ↔ bg4b·기존 선택 테스트.
- 단계 분리: 메시지 완료 직후(③)와 턴 종료 뒤(⑤)를 bg4a·bg4b 에서 각각 단언한다(D-059).
- 워커 경로 입력: bg4 꼬리는 10,000자(4,001~50,000) — AC37·AC38 의 완료 직전 꼬리(28자)로는 두 Markdown 경로를 가를 수 없다는 지적을 이 입력이 닫는다.
- 분모: EP-28 검색 7줄 실측 − 뺀 3 = 4 · EP-26 10.
- 방향: 완료 경로를 요구하는 자리는 이전 식으로 되돌리는 변이가 ob1·bg4 ③ 을 red 로 만들어야 한다(VP-57 등록 변이).

### ΔV5 · G3 정정 — 마지막 토큰 작업은 완료 응답

판정: 요청 범위의 마지막 줄을 끝낸 토큰 작업은 경과와 무관하게 완료 응답(`{ rows }`)을 낸다. `continue` 는 남은 줄이 있고 경과가 50ms 이상일 때만 낸다. AC4 t5 의 `continue 횟수 = ⌈전진 줄 / 50⌉` 은 작업 수와 양보 수를 섞은 식이라 작업 수와 `continue` 수로 나눠 다시 쓴다.

| 항목 | 값 |
|---|---|
| 입력 | r1.3 `[구현자 기입] 설계 리뷰` G3(`747ecb85`) — "설계자가 마지막 짧은 구간의 완료 응답과 양보 응답을 구분해 t5 식과 정확히 50줄인 경계의 기대를 정해야 한다" |
| 출처 | plan 내부 정합 — 사용자 결정 아님. 제품 결과(색·범위 응답)는 같고 끝난 작업의 왕복 1회와 재대기만 없어진다 |
| V mode | `Delta V` — 기준 `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4` |
| 이번 V revision | `ΔV5` — 설계 커밋 `(ΔV5 설계 — 검증자 기입)` |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5` |
| 라운드 | 1 — verify 0회. 다음 impl 턴은 `r1.4` |
| 변경이 시작되는 수준 | R(AC4 CHANGED) → MD-03 CHANGED(EP-3 ③) |

#### ΔV5 Decision Ledger

| ID | 결정 | 근거 | 출처 | 상태 | 관계 |
|---|---|---|---|---|---|
| D-061 | **완료 우선.** 토큰 작업은 줄마다 먼저 범위 끝을 본다 — 방금 끝낸 줄이 요청 범위(체크포인트 전진 포함)의 마지막 줄이면 경과와 무관하게 완료 응답을 낸다. 남은 줄이 있을 때만 경과 ≥ `TOKENS_JOB_BUDGET_MS` 이면 상태를 저장하고 `continue` 를 낸다. 줄당 1ms 주입 시계에서 n줄 전진(n ≥ 1)의 작업 수 = ⌈n / 50⌉ · `continue` 수 = ⌈n / 50⌉ − 1 · 작업마다 50줄(마지막 작업은 나머지 1~50줄)이고, 빈 범위(n = 0)는 작업 1 · `continue` 0 | D-030 의 양보는 남은 일이 있을 때 다른 작업에 레인을 넘기는 공정성 장치다 — 남은 일 없는 `continue` 는 끝난 결과를 같은 등급의 새 작업 뒤로 보내 늦추고(D-030 "양보 횟수 +1") 빈 작업 왕복을 하나 더한다. G3 표: EP-3 ③ 문언대로면 1·49·50·51·100·101줄의 양보 0·0·1·1·2·2, t5 식은 1·1·1·2·2·3 — 둘 다 이 규칙(0·0·0·1·1·2)과 다르다 | r1.3 G3 · 설계자 | ACTIVE | D-031·AC4·EP-3 ③ 보완(대체 아님) — 예산 50ms·줄 상한은 그대로 |

갱신 메모(ΔV5):

- 결정 단위 SUPERSEDED 0 · OPEN 0. D-031 의 "경과가 50 이상이 된 줄 뒤에 상태를 저장하고 `continue` 한다" 는 남은 줄이 있을 때로 읽는다(D-061).
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-061 ↔ AC4(ΔV5) · EP-3 ③(ΔV5) · t5 · D-030 ↔ q4(양보 직후 도착한 가시 작업이 먼저 — 남은 줄이 있는 작업에만 해당 · 문장 변경 없음) · D-043 ↔ AC36(레인 대기 — 변경 없음).
- 같은 수식이 다른 절에 있는지: ΔV5 를 쓰기 전 `rg -n "⌈전진" plan.md` → AC4 행 한 곳뿐이었다. 범위 토큰 워커(`shared/compute/worker/tokens.ts`)는 아직 없다(`ls shared/compute/worker` — r1.3 트리) — 정정은 구현 전이다.

#### ΔV5 대체표

| 대상 행 | ΔV5 유효 행 |
|---|---|
| AC4 검증 수단 "작업당 토큰화 줄 = 50 · `continue` 횟수 = ⌈전진 줄 / 50⌉" | t5 — 줄당 1ms 주입 시계 · 아래 입력표의 작업 수·`continue` 수·작업별 줄 수 |
| AC4 동작 기준 "경과가 `TOKENS_JOB_BUDGET_MS`(50) 이상이 된 줄 뒤에 상태를 저장하고 `continue` 를 돌린다" | 남은 줄이 있고 경과가 50ms 이상이 된 줄 뒤에 상태를 저장하고 `continue` 를 돌린다 · 범위의 마지막 줄을 끝낸 작업은 완료 응답(D-061). 나머지 문장(양보 간격 상한 · 클라이언트 재대기 · 끼어들기 · AC36)은 그대로 |
| EP-3 ③ "줄마다 `now() − started ≥ TOKENS_JOB_BUDGET_MS` 면 상태 저장 뒤 `'continue'`" | 아래 EP-3 ③(ΔV5) |

#### ΔV5 EP-3 ③ · t5 입력

| 자리 | 규칙(분기) | 직접 oracle 좌표 — 분기마다 입력 |
|---|---|---|
| EP-3 ③ (ΔV5) | 줄을 끝낼 때마다 — 범위 끝이면 완료 응답 · 아니고 `now() − started ≥ TOKENS_JOB_BUDGET_MS` 면 상태 저장 뒤 `'continue'` · 아니면 다음 줄 | `worker/tokens.test.ts` t5 — 줄당 1ms 주입 시계 · 아래 표의 n 마다 작업 수 · `continue` 수 · 작업별 토큰화 줄 수(`codeToTokens` 호출 수) · 마지막 응답이 `{ rows }` 이고 행 수 = n |

| n(전진 줄) | 작업 수 | `continue` 수 | 작업별 줄 | 가르는 분기 |
|---|---|---|---|---|
| 0(빈 범위 — `start ≥ 줄 수`) | 1 | 0 | — | 범위 끝(처음부터) |
| 1 | 1 | 0 | 1 | 범위 끝 · 경과 < 50 |
| 49 | 1 | 0 | 49 | 범위 끝 · 경과 < 50 |
| 50 | 1 | 0 | 50 | **범위 끝 · 경과 = 50 → 완료**(경계) |
| 51 | 2 | 1 | 50 · 1 | 남은 줄 · 경과 = 50 → `continue` |
| 100 | 2 | 1 | 50 · 50 | 두 번째 작업의 범위 끝 · 경과 = 50 → 완료 |
| 101 | 3 | 2 | 50 · 50 · 1 | 같음 |

- 등록 변이(VP-32 보탬): 범위 끝 검사와 예산 비교의 순서를 뒤집는다(뒤집기 — 마지막 줄 뒤에도 경과 ≥ 50 이면 `continue`) → t5 n = 50·100 red. V1 rev 3 의 "예산 비교를 지우는 변이(t5 red — 작업당 줄 = 전진 전부)" 는 그대로다.
- EP-3 검색 명령·자리 수(7)는 바뀌지 않는다 — ③ 은 같은 고리의 규칙 칸만 바뀐다.
- 실패 의미: 범위 끝 검사가 예산 비교 뒤에 오면 정확히 끝난 작업이 `continue` 로 돌아가 양보 횟수 +1 로 재대기한다 — 같은 등급의 새 작업이 먼저 돌고 끝난 색이 그만큼 늦게 붙는다.

#### ΔV5 V 변경

| Node / pair | provenance · requiredness | 변경 |
|---|---|---|
| R-06 / AT-06 · VP-06 | CHANGED(ΔV5) · REQUIRED | AC4 문장(위 대체표) — 하위 VP-32 가 덮는다 |
| MD-03 / UT-03 · VP-32 | CHANGED(ΔV5) · REQUIRED | EP-3 ③ 규칙 칸 · t5 입력 7개 · 등록 변이 1 보탬 |
| SD-02 / ST-02 · VP-11 | 변경 없음 · REQUIRED | q4 는 남은 줄이 있는 작업의 양보 뒤 순서를 본다 — 마지막 작업 규칙은 워커 국소(t5)라 경로 문장이 바뀌지 않는다 |

#### ΔV5 READY self-review (관측)

- Decision: D-061 ACTIVE · 출처 plan 내부 정합(사용자 결정 없음 — 제품 결과 불변) · SUPERSEDED 0 · OPEN 0.
- 규칙 칸 ↔ 입력 칸: EP-3 ③ 세 분기(범위 끝 · 남은 줄 + 경과 ≥ 50 · 남은 줄 + 경과 < 50) ↔ n = 0·1·49·50·51·100·101. 경계 n = 50 은 "범위 끝이면서 경과 = 50" 을 가르는 입력이다.
- 방향: "끝난 작업은 완료" 를 잠그는 장치는 순서 뒤집기 변이에 n = 50·100 이 red 여야 한다.
- 수식 검산: ⌈n/50⌉ − 1 = 0·0·0·1·1·2(n = 1·49·50·51·100·101) — 위 표 `continue` 열과 같다.

### ΔV6 · H1 채택 · 선택 취소 경로의 자리 고정

판정: verify 1(RETURN_TO_PLAN)의 확장 후보 H1 을 채택하고, ΔV1 이 대체한 선택 취소 경로의 §10 자리 목록·oracle 을 고정한다. 제품 동작(D-052)은 그대로다. 요구하는 변경은 Electron 판정 도구와 테스트이고, 그 과정에서 생산 코드 결함이 드러나면 구현자가 고친다.

| 항목 | 값 |
|---|---|
| 입력 | verify 1 H1 · I3([verify.md §11](verify.md)) · ΔV1 뒤에도 VP-09·VP-14·VP-26·VP-34 행이 ΔV1 이 제외한 복사 장치(`rowEndpoint`·`copyUnits`·`claimCopy`)를 가리키는 불일치 |
| 출처 | H1 = 확장 채택(verify 1회째 뒤 — 창 안) · EP-30 = plan 내부 정합(목록 미고정) |
| V mode | `Delta V` — 기준 `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5` |
| 이번 V revision | `ΔV6` — 설계 커밋 `(ΔV6 설계 — 검증자 기입)` |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6` |
| 라운드 | 2 — verify 1회. 다음 impl 턴은 `r2`. 다음 verify 는 2회째(창 안)이고, 그 뒤 설계 턴이 열거 원문을 늘릴 수 있는 마지막 턴이다 |
| 변경이 시작되는 수준 | R-09 CHANGED(AT 판정 도구 · 취소 증거) → SD-05 · AR-07 · MD-05 CHANGED · MD-17 NEW |
| 줄 참조 트리 | `0bb0783e` app 트리(이번 세션 `rg` 실측) |
| r2 가 함께 닫는 것 | verify 1 I1(plan oracle 좌표 부재)·I4(`[구현자 기입]` 필드) — plan 변경 없음. plan 좌표 파일과 다른 곳에 같은 단언을 두었으면 강제 지점 표에 자리별 `파일:테스트명` 으로 대응시킨다 |

#### ΔV6 Decision Ledger

| ID | 결정 | 근거 | 출처 | 상태 | 관계 |
|---|---|---|---|---|---|
| D-062 | `check-visible-views.mjs` 는 AC15·AC35 의 AT 판정 도구다. production 소유 화면(`DiffReview` 두 보기 · `ArtifactViewer` 코드·Markdown · `TranscriptView` 카드)을 띄운다. 판정은 순수 함수가 원자료로 다시 계산하고 모르는·빠진 기록은 실패다(fail-closed). 종료 코드는 ΔV2 도구와 같다(0 통과 · 1 실행·판정 실패 · 3 바이너리 없음). root Linux 는 `--no-sandbox` 로 띄운다 | verify 1 H1 — root 실행 Electron FATAL 재현 · probe 가 소유자를 재구현(`scripts/visible-views/probe.tsx:46-50` `usePanelSelection` + 자체 공급) · 알림을 지운 W3e 에도 6화면 통과 | verify 1 확장 채택 | ACTIVE | ΔV1 VP-50 행 "새 화면은 실제 Electron 마우스·키 입력과 클립보드로 AC15·35 를 검증한다" 의 도구를 고정 |
| D-063 | AT 취소 사례는 선택의 두 끝 노드가 연결된 채 새 행 키가 마운트된 커밋에서 앱이 선택을 해제했음을 보인다 — 커밋 전후 마운트 키 차집합 ≥ 1 · 두 끝 노드 `isConnected` 참 · 선택 문자열 `''` · Ctrl+C 뒤 클립보드 = 기존 값 | ΔV1 "취소 사례는 실제 새 행 키 관측을 증거로 남긴다" · W3e — 끝까지 스크롤하면 선택 노드가 언마운트되어 브라우저가 선택을 스스로 비우므로 앱 취소 없이도 클립보드 단언이 참 | plan 내부 정합 | ACTIVE | D-052 판정의 관측 방법 |
| D-064 | 선택 취소 경로의 분모는 EP-30(자리 15)이다. EP-10(복사 끝점·단위)·EP-20(복사 처리·0326 통합)은 SUPERSEDED — 그 pair 의 선택 적대 증거(끝점 칸 맞바꿈 · 조각 계획)는 대체 없이 폐기한다 | ΔV1 적용표 첫 행이 복사 호스트·끝점·조각·copy claim 을 구현 대상에서 뺐다 — 장치가 없으니 변이를 심을 자리가 없다 | plan 내부 정합 | ACTIVE | ΔV1 의 §10 정리 |

갱신 메모(ΔV6):

- 결정 단위 SUPERSEDED 0 · OPEN 0. D-052 는 그대로다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-052 ↔ AC15·AC35(ΔV6 c1·c2·c4·c5 · IT ps·tn·po · UT rm) · D-062 ↔ AC40 · D-063 ↔ AC15·AC35 c2 · D-064 ↔ EP-30. D-052 "제거만 일어난 커밋에는 취소하지 않는다" ↔ rm3·ps11 · "같은 키의 내용 변경 … 제외" ↔ rm4·ps12 · "다른 패널의 마운트로 현재 선택을 지우지 않는다" ↔ ps3·c4.
- 같은 대상 여러 절 대조: 공급자 셋(`TranscriptViewport.tsx:704`·`DiffReview.tsx:126`·`ArtifactViewer.tsx:132`) = D-052 의 "transcript viewport·Git 리뷰·산출물 미리보기" 세 소유자 = AT 화면군 셋. 생산자 둘(`useVirtualRows.ts:45`·`FileDiffSection.tsx:436`) = D-052 "공통 가상 행 뷰".

#### ΔV6 대체표

| 대상 행 | ΔV6 유효 행 |
|---|---|
| Pair registry VP-34 · VP-26 · VP-14 · VP-09 의 path · 좌표 · 적대 증거 | 아래 ΔV6 pair 표 |
| §10 EP-10 · EP-20 | EP-30(ΔV6) — D-064 |
| ΔV1 적용표 VP-50 행의 "새 화면은 실제 Electron … AC15·35 를 검증한다" | 아래 하네스 계약 + AC40 |
| AC15 · AC35 의 ΔV1 행 | 아래 AC15·AC35(ΔV6) |
| (없음) | MD-17 / UT-17 · VP-59 · EP-31 신설 · 운영 gate 1행 |

#### ΔV6 Acceptance Criteria

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-09 | AT-09 / AC15 (ΔV6) | Git 두 보기·산출물 두 보기. c1 마운트 행 안 부분·역방향 선택 → 실제 Ctrl+C → 클립보드 = 선택 문자열. c2 선택 두 끝이 마운트된 채 새 행 키가 들어오면 선택이 비고, 복사해도 클립보드는 기존 값(D-063). c4 다른 패널에 새 키가 들어와도 이 패널 선택·복사 유지. c5 취소 뒤 놓고 새로 드래그하면 그 선택이 복사된다 | AT `check-visible-views` 화면 `git-inline`·`git-split`·`artifact-code`·`artifact-markdown` · IT po1~po5 · UT rm1~rm8 | 실제 입력 → `DiffReview` \| `ArtifactViewer` → `VirtualRowMountContext` 공급 → `FileDiffSection` \| `useVirtualRows` → `useMountedRows` → `usePanelSelection.notify` |
| R-09 | AT-09 / AC35 (ΔV6) | transcript 카드 안과 본문 → 카드. c1 카드 안 · 본문 문단에서 카드 행까지 역방향 선택 → 복사 일치. c2 바깥 행 키가 고정된 채 카드 내부 목록에 새 키 → 취소(D-063). c4 · c5 는 AC15 와 같다. 바깥 목록 교체 취소는 0326 회귀(VP-50) | AT 화면 `transcript-file`·`transcript-diff`·`transcript-work` · IT tn1~tn4 | 실제 입력 → `TranscriptView` → `TranscriptViewport` 공급 → 카드 `useVirtualRows` → `useMountedRows` → `cancelNestedSelection` |
| R-09 | AT-09 / AC40 (신규) | AT 판정 도구는 원자료를 다시 계산해 판정한다 — 격자 밖 기록·빠진 기록·c2 증거 4항 중 하나라도 어긋나면 실패. 바이너리 없음 exit 3 · 실행 실패·하네스 오류·판정 실패 exit 1 · 통과 exit 0. root Linux 에서 실행된다 | UT `check-visible-views.test.mjs` vv1~vv11 | `main` → `runElectron`(재사용) → 원자료 → `judgeVisibleViews` → 종료 코드 |

AC 검증 주의(ΔV6):

- 음성 단언은 양성과 짝짓는다 — rm3(제거만 → 알림 0)은 rm1·rm2(추가 → 1)와, ps3(밖 → 유지)는 ps2(안 → 해제)와, c4(다른 패널 → 유지)는 c2(이 패널 → 취소)와 같은 실행에서 방향을 확인한다.
- 사람 실기 0이다. Electron 바이너리가 없으면 exit 3 이고 AC15·AC35 는 미완료로 남는다(PASS 아님).

#### ΔV6 실측 하네스 계약 (`check-visible-views.mjs`)

| 항목 | 계약 |
|---|---|
| 실행 | `cd app && xvfb-run -a node scripts/check-visible-views.mjs` — stdout JSON `{env, electron, records, verdict, failures}`. CI 단계에 넣지 않는 verify 실행 도구다(ΔV2 도구와 같음) |
| 재사용 | `check-transcript-selection.mjs` 의 `resolveElectron`·`serveProbe`·`runElectron`(root Linux `--no-sandbox` `:103-104` 포함)을 쓴다. 화면 목록·회수를 인자로 받게 일반화해도 되지만 같은 동작을 다시 구현하지 않는다 |
| 화면 `SCREENS` | `git-inline`·`git-split` — production `DiffReview`(5,001행 파일 1개 · 펼침) · `artifact-code`·`artifact-markdown` — production `ArtifactViewer`(ready 결과 · 5,001줄 코드 · 5,001블록 Markdown) · `transcript-file`·`transcript-diff`·`transcript-work` — production `TranscriptView`(`FileBody` 5,001줄 · `DiffBody` 5,001행 · `WorkToolBody` 요청·응답 5,001줄). 기존 6종의 첫·끝 행 도달과 마운트 행 < 150 단언은 이 화면들로 옮긴다 |
| 시나리오 | 화면마다 c1·c2·c5 · 쌍 화면 c4 · 각 1회. 원자료 단계 열은 `SCENARIOS` 순서다 |
| c1 | 마운트 행 안에서 실제 마우스(`sendInputEvent`) 역방향 부분 선택 → Ctrl+C → 클립보드 = 기대 문자열(행 표지로 계산). `transcript-*` 는 본문 문단 → 카드 행 역방향 선택을 하나 더 기록한다 |
| c2 | 화면 안 두 행에 걸친 선택(두 끝이 overscan 안쪽 행) → 커밋 전 `anchorNode`·`focusNode` 와 마운트 키(`[data-index]` 또는 행 id)를 기록 → 스크롤 소유자를 overscan 보다 작게 움직여 새 키를 마운트 → 기록 `keysBefore`·`keysAfter`·`endpointsConnected`(두 노드 `isConnected`)·`selectionAfter` → 클립보드에 `unchanged` 를 쓰고 Ctrl+C → `clipboard` |
| c4 | 한 창에 소유 화면 둘(`transcript-diff` + `git-inline`). A 선택 → B 스크롤로 B 새 키 → A `selectionAfter` = `selectionBefore` · Ctrl+C → A 문자열. 두 방향(A·B 맞바꿈) |
| c5 | c2 뒤 mouseUp → 새 드래그 선택 → Ctrl+C → 새 문자열 |
| 판정(순수) | `judgeVisibleViews(records)` — EP-31. 판정에 쓰는 값은 원자료에서 다시 계산한다(probe 의 통과 문자열을 믿지 않는다) |
| 원자료 | 기록마다 `{screen, scenario, keysBefore?, keysAfter?, endpointsConnected?, selectionBefore?, selectionAfter?, expected?, clipboard?, mounted?, reachedFirst?, reachedLast?, error?}` |

#### ΔV6 §10 강제 지점

**EP-30 · MD-05·AR-07·SD-05·R-09 / VP-34·VP-26·VP-14·VP-09 — 새 행 키와 선택 취소** — 자리 15. 불변식: 선택 끝이 그 소유 화면 안에 있을 때 직전 커밋에 없던 행 키가 마운트되면 그 소유자가 선택과 표시를 해제하고, 그 밖의 커밋·다른 소유자의 커밋은 선택을 건드리지 않는다.

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 — 분기마다 입력 |
|---|---|---|---|
| ① | `shared/ui/virtual/rowMount.ts:7` 추가 판정 | 직전 집합에 없는 키가 하나라도 있으면 참 · 제거만 · 같은 집합 · 순서만 바뀜 → 거짓 | `rowMount.test.ts` rm1(첫 마운트 `[]→[0,1]` → 알림 1) · rm2(교체 `[0,1]→[1,2]` → 1) · rm3(제거만 `[0,1,2]→[0,1]` → 0) · rm4(같은 집합 재렌더 → 0) · rm5(같은 크기 다른 키 `[0,1]→[2,3]` → 1) · rm7(순서만 `[0,1]→[1,0]` → 0) |
| ② | `rowMount.ts:8` 기준 갱신 | 다음 비교 기준 = 이번 커밋의 키 집합 | rm8(`[0,1]→[0,1,2]→[0,1,2]→[1,2]→[1,2,3]` → 알림 누계 2) |
| ③ | `rowMount.ts:9` 알림 | 추가면 공급된 알림 1회 · 공급자가 없으면 아무 일도 하지 않음 | rm1 · rm6(공급자 없음 → 예외 0) |
| ④ | `shared/ui/virtual/useVirtualRows.ts:45` 생산자 | 공통 가상 행 뷰의 마운트 키 = 가상 항목 key | po4(산출물 `VirtualCodeView` 행 첫 마운트) · AT c2 `artifact-*`·`transcript-*` |
| ⑤ | `harnesses/common/rightpanel/FileDiffSection.tsx:436` 생산자 | Git 본문 마운트 키 = 그린 행의 `row.id` | po1(펼침 → 행 첫 마운트) · AT c2 `git-*` |
| ⑥ | `components/transcript/TranscriptViewport.tsx:704` 공급 | 카드 내부 목록의 알림 = `cancelNestedSelection` | tn1 · AT c2 `transcript-*` |
| ⑦ | `TranscriptViewport.tsx:462-469` 소유자 판정 | 선택 없음 · 밖 → 유지 · 안 · 드래그 중 → 선택 해제 + 표시(`selectedKeys`) 해제 + 제스처 `cancel` | `TranscriptViewport.nestedSelection.test.ts` tn1(안 → 해제 · 표시 해제) · tn2(밖 → 유지) · tn3(없음 → 변화 0) · tn4(드래그 중 → `data-selection-suppressed`) |
| ⑧ | `rightpanel/DiffReview.tsx:126` 공급 | Git 본문 알림 = `usePanelSelection.notify` | po1 · po2 · AT c2 `git-*` |
| ⑨ | `DiffReview.tsx:128` 제스처 시작 배선 | 소유 요소 pointerdown → 제스처 시작 | po3(pointerdown 뒤 새 키 → `data-selection-suppressed`) |
| ⑩ | `rightpanel/ArtifactViewer.tsx:132` 공급 | 산출물 본문 알림 = `usePanelSelection.notify` | po4 · AT c2 `artifact-*` |
| ⑪ | `ArtifactViewer.tsx:134` 제스처 시작 배선 | 같음 | po5 |
| ⑫ | `features/chat/hooks/usePanelSelection.ts:58-64` 판정 | 제스처 idle · 안쪽 기록 없음 · 선택이 이 화면에 없음 → 유지 · 끝 하나라도 이 화면 안 → 선택 해제 · 드래그 중 → 해제 + 억제 | `usePanelSelection.test.ts` ps1(선택 없음 → 해제 0) · ps2(두 끝 안 → 해제 1) · ps3(두 끝 형제 패널 → 0) · ps4(anchor 밖·focus 안 → 1) · ps10(오른쪽 버튼 pointerdown → 억제 0) · ps11(제거만 → 0) · ps12(같은 키 내용 변경 → 0) |
| ⑬ | `usePanelSelection.ts:39-43` 억제 중 재해제 | 억제 중 안쪽 `selectionchange` → 다시 해제(같은 제스처에서 되살아나지 않음) | ps5(드래그 중 새 키 → 억제 → 안쪽 선택 변경 → 해제 2회째) |
| ⑭ | `usePanelSelection.ts:48-50` 제스처 끝 | `pointerup` · `pointercancel` · 창 `blur` → idle(새 드래그 가능) — 세 항 | ps6(pointerup) · ps7(pointercancel) · ps8(blur) — 각각 뒤 새 pointerdown·선택 → 해제 0 |
| ⑮ | `usePanelSelection.ts:20-27` 문서 전환 | 문서 키가 바뀌면 억제 해제 · 제스처 idle · 안쪽 기록 초기화 — 세 항 | ps9(억제 중 문서 키 변경 → 억제 0 · 새 키 없이 선택 변경 → 해제 0) |

- 자리 검색 명령(`app/`): `rg -n "keys\.some\(\(key\) => !previous\.current\.has\(key\)\)|previous\.current = new Set\(keys\)|if \(added\) notify\?\.\(\)|^\s+useMountedRows\(|VirtualRowMountContext\.Provider value=|const cancelNestedSelection = useCallback|const notify = useCallback|if \(inside\.current && isSuppressed\(gesture\.current\)\)|document\.addEventListener\('pointerup'|if \(key !== documentKey\)|onPointerDown=\{nativeSelection\.onPointerDown\}" src/renderer/src/shared/ui/virtual src/renderer/src/features/chat/hooks/usePanelSelection.ts src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx src/renderer/src/features/chat/harnesses/common/rightpanel --glob '!*.test.*'` → `0bb0783e` 16줄 = 자리 15 + 뺀 1(`TranscriptViewport.tsx:509` — 0326 바깥 목록 제스처 끝, VP-47·VP-50 회귀).
- 등록 변이: ① W1 추가 판정 → 크기 비교(rm5 red) · W2 제거만도 참(rm3·ps11 red) · ② 기준 갱신 제거(rm8 red) · ③ W3 알림 제거(rm1·ps2·tn1·po1·po4·AT c2 red) · ⑥⑧⑩ 공급 값 → `null` 각각(tn1 · po1 · po4 · 그 화면 AT c2 red) · ⑦ 조기 반환 제거(tn2 red) · ⑫ `contains` 의 `focusNode` 항 제거(ps4 red) · ⑬ 재해제 제거(ps5 red) · ⑭ 세 항 각각 제거(ps6 · ps7 · ps8 red) · ⑮ 억제 해제 제거(ps9 red).
- IT seam: 선택은 `components/transcript/viewportSelection.testfixture.ts` 의 가짜 선택을 쓴다. tn 은 `TranscriptViewport.harness.test.ts` 의 production 조립에서 `renderBlock` 이 production `useMountedRows` 를 부르는 자식을 그린다. po 는 production `DiffReview`(접힌 파일 → 펼침)·`ArtifactViewer`(loading → ready 코드 결과)를 렌더한다. ps 는 production `usePanelSelection` 과 공급자·자식(production `useMountedRows`)으로 조립한다.
- 실패 의미: ①②가 틀리면 스크롤마다 과취소되거나(제거만도 참) 같은 크기의 교체를 놓친다. ⑥⑧⑩이 빠지면 그 화면에서 새 행이 들어와도 선택이 남아, 마운트된 적 없는 행을 포함한 선택을 복사한다. ⑫ 가 밖도 지우면 다른 패널 스크롤로 선택이 사라진다.
- 선언 경계 B29: AT 는 새 키를 스크롤로만 만든다 — 펼침·결과 도착의 첫 마운트는 IT po1·po4 가 맡는다.
- 선언 경계 B30: AT c4 화면 쌍은 `transcript-diff` ↔ `git-inline` 두 방향이다 — 산출물과 다른 패널의 격리는 ps3(형제 패널 선택)이 판정한다.
- 선언 경계 B31: 억제 중 선택 표시 스타일(`user-select`)은 계약이 아니다 — `ArtifactViewer.tsx:136` 에만 있고 `DiffReview` 에는 없다. "같은 제스처에서 되살아나지 않는다" 는 ⑬ 재해제가 맡고 ps5 가 잰다.

**EP-31 · MD-17 / VP-59 — 선택 실측 판정기** — 자리 6. 이름은 계약이다.

| # | 자리 | 규칙(분기) | 직접 oracle 좌표 |
|---|---|---|---|
| ① | `judgeVisibleViews` 격자 | 화면 × 시나리오 — 모르는 기록 `reason: 'unknown record'` · 빠진 기록 `reason: 'missing record'` | vv1(통과 격자) · vv2(빠진 기록) · vv3(모르는 화면) |
| ② | `cancelFailures` c2 | `keysAfter∖keysBefore` ≥ 1 ∧ `endpointsConnected` ∧ `selectionAfter === ''` ∧ `clipboard === 'unchanged'` — 네 항 | vv4(차집합 0 — 스크롤 언마운트 형태) · vv5(연결 거짓 — W3e 형태) · vv6(선택 남음) · vv7(클립보드 바뀜) |
| ③ | `copyFailures` c1·c5 | `clipboard === expected` · 마운트 행 < 150 · 첫·끝 행 도달 | vv8(c1 불일치) · vv9(c5 불일치 · 마운트 150) |
| ④ | `isolationFailures` c4 | `selectionAfter === selectionBefore` ∧ `clipboard === selectionBefore` | vv10(다른 패널 선택 사라짐) |
| ⑤ | `main` 종료 코드 | 바이너리 없음 → `reason: '환경 없음'` exit 3 · 실행 실패·하네스 오류 → exit 1 · 판정 실패 → 1 · 통과 → 0 | vv11(네 경우 · 주입 `MAIN_DEPS`) |
| ⑥ | `runElectron(` 호출 | `check-transcript-selection.mjs` 의 `runElectron` 을 부른다(root Linux `--no-sandbox`) | vv11(주입 deps 로 호출 확인) · 기존 `check-transcript-selection.test.mjs` 의 실행 인자 케이스 |

- 자리 검색 명령(`app/`): `rg -n "^export (async )?function (judgeVisibleViews|cancelFailures|copyFailures|isolationFailures|main)\b|reason: '(unknown record|missing record|환경 없음)'|runElectron\(" scripts/check-visible-views.mjs` → 구현 뒤 9줄(정의 5 · 사유 3 · 호출 1).
- 등록 변이(VP-59): ② 차집합 항 제거(vv4 red) · 연결 항 제거(vv5 red) · ① 빠진 기록 검사 제거(vv2 red).
- 실패 의미: 판정기가 느슨하면 앱 취소 없이 저절로 비는 선택(W3e)이 통과한다. 모르는 형태는 실패로 막는다(fail-closed).

#### ΔV6 V 변경

| Node / pair | provenance · requiredness | production path | 직접 oracle | 선택 적대 증거 | §10 |
|---|---|---|---|---|---|
| MD-05 / UT-05 · VP-34 | CHANGED(ΔV6) · REQUIRED | `useMountedRows(keys)` → 추가 판정 → 기준 갱신 → 알림 | `rowMount.test.ts` rm1~rm8 | W1(rm5) · W2(rm3) · 기준 갱신 제거(rm8) · W3(rm1) | EP-30 ①②③ |
| AR-07 / IT-07 · VP-26 | CHANGED(ΔV6) · REQUIRED | 생산자(`useVirtualRows` · `FileDiffSection`) → 공급(세 소유자) → 소유자 판정(`cancelNestedSelection` · `usePanelSelection.notify`) | tn1~tn4 · po1~po5 | 공급 값 `null` 셋(tn1 · po1 · po4) · ⑦ 조기 반환 제거(tn2) | EP-30 ④~⑪ |
| SD-05 / ST-05 · VP-14 | CHANGED(ΔV6) · REQUIRED | pointerdown → 드래그 → 새 키 → 억제 → 안쪽 선택 변경 재해제 → 제스처 끝 → 새 드래그 · 문서 전환 정리 | ps1~ps12 | ⑬(ps5) · ⑭ 세 항(ps6~ps8) · ⑮(ps9) · ⑫ `focusNode`(ps4) | EP-30 ⑫~⑮ |
| R-09 / AT-09 · VP-09 | CHANGED(ΔV6) · REQUIRED | 실제 입력 → production 소유 화면 → 선택 → 복사 \| 새 키 → 취소 | AT `check-visible-views` c1·c2·c4·c5 × 7화면 | W3(c2 red) · 공급 값 `null`(그 화면 c2 red) | EP-30 ④⑤⑥⑧⑩(실제 런타임) |
| MD-17 / UT-17 · VP-59 | NEW · REQUIRED | 원자료 → `judgeVisibleViews` → 판정 · `main` 종료 코드 | `check-visible-views.test.mjs` vv1~vv11 | 위 등록 변이 3 | EP-31 (6) |
| VP-50(REGRESSION) | 변경 없음 | — | `check-transcript-selection` 90기록 | — | — |

- SUPERSEDED 이관(D-064): EP-10 · EP-20 의 자리와 VP-34 의 적대 증거(나란히 끝점 칸 맞바꿈 · 조각 계획 변이)는 ΔV1 이 장치를 뺐으므로 폐기한다. VP-34 의 AC15·AC35 몫은 위 VP-34·VP-26·VP-14·VP-09(ΔV6)가 든다.

#### ΔV6 구현 설계 · 파일

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/scripts/check-visible-views.mjs` | 판정 · 실행 | EP-31 판정 함수 · `MAIN_DEPS` · `main` — 실행부는 `check-transcript-selection.mjs` 재사용 | vv1~vv11(순수 · 주입 `MAIN_DEPS`) |
| `app/scripts/check-visible-views.test.mjs`(신규) | AC40 UT | vv1~vv11 | — |
| `app/scripts/visible-views/probe.tsx` | AT 화면 | production 소유 화면 7 + c4 쌍 화면. 자체 `usePanelSelection`·공급자를 두지 않는다 | — |
| `app/scripts/visible-views/electron-main.mjs` | AT 입력·기록 | c1·c2·c4·c5 입력과 원자료 기록 — 통과 판정은 하지 않는다 | — |
| `shared/ui/virtual/rowMount.test.ts`(신규) | VP-34 | rm1~rm8 — 공급자 spy | 렌더 하네스 |
| `features/chat/hooks/usePanelSelection.test.ts`(신규) | VP-14 | ps1~ps12 | `viewportSelection.testfixture.ts` |
| `features/chat/components/transcript/TranscriptViewport.nestedSelection.test.ts`(신규) | VP-26 transcript | tn1~tn4 | `TranscriptViewport.harness.test.ts` 조립 · `renderBlock` 자식 |
| `features/chat/harnesses/common/rightpanel/panelSelectionOwners.test.ts`(신규) | VP-26 Git·산출물 | po1~po5 | production `DiffReview`·`ArtifactViewer` |
| `app/AGENTS.md` | 스크립트 목록 | `check-visible-views.mjs` verify 실행 도구 한 줄(종료 코드 · `xvfb-run`) | `check-doc-inventory.mjs --check` |

- 테스트 소스 규칙: 새 테스트 파일은 unit 풀이다 — 자식 프로세스·SQLite·실제 git 0, `[test-pools]`·예산 가드 위반 0(§7-A 운영 gate).
- 생산 코드 변경은 요구하지 않는다. 위 oracle 이 생산 결함을 드러내면 고치고 `[구현자 기입] 놓친 잠재 문제` 에 적는다. EP-30 밖 0326 자리(바깥 목록 제스처 `TranscriptViewport.tsx:509` 등)를 고쳐야만 통과하면 그 경로를 멈추고 `PLAN_GAP` 으로 돌린다.

#### ΔV6 운영 gate (§7-A 표에 더한다)

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| 선택 실측(새 화면) | AC15 · AC35 · AC40 | `cd app && xvfb-run -a node scripts/check-visible-views.mjs` → exit 0 · 원자료 JSON 을 verify `evidence/` 에 둔다 | exit 1 · exit 3 은 그 AC 미완료(환경 없음 — PASS 아님) |

#### ΔV6 READY self-review (관측)

- Decision: D-062~D-064 ACTIVE · SUPERSEDED(결정) 0 · OPEN 0. D-052 문장 변경 0.
- 확장 창: H1 은 verify 1회째 뒤 채택(창 안). 다음 verify 2회째 뒤 설계 턴이 열거 원문을 늘릴 수 있는 마지막 턴이다.
- V: NEW·CHANGED 왼쪽 노드 MD-05·AR-07·SD-05·R-09·MD-17 ↔ REQUIRED VP-34·VP-26·VP-14·VP-09·VP-59 · VP-50 REGRESSION 그대로 · SUPERSEDED 자리(EP-10·EP-20)의 증거 이관은 D-064(폐기 근거).
- 분모: EP-30 검색 `0bb0783e` 16줄 실측 − 뺀 1 = 15 · EP-31 구현 뒤 9줄(자리 6).
- 규칙 칸 ↔ 입력 칸: EP-30 ①(추가 · 제거만 · 같은 집합 · 순서 · 같은 크기 교체) ↔ rm1~rm5·rm7 · ⑦(없음 · 밖 · 안 · 드래그) ↔ tn1~tn4 · ⑫(없음 · 안 · 밖 · 한 끝 · 오른쪽 버튼 · 제거만 · 같은 키) ↔ ps1~ps4·ps10~ps12 · ⑭ 세 항 ↔ ps6~ps8 · ⑮ 세 항 ↔ ps9 · EP-31 ②(네 항) ↔ vv4~vv7.
- 방향: "취소한다" 자리는 알림·공급 제거 변이(W3 · `null`)가, "취소하지 않는다" 자리는 과취소 변이(W2 · 조기 반환 제거)가 red 여야 한다. AT c2 는 D-063 의 끝 노드 연결 항으로 저절로 비는 선택(W3e 형태)을 가른다.
- 수치 계약 런타임: 마운트 행 < 150 · 클립보드 문자열은 실제 Electron 에서 잰다 · 사람 실기로 미룬 것 0.
- 조사 대조: `probe.tsx:46-50` 이 소유자 재구현 · `check-transcript-selection.mjs:103-104` 에 root `--no-sandbox` 있음 · 가짜 선택 `viewportSelection.testfixture.ts:25`·`:119`·`:140` 있음 · `TranscriptViewport` `renderBlock` prop `:111` 있음.

## 기준본 V1 rev 3 (선택·복사 규정은 위 ΔV1으로 대체 · 꼬리 전환 회귀는 위 ΔV2가 더하고 ΔV3·ΔV4 가 일부를 대체한다 · ΔV5 는 AC4·EP-3 ③ 의 마지막 작업 규칙을 보탠다 · ΔV6 는 선택 취소 pair·§10 과 AT 도구를 고정한다)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0327-worker-protocol-visible-views` |
| 작성자 | Claude Code |
| 일자 | 2026-11-19 (V1) · 2026-11-20 (V1 rev 2 · V1 rev 3) |
| 매핑 | 0325 후속 단계 C — 요청서 T08·T14 잔여·T15 잔여·T22·T23·T27·T33(테마 재강조) · 요청서 "공통 워커 요청 규약" · 0326 B9(스트리밍 꼬리) · 0325 B21(펼친 OpenCode 파일 본문) |
| 상태 | READY (V1 rev 3) |
| V mode | `Baseline V` — rev 2·rev 3 은 구현 전 기준선 정정이다(V1 은 구현·verify 0회). 노드 ID 는 V1 을 잇고 rev 2·rev 3 이 더한 노드는 §7-A 에 `rev 2`·`rev 3` 으로 표시한다 |
| 기준 V | `none` — 0324·0325·0326 노드는 INHERITED REGRESSION 으로만 참조한다(`0325:V1 rev 4 + ΔV1 + ΔV2@d868468` — `origin/main` 조상 확인 · `0326:V1 rev 7` — 설계 `5b489f8`, 작업 브랜치, `main` 미병합) |
| 이번 V revision | `V1 rev 3` — 설계 커밋 좌표 `(V1 rev 3 설계 — 검증자 기입)`. V1(rev 1)·rev 2 설계 좌표는 `(V1 설계 — 검증자 기입)`·`(V1 rev 2 설계 — 검증자 기입)`(PR #643 브랜치, `main` 미병합) |
| 유효 V | `V1 rev 3` |
| AS-IS 트리 | V1 줄 참조 = `de270fe`. rev 2 가 더한 줄 참조(F19~F30 · M13b~M21) = `2707d71` 트리 — app 트리는 0326 r2 `b46ddc9` 와 같다(`git diff 2707d71 62125ea -- app` 0줄 · PR #640 브랜치, `main` 미병합). `de270fe..2707d71` 사이 §18 production 파일 중 바뀐 것은 `TranscriptViewport.tsx` 하나(`git diff --name-only de270fe 2707d71 -- app/src` 비테스트 · §18 교집합). rev 3 이 더한 줄 참조(F31~F36 · M22~M25)도 같은 app 트리다(`git diff 2707d71 371437e -- app` 0줄) |
| 구현 착수 조건 | 0326 기계 verify PASS 뒤(D-003). 착수 턴은 §18 파일과 §8 줄 참조를 0326 PASS 커밋과 다시 대조해 `[구현자 기입] 설계 리뷰`에 차이를 적는다 — 0327 은 0326 이 고치는 `CodeBlock.tsx`·`StreamingMarkdown.tsx` 를 고치고, 0326 의 `TranscriptViewport.tsx`·`CopySerializationHost.tsx`·`textOffset.ts`·`copy.ts` 계약을 넓힌다(D-040 · §8 F1 분류) |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 큰 diff·코드·문서를 그리는 화면이 입력 크기에 비례해 창(UI 스레드)이나 계산 워커를 오래 잡는다. Git 패널에서 5만 줄 추가 파일을 펼치면 렌더 작업이 약 13초다(node SSR — 좌우 짝 찾기 O(n²) 3.8초 포함, §8 M1·M2). 같은 파일의 구문 토큰은 워커를 26초 잡는다(M4). 1MB Markdown 미리보기는 창에서 11.5초다(M6). rev 2 실측: 행 1,600개 표 한 블록은 파싱만 1.1~1.8초(M18c — 행 수에 초선형), 상한(32,000자) 안의 minified JS 한 줄 강조는 워커 1.0초(M17b), 모두 펼치기 4 × 5만 줄은 첫 paint 전 창 모델 76ms(M16). rev 3 실측: 열이 많은 표는 200행 한 조각도 초선형(200행 × 50열 2.5초 — M22) · 촘촘한 50,000자 블록은 노드 60,003개·창 반영 62.9ms(M22c) · 전부 다른 5,000 + 5,000줄 쌍 diff 는 워커 2.9초(M23).
- **완료 후 달라지는 것**: 큰 본문은 보이는 행만 그린다 — Git 리뷰 본문·400줄을 넘는 도구 카드 본문·산출물 코드 보기. 큰 diff 의 행 모델·짝·폭·축·위치 색인은 워커가 원천 revision 마다 한 번 만들고 창은 가시 행과 요청한 위치만 받는다(작은 입력만 창 동기 — D-027). 모두 펼치기는 화면 근처 파일만 계산한다(D-028). 구문 색은 보이는 범위만 워커가 만들고 한 작업은 약 50ms 에서 양보한다(D-031). 4,000자를 넘는 Markdown 은 두 번째 워커(Markdown 레인)가 블록마다 파싱한다(D-034). 복사 결과는 전체를 마운트했을 때의 Chromium 기본 복사와 같다(D-029).
- **보장하지 않는 것**: Windows 허용치 판정(0325 D-025 OPEN — W) · 완료된 큰 text 블록의 창 파싱(0326 B11 — D-026) · 상한·노드 예산을 넘는 Markdown 블록의 서식(원문 표시 — D-033·D-045) · 계산 레인에서 분할 불가 작업(쌍 jsdiff·강조) 뒤에 선 요청의 대기(B20 — 현행과 같다) · 20,000자 이상 줄의 구문 색(D-031) · 4,000자 이하 Markdown 과 32,000자 이하 코드 블록의 현행 동기 경로.
- **한 문장**: 5만 줄 diff·5MiB 코드·1MB 문서를 열어도 창은 보이는 행만 그리고, 워커는 보이는 범위만 50ms 단위로 계산하며, Markdown 파싱이 코드 강조를 막지 않고, 복사는 지금과 같은 문자열을 낸다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 325에서 지정했던 새 핸드오프 후보를 이어서 진행한다(핸드오프 325 후속). docs/handoff/index.md, docs/handoff/0325.../input/*.md 요구사항을 참고하면 더욱 명확하다." | 턴 1 (`/handoff-plan 327`) |
| 명시 요구(질의 1) | "C 단독 (Recommended)" — 0327 은 0325 후보 C(워커·Git·코드·산출물) | 턴 1 질의 |
| 명시 요구(질의 2) | "C 전체 하나로" — 선택지 설명 "T08(코드 블록 행 번호)·T27(산출물 Markdown)·T33(테마 재강조)·Claude 도구 카드 행까지 0327에 포함한다. AC 약 30개, 0326과 CodeBlock·ToolCard·markdownBlocks를 함께 고치게 되어 0326 r2 이후로 구현 착수가 밀린다." | 턴 1 질의 |
| 명시 요구(질의 3) | "임계 초과 시 내부 스크롤 (Recommended)" — "400줄을 넘는 본문만 최대 높이(OpenCode와 같은 384px)·내부 스크롤·가시 행 렌더로 바꾼다. 400줄 이하는 지금과 같다. 구문 색은 보이는 행만 요청한다. 카드 복사 버튼은 전체 원문을 그대로 복사한다." | 턴 1 질의 |
| 명시 요구(질의 4) | "블록 + 워커 파싱 (Recommended)" — "문서를 블록으로 나눠(1MB 1.4ms) 화면 근처 블록만 워커가 파싱하고 창은 받은 블록만 그린다. 창 파싱 0, 첫 화면 즉시. 블록 간 참조 정의는 모아 붙이고 목록·인용은 나누지 않는다 … unified·remark-parse·remark-rehype·hast-util-to-jsx-runtime을 직접 의존성으로 선언한다 — react-markdown이 이미 설치하는 전이 의존성이지만 정책상 승인이 필요하다." | 턴 1 질의 |
| 명시 요구(질의 5) | "포함 (Recommended)" — "산출물과 같은 워커 Markdown 파서로 transcript 스트리밍 꼬리를 처리한다. 0326의 StreamingMarkdown·markdownBlocks를 건드리므로 구현은 0326 PASS 뒤에 착수한다." | 턴 1 질의 |
| 명시 요구(첨부) | 요청서 T08·T14·T15·T22·T23·T27·T33 의 "요청할 변경 및 목표 소유자" · 절 "공통 Web Worker·인라인 diff·Git 리뷰" 의 함께 처리할 설계 항목과 완료 기준 | 0325 `input/0324-agent-requests.ko.md` |
| 명시 요구(첨부) | 0325 §6-C C 행 — 선행 계약 "공통 워커 요청 규약 — 문서 ID·revision·옵션 기반 캐시 키 · 취소·오래된 응답 폐기 · 가시 범위 응답, 후속 구현 전" · 완료 근거 "W 계산 · R 가시 DOM · data/agent 원천" · §6-D T22 W 열 "hunk·좌우 행·주석 위치 인덱스" · T14 잔여 W 열 "파싱·차이·토큰·행 투영" | 0325 plan §6-C·§6-D |
| 명시 요구(rev 2) | "pr 643 지적사항을 검토 후 plan 보완하라" — 검토 대상은 소유자 코멘트 "0327 계획 통합 검토 — 수정 후 READY" 의 14 항목(§4-A P1~P14). 그 안의 결정 문장: "합의안은 큰 patch의 모델·짝·폭·축·위치 색인을 worker가 revision별로 한 번 만들고, renderer는 가시 행과 요청 위치만 받아 스크롤·초안·DOM을 담당하는 것입니다. 작은 입력은 문자·행 상한과 실측이 있는 동기 경로를 허용합니다." · "READY 조건은 위 결정을 plan의 D·AC·EP·테스트·실측 절에 일관되게 반영하는 것입니다" | 턴 2 (`/handoff-plan` · PR #643 코멘트 2026-11-20) |
| 명시 요구(질의 6) | "현행과 동일 (Recommended)" — 선택지 설명 "전체 행을 마운트했을 때의 Chromium 기본 복사와 같은 결과 — 시작·끝 칸은 선택한 글자까지, 칸은 탭·행은 줄바꿈. 0326 동기·비동기 복사 경로를 내부 목록까지 확장해 구현한다." | 턴 2 질의(B7) |
| 명시 요구(rev 3) | "pr 643의 코멘트를 검토하고 대응하라" — 검토 대상은 소유자 코멘트 "0327 rev 2 후속 정리 — 반영된 합의와 남은 수정안"(§2 세 항목)과 "rev 2 검토 범위와 다음 재검토 기준"(7행 — 앞 세 항목 포함, §4-B P15~P21). 그 안의 결정 문장: "큰 diff의 worker 소유, 근접 계산, Work의 250px 단일 스크롤, Markdown 레인 분리, Chromium 복사 기준, S-C0 복합 시나리오는 rev 2에서 정한 방향을 채택합니다" · "재검토 방식 — 각 행에 수정된 결정·AC·검증 사례를 대응시키고, 충족되면 해당 행을 닫습니다" · "Windows 실측값은 구현 후 검증하며 지금은 절차·기대값을 확정합니다" | 턴 3 (`/handoff-plan` · PR #643 코멘트 2건 2026-11-20) |
| 명시 요구(질의 7) | "앱 화면이 바로 지움 (Recommended)" — 선택지 설명 "펼치는 즉시 본문이 보입니다(지금과 같은 동작). 지우는 데 400만 자 기준 2.4ms라 눈에 띄지 않습니다. 대기 화면과 실패 화면이 없습니다. 지금은 화면을 다시 그릴 때마다 다시 지우지만 앞으로는 한 번만 지웁니다." — 질문은 400줄 이하·합계 100만 자 초과 Read 카드에서 줄 번호 접두('1→')를 지우는 위치였다(두 선택지의 최종 화면은 같다) | 턴 3 질의(P19) |
| 추론 의도 | 요청서의 "W 가 맡는다" 는 창의 일을 줄이는 수단이다 — 같은 입력에서 UI 점유·전송량·첫 행 지연을 재서 작은 입력의 창 동기 경로만 예외로 둔다(D-027 · M21) | 설계자 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0327 은 0325 후속 단계 C 다 | "C 단독 (Recommended)" | 턴 1 질의 1 | ACTIVE | — |
| D-002 | C 를 나누지 않는다 — 0325 §6-C C 행의 대응 T 전부(T08·T14 잔여·T15 잔여·T22·T23·T27·T33 테마 재강조)와 Claude 도구 카드 행. AC 25 상한을 넘는다(AC1~AC36) | "C 전체 하나로" | 턴 1 질의 2 | ACTIVE | — |
| D-003 | 이번 산출은 plan(READY)까지다. 구현 착수는 0326 기계 verify PASS 뒤다 | 질의 2 선택지 "0326 r2 이후로 구현 착수가 밀린다" · 질의 5 "구현은 0326 PASS 뒤에 착수한다" | 턴 1 질의 2·5 | ACTIVE | — |
| D-004 | 도구 카드 긴 본문 — 400줄을 넘는 본문만 최대 높이 384px·내부 스크롤·가시 행 렌더. 400줄 이하는 지금과 같다. 구문 색은 보이는 행만 요청한다. 카드 복사 버튼은 전체 원문을 복사한다 | "400줄을 넘는 본문만 최대 높이(OpenCode와 같은 384px)·내부 스크롤·가시 행 렌더로 바꾼다 … 카드 복사 버튼은 전체 원문을 그대로 복사한다" | 턴 1 질의 3 | ACTIVE | Work 본문은 D-036 이 적용 형태를 정한다 |
| D-005 | 산출물 Markdown 미리보기 — 블록으로 나누고 화면 근처 블록만 워커가 파싱, 창은 받은 블록만 그린다(창 파싱 0 · 첫 화면 즉시). 블록 간 참조 정의를 모아 붙이고 목록·인용은 나누지 않는다. `unified`·`remark-parse`·`remark-rehype`·`hast-util-to-jsx-runtime` 직접 의존성 선언을 승인한다 | "블록 + 워커 파싱 (Recommended)" 선택지 문장 | 턴 1 질의 4 | ACTIVE | — |
| D-006 | 0326 B9(loose list·긴 문단 꼬리)를 포함한다 — 산출물과 같은 워커 Markdown 파서로 스트리밍 꼬리를 처리한다 | "포함 (Recommended)" 선택지 문장 | 턴 1 질의 5 | ACTIVE | — |
| D-007 | 승계: 0324 D-007(50ms·160ms) · 0324 D-008(상한 없는 계산은 UI 스레드에 두지 않는다) · 0324 D-009(워커 실패 시 UI 대체 계산 없음) · 0324 D-012(강조 상한 32,000자) · 0325 D-008(diff 문자 우선 상한) · 0325 D-011 · 0325 D-037(카드 머리 원문 예산) · 0325 D-038(캐시 비용 = 키 + 워커가 센 크기) · 0326 D-087·D-094(복사 기준·task 당 50ms) | 각 plan §3 ACTIVE | 0324·0325·0326 plan | ACTIVE | — |
| D-008 | **공통 워커 요청 규약**(§10 EP-1~EP-4) — ① 문서는 `{ id, revision }` 으로 식별하고 소비자는 임차(lease)한다 ② 문서 본문은 그 문서를 쓰는 첫 작업 직전에 워커마다 한 번 보낸다 ③ 범위 토큰·Markdown 블록·diff 보기 요청은 문서 참조로 보내고 키 = 종류·문서 id@revision·옵션·범위 ④ 한 작업의 일은 상한 안이다 — 넘으면 `continue` 로 대기열에 돌아간다 ⑤ 우선순위 `visible` > `background` ⑥ 취소는 소비자에게서 결과를 뗀다 ⑦ 소비자는 현재 요청과 다른 결과를 버린다 ⑧ 워커가 바뀌면 문서를 다시 보낸다 | 요청서 "공통 워커 요청 규약은 워커 담당자가 소유한다" · 0325 §6-C 선행 계약 · 요청서 설계 항목 "워커 실패·연속 실패 폴백, 가시 요청 우선순위, 요청 취소 뒤 오래된 결과 폐기 … 토큰 키에는 문서 revision·언어·테마·표시 옵션을 반영한다" | 요청서 · 0325 §6-C · 설계자 | ACTIVE (0325 D-021 "C 의 워커 규약은 후속 구현 전에 합의할 수 있다" — PR #643 검토가 합의 절차였고 ②·④·⑥·⑦ 을 rev 2 결정이 구체화한다) | ② 워커마다 = 레인마다(D-034) · ③ 범위 규칙 D-044 · 위치 키 D-046 · 보기 원천 D-048 · ④ D-031 · ⑥ D-030 · ⑦ D-030 |
| D-009 | 문서 식별 — `id` 는 도메인 식별자이고 `revision` 은 원천 객체 identity 의 단조 번호(`revisionOf(source)` — `WeakMap`)다. 원천이 같으면 다시 마운트해도 같은 문서다. id 규칙 전부는 §10-A | 내용 해시는 창에서 O(n) 이고, 인스턴스 id 는 가상 스크롤 재마운트마다 캐시를 잃는다(0324 "같은 내용이 캐시에 있으면 다시 놓였을 때 첫 렌더부터 색상" 보존) | 설계자 | ACTIVE | Work 요청·응답 분리는 D-036 |
| D-010 | 열린 문서 문자 합 상한 `COMPUTE_DOC_MAX_CHARS = 32,000,000`(레인마다) — 넘으면 새 문서는 보내지 않고 그 문서의 요청은 즉시 실패한다(소비자는 원문). 다른 문서가 닫혀 용량이 돌아오면 그 임차가 사용 가능으로 바뀌고 소비자가 다시 요청한다 | 패치 한 벌 ≤ 200,000줄(`git-diff-parse.ts:215`) · 산출물 ≤ 5MiB(`formats.ts:5`) · 회복 뒤 재시도는 PR #643 P6 | 설계자 | ACTIVE (사용자 거부 가능) | 파생물 보유는 D-032 |
| D-011 | Git 리뷰 본문의 행 모델은 창이 파일마다 O(n) 한 번 만든다 — 워커로 옮기지 않는다 | 5만 줄 줄 객체 구조화 복제 42.6ms(M3)가 창 계산보다 크다 | 설계자 · §8 M1~M3 | **SUPERSEDED** | D-027 — 비교가 줄 객체 전체 복제였고(창 전송은 200행 창 0.09ms — M15) 창 비용에 짝·폭·요구사항 색인·모두 펼치기가 빠졌다(M14·M16) |
| D-012 | 단어 강조 짝은 본문당 O(n) 색인 한 번이다. 결과는 현행 `counterpartOf`(`FileDiffSection.tsx:488-512`)와 모든 입력에서 같다 — 삭제 묶음 뒤 추가 묶음이 짧을 때 다음 묶음의 추가 줄과 짝짓는 현행 동작 포함 | 5만 줄 추가 묶음에서 뒤로 걷기 1,249,975,000회 · 3,788ms(M1) · O(n) 판이 무작위 20,000 입력에서 현행과 불일치 0(M14) | 설계자 | ACTIVE | 위치: 두 경로 공용 `shared/compute/diffView.ts`(D-027) |
| D-013 | 가상 행 규칙 — 행이 400 이하인 목록은 전부, 넘으면 가시 + overscan + 고정 행(선택 끝·초안)만 마운트한다. Git 파일 본문은 스크롤 소유자의 위·아래 한 화면 안에 들지 않으면 행을 그리지 않는다 | 모두 펼치기(`diffViewMenuItems.ts:41`) · 파일 200개 상한(`git-diff-parse.ts:18`) | 설계자 · D-004 | **SUPERSEDED** | D-028 — 행만 0 이고 모델·축 문서·임차는 펼친 파일 전부에서 만들었다(PR #643 P2 · M16) |
| D-014 | 구문 토큰은 200줄 창 단위 범위 요청이다. 워커는 문서·언어·테마마다 200줄 간격 grammar state 체크포인트를 쌓아 전체 토큰화와 같은 색을 낸다. 테마가 바뀌면 그 테마의 체크포인트를 처음부터 만든다 | 200줄 조각 + grammarState = 전체 토큰화와 동일, 상태 없는 조각은 다름(M8) · 다른 테마의 상태를 쓰면 shiki 가 던진다(M8) | 설계자 | ACTIVE | 보유 상한은 D-032 |
| D-015 | 두 테마 동시 토큰화(테마 전환 무비용)는 쓰지 않는다 | 토큰화 비용 2배 — 2,000줄 988 → 1,958ms(M9) | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-016 | T33 테마 재강조는 현행 유지로 종결한다 — 계산 레인 동시 실행 1, 재요청 = 마운트된 소비자(효과 deps 에 테마), 이전 테마 대기 요청은 효과 정리가 취소한다. 범위 토큰 소비자는 마운트 창만 다시 요청한다 | 0325 D-043 · 32,000자 강조 167.6ms(M5) · DOM 교체 시간은 S-C6 이 잰다 | 설계자 | ACTIVE | — |
| D-017 | T23 변경 파일 트리는 현행 유지로 종결한다 | 파일 200개 트리 0.37ms + 평탄화 0.10ms(M10) | 설계자 · 0325 D-043 | ACTIVE | — |
| D-018 | 0325 B21 — 펼친 OpenCode 파일 본문의 patch 파싱은 창에 둔다 | 990,044자 patch 2.8ms(M11) | 설계자 | **SUPERSEDED** | D-037(rev 3 에 D-047 로 대체) — patch 원천도 D-027 상한(줄 5,000 · 문자 200,000)을 넘으면 워커가 파싱·모델을 만든다. 1,000,000자 초과 원문 표시(현행)는 유지 |
| D-019 | Markdown 워커 파싱 임계 `MARKDOWN_WORKER_MIN_CHARS = 4,000` — 원문이 넘는 산출물 미리보기 문서와 스트리밍 꼬리만 워커가 파싱한다. 이하는 창 동기(현행) | loose list 4,000자 창 렌더 14.9~18.8ms · 문단 2.8ms(M12) | 설계자 | ACTIVE (사용자 거부 가능) | 상한 쪽은 D-033 |
| D-020 | Markdown 문서 블록 = `splitStableBlocks` + 이어짐 합치기 + 참조 정의 덧붙임 · 각주 문서 한 블록 | M13 716/717 | 설계자 · D-005 | **SUPERSEDED** | D-033 — 블록 끝 개행·HTML 블록 1~5·인접 HTML 규칙이 빠져 있었고(M13b 최소 재현) 크기 상한이 없었다(M18) |
| D-021 | hast 계약 — 워커는 react-markdown 9 과 같은 파이프라인(`remark-parse`·`remark-gfm`·`remark-rehype` `allowDangerousHtml`)에 raw → text 치환을 적용한 hast 를 낸다. 창은 `href`·`src` 에 react-markdown `defaultUrlTransform` 을 적용하고 `Markdown` 과 같은 components 로 그린다(`passNode`·`passKeys`·`ignoreInvalidStyle`) | `react-markdown/lib/index.js` `post` — raw 노드는 text, URL 속성은 `urlTransform` | 설계자 | ACTIVE | 표 조각 합치기는 D-033 |
| D-022 | 마운트 밖 행을 가로지르는 선택의 복사는 행 모델에서 만든다 — 나란히 보기는 행 단위 | 가상 행이면 기본 복사가 마운트된 행만 담는다 | 설계자 | **SUPERSEDED** | D-029(사용자 결정 B7) · D-040 — 결과가 전체 마운트 Chromium 복사와 달랐다(나란히 부분 선택·gap·요구사항 카드 글자) |
| D-023 | 줄바꿈 끔에서 diff·코드 표의 최소 폭 = 모델이 센 최장 줄 열 수(탭은 8칸 정렬 · 동아시아 전각 2칸) — 마운트 행과 무관하다 | 가상 행이면 마운트 행이 폭을 정해 가로 막대가 스크롤마다 흔들린다 | 설계자 | ACTIVE | 폭은 모델(동기·워커 공용)이 센다(D-027) |
| D-024 | 실행 중 작업의 취소 — 워커를 끝내지 않는다(결과는 캐시 규칙대로). jsdiff 를 부를 수 있는 작업(쌍 원천 `diffView`)만 현행(대기 요청이 있으면 그 레인 워커 교체)이다 | 워커를 끝내면 열린 문서·체크포인트·하이라이터·diff 모델을 잃는다(5만 줄 앞부분 재토큰화 ≈ 26s, M4). jsdiff 는 비용 상한이 없다 | 설계자 | ACTIVE (0324 규칙 변경 — `client.test.ts:269` 기대를 쌍 원천 `diffView` 로 바꾼다) | 쌍 diff 요청 종류는 D-027(`diffLines` → 쌍 원천 `diffView`) |
| D-025 | 측정 — `app/scripts/measure-ui-inputs.mjs` 에 K 함수 재측정과 F 재현 파일을 더하고(WU-10), Windows 실기 S-C 를 0326 PASS 빌드와 0327 빌드로 0325 §19 규약(빌드 교차 3회 · N/A 규칙 · 설치본·진단 빌드 분리)대로 기록한다. 허용치 판정은 W(0325 D-025 OPEN) | 0325 D-024·D-042 | 설계자 | ACTIVE | 시나리오·지표·재측정 규칙은 D-041 |
| D-026 | 완료된 큰 text 블록의 창 파싱(0326 B11 · `AssistantSegment.tsx:33` `<Markdown source={seg.text}>`)은 0327 범위 밖이다 — 0327 의 워커 Markdown 파서가 그 이주의 기반이 된다(INDEX 후보 표) | D-006 의 범위는 스트리밍 꼬리 · 0325 C 행 T 목록에 T07 없음 | 설계자 | ACTIVE | — |
| D-027 | **큰 diff 보기 모델의 실행 소유자는 워커다.** 원천 3종 — 줄(Git patch 파일 · Claude 구조화 패치) · 쌍(old/new 문자열 — jsdiff) · patch 문자열(OpenCode). 워커가 원천 문서 revision·공백 옵션마다 한 번 모델(diff 줄 · 짝 · 폭 · 축 문서 · 증감 수 · 위치 색인)을 만들고, 창은 가시 행 창(`diffView`)·요청 위치(`diffLocate`)·요구사항 문맥(`diffContext`)만 받아 스크롤·초안·DOM 을 맡는다. 작은 입력 — 줄 ≤ `DIFF_MODEL_SYNC_MAX_LINES = 5,000` 그리고 문자 ≤ `DIFF_MODEL_SYNC_MAX_CHARS = 200,000`(쌍 원천은 기존 `withinDiffCap`) — 은 창 동기 경로다. 두 경로는 같은 순수 모듈 `shared/compute/diffView.ts` 를 부르고 같은 행 창 형을 낸다 | "합의안은 큰 patch의 모델·짝·폭·축·위치 색인을 worker가 revision별로 한 번 만들고, renderer는 가시 행과 요청 위치만 받아 스크롤·초안·DOM을 담당하는 것입니다. 작은 입력은 문자·행 상한과 실측이 있는 동기 경로를 허용합니다. 양쪽은 모델 생성 규칙을 공유합니다." · 같은 입력 비교(M21): 5,000줄 창 점유 동기 1.81ms / 워커 0.36ms(첫 행은 워커가 한 프레임 이상 늦다) · 50,000줄 12.98 / 3.61ms | PR #643 P1(소유자) · 0325 §6-D T22·T14 W 열 | ACTIVE | D-011 대체 |
| D-028 | **모두 펼치기 — 근접·선택·명시적 이동 때만 계산한다.** 펼친 Git 파일 본문은 (a) 스크롤 소유자 위·아래 한 화면 안에 들거나 (b) 그 파일의 요구사항이 선택되거나 (c) 트리·명시적 이동의 대상일 때 처음 모델 요청·축 문서 임차를 한다. 그 전에는 추정 높이 자리 `min(줄 수, 7 × (추가 + 삭제) + 1) × 20px` 만 둔다. 한 번 열린 계산은 접기·새 patch 세대까지 유지한다. 400행 이하 전부·초과 가상 규칙은 D-013 그대로 | "화면 밖 198개 파일의 DOM이 0이어도 모델·축 문자열·임차를 먼저 만들면 통과합니다. 파일 자리 높이를 확보하고 근접·선택·명시적 이동 시 계산을 요청하십시오" · 모두 펼치기 4 × 5만 줄 창 모델 76.2ms · 200 × 300 18.4ms · 축 문자 7,111,116(M16) | PR #643 P2 | ACTIVE | D-013 대체 · 행 DOM 수명은 D-051 |
| D-029 | **복사 결과 = 전체를 마운트했을 때의 Chromium 기본 복사.** 모든 가상 목록(Git 인라인·나란히 · `DiffTable` · `VirtualCodeView` · `VirtualMarkdownView`)에서 시작·끝 칸은 선택한 글자까지 · 칸은 탭 · 행은 줄바꿈 — 나란히 보기 부분 선택도 칸 오프셋을 지킨다. 기준은 0326 D-087 독립 기준(가상화·`onCopy` 를 끈 전체 마운트 + Chromium 기본 복사의 `text/plain` 과 약속 HTML — 블록 요소 순서·표시 텍스트) | "현행과 동일 (Recommended)" — "전체 행을 마운트했을 때의 Chromium 기본 복사와 같은 결과 — 시작·끝 칸은 선택한 글자까지, 칸은 탭·행은 줄바꿈. 0326 동기·비동기 복사 경로를 내부 목록까지 확장해 구현한다." | 턴 2 질의 6(B7) | ACTIVE | D-022 대체 · V1 B7 삭제 |
| D-030 | **대기열·취소·표시 권한.** 대기 순서 = (등급 `visible` < `background`, 양보 횟수 오름차순, 크기 오름차순, 도착 순). `continue` 로 돌아온 작업은 양보 횟수 +1 — 같은 등급의 새 작업과 덜 양보한 작업 뒤에 선다. 작업 등급 = 대기자 등급 중 높은 것이고 대기자가 `setPriority` 로 바꾸면 다시 정렬한다(overscan 창의 가시 승격·해제). 취소한 대기자는 즉시 거부되어 화면 반영 권한을 잃는다 · 대기자 0 이 된 분할 작업(`tokens`)은 다음 양보 지점에서 버린다 · 분할 불가 작업은 끝까지 하고 결과는 캐시 규칙대로다(D-024 예외). 소비자는 결과를 반영하기 전에 그 결과의 요청 키(종류·문서 id@revision·옵션·언어·테마·범위)가 지금 원하는 키와 같은지 본다. 대기열·중복 병합·캐시·취소의 소유자는 기존 `client.ts` 하나다 | "AC4의 '같은 등급 맨 뒤'와 EP-4의 '크기 우선 재삽입'은 큰 가시 작업이 기다릴 때 다른 결과를 냅니다. 기존 compute client가 대기열·중복 병합·캐시·취소를 단독 소유하고, 양보 직후 새 가시 작업의 실행 순서, overscan 요청의 가시 등급 승격·해제를 테스트하십시오. 취소 즉시 화면 반영 권한을 해제하고, 분할 가능한 작업은 양보 지점에서 중단하십시오. 소비자는 revision과 함께 문서·옵션·언어·테마·범위를 확인해야 합니다." | PR #643 P6 | ACTIVE | D-008 ⑥⑦ 구체화 |
| D-031 | **한 작업 상한 — 줄 수가 아니라 시간과 줄 길이로 묶는다.** `tokens` 는 한 줄씩 토큰화하고 경과가 `TOKENS_JOB_BUDGET_MS = 50` 이상이 된 줄 뒤에 상태를 저장하고 `continue` 한다. 모든 shiki 호출(`tokens`·`highlight`)에 `tokenizeMaxLineLength: 20,000`(`TOKENIZE_MAX_LINE_CHARS` — 이상인 줄은 색 없는 한 토큰)·`tokenizeTimeLimit: 50`(`TOKENIZE_LINE_TIME_LIMIT_MS`)을 준다. `diffView` 모델은 O(n) 1회 · `markdown` 은 D-033 크기 상한 | "600줄 제한으로 거대 한 줄의 토큰화 시간을 제한할 수 없습니다" · 줄 하나씩 호출 0.416ms/줄 = 한 번 호출 0.422ms/줄(M17c) · minified JS 한 줄 5,000자 이상 ≈ 1,000ms → 20,000자 상한 뒤 0.1~1.2ms · 50ms 시간 상한이면 ≤ 112ms(M17b·c) · 현행 `highlight` 32,000자 minified JS 한 줄 1,009ms | PR #643 P7 | ACTIVE (사용자 거부 가능 — 20,000자 이상 줄은 강조 출력이 바뀐다) | V1 `TOKENS_JOB_MAX_LINES = 600` 대체 · 레인 대기는 D-043 |
| D-032 | **보유·정리.** 열린 원문 상한(D-010)과 따로 센다: 체크포인트는 문서·언어·테마마다 ≤ ⌈줄 / 200⌉개(1개 ≈ 9.3KiB — M17d)이고 테마 사슬은 문서당 최근 2개 · 줄 시작 색인 4B/줄 · diff 보기 모델은 레인마다 최근 8개(원천 revision·공백 옵션) · 전송 중 결과는 작업 1개분이다. 문서 닫기(임차 0 이고 그 문서를 쓰는 실행·대기 작업 0)에서 그 문서의 파생(체크포인트·색인·모델·파생 축 문서)을 함께 버린다. 워커 교체는 전부 버린다(다음 작업 직전 재전송). 꼬리 결과는 캐시에 넣지 않는다(D-035) | "3,200만 자는 열린 원문 한도이므로 체크포인트·색인·전송 중 결과의 보유 및 정리 조건을 따로 적으십시오" · 체크포인트 50개 힙 466KiB(M17d) | PR #643 P6 | ACTIVE | D-010·D-014 보완 · 모델 캐시 체류는 D-046 |
| D-033 | **Markdown 블록 규칙 rev 2 와 크기 조건.** ① 분할은 기존 `splitStableBlocks` 결과를 그대로 쓰고 원문 오프셋 범위로 바꾼다 ② 블록 입력은 그 블록 끝 줄의 개행을 포함한다 ③ 합치기: 첫 줄이 공백으로 시작 · 목록 연속 · 인용 연속 · 인접 HTML(앞 블록 마지막 비공백 줄과 이 블록 첫 줄이 `<` 로 시작) · 열린 HTML 블록 1~5(끝 표지까지) ④ 참조 정의 덧붙임 ⑤ 각주 정의가 있으면 문서 전체 한 블록. **분할**: 표 블록은 본문 행 `MARKDOWN_TABLE_CHUNK_ROWS = 200` 개씩 머리·구분 행을 붙여 따로 파싱하고 창이 한 `table` 로 합친다. **원문 표시**(최종 상태 · 워커 요청 0): 표 본문 행 > `MARKDOWN_TABLE_MAX_ROWS = 2,000` · 표가 아닌 블록 > `MARKDOWN_BLOCK_MAX_CHARS = 50,000` · 각주 문서 > 50,000자 · 꼬리 > 50,000자 | M13b: ②③ 없이 717 중 12 불일치(최소 재현 `"* a\n* b\n</Warning>"` · `<script … />` · 인접 `<Note>`) → ①~⑤ 717/717 · 표 행 1,600 한 번 1,074~1,773ms vs 200행씩 248~296ms·결과 동일(M18c) · 표 200K자 6.7s·1M자 106s · 각주 1.16M자 2.9s·hast 14.6MB·복제 315ms·창 185ms · 50,000자 문단 197ms·목록 98ms(M18·M18b) | PR #643 P7·P8 | ACTIVE (사용자 거부 가능 — 원문 표시 범위) | D-020 대체 · 조각·노드 예산 D-045 |
| D-034 | **Markdown 레인(별도 실행).** `markdown` 작업은 두 번째 워커(markdown 레인)가 한다. 계산 레인(`highlight`·`tokens`·`codeView`·`diffView`·`diffLocate`·`diffContext`)과 대기열·실행 중 1·문서 등록부·연속 실패 수를 따로 갖는다. `new Worker(` 는 `client.ts` 에만 있다(규칙 (i)) | Markdown 파싱은 양보할 수 없고 블록 크기에 비례한다(50,000자 문단 197ms — M18b) · 스트리밍 꼬리는 delta 마다 작업을 낸다(M19 — 100K자 스트림 작업 1,333) · 같은 레인이면 코드 강조·범위 토큰이 그 뒤에 선다 | PR #643 P7 "분할·원문 표시·별도 실행을 적용할 조건을 명시하십시오" · 설계자 | ACTIVE (사용자 거부 가능 — 워커가 창마다 2개가 된다) | D-008 ② 의 "워커마다" |
| D-035 | **스트리밍 꼬리.** 판정은 기존 `advanceStableBlocks`·`openFenceTail` 이 한다(확정 블록·열린 펜스) · 열린 펜스가 아닌 꼬리 > 4,000자만 markdown 레인 · 꼬리 인스턴스마다 실행 1 + 대기 1 — 새 delta 는 대기 요청을 최신 꼬리로 바꾼다(합치기) · 보유 꼬리 문서 ≤ 2(실행 중 + 최신) · 꼬리 결과는 캐시에 넣지 않는다 · 꼬리 > 50,000자는 원문(D-033) · 완료 뒤 표시는 완료 경로(`AssistantSegment` `<Markdown>` — 0326 B11)라 꼬리 표시와 무관하다 | "확정 블록·열린 펜스는 기존 advanceStableBlocks·openFenceTail이 계속 판정하고 긴 비펜스 꼬리만 worker로 넘기십시오. 연속 delta를 병합하고 전체 꼬리 재전송량·동시 보유 revision·취소된 결과 캐시·최종 서식 일치를 검증하십시오" · 합치기 없으면 100K 스트림 전송 합 1억 자, 합치기면 5,486만 자(M19) | PR #643 P8 | ACTIVE | D-006 구체화 |
| D-036 | **Claude Work 본문 — 기존 250px 컨테이너가 유일한 스크롤 소유자다.** 요청·응답 payload 가 400줄을 넘으면 그 컨테이너(`WorkToolBody.tsx:44-51`)를 스크롤 요소로 받는 가상 코드 보기로 그린다(자기 스크롤 없음 · 384px 중첩 없음). 문서 id 는 요청 `tool:${toolUseId}:work:request` + `revisionOf(call.input)` · 응답 `tool:${toolUseId}:work:response` + `revisionOf(call.result)`. 휠·키보드·초점은 컨테이너(`tabIndex=0`)가 갖는다 — 실행 중(요청만)·요청+응답 공존 두 상태 | "현행 250px 스크롤 안에 요청·응답이 모두 있고 요청은 결과 도착 전에도 표시됩니다. 384px 뷰를 그대로 중첩하거나 두 payload에 같은 결과 revision을 쓰면 스크롤과 문서 식별이 어긋납니다. 요청과 응답 ID를 분리하고 각각 `call.input`과 해당 결과에서 revision을 얻으십시오" | PR #643 P4 | ACTIVE (사용자 거부 가능 — Work 는 D-004 의 384px 대신 기존 250px 을 쓴다) | D-004 의 Work 적용 형태 · 파생 단계 D-042 |
| D-037 | **카드·코드 보기의 창 동기 계산 상한.** 하네스 = 원천·ID·revision · 워커 = 큰 변환·색인 · 공통 뷰 = 가시 DOM. 창 동기 파생(Read 거터 제거 · 줄 시작 색인 · 폭 · patch 파싱 · 구조화 패치 줄 변환)은 원천 문자 ≤ `BODY_SYNC_MAX_CHARS = 1,000,000`(기존 `PATCH_INLINE_MAX_CHARS` 와 같은 값)이고 diff 원천은 D-027 상한 안일 때만, 원천 객체마다 1회(메모)다. 넘으면 원천 문서를 계산 레인에 보내고 워커가 파생을 만든다(`codeView` · `diffView`). 객체 payload 의 JSON 문자열화는 창에서 원천 객체당 1회다. 접힌 카드(본문 미마운트)와 닫힌 OpenCode 파일(`<details>`)은 본문 파생·임차·요청 0 | "기존 DiffLine, DiffHunk, countLinesUpTo, withinDiffCap과 카드 머리글의 계산 예산을 재사용하십시오. 400줄은 DOM 가상화 기준이고 동기 계산 허용 여부에는 문자 상한도 적용해야 합니다 … 하네스는 원천·ID·revision, worker는 큰 변환·색인, 공통 뷰는 가시 DOM을 소유합니다. 접힌 카드는 본문 모델 생성·임차·토큰 요청 0회를 확인하십시오" · Read 거터 50,000줄 9.15ms·렌더마다 · Work payload 5MB 21~22ms·렌더마다 · 구조화 패치 50,000줄 6.89ms · 5MiB 줄 색인 3.56·폭 9.92ms(M20) · 객체는 구조화 복제가 문자열화보다 비싸다(5MB 52.25 vs 21.53ms) | PR #643 P3 | **SUPERSEDED** | D-018 대체 → D-047 — 400줄 이하 Read 거터 제거에도 문자 상한을 걸어 AC19(현행 `CodeBlock`)와 EP-21 ① 이 갈렸다(PR #643 후속 P19 · 사용자 결정 질의 7) · Work 단계는 D-042 |
| D-038 | **스크롤 보정 소유 — 한 요소의 보정은 한 곳.** transcript 스크롤 요소 = `TranscriptViewport`(0326) · 도구 카드 본문 = 그 카드의 384px 요소(TanStack 기본 크기 보정) · Work = 250px 컨테이너 · Git 패널 = `DiffReview` 스크롤 소유자의 보정 조정기(위쪽 문맥 펼침 · 자리 높이 → 실제 높이 교체 · 가상 행 측정 변화를 프레임마다 합쳐 한 번 쓴다 — 파일 본문 가상 목록은 크기 보정 끔). 내부 목록은 transcript 스크롤 요소를 스크롤 요소로 받지 않는다. 핀(선택 끝·초안·이동 대상)이 근접 판정보다 우선이다 · 비연속 핀 사이는 여백 행이다 · 화면 밖 요구사항 이동 순서는 펼침 → 계산 요청 → 위치 → 숨은 줄 드러내기 → `scrollToIndex` → 다음 프레임 `revealDiffRequirement` | "대화 스크롤은 TranscriptViewport, 내부 스크롤은 해당 카드 또는 패널이 소유하고 같은 요소의 위치 보정은 한 곳에서만 수행하십시오. 내부 선택·초안이 유지되는 동안 외부 카드 블록도 고정하십시오. 파일이 근접 범위를 벗어나면 행을 0개로 하는 규칙과 핀 보존 간 우선순위, 비연속 핀 사이 높이, 미마운트 요구사항 이동 순서를 정하십시오" | PR #643 P10 | ACTIVE | — |
| D-039 | **transcript 펜스는 호출 경로별로 종결한다.** 완료 Markdown 펜스(`Markdown.tsx:122-134`) — 강조 키 = 본문 ≤ 32,000자(0324 D-012)·D-031 줄 상한 적용·줄 번호 없음 → 현행 + 실측(M5·M17) 종결 · 열린 펜스(`StreamingFence`) — 강조 생략(0108) 종결 · Read·Work·산출물 코드 ≤ 400줄 — `CodeBlock`(줄 번호 메모 AC21) · > 400줄 — 가상 코드 보기 · transcript 펜스의 400줄 초과 가상화는 후속(B4 — INDEX 후보) | "일반 transcript 펜스의 전체 본문 highlight 키와 줄 번호 memo는 남으므로, 호출 경로별로 기존 상한·실측으로 종결할 부분과 후속 항목을 표시하십시오" | PR #643 P3 | ACTIVE | — |
| D-040 | **복사 처리 계약 — 한 번만 처리한다.** 두 끝을 모두 가진 가장 안쪽 가상 목록이 `claimCopy(event)` 로 가져가고 `TranscriptViewport.handleCopy`·`DiffReview` 는 가져간 이벤트를 건너뛴다. 카드·파일 경계를 넘으면 바깥(transcript = `TranscriptViewport` · Git = `DiffReview`)이 한 번 처리한다 — 복사 단위 = 블록(파일) 또는 (블록, 행 조각), 행 조각 ≤ `VIRTUAL_COPY_CHUNK_ROWS` 를 직렬화 호스트에 마운트(`CopySerializationHost` 가 미마운트 내부 행을 복원). 동기(행이 창에 있고 범위 ≤ 상한)/비동기(그 밖 — 0326 D-094 task 마다 ≤ 50ms). 가상 목록 끝점 = (목록 키, 행, 칸, 오프셋) · part 문자 오프셋 = 앞 행 본문 길이 합 + 오프셋(미마운트 여백은 `data-virtual-skip-chars`) · 줄 번호·거터·± 표지는 `data-transcript-chrome`. 카드 복사 버튼은 `copyText(call)` 그대로 | "두 끝이 같은 내부 목록이면 내부 목록이 한 번 처리하고, 카드 경계를 넘으면 외부 뷰포트가 한 번 처리하도록 계약을 정하십시오. 외부 CopySerializationHost가 미마운트 내부 행까지 복원할 수 있어야 합니다. 내부 행 좌표와 기존 part 문자 오프셋을 연결하고 줄 번호·거터에 data-transcript-chrome 규칙을 적용하십시오" · `handleCopy` 는 자식 처리 여부를 보지 않는다(`TranscriptViewport.tsx:413-421`) · `DiffTable` 거터는 `select-none` 이지만 chrome 표지가 없다(`DiffTable.tsx:69-80`) | PR #643 P9 | ACTIVE | D-029 의 구현 계약 · 블록 안 여러 목록 D-049 |
| D-041 | **측정 rev 2.** AC30 에 0325 단계 C 사용자 시나리오 S-C0(5만 줄 Git diff 를 펼친 채 답변 스트리밍 + 한글 조합 입력 + 휠 동시)을 0326 기준 빌드와 0327 빌드에서 같은 입력으로 둔다. 지표는 첫 가시 행 paint · 입력→paint · 휠→paint · 가시 워커 요청 대기 · 전송량(문서·결과 문자) · DOM 반영량(마운트 행·commit)으로 가른다. 카드 입력은 진단 다리(`window.__ooDev` — 0326 `transcriptFixtures.ts`)에 더할 0327 fixture(Claude Code Write·Edit·MultiEdit·Read · Claude Work 요청·응답 · OpenCode 파일)로 고정한다. 설치본(`perf.stall`)과 진단 빌드(trace·Profiler·계측)는 표를 나누고, 누락 표본은 같은 빌드로 최대 2회 다시 재고 시도 수를 적는다(그래도 없으면 `N/A(누락: 사유)`) | "5만 줄 Git diff를 펼친 상태에서 답변 스트리밍·한글 조합 입력·휠 스크롤을 겹치는 경우를 0326 기준 빌드와 0327 빌드에서 같은 입력으로 비교하십시오 … '큰 Write/Edit가 있으면'은 재현 가능한 fixture로 바꾸십시오. 설치본·진단 빌드별 관측 방법과 누락 표본 재측정 규칙을 기존 측정 도구에 추가하십시오" | PR #643 P12 | ACTIVE | D-025 보완 · 복사 상한 재조정 D-050 |
| D-042 | **Work 본문 파생 — 단계별 횟수와 소유(D-047 ④).** 원천 = 요청 `call.input` · 응답 `call.result`(Task 도구가 렌더마다 만드는 합성 응답 `{ structuredOutput, output }` 도 `call.result` 를 키로 쓴다). ① text 배열 잇기(`textContent`) — 창 1회 ② 객체 문자열화(`JSON.stringify(…, 2)`) — 창 1회 · 크기 상한 없음(B16) ③ 문자열 언어 판정(`JSON.parse`) — ≤ 1,000,000자 창 1회 · 초과 0(B21) · 객체를 문자열화한 결과는 판정 0(언어 = json) ④ 줄 시작 색인·폭 — 400줄 초과 · ≤ 1,000,000자 창 1회 · 초과 0(워커 `codeView`) ⑤ 상태·검색 결과(`workToolPresentation(call).status` · `workSearchResults(call)`) — 창 1회(B23). 같은 원천을 다시 렌더하면 모든 단계 0 | "객체 직렬화와 문자열이 된 뒤의 언어 판정·색인·표시 변환을 각각 계수하십시오. 객체 예외를 채택한다면 큰 객체 최초 펼침에서 직렬화 1회, 동일 원천 재렌더에서 추가 0회, 이후 큰 문자열의 renderer 파생 0회를 별도로 단언하십시오" · 단계 실측 M24(객체 5MB 문자열화 16.40ms · 문자열 5MB 판정 8.20ms · 줄 색인 5.13ms) · Task 합성 응답은 렌더마다 새 객체(F34) | PR #643 후속 P15 | ACTIVE | D-036 보완 · D-047 ④ 의 Work 단계 |
| D-043 | **계산 레인 대기는 토큰 양보 간격과 따로 다룬다.** `TOKENS_JOB_BUDGET_MS` 는 토큰 작업 한 번의 양보 기준이다 — 한 번 ≤ 50ms + 한 줄이고, 줄 시간 상한은 규칙 일치 사이에서만 검사하므로 한 줄이 상한을 넘을 수 있다(M17b 최대 112.1ms · F31). 계산 레인 대기(가시 요청 도착 → 그 작업 시작) = 실행 중 작업의 남은 시간 + 앞선 가시 작업. 분할 불가 작업(`highlight` · `codeView` · `diffView` 모델 생성·쌍 jsdiff · `diffLocate` · `diffContext`)은 끝까지 하고 선점·분할을 더하지 않는다(쌍 원천 취소 + 대기 요청의 워커 교체는 D-024 그대로). 클라이언트는 작업마다 `{ kind, lane, priority, yields, key, enqueuedAt, startedAt, endedAt }` 를 주입된 계측 싱크에 쓴다(진단 빌드만 연결 — 기본은 기록 0) — S-C9 가 점유·대기·첫 paint 를 따로 적는다 | "50ms는 현재 줄이 끝난 뒤 확인하는 양보 기준입니다. B20의 '50ms + 한 줄' 설명을 선행 작업이 큰 비분할 diff 모델·쌍 diff인 경우까지 적용할 수는 없습니다 … 토큰 작업의 양보 간격과 계산 레인 전체 대기시간을 구분하고, 큰 diff 계산 중 다른 가시 요청이 도착하는 사례에서 worker 점유·대기·첫 paint를 따로 기록하십시오" · 분할 불가 작업 실측 M23(전부 다른 5,000 + 5,000줄 jsdiff 2,909ms) · M5(강조 167.6ms) · M14(모델 17.93ms) | PR #643 후속 P16 | ACTIVE | D-031 보완 · B20 정정 |
| D-044 | **범위 요청 규칙.** 줄·행 창 요청(`tokens` · `codeView` · `diffView`)은 0 ≤ start ≤ end 인 정수 범위다 — 아니면 클라이언트가 즉시 `range-invalid`(워커 메시지 0), 길이 상한(`tokens` 200 · `codeView`·`diffView` 400)을 넘으면 즉시 `range-too-large`. 워커 결과 길이 = `max(0, min(end, 개수) − start)` — `start ≥ 개수` 면 빈 결과(`rows: []` · `lines: []` · 오류 아님)라 원천이 줄어든 뒤 늦게 온 창 요청도 실패 없이 끝나고 소비자가 키 대조로 버린다(D-030) | "AC3의 응답 길이는 시작점이 EOF 이후여도 음수가 되지 않게 빈 범위 또는 명시적 거부를 정의합니다" · 클라이언트는 문서 줄 수를 모른다(세면 창에서 O(n)) | PR #643 후속 P16 | ACTIVE | D-008 ③ 보완 |
| D-045 | **표 조각 예산과 결과 노드 예산(D-033 보완).** 표 조각 = 본문 행 ≤ `MARKDOWN_TABLE_CHUNK_ROWS`(200) 그리고 칸(머리 칸 + 조각 행 × 열 수) ≤ `MARKDOWN_TABLE_CHUNK_MAX_CELLS = 1,000` 그리고 조각 원문 ≤ `MARKDOWN_TABLE_CHUNK_MAX_CHARS = 50,000` — 행을 앞에서부터 담다가 다음 행이 셋 중 하나를 넘기면 새 조각(조각마다 행 ≥ 1). 원문 표시(최종 · 작업 0)에 더한다: 열 > 500(머리 + 한 행이 칸 예산을 넘는다) · 머리 + 한 행 > 50,000자. 결과 노드 예산: 워커가 블록·조각 hast 의 노드(root·요소·텍스트 전부)를 세어 > `MARKDOWN_HAST_MAX_NODES = 20,000` 이면 hast 대신 `{ tooLarge: true }` 를 낸다 — 그 블록(표는 표 전체 · 이미 그린 조각 포함)은 최종 원문이고 남은 조각 요청은 취소한다. 꼬리 결과도 같다 | "셀 하나가 매우 길거나 열이 매우 많은 표는 적은 행으로도 큰 파싱 결과를 만들고 renderer가 큰 DOM을 한 번에 반영할 수 있습니다 … 조각의 문자량 또는 출력 노드 예산을 넘을 때의 원문 표시·추가 분할 조건을 정하십시오. worker 파싱, HAST 전송, renderer 반영을 각각 확인해야 합니다" · 200행 × 50열 한 조각 2,540ms → 1,000칸 조각 최대 35.1ms(M22·M22c) · 큰 셀은 문자에 선형(602,237자 223ms — M22) · 노드 37,501~60,003 블록 반영 35.6~62.9ms · 20,000 노드 ≈ 20ms(M22c·M22d) | PR #643 후속 P17 | ACTIVE (사용자 거부 가능 — 원문 표시 범위) | D-033 보완 |
| D-046 | **diff 모델 캐시 체류와 위치 요청 키.** ① 모델 1회 = 동기 경로는 본문 인스턴스가 마운트된 동안(메모 — 접어 언마운트한 뒤 다시 펼치면 1회 더) · 워커 경로는 레인 모델 캐시(LRU `DIFF_MODEL_CACHE_ENTRIES` = 8)에 있는 동안. 다른 모델 8개가 더 쓰여 퇴거됐거나 워커가 교체된 뒤에는 그 원천의 다음 요청에서 1회 다시 만든다(문서 재전송은 교체 때만 — AC2). ② `diffLocate` 키 = `['diffLocate', sourceKey, 공백, 배치, expansionsKey, anchorsKey]` — `anchorsKey` = 요청 앵커를 요청 순서 그대로 `${oldLine ?? '-'}:${newLine ?? '-'}` 로 써서 `,` 로 이은 것(정렬·중복 제거 없음) · 결과 `lineIndex[i]`·`rowIndex[i]` 는 `anchors[i]` 에 대응 · 작업 크기 = 앵커 수 × 16 · 앵커 수는 그 파일 요구사항 수다(상한 없음 — F36) | "AC9의 revision당 모델 1회와 D-032의 최근 8개 보관은 아홉 번째 모델 후 재방문에서 기대가 달라집니다. 캐시 체류 중 1회·퇴거/worker 교체 후 재생성을 구분합니다. AC1의 키 길이 공식에는 EP-1의 가변 길이 `anchorsKey`가 빠져 있으므로 `diffLocate` 다중 앵커의 키·크기·순서 계약과 테스트를 맞춥니다" | PR #643 후속 P18 | ACTIVE | D-032·D-008 ③ 보완 |
| D-047 | **카드·코드 보기의 창 동기 계산 상한(rev 3 — D-037 대체).** 하네스 = 원천·ID·revision · 워커 = 큰 변환·색인 · 공통 뷰 = 가시 DOM. 창 동기 파생은 원천 객체마다 단계별 1회(메모)다. ① 400줄 이하 본문은 현행 `CodeBlock` 이 본문 전체를 창 DOM 에 그리므로 Read 거터 제거를 문자 수와 무관하게 창에서 1회 한다 ② 400줄 초과 본문(가상 코드 보기)의 줄 시작 색인·폭·Read 거터 제거는 원천 ≤ `BODY_SYNC_MAX_CHARS`(1,000,000)일 때만 창, 넘으면 워커(`codeView` · 보기 문서 — D-048) ③ diff 원천(OpenCode patch 파싱 · 구조화 패치 줄 변환 · 쌍)은 D-027 상한 ④ Work payload 단계는 D-042 ⑤ 접힌 카드(본문 미마운트)·닫힌 OpenCode 파일(`<details>`)은 본문 파생·임차·요청 0 | "앱 화면이 바로 지움 (Recommended)" — "펼치는 즉시 본문이 보입니다(지금과 같은 동작). 지우는 데 400만 자 기준 2.4ms라 눈에 띄지 않습니다. 대기 화면과 실패 화면이 없습니다" · 400줄 × 10,000자(4,003,199자) 거터 제거 2.44ms(M25) · 워커가 지워도 창이 400줄 전체 문자열을 받아 그려야 한다 · 그 밖의 근거는 D-037 칸 승계(카드 머리 예산·`countLinesUpTo`·`withinDiffCap` 재사용 · M20) | 턴 3 질의 7 · PR #643 P3 · 후속 P19 | ACTIVE | D-037 대체 |
| D-048 | **보기 문서(view) — 표시와 토큰이 같은 변환 원문을 쓴다.** 변환 원문은 `{ doc, transform }` 보기 문서다(키 `viewKey = ${docKey}\|${transform}` · transform 은 `stripGutter` 하나). 워커는 보기 문서를 처음 쓰는 작업에서 원천 문서에 transform 을 한 번 적용해 보관하고 원천 문서를 닫을 때 함께 버린다(D-032 파생). `codeView` 와 `tokens` 는 같은 보기 원천을 받는다 — Read 가상 코드 보기의 토큰 원천은 창 동기 경로에서도 보기 문서다. transform SSOT = `shared/compute/gutter.ts` `stripLineNumberGutter`(현행 `features/chat/lib/lang.ts:33-40` 본문을 옮기고 features 는 다시 내보냄) — 창 메모와 워커가 같은 함수를 부른다 | "§10-A에서 `codeView`는 `stripGutter`로 변환한 줄을 내지만 `tokens`의 입력은 원문 DocRef 또는 diff AxisRef입니다. 큰 Read의 표시·토큰화가 같은 변환 원문을 쓰도록 식별자나 transform을 연결합니다" · 워커 구역은 features 를 import 할 수 없다(F35) | PR #643 후속 P19 | ACTIVE | D-008 ③ 보완(토큰 원천 셋째) |
| D-049 | **블록 안 여러 가상 목록의 복사(D-040 보완).** ① 등록부는 블록 키마다 내부 목록 배열(목록 키 · 행 수 · 건너뛴 글자 함수 · 행 준비 여부 · 목록 루트 요소)을 갖고 순서는 복사 때 목록 루트의 `compareDocumentPosition`(DOM 순서)이다 — 도구 묶음 블록의 카드 여럿(F32) · Work 의 요청·응답 ② 복사 단위 = 블록 범위(내부 목록 없는 블록 — 0326 단위) \| 조각 `{ index, from, to }`(from·to = 블록 시작 · (목록 순번, 행) · 블록 끝) — 조각이 마운트하는 내부 행 합 ≤ `VIRTUAL_COPY_CHUNK_ROWS` · 조각 경계는 행 시작 · 목록 사이 일반 텍스트(머리글·상태 문구)는 그 자리를 덮는 조각의 DOM 범위에 든다 ③ 뷰포트에 마운트되지 않은 블록은 직렬화 호스트에 행 0(살핌)으로 먼저 마운트해 등록부를 채운 뒤 조각을 계획한다 ④ 워커 경로 목록의 조각 행과 행 수 미상 목록의 요약은 마운트 전에 워커 창(`diffView`·`codeView`)으로 받는다 — 준비 단계는 task 밖에서 기다리고 마운트·직렬화 task 만 50ms 예산이다 · 준비하는 동안 그 목록의 문서 임차는 복사 작업이 쥐고 작업 끝·취소 때 놓는다 ⑤ 미마운트 행 자리 `data-virtual-skip-chars` 값의 소유자 = 그 목록 모델의 소유자 — 창 동기 모델은 모델을 만들 때 한 번 센 행 본문 길이 누적합, 워커 모델은 창 결과의 `charsBefore`(창 첫 행 앞 글자 합)와 요약 `textChars` | "AC33은 한 Work 카드 안의 요청·응답 목록 두 개를 허용하나 §10-A의 `copyUnits` 조회는 블록당 목록 하나 또는 null만 반환합니다. 한 블록의 여러 목록과 사이 일반 텍스트의 순서를 표현하고 요청→응답, 응답→바깥 문단을 양방향으로 복사해 비교합니다. 비동기 행 창에서 생략된 문자 수를 구할 주체도 지정합니다" · 0326 조각 작업 훅은 동기뿐(F33) | PR #643 후속 P20 | ACTIVE | D-040 보완 |
| D-050 | **복사 상한 재조정 절차(0326 D-088 승계).** `VIRTUAL_COPY_SYNC_MAX_ROWS` = `VIRTUAL_COPY_CHUNK_ROWS` = K12 탐색값 — 행 100~2,000 을 100 간격(20 크기)으로 목록 종류(Git 인라인·나란히 · `DiffTable` · `VirtualCodeView`)마다 마운트 + 직렬화 시간을 재고, 모든 종류에서 중앙값 ≤ 50ms 인 최대 크기. 100 도 넘으면 `통과 표본 없음` 이고 AC15·AC35 는 닫히지 않는다(재구현 — 행 렌더·직렬화 비용을 줄인다). S-C8 은 산출 상한 · 상한 + 1 · 500 을 Chromium 에서 다시 재고, 상한 크기 조각 task 가 50ms 를 넘으면 S-C8 이 잰 통과 최대로(통과가 없으면 절반으로) 상수를 낮춘 뒤 S-C8 을 다시 돌려 통과해야 AC30 이 닫힌다 — 상수 하향이나 W 인계만으로 닫지 않는다. 100 아래로 내려야 하면 AC30 미완료(재구현) | "K12에 통과 표본이 없거나 S-C8 실기에서 조각이 50ms를 넘을 때는 0326 D-088의 재조정·재시험 절차를 명시합니다" · 0326 D-088 "100 도 넘으면 `통과 표본 없음` 이고 AC26 은 닫히지 않는다 … 상수 하향이나 W 인계만으로 닫지 않는다" | PR #643 후속 P20 | ACTIVE | D-041 보완 |
| D-051 | **Git 파일의 계산 수명과 DOM 수명(D-028 보완).** 계산(동기 모델 메모 · 문서 임차 · 워커 모델 요청)은 처음 근처·선택·이동 때 열려 접기·새 patch 세대까지 남는다(D-028). 행 DOM 은 근처(스크롤 소유자 위·아래 한 화면)인 동안만 있다 — 400행 이하는 전부 · 초과는 가시 + overscan. 근처가 아니면 핀 행(선택 끝·초안·이동 대상)과 여백뿐이다. 근처를 벗어난 파일의 자리 높이는 마지막 측정 높이(측정 전이면 D-028 추정 높이)라 벗어날 때 스크롤 높이가 바뀌지 않는다 | "D-028은 최초 수요 후 접기까지 모델을 유지하고 AC10은 400행 이하를 '계산이 열렸을 때 전부'로 적은 반면 AC14는 근접 밖이면 핀만 마운트합니다. 모델을 보유하는 기간과 DOM을 유지하는 기간을 분리합니다. 200파일을 차례로 지난 뒤에도 화면 밖 파일은 핀 이외 DOM 0인지 검사합니다" | PR #643 후속 P21 | ACTIVE | D-028 보완 |

### 갱신 메모

- V1(턴 1)에서 추가된 결정: D-001~D-026. 사용자 결정은 D-001·D-002·D-004·D-005·D-006(질의 5건), D-003 은 질의 2·5 의 선택지 문장이다.
- **V1 rev 2(턴 2)에서 추가된 결정**: D-027~D-041. 사용자 결정은 D-029(질의 6 — B7)와 D-027(PR #643 소유자 "합의안" 문장)이고 나머지는 PR #643 지적을 코드·실측으로 검증한 설계 결정이다(§4-A).
- **변경된 결정**: D-011 → D-027 · D-013 → D-028 · D-018 → D-037 · D-020 → D-033 · D-022 → D-029·D-040(전부 SUPERSEDED · 대체 이유는 각 행). V1 의 `TOKENS_JOB_MAX_LINES = 600` 은 D-031 로 대체되고 V1 경계 B5·B6·B7 은 삭제됐다(§10).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0324 D-007·D-008·D-009·D-012 · 0325 D-008·D-011·D-037·D-038 · 0326 D-087·D-094(D-007 로 승계) · 0325 D-021(이 plan 이 C 행을 닫는다) · 0325 D-023·D-025 OPEN(E·W — 0327 이 기대지 않는다).
- **V1 rev 3(턴 3)에서 추가된 결정**: D-042~D-051. 사용자 결정은 D-047(질의 7 — 400줄 이하 Read 의 거터 제거는 창이 바로 한다)이고 나머지는 PR #643 후속 코멘트 2건(7행)을 코드·실측으로 검증한 설계 결정이다(§4-B).
- **rev 3 에서 변경된 결정**: D-037 → D-047(SUPERSEDED). 보완(대체 아님): D-008 ③(D-044·D-046·D-048) · D-028(D-051) · D-031(D-043) · D-032(D-046) · D-033(D-045) · D-036(D-042) · D-040(D-049) · D-041(D-050). 경계 B2·B14·B15·B16·B20 은 측정으로 정정했고 B23·B24 를 더했다(§10).
- **`ACTIVE 결정 ↔ AC` 대조**(rev 3 본문 기준): 충돌 0 — 대조 근거는 §16 끝 "교차검증 관측"에 문장 단위로 적었다(rev 3 이 고친 AC1·AC3·AC4·AC9·AC10·AC14·AC15·AC19·AC22·AC24·AC29~AC32·AC35 와 새 AC36 포함).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 + 원인 넷 추가 | T22 의 "전체 행 DOM" 은 원인이 맞다(M2 — 5만 행 SSR 9.2s). 추가: 짝 찾기 O(n²)(M1 3.8s) · diff 구문 토큰 크기 상한 없음(M4 26s) · 줄 수 상한으로 묶이지 않는 거대 한 줄(M17 — minified JS 5,000자 한 줄 ≈ 1s) · 행 수에 초선형인 표 파싱(M18c — 1,600행 1.1~1.8s) |
| 이미 기존 코드가 충족하는가 | 부분 | 카드 머리 증감 예산(0325 D-037)·diff 문자 우선(0325 D-008)·캐시 비용(0325 D-038)은 충족 — 재사용한다(VP-41 회귀 · D-037). T23 은 상한 200파일로 충분(M10 — D-017) |
| 더 작은 해법이 있는가 | 항목별 판정 — V1 판정 하나 뒤집음 | V1 "Git 행 모델은 창에서 O(n) 1회"(D-011)는 짝·폭·요구사항 색인과 모두 펼치기를 넣으면 50ms 를 넘는다(M16 4 × 5만 줄 76.2ms) → 큰 원천은 워커, 작은 원천만 창(D-027 · M21). T33 은 코드 변경 없이 종결(D-016) |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 정정 6 | V1 의 둘(감사 44.3ms · T14 원문 경로) + rev 2: 0325 §6-D T22 W 열 "hunk·좌우 행·주석 위치 인덱스" 와 V1 D-011 이 어긋났다(PR #643 P1 — 0325 plan §6-D 표에서 확인) · rev 3: B2 의 블록 파싱 상한은 산문 표본뿐이었다(촘촘한 50,000자 블록 841~1,387ms — M22c) · B15 "남은 부분은 색이 없다"는 틀렸다(멈춘 줄은 마지막 토큰을 줄 끝까지 늘린다 — F31) · B20 "50ms + 한 줄"은 분할 불가 작업에 맞지 않는다(M23) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 4 — 모두 이 plan 의 설계 범위 | ① 0324 `client.ts:9-10` 실행 중 취소의 워커 교체를 jsdiff 작업으로 좁힌다(D-024) ② 0324 의 창마다 워커 1개(`client.ts:263-272`)에 Markdown 레인을 더한다(D-034 — 사용자 거부 가능) ③ 0326 `TranscriptViewport.handleCopy` 의 처리 범위를 "가져가지 않은 이벤트" 로 좁힌다(D-040) ④ 0326 조각 작업(`startCopyJob`)에 마운트 전 준비 단계를 더하고 단위를 블록 안 조각까지 넓힌다(D-049 — 블록 범위 호출은 그대로). 0326 EP-10 "features/chat 안 `useVirtualizer(` 1" 은 새 훅을 `shared/ui/virtual/` 에 두어 유지한다(§8 F2) |

- 사용자에게 올린 결정: V1 5건(D-001·D-002·D-004·D-005·D-006) + rev 2 1건(D-029 — 질의 6) + rev 3 1건(D-047 — 질의 7). 남은 OPEN 없음.
- 코드 조사로 닫은 사실: §8 M1~M25 · F1~F36 · S1~S17.

### 4-A. PR #643 검토 항목별 판정 (rev 2 입력)

외부 검토는 verify 가 아니라 입력이다(`docs/handoff/AGENTS.md §외부 리뷰는 verify를 대체하지 않는다`). 14 항목을 코드·실측으로 검증했고 기각은 0 이다.

| # | 지적(요약) | 판정 | 검증 관측 | 반영 |
|---|---|---|---|---|
| P1 | T22·D-011 — 같은 revision 모델에 실행 소유자 하나. 큰 patch 모델·짝·폭·축·위치 색인은 워커, 작은 입력은 상한·실측 있는 동기 경로. 근거는 같은 입력의 첫 가시 행·UI 점유·전송량 | 수용 | 0325 §6-D T22 W 열 확인 · M3 42.6ms 는 줄 객체 전체 복제(창이 받는 것은 200행 창 0.09ms — M15) · V1 B5 22.74ms 에 짝·폭·색인·모두 펼치기 없음 → 5만 줄 파이프라인 17.9ms(M14)·4 × 5만 76.2ms(M16) · 같은 입력 비교 M21 | D-027 · AC8·AC9·AC13·AC17 · EP-7·EP-18 |
| P2 | 모두 펼치기 — 자리 높이 · 근접·선택·명시적 이동 때 계산 · 첫 paint 전 모델 수·축 문자·임차·전송 계수 · 양쪽 축 + 먼 핀 요청 수 | 수용 | V1 `FileDiffBody` 는 펼친 파일마다 마운트 즉시 `useMemo` 모델·축 문서 임차(V1 §11) · 200 × 300 모델 18.4ms·축 문자 1,442,800 / 근처 2파일 0.12ms(M16) | D-028 · AC10·AC17 · EP-19 |
| P3 | 카드·코드 뷰 — 기존 `DiffLine`·`countLinesUpTo`·`withinDiffCap`·머리 예산 재사용 · 문자 상한 · 거터 제거·payload 문자열화·patch 파싱·줄 색인·폭 경로 · 접힌 카드 0 · transcript 펜스 경로별 종결 | 수용 | `FileBody.tsx:20` 거터 제거 렌더마다(50,000줄 9.15ms) · `workToolPresentation.ts:162-175` payload 렌더마다(5MB 21~22ms) · 구조화 패치 상한 없음(50,000줄 6.89ms) · 닫힌 OpenCode 파일도 본문을 렌더(`ToolBody.tsx:88-143` — `<details>` 안) · M20 | D-037·D-039 · AC19·AC22·AC32 · EP-21 |
| P4 | Claude Work — 250px 스크롤 안 요청·응답, 결과 전 요청 표시. 384px 중첩·같은 revision 금지 · 요청/응답 ID·revision 분리 · 휠·키보드·초점 소유 | 수용 | `WorkToolBody.tsx:44-51` 250px `overflow-auto` 컨테이너 · `:52-57` 요청 · `:105-110` 결과 전 `running` | D-036 · AC19·AC33 · EP-5·EP-11·EP-22 |
| P5 | AC3 입력이 200줄 상한과 어긋남 · 201줄 이상 요청 규칙 | 수용(plan 내부 불일치) | V1 AC3 `[190,410)`·`[580,800)` = 220줄 vs `TOKENS_RANGE_MAX_LINES = 200` | AC3 · EP-4 ⑦ |
| P6 | AC4~7·D-024 — 대기열 순서 충돌 · 양보 직후 순서 · 승격·해제 · 취소 즉시 권한 해제 · 양보 지점 중단 · 키 전부 확인 · 해제 직후·교체 전 응답 · 용량 회복 재시도 · 파생물 보유 | 수용(plan 내부 불일치 포함) | V1 AC4 "같은 등급 맨 뒤" ↔ V1 EP-4 ③ "같은 등급·크기 위치" · 현행 대기열은 크기 순 하나(`client.ts:203-208`) · 체크포인트 50개 466KiB(M17d) | D-030·D-032·D-010 · AC2·AC4~AC7 · EP-2·EP-4·EP-23 |
| P7 | 한 작업·한 응답 비용 — 거대 한 줄 · 거대 표·각주 문서 · 큰 hast 의 창 반영 · 분할·원문·별도 실행 조건 | 수용 | M17b: 32,000자 minified JS 한 줄 강조 1,009ms · M18: 표 200K 6.7s·1M 106s · 각주 1.16M 2.9s·hast 14.6MB·복제 315ms·창 185ms · M18c: 표 200행씩이면 선형·결과 동일 | D-031·D-033·D-034 · AC31 · EP-3·EP-12·EP-17 |
| P8 | B9 — 스캐너는 기존 판정 · 긴 비펜스 꼬리만 워커 · 합치기 · 재전송량·보유 revision·취소 결과 캐시·최종 서식 · 정적 분할기 재사용 · M13 1건 최소 재현 · fixture | 수용 | M13b 최소 재현 셋(블록 끝 개행 · HTML 블록 1~5 · 인접 HTML) → 717/717 · M19 합치기 효과 | D-033·D-035 · AC24·AC26 · EP-12·EP-13 |
| P9 | 선택·복사 — `handleCopy` 가 자식 처리 여부를 안 봄 · 내부/외부 한 번 처리 · 호스트가 미마운트 내부 행 복원 · 행 좌표 ↔ part 오프셋 · 거터 chrome · 카드 복사 `copyText(call)` · 400/401·정역방향·카드 경계·동기/비동기 대조 · B7 결정 | 수용 · B7 은 사용자 결정 | `TranscriptViewport.tsx:413-421` · `DiffTable.tsx:69-80` 거터에 chrome 표지 없음 · `textOffset.ts:8-43` chrome 만 건너뜀 · 질의 6 "현행과 동일" | D-029·D-040 · AC15·AC35 · EP-10·EP-20 |
| P10 | 스크롤·핀 — 보정은 한 곳 · 내부 선택·초안 동안 외부 블록 고정 · 근접 0 vs 핀 · 비연속 핀 높이 · 미마운트 이동 순서 · 줄바꿈·초안 높이·위쪽 펼침 결합 | 수용 | Git 패널은 위쪽 펼침 보정(`FileDiffSection.tsx:305-328`)이 스크롤 소유자에 직접 쓰고, V1 은 같은 요소에 TanStack 크기 보정을 켰다(V1 §11 `useVirtualRows`) | D-038 · AC12~AC14·AC34 · EP-8·EP-9·EP-24 |
| P11 | §8 F1·§18 파일 분류 — 직접 수정 · 재사용 · 통합 검증 · 계약 변경 파일 | 수용 | V1 F1 이 `ToolCard`·`markdownBlocks` 를 "고친다" 로 적었으나 V1 §11 은 둘을 재사용만 한다 | §8 F1 표 · §18 |
| P12 | AC29·30 — S-C0 겹친 시나리오 · 지표 분리 · 하네스별 카드 fixture · 관측 방법 · 누락 재측정 | 수용 | 0326 진단 다리(`transcriptFixtures.ts` — `loadFixture`·`setVirtualization`·`readClipboard`)가 카드 fixture 의 자리 | D-041 · AC29·AC30 · §19 |
| P13 | READY 조건 · Windows 수치는 구현·기계 verify 뒤 · 착수 = 0326 기계 PASS · T23 현행 · 이전 턴 역순 로딩은 단계 E · 완료 블록 재분할은 0326 B11 | 확인 — 차이 없음 | D-003 · D-017 · D-026 · §6 비범위 | — |
| P14 | 범위 — 0326 은 화면 밖 대화 블록, 0327 은 펼친 블록 내부의 계산과 DOM | 확인 — 차이 없음 | §1 | — |

### 4-B. PR #643 후속 검토 항목별 판정 (rev 3 입력)

외부 검토는 verify 가 아니라 입력이다. 소유자 후속 코멘트 2건 — "0327 rev 2 후속 정리"(§2 세 항목)와 "rev 2 검토 범위와 다음 재검토 기준"(7행, 앞 세 항목 포함) — 을 7행으로 묶어 코드·실측으로 검증했고 기각은 0 이다. 같은 코멘트가 채택한 rev 2 방향(큰 diff 워커 소유 · 근접 계산 · Work 250px 단일 스크롤 · Markdown 레인 · Chromium 복사 기준 · S-C0)은 바꾸지 않았다.

| # | 리뷰 행(주제 · 소유자) | 판정 | 검증 관측 | 반영 — 결정 · AC · 검증 사례 |
|---|---|---|---|---|
| P15 | Work 파생 · Work 본문/계산 worker — D-037·B16 객체 직렬화 예외 ↔ AC32 상한 초과 파생 0 · 최초 직렬화·재렌더·이후 문자열 변환 별도 계수 | 수용(plan 내부 불일치) | AC32 "원천 > `BODY_SYNC_MAX_CHARS` 면 창 파생 호출 0" ↔ D-037 "객체 payload 의 JSON 문자열화는 창에서 원천 객체당 1회" — 객체는 문자열화 전에는 길이를 모른다 · 단계 실측 M24 · Task 합성 응답은 렌더마다 새 객체(F34) | D-042 · AC32 · EP-21 ② · cs2a(5MB 객체 — 최초 문자열화 1 · 판정 0 · 창 색인 0 · `codeView` 1 / 재렌더 10 → 증가 0) · cs2b(5MB 문자열) · cs2c(Task 합성 응답) · cs2d(text 배열) |
| P16 | worker 지연과 범위 · compute client/worker — 토큰 양보 간격 ≠ 레인 대기 · 큰 비분할 diff 의 점유·대기·첫 paint · 시간 제한 줄의 원문 보존 vs 정상 줄의 색 동등성 · AC3 EOF 이후 시작 | 수용(현재 결함 — B15·B20 서술 · plan 내부 불일치 — AC3 길이 식) | 분할 불가 작업 M23·M5·M14 — 전부 다른 5,000 + 5,000줄 jsdiff 2,909ms · shiki 는 규칙 일치 사이에서만 시간을 보고 멈춘 줄의 마지막 토큰을 줄 끝까지 늘리며 멈춘 지점의 문법 상태로 다음 줄을 잇는다(F31) — 내용은 보존, 색은 장비·실행마다 다르다 · AC3 `min(end, 줄 수) − start` 는 start > 줄 수면 음수 | D-043·D-044 · AC3·AC4·AC36 · EP-3 ⑥ · EP-4 ①⑦⑧ · B15·B20 정정 · t7·t8·q8b·q11·q12·q13·wt6·fx2 · K13 · S-C9 |
| P17 | Markdown 표 · 파서/renderer — 행 수와 별도로 큰 셀·많은 열의 입력 문자·결과 노드 예산 · 분할/원문 전환 · 워커 전송 · 한 번의 DOM 반영 | 수용(현재 결함 — 열이 많은 표는 200행 조각 안에서 초선형) | 200행 × 50열 한 조각 2,540ms · 200 × 200 39,273ms(M22) · 1,000칸 조각 최대 35.1ms(M22c) · 큰 셀은 문자에 선형(M22) · 50,000자 비표 블록도 촘촘하면 노드 37,501~60,003 · 반영 35.6~62.9ms · 파싱 841~1,387ms(M22c·M22d) | D-045 · AC24·AC31 ③④ · EP-12 ②③⑬ · EP-13 ⑥ · B2·B14 정정 · mb11·mw6·m7·f3b · K10 |
| P18 | 캐시와 키 · compute client/모델 worker — AC9 revision당 1회 ↔ D-032 최근 8개 · 체류 중 1회 · 퇴거/교체 뒤 재생성 · AC1 키 길이 공식 ↔ EP-1 `anchorsKey` · `diffLocate` 키·크기·순서 | 수용(plan 내부 불일치) | AC9 "워커가 한 번(레인 모델 캐시)" ↔ D-032 "레인마다 최근 8개" · AC1 "id 길이 합 + 펼침 범위 문자열 + 96 이하" ↔ EP-1 ⑤ `anchorsKey` · EP-4 ① 크기 식에 `diffLocate`·`diffContext` 없음 · 요구사항 개수 상한 없음(F36) | D-046 · AC1·AC9 · EP-1 ⑤ · EP-4 ① · EP-23 ③ · pk6·lc2·h12 |
| P19 | Read 표시와 강조 · FileBody/codeView/tokens — `codeView` stripGutter ↔ `tokens` 원문 DocRef · 같은 변환 원문 · 400줄 이하 + 100만 자 초과의 AC19 ↔ EP-21 · 거터 입력으로 표시·색·복사 대조 | 수용 · 400줄 이하 경로는 사용자 결정(질의 7) | §10-A `tokens` 원천 = `doc` \| `axis`(transform 없음) · EP-21 ① "넘으면 `VirtualCodeView transform`" ↔ AC19 "400 이하는 현행 `CodeBlock`" · 거터 제거 SSOT 가 features 라 워커가 import 못 함(F35) · M25 400줄 × 10,000자 2.44ms · 카드 복사는 거터 포함 원문(F35) | D-047·D-048 · AC19·AC22·AC32 · EP-21 ① · EP-25 · VP-51 · rd1~rd3·h13·cs3b |
| P20 | 중첩 목록 복사 · TranscriptViewport/Work 본문/직렬화 호스트 — 한 블록의 여러 목록·사이 텍스트 순서 · 요청→응답·응답→바깥 문단 양방향 · 비동기 행 창의 생략 문자 수 주체 · K12 무통과·S-C8 50ms 초과 시 0326 D-088 절차 | 수용(plan 내부 불일치 + 경로 누락) | `copyUnits(…, lists: (index) => { listKey, rowCount } \| null, …)` = 블록당 목록 1 ↔ AC33 목록 2 · 한 블록이 도구 카드 여럿을 담는다(F32) · 0326 조각 작업 훅은 동기뿐이라 워커 경로 행을 기다릴 단계가 없다(F33) · K12 "통과 표본 없음이면 그 사실을 적는다" ↔ 0326 D-088 "AC26 은 닫히지 않는다" | D-049·D-050 · AC15·AC29·AC30·AC35 · EP-10 ② · EP-20 ③④⑤⑨⑩ · cu5·cu6·tc6·tc7·tc8·v8w · K12 · S-C8 |
| P21 | Git 장시간 스크롤 · Git renderer — 모델 보유 기간 ≠ DOM 유지 기간 · 200파일을 지난 뒤 화면 밖 파일은 핀 외 DOM 0 | 수용(plan 내부 불일치) | AC10 "400행 이하: 전부(계산이 열렸을 때)" ↔ EP-8 ② "`count <= fullUpTo` → 전부(근처일 때)" ↔ AC14 "근접 밖 파일도 핀 행은 마운트하고 나머지 행은 0" | D-051 · AC10·AC14 · EP-19 ④⑥ · ea3 |

- 범위 밖 관찰(별도 기록 — 이번 범위를 넓히지 않는다): ① Work 카드 머리 `WorkToolTimeline.tsx:20` 이 렌더마다 `workToolPresentation(call)` 을 부른다(상태 파생 — 도구 이름 둘에서 결과 `JSON.parse`) — 본문 밖 기존 동작 ② 전부 다른 큰 쌍 diff 는 jsdiff `timeout`·`maxEditLength`(F29)로 묶을 수 있으나 결과가 원문 폴백으로 바뀐다 — 제품 결정이라 후보로만 둔다 ③ Markdown 레인에서 촘촘한 블록 파싱(≤ 1,387ms — M22c) 동안 스트리밍 꼬리가 기다린다(B2) — 레인 안 선점은 다루지 않는다.
- 다음 차수 판정 기준(소유자 코멘트): 각 행의 반영 칸을 닫고, 이 목록의 반영 여부와 rev 3 이 고친 계약에서 직접 생긴 회귀만 본다.

## 5. 동작 / 사용자 흐름

```text
[Git 패널: 파일 헤더 클릭(펼침) / 모두 펼치기]
  → 펼친 파일: 추정 높이 자리만 (계산·임차 0)                                  (D-028)
  → 근접(위·아래 한 화면) · 그 파일 요구사항 선택 · 트리 이동 → 계산 시작
      작은 원천(줄 ≤ 5,000 · 문자 ≤ 200,000): 창 동기 모델(shared/compute/diffView) (D-027)
      큰 원천: 원천 문서 1회 전송 → 워커 모델(revision·공백 옵션마다 1회) → diffView 창
  → 근처인 동안 가시 행 + overscan + 핀(선택 끝·초안·이동 대상) 마운트 — 400행 이하 파일은 전부
  → 근처를 벗어나면 핀 행만 · 계산(모델·임차)은 남고 자리 높이 = 마지막 측정 높이       (D-051)
  → tokens: 마운트 행의 축 범위(200줄 창) — 동기 경로 = 창이 보낸 축 문서 · 워커 경로 = 워커 파생 축
  → 원문 행이 먼저, 토큰이 오면 그 창의 행만 색으로
  ↘ 모델 대기: 자리 안 계산 중 표시(기존 `DiffLinesStatus`) · 모델 실패: 기존 `diffLoadFailed` 문구(새로 고침이 새 세대로 다시 시도)
[스크롤·문맥 펼침·요구사항 선택·초안 입력]
  → 위쪽 펼침·자리 → 실제 높이·행 측정 변화는 보정 조정기가 한 프레임에 한 번 보정 (D-038)
  → 화면 밖 요구사항: 펼침 → 계산 → 위치 → 숨은 줄 드러내기 → scrollToIndex → 카드 위치 맞춤
  → 초안 행·선택 끝 행은 핀 — 근접 밖이어도 마운트

[도구 카드 펼침 — Write·Edit·MultiEdit diff · Read · Work 요청·응답 · OpenCode 파일]
  → 접힌 카드·닫힌 OpenCode 파일: 본문 파생·임차·요청 0                         (D-047 ⑤)
  → 400줄 이하: 지금과 같은 DOM — Read 거터 제거는 문자 수와 무관하게 창 1회            (D-047)
  → 400줄 초과: 384px 내부 스크롤 + 가시 행 — Work 는 기존 250px 컨테이너 하나가 스크롤 (D-036)
  → 400줄 초과 · 원천 ≤ 문자 상한: 창 동기 파생 1회 · 넘으면 워커(codeView · diffView)
  → Read 토큰은 보기 문서(원문 + stripGutter) · Work 파생은 단계마다 원천당 1회      (D-048 · D-042)
  → 카드 복사 버튼: 전체 원문(현행)

[산출물 보기]
  → 코드 모드·텍스트: 400줄 초과면 가상 코드 보기(가시 줄 · 가시 줄 번호 · 범위 토큰)
  → Markdown 미리보기: 4,000자 초과면 블록(D-033) → 원문 블록 즉시 → Markdown 레인 파싱 → hast 로 교체
      표: 행 200 · 칸 1,000 · 문자 50,000 조각 파싱 → 한 표로 합침 · 상한 초과·결과 노드 > 20,000: 원문 그대로(최종) (D-045)
  → HTML·이미지: 현행

[스트리밍 답변의 Markdown 꼬리]
  → 확정 블록·열린 펜스 판정: 현행(advanceStableBlocks · openFenceTail)
  → 꼬리 ≤ 4,000자: 현행(창 동기) · 꼬리 > 50,000자: 원문
  → 그 사이: Markdown 레인(실행 1 + 대기 1 — 새 delta 는 대기를 최신으로 바꿈) · 마지막 결과 + 그 뒤 새 글자는 원문

[선택·복사 — 모든 가상 목록]
  → 두 끝이 한 목록 안: 그 목록이 가져간다 · 경계를 넘으면 바깥(TranscriptViewport · DiffReview)이 한 번
  → 범위가 작고 행이 창에 있으면 동기 마운트 + 기본 복사 · 그 밖은 조각을 직렬화 호스트에 마운트(task ≤ 50ms)
  → 블록 안 여러 목록은 DOM 순서 조각 · 뷰포트 밖 블록은 살핌 마운트 · 워커 경로 행은 창을 받은 뒤 (D-049)
  → 결과 = 전체 마운트 Chromium 기본 복사와 같다(D-029)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 펼친 Git 파일이 근접 밖 | 계산·임차·요청 0 · 추정 높이 자리 | 스크롤바 길이가 파일 수만큼 확보된다 |
| 근접 진입(큰 원천) | 원천 문서 전송 → 워커 모델 → 가시 행 창 | 자리 안에 계산 중 표시 → 행(원문) → 색 |
| 가상 본문 첫 마운트 | 가시 행 원문 마운트 → 범위 토큰 요청(visible) | 원문이 바로 보이고 색은 창 단위로 붙는다 |
| 문서 끝 범위 첫 요청(앞 체크포인트 없음) | 워커가 한 줄씩 체크포인트를 전진하고 50ms 마다 `continue` · 사이에 다른 요청 처리 | 끝 부분은 원문으로 있다가 앞부분 토큰화가 끝나면 색이 붙는다 — 다른 강조는 밀리지 않는다 |
| 빠른 스크롤 | 화면을 떠난 창의 대기 요청 취소 · 실행 중 분할 작업은 다음 양보 지점에서 중단 · overscan 으로 들어온 창은 background, 화면으로 들어오면 visible 승격 | 되돌아오면 캐시에서 바로 색 |
| 테마 전환 | 마운트 창만 새 테마로 다시 요청 · 새 테마 체크포인트는 처음부터 | 원문으로 바뀌었다가 새 색(현행과 같은 전환) |
| 위쪽 문맥 펼침 | 행 삽입(워커 경로면 새 창 응답 뒤) → 보정 조정기가 보던 행 위치 보정(현행 0211 D-090) | 읽던 줄이 제자리 |
| 화면 밖 요구사항 선택 | 계산 요청 → 위치 → 숨은 줄 드러내기 → 그 행으로 스크롤 → 카드 위치 맞춤 | 선택한 요구사항 카드가 보인다 |
| 선택이 마운트 밖까지 | 끝 행 핀 · 복사 때 범위 행 마운트(동기) 또는 조각 직렬화(비동기) | 복사 결과가 전체 마운트 때와 같다 |
| 근처를 벗어난 Git 파일 | 핀 외 행 언마운트 · 모델 메모·임차 유지 · 자리 높이 = 마지막 측정 높이(D-051) | 스크롤 높이가 그대로이고 다시 오면 행이 바로 그려진다(모델이 캐시에 있으면 재계산 0) |
| 계산 레인에서 분할 불가 작업 실행 중 가시 요청 도착 | 그 작업이 끝난 뒤 첫 작업 · 작업마다 대기·점유 기록(진단 — D-043) | 원문·대기 표시가 그 작업의 남은 시간만큼 길다(B20) |
| 문서 revision 변경(새 Git 세대·새 산출물 응답) | 이전 문서 임차 해제(실행 중 작업 뒤 close) · 새 문서로 다시 요청 · 늦게 온 이전 결과 버림 | 새 내용의 원문 → 색 |
| 열린 문서 상한 초과 → 다른 문서가 닫힘 | 대기 임차가 사용 가능으로 바뀌어 소비자가 다시 요청 | 원문으로 있다가 색·서식이 붙는다 |
| 워커 실패·교체 | 대기 요청 실패/재시도 규칙(현행) · 다음 요청 직전 문서 재전송 | 원문 유지(D-009) 또는 같은 색 |
| Markdown 블록 파싱 전 / 상한 초과 블록 | 원문 블록(줄바꿈 보존 · 흐린 글자) / 원문 블록(최종 · 일반 글자) | 첫 화면이 바로 보인다 / 큰 블록은 원문으로 남는다 |
| Markdown 결과 노드 > 20,000(`tooLarge`) | 그 블록(표는 표 전체)을 원문으로 교체 · 남은 조각 요청 취소(D-045) | 원문 블록(최종 · 일반 글자) |
| 창 요청이 문서 끝 뒤에서 시작(원천이 줄어든 뒤 늦은 요청) | 워커가 빈 결과 · 소비자가 키 대조로 버림(D-044) | 화면 변화 없음 |
| 스트리밍 꼬리 시작이 앞으로 이동(블록 확정) | 이전 꼬리 결과 버림 · 새 꼬리 원문 → 워커 결과 | 확정 블록은 위에 그대로, 꼬리는 원문 → 서식 |
| Work 실행 중 → 결과 도착 | 요청 문서는 그대로, 응답 문서만 새로 임차 | 요청 본문의 스크롤 위치·초점이 유지된다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 범위 토큰·블록 파싱 대기와 실패는 원문 표시다. 워커 경로 diff 모델 대기는 기존 `DiffLinesStatus`(`chat.toolMeta.diffLoading`), 실패는 Git 패널이면 기존 `chat.rightpanel.diffLoadFailed`, 카드면 기존 원문 폴백(`RawInput` · OpenCode `OutputPanel`)이다 — 새 문구 0. 빈 diff·빈 산출물·빈 파일 문구는 현행 키 그대로.
- cancel / retry / close / restart: 화면을 떠난 범위는 대기 요청 취소. 워커 실패는 레인마다 연속 3회 차단(`COMPUTE_FAILURE_LIMIT`). 워커가 다시 만들어지면 문서를 재전송한다.
- concurrency / multi-session: 워커는 창마다 레인 2개(계산 · Markdown). 여러 세션·패널의 요청이 레인별 대기열을 쓰고, 계산 레인의 한 작업은 약 50ms 에서 양보한다.
- keyboard / a11y / theme: 내부 스크롤 영역은 `tabIndex=0`·`aria-label`(OpenCode 파일 본문 현행 `ToolBody.tsx:119-122` 와 같은 꼴). Work 는 기존 컨테이너 하나. 키보드 스크롤은 브라우저 기본. 테마는 D-014·D-016.
- 외부환경/오프라인/폐쇄망: 새 네트워크 없음. 의존성은 이미 `node_modules` 에 있는 전이 의존성을 직접 선언할 뿐이다(D-005).

## 6. 범위 / 비범위

- **범위**: WU-1~WU-10(아래). 공개 IPC·DB·설정·저장 형식 변경 0. 직접 의존성 4개 선언(D-005). 계산 워커 진입점 1개 추가(Markdown 레인 — D-034).
- **비범위**: 단계 D·E·W 판정 · 완료된 큰 text 블록 파싱(D-026) · 4,000자 이하 Markdown 과 `Markdown` 컴포넌트의 다른 호출처(`ApprovalCard`·`PlanTileContent`·`SkillDetail`·`KeyValueBody`) · transcript 안 Markdown 코드 펜스의 가시 줄(펜스는 transcript 블록 안이라 내부 스크롤이 없다 — D-039) · 이전 턴 역순 로딩·당김·스피너(단계 E).

| WU | 요청 ID | 내용 | 런타임 소유자(위치) | AC |
|---|---|---|---|---|
| WU-1 | 설계 항목 · T15 잔여 | 공통 워커 요청 규약 — 문서 임차·전송·지연 닫기·용량 회복·키·범위(빈 결과·즉시 거부)·시간 예산·우선순위(승격·해제)·취소·재전송 · 레인 2개 · 작업 계측 | W(`worker/state.ts`·`compute.worker.ts`·`markdown.worker.ts`) · R 클라이언트(`compute/client.ts`·`protocol.ts`·`documents.ts`) | AC1~AC7·AC31·AC36 |
| WU-2 | T14 잔여 · T22 | 범위 토큰 — 200줄 창 · 체크포인트 · 한 줄씩 50ms 예산 · 줄 상한 · 마운트 행만 | W(토큰화) · R(`useWindowTokens`·`useDiffRowTokens`) | AC3·AC4·AC17·AC20·AC22 |
| WU-3 | T22 | Git 리뷰 본문 — 워커 diff 보기 모델(큰 원천)·창 동기 경로(작은 원천) · 근접 계산 · 가상 행(인라인·나란히) · 문맥 펼침 · 요구사항 위치·이동·생성 · 초안·핀 · 보정 조정기 · 폭 | W(`diffView` 모델) · R(`FileDiffSection`·`useDiffView`·`DiffReview` 조정기) · `shared/compute/diffView.ts`(공용 규칙) · agent 원천(현행) | AC8~AC14·AC16·AC17·AC34 |
| WU-4 | T14 잔여 · D-004 · T08 | 도구 카드 긴 본문 — `DiffTable`(diff 보기)·Read(경로 넷 · 보기 문서)·Work(파생 단계)·OpenCode 파일 · 동기 계산 상한·메모 · 접힌 카드 0 · Work 단일 스크롤 | R(`DiffTable`·`FileBody`·`WorkToolBody`·OpenCode `FilePanel`) · W(`codeView`·`diffView`·보기 문서) · `shared/compute/gutter.ts`(거터 제거 SSOT) | AC18~AC20·AC32·AC33 |
| WU-5 | T08 | 코드 — `CodeBlock` 줄 번호 메모 · 가상 코드 보기(`VirtualCodeView` — 1,000,000자 초과는 워커 `codeView`) | R(`CodeBlock`·`VirtualCodeView`) · W(`codeView`·토큰) | AC21·AC22 |
| WU-6 | T27 | 산출물 — 코드 모드 가상 코드 보기 · Markdown 블록 rev 2 + Markdown 레인 파싱 · 표 조각(행·칸·문자 예산) · 원문 상한 · 결과 노드 예산 · 회귀 | R(`ArtifactPreviewContent`·`VirtualMarkdownView`·`MarkdownHast`) · W(Markdown 레인) · data 원천(현행) | AC22~AC25·AC31 |
| WU-7 | 0326 B9 | 스트리밍 꼬리 — 합치기 · 보유 ≤ 2 · 캐시 안 함 · 상한 | R(`StreamingMarkdown`·`WorkerMarkdownTail`) · W(Markdown 레인) | AC26·AC27 |
| WU-8 | — | 공통 가상 행 훅 · 근처 밖 DOM 해제 · 복사 처리 계약 · 복사 단위(블록 범위 \| 블록 안 조각 — 여러 목록·살핌·준비)·끝점·건너뛴 글자 소유 · 0326 복사 통합(`TranscriptViewport`·`CopySerializationHost`·`textOffset`·`copy.ts`) | R(`shared/ui/virtual/` · transcript viewport) | AC10·AC11·AC14·AC15·AC18·AC19·AC22·AC23·AC35 |
| WU-9 | D-005 | 의존성 선언 · 경계 가드 · 문서(TRD·AGENTS·실행 모델·컴포넌트 카탈로그) | 개발 도구 · 문서 | AC28 |
| WU-10 | Windows 통합 검증 | 측정 스크립트 K1~K13 · 재현 파일 F6~F9 · 진단 다리 0327 fixture·작업 계측 첫 반영 · 누락 재측정 · 복사 상한 재조정(D-050) | 개발 도구(`app/scripts/` · `features/chat/dev/`) | AC29·AC30 |

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 완료된 큰 text 블록 워커 파싱(0326 B11) | 아니오 — renderer 내부 | 후속 후보(D-026) |
| Windows 허용치 | 아니오 — 판정만 | W(0325 D-025 OPEN) |
| transcript 코드 펜스 가시 줄 | 아니오 | 비범위 — 펜스는 transcript 블록 하나(D-039 · B4) |
| 상한을 넘는 Markdown 블록의 서식(표 > 2,000행 · 블록 > 50,000자) | 아니오 — 표시 방식만 | 원문 표시 경계(B14) |

### 6-B. 요청 항목별 판정 (`de270fe` · rev 2 는 `2707d71`)

| ID | 현재 코드 판정 | 0327 처리 | 근거 |
|---|---|---|---|
| T08 | 확인 — plain 경로 줄 번호를 렌더마다 split·배열·join(100,000줄 18.2ms) · 32,000자 초과는 색 없음 · 큰 원문은 텍스트 노드 하나 | 줄 번호 메모(AC21) · 400줄 초과 본문은 가상 코드 보기 + 범위 토큰(AC19·AC22) · transcript 펜스는 경로별 종결(D-039) | `CodeBlock.tsx:92` · §8 M7 |
| T14 잔여 | **측정** — DiffTable 5만 행 SSR 1,316ms · 구문 토큰 전체 축 · 펼친 OpenCode 본문 patch 파싱 2.8ms · 구조화 패치 줄 변환 상한 없음(50,000줄 6.89ms) · 쌍 diff 워커 결과는 줄 전체를 창이 받는다 | 가상 행(AC18) · 큰 원천은 워커 diff 보기(D-027 — 창은 창만 받음) · 범위 토큰(AC20) | `DiffTable.tsx:42`·`:55` · `DiffBody.tsx:56-62` · `useDiffLines.ts:23-29` · §8 M2·M4·M11·M20 |
| T15 잔여 | 확인 — 요청 키가 내용 전체(5만 줄 축 키 4,155,599자 · 2.07ms) | 문서 id·revision 키(AC1) · 범위 응답(AC3) · 취소·오래된 결과(AC6·AC7) | `protocol.ts:55-72` · §8 M4 |
| T22 | **재현** — 5만 줄 추가 파일 인라인 SSR 13,038ms · 나란히 2,276ms · 짝 찾기 3,788ms · 구문 토큰 워커 25,848ms · 모두 펼치기 4 × 5만 줄 창 모델 76.2ms | WU-3 전체(AC8~AC17·AC34) · 워커 모델(D-027) · 근접 계산(D-028) | §8 M1·M2·M4·M14·M16 · `FileDiffSection.tsx:241-255`·`:488-512`·`:550`·`:726` |
| T23 | **측정** — 200파일 트리 0.37ms · 평탄화 0.10ms | 현행 유지 종결(D-017) | `changedFileTree.ts` · §8 M10 |
| T27 | **재현** — Markdown 0.1M자 584ms · 1.0M자 11,543ms(파싱 96%) · 표 블록 초선형(M18c) · 코드 모드는 T08 과 같은 plain 경로 | 블록 rev 2 + Markdown 레인 파싱(AC23·AC24·AC31) · 코드 모드 가상 보기(AC22) · HTML·이미지 회귀(AC25) | `ArtifactPreviewContent.tsx:75-92` · §8 M6·M18 |
| T33(테마 재강조) | 조건부 — 마운트 코드 블록마다 재요청, 계산 레인 동시 1 | 현행 유지 종결(D-016) · 범위 토큰은 마운트 창만(AC17) | `CodeBlock.tsx:39-48` · `client.ts:6` · §8 M5 |
| 0326 B9 | **측정** — loose list 꼬리 20,000자 창 렌더 53.0~62.6ms · 100,000자 250ms | Markdown 레인 파싱 + 합치기(AC26) · 작은 꼬리·펜스 회귀(AC27) | §8 M12·M19 · `StreamingMarkdown.tsx:52-58` |
| 0325 B21 | **측정** — 990,044자 patch 2.8ms | 작은 patch 는 창 동기, 큰 patch 는 워커(D-047 ③) · 1,000,000자 초과 원문(현행) · 행은 AC18 | §8 M11·M20 |
| 설계 항목 "워커 실패·연속 실패 폴백" | 확인 — 현행(D-009 · `COMPUTE_FAILURE_LIMIT`) | 유지(레인마다) + 워커 교체 시 문서 재전송(AC2) | `client.ts:145-159` |
| 설계 항목 "가시 요청 우선순위" | 확인 — 대기열은 크기 순만 | `visible` > `background` · 승격·해제(AC5) | `client.ts:203-208` |
| 설계 항목 "취소 뒤 오래된 결과 폐기" | 확인 — 요청 id 대조·소비자 내용 대조 | 요청 키 전부 대조(AC7) | `client.ts:186-189` · `useDiffSyntax.ts:44-48` |
| 완료 기준 "5만 추가 줄 파일" | 재현(T22) | AC10·AC17·AC30 S-C0·S-C1 | — |
| 완료 기준 "한 줄 수 MB · 작은 MultiEdit 다수 · 100만 자 경계 patch" | 0325 단계 A 가 닫음 | 회귀(VP-41) · 한 줄 수 MB 의 구문 색은 D-031 줄 상한 | 0325 AC11·AC12 |

### 6-C. 0325 §6-C C 행 완료 근거 대응

| 완료 근거(런타임 층) | 0327 의 근거 |
|---|---|
| **W 계산**: revision 키·취소·오래된 응답 폐기·가시 범위 응답 · §6-D T22 "hunk·좌우 행·주석 위치 인덱스" · T14 잔여 "파싱·차이·토큰·행 투영" | AC1(키) · AC6(취소) · AC7(폐기) · AC3·AC17(범위 응답) · AC4·AC5·AC31(상한 작업·우선순위·레인) · AC9·AC13(워커 diff 보기 모델·위치 — D-027) · AC36(레인 대기 계측 — D-043) |
| **R 가시 DOM**: 5만 줄 Git 파일을 펼쳐도 R 은 보이는 행만 구성 · 스트리밍·타이핑 지연 전후 비교 | AC10·AC11(가시 행) · AC9(초안 입력에 모델 재생성 0) · AC30 S-C0(겹친 시나리오 전후 기록) |
| **data/agent 원천**: Git patch 파싱·전송 상한, 산출물 크기·형식 그대로 | 변경 0 — `git-diff-parse.ts` · `artifacts/formats.ts` 미접촉(§18) |
| 좌우 보기·리뷰 좌표·전체 복사 보존 | AC11(좌우) · AC13·AC14(요구사항) · AC15·AC35(선택 복사 — 전체 마운트 Chromium 복사와 같음) · AC20(카드 복사) |
| 요청 사항 "T22 를 별도 검증 대상" · "T33 테마 재강조와 입력 높이 측정의 소유자 분리" · "B21 따로 잰다" | AC10·AC30 S-C0·S-C1 · D-016(T33 은 C, 입력 높이는 D) · D-037 |

## 7. Requirements / Acceptance — `R ↔ AT`

> 수치 입력의 기본값: 가시 높이 600px · 행 추정 20px · overscan 20 · 창 200줄. 테스트는 이 값을 테스트 이음새(`initialRect`·`estimateSize`)로 고정한다(§11 테스트 가능성). 시간 예산은 주입 시계로 고정한다(AC4).

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-06 | AT-06 / AC1 | 요청 키는 종류·문서 키(`id@revision` · 파생 축 키 · 보기 키)·옵션(언어·테마·공백 옵션·배치·펼침 범위·단어 강조)·범위·앵커로만 만든다 — 문서 4,000,000자에서도 키 길이 ≤ 문서 키 길이 합 + 펼침 범위 문자열 + 앵커 문자열 + 96. 앵커 문자열(`anchorsKey`) = 요청 앵커를 요청 순서 그대로 `${oldLine ?? '-'}:${newLine ?? '-'}` 로 써서 `,` 로 이은 것 — 순서가 다르면 다른 키다(결과 `lineIndex[i]`·`rowIndex[i]` 가 `anchors[i]` 에 대응 — 정렬·중복 제거 없음 · D-046). 같은 `(id, revision)` 재요청은 워커에 가지 않고(캐시·병합) revision 만 바뀌면 새로 계산한다. `highlight` 키는 현행(언어·테마·내용 ≤ 32,000자) | UT `protocol.keys.test.ts` pk1~pk6(pk5 — `diffView` 키의 펼침 범위·배치·공백 옵션 · 파생 축 키 · pk6 — 앵커 200개: 키 길이 = 식의 값 · 두 앵커 순서 바꿈 → 다른 키 · 같은 앵커 두 번 → 키에 두 번 · 보기 키 = `docKey\|stripGutter`) · UT `diffView.test.ts` lc2(앵커 순서를 바꾸면 결과 `lineIndex`·`rowIndex` 순서도 같이 바뀜 · 같은 앵커 두 번 → 같은 값 두 번) · IT `client.documents.test.ts` d1(재요청 `postMessage` 0) | 소비 훅 → `computeClient().request` → `requestKey` → 캐시·대기열 |
| R-06 | AT-06 / AC2 | 문서는 그 문서를 쓰는 첫 작업 직전에 그 레인 워커로 한 번 간다(`doc.open` 이 작업 메시지보다 먼저 · 같은 워커 재전송 0). 파생 축 문서는 보내지 않는다. 임차가 모두 놓이면 그 문서를 쓰는 실행·대기 작업이 끝난 뒤 `doc.close` 1회(지연 닫기). 워커가 교체되면 다음 작업 직전 다시 간다. 열린 문서 문자 합(레인마다)이 `COMPUTE_DOC_MAX_CHARS` 를 넘는 새 문서는 보내지 않고 그 문서의 요청은 즉시 실패(워커 메시지 0) — 다른 문서가 닫혀 용량이 돌아오면 그 임차가 `available` 이 되고 구독자에게 한 번 알린다. 워커의 `unknown-doc` 응답은 문서 재전송 + 그 작업 1회 재시도 | IT `client.documents.test.ts` d1~d9 — 가짜 워커가 받은 메시지 순서 · d4 실제 `createWorkerState` · d7 실행 중 마지막 임차 해제 → 응답 뒤 `doc.close` · d8 용량 회복 → 알림 1 → 재요청 · d9 교체 전 워커의 늦은 응답 무시 + 새 워커 재전송 | `useComputeDocument` → `client.openDocument` → `pump` → `ensureDocs` → `postMessage` |
| R-06 | AT-06 / AC3 | `tokens [start, end)` 응답은 `max(0, min(end, 줄 수) − start)` 행이다 — `start ≥ 줄 수` 면 빈 행(`rows: []` · 오류 아님). 정수가 아니거나 `start < 0` · `end < start` 면 클라이언트가 즉시 거부(`range-invalid` · 워커 메시지 0), `end − start > 200` 도 즉시 거부(`range-too-large`) — 소비자는 200줄 정렬 창으로 나눠 요청한다(같은 규칙이 `codeView`·`diffView` 창에도 걸린다 — 길이 상한 400 · D-044). **색 동등성**은 줄 시간 상한에 걸리지 않는 fixture(줄 ≤ 200자 · 여러 줄 주석·템플릿 문자열이 200줄 경계를 넘음 · 20,000자 이상 한 줄 1개 — 길이 상한은 결정적)에서 본다: 각 행 = 같은 문서·언어·테마·줄 상한 옵션으로 한 번에 `codeToTokens` 한 결과의 그 행(content·color). **원문 보존**은 줄 시간 상한에 걸릴 수 있는 줄(압축 JS 15,000자)을 낀 문서에서 본다: 모든 행의 토큰 `content` 를 이으면 그 줄과 같다(색은 비교하지 않는다 — B15). 소비자는 이은 값이 줄과 다른 행을 원문으로 그린다(현행 `tokensMatchText`) | UT `worker/tokens.test.ts` t1~t4 — 실제 shiki 하이라이터 · 시간 상한 밖 600줄 fixture · 범위 `[0,200)`·`[190,390)`·`[400,600)`·`[580,780)`(문서 끝 — 20행) · t7(`[600,800)`·`[700,900)` → 빈 행 · 오류 아님) · t8(압축 JS 15,000자 줄을 낀 문서 — 모든 행 내용 이음 = 줄) · IT `client.queue.test.ts` q8(`[0,201)` 거부 · `postMessage` 0) · q8b(`[-1,10)`·`[10,5)`·`[1.5,3)` → `range-invalid` · `postMessage` 0) · `useWindowTokens.test.ts` wt1(창 경계 200 정렬) · wt6(가짜 클라이언트가 이음 ≠ 줄인 행 하나 → 그 행 원문 · 나머지 행 색) | `useWindowTokens` → `tokens` 요청 → 워커 `tokensRange` |
| R-06 | AT-06 / AC4 | 워커는 한 줄씩 토큰화하고 경과가 `TOKENS_JOB_BUDGET_MS`(50) 이상이 된 줄 뒤에 상태를 저장하고 `continue` 를 돌린다 — 토큰 작업 한 번(양보 간격) ≤ 50ms + 한 줄(줄 시간 상한은 규칙 일치 사이에서만 검사해 넘을 수 있다 — M17b 최대 112.1ms · D-043). 클라이언트는 그 작업의 양보 횟수를 1 올려 다시 넣는다(같은 등급의 새 작업·덜 양보한 작업 뒤 — D-030) · 대기자 0 이면 버린다. 5만 줄 문서 끝 범위 요청이 진행 중일 때 들어온 `highlight`·새 가시 `tokens` 는 그 토큰 작업의 다음 양보 지점 뒤 첫 작업으로 실행된다. 분할 불가 작업 뒤의 레인 대기는 AC36 | UT `worker/tokens.test.ts` t5 — 주입 시계(줄당 1ms): 작업당 토큰화 줄 = 50 · `continue` 횟수 = ⌈전진 줄 / 50⌉ · IT `client.queue.test.ts` q4(실제 순서 기록 — 양보 직후 도착한 가시 작업이 먼저) | 워커 `tokensRange` → 클라이언트 `receive` `continue` → `enqueue` |
| R-06 | AT-06 / AC5 | `visible` 이 `background` 보다 먼저 나간다. 같은 등급은 양보 횟수 → 크기 → 도착 순. 기본 등급 `visible`. 가상 목록의 화면 안 창 = `visible`, overscan 만의 창 = `background`. 대기 중 작업의 등급 = 대기자 등급 중 높은 것 — 대기자가 `setPriority` 로 바꾸면 그 자리에서 다시 정렬한다(화면으로 들어오면 승격 · 화면을 떠나 overscan 에 남으면 해제) | UT `client.queue.test.ts` q1~q3 · q9(승격 → background 앞 · 해제 → 뒤) · IT `useWindowTokens.test.ts` wt2(창 등급) · wt5(스크롤로 overscan 창이 화면에 들어옴 → `setPriority('visible')` 1) | `useWindowTokens` → `request(…, { priority })`·`handle.setPriority` → `enqueue` |
| R-06 | AT-06 / AC6 | 취소한 대기자는 즉시 거부되고(`ComputeCancelled`) 결과를 받지 않는다. 대기 중 작업의 대기자가 0 이면 대기열에서 빠진다(보내지 않음). 실행 중 `tokens` 의 대기자가 0 이면 다음 `continue` 에서 버린다. 실행 중 `highlight`·`codeView`·`diffView`(줄·patch 원천)·`diffLocate`·`diffContext`·`markdown` 은 끝까지 하고 결과는 캐시 규칙대로(꼬리 결과 제외 — AC26). 쌍 원천 `diffView` 만 대기 요청이 있으면 그 레인 워커를 교체한다(D-024) | IT `client.queue.test.ts` q5~q7 · q10(실행 중 tokens 취소 → 다음 `continue` 뒤 `postMessage` 0) · `client.test.ts:'실행 중 요청이 취소되고 대기 요청이 있으면 워커를 끝내고 새 워커에 대기 요청을 보낸다'` 를 쌍 원천 `diffView` 입력으로 바꾼다 | `handle.cancel` → `cancel(job, waiter)` |
| R-06 | AT-06 / AC7 | 소비자는 결과의 요청 키가 지금 원하는 키와 같을 때만 반영한다 — r1 범위 요청 실행 중 원천 객체가 바뀌면(r2) 늦게 온 r1 결과는 화면에 0 · 테마가 바뀐 뒤 이전 테마 결과 0 · 창이 바뀐 뒤 이전 창 결과 0. 마지막 임차 해제 직후 도착한 응답은 어느 소비자에게도 가지 않는다 · 교체 전 워커의 늦은 응답은 버린다 | IT `useWindowTokens.test.ts` wt4(revision · 테마 · 창 세 갈래) · `VirtualMarkdownView.test.ts` m5 · `client.documents.test.ts` d7·d9 | 소비 훅 결과 수신 → 요청 키 대조 |
| R-01 | AT-01 / AC8 | 단어 강조 짝은 diff 보기 모델에서 본문당 `buildCounterparts` 한 번(O(n)) — 동기·워커 경로가 같은 함수를 부른다. 5만 줄 추가 묶음에서 줄 배열 읽기 ≤ 4n(현행 뒤로 걷기 1,249,975,000). 결과는 현행 `counterpartOf` 와 모든 입력에서 같다 | UT `diffView.test.ts` cp1(길이 ≤ 8 전수 3⁸ = 6,561 + 무작위 10,000 · 현행 함수 사본 대조) · cp2(읽기 계수 Proxy) · IT `fileDiffVirtual.render.test.ts` v11(단어 강조 `mark` 위치 — 동기·가짜 워커 경로 둘 다) | `useDiffView` → `buildDiffView` → 행 창 `wordSpan` → `LineText` |
| R-01 | AT-01 / AC9 | diff 보기 모델은 (원천 revision, 공백 옵션)마다 한 번 만든다 — 동기 경로: 본문 인스턴스가 마운트돼 있는 동안 1회(메모 — 접어 언마운트한 뒤 다시 펼치면 1회 더). 워커 경로: 레인 모델 캐시(LRU `DIFF_MODEL_CACHE_ENTRIES` = 8)에 있는 동안 1회 · 다른 모델 8개가 더 쓰여 퇴거됐거나 워커가 교체된 뒤에는 그 원천의 다음 요청에서 1회 다시(문서는 임차가 남아 있으면 다시 보내지 않는다 — 교체 때만 재전송, AC2 · D-046). 초안 입력 10회·요구사항 선택·스크롤이 다시 만들지 않는다. 경로: 줄 원천은 줄 ≤ 5,000 그리고 문자 ≤ 200,000 · patch 원천은 문자 ≤ 200,000 · 쌍 원천은 `withinDiffCap` 이면 동기, 그 밖은 워커. 워커 경로에서 창은 파일 전체의 `DiffLine` 배열을 만들거나 받지 않는다(창 일 = 원천 문서 직렬화 + 행 창 수신) | IT `fileDiffVirtual.render.test.ts` v9 — 동기: `buildDiffView` 호출 1 · 워커: 가짜 워커가 센 모델 빌드 1 · 창의 `patchLinesToDiffLines`·`buildDiffView` 호출 0(5만 줄) · UT `useDiffView.test.ts` dv1(경계 5,000/5,001줄 · 200,000/200,001자 · 쌍 `withinDiffCap` 경계) · `worker/handler.test.ts` h12(원천 1~9 순서로 모델 → 9→2 재요청 빌드 증가 0 → 1 재요청 1 의 빌드 2 · 워커 교체 뒤 같은 원천 → 빌드 +1 · 문서 재전송 1) | `FileDiffBody` → `useDiffView` → (동기 `buildDiffView` \| 워커 `diffView`) |
| R-01 | AT-01 / AC10 | 펼친 파일 본문의 마운트 행 — 근처(스크롤 소유자 위·아래 한 화면)인 동안: 400행 이하 전부 · 400행 초과 화면 안 + overscan + 핀. 근처가 아니면 핀 행만(나머지 0 · 비연속 핀 사이 여백). 계산의 수명과 DOM 의 수명은 다르다(D-051): 계산(모델·임차)은 처음 근처·선택·이동 때 열려 접기·새 patch 세대까지 남고 행 DOM 은 근처일 때만 있다 · 근처를 벗어난 파일의 자리 높이 = 마지막 측정 높이(측정 전이면 추정 높이). 5만 줄 추가 파일: 마운트 행 ≤ 30 + 40 + 핀. **모두 펼치기** 200파일 × 300행: 첫 paint 전 계산이 열린 파일 ≤ 2 · 그 파일만 모델 요청·축 문서 임차·전송 · 나머지 198파일은 모델 0 · 임차 0 · 요청 0 · 행 0 · 높이 `min(300, 7 × (추가+삭제) + 1) × 20px`. 4 × 50,000 모두 펼치기: 계산이 열린 파일 = 근접 파일만. **200파일을 위에서 아래로 차례로 지난 뒤**: 근처가 아닌 파일의 마운트 행 = 그 파일의 핀 수 · 모델 빌드 = 파일마다 1(다시 근처가 돼도 증가 0) · 지나간 파일의 자리 높이 = 마지막 측정 높이 | IT `fileDiffVirtual.render.test.ts` v1·v2·v3(400행 이하 소형 fixture 는 현행 SSR 과 같음) · `fileDiffExpandAll.render.test.ts` ea1(200 × 300 — 가짜 클라이언트 임차·요청 기록 · `buildDiffView` 호출 계수 · 축 문자 합) · ea2(4 × 50,000 — 워커 경로 요청 수) · ea3(200 × 300 — 가짜 `IntersectionObserver` 로 근처 창을 파일 1 → 200 으로 옮김 · 파일 120 에 초안 1 · 끝에서 파일별 마운트 행(120 = 1 · 근처 밖 나머지 = 0) · `buildDiffView` 호출 = 파일당 1 · 지나간 파일 자리 높이 = 측정 높이 · 다시 파일 1 로 → 빌드 증가 0) | `DiffReview` → `FileDiffSection` → `FileDiffBody` 계산 게이트 → `useDiffView` → `useVirtualRows` |
| R-01 | AT-01 / AC11 | 나란히 보기도 같은 마운트 규칙이다. 짝 행은 현행 `toSideBySideRows` 결과와 같다(gap 제자리 · 묶음 안 k번째끼리) | IT v4 · UT `diffView.test.ts` sb1(묶음별 대조) | `SideBySideBody` → `useVirtualRows` |
| R-01 | AT-01 / AC12 | 위쪽 문맥 펼침 뒤 펼친 gap 아래 첫 줄의 화면 위치가 펼치기 전과 같다(±1px) · 아래쪽은 보정 0 — 400행 초과 파일 · 워커 경로(새 행 창이 비동기로 도착) · 줄바꿈 켬 + 초안 열림(textarea 높이 변화)을 겹쳐도 같고 초점은 textarea 에 남는다. 보정은 보정 조정기가 한 번 한다(AC34). 꼬리 여백 계획은 현행 `planUpwardExpansionCompensation` | IT v5 — 가짜 DOM rect · `scrollTop` 변화 = 삽입 행 높이 합 · v5b(줄바꿈 + 초안 높이 + 위쪽 펼침 겹침 — 앵커 ±1px · `document.activeElement` = textarea) · v5w(워커 경로 — 창 응답 뒤 한 번 보정) | `GapRow` 클릭 → 펼침 범위 추가 → (동기 행 \| 워커 `diffView` 창) → 보정 조정기 |
| R-01 | AT-01 / AC13 | 화면 밖 요구사항 이동 순서 — 펼침(접혀 있으면) → 계산 요청(안 열렸으면) → 위치(`diffLocate` — 줄 색인) → 숨은 줄이면 드러내기(`[i−3, i+4)` 펼침 범위 — 현행 `revealDiffHunkLine` 과 같은 행) → `scrollToIndex(행, 'center')` → 다음 프레임 `revealDiffRequirement` 1회. 5만 줄 파일 49,000번째 줄 요구사항 선택 → 카드 마운트 · `scrollIntoView` 1회 | IT v6(동기 경로) · v6w(워커 경로 — 가짜 워커 요청 순서 `diffLocate` → `diffView`) | 선택 → `FileDiffBody` 이동 효과 → `diffLocate` → `scrollToIndex` → rAF → `revealDiffRequirement` |
| R-01 | AT-01 / AC14 | 초안 행·요구사항 카드 행은 가상 항목이다(카드 행 자리 = `diffLocate` 가 준 행 번호). 초안 행은 초안이 있는 동안 핀(화면 밖으로 스크롤해도 textarea 와 초점 유지)이고 높이 변화는 측정되어 아래 행 위치에 반영된다. 핀은 근접 판정보다 우선 — 근접 밖 파일도 핀 행은 마운트하고 나머지 행은 0(계산은 남는다 — AC10 · D-051). 비연속 핀 사이는 여백 행(사이 행 추정·측정 높이 합). 요구사항 생성(`onAddRequirement`)의 앵커는 현행 `createDiffRequirementItem` 과 같다(워커 경로는 `diffContext` 문맥 창) | IT v7 · v7b(근접 밖 파일 마운트 행 = 핀 수) · v7c(여백 높이 = 사이 행 높이 합) · UT `diffView.test.ts` cx1(무작위 입력 모든 줄: 전체 배열 앵커 = 문맥 창 앵커) | `onDraftChange` → 항목 목록 → `useVirtualRows` pins · `onAddRequirement` → (`lines` \| `diffContext`) |
| R-09 | AT-09 / AC15 | Git 본문 복사 결과 = 전체 마운트 Chromium 기본 복사(D-029). 두 끝이 한 파일 본문 안이면 그 본문이 `claimCopy` 로 가져간다 — 행이 창에 있고 범위 ≤ `VIRTUAL_COPY_SYNC_MAX_ROWS` 면 범위 행을 핀으로 동기 마운트(`flushSync`) → 선택을 (행, 칸, 오프셋) 끝점에 다시 놓음 → 기본 복사 · 그 밖은 `preventDefault` → 행 조각(≤ `VIRTUAL_COPY_CHUNK_ROWS`)마다 직렬화 호스트(같은 표 구조·열 폭)에 마운트 → `Selection.toString()`·`cloneContents()` → `navigator.clipboard.write`. 두 끝이 다른 파일이면 `DiffReview` 가 (파일, 행 조각) 단위로 같은 일을 한다. 나란히 보기 부분 선택은 시작·끝 칸 오프셋을 지킨다. 워커 경로 파일의 비동기 조각은 마운트 전에 그 조각 행의 창을 받는다(준비 단계 — D-049) · 동기 상한·조각 크기는 K12·S-C8 절차로 정한다(D-050) | UT `rowSelection.test.ts` r1~r6(끝점 ↔ (행, 칸, 오프셋) 정·역방향 · 조각 계획) · IT v8(동기 — 400행·401행 파일 같은 끝점) · v8a(비동기 — 조각마다 마운트 행·선택 끝점 기록) · v8b(파일 경계 → `DiffReview` 처리 1 · 본문 처리 0) · v8w(워커 경로 파일 비동기 — 조각마다 `diffView` 창 요청 → 응답 뒤 마운트 · 준비 동안 마운트 0). Chromium 문자열 대조는 AC30 S-C8 | `selectionchange` → pins · `onCopy` → `claimCopy` → (동기 마운트 \| `startCopyJob` 행 단위) |
| R-01 | AT-01 / AC16 | 줄바꿈 끔이면 본문 표 최소 폭 = 모델의 `widthColumns` ch + 거터 — 마운트 행이 바뀌어도, 동기·워커 경로가 같은 값. 줄바꿈 켬이면 최소 폭 없음 | UT `diffView.test.ts` p1~p3(탭 8칸 정렬 · 전각 2 · 최댓값) · IT v10 | 모델 → 표 `style.minWidth` |
| R-01 | AT-01 / AC17 | 구문 색 — 마운트 행의 축 줄을 200줄 창으로 묶어 축·창마다 `tokens` 1회. 5만 줄 첫 화면 축마다 창 ≤ 2. 축 문서는 동기 경로면 창이 만든 축 텍스트(근접 파일마다 2), 워커 경로면 워커 파생 축(창 축 텍스트 0 · 축 `doc.open` 0). 전체 축 `diffTokens` 요청 0. 색은 전체 토큰화와 같다(AC3). 테마 전환은 마운트 창만 다시 요청. 토큰 원문 대조(`content` 연결 = 줄 본문)가 틀린 행은 원문. **먼 핀**: 행 100 근처를 보며 행 40,000 이 선택 끝 핀이면 요청 ≤ 축 수 × (2 + 핀 창 1) — 추가만 파일은 new 축만이라 ≤ 3 | IT `useDiffRowTokens.test.ts` rt1~rt5 — 가짜 계산 클라이언트 요청 기록 · rt7(먼 핀 요청 수) · rt8(워커 경로 — 축 `doc.open` 0 · 창 축 텍스트 생성 0) | `FileDiffBody` → `useDiffView` 축 참조 → `useDiffRowTokens` → `useWindowTokens` |
| R-02 | AT-02 / AC18 | 400줄 초과 `DiffTable`(Claude 구조화 패치·쌍 · OpenCode 파일 본문)은 최대 높이 384px 내부 스크롤 + 가시 행 · 400 이하는 현행 DOM. OpenCode 는 기존 `max-h-[384px]` 컨테이너를 스크롤 요소로 받는다(스크롤 요소 1). 원천 경로는 D-027 — 큰 쌍·구조화 패치·patch 에서 창은 행 창만 받는다 | IT `DiffTable.virtual.test.ts` dt1·dt2(400행 SSR = 현행) · dt3(OpenCode 5만 줄 스크롤 요소 1) · dt4(Claude 쌍 5만 줄 — 가짜 워커 응답이 행 창뿐 · 창의 jsdiff 호출 0) · `longToolBody.render.test.ts` lb1(Claude 쌍 diff 401줄) | `DiffBody`·`PairBlock`·`FilePanel` → `useDiffView` → `DiffTable` → `useVirtualRows` |
| R-02 | AT-02 / AC19 | 400줄 초과 Read(줄 번호) 본문은 `VirtualCodeView`(384px · 가시 줄 · 가시 줄 번호만) · Work payload 는 400줄 초과면 Work 컨테이너를 스크롤 요소로 받는 `VirtualCodeView`(AC33) · 400줄 이하는 문자 수와 무관하게 현행 `CodeBlock`(D-047 ① · 질의 7) · Work 오류 색 동일. Read 경로 넷 — ① ≤ 400줄 · ≤ 1,000,000자 ② ≤ 400줄 · > 1,000,000자: `CodeBlock` + 창 거터 제거 원천당 1회 ③ > 400줄 · ≤ 1,000,000자: `VirtualCodeView` + 창 거터 제거 1회 ④ > 400줄 · > 1,000,000자: `VirtualCodeView` + 워커 `codeView({ view })` — ③④ 의 토큰 원천 = 보기 문서 `{ doc: 원문, transform: 'stripGutter' }`(D-048). 네 경로 모두 표시 줄 = `stripLineNumberGutter(원문)` 의 줄 · 토큰 `content` 이음 = 표시 줄 · 드래그 선택 끝점 오프셋에 거터·줄 번호 글자 0(줄 번호는 `data-transcript-chrome`·`select-none`) · 카드 복사 버튼 = `copyText(call)`(거터 포함 원문 — 현행) | IT `longToolBody.render.test.ts` lb2~lb4 · `readBody.test.ts` rd1(경로 판정 — 400/401줄 × 1,000,000/1,000,001자 네 칸) · rd2(거터 입력 — 네 경로 표시 줄 = 제거 결과 · ③④ 토큰 요청 원천 `{ view }` · 키에 `\|stripGutter`) · rd3(드래그 끝점 오프셋에 거터 글자 0 · 카드 복사 = 거터 포함 원문) · UT `worker/handler.test.ts` h13(보기 문서 토큰 = 거터 뺀 텍스트를 한 번에 `codeToTokens` 한 결과 · `codeView({ view })` 줄 = `stripLineNumberGutter` 결과) | `FileBody`·`WorkToolBody` → (`CodeBlock` \| `VirtualCodeView` → (창 색인 \| `codeView`) · `useWindowTokens(보기 문서)`) |
| R-02 | AT-02 / AC20 | 카드 복사 버튼 문자열은 전체 원문(현행 `copyText(call)`). 구문 색은 마운트 행 범위만 — 쌍 diff 는 old·new 원문이 곧 축 문서(축 텍스트 생성 0), 구조화 패치·patch 는 축 문서(동기 경로 창 · 워커 경로 파생) | IT `longToolBody.render.test.ts` lb5 · `useDiffRowTokens.test.ts` rt6 | `ToolCard` 복사 · `DiffTable` → `useDiffRowTokens` |
| R-03 | AT-03 / AC21 | `CodeBlock` plain 경로의 줄 번호 열은 같은 `code` 에서 한 번 만든다 — 다시 렌더 10회에 `split` 1회 · 출력 현행과 같음 | UT `CodeBlock.render.test.ts` cb1 | `CodeBlock` 렌더 |
| R-03 | AT-03 / AC22 | 산출물 코드 모드·텍스트 형식이 400줄 초과면 `VirtualCodeView` — 5MiB 문서 마운트 줄 ≤ 가시 + overscan · 줄 번호는 마운트 줄만 · 지원 언어면 32,000자를 넘어도 마운트 창 `tokens` 로 색 · 줄 시작 색인·폭은 원천 ≤ 1,000,000자면 창에서 원문당 1회, 넘으면 워커 `codeView`(창은 줄 수·폭·가시 줄 문자열만 받는다 · 창 ≤ 400줄 · 결과에 `charsBefore`·`textChars` — D-044·D-049) · `codeView` 대기 중 빈 자리(`aria-busy`), 실패면 현행 `CodeBlock` 원문 | IT `VirtualCodeView.test.ts` x1~x4 · x6(1,000,001자 → `codeView` 요청 1 · 창 줄 색인 0) · x7(`codeView` 결과 `charsBefore` = 창 첫 줄 앞 줄 본문 글자 합 · `[줄 수, 줄 수 + 10)` → 빈 줄 · 오류 아님) · `ArtifactPreviewContent.render.test.ts` a4 | `ArtifactViewer` → `ArtifactPreviewContent` → `VirtualCodeView` → (창 색인 \| `codeView`) |
| R-04 | AT-04 / AC23 | Markdown 미리보기 원문 > 4,000자면 `VirtualMarkdownView` — 블록 분할(D-033) → 마운트 블록 ≤ 가시 + overscan → 파싱 전 블록은 원문 즉시 → Markdown 레인 `markdown` hast 로 교체. 이 경로의 창 remark 파싱 0(`Markdown` 호출 0) · 4,000자 이하는 현행 `<Markdown>` | IT `VirtualMarkdownView.test.ts` m1~m4 | `ArtifactPreviewContent` → `VirtualMarkdownView` → `markdown` 요청(Markdown 레인) → `MarkdownHast` |
| R-04 | AT-04 / AC24 | 충실도 — fixture 묶음(목록 안 펜스 · loose list · 참조 링크 · 표 · HTML 텍스트 · 인용 연속 · 제목 · 차단 이미지 · 각주 ≤ 50,000자(한 블록) · 블록 끝 개행 `* a\n* b\n</Warning>` · 열린 HTML 블록 1(`<script … />` 뒤 제목) · 인접 최상위 HTML(`</CodeGroup>` 다음 `<Note>`) · 본문 행 201개 이상 표(조각 합침) · 큰 셀 표(200행 × 3열 × 1,000자 — 문자 예산 조각) · 넓은 표(200행 × 50열 — 칸 예산 조각))에서 블록별 hast 를 `MarkdownHast` 로 그려 이은 결과 = `<Markdown source>` 전체 렌더(태그 경계 공백·SSR 구분 주석 제외 — M13b 정규화) | UT `markdownDocumentBlocks.test.ts` mb1~mb9 · IT `MarkdownHast.fidelity.test.ts` f1(실제 워커 파싱 함수) · f3(표 200행 조각 합침 = 전체) · f3b(큰 셀·넓은 표 — 조각 합침 = 전체) | `markdownDocumentBlocks` → 워커 `markdownBlock` → `MarkdownHast` |
| R-04 | AT-04 / AC25 | 산출물 HTML 은 정리된 문서만 sandbox iframe · 이미지 실패·재시도 · 모드 전환 · 다운로드 — 지금 그대로 | 기존 `ArtifactPreviewContent.render.test.ts` 3건 · `ArtifactViewer.actions.test.ts` | `ArtifactViewer` |
| R-05 | AT-05 / AC26 | 열린 펜스가 아닌 꼬리 > 4,000자는 창 remark 파싱 0 — Markdown 레인 `markdown`. 꼬리 인스턴스마다 실행 ≤ 1 + 대기 ≤ 1(새 delta 는 대기 요청을 최신 꼬리로 바꾼다) · 보유 꼬리 문서 ≤ 2 · 꼬리 결과 캐시 항목 0. 마지막 결과 원문이 현재 꼬리의 접두면 그 hast + 나머지 글자 원문, 아니면 현재 꼬리 원문만. 꼬리 > 50,000자는 원문. 완료 뒤 DOM 은 완료 경로(`AssistantSegment` `<Markdown>`) 렌더와 같다 | IT `WorkerMarkdownTail.test.ts` s1~s5 · s7(가짜 워커가 delta 3개마다 하나 끝냄 → 보낸 요청 = 끝난 수 + 1 · `doc.open` 수·문자 합 기록) · s8(스트림 뒤 꼬리 키 캐시 0) · s9(완료 렌더 대조) · s10(50,001자 → 요청 0 · 원문) | `StreamingMarkdown` → `WorkerMarkdownTail` → `markdown` 요청(Markdown 레인) → `MarkdownHast` |
| R-05 | AT-05 / AC27 | 꼬리 ≤ 4,000자는 현행 창 동기 `<Markdown>` · 열린 펜스는 현행 `StreamingFence` | `StreamingMarkdown.fence.test.ts:'StreamingMarkdown renders open fence without invoking Markdown for the tail'` · `WorkerMarkdownTail.test.ts` s6(4,000자 → `Markdown`) | `StreamingMarkdown` |
| R-08 | AT-08 / AC28 | `app/package.json` 직접 의존성 4개(설치 버전 범위) · TRD §2 행 · `app/AGENTS.md` 채택 목록 · 실행 모델 계산 워커 행(레인 2개) 갱신 · UI 스레드 소스의 `unified`·`remark-parse`·`remark-rehype` 값 import 0(가드 규칙 (b) — 워커 구역만) · `new Worker(` 는 `client.ts` 의 레인 생성 자리만(규칙 (i)) | gate `node scripts/check-ui-thread.mjs` · `scripts/check-ui-thread.test.mjs` 신규 케이스(UI 파일 import → 위반 1) · EP-14 `rg` | 빌드·CI 가드 |
| R-07 | AT-07 / AC29 | `measure-ui-inputs.mjs` K1~K13 — 결정적 입력 · `--src` 두 트리 비교 · 함수 없음 `N/A(함수 없음)` · 재현 파일 F6~F9 · 누락 표본 재측정(최대 2회 · 시도 수 기록). K12 는 복사 상한 탐색(D-050 — 100~2,000행 · 20 크기 · 목록 종류마다 · 모든 종류 통과 최대 · 100 도 넘으면 `통과 표본 없음` → AC15·AC35 미완료) · K13 은 계산 레인 분할 불가 작업의 점유(D-043) | `node --test scripts/measure-ui-inputs.test.mjs` K 케이스 · 재측정 규칙 케이스 · k12(탐색 범위 · 종류별 최소 · 무통과 판정) | 개발 도구 |
| R-07 | AT-07 / AC30 | Windows 실기 S-C0~S-C9 — 0326 PASS 빌드와 0327 빌드, 0325 §19 규약 + D-041 지표·fixture·관측 표. S-C8 상한 크기 조각 task 가 50ms 를 넘으면 상수를 S-C8 통과 최대로(통과가 없으면 절반으로) 낮추고 S-C8 을 다시 돌려 통과해야 닫힌다(D-050 — 상수 하향·W 인계만으로 닫지 않는다). S-C9 는 계산 레인의 선행 작업 점유 · 새 가시 요청 대기 · 첫 paint 를 따로 적는다(D-043) | 사람 실기 · §19 | 설치본 · 진단 빌드 |
| R-06 | AT-06 / AC31 | 한 작업·한 응답 상한 — ① `tokens`·`highlight` 의 shiki 호출은 `tokenizeMaxLineLength: 20,000`·`tokenizeTimeLimit: 50` 을 준다(32,000자 minified JS 한 줄 강조 → 색 없는 한 줄) ② `markdown` 작업은 Markdown 레인에서만 실행 — Markdown 레인이 블록을 파싱하는 동안 계산 레인의 `highlight` 는 기다리지 않는다 ③ 표 블록 조각 = 본문 행 ≤ 200 그리고 칸(머리 칸 + 조각 행 × 열 수) ≤ 1,000 그리고 조각 원문 ≤ 50,000자 — 행을 앞에서부터 담다가 다음 행이 셋 중 하나를 넘기면 새 조각(조각마다 행 ≥ 1). 작업 0(원문 표시): 표 본문 행 > 2,000 · 열 > 500 · 머리 + 한 행 > 50,000자 · 표가 아닌 블록 > 50,000자 · 각주 문서 > 50,000자 ④ 결과 노드 예산 — 워커는 블록·조각 hast 의 노드(root·요소·텍스트 전부)를 세어 > 20,000 이면 hast 대신 `{ tooLarge: true }` · 그 블록(표는 표 전체 — 이미 그린 앞 조각 포함)은 최종 원문(`data-md-block-raw`)이고 남은 조각 요청은 취소된다 · 결과 하나를 반영할 때 새로 그리는 hast 노드 ≤ 20,000(D-045) | UT `worker/handler.test.ts` h9(shiki 옵션 전달 — 가짜 하이라이터 인자 기록) · IT `client.lanes.test.ts` l1(Markdown 레인 실행 중 계산 레인 `postMessage` 즉시) · l2(레인별 문서 등록부·연속 실패) · UT `markdownDocumentBlocks.test.ts` mb10(표 조각 수 · 상한 원문 판정) · mb11(큰 셀 200 × 3 × 1,000자 → 문자 예산 조각 13(16행씩) · 넓은 표 200 × 50 → 칸 예산 조각 11(19행씩) · 501열 → 원문 · 머리 + 한 행 60,000자 → 원문 · 2,001행 → 원문) · `worker/markdown.test.ts` mw6(촘촘한 문단 30,000자(`*a* `) → `tooLarge` · 노드 20,000 이하 블록 → hast · 넓은 표 조각 결과 노드 ≤ 20,000) · IT `VirtualMarkdownView.test.ts` m6(상한 초과 블록 요청 0 · `data-md-block-raw`) · m7(가짜 워커가 둘째 조각에 `tooLarge` → 표 전체 `data-md-block-raw` · 셋째 이후 조각 요청 취소 · 앞 조각 hast 언마운트) | 소비 훅 → `request` → 레인 판정 → 워커 |
| R-02 | AT-02 / AC32 | 카드·코드 보기의 창 동기 파생은 단계마다 원천마다 1회 — 같은 카드 다시 렌더 10회에 단계별 호출 증가 0. **Read**: 거터 제거 — 400줄 이하는 문자 수와 무관하게 창 1회 · 400줄 초과는 ≤ 1,000,000자 창 1회 · 초과 창 0(`codeView`)(D-047). **Work**(D-042 · 원천 `call.input`·`call.result`): ① text 배열 잇기 1 ② 객체 문자열화 1(크기 무관 — B16) ③ 문자열 언어 판정 ≤ 1,000,000자 1 · 초과 0 · 객체를 문자열화한 결과는 0 ④ 줄 시작 색인·폭(400줄 초과) ≤ 1,000,000자 창 1 · 초과 0(`codeView`) ⑤ 상태·검색 결과 1. 5MB 객체 응답 최초 펼침: ② 1 · ③ 0 · ④ 0 · `codeView` 1 / 같은 원천 다시 렌더 10회: 모든 단계 증가 0 / 5MB 문자열 응답: ③ 0 · ④ 0 · `codeView` 1 / Task 합성 응답도 원천이 `call.result` 라 1회. **diff 원천**(OpenCode patch 파싱 · 구조화 패치 줄 변환 · 쌍): D-027 상한 안 창 1회 · 밖 창 0(`diffView`). 접힌 Claude 카드(한 번도 열지 않음)와 닫힌 OpenCode 파일은 본문 파생 0 · 임차 0 · 요청 0 | IT `cardSyncCaps.test.ts` cs1(Read 거터 메모) · cs2a(Work 5MB 객체 — 최초 ② 1 · ③ 0 · ④ 0 · `codeView` 1 / 재렌더 10 → 증가 0) · cs2b(Work 5MB 문자열 — ① 0 · ③ 0 · ④ 0 · `codeView` 1) · cs2c(Task 합성 응답 — 재렌더 10 단계 증가 0) · cs2d(text 배열 응답 — ① 1 · 재렌더 0) · cs3(1,000,001자 401줄 Read → `codeView` · 창 거터 제거 0) · cs3b(1,000,001자 300줄 Read → `CodeBlock` · 창 거터 제거 1 · 재렌더 0) · cs4(OpenCode patch 200,001자 → `diffView`) · cs5(접힌 카드 — 파생·임차·요청 0) · cs6(닫힌 OpenCode `<details>` — 본문 미렌더) | `ToolCard` 본문 → `FileBody`·`WorkToolBody`·`DiffBody`·`FilePanel` → (창 파생 1회 \| 워커) |
| R-02 | AT-02 / AC33 | Work 본문 — (a) 실행 중(요청만, 400줄 초과): 본문 안 스크롤 요소 = 250px 컨테이너 1 · 요청 가상 목록이 그 컨테이너를 스크롤 요소로 받는다 · 휠·키보드는 컨테이너가 받고 초점은 컨테이너(`tabIndex=0`) (b) 요청·응답 둘 다 400줄 초과: 두 가상 목록이 같은 컨테이너를 쓴다(각자 `scrollMargin` = 컨테이너 안 위치) · 스크롤 요소 1 · 384px 요소 0. 결과 도착은 응답 문서만 새로 임차하고 요청 문서·스크롤 위치는 그대로 | IT `workToolBody.virtual.test.ts` wk1(실행 중 — 스크롤 요소 1 · `scrollElement` = 컨테이너) · wk2(공존 — 두 목록 `scrollMargin` · 스크롤 요소 1) · wk3(결과 도착 — 요청 임차 유지 · 응답 임차 1 · `scrollTop` 불변) · wk4(id·revision 원천 `call.input`/`call.result`) | `WorkToolBody` → `Payload` → `VirtualCodeView scrollElement` |
| R-01 | AT-01 / AC34 | Git 패널 스크롤 보정 — 위쪽 문맥 펼침 · 근접 밖 파일 자리 → 실제 높이 교체 · 화면 위쪽 가상 행 측정 변화가 같은 프레임에 겹치면 보정 조정기가 합쳐 `scrollTop` 을 한 번 쓴다 · 파일 본문 가상 목록은 `scrollTop` 을 쓰지 않는다(크기 보정 끔). 화면 위쪽 파일 자리가 실제 높이로 바뀌어도 화면 안 첫 행 위치 ±1px. transcript 안 내부 목록의 스크롤 요소는 그 카드 요소다(transcript 스크롤 요소를 받지 않음) | IT `diffScrollCoordinator.test.ts` sc1(같은 프레임 세 원인 → `scrollTop` 쓰기 1) · sc2(위쪽 자리 교체 → 첫 행 ±1px) · sc3(파일 가상 목록 `scrollTop` 쓰기 0) · `DiffTable.virtual.test.ts` dt5(transcript 안 `DiffTable` 의 `scrollElement` = 자기 384px 요소) | `DiffReview` 조정기 ← `FileDiffBody`(펼침·측정·자리) |
| R-09 | AT-09 / AC35 | transcript 복사 통합 — 복사 이벤트는 한 번만 처리된다: 두 끝이 같은 카드 내부 목록이면 그 목록이 가져가고 `TranscriptViewport.handleCopy` 는 건너뛴다 · 카드 경계를 넘으면 `TranscriptViewport` 가 처리한다. **블록 안 여러 목록**(D-049): 한 블록의 내부 가상 목록은 DOM 순서로 줄 세운다(도구 묶음 블록의 카드 여럿 · Work 카드의 요청·응답) — 복사 단위는 블록 범위(내부 목록 없는 블록 — 0326 단위) 또는 한 블록 안의 조각 `{ index, from, to }`(블록 시작 · (목록 순번, 행) · 블록 끝)이고 한 조각이 마운트하는 내부 행 합 ≤ `VIRTUAL_COPY_CHUNK_ROWS` · 목록 사이 일반 텍스트(머리글·상태 문구)는 그 자리를 덮는 조각의 DOM 범위에 든다 · 뷰포트에 없는 블록은 행 0 살핌 마운트로 목록을 등록한 뒤 계획한다 · 워커 경로 목록은 조각 마운트 전에 행 창을 받는다(준비 단계 — UI task 밖). **건너뛴 글자**: 미마운트 행 자리 `data-virtual-skip-chars` 값은 목록 모델의 소유자가 낸다 — 창 동기 모델은 행 본문 길이 누적합, 워커 모델은 창 결과 `charsBefore`·요약 `textChars`. 내부 목록 안 끝점의 part 문자 오프셋 = 전체 마운트 DOM 에서 센 값 · 내부 목록의 줄 번호·거터·± 는 `data-transcript-chrome` | IT `transcriptCopyInner.test.ts` tc1(같은 목록 — 목록 처리 1 · 뷰포트 처리 0) · tc2(카드 경계 — 뷰포트 처리 1 · 단위 = 블록 + 조각) · tc3(400행/401행 카드 같은 끝점) · tc4(정·역방향 오프셋 = 전체 마운트 오프셋) · tc5(동기 ≤ 상한 / 비동기 초과) · tc6(Work 카드 요청 목록 행 → 응답 목록 행, 정·역방향 — 조각 경계 · 사이 머리글 포함 · 조각 마운트 행 ≤ 상한 · 끝점 오프셋 = 전체 마운트) · tc7(응답 목록 행 → 다음 블록 문단, 정·역방향) · tc8(뷰포트 밖 블록 — 살핌 마운트 1 · 워커 경로 목록 창 요청 → 응답 뒤 조각 마운트 · 준비 동안 마운트 0) · UT `copyUnits.test.ts` cu5(목록 셋 블록 — 조각 계획·경계 위치) · cu6(목록 미상 블록 → 살핌 단위 먼저) · `textOffset.test.ts` to1(`data-virtual-skip-chars` 합산) · to2(거터 chrome 제외) | `TranscriptViewport` `onCopy` → `isCopyClaimed` → `copyUnits` → (`prepareChunk`) → `CopySerializationHost` → `startCopyJob` |
| R-06 | AT-06 / AC36 | 계산 레인 대기는 양보 간격과 따로 잰다(D-043). 분할 불가 작업(`highlight` · `codeView` · `diffView` 모델 생성·쌍 jsdiff · `diffLocate` · `diffContext`)이 실행 중이면 그 뒤 도착한 가시 요청은 그 작업이 끝난 뒤 첫 작업으로 나간다(선점 없음 — 쌍 원천 취소 + 대기 요청이면 워커 교체, D-024). 클라이언트는 작업마다 `{ kind, lane, priority, yields, key, enqueuedAt, startedAt, endedAt }` 를 주입된 계측 싱크에 쓰고(싱크가 없으면 기록 0), 진단 다리는 같은 요청 키로 소비자 첫 반영 시각을 붙인다 — 점유(`endedAt − startedAt`) · 대기(`startedAt − enqueuedAt`) · 첫 paint(요청 → 반영) | IT `client.queue.test.ts` q11(주입 시계 — 쌍 원천 `diffView` 실행 중 t=10 에 가시 `highlight` 도착 → `highlight` 의 `postMessage` 시각 = 쌍 응답 시각 · 기록 대기 = 응답 − 10 · 쌍 기록 점유 = 쌍 작업 길이) · q12(`tokens` 실행 중 도착 → 다음 `continue` 뒤 첫 작업 · 기록 대기 ≤ 한 양보 간격) · q13(싱크 없음 → 기록 호출 0) · 진단 다리 fx2(`computeTimings()` 가 요청 키별 첫 반영 시각을 붙임) | `request` → `enqueue`(enqueuedAt) → `pump`(startedAt) → `receive`(endedAt) → 소비 훅 반영 |

### AC 검증 주의사항

- 기존 테스트 재사용: `client.test.ts` 29건 중 취소 1건(`:269`)의 입력을 쌍 원천 `diffView` 로, 캐시 비용 k5 의 `diffLines` 입력을 쌍 원천 `diffView` 로 바꾸고 나머지는 그대로 통과해야 한다(VP-40·VP-42 — `diffLines` 요청 종류는 D-027 로 없어진다). Git 패널 렌더 테스트(`diffTile.render`·`diffRequirementSelection.render`·`diffSyntax.render`·`fileDiffRequirementReveal`·`diffPanel0211dv6.render`)는 400행 이하 fixture 라 동기 경로·전부 렌더 경로를 탄다 — 그대로 통과해야 한다(VP-43). `diffSyntax.render.test.ts` 는 토큰 공급이 `useDiffRowTokens` 로 바뀌므로 가짜 계산 클라이언트 응답 형상만 바꾼다(단언은 그대로). 0326 복사 테스트(`TranscriptViewport.selection.test.ts`·`copy.test.ts`)는 가져가지 않은 이벤트 경로라 그대로 통과해야 한다(VP-50).
- 사람 실기 항목: AC30 뿐이다 — 실제 Chromium 의 layout·paint·클립보드 직렬화 문자열과 Windows 장비 시간은 node 에서 잴 수 없다. 마운트 수·요청 수·작업 줄 수·끝점·복사 단위는 전부 AC1~AC29·AC31~AC36 의 기계 단언이다.
- N회/총량 기준: AC4 의 작업당 줄 수는 주입 시계로 센 워커 `tokensRange` 안 `codeToTokens` 호출 수다 — 토큰화 호출부는 `tokensRange` 하나다(EP-3 검색). AC17 의 창 수는 가짜 클라이언트가 받은 `tokens` 요청 수다 — `tokens` 요청을 만드는 production 호출부는 `useWindowTokens` 하나다(EP-16 검색).
- 총량/0건 기준: AC23·AC26 "창 remark 파싱 0" 은 `react-markdown` 모듈의 `default` export 호출 계수(vi.mock spy)와 UI 소스의 parser import 0(AC28)을 짝짓는다. AC10·AC32 의 "0" 단언은 양성 단언(계산이 열린 파일 = 근접 2 · 파생 호출 1)과 짝짓고, 게이트를 늘 여는 변이가 red 가 되는지로 방향을 확인한다(VP-01·VP-49 선택 적대 증거).
- 색 동등성 fixture(AC3)는 줄 시간 상한에 걸리지 않는다 — 줄 ≤ 200자는 줄당 ≈ 0.42ms(M17a)라 50ms 와 두 자릿수 차이다. 줄 시간 상한에 걸리는 줄은 장비·실행마다 멈춤 지점이 달라 색을 단언하지 않고 내용 이음만 단언한다(F31 · B15).
- AC36 의 시간 값은 주입 시계 값이다 — Windows 의 점유·대기·첫 paint 는 S-C9 가 잰다. 표 조각·노드 예산(AC31 ③④)은 칸·문자·노드 계수로 단언하고 시간은 K10 이 잰다. 단계 계수(AC32)는 단계 함수 spy 호출 수다.

## 7-A. V / Trace Matrix

- V mode 판정: `Baseline V` — 0327 은 새 handoff 이고 명시적으로 상속할 V 가 없다. rev 2·rev 3 은 구현·verify 전 기준선 정정이라 Delta V 가 아니다 — V1 노드 ID 를 잇고 바뀐 노드는 같은 ID 로 고쳐 쓰며, rev 2·rev 3 이 더한 노드는 표의 `rev 2`·`rev 3` 표시로 구분한다. 0324·0325·0326 의 영향받는 노드는 `INHERITED` REGRESSION 으로만 참조한다.
- 기준 V 상속 근거: 없음. REGRESSION 출처 — `0325:V1 rev 4 + ΔV1 + ΔV2@d868468`(`main` 조상 확인) · `0324:V1 rev 4.9@22a6d06`(0325 메타가 `origin/main` 조상으로 확인) · `0326:V1 rev 7`(설계 `5b489f8` — 작업 브랜치 해시, `main` 미병합 · 착수 때 0326 PASS 좌표로 바꾼다, D-003).
- `SUPERSEDED` 로 분해한 pair 의 AC·선택 적대 증거 이관: 해당 없음 — rev 2·rev 3 은 pair 를 분해하지 않았다(rev 3 은 VP-51 을 더했다). V1 VP-34 의 적대 증거(나란히 `\t` → `\n` 변이)는 D-029 로 행 문자열 생성이 없어져 대상이 사라졌다 — 폐기 근거: 복사 문자열을 Chromium 이 만든다(D-029). 대신 VP-34 는 끝점 칸 맞바꿈 변이를 고른다.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | Git 리뷰 본문 — AC8~AC14·AC16·AC17·AC34 | NEW | — |
| R-02 | R | 도구 카드 긴 본문 — AC18~AC20·AC32·AC33 | NEW | — |
| R-03 | R | 코드 줄 번호·가상 코드 보기 — AC21·AC22 | NEW | — |
| R-04 | R | 산출물 Markdown·회귀 — AC23~AC25 | NEW | — |
| R-05 | R | 스트리밍 꼬리 — AC26·AC27 | NEW | — |
| R-06 | R | 공통 워커 요청 규약·레인·작업 상한 — AC1~AC7·AC31·AC36 | NEW | — |
| R-07 | R | 측정·Windows 기록 — AC29·AC30 | NEW | — |
| R-08 | R | 의존성·경계 — AC28 | NEW | — |
| R-09 | R | 선택 복사 — AC15·AC35 (rev 2) | NEW | — |
| AT-01~AT-09 | AT | 위 R 의 AC 묶음 | NEW | — |
| SD-01 | SD | 문서 수명 — 임차 → 첫 작업 전 전송 → 해제 → 지연 닫기 · 워커 교체 재전송 · 상한 초과 → 회복 | NEW | — |
| SD-02 | SD | 범위 토큰 진행 — 요청 → 한 줄씩 전진 · 50ms `continue` → 범위 응답 · 다른 요청 끼어들기 · 승격·해제 · 테마별 체크포인트 · 분할 불가 작업 뒤 레인 대기·계측(rev 3) | NEW | — |
| SD-03 | SD | Git 본문 상호작용 — 펼침(자리) → 근접 계산 → 스크롤 → 문맥 펼침(보정) → 요구사항 이동 → 초안(핀) → 근처 이탈(핀만 · 계산 유지 — rev 3) → 접기(문서 해제) | NEW | — |
| SD-04 | SD | Markdown 문서·꼬리 — 블록 → 원문 자리 → Markdown 레인 → hast 교체 · 표 조각(행·칸·문자) · 상한·노드 예산 원문(rev 3) · 꼬리 합치기 | NEW | — |
| SD-05 | SD | 복사 — 끝점 기록 → 가져가기 판정 → 단위·조각 → 살핌·준비(rev 3) → 동기 마운트/호스트 직렬화 → 클립보드 (rev 2) | NEW | — |
| SD-06 | SD | Work 본문 — 실행 중(요청) → 결과 도착(응답) · 단일 스크롤 (rev 2) | NEW | — |
| ST-01~ST-06 | ST | 위 SD 의 종단 증거 | NEW | — |
| AR-01 | AR | 클라이언트 ↔ 워커 메시지 — `doc.open`·`doc.close`·작업·`continue`·`unknown-doc`·`range-too-large`(§10 EP-1~EP-4) | NEW | — |
| AR-02 | AR | 문서 참조 생산자 — 도메인 id + `revisionOf` → 소비 훅(EP-5·EP-16) | NEW | — |
| AR-03 | AR | 가상 행 훅 ↔ 소비자 여섯(Git 인라인·나란히 · DiffTable · VirtualCodeView · VirtualMarkdownView · Work 공유 스크롤)(EP-8·EP-11) | NEW | — |
| AR-04 | AR | hast 계약 — 워커 후처리 ↔ `MarkdownHast` components · 표 조각 합침 · 노드 예산 `tooLarge`(EP-12 — rev 3) | NEW | — |
| AR-05 | AR | 경계 가드·의존성 — 규칙 (b) 모듈 · 규칙 (i) · `package.json` · 문서(EP-14) | CHANGED | `app/scripts/ui-thread-rules.mjs:247-249` |
| AR-06 | AR | 레인 — 요청 종류 → 레인 → 레인 워커·대기열·등록부(EP-17) (rev 2) | NEW | — |
| AR-07 | AR | 0326 복사 통합 — 내부 목록 가져가기 ↔ `TranscriptViewport.handleCopy`·`CopySerializationHost`·`textOffset`(EP-20) (rev 2) · 블록 안 여러 목록 조각·조각 작업 준비 단계(rev 3) | CHANGED | `TranscriptViewport.tsx:413-553` · `CopySerializationHost.tsx` · `textOffset.ts` · `lib/transcript/viewport/copy.ts:31-44` |
| IT-01~IT-07 | IT | 위 AR 의 통합 증거 | NEW | — |
| MD-01 | MD | 짝 색인(EP-6) | NEW | — |
| MD-02 | MD | diff 보기 모델 — 원천 → 줄·짝·폭·축·증감·위치 색인 · 경로 판정(EP-7·EP-18) | NEW | — |
| MD-03 | MD | 체크포인트 토큰화 · 50ms 예산 · 줄 상한 · 빈 범위(EP-3 — rev 3) | NEW | — |
| MD-04 | MD | Markdown 문서 블록 rev 2 — 범위·끝 개행·합치기 다섯·정의·각주·표 조각·상한(EP-12 ①~③) · 조각 칸·문자 예산·열 상한·노드 예산(EP-12 ②③⑬ — rev 3) | NEW | — |
| MD-05 | MD | 복사 끝점·단위 — (목록, 행, 칸, 오프셋) · 조각 계획(EP-10) · 블록 안 여러 목록 조각·살핌(rev 3) | NEW | — |
| MD-06 | MD | 꼬리 상태 — 최신·합치기·접두·시작 이동·상한(EP-13) | NEW | — |
| MD-07 | MD | 요청 키 · 앵커 키 · 보기 키(EP-1 — rev 3) | CHANGED | `protocol.ts:55-72` |
| MD-08 | MD | 대기열 — 등급·양보 횟수·크기·`continue`·승격·취소 규칙 · 범위 검증 · 작업 계측(EP-4 — rev 3) | CHANGED | `client.ts:203-226` · 0324 규칙 `client.ts:5-12` |
| MD-09 | MD | `CodeBlock` 줄 번호 메모(EP-15) | CHANGED | `CodeBlock.tsx:92` |
| MD-10 | MD | 가상 행 범위 — 전부/가상/근처 판정 · 핀 · scrollMargin · 크기 보정 정책(EP-8 ①~⑥) · 근처 밖 DOM 해제·자리 높이 = 측정(EP-19 ④⑥ — rev 3) | NEW | — |
| MD-11 | MD | diff 보기 행·펼침·위치·문맥 = 현행 함수(`buildDiffHunks`·`expandGap`·`revealDiffHunkLine`·`toSideBySideRows`·`createDiffRequirementItem`)와 같은 결과(EP-7 ②~④) (rev 2) | NEW | — |
| MD-12 | MD | 보유·정리 — 체크포인트·색인·모델·파생 축·꼬리 캐시 제외(EP-23) (rev 2) · 모델 캐시 체류·재생성 · 보기 문서 파생(EP-23 ②③ — rev 3) | NEW | — |
| MD-13 | MD | 카드 동기 계산 상한·메모·접힌 본문 0(EP-21) (rev 2) · Work 단계 · 400줄 이하 Read 문자 무관(EP-21 — rev 3) | NEW | — |
| MD-14 | MD | 보기 문서 — 거터 제거 SSOT 이동 · 보기 키 · 워커 파생 보관 · `codeView`·`tokens` 보기 원천(EP-25) (rev 3) | NEW | — |
| UT-01~UT-14 | UT | 위 MD 의 국소 증거 | NEW | — |
| R-0324-CMP | R | 0324 계산 워커 실패·연속 실패·UI 대체 계산 없음(D-009) | INHERITED | `0324:V1 rev 4.9@22a6d06` — `client.test.ts` describe `'실패 (AC12)'` |
| R-0325-CAP | R | 0325 diff 문자 우선 상한·카드 머리 원문 예산(0325 VP-14~16) | INHERITED | `0325@d868468` — `inline.test.ts` |
| AR-0325-CACHE | AR | 0325 캐시 비용 = 키 + 워커 크기 · 미보관(0325 VP-18~20) | INHERITED | `0325@d868468` — `client.test.ts` describe `'캐시 비용 (0325)'` |
| R-0324-HL | R | 0324 코드 강조 — 스트리밍 생략·캐시 첫 렌더·취소·실패 원문(AC8) | INHERITED | `CodeBlock.compute.test.ts` 8건 |
| R-0211-GIT | R | Git 패널 — 파일 순서·접기·요구사항·좌우·공백 숨김·구문 색(0211·0218·0228) | INHERITED | `diffTile.render.test.ts` · `diffRequirementSelection.render.test.ts` · `fileDiffRequirementReveal.test.ts` · `diffSyntax.render.test.ts` · `diffHunks*.test.ts` · `diffViewport.test.ts` |
| R-ART | R | 산출물 보기 — HTML 격리·이미지·모드·다운로드 | INHERITED | `ArtifactPreviewContent.render.test.ts` · `ArtifactViewer.actions.test.ts` |
| R-0326-FENCE | R | 0326 열린 펜스 꼬리(AC28) | INHERITED | `0326:V1 rev 7` — `StreamingMarkdown.fence.test.ts` |
| AR-0326-VP | AR | 0326 transcript 공통 뷰포트 — 세 진입점 · features/chat `useVirtualizer(` 1(EP-10) | INHERITED | `0326:V1 rev 7` — 0326 VP-21(좌표는 0326 PASS 커밋) |
| R-0326-COPY | R | 0326 선택·복사 — 선택 마운트 집합 · 동기/조각 복사 · 직렬화 호스트 · 실패 보고(D-087·D-094) (rev 2) | INHERITED | `0326:V1 rev 7` — `TranscriptViewport.selection.test.ts` · `copy.test.ts`(좌표는 0326 PASS 커밋) |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 파일 펼침 → 계산 게이트 → `useDiffView`(동기 \| 워커) → `useVirtualRows` → 행 마운트 → `useDiffRowTokens` → 색 | AC8~AC14·AC16·AC17·AC34 좌표 — 하위 pair VP-12·VP-21·VP-22·VP-30·VP-31·VP-39 가 edge 마다 덮는다(아래 각 행) | required — 계산 게이트를 늘 여는 변이(ea1 red — 198파일 요청 0 단언) | EP-6·EP-7·EP-8 ⑦⑧·EP-9·EP-16·EP-18·EP-19·EP-24 공유 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 카드 펼침 → `DiffBody`/`FilePanel`/`FileBody`/`WorkToolBody` → 임계(줄 400 · 문자 — D-047) → `CodeBlock`·`DiffTable`·`VirtualCodeView` → `useVirtualRows` | `DiffTable.virtual.test.ts` dt1~dt5 · `longToolBody.render.test.ts` lb1~lb5 · `useDiffRowTokens.test.ts` rt6 · `workToolBody.virtual.test.ts` wk1~wk4 · `cardSyncCaps.test.ts` cs1~cs6·cs2a~cs2d·cs3b · `readBody.test.ts` rd1~rd3 | required — 임계 비교를 `>=` 로 뒤집는 변이(400행 → 가상, dt2 red) · 카드 복사를 마운트 행 문자열로 바꾸는 변이(lb5 red) · 400줄 이하 Read 에 문자 상한을 다시 거는 변이(cs3b red — `CodeBlock` 대신 워커) | EP-11 (6) · EP-21 ① |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `CodeBlock` 렌더 · `VirtualCodeView` → 줄 시작 색인(창 \| `codeView`) → 가시 줄 → `useWindowTokens` | `CodeBlock.render.test.ts` cb1 · `VirtualCodeView.test.ts` x1~x7 | required — 메모 deps 에 `theme` 을 넣는 변이(cb1 red) · 문자 상한 비교를 지우는 변이(x6 red — 창 색인 1) · `codeView` 결과 `charsBefore` 를 0 으로 고정하는 변이(x7 red) | EP-15 (2) · EP-8 ⑩ · EP-21 ⑤ |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 산출물 열기 → `ArtifactPreviewContent` 임계 → `VirtualMarkdownView` → 블록·조각(행·칸·문자 예산) → `markdown` 요청(Markdown 레인) → `MarkdownHast` \| `tooLarge` 원문 | `VirtualMarkdownView.test.ts` m1~m7 · `MarkdownHast.fidelity.test.ts` f1~f3·f3b · `ArtifactPreviewContent.render.test.ts` a4·a5 | required — 임계를 0 으로 바꾸는 변이(작은 문서도 워커 — a5 red) · 블록 파싱 전 원문 자리를 빈 값으로 바꾸는 변이(m2 red) · `tooLarge` 의 표 전체 원문 전환을 지우는 변이(m7 red — 앞 조각 hast 가 남는다) | EP-12 (13) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | delta → `StreamingMarkdown` → 임계 → `WorkerMarkdownTail` → `markdown` 요청 → `MarkdownHast` + 원문 꼬리 | `WorkerMarkdownTail.test.ts` s1~s10 | required — 접두 검사를 지우는 변이(s4 red) · 대기 요청 교체를 지워 delta 마다 요청을 쌓는 변이(s7 red) | EP-13 (7) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 소비 훅 → `request` → 키·범위 검증·레인·대기열·문서 → 워커 → 응답 → 소비 훅 · 작업 계측 | AC1~AC7·AC31·AC36 좌표 — VP-10·VP-11·VP-20·VP-25·VP-32·VP-36 이 덮는다(AC36 = VP-11 q11·q12·q13) | not selected — 하위 pair 가 고른다 | EP-1~EP-4·EP-17 공유 |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | `measure-ui-inputs.mjs --src` → K1~K13 / 설치본·진단 빌드 실기 | `measure-ui-inputs.test.mjs` K 케이스·재측정 케이스·k12 · 사람 기록(§19) | not selected — 측정 도구 | 0 — 제품 코드 강제 지점 없음 |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | 소스 → `check-ui-thread.mjs` → 규칙 (b)·(i) | `check-ui-thread.test.mjs` 신규 케이스 · gate `node scripts/check-ui-thread.mjs` | required — 규칙 (b) 모듈 목록에서 `remark-parse` 를 빼는 변이(신규 케이스 red) | EP-14 (6) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED (rev 2) | 선택 → 끝점 기록 → `onCopy` → 가져가기 판정 → 단위·조각(블록 안 여러 목록 · 살핌) → 준비(워커 창) → 동기 마운트 \| 호스트 직렬화 → 클립보드 | AC15·AC35 좌표 — VP-14·VP-26·VP-34 가 덮는다 · Chromium 문자열은 AC30 S-C8 | not selected — 하위 pair 가 고른다 | EP-10·EP-20 공유 |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | `useComputeDocument` 마운트 → `openDocument` → 첫 작업 → `ensureDocs` → `doc.open` → 작업 → 해제 → (실행 작업 끝) → `doc.close` · 상한 초과 → 회복 알림 · 워커 실패 → 재전송 | `client.documents.test.ts` d1~d9 | required — 워커 교체 때 전송 표시를 초기화하지 않는 변이(d3 red) · 지연 닫기를 지워 해제 즉시 `doc.close` 를 보내는 변이(d7 red) · 회복 알림을 지우는 변이(d8 red) | EP-2 (10) |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | `tokens` 요청 → 워커 한 줄씩 전진 → 50ms `continue` → 재대기(양보 +1) → 범위 응답 · 사이에 `highlight` · 승격 · 분할 불가 작업 뒤 대기 → 작업 계측(enqueue·start·end) | `client.queue.test.ts` q4·q9·q11·q12·q13 · `worker/tokens.test.ts` t5·t6 · 진단 다리 fx2 | required — `continue` 의 양보 횟수 증가를 지우는 변이(q4 red — 새 가시 작업이 밀림) · `startedAt` 기록을 `enqueue` 자리로 옮기는 변이(q11 red — 기록 대기 0) | EP-3 ③ · EP-4 ③⑥⑧ |
| VP-12 | SD-03 ↔ ST-03 | REQUIRED | 펼침(자리) → 근접 계산 → 스크롤 → gap 위쪽 펼침(보정) → 요구사항 이동 → 초안(핀) → 근처 이탈(핀만 · 계산 유지) → 접기 | `fileDiffVirtual.render.test.ts` v5~v8 · v5b·v5w·v6w·v7b·v7c · v12(접기 → 문서 해제) · `fileDiffExpandAll.render.test.ts` ea1·ea2·ea3 | required — 위쪽 펼침 보정의 `insertedAbove` 를 0 으로 고정하는 변이(v5 red) · `scrollToIndex` 를 지우는 변이(v6 red) · 핀의 근접 우선을 지우는 변이(v7b red) · 근처 이탈 때 행 해제를 지우는 변이(ea3 red — 지나간 파일 행 300) · 근처 이탈 때 계산 게이트를 닫는 변이(ea3 red — 다시 근처에서 빌드 2) | EP-9 (8) · EP-19 (6) · EP-24 (4) |
| VP-13 | SD-04 ↔ ST-04 | REQUIRED | 산출물 마운트 → 블록 → 원문 자리 → 근처 블록 `markdown`(visible·background) → 교체 · 표 조각 합침 · 상한·노드 예산 원문 · 문서 revision 변경 | `VirtualMarkdownView.test.ts` m2·m3·m5·m6·m7 · `MarkdownHast.fidelity.test.ts` f3·f3b | not selected — 직접 값 단언 | EP-12 ⑨~⑬ |
| VP-14 | SD-05 ↔ ST-05 | REQUIRED (rev 2) | `selectionchange` → 끝점 → `onCopy` → `claimCopy`/`isCopyClaimed` → `copyUnits`(살핌) → (동기 핀 마운트 → 선택 재적용 \| `startCopyJob` → `prepareChunk`(워커 창) → 호스트 마운트 → 직렬화 → `clipboard.write`) | `fileDiffVirtual.render.test.ts` v8·v8a·v8b·v8w · `transcriptCopyInner.test.ts` tc1~tc8 | required — `isCopyClaimed` 확인을 지우는 변이(tc1 red — 처리 2) · 조각의 행 범위를 한 칸 미는 변이(v8a red) · 조각 준비를 건너뛰는 변이(tc8 red — 빈 행 마운트) | EP-10 (7) · EP-20 (10) |
| VP-15 | SD-06 ↔ ST-06 | REQUIRED (rev 2) | `WorkToolBody` 마운트(요청) → 요청 문서 임차 → 결과 도착 → 응답 문서 임차 · 컨테이너 스크롤 | `workToolBody.virtual.test.ts` wk1~wk4 | required — 응답 revision 원천을 `call.input` 으로 바꾸는 변이(wk4 red) · Payload 에 자기 384px 스크롤을 주는 변이(wk1 red — 스크롤 요소 2) | EP-22 (4) · EP-5 ⑧⑨ |
| VP-20 | AR-01 ↔ IT-01 | REQUIRED | 클라이언트 `postMessage` → 실제 `createWorkerState().handle` → 응답 `parseResponse` → `receive` | `client.documents.test.ts` d4(실제 처리기 · `tokens` 왕복) · `worker/handler.test.ts` h6~h9(제어 메시지·`unknown-doc`·`continue`·shiki 옵션) | required — `parseResponse` 가 `continue` 를 형식 오류로 버리는 변이(d4 red) | EP-2 ⑥~⑨ · EP-4 ③ |
| VP-21 | AR-02 ↔ IT-02 | REQUIRED | 원천 객체 → `revisionOf` → `useComputeDocument`·`useDiffView` → `DocRef` → 요청 키 | `documents.test.ts` o1~o4 · `useDiffRowTokens.test.ts` rt3(같은 patch 객체 재펼침 → 같은 키 · 캐시) · `VirtualCodeView.test.ts` x5 · `VirtualMarkdownView.test.ts` m5 · `WorkerMarkdownTail.test.ts` s2 · `workToolBody.virtual.test.ts` wk4 | required — Git 문서 id 에서 공백 옵션을 빼는 변이(rt3b red) | EP-5 (15) · EP-16 ①~③ |
| VP-22 | AR-03 ↔ IT-03 | REQUIRED | 소비자 → `useVirtualRows({count, pins, scrollElement, fullUpTo, adjustScroll})` → TanStack `Virtualizer` → 항목 → 마운트 | `useVirtualRows.test.ts` u1~u7(실제 `@tanstack/virtual-core`) · 소비자 좌표 v1·v4·dt1·x1·m1·wk2 | required — `rangeExtractor` 에서 pins 합집합을 지우는 변이(u3 red · v7 red) · 근처 판정을 늘 참으로 하는 변이(v2 red) | EP-8 (12) |
| VP-23 | AR-04 ↔ IT-04 | REQUIRED | 워커 `markdownBlock` → hast(raw → text · 노드 계수) → `tooLarge` \| 구조화 복제 → `MarkdownHast`(urlTransform·components) · 표 조각 → 한 `table` | `MarkdownHast.fidelity.test.ts` f1~f3(f2 `javascript:` 링크 → 빈 href · data 이미지만 표시) · `worker/markdown.test.ts` mw1~mw6 | required — raw → text 치환을 지우는 변이(f1 red) · urlTransform 을 지우는 변이(f2 red) · 조각 합침에서 뒤 조각 thead 를 남기는 변이(f3 red) · 노드 예산 비교를 지우는 변이(mw6 red) | EP-12 ④~⑨·⑬ |
| VP-24 | AR-05 ↔ IT-05 | REQUIRED | = VP-08 경로 + `package.json`·문서 | VP-08 좌표 + EP-14 `rg` 결과 | VP-08 과 같음 | EP-14 (6) |
| VP-25 | AR-06 ↔ IT-06 | REQUIRED (rev 2) | 요청 → `laneOf(kind)` → 레인 워커 생성 → 레인 대기열·실행 중·등록부·실패 수 | `client.lanes.test.ts` l1·l2 | required — `laneOf` 가 `markdown` 을 계산 레인으로 보내는 변이(l1 red — highlight 가 기다림) | EP-17 (6) |
| VP-26 | AR-07 ↔ IT-07 | REQUIRED (rev 2) | 내부 목록 `claimCopy` → `TranscriptViewport.handleCopy` `isCopyClaimed` → 단위(블록 범위 \| 블록 안 조각 — DOM 순서 여러 목록 · 살핌) → `startCopyJob` `prepareChunk` → `CopySerializationHost` 내부 행 → `textOffset` 건너뛴 글자(모델 소유자 값) | `transcriptCopyInner.test.ts` tc1~tc8 · `textOffset.test.ts` to1·to2 | required — `data-virtual-skip-chars` 합산을 지우는 변이(to1·tc4 red) · 거터 chrome 표지를 지우는 변이(to2 red) · 블록 목록 순서를 등록 순서로 바꾸는 변이(tc6 red — 요청 목록을 다시 마운트하면 등록 순서가 뒤집힌다) | EP-20 (10) |
| VP-30 | MD-01 ↔ UT-01 | REQUIRED | `buildCounterparts(lines)` | `diffView.test.ts` cp1·cp2 | required — 추가 줄 짝의 `removedStart + offset` 을 `removedEnd − offset` 으로 바꾸는 변이(cp1 red) | EP-6 (2) + 음성 1 |
| VP-31 | MD-02 ↔ UT-02 | REQUIRED | `buildDiffView(source, options)` · 경로 판정 `diffViewPath` | `diffView.test.ts` p1~p3 · ax1~ax3(축 문서 = 현행 `axisText`) · ri1~ri4(위치 색인 = 현행 `diffRequirementMatchesLine` 전수 대조) · `useDiffView.test.ts` dv1 | required — 탭 폭을 1 로 바꾸는 변이(p1 red) · old 단독 위치 색인을 빼는 변이(ri2 red) · 동기 상한 비교를 `<` 로 바꾸는 변이(dv1 red — 5,000줄 경계) | EP-7 (5) · EP-18 (4) |
| VP-32 | MD-03 ↔ UT-03 | REQUIRED | 워커 `tokensRange(doc, lang, theme, start, end, clock)` | `worker/tokens.test.ts` t1~t8 | required — 체크포인트 grammarState 전달을 지우는 변이(t2 red) · 테마 키를 체크포인트 키에서 빼는 변이(t6 red) · 예산 비교를 지우는 변이(t5 red — 작업당 줄 = 전진 전부) · 결과 길이의 `max(0, …)` 를 지우는 변이(t7 red — 음수 길이) | EP-3 (7) |
| VP-33 | MD-04 ↔ UT-04 | REQUIRED | `markdownDocumentBlocks(source)` · 워커 정의 덧붙임 · 표 조각(행·칸·문자 예산) · 상한 판정 | `markdownDocumentBlocks.test.ts` mb1~mb11 · `worker/markdown.test.ts` mw2 | required — 블록 끝 개행 포함을 지우는 변이(mb6 red) · 열린 HTML 블록 1~5 합치기를 지우는 변이(mb7 red) · 각주 폴백을 지우는 변이(mb5 red) · 조각 칸 예산 비교를 지우는 변이(mb11 red — 넓은 표 조각 1) · 조각 문자 예산 비교를 지우는 변이(mb11 red — 큰 셀 표 조각 1) | EP-12 ①~③ |
| VP-34 | MD-05 ↔ UT-05 | REQUIRED | `rowEndpoint` → `copyUnits` | `rowSelection.test.ts` r1~r6 · `copyUnits.test.ts` cu1~cu6 | required — 나란히 끝점의 칸(old/new)을 맞바꾸는 변이(r4 red) · 조각 크기를 무시하는 변이(cu2 red) · 블록의 목록 배열을 첫 목록으로 접는 변이(cu5 red) | EP-10 (7) |
| VP-35 | MD-06 ↔ UT-06 | REQUIRED | `WorkerMarkdownTail` 상태 | `WorkerMarkdownTail.test.ts` s1~s5·s7·s10 | VP-05 와 같음 | EP-13 ②~⑦ |
| VP-36 | MD-07·MD-08 ↔ UT-07 | REQUIRED | `requestKey` · `requestSize` · 범위 검증 · `enqueue` · `setPriority` · `cancel` · 작업 계측 | `protocol.keys.test.ts` pk1~pk6 · `client.queue.test.ts` q1~q13·q8b | required — tokens 키에서 `revision` 을 빼는 변이(pk2 red) · 취소 규칙의 쌍 원천 조건을 지워 늘 워커를 끝내는 변이(q6 red) · `setPriority` 재정렬을 지우는 변이(q9 red) · `anchorsKey` 를 정렬하는 변이(pk6 red — 순서 바꿈이 같은 키) · 범위 검증의 `end < start` 항을 지우는 변이(q8b red) | EP-1 (10) · EP-4 (8) |
| VP-37 | MD-09 ↔ UT-08 | REQUIRED | `CodeBlock` plain 렌더 | `CodeBlock.render.test.ts` cb1 · 기존 `:'shows all line numbers for plain text before a grammar is available'` | VP-03 과 같음 | EP-15 (2) |
| VP-38 | MD-10 ↔ UT-09 | REQUIRED | `useVirtualRows` 범위 판정·크기 보정 정책 | `useVirtualRows.test.ts` u1~u7 | VP-22 와 같음 · u7 — 크기 보정 끔 정책을 무시하는 변이(u7 red — `scrollTop` 쓰기 1) | EP-8 ①~⑥ |
| VP-39 | MD-11 ↔ UT-10 | REQUIRED (rev 2) | `diffViewRows`·`diffViewLocate`·`diffViewContext`(펼침 범위 재생) | `diffView.test.ts` hx1(무작위 펼침·드러내기 연산 1,000열 재생 — 행 id·종류·범위·`canUp`·`canDown`·`insertedAbove` = 현행 `buildDiffHunks`/`expandGap`/`revealDiffHunkLine`) · sb1 · cx1 · lc1(위치 = 현행 `findIndex`) · lc2(결과 순서 = 앵커 순서 — rev 3) | required — gap 방향(`canUp`) 계산을 뒤집는 변이(hx1 red) · 드러내기 문맥 3 을 0 으로 바꾸는 변이(hx1 red) | EP-7 ②~④ |
| VP-48 | MD-12 ↔ UT-11 | REQUIRED (rev 2) | 워커 문서 닫기 → 파생 버림(보기 문서 포함) · 테마 사슬 2 · 모델 LRU 8 → 퇴거·교체 뒤 재생성 · 클라이언트 `cacheable: false` | `worker/handler.test.ts` h10(닫기 뒤 체크포인트·색인·모델·보기 문서 0) · h11(세 번째 테마 → 가장 오래된 사슬 버림) · h12(9번째 모델 뒤 첫 원천 재요청 → 빌드 2 · 교체 뒤 +1) · `client.documents.test.ts` d10(꼬리 결과 캐시 0) | required — 문서 닫기에서 체크포인트 삭제를 지우는 변이(h10 red) · 모델 LRU 퇴거를 지우는 변이(h12 red — 첫 원천 빌드 1) | EP-23 (5) |
| VP-49 | MD-13 ↔ UT-12 | REQUIRED (rev 2) | 카드 본문 → 줄 400 · 원천 문자 판정 → (창 파생 단계별 1회 메모 \| 워커) · 접힘 → 0 | `cardSyncCaps.test.ts` cs1~cs6·cs2a~cs2d·cs3b | required — 메모를 지워 렌더마다 파생하는 변이(cs1 red — 호출 10) · OpenCode 본문을 닫힘에도 렌더하는 변이(cs6 red) · Work 메모 키를 합성 응답 객체로 바꾸는 변이(cs2c red — 렌더마다 1) · 객체 문자열화 결과에 언어 판정을 다시 하는 변이(cs2a red — 판정 1) | EP-21 (6) |
| VP-51 | MD-14 ↔ UT-14 | REQUIRED (rev 3) | `FileBody` → 경로 판정(줄 400 · 문자 1,000,000) → (창 `stripLineNumberGutter` \| 워커 보기 문서) → `codeView({ view })`·`tokens({ view })` → 표시 줄·토큰 | `readBody.test.ts` rd1~rd3 · `worker/handler.test.ts` h13(보기 문서 토큰 = 거터 뺀 텍스트를 한 번에 `codeToTokens` 한 결과 · `codeView({ view })` 줄 = `stripLineNumberGutter` 결과 · 원천 닫기 뒤 보기 문서 0) · 기존 `lang.test.ts` 거터 3건(다시 내보내기 경로) | required — 토큰 요청 원천을 `{ doc }` 로 되돌리는 변이(rd2 red — 거터 글자 토큰) · `viewKey` 에서 transform 을 빼는 변이(pk6 red — 보기 키 = 문서 키) | EP-25 (5) |
| VP-40 | R-0324-CMP ↔ AT | REGRESSION | 워커 실패 → 대기 요청 → 연속 실패 차단(레인마다) · 문서 재전송은 VP-10 | `client.test.ts` describe `'실패 (AC12)'` 7건(문서 규약 뒤 그대로) | not selected | — |
| VP-41 | R-0325-CAP ↔ AT | REGRESSION | 카드 머리 증감 · 인라인 diff 상한 | `inline.test.ts` 전건 · `filePresentation.test.ts` | not selected | — |
| VP-42 | AR-0325-CACHE ↔ IT | REGRESSION | 응답 `size` → 캐시 비용 | `client.test.ts` describe `'캐시 비용 (0325)'` k1~k7 · `:'caches by the size the worker computed, without measuring on the UI thread'` — k5 는 `diffLines` 입력이 쌍 원천 `diffView` 로 바뀐다 | not selected | — |
| VP-43 | R-0211-GIT ↔ AT | REGRESSION | Git 패널 소형 fixture 경로(400행 이하 = 동기 경로·전부 렌더) | R-0211-GIT 기준선 출처 6파일 전건 | not selected — VP-22 v3 가 소형 경로를 잠근다 | — |
| VP-44 | R-0324-HL ↔ AT | REGRESSION | `CodeBlock` → `useHighlightedHtml` | `CodeBlock.compute.test.ts` 8건 | not selected | — |
| VP-45 | R-ART ↔ AT | REGRESSION | `ArtifactViewer` → `ArtifactPreviewContent` HTML·이미지 | `ArtifactPreviewContent.render.test.ts` 3건 · `ArtifactViewer.actions.test.ts` | not selected | — |
| VP-46 | R-0326-FENCE ↔ AT | REGRESSION | `StreamingMarkdown` 열린 펜스 | `StreamingMarkdown.fence.test.ts` | not selected | — |
| VP-47 | AR-0326-VP ↔ IT | REGRESSION | transcript 세 진입점 → `TranscriptViewport` | 0326 PASS 커밋의 0326 VP-21 좌표(착수 대조에서 실재 확인) · gate EP-8 검색 `rg -n "useVirtualizer\(" src/renderer/src/features/chat --glob '!*.test.*'` → 1 | not selected | — |
| VP-50 | R-0326-COPY ↔ AT | REGRESSION (rev 2) | 선택 마운트 집합 → 동기/조각 복사 → 호스트 → 실패 보고(가져가지 않은 이벤트) | 0326 PASS 커밋의 `TranscriptViewport.selection.test.ts`·`copy.test.ts` 전건(착수 대조에서 실재 확인) | not selected — VP-26 tc1 이 가져간 경로를 잠근다 | — |

`§10 강제 지점 전수`의 N 은 §10 `언제 강제`에 고정한 자리 목록의 수다. 하위 pair 가 상위 pair 를 덮는 경우 상위 path 의 edge 마다 덮는 좌표를 행에 적었다 — VP-01: 펼침·게이트·근처 이탈(ea1~ea3) → 모델(v9 · dv1) → 가상 행(v1·v4) → 상호작용(v5~v8) → 보정(sc1~sc3) → 토큰(rt1~rt8) → 색(v11). VP-09: 끝점(r1~r6) → 가져가기(tc1·v8b) → 단위(cu1~cu6·tc2·tc6·tc7) → 준비(tc8·v8w) → 마운트·직렬화(v8·v8a·tc5) → 오프셋(tc4·to1).

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 가드 5종 | `app/**` 수정 · 규칙 (b)·(i) 변경 · 측정 스크립트 추가 | `cd app && node scripts/check-migrations-appendonly.mjs && node scripts/check-doc-inventory.mjs --check && node scripts/check-product-naming.mjs && node scripts/check-test-budgets.mjs && node scripts/check-ui-thread.mjs` | 이번 변경이 만든 위반 |
| lint · typecheck | 새 파일·boundaries(shared 훅 · features import) | `npm run lint && npm run typecheck` | 0 error |
| 전체 vitest · node --test | 테스트 추가·수정 · 가드 테스트 | 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` | 변경 전(0326 PASS 커밋) 실패 집합과 차집합 ∅ + 환경 서명만 기준선(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| 번들·스모크 | 워커 번들 둘(계산·Markdown)에 remark 계열 · preload 무변경 확인 | `npx electron-vite build && node scripts/smoke-hosts.mjs && node scripts/smoke-preload.mjs out/preload` | 빌드 실패·스모크 실패 |
| 테스트 소스 규칙 | 새 테스트 파일 다수 | `git diff --name-only` 의 테스트 파일마다 `[test-pools]`·예산 가드 위반 0 (`app/AGENTS.md` 테스트 소스 규칙) | 이번 변경의 테스트 파일 |
| 문서 인벤토리 | TRD·AGENTS·실행 모델·카탈로그 수정 | `node scripts/check-doc-inventory.mjs --check`(링크·수치) | 이번 변경 문서 |
| message bus | plan·INDEX·커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱 0건 |

> 보안·데이터 무결성 제약: 산출물 HTML 격리(VP-45)·이미지 data URI 만 표시(VP-23 f2)·raw HTML 은 text(D-021)는 V node 에 귀속했다. 복사가 쓰는 클립보드 쓰기는 0326 의 기존 경로(`navigator.clipboard.write` · 실패 보고)다(VP-50).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 재현·측정 (Linux · Node v22.23.5 · esbuild 번들로 실제 소스 함수·컴포넌트 호출 · M1~M13 은 V1 세션 1회 예열 뒤 중앙값 · M13b~M21 은 rev 2 세션 1회 예열 뒤 5회 중앙값 — 3회·1회는 칸에 적음 · M22~M25 는 rev 3 세션, 같은 방식 — 회수는 칸에 적음)

| ID | 입력 | 관측 | 판정 |
|---|---|---|---|
| M1 | 추가 줄 5,000 / 20,000 / 50,000 · 현행 `counterpartOf`(`FileDiffSection.tsx:488-512` 본문 그대로)를 모든 행에 | 21.81ms / 319.15ms / 3,788.1ms(1회) · 같은 종류 묶음 시작까지 뒤로 걷기 12,497,500 / 199,990,000 / 1,249,975,000. 100줄 삭제 + 100줄 추가 반복 50,000줄은 14.04ms | 재현 — 묶음 길이의 제곱(D-012) |
| M2 | 같은 입력 · `renderToString(FileDiffSection)` 인라인 / 나란히 | 인라인 437.2 / 2,246.1 / 13,038.0ms(56.0MB · `<tr` 50,000) · 나란히 202.9 / 953.7 / 2,275.9ms. 순수 함수(50,000): `patchLinesToDiffLines` 1.78 · `buildDiffHunks(3)` 11.44 · 공백 접기 3.04 · `toSideBySideRows` 2.16 · 축 문자열(`diffTokensRequest`) 9.52 · 키 2.07ms(4,155,599자) | 재현 — 인라인 13.0s 중 짝 3.8s 를 뺀 약 9.2s 가 행 렌더다 |
| M3 | 50,000줄 · `structuredClone`(포트 전송과 같은 알고리즘) | 줄 객체 42.56ms · 이은 문자열(4,155,559자) 2.87ms · hunk 행 66.37ms · 200행 창 0.21ms · `JSON.stringify` 16.08ms | 행 모델을 워커로 보내는 비용 ≥ 창 계산(D-011) · 문서는 문자열로 보낸다(D-008 ②) |
| M4 | 같은 파일 · 워커 `compute(diffTokens)`(같은 처리기 · shiki JS 엔진) | 5,000줄 2,378ms · 20,000 10,411ms · 50,000 25,848ms(토큰 750,000 · `resultSize` 32,905,560 > 캐시 상한 → 미보관). 결과 복제 42 / 248 / 661ms · 창 대조 `mapDiffTokens` 3.3 / 12.4 / 47.9ms | 재현 — 워커 1개라 그동안 다른 요청 대기(D-014) |
| M5 | 32,000자 TS · `highlight` | 워커 167.6ms · HTML 233,387자 · span 6,000 | 강조 한 건의 상한 — T33(D-016) |
| M6 | 합성 Markdown(제목·문단·목록·표·펜스 반복) · `renderToString(Markdown)` · `unified` 파싱(remark-parse + remark-gfm + remark-rehype) | 0.10M자 583.9ms · 1.00M자 11,543.1ms. 파싱만 537 / 11,035ms(96%) · 최상위 hast 45,939 · 전체 hast 복제 716ms · 최상위 50개 창 복제 0.60ms | 재현 — 창 비용은 파싱(D-005) |
| M7 | `CodeBlock.tsx:92` 식(`Array.from({ length: code.split('\n').length }, …).join('\n')`) · `renderToString(CodeBlock plain showLineNumbers)` · `renderToString(DiffTable)` | 10,000줄 0.91ms · 100,000줄(4.18M자) 18.16ms · CodeBlock 100,000줄 SSR 20.1ms · DiffTable 500 / 5,000 / 50,000행 27.0 / 108.3 / 1,315.5ms | 줄 번호는 렌더마다 O(n)(AC21) · DiffTable 은 행 수에 비례(AC18) |
| M8 | shiki 1.29.2 · TS 2,000줄 · 200줄 조각마다 `getLastGrammarState` → 다음 조각 `grammarState` | 전체 한 번 987.7ms · 조각 이어 읽기 739.6ms · 결과 동일 `true`. 여러 줄 주석·템플릿이 경계를 넘는 600줄: 상태 이어 읽기 동일 `true` · 상태 없이 조각 `false`. light 상태로 dark 토큰화 → `ShikiError: Grammar state themes "github-light" do not contain highlight theme "github-dark"` | 체크포인트로 정확한 범위 토큰(D-014) · 체크포인트는 테마별 |
| M9 | 같은 2,000줄 · 두 테마 동시(`themes: { light, dark }`) | `codeToTokens` 1,958.1ms(단일 987.7) · `codeToHtml` 1,965.6ms(단일 889.8) · 토큰 `htmlStyle: {color, --shiki-dark}` | 두 테마 동시는 비용 2배(D-015) |
| M10 | 경로 200개(깊이 5) · `buildChangedFileTree` · `visibleTreeRows` | 0.37ms · 0.10ms · 평탄 행 499 | T23 현행 유지(D-017) |
| M11 | 990,044자 unified patch(15,049줄) · `unifiedDiffLines` | 2.8ms | B21 파싱 창 유지(D-018) |
| M12 | 꼬리 — loose list / 문단 2,000·4,000·8,000·20,000자 · `renderToString(Markdown)` · 파싱 · hast 복제 · hast → React 만(`toJsxRuntime`) | loose list 렌더 10.18 / 14.85 / 36.11 / 62.59ms · 파싱 3.97 / 6.18 / 14.49 / 40.40 · 복제 0.25 / 0.91 / 1.43 / 4.51. 문단 렌더 2.61 / 2.84 / 7.53 / 14.28. hast → React 만: loose 4,000 2.0ms(전체 18.8) · 20,000 3.0ms(53.0) · 100,000 22.1ms(250.0) | 4,000자 임계(D-019) · 워커 파싱 뒤 창은 hast 반영만(AC26) |
| M13 | `docs/**/*.md`(60KB 미만 717개) · `splitStableBlocks` 블록을 따로 그려 이은 결과 vs 전체 렌더(SSR 구분 주석 제외) | 태그 사이 공백만 무시 681 동일 · 공백 텍스트 노드 무시 688 → 참조 정의 덧붙임 +1 → 이어짐 합치기(들여쓴 블록·목록 표지 연속) +27 = 716 · 남은 1(`docs/spec/claude/agent-sdk/typescript.md`). 분할 비용 0.26M자 0.5ms(182블록) · 1.05M자 1.4ms(725블록). 실제 문서 블록별 렌더: 0326 plan 263K자 중앙값 0.95ms · p95 9.45 · 최대 144.9(표 한 블록 45,433자) · 첫 30블록 346ms | 블록 모델(D-020) · 큰 표 블록은 창이면 장기 작업 → 워커(D-005) |
| M13b | `docs/**/*.md` 717개(60KB 미만) · 블록을 원문 오프셋 범위로 바꿔 따로 그려 이은 결과 vs 전체 렌더 · 비교는 태그 경계 공백·SSR 구분 주석 제외(rev 2 정규화) | 규칙을 하나씩 더하며: 오프셋 범위 + 4칸 들여쓰기 합치기 682 → 첫 줄 공백 합치기 687 → 정규화 705 → 블록 끝 개행 포함 706 → 인접 HTML·열린 HTML 블록 1~5 합치기 **717/717**. 최소 재현 셋: ① `"* a\n* b\n</Warning>"` 는 `</Warning>` 가 목록 밖 raw, 끝에 `\n` 을 붙이면 둘째 항목 안(lazy continuation — micromark 의 입력 끝 처리) ② `<script … />` 뒤 문단·제목은 전체 렌더에서 HTML 블록 1 안(끝 표지 `</script>` 까지 raw) ③ 인접 최상위 HTML(`</CodeGroup>` 다음 `<Note>`)은 전체 렌더에서 한 줄로 흐르는 raw 텍스트 사이 공백 | 블록 규칙 rev 2(D-033) — V1 B10 의 남은 1건(`typescript.md`)은 ② 였다 |
| M14 | 추가만 · 혼합(삭제 100 + 추가 100 + 문맥 20 반복 · 공백만 다른 쌍 절반) 400~50,000줄 · 창 동기 파이프라인 = `patchLinesToDiffLines` + `buildDiffHunks(3)` + O(n) 짝 + 폭 + 축 문자열(현행 `diffTokensRequest`) | 합(추가): 400 0.16 · 2,000 0.72 · 5,000 1.59 · 10,000 3.22 · 20,000 6.72 · 50,000 17.93ms · 혼합 5,000 0.76 · 50,000 15.69ms(공백 접기는 따로 7.93ms). O(n) 짝 = 현행 `counterpartOf`(무작위 20,000 입력 불일치 0). 요구사항 매칭: 행마다 `filter`(현행 `FileDiffSection.tsx:607-610`) 5만 행 R = 200 25.93ms · 선택 `findIndex` 0.22ms. 단어 강조 전 행 34.84ms(혼합 5만) | 동기 상한 5,000줄(D-027) · 짝 O(n)(D-012) · 요구사항·단어 강조는 가시 행만 |
| M15 | 5,000 / 50,000줄 · `structuredClone`(포트 전송과 같은 직렬화) · `v8.serialize` 바이트(3회) | 줄 객체 복제 1.63 / 22.03ms(392,726 / 4,069,537B) · 줄 문서 문자열 만들기 0.27 / 2.50ms + 복제 0.08 / 0.83ms(172,785 / 1,827,785B) · 워커 문서 → 줄 색인 0.26 / 0.61ms · 200행 창 복제 0.09ms(22,062B) | 원천은 문자열 문서로 보내고 창은 행 창만 받는다(D-027) |
| M16 | 모두 펼치기 — 200파일 × 300줄(혼합) · 4 × 50,000줄(추가) · 펼친 파일 전부의 창 모델을 첫 paint 전에(V1 설계) vs 근처 파일만(3회) | 200 × 300: 전부 18.41ms · 축 문자 1,442,800 / 근처 2파일 0.12ms · 4 × 50,000: 전부 76.22ms · 축 문자 7,111,116 / 근처 1파일 20.14ms | 근접 계산(D-028) |
| M17 | shiki 1.29.2(JS 엔진) · TS(줄 ≈ 80자) · 거대 한 줄 JSON·minified JS · 줄 상한 옵션 | a: 2,000줄 한 번 843.7ms(0.422ms/줄) · 20 / 50 / 200줄 조각 이어 읽기 844.6 / 920.5 / 839.8ms · c: 한 줄씩 2,000회 831.3ms(0.416ms/줄). b(1회): minified JS 한 줄 1,000 / 2,000 / 5,000 / 20,000자 = 71.6 / 250.5 / 1,002.6 / 1,008.2ms(기본 줄 시간 500ms) · `tokenizeTimeLimit: 50` 이면 75.1 / 102.0 / 102.9 / 112.1ms · JSON 20,000자 80.8ms · `tokenizeMaxLineLength: 20,000` 이면 32,000~1,000,000자 한 줄 0.09~1.22ms(색 없는 한 토큰). 현행 `highlight` 32,000자 minified JS 한 줄 1,009.1ms · JSON 265.4ms. d: 체크포인트 50개(10,000줄) 힙 증가 466KiB | 한 줄씩 + 50ms 예산 · 줄 상한(D-031) · 체크포인트 보유(D-032) |
| M18 | 블록 하나 — 워커 파싱(`remark-parse` + `remark-gfm` + `remark-rehype`) · hast(위치 정보 뺀 전송 형상) 바이트 · 구조화 복제 · 창 hast → React + SSR(반영 대리) | 0326 plan 최대 블록(표 45,433자) 42.55ms · 211,709B · 1.82ms · 4.09ms / 합성 표 200K자 6,672ms · 2,645,240B · 51.75ms · 18.79ms / 합성 표 1M자 106,442ms · 12,665,088B · 376.2ms · 139.9ms / 각주 문서 305K자 591.9ms · 3,880,512B · 66.0ms · 39.7ms / 각주 1.16M자 2,940ms · 14,635,333B · 315.4ms · 184.7ms. b(1회 · 25K / 50K / 75K / 100K자): 표(서식 칸) 113.5 / 291.4 / 515.1 / 893.1ms · 표(일반 칸) 179.4 / 560.2 / 1,194.7 / 2,865.3ms · loose 목록 52.3 / 97.6 / 130.5 / 234.7ms · 긴 문단 72.0 / 197.2 / 349.0 / 495.9ms | 표는 행 수에 초선형 · 상한 원문 · Markdown 레인(D-033·D-034) |
| M18c | 표 행 수(1회) · 머리·구분 행을 반복한 200행 조각 파싱 | 100 / 200 / 400 / 800 / 1,600행 = 일반 칸 19.5 / 35.0 / 64.4 / 220.8 / 1,773.3ms · 서식 칸 17.4 / 29.7 / 88.5 / 285.3 / 1,074.9ms · 1,600행을 200행씩 = 248.4 / 295.9ms · tbody 행(공백 텍스트 노드 제외)·thead 가 한 번 파싱과 같음 `true` | 표 조각 200행 · 창이 한 표로 합침(D-033) |
| M19 | 스트리밍 꼬리 — loose list 0 → 100,000자 · delta 50자(2,001개) · delta 간격 30ms 가정(측정 아님) · 파싱 시간은 실측 보간 | 매 delta 전송 합 100,150,035자 · 한 작업씩 합치기 = 작업 1,333 · 전송 합 54,861,524자(문자열 복제 ≈ 0.7ns/자 — M3) · 꼬리 4,000 / 20,000 / 50,000 / 100,000자: 워커 파싱 7.1 / 19.2 / 47.0 / 100.3ms · hast 21,543 / 105,854 / 263,504 / 523,034B · 복제 0.21 / 1.15 / 2.74 / 5.68ms · 창 hast → React + SSR 0.08 / 0.44 / 1.01 / 2.20ms | 합치기 · 캐시 제외 · 50,000자 상한(D-035) |
| M20 | 카드 본문의 창 동기 계산(현행 위치 · 3회) | Read `stripLineNumberGutter`(렌더마다) 2,000줄 × 80자 0.44 · 2,000줄 × 2,000자(4.0M자) 2.65 · 50,000줄(4.4M자) 9.15ms · Work `workToolPayload`(렌더마다 · 요청·응답 각각) 1MB 문자열 4.62 / 객체 4.05 · 5MB 22.47 / 21.28ms · OpenCode `unifiedDiffLines` + `filter` 2회 4,000줄(313,821자) 1.13ms · 1,196,791자는 상한 밖이라 0(원문) · 구조화 패치 → `DiffLine` 5,000 / 50,000줄 0.62 / 6.89ms · 5MiB 줄 시작 색인 3.56 · 최장 줄 폭 9.92 · `split` 3.94ms · 객체 5MB `structuredClone` 52.25 vs `JSON.stringify(…, 2)` 21.53ms | 카드 동기 상한 1,000,000자 · 메모 · 큰 원천은 워커 · 객체 문자열화는 창 1회(D-037) |
| M21 | 같은 입력(추가만) — 창 동기 경로(모델) vs 워커 경로(창 = 문서 만들기 + 보내기 + 70행 창 받기 · 첫 행까지 = 거기에 워커 모델, 워커 대기 0 가정) | 400: 0.19 vs 0.07ms(첫 행 0.24) · 2,000: 0.47 vs 0.12(0.77) · 5,000: 1.81 vs 0.36(1.57) · 10,000: 2.22 vs 0.64(3.03) · 20,000: 4.26 vs 1.58(7.51) · 50,000: 12.98 vs 3.61ms(22.51) · 문서 12,984~1,827,785B · 창 5,110B. 워커 경로 첫 행은 메시지 왕복·상태 갱신으로 최소 한 프레임 늦고, 실행 중 작업이 있으면 한 작업(≤ 50ms + 한 줄)만큼 더 늦다 | 5,000줄 이하는 창 동기(첫 행 같은 프레임 · 점유 ≤ 1.81ms), 넘으면 워커(D-027) |
| M22 | 표 한 조각 — 큰 셀·넓은 표(rev 3 · 5회 · 파싱 = remark-parse + remark-gfm + remark-rehype · 반영 = 복제 hast → `toJsxRuntime` + SSR) | 기본 200행 × 5열 × 20자(23,459자) 45.0ms · 노드 3,627 · 152,915B · 반영 1.2ms / 큰 셀 200 × 3 × 1,000자(602,237자) 223.0ms · 노드 2,421 · 689,505B · 반영 1.1ms / 16 × 3 × 1,000자(48,213자) 11.5ms / 넓은 표 200 × 50 × 1자(40,994자) 2,540.1ms · 노드 29,993 · 1,119,077B · 복제 18.89 · 반영 8.1ms / 200 × 200(162,894자) 39,272.6ms · 노드 118,136 · 4,408,854B · 복제 109.84 · 반영 51.1ms / 20 × 200 260.2ms | 표 비용은 행 수가 아니라 칸 수에 초선형 · 큰 셀은 문자에 선형(D-045) |
| M22b | 칸 수·모양(3회 · 칸은 머리 칸 포함) | 칸 ≈ 1,000: 200 × 5 24.5 · 50 × 20 21.2 · 20 × 50 22.2 · 5 × 200 31.8ms · 머리 1,000 + 1행 1,000 = 2,000칸 112.0ms / 칸 ≈ 2,000: 400 × 5 63.9 · 40 × 50 67.8 · 10 × 200 73.6ms / 열 20 고정 행 50/100/200/400 = 21.5/57.3/206.7/1,291.8ms / 한 칸 50,000자 17.6 · 200,000자 77.8ms(노드 21) | 칸 1,000 조각이면 모양과 무관하게 ≤ 32ms · 넓은 행은 머리가 칸을 먹는다 |
| M22c | 1,000칸 조각으로 나눈 합 · 넓은 한 행 · 50,000자 비표 블록(3회 · 조각 1회) | 400 × 20 → 49행 × 9조각 합 208.6 · 최대 33.6ms(한 번 1,291.8) · 200 × 50 → 19행 × 11조각 합 254.7 · 최대 35.1ms(한 번 2,540.1) · 1행 × 250/500/1,000열 32.1/47.6/150.8ms · 머리만 500/1,000열 19.8/60.2ms / 비표 50,000자 — 산문 15.0ms · 노드 3 / 강조(`*a* `) 855.6ms · 노드 37,501 · 1,387,571B · 반영 35.6 / 인라인 코드 300.7 · 37,501 · 34.0 / 링크 371.5 · 21,430 · 23.0 / 촘촘한 목록 1,386.7 · 37,503 · 49.8 / 느슨한 목록 841.0 · 60,003 · 62.9ms | 조각 칸 예산 1,000 · 열 > 500 원문 · 노드 예산(D-045 · B2·B14) |
| M22d | 촘촘한 비표 블록 문자 수별(3회) | 촘촘한 목록 5,000/10,000/20,000/30,000자 = 71.6/121.4/300.1/487.0ms · 노드 3,753/7,503/15,003/22,503 · 반영 4.9/6.0/11.2/19.8ms / 강조 5,000/10,000/20,000/30,000자 = 23.9/42.4/227.6/506.1ms · 노드 3,751/7,501/15,001/22,501 · 반영 3.7/5.9/12.6/25.4ms / 느슨한 목록 10,000/20,000자 145.4/221.4ms · 노드 12,003/24,003 · 반영 8.1/21.2ms | 반영 ≈ 1ms/1,000 노드 — 노드 예산 20,000 ≈ 20ms(D-045) |
| M23 | 쌍 원천 jsdiff `diffLines`(jsdiff 9.0.0 · 3회 · 5,000 + 5,000 은 1회) — 계산 레인 분할 불가 작업 | 비슷한 두 본문(50곳 수정) 500/5,000/50,000줄 2.0/2.5/26.2ms · 전부 다른 500+500/1,000+1,000/2,000+2,000/5,000+5,000줄 23.5/96.4/368.2/2,909.0ms · 새 파일 50,000줄 38.2ms | 전부 다른 본문은 제곱 — 레인 대기에 상한이 없다(현행 `diffLines` 작업과 같다 · D-043 · B20) |
| M24 | Work payload 단계(5회 · 실제 `workToolPayload`) | 객체 1/5MB 문자열화 3.31/16.40ms(1,197,906/6,054,794자) · 문자열 1/5MB `JSON.parse` 1.79/8.20 · `workToolPayload(문자열)` 1.46/5.81 · `(객체)` 3.29/16.63 · text 배열 둘 잇기 + 판정 3.99/19.45 · 줄 시작 색인 1.36/5.13ms | 단계별 계수·상한(D-042) |
| M25 | Read 거터 제거 — 400줄 이하·큰 문자(5회 · 실제 `stripLineNumberGutter`) | 400줄 × 2,500자(1,003,199자) 0.47 · 400 × 10,000자(4,003,199자) 2.44 · 300 × 5,000자(1,502,399자) 0.74ms | 400줄 이하는 문자 수와 무관하게 창 1회(D-047 · 질의 7) |

재현 스크립트는 저장소에 두지 않았다(스크래치). 같은 입력을 K1~K13(WU-10)가 구현 트리와 0326 PASS 트리에서 다시 잰다. 시간 단언은 테스트에 두지 않는다 — 계수·문자열·마운트 수·주입 시계로 잠근다.

### 발견 / 제약

| ID | 발견 / 제약 | 근거 |
|---|---|---|
| F1 | 파일 분류(PR #643 P11) — **직접 수정**: `CodeBlock.tsx`(줄 번호 메모) · `StreamingMarkdown.tsx`(꼬리 분기) · 0326 복사 계약 넓힘 `TranscriptViewport.tsx`(가져간 이벤트 건너뜀 · 단위) · `CopySerializationHost.tsx`(내부 행 복원) · `textOffset.ts`(`data-virtual-skip-chars`) · `copy.ts`(단위 목록). **재사용(변경 0)**: `ToolCard.tsx`(`copyText(call)` · 접힘 미마운트) · `markdownBlocks.ts`(`splitStableBlocks`·`advanceStableBlocks`·`openFenceTail`). **통합 검증**: 위 0326 파일의 0326 테스트(VP-50) | `git diff --name-only origin/main..HEAD -- app`(0326 r1·r2 가 고친 파일) · V1 §11(`ToolCard`·`markdownBlocks` 는 재사용만) · rev 2 §11 |
| F2 | 0326 은 "features/chat 안 `useVirtualizer(` 1" 을 §10 EP-10 검색으로 잠근다 — 새 가상 행 훅은 `shared/ui/virtual/` 에 둔다 | `rg -n "useVirtualizer\(" src/renderer/src --glob '!*.test.*'` → 1(`TranscriptViewport.tsx:256`) · 0326 plan EP-10 |
| F3 | 계산 클라이언트 — 워커에 나간 요청 1 · 대기열 크기 순 · 같은 키 공유 · 실행 중 취소 + 대기 요청 → 워커 교체 · 연속 실패 3 차단 · 캐시 비용 = 키 + 워커 크기 | `client.ts:5-12` · `:203-208` · `:210-226` · `:109-125` |
| F4 | diff 구문 토큰 요청은 크기 상한이 없다 — 미지원 언어·빈 줄만 `null` · 축 문자열을 렌더 effect 마다 만든다 | `diffSyntax.ts:32-45` · `useDiffSyntax.ts:30-43` |
| F5 | 토큰 결과 대조(`row.map(content).join === line.text`)가 UI 스레드에서 축 줄 전부 | `diffSyntax.ts:47-64` |
| F6 | Git 패치는 전문맥이고 파일당 50,000줄 · 한 벌 200,000줄 · 파일 200 상한 | `ipc.ts:1438` · `git-diff-parse.ts:212`·`:215`·`:18` |
| F7 | Git 패널은 스크롤 소유자 하나(0211 D-073) · 모두 펼치기 메뉴가 있다 | `DiffReview.tsx:117-121` · `diffViewMenuItems.ts:41` |
| F8 | `FileDiffBody` 는 렌더마다 `diffLines.findIndex` · 행마다 `requirements.filter` · 나란히 보기는 렌더마다 묶음과 `toSideBySideRows` | `FileDiffSection.tsx:255` · `:610`·`:768` · `:703-726` |
| F9 | 위쪽 펼침 보정은 DOM 앵커 rect 와 꼬리 여백 · 요구사항 이동은 marker `querySelector` 후 `scrollIntoView` | `FileDiffSection.tsx:305-328`·`:330-350` · `diffViewport.ts` · `diffRequirementScroll.ts` · `:285` |
| F10 | Claude 도구 카드 본문은 높이 상한 없음 · OpenCode 파일 본문은 `max-h-[384px] overflow-auto` | `ToolCard.tsx:220-226` · `ToolBody.tsx:119-122` |
| F11 | 산출물 — 최대 5MiB · Markdown 미리보기는 `<Markdown source={result.content}>` · 기본 모드 text=code 그 외 preview · 뷰어 본문 스크롤 요소 | `artifacts/formats.ts:5` · `ArtifactPreviewContent.tsx:91` · `artifactViewerStore.ts:136` · `ArtifactViewer.tsx:127` |
| F12 | react-markdown 9.1.0 `post` — raw → text(skipHtml 거짓) · URL 속성 → `urlTransform` · `toJsxRuntime({ passKeys, passNode, ignoreInvalidStyle })`. 설치 버전: unified 11.0.5 · remark-parse 11.0.0 · remark-rehype 11.1.2 · hast-util-to-jsx-runtime 2.3.6(react-markdown 의 의존성) | `node_modules/react-markdown/lib/index.js` `post` · `package.json` |
| F13 | shiki 1.29.2 `grammarState`·`getLastGrammarState` · 상태는 테마별 | `@shikijs/types` d.mts `CodeToTokensBaseOptions.grammarState` · M8 |
| F14 | TanStack virtual-core 3.17.6 — `enabled`·`rangeExtractor`·`scrollMargin`·`measureElement`. 목록이 화면 밖이면 범위가 첫 항목 + overscan 이라 근처 판정이 따로 필요하다 | `virtual-core/dist/esm/index.js` `calculateRangeImpl` · `index.d.ts` `enabled` |
| F15 | 테스트 환경은 node · 컴포넌트 실행은 `renderHarness.testfixture.ts`(가짜 DOM·훅·rAF) · SSR + cheerio | `vitest.config` `environment: 'node'` · `shared/ui/renderHarness.testfixture.ts:1-14` |
| F16 | 측정 스크립트는 0325 I1~I9·F1~F5 · 0326 J1~J9 를 갖는다 | `app/scripts/measure-ui-inputs.mjs:32-923` |
| F17 | 테마 구독자는 둘 — `CodeBlock` · `useDiffSyntax` | `CodeBlock.tsx:103` · `useDiffSyntax.ts:19` |
| F18 | `Markdown` 은 `react-markdown` 기본(`remarkGfm`, rehype 플러그인 없음) · components 맵은 모듈 상수 | `Markdown.tsx:20-137`·`:150-161` |
| F19 | 0326 `handleCopy` 는 자식이 이미 처리한 이벤트인지 보지 않는다 — 가상화 중이고 선택이 기록돼 있으면 늘 처리한다(동기 = 범위 마운트 · 비동기 = `preventDefault` + 조각 작업) | `TranscriptViewport.tsx:413-421`·`:460-462` · S11 |
| F20 | `DiffTable` 거터(줄 번호 · ±)는 `select-none` 이지만 `data-transcript-chrome` 이 없다 — `partTextOffset` 은 chrome 만 건너뛰어 거터 글자를 오프셋에 센다 | `DiffTable.tsx:69-80` · `textOffset.ts:8-43` · S12 |
| F21 | 0326 복사 — 동기: `flushSync(setSyncCopyRange)` 뒤 선택 재적용 → 기본 복사 · 비동기: `startCopyJob` 이 블록 조각을 `CopySerializationHost`(`document.body` portal · `select-text`)에 마운트 → `Selection.toString()`·`cloneContents()` → 조각 텍스트를 `\n` 으로 이어 `navigator.clipboard.write`(text/plain·text/html) · 동기 상한 300블록 · task 예산 50ms | `TranscriptViewport.tsx:429-551` · `copy.ts:12`·`:113-115` · `CopySerializationHost.tsx:20-33` |
| F22 | Work 본문 — 250px `overflow-auto overscroll-contain` 컨테이너(`tabIndex=0`) 하나에 요청(입력이 있으면 결과 전에도)과 응답(없으면 실행 중 상태)이 있다. Payload 는 `CodeBlock` · `workToolPayload` 는 렌더마다 `JSON.parse`(문자열)·`JSON.stringify(…, 2)`(객체) | `WorkToolBody.tsx:44-51`·`:52-57`·`:105-110`·`:16-31` · `workToolPresentation.ts:162-175` |
| F23 | Read 본문은 렌더마다 `stripLineNumberGutter(output)` 을 부른다(메모 없음 · 원문 전체 split·정규식) | `FileBody.tsx:20` · `lang.ts:34-40` |
| F24 | OpenCode `FilePanel` 은 `<details>` 안에서 `open` 과 무관하게 본문(`DiffTable` 전 행)을 렌더하고, 증감 수를 렌더마다 `filter` 2회로 센다 | `ToolBody.tsx:88-143`·`:79-80` |
| F25 | Claude 구조화 패치 → `patchLinesToDiffLines(fileEditPatchLines(hunks))` 는 크기 상한이 없다 · 쌍 diff 는 상한 밖이면 워커 `diffLines` 가 `DiffLine` 전체를 창으로 돌려준다(5만 줄 줄 객체 복제 22ms — M15) | `DiffBody.tsx:56-62` · `useDiffLines.ts:23-29` · `handler.ts:33-34` |
| F26 | Claude 도구 카드 본문은 `detailBody \|\| open \|\| bodyMounted` 일 때만 마운트된다 — 한 번도 열지 않은 카드는 본문 0 | `ToolCard.tsx:256` |
| F27 | 요구사항 생성은 `DiffLine` 전체 배열 + 색인을 받는다 — 앞뒤 문맥 3줄과 `hunkHeader`(창 밖으로 뒤로 걷는 `rangeStart` 포함) | `diffRequirements.ts:74-111`·`:113-170` · `FileDiffSection.tsx:61-65` |
| F28 | shiki `tokenizeMaxLineLength`(기본 0 — 상한 없음)·`tokenizeTimeLimit`(기본 500ms — 줄마다) — 상한 이상 줄은 색 없는 한 토큰이고 상태는 앞 줄 것을 잇는다 | `@shikijs/types/dist/index.d.mts:405-415` · `@shikijs/core/dist/index.mjs:818-864` |
| F29 | jsdiff 9.0.0 은 `timeout`·`maxEditLength` 를 지원한다(넘으면 `undefined`) — 0327 은 쓰지 않는다(D-024 워커 교체 유지 · 결과 바뀜을 피함) | `node_modules/diff/libesm/types.d.ts:28-41` |
| F30 | 0326 진단 다리 `window.__ooDev`(`VITE_OO_DIAGNOSTIC=1` 일 때만) — `loadFixture(claude-code·claude-work·opencode)`·`setVirtualization`·`selectBlocks`·`readClipboard`·`failCopyChunk`·`streamFixture` | `transcriptFixtures.ts:1-6`·`:120-133` |
| F31 | shiki 시간 상한 — `vscode-textmate` `_tokenizeString` 은 규칙 일치(`scanNext`) 사이에서만 `Date.now() − startTime > timeLimit` 을 보고 넘으면 멈춘 지점의 stack 을 돌려준다(한 줄이 상한을 넘을 수 있다) · `@shikijs/core` `_tokenizeWithTheme` 은 마지막 토큰을 줄 끝(`line.length`)까지 늘리고 멈춘 지점의 stack 으로 다음 줄을 잇는다 · 길이 상한 줄은 색 없는 한 토큰이고 stack 을 바꾸지 않는다(결정적) | `node_modules/@shikijs/vscode-textmate/dist/index.js:1812-1818` · `node_modules/@shikijs/core/dist/index.mjs:846-853`·`:864-868`·`:929` |
| F32 | 한 transcript 블록은 도구 카드 여럿을 담는다 — tools 세그먼트의 호출마다 part key(블록 키 = 첫 호출) · 블록 wrapper 가 첫 part key 를 달아 part 오프셋은 블록 안 모든 카드의 chrome 밖 글자를 센다 | `claudeBlocks.ts:232-245` · `TranscriptViewport.tsx:707` · `textOffset.ts:49-85` |
| F33 | 0326 조각 작업 훅은 동기 `mountChunk`·`serializeChunk`·`unmountChunk` 뿐이다 — 마운트 전에 데이터를 기다리는 단계가 없다 | `lib/transcript/viewport/copy.ts:31-44`·`:135-172` |
| F34 | Work 본문은 렌더마다 상태(`workToolPresentation(call).status` — ReadMcpResourceDirTool·Artifact watch 이면 결과 `JSON.parse`) · 검색 결과(WebSearch 이면 `JSON.parse`·`wireLinks`) · payload 둘을 계산한다 · Task 도구 응답은 렌더마다 새 합성 객체 `{ structuredOutput, output }` | `WorkToolBody.tsx:38-39`·`:43-46` · `workToolPresentation.ts:51-55`·`:57-79`·`:199-209` |
| F35 | 거터 제거 SSOT 는 features(비공백 줄 전부가 거터 꼴일 때만 제거)라 워커 구역(`shared/compute/worker/`)이 import 할 수 없다(4-layer) · 기존 테스트 3건 · Read 카드 복사 = 거터 포함 원문 | `features/chat/lib/lang.ts:33-40` · `lang.test.ts:20`·`:25`·`:30` · `toolCopyText.ts:28-31` |
| F36 | Git 요구사항 개수 상한 없음 — `diffRequirements.ts` 의 상한 상수는 문맥 줄 글자(`CONTEXT_LINE_LIMIT` 200)·의견 글자(`COMMENT_LIMIT` 2,000)뿐 | `diffRequirements.ts:9-11` · `rg -n "REQUIREMENT.*MAX\|requirements.length >" src/renderer/src --glob '!*.test.*'` → 표시 조건 2줄뿐 |

### 전수 조사 (`app/` · AS-IS `de270fe` · S11~S17 은 `2707d71`)

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| S1 계산 클라이언트 호출 | `rg -n "computeClient\(\)" src/renderer/src --glob '!*.test.*'` | 5 | 정의 1(`client.ts:263`) · `useHighlightedHtml` 2 · `useDiffLines` 1 · `useDiffSyntax` 1 |
| S2 `diffTokens` | `rg -n "diffTokens" src/renderer/src --glob '!*.test.*'` | 10 | `useDiffSyntax` 2 · `diffSyntax` 2 · `protocol` 5 · `handler` 1 — TO-BE 0(EP-16 ⑤) |
| S3 `DiffTable` 호출 | `rg -n "<DiffTable" src/renderer/src --glob '!*.test.*'` | 3 | `DiffBody.tsx:86`·`:105` · OpenCode `ToolBody.tsx:124` |
| S4 `CodeBlock` 호출 | `rg -n "<CodeBlock" src/renderer/src --glob '!*.test.*'` | 5 | `StreamingMarkdown:23` · `Markdown:134` · `WorkToolBody:29` · `FileBody:19` · `ArtifactPreviewContent:77` |
| S5 `useVirtualizer(` | `rg -n "useVirtualizer\(" src/renderer/src --glob '!*.test.*'` | 1 | `TranscriptViewport.tsx:256` — TO-BE 2(+ `shared/ui/virtual/useVirtualRows.ts`) |
| S6 테마 구독 | `rg -n "subscribeTheme" src/renderer/src --glob '!*.test.*'` | 5 | 정의 1 · import 2 · 사용 2 |
| S7 `<Markdown` 호출 | `rg -n "<Markdown\b" src/renderer/src --glob '!*.test.*'` 중 `Markdown.tsx` 제외 | 12 | 0327 이 바꾸는 곳은 `ArtifactPreviewContent:91`(임계 분기) · `StreamingMarkdown:57`(임계 분기) 둘뿐 |
| S8 `counterpartOf` | `rg -n "counterpartOf" src/renderer/src --glob '!*.test.*'` | 2 | 정의 `:488` · 호출 `:652` — TO-BE 0(EP-6 음성) |
| S9 diff 구문 소비 | `rg -n "useDiffSyntax\(\|DiffSyntaxContext" src/renderer/src --glob '!*.test.*'` | 7 | `DiffTable` 1 · `FileDiffSection` 3 · 훅 3 — TO-BE `useDiffRowTokens` 로 대체 |
| S10 `client.test.ts` 케이스 | `grep -c "^\s*it(" src/renderer/src/shared/compute/client.test.ts` | 29 | 1건(`:269`)의 입력만 diffLines 로 바꾼다(D-024) |
| S11 `handleCopy` 의 자식 처리 확인 | `rg -n "defaultPrevented\|isCopyClaimed\|claimCopy" src/renderer/src/features/chat/components/transcript --glob '!*.test.*'` | 0 | F19 — TO-BE `isCopyClaimed` 1(EP-20 ②) |
| S12 chrome 표지 | `rg -n "data-transcript-chrome" src/renderer/src --glob '!*.test.*'` | 8 | 표지 자리 4(`CodeBlock` 2 · `ToolCard` 1 · `WorkActivity` 1) + `textOffset.ts` 읽기 4(주석 2 · 코드 2) — `DiffTable` 0(F20) |
| S13 Read 거터 제거 | `rg -n "stripLineNumberGutter\(" src/renderer/src --glob '!*.test.*'` | 2 | 정의 1 · `FileBody` 1(렌더마다) |
| S14 Work payload | `rg -n "workToolPayload\(" src/renderer/src --glob '!*.test.*'` | 4 | 정의 1 · `WorkToolBody` 3(요청 1 · 응답 2) |
| S15 쌍 diff 훅 | `rg -n "useDiffLines\(" src/renderer/src --glob '!*.test.*'` | 3 | 정의 1 · `DiffBody` 1 · OpenCode `ToolBody` 1 — TO-BE 0(`useDiffView` 대체) |
| S16 내부 스크롤 높이 | `rg -n "max-h-\[250px\]\|max-h-\[384px\]" src/renderer/src/features/chat --glob '!*.test.*'` | 2 | OpenCode 384 1 · Work 250 1 |
| S17 워커 생성 | `rg -n "new Worker\(" src/renderer/src --glob '!*.test.*'` | 2 | `client.ts` 주석 1 · 호출 1 — TO-BE 호출 2(레인 둘 · EP-17 ②) |

### 수치 / 전칭 표현 검산

- 재측정 수치: M1~M13(V1 세션) · M13b~M21(rev 2 세션) · M22~M25(rev 3 세션 — 위 표). rev 3 조각 수 검산: 400 × 20 → 칸 예산 49행 → ⌈400 / 49⌉ = 9 · 200 × 50 → 19행 → ⌈200 / 19⌉ = 11 · 큰 셀 200 × 3 × 1,000자 → 행 ≈ 3,011자 · 16행 + 머리 ≈ 48,213자 ≤ 50,000 · 17행 > 50,000 → ⌈200 / 16⌉ = 13(AC31 mb11).
- 내역 합 = 총계: S1 5 = 1+2+1+1 · S2 10 = 2+2+5+1 · S6 5 = 1+2+2 · S9 7 = 1+3+3 · S12 8 = 2+1+1+4 · S14 4 = 1+3 · S15 3 = 1+1+1 · S17 2 = 1+1 · M13 716 = 688+1+27, 717 = 716+1 · M13b 717 = 706 + 11(HTML 규칙이 닫은 수 — 인접 HTML 10 · 열린 HTML 블록 1).
- "유일한" 반례 검색: "토큰화 호출부는 워커 `tokensRange` 하나" — TO-BE `rg -n "codeToTokens\(" src/renderer/src/shared/compute/worker --glob '!*.test.ts'` → `tokensRange` 안 1 + `highlight` 는 `codeToHtml`(EP-3). "tokens 요청을 만드는 곳은 `useWindowTokens` 하나" — TO-BE `rg -n "kind: 'tokens'" src/renderer/src --glob '!*.test.*'` → 1(EP-16). "`new Worker(` 는 `client.ts` 만" — S17 · 가드 규칙 (i)(EP-14 ⑥).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `client.test.ts:269`·`:288` · `CodeBlock.compute.test.ts` 8건 · `CodeBlock.render.test.ts:7` · `ArtifactPreviewContent.render.test.ts:16`·`:36`·`:48` · `StreamingMarkdown.fence.test.ts:42` 를 `grep -n "it("` 로 확인했다(V1). 0326 VP-21·0326 복사 테스트의 좌표는 0326 PASS 커밋에서 착수 대조(D-003) 때 확인한다 — 지금 실재하는 것은 EP-8 검색과 `TranscriptViewport.selection.test.ts`·`copy.test.ts` 파일(`ls src/renderer/src/features/chat/components/transcript/` · `lib/transcript/viewport/`)이다. 0325 §6-D T22·T14 행은 0325 plan 표에서 인용했다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`~`SD-06` · `AR-01`~`AR-04`·`AR-07`.
- 현재 책임 소유자: 계산 워커 1개 = 강조 HTML·diff 두 축 토큰·diff 줄(요청마다 본문 전체를 싣고 결과 전체를 돌려준다). 창 = Git 행 모델·짝 찾기·행 전부 렌더·토큰 대조, 도구 카드 행 전부·Read 거터 제거·Work payload 문자열화(렌더마다), 코드 줄 번호, 산출물·꼬리 Markdown 파싱, 복사(0326 — 블록 단위).
- 현재 entry → flow → consumer: Git 펼침 → `FileDiffBody` diff 줄·hunk(메모) → 렌더마다 `findIndex`·행마다 `requirements.filter`·`counterpartOf`(O(묶음²)) → 행 전부 `<tr>` → `useDiffSyntax` 가 축 문자열 전체로 `diffTokens` 요청 → 워커 전체 토큰화 → 결과 복제·`mapDiffTokens` → 색.
- 현재 오류/취소/정리: 효과 정리가 요청 취소 · 실행 중 취소 + 대기 요청 → 워커 교체 · 워커 실패 → 원문.
- 문제의 직접 원인: ① 행 DOM 이 줄 수에 비례(M2·M7) ② 짝 찾기 제곱(M1) ③ 토큰 요청이 문서 전체·상한 없음(M4) ④ Markdown 파싱이 창(M6·M12) ⑤ 요청 키가 내용 전체(M2 키 2.07ms) ⑥ 줄 수로 묶이지 않는 한 줄·표 비용(M17·M18c) ⑦ 카드 본문 파생이 렌더마다 원문 전체(M20) ⑧ 모두 펼치기가 펼친 파일 전부를 계산(M16).

```text
[펼침 · 카드 펼침 · 산출물 열기 · delta]
  → FileDiffBody / DiffTable / CodeBlock / <Markdown>        (행 전부 · 파싱 창 · 파생 렌더마다)
  → computeClient.request({ kind: 'diffTokens', oldText, newText })   (본문 전체 · 키 = 본문)
  → worker compute → codeToTokens(전체)                        (26s · 다른 요청 대기)
  → postMessage(rows 전체) → mapDiffTokens(전체) → 행 전부 색
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음 + `AR-05`·`AR-06`.
- 변경 후 책임 소유자: **계산 레인 워커** = 열린 문서 보관 · 범위 토큰(체크포인트 · 50ms 양보 · 줄 상한) · 강조 HTML(줄 상한) · 큰 diff 보기 모델(줄·짝·폭·파생 축·위치 색인 — D-027) · 큰 코드 보기 색인(`codeView`) · 파생 문서(거터 제거). **Markdown 레인 워커** = Markdown 블록·표 조각 파싱(hast). **창** = 원천·ID·revision 제공 · 문서 임차 · 작은 원천의 동기 모델(같은 순수 모듈) · 근접 판정·가시 행 마운트 · 마운트 창 요청 · hast → React · 스크롤 보정(요소마다 한 곳) · 복사(가져가기·단위·직렬화).
- 변경 후 entry → flow → consumer(Git): 펼침 → 계산 게이트(근접·선택·이동) → `useDiffView` 경로 판정 → (동기: `buildDiffView` 1회 | 워커: 줄 문서 임차 → `diffView` 창 요청) → `useVirtualRows`(근처 판정 → 가시 + overscan + 핀) → 마운트 행 렌더 → `useDiffRowTokens` → `useWindowTokens`(200줄 창마다 `tokens` · visible/background · 승격) → 클라이언트(레인 → `ensureDocs` → 작업) → 워커 `tokensRange`(한 줄씩 · 50ms `continue`) → 창 행 색.
- 변경 후 오류/취소/정리: 마운트에서 빠진 창은 대기 요청 취소 · 실행 중 `tokens` 는 다음 양보 지점에서 중단 · 그 밖 분할 불가 작업은 끝까지(캐시 규칙) · 쌍 원천 `diffView` 만 워커 교체(D-024) · 문서는 임차 0 이고 그 문서를 쓰는 작업 0 이면 `doc.close`(파생도 버림) · 워커 실패·교체 → 다음 작업 직전 재전송 · 결과 요청 키가 지금 키와 다르면 버림.
- 유지하는 기존 메커니즘: 캐시 비용(0325 D-038) · 연속 실패 차단(레인마다) · D-009 · 강조 상한 32,000자와 `useHighlightedHtml` · `inline.ts` 상한(0325 — `withinDiffCap`·`diffStatsWithinBudget`·`countLinesUpTo`) · 위쪽 펼침 보정 계획(`planUpwardExpansionCompensation`) · `revealDiffRequirement` · `collapseWhitespaceOnlyChanges`·`toSideBySideRows`·`changedWordSpan`(공용 모듈로 옮겨 그대로) · `splitStableBlocks`·`advanceStableBlocks`·`openFenceTail` · `createDiffRequirementItem` · `copyText(call)` · 0326 선택 마운트 집합·`startCopyJob`·`CopySerializationHost`. 제거/대체: `diffTokens`·`diffLines` 요청 종류 · `diffTokensRequest`·`mapDiffTokens` · `useDiffSyntax`(→ `useDiffRowTokens`) · `useDiffLines`(→ `useDiffView`) · `counterpartOf`(→ `buildCounterparts`) · 전 종류 실행 중 취소의 워커 교체(→ 쌍 원천 `diffView` 만) · 렌더마다 카드 파생(→ 원천당 1회 · 큰 원천 워커).

```text
[펼침 · 카드 펼침(>400) · 산출물 열기 · delta(>4,000자 꼬리)]
  → 계산 게이트(Git: 근접·선택·이동) · 원천 크기 판정(D-027 · D-037)
  → 작은 원천: 창 동기 — shared/compute/diffView · 줄 색인 1회(메모)
    큰 원천: useComputeDocument(id, revisionSource, payload) ── lease ──▶ client.openDocument(레인)
  → useVirtualRows(근처 판정 · 가시 + overscan + pins · 크기 보정 정책)
  → 마운트 행·블록만 렌더 (원문 먼저)
  → diffView / codeView 창 · useWindowTokens(200줄 창) · markdown(블록·표 조각) ── request(priority) ──▶ client
        client: laneOf → ensureDocs(doc.open 1회/레인 워커) → postMessage(작업 · 키 = id@rev·옵션·범위)
  → 계산 레인: tokensRange(한 줄씩 · 50ms continue · 줄 상한) / diffView 모델(revision·옵션마다 1) / codeView
    Markdown 레인: markdownBlock(hast · raw→text · 표 조각)
  → 창: 요청 키 대조 → 마운트 행 색 · 행 창 · MarkdownHast(components · urlTransform · 표 합침)
  → 복사: claimCopy(안쪽 목록) | TranscriptViewport·DiffReview(경계) → copyUnits → 동기 마운트 | 호스트 조각 직렬화
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 워커 1: 요청 본문 전체 계산 · 창: 행 전부·Markdown 파싱·Git 모델 | 계산 레인: 문서·범위·큰 diff 모델·코드 색인 · Markdown 레인: 블록 파싱 · 창: 작은 원천 모델·가시 행·hast 반영 | M2·M4·M6·M16·M21 · PR #643 P1·P7 | AR-01·AR-03·AR-04·AR-06 / VP-20·VP-22·VP-23·VP-25 · §11 WU-1·WU-3·WU-8 |
| data/control flow | 요청마다 본문 복제 · 결과 전체 복제 · 대기열 크기 순 | 문서 1회 전송 · 범위·행 창 결과 · 등급 → 양보 횟수 → 크기 · `continue` 재대기 · 승격 | M3·M4·M15 · P6 | SD-01·SD-02 / VP-10·VP-11 · `client.documents.test.ts`·`client.queue.test.ts` |
| state/contract | 요청 `{oldText,newText}` · 키 = 본문 · 응답 2종 | `DocRef`·파생 축 · 제어 메시지 2종 · 응답 3종(`continue`) · 키 = id@rev · 레인 2 | T15 잔여 · D-008 · D-034 | AR-01·AR-06 / VP-20·VP-25·VP-36 · `protocol.ts` |
| error/lifecycle | 실행 중 취소 → 워커 교체(전 종류) | 쌍 원천만 교체 · 지연 닫기 · 용량 회복 · `unknown-doc` 재시도 1 · 파생 보유 상한 · 범위 빈 결과·즉시 거부 · 모델 캐시 체류 | D-024·D-030·D-032·D-044·D-046 | SD-01·MD-12 / VP-10·VP-48 · d3·d7·d8·q6 |
| Git 렌더 | 행 전부 · 짝 O(n²) · 렌더마다 검색 · 펼친 파일 전부 계산 | 근접 계산 · 동기/워커 모델 · 가시 행(근처일 때만 — D-051) · 핀 · 보정 조정기 | M1·M2·M14·M16·F8 | SD-03·MD-01·MD-02·MD-11 / VP-12·VP-30·VP-31·VP-39 · `fileDiffVirtual.render.test.ts`·`fileDiffExpandAll.render.test.ts` |
| 도구 카드 | 행 전부 · 높이 상한 없음(Claude) · 렌더마다 파생 · 닫힌 OpenCode 도 렌더 | 400줄 초과 384px 가상 본문 · Work 단일 250px · 단계별 원천당 1회 · 400줄 초과 큰 원천 워커 · Read 보기 문서 · 접힘 0 | D-004·D-036·D-042·D-047·D-048 | R-02·SD-06·MD-13 / VP-02·VP-15·VP-49 |
| 산출물·꼬리 Markdown | 창 파싱 전체 | 4,000자 초과 → 블록 rev 2 · Markdown 레인 · 표 조각(행·칸·문자) · 상한·노드 예산 원문 · 꼬리 합치기 | D-005·D-006·D-019·D-033·D-035·D-045 | SD-04·AR-04·MD-04·MD-06 / VP-04·VP-05·VP-13·VP-23·VP-33 |
| 복사 | 0326 블록 단위(내부 목록 없음) | 안쪽 목록 가져가기 · 경계 = 바깥 한 번 · 블록 범위 \| 블록 안 조각(여러 목록 · 살핌 · 준비) · 끝점·건너뛴 글자(모델 소유자) · 결과 = 전체 마운트 Chromium 복사 | D-029·D-040·D-049·D-050 | R-09·SD-05·AR-07·MD-05 / VP-09·VP-14·VP-26·VP-34 |
| test seam/관측점 | SSR + 가짜 클라이언트(요청 기록) | + 가짜 워커 메시지 기록 · 실제 워커 상태 · 주입 시계 · `useVirtualRows` `initialRect` · react-markdown spy · 가짜 Selection/Range 기록 · 작업 계측 싱크 · 가짜 `IntersectionObserver` 근처 창 이동 | 계수 단언 | 각 VP 좌표 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/compute/protocol.ts` | 요청·응답·제어 메시지 형 · `docKey`·`axisKey` · `requestKey` · `requestSize` · `requestDocs` · `laneOf` · `parseResponse` | 요청 → 키·크기·문서 목록·레인 | client · worker · 소비 훅 |
| `shared/compute/client.ts` | 레인별 대기열·문서 등록부·전송·캐시·취소·실패 · `setPriority` · 지연 닫기 · 용량 회복 · 범위 검증 · 작업 계측 싱크 | 요청·임차 → 결과 promise | 소비 훅 |
| `shared/compute/documents.ts` | `revisionOf(source)` · `useComputeDocument(id, revisionSource, payload, lane)` | 원천 → `DocRef \| null`(임차·해제·회복 구독) | `useDiffView` · `VirtualCodeView` · `VirtualMarkdownView` · `WorkerMarkdownTail` |
| `shared/compute/diffView.ts`(신규 — 순수) | diff 보기 모델·행 창·위치·문맥·짝·폭·경로 판정(D-027 상한) | 줄·쌍 결과 → 모델 → 창 | `useDiffView`(창 동기) · `worker/state.ts`(워커) |
| `shared/compute/diffDisplay.ts`(이동) | `collapseWhitespaceOnlyChanges`·`toSideBySideRows`·`changedWordSpan`(현행 본문 그대로) | — | `diffView.ts` · `features/chat/lib/diffDisplay.ts`(다시 내보냄) |
| `shared/compute/gutter.ts`(이동 — rev 3) | Read 거터 제거 SSOT `stripLineNumberGutter`(현행 본문 그대로 — D-048) | 원문 → 거터 뺀 원문 | `FileBody`(창 메모) · `worker/state.ts`(보기 문서) · `features/chat/lib/lang.ts`(다시 내보냄) |
| `shared/compute/worker/state.ts`(신규) · `handler.ts` | 워커 문서 보관 · 파생(축·거터 제거·색인·모델) · 작업 분기 · 응답 · 닫기 정리 | 메시지 → 응답 | `compute.worker.ts` · `markdown.worker.ts` |
| `shared/compute/worker/tokens.ts`(신규) | 줄 시작 색인 · 체크포인트 · 한 줄씩 50ms 예산 · 줄 상한 옵션 | 문서·범위·시계 → 행 / `continue` | `state.ts` |
| `shared/compute/worker/markdown.ts`(신규) | 블록 텍스트 + 참조 정의 → unified → hast · raw → text · 표 조각 | 문서·범위·조각 → hast | `state.ts`(Markdown 레인) |
| `shared/compute/worker/markdown.worker.ts`(신규) | Markdown 레인 진입점 — 상태 하나 → `onmessage` | — | `client.ts`(레인 생성) |
| `shared/ui/virtual/useVirtualRows.ts`(신규) | TanStack 래퍼 — 전부/가상/근처 판정 · pins · scrollMargin · 측정 · 크기 보정 정책 | 개수·키·크기·스크롤 요소 → 항목 | Git 본문 2 · `DiffTable` · `VirtualCodeView` · `VirtualMarkdownView` |
| `shared/ui/virtual/copy.ts`(신규) | `claimCopy`·`isCopyClaimed` · `rowEndpoint` · `copyUnits`(블록 범위 \| 블록 안 조각 · 살핌) | 이벤트·DOM 선택·행 수 → 단위 | 가상 목록 소비자 · `TranscriptViewport` · `DiffReview` |
| `shared/ui/virtual/registry.ts`(신규) | 블록 안 가상 목록 등록 — 블록 키 → 목록 배열(목록 키 · 행 수 · 건너뛴 글자 · 행 준비 여부·준비 · 루트 요소 — DOM 순서) | 등록·해제·준비 | 가상 목록 소비자 → `TranscriptViewport` |
| `shared/ui/markdown/MarkdownHast.tsx`(신규) · `markdownComponents.tsx`(분리) | hast → React(같은 components · urlTransform) · 표 조각 합침 | hast → 요소 | `VirtualMarkdownView` · `WorkerMarkdownTail` · `Markdown`(components 공유) |
| `features/chat/hooks/useDiffView.ts`(신규 · `useDiffLines` 대체) | 원천 → 경로 판정 → 동기 모델 / 워커 창·위치·문맥 요청 · 상태(대기·실패) · 축 문서 참조 | 원천·옵션·id·revision → 행 창·요약·축 | `FileDiffBody` · `DiffTable` 소비자(`DiffBody`·`FilePanel`) |
| `features/chat/lib/markdownDocumentBlocks.ts`(신규) | 블록 rev 2 — `splitStableBlocks` 결과 → 범위·끝 개행·합치기·각주·표 조각·상한 판정 | 원문 → 블록 범위(+ 조각 · 원문 표시 표) | `VirtualMarkdownView` |
| `features/chat/hooks/useWindowTokens.ts`(신규) · `useDiffRowTokens.ts`(신규, `useDiffSyntax` 대체) | 마운트 줄 → 200줄 창 요청 · 등급·승격 · 키 대조 · 행별 토큰 | 문서(또는 파생 축)·마운트 → 토큰 | Git 본문 · `DiffTable` · `VirtualCodeView` |
| `features/chat/components/code/VirtualCodeView.tsx`(신규) | 가시 줄 · 가시 줄 번호 · 범위 토큰 · 큰 원천은 `codeView` · 자기 스크롤 또는 받은 스크롤 요소 | 원문 → 가상 목록 | `FileBody` · `WorkToolBody` · `ArtifactPreviewContent` |
| `features/chat/components/markdown/VirtualMarkdownView.tsx`(신규) · `WorkerMarkdownTail.tsx`(신규) | 블록 가상 목록 · 표 조각 · 원문 표시 · 꼬리 합치기 | 원문 → hast 표시 | `ArtifactPreviewContent` · `StreamingMarkdown` |
| `features/chat/harnesses/common/rightpanel/DiffReview.tsx` | 보정 조정기 · 파일 경계 복사 · 이동 대상 전달 | 파일 본문의 보정 요청 → `scrollTop` 1회 | `FileDiffSection` |

import 방향: `shared/*` 는 `shared` 안만 · `features/chat/*` 는 `shared` + 같은 feature(`src/renderer/AGENTS.md` 4-layer). 워커 구역(`shared/compute/worker/`)만 `shiki`·`diff`·`unified`·`remark-*` 를 값으로 import 한다(규칙 (b) — EP-14). `hast-util-to-jsx-runtime` 은 창(`MarkdownHast`)이 쓴다. `shared/compute/diffView.ts` 는 값 import 없이 `DiffLine` 형과 `diffDisplay.ts` 만 쓴다(창·워커 공용 — 도메인 요구사항 판정은 features 에 남는다).

## 10. 계약 / 타입 / 강제 지점

### 10-A. 계약 형

```ts
// shared/compute/protocol.ts
export interface DocRef { id: string; revision: number }            // id = 도메인 식별자(D-009) · revision ≥ 1
export type DiffSourceRef =
  | { kind: 'lines'; doc: DocRef }                  // 줄 문서 — 줄마다 표지 1글자(' '·'+'·'-') + 본문, 줄번호는 doc.open 의 lines
  | { kind: 'pair'; old: DocRef; new: DocRef }      // jsdiff (D-024 — 이 원천의 diffView 만 실행 중 취소 시 워커 교체)
  | { kind: 'patch'; doc: DocRef }                  // unified patch 문자열(OpenCode) — 1,000,000자 초과는 원천 판정에서 원문(현행)
export interface AxisRef { source: DiffSourceRef; ignoreWhitespace: boolean; axis: 'old' | 'new' }   // 워커 파생 축 문서
export interface ViewRef { doc: DocRef; transform: 'stripGutter' }                                    // 워커 파생 보기 문서(D-048) — 원천 문서가 닫힐 때 함께 버린다
export type TokenSource = { doc: DocRef } | { axis: AxisRef } | { view: ViewRef }                     // 정확히 하나
export const docKey = (ref: DocRef): string => `${ref.id}@${ref.revision}`
export const axisKey = (ref: AxisRef): string => `${sourceKey(ref.source)}|${ref.ignoreWhitespace ? 'w' : 'k'}|${ref.axis}`
export const viewKey = (ref: ViewRef): string => `${docKey(ref.doc)}|${ref.transform}`
export interface DiffViewOptions {
  ignoreWhitespace: boolean; layout: 'inline' | 'side-by-side'; highlightWords: boolean
  expansions: readonly (readonly [start: number, end: number])[]   // 드러낸 줄 범위(현행 expandGap·revealDiffHunkLine 의 결과와 같은 행을 만든다 — MD-11)
}
export type ComputeRequest =
  | { kind: 'highlight'; code: string; lang: string; theme: ComputeTheme }                                  // 현행 · code ≤ HIGHLIGHT_MAX_CHARS · 줄 상한 옵션(D-031)
  | ({ kind: 'tokens'; lang: string; theme: ComputeTheme; start: number; end: number } & TokenSource)  // 0 ≤ start ≤ end 정수 · end − start ≤ 200(D-044)
  | { kind: 'codeView'; source: { doc: DocRef } | { view: ViewRef }; start: number; end: number }        // 줄 [start, end) — 0 ≤ start ≤ end 정수 · end − start ≤ 400 · 400줄 초과 · 1,000,000자 초과 원천만(D-047 ②)
  | { kind: 'diffView'; source: DiffSourceRef; options: DiffViewOptions; start: number; end: number }      // 행 창 [start, end) — 0 ≤ start ≤ end 정수 · end − start ≤ 400(D-044)
  | { kind: 'diffLocate'; source: DiffSourceRef; options: DiffViewOptions; anchors: readonly { oldLine: number | null; newLine: number | null }[] }   // 키 anchorsKey = 요청 순서 그대로 · 결과 i = anchors[i](D-046)
  | { kind: 'diffContext'; source: DiffSourceRef; ignoreWhitespace: boolean; lineIndex: number }
  | { kind: 'markdown'; doc: DocRef; start: number; end: number; table?: { headerEnd: number; rows: readonly [number, number] } }  // 블록 하나 또는 표 조각
export type DiffViewRow =
  | { kind: 'line'; id: `line:${number}`; sourceIndex: number; line: DiffLine; wordSpan: WordSpan | null; oldAxis: number; newAxis: number }  // 축 줄 번호 −1 = 그 축에 없음
  | { kind: 'gap'; id: `gap:${number}:${number}`; start: number; end: number; canUp: boolean; canDown: boolean }
  | { kind: 'pair'; id: string; left: DiffViewCell | null; right: DiffViewCell | null }                   // 나란히 — 묶음별 toSideBySideRows 와 같은 짝
export interface ComputeResults {
  highlight: { html: string }
  tokens: { rows: TokenRows }                                   // rows.length = max(0, min(end, 줄 수) − start)(D-044)
  codeView: { lineCount: number; widthColumns: number; textChars: number; charsBefore: number; lines: string[] }   // charsBefore = 창 첫 줄 앞 줄 본문 글자 합(줄바꿈 제외 — 복사 건너뛴 글자, D-049)
  diffView: { summary: { rowCount: number; lineCount: number; added: number; removed: number; widthColumns: number; textChars: number }; charsBefore: number; rows: DiffViewRow[] }   // 행 본문 글자 = 줄 행 본문 · 짝 행 좌 + 우 · gap 0(D-049)
  diffLocate: { lineIndex: number[]; rowIndex: number[] }       // −1 = 없음 · 숨은 줄은 lineIndex ≥ 0 · rowIndex −1
  diffContext: { lines: DiffLine[]; offset: number; oldBefore: number | null; newBefore: number | null }   // createDiffRequirementItem 과 같은 앵커를 만든다(MD-11)
  markdown: { hast: HastRoot } | { tooLarge: true }            // raw 노드는 text 로 바뀐 뒤(D-021) · 노드 > MARKDOWN_HAST_MAX_NODES 면 tooLarge(D-045)
}
export type WireControl =
  | { type: 'doc.open'; ref: DocRef; text: string; lines?: { oldLine: Int32Array; newLine: Int32Array } }  // lines 는 줄 문서만(−1 = null)
  | { type: 'doc.close'; ref: DocRef }
export type WireRequest = ComputeRequest & { id: number }
export type WireResponse =
  | { id: number; ok: true; result: ComputeResult; size: number }
  | { id: number; ok: false; error: string }        // 'unknown-doc' = 워커에 그 문서가 없다
  | { id: number; ok: 'continue' }                  // 시간 예산에 닿았다 — 같은 작업을 다시 보낸다(AC4)
// 클라이언트가 즉시 내는 실패(워커 메시지 0): 'range-invalid'(정수 아님 · start < 0 · end < start) · 'range-too-large' · 'doc-unavailable'
export type Lane = 'compute' | 'markdown'
export function laneOf(kind: ComputeRequest['kind']): Lane            // 'markdown' → 'markdown' · 나머지 → 'compute'

// shared/compute/client.ts
export type Priority = 'visible' | 'background'
export interface ComputeJobTiming { kind: ComputeRequest['kind']; lane: Lane; priority: Priority; yields: number; key: string; enqueuedAt: number; startedAt: number; endedAt: number }
// createComputeClient(deps) — ClientDeps 에 createWorker(lane) · timings?(t: ComputeJobTiming) · now?() 를 더한다(D-043 — timings 는 진단 빌드만 연결 · 미지정이면 기록 0)
export interface ComputeHandle<R> { promise: Promise<R>; cancel(): void; setPriority(priority: Priority): void }
export interface DocumentLease {
  readonly ref: DocRef; readonly available: boolean
  onAvailable(listener: () => void): () => void   // 용량 회복 때 한 번
  release(): void
}
export interface ComputeClient {
  request<K>(request, options?: { priority?: Priority; cacheable?: boolean }): ComputeHandle<ComputeResults[K]>  // 기본 'visible' · cacheable true
  peek<K>(request): ComputeResults[K] | undefined
  openDocument(ref: DocRef, payload: { text: string; lines?: … }, lane: Lane): DocumentLease   // 같은 ref·레인은 임차 수만 는다
}

// shared/compute/documents.ts
export function revisionOf(source: object): number          // WeakMap — 같은 객체 같은 번호 · 새 객체 새 번호(단조)
export function useComputeDocument(id: string | null, revisionSource: object | null, payload: DocPayload | null, lane: Lane): DocRef | null

// shared/compute/diffView.ts (순수 — 창 동기·워커 공용)
export function diffViewPath(source: { lines?: number; chars: number; pair?: [string, string] }): 'sync' | 'worker'   // D-027 상한
export function buildDiffView(lines: readonly DiffLine[], options: { ignoreWhitespace: boolean }): DiffViewModel
export function diffViewRows(model: DiffViewModel, options: DiffViewOptions, start: number, end: number): ComputeResults['diffView']
export function diffViewLocate(model: DiffViewModel, options: DiffViewOptions, anchors): ComputeResults['diffLocate']
export function diffViewContext(model: DiffViewModel, lineIndex: number): ComputeResults['diffContext']
export function buildCounterparts(lines: readonly DiffLine[]): Int32Array
export function displayColumns(text: string): number

// features/chat/hooks/useDiffView.ts
export function useDiffView(source: DiffSourceInput | null, options: DiffViewOptions, docId: string, revisionSource: object): {
  status: 'idle' | 'loading' | 'ready' | 'failed'; summary: DiffViewSummary | null
  rows(start: number, end: number): readonly DiffViewRow[] | undefined   // 동기면 즉시 · 워커면 요청한 창의 결과
  requestRows(start: number, end: number, priority: Priority): void       // 워커 경로만 요청(동기면 무동작)
  locate(anchors): Promise<ComputeResults['diffLocate']>; context(lineIndex: number): Promise<ComputeResults['diffContext']>
  axes: { old: TokenDocRef | null; new: TokenDocRef | null }            // 동기 = 창 축 문서 · 워커 = AxisRef
}

// shared/ui/virtual/useVirtualRows.ts
export function useVirtualRows(options: {
  count: number; getItemKey(index: number): string; estimateSize(index: number): number
  scrollElement(): HTMLElement | null; pins?: readonly number[]; fullUpTo?: number   // count ≤ fullUpTo 이면 전부(근처일 때)
  nearViewportGate?: boolean                                                       // Git 파일 본문만 true
  adjustScrollOnResize?: boolean                                                   // 기본 true · Git 본문 false(보정 조정기 — D-038)
  onSizeChangeAbove?(delta: number): void                                          // adjustScrollOnResize 가 false 일 때 위쪽 측정 변화 보고
  initialRect?: { width: number; height: number }                                  // 테스트 이음새 — production 미지정
}): { listRef; items: readonly { index: number; start: number; size: number; key: string }[]; spacers: readonly { before: number; height: number }[]; measureElement; scrollToIndex(index: number, align?: 'center' | 'start'): void; visibleRange: { start: number; end: number } | null }

// shared/ui/virtual/copy.ts
export function claimCopy(event: { nativeEvent: Event } | Event): void            // 모듈 WeakSet<Event>
export function isCopyClaimed(event: { nativeEvent: Event } | Event): boolean
export interface RowEndpoint { listKey: string; row: number; side: 'old' | 'new' | null; charOffset: number }
export function rowEndpoint(root: Element, node: Node, offset: number): RowEndpoint | null   // [data-virtual-list] · [data-virtual-index] · [data-virtual-text][data-virtual-side]
export type InnerPos = { kind: 'blockStart' } | { kind: 'row'; list: number; row: number } | { kind: 'blockEnd' }   // list = 블록 안 목록 순번(DOM 순서 — D-049)
export type CopyUnit = { kind: 'blocks'; start: number; end: number } | { kind: 'probe'; index: number } | { kind: 'slice'; index: number; from: InnerPos; to: InnerPos }   // slice 의 마운트 행 합 ≤ chunkRows
export interface VirtualListEntry { listKey: string; rowCount: number | null; charsBefore(row: number): number | undefined; rowsReady(start: number, end: number): boolean; prepareRows(start: number, end: number): Promise<void>; root(): Element | null }   // rowCount null = 요약 전(준비 단계가 채운다)
export function copyUnits(lo: number, hi: number, lists: (index: number) => readonly VirtualListEntry[] | 'unknown', chunkRows: number, ends: { start: RowEndpoint | null; end: RowEndpoint | null }): CopyUnit[]   // 'unknown' = 뷰포트에 없는 블록 → probe 먼저

// features/chat/lib/transcript/viewport/textOffset.ts (0326 — 넓힘)
//   [data-virtual-skip-chars="N"] 요소는 그 안을 걷지 않고 N 글자로 센다 — partTextOffset·pointAtPartOffset 둘 다

// features/chat/lib/transcript/viewport/copy.ts (0326 — 넓힘)
//   CopyJobHooks 에 prepareChunk?(unit: CopyUnit): Promise<void> | void — mountChunk 앞에서 기다린다(task 밖 · D-049) · 블록 범위 호출(현행)은 그대로
```

- 상수 SSOT: `shared/compute/limits.ts` — `TOKENS_CHECKPOINT_LINES = 200` · `TOKENS_RANGE_MAX_LINES = 200` · `TOKENS_JOB_BUDGET_MS = 50` · `TOKENIZE_MAX_LINE_CHARS = 20_000` · `TOKENIZE_LINE_TIME_LIMIT_MS = 50` · `COMPUTE_DOC_MAX_CHARS = 32_000_000`(레인마다) · `DIFF_MODEL_SYNC_MAX_LINES = 5_000` · `DIFF_MODEL_SYNC_MAX_CHARS = 200_000` · `DIFF_VIEW_WINDOW_MAX_ROWS = 400` · `DIFF_MODEL_CACHE_ENTRIES = 8` · `TOKENS_THEME_CHAINS = 2` · `BODY_SYNC_MAX_CHARS = PATCH_INLINE_MAX_CHARS`(1,000,000) · `MARKDOWN_WORKER_MIN_CHARS = 4_000` · `MARKDOWN_BLOCK_MAX_CHARS = 50_000` · `MARKDOWN_TABLE_CHUNK_ROWS = 200` · `MARKDOWN_TABLE_MAX_ROWS = 2_000` · `MARKDOWN_TABLE_CHUNK_MAX_CELLS = 1_000` · `MARKDOWN_TABLE_CHUNK_MAX_CHARS = 50_000` · `MARKDOWN_HAST_MAX_NODES = 20_000` · `CODE_VIEW_WINDOW_MAX_LINES = 400`(rev 3). `shared/ui/virtual/limits.ts` — `VIRTUAL_BODY_MIN_LINES = 400` · `VIRTUAL_BODY_MAX_HEIGHT_CLASS = 'max-h-[384px]'`(OpenCode `ToolBody.tsx:119` 리터럴도 이 상수로) · `VIRTUAL_OVERSCAN = 20` · `VIRTUAL_ROW_ESTIMATE_PX = 20` · `VIRTUAL_COPY_SYNC_MAX_ROWS`·`VIRTUAL_COPY_CHUNK_ROWS`(K12 탐색값 — D-050 절차 · 두 상수는 같은 값 · 구현자가 상수 옆에 장비·값을 적는다 · 측정 전 기본 500).
- 문서 id 규칙(D-009 · D-036): Git 줄 문서 `git:${filePath}` + `revisionOf(section.patch)` · Git 동기 경로 축 문서 `git:${filePath}:${'old'|'new'}:${ignoreWhitespace ? 'w' : 'k'}` + 같은 revision · 카드 줄·patch 원천 `tool:${docKey}:${blockIndex}:src` + `revisionOf(구조화 패치 객체 | OpenCode file)` · 카드 쌍 `tool:${docKey}:${blockIndex}:${'old'|'new'}` + `revisionOf(call.input | OpenCode file)` · Read `tool:${toolUseId}:read` + `revisionOf(call.result)`(원문 문서 — 400줄 초과 표시·토큰은 보기 `{ doc, transform: 'stripGutter' }` · D-048) · Work 요청 `tool:${toolUseId}:work:request` + `revisionOf(call.input)` · Work 응답 `tool:${toolUseId}:work:response` + `revisionOf(call.result)` · 산출물 코드 `code:artifact:${publicationId}` + `revisionOf(result)` · 산출물 Markdown `md:${publicationId}` + `revisionOf(result)` · 꼬리 `tail:${인스턴스 번호}` + 꼬리가 바뀔 때마다 새 표지 객체의 `revisionOf`.
- 파생 축 문서(워커 경로): 창은 텍스트를 만들지도 보내지도 않는다 — 워커가 원천 모델에서 `axisKey` 로 만들고 원천 문서가 닫힐 때 함께 버린다(D-032).

### 10-B. 강제 지점

검색 명령은 `app/` 에서 실행한다. 자리마다 그 자리를 운반하는 줄이 1개 이상 잡히고, 출력의 모든 줄은 그 행의 자리 또는 "형 선언·import 줄"에 속한다(0325 D-046 과 같은 규칙). 음성 자리는 0건 명령으로 확인한다. rev 2 가 바꾼 행은 EP-1~EP-5·EP-7~EP-14·EP-16 이고 EP-17~EP-24 를 더했다. rev 3 이 바꾼 행은 EP-1·EP-3·EP-4·EP-10·EP-12·EP-13·EP-19·EP-20·EP-21·EP-23 이고 EP-25 를 더했다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| **EP-1** · MD-07 / VP-36·VP-06 | 요청 키 = 종류·문서 키·옵션·범위·앵커(AC1 · D-046·D-048) | `protocol.ts` | client | 자리 10 — ① `requestKey` highlight `['highlight', lang, theme, code]`(현행) ② tokens `['tokens', docKey \| axisKey \| viewKey, lang, theme, start, end]` ③ codeView `['codeView', docKey \| viewKey, start, end]` ④ diffView `['diffView', sourceKey, 공백, 배치, 단어, expansionsKey, start, end]` ⑤ diffLocate `['diffLocate', sourceKey, 공백, 배치, expansionsKey, anchorsKey]` — `anchorsKey` = 요청 앵커를 요청 순서 그대로 `${oldLine ?? '-'}:${newLine ?? '-'}` 로 써서 `,` 로 이음(정렬·중복 제거 없음 · 모듈 내부 함수) ⑥ diffContext `['diffContext', sourceKey, 공백, lineIndex]` ⑦ markdown `['markdown', docKey, start, end, tableKey]` ⑧ `docKey` ⑨ `axisKey` ⑩ `viewKey` = `${docKey}\|${transform}` | `rg -n "\['(highlight\|tokens\|codeView\|diffView\|diffLocate\|diffContext\|markdown)',\|export (const\|function) (docKey\|axisKey\|viewKey)" src/renderer/src/shared/compute/protocol.ts` → 10 | 키에 본문이 들어가면 창이 O(n) 키를 만든다(T15) · revision·옵션이 빠지면 바뀐 문서·옵션에 옛 결과 · 앵커를 정렬하면 결과 순번이 요청 순번과 갈린다 · 보기 키에 transform 이 없으면 원문 토큰이 거터 뺀 줄에 붙는다 |
| **EP-2** · AR-01·SD-01 / VP-10·VP-20 | 문서 수명(AC2) | `client.ts` · `worker/state.ts` | client · worker | 자리 10 — ① `openDocument` 레인 등록부 추가 + 상한 검사(`COMPUTE_DOC_MAX_CHARS` → `available:false` · 대기 목록) ② `ensureDocs` — 작업 `postMessage` 직전 미전송 문서마다 `{ type: 'doc.open' }`(파생 축 제외) ③ 임차 `release` → 임차 0 이고 그 문서를 쓰는 실행·대기 작업 0 이면 `{ type: 'doc.close' }`(아니면 그 작업이 끝날 때 다시 판정) ④ `dropWorker` → 그 레인 문서 `sent = false` ⑤ 등록부에 없는·`available:false` 문서 요청 → 즉시 `'doc-unavailable'`(워커 메시지 0) ⑥ 워커 `doc.open` → 보관 ⑦ 워커 `doc.close` → 삭제 + 파생 삭제 ⑧ 워커 작업의 문서 없음 → `{ ok: false, error: 'unknown-doc' }` ⑨ 클라이언트 `receive` `'unknown-doc'` → `sent = false` + 1회 재대기(두 번째는 실패) ⑩ 닫기로 용량이 돌아오면 대기 임차 `available` + `onAvailable` 알림 | `rg -n "'doc\.open'\|'doc\.close'\|'unknown-doc'\|'doc-unavailable'\|COMPUTE_DOC_MAX_CHARS\|sent = false\|onAvailable" src/renderer/src/shared/compute --glob '!*.test.ts'` | 새 워커에 문서가 없어 색이 영영 안 붙는다 · 해제 즉시 닫으면 실행 중 작업의 `continue` 가 문서를 잃는다 · 회복 알림이 없으면 상한을 한 번 넘은 문서는 끝까지 원문 |
| **EP-3** · MD-03 / VP-32·VP-11 | 범위 토큰 = 전체 토큰화와 같다 · 50ms 예산 · 줄 상한(AC3·AC4·AC31) | `worker/tokens.ts` · `handler.ts` | worker | 자리 7 — ① 줄 시작 색인(문서당 1회 · 지연) ② 체크포인트 사슬 키 `${lang}\|${theme}`(테마별) ③ 한 줄씩 고리 — 줄마다 `now() − started ≥ TOKENS_JOB_BUDGET_MS` 면 상태 저장 뒤 `'continue'` ④ `codeToTokens(line, { lang, theme, grammarState, tokenizeMaxLineLength: TOKENIZE_MAX_LINE_CHARS, tokenizeTimeLimit: TOKENIZE_LINE_TIME_LIMIT_MS })` ⑤ 200줄마다 `getLastGrammarState` → 사슬에 저장 ⑥ 결과 행 = `[start, min(end, 줄 수))` — `start ≥ 줄 수` 면 빈 배열(길이 `max(0, …)` — D-044) ⑦ `highlight` — `codeToHtml(code, { lang, theme, tokenizeMaxLineLength, tokenizeTimeLimit })` | `rg -n "codeToTokens\(\|codeToHtml\(\|getLastGrammarState\(\|TOKENS_JOB_BUDGET_MS\|TOKENS_CHECKPOINT_LINES\|TOKENIZE_MAX_LINE_CHARS\|TOKENIZE_LINE_TIME_LIMIT_MS\|'continue'" src/renderer/src/shared/compute/worker --glob '!*.test.ts'` | 상태 전달이 빠지면 여러 줄 주석·문자열 색이 틀린다(M8) · 예산이 없으면 26s 작업이 다른 요청을 막는다 · 줄 상한이 없으면 한 줄이 1s(M17) · 빈 범위 처리가 없으면 원천이 줄어든 뒤 늦은 창 요청이 음수 길이로 던진다 |
| **EP-4** · MD-08 / VP-36·VP-11 | 대기열 — 등급 → 양보 횟수 → 크기 → 도착 · `continue` 재대기 · 승격·해제 · 취소 규칙 · 범위 검증 · 작업 계측(AC3~AC6·AC36 · D-043·D-044) | `client.ts` | client | 자리 8 — ① 작업 크기 `requestSize(request, lengthOf)` — tokens = 범위 줄 × 평균 줄 길이 · diffView = 창 행 × 평균 줄 길이 · codeView = 창 줄 × 평균 · diffLocate = 앵커 수 × 16 · diffContext = 7 × 평균 줄 길이 · markdown = `end − start` · highlight = 현행 ② `enqueue` — (등급 `visible` 0 · `background` 1, `yields`, 크기, 도착) 오름차순 자리 ③ `receive` `'continue'` → `failures = 0` · `yields += 1` · 대기자 > 0 이면 새 id 로 `enqueue`, 0 이면 버림 ④ `cancel` 실행 중 — `isJsdiffJob(job.request) && queue.length > 0`(쌍 원천 `diffView`) 일 때만 `dropWorker` ⑤ `request` 의 `priority` 기본 `'visible'` ⑥ `setPriority` → 작업 등급 = 대기자 최고 · 대기 중이면 다시 정렬 ⑦ 범위 검증 — tokens·codeView·diffView 의 `start`·`end` 가 정수가 아니거나 `start < 0` · `end < start` → 즉시 `'range-invalid'` · tokens `end − start > TOKENS_RANGE_MAX_LINES` · codeView `> CODE_VIEW_WINDOW_MAX_LINES` · diffView `> DIFF_VIEW_WINDOW_MAX_ROWS` → 즉시 `'range-too-large'` ⑧ 작업 계측 — `enqueue` 때 `enqueuedAt` · 작업 `postMessage` 직전 `startedAt` · `receive` 때 `endedAt` → `deps.timings?.({ kind, lane, priority, yields, key, enqueuedAt, startedAt, endedAt })`(싱크가 없으면 호출 0 · 시계 `deps.now`) | `rg -n "priority\|yields\|'continue'\|isJsdiffJob\(\|function enqueue\|requestSize\(\|setPriority\|'range-too-large'\|'range-invalid'\|enqueuedAt\|startedAt\|endedAt\|timings" src/renderer/src/shared/compute/client.ts` | `continue` 가 크기 자리로 가면 큰 가시 작업이 다시 막는다(V1 충돌) · 모든 종류에서 워커를 끝내면 체크포인트를 잃는다 · 승격이 없으면 화면에 들어온 창이 background 뒤에 남는다 · 범위 검증이 없으면 형식이 틀린 창이 워커에서 던진다 · 계측 자리가 틀리면 S-C9 의 대기·점유가 섞인다 |
| **EP-5** · AR-02 / VP-21 | 문서 참조 = 도메인 id + `revisionOf(원천)`(D-009·D-036) | `documents.ts` · `useDiffView.ts` | 소비자 | 자리 15 — `useComputeDocument` 호출 ① `useDiffView` 줄 문서 ② 쌍 old ③ 쌍 new ④ patch 문서 ⑤ 동기 경로 축 문서 ⑥ `VirtualCodeView` ⑦ `VirtualMarkdownView` · 원천·id 를 고르는 자리 ⑧ `WorkToolBody` 요청 — `call.input` · `…:work:request` ⑨ `WorkToolBody` 응답 — `call.result` · `…:work:response` ⑩ `WorkerMarkdownTail`(꼬리마다 새 표지 객체) ⑪ `FileDiffBody` → `section.patch` ⑫ `DiffBody` → 구조화 패치 객체 / `call.input` ⑬ OpenCode `FilePanel` → `file` ⑭ `FileBody` → `call.result` ⑮ `ArtifactPreviewContent` → `result` | `rg -n "useComputeDocument\(\|useDiffView\(\|revisionSource=\|work:request\|work:response" src/renderer/src --glob '!*.test.*'` → 정의 2 + 자리 줄 | 공백 옵션이 축 id 에서 빠지면 공백 숨김 전환 뒤 이전 축 토큰 · 렌더마다 새 객체를 원천으로 주면 다시 렌더마다 새 문서 · Work 응답에 요청 revision 을 쓰면 결과 도착 때 요청 문서까지 바뀐다 |
| **EP-6** · MD-01 / VP-30 | 짝 = O(n) 색인 · 현행과 같다(AC8) | `shared/compute/diffView.ts` | 창·워커(공용) | 자리 2 — ① `buildCounterparts(lines): Int32Array` — 삭제 묶음 `[rs, re]` 다음 `next = re + 1` 이 추가면 `counterparts[rs + o] = lines[next + o]` 가 추가일 때 `next + o` · 추가 묶음 `[as, ae]` 바로 앞 삭제 묶음 `[rs, as − 1]` 이면 `counterparts[as + o] = rs + o`(`rs + o < as` 이고 삭제일 때) · 그 밖 −1 ② 행 창 `wordSpan` = 그 줄과 `counterparts[sourceIndex]` 줄의 `changedWordSpan`(가시 행만 · `highlightWords` 일 때). 음성 — `counterpartOf(` 0 | `rg -n "function buildCounterparts\|counterparts\[" src/renderer/src/shared/compute --glob '!*.test.*'` · 음성 `rg -n "counterpartOf\(" src/renderer/src --glob '!*.test.*'` → 0 | 짝이 현행과 다르면 단어 강조 위치가 바뀐다 · 렌더마다 찾으면 O(n²) 복귀 |
| **EP-7** · MD-02·MD-11 / VP-31·VP-39·VP-01 | diff 보기 모델 규칙(공용) — 1회 · 행·위치·문맥이 현행 함수와 같다(AC9·AC11~AC14·AC16) | `shared/compute/diffView.ts` · `worker/state.ts` | 창·워커 | 자리 5 — ① `buildDiffView(lines, { ignoreWhitespace })` — 공백 접기(현행 `collapseWhitespaceOnlyChanges`) · 짝 · 폭(`displayColumns` 최댓값 — 탭 8칸 정렬 · W/F 2칸) · 축 줄 색인(old 는 added 제외 · new 는 removed 제외) · 위치 색인(두 축 · old 단독 · new 단독 세 표 — 현행 `diffRequirementMatchesLine` 의미) · 증감 수 ② `diffViewRows` — 초기 문맥 3 범위 ∪ `expansions` → 줄·gap 행(`canUp`·`canDown` = 현행 `withGapDirections`) · 나란히 = gap 사이 묶음별 `toSideBySideRows` ③ `diffViewLocate` — 앵커 → 줄 색인(현행 `findIndex` 첫 일치) → 행 번호(숨은 줄 −1) ④ `diffViewContext` — 줄 색인 ±3 줄 + 창 앞 가장 가까운 old·new 줄번호 ⑤ 워커 모델 캐시 — (원천 revision, 공백 옵션) 키 · 레인 LRU `DIFF_MODEL_CACHE_ENTRIES` | `rg -n "export function (buildDiffView\|diffViewRows\|diffViewLocate\|diffViewContext)\|DIFF_MODEL_CACHE_ENTRIES" src/renderer/src/shared/compute --glob '!*.test.*'` | 행 규칙이 현행과 갈리면 문맥 펼침·요구사항 위치가 바뀐다 · 모델 캐시 키에 공백 옵션이 없으면 공백 숨김 전환이 이전 모델을 쓴다 |
| **EP-8** · AR-03·MD-10 / VP-22·VP-38 | 가상 행 — 전부/가상/근처 · pins · scrollMargin · 크기 보정 정책(AC10·AC11·AC14·AC18·AC19·AC22·AC23·AC33·AC34) | `shared/ui/virtual/useVirtualRows.ts` | 창 | 자리 12 — ① `useVirtualizer(` 이 파일 한 곳 ② `count <= fullUpTo` → 전부(근처일 때) ③ `nearViewportGate` → `IntersectionObserver`(root = 스크롤 요소 · rootMargin `100% 0px`) → 밖이면 핀만 · 관찰자 없음(SSR·테스트) → 근처 ④ `rangeExtractor` = 기본 범위 ∪ pins · 비연속 사이 `spacers` ⑤ `scrollMargin` = 목록 위치(스크롤 요소 기준) — layout effect + 스크롤 요소 내용 `ResizeObserver` ⑥ `adjustScrollOnResize: false` → `shouldAdjustScrollPositionOnItemSizeChange` 거짓 + `onSizeChangeAbove(delta)` ⑦ Git 인라인 ⑧ Git 나란히 ⑨ `DiffTable` ⑩ `VirtualCodeView` ⑪ `VirtualMarkdownView` ⑫ `WorkToolBody` → 두 `VirtualCodeView` 의 `scrollElement` = 컨테이너 | `rg -n "useVirtualRows\(\|useVirtualizer\(" src/renderer/src --glob '!*.test.*'` → `useVirtualizer` 2(`TranscriptViewport` + ①) · `useVirtualRows` 정의 1 + ⑦~⑪ 5 · ⑫ `rg -n "scrollElement=" src/renderer/src/features/chat/harnesses/claude/transcript/WorkToolBody.tsx` → 2 · ②~⑥ `rg -n "fullUpTo\|IntersectionObserver\|rangeExtractor\|scrollMargin\|shouldAdjustScrollPositionOnItemSizeChange\|onSizeChangeAbove" src/renderer/src/shared/ui/virtual/useVirtualRows.ts` | pins 가 빠지면 선택 끝·초안이 언마운트되어 선택·초점이 풀린다 · 근처 판정이 없으면 모두 펼치기에서 파일마다 overscan 행 · Git 본문이 크기 보정을 켜면 같은 요소를 두 곳이 고친다(D-038) |
| **EP-9** · SD-03 / VP-12 | Git 상호작용(AC12~AC15) | `FileDiffSection.tsx` | 창 | 자리 8 — ① 위쪽 펼침 → 펼침 범위 추가 + 앵커 rect 기록 → 보정 조정기 요청(`planUpwardExpansionCompensation` — 현행) ② 선택 요구사항 이동 — 계산 게이트 열기 → `locate` → 숨은 줄이면 `[i−3, i+4)` 펼침 → `scrollToIndex(행, 'center')` → 다음 프레임 `revealDiffRequirement`(현행 함수) ③ 초안 항목 인덱스를 pins 에 ④ 선택 끝 행(`rowEndpoint`)을 pins 에 ⑤ 본문 `onCopy` → 두 끝이 이 본문 안이면 `claimCopy` → 동기/비동기 ⑥ 접기 → 본문 언마운트 → 문서 임차 해제 ⑦ 카드 행 자리 = `locate`(그 파일 요구사항 앵커 전부)의 행 번호 ⑧ `onAddRequirement` — 동기 경로 `lines`·색인 / 워커 경로 `context(lineIndex)` | `rg -n "planUpwardExpansionCompensation\(\|scrollToIndex\(\|revealDiffRequirement\(\|pins\|claimCopy\(\|\.locate\(\|\.context\(" src/renderer/src/features/chat/harnesses/common/rightpanel/FileDiffSection.tsx` | 보정이 빠지면 위쪽 펼침에서 읽던 줄이 밀린다 · `scrollToIndex` 가 빠지면 화면 밖 요구사항 선택이 아무 일도 안 일어남으로 보인다 · 카드 행 자리가 틀리면 요구사항 카드가 다른 줄 아래 붙는다 |
| **EP-10** · MD-05 / VP-34 | 복사 끝점·단위(AC15·AC35 · D-029·D-040·D-049) | `shared/ui/virtual/copy.ts` · `CopyRowsHost.tsx` | 창 | 자리 7 — ① `rowEndpoint(root, node, offset)` — `[data-virtual-index]` 조상 + `[data-virtual-text]`(나란히는 `data-virtual-side`) 안 오프셋 · 밖이면 `null` ② `copyUnits` — 블록마다 DOM 순서 목록 배열 → 목록 없는 블록은 `blocks` 단위(0326 묶음) · 목록 있는 블록은 `slice` 단위 `{ index, from, to }`(블록 시작 · (목록 순번, 행) · 블록 끝 — 조각 마운트 행 합 ≤ `VIRTUAL_COPY_CHUNK_ROWS` · 경계는 행 시작 · 목록 사이 일반 텍스트는 덮는 조각에) · 목록 미상(뷰포트 밖) 블록은 `probe` 단위 먼저 · 첫·끝 단위는 끝점 행에서 시작·끝(D-049) ③ Git 인라인 `<CopyRowsHost>` ④ Git 나란히 `<CopyRowsHost>` ⑤ `DiffTable` `<CopyRowsHost>` ⑥ `VirtualCodeView` `<CopyRowsHost>` ⑦ `VirtualMarkdownView` `<CopyRowsHost>`(블록) | `rg -n "rowEndpoint\(\|copyUnits\(\|<CopyRowsHost" src/renderer/src --glob '!*.test.*'` → 정의 2 + 호스트 5 | 끝점 칸이 틀리면 나란히 부분 선택이 반대쪽에서 시작한다 · 조각이 행을 건너뛰면 복사 결과에서 줄이 빠진다 · 목록을 블록당 하나로 접으면 Work 응답·둘째 카드 행이 빠진다 |
| **EP-11** · R-02 / VP-02 | 400줄 초과 도구 본문 = 384px 가상 본문 · Work 단일 스크롤 · 닫힌 OpenCode 0(AC18~AC20·AC32·AC33 · D-004·D-036·D-047) | `shared/ui/virtual/limits.ts` | 창 | 자리 6 — ① `DiffTable` — `rowCount > VIRTUAL_BODY_MIN_LINES` → `scrollElement` prop 이 없으면 자기 `VIRTUAL_BODY_MAX_HEIGHT_CLASS overflow-auto` 래퍼 ② OpenCode `FilePanel` — 기존 컨테이너를 `scrollElement` 로(클래스는 상수) ③ `FileBody` — 줄 수 > 400 → `<VirtualCodeView showLineNumbers maxHeight>` ④ `WorkToolBody` `Payload` — 줄 수 > 400 → `<VirtualCodeView scrollElement={컨테이너}>`(`maxHeight` 없음) ⑤ `ToolCard` 복사 버튼 `copyText(call)`(현행 `ToolCard.tsx:238`) ⑥ OpenCode `FilePanel` — `open` 일 때만 본문 렌더 | `rg -n "VIRTUAL_BODY_MIN_LINES\|VIRTUAL_BODY_MAX_HEIGHT_CLASS\|<VirtualCodeView\|scrollElement=\|copyText\(call\)" src/renderer/src/features/chat --glob '!*.test.*'` · ⑥ `rg -n "open &&\|open ?" src/renderer/src/features/chat/harnesses/opencode/transcript/ToolBody.tsx` | 임계가 어긋나면 400줄 이하 본문 레이아웃이 바뀐다 · Work 에 384px 를 중첩하면 휠·키보드 소유자가 둘 · 닫힌 OpenCode 본문이 렌더되면 접힌 파일도 모델·요청을 만든다 |
| **EP-12** · MD-04·AR-04 / VP-04·VP-23·VP-33·VP-13 | Markdown 블록 rev 2 · 표 조각 · 상한 · 노드 예산 · hast(AC23·AC24·AC31 · D-021·D-033·D-045) | `lib/markdownDocumentBlocks.ts` · `worker/markdown.ts` · `MarkdownHast.tsx` · `VirtualMarkdownView.tsx` | 창 · worker | 자리 13 — ① `markdownDocumentBlocks(source)` — `splitStableBlocks` 결과 → 원문 범위 → 끝 줄 개행 포함 → 합치기 다섯(첫 줄 공백 · 목록 연속 · 인용 연속 · 인접 HTML · 열린 HTML 블록 1~5 끝 표지까지) → 각주 정의(`^ {0,3}\[\^[^\]]+\]:`)가 있으면 `[{0, length}]` ② 표 블록 조각 — 본문 행 ≤ `MARKDOWN_TABLE_CHUNK_ROWS` 그리고 칸(머리 칸 + 조각 행 × 열 수) ≤ `MARKDOWN_TABLE_CHUNK_MAX_CELLS` 그리고 조각 원문 ≤ `MARKDOWN_TABLE_CHUNK_MAX_CHARS` — 앞에서부터 담다가 다음 행이 셋 중 하나를 넘기면 새 조각 `{ headerEnd, rows: [a, b) }`(조각마다 행 ≥ 1) ③ 원문 표시 판정 — 표 본문 행 > `MARKDOWN_TABLE_MAX_ROWS` · 열 수 × 2 > `MARKDOWN_TABLE_CHUNK_MAX_CELLS`(열 > 500) · 머리 + 한 행 > `MARKDOWN_TABLE_CHUNK_MAX_CHARS` · 표가 아닌 블록 > 50,000자 · 각주 문서 > 50,000자 ④ 워커 `markdownBlock` — 블록 텍스트(또는 머리 + 조각 행) + 블록 안 `[라벨]`·`[텍스트][라벨]`·`[라벨][]` 이 가리키는 정의 줄(문서당 1회 색인) 덧붙임 ⑤ `unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true })` ⑥ `raw` 노드 → `{ type: 'text', value }` ⑦ `MarkdownHast` — `a.href`·`img.src` 에 `defaultUrlTransform` ⑧ `toJsxRuntime(hast, { Fragment, jsx, jsxs, components: MARKDOWN_COMPONENTS, passKeys: true, passNode: true, ignoreInvalidStyle: true })` ⑨ 표 조각 합침 `mergeTableChunks` — 첫 조각 `thead` + 모든 조각 `tbody` 행을 조각 순서로(조각마다 memo) ⑩ 파싱 전 블록 — 원문 `<pre data-md-block-pending>` ⑪ 상한 블록 — 원문 `<pre data-md-block-raw>`(최종) ⑫ `ArtifactPreviewContent` — `content.length > MARKDOWN_WORKER_MIN_CHARS` → `VirtualMarkdownView` ⑬ 노드 예산 — 워커가 ⑥ 걸음에서 노드를 세어 > `MARKDOWN_HAST_MAX_NODES` 면 `{ tooLarge: true }` · `VirtualMarkdownView` 는 그 블록(표는 표 전체)을 ⑪ 원문으로 바꾸고 남은 조각 요청을 취소한다 | `rg -n "markdownDocumentBlocks\(\|MARKDOWN_TABLE_CHUNK_ROWS\|MARKDOWN_TABLE_CHUNK_MAX_CELLS\|MARKDOWN_TABLE_CHUNK_MAX_CHARS\|MARKDOWN_TABLE_MAX_ROWS\|MARKDOWN_BLOCK_MAX_CHARS\|MARKDOWN_HAST_MAX_NODES\|tooLarge\|allowDangerousHtml\|type === 'raw'\|defaultUrlTransform\|toJsxRuntime\(\|mergeTableChunks\(\|data-md-block-pending\|data-md-block-raw\|MARKDOWN_WORKER_MIN_CHARS" src/renderer/src --glob '!*.test.*'` | 끝 개행·HTML 규칙이 빠지면 M13b 불일치가 돌아온다 · 조각 합침이 틀리면 표 머리가 반복된다 · 상한이 없으면 1M자 표가 레인을 106s 잡는다 · 칸 예산이 없으면 200행 × 50열 한 조각이 2.5s(M22) · 노드 예산이 없으면 60,003 노드 블록 하나의 창 반영이 62.9ms(M22c) · raw → text 가 빠지면 HTML 이 요소로 그려질 수 있다 · urlTransform 이 빠지면 `javascript:` 링크 |
| **EP-13** · MD-06 / VP-05·VP-35 | 꼬리(AC26 · D-006·D-019·D-035) | `WorkerMarkdownTail.tsx` | 창 | 자리 7 — ① `StreamingMarkdown` — `!openFence && tail.length > MARKDOWN_WORKER_MIN_CHARS` → `<WorkerMarkdownTail>` ② 꼬리가 바뀔 때마다 새 표지 객체 → 새 revision(이전 임차 해제 — 실행 중이면 그 뒤 닫힘) ③ 합치기 — 실행 중 요청이 있으면 대기 요청 하나만 두고 새 delta 는 그 대기를 최신 꼬리로 바꾼다 ④ `tail.startsWith(parsed.text)` → `MarkdownHast(parsed.hast)` + 나머지 원문 ⑤ 접두가 아니면 현재 꼬리 원문만 ⑥ `tail.length > MARKDOWN_BLOCK_MAX_CHARS` → 요청 0 · 원문 · 결과 `tooLarge` → 원문(D-045) ⑦ 요청 옵션 `cacheable: false` | `rg -n "MARKDOWN_WORKER_MIN_CHARS\|MARKDOWN_BLOCK_MAX_CHARS\|tooLarge\|<WorkerMarkdownTail\|startsWith\(\|cacheable: false" src/renderer/src/features/chat/components/markdown --glob '!*.test.*'` | 접두 검사가 빠지면 블록 확정 뒤 같은 글이 두 번 보인다 · 합치기가 빠지면 delta 마다 요청이 쌓인다 · 꼬리를 캐시하면 강조 결과가 밀려난다 |
| **EP-14** · AR-05 / VP-08·VP-24 | 의존성·경계(AC28 · D-005·D-034) | `ui-thread-rules.mjs` · `package.json` · 문서 | 가드 · 문서 | 자리 6 — ① `ALLOWED.b.modules` 에 `unified`·`remark-parse`·`remark-rehype`(`anyModule` 워커 구역만 — 진입점 둘) ② `app/package.json` `dependencies` 4개(설치 버전 범위 `^11.0.5`·`^11.0.0`·`^11.1.2`·`^2.3.6`) ③ `docs/TRD.md` 마크다운 행(`:109`) ④ `app/AGENTS.md` 채택 목록 ⑤ `docs/arch/execution-model.md` 계산 워커 행(`:20`) "레인 2(계산 · Markdown) · 범위 토큰 · diff 보기 모델 · Markdown 블록 파싱 · 열린 문서" ⑥ 규칙 (i) — `new Worker(` 는 `client.ts` 레인 생성 2 | `rg -n "remark-parse\|remark-rehype\|hast-util-to-jsx-runtime\|\"unified\"\|'unified'" package.json scripts/ui-thread-rules.mjs ../docs/TRD.md AGENTS.md ../docs/arch/execution-model.md` · ⑥ `rg -n "new Worker\(" src/renderer/src --glob '!*.test.*'` → 주석 1 + 호출 2 | UI 스레드가 파서를 직접 import 해도 가드가 침묵 · 승인한 의존성이 문서에 없다 · 워커 생성이 흩어지면 규칙 (i) 위반 |
| **EP-15** · MD-09 / VP-37·VP-03 | 줄 번호 메모(AC21) | `CodeBlock.tsx` | 창 | 자리 2 — ① plain 경로 줄 번호 문자열 `useMemo(…, [code])` ② html 경로 CSS 카운터(현행 `LINE_NUMBER_CLASSES`) | `rg -n -F "code.split(" src/renderer/src/shared/ui/markdown/CodeBlock.tsx` → 1(① 안) · `rg -n "LINE_NUMBER_CLASSES" src/renderer/src/shared/ui/markdown/CodeBlock.tsx` | 렌더마다 O(n) 복귀 |
| **EP-16** · AR-02 / VP-21·VP-01·VP-03 | 범위 토큰 소비(AC5·AC7·AC17·AC20·AC22) | `hooks/useWindowTokens.ts` | 창 | 자리 7 — ① `useWindowTokens(tokenDoc, lang, mountedLines, visibleLines)` — 마운트 줄을 200줄 창으로 묶어 창마다 `{ kind: 'tokens' }`(화면 안 창 `visible` · overscan 만 `background`) · 창에서 빠지면 취소 ② 테마 `useSyncExternalStore(subscribeTheme)` → 마운트 창만 다시 ③ 결과 요청 키 ≠ 지금 키면 버림(revision·언어·테마·범위) ④ `useDiffRowTokens` — `useDiffView().axes` 두 개 × ① · 행 → 축 줄(`oldAxis`·`newAxis`) · 토큰 원문 대조 ⑤ `VirtualCodeView` → ① ⑥ 음성 — `diffTokens` 0 ⑦ 창 등급이 바뀌면 `handle.setPriority` | `rg -n "kind: 'tokens'\|useWindowTokens\(\|useDiffRowTokens\(\|setPriority\(" src/renderer/src/features/chat --glob '!*.test.*'` · 음성 `rg -n "diffTokens" src/renderer/src --glob '!*.test.*'` → 0 | 전체 축 요청이 남으면 26s 작업 · 키 대조가 없으면 지난 세대·테마 색이 붙는다 · 승격이 없으면 화면 창이 background 뒤 |
| **EP-17** · AR-06 / VP-25 | 레인(AC31 · D-034) | `client.ts` · `protocol.ts` · 워커 진입점 | client · worker | 자리 6 — ① `laneOf(kind)` — `markdown` → `'markdown'` · 나머지 → `'compute'` ② 레인 워커 생성 2(`compute.worker.ts` · `markdown.worker.ts`) ③ 레인마다 대기열·실행 중·연속 실패 수 ④ 레인마다 문서 등록부·`sent` ⑤ `markdown.worker.ts` — 상태 하나(Markdown 처리기만) ⑥ `compute.worker.ts` — 상태 하나(Markdown 제외) | `rg -n "laneOf\(\|lanes\[\|compute\.worker\|markdown\.worker" src/renderer/src/shared/compute --glob '!*.test.ts'` | Markdown 이 계산 레인으로 가면 50,000자 블록 파싱이 강조를 막는다 · 레인이 등록부를 공유하면 한 레인 교체가 다른 레인 문서를 잃는다 |
| **EP-18** · MD-02 / VP-31·VP-01 | diff 보기 소비 — 경로·창 요청·상태(AC9·AC18) | `hooks/useDiffView.ts` | 창 | 자리 4 — ① 경로 판정 `diffViewPath`(줄 ≤ 5,000 그리고 문자 ≤ 200,000 · patch ≤ 200,000 · 쌍 `withinDiffCap`) ② 동기 — `useMemo(() => buildDiffView(lines, { ignoreWhitespace }), [원천, ignoreWhitespace])` · 행 창 `diffViewRows` 즉시 ③ 워커 — 원천 문서 임차 → `requestRows` 마다 `{ kind: 'diffView' }`(가시 `visible` · overscan `background`) · `locate`·`context` 요청 ④ 상태 — 대기 `DiffLinesStatus` · 실패 Git `chat.rightpanel.diffLoadFailed` / 카드 기존 원문 폴백 | `rg -n "diffViewPath\(\|buildDiffView\(\|kind: 'diffView'\|kind: 'diffLocate'\|kind: 'diffContext'\|DiffLinesStatus\|diffLoadFailed" src/renderer/src/features/chat --glob '!*.test.*'` | 경로 판정이 틀리면 5만 줄이 창 동기(13ms+) · 메모 deps 에 초안·선택이 들어가면 키 입력마다 O(n) · 상태가 없으면 워커 실패가 빈 본문으로 보인다 |
| **EP-19** · SD-03·MD-10 / VP-12·VP-01 | 모두 펼치기 근접 계산 · 계산 수명 ≠ DOM 수명(AC10 · D-028·D-051) | `FileDiffSection.tsx` · `DiffReview.tsx` | 창 | 자리 6 — ① 계산 게이트 열림 = 근접(`IntersectionObserver` rootMargin `100% 0px`) ∨ 그 파일 요구사항 선택 ∨ 이동 대상 ② 닫힌 동안 자리 `estimatedBodyHeight` = `min(줄 수, 7 × (추가 + 삭제) + 1) × VIRTUAL_ROW_ESTIMATE_PX`(행·임차·요청 0) ③ 게이트가 열리기 전 `useDiffView` 원천 `null` ④ 한 번 열린 계산(모델 메모·임차)은 접기·새 patch 세대까지 유지 — 행 DOM 은 EP-8 ③ 근처 판정을 따른다(근처 밖이면 핀만) ⑤ `DiffReview` → `FileDiffSection` 이동 대상 경로(`pickFile` · 요구사항 이동) ⑥ 근처 밖 자리 높이 = 마지막 측정 높이(`measuredBodyHeight` — 측정 전이면 ②) | `rg -n "computeGate\|estimatedBodyHeight\(\|measuredBodyHeight\|navigationTarget" src/renderer/src/features/chat/harnesses/common/rightpanel --glob '!*.test.*'` | 게이트가 늘 열리면 모두 펼치기가 V1 처럼 전부 계산(M16 76ms) · 자리 높이가 없으면 스크롤바가 계산할 때마다 튄다 · 이동 대상이 게이트를 못 열면 트리 이동이 빈 자리로 간다 · 근처 이탈 때 게이트를 닫으면 다시 올 때마다 모델을 다시 만든다 · 행을 남기면 200파일을 지난 뒤 DOM 이 파일 수에 비례한다(ea3) |
| **EP-20** · AR-07·SD-05 / VP-26·VP-14 | 복사 처리 계약 · 0326 통합 · 블록 안 여러 목록(AC15·AC35 · D-040·D-049) | `shared/ui/virtual/copy.ts` · `TranscriptViewport.tsx` · `CopySerializationHost.tsx` · `textOffset.ts` · `DiffReview.tsx` · `lib/transcript/viewport/copy.ts` | 창 | 자리 10 — ① `claimCopy`·`isCopyClaimed`(모듈 WeakSet) ② `TranscriptViewport.handleCopy` 첫 줄 — `isCopyClaimed(event)` 면 반환 ③ `TranscriptViewport` 단위 — `copyUnits(lo, hi, registry, VIRTUAL_COPY_CHUNK_ROWS, ends)` 로 동기/비동기 판정·`startCopyJob` 단위 목록(`blocks` · `probe` · `slice`) ④ `VirtualListRegistry` — 블록 키 → 목록 배열(`VirtualListEntry` — 목록 키 · 행 수 · `charsBefore` · `rowsReady`·`prepareRows` · 루트 요소) 등록 · 순서 = 루트의 `compareDocumentPosition` ⑤ `CopySerializationHost` 안 내부 목록 — 복사 범위 문맥(`VirtualCopyRange` = `slice` 범위 \| `probe`)이면 그 범위 행만(살핌은 행 0) 마운트 ⑥ `textOffset` — `[data-virtual-skip-chars]` 를 그 수만큼 센다 ⑦ `DiffReview` `onCopy` — 가져가지 않았고 두 끝이 다른 파일 본문이면 (파일, 행 조각) 단위 ⑧ 내부 목록 거터(줄 번호 · ±)에 `data-transcript-chrome`(`DiffTable` · `VirtualCodeView` · Git 본문) ⑨ 조각 작업 준비 — `startCopyJob` 훅 `prepareChunk(unit)`(`probe` 결과 등록 · 워커 경로 목록의 `prepareRows`)을 `mountChunk` 앞에서 기다린다(task 밖 · 마운트·직렬화 task 만 50ms 예산 · 준비 중 문서 임차는 복사 작업이 쥐고 끝·취소 때 놓는다) ⑩ 건너뛴 글자 값 — 창 동기 모델은 모델 메모 안 행 본문 길이 누적합(`Int32Array`), 워커 모델은 `diffView`·`codeView` 결과 `charsBefore`·`summary.textChars` → 여백 `data-virtual-skip-chars` | `rg -n "claimCopy\(\|isCopyClaimed\(\|copyUnits\(\|VirtualListRegistry\|VirtualCopyRange\|data-virtual-skip-chars\|prepareChunk\|charsBefore\|textChars\|compareDocumentPosition" src/renderer/src --glob '!*.test.*'` · ⑧ `rg -n "data-transcript-chrome" src/renderer/src/features/chat/harnesses/common src/renderer/src/features/chat/components/code --glob '!*.test.*'` | 가져가기 확인이 없으면 같은 복사를 두 번 처리(내부 결과를 외부 조각 작업이 덮어씀) · 건너뛴 글자가 없으면 카드 안 끝점 오프셋이 전체 마운트 때와 갈린다 · 거터가 chrome 이 아니면 오프셋에 줄 번호가 섞인다 · 등록 순서로 줄 세우면 다시 마운트된 목록이 뒤로 가 조각 순서가 DOM 과 갈린다 · 준비 없이 마운트하면 워커 경로 조각이 빈 행으로 직렬화된다 |
| **EP-21** · MD-13 / VP-49 | 카드 동기 계산 상한·메모·접힘 0(AC19·AC32 · D-042·D-047) | 카드 본문 · `VirtualCodeView` | 창 | 자리 6 — ① `FileBody` — `countLinesUpTo(text, 400) ≤ 400` 이면 문자 수와 무관하게 `CodeBlock` + `useMemo(() => stripLineNumberGutter(output), [call.result])` · 400줄 초과 · 원천 ≤ `BODY_SYNC_MAX_CHARS` 면 같은 메모 + `VirtualCodeView` · 넘으면 `VirtualCodeView` + 워커 `codeView({ view })` — 토큰 원천은 400줄 초과 두 경로 모두 보기 문서(EP-25 ⑤) ② `WorkToolBody` — 단계 ①~⑤(D-042)를 원천(`call.input`·`call.result`)마다 `useMemo` — Task 합성 응답도 `call.result` 키 · 객체 문자열화는 크기 무관 1회 · 문자열 언어 판정은 ≤ 1,000,000자만 · 객체를 문자열화한 결과는 판정 0 · 상태(`workToolPresentation(call).status`)·검색 결과(`workSearchResults(call)`) 메모 ③ OpenCode `FilePanel` → `useDiffView`(patch·쌍) · 증감 수 = `summary.added/removed` ④ `DiffBody` 구조화 패치 → `useDiffView`(줄 원천) ⑤ `VirtualCodeView` — 원천 ≤ 1,000,000자면 줄 시작 색인·폭 `useMemo` · 넘으면 `codeView` ⑥ `ToolCard` 접힘 — 본문 미마운트(현행 `ToolCard.tsx:256` 조건 유지) | `rg -n "BODY_SYNC_MAX_CHARS\|countLinesUpTo\(\|stripLineNumberGutter\(\|payloadText\(\|workSearchResults\(\|useDiffView\(\|kind: 'codeView'\|bodyMounted" src/renderer/src/features/chat --glob '!*.test.*'` | 메모가 빠지면 렌더마다 원문 전체(M20) · 상한 판정이 빠지면 5MiB 가 창 동기 · 접힘 조건이 바뀌면 접힌 카드가 계산한다 · 400줄 이하에 문자 상한을 걸면 `CodeBlock` 대신 대기 화면이 된다(질의 7 위반) · 합성 응답 객체를 메모 키로 쓰면 렌더마다 파생 |
| **EP-22** · SD-06 / VP-15 | Work 본문(AC33 · D-036) | `WorkToolBody.tsx` | 창 | 자리 4 — ① 컨테이너 `ref` → 요청 `Payload` 의 `VirtualCodeView scrollElement` ② 응답 `Payload` 의 `VirtualCodeView scrollElement`(같은 컨테이너) ③ 문서 id·revision — 요청 `…:work:request` + `call.input` · 응답 `…:work:response` + `call.result` ④ Payload 안 자기 스크롤 0(`maxHeight` 없음 · `max-h-` 없음) | `rg -n "work:request\|work:response\|scrollElement=\|max-h-" src/renderer/src/features/chat/harnesses/claude/transcript/WorkToolBody.tsx` → 컨테이너 `max-h-[250px]` 1 + 자리 줄 | 384px 를 중첩하면 스크롤·초점 소유자가 둘 · 같은 revision 을 쓰면 결과 도착이 요청 문서까지 바꾼다 |
| **EP-23** · MD-12 / VP-48 | 보유·정리(D-032·D-046·D-048) | `worker/state.ts` · `tokens.ts` · `client.ts` | worker · client | 자리 5 — ① 체크포인트 사슬 — 문서당 최근 `TOKENS_THEME_CHAINS` 개 테마 ② 문서 닫기 → 체크포인트·줄 색인·diff 모델·파생 축·보기 문서 삭제(`dropDerived`) ③ diff 모델 캐시 — 레인 LRU `DIFF_MODEL_CACHE_ENTRIES` · 퇴거·교체 뒤 다음 요청에서 다시 만든다(AC9) ④ 워커 교체 → 레인의 모든 보유물 버림(클라이언트 `sent` 초기화와 짝) ⑤ 클라이언트 `cacheable === false` → `writeCache` 안 함 | `rg -n "TOKENS_THEME_CHAINS\|DIFF_MODEL_CACHE_ENTRIES\|dropDerived\(\|cacheable" src/renderer/src/shared/compute --glob '!*.test.ts'` | 닫기에서 파생이 안 지워지면 문서를 닫아도 체크포인트가 남는다(5만 줄 ≈ 2.3MiB/테마) · 꼬리를 캐시하면 강조 결과가 밀린다 |
| **EP-24** · SD-03·MD-10 / VP-12 | Git 스크롤 보정 조정기(AC12·AC34 · D-038) | `DiffReview.tsx` · `FileDiffSection.tsx` | 창 | 자리 4 — ① 스크롤 소유자마다 조정기 하나(`useScrollCorrection(ownerRef)`) ② 보정 원인 셋 — 위쪽 펼침(앵커 차이) · 근접 밖 자리 → 실제 높이(화면 위쪽) · 화면 위쪽 행 측정 변화(`onSizeChangeAbove`) → `requestCorrection(delta)` ③ 프레임마다 합쳐 `scrollTop` 1회(꼬리 여백은 `planUpwardExpansionCompensation`) ④ Git 본문 `useVirtualRows({ adjustScrollOnResize: false })` | `rg -n "useScrollCorrection\(\|requestCorrection\(\|adjustScrollOnResize: false\|scrollTop =" src/renderer/src/features/chat/harnesses/common/rightpanel --glob '!*.test.*'` | 두 곳이 `scrollTop` 을 쓰면 서로 덮어 위치가 튄다 · 자리 교체를 보정하지 않으면 위쪽 파일이 계산될 때 읽던 줄이 밀린다 |
| **EP-25** · MD-14 / VP-51 | 보기 문서 — 표시와 토큰이 같은 변환 원문(AC19 · D-048) | `shared/compute/gutter.ts` · `worker/state.ts` · `FileBody.tsx` | 창 · worker | 자리 5 — ① `shared/compute/gutter.ts` `stripLineNumberGutter`(현행 `lang.ts:33-40` 본문 그대로 · 정의 1) — `features/chat/lib/lang.ts` 는 다시 내보냄 ② 워커 보기 문서 — `{ view }` 원천을 처음 쓰는 작업에서 원천 문서 텍스트에 transform 을 한 번 적용해 `viewKey` 로 보관 · 원천 문서 닫기 때 삭제(EP-23 ②) ③ `codeView` 의 `{ view }` 원천 → 보기 문서 줄 ④ `tokens` 의 `{ view }` 원천 → 보기 문서 줄로 토큰화(체크포인트 사슬도 보기 문서마다) ⑤ `FileBody` → `VirtualCodeView` 토큰 원천 `{ view: { doc, transform: 'stripGutter' } }`(400줄 초과 두 경로) | `rg -n "function stripLineNumberGutter\|stripLineNumberGutter\(\|viewKey\(\|transform: 'stripGutter'" src/renderer/src --glob '!*.test.*'` → 정의 1 + 자리 줄 | 토큰 원천이 원문이면 거터 글자에 색이 붙고 토큰 내용 이음이 표시 줄과 갈려 원문 폴백만 남는다 · SSOT 가 둘이면 창 메모와 워커 결과가 갈린다 · 닫기에서 보기 문서가 남으면 원문 두 벌이 워커에 남는다 |

- 자리 목록은 검색 출력과 차집합 0 이어야 한다(구현자는 IMPL_DONE 전에, 검증자는 1회째에 다시 돌린다). verify 발견은 이행 결함·현재 결함·확장 후보로 갈리고, 열거 원문에 없는 확장 후보는 verify 1·2회째에만 판정을 막는다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- **선언 경계**(측정 근거와 함께 — verify 는 이 안의 반례를 `경계`로 본다):
  - B1 — 테마 전환 뒤 문서 끝 범위는 그 테마 체크포인트를 앞에서부터 다시 만든다 — 5만 줄 끝이면 워커 약 26s(M4 · 창은 원문, 다른 요청은 50ms 마다 사이에 처리 — AC4).
  - B2 — 한 Markdown 블록(≤ 50,000자)·표 조각(행 ≤ 200 · 칸 ≤ 1,000 · ≤ 50,000자)의 파싱은 한 작업이다 — 산문 50,000자 15.0ms(M22c) · 문단 197ms · 목록 98ms(M18b) · 표 조각 최대 35.1ms(M22c)이고, 촘촘한 블록은 문자 수에 초선형이다(목록 50,000자 1,386.7ms · 강조 50,000자 855.6ms — M22c·M22d). 그동안 Markdown 레인의 다른 블록·스트리밍 꼬리는 기다린다(계산 레인은 무관 — D-034). 노드 예산(20,000)을 넘는 결과는 파싱 비용을 쓴 뒤 원문이 된다(D-045).
  - B3 — `MARKDOWN_WORKER_MIN_CHARS` 이하 문서·꼬리, 그리고 `<Markdown>` 의 다른 호출처 10곳(S7 의 12 중 0327 이 바꾸는 2를 뺀 것)은 창 동기 파싱이다(현행).
  - B4 — transcript Markdown 코드 펜스(`Markdown.tsx:134`·`StreamingMarkdown.tsx:23`)는 transcript 블록 하나다 — 강조 상한 32,000자(현행) · 큰 펜스는 원문 텍스트 노드 하나 · 400줄 초과 가상화는 후속(D-039 · INDEX 후보).
  - B5 — 작은 원천(줄 ≤ 5,000 · 문자 ≤ 200,000)은 창 동기 모델이다 — 5,000줄 1.81ms(M21). 근처 파일이 여럿이면 그 합이다(모두 펼치기 근처 2파일 0.12ms — M16). (V1 B5 대체)
  - B6 — (rev 2 삭제 — 카드 경계를 넘는 선택은 바깥이 처리한다, D-040)
  - B7 — (rev 2 삭제 — 나란히 보기 복사는 Chromium 기본 복사와 같다, D-029 사용자 결정)
  - B8 — 폭의 전각 판정은 East Asian Width W·F 범위 근사이고 결합 문자·이모지 변형은 1칸이다 — 실제보다 좁으면 가로 막대가 늦게 는다.
  - B9 — 400행 이하 Git 파일·400줄 이하 도구 본문은 지금 DOM 그대로다.
  - B10 — 블록 렌더 = 전체 렌더는 태그 경계 공백·SSR 구분 주석을 뺀 비교다(M13b 717/717). 블록 사이 간격은 `gap-2` 근사(0008 `StreamingMarkdown` 선례)라 여백 픽셀은 다를 수 있다.
  - B11 — 범위 토큰·행 창·hast 캐시는 0325 비용 규칙(키 + 크기 ≤ 4,000,000 · 항목 ≤ 1,000)을 그대로 쓴다.
  - B12 — 열린 문서 문자 합이 상한을 넘는 동안 그 뒤 문서는 색·블록 파싱·워커 모델이 없다(코드·Markdown 원문 · Git 은 대기 표시) — 다른 문서가 닫히면 다시 요청한다(D-010).
  - B13 — 꼬리 워커 결과는 한 작업만큼 늦다 — 최신 새 글자는 원문으로 먼저 보인다(AC26). 꼬리 > 50,000자는 원문.
  - B14 — 원문 표시: 표 본문 행 > 2,000 · 열 > 500 · 머리 + 한 행 > 50,000자 · 표가 아닌 블록 > 50,000자 · 각주 문서 > 50,000자 · 결과 노드 > 20,000(표는 표 전체)은 서식 없이 원문으로 남는다(최종) — 표 200K자 6.7s·각주 1.16M자 hast 14.6MB(M18) · 200행 × 200열 39.3s(M22) · 노드 37,501~60,003 블록 반영 35.6~62.9ms(M22c).
  - B15 — 20,000자 이상 줄은 색 없는 한 토큰이다(결정적 — 길이 상한 줄은 문법 상태를 바꾸지 않는다). 줄 시간 상한(50ms)은 규칙 일치 사이에서만 검사해 한 줄이 상한을 넘을 수 있고(M17b 최대 112.1ms), 멈춘 줄은 마지막 토큰이 줄 끝까지 늘어 그 색을 잇고 다음 줄은 멈춘 지점의 문법 상태로 잇는다(F31) — 내용은 보존되지만 그 줄과 뒤 줄의 색은 장비·실행마다 다를 수 있다(AC3 색 동등성 비교 밖). 현행 `highlight` 출력도 같은 규칙으로 바뀐다(D-031).
  - B16 — 객체 payload 의 JSON 문자열화는 창에서 원천 객체당 1회이고 크기 상한이 없다(5MB 16.40ms — M24 · 21.53ms — M20) — 워커로 보내는 구조화 복제가 더 비싸다(52.25ms — M20). 문자열이 된 뒤의 단계(언어 판정 · 줄 색인)는 D-042 상한을 따른다.
  - B17 — OpenCode patch > 1,000,000자는 원문(현행 `PATCH_INLINE_MAX_CHARS`) — 워커 경로도 같은 판정이다.
  - B18 — 쌍 원천 `diffView`(jsdiff)의 실행 중 취소 + 대기 요청은 계산 레인 워커를 교체한다(D-024) — 그 레인의 문서·체크포인트·모델을 다시 만든다.
  - B19 — 근접 밖 파일의 추정 높이는 실제와 다를 수 있다 — 화면 위쪽에서 바뀌면 보정 조정기가 보정하고(AC34), 화면 아래쪽은 스크롤바 길이만 바뀐다.
  - B20 — 워커 경로 첫 행은 메시지 왕복으로 한 프레임 이상 늦고(M21), 계산 레인에서 실행 중인 작업이 끝날 때까지 더 늦다(D-043) — `tokens` 는 한 양보 간격(≤ 50ms + 한 줄 · 한 줄 최대 112.1ms — M17b), 분할 불가 작업은 그 작업 전체: `highlight` 32,000자 167.6ms(M5) · 5만 줄 diff 모델 17.93ms(M14 창 동기 대리) · 5MiB `codeView` 13.5ms(M20) · 쌍 원천 jsdiff 비슷한 5만 줄 26.2ms · 전부 다른 2,000 + 2,000줄 368.2ms · 5,000 + 5,000줄 2,909.0ms(M23 — 상한 없음, 현행 `diffLines` 작업과 같다). 그동안 자리 안 계산 중 표시.
  - B21 — Work 문자열 payload > 1,000,000자는 언어 판정(`JSON.parse`)을 하지 않고 `text` 로 그린다(색 없음 · 내용 같음).
  - B22 — 복사 결과의 Chromium 문자열 동일성은 node 에서 판정할 수 없다 — 기계 단언은 마운트 집합·끝점·단위·호출 순서이고 문자열 대조는 AC30 S-C8(0326 D-087 독립 기준)이다.
  - B23 — Work 상태·검색 결과 파생(`workToolPresentation(call).status` — ReadMcpResourceDirTool·Artifact watch · `workSearchResults` — WebSearch)은 원천마다 1회지만 크기 상한이 없다 — 그 도구 이름일 때만 결과 전체를 `JSON.parse` 한다(문자열 5MB 8.20ms — M24 · F34).
  - B24 — 블록 안 여러 목록 복사의 조각 계획은 뷰포트 밖 블록마다 살핌 마운트(행 0) task 1 이 더 들고, 워커 경로 목록의 조각은 그 행 창을 받을 때까지 늦다(준비 단계 — UI task 밖 · D-049). 복사 결과가 클립보드에 닿는 시각은 그만큼 늦다.
- 열린 입력 집합(문법·입력 형태)을 판정하는 산출물: 해당 없음 — `markdownDocumentBlocks` 는 판정 게이트가 아니라 표시 분할이다. 합치기는 더 크게 묶는 쪽이 안전하고(전체 렌더와 같아진다), 충실도는 fixture 대조(AC24)와 문서 717개 대조(M13b)가 맡는다.
- 같은 규칙이 여러 레이어에 있다면: diff 보기 규칙은 `shared/compute/diffView.ts` 한 곳(창 동기·워커 공용), 임계 400·384px 은 `shared/ui/virtual/limits.ts`, Markdown·토큰·diff 상수는 `shared/compute/limits.ts`, components 맵은 `shared/ui/markdown/markdownComponents.tsx` 한 곳(`Markdown`·`MarkdownHast` 공유), URL 변환은 react-markdown `defaultUrlTransform` 하나, 복사 가져가기는 `shared/ui/virtual/copy.ts` 하나, 거터 제거는 `shared/compute/gutter.ts` 하나(창 메모·워커 보기 문서 공용 — D-048).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 의미: `priority` 미지정 = `visible` · `cacheable` 미지정 = true · `fullUpTo` 미지정 = 0(늘 가상) · `nearViewportGate` 미지정 = 거짓 · `adjustScrollOnResize` 미지정 = true · `initialRect` 는 테스트 전용 · `DiffTable.scrollElement` 미지정 = 자기 래퍼 · `VirtualCodeView` 의 `maxHeight`·`scrollElement` 는 하나만(둘 다 없으면 바깥 흐름) · `DocumentLease.available` 거짓 = 그 문서 요청 즉시 실패, `onAvailable` 뒤 다시 요청 · `ClientDeps.timings` 미지정 = 계측 기록 0 · `VirtualListEntry.rowCount` `null` = 요약 전(준비 단계가 채운다) · 토큰 원천은 `doc`·`axis`·`view` 중 정확히 하나(`TokenSource`).
- 외부 SDK 경계: shiki `codeToTokens(line, { lang, theme, grammarState, tokenizeMaxLineLength, tokenizeTimeLimit })`·`codeToHtml(code, { …, tokenizeMaxLineLength, tokenizeTimeLimit })` — `grammarState` 는 같은 테마에서 얻은 것만(M8 · F28) · `tokenizeTimeLimit` 은 규칙 일치 사이에서만 검사하고 멈춘 줄의 마지막 토큰을 줄 끝까지 늘린다(F31). `hast-util-to-jsx-runtime` `toJsxRuntime(tree, options)` — react-markdown 9.1 이 넘기는 옵션과 같은 값(F12). TanStack `useVirtualizer` — `rangeExtractor`·`scrollMargin`·`enabled`·`measureElement`·`shouldAdjustScrollPositionOnItemSizeChange`(F14 · virtual-core 3.17.6 `index.d.ts:74-117`).

## 11. 구현 설계

경로는 `app/src/renderer/src/` 기준이다(스크립트·`package.json`·문서 제외).

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/compute/protocol.ts` | 메시지 계약 | §10-A 형 · `docKey`·`axisKey` · `requestKey`(EP-1) · `requestSize(request, lengthOf)` · `requestDocs(request)` · `laneOf` · `parseResponse` 가 `ok: 'continue'` 를 읽는다 · `resultSize` 에 tokens·codeView·diffView·diffLocate·diffContext·markdown(행·노드마다 36 + 문자) · `diffTokens`·`diffLines` 삭제 · `viewKey` · `TokenSource` · 앵커 키(EP-1 ⑤) · 범위 검증(EP-4 ⑦ 판정 함수) · `codeView`·`diffView` 결과 `charsBefore`·`textChars` · `markdown` 결과 `tooLarge`(rev 3) | `protocol.keys.test.ts` pk1~pk6(순수) |
| `shared/compute/limits.ts` | 상한 SSOT | §10-A 상수 | — |
| `shared/compute/client.ts` | 레인·대기열·문서 | 레인 2(`laneOf`) — 레인마다 대기열((등급, `yields`, 크기, 도착))·실행 중·실패 수·문서 등록부(`Map<docKey, { ref, payload, leases, sent, users }>` · 문자 합 · 대기 임차) · `openDocument`·`ensureDocs`·`release`(지연 닫기)·`dropWorker` 의 `sent` 초기화 · `unknown-doc` 재시도 1 · `priority`·`setPriority` · `continue` 재대기 · 취소 규칙(D-024 — 쌍 원천) · `range-too-large`·`doc-unavailable` · `cacheable` · 범위 검증 `range-invalid` · 작업 계측 싱크 `deps.timings`·`deps.now`(EP-4 ⑦⑧ — rev 3) | `client.documents.test.ts` d1~d10 · `client.queue.test.ts` q1~q13·q8b · `client.lanes.test.ts` l1·l2(가짜 `WorkerLike` — 레인별 받은 메시지 기록 · d4 는 실제 `createWorkerState`) |
| `shared/compute/documents.ts`(신규) | 문서 참조 | `revisionOf`(모듈 `WeakMap` + 단조 번호) · `useComputeDocument(id, revisionSource, payload, lane)` — 하나라도 `null` 이면 `null` · 마운트·변경 때 임차, 정리 때 해제 · `available:false` 면 `null` + `onAvailable` 구독 → 다시 렌더 | `documents.test.ts` o1~o4(렌더 하네스) |
| `shared/compute/fakeClient.testfixture.ts` | 가짜 클라이언트 | `openDocument`(임차·레인 기록) · `request` 의 `priority`·`cacheable` 기록 · `setPriority` 기록 · `requests` 에 키 | — |
| `shared/compute/diffDisplay.ts`(이동) | 표시 파생 | `features/chat/lib/diffDisplay.ts` 의 `collapseWhitespaceOnlyChanges`·`toSideBySideRows`·`changedWordSpan` 을 본문 그대로 옮긴다 · features 쪽은 다시 내보낸다 | 기존 diffDisplay 테스트(import 경로만) |
| `shared/compute/gutter.ts`(신규 — 이동 · rev 3) | 거터 제거 SSOT | `features/chat/lib/lang.ts` 의 `GUTTER_RE`·`stripLineNumberGutter` 를 본문 그대로 옮긴다 · features 쪽은 다시 내보낸다(EP-25 ①) | 기존 `lang.test.ts` 3건(그대로) |
| `shared/compute/diffView.ts`(신규) | diff 보기 규칙(공용) | EP-6 · EP-7 ①~④ · `diffViewPath` · `DiffViewModel`(형·줄번호·본문 오프셋·짝·축 색인·위치 색인 — 형 배열) | `diffView.test.ts` cp1·cp2·sb1·p1~p3·ax1~ax3·ri1~ri4·hx1·cx1·lc1 |
| `shared/compute/worker/state.ts`(신규) | 워커 상태 | `createWorkerState({ lane, clock })` → `{ handle(message): Promise<WireResponse \| null> }` — `doc.open`·`doc.close`(파생 삭제)는 `null` · 작업은 종류별 분기 · 작업 시작 때 문서 텍스트를 동기로 읽는다 · 모델 캐시(LRU 8) · 파생 축·거터 제거 문서 · 보기 문서(EP-25 ②) · 모델 LRU 체류·재생성(EP-23 ③) — rev 3 | `worker/handler.test.ts` h6~h13 |
| `shared/compute/worker/handler.ts` | 계산 | `compute` — highlight(줄 상한 옵션) · tokens → `tokensRange` · codeView · diffView·diffLocate·diffContext → `diffView.ts`(쌍은 jsdiff 뒤) · markdown → `markdownBlock` · `handleMessage` 는 `state.handle` 로 대체 | 기존 `handler.test.ts` 5건(diffLines·diffTokens 케이스는 diffView·tokens 로) · h9 |
| `shared/compute/worker/tokens.ts`(신규) | 범위 토큰 | EP-3 ①~⑥ · `tokensRange(doc, request, highlighter, clock)` → `{ rows } \| 'continue'` · 빈 범위(EP-3 ⑥ — rev 3) | `worker/tokens.test.ts` t1~t8(실제 하이라이터 · 주입 시계) |
| `shared/compute/worker/markdown.ts`(신규) | 블록 파싱 | EP-12 ④~⑥ · 문서당 정의 색인(`^ {0,3}\[([^\]\n]+)\]:` 줄 — 소문자·공백 접기 라벨) · 블록 안 `[라벨]`·`[텍스트][라벨]`·`[라벨][]` 이 가리키는 정의만 덧붙임 · 표 조각 입력(머리 + 행 범위) · 노드 계수 → `tooLarge`(EP-12 ⑬ — rev 3) | `worker/markdown.test.ts` mw1~mw6 |
| `shared/compute/worker/compute.worker.ts` | 계산 레인 배선 | 상태 하나(`lane: 'compute'`) → `onmessage` 가 `state.handle` → 응답이면 `postMessage` | — |
| `shared/compute/worker/markdown.worker.ts`(신규) | Markdown 레인 배선 | 상태 하나(`lane: 'markdown'` — Markdown 처리기만 import) | — |
| `shared/ui/virtual/limits.ts`(신규) | 가상 상수 SSOT | §10-A | — |
| `shared/ui/virtual/useVirtualRows.ts`(신규) | 가상 행 | EP-8 ①~⑥ · 반환 §10-A(`spacers` 포함) · `measureElement` 는 `data-index`(TanStack 규약) | `useVirtualRows.test.ts` u1~u7(실제 `@tanstack/virtual-core` + 렌더 하네스) |
| `shared/ui/virtual/copy.ts`(신규) | 복사 계약 | EP-10 ①② · EP-20 ① — `claimCopy`·`isCopyClaimed` · `rowEndpoint` · `copyUnits` · `copyUnits` 단위 `blocks`·`probe`·`slice`(D-049 — rev 3) | `rowSelection.test.ts` r1~r6 · `copyUnits.test.ts` cu1~cu6(순수 + 가짜 DOM) |
| `shared/ui/virtual/CopyRowsHost.tsx`(신규) | 행 직렬화 호스트 | `document.body` portal(0326 `CopySerializationHost` 와 같은 속성 — `select-text` · `aria-hidden` · `pointer-events-none` · 화면 밖) · `renderRows(a, b)` | v8a · tc5 |
| `shared/ui/virtual/registry.ts`(신규) | 블록 안 가상 목록 등록 | `VirtualListRegistry` 문맥 — `register(blockKey, entry: VirtualListEntry)` · 블록마다 배열 · 순서 = 루트 `compareDocumentPosition`(EP-20 ④ — rev 3) · 제공자 없으면 무동작 | tc2·tc6 |
| `shared/ui/markdown/markdownComponents.tsx`(신규) | components 맵 | `Markdown.tsx:11-137` 의 맵·`BlockedImagePlaceholder` 를 옮겨 `MARKDOWN_COMPONENTS` 로 export | `Markdown.render.test.ts`(현행 그대로) |
| `shared/ui/markdown/Markdown.tsx` | 동기 Markdown | `MARKDOWN_COMPONENTS` import(동작 불변) | 현행 |
| `shared/ui/markdown/MarkdownHast.tsx`(신규) | hast → React | EP-12 ⑦⑧⑨ · 래퍼 `className ?? DEFAULT_WRAPPER`(`Markdown` 과 같은 값) | `MarkdownHast.fidelity.test.ts` f1~f3 |
| `shared/ui/markdown/CodeBlock.tsx` | 줄 번호 | EP-15 ① | `CodeBlock.render.test.ts` cb1 |
| `features/chat/lib/diffDisplay.ts` | 다시 내보냄 | `shared/compute/diffDisplay` 다시 내보내기 | 기존 |
| `features/chat/lib/diffSyntax.ts` | 토큰 대조 | `diffTokensRequest`·`mapDiffTokens` 삭제 · `tokensMatchText(row, text)`(현행 `:59` 규칙) 유지 | `diffSyntax.test.ts`(대조 케이스만) |
| `features/chat/lib/markdownDocumentBlocks.ts`(신규) | 문서 블록 rev 2 | EP-12 ①~③ · 반환 `{ start, end, table?: { headerEnd, chunks }, raw?: true }[]`(원문 오프셋 · 빈 블록 없음) · 표 조각 칸·문자 예산 · 열·한 행 원문 판정(EP-12 ②③ — rev 3) | `markdownDocumentBlocks.test.ts` mb1~mb11 |
| `features/chat/hooks/useWindowTokens.ts`(신규) | 창 토큰 | EP-16 ①~③⑦ · 반환 `(line) => ThemedToken[] \| undefined` · 원천 `TokenSource`(doc·axis·view — rev 3) | `useWindowTokens.test.ts` wt1~wt6(가짜 클라이언트 · 렌더 하네스) |
| `features/chat/hooks/useDiffView.ts`(신규 · `useDiffLines.ts` 삭제) | diff 보기 | EP-18 ①~④ · 반환 §10-A | `useDiffView.test.ts` dv1(경로 경계) · dv2(대기·실패 상태 표시) · dv3(창 요청 등급 visible/background) · dv4(`locate`·`context` 왕복 — 동기·워커 같은 값) |
| `features/chat/hooks/useDiffRowTokens.ts`(신규 · `useDiffSyntax.ts` 삭제) | 행 토큰 | 축 두 개 × `useWindowTokens` · 행 → 축 줄 → 토큰 · `tokensMatchText` 틀리면 없음 · `DiffRowTokensContext`(`DiffSyntaxContext` 대체 — `LineText` 소비) | `useDiffRowTokens.test.ts` rt1~rt8 |
| `features/chat/hooks/useScrollCorrection.ts`(신규) | Git 보정 조정기 | EP-24 ①~③ — `requestCorrection(delta \| 앵커 계획)` 을 rAF 에 합쳐 `scrollTop` 1회 · 꼬리 여백 `planUpwardExpansionCompensation`(features — 그래서 이 훅도 features) | `diffScrollCoordinator.test.ts` sc1~sc3 |
| `features/chat/harnesses/common/rightpanel/FileDiffSection.tsx` | Git 본문 | 계산 게이트(EP-19) · `useDiffView` · 항목 목록(인라인: gap·line·draft·markers / 나란히: gap·pair·markers — 카드 자리 = `locate`) · `useVirtualRows({ fullUpTo: VIRTUAL_BODY_MIN_LINES, nearViewportGate: true, adjustScrollOnResize: false, scrollElement: () => scrollOwnerRef.current, pins })` · 여백 행 `<tr aria-hidden style={{ height }}>` · 행 `<tr data-index data-virtual-index ref={measureElement}>` · 본문 칸 `data-virtual-text`(나란히 `data-virtual-side`) · 거터 `data-transcript-chrome` · EP-9 ①~⑧ · `useDiffRowTokens` · `onCopy` · 근처 밖 핀만·자리 높이 = 측정(EP-19 ④⑥ — rev 3) · 워커 경로 비동기 복사 준비(D-049) | `fileDiffVirtual.render.test.ts` v1~v12·v5b·v5w·v6w·v7b·v7c·v8a·v8b·v8w · `fileDiffExpandAll.render.test.ts` ea1~ea3 |
| `features/chat/harnesses/common/rightpanel/DiffReview.tsx` | 보정·경계 복사·이동 | `useScrollCorrection(ownerRef)` 를 파일 섹션에 내려줌 · `onCopy`(가져가지 않은 파일 경계 — EP-20 ⑦) · 이동 대상(`pickFile` · 요구사항 이동) 전달 | `diffScrollCoordinator.test.ts` · v8b |
| `features/chat/harnesses/common/transcript/DiffTable.tsx` | 도구 diff 표 | props `view`(`useDiffView` 반환) · `scrollElement?` — 행 > 400 → 가상(EP-11 ①) · 아니면 현행 DOM · 거터 chrome · 토큰 `useDiffRowTokens` · 복사 가져가기 · 레지스트리 등록 | `DiffTable.virtual.test.ts` dt1~dt5 |
| `features/chat/harnesses/claude/transcript/tool-bodies/DiffBody.tsx` | Claude diff 본문 | 블록마다 `useDiffView`(구조화 패치 = 줄 원천 · 쌍 = 쌍 원천) → `DiffTable` · 실패 → `RawInput` | `DiffBody.render.test.ts`(현행) · lb1 · dt4 |
| `features/chat/harnesses/claude/transcript/tool-bodies/FileBody.tsx` | Read 본문 | 경로 넷(EP-21 ① · D-047) — `countLinesUpTo(text, 400) ≤ 400` 이면 `CodeBlock` + 창 메모 거터 제거(문자 수 무관) · 초과면 `<VirtualCodeView showLineNumbers maxHeight docKey revisionSource={call.result} tokenSource="view">`(1,000,000자 이하 창 메모 줄 · 초과 `codeView({ view })`) · 거터 제거는 `shared/compute/gutter.ts`(D-048) | lb2·lb3 · cs1·cs3·cs3b · `readBody.test.ts` rd1~rd3 |
| `features/chat/harnesses/claude/transcript/WorkToolBody.tsx` | Work 본문 | 컨테이너 `ref` · `payloadText` 메모 · Payload > 400줄 → `<VirtualCodeView scrollElement>` · 요청·응답 문서 id(EP-22) · 오류면 `tone="error"` · 파생 단계 메모(D-042 — `call.input`·`call.result` 키 · 상태·검색 포함 — rev 3) | lb4 · `workToolBody.virtual.test.ts` wk1~wk4 · cs2a~cs2d |
| `features/chat/harnesses/opencode/transcript/ToolBody.tsx` | OpenCode 파일 본문 | `open` 일 때만 본문 · `useDiffView`(patch·쌍) · 증감 = `summary` · 컨테이너 클래스 상수 · `ref` → `DiffTable scrollElement` | dt3 · cs4·cs6 |
| `features/chat/components/code/VirtualCodeView.tsx`(신규) | 가상 코드 | 줄 시작 색인(≤ 1,000,000자 메모 · 초과 `codeView`) · `useVirtualRows` · 행 `<div data-index data-virtual-index><span data-transcript-chrome>{n}</span><span data-virtual-text>…</span></div>` · `maxHeight`(자기 스크롤) \| `scrollElement` · 최소 폭 · `useWindowTokens`(지원 언어만) · 복사 가져가기·`CopyRowsHost` · 레지스트리 등록 · `tone` · 토큰 원천 prop(doc \| view — D-048) · `charsBefore`(창 메모 누적합 · 워커 창 — D-049) · 레지스트리 항목 — rev 3 | `VirtualCodeView.test.ts` x1~x7 |
| `features/chat/components/markdown/VirtualMarkdownView.tsx`(신규) | 가상 Markdown | `markdownDocumentBlocks` · `useComputeDocument('md:'+publicationId, revisionSource, source, 'markdown')` · `useVirtualRows` · 블록·조각마다 `markdown` 요청(화면 안 `visible` · overscan `background`) · pending·raw 원문 · `MarkdownHast`·`mergeTableChunks` · 요청 키 대조 · `tooLarge` → 블록(표 전체) 원문 · 남은 조각 취소(EP-12 ⑬ — rev 3) | `VirtualMarkdownView.test.ts` m1~m7 |
| `features/chat/components/markdown/WorkerMarkdownTail.tsx`(신규) | 꼬리 | EP-13 ②~⑦ | `WorkerMarkdownTail.test.ts` s1~s10 |
| `features/chat/components/markdown/StreamingMarkdown.tsx` | 스트리밍 | EP-13 ① 분기만 | s6 · `StreamingMarkdown.fence.test.ts` |
| `features/chat/components/transcript/TranscriptViewport.tsx` | 0326 뷰포트(계약 넓힘) | `handleCopy` 첫 줄 `isCopyClaimed` · `copyUnits` 로 동기/비동기 판정·단위 · `VirtualListRegistry` 제공 · `CopySerializationHost` 안 `VirtualCopyRange` · 살핌·조각(`slice`) 단위 · `prepareChunk`(D-049 — rev 3) | `transcriptCopyInner.test.ts` tc1~tc8 · 0326 테스트(VP-50) |
| `features/chat/components/transcript/CopySerializationHost.tsx` | 0326 호스트(계약 넓힘) | 자식 안 내부 목록에 `VirtualCopyRange` 문맥 | tc2·tc5 |
| `features/chat/lib/transcript/viewport/textOffset.ts` | 0326 오프셋(계약 넓힘) | `[data-virtual-skip-chars]` 합산(두 함수) | `textOffset.test.ts` to1·to2 |
| `features/chat/lib/transcript/viewport/copy.ts` | 0326 복사 작업(계약 넓힘) | 단위 목록(`CopyUnit[]`)을 받는 판 추가 — 블록 범위 호출(현행)은 그대로 · 훅 `prepareChunk`(마운트 앞 · task 밖 — D-049 rev 3) | `copy.test.ts`(현행 · VP-50) · cu3 · tc8 |
| `features/chat/harnesses/common/rightpanel/ArtifactPreviewContent.tsx` · `ArtifactViewer.tsx` | 산출물 | 뷰어가 스크롤 요소 getter 를 넘긴다 · 코드·텍스트 > 400줄 → `VirtualCodeView`(`code:artifact:`+publication) · Markdown > 4,000자 → `VirtualMarkdownView` · 그 밖 현행 | `ArtifactPreviewContent.render.test.ts` a4·a5 |
| `features/chat/dev/transcriptFixtures.ts` | 진단 다리(D-041) | `loadToolCardFixture(kind, card, lines)` · `setVirtualRows(enabled)`(내부 가상 목록 전부 마운트 + `onCopy` 끔 — S-C8 독립 기준) · `selectRows(listKey, a, b)` · 계측 읽기(`computeTimings()` — 가시 요청 대기·전송 문자) — `VITE_OO_DIAGNOSTIC` 일 때만 · 작업 계측 싱크 연결 + 요청 키별 첫 반영(`computeTimings()` — D-043) · fixture `edit-rewrite`·`read-long`(rev 3) | 기존 진단 다리 테스트에 fx1(같은 인자 같은 fixture) · fx2(첫 반영 시각) |
| `app/scripts/ui-thread-rules.mjs` · `check-ui-thread.test.mjs` | 경계 | EP-14 ①⑥ · ui1(UI 파일의 `remark-parse` import → 위반 1) · ui2(`client.ts` 밖 `new Worker(` → 위반 1) | `node --test scripts/check-ui-thread.test.mjs` |
| `app/scripts/measure-ui-inputs.mjs` · `.test.mjs` | 측정 | K1~K13 · K12 절차(D-050) · F6~F9 · 누락 재측정(§19) | `node --test scripts/measure-ui-inputs.test.mjs` |
| `app/package.json` | 의존성 | EP-14 ② | — |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 순수 파일: `protocol.ts` · `diffView.ts` · `diffDisplay.ts` · `markdownDocumentBlocks.ts` · `copy.ts`(`copyUnits` · `rowEndpoint` 는 가짜 DOM) · `worker/tokens.ts`·`worker/markdown.ts`(shiki·unified 만 — node 에서 실행, `highlighter.test.ts` 선례). 워커 상태는 `createWorkerState({ lane, clock })` 로 테스트가 직접 만든다(주입 시계 — AC4).
- 기존 메커니즘 재사용의 형상/시점: 위쪽 펼침 보정은 마운트된 앵커(펼친 gap 아래 첫 줄 — 사용자가 클릭한 gap 바로 아래라 화면 안)에 기댄다 — 워커 경로는 새 행 창 응답 뒤 layout effect 에서 한 번 보정한다(v5w). `revealDiffRequirement` 는 marker 가 마운트돼야 찾는다 — `scrollToIndex` 뒤 다음 프레임에 부른다(AC13). 현행 `buildDiffHunks`·`expandGap`·`revealDiffHunkLine`·`createDiffRequirementItem` 은 테스트 사본으로 남겨 새 모듈과 무작위 재생 대조한다(hx1·cx1).
- 순서를 관측할 훅/로그/주입 경계: 가짜 `WorkerLike` 가 레인별로 받은 메시지 배열(`doc.open` → 작업 순서 · AC2) · 가짜 워커가 `continue` 를 돌려 대기열 순서를 기록(AC4) · `react-markdown` 모듈 spy(AC23·AC26) · `useVirtualRows` `initialRect`(가시 높이 600) · `estimateSize`(20) · 가짜 Selection/Range 의 `setStart`·`setEnd`·`toString` 호출 기록(AC15·AC35).
- 0326 테스트 이음새와의 관계: 0326 의 `vi.mock('@tanstack/react-virtual')`(Timeline·TranscriptView 테스트)은 그 파일 안에서만 이 훅에도 걸린다 — 내부 목록은 transcript 진입점이 아니라 도구 카드 본문 안에서만 쓰이므로 그 테스트들의 단언 대상이 아니다(VP-47 이 transcript 단일 뷰포트를 잠근다). 0326 복사 테스트는 가져가지 않은 이벤트 경로라 그대로 돈다(VP-50).

## 12. End-to-end 영향

### producer → consumer

```text
agent(Git patch · 도구 이벤트) / data(산출물 미리보기) ──(현행 IPC, 변경 0)──▶ 창 store
  → 소비 컴포넌트(원천·ID·revision) ── 작은 원천: 창 동기 모델 / 큰 원천: 임차 ──▶ client 레인 등록부 ── doc.open(1회/레인 워커) ──▶ worker 문서
  → 마운트 범위 → 요청(tokens · codeView · diffView · diffLocate · diffContext · markdown) ──▶ worker 결과 ──▶ client 캐시 ──▶ 소비 훅(요청 키 대조) ──▶ 마운트 행
  → 복사: 끝점 → 가져가기 → 단위 → 마운트·직렬화 ──▶ 클립보드(Chromium 기본 복사 또는 clipboard.write)
```

- producer 기준: Git `GitDiffPatchFile.lines`(agent 파싱 · 상한 현행) · 도구 입력/결과(현행) · 산출물 `content`(data · 5MiB 상한 현행) · 스트리밍 꼬리(`advanceStableBlocks` 현행).
- consumer 파생 규칙: 모델·블록·줄 색인은 원천 객체(revision)마다 1회(EP-7·EP-21) · 마운트 범위는 `useVirtualRows`(EP-8) · 토큰·행 창·hast 는 요청 키가 같을 때만 반영(EP-16 ③).
- 파생 가능한 합성값이 정본을 우회하지 않는가: 복사 문자열은 Chromium 이 전체 마운트 DOM 에서 만든다(D-029 — 행 모델 문자열을 만들지 않는다). 카드 복사는 현행 `copyText(call)`(원천 입력). 폭은 원천 줄에서 센다(D-023). 증감 수는 모델 `summary`(원천 줄)다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `computeClient()` 소비 4곳(S1) | `request` 서명에 선택 인자 추가 · `diffLines`·`diffTokens` 종류 삭제 → `useDiffLines`·`useDiffSyntax` 가 `useDiffView`·`useDiffRowTokens` 로 바뀐다. `useHighlightedHtml` 은 그대로(줄 상한 옵션은 워커 쪽) · `ClientDeps` 에 `timings`·`now` 선택 인자(미지정 = 기록 0 — D-043) | AC1·AC6·AC31 · VP-44 |
| `setComputeClient`(테스트 주입) | 가짜 클라이언트가 `openDocument`·`setPriority` 를 갖는다 — 쓰지 않는 테스트는 영향 0 | VP-40·VP-42 |
| 워커 생성(`client.ts:263-272`) | 레인 2(`new Worker(` 호출 2) · 진입점 배선만 바뀐다(`state.handle`) · 규칙 (i) 그대로(`client.ts` 안) | AC28 gate · AC31 l1 |
| 테마 구독(S6) | 구독자가 `useDiffSyntax` → `useWindowTokens` 로 옮긴다 · `CodeBlock` 그대로 | AC17 · VP-44 |
| `DiffSyntaxContext` 소비(`LineText`) | `DiffRowTokensContext` 로 이름·값 형 교체 · 기본값 빈 함수 → 원문 | AC17 · VP-43 `diffSyntax.render.test.ts` |
| 0326 `TranscriptViewport` 복사 | `handleCopy` 가 가져간 이벤트를 건너뛴다 · 단위 목록이 블록 범위와 같으면 현행과 같은 작업 · `VirtualListRegistry` 제공(내부 목록 없으면 빈 등록부) | AC35 · VP-50 |
| `textOffset` 소비(0326 앵커·선택) | `data-virtual-skip-chars` 가 없는 DOM 에서는 결과가 현행과 같다 | to1 · VP-50 |
| `stripLineNumberGutter` 소비(`FileBody` · `lang.test.ts`) | 정의가 `shared/compute/gutter.ts` 로 옮기고 `features/chat/lib/lang.ts` 가 다시 내보낸다 — import 경로가 그대로라 소비처 변경 0 | VP-51 · `lang.test.ts` 3건 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 문서는 소비 컴포넌트 마운트(또는 원천 변경) 때 임차하고, 워커 전송은 그 문서를 쓰는 첫 작업 직전이다(EP-2 ②). 레인 워커는 그 레인의 첫 작업 때 생긴다.
- 취소/중단: 마운트 범위에서 빠진 창·블록의 대기 요청은 효과 정리가 취소한다. 실행 중 `tokens` 는 다음 양보 지점에서 버리고, 그 밖 작업은 끝까지(결과는 캐시 규칙), 쌍 원천 `diffView` 는 대기 요청이 있으면 계산 레인 워커 교체(D-024). 복사 작업은 새 복사·세션 전환·뷰포트 언마운트가 세대로 취소한다(0326 규칙).
- 종료/quit/crash/renderer-gone: 창과 함께 레인 워커가 사라진다(현행). 워커 `error`·`messageerror` → `fail`(현행 · 레인마다) + 그 레인 문서 `sent` 초기화(EP-2 ④).
- retry/timeout/partial failure: `unknown-doc` 은 문서 재전송 + 1회 재시도, 두 번째면 실패(소비자 원문·실패 표시). `continue` 는 실패가 아니다(연속 실패 0 으로). 시간 제한은 두지 않는다 — 50ms 예산·줄 상한·크기 상한이 대신한다. 용량 초과 문서는 회복 알림 뒤 다시 요청한다. 형식이 틀린 범위는 즉시 `range-invalid`(실패 — 소비자 원문), 문서 끝 뒤 범위는 빈 결과(실패 아님 — D-044). Markdown 결과 `tooLarge` 는 실패가 아니라 최종 원문이다(재요청 0 · D-045).
- cleanup/rollback: 임차 0 + 그 문서를 쓰는 작업 0 → `doc.close`(전송된 경우) → 워커가 파생(체크포인트·색인·모델·파생 축)을 함께 버린다(D-032). 소비 컴포넌트 언마운트 → 임차 해제. Work 결과 도착은 응답 문서만 새로 임차한다.
- **다중 저장소 쓰기**: 해당 없음 — DB·설정·파일 쓰기 0. 클립보드 쓰기는 0326 의 기존 경로(복사 1회 = 쓰기 1회)다. 문서 산출물의 판정 사본은 `plan.md` 와 `INDEX.md` 두 곳이고 INDEX 비고는 plan 을 가리킨다(상태·다음 주체·대상 커밋만 INDEX 가 정본).

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: tokens 응답 = 창 200줄 × 줄당 토큰(5만 줄 입력 평균 15 — M4) ≈ 3,000 토큰 ≈ 0.12M(캐시 상한 4M 안) · diffView 응답 = 창 ≤ 400행(70행 5,110B — M21) · codeView = 창 줄 문자열 · markdown 응답 = 블록 ≤ 50,000자의 hast(꼬리 50,000자 263,504B · 복제 2.74ms — M19) 또는 표 조각 ≤ 200행 · ≤ 1,000칸 · ≤ 50,000자(파싱 ≤ 35.1ms — M22c) · 어느 결과든 노드 ≤ 20,000(넘으면 `tooLarge` — D-045) · `diffLocate` 키·결과는 앵커 수에 비례(앵커당 키 ≤ 15자 — D-046).
- 새 요청 수의 `원천 상한 × 배치 상한`: 스크롤 한 번에 새로 드는 창 ≤ 축 수 × 2 · 먼 핀은 축마다 +1(AC17) · 문서 전송 = 문서 수 × 레인 워커 수명(교체마다 1회). 5만 줄 끝으로 바로 가면 전진 작업 ≈ ⌈50,000 × 0.42ms / 50ms⌉ ≈ 420개(작업마다 50ms · 사이마다 다른 요청 처리). 꼬리는 인스턴스마다 실행 1 + 대기 1(M19 — 100K자 스트림 작업 1,333 · 전송 합 5,486만 자 ≈ 복제 38ms 총합).
- 계산 레인 대기(D-043): 토큰 작업 한 번 ≤ 50ms + 한 줄(한 줄 최대 112.1ms — M17b) · 분할 불가 작업은 그 작업 전체(B20 — 쌍 jsdiff 는 입력에 따라 상한 없음, 현행과 같다).
- 모두 펼치기: 첫 paint 전 계산 = 근접 파일만(200 × 300 → 2파일 0.12ms · 4 × 50,000 → 1파일 — M16) · 나머지는 자리 높이만.
- 문서 전송 비용: 5만 줄 줄 문서 만들기 2.50 + 복제 0.83ms(M15) · 5MiB 코드 문자열 복제 ≈ 3.7ms(M3 비율) — 워커 경로 창 점유(M21 50,000줄 3.61ms).
- 보유 메모리: 체크포인트 ≈ 9.3KiB × ⌈줄 / 200⌉ × 테마 ≤ 2(5만 줄 ≈ 2.3MiB/테마 — M17d) · 줄 색인 4B/줄 · 모델 LRU 8 · 열린 원문 레인마다 ≤ 32,000,000자(두 레인 합 ≤ 64,000,000자) · 보기 문서 = 원천 원문 크기만큼 한 벌 더(원천 문서 닫기 때 삭제 — D-048).
- 구조적 목표: 없음(줄·파일 수 목표 없음).
- 캐시·호출 축소로 잃는 부수 효과: ① 화면 밖 행은 DOM 이 없어 브라우저 찾기(Ctrl+F)가 마운트 행만 찾는다 — 앱 찾기 기능 없음(`rg -n "find-in-page\|findInPage\|found-in-page" src` → 0, V1 세션) · Electron 기본 찾기 비활성이라 잃는 동작 없음으로 판단 — S-C1 이 확인 ② 모델·색인 메모는 원천 객체 identity 에 기댄다 — store 가 같은 patch 객체를 새로 만들면 재계산(현행 `receiveGitPatch` 는 새 세대에만 새 객체 — `chatReducer.ts:173-183`) ③ 문서를 워커에 두는 동안 그 문자열 메모리가 두 벌(창·워커)이다 ④ 닫힌 OpenCode 파일은 본문을 그리지 않아 닫힌 `<details>` 안 글자를 브라우저 찾기가 못 본다 — ①과 같은 판단 ⑤ 20,000자 이상 줄은 색이 없다(B15).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 외부·배포가 구현할 port/schema/config 를 바꾸지 않는다. 직접 의존성 선언(D-005)은 TRD §2 와 `app/AGENTS.md` 채택 목록에, 계산 워커 레인 2(D-034)는 실행 모델 문서에 적는다(EP-14).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 실행 중 취소 + 대기 요청 → 워커 교체 | 0324 `client.ts:9-10` · `client.test.ts:269` | D-024 · EP-4 ④ · AC6 | 변경 — 쌍 원천 `diffView`(jsdiff)로 좁힘(문서·체크포인트·모델 보존 근거 M4) |
| 창마다 계산 워커 1개 | 0324 `client.ts:263-272` | D-034 · EP-17 · AC31 | 변경 — 레인 2(계산 · Markdown) · 사용자 거부 가능 |
| 상한 없는 계산은 UI 스레드에 두지 않는다 | 0324 D-008 | §1 · D-027 · D-047 · B5 | 유지 — 큰 diff·코드는 워커, 창 동기는 상한 안(5,000줄 1.81ms · 1,000,000자 ≤ 4.6ms) |
| 워커 실패 시 UI 대체 계산 없음 | 0324 D-009 | §5 · §13 · VP-40 · EP-18 ④ | 유지 — 워커 경로 실패는 실패 표시·원문 폴백 |
| 강조 상한 32,000자 | 0324 D-012 | B4 · AC22 · D-031 | 유지 + 줄 상한 추가(20,000자 · 50ms) — transcript `CodeBlock` 은 그대로, 가상 코드 보기만 범위 토큰 |
| diff 문자 우선·카드 머리 예산 | 0325 D-008 · 0325 D-037 | §4 · VP-41 · D-027(쌍은 `withinDiffCap`) · D-047 | 유지 — 재사용 |
| 캐시 비용 = 키 + 워커 크기 | 0325 D-038 | B11 · VP-42 · D-035(`cacheable`) | 유지 — 키가 짧아지고 꼬리는 넣지 않는다 |
| C 의 워커 규약은 후속 구현 전에 합의 | 0325 D-021 | D-008 상태 칸 | 유지 — PR #643 검토가 합의 절차였다 |
| T22 W 열 "hunk·좌우 행·주석 위치 인덱스" | 0325 §6-D | D-027 · §6-C | 유지 — V1 D-011 이 어긋났고 rev 2 가 맞췄다 |
| 조건부 항목은 실측과 함께 현행 유지 종결 가능 | 0325 D-043 | D-016·D-017·D-039 | 유지 |
| features/chat 안 `useVirtualizer(` 1(transcript 단일 뷰포트) | 0326 EP-10 | F2 · EP-8 ① · VP-47 | 유지 — 새 훅은 `shared/ui/virtual/` |
| TanStack 크기 보정 끔(transcript) | 0326 D-056 | D-038 · EP-8 ⑥ · EP-24 | 유지 — 카드 내부 목록은 자기 요소라 기본 보정, Git 본문은 조정기가 한 곳에서 보정 |
| 스크롤 쓰기 금지 범위(transcript 스크롤 요소 소유 폴더) · 우측 패널·diff 스크롤 제외 | 0326 D-062 | 내부 목록은 자기 요소 · Git 조정기는 제외 범위(우측 패널) | 유지 |
| 복사 기준 = 전체 마운트 Chromium 기본 복사 · task 당 50ms · 직렬화 호스트 | 0326 D-087·D-094 | D-029 · D-040 · AC15·AC35 · S-C8 | 유지 — 내부 목록까지 넓힌다(`handleCopy` 는 가져간 이벤트를 건너뜀) |
| 상한 산출 보정 — 통과 표본 없음이면 미완료 · 실기 미달이면 상수 하향 뒤 재시험 | 0326 D-088 | D-050 · AC29·AC30 · K12 · S-C8 | 유지 — 내부 목록 복사 상한에 같은 절차를 쓴다 |
| 400줄 이하 도구 본문은 지금과 같다 | D-004(사용자 결정 질의 3) | D-047 ① · AC19 · B9 | 유지 — 400줄 이하 Read 는 문자 수와 무관하게 `CodeBlock`(질의 7) |
| 작업 50ms 예산 | 0324 D-007 · 0326 D-094 | D-043 · D-045 · AC4·AC36 · B20 | 유지 — 토큰 양보 간격과 레인 대기를 나눠 적고, 분할 불가 작업의 대기는 경계로 잰다 |
| 0326 B9 "워커는 단계 C" · B11 "큰 블록 안 나누지 않음" | 0326 §10 | D-006 · D-035 · D-026 | B9 는 이번에 닫고 B11 은 범위 밖 |
| 한 스크롤 소유자(Git 패널) · 위쪽 펼침 보정 · 문맥 펼침 키 보존 | 0211 D-073 · 0211 D-090 · 0211 D-058 | EP-9 ① · EP-24 · AC12 | 유지 — 보정은 조정기 한 곳 · 행 id `line:${i}`·`gap:${a}:${b}` 그대로(MD-11) |
| 그룹 스코프 격리 · Tailwind 토큰 · 새 CSS 금지 · 인라인 style 은 동적 값만 | `src/renderer/AGENTS.md` | §11 — 최소 폭·여백·자리 높이는 동적 값(인라인 style), 384px 은 Tailwind 클래스 상수 | 유지 |
| 의존성 추가는 사용자 승인 | `app/AGENTS.md` §의존성 정책 | D-005 · EP-14 | 승인됨(턴 1 질의 4) — rev 2 는 의존성을 더하지 않는다 |
| renderer 4-layer · feature 교차 금지 | `src/renderer/AGENTS.md` | §9 import 방향 — 공용 diff 규칙은 `shared/compute`, 요구사항 판정·보정 조정기는 features | 유지 |
| 테스트 소스 규칙(시간 예산·풀 분류) | `app/AGENTS.md` | §7-A 운영 gate | 유지 — 새 테스트는 unit 풀(자식 프로세스·SQLite 없음) · 시간은 주입 시계 |

- **교차검증 관측(`ACTIVE 결정 ↔ AC`)**: 충돌 0. D-001·D-002 ↔ §6-B 전 행(T08·T14·T15·T22·T23·T27·T33 + B9·B21) · D-003 ↔ 메타 착수 조건 · D-004 ↔ AC18("400줄 초과 … 384px … 400 이하는 현행 DOM")·AC19·AC20("카드 복사 버튼 문자열은 전체 원문") · D-005 ↔ AC23("창 remark 파싱 0 … 원문 즉시")·AC24("참조 링크 · 인용 연속")·AC28(의존성 4) · D-006 ↔ AC26 · D-007 ↔ VP-40~42·VP-44·VP-50 · D-008 ↔ AC1~AC7 · D-009 ↔ EP-5·AC1 · D-010 ↔ AC2("상한을 넘는 새 문서는 보내지 않고 … 용량이 돌아오면") · D-012 ↔ AC8 · D-014 ↔ AC3·AC17 · D-015 ↔ AC17("테마 전환은 마운트 창만 다시") · D-016 ↔ §6-B T33 · D-017 ↔ §6-B T23 · D-019 ↔ AC23·AC26·AC27("4,000자") · D-021 ↔ AC24·VP-23 f2 · D-023 ↔ AC16 · D-024 ↔ AC6("쌍 원천 `diffView` 만") · D-025·D-041 ↔ AC29·AC30 · D-026 ↔ §6 비범위·B3 · D-027 ↔ AC9("줄 ≤ 5,000 그리고 문자 ≤ 200,000 … 창은 파일 전체의 `DiffLine` 배열을 만들거나 받지 않는다")·AC13·AC17·AC18 · D-028 ↔ AC10("첫 paint 전 계산이 열린 파일 ≤ 2") · D-029 ↔ AC15("나란히 보기 부분 선택은 시작·끝 칸 오프셋을 지킨다")·AC35 · D-030 ↔ AC4·AC5·AC6·AC7 · D-031 ↔ AC4·AC31 ① · D-032 ↔ VP-48 · D-033 ↔ AC24·AC31 ③ · D-034 ↔ AC31 ② · D-035 ↔ AC26 · D-036 ↔ AC19·AC33 · D-038 ↔ AC12·AC14·AC34 · D-039 ↔ §6-B T08·B4 · D-040 ↔ AC15·AC35. SUPERSEDED D-011·D-013·D-018·D-020·D-022 를 근거로 하는 AC 문장 0(V1 AC9 "창이 한 번"·AC15 "행 모델 문자열"·AC10 "행 0(높이 자리만)" 은 rev 2 문장으로 바뀌었다). rev 3: D-042 ↔ AC32("5MB 객체 응답 최초 펼침: ② 1 · ③ 0 · ④ 0") · D-043 ↔ AC4("양보 간격")·AC36 · D-044 ↔ AC3("`max(0, min(end, 줄 수) − start)`") · D-045 ↔ AC24·AC31 ③④ · D-046 ↔ AC1("`anchorsKey`")·AC9("퇴거됐거나 워커가 교체된 뒤") · D-047 ↔ AC19("400줄 이하는 문자 수와 무관하게 현행 `CodeBlock`")·AC32 · D-048 ↔ AC19("③④ 의 토큰 원천 = 보기 문서") · D-049 ↔ AC15·AC35 · D-050 ↔ AC29·AC30 · D-051 ↔ AC10·AC14. SUPERSEDED D-037 을 근거로 하는 AC·EP 문장 0(AC32·EP-21 ① 은 rev 3 문장).
- **같은 대상 여러 절 대조**: 임계 400 — D-004·D-028(D-013 규칙 승계)·AC10·AC18·AC19·AC22·EP-11·§11 이 모두 "400 초과 = 가상, 이하 = 현행" 이다. 384px — D-004·AC18·AC19·§10-A 상수 · Work 250px — D-036·AC33·EP-22(384px 0). 4,000자 — D-019·AC23·AC26·AC27·EP-12 ⑫·EP-13 ①. 50,000자 — D-033·D-035·AC26·AC31·EP-12 ③·EP-13 ⑥·B13·B14. 표 200행·2,000행 — D-033·AC24·AC31·EP-12 ②③. 5,000줄·200,000자 — D-027·AC9·EP-18 ①·B5·M21. 1,000,000자 — D-047 ②·AC22·AC32·EP-21 ①⑤·B17·B21. 창 200줄 — D-014·AC3·AC17·§10-A·EP-4 ⑦·EP-16 ①. 50ms 예산 — D-031·AC4·§10-A·EP-3 ③·§14. 줄 상한 20,000자·50ms — D-031·AC31 ①·EP-3 ④⑦·B15. rev 3: 노드 예산 20,000 — D-045·AC31 ④·EP-12 ⑬·B2·B14 · 칸 1,000 — D-045·AC31 ③·EP-12 ②③·M22c · 400줄 이하 Read — D-047 ①·AC19·AC32·EP-21 ① · 범위 규칙 — D-044·AC3·EP-3 ⑥·EP-4 ⑦·§10-A · 모델 체류 — D-046·AC9·EP-23 ③.

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Git 패널 가상화가 기존 상호작용(위쪽 펼침·요구사항·초안·선택)을 깨뜨린다 | 400행 이하·5,000줄 이하 파일은 현행에 가까운 동기 경로(D-013·D-027) — 기존 렌더 테스트 전부가 소형 경로(VP-43). 행·펼침·위치·문맥 규칙은 현행 함수와 무작위 재생 대조(hx1·cx1). 400행 초과 경로는 v1~v12 가 상호작용마다 잠근다 |
| 워커 경로의 비동기 행이 첫 화면·펼침·이동을 늦춘다 | 5,000줄 이하는 창 동기(M21) · 대기 표시(B20) · 가시 요청 `visible` 등급 · 계산 레인 작업 50ms 양보(AC4) |
| 블록 렌더가 전체 렌더와 다르다 | 블록 규칙 rev 2(D-033) — 문서 717개 717/717(M13b) + fixture 대조(AC24) · 남는 차이는 B10 |
| 워커 hast 경로가 react-markdown 과 갈라진다(버전 업 등) | react-markdown `post` 의 같은 단계만 재현(D-021) · fixture 대조가 react-markdown 출력과 직접 비교 — 버전이 바뀌면 f1 이 red |
| 체크포인트·모델 메모리 | 테마 사슬 2 · 모델 LRU 8 · 문서 닫기에서 파생 삭제(D-032 · VP-48) |
| 0326 r3 가 같은 파일을 바꾼다 | 착수 조건 D-003 · 착수 턴이 §18 과 §8 줄 참조를 0326 PASS 커밋으로 다시 대조 · 0326 복사 계약은 넓히기만 한다(VP-50) |
| 복사 통합이 0326 의 복사 경로를 깨뜨린다 | 가져가지 않은 이벤트는 현행 경로 그대로(VP-50) · 단위 목록이 블록 범위와 같으면 현행 작업과 같음(cu3) · Chromium 문자열은 S-C8 이 독립 기준과 대조 |
| 워커 두 개의 메모리 | Markdown 레인은 shiki 를 싣지 않는다(진입점 분리) · 열린 원문 레인마다 상한(D-010) |
| 줄 상한이 강조 출력을 바꾼다 | 20,000자 이상·시간 상한 줄만(B15) · 사용자 거부 가능(D-031) |
| 브라우저 찾기가 화면 밖 행을 못 찾는다 | §14 ①④ — 잃는 동작 없음 판단, S-C1 이 확인 |
| TanStack 측정과 위쪽 펼침 보정이 겹친다 | Git 본문은 TanStack 크기 보정 끔 + 조정기 한 곳(D-038 · AC34) · v5·v5b·sc1 이 두 단계 뒤 앵커 위치를 단언 |
| 표 조각 예산이 넓은 표를 많은 작업으로 나눈다 | 조각마다 ≤ 35.1ms · 합은 한 번 파싱보다 작다(200 × 50: 254.7 vs 2,540.1ms — M22c) · 조각 합침 = 전체(f3b) |
| 노드 예산이 서식 있던 큰 블록을 원문으로 바꾼다 | 노드 > 20,000 블록만(촘촘한 목록·강조 ≈ 27,000자 이상 — M22d) · 사용자 거부 가능(D-045) |
| 블록 안 여러 목록 복사가 0326 조각 작업을 바꾼다 | 블록 범위 호출은 그대로(VP-50) · 준비 단계는 task 밖 · 조각 마운트 행 ≤ 상한(tc6~tc8) |
| 큰 쌍 diff 가 계산 레인을 오래 잡는다 | 현행과 같다(M23 — 현행 `diffLines` 작업) · 계측으로 S-C9 가 따로 적는다 · jsdiff `timeout` 은 후보(§4-B 범위 밖 관찰 ②) |

- 되돌리기 어려운 결정: 없음 — 공개 IPC·저장 형식·DB 변경 0. 의존성 선언은 `package.json` 줄이다. 워커 레인은 클라이언트 내부 구조다.
- 신규 의존성: `unified`·`remark-parse`·`remark-rehype`·`hast-util-to-jsx-runtime` — 사용자 승인(D-005). 이미 `node_modules` 에 있는 react-markdown 전이 의존성이라 설치 산출 변화는 lock 의 직접 표기뿐이다. rev 2·rev 3 추가 0.

## 18. 영향 받는 파일 / 문서

- **직접 수정·신규(0327 소유)**: `app/src/renderer/src/shared/compute/{protocol,limits,client,documents,diffView,diffDisplay,gutter,fakeClient.testfixture}.ts` · `shared/compute/worker/{state,handler,tokens,markdown,compute.worker,markdown.worker}.ts` · `shared/ui/virtual/{limits,useVirtualRows,copy,registry}.ts` · `shared/ui/virtual/CopyRowsHost.tsx` · `shared/ui/markdown/{markdownComponents,Markdown,MarkdownHast,CodeBlock}.tsx` · `features/chat/lib/{diffDisplay,diffSyntax,markdownDocumentBlocks,lang}.ts`(`lang.ts` 는 거터 제거 다시 내보냄) · `features/chat/hooks/{useWindowTokens,useDiffView,useDiffRowTokens,useScrollCorrection}.ts` · `useDiffSyntax.ts`·`useDiffLines.ts`(삭제) · `features/chat/harnesses/common/rightpanel/{FileDiffSection,DiffReview,ArtifactPreviewContent,ArtifactViewer}.tsx` · `features/chat/harnesses/common/transcript/DiffTable.tsx` · `features/chat/harnesses/claude/transcript/{WorkToolBody.tsx,tool-bodies/DiffBody.tsx,tool-bodies/FileBody.tsx}` · `features/chat/harnesses/opencode/transcript/ToolBody.tsx` · `features/chat/components/{code/VirtualCodeView.tsx,markdown/VirtualMarkdownView.tsx,markdown/WorkerMarkdownTail.tsx,markdown/StreamingMarkdown.tsx}` · `features/chat/dev/transcriptFixtures.ts`
- **0326 계약을 넓히는 파일(통합 검증 — VP-50)**: `features/chat/components/transcript/{TranscriptViewport,CopySerializationHost}.tsx` · `features/chat/lib/transcript/viewport/{textOffset,copy}.ts`
- **재사용(변경 0 · F1)**: `features/chat/harnesses/claude/transcript/ToolCard.tsx` · `features/chat/lib/markdownBlocks.ts` · `shared/compute/inline.ts` · `features/chat/lib/{diffHunks,diffViewport,diffRequirementScroll}.ts` · `features/chat/harnesses/common/rightpanel/diffRequirements.ts`(위치 색인 의미의 원본 — 테스트 대조 기준)
- 테스트: §11 seam 칸의 신규 파일(rev 3 `readBody.test.ts` 포함) + 수정(`client.test.ts:269`·k5 입력 · `handler.test.ts` · `diffSyntax.test.ts` · `diffSyntax.render.test.ts` 가짜 응답 형상 · `CodeBlock.render.test.ts` · `ArtifactPreviewContent.render.test.ts`)
- `app/scripts/{ui-thread-rules.mjs,check-ui-thread.test.mjs,measure-ui-inputs.mjs,measure-ui-inputs.test.mjs}` · `app/package.json`(+ lock)
- 문서: `docs/TRD.md`(§2 마크다운 행) · `app/AGENTS.md`(채택 목록) · `docs/arch/execution-model.md`(계산 워커 행 — 레인 2) · `docs/arch/frontend/design-components.md`(카탈로그 — `VirtualCodeView` · `VirtualMarkdownView` · `MarkdownHast` · `useVirtualRows` · `CopyRowsHost` 행, `DiffTable`·`FileDiffSection`·`CodeBlock`·`WorkToolBody` 행의 가상 규칙)
- 미접촉: `app/src/main/**`(agent `git-diff-parse.ts` · data `artifacts/formats.ts` 포함) · `app/src/shared/**` · `app/src/preload/**`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드 · §로컬 확인 · `src/renderer/AGENTS.md`(4-layer · 스타일 · 디자인 시스템).
- ABI/네트워크 등 환경 제약: 이 환경은 Electron 바이너리 403 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. DB 로드 스위트 실패는 환경 서명으로 분리(0326 PASS 커밋과 실패 집합 차집합 ∅).
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트(수정 루프): `./node_modules/.bin/vitest run src/renderer/src/shared/compute src/renderer/src/shared/ui/virtual src/renderer/src/shared/ui/markdown src/renderer/src/features/chat/lib src/renderer/src/features/chat/hooks src/renderer/src/features/chat/harnesses/common src/renderer/src/features/chat/harnesses/claude src/renderer/src/features/chat/harnesses/opencode src/renderer/src/features/chat/components`.
- IMPL_DONE 전 마지막 gate: §7-A 운영 gate 표 전부(가드 5 · lint · typecheck · 필터 없는 vitest · `node --test scripts/*.test.mjs` · 빌드 + 두 스모크).
- 사람 실기: AC30(아래).

### 측정 — K1~K13 함수 재측정 (WU-10 · `measure-ui-inputs.mjs`)

| ID | 입력(결정적) | 재는 것 | 0326 PASS 트리 |
|---|---|---|---|
| K1 | F5 Git 50,000줄(`gitFileContent`) → 패치 줄 · 요구사항 200 | `buildDiffView` + `diffViewRows`(70행) + `diffViewLocate`(200) — 동기 경로 판정 경계 5,000/5,001줄 표 포함 | `N/A(함수 없음)` — 대조는 `patchLinesToDiffLines` + `buildDiffHunks` + 현행 `counterpartOf` 전 행 |
| K2 | 같은 파일 · 축 문서 | 워커 `tokensRange`(실제 시계) — 창 [0,200) 첫 요청 · [49,800, 50,000) 전진 작업 수·작업 최대 시간·합계 | `N/A(함수 없음)` — 대조는 현행 `compute(diffTokens)` |
| K3 | F6 Markdown 1MB(합성 — 제목·문단·목록·표·펜스) | `markdownDocumentBlocks` · 워커 `markdownBlock` 첫 30블록 합 | 대조 `renderToString(Markdown)` 전체 |
| K4 | 꼬리 loose list 4,000 · 20,000 · 50,000자 | 워커 파싱 + `MarkdownHast` 렌더 | 대조 `renderToString(Markdown)` |
| K5 | F7 코드 5MiB(약 10만 줄) | `VirtualCodeView` 줄 시작 색인·폭(창) · 워커 `codeView` 첫 창 | 대조 `CodeBlock` plain 줄 번호 식 |
| K6 | 경로 200개 | `buildChangedFileTree` + `visibleTreeRows`(T23 기록) | 같은 함수 |
| K7 | 990,044자 patch | `unifiedDiffLines`(B21 기록) | 같은 함수 |
| K8 | 32,000자 TS · 32,000자 minified JS 한 줄 | 워커 `highlight`(T33 기록 · 줄 상한 전후) | 같은 함수(줄 상한 없음) |
| K9 | minified JS 한 줄 5,000 · 20,000 · 1,000,000자 · JSON 한 줄 1MB | `tokensRange` 작업 최대 시간(예산 + 줄 상한) | 대조 `codeToTokens` 기본 옵션 |
| K10 | F9 표 1,600행 · 2,001행 · 각주 문서 60K자 · 큰 셀 200행 × 3열 × 1,000자 · 넓은 표 200 × 50 · 501열 · 촘촘한 블록 30,000자(목록·강조) | 조각 파싱 합·조각 최대 · 조각 칸·문자 · 결과 노드·전송 바이트·반영(복제 hast → React SSR) · 상한·노드 예산 원문 판정(D-045) | 대조 한 번 파싱 |
| K11 | Read 1,000,000 · 5,000,000자 · Work payload 1MB·5MB(문자열·객체) · 구조화 패치 50,000줄 | 카드 파생 1회 비용 · 경로 판정(창 / 워커) | 대조 현행 렌더마다 비용 |
| K12 | 행 100~2,000(100 간격 · 20 크기) — Git 인라인·나란히 · `DiffTable` · `VirtualCodeView` | 종류마다 복사 마운트 + 직렬화(렌더 하네스 대리) 중앙값 · 모든 종류에서 ≤ 50ms 인 최대 → 두 상수(D-050). 100 도 넘으면 `통과 표본 없음` — AC15·AC35 미완료(재구현) | `N/A(함수 없음)` |
| K13 | 계산 레인 분할 불가 작업 — 쌍 jsdiff(비슷한 5만 줄 · 전부 다른 2,000 + 2,000 · 5,000 + 5,000줄) · 5만 줄 diff 모델(`buildDiffView`) · 5MiB `codeView` · 32,000자 `highlight` | 작업마다 점유(시작 → 끝) — S-C9 의 기대값 표(D-043 · B20) | 대조 현행 `diffLines`·`highlight` · 나머지 `N/A(함수 없음)` |

### 사람 실기 — AC30 측정 규약 (0325 §19 · 0325 D-042 · D-041)

- 빌드: 0326 기계 PASS 커밋 빌드(이전)와 0327 구현 빌드(이후)를 같은 Windows 장비·같은 배율·같은 주사율에서 교차 3회씩. 이전 빌드에서 못 하는 조작은 `N/A(실패: 관측)`.
- 관측 표 둘 — **설치본**(`build:win`): `perf.stall` 수·최댓값 · 오류 로그 · 복사 문자열(OS 클립보드). **진단 빌드**(`VITE_OO_DIAGNOSTIC=1` · React profiling · 비압축): trace(Interactions·Frames·Layout) · Profiler commit · 진단 다리 계측 `__ooDev.computeTimings()`(가시 요청 대기·전송 문자) · 마운트 행 수. 두 표는 섞어 비교하지 않는다.
- 재현 입력: `node scripts/measure-ui-inputs.mjs --write-inputs <폴더>` 가 F5(Git 저장소 50,000줄 추가 파일 — 현행) · F6(Markdown 1MB) · F7(코드 5MiB) · F8(파일 200개 저장소) · F9(표 1,600행·2,001행 · 각주 60K자 · JSON 한 줄 1MB)을 쓴다. 도구 카드 입력은 진단 빌드의 `__ooDev.loadToolCardFixture(kind, card, lines)` — Claude Code `write`(50,000줄) · `edit`(5,000 + 5,000줄) · `multiedit`(50 × 400줄) · `read`(2,000줄 × 2,000자) · Claude Work `work`(요청·응답 각 5,000줄 JSON) · OpenCode `file`(patch 15,000줄) · Claude Code `edit-rewrite`(5,000 → 5,000줄 전부 다름 — 쌍 jsdiff 최악) · `read-long`(300줄 × 5,000자 · 거터 포함 — 400줄 이하 · 100만 자 초과). 설치본은 같은 fixture 를 쓰지 못하므로 카드 시나리오는 진단 빌드 값만 적고 설치본 칸은 `N/A(fixture 진단 전용)` 이다.
- 누락 표본 재측정: trace 저장 실패·측정 도구 오류로 표본이 비면 같은 빌드·같은 시나리오를 최대 2회 다시 재고 시도 수를 적는다. 그래도 비면 `N/A(누락: 사유)`. 0327 빌드의 기능 실패는 N/A 가 아니라 verify 결함 후보다(0325 §19 N/A 규칙).

| ID | 하네스 | 재현 | 조작 | 기록 |
|---|---|---|---|---|
| S-C0 | Claude Code(Git 패널 + 대화) | F5 + 스트리밍 프롬프트(loose list 300항목 이상) | F5 파일 펼친 채로 전송 → 스트리밍 중 한글 200자(IME 조합) + 휠 10초(Git 패널·대화 번갈아) | 펼침 → 첫 가시 행 paint · 입력→paint p95/최대 · 휠→paint p95/최대 · 가시 워커 요청 대기 p95/최대(진단) · 전송 문자(문서·결과 — 진단) · 마운트 행·commit · `perf.stall` |
| S-C1 | Claude Code(Git 패널) | F5 | 파일 펼침 → 휠 10초 → 나란히 전환 → 끝 근처 줄 요구사항 추가·초안 10자 → 1번 줄~끝 근처 선택(정·역방향) | 펼침 → 첫 행 paint · 스크롤 입력 → paint p95/최대 · 초안 키 입력 → paint p95 · 마운트 행 수 · Ctrl+F 동작 여부 |
| S-C2 | Claude Code(Git 패널) | F8 | 모두 펼치기 → 휠 10초 | 펼치기 → paint · 계산이 열린 파일 수(진단) · 마운트 행 수 · `perf.stall` |
| S-C3 | Claude Code · Claude Work · OpenCode(도구 카드) | `loadToolCardFixture` 6종 | 카드 펼침 → 내부 스크롤(Work 는 컨테이너) → 카드 복사 | 펼침 → paint · 스크롤 p95 · 복사 문자열 길이 = 원문 · Work 휠·키보드 소유(관찰) |
| S-C4 | 산출물 뷰어 | F6·F7·F9 를 산출물로 게시하도록 요청 | Markdown 미리보기 열기 → 휠 → 코드 모드 전환 → 휠 | 열기 → 첫 블록 paint · 원문 → 서식 교체 시간 · 원문 표시 블록 수(F9 — 상한·노드 예산) · 블록 결과 반영 commit 최대(진단) · 스크롤 p95 |
| S-C5 | Claude Code · OpenCode | loose list 300항목 이상 답변 요청 | 스트리밍 중 한글 타이핑 · 휠 | delta → paint p95 · 50ms/160ms 구간 수 · 꼬리 요청 수(진단) |
| S-C6 | Claude Code | 코드 블록 20개 이상 답변 | 테마 전환 2회 | 전환 → 전부 색 paint · DOM 교체 구간 · `perf.stall` |
| S-C7 | Claude Code | S-C1 의 F5 끝으로 바로 이동 직후 코드 블록 답변 수신 | 끝 이동 → 새 답변 | 새 코드 블록 강조까지 시간 · 가시 요청 대기(진단) |
| S-C8 | Claude Code(Git 패널 · 대화) | F5 · `loadToolCardFixture('claude-code', 'write', 401)` · `…(400)` · `('claude-work', 'work', 5000)` · `('claude-code', 'read-long')` · 카드 둘을 담은 도구 묶음 블록 | 독립 기준(`__ooDev.setVirtualRows(false)` + `setVirtualization(false)` — 전체 마운트 · `onCopy` 끔) vs 0327 기본에서 같은 선택: Git 400행·401행 파일 정·역방향 부분 선택 · 나란히 부분 선택 · 파일 경계 · 카드 안(401줄) · 대화 문단 → 카드 안(경계 횡단) · Work 요청 → 응답 · 응답 → 다음 문단(정·역방향) · 두 카드 사이 · Read 거터 입력 · 동기(≤ 상한)·비동기(> 상한) · 상수는 산출 상한 · 상한 + 1 · 500 셋으로 | OS 클립보드 `text/plain` = 기준 · 약속 HTML(블록 요소 순서·표시 텍스트) = 기준 · 복사 뒤 선택·초점이 복사 전과 같음 · 핸들러·조각 task 최대(진단) — 상한 크기 조각 task > 50ms 면 D-050 하향 → S-C8 재실행 |
| S-C9 | Claude Code(대화 · Git 패널) | `loadToolCardFixture('claude-code', 'edit-rewrite', 5000)` · F5 | ① `edit-rewrite` 카드 펼침 직후 코드 블록 20개 답변 수신 ② F5 파일 근접 진입(5만 줄 모델) 직후 코드 블록 답변 수신 — 각 교차 3회 | 선행 작업 점유(`endedAt − startedAt`) · 새 가시 요청 대기(`startedAt − enqueuedAt`) p95/최대 · 첫 paint(요청 → 반영) p95/최대 — 세 값을 따로(진단 `computeTimings()`) · `perf.stall`(설치본) |

- 기록 완결이 AC30 의 완료다 — 허용치 판정은 W(0325 D-025 OPEN). S-C8 의 문자열 불일치는 기록이 아니라 verify 결함 후보다(D-029). S-C8 상한 크기 조각 task 가 50ms 를 넘으면 기록만으로 닫지 않는다 — 상수를 낮추고 S-C8 을 다시 돌려 통과해야 한다(D-050).

## READY self-review

- [x] Decision Ledger — D-001~D-051, 사용자 결정 8건(질의 7 · PR #643 "합의안")은 원문 인용(§3). SUPERSEDED 6(D-011·D-013·D-018·D-020·D-022·D-037 — 대체 ID·이유 칸 있음) · OPEN 0(관측: §3 상태 열).
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §1 한 문장 · §4-A 판정 · §5 흐름 · §6-B 판정.
- [x] 조건절·이유절을 재해석하지 않았다 — D-004 "400줄 이하는 지금과 같다" → AC18·AC19 "400 이하는 현행". D-004 의 384px 을 Work 에 적용하지 않은 것(D-036)과 D-005 "창 파싱 0" 의 범위를 D-019·D-033 으로 정한 것은 설계자 결정이고 "사용자 거부 가능"으로 표시했다. PR #643 "합의안" 문장은 D-027 에, 질의 7 의 "앱 화면이 바로 지움" 선택지 문장은 D-047 에 원문 그대로 인용했다.
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design — §16 교차검증 관측(D-027~D-041 포함).
- [x] AS-IS 와 TO-BE 가 같은 축(§9 Delta 9행).
- [x] Delta 각 행 → 구현 파일(§11) 또는 AC.
- [x] AS-IS 에서 사라진 책임 — `diffTokens`·`diffLines`·`useDiffSyntax`·`useDiffLines`·`counterpartOf`·전 종류 워커 교체·렌더마다 카드 파생 → §9 "제거/대체".
- [x] 수치·전칭·앵커·테스트 인용 실측 — §8 M1~M25 · F1~F36 · S1~S17 · 검산.
- [x] 각 AC 행동 단언·검증·경로 — §7 표(AC1~AC36).
- [x] Baseline V(상속 없음 · rev 2·rev 3 은 구현 전 정정) — §7-A.
- [x] 모든 NEW·CHANGED 노드에 같은 레벨 REQUIRED pair — R-01~09 ↔ VP-01~09 · SD-01~06 ↔ VP-10~15 · AR-01~07 ↔ VP-20~26 · MD-01~14 ↔ VP-30~39·VP-48·VP-49·VP-51.
- [x] 영향받은 INHERITED 는 REGRESSION(VP-40~47 · VP-50) · NOT_REQUIRED 없음.
- [x] pair 마다 경로·§10 분모·좌표 · 적대 증거 선택 이유 — §7-A 표의 EP 수는 §10-B 자리 수와 같다(EP-1 10 · EP-2 10 · EP-3 7 · EP-4 8 · EP-5 15 · EP-6 2 · EP-7 5 · EP-8 12 · EP-9 8 · EP-10 7 · EP-11 6 · EP-12 13 · EP-13 7 · EP-14 6 · EP-15 2 · EP-16 7 · EP-17 6 · EP-18 4 · EP-19 6 · EP-20 10 · EP-21 6 · EP-22 4 · EP-23 5 · EP-24 4 · EP-25 5).
- [x] 규칙 칸 분기 ↔ 입력 — EP-6 ①(삭제 묶음·추가 묶음·그 밖) ↔ cp1 전수 · EP-7 ②(초기 문맥·펼침·드러내기·gap 방향) ↔ hx1 무작위 재생 · EP-12 ①(합치기 다섯 · 끝 개행 · 각주) ↔ mb1~mb9 · ②③(조각·상한 셋) ↔ mb10·m6 · EP-2 ③⑤⑨⑩ ↔ d5~d8 · EP-4 ②③④⑥⑦(등급·양보·쌍 원천·승격·범위) ↔ q1~q10 · EP-13 ③④⑤⑥ ↔ s3·s4·s7·s10 · EP-18 ①(줄·patch·쌍) ↔ dv1 · EP-21 ①⑤(상한 안·밖) ↔ cs1·cs3·x6 · rev 3: EP-4 ⑦(정수 아님 · start < 0 · end < start · 길이 초과) ↔ q8·q8b · EP-3 ⑥(빈 범위) ↔ t7 · EP-12 ②(행·칸·문자 세 예산) ↔ mb11(기본 · 큰 셀 · 넓은 표) · ③(열 > 500 · 머리 + 한 행 > 50,000자) ↔ mb11 · ⑬(노드 예산 안·밖) ↔ mw6·m7 · EP-19 ④⑥(근처 이탈 · 측정 높이) ↔ ea3 · EP-20 ③(blocks·probe·slice) ↔ cu5·cu6·tc8 · EP-21 ①(경로 넷) ↔ rd1·cs3·cs3b · ②(객체·문자열·text 배열·합성 응답) ↔ cs2a~cs2d.
- [x] 선언 경계(측정한 것만) — B1~B24(B6·B7 삭제 표시 · rev 3 정정 B2·B14·B15·B16·B20) · 열린 입력 집합 판정 산출물 해당 없음.
- [x] INDEX `## 새 handoff 후보` 겹침 — 0325 행(C 승격 → 0327) · 0326 B28 행(`chatReducer` — 0327 미접촉) · transcript 펜스 400줄 초과 가상화(D-039)는 기존 0327 행(D-026)에 합쳤다(handoff별 1행) · rev 3 은 후보 행을 더하지 않았다(§4-B 범위 밖 관찰 셋은 이 plan 에 둔다).
- [x] 운영 gate — §7-A 표 · 기준선 분리는 0326 PASS 커밋 기준.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC30 은 Windows 시간·paint·Chromium 클립보드 문자열만(B22).
- [x] semantic 목표 ↔ structural proxy — 마운트 수(AC10)는 "게이트 늘 열기" 변이 red 로 방향 확인(VP-01) · "창 파싱 0"(AC23·AC26)은 spy 계수 + import 0 짝 · 복사는 Chromium 문자열을 S-C8 독립 기준과 대조 · 단계 계수(AC32)는 단계 함수 spy 이고 메모 키를 합성 객체로 바꾸는 변이(cs2c)로 방향 확인.
- [x] 신규 계약 SSOT·강제 지점·seam — §10-A · §11.
- [x] 부팅/등록 변경 소비처 — §12 표(레인 · 0326 복사 · textOffset 포함).
- [x] producer/consumer 양쪽 — §12.
- [x] 상한·총량 — §14(행 창 · 꼬리 · 모두 펼치기 · 보유 메모리).
- [x] 게이트 명령 = `app/AGENTS.md` 현행.
- [x] `ACTIVE 결정 ↔ AC` 대조 관측 — §16.
- [x] 산출물 문장 규칙 — rev 2·rev 3 이 새로 쓴 표 칸은 관측·좌표를 붙였고, 길이 상한을 넘는 V1 원문 칸은 일괄 재작성하지 않았다(`docs/handoff/AGENTS.md §산출물 문장 규칙` 3).
---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- AC21을 구현했다. 일반 텍스트 줄 번호를 표시할 때만 코드별로 계산한다.
- PLAN_GAP G1 (VP-52, ΔV2 V2-6). s14는 4,000자 이하 새 꼬리로 교체하면서 WorkerMarkdownTail을 언마운트한다. 표에서는 접두 검사만 제거하면 늦은 응답으로 줄이 두 번 보여야 한다고 요구한다. 언마운트 시점에 이미 응답이 갱신할 뷰가 사라진다.
- D-055의 사용자 동작과 s14의 정상 기대값은 일치한다. 정정 대상은 V2-6의 실패 기대다. s15는 같은 인스턴스를 유지하게 명시했으므로 접두 검사 제거를 검출할 수 있다.
- 착수 대조 결과 Claude 라이브 행은 세션별 키를 갖고 TranscriptViewport가 block.key로 마운트한다. 따라서 bg3에서도 A 인스턴스 소멸이 별도 방어다. React DOM 최소 재현에서 접두 검사 없이 늦은 A 갱신을 전달한 화면 텍스트는 같은 인스턴스 A-late, 짧은 꼬리 교체 후 short, 세션 키 교체 후 B였다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-37 | AC21 줄 번호 | EP-15 ①② | plain 줄 번호 메모, HTML 경로 CSS 카운터 | CodeBlock.compute.test.ts cb1 · CodeBlock.render.test.ts | 최초 렌더 + 재렌더 10회 split 1회, 코드 변경 시 번호 갱신 | 지정된 테마 변이 검증 |

- §10 자리 목록 밖에서 본 운반 자리: 이번 수정에서 해당 없음
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(verify 0회)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-37 | REQUIRED | SELF_BLOCKED | cb1 및 기존 plain 렌더 테스트 | 메모 제거 검출. 지정 테마 변이 미실행 |
| VP-52 | REQUIRED | SELF_BLOCKED | EP-13 ④⑤, V2-6, s14·s15·bg3 | G1. 설계자 정정 필요 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 줄 번호 메모의 의존성 배열 제거 | cb1 | 최초 | cb1 1건, split 11회 | 검출. 복원 후 1회 |

- **분모 검산**: SELF_PASS 0, 닫은 이슈 0, 새 oracle 1, 추가 sweep 0 = 1행
- **덮개 회귀**: 최초 턴

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 | 줄 번호 값과 마크업 유지 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 줄 번호 계산만 자식에 위치 | effect 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 | 동기 계산 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 해당 없음 | 동기 계산 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 꼬리 구현 전 | G1을 설계자로 환류 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| G1 | V2-6 실패 기대가 s14의 언마운트와 충돌 | s14·bg3은 수명 격리 회귀로 유지하고, 접두 제거 검출은 s15에 배정하도록 설계자에게 제안 | ΔV2 EP-13 ④⑤, VP-52 |

### 설계 대비 명시적 차이

- cb1은 마운트를 유지하는 기존 CodeBlock.compute.test.ts 하네스에 두었다. CodeBlock.render.test.ts는 정적 렌더다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 코드 변경 | 새 코드 한 줄에 번호 1 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 | 인스턴스 로컬 메모 |
| 재진입 | 같은 코드 재렌더 | cb1에서 계산 횟수 1회 |
| 다른 무효화 축 | 일반 텍스트와 강조 HTML 분기 | 기존 compute 스위트 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | CodeBlock.tsx, CodeBlock.compute.test.ts, 이 plan과 INDEX |
| 실행 명령 | app에서 vitest run CodeBlock.compute.test.ts CodeBlock.render.test.ts StreamingMarkdown.fence.test.ts |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | 3파일 42테스트 통과. UI 경계·테스트 예산·문서 인벤토리·명칭 가드 통과. 마이그레이션 동기 통과, 이전 릴리스 태그가 없어 append-only 비교 생략 |
| **추가·수정 테스트의 subtree 규칙** | app/AGENTS.md 및 renderer/AGENTS.md. 기존 가짜 DOM과 계산 클라이언트 재사용 |
| V-pair 자기확인 | SELF_PASS 0. VP-52는 G1, 나머지 전체 검증 보류 |
| 강제 지점 전수 | EP-15만 대조 |
| **AC 자기보고**(`Criteria-Met`) | AC21 충족. AC1~20, AC22~39 보류 |
| **합계 검산** | ✅ 1 · ⚠️ 38 · ❌ 0 = 39 |
| 블로커 / 역질문 | G1을 설계자가 정정하면 READY에서 재개 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이전 라운드 없음. AC21의 출력과 계산 횟수를 검증했다.
- ΔV2 V2-6은 인스턴스 수명과 접두 검사를 한 변이의 실패 조건으로 묶었다.
- 환경 제약에 의한 설계 환류는 해당 없음.
- 현재 라운드·impl 턴: `r1`

---

## [구현자 기입] 설계 리뷰 (r1.2)

- ΔV3의 G1 정정을 적용했다. 같은 인스턴스가 남는 s15에서 접두 검사를 제거하자 X 응답을 Y에 그려 실패했다. s14와 bg3은 늦은 응답을 전달해도 현재 본문을 보존했다.
- **G2 · PLAN_GAP**. ΔV3 AC39 bg4는 비활성 B에 `message.completed`를 넣고 돌아왔을 때 완료 Markdown 경로를 요구한다. OpenCode에서 이 이벤트는 라이브 원문을 비우고 완성된 텍스트 파트를 저장한다. 턴은 계속 진행 중이다. `openCodeBlocks.ts`의 `active && index === segments.length - 1`가 마지막 확정 텍스트를 계속 streaming으로 분류한다. EP-26 ⑨의 `Text.tsx`는 이 값을 따른다.
- Electron에서 B에 4,001자 초과 원문을 넣고 메시지를 완료한 뒤 B로 돌아왔다. 세 화면 모두 B 표지 1개, 라이브 원문 0자, `inflight=true`였다. Claude Code·Work의 꼬리 속성은 없었고 OpenCode는 `raw`였다. 이어 실제 `telemetry`를 보내자 OpenCode도 속성이 없어지고 `inflight=false`가 됐다. 0326의 기존 행 정책과 ΔV3의 완료 시점이 갈린다.
- 설계자 결정이 필요한 부분은 **메시지가 완성됐고 턴은 진행 중인 OpenCode 마지막 행**이다. 이 시점에 완료 Markdown을 표시한다면 행 정책 및 0326 회귀 범위를 정하고, 턴 종료까지 스트리밍으로 표시한다면 bg4의 이벤트 순서와 단계별 기대를 정해야 한다. ΔV3의 EP-26 소유 규칙에 따라 이 경로를 중지했다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r1.2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-05·35 | EP-13 꼬리 요청과 반영 | ①~⑧ | 임계, revision, 최신 대기, 접두, 원문, 상한, 비캐시, 두 표시 속성 | `WorkerMarkdownTail.test.ts`, `client.documents.test.ts`, `StreamingMarkdown.fence.test.ts` | s7/s8 전송 길이 4001·4003·4006·4007, 동시 보유 임차 최대 1, 모두 cacheable=false. s13f는 4001→50000 결과를 구분 | AC26 완료 경로의 OpenCode G2 |
| VP-52 | EP-26 스크롤·세션 | ①~⑨, EP-13 ④⑤ | 세 화면 P1/U1, bg0~bg3, Claude bg4 | `check-transcript-streaming.mjs` · `streamingSessions.test.ts` | 18개 실행 × 8단계. 완료 전 하단 거리 최대 0px, 기준 문장 위치 변화 최대 0px. DOM의 확정 블록 수 40→41. 완료 단계는 본문 표지만 판정 | ⑨ OpenCode bg4 |
| VP-56 | EP-27 기록 판정 | ①~⑥ | 격자, 단계, P1, U1, 종료 코드, STEPS | `check-transcript-streaming.test.mjs` | 1.5px 초과, 중복·누락, 50000자에서 이전 4001자 결과, 완료 단계 누락을 구별 | 없음 |
| VP-37 | EP-15 줄 번호 | ①② | r1 메모와 기존 CSS 카운터 | cb1 테마 교대 10회 | 코드만 같으면 split 1회, 테마 의존 변이 11회 | 없음 |
| VP-08·24 | EP-14 경계·의존성 | ①~⑥ | UI 가드, 직접 의존성 4개, 문서, 워커 생성 2곳 | `check-ui-thread.mjs` 및 자체 테스트 | 빌드 산출 compute.worker와 markdown.worker, 의존성 가드에서 remark-parse 제거 시 UI import 검사 실패 | 범위 토큰·diff 모델의 실행 모델 서술은 해당 구현과 함께 갱신 |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-37 | REQUIRED | SELF_PASS | cb1 · CodeBlock.render.test.ts | 지정된 테마 의존 변이 검출 |
| VP-56 | REQUIRED | SELF_PASS | ks1~ks12 · P1/U1 기록 격자 | 허용치·누락·parsed 글자 대조 변이 세 종류 검출 |
| VP-05·52 | REQUIRED | SELF_BLOCKED | s11~s15, bg0~bg4, P1/U1 | V2-1~6 검출. bg4의 독립적인 완료 시점 G2 |
| VP-50 | REGRESSION | SELF_PASS | 기존 선택·복사 Electron 하네스 | 90개 실행, 실패 0 |
| 나머지 REQUIRED·REGRESSION | 해당 pair의 분류 | SELF_BLOCKED | 이번 턴의 제출 범위는 Markdown 레인과 꼬리 | 전체 계약 검증 보류 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 메모 의존성에 theme 추가 | VP-37 | 미실행 | cb1 · split 11회 | 검출 |
| 꼬리 대신 전체 source 길이 사용 | VP-05 | 미실행 | s11/s12 | 검출 |
| final을 raw로 표기 | VP-35 | 미실행 | 50,001자와 노드 예산 초과 2건 | 검출 |
| Claude 성장 보정 제거 | V2-1 | 미실행 | Claude 두 화면 P1 | 검출 |
| OpenCode의 pin 검사 제거 | V2-2 | 미실행 | OpenCode U1 | 검출 |
| Claude의 unpin 조기 반환 제거 | V2-3 | 미실행 | Claude 두 화면 U1 | 검출 |
| TanStack 크기 보정 켬 | V2-4 | 미실행 | 세 화면 U1 | 검출 |
| 꼬리를 384px 내부 스크롤로 바꿈 | V2-5 | 미실행 | 세 화면 P1 | 검출 |
| 접두 검사 제거 | V2-6 (ΔV3) | G1로 보류 | s15만 실패. s14·bg3 통과 | 검출 |
| 1px 허용치를 2px로 바꿈 | VP-56 | 미실행 | ks3·ks4 | 검출 |
| 빠진 실행 검사 제거 | VP-56 | 미실행 | ks2 | 검출 |
| parsed 글자 수 검사 제거 | VP-56 | 미실행 | ks10 | 검출 |
| 금지 라이브러리에서 remark-parse 제거 | VP-08·24 | 미실행 | UI import 가드 1건 | 검출 |

- 분모는 지정 변이 13개다. V2-1~5는 격리한 사본을 매번 새로 빌드하고 실제 Electron으로 재생했다. r1의 cb1 메모 제거 검출과 테마 교대 검출은 서로 다른 입력이다.

## [구현자 기입] Product/UX 파생 검토 (r1.2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 상태를 누가 표시하는가 | 긴 꼬리의 원문, 파싱된 접두 및 최종 원문을 같은 흐름 요소가 표시 | parsed 글자 수는 해당 커밋에서만 기록 |
| 정리 코드가 이전 요청을 해제하는가 | React 인스턴스마다 미완료 요청 및 용량 구독 해제 | s14·bg3은 언마운트 뒤 응답 전달 |
| 파싱 실패와 크기 초과의 화면은 무엇인가 | 입력 원문이 남는다. 노드·문자 상한은 final로 관측 | 워커 파서와 표시 분기 테스트 |
| 응답 대기 중 읽을 수 있는가 | 최신 원문을 즉시 표시하고 접두가 맞을 때만 결과를 이어 붙임 | P1/U1 실측 |
| 다른 세션 원문이 섞이는가 | 활성 세션 키별로 꼬리 인스턴스를 분리. B가 비활성일 때 B 입력 파싱·요청 0 | 세 화면 A·B 동시 생성과 늦은 응답 확인 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| G2 | OpenCode의 메시지 완료와 턴 종료가 다른 표시 전이를 만든다 | 설계자에게 EP-26 ⑨·bg4 정정 요청 | 실제 Electron에서 message.completed와 telemetry를 차례로 보내 분리 관측 |
| 1 | Markdown 워커의 의존성이 browser export에서 document를 참조 | 워커 빌드에서만 DOM 없는 문자 참조 디코더를 선택 | 첫 실측의 ReferenceError 재현, 수정 뒤 parsed 커밋 관측 |
| 2 | OpenCode에서 A 요청이 보류된 동안 B가 같은 자리로 들어오면 A 완료까지 B 요청이 대기 | 세션 키 전환 시 꼬리 인스턴스를 교체 | bg2·bg3에서 B 요청과 A 응답 격리 |

### 설계 대비 명시적 차이 (r1.2)

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 언마운트 뒤 응답 | s14, bg3 |
| 공유 | 클라이언트의 문서 임차·용량 알림 | 동일 문서 두 임차, 해제한 구독 호출 0 |
| 재진입 | 문서 재전송 | unknown-doc 재시도 1회 및 워커 재생성 테스트 |
| 다른 무효화 축 | 활성 세션 변경 | OpenCode 동일 자리의 A·B 원문 분리 |

## [구현자 기입] 구현 보고 (r1.2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 계산 클라이언트·프로토콜·문서 임차, Markdown 워커, 공유 Markdown 렌더링, 스트리밍 꼬리, Electron 실측과 테스트, 의존성·빌드·경계 문서 |
| 실행 명령 | app에서 전체 Vitest, Node 스크립트 테스트, lint, typecheck, 가드 5종, electron-vite build, smoke-hosts, smoke-preload. Electron 실측은 가상 X 서버와 실제 바이너리 사용 |
| 관측한 게이트 산출 | 세 화면 P1/U1 18개, 기존 선택 실측 90개 통과. Node 테스트 1,066개, 타입 검사·빌드·스모크 통과. lint 오류 0, 경고 7. 전체 Vitest의 실패 22개와 native-resources의 미처리 오류 1개는 pull 시점 커밋에서 같은 이름과 서명으로 재현 |
| 추가·수정 테스트의 subtree 규칙 | 렌더러의 가짜 DOM·store 하네스 재사용. 실제 레이아웃과 휠은 Electron에서 측정. 테스트 예산 가드 통과 |
| V-pair 자기확인 | 위 자기확인표. 전체 작업 미완료 |
| 강제 지점 전수 | 이번 턴은 EP-13~15·26·27 및 문서 임차 일부. 나머지 EP는 다음 구현에서 대조 |
| AC 자기보고 | 충족 AC21·27·28·37·38. AC26·39의 OpenCode 완료는 G2. Git·산출물·도구 카드 가상화, 범위 계산·스케줄링 및 Windows 실기는 보류 |
| 합계 검산 | 충족 5, 보류 34, 총 39 |
| 블로커 / 역질문 | G2. OpenCode 마지막 행의 표시 전이를 message.completed와 telemetry 중 어느 이벤트에 귀속할지 설계 정정 필요 |
| 대상 커밋 | (r1.2 부분 구현 — 검증자 기입) |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- verify 0회. r1의 G1은 ΔV3에서 정정했고 s15에서 직접 검출했다.
- G2는 긴 꼬리가 그대로 남는 bg4 입력에서 드러났다. AC37·38의 완료 직전 꼬리는 28자여서 그 측정만으로 두 Markdown 경로를 구분할 수 없다.
- Windows 설치본 실기는 실행하지 않았다. Linux에서 둘 이상의 테스트 런타임이 필요한 SQLite ABI는 임시 Node 빌드로 분리했다.

---

## [검증자 기입] 파생 이슈

verify 1회째(RETURN_TO_PLAN) — 상세·재현은 [verify.md §11](verify.md).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| I1 | plan 지정 oracle 좌표 부재 — 24 AC(파일 `protocol.keys`·`useWindowTokens`·`fileDiffVirtual.render`·`useDiffRowTokens`·`markdownDocumentBlocks`·`cardSyncCaps` 등 · 케이스 라벨 d1~d9·bg0~bg3) | VP-01·02·04·10·12·13·15·20~25·31·33·35·36·38·39·48·49·51 · AC 검증 수단 칸 | plan 좌표를 만들거나, 같은 단언을 둔 기존 테스트를 자리별 좌표 표로 대응시킨다 | 이행 | BLOCKING | open |
| I2 | ~~VP-57 등록 변이에서 bg4 OpenCode green~~ — 철회: 검증자 변이가 6번째 인자(`live`)에 심겼다. 5번째 인자(`streaming`) 변이 V57-1r 은 ob1 · bg4a · bg4b red | VP-57 | — | — | — | withdrawn |
| I3 | `rowMount.ts:7` 추가 판정을 크기 비교·제거만 참으로 바꾸거나 `:9` 알림을 지워도 vitest·`check-visible-views` green | VP-34 · ΔV1 MD-05 · VP-50 "취소 사례는 실제 새 행 키 관측" | 판정 함수 UT(추가·교체·제거만·동일 키) + 선택 끝이 마운트된 채 새 키가 들어오는 Electron 사례 | 이행 | BLOCKING | open |
| I4 | r1.5 `[구현자 기입]` 에 강제 지점 전수 표·놓친 잠재 문제·sweep 검산 줄 없음 | `handoff-impl` 최소 계약 | 다음 impl 턴이 일곱 필드를 채운다 | 이행 | BLOCKING | open |
| H1 | `check-visible-views.mjs` — root `--no-sandbox` 미적용 · 바이너리 부재 exit 3 없음 · 판정부 단위 테스트 없음 · 운영 gate 표 밖 | ΔV1 AC15·35 Electron 판정 도구 | 설계자가 채택(운영 gate·종료 코드 계약에 넣음) 또는 경계 선언 | 확장 | PLAN_GAP → 채택(ΔV6 D-062 · AC40 · EP-31) | adopted |


## [구현자 기입] 설계 리뷰 (r1.3)

ΔV4의 D-059·D-060을 적용했다. 세 화면 모두 B의 메시지가 완료되면 원문 10,000자 전체가 완료 Markdown 파서에 들어간다. 같은 턴에서 새 메시지의 라이브 텍스트가 생겨도 B는 한 번만 표시된다.

**G3 · PLAN_GAP (AC4 t5, EP-3 ③).** 줄당 1ms 주입 시계로 51줄을 전진시켰다. EP-3 ③은 50번째 줄에서 한 번 양보하고 남은 한 줄은 1ms 만에 끝난다. AC4 t5의 `⌈전진 줄 / 50⌉`는 두 번의 `continue` 응답을 요구한다. 49줄은 각각 0회와 1회다. 클라이언트는 매 `continue`에서 작업을 다시 대기열에 넣으므로 두 기대는 다른 메시지 순서를 만든다. 설계자가 마지막 짧은 구간의 **완료 응답과 양보 응답을 구분**해 t5 식과 정확히 50줄인 경계의 기대를 정해야 한다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r1.3)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-57 SELF_PASS | text 행 소유 | EP-28 ①~④ | ①~④ | openCodeBlocks.test ob1~ob6 | 같은 소유·다른 소유·턴 종료, 전체 구성·삽입·교체에서 streaming 및 live 대조 | — |
| VP-05·52 | 라이브 및 완료 경로 | EP-13 ①~⑧, EP-26 ①~⑩ | r1.2 결과에 ⑨⑩ 추가 | streamingSessions.test, Timeline.selection.test | 세 화면의 활성·비활성 완료, 후속 C 및 telemetry를 단계별 단언 | 독립 verify |
| VP-30 | 단어 강조 짝 색인 | EP-6 ①② 및 음성 | ① 및 기존 탐색 제거 | diffView.test cp1·cp2 | 50,000줄 추가 묶음에서 숫자 인덱스 읽기 50,000회 | 워커 행 창·v11 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.3)

| 자리 | 심은 변경 | 실제 실패 |
|---|---|---|
| EP-28 ① | 마지막 위치와 pending으로 판정 | ob1, OpenCode bg4a·bg4b에서 완료 직후 꼬리 잔존 |
| EP-28 ② | 첫 live 전체 구성 streaming=false | ob5 전체 구성 |
| EP-28 ③ | 첫 live 교체 streaming=false | ob6 |
| EP-28 ④ | 첫 live 증분 삽입 streaming=false | ob5 증분 |
| EP-26 ⑨ | streaming 분기 뒤집기 | OpenCode bg4a·bg4b |
| EP-26 ⑩ | 선택 중 모드 보존 호출 제거 | Timeline.selection의 선택 해제 전 완료 표시 |
| EP-6 ① | 추가 행의 상대 삭제 행을 역순으로 찾기 | cp1 |

서로 다른 변이 7개. VP-57 등록 변이 2개는 EP-28 ①②에서 직접 확인했다. G2 재현은 ①과 같은 변이다.

## [구현자 기입] Product/UX 파생 검토 (r1.3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 답변 본문이 확정됐는데 생성 표시는 남을 수 있는가 | 세 화면에서 확정 B를 그리고 턴은 계속 진행한다 | 새 메시지 C만 꼬리를 갖고 telemetry 뒤 꼬리가 사라짐 |
| Git 인라인 단어 강조 위치가 바뀌는가 | 기존 탐색과 길이 0~8 전체 조합 및 무작위 10,000개 대조 | 워커 경로 연결 뒤 같은 결과 대조 필요 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| G3 | AC4 t5의 마지막 구간 양보 횟수 | planner가 EP-3 ③ 및 t5의 기대를 맞춘 후 재개 | 1·49·50·51·100·101줄의 임계 양보 수 0·0·1·1·2·2, t5 식 1·1·1·2·2·3 |
| AC8 | 현재 인라인 경로에 공용 색인이 연결됨 | 큰 파일 워커 경로를 연결한 뒤 v11로 확인 | cp1·cp2와 인라인 렌더 회귀 실행 |

## [구현자 기입] 구현 보고 (r1.3)

| 항목 | 관측 |
|---|---|
| 완료 표시 | streamingSessions.test 세 화면 × bg4a·bg4b 6건. ob1~ob6 및 선택 유지 테스트 통과 |
| 대상 테스트 | 최종 관련 Vitest 9파일 114건. 수정·추가한 테스트 3파일은 unit 풀에서 실행. 호스트 프로세스 사용 및 개별 시간 상한 0 |
| Linux 실행 | Electron 39.8.10 스크롤 관측 18/18. 타입 검사 통과, 변경 소스 lint 0건, Node 스크립트 테스트 1,066건 통과, 번들 생성 성공 |
| 전체 Vitest | 10,450건 통과, 실패 22건(9파일). r1.2에서 분리 실행한 기준선과 실패 이름 차집합 양방향 0건. 같은 native-resources 미처리 거부 1건 |
| 자기보고 AC | AC21·26·27·28·37·38·39 충족. AC1~20·22~25·29~36 보류. ✅ 7 · ⚠️ 32 · ❌ 0 = 39 |
| 다음 주체 | planner, G3. Windows 실기 및 나머지 워커·가상화 범위 보류 |

## [구현자 기입] Review Signals — 사실만 (r1.3)

G2는 ΔV4의 행 분류 및 완료 시점 검증으로 닫았다. G3는 별도의 워커 시간 예산과 양보 횟수 축이다. verify 0회.


## [구현자 기입] 설계 리뷰 (r1.4)

D-061의 완료 우선을 적용했다. 계산 워커가 문서와 토큰화 위치를 소유하고 클라이언트가 다음 조각의 전송 순서를 정한다. 빈 범위는 첫 요청에서 빈 행 배열을 반환한다. G3 정정 범위는 AC4다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r1.4)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-32 | 원천 문서 범위 토큰화 | EP-3 ①~⑦ | ①~⑥ 및 기존 ⑦ 실행 | worker/tokens.test.ts, worker/handler.test.ts | 문서 줄 색인, 언어·테마 체크포인트, 줄 상한, 여러 줄 문법, EOF, 기존 highlight | 파생 축·보기 원천은 별도 경로 |
| VP-06 · AC4 SELF_PASS | 완료 우선 및 양보 | EP-3 ③ · EP-4 ②③ | D-061 마지막 작업과 재대기 | t5, client.queue.test.ts q4 | 5만 줄 끝으로 가는 도중 새 가시 토큰 요청 또는 highlight가 다음 양보 직후 실행됨 | VP-06 전체의 다른 AC |
| VP-11 · SELF_BLOCKED | 작업 계측, 대기 및 승격 | EP-3 ③ · EP-4 ③⑥⑧ | q4·q9·q12·q13 | client.queue.test.ts | 큐에서 기다린 시간 40, 점유 7. 같은 작업의 다음 조각에서 yields 증가 | q11 쌍 diff와 첫 paint 진단 |
| VP-36 · SELF_BLOCKED | 취소와 범위 검사 | EP-4 ①~⑧ | 원천 tokens 범위 검사·재대기 및 취소 | q8, q10 | 201줄·음수·역전·소수 모두 전송 0. 취소 뒤 양보는 재전송 0 | codeView·diffView 경로 및 크기 추정 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.4)

| 자리 | 심은 변경 | 관측 |
|---|---|---|
| EP-3 ③ | 예산 비교 전에 수행하는 마지막 줄 반환 제거 | t5 50·100줄에서 불필요한 양보 1회 검출 |
| EP-3 ③ | 예산 비교 비활성화 | t5 51·100·101줄에서 작업별 호출 수 차이 |
| EP-3 ④ | 이전 문법 상태 전달 제거 | 여러 줄 주석·템플릿 색 대조 실패 |
| EP-3 ② | 체크포인트 키에서 테마 제거 | 두 번째 테마에서 전진 줄 수 차이 |
| EP-3 ⑤ | 200줄 경계 상태 저장 제거 | 같은 테마의 재요청 호출 수 차이 |
| EP-4 ③ | 양보 횟수 증가 제거 | 5만 줄 탐색 뒤 가시 highlight의 선행 실행 실패 |
| EP-4 ③ | 취소된 작업도 다시 대기열에 삽입 | q10 전송 수 증가 |
| EP-4 ⑥ | 대기자의 우선순위 변경 생략 | q9 승격·해제 순서 차이 |
| EP-4 ⑧ | 시작 시각에 enqueue 시각 대입 | q12 대기와 점유 차이 |

서로 다른 변이 9개. G3의 인용 변이와 VP-32의 마지막 작업 선택 증거는 첫 행의 같은 실행이다.

## [구현자 기입] Product/UX 파생 검토 (r1.4)

| 질문 | 판정 | 후속 |
|---|---|---|
| 긴 파일 뒤쪽의 색 계산이 새 강조를 막는가 | 한 줄이 끝난 뒤 예산에 닿으면 대기 요청으로 순서를 넘긴다 | q4 원천 50,000줄 |
| 마지막 줄에서 대기를 한 번 더 하는가 | 50·100줄 작업의 마지막 응답은 결과 행을 담는다 | t5 |
| 소비자가 취소한 결과가 표시되는가 | 해당 대기자의 promise를 거부하고 남은 대기자가 없으면 다음 양보에서 작업을 버린다 | q10 |
| 기존 화면이 새 경로를 쓰는가 | 현재 계산 API는 원천 문서 범위를 지원한다. 가상 코드·diff 화면의 범위 요청 연결은 남아 있다 | AC3·17·20·22 보류 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.4)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| G3 | 완료와 양보 수 구분 | D-061 적용, 7개 입력 관측 | 작업별 줄 수 0 / 1 / 49 / 50 / 50+1 / 50+50 / 50+50+1 |
| 1 | 벽시계 선점이 TextMate 단일 줄의 시간 상한을 넘어 색 대조가 흔들릴 수 있음 | 색 동등성 fixture에서 TextMate 시계 고정. 긴 압축 줄의 내용 보존은 실제 시계로 실행 | worker/tokens.test.ts |
| 2 | 취소한 토큰 커서의 부분 결과 보유 | 다음 작업에 폐기할 ID를 싣고 문서가 먼저 닫히면 그 문서의 커서를 즉시 정리 | worker/state.ts, client.ts |

## [구현자 기입] 구현 보고 (r1.4)

| 항목 | 관측 |
|---|---|
| 워커·클라이언트 | 원천 문서 열기/닫기, 실제 Shiki 행 범위, 이어받기, 요청별 새 id, 대기자 승격/해제, 조각별 계측 |
| Linux Electron | 빌드된 계산 워커에 10,000줄 전송. 26번 양보 뒤 마지막 2줄 본문 일치. 닫힌 문서 재요청은 unknown-doc |
| 검사 | 관련 Vitest 11파일 117건 통과. 전체 Vitest 10,472건 통과, 9파일 22건 실패, 미처리 거부 1건. r1.2 기준선과 실패 이름 양방향 차집합 0건. Node 스크립트 1,066건 통과 |
| 운영 gate | 타입 검사, 번들, host·preload smoke, 문서·마이그레이션·제품명·프로세스 경계·테스트 예산 가드 통과. lint 오류 0·경고 7(변경 외 파일). 수정 테스트 5파일은 unit 풀, 호스트 실행·개별 시간 제한 0 |
| 자기보고 AC | AC4 추가. 누적 AC4·21·26·27·28·37·38·39. ✅ 8 · ⚠️ 31 · ❌ 0 = 39 |
| 남은 범위 | AC1~3·5~20·22~25·29~36. 가상 보기 소비자, 파생 문서·토큰 축, diff 모델·창, 선택 및 Windows 실기 포함 |

## [구현자 기입] Review Signals — 사실만 (r1.4)

ΔV5 G3는 범위의 마지막 줄에서 한 번만 발생할 수 있는 완료/양보 순서의 문제였다. 독립 verify 0회. 다음 재구현 전 review 진입 조건은 handoff/AGENTS.md §review를 따른다.

## [구현자 기입] r1.5 구현 인계

### 설계 리뷰

기준은 ΔV5 설계 커밋 `d2ed3db0`과 r1.4 구현이다. 코드·Markdown·diff 본문이 원천 revision을 임차하고 현재 화면의 행 범위를 계산 레인 또는 Markdown 레인에 요청한다. Windows 실측은 사용자가 verify 단계에서 검토하기로 했다.

### 생산 경로와 자기확인

| 범위 | 강제 지점 | 관측 |
| --- | --- | --- |
| 문서·작업 수명 | `protocol`, `client`, `worker/state`, `useComputeDocument` | 쌍의 두 문서가 작업 전에 열린다. 실행 중 쌍 작업 취소 후 교체한 워커에 두 문서가 다시 열린다. 저장한 모델 8개를 넘긴 뒤 첫 원천의 문맥과 토큰을 다시 읽었다. |
| Git 패널 | `DiffReview`, `FileDiffSection`, `useDiffAnchor`, `useDiffScrollCoordinator` | 5,001행 인라인·나란히 보기를 스크롤해 첫 줄과 마지막 줄을 읽었다. 인라인 초안 입력란은 끝으로 이동해도 초점을 유지했다. 요구사항 선택으로 4,601번째 줄의 마커가 화면 안에 들어왔다. |
| 요구사항 앵커 | `diffViewContext`, `createDiffRequirementItem` | 16개 결정적 혼합 diff의 3,015개 줄에서 전체 배열로 만든 요구사항과 문맥 창으로 만든 요구사항이 일치했다. 같은 16개 입력의 좌우 짝도 기존 나란히 보기와 일치했다. |
| 도구 카드·산출물 | `FileBody`, `WorkToolBody`, `DiffBody`, OpenCode `FilePanel`, `ArtifactPreviewContent` | 5MiB 초과 코드의 첫·마지막 줄과 문법 색을 확인했다. Work의 같은 스크롤 요소에서 요청 첫 줄과 응답 마지막 줄에 도달했다. |
| Markdown | `markdownDocumentBlocks`, `markdownBlock`, `VirtualMarkdownView` | 목록·인용·HTML·참조·들여쓴 코드·펜스·각주의 블록별 트리를 전체 파싱과 대조했다. 표 401행을 3개로 나눈 뒤 이어 붙인 본문이 입력과 일치했고 다음 문단도 보존됐다. |
| 선택·복사 | `usePanelSelection`, `TranscriptViewport`, `VirtualRowMountContext` | Electron의 코드·Markdown·도구 diff·Git 두 보기·Work에서 역방향 마우스 선택 후 실제 복사 문자열이 일치했다. 새 행을 마운트한 뒤 복사해도 기존 클립보드 값이 유지됐다. 각 화면의 마운트 행은 시작과 끝에서 150개 미만이었다. |
| 측정 | `measure-ui-inputs.mjs --visible <app>`, `--write-inputs <folder>`, 진단 빌드 `loadToolCardFixture`·`startComputeTimings`·`finishComputeTimings` | 새 트리의 Linux K 측정과 재현 입력을 실행했다. F8에는 변경 파일 200개가 있다. D-052에서 폐기한 K12를 제외한다. |

### 이번 라운드의 잠금

- `visibleViews.test.ts`에서 CRLF·탭·전각 폭, 범위 밖 창, 펼치기 전후 앵커, 표 마지막 행과 다음 문단, 앵커 키 순서·중복, 워커 모델 퇴거 후 복원, Markdown 구조를 검사한다.
- `client.documents.test.ts`에서 쌍 작업 취소 후 실제 메시지 순서를 검사한다. `client.test.ts`에서 실행 중 highlight 취소 뒤 동일 워커가 대기 작업을 완료하는지 검사한다.
- `check-visible-views.mjs`는 Electron과 실제 계산 워커를 실행한다. 마운트 개수, 마우스 선택, 클립보드, 마지막 행, 초안 초점, 화면 밖 요구사항 이동이 오라클이다. 기존 선택 90개와 스트리밍 18개 사례도 Linux Electron에서 통과했다.

### 제품 동작과 설계 대비 차이

긴 본문은 가시 범위의 문자를 먼저 표시하고 워커 결과를 반영한다. 전체 카드 복사 버튼은 원래 입력을 사용한다. 코드 창은 계산 실패 시 기존 코드 보기로 돌아간다. 이미지·HTML·다운로드·모드 전환은 기존 산출물 동작 검사를 사용한다.

Git의 핀은 측정된 위치의 개별 행으로 표시한다. 스크롤 소유자가 화면 좌표와 꼬리 여백을 보정한다. 새 작업 경로는 범위 토큰과 diff 보기 요청을 사용한다. 과거 계산 훅과 기존 메시지 형태는 호환 시험에서 여전히 호출 가능하다.

### 남은 검증과 Review Signals

| 검증 대상 | 확인할 조건 |
| --- | --- |
| 우선순위·늦은 응답·레인 시각 | AC5·7·36의 대기/승격/테마 교체 조합과 진단 paint 시각을 독립 대조한다. |
| Git 모델·뷰포트 | AC9·10·12·17·34의 생성 횟수, 정확한 overscan·핀 수, 한 프레임에 겹치는 높이 변화 및 ±1px 보정을 검사한다. |
| 복사와 파싱 | AC15·35의 패널 격리·카드 경계, AC24·31의 전체 fixture 충실도·노드 상한, AC32의 단계별 호출 횟수를 독립 확인한다. |
| 측정 | AC29의 두 트리 전체 비교, AC30의 같은 Windows 장비 실측을 verify에 인계한다. 0326 PASS 트리의 Linux 전체 K 실행은 15분 동안 완료되지 않아 중단했다. |

### Linux 함수 측정

각 행은 예열 1회 뒤 9회 측정했다. K12는 ΔV1에서 폐기했다. 새 트리의 함수 측정 39개 행이 각각 시도 10회 안에 수치를 반환했다.

| 행 | 입력 | 중앙값(ms) | 최대(ms) |
| --- | --- | ---: | ---: |
| K1 | 5000 diff rows | 4.63 | 19.33 |
| K1 | 5001 diff rows | 2.72 | 23.50 |
| K1 | 50000 diff rows | 75.63 | 232.46 |
| K2 | tokens 0 | 26.40 | 53.79 |
| K2 | tokens 49800 | 4409.97 | 5464.28 |
| K3 | 1MB markdown, first 30 blocks | 46.79 | 56.59 |
| K4 | loose list 4000 | 57.15 | 115.48 |
| K4 | loose list 20000 | 337.27 | 508.40 |
| K4 | loose list 50000 | 782.91 | 1752.27 |
| K5 | 5MiB code index and first 200 rows | 37.24 | 50.08 |
| K6 | 200 file paths | 0.15 | 0.20 |
| K7 | 990044-char patch | 0.57 | 9.34 |
| K8 | typescript | 83.15 | 86.86 |
| K8 | javascript | 0.03 | 0.09 |
| K9 | javascript 5000 | 1866.56 | 1966.42 |
| K9 | javascript 20000 | 0.01 | 0.17 |
| K9 | javascript 1000000 | 0.10 | 0.28 |
| K9 | json 1000002 | 0.10 | 0.17 |
| K10 | boundary 0 | 215.75 | 524.11 |
| K10 | boundary 1 | 0.41 | 0.47 |
| K10 | boundary 2 | 0.00 | 0.00 |
| K10 | boundary 3 | 132.50 | 144.54 |
| K10 | boundary 4 | 438.90 | 656.13 |
| K10 | boundary 5 | 0.03 | 0.03 |
| K10 | boundary 6 | 530.07 | 652.79 |
| K11 | Read 1000000 | 0.85 | 1.12 |
| K11 | Work string 1000000 | 0.01 | 0.02 |
| K11 | Work object 1000000 | 1.56 | 1.59 |
| K11 | Read 5000000 | 11.68 | 12.22 |
| K11 | Work string 5000000 | 0.00 | 0.01 |
| K11 | Work object 5000000 | 20.22 | 21.04 |
| K11 | 50000 patch lines | 3.27 | 11.12 |
| K13 | 50000 pair diff rows | 72.34 | 121.73 |
| K13 | pair 2000 + 2000 | 905.55 | 1269.08 |
| K13 | pair 5000 + 5000 | 8778.17 | 26419.24 |
| K13 | pair 50000 + 50000 | 41.60 | 65.39 |
| K13 | 50000 model only | 18.13 | 25.55 |
| K13 | 5MiB codeView | 37.96 | 59.81 |
| K13 | 32000-char highlight | 103.91 | 277.77 |

K2의 마지막 실행에서 49,800번째 줄에 도달한 토큰 작업은 73조각이었다. 가장 긴 조각은 129.49ms였다. 같은 장비에서 다른 게이트도 실행 중이었다. K10의 1,600행 표는 8조각으로 반영됐고 2,001행 표는 원문으로 표시됐다.

### 구현 보고

자체 확인 24개는 AC1·2·3·4·6·8·11·13·14·16·18·19·20·21·22·23·25·26·27·28·33·37·38·39다. AC14는 초점 유지와 문맥 앵커 3,015건을 확인했고, 다중 핀의 모든 높이 조합은 독립 검증에서 다시 확인한다. 나머지 AC5·7·9·10·12·15·17·24·29·30·31·32·34·35·36은 증거가 일부 조건만 덮거나 실측이 남아 있다. 구현 상태와 독립 검증 결과는 INDEX에서 별도로 추적한다.

✅ 24 · ⚠️ 15 · ❌ 0 = 39. 독립 verify 0회.

| 운영 gate | 관측 |
| --- | --- |
| 정적 검사·배포 산출 | Node·web·test 타입 검사와 번들 빌드 통과. host 부팅·IPC 및 preload sandbox smoke 통과. lint 오류 0, 경고 10. |
| 저장소 가드 | UI 계산 경계, 문서, 제품명, 테스트 시간 예산 통과. 마이그레이션 소유자 검사를 통과했고 이전 버전 태그가 없어 append-only 비교는 건너뛰었다. |
| 전체 자동 검사 | Vitest 1,100파일. 테스트 10,485개 통과, 22개 실패, expected fail 1개, skip 11개. 실패 22개의 이름은 기존 Linux 기준선과 양방향 차집합 0개였다. 기존 미처리 거부 1개도 재현됐다. Node 스크립트 1,066개 통과. |
| 수정 테스트의 격리 | 변경 또는 추가한 Vitest 파일 8개는 unit 풀이다. 새 테스트에는 외부 실행 파일·실제 Git 저장소·개별 시간 제한을 사용하지 않는다. 실제 Electron·Git 호출은 별도 진단 스크립트에서 실행한다. |
