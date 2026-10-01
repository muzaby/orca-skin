# Verify — 0246-sdk-update-model-default-effort

## 메타

| 항목 | 값 |
|---|---|
| slug | `0246-sdk-update-model-default-effort` |
| 검증자 | Claude Code |
| 일자 | 2026-10-01 |
| 대상 커밋/range | `a55d607a..bce67994` |
| 구현 전 plan 기준 | `a55d607a` (V1 `b035a114` + ΔV1) |
| V mode / 유효 V | `Delta V` / `V1@b035a11 + ΔV1@a55d607` |
| 검증 기준 plan revision | `b035a114:V1` / `a55d607a:ΔV1` |
| 라운드 | 1 |
| 상태 | **PASS** (기계 범위 — AC16′ 사람 실기 대기) |
| 자기 검증 여부 | 아니오 — 구현 Codex(`Agent: codex`), 검증 Claude. 그래도 보고에 없던 축 1건을 추가 측정했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` diff는 메타 `상태` 1행과 `[구현자 기입]` 채움뿐이다 — Decision·Part I·AC·V·§10·등록 변이 변경 0.
- 기준선은 diff로 성립한다: 설계 `b035a114`·`a55d607a`와 구현 `bce67994`가 분리돼 있다.
- 채점 기준: V1 AC1~AC11·AC13~AC15 + ΔV1 AC12′·AC16′(16행), pair VP-01~VP-16(VP-05·15·16은 ΔV1 대체행), 등록 변이 M1~M12.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | ΔV1이 `V1@b035a11` 을 명시하고 대체행(AC12′·AC16′·VP-05/15/16·EP-07′)을 적었다 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | CHANGED R-05·AT-12·AT-16·MD-04·UT-04 → VP-05·VP-15·VP-16 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | 구현 전 결정 변경이라 V1 pair가 모두 REQUIRED로 유효 — REGRESSION 대상 없음 |
| pair별 path·§10 전수·oracle | 유효 | 16 pair 모두 path·자리 수·직접 oracle 보유 |
| 선택 적대 증거 | 유효 | 데이터(M1·M2·M12)·분기(M5·M6)·배선(M7·M8)·순서/기록(M9·M10)·SSOT(M3·M4)·형제 슬롯(M11) |
| SUPERSEDED 이관 | 유효 | D-010 → D-014·D-015, V1 AC12 증거(M11)는 AC12′로 이관 |
| 운영 gate | 유효 | 6행, electron 미설치 8파일을 기준선 한계로 분리 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | SDK `0.3.286`, 별칭이 5.5로 해석 | `package.json` → 설치 SDK·플랫폼 패키지 `0.3.286` → 번들 CLI `opus`→`claude-opus-5-5` |
| D-002~D-005 | Claude 표·별칭·커스텀 `high` | `SET_MODEL` → `defaultEffortForModel` → `parseClaudeModelName` |
| D-006·D-011 | 같은 선택은 수동값 유지, 선택 변경은 재설정 | `chatReducer.ts:1470-1479` `selectionChanged` |
| D-007 | 라이브 채널 다음 턴 적용 | `send.ts:508` → `session-runtime.ts:432` → `claude.ts:759-761` `applyFlagSettings` → CLI |
| D-008·D-009 | main 재계산 0, 파서 shared 단일 | main에 `defaultEffortForModel` 호출 0 · `classifyContextModel` 위임 |
| D-014·D-015 | 메뉴 기본 수준 옆 '추천', 정적 '기본값' 제거 | `Composer.tsx:495` → `EffortMenu.tsx:34-38` · ko/en `high.desc` |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 타당 | `applyFlagSettings` reject → push 전 throw → `appliedEffort` 불변 → 다음 send 재적용(M9 red로 기록 순서 잠김) |
| false success | 없음 | 입력 push 실패(`stream_closed`) 시 `appliedEffort` 는 갱신됐지만 채널이 닫혀 respawn이 새 spawn effort를 쓴다 — 실효 차이 없음 |
| partial failure | 수용 | `setModel` 성공 뒤 effort 적용 실패면 모델만 바뀐 채 턴 오류. 다음 send가 model·effort를 다시 싣는다(`session-runtime.ts:431-432`) |
| A가 아닌 B | 아니오 | 칩 불변·메뉴만 '추천'(D-014) 확인 |
| 라이브 `setModel` 이 CLI effort를 되돌리는가 | 아니오 — 실측 | 아래 §4 P1~P4: effort가 `appliedEffort` 와 같아 적용을 건너뛴 모델 변경 턴도 요청 effort 유지 |
| 요청 상한 | 유지 | `applyFlagSettings` 턴당 ≤1 (프로덕션 호출 1곳, 값 변경 시만) |

- 관측(비결함): CLI는 라이브 `setModel` 시 `max_tokens:1`·`"Hi"` 모델 검증 요청을 1회 보낸다(effort 없음). CLI 고유 동작이고 턴 요청이 아니다.

## 3. 역방향 탐색

`scan-surface.sh` 는 이 환경에서 `rg` 를 찾지 못해 실행되지 않았다 — 같은 검사를 수동으로 했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export 프로덕션 참조 | 정상 | `parseClaudeModelName`(2)·`defaultEffortForModel`(2)·표·별칭(smoke) 소비. `CLAUDE_NAME_FAMILIES`·`CLAUDE_UNLISTED_EFFORT`·`CUSTOM_MODEL_EFFORT` 는 모듈 내부 소비 — 문제 아님 |
| 테스트 전용 symbol | 없음 | 테스트가 로컬 재구현 없이 production 모듈을 import |
| 형제 정책 비대칭 | 의도 | `AUTO_PERMISSION_MODEL_PATTERN` 은 별도 유지 — 주석(`model-identity.ts:57-58`)이 "권한 판정은 더 엄격"을 명시(0215) |
| producer ↔ consumer | 일치 | 칩 = `state.effort`, 태그 = `defaultEffortForModel(modelFamily)` — reducer와 같은 함수·같은 입력 |
| 세션 재열기 경로 | §5와 일치 | `LOAD_SESSION` → `initialChatState`(effort `high`, `modelFamily` null) → Composer hydration `setModel` → 선택 변경 → 기본값 |
| 규칙 중복 | 없음 | `rg "new RegExp" claude-context-policy.ts` → 0 |

## 4. semantic 검증 / 적대 증거 재측정

- 등록 변이 12건 재측정: 검출 12 · 미검출 0. 케이스 수가 구현 보고와 전부 같다.
- 이전 라운드: 없음(r1).
- 보고에 없던 축: 라이브 모델 변경과 effort 건너뛰기의 상호작용(P1~P4) — 실제 CLI, 결함 없음.

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 Opus 5.5 행 삭제 | `model-effort.test` | red 8/34 | VP-02·13 |
| M2 4.7↔4.8 값 교환 | effort UT · smoke A | red 3/34 · A 2행 fail | VP-02·13 |
| M3 계열 앞 버전 분기 제거 | identity · context | red 1/65 · 1/52 | VP-12 |
| M4 버전 `.` 구분자 제거(앞·뒤 두 정규식) | identity · context | red 2/65 · 6/52 | VP-12 |
| M5 항상 재설정 | reducer · store | red 1/9 · 0/8 | VP-03·14 |
| M6 재설정 안 함 | reducer · store | red 6/9 · 6/8 | VP-03·14 |
| M7 runtime effort 전달 제거 | runtime · smoke C | red 1/75 · `[high,high,high]` | VP-04·09 |
| M8 `applyFlagSettings` 제거 | adapter · smoke C | red 3/5 · `[high,high,high]` | VP-04·07 |
| M9 기록을 await 앞으로 | adapter | red 1/5 | VP-10 |
| M10 적용을 push 뒤로 | adapter | red 3/5 | VP-10 |
| M11 '추천'을 현재 선택 행에 | render | red 3/4 | VP-05·15 |
| M12 `opus` 별칭 5.0 | effort UT · smoke B | red 3/34 · B opus fail | VP-13 |
| P1 Sonnet 5.5 `medium` → Opus 4.7 `medium` | 실 CLI 3턴 | 턴 요청 `[medium, medium, medium]` | 추가 축 — green(결함 없음) |
| P2 `high` → `low`(적용) → Opus 4.7 `low` | 실 CLI | `[high, low, low]` | 추가 축 — green |
| P3 Opus 5.5 `medium` → 4.7 `xhigh` → Sonnet 5.5 `medium` | 실 CLI | `[medium, xhigh, medium]` | 추가 축 — green |
| P4 Opus 4.7 `high` → Opus 5.5 `high` | 실 CLI | `[high, high]` | 추가 축 — green |

- 형제 슬롯 맞바꿈: M11이 그 변이다(기본 수준 ↔ 현재 선택).
- `N회` 관측 주체: SDK mock `applyFlagSettings` 호출 로그 + 실 CLI 요청 수(smoke C spawn 1).
- 순서 관측: mock 로그 `['apply','push']`(M10 red로 민감도 확인).
- 재현: `node <scratch>/mutate.mjs` — 각 변이 뒤 원본 복원, 실행 후 `git status` clean.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|
| VP-12 | MD-01 ↔ UT-01 | PASS | identity 65·context 52 pass; M3·M4 두 스위트 red | EP-02 2/2 |
| VP-13 | MD-02 ↔ UT-02 | PASS | AC4 표 34 pass; M1·M2·M12 red | EP-01 2/2 · EP-08 14/14 |
| VP-14 | MD-03 ↔ UT-03 | PASS | reducer 9 pass; M5·M6 red | EP-03 1/1 |
| VP-15 | MD-04 ↔ UT-04 | PASS | render 4 pass; M11 red | EP-07′ ① 1/1 |
| VP-08 | AR-01 ↔ IT-01 | PASS | store 8 pass — 새·기존 대화 payload | EP-04 ①② 2/2 |
| VP-09 | AR-02 ↔ IT-02 | PASS | send 하네스 `medium`/생략 · runtime `pushed[0].effort='low'`; M7 red | EP-04 ⑤ · EP-05 ①② 3/3 |
| VP-10 | AR-03 ↔ IT-03 | PASS | adapter 5 pass; M9·M10 red | EP-05 ③④⑤ 3/3 |
| VP-11 | AR-04 ↔ IT-04 | PASS | typecheck 3구성 0 오류 · `sdkVersion '0.3.286'` · Monitor 입력 `persistent` 0 | EP-06 6/6 |
| VP-07 | SD-01 ↔ ST-01 | PASS | smoke C `[high, low, low]`·spawn 1; M7·M8 red | EP-05 ③④⑤ 3/3 |
| VP-01 | R-01 ↔ AT-01·02 | PASS | `npm ls` `0.3.286` · lock SDK+플랫폼 8종 = 9항목 `0.3.286` · smoke B 4/4 | EP-06 · EP-08 ② |
| VP-02 | R-02 ↔ AT-03..06 | PASS | smoke A 10/10 · D · AC4 UT · store payload | EP-01 · EP-04 · EP-08 ① |
| VP-03 | R-03 ↔ AT-07·08 | PASS | reducer 4케이스 · fork/handoff `max` | EP-03 · EP-04 ③④ |
| VP-04 | R-04 ↔ AT-09..11 | PASS | smoke C + IT; M7·M8 red | EP-05 5/5 |
| VP-05 | R-05 ↔ AT-12 | PASS | render + i18n | EP-07′ 5/5 |
| VP-06 | R-06 ↔ AT-13..15 | PASS | gate §9 · smoke E 2/2 · AC15 `rg` | EP-06 · EP-09 4/4 |
| VP-16 | R-01·02·04·05 ↔ AT-16 | 사람 실기 대기 | 실 계정 필요 | 0 |

- root `PAIR_FAIL`: 없음 · `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — REQUIRED 16 전건 + 운영 gate 전건.

### AT / AC

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | `npm ls` `0.3.286` · win32-x64 설치본 `0.3.286` · lock SDK+플랫폼 전부 `0.3.286` · 식별 테스트 |
| AC2 | ✅ | smoke B: `opus`→`claude-opus-5-5` · `sonnet`→`claude-sonnet-5-5` · `fable`→`claude-fable-5-1` · `haiku`→`claude-haiku-4-5-20251001` |
| AC3 | ✅ | smoke A 10행 일치 · D Haiku 요청 `output_config.effort` 없음 |
| AC4 | ✅ | `model-effort.test` 34 pass |
| AC5 | ✅ | 파서 정의 외 호출 2 · 정책 파일 `new RegExp` 0 · M3·M4 두 스위트 red |
| AC6 | ✅ | reducer + store payload |
| AC7 | ✅ | reducer 4케이스 · M5·M6 red |
| AC8 | ✅ | store fork/handoff `max` |
| AC9 | ✅ | send 하네스 · runtime fake channel |
| AC10 | ✅ | adapter 5 pass · M8·M9·M10 red |
| AC11 | ✅ | smoke C `[high, low, low]` |
| AC12′ | ✅ | render 4 pass · ko '추천' / en 'Recommended' · `high.desc` 정적 기본값 0 |
| AC13 | ✅ | lint 0 error · typecheck 0 · vitest 607파일 5866 pass · 1 skip · 0 fail |
| AC14 | ✅ | smoke E 두 모델 `[1m]` 제거 + `context-1m-2025-08-07` |
| AC15 | ✅ | 음성 0·0 · 양성 1 · `turn.ts:117-119`·`claude.ts:749-751` 주석 정정 |
| AC16′ | ⚠️ | 사람 실기 대기 |

- 합계 재측정: ✅15 · ⚠️1 · ❌0 = 16. 자기보고 15/16과 일치.
- 사본 대조: 본문 15/16 = trailer `Criteria-Met: 15/16` = INDEX 비고 `✅15·⚠️1/16`.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint · typecheck | PASS | lint 0 error · 1 warning(기존 `useTranscriptVirtualizer`) · typecheck node/web/test 0 오류 |
| vitest 전체 | PASS | Node ABI에서 607파일 · 5867케이스 = 5866 pass · 1 skip · 0 fail |
| smoke | PASS | 18/18 ok, exit 0 |
| 빌드 산출 | PASS | `electron-vite build` 성공 · `out/main/index.js:16` SDK `require` 유지 |
| 문서 인벤토리 | PASS | generated·prose·links ok |
| scripts 단위 | PASS | `node --test scripts/*.test.mjs` 128/128 |
| trailer 파싱 | PASS | `bce67994` 6키 파싱 |

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| AC16′ | 표·별칭·라이브 적용·[1m]은 smoke(실 CLI·루프백), 메뉴 태그는 render | 실 계정으로 Opus/Sonnet 5.5 대화 완료 · 칩 Opus/Sonnet 5.5 '중간'·Fable '높음' · 대화 중 effort 변경 후 다음 턴 정상 · 메뉴의 '추천' 위치 |

## 9. 게이트 재실행

- 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run --reporter=json` · `node scripts/smoke-effort-sdk.mjs` · `./node_modules/.bin/electron-vite build` · `node scripts/check-doc-inventory.mjs --check` · `node --test "scripts/*.test.mjs"`.
- 첫 vitest는 Electron ABI 상태라 DB 35파일 187케이스가 `better_sqlite3.node` ABI 오류로 실패했다(전부 같은 서명). `ensure-sqlite-abi.mjs node` 로 의도적으로 전환한 뒤 위 0 fail을 얻었다.
- 게이트가 작업 트리를 바꿨는가: 없음 — lint 뒤 `git status` clean.
- 잔여물: Electron ABI로 되돌렸다(`ensure-sqlite-abi electron` → `already ok`). 되돌리는 중 D1을 발견했다.

## 11. Repository operation checks

- INDEX: 상태·다음 주체 갱신, 대상 커밋 좌표 `a55d607a`(ΔV1)·`bce67994`(r1)를 `git cat-file -t` 로 확인해 기입. 비고 5줄 이내.
- trailer: `Agent: codex` · `Handoff` · `Status: implemented` · `Criteria-Met/Pending` · `Verified-By: pending` — 허용값·파싱 정상.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX·잠재 문제·구현 보고·Review Signals 전부 존재.
- AGENTS 변경 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 | 반영 |
|---|---|---|
| smoke C 진입을 어댑터 직호출에서 `SessionRuntime` 으로 올림 | 타당 — 구현 세부 보완 | M7이 smoke C에서 red로 관측돼 등록 증거가 실제로 성립한다. 제품 계약 불변 |
| send 케이스를 `send.permission-mode.test.ts` 에 추가 | 타당 — §11이 허용 | — |
| N1~N3 새 oracle | 타당 | 표 중복·별칭 집합·spawn 수 oracle — 이번 검증은 등록 M만 재측정 |

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `ensure-sqlite-abi.mjs electron` 이 `npm rebuild`(Node ABI) 뒤 남은 `build/Release/.forge-meta`(`x64--140`) 때문에 `@electron/rebuild` 가 건너뛰는데도 `electron: rebuilt` 를 출력하고 바이너리는 Node ABI로 남는다. `.forge-meta` 삭제 후 정상 | 비귀속(0104 도구) | NEXT_HANDOFF | `npm test` → `npm run dev` 순서에서 재현 여부 확인 후 새 handoff 후보 |
| D2 | `scan-surface.sh` 가 이 Windows Git Bash 환경에서 `rg` 를 찾지 못한다 | 비귀속(verify 도구) | NON_BLOCKING | 기록 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(r1).
- 관련 plan 지침: smoke C 기술 예시(어댑터 직호출)와 M7 자리(runtime)가 어긋났고, 구현자가 runtime 진입으로 보완했다.
- 사용자 결정 변경: ΔV1(D-014) — 구현 전 반영.
- 반복된 환경 한계: better-sqlite3 ABI 전환. 이번에는 Electron 복귀 경로의 false "rebuilt"(D1)가 추가로 관측됐다.

## 15. 결론

- 상태: **PASS** (기계 범위).
- pair: REQUIRED 16 중 PASS 15 · 사람 실기 대기 1(VP-16) · PAIR_FAIL 0 · PLAN_GAP 0.
- AC: ✅15 · ⚠️1 · ❌0.
- 운영 gate: 7행 전부 PASS.
- NEXT_HANDOFF D1 · NON_BLOCKING D2.
- 다음 단계: 사람이 AC16′ 실기 → 통과 시 archive 이동.
