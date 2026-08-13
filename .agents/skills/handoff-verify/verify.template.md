# Verify — <slug>

> `docs/handoff/<NNNN-slug>/verify.md`로 복사해 작성한다.
> 검증 절차는 [`SKILL.md`](SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../../../docs/handoff/AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `<NNNN-slug>` |
| 검증자 | Claude Code |
| 일자 | YYYY-MM-DD |
| 대상 커밋/range | `<base>..<head>` |
| 구현 전 plan 기준 | `<commit>` |
| 라운드 | N |
| 상태 | PASS / FAIL |
| 자기 검증 여부 | 설계·구현·검증 동일 에이전트인가 |

## 0. 기준선 / plan 변경 확인

> 구현자가 plan/AC를 자기 코드에 맞게 바꾸지 않았는지 먼저 확인한다.

- 구현 커밋이 `plan.md`를 변경했는가: …
- Decision Ledger 변경: 없음 / 사용자 승인된 SUPERSEDE / **무단 변경 의심**
- Product/UX Contract 변경: …
- AC 변경: …
- 채점에 사용할 원 기준: …

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-… | … | entry → … → consumer |

### end-to-end 흐름

```text
사용자/시스템 시작점
  → main/feature
  → contract/state/store
  → consumer/UI/tool/external output
  → 성공/실패/취소 결과
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | … | … |
| false success 가능성 | … | … |
| partial failure/rollback | … | … |
| Product/UX의 A가 아닌 다른 B를 구현했는가 | … | … |
| 증상만 제거하고 상태 변화가 남았는가 | … | … |
| 최적화가 잃은 재검증/취소/만료 관측 | … | … |
| 출력/요청 worst-case 상한 | … | … |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh <base>..<head>
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export | 정상 / 미배선 | … |
| 테스트 전용 참조 | 정상 / 죽은 코드 | … |
| 형제 정책 비대칭 | 의도 / 결함 | … |
| 신규 등록값의 기존 소비처 영향 | 무영향 / 회귀 | … |
| producer ↔ consumer 파생 불일치 | … | … |
| 동일 규칙 중복 구현 | SSOT 유지 / drift | … |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: …
- 핵심 입력/분기가 실제 실행됨: …
- structural proxy만으로 semantic 목표를 통과시킨 AC: 없음 / …
- `N회` 기준의 실제 관측 주체: …
- 순서 기준의 관측 훅/로그: …

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | … | ✅ / ⚠️ / ❌ | 테스트/명령/실기 | … |

> 코드 존재는 “구현됨”이지 “검증됨”이 아니다. `Criteria-Met` 자기보고를 증거로 쓰지 않는다.

## 6. 외부 포트 / 문서 계약 (해당 시)

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| … | 문서 예제 typecheck | 성공/실패/null/retry contract test | … |

## 7. 숫자 / 음성 기준 / 상한 재측정

- N개 소비처/파일/테스트 재측정: …
- 내역 합 = 총계: …
- 0건 게이트의 정당한 예외 보존: …
- 총량 임계의 제거/허용 형태 분해: …
- 출력/요청 상한 실측/계산: …

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

> UI/SDK/electron이라는 이유만으로 넘기지 않는다. in-memory transport, pure seam, composition 재구성, port fake를 먼저 시도한다.

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| … | … | … | 무엇을 띄우고/누르고/관측하는가 |

## 9. 게이트 재실행

```text
$ cd app && npm run lint && npm run typecheck && npm test
…
```

- 환경 기인 실패와 변경 관련 실패 분리 근거: …

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| … | 타당 / 무단 제품·AC 변경 / 구현 세부 보완 | … |

## 11. [FAIL 시] 파생 이슈

- [ ] D… — …

> plan의 `[검증자 기입] 파생 이슈`로 이관한다.

## 12. Review Signals — 사실만

> 원인 분류와 SKILL 변경은 `handoff-review`가 한다.

- 이전 라운드와 동일/유사 증상: 없음 / …
- 관련 plan 지침/AC의 존재 여부: …
- 사용자 결정 변경 근거: 없음 / …
- 반복된 검증 환경 한계: 없음 / …

## 13. 결론

- 상태: PASS / FAIL
- Product/UX 및 ACTIVE Decision 충족: …
- AC 충족: …
- 기준 밖 결함: …
- 남은 사람 확인: …
- 다음 단계: …
