# Verify — 0069-turn-open-consume-on-response

## 메타

| 항목 | 값 |
|---|---|
| slug | `0069-turn-open-consume-on-response` |
| 검증자 | Claude Code |
| 일자 | 2026-07-05 |
| 대상 커밋 | impl `fc15866` |
| 라운드 | 1 |
| 상태 | **PASS (코드 검증 — 실기 회귀는 사람 확인 대기)** |

## 구현자 코멘트 확인

선조치 ✅ 1건: dev 앱 실행 중 better-sqlite3 `.node` 잠금(EBUSY)으로 Node ABI 재빌드 불가 → 잠긴 바이너리 rename 후 127 재설치 우회. **사용자 후속 안내**: dev 앱 재시작 시 `npm run postinstall` 필요. 0019(test-abi-green) 미구현 상태의 실비용 재확인 — 우선순위 재고 권고.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 턴-시작 배치(promptUuid+preludes)는 첫 모델 출력에서 echo 없이 소비·같은 이벤트 persist 직전 커밋 | ✅ | `turn-coordinator.ts` MODEL_OUTPUT_EVENTS + run() turnOpenUuids + 루프 내 markConsumed(commitConsumed 직전). 테스트 "echo 없이 첫 모델 출력에서…커밋", "도구-first 턴 — user row 가 도구 파트보다 먼저" |
| 2 | 무출력 턴은 소비하지 않음(D2 — respawn 이월 잔존) | ✅ | telemetry 는 MODEL_OUTPUT 집합 밖. 테스트 "모델 출력이 없으면 소비하지 않는다" |
| 3 | 늦은 echo 무해(이중 커밋 0) | ✅ | markConsumed 는 미소비만 매칭. 테스트 "늦은 턴-시작 echo 는 무해" |
| 4 | steer 게이트 flush 배치 불변 — echo 만 | ✅ | turnOpenUuids 에 미포함. 신규 가드 테스트 + 기존 0060 D1·D2 steer 스위트 8종 무수정 green |
| 5 | 게이트 + 무변경 불변식 | ✅ | lint 0 · typecheck 3종 0 · vitest **693/693 (88파일)** · build exit 0 · 신규 의존성·IPC·renderer 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 4종 | ✅ | — | 전부 green |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 실기 회귀 — 일반 턴·도구-first 턴 재로드 정렬·steer echo 승격·프롬프트 block(상속 훅) 케이스 | ✖ | ✅ | 사람 확인 대기 |
| **0068 OQ 종결 승인** — 커밋 신호: 턴-시작=응답 시작 / steer=echo 유지(훅 교체 폐기) | ✖ 대리 기록 | ✅ | 본 핸드오프가 (a) 확정의 구현 — 실기 이상 없으면 종결 |
| PR 머지 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ npm run lint        # 0 error
$ npm run typecheck   # node + web + test → 0 error
$ npx vitest run      # Test Files 88 passed, Tests 693 passed
$ npm run build       # exit 0
```

## 검증 자기 리뷰

- 이번 라운드의 판정 데이터가 전부 사용자 실기 wire 로그에서 나왔다(0068 계측 동봉의 직접 성과) — "표시 계약 전제는 실기 1회 선행" 교훈이 즉시 작동한 사례.
- 잔여 의심 1건(plan §리스크): 상속 훅이 프롬프트를 block 하는 케이스에서 "출력 시작=소비" 전제 — 코드로는 검증 불가, 실기 관찰 항목으로 이관.

## 결론 / 다음 단계

**PASS(코드 검증).** 인수 5/5, 게이트 green. 0068 OQ(커밋 신호 echo→훅 교체)는 본 구현으로 종결 — 턴-시작=응답 시작 증거, steer=echo 유지. 실기 회귀 확인 후 이상 없으면 닫는다.
