# Verify — 0176-generic-usage-connector

## 메타

| 항목 | 값 |
|---|---|
| slug | `0176-generic-usage-connector` |
| 검증자 | Claude Code |
| 일자 | 2026-08-05 |
| 대상 커밋 | `d301086` (+ 검증 중 지적 반영분) · base `f539326` |
| 라운드 | 1 |
| 상태 | **PASS** (인수 22/23 — 23번은 사람 실기) |
| 자기 검증 여부 | **예 — 설계·구현·검증이 같은 에이전트다.** 환경에 Codex 가 없다(0165~ 관례). 그래서 §비판적 검토와 §역방향 탐색을 매트릭스보다 **먼저** 돌렸고, 아래 두 절에서 나온 지적은 매트릭스 통과와 무관하게 코드에 반영했다. |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·동시 호출·종료 중·권한 거부) | **접혀 있다** | ⓐ 미연결(부팅 직후·사내망 밖·로그아웃) → `usage-source.ts:50` 이 `not_connected` 로 강등, 서비스는 baseline stale. ⓑ 지연 → 서비스가 5초 signal 을 걸고 `plugin-host.ts:invokeConnector` 가 **연결 종료 신호와 병합**해 전달한다. ⓒ 부분 실패 → source A 성공·B 실패 시 A 구독자만 fresh(`external-usage-service.test.ts::"sourceId 미지정 구독은…"` 이 같은 경로를 돈다). ⓓ 종료 중 → 새 영속 경로가 없어 기존 `Scheduler.stopAll()` → `closeDb` 순서 불변. ⓔ 권한 거부 → 401·403 은 표본이 아니라 실패다. |
| **잘못된 성공(false success)** 이 가능한 경로 | **한 곳을 닫았고, 남은 한 곳은 설계상 구독자 몫** | 닫은 것: connector 가 **HTTP ≥400 을 표본으로 올리지 않는다**(`connector.ts:91`) — 올렸다면 오류 JSON 을 quota 로 읽는 map 이 잘못된 값을 *권위값*으로 영속시켰을 것이다(0157 D1 과 같은 형태). 남는 것: map 이 엉뚱한 payload 를 리포트로 바꾸는 것은 **모듈 책임**이며, 프레임워크는 `null` 을 정상 경로로 접는다(`external-usage-service.test.ts::"map 이 전부 null 이면…"`). 2xx~3xx 는 통과시킨다 — 3xx 는 broker 가 이미 정책 검사와 함께 추종하므로(0174) 이 층에 도달하는 일이 드물고, 도달해도 본문이 리포트로 해석되지 않으면 stale 로 접힌다. |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | **되돌릴 수 있다** | 신규 마이그레이션 0 · 파일 쓰기 0 · 쓰는 외부 상태는 기존 `provider_usage_report_cache` upsert 뿐이고 그 행은 다음 성공 갱신이 덮는다. 기본 설치는 `USAGE_CONNECTORS = []` 라 **동작 변화가 없다**. |
| 설계가 의도한 것을 구현이 실제로 했는가 | **했다 — 다만 한 항목은 설계보다 좁게 구현** | plan §설계 "connector 를 provider 에 매달지 않는다" ↔ `features/usage/**` 에 auth-platform import **0건**(grep 확인). plan §설계 "표본 dedupe" ↔ `external-usage-service.ts:sampleKey` + `sampleInFlight`. **좁힌 것**: plan 은 subscription 타임아웃을 언급만 했고 구현은 기존 `DEFAULT_TIMEOUT_MS`(5s)를 재사용했다 — 구독 전용 타임아웃 설정을 계약에 넣지 않았다(§파생 이슈 D2). |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘지 않았다** | 5건 전부 *구현 세부·놓친 엣지케이스* 범주다(오류 상태 처리·취소 병합·providerKey 강제·문서 결정표·`targets` 잠금). 인수 기준·제품 의도·의존성을 바꾼 것은 없다. 제품 결정 2건은 `⚠️ 보고만` 으로 남겼다 — 경계 판정이 옳다. |

## 역방향 탐색 (매트릭스 전 선행)

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh f539326..HEAD` (16 파일)

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export `modules/usage/index.ts::usageAuthProviders` | **결함 — 수정함** | 프로덕션·테스트 참조 0. 배포가 고치는 것은 `servers.ts` 뿐이므로 밖으로 열 이유가 없다 → **export 제거**(모듈 내부 함수로 강등). |
| 미사용 export `external-usage-service.ts::sampleKey` | **미검증 — 테스트 추가함** | plan §리스크가 "정렬된 안정 직렬화 … 단위 테스트로 고정" 이라 적었는데 직접 테스트가 없었다 → `external-usage-service.test.ts::"params 키 순서가 달라도 같은 호출은 같은 키다"`·`"source·operation·params 가 다르면 키가 갈린다"` 추가. |
| 미사용 export `usage-feed.ts::matchesSelector` | **미검증 — 테스트 추가함** | selector 의미가 구독 계약의 핵심인데 간접 검증뿐이었다 → `usage-feed.test.ts::"sourceId·operation 은 지정된 것만 비교한다"` 추가. |
| 미사용 export `_example/provider-subscription.ts::exampleUsageSubscriptionModule` | **정상** | 비활성 템플릿이다. 기존 `_example/index.ts`·`provider-hook.ts` 와 같은 성격(타입체크만 받고 배럴에 등록되지 않는다). |
| 타입 전용 미사용 export (`UsageSampleFailureReason`·`UsageSampleSelector`·`UsageFeedUnsubscribe`·`UsageSampleListener`) | **정상** | 전부 같은 파일 시그니처에 쓰인다(union 이름·구독 API 반환형). `plugin-host.ts::BindingLookup` 등은 이번 변경 이전부터 있던 항목. |
| 테스트에만 등장 `app/usage-source.ts::UsageConnectorLookup` | **오탐** | `createUsageSourcePort` 의 **파라미터 타입**이다(같은 파일 프로덕션 시그니처). bootstrap 은 구조적으로 만족하는 리터럴을 넘긴다(`bootstrap.ts:517`). |
| 테스트에만 등장 `modules/usage/request.ts::substitute` | **정상(직접 테스트 대상)** | 같은 파일 `buildUsageRequest` 가 쓴다. 인코딩 규칙이 보안 성질(경로 이탈 차단)이라 직접 단언을 유지한다 — 형제 `normalizeBasePath`(confluence `rest.ts`)와 같은 관례. |
| 테스트에만 등장 `plugin-host.ts::ConnectorPort`·`LogoutPort` | **범위 밖** | 이번 변경 이전부터 있던 포트 타입. |
| 형제 파일 정책 비대칭 | **0건** | 스크립트 3절 "(없음)". `redirect:`·`credentials:` 계열 옵션을 새로 쓴 파일이 없다 — 전송은 전부 broker 위임이다. |

추가 확인(스크립트 밖):

- **보안 성질 재확인**: `modules/usage/` 에 vault·secret·전역 `fetch` import **0건**(주석 언급 2건 제외, grep).
- **레이어 성질 재확인**: `features/usage/` 에서 `auth-platform` 참조 **0건**(grep). lint boundaries **0 error**.
- **IPC 무변경 재확인**: `app/src/shared`·`preload`·`renderer`·`docs/IPC_CONTRACT.md` diff **0 파일**.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §설계 리뷰 "`UsageMapContext.store` 는 과했을 수 있다" | **타당하나 지금 바꾸지 않는다** | 훅 경로와 컨텍스트 형상을 맞추는 값이 있고, AC22 가 키 집합을 잠그고 있어 축소 시 즉시 드러난다. 파생 이슈로 올리지 않는다(계약 축소는 되돌릴 수 있다). |
| 이견 §설계 리뷰 "probe `error` 분기는 대개 경로 오타인데 상태만으로는 못 알려준다" | **타당** | 메시지에 HTTP 코드를 싣는 선에서 수용. 진단 강화는 후속(§파생 이슈 D3). |
| 선조치 ✅ #1~#5 | **전부 경계 안** | 각 항목에 회귀 테스트가 붙어 있음을 매트릭스에서 확인(#1→AC11 인접 케이스, #2→AC19 인접 2건, #3→AC5, #4→문서, #5→AC18). |
| 선조치 ⚠️ #6 (레거시 제거 시점 · UI 템플릿 개방) | **옳은 분류** | 제품 결정이다 → §검증 책임 분리 "사람 확인 대기" 로 넘긴다. |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | selector 일치 구독자 전부 전달 + 전달 수 반환 | ✅ | `features/usage/usage-feed.test.ts::"selector 가 일치하는 구독자 전부에 전달한다"` (3종 selector 매칭 + 2종 비매칭 동시 단언) |
| 2 | 구독자 예외 격리 | ✅ | `usage-feed.test.ts::"구독자 예외가 다른 구독자 전달을 막지 않는다"` · 구현 `usage-feed.ts:57-64` |
| 3 | 해지 후 미수신 | ✅ | `usage-feed.test.ts::"해지한 구독자는 이후 표본을 받지 않는다"` |
| 4 | 같은 호출을 구독한 provider 2개 → invoke **1회**, 둘 다 영속 | ✅ | `external-usage-service.test.ts::"같은 source 를 구독한 두 provider 가 invoke 1회를 공유한다"`(`invoked` 배열 길이 1 + keyedDb 행 2개) · 키 규칙 `::"params 키 순서가 달라도 같은 호출은 같은 키다"` |
| 5 | 구독 결과 영속 + fresh | ✅ | `external-usage-service.test.ts::"구독 결과를 리포트로 영속하고 fresh 로 표시한다"`(`effectiveLimit.stale === false`) |
| 6 | invoke 실패 → baseline + stale | ✅ | `::"invoke 실패 시 baseline 을 stale 로 돌려준다"` |
| 7 | map 전부 null → 미영속 + stale | ✅ | `::"map 이 전부 null 이면 baseline 을 유지한다"`(`rows.size === 0` + `source:'local'`) |
| 8 | `sourceId` 미지정 → 연결된 source 전부, 하나라도 성공하면 fresh | ✅ | `::"sourceId 미지정 구독은 연결된 source 전부를 받는다"`(미연결 source 는 호출 0 도 함께 단언) |
| 9 | subscription > config 우선순위 | ✅ | `::"subscription 이 config 보다 우선한다"`(legacy `fetchImpl` 호출 0) |
| 10 | 레거시 config/provider 경로 유지 | ✅ | `::"레거시 config 경로가 그대로 동작한다"` + 기존 케이스 8건 전부 green(수정 0줄) |
| 11 | operation 선언대로 요청 조립 + JSON payload | ✅ | `modules/usage/connector.test.ts::"선언한 operation 을 요청으로 만들고 JSON 을 payload 로 돌려준다"`(요청 전문 `toEqual`) |
| 12 | 미선언 operation 거부 | ✅ | `connector.test.ts::"미선언 operation 은 거부한다"`(전송 0회 동시 단언) |
| 13 | 선언된 자리표시자만 인코딩 치환 | ✅ | `modules/usage/request.test.ts::"선언된 자리표시자만 인코딩해 치환한다"`(`../secrets?x=1` → `..%2Fsecrets%3Fx%3D1`, 미선언 파라미터 미노출) |
| 14 | 비-JSON 본문 → 원문 문자열 | ✅ | `modules/usage/payload.test.ts::"JSON 이 아니면 원문 문자열을 payload 로 싣는다"` + 깨진 JSON·빈 본문 케이스 2건 |
| 15 | probe 상태코드 → health 4멤버 전수 | ✅ | `connector.test.ts::"probe 상태코드를 health 4종으로 매핑한다"`(200·401·403·500·418) |
| 16 | probe 미선언 → 요청 0건 ready | ✅ | `connector.test.ts::"probe 미선언이면 요청 없이 ready"` |
| 17 | 설정 2개 등록 오류 0 | ✅ | `modules/usage/usage-package.test.ts::"서버 2개 설정이 오류 없이 등록된다"`(manifest 파싱 + registry 등록 + 교차참조 검사) |
| 18 | 기본값 connector 0 + 로그인 게이트 미점등 | ✅ | `usage-package.test.ts::"기본 설정은 connector 0개이고 로그인 게이트를 켜지 않는다"`(`providersForTarget('application') === []`) |
| 19 | `invokeConnector` 위임 + 미연결 `not_connected` | ✅ | `plugin-host.test.ts::"connectorId 로 invoke 를 위임하고 미연결은 not_connected"` + 취소 2건(`"binding 종료가…"`·`"호출자 취소도…"`) |
| 20 | 포트가 결과를 `UsageSample` 로 정규화 | ✅ | `app/usage-source.test.ts::"connector 결과를 UsageSample 로 정규화한다"`(표본 전문 `toEqual`) |
| 21 | 실패·형상 불일치를 `ok:false` 로 강등 | ✅ | `usage-source.test.ts::"실패·형상 불일치를 ok:false 로 강등한다"`(3형상) + `"호출이 던져도 예외를 올리지 않는다"` + `"모르는 source 와 미연결 source 를 구분해 강등한다"` |
| 22 | map 컨텍스트에 fetch·secret 없음 | ✅ | `external-usage-service.test.ts::"map 컨텍스트는 fetch·secret 을 노출하지 않는다"`(키 집합 `['clock','logger','providerKey','settings','store']` 완전 일치) |
| 23 | 사내 사용량 API 연결 후 사용량 탭에 외부 quota 표시 | ⏳ **사람 실기** | 실행 경로: `npm run dev` → 플러그인 탭에서 usage connector 연결(PAT) → 설정 → 사용량 탭. 이 환경에서는 electron 바이너리가 설치되지 않아(egress 403) 실행 불가. |

**프로덕션 도달 경로 재확인**(관문 2 규칙 1-b): 구독 경로가 실제로 도는지를 배선으로 따라갔다 —
`bootstrap.ts:496` `materializeStaticProviderSettings`(모듈의 settings 디렉터리 생성) →
`:508` `providerSettings.invalidateAll()` → `:509` 서비스 생성(+`sources`) → `:517` 스케줄러 job 이
`providerSettings.list(adapter)` 로 얻은 providerKey 로 `refreshAll` → 구독 경로. 수동 경로는
`handlers/misc.ts:277`(`cost:refreshProviderUsageReport`). **유일한 호출자가 테스트인 AC 는 0건.**

## 검증 책임 분리 (사람 vs 에이전트) — 정본 표

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | lint 0 error · typecheck 3/3 · vitest 2046/2046 · scripts 28/28 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일::케이스`) | 이견 시 중재 | 22/23 ✅, 1 사람 실기 |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | 0건 (신규 feature 교차 import 없음) |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | `modules/usage/AGENTS.md`+`CLAUDE.md` stub 신설, 링크 해석 확인 |
| AGENTS.md 위생(키/토큰/이메일/IP) 스캔 | ✅ grep 보고 | ✅ 맥락 최종 판단 | 패턴 히트 0건 (예시 주소는 `*.corp`·`example.invalid` 뿐) |
| import stub(`@AGENTS.md`) 해석 | ✅ | — | `modules/usage/CLAUDE.md` = `@AGENTS.md` 한 줄 |
| PHASES.md 형식·PR#/커밋 | ✅ | — | 아래 §PHASES.md 정합성 |
| 제품 의도 부합(사용량 UX) | ✖ 보조 의견 | ✅ 결정 | 사람 확인 대기 |
| **레거시 `${SECRET:}`·`ctx.fetch` 경로 제거 시점** | ✖ 단독 결정 금지 | ✅ 결정 | **사람 확인 대기**(Open Question 1) |
| **usage connector UI 템플릿 개방 여부** | ✖ 단독 결정 금지 | ✅ 결정 | **사람 확인 대기**(Open Question 2) |
| UI/UX 시각 검증 · 사내망 실사용(AC23) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 해당 없음(신규 의존성 0) |
| PR 머지 승인 | ✖ | ✅ | 사람 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)      # warning = useTranscriptVirtualizer(0102 베이스라인)

$ npm run typecheck
typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅   (3/3)

$ ./node_modules/.bin/vitest run
Test Files  1 failed | 214 passed (215)
Tests       2046 passed (2046)

$ node --test "scripts/*.test.mjs"
# pass 28 / # fail 0

$ ./node_modules/.bin/vitest run 2>&1 | grep -E "FAIL|Error:"
FAIL  src/main/app/chat-turn.continuity.test.ts [ src/main/app/chat-turn.continuity.test.ts ]
Error: Electron failed to install correctly, please delete node_modules/electron and try installing again
```

**환경 기인 분리**: 실패는 **파일 1개, 케이스 0개**다 — `chat-turn.continuity.test.ts` 가
electron 모듈을 로드하지 못해 **수집 자체가 안 된다**(egress 차단으로 electron 바이너리 미설치,
`app/AGENTS.md` §제약 환경 게이트 가이드의 알려진 서명). 이 파일을 제외하면 실패 **0건**이고,
같은 이유로 처음에 red 였던 DB 로드 스위트 4종(`infra/db/queries`·`infra/db/migrate`·
`features/extensions/builder`·`features/orchestration/fork`)은 `npm rebuild better-sqlite3`(Node ABI)
후 **전부 green** 이 됐다. 변경 무관.

**수치 재측정**(승계 0): 총 2046 케이스 — 이번 변경이 더한 `it(` 블록은 **46개**
(`git diff f539326..HEAD -- '**/*.test.ts' | grep -cE '^\+\s+it\('` = 43 + 검증 중 추가 3),
따라서 변경 전 베이스라인은 **2000**. 신규 테스트 파일 6개(feed 1 · modules/usage 4 · usage-source 1),
개정 테스트 파일 2개(service · plugin-host).

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: **히트 0건**. 예시 주소는 `https://llm-portal.corp`·
  `usage.example.invalid` 같은 비실재 값뿐이다.
- 변동성/일회성/장문 코드설명서 혼입: 없음. `modules/usage/AGENTS.md` 는 *구조·규칙·파일 표*만
  담고, 상태·이력은 INDEX/PHASES 에 남겼다.

## PHASES.md 정합성

- `docs/PHASES.md` 는 **"현재 작업 중" 보드 링크 유지** 정책이므로 이번 라운드에서 표 행을
  추가하지 않는다(핸드오프 완료·PR 병합 후 승격). `INDEX.md` 는 `verify/PASS` 로 갱신했다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 인수 기준 23개는 전부 검증 수단을 갖췄지만, **plan 이 리스크 표에서 약속한
  성질("정렬된 안정 직렬화")이 인수 기준에는 없었다** — 그래서 구현이 그 성질을 테스트 없이
  남겼고 역방향 탐색에서야 잡혔다. *다음 plan 은 §리스크의 완화책에 "테스트로 고정" 이라고
  쓴 항목을 인수 기준에도 올려라* — 리스크 표는 verify 매트릭스가 대조하지 않는다.
- **구현 단계**: 선조치 경계는 지켰다(5건 전부 구현 세부, 제품 결정 2건은 보고만). 다만
  **설계가 "지금 배선한다" 고 하지 않은 것을 export 로 열어 둔 곳**이 1건 있었다
  (`usageAuthProviders`) — 확장점을 미리 여는 습관은 이 저장소의 정리 라운드(0175)가 반복해서
  걷어내는 대상이다.
- **검증 단계**: **이번 verify 가 못 본 것** — ⓐ 실제 `authenticatedFetch` → broker → `net.fetch`
  왕복은 **전부 스텁으로 대리 검증**했다. broker 의 origin·헤더 정책이 usage connector 요청에도
  같은 판정을 내리는지는 기존 broker 테스트의 일반성에 기대고 있을 뿐, *이 connector 로* 확인한
  것이 아니다. ⓑ 사내 사용량 API 의 실제 응답 포맷을 본 적이 없으므로 `map` 계약이 충분한지는
  실사용에서만 드러난다(AC23). ⓒ 스케줄러 5분 주기의 실발화는 `croner` 배선을 신뢰했고 직접
  시간을 돌리지 않았다.

## [FAIL 시] 미충족 요구사항

없음 — 미충족 기준 0건. 사람 실기 대기 1건(AC23)은 FAIL 사유가 아니라 **경계**다.

## 결론 / 다음 단계

- 상태: **PASS**. 인수 22/23 기계 검증 충족, 1건은 사람 실기(사내망·Electron).
- 다음 = **사람** — ⓐ AC23 실기 ⓑ Open Question 2건 결정(레거시 경로 제거 시점 · UI 템플릿
  개방) ⓒ PR 머지 승인.
- 파생 이슈 3건은 plan 하단 `[검증자 기입] 파생 이슈` 챕터에 등록했다(전부 **후속** 성격이며
  이번 PASS 를 막지 않는다).
