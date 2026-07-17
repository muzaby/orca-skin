# Verify — 0122-composer-status-popover-refresh

## 메타

| 항목 | 값 |
|---|---|
| slug | `0122-composer-status-popover-refresh` |
| 검증자 | Claude Code |
| 일자 | 2026-07-17 |
| 대상 커밋 | `61c4d41` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ✅ #1 — ring 유틸도 box-shadow 라 키프레임이 정적 halo 를 삼킴 → 키프레임 각 스텝에 halo 레이어 유지 | 타당 (Tailwind ring = box-shadow 구현 사실 확인) | 기준 6 증거에 포함 |
| 선조치 ✅ #2 — dead `cost.approx`·`formatCost.ts`·`lib/` 동반 제거 | 타당 (grep 소비자 0 재확인) | 기준 5 증거에 포함 |
| 선조치 ✅ #3 — pages 의 dead `useCostSummary`/`useI18n` import 제거 | 타당 (NewChatLandingPage 의 `tr` 은 인사말 사용으로 보존 확인) | 기준 5 증거에 포함 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 대화 길이 행 = 정성 카피 + `<used>k/<window>k <pct>%` (도넛과 동일 파생) | ✅ | `Composer.tsx:217,224`(동일 `contextTokens`/`contextWindowFor` 값 전달) → `statusViewModel.ts`(k 반올림·pct) → `StatusPopover.tsx:52-58` + `ko.ts` `lengthValue: '{{used}}k/{{window}}k {{pct}}%'` |
| 2 | 오늘 사용량 행 제거, 키 잔존 0 | ✅ | `StatusPopover.tsx` dl 은 length 행 단일. `grep -rn "usageTodayLabel\|status\.(warn\|danger)\.usage"` → 0 |
| 3 | 오늘 비용 행 제거, 키 잔존 0 | ✅ | `grep -rn costTodayLabel` → 0 |
| 4 | 디스클레이머 제거, 키 잔존 0 | ✅ | `StatusPopover.tsx` 하단 `<p>` 삭제, `grep -rn disclaimer src/` → 0 |
| 5 | costToday 체인 + dead `formatApproxCost` 제거 | ✅ | `grep -rn "costToday\|formatApproxCost\|cost\.approx"` → 주석 1건뿐. `formatCost.ts`·`lib/` 삭제, barrel(`features/cost/index.ts`) 정리, pages 3곳 dead import 제거 |
| 6 | pill 경고등 펄스 — currentColor 톤, reduced-motion 폴백 | ✅ | `app.css:165-188`(`status-beacon` 키프레임 + `@utility` + reduce 해제) · `ConversationStatusLine.tsx:37` 적용. 키프레임 첫 레이어가 정적 halo 유지(구현자 #1) |
| 7 | 팝오버 중앙정렬 + 리사이즈 재계산 유지 | ✅ | `Composer.tsx:463` `align="center"` · `Popover.tsx` `compute()` 추출 + `resize` 리스너(88행, open 동안만·클린업 동반) |
| 8 | `statusViewModel.test.ts` 신규 모델 고정 + green | ✅ | 6 tests — 수치 계산(138k/200k 69%)·1M(1000k)·usage 미제공/윈도우 0 생략·costToday 부재. targeted run 20/20 |
| 9 | 게이트 | ✅ | 아래 게이트 재실행 결과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과 (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 |
| 레이어 경계 위반 0 | ✅ | — | lint boundaries 에러 0 (features/chat·shared·pages 내 이동만) |
| 문서 형식/링크/한국어 | ✅ | — | 통과 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사용자 명시 요구 6건 직역 — 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기**: 펄스 톤/속도(1.6s)·수치 행 가독성·팝오버 중앙정렬·리사이즈 추종 실기 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 — 해당 없음 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint        # 에러 0 (경고 1 = useTranscriptVirtualizer react-hooks/incompatible-library, 기존 베이스라인)
$ npm run typecheck   # node/web/test 3분할 모두 통과
$ npm test            # vitest 937/937 passed (123 파일 중 122 passed;
                      #  chat-turn.continuity.test.ts 1스위트 로드 실패 = electron 바이너리
                      #  egress 403 환경 베이스라인, 0119~0121 verify 와 동일 서명·본 변경 무관)
$ node --test scripts/*.test.mjs   # 25/25 passed
```

## 위생 검토

- AGENTS.md 변경 없음. 신규 문서(plan/verify)에 키/토큰/이메일/IP 없음.

## PHASES.md 정합성

- 본 verify 커밋에서 행 승격(범위 요약 + 커밋 hash).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: "중앙정렬" 기준(pill anchor vs 화면)을 추론 C 로 처리 — 사용자 실기 피드백에서 어긋나면 후속 라운드.
- 구현 단계: Popover resize 재배치는 전 팝오버 공통 변경 — 메뉴류가 열린 채 리사이즈되는 시나리오의 시각 확인은 사람 몫.
- 검증 단계: electron 실행 불가 환경이라 애니메이션·배치의 실제 렌더 검증 불가(기계 검증은 코드·게이트 수준). CI(windows-latest)와 사용자 실기가 최종.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사람 확인 대기: UI 시각 실기(펄스·수치 행·중앙정렬·리사이즈)·PR 머지.
