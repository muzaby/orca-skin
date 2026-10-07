# Verify — 0253-simplify-0241-0252

## 메타

| 항목 | 값 |
|---|---|
| slug | `0253-simplify-0241-0252` |
| 검증자 | Claude Code |
| 일자 | 2026-10-07 |
| 대상 커밋/range | `a27b93ec~1..a27b93ec` (구현) · `46797e8c` (사후 plan) · `1843e28d` (구현 보고) |
| 구현 전 plan 기준 | **없음** — 구현이 plan 보다 먼저 커밋됨(plan §0) |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `46797e8c:V1` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **예** — 구현·설계·검증 모두 Claude. 보고에 없던 적대 축 4종을 분모에 넣었다(§4) |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립하지 않는다.** 구현 `a27b93ec` 가 plan `46797e8c` 보다 먼저다 — "AC를 구현에 맞춰 바꿨는가"는 **확인할 수 없었다**.
- 대응: plan 이 단언하는 계약을 구현의 *부모 커밋*(`a27b93ec~1`) 대비 **동작 동일**로 재정의해 채점했다. 기준 원문(plan §1): "사용자·IPC·DB 관측 동작은 바이트 단위로 같고, 코드만 줄어든다."
- 구현 커밋은 `plan.md` 를 건드리지 않았다(plan 미존재). 보고 커밋 `1843e28d` 는 `[구현자 기입]` 절만 추가.
- Decision Ledger·Product/UX·AC·V 변경: 해당 없음(V1 최초).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 상속 V 없음 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | MD-01~09 ↔ VP-01~09 (UT) |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-10 집계 회귀(부모 대비 FAIL 집합 diff) |
| pair별 path·§10 전수·직접 oracle | 유효 | §10 27지점. VP-08 oracle 이 "코드 리뷰"뿐 — 검증자가 직접 probe 로 보강(§4), PLAN_GAP 아님 |
| 선택적 적대 증거·선택 이유 | 유효 | 전 pair `not selected — 직접 결과 단언`. 동작 보존 추출이라 hunk 되돌림이 무의미 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 현재 변경 운영 gate·범위 | 유효 | typecheck·lint·vitest 기준선 diff·trailer |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 |
|---|---|---|
| D-001 동작 변경 정리 금지 | 관측 동작 동일 | ✅ 부모 대비 테스트 FAIL 집합 동일·헬퍼 의미 대조(§2) |
| D-002 artifact availability 보류 | `artifactStore`·IPC 불변 | ✅ diff 30파일에 없음 |
| D-003 구조 변경 4건 범위 밖 | 해당 파일 미변경 | ✅ |
| D-004 효율/보안 개선 범위 밖 | `probeRepo` 본문·`plan-file`·`tracker` 미변경 | ✅ (`probe.ts` 는 헬퍼 2개 추가만) |
| D-005 `resolveRepoRoot`/`resolveHeadRef` 유지 | 존재 | ✅ `repository.ts` 에 잔존 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 큐 origin 제거가 다른 확정 규칙을 바꾸는가 | 아니오 | 부모의 `'steer'` 리터럴은 타입 정의 1곳뿐, `reserve*` 프로덕션 호출 3건 전부 `'turn-open'`, `takeForRespawn` 은 원래 `'turn-open'` 재스탬프 → model-output 필터의 origin 술어가 항상 참이었다 |
| `prepareNext` 클로저가 제어 흐름을 바꾸는가 | 아니오 | `break`/`continue` 가 문자열 반환으로 1:1 대응, 라벨 루프 아님, `resumeAborted` 는 호출 시점에 읽혀 인라인과 동일 |
| auth `accept` 동치 | 동치 | login-required 는 `true && !isBareOrigin(origin ?? '')` — 타입상 origin 은 `string`, 런타임 undefined 여도 `new URL` 실패로 둘 다 false·메시지 `origin "undefined"` 동일 |
| `fromClaudePermissionMode` 의 미지 값 | 동치 | `NORMALIZED_MODES.find` 는 테이블 값과 `===` 비교만 — `'toString'` 등 prototype 키도 undefined |
| `gitExecutable` reject 시 영구 캐시 | 발생 안 함 | `resolveGitExecutable` 의 기본 `isFile` 이 try/catch, 나머지 경로에 throw 없음(`git-executable.ts:11-35`) |
| `PendingSteerTurn` selector | 동치 | `useChatActivity` 는 같은 `s.sessions[s.activeKey].session.activityForeground` 를 shallow 로 내보냈다(`chatStore.ts:1966`) |
| `isRecord` 치환 | 동치 | `!value || typeof !== 'object' || isArray` ↔ `typeof === 'object' && !== null && !isArray` — 동일 집합 |
| false success·부분 실패·상한 | 해당 없음 | 상태·쓰기·fan-out 신규 없음 |

## 3. 역방향 탐색

`scan-surface.sh` 는 `rg` 부재로 실행 불가 → `git grep` 으로 수동 대체.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export `headOid`/`headName`/`clampErrorDetail`/`appErrorKey` | 정상 | 프로덕션 호출 4·6·2·2줄 |
| 테스트 전용 참조 | 없음 | D-005 래퍼는 plan 이 명시 유지 |
| 동일 규칙 잔존 사본 | 0 | 엄격 sweep: `\0${` 템플릿은 `app-error.ts` + 무관 `queries.ts:481`(파일 해시 키) · `slice(0, X - 1) + '…'` 는 `app-error.ts` 1건 · `'bypassPermissions'` 매핑은 테이블 1곳(`claude-settings.ts` 는 escalation 집합, 별개 규칙) |
| HEAD 파생 삼항 | 부모 10 → HEAD 정의 2줄 | `head\.(oid|name)` 비-테스트 직접 접근도 `probe.ts` 외 0 |
| 소비처 영향(`TrackedBatch.origin` 읽는 곳) | 0 | 부모에서도 `pending-message-queue.ts` 내부만 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 케이스 실재: `pending-message-queue.test.ts:161`(echo)·`:173`(model-output) ✅, `permission-mode.test.ts` 6종·unknown ✅, `pendingSteerControls.test.ts` ✅.
- **plan 서술 부정확(NON_BLOCKING D3)**: "steer 전용 케이스 1건 삭제"라 했으나 실제 −2 — `pending-message-queue` 1건 삭제 + `turn-coordinator` `it.each(['turn-open','steer'])` 를 1건으로 합침. 두 매개변수 모두 echo 확정 경로라 커버리지 손실 없음.
- 동작 보존 추출 라운드: **예** — hunk 되돌림 초록은 근거로 쓰지 않았다. 대신 **헬퍼 자체에 결함을 심어** 기존 스위트의 민감도를 쟀다.
- **자기검증 분모** — 보고에 없던 축 4종: (a) 헬퍼 결함 변이 15건, (b) §10 분모 독립 재열거 + 엄격 sweep(§3), (c) 부모 대비 *테스트 단위* FAIL/존재 집합 diff, (d) AC8 직접 probe(임시, 미커밋).

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 `headOid` detached → null | git·worktrees·chat-turn | red (8) | VP-02 |
| M2 `headName` 항상 null | 동일 | red (19) | VP-02 |
| M3 `clampErrorDetail` `>` → `>=` | shared·error-report·errors | **green** | VP-03 → D1 |
| M4 `appErrorKey` detail 제거 | 동일 | red (5) | VP-03 |
| M5 테이블 plan↔dont_ask 맞바꿈 | shared·adapters | red (4) | VP-04 |
| M6 cacheRead↔cacheCreation 맞바꿈 | adapters | red (8) | VP-05 |
| M7 `prepareNext` resume → break | main/app | red (91 vs 기준 88) | VP-06 |
| M8 `prepareNext` teardown 제거 | main/app | red (89 vs 기준 88) | VP-06 |
| M9 login-free undefined origin 거부 | auth | red (4) | VP-07 |
| M10 duplicate 검사 제거 | auth | red (2) | VP-07 |
| M11 null 캐시 | 기존 infra/git | **green** | VP-08 → D2 |
| M11 null 캐시 | 검증자 probe | red | VP-08 |
| M14 in-flight 공유 제거(`??=`→`=`) | 검증자 probe | red | VP-08 |
| M12 selector 필드 맞바꿈(`activityQueuedCount`) | transcript | red (3) | VP-09 |
| M13 model-output 확정을 `submitted` 로 한정 | features/chat | red (1) | VP-01 |

- 검산: 변이 15행 · red 13 · green 2(M3·기존 스위트 M11) — 둘 다 plan 이 적대 증거를 선택하지 않은 pair 의 테스트 민감도 사실이라 NON_BLOCKING.
- 부모 구현(`a27b93ec~1:git-executable.ts`)을 probe 에 대면 공유 케이스만 red, 미발견 비캐시는 green — 개선점과 보존점이 plan 서술과 일치.
- 형제 슬롯 맞바꿈: M5·M6·M12 로 수행.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-01 | UT | REQUIRED | PASS | `pending-message-queue` 2케이스 green · M13 red | 3/3 |
| VP-02 | UT | REQUIRED | PASS | git·worktrees·prepare-worktree green · M1·M2 red | 10/10 |
| VP-03 | UT | REQUIRED | PASS | error 스위트 green · M4 red (M3 green → D1) | 4/4 |
| VP-04 | UT | REQUIRED | PASS | `permission-mode.test` green · M5 red | 2/2 |
| VP-05 | UT | REQUIRED | PASS | `claude-map.test` green · M6 red | 2/2 |
| VP-06 | UT | REQUIRED | PASS | chat-turn green(기준 88 sqlite 제외) · M7·M8 red | 2/2 |
| VP-07 | UT | REQUIRED | PASS | `registry.test` green · M9·M10 red | 2/2 |
| VP-08 | UT | REQUIRED | PASS | 검증자 probe 2케이스 green · M11·M14 red | 1/1 |
| VP-09 | UT | REQUIRED | PASS | `pendingSteerControls` green · M12 red | 1/1 |
| VP-10 | AT | REGRESSION | PASS | 부모 대비 FAIL 파일·테스트 집합 diff = ∅ | 집계 |

- root `PAIR_FAIL`·`BLOCKED_BY`: 없음.

### AT / AC 세부와 합계

| AT / AC | 결과 | 증거 |
|---|---|---|
| AT-01 / AC1 | ✅ | VP-01 |
| AT-02 / AC2 | ✅ | 삼항 grep = 정의 2줄 · VP-02 |
| AT-03 / AC3 | ✅ | `APP_ERROR_DETAIL_MAX - 1` = 1건 · VP-03 |
| AT-04 / AC4 | ✅ | VP-04 |
| AT-05 / AC5 | ✅ | VP-05 |
| AT-06 / AC6 | ✅ | `prepareContinuation(` 1건 · VP-06 |
| AT-07 / AC7 | ✅ | VP-07 |
| AT-08 / AC8 | ✅ | 검증자 probe(기존 테스트 없음 → D2) |
| AT-09 / AC9 | ✅ | VP-09 |
| AT-10 / AC10 | ✅ | VP-10 |

- **합계 재측정**: `✅ 10 · ⚠️ 0 · ❌ 0 = 총 10` · 자기보고 10/10 · 일치.
- **합계 사본 대조**: plan 본문 10 ↔ `1843e28d` trailer `Criteria-Met: 10/10` ↔ INDEX 비고(수치 없음) — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | plan | 코드 재측정 | 결과 |
|---|---|---|---|
| VP-01 | 3 | `enqueue.ts:65,66` · `post-turn.ts:236` | 3/3 |
| VP-02 | 10 | `headOid` 3 + `git-diff` 별칭 `oidOf` 1 · `headName` 6 | 10/10 |
| VP-03 | 4 | clamp 2(main·renderer) · key 2(hub·toast) | 4/4 |
| VP-04~09 | 2·2·2·2·1·1 | 각 파일 직접 확인 | 10/10 |

- 합계 27/27 — 구현 보고와 일치. 표 밖 필요 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` 3분할, `error TS` 0 |
| lint | PASS | `npx eslint --no-fix <변경 30파일>` 출력 0 (`npm run lint` 는 `--fix` 라 미사용) |
| vitest | PASS(기준선 분리) | 12 디렉토리: HEAD 276파일/3238케이스 · 176 FAIL / 부모 3240케이스 · 176 FAIL · FAIL 24파일 전부 better-sqlite3 로드 서명 · 집합 diff ∅ |
| trailer | PASS(이력 이탈 기록) | 3커밋 모두 파싱. `a27b93ec` 는 `Handoff: none`·`Criteria-*`/`Verified-By` 부재 — plan §0 기록, 재작성 불가(push 완료) |

## 8. 사람 실기

- 없음 — 전부 순수/모듈 로직이라 기계 검증으로 닫았다.

## 9. 게이트 재실행

- 실행: `npm run typecheck` · `npx eslint --no-fix <30파일>` · `./node_modules/.bin/vitest run <12 디렉토리> --reporter=json` 을 HEAD 와 `git checkout a27b93ec~1 -- src` 상태에서 각각(이후 `git checkout HEAD -- src` 복원).
- 관측 산출: 위 gate 표. `npm test` 미사용(DB 검증 불필요).
- 작업 트리 변화: 없음 — 변이·probe·부모 체크아웃은 매번 복원/삭제, 최종 `git status` 는 세션 시작 전부터 있던 `.ko.ts.swp` 1건뿐(검증 산출물 아님).
- 잔여물: `/tmp` 의 JSON·스크립트(저장소 밖).

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → 이번 커밋에서 `verify/PASS` 로 archive 이동. 대상 커밋 좌표 `46797e8c`·`a27b93ec`·`1843e28d` 모두 `git cat-file -t` = commit.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·수정의 잠금·Product/UX 파생·잠재 문제·구현 보고·Review Signals 전부 존재(r1 최초 구현이라 재구현 요건 대상은 아님).
- AGENTS 변경: 없음.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `clampErrorDetail` 경계(300/301자)를 잠그는 테스트 없음 — M3 green | VP-03 (적대 증거 미선택) | NON_BLOCKING | 경계 케이스 1건 추가 후보. 리팩토링 전 두 사본도 똑같이 미잠금 |
| D2 | `gitExecutable` 의 공유·비캐시를 잠그는 테스트 없음 — 기존 스위트에서 M11 green | VP-08 | NON_BLOCKING | 검증자 probe 형태(임시 PATH 디렉토리)로 테스트화 후보 |
| D3 | plan 이 테스트 삭제를 1건으로 서술, 실제 −2(`turn-coordinator` it.each 병합) | plan §7 주의사항 | NON_BLOCKING | 기록만 — 커버리지 손실 없음 |
| D4 | 구현 커밋 trailer `Handoff: none`, plan 사후 작성 | 커밋 프로토콜 | NON_BLOCKING | plan §0 기록. `/simplify` 경로가 handoff 진입 트리거를 우회 — review 신호 |
| D5 | artifact availability 상태 미소비(D-002) | 범위 밖 | NEXT_HANDOFF | 사용자 결정 대기 |

## 14. Review Signals — 사실만

- 이전 라운드: 없음(r1).
- 관련 지침: 루트 `AGENTS.md` 진입 트리거는 구현 요청 시 plan 선행을 요구 — 이번은 `/simplify` 스킬 경로로 구현이 먼저였다.
- 사용자 결정 변경: 없음.
- 반복된 환경 한계: Windows 로컬 better-sqlite3 ABI(24파일) · `rg` 부재로 `scan-surface.sh` 실행 불가.

## 15. 결론

- 상태: **PASS**
- pair: REQUIRED 9 + REGRESSION 1 = PASS 10 · PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0
- AC ✅10 · gate 4종 PASS · 사람 실기 없음
- NON_BLOCKING D1~D4 · NEXT_HANDOFF D5
- 다음 단계: 보드에서 archive 이동. PR 생성·merge 는 사람.
