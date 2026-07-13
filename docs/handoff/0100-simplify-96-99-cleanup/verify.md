# Verify — 0100-simplify-96-99-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0100-simplify-96-99-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-13 |
| 대상 커밋 | `ac12ebd` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: C1/C2 2 커밋 → 파일 중첩(`limits.ts` 등 5종 공유)으로 단일 구현 커밋 통합 | 타당 — 커밋 구획은 구현 세부, hunk 분리는 오류 유발적 | 기준 8 게이트가 통합 커밋 기준으로 통과 |
| ✅ 선조치 1: `resetLabels.ts` → `reset.ts` 리네임(Date 반환인데 Labels 이름은 오독) | 타당 — 심볼·동작 무변경, 테스트 동반 이동 | 기준 3 |
| ✅ 선조치 2: `datetime.test.ts` 에 `import './index'` (i18next side-effect 초기화) | 타당 — main.tsx 와 동일 초기화 경로, 테스트 하네스 세부 | 기준 5·6 |
| ✅ 선조치 3: `UsageLimitBar.period` 판별 필드 추가 (`formatResetLabel(bar.period, bar.resetAt, locale)` 단일 호출) | 타당 — 설계 §F2-3 뷰모델 변경 범위 내, resetAt 단독으론 문장 골격 판별 불가 | 기준 4 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 투영+limit 선택 단일 헬퍼화, 사본 2·데드 export 삭제, 잔존 grep 0 | ✅ | `shared/usage/limits.ts:27-42`(`computeProviderUsageLimits`) · `ProviderUsageTab.tsx`/`useProviderUsageLimits.ts` 는 헬퍼만 호출 · `grep -rn 'summaryForLimit\|summaryForEffectiveLimit' app/src` = 0 · `limits.test.ts` "computeProviderUsageLimits — external report 면 월 사용액을 usedUsd 로 치환" green |
| 2 | `?? entry.limitUsd` 도달 불가 폴백 제거 + IPC 필드 유지 | ✅ | `ProviderUsageTab.tsx:31`(`entry?.effectiveLimit.limitUsd ?? null`) · `shared/ipc.ts:253-259` `ProviderUsageEntry.limitUsd` 무변경(계약 무변경, diff 부재) |
| 3 | shared/time 로케일-프리(데이터 반환·`TimeLocale`/인라인 사전 소멸) | ✅ | `relative.ts`(`relativeTime → {unit,value}`) · `reset.ts`(`nextWeekReset`/`nextMonthReset` Date 반환) · `grep -rn 'TimeLocale\|WEEKDAY_\|MONTH_EN' app/src` = 0 (주석의 구명칭 언급 제외) |
| 4 | `UsageLimitBar.resetLabel→resetAt`(+`period`), `computeUsageLimits` locale 파라미터 제거 | ✅ | `limits.ts:11-18`(period·resetAt) · `computeUsageLimits(summary, limitUsd, now)` 3-인자 · `grep 'resetLabel' app/src` = 코드 0 (formatResetLabel 함수명 제외) |
| 5 | renderer 포맷터 3종 + `time.*` ko/en 동시(패리티 green) | ✅ | `datetime.ts`(`formatRelativeTime`·`formatResetLabel`·`formatRelativeDay` 카탈로그 키 사용) · `resources/{ko,en}.ts` `time` 네임스페이스(11 리프, `_one/_other` 관례 준수) · `resources.test.ts` 3/3 green |
| 6 | 표시 문자열 바이트 동일 보존(테스트 고정) | ✅ | `datetime.test.ts` — 구 `relative.test.ts`/`resetLabels.test.ts` 기대 문자열 전량 승계(`방금`·`1 minute ago`·`(월) 오전 0:00에 재설정`·`Resets (Sat) Aug 1` 등) 15 단언 green · Intl 출력 실측 선확인(구현자 리뷰) |
| 7 | `formatMonthDay` barrel export 제거 | ✅ | `i18n/index.ts` export 목록에서 제거(datetime.ts export 는 유지) · barrel 경유 외부 소비처 0 (grep) |
| 8 | 게이트 green · 신규 의존성 0 · IPC 무변경 | ✅ | 아래 게이트 결과 · `package.json` diff 무 · `shared/ipc.ts` diff 무 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — | lint 0 · typecheck 3종 0 · Vitest 804/836(32 red=DB 네이티브 ABI 환경 제한) · scripts 24/24 |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 첨부 | 이견 시 중재 | 8/8 충족 |
| 레이어 경계(eslint-boundaries) | ✅ 위반 0 | — | lint green (shared→shared·renderer i18n 배치) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/PHASES 정합 |
| 표시 문자열 회귀(기계 판정분) | ✅ 테스트 기대값 고정 | ✅ 라이브 시각 확인 | 15 단언 green / 실기 확인 대기 |
| 제품 의도 부합(A1 = 0096 결정 번복) | ✖ 보조 | ✅ 결정 | AskUserQuestion 확답으로 승인 완료(2026-07-13) |
| 신규 의존성 승인 | ✖ | — | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

> 신선 클론이라 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` 로 JS 툴체인만 설치 (Electron 바이너리 egress 403 — 0019/0098/0099 동일 베이스라인, better-sqlite3 네이티브 빌드 불가).

```
$ npm run lint       → exit 0 (eslint --cache --fix ./src ./scripts, 경계 포함 위반 0)
$ npm run typecheck  → exit 0 (typecheck:node + typecheck:web + typecheck:test 3종 green)
$ npx vitest run     → Test Files 6 failed | 108 passed (114)
                       Tests 32 failed | 804 passed (836)
   · 32 red 전부 better-sqlite3 "Could not locate the bindings file"(네이티브 미빌드).
     실패 6파일을 격리 재실행해 0098/0099 verify 와 동일 집합(전부 DB 네이티브 로드)임을 확인
     — 본 변경 무관. 0099 대비 +2 (본 핸드오프 신규 단언 반영).
   · 본 변경 스위트 격리 실행: src/shared/time + src/shared/usage + renderer/shared/i18n
     → 6 files, 32/32 green.
$ node --test scripts/*.test.mjs → # tests 24 # pass 24 # fail 0
```

- **게이트 판정**: lint/typecheck 완전 green, 32 red 는 환경 제한 베이스라인(코드 무관), 본 변경이 손댄 스위트 전부 green. 통과.

## 위생 검토 (AGENTS.md 변경 시)

- N/A — 본 핸드오프는 `AGENTS.md` 계열 무변경 (`git show --name-only ac12ebd` 에 AGENTS.md 0건).

## PHASES.md 정합성

- 페이즈 표에 `0100` 행 승격, 커밋 `ac12ebd` 기재 — 형식 정합 (검증 커밋에서 갱신).

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: C1/C2 커밋 분할이 파일 중첩을 고려하지 못함(구현 턴에서 단일 커밋으로 조정). `resetLabels.ts` 리네임·`period` 판별 필드·테스트 i18next 초기화 3건을 설계가 선제하지 못하고 구현 선조치로 흡수 — 모두 경계 내였으나 §설계에서 뷰모델·테스트 하네스까지 펼쳤으면 더 나았다.
- **구현 단계**: 미흡 없음. Intl 출력 실측 선확인으로 문자열 회귀 리스크를 커밋 전 제거.
- **검증 단계**: 문자열 보존은 단위 테스트 고정으로 검증했으나 라이브 렌더(언어 전환 시 리렌더 편승 포함)는 기계 판정 불가 — 사람 이관. DB 네이티브 스위트는 환경 제한으로 미실행이나 본 변경은 main DB 경로 무편집(`external-usage.ts` 데드 export 삭제만)이라 리스크 없음.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 8/8 충족, 게이트(lint/typecheck 완전 green, Vitest 804 pass·32 red=네이티브 ABI 환경 제한, scripts 24/24), 레이어 경계 0, 신규 의존성 0, IPC 무변경, 표시 문자열 테스트 고정.
- `INDEX.md` `verify/PASS` → `docs/PHASES.md` 표 승격.
- 리뷰 스킵 2건 기록: `stale` 배관(0098 r2 사용자 결정 pre-wire) · `ProviderUsageEntry.limitUsd` 필드 제거(IPC 계약 변경 — 후속 판단은 사용자).
- **사람 확인 대기**: 라이브 언어 전환 시 사용량 한도 재설정 라벨·상대시각 표시(`npm run dev` 실기) · PR 머지.
