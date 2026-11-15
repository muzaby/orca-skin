# Plan — 0320-scheduled-tasks

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0320-scheduled-tasks` |
| 작성자 | Claude Code |
| 일자 | 2026-11-15 |
| 매핑 | 옛 `0287-scheduled-tasks`(브랜치 `a`의 `ce699856` 설계 · `1058886c` 구현 — `main` 미도착)를 현재 `main` 위에 다시 설계 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 옛 0287 V는 `main`에 없어 상속하지 않고 증거로만 읽는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

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

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-009·D-010. D-001~D-008은 옛 plan에서 원문 그대로 승계.
- 변경된 결정: 없음. D-009·D-010은 제품 동작이 아니라 구현 기준을 정한다.
- D-010에 따른 재고려 결과는 §4 표와 §9 Delta — 옛 구현 대비 구조 변경 7건(T1~T7).
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
| VP-03 | R-03 ↔ AT(AC7~11·17) | REQUIRED | handlers → service → queries / 타이머 | VP-06·VP-08 좌표 · AC11 확인 요청은 `schedulesScreen.render.test.ts` 신규 케이스 | not selected | EP-3 |
| VP-04 | R-04 ↔ AT(AC12~16·18~21) | REQUIRED | 발화 → runner → shell/relay → 이력 → push → store | VP-07·12·13·14 좌표 + 이관 `runHistory.render.test.ts`·`schedulesStore.test.ts` | not selected | EP-1·4·5·7 |
| VP-05 | R-05 ↔ AT(AC22·23) | REQUIRED | 문서 gate · `npm run dev` | `gate:node scripts/check-doc-inventory.mjs --check` · `shared/ipc-documentation.test.ts` · 사람 실기 | not selected | 0 |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | `createScheduledTasks` → `service.start` → `startCron`(실제 croner·가짜 타이머) → runner → 저장소 | 이관 `main/app/scheduled-tasks.lifecycle.test.ts` — production 조립 함수 그대로, 인메모리 저장소·주입 shell | required — 배선 존재 oracle. 변이: `start`에서 복원 루프 제거 · `sync`의 `enabled` 조건 뒤집기 | EP-3 (5) |
| VP-07 | SD-02 ↔ ST-02 | REQUIRED | runner → `PromptRelay.request` → push → `relayScheduledPrompt` → `startDetachedChat` → `report` → 종결 | 이관 `renderer/src/app/hooks/useScheduledPromptRelay.test.ts` · `main/features/scheduled-tasks/prompt-relay.test.ts` | required — 필드 운반. 변이: 자리 ①③④⑤에서 `permissionMode`→기본값, `providerKey`→다른 값 | EP-1 (5) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | `ipcMain` 핸들러 → zod → service/relay | 이관 `main/app/handlers/scheduled-tasks.test.ts` — 채널별 정상·무효 페이로드 | not selected | EP-2 · EP-7 |
| VP-09 | AR-02 ↔ IT-02 | REQUIRED | `Bootstrap` → `createScheduledTasks` / `shutdown` → `dispose` | VP-06 좌표(조립 함수) · `dispose` 순서는 `runner.test.ts` | not selected | EP-3 ① |
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
| EP-8 · R-06 / AC24 | 옛 구성이 남지 않는다 | — | 8식 전부 0: ① `rg "orca:\|window\.orca" app/src` ② `rg "SchedulerPort\|scheduledTaskJobKey" app/src` ③ `rg "unregister" app/src/main/features/scheduler` ④ `ls features/scheduled-tasks/{ports,registry}.ts` ⑤ `rg "shared/scheduled-tasks" app/src/main/infra/shell` ⑥ `rg "detachedStarts\|settleDetachedStart" app/src` ⑦ `ls migrations/0034_scheduled_tasks.sql` ⑧ `ls docs/handoff/0287-scheduled-tasks` | (좌동) | 두 벌의 구성이 공존한다 |

- 선언 경계 1 — OpenCode 에이전트·variant: `PromptExecution`은 `harnessAgent`·`modelVariant`를 싣지 않는다. OpenCode 작업은 그 둘의 기본값으로 실행된다. 근거: 두 필드는 `SendChatMessage`의 선택 필드다(`shared/ipc.ts:909-910`).
- 선언 경계 2 — 전송 IPC 자체의 reject: `chatApi.send`가 reject하면 draft는 종결 이벤트를 받지 않아 대기가 main의 보고 시간 초과로 끝난다(이력 `report_timeout`). 일반 `send`도 같은 자리에서 게이트를 풀지 않는다(`chatStore.ts:571-580` — `reportError`만).
- 선언 경계 3 — electron 방송·창 선택(`infra/ipc/send.ts`)과 `bootstrap.ts`의 조립 호출 줄은 자동 좌표가 없다. `send.ts`는 `electron`을 import한다. AC23 실기가 본다.
- 선언 경계 4 — 게이트(로그인 전)·부팅 중에는 릴레이 구독자가 없어 그 사이 프롬프트 발화는 `report_timeout`이 된다(비범위 §6).
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
- [x] 선언 경계 4건 — 각 근거 좌표와 함께.
- [x] 운영 gate 열거.
- [x] 사람 실기로 미룬 순수 로직 없음 — 옛 구현이 남긴 picker 로직은 VP-19로 내렸다.
- [x] structural proxy 단독 AC 없음 — AC24는 양성 좌표와 짝.
- [x] 신규 계약의 SSOT·강제 지점·seam.
- [x] 부팅/등록 기존 소비처 — §12.
- [x] 상한·one-way door — §14·§17.
- [x] ACTIVE ↔ AC 대조 — §3.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
