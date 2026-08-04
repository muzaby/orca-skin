# Verify — 0164-buildtime-servers-only

## 메타

| 항목 | 값 |
|---|---|
| slug | `0164-buildtime-servers-only` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `4c74524` |
| 라운드 | 1 |
| 상태 | **FAIL** — 0161 이 도입한 로그인 게이트 회귀(D1)를 **증폭한 채로 출하**한다 |
| 자기 검증 여부 | **예** — 설계·구현·검증 모두 Claude |

## 구현 결과 비판적 검토 ★

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경 실패 방식 | **❌ prod 부팅이 막힌다 — D1** | `AUTH_PLUGIN_PACKAGES` 를 켜면서 Confluence PAT provider(`targets: ['application','connector']`)가 **서버 0개에서도** 등록된다 → `required: true` → prod `RootGate` 가 `<LoginFrame/>` 로 앱을 막는다. 0161 이 템플릿 경로로 이미 같은 상태였고, 0164 는 **정적 경로로 한 번 더** 등록한다(스킵은 *공용 패키지* 쪽만 막는다) |
| **잘못된 성공** 가능 경로 | **하나 새로 생겼다 — D5** | `restore()` 의 `hasPlugin(template.id)` 스킵은 **"같은 id 면 내용도 같다" 를 가정**한다. 지금은 참이지만(둘 다 `confluenceProviders()` 호출) 정적 패키지가 provider 를 **다르게** 정의하는 순간 템플릿이 기대한 provider 가 없는데 **조용히 성공**한다. 검사도 로그도 없다 |
| 되돌릴 수 있는가 | **예** | 설정 키 `pluginAddEnabled` 는 기본값 흡수형, 마이그레이션 없음. `AUTH_PLUGIN_PACKAGES` 는 배열 한 줄 |
| 설계가 의도한 것을 구현했는가 | **예** | 행 단위 전환·게이트·DTO 필드 모두 설계대로. 소비처 5곳 전환도 완료 |
| 구현자 선조치 경계 | **지켰다** | 7건 전부 구현 세부. `i18n` 열 제목 교체는 열이 바뀐 결과라 정당 |

### D1 — 0161 verify 와 같은 결함, 이번엔 두 경로 모두

verify 가 직접 프로브를 물려 확인했다(확인 후 삭제):

```
APPLICATION_TARGET_AFTER_SHARED  [ 'confluence-pat' ]   ← confluenceTemplate.sharedPackage()
APPLICATION_TARGET_AFTER_STATIC  [ 'confluence-pat' ]   ← AUTH_PLUGIN_PACKAGES (서버 0개)
```

0164 의 `hasPlugin` 스킵은 **중복 등록 오류 로그**를 없앨 뿐, `application` target provider 가
등록되는 사실 자체는 **어느 경로로도 그대로**다. 상세 체인·수정 방향은
[`0161/verify.md` §D1](../0161-connector-instance-templates/verify.md) 참조.

**0164 의 설계가 이 위험을 못 본 이유**: §자료조사 2 가 "중복 pluginId 로 **거부**된다 → 매 부팅 오류
로그" 까지만 봤다. 거부되는 것이 무엇인지(=매니페스트)와 **이미 등록된 것이 무엇인지**(=provider)를
분리해 묻지 않았다. AC12 는 "부팅이 깨지지 않는다(provider 만 등록)" 라고 적으며 **provider 만 등록되는
것을 안전의 근거로 삼았는데, 바로 그것이 게이트를 켜는 원인**이다.

## 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9c3b523..HEAD` (대상 48 파일)

| 후보 | 판정 | 근거 |
|---|---|---|
| `pluginTone` — 테스트 5회, **프로덕션 0** | **❌ 죽은 코드 → D2** | 0164 가 `CustomizeList` 의 소비를 `connectorActions(row.connector).tone` 으로 바꾸면서 함수·테스트를 남겼다. `rg '\bpluginTone\b' --glob '!*.test.*'` = **정의 1줄뿐** |
| `providerMap` — 프로덕션 0 | **❌ 이중 구현 → D3** | 0164 가 `pluginCatalog.ts` 에 export 했으나 `buildConnectorRows` 는 내부에서 `new Map(...)` 을 직접 만든다. 같은 로직 2벌 |
| `connectorAuthLabels` — 테스트만 | **오탐** | `buildConnectorRows` 가 같은 파일에서 소비 |
| `hasPlugin` (신설) | **배선됨** | `instance-lifecycle.ts` `restore()` 가 호출 |
| `connectedProviderId` (신설 DTO 필드) | **배선됨** | main `plugin-host.list()` → zod → `buildConnectorRows` → `PluginDetail` 전 구간 확인 |
| `showsAddButton` (신설) | **배선됨** | `ExtensionsCatalogView:100` |
| **형제 비대칭** `[infra/auth] redirect/credentials` | **의도된 차이(0160 에서 근거 기록)** | 변경 없음 |

## 구현자 코멘트 확인

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `PluginRow` 소비처가 3곳이 아니라 5곳 | **타당** | 선택 키 미변경이면 조용한 파손이었다 |
| `allProviders` 를 훅이 직접 내보내게 | **타당** | 0163 의 우회를 정본화 |
| 배포 편집 지점 2곳 → 1곳 | **타당 — 실패 모드를 없앤다** | `servers.ts` 만 고치고 `index.ts` 를 빠뜨리는 실패가 **조용했다** |
| `debug.mockMode` 키를 실수로 지웠다 → 복구 | **정직한 보고** | `typecheck` 가 즉시 잡았다 — 키 리터럴 타입이 안전망으로 동작 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 서버 2개 → 행 2개 | ✅ | `pluginCatalog.test.ts::"커넥터마다 행을 만든다"` |
| 2 | 제목=라벨, 부제=주소 | ✅ | `pluginCatalog.test.ts::"행 제목은 서버 라벨, 부제는 주소"` |
| 3 | provider 전용 패키지는 행 없음 | ✅ | `pluginCatalog.test.ts::"provider 전용 패키지는 행이 없다"` |
| 4 | 쓸 수 있는 인증 방식 표시 | ✅ | `connectorAuthLabels` 3케이스 |
| 5 | 무엇으로 연결됐는지 | ✅ | `plugin-host.test.ts::"연결되면 무엇으로 연결됐는지를 싣는다"` + `pluginCatalog.test.ts` |
| 6 | 미연결이면 `connectedProviderId` 부재 | ✅ | `plugin-host.test.ts::"미연결이면 connectedProviderId 가 없다"` |
| 7 | 추가 버튼 기본 숨김 | ✅ | `pluginAddGate.test.ts::"기본값은 숨김"` |
| 8 | 토글 켜면 노출 | ⚠️ **순수부만** | `pluginAddGate.test.ts::"토글을 켜면 노출"`. 디버그 패널 실제 조작은 사람 |
| 9 | 토글 설정 영속 | ⚠️ **구현만 — 전용 테스트 없음** | `protocol.ts:622` `pluginAddEnabled: z.boolean().default(false)` + `typecheck`(Settings·useTweaks 전 지점). **기본값 `false` 를 고정하는 테스트는 없다** |
| 10 | 공용 패키지 이미 있으면 스킵 | ✅ | `instance-lifecycle.test.ts::"공용 패키지가 이미 있으면 건너뛴다"` |
| 11 | 없으면 등록 | ✅ | `instance-lifecycle.test.ts::"없으면 등록한다"` |
| 12 | 서버 0개여도 부팅 무결 | ⚠️ **부분** | `confluence-package.test.ts::"서버가 0개면 provider 만 등록된다"` 는 통과하나, **그 provider 가 로그인 게이트를 켠다** → 이 기준은 "부팅이 깨지지 않는다" 를 **너무 좁게** 정의했다 → D1 |
| 13 | 정적 행에 제거 버튼 없음 | ✅ | `connectorActions.test.ts::"static 은 remove 없음"` |
| 14 | 주소 수정 UI 표면 없음 | ✅ | `rg 'baseUrl' src/renderer/src/features/skills --glob '!*[Ii]nstance*'` = 0건 |
| 15 | `servers.ts` 한 파일만 편집 | ✅ | `modules/index.ts` 배선 + `servers.ts` 주석 1단계 |
| 16 | i18n ko·en | ✅ | `typecheck` |

**재측정한 수치**: IPC 채널 **85** 유지(`ipc-documentation.test.ts` 고정) · 신규 의존성 **0** ·
vitest **1770** = 0163 의 1757 + 13(pluginCatalog 11 → 실측 `+8`, pluginAddGate 3, instance-lifecycle 2,
plugin-host 2, catalogGroups 수정분 상쇄). **구현 보고의 "신규 13" 은 총계 차이와 일치**한다.

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 | ✅ | — | 전부 통과 — **D1 은 게이트가 못 잡는다** |
| 인수 기준 대조 | ✅ | — | 위 표 |
| 레이어 경계 | ✅ | — | 위반 0 |
| **prod 로그인 게이트 실기** | ✖ (prod 빌드 불가 — egress) | ✅ | **D1 은 단위 프로브 + 6단계 코드 추적으로 대리 검증** |
| **디버그 토글 조작(AC8)** | ✖ | ✅ | 대기 |
| 문서(IPC_CONTRACT·AGENTS.md) 갱신 | ✅ | — | DTO 필드 §2.13 반영 · `modules/confluence/AGENTS.md` 경로 표 반전 확인 |

## 게이트 재실행 결과

```
$ npm run lint                       → ✖ 1 problem (0 errors, 1 warning)   # 0102 베이스라인
$ npm run typecheck                  → error TS 0건 (3분할)
$ ./node_modules/.bin/vitest run     → Test Files 1 failed | 195 passed (196) · Tests 1770 passed
$ (FAIL 목록 - chat-turn.continuity) → 0건
$ node --test scripts/*.test.mjs     → pass 28 / fail 0
```

## 위생 검토 (AGENTS.md 변경)

- `modules/confluence/AGENTS.md`·`modules/AGENTS.md` 키/토큰/이메일/IP 스캔 → **0건**.
  예시 주소는 전부 `wiki.corp`·`rnd.corp` 등 문서용 placeholder.
- `servers.ts` 는 배열이 **비어 있고** 실제 사내 주소가 들어가지 않았다(사용자 결정 "자리만").

## PHASES.md 정합성

- **미승격** — 0159~0164 가 PR #307 하나에 묶여 있어 머지 시 일괄 승격이 맞다. 현재 표에 행 없음.

## 검증 자기 리뷰

- **설계 단계**: §자료조사 2 가 위험의 **절반만** 봤다 — "중복 등록이 거부된다" 는 봤지만 "그래서 무엇이
  이미 등록돼 있나" 를 묻지 않았다. AC12 가 "provider 만 등록" 을 **안전의 근거**로 삼은 것이 결정적
  오류다. → 신규 실패 패턴: **"부작용을 없애는 대신 부작용의 *증상*(오류 로그)만 없애는 설계는, 증상이
  가리고 있던 상태 변화를 다시 물어야 한다."**
- **구현 단계**: 소비처 정정은 잘했으나 **죽은 코드 2건(`pluginTone`·`providerMap`)을 남겼다.** 소비처를
  옮길 때 옛 함수의 참조 수를 세지 않았다.
- **검증 단계 — 이번 verify 가 못 본 것**:
  - **prod 빌드를 만들지 못했다**(egress 차단). D1 의 최종 증상은 단위 프로브 + 코드 경로 추적으로
    대리 검증했다 — 6개 링크를 전부 `파일:라인` 으로 확인했으나 **실제 prod 화면은 미확인**이다.
  - AC9(설정 영속)를 `typecheck` 로만 판정했다. 기본값 `false` 를 고정하는 스키마 테스트가 없어
    "구현됨" 이지 "검증됨" 이 아니다 — ⚠️ 로 표기했다.
  - `servers.ts` 가 비어 있어 **AC1·2 를 fixture 로만** 확인했다. 실제 2서버 등록 후의 화면은 미확인.

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **D1** — 서버 0개일 때 prod 로그인 게이트가 켜지지 않게 한다.
      **권장**: `createStaticCredentialProvider` 에 `targets` 옵션을 추가하고 Confluence PAT 을
      `['connector']` 로 좁힌다 — manifest 선언(`confluenceProviderDeclarations()`)이 이미
      `['connector']` 이므로 **구현을 선언에 맞추는** 것이다.
      회귀 테스트: "Confluence 패키지만 등록된 registry 의 `providersForTarget('application')` 은 0개".
- [ ] **D4** — registry 가 provider 의 선언↔구현 descriptor 를 대조하지 않는다(connector 는 한다).
      `targets`·`mechanisms`·`capabilities` 를 비교해 D1 류를 **등록 단계에서 거부**한다.
- [ ] **D5** — `restore()` 의 `hasPlugin` 스킵이 "같은 id = 같은 내용" 을 무검증 가정한다.
      최소한 스킵 시 로그를 남기거나, 템플릿이 요구하는 provider id 가 실제로 등록됐는지 확인한다.
- [ ] **D2** — `pluginTone` 죽은 코드 + 테스트 5케이스 제거.
- [ ] **D3** — `providerMap` 미사용 / `buildConnectorRows` 내부 `new Map(...)` 이중 구현 통일.
- [ ] AC9 — `pluginAddEnabled` 기본값 `false` 를 고정하는 스키마 테스트 추가.

> 전부 `plan.md` 의 `[검증자 기입] 파생 이슈` 챕터로 이관했다.
