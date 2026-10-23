# Plan — 0282-plugin-catalog-native-sync

## 메타

| 항목 | 값 |
|---|---|
| slug | `0282-plugin-catalog-native-sync` |
| 작성자 | Claude Code |
| 일자 | 2026-10-23 |
| 매핑 | — |
| 상태 | IMPL_DONE (r1.2) — CI 보완 후 독립 검증 대기 |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | `none` — 회귀 노드는 0281·0278·0267의 현재 코드·테스트를 `57515e7`에서 확인해 INHERITED로 인용 |
| 이번 V revision | `ΔV2` — 외부 제거 비노출. 이전: `ΔV1` OpenCode 플러그인 off. 대체 관계는 §ΔV1·§ΔV2 |
| 유효 V | `V1@789a727 + ΔV1@7227dc0 + ΔV2` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: ① OpenCode Composer가 작업 경로별 랜딩마다 에이전트 목록을 다시 불러 스피너가 반복된다. ② nav 플러그인 페이지의 스킬 탭에 네이티브 플러그인 자체와 그 스킬이 섞여 있다. ③ 네이티브 플러그인을 꺼도 Composer `+`→스킬과 Claude `/context`에 그 스킬이 남는다. ④ 하네스 기본 경로 스킬에 의미 없는 on/off 표면이 있다. ⑤ MCP 추가가 저장 폴더가 없으면 실패한다.
- 완료 후 달라지는 것: 에이전트 목록은 앱 실행당 1회만 불러오고, 플러그인은 플러그인 탭에서만 보이며, off는 새 세션·Composer 초안에 즉시 반영되고, 기본 경로 스킬은 항상 활성으로 보이며, MCP 추가는 폴더를 만들어 성공한다.
- 성공을 사용자 관점에서 한 문장으로: "끈 플러그인은 새 세션과 Composer 어디에도 나타나지 않고, 한 번 본 에이전트 목록은 다시 기다리지 않는다."

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | "opencode composer: 에이전트 (팝업) 로딩이 작업 경로별 랜딩페이지에서 모두 시도되고 있다. 한 번 로드된 에이전트 목록은 앱 재시작 전까지 1회만 동작. 이후 케싱된 정보로 composer가 재활용하도록 해야 한다." | 2026-10-23 세션 |
| 명시 요구 2 | "as is: 스킬 탭에 [claude 스킬, claude 플러그인] 그룹에 superpowers의 각 스킬과 플러그인 자체를 표시. to be: claude 플러그인을 플러그인 탭으로 이동. 스킬 탭의 claude 스킬 하위에 표시하던 네이티브 플러그인의 스킬은 표시하지 말 것. 기타: opencode도 같은 조건으로 반영" | 같은 세션 |
| 명시 요구 3 | "네이티브 플러그인 on/off에 따라 composer의 +버튼 -> 스킬 항목에서 네이티브 플러그인의 스킬 노출/비노출도 동기화 되어야 함" | 같은 세션 |
| 명시 요구 4 | "하네스(claude/opencode), ~/.agents/skills 같은 기본 경로의 스킬에 대해서는 on/off 컨트롤 기능+gui를 제공하지 않아야 한다. 하네스에 노출되는 순간 동작이 가능한 것으로 간주한다." | 같은 세션 |
| 명시 요구 5 | "claude의 네이티브 플러그인(e.g., superpowers)이 off 되었는데도 /context 커맨드 확인 시 로드됐다고 표시되고 있다." | 같은 세션 |
| 명시 요구 6 | "플러그인->mcp탭 -> 추가버튼으로 mcp추가 시도 시, mcp 파일을 추가할 경로(디렉토리)가 준비되어있지 않으면 발생한다. 에러가 mkdir -p 같은 옵션처럼 경로가 없으면 만들어줘 함." | 같은 세션 |
| 사용자 답변 Q1 | off 적용 시점 = "새 세션부터 즉시" | AskUserQuestion |
| 사용자 답변 Q3 | 플러그인 탭 내 위치 = "기존 그룹 뒤" | AskUserQuestion |
| 사용자 답변 Q2(질의로 응답) | "전역 on/off에 대해 sdk 로 제어하고 있지 않은지? Sdk에서 제공하지 않으면 해당 하네스의 설정파일을 편집하고 있지 않은지?" → "현재 각 프로젝트(경로)에서는 전용 하네스파일을 편집하여 네티티브 플러그인을 제어하고 있지 않은지?" → "현재 클로드의 경우 user 스코프의 settings.json은 참조하지 않고 있다" | AskUserQuestion 3회 — 저장 위치는 선택되지 않음(D-009·U-001) |
| 추론 의도 | 실행 중 세션의 Composer는 그 세션에 실제 로드된 스킬을 보여야 한다(Q1이 실행 중 세션 유지를 택함) | D-008에서 파생 |
| 추론 의도 | 기본 경로 스킬은 "동작 가능으로 간주"하므로 회색 글씨도 쓰지 않는다 | 요구 4의 이유절 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | OpenCode Composer 에이전트 목록은 앱 실행 중 첫 성공 1회만 불러오고 이후 모든 Composer(경로·프로젝트·provider·세션 무관)가 그 목록을 재사용 | "앱 재시작 전까지 1회만 동작" | 요구 1 | ACTIVE | 0281 D2·D4를 agents 슬롯에 한해 대체. models·MCP·plugins는 0281 유지 |
| D-002 | 실패·취소는 캐시를 채우지 않는다. 첫 성공 전 로딩 표시는 0281 D5(제목 우측 스피너) 그대로 | "한 번 로드된" = 성공 | 요구 1 · 0281 D5 | ACTIVE | — |
| D-003 | 전송 시 선택 에이전트가 대상 경로 목록에 없으면 기존처럼 에이전트 지정 없이 보낸다 | 경로별 에이전트 차이의 안전망 | `channel.ts:146-154` 기존 동작 | ACTIVE(유지) | — |
| D-004 | 네이티브 플러그인 행(Claude·OpenCode)은 플러그인 탭으로 이동. 스킬 탭은 네이티브 플러그인 출처 스킬(`plugin:claude`·`plugin:opencode`)을 표시하지 않음 | 요구 2 원문 | 요구 2 | ACTIVE | 0236/rendering.md의 스킬 탭 출처 구분 문장 대체 |
| D-005 | 플러그인 탭 순서: 앱 로그인 → 모델 → 사내 서비스 → Claude 플러그인 → OpenCode 플러그인 | 사용자 선택 | Q3 | ACTIVE | — |
| D-006 | Composer `+`→스킬의 네이티브 플러그인 스킬은 대상 실행이 실제로 싣는 상태와 같다. 초안·미실행 세션 = 다음 spawn의 유효 상태, 실행 중 세션 = 그 Query의 실제 목록 | 요구 3 + D-008 | 요구 3 · Q1 | ACTIVE | — |
| D-007 | 하네스 기본 경로 스킬(`~/.claude/skills`·OpenCode 전역 skills·`~/.agents/skills`)은 on/off 기능·토글 GUI 없음. 항상 활성으로 보고 실행한다. Orca 스킬은 토글 유지 | "하네스에 노출되는 순간 동작이 가능한 것으로 간주" | 요구 4 | ACTIVE | 0278 D11의 회색 글씨·고정 토글을 이 스킬들에 한해 대체 |
| D-008 | nav의 Claude 플러그인 전역 on/off는 같은 경로에 실행 중 세션이 있어도 새로 시작하는 Query부터 즉시 적용. 실행 중 Query는 종료·축출·재시작 전까지 유지 | 사용자 선택 | Q1 | ACTIVE | 0278 D28을 Claude 플러그인 기본값에 한해 대체. D15 유지 |
| D-009 | 전역 선택의 저장 방식은 현행 유지 — SDK 런타임 적용만, 하네스 파일 미편집, 앱 재시작 시 네이티브 기본값 복귀 | 사용자가 저장 위치를 고르지 않음. 재시작 후에는 nav 표시와 실행이 함께 기본값이라 불일치 없음 | 0278 D26 · Q2 응답 | SUPERSEDED | D-018 |
| U-001 | 전역 선택을 재시작 후에도 유지할지, 유지한다면 어디에 둘지 | 사용자 Q2 답변이 질의로 끝남 | Q2 | OPEN — 이번 범위 밖 | — |
| D-010 | MCP 저장 시 상위 폴더가 없으면 만든다(`mkdir -p`) | 요구 6 원문 | 요구 6 | ACTIVE | — |
| D-011 | 프로젝트 `.claude/settings.json`·`settings.local.json`의 명시 선택은 nav 전역 선택보다 우선 | 기존 우선순위 | 0278 D16·D20 | ACTIVE(유지) | — |
| D-012 | OpenCode 네이티브 플러그인도 끄면 새 실행에 로드되지 않는다. SDK 제어가 없으므로 하네스 설정 파일을 편집하고, 편집할 수 없는 출처는 현행 유지(고정 토글) | "Sdk 컨트롤 안되면 설정파일편집   그것도 안되면 현행 유지" | ΔV1 사용자 2026-10-23 | ACTIVE | 0278 D32의 OpenCode 플러그인 모니터링 한정을 사용자 전역 설정 선언분에 한해 대체 |
| D-013 | 편집은 jsonc-parser로 `plugin` 배열만 바꾸고 주석·서식을 보존. 같은 파일 동시 편집은 기존 `nativeFileMutations` 임계영역으로 대기·재시도 | "조건부 승인하겠다. 여러 경로에서 한 파일을 동시에 편집시도시 실패로이어지지않는지? … 네이티브 플러그인 on/off 코드 참고" | ΔV1 사용자 | ACTIVE | 신규 의존성 승인(조건 = 동시 편집 실패 없음, 0278 D31 재사용) |
| D-014 | 끈 항목의 원래 값(spec·옵션·위치·파일)은 Orca 설정에 기록해 nav에 off로 표시하고 다시 켤 때 복원 | "Orca 설정에 기록." | ΔV1 사용자 | ACTIVE | 0278 D22(별도 사본 금지)는 기본값 사본 금지로 유지 — 복원 기록은 사용자가 명시 승인한 예외 |
| D-015 | 실행 중 OpenCode 세션이 있으면 토글 클릭 시 바로 바꾸지 않고 서버 재시작 경고를 먼저 띄우고 승인 후 실행. 세션이 없으면 경고 없이 실행 | "실행중인 세션이 있다면 토글 버튼 클릭시 바로 동작하지 않고 서버 재시작 경고를 먼저 알림. 승인 후 토글 실행. 세션이 없으면 경고 없이" | ΔV1 사용자 | ACTIVE | — |
| D-016 | OpenCode 플러그인 변경은 새 세션부터 새 서버로 적용. 실행 중 세션은 기존 서버를 계속 사용 | "새 세션부터 새 서버로" | ΔV1 사용자 | ACTIVE | 0278 D7 "단일 서버"를 변경 직후 기존 owner가 남은 동안에 한해 대체 |
| D-017 | OpenCode 플러그인을 켜거나 끄면 에이전트 캐시를 비우고 1회 다시 불러온다 | "비우고 1회 재로드" | ΔV1 사용자 | ACTIVE | D-001의 "앱 재시작 전까지 1회"에 이 예외만 추가 |
| D-018 | 메모리 전용 전역 선택(D-009)의 범위를 Claude 플러그인·OpenCode MCP로 한정. OpenCode 플러그인은 D-012~D-014 | D-012·D-014와의 정합 | ΔV1 | ACTIVE | D-009 대체. U-001은 이 범위에 남음 |
| D-019 | 외부에서 실제로 제거한 플러그인은 nav·Composer·새 실행 어디에도 노출하지 않는다 | "외부 cli에서 플러그인을 실제로 제거하면 orinus orca에서도 노출이 되면 안된다." | ΔV2 사용자 | ACTIVE | — |
| D-020 | OpenCode 전역 설정 외부 변경은 Orca 토글과 같은 적용 규칙(새 연결 새 서버·실행 중 유지·에이전트 캐시 1회 재로드), 확인 대화상자 없음 | 이미 일어난 변경 | 추론 — D-016·D-017 파생 | ACTIVE | — |
| D-021 | Orca off는 설치본을 확인할 수 있는 OpenCode 플러그인에만 허용 | 끈 뒤 숨겨져 다시 켤 수 없게 되는 것 방지 | 추론 — D-012·D-019 파생 | ACTIVE | ΔV1 AC19 보강 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011 전부, OPEN U-001. ΔV1 턴: D-012~D-018. ΔV2 턴: D-019~D-021.
- 변경된 결정: 0281 D2·D4 → D-001(agents 슬롯), 0278 D28 → D-008(Claude 플러그인 기본값), 0278 D11 → D-007(기본 경로 스킬). ΔV1: D-009 → D-018(범위 축소), 0278 D32 → D-012(OpenCode 사용자 전역 플러그인), 0278 D7 → D-016(교체 중 일시 2서버).
- 기존 ACTIVE 중 유지: 0278 D15·D16·D20·D24·D26·D32, 0281 D1·D5·D6.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1·AC2·AC3, D-002↔AC2, D-003↔AC4, D-004↔AC5·AC6, D-005↔AC6, D-006↔AC9·AC10·AC12, D-007↔AC13·AC14·AC15, D-008↔AC8·AC12, D-009↔(AC 없음 — 저장 경로를 만드는 AC가 없음을 확인), D-010↔AC16·AC17, D-011↔AC11. ΔV1: D-012↔AC19·AC24, D-013↔AC20·AC21, D-014↔AC19·AC20·AC22, D-015↔AC23, D-016↔AC24, D-017↔AC25, D-018↔AC19(OpenCode MCP·Claude는 메모리 선택 유지), D-001↔AC25(예외는 플러그인 변경 때만) — 충돌 0. ΔV2: D-019↔AC27~AC30, D-020↔AC28·AC30, D-021↔AC29 — 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구 5가 원인을 겨냥하는가 | 전제 정정 — CLI는 off를 정상 처리한다. 원인은 Orca가 off를 새 Query에 넘기지 못함 | [실측](evidence/claude-inline-probe.md): `@inline:false`면 Skills 0 · `adapter.ts:439-472` 경로별 스냅샷 재사용 |
| 요구 5의 재현 경로 | 같은 경로에 세션이 한 번이라도 실행됐으면 앱 종료·LRU 축출 전까지 off가 새 세션에 안 감. 재시작하면 off 선택 자체가 사라짐 | `runtime-pool.ts:8`(세션 수명 = 종료·축출) · `extension-control.ts:8-16`(메모리 Map) |
| 요구 3이 이미 충족되는가 | 실행 중 세션은 충족, 초안은 미충족 | 실행 중: `native-resource-sharing.ts:92-99` 변경 broadcast · 초안: `plugin-catalog.ts:216-217`이 Orca 선택을 읽지 않음 |
| 요구 1이 0281 결정과 충돌하는가 | 충돌 — 사용자가 명시적으로 바꿈 | 0281 D2 "같은 작업폴더·실행 세대에서 재사용", D4 "경로 전환 때 이전 목록 미사용" |
| 요구 4가 기존 결정과 충돌하는가 | 충돌 — 0278 D11(회색·고정 토글)을 기본 경로 스킬에 한해 대체 | `scan.ts:78` `adapter:claude` canToggle |
| 요구 6의 원인 | 공용 원자 쓰기가 상위 폴더를 가정 | `json-file.ts:7-11` · `sources/mcp` 생성 경로 0건(`rg -n "sourcesMcpDir" app/src/main` → 정의·`mcpJsonPath` 사용 2줄, mkdir 없음) |
| 더 작은 해법 | 요구 6은 공용 writer 1곳 수정으로 5개 호출부 모두 해결. 요구 5는 스냅샷에서 plugin 기본값만 분리 | §9 |

- 사용자에게 올린 결정: Q1(적용 시점) · Q2(저장 위치) · Q3(탭 내 위치). Q2는 미결로 U-001.
- 코드 조사로 닫은 사실: 요구 5 원인, 초안 Composer 경로, MCP 실패 지점, OpenCode 플러그인은 전역·프로젝트 on/off가 없어 요구 3의 동기화 대상이 Claude뿐인 점(`configured-resources.ts:127` opencode `canToggle: item.kind === 'mcp'`).

## 5. 동작 / 사용자 흐름

```text
A. OpenCode 랜딩(경로 A) Composer 첫 표시
  → 에이전트 제목 스피너(D-002) → 목록 수신 → 앱 전역 캐시에 저장
  → 랜딩(경로 B)·세션 Composer: 스피너 없이 캐시 목록 즉시 표시, 재조회 없음
  ↘ 첫 시도 실패: 스피너 종료·안내 없음, 캐시 비어 있음 → 다음 Composer가 다시 시도

B. nav → 플러그인 페이지
  → 플러그인 탭: 앱 로그인 · 모델 · 사내 서비스 · Claude 플러그인 · OpenCode 플러그인
  → 스킬 탭: Orcinus orca 스킬(토글) · Claude 스킬 · OpenCode 스킬 · ~/.agents/skills(토글 없음)
  → MCP 탭: 기존과 같음

C. nav에서 Claude 플러그인 off
  → 플러그인 탭 행 off 표시
  → 랜딩 Composer `+`→스킬: 그 플러그인 스킬 사라짐
  → 새 세션(같은 경로에 실행 중 세션이 있어도): plugin 미로드 → /context에 없음
  → 이미 실행 중인 세션: 그대로 로드 상태 — Composer·우측 패널도 실제 상태(로드됨) 표시
  ↘ 프로젝트 settings에서 명시적으로 켠 경우: 프로젝트 우선(D-011)

D. 플러그인 → MCP → 추가
  → 저장 폴더 없음 → 폴더 생성 → mcp.json 저장 → 목록에 표시
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 에이전트 캐시 없음 + Composer 구독 | agents 조회 시작 | 제목 스피너 |
| 첫 agents 성공(어느 경로든) | 캐시 저장 + 살아 있는 모든 Composer 상태에 전파 | 모든 Composer에서 스피너 종료·목록 표시 |
| 캐시 있음 + 새 Composer | agents 조회 생략 | 즉시 목록, 스피너 없음 |
| 캐시 있음 + 인스턴스 무효화(세대 교체) | agents는 캐시 유지, models 등은 기존 무효화 | 에이전트 목록 유지 |
| agents 실패·취소(캐시 없음) | 캐시 그대로 비움 | 스피너 종료, 안내 없음 |
| nav off(Claude 플러그인) | Orca 메모리 선택 갱신 | 다음 Query·초안 목록부터 미포함 |
| nav off 후 같은 경로 새 세션 | Query flag `<이름>@inline: false` | `/context`·`+`→스킬에 없음 |
| nav off 후 실행 중 세션 | 변경 없음 | 로드 상태 그대로 표시 |
| MCP 추가 + 폴더 없음 | 상위 폴더 생성 후 원자 쓰기 | 추가 성공 |

### 파생 UX / 엣지케이스

- loading / empty / error: 플러그인 탭은 provider 로딩과 네이티브 카탈로그 로딩을 함께 기다린다. 네이티브 카탈로그 실패 배너는 플러그인·MCP 탭에만 보이고 스킬 탭에는 보이지 않는다.
- 성공한 빈 에이전트 목록도 캐시한다(성공이므로).
- 다른 경로 전용 에이전트가 캐시에 있어도 전송 시 그 경로에 없으면 지정 없이 보낸다(D-003).
- OpenCode 플러그인은 전역·프로젝트 on/off가 없어(0278 D32 모니터링) 설치된 플러그인의 스킬은 항상 `+`→스킬에 보인다 — 요구 3의 동기화 대상은 Claude 플러그인이다.
- 기본 경로 스킬을 예전에 껐던 저장값(`skillEnabled`)은 지우지 않고 무시한다 — 이 스킬들은 다시 활성으로 실행된다.
- 앱 재시작: 에이전트 캐시·전역 선택 모두 초기화(D-001·D-009).
- keyboard / theme: 플러그인 탭 행은 기존 `CatalogListRow`·`CatalogToggle` 그대로. 탭 키보드 동작 불변.

## 6. 범위 / 비범위

- **범위**: §2 명시 요구 1~6과 그 문서 갱신(`adapters.md §1.3`·`IPC_CONTRACT.md` extensions 절·`rendering.md`·`design-components.md`).
- **비범위**: 전역 선택 영속화(U-001) · OpenCode MCP 전역 선택의 적용 시점(directory 인스턴스 공유라 0278 D15·D28 유지) · Orca 스킬 선택·배포 사본의 경로별 스냅샷(0278 D28 유지) · models·MCP·plugins Composer 캐시(0281 유지) · OpenCode 플러그인 on/off(SDK 제어 없음, 0278 D32 모니터링) · 저장된 `skillEnabled` 잔여 키 정리.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 전역 선택 영속화 위치(U-001) | **예 — 저장 형식·외부 CLI 공유 여부** | 사용자 결정 후 별도 handoff |
| 기본 경로 스킬 잔여 `skillEnabled` 키 | 아니오 — 읽지 않으면 무해 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 첫 agents 성공 뒤 다른 scope(경로·provider·세션)의 Composer는 첫 렌더부터 캐시 목록을 표시하고 agents IPC를 요청하지 않으며 제목 스피너가 없다 | scope A 성공 → scope B 마운트: B의 agent 메뉴 항목 = A 목록, agents 요청 1회, 스피너 0 | OpenCode Composer Module → `useComposerCatalog` → `composerCatalogState` → Controls |
| R-01 | AT-01 / AC2 | 캐시 전 동시 scope는 첫 성공을 함께 받는다. 늦은 성공은 캐시를 바꾸지 않는다. 실패·취소는 캐시를 채우지 않고 다음 scope가 재시도한다. 성공한 빈 목록은 캐시한다 | A·B 동시 대기 → A 성공 → B 즉시 ready(A 값) → B 지연 응답(다른 값) 무시 · 실패 후 C 재요청 · 빈 배열 캐시 | 같은 경로 |
| R-01 | AT-01 / AC3 | 인스턴스 무효화 뒤 agents는 캐시 값으로 ready, models·mcp·plugins는 기존처럼 무효화 | invalidated 이벤트 → agents ready·models error | `onComposerCatalogInvalidated` → state |
| R-01 | AT-01 / AC4 | 전송 시 대상 경로에 없는 에이전트는 prompt에 넣지 않는다(회귀) | 목록 변경 뒤 이전 에이전트 지정 prompt에 `agent` 없음 | `channel.ts` submit |
| R-02 | AT-02 / AC5 | 스킬 탭에 `plugin:claude`·`plugin:opencode` 스킬, 네이티브 플러그인 행, "Claude 플러그인"·"OpenCode 플러그인" 제목이 없다. 기본 경로·Orca 스킬은 출처 제목과 함께 남는다 | 스킬 탭 행 id·제목 전수 | nav → `ExtensionsCatalogView` → `CustomizeList` |
| R-02 | AT-02 / AC6 | 플러그인 탭은 provider 그룹 뒤에 Claude 플러그인 → OpenCode 플러그인 그룹(브랜드 제목)을 둔다. 행의 상태 문구·토글 capability(0278 D11·D24)·폴더 열기·전역 토글 호출은 기존과 같다 | 행 id 순서 = gate·llm·service·claude:*·opencode:* · canToggle별 switch disabled · 클릭/토글 콜백 인자 | 같은 경로 + `useNativeMcpCatalog` |
| R-02 | AT-02 / AC7 | 네이티브 카탈로그 로딩·실패·빈 목록 억제는 플러그인·MCP 탭에만 적용된다. 스킬 탭은 네이티브 카탈로그가 로딩·실패여도 스킬 목록을 보인다 | 탭별로 `common.loading`·실패 배너·목록 존재 단언 | 같은 경로 |
| R-03 | AT-03 / AC8 | nav off 뒤 새 Claude Query는 같은 경로 Query가 살아 있어도 `<이름>@inline: false`로 시작한다. 살아 있는 Query는 바뀌지 않는다. 다시 on이면 새 Query는 true. 같은 경로 배포 사본 공유는 유지 | 실제 bootstrap 등록 handler로 토글 → `adapter.sendMessage` SDK options 비교 | `orca:extensions:set-enabled` → `extensionChoices` → `ClaudeAdapter.sendMessage` |
| R-03 | AT-03 / AC9 | nav off 뒤 초안·미실행 세션의 네이티브 명령에서 그 플러그인 스킬이 빠지고, on이면 돌아온다 | bootstrap draftCommands·commands(sessionId) 결과 | handler → draft/세션 commands → Composer `+`→스킬 |
| R-03 | AT-03 / AC10 | 초안·미실행 세션의 우측 패널 플러그인 항목 enabled가 같은 유효 상태다 | bootstrap draftResources·configured(sessionId)의 plugin enabled | handler → draft/세션 resources → 패널 |
| R-03 | AT-03 / AC11 | 프로젝트 settings에서 켠 플러그인은 nav off여도 새 Query·초안 명령에 포함된다(spawn과 초안이 같은 우선순위) | user false + Orca off + project true → 로드·명령 포함 | adapter·plugin-catalog·configured-resources |
| R-03 | AT-03 / AC12 | 실행 중 세션의 Composer는 그 Query의 실제 명령을 보이고, 프로젝트 토글 결과는 기존처럼 Composer에 반영된다(회귀) | live 명령 목록·변경 broadcast 수신 | 기존 경로 |
| R-04 | AT-04 / AC13 | `agents`·`adapter:*`·`plugin:*` 출처 스킬은 canToggle false. `agents`·`adapter:*`는 저장값과 무관하게 enabled true. `orca`는 canToggle true와 저장값 유지 | 저장값 false를 준 스캔 결과 | `scanSkills` → `readSkillCatalog` |
| R-04 | AT-04 / AC14 | 스킬 탭 행·상세에서 기본 경로 스킬은 switch 요소가 없고 제목이 회색이 아니다. Orca 스킬은 switch가 있다. 기본 경로 스킬 set-enabled IPC는 설정을 바꾸지 않는다 | 행·상세 DOM · settings patch 미호출 | skills IPC → `CustomizeList`·`SkillDetail` |
| R-04 | AT-04 / AC15 | 예전에 끈 `~/.claude/skills` 스킬도 Claude Query `skills` 허용목록에 들어가고, Composer `+`→스킬 항목이 disabled가 아니다 | SDK options.skills · 메뉴 item.disabled | `adaptSkills` · `buildAttachMenu` |
| R-05 | AT-05 / AC16 | 원자 JSON 쓰기는 없는 상위 폴더를 만들고, 기존 파일 교체·`.tmp` 미잔류를 유지한다 | 임시 루트에서 중첩 경로 쓰기·덮어쓰기 | `writeJsonAtomic` 호출부 5곳 |
| R-05 | AT-05 / AC17 | `sources/mcp`가 없을 때 MCP 추가가 성공해 `mcp.json`에 기록되고 목록에 나타난다 | 실제 파일 모듈로 `McpStore.add` → 파일·`list()` | MCP 탭 추가 → `orca:mcp:add` → `McpStore.add` → `writeMcpFile` |
| R-03·R-02·R-01 | AT-06 / AC18 | Windows 실제 앱: superpowers off 뒤 새 세션 `/context`에 없음 · 플러그인 탭 white/dark 시각 · 랜딩 경로 전환 시 에이전트 스피너 재표시 없음 | 사람 실기 | 실제 설치본 |

### AC 검증 주의사항

- 기존 테스트 재사용 확인: `adapter.persistent.test.ts:'passes a live plugin agent and drops its removed variant on the next prompt'`는 목록에서 빠진 에이전트를 prompt에서 제외함을 단언한다(`expect(body).not.toHaveProperty('agent')`). `Module.integration.test.ts:'uses only the agent slot for title loading when %s completes first'` 존재 확인.
- 기존 테스트 중 이번 결정과 반대를 잠근 것: `adapter.native-plugins.test.ts:'isolates global SDK choices and freezes them until the last project query closes'`(peer가 이전 flag) · `bootstrap.native-history.test.ts:'carries catalog changes through the real bootstrap registry into new SDK snapshots only'`(같은 경로 false 유지) · `CustomizeList.render.test.ts:'uses capability for font and fixed switches…'`(plugin 스킬 회색·고정 토글). D-007·D-008에 맞게 바꾼다.
- `adapter.native-plugins.test.ts` 첫 케이스의 `not.toContain('claude:native')`는 손으로 만든 `canToggle: true` fixture라 `adaptSkills` 규칙 자체와는 모순이 아니다. 다만 production에서 그런 adapter 스킬은 더 이상 생기지 않으므로 fixture를 scan 형태로 바꿔 AC15 좌표로 쓴다.
- 사람 실기 AC18: 실제 CLI·Windows 창·테마는 자동화 밖이다. 같은 로직은 AC1·AC5·AC8이 기계로 잠근다.
- N회 기준(AC1 "agents 요청 1회"): sink = `sessionApi.composerCatalog({part:'agents'})`. 프로덕션 호출부 `rg -n "composerCatalog\(" app/src/renderer/src` → 호출 `composerCatalogState.ts:88` 1곳(+`ipc.ts:228` 래퍼 정의)이고 그 안의 agents 진입은 `subscribe`(:51)·`retry`(:77) 2개다. 관측은 같은 `sessionApi` mock이 둘 다 받으므로 반증 가능하다.
- 0건 기준(AC5 "plugin:* 없음"): 양성 짝으로 기본 경로·Orca 스킬 행 존재를 함께 단언한다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 명시 V 없음. 대체한 다른 handoff 결정의 회귀만 INHERITED REGRESSION으로 둔다.
- 기준 V 상속 근거: 없음. INHERITED 노드의 기준선은 `57515e7`에서 해당 테스트 존재를 확인했다.
- `SUPERSEDED`로 분해한 pair: 해당 없음(Baseline).
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 / AT-01 | R / AT | 에이전트 앱 전역 1회 로드(AC1~4) | NEW | — |
| R-02 / AT-02 | R / AT | 플러그인 페이지 탭 재배치(AC5~7) | NEW | — |
| R-03 / AT-03 | R / AT | Claude 플러그인 off 유효 상태(AC8~12) | NEW | — |
| R-04 / AT-04 | R / AT | 기본 경로 스킬 토글 제거(AC13~15) | NEW | — |
| R-05 / AT-05 | R / AT | MCP 저장 폴더 생성(AC16~17) | NEW | — |
| AT-06 | AT | 사람 실기(AC18) | NEW | — |
| SD-01 / ST-01 | SD / ST | 에이전트 캐시 수명(§9 A) | NEW | — |
| SD-02 / ST-02 | SD / ST | 전역 선택 → 새 Query vs 실행 중 Query(§9 C) | NEW | — |
| AR-01 / IT-01 | AR / IT | state ↔ 캐시 ↔ hook ↔ Controls(§9 A) | NEW | — |
| AR-02 / IT-02 | AR / IT | 카탈로그 뷰 탭 라우팅(§9 B) | NEW | — |
| AR-03 / IT-03 | AR / IT | bootstrap → harness module(choices) → reader(§9 C) | NEW | — |
| MD-01 / UT-01 | MD / UT | `ComposerAgentCache` 첫 성공 우선(§11) | NEW | — |
| MD-02 / UT-02 | MD / UT | 선택 → flag 변환과 우선순위(§10) | NEW | — |
| MD-03 / UT-03 | MD / UT | 스킬 capability(§10) | NEW | — |
| MD-04 / UT-04 | MD / UT | 원자 쓰기 폴더 생성(§10) | NEW | — |
| SD-0281 / ST-0281 | SD / ST | models·MCP·plugins scope/세대/해제 | INHERITED | 0281 V1 VP2·VP4 · `composerCatalogState.test.ts` |
| SD-0267 / ST-0267 | SD / ST | 전송 시 에이전트 membership | INHERITED | 0276·0281 · `adapter.persistent.test.ts` |
| SD-0279 / ST-0279 | SD / ST | 실행 중 세션 프로젝트 토글 동기화 | INHERITED | 0279 · `native-resource-sharing.test.ts` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | Module(A) → hook → state → IPC agents → 캐시 → Module(B) → state(B) → Controls | 신규 `Module.integration.test.ts:'reuses the first successful agent list across landing scopes without requesting or spinning'` — A=`C:/A`/`team`, B=`C:/B`/`other`·세션 id, B 요청 시 다른 목록을 주는 mock | required — "요청 0회"가 호출 수 proxy. 변이: A2 캐시 확인 제거, A1 고정 loading | EP-01 (10) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | 캐시 없음 → 동시 A·B → A 성공 → B 전파 → B 늦은 응답 → 실패·취소 → 무효화 | 신규 `composerCatalogState.test.ts` 3건: `'publishes the first agent success to concurrent scopes and ignores later results'` · `'leaves the agent cache empty after failed or cancelled reads'` · `'keeps cached agents through instance invalidation while models become error'` | required — 형제 슬롯(agents/models) 무효화 계약이 다름. 변이: A3에서 agents를 models와 같은 error로 | EP-01 A3·A5·A6·A7·A8·A10 (6) |
| VP-03 | AR-01 ↔ IT-01 | REQUIRED | `composerCatalogState()` 팩토리 → 싱글톤 캐시 → `useComposerCatalog` 무-scope 스냅샷 → Controls 제목 busy | VP-01 좌표 + 신규 `Module.integration.test.ts:'shows cached agents before the chat scope exists'` | not selected — DOM·호출 수 직접 관측 | EP-01 A1·A2·A9·A10 (4) |
| VP-04 | MD-01 ↔ UT-01 | REQUIRED | `ComposerAgentCache.accept` → `get`/구독자 | 신규 `composerAgentCache.test.ts:'keeps the first accepted list and notifies each subscriber once'` | not selected — 반환값 직접 관측 | EP-01 A10 (1) |
| VP-05 | SD-0281 ↔ ST-0281 | REGRESSION | models·MCP·plugins 읽기·세대·해제 | `composerCatalogState.test.ts`의 기존 5건(각 테스트에 새 캐시 주입) · `Module.integration.test.ts:'uses only the agent slot for title loading when %s completes first'` | not selected | 0 — 형제 무효화 줄(:70-72) 변경 금지 |
| VP-06 | SD-0267 ↔ ST-0267 | REGRESSION | `channel.ts` submit → `connection.agents` membership | `adapter.persistent.test.ts:'passes a live plugin agent and drops its removed variant on the next prompt'` | not selected | 0 — 변경 없음 |
| VP-07 | R-02 ↔ AT-02 | REQUIRED | 탭 클릭 → `ExtensionsCatalogView` → 실제 hooks → IPC mock → `CustomizeList` | 신규 `ExtensionsCatalogView.interaction.test.ts`(renderHarness, `shared/api/ipc`만 mock): `'moves native plugins to the plugin tab after provider groups'` · `'hides native plugin skills from the skills tab'` · `'scopes native loading and failure to plugin and MCP tabs'` | not selected — 행·배너 직접 관측 | EP-03a (7) · EP-03b K1 (1) |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | `CustomizeList` props → 탭별 행·제목·토글 | `CustomizeList.render.test.ts` 갱신: `'%s uses flat catalog buttons…'`(providers 행에 native 포함) · 신규 `'orders Claude then OpenCode plugin groups after providers and keeps plugin toggle capability'` | required — 형제 그룹 자리 계약. 변이: R3·R4 렌더 순서 맞바꿈, R1 kind 맞바꿈 | EP-03a R1~R4 (4) · K1 (1) |
| VP-09 | R-03 ↔ AT-03 | REQUIRED | handler `extensionSetEnabled` → `extensionChoices` → ①`sendMessage`(같은 경로 live 있음) ②draft·세션 commands/resources | `bootstrap.native-history.test.ts` 갱신 `'carries catalog changes through the real bootstrap registry into every new SDK query'` · 신규 `'applies nav plugin choices to draft and stored-session commands and resources'` · AC18 실기 | required — 결함 변이: C1을 스냅샷 생성 안으로 되돌림, C12 choices 생략, C5 순서 뒤집기 | EP-02 (15) |
| VP-10 | SD-02 ↔ ST-02 | REQUIRED | live Query A → off → Query B → on → Query C → A 해제 | `adapter.native-plugins.test.ts` 갱신 `'applies current global plugin choices to every new query while live queries keep theirs'` · 기존 `'pins deployed MCP files for same-cwd peers and reloads until the final owner closes'` | not selected — options 직접 비교 | EP-02 C1~C3 (3) |
| VP-11 | AR-03 ↔ IT-03 | REQUIRED | bootstrap 클로저 4곳 → `harnessModule('claude')` 래퍼 → `configuredClaudeCommands`·`configuredClaudeResources` | `bootstrap.native-history.test.ts:'reads native configuration through the registered module using stored backend and cwd'` 확장(Orca off·project true 조합) | not selected | EP-02 C4~C13 (10) |
| VP-12 | MD-02 ↔ UT-02 | REQUIRED | `extensionChoices(record,'plugin')` → reader 우선순위 user < Orca < project < local | 신규 `extension-control.test.ts:'maps only one kind of choice to harness keys'` · `plugin-catalog.test.ts`·`configured-resources.test.ts` 신규 `'applies Orca plugin choices above user defaults and below project selections'` | required — 우선순위 형제(user/project) 맞바꿈 변이 | EP-02 C4·C5·C15 (3) |
| VP-13 | SD-0279 ↔ ST-0279 | REGRESSION | 실행 중 Query 토글 → broadcast → Composer | `native-resource-sharing.test.ts` 기존 · `Composer.native-menu.test.ts:'reflects session-enabled plugin commands in real autocomplete and decoration without changing the draft'` | not selected | 0 — 변경 없음 |
| VP-14 | R-04 ↔ AT-04 | REQUIRED | scan → catalog → skills IPC → 목록·상세 / Claude options.skills / `+` 메뉴 | scan→catalog: `skill-catalog.test.ts:'assembles the real catalog from lock, harness and native plugin files without exposing other installations'` 확장(저장 false 3출처) · IPC: `handlers/skills.test.ts:'keeps native toggles read-only after accepting namespaced targets'` · UI: `CustomizeList.render.test.ts` 신규 `'renders switches only for Orca skills'`·신규 `SkillDetail.render.test.ts:'renders no switch for default-path skills'` · Query: `adapter.native-plugins.test.ts` 첫 케이스의 adapter fixture를 scan 형태(canToggle false·enabled true)로 바꿔 `toContain('claude:native')` · 메뉴: `attachMenuModel.test.ts` 신규 `'keeps previously disabled harness skills selectable'` | not selected — 양성(Orca switch)·음성(기본 경로 switch 없음) 짝 | EP-03b K2~K5 (4) · EP-04 (6) |
| VP-15 | MD-03 ↔ UT-03 | REQUIRED | `scanRoot` capability | `scan.test.ts:'여러 source root 를 소스 메타와 enabled 상태로 스캔한다'` 확장(adapter:claude 저장 false → enabled true·canToggle false) | not selected | EP-04 S1·S2 (2) |
| VP-16 | R-05 ↔ AT-05 | REQUIRED | `McpStore.add` → `writeMcpFile` → `writeJsonAtomic` | 신규 `store.fresh-root.test.ts:'adds a server when the sources mcp directory does not exist'` — `mcpJsonPath`만 임시 중첩 경로로 mock, 파일 모듈 실제 | not selected — 파일·list 직접 관측 | EP-05 (2) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | `writeJsonAtomic` | 신규 `json-file.test.ts:'creates missing parents, replaces existing files and leaves no temp file'` | not selected | EP-05 J1 (1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 정적 | main·renderer·shared 수정 | `cd app && npm run lint && npm run typecheck` | 현재 변경 유발만 |
| app 테스트 | 위 pair 좌표 | `./node_modules/.bin/vitest run` 관련 스위트(§19) | DB 로드 스위트 ABI 실패는 기준선 분리 |
| 문서 inventory | arch·IPC 문서 문장 수정 | `node scripts/check-doc-inventory.mjs --check` | 현재 변경 유발만 |
| message bus | INDEX·trailer | `git diff --check` · `git log -1 --format='%(trailers:only=true)'` | 현재 커밋 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| renderer agents 상태는 scope(세션·경로·프로젝트·provider·종류)별 객체이고 구독자 0이면 폐기된다 | `composerCatalogState.ts:134-144` 키 = `JSON.stringify(scope)` · `:52-55` dispose |
| main agents 캐시는 OpenCode directory 인스턴스별이다 | `composer-cache.ts:15-29` · `session-context.ts:146` |
| 전송 시 에이전트 membership은 directory 목록으로 다시 확인한다 | `channel.ts:146-154` |
| 전역 선택은 프로세스 메모리 Map이다 | `extension-control.ts:8-16` · `extension-catalog.ts:38` |
| Claude spawn은 경로별 스냅샷을 만들 때만 전역 선택을 읽고, 같은 경로 Query가 남아 있는 동안 재사용한다 | `adapter.ts:438-474` |
| 런타임 수명 = 앱 종료 또는 LRU 축출 | `runtime-pool.ts:8` |
| 초안 명령은 Orca 선택 없이 네이티브 설정만 읽는다 | `plugin-catalog.ts:216-217` · `bootstrap.ts:1134-1138` |
| 초안·미실행 리소스 plugin enabled도 네이티브 설정만 | `configured-resources.ts:101-105` |
| 스킬 탭이 `plugin:*` 출처 스킬과 kind=plugin 네이티브 행을 표시 | `CustomizeList.tsx:48-55`·`:120` |
| `adapter:claude` 스킬만 Orca 토글 대상 | `scan.ts:72-78` |
| 원자 쓰기가 상위 폴더를 만들지 않음 · 재현 ENOENT `open '<tmp>/.config/orcinus-orca/sources/mcp/mcp.json.tmp'` | `json-file.ts:7-11` · 같은 알고리즘 node 재현 |
| Claude CLI는 `@inline:false` plugin의 명령·스킬을 싣지 않는다 | [evidence/claude-inline-probe.md](evidence/claude-inline-probe.md) |
| SDK `skills`는 필터이며 강제 로드가 아니다 | `sdk.d.ts` `skills?: string[]` 주석 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| agents IPC 진입 | `rg -n "composerCatalog\(" app/src/renderer/src` | 2 | 호출 1(`composerCatalogState.ts:88`) + `shared/api/ipc.ts:228` 래퍼 정의 |
| Claude 초안·세션 reader 호출부 | `rg -n "configuredClaudeResources\(\|configuredClaudeCommands\(\|readClaudePluginCatalog\(" app/src/main -g '!*.test.ts'` | 7 | 정의 3 · adapter 2 · skill-catalog 1 · commands 래퍼 1 |
| harness module reader 소비 | `rg -n "configuredCommands\?\.\(\|configuredResources\?\.\(\|draftResources \?\? module" app/src/main/app/bootstrap.ts` | 4 | `:1088·1121·1137·1143` |
| 스킬 capability 소비 | `rg -n "canToggle\|enabled !== false\|enabled === false" adapt.ts attachMenuModel.ts composerSkills.ts handlers/skills.ts` | 4 | `adapt.ts:73`·`skills.ts:58`·`attachMenuModel.ts:98`·`composerSkills.ts:19` |
| `writeJsonAtomic` 호출부 | `rg -n "writeJsonAtomic\(" app/src/main -g '!*.test.ts'` | 6 | 정의 1 + 호출 5(seed·mcp file·scaffold·settings-write·orca-file) |
| OpenCode 전역 plugin 토글 | `configured-resources.ts:127` | 0 | plugin은 canToggle false — 요구 3 동기화 대상 아님 |

### 수치 / 전칭 표현 검산

- "renderer 창은 하나이고 프로그램적 reload 없음": `rg -n "new BrowserWindow\|\.reload\(\)\|location\.reload" app/src/main app/src/renderer/src -g '!*.test.*'` → main 창 1(`index.ts:197`)·브라우저 세션 창 1, reload 0. renderer 모듈 캐시 수명 ≈ 앱 실행 수명.
- 문서 앵커: `adapters.md §1.3`·`IPC_CONTRACT.md` extensions 절(`:196`)·`rendering.md:231`·`design-components.md:273·390` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01·SD-02·AR-01~03.
- A(에이전트): scope마다 `ComposerCatalogState`가 생기고 `subscribe`에서 `read('agents')`. 다른 경로 = 다른 상태 = 다른 IPC = main의 다른 directory 캐시.
- B(카탈로그): 스킬 탭이 `plugin:*` 스킬과 kind=plugin 네이티브 행을, MCP 탭이 kind=mcp 행을 그린다. 플러그인 탭은 provider만.
- C(전역 선택): `sendMessage`가 경로 스냅샷이 없을 때만 선택을 읽어 `plugins` 기본값을 굳힌다. 초안 reader는 선택을 모른다.
- D(기본 스킬): `adapter:claude`만 토글, `agents`·`adapter:opencode`는 회색 고정 토글.
- E(MCP): `writeFileSync(tmp)`가 폴더 부재로 ENOENT.

```text
A  Module(cwd) → useComposerCatalog → ComposerCatalogState(scope) ──read('agents')──▶ IPC ▶ directory 캐시
C  nav toggle → extensionControl(Map) ─(경로 스냅샷 생성 시 1회)─▶ sendMessage → openChannel(pluginDefaults)
   draft Composer → bootstrap draftCommands → configuredClaudeCommands(cwd)   (선택 미반영)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- A: 기능 로컬 `ComposerAgentCache` 싱글톤이 첫 성공 agents를 보관한다. 모든 `ComposerCatalogState`가 생성·구독·결과·무효화에서 캐시를 먼저 본다.
- B: `CustomizeList`가 탭별로 네이티브 kind를 고른다(플러그인 탭=plugin, MCP 탭=mcp, 스킬 탭=없음). 스킬 탭은 네이티브 플러그인 출처 스킬을 제외한다.
- C: `sendMessage`는 Query마다 현재 선택으로 plugin 기본값을 계산한다. 스냅샷은 배포 사본·Orca 스킬만 공유. 초안·세션 reader는 bootstrap이 넘기는 선택을 같은 변환 helper로 적용한다.
- D: capability는 `orca`만 true. UI는 canToggle false 스킬에 switch를 그리지 않는다.
- E: `writeJsonAtomic`이 `mkdirSync(dirname(path), {recursive:true})` 후 쓴다.

```text
A  Module(cwd) → useComposerCatalog → ComposerCatalogState ─(캐시 있음)─▶ ready
                                                       └(없음)─read('agents')─▶ IPC ─성공─▶ ComposerAgentCache ─전파─▶ 모든 상태
C  nav toggle → extensionControl ─(Query마다)─▶ sendMessage → extensionChoices → readClaudePluginCatalog → openChannel
                                └─(조회마다)─▶ bootstrap → harnessModule.configured*(cwd, choices) → reader
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | agents 슬롯 = scope 상태 소유 | agents 값 = `ComposerAgentCache` 소유, 상태는 표시만 | D-001 | AR-01 / VP-03·04 · `composerAgentCache.ts` |
| data/control flow | 스냅샷 생성 때만 선택 읽음 | Query·조회마다 선택 읽음 | D-008·D-006 | SD-02 / VP-09·10 · `adapter.ts`·`bootstrap.ts` |
| state/contract | `configuredCommands?(cwd)`·`configuredResources?(cwd)` | `(cwd, choices)` 필수 인자 | 미전달 시 조용한 회귀 차단 | AR-03 / VP-11 · `contracts.ts` |
| state/contract | 스킬 canToggle = orca·adapter:claude | orca만 | D-007 | MD-03 / VP-15 · `scan.ts` |
| UI 라우팅 | 네이티브 plugin 행 = 스킬 탭 | 플러그인 탭, provider 뒤 | D-004·D-005 | AR-02 / VP-07·08 · `CustomizeList.tsx`·`ExtensionsCatalogView.tsx` |
| error/lifecycle | agents 무효화 = error | 캐시 있으면 ready 유지 | D-001 | SD-01 / VP-02 |
| error/lifecycle | 폴더 부재 ENOENT | 상위 폴더 생성 | D-010 | MD-04 / VP-16·17 · `json-file.ts` |
| test seam | 캐시 없음 | 생성자 주입 캐시(테스트마다 새 인스턴스) | 테스트 격리 | MD-01 / VP-02·04 |

삭제·이동: 스냅샷의 `plugins` 필드는 삭제(Query별 계산으로 이동). 스킬 탭의 네이티브 행 렌더는 플러그인 탭으로 이동. 다른 책임은 유지.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `renderer/.../opencode/composer/composerAgentCache.ts`(신규) | 첫 성공 agents 보관·전파 | `accept(list)`·`get()`·`subscribe(fn)` | `composerCatalogState.ts`·`useComposerCatalog.ts` |
| `adapters/common/extension-control.ts` | 선택 키 ↔ 하네스 키 변환 SSOT | `extensionChoices(choices, kind) → Record<string, boolean>` | Claude adapter·plugin-catalog·configured-resources (OpenCode mcp-control 채택은 선택) |
| `adapters/claude/plugin-catalog.ts`·`configured-resources.ts` | 유효 plugin 상태 계산 | `(cwd, choices)` | harness module 래퍼 |
| `app/harnesses/claude/module.ts` | 계약 → reader 매핑 래퍼 | `(cwd, choices)` | bootstrap |
| `app/bootstrap.ts` | `this.extensionChoices.global(backend)`를 reader에 주입 | — | IPC 등록 |
| `features/skills/components/customize/*` | 탭별 행·토글 렌더 | props | `ExtensionsCatalogView` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 · SD-01·AR-01·MD-01 / VP-01~04 | agents 슬롯 값 = 캐시 우선 | `ComposerAgentCache` | renderer | A1 `composerCatalogState.ts:17` initial · A2 `:51` subscribe 읽기 · A3 `:69` invalidate agents 줄 · A4 `:77` retry · A5 `:82` ready 게이트 · A6 `:94` 취소 결과 · A7 `:104` 성공 수용(캐시 기록) · A8 `:109` 실패 · A9 `useComposerCatalog.ts:7` 무-scope 스냅샷 · A10 신설 캐시 수신 구독 — **10** | `rg -n "agents\|read\(part, true\)\|private invalidate\(\)\|status: 'ready', value\|status === 'ready'\|status: 'error'" app/src/renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts app/src/renderer/src/features/chat/harnesses/opencode/composer/useComposerCatalog.ts` → 13줄. 제외 3줄 `:70-72` = models·mcp·plugins 형제(VP-05 회귀) | 재조회·스피너 재표시·무효화 후 목록 소실·늦은 응답의 캐시 덮어쓰기 |
| EP-02 · SD-02·AR-03·MD-02 / VP-09~12 | Claude plugin 유효 enabled = user < Orca 선택 < project < local | `extensionChoices` + 두 reader | main | C1 `adapter.ts:446` 선택 읽기(스냅샷 밖으로) · C2 `:439·472` 스냅샷 get/set(plugins 제외) · C3 `:492` openChannel 기본값 인자 · C4 `plugin-catalog.ts:216` · C5 `configured-resources.ts:101` 병합 순서 · C6 `module.ts:40` · C7 `module.ts:42` · C8 `contracts.ts:30` · C9 `contracts.ts:36` · C10 `bootstrap.ts:1088` · C11 `:1121` · C12 `:1137` · C13 `:1143` · C14 `extension-catalog.ts:18` nav 표시(변경 없음·회귀) · C15 신설 `extensionChoices` helper — **15** | `rg -n "extensionControl\?\.global\('claude'\)\|extensionSnapshots\.(get\|set)\|owned\.plugins\|configuredCommands\??[:(]\|configuredResources\??[:(]\|configuredCommands\?\.\(\|configuredResources\?\.\(\|draftResources \?\? module\.configuredResources\|export async function configuredClaudeCommands\|const enabledPlugins = \{\|control\.global\(backend\)" app/src/main/adapters/claude/adapter.ts app/src/main/adapters/claude/plugin-catalog.ts app/src/main/adapters/claude/configured-resources.ts app/src/main/app/bootstrap.ts app/src/main/app/harnesses/claude/module.ts app/src/main/app/harnesses/common/contracts.ts app/src/main/app/handlers/extension-catalog.ts` → 16줄. 제외 1줄 `adapter.ts:480` = release 수명(값 운반 없음), C2는 2줄 | off가 새 Query·초안에 안 감(요구 5·3 재발) 또는 프로젝트 우선순위 역전 |
| EP-03a · AR-02 / VP-07·08 | 네이티브 행·상태의 탭 귀속 | `CustomizeList`·`ExtensionsCatalogView` | renderer | R1 `CustomizeList.tsx:54` kind 선택 · R2 `:63` 빈 상태 · R3 `:120` 네이티브 블록 조건·제목·위치 · R4 `:208` provider 블록과 순서 · R5 `ExtensionsCatalogView.tsx:140` 실패 배너 · R6 `:151` 로딩 · R7 `:162` 빈 억제 — **7** | `rg -n "tab === 'skills'\|tab !== 'providers'\|tab === 'providers'\|resource\.kind === \(\|nativeMcp\.(loading\|failed)" app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx` → 17줄. 제외 10줄: `ExtensionsCatalogView.tsx:52·59·64·121·128·129·131`·`CustomizeList.tsx:52·57·74` = 상세 선택·제목·추가 버튼·비네이티브 행·스킬 블록(네이티브 값 비운반) | 플러그인이 스킬 탭에 남거나 순서·상태가 엉뚱한 탭에 표시 |
| EP-03b · AR-02·R-04 / VP-07·08·14 | 스킬 탭 가시성·토글 GUI | `CustomizeList`·`SkillDetail` | renderer | K1 `CustomizeList.tsx:48-50` visibleSkills · K2 `:95` 제목 색 · K3 `:109-112` 행 토글 · K4 `SkillDetail.tsx:88` 제목 색 · K5 `SkillDetail.tsx:93-96` 상세 토글 — **5** | `rg -n "visibleSkills\|skillSourceAllowed\|skill\.canToggle\|<CatalogToggle" app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx app/src/renderer/src/features/skills/components/customize/SkillDetail.tsx` → 13줄(K1 2·K3 2·K5 2·K2·K4 각 1). 제외 5줄: `CustomizeList.tsx:13` import · `:52·75` K1 변수 소비 · `:157·198` 네이티브·MCP 토글(D11 유지) | plugin 스킬 노출 또는 기본 경로 스킬에 토글 잔존 |
| EP-04 · MD-03·R-04 / VP-14·15 | 스킬 capability | `scan.ts` | main | S1 `scan.ts:72-75` enabled · S2 `:78` canToggle · 소비(변경 없음·회귀) U1 `adapt.ts:73` · U2 `skills.ts:58` · U3 `attachMenuModel.ts:98` · U4 `composerSkills.ts:19` — **6** | `rg -n "canToggle\|enabled !== false\|enabled === false\|^\s+enabled:$" app/src/main/features/extensions/common/skills/scan.ts app/src/main/adapters/claude/adapt.ts app/src/main/app/handlers/skills.ts app/src/renderer/src/features/chat/lib/attachMenuModel.ts app/src/renderer/src/features/chat/lib/composerSkills.ts` → 7줄. 제외 1줄: 주석 `adapt.ts:67` | 기본 경로 스킬이 꺼진 채 실행·메뉴 disabled |
| EP-05 · MD-04·R-05 / VP-16·17 | 상위 폴더 생성 | `writeJsonAtomic` | main | J1 `json-file.ts:7-11` · J2 `mcp/file.ts:32` MCP 경로 — **2** | `rg -n "export function writeJsonAtomic\|writeJsonAtomic\(mcpJsonPath" app/src/main` → 2줄 | 폴더 없는 첫 MCP 추가 실패 |

- 자리 목록은 그 검색 출력과 차집합 0이어야 한다. verify가 시도해 테스트가 잡지 못한 고장은 목록 안팎 모두 다음 구현이 고친다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- SSOT: 선택 키 변환은 `extensionChoices` 하나다(adapter `:447-451`의 인라인 filter/slice 대체). reader 두 곳의 우선순위는 같은 순서 문장과 VP-12 형제 맞바꿈 변이로 잠근다.
- `실패 의미`의 "다른 게이트가 막는다" 주장: 해당 없음.
- 선택적 필드: `choices`는 계약에서 **필수**다. `undefined` 허용 시 bootstrap 누락이 네이티브-only로 조용히 돌아가므로 금지. 빈 객체 `{}` = Orca 선택 없음.
- 외부 SDK 경계: Claude flag settings `enabledPlugins`의 local root 키는 `<manifest name>@inline`(실측). 기존 `adapter.ts:624-632` 생성 규칙 유지.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/harnesses/opencode/composer/composerAgentCache.ts`(신규) | 앱 전역 agents | `class ComposerAgentCache { get(); accept(list) /*첫 성공만*/; subscribe(fn) }` + `export const composerAgentCache` | 순수 단위 |
| `.../composer/composerCatalogState.ts` | 캐시 우선 | 생성자 3번째 인자 `agents = composerAgentCache`. A1~A10 규칙: 캐시 있으면 agents ready·요청 생략·무효화/실패/취소에도 ready 유지, 성공 시 `accept` 후 캐시 값 표시, 구독 중 캐시 수신 시 반영·해제 시 구독 해제 | 생성자 주입 단위 |
| `.../composer/useComposerCatalog.ts` | 무-scope 스냅샷 | `pending.agents`를 캐시 값 기반으로 계산(캐시 변화 구독) | Module 통합 |
| `app/src/main/adapters/common/extension-control.ts` | 변환 SSOT | `extensionChoices(choices, kind)` 추가 | 순수 단위 |
| `app/src/main/adapters/claude/adapter.ts` | Query별 기본값 | `sendMessage`에서 스냅샷 유무와 무관하게 `readClaudePluginCatalog(..., {…provider, enabledPlugins: {…provider.enabledPlugins, …extensionChoices(choices,'plugin')}}, true).defaults` 계산. 스냅샷 타입에서 `plugins` 제거 | adapter SDK mock |
| `app/src/main/adapters/claude/plugin-catalog.ts` | 초안 명령 | `configuredClaudeCommands(cwd, choices)` — overrides에 변환 결과 | 실제 임시 파일 |
| `app/src/main/adapters/claude/configured-resources.ts` | 초안 리소스 | `readConfiguredClaudeResources(..., choices = {})`, 병합 `{…user, …choices, …project, …local}`. globalOnly 경로는 nav handler overlay 유지 | 실제 임시 파일 |
| `app/src/main/app/harnesses/common/contracts.ts` | 계약 | `configuredResources?(cwd, choices)`·`configuredCommands?(cwd, choices)`·`draftResources?(cwd, choices)` | typecheck + VP-11 |
| `app/src/main/app/harnesses/claude/module.ts` | 매핑 래퍼 | `(cwd, choices) => configuredClaudeResources(cwd, undefined, false, choices)` 등 — 2번째 인자 `paths` 충돌 방지 | VP-11 |
| `app/src/main/app/bootstrap.ts` | 주입 | `:1088·1121·1137·1143`에 `this.extensionChoices.global(<backend>)` 전달 | bootstrap 테스트 |
| `app/src/main/features/extensions/common/skills/scan.ts` | capability | canToggle = `sourceKind === 'orca'`, enabled = orca면 저장값, 아니면 `entry.enabled ?? true` | 단위 |
| `app/src/shared/extension-sources.ts` | 출처 술어 | `isNativePluginSkillSource(sourceId)`(= `plugin:` 접두) 추가 | 단위/렌더 |
| `app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx` | 탭 라우팅·토글 | R1~R4·K1~K3 | 렌더 |
| `.../customize/ExtensionsCatalogView.tsx` | 탭별 상태 | R5~R7: `selection.tab !== 'skills'` 기준 | renderHarness 상호작용 |
| `.../customize/SkillDetail.tsx` | 상세 토글 | K4·K5 | 렌더 |
| `app/src/main/infra/config/json-file.ts` | 폴더 생성 | `mkdirSync(dirname(path), {recursive: true})` | 실제 임시 파일 |
| 문서 4곳 | 현재 상태 서술 갱신 | §18 | inventory gate |

### 테스트 가능성

- electron 의존 분리: `json-file.ts`·`scan.ts`·`extension-control.ts`·`composerAgentCache.ts`는 electron 미import. `McpStore`는 `paths` mock만으로 실제 파일 쓰기 가능(`store.test.ts`가 이미 같은 모듈 그래프를 import).
- 기존 메커니즘 재사용: renderer 상호작용은 `renderHarness.testfixture`(32파일 사용) — `ExtensionsCatalogView`는 `useNavigate`가 있으므로 router mock 또는 MemoryRouter로 감싼다.
- 테스트 격리: 기존 `composerCatalogState.test.ts`는 `new ComposerCatalogState(scope)`를 직접 만든다 — 각 테스트에 새 `ComposerAgentCache`를 주입해 싱글톤 누수를 막는다.

## 12. End-to-end 영향

### producer → consumer

```text
nav toggle(IPC) → extensionControl → {sendMessage flags | bootstrap reader(choices)} → SDK options | NativeResources.commands/items → Composer `+`·우측 패널
OpenCode /agent(IPC) → ComposerCatalogState → ComposerAgentCache → 모든 Composer Controls
```

- producer 기준: 선택은 `extensionControl` 하나, 에이전트 목록은 첫 성공 응답 하나.
- consumer 파생 규칙: 실행 중 세션은 live Query 값이 우선(`session-resources.ts:96-97` `live?.commands ?? commandsRead`). 초안·미실행은 reader 값.
- 파생 합성값의 정본 우회: 없음 — 캐시는 원본 응답 그대로, flag는 helper 한 곳.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `project-resource-sync` read(`bootstrap.ts:1068-1081`) | 같은 `readResources` 클로저를 쓰므로 choices 반영 | AC10 |
| `session-resources.ts` read의 `pluginsAuthoritative` 병합 | configured plugin enabled 변화만, 항목 수 불변 | AC10·AC12 |
| `skill-catalog.ts` plugin 스킬 수집 | 그대로 수집(표시만 숨김) — composer·turn 경로 불변 | AC5·AC15 |
| `adaptSkills` | adapter:claude 전부 포함으로 증가 | AC15 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 캐시는 renderer 모듈 로드 시 빈 값. 첫 성공에서 1회 기록.
- 취소/중단: scope 해제·취소 결과는 캐시를 건드리지 않는다.
- 종료/quit/crash/renderer-gone: renderer 재생성 시 캐시도 초기화되어 1회 더 조회한다(허용).
- retry/timeout/partial failure: agents 실패는 다음 scope 또는 같은 scope 재구독 때 재시도. retry('agents')는 캐시가 있으면 no-op.
- cleanup/rollback: 캐시 구독은 상태 dispose에서 해제.
- **다중 저장소 쓰기**: 해당 없음 — 전역 선택은 메모리 1곳(D-009). MCP 추가는 mcp.json + 설정 저장소(mcpMeta) 기존 순서 불변, 이번 변경은 폴더 생성만 앞에 둔다. 산출 문서 사본은 `plan.md` + `INDEX.md` 2곳이며 이번 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: agents IPC = 앱 실행당 성공 1 + 실패 재시도분. 동시 scope 수 S일 때 첫 성공 전 최대 S건(기존과 같음).
- Claude spawn: Query마다 `readClaudePluginCatalog` 1회 추가 — 기존 `openChannel`도 같은 함수를 1회 호출하므로 파일 읽기 2배(설정 JSON·manifest 수십 KB 이하). 허용.
- 캐시로 잃는 부수 효과: 다른 경로 전용 에이전트가 섞이거나 빠진다 → 전송 시 membership 확인(D-003)이 막는다(VP-06).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 외부/배포가 구현할 port 변경: 없음. `MainHarnessModule`은 앱 내부 계약이며 구현은 claude·opencode 두 module뿐(`rg -n "MainHarnessModule = \{" app/src/main/app/harnesses` → 2).
- 구현 문서: `adapters.md §1.3`·`IPC_CONTRACT.md` extensions 절 갱신.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0281 D2 "같은 작업폴더·실행 세대에서 재사용" | 0281 plan | D-001, §9 A | 변경 — agents 슬롯만 앱 전역(사용자 요구 1) |
| 0281 D4 "경로 전환 때 이전 실행 목록 미사용" | 0281 plan | D-001 | 변경 — agents만. models 등 유지 |
| 0281 D5 제목 스피너 | 0281 ΔV1 | D-002 | 유지 |
| 0278 D11 회색·고정 토글 | 0278 plan | D-007 | 변경 — 기본 경로 스킬만. MCP·plugin 유지 |
| 0278 D15 실행 중 인스턴스 비소급 | 0278 plan | D-008 | 유지 |
| 0278 D28 같은 cwd 새 세션도 비소급 | 0278 plan | D-008 | 변경 — Claude plugin 기본값만. Orca 스킬·배포 사본·OpenCode MCP 유지 |
| 0278 D22 기본값 사본 저장소 금지 · D26 SDK 제어 | 0278 plan | D-009 | 유지 |
| 0278 D16·D20 프로젝트 우선 | 0278 plan | D-011 | 유지 |
| `adapters.md §1.3` "같은 작업경로의 살아 있는 Query들은 시작 시점 plugin 기본값·스킬 선택·Orca 배포 사본을 공유" | arch | §18 | 변경 — plugin 기본값 제외, "사용자 스킬 선택" 문장 삭제 |
| `IPC_CONTRACT.md:196` "Claude plugin과 Claude 사용자 스킬은 SDK 옵션" | 계약 | §18 | 변경 — 사용자 스킬 제외 |
| `rendering.md:231` 스킬 탭 출처 구분 | arch | §18 | 변경 — 플러그인 탭 그룹 서술 |
| `design-components.md:273·390` | 카탈로그 | §18 | 변경 — agents 앱 전역 캐시, 기본 경로 스킬 토글 없음 |
| 테스트가 잠근 반대 동작 4건 | §7 주의사항 | VP-08·09·10·14 | 변경 — 기대값 갱신 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 첫 로드 경로의 프로젝트 전용 에이전트가 다른 경로 메뉴에 보임 | 사용자 요구 1의 결과로 수용. 전송 시 membership 확인(D-003) |
| 같은 경로 세션끼리 plugin 상태가 다를 수 있음 | Q1 선택의 결과. 각 세션 패널·Composer는 자기 Query 실제 상태 표시 |
| 재시작 후 off가 사라짐 | D-009 유지 · U-001로 기록. 재시작 후엔 표시·실행이 같아 불일치는 없음 |
| `writeJsonAtomic` 폴더 생성이 다른 4개 호출부에도 적용 | 기존 호출부는 이미 폴더를 만들거나 생성이 무해 — 회귀는 기존 테스트로 확인 |

- 되돌리기 어려운 결정: 없음(저장 형식 변경 없음).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/harnesses/opencode/composer/{composerAgentCache.ts(신규),composerCatalogState.ts,useComposerCatalog.ts}` + 테스트
- `app/src/main/adapters/common/extension-control.ts` · `app/src/main/adapters/claude/{adapter.ts,plugin-catalog.ts,configured-resources.ts}` + 테스트
- `app/src/main/app/{bootstrap.ts,harnesses/common/contracts.ts,harnesses/claude/module.ts}` + `bootstrap.native-history.test.ts`
- `app/src/main/features/extensions/common/skills/scan.ts` · `app/src/shared/extension-sources.ts`
- `app/src/renderer/src/features/skills/components/customize/{CustomizeList.tsx,ExtensionsCatalogView.tsx,SkillDetail.tsx}` + 테스트
- `app/src/main/infra/config/json-file.ts` + `json-file.test.ts`(신규) · `features/extensions/common/mcp/store.fresh-root.test.ts`(신규)
- `docs/arch/backend/adapters.md §1.3` · `docs/IPC_CONTRACT.md` extensions 절 · `docs/arch/frontend/rendering.md` · `docs/arch/frontend/design-components.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/renderer/AGENTS.md`(디자인 시스템·카탈로그 준수), `app/src/main/AGENTS.md`(레이어).
- ABI/네트워크 등 환경 제약: 아래 스위트는 DB 미로드. 실제 CLI·Windows 창은 AC18 사람 실기.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/renderer/src/features/chat/harnesses/opencode/composer src/renderer/src/features/skills src/renderer/src/features/chat/lib/attachMenuModel.test.ts src/renderer/src/features/chat/harnesses/common/composer/Composer.native-menu.test.ts src/main/adapters/claude src/main/adapters/common src/main/adapters/opencode/v1/adapter.persistent.test.ts src/main/app/bootstrap.native-history.test.ts src/main/app/native-resource-sharing.test.ts src/main/app/handlers/session-resources.test.ts src/main/features/extensions/common src/main/infra/config`.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC18.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-011, U-001, 대체 관계 6건.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — 요구 1~6 원문 인용, Q2 응답 원문 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 A~D ↔ AC1~17 ↔ §9 A~E.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축/구체성으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 TO-BE에 명시했다 — 스냅샷 `plugins` 삭제, 네이티브 행 이동.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 표·CLI probe.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없으면 Baseline V를 썼다.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R 5·SD 2·AR 3·MD 4, AT-06은 VP-09 실기로 귀속.
- [x] 영향받은 INHERITED node는 REGRESSION이다 — VP-05·06·13.
- [x] 각 pair의 경로·§10 분모·자리별 좌표가 있고 적대 증거는 VP-01·02·08·09·12에만 선택했다.
- [x] 현재 변경 산출물의 운영 gate가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC18은 실제 CLI·창·테마만.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC1 호출 수는 DOM 목록·스피너 단언과 짝.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — `extensionChoices`·`ComposerAgentCache`.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표.
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14.
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고, `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

# ΔV1 — OpenCode 네이티브 플러그인 off (2026-10-23)

판정: READY. 사용자 후속 요구 "다음 내용의 요구는 opencode에서도 적용돼야 한다 — claude의 네이티브 플러그인(e.g., superpowers)이 off 되었는데도 /context 커맨드 확인 시 로드됐다고 표시되고 있다."를 D-012~D-018로 반영한다. V1의 Claude 경로·AC1~AC18은 그대로다.

## ΔV1-1. 1차 소스 사실 (OpenCode 1.18.27 · Orca `57515e7`)

| 사실 | 근거 |
|---|---|
| 개별 플러그인 off API·설정 필드가 없다 | SDK 엔드포인트 전수에 plugin 제어 0(`types.gen.d.ts` `url:` 목록) · `Config.plugin?: Array<string \| [string, object]>` |
| 외부 플러그인 = 모든 출처 `plugin_origins` 합집합. 끄는 수단은 전부 끄는 `pure`뿐 | `config/config.ts:344-367` · `plugin/index.ts:180` |
| 전역 파일 병합 순서 `config.json → opencode.json → opencode.jsonc`, 배열은 뒤 파일이 교체 | `config/config.ts:272-274`(remeda `mergeDeep`) |
| 전역 설정은 서버 프로세스 수명 동안 캐시 | `config/config.ts:295-302` `Duration.infinity` |
| `PATCH /global/config`는 변경 시 그 서버의 모든 인스턴스를 폐기 | `server/routes/instance/httpapi/handlers/global.ts:78-80` |
| 인스턴스 dispose는 전역 캐시를 다시 읽지 않는다 | `config/config.ts:652-654` — invalidate는 `update`·`updateGlobal`에서만 |
| 스킬 `permission` deny는 스킬 목록만 줄이고 hook·tool은 남긴다 | `skill/index.ts:310-314` — 플러그인 off가 아님 |
| Orca 서버 풀 `retire`는 새 acquire를 새 서버로 보내고 기존 owner는 유지 | `server.ts:153-156` |
| nav 카탈로그는 서버를 만들지 않는다 | `extension-catalog.ts:39` 주석 · `adapters.md §1.3` |
| 같은 파일 동시 편집 방어 = `nativeFileMutations`(파일별 큐·최신본 재패치·외부 변경 재시도·EBUSY 재시도) | `infra/config/file-mutation.ts:12-158` · 사용처 `plugin-state.ts:15` |
| `jsonc-parser` 3.3.1 — MIT, 의존성 0, 2024-06-24 배포 | `npm view jsonc-parser` |

## ΔV1-2. Product 변경

```text
nav → 플러그인 탭 → OpenCode 플러그인 행
  · 사용자 전역 설정의 실제 plugin 배열에 있는 항목, Orca가 끈 항목: 일반 글씨·가변 토글
  · 자동 탐색 plugin(s)/ 파일·프로젝트·OPENCODE_CONFIG·ProgramData·provider 설정 항목: 회색·고정 토글(현행)
  → 토글 클릭
     ├ 실행 중 OpenCode 세션 0개 → 즉시 적용
     └ 1개 이상 → 확인 대화상자 "OpenCode 서버 재시작" → 취소: 아무 변화 없음 / 변경: 적용
  → 적용: off = 원래 항목 기록 후 전역 파일에서 제거 · on = 원위치 삽입 후 기록 삭제
  → 새 OpenCode 연결은 새 서버, 실행 중 세션은 기존 서버(끝나면 기존 서버 종료)
  → 열린 OpenCode Composer: 에이전트 캐시 비움 → 새 서버에서 1회 다시 준비(제목 스피너)
  ↘ 파일 오류(손상·권한·경로 변경·외부 변경 지속): 기존 저장 실패 토스트, 기록·파일 원상태
```

| 시작 상태/이벤트 | 시스템 동작 | 보이는 결과 |
|---|---|---|
| 세션 있음 + 토글 클릭 | main이 확인 필요 응답 | 대화상자. 승인 전 파일·기록·행 불변 |
| 대화상자 취소 | 요청 폐기 | 행 상태 그대로 |
| 승인 또는 세션 없음 | 기록·파일 쓰기 → 서버 교체 → Composer 재준비 | 행 off/on, 새 세션에 플러그인 반영 |
| 기록만 있고 파일에도 항목 존재(중단·외부 재추가) | 조회 때 on으로 보고 기록 정리 | 행 on |
| 파일 쓰기 실패 | 기록 되돌림 + 오류 보고 | 토스트, 행 이전 상태 |

- 대화상자 문구 초안(ko): 제목 "OpenCode 서버 재시작", 본문 "실행 중인 OpenCode 세션이 {{count}}개 있습니다. 플러그인 변경은 새로 시작하는 OpenCode 서버에서 적용되고, 실행 중인 세션은 끝날 때까지 이전 설정으로 동작합니다.", 확인 "변경", 취소 "취소". en 동등 문구 추가.
- Claude 플러그인·OpenCode MCP 토글은 대화상자가 없다(D-008·D-018).
- 범위: 사용자 전역 설정에 선언된 OpenCode 플러그인의 nav on/off. 비범위: 위 고정 출처, 우측 패널 프로젝트 제어(0278 D32), 실행 중 세션의 플러그인 언로드, OpenCode MCP 적용 시점.

## ΔV1-3. Acceptance — AC19~AC26

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-06 | AT-07 / AC19 | OpenCode 플러그인 행 canToggle = 실효 전역 파일의 `plugin` 배열 항목과 Orca 기록 항목만 true. 기록 항목은 enabled false·status `disabled`. 그 밖은 false | 세 전역 파일·자동 탐색 폴더·기록이 섞인 임시 루트에서 catalog 결과 | nav → `orca:extensions:catalog` → `globalOpenCodeResources` + 기록 |
| R-06 | AT-07 / AC20 | off는 그 항목만 제거하고 나머지 텍스트·주석·서식을 보존하며 spec·옵션·위치·파일을 기록한다. on은 원래 값(튜플 옵션 포함)을 원위치(범위 밖이면 끝)에 넣고 기록을 지운다 | 주석 있는 JSONC fixture로 off→on 왕복 시 원문 바이트 동일 | `orca:extensions:setEnabled` → 파일 제어 |
| R-06 | AT-07 / AC21 | 같은 파일에 두 토글·외부 편집이 겹쳐도 모두 반영되고 실패 토스트가 없다 | 서로 다른 두 플러그인 동시 off · commit 직전 외부 쓰기 주입 | `nativeFileMutations` |
| R-06 | AT-07 / AC22 | 쓰기 순서 off = 기록 → 파일, on = 파일 → 기록. 파일 실패 시 기록 원복. 기록·파일 모두에 있으면 on으로 보고 기록을 정리 | 파일 쓰기 실패 주입 · 기록만 남은 상태 조회 | 같은 경로 |
| R-06 | AT-07 / AC23 | 실행 중 OpenCode 세션 ≥1이면 첫 요청은 확인 필요 응답이고 파일·기록 불변. 승인 요청만 적용. 세션 0이면 첫 요청에서 적용. Claude·OpenCode MCP는 항상 즉시 | handler 응답·파일·기록 · renderer 대화상자 열림·취소·승인 | 행 토글 → `useNativeMcpCatalog.toggle` → IPC → handler |
| R-06 | AT-07 / AC24 | 적용 후 새 OpenCode 연결(세션·Composer 준비)은 새 서버 프로세스를 시작하고 기존 owner는 기존 연결을 유지한다. 기존 서버는 마지막 owner 해제 때 종료 | 서버 풀 start 호출 수·연결 URL·terminate 시점 | handler → `extensionsChanged` → `OpenCodeServerPool.retireAll` |
| R-06 | AT-07 / AC25 | 적용 후 열린 OpenCode Composer는 에이전트 캐시를 비우고 준비를 다시 해 새 목록을 1회 받는다(제목 스피너). 모델 값은 갱신 중에도 유지. 플러그인 변경이 없으면 D-001대로 재사용 | owner 재준비 · renderer agents loading→ready·models 값 유지 · 이후 재요청 0 | owners.revalidate → `composerCatalogInvalidated` → state |
| R-06 | AT-08 / AC26 | Windows 실기: 실제 OpenCode 플러그인 off → 새 세션에서 그 플러그인 에이전트·스킬 없음, 전역 파일 주석 보존, 대화상자 문구 | 사람 실기 | 설치본 |

- AC 총 26건(>25). 분할을 검토했으나 V1과 같은 handler·플러그인 탭 행·에이전트 캐시를 함께 바꿔 handoff를 나누면 순서 의존이 생기므로 유지한다. ΔV1 pair는 별도 노드라 verify가 따로 판정할 수 있다.
- AC20 "바이트 동일"은 jsonc-parser `modify` 삽입이 원래 줄바꿈·들여쓰기와 다를 수 있으므로 fixture 서식을 `formattingOptions`와 맞춘다. 서식이 다른 원문은 "그 항목 외 텍스트 불변 + 주석 보존"으로 단언한다.

## ΔV1-4. V

- V mode: Delta V. 기준 V = `0282:V1@789a727`(`git cat-file -t 789a727` → commit). 변경이 시작되는 수준: R.

| Node | 레벨 | 계약 | provenance | 기준선 / 대체 |
|---|---|---|---|---|
| R-06 / AT-07·AT-08 | R / AT | AC19~AC26 | NEW | — |
| SD-03 / ST-03 | SD / ST | 확인 → 기록·파일 순서 → 서버 교체 → Composer 재준비 → reconcile | NEW | — |
| AR-04 / IT-04 | AR / IT | nav → handler(세션 수·확인) → module 파일 제어 → 설정 기록 port → `nativeFileMutations` | NEW | — |
| AR-05 / IT-05 | AR / IT | handler → adapter `extensionsChanged` → 서버 풀 · owners revalidate → renderer state | NEW | — |
| MD-05 / UT-05 | MD / UT | JSONC `plugin` 배열 제거·삽입 | NEW | — |
| MD-06 / UT-06 | MD / UT | 실효 전역 파일 판정과 capability 분류 | NEW | — |
| MD-01 / UT-01 | MD / UT | `ComposerAgentCache` + revision reset | CHANGED | V1 MD-01 |
| R-02 / AT-02 | R / AT | 플러그인 탭 행(OpenCode 토글 가변화) | INHERITED | V1 |
| R-01 / AT-01 | R / AT | 플러그인 변경 없을 때 1회 로드 | INHERITED | V1 |
| SD-0281 / ST-0281 | SD / ST | models·MCP·plugins 재준비 중 값 유지 | INHERITED | V1 VP-05 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-18 | R-06 ↔ AT-07·AT-08 | REQUIRED | 행 토글 → `useNativeMcpCatalog.toggle` → IPC → handler → 확인/적용 → 파일·기록 → 서버 교체 → Composer | 신규 `ExtensionsCatalogView.interaction.test.ts:'asks before changing an OpenCode plugin while sessions run and applies only after confirmation'`(IPC mock: 1차 confirm·2차 applied, `useConfirmStore` 관측) · `extension-catalog.test.ts` 신규 `'requires confirmation for OpenCode plugin changes only while OpenCode sessions run'` · AC26 실기 | required — "승인 전 불변"은 음성 단언. 변이: 확인 검사 제거, backend 분기 claude/opencode 맞바꿈 | EP-06 P6·P7·P10~P13 (6) |
| VP-19 | SD-03 ↔ ST-03 | REQUIRED | off(기록→파일) / on(파일→기록) / 실패 원복 / reconcile | 신규 `global-plugins.test.ts`: `'records before removing and restores the original entry at its index'` · `'rolls back the record when the file write fails'` · `'reports a recorded plugin that is still declared as enabled and clears the record'` · `'applies concurrent toggles and an external edit without failure'` | required — 순서 계약. 변이: 쓰기 순서 뒤집기(크래시 주입 테스트 red), 원복 제거 | EP-06 P14·P16·P17 (3) |
| VP-20 | AR-04 ↔ IT-04 | REQUIRED | bootstrap → `registerExtensionCatalogHandlers` deps → `harnessModule('opencode').globalResourceControl` → settings 기록 port → 파일 | `bootstrap.native-history.test.ts` 신규 `'routes OpenCode plugin toggles through the file control and the settings record'`(실제 handler, 임시 `XDG_CONFIG_HOME`) | not selected — 파일·기록·응답 직접 관측 | EP-06 P8·P9·P15·P18 (4) |
| VP-21 | AR-05 ↔ IT-05 | REQUIRED | changed → OpenCode adapter `extensionsChanged` → `retireAll` → 새 acquire / owners.revalidate → 이벤트 → state reset·refresh | 신규 `server.test.ts:'starts a new server for new owners after retireAll while existing owners keep theirs'` · `handlers/composer-catalog.test.ts` 신규 `'revalidates every OpenCode owner with the plugin revision'` · `composerCatalogState.test.ts` 신규 `'resets agents once per revision and refreshes subscribed parts while keeping models'` | required — 형제 슬롯(agents reset·models 유지) 계약. 변이: models도 reset, revision 비교 뒤집기 | EP-07 (12) |
| VP-22 | MD-05 ↔ UT-05 | REQUIRED | `removePluginEntry`·`insertPluginEntry` | 신규 `openCodePluginConfig.test.ts:'removes and reinserts string and tuple entries while preserving comments'` | not selected — 텍스트 직접 비교 | EP-06 P17 (1) |
| VP-23 | MD-06 ↔ UT-06 | REQUIRED | 전역 파일 3종 → 실효 파일 → 항목별 canToggle | `configured-resources.test.ts` 신규 `'marks only plugins declared by the effective global file as toggleable'` | required — 형제 파일 우선순위. 변이: `opencode.json`↔`opencode.jsonc` 순서 맞바꿈 | EP-06 P1~P5 (5) |
| VP-24 | MD-01 ↔ UT-01 | REQUIRED | `ComposerAgentCache.reset(revision)` | `composerAgentCache.test.ts` 신규 `'resets once for a newer revision and ignores stale revisions'` + V1 `'keeps the first accepted list and notifies each subscriber once'` | not selected | EP-07 Q11 (1) |
| VP-25 | R-02 ↔ AT-02 | REGRESSION | 플러그인 탭 OpenCode 행 토글 capability | V1 VP-07·VP-08 좌표 + `CustomizeList.render.test.ts`의 OpenCode 행 canToggle true/false 케이스 | not selected | 0 — CustomizeList 변경 없음(값은 main capability) |
| VP-26 | R-01 ↔ AT-01 | REGRESSION | 플러그인 변경 없는 경로 | V1 VP-01 좌표 | not selected | 0 |
| VP-27 | SD-0281 ↔ ST-0281 | REGRESSION | 재준비 중 models·MCP·plugins | V1 VP-05 좌표 + VP-21 renderer 좌표의 models 유지 단언 | not selected | 0 |

## ΔV1-5. Technical Design

### AS-IS → TO-BE

| 비교 축 | AS-IS | TO-BE | V / 파일 |
|---|---|---|---|
| capability | OpenCode plugin canToggle false 고정 | 실효 전역 파일 항목·기록 항목만 true | VP-23 · `configured-resources.ts:127` |
| 상태 저장 | 없음(메모리 선택은 MCP만) | 파일 `plugin` 배열 + Orca 설정 `openCodeDisabledPlugins` | VP-19 · 신규 `global-plugins.ts`·settings |
| 쓰기 경로 | 없음 | handler → module control → `nativeFileMutations` + jsonc-parser | VP-20·22 |
| 확인 | 없음 | handler가 OpenCode 실행 중 세션 수로 `confirm` 응답, renderer `openConfirmDialog` | VP-18 · `extension-catalog.ts`·`useNativeMcpCatalog.ts` |
| 적용 | 해당 없음 | `extensionsChanged` → `retireAll` + owners revalidate(revision) | VP-21 |
| 에이전트 캐시 | 첫 성공 유지(V1) | revision 증가 시 1회 reset | VP-24 |

### 계약

- `SetGlobalNativeResource`에 `confirmed?: true`. 응답 `SetGlobalNativeResourceResult = { status: 'applied'; resources: NativeResources } | { status: 'confirm'; reason: 'opencode-restart'; sessions: number }`. `confirmed` 부재 = 미승인(fail-closed).
- `Settings.openCodeDisabledPlugins: Array<{ id: string; file: string; entry: string | [string, Record<string, unknown>]; index: number }>` 기본 `[]`. **`SettingsPatchSchema`·`SettingsPatch`에 넣지 않는다** — renderer는 쓸 수 없고 main 전용 setter(`settings-store`)만 쓴다(`extension-catalog.test.ts:'does not reactivate legacy choice bytes or accept writes through settings.patch'`와 같은 원칙).
- `MainHarnessModule.globalResourceControl?: { set(item, enabled): Promise<void> }` — OpenCode만 구현. handler는 이 port가 그 항목을 소유하면 메모리 선택(`setGlobal`)을 쓰지 않는다.
- `SessionAdapter.extensionsChanged?(): void` — OpenCode 구현이 서버 풀 `retireAll()` 호출.
- `ComposerCatalogInvalidated`에 `revalidate?: number`(플러그인 revision). 있으면 renderer는 error로 바꾸지 않고 캐시 reset 후 구독 중인 part를 `refresh`로 다시 읽는다.
- 실효 전역 파일 = `config.json`·`opencode.json`·`opencode.jsonc` 중 `plugin` 배열을 가진 마지막 파일(OpenCode 병합 순서). 전역 루트는 nav와 같은 `XDG_CONFIG_HOME`/`~/.config/opencode`.

### §10 강제 지점 — ΔV1

| V / pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| EP-06 · VP-18~20·22·23 | OpenCode 플러그인 상태 = 실효 파일 + 기록 | P1 `configured-resources.ts:32` 전역 루트 · P2 `:83` spec 수집(파일·원값 보존) · P3 `:106` plugin 항목 · P4 `:108` status · P5 `:127` canToggle · P6 `extension-catalog.ts:18` read 병합(OpenCode plugin은 메모리 선택 미적용·기록 행 추가) · P7 `:38` set 분기 · P8 `:15` handler deps · P9 `bootstrap.ts:1201` 배선 · P10 `protocol.ts:765` 요청 스키마 · P11 `preload/index.ts:290` 응답 타입 · P12 `renderer/src/shared/api/ipc.ts:221-223` 래퍼 · P13 `useNativeMcpCatalog.ts:94` 확인 흐름 · P14 `protocol.ts:796` 근처 `SettingsSchema` 기록 필드 · P14b `protocol.ts:833` `SettingsPatchSchema`에 넣지 않음 · P15 `ipc.ts:1163` `SettingsPatch` 제외 · P16 신설 settings-store 전용 setter · P17 신설 `adapters/opencode/v1/global-plugins.ts`(JSONC 편집+기록 병합) · P18 신설 `contracts.ts` port + `opencode/module.ts` 배선 — **19** | `rg -n "canToggle: item\.kind === 'mcp'\|kind: 'plugin',\|status: installation \?\|plugins\.add\(spec\)\|const globalRoot\|const choices = control\.global\|control\.setGlobal\|SetGlobalNativeResourceSchema = \|setGlobalExtension\|registerExtensionCatalogHandlers\(\|skillEnabled: z\.record\|'scheduler' \| 'nativeExtensionChoices'" app/src/main/adapters/opencode/v1/configured-resources.ts app/src/main/app/handlers/extension-catalog.ts app/src/shared/protocol.ts app/src/shared/ipc.ts app/src/preload/index.ts app/src/renderer/src/shared/api/ipc.ts app/src/renderer/src/features/skills/hooks/useNativeMcpCatalog.ts app/src/main/app/bootstrap.ts` → 18줄 = P1~P15·P14b 16자리(P12 3줄) | 끈 플러그인이 새 실행에 로드, 승인 없이 변경, 주석 손실, 복원 불가 |
| EP-07 · VP-21·24 | 변경 후 새 연결 = 새 서버, Composer 재준비 | Q1 `server.ts:13` 서버 port · Q2 `server.ts:153` retire(풀 `retireAll` 추가) · Q3 `adapters/common/types.ts:79` 근처 `extensionsChanged` · Q4 `composer-catalog-owner.ts:35` · Q5 `:108` · Q6 `:119` · Q7 `composer-catalog.ts:59` · Q8 `bootstrap.ts:1040` · Q9 `shared/composer-catalog.ts:34` · Q10 `composerCatalogState.ts:43` · Q11 신설 캐시 reset · Q12 신설 OpenCode adapter 구현 — **12** | `rg -n "retire\?\|retire: \(\)\|invalidated\(\|invalidated: \(\|interface ComposerCatalogInvalidated\|onComposerCatalogInvalidated\(\|registerComposerCatalog\(ctx\)\|return registerComposerCatalogHandlers\|prepareComposer\?\(" app/src/main/adapters/opencode/v1/server.ts app/src/main/app/composer-catalog-owner.ts app/src/main/app/composer-catalog.ts app/src/shared/composer-catalog.ts app/src/renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts app/src/main/app/bootstrap.ts app/src/main/adapters/common/types.ts` → 10줄 = Q1~Q10 | 새 세션이 옛 서버에 붙어 플러그인 로드, Composer가 옛 에이전트 표시 |

- ΔV1 분모 31(EP-06 19 · EP-07 12). 유효 V 총 76(V1 45 + 31).
- 다중 저장소 쓰기: 파일 + Orca 설정 2곳. 허용 불가 조합은 "파일에서 제거됐는데 기록 없음"(복원 불가) 하나 — off를 기록→파일 순서로 써서 없앤다. 반대 잔여(기록 + 파일 항목)는 조회 reconcile이 정리한다.
- 동시성: 같은 파일 쓰기는 `nativeFileMutations.mutate`의 patch 함수 안에서 최신 원문으로 다시 계산한다(D-013 조건). 기록 갱신은 같은 작업 안에서 파일 commit 결과를 본 뒤 한다.

### 파일

| 파일 | 변경 |
|---|---|
| `app/package.json`·lock | `jsonc-parser` 3.3.1 exact |
| `app/src/main/adapters/opencode/v1/global-plugins.ts`(신규) | 실효 파일 판정·`modify`/`applyEdits` 제거·삽입·기록 병합·reconcile |
| `app/src/main/adapters/opencode/v1/configured-resources.ts` | spec 출처 파일·원값 보존, capability |
| `app/src/main/adapters/opencode/v1/server.ts` | `retireAll()` |
| `app/src/main/adapters/opencode/v1/adapter.ts` · `adapters/common/types.ts` | `extensionsChanged` |
| `app/src/main/app/handlers/extension-catalog.ts` · `bootstrap.ts` · `harnesses/{common/contracts,opencode/module}.ts` | deps·확인·port 배선 |
| `app/src/main/app/{composer-catalog-owner,composer-catalog}.ts` · `shared/composer-catalog.ts` | revalidate |
| `app/src/main/infra/settings-store.ts` · `shared/{ipc,protocol}.ts` | 기록 필드·전용 setter |
| `app/src/preload/index.ts` · `renderer/src/shared/api/ipc.ts` · `features/skills/hooks/useNativeMcpCatalog.ts` | 응답 union·확인 흐름 |
| `renderer/.../opencode/composer/{composerAgentCache,composerCatalogState}.ts` | reset·refresh |
| `renderer/src/shared/i18n/resources/{ko,en}.ts` | 대화상자 문구 |
| `docs/TRD.md §2` · `app/AGENTS.md` 의존성 정책 · `docs/IPC_CONTRACT.md`(`orca:extensions:setEnabled`·`composerCatalogInvalidated`) · `docs/arch/backend/adapters.md §1.3` OpenCode 문단 | 현재 상태 서술 |

### 게이트

- V1 §19 + `./node_modules/.bin/vitest run src/main/adapters/opencode/v1 src/main/app/handlers src/main/app/composer-catalog.test.ts src/main/infra`.
- 의존성 추가 후 `npm ci` 재현성(lock 반영)·`node scripts/check-doc-inventory.mjs --check`(IPC 문서 갱신).

### ΔV1 정합성 검토

- ACTIVE 결정 ↔ AC: §3 갱신 메모에 기록 — 충돌 0. D-008(Claude 새 Query 즉시)과 D-016(OpenCode 새 서버)은 대상 하네스가 달라 충돌 없음.
- V1 문장 중 대체: §5 엣지 "OpenCode 플러그인은 전역·프로젝트 on/off가 없어 … 동기화 대상은 Claude 플러그인이다" · §4 "OpenCode 플러그인은 … 요구 3의 동기화 대상이 Claude뿐" · §6 비범위 "OpenCode 플러그인 on/off" → 사용자 전역 선언분은 ΔV1 범위(D-012). 나머지 출처는 여전히 고정.
- §16 기존 결정: 0278 D32(OpenCode 플러그인 모니터링) → D-012로 일부 대체, 0278 D7(단일 서버) → D-016 교체 중 예외, 0278 D22 → D-014 예외, 0281 D2 → D-001+D-017.
- READY self-review(ΔV1): 결정 7건 원문 인용 · 1차 소스 사실 11행 관측 · AC 8건 행동·수단·경로 · NEW 노드 6개 모두 같은 레벨 REQUIRED pair · CHANGED MD-01 REQUIRED(VP-24) · INHERITED 3개 REGRESSION · §10 31자리 검색 명령 고정 · 적대 증거 VP-18·19·21·23만 선택 · 신규 의존성 사용자 조건부 승인(D-013).

---

# ΔV2 — 외부에서 제거한 플러그인 비노출 (2026-10-23)

판정: READY. 사용자 원문 "외부 cli에서 플러그인을 실제로 제거하면 orinus orca에서도 노출이 되면 안된다."를 D-019~D-021로 반영한다. V1·ΔV1 노드는 아래 표의 CHANGED·REGRESSION만 영향받는다.

## ΔV2-1. 사실

| 사실 | 근거 |
|---|---|
| Claude 실행 경로는 설치 폴더가 없는 플러그인을 건너뛴다 | `plugin-catalog.ts:156` `!exists(entry.path)` |
| Claude nav·초안 리소스 경로는 설치 폴더 존재를 확인하지 않는다 → 폴더만 지운 플러그인이 nav에 남음 | `configured-resources.ts:146-154` |
| Claude 설치 목록·설정은 조회·spawn마다 새로 읽는다 → 목록에서 빠진 플러그인은 이미 비노출 | `configured-resources.ts:89-96` · `plugin-catalog.ts:135-150` |
| OpenCode 1.18.27 CLI에는 설치+설정 추가(`opencode plugin <module>`)만 있고 제거 명령이 없다 → 외부 제거 = 설정 항목 삭제 또는 설치본(패키지·파일) 삭제 | `cli/cmd/plug.ts:179-198` |
| OpenCode 실행 중 서버는 전역 설정을 캐시하므로 외부 삭제가 새 세션·Composer에 자동 반영되지 않는다 | ΔV1-1 표 `Duration.infinity` |
| 설정 파일 감시 선례: `watchFile` 250ms 폴링, `persistent: false` | `project-resource-sync.ts:142-146` |

## ΔV2-2. 결정

§3 Decision Ledger D-019(사용자 원문)·D-020·D-021(추론 — D-016·D-017·D-012 파생)에 기록했다.

## ΔV2-3. Product 변경

| 외부 변경 | Orca 결과 |
|---|---|
| Claude: 설치 목록에서 제거(uninstall) | 기존대로 nav·초안 명령·새 Query 비노출(회귀 확인) |
| Claude: 설치 폴더만 삭제 | nav 행·초안/미실행 리소스에서 사라짐(실행 경로와 같은 규칙) |
| OpenCode: 켜진 플러그인을 전역 설정에서 삭제 | nav는 다음 조회에서 사라지고 Orca 기록 없음. 감시가 변경을 잡으면 새 연결은 새 서버, 열린 Composer는 재준비(에이전트·스킬에서 사라짐) |
| OpenCode: Orca가 끈 플러그인의 설치본 삭제 | nav off 행이 사라지고 기록 정리 |
| OpenCode: Orca가 끈 플러그인을 외부에서 다시 추가 | 감시 주기 안에 on으로 보고 기록 정리 → 이후 외부 삭제 시 off 행이 되살아나지 않음 |
| 실행 중 세션 | 변경 없음 — 그 프로세스에는 실제로 로드돼 있으므로 그 세션의 Composer·패널은 실제 상태 표시(D-006) |

## ΔV2-4. Acceptance — AC27~AC30

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-07 | AT-09 / AC27 | Claude: 설치 목록에 없거나 설치 폴더가 없는 플러그인은 nav 행·초안/미실행 리소스·초안 명령·새 Query에 나타나지 않는다 | 임시 루트에서 폴더 삭제·목록 삭제 각각 → catalog·configured·commands·SDK options | nav/draft reader · `sendMessage` |
| R-07 | AT-09 / AC28 | OpenCode: 켜진 플러그인을 외부에서 전역 설정에서 지우면 nav에서 사라지고 기록이 생기지 않는다. 감시가 변경을 잡으면 새 연결은 새 서버로 가고 열린 Composer는 캐시를 비우고 1회 재준비. 실행 중 세션의 서버는 유지 | 파일 외부 편집 → 감시 콜백 → `retireAll`·revalidate 호출, 기존 owner 연결 유지 | watcher → 공용 변경 fan-out |
| R-07 | AT-09 / AC29 | OpenCode: Orca가 끈 플러그인의 설치본이 없으면 off 행을 내지 않고 기록을 지운다. 설치본을 확인할 수 없는 플러그인은 off 토글 불가(고정) | 설치본 삭제 후 catalog · 해석 불가 spec의 canToggle | catalog read → 기록 병합 |
| R-07 | AT-09 / AC30 | OpenCode: Orca가 끈 플러그인이 외부에서 다시 추가되면 감시 주기 안에 기록이 정리되고, 이어서 외부에서 삭제해도 off 행이 나오지 않는다. Orca 자신의 토글 쓰기는 감시로 중복 fan-out하지 않는다 | 재추가 → 감시 → 기록 0 → 삭제 → catalog 행 0 · Orca 토글 1회에 fan-out 1회 | watcher · toggle 공용 fan-out |

- AC 총 30건. ΔV1과 같은 이유로 분할하지 않는다(같은 기록·fan-out·capability를 공유).

## ΔV2-5. V

- 기준 V = `0282:V1@789a727 + ΔV1@7227dc0`(`git cat-file -t 7227dc0` → commit). 변경이 시작되는 수준: R.

| Node | 레벨 | 계약 | provenance | 기준선 / 대체 |
|---|---|---|---|---|
| R-07 / AT-09 | R / AT | AC27~AC30 | NEW | — |
| SD-04 / ST-04 | SD / ST | 외부 변경 → 감시 → reconcile → 서버 교체 → Composer 재준비 | NEW | — |
| AR-06 / IT-06 | AR / IT | bootstrap 감시 배선 → 공용 fan-out(ΔV1 toggle과 동일 함수) | NEW | — |
| MD-07 / UT-07 | MD / UT | 전역 플러그인 fingerprint · 기록 노출 규칙(설치본 존재·설정 부재) | NEW | — |
| MD-08 / UT-08 | MD / UT | Claude 설치 폴더 존재 규칙 SSOT(실행·nav 공용) | NEW | — |
| MD-06 / UT-06 | MD / UT | capability에 설치본 확인 조건 추가(D-021) | CHANGED | ΔV1 MD-06 |
| R-06 / AT-07 | R / AT | Orca 토글 경로 | INHERITED | ΔV1 |
| R-03 / AT-03 | R / AT | Claude off·초안 리소스 | INHERITED | V1 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-28 | R-07 ↔ AT-09 | REQUIRED | 외부 편집·삭제 → (Claude) reader / (OpenCode) watcher·catalog read → nav·Composer·새 실행 | `bootstrap.native-history.test.ts` 신규 `'hides externally removed Claude and OpenCode plugins from catalog, drafts and new runs'`(실제 handler·reader, 임시 루트) | required — "노출 없음"은 0건 주장. 짝 양성: 남은 플러그인은 노출. 변이: 존재 검사 제거(E2), 기록 노출 규칙의 설치본 조건 제거(X5) | EP-08 (4) · EP-09 X5 (1) |
| VP-29 | SD-04 ↔ ST-04 | REQUIRED | 파일 변경 → 감시 → fingerprint 비교 → reconcile·fan-out → retire·revalidate | 신규 `opencode-global-watch.test.ts`: `'fans out once per external plugin change and ignores Orca's own write'` · `'clears a record when the plugin is re-added externally'` | required — 중복·누락 방향 둘 다. 변이: fingerprint 비교 제거(중복), 감시 콜백 미연결(누락) | EP-09 X1·X2·X4 (3) |
| VP-30 | AR-06 ↔ IT-06 | REQUIRED | bootstrap 시작 → 감시 등록 → 공용 fan-out(extension catalog deps·composer revalidate) → shutdown 해제 | `bootstrap.native-history.test.ts` 신규 `'starts the OpenCode global watch with the shared change fan-out and stops it on shutdown'` | not selected | EP-09 X3·X6·X7 (3) |
| VP-31 | MD-07 ↔ UT-07 | REQUIRED | `openCodeGlobalPluginFingerprint` · 기록 노출 판정 | `global-plugins.test.ts` 신규 `'derives the fingerprint only from the effective plugin array'` · `'shows a record only while its installation exists and its spec is absent'` | required — 형제 조건(설치본 존재·설정 부재) 맞바꿈 | EP-09 X2·X5 (2) |
| VP-32 | MD-08 ↔ UT-08 | REQUIRED | `claudeInstallationExists` → 실행·nav 공용 | `configured-resources.test.ts` 신규 `'omits installations whose directory no longer exists'` · `plugin-catalog.test.ts` 기존 `'selects active installations by scope and precedence and refreshes every read'` | not selected | EP-08 (4) |
| VP-23′ | MD-06 ↔ UT-06 | REQUIRED (CHANGED) | capability + 설치본 확인 | ΔV1 VP-23 좌표 + `configured-resources.test.ts` 신규 `'keeps unresolvable OpenCode plugins fixed'` | ΔV1 변이 승계 | EP-06 P4·P5 (ΔV1 분모 안) |
| VP-33 | R-06 ↔ AT-07 | REGRESSION | Orca 토글 경로가 공용 fan-out으로 바뀌어도 동작 동일 | ΔV1 VP-18·VP-21 좌표 | not selected | 0 |
| VP-34 | R-03 ↔ AT-03 | REGRESSION | Claude 초안 리소스 reader 변경 | V1 VP-11 좌표 | not selected | 0 |

## ΔV2-6. Technical Design

| 축 | AS-IS(ΔV1 설계) | TO-BE |
|---|---|---|
| Claude nav·리소스 | 설치 목록 항목 전부 | 설치 폴더가 존재하는 항목만 — 실행 경로와 같은 helper |
| OpenCode 외부 변경 감지 | 없음(Orca 토글만 fan-out) | `watchFile`로 전역 설정 3파일 감시 → 실효 `plugin` 배열 fingerprint가 바뀌면 공용 fan-out |
| 공용 fan-out | Orca 토글 → `extensionsChanged`+revalidate | `notifyOpenCodePluginsChanged()` 하나를 토글·감시가 함께 사용. 마지막 fingerprint를 갱신해 자기 쓰기 중복 차단 |
| 기록 노출 | 기록이면 off 행 | 설치본 존재 && 설정 부재일 때만 off 행. 설정에 있으면 on·기록 삭제, 설치본 없으면 행 없음·기록 삭제 |
| capability | 실효 파일 항목·기록 | + 설치본 확인 가능할 때만(D-021) |

- 감시 위치: `app/src/main/app/opencode-global-watch.ts`(조립 루트 소유 — 파일 경로는 `adapters/opencode`의 순수 함수가 계산). 주기 1000ms, `persistent: false`. bootstrap 시작 시 등록, shutdown(`bootstrap.ts:883` 부근)에서 해제.
- 다중 저장소: 외부 변경 reconcile은 기록만 지운다(파일 미변경) — 쓰기 1곳.

### §10 강제 지점 — ΔV2

| V / pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| EP-08 · VP-28·32 | Claude 노출 = 설치 목록 && 설치 폴더 존재 | E1 `configured-resources.ts:142` · E2 `:146` 루프(부재 건너뜀) · E3 `:153-154` 디렉터리 등록 · E4 `plugin-catalog.ts:156` 실행 경로(공용 helper로 교체) — **4** | `rg -n "installedClaudePlugins\(\|for \(const entry of globalOnly\|directories\.set\(id, installPath\)\|if \(directories\.has\(id\)\) continue\|exists\(entry\.path\)" app/src/main/adapters/claude/configured-resources.ts app/src/main/adapters/claude/plugin-catalog.ts` → 6줄. 제외 2줄: `plugin-catalog.ts:24` 정의 · `:68` 선택 루프(이후 :156이 거름) | 지운 플러그인이 nav에 남음 |
| EP-09 · VP-28~31 | OpenCode 외부 변경 → 비노출·새 서버·재준비 | X1 신설 감시 모듈 · X2 신설 fingerprint · X3 `bootstrap.ts:883` shutdown 해제 · X4 신설 공용 fan-out(토글·감시 공유) · X5 기록 노출 규칙(ΔV1 P17 모듈) · X6 `bootstrap.ts:1040` composer revalidate 연결 · X7 `bootstrap.ts:1201` extension catalog deps — **7** | `rg -n "this\.closeComposerCatalog\|registerExtensionCatalogHandlers\(" app/src/main/app/bootstrap.ts` → 3줄(X3·X6·X7) + 신설 4 | 외부 삭제 후에도 Composer·새 세션·nav에 노출, 또는 자기 쓰기 중복 서버 교체 |

- ΔV2 분모 11(EP-08 4 · EP-09 7). 유효 V 총 87(V1 45 + ΔV1 31 + ΔV2 11). capability 변경은 ΔV1 EP-06 P4·P5 자리 안이라 새 자리로 세지 않는다.

### 파일·문서

- `app/src/main/adapters/claude/{configured-resources,plugin-catalog}.ts`(공용 helper) · `app/src/main/adapters/opencode/v1/global-plugins.ts`(fingerprint·노출 규칙) · `app/src/main/app/opencode-global-watch.ts`(신규) · `app/src/main/app/bootstrap.ts`.
- `docs/arch/backend/adapters.md §1.3`: 외부 변경 감시와 설치본 존재 규칙 서술.

### ΔV2 정합성 검토

- ACTIVE 결정 ↔ AC: D-019↔AC27~AC30, D-020↔AC28·AC30, D-021↔AC29 — 충돌 0. D-015(확인 대화상자)는 Orca 토글에만 적용되고 AC28은 대화상자를 요구하지 않음 — 모순 없음.
- ΔV1 문장 중 보강: AC19 "Orca 기록 항목만 true" → D-021로 설치본 확인 조건 추가(VP-23′). AC22 reconcile은 감시(AC30)로 즉시성이 보강될 뿐 계약 불변.
- READY self-review(ΔV2): 원문 인용 1·추론 결정 2건 표시 · 사실 6행 관측 · AC 4건 행동·수단·경로 · NEW 노드 5개 REQUIRED pair · CHANGED MD-06 REQUIRED(VP-23′) · INHERITED 2개 REGRESSION · §10 11자리 검색 명령 고정 · 적대 증거 VP-28·29·31만 선택.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1+ΔV1+ΔV2의 결정·적용 시점 유지. 아래 AC 표에서 기계 28건과 실기 2건을 구분한다.
- 이견 / 현실성 문제: 정적 `MainHarnessModule`에 설정 저장소를 전역 주입하지 않고 `globalResourceControl(records)` 팩토리로 조립했다. 실제 배선 좌표는 `bootstrap.native-history.test.ts:routes OpenCode plugin toggles through the file control and the settings record`다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. `SettingsPatch`에서 제외하는 것만으로는 조회 응답의 복원 옵션·경로를 숨기지 못해 settings 응답 두 곳도 정정했다(`settings.private.test.ts:keeps plugin restoration options and paths out of both settings responses`).

## [구현자 기입] 강제 지점 전수 (§10 대조)

좌표의 파일은 `app/src/` 아래다. 같은 파일의 테스트 이름을 아래 별칭으로 인용한다.

| 별칭 | 직접 oracle 좌표 |
|---|---|
| T-state | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts`의 `publishes the first agent success to concurrent scopes and ignores later results` · `leaves the agent cache empty after failed or cancelled reads` · `keeps cached agents through instance invalidation while models become error` · `resets agents once per revision and refreshes subscribed parts while keeping models` · `keeps the first cached agents when a concurrent read ends as %s` |
| T-module | 같은 디렉터리 `Module.integration.test.ts:reuses the first successful agent list across landing scopes without requesting or spinning` · `shows cached agents before the chat scope exists` |
| T-cache | 같은 디렉터리 `composerAgentCache.test.ts:keeps the first accepted list and notifies each subscriber once` · `resets once for a newer revision and ignores stale revisions` |
| T-query | `main/adapters/claude/adapter.native-plugins.test.ts:applies current global plugin choices to every new query while live queries keep theirs` · `pins deployed MCP files for same-cwd peers and reloads until the final owner closes` |
| T-bootstrap | `main/app/bootstrap.native-history.test.ts:carries catalog changes through the real bootstrap registry into every new SDK query` · `applies nav plugin choices to draft and stored-session commands and resources` · `routes OpenCode plugin toggles through the file control and the settings record` |
| T-priority | `main/adapters/claude/configured-resources.test.ts:applies Orca plugin choices above user defaults and below project selections` · `main/adapters/common/extension-control.test.ts:maps only one kind of choice to harness keys` |
| T-view | `renderer/src/features/skills/components/customize/ExtensionsCatalogView.interaction.test.ts`의 `moves native plugins to the plugin tab after provider groups` · `hides native plugin skills from the skills tab` · `scopes native loading and failure to plugin and MCP tabs` · `asks before changing an OpenCode plugin while sessions run and applies only after confirmation` |
| T-list | 같은 디렉터리 `CustomizeList.render.test.ts:orders Claude then OpenCode plugin groups after providers and keeps plugin toggle capability` · `renders switches only for Orca skills` · `SkillDetail.render.test.ts:renders no switch for default-path skills` |
| T-skill | `main/app/skill-catalog.test.ts:assembles the real catalog from lock, harness and native plugin files without exposing other installations` · `main/features/extensions/common/skills/scan.test.ts:여러 source root 를 소스 메타와 enabled 상태로 스캔한다` |
| T-global | `main/adapters/opencode/v1/global-plugins.test.ts`의 `records before removing and restores the original entry at its index` · `rolls back the record when the file write fails` · `reports a recorded plugin that is still declared as enabled and clears the record` · `applies concurrent toggles and an external edit without failure` · `marks only plugins declared by the effective global file as toggleable` |
| T-watch | `main/app/opencode-global-watch.test.ts:fans out once per external plugin change and ignores Orca's own write` · `clears a record when the plugin is re-added externally` · `drains admitted plugin writes before closing and rejects later writes` |
| T-server | `main/adapters/opencode/v1/server.test.ts:starts a new server for new owners after retireAll while existing owners keep theirs`(실제 adapter의 `extensionsChanged` 진입) · `main/app/handlers/composer-catalog.test.ts:revalidates every OpenCode owner with the plugin revision` |
| T-handler | `main/app/handlers/extension-catalog.test.ts:requires confirmation for OpenCode plugin changes only while OpenCode sessions run` · `does not reactivate legacy choice bytes or accept writes through settings.patch` |
| T-wire | `preload/index.test.ts:carries explicit global extension scope and choices across renderer API and preload` — confirmed=true·confirm/applied 응답을 실제 양쪽 wrapper로 관측 |
| T-record | `main/infra/settings-store.test.ts:persists plugin restoration records through the main-only setter and preserves unrelated settings` · `shared/openCodePluginRecord.testfixture.ts` 음성 타입 단언(M24로 민감도 확인) |

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01~04 | agents 캐시 | EP-01 A1~A10 | 10/10 | A1·A2=T-module/T-state; A3=T-state invalidation; A4=동시 scope의 retry; A5·A7=첫 성공/지연 성공; A6·A8=캐시 없음 실패·취소 및 first 성공 뒤 concurrent error/cancelled/reject; A9=T-module 무-scope; A10=T-cache/T-state | 경로 A/B, team/other, first/late, 빈 성공과 취소를 구분 | 없음 |
| VP-09~12 | Claude 유효 선택 | EP-02 C1~C15 | 15/15 | C1~C3=T-query; C4·C5=T-priority/T-bootstrap; C6~C13=T-bootstrap의 초안·저장 세션 양 경로; C14=T-handler; C15=extension-control 단위 | user true / Orca false / project true / local false; MCP 동명 키 제외 | 실기 AC18 별도 |
| VP-07·08 | 탭 귀속 | EP-03a R1~R7 | 7/7 | R1~R4=T-list/T-view의 순서·native-only 행; R5~R7=T-view loading/failure — 스킬 목록 유지, 실패 탭 status 1개 | gate→llm→service→Claude→OpenCode, plugin/MCP 구분 | 없음 |
| VP-07·08·14 | 스킬 GUI | EP-03b K1~K5 | 5/5 | K1=T-view; K2·K3=T-list 목록; K4·K5=SkillDetail.render | plugin 2출처 비노출, 기본 3출처 일반 글씨·switch 없음, Orca switch 존재 | 없음 |
| VP-14·15 | 스킬 capability | EP-04 S1·S2·U1~U4 | 6/6 | S1·S2=T-skill; U1=T-query 기본 스킬 allow-list; U2=handlers/skills.test.ts:keeps native toggles read-only after accepting namespaced targets; U3=attachMenuModel.test.ts:keeps previously disabled harness skills selectable; U4=composerSkills.test.ts:offers active default-path skills regardless of their former stored choice | 저장 false인 Claude/OpenCode/agents가 enabled true·canToggle false; Orca false는 유지 | 없음 |
| VP-16·17 | MCP 상위 폴더 | EP-05 J1·J2 | 2/2 | J1=infra/config/json-file.test.ts:creates missing parents, replaces existing files and leaves no temp file; J2=extensions/common/mcp/store.fresh-root.test.ts:adds a server when the sources mcp directory does not exist | 중첩 부재 경로, 교체 값, list의 docs 행, tmp 잔여 없음 | 없음 |
| VP-18~20·22·23′ | 파일·복원 기록 | EP-06 P1~P18·P14b | 19/19 | P1~P5=T-global; P6·P7=T-handler/T-bootstrap; P8·P9=T-bootstrap; P10~P12=T-handler/T-wire; P13=T-view; P14·P14b·P15·P16=T-record/T-handler; P17=T-global; P18=T-bootstrap | 주석·튜플 옵션 distinct·index·file, sessions 0/1/2, confirmed 유무; renderer patch 차단 | 실기 AC26 별도 |
| VP-21·24 | 서버·재준비 | EP-07 Q1~Q12 | 12/12 | Q1~Q3·Q12=T-server adapter→pool; Q4~Q7=T-server owners→event; Q8=T-bootstrap의 revision [1,2,3]; Q9=preload/index.test.ts의 session.onComposerCatalogInvalidated 전달 및 owners handler; Q10=T-state; Q11=T-cache | 기존 owner 인증 유지, 새 process 시작, revision 중복 무시, agents 초기화·모델 값 유지 | 없음 |
| VP-28·32 | Claude 설치 존재 | EP-08 E1~E4 | 4/4 | E1~E3=configured-resources.test.ts:omits installations whose directory no longer exists; E4=plugin-catalog.test.ts:selects active installations by scope and precedence and refreshes every read 및 T-bootstrap 삭제 후 새 Query | removed 폴더 삭제·kept 양성 유지, nav/draft/stored/SDK 목록 확인 | 없음 |
| VP-28~31 | 외부 변경 | EP-09 X1~X7 | 7/7 | X1·X2=T-watch; X3=T-bootstrap shutdown; X4·X6·X7=T-bootstrap [1,2,3] fan-out; X5=global-plugins.test.ts:shows a record only while its installation exists and its spec is absent | 외부 재추가→기록 0→삭제→행 0; 자기 토글 후 check 중복 0 | 없음 |

- §10 검색 원출력(EP 순서)은 33·15·17·14·7·2·18·12·6·4줄이었다(정의·중복 참조·형제 포함). 계획 자리 ID와 아래 oracle 매핑의 집합 차이는 양방향 `[]`(87=87)로 재확인했다. 계획의 기존 술어와 새 `extensionChoices`, `globalResourceControl`, `revalidate`, `openCodeDisabledPlugins`, `claudeInstallationExists`, `OpenCodeGlobalWatch` 운반 자리를 함께 확인했다.

- 고정 분모는 EP별 10+15+7+5+6+2+19+12+4+7=87이다.
- §10 자리 목록 밖에서 본 운반 자리: settings 응답 get/set의 복원 기록 비노출 2곳, 종료 시 새 큐 drain 연결 1곳. 버전 중립 opencode facade의 control/files/fingerprint 전달은 T-bootstrap의 실제 파일 감시→revision [1,2,3]로 함께 확인했다. 각각 `settings.private.test.ts`와 `opencode-global-watch.test.ts:drains admitted plugin writes before closing and rejects later writes`로 보강했다.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | T-module·T-state | M01·M02 |
| VP-02 | REQUIRED | SELF_PASS | T-state | M03 |
| VP-03 | REQUIRED | SELF_PASS | T-module·T-state | not selected |
| VP-04 | REQUIRED | SELF_PASS | T-cache | not selected |
| VP-05 | REGRESSION | SELF_PASS | T-state 기존 models/resource/generation·T-module loading | not selected |
| VP-06 | REGRESSION | SELF_PASS | opencode/v1/adapter.persistent.test.ts:passes a live plugin agent and drops its removed variant on the next prompt | not selected |
| VP-07 | REQUIRED | SELF_PASS | T-view | not selected |
| VP-08 | REQUIRED | SELF_PASS | T-list | M04·M05 |
| VP-09 | REQUIRED | SELF_BLOCKED — 실기 AC18 | T-bootstrap·AC18 실기 미실행 | M06~M08 |
| VP-10 | REQUIRED | SELF_PASS | T-query | not selected |
| VP-11 | REQUIRED | SELF_PASS | T-bootstrap 초안/저장 세션 | not selected |
| VP-12 | REQUIRED | SELF_PASS | T-priority·T-bootstrap | M09·M10 |
| VP-13 | REGRESSION | SELF_PASS | native-resource-sharing.test.ts·Composer.native-menu.test.ts | not selected |
| VP-14 | REQUIRED | SELF_PASS | T-skill·T-list·T-query·U1~U4 좌표 | not selected |
| VP-15 | REQUIRED | SELF_PASS | T-skill scan | not selected |
| VP-16 | REQUIRED | SELF_PASS | store.fresh-root.test.ts:adds a server when the sources mcp directory does not exist | not selected |
| VP-17 | REQUIRED | SELF_PASS | json-file.test.ts:creates missing parents, replaces existing files and leaves no temp file | not selected |
| VP-18 | REQUIRED | SELF_BLOCKED — 실기 AC26 | T-view·T-handler·AC26 실기 미실행 | M11·M12 |
| VP-19 | REQUIRED | SELF_PASS | T-global | M13~M15 |
| VP-20 | REQUIRED | SELF_PASS | T-bootstrap·T-record·T-wire | M24(새 음성 타입 oracle) |
| VP-21 | REQUIRED | SELF_PASS | T-server·T-bootstrap·T-state | M16·M17 |
| VP-22 | REQUIRED | SELF_PASS | global-plugins.test.ts:removes and reinserts string and tuple entries while preserving comments | not selected |
| VP-23′ | REQUIRED | SELF_PASS | T-global effective-file·unresolvable 사례 | M18 |
| VP-24 | REQUIRED | SELF_PASS | T-cache | not selected |
| VP-25 | REGRESSION | SELF_PASS | T-list OpenCode true/false capability | not selected |
| VP-26 | REGRESSION | SELF_PASS | T-module 1회 IPC·스피너 없음 | not selected |
| VP-27 | REGRESSION | SELF_PASS | T-state models 유지·기존 resource 테스트 | not selected |
| VP-28 | REQUIRED | SELF_PASS | T-bootstrap 외부 재추가/삭제·Claude 삭제, T-global 설치본 삭제 | M19·M20 |
| VP-29 | REQUIRED | SELF_PASS | T-watch·T-bootstrap | M21·M22 |
| VP-30 | REQUIRED | SELF_PASS | T-bootstrap 등록·[1,2,3] fan-out·shutdown | not selected |
| VP-31 | REQUIRED | SELF_PASS | global-plugins.test.ts:fingerprint·shows a record only while its installation exists and its spec is absent | M23 |
| VP-32 | REQUIRED | SELF_PASS | configured-resources.test.ts:omits installations whose directory no longer exists·plugin-catalog.test.ts | not selected |
| VP-33 | REGRESSION | SELF_PASS | T-view·T-handler·T-server | not selected |
| VP-34 | REGRESSION | SELF_PASS | T-bootstrap 초안/저장 세션 선택 | not selected |

- 유효 pair 34행: SELF_PASS 32 · SELF_BLOCKED 2(Windows 실기). VP-23은 ΔV2의 VP-23′로 대체했다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M01 VP-01 A2 | 선택 적대 증거 | 최초 | `publishes agents before models and shares subscribers and remounts` / 9건 | 잡음 · 원본 복구 확인 |
| M02 VP-01 A1 | 선택 적대 증거 | 최초 | `publishes the first agent success to concurrent scopes and ignores later results` / 1건 | 잡음 · 원본 복구 확인 |
| M03 VP-02 A3 | 선택 적대 증거 | 최초 | `keeps the new generation when an older part resolves in the same epoch` / 2건 | 잡음 · 원본 복구 확인 |
| M04 VP-08 R3/R4 | 선택 적대 증거 | 최초 | `orders Claude then OpenCode plugin groups after providers and keeps plugin toggle capability` / 1건 | 잡음 · 원본 복구 확인 |
| M05 VP-08 R1 | 선택 적대 증거 | 최초 | `plugin catalog list hides native plugin skills and labels both native MCP groups with brand marks` / 2건 | 잡음 · 원본 복구 확인 |
| M06 VP-09 C1 | 선택 적대 증거 | 최초 | `carries catalog changes through the real bootstrap registry into every new SDK query` / 2건 | 잡음 · 원본 복구 확인 |
| M07 VP-09 C12 | 선택 적대 증거 | 최초 | `applies nav plugin choices to draft and stored-session commands and resources` / 1건 | 잡음 · 원본 복구 확인 |
| M08 VP-09 C5 | 선택 적대 증거 | 최초 | `applies nav plugin choices to draft and stored-session commands and resources` / 2건 | 잡음 · 원본 복구 확인 |
| M09 VP-12 C4 | 선택 적대 증거 | 최초 | `carries catalog changes through the real bootstrap registry into every new SDK query` / 2건 | 잡음 · 원본 복구 확인 |
| M10 VP-12 C5 | 선택 적대 증거 | 최초 | `applies nav plugin choices to draft and stored-session commands and resources` / 2건 | 잡음 · 원본 복구 확인 |
| M11 VP-18 P7 confirmation | 선택 적대 증거 | 최초 | `requires confirmation for OpenCode plugin changes only while OpenCode sessions run` / 1건 | 잡음 · 원본 복구 확인 |
| M12 VP-18 P7 backend | 선택 적대 증거 | 최초 | `reads native defaults without copying them and keeps supported explicit choices only in memory` / 2건 | 잡음 · 원본 복구 확인 |
| M13 VP-19 P17 off order | 선택 적대 증거 | 최초 | `records before removing and restores the original entry at its index` / 2건 | 잡음 · 원본 복구 확인 |
| M14 VP-19 P17 on order | 선택 적대 증거 | 최초 | `records before removing and restores the original entry at its index` / 1건 | 잡음 · 원본 복구 확인 |
| M15 VP-19 P17 rollback | 선택 적대 증거 | 최초 | `rolls back the record when the file write fails` / 1건 | 잡음 · 원본 복구 확인 |
| M16 VP-21 Q10 models | 선택 적대 증거 | 최초 | `resets agents once per revision and refreshes subscribed parts while keeping models` / 1건 | 잡음 · 원본 복구 확인 |
| M17 VP-21 Q11 revision | 선택 적대 증거 | 최초 | `resets once for a newer revision and ignores stale revisions` / 2건 | 잡음 · 원본 복구 확인 |
| M18 VP-23 P1 priority | 선택 적대 증거 | 최초 | `derives the fingerprint only from the effective plugin array` / 2건 | 잡음 · 원본 복구 확인 |
| M19 VP-28 E2 | 선택 적대 증거 | 최초 | `applies nav plugin choices to draft and stored-session commands and resources` / 2건 | 잡음 · 원본 복구 확인 |
| M20 VP-28 X5 | 선택 적대 증거 | 최초 | `shows a record only while its installation exists and its spec is absent` / 1건 | 잡음 · 원본 복구 확인 |
| M21 VP-29 X2 fingerprint | 선택 적대 증거 | 최초 | `fans out once per external plugin change and ignores Orca's own write` / 2건 | 잡음 · 원본 복구 확인 |
| M22 VP-29 X1 callback | 선택 적대 증거 | 최초 | `fans out once per external plugin change and ignores Orca's own write` / 1건 | 잡음 · 원본 복구 확인 |
| M23 VP-31 X5 conditions | 선택 적대 증거 | 최초 | `records before removing and restores the original entry at its index` / 2건 | 잡음 · 원본 복구 확인 |
| M24 SettingsPatch의 main-only 키 제외 제거 | 새 음성 타입 oracle | 최초 | `openCodePluginRecord.testfixture.ts:5` TS2578 1건 | 잡음 · 원본 복구 확인 |

- **분모 검산**: 선택 증거 23 · 인용 변이 0 · 새 oracle 1 = 표 행 24. 각 JSON 결과의 failed assertion 이름을 위에 옮겼으며 단순 collection 실패를 잡음으로 세지 않았다.
- **덮개 회귀**: 해당 없음 — 첫 구현 라운드. 기존 models·MCP·plugins·세션 프로젝트 토글의 행동 단언은 관련 gate에 유지했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 확인 — T-view에서 실제 확인 제목·취소 후 요청 수·confirmed=true·행 off를 관측 | AC26 실제 창 실기 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 확인 — Query release와 배포 사본 유지 T-query 회귀, watcher drain의 접수 쓰기 1회·후속 거절 | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 확인 — 파일 실패의 기록 원복·설정 실패 토스트 경로, 첫 agents 실패/취소의 빈 캐시 | T-global·T-state |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 확인 — 기존 saveFailed 보고 유지, 확인 대기에는 행이 변하지 않음 | T-view·useNativeMcpCatalog.test.ts |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 확인 — first/late 캐시, scope epoch, backend version, 승인 요청의 새 version | T-state·useNativeMcpCatalog.test.ts |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| I1 | main 전용 setter만으로 settings:get/set 응답의 복원 옵션·경로는 숨겨지지 않음 | 선조치: 두 응답에 빈 복원 배열 반환 | settings.private.test.ts 두 채널 결과에서 private 문자열 0 |
| I2 | 새 watch 큐에 대기하는 저장은 기존 파일 큐 drain 전에 아직 등록되지 않을 수 있음 | 선조치: watch admission 닫기→접수 작업 drain→기존 nativeFileMutations.close 순서 | watcher drain 테스트 접수 쓰기 1회, 이후 요청 거절 |
| I3 | app 테스트 명령만으로 preload·skill-catalog oracle이 실행되지 않음 | 선조치: gate 집합에 `src/preload/index.test.ts`·`src/main/app/skill-catalog.test.ts`·`composerSkills.test.ts` 추가 | 최종 gate 로그의 해당 스위트 포함 |
| I5 | 관련 집합의 DB 테스트는 재설치 후 앱용 Electron ABI와 plain Node ABI가 다름 | 환경 분리: 8파일·106건 모두 NODE_MODULE_VERSION 140/127, 다른 실패 0 | 동일 실행의 비DB 1604건과 후속 신규 3건 포함 최종 1607건 통과 |
| I4 | 문서 전체 검사에 기존 ignored OpenCode 소스의 깨진 링크가 섞임 | 환경 기준선 분리: `.tmp`·`app/.temp`의 10링크, tracked 파일 0 | 해당 폴더만 제외한 동일 checkLinks 결과 `[]`; 현재 문서 prose 검사 통과 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: control을 설정 port를 받는 팩토리로 만들고 버전 중립 `adapters/opencode` 진입점에 노출했다. 새 전역 mutable 설정 참조를 만들지 않고 bootstrap 한 인스턴스를 nav·toggle·watch가 공유한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 팩토리 인스턴스는 bootstrap 수명이며 TTL 없음 | AC19~22·P18, T-bootstrap 파일·기록 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 잘못 두 번 조립하면 record 큐가 갈라질 수 있음 | P8·P9·P18·X4, 동일 control을 nav와 watch에 전달; T-bootstrap 자기 쓰기 1회 |
| 재진입 | 초기 fingerprint 대기 중 접수한 toggle·감시가 경합할 수 있음 | AC21·AC30·X1·X4, T-watch 직렬 큐·자기 쓰기 중복 없음 |
| 다른 무효화 축 | 종료가 watch 큐를 건너뛰면 접수 저장 소실 | I2, watcher drain 테스트 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | app의 Claude/OpenCode adapters·bootstrap/handlers·schema/settings·preload·Composer cache·확장 카탈로그와 대응 테스트. 현재 상태 문서·의존성 정책·생성 inventory 동기화 |
| 실행 명령 | 계획 §19 + ΔV1 관련 집합의 비DB 스위트, `--maxWorkers=2`(ABI 실패 8파일 분리); preload·skill-catalog·composerSkills·watch 추가. lint·typecheck·문서 검사·npm ci·결함 변이 별도 |
| **관측한 게이트 산출**(exit code 아님) | lint 0 error·기존 warning 2; typecheck 3종 통과; 비DB 171파일·1607/1607. 확장 실행의 DB 8파일·106건은 Electron ABI 140/Node 127 차이로 분리. 결함 변이 24/24 검출. npm ci --ignore-scripts 972개 설치 후 electron rebuild·postinstall 성공. generated/prose 통과; ignored 임시 소스 링크 10건은 기준선 분리, 그 두 폴더만 제외한 checkLinks 결과 [] |
| V-pair 자기확인 | SELF_PASS 32 · SELF_BLOCKED 2(실기 AC18·26) |
| 강제 지점 전수 | 87/87 — EP-01 10 · EP-02 15 · EP-03a 7 · EP-03b 5 · EP-04 6 · EP-05 2 · EP-06 19 · EP-07 12 · EP-08 4 · EP-09 7 |
| **AC 자기보고**(`Criteria-Met`) | 28/30 — 아래 행별 관측; 실기 2건 대기 |
| **합계 검산** | ✅ 28 · ⚠️ 2 · ❌ 0 = 총 30 |
| 블로커 / 역질문 | 자동화 블로커 없음. U-001 전역 선택 영속화는 결정대로 범위 밖 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | T-module: agents IPC 1회·다른 scope 목록·스피너 0 |
| AC2 | ✅ | T-state: 동시 first/late·실패·취소·빈 성공 |
| AC3 | ✅ | T-state: invalidation agents ready/models error |
| AC4 | ✅ | adapter.persistent: 제거된 agent prompt 제외 |
| AC5 | ✅ | T-view: 기본 출처 행 유지·plugin 출처 0 |
| AC6 | ✅ | T-list: provider→Claude→OpenCode 순서·true/false capability |
| AC7 | ✅ | T-view: 스킬 목록 유지·실패 탭 banner만 1개 |
| AC8 | ✅ | T-bootstrap/T-query: 같은 cwd 새 Query는 현재 flag |
| AC9 | ✅ | T-bootstrap: off/on 초안·저장 세션 명령 |
| AC10 | ✅ | T-bootstrap: off/on 초안·저장 세션 resource enabled |
| AC11 | ✅ | T-bootstrap/T-priority: project true가 Orca false보다 우선 |
| AC12 | ✅ | native-resource-sharing/Composer.native-menu 회귀 |
| AC13 | ✅ | T-skill: 기본 3출처 저장 false→true·canToggle false |
| AC14 | ✅ | T-list/SkillDetail·skills handler: 토글 0·일반 글씨·patch 불변 |
| AC15 | ✅ | T-query·attachMenuModel·composerSkills: 기본 스킬 허용/선택 가능 |
| AC16 | ✅ | json-file: 중첩 생성·교체·tmp 없음 |
| AC17 | ✅ | McpStore fresh root: 파일·list docs |
| AC18 | ⚠️ | 실제 CLI /context·Windows white/dark·경로 전환 실기 미실행 |
| AC19 | ✅ | T-global: effective file 항목만 true·해석 불가 fixed |
| AC20 | ✅ | T-global: JSONC 주석·튜플·위치 왕복 |
| AC21 | ✅ | T-global: 두 toggle·외부 편집 함께 반영 |
| AC22 | ✅ | T-global: 기록 선행·on 후 정리·실패 원복·재추가 reconcile |
| AC23 | ✅ | T-handler/T-view/T-bootstrap: 확인 전 불변·승인/0세션 적용 |
| AC24 | ✅ | T-server: 새 process/인증·기존 owner 유지·마지막 release 종료 |
| AC25 | ✅ | T-state/T-cache: revision 1회 초기화·models 값 유지 |
| AC26 | ⚠️ | 실제 OpenCode 플러그인·파일·대화상자 Windows 실기 미실행 |
| AC27 | ✅ | configured-resources/T-bootstrap: Claude 폴더 삭제 후 nav/draft/stored/새 Query 제외 |
| AC28 | ✅ | T-bootstrap/T-watch: 외부 배열 삭제→새 revision fan-out, T-server 기존 owner 유지 |
| AC29 | ✅ | T-global: 설치본 삭제→off 행·기록 0, 미해석 spec fixed |
| AC30 | ✅ | T-bootstrap/T-watch: 외부 재추가→기록 0→삭제→행 0; 자기 쓰기 중복 0 |

검산: ✅ 28 · ⚠️ 2 · ❌ 0 = 총 30. 사람 실기를 자동화 결과로 대체하지 않았다.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음 — r1 첫 구현.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: I1은 main-only 선택 기록의 응답 경계, I2는 새 큐의 종료 drain에서 발견해 선조치했다.
- 반복해서 부딪히는 환경 한계: 현재 Node의 undici engine 경고와 ignored 임시 소스 링크는 변경 관련 실패와 분리했다. lint warning은 기존 virtualizer 2곳이다.
- 현재 라운드·impl 턴: `r1`.

---

# r1.2 — CI 보완 (2026-10-23)

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1+ΔV1+ΔV2 유지. CI run 39913530046의 Test 실패 4건을 필수 gate 미완료로 처리했다.
- 이견 / 현실성 문제: Windows 잠금 fixture는 로컬에서 통과했지만 CI에서 준비 신호가 30초 동안 오지 않았다. CI 기본 shell인 `pwsh`와 파일 신호를 사용하고 같은 준비 상한을 유지했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 제품 동작·공개 계약·의존성은 그대로다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

현재 수정은 EP-06의 승인 후 오류 처리와 EP-09의 reconcile 전달이다. 종속 EP-07도 재실행했다. 아래 별칭과 자리별 좌표는 앞선 r1 전수 표의 정식 테스트 이름을 인용한다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-18~20·22·23′ | 파일·복원 기록 | EP-06 P1~P18·P14b | 19/19 | P1~P5·P17=T-global; P6~P9·P18=T-handler/T-bootstrap; P10~P12=T-handler/T-wire; P13=T-view·useNativeMcpCatalog.test.ts:reports a confirmed plugin write failure once and releases the queue for a retry; P14~P16·P14b=T-record/T-handler | confirm→승인 true→write reject는 로그·saveFailed 1회, 행 true 유지; 재시도는 행 false | AC26 실기 |
| VP-21·24 | 서버·재준비 | EP-07 Q1~Q12 | 12/12 | Q1~Q3·Q12=T-server; Q4~Q7=composer-catalog.test.ts:revalidates every OpenCode owner with the plugin revision; Q8=T-bootstrap revision [1,2,3]; Q9=T-wire; Q10=T-state; Q11=T-cache | 기존 owner 유지·새 server·revision 1회·models 보존 | 없음 |
| VP-28~31 | 외부 변경 | EP-09 X1~X7 | 7/7 | X1·X2=T-watch; X3=T-bootstrap shutdown; X4·X6·X7=T-bootstrap 실제 파일 감시와 revision [1,2,3]; X5=T-global:shows a record only while its installation exists and its spec is absent | `reconcilePlugins`가 기록 정리 후 fingerprint 비교·fan-out; 외부 재추가/삭제·자기 쓰기 중복 0 | 없음 |

- 이번 영향 범위 38/38. 그 밖의 고정 자리는 r1의 자리별 좌표와 판정을 보존하며 동일 관련 집합에서 재실행했다.
- §10 검색 10개 재실행: 33·15·17·14·7·2·18·12·6·4줄. r1 검색과 자리 집합의 추가·삭제 차이는 `[]`/`[]`; 콜백 이름 변경은 X1·X4 내부다.
- 목록 밖 운영 gate: Auth injection 스윕은 수정 없이 통과. 오류 registry는 refresh/toggle/open의 catch ordinal 0/1/2에 맞춰 전수·삭제·형제 event 교환 검사를 통과했다.
- 직전 verify의 `못 잡음`: 해당 없음 — verify 전 같은 라운드의 CI 보완이다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-18 | REQUIRED | SELF_BLOCKED — AC26 실기 | T-view 확인/승인·useNativeMcpCatalog.test.ts의 승인 후 실패/재시도 | r1 M11·M12 보존, 확인 분기 변경 없음 |
| VP-29 | REQUIRED | SELF_PASS | T-watch 3건·T-bootstrap 12건 | M21·M22 이번 턴 재실행 |
| VP-30 | REQUIRED | SELF_PASS | T-bootstrap 감시 등록→revision [1,2,3]→shutdown | not selected |
| VP-33 | REGRESSION | SELF_PASS | T-view·T-handler·T-server | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M21 fingerprint 비교 제거 | VP-29 선택 증거 | r1 잡음 | T-watch:fans out once per external plugin change and ignores Orca's own write·clears a record when the plugin is re-added externally / 2 | 잡음 · 원본 복구 확인 |
| M22 감시 callback 미연결 | VP-29 선택 증거 | r1 잡음 | T-watch:fans out once per external plugin change and ignores Orca's own write / 1 | 잡음 · 원본 복구 확인 |
| 오류 보고 삭제·형제 event 교환 | 수정한 오류 registry oracle | 기존 내장 민감도 검사 | reportSites.registry.test.ts:detects removal of T-native-mcp-open·T-native-toggle 및 detects swapped event slots T-native-mcp-open/T-native-toggle | 257건 전체 통과, 잘못된 ordinal은 수정 전 2건 red |

- 분모 검산: 이번 SELF_PASS의 선택 증거 2 · 닫음으로 주장한 이슈의 인용 변이 0 · 수정 oracle 1 = 표 행 3. 승인 실패/재시도와 실제 Windows 잠금은 직접 행동 oracle이다.
- 덮개 회귀: Auth guard를 완화하지 않았다. 오류 registry의 기존 삭제·형제 교환 검사를 유지했다. M21·M22는 r1 red→r1.2 red다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음; 승인 저장 실패의 기존 saveFailed 토스트 1개 관측 | 없음 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음; watcher port 이름과 주입을 함께 변경 | T-watch·T-bootstrap |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 기존 저장 실패 행; 실패 후 enabled true 유지·재시도 false | useNativeMcpCatalog.test.ts 신규 사례 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 로그·토스트 1회, 중복 catch 제거 뒤에도 보고됨 | 같은 사례 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | backend version·쓰기 큐 유지, 기존 stale read 테스트 재실행 | useNativeMcpCatalog.test.ts 기존 사례 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| CI1 | 일반 `reconcile` 키가 Auth 카탈로그 전수 스윕 대상과 충돌 | OpenCode port를 `reconcilePlugins`로 명명 | no-stray-auth-subscribe.test.ts 17/17, guard 변경 0 |
| CI2 | 승인 callback의 중복 catch로 registry의 catch 자리 이동·누락 | toggle 자체 보고로 합치고 실제 catch ordinal로 registry 갱신 | 수정 전 registry 2 red→257/257, 승인 실패 로그·토스트 1회 |
| CI3 | Windows PowerShell Console 준비 신호 미수신 | CI shell pwsh·파일 ready/release, child 종료/실행 오류 감지·finally 정리 | 실제 FileShare.None read EBUSY·잠금 중 미완료·해제 후 저장, 6/6 |

### 설계 대비 명시적 차이

- 제품 메커니즘 차이 없음. 테스트 helper의 shell·신호 전달만 변경했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | ready 파일이 늦으면 준비 상한 도달 | 준비 30초 유지; 실제 잠금 사례 1.49초 스위트 안에서 통과 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | stale 신호 파일 | 각 케이스의 mkdtemp 안에 ready/release 생성·afterEach 삭제 |
| 재진입 | helper 또는 저장이 종료 전 남음 | finally release→kill→close→save settle 후 임시 루트 삭제 |
| 다른 무효화 축 | pwsh 실행 실패 | error·close 감지; CI 기본 shell과 동일 실행 파일 사용 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | watcher port·bootstrap·watch 테스트, native hook·오류 registry·실패/재시도 테스트, Windows 잠금 fixture; plan·INDEX |
| 실행 명령 | lint·typecheck 3종; 실패 3스위트와 관련 4스위트; r1 비DB 관련 집합+Auth/registry; node --test scripts/*.test.mjs; migration·budget·doc guard; M21·M22 |
| **관측한 게이트 산출**(exit code 아님) | targeted 7파일·302/302; 확장 173파일·1882/1882; script 142/142. lint 0 error·기존 warning 2, typecheck 3종 통과. migration sync·append-only 통과, budget 16스위트 통과. generated/prose 통과; 링크는 기존 ignored 임시 소스 10건, 해당 두 폴더를 제외한 동일 검사 [] |
| V-pair 자기확인 | 이번 영향 pair VP-29·30·33 SELF_PASS, VP-18은 AC26 실기로 SELF_BLOCKED. 다른 pair의 r1 자리별 관측 보존 |
| 강제 지점 전수 | 이번 영향 범위 38/38; 검색 10개 결과 r1과 동일 |
| **AC 자기보고**(`Criteria-Met`) | 28/30 유지 — 아래 r1의 동일 oracle 좌표를 이번 확장 집합에서 재실행; AC18·AC26 실기 대기 |
| **합계 검산** | ✅ 28 · ⚠️ 2 · ❌ 0 = 총 30 |
| 블로커 / 역질문 | 자동화 블로커 없음. 원격 Windows CI는 이 커밋 push 후 재확인 |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | T-module: agents IPC 1회·다른 scope 목록·스피너 0 |
| AC2 | ✅ | T-state: 동시 first/late·실패·취소·빈 성공 |
| AC3 | ✅ | T-state: invalidation agents ready/models error |
| AC4 | ✅ | adapter.persistent: 제거된 agent prompt 제외 |
| AC5 | ✅ | T-view: 기본 출처 행 유지·plugin 출처 0 |
| AC6 | ✅ | T-list: provider→Claude→OpenCode 순서·true/false capability |
| AC7 | ✅ | T-view: 스킬 목록 유지·실패 탭 banner만 1개 |
| AC8 | ✅ | T-bootstrap/T-query: 같은 cwd 새 Query는 현재 flag |
| AC9 | ✅ | T-bootstrap: off/on 초안·저장 세션 명령 |
| AC10 | ✅ | T-bootstrap: off/on 초안·저장 세션 resource enabled |
| AC11 | ✅ | T-bootstrap/T-priority: project true가 Orca false보다 우선 |
| AC12 | ✅ | native-resource-sharing/Composer.native-menu 회귀 |
| AC13 | ✅ | T-skill: 기본 3출처 저장 false→true·canToggle false |
| AC14 | ✅ | T-list/SkillDetail·skills handler: 토글 0·일반 글씨·patch 불변 |
| AC15 | ✅ | T-query·attachMenuModel·composerSkills: 기본 스킬 허용/선택 가능 |
| AC16 | ✅ | json-file: 중첩 생성·교체·tmp 없음 |
| AC17 | ✅ | McpStore fresh root: 파일·list docs |
| AC18 | ⚠️ | 실제 CLI /context·Windows white/dark·경로 전환 실기 미실행 |
| AC19 | ✅ | T-global: effective file 항목만 true·해석 불가 fixed |
| AC20 | ✅ | T-global: JSONC 주석·튜플·위치 왕복 |
| AC21 | ✅ | T-global: 두 toggle·외부 편집 함께 반영 |
| AC22 | ✅ | T-global: 기록 선행·on 후 정리·실패 원복·재추가 reconcile |
| AC23 | ✅ | T-handler/T-view/T-bootstrap: 확인 전 불변·승인/0세션 적용 |
| AC24 | ✅ | T-server: 새 process/인증·기존 owner 유지·마지막 release 종료 |
| AC25 | ✅ | T-state/T-cache: revision 1회 초기화·models 값 유지 |
| AC26 | ⚠️ | 실제 OpenCode 플러그인·파일·대화상자 Windows 실기 미실행 |
| AC27 | ✅ | configured-resources/T-bootstrap: Claude 폴더 삭제 후 nav/draft/stored/새 Query 제외 |
| AC28 | ✅ | T-bootstrap/T-watch: 외부 배열 삭제→새 revision fan-out, T-server 기존 owner 유지 |
| AC29 | ✅ | T-global: 설치본 삭제→off 행·기록 0, 미해석 spec fixed |
| AC30 | ✅ | T-bootstrap/T-watch: 외부 재추가→기록 0→삭제→행 0; 자기 쓰기 중복 0 |

검산: ✅ 28 · ⚠️ 2 · ❌ 0 = 총 30. 분모 변경 없음.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 승인 후 보고와 watcher 배선은 r1 코드의 기존 축이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 운영 gate의 전체 스위트가 구조 검사 3건을 검출했다. r1 관련 테스트 집합에는 Auth injection·오류 registry가 빠져 있었다.
- 반복해서 부딪히는 환경 한계: CI Windows PowerShell Console 준비 timeout은 로컬에서 재현되지 않았다. 실제 잠금 검증을 유지하고 shell·신호 전달을 교체했다. SQLite ABI를 바꾸지 않았다.
- 현재 라운드·impl 턴: `r1.2`; 다음 주체는 Claude 독립 검증이다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| CI1 | Auth injection 스윕이 OpenCode reconcile 콜백을 거절 | [CI run 39913530046](https://github.com/muzaby/orca-skin/actions/runs/39913530046) · 필수 Test gate | 도메인별 port 이름 구분 | BLOCKING | 조치·로컬 17/17, 원격 재확인 대기 |
| CI2 | 오류 registry catch ordinal 이동·누락 2건 | 같은 CI run · 필수 Test gate | 중복 catch 정리·registry 동기화 | BLOCKING | 조치·로컬 257/257, 원격 재확인 대기 |
| CI3 | Windows lock helper readiness timeout | 같은 CI run · 필수 Test gate | CI shell·파일 신호로 실제 lock 확인 | BLOCKING | 조치·로컬 6/6, 원격 재확인 대기 |
