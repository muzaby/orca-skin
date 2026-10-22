# Verify — 0266-renderer-design-guidelines

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0266-renderer-design-guidelines` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `ae44e58..5a99c1f` · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | `5cda65c`(설계) · `ae44e58`(게이트 경로 정정) |
| V mode / 유효 V | Baseline V / V1 |
| 라운드 | 1 (verify 1회째) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**PASS — 문서 전용 handoff의 4개 R↔AT pair가 HEAD에서 성립한다.** 카탈로그는 git 추적 renderer TSX(테스트 제외) 전부를 정확한 경로로 덮고, 4개 진입점이 디자인 시스템·카탈로그를 가리키며, 등록 음성 대조 10건이 모두 red다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `5a99c1f`가 plan의 AC3·AC4·VP-03·VP-04의 oracle 경로를 `work/check-design-docs.py` → `evidence/check-design-docs.py`로 바꿨다(`git diff ae44e58 5a99c1f -- …/plan.md`). 검사 의미·분모·음성 대조는 그대로이고 무시되는 scratch 경로를 재현 가능한 위치로 옮긴 것이라 완화가 아니다 — 다만 규범 행 정정이 구현 커밋에 섞였다(§13 N1).
- Decision·Product/UX·AC 의미 변경 없음. 채점 기준: `ae44e58`의 AC1–4·VP-01–04·§10 EP-01–04.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V | 유효 | 런타임 변경 없음 → R↔AT만, SD/AR/MD 비생성 이유 명시 |
| §10 자리 목록 | 유효 | EP-03 분모 = §8 명령(`rg --files … -g '*.tsx'` 테스트 제외)으로 고정, EP-04 = 4개 파일 |
| 선택 적대 증거 | 유효 | VP-03 행 제거·허위 행, VP-04 진입점 링크 제거 8자리 |
| 운영 gate | 유효 | 문서 inventory·링크·typecheck·lint |

## 1–3. Product/UX · 비판적 검토 · 역방향

| 항목 | 판정 | 근거 |
|---|---|---|
| D-002 모든 TSX 연결 | ✅ | HEAD에서 297/297(아래 재측정). 구현 당시 286 → 이후 0267–0281이 새 컴포넌트 행을 함께 추가 |
| D-003 근거 정확성 | ✅ | `design-system.md`가 인용한 CSS 변수 1개는 `tokens.css`에 존재, 유틸리티 클래스 16개는 모두 소스 또는 토큰에 존재. `Button.tsx:55-61` primary=반전 중립·danger=rust 서술과 일치 |
| D-004 진입점 | ✅ | `AGENTS.md`·`app/AGENTS.md`·`app/src/renderer/AGENTS.md`·`docs/INDEX.md` 각각 두 링크 |
| 반복 규칙 텍스트 | 관찰 | 297행 중 같은 규칙 문장 그룹 17개(최대 8 — `pages/` 조립 파일). 같은 역할 파일이라 결함 아님 |

## 4. 고장 내 보기 / 재측정

| ID | 대상 | 종류 | 바꾼 내용 | 결과 | 근거 |
|---|---|---|---|---|---|
| D1 | `design-components.md` 첫 TSX 행 | 제거 | 메모리 사본에서 삭제 | 잡음 | `check-design-docs.py` missing source |
| D2 | 같은 문서 | 다른 값 | 존재하지 않는 `shared/ui/Fake.tsx` 행 추가 | 잡음 | stale source |
| D3–D10 | 4개 진입점 × 2링크 | 제거 | 링크 대상명을 `missing-guide.md`로 | 잡음 8/8 | missing route |

- 구현자 = 검증자 아님. 등록 변이 10건을 그대로 재실행(`python3 -I …/check-design-docs.py` exit 0, 4줄 출력).
- **판정 기준 엄격화 재측정**: 검사기의 파일 시스템 `rglob` 대신 `git ls-files app/src/renderer/src`의 `.tsx`(테스트 제외)와 문서 전체의 `(../../../app/src/renderer/src/….tsx)` 링크를 별도 정규식으로 대조 → `git tsx 297 · linked 297 · missing [] · stale []`. 차집합 0.

## 5. V-pair closeout

| Pair | 결과 | 증거 |
|---|---|---|
| VP-04 R-04↔AT-04 | PASS | 진입점 8링크·renderer 제작 절차 5개 문구, D3–D10 red |
| VP-03 R-03↔AT-03 | PASS | 297/297 양방향 차집합 0(두 방식), D1·D2 red |
| VP-02 R-02↔AT-02 | PASS | 토큰·클래스 인용 실재, Button 역할 서술 일치, `check-doc-inventory --check` 통과 |
| VP-01 R-01↔AT-01 | PASS | `git merge-base --is-ancestor 5a99c1f origin/main` 성립(작업 당시 main 추적) |

- AC 합계: `✅ 4 · ❌ 0 = 4`. 자기보고 trailer `Criteria-Met: 4/4` 일치.

### 운영 gate (HEAD `32b43cc`)

doc inventory·prose·links ok, typecheck 3구성 0 error, lint 0 error/2 기존 warning(이 handoff 범위 밖 파일). 자세한 HEAD 실행 산출은 [0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc).

## 11. Repository operation checks

- 대상 커밋 `5cda65c`·`ae44e58`·`5a99c1f` `git cat-file -t` = commit, `5a99c1f` trailer 5키 파싱.
- AGENTS 변경 위생: 새 링크·작업 절차만 추가, 비밀·일회성 정보 없음. 부모↔자식 충돌 없음.
- `[구현자 기입]` 7필드 존재.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| N1 | 구현 커밋이 AC3·AC4·VP-03·VP-04의 oracle 경로(규범 행)를 함께 수정 | repository operation | NON_BLOCKING | 의미 동일한 경로 이동. 이후 규범 행 정정은 설계 커밋으로 분리 |

## 14–15. Review Signals · 결론

- 반복 증상 없음, 환경 한계 없음(문서 검사는 순수 Python/Node).
- 상태: **PASS** — verify 1회째. pair PASS 4/4, PLAN_GAP 없음.
- 남은 사람 확인: 없음(제품 UI 변경 없음). 가이드 준수 자체는 이후 handoff의 renderer 완료 검토가 담당.
