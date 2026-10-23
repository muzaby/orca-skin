# Verify — 0281-opencode-menu-cache

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0281-opencode-menu-cache` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | V1 `af7fb41..b687b1a` · ΔV1 `087543e..a082776`(0278 r2 커밋에 동봉) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `af7fb41` · ΔV1 `087543e` |
| V mode / 유효 V | Delta V / `V1@256ddd24 + ΔV1` |
| 라운드 | 1 (이 handoff의 verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — ΔV1 §10 고정 6자리 중 5자리에서 심은 고장이 전 스위트 green이었다.** 기본 에이전트 행 제거·heading busy 표시·캐시 재사용은 잠겼지만, `models` 대기만으로 에이전트 스피너가 켜지는 고장(AC5 명시 실패 조건)·회전 class 제거·Tab 닫기 제거·미선택 버튼에 첫 agent 표시·MenuTitle 순서 뒤집기를 어떤 테스트도 잡지 못한다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `b687b1a`·`a082776` 모두 `[구현자 기입]` 절 추가만(`git diff 087543e a082776 -- …/plan.md`의 `-` 줄 0).
- 기준선 diff 성립: 예 — V1 `af7fb41`, ΔV1 `087543e`가 구현과 분리된 설계 커밋.
- Decision Ledger: D3→D5 SUPERSEDED, D6 추가는 ΔV1 설계 커밋의 사용자 annotation 인용(2026-10-22). 구현자 변경 없음.
- AC·V pair·§10: 구현자 변경 없음. 채점 기준 = `087543e:docs/handoff/0281-opencode-menu-cache/plan.md`의 V1 AC1–3 + ΔV1 AC4–6·DV1-P1–P3·§10 6자리.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 `V1@256ddd24`, ΔV1 증분만 기록 |
| NEW node ↔ REQUIRED pair | 유효 | R2/SD2/AR2 ↔ DV1-P1–P3 REQUIRED |
| 영향 INHERITED ↔ REGRESSION | 유효 | V1 VP1–4 REGRESSION, 대체 단언(기본 행·스피너 금지)의 이관 명시 |
| §10 자리 목록 | 유효 | 기록된 `rg -n 'snapshot.agents\|OpenCodeAgentControl\|…'` 재실행: 비테스트 운반 자리 = 6자리 목록과 차집합 0 (`Controls.tsx:16-19,43,95,144,184,200` · `MenuItem.tsx:62`) |
| 선택 적대 증거 | 유효 | "선택 mutation 없음 — 상태별 DOM·입력·IPC 직접 단언" |
| SUPERSEDED 이관 | 유효 | V1 AC1의 기본 행 보존·스피너 금지 → AC4·5 |
| 운영 gate | 유효 | Vitest·typecheck·lint·build·문서 gate |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | 실제 production path |
|---|---|---|
| D1 | 팝업 새로고침 행 없음 | `Controls.tsx` onRetry 전면 제거, `[role="menuitem"]` 0 |
| D2 | 성공 목록 재사용 | `composerCatalogState.read` ready guard + 구독 공유 |
| D4 | 경로/세대 격리 | scope key·generation retire — V1 회귀 |
| D5 | agent loading 때만 제목 우측 스피너 | `ModeControl(snapshot.agents.status)` → `AgentControl.loading` → `OpenCodeSelect` → `MenuTitle.trailing` |
| D6 | 합성 '기본 에이전트' 행 없음 | `AgentControl.options = agents.map(...)` |

```text
Composer Module → OpenCodeModeControl(useComposerCatalog) → OpenCodeAgentControl
  → OpenCodeSelect(trigger label · Popover group aria-busy) → MenuTitle(label, trailing spinner) + menuitemradio
  → chatActions.setHarnessOptions({agent})
```

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 실패 방식 | ✅ | 실패 시 `{...slot, status:'error'}`로 성공 값 보존(`composerCatalogState.ts` catch) |
| false success | ✅ | cancel/error 결과를 빈 성공으로 저장하지 않음(`'status' in result` 분기) |
| A 대신 B | ⚠️ | 동작은 A. 다만 아래 §4의 다섯 자리는 B로 바뀌어도 잠금이 없다 |
| 캐시가 잃은 재검증 | ✅ | invalidation 이벤트 → epoch++·flight 초기화 유지 |
| 상한 | ✅ | 재개방 추가 IPC 0(Module.integration `toHaveBeenCalledTimes(2)`) |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 |
|---|---|---|
| `harness.defaultAgent` i18n 키 | 소비처 0 (`rg defaultAgent` → `ko.ts:479`·`en.ts:475`만) | 비귀속 — D6 |
| `useComposerCatalog().retry` | 상태 패널(`NativeResources.tsx`)만 소비 | 정상 |
| 계획된 신규 oracle `shared/ui/MenuItem.render.test.ts` | **파일 없음** | §10 seat 5 — D5 |
| `MenuTitle.trailing` 다른 소비처 | `Controls.tsx`만. trailing 미지정 heading 회귀는 M10 red로 확인 | 정상 |

## 4. 고장 내 보기

- 등록 변이 0(plan "선택 mutation 없음"). 아래는 §10 자리별 재량 고장. 직전 이력 없음(첫 verify).
- 환경: `npm rebuild better-sqlite3`(Node ABI)·electron 바이너리 설치 후 renderer 기준선 374파일/3060 green.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|---|
| M1 | `Controls.tsx:19` | 맞바꿈 | `snapshot.agents.status` → `snapshot.models.status` | features/chat+shared/ui 290파일 | **못 잡음** | — | seat 1 · DV1-P3 |
| M2 | `Controls.tsx:204` | 고정값 | `loading={status==='loading'}` → `false` | 동 | 잡음 | `Controls.interaction: …spinner only while loading` | seat 2 |
| M3 | `Controls.tsx:205` | 다른 값 | 합성 `{value:'', defaultAgent}` 행 재삽입 | 동 | 잡음 | Controls.interaction 6건·Module.integration | seat 2 |
| M4 | `Controls.tsx:95` | 다른 값 | `(value \|\| label)` → `(value \|\| options[0]?.label \|\| label)` | 동 | **못 잡음** | — | seat 3 · DV1-P1 |
| M5 | `Controls.tsx:151` | 빈 값 | `animate-spin motion-reduce:animate-none` → `''` | 동 | **못 잡음** | — | seat 4 · DV1-P1(AC5) |
| M6 | `Controls.tsx:114-117` | 제거 | `Tab` 닫기 분기 삭제 | 동 | **못 잡음** | — | seat 6 · DV1-P1(AC6) |
| M7 | `Controls.tsx:68` | 제거 | 빈 메뉴 group focus fallback 삭제 | 동 | 잡음 | `keeps an empty loading menu keyboard-accessible…` | seat 6 |
| M8 | `Controls.tsx:105` | 제거 | `aria-busy={loading}` 삭제 | 동 | 잡음 | `…spinner only while loading/error/ready` | seat 4 |
| M9 | `MenuItem.tsx:77-78` | 뒤집기 | trailing을 label 앞으로 | renderer 374파일 | **못 잡음** | — | seat 5 · DV1-P3 |
| M10 | `MenuItem.tsx:78` | 제거 | trailing 렌더 삭제 | renderer 374파일 | 잡음 | `…spinner only while loading` | seat 5 |
| M11 | `composerCatalogState.ts:82` | 고정값 | ready guard → `false` | features/chat 275파일 | 잡음 | `composerCatalogState: loads resource parts only for a panel subscriber…` | V1 VP4 |
| M12 | `composerCatalogState.ts:56` | 호출 대체 | 지연 dispose → 즉시 `dispose()` | 동 | 잡음 | Module.integration·`publishes agents before models and shares subscribers and remounts` | V1 VP2 |
| M13 | `composerCatalogState.ts:109` | 빈 값 | 오류 시 기존 value 버림 | 동 | 잡음 | `coalesces retry, keeps data on error…` | V1 VP4 |

- 검산: 시도 13 = 잡음 8 · 못 잡음 5 · 동치 0. 못 잡음 5건은 전부 §10 고정 목록 자리 → `PAIR_FAIL`, §13 D1–D5로 이관.
- 형제 슬롯 맞바꿈: M1(agents↔models slot) — 못 잡음.
- 동작 보존 추출 라운드 아님. 소거 변이 잔여물 진단 없음(typecheck 무관 자리).

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| V1 VP4 | UT | REGRESSION | PASS | M11·M13 red · main `session-context.test.ts`·handlers composer-catalog 24/24 |
| DV1-P3 | IT | REQUIRED | **PAIR_FAIL** | seat 1(M1)·seat 5(M9) 미잠금 |
| V1 VP3 | IT | REGRESSION | PASS | Module.integration 실제 ModeControl/EffortControl→hook→IPC, M3 red |
| DV1-P2 | ST | REQUIRED | BLOCKED_BY:DV1-P3 | IPC 2회·재개방 행 구성은 관측 PASS. "서로 다른 slot 결과의 제목 DOM"은 seat 1 root에 막힘 |
| V1 VP2 | ST | REGRESSION | PASS | M12 red, 재개방 `toHaveBeenCalledTimes(2)` |
| DV1-P1 | AT | REQUIRED | **PAIR_FAIL** | seat 3(M4)·seat 4(M5)·seat 6(M6) 미잠금 |
| V1 VP1 | AT | REGRESSION | PASS | 선택·키보드·초점 복귀·variant 기본값, M2·M3·M7·M8 red |

- 실행 구간: Controls.interaction은 실제 `OpenCodeSelect`·`MenuTitle`·`Popover`를 렌더하고 store·i18n만 mock. Module.integration은 실제 Module→hook→state→`window.orca.session.composerCatalog` spy.

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 선택·키보드·초점 | ✅ | `opens at the current agent, navigates with keys…`, variant Escape |
| AC2 재개방 재요청 없음 | ✅ | Module.integration 6회 재개방 후 `query` 2회, M12 red |
| AC3 캐시 격리·해제 | ✅ | M11·M13 red, session-context pass |
| AC4 합성 기본 행 없음 | ✅ | M3 red(7케이스) |
| AC5 agent loading만 제목 스피너 | ❌ | M1(models loading이 스피너를 켬)·M5(회전 class 제거) green |
| AC6 빈 메뉴 제목 유지·Escape/Tab·자동 선택 없음 | ❌ | M6(Tab)·M4(미선택 버튼에 첫 agent) green |

- 합계 재측정: `✅ 4 · ❌ 2 = 6`. 자기보고: V1 trailer `Criteria-Met: 3/3`(V1 범위), ΔV1은 0278 커밋 trailer `21/21`에 합산되어 0281 단독 값 없음 → 대조 불가.

### §10 강제 지점 분모

| 목록 | 자리 | 결과 |
|---|---|---|
| V1 EP1 (3) · EP2 (2) | Mode/Effort→Agent/Variant·Select, hook→state·ready→IPC | 5/5 PASS (M2·M3·M11·M12) |
| ΔV1 seat 1 | ModeControl→AgentControl status | PAIR_FAIL (M1) |
| ΔV1 seat 2 | AgentControl→Select options·busy | PASS (M2·M3) |
| ΔV1 seat 3 | trigger label | PAIR_FAIL (M4) |
| ΔV1 seat 4 | Select→MenuTitle indicator | PAIR_FAIL (M5; M8은 잡음) |
| ΔV1 seat 5 | MenuTitle 레이아웃 | PAIR_FAIL (M9; 계획 oracle 파일 부재) |
| ΔV1 seat 6 | focus/keyboard→onChange | PAIR_FAIL (M6; M7은 잡음) |

- ΔV1 1/6 PASS, V1 5/5 PASS. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | node·web·test 3구성 출력 0줄 |
| lint | PASS | 0 error · 2 warning(`opencode/transcript/Timeline.tsx`·`useTranscriptVirtualizer.ts` incompatible-library, 이번 diff 밖). 실행 후 `git status` 변화 없음 |
| renderer vitest | PASS | 374파일 / 3060케이스 green |
| main·shared·preload vitest | 환경 한계 | 465파일·5245케이스 중 15 red = 전부 Windows 전용(`C:/` 절대경로 fixture·`process.platform==='win32'` plugin gate). 0281 파일 무관 |
| Windows CI | PASS | run #853 `84fe913` success — HEAD와 docs 2파일만 다름 |
| doc inventory·links·migrations·budgets·scripts | PASS | inventory ok · 16 real-git suites ok · 142/142 |

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 제목 우측 스피너 위치·두 테마·reduced motion | DOM 포함 여부만(M5·M9가 green이라 회전·순서는 미잠금) | 실제 창에서 좁은 메뉴 제목 우측 회전 확인 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE`·다음 Claude 일치 → 이번 턴 `verify/FAIL`·Codex·라운드 2로 갱신.
- 대상 커밋 좌표 기입: `af7fb41`·`b687b1a`·`087543e`·`a082776` 모두 `git cat-file -t` = commit.
- trailer 파싱: `b687b1a` 5키(`Agent·Handoff·Status·Criteria-Met·Verified-By`) 반환. ΔV1 구현 `a082776`의 `Handoff:`는 0278만 가리킨다 — 0281 ΔV1 구현을 메시지 버스에서 찾을 수 없음(D7).
- `[구현자 기입] ΔV1 r1.2` 7필드는 표제상 존재하나 `강제 지점·V pair`가 산문 한 줄로 접혀 6자리별 행·`N/M`·`남긴 곳`이 없다(D7).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | M1: `models` loading만으로 에이전트 제목 스피너가 켜져도 green | ΔV1 seat 1 · AC5 · DV1-P3 | BLOCKING (PAIR_FAIL) | agents/models 반대 조합으로 Module에서 `[data-agent-loading]` 단언 |
| D2 | M4: 미선택 버튼이 첫 agent 이름을 보여도 green | seat 3 · AC6 · DV1-P1 | BLOCKING | 비어 있지 않은 agents + 미선택 trigger 텍스트 단언 |
| D3 | M5: 회전 class 제거가 green | seat 4 · AC5("animation class") · DV1-P1 | BLOCKING | indicator class 단언(reduced-motion 포함) |
| D4 | M6: Tab 닫기·초점 복귀 제거가 green | seat 6 · AC6 · DV1-P1 | BLOCKING | 빈/비어 있지 않은 메뉴에서 Tab 관측 |
| D5 | M9: trailing이 label 앞에 와도 green, 계획된 `shared/ui/MenuItem.render.test.ts` 부재 | seat 5 · DV1-P3 | BLOCKING | MenuTitle 세 슬롯 순서 render 테스트 |
| D6 | `harness.defaultAgent` 키 소비처 0 | 비귀속 | NON_BLOCKING | 정리 권고 |
| D7 | ΔV1 구현이 0278 trailer로만 커밋, 강제 지점 필드가 산문으로 접힘 | repository operation | NON_BLOCKING | 다음 구현 커밋에 `Handoff: …0281…`·자리별 표 |

## 14. Review Signals

- 이전 라운드 동일 증상: 해당 없음(첫 verify).
- 관련 plan 지침: §10이 자리별 "예정 oracle 좌표·구별 입력"을 명시했으나 seat 1·5 좌표 파일·케이스가 만들어지지 않음.
- 사용자 결정 변경: D5·D6 (2026-10-22 annotation) — ΔV1에 반영됨.
- 반복 환경 한계: Linux에서 Windows 전용 fixture 15건 red, Windows CI로 대체.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: REQUIRED/REGRESSION PASS 4(V1 VP1–4) · root PAIR_FAIL 2(DV1-P1·DV1-P3) · BLOCKED_BY 1(DV1-P2).
- PLAN_GAP: 없음.
- AC: ✅4 · ❌2 / 6.
- 운영 gate: PASS(main Linux 15건은 Windows 전용 fixture, CI #853 green).
- 다음 단계: Codex r2 — D1–D5 테스트 보강 후 고장 이력 M1·M4·M5·M6·M9 재실행.

---

# r2 재검증 (2026-10-23)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 대상 커밋/range | `32b43cc..e42d1e2` 중 0281: `ad69821`(ΔV1 r2 — 테스트 3파일) |
| 구현 전 plan 기준 | r1과 같음 — `ad69821`의 `plan.md` `-` 줄은 메타 상태 1줄, 규범 행 변경 0 |
| V mode / 유효 V | Delta V / `V1@256ddd24 + ΔV1` |
| 라운드 | 2 (이 handoff의 verify 2회째) |
| 자기 검증 여부 | 아니오 — 구현 Codex, 검증 Claude |

**PASS — r1에서 못 잡은 5개 고장(M1·M4·M5·M6·M9)이 모두 새 테스트에 잡히고, r1에서 잡히던 8개도 그대로 잡힌다.** production을 바꾸지 않은 테스트 보강 라운드라 §10 자리와 production 경로는 r1과 같다.

## r2-0. 기준선 / plan validity

- 이번 라운드 앱 변경: `git diff 3d78de3..e42d1e2 -- app`이 `*.test.ts` 22파일뿐(production 0). §10 자리 검색 결과는 r1과 같고 목록 차집합 0.
- 새 oracle 실행 구간: `Controls.interaction`·`Module.integration`은 실제 `OpenCodeSelect`·`MenuTitle`·`Popover`·hook·state를 렌더하고 store·i18n만 mock. `MenuItem.render`는 실제 `MenuTitle` SSR. 로컬 재구현 없음.
- 운반 값 구별: `Module.integration`이 agents/models 두 slot을 서로 반대 상태(ready↔loading)로 줘 형제 맞바꿈(M1)을 구별한다.

## r2-4. 고장 재실행

- 범위 `features/chat`+`shared/ui`(BASE 293파일/2310 green), M9·M10은 renderer 전체. 검증자 전용 worktree(HEAD `e42d1e2`)에서 심고 원복했다.

| ID | r1 | r2 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|
| M1 | 못 잡음 | **잡음** | `Module.integration: uses only the agent slot for title loading when agents/models completes first` 외 1 | seat 1 · D1 |
| M2 | 잡음 | 잡음 | `Controls.interaction: …heading spinner only while loading`·Module.integration 2 | seat 2 |
| M3 | 잡음 | 잡음 | Controls.interaction 7·Module.integration 1 | seat 2 |
| M4 | 못 잡음 | **잡음** | `Controls.interaction: keeps the unselected label with real agents until the user selects an agent` | seat 3 · D2 |
| M5 | 못 잡음 | **잡음** | `Controls.interaction: …heading spinner only while loading` | seat 4 · D3 |
| M6 | 못 잡음 | **잡음** | `Controls.interaction: closes the loading/ready/error agent menu on Tab and restores focus` 외(4건) | seat 6 · D4 |
| M7 | 잡음 | 잡음 | `keeps an empty loading menu keyboard-accessible…` | seat 6 |
| M8 | 잡음 | 잡음 | Controls.interaction 3·Module.integration 3 | seat 4 |
| M9 | 못 잡음 | **잡음** | `MenuItem.render: renders leading, label and trailing in order…`·Controls.interaction 1 | seat 5 · D5 |
| M10 | 잡음 | 잡음 | MenuItem.render·Controls.interaction·Module.integration 2 | seat 5 |
| M11 | 잡음 | 잡음 | `composerCatalogState: loads resource parts only for a panel subscriber…` | V1 VP4 |
| M12 | 잡음 | 잡음 | `composerCatalogState: publishes agents before models…`·Module.integration | V1 VP2 |
| M13 | 잡음 | 잡음 | `composerCatalogState: coalesces retry, keeps data on error…` | V1 VP4 |

- 검산: 시도 13 = 잡음 13 · 못 잡음 0 · 동치 0. r1 못 잡음 5 → 잡음 5, r1 잡음 8 → 잡음 8(덮개 회귀 0). 인용 변이 5(D1–D5)는 구현 보고와 같은 자리에서 재현했다.

## r2-5. V-pair closeout

| Pair | 레벨 | r1 | r2 | 증거 |
|---|---|---|---|---|
| V1 VP4 | UT | PASS | PASS | M11·M13 잡음 |
| DV1-P3 | IT | PAIR_FAIL | **PASS** | M1·M9·M10 잡음 |
| V1 VP3 | IT | PASS | PASS | M3 잡음 |
| DV1-P2 | ST | BLOCKED_BY:DV1-P3 | **PASS** | M1·M12 잡음, 반대 slot 조합의 제목 DOM |
| V1 VP2 | ST | PASS | PASS | M12 잡음 |
| DV1-P1 | AT | PAIR_FAIL | **PASS** | M4·M5·M6·M7·M8 잡음 |
| V1 VP1 | AT | PASS | PASS | M2·M3·M7·M8 잡음 |

| AC | 결과 | 근거 |
|---|---|---|
| AC1 선택·키보드·초점 | ✅ | M2·M3·M7 잡음 |
| AC2 재개방 재요청 없음 | ✅ | M12 잡음 |
| AC3 캐시 격리·해제 | ✅ | M11·M13 잡음 |
| AC4 합성 기본 행 없음 | ✅ | M3 잡음 |
| AC5 agent loading만 제목 스피너 | ✅ | M1·M5·M8 잡음 |
| AC6 빈 메뉴 제목·Escape/Tab·자동 선택 없음 | ✅ | M4·M6·M7 잡음 |

- 합계 재측정: `✅ 6 · ❌ 0 = 6`. 자기보고 `Criteria-Met: 6/6`(`ad69821`) 일치.
- §10: V1 5/5 · ΔV1 6/6 PASS. 목록 밖 발견 없음.

### r2 운영 gate (HEAD `e42d1e2`)

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | node·web·test 3구성 exit 0 |
| lint | PASS | 0 error · 2 warning(r1과 같은 두 파일). 실행 후 `git status` 변화 없음 |
| renderer vitest | PASS | 377파일 / 3078케이스 green |
| main·shared·preload vitest | 환경 한계 | 470파일 · 5262케이스 중 17 red — r1의 15건 + 0280 r2 새 테스트 2건(`composer-catalog.test: preserves the acquire/configuration failure stage…`, `C:/` fixture). 전부 Windows 전용 |
| Windows CI | PASS | run #857(`e42d1e2`, windows-latest) lint·typecheck·test success |
| doc inventory | PASS | inventory·prose·links ok |

## r2-8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| 제목 우측 스피너의 실제 회전·두 테마 | 회전·reduced-motion class와 세 슬롯 순서 잠김(M5·M9) | 실제 창 렌더 품질 |

## r2-11. Repository operation checks

- INDEX: `impl/IMPL_DONE`(r2) → PASS, archive 이동. 대상 커밋 `ad69821` `git cat-file -t` = commit, trailer 5키 파싱(`Handoff: docs/handoff/0281-opencode-menu-cache/`).
- `[구현자 기입] ΔV1 r2` 7필드 존재, 강제 지점 표가 ΔV1 6자리·V1 EP1·EP2를 행으로 담는다.

## r2-13. Finding disposition

| # | r2 상태 | 근거 |
|---|---|---|
| D1–D5 | closed | M1·M4·M5·M6·M9 잡음 |
| D6 | NON_BLOCKING 유지 | `harness.defaultAgent`는 `i18n/resources/{ko,en}.ts` 정의뿐, 소비처 0 |
| D7 | closed | `ad69821` trailer가 0281을 가리키고 자리별 표가 있음 |

## r2-14. Review Signals

- 이전 라운드 동일 증상: 없음 — r1 미검출 5축이 모두 해소됐다.
- 반복 환경 한계: Windows 전용 fixture(Linux 17 red) — CI #857로 대체.

## r2-15. 결론

- 상태: **PASS** — verify 2회째. pair 7/7 PASS, PLAN_GAP 없음, AC ✅6/6.
- 남은 사람 확인: 실제 창의 제목 스피너 시각(기계 범위 밖).
