# Verify — 0325-ui-responsiveness-followup

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md). 재현 자료는 [`verify-r1/`](verify-r1/) — sweep spec 120항목 · 독립 축 fuzz 테스트 · fuzz 민감도 spec 14항목.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0325-ui-responsiveness-followup` |
| 검증자 | Claude Code |
| 일자 | 2026-11-18 |
| 대상 커밋/range | `5923d9a..1f2a8af` (r1 구현 1커밋) |
| 구현 전 plan 기준 | `5923d9a` (V1 rev 4) |
| V mode / 유효 V | `Baseline V: V1 rev 4` |
| 검증 기준 plan revision | `5923d9a:V1 rev 4` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 1(D1) · 이행 결함 1(D2, BLOCKING) |
| 확장 창 | verify 1회째 — 창 안 · 다시 열린 노드 없음 |
| 독립 축(⑥) | 5축 — X1 grouper 다단계 무작위 편집 ≡ 변경 전 `groupExchanges`(400 seed × 40단계) · X2 presence 투영 ≡ 변경 전 문자열 투영(300 seed × live 48조합) · X3 조각 분할 보존·상한·최대성 + `estimateWireChars` 조기 반환(300 seed + 2,000값) · X4 스킬 장식 ≡ 변경 전 토큰화(300 seed) · X5 루트 예산 초과 읽기 계수. 1,301 + 1 케이스 green, 발견 0 |
| 열거 sweep(⑦) | 1회째 전수 — 120항목(§10 자리 77 전부에 1개 이상 + 등록 변이 + 형제 맞바꿈) · 잡음 114 · 동치 5 · 못 잡음 1 |
| 발견 분류 | 이행 2(D1 plan 내부 불일치 → PLAN_GAP · D2 → BLOCKING) · 현재 0 · 확장 0 · 경계 0 · 비귀속 1(N1) |
| 구현 주체·문맥 | 설계·구현·검증 모두 Claude(같은 세션 계열) — plan validity 는 자기 설계 감사다. 그래서 ⑥을 변경 전 코드와의 동치 비교로 잡았다 |

## 0. 기준선 / plan 변경 확인

- ✅ 구현 커밋의 `plan.md` diff 는 941행 이후(`[구현자 기입]`)만이다 — `git diff 5923d9a 1f2a8af -U0 -- plan.md | grep '^@@'` 첫 hunk `-941`. Decision·AC·§10·V 는 구현 전 그대로라 원문으로 채점한다.
- 착수 근거: D-002("Plan 까지만")는 설계 세션 범위이고 구현은 사용자의 `/handoff-impl 325` 지시라고 구현자가 적었다(plan 943행). 검증 대상 아님.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 상속 V 없음 · 0324 노드는 INHERITED REGRESSION(§7-A) |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~R-10·AR-01~05·MD-01~12 모두 REQUIRED pair 보유(Pair registry 33행) |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-04·05·09·13·17·21·24 |
| §10 자리 목록 ↔ 기록된 검색 재실행 | **PLAN_GAP (D1)** | 출력 ⊆ 목록(목록 밖 줄 0, 10 EP 전부)이지만 §10 머리 정의 "자리마다 줄이 1개 이상"과 달리 EP-1 ⑧ · EP-2b ④ · EP-5 ② 에 걸리는 줄이 0이다 — 술어에 `chunked` · text spread · `size` 항이 없다. 술어가 자리 주어보다 좁다(SKILL §0) |
| 선택 적대 증거·이유 | 유효 | 등록 변이 45개가 자리를 적었다 |
| `SUPERSEDED` pair 이관 | 해당 없음 | Baseline |
| 운영 gate·범위 | 유효 | §7-A "현재 변경의 운영 gate" 3행 |

D1 을 낮출 수 있는지 독립 재열거로 쟀다 — 넓힌 술어에서 새 운반 자리는 0이다. 설계자는 검색 명령 문자열만 고치면 되고 구현 의무가 새로 생기지 않는다.

| EP | 넓힌 술어 | 출력 | 목록 대응 |
|---|---|---|---|
| EP-1 | `chunked` (세 파일) | 8줄 — `data-host.ts:52·151·160·161·162·169·170` · `session-load.ts:91` | ⑧(91) · ⑨⑩(`assembleSession` 검사) · 타입·판별 |
| EP-2b | `\.\.\.entry\.live\|\.\.\.live,` | 4줄 — `chatStore.ts:569·571·790·801` | ④(569·790) · ②(571) · ③(801) |
| EP-5 | `\bsize\b` (compute) | 20줄 | ①~④ + `job.size`(요청 크기 — 다른 계약) |

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-007·D-036 | 조각 상한 셋 · 단독 조각 · 양보 뒤 측정 | `deliver`(`session-load.ts:80-92`) → `nextSessionChunkEnd`(`data-host.ts:105`) → `client.send` |
| D-015·D-034·D-035 | Timeline 은 유무만 · 리프가 본문 | `useHasLiveText`/`useHasLiveReasoning`(`chatStore.ts:2595·2600`) → tail 메모(`Timeline.tsx:50-58`) → `OpenCodeTextSegment`(`:207`) |
| D-030·D-033 | 증분 그룹화 ≡ 전체 | `ClaudeTranscriptView` `useState(createExchangeGrouper)`(`claude/.../Timeline.tsx:37`) → `turns.ts:116` |
| D-017 | steer 콜백 안정 | `ChatTile.tsx:96` `useCallback([activeKey])` → `Exchange.tsx:85` 비교 |
| D-008·D-009·D-037 | 문자 우선 · 합산 예산 · 파싱 전 판정 | `inline.ts:10·32` ← `toolMeta.ts:190-207` · `filePresentation.ts:23` |
| D-011·D-038 | 워커 size · 키 비용 · 항목 수 | `handler.ts:42` → `protocol.ts:117` → `client.ts:109-125` |
| D-010·D-039 | 20,000 상한 · 기저 색인 | `composerDecoration.ts:19-40` → `skillIndex.ts` |
| D-013 | 클릭 때 복사 | `ToolCard.tsx:167` · `AssistantTurn.tsx:61` · `UserTurn.tsx:21` |
| D-014·D-040 | 프레임 병합 · blur 종료 · unmount 취소 | `useDragResize.ts:35-83` |
| D-012·D-041 | 실패 = 미리보기 없음 · 동시 2 | `imageThumb.ts` → `attachmentViews.ts` ← `useAttachments.ts` |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 양호 | 썸네일 `onload` 전체가 try 안 · `downscale` reject 도 `.catch` 로 settle(`attachmentViews.ts:46`) |
| false success 가능성 | 없음 | 조각 머리 `chunked` = 보낸 합 · 조립 쪽이 수·순서 불일치를 던진다(`data-host.ts:161·169`) |
| partial failure/rollback | 해당 없음 | 저장 쓰기 없음 |
| A 가 아닌 B 를 구현 | 없음 | X1·X2·X4 가 변경 전 코드와 출력 동치(§4) |
| 증상만 제거 | 없음 | 조립은 펼침 대신 루프(`data-host.ts:167`) |
| 최적화가 잃은 관측 | 없음 | 스킬 색인 `WeakMap` 키 = `useMemo` 로 새로 만드는 집합(`ComposerInputController.tsx:162`) — 제자리 변경 없음 |
| worst-case 상한 | 유지 | 끌기 새 mousedown 은 앞 끌기를 취소(`useDragResize.ts:41`, 설계 대비 차이로 보고됨) |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 정상(plan 이 유지) | `countLines`·`diffStatWithinCap`·`splitSessionMessages` 의 production 참조는 0·0·measure 스크립트 1(`rg`) — §10 EP-4 ②⑤·EP-1 ⑥ 이 "현행·래퍼"로 남긴다 → N1 |
| 테스트 전용 참조 | 정상 | `projectTimeline`·`materializeTimelineRows` 는 §10 EP-2 ⑩ "문자열 래퍼(테스트용)" |
| 형제 정책 비대칭 | 없음 | `ToolCard` 복사 버튼은 변경 전에도 항상 노출(`ToolCard.tsx:157` 주석) — 함수 prop 이 노출을 바꾸지 않는다 |
| 신규 상태값의 기존 소비처 | 무영향 | `reasoningVisible` — `EMPTY_LIVE` 사용 6곳 · `resetLive`(440) · telemetry(940) 은 reasoning 이 비면 거짓 불변식을 지킨다 |
| producer ↔ consumer | 일치 | 워커 `size` 생산(`handler.ts:42`) ↔ `parseResponse`(`protocol.ts:117`) |
| 동일 규칙 중복 | SSOT 유지 | segment 유무 = `parts.ts:551·555` 하나 · 끝 구두점 = `skillIndex.ts` 하나 |

## 4. 고장 이력 — sweep ⑦ 120 + ⑥ 민감도 14

oracle 은 EP 마다 그 EP 의 테스트 묶음(spec 의 `oracle` 열)이고 ⑥ 민감도는 X1~X4 파일 하나다. 두 실행 모두 끝에 "원복 확인: 모든 파일 원문 그대로"와 `git status` 깨끗함을 확인했다. 하한 ③④는 첫 verify 라 해당 없고 ⑤는 V1.2s·V1.8·V2.4b·V2.4c·V4.5s 가 맡는다.

- 못 잡음 V1.5b 확인 실행: 루트 객체를 Proxy 로 감싸 `estimateWireChars(m, 1)` 을 부르면 현재 코드는 자식 읽기 0, 변이는 1(`expected 1 to be +0`). production 경로 `nextSessionChunkEnd([first, m], 0, {chars: cost(first)+1})` 에서 후보의 남은 예산이 1이 되는 입력으로 닿는다.
- ⑥ 민감도: X1~X4 는 V1.2·V1.3·V2.8a·V2.8b·V3.3·V3.5·V3.6·V6.4d·V6.5a 를 잡았다(9/9). 못 잡은 F-V1.5c·F-V3.8 은 원 sweep 이 잡았다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|---|
| V1.1 | `data-host.ts:115` | 제거 | `if (end - start >= limits.messages) break` → `∅` | 잡음 | vitest 5 failed \| 160 passed (165) | sweep ⑦ |
| V1.2 | `data-host.ts:119` | 제거 | `if (end > start && parts + size > limits.parts) break` → `∅` | 잡음 | vitest 6 failed \| 131 passed (137) | sweep ⑦ |
| V1.2s | `data-host.ts:119` | 다른 값·맞바꿈 | `parts + size > limits.parts` → `parts + size > limits.chars` | 잡음 | vitest 6 failed \| 131 passed (137) | sweep ⑦ |
| V1.3 | `data-host.ts:123` | 다른 값·맞바꿈 | `if (cost > remaining) {` → `if (false) {` | 잡음 | vitest 6 failed \| 159 passed (165) | sweep ⑦ |
| V1.3b | `data-host.ts:122` | 다른 값·맞바꿈 | `const cost = estimateWireChars(message, remaining)` → `const cost = estimateWireChars(message)` | 잡음 | vitest 2 failed \| 163 passed (165) | sweep ⑦ |
| V1.4 | `data-host.ts:125` | 제거 | `if (end === start) return start + 1` → `∅` | 잡음 | vitest 2 failed \| 163 passed (165) | sweep ⑦ |
| V1.5 | `data-host.ts:82` | 다른 값·맞바꿈 | `return total > limit` → `return false` | 잡음 | vitest 3 failed \| 162 passed (165) | sweep ⑦ |
| V1.5b | `data-host.ts:84` | 다른 값·맞바꿈 | `if (visit(value)) return total` → `visit(value)` | 못 잡음 | EP-1 ⑤ "예산 초과 즉시 반환"·AC2 "넘는 순간 멈춘다" — 루트가 예산을 넘는 입력 없음(변이에서 자식 읽기 1 실측) | **이행** → D2 |
| V1.5c | `data-host.ts:95` | 제거 | `total += key.length` → `∅` | 잡음 | vitest 1 failed \| 164 passed (165) | sweep ⑦ |
| V1.6 | `data-host.ts:141` | 다른 값·맞바꿈 | `const end = nextSessionChunkEnd(messages, start, limits` → `const end = nextSessionChunkEnd(messages, sta` | 동치 | `splitSessionMessages` 에 limits 를 넘기는 production 호출 0(`rg` — measure 스크립트도 기본값) | 동치 |
| V1.7 | `session-load.ts:82` | 제거 | `if (seq > 0) await yieldTurn()` → `∅` | 잡음 | vitest 6 failed \| 159 passed (165) | sweep ⑦ |
| V1.7b | `session-load.ts:83` | 제거 | `if (!active.has(requestId) \|\| client.isClosed()) return` → `∅` | 잡음 | vitest 5 failed \| 160 passed (165) | sweep ⑦ |
| V1.7reg | `session-load.ts:82` | 다른 값·맞바꿈 | `if (seq > 0) await yieldTurn()` → `nextSessionChunkEnd(messages, start + 0) if (` | 잡음 | vitest 3 failed \| 162 passed (165) | sweep ⑦ |
| V1.8 | `session-load.ts:91` | 다른 값·맞바꿈 | `chunked: { chunks: seq, messages: sent }` → `chunked: { chunks: sent, messages: seq }` | 잡음 | vitest 6 failed \| 159 passed (165) | sweep ⑦ |
| V1.8b | `session-load.ts:91` | 다른 값·맞바꿈 | `chunked: { chunks: seq, messages: sent }` → `chunked: { chunks: seq, messages: messages.le` | 동치 | 루프는 `start === messages.length` 에서만 끝나 `sent` = length · 취소는 앞에서 반환 | 동치 |
| V1.9 | `data-host.ts:167` | 다른 값·맞바꿈 | `for (const message of chunk.messages) messages.push(mes` → `messages.push(...chunk.messages)` | 잡음 | vitest 1 failed \| 164 passed (165) | sweep ⑦ |
| V1.10 | `session-load.ts:53` | 다른 값·맞바꿈 | `isChunkedSession(session) ? assembleSession(session, re` → `session` | 잡음 | vitest 7 failed \| 158 passed (165) | sweep ⑦ |
| V1.L | `data-host.ts:13` | 다른 값·맞바꿈 | `export const SESSION_CHUNK_MAX_MESSAGES = 500` → `export const SESSION_CHUNK_MAX_MESSAGES = 501` | 잡음 | vitest 6 failed \| 159 passed (165) | sweep ⑦ |
| V1.Lc | `data-host.ts:16` | 다른 값·맞바꿈 | `export const SESSION_CHUNK_MAX_CHARS = 1_000_000` → `export const SESSION_CHUNK_MAX_CHARS = 2_000_` | 잡음 | vitest 6 failed \| 159 passed (165) | sweep ⑦ |
| V2.1a | `parts.ts:552` | 다른 값·맞바꿈 | `return text !== ''` → `return text.trim() !== ''` | 잡음 | vitest 3 failed \| 650 passed (653) | sweep ⑦ |
| V2.1b | `parts.ts:556` | 다른 값·맞바꿈 | `return text.trim() !== '' }` → `return text !== '' }` | 잡음 | vitest 5 failed \| 648 passed (653) | sweep ⑦ |
| V2.1c | `parts.ts:579` | 다른 값·맞바꿈 | `if (!hasSegmentReasoning(p.text)) continue` → `if (p.text === '') continue` | 잡음 | vitest 2 failed \| 651 passed (653) | sweep ⑦ |
| V2.2a | `chatStore.ts:2596` | 다른 값·맞바꿈 | `return useChatStore((s) => hasSegmentText(s.sessions[s.` → `return useChatStore((s) => s.sessions[s.activ` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2.2b | `chatStore.ts:2601` | 다른 값·맞바꿈 | `return useChatStore((s) => s.sessions[s.activeKey].live` → `return useChatStore((s) => s.sessions[s.activ` | 잡음 | vitest 2 failed \| 651 passed (653) | sweep ⑦ |
| V2.3 | `chatStore.ts:2606` | 다른 값·맞바꿈 | `return useChatStore((s) => (enabled ? s.sessions[s.acti` → `return useChatStore((s) => s.sessions[s.activ` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2.4a | `Timeline.tsx:57` | 다른 값·맞바꿈 | `[head, props.inflight, hasLiveText, hasLiveReasoning]` → `[head, props.inflight, hasLiveText]` | 잡음 | vitest 2 failed \| 651 passed (653) | sweep ⑦ |
| V2.4b | `Timeline.tsx:54` | 다른 값·맞바꿈 | `reasoning: props.inflight && hasLiveReasoning,` → `reasoning: props.inflight && hasLiveText,` | 잡음 | vitest 5 failed \| 648 passed (653) | sweep ⑦ |
| V2.4c | `Timeline.tsx:53` | 다른 값·맞바꿈 | `text: props.inflight && hasLiveText,` → `text: props.inflight && hasLiveReasoning,` | 잡음 | vitest 3 failed \| 650 passed (653) | sweep ⑦ |
| V2.4d | `Timeline.tsx:55` | 다른 값·맞바꿈 | `pending: props.inflight` → `pending: false` | 잡음 | vitest 11 failed \| 642 passed (653) | sweep ⑦ |
| V2.5 | `Timeline.tsx:59` | 다른 값·맞바꿈 | `const rows = useMemo(() => timelineRows(head, tail), [h` → `const rows = useMemo(() => { const all = [...` | 잡음 | vitest 4 failed \| 649 passed (653) | sweep ⑦ |
| V2.6 | `Timeline.tsx:180` | 다른 값·맞바꿈 | `live={row.live === true}` → `live={false}` | 잡음 | vitest 7 failed \| 646 passed (653) | sweep ⑦ |
| V2.6b | `Timeline.tsx:179` | 다른 값·맞바꿈 | `prefix={row.segment.text}` → `prefix={''}` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2.7 | `Timeline.tsx:216` | 다른 값·맞바꿈 | `const liveText = useLiveTextFor(live)` → `const liveText = useLiveTextFor(true)` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2.8a | `projection.ts:135` | 다른 값·맞바꿈 | `if (active && live.reasoning && segments.at(-1)?.kind !` → `if (active && live.reasoning)` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2.8b | `projection.ts:138` | 다른 값·맞바꿈 | `if (segments.at(-1)?.kind !== 'text') segments.push({ k` → `segments.push({ kind: 'text', text: '' }) // ` | 잡음 | vitest 3 failed \| 650 passed (653) | sweep ⑦ |
| V2.8c | `projection.ts:168` | 다른 값·맞바꿈 | `...(index === liveIndex ? { live: true as const } : {})` → `...{}` | 잡음 | vitest 13 failed \| 640 passed (653) | sweep ⑦ |
| V2.8d | `projection.ts:197` | 다른 값·맞바꿈 | `live: true })` → `})` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2.8e | `projection.ts:64` | 다른 값·맞바꿈 | `const previous = head.rows.at(-1) const rows = projectE` → `const previous = undefined as TimelineRow \| u` | 잡음 | vitest 2 failed \| 651 passed (653) | sweep ⑦ |
| V2.9 | `projection.ts:87` | 다른 값·맞바꿈 | `at: (index) => (index < base ? head.rows[index] : tail[` → `at: (index) => (index <= base ? head.rows[ind` | 잡음 | vitest 14 failed \| 639 passed (653) | sweep ⑦ |
| V2.10 | `projection.ts:100` | 다른 값·맞바꿈 | `return { ...committed, segment: { kind: 'text', text: r` → `return { ...committed, segment: { kind: 'text` | 잡음 | vitest 3 failed \| 650 passed (653) | sweep ⑦ |
| V2.10b | `projection.ts:113` | 다른 값·맞바꿈 | `reasoning: hasSegmentReasoning(live.reasoning),` → `reasoning: live.reasoning !== '',` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2b.2 | `chatStore.ts:573` | 다른 값·맞바꿈 | `reasoningVisible: entry.live.reasoningVisible \|\| hasSeg` → `reasoningVisible: hasSegmentReasoning(event.d` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2b.2b | `chatStore.ts:573` | 다른 값·맞바꿈 | `reasoningVisible: entry.live.reasoningVisible \|\| hasSeg` → `reasoningVisible: entry.live.reasoningVisible` | 잡음 | vitest 2 failed \| 651 passed (653) | sweep ⑦ |
| V2b.3 | `chatStore.ts:801` | 다른 값·맞바꿈 | `{ ...live, reasoning: '', reasoningVisible: false }` → `{ ...live, reasoning: '' }` | 잡음 | vitest 1 failed \| 652 passed (653) | sweep ⑦ |
| V2b.1 | `chatStore.ts:184` | 다른 값·맞바꿈 | `const EMPTY_LIVE: LiveTurnState = { text: '', reasoning` → `const EMPTY_LIVE: LiveTurnState = { text: '',` | 잡음 | vitest 8 failed \| 645 passed (653) | sweep ⑦ |
| V3.1 | `turns.ts:128` | 다른 값·맞바꿈 | `if (messages === previousMessages && show === previousS` → `if (messages === previousMessages) return pre` | 잡음 | vitest 3 failed \| 1090 passed (1093) | sweep ⑦ |
| V3.2 | `turns.ts:150` | 다른 값·맞바꿈 | `previousMessages[firstChange] === messages[firstChange]` → `previousMessages[firstChange]?.createdAt === ` | 잡음 | vitest 1 failed \| 1092 passed (1093) | sweep ⑦ |
| V3.3 | `turns.ts:154` | 다른 값·맞바꿈 | `previous[reuse + 1].startIndex < firstChange` → `previous[reuse + 1].startIndex <= firstChange` | 잡음 | vitest 2 failed \| 1091 passed (1093) | sweep ⑦ |
| V3.4 | `turns.ts:143` | 제거 | `show === previousShow &&` → `∅` | 잡음 | vitest 3 failed \| 1090 passed (1093) | sweep ⑦ |
| V3.4b | `turns.ts:144` | 다른 값·맞바꿈 | `messages.length >= previousMessages.length` → `true` | 동치 | 축소에서도 첫 변경 = 새 길이 → 재그룹·동치 복원 결과가 같다 · F-V3.4b(X1 400×40단계) green | 동치 |
| V3.5 | `turns.ts:157` | 다른 값·맞바꿈 | `reuse < previous.length ? Math.min(firstChange, previou` → `reuse < previous.length ? previous[reuse].sta` | 잡음 | vitest 2 failed \| 1091 passed (1093) | sweep ⑦ |
| V3.5b | `turns.ts:157` | 다른 값·맞바꿈 | `reuse < previous.length ? Math.min(firstChange, previou` → `reuse < previous.length ? Math.min(firstChang` | 동치 | `reuse ≥ previous.length` 는 이전 결과가 빈 경우뿐(앞 메시지 전부 숨김) — 0 부터 묶어도 같다 · F-V3.5b green | 동치 |
| V3.6 | `turns.ts:166` | 제거 | `if (exchangeEquals(before, exchange)) return before` → `∅` | 잡음 | vitest 5 failed \| 1088 passed (1093) | sweep ⑦ |
| V3.6b | `turns.ts:169` | 다른 값·맞바꿈 | `return match && turnEquals(match, turn) ? match : turn` → `return turn` | 잡음 | vitest 11 failed \| 1082 passed (1093) | sweep ⑦ |
| V3.7 | `Timeline.tsx:40` | 다른 값·맞바꿈 | `[groupIncrementally, messages, showAutomaticFeeds]` → `[groupIncrementally, messages]` | 잡음 | vitest 1 failed \| 1092 passed (1093) | sweep ⑦ |
| V3.8 | `turns.ts:133` | 제거 | `if (hit !== undefined) return hit ?? undefined` → `∅` | 잡음 | vitest 2 failed \| 1091 passed (1093) | sweep ⑦ |
| V3.8b | `turns.ts:129` | 다른 값·맞바꿈 | `const cache = show ? derived.shown : derived.hidden` → `const cache = derived.hidden` | 잡음 | vitest 3 failed \| 1090 passed (1093) | sweep ⑦ |
| V3.9 | `turns.ts:173` | 다른 값·맞바꿈 | `const result = reuse > 0 ? previous.slice(0, reuse).con` → `const result = restored` | 잡음 | vitest 9 failed \| 1084 passed (1093) | sweep ⑦ |
| V3b.1 | `ChatTile.tsx:98` | 다른 값·맞바꿈 | `[activeKey] ) const onPanelExpandedChange` → `[] ) const onPanelExpandedChange` | 잡음 | vitest 1 failed \| 1092 passed (1093) | sweep ⑦ |
| V3b.2 | `Exchange.tsx:85` | 제거 | `prev.onRestoreSteerDraft === next.onRestoreSteerDraft &` → `∅` | 잡음 | vitest 1 failed \| 1092 passed (1093) | sweep ⑦ |
| V3b.3 | `ChatTile.tsx:152` | 다른 값·맞바꿈 | `onRestoreSteerDraft={restoreSteerDraft}` → `onRestoreSteerDraft={undefined}` | 잡음 | vitest 2 failed \| 1091 passed (1093) | sweep ⑦ |
| V4.1 | `limits.ts:9` | 다른 값·맞바꿈 | `export const DIFF_INLINE_MAX_CHARS = 64_000` → `export const DIFF_INLINE_MAX_CHARS = 640_000` | 잡음 | vitest 4 failed \| 229 passed (233) | sweep ⑦ |
| V4.2 | `diffModel.ts:62` | 다른 값·맞바꿈 | `if (++newlines > limit) return limit + 1` → `++newlines` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V4.3 | `inline.ts:11` | 제거 | `if (oldValue.length + newValue.length > DIFF_INLINE_MAX` → `∅` | 잡음 | vitest 3 failed \| 230 passed (233) | sweep ⑦ |
| V4.3b | `inline.ts:13` | 제거 | `if (oldLines > DIFF_INLINE_MAX_LINES) return false` → `∅` | 동치 | `oldLines ≥ 401` 이면 두 번째 항 ≥ 0 이라 합 > 400 → false 그대로 | 동치 |
| V4.3c | `inline.ts:15` | 다른 값·맞바꿈 | `oldLines + countLinesUpTo(newValue, DIFF_INLINE_MAX_LIN` → `countLinesUpTo(newValue, DIFF_INLINE_MAX_LINE` | 잡음 | vitest 3 failed \| 230 passed (233) | sweep ⑦ |
| V4.5a | `inline.ts:41` | 다른 값·맞바꿈 | `if (pairChars > DIFF_INLINE_MAX_CHARS \|\| patchChars > P` → `if (patchChars > PATCH_INLINE_MAX_CHARS) retu` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V4.5b | `inline.ts:41` | 다른 값·맞바꿈 | `if (pairChars > DIFF_INLINE_MAX_CHARS \|\| patchChars > P` → `if (pairChars > DIFF_INLINE_MAX_CHARS) return` | 잡음 | vitest 3 failed \| 230 passed (233) | sweep ⑦ |
| V4.5s | `inline.ts:41` | 다른 값·맞바꿈 | `if (pairChars > DIFF_INLINE_MAX_CHARS \|\| patchChars > P` → `if (pairChars > PATCH_INLINE_MAX_CHARS \|\| pat` | 잡음 | vitest 2 failed \| 231 passed (233) | sweep ⑦ |
| V4.5c | `inline.ts:47` | 제거 | `lines += countLinesUpTo(source.after, DIFF_INLINE_MAX_L` → `∅` | 잡음 | vitest 6 failed \| 227 passed (233) | sweep ⑦ |
| V4.5d | `inline.ts:64` | 다른 값·맞바꿈 | `if (line[0] === '+') added++ else if (line[0] === '-') ` → `if (line[0] === '-') added++ else if (line[0]` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V4.6 | `toolMeta.ts:207` | 다른 값·맞바꿈 | `return diffStatsWithinBudget(sources)` → `return sources.length ? diffStatsWithinBudget` | 잡음 | vitest 6 failed \| 227 passed (233) | sweep ⑦ |
| V4.7 | `filePresentation.ts:27` | 다른 값·맞바꿈 | `: { kind: 'patch', patch: file.patch ?? '' }` → `: { kind: 'pair', before: '', after: file.pat` | 잡음 | vitest 3 failed \| 230 passed (233) | sweep ⑦ |
| V5.1 | `handler.ts:42` | 다른 값·맞바꿈 | `return { id: message.id, ok: true, result, size: result` → `return { id: message.id, ok: true, result, si` | 잡음 | vitest 4 failed \| 229 passed (233) | sweep ⑦ |
| V5.1b | `protocol.ts:101` | 다른 값·맞바꿈 | `(sum, line) => sum + COMPUTE_RESULT_ELEMENT_CHARS + lin` → `(sum, line) => sum + line.text.length,` | 잡음 | vitest 3 failed \| 230 passed (233) | sweep ⑦ |
| V5.2 | `protocol.ts:117` | 다른 값·맞바꿈 | `size: typeof message.size === 'number' ? message.size :` → `size: typeof message.size === 'number' ? mess` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V5.3 | `client.ts:194` | 다른 값·맞바꿈 | `writeCache(job.key, response.result, response.size)` → `writeCache(job.key, response.result, 0)` | 잡음 | vitest 7 failed \| 226 passed (233) | sweep ⑦ |
| V5.4a | `client.ts:112` | 제거 | `if (cost > cacheMax) return` → `∅` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V5.4b | `client.ts:111` | 다른 값·맞바꿈 | `const cost = key.length + size` → `const cost = size` | 잡음 | vitest 4 failed \| 229 passed (233) | sweep ⑦ |
| V5.4c | `client.ts:121` | 다른 값·맞바꿈 | `if (cacheChars <= cacheMax && cache.size <= cacheMaxEnt` → `if (cacheChars <= cacheMax) break` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V5.4d | `client.ts:110` | 제거 | `if (!Number.isFinite(size) \|\| size < 0) return` → `∅` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V5.6 | `limits.ts:15` | 다른 값·맞바꿈 | `export const COMPUTE_CACHE_MAX_ENTRIES = 1_000` → `export const COMPUTE_CACHE_MAX_ENTRIES = 1_00` | 잡음 | vitest 1 failed \| 232 passed (233) | sweep ⑦ |
| V5.6b | `limits.ts:17` | 다른 값·맞바꿈 | `export const COMPUTE_RESULT_ELEMENT_CHARS = 36` → `export const COMPUTE_RESULT_ELEMENT_CHARS = 0` | 잡음 | vitest 4 failed \| 229 passed (233) | sweep ⑦ |
| V6.1 | `limits.ts:19` | 다른 값·맞바꿈 | `export const COMPOSER_DECORATION_MAX_CHARS = 20_000` → `export const COMPOSER_DECORATION_MAX_CHARS = ` | 잡음 | vitest 3 failed \| 250 passed (253) | sweep ⑦ |
| V6.2 | `composerDecoration.ts:19` | 다른 값·맞바꿈 | `if (value === '' \|\| value.length > COMPOSER_DECORATION_` → `if (value === '') return []` | 잡음 | vitest 3 failed \| 250 passed (253) | sweep ⑦ |
| V6.2b | `composerDecoration.ts:19` | 다른 값·맞바꿈 | `value.length > COMPOSER_DECORATION_MAX_CHARS` → `value.length >= COMPOSER_DECORATION_MAX_CHARS` | 잡음 | vitest 4 failed \| 249 passed (253) | sweep ⑦ |
| V6.4a | `composerDecoration.ts:34` | 다른 값·맞바꿈 | `let matched = node?.end ? punctuation : -1` → `let matched = -1` | 잡음 | vitest 18 failed \| 235 passed (253) | sweep ⑦ |
| V6.4b | `composerDecoration.ts:37` | 제거 | `if (node?.end) matched = i + 1` → `∅` | 잡음 | vitest 8 failed \| 245 passed (253) | sweep ⑦ |
| V6.4c | `composerDecoration.ts:35` | 다른 값·맞바꿈 | `for (let i = punctuation; node && i < name.length; i++)` → `for (let i = punctuation; false && i < name.l` | 잡음 | vitest 8 failed \| 245 passed (253) | sweep ⑦ |
| V6.4d | `composerDecoration.ts:33` | 다른 값·맞바꿈 | `let node = skillIndex.get(name.slice(0, punctuation))` → `let node = skillIndex.get(name)` | 잡음 | vitest 15 failed \| 238 passed (253) | sweep ⑦ |
| V6.5a | `skillIndex.ts:10` | 제거 | `'.',` → `∅` | 잡음 | vitest 14 failed \| 239 passed (253) | sweep ⑦ |
| V6.5b | `skillIndex.ts:49` | 제거 | `if (name.length > SKILL_INDEX_MAX_NAME_CHARS) continue` → `∅` | 잡음 | vitest 1 failed \| 252 passed (253) | sweep ⑦ |
| V6.5c | `skillIndex.ts:46` | 제거 | `if (cached) return cached` → `∅` | 잡음 | vitest 1 failed \| 252 passed (253) | sweep ⑦ |
| V6.5d | `skillIndex.ts:62` | 제거 | `indexes.set(names, index)` → `∅` | 잡음 | vitest 1 failed \| 252 passed (253) | sweep ⑦ |
| V6.5e | `skillIndex.ts:22` | 다른 값·맞바꿈 | `export const SKILL_INDEX_MAX_NAME_CHARS = COMPOSER_DECO` → `export const SKILL_INDEX_MAX_NAME_CHARS = COM` | 잡음 | vitest 2 failed \| 251 passed (253) | sweep ⑦ |
| V7.1 | `ToolCard.tsx:167` | 다른 값·맞바꿈 | `<CopyIconButton text={() => copyText(call)} title={tr('` → `<CopyIconButton text={copyText(call)} title={` | 잡음 | vitest 1 failed \| 230 passed (231) | sweep ⑦ |
| V7.2 | `AssistantTurn.tsx:61` | 다른 값·맞바꿈 | `text={copyable ? () => turnCopyText(turn) : ''}` → `text={() => turnCopyText(turn)}` | 잡음 | vitest 4 failed \| 227 passed (231) | sweep ⑦ |
| V7.2b | `AssistantTurn.tsx:61` | 다른 값·맞바꿈 | `text={copyable ? () => turnCopyText(turn) : ''}` → `text={copyable ? turnCopyText(turn) : ''}` | 잡음 | vitest 2 failed \| 229 passed (231) | sweep ⑦ |
| V7.3 | `UserTurn.tsx:21` | 다른 값·맞바꿈 | `text={copyable ? () => turnCopyText(turn) : ''}` → `text={() => turnCopyText(turn)}` | 잡음 | vitest 1 failed \| 230 passed (231) | sweep ⑦ |
| V7.3b | `UserTurn.tsx:21` | 다른 값·맞바꿈 | `text={copyable ? () => turnCopyText(turn) : ''}` → `text={copyable ? turnCopyText(turn) : ''}` | 잡음 | vitest 1 failed \| 230 passed (231) | sweep ⑦ |
| V8.1 | `useDragResize.ts:57` | 다른 값·맞바꿈 | `if (frame === null) frame = window.requestAnimationFram` → `onChange(pending)` | 잡음 | vitest 6 failed \| 362 passed (368) | sweep ⑦ |
| V8.2 | `useDragResize.ts:48` | 다른 값·맞바꿈 | `const value = pending pending = null onChange(value) } ` → `pending = null } // ①` | 잡음 | vitest 5 failed \| 363 passed (368) | sweep ⑦ |
| V8.3 | `useDragResize.ts:69` | 다른 값·맞바꿈 | `if (pending !== null) { const value = pending pending =` → `release()` | 잡음 | vitest 2 failed \| 366 passed (368) | sweep ⑦ |
| V8.3b | `useDragResize.ts:60` | 제거 | `if (frame !== null) window.cancelAnimationFrame(frame)` → `∅` | 잡음 | vitest 2 failed \| 366 passed (368) | sweep ⑦ |
| V8.3c | `useDragResize.ts:62` | 제거 | `window.removeEventListener('mousemove', onMove)` → `∅` | 잡음 | vitest 3 failed \| 365 passed (368) | sweep ⑦ |
| V8.5 | `useDragResize.ts:35` | 제거 | `useEffect(() => () => dragRef.current?.cancel(), [])` → `∅` | 잡음 | vitest 1 failed \| 367 passed (368) | sweep ⑦ |
| V8.5b | `useDragResize.ts:35` | 다른 값·맞바꿈 | `useEffect(() => () => dragRef.current?.cancel(), [])` → `useEffect(() => () => dragRef.current?.finish` | 잡음 | vitest 1 failed \| 367 passed (368) | sweep ⑦ |
| V8.6 | `useDragResize.ts:84` | 제거 | `window.addEventListener('blur', finish)` → `∅` | 잡음 | vitest 2 failed \| 366 passed (368) | sweep ⑦ |
| V8.6b | `useDragResize.ts:84` | 다른 값·맞바꿈 | `window.addEventListener('blur', finish)` → `window.addEventListener('blur', cancel)` | 잡음 | vitest 3 failed \| 365 passed (368) | sweep ⑦ |
| V9.1 | `imageThumb.ts:33` | 다른 값·맞바꿈 | `resolve({ ok: false, reason: stage })` → `resolve({ ok: false, reason: 'load' })` | 잡음 | vitest 3 failed \| 379 passed (382) | sweep ⑦ |
| V9.1b | `imageThumb.ts:28` | 제거 | `stage = 'draw'` → `∅` | 잡음 | vitest 1 failed \| 381 passed (382) | sweep ⑦ |
| V9.1c | `imageThumb.ts:36` | 다른 값·맞바꿈 | `img.onerror = () => resolve({ ok: false, reason: 'load'` → `img.onerror = () => resolve({ ok: true, dataU` | 잡음 | vitest 2 failed \| 380 passed (382) | sweep ⑦ |
| V9.2 | `attachmentViews.ts:45` | 다른 값·맞바꿈 | `if (thumbnail.ok) view.previewDataUrl = thumbnail.dataU` → `view.previewDataUrl = thumbnail.ok ? thumbnai` | 잡음 | vitest 6 failed \| 376 passed (382) | sweep ⑦ |
| V9.3 | `attachmentViews.ts:9` | 다른 값·맞바꿈 | `export const THUMB_CONCURRENCY = 2` → `export const THUMB_CONCURRENCY = 3` | 잡음 | vitest 1 failed \| 381 passed (382) | sweep ⑦ |
| V9.4 | `attachmentViews.ts:58` | 다른 값·맞바꿈 | `views[index] = await buildView(items[index], deps)` → `views.push(await buildView(items[index], deps` | 잡음 | vitest 11 failed \| 371 passed (382) | sweep ⑦ |
| V9.5 | `useAttachments.ts:143` | 다른 값·맞바꿈 | `downscale: downscaleDataUrl,` → `downscale: async () => ({ ok: false as const,` | 잡음 | vitest 1 failed \| 381 passed (382) | sweep ⑦ |
| V9.5b | `attachmentViews.ts:44` | 제거 | `.catch((): ThumbnailResult => ({ ok: false, reason: 'lo` → `∅` | 잡음 | vitest 3 failed \| 379 passed (382) | sweep ⑦ |
| V10.1 | `measure-ui-inputs.mjs:38` | 다른 값·맞바꿈 | `export function emptySessionMessages(count = 200_000) {` → `export function emptySessionMessages(count = ` | 잡음 | node --test fail 1 · m1 입력 크기·개수가 §19 표와 같다 | sweep ⑦ |
| V10.3 | `measure-ui-inputs.mjs:195` | 다른 값·맞바꿈 | `const measured = times.slice(WARMUP_RUNS).sort((a, b) =` → `const measured = times.slice(0, MEASURED_RUNS` | 잡음 | node --test fail 1 · m4 요약 = 예열 1회를 뺀 9회의 중앙값·최대 | sweep ⑦ |
| V10.3b | `measure-ui-inputs.mjs:201` | 제거 | `if (typeof run !== 'function') return 'N/A(함수 없음)'` → `∅` | 잡음 | node --test fail 2 · m3 던지는 측정 → `N/A(실패: 메시지)` · 없는 함수 → `N | sweep ⑦ |
| F-V1.2 | `data-host.ts:119` | 제거 | `if (end > start && parts + size > limits.parts) break` → `∅` | 잡음 | vitest 36 failed \| 1265 passed (1301) | ⑥ 민감도 |
| F-V1.3 | `data-host.ts:123` | 다른 값·맞바꿈 | `if (cost > remaining) {` → `if (false) {` | 잡음 | vitest 164 failed \| 1137 passed (1301) | ⑥ 민감도 |
| F-V1.5b | `data-host.ts:84` | 다른 값·맞바꿈 | `if (visit(value)) return total` → `visit(value)` | 못 잡음 | X3 에도 루트 예산 초과 입력 없음(D2 와 같은 공백) | 이행(D2) |
| F-V1.5c | `data-host.ts:95` | 제거 | `total += key.length` → `∅` | 못 잡음 | X3 은 키 길이 단위를 대조하지 않음 — 원 sweep V1.5c 는 잡음 | ⑥ 한계 |
| F-V2.8a | `projection.ts:135` | 다른 값·맞바꿈 | `if (active && live.reasoning && segments.at(-1)?.kind !` → `if (active && live.reasoning)` | 잡음 | vitest 21 failed \| 1280 passed (1301) | ⑥ 민감도 |
| F-V2.8b | `projection.ts:138` | 다른 값·맞바꿈 | `if (segments.at(-1)?.kind !== 'text') segments.push({ k` → `segments.push({ kind: 'text', text: '' }) // ` | 잡음 | vitest 101 failed \| 1200 passed (1301) | ⑥ 민감도 |
| F-V3.3 | `turns.ts:154` | 다른 값·맞바꿈 | `previous[reuse + 1].startIndex < firstChange` → `previous[reuse + 1].startIndex <= firstChange` | 잡음 | vitest 67 failed \| 1234 passed (1301) | ⑥ 민감도 |
| F-V3.4b | `turns.ts:144` | 다른 값·맞바꿈 | `messages.length >= previousMessages.length` → `true` | 동치 | 위 V3.4b 근거 | 동치 |
| F-V3.5 | `turns.ts:157` | 다른 값·맞바꿈 | `reuse < previous.length ? Math.min(firstChange, previou` → `reuse < previous.length ? previous[reuse].sta` | 잡음 | vitest 54 failed \| 1247 passed (1301) | ⑥ 민감도 |
| F-V3.5b | `turns.ts:157` | 다른 값·맞바꿈 | `reuse < previous.length ? Math.min(firstChange, previou` → `reuse < previous.length ? Math.min(firstChang` | 동치 | 위 V3.5b 근거 | 동치 |
| F-V3.6 | `turns.ts:166` | 제거 | `if (exchangeEquals(before, exchange)) return before` → `∅` | 잡음 | vitest 400 failed \| 901 passed (1301) | ⑥ 민감도 |
| F-V3.8 | `turns.ts:133` | 제거 | `if (hit !== undefined) return hit ?? undefined` → `∅` | 못 잡음 | X1 은 파생 캐시 적중을 보지 않음 — 원 sweep V3.8 은 잡음 | ⑥ 한계 |
| F-V6.4d | `composerDecoration.ts:33` | 다른 값·맞바꿈 | `let node = skillIndex.get(name.slice(0, punctuation))` → `let node = skillIndex.get(name)` | 잡음 | vitest 26 failed \| 1275 passed (1301) | ⑥ 민감도 |
| F-V6.5a | `skillIndex.ts:10` | 제거 | `'.',` → `∅` | 잡음 | vitest 8 failed \| 1293 passed (1301) | ⑥ 민감도 |

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-03 | UT | REQUIRED | **PAIR_FAIL (D2)** | `data-host.test.ts` e1~e12 — 자리 ⑤ 의 루트 조기 반환(`data-host.ts:84`)을 지워도 green(V1.5b) | EP-1 ①~⑥·⑨ 7 — ⑤ 미닫힘 |
| VP-08 | UT | REQUIRED | PASS | `projection.test.ts` `'presence tail ≡ string tail'` b1~b9 · `parts.test.ts` 단일 규칙 · X2 동치 | EP-2 ①⑧⑨⑩ 4/4 — V2.1a~c·V2.8a~e·V2.9·V2.10·V2.10b 잡음 |
| VP-11 | UT | REQUIRED | PASS | `turns.test.ts` `'createExchangeGrouper'` g1~g14 · X1 | EP-3 8/8 — V3.1~V3.9 잡음 · V3.4b·V3.5b 동치 |
| VP-15 | UT | REQUIRED | PASS | `inline.test.ts` c1~c5 | EP-4 ①~⑤ 5/5 — V4.1·V4.2·V4.3·V4.3c 잡음 · V4.3b 동치 |
| VP-16 | UT | REQUIRED | PASS | `toolMeta.test.ts` a1~a4·50× · `filePresentation.test.ts` a5~a8 | EP-4 ⑥⑦ 2/2 — V4.5a·b·s·c·d·V4.6·V4.7 잡음 |
| VP-19 | UT | REQUIRED | PASS | `client.test.ts` `'캐시 비용 (0325)'` k1~k7 | EP-5 ②~⑥ 5/5 — V5.2·V5.3·V5.4a~d·V5.6·V5.6b 잡음 |
| VP-23 | UT | REQUIRED | PASS | `composerDecoration.test.ts` d1~d12 · `skillIndex.test.ts` · X4 | EP-6 5/5 — V6.1~V6.5e 잡음 |
| VP-26 | IT | REQUIRED | PASS | `AssistantTurn.copy`·`UserTurn.copy`·`ToolCard.interaction` y1~y5 | EP-7 4/4 — V7.1~V7.3b 잡음 |
| VP-28 | UT | REQUIRED | PASS | `useDragResize.test.ts` r1~r8 | EP-8 6/6 — V8.1~V8.6b 잡음 |
| VP-30 | UT | REQUIRED | PASS | `attachmentViews.test.ts` t1~t8 · `imageThumb.test.ts` t9 · `composerSubmit.test.ts` t10 | EP-9 5/5 — V9.1~V9.5b 잡음 |
| VP-32 | UT | REQUIRED | PASS | `chatStore.liveSelectors.test.ts` h1~h6 | EP-2b 5/5 — V2b.1~V2b.3 잡음 |
| VP-33 | UT | REQUIRED | PASS | `node --test scripts/measure-ui-inputs.test.mjs` m1~m5 | EP-10 4/4 — V10.1·V10.3·V10.3b 잡음 |
| VP-13·17·21 | UT | REGRESSION | PASS | 기존 케이스 green(전체 실행) | 공유 |
| VP-02 | IT | REQUIRED | PASS | `session-load.bounds.test.ts` q1~q3 · 머리 합 | EP-1 ⑦⑧⑩ 3/3 — V1.7·V1.7b·V1.7reg·V1.8·V1.10 잡음 · V1.8b 동치 |
| VP-07 | IT | REQUIRED | PASS | `chatStore.liveSelectors` · `Timeline.memo` p1~p3 · `Timeline.selection` | EP-2 ②~⑦ 6/6 — V2.2a~V2.7 잡음 |
| VP-12 | IT | REQUIRED | PASS | `ChatTile.workLifetime` · `Exchange.compare` | EP-3b 6/6(검색 13줄 = TO-BE 13) — V3b.1~3 잡음 |
| VP-20 | IT | REQUIRED | PASS | `client.test.ts:'caches by the size the worker computed…'` | EP-5 ① 1/1 — V5.1·V5.1b 잡음 |
| VP-09·24 | IT | REGRESSION | PASS | 기존 선택·스크롤·IME 케이스 green | 공유 |
| VP-05 | ST | REGRESSION | PASS | `chatStore.native-history.test.ts` 두 케이스 green | 0 |
| VP-04 | AT | REGRESSION | PASS | 0324 AC15~17 기존 케이스 green | 공유 |
| VP-01 | AT | REQUIRED | PASS | `session-load.bounds.test.ts:'빈 parts 200,000건…'` · `transport/session-load.test.ts:'200,000건을 한 조각·400조각…'` — 조립 경로는 V1.9·V1.10 잡음으로 따로 닫힌다 | 공유 |
| VP-06·10·14·18·22·25·27·29 | AT | REQUIRED | PASS | 하위 pair 좌표 + 각 AT 신규 케이스 | 공유 |
| VP-31 | AT | REQUIRED | 사람 실기 대기 | AC19 — Windows 장비·설치본·진단 빌드(§19). 이 환경 불가 | 0 |

### AT / AC 합계

- ✅ 20 · ⚠️ 2 · ❌ 0 = 22. ⚠️ = AC2(동작은 맞다 — X3·X5 에서 읽기 0 — 그러나 자리 ⑤ 잠금 공백 D2) · AC19(사람 실기).
- 구현 자기보고 21/22 와 다른 1건은 AC2 다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| 가드 5종 | PASS | `check-migrations-appendonly`·`check-doc-inventory --check`·`check-product-naming`·`check-test-budgets`·`check-ui-thread` 전부 exit 0 |
| lint | PASS | error 0 · warning 3(`DiffBody.tsx`·OpenCode `Timeline.tsx:57`·`useTranscriptVirtualizer.ts:22`) — `5923d9a` worktree 의 `eslint` 도 같은 3건 |
| typecheck | PASS | node·web·test exit 0 |
| vitest(필터 없음) | 기준선 한계 | 1,043파일(9 fail · 1,030 pass · 4 skip) / 9,958케이스(22 fail · 9,924 pass · 1 expected fail · 11 skip) · unhandled 1. `src/main` 실패 22 의 이름 집합이 `5923d9a` worktree 실행과 같다(`diff` → SAME) · 원인은 Windows 경로·`win32` 분기(`expected '…/app/C:/work' to be 'C:/work'`) · 이번 변경이 그 9파일을 건드리지 않았다 |
| `node --test scripts/*.test.mjs` | PASS | 1,025/1,025 |
| 빌드 + 스모크 | PASS | `electron-vite build` exit 0 · `smoke-hosts` OK · `smoke-preload` OK(키 7) |
| trailer 파싱 | PASS | `git log -1 --format='%(trailers:only=true)' 1f2a8af` → 6키 + 공동 저자·세션 |

## 7. 숫자 / 상한 재측정

- 강제 지점: §10 자리 합 10+10+5+8+6+8+6+5+4+6+5+4 = 77 — 구현 보고 77/77 과 같다. 닫힌 자리는 76(EP-1 ⑤ 미닫힘).
- 구현 보고 sweep 분모 검산 `45 · 0 · 17 · 84 = 146` 은 행 수와 맞다(검산 줄 1회 대조).
- 검색 줄 수: EP-1 17 · EP-2 32 + store 3 · EP-2b 14 · EP-3 9 · EP-3b 13 · EP-4 31 — EP-1·EP-2b·EP-3b·EP-4 는 구현 보고와 같다.

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC19 | AC22(측정 스크립트 입력·요약·N/A) — VP-33 | Windows 같은 장비에서 `ee8ac81` vs 단계 A — 설치본 `perf.stall` · 진단 빌드 trace/Profiler · `node scripts/measure-ui-inputs.mjs --src <트리>`(§19). 0324 AC22·AC23·AC52′ 동시 수행(D-028) |

## 9. 게이트 재실행 메모

- 실행 집합은 `app/AGENTS.md` "로컬 확인" 목록 전부(§5 표). `npm test` 는 쓰지 않았다.
- lint(`--fix`)·빌드는 `1f2a8af` 의 별도 worktree 에서 돌려 작업 트리를 바꾸지 않았다(그 worktree `git status` → 로그 파일 1개만).
- 잔여물: 검증용 worktree 둘(`5923d9a`·`1f2a8af`, scratchpad)은 커밋 전에 지운다 · fuzz 임시 파일은 실행 뒤 삭제했다(`git status` 깨끗).

## 11. Repository operation checks

- INDEX: 이번 턴에 `verify/RETURN_TO_PLAN` · 라운드 2 · 다음 주체 Claude(설계)로 갱신 · 비고 5줄 이내.
- 대상 커밋 좌표: `363b877`·`f79a755`·`4c7d087`·`5923d9a`(설계) · `1f2a8af`(r1) — 모두 `git cat-file -t` = commit, `origin/ccr-ab974d11-oi6kar` 에 있다. `origin/main` 조상은 아니다(PR #633 미병합) — 병합 뒤 다음 verify 가 `main` 해시로 교정한다.
- `[구현자 기입]` 7필드 전부 존재 · 강제 지점 표는 pair 별 §10 자리 전부와 `남긴 곳` 열을 담는다.
- AGENTS.md 변경 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #6 §10 술어 셋 | 타당 — 정의 문장과 출력이 갈린다 | D1(PLAN_GAP) |
| #1 e9 에 1,000,000 입력 추가 · #7 중복 clamp 삭제 | 구현 세부 보완 — 등록 변이를 살린다 | 반영됨(V1.9·V4.2 잡음) |
| #3 I9 대체 함수 · #4 새 mousedown 취소 · #5 reject settle | 구현 세부 — AC 의미 불변 | 수용 |
| §12 표 밖 기존 테스트 4곳 기대값 변경 | 0324 의미를 단언하던 테스트를 D-009·D-038 로 옮김 — plan Decision 과 일치 | 수용 |

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | §10 자리 검색 술어가 EP-1 ⑧ · EP-2b ④ · EP-5 ② 를 잡지 못한다 | 이행(plan 내부 불일치) — §10 머리 "자리마다 줄이 1개 이상" vs 출력 0줄 | §10 EP-1·EP-2b·EP-5 / VP-02·VP-32·VP-19 | **PLAN_GAP** | 설계자가 술어에 `chunked` · `\.\.\.entry\.live` · `\bsize\b`(또는 정의를 "출력 ⊆ 목록")로 고친다 — 넓힌 술어의 새 자리 0(§0 표) |
| D2 | `estimateWireChars` 루트 예산 초과 조기 반환(`data-host.ts:84`)을 지워도 green | 이행 — §10 EP-1 ⑤ "예산 초과 즉시 반환" · AC2 "남은 예산을 넘는 순간 멈춘다" | VP-03 | **BLOCKING** | 구현자가 루트 하나로 예산을 넘는 입력(예산 0·1, 객체 루트)에서 자식 읽기 0 을 단언하는 UT 를 더한다 — V1.5b 가 red 여야 닫힌다 |
| N1 | `countLines`·`diffStatWithinCap` production 참조 0, `splitSessionMessages` 는 측정 스크립트만 | 비귀속 — plan §10 이 현행·래퍼로 유지 | — | NON_BLOCKING | 정리는 단계 C 와 함께 판단 |

## 14. Review Signals — 사실만

- 이전 라운드 증상: 해당 없음(1회째).
- 관련 지침: §10 정의 문장이 이미 "자리마다 줄 1개 이상"을 요구했다 · 구현자가 같은 불일치를 #6 으로 올렸다.
- 사용자 결정 변경: 없음.
- 반복 환경 한계: Windows 전용 분기·경로 main 9파일 22케이스(변경 전과 같은 집합) · AC19 실창.
- 독립 축(⑥) 발견: 0(5축). D2 는 sweep(⑦)에서 나왔다 — 구현자 sweep 146항목에 같은 변이가 없었다.

## 15. 결론

- 상태: **RETURN_TO_PLAN** — D1(PLAN_GAP)이 있어 설계자가 먼저다. D2(BLOCKING)는 같은 라운드의 재구현에서 닫는다.
- verify 횟수: 1회째(창 안).
- pair 결과: REQUIRED/REGRESSION PASS 31 · PAIR_FAIL 1(VP-03, D2) · 사람 실기 대기 1(VP-31).
- AC: ✅ 20 · ⚠️ 2(AC2 잠금 공백 · AC19 사람) · ❌ 0.
- 운영 gate: 전부 PASS(vitest 22 는 기준선 차집합 ∅).
- 다음 단계: 설계자 — D1 술어 정정(새 Delta V revision, 규범 행만) → `plan/READY` → 구현자 — D2 UT 추가(r2) → verify 2회째.
