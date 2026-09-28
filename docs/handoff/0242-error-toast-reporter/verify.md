# Verify — 0242-error-toast-reporter

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0242-error-toast-reporter` |
| 검증자 | Claude Code |
| 일자 | 2026-09-27 |
| 대상 커밋/range | `abb4e49a..55f6e887` (`318fecc7` ΔV1 설계 · `55f6e887` r1 구현) |
| 구현 전 plan 기준 | `abb4e49a` (V1 READY) |
| V mode / 유효 V | `Delta V` / `V1@abb4e49a + ΔV1@318fecc7` |
| 검증 기준 plan revision | `abb4e49a:V1` · `318fecc7:ΔV1` |
| 라운드 | 1 |
| 상태 | **PASS** — 사람 실기 2건(AC2·AC13) 대기 |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude. 그래도 보고에 없는 축 12건을 §4에 추가했다 |

## 0. 기준선 / plan 변경 확인

- 기준선은 diff로 성립한다. V1 설계 `abb4e49a` → ΔV1 설계 `318fecc7` → 구현 `55f6e887`이 각각 별도 커밋이다.
- 구현 커밋의 `plan.md` 변경은 메타 상태와 `[구현자 기입]` 절뿐이다. AC·Decision·§10 행은 바뀌지 않았다.
- **Decision Ledger 변경은 ΔV1 한 건이다.** D-006(다크=첨부 스펙 고정값) → D-010(두 테마 모두 Orca 시맨틱 토큰 우선) SUPERSEDE.
  - 근거: 사용자 원문 인용 "이것은 참고 스펙이다. 실제로는 orcinus-orca의 스타일을 준수해야한다." · 별도 설계 커밋.
  - 저장소에서 원 대화는 확인할 수 없다. 인용과 별도 커밋을 근거로 ΔV1을 채점 기준으로 받는다. **사용자 확인 요청**(D7).
- AC 변경: AC13만 ΔV1으로 대체(다크 고정 hex → alias 상속, keyframes 4스톱 원문). 나머지 AC1~AC17 원문은 V1 그대로다.
- 채점 기준: V1 AC1~AC17 + ΔV1 AC13·VP-08·EP-10·토큰/keyframes 표.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | `V1@abb4e49a` 실재(`git cat-file -t` = commit), ΔV1은 VP-08 CHANGED·VP-15 REGRESSION만 명시 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | V1 NEW node 전부 VP-01~20 REQUIRED, ΔV1 R-08 CHANGED ↔ VP-08 REQUIRED |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | Host 렌더(VP-15) REGRESSION |
| pair별 path·§10 전수·oracle | 유효 | 20 pair 모두 path·EP·직접 oracle 기재 |
| 선택적 적대 증거·이유 | 유효 | VP-02·04·05·14·19 선택, 나머지는 직접 결과 단언 사유 기재 |
| `SUPERSEDED` 이관 | 유효 | D-006의 AC13·EP-10이 ΔV1 표로 이관됨 |
| 운영 gate·범위 | 유효 | lint·typecheck·vitest·inventory·trailer |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | transcript 소비 오류는 toast 없음 | `ingestChatEvent(error)` → transcript만 — `chatStore.errors.test.ts` 3번째 케이스 toast 0 |
| D-002 | toast = 로그 선행 | renderer `reportError`: `rendererLog.error` → `presentErrorReport`; main: `log.*` → `publishErrorReport` |
| D-003 | 8 레이어 호출 가능 | renderer app·pages·features·shared, main app·features·adapters·infra 각 1곳 이상 호출, boundaries lint 오류 0 |
| D-004 | 사용자 영향 사이트만 | renderer 90 catch = TOAST 33 · CONSUMED 36 · EXCLUDE 21, main 25 호출 |
| D-005 | main 오류 → 창 | `process.on` → `infra/error-report` → hub → sink → `orca:error:reportEvent` → bridge → store |
| D-007·D-008 | 3장·병합·1초 cooldown·4.6초 | `errorToastModel.ts` 상수 + store 타이머 |
| D-009 | scheduler 전이 1회 | `Scheduler.failing` Set |
| D-010 | Orca alias 두 테마 | `tokens.css` `@theme` alias 6 + 다크 shadow 1 |

```text
renderer 사이트/전역 → shared/errors.reportError → rendererLog(1) → errorToastStore → ErrorToastHost(App.tsx, RootGate 형제)
main 사이트/전역   → infra/error-report.reportError → logger(1) → ErrorReportHub
      ├ ready 창 ≥1 → sink → webContents.send(orca:error:reportEvent) → preload → bridge(present, 로그 0)
      └ ready 0     → pending(≤10) → renderer drain invoke → markReady → 반환
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 두 reporter·present·publish 모두 try/catch, 로그가 게시보다 먼저라 게시 실패에도 로그는 남는다 |
| false success | 없음 | 폴백(빈 목록·롤백·fail-closed·drop)을 유지하며 보고만 더한다 — T7·T17/18·T21·T27 행동 테스트 |
| 폭주 | 차단 | main hub 1초 cooldown + renderer 1초 cooldown + cap 3. 비-git 폴더의 `git.snapshot`은 `NOT_REPO`를 반환(reject 아님, `handlers/git.ts:69`)이라 T11 거짓 toast 없음 |
| A 대신 B | 아니오 | Host는 `App.tsx`에 마운트돼 부팅·게이트 화면에서도 보인다 |
| 신뢰 경계 | 유지 | drain을 부를 수 있는 창은 preload를 가진 메인 창뿐(로그인 창은 preload 없음, `browser-session.ts:176`) |
| 수명 | 한 틈 | 같은 webContents가 reload되면 id가 ready로 남아 reload 중 보고가 유실된다 → D3 |
| worst-case | 유한 | 화면 3장 × 300자, main 대기열 10, bridge `seen`만 창 수명 동안 증가 → D4 |

## 3. 역방향 탐색

`scan-surface.sh abb4e49..55f6e887` 실행.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 미사용 값 export (`ERROR_TOAST_MAX`·`ERROR_TOAST_COOLDOWN_MS`·`isBenignWindowError`·`APP_ERROR_TITLES`) | 정상 | 정의 파일 안에서 사용·타입 파생 |
| 테스트 전용 (`createErrorToastStore`·`ERROR_TOAST_DURATION_MS`) | 정상 | 같은 파일의 싱글턴·모델이 production에서 사용 |
| `error-report-scan.testlib.ts` | 정상 | `.testlib.` — 테스트 도구 |
| 나머지 1b·2 항목 | 비귀속 | 이번 diff 이전부터 있던 심볼 |
| 형제 정책 비대칭 | 없음 | — |
| plan 표 밖 보고 자리 | 1건 | `mainErrorBridge.ts:23` `errors.bridge.failed` — drain 실패 보고. D-004 범위 안, 레지스트리 밖 → D5 |
| catch 분모 독립 재열거 | 일치 | AST로 renderer production 전 파일 재열거: 93 = 레지스트리 90 + reporter 내부 3 |
| main 보고 호출 독립 재열거 | 일치 | `reportError(` 23 + `publishErrorReport(` 2 = 25 = 레지스트리 25행, 표 밖 호출 0 |

## 4. 기존 테스트 / semantic 검증 확인

- 선택 적대 증거 재측정: 실제 소스 파일을 바꿔 vitest를 돌리고 원본을 복원했다(스크립트 `mut.mjs`, 종료 후 `git status` 깨끗).
  - **등록 변이 10건 중 검출 10**. 자리 미지정 VP-04(a)는 행동 테스트가 있는 T18과 없는 T32 두 자리에 심었다.
- 보고에 없는 독립 축 12건 중 **red 10 · green 2**(X1 → D1, X8 → D2).
- 이전 라운드 대조: 첫 검증이라 해당 없음.
- 형제 슬롯 맞바꿈: T15/T16 event 맞바꿈 red.
- 순서 관측: AC3 로그 선행은 `invocationCallOrder`(renderer)·publish mock 안 로그 호출 수(main)로 관측. X7(로그를 게시 뒤로)이 red.

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| T18 `chat.send.rejected` 보고 삭제 | renderer registry + chatStore.errors | red 3 | VP-04(a) |
| T32 `useMcpServers` 보고 삭제 | renderer registry | red 2 | VP-04(a) 다른 자리 |
| 기존 파일(`useSkills.ts`)에 `.catch(() => undefined)` | renderer registry | red 2 | VP-04(b) |
| 새 파일에 `.catch(() => null)` | renderer registry | red 1 | VP-04(b) |
| T15/T16 event 맞바꿈 | renderer registry | red 3 | VP-04(c) |
| M23 bus 보고 삭제 | main registry | red 2 | VP-05 |
| bridge 수신에 renderer 로그 추가 | bridge test | red 1 | VP-02(a) |
| 제3 파일(`bus`)에 `publishErrorReport` | main registry | red 1 | VP-02(b) |
| drain을 구독보다 먼저 | bridge test | red 1 | VP-14 |
| 성공 시 `failing.delete` 삭제 | scheduler test | red 1 | VP-19 |
| X1 T12 파일의 import를 로컬 no-op `reportError`로 가림 | renderer registry | **green** | D1 |
| X2 M20 보고를 같은 event 문자열의 `console.warn`으로 | main registry | red 5 | 독립 |
| X3 hub cooldown 제거 | hub·integration | red 1 | 독립 |
| X4 drain의 destroyed 구독 제거 | integration | red 1 | 독립 |
| X5 benign 필터 제거 | shared/errors | red 1 | 독립 |
| X6 병합 시 만료 재설정 제거 | shared/errors | red 2 | 독립 |
| X7 renderer 로그를 게시 뒤로 | shared/errors | red 1 | 독립 |
| X8 Host `key`에서 `seq` 제거 | Host render·errors·chatStore.errors | **green** | D2 |
| X9 다크 `--shadow-toast` 제거 | Host render | red 1 | 독립 |
| X10 App의 `<ErrorToastHost />` 제거 | App·Host render | red 2 | 독립 |
| X11 main detail 절단 제거 | error-report | red 2 | 독립 |
| X12 M2를 로그 없는 `publishErrorReport`로 | main registry | red 3 | 독립 |

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-17 | MD-01 ↔ UT-01 | REQUIRED | PASS | `errorToastModel.test.ts` 2건 · X6 red | EP-7 3/3 |
| VP-18 | MD-02 ↔ UT-02 | REQUIRED | PASS | `hub.test.ts` 4건 · X3 red | EP-11 4/4 |
| VP-19 | MD-03 ↔ UT-03 | REQUIRED | PASS | `scheduler.test.ts` 실패·실패·성공·실패 → 로그 3·보고 2 · 등록 변이 red | EP-9 2/2 |
| VP-20 | MD-04 ↔ UT-04 | REQUIRED | PASS | `reportError.test.ts` benign 2문구·push/sink/logger throw 비전파 · X5 red | EP-12 3/3 |
| VP-14 | AR-01 ↔ IT-01 | REQUIRED | PASS | preload typecheck · bridge 2건 · integration · 등록 변이 red | EP-14 3/3 |
| VP-15 | AR-02 ↔ IT-02 | REGRESSION | PASS | `ErrorToastHost.render.test.ts` · App element 트리 · X10 red | EP-15 1/1 |
| VP-16 | AR-03 ↔ IT-03 | REQUIRED | PASS | VP-04·05 증거 공유 | EP-4·EP-6 |
| VP-12 | SD-01 ↔ ST-01 | REQUIRED | PASS | `chatStore.errors.test.ts`: send reject → 롤백·카드 1·Host 렌더·4600ms 후 0 | EP-4 chatStore |
| VP-13 | SD-02 ↔ ST-02 | REQUIRED | PASS | `error-report.integration.test.ts`: 창 전 보고 → drain → 카드, live 전달, destroyed 후 재대기열 · X4 red | EP-11 |
| VP-01 | R-01 ↔ AT-01 | REQUIRED | PASS(기계 범위) | renderer 전역 2 event · main M1/M2 레지스트리·integration · X12 red. 실제 Electron 예외 → 사람 실기 | EP-1 2/2 · EP-5 2/2 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | PASS | 로그 선행·수신 무로그 · 등록 변이 2 red · X7 red | EP-2 5/5 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | PASS | lint boundaries 오류 0 · electron mock 없는 `error-report/index.test.ts`가 electron 미설치 첫 실행에서 통과 | EP-3 2/2 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | PASS | 레지스트리 TOAST 33·CONSUMED 36·EXCLUDE 21 · 등록 변이 5 red | EP-4 33/33 · EP-8 1/1 |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | PASS | main 레지스트리 25행 · 등록 변이 red · X2 red | EP-6 25/25 |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | PASS | model·store(4599/4600ms, 병합 재시작, dismiss, 타이머 정리) | EP-7 |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | PASS | VP-19 증거 공유 | EP-9 |
| VP-08 | R-08 ↔ AT-08 | REQUIRED(ΔV1) | PASS(기계 범위) | 클래스 문자열·alias 6·shadow 2·keyframes 4스톱·4.6s 단언 · X9 red. 시각 → 사람 실기 | EP-10 2/2 |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | PASS | VP-13·18 증거 공유 | EP-11 |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | PASS | VP-20 증거 공유 | EP-12 |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | PASS | `ipc-documentation.test.ts` · inventory `--check` 통과 | EP-13 |

- root `PAIR_FAIL`: 없음. `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — 유효 V의 REQUIRED 19 + REGRESSION 1 = 20 전건.

### AT / AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | 전역 error/rejection 각각 로그 1·카드 1, event 이름 유지 |
| AC2 | ⚠️ | 단위·레지스트리·IPC 통합 통과. 실제 Electron main 예외가 창에 뜨는지는 사람 실기 |
| AC3 | ✅ | 양 reporter 로그 선행, main 수신 renderer 로그 0 |
| AC4 | ✅ | renderer 4 레이어 호출 · lint 오류 0 |
| AC5 | ✅ | main 4 레이어 호출 · electron 비의존 테스트 |
| AC6 | ✅ | TOAST 33행 + 행동 4건(T7·T17/18·T21·T27) |
| AC7 | ✅ | 비대상 57 catch 보고 0 |
| AC8 | ✅ | silent 집합 = 허용 4 · 신규/기존 파일 변이 red |
| AC9 | ✅ | 25호출 event·title 유지 · publish 2곳 로그 결합 |
| AC10 | ✅ | cap·병합 seq+1·만료 재설정·500ms 무시 |
| AC11 | ✅ | 4599/4600ms · dismiss 즉시 · 병합 재시작 |
| AC12 | ✅ | 로그 3·보고 2, 첫 실패 보고 |
| AC13 | ⚠️ | 소스 단언 통과. 두 테마 시각은 사람 실기 |
| AC14 | ✅ | 대기열·FIFO 10·drain 비움·destroyed 재대기열·cooldown |
| AC15 | ✅ | ResizeObserver 2문구 로그 0·카드 0 |
| AC16 | ✅ | push·sink·logger throw 비전파 |
| AC17 | ✅ | IPC 문서 테스트·inventory |

- 합계 재측정: ✅ 15 · ⚠️ 2 · ❌ 0 = 17. 자기보고 15/17과 일치.
- 사본 대조: plan 본문 15/17 ↔ trailer `Criteria-Met: 15/17` ↔ INDEX 비고 "AC 15/17" 일치.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | error 0 · warning 1(`useTranscriptVirtualizer`, 기존). 실행 후 `git status` 변화 0 |
| typecheck | PASS | node·web·test 3구성 exit 0 |
| vitest 전체 | PASS | 593파일 중 592 pass·1 skip, 5652 pass·3 skip·0 fail |
| vitest 관련 경로 | PASS | 129파일 중 128 pass, 1304 pass |
| doc inventory `--check` | PASS | generated ok(99 channels)·prose ok·links ok |
| scripts `node --test` | PASS | 128 pass · 0 fail |
| trailer | PASS | 두 커밋 모두 적힌 키 전부 파싱 |

## 7. 숫자 재측정

- renderer catch: AST 재열거 93 = 90(33+36+21) + reporter 내부 3.
- renderer 보고 호출: `shared/errors` 밖 production 33.
- main 보고 호출: 23 + 2 = 25 = 24 M행 + M22 두 번째 호출.
- 상한: 카드 3 × 300자 · main pending 10 · cooldown 1000ms 양측.

## 8. 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 | 방법 |
|---|---|---|---|
| AC2 | hub·sink·drain·bridge를 실제 모듈로 조립한 통합 테스트 | Electron main에서 실제 `uncaughtException` → 창 toast | dev 실행 후 main에서 강제 예외 1회, 우측 상단 카드와 로그 JSONL 1줄 확인 |
| AC13 | 클래스·토큰·keyframes 문자열 | 두 테마 시각 | 라이트/다크 각각 toast 1장 이상 띄워 배경·테두리·글꼴·등장/퇴장 확인 |

## 9. 게이트 재실행

- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts` → `npm rebuild better-sqlite3`(Node ABI).
- 첫 전체 실행은 42파일 실패: bindings 미빌드 129건 + electron 바이너리 미설치 2 서명. rebuild 후 8파일 남음.
- 남은 8파일은 `Electron failed to install correctly` 서명. 기준 `abb4e49`에서도 같은 8파일이 실패한다.
  - `ELECTRON_OVERRIDE_DIST_PATH`에 빈 파일을 주면 HEAD 8/8(35건)·기준 8/8(34건) 통과 → 환경 기인.
- 게이트의 트리 변경: 없음. 잔여물: scratchpad의 기준 worktree·node_modules만 — 저장소 밖.

## 11. Repository operation checks

- AGENTS.md 변경 없음.
- INDEX: 대상 커밋 `(r1 구현 — 검증자 기입)`을 `abb4e49`·`318fecc`·`55f6e88`로 채운다(3건 모두 `git cat-file -t` = commit).
- trailer: `55f6e887` 6키, `318fecc7` 3키 파싱. 값은 허용값이다.
  - 다만 `318fecc7`은 `Agent: codex` + `Status: designed`다. 설계 커밋은 Claude 몫이라는 root 규칙과 역할이 어긋난다 → D7.
- `[구현자 기입]` 7필드 전수 존재.
- 증거 파일 `evidence/r1-lint.log`·`r1-test-summary.json`에 로컬 Windows 사용자 경로(`C:\Users\<계정>`)가 남았다 → D7.

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | 레지스트리는 catch 안 `reportError` **식별자**만 본다. 파일 import를 로컬 no-op으로 가리면(X1) 보고 0인데 green | VP-04 oracle은 plan 정의 그대로 충족 — 비귀속 | NON_BLOCKING | 식별자가 `shared/errors` import에 묶였는지 단언 추가 검토 |
| D2 | Host `key={id:seq}`(병합 시 애니메이션 재생)를 잠그는 테스트가 없다(X8 green). 현재 동작은 정상 | §11 카드 계약, AC 외 | NON_BLOCKING | 회귀 시 병합 카드가 원래 4.6초에 투명해진 채 남는다. key 단언 1건 추가 검토 |
| D3 | 같은 webContents reload 시 id가 ready로 남아 reload 중 main 보고가 유실된다 | 비귀속(AC14는 destroyed만 요구) | NON_BLOCKING | `did-start-navigation`에서 `forget` 검토 |
| D4 | bridge `seen` id 집합이 창 수명 동안 증가(구현자 I6) | 비귀속 | NON_BLOCKING | 상한 정책 후속 |
| D5 | `errors.bridge.failed` 보고 자리가 plan 표·레지스트리 밖 | D-004 범위 안 | NON_BLOCKING | 다음 레지스트리 갱신 때 행 추가 |
| D6 | renderer T1 `boot.step.degraded` 카드 설명에 step id가 없다(main M11은 `id: message`) | 비귀속 UX | NON_BLOCKING | detail에 step id 포함 검토 |
| D7 | ΔV1 설계 커밋이 `Agent: codex`이고 D-010 원 대화가 저장소에 없다. 증거 로그에 로컬 사용자 경로 | 운영 규칙 | NON_BLOCKING | **사용자가 D-010 정정을 확인**. 경로는 다음 커밋에서 마스킹 검토 |

## 14. Review Signals — 사실만

- 첫 검증 라운드. 이전 라운드 증상 비교 해당 없음.
- 구현 턴에서 사용자 스타일 정정이 들어와 구현자가 ΔV1 설계 커밋을 직접 만들었다.
- 반복 환경 한계: electron 바이너리·better-sqlite3 미빌드(egress). 우회 후 전건 통과.

## 15. 결론

- 상태: **PASS**.
- pair: REQUIRED/REGRESSION 20/20 PASS · PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0.
- AC: ✅ 15 · ⚠️ 2(사람 실기) · ❌ 0.
- 변이: 등록 10/10 red · 독립 12축 중 10 red · 2 green(D1·D2).
- gate: lint·typecheck·vitest 전체·inventory·scripts·trailer PASS.
- 비차단: D1~D7.
- 다음 단계: 사람 실기 AC2·AC13과 D-010 확인. 그 뒤 archive로 이동한다.

---

# r1.4 검증 — ΔV2 · ΔV3 · ΔV4

> r1(V1+ΔV1) 판정은 위 본문 그대로 유효하다. 이 절은 사용자 요구 변경 3건(ΔV2~ΔV4)과 그 구현 r1.2~r1.4만 채점한다.

## 메타

| 항목 | 값 |
|---|---|
| 일자 | 2026-09-28 |
| 대상 커밋/range | `9e45618..8fdfafe` — 설계 `033e314`·`1ba1522`·`29ac36a`, 구현 `2786ed8`(r1.2)·`721fb38`(r1.3)·`8fdfafe`(r1.4) |
| 구현 전 plan 기준 | ΔV2 `033e314` · ΔV3 `1ba1522` · ΔV4 `29ac36a` |
| V mode / 유효 V | `Delta V` / `V1@abb4e49 + ΔV1@318fecc + ΔV2@033e314 + ΔV3@1ba1522 + ΔV4@29ac36a` |
| 라운드 | 1 (r1.2~r1.4는 사용자 요구 변경 impl 턴 3 — review 트리거 미해당) |
| 상태 | **PASS** — 사람 실기 1건(ΔV4 공간 변화 0) 추가, r1의 AC2·AC13 실기는 계속 대기 |
| 자기 검증 여부 | **예** — 설계·구현·검증 모두 Claude. 보고에 없는 축 10건 + 형제 슬롯 맞바꿈 2건 + §10 독립 재열거를 §4에 넣었다 |

## 0. 기준선 / plan 변경 확인

- 기준선은 diff로 성립한다. 세 ΔV 모두 설계 커밋이 구현 커밋보다 먼저, 따로 있다.
- 구현 커밋 3개의 `plan.md` 변경은 **`[구현자 기입]` 절 삽입뿐**이다(각 hunk 1개, 삭제 0줄). 메타·Decision·AC·V 행 변경 없음.
- Decision Ledger: D-011~D-014 추가, 모두 사용자 원문 인용 + 별도 설계 커밋. D-014가 ΔV2 AC20의 '최초 열기'를 대체한다고 명시.
- 채점 기준: ΔV2 AC18~22 · ΔV3 AC23~25 · ΔV4 AC26~29(AC20은 재시도 경로만 유지) · VP-16·21~25 · EP-4(35)·16~20.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 각 ΔV가 기준 revision(`V1+ΔV1` → `+ΔV2(r1.2)` → `+ΔV3`)을 명시 |
| NEW/CHANGED ↔ REQUIRED | 유효 | R-12·13·14·15 NEW → VP-21·22·24·25, MD-05 → VP-23, AR-03 CHANGED → VP-16, ΔV4 R-13 CHANGED → VP-22 REQUIRED |
| INHERITED ↔ REGRESSION | 유효 | VP-02(ΔV2) · VP-21·22(ΔV3) REGRESSION. VP-06 NOT_REQUIRED 사유(모델 무변경) — diff에서 `errorToastModel.ts` 변경 0 확인 |
| path·§10·oracle | 유효 | 각 pair에 EP 자리 수와 직접 oracle |
| 선택 적대 증거 | 유효 | VP-21·22·24·25 required, VP-23 not selected(직접 결과 단언) |
| `SUPERSEDED`/대체 이관 | 유효 | AC20 최초 열기 → AC26, 재시도 닫기+toast는 VP-22에 잔존 |
| 운영 gate | 유효 | V1 §19 승계(lint·typecheck·관련/전체 vitest·inventory) |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-011 | 불가를 미리 표시하지 않고 동작 시 toast | `ArtifactCard` 상태 줄 = `file?.busy && transcript`만(`ArtifactCard.tsx:126`) · 동작 → `ArtifactCards.run` → `reportArtifactIssue` |
| D-012 | 새로 고침 제거, 비활성은 busy만 | `disabled = !!file?.busy`(`:33`) · `onRefresh` prop·메뉴 0건 |
| D-013 | 생성 파일 포함, `skipped`·`file-changed` 보고 | `artifactOperationIssues` skipped 포함 · main `reasonOf` 허용 목록 `file-changed` · 제목 `fileUnavailable`/문구 `chat.artifacts.changed` |
| D-014 | 결과 후에만 공간 할당, 대기 중 카드 busy | `openArtifactViewer`: `opening` → preview → `blocked`면 toast만, 아니면 `selection` 1회 · `ArtifactCards:38` selector → `ArtifactCard aria-busy` |

```text
카드 동작 → ArtifactCards.run → runArtifactAction(IPC) → artifactOperationIssues → reportArtifactIssue → reportError → 로그 + ErrorToastHost
카드 미리보기 → openArtifactViewer → opening(카드 aria-busy) → artifacts.preview → blocked? toast : selection(뷰어)
뷰어 재시도(ImagePreview) → retryArtifactViewer → readSelection → blocked? selection null + toast
뷰어 복사/다운로드 → useArtifactViewerActions.runAction → reportError / reportArtifactIssue
작업 컨텍스트 경로 열기 → openContextPath catch → reportError(T34)
```

- 소비자 전수: `openArtifactViewer` 호출 2곳(`ArtifactCards:115`·카탈로그 `useArtifactCatalogViewer:43`), `ArtifactCards` 렌더 2곳(`AssistantTurn:63`·`TaskOutputContent:49`), 외부 store 쓰기 0.

## 2. 구현 비판적 검토 — AC 전에

| 축 | 판정 | 관측 |
|---|---|---|
| false success | 없음 | `busy` 사유만 보고 생략(`ArtifactCards.tsx:62`) — 진행 중 동작이라 실패가 아님, X7로 잠김 |
| 늦은 응답 | 정상 | `opening.request` 불일치면 무시(`artifactViewerStore.ts:86`), X3 red 4 |
| 세션 이탈 후 결과 | 의도대로 보고 | 카드 동작은 generation 토큰을 없애 세션을 떠나도 toast — 사용자가 요청한 동작(lifecycle 테스트 'late failure after the session changes') |
| 원시 오류 노출 | 없음 | detail은 카탈로그 문구만. store 테스트가 `private path` 미포함 단언 |
| 무한 대기 | ⚠️ | preview가 끝나지 않으면 카드가 계속 busy, 같은 파일 재클릭은 무시된다 → D11 |

## 3. 역방향 탐색

- 제거된 표면의 잔존 참조: `onRefresh`·`present`·`checking` in `ArtifactCard.tsx` 0건. `retryArtifactViewer`는 `ArtifactPreviewContent.tsx:45`(이미지 디코드 재시도)가 production 호출자로 남아 `readSelection`은 배선돼 있다.
- 죽은 i18n 키: `chat.artifacts.checking` production 참조 0 → D12.
- 현재 상태 문서: `docs/arch/frontend/rendering.md:206`이 "다시 확인 액션 공유 · 파일 없음과 접근 오류를 구분"을 여전히 서술 → D10.
- 테스트만 부르는 신규 심볼: 없음. `ArtifactViewerOpening`·`opening`은 store·카드·카탈로그가 소비.

## 4. semantic 검증 — 변이 재측정

- 스크립트로 소스를 바꾸고 `vitest run features/chat shared/errors main/app/handlers/artifacts.test.ts app` 실행 후 `git checkout`. 종료 후 트리 깨끗.
- **등록 변이 15/15 red.** 자리 미지정 VP-21(b)는 비활성 4자리에 각각 심었다.
- **독립 축 10건 중 red 8 · green 2**(X4 → D8, X5 → D9). 형제 슬롯 맞바꿈 2/2 red.
- **이전 라운드 red 재실행**: 이번 변경이 닿은 레지스트리 변이 4건 전부 red → 덮개 회귀 0.

| 변이 | 결과 | 귀속 |
|---|---|---|
| V21a 상태 줄 조건 원복(`!present` 시 표시) | red 2 | VP-21(a) |
| V21b 다운로드 버튼 `\|\| !present` | red 3 | VP-21(b) 자리 1 |
| V21b 메뉴 저장 / 위치 열기 / 휴지통 각각 | red 2 / 2 / 2 | VP-21(b) 자리 2~4 |
| V22 카드 `reportArtifactIssue` 삭제 | red 2 | VP-22 ArtifactCards |
| V22 store `blocked` 보고 삭제 | red 3 | VP-22 readSelection |
| V22 뷰어 catch `reportError` 삭제 | red 4(레지스트리 포함) | VP-22 viewer actions |
| V22 뷰어 다운로드 결과 보고 삭제 | red 1 | VP-22 viewer actions |
| V22 TaskContext `reportError` 삭제 | red 3(레지스트리 포함) | VP-22 TaskContext |
| V24 `skipped` 필터 제거 | red 2 | VP-24 |
| V24 `reasonOf`에서 `file-changed` 제거 | red 1 | VP-24 |
| V24 제목 목록에서 `file-changed` 제거 | red 1 | VP-24 |
| V25a 대기 전 로딩 selection 선할당 | red 6 | VP-25(a) |
| V25b close의 `opening` 해제 제거 | red 3 | VP-25(b) |
| X1 `artifactFailureKey`의 `file-changed` 문구 제거 | red 1 | 독립(AC25 문구) |
| X2 같은 파일 대기 중 재클릭 중복 방지 제거 | red 1 | 독립(AC29) |
| X3 결과 후 `opening.request` 검사 제거 | red 4 | 독립(AC28) |
| X4 카탈로그 이탈 정리에서 `opening` 제외 | **green** | D8 |
| X5 카드 busy selector의 `sessionKey` 조건 제거 | **green** | D9 |
| X6 재시도 불가 시 뷰어를 닫지 않음 | red 1 | 독립(ΔV4 재시도 유지) |
| X7 `busy` 사유 생략 제거 | red 1 | 독립 |
| X8 `skipped` 무사유 기본값 `missing` 제거 | red 1 | 독립(AC23) |
| X9 열 수 있는 결과를 `loading:true`로 할당 | red 9 | 독립(AC27) |
| X10 `unsupported-format`도 차단 | red 2 | 독립(AC20 형식 미지원 유지) |
| S1 T34↔T35 event 맞바꿈 | red 2 | 형제 슬롯 |
| S2 T34↔T35 title 맞바꿈 | red 5 | 형제 슬롯 |
| P T18 삭제 · T32 삭제 · `useSkills` catch 주입 · T15/T16 맞바꿈 | red 3 · 2 · 2 · 3 | r1 red 재실행 |

- 구현 보고 대조: 보고 M1~M11·Ma~Md는 위 V/S 행과 같은 결과. 보고의 `Criteria-Met` 5/5·3/3·4/4는 본문 합계·trailer에서 같은 값이다.

## 5. V-pair closeout

| Pair | 레벨 | 판정 | 증거 |
|---|---|---|---|
| VP-23 MD-05↔UT-05 | UT | PASS | `artifactIssueReport.test.ts` 3건 — 사유별 제목·detail·로그 data |
| VP-16 AR-03↔IT-03 | IT | PASS | 레지스트리 T34·T35 행, V22 catch 삭제·S1·S2 red |
| VP-21 R-12↔AT-12 | AT | PASS | render 테스트: 세 availability × 두 variant × 두 category 문구·`disabled` 0, busy → 비활성. V21 5자리 red |
| VP-22 R-13↔AT-13 | AT | PASS | lifecycle(AC19) · store(AC20 재시도) · actions(AC21) · TaskContext(AC22). V22 5자리 red |
| VP-24 R-14↔AT-14 | AT | PASS | operationIssues·helper·handlers·lifecycle skipped 케이스. V24 3자리 + X1·X8 red |
| VP-25 R-15↔AT-15 | AT | PASS | store 구독 기록(AC26 0건·AC27 1회)·AC28 close/대체·AC29 render·lifecycle. V25a·b + X2·X3·X9 red |
| VP-02 (REGRESSION) | AT | PASS | 새 경로 전부 `reportError` 경유 — helper 테스트 로그 3건, store 테스트 `artifacts.preview.failed` 1건 |
| VP-21·22 (ΔV3 REGRESSION) | AT | PASS | 위 VP-21·22 증거 공유, `category:'file'` 반복 포함 |

- REQUIRED/REGRESSION 8행 PASS · PAIR_FAIL 0 · BLOCKED_BY 0. VP-06은 NOT_REQUIRED(모델 파일 변경 0).

### AT / AC 합계

| AC | 판정 | 관측 |
|---|---|---|
| AC18 | ✅ | render 'does not reveal … ahead of an action' 2 variant |
| AC19 | ✅ | lifecycle 7 결과 케이스, 인라인 목록 0(`children` 길이 2) |
| AC20 | ✅ | 재시도 불가 → selection null + toast 2, 형식 미지원 본문 유지·toast 0 |
| AC21 | ✅ | actions 테스트 copy/download 실패 toast |
| AC22 | ✅ | TaskContext 테스트 + 레지스트리 T34 |
| AC23 | ✅ | skipped 보고, 무사유 → `missing` |
| AC24 | ✅ | render `category:'file'` 반복 |
| AC25 | ✅ | helper `file-changed` 제목·문구 + handlers 보존 |
| AC26 | ✅ | 구독 기록 0 · 기존 selection 동일 참조 |
| AC27 | ✅ | 대기 중 null → 1회 설정 `loading:false` |
| AC28 | ✅ | close 후·다른 파일 열기 후 늦은 결과 무시·toast 0 |
| AC29 | ✅ | 대기 카드만 `aria-busy="true"`, 재클릭 preview 1회 |

- 합계: ✅ 12 · ⚠️ 0 · ❌ 0 = 12(구현자 자기보고 5+3+4=12와 일치).

## 6. §10 강제 지점 독립 재열거

| EP | 보고 | 재측정 | 관측 |
|---|---|---|---|
| EP-16 | 5/5 | 5/5 | `ArtifactCard.tsx` 상태 줄 `:126` 1 + `disabled={disabled}` `:95`·`:140`·`:150`·`:161` 4 |
| EP-17 | 4/4 | 4/4 경로 · 호출 5 | ArtifactCards 1 · store `blocked` 1 · viewer actions 2 · TaskContext 1 |
| EP-18 | 1/1 | 1/1 | `reportArtifactIssue` 사용 3곳. catch 2곳의 직접 `reportError`는 V1 레지스트리가 catch 본문 식별자를 요구해서다 |
| EP-19 | 3/3 | 3/3 | skipped 필터 1 · `reasonOf` 1 · 제목 집합 1(+문구 매핑 1) |
| EP-20 | 3/3(+카탈로그 1) | 3/3 + 1 | store의 `selection:` 쓰기 7곳 중 새 selection 생성은 결과 뒤 open 1·재시도 1뿐. 카탈로그 1은 표 밖이고 미잠금(D8) |
| EP-4 | 35 | 35 | 레지스트리 T34·T35 CONSUMED → TOAST |

## 7. 게이트 재실행

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | exit 0, `error TS` 0 |
| lint | PASS | 0 error · 1 warning(`useTranscriptVirtualizer.ts:22`, diff 밖). 실행 후 `git status` 변경 0 |
| 관련 vitest | PASS | 219파일 1855케이스 전건 |
| 전체 vitest | PASS(환경 분리) | 594파일: 585 pass · 1 skip · 8 로드 실패, 5629 pass · 0 fail. 8파일은 전부 `src/main/app/**` `Electron failed to install correctly` |
| 환경 분리 근거 | — | 기준 `9e45618` worktree에서 `bootstrap.artifacts`·`send.busy` 2/2 같은 서명으로 실패 |
| inventory | PASS | `check-doc-inventory.mjs --check` generated·prose·links ok |
| trailer | PASS | 6커밋 전부 파싱(설계 5키 · 구현 7키), 값 허용 범위 |

- 잔여물: scratchpad의 기준 worktree는 제거(`git worktree list` 1행). 변이 스크립트는 scratchpad에만 있다.

## 8. 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| ΔV4 플리커 | store 구독 기록으로 selection 변화 0 | 실제 창에서 없는 파일 미리보기 시 우측 공간 변화 0 · toast 1 |
| r1 AC2·AC13 | r1 §8 그대로 | 계속 대기 |

## 9. Repository operation checks

- AGENTS.md 변경 없음.
- INDEX 대상 커밋 `(… — 검증자 기입)`을 `1ba1522`·`721fb38`·`29ac36a`·`8fdfafe`로 채운다(4건 `git cat-file -t` = commit).
- `[구현자 기입]` r1.2·r1.3·r1.4 각 7필드 존재. 구현 보고 좌표는 자리표시자로 둔 채 INDEX로 위임 — 규칙과 일치.

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D8 | 카탈로그 이탈 정리가 대기 중 `opening`도 취소하는 코드(`useArtifactCatalogViewer.tsx:37-39`)를 잠그는 테스트가 없다(X4 green). 현재 동작은 정상 | §10 표 밖, AC28은 store `close`로 충족 | NON_BLOCKING | 카탈로그 hook 정리 테스트 1건 검토 |
| D9 | 카드 busy selector의 `sessionKey === activeKey` 조건이 미잠금(X5 green) | AC29는 다른 publication 기준으로 충족 | NON_BLOCKING | 같은 publicationId·다른 key 케이스 1건 |
| D10 | `docs/arch/frontend/rendering.md:206`이 제거된 "다시 확인" 액션과 파일 없음/접근 오류 구분 표시를 현재 상태로 서술 | 운영 규칙(arch = 현재 상태), gate 밖 | NON_BLOCKING | 다음 커밋에서 문장 정정 |
| D11 | preview가 끝나지 않으면 카드가 계속 busy이고 같은 파일 재클릭이 무시된다. 대기 중 기존 뷰어를 닫으면(같은 key) 대기 열기도 취소된다 | ΔV4 설계대로의 부작용 | NON_BLOCKING | 대기 상한·취소 UX는 필요 시 사용자 판단 |
| D12 | `chat.artifacts.checking` 키 production 참조 0 | 비귀속 | NON_BLOCKING | 죽은 키 정리 |

- 구현자 보고 잠재 문제(r1.2 #1~3 · r1.3 #1 · r1.4 #1)는 재현 확인만 했고 판정을 바꾸지 않는다.

## 14. Review Signals — 사실만

- ΔV2~ΔV4 모두 사용자 요구 변경이며 이전 라운드 결함 수정이 아니다.
- ΔV4는 ΔV2 AC20이 최종 상태만 단언해 중간 공간 할당을 놓친 것을 사용자 실기가 잡아 생겼다.
- 반복 환경 한계: electron 바이너리 미설치로 main app 8파일 로드 실패(r1과 동일).

## 15. 결론

- 상태: **PASS**.
- pair: REQUIRED/REGRESSION 8/8 PASS · PAIR_FAIL 0 · PLAN_GAP 0.
- AC18~29: ✅ 12 · ⚠️ 0 · ❌ 0.
- 변이: 등록 15/15 red · 독립 10축 중 8 red · 형제 맞바꿈 2/2 red · r1 red 재실행 4/4 red.
- 비차단: D8~D12.
- 다음 단계: 사람 실기(ΔV4 플리커 · r1 AC2·AC13) 뒤 archive 이동.

# r1.5 검증 — ΔV5

> V1~ΔV4 판정은 위 r1·r1.4 본문 그대로 유효하다. 이 절은 ΔV5(D-015~D-019, AC30~38)와 구현 r1.5만 채점한다.

## 메타

| 항목 | 값 |
|---|---|
| 일자 | 2026-09-28 |
| 대상 커밋/range | `077a838..9b9c4ed` — 설계 `368358f`, 구현 `9b9c4ed` |
| 구현 전 plan 기준 | `368358f` |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1 … ΔV4 + ΔV5@368358f` |
| 라운드 | 1 (r1.5는 사용자 요구 변경 impl 턴 — review 트리거 미해당) |
| 상태 | **PASS** |
| 자기 검증 여부 | **아니오** — 구현 Codex(`Agent: codex`), 검증 Claude. 그래도 보고에 없는 독립 축 19건과 §10 재열거를 넣었다 |

## 0. 기준선 / plan 변경 확인

- 기준선은 diff로 성립한다. 설계 `368358f`가 구현 `9b9c4ed`보다 먼저, 따로 있다.
- 구현 커밋의 `plan.md` 변경은 메타 `상태` 행 1줄과 `[구현자 기입]` 절 삽입뿐이다. Decision·AC·V·§10 행 변경 0.
- 채점 기준: ΔV5 AC30~38 · VP-26~30 · VP-06·15(CHANGED) · VP-11·08·02(REGRESSION) · EP-21~25.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효(좌표 결함은 D15) | 기준 revision `ΔV4 r1.4 PASS`를 명시. 인용 해시는 리베이스 전 값이라 죽었으나 subject로 `077a838` 특정 가능 |
| NEW/CHANGED ↔ REQUIRED | 유효 | R-16·17·SD-03·AR-04·MD-06 NEW → VP-26~30, R-06·AR-02 CHANGED → VP-06·15 |
| INHERITED ↔ REGRESSION | 유효 | VP-11(IPC 문서)·VP-08(카드 시각)·VP-02(로그 동반) |
| path·§10·oracle | 유효 | 각 pair에 EP 자리 수와 직접 oracle |
| 선택 적대 증거 | 유효 | VP-26~29 required(자리 명시), VP-30 not selected(직접 결과 단언) |
| 운영 gate | 유효 | V1 §19 승계 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-015 | 설명 최대 8줄, 초과 `…`, 제목 그대로 | `ErrorToastHost.tsx:43` 설명 `<p>`만 `line-clamp-8` |
| D-016 | 본문 클릭 → 지정 page/settings, 그 카드 닫기 | Host 본문 button(`:23-29`) → `ErrorToastLayer` → `openErrorTarget` → `navigate`/`useOpenSettings` |
| D-017 | 대상 없음 → 탐색기에서 로그 파일 | `errorApi.revealLog` → preload → `orca:error:revealLog` → `flushLogSync` → `showItemInFolder(currentLogFilePath())` |
| D-018 | warning·fetcher 범위 밖 | 변경 0 |
| D-019 | 기존 사이트 대상 미지정 | 비테스트 코드에서 `target:`을 넘기는 `reportError`/`publishErrorReport` 호출 0 |

```text
reportError({target?}) renderer ─→ presentErrorReport → errorToastStore(applyErrorReport: 신규 spread / 병합 교체)
reportError·publishErrorReport main ─→ hub(sink | pending) → sink send / drain → bridge present ─┘
  → ErrorToastHost 본문 button click → onOpen(target) · dismiss(id)
  → ErrorToastLayer → openErrorTarget: page → navigate · settings → show(tab) · 없음/무효 → revealLog
       revealLog reject → reportError('errors.reveal-log.failed', openFailed)
```

## 2. 구현 비판적 검토 — AC 전에

| 축 | 판정 | 관측 |
|---|---|---|
| false success | 없음 | 폴더 열기 오류 문자열 → throw → renderer reject → toast+로그(AC33·36). `showItemInFolder`는 반환값이 없어 실패 관측 불가(구현자 보고 #3) |
| 무효 대상 | 안전 | 런타임 가드 실패 → 로그 위치. `//x`·상대 경로·잘못된 탭·비객체 10사례 |
| 게이트 화면 | ⚠️ | `RootGate`가 Boot/Gate frame일 때 `AppLayout`·`SettingsModal`(사이드바 footer에만 mount)이 없어 page/settings 대상 클릭은 보이는 변화 없이 카드만 닫힌다 → D13. 현재 대상 지정 호출부 0 |
| 오류 문구 | ⚠️ | 폴더 열기 실패 toast 설명은 Electron 래퍼(`Error invoking remote method 'orca:error:revealLog': Error: …`)를 포함한다 → D14 |
| 병합·중복 | 계약대로 | 키 = 제목+설명(target 제외). hub 1초 dedupe도 target을 보지 않아 같은 문구·다른 대상의 두 번째 보고는 버려진다 — plan "키·cooldown 불변"과 일치 |

## 3. 역방향 탐색

- `scan-surface.sh 368358f..9b9c4ed`: 1a·1b·2 후보는 전부 이번 diff가 추가하지 않은 기존 심볼. 형제 비대칭 0.
- 신규 export 5개(`logFilePath`·`currentLogFilePath`·`errorApi`·`openErrorTarget`·`ErrorToastLayer`)는 모두 production 호출자가 있다.
- 테스트의 동명 재구현: 없음. Layer·handler 테스트는 production `ErrorToastLayer()`·`registerErrorHandlers()`를 직접 부른다.

## 4. semantic 검증 — 변이 재측정

- 구현자 runner를 scratchpad 사본(출력 경로만 교체)으로 실행, 각 변이 뒤 원본 복원. 종료 후 `git status` 깨끗.
- **등록·보고 변이 18/18 red** — 실패 수까지 구현자 `r1.5-mutations.json`과 동일.
- **독립 축 19건 19 red** (관련 34파일 스위트, 로드 실패 0).
- **이전 라운드 red 재실행**: 이번 변경이 닿은 모델·Host·bridge 변이 4건 전부 red → 덮개 회귀 0. r1 X8(`key`의 `seq` 제거, green → D2)은 이번에 red → **D2 closed**.

| 변이 | 결과 | 귀속 |
|---|---|---|
| VP-26 clamp 설명→제목 맞바꿈 | red 1 | VP-26 |
| VP-27 a 본문 dismiss 삭제 · b ×가 onOpen · c page/settings 맞바꿈 · d 가드 삭제 | red 2 · 1 · 1 · 8 | VP-27 |
| VP-28 renderer · main · publish · 이벤트 · drain 자리 target 누락 | red 1 · 2 · 2 · 1 · 1 | VP-28 5자리 |
| VP-29 flush 삭제 · Layer no-op | red 2 · 1 | VP-29 |
| mount 제거 · animation key · preload 채널 · API no-op | red 2 · 4 · 1 · 2 | 구현자 신규 oracle |
| VP-02 a·b | red 1 · 1 | VP-02 REGRESSION |
| X1 settings 탭 가드 제거 · X2 `//` 가드 제거 | red 1 · 1 | 독립(AC32 가드 2축) |
| X3 병합 시 없음이면 이전 target 유지 · X4 병합 교체 안 함 | red 1 · 1 | 독립(AC35) |
| X5 신규 카드 spread에서 target 제거 | red 3 | 독립(EP-23 model 자리) |
| X6 파일 선택 대신 openPath(file) · X7 openPath 오류 무시 · X8 존재 검사 반전 | red 1 · 1 · 3 | 독립(AC36) |
| X9 Host가 `toasts[0].target` 전달(형제 카드 맞바꿈) | red 1 | 형제 슬롯 |
| X10 reveal 실패 title 변경 · X11 reveal 실패 보고 삭제 | red 1 · 1 | 독립(AC33) |
| X12 fallback 파일명 drift(`app.jsonl`) | red 1 | 독립(경로 SSOT) |
| X13 hub pending · X14 sink send · X15 `presentErrorReport`에서 target 제거 | red 1 · 1 · 2 | 독립(EP-23 중간 운반 자리) |
| X16 clamp 8→3 · X17 본문 button→div | red 1 · 2 | 독립(AC30·31) |
| X18 Layer settings를 navigate로 · X19 유효 대상 뒤 `return` 삭제(revealLog 동반) | red 1 · 2 | 독립(AC37·32) |
| P 병합 만료 재설정 삭제 · 다크 `--shadow-toast` 삭제 · drain을 구독보다 먼저 · `motion-reduce` 삭제 | red 2 · 1 · 1 · 1 | 이전 라운드 red 재실행 |

## 5. V-pair closeout

| Pair | 레벨 | 판정 | 증거 |
|---|---|---|---|
| VP-30 MD-06↔UT-06 | UT | PASS | 모델 테스트: 500ms 동일 참조 · 1200ms 교체 · 2400ms 제거, id·key·카드 수 불변. X3·X4 red |
| VP-06 (CHANGED) | UT | PASS | 기존 cap·cooldown·만료 테스트 + P 만료 변이 red |
| VP-29 AR-04↔IT-04 | IT | PASS | handler 3건(순서 flush→exists→select · 폴더 · reject) · preload 채널 · Layer deps. 등록 2 + X6~8·X18 red |
| VP-15 (CHANGED) | IT | PASS | `App.projects` 트리에 `ErrorToastLayer` · render 테스트 `<ErrorToastHost` 직접 mount 0. mount 제거 red |
| VP-28 SD-03↔ST-03 | ST | PASS | reporter 단위 + main hub→drain/sink→bridge→store 통합. 5자리 + 중간 자리 X5·X13~15 red |
| VP-26 R-16↔AT-16 | AT | PASS | 클래스 단언 + **Chromium 실측**(§8). 맞바꿈·X16 red |
| VP-27 R-17↔AT-17 | AT | PASS | Host actions 4 · target 12. 7자리 + X1·2·9·10·11·17·19 red |
| VP-11 (REGRESSION) | AT | PASS | `ipc-documentation.test.ts` 3 pass · inventory 100채널 |
| VP-08 (REGRESSION) | AT | PASS(기계 범위) | render 테스트 grid·반경·그림자·alias 유지, P 다크 그림자·motion 변이 red. Chromium 캡처에서 아이콘·제목·× 열 유지. 두 테마 시각은 r1 AC13 실기 그대로 |
| VP-02 (REGRESSION) | AT | PASS | reveal 실패 로그 1(AC33) · VP-02 a·b red |

- REQUIRED 7 · REGRESSION 3 = 10행 PASS · PAIR_FAIL 0 · BLOCKED_BY 0.

### AT / AC 합계

| AC | 판정 | 관측 |
|---|---|---|
| AC30 | ✅ | 설명만 `line-clamp-8`. Chromium 900×670 실측: 300자 3장 모두 8줄·`…`, 카드 189px, 셋째 하단 ≈622px |
| AC31 | ✅ | page/없음 카드 각 onOpen 1·그 카드만 제거, × onOpen 0 |
| AC32 | ✅ | page 1 · settings 3형태 · 없음/무효 10사례 → revealLog 1 |
| AC33 | ✅ | reject → store `openFailed` 1 · 로그 `errors.reveal-log.failed` 1 |
| AC34 | ✅ | renderer·main·publish 단위, 통합의 drain(page)·이벤트(settings) 보존 |
| AC35 | ✅ | 교체·제거, 키·카드 수 불변 |
| AC36 | ✅ | handler 3건 |
| AC37 | ✅ | App Layer 1, Layer deps = 실제 `show`·`errorApi.revealLog`·navigate |
| AC38 | ✅ | IPC 문서 테스트 · inventory `--check` ok |

- 합계: ✅ 9 · ⚠️ 0 · ❌ 0 = 9.
- 자기보고 `8/9`(본문·trailer·INDEX 동일)와 다르다 — 차이는 AC30 하나이며, 구현자가 사람 실기로 남긴 레이아웃을 검증자가 Chromium으로 실측해 닫았다.

## 6. §10 강제 지점 독립 재열거

| EP | 보고 | 재측정 | 관측 |
|---|---|---|---|
| EP-21 | 1/1 | 1/1 | `ErrorToastHost.tsx:43`. renderer의 다른 `line-clamp`는 무관 컴포넌트 |
| EP-22 | 7/7 | 7/7 | Host `:27` onOpen · `:28` dismiss · `:52` × · target `:33` page · `:34` settings · `:38` 없음 · `:10-25` 가드 |
| EP-23 | 18 | 5/5 + 중간 5 | 명시 5자리(`reportError.ts:38` · main `:41` · `:70` · bridge 이벤트·drain 객체 통과). 표 밖 운반 자리 model 신규 spread·hub pending·sink·present·병합 모두 변이 red |
| EP-24 | 12 | 5/5 | `shared/ipc.ts:22` · `preload:121` · `api/ipc.ts:97` · `handlers/error.ts:13` · `ErrorToastLayer.tsx:13` |
| EP-25 | 1/1 | 1/1 | `errorToastModel.ts:25` |

- 구현자는 EP-23·24를 전달 지점까지 펼쳐 세었다(18·12). 계약 자리 기준으로는 5·5이며 차이는 세는 단위뿐이다.

## 7. 게이트 재실행

| Gate | 결과 | 관측 |
|---|---|---|
| install | — | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` exit 0. 뒤이어 `npm rebuild better-sqlite3`(Node ABI) |
| typecheck | PASS | node/web/test 3구성, `error TS` 0 |
| lint | PASS | 0 error · 1 warning(`useTranscriptVirtualizer.ts:22`, diff 밖). 실행 후 `git status` 변경 0 |
| 전체 vitest | PASS(환경 분리) | 599파일: 591 통과 · 8 로드 실패, 5657케이스: 5654 pass · 0 fail · 3 skip |
| 환경 분리 근거 | — | 8파일 전부 `src/main/app/**` `Electron failed to install correctly`(r1.4와 같은 서명·파일군). skip 3 = opt-in live SDK 1 + Windows 전용 경로 2 |
| 관련 스위트 | PASS | 변경 테스트 17파일 전건 pass(위 전체 실행 내) |
| inventory | PASS | `check-doc-inventory.mjs --check` generated(100채널)·prose·links ok |
| trailer | PASS | `368358f` 5키 · `9b9c4ed` 6키 파싱, 값 허용 범위 |

- 잔여물: `app/node_modules`(gitignore), scratchpad의 변이 runner·Chromium 하네스. 추적 트리 변경 0.

## 8. 사람 실기 — Chromium 실측으로 줄인 범위

- 하네스: 실제 `ErrorToastHost` + `app.css`(Tailwind v4 빌드) + i18n을 vite로 묶어 Chromium 141 headless에서 렌더. 카드 rect·설명 `clientHeight/scrollHeight`·computed `-webkit-line-clamp`을 측정.
- 300·300·300자: 세 카드 모두 8줄(설명 140px, scroll 175px), 제목 clamp `none`, 본문 button 417px · × 열 24px 유지. 캡처는 [`evidence/r1.5-verify-ac30-chromium.png`](evidence/r1.5-verify-ac30-chromium.png).
- 232·240·120자: 232자는 8줄에 딱 맞아 말줄임 없음 — plan 실측 "232자 초과"와 일치.

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| AC30 | Chromium 레이아웃·말줄임·3장 높이 | Windows 실제 글꼴에서 한 번 눈으로(줄 높이는 고정이라 높이는 같다) |
| D-017 탐색기 | handler 호출 순서·인자 | 실제 탐색기 창에 `application.jsonl` 선택 표시 |
| r1 AC2·AC13 · ΔV4 공간 변화 | 이전 라운드 그대로 | 계속 대기 |

## 9. Repository operation checks

- AGENTS.md 변경 없음. 증거 JSON에 로컬 사용자 경로·이메일 0.
- **INDEX 대상 커밋 좌표 11건이 전부 죽은 해시였다**(`git cat-file` 실패, 리베이스 전 값). 공유 브랜치 커밋과 subject·순서·Status trailer로 대조해 교정했다 → D15.
- 교정표: `abb4e49`→`c6cb383` · `318fecc`→`4424dd1` · `55f6e88`→`bcabba8` · `9e45618`→`5f4b5bc` · `033e314`→`3c918ce` · `2786ed8`→`6f5a5ef` · `1ba1522`→`ba52b9f` · `721fb38`→`053869a` · `29ac36a`→`4afa4d0` · `8fdfafe`→`6865182` · `ef3cd63`→`077a838`. 이번 라운드 `368358f`·`9b9c4ed` 기입.
- `[구현자 기입]` r1.5 7필드 전부 존재, 구현 보고 좌표는 자리표시자 — 규칙과 일치.
- 설계 커밋 `368358f`는 제목과 본문 사이 빈 줄이 없어 `%s`가 본문까지 삼킨다. trailer 파싱은 정상 → D16.

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D2 | Host key 미잠금 | r1 | **closed** | `ErrorToastHost.actions.test.ts` key 단언, `seq` 제거 변이 red 4 |
| D13 | Boot/Gate frame에서는 `AppLayout`·`SettingsModal`이 없어 page/settings 대상 클릭이 보이는 변화 없이 카드만 닫는다 | D-016, 현재 대상 호출부 0(D-019) | NEXT_HANDOFF | 첫 대상 지정 호출부를 넣을 때 게이트 중 동작 결정 |
| D14 | 로그 폴더 열기 실패 toast 설명에 Electron invoke 래퍼 문구가 붙는다 | AC33 충족, 문구 품질 | NON_BLOCKING | 래퍼 제거 여부 검토 |
| D15 | INDEX 좌표 11건과 plan 메타 `V1@abb4e49a`·`ef3cd63`이 리베이스 전 해시 | 운영 규칙(좌표) | NON_BLOCKING | INDEX는 이번에 교정. plan 메타 2곳은 설계자 다음 revision에서 정정 |
| D16 | `368358f` 제목·본문 사이 빈 줄 누락 | 커밋 형식 | NON_BLOCKING | 기록 |

- D1·D3~D12는 이번 변경 범위 밖이라 상태 유지. 구현자 잠재 문제 #3(`showItemInFolder` 성공 미관측)은 §8 실기로 남긴다.

## 14. Review Signals — 사실만

- ΔV5는 사용자 요구 변경이며 이전 결함 수정이 아니다.
- 구현자는 AC30 레이아웃을 사람 실기로 남겼고, 검증자는 Chromium 하네스로 기계 측정했다.
- 좌표 죽음은 0237 D17과 같은 증상(리베이스 뒤 INDEX 해시 미갱신)이다.
- 반복 환경 한계: electron 바이너리 미설치로 main app 8파일 로드 실패(r1·r1.4와 동일).

## 15. 결론

- 상태: **PASS**.
- pair: REQUIRED/REGRESSION 10/10 PASS · PAIR_FAIL 0 · PLAN_GAP 0.
- AC30~38: ✅ 9 · ⚠️ 0 · ❌ 0.
- 변이: 등록·보고 18/18 red · 독립 19/19 red · 이전 red 재실행 4/4 red · D2 closed.
- 비차단: D13(NEXT_HANDOFF)·D14~D16.
- 다음 단계: 사람 실기(탐색기 선택 표시 · r1 AC2·AC13 · ΔV4 공간) 뒤 archive 이동.
