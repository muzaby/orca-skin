# Verify — 0141-context-budget-resolver

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-07-22 |
| 결과 | **PASS\*** (기계 충족 8/8, 사용자 실기 대기) |
| 라운드 | 1 |

## 요구사항 충족 매트릭스

| AC | 내용 | 결과 | 증거 |
|---|---|---|---|
| 1 | `mainModel` 파라미터·`ctx.mainModel` 캡처·`MapContext.mainModel` 제거 | ✅ | `grep mainModel src/` → 0건. `normalizeResultTelemetry(r)` 단일 인자 |
| 2 | `primaryModelKey` = argmax(input+cacheRead+cacheCreation), 전부 0 이면 첫 키 | ✅ | `claude-map.ts` 신규 순수 헬퍼 + 테스트 "전부 사용량 0 → 첫 키" |
| 3 | primary 확정 시 model+contextWindow 승격, 항상 실제 키 | ✅ | 승격 분기 `models.length===1 ? models[0] : primaryModelKey(...)` |
| 4 | Bedrock 해석 키 다중 모델 → argmax 1M 승격 | ✅ | 테스트 "Bedrock 해석 키…argmax 로 분모 정답" (`global.anthropic.claude-sonnet-5` → 1M) |
| 5 | 누적 haiku 잔류 → sonnet-5 유지 / haiku 우세 → 200k | ✅ | 테스트 2건("누적…분모 유지", "haiku 우세…200k 추종") |
| 6 | `[PHASE0-DIAG]` 2곳 + 미사용 import 제거 | ✅ | `grep PHASE0-DIAG src/` → 0건. `grep getLogger claude.ts` → 0건 |
| 7 | renderer `contextWindowOf` 무변경 + 테스트 갱신 | ✅ | `contextWindow.ts` diff 0. `contextWindow.test.ts:67` 주석 0141 갱신 |
| 8 | 게이트 | ✅ | lint 0 error(1 pre-existing warning=TanStack Virtual, 무관) / typecheck 3분할 0 / vitest 378/378(adapters+chat lib)·373/373(usage+chat+renderer) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 |
|---|---|---|
| 게이트 lint/typecheck/vitest | ✅ 실행 | — |
| AC↔코드 1:1 | ✅ 증거 | 이견 시 중재 |
| 레이어 경계 | ✅ 위반 0(adapters 내부) | — |
| **실 Bedrock sonnet-5 도넛 = 259k/1M(25.9%)·>100% 소멸** | ✖ | ✅ 실기 |
| 제목 haiku 활성에도 유지·모델 전환 추종 | ✖ | ✅ 실기 |
| PR #282 머지 | ✖ | ✅ |

## 게이트 재실행

- lint: 0 error, 1 warning(TanStack Virtual `useVirtualizer`, 본 변경 무관).
- typecheck: node/web/test 3분할 0.
- vitest(순수): adapters+chat lib **378/378**, usage+chat+renderer **373/373**. DB 로드 스위트는 electron ABI egress 베이스라인(미실행, 본 변경 무관 — DB/IPC 변경 0).

## 검증 자기 리뷰 (메타)

- **설계 반복 비용**: 0134→0139→0141 3회. 근본 교훈 = "입력측 모델 문자열로 SDK 출력을 귀속하려 한 것"이 반복 실패의 뿌리. 사용자 실측(입력 alias↔해석 키 불일치)이 이를 확정해, argmax(SDK 출력만) 로 귀속을 옮겨 매칭 의존을 제거했다.
- **미흡/후속**: contextWindow DB 영속(Phase 3) 미완 — 복원 window 는 휴리스틱. 제목 haiku 오염원(Phase 4) 미차단(도넛은 argmax 로 면역이나 비용 귀속엔 잔존). 둘 다 plan §비범위에 명시.

## PHASES 정합

- `docs/PHASES.md` "현재 작업 중"에 재설계 프로그램(0140 진단 종결 + 0141 핵심 수정) 반영. 완료 이력 정본은 `git log`.

**Next-Action: none** (PASS\* — 사람 실기·PR 머지 대기).
