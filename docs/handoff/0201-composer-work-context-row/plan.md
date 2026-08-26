# Plan — 0201-composer-work-context-row

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0201-composer-work-context-row` |
| 작성자 | Claude Code |
| 일자 | 2026-08-26 |
| 매핑 | PR #382(draft) · 구현 브랜치 `claude/composer-branch-and-add-dir` · CI 수정 브랜치 `claude/ci-failure-fix-dquqv7` |
| 상태 | DRAFT → READY |

**이 plan 은 소급 설계다.** 구현이 먼저 있었고(D-016 — 사용자 지시로 `Handoff: none` 부분수정을 연속 수행), 이제 그 구현이 만족해야 할 계약을 세운다. 따라서 §7 AC 는 "앞으로 만들 것"이 아니라 **"현재 코드가 만족해야 하는데 일부는 아직 만족하지 않는 것"** 이다 — 미충족 항목은 각 행의 `현재` 칸이 관측으로 표시한다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- **문제**: 컴포저 상단 행이 작업 경로 하나만 보여 줬다. 앱 안에서 (1) 어느 브랜치에서 도는지 알 수 없었고 (2) 작업 폴더 밖 파일을 에이전트에게 읽히는 표면이 없었다 — CLI `/add-dir` 대응이 부재했다.
- **완료 후**: 랜딩 컴포저 한 행이 `[📁 작업 경로] [⑂ 브랜치] [📁 참조 경로 ×] … [＋]` 를 담고, 세 값이 세션 출생 시 함께 고정된다.
- **성공 한 문장**: 사용자가 세션을 시작하기 전에 "어디서 · 어느 브랜치로 · 무엇을 더 보고" 도는지 한 행에서 정하고, 그 셋이 세션 수명 내내 같은 값으로 유지된다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "워크트리는 범위 밖(제품 결정)이라 채널도 UI도 두지 않는다" | 커밋 `a1f33fa` 본문 |
| 명시 요구 | "메뉴는 선택(✓)만 바꾸고 실행은 왼쪽 버튼이다 — `변경 사항 취소`가 한 번의 오클릭으로 날아가지 않게" | PR #382 본문 |
| 명시 요구 | "핸드오프 문서는 이 커밋에 포함하지 않았다 — 사용자 지시로 부분수정을 이어간 뒤 모아서 작성하기로 했다" | PR #382 본문 |
| 명시 요구 | "ci 실패 원인을 찾고 수정하라. 해당 브랜치에 대해 pr 382를 참조하라" | 이번 세션 사용자 턴 1 |
| 명시 요구 | "컴포저 작업에 대해 plan 문서를 작성하라. **검증범위에 대해서는 지금까지 설명한 요소를 모두 포함해야 한다**" | 이번 세션 사용자 턴 3 |
| 추론 의도 | 위 문장의 "지금까지 설명한 요소" = 세션 턴 1·2에서 제시한 CI 실패 분석 전부(픽스처 사본·게이트 맹점·A/B 파손 양태·0013 구멍) — 턴 2가 그 설명을 요청했고 턴 3이 그것을 검증범위로 지정했다 | 세션 턴 2 "0018에 대해 터진다는 의견을 설명하라" |
| 추론 의도 | 브랜치 칩은 *표시* 가 아니라 *실행* 표면이다 — 실제 `git checkout` 을 사용자 작업 트리에 수행한다 | `git-cli.ts:126` `run(cwd, ['checkout', branch])` |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | worktree 는 다루지 않는다 — 채널도 UI도 두지 않는다 | 제품 결정 | 커밋 `a1f33fa` | ACTIVE | — |
| D-002 | git 저장소가 아니면 브랜치 칩 자체를 렌더하지 않는다 | "누를 것이 없는 버튼을 자리만 잡아 두지 않는다" | PR #382 | ACTIVE | — |
| D-003 | 더티 트리 + `resolution` 없음 = main 은 **아무것도 하지 않고** `{ok:false,reason:'dirty',from,stat}` 반환 | 처리 방식은 renderer 가 묻고 고른 값으로 재호출 | PR #382 | ACTIVE | — |
| D-004 | 분할 버튼 — 메뉴는 선택(✓)만 바꾸고 실행은 왼쪽 버튼. 기본 = `변경 사항 스태시` | "`변경 사항 취소`가 한 번의 오클릭으로 날아가지 않게" | PR #382 | ACTIVE | — |
| D-005 | 해소 3종은 전부 **추적 변경만** 건드린다 | "미추적 파일은 체크아웃을 막지도 않고 지워지지도 않는다 — 경고·통계·해소가 같은 집합을 본다" | PR #382 | ACTIVE | — |
| D-006 | 참조 경로는 어댑터 `additionalDirectories` **와** workspace 가드 루트에 **같은 배열**로 흐른다 | "두 스코프가 갈라지면 가드가 무의미해진다" | PR #382 | ACTIVE | — |
| D-007 | 참조 경로 해석은 cwd 와 같은 규칙 — 새 채팅=요청값, resume=세션행, continuity=출발 세션 | 도착 세션이 같은 파일을 계속 읽어야 한다 | PR #382 | ACTIVE | — |
| D-008 | 참조 경로 칩 툴팁 = 절대 경로 원문 | "라벨이 basename 이라 동명 폴더는 툴팁만이 구분 수단" | PR #382 | ACTIVE | — |
| D-009 | 작업 컨텍스트 행은 **랜딩에만** 뜬다 | 세 값이 세션 출생 시 고정이라 편집 창이 여기뿐 | `CwdPanel.tsx:17` | ACTIVE | — |
| D-010a | 브랜치 칩 툴팁 = 전환 동작 설명 | — | 커밋 `a1f33fa` | SUPERSEDED | → D-010 |
| D-010 | 브랜치 칩 툴팁 = 하는 일(전환)이 아니라 값의 의미인 **'시작 브랜치'** | 긴 이름이 행을 밀어내지 않게 폭도 제한 | 커밋 `191a852` | ACTIVE | D-010a 대체 |
| D-011 | 칩 외형은 `chipSurface` 한 곳이 정한다 — `outlined`=입력 위, `flat`=입력 아래 | "세 컴포넌트가 한 행에 섞여 서므로 클래스를 각자 적어 두면 반드시 어긋난다" | 커밋 `191a852` | ACTIVE | — |
| D-012a | 기본 권한 모드 = `plan` | — | main | SUPERSEDED | → D-012 |
| D-012 | 기본 권한 모드 = `auto_classified` — 렌더러 초기값과 main 미설정 기본값을 **함께** 옮긴다 | "어긋나면 칩과 main 이 서로 다른 모드를 진실로 삼는다" | 커밋 `c0b5f0c` | ACTIVE | D-012a 대체 |
| D-013 | 모드 메뉴는 5종만 내건다 — `dont_ask` 는 칩 라벨용 카탈로그에만 남긴다 | 복원된 세션이 그 모드를 들고 오면 칩이 라벨을 읽어야 한다 | `modes.ts:8` | ACTIVE | — |
| D-014 | `bypass` 는 설명 없이 라벨만 — 경고는 2-스텝 확인이 진다 | — | `modes.test.ts` | ACTIVE | — |
| D-015a | 노력 `xhigh` 라벨 = '매우 높음' | — | main | SUPERSEDED | → D-015 |
| D-015 | 노력 `xhigh` 라벨 = **'엑스트라'** | "높음/매우 높음은 옆에 두면 어느 쪽이 위인지 읽는 순간 헷갈린다 … 최대(max)와의 거리도 함께 드러낸다" | 커밋 `86c7fd1` | ACTIVE | D-015a 대체 |
| D-016 | 핸드오프 문서는 부분수정을 마친 뒤 **모아서** 작성한다 | 사용자 지시 | PR #382 | ACTIVE | 이번 턴이 이행 |
| D-017 | CI 수정은 마이그레이션 정본(`migrate.ts`)의 **사본만 따라 붙인다** | 이번 턴 범위를 CI 초록으로 한정 | 세션 턴 1 | ACTIVE | — |
| D-018 | 픽스처 중복 제거와 그 재발 방지는 **이 handoff 의 검증범위** 다 | 사용자가 "지금까지 설명한 요소를 모두 포함" 으로 지정 | 세션 턴 3 | ACTIVE | — |

### 갱신 메모

- **새로 추가된 결정**: D-016 · D-017 · D-018 (이번 세션 3개 턴).
- **변경된 결정**: D-010a → D-010(툴팁 의미) · D-012a → D-012(기본 권한 모드) · D-015a → D-015(노력 라벨). 셋 다 사용자/구현자의 명시적 후속 커밋이 근거다.
- **이번 턴에 언급되지 않았지만 유지되는 ACTIVE**: D-001 ~ D-015 전부. 세션 턴 1~3은 CI 와 검증범위만 다뤘고 제품 계약을 건드리지 않았다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 개별 판정 — D-001↔비범위("worktree 채널 0") 일치 · D-003↔AC5("아무 파일도 바꾸지 않는다") 일치 · D-004↔AC7 일치 · D-005↔AC6 일치 · D-006↔AC11 일치 · D-007↔AC14 일치 · D-009↔AC16 일치 · D-012↔AC18("두 곳이 같은 값") 일치 · D-013↔AC17 일치 · D-018↔AC21·AC22 일치. **D-002 는 AC1 과 같은 방향이나 AC1 이 더 강하다**(칩 부재 + detached 라벨까지) — 강화이지 반대가 아니다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당**. "브랜치를 모른다"·"cwd 밖을 못 읽는다"는 표면 부재가 원인이고, 새 표면이 그것을 채운다 | `rg "worktree" src/` → 2건(둘 다 주석) · `/add-dir` 대응 채널 0건이었음 |
| 이미 기존 코드가 충족하는가 | **아니오**. `git` 도메인은 이 브랜치가 처음 만든다 | `src/shared/ipc.ts:45-47` 신규 3채널 |
| 더 작은 해법이 있는가 | **부분적으로 예 — 그러나 채택하지 않는다**. 브랜치 *표시* 만이면 서브프로세스 없이 `.git/HEAD` 읽기로 족하지만, 요구는 *전환* 까지다(D-003~D-005의 더티 트리 계약이 전환을 전제한다) | `git-cli.ts:126` checkout 실행 |
| 선행 자료의 주장을 코드와 대조했는가 | **1건 반증**. PR #382 본문 "실패는 전부 환경 베이스라인 — better-sqlite3 ABI 5파일 + cheerio 미설치 4파일. 변경 무관" 은 틀렸다 | 의존성 완비 Linux 환경에서 CI 와 동일하게 5파일 39건 재현 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **1건 충돌**. 0075 workspace 가드는 "cwd 밖 r/w 차단"이 계약인데 `extraDirs` 가 그 루트를 넓히면서 검증이 `min(1)` 뿐이다 | `protocol.ts:76` vs `workspace-guard.ts:58` |

- **사용자에게 올릴 결정**: 없음. `extraDirs` 절대경로 강제(AC12)는 0075 가드 계약을 지키는 방향이라 새 제품 판단이 아니다.
- **코드 조사로 닫은 사실**: 채널 79 · 도메인 23 · 마이그레이션 17(실측) · `git-cli.ts` 2차 검증 0건 · 기본 권한 모드 리터럴 2개.

## 5. 동작 / 사용자 흐름

```text
[랜딩 컴포저]
  → [작업 경로 선택]  → cwd 확정 · 참조 경로 초기화
  → [브랜치 칩 클릭]  → 목록+검색 팝오버
       ├ 깨끗한 트리 → checkout → 칩 라벨 갱신
       ├ 더티 트리   → 처리 모달(스태시▾커밋/취소) → 해소 → checkout → 라벨 갱신
       ↘ 실패        → 사유 모달
  → [＋]              → 폴더 선택창 → 참조 경로 칩이 ＋ 왼쪽에 쌓임
  → [전송]            → 세 값이 세션행에 고정(cwd · extra_dirs) → 행이 사라짐
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| cwd 가 git 저장소 아님 | `gitStatus` → `isRepo:false` | 브랜치 칩 없음. 작업 경로·참조 경로 칩만 |
| cwd 가 detached HEAD | `symbolic-ref` 실패 → `branch:null` | 칩 라벨 `HEAD 분리됨` |
| 브랜치 선택 · 트리 깨끗 | `checkout` | 라벨이 새 브랜치로 갱신 |
| 브랜치 선택 · 트리 더티 | **아무 파일도 안 바꾸고** `reason:'dirty'` 반환 | 처리 모달 — `from` · `target` · `N개 파일 +i -d` |
| 모달에서 방식만 고름 | 없음 | ✓ 만 이동. 실행은 왼쪽 버튼 |
| 해소 성공 · checkout 실패 | 해소는 **이미 적용됨**, 브랜치 그대로 | ⚠️ 현재는 checkout 오류 문구만 — 변경이 어디로 갔는지 안 보인다(AC9) |
| 전송 | `extraDirs` → `TurnContext` → 세션행 | 작업 컨텍스트 행이 사라지고 값은 고정 |
| resume / fork / handoff | 세션행 / 출발 세션의 `extra_dirs` 계승 | 같은 참조 경로로 계속 읽는다 |

### 파생 UX / 엣지케이스

- **loading / empty**: 브랜치 목록은 `listLoading` 동안 스피너, 빈 목록이면 빈 팝오버 — 저장소인데 브랜치가 0개인 경우(unborn)는 `symbolic-ref` 가 이름을 주므로 최소 1개다.
- **cancel / retry**: 모달 취소는 아무 것도 하지 않는다. 전환 실패 후 재시도는 같은 경로를 다시 탄다.
- **concurrency**: 폴더를 빠르게 바꾸면 늦게 도착한 `gitStatus` 응답이 새 경로의 상태를 덮을 수 있어 `snapshot.cwd === cwd` 비교로 무시한다(`BranchChip.tsx:44`).
- **a11y**: 분할 버튼 메뉴는 `role="menuitemradio"` + `aria-checked`, 제거 버튼은 `{{name}} 참조 경로 제거`.
- **외부환경**: `git` 이 PATH 에 없거나 자격증명 프롬프트가 뜨는 원격은 `GIT_TERMINAL_PROMPT=0` 과 10초 타임아웃으로 매달리지 않는다.

## 6. 범위 / 비범위

**범위** — PR #382 의 5커밋 전부 + CI 수정 + 검증 인프라:

1. `git` IPC 도메인 3채널 + `infra/git/` (실행부·순수 파서).
2. 마이그레이션 0017 `sessions.extra_dirs` + `extraDirs` end-to-end 흐름.
3. 작업 컨텍스트 행(`CwdPanel`) + `BranchChip` · `BranchSwitchDialog` · `ExtraDirChip` · `chipSurface`.
4. 컴포저 팝오버 3종 활자 계단 · 모드 메뉴 5종 · 기본 권한 모드 `auto_classified` · 노력 라벨 '엑스트라'.
5. **마이그레이션 픽스처 중복 제거와 재발 방지**(D-018).

**비범위**: worktree(D-001) · 원격 브랜치/fetch/push · 브랜치 생성·삭제 · 세션 시작 후 브랜치 변경 감지 · 참조 경로의 세션 중 편집.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| worktree 지원 | 아니오 — 채널을 새로 더하면 된다 | 후속 |
| 세션 중 브랜치 변경 감지 | 아니오 | 후속 |
| `sessions.extra_dirs` 저장 형식(JSON 배열 문자열) | **예 — 스키마·저장 형식** | 이미 0017로 확정. append-only 가드가 변경을 막는다 |
| `git` 채널 이름·페이로드 | **예 — 공개 계약** | 이미 확정. `docs/IPC_CONTRACT.md §2.6-b` |

## 7. Acceptance Criteria — 제품 계약

> `현재` 칸은 **이 plan 을 쓰는 시점의 실측**이다. ❌·⚠️ 행이 구현 턴의 실제 작업이다.

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 | 현재 |
|---|---|---|---|---|
| AC1 | 저장소가 아닌 cwd 면 브랜치 칩이 **렌더되지 않고**, detached 면 라벨이 `HEAD 분리됨` 이다 | 컴포넌트 테스트 — `isRepo:false` → `null` 반환 · `branch:null` → detached 라벨 | `CwdPanel` → `BranchChip` | ⚠️ 로직은 있으나 테스트 0건 |
| AC2 | 브랜치 목록은 현재 브랜치가 맨 앞이고 나머지는 이름순이다 — 정렬은 main 이 소유한다 | `parseBranchList` 단위 테스트 `9건` | `gitBranches` → `BranchMenu` | ✅ `git-parse.test.ts` |
| AC3 | 깨끗한 트리에서 브랜치를 고르면 실제 `checkout` 이 일어나고 칩 라벨이 새 브랜치로 갱신된다 | 실 저장소 fixture 통합 테스트 — checkout 후 `gitStatus().branch` 가 대상 | `gitCheckout` → `refresh()` | ❌ `git-cli.ts` 테스트 0건 |
| AC4 | 더티 트리 + `resolution` 없음이면 main 은 **작업 트리를 한 바이트도 바꾸지 않고** `{ok:false,reason:'dirty',from,stat}` 을 돌려준다 | 실 저장소 fixture — 호출 전후 `git status --porcelain` 출력이 동일 + 반환 형상 | `gitCheckout(cwd,branch)` | ❌ 테스트 0건 |
| AC5 | 해소 3종은 **추적 변경만** 건드린다 — 미추적 파일은 셋 다에서 남는다 | 실 저장소 fixture 3케이스 — 미추적 파일이 stash·commit-wip·discard 후에도 존재 | `resolveDirty` | ❌ 테스트 0건 |
| AC6 | 분할 버튼 메뉴에서 방식을 고르는 것만으로는 **아무 것도 실행되지 않는다** | 컴포넌트 테스트 — 메뉴 항목 클릭 후 `onConfirm` 호출 0회, 왼쪽 버튼 클릭에서 1회 | `BranchSwitchDialog` | ❌ 테스트 0건 |
| AC7 | 브랜치 이름은 IPC 경계 **와** 실행부 두 지점에서 문자셋 검사를 받는다 | 지점 2개 각각에 `-f` · `--` · `a..b` · `x.lock` 주입 → 둘 다 거부 | `GitCheckoutRequestSchema` + `git-cli` | ❌ **실행부 검사 0건** — `rg -e regex -e refine git-cli.ts` → 0 |
| AC8 | 전환 실패는 조용히 삼켜지지 않고 사유가 화면에 뜬다 | 컴포넌트 테스트 — `reason:'error'` → 오류 모달에 `message` 노출 | `BranchChip.setError` | ⚠️ 로직 있음, 테스트 0건 |
| AC9 | **해소는 성공했는데 checkout 이 실패하면** 변경이 어디로 갔는지(스태시/WIP 커밋/폐기)가 사용자에게 보인다 | 실 저장소 fixture — checkout 실패를 강제하고 반환값이 적용된 해소를 식별 + 그 문구가 모달에 도달 | `gitCheckout` 부분 실패 경로 | ❌ 현재 checkout 오류 문구만 반환 |
| AC10 | 참조 경로 칩 추가/제거가 `chat:send` 페이로드의 `extraDirs` 로 나간다 | store 테스트 — `addExtraDir` 후 send 페이로드에 배열 · 0개면 키 자체가 없음 | `chatActions.addExtraDir` → `send()` | ❌ 리듀서/스토어 테스트 0건 |
| AC11 | `extraDirs` 는 어댑터 `additionalDirectories` 와 workspace 가드 훅에 **같은 배열**로 도달한다 | 어댑터 테스트 — `query()` 옵션의 배열과 `makeWorkspaceGuardHook` 인자가 **동일 참조** | `claude.ts:343→367·392` | ❌ 테스트 0건 |
| AC12 | `extraDirs` 원소는 **절대 경로만** 허용된다 — 상대경로·빈 세그먼트는 IPC 에서 거부된다 | 스키마 테스트 — `['refs']` · `['../x']` 거부, `['/abs']` 통과. 그리고 `resolveGuardRoots` 가 상대경로를 받지 않음 | `SendChatMessageSchema.extraDirs` | ❌ 현재 `z.string().min(1)` 뿐 |
| AC13 | `sessions.extra_dirs` 가 왕복한다 — `insertSession(extraDirs)` → `getSessionById().extra_dirs` | `queries.test.ts` — 배열 저장 후 JSON 문자열로 복원 · 빈 배열/미지정은 `NULL` | `HistoryWriter.insertSession` | ❌ `rg extra_dirs infra/**/*.test.ts` → 0건 |
| AC14 | 참조 경로 해석이 cwd 와 같은 규칙이다 — 새 채팅=요청값 · resume=세션행 우선 · continuity=출발 세션 · 손상값=없음 | `turn-context.test.ts` `extraDirs 해석` **6케이스** | `buildTurnContext` | ✅ 6/6 통과 |
| AC15 | cwd 를 바꾸면 참조 경로가 비워지고, 중복·cwd 자기 자신 추가는 무시된다 | 리듀서 테스트 — `SET_CWD` 후 `extraDirs:[]` · 같은 값 2회 추가 시 길이 1 | `chatReducer` | ❌ 테스트 0건 |
| AC16 | 작업 컨텍스트 행은 **랜딩에서만** 렌더된다 | 컴포넌트 테스트 — `sessionId != null` 인 엔트리에서 `CwdPanel` 부재 | `Composer` → `CwdPanel` | ⚠️ `data-state="landing"` 고정, 테스트 0건 |
| AC17 | 모드 메뉴는 `auto_classified·default·accept_edits·plan·bypass` 5종을 이 순서로 내걸고 `dont_ask` 는 카탈로그에만 남으며, 노력 `xhigh` 라벨은 '엑스트라' 다 | `modes.test.ts` 4케이스 + ko 리소스 leaf 단언 | `ModeMenu` · `EffortMenu` | ✅ 통과 |
| AC18 | 기본 권한 모드가 renderer 초기값과 main 미설정 기본값에서 **같은 값**이다 | 두 지점을 **한 상수에서** 읽고, 그 상수를 바꾸면 양쪽 테스트가 함께 실패한다 | `chatReducer:211` · `permission-mode-controller:20` | ❌ 값은 같으나 **리터럴 2개 · SSOT 0** |
| AC19 | 문서·인벤토리가 코드 실측과 일치한다 — 채널 79 · 도메인 23 · 마이그레이션 17 | `ipc-documentation.test.ts` + `check-doc-inventory.mjs --check` | CI gate | ✅ `[doc-inventory] ok (79 channels)` |
| AC20 | `git` 3채널의 검증 실패 정책이 문서와 코드에서 같다 — 읽기 2종 무해 폴백 · 전환만 `reject` | `handlers/git.ts` 등록부 ↔ `IPC_CONTRACT.md §2.6-b` 대조 테스트 | `registerGitHandlers` | ⚠️ 코드·문서 일치, 대조 장치 0건 |
| AC21 | **마이그레이션을 하나 더해도 테스트 픽스처가 자동으로 따라온다** — 정본(`migrate.ts`) 밖에 마이그레이션 목록 사본이 0개다 | `rg "migrations/\d{4}[^']*\.sql\?raw" src/ -l` → `migrate.ts` 와 `migrate.test.ts` 만. 골든 목록은 명세이므로 예외로 명시 | 게이트 스크립트 | ❌ 현재 사본 **4곳** |
| AC22 | AC21 의 검사 장치가 **양방향으로** 반응한다 — 사본을 되살리면 실패하고, 픽스처에서 `applyMigrations(db)` 를 지워도 실패한다 | 변이 2종을 심어 각각 red 확인. 후자는 스키마 부재로 해당 스위트 전건 실패 | 게이트 스크립트 + vitest | ❌ 장치 미존재 |
| AC23 | 이 브랜치가 새로 만든 prettier 위반이 0이다 | `npx eslint --no-fix <변경 파일>` → 이 브랜치 기인 warning 0 | CI `Lint` | ❌ 현재 **7건** (`queries.ts` 4 · `ipc.ts` 2 · `turn-context.ts` 1) |
| AC24 | windows 러너 gate 9스텝이 전건 success 다 | `.github/workflows/ci.yml` 실행 결과 | CI | ✅ run `32918456816` (CI 수정 브랜치 기준) |

### AC 검증 주의사항

- **기존 테스트 재사용**: `turn-context.test.ts` 의 `describe('extraDirs 해석')` **6 `it()` 실재 확인**(AC14) · `modes.test.ts` 4케이스 실재 확인(AC17) · `git-parse.test.ts` 9케이스 실재 확인(AC2).
- **사람 실기 항목**: 컴포저 상단 행의 **시각 정렬**(칩 높이·반경·글리프)만 사람 몫이다 — D-011이 `chipSurface` 한 곳으로 모았으므로 *어느 클래스를 쓰는가* 는 순수 단언으로 내릴 수 있고, *눈에 어긋나 보이는가* 만 남는다. 나머지(목록 포함 여부·상태 파생·라벨)는 전부 순수 테스트다.
- **`동일 배열` 기준(AC11)**: 값 비교가 아니라 **참조 동일성**을 단언한다 — 두 곳이 각각 `[...extraDirs]` 로 복사해도 값 비교는 통과하지만 D-006의 드리프트 방지는 깨진다.
- **`0건` 기준 분해(AC21)**: 허용 대상 = `migrate.ts`(정본) + `migrate.test.ts`(골든 목록 · `APPLIED_SQL` 6건은 "부분 적용된 오래된 DB" 시나리오라 의도적 부분집합). 제거 대상 = 나머지 4곳. `queries.test.ts` 의 `dbBefore0006()` 도 의도적 부분집합이므로 술어에서 제외한다.
- **방향 규칙(AC22)**: AC21 은 음성 게이트(`= 0`)라 "사본이 없다" 만 잠근다. "픽스처가 정본을 통과한다"는 양성 불변식이므로 `applyMigrations` 제거 변이를 함께 심어야 잠긴다.
- **AC24 의 도달 범위**: 현재 green 은 **CI 수정 브랜치**(`5e6fdcb`)에서 관측한 것이다. PR #382 의 head 는 그 커밋을 아직 갖지 않아 red 다 — 구현 턴이 합류시켜야 AC24가 PR #382 에 대해 성립한다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `git` 서브프로세스가 main 에 처음 들어온다 — shell 미경유 `execFile`, 10초 타임아웃, 4MB 버퍼 | `app/src/main/infra/git/git-cli.ts:36-45` |
| 읽기에 `GIT_OPTIONAL_LOCKS=0` · 전역 `GIT_TERMINAL_PROMPT=0` | `git-cli.ts:22` `GIT_ENV` |
| `symbolic-ref --short -q HEAD` 를 쓰는 이유 = unborn 브랜치에서도 이름을 준다 | `git-cli.ts:56-62` |
| **`protocol.ts` 주석이 "main 의 실행부도 같은 규칙을 한 번 더 검사한다"고 적었으나 실행부 검사는 0건** | `protocol.ts:189` 주석 ↔ `rg -e regex -e refine git-cli.ts` → 0 |
| `resolveGuardRoots` 는 `additionalDirs` 를 `path.resolve` 후 **writeRoots 와 readRoots 양쪽**에 넣는다 | `workspace-guard.ts:53-64` |
| `extraDirs` 의 유일한 검증은 `z.array(z.string().min(1))` — 절대경로·존재·중복 검사 없음 | `protocol.ts:76` |
| `DbQueries` 생성자가 statement **46개**를 즉시 준비한다(파일 전체 53개 → 지연 7개) | `queries.ts:102-…` |
| 그 46개가 참조하는 테이블 9개 | `messages·message_parts·messages_fts·projects·provider_limits·session_lineage·sessions·turn_usage·turn_model_usage` |
| `check-migrations-appendonly.mjs` 는 파일 **2개만** 읽는다 — `migrations/` 디렉토리와 `migrate.ts` | `runCli()` `readdirSync(MIGRATIONS_DIR)` + `readFileSync(MIGRATE_SOURCE)` |
| 그 스크립트의 import 정규식은 `'./migrations/…?raw'` 로 앵커돼 픽스처의 `'../../infra/db/migrations/…'` 를 매칭하지 못한다 | `parseImportedMigrations` |
| 기본 권한 모드 리터럴이 2곳 — 공유 상수 없음 | `chatReducer.ts:211` · `permission-mode-controller.ts:20` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 마이그레이션 SQL `?raw` import 를 가진 파일 | `rg -l "migrations/0001_initial.sql" src/ scripts/` | 6 | 정본 1 + 골든 1 + **사본 4** |
| 그 중 `0013_schedules` 를 빠뜨린 픽스처 | 디렉토리 ↔ 파일별 import 차집합 | 3 | fork · builder · continuity — 조용한 파손(B) 실현 사례 |
| `git` 채널 | `rg "orca:git:" src/shared/ipc.ts` | 3 | `status` · `branches` · `checkout` |
| `worktree` 언급 | `rg "worktree" src/` | 2 | 둘 다 주석 — 채널·UI 0 (D-001 성립) |
| `additionalDirectories` 배선 지점 | `rg "additionalDirectories" src/main/adapters/` | 4 | 선언 1 · 주석 1 · 옵션 1 · 훅 1 |
| 기본 권한 모드 리터럴 | `rg "'auto_classified'" src/ --글로브 non-test` | 2 | SSOT 부재 |
| `git-cli.ts` / `handlers/git.ts` 테스트 | `ls src/main/infra/git/*.test.*` · `ls src/main/app/handlers/git*.test.*` | 0 | 실행부·핸들러 무검증 |
| 컴포저 신규 컴포넌트 테스트 | `ls composer/*.test.*` 중 Branch·ExtraDir·CwdPanel | 0 | 4개 신규 컴포넌트 무검증 |

### 수치 / 전칭 표현 검산

- **재측정 수치**: 채널 79 · 도메인 23(`node -e` 로 `CHANNELS` 파싱) · 마이그레이션 17(`ls | wc -l`). 인벤토리 표의 79/23/17과 일치.
- **내역 합 = 총계**: CI 실패 39건 = queries 26 + continuity 2 + migrate 3 + fork 4 + builder 4 = **39** ✅. 전체 2138 = 39 실패 + 2099 통과 ✅.
- **"유일한/항상" 반례 검색**: "`git` 도메인이 main 의 유일한 서브프로세스" 는 검증하지 않았으므로 본문에 쓰지 않는다.
- **문서 앵커 확인**: `docs/IPC_CONTRACT.md:163` `### 2.6-b Git (컴포저 브랜치 칩)` 실재 ✅.
- **기존 테스트 케이스 존재 확인**: `turn-context.test.ts` extraDirs 6건 ✅ · `git-parse.test.ts` 9건 ✅ · `modes.test.ts` 4건 ✅.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- **책임 소유자**: 구현은 이미 배치돼 있다 — `infra/git/`(실행·파싱), `app/handlers/git.ts`(IPC), `CwdPanel`(조립), `chatReducer`(랜딩 상태).
- **entry → flow → store → consumer**: `BranchChip` → `gitApi.status/branches/checkout` → `handle()` zod → `git-cli` `execFile` → 결과 값 → 칩 라벨/모달. 참조 경로는 `CwdPanel` → `chatReducer.extraDirs` → `chat:send` → `buildTurnContext` → `TurnContext.extraDirs` → 어댑터 + `sessions.extra_dirs`.
- **오류/취소/정리**: git 실패는 예외가 아니라 결과 값(`reason`)이다. 읽기 2종은 무해 폴백, 전환만 `reject`.
- **구조적 제약 3가지**:
  1. **테스트 seam 이 파싱에서 끊긴다**. `git-parse.ts` 는 순수라 테스트가 붙었고 `git-cli.ts`(실행·해소·checkout)는 붙지 않았다 — 파괴적 동작 3종이 전부 무검증 쪽에 있다.
  2. **신뢰 경계가 비대칭이다**. 브랜치 이름은 "IPC 는 신뢰 경계"라며 문자셋을 잘랐는데, 보안 가드의 루트를 넓히는 `extraDirs` 는 `min(1)` 만 받는다.
  3. **마이그레이션 목록이 5곳에 산다**. 정본 1 + 골든 1 + 사본 4이고, 사본을 보는 게이트가 없다.

```text
[BranchChip] → gitApi → handle(zod ①) → git-cli(execFile) → 결과 값
[CwdPanel]   → chatReducer.extraDirs → chat:send(zod min(1)) → TurnContext
                                                              ├→ additionalDirectories(동일 배열)
                                                              ├→ makeWorkspaceGuardHook(동일 배열)
                                                              └→ sessions.extra_dirs
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- **책임 소유자 — 유지**. 모듈 경계·레이어·채널은 그대로다. 이 handoff 는 **구조를 바꾸지 않고 강제 지점과 관측 장치를 채운다**.
- **달라지는 동작 4가지**:
  1. `git-cli.gitCheckout` 이 실행 직전 브랜치 이름을 다시 검사한다(AC7) — 두 번째 강제 지점.
  2. `gitCheckout` 이 부분 실패를 구분해 돌려준다 — 해소가 적용된 뒤 checkout 이 실패하면 `applied: GitDirtyResolution` 을 실어 renderer 가 "변경은 스태시됨, 브랜치는 그대로" 를 말할 수 있게 한다(AC9).
  3. `extraDirs` 스키마가 절대 경로만 받는다(AC12).
  4. 기본 권한 모드가 `shared/permission-mode.ts` 의 상수 하나에서 나온다(AC18).
- **신설되는 것 — 관측 장치**: `git-cli` 실 저장소 fixture 테스트 · 어댑터 동일-배열 테스트 · DB 왕복 테스트 · 리듀서 테스트 · 컴포넌트 테스트 4종 · 마이그레이션 사본 게이트.
- **제거되는 것**: 픽스처 4곳의 마이그레이션 목록 사본 → `applyMigrations(db)` 한 줄(AC21).

```text
[BranchChip] → gitApi → handle(zod ①) → git-cli(zod ② 재검사) → execFile → 결과 값(부분 실패 식별 포함)
[CwdPanel]   → chatReducer.extraDirs → chat:send(zod 절대경로) → TurnContext → 동일 배열 2소비처 + DB
[픽스처 4곳] → applyMigrations(db)  ← 정본 하나
[게이트]     → 사본 스캔 + applyMigrations 제거 변이  ← 양방향
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 신뢰 경계 | 브랜치 이름 1지점 · `extraDirs` 사실상 0지점 | 브랜치 2지점 · `extraDirs` 절대경로 강제 | 주석이 약속한 2지점이 실재하지 않고, 가드 루트를 넓히는 입력이 무검증 | `git-cli.ts` · `protocol.ts` · AC7 · AC12 |
| 부분 실패 | 해소 적용 후 checkout 실패 시 checkout 오류만 반환 | 적용된 해소를 결과에 실어 화면이 말한다 | `discard` 는 되돌릴 수 없다 — 어디로 갔는지 안 보이면 데이터 유실로 읽힌다 | `GitCheckoutResult` · AC9 · §13 |
| 기본 권한 모드 | 리터럴 2개 + "맞춰라" 주석 | 공유 상수 1개 | 주석은 강제가 아니다 | `shared/permission-mode.ts` · AC18 |
| 마이그레이션 목록 | 정본 1 + 골든 1 + **사본 4** | 정본 1 + 골든 1 + 사본 0 | 사본을 보는 게이트가 없어 A/B 두 파손이 이미 실현됐다 | 픽스처 4파일 · 가드 스크립트 · AC21·AC22 |
| test seam/관측점 | 순수 파서만 테스트 · 실행부·핸들러·컴포넌트 0 | 실 저장소 fixture + 컴포넌트 + 어댑터 참조 단언 | 파괴적 동작 3종이 무검증 쪽에 있다 | AC3·AC4·AC5·AC6·AC11 |
| 포맷 | 커밋 트리에 prettier warning 7 | 0 | `npm run lint` 가 `--fix` 라 CI 는 조용하지만 커밋된 트리는 포매터와 어긋나 있다 | AC23 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `infra/git/git-parse.ts` | git stdout 해석 (순수) | `string` → `GitDirtyStat`·`string[]` | `git-cli.ts` |
| `infra/git/git-cli.ts` | 프로세스 실행 · 더티 해소 · checkout | `cwd`·`branch`·`resolution` → 결과 값 | `app/handlers/git.ts` |
| `app/handlers/git.ts` | 채널 등록 + 검증 실패 정책 | zod 검증 후 위임 | `bootstrap.ts:858` |
| `app/chat-turn/turn-context.ts` | `extraDirs` 해석(새 채팅/resume/continuity) | 요청+세션행 → `string[]` | `buildTurnContext` |
| `adapters/workspace-guard.ts` | 가드 루트 해석 · PreToolUse 판정 | `ws`+`additionalDirs` → `GuardRoots` | `claude.ts:392` |
| `renderer/…/composer/chipSurface.ts` | 칩 외형 SSOT (`flat`·`outlined`) | `variant` → className | `CwdButton`·`ComposerChip`·`ExtraDirChip` |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 (지점 수) | 실패 의미 |
|---|---|---|---|---|
| 브랜치 이름 문자셋 | `GitBranchNameSchema` (`protocol.ts`) | `handle()` + `git-cli.gitCheckout` | invoke 검증 시점 · **execFile 직전** (**2**) | 옵션 주입(`-f`·`--`)·refspec 문법이 `git checkout` 인자로 들어간다. **현재 1/2** — `protocol.ts:189` 주석이 2를 약속했으나 실행부 검사 0건 |
| `extraDirs` 절대 경로 | `SendChatMessageSchema.extraDirs` | IPC 스키마 + `resolveGuardRoots` | `chat:send` 검증 시점 · 가드 루트 해석 시점 (**2**) | 상대경로는 main 프로세스 cwd 기준으로 풀리고, `/` 한 개면 `writeRoots` 가 루트를 덮어 0075 가드가 무력화된다. **현재 0/2** |
| `additionalDirectories` ↔ 가드 루트 동일 배열 | `claude.ts:343` 지역 배열 | 어댑터 | `query()` 옵션 조립 · 훅 생성 (**2**) | 옵션은 넓은데 가드는 좁거나 그 반대 — D-006 이 막으려는 드리프트. **현재 2/2 성립(참조 동일), 관측 장치 0** |
| 기본 권한 모드 | (신설) `shared/permission-mode.ts` 상수 | 렌더러 초기 상태 + main 미설정 조회 | 리듀서 초기값 · 컨트롤러 기본 인자 (**2**) | 칩과 main 이 서로 다른 모드를 진실로 삼는다. **현재 리터럴 2개 · SSOT 0** |
| 마이그레이션 목록 | `migrate.ts MIGRATIONS` | 픽스처 + 골든 목록 + 가드 스크립트 | 픽스처 DB 생성 (**4**) · 골든 단언 (**1**) · 사본 스캔 (**1**) | **A(즉시)** = 새 컬럼이 생성자 46문에 실리면 픽스처가 `new DbQueries(db)` 에서 즉사(0017 → 39건). **B(조용)** = 새 테이블이면 아무도 안 죽고 픽스처만 실제 스키마와 갈라진다(0013 → 3곳). **현재 사본 4** |
| `git` 채널 검증 실패 정책 | `handlers/git.ts` 등록부 | `handle()` | 등록 시점 (**3채널**) | 읽기가 `reject` 가 되면 저장소 아닌 폴더에서 컴포저가 깨진다 |

- **같은 규칙이 여러 레이어에 있을 때 SSOT 와 공유 방법**: 브랜치 문자셋은 `GitBranchNameSchema` 를 `git-cli` 가 **import 해서 재사용**한다 — 정규식을 복붙하지 않는다. 기본 권한 모드는 `shared/permission-mode.ts` 에 `DEFAULT_PERMISSION_MODE` 를 두고 양쪽이 읽는다.
- **`실패 의미` 에 "다른 게이트가 막는다" 를 적었는가**: 적지 않았다. 마이그레이션 행의 A 는 vitest 가 잡지만 **B 는 어떤 게이트도 잡지 못한다**는 것이 이번 턴의 실측이다 — `check-migrations-appendonly.mjs` 는 파일 2개만 읽고, `check-doc-inventory.mjs` 는 문서를 보며, lint/typecheck 에는 16개짜리 목록과 17개짜리 목록이 똑같이 유효하다.
- **선택적 필드의 `true/false/undefined` 의미**: `resolution` 미지정 = "아직 묻지 않았다"(D-003 — 아무 것도 하지 않고 되돌아온다). `extraDirs` 미지정 = 없음, 빈 배열 = 없음(DB 는 둘 다 `NULL`). `hidden` 미지정 = 메뉴에 내건다.
- **외부 SDK 경계**: `additionalDirectories` 는 Agent SDK `query()` 옵션이 요구하는 `string[]`(절대 경로)이다 — AC12 의 절대경로 강제는 SDK 요구와 같은 방향이다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/infra/git/git-cli.ts` | 실행부 | `GitBranchNameSchema` import 해 checkout 직전 재검사(AC7) · 부분 실패에 `applied` 실어 반환(AC9) | 실 저장소 fixture 통합 |
| `app/src/shared/protocol.ts` | 계약 | `extraDirs` 를 절대 경로 스키마로(AC12) · `GitCheckoutResult` 에 `applied` 추가 | 스키마 단위 |
| `app/src/shared/permission-mode.ts` | 계약 | `DEFAULT_PERMISSION_MODE` 신설(AC18) | 단위 |
| `app/src/renderer/…/chatReducer.ts` · `permission-mode-controller.ts` | 소비처 | 리터럴 → 상수 참조 | 단위 |
| `app/src/main/infra/git/git-cli.test.ts` (신규) | 관측 | 임시 저장소 fixture — AC3·AC4·AC5·AC7·AC9 | 통합(실 git) |
| `app/src/main/adapters/claude.extra-dirs.test.ts` (신규) | 관측 | `query()` 옵션 배열과 훅 인자의 **참조 동일성**(AC11) | 단위(SDK fake) |
| `app/src/main/infra/db/queries.test.ts` | 관측 | `extra_dirs` 왕복 케이스 추가(AC13) | 단위 |
| `app/src/renderer/…/chatReducer.extraDirs.test.ts` (신규) | 관측 | AC15 · AC10 | 순수 리듀서 |
| `app/src/renderer/…/composer/BranchSwitchDialog.test.tsx` (신규) | 관측 | AC6 — 메뉴 선택은 실행하지 않는다 | 컴포넌트 |
| `app/src/renderer/…/composer/BranchChip.test.tsx` (신규) | 관측 | AC1 · AC8 | 컴포넌트 |
| 픽스처 4파일 | 중복 제거 | 목록 사본 → `applyMigrations(db)`(AC21) | — |
| `app/scripts/check-migrations-appendonly.mjs` | 게이트 | 정본 밖 마이그레이션 `?raw` import 스캔 + 허용 목록(AC21·AC22) | `check-migrations-appendonly.test.mjs` |

### 테스트 가능성

- **electron/DB/native 분리**: `git-cli.ts` 는 electron 비의존(`node:child_process` + `node:fs/promises`)이라 `vitest` 로 직접 돈다 — 별도 순수 파일 seam 이 더 필요하지 않다. 실 `git` 바이너리는 CI(windows-latest)와 로컬 모두에 있다(`git version 2.55.0.windows.4` — CI 로그 관측).
- **기존 메커니즘 재사용 적합성**: `applyMigrations(db)` 를 픽스처가 그대로 쓸 수 있음을 **이번 턴에 실측했다** — 4개 파일을 치환해 `38/38 통과` 후 원복. `getLogger()` 는 미초기화 시 no-op 폴백이라 출력이 조용하고(`registry.ts:9`), 추가로 생기는 `_migrations` 테이블을 그 4개 스위트는 읽지 않는다.
- **순서 관측**: AC9 의 "해소 → checkout" 순서는 반환값의 `applied` 필드로 관측한다 — 순서 로그를 따로 두지 않는다.
- **컴포넌트 테스트 도입 비용**: 현재 `composer/` 의 테스트 6개는 전부 `.test.ts`(순수)다. `.test.tsx` 렌더 테스트가 이 디렉토리에 처음 들어오므로, 구현 턴은 **기존 렌더 테스트 선례를 먼저 찾고**(`rg -l "@testing-library" src/renderer`) 없으면 그 사실을 `[구현자 기입]` 에 올린다 — 새 테스트 의존성 도입은 보고 대상이다.

## 12. End-to-end 영향

### producer → consumer

```text
CwdPanel(＋) → chatReducer.extraDirs → chat:send.extraDirs → buildTurnContext
   → TurnContext.extraDirs ─┬→ claude.ts additionalDirectories (query 옵션)
                            ├→ makeWorkspaceGuardHook (동일 배열)
                            └→ HistoryWriter.insertSession → sessions.extra_dirs
                                  → resume/fork/handoff 재해석(D-007)
```

- **producer 기준**: 절대 경로 배열. 빈 배열이면 `chat:send` 페이로드에서 키를 생략한다(`chatStore.ts:597`).
- **consumer 파생 규칙**: DB 는 빈 배열과 미지정을 같은 `NULL` 로 접는다(`queries.ts`) — 읽는 쪽이 두 표현을 구분할 이유가 없다.
- **파생 합성값이 정본을 우회하는가**: 아니다. renderer 는 세션 확정 후 `extraDirs` 를 다시 읽지 않고(`chatReducer.ts:89` 주석), main/DB 가 정본이다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:858` 채널 등록 | 3채널 증가 → 인벤토리 76→79 · 도메인 22→23 | AC19 |
| `workspace-guard.resolveGuardRoots` | `writeRoots`·`readRoots` 가 `extraDirs` 만큼 늘어난다 | AC11 · AC12 |
| `PermissionModeController` 미설정 세션 | 기본이 `plan`→`auto_classified` 로 바뀌어 **승인 게이트 강도가 낮아진다** | AC18 |
| `sessions` 행 소비처(list·getById·fork 복사) | 컬럼 1개 증가. `SELECT` 3곳이 이미 반영됨 | AC13 |
| 마이그레이션 픽스처 4곳 | 새 마이그레이션마다 A 또는 B 로 파손 | AC21 · AC22 |

## 13. Lifecycle / 오류 / 정리

- **생성/시작**: 브랜치 칩은 `cwd` 변경마다 `gitStatus` 를 1회 호출한다. 목록은 팝오버를 열 때만 조회한다.
- **취소/중단**: `useEffect` 의 `live` 플래그 + `snapshot.cwd === cwd` 비교로 늦게 온 응답을 버린다.
- **종료/crash**: `execFile` 자식은 10초 타임아웃으로 회수된다. 앱 종료 시 진행 중인 `git checkout` 은 별도 정리 경로가 없다 — 리스크 표에 둔다.
- **retry/partial failure**: 아래 다중 저장소 항목이 정본이다.
- **다중 저장소 쓰기 — 3건**:

| # | 함께 쓰는 두 곳 | 쓰기 지점 순서 | 사이에서 죽으면 관측되는 상태 | 처리 |
|---|---|---|---|---|
| 1 | 사용자 작업 트리(해소) → 사용자 작업 트리(checkout) | `resolveDirty` → `checkout` | **해소는 적용됐고 브랜치는 그대로**. `discard` 면 되돌릴 수 없다 | **허용 불가** → AC9 로 없앤다: 반환값이 적용된 해소를 식별하고 화면이 그것을 말한다 |
| 2 | 작업 트리(git) ↔ DB(`sessions.cwd`) | checkout 은 세션과 무관 · 세션행은 전송 시 기록 | 랜딩에서만 전환 가능(D-009)하므로 세션이 없는 동안만 갈라진다 | 설계로 없앰 — 세션 시작 후 브랜치 칩이 없다 |
| 3 | `plan.md` 판정 ↔ `INDEX.md` 보드 행 | plan 커밋 → INDEX 갱신 | 두 사본이 서로 다른 단계/주체를 말한다 | 같은 커밋에 담는다. §10 의 사본 수 = 2 |

## 14. 성능 / 상한 / 최적화

- **새 요청 수의 원천 상한 × 배치 상한**: `gitStatus` 는 cwd 변경당 1회(원천 = 사용자의 폴더 선택, 배치 없음). 내부적으로 `rev-parse` + `symbolic-ref` + `rev-parse HEAD` + `diff --shortstat` = **프로세스 4개**. `gitBranches` 는 팝오버 열기당 `rev-parse` + `symbolic-ref` + `for-each-ref` = **3개**. 주기적 폴링은 없다 — `BranchChip` 의 `useEffect` 의존성은 `[cwd]` 뿐이다.
- **주석과 코드의 불일치 1건**: `git-cli.ts:7` 이 "칩이 **주기적으로** 상태를 물으므로 index.lock 충돌 회피" 라고 적었으나 주기 조회는 없다. `GIT_OPTIONAL_LOCKS=0` 자체는 유효한 방어이므로 코드가 아니라 **주석을 정정한다**.
- **새 출력의 상한**: `maxBuffer` 4MB. 브랜치 수천 개 저장소에서 `for-each-ref` 출력이 이를 넘기면 `ok:false` → 빈 목록으로 접힌다(무해 폴백).
- **구조적 목표**: 픽스처 4파일에서 import 16줄 + 배열 16줄 = 파일당 최대 32줄 제거 → `applyMigrations(db)` 1줄. 이번 턴 실측으로 달성 가능함을 확인했다(38/38 통과).

## 15. 외부 구현 포트 / 문서 계약

- **외부/배포가 구현할 port/schema/config**: 없음. `git` 채널은 앱 내부 IPC 이고 외부 구현자가 붙는 표면이 아니다.
- **문서 계약**: `docs/IPC_CONTRACT.md §2.6-b` 가 3채널의 페이로드와 검증 실패 정책을 서술한다.
- **shape 검증**: `ipc-documentation.test.ts` 가 인벤토리 채널 수 ↔ `CHANNELS` 실측, 문서 도메인 목록 ↔ 코드 도메인을 대조한다(AC19).
- **semantics 검증**: 읽기 2종 무해 폴백 · 전환 `reject` 라는 **정책 자체**를 대조하는 장치는 없다(AC20).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| workspace 격리 0075 — cwd 밖 r/w 차단 | `workspace-guard.ts` 헤더 | §10 `extraDirs` 절대경로 행 · AC12 | **변경** — 가드 루트를 사용자가 넓힐 수 있게 됐으므로 그 입력에 강제를 붙인다 |
| 마이그레이션 append-only | `app/AGENTS.md` · `check-migrations-appendonly.mjs` | §11 가드 스크립트 확장 | **유지** — 기존 두 검사(sync·append-only)를 건드리지 않고 사본 스캔을 더한다 |
| IPC 검증 단일 경로 0012 | `infra/ipc/handle.ts` 헤더 | §10 `git` 채널 정책 행 | **유지** |
| 수치는 `docs/generated/inventory.md` 가 갖는다 (root AGENTS 원칙 4) | `AGENTS.md` | §8 수치 검산 | **유지** — 본문은 근거로만 인용하고 현재 상태 문서에 복제하지 않는다 |
| 커밋 trailer 프로토콜 | `docs/git-template.md` | §19 게이트 | **유지** — 설계 커밋은 `Status: designed`, 구현 산출과 섞지 않는다 |
| 0096/0097 라벨 카탈로그 stale 방지 | `modes.ts` 헤더 | D-013 `hidden` | **유지** — `dont_ask` 를 카탈로그에 남기는 이유가 이 규칙이다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 브랜치 칩이 사용자 작업 트리에 파괴적 명령(`reset --hard`)을 실행한다 | D-004 의 3동작 게이트(메뉴 열기 → 선택 → 실행 버튼) + AC5(추적 변경만) + AC9(적용 결과 가시화) |
| 기본 권한 모드 완화(`plan`→`auto_classified`)로 승인 게이트 강도가 낮아진다 | 제품 결정 D-012. AC18 은 값을 되돌리지 않고 **두 곳이 갈라지지 않음**만 잠근다 |
| `extraDirs` 가 0075 가드를 넓힌다 | AC12 절대경로 강제. 값 자체의 범위 제한(예: 홈 밖 금지)은 하지 않는다 — `/add-dir` 대응이 목적이다 |
| 실 `git` 의존 테스트가 CI 환경에 묶인다 | windows-latest 와 로컬 모두 `git` 보유 확인. fixture 는 `mkdtemp` + `git init` 로 자족한다 |
| 앱 종료 중 `git checkout` 진행 | 정리 경로 없음. 10초 타임아웃이 상한이며 이 handoff 범위 밖으로 둔다 |

- **되돌리기 어려운 결정**: `sessions.extra_dirs` 저장 형식(JSON 배열 문자열)과 `git` 채널 3종 이름. 둘 다 이미 확정됐고 append-only 가드가 변경을 막는다.
- **신규 의존성**: `git` 바이너리(런타임, PATH). 없으면 `isRepo:false` 로 접히므로 필수 의존이 아니다. 렌더 테스트 라이브러리는 §11 대로 구현 턴이 선례를 확인한 뒤 보고한다.

## 18. 영향 받는 파일 / 문서

- `app/src/main/infra/git/git-cli.ts` · `git-cli.test.ts`(신규)
- `app/src/shared/protocol.ts` · `app/src/shared/permission-mode.ts`
- `app/src/main/adapters/claude.extra-dirs.test.ts`(신규)
- `app/src/main/infra/db/queries.test.ts` · 픽스처 4파일(`queries` · `fork` · `builder` · `chat-turn.continuity`)
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` + 신규 테스트
- `app/src/renderer/src/features/chat/components/composer/BranchChip.test.tsx` · `BranchSwitchDialog.test.tsx`(신규)
- `app/src/main/features/approvals/permission-mode-controller.ts`
- `app/scripts/check-migrations-appendonly.mjs` · `check-migrations-appendonly.test.mjs`
- `docs/handoff/INDEX.md` · `docs/handoff/0201-composer-work-context-row/plan.md`

## 19. 게이트

- **적용할 하위 가이드**: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(레이어 DAG) · `app/src/renderer/AGENTS.md`.
- **환경 제약**: `npm test` 의 `pretest` 가 better-sqlite3 를 Node ABI 로 바꾼다. 이후 `npm run dev` 를 하려면 Electron ABI 재빌드가 필요하다 — 실행 순서를 분리한다. **이번 세션 환경에서는 `npm ci` → `ensure-sqlite-abi.mjs node` 가 정상 동작함을 확인했다**(rebuilt dependencies successfully).
- **기본 정적 게이트**: `cd app && npm run lint && npm run typecheck`. AC23 때문에 구현 턴은 **`npx eslint --no-fix` 도 함께** 돌린다 — `npm run lint` 는 `--fix` 라 위반을 조용히 고쳐 관측을 없앤다.
- **관련 테스트**: `npx vitest run src/main/infra/git src/main/infra/db src/main/adapters src/renderer/src/features/chat`.
- **DB 게이트**: `npm test` (마이그레이션 픽스처를 바꾸므로 이번에는 의도적으로 전체를 돈다). 기준선 = **216 파일 / 2138 테스트 전건 통과**(이번 세션 실측).
- **CI 게이트**: `.github/workflows/ci.yml` gate 9스텝 on windows-latest.
- **사람 실기**: 작업 컨텍스트 행의 시각 정렬 1건(§7 주의사항).

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — ACTIVE 15 · SUPERSEDED 3 · OPEN 0.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — D-004·D-005·D-015 는 사용자 문장을 원문 인용했다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 축으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 §11 구현 파일 또는 AC에 추적 가능하다 — 6행 전부 AC 번호를 갖는다.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 명시했다 — 픽스처 목록 사본은 **삭제**(정본으로 대체).
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 검산 절.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — 24행 전부 4칸 채움.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 시각 정렬 1건만 남겼고 이유를 적었다.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC11 은 "배열이 있다"가 아니라 **참조 동일성**을 단언한다.
- [x] "X가 쓰인다"를 요구하는 불변식의 검사 장치가 X를 지웠을 때 실패한다 — AC22 가 `applyMigrations` 제거 변이를 명시적 분모로 잡는다.
- [x] 정책 파라미터의 단위/범위가 명확하다 — `resolution` 3값 enum · `extraDirs` 절대경로 · `hidden` 미지정 의미를 §10에 적었다.
- [x] 참조 구현 사용 시 계약 union/enum 전수 대비 coverage가 있다 — `NormalizedPermissionMode` 6종 중 메뉴 5 + hidden 1 = 6/6(AC17).
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 6행 전부 지점 수를 명시했다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 5행.
- [x] producer/consumer 양쪽 의미를 확인했다 — 빈 배열↔`NULL` 접힘 규칙.
- [x] 상한·총량·one-way door를 계산했다 — §14 프로세스 4/3개 · `maxBuffer` 4MB · §6 one-way door 표.
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다 — ABI 순서 주의를 §19에 승계했다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고 결과를 §3 갱신 메모에 관측으로 적었다.
- [x] 산출물 문장 규칙을 지켰다 — Part I은 관측 결과, Part II는 경로·계약으로 갈랐다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| 브랜치 이름 문자셋 | invoke · execFile 직전 (2) | … | … | … |
| `extraDirs` 절대 경로 | `chat:send` · 가드 루트 해석 (2) | … | … | … |
| `additionalDirectories` 동일 배열 | 옵션 조립 · 훅 생성 (2) | … | … | … |
| 기본 권한 모드 | 리듀서 초기값 · 컨트롤러 기본 인자 (2) | … | … | … |
| 마이그레이션 목록 | 픽스처 (4) · 골든 단언 (1) · 사본 스캔 (1) | … | … | … |
| `git` 채널 검증 정책 | 채널 등록 (3) | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| … | … | … | … |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치 / 📝 plan 수정 제안 / ⚠️ 보고만 | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 관측한 게이트 산출 | … |
| 강제 지점 전수 | N/14 |
| AC 자기보고 | N/24 |
| 합계 검산 | `✅ N · ⚠️ M · ❌ K = 총 24` |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드 수: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | — | — | — | — |
