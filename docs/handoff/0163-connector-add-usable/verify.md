# Verify — 0163-connector-add-usable

## 메타

| 항목 | 값 |
|---|---|
| slug | `0163-connector-add-usable` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `828bfe4` |
| 라운드 | 1 |
| 상태 | **PASS** (사람 실기 3건 대기) |
| 자기 검증 여부 | **예** — 설계·구현·검증 모두 Claude |

## 구현 결과 비판적 검토

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경 실패 방식 | **세 결함을 정확히 제거했다** | ⓐ provider 0개 → 전체 전달 ⓑ 타이핑 중 입력 훼손 → 재작성 제거 ⓒ 생성 후 무갱신 → 무조건 갱신 |
| **잘못된 성공** 가능 경로 | **줄었다** | 0162 는 `find()` 실패를 **오류 없이 성공처럼** 끝냈다(모달만 닫힘). 0163 이 `handleCreated` 로 "갱신은 무조건, 특정은 차집합, 못 찾아도 진행" 3분기를 테스트로 고정 |
| 되돌릴 수 있는가 | **예** — renderer 전용, main 무변경 | 설계가 main 정상을 **실행으로 확인**하고 비범위로 뺐다 |
| 설계가 의도한 것을 구현했는가 | **예 — 구현자가 소비처 수를 정정** | plan 이 `PluginRow` 소비처 3곳이라 했으나 실제 5곳. `pluginGroups`·선택 키 누락은 **"행을 눌러도 상세가 안 열리는" 조용한 파손**이었다 |
| 구현자 선조치 경계 | **지켰다** | 8건 전부 구현 세부·문구. `serverHint`·`failUnreachable` 문구 교체는 정적 경로 전제가 깨진 것을 고친 것이라 정당 |

**가장 값진 판단**: "추가가 안 된다" 를 main 버그로 오진하지 않고 **실제 `confluenceTemplate` +
`AuthRegistry` + `ConnectorInstanceLifecycle` 을 돌려 `create()` 가 `ok:true` 임을 먼저 확정**한 것.
그 30분이 registry·store·manifest 를 파는 며칠을 막았다. 이 저장소의 "조사 불가를 선언하기 전에 한 번 더
시도한다"(SKILL.md §5) 가 제대로 작동한 사례다.

## 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `pickCreatedConnector` — 테스트만 | **오탐** | 같은 파일 `handleCreated()` 가 소비 |
| `EMPTY_DRAFT` — 테스트만 | **오탐** | `draftForTemplate()` 이 소비 |
| `CreateRequestShape`·`ServerAddress` — 타입 전용 | **정상** | 시그니처용 |
| `splitPastedUrl` (0161 산) | **제거 확인** | `rg splitPastedUrl src` = **0건** — 대체된 규칙을 green 으로 남기지 않았다 |
| `skills.instance.pickTemplate`·`baseUrl`·`apiBasePath` 등 고아 i18n 키 6+1 | **제거 확인** | `rg 'pickTemplate\|apiBasePathHint' src` = 0건 |
| `connectorAuthLabels`·`providerMap` (0164 산이지만 이 파일에 남음) | **`providerMap` 은 미사용** | `buildConnectorRows` 는 내부에서 `new Map(...)` 을 직접 만든다 → **같은 로직 2벌**. 0157 D 의 `isAllowedOrigin` 이중 구현과 같은 형태 → **D3** |

## 구현자 코멘트 확인

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `PluginRow` 소비처가 3곳이 아니라 5곳 | **타당 — 설계 조사 미달을 구현이 잡았다** | 매트릭스 ✅. plan §전수 조사 N 이 틀렸던 사례 |
| `allProviders` 가 행에서 파생돼 끊긴다 → 훅이 직접 내보내게 | **타당** | 0163 의 `rows.flatMap` 우회를 0164 가 정본화 |
| `serverHint`("설치 시 정해집니다, 관리자 문의")가 사용자가 만든 서버에 안 맞는다 | **타당** | 문구 교체 확인(ko·en) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 다른 패키지 provider 도 연결 후보 | ✅ | `connectorConnect.test.ts::"다른 패키지의 provider 도 수용 목록에 있으면 후보다"` |
| 2 | `PluginDetail` 이 전체 provider prop | ✅ | `typecheck`(필수 prop) |
| 3 | 타이핑 중 값 보존 | ✅ | `connectorInstance.test.ts::"주소 입력은 타이핑 중 값을 고치지 않는다"` — 문자 누적 시뮬레이션 |
| 4·5·6 | 주소 분해(기본/뷰 경로/뷰 선두) | ✅ | `splitServerUrl` 8케이스 |
| 7 | "컨텍스트 경로" 입력칸 없음 | ✅ | `rg 'apiBasePath' ConnectorInstanceModal.tsx` = 0건 (입력 표면), 사람 실기로 최종 확인 |
| 8 | 적용될 주소 되보여주기 | ✅ | `describeApiBase` 테스트 + 모달 도움말 줄 |
| 9·10·11 | 갱신 무조건 / 차집합 특정 / 미발견 시 진행 | ✅ | `connectorCreate.test.ts` 3분기 |
| 12·13 | 행 제목(사용자 이름 / 근거 없으면 pluginId) | ⚠️ **0164 가 재정의** | 0163 의 `PluginRow.title` 은 0164 의 `ConnectorRow.title` 로 흡수. 규칙은 이어졌다 |
| 14 | "인증 정보 변경" 라벨 | ✅ | i18n ko·en + `typecheck` |
| 15 | 사내 서버 실기 | ❌ 미검증 | 사람 실기 |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 | ✅ | — | 통과 |
| 인수 기준 대조 | ✅ | — | 위 표 |
| **UI 시각(AC7·14)** | ✖ | ✅ | 대기 |
| 사내 DC 실기(AC15) | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint 0 error(warning 1 = 베이스라인) · typecheck 0 error
vitest 1770 passed / 1 file failed(chat-turn.continuity, electron egress) → 베이스라인 제외 0건
scripts 28 pass
```

## 검증 자기 리뷰

- **설계 단계**: 좋았다. 세 결함을 **서로 독립임을 명시**하고("하나만 고치면 나머지가 남는다") 각각에
  `파일:라인` 근거를 붙였다. main 을 **실행으로 무결 확인**하고 비범위로 뺀 것이 특히 값졌다.
  약점은 **전수 조사 N 이 틀렸다는 것**(소비처 3 vs 실제 5) — plan 이 "N곳" 을 적을 때 grep 을 실제로
  돌리지 않으면 이렇게 어긋난다.
- **구현 단계**: 설계 정정 2건(소비처 수, `allProviders` 공급)이 전부 정당했고 보고됐다.
- **검증 단계 — 못 본 것**:
  - AC7·14 는 **코드에 입력 표면이 없다는 것**까지만 확인했다. 실제 화면 배치는 사람 몫.
  - `splitServerUrl` 의 뷰 세그먼트 목록(`display`·`pages`·`spaces`·`wiki`·`rest`·`x`·`browse`)이
    **실제 Confluence DC 배포에서 충분한지 확인하지 못했다** — Atlassian 문서 대조 없이 0161 이
    수집한 목록을 승계했다. 틀리면 컨텍스트 경로 오판 → 전 요청 404.

## [PASS 조건] 남은 항목

- [ ] **D3** — `providerMap` 미사용 + `buildConnectorRows` 내부 `new Map(...)` 이중 구현. 한쪽으로 통일.
- [ ] `VIEW_SEGMENTS` 를 Atlassian 1차 출처로 대조(현재는 승계값)
