# Verify — 0187-simplify-176-186-cleanup

## 메타

| 항목 | 값 |
|---|---|
| slug | `0187-simplify-176-186-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-08-13 |
| 대상 커밋 | `49a1f20` (PR #332 head, 브랜치 `claude/simplify-handoff-176-186-whd20f`) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예 — 설계·구현·검증 모두 Claude.** §역방향 탐색·§0 을 강하게 적용했다 |

> **외부 입력**: 사용자가 이 PR 에 대한 외부 리뷰 문서(`PR_332_refactoring_review.md`)를 제출했다.
> 그 리뷰의 사실 주장은 전부 코드로 재확인했고(아래), **심각도 배분과 해법은 본 verify 가 독립
> 판정**했다. 리뷰를 증거로 받지 않았다 — 리뷰가 놓친 것(§역방향 탐색 D3)과 리뷰가 과잉으로
> 잡은 것(§AC3)이 둘 다 있다.

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·**동시 호출**·종료 중·권한 거부) | **결함 발견** | `ProviderApiImpl.request` 가 자격증명을 요청 시작 시 1회만 푼다(`api.ts:93`). 체인은 `await` 를 포함하므로 홉 사이에 `LoginService.revoke()`(IPC 동기 진입)·다른 요청의 401 강등·`expiresAt` 경과가 끼어들 수 있다. **변경 전에는 홉마다 `store.get`+`store.secret` 을 다시 풀어 그 변화가 다음 홉을 `grant_not_valid` 로 막았다** → **D1** |
| **잘못된 성공(false success)** 이 가능한 경로 | **예 — D1 이 그것이다** | 사용자가 해제한 뒤에도 진행 중 체인의 다음 홉이 **성공**한다. allowlist 밖 유출은 아니다(값형 `redirectOrigins()` 는 `[provider.origin]` 하나, `api.ts:159-165`) — 그러나 "해제했는데 그 요청이 끝까지 성공한다" 는 관측 가능한 오작동 |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | ✅ 예 | 마이그레이션 0줄·IPC 0줄(AC16 실측). 단일 커밋 revert 로 되돌아간다. `store-file.ts` 의 lazy open 은 실패 시 메모리 폴백이라 부팅을 막지 않는다 |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **AC3 에서 어긋남** | plan AC3 은 "통지가 루프 뒤 **1회**" 를 요구한다. 실제는 `1 + K`(K=401/403 수) — `api.request` 가 401 에서 **같은 `onChange` 를 자체 호출**하기 때문(`api.ts:104` ↔ `bootstrap.ts:259` 공유 콜백). **다만 이것은 구현 결함이 아니라 기준이 잘못 쓰인 것이다** → §AC3 · **D2** |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | ✅ 넘지 않음 | 신규 의존성 0 · IPC/스키마/i18n 표시 문구 무변경(AC16 실측 0줄). 기각 4건·이월 3건이 plan §범위에 근거와 함께 적혀 있다 |

**plan 의 리스크 분석이 놓친 지점**(자기 리뷰로 되먹임): plan §리스크는 *"병렬 sweep 은 provider
마다 독립 probe 라 상호 간섭이 없다"* 고 적었다. probe **자체**는 독립이 맞다. 그러나 **통지 sink
가 공유**라는 축을 보지 않았다 — 간섭은 probe 가 아니라 `onChange` 에서 일어난다.

## 역방향 탐색 (매트릭스 전 선행)

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 0d78918..49a1f20`

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export `providerToolServerId` (AC8 대상) | **정상** | 스크립트는 교차 파일 참조만 센다. 같은 파일 `service/index.ts:78` 이 호출한다 |
| 미사용 export `sessionPolicies` · `pickPrincipal` | **정상** | 각각 `session-policies.ts:70` · `browser-session.ts:135,206` 동일 파일 사용 |
| 미사용 export `parseGrantRecords`·`parsePendingRecords` | **정상** | `createRecordPersistence` 의 `parse` 인자로 주입(`store-file.ts:172,183`). 테스트가 직접 부르는 파싱 계약 |
| 테스트에만 등장 `useUsageStore`·`reloadProviderUsage` | **선행 부채 — 본 PR 무관** | `git grep useUsageStore 49a1f20^` 도 프로덕션 참조 **0**. 소비자는 `initUsage`(`app/boot/steps.ts:3`)·`subscribeUsage`(`CostProvider.tsx:2`)뿐. **본 PR 이 만든 것이 아니므로 D 로 올리지 않고 기록만 한다** |
| 형제 파일 정책 비대칭 | **0건** | 스크립트 §3 출력 없음 |
| **거짓 불변식 주석 2건** (스크립트 밖 — 사람 패스) | **결함** | `api.ts:90-92` *"체인 도중에 grant 가 바뀌지 않으므로"* → D1 의 증거. `login.ts:158-160` *"통지는 루프 뒤에 한 번이다"* → D2 의 증거 |
| **인수 기준의 핵심 동사가 테스트에 등장하는가** | **AC2·AC3 미등장** | `api.test.ts`·`login.test.ts` 의 이번 diff 는 **import 경로 한 줄씩이 전부**다. 두 동시성 변경에 새 단언 0건 → **D3** |
| **`login.test.ts` 가 왜 못 잡았는가** (기제 추적) | **구조적 불가** | 하네스의 `probeApi` 는 `ProviderResponse` 를 돌려주는 스텁이라 `ProviderApiImpl` 의 401 side effect(`markExpired`+`onChange`)를 **탈 수 없다**. 즉 이 배칭 격차는 현재 하네스로는 원리적으로 관측 불가 → D3 의 해법은 "단언 추가" 가 아니라 **실제 `ProviderApiImpl` 배선** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

plan.md 에 `[구현자 기입]` 챕터가 **없다** — 설계·구현이 같은 에이전트라 코멘트 왕복이 생략됐다.
그 자체가 자기 검증 편향의 한 형태이므로(§메타), 구현자 코멘트 대신 **커밋 trailer 의
`Criteria-Met: 16/16` 을 증거로 쓰지 않고** 전 기준을 재대조했다(SKILL §2). 결과는 아래 매트릭스 —
**16/16 이 아니라 13 ✅ / 2 ⚠️ / 1 ❌** 다.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 턴당 secret 조회 vault 읽기 2~3 → 1회 | ✅ | `store.ts:148-154` — `status()` 호출 제거, `vault.read` 1회. `expiresAt` 을 읽기 **전에** 판정. 기존 `login`/`api`/`policy` 스위트 무회귀(1780/1780) |
| 2 | 요청당 자격증명 해석 1회 (홉마다 다시 풀지 않음) | ⚠️ **구현만** | 구조 목표는 충족 — `api.ts:93` `resolveCarrier` 1회 + `transport(carrier,…)`(`:136`). **그러나 redirect lifecycle 의미 보존은 검증 수단이 없고 실제로 깨졌다** → **D1**. 검증 수단이 형태(시그니처)만 지정한 것이 원인 |
| 3 | 병렬 sweep + **통지가 루프 뒤 1회** | ❌ **미충족** | `Promise.all` 은 충족(`login.ts:171`). **"통지 1회" 는 성립하지 않는다** — 실제 `1 + K`. **기준 자체가 잘못 쓰였다** → §AC3 · **D2** |
| 4 | OAuth pending 스토어 지연 개방 + 실패 시 메모리 폴백 | ✅ | `store-file.ts:117-129` `open()` lazy · `:141-153` 폴백. `bootstrap.ts` 가 사유 콜백 주입 |
| 5 | 창 크롬 한 벌 (`GateFrame`·`BootFailureFrame`), DOM 불변 | ⚠️ **구현만 (시각은 사람)** | `FullFrameShell.tsx` 신설 + 두 화면이 사용(`GateFrame.tsx:32`·`BootFailureFrame.tsx:19`). 클래스 문자열·`data-screen-label`·`data-context` 가 셸로 이동. **렌더 결과 동일성은 기계 판정 불가**(renderer `.tsx` 는 vitest include 밖) — 사람 실기 대기. 로직이 아니라 순수 JSX 구조라 SKILL §5 의 "관례를 방패로 쓴 경우" 에 해당하지 않는다 |
| 6 | probe origin 판정이 `isAllowedOrigin` 한 구현 | ✅ | `login.ts:245` · 로컬 `originOf` 제거(diff 확인). `policy.test.ts` 가 `isAllowedOrigin` 을 덮는다 |
| 7 | `SessionGroupPolicy` 선언 1개 | ✅ | 실측: `interface` 선언은 `infra/browser-session-policy.ts:21` **단 1곳**, 나머지 5개 파일은 import/re-export |
| 8 | `<id>-tools` 규칙이 플랫폼에 | ✅ | `service/index.ts:28` `providerToolServerId`, 같은 파일 `:78` 사용. `service/*.test.ts` 참조 3회 |
| 9 | `mcp__<server>__<tool>` 조립 한 함수 | ✅ | `adapters/runtime-tool-policy.ts:6` → `platform.ts:130` · `runtime-tool-policy.ts:19` 양쪽 사용 |
| 10 | `settings:set` 핸들러에 feature 별 `if (key === …)` 없음 | ✅ | `handlers/settings.ts` 에서 분기 제거(diff) → `app/settings-reactions.ts` 신설 + `bootstrap.ts:430` 배선. **`settings-reactions.test.ts` 104줄 신설** — 테스트 있는 기준 |
| 11 | provider 한도 쓰기가 사용량 authority 경유 | ✅ | `tracker.ts:116-126` `setProviderLimit` · `handlers/cost.ts` 1줄로 축소. `usage` 스위트 무회귀 |
| 12 | 죽은 표면 제거 (6종) | ✅ | 실측 grep: `connector-address`·`clearAll`·`globalUpdatedAt`·`composeGlobalUsage` = **0**. `createNamespacedSecretFacade`·`providerSecretPrefix` = 각 1 — **둘 다 `secret-store-port.ts:7-8` 의 제거 근거 주석**이지 코드가 아니다 |
| 13 | `text-red` → `text-bad` | ✅ | 실측 `text-red` grep **0** |
| 14 | 게이트 선언 슬롯이 배열 | ✅ | `declarations/sso.ts:68` `GATE_PROVIDERS: Provider[] = []` + `:34` 주석 예시. `declarations/index.ts:16` 이 스프레드 |
| 15 | 게이트: lint 0 error · typecheck 3/3 · vitest 무회귀 | ✅ | 아래 §게이트 — **재실행으로 확인** |
| 16 | IPC 채널·zod 스키마·i18n 표시 문구·DB 스키마/쿼리 무변경 | ✅ | `git show 49a1f20 --stat -- src/shared/ipc.ts src/shared/protocol.ts migrations/*` → **출력 없음(0줄)** |

**집계: 13 ✅ / 2 ⚠️(구현만) / 1 ❌.** 커밋 trailer 의 `Criteria-Met: 16/16` 은 과대 보고다.

### §AC3 — 왜 미충족인가 (기준이 잘못 쓰였다)

AC3 은 *"통지가 루프 뒤 1회"* 라는 **총량 기준**으로 쓰였다. 그 숫자는 성립할 수 없다:

```
sweepPlugins()
  └ Promise.all(reprobe × N)
        └ probeOk → api.request()
              └ 401/403 → store.markExpired() + onChange()   ← 여기서 K회
  └ onChange()                                                ← 여기서 1회
```

`onChange` 는 `ProviderApiImpl` 과 `LoginService` 가 **같은 함수를 공유**한다(`bootstrap.ts:272`
·`:325` 둘 다 `onProviderChange`). AC3 의 검증 수단은 *"`Promise.all` + 단일 `onChange`"* — 즉
`login.ts` 안의 **호출 지점 개수**만 지정했고, 다른 호출자가 같은 sink 를 민다는 사실은 사정권 밖이었다.

**그러나 이 기준을 코드로 맞추면 안 된다.** `onChange` 를 sweep 중 억제하면 renderer 방송뿐 아니라
**`serviceTools.sync()` 까지 함께 억제된다**(`bootstrap.ts:260`) — 그리고 그것이 만료 provider 의
도구를 걷어내는 유일한 경로다(`service/index.ts:44` `status !== 'valid'`). `bootstrap.ts:355` 는
`void providers.resume()` 로 **fire-and-forget** 이라, 게이트가 열려 사용자가 앱을 쓰는 동안 sweep 이
돈다:

```
게이트 통과 → renderer 오픈 → 사용자 사용 중
  → plugin A 401 → markExpired(A)
  → [통지 억제 시] A 의 stale 도구가 registry 에 남는다
  → plugin B 가 PROBE_TIMEOUT_MS(15초) 대기 중이면 그만큼 회수 지연
```

즉 **AC3 을 만족시키는 구현이 새 lifecycle 회귀를 만든다.** 또한 변경 전은 루프 **안**에서
provider 마다 `onChange` 를 불렀으므로 `N + K` 였다 — 현재 `1 + K` 는 **항상 개선**이다.

→ 판정: 구현은 옳고 **기준이 과잉**이다. 0185 verify §AC9 와 같은 형태(총량 임계를 잘못 겨냥).
   AC3 원문은 **실패한 설계 기준으로 보존**하고, 정정은 D2 의 사용자 결정으로 넘긴다.
   (인수 기준 변경은 검증자 단독 권한이 아니다 — `docs/handoff/AGENTS.md:126,137`.)

## 검증 책임 분리 (사람 vs 에이전트) — **정본 표**

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | 아래 §게이트 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`) | 이견 시 중재 | 13 ✅ / 2 ⚠️ / 1 ❌ |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | lint 0 error |
| **AC3 기준 정정 (인수 기준 변경)** | ✖ 단독 결정 금지 — 근거·옵션 제시 | ✅ 결정 | **결정 완료 → D2 에 대리 기록** |
| **AC5 창 크롬 렌더 결과 동일성** | ✖ 시각 | ✅ | 사람 확인 대기 |
| 폐쇄망 실기(SSO redirect·probe 왕복) | ✖ | ✅ | 사람 확인 대기 |
| INDEX 행 형식·PR#/커밋 | ✅ | — | 아래 §INDEX |
| PR 머지 승인 | ✖ | ✅ | FAIL — 재구현 후 재검증 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)
  → useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library (0102 베이스라인)

$ npm run typecheck
typecheck:node ✔  typecheck:web ✔  typecheck:test ✔      (3/3)

$ ./node_modules/.bin/vitest run
Test Files  1 failed | 197 passed (198)
     Tests  1780 passed (1780)
```

**환경 기인 분리** (SKILL §4): 최초 설치(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`) 직후에는
**5 파일 / 42 테스트**가 실패했고, 목록이 `app/AGENTS.md` 의 알려진 베이스라인과 **정확히 일치**했다:

```
src/main/infra/db/queries.test.ts        src/main/infra/db/migrate.test.ts
src/main/features/extensions/builder.test.ts
src/main/features/orchestration/fork.test.ts
src/main/app/chat-turn.continuity.test.ts
서명: Module did not self-register: better_sqlite3.node
```

`npm rebuild better-sqlite3`(Node ABI, 소스 컴파일) 후 **42건이 전부 green — 1780/1780 통과**.
남은 1 suite 는 `chat-turn.continuity.test.ts` 로, 실패 사유가 ABI 가 아니라
`Electron failed to install correctly`(바이너리 다운로드를 건너뛴 설치) 이며 **테스트를 0건 수집**한다.
따라서 **베이스라인 제외 시 코드 기인 실패 0건**이고, plan 이 주장한 `1780/1780` 은 실측으로 확인됐다.

> `node --test scripts/*.test.mjs`(49/49)·`check-doc-inventory`(차이 0)는 이번 라운드에서
> 재실행하지 않았다 — 본 FAIL 사유(D1·D2)와 무관한 축이고, r2 게이트에서 함께 돌린다. **대리
> 검증이 아니라 미실행임을 명시한다.**

## 위생 검토 (AGENTS.md 변경 시)

해당 없음 — 이번 커밋은 `AGENTS.md` 를 변경하지 않았다(`docs/guides/closed-network-extensions.md`
8줄과 `docs/handoff/**` 만 문서 변경). 키/토큰/이메일/IP 패턴 스캔 대상 없음.

## INDEX 보드 정합성

- 0187 행이 `impl / IMPL_DONE / 다음 = Claude(검증)` 로 정확히 기재돼 있었다 — 형식 정합.
- 본 verify 커밋과 함께 `verify / FAIL r1 / 다음 = 재구현 / 라운드 2` 로 전이한다.
- **재구현 완료 시 `impl / IMPL_DONE / 라운드 2 / 대상 커밋 = 새 SHA` 로 다시 전이해야 한다** —
  전이를 한 번만 하면 보드가 stale 해진다(`docs/handoff/AGENTS.md:80,90`).

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: AC2·AC3 이 **의미(semantic) 목표를 구조적 프록시(structural proxy)로만 검증**하도록
  쓰였다. AC2 는 "요청당 1회" 를 *시그니처 형태*로, AC3 은 "통지 1회" 를 *`Promise.all` 존재와
  호출 지점 수*로 지정했다. 둘 다 **그 형태를 갖추고도 의미가 깨질 수 있는** 기준이다. 실제로
  AC2 는 의미가 깨졌고(D1), AC3 은 형태를 갖췄는데 숫자가 애초에 달성 불가였다(D2).
  → `failure-patterns.md` 에 일반 규칙으로 축적한다.
- **설계 단계 (리스크)**: §리스크가 병렬화를 *probe 독립성* 축으로만 검토하고 **공유 통지 sink**
  축을 보지 않았다. "무엇이 병렬로 도는가" 뿐 아니라 **"그것들이 무엇을 공유하는가"** 를 물어야 했다.
- **구현 단계**: 선조치 경계는 지켰다(신규 의존성 0·IPC 0). 다만 **설계 문장을 주석으로 그대로
  받아썼다** — `api.ts:90-92` 의 *"체인 도중에 grant 가 바뀌지 않으므로"* 는 코드로 확인되지 않은
  전제이고, `login.ts:158-160` 의 *"통지는 루프 뒤에 한 번"* 도 마찬가지다. **검증되지 않은 전제를
  단정형 주석으로 적으면 다음 사람이 그 위에 쌓는다.**
- **검증 단계 — 이번 verify 가 못 본 것**:
  - AC5(창 크롬 DOM 동일성)는 **기계 판정하지 않았다.** 클래스 문자열이 셸로 이동한 것까지만
    확인했고, 렌더 결과 동일성은 사람 몫으로 넘긴다.
  - 폐쇄망 실기(실제 SSO redirect 체인·probe 왕복)는 이 환경에서 불가하다. D1 의 회귀는
    **단위 테스트로 재현**할 것이므로 실기 없이도 잠기지만, 실환경 SSO 왕복 자체는 미검증이다.
  - `scripts/*.test.mjs`·`check-doc-inventory` 미실행(위 §게이트에 명시).
  - **D1 의 노출 폭을 정량화하지 않았다** — 실제로 몇 번의 사용자 조작이 이 창에 들어가는지는
    측정하지 않았고, "진행 중 요청 한 건의 남은 홉(≤5)" 이라는 상한만 근거로 삼았다.

## [FAIL 시] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **D1 (AC2)** — `Carrier` 가 snapshot 한 grant 가 체인 도중 바뀌었는지를 **다음 홉 전송 직전**에
      확인한다. **carrier 종류마다 검사가 다르다**(변경 전 의미를 그대로 복원하기 위해):
      `session` = grant **identity 만**(변경 전에도 홉마다 `expiresAt` 을 보지 않았다),
      `value` = identity **+ expiry**. vault 접근 0회의 메모리 판정이어야 한다 — AC1·AC2 의 성능
      목표를 되돌리지 않는다. `api.ts:90-92` 주석을 사실로 교체.
- [ ] **D2 (AC3)** — **코드를 바꾸지 않는다.** `login.ts:158-160` 주석만 사실로 교체한다
      (sweep 완료 통지 1회 + 401/403 즉시 통지 K회, 변경 전 `N + K` 보다 항상 적다).
- [ ] **D3** — 동시성/배칭 회귀 테스트 3건. ③은 **실제 `ProviderApiImpl`** 로 배선해야 의미가 있고,
      **병렬성을 구조적 프록시가 아닌 관측으로** 증명해야 한다(deferred fetch 로 `started === 3`).
      `markExpired` 호출 횟수는 단언하지 않는다 — provider 당 2회(최대 6회)가 정상이다
      (`api.request` 401 처리 + `reprobe` 의 `probeOk` false, 두 번째는 조기 return).
- [ ] **D4** — `providerRows.test.ts:66-67` 중복 단언 제거.
- [ ] **D5** — 이월(비차단).

> 미해결 문제는 plan 의 **"파생 이슈 (Derived Issues)"** 챕터로 이관했다 — 다음 구현 턴이 그
> 챕터에서 이어간다.

## 결론 / 다음 단계

- 상태: **FAIL (r1)** — 인수 13 ✅ / 2 ⚠️ / 1 ❌.
- **FAIL 사유는 D1 하나다.** AC3(D2)은 기준 결함이라 코드 변경을 요구하지 않고, AC5 는 사람 실기
  대기이지 미충족이 아니다.
- 이 PR 의 방향은 유지한다 — 성능 개선(AC1·AC2·AC4)·중복 제거(AC5~AC9)·authority 정리(AC10·AC11)는
  실측으로 확인됐고 되돌릴 이유가 없다. **되돌릴 것은 최적화가 아니라, 최적화가 함께 지웠던
  grant lifecycle 의 차단 의미 하나다.**
- 다음: **Claude 재구현 (라운드 2)** — plan §파생 이슈 챕터 기준.
