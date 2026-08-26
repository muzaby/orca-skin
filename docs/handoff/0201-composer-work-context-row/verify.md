# Verify — 0201-composer-work-context-row

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0201-composer-work-context-row` |
| 검증자 | Claude Code |
| 일자 | 2026-08-26 |
| 대상 커밋/range | `5655e33..d299bb4` |
| 구현 전 plan 기준 | `5655e33` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 같은 세션의 같은 에이전트다.** 완화책은 §4 서두 |

**판정: FAIL.** AC는 **✅22 · ⚠️2 · ❌0 / 24**로 자기보고(21/24)보다 오히려 높다 — AC24가 이 턴에 CI green이 되어 닫혔다. FAIL 근거는 AC 점수가 아니라 **기준 밖 결함 1건 + 미잠금 1건**이다: 이번 라운드가 만든 사본 스캔의 `대상 집합` 판정 지점이 커밋된 테스트로 잠기지 않았고(D1), AC9가 명시한 "그 문구가 모달에 도달"이 잠기지 않았다(D2). 둘 다 구현자 권한 안에서 싸게 닫힌다. D3은 `규범 정정 필요`라 **다음 주체는 설계자**다.

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립한다** — 설계 커밋 `5655e33`(`Status: designed`)과 구현 커밋 `d299bb4`가 분리돼 있다. `git log --oneline 5655e33..d299bb4` → 1커밋.
- **Decision Ledger·Part I·AC·§10 변경: 없음.** 세 규범 절(§3·§7·§10)을 두 커밋에서 뽑아 diff → **차집합 0줄**(base 92줄 = head 92줄).
- 구현 커밋의 `plan.md` 변경은 `[구현자 기입]` 자리표시자 치환 + 메타 `상태` 행 1줄뿐이다.
- 채점 기준: `5655e33`의 §7 AC 표 — `grep -cE '^\| AC[0-9]+ \|'` → **24행**.
- 구현자는 §10 `extraDirs` 행 `(2)→(3)`, 템플릿 분모 `N/14→17` 정정을 **제안으로만** 적고 규범 행을 직접 고치지 않았다 — provenance 분리가 지켜졌다.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-001 worktree 미도입 | 채널·UI 0 | `rg worktree src/` → 2건, **둘 다 주석**(`ipc.ts:984`·`BranchChip.tsx:28`) | ✅ |
| D-002 저장소 아니면 칩 부재 | 렌더 안 함 | `branchChipView(cwd,status)` → `{visible:false}` → `BranchChip.tsx:71` early return | ✅ |
| D-003 더티+resolution 없음 = 무동작 | 트리 불변 | `git-cli.ts:122` early return · 실측 `git status --porcelain` 전후 동일 | ✅ |
| D-004 메뉴는 선택만 | `onConfirm` 0회 | `BranchSwitchActions.tsx:90` onClick = `onSelect` 만 | ✅ |
| D-005 추적 변경만 | 미추적 잔존 | 해소 3종 실측 — `?? untracked.txt` 잔존 | ✅ |
| D-006 동일 배열 | 참조 동일 | `claude.ts:343` → `:367` 옵션 · `:392` 훅, 같은 변수 | ✅ |
| D-007 참조 경로 해석 규칙 | resume=세션행 | `turn-context.ts:80`·`:171` | ✅ |
| D-009 랜딩 전용 | 세션 뷰 부재 | `Composer.tsx` 기본값 false + 랜딩 2페이지만 전달 | ⚠️ D2/AC16 |
| D-011 chipSurface SSOT | 3소비처 | `ComposerChip`·`ExtraDirChip`·`CwdButton` — plan §9와 일치 | ✅ |
| D-012 기본 = `auto_classified` | 두 곳 동일 | 상수 1개, 소비처 2 | ✅ |
| D-013 `dont_ask` 카탈로그만 | `hidden` | `modes.ts:49 hidden: true` | ✅ |
| D-015 `xhigh` = '엑스트라' | 라벨 | `ko.ts:600` | ✅ |
| D-017/D-018 사본 제거 + 재발 방지 | 사본 0 + 게이트 | 사본 0 ✅ · **게이트 자체가 미잠금** → D1 | ⚠️ |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 정상 | `run()`이 `execFile` 오류를 값(`ok:false`)으로 접는다. 10s 타임아웃·4MB `maxBuffer` 유지 |
| false success 가능성 | 없음 | 오류를 삼키는 하위 호출 없음. `insideWorkTree`·`dirtyStat` 실패는 각각 값으로 분기 |
| partial failure/rollback | **설계대로 남는다** | 해소 적용 후 checkout 실패 = 트리 변경 + 브랜치 유지. `applied`로 식별 — 반환값은 잠겼고 **화면 도달은 미잠금**(D2) |
| Product/UX의 A가 아닌 B | 아니오 | AC9·AC12·AC18이 요구한 동작 그대로. 대체된 것은 *검증 수단*(렌더 테스트→seam)이며 구현자가 공개했다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | `git-cli.ts:7` 주석 정정은 코드 동작과 무관한 문서 오류 정정(plan §14 지시) |
| 최적화가 잃은 재검증/취소 관측 | 없음 | 이번 라운드에 캐시·조기 반환 신설 없음. `statusForCwd`는 기존 인라인 비교를 이름만 붙인 것 |
| 새 조기 반환이 무엇을 건너뛰는가 | **검사 완료** | `gitCheckout` 최상단 문자셋 거부가 신설 조기 반환이다. `resolveDirty`보다 앞이라 파괴적 동작을 건너뛰게 만들지 않고, `reason:'error'`로 모달까지 간다(조용한 no-op 아님) |
| 출력/요청 worst-case | 불변 | 프로세스 수 status 4 / branches 3, 주기 폴링 없음 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 5655e33..d299bb4`

| 후보 | 판정 | 근거 |
|---|---|---|
| `parseExtraDirs`·`resolveTurnExtraDirs` 미사용 export | **정상** | 스크립트는 cross-file만 센다 — 같은 파일 `:80`·`:171`·`:172`가 소비처 |
| `resolveGuardRoots`·`guardToolAccess` 테스트 전용 | **정상** | 같은 파일 `:125`·`:133`이 소비처(`makeWorkspaceGuardHook`) |
| `BranchChipView`·`CheckoutOutcome`·`DirtyActionOption` 타입 export | 정상 | 정의 파일 내부 시그니처용 |
| 신규 export 전수 배선 | **정상 — 미배선 0** | `isAbsolutePath` 3소비처 · `DEFAULT_PERMISSION_MODE` 2 · `branchChipView`/`statusForCwd`/`checkoutOutcome`/`APPLIED_NOTICE_KEY` → `BranchChip` · `BranchSwitchActions` → `BranchSwitchDialog` |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 "(없음)" |
| producer ↔ consumer 파생 불일치 | 없음 | i18n 신규 3키가 ko/en 양쪽 각 1건, 소비처 `APPLIED_NOTICE_KEY` 3종 전수 |
| 동일 규칙 중복 구현 | **SSOT 유지** | 브랜치 정규식은 `GitBranchNameSchema` 재사용(복붙 0) · 절대경로는 `isAbsolutePath` 1곳 |
| `NORMALIZED_MODES` 프로덕션 참조 0 | **선재 · 범위 밖** | 이번 diff가 건드리지 않았다. 기록만 |

## 4. 기존 테스트 / semantic 검증 확인

> **자기 검증 완화책**: 구현자 보고표(M1~M23)를 증거로 쓰지 않고, 검증자가 **다시 심어** 재측정했다(V1~V4). 새 스윕은 §8의 엄격화 재측정을 따로 돌렸고, 소거 변이는 잔여물 진단이 0이 될 때까지 밀었다.

- plan이 인용한 기존 테스트 실재: `git-parse.test.ts` **9건**(AC2) · `modes.test.ts` **4건**(AC17) · `turn-context.ts` extraDirs **8건**(AC14 — 기존 6 + 이번 2). 전건 통과.
- structural proxy만으로 통과한 AC: **없음.** AC11은 값이 아니라 `toBe` 참조 동일성이고, V2(옵션쪽만 `[...]` 복사)에서 2/3 red.
- **이번 라운드 잠금 재측정** — 분모는 고친 hunk(r1이라 인용 변이 없음). 검증자가 직접 심은 4건 **전건 검출**:

| 검증자 변이 | 스위트 | 결과 |
|---|---|---|
| V1 `parseExtraDirs` 절대경로 검사 제거(신설 3지점) | `turn-context.test.ts` | **2/16 red** ✅ |
| V2 옵션쪽만 배열 복사 | `claude.extra-dirs.test.ts` | **2/3 red** ✅ |
| V3 `checkoutOutcome`이 `applied` 누락 | `branchChipState.test.ts` | **3/15 red** ✅ |
| V4 `APPLIED_NOTICE_KEY` 3종을 같은 키로 | `branchChipState.test.ts` | **1/15 red** ✅ |

- **소거 변이의 잔여물 수렴 — AC9 마지막 홉**: 1단계(모달의 `error?.applied` 문단 제거) → unused import 잔존. 2단계(import 제거)까지 밀어 진단 0. **그 상태에서 `typecheck:web` exit 0 · 렌더러 chat 스위트 352/352 green.** 구현자의 ⚠️ 주장은 정직하며, 그 홉은 실제로 잠기지 않았다 → **D2**.
- 동작 보존 추출 라운드인가: **부분적으로 예.** `branchChipState.ts`·`BranchSwitchActions.tsx`는 동작 보존 추출이다 — 그래서 그 hunk 되돌림이 아니라 **의미를 바꾸는 변이**(V3·V4)로 판정했다.
- `N회` 기준: AC10의 "0개면 키 자체가 없음"을 `not.toHaveProperty('extraDirs')`로 실제 페이로드에서 관측. 순서 기준 AC 없음.

## 5. 요구사항 충족 매트릭스

| # | 결과 | 검증 증거 (검증자 재측정) |
|---|---|---|
| AC1 | ✅ | `branchChipView` 4케이스 · `isRepo:false`→`{visible:false}` · detached→`{visible:true,branch:null}` |
| AC2 | ✅ | `git-parse.test.ts` 9건 실재·통과 |
| AC3 | ✅ | 실 저장소 — checkout 후 `gitStatus().branch`·`rev-parse --abbrev-ref HEAD` 둘 다 `feature` |
| AC4 | ✅ | 호출 전후 `git status --porcelain` **문자열 동일** + 반환 형상 |
| AC5 | ✅ | 해소 3종 각각 미추적 잔존 · 추적 변경 소멸 |
| AC6 | ✅ | 메뉴 3항목 전부 클릭 → `onConfirm` **0회**; 왼쪽 버튼 → **1회**(`'discard'`) |
| AC7 | ✅ | 실행부 직접 호출 6종 거부 + 트리·브랜치 불변. **2/2 지점** |
| AC8 | ✅ | `error`·`not-repo` 둘 다 `{kind:'failed'}`로 접힘 |
| AC9 | **⚠️** | main 절반 ✅(`applied` 3종 + 부재 시 키 없음). **renderer 홉 미잠금** — 잔여물 0까지 민 소거 변이에서 typecheck·352케이스 전건 green → **D2** |
| AC10 | ✅ | 실제 `chat:send` 페이로드 관측 — 추가/제거 반영, 0개면 키 부재 |
| AC11 | ✅ | `toBe` 참조 동일성. V2에서 red |
| AC12 | ✅ | 3지점(스키마·가드 루트·DB 읽기) 전부 V1/M5/M6급 변이 검출 |
| AC13 | ✅ | 왕복 + 빈배열/null/미지정 → 전부 `NULL` + `listSessions` 동일 |
| AC14 | ✅ | extraDirs 해석 **8케이스** 통과 |
| AC15 | ✅ | `SET_CWD`→`[]` · 중복 시 **동일 참조 반환** · cwd 자기 자신 무시 |
| AC16 | **⚠️** | 호출부 스윕이며 AC가 적은 "컴포넌트 테스트 — CwdPanel 부재" 단언이 아니다. 스윕 자체는 3변이 검출. **렌더 하네스(신규 의존성) 승인 대기** |
| AC17 | ✅ | `modes.test.ts` 4건 · `ko.ts:600` '엑스트라' · `modes.ts:49 hidden` |
| AC18 | ✅ | 상수를 `'plan'`으로 바꾸면 **3파일 6케이스 동시 red**, 원복 시 23건 green |
| AC19 | ✅ | `check-doc-inventory.mjs --check` → `generated doc ok (9 items, 79 channels)` |
| AC20 | ✅ | 등록부 정책 ↔ 문서 §2.6-b 대조 4케이스 |
| AC21 | ✅ | `grep -rlE "migrations/[0-9]{4}[^']*\.sql\?raw" src/` → **2건**(정본+골든). §8 엄격화 차집합 **0** |
| AC22 | ✅ | 양방향 실증 — 사본 4형태 전부 게이트 RED · `applyMigrations` 제거 시 26+2+4+4 red |
| AC23 | ✅ | `npx eslint --no-fix ./src ./scripts` → **prettier 0**, 잔여 1은 선재 `react-hooks/incompatible-library` |
| AC24 | ✅ | **이 턴에 닫혔다** — PR #384 `gate`(windows-latest) `conclusion: success`, 02:43:49→02:47:24Z, PR head 커밋 대상 |

- **합계 재측정**: `✅ 22 · ⚠️ 2 · ❌ 0 = 총 24`(§7 표 24행을 직접 셈).
- **합계 사본 대조**: 자기보고 본문 `21/24` ↔ trailer `Criteria-Met: 21/24` ↔ INDEX 비고 `✅21·⚠️3·❌0/24` — **세 사본 일치**. 검증자 재측정과는 AC24 1건 차이(자기보고 시점엔 CI 미완). 과대보고 아님.

### plan §10 강제 지점 표 — AC와 별개로 걸음

| 계약/필드 | plan이 적은 지점 | 검증자가 확인한 지점 | 결과 |
|---|---|---|---|
| 브랜치 이름 문자셋 | invoke · execFile 직전 (2) | `protocol.ts:211` · `git-cli.ts:115`. branch를 싣는 execFile은 `:99`(stash)·`:140`(checkout) 둘뿐이고 **둘 다 가드 뒤** | **2/2** ✅ |
| `extraDirs` 절대 경로 | `chat:send` · 가드 루트 (2) | `protocol.ts:71` · `workspace-guard.ts:63` · **`turn-context.ts:69`(표 밖)** | **3/3** ✅ |
| `additionalDirectories` 동일 배열 | 옵션 · 훅 (2) | `claude.ts:367`·`:392`, 같은 변수 | **2/2** ✅ |
| 기본 권한 모드 | 리듀서 · 컨트롤러 (2) | `chatReducer.ts:212` · `permission-mode-controller.ts:21` | **2/2** ✅ |
| 마이그레이션 목록 | 픽스처 4 · 골든 1 · 스캔 1 | 픽스처 4(`continuity:26`·`builder:22`·`fork:10`·`queries:12`) · 골든 `migrate.test.ts:85` · 스캔 1 | **6/6** ✅ |
| `git` 채널 검증 정책 | 등록 (3) | `handlers/git.ts:23·30·37` | **3/3** ✅ |

- **합계: 18/18**(§10 표 17 + 표 밖 신설 1). 구현자 보고와 일치 — 검증자가 독립 재측정했다.
- **표에 없는데 같은 불변식이 필요한 지점**: `turn-context.ts:69` 1건(구현자가 신설·보고). 검증자 추가 발견 **0건**.
- **`실패 의미`가 서술한 적대 상태의 재현**: `extraDirs` 행의 "`/` 한 개면 `writeRoots`가 루트를 덮는다" → **재현됨**. 실측 `isAbsolutePath('/')=true` · `resolveGuardRoots('/tmp/ws',['/']).writeRoots[1] === '/'` → **D3**.

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `IPC_CONTRACT.md §2.6-b` ↔ `handlers/git.ts` | 채널 집합 동일(3) | 폴백/reject 정책 문면 대조 | ✅ AC20 |
| SDK `additionalDirectories` | `string[]` 절대경로 | AC12 강제가 SDK 요구와 같은 방향 | ✅ |

- **문서 drift 1건**: `IPC_CONTRACT.md §2.6-b`의 `GitCheckoutResult` 서술이 `{ ok:false, reason:'error', message }`까지만 적고 이번에 추가된 **`applied` 필드를 서술하지 않는다** → D4(경미).

## 7. 숫자 / 음성 기준 / 상한 재측정

- 마이그레이션 사본 재측정: `src/` **2파일**(정본+골든). 엄격화 술어(`?raw` 없는 `migrations/NNNN_` 전체) 차집합 **0**.
- 스윕 대상 규모: `scanned 748 source files, 2 list owners`(구현 전 738 + 신규 테스트 10).
- 내역 합 = 총계: 테스트 226파일 = 기준선 216 + 신규 10 ✅ · 2233케이스 = 기준선 2138 + 95 ✅ · scripts 55 = 49 + 6 ✅.
- 0건 게이트의 정당한 예외 보존: `migrate.test.ts`의 부분집합(`APPLIED_MIGRATIONS` 6건·`memDb` 0001~0008)이 허용 목록으로 보존됨 — 삭제되지 않았다.
- 상한: `maxBuffer` 4MB·타임아웃 10s 불변.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 작업 컨텍스트 행 시각 정렬 | 어느 클래스를 쓰는가(`chipSurface` 3소비처) | 칩 높이·반경·글리프가 눈에 어긋나 보이는가 | `npm run dev` → 랜딩 컴포저 상단 행 |
| AC9 부분 실패 문구 | 반환값·문구 키 매핑·순서 | 모달에 실제로 두 문단이 뜨는가 | 더티 트리 + 없는 브랜치로 전환 |
| AC16 랜딩 전용 | 기본값·호출부·가드 | 세션 진입 후 행이 사라지는가 | 전송 후 ChatTile 확인 |

> AC9·AC16의 "남은 사람 실기"는 **렌더 하네스가 도입되면 기계 검증으로 내려온다** — 지금 사람 몫인 이유는 시각 품질이 아니라 도구 부재다.

## 9. 게이트 재실행

- 실행 명령: `npm run typecheck` · `npx eslint --no-fix ./src ./scripts` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**(exit code 아님): typecheck 3구성 전건 통과 · eslint **0 error / 1 warning**(선재 `react-hooks/incompatible-library`, prettier 0) · vitest **226파일 / 2233케이스 전건 통과** · scripts **55/55** · migrations `sync ok: 17` + `no-copies ok: 748 files, 2 owners` · doc-inventory `9 items, 79 channels`.
- `npm test` 대신 `vitest run` 직접 호출 — ABI를 뒤집지 않기 위함(`app/AGENTS.md`). DB 스위트도 이 경로로 green.
- 환경 기인 실패: **0건.** ABI·egress 서명(403·bindings 누락) 미관측.
- **게이트가 작업 트리를 바꿨는가**: **없음** — `--no-fix`만 썼고 실행 후 `git status --short` 빈 출력.
- **검증 중 실행한 명령의 잔여물**: 프로브 파일 3개를 만들고 전부 삭제 — 최종 `git status --short` 빈 출력으로 확인.
- **CI(별도 정본)**: PR #384 `gate` on windows-latest → `conclusion: success`.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 1:1 대조 완료, §10은 별도 도보 |
| 레이어/계약/문서 링크 | boundaries lint 0 error · doc-inventory links ok |
| AGENTS 위생 | 해당 없음 — 이번 라운드 `AGENTS.md` 변경 0 |
| **제품 의도(D3 `/` 허용 여부)** | **사람 결정** |
| **신규 의존성(렌더 하네스)** | **사람 승인** |
| UI 시각 품질 | §8 3건 |

## 11. Repository operation checks

### INDEX 보드 정합성

- 상태 `impl/IMPL_DONE` / 다음 주체 `Claude (검증)` / 라운드 1 — 실제와 일치했다.
- 「다음 주체」 칸이 주체 하나만 담는가: ✅ `Claude (검증)`.
- 비고 5줄 이내: ✅ 문장 5.
- **대상 커밋 좌표 기입(검증자 몫)**: 구현자가 `(r1 구현 — 검증자 기입)`을 남겼다 → 이번 턴에 `d299bb4`로 채운다. `git cat-file -t d299bb4` → `commit`.

### Commit / reference 정합성

- trailer 허용값 준수 ✅ (`Agent: claude`·`Status: partial`·`Criteria-*`·`Verified-By: pending`).
- **trailer 실제 파싱** ✅ — `git log -1 --format='%(trailers:only=true)' d299bb4` → **8키 그대로 반환**(0198 r7의 리터럴 `\n` 실패 재발 없음).
- 인용 커밋 실재 ✅ — `a1f33fa`·`191a852`·`d184b6a`·`c0b5f0c`·`86c7fd1`·`5e6fdcb`·`5655e33`·`d299bb4` 전부 `git cat-file -t` → `commit`.
- `[구현자 기입]` 필드 전수: **8절**(요구 7 + `AC 자기보고` 1). 산문으로 접힌 필드 **0**.
- 이동한 reference: `queries.test.ts` → `migrate.test.ts`로 옮긴 2 describe가 살아 있고(`migrate.test.ts` 통과), 옛 위치의 `dbBefore0006` 헬퍼는 함께 제거돼 고아 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| §10 `extraDirs` (2)→(3) 정정 제안 | **타당** — 검증자 독립 재측정도 3지점 | 설계자가 §10 정정 |
| 템플릿 분모 `N/14` ↔ §10 합계 17 | **타당** — 재합산 확인 | 설계자가 템플릿 정정 |
| AC21 술어 ↔ §7 주의사항 모순 → 테스트 이설로 해소 | **타당한 선조치** | 목표 문장이 원문대로 성립(2건) |
| 렌더 하네스 미도입(신규 의존성) | **타당** — `app/AGENTS.md §의존성 정책` 준수 | D2는 하네스 없이도 줄일 수 있다(§13) |
| `/` 루트 보고만 | **타당하나 미해결** | D3 `규범 정정 필요` |
| `toPosix`·UNC 결함 선조치 | **타당** — 구현 세부 버그 | 그대로 |

## 13. 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **사본 스캔의 `대상 집합` 판정 지점이 커밋된 테스트로 잠기지 않았다.** `SOURCE_EXTENSIONS`에서 `.tsx`를 빼도 `node --test scripts/check-migrations-appendonly.test.mjs` **14/14 green**. 구현자 M19는 실제 `.tsx`를 심어 CLI로 확인했지만 그 프로브는 커밋되지 않았다 — D-018이 요구한 *재발 방지*가 스스로 좁아져도 아무도 모른다 | AC22 · §10 `마이그레이션 목록` 행의 `사본 스캔 (1)` | `collectSourceFiles`를 임시 디렉토리 픽스처로 도는 단위 테스트를 더하거나, `SOURCE_EXTENSIONS`가 `.tsx`를 포함함을 단언한다. 확장자·재귀 둘 다 심어 red 확인 | open |
| D2 | **AC9의 "그 문구가 모달에 도달"이 잠기지 않았다.** 모달의 `error?.applied` 문단 + import를 지워 잔여물 진단 0까지 밀었을 때 `typecheck:web` exit 0 · 렌더러 chat **352/352 green** | AC9 검증 수단 후반절 | 렌더 하네스 없이도 대부분 닫힌다 — `checkoutErrorView(error, tr)` 같은 순수 seam으로 **문구 조립과 순서**(안내 먼저, 원문 나중)를 떼고 `BranchChip`이 그것을 렌더하게 한다. 남는 미검증은 JSX→DOM 한 홉뿐 | open |
| D3 | **`/`·`C:\`(파일시스템 루트)가 `extraDirs`를 통과해 write 루트가 된다.** 실측 `isAbsolutePath('/')=true` · `resolveGuardRoots('/tmp/ws',['/']).writeRoots[1] === '/'` — §10 `extraDirs` 행의 `실패 의미`가 적대 사례로 지목한 상태가 그대로 재현된다. AC12의 행동 단언("절대 경로만")은 이것을 막지 않는다 | §10 `extraDirs 절대 경로` 행 ↔ AC12 | **규범 정정 필요** — 루트 거부는 사용자가 받는 결과를 바꾸므로 설계자가 AC12 문면을 정하거나(예: "루트·드라이브 루트는 거부") §10 `실패 의미`에서 그 사례를 내린다. 구현자 단독 결정 불가 | **규범 정정 필요** |
| D4 | `IPC_CONTRACT.md §2.6-b`의 `GitCheckoutResult` 서술이 이번에 추가된 `applied` 필드를 적지 않는다 | §15 문서 계약 · AC20 인접 | 문서 한 줄 추가. AC20 대조 테스트는 정책만 보므로 이 drift를 잡지 못한다 | open |

**관찰(이슈 아님)**: `isAbsolutePath('/a/../../etc')` = true — `..` 세그먼트는 통과한다. `path.resolve`가 정규화하고 `extraDirs`는 본래 allowlist를 넓히는 입력이라 탈출 경로가 아니다. AC 어느 행도 이것을 요구하지 않아 이슈로 올리지 않는다. · `NORMALIZED_MODES`의 프로덕션 참조 0건은 이번 diff 밖의 선재 상태다.

## Review Signals — 사실만

- **이전 라운드와 동일/유사 증상인가**: r1이라 비교 대상 없음. 다만 D1은 이 저장소에서 반복돼 온 축이다 — *검사 장치가 자기 판정 지점을 스스로 잠그지 않는다*(0191이 같은 grep 파이프라인의 5개 지점을 여섯 라운드에 걸쳐 열었다).
- **관련 plan 지침/AC가 있었는가**: 있었다. AC22가 "검사 장치가 **양방향으로** 반응한다"를 요구했고 구현자는 두 방향을 실증했다. 그러나 AC22의 분모는 *변이 2종*이라, 장치의 **판정 지점 수**(대상 집합·추출·허용 판정·분류)는 분모에 들어오지 않았다. 구현자는 4지점을 프로브했지만 **커밋하지 않았다** — AC가 "심어서 확인했다"까지만 요구하고 "그 확인이 회귀로 남는다"를 요구하지 않는다.
- **사용자 결정 변경 근거**: D-010a·D-012a·D-015a의 SUPERSEDE는 전부 명시적 후속 커밋(`191a852`·`c0b5f0c`·`86c7fd1`)이 근거다. 무단 변경 0.
- **반복된 검증 환경 한계**: (1) 렌더 하네스 부재 — AC9·AC16이 여기서 막혔고, 이 저장소의 renderer 테스트는 전부 순수 `.ts`다. (2) `npm run lint`가 2분을 넘겨 짧은 타임아웃에 잘린다.
- **자기 검증**: 설계·구현·검증이 같은 에이전트다. 완화로 규범 절 차집합(0줄)·독립 재심기(V1~V4)·엄격화 재측정(차집합 0)·소거 변이 수렴(2단계)을 썼으나, **구현자가 생각하지 못한 축은 검증자도 생각하지 못했을 수 있다**는 한계는 남는다.

## 결론

**FAIL (r1)** — 다음 주체는 **설계자**다(D3이 `규범 정정 필요`). 설계자가 §10/AC12를 정정한 뒤 구현자가 D1·D2·D4를 닫는다.

- 코드 품질·게이트·CI는 문제없다. AC 22/24, 강제 지점 18/18, windows CI green.
- FAIL의 실체는 **두 개의 미잠금**이다: 이번 라운드가 만든 게이트가 스스로 좁아지는 것을 막지 않고(D1), 이번 라운드가 만든 사용자 대면 문구가 사라지는 것을 막지 않는다(D2). 둘 다 "동작한다"와 "회귀를 막는다"의 차이다.
