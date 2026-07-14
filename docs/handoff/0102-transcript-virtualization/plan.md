# Plan — 0102-transcript-virtualization

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: 의도 → 조사 → 설계 → 리스크.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0102-transcript-virtualization` |
| 작성자 | Claude Code |
| 일자 | 2026-07-14 |
| 매핑 | PHASES 행 (승격 시) / PR (있으면) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "가상화 … 우선 진행" (cdesktop 벤치마킹 후속) | 라이브 세션 요청 |
| 명시 결정 | 가상화 라이브러리 = `@tanstack/react-virtual` (신규 의존성 승인) | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | 목표는 긴 세션에서 화면 밖 exchange 언마운트로 shiki/DOM 상주 비용 제거. 단 0008 스트리밍 앵커는 보존 (추론 — 0008 결정이 명시 채택이므로) | `@docs/arch/frontend/rendering.md §1.8`, handoff 0008 |

## Context (왜)

`TranscriptView`가 모든 exchange를 `map`으로 전부 마운트한다 — 화면 밖 exchange의 코드블록 shiki 하이라이트·DOM이 상주해 긴 세션 비용이 선형 증가한다. 마커 `data-behavior="virtualizable"`만 있고 실제 가상화는 없다. cdesktop은 `@tanstack/react-virtual`로 화면 밖 행을 언마운트해 비용을 시야로 제한한다. Orca도 동일 이득을 취하되, **스트리밍 무점프 앵커(0008)** 를 깨지 않아야 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `TranscriptView`가 `groupExchanges(messages)`를 `exchanges.map`으로 전부 렌더. 스크롤 컨테이너에 `data-behavior="virtualizable"` 마커만 존재 | `app/src/renderer/src/features/chat/components/transcript/TranscriptView.tsx:57-91` |
| 행 모델: `groupExchanges`(user 턴 + 뒤따르는 assistant 턴) + `exchangeEquals`(memo 비교자) 순수 헬퍼 이미 존재. exchange 경계는 "영원히 안정적"(기존 DOM 재부모화 없음) | `app/src/renderer/src/features/chat/lib/turns.ts:45-71` |
| 스트리밍 앵커: `useScrollAnchor` + 마지막 `Exchange`의 `min-h-[50cqh]` 예약공간. **델타 프레임에 레이아웃 JS 미실행**, `scrollHeight` 불변으로 무점프. ResizeObserver는 pinned+inflight일 때만 바닥추적 | `app/src/renderer/src/features/chat/hooks/useScrollAnchor.ts:1-148`, `.../transcript/Exchange.tsx:41-45` |
| 스크롤 컨테이너 = size container(`[container-type:size]` + `[overflow-anchor:none]`), 예약공간이 이 컨테이너 content-box 50% 기준 | `TranscriptView.tsx:57`, `@docs/arch/frontend/rendering.md §1.8` |
| 참조 구현: cdesktop은 **virtualized head + unvirtualized tail** — `useConversationVirtualizer`가 `totalRowCount`(가상+비가상 tail)로 바닥보정, 스트리밍 tail 행은 가상화 밖 | cdesktop `packages/web-core/src/features/workspace-chat/model/useConversationVirtualizer.ts:48-59,180-196` |
| TanStack Virtual은 `totalSize` 스페이서 + transform 배치 → Orca의 `min-h-[50cqh]`/`scrollHeight` 불변 모델과 충돌 | TanStack Virtual 문서(가변 높이 `measureElement`) |
| 재렌더 격리(0007/0008): `TranscriptView` memo + `Exchange` memo(`exchangeEquals`), 델타는 `PendingAssistant` 리프가 store 직접 구독 | `TranscriptView.tsx:34-49`, `Exchange.tsx:30-75`, handoff 0007/0008 |

## 인수 기준 (Acceptance Criteria)

1. 확정(과거) exchange가 화면 밖에서 **언마운트**된다 — 긴 세션에서 마운트된 exchange DOM 수 ≪ 전체 exchange 수.
2. 마지막(스트리밍) 교환의 전송 앵커(smooth 1회)·`min-h-[50cqh]` 예약공간·초과 바닥추적이 **0008과 동일하게** 동작(무점프).
3. 위로 스크롤 시 과거 exchange가 올바른 위치·높이로 복원된다(측정 정확, 겹침/빈칸 없음).
4. "맨 아래로" 버튼(`showJump`)·pin(auto-follow) 동작에 회귀가 없다.
5. 긴 세션(40+ 턴 mock)에서 렌더 비용 감소를 실측(가상화 전/후 마운트 DOM 노드 수, 또는 0007식 CDP rAF 블로킹 비교).
6. 레이어 경계 위반 0. `cd app && npm run lint && npm run typecheck && npm test` 통과.

## 범위 / 비범위

- **범위**: `features/chat` 내 transcript 가상화(head/tail 분할) + 가상화 훅 신설 + `@tanstack/react-virtual` 도입 + 관련 문서(TRD §2·app/AGENTS.md) 갱신.
- **비범위**: 연속 항목 집계 접기(aggregated group)·"이전 유저 메시지로 점프" 스크롤 명령(후속 핸드오프 후보), diff 뷰어 강화, 메시지 편집/팀(제품 방향), `useScrollAnchor` 스크롤 모델 재설계(무변경 목표).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성**: `@tanstack/react-virtual` (dependency) — **사용자 승인 완료**(라이브 세션). TRD §2·app/AGENTS.md 채택 목록 갱신 필요.
- 재사용: `groupExchanges`·`exchangeEquals`(`turns.ts`), `Exchange`(memo), `useScrollAnchor`(무변경), `scrollRef`/`contentRef`.
- 전제: exchange 경계 안정성(turns.ts §45 주석) — 가상 아이템 key(`exchange.startIndex`) identity가 append 사이 불변.

## 설계

**핵심: "과거 가상화 + 스트리밍 tail 비가상화"** (cdesktop 동형, 0008 보존).

- `TranscriptView`에서 `exchanges = groupExchanges(messages)`를 **head**(= `exchanges.slice(0, -1)`)와 **tail**(= 마지막 exchange)로 분할.
  - **head**: `@tanstack/react-virtual`로 가상화. 스크롤 컨테이너(`scrollRef`) 안에 `position:relative; height=totalSize` 스페이서 + `virtualItems.map`(각 `Exchange`를 `transform:translateY(start)` + `data-index` + `measureElement` ref). key=`exchange.startIndex`.
  - **tail**: 스페이서 **뒤에 일반 렌더**(현행과 동일 `Exchange`) — `reserve`(min-h-[50cqh])·`pending`·`forkable`·`error`·`pendingSteer`를 tail에만 적용. `useScrollAnchor`/ResizeObserver/예약공간이 tail에서 그대로 동작.
- **신규** `features/chat/hooks/useTranscriptVirtualizer.ts` — `useVirtualizer` 얇은 래핑:
  - `count = head.length`, `getScrollElement: () => scrollRef.current`, `getItemKey: (i) => head[i].startIndex`, `overscan: 6~8`.
  - `estimateSize`: exchange 대략 높이(초기 추정 후 `measureElement`가 실측 교체). 타입별 정밀 추정 불필요(측정으로 수렴) — 상수/간단 추정으로 시작.
  - `measureElement = defaultMeasureElement`(ResizeObserver 실측).
- **레이어**: 전부 `features/chat` 내부(hooks/·components/transcript/) — 4-layer 경계 무영향. `pages/`/`app/` 변경 없음.
- **재사용 최소 신설**: 별도 row-model 신설하지 않음(cdesktop과 달리 `groupExchanges`가 이미 행 모델). 팀/멀티프로세스/bottom-lock 복잡도는 도입하지 않음(tail 비가상화가 스트리밍을 이미 처리).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **빈/1교환 세션**: head 비어 tail만 — 현행과 동일 렌더(가상화 무동작).
- **세션 전환**: messages 교체 → `getItemKey`(startIndex) 자연 리셋, `useScrollAnchor`의 세션 전환 분기가 끝으로 스크롤.
- **shiki 비동기 높이 변동(과거 head 행)**: `measureElement` 재측정으로 흡수. idle 성장은 `useScrollAnchor`가 inflight 게이트로 이미 무시(head는 tail 밖이라 앵커 영향 없음).
- **위로 스크롤 후 새 전송**: tail 갱신·예약공간은 tail 로컬. head 스페이서 높이는 유지 → 점프 없음.
- **접근성/키보드**: 가상화로 화면 밖 노드 언마운트 — Ctrl+F 브라우저 검색은 화면 밖 미검색(트레이드오프, 아래 리스크).
- **테마**: 렌더 구조만 변경, 시각 토큰 무관.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **R2: 0008 앵커 회귀** (되돌리기 신중) | tail 비가상화가 1차 방어(스트리밍은 가상화 밖). 인수 기준 2로 전송앵커·fill 무점프·초과추적 3케이스 시각 검증 |
| R1: 가변 높이 측정 중 스크롤 점프 | `measureElement`(ResizeObserver) + overscan. 초기 estimate 오차는 측정으로 수렴 |
| R3: head shiki 비동기 높이 변동 | `measureElement` 재측정 흡수 |
| R4: `container-type:size` + 가상 스페이서 상호작용 | 예약공간은 tail에만 적용(head 스페이서와 분리). 필요 시 tail을 스페이서 형제로 배치해 컨테이너 기준 유지 — 구현 시 확인 |
| 화면 밖 노드 브라우저 검색(Ctrl+F) 불가 | 트레이드오프 수용(가상화 일반 특성). 인앱 검색은 별도 기능(범위 밖) |

- 되돌리기 어려운 결정: 스크롤 구조 변경 — tail 비가상화로 0008 계약 보존이 전제. 계약 위반 징후 시 롤백.
- 단독 결정 금지 항목: 신규 의존성 = 승인 완료. 그 외 없음.

## 영향 받는 파일

- **신규** `app/src/renderer/src/features/chat/hooks/useTranscriptVirtualizer.ts`
- **수정** `app/src/renderer/src/features/chat/components/transcript/TranscriptView.tsx` (head/tail 분할 렌더)
- **수정** `app/package.json` (`@tanstack/react-virtual`)
- **문서** `docs/TRD.md` §2 스택표 · `app/AGENTS.md` "이미 채택" 목록 (도입 근거 기재)

## 참고 문서

- `docs/arch/frontend/rendering.md §1.8` (스트리밍 앵커 — 보존 대상)
- handoff `0007-transcript-render-memo` · `0008-chat-anchor-reserve` (재렌더 격리·예약공간 결정)
- cdesktop `useConversationVirtualizer.ts` (virtualized head + unvirtualized tail 참조)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `useTranscriptVirtualizer`의 head/tail 분할이 순수 계산이면 단위 테스트(빈/1교환/N교환 분할 경계). 가상화 자체·스크롤은 시각 검증(app/AGENTS.md 원칙 4).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구/결정을 라이브 세션 출처로 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`·외부 참조 부착.
- [x] 인수 기준 — 번호·검증 가능·조사 근거(특히 0008 보존 = 기준 2).
- [x] 의존 기술 — 신규 의존성 승인 상태·문서 갱신 대상 명시.
- [x] 파생 UX — 빈세션/전환/shiki/스크롤/검색 트레이드오프 펼침.
- [x] 리스크 — 0008 회귀를 최우선 리스크로, tail 비가상화 완화책·롤백 조건 명시.

---

## [구현자 기입] 구현 보고 (Claude, 비기능)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `hooks/useTranscriptVirtualizer.ts` · 수정 `components/transcript/TranscriptView.tsx` · `package.json`(+`@tanstack/react-virtual@^3.14.6`) · 문서 `docs/TRD.md §2`·`app/AGENTS.md` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npx vitest run src/renderer` |
| 게이트 결과 | lint ✅ exit 0(경고 1 = `react-hooks/incompatible-library`: TanStack Virtual↔React Compiler 알려진 상호작용, 컴파일 스킵일 뿐 오류 아님) · typecheck 3종 ✅ 0 · renderer 243/243 ✅ |
| 구현 요약 | `exchanges`를 head(`slice(0,-1)`)/tail(마지막)로 분할. head 만 `useVirtualizer`(count=head.length, key=startIndex, overscan 6, estimate 240px, measureElement)로 스페이서+absolute 배치. tail 은 비가상 렌더로 `reserve`/`pending`/`forkable`/`error`/`pendingSteer` 유지 → 0008 앵커 보존. head 항목 간 간격은 flex gap 대신 `pb-[var(--chat-turn-gap)]`(측정 높이 포함). |
| 블로커 / 역질문 | **런타임 검증 불가** — 이 환경은 electron 바이너리 egress 403(0019 verify 동일 제약)으로 `npm run dev`/`build` 실행 불가. 인수 1~5(언마운트·앵커·스크롤 복원·점프버튼·성능 실측)는 사람 실기 확인 필요. |
| 대상 커밋 | `621b5f2` |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 가상화 도입으로 스크롤/자동추종 프레임에 `TranscriptView`가 깨어남(0007/0008 가정 변화) | ✅ head/tail 의 `<Exchange>`가 memo(`exchangeEquals`)라 대부분 bail — 재계산은 virtualItems 창으로 한정. 상단 doc 주석 갱신 | `TranscriptView.tsx:27-34` |
| 2 | head 항목 absolute 배치로 flex gap 미적용 → 간격 소실 | ✅ 각 항목 `pb-[var(--chat-turn-gap)]`(측정 포함)로 균일 간격 | `TranscriptView.tsx:97-105` |
| 3 | 초기 로드/성장 시 바닥 정렬 드리프트 | ⚠️ 보고만 — TanStack 기본 `shouldAdjustScrollPositionOnItemSizeChange`(뷰포트 위 아이템 보정)에 의존. 실제 무점프는 사람 실기 확인(인수 2) | 설계 §리스크 R1/R4 |
