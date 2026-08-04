# Verify — 0161-connector-instance-templates

## 메타

| 항목 | 값 |
|---|---|
| slug | `0161-connector-instance-templates` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `9b161e9` |
| 라운드 | 1 |
| 상태 | **FAIL** — 인수 기준 밖에서 **prod 로그인 게이트를 켜는 회귀**를 도입했다(D1) |
| 자기 검증 여부 | **예** — 설계·구현·검증 모두 Claude. §역방향 탐색을 강하게 적용했고, **D1 은 인수 기준 23건 어디에도 걸리지 않았다** |

## 구현 결과 비판적 검토 ★

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경 실패 방식 | **대부분 다뤄져 있다** | 인스턴스 1개 실패가 나머지 복원을 막지 않는다(`restore()` 가 `failed` 로 수집하고 계속) · 생성 실패 시 store 롤백 · 삭제는 disconnect→unregister→store 순서 |
| **잘못된 성공** 가능 경로 | **❌ 있다 — D1** | 부팅 시 `instances.restore()` 가 **템플릿 공용 패키지를 무조건 등록**한다. 그 안의 Confluence PAT provider 는 `createStaticCredentialProvider` 로 만들어져 descriptor 가 `targets: ['application','connector']` 다. `broker.publish()` 의 `required = providersForTarget('application').length > 0` 이 **true 로 뒤집히고**, prod `RootGate` 는 `gatePassed = !required \|\| authenticated` 이므로 **서버가 0개인 신규 설치에서도 로그인 화면이 앱을 막는다.** |
| 되돌릴 수 있는가 | **예** — 설정 키 `connectorInstances` 는 기본값 흡수형이고 마이그레이션이 없다 | `instance-store.ts` |
| 설계가 의도한 것을 구현했는가 | **예 — 단 계약 위치는 구현자가 정정했다** | plan 은 `ConnectorTemplate` 을 `features/connectors/` 에 두라 했으나 feature 교차 import 라 `contracts/connector-template.ts` 로 승격. **정당한 정정** |
| 구현자 선조치 경계 | **지켰다** | 9건 전부 구현 세부·엣지케이스였다. 다만 **아래 D1 은 선조치 목록에도 없다 — 아무도 못 봤다** |

### D1 재현 (verify 가 직접 실행)

임시 프로브를 `AuthRegistry` 에 물려 두 경로 모두에서 `application` target provider 가 생기는 것을
확인했다(확인 후 삭제):

```
APPLICATION_TARGET_AFTER_SHARED  [ 'confluence-pat' ]   ← confluenceTemplate.sharedPackage() 만 등록
APPLICATION_TARGET_AFTER_STATIC  [ 'confluence-pat' ]   ← AUTH_PLUGIN_PACKAGES(서버 0개) 만 등록
```

체인:

| # | 지점 | 값 |
|---|---|---|
| 1 | `providers/static-credential.ts:56` | `targets: ['application', 'connector']` — **하드코딩** |
| 2 | `modules/confluence/index.ts` `confluenceProviders()` | PAT 을 `createStaticCredentialProvider` 로 생성 |
| 3 | `app/bootstrap.ts` (0161 이 추가) | `instances.restore()` → 모든 템플릿의 `sharedPackage()` **무조건 등록** |
| 4 | `registry.ts:286` | `providersForTarget(kind) = listProviders().filter(p => p.descriptor.targets.includes(kind))` |
| 5 | `broker.ts:111` | `required: providersForTarget('application').length > 0` → **true** |
| 6 | `RootGate.tsx:21` | prod: `gatePassed = !required \|\| authenticated` → **false** → `<LoginFrame/>` |

**이 회귀가 조용한 이유**: DEV 분기는 `bypass \|\| authenticated` 라 디버그 bypass 로 통과한다.
개발 중에는 절대 보이지 않고 **prod 빌드에서만** 나타난다.

**명시적으로 깨진 문서 약속**: `modules/AGENTS.md` — "신규 설치의 기본값은 빈 배열 — 등록된 provider 가
0개면 `required:false` 로 로그인 게이트가 자동 통과된다(**현행 동작 보존**)". 0161 은 `AUTH_PLUGIN_PACKAGES`
를 비운 채로도 **템플릿 경로로 provider 를 등록**해 그 보존을 깼다.

**부수 발견(D4)**: manifest 선언은 `targets: ['connector']`(`confluenceProviderDeclarations()`)인데 구현
descriptor 는 `['application','connector']` 다. registry 는 connector·runtimeTool 에 대해서만
`sameConnectorDescriptor`/`sameRuntimeToolDescriptor` 로 선언↔구현을 대조하고 **provider 는 대조하지
않는다**(`registry.ts` `validatePackage` — provider 검사는 apiVersion·pluginId·중복·5메서드뿐).
registry 주석이 스스로 "구현만 있고 선언이 없으면 capability·origin 검사를 우회한다" 고 적어둔 바로
그 구멍이다.

## 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `kebabSegment`·`normalizeApiBasePath`·`InstanceRegistryPort`·`InstancePersistPort` — 테스트만 | **오탐** | 전부 같은 파일 상위 함수/타입 위치가 소비 |
| `ConnectorInstanceSchema` — 참조 0 | **오탐** | `instance-store.ts` 내부 `parse` 에서 사용 |
| `describeTemplate` — 참조 0으로 보고 | **오탐** | `templates.ts:41` `this.list().map(describeTemplate)` |
| `PluginInstanceOriginSchema` — 참조 0으로 보고 | **오탐** | `protocol.ts:317` `baseUrl: PluginInstanceOriginSchema` |
| `AuthRegistry.unregister` (0161 신설) | **배선됨** | `instance-lifecycle.ts:124` `remove()` 가 호출 |
| **`providersForTarget('application')` 소비처** | **⚠️ 이 탐색이 D1 을 잡았다** | 0161 이 provider 등록 **시점**을 바꿨는데 그 함수의 소비처를 아무도 되짚지 않았다 |

## 구현자 코멘트 확인

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 계약을 `contracts/` 로 승격(plan 위치는 lint error) | **타당** | 매트릭스 ✅ |
| `unregister` 4맵 일괄 제거 | **타당** — 하나라도 남으면 "목록엔 없는데 도구는 살아있는" 상태 | 테스트로 고정 확인 |
| 순서 불변식(복원=공용 먼저 / 삭제=disconnect→unregister→store) | **타당하나 불완전** | "공용 먼저" 는 맞지만 **"공용을 언제 등록하지 않아야 하는가"** 를 아무도 묻지 않았다 → D1 |

## 요구사항 충족 매트릭스

| 축 | 충족 | 증거 |
|---|---|---|
| 템플릿 계약(`sharedPackage`/`instancePackage`) | ✅ | `contracts/connector-template.ts` · `confluence-package.test.ts` |
| 패키지 2분할(중복 provider id 회피) | ✅ | `registry.test.ts` — 2번째 인스턴스 추가가 성공 |
| `connectorId` = host+컨텍스트 경로 파생 | ✅ | `instance-id.test.ts` |
| 주소 생성 후 불변(수정 채널 없음) | ✅ | IPC 카탈로그에 update 채널 0 |
| `AuthRegistry.unregister` | ✅ | `registry.test.ts` |
| 복원/생성/삭제 순서 불변식 | ✅ | `instance-lifecycle.test.ts` |
| `source`(static/instance) fail-closed | ✅ | `plugin-host.ts` 기본 `'static'` |
| IPC 82→85 | ✅ | `ipc-documentation.test.ts` (85 고정) |
| **로그인 게이트 현행 동작 보존** | ❌ **깨짐 — 인수 기준에 없었다** | 위 D1 |
| 사내 DC 실기 (AC21·22) | ❌ 미검증 | 사람 실기 |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 통과(아래) — **D1 은 게이트가 잡지 못한다** |
| 인수 기준 ↔ 코드 대조 | ✅ | — | 위 표 |
| **prod 로그인 게이트 실기** | ✖(prod 빌드 불가 — egress 차단) | ✅ | **D1 재현은 단위 프로브로 대리**, 실제 prod 화면 확인은 사람 |
| 사내 DC 실기 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint      → 0 error (warning 1 = 0102 베이스라인)
typecheck → 0 error
vitest    → 1770 passed / 1 file failed (chat-turn.continuity — electron egress, collection 단계)
          → 베이스라인 제외 시 0건
scripts   → 28 pass / 0 fail
```

**게이트 전부 green 인데 D1 이 살아 있다** — 이번 검증의 핵심 교훈이다.

## 검증 자기 리뷰

- **설계 단계**: 인수 기준 23건이 전부 *새로 만드는 것*만 검사했고, **"기존에 되던 것이 계속 되는가"**
  를 묻는 기준이 0건이었다. 특히 `restore()` 를 부팅 경로에 새로 끼워 넣으면서 그 경로가 이미
  소비하던 값(`providersForTarget('application')`)의 **소비처를 역추적하지 않았다.**
  → 신규 실패 패턴: **"부팅 시점에 무언가를 새로 등록하는 설계는, 그 레지스트리를 읽는 기존 소비처를
  전수 나열해야 한다."**
- **구현 단계**: 선조치 9건은 경계를 지켰다. 다만 `sharedPackage()` 를 **조건 없이** 등록하는 코드를
  쓰면서 "서버가 0개여도 등록되는가" 를 묻지 않았다.
- **검증 단계 — 못 본 것**: prod 빌드를 만들지 못해(egress) **D1 의 최종 증상(LoginFrame 이 뜨는 화면)은
  단위 프로브 + 코드 경로 추적으로 대리 검증**했다. 6단계 체인의 각 링크는 `파일:라인` 으로 확인했으나
  실제 prod 실행은 사람 몫이다.

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **D1** — 서버가 0개일 때 prod 로그인 게이트가 켜지지 않게 한다. 후보:
      ⓐ Confluence PAT provider 의 `targets` 를 `['connector']` 로 좁힌다(선언과 일치시킨다 —
      `createStaticCredentialProvider` 에 `targets` 옵션 추가) ⓑ `required` 판정을 "application target
      provider 존재" 가 아니라 "**앱 로그인용으로 선언된** provider 존재" 로 좁힌다. **ⓐ 가 작고 정확**하다 —
      manifest 선언이 이미 `['connector']` 이므로 구현을 선언에 맞추는 것이다.
- [ ] **D4** — registry 가 provider 의 **선언↔구현 descriptor 를 대조하지 않는다**. connector 와 같은
      수준으로 `targets`·`mechanisms`·`capabilities` 를 비교해 D1 류가 **등록 단계에서 거부**되게 한다.

> 두 항목 모두 `plan.md` 의 `[검증자 기입] 파생 이슈` 챕터로 이관했다.
