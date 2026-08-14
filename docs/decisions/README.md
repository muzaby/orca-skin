# Architecture Decision Records (ADR)

**왜 이 구조인가**를 담는다. `arch/` 는 *지금 어떻게 동작하는가*만 서술하고, 그 구조가 나온
이유는 여기로 온다.

## 왜 분리하나

ADR 이 없으면 architecture 본문이 그 역할을 대신한다 — 실제로 이 저장소의 `arch/**` 는
`0180에서 제거` · `0181에서 재작성` · `77 → 76` 같은 델타 서술로 이유를 설명하고 있었고, 그 결과
**현재 상태를 읽으러 온 에이전트가 과거 이력을 함께 읽어야** 했다. 이력은 `git log` 와
`docs/archive/` 가 갖고, 이유는 여기가 갖고, 현재 상태는 `arch/` 가 갖는다.

## ADR 은 changelog 가 아니다

다섯 질문에만 답한다. 변경 이력을 누적하지 않는다.

```text
어떤 문제 때문에 결정했는가?
어떤 선택지를 검토했는가?
무엇을 선택했는가?
무엇을 포기했는가?
어떤 invariant 가 생겼는가?
```

## 목록

| ADR | 결정 | 관련 |
|---|---|---|
| [001](001-orca-db-session-ssot.md) | 대화의 진실은 Orca DB — SDK resume 은 컨텍스트일 뿐 | `arch/backend/persistence.md` |
| [002](002-feature-slice-boundaries.md) | main 은 feature 수직 슬라이스, 교차 import 금지 | `app/src/main/AGENTS.md` |
| [003](003-electron-network-stack.md) | main 의 원격 요청은 Chromium `net` 스택만 | `arch/backend/security.md` §1.8 |
| [004](004-provider-single-axis.md) | 인증은 `Provider` 단일 축 — 프로토콜이 아니라 관계로 가른다 | `arch/backend/auth.md` |
| [005](005-runtime-conversation-separation.md) | Session(기록)과 SessionRuntime(실행)을 가른다 | `GLOSSARY.md` |

## 새 ADR 을 쓸 때

- 번호는 `max+1`, 파일명은 `NNN-kebab-slug.md`.
- **뒤집는 결정이 생겨도 기존 ADR 을 고쳐 쓰지 않는다** — 새 ADR 을 쓰고 구 ADR 상단에
  `> superseded by ADR-00N` 을 단다. ADR 은 그때의 판단 기록이다.
- `arch/` 쪽에서는 `Decision rationale: ADR-00N` 한 줄로만 링크한다.
