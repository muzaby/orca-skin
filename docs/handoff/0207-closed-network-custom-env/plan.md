# Plan — 0207-closed-network-custom-env

## 메타

| 항목 | 값 |
|---|---|
| slug | `0207-closed-network-custom-env` |
| 작성자 | Claude Code |
| 일자 | 2026-08-28 |
| 매핑 | 폐쇄망 커스텀 spawn env 주입점 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 폐쇄망 배포가 사내 환경(프록시·사설 인증서·게이트웨이)에 맞춰 Claude subprocess env 를 조정할 자리가 없다. 기존 확장점 `RuntimeConfigAugmenter` 는 key 별 정확 매칭이라 운영자가 만든 `sources/settings/<harness>/<modelProvider>/` 에는 붙지 않고, 입력에 host env 가 없다.
- 완료 후 달라지는 것: 배포가 함수 하나를 채우면 **모든** Harness+ModelProvider 의 spawn env 에 커스텀 env 가 실린다. 그 함수는 대상 식별자·`settings.json`·host env 를 받아 스스로 대상을 좁힐 수 있다.
- 성공을 사용자 관점에서 한 문장으로: 폐쇄망 배포자가 코어를 고치지 않고 `app/deployment/` 파일 하나를 채워 Claude 실행 환경변수를 마지막에 덮어쓸 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "폐쇄망 환경에서 적응할 수 있도록 커스텀 env를 삽입하고 싶다." | 라이브 세션 1차 요청 |
| 명시 요구 | "harnessproviderid? key?, settings.json 및 host env가 주어져야 하며, 커스텀 env를 주입할 것이다." | 같은 요청 |
| 명시 요구 | "폐쇄망 자체의 환경을 지원하기 위함이다. 하드코딩이 될 여지가 있다." | 주입 채널 질의 응답 |
| 명시 요구 | "모든 환경에 적용할 수 있어야 하며, 특정 하네스/공급자 환경에서만 적용될 수 도 있어야 함" | 적용 대상 질의 응답 |
| 명시 요구 | "하네스 레이어에 전달되기 직전에" | 우선순위 질의 응답 |
| 명시 요구 | host env = "맞다 — process.env 스냅샷" | host env 확인 질의 응답 |
| 추론 의도 | 커스텀 env 는 원격 호출 없이 계산되는 정적 적응값이다 — 동적 credential·URL 은 기존 augmenter 의 책임이다. | 요청이 든 입력 3종이 전부 턴 진입 시점에 이미 손에 있다 |
| 추론 의도 | entry 를 못 고른 턴에도 주입한다 — 사내 프록시·인증서가 빠진 채 spawn 하면 증상이 원인에서 멀어진다. | `harness-runtime.ts` 의 "반쯤 채워진 환경으로 spawn 하지 않는다" 계약과 같은 축 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 커스텀 env 는 배포가 작성하는 in-repo TypeScript 함수다. 설정 파일 스키마를 새로 만들지 않는다. | "폐쇄망 자체의 환경을 지원하기 위함이다. 하드코딩이 될 여지가 있다." | 사용자 답변 | ACTIVE | — |
| D-002 | 주입점은 **모든** Harness+ModelProvider 에 걸린다. 대상 좁히기는 함수 안에서 식별자로 한다. | "모든 환경에 적용할 수 있어야 하며, 특정 하네스/공급자 환경에서만 적용될 수 도 있어야 함" | 사용자 답변 | ACTIVE | — |
| D-003 | 커스텀 env 는 하네스 레이어 전달 직전 **마지막**에 적용된다 — augmenter·settings·app·process 를 전부 이긴다. | "하네스 레이어에 전달되기 직전에" | 사용자 답변 | ACTIVE | — |
| D-004 | 함수에 주는 host env 는 `process.env` 스냅샷 한 장이다. `orca.json` app env 는 별도로 주지 않는다. | "맞다 — process.env 스냅샷". 사용자가 요청에서 든 입력은 `settings.json` 과 host env 둘뿐이다. | 사용자 답변 | ACTIVE | — |
| D-005 | 함수에 주는 대상 식별자는 `key`·`harnessId`·`modelProviderId` 셋이다. `harnessProviderId` 라는 새 이름을 만들지 않는다. | 저장소 어휘에 그 이름이 없다(`rg` 0건). 기존 정본은 `HarnessModelProviderKey` 다. | 조사 + 사용자 물음표 | ACTIVE | — |
| D-006 | 함수는 동기·순수다. `AbortSignal`·`Promise`·`AuthBinder`·`AuthSecretReader` 를 받지 않는다. | 원격·credential 은 `RuntimeConfigAugmenter` 의 책임이고, 그 경계는 0188 r5 가 타입으로 갈라 놓았다. | 추론 + 기존 계약 | ACTIVE | — |
| D-007 | entry 를 못 고른 턴에도 함수를 부르되 그 상태를 `resolved:false` 로 구분해 넘긴다. | 모드가 갈리는데 flat flag 로 두면 배포가 빈 문자열 key 를 실제 key 로 오인한다. | 추론 의도 | ACTIVE | — |
| D-008 | 기본 배포는 주입점을 비워 둔다(`undefined`). 미등록 턴의 동작·성능은 지금과 글자까지 같다. | 기존 정적 배포는 `options.env` 자체를 생략해 SDK 상속 fast path 를 쓴다. | 현행 계약 유지 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 D-001~D-008 을 신설했다. SUPERSEDED·OPEN 결정은 없다.
- 사용자 답변 4건이 각각 D-001·D-002·D-003·D-004 를 닫았다. 원문은 §2 에 인용으로 보존했다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC13, D-002↔AC1·AC2, D-003↔AC3·AC4, D-004↔AC5, D-005↔AC6, D-006↔AC14, D-007↔AC8, D-008↔AC9·AC10.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 주입 지점 자체가 없다. `RuntimeConfigAugmenter.resolve` 입력은 `{key, settings?}` 뿐이다(`runtime-config.ts:61-73`). |
| 이미 기존 코드가 충족하는가 | 아니오 | augmenter 는 `Partial<Record<key, …>>` 정확 매칭이라(`runtime-config.ts:76-78`) 빌드 시점에 모르는 key 에 붙지 않는다. D-002 를 만족하지 못한다. |
| 더 작은 해법이 있는가 | 있다 — 채택 | 새 서비스·cache·무효화 축을 만들지 않고 이미 spawn 입력 SSOT 인 `prepareHarnessConfig` 에 최종 레이어 하나를 더한다. |
| 더 작은 해법 2 — augmenter 입력만 넓히면 되는가 | 아니오 | 입력을 넓혀도 등록이 key 별이라 D-002 가 안 닫힌다. 반대로 augmenter 에 wildcard 를 넣으면 0188 r5 가 타입으로 가른 두 능력(config API / direct credential)과 `mergeAugmenters` 충돌 규칙이 흐려진다. |
| 선행 자료의 주장을 코드와 대조했는가 | 완료 | 0200 plan 이 적은 "query 소비 2곳"·"production prepare 2곳"을 재측정해 그대로 확인했다(§8 전수 조사). |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 한 곳 | D-003 이 `auth.md §6.4` 의 4층 우선순위 체인을 5층으로 늘린다. 사용자가 명시 결정했으므로 문서·주석 사본을 함께 고친다(§10 EP-08). |

- 사용자에게 올릴 결정: 없음. 네 갈래 모두 §2 에서 닫혔다.
- 코드 조사로 닫은 사실: `settings.json` 원문은 이미 `ResolvedHarnessSettings.settings` 로 augmenter 에 간다. 빠진 입력은 host env 하나이고, 그 값은 `prepareHarnessConfig` 의 `baseEnv()` 가 이미 같은 턴에 만든다(`harness-config.ts:262-263`).

## 5. 동작 / 사용자 흐름

```text
[턴 진입 — 사용자가 메시지를 보낸다]
  → Harness+ModelProvider entry 해석 (성공 / 실패)
  → runtime config 해석 (augmenter 있으면 원격 값 포함)
  → prepareHarnessConfig 가 process → app → settings → runtime 4층 조립
  → **배포 injector 를 마지막에 얹는다** (식별자 + settings.json + host env → 커스텀 env)
  → 최종 env 로 fingerprint 계산
  → ClaudeAdapter adaptEnv → query({options:{env}}) → Claude Code subprocess
  ↘ injector 미등록: 위 두 줄이 없던 것과 같다 — 기존 fast path 유지
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| injector 미등록(기본 배포) | 4층 조립만 수행 | 지금과 동일. 정적 배포는 `options.env` 자체가 없다. |
| injector 가 모든 key 에 값을 준다 | 최종 spread 로 얹는다 | 어느 provider 를 골라도 사내 프록시·인증서 변수가 subprocess 에 있다. |
| injector 가 특정 key 에만 값을 준다 | 나머지 key 는 빈 객체 | 그 key 의 턴만 값이 바뀐다. 다른 key 는 무회귀. |
| injector 값이 settings.json env 와 충돌한다 | injector 가 이긴다 | 운영자 설정보다 배포 적응값이 우선한다(D-003). |
| injector 값이 augmenter env 와 충돌한다 | injector 가 이긴다 | 하드코딩이 config API 응답을 덮는다 — §17 리스크로 명시한다. |
| entry 해석 실패 턴 | `resolved:false` 로 injector 호출 | 사내 프록시가 빠지지 않는다. fingerprint 는 여전히 "모른다"(`undefined`). |
| injector 결과만으로 env 가 생긴다 | settings 의 env 블록을 통째로 hoist | 두 채널에 같은 키가 남지 않는다 — 기존 결정표 유지. |
| injector 결과가 다음 턴에 달라진다 | 최종 env 가 달라져 fingerprint 변경 | 살아 있는 채널이 respawn 된다. |

### 파생 UX / 엣지케이스

- loading / empty / error: 새 비동기 경로가 없다. injector 가 던지면 기존 턴 오류 전파를 그대로 탄다.
- cancel / retry / close / restart: 변경 없음. injector 는 취소 대상이 아니다(동기).
- concurrency / multi-session: 세션마다 같은 조립을 독립 수행한다. 공유 상태를 만들지 않는다.
- keyboard / a11y / theme: 해당 없음 — renderer 변경 0 파일.
- 외부환경/오프라인/폐쇄망: 이 작업의 본체다. injector 는 network 를 부르지 않으므로 폐쇄망에서 추가 왕복이 0이다.

## 6. 범위 / 비범위

- **범위**: `prepareHarnessConfig` 의 최종 레이어 추가, 배포 주입점 파일 신설, `turn-setup` 두 호출부 배선, 우선순위 사본 4곳 정합, 순수 회귀 테스트.
- **비범위**: `RuntimeConfigAugmenter` 시그니처 변경, 새 설정 파일 스키마, IPC·UI·DB·마이그레이션, 신규 의존성, 실제 폐쇄망 값 하드코딩(배포자 몫).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| augmenter 입력에 host env 추가 | 아니오 — 필요해지면 같은 자리에 더한다 | 후속. D-002 를 이 작업이 다른 축으로 닫는다 |
| injector 반환값 런타임 문자열 검사 | 아니오 — in-repo TS 라 typecheck 가 잡는다 | 하지 않는다. 근거는 §10 |
| 주입점 이름 (`SpawnEnvInjector`) | **예 — 배포가 구현하는 공개 계약** | 지금 확정(§10) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | injector 를 등록하면 **어느 key 든** 그 반환값이 최종 `env` 에 있다 | 서로 다른 key 2개(`claude-anthropic`·`claude-corp`)로 조립해 두 결과 모두 injector 값 포함을 단언 | 배포 모듈 → turn-setup → prepareHarnessConfig → TurnRequest.env |
| R-02 | AT-02 / AC2 | injector 가 식별자로 대상을 좁히면 그 key 만 값이 바뀐다 | `key === 'claude-corp'` 일 때만 값을 내는 injector 로 두 key 조립 → 한쪽만 값, 다른 쪽 최종 env 는 미등록 조립과 동일 | 같은 경로 |
| R-03 | AT-03 / AC3 | injector 값이 augmenter `runtimeEnv` 를 이긴다 | 같은 키를 runtimeEnv 와 injector 가 다르게 줄 때 최종값이 injector 값 | 같은 경로 |
| R-04 | AT-04 / AC4 | 5층 상대 순서가 `custom > runtime > settings > app > process` 다 | 다섯 레이어가 같은 키 하나를 두고 경쟁하는 table test 에서 위에서부터 하나씩 걷어내며 최종값 5회 관측 | 같은 경로 |
| R-05 | AT-05 / AC5 | injector 는 `process.env` 스냅샷을 host env 로 받는다 | 주입 `baseEnv` 가 낸 값이 injector 입력 `hostEnv` 와 같은 내용임을 단언하고, injector 가 그 값을 읽어 파생 env 를 낼 수 있음을 단언 | Electron process env → prepareHarnessConfig → injector |
| R-06 | AT-06 / AC6 | injector 는 `key`·`harnessId`·`modelProviderId`·`settings.json` blob 을 받는다 | 네 값이 config 가 준 것과 같음을 단언. `settings` 는 env 블록을 걷어내기 **전** 원문 blob | 같은 경로 |
| R-07 | AT-07 / AC7 | injector 만으로 값이 생긴 턴도 settings 의 env 블록을 통째로 hoist 한다 | runtimeEnv·appEnv 없이 injector 만 있는 조립에서 `providerSettings.settings.env === undefined` 이고 그 값들이 최종 env 에 있음 | 같은 경로 → adaptSettings/adaptEnv |
| R-08 | AT-08 / AC8 | entry 를 못 고른 턴도 injector 를 부르고 `resolved:false` 로 구분한다 | `prepareUnresolvedHarnessConfig` 조립에서 injector 가 받은 target 의 `resolved` 가 `false` 이고 반환값이 최종 env 에 있음 | turn-setup `unresolvedPrepared` → prepareUnresolvedHarnessConfig |
| R-09 | AT-09 / AC9 | injector 미등록이면 env 미생성 fast path 가 그대로다 | 정적 settings-only + injector 없음 → `env === undefined`, `providerSettings` 가 입력과 **같은 참조** | 기본 배포 턴 |
| R-10 | AT-10 / AC10 | injector 가 빈 객체를 돌려주면 미등록과 같은 결과다 | 위와 같은 입력에 `() => ({})` injector → `env === undefined`, 같은 참조 | 대상 밖 key 의 턴 |
| R-11 | AT-11 / AC11 | injector 결과가 달라지면 fingerprint 가 달라진다 | 같은 4층 입력에 injector 값만 바꿔 `envFingerprint` 두 값이 다름을 단언 | prepared fingerprint → runtimeEnvChangedSinceSpawn → respawn |
| R-12 | AT-12 / AC12 | injector 가 host-managed flag 를 최종 판정한다 | injector 가 flag `1` 을 주면 settings-only 정적 배포에서도 env 가 만들어지고 settings env 가 hoist 된다. injector `0` 이 하위 `1` 을 끈다 | 같은 경로 |
| R-13 | AT-13 / AC13 | 배포자는 `app/deployment/` 파일 하나만 채운다 | 가이드 예제를 실제 타입에 대입해 `typecheck` 가 통과. 기본 배포 export 가 `undefined` 임을 단언 | 배포자 편집 → bootstrap 없이 turn-setup 이 직접 참조 |
| R-14 | AT-14 / AC14 | injector 는 credential·network 능력을 받지 않는다 | 타입 단언 테스트 — injector 입력에 `auth`·`secrets`·`signal` 키가 없음을 `@ts-expect-error` 로 고정 | 타입 경계 |
| R-15 | AT-15 / AC15 | 디스크 `settings.json` 은 그대로이고 secret 은 `options.settings` 로 복제되지 않는다 | injector 가 token 을 낸 조립에서 원본 blob 불변 + `providerSettings.settings` 에 그 token 부재 | 기존 secret 격리 계약 회귀 |
| R-16 | AT-16 / AC16 | 우선순위 서술 사본 4곳이 5층으로 일치한다 | 네 좌표를 각각 열어 `custom` 층이 있는지 확인 + `check-doc-inventory.mjs --check` exit 0 | 문서 독자(배포자·에이전트) |

### AC 검증 주의사항

- 기존 테스트 재사용: `harness-config.test.ts:41` `runtimeEnv > settings env > app env > process env` 와 `:139` `동적 값도 app env 도 없으면 env 옵션을 생략한다`, `:265` `정확히 1이 아닌 settings-only flag 는 host-managed fast path 를 켜지 않는다` 세 케이스가 실재한다(`grep -n "  it("` 로 확인). AC9·AC12 는 그 케이스들의 무회귀를 함께 요구한다.
- 사람 실기 항목: 없다. 조립은 순수 동기이고 `baseEnv` 는 주입 seam이라 전 경로를 기계 검증한다.
- N회/총량 기준: AC1·AC2 는 총량이 아니라 key 2개 표본이다. 전수 축은 §10 EP 표가 갖는다. injector 를 부르는 프로덕션 지점은 `prepareHarnessConfig` 1곳이고(`rg 'prepareHarnessConfig\('` 비테스트 3건 = 정의 1 + 내부 위임 1 + turn-setup 1), 배선 지점은 turn-setup 2곳이다.
- 총량/0건 기준: AC14 의 `@ts-expect-error` 는 미사용 directive 자체가 TS 오류라 `typecheck:test` green 이 곧 증거다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 이 slug 에 상속할 기존 V 가 없다(0200 은 V 프로토콜 도입 이전 plan 이라 node/pair registry 가 없다 — `docs/handoff/0200-host-managed-runtime-env/plan.md` 에 `V mode` 행 부재).
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: R (배포자가 관측하는 새 능력).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 모든 key 적용 | NEW | — |
| R-02 | R | §7 대상 좁히기 | NEW | — |
| R-03 | R | §7 augmenter 를 이김 | NEW | — |
| R-04 | R | §7 5층 상대 순서 | NEW | — |
| R-05 | R | §7 host env 입력 | NEW | — |
| R-06 | R | §7 식별자·settings 입력 | NEW | — |
| R-07 | R | §7 custom-only hoist | NEW | — |
| R-08 | R | §7 unresolved 턴 | NEW | — |
| R-09 | R | §7 미등록 fast path | INHERITED | `harness-config.test.ts:139` |
| R-11 | R | §7 fingerprint 변화 | NEW | — |
| R-12 | R | §7 host-managed 최종 판정 | CHANGED | 0200 `harness-config.ts:266-276` (4층 → 5층) |
| R-13 | R | §7 배포자 편집 표면 | NEW | — |
| R-15 | R | §7 secret 격리 | INHERITED | `harness-config.test.ts:275` |
| SD-01 | SD | §5·§9 턴 진입 → subprocess env 종단 경로 | CHANGED | 0200 §12 (레이어 1개 추가) |
| SD-02 | SD | §5·§13 unresolved 턴 수명주기 | CHANGED | `harness-config.ts:308-320` |
| SD-03 | SD | §5·§13 fingerprint → respawn 수명주기 | INHERITED | `runtime-boundary.ts:34-42` |
| AR-01 | AR | §9·§10 배포 모듈 → turn-setup → adapter 조립 경계 | NEW | — |
| AR-02 | AR | §10 `adapters` 는 `app` 을 import 하지 않는다 | INHERITED | `eslint.config.mjs:158` |
| AR-03 | AR | §10 두 채널 결정표(hoist) | INHERITED | `harness-config.ts:168-205` |
| AR-04 | AR | §10 우선순위 서술 사본 4곳 | CHANGED | `harness-config.ts:118-124`·`auth.md:527-533`·`closed-network-extensions.md:455`·`harness-config.test.ts:41` |
| MD-01 | MD | §10·§11 최종 spread 순서 | CHANGED | `harness-config.ts:284-291` |
| MD-02 | MD | §10·§11 `buildsEnv` 판정식 | CHANGED | `harness-config.ts:281` |
| MD-03 | MD | §10·§11 host-managed 판정 체인 | CHANGED | `harness-config.ts:266-276` |
| MD-04 | MD | §10·§11 `baseEnv` 1회 스냅샷 | INHERITED | `harness-config.ts:262-263` |
| MD-05 | MD | §10·§11 `SpawnEnvTarget` discriminated union | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 배포 injector → turn-setup:93 → prepareHarnessConfig → `PreparedHarnessConfig.env` | key 2종 조립 결과의 최종 env 값 직접 관측 | not selected — 반환 env 값을 직접 읽는다 | EP-01 (2) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 같음 | 좁힌 injector 의 두 key 결과 차이 직접 관측 | not selected — 직접 값 대조 | EP-01 (2) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 같음 | 충돌 키 최종값 직접 관측 | not selected — 직접 값 | EP-01 (2) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 같음 | 5층 경쟁에서 위층을 하나씩 걷어낸 5회 최종값 | **required** — 순서가 바뀌어도 "값이 있다"는 통과한다. `harness-config.ts` 최종 spread 에서 `customEnv` 를 `runtimeEnv` **앞으로** 옮기는 변이를 심어 red 를 확인한다 | EP-01 (2) |
| VP-05 | MD-01 ↔ UT-01 | REQUIRED | prepareHarnessConfig 내부 spread | 최종 객체의 키별 출처 단언 | not selected — VP-04 가 순서를 잠근다 | EP-01 (2) |
| VP-06 | R-05 ↔ AT-05 | REQUIRED | 주입 `baseEnv` → injector 입력 `hostEnv` | injector 가 받은 `hostEnv` 를 캡처해 `baseEnv()` 산출과 대조 | not selected — 입력을 직접 캡처한다 | EP-02 (2) |
| VP-07 | R-06 ↔ AT-06 | REQUIRED | config → injector 입력 target | 캡처한 target 의 4필드 직접 대조 | not selected — 직접 값 | EP-02 (2) |
| VP-08 | MD-05 ↔ UT-02 | REQUIRED | 타입 경계 | `resolved:false` 분기에서 `key` 접근이 컴파일 오류임을 `@ts-expect-error` 로 고정 | not selected — 컴파일러가 직접 판정 | EP-03 (1) |
| VP-09 | R-08 ↔ AT-08 | REQUIRED | turn-setup:116 → prepareUnresolvedHarnessConfig → prepareHarnessConfig | unresolved 조립에서 캡처한 target 의 `resolved===false` + 최종 env 값 | **required** — `prepareUnresolvedHarnessConfig` 가 injector 를 **전달하지 않아도** resolved 경로 테스트는 전부 통과한다. 위임 인자에서 injector 를 빼는 변이를 심어 red 를 확인한다 | EP-04 (2) |
| VP-10 | SD-02 ↔ ST-01 | REQUIRED | 같음 | unresolved 턴의 `runtimeEnvFingerprint === undefined` 와 env 값 동시 관측 | not selected — 두 필드 직접 관측 | EP-04 (2) |
| VP-11 | R-07 ↔ AT-07 | REQUIRED | prepareHarnessConfig → `providerSettings` | custom-only 조립의 `settings.env === undefined` + 값 hoist 동시 관측 | not selected — 두 채널 상태 직접 관측 | EP-05 (1) |
| VP-12 | MD-02 ↔ UT-03 | REQUIRED | `buildsEnv` 판정 | custom 만 있는 입력에서 `env !== undefined` | not selected — 직접 값 | EP-05 (1) |
| VP-13 | AR-03 ↔ IT-01 | REGRESSION | 기존 두 채널 결정표 3케이스 | `harness-config.test.ts:521-560` 재실행 green | not selected — 기존 직접 oracle | EP-05 (1) |
| VP-14 | R-09 ↔ AT-09 | REGRESSION | 정적 settings-only 턴 | `env === undefined` + `providerSettings` 참조 동일 | not selected — 참조 비교 직접 | EP-06 (1) |
| VP-15 | R-10 ↔ AT-10 | REQUIRED | 대상 밖 key 턴 | 빈 객체 반환 시 위와 같은 두 관측 | not selected — 직접 값 | EP-06 (1) |
| VP-16 | R-12 ↔ AT-12 | REQUIRED | injector → host-managed 판정 체인 | injector `1` 로 settings-only hoist 발생, injector `0` 이 settings `1` 을 끔 | **required** — 판정 체인에서 `customEnv[FLAG]` 항을 지워도 "값이 실린다"는 통과한다(custom 이 `buildsEnv` 를 따로 켠다). 그 항을 지우는 변이로 red 확인 | EP-07 (1) |
| VP-17 | MD-03 ↔ UT-04 | REQUIRED | 판정 체인 5항 | 다섯 레이어별 flag 우선순위 table | not selected — VP-16 이 방향을 잠근다 | EP-07 (1) |
| VP-18 | R-11 ↔ AT-11 | REQUIRED | 최종 env → `harnessEnvFingerprint` | injector 값만 바꾼 두 조립의 `envFingerprint` 상이 | not selected — 두 값 직접 비교 | EP-08 (1) |
| VP-19 | SD-03 ↔ ST-02 | REGRESSION | fingerprint → `runtimeEnvChangedSinceSpawn` → respawn | 기존 fingerprint suite(`:300-390`) green + 위 신규 케이스 | not selected — 기존 직접 oracle | EP-08 (1) |
| VP-20 | MD-04 ↔ UT-05 | REGRESSION | `baseEnv` lazy 스냅샷 | injector 등록 턴에서도 `baseEnv` 호출 **1회** | not selected — 호출 카운터 직접 | EP-09 (1) |
| VP-21 | AR-01 ↔ IT-02 | REQUIRED | `app/deployment/spawn-env.ts` → turn-setup 2 호출부 | turn-setup 의 두 호출부가 같은 상수를 넘기는지 `rg` 전수 2/2 + 기본 배포 export 가 `undefined` | **required** — 배선 존재 oracle 이다. 한 호출부에서 인자를 빼는 변이로 red 확인(VP-09 와 같은 축, 다른 지점) | EP-04 (2) |
| VP-22 | AR-02 ↔ IT-03 | REGRESSION | eslint boundaries | `npm run lint` 0 error — `adapters` 가 `app` 을 물지 않음 | not selected — 린터가 직접 판정 | EP-10 (1) |
| VP-23 | R-13 ↔ AT-13 | REQUIRED | 가이드 예제 → 실제 타입 | 가이드 예제를 테스트에 그대로 대입해 `typecheck:test` 통과 | not selected — 컴파일러가 직접 판정 | EP-11 (1) |
| VP-24 | R-14 ↔ AT-14 | REQUIRED | 타입 경계 | injector 입력에 `signal`·`auth`·`secrets` 접근이 컴파일 오류 | not selected — 컴파일러 직접 | EP-03 (1) |
| VP-25 | R-15 ↔ AT-15 | REGRESSION | secret 격리 | `harness-config.test.ts:274-298` green + injector token 케이스 | not selected — 기존 직접 oracle | EP-05 (1) |
| VP-26 | AR-04 ↔ IT-04 | REQUIRED | 우선순위 서술 4 사본 | 네 좌표 각각에서 `custom` 층 문장 존재 확인 | **required** — 사본 4곳 중 하나만 고쳐도 나머지 테스트는 통과한다. 한 사본을 4층으로 되돌리는 변이를 심어, 그 사본을 읽는 검사(테스트 케이스명 + `rg` 전수)가 red 인지 확인 | EP-12 (4) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app/AGENTS.md` 기본 정적 게이트 | `app/src/main/**` 3파일을 고친다 | `cd app && npm run lint && npm run typecheck` | 이번 diff 가 낸 error 만 blocking. 기존 renderer warning 1건은 베이스라인 |
| 관련 vitest 스위트 | 조립·배선 회귀가 이 두 스위트에 산다 | `cd app && ./node_modules/.bin/vitest run src/main/adapters/harness-config.test.ts src/main/app/deployment` | 이번 변경이 낸 red 만 blocking |
| `check-doc-inventory.mjs` | `docs/**` 3파일을 고치고 상대 링크를 추가한다 | `cd app && node scripts/check-doc-inventory.mjs --check` | exit 0 필요. 수치 재서술·깨진 링크가 blocking |
| better-sqlite3 ABI 베이스라인 | DB 스위트를 이 변경이 건드리지 않는다 | 위 스위트는 비-DB 라 네이티브 미로드 | DB 로드 red 는 환경 기인으로 분리 보고 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| augmenter 입력은 `{key, settings?}` + `signal` 뿐이다 — host env 가 없다 | `app/src/main/features/harnesses/runtime-config.ts:61-73` |
| augmenter 등록은 key 정확 매칭 `Partial<Record<…>>` 다 | `app/src/main/features/harnesses/runtime-config.ts:76-78` |
| `settings.json` 원문 blob 은 이미 `ResolvedHarnessSettings.settings` 로 흐른다 | `app/src/main/adapters/harness-config.ts:16-26` |
| 최종 4층 spread 가 우선순위 정본이다 | `app/src/main/adapters/harness-config.ts:284-291` |
| `baseEnv` 는 판정과 조립이 같은 스냅샷을 쓰도록 lazy 1회다 | `app/src/main/adapters/harness-config.ts:262-263` |
| host-managed 판정 체인은 4항 `??` 다 | `app/src/main/adapters/harness-config.ts:266-276` |
| `buildsEnv` 는 runtime·app·hostManaged 3항이다 | `app/src/main/adapters/harness-config.ts:281` |
| fingerprint 는 최종 env 하나로 1회 계산되고 두 필드가 나눠 쓴다 | `app/src/main/adapters/harness-config.ts:293-301` |
| `adapters` 는 `adapters·adapter-impl·infra·shared` 만 import 할 수 있다 — `app` 은 금지 | `app/eslint.config.mjs:158` |
| `app` 은 모든 하위 레이어를 import 할 수 있다 | `app/eslint.config.mjs:150-156` |
| `HarnessNativeSettings` 는 임의 JSON 이라 subprocess 로는 문자열만 거른다 | `app/src/main/adapters/harness-config.ts:222-231` |
| 배포 레시피 정본은 소스 주석이 아니라 가이드다(0190 A1) | `app/src/main/app/deployment/harness-runtime.ts:24-27` |
| 두 능력(config API / direct credential)은 타입으로 갈라져 있다 | `app/src/main/app/deployment/harness-runtime.ts:45-70` |
| `harnessProviderId` 라는 어휘는 저장소에 없다 | `rg -in 'harnessProviderId'` → 0건 |
| doc inventory 는 배포 확장점을 세지 않는다 | `docs/generated/inventory.md` 내역 9절에 해당 항목 없음 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| production `prepareHarnessConfig` / `prepareUnresolvedHarnessConfig` 호출 | `rg 'prepareHarnessConfig\(\|prepareUnresolvedHarnessConfig\(' app/src --glob '*.ts'` 에서 테스트 제외 | 3 | 정의 1 + 내부 위임 1(`:313`) + turn-setup 1(`:93`). 여기에 `prepareUnresolvedHarnessConfig` 호출 1(`turn-setup.ts:116`) — 배선 지점은 turn-setup 2곳이다 |
| production `adaptEnv` 호출 | `rg 'adaptEnv\(' app/src --glob '*.ts'` 에서 정의·테스트 제외 | 2 | `claude.ts:263`(complete) · `claude.ts:383`(sendMessage). 둘 다 prepared env 를 그대로 받는다 |
| 우선순위 체인 서술 사본 | `rg "settings env > app env\|선택된 Harness + ModelProvider settings 의 env\|augmenter env >"` (handoff·archive 제외) | 4 | `harness-config.ts:122` · `auth.md:531` · `closed-network-extensions.md:455` · `harness-config.test.ts:41`(케이스명) |
| `turn-setup.ts` 의 deployment import | `rg "from '.*deployment" app/src/main/app/chat-turn/*.ts` | 0 | 새 import 를 이 작업이 처음 추가한다 |
| 기본 배포 augmenter factory | `deployment-wiring.test.ts:409` `augmenter factory 3종은 기본 배포에서 비어 있다` | 1 | 기본 배포가 비어 있다는 불변식이 이미 테스트로 잠겨 있다 — 새 주입점도 같은 스위트에 넣는다 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 0200 plan 이 적은 "production prepare 2" 는 이번 세션 검색에서도 성립한다(정의 제외 시 위임 1 + turn-setup 1). "query 소비 2" 도 `adaptEnv` 2건과 일치한다.
- 내역 합 = 총계: 우선순위 사본 4 = 코드 주석 1 + arch 1 + guide 1 + 테스트 케이스명 1.
- "유일한/항상/절대" 반례 검색: "최종 env 를 만드는 자리는 `prepareHarnessConfig` 하나" 를 `rg 'baseEnv:'` 비테스트로 전수 확인 → 2건, 둘 다 turn-setup 의 resolved/unresolved 경로다. 다른 조립처는 없다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `auth.md §6.2`·`§6.4` 실재(`sed -n '486,545p'`). `harness-config.test.ts` 의 `:41`·`:139`·`:265`·`:275`·`:521` 케이스 실재(`grep -n "  it("`).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`.
- 현재 책임 소유자: `adapters/harness-config.ts` 가 spawn 입력 조립을 단독으로 갖는다.
- 현재 entry → flow → consumer: 턴 진입 → `resolveTurnProvider` 가 entry 를 고르고 `harnessRuntime.resolve` 로 `runtimeEnv` 를 받는다 → `prepareHarnessConfig` 가 4층을 spread → `TurnRequest.env` → `adaptEnv` → SDK.
- 현재 오류/취소/정리 경로: 조립은 순수 동기라 취소 대상이 아니다. augmenter 만 async 이고 그 실패는 `resolveTurnProvider` 밖으로 던진다.
- 구조적 제약: 배포가 값을 넣을 자리가 augmenter 하나뿐이고, 그것은 key 별 등록이라 운영자가 만든 디렉토리에는 닿지 않는다.

```text
[턴 진입]
  → resolveTurnProvider (entry 선택)
  → harnessRuntime.resolve → runtimeEnv        ← 배포가 값을 넣는 유일한 자리(key 별)
  → prepareHarnessConfig  (process → app → settings → runtime)
  → TurnRequest.env → adaptEnv → query
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `SD-02`, `AR-01`, `MD-01`, `MD-05`.
- 변경 후 책임 소유자: `adapters/harness-config.ts` 가 조립을 계속 단독으로 갖는다. 배포는 **값을 계산하는 순수 함수**만 소유하고 조립 규칙을 갖지 않는다.
- 변경 후 entry → flow → consumer: 4층 spread 뒤 injector 를 호출해 5층째를 얹고, 그 최종 env 로 fingerprint 를 계산한다. 하류(`adaptEnv` → SDK)는 그대로다.
- 변경 후 오류/취소/정리 경로: injector 가 동기라 새 취소·정리 경로가 없다. 던지면 기존 턴 오류 전파를 탄다.
- 유지하는 메커니즘: 두 채널 결정표(hoist)·WeakMap 참조 안정성·lazy baseEnv 1회·fingerprint 1회 계산. 대체하는 메커니즘: 없다 — 레이어를 더할 뿐 기존 층을 지우지 않는다.

```text
[턴 진입]
  → resolveTurnProvider (entry 선택 / 실패)
  → harnessRuntime.resolve → runtimeEnv
  → prepareHarnessConfig  (process → app → settings → runtime → **custom**)
        ↑ injector(target, hostEnv)   ← app/deployment/spawn-env.ts (모든 key)
  → envFingerprint(최종 env)
  → TurnRequest.env → adaptEnv → query
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 배포 값 주입은 key 별 augmenter 뿐 | 배포 값 주입이 두 축 — 동적/원격은 augmenter, 정적/전역은 injector | D-002·D-006 | AR-01 / VP-01·VP-21 · `app/deployment/spawn-env.ts` |
| data/control flow | 4층 spread | 5층 spread — custom 이 최상위 | D-003 | MD-01 / VP-04·VP-05 · `harness-config.ts` |
| state/contract | `PrepareHarnessConfigInput` 4필드 | `customEnv?: SpawnEnvInjector` 추가 + `SpawnEnvTarget` union 신설 | D-005·D-007 | MD-05 / VP-08 · 타입 |
| state/contract 2 | host-managed 판정 4항 | 5항 — custom 이 최상위 | 판정 순서 = 조립 순서 불변식 유지 | MD-03 / VP-16·VP-17 |
| state/contract 3 | `buildsEnv` 3항 | 4항 — custom 비어있지 않음 추가 | injector 만으로도 env 가 필요하다 | MD-02 / VP-12 |
| error/lifecycle | unresolved 경로가 injector 를 모름 | 위임 시 injector 를 함께 넘기고 `resolved:false` 로 알린다 | D-007 | SD-02 / VP-09·VP-10 |
| test seam/관측점 | 주입 `baseEnv` 하나 | `baseEnv` + 주입 `customEnv`(호출 인자 캡처 가능) | 입력 4종을 직접 관측한다 | MD-05 / VP-06·VP-07 |
| 문서 계약 | 우선순위 4층이 4곳에 서술 | 5층이 같은 4곳에 서술 | 사본이 갈리면 배포자가 틀린 순서를 믿는다 | AR-04 / VP-26 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/harness-config.ts` | 5층 조립·hoist·flag 판정·fingerprint. injector 계약 타입의 SSOT | 4 producer + injector → `PreparedHarnessConfig` | `app/chat-turn/turn-setup.ts` |
| `app/deployment/spawn-env.ts` | 배포별 커스텀 env **값**만 계산 | `{target, hostEnv}` → `Record<string,string>` | `app/chat-turn/turn-setup.ts` |
| `app/chat-turn/turn-setup.ts` | 배포 상수를 조립부에 넘기는 배선 2줄 | — | 턴 핸들러 |
| `adapters/claude.ts` | prepared env 를 SDK options 로 변환 | env → `options.env` | complete / sendMessage |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01 / VP-04·VP-05 | 최종 spread 최상위 = `customEnv` (**EP-01**) | `harness-config.ts` 최종 spread | prepare | resolved 조립 · unresolved 위임 조립 = **2지점** | 배포 적응값이 augmenter·settings 에 밀려 폐쇄망에서 잘못된 endpoint 로 나간다 |
| MD-05 / VP-06·VP-07 | injector 입력 = `{target, hostEnv}` (**EP-02**) | `SpawnEnvInjector` 타입 | prepare | injector 호출 지점 · 타입 선언 = **2지점** | 배포가 대상 판별 재료를 못 받아 전역 하드코딩만 가능해진다 |
| MD-05 / VP-08·VP-24 | `SpawnEnvTarget` 은 discriminated union, injector 는 동기·무능력 (**EP-03**) | 같은 타입 | 컴파일러 | `typecheck:node` + `typecheck:test` = **1지점** | 빈 문자열 key 를 실제 key 로 오인하거나 배포가 credential 을 쥔다 |
| AR-01·SD-02 / VP-09·VP-10·VP-21 | injector 배선 (**EP-04**) | `turn-setup.ts` | 컴포지션 | `prepareHarnessConfig` 호출 1 + `prepareUnresolvedHarnessConfig` 호출 1 + 그 내부 위임 1 = **2지점**(turn-setup 2줄) + 위임 1 = **3지점** | 한 경로만 배선되면 entry 해석 실패 턴에서 사내 프록시가 사라진다 |
| AR-03 / VP-11·VP-12·VP-13·VP-25 | `buildsEnv` 에 custom 포함 + hoist (**EP-05**) | `harness-config.ts` `buildsEnv` | prepare | 판정식 **1지점** | injector 값이 조용히 버려지거나 같은 키가 두 채널에 남는다 |
| R-09·R-10 / VP-14·VP-15 | 미등록·빈 반환의 fast path (**EP-06**) | 같은 판정식 | prepare | 판정식 **1지점** | 기본 배포가 매 턴 불필요한 env 를 만들고 참조 안정성이 깨진다 |
| MD-03 / VP-16·VP-17 | host-managed 판정 체인 최상위 = custom (**EP-07**) | `explicitHostManaged` 식 | prepare | 판정식 **1지점** | 판정 순서와 조립 순서가 갈려 같은 턴에서 모드와 실제 env 가 어긋난다 |
| SD-03 / VP-18·VP-19 | fingerprint 는 custom 포함 최종 env 로 계산 (**EP-08**) | `harnessEnvFingerprint(env)` 호출 | prepare | 조립 직후 **1지점** | injector 값이 바뀌어도 stale subprocess 를 재사용한다 |
| MD-04 / VP-20 | `baseEnv` 1회 스냅샷 재사용 (**EP-09**) | lazy `baseEnv` closure | prepare | 판정·조립·injector 입력 **1지점**(같은 closure) | 판정과 실행이 서로 다른 process.env 순간을 읽는다 |
| AR-02 / VP-22 | `adapters` 는 `app` 을 import 하지 않는다 (**EP-10**) | `eslint.config.mjs:158` | eslint | `npm run lint` **1지점** | 조립부가 배포 모듈을 물어 DAG 가 깨진다 |
| R-13 / VP-23 | 가이드 예제가 실제 타입에 대입된다 (**EP-11**) | `closed-network-extensions.md` 새 절 | 컴파일러 | 예제를 옮긴 테스트 **1지점** | 배포자가 컴파일되지 않는 예제를 따라 쓴다 |
| AR-04 / VP-26 | 우선순위 서술 5층 사본 (**EP-12**) | 사본 없음 — 4곳이 같은 문장을 갖는다 | 작성자 | `harness-config.ts:118-124` · `auth.md:527-533` · `closed-network-extensions.md:455` · `harness-config.test.ts:41` = **4지점** | 배포자가 4층 문서를 믿고 settings 로 덮으려다 실패한다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: 우선순위는 **코드 spread 순서가 유일한 실행 정본**이고 나머지 3곳은 서술 사본이다. 사본을 없앨 수는 없다(arch 는 구조를, guide 는 절차를, 테스트 케이스명은 회귀 의도를 서술한다) — 그래서 EP-12 를 4지점으로 세고 VP-26 이 한 사본만 고치는 회귀를 잡는다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음 — 어느 행도 다른 게이트에 위임하지 않았다.
- 선택적 필드의 `true/false/undefined` 의미: `customEnv` 미지정 = 주입 없음(기존 동작). 빈 객체 반환 = 주입할 값 없음(미지정과 같은 결과, D-008). `SpawnEnvTarget.settings` 미지정 = 이번 턴에 settings 를 해석하지 못함.
- 외부 SDK 경계의 실제 요구 타입/의미: 변경 없음. `options.env` 는 상속을 포함한 완전한 `Record<string,string>` 이어야 한다는 기존 계약 그대로다.
- injector 반환값에 런타임 문자열 필터를 두지 않는다: `settings.json` 은 디스크의 임의 JSON 이라 `stringEnvOf` 가 거르지만, injector 는 in-repo TypeScript 라 `Record<string,string>` 을 컴파일러가 강제한다. 필터를 더하면 강제 지점만 늘고 잡히는 결함이 없다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/harness-config.ts` | spawn 입력 SSOT | `SpawnEnvTarget`·`SpawnEnvInjector` 타입 신설. `PrepareHarnessConfigInput.customEnv?` 추가. 5층 spread·4항 `buildsEnv`·5항 flag 체인. `prepareUnresolvedHarnessConfig` 가 `customEnv` 를 받아 위임 | 주입 `baseEnv` + 주입 `customEnv`(순수 Vitest) |
| `app/src/main/adapters/harness-config.test.ts` | 의미 회귀 | AC1~AC12·AC15 케이스 + 기존 결정표·fingerprint·fast path 무회귀 | 순수 Vitest |
| `app/src/main/app/deployment/spawn-env.ts` | 배포 주입점 (신규) | `SPAWN_ENV_INJECTOR: SpawnEnvInjector \| undefined = undefined` + 계약 4줄 주석 + 가이드 링크 | `deployment-wiring.test.ts` |
| `app/src/main/app/deployment/deployment-wiring.test.ts` | 배포 계약 | 기본 배포 export 가 `undefined` · 가이드 예제 대입 typecheck · 능력 부재 `@ts-expect-error` | 순수 Vitest |
| `app/src/main/app/chat-turn/turn-setup.ts` | 배선 | 두 호출부에 `customEnv: SPAWN_ENV_INJECTOR` 전달 | electron 의존 — 검증은 `rg` 전수 + 조립부 테스트 |
| `docs/arch/backend/auth.md` | 현재 구조 | §6.2 에 주입점 추가, §6.4 체인 5층 | 문서 grep |
| `docs/guides/closed-network-extensions.md` | 실행 절차 | §0 라우팅 표 행 추가 + 새 절(레시피 B 뒤) | 문서 grep + 예제 대입 |
| `app/src/main/app/deployment/harness-runtime.ts` | 경계 안내 | 헤더 주석에 "정적 전역 적응은 `spawn-env.ts`" 한 줄 | 문서 grep |

### 타입 계약 (초안 — 정본은 구현)

```ts
// adapters/harness-config.ts
export type SpawnEnvTarget =
  | {
      resolved: true
      key: HarnessModelProviderKey
      harnessId: string
      modelProviderId: string
      // settings.json 원문 blob — env 블록을 걷어내기 전 값이다.
      settings?: HarnessNativeSettings
    }
  | { resolved: false }

// 동기·순수. signal·auth·secret 을 받지 않는다(D-006).
export type SpawnEnvInjector = (input: {
  target: SpawnEnvTarget
  // process.env 스냅샷 한 장 (D-004).
  hostEnv: Readonly<Record<string, string>>
}) => Record<string, string>
```

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: 불필요하다. `harness-config.ts` 의 런타임 import 는 `node:crypto` 하나뿐이라 이미 vitest 가 연다(0190 A3 이 확인한 사실).
- 기존 메커니즘 재사용 시 형상/시점 적합성: `withEnvBlockHoisted` 는 `buildsEnv` 가 참일 때만 걸린다. custom 만으로 `buildsEnv` 를 켜면 그 조건이 그대로 성립한다 — 새 분기가 필요 없다.
- 순서를 관측할 훅/로그/주입 경계: 주입 `customEnv` 가 받은 인자를 캡처해 `hostEnv`·`target` 을 직접 읽는다. spread 순서는 5층이 같은 키를 두고 경쟁하는 table 로 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
app/deployment/spawn-env.ts (producer)
  → turn-setup 배선 2지점
  → prepareHarnessConfig 5층 조립 + fingerprint
  → TurnRequest.env
  → ClaudeAdapter adaptEnv (2 호출부)
  → SDK query options.env → Claude Code subprocess
```

- producer 기준: injector 가 돌려준 `Record<string,string>` 그대로다. 조립부는 값을 변형하지 않는다.
- consumer 파생 규칙: 없다. `adaptEnv` 는 비어 있지 않으면 그대로 싣는다(`claude-adapt.ts:100-102`).
- 파생 가능한 합성값이 정본을 우회하지 않는가: `envFingerprint` 가 최종 env 에서 파생되므로 injector 층을 빼먹은 별도 계산 경로가 생기지 않는다. fingerprint 계산은 1지점이다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `SessionRuntime` spawn 기록 (`envFingerprint`) | injector 값이 fingerprint 에 포함돼 respawn 판정이 넓어진다 | AC11 |
| `runtimeEnvChangedSinceSpawn` 두 호출부 | 판정 함수는 그대로 — 입력 값만 달라진다 | AC11 · VP-19 |
| `providerSettingsChangedSinceSpawn` 참조 fast path | custom-only 턴이 `buildsEnv` 를 켜면 hoist 사본이 만들어진다. WeakMap 이라 참조는 여전히 안정적이다 | AC7 · VP-13 |
| 기본 배포(injector 미등록) | 조립 결과·참조·성능 불변 | AC9 · VP-14 |
| `deployment-wiring.test.ts:409` "augmenter factory 3종은 기본 배포에서 비어 있다" | 주입점이 factory 가 아니라 상수라 그 단언은 그대로 성립한다 | AC13 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: injector 는 조립 시점에 동기 호출된다. 프로세스 수명 상태를 갖지 않는다.
- 취소/중단: 해당 없음 — 동기라 취소 지점이 없다.
- 종료/quit/crash/renderer-gone: 변경 없음.
- retry/timeout/partial failure: injector 가 던지면 그 턴이 실패한다. 반쯤 채운 env 로 spawn 하지 않는다 — 이는 `harness-runtime.ts` 가 augmenter 에 세운 규칙과 같은 축이다.
- cleanup/rollback: 새 자원이 없다.
- **다중 저장소 쓰기**: 코드에는 해당 없음 — injector 는 읽기만 하고 조립은 in-memory 다. **문서 산출물에는 해당한다**: 이 handoff 의 판정·상태가 `plan.md` 와 `docs/handoff/INDEX.md` 두 곳에 산다. 두 사본은 각 단계 커밋에서 함께 갱신한다. 우선순위 서술 사본 4곳도 같은 종류의 위험이라 §10 EP-12 가 4지점 전부를 세고 VP-26 이 한 곳만 고친 회귀를 잡는다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 해당 없음 — 모델 출력·프롬프트를 늘리지 않는다.
- 새 요청 수의 `원천 상한 × 배치 상한`: **0**. injector 는 network 를 부르지 않는다(D-006). 폐쇄망 왕복 증가 0.
- 구조적 목표(줄/파일/모듈 수): 없다.
- 캐시/snapshot/호출 축소로 잃는 부수 효과와 회귀 테스트: injector 가 등록된 배포에서는 `baseEnv()` 가 항상 한 번 호출된다(injector 입력에 필요). 미등록 배포는 기존 lazy 조건 그대로다 — 호출 0회 경로가 유지되는지를 VP-20 이 카운터로 관측한다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: `SpawnEnvInjector` 함수 하나. 배포자는 `app/src/main/app/deployment/spawn-env.ts` 의 상수를 채운다.
- 구현 문서: `docs/guides/closed-network-extensions.md` — §0 라우팅 표에 행을 더하고 레시피 B 뒤에 절을 신설한다. arch 서술은 `docs/arch/backend/auth.md §6.2`.
- **shape 검증**: 가이드 예제를 `deployment-wiring.test.ts` 에 그대로 옮겨 `typecheck:test` 로 컴파일한다(AC13 · EP-11). 0190 A1 이 "소스와 가이드에 같은 레시피를 두면 갈린다 — 실제로 갈렸다" 고 관측했으므로 레시피 본문은 가이드에만 두고 소스 주석은 계약 4줄로 제한한다.
- **semantics 검증**: 빈 객체 반환 = 미등록과 같은 결과(AC10), 던지면 턴 실패(§13), `resolved:false` 는 entry 미선택(AC8) — 세 의미를 각각 테스트가 잡는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| `runtime > settings > app > process` 4층 우선순위 | `harness-config.ts:118-124` · `auth.md:527-533` · guide:455 | §9 Delta "5층 spread", §10 EP-01·EP-12 | **변경** — 사용자 명시 결정 D-003. 상대 순서는 보존하고 위에 한 층을 얹는다 |
| env 생성 시 settings env 전체 hoist | `harness-config.ts:168-205` | §10 EP-05, AC7 | 유지 |
| 정적 fast path 참조 안정성 | `harness-config.ts` WeakMap · 테스트 `:459` | AC9·AC10 | 유지 |
| 해석 실패 턴은 fingerprint 를 내지 않는다 | `harness-config.ts:316-318` | AC8, VP-10 | 유지 — injector 를 부르되 `runtimeEnvFingerprint` 는 여전히 `undefined` |
| host-managed 판정 순서 = 조립 순서 | `harness-config.ts:266-272` 주석 | §10 EP-07 | 유지 — 5층으로 함께 늘린다 |
| 두 배포 능력을 타입으로 가른다(0188 r5) | `harness-runtime.ts:45-70` | D-006, AC14 | 유지 — injector 는 세 번째 능력이며 auth·secret 을 받지 않는다 |
| 배포 레시피 정본은 가이드(0190 A1) | `harness-runtime.ts:24-27` | §15 | 유지 — 소스 주석은 계약 4줄만 |
| `adapters → app` import 금지 | `eslint.config.mjs:158` | §10 EP-10 | 유지 — injector 를 인자로 받는 이유가 이것이다 |
| secret 은 `options.env` 에만 (0028) | `auth.md`·`security.md` | AC15 | 유지 |
| 문서는 코드에서 셀 수 있는 수치를 재서술하지 않는다 | 루트 `AGENTS.md` 원칙 4 | §19 doc gate | 유지 — 새 문서 절에 개수를 적지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 하드코딩한 custom 값이 config API 가 방금 받아온 token·URL 을 덮는다 | 사용자 명시 결정(D-003)이라 순서는 바꾸지 않는다. 대신 가이드 새 절에 "동적 credential 은 augmenter 가 소유한다 — injector 에 token 을 넣지 마라" 를 계약으로 적고, §5 상태표에 그 전이를 남긴다 |
| 전역 injector 가 모든 key 를 덮어 특정 provider 만 깨진다 | `target` 4필드로 좁히는 것이 계약이다(AC2). 가이드 예제가 `key` 분기부터 보여준다 |
| 우선순위 사본 4곳 중 일부만 갱신된다 | §10 EP-12 가 4지점 전수. VP-26 이 한 사본 되돌림 변이로 방향을 확인한다 |
| injector 가 예외를 던져 모든 턴이 죽는다 | 부분 env 로 spawn 하지 않는 것이 기존 계약과 같은 선택이다. 가이드에 "값이 없으면 그 키를 빼라, 던지지 마라" 를 적는다 |
| `baseEnv` 가 injector 때문에 항상 불린다 | 미등록 경로는 그대로 lazy 다. VP-20 이 호출 1회를 관측한다 |

- 되돌리기 어려운 결정: 타입 이름 `SpawnEnvInjector`·`SpawnEnvTarget` 과 파일 경로 `app/deployment/spawn-env.ts`. 배포자가 구현하는 공개 계약이라 §6 미룬 항목 표에서 "지금 확정" 으로 처리했다.
- 신규 의존성: 없다 → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/harness-config.ts`
- `app/src/main/adapters/harness-config.test.ts`
- `app/src/main/app/deployment/spawn-env.ts` (신규)
- `app/src/main/app/deployment/deployment-wiring.test.ts`
- `app/src/main/app/deployment/harness-runtime.ts` (헤더 1줄)
- `app/src/main/app/chat-turn/turn-setup.ts`
- `docs/arch/backend/auth.md`
- `docs/guides/closed-network-extensions.md`
- `docs/handoff/0207-closed-network-custom-env/{plan,verify}.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md`, `docs/AGENTS.md`, `docs/guides/AGENTS.md`, `docs/handoff/AGENTS.md`.
- ABI/네트워크 등 환경 제약: 변경 스위트는 비-DB 라 네이티브를 로드하지 않는다. DB 로드 red 는 알려진 베이스라인으로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/main/adapters/harness-config.test.ts src/main/app/deployment`.
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`; `git diff --check`.
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger 의 ACTIVE 8건이 사용자 4개 답변과 요청 원문을 보존한다. SUPERSEDED·OPEN 0.
- [x] Part I 만 읽어도 완료 상태를 설명할 수 있다 — §5 상태표 8행이 구현 방식 없이 관측 결과를 적는다.
- [x] 조건절·이유절을 재해석하지 않았다 — "하네스 레이어에 전달되기 직전에"·"process.env 스냅샷"·"하드코딩이 될 여지가 있다" 를 §2 에 원문으로 인용했다.
- [x] Product/UX 각 동작이 AC 16행과 §9 TO-BE 경로에 연결된다.
- [x] AS-IS·TO-BE 를 같은 축(책임/flow/contract/error/seam)으로 썼고 Delta 8행이 모두 §11 파일 또는 AC 로 간다.
- [x] AS-IS 에서 사라진 책임 없음 — 레이어 추가만이라 삭제·이동 항목이 없다.
- [x] 수치 실측: prepare 호출 3 · adaptEnv 2 · 우선순위 사본 4 · `harnessProviderId` 0 · turn-setup deployment import 0. 문서 앵커 `auth.md §6.2`·`§6.4` 와 기존 테스트 케이스 5건 존재 확인.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로 3칸을 갖는다.
- [x] 상속할 V 가 없어 Baseline V 다(0200 plan 에 node/pair registry 부재를 확인).
- [x] 네 레벨을 모두 선택했고 `NEW`·`CHANGED` node 15건이 같은 레벨 `REQUIRED` pair 를 갖는다.
- [x] 영향받은 `INHERITED` node 6건은 `REGRESSION`(VP-13·VP-14·VP-19·VP-20·VP-22·VP-25). `NOT_REQUIRED` 는 Baseline V 라 쓰지 않았다.
- [x] pair 26건 모두 production path·§10 EP 전수·직접 oracle 을 갖고, 적대 증거는 순서·배선·판정항·사본 4건(VP-04·VP-09·VP-16·VP-21·VP-26)만 이유·변이와 함께 선택했다.
- [x] 운영 gate 4행이 이번 산출물 기준이고 better-sqlite3 기존 red 를 blocking 으로 만들지 않는다.
- [x] 사람 실기 0 — 조립이 순수 동기이고 두 주입 seam 으로 전 경로가 열린다.
- [x] structural proxy 만으로 닫는 AC 없음 — AC1~AC12 는 최종 env 값을 직접 읽는다. 배선 존재 oracle 인 VP-21·VP-09 와 사본 존재 oracle 인 VP-26 에만 변이를 요구했다.
- [x] "X 가 쓰인다" 불변식의 방향 확인: VP-09 는 위임 인자를 빼면 red, VP-21 은 호출부 인자를 빼면 red, VP-16 은 판정항을 빼면 red. 자리를 말하는 불변식(VP-04 5층 순서)은 `customEnv` 를 `runtimeEnv` 앞으로 **맞바꾸는** 변이도 red 여야 한다고 명시했다.
- [x] 정책 파라미터 없음. 상호배타 상태(`resolved`)는 discriminated union 이라 빈 문자열 key 조합이 타입에 없다.
- [x] 부팅/등록 소비처 5건을 §12 표로 전수 확인했다.
- [x] producer/consumer 양쪽 의미 확인 — consumer 파생 규칙 0, fingerprint 계산 1지점.
- [x] 상한: 신규 요청 0, 신규 출력 0. one-way door(타입·파일 이름)를 §6·§17 에서 지금 확정했다.
- [x] 게이트 명령이 `app/AGENTS.md` 현행 지침과 일치한다 — lint+typecheck 기본, 비-DB 스위트는 `vitest run` 직접 호출.
- [x] 본문 완성 후 교차검증: `ACTIVE 결정 ↔ AC` 대조 8쌍 충돌 0(§3 갱신 메모). §10 EP-01 의 2지점과 §8 전수 조사의 prepare 호출 수가 같은 사실을 가리키는지 대조했다 — EP-01 은 **조립 지점 2**(resolved·위임), EP-04 는 **배선 지점 3**(turn-setup 2 + 위임 1)로 축이 다르다.
- [x] 산출물 문장 규칙: Part I 은 관측 결과, Part II 는 경로·계약. 우선순위 사본 4곳이라는 사실은 §8 전수 조사와 §10 EP-12 에서 각각 다른 역할(측정 / 강제)로만 나온다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| … | … | … | … |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 관측한 게이트 산출 | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| AC 자기보고 | … |
| 합계 검산 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드 수: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | 없음 | — | — | — | — |
