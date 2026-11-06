# Verify — 0297-login-free-deployment-binders

## 메타

| 항목 | 값 |
|---|---|
| slug | `0297-login-free-deployment-binders` |
| 검증자 | Claude Code |
| 일자 | 2026-11-06 |
| 대상 커밋/range | `b1b00a0..2e7058d` (r1 구현 `2e7058d` — PR 브랜치 `codex-0297-login-free-deployment-binders` 좌표, `main`에는 아직 없음) |
| 구현 전 plan 기준 | `b1b00a0` (V1 설계, `main` 조상) |
| V mode / 유효 V | `Baseline V: V1` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 확장 창 | verify 1회째 — 창 안. ΔV 없음 |
| 독립 축(⑥) | 4축 — 프로덕션 `login-free.ts` 헤더 주입(X01) · `bind`의 로그인 프리 해석(X02) · 형제 슬롯 맞바꿈(M03·M04) · 잔여물 0 타입 변이(M12~M16). 전부 red |
| 열거 sweep(⑦) | 1회째 전수 — §10 9자리 · 규칙 칸 분기(AC1 a~d, AC2 a~b, AC4 행 3종) · 변이 25 · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 0 · 경계 0 · 비귀속 0 |
| 구현 주체·문맥 | Codex 구현. 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사 — 독립성은 ⑥이 맡음 |

## 0. 기준선

- 구현 커밋의 `plan.md` diff는 `[구현자 기입]` 절 추가뿐(`git diff b1b00a0..2e7058d --stat -- docs/handoff` = plan.md +106, INDEX 1행). Decision·AC·V·§10 변경 없음. 기준선이 diff로 성립한다(설계 `b1b00a0` ≠ 구현 `2e7058d`).
- 채점 기준: plan `b1b00a0`의 D-001~D-009 · AC1~AC6 · VP-01~06 · EP-1~EP-5.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V · NEW node ↔ REQUIRED pair · 회귀 pair | 유효 | VP-01~05 REQUIRED, VP-06 REGRESSION |
| §10 자리 목록 재검색 차집합 | 유효(∅) | `git grep '^\s*auth: ' deployment/*.ts`(non-test) → usage-fetcher:24 · harness-runtime:57 · connections:43 + plugins:76(제외). `usageRows`/`harnessRows` 2건. 목록과 일치 |
| 적대 증거 선택 | 유효 | 구조 proxy VP-03·05만 선택, 나머지 직접 oracle |
| 운영 gate 열거 | 유효 | lint·typecheck·vitest·inventory·budgets·가이드 대조·trailer |

## 1. 요약

배포 factory 두 곳이 `bindLoginFreePlugin`을 받고(`contracts/auth.ts` `AuthBinder`), `bind`는 계속 자격증명만 해석한다. Bootstrap 불변(`git diff --stat`에 `bootstrap.ts` 없음 · D-007). 프로덕션 변경은 타입·주석뿐이고 런타임 분기가 없다 — 그래서 false success·부분 실패 경로가 새로 생기지 않는다.

## 2. 비판적 읽기

| 질문 | 판정 | 근거 |
|---|---|---|
| 401/403·미선언에서 상태가 남는가 | 아니오 | `login-free.ts:35-71` request는 snapshot을 안 바꿈. 테스트 `expectLoginFreeUntouched`가 changes·snapshot을 구별 입력(PAT 로그인 선행)으로 단언 |
| 자격증명 포트를 잘못 쓰는 false success | 잠김 | M01·M02·M05 red(`bind` 교체 → `unknown_auth`/헤더 실림) |
| 테스트가 로컬 재구현을 단언하는가 | 해당 | fixture factory는 가이드와 같은 본문을 의도한 배포 자리. 단 production 계약(`bindLoginFreePlugin`·`LoginFreePluginAuth.request`·`createHarnessRuntimeConfigService`·`prepareHarnessConfig`·`connectionState`)은 실제 symbol로 실행 |
| 요청 상한 | 해당 없음 | 기본 배포 비어 있음, fixture `maxBytes: 64KiB` |

## 3. 역방향 탐색

`scan-surface.sh b1b00a0..2e7058d`: 값 export 미사용 0. 테스트 전용 참조 13건(`gateRows`·`harnessRows`·`createConfigApiAugmenters` 등)은 전부 기존부터 "기본 배포는 비어 있다(D-009)"인 factory 골격이며 이번 변경이 만든 것이 아님 — 비귀속·정상. 형제 정책 비대칭 0.

## 4. 증거 재측정

- **gate**(이 환경에서 직접 실행): `npm ci --ignore-scripts` 후 electron/better-sqlite3 설치 복구(`electron/install.js`·`npm rebuild better-sqlite3`).
  - `npm run typecheck`(node·web·test) → error 0.
  - `npm run lint` → 0 errors · 2 warnings(renderer `useTranscriptVirtualizer` 등, 이번 diff 밖). 실행 뒤 `git status` 깨끗(트리 불변).
  - `vitest run src/main/app/deployment src/main/features/auth src/main/app/handlers/engine.ipc.test.ts` → **23 files · 393 tests passed**(구현 보고와 일치). 첫 실행 2파일 실패는 sqlite 바인딩·electron 미설치 환경 서명(`Could not locate the bindings file`, `Electron failed to install correctly`)이며 복구 후 green.
  - `check-doc-inventory.mjs --check` → ok(9 items, 117 channels, links ok). `check-test-budgets.mjs` → 16 suites ok.
- 가이드 예제 ↔ fixture(운영 gate): `closed-network-extensions.md`의 `createUsageFetcher`·`createConfigApiAugmenters` 본문이 `login-free-deployment.test.ts:112-147`과 문자 단위로 일치(상수 선언 `USAGE_API`·`CONFIG_API` 포함). 가이드 앵커 `§3-c`(L615)·`레시피 E`(L1220) 실재.
- 자기보고 대조: EP 9/9(재검색 일치) · VP-03 `@ts-expect-error` config 7종 · Usage 7종+`connectionValue` 1(= plan 7/8) · AC 합계 ✅6 = 총 6.

### 고장 이력

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| M01 | login-free-deployment.test.ts:113 (EP-1) | 호출 대체 | `bindLoginFreePlugin`→`bind` | 잡음 | AC1 (a)(b)(c) 3건 | ⑦ | — |
| M02 | 같은 파일:134 (EP-2) | 호출 대체 | 〃 | 잡음 | AC2 (a)(b) 2건 | ⑦ | — |
| M03 | :113 | 맞바꿈 | USAGE_API→CONFIG_API 포트 | 잡음 | AC1 URL 단언 2건 | ⑤ | — |
| M04 | :134 | 맞바꿈 | CONFIG_API→USAGE_API 포트 | 잡음 | AC2 URL 단언 2건 | ⑤ | — |
| M05 | :113 | 다른 값 | 자격증명 `bind(CREDENTIAL.id)` | 잡음 | AC1 3건(헤더 `authorization` 실림) | 구별 입력 | — |
| M06 | :119 | 제거 | usage `!ok` throw 삭제 | 잡음 | AC1 (b) | ⑦ 분기 | — |
| M07 | :143 | 제거 | config `!ok` throw 삭제 | 잡음 | AC2 (b) | ⑦ 분기 | — |
| M08 | connections.ts usageRows | 다른 값 | category `usage`→`harness` | 잡음 | AC4 | ⑦ EP-4② | — |
| M09 | connections.ts harnessRows | 다른 값 | category `harness`→`usage` | 잡음 | AC4 | ⑦ EP-4① | — |
| M10 | connections.ts harnessRows | 제거 | `harnessModelProviderKey` 삭제 | vitest green · typecheck red(필수 필드, 1 error) | `gate:typecheck` | 재량 | 경계(§10 밖 필드) |
| M11 | contracts/auth.ts `AuthBinder` | 제거 | `bindLoginFreePlugin` 삭제 | 잡음 | typecheck TS2339 | ⑦ EP-5 / VP-05 선택 증거 | — |
| M12 | usage-fetcher.ts:24 (EP-5①) | 호출 대체 | `AuthBinder`→`AuthRuntime`(import 정리, 잔여물 0) | 잡음 | typecheck:test — 능력 경계 `@ts-expect-error` 미사용 3건+TS2740 | VP-03 선택 증거 | — |
| M13 | harness-runtime.ts:57 (EP-5②) | 호출 대체 | `AuthRuntime`(잔여물 0) | 잡음 | typecheck:test — TS2740 + unused 지시어 | VP-03 | — |
| M15 | 〃 | 제거 | `Pick<'bind'\|'connectionValue'>` | 잡음 | TS2353/TS2339 4건 | ⑤ | — |
| M16 | 〃 | 제거 | `AuthBinder`만(`connectionValue` 삭제) | 잡음 | TS2353/TS2339(0291 소비처 포함) | ⑤ | — |
| M14 | connections.ts:43 (EP-5③) | 제거 | `Pick<'bind'>`(잔여물 0) | 잡음 | typecheck: `opencode-connection-deployment.test.ts:92` TS2339 | ⑦ EP-5③ | — |
| M17 | engine.ipc.test.ts stub | 제거 | `bindLoginFreePlugin` 삭제 | 잡음 | typecheck TS2741 | ⑦ stub | — |
| X01 | features/auth/login-free.ts:`headers` | 다른 값 | `authorization: 'Bearer leak'` 주입 | 잡음 | AC1·AC2 헤더 단언 3건 | ⑥ | — |
| X02 | features/auth/runtime.ts `bind` | 호출 대체 | `bind`가 로그인 프리 id를 `bindLoginFreePlugin`으로 해석 | 잡음 | AC3 런타임 1건 | ⑥ | — |

- 검산: 시도 19(M18은 동치 확인용 no-op 삽입 → green, 제외 시 잡음 18 · 동치 0 · 경계 1). M12~M16은 잔여물 0 상태로 판정했다 — 초기 M13·M15·M16 첫 시도는 unused import 잔여 red라 폐기하고 정리본으로 재측정.
- 동작 보존 추출 라운드 아님(프로덕션 런타임 변경 없음). 형제 슬롯 맞바꿈: M03·M04(Usage↔config 포트) · M15↔M16(`bind` vs `connectionValue`). 직전 이력(③④) 해당 없음(r1).
- 환경: 첫 vitest 실행의 2파일 실패(바인딩·electron)는 복구 뒤 green이라 코드 무관.

## 5. 테스트 핸들

전부 순수 vitest(DB·electron 미로드)로 기계 검증 완료. 사람 실기 없음(plan §19).

## 6. V-pair closeout

| Pair | 판정 | 직접 oracle 좌표 | 자리·분기 근거 |
|---|---|---|---|
| VP-01 | PASS | `login-free-deployment.test.ts:'로그인 프리 Usage … (0297 AC1)'` (a)~(d) | EP-1: M01·M03·M05 red. 분기 200/401/미선언/supports 각 입력 있음. 운반 값(URL·헤더)이 형제 포트와 구별(M03) |
| VP-02 | PASS | 같은 파일 `'로그인 프리 config API … (0297 AC2)'` (a)(b) | EP-2: M02·M04·M07 red. `prepareHarnessConfig` 경유 env 단언 |
| VP-03 | PASS | `deployment-wiring.test.ts:'배포 factory 의 능력 경계 (0190)'` + `login-free-deployment.test.ts:'두 deps 의 bind …'` | EP-3 ①②: M12·M13 red(잔여물 0) · 런타임 X02 red. 적대 변이 plan 지정(Usage→AuthRuntime) 재현 |
| VP-04 | PASS | `login-free-deployment.test.ts:'로그인 프리 usage·harness row (0297 AC4)'` | EP-4 ①②: M08·M09 red. 행 3종(llm/service-origin/service-빈 origin) 입력 있음. `'connection' in row === false` 단언 |
| VP-05 | PASS | `gate:npm run typecheck` | EP-5 ①②③: M12·M13·M14 red + M11 red. 선택 증거(plan 지정) 재현 |
| VP-06 | PASS | 기존 스위트 | 23 files/393 tests green(엔진 IPC·opencode 연결·features/auth 포함) |

§10 자리: EP-1 1 · EP-2 1 · EP-3 2 · EP-4 2 · EP-5 3 = 9/9, 차집합 ∅.

## 7. 숫자·상한

소비처 재산출: `HarnessConfigApiDeps` stub 리터럴 2곳(wiring:540대·engine.ipc:75대) 모두 `bindLoginFreePlugin` 보유(M17 red로 잠금 확인). 요청 상한은 기본 배포 0건.

## 8. Repository operation

- `AGENTS.md` 변경 없음. 새 ADR-011 + README 행 + ADR-006 부분 대체 표기(D-008) 확인. `docs/arch/backend/auth.md`는 현재 상태만 서술하고 이력 문구 없음(ADR 링크).
- trailer: `git log -1 --format='%(trailers:only=true)' 2e7058d` → Agent·Handoff·Status·Criteria-Met·Verified-By 5키 파싱 정상. 허용값 일치.
- 좌표: `2e7058d` `git cat-file -t` = commit(PR 브랜치 `codex-0297-…`에 존재). `main`(`b1b00a0`)에는 아직 없어 `merge-base --is-ancestor` 불가 — 병합 뒤 교정 필요. 설계 좌표 `b1b00a0`은 `main` HEAD.
- INDEX: 상태·다음 주체 단일·비고 5줄 이내(이번 턴 갱신분). 이번 PASS로 archive history 이동(실기 없음).

## 9. 판정

**PASS.** 막는 발견 0, 모든 REQUIRED·REGRESSION pair PASS, 운영 gate PASS.

### 확인하지 못한 것

- 포크 배포가 실제 `bootstrap.ts` 런타임으로 두 factory를 호출하는 경로는 실행하지 않았다(§10 선언 경계 (c) — 기본 배포가 비어 typecheck gate만 잠금).
- Windows 전용 CI·전체 `src/main` 스위트는 이번 변경 관련 3개 디렉토리만 실행했다.

### 파생 이슈

없음.

## Review Signals

- 이전 라운드 없음(r1). 반복 증상 없음.
- 관련 plan 지침/AC: 있었고 전부 이행.
- 환경 한계: 의존성 미설치 상태에서 시작해 sqlite·electron 복구가 필요했다(AGENTS.md 환경 가이드 범위).
- 독립 축(⑥) 4축 시도 · 발견 0.
