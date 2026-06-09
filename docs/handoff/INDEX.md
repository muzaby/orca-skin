# 디스패치 보드 (Claude Code ↔ Codex)

> **두 에이전트 모두 착수 전 이 표를 가장 먼저 읽고, 작업 후 갱신한다.** "지금 누구 차례인가"의 단일 진실원.
> 상태 머신·절차 정본은 [`AGENTS.md`](AGENTS.md). 완료된 작업은 [`../PHASES.md`](../PHASES.md) 표로 승격된다.

## 단계 / 상태 범례

- **단계**: `plan` → `impl` → `verify`
- **상태**: `DRAFT` · `READY` · `IN_PROGRESS` · `IMPL_DONE` · `PASS` · `FAIL`
- **다음 주체**: `Claude` (설계/검증) · `Codex` (구현) · `—` (종료)

## 활성 / 이력

| slug | 단계 | 상태 | 다음 주체 | 대상 커밋 | 라운드 | 비고 |
|---|---|---|---|---|---|---|
| `0001-handoff-bootstrap` | verify | PASS | — | (이번 커밋) | 1 | 협업 인프라 자체 부트스트랩. Claude 단독 수행(설계+구현+검증). |
| `0002-cost-token-tracking` | verify | PASS | — | 86f1859 | 1 | 비용·토큰 추적. main(#54–57) 동기화 후 잔여 범위(모델별 영속 + 일/주/월 누적) + 스키마 제시안 통일(`usage_events`→`turn_usage`+`turn_model_usage`)로 재작성. **검증 PASS(14/14, 게이트 통과)** → PHASES 승격. |

> 새 작업: 마지막 일련번호 +1 로 행을 추가하고 `<NNNN-slug>/plan.md` 를 생성한다.
