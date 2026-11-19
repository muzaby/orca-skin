# Verify — 0326-transcript-incremental-model

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0326-transcript-incremental-model` |
| 검증자 | Claude Code |
| 일자 | 2026-11-19 |
| 대상 커밋/range | `5b489f8..c07a19f` (`dccff2d` r1.1 · `38f64c8` r1.2 · `d404976` r1.3 · `c07a19f` r1.3 타입 수정) |
| 구현 전 plan 기준 | `5b489f8` (V1 rev 7 · READY) |
| V mode / 유효 V | `Baseline V: V1 rev 7` |
| 검증 기준 plan revision | `5b489f8:V1 rev 7` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 확장 창 | verify 1회째 — 창 안 · 다시 열린 노드 없음 |
| 독립 축(⑥) | 4건 — 앵커 복원 무력화 · 초점 overscan 제거 · `scrollTop` 쓰기 제거 · 접기 `remove` 소거. 못 잡음 2 |
| 열거 sweep(⑦) | **전수 미완료** — 등록 변이 11건만 재측정(아래). 좌표 자체가 없는 pair가 다수라 sweep 분모가 성립하지 않는다 |
| 발견 분류 | 이행 4 · 현재 1 · 확장 0 · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 기록만 — Codex(커밋 trailer `Agent: codex`). 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` 한 줄(`READY` → `IN_PROGRESS (V1 rev 7 · r1.2)`)과 `[구현자 기입]` r1.1~r1.3 절 추가뿐이다(`git diff 5b489f8..c07a19f -- …/plan.md`).
- **기준선이 diff로 성립하는가**: 예(`5b489f8`).
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점에 사용할 원 기준: `5b489f8` 의 §7 AC1~AC35 · §7-A VP-01~VP-39.
- 메타 `상태`가 `IN_PROGRESS (… r1.2)` 로 남아 INDEX `IMPL_DONE (r1.3)` 와 갈린다 — D6.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 기준 V `none`, 0325·0324 는 REGRESSION 으로만 참조 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | VP-02~VP-35·VP-39 가 R/SD/AR/MD 각 노드를 같은 레벨로 닫는다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-36~VP-38 |
| pair별 path·§10 자리 목록·직접 oracle | 유효(목록 재검색은 이번에 못 함) | 모든 pair 에 자리별 좌표가 적혀 있다. §8 의 §10 자리 검색 명령은 **이번 라운드에 다시 돌리지 않았다** — 구현이 좌표를 만들지 않아 분모 대조 전에 판정이 났다 |
| 선택적 적대 증거·선택 이유 | 유효 | pair 마다 `required — …` 변이 목록 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 현재 변경 산출물의 운영 gate | 유효 | §7-A 운영 gate 5행 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| R-01 메시지 번호 | 에이전트 발급 번호가 저장·로드·창에서 같다 | sender → receiver → writer → reader → reducer — 배선됨, **종단 oracle(ST-01) 없음** |
| R-03·R-04 블록 모델·공통 뷰포트 | 세 화면이 `TranscriptViewport` 하나로 가상화 | `claude/transcript/Timeline.tsx` · `opencode/transcript/Timeline.tsx` → `TranscriptViewport.tsx:256 useVirtualizer` — 배선됨 |
| R-05 위쪽 변위 앵커(AC20) | 앞삽입·위 블록 크기 변화 뒤 같은 문자가 같은 거리 | **미배선** — `TranscriptViewport.tsx:478-486` `captureCurrentAnchor` 정의 뒤 `void` 만, 호출 0. 복원 effect(`:467`)는 `activeAnchorRef` 가 늘 `null` 이라 즉시 반환. 자동 보정은 `:268` 에서 끔 — D1 |
| R-07 선택 보존(AC26) | 가시 ± overscan ∪ 초점 ± overscan ∪ 양 끝 ∪ 앵커 | `range.ts` 구현됨, 초점 overscan 잠금 없음 — D3 |

```text
버스 → sender(번호) → receiver → writer(행) → reader(로드) → loadSession → LOAD_SESSION(reset)
     → relay → reducer RECV_EVENT → transcriptChanges → claudeBlocks/openCodeBlocks → BlockSnapshot
     → TranscriptViewport(useVirtualizer · rangeExtractor · CopySerializationHost) → 블록 컴포넌트
앞삽입: chatActions.prependHistory → PREPEND_HISTORY → (앵커 캡처 없음) → 블록 → 뷰포트
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 결함 | 앞삽입·가시 영역 위 블록 측정 변화에서 읽던 자리가 밀린다 — 캡처 0 · 자동 보정 끔(D1) |
| false success 가능성 | 있음 | 구현 보고 `Criteria-Met 34/35` · "VP-02~VP-39 SELF_PASS" — plan 좌표 29개 중 21개, 테스트 파일 18개가 트리에 없다(D2) |
| partial failure/rollback | 확인 안 함 | writer 재커밋 멱등(w5·w9·w10)의 직접 좌표가 없어 이번에 판정하지 않았다 |
| A 대신 B | 일부 | AC20 문자 위치 앵커 대신 OpenCode 는 기존 행 단위 저장 앵커(`ScrollController.tsx:186-194`)만 남았다 |
| 증상만 제거 | 해당 없음 | — |
| 최적화가 잃은 관측 | 확인 안 함 | — |
| 출력/요청 worst-case | 확인 안 함 | J9 상한은 구현자 보고(2000)만 — 재측정하지 않았다 |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 정의 `captureCurrentAnchor` | 미배선 | VP-26 · AC20 · EP-12 — D1 |
| `chatActions.prependHistory` production 호출자 | 정상(경계) | 소비자는 단계 E(D-048) — 0326 은 고정 입력·store 로 잠근다. 다만 그 잠금(ST-03)이 없다 — D2 |
| `TranscriptViewport` 를 직접 렌더하는 테스트 | 0 | `TranscriptViewport\|CopySerializationHost` 를 import 하는 테스트는 `lib/transcript/viewport/copy.test.ts` 1개(주석 문자열) — 뷰포트 IT/ST 좌표 부재(D2) |
| `scrollTop` 쓰기 자리 | 정상 | `features/chat` transcript 범위에서 `TranscriptViewport.tsx:70` 한 곳(`rg "scrollTop\s*=\|scrollTo(\|scrollBy("`; 나머지 3건은 rightpanel) |
| 형제 정책 비대칭 | 확인 안 함 | — |

## 4. 기존 테스트 / semantic 검증 확인

- **plan 좌표 실재 확인** — §7·§7-A 에 적힌 테스트 파일 82개 중 **없음 22**(VP-37 이 삭제를 예정한 `Timeline.grouper`·`workToolResults` 2개 제외 시 20 · 중복 표기 정리 시 고유 18). 테스트명 좌표 29개 중 **없음 21**(남은 8개는 대부분 REGRESSION VP-36~VP-38).
  - 없는 파일: `message-identity.integration.test.ts` · `chatReducer.messageIdentity.test.ts` · `shared/message-identity.testfixture.ts` · `send.sinks.test.ts` · `chatReducer.messageId.test.ts` · `chatStore.commitEcho.test.ts` · `chatReducer.changeLog.test.ts` · `chatReducer.messageIndex.test.ts` · `chatStore.cancelled.test.ts` · `TranscriptViewport.{reopen,lateResult,live,transition,prepend,selection,disclosure}.test.ts` · `harnesses/registries/transcript.viewport.test.ts` · `harnesses/claude/transcript/Timeline.viewport.test.ts` · `rightpanel/panelConsumers.test.ts`.
  - 있는 파일의 분기 기호 대비 실제 케이스(`grep -oE "\b<기호>[0-9]+\b"` + 케이스 수): `persistence-sender` k5·k23·k24·k25 / k1~k27 · `turn-coordinator` 0 / k9~k11·k19·k21·k26 · `native-projection`·`reader` 0 / i1~i8 · `writer` w16 / w1~w16 · `changeLog` 2케이스 / l1~l11 · `messageOrder` 2 / q1~q7 · `blockList` 2 / u1~u7 · `segmentCache` 3 / s1~s8 · `openCodeBlocks` z1·z6·z9 / z1~z9 · `anchor` a1·a2·a5·a8·a12 / a1~a12 · `entry` p7·p8·p10 / p7·p8·p10·p11·p13~p15 · `ToolCard.interaction` 3 / e1~e8 · `chatReducer.prepend` 5(기호 없음) / g1~g16 · `measure-ui-inputs` j1~j7 한 케이스.
- **선택된 적대 증거 재측정** — 등록 변이 11건 중 검출 11 · 미검출 0(아래 V01~V11). 나머지 등록 변이는 좌표가 없어 돌릴 대상이 없다.
- **자리 미지정 등록 변이** — 이번 라운드 미실행.
- **직전 `못 잡음`·`동치` 재실행(③)·이전 라운드 대조(④)** — 해당 없음(1회째).
- **독립 축(⑥)** — 4건: X01·X02 못 잡음, X03·X04 잡음.
- **열거 sweep(⑦)** — 미완료. 1회째 전수가 요구되지만, 좌표 부재로 pair 대부분의 oracle 이 없어 sweep 결과가 "전부 못 잡음" 으로만 나온다 — 구현이 좌표를 만든 뒤 2회째에서 전수로 돈다.

**고장 이력** — `python3 .agents/skills/handoff-verify/scripts/mutate.py <spec> --cwd app` · 끝난 뒤 `git status` 깨끗(원복 확인).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 결과 | 이번 결과 | 잡은 테스트 / 근거 | 하한·출처 | 분류 |
|---|---|---|---|---|---|---|---|---|---|
| V01 | `lib/transcript/viewport/reserve.ts:15` | 다른 값 | `0.5 *` → `1 *` | `reserve.test.ts` | 신규 | 잡음 | 3 failed/3 | ① VP-23 p3 | — |
| V02 | `viewport/entry.ts:47` | 맞바꿈 | OpenCode resume `restore-saved` → `scroll-bottom` | `entry.test.ts` | 신규 | 잡음 | 1/3 | ① VP-23 p8 | — |
| V03 | `viewport/entry.ts:37` | 뒤집기 | `open` 하단을 저장 앵커 없을 때만 | `entry.test.ts` | 신규 | 잡음 | 1/3 | ① VP-23 p7 | — |
| V04 | `viewport/pin.ts:63` | 제거 | 위 방향 입력 해제 → `if (false)` | `pin.test.ts` | 신규 | 잡음 | 1/3 | ① VP-23 p9 | — |
| V05 | `lib/transcript/changeLog.ts:25` | 제거 | 64 상한 slice 제거 | `changeLog.test.ts` | 신규 | 잡음 | 1/2 | ① VP-10 l3 | — |
| V06 | `lib/transcript/blockList.ts:116` | 고정값 | `+ Number(keyChanged)` → `+ 1` | `blockList.test.ts` | 신규 | 잡음 | 1/2 | ① VP-15 u7 | — |
| V07 | `reducer/chatReducer.ts:1664` | 제거 | 페이지 안 중복 건너뜀 | `chatReducer.prepend.test.ts` | 신규 | 잡음 | 1/5 | ① VP-39 g2 | — |
| V08 | `reducer/chatReducer.ts:1684` | 고정값 | T 검사 → `true` | 같음 | 신규 | 잡음 | 1/5 | ① VP-39 g4 | — |
| V09 | `reducer/chatReducer.ts:1693` | 고정값 | `reachedStart` 무시 | 같음 | 신규 | 잡음 | 1/5 | ① VP-39 g12 | — |
| V10 | `reducer/chatReducer.ts:1671` | 제거 | 겹침 연속성 검사 → `if (false)` | 같음 | 신규 | 잡음 | 1/5 | ① VP-39 g10 | — |
| V11 | `store/chatStore.ts:607` | 고정값 | text run 번호 비교 → `true` | `chatStore.deltaBatch.test.ts` | 신규 | 잡음 | 1/8 | ① VP-34 b7 | — |
| X01 | `components/transcript/TranscriptViewport.tsx:470` | 고정값 | 앵커 복원 effect `if (!el \|\| !anchor) return` → `if (true) return` | `features/chat` 전체 | 신규 | **못 잡음** | 2,651 passed/2,651 — 캡처 호출 0 이라 원래도 실행되지 않음 | ⑥ | 현재 + 이행 — D1 |
| X02 | `lib/transcript/viewport/range.ts:50` | 제거 | 초점 `± overscan` → 초점 블록 하나 | `features/chat` 전체 | 신규 | **못 잡음** | 2,651 passed/2,651 | ⑥ | 이행 — D3 |
| X03 | `TranscriptViewport.tsx:70` | 제거 | `element.scrollTop = top` 제거 | `features/chat` 전체 | 신규 | 잡음 | 3 failed/2,651 | ⑥ | — |
| X04 | `lib/transcript/changeLog.ts:52` | 다른 값 | 접기 `remove` → 항목 삭제 | `features/chat` 전체 | 신규 | 잡음 | 4 failed/2,651 | ⑥ | — |

- 검산: 시도 15 = 잡음 13 · 못 잡음 2 · 동치 0 · 경계 0. 못 잡음 2건: 현재+이행 1(X01) · 이행 1(X02).
- 동작 보존 추출 라운드인가: 아니오.

## 5. V-pair closeout — `UT → IT → ST → AT`

판정 원칙: 직접 oracle 좌표 파일·케이스가 트리에 없으면 그 pair 는 닫히지 않았다(`PAIR_FAIL` — 열거 원문 위반). 좌표가 있고 등록 변이를 재측정했으면 그 범위만 적는다.

| Pair | 레벨 | 결과 | 근거 (자리별 좌표 실재 · 재측정) |
|---|---|---|---|
| VP-04 MD-01↔UT-01 | UT | PAIR_FAIL | k1~k27 중 k5·k23~k25 만, `turn-coordinator` k-케이스 0 |
| VP-05 MD-02↔UT-02 | UT | PAIR_FAIL | i1~i8 0 — 앞삽입 1케이스(`native-projection.test.ts:'keeps the latest bound native ID stable…'`) |
| VP-06 MD-04↔UT-04 | UT | PAIR_FAIL | w1~w16 중 w8·w16 만 |
| VP-07 MD-03↔UT-03 | UT | PAIR_FAIL | `chatReducer.messageId.test.ts`·`chatStore.commitEcho.test.ts` 없음 |
| VP-10 MD-05↔UT-05 | UT | PAIR_FAIL | `changeLog` 2케이스 / l1~l11 · EP-5 ③ 자리 sweep 파일 없음. V05 잡음 |
| VP-11 MD-06↔UT-17 | UT | PAIR_FAIL | q1~q7 대비 2케이스(기호 없음) |
| VP-14 MD-07↔UT-06 | UT | PAIR_FAIL | y2·y4~y7·y9·y11 없음 |
| VP-15 MD-08↔UT-08 | UT | PAIR_FAIL | u1~u7 대비 2케이스. V06 잡음 |
| VP-16 MD-09↔UT-07 | UT | PAIR_FAIL | `openCodeBlocks` z1·z6·z9 만 |
| VP-18 MD-10↔UT-09 | UT | PAIR_FAIL | s1~s8 대비 3케이스 |
| VP-23 MD-11↔UT-10 | UT | PAIR_FAIL | p5·p11·p13~p15 없음. V01~V04 잡음 |
| VP-26 MD-12↔UT-11 | UT | PAIR_FAIL | a3·a4·a6·a7·a9~a11 없음 · production 캡처 미배선(D1) |
| VP-28b MD-13↔IT-07 | IT | PAIR_FAIL | d1~d12 있음 · `TranscriptViewport.disclosure.test.ts` 없음 |
| VP-30 MD-14↔UT-12 | UT | 미판정 | m1~m8 · `UserBubbleText.measure.test.ts` 있음, 등록 변이 미재측정 |
| VP-31 MD-15↔UT-13 | UT | PAIR_FAIL | f10 없음 · 등록 변이 미재측정 |
| VP-32b MD-16↔UT-14 | UT | 미판정 | x1~x14 있음, 등록 변이 미재측정 |
| VP-34b MD-17↔UT-15 | UT | 미판정 | b1~b11 있음 · V11 잡음, 나머지 등록 변이(b3·b10·b11) 미재측정 |
| VP-35b MD-18↔UT-16 | UT | PAIR_FAIL | j1~j7 이 한 케이스로 접힘 — 분기별 판정 불가 |
| VP-39 MD-19↔UT-18 | UT | PAIR_FAIL | g1~g16 대비 5케이스(기호 없음). V07~V10 잡음 |
| VP-03 AR-01↔IT-01a | IT | PAIR_FAIL | 테스트명 좌표 6개 중 0 · `send.sinks.test.ts` 없음 |
| VP-08 AR-02↔IT-01 | IT | PAIR_FAIL | `TranscriptViewport.reopen.test.ts` 없음 |
| VP-12 AR-03↔IT-02 | IT | PAIR_FAIL | `chatReducer.messageIndex.test.ts`·`chatStore.cancelled.test.ts` 없음 |
| VP-17 AR-04↔IT-03 | IT | PAIR_FAIL | `TranscriptViewport.lateResult.test.ts` 없음 |
| VP-19 AR-05↔IT-04 | IT | PAIR_FAIL | `TranscriptViewport.live.test.ts` 없음 |
| VP-21 AR-06↔IT-05 | IT | PAIR_FAIL | `transcript.viewport.test.ts` 없음 · v1~v3 는 `components/transcript/virtualizerOptions.test.ts` 1케이스 |
| VP-24 AR-07↔IT-06 | IT | PAIR_FAIL | `Timeline.viewport.test.ts` 없음 |
| VP-28c AR-08↔IT-08 | IT | PAIR_FAIL | e1~e8 대비 3케이스(기호 없음) |
| VP-29b AR-09↔IT-09 | IT | PAIR_FAIL | `TranscriptViewport.selection.test.ts` 없음 · X02 못 잡음(D3) |
| VP-33 AR-10↔IT-10 | IT | PAIR_FAIL | `panelConsumers.test.ts` 없음 |
| VP-02 SD-01↔ST-01 | ST | PAIR_FAIL | `message-identity.integration.test.ts`·공유 고정 입력 없음 |
| VP-22 SD-02↔ST-02 | ST | PAIR_FAIL | `TranscriptViewport.transition.test.ts` 없음 |
| VP-27 SD-03↔ST-03 | ST | PAIR_FAIL | `TranscriptViewport.prepend.test.ts` 없음 |
| VP-01·09·13·20·25 | AT | BLOCKED_BY | 각각 하위 VP-02~08 · 10~12 · 14~19 · 21~24 · 26~27 |
| VP-28a·29a·30a·31a·32a·34a·35a | AT | BLOCKED_BY | 같은 행의 b/c pair |
| VP-36 | REGRESSION | PASS | 좌표 5개 실재 · 전체 vitest green(기준선 실패는 무관 파일) |
| VP-37 | REGRESSION | PAIR_FAIL | 이관 좌표 VP-24·VP-16 이 없음(위) — `Timeline.memo.test.ts:'projects the committed head once…'` 좌표 없음 |
| VP-38 | REGRESSION | PASS | 좌표 실재 · writer·session-load·response-boundary DB 스위트 green(이번 환경 `npm rebuild better-sqlite3` 성공) |

- root `PAIR_FAIL`: D2(좌표 부재)가 위 UT·IT·ST 행의 공통 root · D1(VP-26) · D3(VP-29b).
- 이번 라운드 실행 범위: 최초 검증. 좌표가 있는 pair 는 실행 집합(전체 vitest)에 들었고, 등록 변이는 11건만 재측정.

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1·AC5·AC6·AC8·AC12·AC14·AC15·AC16·AC21·AC22·AC23·AC30 | ❌ | 검증 수단 파일이 없다(위 표) |
| AC2·AC3·AC4·AC7·AC9·AC10·AC11·AC13·AC17·AC19·AC24·AC26·AC35 | ❌ | 열거 분기 기호 대비 케이스 일부만(위 표) |
| AC20 | ❌ | 분기 일부 + production 캡처 미배선(D1) |
| AC25·AC27·AC28·AC29·AC31·AC32 | ⚠️ | 좌표 파일 있음 · 분기 일부 접힘 또는 등록 변이 미재측정 |
| AC18 | ✅ | VP-36 좌표 green |
| AC34 | ⚠️ | 전체 vitest 는 기준선 외 실패 0 이나 VP-37 이관 좌표 부재 |
| AC33 | ⚠️ | 사람 실기 — 기계 PASS 전 |

- **합계 재측정**: `✅ 1 · ⚠️ 8 · ❌ 26 = 총 35`.
- **합계 사본 대조**: 커밋 trailer `Criteria-Met: 34/35` · INDEX 비고 "AC 35(기계 34/35 구현 완료)" · plan 구현 보고 "✅ 34" — 셋은 서로 같고 재측정과 갈린다(D2).

### pair별 plan §10 강제 지점 분모

- 이번 라운드는 §10 자리별 좌표 대조까지 가지 못했다 — 좌표 파일 부재가 먼저 판정을 정했다. 구현자 강제 지점 표(r1.3)는 EP 묶음 단위 "전수 닫힘" 한 줄씩이고 자리별 좌표·`남긴 곳`이 없다 — 또 pair 라벨이 plan 과 다르다(`VP-25~VP-26 패널 증분 색인` → plan 의 VP-25·26 은 앞삽입 앵커, 패널은 VP-32·33 · `VP-27~VP-28 펼침` → VP-27 은 앞삽입 ST) — D4.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| 가드 5종 | PASS | migrations 36+2 sync ok · doc-inventory ok(125 channels) · product-naming 2,507파일 OK · test-budgets 18 suites ok · ui-thread OK |
| `npm run typecheck` | PASS | node/web/test 3종 exit 0 |
| `npm run lint` | PASS | 0 error · 5 warning · 트리 변화 없음(`git status` 빈 출력) |
| 파일 필터 없는 vitest | 기준선 한계 | 1,061파일 / 9,996케이스 — 22 failed(9파일). 9파일 모두 이번 diff 미변경 · `5b489f8` worktree 에서 같은 9파일 실행 시 같은 22건(`diff` 동일) · 서명 `"/home/user/orca-skin/app/C:/…"`·`Composer directory must be absolute`(Windows 경로 픽스처 — 다른 OS 전용 경로) |
| `node --test scripts/*.test.mjs` | PASS | 1,026/1,026 |
| 빌드 + 두 스모크 | PASS | `electron-vite build` exit 0 · `smoke-hosts` OK · `smoke-preload` OK |
| `__ooDev` 제외 | PASS | 비진단 빌드 `rg -c "__ooDev" out/renderer` 0파일 · 진단 빌드는 확인 안 함 |
| DB 스위트 | PASS(이 환경) | `npm rebuild better-sqlite3` 성공 → io 풀 DB 스위트가 전체 vitest 안에서 실행됨. 구현 보고의 "Windows CI 위임"은 이 환경에선 필요 없었다 |
| trailer 파싱 | PASS | 4커밋 모두 `%(trailers:only=true)` 가 7키 반환 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- J1~J10 수치·J9 상한 2000 은 재측정하지 않았다 — 구현자 값은 증거로 쓰지 않는다.
- plan 좌표 실재 수: 파일 82 중 없음 22 · 테스트명 29 중 없음 21(§4).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC33 S1~S9 | 없음 — 기계 PASS 전 | §19 그대로, 기계 verify PASS 뒤 |
| AC20·AC23 앵커 | fake DOM 하네스(`renderHarness.testfixture.ts`)로 기계 검증 가능 — plan 이 그렇게 지정 | 없음 |

## 9. 게이트 재실행

- 실제 실행 명령: §5 운영 gate 표 그대로(`app/` 기준).
- `npm test` 미사용 — `npm rebuild better-sqlite3`(Node ABI) 뒤 `./node_modules/.bin/vitest run`.
- 실행 집합: `ci.yml` 로컬 대응 전부(가드 5 · lint · typecheck · 필터 없는 vitest · node --test · 빌드 · 두 스모크).
- 게이트가 작업 트리를 바꿨는가: 아니오.
- 잔여물: `app/node_modules`(설치) · `app/out/`(빌드 산출, gitignore) · 스크래치 worktree `5b489f8`(정리함).

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 실행 — 위 |
| AC ↔ 코드/좌표 | 에이전트 대조 — ❌ 26 |
| 제품 의도 / Open Question | 해당 없음 |
| UI 시각 품질 | AC33 사람 — 대기 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태 `IMPL_DONE` · 다음 주체 `Claude` 는 실제와 맞다. 대상 커밋 `(r1.3 구현 — 이 커밋)` 자리표시자 → `d404976` · `c07a19f` 로 기입(`git cat-file -t` commit). `5b489f8`·`dccff2d`·`38f64c8`·`d404976`·`c07a19f` 는 `origin/main` 조상 아님(`git merge-base --is-ancestor` 1) — PR 브랜치 해시.
- trailer 허용값·파싱: 정상. 단 `Criteria-Met: 34/35` 는 값이 사실과 다르다(D2).
- `[구현자 기입]` r1.3 7필드: 7개 존재. 강제 지점 표가 자리별이 아니고(D4) 잠금 표에 ⑦ sweep 행이 없다 — "§10 정적 sweep 6종" 은 변이 sweep 이 아니다(D4).
- plan 메타 `상태` stale(D6).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 |
|---|---|
| "main DB io 스위트는 Linux VM 제약으로 Windows CI 위임" | 이 환경에서 `npm rebuild better-sqlite3` 로 실행됐다. 다만 위임 대상이라던 `message-identity.integration.test.ts` 는 파일 자체가 없다 |
| "VP-02~VP-39 SELF_PASS · 34/35" | 증거 아님 — §5 |
| M1~M3 `mutate.py` red | plan 등록 변이가 아니라 구현자 자체 변이다. 등록 변이 하한 ①은 구현자 단계에서 돌지 않았다 |

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | 위쪽 변위 앵커가 production 에서 캡처되지 않는다 — `TranscriptViewport.tsx:478-486` 정의 뒤 `void`, 호출 0 · 복원 effect 는 늘 조기 반환 · TanStack 자동 보정은 `:268` 에서 끔. X01 못 잡음 | 현재(코드 경로 재현: 호출자 0 · X01 2,651 green) + 이행(AC20 "앞삽입 · 가시 영역 위 블록 크기 변화 · 머리 자리 높이 변화 전에 … 기록하고") | VP-26 · VP-27 · AC20·AC22·AC23 · EP-12 | BLOCKING | 구현 — 캡처 시점 배선 + a1~a12 · ST-03 |
| D2 | plan 이 지정한 직접 oracle 좌표 대부분이 없다 — 테스트 파일 18개 · 테스트명 21개 · 분기 기호 다수(§4). 자기보고 34/35 와 재측정 ✅1 · ⚠️8 · ❌26 이 갈린다 | 이행(§7-A pair 마다 "직접 evidence oracle (자리별 좌표)" · §7 "검증 수단") | VP-02~08 · 10~12 · 14~19 · 21~24 · 26~29 · 31 · 33 · 35 · 37 · 39 | BLOCKING | 구현 — plan 의 파일명·테스트명·분기 기호대로 작성, 등록 변이 하한 ① 전부와 ⑦ sweep 을 IMPL_DONE 전에 실행 |
| D3 | 선택 마운트 집합에서 초점 `± overscan` 을 지워도 green(X02) | 이행(AC26 "가시 창 ± overscan ∪ 초점 끝 ± overscan ∪ 선택 양 끝 블록 ∪ 앵커") | VP-29 | BLOCKING | 구현 — c-case 좌표로 잠금 |
| D4 | `[구현자 기입]` 강제 지점 표가 EP 묶음 단위이고 자리별 좌표·`남긴 곳`이 없다 · pair 라벨이 plan 과 다르다 · 잠금 표에 ⑦ sweep 행 없음 | 이행(handoff-impl 7필드 계약 — 강제 지점 표는 §10 자리 전부) | 현재 산출물(message-bus) | BLOCKING | 구현 — 재구현 턴에 자리별로 다시 작성 |
| D5 | 이번 verify 의 ⑦ sweep · §10 자리 재검색 · J 수치 재측정 미실행 | — (검증자 범위 기록) | — | 기록 | 2회째 verify 에서 전수 |
| D6 | plan 메타 `상태` 가 `IN_PROGRESS (V1 rev 7 · r1.2)` 로 남음 | 비귀속(문서 상태 사본) | — | NON_BLOCKING | 구현자가 다음 턴에 갱신 |

## 14. Review Signals — 사실만

- 이전 라운드: 없음(1회째).
- 관련 plan 지침: 좌표는 §7-A 에 파일·테스트명·분기 기호까지 적혀 있었다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: Windows 경로 픽스처 9파일 22건(기준선 동일).
- 독립 축(⑥) 발견 2 — 현재+이행 1(D1) · 이행 1(D3).
- 구현 보고의 `Criteria-Met`·SELF_PASS 가 plan 좌표 부재와 함께 났다.

## 15. 결론

- 상태: **FAIL**
- verify 횟수: 1회째 — 확장 창 안. handoff-review 트리거 아님.
- pair 결과: REGRESSION PASS 2(VP-36·38) · root PAIR_FAIL — UT 15 · IT 11 · ST 3 · REGRESSION 1 · 미판정 3 · BLOCKED_BY AT 12.
- PLAN_GAP: 없음.
- AC: ✅ 1 · ⚠️ 8 · ❌ 26 / 35.
- 운영 gate: 통과(vitest 22건은 기준선 동일 환경 실패).
- 남은 사람 확인: AC33 — 기계 PASS 뒤.
- 다음 단계: Codex 재구현 r2 — D1~D4 를 닫고, plan 좌표대로 테스트를 만든 뒤 등록 변이 하한 ①과 ⑦ sweep 을 실행해 `[구현자 기입]` 에 자리별로 적는다.
