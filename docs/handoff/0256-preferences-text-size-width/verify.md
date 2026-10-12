# Verify — 0256-preferences-text-size-width

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0256-preferences-text-size-width` |
| 검증자 | Claude Code |
| 일자 | 2026-10-12 |
| 대상 커밋/range | `de6951ac..5a773f17` = r1 `5a773f17` (gate·회귀는 0259 반영 head `8de244ee`에서도 수행) |
| 구현 전 plan 기준 | `de6951ac` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `de6951ac:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-05(AC12) 시각 실기 대기(비차단) |
| 자기 검증 여부 | **예** — 구현 커밋 `Agent: claude`. 보고에 없던 독립 축 3건(X1·X3·closure `.ts` 재열거)을 넣었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]` 절만 — hunk 시작 줄이 전부 마커(`:481`) 이후(`git diff -U0 5a773f17~1 5a773f17 -- …/plan.md`).
- 기준선이 diff로 성립하는가: 예 — 설계 `de6951ac`, 구현 `5a773f17` 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `de6951ac:plan.md` §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속 V 없음 |
| NEW node ↔ REQUIRED pair | 유효 | R-01~04·SD-01·AR-01·02·MD-01~03 → VP-01~11 |
| INHERITED ↔ REGRESSION | 해당 없음 | INHERITED node 없음 |
| pair별 path·§10 전수·직접 oracle | 유효 | 11행 모두 path·EP·oracle |
| 선택적 적대 증거 | 유효 | 자리·0건·표·형제 pair(VP-02·07~11)에만 M1~M9 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 운영 gate | 유효 | §7-A 4종 |

- root PLAN_GAP: 없음. AC2 음성 술어와 AC3 테스트의 범위 충돌은 의도가 분명해 D1(NON_BLOCKING)로 둔다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | 루트 14.5px 고정 | `app.css:10-12` base `html { font-size: 14.5px }` · TweakProvider에 `fontSize` 0건 |
| D-002 | 밀도 키·UI·코드 제거 | `grep -rni density app/src` 비테스트 0 · zod object가 미지의 키를 버림 |
| D-003·D-005·D-010 | 두 행·설명·옵션·순서 | `GeneralTab.tsx:166-195` |
| D-004·D-009 | 트랜스크립트 글자만 배율 | 효과 `--chat-text-scale` → `TranscriptView.tsx:85` 선언 → `@theme inline` 5토큰 + closure 38자리 calc |
| D-006·D-008 | 너비 기본 960 · `--reading-column` 하나 | `tokens.css` 960px · 효과 `--reading-column` · `ReadingColumn` 3소비 |
| D-007 | 키 이름·`medium` 복구 | `protocol.ts:685-686` `.catch('medium').default('medium')` |

```text
GeneralTab → setTweak(key) → settingsApi.set → SettingsStore.patch(zod) → disk
boot → settings:get → TweakProvider.load → effect setProperty → html style vars
  → TranscriptView root [--transcript-text-scale] → text-body calc / closure calc
  → ReadingColumn max-w-[var(--reading-column)] (transcript · composer)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 문제 없음 | 저장 실패 = 기존 `setTweak` 롤백 · 손상 값 = `.catch('medium')` |
| false success 가능성 | 없음 | 빌드 산출 CSS에 선언·inline 토큰이 실제로 있다(§9: `index-*.css:4688` `--transcript-text-scale: var(--chat-text-scale, 1)` · `:3800` `.text-body` calc) |
| Product/UX A가 아닌 B | 아니오 | 배율 선언은 트랜스크립트 루트 1곳 · 컴포저·포털·우측 패널은 선언 밖 |
| 범위 밖 소비처 | 무영향 | `Markdown` 비트랜스크립트 4소비·`MenuItem`·`AttachmentThumb`은 변수 미선언 → fallback 1 |
| 출력/요청 상한 | 해당 없음 | CSS 변수 1개 갱신 |

## 3. 역방향 탐색

`scan-surface.sh`는 이 환경에 ripgrep이 없어 실행 불가 — 같은 질문을 신규 export 전수 참조 계수로 대신했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export 6종 | 정상 | 6/6 비테스트 참조 ≥2파일(`TRANSCRIPT_TEXT_SCALE` 2 · `TRANSCRIPT_WIDTH_PX` 2 · enum 3 · 타입 5) |
| 테스트 전용 심볼 | 없음 | 위 계수 |
| closure `.ts` 파일의 글자 크기 | 정상 | closure 115파일(.tsx 50 · .ts 65) 재열거 — `.ts` 위반 0(`bubbleCollapse.ts` `fontSize:`는 함수 인자, 0257) |
| 동일 규칙 중복 | SSOT 유지 | 값 목록 `ipc.ts`, 매핑 `theme.ts`, CSS 기본값은 typeScale UT가 대조 |

## 4. 선택된 적대 증거 재측정

- 등록 변이 9건 중 검출 9 · 미검출 0 (§10 "등록 변이" 자리 그대로). 이전 라운드 없음.
- 자기검증 분모: 보고에 없던 축 3건 — X1 다른 지점(EP-01 ④ patch 스키마), X3 같은 계약을 다른 지점에서 깸(전역 변수 이름), closure `.ts` 재열거(§3). 전부 검출/0건.

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 `TranscriptView` 선언 제거 | plan gate 스위트 26파일 | red 2 | VP-02·08 |
| M2 선언을 `Composer` 루트로 이동 | 같음 | red 2 | VP-02 |
| M3 `load()`의 `transcriptWidth` 삭제 | 같음 | red 1 | VP-07 |
| M4 `@theme inline` → `@theme` | 같음 | red 5 | VP-08 |
| M5 small↔large 배율 | 같음 | red 3 | VP-09 |
| M6 medium 폭 768 | 같음 | red 3 | VP-09 |
| M7 `Markdown` 본문 `text-[13.5px]` | 같음 | red 1 | VP-10 |
| M8 closure 걷기 1단계 | 같음 | red 1 | VP-10 |
| M9 두 설명 맞바꿈 | 같음 | red 1 | VP-11 |
| X1 `SettingsPatchSchema` `transcriptWidth` 삭제 | `src/main`+`src/shared` 378파일 | red 1 | VP-06·07 (독립) |
| X3 효과가 `--transcript-text-scale`를 전역에 씀 | theme·styles·transcript 19파일 | red 4 | VP-08 (독립) |

- 형제 슬롯 맞바꿈: M2(선언 자리)·M5(배율)·M9(설명) 검출.
- 동작 보존 추출 라운드: 아니오.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 증거 | §10 전수 |
|---|---|---|---|---|
| VP-09 | MD-01↔UT-01 | PASS | lifecycle 값 표 6 · M5·M6 red | EP-08 2/2 |
| VP-10 | MD-02↔UT-02 | PASS | closure 스캔 위반 `[]` · M7·M8 red | EP-06 38/38 (`grep -o "transcript-text-scale,1))]"` 38) |
| VP-11 | MD-03↔UT-03 | PASS | generalTab render 3 · M9 red | EP-07 3/3 |
| VP-07 | AR-01↔IT-01 | PASS | store "loads the settings projection" · M3·X1 red | EP-01 4/4 · EP-02 3/3 |
| VP-08 | AR-02↔IT-02 | PASS | lifecycle · TranscriptView render · CSS UT · M1·M2·M4·X3 red | EP-03 3/3 · EP-04 7/7 · EP-05 1/1 |
| VP-06 | SD-01↔ST-01 | PASS | store "새 인스턴스에서 유지" · lifecycle `h.patch` 인자 | EP-01·EP-02 |
| VP-01 | R-01↔AT-01~03 | PASS | migration·store(AC3) · CSS(AC2) · render(AC1) | EP-09 51 → 비테스트 0 |
| VP-02 | R-02↔AT-04·06~08 | PASS | 위 UT 공유 | EP-03②·EP-04②·EP-05·EP-06 |
| VP-03 | R-03↔AT-05·09·10 | PASS | lifecycle 3 · typeScale 원문 2 | EP-04③ |
| VP-04 | R-04↔AT-11 | PASS | 문서 `density\|밀도` 0 · `transcriptTextSize` IPC 1·persistence 1·TRD 2 · inventory `--check` exit 0 | EP-10 15 |
| VP-05 | R↔AT-12 | 실기 대기 | 사람 실기(비차단) | 0 |

- root `PAIR_FAIL`·`BLOCKED_BY`: 없음.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | generalTab render 3 · M9 red |
| AC2 | ✅ | CSS UT · lifecycle `fontSize` 미기록 · 비테스트 `density` 0 (D1) |
| AC3~AC5 | ✅ | migration·store UT |
| AC6·AC9 | ✅ | lifecycle 값 표 · M5·M6 red |
| AC7 | ✅ | render + 선언 파일 스캔 · M1·M2 red |
| AC8 | ✅ | closure 스캔 · M7·M8 red |
| AC10 | ✅ | typeScale 원문 UT |
| AC11 | ✅ | §5 VP-04 |
| AC12 | ⚠️ | 사람 실기 |
| AC13 | ✅ | §9 |

- **합계 재측정**: `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` · 자기보고 `✅12·⚠️1` · 일치.
- **합계 사본 대조**: 본문 13 ↔ trailer `Criteria-Met: 12/13` ↔ INDEX `✅12·⚠️1` — 일치.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC12 | 배율 값·선언 자리·closure 규칙·토큰 inline·CSS 산출 | `npm run dev` — 보통/보통이 이전 '넓게'와 같은 글자인지, 작게·크게가 트랜스크립트만 바꾸는지, 좁게·넓게 열 폭, 재시작 유지 |

## 9. 게이트 재실행

- `cd app && npm run lint` → **0 error · 1 warning**(`useTranscriptVirtualizer.ts:22` 기존). 실행 후 `git status` clean — autofix가 트리를 바꾸지 않았다.
- `npm run typecheck` → exit 0 · `error TS` 0건.
- `./node_modules/.bin/vitest run`(전체, head `8de244ee`) → **653 passed · 1 skipped / 6643 passed · 1 skipped · 실패 0**. 로컬 better-sqlite3가 Node ABI 상태라 DB 스위트도 green.
- `node scripts/check-doc-inventory.mjs --check` → exit 0(`generated doc ok` · `prose ok` · `links ok`).
- `./node_modules/.bin/electron-vite build` → exit 0 — CSS 산출에 선언·inline 토큰 확인(§2).
- 잔여물: 변이 실행 후 매번 `git checkout -- app/src app/scripts`, 최종 `git status` clean. `out/`은 gitignore.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` · 다음 주체 Claude(검증) · 대상 커밋 자리표시자 — 실제 상태와 일치. 좌표 `5a773f17`(`git cat-file -t` → commit, `origin/claude/0256-0259-prefs-tooltip-sdk-menu` 포함) 기입.
- trailer: `git log -1 --format='%(trailers:only=true)' 5a773f17` → `Agent`·`Handoff`·`Status`·`Criteria-Met`·`Criteria-Pending`·`Verified-By`·`Co-Authored-By` 7키 파싱.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX·놓친 문제·구현 보고·Review Signals 전부 표/목록으로 존재.
- AGENTS.md 변경: 없음.

## 12. 구현자 코멘트

| 코멘트 | 판단 | 반영 |
|---|---|---|
| #1 AC2 음성 술어를 비테스트로 | 타당 — AC3가 테스트에 `density`를 요구해 원문 술어는 0이 될 수 없다 | D1 |
| #2 CRLF 혼입 → lint 정규화 | 타당 — 현재 트리 lint 0 error | — |
| #3 settlement DB 5건 red | 이번 검증 환경에선 재현 안 됨(전체 green) | — |

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | AC2 음성 술어 `rg -n -i density app/src`가 AC3 테스트 9줄과 충돌 — 비테스트 범위 0건이 의도 | AC2·AC3 문구 | NON_BLOCKING | 설계자가 다음 revision에서 AC2 문구를 `--glob '!*.test.*'`로 정정 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 없음(최초).
- 관련 plan 지침: AC2 술어가 AC3와 같은 트리를 셌다(D1).
- 반복된 검증 환경 한계: `scan-surface.sh`가 요구하는 ripgrep이 Git Bash PATH에 없다.

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair: REQUIRED 10 PASS · VP-05 실기 대기 · PAIR_FAIL 0 · BLOCKED_BY 0.
- PLAN_GAP: 없음.
- AC: ✅12 · ⚠️1(AC12) · ❌0.
- gate: lint·typecheck·전체 vitest·inventory·build·trailer PASS.
- NON_BLOCKING: D1.
- 남은 사람 확인: AC12.
