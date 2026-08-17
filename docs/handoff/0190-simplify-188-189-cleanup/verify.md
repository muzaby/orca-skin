# Verify — 0190-simplify-188-189-cleanup

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
>
> **이 문서는 r2 검증이다.** r1 검증(FAIL) 전문은 [부록 — r1 검증 (FAIL)](#부록--r1-검증-fail)
> 에 그대로 보존한다 — 판정을 조용히 덮지 않는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0190-simplify-188-189-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-08-17 |
| 대상 커밋/range | `8bbd595..55d1ed1` — 구현 `f61c30c`(S1·S5 + 안전망) · `017daee`(S6·S7), 보고 `55d1ed1` |
| 구현 전 plan 기준 | `476f12b` (r1 verify 커밋) |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | **예 — 설계·구현·검증 전부 Claude.** §0 기준선 잠금 + 전 항목 재측정 + §4 의 적대 실험 2건으로 자기 증명을 막았다 |

**한 줄 판정**: r1 FAIL 사유(AC10 미충족 · AC9 4/7 이월)가 닫혔다. AC **✅ 18 · ⚠️ 1 · ❌ 0**,
r2 강제 지점 **13/13**, r1 강제 지점 **25/25 재측정 유지**, 기준 밖 중대 결함 **0**. 남은 ⚠️ 1건은
AC10 이 원인 대신 적은 **대리 지표** 절이고 구현자가 그것을 충족으로 세지 않았다.

---

## 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립하는가**: **예.** 구현 커밋 `f61c30c`·`017daee` 는 **코드만** 건드렸고
  (`git show --stat` — `store.ts`·`store.test.ts`·`login.ts` 3파일), `plan.md` 변경은 구현
  **이후** 별도 커밋 `55d1ed1` 이다. 채점 기준은 구현 전 상태에서 잠긴다.
- **AC 변경: 있다 — AC8 → AC8a·AC8b·AC8c 분할.** 근거는 이 문서 r1 의 파생 이슈 **D2**
  (AC8 이 ACTIVE Decision D-005 와 모순이라는 plan 결함 판정)이고, D2 가 제시한 두 해법 중
  "세 갈래로 갈라 재작성" 을 그대로 택했다. **구현자가 자기 산출에 맞춰 임의로 완화한 것이 아니다.**
  - 다만 **분할이 채점을 유리하게 바꿨다는 사실은 명시한다** — 분모가 17→19 로 늘고 r1 의
    ⚠️ 1건이 ✅ 3건이 됐다. 구현자가 "r1 의 `14/17` 과 직접 빼서 비교하지 말라" 고 먼저 적었고,
    이 문서도 **r1 과 r2 의 합계를 비교하지 않는다**. 실질 변화는 AC8 자체가 아니라 S1·S5~S7 이다.
- **Decision Ledger 변경: 없음.** D-001~D-009 원문 유지, SUPERSEDED 0.
- **Product/UX Contract 변경: 없음.** §5·§6 무변경.
- **채점 기준**: `476f12b` 시점 AC + D2 가 승인한 AC8 분할.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 | 판정 |
|---|---|---|
| D-001·D-002·D-003 (품질만, 관측 불변) | wire·renderer·i18n 무변경 | ✅ `git diff --name-only 9fe21e8..HEAD -- src/shared/ipc.ts src/renderer src/shared/i18n` → **0 파일**(전체 range 47 파일 중) |
| D-004~D-009 | r1 에서 충족, r2 가 건드리지 않는 표면 | ✅ r2 diff 는 `features/auth/` 2파일 + 신규 테스트뿐 |

### end-to-end 흐름 (r2 가 바꾼 축)

```text
로그인/재인증  → LoginService.settleGrant → AuthStore.put        → entry{grant,verified,revision+1,expirySettled=false}
401 관측      → AuthenticatedRequester(revisionAtSend) → markExpired(authId, observed) → settleExpired
시계 경과      → snapshot 경로 → settleExpiry → settleExpired     → AuthChange(credential-effective)
해제          → AuthStore.revoke → persist 성공 시에만 grant 비움 + revision+1 (**항목은 남는다**)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 (이번 턴 재현) |
|---|---|---|
| 해제 후 세대 단조가 실제로 지켜지는가 | **지켜진다 — 그리고 이것이 production 불변식이다** | `authenticated-request.ts:150` 이 send 시점 `credentialRevision` 을 읽어 `markExpired(authId, observed)` 에 넘긴다. 세대가 해제로 0 이 되면 **해제 전에 나간 요청의 401 이 재로그인한 새 grant 를 만료로 내린다**. `revoke` 는 `entry.grant = undefined` + `revision += 1` 로 항목을 남긴다 |
| 그 위험이 그물에 걸리는가 | **걸린다 (적대 실험)** | `revoke` 를 `this.entries.delete(authId)` 로 **직접 바꿔 실행**했더니 `store.test.ts` 가 `1 failed | 11 passed` — 회귀 테스트가 실제로 잡는다. 실험 후 트리 복원 확인 |
| `markExpired`·`settleExpiry` 가 동치인가 | **동치** | 옛 `verified.delete()` 반환값 = 새 `entry.verified` 읽고 내리기. 정착 조기 반환 위치·`unverified` 만 flush 하는 갈래·`expiresAt` 미래일 때만 now 로 못 박는 규칙 전부 순서 그대로. `settleExpired` 는 옛 두 꼬리(`expirySettled` set · `verified` 해제 · bump · flush)의 합집합이고 두 입구 모두 그것만 호출한다 |
| 부분 실패 잔여 | **없음** | `revoke` 는 `persist` 성공 전에는 항목을 **하나도** 건드리지 않는다(fail-closed 유지, characterization 이 단언). `put` 은 이전과 같이 durable 여부와 무관하게 메모리를 갱신하고 그 사실을 반환한다 — 변경 없음 |
| false success 가능성 | **없음** | `isVerified` 가 `entry.verified && entry.grant !== undefined` 로 grant 동반을 유지한다. 해제된 항목은 `verified=false` 라 게이트가 열리지 않는다 |
| `entry()` 가 읽기 경로에 새는가 | **아니다** | 쓰기 진입은 `restore`·`put` 2곳뿐(`rg 'this.entry('` → 2). 읽기 12곳 전부 `this.entries.get()` |
| 상한 / 누수 | **무시 가능** | 항목은 해제 후에도 남지만 키는 **선언된 authId** 집합에 묶이고 `restore` 가 부팅마다 비운다 |
| 관측 가능한 부수 차이 | **1건, 무해** | 해제 후 재로그인한 authId 의 영속 레코드 **키 순서**가 달라질 수 있다(옛 코드는 map 재삽입 = 끝으로, 새 코드는 원래 자리 유지). `records()` 소비자는 JSON 객체를 키로 읽으므로 의미 영향 없음 |
| Product/UX 의 A 대신 B | **아니다** | 관측 표면 diff 0 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 8bbd595..HEAD
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | **없음** | 스크립트 1a 공란. `AuthEntry` 는 **export 하지 않았다** — 자료구조 통합이 파일 밖으로 새지 않는다 |
| `createMemoryGrantPersistence` 테스트 전용(참조 46회) | **기존 상태 유지** | r1 에서 이미 판정한 항목 — 프로덕션 폴백은 `store-file.ts` 내부이고 r1 이 틀린 주석을 정정했다. r2 는 참조 수만 늘렸다 |
| 형제 정책 비대칭 | **없음** | 스크립트 3 공란 |
| `settleExpired`·`secretCandidate`·`absorbToken` 미배선 | **전부 배선** | 각각 프로덕션 호출 2·2·1, 테스트 전용 심볼 아님 |
| 같은 규칙의 5번째 도출 지점 | **없음** | `vaultKeysOf` 프로덕션 호출 **4/4** 그대로(store 2 · login 2) — store 재작성이 도출을 새로 만들지 않았다 |
| producer↔consumer 파생 불일치 | **없음** | `records()` 가 영속의 유일한 생산자(`put`·`revoke`·`flush` 3 호출자)이고 grant 없는 항목을 일관되게 뺀다 |

## 4. 기존 테스트 / semantic 검증 확인

**구현 보고를 증거로 쓰지 않았다.** 두 가지를 직접 실행해 확인했다.

1. **characterization 이 정말 "구현 전 동작" 을 고정하는가** — `store.test.ts` 를
   **리팩토링 전 `store.ts`**(`f61c30c~1`) 위에 그대로 올려 실행: **12 passed (12)**.
   즉 이 파일은 새 구현에 맞춰 쓴 사후 테스트가 아니라 옛 코드에서도 성립하는 계약이다.
   (실행 후 `git checkout` 으로 트리 복원 확인.)
2. **그물이 실제로 잡는가** — §2 의 `entries.delete()` 변이 주입에서 **1 failed**.
   "테스트가 있다" 와 "테스트가 이 불변식을 잠근다" 를 분리해 확인했다.

- 기존 테스트 파일은 **한 줄도 수정되지 않았다**(r2 diff = `store.ts`·`login.ts`·신규
  `store.test.ts`). `runtime.test.ts`·`login.test.ts`·`gate.test.ts` 가 무수정으로 green —
  AC9 의 "신규 단언 없이 기존 테스트 green" 이 문자 그대로 성립한다.
- structural proxy 만으로 통과시킨 AC: **없음.** AC10 의 "쓰기 횟수" 절은 proxy 인데 구현자가
  ✅ 로 세지 않았고 이 문서도 그렇게 채점한다(§5).

## 5. 요구사항 충족 매트릭스

**독립 재측정. 자기보고는 대조의 출발점으로만 썼다.**

| # | 기준 | 결과 | 검증 증거 (이번 턴 재현) |
|---|---|---|---|
| AC1~AC7 | 효율·재사용 7건 | ✅ | r2 diff 가 그 표면 **0 파일**. r1 재측정 유지(§7 숫자 재확인) |
| AC8a | 아무도 선언하지 않은 심볼 제거 | ✅ | `rg mergeEnvLayers app/src` **0** · `prepared-config.ts` 부재 |
| AC8b | 문서화된 배포 확장점 유지 | ✅ | `PluginBinding.server`·`harnessModelProviderKey` 존재, D-005 와 정합 |
| AC8c | 테스트의 유일한 관측 창 유지 | ✅ | `AuthSnapshot.credentialRevision` 유지(`contracts/auth.ts:278`) + `runtime.test.ts` green |
| AC9 | 단순화 7건(S1·S3·S5·S6·S7·S9·S12) 후 관측 동작 불변 | ✅ | **7/7 적용.** r2 = S1(`entries`)·S5(`settleExpired`)·S6(`secretCandidate`)·S7(`absorb` 108→59). r1 = S3·S9·S12 (`respawn-inputs.ts` 프로덕션 2 호출 · `evaluateGate` 진리표 · 재사용 치환) 재확인. 기존 테스트 무수정 green |
| AC10 | authId 축 상태가 **한 자료구조** | ⚠️ **부분(비차단)** | 1절 **충족** — `rg 'this\.(grants\|verified\|revisions\|expirySettled)' store.ts` → **0**, 통합 전 동일 파일에서 **36 occurrence / 18 write site**. 2절("mutator 별 쓰기 횟수가 준다")은 **6 mutator 중 3 감소**(restore 5→2 · markExpired 4→2 · settleExpiry 3→0), `put`·`revoke`·`markVerified` 불변, 총 write site **18→17**. 대리 지표 절이므로 ✅ 로 세지 않는다 |
| AC11 | 배포가 인증 lifecycle 도달 불가 | ✅ | `auth: AuthBinder` **4/4** · `@ts-expect-error` **6** · typecheck green(미사용 directive 는 그 자체가 TS 오류) |
| AC12~AC15 | adapters 경계 · characterization · 레시피 정본 · 드리프트 | ✅ | lint boundaries **0 error**, r2 가 해당 파일 무변경 |
| AC16 | wire·UI 계약 불변 | ✅ | `ipc.ts`·`renderer`·`i18n` **0 파일**(range `9fe21e8..HEAD`) |
| AC17 | 게이트 green | ✅ | §9 |

**독립 채점: ✅ 18 · ⚠️ 1 · ❌ 0 (분모 19).** 검산: `18 + 1 + 0 = 19` ✓ — 구현자 자기보고
`18/19` 와 일치한다(0187 r1·0189 r1·0190 r1 세 라운드 연속이던 **합계 불일치가 이번에 끊겼다**).

### plan §10 강제 지점 표 — AC 와 별개로 걷는다

**r2 표 (라운드 2 신설 4행):**

| 계약 | plan 지점 | 코드 확인 | 결과 |
|---|---|---|---|
| authId 축은 한 자료구조 | ①restore ②entry ③markVerified ④put ⑤revoke ⑥markExpired ⑦settleExpiry (7) | 7 mutator 전부 `entries` 만 만진다. 옛 네 이름의 `this.` 참조 **0** | **7/7** ✅ |
| 해제 후에도 세대가 남는다 | ①revoke 구현 ②회귀 테스트 (2) | `store.ts:303-306` 항목 유지 + `revision += 1`; 테스트는 **변이 주입으로 실효성 확인**(§4) | **2/2** ✅ |
| 만료 정착 꼬리는 한 곳 | ①markExpired ②settleExpiry (2) | `rg settleExpired store.ts` → 정의 1(`:393`) + 호출 2(`:384`·`:438`) | **2/2** ✅ |
| secret grant 조립은 한 곳 | ①runCredential ②absorb.secret (2) | `secretCandidate` 정의 1(`:523`) + 호출 2(`:590`·`:692`) | **2/2** ✅ |

**r1 표 7행 재측정**: `vaultKeysOf` 4/4 · `auth: AuthBinder` 4/4 · `@ts-expect-error` 6 ·
`adapters→features` import 0 + lint 0 error · wire 0 파일 — **25/25 유지**. store 재작성이
그중 vault 키 축을 지나가므로 그 행은 특히 다시 셌다.

**표에 없는데 같은 불변식이 필요한 지점**: 없음. 세대를 올리는 자리는 `put`·`revoke`·
`settleExpired` 3곳뿐이고(`rg 'revision += 1'` → 3), 셋 다 표가 덮는다.

## 6. 외부 포트 / 문서 계약

r2 는 외부 구현 포트를 건드리지 않는다(`app/deployment/*`·가이드 diff 0). r1 판정 유지.
`AuthStore` 는 feature 내부 클래스이고 `AuthEntry` 는 비-export 라 계약 표면 증가가 없다.

## 7. 숫자 / 음성 기준 / 상한 재측정

| 주장 | 재측정 | 결과 |
|---|---|---|
| authId 축 자료구조 4 → 1 | 옛 파일 `this.(grants\|verified\|revisions\|expirySettled)` = 4종, 새 파일 0 | **일치** |
| 상태 쓰기 18 → 17 | 옛 write site 18(직접 셈: `.set/.add/.delete/.clear` 18줄), 새 17 | **일치** |
| `absorb` 108 → 59 | 함수 블록 줄 수 실측 | **일치** |
| 테스트 158 파일 / 1,575 케이스 | §9 실행 | **일치** |
| 착수 전 대비 +1 파일 / +12 케이스 | r1 검증 실측 157/1,563 → 158/1,575 | **일치** |
| red 5 파일 / 42 케이스 | 문서화된 5파일만 지정 재실행 → `5 failed (5)` · `42 failed \| 1 passed (43)` | **집합 일치** |

- **내역 합 = 총계**: ✅18 + ⚠️1 = 19 = AC 총수. 일치.
- **0건 게이트가 정당한 것을 지웠는가**: 아니다. 통합이 지운 것은 **자료구조 이름**이고
  전이 자체(`verified` 해제 시점 · 정착 idempotency · fail-closed)는 characterization 12건이 붙들고 있다.
- **재현 명령 정밀도 2건이 문자 그대로는 재현되지 않는다** — 결론은 옳고 표기가 헐겁다(§13 D5).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 | 남은 실기 |
|---|---|---|
| `AuthStore` 상태 전이 | electron 비의존 — 12건 characterization + 간접 스위트 전건 | 없음 |
| `LoginService` secret/token 조립 | `login.test.ts` 무수정 green | 없음 |
| Electron 부팅 · 실제 로그인 왕복 | 이 환경 불가(better-sqlite3/electron 바이너리 부재) | **남는다** — CI/사람 |

“UI/electron 이라서” 로 넘긴 순수 로직은 **없다**.

## 9. 게이트 재실행

`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 를 정본으로 따랐다. `npm test` 는
쓰지 않았다(ABI 를 뒤집고, DB 동작 검증이 필요한 변경이 아니다).

```bash
cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci   # fresh clone — node_modules 부재
npm run typecheck && npm run lint
./node_modules/.bin/vitest run src/main src/shared
node scripts/check-doc-inventory.mjs --check
```

| 명령 | 관측한 산출 (exit code 아님) |
|---|---|
| `typecheck` | node·web·test **3분할 전부 error 0** |
| `lint` | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`(renderer, 이번 diff renderer 0 파일 = 베이스라인) |
| `vitest run src/main src/shared` | **158 파일 중 153 통과 · 1,575 케이스 중 1,533 통과** |
| `check-doc-inventory --check` | counts ok(9 items · 76 channels) · prose ok · links ok |

- **환경 기인 실패 분리 — 집합으로 증명.** `app/AGENTS.md` 가 열거한 5파일만 지정 재실행 →
  `Test Files 5 failed (5)` · `Tests 42 failed | 1 passed (43)` 로 전체 실행 실패 수와 **정확히 일치**.
  서명 `Module did not self-register: better_sqlite3.node`.
- **게이트가 트리를 바꿨는가**: 아니다. `lint`(`--fix`) 실행 전후 `git status --porcelain` 동일.
- **검증 중 실행한 명령의 잔여물**: `npm ci` 의 `app/node_modules`(gitignore, 추적 0) ·
  §4 의 두 실험은 `git checkout` 으로 복원해 **추적 파일 변경 0** 을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 · AC ↔ production path · 레이어/문서 링크 | 에이전트 완료 |
| characterization 실효성(변이 주입) | 에이전트 완료 |
| Electron 실기 · PR 머지 | 사람/CI |

## 11. Repository operation checks

- **INDEX 보드**: 단계 `impl` · 상태 `IMPL_DONE (r2)` · 다음 주체 `Claude(검증)` · 대상 커밋
  `f61c30c`·`017daee` 포함 — 검증 착수 시점과 일치. ✅ (PASS 이므로 이 턴에 archive 로 이동한다.)
- **trailer**: 두 구현 커밋 모두 `Agent: claude` · `Handoff: docs/handoff/0190-…/` ·
  `Status: implemented` · `Verified-By: pending`, 블록 내부 빈 줄 없음 — root `AGENTS.md` 허용값과 일치. ✅
  (`Criteria-Met` 이 분수 대신 `AC10 · AC9(S1·S5)` 형태인 커밋이 2건 — `docs/git-template.md` 의
  예시 형식과 다르지만 보고 커밋 `55d1ed1` 이 `18/19` 로 총계를 준다. 비차단.)
- **AGENTS.md 위생**: 이번 range 는 `AGENTS.md` 를 건드리지 않았다 — 해당 없음.
- **죽은 참조**: r1 D3 의 `55cdbfe` 가 `8bbd595` 로 정정됨을 확인(`rg 55cdbfe docs/` → 0건).
- **파일 이동/삭제**: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 코멘트 | 검증자 판단 |
|---|---|
| 해제를 `entries.delete()` 로 옮기면 세대가 되돌아간다 | **타당하고 실측으로 확인했다**(§2·§4). 이 라운드의 핵심 위험을 정확히 짚었다 |
| `entry()` 를 쓰기 전용으로 둔다 | **타당.** 읽기 12곳 전부 `get()` — 조회가 항목을 만들지 않는다 |
| `markExpired` 의 `unverified` 의미 보존 | **타당.** 옛 `Set.delete()` 반환값과 동치 |
| `store.test.ts` 신규가 AC9 를 깨지 않는다 | **타당.** 기존 단언 무수정 + 리팩토링 **전** 코드에서 12/12 green 을 검증자가 직접 재현 |
| AC10 2절을 ✅ 로 세지 않음 | **타당하고 이 문서도 같게 채점한다.** 대리 지표를 충족으로 세지 않은 판단이 옳다 |
| AC8 분할(설계자 권한) | **수용 — r1 D2 가 지시한 해법이다.** 단 분모 변화의 채점 효과를 §0 에 명시했다 |

## 13. 파생 이슈 (비차단 — PASS 를 뒤집지 않는다)

- [ ] **D5 — 자기보고의 재현 명령 2건이 문자 그대로는 재현되지 않는다.**
  ① "통합 전 `rg 'this\.(grants\|verified\|revisions\|expirySettled)'` → 18건" 은 실제로 **36 occurrence
  / 34 줄**이고, 18 은 `.set/.add/.delete/.clear` 로 좁힌 **쓰기 지점** 수다.
  ② "`rg \"kind: 'secret'\" login.ts` → 1건" 은 실제 **2건**(`:41` 은 `AuthResult` 유니언 타입 선언,
  조립부는 `:534` 하나). **두 주장 모두 결론은 옳다** — 어긋난 것은 명령과 숫자의 짝이다.
  다음 라운드가 그 명령을 그대로 붙여 넣으면 다른 수를 본다.
- [ ] **D6 — AC10 문구가 원인 대신 대리 지표를 적었다 (plan 결함, 이번엔 무해).**
  "mutator 별 쓰기 횟수가 준다" 는 목표가 아니라 목표의 부작용이다. 실제 목표("동기화를 강제하는
  것이 없다")는 충족됐고 `put`·`revoke` 가 여전히 네 필드를 쓰는 것은 **그 전이가 원래 네 축을 다
  바꾸기 때문**이다. AC 를 쓸 때 지표가 아니라 불변식을 적어야 한다는 사례로 남긴다.

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상**: **아니다.** r1 은 범위 미완(이월)이었고 r2 는 그 이월을 닫았다.
  같은 불변식이 다시 올라온 것이 아니다.
- **자기보고 합계 불일치**: 0187 r1 · 0189 r1 · 0190 r1 세 라운드 연속이었고 **이번에 끊겼다**
  (`18/19`, 검증자 재측정과 일치). 구현자가 표에 개수 열과 합계 검산 줄을 추가했고, 그 검산에서
  분모 변화(17→19)를 스스로 잡았다.
- **관련 plan 지침/AC 존재**: `handoff-impl §8` 은 행별 관측값을 요구하지만 **합계 검산 항목이
  없다**(검증자 쪽 `handoff-verify §7` 에만 있다). 이번에는 구현자가 자발적으로 보완했다.
  AC 를 갈라 분모가 바뀌는 경우의 보고 규칙도 어느 지침에도 없다. — **사실만 적고 분류는 review 몫.**
- **사용자 결정 변경 근거**: D1 의 두 갈래 중 **ⓑ(이번 라운드 구현)** 를 사용자가 골랐다.
  Decision Ledger 변경은 없다.
- **반복된 검증 환경 한계**: better-sqlite3 / electron 바이너리 부재로 5스위트 상시 red — 이번에도
  집합 일치로 분리했다. **네 라운드 연속 같은 한계**다.

## 15. 결론

- **상태: PASS (라운드 2)**
- **Product/UX 및 ACTIVE Decision**: 충족. 사용자 관측 변화 0(wire·renderer·i18n 0 파일),
  D-001~D-009 전부 보존.
- **AC: ✅ 18 · ⚠️ 1 · ❌ 0.** 남은 ⚠️ 는 AC 문구가 적은 대리 지표이고 실제 불변식은 충족됐다.
- **강제 지점: r2 13/13 · r1 25/25 재측정 유지.**
- **기준 밖 중대 결함: 없음.** 이번 라운드에서 가장 위험한 자리(해제 시 세대 되돌림)는 코드로
  막혔고 **변이 주입으로 그물의 실효성까지 확인**했다.
- **남은 사람 확인**: Electron 부팅·실제 로그인 왕복(CI/사람). 코드 판정에 남은 것은 없다.
- **다음 단계**: 0190 종료. INDEX 행을 archive history 로 옮긴다. D5·D6 은 비차단 기록이다.

---

# 부록 — r1 검증 (FAIL)


> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

### 메타

| 항목 | 값 |
|---|---|
| slug | `0190-simplify-188-189-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-08-17 |
| 대상 커밋/range | `9fe21e8..c8fe300` (구현 4커밋: `0283dc4` · `6b63b49` · `ddebfcf` · `8bbd595`) |
| 구현 전 plan 기준 | `9fe21e8` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 모두 Claude.** §0 의 기준선 잠금과 전 항목 재측정으로 자기 증명을 막았다 |

### 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립하는가**: **예.** 설계 커밋 `9fe21e8` 이 구현 4커밋과 분리돼 있어
  §0 의 자기 증명 방지 장치가 실제로 작동한다.
- 구현 커밋이 `plan.md` 를 변경했는가: **예, `8bbd595` 하나.** 변경 내용을 전수 확인했다:
  - §5 "상태와 전이" 의 S2 서술을 `[구현 턴 정정]` 인용구로 교체 — **초안 주장을 지운 것이
    아니라 인용해 보존하고 보류 근거를 붙였다.** 기준 완화가 아니다.
  - `[구현자 기입]` 5개 절 추가(설계 리뷰 · 강제 지점 전수 · Product/UX 파생 · 놓친 문제 ·
    구현 보고 · Review Signals). 전부 구현자 소관 surface.
- **AC 변경: 없음.** §7 의 AC 표(AC1~AC17) 는 `git diff 9fe21e8..HEAD` 에서 **한 줄도 바뀌지
  않았다**. 구현자가 자기 산출에 맞춰 기준을 재작성하지 않았다.
- **Decision Ledger 변경: 없음.** D-001~D-009 전부 원문 유지.
- Product/UX Contract 변경: §5 의 위 1건뿐이고 방향이 "보류 = 기준을 더 보수적으로" 다.
- **채점에 사용할 원 기준**: `9fe21e8` 시점의 §7 AC 17건 + Decision Ledger D-001~D-009.

### 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-001 · D-002 · D-003 (품질 항목만, 사용자 관측 불변) | wire·renderer·i18n 무변경 | — | ✅ `git diff --name-only 9fe21e8..HEAD -- src/shared/ipc.ts src/renderer src/shared/i18n` → **0 파일** |
| D-004 (F1 = 타입을 내린다) | `HarnessRuntimeConfig` 가 adapters, 조립부가 그 옆 | `turn-setup.ts` → `adapters/harness-config.ts` | ✅ 타입 하강 + `prepared-config.ts` 삭제 |
| D-005 (배포 빈 factory 유지) | 선언된 확장점 보존 | `app/deployment/*` | ✅ 유지 — **단 AC8 과 충돌한다, §12 D2** |
| D-006 (두 술어 통합 금지) | `crossesProviderBoundary`·`runtimeEnvChangedSinceSpawn` 분리 유지 | `runtime-boundary.ts` | ✅ 둘 다 별도 함수로 생존 |
| D-007 (P3~P6 되돌리지 않음) | 대가형 비용 유지 | — | ✅ 해당 diff 없음 |
| D-008 (레시피 정본 = 가이드) | 소스는 불변식만 | 폐쇄망 배포자 | ✅ AC14·AC15 |
| D-009 (0188 D-017 → SUPERSEDED) | Ledger 정합 | `0188/plan.md` | ✅ 두 행 모두 확인 (아래) |

`0188/plan.md` 실측 — D-017 행 상태 칸 `SUPERSEDED` + 대체 칸에 승계 근거, D-042 행 대체 칸에
`D-017 을 대체 (0190 정리)`. **양방향 표기가 둘 다 있다.**

#### end-to-end 흐름 (b 턴 경로 — 이번 변경의 주 무대)

```text
settings 해석 (HarnessSettingsService.resolve — 내부 blob 참조 안정)
  → HarnessRuntimeConfigService.resolve  (config 객체 cache)
  → adapters/harness-config.prepareHarnessConfig
       · withEnvBlockHoisted → WeakMap memoize
       · harnessEnvFingerprint  ← 계산 1회
       → PreparedHarnessConfig{providerSettings, env, runtimeEnvFingerprint, envFingerprint}
  → send.ts:293 / continuation.ts:91  이 TurnRequest.envFingerprint 를 채운다
  → SessionRuntime.recordSpawn  →  req.envFingerprint ?? 재계산
  → respawnInputs → runtime-boundary 술어 3종 → decideRespawn
```

### 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| memoize 가 판정 fast path 를 실제로 복원하는가 | **한다** | 술어는 **외피가 아니라 내부 blob** 을 본다(`spawned.settings === resolved.settings`, `runtime-boundary.ts:24`). `withoutEnvBlock` 이 내부 blob 을 키로 캐시하므로 `HarnessSettingsService.resolve` 가 cache hit 마다 **새 외피 객체**를 만들어도(`settings.ts` 실측) `next.settings` 는 같은 참조다. 두 층 캐시가 둘 다 필요하고 둘 다 맞다 |
| E1 이 spawn 기록 축을 망가뜨리는가 | **아니다 — 구현이 설계 결함을 잡았다** | plan §9 TO-BE 는 `runtimeEnvFingerprint`(해석 실패 시 `undefined`)를 실으라고 적혀 있었다. 그대로 했다면 `spawnedFingerprint === undefined` 가 되어 `runtimeEnvChangedSinceSpawn` 이 **영구 no-op** — 해석 실패 턴에 뜬 채널이 이후 어떤 env 변화에도 respawn 하지 않는다. `envFingerprint`(항상 정의)를 분리해 막았고 회귀 2건이 고정한다. **선조치 후 보고로 올바른 갈래** |
| false success 가능성 | **없음** | `env` 는 얕은 복사로 넘어가고 fingerprint 는 키 정렬 후 접으므로 두 값이 어긋날 수 없다. 회귀 `env 얕은 복사본의 fingerprint 가 원본과 같다` 가 이것을 단언 |
| 최적화가 재검증/취소/만료 관측을 잃었는가 | **아니다** | E1~E3 는 전부 *중복 계산* 제거다. E3 는 `describe()` 가 호출마다 `methods.map(methodDescriptor)` + `fields.map(f=>({...f}))` 로 **새로 할당**하므로(`runtime.ts:57,211` 실측) 재복사를 지워도 공유 상태 aliasing 이 생기지 않는다 |
| 증상만 지우고 상태가 남았는가 | **아니다** | R2 는 도출을 합칠 뿐 vault 쓰기 순서를 건드리지 않는다 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | **아니다** | 관측 표면 diff 0 |
| 출력/요청 worst-case 상한 | **증가 없음** | 전부 제거형. memoize 는 `WeakMap` 이라 상한이 원본 blob 수명에 묶인다 |

### 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9fe21e8..HEAD
```

| 후보 | 판정 | 근거 |
|---|---|---|
| `adjustedSettingsCache`(외피 WeakMap)가 죽은 캐시인가 | **정상** | augmenter 재해석 턴에는 외피가 새로 오지만 정적/캐시 턴에는 `HarnessRuntimeConfigService` 가 **같은 config 객체**를 돌려주므로(`runtime-config.ts` `cached.config`) 외피 캐시도 실제로 hit 한다. 두 층 모두 세입자가 있다 |
| `createMemoryGrantPersistence` 테스트 전용 | **정상 + 주석 정정됨** | 구현자가 "영속 없이도 앱은 뜬다" 라는 **틀린 주석**을 실측으로 정정했다(실제 폴백은 `store-file.ts` 내부). 코드가 아니라 사실 기술이 문제였고 그것을 고쳤다 |
| 배포 factory·deps 타입 테스트 전용 | **정상** | D-005 가 보호하는 **선언된 배포 확장점**. 기본 빌드가 비어 있는 것이 설계 |
| `respawn-inputs.ts` 신규 — 프로덕션 배선 | **배선됨** | `runtime-entry.ts`(최초 턴)·`chat-turn-continuation.ts`(연속 턴) **양쪽**이 호출한다. 테스트 전용 아님 |
| 형제 정책 비대칭 (최초 턴 ↔ 연속 턴) | **해소됨** | 이 변경의 목적이 그것이다 — 7필드를 손으로 두 벌 적던 것을 한 함수로. 다음 축 추가 시 한쪽만 갱신되는 회귀가 구조적으로 막힌다 |
| `vaultKeysOf` producer↔consumer 파생 불일치 | **없음** | sweep("살아 있다")과 delete("지운다")가 **같은 함수**를 쓴다. 이 구간 최고 위험 항목이 실제로 닫혔다 |
| 동일 규칙 중복 (`AUTH_KINDS`) | **SSOT 로 수렴** | `ProviderAuthKindSchema` 하나. 값 5개 동일 확인(`api-key`·`password`·`pat`·`oauth`·`browser-session`) |
| `evaluateGate` 진리표 변화 | **동치** | 이전 `(alwaysRequired‖blocked)‖members>0`, 이후 `alwaysRequired‖blocked‖members>0`. 호출자는 `createGate` 1곳뿐(전수 `rg`)이고 `blocked` 의 `passed` 게이팅은 그대로 |

### 4. 기존 테스트 / semantic 검증 확인

- **structural proxy 만으로 통과시킨 AC: 없음.**
  - AC11 은 `@ts-expect-error` **6건**이고, `tsconfig.test.json` 이 `src/main/**` 를 포함하므로
    컴파일러가 강제한다. **미사용 `@ts-expect-error` 는 그 자체가 TS 오류**이므로 typecheck
    green 은 "그 호출들이 실제로 컴파일 실패한다" 를 뜻한다 — 구조적 사실이 아니라 능력 폐쇄의 증거다.
  - AC14 의 "```ts 0건" 은 proxy 지만 의미 목표(가이드에 대응 절 존재)를 §6 에서 따로 확인했다.
- AC1 의 `N회` 관측 주체: 지점 grep 이 아니라 **`prepareHarnessConfig` 안의 계산 1회 + sink 폴백**
  구조로 센다. 프로덕션 `harnessEnvFingerprint` 호출은 정의 1 + 호출 2(계산 1 · 폴백 1)뿐이고
  폴백은 `req.envFingerprint` 부재 시에만 실행된다 — 주입 경로에서는 도달하지 않는다.
- plan 이 인용한 기존 테스트 실제 존재: `connection-views.test.ts` **8건**, gate 스위트, `runtime.test.ts` 전건 green.

### 5. 요구사항 충족 매트릭스

**독립 재측정 결과. 구현자 자기보고를 증거로 쓰지 않았다.**

| # | 기준 | 결과 | 검증 증거 (이번 턴 재현) |
|---|---|---|---|
| AC1 | fingerprint spawn 당 1회 | ✅ | `rg harnessEnvFingerprint src/main` → 정의 1 + 프로덕션 호출 2(계산·폴백). 채우는 지점 `send.ts:293`·`continuation.ts:91` 실측 |
| AC2 | 전달값 == 재계산값 | ✅ | `session-runtime.ts:355` `req.envFingerprint ?? harnessEnvFingerprint(req.env)`. 회귀 `env 얕은 복사본의 fingerprint 가 원본과 같다` |
| AC3 | 같은 입력 = 같은 참조 + 술어 false | ✅ | `harness-config.test.ts` §`같은 입력이면 같은 참조를 돌려준다` 4건 (`Object.is`). 내부 blob 캐시가 술어 fast path 를 실제로 먹인다(§2) |
| AC4 | 실제로 바뀐 턴은 여전히 true | ✅ | `원본 blob 이 다르면 다른 참조를 준다` |
| AC5 | `ProviderInfo.auth` 필드 동치 + 원본 무오염 | ✅ | `describe()` 가 호출마다 신규 할당(`runtime.ts:57·211`) → aliasing 없음. `connection-views.test.ts` 8건 green |
| AC6 | vault 키 도출 한 함수 | ✅ | `vaultKeysOf` 정의 1 + **프로덕션 호출 4/4**(`store.ts:177` sweep · `store.ts:266` delete · `login.ts:517` kept · `login.ts:518` names) + `store-vault-keys.test.ts` 5건 |
| AC7 | 재사용 치환 후 동치 | ✅ | 해당 스위트 전건 green, typecheck 0 |
| AC8 | 프로덕션 호출자 0 심볼 제거 | ⚠️ **부분** | `mergeEnvLayers` `rg`=**0** · `prepared-config` `rg`=**0** (파일 삭제). **3건 잔존**: `credentialRevision`·`PluginBinding.server`·`harnessModelProviderKey`. 잔존 근거는 타당하나 **AC8 자체가 D-005 와 모순**이었다 — §12 D2 |
| AC9 | 단순화 후 관측 동작 불변 | ⚠️ **부분** | AC9 가 열거한 7건(S1·S3·S5·S6·S7·S9·S12) 중 **적용 3(S3·S9·S12) · 이월 4(S1·S5·S6·S7)**. 적용분은 동작 동치 확인(gate 진리표 §3, `login.reauth` 라우팅) |
| AC10 | `AuthStore` authId 축이 한 자료구조 | ❌ **미충족** | `store.ts` 실측 — `grants`(Map:97) · `verified`(Set:103) · `revisions`(Map:117) · `expirySettled`(Set:121) **4개 그대로**. S1 이월 |
| AC11 | 배포가 인증 lifecycle 에 도달 불가 | ✅ | `auth: AuthBinder` **4/4**(`connections:24`·`harness-runtime:48`·`usage-fetcher:23`·`plugins:68`) + `@ts-expect-error` **6건**, 컴파일러 강제(§4) |
| AC12 | 조립부가 adapters + boundaries 통과 | ✅ | `adapters/**` → `features/` import **0건** · `npm run lint` **0 error** |
| AC13 | 두 채널 우선순위 characterization | ✅ | `harness-config.test.ts` §`두 채널 결정표 — characterization (0190 AC13)` 3건 + §`env 우선순위` 4층 순서 단언 |
| AC14 | 레시피 정본 하나 | ✅ | `app/deployment/**` ` ```ts ` **0건**. 가이드에 대응 절 실재(§3-c augmenter `:511` · §5-b usage `:778`) |
| AC15 | 드리프트 3건 정정 | ✅ | 가이드 `secretFor` **0건** · augmenter 예제가 실제 export `createConfigApiAugmenters(deps: HarnessConfigApiDeps)` 와 일치 · usage 매퍼 `toSnapshot` 1가지 |
| AC16 | wire·UI 계약 불변 | ✅ | `ipc.ts`·`renderer`·`i18n` 변경 **0 파일** |
| AC17 | 게이트 green | ✅ | §9 |

**독립 채점: ✅ 14 · ⚠️ 2 · ❌ 1.**

> **구현자 자기보고 산술 오류(과소 보고)**: 보고는 `13/17` 인데 같은 표가 `AC1~AC7 · AC11~AC17`
> = **14건**을 ✅ 로 열거한다. 17 − (부분 2 + 미충족 1) = **14**. 0187 r1·0189 r1 은 과대
> 보고였고 이번은 반대 방향이다 — 어느 쪽이든 내역 합과 총계를 맞추지 않은 같은 형태다.

#### plan §10 강제 지점 표 — AC 와 별개로 걷는다

| 계약 | plan 이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| fingerprint spawn 당 1회 | ①조립 ②spawn 기록 ③`turn-setup`계열 ④`continuation` (4) | ①`harness-config.ts` 계산 1회 ②`session-runtime.ts:355` 폴백 ③`send.ts:293` ④`continuation.ts:91` | **4/4** ✅ |
| 같은 입력 = 같은 참조 | ①memoize ②술어 (2) | ①`harness-config.test.ts` 4건 ②`runtime-boundary.ts:24` fast path 실경로 확인 | **2/2** ✅ |
| 배포는 lifecycle 도달 불가 | ①~④ deps 4종 ⑤부정 테스트 (5) | ①~④ `auth: AuthBinder` 4곳 ⑤`@ts-expect-error` 6건 | **5/5** ✅ |
| `adapters` ↛ `features` | `adapters/**` 전 파일 | import 0건 + lint 0 error | **통과** ✅ |
| Grant → vault 키 한 함수 | ①sweep ②`deleteVaultKeys` ③`discardKeys` kept ④ names (4) | 네 지점 모두 `vaultKeysOf` 호출 | **4/4** ✅ |
| 레시피 정본은 가이드 | ①~⑤ 배포 5파일 ⑥가이드 절 (6) | 5파일 ```ts 0건 + 가이드 §3-c·§5-b 실재 | **6/6** ✅ |
| wire 불변 | ①`ipc.ts` ②renderer ③동치 단언 (3) | 0 파일 · 0 파일 · 8건 green | **3/3** ✅ |

- **표에 없는데 같은 불변식이 필요한 지점**: 없음. 특히 `vaultKeysOf` 는 `rg` 전수로 5번째
  도출 지점이 남아 있지 않음을 확인했다.
- **강제 지점 전수 25/25 — 이 축은 완전하다.** 미충족 3건은 전부 *제거·통합 범위* 쪽이고
  불변식 강제 쪽이 아니다.

### 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `app/deployment/*` deps (배포 구현 포트) | 가이드 §1.1 표가 `AuthBinder` 로 갱신됨 | 가이드 예제가 전부 `deps.auth.bind(...)` 로 시작 → `bind` 하나로 레시피 성립 | ✅ |
| `docs/arch/backend/auth.md` 구조 서술 | `AuthBinder` = `Pick<AuthRuntime,'bind'>` 명시 | lifecycle 소유자(IPC 핸들러·부팅 복원) 명시 | ✅ |

> **plan 의 AC14 전제 1건이 사실과 달랐다(무해).** plan §7 주의사항은 "`usage-fetcher` 예제는
> **가이드에 없던 것**이라 삭제가 아니라 이동이어야 한다" 고 적었다. 실측하면 가이드 `:778`
> 에 0186 부터 `createUsageFetcher` 레시피가 **이미 있었고** 소스 쪽이 드리프트한 사본이었다
> (그래서 plan §8 이 `mapCorpUsageSnapshot`↔`toSnapshot` 을 드리프트로 셌다 — 두 서술이 서로
> 모순이었다). 소스 사본 삭제가 옳고 가이드 쪽이 더 풍부하다. **결과는 맞고 전제가 틀렸다.**

### 7. 숫자 / 음성 기준 / 상한 재측정

- `vaultKeysOf` 호출 **4** — 재측정 일치.
- `auth: AuthBinder` **4** — 재측정 일치.
- `@ts-expect-error` **6** — 재측정 일치.
- `mergeEnvLayers` / `prepared-config` `rg` **0 / 0** — 재측정 일치.
- 가이드 `secretFor` **0** — 재측정 일치.
- 테스트 **157 파일 / 1,563 케이스** — 재측정 일치(§9).
- **내역 합 ≠ 총계 1건**: AC 자기보고 13 vs 실제 14 (§5).
- 0건 게이트가 정당한 예외를 지웠는가: **아니다.** AC14 의 "```ts 0건" 이 지운 것은 전부
  가이드에 대응 절이 있는 사본이고, plan §17 이 남기라고 지정한 불변식 4종(secret 분리 ·
  매핑 소유·fail-closed · 조용한 미인증 금지 · 닫힌 closure)은 `harness-runtime.ts` 주석에
  **명시적으로 보존**됐다.

### 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| respawn 판정 조립 | `respawnInputs` 가 electron 비의존 순수 함수 + 구조적 `SpawnRecord` 라 전부 단위 검증 가능 | 없음 | — |
| spawn 입력 조립·fingerprint | `adapters/harness-config` 가 `node:crypto` 만 물어 vitest 로 전부 열림 | 없음 | — |
| 배포 능력 경계 | 컴파일러가 강제 | 없음 | — |
| Electron 부팅 · 실제 로그인 왕복 | DB·electron 로드 5스위트는 이 환경에서 불가 | **남는다** | 네트워크 개방 환경/CI(windows-latest)에서 `npm run dev` → 로그인 → 연결 탭 확인 |

“UI/electron 이라서” 로 넘긴 순수 로직은 **없다**.

### 9. 게이트 재실행

`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 를 정본으로 따랐다.
`npm test` 는 **쓰지 않았다**(DB 동작 검증이 필요한 변경이 아니고 ABI 를 뒤집는다).

```bash
cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci      # 이 컨테이너는 fresh clone — node_modules 부재
npm run typecheck
npm run lint
./node_modules/.bin/vitest run src/main src/shared
node scripts/check-doc-inventory.mjs --check
```

**관측한 실행 산출 (exit code 아님):**

| 명령 | 관측 |
|---|---|
| `typecheck` | node·web·test **3분할 전부 error 0** |
| `lint` | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`. renderer 파일이고 이번 diff 는 renderer 를 **0 파일** 건드렸다 → 기존 베이스라인 |
| `vitest run src/main src/shared` | **157 파일 중 152 통과 · 1,563 케이스 중 1,521 통과** |
| `check-doc-inventory --check` | counts ok(9 items · 76 channels) · prose ok · links ok |

- **환경 기인 실패 분리 — 추정이 아니라 집합으로 증명했다.** red 5파일 / 42케이스를 그대로
  두지 않고 `app/AGENTS.md` 가 실측으로 열거한 5파일만 지정해 재실행했더니
  **`Test Files 5 failed (5)` · `Tests 42 failed | 1 passed (43)`** — 전체 실행의 실패 수와
  **정확히 일치**한다. 즉 실패 집합 = 문서화된 ABI 베이스라인 집합이고 그 밖의 red 는 0이다.
  서명도 일치: `Module did not self-register: better_sqlite3.node` ·
  `Electron failed to install correctly`.
- **게이트가 작업 트리를 바꿨는가**: **아니다.** `lint` 는 `--fix` 라 파일을 쓰므로
  (`app/AGENTS.md` 경고) 실행 전후 `git status --porcelain` 을 비교했고 **실행 후 트리가 비어
  있다** — autofix 산출물이 0이고, 검증자가 고친 코드를 검증자가 채점하는 일이 없다.
- **검증 중 실행한 명령의 잔여물**: `npm ci` 가 만든 `app/node_modules` (gitignore 대상,
  추적 파일 0). 그 외 없음.

### 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path 1:1 | 에이전트 대조 완료 (§5) |
| 레이어/계약/문서 링크 | 기계 검증 완료 (boundaries · doc-inventory links) |
| AGENTS 위생 | 해당 없음 — 이번 diff 는 `AGENTS.md` 를 건드리지 않았다 |
| **AC10/AC8/AC9 이월을 수용할 것인가** | **사람 결정** — §13 D1 |
| UI 시각 품질 · Electron 실기 | 사람/CI |

### 11. Repository operation checks

#### INDEX 보드 정합성

- 단계 `impl` · 상태 `IMPL_DONE` · 다음 주체 `Claude(검증)` — 검증 착수 시점 상태와 일치. ✅
- 대상 커밋 `9fe21e8`·`0283dc4`·`6b63b49`·`ddebfcf`·`8bbd595` — **git log 와 전부 일치.** ✅
- PASS archive 이동: FAIL 이므로 해당 없음.

#### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff: docs/handoff/0190-.../` ·
  `Status: implemented|partial` · `Criteria-Met`/`Criteria-Pending` · `Verified-By: pending`
  — root `AGENTS.md` 표와 일치하고 trailer 블록 내부 빈 줄 없음. ✅
- 삭제한 `features/harnesses/prepared-config.ts` 의 살아 있는 소비처: **0건** (`rg` 전수). ✅
- **❗ 죽은 커밋 참조 1건**: `plan.md:496`·`:529` 가 `55cdbfe`(3군 단순화)를 가리키는데
  `git cat-file -t 55cdbfe` → `Not a valid object name`. 실제 해시는 **`8bbd595`** 다
  (구현 보고를 그 커밋에 넣으며 amend 된 자기 참조). INDEX 는 옳고 plan 만 낡았다. §13 D3.

### 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| AC1 설계 정정 — `envFingerprint` 신규 필드 분리 | **타당, 그리고 실제 회귀를 막았다.** 구현 세부 갈래(선조치 후 보고)가 맞다. plan §9 TO-BE 가 두 축을 뭉갠 것이 원인 | 수용 |
| R6 미적용(`import/no-cycle` 근거) + 틀린 주석 정정 | **타당.** 순환 근거를 실측으로 확인. 8줄 클로저를 접으려 새 모듈을 만들지 않은 판단도 0188 제안서와 정합 | 수용 |
| `LoginService.reauth` 제거 — `runtime.reauth` 5건이 계약 커버 | **타당.** `AuthRuntime.reauth` → `begin` 라우팅 확인 | 수용 |
| AC8 3건 보류 | **결론 타당, 그러나 AC 쪽 결함이다** — §13 D2 | 파생 이슈 |
| AC9·AC10 이월(위험 배분) | **엔지니어링 판단은 합리적.** 다만 AC 를 못 지킨 것은 사실이고 범위 축소는 결정권자 몫이다 — 구현자가 AC 를 고치지 않고 **보고만** 한 것은 규칙대로다 | **파생 이슈 · 사람 결정** |

### 13. 파생 이슈

- [ ] **D1 — AC10 미충족 (+ AC9 4/7 이월). 사람 결정 필요.**
  `AuthStore` 의 authId 축 4 컬렉션이 그대로다. 이월 근거("0188 이 10라운드로 원자성·만료를
  고친 자리라 같은 커밋에 구조 변경을 얹으면 회귀 원인이 갈리지 않는다")는 **합리적이고
  코드 근거도 맞다**. 그러나 범위를 줄이는 것은 설계자/사용자 결정이다. 두 갈래:
  ⓐ 이월 수용 → AC9·AC10 을 후속 handoff(`0191`)로 옮기고 0190 은 나머지로 종료,
  ⓑ 이번 라운드에서 S1·S5~S7 구현.
  **해결안으로 위장하지 않는다 — 어느 쪽인지 사용자가 정한다.**
- [ ] **D2 — AC8 이 ACTIVE Decision D-005 와 모순이었다 (plan 결함).**
  AC8 은 `PluginBinding.server`·`harnessModelProviderKey` 제거를 요구하는데, D-005 는 "문서화된
  배포 확장점은 지우지 않는다" 를 못 박는다. 구현자는 Decision 을 우선해 보류했고 **그 우선순위가
  옳다**(Decision > AC). 남은 `credentialRevision` 은 성격이 또 달라 — 배포 확장점이 아니라
  **테스트 27건의 유일한 관측 창**이다. AC8 은 성격이 다른 셋을 한 줄에 묶었다.
  → AC8 을 세 갈래로 갈라 재작성하거나, D-005 적용 범위를 AC8 에 명시한다.
- [ ] **D3 — `plan.md:496`·`:529` 의 `55cdbfe` 가 존재하지 않는 커밋.** 실제 `8bbd595`.
  구현 보고의 "대상 커밋" 은 다음 라운드가 기준선을 잡는 좌표라 죽은 참조를 남기지 않는다.
- [ ] **D4 — 자기보고 산술: `13/17` → `14/17`.** 같은 표가 열거한 ✅ 는 14건이다(§5).
  과소 보고라 무해하지만 내역 합과 총계를 맞추지 않은 형태는 0187 r1·0189 r1 과 같다.

### 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상**: 자기보고 `Criteria-Met` 과 실제 채점의 불일치가
  0187 r1(과대) · 0189 r1(과대) · 0190 r1(**과소**) 세 라운드 연속으로 관측된다.
  `handoff-impl` 이 r5 에서 "관측값을 함께 적어라" 를 신설했고 **개별 행의 관측값은 이번에
  실제로 다 붙었다**(강제 지점 25/25 를 검증자가 재측정해 전부 일치). 어긋난 것은 행이
  아니라 **행의 합계**다.
- **관련 plan 지침/AC 존재**: `handoff-verify` §7 이 "내역 합 = 총계인지 본다" 를 갖는다.
  검증자 쪽에는 있고 구현자 쪽 자기보고 절차에는 합계 검산 항목이 없다.
- **plan 자체의 결함이 이번 라운드 미충족의 일부를 만들었다**: AC8 ↔ D-005 모순(D2),
  AC1 의 두 축 혼동(구현자가 잡음), AC14 주의사항의 사실 오류(§6). 세 건 모두 READY
  self-review 체크리스트가 `[x]` 로 통과한 항목 아래에서 났다.
- **사용자 결정 변경 근거**: 없음. 이번 라운드에 Decision 변경 없음.
- **반복된 검증 환경 한계**: better-sqlite3 / electron 바이너리 부재로 5스위트 상시 red.
  이번에는 `npm ci` 가 성공해 나머지 152 파일을 실제로 돌렸고, 실패 집합이 문서화된
  베이스라인과 **집합으로 일치**함을 재실행으로 증명했다.

### 15. 결론

- **상태: FAIL (라운드 1)**
- **Product/UX 및 ACTIVE Decision: 충족.** 사용자 관측 변화 0(wire·renderer·i18n 0 파일),
  D-001~D-009 전부 보존. **제품 위험은 이 라운드에 없다.**
- **AC: ✅ 14 · ⚠️ 2 · ❌ 1.** FAIL 사유는 **AC10 미충족과 AC9 의 4/7 이월** 하나뿐이며,
  성격은 *결함*이 아니라 **범위 미완**이다.
- **강제 지점: 25/25 전부 닫힘.** 불변식 축은 완전하다 — 특히 Grant→vault 키 4지점 통합
  (이 구간 최고 위험 항목)과 배포 능력 폐쇄가 컴파일러/테스트로 실제 강제된다.
- **기준 밖 중대 결함: 없음.** 역방향 탐색에서 미배선·테스트 전용 신규 심볼·형제 비대칭·
  SSOT drift 전부 음성. E1 의 설계 결함은 구현자가 선조치로 막았다.
- **repository operation: 죽은 커밋 참조 1건(D3).** INDEX·trailer·링크는 정합.
- **남은 사람 확인**: ⓐ **D1 의 이월 수용 여부(범위 결정)** ⓑ Electron 실기(CI/사람).
- **다음 단계**: 사용자가 D1 을 정한 뒤 — ⓐ 면 AC9·AC10 을 후속 handoff 로 이관하고 0190 종료,
  ⓑ 면 재구현 라운드 2. D2~D4 는 어느 쪽이든 정리한다.
