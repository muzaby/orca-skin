# Verify — 0240-simplify-0223-0239

## 메타

| 항목 | 값 |
|---|---|
| slug | `0240-simplify-0223-0239` |
| 검증자 | Claude Code |
| 일자 | 2026-09-24 |
| 대상 커밋/range | `54eebbf5..a37f4c32` |
| 구현 전 plan 기준 | `54eebbf5` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `54eebbf5:V1` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **예 — 설계·구현·검증 동일 에이전트(같은 세션).** 구현 보고에 없던 적대 축을 §4에 적는다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]` 절 추가만(+22줄). §1~§19 규범 행 불변.
- 기준선이 diff로 성립: 예 — 설계 `54eebbf5` / 구현 `a37f4c32` 분리.
- Decision Ledger · Product/UX · AC · V node/pair · oracle 변경: 없음.
- 채점 기준: `54eebbf5:plan.md` 원문.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속 기준 없음 |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01↔AT-01(VP-01), MD-01↔UT-01(VP-02) |
| 영향받은 INHERITED ↔ REGRESSION | 해당 없음 | 계약·IPC·영속 키 불변(D-002) |
| pair별 path·§10·직접 oracle | 유효 | §10 계약 없음. oracle = 기존 테스트 pass 집합 · `rg` 0건 |
| 선택적 적대 증거 | 유효 | not selected — 동작 보존 추출이라 직접 oracle |
| SUPERSEDED 이관 | 해당 없음 | — |
| 운영 gate | 유효 | subtree · repository · message-bus |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 확인 |
|---|---|---|
| D-001 동작 보존 | 사용자·IPC·DB 관측 동작 불변 | §2 hunk별 등가 판정 + VP-01 |
| D-002 영속 키 불변 | `backgroundJournalKey`·`backgroundEventKey` 무변경 | diff 에 두 함수 hunk 0 |
| D-003 구조 변경 skip | §17 목록만 기록 | diff 에 §17 항목 hunk 0 |

## 2. 구현 결과 비판적 검토 — hunk별 등가

판정: **전 hunk 동작 등가.** 테스트가 닿지 않는 hunk(§4 green 변이)는 코드 대조로 판정했다.

| hunk | 판정 | 근거 |
|---|---|---|
| `attachment-fs` 추출(jira·mail) | 등가 | 본문 문자 단위 동일. `inside(parent, child)` → `isWithinDir(child, parent)` 인자 순서 확인(`paths.ts:94`). 오류 타입은 `unsafe` 팩토리로 보존(`filesystem_error` / `unsafe attachment directory`) |
| `jsonToolResult` | 등가 | jira `resultOf`·mail `result` 본문과 동일 |
| `within` → `isWithinDir` | 등가 | 식 동일, 인자 순서 `(lexical, root)`·`(target, root)` 확인 |
| `errorMessage` · `asString` · `ifPresent` | 등가 | `infra/errors.ts:24` · `shared/obj.ts:6,25` 본문이 제거한 인라인 식과 동일. `ifPresent` 는 `!= null`, `text()` 는 string 만 → undefined 아닌 null 도 이미 제외 |
| `linkOutput` prepare 1회 | 등가 | SQL 3문 공백 외 동일. INSERT 는 기존 `insertPart`(named) 재사용 — 같은 `COALESCE(MAX(idx))` 식 |
| SDK 버전 memo | 등가 | 성공 시에만 캐시 — 실패는 매 호출 재시도(기존과 같음) |
| `service.ts` `check()` 1회 제거 | 등가 | 직전 `check()` 와 사이가 `validateArtifactBytes`·`randomUUID` 동기 코드뿐 — 취소가 끼어들 await 없음 |
| `withTimeout` · `liveResidual` · `emit('unconfirmed')` | 등가 | 타임아웃 판별이 플래그 → 로컬 에러 클래스. 메시지 문자열 동일. `emit` 은 `error` 없으면 키 생략 → 기존 `observe` 인자와 동일 |
| `markMembershipUnknown` | 등가 | 두 루프 본문 동일, `next.tasks` 는 호출 전 복사본 |
| `sessionResponding` | 등가 | `listening === (activityTransport !== 'idle')` 쓰기 지점 5곳 전수 확인(`chatReducer.ts:494·1150·1306·1392·1407`) — 이 불변식에서 두 식 동치 |
| `validFilePaths` `useMemo` | 등가 | 경로 문자열 생성식 동일. `entriesByDir` 는 dir 당 1회만 set(`has` 가드)·cwd 변경 시 동시 초기화 → 합집합 동일. Set 참조가 dir 로드마다 새로 생기나 내용 동일(plan §17 리스크 행) |
| `artifactStore` 분기 통합 | 등가 | 실패: `lastTrashedAt` 키 생략 → 기존 catch 와 동일. 성공: 기존 식 그대로 |
| `isNonExecutionOutcome` · `isAgentTaskName` | 등가 | 술어 동일(`parts.ts:151,339`) |
| `elapsedSeconds !== undefined` 가드 제거 | 등가 | 두 분기 모두 `number` 반환(`canonicalBackground.ts:300`) |
| 죽은 헬퍼 4개 삭제 | 등가 | 기준선 `54eebbf5` 에서 프로덕션 참조 0(`git grep`) |

- false success · partial failure · 상한: 변경 없음(새 경로 없음).

## 3. 역방향 탐색

`scan-surface.sh 54eebbf5..a37f4c32` 후보 판정:

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export(`jsonToolResult`·`attachment-fs` 4종·`isNonExecutionOutcome`) | 배선됨 | 각 2곳 이상 프로덕션 호출 |
| 1a 미사용 export 4건 | 비귀속 | 이번 diff 가 만든 export 아님. `isBackgroundPanelItemVisible`·`backgroundEventKey` 는 파일 내부 사용 — `export` 만 불필요(D2) |
| 2 테스트 전용 `sessionResponding` | 오탐 | 같은 파일 `useChatResponding`(`chatStore.ts:1812`)이 사용 |
| 형제 정책 비대칭(`infra/net` credentials) | 비귀속 | 이번 diff 밖 |
| 중복 규칙 drift | SSOT 유지 | §7 엄격화 sweep |

## 4. 기존 테스트 / semantic 검증

- 동작 보존 추출 라운드: **예** — hunk 되돌림 초록은 판정 근거로 쓰지 않았다. 대신 **행동 변이**를 심었다.
- 선택된 적대 증거: 0건(plan not selected). 인용 변이: 0. 이전 라운드: 없음.
- 테스트 파일 변경 2개: `attachment-store.test.ts`(import 경로만) · `backgroundPresentation.test.ts`(죽은 헬퍼 단언 → state 직접 단언, `safeOutputText` 케이스 삭제). 나머지 테스트 불변 → 아래 green 은 **기존 커버리지 공백**이지 덮개 회귀가 아니다.
- **자기검증 분모 — 보고에 없던 축 16건**: 행동 변이 14 + 기준선 pass 집합 차집합 1 + §8 sweep 엄격화 1.

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M1 `linkOutput` 중복 삽입 가드 제거 | `features/history` | **red** 1 | 자기검증 축 |
| M2 `linkOutput` response_boundary 검사 제거 | 동 | green | D1 공백 |
| M3 `linkOutput` toolRunId → null | 동 | green | D1 공백 |
| M4 `ensurePlainDirectory` parent 봉쇄 제거 | `features/plugins` | green | D1 공백(lstat symlink 가드가 먼저 잡음) |
| M5 stale stage 봉쇄 제거 | 동 | green | D1 공백 |
| M6 `sessionResponding` ready 포함 | `renderer/features/chat` | **red** 2 | 자기검증 축 |
| M7 stop 타임아웃 → `failed` | `src/main` | **red** 1 | 자기검증 축 |
| M8 실패 배치가 `lastTrashedAt` 지움 | `renderer/features/chat` | green | D1 공백 |
| M9 디렉토리 `/` 접미 제거 | 동 | green | D1 공백 |
| M10 `isNonExecutionOutcome` 에 running 포함 | 동 | green | D1 공백 |
| M11 `liveResidual` 술어 반전 | `src/main` | **red** 1 | 자기검증 축 |
| M12 membership `unknown`→`included` | `src` | **red** 3 | 자기검증 축 |
| M13 `jsonToolResult` structuredContent 비움 | `src/main` | **red** 22 | 자기검증 축 |
| M14 background-output canonical root 검사 제거 | `src/main` | **red** 1 | 자기검증 축 |

- 변이 14: red 7 · green 7. green 7 hunk 는 §2 코드 대조로 등가 판정.
- M7·M11·M14 스코프(`src/main`)의 `9 failed` 중 8 파일은 electron 베이스라인 red, 변이 red 는 1 파일.
- 변이 후 작업 트리 복원 확인(`git status --short` 0줄).

## 5. V-pair closeout

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | path / §10 |
|---|---|---|---|---|---|
| VP-02 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | §8 5패턴 재실행 0·0·1·1·0 = 표 N 일치 + 엄격화 차집합 0(§7) | — / 0 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **PASS** | pass 집합 차집합: 기준선 − 현재 = 삭제한 죽은 코드 케이스 1(`removes terminal controls…`) + 경로 의존 이름 1쌍(같은 테스트). 현재 − 기준선 = 그 짝 1 | 각 모듈 기존 호출부 / 0 |

- VP-01 수치: 기준선 5274 pass → 현재 5273 pass(차 1 = 삭제 케이스). 실패 파일 집합 8 = 8 동일(electron 설치 실패).
- root PAIR_FAIL: 없음. BLOCKED_BY: 없음.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 기존 테스트 green | ✅ | VP-01 |
| AC2 정적 게이트 | ✅ | §9 |
| AC3 중복 사본 0건 | ✅ | VP-02 |

- 합계 재측정: `✅ 3 · ⚠️ 0 · ❌ 0 = 총 3`.
- 사본 대조: 본문 3/3 ↔ trailer `Criteria-Met: 3/3` ↔ INDEX 비고 — 일치.

### §10 강제 지점

해당 없음 — plan §10 계약 없음.

### 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | node·web·test 3구성, error 0 |
| eslint(변경 29파일) | PASS | error 0 · warning 0 |
| `npm run lint`(전체) | PASS | error 0 · warning 1(`useTranscriptVirtualizer.ts` — 변경 밖 기존) |
| vitest 전체 | PASS(환경 분리) | 569파일 중 560 pass · 1 skip · 8 fail(기준선 동일 집합) / 5273 pass · 3 skip |
| doc-inventory `--check` | PASS | generated·prose·links ok |
| `node --test scripts/*.test.mjs` | PASS | 120/120 |
| trailer 파싱 | PASS | §11 |

## 7. 숫자 / 음성 기준 재측정

- §8 패턴 재실행: WINDOWS_RESERVED/inside 0 · within 0 · `structuredContent:` 1(`runtime-tools.ts:50`) · 비실행 술어 1(`parts.ts:152`) · 죽은 헬퍼 0.
- 엄격화(파일 한정 → `src` 전체, 정의 이름 전수): `safeSegment|ensure*Directory|cleanupStaleStages|sanitizeAttachmentFilename` 정의 = `attachment-fs.ts` 4곳만. `startsWith('..') && !isAbsolute` = `paths.ts:96` 1곳. 비실행·Agent/Task 술어 multiline 변형 = 정의부만.
- 엄격화에 걸린 비사본: `mail/store/index.ts:78`(accountId 예약어 **거부**)·`artifacts/validation.ts:38`(다른 문자 집합)·`artifacts/tool.ts:76`(structuredContent 없는 envelope) — 계약이 달라 사본 아님.

## 8. 사람 실기

없음 — 관측 동작 불변, 전부 기계 판정.

## 9. 게이트 재실행

- 명령: `npm run typecheck` · `npx eslint <변경 29파일>` · `npm run lint` · `./node_modules/.bin/vitest run`(현재·기준선 worktree 각 1회, json reporter 로 집합 비교) · `node scripts/check-doc-inventory.mjs --check` · `node --test scripts/*.test.mjs`.
- `npm test` 미사용 — DB ABI 전환 불필요(vitest 에서 DB 스위트 실행됨).
- 환경 분리: 8파일 전부 `Electron failed to install correctly` — 기준선·현재 동일 집합(`diff` 0줄).
- 게이트의 트리 변경: 없음(autofix 미사용). 잔여물: 기준선 worktree 제거, 로그는 scratchpad.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE`·다음 Claude — 실제 상태와 일치. 대상 커밋 자리표시자를 `54eebbf5`(설계)·`a37f4c32`(r1)로 기입(`git cat-file -t` → commit, `origin` 브랜치 head = `a37f4c32`).
- trailer: `a37f4c32` 파싱 7키(Agent·Handoff·Status·Criteria-Met·Verified-By·Co-Authored-By·Claude-Session), `54eebbf5` 5키 — 허용값 준수.
- `[구현자 기입]` 필드: 설계 리뷰 · 강제 지점/V-pair · 구현 보고(AC 검산·게이트) 3개만. `이번 라운드 수정의 잠금`·`Product/UX 파생 검토`·`놓친 잠재 문제`·`Review Signals` 4필드 누락(D3). 내용상 모두 `해당 없음` 에 해당하고 이번 검증이 §2·§4로 독립 확인했다.
- AGENTS 변경: 없음.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | 변경 hunk 7곳이 기존 테스트에 잠겨 있지 않다(M2·M3·M4·M5·M8·M9·M10 green) — `linkOutput` boundary/toolRunId, 첨부 parent·stale 봉쇄, 실패 배치 `lastTrashedAt` 보존, 디렉토리 `/` 접미, 비실행 술어 | 비귀속(plan 적대 증거 not selected, 테스트 파일 불변 → 기존 공백) | NEXT_HANDOFF | 테스트 보강 후보. 첨부 봉쇄(M4·M5)가 보안 경계라 우선 |
| D2 | `isBackgroundPanelItemVisible`·`backgroundEventKey` 가 파일 내부 전용인데 export | 비귀속(diff 밖) | NON_BLOCKING | 기록 |
| D3 | `[구현자 기입]` 7필드 중 4필드 누락 | 운영 형식 | NON_BLOCKING | 기록 — 판정 증거는 이번 verify 가 독립 확보 |

## 14. Review Signals — 사실만

- 이전 라운드: 없음(r1).
- 관련 plan 지침: plan 이 VP-01 oracle 을 "기존 테스트 green" 으로 두었고, 그 oracle 이 닿지 않는 hunk 가 7곳 있었다(D1).
- 사용자 결정 변경: 없음.
- 반복 환경 한계: electron 바이너리 미설치로 `bootstrap.*`·`chat-turn*` 8파일 미실행 — 0237 r7 도 electron 미설치 8파일을 분리했다.
- impl `[구현자 기입]` 이 r1 에서 필드 4개를 생략했다(D3).

## 15. 결론

- 상태: **PASS**
- pair: REQUIRED 2/2 PASS · PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0.
- ACTIVE Decision D-001~003 충족. AC ✅3/3.
- 운영 gate 전부 PASS(electron 8파일 기준선 동일 분리).
- 자기검증 독립 축 16건 — 행동 변이 red 7 · green 7(코드 대조로 등가), 집합 차집합·sweep 엄격화 일치.
- NEXT_HANDOFF D1 · NON_BLOCKING D2·D3.
- 남은 사람 확인: 없음. 다음 단계: archive 이동.
