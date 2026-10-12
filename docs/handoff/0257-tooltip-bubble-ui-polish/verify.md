# Verify — 0257-tooltip-bubble-ui-polish

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0257-tooltip-bubble-ui-polish` |
| 검증자 | Claude Code |
| 일자 | 2026-10-12 |
| 대상 커밋/range | `5a773f17..80671413` = r1 `80671413` (gate·회귀는 head `8de244ee`에서도 수행) |
| 구현 전 plan 기준 | `b3c104b8` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `b3c104b8:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-05(AC14) 시각·OS 툴팁 실기 대기(비차단) |
| 자기 검증 여부 | **예** — 구현 커밋 `Agent: claude`. 보고에 없던 축 4건(Y1~Y4)과 조건부 `title` 분석을 넣었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]` 절만 — hunk 시작 줄이 전부 마커(`:466`) 이후.
- 기준선이 diff로 성립하는가: 예 — 설계 `b3c104b8`, 구현 `80671413` 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `b3c104b8:plan.md` §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속 V 없음 |
| NEW node ↔ REQUIRED pair | 유효 | R-01~04·SD-01·02·AR-01·02·MD-01~04 → VP-01~13 |
| pair별 path·§10 전수·직접 oracle | 유효 | 13행 |
| 선택적 적대 증거 | 유효 | A1·A2·T1~T4·M-host·B1~B4·E1 |
| 운영 gate | 유효 | §7-A 3종 |

- root PLAN_GAP: 없음. AC12가 인용한 `message.id`는 `Message` 타입에 없다 — D-011 계약(버블별 키·재마운트 유지·키 격리)은 구현자가 정할 수 있는 범위라 D3(NON_BLOCKING)로 둔다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-002 | 뷰어 동작 문구 0 · 실패 토스트 유지 | `ArtifactViewer.tsx` status 줄 삭제 · `copied` 아이콘 · 실패 `reportError` |
| D-004·D-007 | 검은 표면·흰 글자, 두 테마 동일 | `tokens.css` `@theme` 3색 · `TOOLTIP_SURFACE` → Popover·차트 |
| D-005·D-006 | 모든 `title`을 호스트가 가로챔 · 500/300ms | `App.tsx` `<TooltipHost/>` → `createTooltipController` → `claimTitle`/`releaseTitle` |
| D-008·D-011·D-012 | 10줄 접기 · 키별 메모리 · 접은 뒤 스크롤 | `UserBubbleText` 측정 → `bubbleOverflows` → `bubbleExpansionStore` → `shouldScrollAfterCollapse` |
| D-009·D-010 | 4소비처 키 · 전체 문장 `title` 제거 | `collapseKey` 4자리 · `title={text\|item.text\|prompt}` 0건 |
| D-013 | effort 설명 제거 | `EffortMenu` 라벨 span만 · `EFFORT_DESC_KEYS` 0 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | 없음 | 빌드 CSS에 `.bg-tooltip`·`--color-tooltip: #0b0b0b`·`10lh` 존재(`index-*.css:150,3193`) |
| 원복 누락으로 `title` 영구 소실 | 없음 | T2 red 11 — release 경로 7종이 잠김 |
| React가 hover 중 `title`을 **제거**하면 | **결함(비차단)** | React의 `removeAttribute('title')`는 이미 옮겨 둔 속성이라 no-op이고 mutation record도 없다 → 떠날 때 `releaseTitle`이 옛 값을 복원한다. 조건부 `title` 3자리(`ApprovalCard.tsx:331` · `TaskContextContent.tsx:161` · `CascadeMenu.tsx:216`) — D1 |
| 클릭 후 OS 툴팁 재등장 가능성 | 실기 확인 필요 | pointerdown이 `title`을 원복하고 포인터는 그 요소 위에 남는다 — Chromium이 다음 mousemove에 흰 툴팁을 띄우는지는 node에서 못 본다(D4) |
| 출력/요청 상한 | 문제 없음 | 리스너 document 6 + window 1 · 표시 중 observer 2 |

## 3. 역방향 탐색

`scan-surface.sh`는 ripgrep 부재로 실행 불가 — 신규 export 24종 참조 계수로 대신했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export | 정상 | 24/24 비테스트 참조 ≥1(정의 파일 내부 사용 포함). `useBubbleExpansionStore`만 외부 소비 0 — 같은 파일의 훅이 쓴다 |
| 테스트 전용 심볼 | 없음 | `tooltipTarget.testlib.ts`는 테스트 fixture |
| `role="tooltip"` 소비 | 2 | `TaskProgressList.tsx:171` · `TooltipHost.tsx:53` — 둘 다 `TOOLTIP_SURFACE` |
| 0건 스윕 재측정 | 0 | `<title>` 비테스트 0 · 버블 전체 문장 `title` 0 · 뷰어 문구 키·`EFFORT_DESC_KEYS` 비테스트 0 |

## 4. 선택된 적대 증거 재측정

- 등록 변이 12건 중 검출 12 · 미검출 0. 이전 라운드 없음.
- 자기검증 분모: 보고에 없던 축 4건 — Y1·Y2 형제 소비처(B3는 `UserMessage`만), Y3·Y4 호스트의 실제 DOM 어댑터(MutationObserver 설정).

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| A1 뷰어 status 줄 복원 | plan gate 스위트 236파일 | red 2 | VP-01 |
| A2 복사 아이콘 항상 `copy` | 같음 | red 2 | VP-01·12 |
| T1 claim이 `title` 유지 | 같음 | red 3 | VP-02·06 |
| T2 release 원복 생략 | 같음 | red 11 | VP-02·06 |
| T3 Popover 표면 `bg-ink text-bg` | 같음 | red 1 | VP-02·08 |
| T4 다크 스코프 `--color-tooltip` 재정의 | 같음 | red 1 | VP-02 |
| M-host `App.tsx` 호스트 제거 | 같음 | red 2 | VP-08 |
| B1 접기 기준 ∞ | 같음 | red 1 | VP-03·11 |
| B2 더 보기↔간략히 보기 | 같음 | red 1 | VP-03 |
| B3 `UserMessage` 키 제거 | 같음 | red 2 | VP-03·07·09 |
| B4 helper 항상 스크롤 | 같음 | red 1 | VP-07 |
| E1 effort 설명 span 복원(ko 문장) | 같음 | red 2 | VP-04·13 |
| Y1 `AskExchange` 키 제거 | chat·shared/ui·styles 206파일 | red 2 | VP-09 (독립) |
| Y2 `SubAgentTileContent` 키 제거 | 같음 | red 1 | VP-09 (독립) |
| Y3 호스트 `attributeFilter: ['title']` → `['aria-label']` | 같음 | **green** | D2 |
| Y4 호스트 트리 observer가 `onDisconnect` 미호출 | 같음 | **green** | D2 |

- Y3·Y4 green의 범위 판정: plan의 AC5 oracle은 "MutationObserver 콜백 모사", AC4 대상 제거도 콜백 구동이다 — 구현은 그 oracle을 채웠고(controller UT), 실제 observer 설정은 plan oracle 밖이다. 현재 코드는 올바르다(`TooltipHost.tsx` `attributeFilter: ['title']` · `!anchor.isConnected`). → NON_BLOCKING D2.
- 형제 슬롯 맞바꿈: B2(라벨)·A2(아이콘) 검출.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 증거 | §10 전수 |
|---|---|---|---|---|
| VP-10 | MD-01↔UT-01 | PASS | tooltipTarget 순수 UT | EP-04 4/4 |
| VP-11 | MD-02↔UT-02 | PASS | 경계 UT · B1 red | EP-07① |
| VP-12 | MD-03↔UT-03 | PASS | 아이콘 단언 · A2 red | EP-08② |
| VP-13 | MD-04↔UT-04 | PASS | effortMenu 행 텍스트 · E1 red | EP-09 3/3 |
| VP-08 | AR-01↔IT-01 | PASS | App 마운트·Popover 원문 · T3·M-host red | EP-01 3/3 · EP-03 1/1 |
| VP-09 | AR-02↔IT-02 | PASS | 소비처 원문·render · B3·Y1·Y2 red | EP-07 ②~⑤ 4/4 |
| VP-06 | SD-01↔ST-01 | PASS | controller 수명 UT · T1·T2 red (어댑터 설정은 D2) | EP-04 · EP-05 7/7 |
| VP-07 | SD-02↔ST-02 | PASS | store·helper·render · B3·B4 red | EP-07 ①⑥ |
| VP-01 | R-01↔AT-01·02 | PASS | actions 14케이스 · A1·A2 red | EP-08 4/4(+`copied` 키 1 선조치) |
| VP-02 | R-02↔AT-03~08 | PASS | tooltip UT·CSS UT · T1~T4 red | EP-01·02·06 |
| VP-03 | R-03↔AT-09~12 | PASS | bubble 순수·store·render · B1~B3 red | EP-07 9/9 |
| VP-04 | R-04↔AT-13 | PASS | E1 red | EP-09 |
| VP-05 | R↔AT-14 | 실기 대기 | 사람 실기(비차단) | 0 |

- root `PAIR_FAIL`·`BLOCKED_BY`: 없음.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·AC2 | ✅ | `ArtifactViewer.actions` · A1·A2 red |
| AC3~AC5 | ✅ | controller UT(499/500ms·트리거 6+떠남·재부착 콜백) · T1·T2 red |
| AC6·AC7 | ✅ | Popover 원문·차트 render · CSS UT · T3·T4 red |
| AC8 | ✅ | `<title>` 비테스트 0 |
| AC9~AC11 | ✅ | 순수·경계·store·render · B1·B2·B4 red |
| AC12 | ✅ | 4소비처 키 · B3·Y1·Y2 red (키 문자열은 D3) |
| AC13 | ✅ | E1 red |
| AC14 | ⚠️ | 사람 실기 |
| AC15 | ✅ | §9 |

- **합계 재측정**: `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15` · 자기보고 `✅14·⚠️1` · 일치.
- **합계 사본 대조**: 본문 15 ↔ trailer `Criteria-Met: 14/15` ↔ INDEX `✅14·⚠️1` — 일치.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC14 | 억제 메커니즘·트리거·표면 클래스·토큰·접기 판정·라벨·키 | 라이트·다크 툴팁 색, 비활성 버튼 툴팁, **버튼 클릭 직후 같은 버튼 위에서 마우스를 움직일 때 흰 OS 툴팁이 뜨지 않는지(D4)**, 긴 메시지 접기(첨부 8), effort 메뉴(첨부 9), 다운로드 중 문구 없음 |

## 9. 게이트 재실행

- `npm run lint` → 0 error · 1 warning(기존) · 트리 변화 없음. `npm run typecheck` → exit 0 · `error TS` 0.
- 전체 vitest(head `8de244ee`) → 653 passed · 1 skipped / 6643 passed · 1 skipped · 실패 0.
- `electron-vite build` → exit 0.
- 잔여물: 변이마다 `git checkout -- app/src app/scripts`, 최종 clean.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` · 다음 주체 Claude(검증) — 일치. 좌표 `80671413`(`git cat-file -t` → commit, 원격 브랜치 포함) 기입.
- trailer: `80671413` 7키 파싱.
- `[구현자 기입]` 7필드 전부 존재.
- 문서: `docs/arch/frontend/ux-domains.md` 두 줄(현재 상태 서술, 이력 표기 없음).

## 12. 구현자 코멘트

| 코멘트 | 판단 | 반영 |
|---|---|---|
| #1 `message.id` 부재 → `user:<createdAt>` | 타당 — `chatReducer.ts:224-232`에 `id` 없음. 라이브 커밋은 `createdAt`을 유지한다(`chatReducer.ts:871`) | D3 |
| #2 `artifactViewer.copied` 키도 삭제 | 타당 — 비테스트 소비 0 | — |
| #3 controller 분리 | 타당 — 단, DOM 어댑터 설정은 미잠금 | D2 |
| #5 DB 5건 red | 이번 환경 재현 안 됨 | — |

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | hover 중 React가 조건부 `title`을 제거하면 떠날 때 옛 값이 복원된다(제거는 mutation record가 없음). 프로덕션 조건부 `title` 3자리 | D-005 메커니즘 · AC 밖 | NON_BLOCKING | 후속 후보 — 옮긴 값을 속성 대신 컨트롤러 상태에 두고 React 제거를 감지할 방법 검토 |
| D2 | `TooltipHost`의 실제 MutationObserver 설정(Y3·Y4)이 테스트로 잠기지 않음 | VP-06 path의 어댑터 edge · plan oracle은 콜백 모사 | NON_BLOCKING | stub MutationObserver로 어댑터 UT 추가 권장 |
| D3 | AC12·§11의 키 `message.id`가 존재하지 않음 — 구현 `user:<createdAt>`. 포크 세션이 복사한 메시지는 같은 키를 공유한다 | AC12 문구 | NON_BLOCKING | 설계자가 AC12 키 표를 정정 |
| D4 | pointerdown 원복 뒤 같은 요소 위 mousemove에서 OS 툴팁이 뜰 수 있다(가설) | AC4 설계 · AC14 | NON_BLOCKING | AC14 실기 항목에 추가(§8) |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 없음(최초).
- 관련 plan 지침: AC12가 존재하지 않는 필드를 인용(D3).
- 반복된 검증 환경 한계: ripgrep 부재로 `scan-surface.sh` 미실행 · OS 툴팁 억제는 node에서 관측 불가.

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair: REQUIRED 12 PASS · VP-05 실기 대기 · PAIR_FAIL 0.
- PLAN_GAP: 없음.
- AC: ✅14 · ⚠️1(AC14) · ❌0.
- NON_BLOCKING: D1~D4.
- 남은 사람 확인: AC14(+D4 확인).
