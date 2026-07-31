# Verify — 0157-auth-plugin-platform

## 메타

| 항목 | 값 |
|---|---|
| slug | `0157-auth-plugin-platform` |
| 검증자 | Claude Code |
| 일자 | 2026-07-31 |
| 대상 커밋 | `dddfbf1` (설계 `26d66bc`, 골격 `24590c8`) |
| 라운드 | 1 |
| 상태 | **FAIL** |

> 설계·구현·검증을 같은 에이전트가 수행했다(사용자 지시). 자기 검증의 편향을 줄이려고
> **인수 기준 문장을 읽고 코드를 찾는 방향이 아니라, 코드에서 미사용·미검증 표면을 먼저 뽑아**
> 기준과 대조했다. 그 결과 구현 보고가 `Criteria-Met: 16/16` 으로 적은 것과 달리 **4건이
> 미충족**임을 확인했다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §설계 — `features/connectors/registry.ts` 를 connection 레지스트리로 재정의 | **타당.** connector 구현체 등록을 manifest 검증과 한 경로로 묶는 편이 AUTH-PLAT-012 에 맞고, "connector 1 : connection N" 은 실재하는 요구다. 파일 헤더에 이름 혼동 주의가 적혀 있어 추적 가능 | 매트릭스 #5 에 반영(등록 경로 단일화 확인) |
| 이견 §transaction — `runGuarded` 의 abort 선행 체크 | **타당.** 회귀 테스트가 고정돼 있고 부수효과 차단이 실제 이득 | 매트릭스 #9 증거로 채택 |
| 선조치 ✅ #1~#6 | 전부 타당. #4(`BINDING_RE` 서로소 분리)는 `McpStore.authEnvKey` 오인을 실제로 막는다 — 회귀 테스트 확인 | 매트릭스 #10·#11·#15 증거로 채택 |
| 선조치 ⚠️ #7 — Electron per-session WIA allowlist | **타당한 보고만 처리.** 코드가 per-session API 만 쓰고 강등 경로를 주석에 남겼다 | 사람 실기 대기 유지(아래 책임 분리표) |

**구현자 코멘트가 놓친 것**: 위 7건 어디에도 아래 D1~D4 가 없다. 특히 D1 은 구현자가 "선조치"로
잡은 것과 같은 계열(취소·상태 판정의 조용한 오판)인데 발견되지 않았다.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 서로 다른 mechanism provider 2개 동시 등록 + 양쪽 target binding | ✅ | `registry.test.ts:144` "AC1 — …" — `listProviders()` 2개, `providersForTarget('application'/'connector')` 각 2개, mechanism Set size 2 |
| 2 | 5메서드 전부 구현, 미지원은 `not_supported` | ✅ | `contracts/auth-plugin.ts:186-199`(optional 없음) · `registry.ts:114-118`(런타임 재확인) · `conformance.test.ts` 30 pass |
| 3 | 동일 conformance suite 를 built-in 전부에 재적용 | ✅ | `conformance.test.ts:16-73` provider 4종(static×2·adfs·minimal fixture) × 7 케이스. 하네스 자체의 negative 테스트 2건(`:88`,`:113`)이 통과 여부를 신뢰 가능하게 만든다 |
| 4 | binding 결과에 raw secret 타입상 표현 불가 + DTO 스냅샷 무노출 | ✅ | `shared/ipc.ts` `AuthArtifactRef`=handleId only · `broker.test.ts:134` "AC4 —" (`JSON.stringify({bindings,status})` 에 secret 부재, vault 에는 존재) · `:147` 브로드캐스트 스냅샷 |
| 5 | 중복·ABI 불일치 거부, override 불가 | ✅ | `registry.test.ts:62`(중복 시 **첫 등록이 살아남음** 확인) · `:78`(apiVersion) · `:107`(패키지 전체 거부) |
| 6 | 같은 session group = 동일 partition, 다른 group 격리 | ⚠️ **부분** | 재사용 로직은 `broker.test.ts:262` 로 검증(두 target 이 같은 artifact 공유, 창 1회만). **그러나 `partitionFor()`·group 격리 자체는 테스트 0** — `browser-session-store.ts` 전체가 미테스트(electron 의존). 순수 함수 부분은 테스트 가능한데 안 했다 |
| 7 | app cascade vs connector-only disconnect 구분 | ✅ | `bindings.test.ts:44`·`:57` · `broker.test.ts:213`(형제·앱 로그인 잔존) · `:243`(ADFS origin scope) · `:253`(app group scope) |
| 8 | static credential 3종 kind 보존 + presentation 별 주입 | ❌ **미충족** | kind 보존은 `credential-vault.test.ts:52` 로 확인. **그러나 "presentation 에 따라 서로 다르게 주입" 을 검증하는 테스트가 0건** — `applyPresentation`(`infra/auth/authenticated-fetch.ts:20`)과 `broker.authenticatedFetch` 모두 테스트에 등장하지 않는다. 이 기준의 핵심(= kind 에서 추론하지 않음)이 미검증 |
| 9 | transaction 1건 제한 + 명시 취소 후 교체 | ✅ | `transactions.test.ts:10` "AC9 —" (`superseded` 통지 + abort + 교체) · `:41` 타임아웃 · `:65` finish 후 유령 타이머 없음 |
| 10 | MCP `${BINDING:<id>}` 동작 | ✅ | `resolver.test.ts:76-114` 6케이스 · `broker.test.ts:280` 4케이스(browser_session 은 null, logout 후 null) |
| 11 | `process.env` 전체 fallback 없음, 미해결 시 서버 드롭 | ✅ | `resolver.test.ts:24`(allowlist 밖 미노출) · `:50`(접두사 우회 불가) · `:59`(vault 우선) · `expand.ts` fail-closed 유지 |
| 12 | `.bak` 에 비밀 2차 사본 없음 | ✅ | `deployer.test.ts` "백업에 해석된 MCP 비밀의 2차 사본을 남기지 않는다" — 1차 배포본엔 값 존재(문서화된 예외), `.bak` 엔 부재, 나머지 백업 구조는 보존 |
| 13 | SSO 제거 + `auth` 8채널 (총 73→78, 도메인 22) | ❌ **미충족(숫자)** | 제거·8채널·도메인 22 는 ✅(`grep sso` → 소스 0건, 기계 카운트 `auth: 8`, 도메인 22). **총계가 틀렸다**: 기계 카운트 실측 **74 → 79**(78 아님). 게다가 **변경 전 문서가 이미 틀려 있었다** — 헤더 73 / 내역 합 72 / 실측 74. 내가 그 오류를 검증 없이 이어받아 78 로 적었다 |
| 14 | `ssoBypass`→`authBypass` 마이그레이션 + 기존 키 보존 | ✅ | `settings-migration.test.ts` 5케이스(값 이관·기본값·새 키 우선·멱등·형제 보존) · `RENAMED_KEYS` 는 `provider:<key>:*`·MCP env-var 이름을 건드리지 않음 |
| 15 | `RouterContext.secretStore` 제거 + vault capability 주입 | ✅ | `app/context.ts`(필드 부재) · `external-usage-service.ts` `secretFor` 팩토리 · `mcp/store.ts` `attachBindings`+allowlist · `createSecretFacade` 시그니처가 concrete → `SecretStorePort` |
| 16 | 게이트 통과 | ✅ | 아래 §게이트 재실행 |

**추가 발견 (기준 밖이나 보고 대상)**

| # | 발견 | 판단 |
|---|---|---|
| D1 | **`BrowserSessionStore.probe` 가 `redirect: 'follow'`** (`browser-session-store.ts:127`) → 미인증 요청이 로그인 페이지로 302 되고 그 페이지가 200 을 주면 `res.ok === true` → ADFS provider 가 **인증됐다고 오판하고 valid binding 을 만든다**. 인증 정확성 결함 | **결함 — 수정 필요** |
| D2 | `checkRedirect`(`policy.ts:96`)가 **프로덕션에서 한 번도 호출되지 않는다**. D1 이 필요로 하는 바로 그 검사인데 미배선 | **결함 — D1 과 함께 수정** |
| D3 | `DEFAULT_PRESENTATION`(`broker.ts:525`) 참조 0건 — 죽은 상수 | 제거 |
| D4 | i18n 키 `login.ssoSection`·`login.ssoButton` 이 폐기 어휘(SSO)를 사용자 노출 텍스트로 유지 (`ko.ts:360`·`en.ts:361`) | GLOSSARY §3 가 "SSO 모듈" 을 폐기 어휘로 지정했으므로 정합화 |
| D5 | connector 골격의 미사용 표면 — `registrationErrors`·`isStarted`·`listByConnector`·`listConnectors` 각 참조 0건 | **허용.** plan §비범위 가 connector tool surface 를 이월했으므로 골격 API 로 남는 것이 의도. 단 다음 핸드오프에서 사용되지 않으면 제거 대상 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error / typecheck 0 / vitest 149파일 pass (ABI 베이스라인 5파일 분리) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 16건 중 **14 ✅ / 1 ⚠️부분(#6) / 1 ❌(#8)** + 숫자 오류 1건(#13) |
| 레이어 경계 위반 0 | ✅ | — | `boundaries` error 0 — `features/connectors` → `features/auth-platform` 직접 import 없음(구조적 포트 주입) |
| 문서 형식/링크/한국어 | ✅ | — | 통과. 단 IPC 채널 총계 오기 발견(D/#13) |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 아래 §위생 검토 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions | ✖ | ✅ | 착수 전 3건 확정 완료(불변식 스코프·확장 모델·ADFS 전제) |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** — 로그인 화면(AuthView)이 `AuthStep` 기반으로 바뀌었다 |
| Electron 실동작 | ✖ | ✅ | **사람 확인 대기** — per-session WIA allowlist 분리 · ADFS 공유 partition · `npm run dev` |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0건 — 승인 불필요 |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)
  → warning = useTranscriptVirtualizer.ts react-hooks/incompatible-library (0102 베이스라인, 변경 무관)

$ npm run typecheck          # 3분할
typecheck:node ✅  typecheck:web ✅  typecheck:test ✅   (error 0)

$ ./node_modules/.bin/vitest run
Test Files  5 failed | 149 passed (154)
Tests      38 failed | 1315 passed (1353)
```

**ABI 베이스라인 분리** — 실패 5파일은 전부 `Module did not self-register: better_sqlite3.node`
(egress 차단으로 electron ABI rebuild 403). 비-ABI 실패 **0건**을 기계 확인:

```
$ vitest run 2>&1 | grep FAIL | grep -viE "queries|migrate|builder|fork|continuity"
(출력 없음)
```

해당 5파일: `infra/db/{queries,migrate}` · `features/extensions/builder` ·
`features/orchestration/fork` · `app/chat-turn.continuity` — 전부 DB 인스턴스화 스위트이며 변경 무관.

## 위생 검토 (AGENTS.md 변경 시)

- **키/토큰/이메일/IP 스캔**: `app/AGENTS.md`·`src/main/AGENTS.md`·`features/auth-platform/modules/AGENTS.md`
  에 비밀·개인정보·사내 호스트명 **0건**. 예시 origin 은 전부 `*.example.invalid`(RFC 6761 예약 TLD)로
  실제 사내 주소가 아니다.
- **변동성/일회성 정보 혼입**: 없음. 페이즈 상태·PR 번호는 AGENTS.md 에 넣지 않고 PHASES/INDEX 로 분리했다.
- **장문 코드설명서 혼입**: 없음 — `modules/AGENTS.md` 는 활성화 절차 + 규칙 + 게이트만.

## PHASES.md 정합성

- **미승격** — 본 라운드가 FAIL 이므로 PHASES 표에 올리지 않는다. PASS 후 승격한다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 인수 기준 #6·#8 을 **검증 방법 없이** 적었다. #8("presentation 에 따라 다르게 주입")은
  순수 함수 하나로 검증 가능한데 설계의 §게이트 신규 테스트 목록에 그 항목이 빠져 있었다.
  기준을 쓸 때 "이걸 무엇으로 증명하나" 를 함께 적었어야 한다.
- **구현 단계**: `Criteria-Met: 16/16` 은 **과다 보고**였다. 실제로는 14 ✅ / 1 부분 / 1 미충족이다.
  테스트를 작성한 기준만 충족으로 셌어야 하는데, 코드가 존재하면 충족으로 셌다.
  또 `redirect: 'follow'`(D1)는 `authenticated-fetch` 쪽엔 `'manual'` 을 쓰면서 `probe` 에만
  남긴 **비대칭**이라, 같은 파일군을 쓸 때 한 번만 되짚었으면 잡혔을 결함이다.
- **검증 단계**: 이번 verify 가 **못 본 것** — (a) `browser-session-store.ts` 는 electron 의존이라
  통째로 미테스트인데, 그 안의 순수 함수(`partitionFor`·`isAllowedOrigin`)만 분리해 테스트할 수
  있는지 더 밀어붙이지 않았다. (b) renderer `features/auth` 는 타입 검사만 통과했을 뿐 동작
  테스트가 0건이다(store 의 `stepPatch`·`applyPlatformState` 는 순수 함수라 테스트 가능).
  둘 다 이번 FAIL 항목엔 넣지 않고 후속 개선으로 남긴다.

## [FAIL 시] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **기준 #8** : `applyPresentation` 3형태(header+scheme 4종 / cookie 병합 / query opt-in)와
      `broker.authenticatedFetch` 의 주입 경로에 테스트를 붙인다. 특히 **같은 PAT 가 Bearer /
      Basic password / 전용 header 로 다르게 나가는 것**을 한 테스트에서 대조한다.
- [ ] **기준 #13** : IPC 채널 총계를 실측치로 정정한다 — `74 → 79`. `IPC_CONTRACT.md` 헤더·§2 제목·
      도메인 내역(chat 5→6, cost 5→6)과 `docs/AGENTS.md` 인벤토리를 모두 맞추고, 내역 합 = 총계가
      되도록 한다(변경 전부터 어긋나 있었음을 각주로 남긴다).
- [ ] **D1/D2** : `BrowserSessionStore.probe` 를 `redirect: 'manual'` 로 바꾸고 3xx 를 미인증으로
      판정한다. 최종 URL origin 을 `isAllowedOrigin`/`checkRedirect` 로 재검사해 allowlist 밖이면
      실패시킨다. 회귀 테스트: "로그인 페이지로 302 되는 probe 는 authenticated 로 오판하지 않는다".
- [ ] **D3** : `DEFAULT_PRESENTATION` 제거.
- [ ] **D4** : i18n `login.ssoSection`·`login.ssoButton` 을 폐기 어휘 없이 정정(ko/en).
- [ ] **기준 #6 보강(선택)** : `partitionFor`·`isAllowedOrigin` 순수 테스트 추가로 group 격리를 증명.

> 위 항목은 plan 의 **"파생 이슈 (Derived Issues)"** 챕터로 이관한다.

## 결론 / 다음 단계

- 상태: **FAIL (r1)** — 인수 기준 16건 중 #8 미충족·#13 숫자 오류, 추가로 인증 정확성 결함 D1.
- 다음 주체: **Claude**(구현) — 라운드 2 로 위 액션 아이템 처리 후 재검증.
- **D1 이 가장 중요하다**: 나머지는 테스트·문서 정합이지만 D1 은 "인증되지 않았는데 인증됐다고
  판정" 하는 동작 결함이다. 폐쇄망 ADFS 는 미인증 요청을 로그인 페이지로 302 하는 것이 표준
  동작이므로 실환경에서 재현 확률이 높다.
