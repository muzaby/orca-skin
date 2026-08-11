# Plan — 0183-usage-into-declarations

## 메타

| 항목 | 값 |
|---|---|
| slug | `0183-usage-into-declarations` |
| 작성자 | Claude Code |
| 일자 | 2026-08-10 |
| 매핑 | 0182 후속 (사용자 질의에서 파생) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 질의 ① | "usage 를 반환하는 SP 를 service 에 선언해 api 로 호출할 수 있다면 static 을 따로 구분할 필요가 있는가?" | 라이브 세션 (2026-08-10) |
| 질의 ② | "SP 에 대한 모든 구현을 providers/declarations 에 할 수 있는데 별도 폴더링이 필요한가?" | 같은 세션 |
| **명시 요구** | **① `providers/declarations` 외 모두 제거 ② SP 의 API 호출·주기적 호출(cron) 가이드 문서 보완** | 같은 세션 (검토 후 결정) |
| 추론 의도 | 배포가 고치는 파일을 **하나로** 모으는 것이 목적 — 지금은 SP 하나가 `declarations/service.ts` · `static/modules/` · `sources/settings/` **세 곳**에 흩어져 문자열 조인 2개로 이어져 있다 (추론) | 0182 세션의 조인 추적 |

## Context (왜)

`features/providers/static/` 은 **사용량 전용** 축(`StaticUsageProviderModule`)이다. 0099(선언형
config) → 0157(자격증명이 auth 로 이동) → 0176(구독 경로) 를 거치며 세 경로가 쌓였는데, 그 사이
전제가 바뀌어 지금은:

- **활성 모듈 0개** (`STATIC_USAGE_PROVIDER_MODULES: []`)
- **3경로 중 2개가 죽었다** — `config`·`provider` 는 `ctx.secret`/`ctx.fetch` 로 자기 요청을 만드는
  설계인데 `secret.set(` 호출이 main 전체에 **0곳**이라 인증 endpoint 에 도달할 수 없다
- **조인 좌표가 중복**이다 — `adapter`/`provider` 는 `Provider.llm` 에 이미 있다
- **선언에 함수를 넣지 못한다는 제약이 없다** — `Provider.tools`·`AuthSpec.compose`·`authorize` 가
  이미 함수다

결과: 배포가 세 곳을 고치고, 두 조인 중 하나만 어긋나도 **아무 로그 없이** 사용량이 멈춘다
(`refreshAll` 의 `.filter(k => this.providers.has(k))` 가 조용히 걸러낸다).

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 진짜 문제를 겨냥하나 | **타당.** 증상은 "폴더가 하나 더 있다" 지만 원인은 *한 SP 가 세 곳에 흩어진 구조* 다 | `bootstrap.ts:483`(materialize) + `:494`(modules 주입) + `:511`(cron) 이 세 축을 각각 배선 |
| 이미 있는 것 아닌가 | **절반 있다.** `UsageSourcePort`(전송)는 이미 `ProviderApi` 기반이다 — 이번에 옮기는 것은 **해석·귀속**뿐 | `app/usage-source.ts` |
| 더 작은 해법이 있나 | 있다 — *죽은 경로 2개만 지우고 modules 는 유지*. 그러면 조인 2개와 파일 3곳은 남는다. **사용자가 전면 제거를 지시**했고 활성 모듈 0개라 이전 비용이 0인 시점이다 | 사용자 결정 |
| 인용 자료가 요구를 부풀렸나 | **내 이전 답이 반대로 부풀렸다** — "map 은 코드라 선언에 못 넣는다"·"defaultSettings 자리가 필요하다" 두 반론이 `Provider.tools` 존재와 스캐폴드 단계 앞에서 서지 않는다. 근거에서 뺀다 | `contracts/provider.ts` `tools` · `bootstrap` provider-scaffold 단계 |
| 기존 결정을 뒤집나 | **뒤집는다 2건** — 아래 §기존 결정 표 (`usage-report.ts` "동결 계약" · `static/modules/AGENTS.md` 자족 가이드) | |

- **사용자에게 올릴 것**: 없음(범위·문서 처리 모두 지시받음).

## 자료조사

| 발견 | 레퍼런스 |
|---|---|
| 활성 모듈 **0개** | `static/modules/index.ts` — `STATIC_USAGE_PROVIDER_MODULES: []` |
| `secret.set(` 호출 main 전체 **0곳**(테스트 제외) → `config`·`provider` 경로는 인증 endpoint 불가 | `rg 'secret\.set\(' src/main --glob '!**/*.test.ts'` |
| 조인 키 형식 `'<adapter>-<provider>'` 가 **두 곳에서 독립 생성** — 디렉토리(`providerSettings.list().key`)와 모듈(`${p.adapter}-${p.provider}`) | `provider-settings.test.ts:45` · `external-usage-service.ts:68` |
| 어긋나면 **침묵** — `refreshAll` 이 filter, `refresh` 가 `if (!module) return 캐시` | `external-usage-service.ts:112-118` |
| 구독은 **별도 시계가 아니다** — `feed` 는 팬아웃이고 표본은 같은 cron 이 만든다 | `fetchViaSubscription` → `sample` → `feed.publish` |
| `Provider.llm` 에 `{adapter, provider, envKey}` 가 **이미** 있다 | `contracts/provider.ts` |
| 선언은 이미 함수를 담는다 | `Provider.tools: (api) => RuntimeToolServer` |
| 제거 대상 줄 수(실측): `static/` **305**(46+41+15+58+29+61+55) · `http-usage-report.ts` **88** · `usage-feed.ts` **74** · `contracts/usage-report.ts` **60** | `wc -l` |
| `UsageReportConfig`(shared/ipc) 소비자는 `usage-report.ts`·`http-usage-report.ts` 둘뿐 | `rg 'UsageReportConfig' src` |
| `UsageFeed` 소비자는 `external-usage-service.ts` 하나 | `rg 'UsageFeed' src` |

## 설계

**축 하나로 접는다** — `Provider.usage` 를 선언한 provider 가 **곧 호출 대상**이다. 별도 `sourceId`
참조가 없으므로 조인이 사라진다.

```ts
// contracts/provider.ts
export interface UsageSpec {
  // 리포트가 붙을 대상. 생략하면 이 선언의 llm 좌표에서 파생한다(`${adapter}-${provider}`).
  providerKey?: string
  operation: string                    // origin 기준 상대 경로
  params?: Record<string, unknown>
  map(sample: UsageSample, ctx: UsageMapContext): ExternalUsageReport | null
}
Provider.usage?: UsageSpec
```

| 축 | 이전 | 이후 |
|---|---|---|
| 무엇을 부르나 | 모듈 `usage.subscription.request` | `Provider.usage.operation` |
| 누구를 부르나 | `sourceId` → provider id **(조인 1)** | **선언한 provider 자신** |
| 누구의 한도인가 | `adapter`/`provider` → 디렉토리 **(조인 2)** | `usage.providerKey` 또는 `llm` 좌표에서 파생 |
| 언제 부르나 | cron(변경 없음) | cron(변경 없음) |

**침묵 제거**: 부팅 시 `usage.providerKey` 가 `providerSettings` 열거에 없으면
`usage.providerKey.unmatched` 를 **경고로 남긴다**. 지금은 아무 신호가 없다.

| 신규/변경 모듈 | 책임 | 레이어 | 테스트 |
|---|---|---|---|
| `contracts/provider.ts` `UsageSpec` | 선언 형상 | contracts | 컴파일 |
| `features/providers/usage-specs.ts` | 선언 → `UsageSpecEntry[]` 순수 추출(+providerKey 파생) | features | **순수 단위** |
| `app/usage-source.ts` | 포트 확장 — 전송 + spec 목록 주입 | app | 기존 테스트 |
| `features/usage/external-usage-service.ts` | 모듈/피드/2경로 제거, spec 기반 단일 경로 | features | 기존 + 갱신 |

**삭제**: `features/providers/static/`(전체) · `features/usage/http-usage-report.ts`(+test) ·
`features/usage/usage-feed.ts`(+test) · `contracts/usage-report.ts` 의
`StaticUsageProviderModule`·`ExternalUsageContext`·`ExternalUsageProvider` · `shared/ipc.ts` 의
`UsageReportConfig` · `external-usage.ts` 의 `createSecretFacade` · `bootstrap` 의
`materializeStaticProviderSettings`·`secretFor`.

## 인수 기준

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 선언에서 usage spec 을 뽑고 `providerKey` 를 `llm` 좌표에서 파생한다(명시 우선) | `features/providers/usage-specs.test.ts` | `bootstrap` → `createUsageSourcePort` |
| 2 | `usage` 미선언 provider 는 spec 목록에 없다 | 같은 파일 | 같음 |
| 3 | cron 1틱이 spec 마다 **선언한 provider 자신**을 `api.request` 로 부른다 | `app/usage-source.test.ts` 또는 서비스 테스트 | `scheduler` → `refreshAll` |
| 4 | `map` 이 `null` 이면 baseline 이 stale 로 유지된다 | `external-usage-service.test.ts` | 같음 |
| 5 | 미인증 provider 는 `not_connected` 로 접히고 오류가 아니다 | 같은 파일 | 같음 |
| 6 | `providerKey` 가 설정 디렉토리 열거에 없으면 **경고 로그**가 난다(침묵 금지) | 같은 파일 | `bootstrap` |
| 7 | `rg 'static' src/main/features/providers` 가 **0건**이고 삭제 대상 심볼(`StaticUsageProviderModule`·`UsageReportConfig`·`UsageFeed`·`createHttpUsageReportProvider`)이 `src` 에 없다 | `rg` 0건 | — |
| 8 | 가이드에 **SP API 호출 + 주기 호출(cron)** 절이 있고, 1분 주기·in-flight 병합·stale 폴백·providerKey 파생을 서술한다 | `rg -n 'cron|주기' docs/guides/closed-network-extensions.md` | 배포 담당자 |
| 9 | 레시피 E 가 `static/modules` 대신 **선언 한 곳**을 지시한다 | 같은 문서 | 같음 |
| 10 | `providers.md`·`docs/AGENTS.md`·`src/main/AGENTS.md` 에서 `static/modules` 서술이 사라진다 | `rg 'static/modules' docs app/src/main/AGENTS.md` → 0건 | — |

## 범위 / 비범위

- **범위**: 위 삭제·이전·가이드(§5-b 재작성 + cron 절 신설)·인벤토리 동기화.
- **비범위**: cron 주기 변경 · 사용량 UI · `UsageSample`/`ExternalUsageReport` 형상 변경.

| 미룬 항목 | 일방향인가 |
|---|---|
| cron 주기 | 아니오 — 설정값 |
| `UsageSpec` **필드 이름** | **예 — 지금 확정**(선언 스키마) |

## 기존 결정·규칙과의 관계

| 기존 결정 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| `usage-report.ts` 는 **동결(생성 후 불변) 계약** | `static/modules/AGENTS.md` | §설계 "삭제" | **뒤집는다** — 동결의 전제는 외부 팀이 그 계약만 보고 구현한다는 것이었고, 활성 모듈 0개라 보호할 소비자가 없다 |
| `static/modules/AGENTS.md` = 자족 가이드 | 같은 파일 | §설계 "삭제" | **뒤집는다** — 내용은 가이드 레시피 E 로 흡수(사용자 결정 ②) |
| 배포가 고치는 파일은 `declarations/` 셋뿐 | `providers.md` · 가이드 §1.1 | §설계 전반 | **강화한다**(사용량만 예외였던 것을 없앤다) |
| `features/usage` 는 `features/providers` 를 import 하지 않는다 | `src/main/AGENTS.md` | §설계 포트 주입 | **유지** — 컴포지션 루트가 spec 을 주입한다 |
| 사용량 전송은 `ProviderApi` 로만 | 0176/0181 | §설계 | **유지** |

## 파생 UX / 엣지케이스

- `providerKey` 파생 실패(= `llm` 좌표도 명시도 없음) → 그 선언은 spec 에서 제외 + 경고.
- 같은 `providerKey` 를 두 provider 가 선언 → 나중 것이 덮지 않고 **둘 다 호출**되며 마지막 성공이 남는다(경고 1회).
- 미인증·사내망 밖 → `not_connected`, baseline stale 유지(현행 유지).

## 리스크

| 리스크 | 완화 |
|---|---|
| 삭제 규모가 크다(약 530줄) | 소비자를 `rg` 로 전수 확인했고 AC7 이 잔재 0을 기계 검사 |
| 외부 회사 팀이 `static/modules/AGENTS.md` 를 보고 있을 수 있다 | 가이드 레시피 E 로 내용을 옮기고 제거 사실을 `providers.md` 에 남긴다 |

## 게이트

`npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`

---

## [구현자 기입] 설계 리뷰 (비판적)

구현 주체 = **Claude**(비기능 = 구조 정리). 설계대로 진행했고 이견 없음. 다만 아래 3건은 설계가
덜 적었다(전부 구현 세부라 선조치).

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **`UsageSpecEntry` 를 어디에 두는지 설계가 안 적었다.** `features/usage` 가 `features/providers` 를 import 할 수 없어 타입을 그쪽에서 가져올 수 없다 | ✅ `external-usage-service.ts` 에 **구조적으로** 선언하고 컴포지션 루트가 `usageSpecs()` 결과를 그 형상으로 넘긴다 | 슬라이스 교차 금지(`src/main/AGENTS.md`) |
| 2 | **`UsageFeed`·표본 dedupe 의 존재 이유가 사라졌다** — 두 provider 가 같은 `(source, operation)` 을 구독하던 상황이 없어졌다(호출 대상 = 선언 주체) | ✅ `usage-feed.ts`(+test) 삭제. providerKey 단위 in-flight 병합만 남긴다 | 회귀 테스트로 "틱이 겹쳐도 호출 1회" 고정 |
| 3 | **`standardization.md` 가 `static/modules` opt-in 절차를 서술**하고 있었다(설계의 문서 목록에 없었다) | ✅ 선언 기반으로 재작성 | `rg 'static/modules'` |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 삭제 | `features/providers/static/`(7파일) · `http-usage-report.ts`(+test) · `usage-feed.ts`(+test) · `UsageReportConfig`(shared/ipc) · `createSecretFacade` · `StaticUsageProviderModule`·`ExternalUsageContext`·`ExternalUsageProvider` |
| 신설 | `features/providers/usage-specs.ts`(+test) · `contracts/provider.ts` `UsageSpec` |
| 변경 | `external-usage-service.ts`(3경로 → 1) · `contracts/usage-report.ts`(60 → 27줄) · `bootstrap.ts` · 문서 6 |
| 게이트 | lint **0 error/1 warn** · typecheck **3/3** · vitest **193 파일(188/5) · 1,697 테스트(1,658/39)** |
| 신규 red | **0** — 실패 5파일이 DB ABI 베이스라인과 동일(39건) |
| 조인 | **2개 → 0개**. 배포가 고치는 파일 **3곳 → 1곳** |

---

## [검증자 기입] 파생 이슈
