# Plan — 0320-scheduled-tasks

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0320-scheduled-tasks` |
| 작성자 | Claude Code |
| 일자 | 2026-11-15 |
| 매핑 | 옛 `0287-scheduled-tasks`(브랜치 `a`의 `ce699856` 설계 · `1058886c` 구현 — `main` 미도착)를 현재 `main` 위에 다시 설계 |
| 상태 | READY (ΔV5) |
| V mode | `Baseline V` |
| 기준 V | `none` — 옛 0287 V는 `main`에 없어 상속하지 않고 증거로만 읽는다 |
| 이번 V revision | `ΔV5` — verify r2 `RETURN_TO_PLAN` 정정(확장 후보 E4~E6·E7①~③ 채택 · E7④ 경계 · plan 동결), §24. `ΔV1`~`ΔV4` 위에 적용 |
| 유효 V | `V1` + `ΔV1` + `ΔV2` + `ΔV3` + `ΔV4` + `ΔV5` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 프롬프트나 shell 명령을 정해진 주기로 반복 실행할 방법이 없다. 옛 구현은 분기점 `0e73fb67` 기준이고 `main`은 그 뒤 364커밋 진행해(`git rev-list --count 0e73fb67..HEAD`) 그대로는 컴파일되지 않는다.
- 완료 후 달라지는 것: 사이드바 `예약됨` 메뉴에서 예약 작업을 만들고·켜고 끄고·편집·삭제·즉시 실행하며 실행 이력을 본다. 구현은 현재 `main`의 계약·관례 위에 있다.
- 성공 한 문장: 사용자가 "매일 09:00에 이 프로젝트에서 이 프롬프트/명령"을 한 번 등록하면 앱이 켜져 있는 동안 그 시각마다 실행되고 결과를 이력에서 찾는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | D-001~D-008 | 옛 0287 plan §3 (2026-11-15 세션 요청·질의 응답) |
| 명시 요구 | D-009·D-010 | 이번 세션 두 턴 |
| 추론 의도 | I-1 라벨 `예약됨`(en `Scheduled`), 경로 `/scheduled` | 요청 제목 "스케쥴(예약됨)" |
| 추론 의도 | I-2 앱 실행 중에만 발화, 놓친 실행은 보충하지 않는다 | `app/AGENTS.md` 스택 표 "앱 실행 중만 발화" |
| 추론 의도 | I-3 트리거 4종 = 매시간 / 매일+시각 / 매주+요일 1개+시각 / 사용자 지정(요일 다중+시각). 시각 30분 단위, 로컬 타임존 | 옛 요청 첨부 스크린샷 |
| 추론 의도 | I-4 프로젝트는 두 명령 종류 모두 필수. shell은 폴더가 있는 프로젝트만 | D-007 |
| 추론 의도 | I-5 프롬프트 실행의 `성공` = "대화가 시작됨" | D-005 |
| 추론 의도 | I-6 상한: shell 10분 · 출력 꼬리 64KB · 작업당 이력 50건 · 화면 20건 · 프롬프트 보고 대기 2분 | 설계자 기본값 |
| 추론 의도 | I-7 D-009의 "쓸데없는 코드 구성" = 현재 코드에서 같은 일을 하는 것이 이미 있거나, 한 소비자만 가진 간접층 | §4·§8 실측 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | "nav 메뉴에 스케쥴 메뉴 추가 및 라우팅 페이지 추가. 렌더링 형식은 프로젝트 페이지를 템플릿으로 참조하라. 아이콘은 구글 메테리얼의 'Schedule' 사용할 것" | — | 0287 요청 1 | ACTIVE | — |
| D-002 | "우측 상단의 버튼 템플릿에서는 '새 작업' 텍스트로 렌더링하고 클릭 시 프로젝트 페이지 처럼 모달을 노출." | — | 0287 요청 2 | ACTIVE | — |
| D-003 | 모달 구성: "타이틀 / 프로젝트, 권한, 모델(+노력) / 트리거 방법 / 명령 (프롬프트/shell 명령) 2개 지원" | — | 0287 요청 3 | ACTIVE | — |
| D-004 | "명령 방법은 프롬프트 뿐 아니라 shell 명령도 노출해야 한다. shell 명령을 주기적으로 실행하는 것도 제공해야 함." | — | 0287 요청 3 | ACTIVE | — |
| D-005 | 프롬프트 작업은 매 실행마다 선택한 프로젝트에 새 대화를 만든다 | 컨텍스트 비누적 | 0287 질의 응답 | ACTIVE | — |
| D-006 | 무인 실행 중 승인: "요구사항에 작성한대로 설정된 권한에 맡긴다." 예약 전용 승인 정책을 만들지 않는다 | — | 0287 질의 응답 | ACTIVE | — |
| D-007 | shell은 Windows에서 PowerShell로, 프로젝트 폴더를 cwd로 실행하고 stdout/stderr 꼬리와 종료 코드를 이력에 보관한다. shell 모드에서 권한·모델 필드는 숨긴다 | — | 0287 질의 응답 | ACTIVE | — |
| D-008 | 목록 관리 기능: 켜기/끄기 토글 · 편집·삭제 · 지금 실행 · 실행 이력 보기 | — | 0287 질의 응답 | ACTIVE | — |
| D-009 | "현재 코드베이스를 기준하여 다시 구현해야 한다. … 현재 코드베이스 기준으로 엄격하게 마이그레이션 돼야한다. 또한 쓸데없는 코드 구성을 제거하고, 모듈화 및 재사용을 현재 코드베이스의 규칙에 맞춰 진행하라. 마이그레이션 시 새 핸드오프 번호를 할당하라" | "현재 코드베이슨 최적화 작업이 진행되 것이다. 이것을 기준하여 plan 및 impl 이 다시 진행돼야 한다." | 이번 세션 턴 1 | ACTIVE | — |
| D-010 | "같은 개념의 마이그레이션이라도 현재의 코드베이스를 기반하여 재고려돼야한다. 필요시 재구연이 따라야 할 것" | — | 이번 세션 턴 2 | ACTIVE | — |
| D-011 | "antigravity의 스케쥴 생성 디자인이다. 모달의 구성 및 디자인을 첨부 스크린샷을 참조하여 구성/배치/디자인을 유사하게 구현하라. 단 컬러 테마, 디자인 토큰, orca-skin이 사용하는 디자인 양식을 준수할 것. create, cancel 버튼 배치는 현 상태가 좋다. 모달의 디자인을 예시처럼 더 현대적으로 표현할 것" | 참조: [`assets/modal-ref-custom.png`](assets/modal-ref-custom.png) · [`assets/modal-ref-daily.png`](assets/modal-ref-daily.png) | 이번 세션 턴 3 | ACTIVE | D-003의 구성 요소는 유지, 배치·표현만 바꾼다 |
| D-012 | "프로젝트, 모델, 코드/워크, 노력, 권한.. 을 구성하는 영역의 구성이 현대적이지 않다. 팝업되는 메뉴와 각 컴포넌트의 너비가 항목에 비례에 너무 크게 배치된 점과 무작정 나열까지.. 최악이다. 팝업되는 메뉴는 컴포저에서 사용하던 형태를 사용하라." | 네이티브 `select` 를 없앤다 | 이번 세션 턴 4 | ACTIVE | D-011의 "선택 칩" 표현을 구체화 |
| D-013 | "스케쥴 생성 모달의 '프로젝트' 팝업의 경우, 컴포저의 버튼에서 보여지는 팝업을 그대로 가져올 것" | — | 이번 세션 턴 5 | ACTIVE | — |
| D-014 | "스케쥴 페이지에서 나열되는 항목들에서 '코드' 아이콘은 nav의 세션에서 사용하고 있는 '코드' 아이콘으로 변경할 것. 그리고 modal 안에서 '워크/코드' 팝업의 코드 또한 요구 아이콘으로 변경할 것" | nav 세션의 코드 아이콘 = `agentPresentation.code.navIcon`(`terminal2`) | 이번 세션 턴 5 | ACTIVE | — |
| D-015 | "항목 클릭시 아래로 전개되는 내용을 우측패널로 전개되도록 변경하라. 플러그인 페이지의 스킬 탭 -> 항목 참조" | 참조 = `ExtensionsCatalogView`의 `ExtensionDetailPane`(크기 조절·펼치기·닫기·Esc) | 이번 세션 턴 6 | ACTIVE | D-008의 "실행 이력 보기" 자리를 행 아래에서 우측 패널로 옮긴다 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-009·D-010. D-001~D-008은 옛 plan에서 원문 그대로 승계.
- 변경된 결정: 없음. D-009·D-010은 제품 동작이 아니라 구현 기준을 정한다.
- D-010에 따른 재고려 결과는 §4 표와 §9 Delta — 옛 구현 대비 구조 변경 7건(T1~T7).
- V1 정정 1(구현 r1 중, 규범 행만): ① EP-8 ①의 검색 술어 `orca:`가 제품 슬러그 `orcinus-orca:`까지 잡았다(`rg -c "orca:" app/src` → 기존 파일 다수) → 주어를 예약 채널로 좁혔다. ② VP-03의 AC11 좌표가 정적 렌더로는 메뉴 클릭을 관측할 수 없는 자리를 가리켰다 → 확인→삭제 순수 함수 좌표로 바꾸고 메뉴 전달은 선언 경계 5로 뺐다. ③ `Bootstrap.start()`를 실제로 지나는 스위트가 있었다(`bootstrap.opencode-warmup.test.ts`) → VP-09 좌표에 더하고 선언 경계 3을 `send.ts`로 좁혔다.
- ΔV4(verify r1 정정, 사용자 결정 변경 없음): 새 Decision 0. `ACTIVE 결정 ↔ AC` 대조 — D-008↔AC35(신규, 행·패널 메뉴), D-005·D-006↔EP-1 규칙 칸 정정(본문 `trim`). 충돌 0.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-001↔AC1·2, D-002↔AC2·3, D-003↔AC3·4·6, D-004↔AC3·14·15, D-005↔AC12, D-006↔AC12, D-007↔AC3·14·15, D-008↔AC9·10·11·17·18, D-009·D-010↔AC24·AC25.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 — 옛 구현은 현재 트리에서 깨져 있다 | `npm run typecheck` → 옛 파일에서 error(채널·스키마·`scheduledTasks`·`startDetachedChat`·`schedules.*` 키 부재) |
| 이미 충족하는가 | 아니오 — `main`에 예약 작업 배선 0 | `rg -n "schedule" app/src/shared/ipc.ts` → `CHANNELS`에 `schedule` 도메인 0 |
| 더 작은 해법 / 제거 가능한 구성 | 있음 — 아래 재고려 표 T3~T7 | §8 |
| 선행 자료 대조 | 옛 plan §8의 좌표는 대부분 낡았다 — 줄 번호를 승계하지 않고 다시 쟀다 | §8 |
| 기존 결정과 충돌 | 없음 | §16 |

### 재고려 (D-010) — 옛 구현 대비

| # | 옛 구현 | 현재 코드의 사실 | 이번 설계 |
|---|---|---|---|
| T1 | 채널 `orca:schedule:*` · `window.orca` | 접두사 `oo:` · 전역 `window.oo`(`preload/index.ts:133·439`), 가드 `check-product-naming.mjs` | `oo:schedule:*` · `window.oo.schedule` |
| T2 | `0034_scheduled_tasks.sql` | `0034_native_snapshot_raw`가 이미 있다(`migrate.ts:81`) | `0035_scheduled_tasks.sql` |
| T3 | 발화를 `features/scheduler`의 `Scheduler`에 얹음 — `unregister` 추가·`SchedulerPort`·`registry.ts`·`task:<id>` 키 | `Scheduler.invoke`가 발화마다 `schedule_runs` 행·자체 겹침 가드·실패 토스트를 갖는다(`scheduler.ts:104-134`). 옛 구현은 action을 즉시 반환시켜 이 셋을 전부 우회했다 | slice가 `infra/cron.ts`의 `startCron`으로 작업당 타이머를 직접 갖는다. `Scheduler`는 건드리지 않고 그 `cronHandle`만 `startCron`을 재사용 |
| T4 | `ports.ts`가 저장소·shell 결과 타입을 다시 선언 | features → infra 의존은 허용(`app/src/main/AGENTS.md` DAG) | `ports.ts` 삭제. `Pick<ScheduledTaskQueries, …>` · `infra/shell`의 타입을 쓴다 |
| T5 | main 전용 상한 5개가 `shared/`에 있고 `infra/shell`·`infra/db`가 그것을 import | renderer 소비자 0(`rg "SHELL_TIMEOUT_MS\|OUTPUT_TAIL_BYTES\|RUN_RETENTION\|PROMPT_REPORT_TIMEOUT_MS" app/src/renderer` → 0) | slice `limits.ts`로 옮기고 infra에는 인자로 넘긴다 |
| T6 | `startDetachedChat`이 `sendNewChatPayload`·`releaseNewChatGate`·`promotePendingNewChat` 세 곳에 대기자 정착 호출을 심음 | 승격은 엔트리 객체를 보존하고 엔트리가 `clientKey`를 갖는다(`chatStore.ts:600-640·1062`) | 결과 대기는 스토어 구독 한 함수. 위 세 함수 무수정. 새 대화 게이트 판정은 `send`와 한 함수를 공유 |
| T7 | `ExecutionSettingsPicker.tsx` 한 파일에 선택 보정 로직 + 화면, 로직 테스트 없음(옛 구현 보고 #5) | renderer 규칙 "순수 변환기는 단위 테스트와 함께" | 순수부 `lib/executionSettings.ts` 분리 + 테스트 |

- 사용자에게 올릴 결정: 없음. T1~T7은 제품 동작을 바꾸지 않는다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[사이드바 '예약됨'] → /scheduled 목록
  → ['새 작업'] → 모달(제목·프로젝트·권한·모델·트리거·명령) → [만들기]
  → 목록 행(다음 실행 시각) → 예약 시각 도달 또는 [지금 실행]
      프롬프트 → 새 대화 시작(보던 화면 유지) → 이력 '성공' + 대화 열기
      shell   → PowerShell 실행 → 이력 '성공/실패' + 종료 코드 + 출력
  ↘ 실패: 이력 '실패' + 사유 / 실행 중 재발화: 이력 '건너뜀'
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 보이는 결과 |
|---|---|---|
| 모달 [만들기] | 검증 → 저장 → 타이머 시작 | 모달 닫힘, 행 추가, `다음 실행` 표시 |
| 토글 끔/켬 | 타이머 정지/시작 | 끔: `일시 중지`·흐린 행 / 켬: 시각 표시 |
| 편집 저장 | 저장 → 타이머 재시작 | 행 갱신 |
| 삭제 확인 | 타이머 정지 → 진행 중 실행 중단 → 작업·이력 삭제 | 행 제거 |
| 발화·지금 실행 (프롬프트) | renderer에 시작 요청 → 새 대화 전송 → 세션 id 보고 | 이력 `성공`, 최근 대화에 새 대화. 현재 화면 불변 |
| 프롬프트 시작 실패(창 없음·오류·2분 내 미보고) | 실행 종결 | 이력 `실패` + 사유 |
| 발화·지금 실행 (shell) | 자식 프로세스 실행 → 종료 대기 | 행 `실행 중` → 이력 `성공`(exit 0) / `실패` |
| 같은 작업 실행 중 예약 발화 | 새 실행 없음 | 이력 `건너뜀` |
| 같은 작업 실행 중 [지금 실행] | 거부 | 메뉴 항목 비활성 |
| 작업의 프로젝트가 삭제됨 | `project_id`가 비고 실행은 실패 | 행 경고 + 이력 `실패: 프로젝트 없음` |
| shell 작업의 프로젝트 폴더가 사라짐 | 실행하지 않음 | 이력 `실패: 프로젝트에 폴더 없음` |
| 실행 중인 작업을 삭제 | 실행 중단 | 행·이력 제거 |
| 앱 종료 | 실행 중 shell 종료, 다음 부팅에 `실행 중` 잔여를 `실패`로 정리 | 이력 `실패: 앱 종료로 중단` |

### 파생 UX / 엣지케이스

- loading / empty / error: 프로젝트 카탈로그와 같은 `common.loading`·빈 상태·검색 0건 문구. 저장 실패는 모달을 닫지 않고 문구를 띄운다. 토글·삭제·지금 실행 실패는 오류 토스트(`actionFailed`).
- cancel / close: 모달 Esc·취소는 입력을 버린다. 재오픈은 초기값이다.
- concurrency: 작업 간 동시 실행 허용, 같은 작업의 겹침만 막는다. 프롬프트 시작은 renderer 새 대화 직렬화(`pendingNewChatKey`/`newChatQueue`)를 따른다.
- keyboard / a11y / theme: 모달 열기→Tab→Esc→`새 작업` 버튼 초점 복귀. 토글 `role="switch"`. white/dark.
- 승인 요청(D-006): 권한 모드가 승인을 요구하면 새 대화가 승인 카드에서 대기한다. 이력은 이미 `성공`이다.

## 6. 범위 / 비범위

- **범위**: nav·라우트·목록·모달·저장·발화·shell 실행·프롬프트 릴레이·이력·문서 + 옛 미추적 산출물의 교체·삭제.
- **비범위**: 앱 미실행 중 발화·놓친 실행 보충 · OS 스케줄러 연동 · 완료 알림 · 프롬프트 턴 종료 추적 · cron 직접 입력 · 첨부·worktree 격리 · OpenCode 에이전트·variant 선택(§10 선언 경계) · 게이트(로그인 전) 중 발화의 대기열.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 놓친 실행 보충 | 아니오 — 이력에서 파생 가능 | 후속 |
| cron 직접 입력 | 아니오 — `TriggerSpec` union 멤버 추가 | 후속 |
| OpenCode 에이전트·variant | 아니오 — `PromptExecution`에 선택 필드 추가(JSON 열이라 무마이그레이션) | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 사이드바 nav에 `프로젝트` 다음 순서로 `예약됨`이 있고 아이콘은 `clock`, `/scheduled` 정확 일치에서만 활성 | `SIDEBAR_NAV` 순서·`isActive`·ko/en 라벨 단언 | `Sidebar` → `SIDEBAR_NAV` |
| R-01 | AC2 | `/scheduled`가 목록을 연다: 제목+개수, 우상단 `새 작업` primary 버튼, 검색, 탭(전체/사용 중), 목록, loading·empty | render 테스트로 상태별 문구·버튼 | `AppRouter` → `SchedulesPage` → `SchedulesView` |
| R-02 | AC3 | `새 작업` 클릭 시 모달에 제목·프로젝트·명령 종류·트리거·명령 입력이 있다. 프롬프트일 때만 권한·모델(+노력)이 보인다 | render 테스트: 종류 전환 전후 필드 유무 | `SchedulesScreen` → `ScheduleTaskModal` |
| R-02 | AC4 | 트리거 4종을 고를 수 있고 시각 옆에 로컬 UTC 오프셋 라벨이 있다 | 폼 순수 함수: 선택 → `TriggerSpec` 4종 | `TriggerFields` → 폼 상태 |
| R-02 | AC5 | `TriggerSpec` → cron: 매시간 `0 * * * *`, 매일 09:30 `30 9 * * *`, 매주 월 09:00 `0 9 * * 1`, 지정 월·화·금 `0 9 * * 1,2,5` | 순수 테스트 4식 + 요일 0개·범위 밖 거부 | `service.sync` → `triggerToCron` |
| R-02 | AC6 | 제목 1~120자, 명령 비어 있지 않음(≤8000자), 프로젝트 필수, shell은 폴더 있는 프로젝트, 프롬프트는 모델 선택이 있어야 `만들기` 활성. main이 같은 규칙으로 거부 | 폼 검증 순수 테스트 + 핸들러 테스트(무효 페이로드 reject) | 모달 → `scheduleApi.create` → 핸들러 → service |
| R-03 | AC7 | 생성하면 저장되고 목록에 나타나며 `다음 실행`이 cron과 일치한다 | 통합: create 후 `list()`의 `nextRunAt` | `oo:schedule:create` → queries → `service.sync` |
| R-03 | AC8 | 앱 재시작 후 사용 중 작업이 전부 다시 발화한다. 꺼진 작업은 발화하지 않는다 | 통합: 저장소에 켬/끔 2건 → 새 조립 `start()` → 시계 진행 | `Bootstrap.start` → `createScheduledTasks` → `service.start` |
| R-03 | AC9 | 토글 끄면 발화하지 않고 `다음 실행`이 비며, 켜면 다시 잡힌다 | 통합: setEnabled 전후 시계 진행 → 실행 수 | `oo:schedule:setEnabled` |
| R-03 | AC10 | 편집은 같은 모달에 저장값이 채워지고 트리거를 바꾸면 새 cron으로 발화한다 | 폼 순수(작업→폼 왕복) + 통합(update 후 `nextRunAt` 변화) | `oo:schedule:update` |
| R-03 | AC11 | 삭제는 확인 뒤 작업과 이력을 지우고 더는 발화하지 않는다 | 통합: delete 후 시계 진행 → 실행 0·`listRuns` 빈 배열 + render(삭제 메뉴 → 확인 요청 콜백) | `oo:schedule:delete` |
| R-04 | AC12 | 프롬프트 작업이 발화하면 작업의 프로젝트·권한 모드·모델·노력·본문 그대로 새 대화가 시작되고 보던 대화는 바뀌지 않는다. 이력은 `성공` + 세션 id | store 테스트(`activeKey` 불변·payload) + 릴레이 통합 | 발화 → runner → push → `useScheduledPromptRelay` → `chatActions.startDetachedChat` → `chat:send` |
| R-04 | AC13 | 프롬프트 시작 실패(창 없음 / 오류 / 2분 내 미보고)는 이력 `실패` + 사유 | 릴레이 단위: 세 경우의 종결 | runner → `PromptRelay` |
| R-04 | AC14 | shell 발화는 win32 `powershell.exe -NoProfile -NonInteractive -Command <UTF-8 출력 고정 + 명령>`, 그 외 `/bin/sh -c <명령>`을 프로젝트 폴더에서 실행한다. exit 0은 `성공`, 그 외 `실패`이고 종료 코드·출력 꼬리가 남는다 | shell-runner 단위(주입 spawn): 플랫폼별 파일·인자·cwd, exit 0/1 | runner → `runShellCommand` |
| R-04 | AC15 | shell이 제한 시간을 넘으면 종료시키고 `실패: 제한 시간 초과`. 출력이 상한을 넘으면 꼬리만 남기고 잘림 표시 | 단위: 가짜 타이머 → kill / 상한 초과 출력 → 길이·`truncated` | 같은 경로 |
| R-04 | AC16 | 같은 작업 실행 중 예약 발화는 `건너뜀` 이력만 남기고, `지금 실행`은 `{started:false, reason:'running'}` | runner 단위: 두 origin 각각 | `runner.fire` |
| R-03 | AC17 | `지금 실행`은 즉시 1회 실행하고 `다음 실행`을 바꾸지 않는다 | 통합: runNow 전후 `nextRunAt` 동일·이력 +1(`manual`) | `oo:schedule:runNow` |
| R-04 | AC18 | 행을 펼치면 최근 실행 20건이 최신순으로 시각·출처·상태·사유·종료 코드·출력·대화 열기를 보인다. 작업당 51번째부터 오래된 것이 지워진다 | queries 테스트(51건 → 50건·최신 유지) + 이력 render | `oo:schedule:listRuns` → `RunHistory` |
| R-04 | AC19 | 프로젝트가 삭제된 작업은 실행이 `실패: 프로젝트 없음`이고 행에 경고가 보인다. 작업은 남는다 | DB 테스트(FK SET NULL) + runner 단위 + 행 render | FK → runner |
| R-04 | AC20 | 앱 종료 시 실행 중 shell이 종료되고, 부팅 시 `running` 잔여가 `실패: 앱 종료로 중단`이 된다 | runner 단위: `dispose()` → abort / `reconcileStaleRuns()` | `Bootstrap.shutdown`·`start` |
| R-04 | AC21 | 작업·실행 상태가 바뀌면 열려 있는 목록이 새로고침 없이 갱신된다 | store 테스트: 변경 push → `list` 재조회 | `broadcastScheduledTasksChanged` → `schedulesStore` |
| R-05 | AC22 | 문서가 현재 상태와 맞는다: IPC 계약·영속성·보안·컴포넌트 카탈로그·레이어·인벤토리·용어 | `check-doc-inventory.mjs --check` exit 0 · `ipc-documentation.test.ts` green | 문서 |
| R-05 | AC23 | 실제 창에서 white/dark, 모달 키보드 흐름, 실제 PowerShell 명령 1회, 실제 하네스 프롬프트 1회가 계약대로 보인다 | 사람 실기 | `npm run dev` |
| R-06 | AC24 | 옛 구성 7건(T1~T7)이 현재 규칙으로 바뀌었다 — 각 대체물이 쓰이고 옛 식별자가 남지 않는다 | §10 EP-8 검색 8식(음성) + 대체물의 행동 테스트(양성: VP-06·14·18·19) | `app/src` |
| R-06 | AC25 | 이번 변경 파일이 현재 저장소 가드를 전부 지난다 — 제품 이름·테스트 예산·풀 분류·호스트 격리·마이그레이션 append-only·lint boundaries | §19 gate 전부 | CI 단계의 로컬 대응 |

### AC 검증 주의사항

- 기존 테스트 재사용: `navItems.test.ts`·`scheduler.test.ts`(cron 케이스 `registers a cron schedule and exposes nextRun` 실재)·`chatStore.test.ts`의 새 대화 큐 케이스(REGRESSION).
- 사람 실기(AC23): 시각·실제 셸·실제 하네스만.
- 총량 기준: 상한 상수는 slice `limits.ts` 한 곳, 테스트가 그 상수를 import한다.
- 0건 기준(AC24): 음성 검색만으로는 "대체물이 쓰인다"를 잠그지 못한다 — 양성 좌표를 짝지었다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V. 변경이 시작되는 수준: 해당 없음.
- `SUPERSEDED` 이관: 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance |
|---|---|---|---|
| R-01~R-05 | R | AC1~AC23 | NEW |
| R-06 | R | 현재 코드 기준 구성(AC24·25) | NEW |
| SD-01 | SD | 작업 수명주기: 저장 → 타이머 → 발화 → 이력 → 재시작 복원 | NEW |
| SD-02 | SD | 프롬프트 릴레이: main 발화 → renderer 새 대화 → 보고 → 종결 | NEW |
| AR-01 | AR | `oo:schedule:*` 채널·zod·preload·renderer api | NEW |
| AR-02 | AR | 조립 `createScheduledTasks`·부팅 복원·종료 정리 | NEW |
| AR-03 | AR | DB 테이블·쿼리 | NEW |
| AR-04 | AR | pages 조립: 프로젝트 목록·실행 설정 슬롯 | NEW |
| AR-05 | AR | `Scheduler.cronHandle` → `startCron` 재사용 | CHANGED (기준: `scheduler.ts` 현재 `main`) |
| MD-01 | MD | `triggerToCron`·`isValidTrigger` | NEW |
| MD-02 | MD | `runShellCommand` | NEW |
| MD-03 | MD | `ScheduledTaskRunner` | NEW |
| MD-04 | MD | `chatActions.startDetachedChat` · `newChatGate` | NEW |
| MD-05 | MD | `scheduleForm` | NEW |
| MD-06 | MD | `startCron`(`infra/cron.ts`) | NEW |
| MD-07 | MD | `executionSettings`(선택 보정 순수부) | NEW |
| MD-08 | MD | `chatStore.send` 새 대화 경로(게이트 판정 공유로 접촉) | INHERITED |

### Pair registry

좌표 경로는 `app/src/` 기준. `신규`·`이관`은 구현자가 만들 테스트다(`이관` = 옛 미추적 테스트를 현재 규칙으로 고쳐 쓴다).

| Pair | left ↔ right | req | production path | 직접 oracle (자리별 좌표) | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT(AC1·2) | REQUIRED | `Sidebar` → `SIDEBAR_NAV` → `AppRouter` → `SchedulesScreen` | `renderer/src/app/navItems.test.ts` 신규 케이스 · 이관 `features/schedules/components/schedulesScreen.render.test.ts`(loading/empty/목록) | not selected | 0 |
| VP-02 | R-02 ↔ AT(AC3·4·6) | REQUIRED | `ScheduleTaskModal` → `scheduleForm` → `scheduleApi.create` | 이관 `scheduleTaskModal.render.test.ts` · VP-15 좌표 | not selected | EP-1 ① |
| VP-03 | R-03 ↔ AT(AC7~11·17) | REQUIRED | handlers → service → queries / 타이머 | VP-06·VP-08 좌표 · AC11 "확인 뒤 삭제"는 신규 `features/schedules/lib/taskActions.test.ts`(확인 요청 → 확인 전 삭제 0 → 확인 후 그 id 삭제) | not selected | EP-3 |
| VP-04 | R-04 ↔ AT(AC12~16·18~21) | REQUIRED | 발화 → runner → shell/relay → 이력 → push → store | VP-07·12·13·14 좌표 + 이관 `runHistory.render.test.ts`·`schedulesStore.test.ts` | not selected | EP-1·4·5·7 |
| VP-05 | R-05 ↔ AT(AC22·23) | REQUIRED | 문서 gate · `npm run dev` | `gate:node scripts/check-doc-inventory.mjs --check` · `shared/ipc-documentation.test.ts` · 사람 실기 | not selected | 0 |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | `createScheduledTasks` → `service.start` → `startCron`(실제 croner·가짜 타이머) → runner → 저장소 | 이관 `main/app/scheduled-tasks.lifecycle.test.ts` — production 조립 함수 그대로, 인메모리 저장소·주입 shell | required — 배선 존재 oracle. 변이: `start`에서 복원 루프 제거 · `sync`의 `enabled` 조건 뒤집기 | EP-3 (5) |
| VP-07 | SD-02 ↔ ST-02 | REQUIRED | runner → `PromptRelay.request` → push → `relayScheduledPrompt` → `startDetachedChat` → `report` → 종결 | 이관 `renderer/src/app/hooks/useScheduledPromptRelay.test.ts` · `main/features/scheduled-tasks/prompt-relay.test.ts` | required — 필드 운반. 변이: 자리 ①③④⑤에서 `permissionMode`→기본값, `providerKey`→다른 값 | EP-1 (5) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | `ipcMain` 핸들러 → zod → service/relay | 이관 `main/app/handlers/scheduled-tasks.test.ts` — 채널별 정상·무효 페이로드 | not selected | EP-2 · EP-7 |
| VP-09 | AR-02 ↔ IT-02 | REQUIRED | `Bootstrap` → `createScheduledTasks` / `shutdown` → `dispose` | VP-06 좌표(조립 함수) · `main/app/bootstrap.opencode-warmup.test.ts` 신규 케이스(실제 `Bootstrap.start`/`shutdown` — 복원 시작·핸들러 등록·`dispose`가 `stopAll` 앞) | not selected | EP-3 ① |
| VP-10 | AR-03 ↔ IT-03 | REQUIRED | migration → `ScheduledTaskQueries` | 이관 `main/infra/db/scheduled-task-queries.test.ts`(io 풀·Node ABI) — CRUD·FK SET NULL·CASCADE·보존 | not selected | EP-1 ② |
| VP-11 | AR-04 ↔ IT-04 | REQUIRED | `SchedulesPage` → `SchedulesView` props | 이관 `pages/SchedulesPage.render.test.ts` | not selected | EP-1 ① |
| VP-12 | MD-02 ↔ UT-02 | REQUIRED | `runShellCommand` | 이관 `main/infra/shell/shell-runner.test.ts` | not selected | EP-6 |
| VP-13 | MD-03 ↔ UT-03 | REQUIRED | `ScheduledTaskRunner.fire/cancel/dispose/reconcileStaleRuns` | 이관 `main/features/scheduled-tasks/runner.test.ts` | not selected | EP-4 · EP-5 |
| VP-14 | MD-04 ↔ UT-04 | REQUIRED | `chatActions.startDetachedChat` | 이관 `renderer/src/features/chat/store/chatStore.detached.test.ts` — 다른 세션 active → `activeKey` 불변, payload, 승격 resolve, 오류 종료 reject, 점유 중이면 큐 대기 | not selected | EP-1 ⑤ |
| VP-15 | MD-05 ↔ UT-05 | REQUIRED | `scheduleForm` | 이관 `features/schedules/lib/scheduleForm.test.ts` | not selected | EP-1 ① |
| VP-16 | MD-01 ↔ UT-01 | REQUIRED | `triggerToCron`·`TriggerSpecSchema` | 이관 `shared/scheduled-tasks.test.ts` | not selected | EP-2 |
| VP-17 | AR-05 ↔ IT-05 | REQUIRED | `Scheduler.schedule({cron})` → `startCron` | `main/features/scheduler/scheduler.test.ts:'registers a cron schedule and exposes nextRun'`(기존) | not selected | 0 |
| VP-18 | MD-06 ↔ UT-06 | REQUIRED | `startCron` | 신규 `main/infra/cron.test.ts` — 가짜 타이머로 발화·`stop` 뒤 미발화·`nextRun` | not selected | 0 |
| VP-19 | MD-07 ↔ UT-07 | REQUIRED | `executionForModel`·`executionForKind`·`withEffort`·`executionModelOptions` | 신규 `features/chat/lib/executionSettings.test.ts` | not selected | 0 |
| VP-20 | MD-08 ↔ UT-08 | REGRESSION | `chatStore.send` 새 세션 경로 → `newChatGate` | `features/chat/store/chatStore.test.ts`의 새 대화 큐 케이스(구현자가 케이스명 인용) | required — 공유 함수 교체. 변이: 게이트 점유 시 `dispatch` 뒤집기 | 0 |

oracle 조건(전 pair 공통): 운반 값은 기본값·형제 값과 다르게 준다(`permissionMode: 'plan'`, `effort: 'low'`, `agentKind: 'work'` 등).

### 현재 변경의 운영 gate

| Gate | 이유 | 명령 (`app/`에서) | 실패 범위 |
|---|---|---|---|
| 가드 4종 | 신규 SQL·채널·테스트·문자열 | `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs` | 이번 변경 파일 |
| lint · typecheck | boundaries·`child_process` 제한 | `npm run lint` · `npm run typecheck` | 이번 변경이 낸 error |
| 전체 vitest | 트리 전체 소스 가드 포함 | `./node_modules/.bin/vitest run` | 변경 전 실패 집합과의 차집합 |
| 스크립트 테스트 | 가드 자체 | `node --test scripts/*.test.mjs` | 이번 변경이 낸 실패 |
| DB 스위트 | 신규 마이그레이션·쿼리 | Node ABI에서 VP-10 좌표 | VP-10 |
| trailer | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 채널 접두사는 `oo:`, renderer 전역은 `window.oo` | `app/src/shared/ipc.ts:106` · `app/src/preload/index.ts:133·439` |
| preload push 구독은 `subscribe(channel, handler)` 헬퍼 | `preload/index.ts:126` |
| invoke 핸들러는 `handle(channel, schema, 'reject'\|{fallback}, fn)` · `handlePlain` | `app/src/main/infra/ipc/handle.ts` |
| 마지막 마이그레이션은 `0034_native_snapshot_raw` | `app/src/main/infra/db/migrate.ts:81` |
| `DbQueries`는 하위 쿼리 객체를 필드로 갖는다(`usage`·`artifacts`·`background`·`nativeHistory`) | `app/src/main/infra/db/queries.ts` |
| croner import는 `features/scheduler/scheduler.ts`·`infra/cron.ts` 두 곳뿐 | `rg "from 'croner'" app/src --glob '!*.test.ts'` → 2 |
| `Scheduler`에 action 삭제 API가 없고 `invoke`는 발화마다 `schedule_runs`에 쓴다 | `app/src/main/features/scheduler/scheduler.ts:76-134` |
| `child_process` import는 lint가 막고 예외 목록이 있다 | `app/eslint.config.mjs:244-270` |
| features/**는 `spawn(`·`execFile(`·`runGit(` 호출 텍스트를 가질 수 없다 | `app/src/main/features/worktrees/ipc-integration.test.ts:111-126` |
| `handleChatSend`는 요청 창(`event.sender`)에 묶인다 — main이 턴을 직접 열 수 없다 | `rg -c "sender" app/src/main/app/chat-turn/send.ts` → 27 |
| 새 대화 전송은 `draft:` 엔트리 + `clientKey` + `pendingNewChatKey`/`newChatQueue` 게이트 | `app/src/renderer/src/features/chat/store/chatStore.ts:1013-1094` |
| 승격은 엔트리 객체를 보존해 `sessions[sessionId]`로 옮긴다 | `chatStore.ts:600-640` |
| 턴이 세션 id 없이 끝나면 `releaseNewChatGate` | `chatStore.ts:916·943` |
| `SendChatMessage`에 `harnessAgent`·`modelVariant`(OpenCode)가 있다 | `app/src/shared/ipc.ts:909-910` |
| 프로젝트 카탈로그 골격과 모달 골격은 옛 설계 때와 같다 | `features/projects/components/ProjectsScreen.tsx` · `CreateProjectModal.tsx` |
| IPC 도메인 목록은 문서와 코드가 일치해야 한다 | `app/src/shared/ipc-documentation.test.ts` |
| 테스트의 시간 값은 `scaleMs`, unit 풀은 자식 프로세스·SQLite 금지 | `app/AGENTS.md` scripts 절 |
| Bootstrap은 electron mock 아래 `Object.create(Bootstrap.prototype)`로 메서드 단위 테스트한다 | `app/src/main/app/bootstrap.shutdown.test.ts:1-60` |

### 전수 조사

| 대상 | 검색 | N | 의미 |
|---|---|---:|---|
| 옛 미추적 산출물 | `git status --short \| grep '^??'` | 18항목 | 전부 `1058886c`와 동일(`diff -q` 차이 0) — 삭제해도 커밋에 남는다 |
| 옛 구현이 고친 추적 파일 | `git show --stat 1058886c` 중 `main`에 반영 안 된 것 | 17 | §11 표에서 전부 다시 배선 |
| main 전용 상한의 renderer 소비 | §4 T5 검색 | 0 | 이동 가능 |
| `Scheduler` cron 소비처 | `rg "cronHandle" app/src/main` | 정의 1·호출 1 | AR-05 접촉 범위 |
| `sendNewChatPayload` 호출부 | `rg -n "sendNewChatPayload\(" chatStore.ts` | 정의 1·호출 4 | T6은 호출만 더한다 |
| INDEX 후보 표의 겹침 | `chatStore.ts` 행 = 0308(`sessionBusy` 소비처·`dispose` 타이머) | 1 | 이번 변경이 그 자리를 건드리지 않는다 — 승격 없음 |

### 수치 / 전칭 표현 검산

- "미추적 18항목": 파일 12 + 디렉토리 6(`features/scheduled-tasks/`·`infra/shell/`·`features/schedules/`·`docs/handoff/0287-scheduled-tasks/` 포함)을 `git status --short`로 셌다.
- 문서 앵커: `security.md §1.10`("Git 실행과 Plugin 호스트 프로그램 경계") 실재 — `rg -n "^### 1.10" docs/arch/backend/security.md`.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS (`main` 현재)

- 관련 V node: SD-01·SD-02·AR-02·AR-05.
- 책임 소유자: `Bootstrap`이 `Scheduler`를 만들고 내부 잡을 등록한다. 사용자 예약 작업의 저장소·IPC·화면은 없다.
- 새 대화 시작은 renderer `chatStore.send`/`startHandoff`만 한다.
- 작업 트리에는 옛 구현의 신규 파일만 미추적으로 있고 배선이 없어 typecheck가 깨진다.

```text
settings.scheduler → Scheduler.applySettings → 내부 잡 → schedule_runs
```

### TO-BE

- 관련 V node: SD-01·SD-02·AR-01~05.
- 책임 소유자: slice `features/scheduled-tasks`가 저장 동기화·타이머·실행·이력을 갖는다. `Scheduler`는 내부 잡 전용으로 남는다. 프롬프트 시작은 renderer chat store가 한다.
- 조립: `app/scheduled-tasks.ts`의 `createScheduledTasks(deps)`가 runner·relay·service를 묶는다(electron 비의존). `bootstrap.ts`는 DB·`runShellCommand`·방송 함수를 넘기고 핸들러를 등록한다.
- 오류/정리: 모든 실행은 `runner.finishRun` 하나로 끝난다. `shutdown`은 `scheduledTasks.dispose()`(타이머 정지 → 자식 종료·이력 종결 → 대기 중 릴레이 종결) 뒤 `scheduler.stopAll()`.

```text
[renderer] SchedulesPage ─ scheduleApi ─▶ handlers/scheduled-tasks ─▶ ScheduledTaskService ─▶ ScheduledTaskQueries
                                                                          │ startCron(작업당 1)        ▲ 이력
                                                                          ▼                           │
                                                                   ScheduledTaskRunner ───────────────┘
                                                                     ├─ shell  → runShellCommand (infra/shell)
                                                                     └─ prompt → PromptRelay
[renderer] useScheduledPromptRelay ◀── oo:schedule:promptStart(push) ───┘
        └─ chatActions.startDetachedChat → chat:send(기존) → 세션 승격
        └─ oo:schedule:promptReport(invoke) ──▶ PromptRelay → runner 종결
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 연결 |
|---|---|---|---|---|
| 책임/소유권 | 내부 잡만 | slice 신설, 타이머도 slice 소유 | T3 — `Scheduler`의 기록·가드를 우회하는 간접층 제거 | AR-02 / VP-06·09 |
| cron 타이머 생성 | `scheduler.ts` 안 `cronHandle` | `infra/cron.ts` `startCron` 한 곳, 두 소비자 | 재사용 | AR-05·MD-06 / VP-17·18 |
| data/control flow | 설정 → cron | DB 작업 → `triggerToCron` → `startCron` → runner | 사용자 데이터는 DB | SD-01 / VP-06 |
| state/contract | — | `ScheduledTask`·`TriggerSpec`·`ScheduledRun`·채널 | 신규 | AR-01 / VP-08 |
| 새 대화 시작 | 사용자 입력만 | main 발화 → renderer 릴레이 → 기존 `chat:send` | `event.sender` 결합 유지 | SD-02 / VP-07·14 |
| 새 대화 게이트 판정 | `send` 안 인라인 | `newChatGate` 한 함수, `send`·`startDetachedChat` 공유 | T6 | MD-04·MD-08 / VP-14·20 |
| error/lifecycle | `schedule_runs` | `scheduled_task_runs` + 종결 자리 + stale 정리 | 화면에 보일 이력 | MD-03 / VP-13 |
| test seam | — | 조립 함수·주입 spawn·주입 시계·인메모리 저장소 | electron/DB 없이 검증 | VP-06·12·13 |

### 핵심 책임 분리

| 모듈/레이어 (`app/src/`) | 책임 | 호출자 |
|---|---|---|
| `shared/scheduled-tasks.ts` | 양쪽이 쓰는 타입·길이 상한·사유 코드·`triggerToCron`·`isValidTrigger` | main·renderer |
| `shared/protocol.ts` | zod 스키마 | handlers |
| `main/infra/cron.ts` | `assertValidCron` · `startCron(cron, fire)` | `Scheduler` · service |
| `main/infra/shell/shell-runner.ts` | 프로세스 실행·제한 시간·출력 절단(상한은 인자) | 조립이 runner에 주입 |
| `main/infra/db/scheduled-task-queries.ts` | CRUD·이력·보존(`keep` 인자) | service·runner |
| `main/features/scheduled-tasks/limits.ts` | main 전용 상한 | slice |
| `…/service.ts` | 유스케이스(CRUD·토글·지금 실행·이력 조회) + 작업당 타이머 + 부팅 복원 + 목록 합성 | handlers·조립 |
| `…/runner.ts` | 겹침 가드·실행 분기·이력 종결·stale 정리 | service |
| `…/prompt-relay.ts` | 시작 요청 push·보고 대기·시간 초과 | runner·handlers |
| `main/app/scheduled-tasks.ts` | 조립 `createScheduledTasks` | bootstrap |
| `main/app/handlers/scheduled-tasks.ts` | 채널 ↔ 유스케이스 | bootstrap |
| `renderer/features/schedules` | store·화면·모달·이력 | pages |
| `renderer/pages/SchedulesPage.tsx` | 조립 | router |
| `renderer/app/hooks/useScheduledPromptRelay.ts` | push 구독 → chat 액션 → 보고 | `AppLayout` |
| `renderer/features/chat` | `startDetachedChat` · `ExecutionSettingsPicker` · `lib/executionSettings` | app·pages |

## 10. 계약 / 타입 / 강제 지점

```ts
// shared/scheduled-tasks.ts — 옛 구현과 같은 형태(변경 없음)
type TriggerSpec =
  | { kind: 'hourly' } | { kind: 'daily'; at: TimeOfDay }
  | { kind: 'weekly'; day: Weekday; at: TimeOfDay }
  | { kind: 'custom'; days: Weekday[]; at: TimeOfDay }
type PromptExecution = {
  backend: Backend; agentKind: AgentKind; providerKey: string
  modelFamily: string | null; effort?: EffortLevel; permissionMode: NormalizedPermissionMode
}
type ScheduledTaskAction =
  | { kind: 'prompt'; text: string; execution: PromptExecution }
  | { kind: 'shell'; command: string }
// infra/cron.ts
interface CronJob { stop(): void; nextRun(): Date | null }
function startCron(cron: string, fire: () => void): CronJob   // 잘못된 식은 throw
```

- 채널(정본 `shared/ipc.ts` `CHANNELS`): `oo:schedule:{list,create,update,delete,setEnabled,runNow,listRuns,promptReport}`(invoke) · `oo:schedule:{changed,promptStart}`(push).
- `runNow` 응답: `{ started: true } | { started: false; reason: 'running' | 'not_found' }`.
- `promptStart`: `{ runId, projectId, text, execution }` — 살아 있는 첫 창에만 보낸다. `promptReport`: `{ runId, ok: true, sessionId } | { runId, ok: false, error }`. 대기 중이 아닌 `runId`는 무시.
- `chatActions.startDetachedChat(input: { projectId; text; execution }): Promise<{ sessionId: string }>` — draft 엔트리를 만들고 `activeKey`를 바꾸지 않는다. 스토어 구독으로 그 엔트리(`clientKey`)를 따라가 세션 id가 생기면 resolve, 세션 id 없이 턴이 끝나거나 엔트리가 사라지면 reject.
- zod 스키마는 `z.ZodType<ScheduledTaskInput>` 형으로 선언해 핸들러에 캐스트를 두지 않는다.

| V node / pair | 계약/필드 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 (`app/src`, 테스트 제외) | 실패 의미 |
|---|---|---|---|---|---|
| EP-1 · SD-02 / VP-07 | 실행 설정 6필드 + `projectId` + `text`가 변형 없이 전송 payload까지 간다 | `PromptExecution` | 5자리: ① `scheduleForm.validateForm` ② `ScheduledTaskQueries` 직렬화(`action_json`) ③ `runner.execute` → `startPrompt` ④ `relayScheduledPrompt` → `start` ⑤ `startDetachedChat` → `SendChatMessage` | `rg -n "execution\b\|action_json\|actionJson"` 대상: `shared/scheduled-tasks.ts` · `main/features/scheduled-tasks` · `main/infra/db/scheduled-task-queries.ts` · `renderer/src/features/schedules` · `renderer/src/app/hooks/useScheduledPromptRelay.ts` · `renderer/src/features/chat/store/chatStore.ts` | 저장한 권한·모델과 다른 설정으로 무인 실행된다(D-006 위반) |
| EP-2 · MD-01 / VP-16 | 트리거 검증·cron 변환은 한 함수 | `isValidTrigger`·`triggerToCron` | 3자리: ① `TriggerSpecSchema`(create·update 공유) ② `service.sync` ③ `scheduleForm.validateForm` | `rg -n "triggerToCron\|isValidTrigger\|TriggerSpecSchema"` | 화면 표시와 실제 발화 시각이 갈린다 |
| EP-3 · SD-01 / VP-06 | 저장된 작업 상태와 타이머가 일치한다 | `service.sync`·`service.stop` | 5자리: ① `start`(부팅 복원) ② create ③ update ④ setEnabled ⑤ delete | `rg -n "this\.(sync\|stop)\(" main/features/scheduled-tasks/service.ts` | 끈 작업이 발화하거나 켠 작업이 발화하지 않는다 |
| EP-4 · MD-03 / VP-13 | 같은 작업의 겹침 실행 금지 | runner in-flight 맵 | 2자리(공통 `fire`): ① origin `schedule` → `skipped` 이력 ② origin `manual` → `{started:false}` | `rg -n "\.fire\(" main` | 같은 명령이 동시에 두 번 돈다 |
| EP-5 · MD-03 / VP-13 | `running` 이력은 반드시 종결된다 | `runner.finishRun` | 10자리: shell ① exit ② spawn 오류 ③ 제한 시간 / prompt ④ 보고 ok ⑤ 보고 error ⑥ 창 없음 ⑦ 보고 시간 초과 / ⑧ 부팅 stale 정리 ⑨ `dispose` ⑩ `cancel`(삭제) | `rg -n "finishRun\(\|failRunningRuns\(" main` | 행이 영원히 `실행 중`이고 `지금 실행`이 막힌다 |
| EP-6 · MD-02 / VP-12 | shell 실행 4항: 파일+인자(플랫폼) · `cwd` · 제한 시간 · 출력 상한 | `shell-runner.ts` | 1자리 4항 | `rg -n "spawn" main/infra/shell` | 다른 폴더에서 실행되거나 멈추지 않는다 |
| EP-7 · AR-01 / VP-08 | 상태 변경은 `changed`를 방송한다 | `onChanged` | 7자리: create · update · delete · setEnabled · run 시작 · run 종결 · skipped 기록 | `rg -n "onChanged\(\)" main/features/scheduled-tasks` | 목록이 낡은 상태를 보인다 |
| EP-8 · R-06 / AC24 | 옛 구성이 남지 않는다 | — | 8식 전부 0: ① `rg "orca:schedule\|window\.orca" app/src` ② `rg "SchedulerPort\|scheduledTaskJobKey" app/src` ③ `rg "unregister" app/src/main/features/scheduler` ④ `ls features/scheduled-tasks/{ports,registry}.ts` ⑤ `rg "shared/scheduled-tasks" app/src/main/infra/shell` ⑥ `rg "detachedStarts\|settleDetachedStart" app/src` ⑦ `ls migrations/0034_scheduled_tasks.sql` ⑧ `ls docs/handoff/0287-scheduled-tasks` | (좌동) | 두 벌의 구성이 공존한다 |

- 선언 경계 1 — OpenCode 에이전트·variant: `PromptExecution`은 `harnessAgent`·`modelVariant`를 싣지 않는다. OpenCode 작업은 그 둘의 기본값으로 실행된다. 근거: 두 필드는 `SendChatMessage`의 선택 필드다(`shared/ipc.ts:909-910`).
- 선언 경계 2 — 전송 IPC 자체의 reject: `chatApi.send`가 reject하면 draft는 종결 이벤트를 받지 않아 대기가 main의 보고 시간 초과로 끝난다(이력 `report_timeout`). 일반 `send`도 같은 자리에서 게이트를 풀지 않는다(`chatStore.ts:571-580` — `reportError`만).
- 선언 경계 3 — electron 방송·창 선택(`infra/ipc/send.ts`의 두 함수)과 `bootstrap.ts`가 조립에 넘기는 인자 값(`projects`·`runShell`·`sendPromptStart`·`onChanged`)은 자동 좌표가 없다. `send.ts`는 `electron`을 import하고, bootstrap 스위트는 조립 모듈을 대체해 호출 순서만 본다. AC23 실기가 본다.
- 선언 경계 4 — 게이트(로그인 전)·부팅 중에는 릴레이 구독자가 없어 그 사이 프롬프트 발화는 `report_timeout`이 된다(비범위 §6).
- 선언 경계 5 — 행 메뉴의 항목 클릭 → `onRunNow`/`onEdit`/`onDelete` 전달(`ScheduleRow`의 Popover)과 preload 브리지는 자동 좌표가 없다. 이 feature의 render 테스트는 정적 마크업이라 닫힌 Popover의 클릭을 낼 수 없다(`schedulesScreen.render.test.ts` — `renderToStaticMarkup`). AC23 실기가 본다.
- 열린 입력 집합 판정 산출물: 해당 없음.
- SSOT 공유: 제목·명령 길이와 사유 코드는 `shared/scheduled-tasks.ts`, main 상한은 `limits.ts`.
- 선택적 필드: `effort` 부재 = 모델 기본값. `projectId: null` = 프로젝트 삭제됨 → 실행 실패.
- 외부 경계: 신규 의존성 0.

## 11. 구현 설계

옛 미추적 파일은 *입력*이다 — 아래 표의 처리대로 고쳐 쓰거나 지운다.

| 파일 (`app/src/` 기준) | 처리 | 변경 내용 |
|---|---|---|
| `shared/scheduled-tasks.ts` | 수정 | main 전용 상한 5개·`scheduledTaskJobKey` 제거. 나머지 유지 |
| `shared/ipc.ts` · `shared/protocol.ts` | 배선 | `CHANNELS`에 `oo:schedule:*` 10개 · 스키마 5종(`ZodType` 주석) |
| `main/infra/cron.ts` | 수정 | `startCron` 추가(`protect: true`) |
| `main/features/scheduler/scheduler.ts` | 수정 | `cronHandle` 삭제 → `startCron` 호출. croner import 제거 |
| `main/infra/db/migrations/0035_scheduled_tasks.sql` | 개명 | 옛 `0034_…` 내용 그대로, 주석의 핸드오프 번호만 갱신 |
| `main/infra/db/migrate.ts` · `migrate.test.ts` · `queries.ts` | 배선 | 0035 등록 · `DbQueries.scheduledTasks` |
| `main/infra/db/scheduled-task-queries.ts` | 수정 | `insertRun(row, keep)` — 보존 수를 인자로 |
| `main/infra/shell/shell-runner.ts` | 수정 | `timeoutMs`·`maxOutputBytes` 필수 인자, `shared` import 제거 |
| `main/features/scheduled-tasks/limits.ts` | 신규 | 상한 5개 |
| `…/service.ts` | 재작성 | registry 흡수: `jobs: Map<id, CronJob>` · `start()`(stale 정리 → 복원) · `dispose()` |
| `…/runner.ts` | 수정 | 타입을 infra에서 가져옴, 상한을 주입 shell·저장소에 넘김 |
| `…/prompt-relay.ts` · `index.ts` | 수정 | 상한 import 경로 · 배럴 |
| `…/ports.ts` · `registry.ts` · `registry.test.ts` | 삭제 | T3·T4 |
| `…/memory-store.testfixture.ts` | 수정 | `Pick<ScheduledTaskQueries,…>` 형을 만족 |
| `main/app/scheduled-tasks.ts` | 신규 | `createScheduledTasks({ store, projects, runShell, sendPromptStart, onChanged, startCron?, now? })` → `{ service, relay, dispose }` |
| `main/app/handlers/scheduled-tasks.ts` | 수정 | 캐스트 제거 |
| `main/app/bootstrap.ts` | 배선 | `Scheduler` 생성 뒤 조립·`service.start()`·핸들러 등록, `shutdown`에 `dispose` |
| `main/infra/ipc/send.ts` | 배선 | `broadcastScheduledTasksChanged` · `sendScheduledPromptStart` |
| `preload/index.ts` · `renderer/src/shared/api/ipc.ts` | 배선 | `oo.schedule.*` · `scheduleApi` |
| `eslint.config.mjs` | 배선 | `child_process` 예외에 `infra/shell/shell-runner.ts` |
| `renderer/src/app/{navItems.ts,router.tsx,AppLayout.tsx}` | 배선 | nav 항목 · `/scheduled` · 릴레이 훅 |
| `renderer/src/shared/i18n/resources/{ko,en}.ts` | 배선 | `sidebar.nav.scheduled` · `schedules.*` |
| `renderer/src/features/schedules/**` | 유지/수정 | 현재 타입에 맞춰 오류만 고친다(`ScheduleRow` 타입 오류 2건) · store 주석의 채널명 |
| `renderer/src/pages/SchedulesPage.tsx` · `app/hooks/useScheduledPromptRelay.ts` | 유지 | — |
| `renderer/src/features/chat/store/chatStore.ts` | 수정 | `newChatGate` 추출(`send` 적용) · `startDetachedChat`(구독 대기) · `chatActions` 등록 |
| `renderer/src/features/chat/lib/executionSettings.ts` | 신규 | picker의 순수부 |
| `renderer/src/features/chat/components/ExecutionSettingsPicker.tsx` · `index.ts` | 수정 | 순수부 import · 배럴 export |
| 테스트 | 이관·신규 | §7-A 좌표. 시간 값 `scaleMs` · 풀 분류 준수 |
| `docs/handoff/0287-scheduled-tasks/` | 삭제 | 미추적 사본. 원본은 `1058886c` |

### 테스트 가능성

- 별도 순수 파일: `service`·`runner`·`prompt-relay`·`app/scheduled-tasks.ts`·`shell-runner`(spawn 주입)는 `electron`을 import하지 않는다.
- 재사용 적합성: `startCron`은 `Scheduler`가 쓰던 생성식(`new Cron(cron, { protect: true }, fire)`)을 그대로 옮긴 것이라 기존 cron 케이스가 회귀 oracle이다.
- 시계: runner·relay는 `now`와 타이머 값을 주입받고, 수명주기 테스트는 vitest 가짜 타이머로 croner를 진행시킨다.

## 12. End-to-end 영향

```text
모달 폼 → scheduleApi.create → zod → DB → service.sync → startCron
  → runner.fire → (shell) spawn → 이력 / (prompt) push → renderer chat:send → report → 이력
  → changed push → schedulesStore.refresh → 목록·이력 UI
```

- producer 기준: 이력 `status`는 runner만 쓴다. `nextRunAt`·`running`·`lastRun`은 `list` 응답 시점에 service가 합성한다.
- consumer 파생: renderer는 `nextRunAt`을 다시 계산하지 않는다. 트리거 요약 문구만 `TriggerSpec`에서 파생한다.

### 부팅/등록 변경 시 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `Scheduler`(내부 잡) | `cronHandle` 구현 위치만 바뀐다. 사용자 작업 키가 들어오지 않아 `schedule_runs`·`applySettings` 영향 0 | VP-17 |
| `chatStore.send` 새 대화 경로 | 게이트 판정이 공유 함수로 간다 | VP-20 |
| `chatStore` 새 대화 큐 | 분리 시작이 게이트를 점유하는 동안 사용자의 새 대화는 큐 대기 | VP-14 |
| `useDraftSessionRows` | 분리 시작한 draft가 승격 전 잠깐 사이드바에 보인다 | AC23 실기 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: DB → `Scheduler` → `createScheduledTasks` → `service.start()`(stale 정리 → 복원). 한 작업의 cron 오류는 그 작업만 건너뛰고 로그한다.
- 취소/중단: shell은 `AbortController`. 사용자 수동 중단 UI는 비범위.
- 종료: `dispose()` — 타이머 정지 → 자식 종료·이력 종결 → 대기 릴레이 종결. DB가 열려 있는 동안 한다.
- timeout: shell `SHELL_TIMEOUT_MS`, 프롬프트 보고 `PROMPT_REPORT_TIMEOUT_MS`.
- **다중 저장소 쓰기**: 작업 저장(DB)과 타이머(메모리)는 순서대로 쓴다. DB 성공 후 `sync`가 throw하면 저장만 남고 핸들러가 오류를 올리며 다음 부팅 복원이 재시도한다. 삭제는 타이머 정지 → 실행 중단 → DB 삭제 순서라 "삭제된 작업이 발화"가 없다. 프롬프트 실행은 이력(DB)과 대화(하네스) 두 곳에 걸치며 보고가 유실되면 이력만 `report_timeout`이 된다 — 허용(대화는 남는다).

## 14. 성능 / 상한 / 최적화

- 출력: 실행당 64KB × 작업당 50건 = 작업당 최대 3.2MB. `list`는 `lastRun`의 출력을 싣지 않는다. `listRuns`는 20건 × 64KB = 1.28MB 상한.
- 요청 수: 발화당 push 1 + invoke 1. `changed` 수신마다 `list` 1회.
- 분리 시작의 스토어 구독은 승격 또는 종료까지만 살고 그 뒤 해제한다 — 상시 구독 0.
- 타이머는 작업당 1개. 작업 수 상한은 두지 않는다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문 문장 | 결과 |
|---|---|---|---|
| feature 교차 import 금지 | `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md` | §9 slice가 `Scheduler`를 import하지 않음 · pages 슬롯 주입 | 유지 |
| scheduler job action은 컴포지션 루트가 주입 | `app/src/main/AGENTS.md §주기 실행 경로` | §9 `Scheduler` 무접촉(내부 잡 전용) | 유지 |
| `shutdown`은 `closeDb` 앞에 `stopAll` | 같은 절 | §13 `dispose` → `stopAll` | 유지 |
| 마이그레이션 append-only | `app/AGENTS.md §DB` | §11 신규 0035만 | 유지 |
| `child_process`는 예외 목록만 | `eslint.config.mjs:244` · `security.md §1.10` | §11 예외 1줄 + 문서 경계 행 | 변경(예외 추가 — 기능 자체가 셸 실행) |
| features는 프로세스를 직접 만들지 않는다 | `worktrees/ipc-integration.test.ts` | §9 실행기는 `infra/shell`, runner는 주입 함수만 호출 | 유지 |
| 제품 이름 표기 | `check-product-naming.mjs` | §4 T1 | 유지 |
| 테스트 시간 예산·풀·호스트 격리 | `app/AGENTS.md` scripts 절 | §11 테스트 행 | 유지 |
| 문서에 코드 수치 금지 | `docs/AGENTS.md §작성 규칙 2` | AC22 인벤토리 재생성 | 유지 |
| `arch/`에 이력 금지 | `docs/AGENTS.md §작성 규칙 4` | 문서 갱신은 현재 상태만 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 프롬프트 시작이 renderer에 의존 — 창이 없으면 실행 불가 | 이력 `no_window`(AC13). 헤드리스 턴은 `handleChatSend` 재설계라 범위 밖 |
| `send`의 게이트 판정을 공유 함수로 옮김 | REGRESSION pair VP-20 + 변이 |
| 무인 `bypass` + 예약 = 감독 없는 도구 실행 | D-006 사용자 결정. 고른 모드가 편집 모달에 그대로 보인다 |
| shell 명령은 사용자 계정 권한으로 실행 | 사용자가 직접 적은 명령만 저장. `security.md §1.10`에 경계 행 |
| `infra/shell`이 다른 feature에서도 import 가능 | 문서 경계만(기계 강제 없음). 현재 소비자 1(`bootstrap.ts`) |

- 되돌리기 어려운 결정: DB 스키마(JSON 열 — 멤버 추가는 무마이그레이션), 채널명 `oo:schedule:*`, 경로 `/scheduled`.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- 코드: §11 표.
- 문서: `docs/IPC_CONTRACT.md`(도메인·채널 표) · `docs/arch/backend/persistence.md` · `docs/arch/backend/security.md §1.10` · `docs/arch/frontend/design-components.md` · `docs/arch/frontend/layers.md` · `docs/generated/inventory.md`(재생성) · `docs/GLOSSARY.md` · `app/AGENTS.md`·`app/src/main/AGENTS.md`(features 행).

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md`(ABI·scripts 절) · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- 환경 제약: DB 스위트는 Node ABI. 차단 환경이면 서명과 함께 분리 보고.
- 마지막 gate: §7-A 운영 gate 표 전부, 파일 필터 없는 vitest.
- 사람 실기: AC23.

## READY self-review

- [x] Decision Ledger — D-001~010 ACTIVE, 원문 인용.
- [x] Part I만으로 완료 상태가 이해된다.
- [x] 조건절 재해석 없음 — D-009의 "쓸데없는 코드 구성"은 I-7로 추론임을 표시하고 T3~T7을 근거와 함께 열거했다.
- [x] 사용자 질의 대상 없음 — T1~T7은 제품 동작 불변.
- [x] 수치·앵커 실측 — §8.
- [x] 저장소 규칙·후보 표 확인 — §8 전수 조사 마지막 행 · §16.
- [x] 각 AC에 단언·수단·경로.
- [x] Baseline V, 유효 V = V1.
- [x] NEW·CHANGED node 전부 REQUIRED pair(VP-01~19), 접촉한 INHERITED MD-08은 REGRESSION(VP-20).
- [x] pair별 경로·§10 분모·좌표. 적대 증거는 VP-06·07·20만 선택.
- [x] 규칙 칸 분기 ↔ 입력: EP-4 2분기·EP-5 10자리·AC13 3경우·AC14 2플랫폼이 각 좌표의 입력으로 열거됐다.
- [x] 선언 경계 5건 — 각 근거 좌표와 함께.
- [x] 운영 gate 열거.
- [x] 사람 실기로 미룬 순수 로직 없음 — 옛 구현이 남긴 picker 로직은 VP-19로 내렸다.
- [x] structural proxy 단독 AC 없음 — AC24는 양성 좌표와 짝.
- [x] 신규 계약의 SSOT·강제 지점·seam.
- [x] 부팅/등록 기존 소비처 — §12.
- [x] 상한·one-way door — §14·§17.
- [x] ACTIVE ↔ AC 대조 — §3.

## 20. ΔV1 — 모달 디자인 (D-011, 사용자 요구 변경)

- 판정: 제품 동작·저장 계약·IPC는 그대로다. 바뀌는 것은 `ScheduleTaskModal`·`TriggerFields`·`ExecutionSettingsPicker`의 배치와 표현, 그리고 공용 모달 클래스 3개 추가다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-011↔AC26·AC27. D-003(구성 요소)·D-007(shell에서 권한·모델 숨김)은 AC3이 계속 본다.

### 참조 디자인에서 가져오는 것 / 가져오지 않는 것

| 참조의 요소 | 이번 설계 | 근거 |
|---|---|---|
| 맨 위 큰 제목 입력("Untitled") — 테두리 없는 한 줄 | 가져온다. 모달 헤더 제목과 `제목` 라벨을 없애고 큰 입력이 그 자리를 갖는다. 대화상자 이름은 `aria-label`로 남긴다 | 참조 상단 |
| 제목 아래 한 줄 — 실행 위치 + 모델 선택 칩, 그 밑 안내 한 줄 | 가져온다. 프로젝트·모델·작업 종류·노력·권한을 알약형 선택 칩 한 줄로 둔다. 안내 자리에는 기존 사유 문구(프로젝트 없음·shell 폴더 필요) | D-003 구성 유지 |
| 섹션 라벨(`Trigger`·`Instructions`) — 옅은 색, 카드 위 | 가져온다 | 참조 |
| 트리거 카드 — 시계 + `Scheduled`, 알약형 주기 선택, 사용자 지정은 안쪽 카드에 `Repeat every`·요일 원형 버튼 묶음·시각·`GMT` | 가져온다. 요일 버튼은 한 알약 용기 안의 원형 토글이다 | 참조 1 |
| 명령 입력 — 둥근 카드형 textarea | 가져온다. 명령 종류(프롬프트/shell) 전환은 섹션 라벨 오른쪽에 둔다 | D-004 |
| 우상단 `Cancel`·`Create` | **가져오지 않는다** — "create, cancel 버튼 배치는 현 상태가 좋다" | D-011 |
| 참조의 색·글꼴·그림자 | **가져오지 않는다** — 시맨틱 토큰(`bg-fill-*`·`border-border`·`text-ink*`·`rounded-r*`)과 기존 `Button`·`Modal`·`Icon`만 쓴다 | D-011 · `app/src/renderer/AGENTS.md` |

### 추가 AC

| R | AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-07 | AC26 | 모달 본문이 위에서부터 ① 제목 입력(라벨 없는 큰 입력) ② 프로젝트·실행 설정 칩 한 줄 ③ `트리거` 섹션 ④ `명령` 섹션 순서이고, 사용자 지정 트리거는 요일 7개가 한 묶음(`role="group"`) 안에 있다. 종류별 조건부 필드(AC3)와 트리거 선택 수(AC4)는 그대로다 | render 테스트: 마커의 출현 순서 · 제목 입력의 `aria-label` · 기존 AC3·AC4 케이스 전부 green | `ScheduleTaskModal` → `ScheduleTaskForm` |
| R-07 | AC27 | 실제 창에서 참조와 구성·배치가 닮았고 white/dark 두 테마에서 대비·초점 링·긴 프로젝트명 줄바꿈이 깨지지 않는다 | 사람 실기 | `npm run dev` |

### Node / Pair (증분)

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-07 | R | 모달 배치·표현(AC26·27) | NEW |
| MD-09 | MD | `ScheduleTaskForm` 마크업 구조 · 공용 클래스 `MODAL_SELECT`·`MODAL_SECTION_LABEL`·`MODAL_CARD` | NEW |
| R-02 | R | 모달 필드·트리거(AC3·4·6) | INHERITED — 같은 컴포넌트를 고친다 |

| Pair | left ↔ right | req | production path | 직접 oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-21 | R-07 ↔ AT(AC26·27) | REQUIRED | `ScheduleTaskModal` → `ScheduleTaskForm` → `TriggerFields` | `features/schedules/components/scheduleTaskModal.render.test.ts` 신규 케이스(순서·`aria-label`·요일 묶음) · AC27 사람 실기 | not selected | 0 |
| VP-22 | MD-09 ↔ UT-09 | REQUIRED | `ScheduleTaskForm` | VP-21과 같은 좌표 | not selected | 0 |
| VP-02 | R-02 ↔ AT(AC3·4·6) | REGRESSION | V1 그대로 | `scheduleTaskModal.render.test.ts` 기존 7케이스 · `scheduleForm.test.ts` | not selected | EP-1 ① |

- 변경 파일: `shared/ui/Modal.tsx`(클래스 3개 추가) · `features/schedules/components/{ScheduleTaskModal,TriggerFields}.tsx` · `features/chat/components/ExecutionSettingsPicker.tsx` · i18n `schedules.modal.*`(제목 접근성 이름) · `docs/arch/frontend/design-components.md` 해당 행.
- 선언 경계: 색·간격의 시각 품질은 자동 좌표가 없다(AC27). picker 화면 자체는 V1과 같이 실기다.
- gate: V1 §19와 같다.

## 21. ΔV2 — 설정 칩과 메뉴 (D-012~D-014, 사용자 요구 변경)

- 판정: 동작·저장 계약은 그대로다. 모달의 모든 선택(프로젝트·모델·작업 종류·노력·권한·주기·요일·시각)이 네이티브 `select` 대신 내용 너비의 칩이고, 펼치는 메뉴는 컴포저의 것이다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-012↔AC28, D-013↔AC29, D-014↔AC30. D-007(shell에서 권한·모델 숨김)은 AC3이 계속 본다.

| 대상 | 이번 설계 | 재사용 |
|---|---|---|
| 모델·노력·권한 메뉴 | 컴포저 메뉴 그대로 | `ModelMenu`·`EffortMenu`·`ModeMenu`·`modeMenuOptions` |
| 실행 설정 칩 | 테두리 하나를 나눠 쓰는 묶음(모델·종류·노력·권한). 노력은 Claude 하네스만, 권한은 `permissionModes` 하네스만 | 신규 `shared/ui/MenuChip.tsx`(칩 + Popover, Esc는 메뉴만 닫음) |
| 프로젝트 칩·메뉴 | 컴포저 프로젝트 버튼의 칩·메뉴(검색 · 폴더 행 · `프로젝트 추가`)를 그대로 쓴다. 메뉴 본문을 `ProjectMenuPanel`로 떼어 컴포저와 예약 모달이 함께 쓴다 | 신규 `features/chat/components/ProjectMenuPanel.tsx` · `ProjectPickerChip.tsx` · `chipSurface('outlined')` |
| 예약 모달의 `프로젝트 추가` | 폴더를 고르면 그 경로로 프로젝트를 만들고(이미 있으면 그것) 선택한다 | `fileApi.pickDirectory` · `projectApi.create({ cwd })` — pages가 주입 |
| 트리거 선택(주기·요일·시각) | 값 하나를 고르는 칩 + 체크 목록 메뉴 | `MenuChip` · `MenuItem` |
| 코드 아이콘 | 목록 행의 shell 작업 아이콘과 작업 종류 메뉴·칩의 `코드`를 `terminal2`로 | `agentPresentation.code.navIcon` |

- 폴더 없는 프로젝트: 컴포저 메뉴는 폴더 있는 프로젝트만 보인다. 예약 모달은 프롬프트 작업이 폴더 없는 프로젝트를 쓸 수 있어 그 행도 보이고 `폴더 없음` 태그를 단다 — 메뉴 형태는 같다.

| R | AC | 동작 기준 | 검증 수단 | 경로 |
|---|---|---|---|---|
| R-08 | AC28 | 모달 안에 `<select>`가 없고, 실행 설정은 한 묶음 안의 칩(모델·종류·노력·권한)이며 각 칩은 컴포저 메뉴를 펼친다 | render: `<select` 0 · 묶음 마커 안 칩 수(Claude work 4 · OpenCode 1) | `ExecutionSettingsPicker` |
| R-08 | AC29 | 프로젝트 칩은 컴포저와 같은 칩이고 메뉴는 검색·프로젝트 행·`프로젝트 추가`를 가진다. 행을 고르면 그 id가 폼에 들어가고, 추가는 고른 폴더의 프로젝트 id를 넣는다 | `ProjectMenuPanel` 상호작용 테스트(검색 필터·선택·추가) · 컴포저 기존 `project-picker` 테스트 2파일 REGRESSION | `ProjectPickerChip` → `ProjectMenuPanel` |
| R-08 | AC30 | shell 작업 행과 작업 종류의 `코드`가 nav 세션과 같은 아이콘이다 | render: 행 아이콘 path = `terminal2` | `ScheduleRow` · `ExecutionSettingsPicker` |
| R-08 | AC31 | 실제 창에서 칩 너비가 내용만큼이고 메뉴가 컴포저와 같게 보인다 | 사람 실기 | `npm run dev` |

| Pair | left ↔ right | req | 직접 oracle | §10 |
|---|---|---|---|---|
| VP-23 | R-08 ↔ AT(AC28~31) | REQUIRED | `scheduleTaskModal.render.test.ts` · 신규 `features/chat/components/projectMenuPanel.test.ts` · `schedulesScreen.render.test.ts` · AC31 실기 | 0 |
| VP-24 | MD-04′(`ProjectMenuPanel` 추출) ↔ UT | REQUIRED | 신규 `projectMenuPanel.test.ts` | 0 |
| VP-25 | 컴포저 프로젝트 선택 ↔ UT | REGRESSION | `pages/NewChatLandingPage.project-picker.test.ts` · `pages/ProjectLandingPage.project-picker.test.ts` | 0 |
| VP-19 | MD-07 ↔ UT-07 | REGRESSION | `features/chat/lib/executionSettings.test.ts` | 0 |

- 선언 경계: 칩·메뉴의 시각 품질은 AC31 실기다.
- gate: V1 §19와 같다.

## 22. ΔV3 — 상세를 우측 패널로 (D-015, 사용자 요구 변경)

- 판정: 행을 누르면 아래로 펼치던 실행 이력을 플러그인 스킬 탭과 같은 우측 상세 패널로 연다. 동작·저장 계약은 그대로다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-015↔AC32·AC33. D-008(지금 실행·편집·삭제·이력)은 패널 안에서도 유지된다.

| 대상 | 이번 설계 | 재사용 |
|---|---|---|
| 패널 셸 | 스킬 탭의 `ExtensionDetailPane` 셸(크기 조절·펼치기·닫기·Esc)을 `shared/ui/DetailSidePane.tsx`로 올려 두 feature가 함께 쓴다. `ExtensionDetailPane`은 그 셸에 자기 data 표식만 얹는다 | `ResizableSidePane` · `PanelExpandButton` · `PanelCloseButton` |
| 패널 본문 | 신규 `features/schedules/components/ScheduleDetail.tsx` — 제목·사용 토글·메뉴(지금 실행·편집·삭제) · 메타(트리거·프로젝트·다음 실행·명령 종류) · 명령 본문 · 실행 이력 | `SkillDetail`의 머리줄·`Meta` 배치 · 기존 `RunHistoryPanel` |
| 목록 | `data-side-pane-host` · 선택 행 강조 · 패널을 펼치면 목록 `inert` · 패널이 열리면 목록 여백을 줄인다 · 닫으면 연 행으로 초점 복귀 | `ExtensionsCatalogView`와 같은 규칙 |
| `지금 실행` | 그 작업을 선택해 패널에서 새 실행이 보이게 한다 | — |

| R | AC | 동작 기준 | 검증 수단 | 경로 |
|---|---|---|---|---|
| R-09 | AC32 | 행을 누르면 목록 아래가 아니라 우측 패널이 열리고 그 작업의 메타·명령·실행 이력을 보인다. 같은 행을 다시 누르거나 닫기·Esc면 패널이 닫힌다. 목록 행 사이에는 펼침 영역이 없다 | render: 선택 전 패널 0 · 선택 뒤 패널 1(작업 id 표식)·이력 영역 · 목록 `<li>` 수 = 작업 수 | `SchedulesScreen` → `DetailSidePane` → `ScheduleDetail` |
| R-09 | AC33 | 스킬 탭의 패널은 같은 셸로 바뀌어도 동작이 같다 | 플러그인 카탈로그 기존 테스트 REGRESSION | `ExtensionsCatalogView` → `ExtensionDetailPane` → `DetailSidePane` |
| R-09 | AC34 | 실제 창에서 패널 크기 조절·펼치기·초점 복귀가 스킬 탭과 같다 | 사람 실기 | `npm run dev` |

| Pair | left ↔ right | req | 직접 oracle | §10 |
|---|---|---|---|---|
| VP-26 | R-09 ↔ AT(AC32·34) | REQUIRED | `schedulesScreen.render.test.ts` 신규 케이스 · 신규 `scheduleDetail.render.test.ts` · AC34 실기 | 0 |
| VP-27 | 스킬 탭 상세 패널 ↔ UT | REGRESSION | `features/skills/**` 카탈로그·상세 테스트 | 0 |

- 선언 경계: 크기 조절 드래그·펼치기 애니메이션은 AC34 실기다(`ResizableSidePane` 자체 테스트가 있다).
- gate: V1 §19와 같다.

## 23. ΔV4 — verify r1 정정 (확장 후보 채택 · 경계 축소)

- 판정: 제품 동작·저장 계약·IPC는 그대로다. verify r1(창 안 1회째)이 올린 확장 후보 E1~E3를 **전부 채택**하고, 근거가 틀린 선언 경계 5를 줄이며, VP-26의 없는 좌표를 고친다. 새 사용자 결정은 없다.
- 같은 verify의 BLOCKING D1~D5는 계약이 이미 말한 것이라 규범을 바꾸지 않는다 — 구현 r2가 닫는다(아래 "r2 작업 목록").
- 확장 창: 이번이 verify 1회째 뒤의 설계 턴이다. 2회째 뒤 설계 턴까지 열거를 늘릴 수 있다.

### 확장 후보 판정

| # | 후보 | 판정 | 근거 |
|---|---|---|---|
| E1 | EP-1 "text가 변형 없이" ↔ ⑤ `startDetachedChat`의 `trim`(V46 green) | **채택 — 규칙 칸 정정** | 일반 `send`도 `text.trim()`(`chatStore.ts:1020`) — 같은 규칙이 맞다. 정리는 ⑤ 한 곳에서만 하고 ①~④는 저장값 그대로 운반한다 |
| E2 | 행·패널의 메뉴 콜백 대상·`지금 실행` 비활성·토글 표시·`inert`(D03~D06·X05·X06 green) | **채택 — AC35 · EP-9 신설** | 선언 경계 5의 근거("정적 마크업이라 닫힌 Popover 클릭을 낼 수 없다")가 r1.4 뒤 틀렸다: `renderHarness.testfixture.ts:327`은 `createPortal`을 그대로 렌더하고, 같은 하네스로 Popover 메뉴를 실제로 누르는 테스트가 있다(`projectPickerChip.test.ts`·`CascadeMenu.flow.test.ts`) |
| E3 | `Scheduler` cron 가지의 호출 대체(V55 green) | **채택 — VP-17 oracle 강화** | 가짜 시계 고정 시각에서 cron 식 `0 */1 * * *`의 `nextRun`이 다음 정시와 같다고 단언하면 interval 대체가 red가 된다 |

### 정정한 규범 행

| 대상 | 이전(유지·대체) | ΔV4 |
|---|---|---|
| EP-1 규칙(SD-02 / VP-07) | "실행 설정 6필드 + `projectId` + `text`가 변형 없이 전송 payload까지 간다" — **SUPERSEDED** | 6필드 + `projectId`는 변형 없이. `text`는 ①~④에서 저장값 그대로, **⑤ `startDetachedChat`에서만 앞뒤 공백을 지운다**(`send`와 같은 규칙). 자리 목록 5자리는 그대로 |
| EP-1 UT 입력(추가) | — | ③ `runner.test`·④ `useScheduledPromptRelay.test`에 앞뒤 공백이 있는 본문(`'  점검 \n'`) → 출력이 그 문자열 그대로 · ⑤ `chatStore.detached.test`에 같은 본문 → payload `text`·낙관 커밋 메시지가 `'점검'` |
| 선언 경계 5 | "행 메뉴 클릭 → 콜백 전달과 preload 브리지는 자동 좌표가 없다" — **SUPERSEDED** | 경계 5′: **preload 브리지만** 자동 좌표가 없다(`preload/index.ts`는 `electron`을 import). 행·패널 메뉴 클릭은 EP-9가 잠근다 |
| VP-26 oracle 좌표 | "`schedulesScreen.render.test.ts` 신규 케이스 · 신규 `scheduleDetail.render.test.ts`" — **SUPERSEDED**(둘 다 만들어지지 않았다) | `features/schedules/components/schedulesScreen.detail.test.ts`(r1.4, 열기·바꾸기·닫기·토글) + 같은 하네스의 패널 본문·메뉴 케이스(EP-9·AC32 아래 입력). 파일 이름은 계약이 아니다 |
| VP-17 oracle | `scheduler.test.ts:'registers a cron schedule and exposes nextRun'`(Date 여부) — **CHANGED** | 같은 케이스(또는 새 케이스)에서 가짜 시계를 `2026-01-06 09:20` 로컬로 고정하고 `nextRun` = `2026-01-06 10:00` 로컬을 단언 |

### 추가 AC

| R | AC | 동작 기준 | 검증 수단 | 경로 |
|---|---|---|---|---|
| R-09 | AC35 | 목록 행과 우측 패널 모두에서 ① 사용 토글은 그 작업의 사용 상태를 보이고 누르면 그 작업에 반대값을 적용 ② 메뉴의 `지금 실행`·`편집`·`삭제`는 그 작업을 대상으로 한다(편집은 그 작업 값으로 모달이 열린다) ③ 그 작업이 실행 중이면 `지금 실행`이 비활성 ④ 목록 행의 `지금 실행`은 그 작업의 패널도 연다 ⑤ 패널을 펼치면 목록이 `inert`, 접으면 아니다 | fake DOM 상호작용 테스트(실제 클릭으로 Popover를 연다) | `SchedulesScreen` → `ScheduleRow`·`DetailSidePane` → `ScheduleDetail` → 콜백 |

AC32의 검증 수단도 보강한다(동작 기준 불변): 패널 본문의 메타 4칸(트리거 요약 · 프로젝트 이름 또는 `프로젝트 없음` · 다음 실행 — 시각 / `실행 중` / `일시 중지` · 명령 종류)과 이력 행의 `대화 열기`가 그 세션 id로 `onOpenSession`을 부르는지 단언한다.

### Node / Pair (증분)

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-09 | R | AC32·AC34 + AC35 | CHANGED (기준: §22 ΔV3) |
| SD-02 | SD | EP-1 규칙(본문 정리 위치) | CHANGED (기준: §10 V1) |
| AR-05 | AR | `Scheduler` cron 가지 → `startCron` | CHANGED — oracle만 (기준: §7-A V1) |

| Pair | left ↔ right | req | production path | 직접 oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-26′ | R-09 ↔ AT(AC32·34·35) | REQUIRED | `SchedulesScreen` → `ScheduleRow` / `DetailSidePane` → `ScheduleDetail` → 콜백 | `schedulesScreen.detail.test.ts` + 패널 본문·메뉴 케이스 · AC34 실기 | not selected | EP-9 (21) |
| VP-07′ | SD-02 ↔ ST-02 | REQUIRED | V1 그대로 | V1 좌표 + 위 EP-1 입력 | V1 등록 변이 유지 | EP-1 (5) |
| VP-17′ | AR-05 ↔ IT-05 | REQUIRED | `Scheduler.schedule({cron})` → `startCron` | 위 VP-17 oracle | not selected | 0 |

### §10 추가 — EP-9

| V node / pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 (`app/src/renderer/src/features/schedules/components`, 테스트 제외) | 실패 의미 |
|---|---|---|---|---|---|
| EP-9 · R-09 / VP-26′ | 행·패널의 조작은 그 작업을 대상으로 하고 상태를 그대로 보인다(AC35) | `SchedulesScreen`의 `task`·`selected` | 21자리 — 행 `ScheduleRow.tsx` R1 토글 표시 `:94` · R2 토글 클릭 `:96` · R3 `지금 실행` 비활성 `:127` · R4 `onRunNow()` `:130` · R5 `onEdit()` `:140` · R6 `onDelete()` `:150` / 패널 `ScheduleDetail.tsx` P1 `:69` · P2 `:71` · P3 `:95` · P4 `:98` · P5 `:108` · P6 `:118` / 화면 `SchedulesScreen.tsx` S1 `inert` `:110` · 행 배선 S2 `:190` · S3 `:194`(+`select`) · S4 `:196` · S5 `:197` · 패널 배선 S6 `:223` · S7 `:224` · S8 `:225` · S9 `:226` | `rg -n "onRunNow\(\|onEdit\(\|onDelete\(\|onSetEnabled\(\|setEditing\(\|disabled=\{task\.running\}\|on=\{task\.enabled\}\|inert=" --glob '!*.test.ts'` → 24줄 중 생성 버튼·모달 닫기 3줄(`:97`·`:128`·`:176` — `setEditing(null\|'new')`)은 이 계약이 아니다 | 다른 작업이 켜지거나 지워지고, 실행 중인 작업을 다시 누를 수 있다 |

EP-9 규칙 칸 ↔ UT 입력 칸:

| 규칙 분기 | 입력 | 관측 |
|---|---|---|
| 토글 표시 = 사용 상태 (R1·P1) | 작업 2개: `t1` enabled · `t2` **disabled** | `t2` 행·패널 토글 `aria-checked="false"`, `t1`은 `"true"` |
| 토글 클릭 = 반대값 · 그 작업 (R2·P2·S2·S6) | `t2`(disabled) 행·패널 토글 클릭 | `onSetEnabled('t2', true)` — `t1`·`false`가 아니다 |
| 메뉴 대상 = 그 작업 (R4~R6·P4~P6·S3~S5·S7~S9) | 둘째 작업 `t2`의 행 메뉴·패널 메뉴를 각각 열어 세 항목 클릭 | `onRunNow('t2')` · `onDelete` 인자 id `t2` · 편집 모달의 제목 입력 값 = `t2` 제목 |
| 행 `지금 실행` → 패널 열림 (S3) | 패널이 닫힌 상태에서 `t2` 행 메뉴의 `지금 실행` | 패널 표식 `t2` |
| 실행 중 → `지금 실행` 비활성 (R3·P3) | `t2` `running: true` · `t1` `running: false` | `t2` 항목 `disabled`·클릭해도 `onRunNow` 0회, `t1`은 활성 |
| 펼침 → `inert` (S1) | 패널 열고 펼치기 버튼 클릭 → 다시 클릭 | 목록 컨테이너 `inert` true → false |

- 선언 경계(EP-9): 시각(초점 링·애니메이션)과 Esc 닫기는 AC34 실기 그대로.

### r2 작업 목록 (구현자)

| # | 출처 | 할 일 | 계약 |
|---|---|---|---|
| D1 | verify r1 | 실행 중 작업을 `service.delete`로 지우면 실행이 중단·종결되는 lifecycle 케이스 | §5 상태 전이 · EP-5 ⑩ — 불변 |
| D2 | verify r1 | win32 마지막 인자 = UTF-8 접두 + 명령 전체 단언 | AC14 — 불변 |
| D3 | verify r1 | `timedOut ∧ exitCode 0` 입력 → `status=error`·`error=timeout` | AC15 — 불변 |
| D4 | verify r1 | 제한 시간이 지나면 손자 프로세스가 파이프를 잡고 있어도 실행을 끝낸다. 회귀는 실제 spawn(io 풀)으로 `sh -c "sleep 4; echo x"` · 제한 300ms → 종결 시각이 제한 + 여유(≤ 1초) 안 | AC15 — 불변. 방식(프로세스 그룹 종료·`exit` 시점 확정 등)은 구현 재량 |
| D5 | verify r1 | AC32 패널 본문 단언(위 보강) | AC32 — 불변 |
| E1~E3 | ΔV4 | 위 EP-1 입력 · EP-9 21자리 · VP-17 oracle | ΔV4 |

- gate: V1 §19와 같다. 마지막 gate는 파일 필터 없는 vitest를 **Node ABI에서** 돌려 io 풀까지 포함한다(r1.3·r1.4의 io 44파일 미실행을 반복하지 않는다).

### ΔV4 self-review

- ACTIVE ↔ AC: D-008↔AC35 · D-005·D-006↔EP-1 정정. 충돌 0.
- EP-9 자리 검색 재실행: 24줄(행 6 · 패널 6 · 화면 12) = 자리 21 + 제외 3(`:97`·`:128`·`:176`). 차집합 ∅.
- 규칙 칸 6분기 ↔ 입력 6행 1:1.
- 경계 5′는 `preload/index.ts`의 `electron` import로 측정.

## 24. ΔV5 — verify r2 정정 (확장 후보 E4~E7 판정 · plan 동결)

- 판정: 제품 동작·저장 계약·IPC는 그대로다. verify r2(창 안 2회째)의 확장 후보 중 **E4·E5·E6 전부와 E7 ①②③을 채택**하고 **E7 ④만 경계로 선언**한다. 새 사용자 결정은 없다.
- 이번이 verify 2회째 뒤의 설계 턴 — **열거 원문을 늘릴 수 있는 마지막 턴**이다. 이후 새 열거 항목은 출처(현재 결함 · plan 내부 정합 · 사용자 결정)를 적는다.
- prod 코드 변경은 기대하지 않는다(코드는 계약대로 — verify r2 §7). r3는 테스트로 잠근다. prod를 고치면 그 파일의 기존 pair가 REGRESSION이다.

### 확장 후보 판정

| # | 후보 | 판정 | 근거 |
|---|---|---|---|
| E4 | 모달·트리거·실행 설정·페이지 슬롯의 입력 → 폼 배선(M3·M4·M5·M8·T1~T4·Q2~Q5 green) | **채택 — AC36 · EP-10(19자리)** | 사용자가 고른 값이 저장 요청에 들어가는 것이 모달의 목적이다. 같은 하네스(`renderHarness.testfixture.ts`)로 칩 메뉴를 실제로 누를 수 있다(EP-9 선례) |
| E5 | `저장` → `onSubmit` · 실패 시 열린 채 문구(M10·M11 green) | **채택 — AC37 · EP-11(5자리)** | Part I §5 "저장 실패는 모달을 닫지 않고 문구를 띄운다"(`plan.md:126`)가 이미 제품 문장이다 — AC로 올린다 |
| E6 | 안내·0건·툴팁 문구(M7·N6·O6 green) | **채택 — AC38 · EP-12(9자리)** | 문구 자체가 아니라 *어느 문구를 고르는가*가 조건 분기다(`ScheduleTaskModal.tsx:173-179` 3분기 · `ProjectMenuPanel.tsx:112-118` 3분기). 순수 로직을 사람 실기로 미루지 않는다. 글자·시각은 AC27·31 그대로 |
| E7 ① | `SIGKILL` 세기(S2 green) | **채택 — AC39 · EP-13 K4** | TERM을 무시하는 자손이 남으면 D4 계약("자손까지 끝낸다", `docs/arch/backend/security.md`)이 깨진다 |
| E7 ② | 정상 종료 뒤 타이머·abort 리스너 정리(S8·S9 green) | **채택 — EP-13 K5·K6** | 정리가 빠지면 끝난 실행의 pid로 `process.kill(-pid)`가 나간다(`shell-runner.ts:82`) — pid 재사용 시 남의 프로세스 그룹 |
| E7 ③ | win32 `taskkill` 3자리(S1·S4·S6 green) | **채택 — EP-13 K1~K3·K7** | Windows CI의 실제 프로세스 테스트는 `timedOut`·시간만 보고 자손 생존은 `if (!isWin)`로 건너뛴다(`shell-runner.process.test.ts:41`) — CI 위임으로 닫히지 않는다. 인자·폴백은 `node:child_process` 대체로 플랫폼 무관하게 관측된다 |
| E7 ④ | `setsid`로 그룹을 벗어난 손자(A5) | **경계** | 실행 종결 계약은 충족(verify r2 A5: 401ms 종결). 그룹 밖 자손 추적은 cgroup/Job Object 수준이라 이 계약 범위가 아니다 |

### 추가 AC

| R | AC | 동작 기준 | 검증 수단 | 경로 |
|---|---|---|---|---|
| R-02 | AC36 | 모달에서 사용자가 바꾼 제목·프로젝트·실행 설정·트리거(주기·요일·시각·지정 요일)·명령 종류·본문이 `저장` 시 저장 요청에 그 값 그대로 들어간다. 실행 설정 칩의 모델·종류·노력·권한 선택도 그 값으로 바뀌고 나머지 필드는 유지된다 | fake DOM 상호작용(칩 메뉴를 실제로 열고 누름) → `onSubmit` 인자 / `onChange` 인자 | `SchedulesPage` 슬롯 → `ScheduleTaskModal` → `ScheduleTaskForm`·`TriggerFields`·`ExecutionSettingsPicker` → `validateForm` → `onSubmit` |
| R-03 | AC37 | `저장`은 검증된 요청으로 `onSubmit`을 한 번 부르고 성공하면 모달을 닫는다. 실패하면 모달이 열린 채 `저장 실패` 문구가 보이고 입력이 남으며, 다시 저장해 성공하면 문구가 사라지고 닫힌다 | fake DOM: `onSubmit` resolve / reject → resolve | `ScheduleTaskModal.save` |
| R-08 | AC38 | 모달 안내 문구는 프로젝트 0개 → `noProjects`, shell+폴더 없는 프로젝트 → `shellNeedsFolder` 경고, shell → `shellProjectHint`, 프롬프트 → `projectHint`. 프로젝트 메뉴의 빈 상태는 로딩 → `loading`, 검색 0건 → `noMatches`, 그 밖 → `emptyFolders`. 칩·행 툴팁은 폴더 경로(없으면 칩은 `프로젝트` 라벨, 행은 없음) | fake DOM / render — 분기별 문구 키 | `ScheduleTaskForm` · `ProjectMenuPanel` · `ProjectPickerChip` |
| R-04 | AC39 | shell 종료는 ① POSIX에서 TERM을 무시하는 자손까지 끝내고 ② win32에서 `taskkill /pid <pid> /T /F`를 창 없이 부르며, 그 실행이 실패하면 셸이라도 끝낸다 ③ 실행이 정상 종료한 뒤에는 제한 시간이 지나거나 중단 신호가 와도 종료를 다시 부르지 않는다 ④ 셸은 양 플랫폼에서 창 없이 띄운다 | 실제 프로세스(io) + 단위(가짜 타이머 · `node:child_process` 대체) | `runShellCommand` → `killProcessTree` |

### Node / Pair (증분)

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-02 | R | AC3·4·6 + AC36 | CHANGED (기준: §6 V1 · §20 ΔV1 INHERITED) |
| R-03 | R | AC7~11·17 + AC37 | CHANGED (기준: §6 V1) |
| R-08 | R | AC28~31 + AC38 | CHANGED (기준: §21 ΔV2) |
| R-04 | R | AC12~16·18~21 + AC39 | CHANGED (기준: §6 V1) |
| AR-04 | AR | `SchedulesPage` 슬롯 → chat 칩 `onChange` 전달 | CHANGED — §10만 (기준: §7-A V1) |
| MD-02 | MD | `runShellCommand`·`killProcessTree` | CHANGED (기준: §7-A V1 · ΔV4 r2 D4) |

| Pair | left ↔ right | req | production path | 직접 oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-02′ | R-02 ↔ AT(AC3·4·6·36·38 모달분) | REQUIRED | `ScheduleTaskModal` → `ScheduleTaskForm`/`TriggerFields`/슬롯 → `setForm` → `validateForm` → `onSubmit` | V1 좌표 + EP-10 A · EP-12 A 입력 | not selected | EP-10 A (12) · EP-12 A (4) |
| VP-23′ | R-08 ↔ AT(AC28~31·36·38) | REQUIRED | `ExecutionSettingsPicker` → 컴포저 메뉴 `onPick` → `onChange` · `ProjectMenuPanel`/`ProjectPickerChip` 문구 | ΔV2 좌표 + EP-10 B · EP-12 B 입력 | not selected | EP-10 B (5) · EP-12 B (5) |
| VP-11′ | AR-04 ↔ IT-04 | REQUIRED | `SchedulesPage.pickers` → `ProjectPickerChip`/`ExecutionSettingsPicker` `onChange` | V1 좌표 + EP-10 C 입력 | not selected | EP-10 C (2) |
| VP-03′ | R-03 ↔ AT(AC7~11·17·37) | REQUIRED | `ModalActions.onConfirm` → `save` → `onSubmit` → `onClose` / `setFailed` | V1 좌표 + EP-11 입력 | not selected | EP-11 (5) |
| VP-12′ | MD-02 ↔ UT-02 | REQUIRED | `runShellCommand` → `kill` → `killProcessTree` · `done` 정리 | V1·r2 좌표 + EP-13 입력 | not selected | EP-6 · EP-13 (8) |
| VP-04 | R-04 ↔ AT(AC12~16·18~21·39) | REGRESSION | V1 그대로 | VP-12′ 좌표 | — | — |

- AC38 모달 문구 4자리(EP-12 A)는 VP-02′ path 안이라 VP-02′가 든다.
- 그 밖 ΔV1~ΔV4 pair는 이번 변경이 prod를 건드리지 않으면 비영향이다. prod를 고치면 그 파일의 pair가 REGRESSION이다.

### §10 추가 — EP-10 · EP-11 · EP-12 · EP-13

자리 검색 명령은 모두 `app/src/`에서, 테스트 파일 제외.

| V node / pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| EP-10 · R-02·R-08·AR-04 / VP-02′·VP-23′·VP-11′ | 사용자 입력 값이 폼 상태를 거쳐 저장 요청까지 그대로 간다(AC36) | **A 모달·트리거 12** — `ScheduleTaskModal.tsx` F0 패치 병합 `:106` · F1 트리거 전달 `:186` · F2 제목 `:152` · F3 프로젝트 `:159` · F4 실행 설정 `:163` · F5 종류 `:204` · F6 본문 `:218` / `TriggerFields.tsx` T0 `ChoiceChip` `onPick(option)` `:59` · T1 주기 `:114` · T2 요일 `:126` · T3 시각 `:95` · T4 지정 요일 토글 `:151`<br>**B 실행 설정 5** — `ExecutionSettingsPicker.tsx` Q1 기본 모델 채움 `:53` · Q5 모델 `:93` · Q4 종류 `:116` · Q3 노력 `:141` · Q2 권한 `:160`<br>**C 페이지 슬롯 2** — `SchedulesPage.tsx` G1 `:34` · G2 `:39` | `rg -n "onChange\(\|onPick\(\|onChange=\{\|onPick=\{" renderer/src/features/schedules/components/ScheduleTaskModal.tsx renderer/src/features/schedules/components/TriggerFields.tsx renderer/src/features/chat/components/ExecutionSettingsPicker.tsx renderer/src/pages/SchedulesPage.tsx` → 22줄 = 19자리 + 제외 3(`ExecutionSettingsPicker.tsx:87`·`:140`·`:159` — 컴포저 메뉴 `onPick=` 여는 줄, 운반은 다음 줄의 `onChange`) | 고른 값과 다른 값이 저장되거나 저장되지 않는다 |
| EP-11 · R-03 / VP-03′ | 저장 성공은 요청 1회 + 닫힘, 실패는 열린 채 문구(AC37) | 5자리 — `ScheduleTaskModal.tsx` V1 실패 해제 `:72` · V2 `onSubmit(result.request)` `:74` · V3 `onClose()` `:75` · V4 `setFailed(true)` `:78` · V5 문구 표시 `:109` | `rg -n "onSubmit\(\|onClose\(\)\|setFailed\(\|failed &&" renderer/src/features/schedules/components/ScheduleTaskModal.tsx` → 5줄 = 5자리 | 저장이 안 되거나, 실패가 "아무 일도 안 일어남"으로 보인다 |
| EP-12 · R-02·R-08 / VP-02′·VP-23′ | 상태에 맞는 안내·빈 상태·툴팁을 고른다(AC38) | **A 모달 4** — `ScheduleTaskModal.tsx` `:169` · `:175` · `:177` · `:178`<br>**B 프로젝트 메뉴·칩 5** — `ProjectMenuPanel.tsx` 행 툴팁 `:98` · `:114` · `:116` · `:117` / `ProjectPickerChip.tsx` 칩 툴팁 `:46` | `rg -n "noProjects\|shellProjectHint\|projectHint\|shellNeedsFolder" renderer/src/features/schedules/components/ScheduleTaskModal.tsx` → 4줄 · `rg -n "projects\.loading\|noMatches\|emptyFolders\|title=" renderer/src/features/chat/components/ProjectMenuPanel.tsx renderer/src/features/chat/components/ProjectPickerChip.tsx` → 5줄 = 9자리 | 상태와 맞지 않는 안내로 사용자가 원인을 오해한다 |
| EP-13 · MD-02 / VP-12′ | 종료는 자손까지·창 없이·끝난 실행에 다시 나가지 않는다(AC39) | 8자리 — `shell-runner.ts` K1 `taskkill` 인자 `:73` · K2 그 `windowsHide` `:74` · K3 `error` 폴백 `:77` · K4 `SIGKILL` `:82` · K8 pid 없음 폴백 `child.kill()` `:88` · K5 `clearTimeout` `:125` · K6 `removeEventListener` `:126` · K7 셸 `windowsHide` `:138` | `rg -n "process\.kill\|taskkill\|child\.kill\(\|clearTimeout\|removeEventListener\|windowsHide" main/infra/shell/shell-runner.ts` → 9줄 = 8자리 + 제외 1(`:30` — `SpawnLike` 타입 선언) | 자손이 남거나, 끝난 실행의 pid로 남의 프로세스 그룹에 신호가 간다 |

### 규칙 칸 ↔ UT 입력 칸

모든 입력은 기본값·형제 값과 다르게 준다. 관측은 EP-10 A·EP-11은 `onSubmit` 인자, EP-10 B는 `onChange` 인자, EP-10 C는 호출자가 넘긴 콜백의 인자다.

| 자리 | 규칙 분기 | 입력 | 관측 |
|---|---|---|---|
| F2 | 제목 | 제목 입력에 `야간 빌드` | `request.title === '야간 빌드'` |
| F3·G1 | 프로젝트 = 고른 id | (A) 슬롯 stub이 받은 콜백을 `'p2'`로 호출(초기 `'p1'`) · (C) 페이지가 만든 `pickers.project(null, spy)`의 칩 `onChange('p-folder')` | (A) `request.projectId === 'p2'` · (C) `spy('p-folder')` |
| F4·G2 | 실행 설정 = 고른 값 | (A) 슬롯 stub 콜백을 `permissionMode:'plan'`·`effort:'low'` 값으로 호출 · (C) `pickers.execution(v, spy)`의 칩 `onChange(x)` | (A) `request` 실행 설정이 그 값 · (C) `spy(x)` |
| F5 | 종류 전환 | 폴더 있는 프로젝트에서 `shell` 라디오 클릭 | `request.kind === 'shell'`, 실행 설정 없음(D-007) |
| F6 | 본문 | 본문에 `echo hi` | 요청 명령 = `echo hi` |
| F0 | 패치는 현재 상태에 겹친다 | 제목 → 본문 순서로 두 번 바꿈 | 요청에 둘 다 남는다 |
| T1·T0·F1 | 주기 = 고른 항목 | 주기 칩 열고 `매주` 클릭(초기 `매일`) | `trigger.kind === 'weekly'` |
| T2 | 요일 = 고른 항목 | `매주`에서 요일 칩의 기본과 다른 요일 클릭 | `trigger.day` = 그 요일 |
| T3 | 시각 = 고른 항목 | 시각 칩에서 기본과 다른 `10:30` | `trigger.at = {hour:10, minute:30}` |
| T4 | 지정 요일 토글 — 없으면 더함 / 있으면 뺌 | `사용자 지정`에서 꺼진 요일 클릭 + 켜진 요일 클릭 | `trigger.days`에 앞 요일 포함·뒤 요일 제외 |
| Q1 | 값 없음 → 카탈로그 기본 / 값 있음 → 부르지 않음 | `value: null` 렌더 · 저장값 있는 렌더 | `onChange(기본 모델 실행값)` 1회 · 0회 |
| Q5 | 모델 = 고른 모델, 권한 유지 | `permissionMode:'plan'` 값에서 기본이 아닌 모델 클릭 | 인자의 `providerKey`·`modelFamily` = 고른 모델, `permissionMode:'plan'` |
| Q4 | 종류 = 고른 종류, 권한 승계 | 종류 2개 모델에서 현재와 다른 종류 클릭 | `agentKind` = 고른 종류 |
| Q3 | 노력 = 고른 값 | 기본과 다른 `low` 클릭 | `effort: 'low'` |
| Q2 | 권한 = 고른 값 | `default`에서 `plan` 클릭 | `permissionMode: 'plan'` |
| V2·V3 | 성공 | 유효한 편집 모달 · `onSubmit` resolve · `저장` 클릭 | `onSubmit` 1회 인자 = 검증된 요청 · `onClose` 1회 |
| V4·V5 | 실패 → 문구 · 재시도 성공 → 문구 해제 | `onSubmit` reject 후 resolve로 바꿔 다시 `저장` | 1차: `onClose` 0 · `role="alert"` `saveFailed` · 제목 값 유지 / 2차: 문구 없음 · `onClose` 1 |
| V1 | 재시도 시 실패 해제 | 위 2차 | 위 2차와 같음 |
| `:175`·`:177`·`:178`·`:169` | 0개 / shell / 프롬프트 / shell+폴더 없음 | `projects: []` · shell+폴더 있음 · 프롬프트+프로젝트 있음 · shell+`cwd:null` 프로젝트 | 각각 `noProjects` · `shellProjectHint` · `projectHint` · `shellNeedsFolder`(`role="alert"`) |
| `:114`·`:116`·`:117` | 로딩 / 검색 0건 / 그 밖 | `loading` 참 · 일치 없는 검색어 · 검색어 없음+폴더 0 | `projects.loading` · `projects.noMatches` · `projects.emptyFolders` |
| `:98` | 행 툴팁 = 폴더 경로 / 없으면 없음 | 폴더 있는 행 · 없는 행 | `title` = 경로 · `title` 없음 |
| `:46` | 칩 툴팁 = 고른 프로젝트 폴더 / 아니면 라벨 | 폴더 있는 프로젝트 선택 · 미선택 | `title` = 경로 · `schedules.modal.project` |
| K4 | POSIX 그룹을 `SIGKILL`로 | 실제 프로세스(io): 자손이 `trap '' TERM` 뒤 `sleep 30`, 그 pid 출력, 제한 300ms | 자손 생존 false(`alive`) — SIGTERM이면 살아남는다 |
| K5 | 정상 종료 뒤 타이머 해제 | 가짜 타이머: `close 0`을 제한 전에 내고 시계를 제한 너머로 | `killTreeImpl` 0회 |
| K6 | 정상 종료 뒤 리스너 해제 | `AbortController` 신호 · `close 0` 뒤 `abort()` | `killTreeImpl` 0회 |
| K1·K2 | win32 `taskkill` 인자·창 없음 | `node:child_process` 대체 · `killProcessTree({pid:4321,…}, 'win32')` | `spawn('taskkill', ['/pid','4321','/T','/F'], {windowsHide:true,…})` |
| K3 | `taskkill` 실행 실패 → 셸 종료 / 성공 → 셸 미호출 | 돌려준 프로세스에 `error` 발생 · 발생 없음 | `child.kill` 1회 · 0회 |
| K8 | pid 없음 → `child.kill()` | `pid: undefined` | `child.kill` 1회 (기존 좌표가 있으면 인용) |
| K7 | 셸은 창 없이 | 가짜 spawn이 옵션을 기록 · `linux`·`win32` | 둘 다 `windowsHide: true` |

- 표 29행이 EP-10~13 자리 41개(19 · 5 · 9 · 8)를 전부 덮는다(자리 → 행 대응은 self-review). 분기가 둘 이상인 행(T4 · Q1 · V4·V5 · K3 · 모달 문구 4 · 메뉴 문구 3 · `:98` · `:46`)은 분기마다 입력을 나란히 적었다.
- 테스트 소스는 `app/AGENTS.md` 풀 규칙을 따른다: `node:child_process`를 대체하는 파일과 실제 프로세스 파일은 io 풀 신호를 갖는다 — 기존 unit 파일(`shell-runner.test.ts`)에 섞지 말고 따로 둔다.

### 선언 경계

- EP-13: `setsid`·새 세션으로 프로세스 그룹을 벗어난 자손은 끝내지 않는다 — 실행은 제한 시간에 끝난다(verify r2 A5, 401ms). Windows 실제 `taskkill` 효과는 Windows CI 프로세스 테스트가 시간만 본다(`shell-runner.process.test.ts:41` `if (!isWin)`) — 인자·폴백만 EP-13이 잠근다.
- EP-10·12: 칩·메뉴의 모양·초점·글자는 AC27·31 실기다. 컴포저 메뉴(`ModelMenu`·`EffortMenu`·`ModeMenu`) 내부의 선택지 계산은 VP-19와 컴포저 테스트 몫이다.

### r3 작업 목록 (구현자)

| # | 할 일 | 계약 |
|---|---|---|
| E4 | EP-10 19자리 입력 — 모달(fake DOM, 슬롯 stub)·`ExecutionSettingsPicker`(fake DOM, `useAgents` fixture)·`SchedulesPage`(칩 mock이 `onChange` 캡처) | AC36 |
| E5 | EP-11 5자리 입력 | AC37 |
| E6 | EP-12 9자리 입력 | AC38 |
| E7 | EP-13 K1~K8 — 실제 프로세스(K4) · 가짜 타이머(K5·K6) · `node:child_process` 대체(K1~K3) · 옵션 기록(K7) | AC39 |

- verify r2 고장 이력의 `못 잡음` 중 채택분(M3·M4·M5·M8·T1~T4·Q2~Q5·M10·M11·M7·N6·O6·S1·S2·S4·S6·S8·S9)을 원문 변이로 다시 심어 red를 보인다. S1은 `:74`·`:138` 둘 다에 심는다.
- gate: V1 §19와 같다. 마지막 gate는 파일 필터 없는 vitest를 Node ABI에서(io 풀 포함).
- AC 분모 35 → 39(사람 실기 4 그대로).

### ΔV5 self-review

- ACTIVE ↔ AC: D-003·D-012·D-013↔AC36 · D-003↔AC37 · D-013↔AC38 · D-004·D-007↔AC39. 충돌 0. AC36 F5 관측("shell이면 실행 설정 없음")은 D-007과 같은 방향.
- 자리 검색 재실행(이 턴): EP-10 22줄 = 19 + 제외 3 · EP-11 5 = 5 · EP-12 4+5 = 9 · EP-13 9 = 8 + 제외 1. 각 목록과 차집합 ∅.
- verify r2 못 잡음 → 자리 대응: M3→F3 · M4→F4 · M5→F5 · M8→F6 · T1~T4→T1·T2·T3·T4 · Q2~Q5→Q2·Q3·Q4·Q5 · M10→V2 · M11→V4 · M7→`:175` · N6→`:116` · O6→`:46` · S1→K2·K7 · S2→K4 · S4→K1 · S6→K3 · S8→K6 · S9→K5. 빠진 채택 행 0.
- 경계 E7 ④는 verify r2 A5 실측, Windows 효과 경계는 `shell-runner.process.test.ts:41`로 측정.

---

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: Part I 전체, T1~T7, §9 조립(`createScheduledTasks`).
- 이견 / 현실성 문제: plan 내부 불일치 3건을 구현 중 찾아 설계 커밋(V1 정정 1)으로 먼저 고쳤다 — §3 갱신 메모.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

자리 검색은 §10 명령을 이번 턴 마지막 트리에서 다시 돌렸다. 좌표 경로는 `app/src/` 기준.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07 | EP-1 실행 설정 운반 | ①폼 ②직렬화 ③runner ④릴레이 ⑤전송 (5) | 5/5 | `rg "execution\b\|action_json\|actionJson"` → `scheduleForm.ts:122` · `scheduled-task-queries.ts:66·170·188` · `runner.ts:159` · `useScheduledPromptRelay.ts:35` · `chatStore.ts:1622-1628`. ① `scheduleForm.test.ts` ② `scheduled-task-queries.test.ts:'작업을 저장한 그대로 돌려준다'` ③ `runner.test.ts` ④ `useScheduledPromptRelay.test.ts` ⑤ `chatStore.detached.test.ts:'작업의 설정 그대로 새 대화를 전송하고…'` | 6필드+`projectId`+`text`. 구별 값 `work`·`low`·`plan`/`bypass`·`claude:team`. 관측: 각 자리의 출력 객체 `toEqual` | — |
| VP-16 | EP-2 트리거 검증·변환 | ①zod ②`service.sync` ③폼 (3) | 3/3 | `rg "triggerToCron\|isValidTrigger\|TriggerSpecSchema"` → `protocol.ts:461·472` · `service.ts:129` · `scheduleForm.ts:113`. ① `shared/scheduled-tasks.test.ts` · `handlers/scheduled-tasks.test.ts:'무효 페이로드를 거부한다: 요일 없는 사용자 지정'` ② `scheduled-tasks.lifecycle.test.ts:'편집으로 트리거를 바꾸면…'` ③ `scheduleForm.test.ts` | trigger 4형태. 관측: cron 문자열·`nextRunAt`·zod 결과 | — |
| VP-06 | EP-3 저장 ↔ 타이머 | ①start ②create ③update ④setEnabled ⑤delete (5) | 5/5 | `rg "this\.(sync\|stop)\(" service.ts` → 52·60·96·127·143(60은 `dispose`, 127은 `sync` 안의 교체 정지). 전부 `scheduled-tasks.lifecycle.test.ts`(실제 croner 발화 수) | 작업 id·enabled·trigger. 관측: 가짜 시계 진행 뒤 실행 명령 목록·`nextRunAt`·타이머 수 | — |
| VP-13 | EP-4 겹침 금지 | ①schedule→skipped ②manual→거부 (2) | 2/2 | `rg "\.fire\(" main` → `service.ts:103·130`. `runner.test.ts:'실행 중 예약 발화는 건너뜀 이력만…'`·`'실행 중 수동 실행은 거부만…'` | origin. 관측: `runShell` 호출 수·이력 행·방송 수 | — |
| VP-13 | EP-5 running 종결 | 10자리 | 10/10 | `rg "finishRun\(\|failRunningRuns\("` → `runner.ts:94·95·107·120`, 전부 `runner.ts:167` 하나로 모임. ①②③④⑤⑨⑩⑧ `runner.test.ts` · ⑥⑦ `prompt-relay.test.ts` · ⑧ 부팅 경로는 `lifecycle:'재시작하면 남은 실행 중 이력을…'` | status·error·sessionId·exitCode. 관측: 이력 행 | — |
| VP-12 | EP-6 shell 4항 | 1자리 4항 | 4/4항 | `rg "spawn" infra/shell` → `shell-runner.ts:97`. `infra/shell/shell-runner.test.ts` 8케이스 · 상한 전달은 `runner.test.ts:'프로젝트 폴더에서 명령을 실행하고…'` | 파일·인자(win32/linux)·cwd·제한 시간·출력 상한. 관측: 주입 spawn 인자·kill 수·출력 길이 | 실제 `powershell.exe`는 AC23 |
| VP-08 | EP-7 변경 방송 | 7자리 | 7/7 | `rg "onChanged\(\)"` → `service.ts:99·145` · `runner.ts:82·92·172`. `lifecycle:'작업이 바뀔 때마다 변경을 알린다'`(4) · `runner.test.ts`(시작·종결·skipped) | 관측: `onChanged` 호출 수 | electron 방송은 선언 경계 3 |
| AC24 | EP-8 옛 구성 0 | 8식 | 8/8 | 8식 전부 0줄(①은 정정된 술어 `orca:schedule\|window\.orca`). 양성 짝: `cron.test.ts` · `lifecycle`(조립) · `chatStore.detached.test.ts` · `executionSettings.test.ts` | 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음. EP-3 검색 출력 5줄 중 2줄(60·127)은 목록의 자리가 아니라 그 자리들이 쓰는 내부 호출이다 — 차집합 0.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(첫 라운드).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `renderer/src/app/navItems.test.ts:'예약됨 메뉴는 프로젝트 다음에…'` · `schedulesScreen.render.test.ts` | not selected |
| VP-02 | REQUIRED | SELF_PASS | `scheduleTaskModal.render.test.ts` · `scheduleForm.test.ts` | not selected |
| VP-03 | REQUIRED | SELF_PASS | `main/app/scheduled-tasks.lifecycle.test.ts` · `handlers/scheduled-tasks.test.ts` · `features/schedules/lib/taskActions.test.ts` | not selected |
| VP-04 | REQUIRED | SELF_PASS | VP-07·12·13·14 좌표 + `runHistory.render.test.ts` · `schedulesStore.test.ts` | not selected |
| VP-05 | REQUIRED | SELF_BLOCKED | `gate:check-doc-inventory --check` 통과 · `shared/ipc-documentation.test.ts` green | AC23 사람 실기 대기 |
| VP-06 | REQUIRED | SELF_PASS | `main/app/scheduled-tasks.lifecycle.test.ts`(10) | required — S20·S21 red |
| VP-07 | REQUIRED | SELF_PASS | `useScheduledPromptRelay.test.ts` · `prompt-relay.test.ts` | required — S01·02·05·06·08·09·12·13 red |
| VP-08 | REQUIRED | SELF_PASS | `main/app/handlers/scheduled-tasks.test.ts`(16) | not selected |
| VP-09 | REQUIRED | SELF_PASS | lifecycle + `bootstrap.opencode-warmup.test.ts:'restores scheduled tasks once the DB is open…'` | not selected — S69~S72 red |
| VP-10 | REQUIRED | SELF_PASS | `main/infra/db/scheduled-task-queries.test.ts`(10, Node ABI에서 실행) | not selected |
| VP-11 | REQUIRED | SELF_PASS | `pages/SchedulesPage.render.test.ts` | not selected |
| VP-12 | REQUIRED | SELF_PASS | `main/infra/shell/shell-runner.test.ts` | not selected |
| VP-13 | REQUIRED | SELF_PASS | `main/features/scheduled-tasks/runner.test.ts`(19) | not selected |
| VP-14 | REQUIRED | SELF_PASS | `features/chat/store/chatStore.detached.test.ts`(8) | not selected |
| VP-15 | REQUIRED | SELF_PASS | `features/schedules/lib/scheduleForm.test.ts` | not selected |
| VP-16 | REQUIRED | SELF_PASS | `shared/scheduled-tasks.test.ts` | not selected |
| VP-17 | REQUIRED | SELF_PASS | `main/features/scheduler/scheduler.test.ts:'registers a cron schedule and exposes nextRun'` | not selected — S68 red |
| VP-18 | REQUIRED | SELF_PASS | `main/infra/cron.test.ts`(4) | not selected |
| VP-19 | REQUIRED | SELF_PASS | `features/chat/lib/executionSettings.test.ts`(9) | not selected |
| VP-20 | REGRESSION | SELF_PASS | `features/chat/store/chatStore.test.ts`(68케이스 스위트 — S59에서 15건, S60에서 9건 red) | required — S59·S60 red |

## [구현자 기입] 이번 라운드 수정의 잠금

하네스 `mutate.py`로 한 번에 하나씩 심고 되돌렸다(`# 원복 확인: 모든 파일 원문 그대로`).

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| S01·S02 폼 · S05·S06 runner · S08·S09 릴레이 · S12·S13 전송 — `permissionMode`→기본값 / `providerKey`→다른 값·맞바꿈 | VP-07 선택 증거(자리 ①③④⑤) | 최초 | 1~4건씩 | 잠김 |
| S20 `start` 복원 루프 제거 · S21 `enabled` 조건 뒤집기 | VP-06 선택 증거 | 최초 | 2 · 6건 | 잠김 |
| S59·S60 `newChatGate`의 `dispatch` 뒤집기(두 분기) | VP-20 선택 증거 | 최초 | 15 · 9건 | 잠김 |
| S69 `service.start()` 제거 · S70 `dispose` 제거 · S71 핸들러 등록 제거 · S72 `dispose`↔`stopAll` 순서 맞바꿈 | 배선 oracle 민감도(이번 턴 신규) | 최초 | 각 1건 | 잠김 |
| S03·S04·S07·S10·S11·S14~S16 | sweep — EP-1 자리(직렬화·text·projectId·effort·agentKind) | 최초 | 1~3건씩 | 잠김 |
| S17~S19 | sweep — EP-2 3자리 | 최초 | 6 · 4 · 1건 | 잠김 |
| S22~S27 | sweep — EP-3(create·update·setEnabled·delete·교체 정지·dispose) | 최초 | 1~5건씩 | 잠김 |
| S28·S29 | sweep — EP-4 2분기 | 최초 | 2 · 3건 | 잠김 |
| S30·S32~S39·S41~S43 | sweep — EP-5 자리와 `execute` 분기 | 최초 | 1~2건씩 | 잠김 |
| S40 종결 가드의 `runId` 비교 제거 | sweep — 규칙 칸 분기(diff 자리) | 최초 | **처음 green** → 테스트 추가 뒤 1건 | 잠김(`runner.test.ts:'중단된 실행의 늦은 결과가…'`) |
| S44~S53 | sweep — EP-6 4항 + runner의 상한·cwd·명령 전달 | 최초 | 1~7건씩 | 잠김 |
| S54·S55·S57·S58 | sweep — EP-7 | 최초 | 1~3건씩 | 잠김 |
| S56 skipped 기록의 방송 제거 | sweep — EP-7 자리 | 최초 | **처음 green** → 단언 추가 뒤 1건 | 잠김 |
| S61~S64 분리 시작(`activeKey` 변경·대기 조건·승격 id·소실 reject) | sweep — VP-14 path edge | 최초 | 1~4건씩 | 잠김 |
| S65 결말 뒤 구독 해제 제거 | sweep — VP-14 path edge | 최초 | **처음 green** → 테스트 교체 뒤 1건 | 잠김 |
| S66~S68 `startCron` stop·nextRun · `Scheduler` cron 분기 | sweep — VP-17·18 | 최초 | 1~7건씩 | 잠김 |
| S73 핸들러 update→create 호출 대체 | sweep — VP-08 path edge | 최초 | **처음 green** → 테스트 추가 뒤 1건 | 잠김(`'수정은 새 작업을 만들지 않는다…'`) |
| S74~S76 핸들러 인자 | sweep — VP-08 | 최초 | 1~2건씩 | 잠김 |
| S77·S78 nav 아이콘·활성 판정 | sweep — VP-01 | 최초 | **처음 green**(테스트 케이스를 옮기지 않았다) → 케이스 추가 뒤 각 1건 | 잠김 |
| S79~S94 store 재조회 · picker 규칙 4 · 삭제 확인 · 보고 `runId` · 보존 수 · 종결 가드(SQL) · `lastRun` 출력 · 프로젝트 규칙 · origin · 조립 배선 2 · 보고 변환 · 페이지 cwd | sweep — 나머지 path edge | 최초 | 1~4건씩 | 잠김 |
| (S31) `ok` 판정의 `result.error == null` 항 제거 | sweep | 최초 | green | 동치 — 띄우지 못한 프로세스는 `exitCode: null`이라 앞 항이 거른다(`shell-runner.ts`의 `done(null, …)` 두 자리). 중복 항을 코드에서 지웠다 |

- **분모 검산**: `선택 증거 12(VP-06 2 · VP-07 8 · VP-20 2) · 인용 변이 0 · 새 oracle 4(S69~S72) · sweep 77 = 표 행 93`, 전부 red. S31은 코드에서 항을 지워 변이 대상이 사라졌다.
- **덮개 회귀**: 해당 없음(첫 라운드).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음 — 사유 코드 9종 전부 `runErrorKey` → `schedules.history.errors.*`(`runHistory.render.test.ts:'사유 코드 전부에 문구가 있다'`). 옛 `schedules.actionFailed` 키는 소비자가 없어 옮기지 않았다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | `send`의 게이트 판정만 `newChatGate`로 뺐다. `shouldDispatch`는 같은 스코프에서 채워진다 | `chatStore.test.ts` 68케이스 green |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 전부 표에 있다(옛 구현이 빠뜨린 2행은 이번 plan §5에 들어가 있다) | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 토글·삭제·지금 실행 실패는 오류 토스트, 저장 실패는 모달 안 문구. **지금 실행이 `started:false`로 돌아오면 표시가 없다** — 메뉴 항목이 `running`이면 비활성이라 창이 좁다 | ⚠️ 보고만 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 이력 조회는 stale 플래그로 버린다. 목록 `refresh`는 순서 보장이 없어 연속 push에서 한 박자 낡은 목록이 잠깐 보일 수 있다(다음 push가 고친다) | ⚠️ 보고만 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `bootstrap.opencode-warmup.test.ts`가 빈 DB 객체로 실제 `start()`를 지나 9건 red | ✅ 선조치: 조립·핸들러 모듈을 대체하고 그 자리에 배선 순서 케이스를 더했다 | 전체 vitest에서 발견 |
| 2 | 테스트 예산 가드가 `shell-runner.test.ts`의 제한 시간 값을 잡았다 | ✅ 선조치: 가짜 시계 아래 계약값이라 `SEMANTIC_DELAYS`에 등록 | `check-test-budgets.mjs` |
| 3 | 분리 시작한 draft가 승격 전까지 사이드바 draft 행에 보일 수 있다 | ⚠️ 보고만 | `useDraftSessionRows` — AC23 실기에서 확인 |
| 4 | 릴레이 훅은 `AppLayout`에 있어 게이트·부팅 중 발화는 2분 뒤 `report_timeout` | ⚠️ 보고만 | 선언 경계 4 |
| 5 | `ExecutionSettingsPicker`의 화면 자체(`select` 4개)는 자동 테스트가 없다 — 규칙만 `executionSettings.test.ts`가 본다 | ⚠️ 남긴 곳 | AC23 실기 |

### 설계 대비 명시적 차이

- `ScheduledTaskService`가 `runner.reconcileStaleRuns()`를 `start()` 안에서 부른다(plan §13의 순서 그대로, 호출 위치만 service). 조립 함수가 따로 부르지 않게 했다.
- 삭제 확인을 `SchedulesView`에서 `lib/taskActions.ts`로 뺐다(순수 함수 좌표를 얻기 위해 — plan 정정 1의 ②).
- `runner.ts`의 `ok` 판정에서 중복 항 하나를 지웠다(S31).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 캐시·TTL 없음 | — |
| 공유 | `startCron`을 `Scheduler`와 예약 작업이 함께 쓴다. 타이머 객체는 호출마다 따로라 서로 멈출 수 없다 | `cron.test.ts:'멈춘 뒤에는 발화하지 않고…'` · `scheduler.test.ts` 13케이스 green |
| 재진입 | `sync`는 먼저 옛 타이머를 멈춘다 — 같은 작업에 두 번 불려도 타이머는 하나 | S26 red(`lifecycle:'편집으로 트리거를 바꾸면 새 시각에만 발화한다'`) |
| 다른 무효화 축 | 분리 시작의 대기는 스토어 구독이라, draft 엔트리가 다른 경로로 지워지면 `start_failed`로 끝난다 | `chatStore.detached.test.ts:'세션 id 없이 대화가 지워지면 실패한다'` |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 수정 31 · 신규 21항목(`git status --short`). 신규: slice `features/scheduled-tasks/{limits,runner,service,prompt-relay,index}` · `app/scheduled-tasks.ts` · `handlers/scheduled-tasks.ts` · `infra/shell` · `infra/db/{scheduled-task-queries,migrations/0035}` · `shared/scheduled-tasks.ts` · renderer `features/schedules/**`·`pages/SchedulesPage`·릴레이 훅·`ExecutionSettingsPicker`·`lib/executionSettings` + 테스트. 삭제: 옛 `ports.ts`·`registry.ts`(+test)·`0034_scheduled_tasks.sql`·`docs/handoff/0287-scheduled-tasks/` |
| 실행 명령 | 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음, Node ABI) · `node --test scripts/*.test.mjs` |
| **관측한 게이트 산출** | 전체 vitest 966파일 중 964 pass · 2 skip · 실패 0 / 9,170케이스 중 9,167 pass · 1 expected fail · 2 skip(Node ABI — DB 스위트 포함) · lint `0 errors, 2 warnings`(둘 다 손대지 않은 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · typecheck 3구성 error 0 · migrations `append-only ok` · doc-inventory `generated doc ok … links ok` · product-naming `OK` · test-budgets `all budget sites scaled` · `node --test` 868 중 863 pass · 5 fail |
| 기준선 분리 | `node --test` 5건은 `ERR_UNKNOWN_FILE_EXTENSION ".ts"`(`vitest.config.ts`·`temp-repo.testfixture.ts`를 node가 직접 import — 이 PC의 Node `v22.15.1`). 세 파일 모두 손대지 않았고, 내 `scripts/` 변경을 stash한 트리에서도 같은 5건이 난다(그때는 등록 누락 1건이 더해져 6건) |
| **추가·수정 테스트의 subtree 규칙** | 테스트 소스 22파일. 시간 예산 위반 0(`check-test-budgets` 통과, 의미 값 1건 등록) · 풀 분류 위반 0(전체 실행에서 `[test-pools]` 0줄) · 호스트 격리: 홈·env를 읽는 테스트 없음 |
| V-pair 자기확인 | `SELF_PASS 19 / SELF_BLOCKED 1`(VP-05 — AC23 실기) |
| 강제 지점 전수 | 36/36 자리(EP-1 5 · EP-2 3 · EP-3 5 · EP-4 2 · EP-5 10 · EP-6 4항 · EP-7 7) + EP-8 8식 0줄 |
| **AC 자기보고**(`Criteria-Met`) | 24/25 — ✅ AC1~AC22·AC24·AC25(좌표는 위 표). ⚠️ AC23(사람 실기) |
| **합계 검산** | `✅ 24 · ⚠️ 1 · ❌ 0 = 총 25` |
| 블로커 / 역질문 | 없음. 결정권자 확인 대상: 놓친 문제 #3·#4 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(첫 라운드).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: plan §11은 `navItems.test.ts` 케이스를 "신규"로 적었으나 구현자가 nav 항목만 옮기고 케이스를 빠뜨렸다 — sweep(S77·S78)이 잡았다.
- 반복해서 부딪히는 환경 한계: Git Bash에서 `python3`가 Store 스텁이라 `python`을 써야 한다 · `mutate.py`는 Windows에서 `PYTHONUTF8=1` 없이 oracle 출력 디코딩(cp949)으로 죽는다 · heredoc 안 작은따옴표가 깨져 스크립트를 파일로 써서 실행했다.
- 현재 라운드·impl 턴: `r1`

---

## [구현자 기입] 설계 리뷰 (r1.2)

- 동의 / 그대로 진행: §20 ΔV1 전체.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.2)

ΔV1의 pair(VP-21·22)는 §10 자리가 0이다(운반 값 없음 — 배치·표현). REGRESSION VP-02의 EP-1 ①(`scheduleForm.validateForm`)은 이번 diff가 닿지 않았다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-21·22 | AC26 배치 | 0 | 해당 없음 | `scheduleTaskModal.render.test.ts` `ScheduleTaskForm — 배치` 3케이스 | 운반 항 없음 | AC27 시각 품질 |
| VP-02 | EP-1 ① | 1 | 1/1(유지) | `scheduleForm.test.ts`(r1과 같은 좌표, 파일 무변경) · 슬롯 운반은 `scheduleTaskModal.render.test.ts:'프롬프트일 때만 실행 설정 입력이 보이고 저장된 값을 받는다'` | `permissionMode: 'plan'`·`modelFamily` → 슬롯 마커 속성 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(verify 0회).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-21 | REQUIRED | SELF_BLOCKED | `features/schedules/components/scheduleTaskModal.render.test.ts` `ScheduleTaskForm — 배치`(3) | AC27 사람 실기 대기 |
| VP-22 | REQUIRED | SELF_PASS | 같은 좌표 | not selected |
| VP-02 | REGRESSION | SELF_PASS | 같은 파일 기존 7케이스 · `scheduleForm.test.ts` | not selected |
| 그 밖의 V1 pair | — | r1 상태 유지 | r1 표의 좌표 — 이번 diff가 닿은 파일은 `ScheduleTaskModal`·`TriggerFields`·`ExecutionSettingsPicker`·`Modal`·i18n뿐 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| D01 제목 입력의 `aria-label` 제거 | sweep — AC26 ① | 최초 | 1건 | 잠김 |
| D02 안내 문구 두 종류 맞바꿈 | sweep — AC26 ②(형제 슬롯) | 최초 | 1건 | 잠김 |
| D03 요일 묶음의 `role="group"` 제거 | sweep — AC26 요일 묶음 | 최초 | 1건 | 잠김 |
| D04 실행 설정 슬롯 렌더 제거 | sweep — AC26 ② · VP-02 | 최초 | 2건 | 잠김 |
| D05 프로젝트 칩의 접근성 이름을 제목으로 바꿈 | sweep — AC26 ② | 최초 | 1건 | 잠김 |

- **분모 검산**: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 5 = 표 행 5`.
- **덮개 회귀**: r1 sweep 중 이번 diff가 닿은 파일의 행은 없다(r1 spec은 이 세 화면 파일을 변이 대상으로 삼지 않았다). 그 화면의 r1 좌표 7케이스는 그대로 green.

## [구현자 기입] Product/UX 파생 검토 (r1.2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음 — `projectHint`·`shellProjectHint`는 칩 줄 아래 안내로 쓰인다(D02). `effortDefault`는 라벨이 사라져 `노력: 기본값`으로 바꿨다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 변화 없음. shell 폴더 사유는 안내 줄 자리에 `role="alert"`로 대신 뜬다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

- 쌓인 라벨을 없앴으므로 칩의 뜻은 선택된 값과 `title` 툴팁·`aria-label`로만 전달된다. 권한 칩(`기본`·`계획` 등)이 라벨 없이 읽히는지는 AC27에서 본다.
- 모달 헤더 제목(`새 작업`/`작업 편집`)이 화면에서 사라졌다 — 생성과 편집은 확인 버튼 문구(`만들기`/`저장`)로만 구별된다. 참조 디자인과 같은 구성이다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 칩 배경을 반투명 토큰으로 두면 네이티브 `select` 펼침 목록이 dark 테마에서 바탕과 섞일 수 있다 | ✅ 선조치: 단색 토큰(`bg-fill-contained-hover`)을 썼다 | 실제 창 확인은 AC27 |
| 2 | 작업 트리에 `app/package.json`·`package-lock.json`의 `better-sqlite3` 버전 변경이 있다 — 이번 세션이 만든 것이 아니다 | ⚠️ 보고만 — 커밋에 넣지 않았다 | `git diff app/package.json` |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것: 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 · 공유 · 재진입 · 다른 무효화 축 | 해당 없음 — 차이 없음 | — |

## [구현자 기입] 구현 보고 (r1.2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `shared/ui/Modal.tsx`(클래스 3) · `features/schedules/components/{ScheduleTaskModal,TriggerFields}.tsx` · `features/chat/components/ExecutionSettingsPicker.tsx` · i18n ko/en · 테스트 1 · 문서 2(`design-components.md`·`design-system.md`) |
| 실행 명령 | 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음) |
| **관측한 게이트 산출** | 전체 vitest 966파일 중 920 pass · 44 fail · 2 skip(Electron ABI에서 실행). 실패 44파일은 전부 io 풀의 main 스위트이고 서명은 `The module … was compiled against a different Node.js version`(48회)과 그 뒤따름이다 — 이번 diff 파일(renderer·문서)과 교집합 0, 같은 트리의 r1 최종 실행(Node ABI)은 실패 0이었다. renderer 스위트 실패 0 · lint `0 errors, 2 warnings`(r1과 같은 기존 2건) · typecheck error 0 · 가드 4종 통과 |
| **추가·수정 테스트의 subtree 규칙** | 테스트 1파일(`scheduleTaskModal.render.test.ts`) — 시간 값·프로세스·SQLite 없음, 위반 0 |
| V-pair 자기확인 | ΔV1: `SELF_PASS 2 / SELF_BLOCKED 1`(VP-21 — AC27 실기) |
| 강제 지점 전수 | ΔV1 0자리 · VP-02 1/1 유지 |
| **AC 자기보고**(`Criteria-Met`) | 25/27 — r1의 ✅24에 AC26 ✅(배치 3케이스 + 기존 7케이스 green). ⚠️ AC23·AC27(사람 실기) |
| **합계 검산** | `✅ 25 · ⚠️ 2 · ❌ 0 = 총 27` — ΔV1이 AC 2건을 더해 분모가 25 → 27로 바뀌었다 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(사용자 요구 변경 턴).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 해당 없음.
- 반복해서 부딪히는 환경 한계: heredoc 안 작은따옴표가 든 스크립트가 셸에서 깨진다(r1과 같음).
- 현재 라운드·impl 턴: `r1.2`(사용자 요구 변경 — review 턴 수에 세지 않는다).

---

## [구현자 기입] 설계 리뷰 (r1.3)

- 동의 / 그대로 진행: §21 ΔV2 전체.
- 이견 / 현실성 문제: 없음. 프로젝트 슬롯을 추가하며 schedules의 슬롯 prop을 `renderExecutionPicker` 하나에서 `pickers: { project, execution }` 하나로 묶었다(View·Screen·Modal·Form 전달 경로 그대로).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.3)

ΔV2 pair(VP-23·24)는 §10 자리가 0이다. REGRESSION VP-25·VP-19의 좌표는 그대로 green이다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-23 | AC28~30 | 0 | 해당 없음 | `executionSettingsPicker.render.test.ts`(3) · `projectPickerChip.test.ts`(4) · `schedulesScreen.render.test.ts:'shell 작업 행은 nav 세션과 같은 코드 아이콘이다'` · `scheduleTaskModal.render.test.ts`(프로젝트 슬롯이 `projectId`를 받음) · `SchedulesPage.render.test.ts`(프로젝트 목록·폴더 유무 전달) | 운반 항: 프로젝트 id(`p-beta`·`p-new`) → `onChange` | AC31 시각 |
| VP-25 | 컴포저 프로젝트 선택 | 0 | 해당 없음 | `pages/{NewChatLandingPage,ProjectLandingPage}.project-picker.test.ts` 21케이스 green(추출 전후 같음) | — | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(verify 0회).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-23 | REQUIRED | SELF_BLOCKED | 위 표 좌표 | AC31 사람 실기 대기 |
| VP-24 | REQUIRED | SELF_PASS | `features/chat/components/projectPickerChip.test.ts`(패널을 실제로 펼쳐 검색·선택·추가) | not selected |
| VP-25 | REGRESSION | SELF_PASS | `pages/NewChatLandingPage.project-picker.test.ts` · `pages/ProjectLandingPage.project-picker.test.ts` | not selected |
| VP-19 | REGRESSION | SELF_PASS | `features/chat/lib/executionSettings.test.ts` | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.3)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| E01 코드 아이콘을 `icon`으로 되돌림 · E05 행 아이콘 `terminal` | sweep — AC30 두 자리 | 최초 | 1 · 1건 | 잠김 |
| E02 노력 칩을 하네스 무관하게 · E03 권한 칩을 하네스 무관하게 · E04 종류 칩을 종류 1개여도 | sweep — AC28 규칙 칸 3분기 | 최초 | 각 1건 | 잠김 |
| P01 선택이 `onChange`를 안 부름 · P02 취소된 추가도 닫음 · P03 검색 무시 · P04 체크 표시 없음 · P05 폴더 없음 태그 없음 · P06 고른 이름 대신 자리표시 | sweep — AC29 `ProjectPickerChip` 자리 | 최초 | 각 1건 | 잠김 |
| P07 경로 검색 제거 · P08 추가 클릭 무시 · P09 Esc가 닫지 않음 | sweep — `ProjectMenuPanel` 자리(두 소비처) | 최초 | 1 · 7 · 1건 | 잠김 |
| L01 컴포저 선택 뒤 닫지 않음 · L02 로딩 상태 전달 제거 | sweep — 컴포저 배선(VP-25) | 최초 | 4 · 2건 | 잠김 |
| S01 모달이 프로젝트 슬롯에 고른 값을 안 넘김 · S02 페이지가 프로젝트 목록을 안 넘김 | sweep — 슬롯 운반 | 최초 | 각 1건 | 잠김 |

- **분모 검산**: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 18 = 표 행 18`, 전부 red.
- **덮개 회귀**: ΔV1 변이 D01·D03은 이번 diff가 닿은 파일이라 다시 돌렸다(D05의 프로젝트 `select`는 슬롯으로 옮겨져 재앵커 = S01). D01·D02·D03을 다시 돌려 셋 다 red(각 1건).

## [구현자 기입] Product/UX 파생 검토 (r1.3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | `noFolderTag`는 프로젝트 메뉴 행 태그로 쓰인다(P05). 소비자가 사라진 `effortDefault`·`projectNoFolder`·`MODAL_SELECT`는 지웠다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 컴포저 프로젝트 메뉴 본문을 `ProjectMenuPanel`로 옮겼다. 검색 초점은 패널이 열릴 때(마운트) 잡고, 닫을 때 검색어 초기화·초점 복귀는 여전히 `LandingProjectPicker.close`가 한다 | 컴포저 테스트 21케이스 green |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | `프로젝트 추가` 실패(폴더 대화상자·생성 실패) — 오류 토스트(`actionFailed`). 표의 "저장 실패" 행과 같은 처리 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 추가를 취소하면 메뉴가 그대로 열려 있다(P02) | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 추가 중에는 행·추가가 비활성이다 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `MenuChip`이 렌더 중 ref를 넘긴다는 lint error(`react-hooks/refs`) | ✅ 선조치: 초점 복귀를 effect로 옮겼다 | `npm run lint` |
| 2 | 모달 안의 Popover는 Esc에 모달까지 닫힐 수 있다 | ✅ 선조치: `MenuChip`은 캡처 단계에서 Esc를 받아 메뉴만 닫는다. 프로젝트 메뉴는 패널의 기존 Esc 처리(`stopPropagation`)를 쓴다 | 실기 AC31 |
| 3 | 작업 트리의 `app/package.json`·`package-lock.json` `better-sqlite3` 버전 변경은 이번 세션이 만들지 않았다 | ⚠️ 보고만 — 커밋하지 않았다 | `git diff app/package.json` |

### 설계 대비 명시적 차이

- 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 · 공유 · 재진입 · 다른 무효화 축 | 공유: `ProjectMenuPanel`을 컴포저와 예약 모달이 함께 쓴다 — 패널은 상태를 갖지 않아 서로 영향이 없다 | VP-25 21케이스 · `projectPickerChip.test.ts` 4케이스 |

## [구현자 기입] 구현 보고 (r1.3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규: `shared/ui/MenuChip.tsx` · `features/chat/components/{ProjectMenuPanel,ProjectPickerChip}.tsx` · `features/chat/lib/projectMenuItems.ts` + 테스트 2. 수정: `ExecutionSettingsPicker` · `LandingProjectPicker` · chat 배럴 · `projectsStore`(`addFromDirectory`) · schedules `ScheduleTaskModal`·`TriggerFields`·`ScheduleRow`·`SchedulesScreen`·`SchedulesView`·배럴 · `pages/SchedulesPage` · `shared/ui/Modal` · i18n · 테스트 3 · 문서 2 |
| 실행 명령 | 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음, Node ABI) |
| **관측한 게이트 산출** | 전체 vitest 968파일 중 922 pass · 44 fail · 2 skip. 실패 44파일은 전부 io 풀(SQLite·실제 프로세스)이고 unit 풀 실패는 0이다. Node ABI 재빌드가 `EBUSY/EPERM … better_sqlite3.node`(실행 중인 앱이 바이너리를 잡고 있음)로 막혀 Electron ABI 그대로 돌았다 — r1 최종 실행(Node ABI, 같은 DB 스위트)은 실패 0이었고 이번 diff는 renderer·문서뿐이다 · lint `0 errors, 2 warnings`(기존 2건) · typecheck error 0 · 가드 4종 통과 |
| **추가·수정 테스트의 subtree 규칙** | 테스트 5파일 — `projectPickerChip.test.ts`는 가짜 타이머만 쓰고 시간 값 없음 · 프로세스·SQLite 없음. 위반 0(`check-test-budgets` 통과) |
| V-pair 자기확인 | ΔV2: `SELF_PASS 3 / SELF_BLOCKED 1`(VP-23 — AC31 실기) |
| 강제 지점 전수 | ΔV2 0자리 |
| **AC 자기보고**(`Criteria-Met`) | 28/31 — r1.2의 ✅25에 AC28·29·30 ✅. ⚠️ AC23·AC27·AC31(사람 실기) |
| **합계 검산** | `✅ 28 · ⚠️ 3 · ❌ 0 = 총 31` — ΔV2가 AC 4건을 더해 분모가 27 → 31로 바뀌었다 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1.3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.3)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(사용자 요구 변경 턴).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: ΔV1 AC26은 배치 순서만 잠갔고 "선택 컨트롤이 무엇인가"(네이티브 `select`)는 열거하지 않았다 — 사용자 지적으로 ΔV2가 됐다.
- 반복해서 부딪히는 환경 한계: 작은따옴표가 든 heredoc · Windows의 sqlite ABI 전환(r1과 같음).
- 현재 라운드·impl 턴: `r1.3`(사용자 요구 변경).

---

## [구현자 기입] 설계 리뷰 (r1.4)

- 동의 / 그대로 진행: §22 ΔV3 전체.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.4)

ΔV3 pair(VP-26)는 §10 자리가 0이다. REGRESSION VP-27은 스킬 탭 기존 테스트에 패널 표식 케이스를 더해 닫았다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-26 | AC32 | 0 | 해당 없음 | 신규 `features/schedules/components/schedulesScreen.detail.test.ts`(4 — 실제 클릭으로 열기·바꾸기·닫기·패널 안 토글) | 운반 항: 선택 작업 id(`t2`) → 패널 표식·`loadRuns` 인자·`onSetEnabled` 인자 | Esc 닫기 — 셸이 `ownerDocument.querySelector`를 쓰는데 fake DOM이 지원하지 않는다(AC34 실기) |
| VP-27 | AC33 | 0 | 해당 없음 | `ExtensionsCatalogView.interaction.test.ts:'opens the selected skill in the shared detail side pane with its tab and item markers'` + 기존 11케이스 | 표식 `data-extension-detail-panel="skills"`·`-id` | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(verify 0회).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-26 | REQUIRED | SELF_BLOCKED | 위 표 좌표 | AC34 사람 실기 대기 |
| VP-27 | REGRESSION | SELF_PASS | 위 표 좌표 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.4)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| V01 선택이 상태를 안 바꿈 · V02 닫기가 선택을 안 지움 · V03 같은 행 재클릭이 닫지 않음 · V04 행 선택 강조 없음 · V05 `data-state` 고정 | sweep — AC32 목록 쪽 자리 | 최초 | 4 · 2 · 1 · 1 · 1건 | 잠김 |
| V06 패널 토글 값 뒤집기 · V07 패널 닫기 무시 · V08 명령 본문 제거 · V09 이력 조회 id 비움 | sweep — AC32 패널 쪽 자리 | 최초 | 각 1건 | 잠김 |
| V10 공용 셸이 표식을 버림 | sweep — `DetailSidePane` | 최초 | 2건(두 소비처) | 잠김 |
| V11 스킬 탭이 표식을 안 넘김 | sweep — VP-27 | 최초 | **처음 green** → 케이스 추가 뒤 1건 | 잠김 |

- **분모 검산**: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 11 = 표 행 11`, 전부 red.
- **덮개 회귀**: 해당 없음 — 이번에 지운 행 아래 펼침에는 잠금 테스트가 없었다(`schedulesScreen.render.test.ts`는 정적 렌더라 펼침을 보지 않았다).

## [구현자 기입] Product/UX 파생 검토 (r1.4)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | `schedules.detail.nextRun`은 패널 메타 라벨이다(V08과 같은 화면) | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 스킬 탭의 패널 셸을 `shared/ui/DetailSidePane`으로 옮겼다. 초점·Esc·크기 조절 처리는 그대로 옮겼고 스킬 탭 12케이스 green | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음. 패널이 열린 작업을 삭제하면 목록에서 사라지며 패널도 닫힌다(선택 id가 목록에 없으면 패널을 그리지 않는다) | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | `지금 실행`은 그 작업의 패널을 열어 새 실행 행이 보이게 한다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 이력 조회는 기존 stale 가드를 그대로 쓴다(`RunHistoryPanel`) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.4)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 스킬 탭의 패널 표식(`data-extension-detail-*`)에는 소비자도 테스트도 없었다 | ✅ 선조치: 셸을 옮기며 표식 전달을 잠그는 케이스를 더했다(V11) | `rg data-extension-detail app/src` → 컴포넌트 1곳 |
| 2 | 패널을 연 행으로 초점을 돌릴 때 `HTMLElement` 판정을 쓰지 않는다 — 테스트 환경에 전역이 없다 | ✅ 선조치: 그 시점의 `activeElement`를 그대로 기억한다 | — |

### 설계 대비 명시적 차이

- 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 · 공유 · 재진입 · 다른 무효화 축 | 공유: 셸을 두 카탈로그가 함께 쓴다 — 셸은 상태가 없고(폭·펼침은 호출자가 가짐) 서로 영향이 없다 | V10 red가 두 소비처 모두에서 났다 |

## [구현자 기입] 구현 보고 (r1.4)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규: `shared/ui/DetailSidePane.tsx` · `features/schedules/components/ScheduleDetail.tsx` + 테스트 1. 수정: `ExtensionDetailPane`(셸 사용) · `SchedulesScreen`(선택·패널) · `ScheduleRow`(펼침 제거) · i18n · 스킬 탭 테스트 1 · 문서 1 |
| 실행 명령 | 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음) |
| **관측한 게이트 산출** | 전체 vitest 969파일 중 923 pass · 44 fail · 2 skip — unit 풀 실패 0. io 44파일은 r1.3과 같은 환경 서명(실행 중인 앱이 `better_sqlite3.node`를 잡아 Node ABI 재빌드 불가)이고 이번 diff는 renderer·문서뿐이다 · lint `0 errors, 2 warnings`(기존 2건) · typecheck error 0 · 가드 4종 통과 |
| **추가·수정 테스트의 subtree 규칙** | 테스트 2파일 — 가짜 타이머만, 시간 값·프로세스·SQLite 없음. 위반 0 |
| V-pair 자기확인 | ΔV3: `SELF_PASS 1 / SELF_BLOCKED 1`(VP-26 — AC34 실기) |
| 강제 지점 전수 | ΔV3 0자리 |
| **AC 자기보고**(`Criteria-Met`) | 30/34 — r1.3의 ✅28에 AC32·AC33 ✅. ⚠️ AC23·AC27·AC31·AC34(사람 실기) |
| **합계 검산** | `✅ 30 · ⚠️ 4 · ❌ 0 = 총 34` — ΔV3가 AC 3건을 더해 분모가 31 → 34로 바뀌었다 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1.4 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.4)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(사용자 요구 변경 턴).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 해당 없음.
- 반복해서 부딪히는 환경 한계: fake DOM이 `ownerDocument.querySelector`·`ResizeObserver`·`HTMLElement`를 갖지 않는다.
- 현재 라운드·impl 턴: `r1.4`(사용자 요구 변경).

---

---

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: §23 ΔV4 전체 — E1~E3 채택분과 r2 작업 목록 D1~D5.
- 이견 / 현실성 문제: 없음. D4의 방식은 §23이 구현 재량으로 둔 대로 "프로세스 트리 종료 + 종료 요청 뒤 `exit` 시점 확정"을 골랐다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-26′ | EP-9 행·패널 조작 | 21자리(R1~R6 · P1~P6 · S1~S9) | 21/21 | `rg -n "onRunNow\(\|onEdit\(\|onDelete\(\|onSetEnabled\(\|setEditing\(\|disabled=\{task\.running\}\|on=\{task\.enabled\}\|inert=" --glob '!*.test.ts' features/schedules/components` → 24줄 = 21 + 제외 3(`:97`·`:128`·`:176`), 차집합 ∅. 좌표 `schedulesScreen.detail.test.ts`: R1·P1·R2·P2·S2·S6 `'토글은 그 작업의 사용 상태를 보이고…'` · R4~R6·S3~S5 `'행 메뉴의 지금 실행·편집·삭제는…'` · P4·P5·S7·S8 `'패널 메뉴의 지금 실행·편집·삭제는…'` · P6·S9 `'패널 메뉴의 삭제는…'` · R3·P3 `'실행 중인 작업의 지금 실행은…'` · S1 `'패널을 펼치면 목록이 inert…'` | 대상 `t2`(첫 작업 `t1`과 구별) · `t2` disabled/running(형제는 반대) · 편집 모달 제목 `'둘째'`. 관측: 콜백 인자·`aria-checked`·`disabled`·`inert` 노드 수 | — |
| VP-07′ | EP-1 `text` 정리 위치 | 5자리(규칙만 바뀜) | 5/5 | ③ `runner.test.ts:'프롬프트 본문을 저장된 그대로(앞뒤 공백 포함) 넘긴다'` · ④ `useScheduledPromptRelay.test.ts:'시작 요청의 본문을 앞뒤 공백까지 그대로 시작 함수에 넘긴다'` · ⑤ `chatStore.detached.test.ts:'작업의 설정 그대로 새 대화를…'`(payload + 낙관 커밋 parts). ①② r1 좌표 유지 | `'  점검 \n'` → ③④ 그대로, ⑤ `'  새 버그를 요약해 줘  '` → `'새 버그를 요약해 줘'` | — |
| VP-17′ | cron 가지 → `startCron` | 0 | 해당 없음 | `scheduler.test.ts:'cron 스케줄의 다음 실행은 cron 식이 정한 시각이다'` — 09:20 고정 → `nextRun` = 10:00 | — | — |
| VP-12 | EP-6 4항 + D2·D4 | 1자리 4항 | 4/4항 | D2 `shell-runner.test.ts:'win32 는 PowerShell…'`(마지막 인자 전체 문자열·인자 수 4) · D4 `shell-runner.process.test.ts:'제한 시간이 지나면 자손까지 끝내고…'`(io, 실제 `/bin/sh`) + `shell-runner.test.ts:'제한 시간 종료는 프로세스 트리를 끝내고…'`·`'종료를 요청하지 않았으면 exit 만으로…'`·`'POSIX 는 새 프로세스 그룹으로…'` | 제한 300ms → 실측 305ms(수정 전 30015ms) · 손자 pid 종료 확인 | win32 `taskkill` 가지는 이 Linux 컨테이너에서 실행하지 못했다 — CI(windows-latest) 몫 |
| VP-13 | EP-5 ① 규칙 칸 `timedOut` 분기 (D3) | EP-5 10자리 중 ① | 1/1 | `runner.test.ts:'제한 시간을 넘긴 실행은 종료 코드가 0 이어도 제한 시간 초과로 실패한다'` | `exitCode 0 ∧ timedOut` → `error=timeout` | — |
| VP-06 | EP-5 ⑩ 삭제 → cancel edge (D1) | ⑩ | 1/1 | `scheduled-tasks.lifecycle.test.ts:'실행 중인 작업을 지우면 그 실행의 shell 을 중단시키고…'` — `createScheduledTasks` 진입 | 지운 작업 signal `aborted` · 형제 작업 signal 미중단 · `list()` 남은 작업만 `running` | — |
| VP-26′ | AC32 본문 (D5) | 0(§10 자리 아님) | 해당 없음 | `'패널 메타는 그 작업의…'` · `'실행 중·일시 중지·프로젝트 삭제를…'` · `'이력의 대화 열기는…'` | 트리거 요약 · `카메라 검증` · 다음 실행 시각 · `shell 명령` / `실행 중`·`일시 중지`·`프로젝트가 삭제되었습니다` / `session-5` | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 19행 중 이행 8(V07·V35·W11·X01~X04·X08) · 채택 확장 8(V46·V55·D03~D06·X05·X06) → 16/16 red. 동치 2(V28·V37)·경계 1(X07)은 의무 아님(재실행 green 그대로).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-06 | REQUIRED | SELF_PASS | 위 lifecycle 좌표 + r1 좌표 | V01·V02 red(재실행) |
| VP-07′ | REQUIRED | SELF_PASS | 위 EP-1 좌표 | V45·R02·R03·R05·R07 red(재실행) |
| VP-12 | REQUIRED | SELF_PASS | 위 shell 좌표 | not selected |
| VP-13 | REQUIRED | SELF_PASS | 위 runner 좌표 | not selected |
| VP-17′ | REQUIRED | SELF_PASS | 위 scheduler 좌표 | V55 red |
| VP-20 | REGRESSION | SELF_PASS | `chatStore.test.ts` | R01 red(재실행) |
| VP-26′ | REQUIRED | SELF_BLOCKED | 위 EP-9·AC32 좌표 | AC34 사람 실기 대기 |
| VP-21~25 | REQUIRED·REGRESSION | r1.2·r1.3 상태 유지 | r1.2·r1.3 표의 좌표 — 이번 diff는 그 파일을 건드리지 않았다(`git diff --name-only`에 ΔV1·ΔV2 화면 파일 0) | — |
| 그 밖의 V1 pair | — | r1 상태 유지 | r1 표 좌표 · 아래 ④ 재실행 79행 red | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

하네스 `mutate.py`로 125행을 한 번에 돌렸다(spec = verify r1의 98행 + EP-9·D4 27행). 끝에 `# 원복 확인: 모든 파일 원문 그대로`, 뒤 `git status`에 자기 변경 파일만.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| V07 `service.delete`의 `runner.cancel` 제거 | D1 인용 변이 | 못 잡음 | lifecycle `'실행 중인 작업을 지우면…'` | 잠김 |
| V35 UTF-8 접두 제거 | D2 인용 변이 | 못 잡음 | `shell-runner.test.ts` 1건 | 잠김 |
| W11 `ok` 식의 `!timedOut` 제거 | D3 인용 변이 | 못 잡음 | `runner.test.ts` 1건 | 잠김 |
| X01~X04 메타 4칸 · X08 `onOpenSession` 무시 | D5 인용 변이 | 못 잡음 | `schedulesScreen.detail.test.ts` 1~2건씩 | 잠김 |
| V46 runner `text.trim()` | E1 채택 | 못 잡음 | `runner.test.ts` 1건 | 잠김 |
| V55 cron 가지 → interval | E3 채택 | 못 잡음 | `scheduler.test.ts` 1건 | 잠김 |
| D03~D06 · X05 · X06 패널 메뉴·토글·`inert`·비활성 | E2 채택 | 못 잡음 | `schedulesScreen.detail.test.ts` 1~3건씩 | 잠김 |
| R1~R6 · P1~P6 · S1 · S2 · S3a(`select` 제거) · S3b · S4~S9 | sweep — EP-9 21자리(S3은 두 항) | 최초 | 1~3건씩 | 잠김 |
| K1 `exit` 확정 제거 · K2 `detached: false` · K3 그룹 kill → 셸만 · K4 트리 종료 → `child.kill()` · K5 중복 종료 가드 제거 | 새 oracle 민감도(D4) | 최초 | K1 1건 · K2 2건 · K3 1건 · K4 2건 · K5 1건(oracle = `infra/shell`·slice·lifecycle 50케이스) | 잠김 |
| verify r1 `잡음` 79행 재실행(④ — oracle 파일·`shell-runner.ts`가 바뀌어 전부) | 덮개 회귀 확인 | 잡음 | 각 행 1~19건 | 잠김 — red → green 0 |
| V28 · V37 | ③ 동치 행 재실행 | 동치 | green | 동치 그대로(도달 불가 가드 — verify r1 근거) |
| X07 `font-mono` | ③ 경계 행 | 경계 | green | 경계(AC34 시각) |

- **분모 검산**: `선택 증거 0(재실행은 ④에 포함) · 인용 변이 8(D1~D5) · 채택 확장 8 · 새 oracle 5(K1~K5) · sweep 22(EP-9) · ④ 재실행 79 · ③ 재실행 3 = 표 행 125`, red 122 · green 3(V28·V37·X07).
- **덮개 회귀**: verify r1 red 79행 → 이번 79행 red. red → green 0.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음. 문서 `security.md` 상한 행에 "셸과 그 자손 프로세스를 함께 종료"를 적었다 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | `kill()`이 `killRequested`를 세운 뒤 주입 가능한 `killTreeImpl`을 부른다. `done()`의 타이머·신호 정리는 그대로 | `shell-runner.test.ts` 12케이스 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 제한 시간 → "shell이 제한 시간을 넘으면 … `실패: 제한 시간 초과`" 행. 이제 실제로 제한 시간 시점에 끝난다(305ms/300ms) | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 이전에는 손자 프로세스가 있으면 이력이 `실행 중`으로 남아 `지금 실행`이 막혔다 — 해소 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 종료 요청 뒤 `exit`로 확정한 실행에 늦은 `close`가 와도 `settled`라 무시 | `'제한 시간 종료는 프로세스 트리를 끝내고…'` |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 종료한 손자는 컨테이너처럼 거둘 init이 없으면 좀비로 남아 `process.kill(pid, 0)`이 성공한다 | ✅ 테스트가 `/proc/<pid>/stat`의 `Z`를 죽은 것으로 본다 | 첫 실행에서 red |
| 2 | POSIX `detached: true`는 앱이 비정상 종료(크래시)하면 그룹이 남을 수 있다 — 정상 종료·삭제는 `dispose`/`cancel`이 그룹을 죽인다 | ⚠️ 보고만 | 비정상 종료 시 자식 처리는 이전(비분리)에도 보장이 없었다 |
| 3 | win32 `taskkill /T /F`는 이 환경에서 실행하지 못했다 | ⚠️ CI(windows-latest)에서 `shell-runner.process.test.ts`가 PowerShell `ping -n 30`으로 같은 경로를 지난다 | — |
| 4 | 출력 꼬리를 바이트로 자를 때 UTF-8 다중 바이트 문자가 잘릴 수 있다 | ⚠️ 보고만 — 범위 밖(AC15는 길이·표시만) | `append`의 `subarray` |

### 설계 대비 명시적 차이

- 없음 — D4 방식은 §23이 재량으로 둔 범위 안이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 · 재진입 | 종료 요청이 두 번(시간 초과 + 중단 신호) 와도 `killRequested`가 한 번만 부른다 | K5 red |
| 공유 | 프로세스 그룹은 그 실행 하나의 것 — 다른 작업의 실행과 공유하지 않는다 | lifecycle 실행 중 삭제 케이스(형제 signal 미중단) |
| 다른 무효화 축 | 종료를 요청하지 않은 정상 종료는 여전히 `close`까지 기다린다 | `'종료를 요청하지 않았으면 exit 만으로…'` |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 수정: `main/infra/shell/shell-runner.ts`(트리 종료·`exit` 확정·`detached`) · 테스트 7(`shell-runner.test.ts`·`runner.test.ts`·`scheduled-tasks.lifecycle.test.ts`·`scheduler.test.ts`·`useScheduledPromptRelay.test.ts`·`chatStore.detached.test.ts`·`schedulesScreen.detail.test.ts`) · 문서 `docs/arch/backend/security.md`. 신규: `main/infra/shell/shell-runner.process.test.ts` |
| 실행 명령 | 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음, Node ABI) · `node --test scripts/*.test.mjs` |
| **관측한 게이트 산출** | vitest 970파일 중 957 pass · 9 fail · 4 skip / 9204케이스 중 9170 pass · 22 fail · 1 expected fail · 11 skip — 실패 9파일·22케이스는 verify r1이 `d324a9f`에서 잰 기준선과 같은 집합(`adapters/claude/*` 3 · `adapters/opencode/v1/*` 3 · `composer-catalog` · `composer-preparation-service` · `session-resources.claude-assembly`)이고 이번 diff 파일과 교집합 0 · lint `0 errors, 2 warnings`(기존 2건) · typecheck 3구성 error 0 · migrations·doc-inventory·product-naming·test-budgets 통과 · `node --test` 868/868 |
| **추가·수정 테스트의 subtree 규칙** | 테스트 8파일. 시간 예산: `check-test-budgets` 통과(실제 시간 값은 `timeoutMs: 300`·`scaleMs(2000)` — 가드가 받아들였다) · 풀: `shell-runner.process.test.ts`만 io(`node:child_process` import, 실행 로그 `\|io\|`), 나머지 unit에서 `[test-pools]` 0줄 · 호스트 격리: 홈·env 읽기 0 |
| V-pair 자기확인 | `SELF_PASS 6 / SELF_BLOCKED 1`(VP-26′ — AC34 실기) + 나머지 이전 상태 유지 |
| 강제 지점 전수 | EP-9 21/21 · EP-1 5/5(규칙 정정) · EP-5 ①⑩ 보강 · EP-6 4/4항 |
| **AC 자기보고**(`Criteria-Met`) | 31/35 — ✅ AC1~AC22 · AC24~AC26 · AC28~AC30 · AC32 · AC33 · AC35. ⚠️ AC23·AC27·AC31·AC34(사람 실기). AC14·AC15·AC32는 D2·D3·D4·D5로 이번 턴 재관측 |
| **합계 검산** | `✅ 31 · ⚠️ 4 · ❌ 0 = 총 35` — ΔV4가 AC35를 더해 분모 34 → 35 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 첫 재구현 — verify r1 D1~D5·E1~E3.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: D4는 AC15가 이미 요구했지만 r1 oracle이 주입 spawn만 써서 실제 프로세스 트리를 지나지 않았다. E2는 선언 경계 5의 근거(정적 마크업)가 r1.4 하네스 도입 뒤 낡았다.
- 반복해서 부딪히는 환경 한계: 컨테이너에 좀비를 거둘 init이 없다 · Windows 경로(`taskkill`)는 이 환경에서 못 돈다.
- 현재 라운드·impl 턴: `r2`

## [구현자 기입] 설계 리뷰 (r3)

- ΔV5(§24)를 그대로 수행했다. prod 코드 변경 0 — 채택한 41자리는 이미 계약대로 동작했고 테스트만 더했다(`git diff --stat -- app/src` = 테스트 7파일).
- plan과 다른 점 1건: §24 "`node:child_process`를 대체하는 파일은 io 풀 신호를 갖는다"가 틀렸다. `shell-runner.win32.test.ts`는 spawn을 `vi.mock`으로 대체해 exe를 띄우지 않아 분류기가 `|unit|`로 돌렸다(`vitest --reporter=verbose` 관측). `app/AGENTS.md` "exe 대체" 규칙과 맞으므로 그대로 두었다 — 규범 행(AC·§10)은 영향 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r3)

자리 검색 명령 재실행(이 턴, `app/src/`): EP-10 22줄 = 19 + 제외 3 · EP-11 5줄 · EP-12 4 + 5줄 · EP-13 9줄 = 8 + 제외 1. 각 §10 목록과 차집합 ∅.

| pair | §10이 적은 지점 | N | 닫은 수 | 직접 oracle 좌표 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-02′ | EP-10 A F0~F6·T0~T4 | 12 | 12/12 | `scheduleTaskModal.interaction.test.ts` `입력이 저장 요청까지 간다` 5케이스 — F0·F2·F6 `'제목·본문을 차례로 바꾸면 둘 다 요청에 남는다'` · F3·F4 `'프로젝트·실행 설정 슬롯이 넘긴 값이…'` · F5 `'shell 로 바꾸면…'` · T0~T3·F1 `'주기·요일·시각 칩에서 고른 값이 트리거가 된다'`(실제 칩 클릭) · T4 두 분기 `'사용자 지정 요일은 꺼진 요일을 더하고 켜진 요일을 뺀다'` | 없음 |
| VP-02′ | EP-12 A `:169`·`:175`·`:177`·`:178` | 4 | 4/4 | `scheduleTaskModal.interaction.test.ts` `안내 문구` 4케이스(0개·프롬프트·shell+폴더·shell+폴더 없음) | 없음 |
| VP-23′ | EP-10 B Q1~Q5 | 5 | 5/5 | `features/chat/components/executionSettingsPicker.interaction.test.ts` 5케이스 — Q1 두 분기(`null`→기본 · 값 있음→0회) · Q2~Q5 칩을 열고 메뉴 항목 클릭 | 없음 |
| VP-23′ | EP-12 B `:98`·`:114`·`:116`·`:117`·`:46` | 5 | 5/5 | `projectPickerChip.test.ts` — `:46` `'칩 툴팁은…'`(경로·미선택·폴더 없음) · `:98` `'행 툴팁은…'` · `:116`·`:117` `'검색 결과가 없으면 noMatches…'` · `:114` `'ProjectMenuPanel — 빈 상태 > 불러오는 중이면…'` | 없음 |
| VP-11′ | EP-10 C G1·G2 | 2 | 2/2 | `pages/SchedulesPage.render.test.ts:'프로젝트·실행 설정 칩의 선택이 모달이 넘긴 콜백으로 간다'` | 없음 |
| VP-03′ | EP-11 V1~V5 | 5 | 5/5 | `scheduleTaskModal.interaction.test.ts` `저장` 2케이스 — V2·V3 `'성공하면…'` · V1·V4·V5 `'실패하면 열린 채 문구를 띄우고…다시 저장해 성공하면…'` | 없음 |
| VP-12′ | EP-13 K1~K8 | 8 | 8/8 | K4 `shell-runner.process.test.ts:'TERM 을 무시하는 자손도 제한 시간에 끝낸다'`(io, 실제 `/bin/sh`) · K5·K6 `shell-runner.test.ts:'정상 종료 뒤에는 제한 시간이 지나도…'`·`'정상 종료 뒤 중단 신호가 와도…'` · K7 `'셸은 플랫폼과 무관하게 창 없이 띄운다'` · K8 기존 `'제한 시간을 넘기면 프로세스를 종료하고 timedOut 으로 끝난다'`(`FakeChild`에 pid 없음 → `child.kill`) · K1·K2·K3 `shell-runner.win32.test.ts` 2케이스 | 없음 |

- 합: 41/41. V-pair 자기확인: VP-02′·VP-23′·VP-11′·VP-03′·VP-12′ `SELF_PASS`(아래 sweep 행) · VP-04 REGRESSION `SELF_PASS`(같은 좌표 + 전체 vitest) · VP-26′ `SELF_BLOCKED`(AC34 실기, 불변).

## [구현자 기입] 이번 라운드 수정의 잠금 (r3)

하네스 `mutate.py`, spec은 scratchpad `r3-sweep.jsonl`(47행). 마지막 수정(prettier·주석) 뒤 트리에서 다시 돌려 **47/47 red**, `# 원복 확인: 모든 파일 원문 그대로`.

| 묶음 | 행 | 결과 | 비고 |
|---|---|---|---|
| EP-10 A 제거·빈 값 F0~F6·T1~T4 | 11 | red 11 | verify r2 M3→F3 · M4→F4 · M5→F5 · M8→F6 · T1~T4 원문과 같은 형태 |
| EP-10 A 맞바꿈 T0(`onPick(option)`→`onPick(value)`) · T4 분기 2(`toggleDay` 항상 더함/항상 뺌) | 3 | red 3 | 규칙 칸 분기 입력 |
| EP-10 B Q1(제거)·Q1b(`value == null` 조건 제거)·Q2~Q4·Q5(제거)·Q5s(`options[0]` 맞바꿈) | 7 | red 7 | verify r2 Q2~Q5 원문 형태 포함 |
| EP-10 C G1·G2 | 2 | red 2 | — |
| EP-11 V1~V5 | 5 | red 5 | verify r2 M10→V2 · M11→V4 |
| EP-12 A `:169`(문구·조건 2) · `:175`·`:177`·`:178` 맞바꿈 | 5 | red 5 | verify r2 M7→`:175` |
| EP-12 B `:98` · `:114`·`:116`·`:117` 맞바꿈 · `:46`(폴백 제거·경로 제거 2) | 6 | red 6 | verify r2 N6→`:116` · O6→`:46` |
| EP-13 K1~K8 | 8 | red 8 | verify r2 S1→K2·K7 · S2→K4 · S4→K1 · S6→K3 · S8→K6 · S9→K5 |

- 검산: `선택 증거 0 · 인용 변이 21(verify r2 채택 못 잡음 행) · 새 oracle 0(구조적 proxy 없음) · sweep 47 = 표 행 47` — 인용 변이 21은 sweep 47 안의 같은 형태 행이라 따로 세지 않았다(위 비고의 대응).
- 하한 ④(직전 `잡음` 행 재실행): prod 파일 diff 0이고 oracle 파일은 케이스를 더하기만 했다(`git diff` 삭제 3줄 = `SchedulesPage.render.test.ts`의 mock 타입·`captured` 초기화 줄 교체). verify r2 spec(`spec1~5.jsonl`)은 다른 세션 scratchpad라 이 환경에 없어 원문 재실행은 못 했다.

## [구현자 기입] Product/UX 파생 검토 (r3)

| 질문 | 관측 | 처리 |
|---|---|---|
| 새 사용자 대면 문구·상태가 있는가 | 없음 — prod diff 0 | 해당 없음 |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 저장 실패는 모달 안 `role="alert"` 문구(`'실패하면 열린 채…'` 관측) | 잠금 완료 |
| 실행 설정 칩에서 고르면 화면 값도 바뀌는가 | 모달 슬롯 표식이 `p1→p2`·`plan`으로 바뀜(`'프로젝트·실행 설정 슬롯이 넘긴 값이…'`) | 잠금 완료 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r3)

| # | 문제 | 대응 |
|---|---|---|
| 1 | win32 실제 `taskkill` 효과(자손 생존)는 여전히 Windows에서만 관측된다 | §24 선언 경계 그대로 — 인자·폴백만 잠금 |
| 2 | K4 테스트는 `/proc`로 좀비를 가른다 — 좀비를 거둘 init 없는 컨테이너에서도 `alive=false` 판정(r2 같은 헬퍼) | 기존 헬퍼 재사용, 추가 대응 없음 |

### 설계 대비 명시적 차이

- `shell-runner.win32.test.ts` 풀 = unit(§24는 io로 적음). 축별: 만료 — 해당 없음(타이머 없음) · 공유 — `vi.mock`은 파일 단위라 다른 파일과 공유 0 · 재진입 — 해당 없음 · 다른 무효화 — unit 가드(`vitest-unit-guard.mjs`)가 실제 spawn을 막으므로 mock이 빠지면 red(안전 방향).

## [구현자 기입] 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 테스트만. 신규 3: `main/infra/shell/shell-runner.win32.test.ts` · `features/chat/components/executionSettingsPicker.interaction.test.ts` · `features/schedules/components/scheduleTaskModal.interaction.test.ts`. 수정 4: `shell-runner.test.ts` · `shell-runner.process.test.ts` · `projectPickerChip.test.ts` · `pages/SchedulesPage.render.test.ts`. prod 0 |
| 실행 명령 | 가드 4종 · `npx eslint .` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음, Node ABI — `npm rebuild better-sqlite3`) · `node --test scripts/*.test.mjs` |
| **관측한 게이트 산출** | vitest 974파일 중 961 pass · 9 fail · 4 skip / 9247케이스 중 9213 pass · 22 fail · 1 expected fail · 11 skip. 실패 9파일 = verify r2 기준선과 같은 집합(`adapters/claude/*` 3 · `adapters/opencode/v1/*` 3 · `composer-catalog` · `composer-preparation-service` · `session-resources.claude-assembly`), 이번 diff와 교집합 0 · `[test-pools]` 0줄 · lint `0 errors, 2 warnings`(손대지 않은 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · typecheck error TS 0 · migrations·doc-inventory·product-naming·test-budgets(`18 real-git suites ok · all budget sites scaled`) 통과 · `node --test` 868 pass / 0 fail |
| **추가·수정 테스트의 subtree 규칙** | 7파일. 시간 예산: `check-test-budgets` 통과(새 시간 값 `timeoutMs: 300`·`LIMITS.timeoutMs * 2`) · 풀: `shell-runner.process.test.ts`만 io, 나머지 6 unit(`|unit|` 관측) · 호스트 격리: 홈·env 읽기 0 |
| V-pair 자기확인 | `SELF_PASS 6`(VP-02′·VP-23′·VP-11′·VP-03′·VP-12′·VP-04) · `SELF_BLOCKED 1`(VP-26′ AC34) |
| 강제 지점 전수 | EP-10 19/19 · EP-11 5/5 · EP-12 9/9 · EP-13 8/8 = 41/41 |
| **AC 자기보고**(`Criteria-Met`) | 35/39 — ✅ AC1~AC22 · AC24~AC26 · AC28~AC30 · AC32 · AC33 · AC35~AC39. ⚠️ AC23·AC27·AC31·AC34(사람 실기). AC36~AC39는 위 좌표로 이번 턴 관측 |
| **합계 검산** | `✅ 35 · ⚠️ 4 · ❌ 0 = 총 39` — ΔV5가 AC36~AC39를 더해 분모 35 → 39 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r3)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 아니다 — verify r2가 처음 돌린 ΔV1·ΔV2 축(입력 배선)과 r2가 만든 종료 표면.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: ΔV1·ΔV2의 oracle이 정적 렌더였다(verify r2 §9) — ΔV5가 상호작용 oracle로 바꿨다.
- 반복해서 부딪히는 환경 한계: Windows 실제 프로세스 경로.
- 현재 라운드·impl 턴: `r3`

## [검증자 기입] 파생 이슈

verify r1(1회째)·r2(2회째) — 상세는 [`verify.md`](verify.md).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | 삭제 시 실행 중단 edge 미잠금(V07) | VP-06 · EP-5 ⑩ | lifecycle 케이스 | 이행 | BLOCKING | **closed** (r2: V07 red) |
| D2 | win32 UTF-8 접두 미잠금(V35) | VP-12 · AC14 | 마지막 인자 단언 | 이행 | BLOCKING | **closed** (r2: V35 red) |
| D3 | `timedOut ∧ exitCode 0` 입력 부재(W11) | VP-13 · AC15 | 입력 추가 | 이행 | BLOCKING | **closed** (r2: W11 red · A1 실제 재현) |
| D4 | 제한 시간 뒤 실행이 안 끝남(4007ms) | VP-12 · AC15 | 트리 종료 + `exit` 확정 | 현재 | BLOCKING | **closed** (r2: A1~A4 · 305ms) |
| D5 | 패널 본문 미잠금(X01~X04·X08) | VP-26 · AC32·AC18 | 본문 단언 | 이행 | BLOCKING | **closed** (r2: 8변이 red) |
| E1~E3 | EP-1 trim · 패널·행 조작 · cron 호출 대체 | ΔV4 채택 | — | 확장 | 채택 | **closed** (r2 변이 red) |
| E4 | 모달·트리거·실행 설정 입력 → 폼 배선 12변이 green(M3·M4·M5·M8·T1~T4·Q2~Q5) | VP-02·21·23 · AC3·AC4·AC28 | 설계자: 자리 목록으로 채택 또는 경계 선언 | 확장 | 채택 | **closed** (r3: 원문 형태 변이 red) |
| E5 | 모달 `저장`→`onSubmit` · 저장 실패 시 열린 채 문구(M10·M11) | Part I §5 | 설계자: 채택 또는 경계 | 확장 | 채택 | **closed** (r3: 원문 형태 변이 red) |
| E6 | 안내·0건·툴팁 문구 3자리(M7·N6·O6) | AC27·31 | 설계자: 경계 선언 권고 | 확장 | 채택 | **closed** (r3: 원문 형태 변이 red) |
| E7 | 종료 세부: SIGKILL 세기(S2) · 정상 종료 뒤 타이머·리스너 정리(S8·S9, pid 재사용 위험) · win32 3자리(S1·S4·S6) · setsid 탈출 손자(A5) | VP-12 · D4 | 설계자: ①②채택 · win32 CI 위임·③④ 경계 | 확장 | 채택 | **closed** (r3: 원문 형태 변이 red) |
| R3-1 | 독립 축 `못 잡음` — `busy` 가드(N-b1) · win32 pid 없음(K9) · 사전 중단 신호(K10) | 열거 밖 | — | 확장 | NEXT_HANDOFF | 후보 표(verify r3 §7) |
