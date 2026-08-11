# ADR-005 — 대화(Session)와 실행 핸들(SessionRuntime)을 가른다

## 문제

"세션" 이라는 한 단어가 세 가지를 가리키고 있었다 —

1. 사용자가 보는 **대화**(사이드바의 한 줄, 메시지·메타데이터·계보),
2. 그 대화를 지금 **실행 중인 프로세스**(SDK `query()` 핸들 + subprocess + AbortController),
3. SDK 가 `resume` 에 쓰는 **외부 실행 컨텍스트**(jsonl).

셋을 한 단어로 부르면 "세션을 몇 개까지 열 수 있나" 같은 질문에 답할 수 없다 — 대화는 수백 개여도
되지만 프로세스는 그럴 수 없다. cap·LRU·idle-close 가 *무엇을 세는지* 가 불명확해진다.

## 검토한 선택지

| 안 | 내용 | 판단 |
|---|---|---|
| A. 한 개념으로 유지 | 대화 = 실행 = 1:1 | 기각 — 대화를 닫지 않고 프로세스만 회수할 수 없다. 자원 관리가 불가능 |
| B. 실행을 대화의 필드로 | `Session.runtime?` | 기각 — 영속 대상(대화)과 휘발 대상(핸들)이 한 레코드에 섞인다 |
| C. **별도 개념 + 1:N** | 대화는 영속, 실행 핸들은 휘발·유자원 | **채택** |

## 선택

**`Session`(대화, 영속) 과 `SessionRuntime`(실행 핸들, 휘발) 은 다른 것이다.** 한 Orca Session 에
대해 `open → idle-close → reopen` 으로 런타임이 여러 번 생길 수 있다 — **Session : Runtime = 1:N**.

**cap/LRU/idle-close 가 세는 유닛은 `SessionRuntime`** 이다. 이것은 자원·프로세스
라이프사이클의 단위이지 오케스트레이션의 단위가 아니다.

세 번째 개념(**SDK resume context**)도 별도 표제어로 둔다 — 자세한 근거는 [ADR-001](001-orca-db-session-ssot.md).

## 포기한 것

- **어휘의 단순함.** `GLOSSARY.md` 에 표제어가 셋이 됐고, 문서·코드에서 어느 것을 말하는지 매번
  분명히 해야 한다. 이 비용은 의도적이다 — 뭉치면 답할 수 없는 질문이 생긴다.
- **런타임 상태의 영속.** `SessionRuntime` 의 coarse 상태(`cold/idle/busy/interrupting/error/
  closed`)는 **비영속**이다. 앱을 재시작하면 실행 상태는 사라지고 대화만 남는다.

## 생긴 invariant

- **`SessionRuntime` 의 coarse 상태는 단일 SSOT 이고 영속되지 않는다.**
- **런타임을 회수해도 대화는 남는다.** idle-close 는 사용자에게 대화가 사라진 것으로 보이면 안 된다.
- **문서·코드에서 세 개념을 한 단어로 뭉치지 않는다** — `GLOSSARY.md` 의
  `Session (Orca Session)` · `SessionRuntime` · `SDK resume context` 는 별도 표제어다.
- 실행 배선(어댑터 호출·send/persist 훅)은 컴포지션 루트가 소유하고,
  `features/orchestration/` 은 **순수 로직만** 갖는다 ([ADR-002](002-feature-slice-boundaries.md)).

## 관련

용어 정의: [`GLOSSARY.md`](../GLOSSARY.md) ·
런타임 거버넌스: [`arch/backend/runtime-ipc.md`](../arch/backend/runtime-ipc.md) ·
설계 원본: [`etc/orca_lifecycle_orchestration_design_draft_ko.md`](../etc/orca_lifecycle_orchestration_design_draft_ko.md) §A
