# Verify — 0218-simplify-200-217-cleanup (r1)

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 판정

**PARTIAL PASS** — 채택한 23 항목은 게이트로 닫혔고, 계획한 28 중 **5 묶음(11 항목)이 미착수**다. 미착수는 결함이 아니라 범위 미소진이므로 `Status: partial`·`Next-Action: claude` 로 다음 라운드에 넘긴다.

| 축 | 결과 | 관측 |
|---|---|---|
| lint (boundaries 포함) | ✅ | `0 problems (0 errors)` + 사전 존재 warning 1 (`useTranscriptVirtualizer.ts` — 미변경 파일) |
| typecheck 3분할 | ✅ | 배치마다 실행, 전부 exit 0 |
| 순수 vitest 차집합 | ✅ | 아래 §2 |
| §10 강제 지점 재열거 | ✅ | 아래 §3 |

## 1. 기준선 잠금 (§0)

구현 **전** 전체 스위트를 2회 독립 실행해 동일 수치를 얻었다 — **10 파일 · 56 테스트 red**, 353 파일 · 3392 테스트 green.

red 10 파일은 전부 main 프로세스 DB 로드 스위트이고 원인은 하나다:
`better_sqlite3.node` 가 `NODE_MODULE_VERSION 140`(Electron) 로 빌드돼 있고 plain Node vitest 는 127 을 요구한다. `app/AGENTS.md §제약 환경 게이트` 가 서술한 알려진 기준선이며 **변경과 무관**하다.

ABI 를 뒤집지 않았다 — 이 worktree 의 `node_modules` 는 메인 체크아웃과 junction 으로 공유되므로 `npm test`/`npm install`/`dev`/`build` 를 돌리면 메인 체크아웃의 ABI 까지 뒤집힌다.

## 2. 차집합 판정 (AT-02)

분모는 총계가 아니라 **집합의 차**다.

```
before(red) = {queries, migrate, fork, builder, managed-worktrees, writer,
               session-worktree-display, chat-turn.continuity,
               worktree-recover, worktree-bind}          # 10
after(red)  = 위와 동일                                    # 10   (run3 기준)
after − before = ∅
```

### 2-A. 중간 라운드에서 잡힌 실제 회귀 1건 (수정 완료)

차집합이 실제로 일을 했다. 1차 전체 실행에서 **`after − before = {DiffTileContent.commitScope.test.ts}`** (2 테스트)가 나왔다.

- 원인: 이 스위트는 컴포넌트를 **렌더 없이 함수로** 호출해 props 를 꺼내고(`DiffTileContent()`), `vi.mock('react')` 로 **`useCallback` 만** 대체한다(`:7-10`). P1 이 `useMemo` 두 개를 더하자 실제 React 의 dispatcher(null)에 닿아 `Invalid hook call` 이 났다.
- 처리: 그 목 seam 에 `useMemo: (fn) => fn()` 을 더했다. **단언은 그대로다** — 목록은 "컴포넌트가 쓰는 훅" 의 열거이고 훅이 하나 늘었으므로 열거도 늘었다.
- 재확인: `rightpanel/` 25 파일 · 227 테스트 green.

합계만 봤다면 `56 → 58` 을 "ABI 잡음" 으로 읽고 넘겼을 자리다.

### 2-B. `queue-entry.test.ts` — 간헐 red, 원인은 테스트 하네스의 선행 경쟁

전체 실행 6회의 관측이다. **최종 판정은 flake 이고 변경 무관**이지만, 그 결론에 도달하기까지 중간 증거가 반대를 가리켰으므로 과정을 남긴다.

| 코드 상태 | 실행 | `queue-entry` |
|---|---|---|
| 변경 전 | baseline ①② · control ③ | green · green · green |
| 변경 후 | run1 · run2 | **red** · **red** |
| 변경 후 | run3 | **green** |

- **중간 오판**: run1·run2 만 봤을 때 "변경 전 3 green / 변경 후 2 red" 라 flake 로 부르지 않고 원인 조사로 전환했다. run3 이 green 이 되며 간헐임이 확정됐다 — n=5 는 부하 의존 경쟁을 판정할 표본이 아니었다.
- **기전**: `withRepoMutation` 은 큐 슬롯을 잡기 **전에** `await canonicalRepoKey()`(realpath)를 한다(`mutation-queue.ts:11-18`). 테스트의 `whileQueueHeld` 는 `held` 와 `pending`(=`addWorktree`, 이것도 같은 큐를 지난다 — `worktree.ts:17`)을 연달아 띄우고 **`held` 가 realpath 경쟁에서 이긴다고 가정**한다. `pending` 이 먼저 끝나면 `git worktree add` 가 즉시 돌아 `observe()` 의 "target 이 없어야 한다" 가 깨지고, `release` 는 대입되지 않아 `TypeError: release is not a function` 이 난다. `EBUSY: rmdir` 은 그 뒤끝이다(놓지 않은 큐가 git 을 붙들고 있어 임시 디렉토리가 안 지워진다).
- **변경 무관 근거**: `mutation-queue.ts`·`worktree.ts`·이 테스트 파일은 **이번 커밋이 건드리지 않았다**(`git diff HEAD~1 HEAD` 로 확인). 실패한 케이스(`addWorktree`)는 이번에 고친 `git-cli.ts` 의 두 함수(`gitBranches`·`gitCheckout`)를 **부르지 않는다**. 이번 변경이 `git-cli.ts` 에 `./repository` import 를 더해 그 테스트 파일의 모듈 초기화 타이밍을 흔들 수는 있으나, 그것은 잠재 경쟁의 **방아쇠**지 원인이 아니다.
- 파생 이슈 I-05 로 올린다.

## 3. §10 강제 지점 독립 재열거 (AT-04)

구현 보고와 무관하게 검증자가 다시 셌다. 술어는 **불변식의 주어**로 골랐다.

| EP | 검색 | 원시 개수 | 실질 | 판정 |
|---|---|---|---|---|
| EP-04 프롬프트 속성 이스케이프 | `replace(/&/g` | 3 | **1** | ✅ 나머지 2는 `plugins/confluence/storage-to-markdown.ts` 의 **HTML→markdown** 이스케이프 — 다른 도메인이고 이스케이프 집합도 다르다(한쪽은 `>` 없음). 합치면 안 된다 |
| EP-05 HEAD 브랜치 이름 판정 | `symbolic-ref` | 3 | **1** | ✅ 나머지는 전부 주석 |
| EP-06 git OID 파싱 | `[0-9a-fA-F]{40,64}` | 1 | 1 | ✅ (`protocol.ts` 의 40자 스키마는 의도적 별개 — 합치지 않았다) |
| EP-07 스냅샷 요청 identity | `JSON.stringify([cwd, sessionId])` | 1 | 1 | ✅ |
| EP-10 짧은 sha | `slice(0, 7)` | 1 | 1 | ✅ |
| EP-11 모드-모델 지원 규칙 | renderer 의 `isHaikuModel` | 0 | 0 | ✅ 메뉴가 `coerceAutoPermissionMode` 를 부른다 |
| EP-13/14/15 사멸 심볼 | `parseNameStatusZ`·`TaskBoardKind`·`repoNameFromRoot` | 0·0·0 | — | ✅ |

**원시 개수를 그대로 적지 않은 이유**: 검색 술어가 주석과 인접 도메인까지 물었다. 실질 개수는 각 히트를 열어 판별했고 근거를 위 칸에 남겼다.

## 4. 설계 대비 차이

| 항목 | 차이 | 처리 |
|---|---|---|
| 계획 28 → 적용 23 | D9·D13·D14·D15·A2·A3·A4·A5·A6·P7·X5 미착수 | `NEXT_HANDOFF` — 결함이 아니라 범위 미소진 |
| D12 | 계획은 7 사본 전부였으나 **SUBAGENT_RUN_STATE 4분기 + tool.call.completed 1곳**만 접었다 | `TASK_*_REQUESTED`/`FAILED` 4건은 `taskStopErrors` 삭제가 얽혀 동적 키 파라미터화가 필요하다 — 타입 안전을 잃는 값이 아니라 보류 |
| D7 | 단순 통합이 아니라 **드리프트 수정**을 겸했다 | `catch` 분기가 `rmdir` 을 빠뜨려 repo 세그먼트 디렉토리를 남기던 것을 통합이 닫았다. §13 이 예고한 범위 |

## 5. 파생 이슈

| ID | disposition | 내용 |
|---|---|---|
| I-01 | `NON_BLOCKING` | 내 스크립트 hoist 가 `export` 키워드를 `resolveDiffRange` 에서 떼어내 일시적으로 un-export 했다. typecheck 가 잡아 즉시 복구했지만, **정규식 기반 코드 이동이 선언 경계를 모른다**는 사례다 — 다음 라운드는 배치마다 typecheck 를 유지한다 |
| I-02 | `NEXT_HANDOFF` | `FileDiffSection.tsx` 934줄 · 9 컴포넌트 — `renderer/AGENTS.md` 의 분해 신호(400줄·5개)를 넘는다. 분해는 별도 설계 |
| I-03 | `NEXT_HANDOFF` | `repoCoordsCache` 는 무효화가 없는 무한 성장 캐시다(격리 세션마다 1 엔트리). 엔트리가 작아 급하지 않으나 축은 실재한다 |
| I-04 | `NEXT_HANDOFF` | §17 이관 6건(git identity 메뉴 중복 fetch · respawn 일반화 · env 레이어 배열화 · `openConfirmDialog` 수렴 · git-cli gate 병합 · `DiffTable` 통합) — 전부 화면·계약·측정이 선행돼야 한다 |
| I-05 | `NON_BLOCKING` | `queue-entry.test.ts` 의 `whileQueueHeld` 는 `held` 가 `pending` 과의 realpath 경쟁에서 이긴다고 가정하고 150ms 고정 대기를 쓴다 — 부하에 따라 뒤집힌다(§2-B). 하네스가 큐 획득을 결정적으로 기다리도록 고치는 것이 맞다. 이번 범위 밖이라 손대지 않았다 |

## 6. Review Signals — 사실만

- 4관점 병렬 리뷰가 낸 55건 중 **14건을 2개 이상 에이전트가 독립 지목**했고, 그 14건은 전부 실재로 확인됐다.
- 리뷰 간 1건 충돌: reuse 는 `currentBranch ≡ resolveHeadRef` 를 "`readOnly:true` 까지 동일" 로, simplification 은 그 축을 언급하지 않고 timeout/maxBuffer 만 대조했다. 실측 결과 **reuse 가 옳다** — `git-cli.ts:33` 의 로컬 `run()` 이 `readOnly: true` 를 싣고 `TIMEOUT_MS`·`MAX_BUFFER` 는 `runner.ts:37-38` 기본값과 같다.
- efficiency 리뷰가 스피너(0208/0216)·`harness-config` env 레이어링·0202 카탈로그 무효화를 **clean 으로 판정**했다 — 낭비가 구간 전체가 아니라 diff 패널에 몰려 있다는 뜻이고, 실제 수정도 거기에 몰렸다.
