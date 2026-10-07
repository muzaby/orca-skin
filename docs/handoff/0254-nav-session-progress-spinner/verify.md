# Verify — 0254-nav-session-progress-spinner

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0254-nav-session-progress-spinner` |
| 검증자 | Claude Code |
| 일자 | 2026-10-07 |
| 대상 커밋/range | `dc138888..4f096797` = r1 `4f096797` (회귀 확인은 0255 반영 head `2a14cc8a`에서도 수행) |
| 구현 전 plan 기준 | `dc138888` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `dc138888:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-04(AC14) 시각·OS 실기 대기(비차단) |
| 자기 검증 여부 | 아니오 — 구현 Codex(`Agent: codex`), 검증 Claude. 독립 축 X1~X6을 추가했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: 메타 `상태` 1행 + `[구현자 기입]` 7절(`git diff dc138888 4f096797 -- …/plan.md`, hunk `@@ -11`·`@@ -473`).
- 기준선이 diff로 성립하는가: 예 — 설계 `dc138888`과 구현 `4f096797`이 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `dc138888:plan.md` §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 0249는 `INHERITED` 회귀 노드로만 참조(`0249:plan@03bfcaed`) |
| NEW node ↔ REQUIRED pair | 유효 | R-01~04, SD-01, AR-01·02, MD-01~03 → VP-01~10 |
| INHERITED ↔ REGRESSION | 유효 | R-0249 → VP-11 |
| pair별 path·§10 전수·직접 oracle | 유효 | 11행 모두 path·EP·oracle |
| 선택적 적대 증거 | 유효 | 배선·자리·0건 성질 pair(VP-01·02·03·06·07·10)에만 M1~M12 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 운영 gate | 유효 | §7-A 4종 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·002 | inflight ∧ 요청 0건만 생성 중, listen 제외 | `responseProgress.ts:8-15` — `activityTransport` 미참조 |
| D-003·004·010 | 아이콘 자리 warn 스피너, 열람 행 포함, label 교체 | `SessionRow.tsx:62-82` |
| D-005 | 생성 중 > 주의 표시 > 기본 | `navIconState.ts:14-16` |
| D-006 | 5 렌더 사이트 | 모두 `SessionRow` → 단일 `modeIcon` |
| D-007 | app 계층에서만 연결 | `useSessionCompletion.ts:13` `subscribeGeneratingSessions(sessionsActions.setGeneratingSessions)` |
| D-008 | 구성원 변화 때만 store 쓰기 | `chatStore.ts:572-584` `sameKeys` · `sessionsStore.ts:275-284` bail-out |
| D-009 | 감속 모션에서 정지 | `DotsSpinner.tsx:2` `motion-reduce:animate-none` |

```text
send/BEGIN_TURN · permission.* · TURN_END_RESET
  → useChatStore 변경 → subscribeGeneratingSessions(generatingSessionKeys, sameKeys)
  → app subscribeSessionAttention → sessionsActions.setGeneratingSessions(bail-out)
  → SessionRow selector has(session.id) → navIconState → DotsSpinner / 기존 Icon
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 판정 입력은 renderer 소유 `inflight`·요청 배열뿐 — IPC·영속 변경 0 |
| false success | 없음 | 요청 1건이라도 있으면 제외(M4a/b/c red), listen 제외(M6 red) |
| Product/UX의 A가 아닌 B | 아님 | 제목 색 불변 — `unseen`은 아이콘 class에만 쓰임(`SessionRow.tsx:64-75`, 다른 사용처 0) |
| 증상만 제거 | 해당 없음 | — |
| 최적화가 잃은 관측 | 없음 | `state.sessions === previous.sessions` skip은 sessions 외 변경만 거른다(X6 등가) |
| 출력/요청 상한 | 상수 | store 쓰기는 구성원 변화 때만(M8·M9 red) |

## 3. 역방향 탐색

`scan-surface.sh`는 이 환경에 `rg`가 없어 실행 불가 — 동일 질의를 `grep -rlw`로 수행했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export 8종의 production 참조 | 정상 | `isGeneratingResponse`(모듈 내부)·`generatingSessionKeys`·`sameKeys`·`subscribeGeneratingSessions`·`setGeneratingSessions`·`navIconState`·`DotsSpinner` 모두 테스트 밖 소비처 ≥1 |
| 테스트 전용 심볼 | 없음 | 위 검색 |
| 형제 정책 비대칭 | 없음 | `modeIcon` 1개를 rename·catalog·nav 3 분기가 공유(`SessionRow.tsx:122·210·234`) |
| 신규 store 필드의 기존 소비처 | 무영향 | `generatingSessionIds` 소비는 `SessionRow` selector 1곳 |
| producer↔consumer | 일치 | sessions는 판정하지 않고 Set 소속만 읽음 |
| 동일 규칙 중복 | SSOT 유지 | `sessionResponding`(transcript)는 의미가 달라 별도 — plan §10 명시 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 describe('r5 normal completion'·'0249 response attention'·'0249 ΔV3.1'·'r5 모든 채팅 구획') 실재·green.
- **등록 변이 재측정**: 14건 중 검출 14 · 미검출 0. 하네스는 저장소 밖 스크립트로 바이트 치환 → `vitest --reporter=json`(0254 관련 16파일 170케이스) → sha256 원복 확인.
- **자리 미지정 등록 변이**: M1(배선)·M3(자리 맞바꿈)은 단일 자리. M10은 nav/catalog 2자리를 한 치환으로 동시에 맞바꿔 5사이트 red.
- **이전 라운드 대조**: 최초 라운드 — 해당 없음.
- **자기검증 분모**: 구현자 ≠ 검증자. 그래도 보고에 없던 독립 축 X1~X6을 넣었다.

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 app 생성 구독 연결 제거 | 0254 16파일 | red 15 | VP-01·06 등록 |
| M2 열람 행 스피너 금지 | 〃 | red 8 | VP-01 등록 |
| M3 `text-warn`을 아이콘→행 루트로 | 〃 | red 6 | VP-01 등록 |
| M4a ask 조건 제거 | 〃 | red 8 | VP-02 등록 |
| M4b plan 조건 제거 | 〃 | red 7 | VP-02 등록 |
| M4c tool 조건 제거 | 〃 | red 8 | VP-02 등록 |
| M5 주의 표시를 생성 중보다 먼저 | 〃 | red 11 | VP-03 등록 |
| M6 listening/ready도 생성 중 | 〃 | red 2 | VP-03 등록 |
| M7 구독 초기 emit 제거 | 〃 | red 5 | VP-06 등록 |
| M8 키 비교 제거 | 〃 | red 2 | VP-10 등록 |
| M9 store bail-out 제거 | 〃 | red 1 | VP-10 등록 |
| M10 nav/catalog 크기 맞바꿈 | 〃 | red 5 | VP-01 등록 |
| M11 `--animate-dot-wave` 제거 | 〃 | red 1 | VP-07 등록 |
| M12 `@keyframes dot-wave` 이름 변경 | 〃 | red 1 | VP-07 등록 |
| X1 selector(EP-02 자리 d)를 `false`로 | 〃 | red 20 | 독립 — EP-02 다른 자리 |
| X2 생성 중 label을 종류 label로 | 〃 | red 1 | 독립 — AC10 |
| X3 점 지연 중복(320→160ms) | 〃 | red 2 | 독립 — AC9 |
| X4 `motion-reduce:animate-none` 제거 | 〃 | red 2 | 독립 — AC9·D-009 |
| X5 cleanup에서 `stopGenerating()` 누락 | 〃 | red 1 | 독립 — VP-06 |
| X6 `sessions` 동일 참조 skip 제거 | 〃 | **green** | 등가 변이 — 뒤의 `sameKeys`가 같은 emit을 막는다. 성능 전용, 비결함 |

- 동작 보존 추출 라운드인가: 아니오.
- 형제 슬롯 맞바꿈: M3(아이콘 span ↔ 행 루트)·M10(nav ↔ catalog) 모두 red.
- `N회` 관측 주체: AC8 — listener 호출 수와 `generatingSessionIds` 참조 동일성(`chatStore.generating.test.ts`, M8 red).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-08 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | `responseProgress.test.ts` 판정 표 + M4a/b/c red | EP-01 1/1 |
| VP-09 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | `navIconState.test.ts` 12조합 + M5 red | EP-03 공유 |
| VP-10 | MD-03 ↔ UT-03 / UT | REQUIRED | PASS | `chatStore.generating.test.ts`·`sessionsStore.completion.test.ts` + M8·M9 red | EP-02 a·c |
| VP-06 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | 해제·재설치 케이스 + M1·M7·X5 red | EP-02 4/4 · EP-07 1/1 |
| VP-07 | AR-02 ↔ IT-02 / IT | REQUIRED | PASS | `dotsSpinner.test.ts`·i18n 파리티 + M11·M12·X3·X4 red | EP-04 2 · EP-05 2 · EP-06 1 |
| VP-05 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | 'observes the full non-viewed state sequence' green, M4c red | EP-01·02·03 |
| VP-01 | R-01 ↔ AT-01·02·03·09·10·12 / AT | REQUIRED | PASS | hook SSR·nav 5사이트 + M1·M2·M3·M10·X1·X2 red | EP-01~06 |
| VP-02 | R-02 ↔ AT-04 / AT | REQUIRED | PASS | 3종 × 열람 2 + child 3 + 재진입 green, M4a/b/c red | EP-01·02·03 |
| VP-03 | R-03 ↔ AT-05·06·07·08·11 / AT | REQUIRED | PASS | 종료 4종·listen/ready·retained 2종·삭제 green, M5·M6 red | EP-01·02·03 |
| VP-11 | R-0249 ↔ AT-0249 / AT | REGRESSION | PASS | 기존 r5·0249·ΔV3.1 케이스 green | 0 + plan 사유 |
| VP-04 | R-04 ↔ AT-14 / AT | REQUIRED | 실기 대기 | 사람 실기 — §8 | 0 + 시각 |

- root `PAIR_FAIL`: 없음. 종속 `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — 유효 V REQUIRED 10 · REGRESSION 1 전건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | 'projects optimistic send and delta activity to warning dots including viewed rows' + M1·M3 red |
| AC2 | ✅ | 같은 케이스 열람 행 + M2 red |
| AC3 | ✅ | `navSections.render.test.ts` 5 renderers + M10 red |
| AC4 | ✅ | 3종 × {false,true} + child 3종 + 재진입 green, M4a/b/c red |
| AC5 | ✅ | 종료 4종·`turn.ended` 단독·listening/ready green, M6 red |
| AC6 | ✅ | 'generation precedes retained … attention' 2종 green |
| AC7 | ✅ | 기존 describe green |
| AC8 | ✅ | delta 10회 추가 emit 0·참조 동일, M8·M9 red |
| AC9 | ✅ | dots 3·지연 상이·감속 class·CSS 토큰/키프레임 각 1, M11·M12·X3·X4 red |
| AC10 | ✅ | ko label SSR + 파리티, X2 red |
| AC11 | ✅ | unknown/identity-less 이벤트 무영향·삭제 뒤 제외 green |
| AC12 | ✅ | draft → 승격 키 green |
| AC13 | ✅ | §9 gate |
| AC14 | ⚠️ | 사람 실기 대기 |

- **합계 재측정**: ✅ 13 · ⚠️ 1 · ❌ 0 = 총 14 · 자기보고 13/14 · 일치.
- **합계 사본 대조**: 본문 13/14 ↔ trailer `Criteria-Met: 13/14` ↔ INDEX 비고 `✅13·⚠️1/14` — 일치.

### pair별 plan §10 강제 지점 분모

| EP | plan 자리 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| EP-01 | 1(조건 4) | `responseProgress.ts:10-13` 4조건 | 1/1 |
| EP-02 | 4 | (a) `chatStore.ts:575-583` (b) `useSessionCompletion.ts:13` (c) `sessionsStore.ts:275-284` (d) `SessionRow.tsx:62` | 4/4 — 각 자리 M7·M1·M9·X1 red |
| EP-03 | 3 | `SessionRow.tsx:122·210·234` 단일 `modeIcon` | 3/3 |
| EP-04 | 2 | `SessionRow.tsx:78` nav 14 / catalog 20 | 2/2 |
| EP-05 | 2 | `ko.ts`·`en.ts` `sessions.generating` | 2/2 |
| EP-06 | 1 | `tokens.css:6-16` | 1/1 |
| EP-07 | 1 | `docs/arch/frontend/state.md:44` | 1/1 |

- 합계 14/14 — 자기보고와 일치. 표 밖 필요 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | `npm run lint` 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts:22`) |
| typecheck | PASS | node·web·test 3구성 `error TS` 0건 |
| 관련 vitest | PASS | 0254 16파일 170케이스(head 기준, 0255가 같은 테스트 파일에 4케이스 추가) · 0254+0255 합집합 59파일 704 |
| doc inventory | PASS | generated 9 items·102 channels / prose / links ok |
| message-bus | PASS | `4f096797` trailer 6키 파싱 |

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 실기 |
|---|---|---|
| AC14 | 상태·우선순위·class·토큰·label 전부 | light/dark에서 노란 점 3개 파도 시인성 · 생성 → 승인 요청(파랑) → 승인 → 스피너 → 완료 전이 · Windows "애니메이션 효과" 끔 → 정지 |

## 9. 게이트 재실행

- 명령: `cd app && npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run <plan §19 목록>` · `node scripts/check-doc-inventory.mjs --check`.
- `npm test` 미사용 — DB 스위트 없음.
- 게이트가 작업 트리를 바꿨는가: 없음(`git status` = 기존 미추적 `.ko.ts.swp` 1건뿐, 이번 검증 이전부터 존재).
- 검증 중 잔여물: 변이 하네스·probe는 저장소 밖(`%TEMP%/mut`) 또는 실행 후 삭제, 대상 파일 sha256 원복 확인.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE`·다음 Claude → 이번 턴 `verify/PASS`·다음 사람(AC14). 대상 커밋 자리표시자를 `dc138888`(V1 설계)·`4f096797`(r1)로 기입, 두 해시 `git cat-file -t` = commit.
- trailer: 설계 `dc138888` 3키 · 구현 `4f096797` 6키 파싱, 허용값.
- `[구현자 기입]` 7필드 전수 존재(plan:476~597).

## 13. Finding disposition

| # | finding | disposition |
|---|---|---|
| D1 | X6 green — `state.sessions === previous.sessions` skip은 동작 등가 최적화라 잠글 대상이 아님 | NON_BLOCKING(기록만) |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 없음(최초).
- 반복 환경 한계: `rg` 미설치로 `scan-surface.sh` 실행 불가 — grep으로 대체.

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair: REQUIRED 9 PASS + VP-04 실기 대기 · REGRESSION 1 PASS · PAIR_FAIL 0 · PLAN_GAP 0.
- AC: ✅ 13 · ⚠️ 1 · ❌ 0.
- 다음 단계: 사람이 AC14 실기 후 archive 이동.
