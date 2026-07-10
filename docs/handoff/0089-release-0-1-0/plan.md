# Plan — 0089-release-0-1-0

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0089-release-0-1-0` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | v0.1.0 첫 릴리즈 (OQ3 release-ops 실행분) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "0.1.0 버전 릴리즈 (윈도우, 설치파일). 배포버전에서는 기본적으로 디버그 패널 없앨 것. SSO 로그인 disable." | 라이브 세션 요청 (2026-07-10) |
| 명시 요구 | SSO disable 방식 = **배포(prod) 빌드에서 로그인 게이트 자체를 스킵** | 라이브 세션 Q&A 확정 |
| 명시 요구 | "로그인 게이트 비활성화는 릴리즈 빌드에서만 유효하다. `npm run dev` 에서는 디버그 패널 및 SSO 로그인 게이트 유무도 조작될 수 있어야 한다" | 라이브 세션 피드백 (plan 승인 시) |
| 명시 요구 | 릴리즈 실행 범위 = PR 머지 후 Claude 가 v0.1.0 태그 push, draft 확인까지. **draft Publish 는 사용자** | 라이브 세션 Q&A 확정 |
| 명시 요구 | `package.json` 템플릿 메타데이터(description/author/homepage) 이번 릴리즈에서 정리 | 라이브 세션 Q&A 확정 |
| 추론 의도 | "디버그 패널 없앨 것" = prod 번들에서 완전 제거(기존 `import.meta.env.DEV` 가드로 이미 충족)이며, prod 에서 숨겨진 진입로를 남기라는 뜻이 아님 (추론) | 기존 가드 존재 (아래 자료조사) |

## Context (왜)

Orca 첫 공식 릴리즈. 릴리즈 파이프라인(0087/0088)은 완성됐으나 실제 릴리즈는 0건. 그대로 배포하면 **로그인 데드락**이 있다 — SSO 는 항상-실패 스텁이고(0072 설계), 유일한 진입 수단인 "로그인 우회(bypass)" 토글은 디버그 패널 안에만 있는데 디버그 패널은 prod 번들에서 제거된다. 따라서 배포 빌드에 한해 로그인 게이트를 비활성화해 설치 사용자가 바로 앱에 진입하도록 한다. dev 흐름(로그인 화면·SSO 스텁·bypass 토글)은 그대로 보존한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 디버그 패널 렌더 2곳 모두 `import.meta.env.DEV` 가드 → prod 정적 제거 (이미 충족) | 코드 `app/src/renderer/src/app/OverlayLayer.tsx:62`, `app/src/renderer/src/app/LoginFrame.tsx:72` |
| main 디버그 IPC·MockAdapter 도 DEV 가드 | 코드 `app/src/main/app/handlers/misc.ts:277`, `app/src/main/app/bootstrap.ts:257` |
| SSO 는 항상-실패 스텁(`throw new Error('SSO not implemented')`), 성공 경로 미배선 | 코드 `app/src/renderer/src/features/login/sso.ts:19`, 설계 `@docs/handoff/0072-login-sso-gate` |
| 게이트 판정: `bypass \|\| authenticated` 아니면 `LoginFrame` — bypass 토글은 디버그 패널 전용(`SsoDebugSection`) → prod 데드락 | 코드 `app/src/renderer/src/app/RootGate.tsx:22,28`, `features/login/components/SsoDebugSection.tsx:11` |
| 부트 실패 시 `LoginFrame` 이 에러 배너+재시도 UI 로 재사용됨 (prod 에서도 필요) | 코드 `app/src/renderer/src/app/RootGate.tsx:29-31`, `LoginFrame.tsx:55-68` |
| 릴리즈 파이프라인: `v*` 태그 push → windows-latest, 버전검증→게이트→NSIS→draft release(자산 3종)→sha512 검증 | `.github/workflows/release.yml`, `@docs/guides/release-operations.md §릴리스 절차` |
| 버전은 이미 `0.1.0`, 태그 없음(릴리스 0건) → `npm version` bump **불필요**(bump 시 0.2.0 이 됨), 머지 커밋에 직접 `v0.1.0` 태그 | 코드 `app/package.json:3`, `git tag -l` 빈 결과, `@docs/handoff/0087-cicd-release-pipeline` |
| `package.json` 메타데이터가 템플릿 기본값 — 도메인 PR 에서 갱신하라는 규칙 | 코드 `app/package.json:4,6,7`, `@app/AGENTS.md` 에이전트 원칙 6 |
| dev/prod 분기 관용구: renderer `import.meta.env.DEV`(정적 치환+tree-shaking) | 코드 `OverlayLayer.tsx:62` 기존 패턴, 외부 https://vitejs.dev/guide/env-and-mode |

## 인수 기준 (Acceptance Criteria)

1. 배포(prod) 빌드에서 로그인 게이트가 비활성화된다 — 로그인 화면 없이 부트 → 앱 진입. 가드는 `import.meta.env.DEV` 를 **사용처(RootGate·LoginFrame)에서 직접** 쓴다. *(설계 수정 r1 — 원안은 `features/login/gate.ts` 의 단일 상수 `LOGIN_GATE_ENABLED` 였으나, 모듈 경계를 넘는 상수는 Rollup 이 폴드하지 못해 `LoginView`(SSO 카드+오르카 PNG)가 prod 번들에 잔존함을 build+grep 으로 확인 → 기존 `OverlayLayer.tsx:62` 관용구와 동일하게 인라인 가드로 변경. 구현자 기입 #1 참조.)*
2. dev(`npm run dev`) 동작은 무변경 — 로그인 게이트·SSO 스텁·디버그 패널·bypass 토글이 기존 그대로 존재하고 조작 가능하다 (게이트 조건식이 DEV 에서 기존 `bypass || authenticated` 와 동치).
3. prod 에서 부트 실패 시 `LoginFrame` 에러 배너+재시도는 유지되되, 동작 불가능한 SSO 로그인 카드(`LoginView`)는 렌더되지 않는다.
4. 디버그 패널은 prod 번들에서 계속 제거 상태다 (기존 가드 회귀 없음 — prod 번들 grep 으로 확인).
5. `package.json` 의 `description`/`author`/`homepage` 가 템플릿 기본값에서 Orca 실값으로 갱신된다. `version` 은 `0.1.0` 유지(bump 없음).
6. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test` + `npm run build` 성공.
7. (릴리즈 실행) PR 머지 후 머지 커밋에 `v0.1.0` 태그 push → release.yml green → draft release 에 자산 3종(`orca-0.1.0-setup.exe`, `latest.yml`, `.blockmap`) 확인. draft Publish 는 사용자.

## 범위 / 비범위

- **범위**: 렌더러 로그인 게이트 prod 비활성화(파일 3~4개), `package.json` 메타데이터, 릴리즈 실행(태그·CI 감시·draft 확인).
- **비범위**: 실 SSO 구현(스텁 유지 — 실배선 시 `LOGIN_GATE_ENABLED` 제거가 마커), 코드 서명, `electron-builder.yml` 변경, 자동 업데이트 로직(0084/0085 완료분 그대로), draft Publish(사용자 수동 게이트).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- Vite `import.meta.env.DEV` 정적 치환 + tree-shaking (기존 관용구 재사용).
- 릴리즈 인프라 0087/0088 산출물 그대로 사용 (`release.yml`, `validate-release-version.mjs`, `validate-dist.mjs`).
- **신규 의존성 없음.**
- 전제: 저장소 public 유지(업데이트 피드), unsigned 배포(사내용 — SmartScreen 경고는 release-operations.md §unsigned 안내).

## 설계

*(설계 수정 r1: `gate.ts` 단일 상수 → 사용처 인라인 `import.meta.env.DEV` 가드 — 인수 기준 1 의 수정 사유 참조. 게이트 스위치의 단일성은 두 사용처의 `handoff 0089` 주석으로 추적한다.)*

- `app/RootGate.tsx`: `gatePassed = !import.meta.env.DEV || bypass || authenticated` 로 부트 effect·렌더 분기 2곳 치환. `bootPhase === 'failed'` 분기는 유지.
- `app/LoginFrame.tsx`: `<LoginView />` 를 `import.meta.env.DEV` 일 때만 렌더 (prod 부트 실패 화면에서 SSO 카드 미노출 + 번들 정적 제거).
- 레이어 경계: `app` → `features/login` 하향 import (기존과 동일 방향), 교차 feature 없음.
- 재사용: 기존 `import.meta.env.DEV` 관용구, `LoginFrame` 에러 배너, 릴리즈 스크립트/워크플로우 무변경.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- prod 첫 실행: 로그인 화면 없이 `BootScreen` → 랜딩. `hydrateBypass` 는 그대로 실행되나(설정 read, 무해) 게이트 판정에 영향 없음.
- prod 부트 실패: 에러 배너 + "부트 다시 시도" 만 노출 (SSO 카드 없음 — AC3).
- dev bypass off: 기존 그대로 로그인 화면 + 항상-실패 SSO + 디버그 패널로 bypass 조작.
- `SidebarUserButton` 사용자 표기: prod 는 bypass=false·email=null 경로 — 기존 bypass 아닐 때와 동일 렌더(회귀 아님, 0072 이후 동작 유지).
- 테마/접근성/동시성: 해당 없음 (조건부 렌더 변경만).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| prod 에서 인증 없이 앱 접근 가능 | 의도된 결정(사용자 확정) — SSO 미구현 단계의 사내 배포. 실 SSO 배선 시 `LOGIN_GATE_ENABLED` 제거. |
| unsigned exe SmartScreen 경고 | release-operations.md §unsigned 안내 존재 — "추가 정보 → 실행". |
| 태그를 잘못된 커밋에 push | 머지 커밋 hash 를 확인 후 태그. 실패 시 태그 삭제→재태그 절차(release-operations.md §트러블슈팅). |

- 되돌리기 어려운 결정: 릴리즈 버전 번호(0.1.0) — 삭제 시에도 번호 재사용 금지(release-operations.md §버전 정책).
- **단독 결정 금지 항목**: 없음 — SSO 처리 방식·릴리즈 범위·메타데이터 모두 라이브 세션에서 사용자 확정.

## 영향 받는 파일

- `app/src/renderer/src/app/RootGate.tsx`
- `app/src/renderer/src/app/LoginFrame.tsx`
- `app/package.json` (메타데이터만)

## 참고 문서

- `docs/guides/release-operations.md` (릴리스 절차·체크리스트·롤백)
- `docs/handoff/0072-login-sso-gate` (로그인 게이트 원설계) · `0087-cicd-release-pipeline` · `0088-ci-trigger-versioning`
- IPC 변경 없음 (`IPC_CONTRACT.md` 무관)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- 신규 테스트 요구: 없음 — 변경은 조건부 렌더 스위치(UI, 시각 검증 갈음)와 메타데이터. prod tree-shaking 은 build 산출물 grep 으로 검증.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 출처(라이브 세션)로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`·웹 URL)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 의존성 없음을 확인했다.
- [x] 파생 UX — prod 첫 실행/부트 실패/dev 흐름 엣지케이스를 펼쳤다.
- [x] 리스크 — 무인증 접근·unsigned·태그 실수 리스크와 완화책을 적었고, Open Question 해당 없음을 확인했다.

---

> **[구현자 기입]** 구현 주체 = Claude (비기능 — 릴리즈 인에이블링 스위치 + 메타데이터).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 게이트 스킵 방향·dev 무변경·메타데이터 정리는 설계대로. dev 조건식 동치성(DEV=true 면 `!true || …` = 기존 `bypass || authenticated`)을 코드에서 확인.
- 이견 / 우려: 원안의 `gate.ts` 단일 상수는 **prod dead-code 제거가 안 된다** — 1차 구현 후 build+grep 에서 `SSO로 로그인` 문자열(=LoginView)이 번들에 잔존함을 확인. Vite define 치환은 모듈 단위이고 Rollup 은 모듈 경계를 넘는 상수를 폴드하지 않는다. → 설계 수정 r1(인라인 가드)로 해소, AC1 에 소급 기록.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 모듈 경계 상수(`LOGIN_GATE_ENABLED`)로는 `LoginView` 가 prod 번들에 dead code 로 잔존(SSO 카드 + 오르카 PNG) | ✅ 사용처 인라인 `import.meta.env.DEV` 가드로 변경(설계 수정 r1), 재빌드 grep 으로 `SSO로 로그인`·`로그인 우회` 0건 확인 | 1차 빌드 grep 히트 → 수정 후 0건 |
| 2 | `loginActions.attemptSso`/`runSso` 스텁 문자열(`SSO not implemented`·`로그인에 실패했습니다`)은 prod 번들에 잔존 — store 객체 속성이라 tree-shaking 불가 | ⚠️ 보고만 — 호출 UI(LoginView)가 prod 에 없어 도달 불가. 실 SSO 배선 시 자연 해소 | 번들 grep 1건씩, RootGate 는 `hydrateBypass` 만 호출 |
| 3 | `updateStore.ts` 의 더미 업데이트 mock 문자열이 prod 번들에 잔존 (0086 기존 상태) | ⚠️ 보고만 — 토글 UI(`UpdateDebugSection`)는 DEV 제거라 도달 불가, 본 핸드오프 비범위 | 번들 grep 2건, `dummyMode` 진입점 = 디버그 패널 전용 |

## [구현자 기입] 구현 체크리스트

- [x] `RootGate.tsx` 판정 2곳 (인라인 DEV 가드)
- [x] `LoginFrame.tsx` LoginView 가드
- [x] `package.json` 메타데이터
- [x] 게이트 4종 + prod 번들 grep

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/renderer/src/app/RootGate.tsx` · `app/src/renderer/src/app/LoginFrame.tsx` · `app/package.json` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test`(vitest+node --test) / `electron-vite build` + 번들 grep |
| 게이트 결과 | lint ✅ 0 / typecheck 3종 ✅ / vitest **773/773 passed**(3 suite 로드 실패=electron 바이너리 403 환경 제한·0019/0083 계열·본 변경 무관) / node --test **24/24** / build ✅ / 번들 grep: `SSO로 로그인`·`로그인 우회`·`Wire 메시지` 0건, main `orca:debug` 0건 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (구현 커밋 hash — 커밋 후 verify.md 에 기재) |
