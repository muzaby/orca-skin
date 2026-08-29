# Verify — <slug>

> `docs/handoff/<NNNN-slug>/verify.md`로 복사해 작성한다.
> 검증 절차는 [`SKILL.md`](SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../../../docs/handoff/AGENTS.md).
> **문장은 [`§산출물 문장 규칙`](../../../docs/handoff/AGENTS.md)을 따른다** — 판정 먼저, 주장 한 줄에 관측 하나,
> 표 한 칸 3줄. 이전 라운드 판정은 보존하되 재서술하지 않는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `<NNNN-slug>` |
| 검증자 | Claude Code |
| 일자 | YYYY-MM-DD |
| 대상 커밋/range | `<base>..<head>` |
| 구현 전 plan 기준 | `<commit>` |
| V mode / 유효 V | `Baseline V: V1` / `<기준 V> + ΔV1…ΔV<N>` |
| 검증 기준 plan revision | `<plan commit>:V1` / `<plan commit>:ΔV<N>` |
| 라운드 | N |
| 상태 | PASS / FAIL / RETURN_TO_PLAN |
| 자기 검증 여부 | 설계·구현·검증 동일 에이전트인가 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: …
- **기준선이 diff로 성립하는가**: 예(`<plan 커밋>`) / **아니오 — 설계와 산출이 한 커밋** → 아래 항목은 "확인 불가"로 적고 채점 기준 원문을 인용해 고정
- Decision Ledger 변경: 없음 / 사용자 승인된 SUPERSEDE / **무단 변경 의심**
- Product/UX Contract 변경: …
- AC 변경: …
- V node/pair·requiredness·§10·oracle 변경: …
- 채점에 사용할 원 기준: …

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 / PLAN_GAP | … |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 / PLAN_GAP | … |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 / PLAN_GAP | … |
| pair별 path·§10 전수·직접 oracle | 유효 / PLAN_GAP | … |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 / PLAN_GAP | … |
| 현재 변경 산출물의 운영 gate·범위 | 유효 / PLAN_GAP | … |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음 / `AC·§10·path → VP-L…`; 형식만을 이유로 migration하지 않음
- root PLAN_GAP과 영향 pair: 없음 / …

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

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 정상 / 미배선 | VP-… / Decision·AC·§10 / 비귀속 — … |
| 테스트 전용 참조 | 정상 / 죽은 코드 | … |
| 형제 정책 비대칭 | 의도 / 결함 | … |
| 신규 등록값의 기존 소비처 영향 | 무영향 / 회귀 | … |
| producer ↔ consumer 파생 불일치 | … | … |
| 동일 규칙 중복 구현 | SSOT 유지 / drift | … |

> 대표 evidence: `references/0157-case.md` — 형제 정책 비대칭, test-only symbol, false success, “electron이라 테스트 불가” 오판.

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: …
- 핵심 입력/분기가 실제 실행됨: …
- structural proxy만으로 semantic 목표를 통과시킨 AC: 없음 / …
- **선택된 적대 증거 재측정** — pair가 등록한 변이 / 닫는 이슈의 인용 변이 / 새 구조·전수·배선 oracle 민감도: N건 중 검출 M · 미검출 K · 일반 hunk 자동 확장 0
- **이전 라운드 대조** — 지난 라운드에 red였던 변이 중 이번에 green: 0건 / N건 → 덮개 회귀 finding

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-… — 무엇을 어떻게 바꿨는가 | 스위트/게이트 | red / green / 미실행 | red / green | `VP-… 등록 변이` · `D<N> 인용 변이` · 덮개 회귀 |
- 동작 보존 추출 라운드인가: 아니오 / 예 — hunk 되돌림의 초록은 판정 근거가 아니다
- 소거 변이의 잔여물 수렴: 해당 없음 / N단계까지 밀어 진단 0 → 그 상태의 게이트 …
- 형제 슬롯 맞바꿈 변이: 해당 없음 — 형제 슬롯 없음 / N슬롯 맞바꿔 검출 M …
- `N회` 기준의 실제 관측 주체: …
- 순서 기준의 관측 훅/로그: …

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-04 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS / PAIR_FAIL / BLOCKED_BY:VP-… / NOT_REQUIRED | 테스트 / 선택된 변이 | start → … → end / N/N |
| VP-03 | AR-01 ↔ IT-01 / IT | … | … | … | … |
| VP-02 | SD-01 ↔ ST-01 / ST | … | … | … | … |
| VP-01 | R-01 ↔ AT-01 / AT | … | … | … | … |

- root `PAIR_FAIL`: 없음 / VP-… — …
- 종속 `BLOCKED_BY`: 없음 / VP-… → VP-…
- 하나의 증거가 함께 닫은 pair와 직접 판정 범위: 해당 없음 / …
- 이번 라운드 실행 범위: 최초 검증 — 유효 V의 REQUIRED/REGRESSION 전건 / 재검증 — root·종속·변경 영향 pair + 현재 변경 운영 gate; 이전 PASS 참조 …

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | … | ✅ / ⚠️ / ❌ | 테스트/명령/실기 | … |

- **합계 재측정**: `✅ N · ⚠️ M · ❌ K = 총 T`(분모를 직접 세어 적는다) · 자기보고 값 … · 일치/불일치
- **합계 사본 대조**: 본문 T ↔ 커밋 trailer `Criteria-Met` ↔ INDEX 비고 — 일치 / 갈림(…)

> 코드 존재는 “구현됨”이지 “검증됨”이 아니다. `Criteria-Met` 자기보고를 증거로 쓰지 않는다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | … (N/4) | PASS / PAIR_FAIL / PLAN_GAP |

- 표에 없는데 같은 불변식이 필요한 지점: 없음 / … → 현재 pair·Decision·AC 필수면 PLAN_GAP, 아니면 NON_BLOCKING/NEXT_HANDOFF
- `실패 의미`가 “다른 게이트가 막는다”고 적은 행의 재측정: 해당 없음 / …

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| subtree / repository / message-bus | … | PASS / FAIL / 환경·기준선 한계 | … |

> gate는 이번 변경 산출물의 완료 조건이다. 관련 없는 기존 실패를 새 제품 blocking 범위로 올리지 않는다.

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

> **generic `npm test`를 기본 명령으로 쓰지 않는다.** 변경한 subtree의 가장 구체적인 `AGENTS.md`가 gate 명령의 정본이다.
> `app/**`가 대상이면 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`를 먼저 읽는다.

```text
# app 기본 ABI-중립 gate
$ cd app && npm run lint && npm run typecheck

# 관련 비-DB/순수 테스트 — pretest 우회
$ ./node_modules/.bin/vitest run <relevant-suite>

# npm test — DB 동작 자체를 검증해야 할 때만 의도적으로 실행
```

- 실제 실행 명령: …
- **관측한 실행 산출**(exit code 아님): 테스트 N파일 / M케이스 · 정적 검사 error·warning 수 — …
- `npm test`를 썼다면 DB 검증 필요성: …
- ABI 전환/egress 403 등 환경 기인 실패와 변경 관련 실패 분리 근거: …
- **게이트가 작업 트리를 바꿨는가**(autofix·formatter·codegen): 없음 / … → 검증 대상 포함 여부 판정
- **검증 중 실행한 명령이 남긴 잔여물**: 없음 / … → 정리 또는 파생 이슈

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/관련 자동 테스트 | 실행·출력 증거 | — | … |
| AC ↔ 코드/production path | 1:1 대조 | 이견 시 결정 보조 | … |
| 레이어/계약/문서 형식·링크 | 기계·정적 검증 | — | … |
| AGENTS 위생/부모-자식 모순 | 스캔·대조 | 민감 맥락 최종 판단 | … |
| 제품 의도 / Open Question | 보조 의견 | **결정** | … |
| UI/UX 시각 품질 | 로직은 기계 검증 | **시각 확인** | … |
| 신규 의존성 / PR merge | 제안·상태 확인 | **승인** | … |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성 (AGENTS 변경 시)

- 키/토큰/PW/이메일/IP 등 민감 패턴 스캔: …
- 일회성·자주 변하는 운영정보·장문 구현 설명 혼입: 없음 / …
- 부모 `AGENTS.md` ↔ 하위 `AGENTS.md` 명령 충돌: 없음 / …
- 새 `AGENTS.md`라면 `CLAUDE.md` stub 및 root 디렉토리 표 갱신: 해당 없음 / …

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: …
- 「다음 주체」 칸이 주체 하나만 담는가: …
- 대상 커밋 좌표 기입(검증자 몫, `git cat-file -t`로 확인): …
- 비고 5줄 이내(상세는 원본 문서 링크): …
- PASS 시 archive 이동: 해당 없음 / 완료 …

### Commit / reference 정합성

- trailer가 root `AGENTS.md` / `docs/git-template.md` 허용값을 따름: …
- trailer가 실제로 파싱됨(`git log -1 --format='%(trailers:only=true)' <커밋>`이 적힌 키를 그대로 반환): …
- 인용된 커밋 해시 실재(`git cat-file -t <hash>`): …
- 재구현 라운드 `[구현자 기입]` 7필드 전수 존재(산문으로 접힌 필드 0): …
- 이동/삭제한 reference·script의 살아 있는 소비처 또는 archive 근거: …

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| … | 타당 / 무단 제품·AC 변경 / 구현 세부 보완 | … |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D… | … | VP-… / Decision·AC·§10·현재 산출물 gate / 비귀속 | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | … | 구현 / planner / 기록 / 새 handoff 후보 |

> plan의 `[검증자 기입] 파생 이슈`로 이관한다.
> `PLAN_GAP`이 하나라도 있으면 결과는 `RETURN_TO_PLAN`이고 다음 주체는 설계자다. 명시 계약 위반은 `PAIR_FAIL`로 유지하며 gap으로 낮추지 않는다.

## 14. Review Signals — 사실만

> 원인 분류와 SKILL 변경은 `handoff-review`가 한다.

- 이전 라운드와 동일/유사 증상: 없음 / …
- 관련 plan 지침/AC의 존재 여부: …
- 사용자 결정 변경 근거: 없음 / …
- 반복된 검증 환경 한계: 없음 / …

## 15. 결론

- 상태: PASS / FAIL / RETURN_TO_PLAN
- pair 결과: REQUIRED/REGRESSION PASS N · root PAIR_FAIL M · BLOCKED_BY K
- PLAN_GAP: 없음 / root gap … → 영향 pair …
- Product/UX 및 ACTIVE Decision 충족: …
- AC 충족: …
- 현재 변경 운영 gate: …
- NON_BLOCKING / NEXT_HANDOFF: 없음 / …
- repository operation checks: …
- 남은 사람 확인: …
- 다음 단계: …
