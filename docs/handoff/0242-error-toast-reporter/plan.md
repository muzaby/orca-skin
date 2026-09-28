# Plan — 0242-error-toast-reporter

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0242-error-toast-reporter` |
| 작성자 | Claude Code |
| 일자 | 2026-09-27 |
| 매핑 | 없음 |
| 상태 | verify/PASS — V1+ΔV1 r1 · ΔV2~ΔV4 r1.4 · ΔV5 r1.5 ([verify.md](verify.md)), 사람 실기 대기 |
| V mode | `Delta V` |
| 기준 V | `V1@abb4e49a` (공유 브랜치, `git cat-file -t` = commit) |
| 이번 V revision | `ΔV5` (ΔV4 r1.4 verify/PASS `ef3cd63` 이후) |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5` |
| 기준 커밋 | `e6d0ab6` (작성 시점 HEAD) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 앱에는 전역 오류 표면이 없다(`BranchChip.tsx:70` "전역 toast 가 없는 앱"). 미처리 예외는 main(`index.ts:97-104`)·renderer(`shared/logging.ts:35-46`) 모두 **로그만** 남기고, 사용자 행동 실패 33곳(renderer)과 main 부팅·백그라운드 실패 24곳이 화면에 아무것도 남기지 않는다.
- 완료 후 달라지는 것: 제대로 소비되지 않던 오류가 화면 우측 상단의 Claude 스타일 toast로 나타나고, 같은 오류가 앱 로그(JSONL)에 남는다. main·renderer 어느 레이어에서든 한 함수로 호출한다.
- 성공을 사용자 관점에서 한 문장으로: **실패했는데 아무 일도 안 일어난 것처럼 보이는 경우가 없다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "제대로 소비되지 않는 에러/예외 발생에 대해 상단에 토스트 메시지 출력으로 구현한다. (transcript에서 표시되는 에러/예외는 소비가 맞다)" | 라이브 세션 1턴 |
| 명시 요구 | "토스트 메시지로 소비되는 에러/예외는 앱 로그에도 출력돼야 한다." | 1턴 |
| 명시 요구 | "이것은 모든 레이어에서 호출할 수 있어야 한다. 예외 핸들러이다." | 1턴 |
| 명시 요구 | "제대로 소비되지 않는 후보를 모두 찾고 해당 형태로 소비되도록 수정해야 한다." | 1턴 |
| 명시 요구 | Claude-style Toast 구현 스펙 §1~§8(위치·카드·레이아웃·아이콘·타이포·애니메이션·시간) | 1턴 첨부 스펙 |
| 사용자 결정 | 판정 기준 = "사용자 영향 기준" · main 범위 = "main 포함" · 라이트 = "라이트용 변형 + orcinus orca 스타일 준수" · 중첩 = "세로 스택+중복 병합" | 1턴 질의 응답 |
| 추론 의도 | "모든 레이어" = main의 app/features/adapters/infra 와 renderer의 app/pages/features/shared. `src/shared`(순수 타입)는 호출 주체가 아니라 계약 SSOT다 | `app/src/main/AGENTS.md` DAG · `app/src/renderer/AGENTS.md` DAG |
| 추론 의도 | "상단" = 첨부 스펙 §1의 우측 상단(`top:38px; right:28px`) | 스펙 §1 "화면 우측 상단 고정" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 소비되지 않는 오류는 우측 상단 toast로 표시한다. transcript에 표시되는 오류는 이미 소비된 것으로 보고 건드리지 않는다 | "(transcript에서 표시되는 에러/예외는 소비가 맞다)" | 1턴 | ACTIVE | — |
| D-002 | toast로 소비되는 모든 오류는 앱 로그에 남는다. 기본 경로는 `reportError` 한 함수가 로그→게시를 함께 하고, 예외는 같은 블록에서 이미 로그한 2자리(§10 EP-2)뿐이다 | "앱 로그에도 출력돼야 한다" | 1턴 | ACTIVE | — |
| D-003 | 보고 함수는 main의 모든 레이어(app·features·adapters·infra)와 renderer의 모든 레이어(app·pages·features·shared)에서 import 가능하다 | "모든 레이어에서 호출할 수 있어야 한다. 예외 핸들러이다." | 1턴 | ACTIVE | — |
| D-004 | 판정 기준 = **사용자 영향**: 사용자 행동/데이터가 실패했는데 화면 표시가 없는 것(조용한 롤백·빈 목록 대체·console/log만)과 uncaught 전부 → toast. 결과가 정상 사용 가능한 폴백(파싱 fallback·원문 표시 degrade)은 제외 | 사용자 선택 "사용자 영향 기준" | 1턴 질의 | ACTIVE | — |
| D-005 | main 포함: main uncaught/unhandled 와 main에서 로그로만 흡수되던 사용자 영향 실패를 IPC로 열린 창에 toast한다 | 사용자 선택 "main 포함" | 1턴 질의 | ACTIVE | — |
| D-006 | 다크 테마 = 첨부 스펙 값. 라이트 테마 = Orca 토큰에서 파생한 변형. 둘 다 `tokens.css` 컴포넌트 토큰으로 두 스코프에 정의 | 사용자 선택 "라이트용 변형 + orcinus orca 스타일 준수" · `renderer/AGENTS.md §스타일` | 1턴 질의 | SUPERSEDED | D-010 |
| D-007 | 동시 표시 최대 3개 세로 스택, 초과 시 가장 오래된 것 제거. 같은 제목+설명이 표시 중이면 새로 띄우지 않고 타이머만 재시작 | 사용자 선택 "세로 스택+중복 병합" | 1턴 질의 | ACTIVE | — |
| D-008 | 카드 수명 4.6초(스펙 §6·§7), 닫기(×)로 즉시 제거. hover 일시정지 없음 | 스펙 §7 "전체: 4.6초" | 1턴 스펙 | ACTIVE | — |
| D-009 | 주기 작업(scheduler job) 실패는 job별 **성공→실패 전이 1회**만 toast. 이후 연속 실패는 로그만, 성공 후 다시 실패하면 다시 toast | 1분 cron(`usage-fetch`)이 폐쇄망에서 매 tick 실패 시 toast 폭주 방지 — D-005 범위 안의 설계 결정 | 설계 | ACTIVE | — |

| D-010 | Claude toast 스펙은 참고이며 두 테마 모두 Orca 시맨틱 토큰·앱 폰트를 우선한다. 미세 이동·스택·수명은 유지한다 | 사용자 원문: "이것은 참고 스펙이다. 실제로는 orcinus-orca의 스타일을 준수해야한다." | 2026-09-27 구현 턴 사용자 정정 및 §6 원문 제공 | ACTIVE | D-006 대체 |

| D-011 | transcript 아티팩트·생성 파일이 삭제·이동·접근 불가여도 카드 UI·우측 패널에 **미리** 불가 표시를 하지 않는다. 사용자가 그 파일에 동작(미리보기·다운로드·저장·위치 열기·휴지통·복사·경로 열기)을 요구했을 때 실패 사유를 예외 toast로 출력한다 | 사용자 원문: "이러한 사례에 대해 바로 안된다는 표시를 하지말고 사용자가 해당 파일에 대해 특정 이벤트를 요구했을때에 안되는 이유를 예외 토스트로 출력되게 하라" | 2026-09-28 impl 턴 사용자 요구 | ACTIVE | — |
| D-012 | D-011 파생: 불가 상태를 드러내던 부속 표시(카드 아래 상태 줄의 확인 중/없음/접근 불가, 상태 새로 고침 버튼·메뉴)와 `present` 기반 버튼 비활성을 제거한다. 버튼 비활성은 작업 중(busy)만 | 상태를 보여 주지 않으면 새로 고침은 눌러도 보이는 변화가 없다("아무 일도 안 일어남") | 설계 파생 | ACTIVE | — |
| D-013 | D-011의 대상에 **퍼블리시되지 않은 생성 파일**(`ArtifactRef.category: 'file'`, Write/Edit·응답 링크로 캡처된 출력 파일)을 포함한다. 생성 파일에만 있는 사유(원본 변경·이동 = `file-changed`)와 저장 시 `skipped` 결과도 동작 시 toast 로 알린다 | 사용자 원문: "퍼블리시 되지 않은 생성된 파일도 포함대상이다." | 2026-09-28 r1.2 후 사용자 요구 | ACTIVE | D-011 보완 |
| D-014 | 미리보기 요청 시 뷰어 공간은 **미리보기 결과를 받은 뒤, 열 수 있을 때만** 할당한다. 열 수 없으면 공간 할당 없이 toast 만 내고, 이미 열린 다른 뷰어는 그대로 둔다. 대기 중에는 누른 카드 미리보기 버튼만 busy 로 표시한다 | 사용자 실기: "Ui 상으로 먼저 공간 할당 → 파일 없는 것을 확인 → Ui 공간 되돌리기 → 토스트 메시지 … 불필요한 ui공간할당이 시도되엇고 플리커 같은 현상이 잘현되어 ux 를 헤친다. 보완하라" | 2026-09-28 r1.3 후 사용자 육안 확인 | ACTIVE | ΔV2 AC20 의 '뷰어를 닫고' 대체 |
| D-015 | toast 설명은 **최대 8줄까지 가변 높이**로 표시하고, 넘치면 8번째 줄 끝을 `…`로 줄인다. 제목은 그대로 둔다 | 사용자 원문: "로그에 남는가면 창 너비를 초과하는 텍스트에 대해서는 ... 으로 표기하도록 하라" → 실측 후 질의 "8줄 최대 높이인가? 8줄 내외로 가변되는 것인지?" → 선택 "8줄" (기본 창 900×670 에서 3장이 모두 보이는 최대치) | 2026-09-28 r1.4 verify 후 사용자 | ACTIVE | — |
| D-016 | toast **카드 본문 클릭**(× 제외)은 호출 시 지정된 이동 대상으로 가고 그 toast 를 닫는다. 이동 대상 = 앱 **페이지 경로** 또는 **설정 모달 탭** | 사용자 원문: "클릭시 지정된 위치로 이동 … 지정 위치는 토스트 호출시 입력된 page url 로" · 선택 "카드 본문 클릭" · "페이지 + 설정 탭" | 같은 턴 질의 | ACTIVE | — |
| D-017 | 이동 대상이 없으면 **탐색기에서 현재 로그 파일**(`~/.config/orcinus-orca/logs/application.jsonl`)을 선택해 보인다 | 사용자 원문: "지정 위치가 없으면 로그파일의 위치로 이동 (~/.config/orcinus-orca/logs/applicationXXX.jsonl)" · 선택 "탐색기에서 파일 선택" | 같은 턴 질의 | ACTIVE | — |
| D-018 | warning 분류·usage fetcher 연결은 범위 밖. 엔진·모델 자동 할당 fetcher 는 코드에 없다 | 사용자 원문: "없다면 내가 착각했다." | 같은 턴 질의 | ACTIVE | — |
| D-019 | 기존 보고 사이트는 이동 대상을 지정하지 않는다(전부 로그 파일로 이동). 대상 지정은 새 호출부가 쓰는 입력이다 | 사용자 예시(usage fetcher)가 없어 지정할 근거 사이트가 없다 — 사이트별 대상 선택은 제품 판단이라 설계자가 임의로 붙이지 않는다 | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-009 (최초 작성).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 해당 없음(신규 handoff).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC7(transcript 소비 사이트 비변경) · D-002↔AC3 · D-003↔AC4·AC5 · D-004↔AC7·AC8 · D-005↔AC5·AC9 · D-006↔AC13 · D-007↔AC10 · D-008↔AC11 · D-009↔AC12.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 전역 오류 표면 부재가 원인. 개별 사이트가 삼키는 이유가 "표시할 곳이 없어서"다 — `ProviderUsageTab.tsx:53`, `BranchChip.tsx:70` 주석 |
| 이미 기존 코드가 충족하는가 | 아니오 | `rg -i toast renderer/src` 구현 0건(주석 2건). 미처리 예외는 로그만: `main/index.ts:97-104`, `renderer/src/shared/logging.ts:35-46` |
| 더 작은 해법이 있는가 | 전역 핸들러만으로는 부족 | 33곳이 `.catch(() => …)`로 삼켜 unhandledrejection 까지 오지 않는다(§8 전수). 사이트 전환이 필요하다 |
| 선행 자료 대조 | 0186 D23 "전역 toast 를 만들지 않는" 결정 확인 | `ProviderUsageTab.tsx:53-55` — 수동 동기화 실패는 그 화면에서 소비된다(CONSUMED). 이번 작업은 그 경로를 바꾸지 않는다(§16) |
| 기존 결정 충돌 | 없음 | 0123 renderer 로그 인제스트·0124 이벤트 명명(`LOG_EVENT_PATTERN`) 재사용 |

- 사용자에게 올릴 결정: 없음(1턴 질의 4건으로 닫음).
- 코드 조사로 닫은 사실: 후보 전수(§8), Chromium의 `ResizeObserver loop` 오류가 window `error` 이벤트로 오는 benign 사례(§10 MD-04), toast 채널이 없는 부팅 초기 main 오류의 큐잉 필요(§9).

## 5. 동작 / 사용자 흐름

```text
[오류 발생: renderer 사이트 / renderer uncaught / main 사이트 / main uncaught]
  → reportError() — 앱 로그 1건 기록 + toast 게시 요청
  → (main 발) 준비된 창이 있으면 IPC push, 없으면 main 대기열
  → renderer toast 스택: 병합/최대 3개 규칙 적용
  → 우측 상단 카드 등장(-6px→0, 180ms) → 유지 → 4.6초에 fade-out 후 제거
  ↘ × 클릭: 즉시 제거
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 새 오류, 표시 0~2개 | 스택에 추가 | 카드 1장 추가(최신이 맨 위) |
| 새 오류, 표시 3개 | 가장 오래된 카드 제거 후 추가 | 카드 수 3 유지 |
| 같은 제목+설명 카드가 표시 중, 마지막 적중 후 1초 경과 | 새 카드 없음, 해당 카드 타이머·애니메이션 재시작 | 같은 카드가 다시 4.6초 유지 |
| 같은 키가 1초 안에 재적중 | 무시(로그는 남음) | 변화 없음 — 렌더 루프·폭주 차단 |
| 카드 4.6초 경과 | 제거 | 사라짐 |
| × 클릭 | 즉시 제거 | 사라짐 |
| main 오류, 준비된 창 0개(부팅 초기) | main 대기열(최대 10, 오래된 것부터 버림) | 창 준비 직후 toast로 나타남 |
| scheduler job 연속 실패 | 전이 1회만 보고(D-009) | toast 1회 |

### 파생 UX / 엣지케이스

- loading / empty / error: 조회 실패가 빈 목록으로 대체되던 사이트는 **빈 목록 유지 + toast**. 빈 목록 폴백을 없애지 않는다(로딩 무한 대기 방지 목적 유지).
- cancel / retry / close / restart: 낙관적 갱신 롤백 사이트는 **롤백 유지 + toast**.
- concurrency / multi-window: main 발 보고는 준비된 모든 창에 전달. renderer 발 보고는 그 창에만.
- keyboard / a11y: 카드 `role="alert"`, × 버튼 `aria-label=common.close`, `prefers-reduced-motion` 에서 애니메이션 없음(수명은 타이머가 결정).
- theme: 다크 = 스펙 값, 라이트 = §11 토큰 표(D-006).
- 폐쇄망: `usage-fetch` 실패는 앱 실행당 전이 1회(D-009).

## 6. 범위 / 비범위

- **범위**: 보고 API(main·renderer), toast UI·스토어, main→renderer 전달 채널, 전역 핸들러 전환, §8 전수의 TOAST 판정 사이트 전환(renderer 33 · main 24), 문서(IPC_CONTRACT·observability·inventory).
- **비범위**: transcript 에 이미 표시되는 오류 경로(D-001), 이미 인라인/모달로 소비되는 사이트(§8 CONSUMED), 폴백 사이트(§8 EXCLUDE), `window.alert` 사용처(`useProjectDeletion.ts:33` — 소비됨)의 toast 전환, React ErrorBoundary 도입.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 정보/성공 toast 종류 | 아니오 — 보고 계약은 오류 전용, 이후 severity 추가 가능 | 후속 |
| React 렌더 오류 ErrorBoundary | 아니오 | 후속 |
| IPC 채널 이름 `orca:error:*` | **예 — 공개 계약** | 이번에 확정(§10) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | renderer uncaught error·unhandled rejection → toast 1장 + 로그 1건 | 단위: 전역 핸들러에 `ErrorEvent`/`PromiseRejectionEvent` 주입 → 스토어에 제목 `errors.toast.unexpected` 카드 1 · `window.orca.log.error` 호출 1(event `renderer.uncaught.error`/`renderer.unhandled.rejection`) | `main.tsx` → `registerGlobalErrorHandlers()` → `reportError` |
| R-01 | AT-01 / AC2 | main uncaughtException·unhandledRejection → 열린 창에 toast + 로그 | 단위: hub에 sink 주입 후 `reportError({event:'app.uncaught.exception'…})` → sink 1회·logger.error 1회. 배선: `index.ts` 두 핸들러가 `reportError` 호출(소스 단언 + §19 사람 실기 1) | `process.on` → `infra/error-report` → app sink → `orca:error:reportEvent` → bridge → 스토어 |
| R-02 | AT-02 / AC3 | toast로 게시된 **모든** 보고는 로그 1건을 남긴다 | 단위: renderer `reportError` 경로와 main `reportError` 경로 각각 로그 sink 호출 1 · main 발 보고를 renderer가 받을 때 renderer 로그 호출 0(중복 기록 없음) | 두 `reportError` 구현 |
| R-03 | AT-03 / AC4 | renderer 4개 레이어 모두 `shared/errors` 를 import 할 수 있다 | `npm run lint`(boundaries) green + TOAST 사이트 중 app·pages·features·shared 각 1곳 이상이 호출(§8 표) | eslint boundaries |
| R-03 | AT-03 / AC5 | main app·features·adapters·infra 모두 `infra/error-report` 를 import 할 수 있고 그 모듈은 electron 비의존이다 | lint green + `infra/error-report/index.ts` 를 import 하는 vitest가 electron alias 없이 실행 · M-표에 4 레이어 각 1곳 이상 | eslint boundaries · vitest |
| R-04 | AT-04 / AC6 | §8 renderer TOAST 33 사이트가 실패 시 toast 를 게시한다 | 사이트 레지스트리 테스트: `[파일, event]` 33행 각각 해당 파일에 `event: '<name>'` 를 인자로 한 `reportError(` 호출이 있음 + 대표 행동 테스트 4건(§11 테스트 표) | 각 사이트 → `reportError` |
| R-04 | AT-04 / AC7 | CONSUMED 36·EXCLUDE 21 사이트는 toast 를 게시하지 않는다(transcript·인라인 소비 유지) | 레지스트리 테스트의 CONSUMED/EXCLUDE 파일:이벤트 대조 — 해당 catch 본문에 `reportError(` 없음 | 해당 사이트 |
| R-04 | AT-04 / AC8 | 새 조용한 삼킴이 추가되면 게이트가 실패한다 | 음성 스윕: renderer 비테스트 소스의 `.catch(() => (undefined\|null\|\[\]\|\{\}))` 형태 개수 = EXCLUDE 허용목록 개수. 허용목록 밖 1건 추가 시 red | CI vitest |
| R-05 | AT-05 / AC9 | §8 main TOAST 24 자리가 toast 를 게시하고 기존 로그 event 이름을 유지한다 | main 레지스트리 테스트 `[파일, event]` 24행 · 기존 event 문자열 보존 · `publishErrorReport` 2자리(M13·M22)는 같은 블록의 로그 호출도 단언 | 각 사이트 → `infra/error-report` |
| R-06 | AT-06 / AC10 | 최대 3개 스택·최신 위·초과 시 최고령 제거·같은 키 병합(타이머 재시작)·1초 내 재적중 무시 | 순수 모델 단위 테스트(주입 clock): 4번째 push → 첫 카드 제거 · 같은 키 1.2초 후 → 카드 수 불변·`seq`+1·만료 재설정 · 0.5초 후 → 불변 | `errorToastModel.ts` |
| R-06 | AT-06 / AC11 | 4.6초 뒤 제거, × 클릭 즉시 제거 | fake timer: push 후 4599ms 존재·4600ms 제거 · `dismiss(id)` 즉시 제거 · 재시작된 카드는 재시작 시점부터 4600ms | `errorToastStore.ts` |
| R-07 | AT-07 / AC12 | scheduler job 실패는 성공→실패 전이 1회만 toast, 로그(`scheduler.job.failed`)는 매 실패 | 단위: 실패·실패·성공·실패 → 보고 2회, logger.error 3회 · 첫 실행 실패도 보고 1회 | `Scheduler.invoke` |
| R-08 | AT-08 / AC13 | 카드 시각 스펙(위치·폭·배경·테두리·반경·그림자·grid·아이콘·타이포·keyframes) 두 테마 | 소스 단언: 클래스 문자열·`tokens.css` 두 스코프의 `--color-toast-*`/`--shadow-toast` 값 · keyframes 4 스톱 값 · duration `4.6s` = `ERROR_TOAST_DURATION_MS/1000` + **사람 실기(두 테마 시각 1회)** | `ErrorToastHost.tsx` · `tokens.css` |
| R-09 | AT-09 / AC14 | main 오류가 창 준비 전에 나면 대기열에 남았다가 준비된 창에 표시된다 | 단위(hub): ready 0 → report → 대기열 1 · `markReady(w)` 가 대기열 반환·비움 · 11번째 → 가장 오래된 것 버림 · ready 창 파괴 후 → 다시 대기열 · 같은 키 0.5초 후 재게시 → sink 호출 불변 | `ErrorReportHub` · `orca:error:drain` |
| R-10 | AT-10 / AC15 | benign window 오류(`ResizeObserver loop …`)는 toast 도 로그도 만들지 않는다 | 단위: 해당 메시지 `ErrorEvent` → 스토어 0 · 로그 0 | 전역 핸들러 |
| R-10 | AT-10 / AC16 | 보고 경로 자체의 예외는 전파되지 않는다(재귀 없음) | 단위: 스토어 push 가 throw 하도록 주입 → `reportError` 반환·로그 1 · 전역 `error` 재발생 0 | 두 `reportError` |
| R-11 | AT-11 / AC17 | IPC 문서·인벤토리가 새 채널/도메인과 일치 | `ipc-documentation.test.ts` · `scripts/check-doc-inventory.mjs` green | CI |

### AC 검증 주의사항

- 기존 테스트 재사용: `shared/protocol.log.test.ts` 는 로그 payload 계약만 본다 — 전역 핸들러 케이스 없음(`rg registerGlobalErrorLogging app/src` → 정의 1·호출 1, 테스트 0). 새로 작성.
- 사람 실기 항목: AC13 시각(두 테마) · AC2 실제 main uncaught가 창에 뜨는지(개발자 도구 없이 main 강제 예외 — debug 채널 없음) 1건. 나머지는 순수 테스트.
- N회/총량 기준: AC3 "로그 1건"의 sink = renderer `window.orca.log.error`(renderer 발) · main `AppLogger.error/warn`(main 발). 관측 지점은 각 `reportError` 가 **스스로 내는** 호출로 한정한다(기존 사이트가 따로 남기던 로그 호출은 전환 시 `reportError` 로 대체되어 제거된다 — §11).
- 총량/0건 기준: AC8 허용목록 = §8 EXCLUDE 중 `.catch(() => 값)` 형태 행. 제거 대상(TOAST)과 허용(EXCLUDE)을 표에서 분리했다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 없음(신규 기능).
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | 미처리 예외 toast (§5) | NEW | — |
| R-02 | R | toast = 로그 (D-002) | NEW | — |
| R-03 | R | 모든 레이어 호출 (D-003) | NEW | — |
| R-04 | R | renderer 후보 전수 전환 (§8) | NEW | — |
| R-05 | R | main 후보 전수 전환 (§8) | NEW | — |
| R-06 | R | 스택·병합·수명 (D-007·D-008) | NEW | — |
| R-07 | R | 주기 작업 전이 보고 (D-009) | NEW | — |
| R-08 | R | 시각 스펙 (D-006, 스펙 §1~§8) | NEW | — |
| R-09 | R | 부팅 초기 main 오류 보존 (§5) | NEW | — |
| R-10 | R | benign 필터·재귀 차단 (§5) | NEW | — |
| R-11 | R | 공개 계약 문서 (§10) | NEW | — |
| AT-01~11 | AT | §7 행 | NEW | — |
| SD-01 | SD | 보고 → 로그 → 전달 → 스택 → 만료 수명주기 (§9 TO-BE) | NEW | — |
| SD-02 | SD | main 대기열 → 창 준비 → drain (§9) | NEW | — |
| ST-01·02 | ST | §7-A pair | NEW | — |
| AR-01 | AR | main `infra/error-report` → app sink → IPC → renderer bridge (§10) | NEW | — |
| AR-02 | AR | renderer `shared/errors` → 스토어 → `ErrorToastHost`(App.tsx 마운트) | NEW | — |
| AR-03 | AR | 사이트 전환 57곳(renderer 33 + main 24)의 호출 edge | NEW | — |
| IT-01~03 | IT | §7-A pair | NEW | — |
| MD-01 | MD | `errorToastModel` 순수 규칙 | NEW | — |
| MD-02 | MD | `ErrorReportHub` 대기열·ready 집합 | NEW | — |
| MD-03 | MD | scheduler 전이 판정 | NEW | — |
| MD-04 | MD | benign 필터·재귀 가드 | NEW | — |
| UT-01~04 | UT | §7-A pair | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | window `error`/`unhandledrejection` · `process.on` → `reportError` → 로그 + 스토어 | AC1·AC2 테스트 + 사람 실기 1 | not selected — 직접 스토어·sink 관측 | EP-1(2자리: renderer 핸들러 2) · EP-5(2자리: main 핸들러 2) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `reportError` → logger → (main 발) IPC → `presentErrorReport`(로그 없음) | AC3 호출 횟수 · AC9 publish 사용처 고정 | required — (a) main 발 수신에서 renderer 로그 호출 추가(중복 로그) → red, 자리 `mainErrorBridge.ts` (b) 제3 파일에 `publishErrorReport` 추가 → AC9 red | EP-2(4자리) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 레이어별 import → lint | lint green · AC5 vitest | not selected — lint 자체가 방향 오라클 | EP-3(2자리) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 사이트 catch → `reportError` | AC6 레지스트리 33행 · AC7 · AC8 스윕 | required — (a) 임의 TOAST 사이트 1곳의 `reportError` 호출 삭제 → AC6 red (b) EXCLUDE 형태의 새 `.catch(() => undefined)` 1건 추가 → AC8 red (c) 두 TOAST 사이트의 event 이름 맞바꿈 → AC6 red | EP-4(33자리) · EP-8(1자리) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | main 사이트 → `infra/error-report.reportError` | AC9 레지스트리 24행 | required — M-표 1행 호출 삭제 → red | EP-6(24자리) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | `push` → 모델 → 타이머 → `dismiss` | AC10·AC11 | not selected — 순수 결과 직접 단언 | EP-7(3자리: cap·dedupe·cooldown) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | `Scheduler.invoke` catch/success → 전이 판정 → `reportError` | AC12 | not selected | EP-9(2자리: 성공 경로 상태 갱신 · 실패 경로 판정) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | `ErrorToastHost` 렌더 | AC13 소스 단언 + 사람 실기 | not selected — 시각은 사람, 값은 문자열 단언 | EP-10(2자리: 두 테마 스코프) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | main `reportError` → hub(ready 0) → queue → renderer `drain` invoke → 스토어 | AC14 | not selected | EP-11(4자리: enqueue · cooldown · drain · destroyed 제거) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | 전역 핸들러 → benign 필터 / `reportError` try | AC15·AC16 | not selected | EP-12(3자리: benign 필터 · renderer 가드 · main 가드) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | `CHANNELS` → 문서·인벤토리 | 기존 CI 테스트 | not selected | EP-13(1) |
| VP-12 | SD-01 ↔ ST-01 | REQUIRED | renderer 사이트(`chatStore.send` 거부) → `reportError` → 스토어 → Host 렌더 → 4.6초 제거 | 통합 테스트: `chatApi.send` reject 주입 → `DROP_UNCOMMITTED_USER` dispatch 유지 + 스토어 카드 1 + 4600ms 후 0 | not selected | EP-4 중 chatStore 자리 재사용 |
| VP-13 | SD-02 ↔ ST-02 | REQUIRED | main `reportError`(창 없음) → hub → `orca:error:drain` 핸들러 → bridge → 스토어 | 통합: hub + drain 핸들러 함수 + bridge 를 fake IPC로 연결 → 부팅 전 보고 1이 bridge 연결 후 카드 1 | not selected | EP-11 |
| VP-14 | AR-01 ↔ IT-01 | REQUIRED | infra → app sink → `webContents.send(CHANNELS.errorReportEvent)` → preload `error.onReport` → bridge | preload 표면 타입 typecheck + bridge 단위(구독 후 drain 순서, 같은 id 중복 무시) | required — bridge 가 drain 을 구독 **전에** 부르도록 순서 변이 → "drain 중 도착 보고 유실" 테스트 red | EP-14(3자리: sink · preload · bridge) |
| VP-15 | AR-02 ↔ IT-02 | REQUIRED | `App.tsx` → `<ErrorToastHost/>` → 스토어 구독 | 렌더 테스트(renderToStaticMarkup 선례 `*.render.test.ts`): 스토어 카드 2 → `role="alert"` 2 · 제목·설명 텍스트 | not selected | EP-15(1) |
| VP-16 | AR-03 ↔ IT-03 | REQUIRED | = VP-04·VP-05 경로 | AC6·AC7·AC9 | VP-04·05 증거 공유 | EP-4 · EP-6 |
| VP-17 | MD-01 ↔ UT-01 | REQUIRED | `applyErrorReport` | AC10 | not selected | EP-7 |
| VP-18 | MD-02 ↔ UT-02 | REQUIRED | `ErrorReportHub` | AC14 | not selected | EP-11 |
| VP-19 | MD-03 ↔ UT-03 | REQUIRED | 전이 판정 | AC12 | required — 성공 경로의 상태 초기화 삭제 → "성공 후 재실패 보고" red | EP-9 |
| VP-20 | MD-04 ↔ UT-04 | REQUIRED | benign 필터·가드 | AC15·AC16 | not selected | EP-12 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint/typecheck | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 error |
| vitest (비-DB) | 신규·변경 테스트 | `cd app && npx vitest run <변경 테스트 경로>` + 전체 `npx vitest run`(ABI 무관 실패는 분리) | 이번 변경 관련 실패 |
| doc inventory | 채널 추가 | `cd app && node scripts/check-doc-inventory.mjs` | 불일치 |
| trailer | 커밋 프로토콜 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| renderer 로그 진입점 `rendererLog` + 전역 핸들러(로그만) | `app/src/renderer/src/shared/logging.ts:27-46` · 등록 `main.tsx:11` |
| main 전역 핸들러(로그만) | `app/src/main/index.ts:97-104` |
| main 로거 인터페이스: `warn(event,data)` / `error(event,error,data)` · electron 비의존 접근자 `getLogger` | `infra/log/log-manager.ts:15-21` · `infra/log/registry.ts:1-3` |
| main 테스트는 electron 을 import 하면 죽는다 — electron 의존부는 순수부와 파일 분리 | `app/src/main/AGENTS.md §원격 요청` "P29" |
| 브로드캐스트 헬퍼 | `infra/ipc/send.ts` `broadcast()` |
| 전역 오버레이 호스트 선례: imperative store + 셸 1회 마운트 | `shared/ui/confirmDialogStore.ts` · `app/OverlayLayer.tsx:69` |
| 셸(`AppLayout`)은 게이트 통과 후에만 마운트 — 부팅/게이트 화면에도 뜨려면 `App.tsx` 에 마운트 | `App.tsx:11-28` · `app/RootGate.tsx` |
| i18n 키는 `typeof ko` 로 타입 강제 | `shared/i18n/i18next.d.ts` |
| 컴포넌트 토큰은 `@theme` + `[data-theme='dark']` 두 스코프 | `styles/tokens.css:94-109,187` · `renderer/AGENTS.md §스타일` |
| keyframes 선례는 `app.css` 에 있고 reduced-motion 가드 동반 | `styles/app.css:111-210` |
| Modal/Popover z = 50, 디버그 패널 z = 2147483646 | `shared/ui/Modal.tsx:56` · `FloatingPanel.tsx:57` |
| 아이콘 `alert` 존재, 오류 강조색 `text-rust` 관례(15회) | `shared/ui/Icon.tsx:39` · `rg text-rust` |
| 부팅 선택 단계 실패는 `console.warn` 만 | `app/boot/steps.ts:167-176` |
| 채널 문서 강제 | `shared/ipc-documentation.test.ts` · `scripts/check-doc-inventory.mjs` · `docs/IPC_CONTRACT.md:14` 도메인 목록 |

### 전수 조사 — renderer (90 사이트)

검색: `rg -nE "catch *(\([^)]*\))? *\{" renderer/src` (53) + `rg -n "\.catch\(" renderer/src` (37), `*.test.*` 제외. 합 **90 = TOAST 33 + CONSUMED 36 + EXCLUDE 21**.

**TOAST (33)** — `event` 는 새 `reportError` 호출의 로그 이벤트명(= 레지스트리 키), `title` 은 `errors.toast.<title>`.

| # | 사이트 (renderer/src/…) | 레이어 | 현재 | event | title |
|---|---|---|---|---|---|
| T1 | `app/boot/steps.ts:167` (선택 단계 분기만) | app | console.warn | `boot.step.degraded` | `bootStepDegraded` |
| T2 | `app/hooks/useProjectCatalogSync.ts:14` | app | catch→undefined | `projects.refresh.failed` | `loadFailed` |
| T3 | `app/hooks/useProjectCatalogSync.ts:15` | app | catch→undefined | `sessions.project-load.failed` | `loadFailed` |
| T4 | `pages/ProjectLandingPage.tsx:60` | pages | catch→undefined | `projects.retry.failed` | `loadFailed` |
| T5 | `shared/hooks/useSkills.ts:13` | shared | 빈 목록 | `skills.list.load-failed` | `loadFailed` |
| T6 | `shared/stores/agentStore.ts:27` | shared | error 상태(읽는 곳 0) | `agents.list.load-failed` | `loadFailed` |
| T7 | `shared/theme/TweakProvider.tsx:62` | shared | 조용한 롤백 | `settings.tweak.save-failed` | `saveFailed` |
| T8 | `shared/ui/CopyIconButton.tsx:23` | shared | 무시 | `clipboard.copy.failed` | `copyFailed` |
| T9 | `features/chat/components/ChatTitleBar.tsx:118` | features | 무시 | `clipboard.copy.failed` | `copyFailed` |
| T10 | `features/chat/components/CwdButton.tsx:47` | features | console.warn | `files.cwd-action.failed` | `actionFailed` |
| T11 | `features/chat/components/composer/BranchChip.tsx:98` | features | catch→{} | `git.branch-status.failed` | `loadFailed` |
| T12 | `features/chat/components/composer/BranchChip.tsx:115` | features | 빈 목록 | `git.branch-list.failed` | `loadFailed` |
| T13 | `features/chat/components/rightpanel/DiffTileContent.tsx:82` | features | catch→{} | `files.reveal.failed` | `openFailed` |
| T14 | `features/chat/hooks/useAttachments.ts:68` | features | 빈 배열 | `chat.attachment.pick-failed` | `attachFailed` |
| T15 | `features/chat/hooks/useMentionAutocomplete.ts:55` | features | 빈 목록 | `chat.mention.providers-failed` | `loadFailed` |
| T16 | `features/chat/hooks/useMentionAutocomplete.ts:91` | features | 빈 목록 | `chat.mention.entries-failed` | `loadFailed` |
| T17 | `features/chat/store/chatStore.ts:448` (`sendNewChatPayload`) | features | console.error | `chat.new-send.rejected` | `sendFailed` |
| T18 | `features/chat/store/chatStore.ts:978` (`send`) | features | 롤백+console.error | `chat.send.rejected` | `sendFailed` |
| T19 | `features/chat/store/chatStore.ts:1085` | features | console.error | `chat.steer-cancel.rejected` | `actionFailed` |
| T20 | `features/chat/store/chatStore.ts:1096` | features | console.error | `chat.session-discard.rejected` | `actionFailed` |
| T21 | `features/chat/store/chatStore.ts:1407` | features | 세션 drop | `chat.session-load.failed` | `sessionOpenFailed` |
| T22 | `features/debug/hooks/useDebugMock.ts:25` | features | catch→{} | `debug.mock.load-failed` | `loadFailed` |
| T23 | `features/debug/hooks/useDebugMock.ts:36` | features | catch→{} | `debug.mock.save-failed` | `saveFailed` |
| T24 | `features/providers/hooks/useProviderGate.ts:41` | features | catch→undefined | `providers.gate.load-failed` | `loadFailed` |
| T25 | `features/providers/hooks/useProviderPrincipal.ts:25` | features | catch→undefined | `providers.principal.load-failed` | `loadFailed` |
| T26 | `features/providers/store/bypassStore.ts:32` | features | fail-closed | `providers.bypass.load-failed` | `loadFailed` |
| T27 | `features/providers/store/bypassStore.ts:45` | features | 조용한 롤백 | `providers.bypass.save-failed` | `saveFailed` |
| T28 | `features/sessions/components/PinnedProjectsSection.tsx:272` | features | catch→undefined | `sessions.pinned-load.failed` | `loadFailed` |
| T29 | `features/sessions/components/ProjectSessionsPanel.tsx:38` | features | catch→undefined | `sessions.panel-load.failed` | `loadFailed` |
| T30 | `features/sessions/hooks/useProjectSessions.ts:19` | features | catch→undefined | `sessions.project-sessions.failed` | `loadFailed` |
| T31 | `features/settings/hooks/useUpdateCheckSetting.ts:37` | features | 조용한 롤백 | `settings.update-check.save-failed` | `saveFailed` |
| T32 | `features/skills/hooks/useMcpServers.ts:40` | features | 빈 목록 | `mcp.servers.load-failed` | `loadFailed` |
| T33 | `features/skills/hooks/useProviders.ts:40` | features | 빈 목록 | `skills.providers.load-failed` | `loadFailed` |

T8·T9 는 같은 event 를 공유한다 — 레지스트리 키는 `[파일, event]` 쌍이라 유일하다. 같은 파일의 행(T2·T3, T11·T12, T15·T16, T17~T21, T22·T23, T26·T27)은 event 가 서로 다르다.

**CONSUMED (36)** — 이미 화면에 표시. 변경 없음: `app/boot/bootStore.ts:75`(부팅 실패 화면) · `app/hooks/useProjectDeletion.ts:32`(alert) · `features/artifacts/store/artifactCatalogStore.ts:39,65` · `features/backend/components/InstallerDialog.tsx:56` · `BranchChip.tsx:151` · `GitIdentityMenu.tsx:48` · `useGitSnapshot.ts:79`(→`failGitSnapshotQuery`) · `CanonicalBackgroundContent.tsx:209` · `TaskContextContent.tsx:54` · `ForegroundShellActions.tsx:82` · `useArtifactViewerActions.ts:47` · `useDirectoryPicker.ts:79` · `useGitPatch.ts:130` · `artifactStore.ts:139,183,257` · `artifactViewerStore.ts:32` · `backgroundStore.ts:170` · `chatStore.ts:1011,1133,1153,1513`(transcript/상태 표시) · `AgentEnvironmentView.tsx:29` · `EngineFormModal.tsx:91,103` · `useEngines.ts:38` · `EditInstructionsModal.tsx:53` · `ProviderUsageTab.tsx:78` · `CustomMcpModal.tsx:81` · `SkillAuthorModal.tsx:37` · `SkillUploadModal.tsx:25` · `updateStore.ts:83,120,146,158`(`UpdateDialog.tsx:122-124`). 합 36.

**EXCLUDE (21)** — 정상 사용 가능한 폴백 또는 호출자에게 rethrow: `ApprovalCard.tsx:33` · `AskBody.tsx:9` · `features/chat/format.ts:8` · `workToolPresentation.ts:35,172,229` · `taskContext.ts:44` · `imageThumb.ts:23` · `planCommentDom.ts:67,94` · `providerCatalog.ts:107`(검증 결과 반환) · `useAttachments.ts:57,133`(미리보기 썸네일만 누락, 첨부 전송은 유지) · `useDiffSyntax.ts:33` · `CodeBlock.tsx:67,71`(원문 표시) · `BranchChip.tsx:83`(rethrow → T11) · `backendStore.ts:29` · `projectsStore.ts:26` · `sessionsStore.ts:135,213`(rethrow → 호출자 T2·T3·T28~T30·부팅 단계). 합 21.

**AC8 허용목록**(EXCLUDE 중 `.catch(() => 값)` 형태): `useAttachments.ts:57` `.catch(() => null)` · `useAttachments.ts:133` `.catch(() => null)` · `useDiffSyntax.ts:33`·`CodeBlock.tsx:71`(본문 주석만 있는 `.catch(() => { … })`). 스윕 정규식은 §10 EP-8.

### 전수 조사 — main (보고 대상 24)

검색 1: `rg -nE "catch *(\([^)]*\))? *\{" main` **198** · `rg -n "\.catch\(" main` **47** (`*.test.*` 제외). 본문 분류(스크립트 휴리스틱): THROW 45 · RET 98 · STATE 25 · LOG+STATE 1 · SWALLOW 29. THROW/RET 는 호출자에게 실패를 값/예외로 넘긴다(소비는 호출자 몫, IPC 응답·transcript). SWALLOW 29 + `.catch` 47 은 수동 판정: 정리(rm/unlink/close)·경로 탐침(stat/realpath → null)·파싱 폴백·영수증 무시로 **전부 EXCLUDE**(사례: `worktrees/service.ts:220-221`, `features/chat/settle.ts:248-251`, `session-runtime.ts:863` "중단 자체는 이미 발생했다").
검색 2: 사용자 영향 실패를 **로그로만** 흡수하는 지점 — `rg -n "\.(warn|error)\('[a-z]" main`(비테스트) 전수를 읽어 아래 24를 TOAST 로 판정.

| # | 사이트 (app/src/main/…) | 레이어 | 기존 event (유지) | title | 비고 |
|---|---|---|---|---|---|
| M1 | `index.ts:97` | app(root) | `app.unhandled.rejection` | `unexpected` | level error |
| M2 | `index.ts:101` | app(root) | `app.uncaught.exception` | `unexpected` | level error |
| M3 | `index.ts:51` | app(root) | `app.legacy.failed` | `legacyMigrationFailed` | conflict(`:48`)는 정보 — 제외 |
| M4 | `app/bootstrap.ts:229` | app | `mcp.server.skipped` | `mcpServerSkipped` | |
| M5 | `app/bootstrap.ts:243` | app | `extensions.deploy.warning` | `extensionsFailed` | 배포 실패 경로(`:235-236` 주석) |
| M6 | `app/bootstrap.ts:275` | app | `auth.persistence.unavailable` | `authPersistenceUnavailable` | |
| M7 | `app/bootstrap.ts:286` | app | `auth.oauth.persistence.unavailable` | `authPersistenceUnavailable` | |
| M8 | `app/bootstrap.ts:327` | app | `auth.declaration.rejected` | `authDeclarationRejected` | |
| M9 | `app/bootstrap.ts:501` | app | `legacy.worktree.repair.failed` | `legacyMigrationFailed` | |
| M10 | `app/bootstrap.ts:618` | app | `scheduler.settings.failed` | `scheduledJobFailed` | |
| M11 | `app/boot-report.ts:118` (non-critical 실패) | app | `boot.step.failed` | `bootStepDegraded` | critical 은 부팅 실패 화면이 소비 |
| M12 | `app/updater.ts:293` | app | `update.loader.failed` | `updaterUnavailable` | **packaged 에서만** 보고 — 판정은 호출측 주입(§11) |
| M13 | `features/scheduler/scheduler.ts:122` | features | `scheduler.job.failed` | `scheduledJobFailed` | D-009 전이 1회 |
| M14 | `features/harnesses/settings.ts:111` | features | `providers.settings.resolve-failed` | `configInvalid` | |
| M15 | `features/harnesses/settings.ts:160` | features | `providers.settings.parse-failed` | `configInvalid` | |
| M16 | `features/extensions/harness-plugins/claude-user-skills.ts:67` | features | `extensions.plugin.wrapper-failed` | `extensionsFailed` | |
| M17 | `features/chat/turn-coordinator.ts:143` | features | `chat.turn-event.emit-failed` | `eventDeliveryFailed` | settle 단계 |
| M17b | `app/chat-turn/index.ts:54` | app | `chat.turn-event.emit-failed` | `eventDeliveryFailed` | 격리 emit |
| M18 | `features/sessions/session-runtime.ts:786` | features | `engine.channel.retirement-observer.failed` | `engineInternal` | |
| M19 | `adapters/claude-settings.ts:36` | adapters | `providers.settings.parse-failed` | `configInvalid` | |
| M20 | `adapters/claude-adapt.ts:224` | adapters | `engine.steer.submit-rejected` | `steerFailed` | 롤백 유지 |
| M21 | `adapters/claude-adapt.ts:235` | adapters | `engine.steer.flush-failed` | `steerFailed` | 롤백 유지 |
| M22 | `infra/config/orca-config.ts:11,24` | infra | `config.orca.invalid` · `config.orca.load-failed` | `configInvalid` | 경고 N개는 보고 1회로 합침(detail 첫 경고 + `외 N`) |
| M23 | `infra/bus/index.ts:61` | infra | `bus.listener.failed` | `eventDeliveryFailed` | |

main 대상 = **24 자리**(M1~M23 + M17b). AC9 레지스트리는 24행이다.
제외한 로그 전용 지점(근거): `index.ts:108,116`(창/자식 프로세스 소멸 — toast 표면 자체가 없음) · `index.ts:215-225`(preload/로드 실패 — 같음) · `index.ts:284`(renderer main-ready 실패 UX 가 소비) · `bootstrap.ts:346`(게이트 UI 가 소비) · `bootstrap.ts:420`(데이터 위생) · `bootstrap.ts:825`(종료 중) · `title-generation.ts:81`(기본 제목 폴백) · `turn-coordinator.ts:292`(원 실패가 이미 transcript) · `updater.ts:140-200`(업데이트 UI 상태로 소비) · `deployer.ts:171`(덮어쓰기로 계속) · `auth/*` 정리 실패(위생).

### 수치 / 전칭 표현 검산

- renderer: 53 + 37 = 90 = 33 + 36 + 21 ✓.
- main 휴리스틱 분류: 45+98+25+1+29 = 198 ✓(`catch{}` 만. `.catch` 47 별도).
- main 보고 자리: M1~M23(23) + M17b(1) = 24.
- "toast 구현 0건": `rg -in toast app/src/renderer/src --glob '!*.test.*'` → 주석 2건만.
- 문서 앵커: `app/AGENTS.md` "### better-sqlite3 ABI · 제약 환경 게이트 가이드" 존재(`:112`) · `observability.md` "## 5. 이벤트 카탈로그" 존재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- 관련 V node: SD-01, SD-02, AR-01, AR-02
- 책임 소유자: 각 사이트가 개별로 삼키거나 로그. 전역은 로그만.

```text
renderer 사이트 ─ .catch(() => undefined) ─→ (없음)
renderer uncaught ─ window error ─→ rendererLog.error ─→ orca:log:emit ─→ main 파일 로그
main 사이트 ─ getLogger().warn(...) ─→ 파일 로그
main uncaught ─ process.on ─→ rootLog.error + flushLogSync
```

- 문제의 직접 원인: 사용자에게 도달하는 오류 표면이 없다.

### TO-BE

- 관련 V node: SD-01, SD-02, AR-01, AR-02, AR-03
- 책임 소유자: renderer = `shared/errors/`, main = `infra/error-report/`(순수·electron 비의존) + `app/error-report-sink.ts`(electron 배선).

```text
[renderer 사이트/전역] → shared/errors/reportError
     → rendererLog.error(event, scope, error)          (로그 1)
     → errorToastStore.push(report{origin:'renderer'})  → ErrorToastHost(App.tsx)

[main 사이트/전역] → infra/error-report.reportError
     → getLogger().child(scope)[level](event, …)        (로그 1)
     → ErrorReportHub.publish(report{origin:'main'})
          ├ ready 창 ≥1 → sink(report) → webContents.send(orca:error:reportEvent)
          └ ready 창 0  → pending 큐(최대 10)
renderer main.tsx → connectMainErrorReports():
     1) window.orca.error.onReport(presentErrorReport)   (구독 먼저)
     2) window.orca.error.drain() → invoke orca:error:drain → hub.markReady(wc) → pending 반환·비움
     → presentErrorReport(report)  (로그 없음, 같은 id 1회만)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 사이트별 삼킴 | 두 `reportError` 가 로그+게시를 소유 | D-002·D-003 | AR-01·AR-02 / VP-14·15 · §11 |
| data/control flow | 로그만 | 로그 + toast(main 발은 IPC) | D-001·D-005 | SD-01 / VP-12 |
| state/contract | 없음 | `AppErrorReport`·`AppErrorTitle`(src/shared) · 채널 2 | 공개 계약 | AR-01 / VP-11·14 |
| error/lifecycle | 부팅 초기 main 오류는 로그뿐 | hub 대기열 → drain | R-09 | SD-02 / VP-13·18 |
| test seam | 없음 | 순수 모델·hub·전이 판정 분리 파일 | 테스트 가능성 | MD-01~04 / VP-17~20 |
| 사이트 | 57 자리 조용함(renderer 33·main 24, main 전역 2 포함) | 전부 `reportError`(M13·M22 는 `publishErrorReport`) | D-004 | AR-03 / VP-04·05 |

AS-IS 책임 중 사라지는 것: `registerGlobalErrorLogging` → `registerGlobalErrorHandlers` 로 **대체**(로그 + toast). 전환 사이트의 기존 `log.warn`·`console.*` 호출은 `reportError` 로 **대체**(같은 event 이름 유지 — main). 폴백 동작(빈 목록·롤백·fail-closed)은 **유지**.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/app-error.ts` | 계약 SSOT: `AppErrorTitle` union·`APP_ERROR_TITLES`·`AppErrorReport`·상수(`APP_ERROR_DETAIL_MAX=300`, `APP_ERROR_PENDING_MAX=10`) | 타입/상수 | main·preload·renderer |
| `main/infra/error-report/hub.ts` | 순수: 대기열·ready 집합·sink 호출 | `publish`·`markReady`·`forget` | `index.ts` |
| `main/infra/error-report/index.ts` | `reportError(input)` = 로그 + hub.publish, 가드. `setErrorReportSink`, `errorReportHub` 싱글턴 | — | main 전 레이어 |
| `main/app/error-report-sink.ts` | electron 배선: sink = `webContents.fromId(id)?.send` / destroyed 시 `forget` | — | `index.ts`(부팅 초기) |
| `main/app/handlers/error.ts` | `orca:error:drain` invoke 핸들러: `markReady(sender)` → pending 반환 | — | handlers 등록부 |
| `preload/index.ts` | `error.onReport(handler)` · `error.drain()` | — | renderer bridge |
| `renderer/src/shared/errors/errorToastModel.ts` | 순수 규칙(cap·dedupe·cooldown·seq) | state × report × now → state | store |
| `renderer/src/shared/errors/errorToastStore.ts` | zustand + 만료 타이머 | `push`·`dismiss` | reportError·Host |
| `renderer/src/shared/errors/reportError.ts` | `reportError`(로그+push) · `presentErrorReport`(push만) · 가드 | — | renderer 전 레이어 |
| `renderer/src/shared/errors/globalHandlers.ts` | `registerGlobalErrorHandlers`·`isBenignWindowError` | — | `main.tsx` |
| `renderer/src/shared/errors/mainErrorBridge.ts` | `connectMainErrorReports` (구독→drain, id 중복 제거) | — | `main.tsx` |
| `renderer/src/shared/ui/ErrorToastHost.tsx` | 카드 렌더 | 스토어 | `App.tsx` |

## 10. 계약 / 타입 / 강제 지점

```ts
// src/shared/app-error.ts
export const APP_ERROR_TITLES = [
  'unexpected', 'loadFailed', 'saveFailed', 'actionFailed', 'copyFailed', 'openFailed',
  'attachFailed', 'sendFailed', 'sessionOpenFailed', 'bootStepDegraded', 'legacyMigrationFailed',
  'mcpServerSkipped', 'extensionsFailed', 'authPersistenceUnavailable', 'authDeclarationRejected',
  'scheduledJobFailed', 'updaterUnavailable', 'configInvalid', 'eventDeliveryFailed',
  'engineInternal', 'steerFailed'
] as const
export type AppErrorTitle = (typeof APP_ERROR_TITLES)[number]
export interface AppErrorReport {
  id: string                 // 보고마다 유일(crypto.randomUUID)
  title: AppErrorTitle
  detail?: string            // ≤ APP_ERROR_DETAIL_MAX, 초과는 '…' 로 절단
  origin: 'main' | 'renderer'
}

// main/infra/error-report/index.ts
export interface MainErrorReportInput {
  event: string              // LOG_EVENT_PATTERN, 기존 사이트는 기존 이름 유지
  scope: string              // getLogger().child(scope)
  title: AppErrorTitle
  error?: unknown
  detail?: string | null     // undefined → errorMessage(error) (error 없으면 설명 없음), null → 설명 없음
  data?: Record<string, unknown>
  level?: 'error' | 'warn'   // 기본 'error'. warn 은 data.message 에 errorMessage 를 싣는다
}
export function reportError(input: MainErrorReportInput): void
// 로그 없이 게시만. **같은 블록에서 같은 실패를 이미 로그한 호출자 전용**(M13 전이 보고 · M22 경고 합산).
// 그 밖의 호출은 금지 — 레지스트리 테스트가 사용처를 M13·M22 두 파일로 고정한다.
export function publishErrorReport(input: { title: AppErrorTitle; detail?: string | null }): void

// renderer/src/shared/errors/reportError.ts
export function reportError(input: {
  event: string; scope: string; title: AppErrorTitle; error?: unknown;
  detail?: string | null; data?: Record<string, unknown>
}): void
export function presentErrorReport(report: AppErrorReport): void
```

채널: `orca:error:reportEvent`(M→R send, `AppErrorReport`) · `orca:error:drain`(R→M invoke, 인자 없음 → `AppErrorReport[]`). 새 도메인 `error`.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-02 / VP-01 | EP-1 renderer 전역 2자리 | `globalHandlers.ts` | 등록 | `main.tsx` 부팅 | uncaught 가 로그만 |
| AR-01·02 / VP-02 | EP-2 로그 동반 4자리: renderer `reportError`(로그 먼저) · main `reportError`(로그 먼저) · `presentErrorReport`(로그 금지) · `publishErrorReport` 사용처 = scheduler·orca-config 2파일(각 블록에 로그 호출 동반) | 두 `reportError` · 레지스트리 | 구현·CI | 호출 시·테스트 | toast 만 있고 로그 없음 / 이중 로그 |
| AR-03 / VP-03 | EP-3 import 방향 2자리: renderer `shared/errors` · main `infra/error-report`(electron import 금지) | eslint boundaries · vitest | lint·CI | 빌드 | 레이어에서 호출 불가 / feature 테스트 사망 |
| AR-03 / VP-04 | EP-4 renderer T1~T33(33자리) | 레지스트리 테스트 표 | CI | 테스트 | 사이트 조용함 회귀 |
| AR-01 / VP-01 | EP-5 main 전역 2자리 `index.ts:97,101` | `index.ts` | 부팅 | 프로세스 시작 | main uncaught 무표시 |
| AR-03 / VP-05 | EP-6 main M1~M23 + M17b(24자리) | 레지스트리 테스트 표 | CI | 테스트 | 사이트 조용함 회귀 |
| MD-01 / VP-06·17 | EP-7 cap 3 · dedupe 키 `title\0detail` · cooldown 1000ms | `errorToastModel.ts` 상수 | 모델 | push | 폭주·루프 |
| AR-03 / VP-04 | EP-8 음성 스윕(값 반환·주석뿐인 본문 형태만 본다 — setter 로 삼키는 형태는 AC6·AC7 레지스트리가 기존 90 사이트만 잠근다): 정규식 `\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(undefined\|null\|\[\]\|\{\s*\}\|\{\s*//[^\n]*\n\s*\})\s*\)` 매치 파일:줄 집합 = 허용목록 | 스윕 테스트 | CI | 테스트 | 새 조용한 삼킴 |
| MD-03 / VP-07·19 | EP-9 전이 2자리: 성공 시 `lastFailed.delete(key)` · 실패 시 `if (!lastFailed.has(key)) report` 후 add | `scheduler.ts` | Scheduler | invoke | 폭주 / 재실패 누락 |
| R-08 / VP-08 | EP-10 토큰 2자리: `@theme` 기본(라이트) · `[data-theme='dark']` | `tokens.css` | CSS | 테마 전환 | 한 테마 깨짐 |
| MD-02 / VP-09·13·18 | EP-11 hub 4자리: publish(ready 0→enqueue, 최대 10 FIFO 버림) · publish cooldown(같은 `title\0detail` 1000ms 내 재게시 무시) · markReady(반환·비움) · forget(destroyed) | `hub.ts` | hub | 호출 | 부팅 오류 유실 / IPC 폭주 |
| MD-04 / VP-10·20 | EP-12 3자리: `isBenignWindowError`(메시지가 `ResizeObserver loop` 로 시작) · renderer `reportError` try/catch(실패 시 로그만) · main `reportError` try/catch | 각 파일 | 구현 | 호출 | 가짜 toast / 재귀 |
| R-11 / VP-11 | EP-13 채널·도메인 문서 | `ipc.ts` | CI | 테스트 | 문서 불일치 |
| AR-01 / VP-14 | EP-14 전달 3자리: app sink send · preload `error.*` · bridge(구독 → drain, `seen` id 집합) | 각 파일 | 부팅 | 창 로드 | 유실 / 중복 |
| AR-02 / VP-15 | EP-15 `App.tsx` 에 `<ErrorToastHost/>` 1회 마운트(`RootGate` 형제, `TweakProvider` 안) | `App.tsx` | 렌더 | 앱 시작 | 부팅·게이트 화면에서 미표시 |

- 같은 규칙의 SSOT: 제목 목록은 `APP_ERROR_TITLES` 하나. `ko.ts`/`en.ts` 의 `errors.toast` 는 `satisfies Record<AppErrorTitle, string>` 으로 누락을 컴파일 에러로 만든다.
- `detail` 의미: `undefined` = 오류 메시지 사용, `null` = 설명 줄 없음(secret 가능성 있는 호출자용), 문자열 = 그대로.
- `실패 의미` 에 "다른 게이트가 막는다" 기재: 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/app-error.ts` (신규) | 계약 | §10 | 타입 |
| `app/src/shared/ipc.ts` | 채널 | `errorReportEvent: 'orca:error:reportEvent'`, `errorDrain: 'orca:error:drain'` | ipc-documentation.test |
| `app/src/main/infra/error-report/hub.ts` (신규) | 순수 hub | `class ErrorReportHub { publish(r); markReady(id): AppErrorReport[]; forget(id); setSink(fn) }` ready = `Set<number>`(webContents id) | `hub.test.ts` |
| `app/src/main/infra/error-report/index.ts` (신규) | 보고 API | 로그(level별) → `truncate(detail)` → `hub.publish`. 전체 try/catch(실패 시 로그만). electron import 금지 | `index.test.ts`(logger·sink fake) |
| `app/src/main/app/error-report-sink.ts` (신규) | electron 배선 | `installErrorReportSink()`: sink = ready id 별 `webContents.fromId(id)` 가 살아 있으면 send, 아니면 `forget` | 사람 실기(AC2) |
| `app/src/main/app/handlers/error.ts` (신규) | drain 핸들러 | `ipcMain.handle(errorDrain)`: `hub.markReady(event.sender.id)` + `sender.once('destroyed', () => hub.forget(id))` → pending 반환 | 핸들러 함수 단위(ST-02) |
| `app/src/main/index.ts` | 전역·설치 | `installErrorReportSink()` 를 `process.on` 등록 전에 호출. `:97,:101` → `reportError({event, scope:'app', title:'unexpected', error})` 후 `flushLogSync()` 유지. `:51` → M3 | 레지스트리 |
| `app/src/main/app/bootstrap.ts` | M4~M10 | 각 `log.warn(...)` → `reportError({ event: 기존, scope: 기존 child, level:'warn', data: 기존 data, title })` | 레지스트리 |
| `app/src/main/app/boot-report.ts` | M11 | `:118` 분기에서 `reportError(level:'warn', title:'bootStepDegraded', detail: \`${id}: ${message}\`)` | 기존 `boot-report.test.ts` 보강 |
| `app/src/main/app/updater.ts` | M12 | `loadElectronAutoUpdater(options?: { reportUnavailable?: boolean })` — true 일 때만 `reportError`, 아니면 기존 warn. 호출측(bootstrap)이 `app.isPackaged` 주입 | 단위 |
| `app/src/main/features/scheduler/scheduler.ts` | M13·D-009 | `private readonly failing = new Set<string>()`; 성공 경로 `failing.delete(key)`; 실패 경로 기존 `scheduler.job.failed` error 로그 유지 + `if (!failing.has(key)) { failing.add(key); publishErrorReport({ title:'scheduledJobFailed', detail: \`${key}: ${errorMessage(e)}\` }) }`. 로그는 매 실패, 게시는 전이 1회 — 게시되는 실패는 항상 같은 블록에서 로그된다 | `scheduler.test.ts` 추가 |
| `app/src/main/features/{harnesses/settings.ts,extensions/harness-plugins/claude-user-skills.ts,chat/turn-coordinator.ts,sessions/session-runtime.ts}` | M14~M18 | log 호출 → `reportError`(기존 event·data 유지) | 레지스트리 |
| `app/src/main/app/chat-turn/index.ts` | M17b | 동일 | 레지스트리 |
| `app/src/main/adapters/{claude-settings.ts,claude-adapt.ts}` | M19~M21 | 동일(롤백 유지) | 레지스트리 |
| `app/src/main/infra/{config/orca-config.ts,bus/index.ts}` | M22·M23 | orca-config: 경고별 warn 로그는 유지하고 **보고 1회**(`publishErrorReport`, detail = 첫 경고 + ` 외 N건`) · load-failed 는 `reportError`. bus: `reportError` | 레지스트리 |
| `app/src/main/error-report.registry.test.ts` (신규) | AC9 | 24행 `[파일, event]` → 파일 소스에 `reportError(` 호출과 인자 `event: '<name>'`. M13·M22 는 `publishErrorReport(` 호출 + 같은 함수 안 해당 event 로그 호출. `publishErrorReport(` 사용 파일 집합 = {scheduler.ts, orca-config.ts} | 소스 스캔 |
| `app/src/preload/index.ts` · `renderer/src/env.d.ts` | 표면 | `error: { onReport(h): () => void; drain(): Promise<AppErrorReport[]> }` | typecheck |
| `renderer/src/shared/errors/errorToastModel.ts` (신규) | 순수 | `ERROR_TOAST_MAX=3`, `ERROR_TOAST_DURATION_MS=4600`, `ERROR_TOAST_COOLDOWN_MS=1000`; `applyErrorReport(state, report, now)` → `{ state, expire: {id, at}[] }` | `errorToastModel.test.ts` |
| `renderer/src/shared/errors/errorToastStore.ts` (신규) | 스토어 | zustand `{ toasts: {id,key,title,detail,seq,lastHitAt}[] }` + 카드별 `setTimeout` 재설정/해제 | fake timer |
| `renderer/src/shared/errors/reportError.ts` (신규) | API | `reportError`: `rendererLog.error(event, scope, error, data)` → push(origin renderer). `presentErrorReport`: push 만. 둘 다 try/catch | 단위 |
| `renderer/src/shared/errors/globalHandlers.ts` (신규) | 전역 | `registerGlobalErrorHandlers()`: benign 이면 return; 아니면 `reportError({event:'renderer.uncaught.error'|'renderer.unhandled.rejection', scope:'renderer', title:'unexpected', …})` | 단위 |
| `renderer/src/shared/errors/mainErrorBridge.ts` (신규) | 브리지 | `connectMainErrorReports(api = window.orca?.error)`: api 없으면 no-op; 구독 → `await drain()` → 각각 `present`(seen id 로 1회) | 단위(fake api) |
| `renderer/src/shared/errors/index.ts` (신규) | barrel | 공개 export | — |
| `renderer/src/shared/logging.ts` | 정리 | `registerGlobalErrorLogging` 삭제(→ globalHandlers). `rendererLog`·`toSerializedError` 유지 | — |
| `renderer/src/main.tsx` | 등록 | `registerGlobalErrorHandlers(); void connectMainErrorReports()` | — |
| `renderer/src/App.tsx` | 마운트 | `<RootGate />` 뒤 `<ErrorToastHost />` | 렌더 테스트 |
| `renderer/src/shared/ui/ErrorToastHost.tsx` (신규) | UI | 아래 클래스 계약 | `ErrorToastHost.render.test.ts` |
| `renderer/src/styles/tokens.css` | 토큰·keyframes | 아래 표 + `@theme` 안 `--animate-error-toast: error-toast 4.6s cubic-bezier(.2,.75,.2,1) both;` 와 `@keyframes error-toast`(스펙 §6 4 스톱) | 소스 단언 |
| `renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | `errors.toast.<title>` 21키 `satisfies Record<AppErrorTitle,string>` | typecheck |
| TOAST 사이트 T1~T33 | 전환 | 폴백 유지 + `reportError({event, scope, title, error})` | 레지스트리 |
| `renderer/src/shared/errors/reportSites.registry.test.ts` (신규) | AC6·AC7·AC8 | T 33행 · CONSUMED/EXCLUDE 57행(해당 catch 본문에 `reportError(` 없음) · EP-8 스윕 | 소스 스캔(`shared/ui/sourceScan.testlib.ts` 재사용 검토) |
| `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` · `docs/arch/backend/observability.md` | 문서 | 채널 2행·도메인 `error` 추가 · 인벤토리 재생성 · §"오류 보고(toast)" 절 신설(API·로그 동반 규칙·대기열) | CI |

### 카드 클래스 계약 (`ErrorToastHost.tsx`)

- 컨테이너: `pointer-events-none fixed right-[28px] top-[38px] z-[60] flex w-[min(480px,calc(100vw-56px))] flex-col gap-2 max-sm:right-[14px] max-sm:w-[calc(100vw-28px)]`
- 카드: `pointer-events-auto grid grid-cols-[34px_1fr_24px] gap-[10px] rounded-[13px] border border-toast-border bg-toast-bg py-[13px] pl-[14px] pr-[13px] shadow-[var(--shadow-toast)] animate-error-toast motion-reduce:animate-none [font-family:var(--font-app)]`, `role="alert"`, `key={`${id}:${seq}`}`(재시작 시 애니메이션 재생)
- 아이콘 칸: `grid size-[30px] place-items-center rounded-[8px] border border-toast-icon-border text-rust` + `<Icon name="alert" />`
- 제목: `text-[13.5px] font-[620] leading-[1.35] text-toast-title` · 설명: `mt-[3px] text-[12.5px] leading-[1.4] text-toast-desc [overflow-wrap:anywhere]`
- 닫기: `<button aria-label={tr('common.close')}>` `text-[18px] leading-none text-toast-close`, `×`
- 최신 카드가 위: 스토어 배열은 최신 먼저.

### 토큰 (D-006)

| 토큰 | 라이트(`@theme`) | 다크(`[data-theme='dark']`, 스펙) |
|---|---|---|
| `--color-toast-bg` | `var(--color-panel)` | `#292725` |
| `--color-toast-border` | `color-mix(in srgb, var(--color-ink-900) 10%, transparent)` | `rgb(255 255 255 / 0.10)` |
| `--color-toast-icon-border` | `color-mix(in srgb, var(--color-ink-900) 13%, transparent)` | `rgb(255 255 255 / 0.13)` |
| `--color-toast-title` | `var(--color-ink)` | `var(--color-ink)` → **재정의하지 않음**(alias) |
| `--color-toast-desc` | `var(--color-ink2)` | `#aaa49d` |
| `--color-toast-close` | `var(--color-ink3)` | `#928c86` |
| `--shadow-toast` | `0 12px 34px color-mix(in srgb, black 12%, transparent)` | `0 12px 34px rgb(0 0 0 / 0.35)` |

라이트 값은 기존 `--color-floating-panel-*`(`tokens.css:94-109`)와 같은 `ink-900 × %` 파생 규칙을 따른다(Orca 스타일). `--color-toast-title` 은 alias 라 `tokens.css:48,68` 규칙대로 dark 스코프에 재정의하지 않는다.

### 테스트 가능성

- electron 분리: `infra/error-report/{hub,index}.ts` electron import 0 — `app/error-report-sink.ts`·`handlers/error.ts` 만 electron.
- 대표 행동 테스트(AC6 보강 4건): T7 TweakProvider 롤백+보고 · T17 chatStore send 거부(VP-12) · T21 세션 로드 실패 drop+보고 · T27 bypassStore 저장 실패 롤백+보고.
- 순서 관측: bridge 테스트는 fake api 의 `onReport`·`drain` 호출 순서 배열을 단언.

## 12. End-to-end 영향

```text
producer(사이트/전역) → reportError(로그 + AppErrorReport) → [main: hub→IPC→bridge] → store → ErrorToastHost
```

- producer 기준: 제목은 `AppErrorTitle`(카탈로그 키), 설명은 원문 오류 메시지 절단본.
- consumer 파생: Host 는 `tr(\`errors.toast.${title}\`)` 와 `detail` 만 렌더. 문구 합성 없음.

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| 전환 사이트의 폴백(빈 목록·롤백·fail-closed·drop) | 유지 | AC6(대표 4건이 폴백 결과도 단언) |
| main 로그 event 이름 | 유지(level 유지) | AC9 |
| renderer 전역 로그 event 이름 | 유지 | AC1 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: main `installErrorReportSink()` 는 `process.on` 등록 전(부팅 최초). renderer 는 `main.tsx` 첫 렌더 전 등록.
- 종료/renderer-gone: `destroyed` → `hub.forget(id)`. 모든 ready 창이 사라지면 이후 보고는 대기열.
- retry/timeout/partial failure: 해당 없음(보고는 fire-and-forget).
- 재귀: 보고 경로 예외는 try/catch 로 로그만(EP-12). 같은 키 1초 cooldown 이 렌더 루프를 끊는다.
- 다중 저장소 쓰기: 로그 파일 + renderer 스토어. 로그를 **먼저** 쓴다 — 게시가 실패해도 로그는 남는다(D-002 방향). 반대(표시만 되고 로그 없음)는 순서로 배제.

## 14. 성능 / 상한 / 최적화

- 화면 상한: 카드 3 × 설명 300자.
- main 대기열 상한 10(메모리 무시 가능).
- 폭주 원천: bus 격리 구독자 실패는 이벤트당 1회 발생 가능 → renderer cooldown 1초 + 병합으로 화면 1장. IPC push 는 이벤트당 1회(스트리밍 중 초당 수십) — main 측에도 같은 키 1초 cooldown 을 hub 에 둔다(EP-11 publish 에 포함: 같은 `title\0detail` 1초 내 재게시 무시, 로그는 유지).

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음(외부 구현자 없음). 내부 공개 계약은 IPC 채널 2 — `IPC_CONTRACT.md` 갱신.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0186 D23 수동 사용량 동기화 실패는 그 화면에서만 | `ProviderUsageTab.tsx:53-55` | §8 CONSUMED | 유지(수동 경로 불변). 주기 `usage-fetch` 는 D-009 로 전이 1회 toast — 별도 경로 |
| 0123 renderer 로그 인제스트·전역 에러 훅 | `shared/logging.ts:35` | §11 `registerGlobalErrorLogging` 대체 | 변경 — 로그 event 이름 유지, toast 추가 |
| 0124 이벤트 명명 `<domain>.<op>.<state>` | `shared/logging.ts:48-50` | §8 새 event | 유지(전부 패턴 적합) |
| renderer "새 CSS 규칙 추가 금지 — Tailwind 유틸로" | `renderer/AGENTS.md §스타일` | §11 keyframes | 유지 — `@theme` 의 `--animate-*`+`@keyframes` 는 Tailwind v4 테마 확장(유틸 `animate-error-toast` 생성)이라 규칙 대상 아님 |
| 토큰 두 스코프 · alias 재정의 금지 | `tokens.css:48,68` | §11 토큰 표 | 유지 |
| feature 교차 import 금지 | 두 AGENTS | §9 모듈 위치 shared/infra | 유지 |
| 0181 electron 모듈 분리(P29) | `main/AGENTS.md` | §11 electron 분리 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 스트리밍 중 격리 구독자 반복 실패로 IPC 폭주 | hub cooldown(§14) |
| 오류 메시지에 경로 등 민감 문자열 | 로컬 사용자 본인 화면. secret 가능 호출자는 `detail:null`(현 대상 24 중 해당 0 — auth 정리 실패는 대상 아님) |
| React 렌더 오류가 Host 자체에서 날 때 | cooldown + try/catch. ErrorBoundary 는 비범위 |
| dev 에서 `update.loader.failed` 매 실행 toast | packaged 에서만 보고(M12) |

- 되돌리기 어려운 결정: 채널 이름 `orca:error:reportEvent`·`orca:error:drain`, 도메인 `error`.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{app-error.ts,ipc.ts}` · `app/src/preload/index.ts` · `app/src/renderer/src/env.d.ts`
- `app/src/main/{index.ts, infra/error-report/*, app/error-report-sink.ts, app/handlers/error.ts, app/bootstrap.ts, app/boot-report.ts, app/updater.ts, app/chat-turn/index.ts, features/scheduler/scheduler.ts, features/harnesses/settings.ts, features/extensions/harness-plugins/claude-user-skills.ts, features/chat/turn-coordinator.ts, features/sessions/session-runtime.ts, adapters/claude-settings.ts, adapters/claude-adapt.ts, infra/config/orca-config.ts, infra/bus/index.ts}` (+ handlers 등록부)
- `app/src/renderer/src/{main.tsx, App.tsx, shared/errors/*, shared/ui/ErrorToastHost.tsx, shared/logging.ts, styles/tokens.css, shared/i18n/resources/{ko,en}.ts}` + T1~T33 사이트 파일
- `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` · `docs/arch/backend/observability.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `cd app && npx vitest run src/shared src/main/infra/error-report src/main/features/scheduler src/main/app src/renderer/src/shared/errors src/renderer/src/shared/ui` 후 전체 `npx vitest run`(ABI 기인 실패 분리)
- 인벤토리: `cd app && node scripts/check-doc-inventory.mjs`(필요 시 생성 모드로 갱신 — 스크립트 사용법 따름)
- 사람 실기: (1) 두 테마에서 toast 시각(AC13) (2) main 강제 예외 → 창 toast(AC2).

## READY self-review

- [x] Decision Ledger 가 1턴 결정(명시 4 + 질의 4 + 설계 1)을 보존한다.
- [x] Part I 만으로 완료 상태가 이해된다.
- [x] 조건절 원문 인용: "(transcript에서 표시되는 에러/예외는 소비가 맞다)" → D-001·CONSUMED 분류.
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design 연결(§7-A 경로 칸).
- [x] AS-IS/TO-BE 같은 축, Delta 각 행이 §11 파일로 추적된다.
- [x] 수치 실측: renderer 90=33+36+21, main 198/47, 보고 자리 24.
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로를 가진다. 사람 실기는 시각·실제 main 예외 2건만.
- [x] Baseline V, 모든 NEW node 에 같은 레벨 REQUIRED pair.
- [x] "X가 쓰인다" 불변식(사이트 전환)은 호출 삭제 시 red(VP-04 a·VP-05), 형제 맞바꿈 시 red(VP-04 c). 음성 스윕(AC8)은 양성 레지스트리(AC6)와 짝.
- [x] 정책 파라미터 단위: ms·개수·문자 수 명시.
- [x] 신규 모듈마다 레이어·강제 지점·테스트 seam.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 기록.

---

## ΔV1 — 사용자 스타일 정정 (r1, 2026-09-27)

**READY.** 사용자 정정에 따라 D-006을 D-010으로 대체한다. 이 절은 V1의 AC13·VP-08·EP-10·§11 토큰 표와 keyframes 설명을 대체하며 나머지 V1 계약은 유지한다.

| Node / pair | provenance / requiredness | 유효 계약 / 직접 oracle | 경로 / 강제 지점 |
|---|---|---|---|
| R-08 ↔ AT-08 / VP-08 | CHANGED / REQUIRED | AC13: 두 테마에서 Orca surface·ink·rust·앱 폰트를 사용한다. 아래 토큰·keyframes 소스 단언 + 두 테마 시각 실기 | `tokens.css` → `ErrorToastHost` / EP-10 두 테마 |
| AR-02 ↔ IT-02 / VP-15 | INHERITED / REGRESSION | V1 카드 렌더·제목·설명 oracle 유지 | `App.tsx` → Host → store / EP-15 |

V1 구현도 이번 턴에 수행하므로 그 밖의 REQUIRED pair는 전부 유지한다. 새 모듈·상태 전이·IPC 변경은 없으며 선택 적대 증거도 V1 그대로다.

| 토큰 | 라이트 `@theme` | 다크 |
|---|---|---|
| `--color-toast-bg` | `var(--color-panel)` | alias 상속 |
| `--color-toast-border` | `var(--color-border)` | alias 상속 |
| `--color-toast-icon-border` | `var(--color-border-strong)` | alias 상속 |
| `--color-toast-title` | `var(--color-ink)` | alias 상속 |
| `--color-toast-desc` | `var(--color-ink2)` | alias 상속 |
| `--color-toast-close` | `var(--color-ink3)` | alias 상속 |
| `--shadow-toast` | `0 12px 34px color-mix(in srgb, black 12%, transparent)` | `0 12px 34px rgb(0 0 0 / 0.35)` |

Alias는 `tokens.css` 기존 규칙에 따라 다크에서 중복 선언하지 않는다. `--font-app`·`text-rust`·카드 배치/크기/타이포는 V1 §11을 유지한다.

| `error-toast` 스톱 | opacity | transform |
|---|---|---|
| 0% | 0 | `translateY(-6px) scale(.992)` |
| 4% | 1 | `translateY(0) scale(1)` |
| 86% | 1 | `translateY(0) scale(1)` |
| 100% | 0 | `translateY(-3px) scale(.996)` |

출처는 이번 사용자 §6 원문이다. 전체 `4.6s cubic-bezier(.2,.75,.2,1) both`, reduced-motion·타이머 수명은 유지한다.

**정합성 확인:** ACTIVE D-001~005·007~010 ↔ AC1~17 충돌 0(AC13만 위 기준으로 대체). V1 어휘의 “다크 스펙 값”·D-006 인용은 위 supersede 관계로 읽고, EP-10은 alias가 참조하는 실제 다크 토큰까지 검증한다.

## ΔV2 — 파일 불가 사유는 동작 시 toast로 (2026-09-28)

**READY.** D-011·D-012를 추가한다. 기준은 V1+ΔV1(r1 PASS). 이 절은 V1 §8 CONSUMED 중 catch 2자리(T34·T35)를 TOAST로 바꾸고, 결과값으로 실패가 오는 경로 2곳(카드 동작 결과·미리보기 결과)과 카드 선제 표시를 아래대로 바꾼다. 나머지 V1·ΔV1 계약은 유지한다.

### 범위

| 표면 (renderer/src/features/chat/…) | AS-IS | TO-BE |
|---|---|---|
| `components/ArtifactCard.tsx` (transcript·우측 패널 list 공용) | 확인 중/`chat.artifacts.missing`/`unavailable` 상태 줄 + 새로 고침 버튼·메뉴, `!present` 면 다운로드·저장·위치 열기·휴지통 비활성 | 상태 줄은 busy(`working`)만. 새로 고침 버튼·메뉴 제거. 비활성은 busy만 |
| `components/ArtifactCards.tsx` | 동작 결과 이슈를 카드 아래 `role=status` 목록으로 표시 | 이슈마다 toast 1건, 인라인 목록 제거 |
| `store/artifactViewerStore.ts` `readSelection` | unavailable 결과를 뷰어 본문(아이콘+사유+재시도)으로 표시 | `unsupported-format` 외 unavailable 이면 뷰어를 닫고 toast. `unsupported-format` 본문은 유지(접근 불가가 아니라 형식) |
| `hooks/useArtifactViewerActions.ts` | 복사·다운로드 실패를 뷰어 상단 status 줄에 표시 | 실패는 toast, status 줄은 진행·성공(복사됨·저장됨·취소됨)만 |
| `components/rightpanel/TaskContextContent.tsx` | 경로 열기 실패를 패널 `role=alert` 로 표시 | toast, 인라인 alert 제거 |

비범위: 아티팩트 **목록** 조회 실패(`listFailed`, 파일이 아니라 목록), 폴더 추가 실패(`useDirectoryPicker`), 이미지 디코드 실패(`imageFailed`), git diff 미리보기 불가, 아티팩트 카탈로그 화면(`features/artifacts`, transcript 밖).

### 계약

- `AppErrorTitle` 에 `fileUnavailable` 추가(ko "파일을 사용할 수 없습니다" / en "File unavailable"). 사유가 `missing`·`not-found`·`access-denied`·`forbidden`·`unsafe-path`·`io-error` 면 `fileUnavailable`, 그 밖은 `actionFailed`.
- detail = `<파일명>: <사유 문구>` — 사유 문구는 기존 `artifactFailureKey`/`previewFailureKey` 카탈로그 문구를 `i18n.t` 로 해석. 휴지통 이동 후 기록 실패는 `chat.artifacts.trashedUnrecorded`.
- SSOT: `features/chat/lib/artifactIssueReport.ts` — `artifactIssueTitle(reason)` · `reportArtifactIssue({ event, filename, reason?, messageKey? })`(→ `reportError`, scope `artifacts`, data `{ reason }`). 카드·뷰어 세 경로가 이 함수만 쓴다.

| AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC18 | availability 가 `missing`·`unavailable`·미확인이어도 카드는 불가/확인 중 문구와 새로 고침 버튼·메뉴를 렌더하지 않고, 다운로드·저장·위치 열기·휴지통은 활성이다. busy 면 비활성 + `working` 문구 | 렌더 테스트: 세 availability × 두 variant → 문구 0·refresh 0·disabled 0 / busy → disabled 4·`working` 1 | `ArtifactCards` → `ArtifactCard` |
| AC19 | 카드 동작(단건·전체 저장·위치 열기·휴지통) 결과의 실패 이슈마다 toast 1건 + 로그 1건, 카드 아래 인라인 이슈 0 | 동작 테스트: `runArtifactAction` 결과 주입(save items 2 failed · reveal `{ok:false,reason:'missing'}` · trash `already-missing` · trashed unrecorded) → 스토어 카드 수·제목·detail, 로그 호출 수 | `ArtifactCards.run` → `reportArtifactIssue` |
| AC20 | 미리보기 결과가 unavailable(형식 미지원 제외)이면 뷰어 selection 이 닫히고 toast 1건. 형식 미지원은 기존 본문 유지 | store 테스트: preview `{state:'unavailable',reason:'missing'}`·IPC reject → selection null + toast / `unsupported-format` → selection 유지 + toast 0 / 늦은 응답(다른 request) → toast 0 | `openArtifactViewer`·`retryArtifactViewer` → `readSelection` |
| AC21 | 뷰어 복사·다운로드 실패는 toast, status 줄에는 실패 문구 0 | 기존 `ArtifactViewer.actions.test.ts` 실패 케이스 갱신 | `useArtifactViewerActions.runAction` |
| AC22 | 작업 컨텍스트 경로 열기 실패는 toast(`openFailed`, detail `basename: 사유`), 인라인 alert 0 | `TaskContextContent.test.ts` 갱신 + 레지스트리 T34 | `openContextPath` catch |

### V

| Node / pair | provenance / requiredness | 직접 oracle | 선택적 적대 증거 | §10 자리 |
|---|---|---|---|---|
| R-12 ↔ AT-12 / VP-21 (AC18) | NEW / REQUIRED | 렌더 테스트 | required — 상태 줄 조건을 원복(`checking \|\| !present`)하는 변이 → red · 비활성 predicate 에 `!present` 재추가 변이 → red | EP-16(5자리: 상태 줄 1 · 비활성 4) |
| R-13 ↔ AT-13 / VP-22 (AC19~22) | NEW / REQUIRED | 동작·store 테스트 | required — 세 경로 각각 `reportArtifactIssue` 호출 삭제 → 해당 테스트 red | EP-17(4자리: ArtifactCards · readSelection · viewer actions · TaskContext) |
| MD-05 ↔ UT-05 / VP-23 | NEW / REQUIRED | `artifactIssueReport.test.ts`: 사유별 제목 · detail 형식 · 로그 동반 | not selected | EP-18(1) |
| AR-03 ↔ IT-03 / VP-16 | CHANGED / REQUIRED | 레지스트리: TaskContextContent catch = TOAST T34(`files.context-open.failed`/`openFailed`) · useArtifactViewerActions catch = TOAST T35(`artifacts.viewer-action.failed`/`actionFailed`) | V1 변이(삭제·맞바꿈·금지 주입) 유지 | EP-4 → 35자리 |
| R-02 ↔ AT-02 / VP-02 | INHERITED / REGRESSION | 새 경로가 `reportError` 를 거쳐 로그 동반 | — | EP-2 |
| R-06 ↔ AT-06 / VP-06 | INHERITED / NOT_REQUIRED | 스택·병합 규칙 불변 — 모델·스토어 무변경(r1 증거 유지) | — | — |

운영 gate: V1 §19 그대로(lint·typecheck·관련 vitest·전체 vitest).

**정합성 확인:** D-011 ↔ AC18~22 · D-012 ↔ AC18. D-001(transcript 소비 오류 불변)과 충돌 0 — 대상은 transcript 오류 이벤트가 아니라 파일 가용성 표시다. D-004 사용자 영향 기준과 일치(동작 실패가 화면에 남는다).

## ΔV3 — 퍼블리시되지 않은 생성 파일 포함 (2026-09-28)

**READY.** D-013 추가. 기준은 V1+ΔV1+ΔV2(r1.2). 생성 파일은 게시 아티팩트와 같은 `ArtifactCard`·`runArtifactAction`·`readSelection` 경로를 타므로 ΔV2 표시 제거는 이미 적용된다(`AssistantTurn.tsx:63`·`TaskOutputContent.tsx:49` → `ArtifactCards`). 이 절은 그 경로에서 생성 파일 사유가 사라지던 두 틈을 닫는다.

| 틈 | 근거 | TO-BE |
|---|---|---|
| 저장 대상이 없으면 결과 항목이 `skipped`(reason `missing`)라 `artifactOperationIssues` 가 이슈로 세지 않는다 → 토스트 0 | `main/app/handlers/artifacts.ts:145` · `lib/artifactOperationIssues.ts` `outcome === 'failed'` 필터 | `skipped` 도 이슈. 사유 없으면 `missing` |
| 생성 파일 원본이 바뀌거나 옮겨지면 `file-changed` 인데 저장·위치 열기·휴지통 핸들러 `reasonOf` 가 `io-error` 로 뭉갠다. 미리보기 경로는 `file-changed` 를 싣지만 문구가 일반 실패 | `handlers/artifacts.ts:33-45` · `features/artifacts/files.ts:104,149,152` · `service.ts:340` | `reasonOf` 허용 목록에 `file-changed` 추가. 렌더러는 `file-changed` → 제목 `fileUnavailable`, 문구 `chat.artifacts.changed`("원본 파일이 변경되었거나 다른 위치로 옮겨졌습니다") |

| AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC23 | 카드 동작 결과의 `skipped` 항목도 파일마다 toast 1건(사유 없으면 `missing`) | lifecycle 테스트: save items `[{outcome:'skipped',reason:'missing'}]` → 보고 1 · `artifactOperationIssues` 단위 | `ArtifactCards.run` |
| AC24 | 생성 파일(`category:'file'`) 카드도 AC18 과 같이 불가 표시·비활성이 없다 | render 테스트에 `category:'file'` 변형 추가 | `ArtifactCard` |
| AC25 | `file-changed` 는 제목 `fileUnavailable`·문구 `chat.artifacts.changed`, IPC 저장/위치 열기/휴지통 결과에 `file-changed` 가 보존된다 | helper 테스트 · `handlers/artifacts.test.ts` 에 `file-changed` 보존 케이스 | `reasonOf` → 결과 → `reportArtifactIssue` |

| Node / pair | provenance / requiredness | 직접 oracle | 선택적 적대 증거 | §10 자리 |
|---|---|---|---|---|
| R-14 ↔ AT-14 / VP-24 (AC23~25) | NEW / REQUIRED | 위 테스트 | required — `skipped` 필터 원복 변이 · `reasonOf` 에서 `file-changed` 제거 변이 · 제목 목록에서 `file-changed` 제거 변이 → 각각 red | EP-19(3자리: issues 필터 · reasonOf · 제목/문구 매핑) |
| R-12 ↔ AT-12 / VP-21 | INHERITED(ΔV2) / REGRESSION | AC24 가 category file 로 재실행 | — | EP-16 |
| R-13 ↔ AT-13 / VP-22 | INHERITED(ΔV2) / REGRESSION | ΔV2 테스트 유지 | — | EP-17 |

**정합성 확인:** D-013 ↔ AC23~25 · D-011·D-012 유지. IPC 결과 `reason` 은 이미 `string` 타입이라 계약 형태 변경 없음 — 값 하나가 더 보존될 뿐이다(IPC_CONTRACT 의 저장 결과 설명과 대조 필요 시 구현 턴이 확인).

## ΔV4 — 불가 파일 미리보기의 공간 할당 플리커 제거 (2026-09-28)

**READY.** D-014 추가. ΔV2 AC20("뷰어 selection 이 닫히고 toast")은 여는 순간 로딩 뷰어로 공간을 잡았다가 되돌리는 플리커를 만든다(사용자 실기). 이 절이 AC20 의 **최초 열기** 경로를 대체한다. 이미 열린 뷰어의 재시도(`retryArtifactViewer`)가 불가를 받으면 닫는 동작은 유지한다(공간은 이미 있고 되돌리는 것이 정답이다).

| 비교 축 | AS-IS (ΔV2) | TO-BE (ΔV4) |
|---|---|---|
| 열기 순서 | `openArtifactViewer` 가 `selection{loading:true}` 를 먼저 세움 → preview → 불가면 `selection:null` + toast | `opening{request,sessionKey,publicationId}` 만 세움 → preview → 결과가 열 수 있으면 `selection{loading:false,result}`, 불가면 toast 만 |
| 공간 | 불가 파일도 뷰어 폭만큼 잠깐 할당 | 불가 파일은 0 |
| 기존 뷰어 | 교체 후 닫힘(빈 패널) | 불가면 그대로 유지 |
| 대기 표시 | 로딩 뷰어 | 누른 카드의 미리보기 버튼 `aria-busy="true"` + `cursor-progress`, 같은 publication 재클릭 무시 |
| 취소 | request 불일치 무시 | + `closeArtifactViewer(sessionKey)` 가 같은 key 의 `opening` 도 지운다(세션 이동·카탈로그 이탈 뒤 늦은 결과가 열리지 않음) |

| AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC26 (AC20 최초 열기 대체) | 불가 결과면 `selection` 이 **한 번도** 설정되지 않고 toast 1건. 이미 열린 다른 selection 은 동일 객체로 유지 | store 테스트: selection 변화를 구독해 기록 → 불가 열기 동안 기록 0 · 기존 selection 참조 불변 | `openArtifactViewer` |
| AC27 | 열 수 있는 결과는 대기 중 selection 없음 → 결과와 함께 1회 설정(`loading:false`) | store 테스트: pending 동안 `selection` null·`opening` 설정, 해제 후 selection 1회 | 같음 |
| AC28 | 대기 중 다른 파일 열기·`closeArtifactViewer(key)` 뒤 늦은 결과는 열지도 알리지도 않는다 | store 테스트 2건 | 같음 |
| AC29 | 대기 중인 카드만 미리보기 버튼 `aria-busy`, 재클릭은 새 요청을 만들지 않는다 | render/lifecycle 테스트 | `ArtifactCards` → `ArtifactCard` |

| Node / pair | provenance / requiredness | 직접 oracle | 선택적 적대 증거 | §10 자리 |
|---|---|---|---|---|
| R-15 ↔ AT-15 / VP-25 (AC26~29) | NEW / REQUIRED | 위 테스트 | required — (a) 열기 전에 selection 을 세우는 옛 순서 복원 → AC26 red (b) close 에서 opening 해제 제거 → AC28 red | EP-20(3자리: open 선할당 금지 · close 의 opening 해제 · 카드 busy 전달) |
| R-13 ↔ AT-13 / VP-22 | CHANGED(AC20 최초 열기 → AC26) / REQUIRED | 재시도 경로의 닫기+toast 는 기존 테스트 유지 | — | EP-17 |

카탈로그 화면(`app/hooks/useArtifactCatalogViewer.tsx`)도 같은 `openArtifactViewer` 를 써서 플리커 제거가 함께 적용된다. 카탈로그 행의 busy 표시는 비범위(`features/artifacts` 는 chat store 를 import 할 수 없다 — 레이어 규칙).

## ΔV5 — 설명 8줄 말줄임 · 클릭 이동 · 로그 파일 위치 (2026-09-28)

**READY.** D-015~D-019 추가. 기준은 V1~ΔV4(r1.4 verify/PASS `ef3cd63`). 모든 toast 는 D-002 로 로그에 남으므로 "로그에 남는다면" 조건은 전 toast 에 참이다 — 말줄임·클릭 이동을 전 toast 에 적용한다.

### 실측 (Chromium, 실제 `ErrorToastHost` + 앱 CSS, Inter 미설치로 Linux 대체 글꼴)

| 항목 | 값 | 근거 |
|---|---|---|
| 설명 폭 · 줄당 글자 | 372px · 한글 29 · 영문 48 | 1줄이 될 때까지 늘려 측정 |
| 카드 높이 | `49 + 17.5×줄 수`px (1줄 66 · 8줄 189 · 9줄 206) | 줄 수 1~10 측정 |
| 현재 300자 3장 스택 | 카드 242px(11줄), 아래끝 779px → 1024×640 에서 139px 잘림 | 3 뷰포트 측정 |
| 8줄 상한 3장 | 38 + 3×189 + 16 = 621px ≤ 670−28 | 기본 창 `main/index.ts:188` 900×670, 최소 크기 제한 없음 |

- 300자 상한 아래에서 8줄 말줄임이 걸리는 것은 한글 약 232자 초과 설명이다. 순수 영문 300자는 약 7줄이라 잘리지 않는다.

### 요구 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 이미 되는가 | 아니오 | 설명은 무제한 줄바꿈(`ErrorToastHost.tsx:29`), 카드 클릭 동작 0, 로그 위치를 여는 IPC 0(`shared/ipc.ts` `orca:error:*` 2채널) |
| 이동 수단이 있는가 | 페이지·설정 탭만 | Electron 단축키·외부 URL 스킴·main→renderer 이동 IPC 0. 페이지 = `app/router.tsx:30-43`, 설정 = `useSettingsModalStore.show(tab)` |
| 레이어 | `shared/ui` Host 는 router·features/settings 를 import 할 수 없다 | `eslint.config` boundaries: shared → shared 만. 이동 실행은 app 레이어가 주입 |
| 이동 대상 소비자 | 현재 0 (D-019) | 기존 보고 사이트는 대상 없음 → 모두 로그 위치. 경로 자체는 production(보고 → store → Host → app 실행)이고 호출부만 미래다 |
| 병합(D-007) | 키 불변 | 같은 제목+설명이면 병합 — 대상은 **나중 보고의 값으로 교체**(가장 최근 요청이 이동을 정한다) |

### 범위 / 비범위

- 범위: 설명 8줄 말줄임, 카드 본문 클릭 이동 + 닫기, 대상 계약(renderer·main 보고 입력 → IPC → store), 로그 위치 IPC 1개, IPC 문서·인벤토리.
- 비범위: warning 분류·usage fetcher(D-018), 기존 사이트 대상 지정(D-019), `/plugins` 등 페이지 내부 항목 딥링크(쿼리 계약 없음), 제목 말줄임.

### 계약

```ts
// shared/app-error.ts — 설정 탭 SSOT 를 여기로 옮기고 settingsModalStore 가 재사용한다
export type AppSettingsTab = 'general' | 'usage' | `provider:${string}`
export type AppErrorTarget =
  | { kind: 'page'; path: `/${string}` }   // 앱 라우트 경로. '//' 시작은 무효
  | { kind: 'settings'; tab: AppSettingsTab }
export interface AppErrorReport { id; title; detail?; origin; target?: AppErrorTarget }
```

- 입력: renderer `reportError({ …, target? })` · main `reportError({ …, target? })` · main `publishErrorReport({ …, target? })` 가 `target` 을 보고에 싣는다. `presentErrorReport` 는 받은 그대로.
- 모델: `applyErrorReport` 병합 시 `target` 을 새 보고 값으로 교체(없으면 없음으로). 키·cooldown·만료 규칙 불변.
- 새 채널 `orca:error:revealLog` (R→M invoke, 입력 없음, `void`): main 이 로그를 `flushLogSync()` 한 뒤 현재 파일 `<logs>/application.jsonl` 이 있으면 `shell.showItemInFolder`, 없으면 `shell.openPath(<logs>)`, 그것도 오류 문자열이면 throw. 경로는 `infra/log` 가 `currentLogFilePath()` 로 노출(파일명 SSOT = `file-transport.ts` `DEFAULT_BASE`).
- 실행(app 레이어 `openErrorTarget(target, deps)`): `page` → `navigate(path)` · `settings` → `openSettings(tab)` · 없음/무효 → `revealLog()`. 무효 = 런타임 가드 실패(`path` 가 `/` 로 시작하지 않거나 `//` 시작, `tab` 이 세 형태 밖). `revealLog` 거부는 `reportError({ event: 'errors.reveal-log.failed', scope: 'errors', title: 'openFailed', error })`.
- Host: `ErrorToastHost({ onOpen })`. 카드 본문(아이콘+제목+설명)은 `<button type="button" data-behavior="toast:open">` 하나, × 는 형제 버튼. 본문 클릭 = `onOpen(target)` 후 `dismiss(id)`. 설명 `<p>` 에 `line-clamp-8` (+ 기존 `[overflow-wrap:anywhere]` 유지).

### 흐름

```text
reportError({target?}) ─ renderer ─→ errorToastStore(target) ─┐
reportError({target?}) ─ main → hub → reportEvent/drain(IPC) ─→ bridge → presentErrorReport ─┘
  → ErrorToastHost: 설명 line-clamp-8, 본문 button
  → click → onOpen(target) (app/ErrorToastLayer) → openErrorTarget
       page → navigate · settings → settings store show(tab) · 없음 → errorApi.revealLog → main showItemInFolder
  → dismiss(id)
```

### AC

| AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC30 | 설명은 8줄까지 가변 높이, 초과분은 `…`. 제목·× 는 말줄임 대상 아님 | Host render: 설명 `<p>` 에 `line-clamp-8` · 제목 `<p>` 에 없음 + **사람 실기**(232자 초과 한글 설명 3장이 900×670 에서 모두 보이고 8번째 줄 끝 `…`) | `ErrorToastHost` |
| AC31 | 본문 클릭은 `onOpen` 을 그 카드의 `target` 으로 1회 부르고 그 카드만 닫는다. × 는 `onOpen` 0회 | Host 요소 트리 호출 테스트: 카드 2장(대상 page·없음) 각각 본문 onClick → `onOpen` 인자·호출 수, 남은 카드 id / × onClick → `onOpen` 0 | `ErrorToastHost` |
| AC32 | `openErrorTarget`: page → navigate(path), settings → openSettings(tab), 없음 → revealLog, 무효 page(`'plugins'`·`'//x'`)·무효 tab → revealLog | 순수 단위 테스트(deps fake 호출 기록) | `app/errorToastTarget.ts` |
| AC33 | revealLog 거부 → toast `openFailed` 1 + 로그 1 | 단위: revealLog reject 주입 → store 카드·`window.orca.log.error` 호출 | 같음 |
| AC34 | renderer·main 보고의 `target` 이 store 카드까지 보존된다. main 은 이벤트와 drain 두 경로 모두 | renderer `reportError` 단위 · main `reportError`·`publishErrorReport` → hub sink payload · bridge drain/이벤트 → store `target` | 두 `reportError` · hub · bridge |
| AC35 | 병합 시 `target` 은 나중 보고 값(없음 포함)으로 교체, 카드 수·키 불변 | `applyErrorReport` 단위 | `errorToastModel.ts` |
| AC36 | `orca:error:revealLog` 가 flush 후 파일 선택 / 파일 없으면 폴더 열기 / 폴더 열기 오류 문자열이면 reject | handler 단위(electron `shell` mock, `infra/log` mock): 호출 순서 flush → showItemInFolder(`…/logs/application.jsonl`) · 파일 부재 → openPath(`…/logs`) · openPath `'err'` → reject | `main/app/handlers/error.ts` |
| AC37 | app 이 `ErrorToastLayer` 로 Host 를 띄우고 `onOpen` 을 `openErrorTarget` + 실제 navigate·settings store·`errorApi.revealLog` 에 연결한다 | `App` 조립 단언(Host 가 Layer 경유로만 mount) + Layer 가 `openErrorTarget` 에 넘기는 deps 가 settings store `show`·`errorApi.revealLog` 인지 호출 기록 | `App.tsx` → `app/ErrorToastLayer.tsx` |
| AC38 | IPC 문서·인벤토리가 새 채널·`AppErrorReport.target` 과 일치 | `ipc-documentation.test.ts` · `check-doc-inventory.mjs --check` | CI |

- AC 수: ΔV5 9 (누적 38 — 이 handoff 는 ΔV 단위로 나뉘어 한 라운드 분모는 9).

### V

| Node / pair | provenance / requiredness | 직접 oracle | 선택적 적대 증거 | §10 자리 |
|---|---|---|---|---|
| R-16 ↔ AT-16 / VP-26 (AC30) | NEW / REQUIRED | Host render class 단언 + 사람 실기 | required — 설명 `line-clamp-8` 을 제목 `<p>` 로 옮기는 맞바꿈 → red (자리 1: 설명 p) | EP-21(1) |
| R-17 ↔ AT-17 / VP-27 (AC31·AC32·AC33) | NEW / REQUIRED | Host 호출 테스트 · `openErrorTarget` 단위 | required — (a) 본문 onClick 에서 `dismiss` 삭제 (b) × onClick 이 `onOpen` 도 부름 (c) page·settings 분기 맞바꿈 (d) 무효 가드 삭제 → 각 red | EP-22(7: 본문 onOpen · 본문 dismiss · × 비이동 · page 분기 · settings 분기 · 없음 분기 · 가드) |
| SD-03 ↔ ST-03 / VP-28 (AC34) | NEW / REQUIRED | main hub sink payload + bridge → store 통합 | required — `target` 누락 변이를 5자리 각각에 심는다(renderer reportError · main reportError · publishErrorReport · 이벤트 수신 · drain 수신) → 자리마다 red | EP-23(5: renderer reportError · main reportError · publishErrorReport · 이벤트 · drain) |
| AR-04 ↔ IT-04 / VP-29 (AC36·AC37) | NEW / REQUIRED | handler 단위 · App/Layer 조립 | required — handler 의 `flushLogSync` 삭제 → 순서 단언 red · Layer 가 `onOpen` 을 no-op 으로 → red | EP-24(5: 채널 상수 · preload `error.revealLog` · `errorApi` · handler · Layer 배선) |
| MD-06 ↔ UT-06 / VP-30 (AC35) | NEW / REQUIRED | 모델 단위 | not selected — 순수 결과 직접 단언 | EP-25(1) |
| R-11 ↔ AT-11 / VP-11 (AC38) | INHERITED / REGRESSION | 기존 CI 테스트 | — | EP-13 |
| R-06 ↔ AT-06 / VP-06 | CHANGED(병합 시 target) / REQUIRED | AC10·AC11 기존 + AC35 | — | EP-7 |
| AR-02 ↔ IT-02 / VP-15 | CHANGED(Layer 경유 mount) / REQUIRED | 기존 Host render 2건 + AC37 | — | EP-15 |
| R-08 ↔ AT-08 / VP-08 | INHERITED / REGRESSION | 카드 클래스·토큰 단언 유지(본문이 button 이 되어도 grid·반경·그림자 불변) | — | EP-10 |
| R-02 ↔ AT-02 / VP-02 | INHERITED / REGRESSION | revealLog 실패 보고도 로그 동반(AC33) | — | EP-2 |

### §10 강제 지점 (ΔV5)

| EP | 계약 | 자리 | 실패 의미 |
|---|---|---|---|
| EP-21 | 설명 8줄 | `ErrorToastHost` 설명 `<p>` 1 | 없으면 긴 설명 3장이 기본 창 밖으로 잘린다(측정 779px) |
| EP-22 | 클릭 이동 | Host 본문 onClick(onOpen·dismiss) · × onClick · `openErrorTarget` page/settings/없음 분기 · 런타임 가드 | 가드 없으면 main 발 잘못된 경로가 `*` → `/new` 로 조용히 이동 |
| EP-23 | target 운반 | renderer `reportError` · main `reportError` · `publishErrorReport` · main→renderer 이벤트 · drain | 한 자리라도 빠지면 그 경로의 보고만 로그 위치로 떨어진다 |
| EP-24 | 로그 위치 IPC | `CHANNELS.errorRevealLog` · preload `error.revealLog` · `errorApi.revealLog` · handler · `ErrorToastLayer` 배선 | flush 없으면 방금 보고한 줄이 파일에 아직 없다 |
| EP-25 | 병합 target | `applyErrorReport` 병합 분기 | 오래된 대상으로 이동 |

### 파일

| 파일 | 역할 |
|---|---|
| `shared/app-error.ts` | `AppSettingsTab` · `AppErrorTarget` · `AppErrorReport.target` |
| `shared/ipc.ts` · `preload/index.ts` | `errorRevealLog` 채널 · `error.revealLog()` |
| `main/infra/log/index.ts` (+ `file-transport.ts` path getter) | `currentLogFilePath()` |
| `main/infra/error-report/index.ts` | 두 입력의 `target` 운반 |
| `main/app/handlers/error.ts` (+ 테스트 신규) | revealLog 핸들러 |
| `renderer/src/shared/errors/{reportError,errorToastModel}.ts` | 입력 `target` · 병합 교체 |
| `renderer/src/shared/api/ipc.ts` | `errorApi.revealLog` |
| `renderer/src/shared/ui/ErrorToastHost.tsx` | 본문 button · `onOpen` prop · `line-clamp-8` |
| `renderer/src/app/errorToastTarget.ts` · `app/ErrorToastLayer.tsx` (신규) | 실행 매핑 · hook 배선 |
| `renderer/src/App.tsx` | Host → Layer |
| `renderer/src/features/settings/store/settingsModalStore.ts` | `SettingsTabId = AppSettingsTab` |
| `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` | 채널·payload |

운영 gate: V1 §19 그대로(lint · typecheck · 관련/전체 vitest · inventory `--check` · trailer).

**정합성 확인:** D-015 ↔ AC30 · D-016 ↔ AC31·AC32·AC34·AC37 · D-017 ↔ AC32·AC36 · D-018 ↔ 비범위 · D-019 ↔ 비범위(기존 사이트 무변경). D-007(병합 키) 유지 — AC35 는 키를 바꾸지 않는다. D-008(4.6초·× 즉시 제거) 유지 — 본문 클릭도 즉시 제거. D-002 유지 — AC33.

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- **r1 구현 완료.** V1 + ΔV1을 적용했다. 사용자 참고 스펙의 작은 이동·크기·수명과 Orca 시맨틱 색상·앱 폰트를 함께 사용한다. D-010 정정은 구현과 별도 설계 커밋으로 기록했다.
- 동의 / 그대로 진행: 소비되지 않는 실패만 보고하고 기존 폴백·롤백·transcript 소비를 유지했다. 신규 의존성은 없다.
- 실측 정정: M22에는 경고 집계와 로드 실패라는 호출 두 개가 있다. M-표 24행을 **25 호출 자리**로 검증했다. EP-2의 마지막 묶음도 실제 두 호출이므로 전체 5자리다. 계약 추가 없이 표에 명시된 두 경로를 모두 포함했다.
- 구현 세부 차이: drain의 sender 수명 처리를 Electron 없는 `app/error-report-drain.ts`로 분리했다. 기존 preload 추론 타입이 공개 API를 전달하므로 `renderer/env.d.ts`는 변경할 필요가 없었다.
- ACTIVE Decision 충돌: 없음. §17의 민감 detail 해당 0이라는 조사와 달리 M18은 원문 DB payload를 숨기는 기존 경계다. `detail:null`로 유지했다.

**배치 차이의 실패 축 재확인:** 로깅 IPC 등록을 bootstrap 완료 시점에서 main 초기화 직후로 옮겼다. AC3의 부팅 화면 로그가 유실되지 않게 하는 배선 수정이다. 만료는 등록 핸들러에 없어 해당 없음, 공유는 프로세스당 등록 1회, 재진입은 bootstrap에서 기존 등록 제거, 무효화는 프로세스 종료만 해당한다. startup oracle과 등록 삭제 변이가 EP-2·EP-14를 확인한다. drain factory의 WeakSet은 sender당 destroyed 구독 1회를 보장하며, 반복 drain·destroyed 후 재대기열은 통합 테스트가 관측한다(AC14·EP-11).

## [구현자 기입] 강제 지점 전수 (§10 대조)

재현 기준: 아래 경로는 `app/src` 기준이다. `cd app; npx vitest run <테스트 경로>`로 각 oracle을 실행한다. 결과와 재실행 목록은 [r1-test-summary.json](evidence/r1-test-summary.json), 실행형 변이는 [r1-mutations.json](evidence/r1-mutations.json)에 남겼다.

전수 검색은 오류의 주어에서 시작했다: renderer의 catch/catch-callback AST, main M-표의 기존 로그 event, 전역 handler 등록, timer·ready·pending·destroyed 상태 전이, IPC 채널과 Host 마운트를 대조했다. `reportSites.registry.test.ts`는 기준 90 catch와 현재 파일별 ordinal 집합의 **양방향 차집합이 빈 배열**임을 단언한다. 새 reporter 내부 catch는 기준 90의 분모에 섞지 않는다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01 | EP-1 renderer 전역 | 2 handler | 2/2 + 부팅 등록 | `rg -n 'addEventListener\|registerGlobalErrorHandlers' renderer/src/main.tsx renderer/src/shared/errors/globalHandlers.ts`; `reportError.test.ts` 두 event 각각 로그·카드 증가 | 없음 |
| VP-02 | EP-2 로그 선행·수신 무로그 | 4묶음 | 실측 5/5: reporter 2, present 1, 별도 발행 2 | main/renderer `reportError.test` 로그 선행 각 1; bridge 수신 로그 0; main registry 발행 파일 집합이 scheduler/config와 일치 | 없음 |
| VP-03 | EP-3 레이어 | 모듈 2 | 2/2, renderer 4·main 4 레이어 호출 | lint boundaries 오류 0; Electron mock 없이 `infra/error-report/index.test.ts` 4건 실행 | 없음 |
| VP-04·16 | EP-4 T1~T33 | 33 | 33/33 | renderer registry TOAST 33행 통과; report 호출 삭제 33변형 모두 oracle 거부; 대표 롤백/드롭 행동 4곳 통과 | 없음 |
| VP-01 | EP-5 main 전역 | 2 | 배선 2/2 | `rg -n 'process.on' main/index.ts`; M1·M2 event/title 슬롯 단언, 통합 sink·logger 각각 관측 | 실제 Electron 예외 실기 |
| VP-05·16 | EP-6 M-표 | 24행 | 25/25 호출 | main registry 기존 event/title 각 1; M22 두 event 별도 단언; 25 호출 삭제 거부 | 없음 |
| VP-06·17 | EP-7 cap·병합·cooldown | 규칙 3 | 3/3 + 만료·닫기 | `errorToastModel.test.ts`: `[d,c,b]`, 500ms 불변, 1200ms seq+1; store: 4599ms 존재/4600ms 제거·dismiss 즉시 제거 | 없음 |
| VP-04 | EP-8 조용한 catch | 스윕 1 | 1/1, 허용 4 | 비테스트 TS/TSX 전수 스윕 집합 = 명시 허용 4자리; 새 파일·기존 파일 추가 시 각각 실패 | 없음 |
| VP-07·19 | EP-9 scheduler 전이 | 2 | 2/2 | `scheduler.test.ts`: 실패·실패·성공·실패 → 로그 3/보고 2; reset 삭제 시 해당 케이스 실패 | 없음 |
| VP-08 | EP-10 두 테마 | 2 | 소스 2/2 | Host 렌더 클래스·시맨틱 alias 6·두 shadow·keyframes 4스톱·4.6s 단언 통과 | 두 테마 시각 실기 |
| VP-09·13·18 | EP-11 ready/queue/cooldown/drain/파괴 | 4묶음 | hub 4/4 + app 파괴 경계 2 | `rg -n 'ready\|pending\|destroyed\|isDestroyed' main/infra/error-report main/app/error-report*`; hub 4건·통합 1건: FIFO 10, drain 재호출 빈 배열, destroyed·send 중 소멸 후 재대기열 | 없음 |
| VP-10·20 | EP-12 benign·재귀 가드 | 3 | 3/3 + 내부 present/publish 가드 | reporter 테스트: ResizeObserver 2문구 로그/카드 0, push·sink·logger throw 비전파 | 없음 |
| VP-11 | EP-13 IPC 문서 | 채널/도메인 | 2채널·3문서 동기화 | `ipc-documentation.test.ts` 3건; `node scripts/check-doc-inventory.mjs --check` 문서 불일치/끊긴 링크 0 | 없음 |
| VP-14 | EP-14 sink/preload/bridge | 모듈 3 | 전달 edge 6/6 | sink send 1, preload subscribe/invoke 2, bridge subscribe/drain/dedupe 3; typecheck·통합·bridge 테스트 통과 | 없음 |
| VP-15 | EP-15 Host | 1 | 1/1 | `rg -n 'ErrorToastHost\|RootGate\|TweakProvider' renderer/src/App.tsx`; 실제 React element 트리에서 RootGate 형제·TweakProvider 자손 | 없음 |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | renderer 전역·main 로그/sink·M1/M2 배선 통과 | 미선택; AC2 실제 창 실기 대기 |
| VP-02 | REQUIRED | SELF_PASS | main/renderer 각 로그 선행, bridge 로그 0 | 중복 로그 삽입 1 red; 제3 발행 파일 1 red |
| VP-03 | REQUIRED | SELF_PASS | 8개 레이어 호출·lint 오류 0·main 순수 테스트 4건 | 해당 없음 — 직접 oracle |
| VP-04 | REQUIRED | SELF_PASS | TOAST 33·비대상 57, 기준 catch 양방향 차집합 0, silent 허용 집합 일치 | 삭제 33·event swap 16 거부; silent 신규/기존 파일 red |
| VP-05 | REQUIRED | SELF_PASS | M-표 25 호출의 기존 event/title 슬롯 통과 | 삭제 25 거부 |
| VP-06 | REQUIRED | SELF_PASS | 모델 2건·타이머 2건 | 해당 없음 — 직접 oracle |
| VP-07 | REQUIRED | SELF_PASS | 실패 3회 로그·전이 보고 2회 | 해당 없음 — 직접 oracle |
| VP-08 | REQUIRED, ΔV1 | SELF_BLOCKED | Orca alias·카드 클래스·4스톱·duration 단언 통과 | 미선택; 두 테마 시각 실기 대기 |
| VP-09 | REQUIRED | SELF_PASS | hub FIFO·파괴·cooldown 4건 | 해당 없음 — 직접 oracle |
| VP-10 | REQUIRED | SELF_PASS | benign 2문구·양 reporter 가드 | 해당 없음 — 직접 oracle |
| VP-11 | REQUIRED | SELF_PASS | IPC 문서 3건·inventory 확인 | 해당 없음 — 기존 oracle |
| VP-12 | REQUIRED | SELF_PASS | 실제 chat send 거부 → rollback·Host 1장 → 4600ms 후 0 | 해당 없음 — 직접 oracle |
| VP-13 | REQUIRED | SELF_PASS | 실제 reporter·등록된 IPC handler·bridge 연결: 초기 보고 1, live 보고 추가, destroyed 후 queue | 해당 없음 — 직접 oracle |
| VP-14 | REQUIRED | SELF_PASS | preload 타입·bridge 2건·실제 app sink 통합 | drain 선행 변이 1 red |
| VP-15 | REGRESSION, ΔV1 | SELF_PASS | store 2카드 → Host alert 2·번역·escape·닫기 label | 선택 없음; 신규 배선 oracle의 Host 삭제 변이 2 red |
| VP-16 | REQUIRED | SELF_PASS | renderer 33·main 25 호출, 비대상 57 | VP-04·05 증거 공유 |
| VP-17 | REQUIRED | SELF_PASS | cap/키별 병합/cooldown 모델 2건 | 해당 없음 — 직접 oracle |
| VP-18 | REQUIRED | SELF_PASS | hub 4건·app lifetime 통합 | 해당 없음 — 직접 oracle |
| VP-19 | REQUIRED | SELF_PASS | 성공 뒤 재실패 보고 관측 | 성공 시 reset 삭제 1 red |
| VP-20 | REQUIRED | SELF_PASS | benign/보고 실패 비전파 | 해당 없음 — 직접 oracle |

자기확인 검산: SELF_PASS 18 + SELF_BLOCKED 2 = 유효 pair 20. 독립 검증 판정이 아니다.

## [구현자 기입] 이번 라운드 수정의 잠금

실제 소스 파일을 바꿔 Vitest 실패를 관측한 변이 10건은 [재현 스크립트](evidence/r1-mutations.cjs)의 `finally`에서 원본 바이트를 복원했다. 레지스트리 변이는 읽은 production source의 메모리 사본을 바꾸고 **같은 판정 함수의 거부**를 단언한다. 이 경우 테스트 러너 자체는 green이며 파일 변이 red와 구분한다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| main 수신에서 renderer 로그 추가 | 선택 VP-02(a) | 첫 구현 | `mainErrorBridge.test.ts` 1건 실패 | red |
| 제3 production 파일에 logless publish 추가 | 선택 VP-02(b) | 첫 구현 | main registry 사용처 제한 1건 실패 | red |
| T1~T33 report 호출 삭제 | 선택 VP-04(a) | 첫 구현 | renderer registry 33/33 판정 거부 | 검출 |
| 새 silent catch 삽입 | 선택 VP-04(b) | 첫 구현 | 새 파일: 스윕 1건 실패; 기존 파일: 집합·스윕 2건 실패 | red |
| renderer event 형제 교환 | 선택 VP-04(c) | 첫 구현 | 같은 파일 15쌍 + 다른 파일 1쌍, 양쪽 슬롯 모두 거부 | 검출 |
| M-표 호출 삭제 | 선택 VP-05 | 첫 구현 | main registry 25/25 판정 거부 | 검출 |
| 구독보다 drain 먼저 호출 | 선택 VP-14 | 첫 구현 | bridge drain 중 live 보고 수신 1건 실패 | red |
| 성공 시 failing 상태 해제 삭제 | 선택 VP-19 | 첫 구현 | scheduler 성공 후 재실패 1건 실패 | red |
| CONSUMED/EXCLUDE catch에 보고 삽입 | 새 oracle: 비대상 0건 | 첫 구현 | renderer registry 57/57 판정 거부 | 검출 |
| 기준 파일에 catch ordinal 추가 | 새 oracle: 양방향 차집합 | 첫 구현 | `VP-04b-existing-file`의 기준 집합 1건 실패(위 증거 공유) | red |
| logless 발행 동반 로그 제거 | 새 oracle: 로그 결합 | 첫 구현 | M13·M22 2/2 판정 거부 | 검출 |
| main 동일 파일 event 형제 교환 | 새 oracle: 슬롯 분류 | 첫 구현 | main registry 26쌍 모두 양쪽 슬롯 거부 | 검출 |
| 초기 sink·drain handler·log handler 등록 각각 삭제 | 새 oracle: startup 배선 | 첫 구현 | 3변이 각각 startup 테스트 1건 실패 | red |
| App Host 마운트 제거 | 새 oracle: 마운트·provider 트리 | 첫 구현 | Host 소스 단언·App 실제 element 트리 2건 실패 | red |
| 오류 hub와 같은 파일에 artifact publisher 삽입 | 새 oracle: 기존 artifact 스윕 보정 | 첫 구현 | 명시 error-hub 호출만 제외; 동반 `service.publish`는 검출 1건 | 검출 |

분모 검산: 선택 증거 8 + 인용 변이 0 + 새 oracle 7 = 표 15행. VP-16은 선택 증거를 공유하므로 다시 세지 않았다. 나머지 행동·값 단언은 해당 없음 — 직접 oracle.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 오류 producer가 실제 화면까지 이어지는가 | main 초기/live 전달과 renderer send 실패가 실제 store·Host까지 도달 | 통합 2경로 잠금 |
| 기존 오류 표면과 중복되는가 | CONSUMED 36·EXCLUDE 21 catch에 보고 0; transcript 오류만 있을 때 toast 0 | 기존 소비 유지 |
| 취소·실패·빈 결과가 기존 상태를 되돌리는가 | Tweak/bypass 롤백, chat send 롤백·load drop 관측; 훅의 cancelled 조건 유지 | 빈 목록·fail-closed 유지 |
| 폭주·닫기·재시작은 무엇을 보여주는가 | cap 3·같은 키 1초 억제·4.6초 제거·닫기 즉시 제거; 제거 시 timer 정리 | 행동 테스트 통과 |
| 두 테마·접근성은 맞는가 | Orca alias, 작은 이동, alert·닫기 label·reduced-motion·원문 escape 관측 | AC13 시각 실기 대기 |
| 카드 설명에 민감 원문이 새로 노출되는가 | M18은 기존 원문 비기록 정책을 detail:null로 유지 | 제목만 보고 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| I1 | 초기 renderer 오류가 bootstrap 전 log IPC로 오면 기존 등록 시점이 늦다 | 선조치: logger 초기화 뒤 등록, bootstrap 중복 등록 제거 | startup 등록 순서 단언·각 삭제 red |
| I2 | 단순 file-wide event 검색은 같은 제목을 가진 main 형제 교환을 놓친다 | 선조치: 파일 내 호출 ordinal과 event/title 함께 대조 | main 26쌍 교환 모두 거부 |
| I3 | 새 hub의 `.publish`가 기존 artifact 전수 검색에 걸린다 | 선조치: `errorReportHub.publish` receiver만 제외, 같은 파일의 다른 publish는 유지 | 기존 artifact 스윕 통과·동반 publish 감도 1건 |
| I4 | 기존 App 테스트는 자식이 하나인 체인만 순회한다 | 선조치: 자식 배열도 순회하여 기존 provider 순서와 새 Host 형제를 함께 확인 | Host 제거 시 App/Host 테스트 둘 다 실패 |
| I5 | formatter가 기존 spinner 색 문자열 대소문자를 바꿨다 | 선조치: 관련 없는 표기를 원복 | `sparkCss.test.ts` 재검사 통과 |
| I6 | bridge의 seen id 집합은 창 수명 동안 커진다 | 보고만: plan 지정 정책 유지. 장기간 오류가 계속되면 별도 상한 정책 검토 가능 | 현재 카드/queue/cooldown과 다른 수명; 이번 AC 위반 아님 |
| I7 | 실제 Electron 예외·두 테마 체감은 Node/SSR로 확인되지 않는다 | AC2·AC13 미완료로 남김 | §19 지정 사람 실기, 실행하지 않음 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | shared 오류 계약·IPC, main reporter/hub/sink/drain·25 호출, renderer reporter/store/Host·33 호출·i18n/tokens, 회귀 테스트, IPC/관측성/인벤토리 문서 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |
| 유효 설계 / 상태 | V1 + ΔV1 / impl·IMPL_DONE / 다음 Claude 독립 검증 |
| 정적 게이트 | `npm run lint`: 오류 0, 기존 `useTranscriptVirtualizer` 경고 1. `npm run typecheck`: node/web/test 3구성 오류 0 |
| 전체 테스트 | `npx vitest run`: 593파일, 5515 pass / 112 fail / 1 skip. 실패 14파일은 환경 11파일과 이번 변경 관련 3파일로 분리 |
| 최종 재검사 | 실패 14파일 + 변경 관련 경로 전체를 권한 확보 후 실행: **32파일 507/507**. 동일 파일을 최신 결과로 치환한 총합 5654 pass / 1 skip / 0 fail(최종 전체 단일 실행 수치가 아님) |
| 스크립트 게이트 | `node --test "scripts/*.test.mjs"`: 최초 120 pass/8 fail(EPERM), 권한 확보 후 **128/128** |
| 문서 gate | `node scripts/check-doc-inventory.mjs --check`: 생성물 일치·본문 수치 위반 0·깨진 상대 링크 0 |
| 관측 증거 | [테스트 요약](evidence/r1-test-summary.json), [변이 관측](evidence/r1-mutations.json), [lint](evidence/r1-lint.log), [typecheck](evidence/r1-typecheck.log). 원본 실행 로그는 로컬 `app/node_modules/.cache/orca/0242-evidence/`에 보존 |

**AC 자기보고**

| AC | 상태 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | 전역 error/rejection 각각 로그·카드 증가, event 이름 유지 |
| AC2 | ⚠️ | main 단위·배선·IPC 통합 통과, 실제 Electron 강제 예외 실기 미실행 |
| AC3 | ✅ | 양 reporter 로그 선행 각 1, main 수신 renderer 로그 0 |
| AC4 | ✅ | renderer 4레이어 호출, boundaries 오류 0 |
| AC5 | ✅ | main 4레이어 호출, reporter 테스트 Electron mock 없이 4건 통과 |
| AC6 | ✅ | TOAST 33행 + Tweak/send/load/bypass 행동 4곳 통과 |
| AC7 | ✅ | 비대상 57 catch 보고 0, 각각 금지 보고 삽입 검출 |
| AC8 | ✅ | silent 집합 = 허용 4, 신규·기존 파일 위반 모두 red |
| AC9 | ✅ | M-표 24행의 25호출 event/title 유지, 발행 예외 2곳 로그 결합 |
| AC10 | ✅ | 최신 3장·같은 키 seq 증가/만료 재설정·500ms 재적중 무시 |
| AC11 | ✅ | 4599ms 카드 유지/4600ms 제거, dismiss 즉시 제거·타이머 정리 |
| AC12 | ✅ | 실패·실패·성공·실패 → 로그 3, 보고 2 |
| AC13 | ⚠️ | 클래스·두 테마 alias/shadow·4스톱 소스 단언 통과, 시각 실기 미실행 |
| AC14 | ✅ | 부팅 queue/drain·FIFO 10·cooldown·destroyed·send 경합 테스트 통과 |
| AC15 | ✅ | ResizeObserver benign 두 문구 → 로그 0·카드 0 |
| AC16 | ✅ | push/sink/logger 예외를 보고 경로 밖으로 전파하지 않음 |
| AC17 | ✅ | IPC 문서 3테스트·인벤토리/링크 gate 통과 |

검산: ✅ 15 · ⚠️ 2 · ❌ 0 = AC 17. `Criteria-Met: 15/17`; pending은 AC2·AC13 사람 실기다.

## [구현자 기입] Review Signals — 사실만

- 현재 라운드 r1 / impl 턴 r1. 이전 verify/FAIL은 없으며, 사용자 스타일 정정을 ΔV1으로 먼저 분리했다.
- 반복 결함 여부: 첫 구현이라 이전 라운드 비교 해당 없음. 구현 중 기존 구조 검사 두 개의 전제가 새 구조와 달라져 감도를 유지하면서 보정했다.
- 환경 한계: sandbox의 사용자 디렉터리 EPERM으로 파일·스크립트 테스트 실패. 승인된 재실행에서 전부 통과했다. ABI 변경이나 패키지 재설치는 하지 않았다.
- 사람 실기 두 항목은 테스트 통과로 대체하지 않았다. 독립 검증 결과는 검증자가 기록한다.

---

## [구현자 기입] 설계 리뷰 (r1.2 · ΔV2)

- 동의 / 그대로 진행: ΔV2 범위 5표면을 그대로 구현했다. 공통 헬퍼 `features/chat/lib/artifactIssueReport.ts` 한 곳이 제목·설명을 만든다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. D-001(transcript 오류 이벤트)은 건드리지 않았다.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-21 | 선제 표시 제거 | EP-16 (5: 상태 줄 1 · 비활성 4) | 5/5 | `rg -n "disabled=\{disabled\}\|file\?\.busy && transcript" ArtifactCard.tsx` → 비활성 4(다운로드·저장·위치 열기·휴지통) + 상태 줄 1 · `present`/`checking`/`onRefresh` 0건 | — |
| VP-22 | 동작 시 toast | EP-17 (4) | 4/4 | `rg -n "reportArtifactIssue\(\|reportError\(" ArtifactCards.tsx artifactViewerStore.ts useArtifactViewerActions.ts TaskContextContent.tsx` → 1·1·2(결과·catch)·1 | — |
| VP-23 | 제목·설명 SSOT | EP-18 (1) | 1/1 | 세 결과 경로가 `reportArtifactIssue` 만 호출(위 rg) | — |
| VP-16 | 레지스트리 | EP-4 (33→35) | 35/35 | `reportSites.registry.test.ts` T34·T35 행 + 기존 삭제·주입·맞바꿈 변이 케이스 통과 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음. `TaskOutputContent` 목록 조회 실패·레거시 첨부(경로 없음) 비활성은 파일 가용성 표시가 아니라 비범위로 둔다(아래 잠재 문제 2).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-21 | REQUIRED | SELF_PASS | `ArtifactCard.render.test.ts` 8건 통과 | M1·M2 red |
| VP-22 | REQUIRED | SELF_PASS | lifecycle·viewer store·viewer actions·TaskContext 테스트 통과 | M3~M7 red |
| VP-23 | REQUIRED | SELF_PASS | `artifactIssueReport.test.ts` 2건 | M8 red(선택 외 추가 검사) |
| VP-16 | REQUIRED | SELF_PASS | 레지스트리 전건 통과 | M6·M7 에서 레지스트리 red 포함 |
| VP-02 | REGRESSION | SELF_PASS | 헬퍼 테스트가 로그 호출 3건 관측 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `ArtifactCard.tsx` 상태 줄 조건을 `!present` 로 원복 | VP-21 선택 증거 | 최초 | render 2건 | 잠김 |
| M2 `disabled` 에 `!present` 재추가 | VP-21 선택 증거 | 최초 | render 3건 | 잠김 |
| M3 `ArtifactCards.tsx` `reportArtifactIssue` 호출 제거 | VP-22 선택 증거 | 최초 | lifecycle 2건 | 잠김 |
| M4 `artifactViewerStore.ts` 보고 제거 | VP-22 선택 증거 | 최초 | store·actions 2건 | 잠김 |
| M5 뷰어 다운로드 결과 보고 제거 | VP-22 선택 증거 | 최초 | actions 1건 | 잠김 |
| M6 뷰어 catch `reportError` 제거 | VP-22 선택 증거 | 최초 | actions+레지스트리 4건 | 잠김 |
| M7 TaskContext catch `reportError` 제거 | VP-22 선택 증거 | 최초 | TaskContext+레지스트리 3건 | 잠김 |
| M8 `io-error` 를 fileUnavailable 목록에서 제거 | 새 oracle 민감도 | 최초 | helper 1건 | 잠김 |

- **분모 검산**: 선택 증거 7 · 인용 변이 0 · 새 oracle 1 = 표 행 8. 모든 변이 후 원본 복원(`git status` 변경 파일 17 동일).
- **덮개 회귀**: 기존 레지스트리 변이(삭제·금지 주입·맞바꿈)는 T34·T35 로 대상이 늘었고 전건 통과 — 0건.

## [구현자 기입] Product/UX 파생 검토 (r1.2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구에 소비자가 있는가 | `errors.toast.fileUnavailable` → ErrorToastHost 제목. 설명은 기존 `chat.artifacts.*`·`chat.taskTile.*` 문구 재사용 | — |
| 실패 경로가 Part I 상태표의 어느 행인가 | "새 오류" 행 — 스택·병합 규칙 그대로 | — |
| "아무 일도 안 일어남"으로 보이지 않는가 | 동작마다 toast. 이미 진행 중(`busy`)만 보고 생략 — 그동안 버튼 비활성 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 뷰어는 request 불일치면 닫지도 알리지도 않음(테스트). 카드 동작은 세션을 떠나도 사유를 알림 — 사용자가 요청한 동작이라 의도적 | — |
| 미리보기 불가 시 | 뷰어가 로딩으로 열렸다가 닫히고 toast. 형식 미지원은 본문 유지 | 시각 실기에서 확인 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 가용성이 표시되지 않아도 `refreshArtifactStatuses` 는 카드 마운트마다 계속 돈다 | ⚠️ 보고만 — 표시 소비자가 사라져 IPC 절약 여지. 제거는 lastTrashedAt 등 다른 소비 확인 필요 | `ArtifactCards.tsx` effect |
| 2 | TaskContext 의 레거시 첨부(경로 없음)는 비활성으로 렌더된다 | ⚠️ 보고만 — 파일 삭제가 아니라 기록에 경로가 없는 경우. D-011 적용 여부는 사용자 판단 | `TaskContextContent.test.ts` "이전 첨부.txt" |
| 3 | `background.missing`/`denied` 등 출력 가용성 문구 키가 카탈로그에 있으나 렌더 사용처 0 | ⚠️ 보고만 — 죽은 키 정리 후보 | `rg "background\.(missing\|denied)" renderer/src --glob '*.tsx'` → 0 |

### 설계 대비 명시적 차이

- 없음.

## [구현자 기입] 구현 보고 (r1.2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `shared/app-error.ts` · ko/en · `features/chat/lib/artifactIssueReport.ts`(신규) · `ArtifactCard.tsx` · `ArtifactCards.tsx` · `rightpanel/ArtifactViewer.tsx` · `rightpanel/TaskContextContent.tsx` · `hooks/useArtifactViewerActions.ts` · `store/artifactViewerStore.ts` + 테스트 7 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run`(전체) · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts:22`) · typecheck `error TS` 0 · vitest 594파일: 585 pass · 1 skip · **8 파일 로드 실패**(테스트 0 실패, 5623 pass) — 전부 `src/main/app/**`, `Electron failed to install correctly`(환경 — 변경 stash 후에도 동일 red 2/2 재현) · inventory prose/links ok |
| V-pair 자기확인 | SELF_PASS 5 / SELF_BLOCKED 0 |
| 강제 지점 전수 | 43/43 (EP-16 5 · EP-17 4 · EP-18 1 · EP-4 33→35) |
| **AC 자기보고** | AC18 ✅ render 8건 · AC19 ✅ lifecycle 6 결과 케이스 · AC20 ✅ store 3건 + actions 1건 · AC21 ✅ actions copy/download · AC22 ✅ TaskContext 1건 |
| **합계 검산** | ΔV2 분모 5: ✅ 5 · ⚠️ 0 · ❌ 0 = 5 (V1+ΔV1 AC1~17 은 r1 PASS 유지, 분모 변경으로 합산 비교 안 함) |
| 블로커 / 역질문 | 없음 — 위 잠재 문제 2는 사용자 판단 대상 |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- 이번 턴은 사용자 요구 변경(ΔV2)이며 이전 라운드 결함 수정이 아니다.
- 반복 환경 한계: Electron 바이너리 미설치로 main app 스위트 8파일이 로드 단계에서 실패.
- 현재 라운드·impl 턴: `r1.2`.

## [구현자 기입] 설계 리뷰 (r1.3 · ΔV3)

- 동의 / 그대로 진행: 생성 파일은 ΔV2 경로를 이미 공유한다. 두 틈(`skipped` 무보고 · `file-changed` 소실)만 닫았다.
- 이견 / 현실성 문제: 없음. `IPC_CONTRACT.md:191` 은 저장 사유 값을 열거하지 않아 문서 변경 불필요.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.3)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-24 | skipped·file-changed 보고 | EP-19 (3) | 3/3 | `rg -n "skipped" lib/artifactOperationIssues.ts` 1 · `rg -n "'file-changed'" main/app/handlers/artifacts.ts lib/artifactIssueReport.ts lib/artifactFeedback.ts` 각 1 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음. 뷰어 다운로드는 `items[0].outcome !== 'saved'` 면 이미 보고하므로 `skipped` 포함(ΔV2 코드 확인).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-24 | REQUIRED | SELF_PASS | operationIssues·helper·handlers·lifecycle 테스트 | M9~M11 red |
| VP-21 | REGRESSION | SELF_PASS | render 테스트가 `category:'file'` 로도 반복 | — |
| VP-22 | REGRESSION | SELF_PASS | ΔV2 테스트 전건 통과 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.3)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M9 `artifactOperationIssues.ts` `skipped` 조건 제거 | VP-24 선택 증거 | 최초 | 2건 | 잠김 |
| M10 `handlers/artifacts.ts` `reasonOf` 에서 `file-changed` 제거 | VP-24 선택 증거 | 최초 | 1건 | 잠김 |
| M11 `artifactIssueReport.ts` 목록에서 `file-changed` 제거 | VP-24 선택 증거 | 최초 | 1건 | 잠김 |

- **분모 검산**: 선택 증거 3 · 인용 변이 0 · 새 oracle 0 = 표 행 3.
- **덮개 회귀**: 0건 — ΔV2 변이 대상 코드는 바꾸지 않았다.

## [구현자 기입] Product/UX 파생 검토 (r1.3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구에 소비자가 있는가 | `chat.artifacts.changed` → 토스트 설명(`artifactFailureKey`) | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 삭제된 파일 저장이 이전엔 토스트 0 → 이제 1 | — |
| 저장 창을 거친 뒤에야 없음을 안다 | 핸들러가 창 선택 후 읽는다 — 사용자는 위치를 고른 뒤 토스트를 본다 | ⚠️ 보고만(아래 1) |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 단건 저장은 저장 창을 먼저 띄우고 그 뒤 읽기가 실패한다 | ⚠️ 보고만 — 창 전에 존재 확인을 넣을지는 제품 판단 | `handlers/artifacts.ts` 저장 흐름(창 → `readForExport`) |

### 설계 대비 명시적 차이

- 없음.

## [구현자 기입] 구현 보고 (r1.3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `main/app/handlers/artifacts.ts` · `lib/artifactOperationIssues.ts` · `lib/artifactFeedback.ts` · `lib/artifactIssueReport.ts` · ko/en + 테스트 5 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run src/renderer/src/features/chat src/renderer/src/shared/errors src/main/app/handlers/artifacts.test.ts` |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존) · typecheck `error TS` 0 · vitest 206파일 1785케이스 전건 통과. 전체 스위트의 main app 8파일 로드 실패(Electron 미설치)는 r1.2 와 동일한 환경 한계 |
| V-pair 자기확인 | SELF_PASS 3 / SELF_BLOCKED 0 |
| 강제 지점 전수 | 3/3 |
| **AC 자기보고** | AC23 ✅ operationIssues·lifecycle skipped 케이스 · AC24 ✅ render `category:'file'` 반복 · AC25 ✅ helper `file-changed` + handlers 보존 케이스 |
| **합계 검산** | ΔV3 분모 3: ✅ 3 · ⚠️ 0 · ❌ 0 = 3 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1.3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.3)

- `skipped` 무보고는 ΔV2(r1.2)가 선제 표시를 없애면서 드러난 누락이다 — ΔV2 AC19 가 `failed` 만 예시로 들어 걸리지 않았다.
- 현재 라운드·impl 턴: `r1.3`.

## [구현자 기입] 설계 리뷰 (r1.4 · ΔV4)

- 동의 / 그대로 진행: 열기를 `opening`(대기) → 결과 → `selection`(할당) 두 단계로 나눴다. 재시도 경로는 ΔV2 그대로.
- 이견 / 현실성 문제: 없음. 카탈로그 이탈 정리(`useArtifactCatalogViewer.tsx`)도 `opening` 을 함께 취소하도록 넓혔다 — ΔV4 AC28 의 카탈로그 쪽 자리.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.4)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-25 | 결과 후 할당 | EP-20 (3) + 카탈로그 정리 1 | 4/4 | `rg -n "setState\(\{ opening\|opening: null\|opening=\{" artifactViewerStore.ts ArtifactCards.tsx` · `rg -n "opening\?\.sessionKey" app/hooks/useArtifactCatalogViewer.tsx` → open 선할당 없음·close 해제 1·카드 전달 1·카탈로그 1 | — |

- `openArtifactViewer` 가 `selection` 을 세우는 곳은 결과 뒤 1곳뿐: `rg -n "selection: \{" artifactViewerStore.ts` → open 1 · retry 1(이미 열린 뷰어).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-25 | REQUIRED | SELF_PASS | store 3건·lifecycle 2건·actions 1건·render 1건 | Ma·Mb red (+Mc·Md) |
| VP-22 | REQUIRED(CHANGED) | SELF_PASS | 재시도 불가 → 닫기+toast 케이스 유지 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.4)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| Ma `openArtifactViewer` 가 대기 전에 로딩 selection 을 세움(옛 순서) | VP-25 선택 (a) | 최초 | 6건 | 잠김 |
| Mb `closeArtifactViewer` 의 `opening` 해제 제거 | VP-25 선택 (b) | 최초 | 3건 | 잠김 |
| Mc `ArtifactCards` 의 `opening` prop 전달 제거 | 배선 oracle 민감도 | 최초 | 2건 | 잠김 |
| Md `ArtifactCard` `aria-busy` 무효화 | 배선 oracle 민감도 | 최초 | 1건 | 잠김 |

- **분모 검산**: 선택 증거 2 · 인용 변이 0 · 새 oracle 2 = 표 행 4.
- **덮개 회귀**: 0건 — ΔV2·ΔV3 테스트 전건 유지(아래 게이트).

## [구현자 기입] Product/UX 파생 검토 (r1.4)

| 질문 | 판정 | 후속 |
|---|---|---|
| 불가 파일에서 공간 할당이 사라졌는가 | 결과 전 `selection` 0 → 할당 0 (AC26 구독 기록 0건) | 사람 실기 재확인 |
| 정상 파일의 로딩 표시가 사라져 반응이 없어 보이지 않는가 | 대기 중 카드 미리보기 버튼 `aria-busy` + 진행 커서. 로컬 파일 미리보기라 대기는 짧다 | 느린 파일 체감은 사람 실기 |
| 카탈로그 행은 대기 표시가 없다 | 레이어 규칙상 `features/artifacts` 가 chat store 를 볼 수 없다 | ⚠️ 보고만(아래 1) |
| 다른 뷰어가 열린 채로 불가 파일을 누르면 | 기존 뷰어 유지 + toast | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.4)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 카탈로그 화면은 대기 중 행 표시가 없다 | ⚠️ 보고만 — 필요하면 app 레이어에서 `opening` 을 props 로 내려준다 | `app/hooks/useArtifactCatalogViewer.tsx` |

### 설계 대비 명시적 차이

- 없음(카탈로그 정리 취소는 AC28 의 같은 불변식 자리를 닫은 것).

## [구현자 기입] 구현 보고 (r1.4)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `store/artifactViewerStore.ts` · `components/ArtifactCards.tsx` · `components/ArtifactCard.tsx` · `app/hooks/useArtifactCatalogViewer.tsx` + 테스트 4 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run src/renderer src/shared src/main/app/handlers/artifacts.test.ts` |
| **관측한 게이트 산출** | lint 0 error · 1 warning(기존) · typecheck `error TS` 0 · vitest 299파일 2471케이스 전건 통과(AC29 첫 초안 단언이 클래스명 `aria-busy:` 에 걸려 속성 단언으로 고친 뒤) · prettier 통과 |
| V-pair 자기확인 | SELF_PASS 2 / SELF_BLOCKED 0 |
| 강제 지점 전수 | 4/4 |
| **AC 자기보고** | AC26 ✅ 구독 기록 0·기존 selection 동일 참조 · AC27 ✅ 대기 중 null → 결과 후 1회 · AC28 ✅ close 후 늦은 결과 무시·중복 클릭 preview 1회 · AC29 ✅ `aria-busy="true"` 는 대기 카드만 |
| **합계 검산** | ΔV4 분모 4: ✅ 4 · ⚠️ 0 · ❌ 0 = 4 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1.4 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.4)

- ΔV2 AC20 이 "닫힌다"는 **최종 상태**만 단언해 중간의 공간 할당(플리커)을 보지 못했다. 사람 실기가 잡았다. ΔV4 는 상태 변화 이력(구독 기록)을 단언한다.
- 현재 라운드·impl 턴: `r1.4`.

## [구현자 기입] 설계 리뷰 (r1.5 · ΔV5)

- 동의 / 그대로 진행: D-015~D-019와 AC30~38을 구현한다. 보드의 Claude 구현 표기는 이번 사용자 `handoff-impl 242` 재개 요청으로 Codex가 승계한다.
- 기준선: 원격 main과 동일한 트리에서 시작, 로컬 변경 0. 이번 턴은 사용자 요구 변경이므로 r1.5이며 review의 반복 실패 트리거에 해당하지 않는다.
- 작업 목록: REQUIRED VP-26~30·VP-06·VP-15, REGRESSION VP-11·VP-08·VP-02. 강제 지점 EP-21~25와 상속 EP-7·EP-10·EP-13·EP-15·EP-2를 대조한다.
- 필수 gate: lint·node/web/test typecheck·관련 및 전체 Vitest·inventory·diff·trailer. AC30 실제 창 말줄임과 기존 AC2·AC13·ΔV4 실기는 기계 단언과 구분한다.
- 기존 NON_BLOCKING D1~D12는 요구 확장으로 취급하지 않는다. 이번 변경이 만지는 Host 마운트·키·target 전달·로그 경로를 우선 검사한다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 (r1.5)

| Pair | 계약 / §10 자리 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-26 | EP-21 설명 말줄임 1 | 소스 1/1 | `ErrorToastHost.actions.test.ts` 설명에만 `line-clamp-8`, 제목에는 없음 | AC30 사람 실기 |
| VP-27 | EP-22 클릭·분기·가드 7 | 7/7 | Host 본문 onOpen·dismiss·형제 ×, target 함수 page·settings·fallback·가드. actions 4건 + target 12건 통과 | 없음 |
| VP-28 | EP-23 target 운반 5묶음 | 18/18 | 아래 운반 자리 목록. reporter 단위와 실제 hub→handler/sink→bridge→store 통합에서 page/settings 보존 | 없음 |
| VP-29 | EP-24 IPC 5묶음 | 12/12 | 채널·preload·API 각 1, handler 6(아래), Layer 1, 경로 facade·transport 2. handler 3건·Layer 1건·preload 1건·경로 2건 통과 | 탐색기 UI 사람 실기 |
| VP-30 | EP-25 병합 1 | 1/1 | 모델 테스트: 500ms 동일 참조, 1200ms 새 target, 2400ms undefined; id·key·카드 수 유지 | 없음 |
| VP-06 | EP-7 cap·dedupe·cooldown 3 | 3/3 | model/store 기존 테스트: 최신 3장·병합 seq·4599/4600ms 만료·dismiss | 없음 |
| VP-15 | EP-15 App 마운트 1 | 1/1 | App 트리에서 RootGate 형제인 Layer 1; Layer 테스트에서 Host + 실제 의존성 전달 | 없음 |
| VP-08 | EP-10 두 테마 2 | 소스 2/2 | Host render: 기존 grid·반경·그림자·폰트·시맨틱 alias·4.6초 유지 | AC13 두 테마 사람 실기 상속 |
| VP-11 | EP-13 IPC 문서 | 채널·payload 동기화 | `ipc-documentation.test.ts`와 inventory check; `orca:error:revealLog`·`AppErrorReport.target` 문서 검색 | 없음 |
| VP-02 | EP-2 로그 5 | 5/5 | 두 reporter 로그 선행, main 수신 로그 0, scheduler/config 별도 발행 2파일 유지; reveal 실패 로그 1 | 없음 |

- 검색 단위는 `target` 대입만이 아니라 **AppErrorReport 운반**이다. `rg -n 'AppErrorReport|presentErrorReport|errorReportEvent|errorDrain|errorToastStore' app/src -g '!*.test.ts'`와 각 경로의 `report|pending|sink|markReady|subscribe|applyErrorReport`를 대조했다.
- EP-23의 18자리: 명시된 reporter 3 + bridge 이벤트·drain 2, 객체를 그대로 넘기는 hub ready·pending·markReady 3, sink 1, drain helper·handler 2, preload onReport·subscribe·drain 3, bridge present 1, presenter 1, store push→model 1, model 신규 spread 1. 병합은 EP-25, Host 클릭 전달은 EP-22/24에 따로 센다. 기존 preload 경로는 소스 대조이며 통합 테스트는 main/renderer 사이 API를 연결한다.
- EP-24 handler 6자리: flush → 현재 경로 → 존재 검사 → 파일 선택 / 폴더 열기 → 오류 문자열 throw. `rg -n 'errorRevealLog|revealLog|currentLogFilePath|logFilePath|flushLogSync|showItemInFolder|openPath'`로 변경 경로를 대조했다. 경로 SSOT는 file-transport의 `DEFAULT_BASE`이며 초기화 전·열린 중·close 뒤 실파일 경로 테스트를 통과했다.
- `rg -n 'ErrorToastLayer|RootGate|ChatProvider|BrowserRouter' app/src/renderer/src/App.tsx`에서 Layer가 Router와 ChatProvider 안, RootGate 형제임을 재확인했다. 기존 report 호출 사이트에 target을 지정하는 변경은 없다(D-019).

| Pair | requiredness | 자기 상태 | 직접 관측 / 남은 증거 |
|---|---|---|---|
| VP-26 | REQUIRED | SELF_BLOCKED | 설명 클래스·맞바꿈 변이 검출. 900×670 실기 미실행 |
| VP-27 | REQUIRED | SELF_PASS | page·settings·무효/없음·reveal 실패·본문/닫기 동작 통과 |
| VP-28 | REQUIRED | SELF_PASS | renderer·main 두 생산자·publish·이벤트·drain target 보존, 지정 변이 5자리 검출 |
| VP-29 | REQUIRED | SELF_PASS | 실제 등록 IPC handler·공개 preload·Layer 의존성 연결, 지정 변이 2자리 검출 |
| VP-30 | REQUIRED | SELF_PASS | target 교체·제거와 키 보존 직접 단언 |
| VP-06 | REQUIRED | SELF_PASS | cap·cooldown·병합·타이머 기존 회귀 통과 |
| VP-15 | REQUIRED | SELF_PASS | App→Layer→Host, Layer 삭제 변이 2건 실패 |
| VP-11 | REGRESSION | SELF_PASS | IPC 문서 및 inventory 검사 통과 |
| VP-08 | REGRESSION | SELF_BLOCKED | 클래스·토큰 회귀 통과. 기존 두 테마 시각 실기 대기 유지 |
| VP-02 | REGRESSION | SELF_PASS | reveal 실패 로그 동반, 기존 중복 로그·제3 발행 파일 변이 검출 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.5)

실행: `node docs/handoff/0242-error-toast-reporter/evidence/r1.5-mutations.cjs`. 각 production 변이를 실행한 뒤 원본 바이트로 복구했다. 관측 파일: [r1.5-mutations.json](evidence/r1.5-mutations.json).

| 심은 결함 / evidence id | 출처 | 이전 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| VP-26-clamp-swap: 설명→제목 clamp 이동 | VP-26 선택 | 최초 | Host actions 1 | 검출 |
| VP-27a-dismiss: 본문 dismiss 제거 | VP-27 선택 | 최초 | Host actions 2 | 검출 |
| VP-27b-close-opens: ×에서 onOpen 실행 | VP-27 선택 | 최초 | Host actions 1 | 검출 |
| VP-27c-branch-swap: page/settings 맞바꿈 | VP-27 선택 | 최초 | target 1 | 검출 |
| VP-27d-invalid-guard: 가드 제거 | VP-27 선택 | 최초 | target 8 | 검출 |
| VP-28-renderer-target: renderer 누락 | VP-28 선택 | 최초 | renderer reporter 1 | 검출 |
| VP-28-main-target: main reporter 누락 | VP-28 선택 | 최초 | main reporter·통합 2 | 검출 |
| VP-28-publish-target: publish 누락 | VP-28 선택 | 최초 | main reporter·통합 2 | 검출 |
| VP-28-event-target: 이벤트 수신 누락 | VP-28 선택 | 최초 | 통합 1 | 검출 |
| VP-28-drain-target: drain 수신 누락 | VP-28 선택 | 최초 | 통합 1 | 검출 |
| VP-29-flush: handler flush 제거 | VP-29 선택 | 최초 | handler 2 | 검출 |
| VP-29-layer-noop: Layer onOpen no-op | VP-29 선택 | 최초 | Layer 1 | 검출 |
| mount-regression: App Layer 제거 | 교체한 마운트 oracle | r1 Host 제거 red | App·Host render 2 | 검출 유지 |
| animation-key: seq 키 제거 | 새 구조 oracle / D2 참고 | 미잠금 | Host actions 4 | 검출 |
| preload-channel: revealLog→drain 채널 | 새 배선 oracle | 최초 | preload 1 | 검출 |
| api-noop: renderer API no-op | 새 배선 oracle | 최초 | preload·Layer 2 | 검출 |
| VP-02a-regression: main 수신 중복 로그 | VP-02 상속 선택 | r1 red | bridge 1 | 검출 유지 |
| VP-02b-regression: 제3 publish 파일 | VP-02 상속 선택 | r1 red | main registry 1 | 검출 유지 |

- **분모 검산**: 선택 증거 14(ΔV5 12 + VP-02 상속 2) · 인용 변이 0 · 신규/교체 oracle 4 = 표 행 18. VP-26은 변이를 검출했어도 사람 실기 전 SELF_PASS로 올리지 않는다.
- 덮개 회귀 확인: 기존 Host 직접 마운트 검사를 Layer 경유 검사로 바꿨다. 대응 마운트 제거가 여전히 red다. VP-30·VP-06은 직접 결과 oracle이며 새 변이를 만들지 않았다.

## [구현자 기입] Product/UX 파생 검토 (r1.5)

| 질문 | 판정 | 후속 |
|---|---|---|
| 클릭이 실제 소비자까지 가는가 | 본문→Layer→라우터/설정 또는 IPC. 기존 사이트에는 target이 없으므로 로그 위치를 연다 | D-019 유지 |
| 닫기가 뜻하지 않은 이동을 만드는가 | 형제 × 버튼은 dismiss만 호출; 본문과 × 각각 테스트 | 없음 |
| 로그 폴더 열기 실패가 무반응으로 보이는가 | OS 오류 문자열→IPC reject→기존 `openFailed` 번역·토스트 1·로그 1 | 없음 |
| 긴 설명과 입력 접근성 | 설명만 clamp, 본문은 기본 키보드 활성화를 지원하는 button, 기존 focus·motion-reduce 유지 | 3장·8번째 줄 말줄임·두 테마 실기 대기 |
| 비동기 실패가 이전 카드를 다시 살리는가 | 클릭 카드는 즉시 dismiss, reveal 실패는 별도 보고로 들어온다 | 기존 report cooldown 정책 유지 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.5)

| # | 문제 / 관측 | 대응 | 근거 |
|---|---|---|---|
| 1 | 로그 초기화 전 또는 close 뒤 transport가 없을 수 있다 | ✅ fallback도 같은 파일명 SSOT 사용. 전·중·후 getter와 실파일을 테스트 | `infra/log/index.test.ts` |
| 2 | 기존 D2의 animation key를 이번 카드 구조 변경이 건드릴 수 있다 | ✅ seq=1의 key를 직접 단언하고 seq 제거 변이 4건 실패. 검증자 이슈 상태는 검증자가 재판정 | `ErrorToastHost.actions.test.ts` |
| 3 | `shell.showItemInFolder` 반환값에는 OS 창 성공 여부가 없다 | ⚠️ 보고만. 파일 선택 요청까지 기계 검증하며 실제 탐색기 표시는 사람 실기 | `handlers/error.ts` |

### 설계 대비 명시적 차이

- 계약 변경 없음. 기존 preload 추론 타입이 API 변경을 전달하므로 `env.d.ts` 별도 선언은 필요 없다. Host 내부 버튼은 CSS subgrid로 기존 카드 열을 공유한다.
- 경로 getter가 transport 부재 때도 값을 반환하도록 파일명 helper를 공유했다. 만료·재진입·공유 캐시 무효화는 해당 없음(캐시를 신설하지 않음); transport close 축은 실제 로그 테스트로 재확인했다.
- 신규 의존성·PLAN_GAP 없음. 기존 D1·D3~D12는 이번 변경 범위 밖으로 유지한다.

## [구현자 기입] 구현 보고 (r1.5)

| 항목 | 내용 |
|---|---|
| 변경 파일 | shared target/IPC, main reporter·로그 경로·reveal handler, preload/API, 모델·Host·app Layer·target 실행기, settings 탭 타입, 관련 테스트·IPC/observability/inventory |
| 실행 명령 | `npm run lint` · `npm run typecheck` · 관련/전체 `npx vitest run` · 위 mutation runner · `node scripts/check-doc-inventory.mjs --check` · `git diff --check` |
| **관측한 게이트 산출** | lint 0 error·기존 warning 1, typecheck node/web/test 3종 오류 0. 관련 16파일 255건 + 추가 log/preload 2파일 16건 통과. 전체 599파일: 5691 통과·1 skip·0 실패. inventory·diff 통과, 변이 18/18 검출 |
| V-pair 자기확인 | SELF_PASS 8 / SELF_BLOCKED 2(사람 실기) |
| 강제 지점 전수 | 위 자리 표 참조. EP-23/24 묶음을 실제 전달·실행 위치로 펼쳐 기록 |
| **AC 자기보고** | 아래 개별 행 참조 |
| **합계 검산** | ΔV5 분모 9: ✅ 8 · ⚠️ 1 · ❌ 0 = 9. ΔV4 분모 4와 직접 비교하지 않음 |
| 블로커 / 역질문 | PLAN_GAP 없음. AC30과 상속 시각 실기 미실행 |
| 대상 커밋 | `(r1.5 구현 — 좌표는 INDEX)` |

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC30 | ⚠️ | 설명에만 clamp 8 단언 및 맞바꿈 검출. 900×670 한글 설명 3장 실기 미실행 |
| AC31 | ✅ | Host page/없음 각각 onOpen 1·선택 카드만 제거; × onOpen 0 |
| AC32 | ✅ | page 1·settings 세 형태·없음/무효 target 10사례의 호출 기록 |
| AC33 | ✅ | reveal reject→store `openFailed` 1·`errors.reveal-log.failed` 로그 1 |
| AC34 | ✅ | renderer/main/publish 단위 + 실제 main sink·drain→bridge→store target |
| AC35 | ✅ | target 교체/제거, id·key·카드 수 유지, cooldown 동일 참조 |
| AC36 | ✅ | handler 파일 선택 순서·폴더 fallback·OS 오류 reject 3건 |
| AC37 | ✅ | App Layer 1·Host 타입·실제 settings show/API 의존성, mount/no-op 검출 |
| AC38 | ✅ | IPC 문서 테스트·inventory 9항목 100채널 일치, 현재 문서 수치 중복·끊긴 상대 링크 없음 |

**합계 재검산:** AC30~38 9행에서 ✅ 8 · ⚠️ 1 · ❌ 0. 구현 trailer의 `Criteria-Met`은 `8/9`로 적는다.

- 전체 첫 실행은 샌드박스의 사용자 폴더 `stat/lstat EPERM` 영향으로 11파일 109건 실패했다. 권한을 확보한 동일 전체 명령 재실행에서 599파일이 통과했고, 첫 실패 집합에서 최종 통과 집합을 뺀 결과는 0건이다. 실패 파일 목록과 수치는 [r1.5-gates.json](evidence/r1.5-gates.json)에 남겼다.
- skip 1은 환경 변수로 opt-in하는 기존 `artifact-sdk-live.test.ts`의 P02 실제 SDK 테스트다. lint 자동 수정은 이번 변경 파일에만 적용됐으며 네이티브 ABI는 변경하지 않았다.
- 산출 검산: 보고의 AC 행 9·✅ 8·⚠️ 1, mutation runner 등록 18과 관측 JSON의 차집합 양방향 0. 상태 정본은 plan 메타·INDEX 모두 `impl/IMPL_DONE`, 다음 Claude로 맞춘다. 커밋 뒤 trailer 파싱을 확인한다.

## [구현자 기입] Review Signals — 사실만 (r1.5)

- 사용자 요구 변경 ΔV5 구현이며 이전 FAIL 재구현이 아니다. 현재 라운드·impl 턴은 `r1.5`.
- 기존 동작상 정상이나 미잠금으로 기록된 D2는 이번 카드 변경에 맞춰 key 단언과 변이를 추가했다. 독립 verify 판정은 하지 않았다.
- 첫 lint에서 신규 테스트 helper 반환 타입 누락 2건을 검출해 고쳤다. 최종 lint는 오류 0·기존 virtualizer 경고 1이다.
- 전체 gate의 첫 실패는 샌드박스 파일 접근 제한이었다. 승인된 재실행으로 109건 모두 회복돼 환경 한계로만 기록했다.
- 사람 실기(AC30·기존 AC2/AC13·ΔV4)는 자동 소스 단언으로 대체하지 않았다. 네이티브 ABI 변경이나 의존성 설치는 수행하지 않았다.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 레지스트리가 `reportError` 식별자만 본다 — 로컬 no-op 섀도잉이 green | VP-04 (oracle 충족) | import 결합 단언 검토 | NON_BLOCKING | open |
| D2 | Host `key={id:seq}` 미잠금 — 동작은 정상 | §11 카드 계약 | key 단언 추가 검토 | NON_BLOCKING | closed (r1.5 key 단언, `seq` 제거 변이 red) |
| D3 | 같은 webContents reload 중 main 보고 유실 | 비귀속 | 탐색 시작 시 `forget` 검토 | NON_BLOCKING | open |
| D4 | bridge `seen` 무상한 증가 | 비귀속 | 상한 정책 | NON_BLOCKING | open |
| D5 | `errors.bridge.failed` 자리가 표·레지스트리 밖 | D-004 | 레지스트리 행 추가 | NON_BLOCKING | open |
| D6 | renderer T1 카드 설명에 step id 없음 | 비귀속 UX | detail에 id 포함 | NON_BLOCKING | open |
| D7 | ΔV1 설계 커밋 `Agent: codex`·D-010 원 대화 부재·증거 로그의 로컬 사용자 경로 | 운영 규칙 | 사용자 확인·경로 마스킹 | NON_BLOCKING | open |
| D8 | 카탈로그 이탈 정리의 `opening` 취소 미잠금 — 동작은 정상 | VP-25 (§10 표 밖) | 카탈로그 hook 정리 테스트 | NON_BLOCKING | open |
| D9 | 카드 busy selector의 `sessionKey` 조건 미잠금 | VP-25 AC29 (충족) | 같은 publicationId·다른 key 케이스 | NON_BLOCKING | open |
| D10 | `docs/arch/frontend/rendering.md:206`이 제거된 "다시 확인"·불가 상태 표시를 서술 | 운영 규칙 | 문장 정정 | NON_BLOCKING | open |
| D11 | 끝나지 않는 preview에서 카드 busy 지속·재클릭 무시, 기존 뷰어 닫기가 대기 열기도 취소 | ΔV4 설계 부작용 | 필요 시 사용자 판단 | NON_BLOCKING | open |
| D12 | `chat.artifacts.checking` 키 참조 0 | 비귀속 | 죽은 키 정리 | NON_BLOCKING | open |
| D13 | Boot/Gate frame에서는 `AppLayout`·`SettingsModal`이 없어 page/settings 대상 클릭이 보이는 변화 없이 카드만 닫힌다 | D-016 (현재 대상 호출부 0, D-019) | 첫 대상 지정 호출부 도입 시 게이트 중 동작 결정 | NEXT_HANDOFF | open |
| D14 | 로그 폴더 열기 실패 toast 설명에 Electron invoke 래퍼 문구가 붙는다 | AC33 (충족) | 래퍼 제거 검토 | NON_BLOCKING | open |
| D15 | plan 메타 `V1@abb4e49a`·`ef3cd63`이 리베이스 전 해시(INDEX 11건은 r1.5 검증에서 교정) | 운영 규칙(좌표) | 설계자 다음 revision에서 `c6cb383`·`077a838`로 정정 | NON_BLOCKING | open |
| D16 | 설계 커밋 `368358f` 제목·본문 사이 빈 줄 누락 | 커밋 형식 | 기록 | NON_BLOCKING | open |
