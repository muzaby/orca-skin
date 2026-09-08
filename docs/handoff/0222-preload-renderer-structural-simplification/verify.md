# Verify — 0222-preload-renderer-structural-simplification

## 메타

| 항목 | 값 |
|---|---|
| slug | `0222-preload-renderer-structural-simplification` |
| 검증자 | Claude Code |
| 일자 | 2026-09-08 |
| 대상 커밋/range | `550503c..e475c62a` |
| 구현 전 plan 기준 | `550503c` |
| V mode / 유효 V | Baseline V / V1 |
| 검증 기준 plan revision | `550503c`:V1 |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다. 설계·구현은 Codex, 검증은 Claude Code. 그럼에도 구현 보고에 없던 적대 축 6건과 base↔head 케이스 전수 대조를 별도로 수행했다(§4·§7) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — `[구현자 기입]` 추가만이다(+86/−0).
- **기준선이 diff로 성립하는가**: 예. 설계 `550503c`와 구현 `e475c62a`가 별도 커밋이다.
- Decision Ledger 변경: 없음.
- Product & UX Contract 변경: 없음.
- AC 변경: 없음. AC1~9는 `550503c`가 확정했다.
- V node/pair·requiredness·§10·oracle 변경: 없음. VP-01~19·EP-01~10 그대로다.
- 채점에 사용할 원 기준: `550503c`의 D-01~06·AC1~9·VP-01~19·EP-01~10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | Baseline V이고 상속 기준 없음. 0221의 V1을 상속하지 않음을 갱신 메모가 명시 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R/AT-01~09·SD/ST-01~02·AR/IT-01~04·MD/UT-01~04 전부 VP-01~19에 대응 |
| 영향받은 INHERITED ↔ REGRESSION pair | 해당 없음 | 상속 V가 없다. 기존 회귀는 preload/renderer/shared 전체 suite 재실행으로 대체 |
| pair별 path·§10 전수·직접 oracle | 유효 | 19 pair 모두 start→edges→end와 EP 번호를 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | EP-01·03·07에만 변이를 선정하고 “단순 삭제 모듈 grep이나 파일 크기는 이 oracle을 대체하지 않는다”를 명시 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | preload/renderer/shared 전체·타입 3구성·변경 subtree lint·doc/링크·test budget·diff. Main 전체를 기본 gate에서 뺀 근거(§12-4)도 적었다 |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음.
- root PLAN_GAP과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-01 진단 후 구조 리팩토링까지 | 책임 이동 실행 | preload 구독·chat entry·submit gate·sessions·Tweaks·검색/사용량 7축 이동 |
| D-02 기존 계층 안에서 소유 정리 | 새 플랫폼 0 | 신규 production 파일 0. `TweakProvider.tsx`가 기존 파일 안에서 store를 소유 |
| D-03 공개 preload API·IPC·DB·DOM·입력·실패 정책 보존 | 회귀 0 | `shared/ipc.ts`·`shared/protocol.ts`·`package.json`·lock diff 0 |
| D-04 반복 호출·할당·전파 축소, 실측과 추론 구분 | 근거 있는 축소만 | listing 재조회 제거·entry 교체 축소만 바꾸고 시간 수치는 쓰지 않았다 |
| D-05 SRT·cowork·OpenCode·새 의존성·범용 플랫폼 금지 | 추가 0 | 의존성 변경 0 |
| D-06 화면별 다른 요청·실패·수명을 합치지 않는다 | 정책 분리 유지 | `useSessionHandlers`↔`useSessionActions`의 삭제 순서 차이 유지, provider step/gate 분리 유지 |

### end-to-end 흐름

```text
main push (CHANNELS.*)
  → preload subscribe(channel, handler) — payload만, Electron 이벤트 미전달
  → chatStore.receive → patchEntry(단일 경계) → session/live/pendingSteer
  → 구독자 알림 → Composer/Transcript

@토큰 입력
  → useFileAutocomplete: queryDir(cwd·dirPath) 변경에서만 fileApi.list
  → entriesByDir 캐시 → 현재 match로 suggestions 필터
  → ComposerInputController 표시

설정 변경
  → useTweakContext(selector).setTweak → store set(낙관) → settingsApi.set
  → 실패 시 이전 전체 snapshot 복원
  → TweakProvider effect → documentElement dataset/style/lang
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 보존 | `initSessions`/`loadProject`의 catch가 `loading:false` 후 rethrow하고 기존 상태 참조를 유지한다 |
| false success 가능성 | 없음 | `patchSession`의 `sameItem` 가드는 **모든 own key를 개수까지 비교**한다. 값이 실제로 바뀌면 반드시 통과한다(N14 red) |
| partial failure/rollback | 보존 | `setTweak`이 실패 시 patch 이전 **전체 snapshot**으로 되돌린다(P8 red) |
| Product/UX의 A가 아닌 B를 구현했는가 | 아니다 | preload 8개 endpoint·6개 Tweaks 소비자의 채널·필드를 base와 1:1 대조했다(§7) |
| 증상만 제거하고 상태 변화가 남았는가 | 아니다 | `ProjectsProvider` 제거 후에도 boot `projects-cost` step이 `initProjects`를 호출한다 |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | `queryDir`가 `match?.dirPath ?? null`이라 **빈 문자열 dirPath(루트)를 null로 접지 않는다**. cwd/dir 전환·토큰 제거·unmount의 stale 차단은 effect cleanup이 그대로 소유 |
| 출력/요청 worst-case 상한 | 개선 | 같은 디렉토리의 prefix 변경이 pending IPC를 재시작하지 않는다(P4 red: 기대 1회 / 되돌리면 3회) |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 550503c..e475c62a
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `SIDEBAR_MIN/MAX/DEFAULT_WIDTH` 미사용 export | **선행 존재** | `550503c`의 `Sidebar.tsx:18~20`에 이미 있다. 이번 범위 밖 |
| `createTweakStore` test-only | 정상 | 같은 파일 `TweakProvider`가 `useState(createTweakStore)`로 쓴다. 스크립트는 파일 간 참조만 센다 |
| `acceptedSubmitCanClearDraftAndRequirements` test-only | 정상 | `composerSubmit.ts:48`이 자기 파일에서 호출 |
| `ingestChatEvent`·`NEW_CHAT_KEY`·`useSessionsStore`·`useProjectsStore`·`ModelUsageList`·`UsageDescription` | 정상(선행) | 배럴 re-export 또는 파일 내부 사용. base에도 같은 형태 |
| 형제 정책 비대칭 | 없음 | 스크립트 3항 0건 |
| 삭제 모듈의 잔존 참조 | 없음 | `useTweaks`·`steerGate`·`submitClearGate`·`ProjectsProvider`·`subscribeProjects` grep 0건(과거 전환을 설명하는 주석 1줄 제외) |
| producer ↔ consumer 파생 불일치 | 없음 | `useTweakContext` 소비자 6곳의 selector 필드가 각 파일의 실제 `t.<field>` 읽기와 정확히 일치(§7) |
| 동일 규칙 중복 구현 | SSOT 유지 | `steerGate.ts`·`submitClearGate.ts` 삭제 후 forwarding 사본 0 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: 확인. `preload/index.test.ts`는 `contextBridge.exposeInMainWorld`가 받은 **실제 객체**를 꺼내 endpoint를 호출한다 — 동명 로컬 재구현이 아니다.
- 핵심 입력/분기가 실제 실행됨: 확인. `tweakConsumers.render.test.ts`는 6개 소비자 컴포넌트를 실제로 렌더한다.
- structural proxy만으로 semantic 목표를 통과시킨 AC: **없음**.
- **선택된 적대 증거 재측정**: 등록 변이 6건 재현 → **검출 6 · 미검출 0**. 보고된 실패 개수와 전건 일치. 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: 이전 검증 라운드 없음. 덮개 회귀 판정 대상 0.
- **자기검증 분모**: 구현자 ≠ 검증자. 보고에 없던 축 **6건**을 추가했다(P3·P8·N6·N6b·N7·N13·N14).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| P1 — `update.onState`/`onProgress` 채널 맞바꿈 | preload | 보고 red 2 | **red** (2 failed / 11) | EP-01 등록 변이 |
| P2 — `off(channel, () => {})`로 다른 listener 해제 | preload | 보고 red 8 | **red** (8 failed / 11) | EP-01 등록 변이 |
| P4 — listing effect 의존을 `match` 전체로 되돌림 | useFileAutocomplete | 보고 red 1 | **red** (1 failed / 4) | EP-03 등록 변이 |
| P5 — `settingsApi.set` 호출 제거 | theme 2파일 | 보고 red 2 | **red** (2 failed / 5) | EP-07 등록 변이 |
| P6 — `dataset.theme` 대입 제거 | theme 2파일 | 보고 red 1 | **red** (1 failed / 5) | EP-07 등록 변이 |
| P7 — Header selector에서 `sidebarCollapsed` 제거 | tweakConsumers | 보고 red 1 | **red** (1 failed / 6) | EP-07 등록 변이 |
| **P3** — listener가 Electron 이벤트 객체를 그대로 전달 | preload | 미실행 | **red** (8 failed / 11) | 검증자 추가 축 |
| **P8** — 저장 실패 시 rollback `set` 제거 | theme 2파일 | 미실행 | **red** (1 failed / 5) | 검증자 추가 축 |
| **N6** — `mergeItems`의 재정렬 재구성 블록 제거 | sessions·app 12파일 | 미실행 | **red** (1 failed / 69) | 검증자 추가 축 |
| **N7** — telemetry의 live 초기화 조건을 무력화 | renderer 160파일 | 미실행 | **red** (2 failed / 1211) | 검증자 추가 축 |
| **N13** — `patchEntry`의 동일 결과 identity 보존 제거 | renderer 160파일 | 미실행 | **red** (1 failed / 1211) | 검증자 추가 축 |
| **N14** — `patchSession`의 `sameItem` 가드 제거 | sessions·app 12파일 | 미실행 | **red** (1 failed / 69) | 검증자 추가 축 |
| **N6b** — `mergeItems`의 `delete next[id]` GC 루프 제거 | preload+renderer+shared **전체** | 미실행 | **green** (184파일 1,443 통과) | D1 — 중복 코드 |

- 동작 보존 이설 라운드인가: **예**. hunk 되돌림의 초록을 판정 근거로 쓰지 않았다 — 위 변이는 전부 계약을 깨는 변형이고, 이설 자체는 §7의 base↔head 케이스 전수 대조로 검증했다.
- 소거 변이의 잔여물 수렴: N6b는 잔여물(미사용 변수·타입 진단)을 남기지 않는 완전 소거였고 lint/typecheck도 통과한다 — 즉 green이 부산물이 아니다. 원인은 D1(중복)이다.
- 형제 슬롯 맞바꿈 변이: 수행했다. P1이 `update.onState`↔`onProgress` 두 형제 endpoint의 채널을 맞바꿔 red를 얻었다 — 존재만 보는 단언이면 침묵했을 형태다.
- `N회` 기준의 실제 관측 주체: “pending prefix 조회 1회”는 `fileApi.list` mock의 호출 수를 지연 응답 fixture에서 직접 센다(P4 되돌림에서 기대 1 / 실제 3).
- 순서 기준의 관측 훅: “선택 후 navigate → close”는 `OverlayLayer.search.test.ts`가 두 callback의 호출 순서를 배열로 기록한다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-16 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | P1·P2·P3 red | 공개 메서드 → listener → emit/off / EP-01 **8/8** |
| VP-17 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | N13·N7 red · `chatStore.entryUpdates` 4 | entry 전이·submit predicate / EP-02 **7/7** · EP-04 |
| VP-18 | MD-03 ↔ UT-03 / UT | REQUIRED | PASS | N6·N14 red | 동일성 비교 → merge/GC / EP-05 |
| VP-19 | MD-04 ↔ UT-04 / UT | REQUIRED | PASS | P5·P6·P8 red · P4 red | Tweaks 초기값/patch/rollback·query filter / EP-03·07 |
| VP-12 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | P4 red · 지연 IPC fixture 4케이스 | token → hook → files IPC → cache / EP-03 |
| VP-13 | AR-02 ↔ IT-02 / IT | REQUIRED | PASS | N6 red · `App.projects.test.ts` 3 | 조회 → entities/membership → nav / EP-05·06 |
| VP-14 | AR-03 ↔ IT-03 / IT | REQUIRED | PASS | `OverlayLayer.search.test.ts`·`ProviderUsageTab.test.ts`·telemetry hook 2 | feature → app callback → navigation / EP-08~10 |
| VP-15 | AR-04 ↔ IT-04 / IT | REQUIRED | PASS | P7 red · 6 소비자 렌더 | context store → selector → settings/DOM / EP-07 **6/6** |
| VP-10 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | N7·N13 red · 완료/telemetry 정착 4케이스 | preload push → receive → commit/live/pending / EP-01·02·04 |
| VP-11 | SD-02 ↔ ST-02 / ST | REQUIRED | PASS | P5·P6·P8 red · lifecycle 요청별 cleanup | mount/get → patch → reject/cleanup → DOM / EP-07 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | PASS | 8 endpoint 각각 형제 채널·두 구독자·중복 해제 | contextBridge 노출 객체 / EP-01 **8/8** |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | PASS | N13·N7 red · 기존 complete/error/FIFO/권한/lease 회귀 | chatStore.receive/actions / EP-02 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | PASS | P4 red · 늦은 응답 차단·빈 캐시·quoted/hidden | useFileAutocomplete / EP-03 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | PASS | `ComposerInputController.test.ts` 6 · `sendAdmission.test.ts` 9 | submit lifecycle → clear/유지 / EP-04 |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | PASS | N6·N14 red · 검증자 직접 관측(§7 GC) | session/project API → store → nav / EP-05 |
| VP-06 | R-06 ↔ AT-06 / AT | REQUIRED | PASS | boot step의 `initProjects` 1회 · Provider 중첩 순서 대조 | boot steps/project store / EP-06 |
| VP-07 | R-07 ↔ AT-07 / AT | REQUIRED | PASS | P5·P6·P7·P8 red · 소비자 6/6 필드 대조 | provider store → settings API/DOM / EP-07 |
| VP-08 | R-08 ↔ AT-08 / AT | REQUIRED | PASS | 검색 3 · app 배선 1 · 사용량 UI 2 · telemetry 2 | SearchModal → onChoose → navigate / EP-08~10 |
| VP-09 | R-09 ↔ AT-09 / AT | REQUIRED | PASS | base↔head 케이스 차집합 **누락 0 / 추가 43**(§7) | 삭제·이동·호출 전수 / EP-01~10 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: P5·P6·P8은 VP-07·11·19를, N13·N7은 VP-02·10·17을 함께 닫는다.
- 이번 라운드 실행 범위: **최초 독립 검증** — VP-01~19 전건과 현재 변경의 운영 gate 전건.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 공개 endpoint가 올바른 채널/payload, 자기 구독만 해제 | ✅ | P1(2 red)·P2(8 red)·P3(8 red) | `preload/index.ts` subscribe 8곳 |
| AT-02 / AC2 | 완료/telemetry 결과·세션 격리·pending 전이 동일, 무효 변경은 알림 없음 | ✅ | N13(1 red)·N7(2 red) | `chatStore.patchEntry` |
| AT-03 / AC3 | 같은 dir의 prefix 변경이 진행 listing을 재시작하지 않음 | ✅ | P4(1 red, 기대 1회 / 되돌림 3회) | `useFileAutocomplete.queryDir` |
| AT-04 / AC4 | 제출 허용·pending·provider 차단과 clear 정책 유지 | ✅ | `sendAdmission.test.ts` 9 + clear gate 6 | `composerSubmit`·`sendAdmission` |
| AT-05 / AC5 | 같은 목록이면 참조 보존, 변경 행·membership·GC 반영 | ✅ | N6(1 red)·N14(1 red) + 검증자 직접 관측 | `sessionsStore.mergeItems` |
| AT-06 / AC6 | 프로젝트 초기 로드 유지, no-op Provider 제거 후 순서 유지 | ✅ | `App.projects.test.ts` 3 · boot step 1회 | `boot/steps.ts:104` |
| AT-07 / AC7 | Tweaks 값·저장·rollback·DOM 동일, 소비자는 필요한 필드만 | ✅ | P5·P6·P7·P8 red · 6 소비자 필드 base 대조 일치 | `TweakProvider.tsx` |
| AT-08 / AC8 | 검색·provider 동기화·telemetry 표시/상호작용 보존 | ✅ | 검색 3·배선 1·사용량 2·telemetry 2 | `OverlayLayer`·`ProviderUsageTab` |
| AT-09 / AC9 | 중복 전달·반복 상태 교체 감소, 계약·의존성 추가 0 | ✅ | 누락 0 / 추가 43 · `package.json`+lock diff 0 · Main·shared IPC diff 0 | 전 범위 |

- **합계 재측정**: `✅ 9 · ⚠️ 0 · ❌ 0 = 총 9`(AC1~9를 직접 셈) · 자기보고 9 · **일치**.
- **합계 사본 대조**: 본문 9 ↔ 커밋 `e475c62a` trailer `Criteria-Met: 9/9` ↔ INDEX 비고(수치 미기재) — **갈림 없음**.
- pair 합계 재측정: REQUIRED **19**(VP-01~09의 9 + VP-10~19의 10) · PASS 19 · PAIR_FAIL 0 · 자기보고 19 · **일치**.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01·10·16 | 구독 표면 | EP-01 공개 이벤트 8곳 + private listener/off | `subscribe(` 호출 8(chat·install·session·cost·provider·concurrency·update×2) | **8/8** PASS |
| VP-02·10·17 | entry 갱신 | EP-02 dispatch/entry 갱신 + completed/telemetry | `patchEntry(` 호출 7(dispatchTo·patchLive·patchPendingSteer·patchSubagentMeta·completed·telemetry·patchPendingSession) | **7/7** PASS |
| VP-03·12·19 | listing 수명 | EP-03 effect·cache reset·현재 filter | `queryDir` 단일 소유 + `entriesByDir` 캐시 + suggestions 필터 | **3/3** PASS |
| VP-04·17 | 제출 판정 | EP-04 composerSubmit clear gate, sendAdmission predicate, Composer/chatStore 소비 | clear gate 1(자기 파일) · provider 경계 소비 2(Composer·chatStore) · pending 1(chatStore) | **4/4** PASS |
| VP-05·13·18 | sessions 상태 | EP-05 init/refresh·loadProject·patch·membership GC | 4지점 모두 확인. GC는 §7에서 직접 관측 | **4/4** PASS |
| VP-06·13 | 죽은 Provider | EP-06 Provider·subscribe·배럴·App wrapper·boot step | 앞 4개 제거 확인, boot step은 잔존 확인 | **5/5** PASS |
| VP-07·11·15·19 | Tweaks | EP-07 load/patch/rollback/DOM + 6소비자·type/barrel | 소비자 6, DOM effect 4(theme·density·appFont·uiLocale), 배럴 1 | **6/6 소비자** PASS |
| VP-08·14 | 검색 이설 | EP-08 SearchModal→sessions, OverlayLayer 연결 | 정의 1 + 배럴 1 + 소비 1 | **3/3** PASS |
| VP-08·14 | 사용량 UI | EP-09 SyncRow export→ProviderUsageTab 내부 | 정의 1 + 사용 1, 외부 export 0 | **2/2** PASS |
| VP-08·14 | telemetry hook | EP-10 hook→chat, 페이지 3곳·feature export | 정의 1 + 배럴 1 + 페이지 소비 3 | **3/3** PASS |

- 표에 없는데 같은 불변식이 필요한 지점: **없음**.
- `실패 의미`가 “다른 게이트가 막는다”고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| preload/renderer/shared 전체 시험 | 세 subtree 전부 수정 | **PASS** | `vitest run src/preload src/renderer src/shared` = **184파일 1,443케이스 통과, 실패 0 · skip 0** |
| 타입 3구성 | 공개 hook 시그니처 변경(`useTweakContext`) | **PASS** | `npm run typecheck` node/web/test 진단 0줄 |
| 변경 subtree + shared lint(boundaries/hooks) | 레이어 이동 포함 | **PASS** | error 0 / warning 1 — `useTranscriptVirtualizer.ts:22`의 기존 incompatible-library. 이번 diff 0줄 파일이다 |
| doc inventory / 링크 | `docs/arch/frontend/*` 수정 | **PASS** | `generated doc ok (9 items, 82 channels)` · `prose ok` · `links ok` |
| 실-git test budgets | 시험 파일 추가 | **PASS** | `10 real-git suites ok` |
| diff 위생 | — | **PASS** | `git diff --check` 오류 0 |
| Main 전체 | plan §12-4가 기본 gate에서 제외 | **확인함(범위 밖이지만 실행)** | Main·shared IPC diff 0을 확인했고, 참고로 `src/main` 193파일 2,116케이스도 전건 통과 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| preload 공개 API(`window.orca`) | `typecheck:web`·`typecheck:node` 진단 0 | 8 endpoint 각각 채널·payload·개별 해제 실행 | PASS |
| `useTweakContext(selector)` | 6 소비자 전부 타입 통과 | 선택 필드가 base의 실제 읽기와 1:1 일치 | PASS |
| `docs/arch/frontend/{layers,state,overview,ux-domains}.md` | 상대 링크 해석 | 이동한 소유자를 반영(SearchModal→sessions, Tweaks→TweakProvider) | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **base↔head 케이스 전수 대조(검증자 독립 측정)**: `550503c`에서 `vitest run src/preload src/renderer src/shared` = **175파일 1,400케이스**. HEAD = **184파일 1,443케이스**. fullName 다중집합 차집합 → **base에만 있는 케이스 0 · head에만 있는 케이스 43**.
- 자기보고 “175파일 1,400 → 184파일 1,443, 누락 0·추가 43”과 **전건 일치**.
- 내역 합 = 총계: `main 193/2,116` + `preload·renderer·shared 184/1,443` = **377/3,559** = 저장소 전체 측정치.
- EP-01 8곳: `subscribe(` 호출 8 — 재측정 일치.
- EP-02 7곳: `patchEntry(` 호출 7(정의 1줄 제외) — 재측정 일치.
- EP-07 6 소비자: `useTweakContext` 소비 6개 파일. 각 파일의 selector 필드를 base의 `t.<field>` 읽기 집합과 대조 — **6/6 동일**. `DebugPanel`의 `t.density`는 주석 안 문자열이지 읽기가 아니다.
- `spendingLimitUsd`: base·head 어느 소비자도 Tweaks projection에서 읽지 않는다 — 선행 상태 유지, 이번 변경의 누락이 아니다.
- **membership GC 직접 관측**: 임시 테스트로 실제 store를 구동해 확인했다. recent 3건 + project membership 1건 상태에서 recent가 `['d']`로 줄면 `byId`는 `{b, d}`가 되고 키 순서는 `[b, d]`(프로젝트 → 최근)다. 관측 후 임시 파일은 삭제했다(§9).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| preload contextBridge | `exposeInMainWorld` 인자 객체를 꺼내 8 endpoint 실행 | 실제 Electron 프로세스 경계 | 앱 실행 후 채팅 스트리밍·업데이트 진행률 표시 확인 |
| Tweaks DOM 효과 | `documentElement`의 dataset/style/lang 대입을 직접 관측 | 시각 결과(테마·폰트·밀도) | 설정 모달에서 테마/폰트/밀도 전환 |
| 검색·사용량 UI | 선택 callback·close 순서·spinner/error 상태 | 시각 배치·스크롤·포커스 링 | 검색 모달 열고 키보드 이동 후 선택 |
| 파일 자동완성 | 지연 IPC fixture로 deps·cleanup·후보 계산 | 실제 대형 디렉토리 체감 | 큰 저장소 cwd에서 `@` 입력 |

- “UI라서”를 이유로 넘긴 순수 로직은 없다. 상태·후보·정렬·파생은 전부 기계 검증했다.

## 9. 게이트 재실행

```text
$ cd app && node node_modules/vitest/vitest.mjs run --maxWorkers=2 src/preload src/renderer src/shared
$ npm run typecheck
$ node node_modules/eslint/bin/eslint.js src scripts
$ node scripts/check-doc-inventory.mjs --check
$ node scripts/check-test-budgets.mjs
$ git diff --check
```

- **관측한 실행 산출**(exit code 아님): `Test Files 184 passed (184)` / `Tests 1443 passed (1443)`, skip·todo 0줄. typecheck는 세 구성 모두 진단 줄 0. eslint는 `✖ 1 problem (0 errors, 1 warning)`. doc-inventory·test-budgets는 §5의 문자열 그대로.
- `npm test`를 썼는가: 아니다. `pretest`를 우회했다. 이 범위는 DB를 로드하지 않는다.
- ABI/egress 기인 실패 분리: 이 범위에서는 0건. electron dist 미설치로 죽던 3파일은 전부 `src/main` 소속이다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`(`--fix`) 대신 `eslint.js`를 직접 호출했고, 실행 후 `git status --short` 출력 0줄.
- **검증 중 실행한 명령이 남긴 잔여물**: 있었고 정리했다. GC 직접 관측용 `__verify_gc.test.ts`와 변이 하네스가 남긴 `tmp.*` 2개를 삭제했다. 최종 `git status --short`는 이 문서 2개만 남는다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | PASS |
| AC ↔ production path | 9행 1:1 대조 | — | PASS |
| 레이어/계약/문서 링크 | boundaries lint·doc-inventory | — | PASS |
| AGENTS 위생/부모-자식 모순 | 이번 라운드 AGENTS 변경 0 | — | 해당 없음 |
| 제품 의도 / Open Question | 보조 의견 | **결정** | 미해결 항목 없음 |
| UI/UX 시각 품질 | 상태·callback·DOM 대입까지 기계 검증 | **시각 확인** | §8 |
| 신규 의존성 / PR merge | `package.json`·lock diff 0 확인 | **merge 승인** | 사람 몫 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 이번 커밋의 `AGENTS.md` 변경: **0건** → 위생 스캔·stub·root 표 갱신 모두 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 검증 전 `impl/IMPL_DONE (V1) · Claude · (r1 구현 — 검증자 기입)`. 실제 상태와 일치했다.
- 「다음 주체」 칸: `Claude` 하나.
- 대상 커밋 좌표 기입: r1 = **`e475c62a`**, 설계 = **`550503c`**를 이번 검증에서 채웠다. `git cat-file -t` 둘 다 commit.
- 비고 5줄 이내: 예(1줄).
- PASS 시 archive 이동: 이번 PASS로 `docs/archive/handoffs/INDEX-history.md`로 이동했다.

### Commit / reference 정합성

- trailer 허용값: `550503c` = `Agent: codex` + `Status: designed`, `e475c62a` = `Agent: codex` + `Status: implemented` + `Criteria-Met: 9/9` + `Verified-By: pending`. 모두 허용값이다.
- trailer 실제 파싱: `git log -1 --format='%(trailers:only=true)'`가 설계 **3키**, 구현 **5키**를 반환한다. 0건 없음.
- 인용된 커밋 해시 실재: plan 기준 코드 `fbaac3fc` = commit.
- 재구현 라운드 `[구현자 기입]` 7필드: r1이므로 재구현 규칙 비적용. 그럼에도 7필드 중 6이 있고 “이번 라운드 수정의 잠금”이 표 형태로 존재한다(누락 필드 없음).
- 이동/삭제 reference: `useTweaks.ts`·`steerGate.ts`·`submitClearGate.ts`·`ProjectsProvider.tsx` 4개 삭제, `SearchModal.tsx`·`useUsageForTelemetryProvider.ts` 2개 이동. 살아 있는 소비처 0/정상 배선 확인(§3).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| GC 단순 병합 시 `Object.values` 순서가 달라져 같은 `pinnedAt` 순서가 뒤집힘 → 순서 보존 추가 | **타당하고 실재한다**. N6(재정렬 블록 제거)에서 red | 유지 |
| child 완료 분기 직접 시험 부족 → 사례 추가 | 타당. N7·N13이 같은 경계를 red로 잡는다 | 유지 |
| 새 시험 위치가 renderer 계층을 역방향 참조 → App 조립 시험은 renderer 루트, cross-feature는 app | 타당. boundaries lint error 0으로 재확인 | 유지 |
| Tweak factory의 React Refresh 경고에 한 줄 예외 | **타당**. `createTweakStore` 없이는 저장·수명을 직접 시험할 수 없고, 예외 범위가 export 한 줄이다. 새 전역 singleton 없음 | 유지 + D2 기록 |
| 목록 비교의 성능 손익은 측정 후보로 기록 | 타당. 시간 수치를 쓰지 않았다 | 유지 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `mergeItems`의 `delete next[id]` GC 루프가 **아래 재정렬 재구성과 중복**이다. 지울 대상이 있으면 `sameIds(currentIds, orderedIds)`가 반드시 거짓이 되어 `Object.fromEntries(orderedIds…)`가 같은 GC를 수행한다. 제거해도 184파일 1,443케이스 전건 green | 비귀속(관측 가능한 동작 차이 0) | **NON_BLOCKING** | VP-05·13·18 인접 | GC 자체는 §7에서 직접 관측해 정상. 중복 루프 제거 또는 재정렬 블록에 GC 의도를 명시하는 정리를 후속 후보로 |
| D2 | `TweakProvider.tsx`가 `createTweakStore`를 export하고 `react-refresh/only-export-components` 예외를 1줄 남겼다 | 비귀속(plan §9가 허용한 provider 소유 범위) | **NON_BLOCKING** | VP-15 인접 | 새 store 파일·전역 singleton은 없다. 기록만 |
| D3 | scan-surface의 미사용 export 3건(`SIDEBAR_*`)과 test-only 후보 10건 | 비귀속(선행 존재·오탐) | **NON_BLOCKING** | — | 기록만 |
| D4 | `patchPendingSession`이 `getState().activeKey`를 setState 밖에서 읽는다(이전엔 updater 안에서 읽었다) | 비귀속 | **NON_BLOCKING** | VP-02·17 인접 | zustand `setState`가 동기라 현재 관측 차이 0. 비동기 배칭이 도입되면 재검토 |
| D5 | `spendingLimitUsd`가 `Tweaks`에 있으나 6 소비자 어디도 selector로 읽지 않는다 | 비귀속(선행 존재) | **NEXT_HANDOFF** | — | base에서도 읽는 곳이 없다. projection에서 뺄지 여부는 별도 판단 |

- plan의 `[검증자 기입] 파생 이슈`로 이관했다.
- `PLAN_GAP` **0** — 결과는 `RETURN_TO_PLAN`이 아니다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음 — r1이자 첫 독립 검증이다.
- 관련 plan 지침/AC의 존재 여부: D1이 건드린 GC는 §10 EP-05와 AC5에 명시돼 있고, 동작은 충족한다. 문제는 지침이 아니라 구현의 중복이다.
- 사용자 결정 변경 근거: 없음. Decision Ledger는 설계 커밋 이후 불변이다.
- 반복된 검증 환경 한계: 이 범위에서는 없다. 0221에서 걸린 electron dist·better-sqlite3 ABI는 `src/main` 전용이다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **19 PASS** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-01~06 전부 충족. 공개 preload API·IPC·DOM·의존성 변경 0
- AC 충족: ✅ 9 · ⚠️ 0 · ❌ 0 / 9
- 현재 변경 운영 gate: 시험 184파일 1,443케이스·타입 3구성·lint·문서/링크·test budget·diff 전건 PASS
- NON_BLOCKING / NEXT_HANDOFF: D1~D5 5건. 어느 것도 현재 pair·ACTIVE Decision·필수 gate에 귀속되지 않는다
- repository operation checks: INDEX·trailer 파싱·삭제/이동 reference 전부 PASS. AGENTS 변경 0
- 남은 사람 확인: 테마·폰트·밀도 시각 확인, 검색/사용량 UI 실기, PR merge
- 다음 단계: INDEX 행을 archive로 이동. D1 정리는 후속 handoff 후보
