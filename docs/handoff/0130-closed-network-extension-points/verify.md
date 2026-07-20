# Verify — 0130-closed-network-extension-points

## 메타

| 항목 | 값 |
|---|---|
| slug | `0130-closed-network-extension-points` |
| 검증자 | Claude Code |
| 일자 | 2026-07-20 |
| 대상 커밋 | `99c2a24` |
| 라운드 | 1 |
| 상태 | **PASS\*** (기계 검증 전항 통과 — electron 실기 항목은 사람/CI 대기) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 ✅ #1 — signal 무시 모듈의 timeout 미수렴을 `Promise.race` 로 강제 | 타당 — 설계 §3 의 실질 구멍. 테스트(`service.test.ts` timeout 케이스)로 고정됨 | 매트릭스 #3 증거로 채택 |
| 선조치 ✅ #2 — usage 훅 예제의 `secret.delete` 를 `store` 만료 기록으로 교체(계약 무변경 유지) | 타당 — AC8(usage 계약 무변경) 우선이 맞음. `delete?` optional 추가는 소비자 생기면 후속 | 매트릭스 #8 확인 |
| 보고만 ⚠️ #3 — `env-merge.ts` ↔ `mergeProviderEnv` 이름 근접 | 타당(혼동 여지 인정)하나 책임 상이(스폰 읽기 vs settings 기록)·비범위 | 후속 필요성 낮음 — 이관 없음 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `contracts/sso.ts` 신설 + 불변 정책·동적 로딩 금지 헤더 + 계약 표면 | ✅ | `app/src/main/contracts/sso.ts:1-21`(정책 헤더) · `SsoContext`/`SsoLoginOutcome`/`SsoProviderModule` export |
| 2 | 기본 등록 null + `_example` typecheck 대상·미등록 + 배럴 한 줄 활성화 | ✅ | `features/sso/modules/index.ts:15`(null) · `modules/index.test.ts` 2/2 · `_example/index.ts`(미export, typecheck 통과) |
| 3 | `SsoService` — 미등록 no-op / timeout·inflight·throw 격리 / stateEvent 브로드캐스트 / 분기 없음 | ✅ | `features/sso/service.ts`(`run` race·`patch`→broadcast) · `service.test.ts` **12/12**(미등록·성공·실패·throw·timeout·inflight 중복·restore 3분기·네임스페이스·thunk·store) · grep: 서비스에 회사/provider 리터럴 0 |
| 4 | IPC 3채널 + zod + IPC_CONTRACT 동기 + 조기 등록 | ✅ | `shared/ipc.ts` CHANNELS(sso 3) · `protocol.ts` `SsoLoginRequestSchema` + `protocol.sso.test.ts` 4/4 · `app/handlers/sso.ts` · `bootstrap.ts` start() 최상단 등록 · `docs/IPC_CONTRACT.md` §2.13-c(69→72) |
| 5 | RootGate: prod 미등록 자동 통과 / 등록 시 게이트 / DEV+bypass 불변 / 실패 시 required:false 기본화 금지 | ✅ | `app/RootGate.tsx`(`import.meta.env.DEV ? bypass∥auth : !required∥auth`) · `login/store.ts` `hydrate`(5회 재시도 후 prod fail-closed `required:true`) |
| 6 | 스텁 삭제 + store IPC 미러 + LoginView fields 제네릭 렌더·모듈 메시지 우선 | ✅ | `features/login/sso.ts` 삭제 · `store.ts`(`applySsoState`·`onState` 구독·`{raw}` 우선/카탈로그 폴백) · `LoginView.tsx`(fields map + MODAL_INPUT + Enter 제출) |
| 7 | 토큰 공유: `providerSecrets`=`provider:<key>:` 공용 facade(infra 승격, re-export 무회귀) + `setProviderEnv` env 병합·캐시 무효화 | ✅ | `infra/config/secret-facade.ts` · `usage/external-usage.ts`(re-export 유지, 기존 usage 테스트 무수정 green) · `providers/engine-write.ts` `mergeProviderEnv` · `bootstrap.ts` sink(`invalidateAll`) · `service.test.ts` 네임스페이스 케이스 |
| 8 | usage 계약 무변경 + 훅 변형 예제 추가(미등록) | ✅ | `contracts/usage-report.ts` diff 0 · `static/modules/_example/provider-hook.ts`(미export) · `static/index.test.ts` green |
| 9 | 외부 에이전트 자족 가이드 2종(+stub) + 폐쇄망 가이드 문서 | ✅ | `features/sso/modules/AGENTS.md`+`CLAUDE.md` · `features/providers/static/modules/AGENTS.md`+`CLAUDE.md`(영어 요약 병기) · `docs/guides/closed-network-extensions.md`(touch-only 목록·빌드·비밀 규칙·불변 정책) |
| 10 | 신규 테스트 비-DB 순수 + 게이트 green + 기존 usage 무수정 green | ✅ | 아래 게이트 재실행 — 신규 16 테스트 전부 electron/DB 미로드 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 아래 §게이트 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0 error (sso↛usage — 공유물은 infra 승격) |
| 문서 형식/링크/한국어 | ✅ | — | 확인 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 0 (`.invalid` 예시 도메인만) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사용자 확정 3건 반영 — 확인 대기 |
| UI/UX 시각 검증 (LoginView fields) | ✖ | ✅ | 사람 확인 대기 |
| prod 빌드 게이트 실기 (더미 모듈 활성) | ✖ (electron egress 불가) | ✅ | 사람/CI 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        → 0 error, 1 warning(기존 react-hooks/incompatible-library, 무관)
$ npm run typecheck             → node/web/test 3분할 0 error
$ ./node_modules/.bin/vitest run → Tests 1059/1059 passed (신규: sso service 12 · sso registry 2 ·
                                   protocol.sso 4 포함). Test Files 135/136 —
                                   chat-turn.continuity.test.ts 1파일 로드 실패
                                   = electron 바이너리 egress 차단 베이스라인(변경 무관, 0125~0129 동일)
$ node --test scripts/*.test.mjs → 25/25 (fail 0)
```

better-sqlite3 는 Node ABI 소스 리빌드로 DB 스위트 포함 green.

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: 신규 AGENTS.md 2종·가이드 1종에서 검출 0 — 예시 엔드포인트는 전부 `*.example.invalid`.
- 변동성/일회성 정보 혼입: 없음(절차·계약 포인터만). 영어 요약 병기는 외부 에이전트 대상 문서 한정.

## PHASES.md 정합성

- "현재 작업 중" 은 보드 링크 유지, 페이즈 표에 0130 행 승격(구현 커밋 `99c2a24`).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: `openAuthWindow` 의 창-닫힘/타임아웃 UX(사용자가 창을 닫았을 때 LoginView 메시지)는 설계에서 미전개 — 현재는 모듈 throw 격리로 카탈로그 폴백 메시지가 뜬다. 회사 모듈이 메시지를 다듬을 수 있으므로 수용.
- 구현 단계: `auth-window.ts`/`exec.ts` 는 electron/child_process 의존이라 단위 테스트 미작성(주입 seam 으로 service 는 완전 검증) — 실기 검증은 사람/CI 몫.
- 검증 단계: prod 번들에서 LoginView 포함 여부·게이트 동작은 electron 빌드 불가 환경이라 기계 확인 불가(PASS\* 사유). CI(windows-latest)와 사람 실기가 최종 판정.

## 결론 / 다음 단계

- 상태: **PASS\*** — 인수 10/10 기계 충족. PHASES 승격 완료.
- **사람 실기 대기**: ① 더미 SSO 모듈 등록 후 prod 빌드에서 게이트 활성·로그인 왕복 ② 모듈 0개 prod 빌드에서 게이트 부재(현행 동일) ③ DEV bypass 토글 불변 ④ LoginView 필드 렌더링 시각 ⑤ PR 머지.
