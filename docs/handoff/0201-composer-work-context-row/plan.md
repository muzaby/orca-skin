# Plan — 0201-composer-work-context-row

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0201-composer-work-context-row` |
| 작성자 | Claude Code |
| 일자 | 2026-08-26 |
| 매핑 | PR #382(draft) · 구현 브랜치 `claude/composer-branch-and-add-dir` · CI 수정 브랜치 `claude/ci-failure-fix-dquqv7` |
| 상태 | … → plan/READY (r3) → **impl/IMPL_DONE (r3)** — 단계·좌표 정본은 [`INDEX.md`](../INDEX.md) |

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
| D-019a | `extraDirs` 원소만 루트를 거부한다 | — | r1 verify D3 | SUPERSEDED | → D-019 |
| D-019 | **가드 루트가 되는 경로는 루트가 아니어야 한다** — `extraDirs` **와 `cwd`(작업 경로)** 양쪽이 대상이다 | "루트는 모든 경로의 조상이라 가드를 무력화한다" 는 이유가 두 축에 똑같이 걸린다 — 실측 `resolveGuardRoots('/', []).writeRoots[0] === '/'` 로 **cwd 쪽이 오히려 첫 번째 write 루트**다. **범위 정책이 아니라 축퇴 값 배제**이므로 어떤 실제 폴더도 계속 허용된다 | r1 verify D3 → 사용자 결정 · r2 구현자 발견(cwd 축) → **사용자 확장 지시** | ACTIVE | D-019a 대체 |
| D-020 | 루트 거부는 **칩 추가 시점에** 하고 이유를 사용자에게 보여준다 — 조용한 무시가 아니다 | 칩 추가를 막지 않고 IPC 에서만 막으면 칩은 남고 전송이 `schema_validation_error` 로 죽어 "사용자는 원인을 모른 채 그 칩을 지울 때까지 막힌다". IPC·가드·DB 3지점은 방어선으로 유지 | r1 verify D3 → 사용자 결정 | ACTIVE | — |
| D-021 | cwd 는 **필수라 버릴 수 없다** — 거부 지점마다 대응이 다르다: 선택은 막고, 세션행 손상값은 **프로젝트 기본 cwd 로 폴백**, 가드는 도달 불가 전제를 **소리내어 깬다**(throw) | `extraDirs` 는 버리면 스코프가 좁아질 뿐이지만 cwd 를 버리면 턴이 설 자리가 없다. 폴백은 이미 있는 경로(`getCwd(projectId)` — cwd 미지정 시의 기존 동작)를 재사용하므로 새 동작을 만들지 않는다 | r2 확장 설계 | ACTIVE | — |

### 갱신 메모

- **새로 추가된 결정**: D-016 · D-017 · D-018 (설계 턴) · **D-019 · D-020 (r1 verify D3 정정 턴)** · **D-021 (r2 확장 턴)**.
- **변경된 결정**: D-019a → D-019 — r2 구현자가 `cwd` 축에서 같은 불변식 위반을 실측했고(§놓친 문제 1) 사용자가 확장을 지시했다. 축이 하나 늘었을 뿐 이유·조건절은 그대로다.
- **변경된 결정**: D-010a → D-010(툴팁 의미) · D-012a → D-012(기본 권한 모드) · D-015a → D-015(노력 라벨). 셋 다 사용자/구현자의 명시적 후속 커밋이 근거다.
- **이번 턴에 언급되지 않았지만 유지되는 ACTIVE**: D-001 ~ D-015 전부. 세션 턴 1~3은 CI 와 검증범위만 다뤘고 제품 계약을 건드리지 않았다.
- **r1 verify D3 정정 (2026-08-26)**: 검증자가 `규범 정정 필요` 로 올린 D3 을 여기서 닫았다 — AC12 문면 정정 · **AC25 신설** · §10 `extraDirs` 행 (2)→(4) · §17 리스크 행 정정. 근거 관측: `isAbsolutePath('/')=true` · `resolveGuardRoots('/tmp/ws',['/']).writeRoots[1] === '/'`.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-019↔AC12·**AC26**(두 축 루트 거부) 일치 · D-020↔AC25(선택 시점·가시적 사유, **두 선택창 모두**) 일치 · D-021↔AC26(폴백·throw 분기) 일치. 개별 판정 — D-001↔비범위("worktree 채널 0") 일치 · D-003↔AC5("아무 파일도 바꾸지 않는다") 일치 · D-004↔AC7 일치 · D-005↔AC6 일치 · D-006↔AC11 일치 · D-007↔AC14 일치 · D-009↔AC16 일치 · D-012↔AC18("두 곳이 같은 값") 일치 · D-013↔AC17 일치 · D-018↔AC21·AC22 일치. **D-002 는 AC1 과 같은 방향이나 AC1 이 더 강하다**(칩 부재 + detached 라벨까지) — 강화이지 반대가 아니다.

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
| **＋에서 루트 폴더를 고름** | 리듀서가 거부 — `extraDirs` 불변 | **칩이 붙지 않고 거부 사유가 보인다**(D-020). 조용한 무시가 아니다 |
| **작업 경로 버튼에서 루트를 고름** | 리듀서가 거부 — `cwd` 불변 | **경로가 바뀌지 않고 같은 사유가 보인다**(D-019·D-020) |
| resume 인데 세션행 cwd 가 루트 | `resolveTurnCwd` 가 프로젝트 기본 cwd 로 폴백 | 턴은 정상 진행. 작업 경로만 기본값으로 보인다(D-021) |
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
| AC12 | `extraDirs` 원소는 **절대 경로이면서 파일시스템 루트가 아니어야** 한다 — 상대경로·빈 세그먼트·루트(`/`·`C:\`·UNC share 루트)가 거부된다 (D-019) | 스키마 테스트 — `['refs']`·`['../x']`·**`['/']`·`['C:\\']`** 거부, `['/abs']` 통과. 그리고 `resolveGuardRoots` 가 **정규화 후에도** 루트를 루트 목록에 올리지 않는다(`writeRoots` 에 `/` 부재) | `ExtraDirSchema` → `resolveGuardRoots` → `parseExtraDirs` | ⚠️ r1 이 절대경로 3지점을 닫았다. **루트는 여전히 통과** — 실측 `writeRoots[1] === '/'` |
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
| AC25 | 폴더 선택창에서 **루트를 고르면 값이 반영되지 않고 그 이유가 화면에 보인다** — 참조 경로(＋)든 **작업 경로(cwd 버튼)**든 같다. 조용한 무시가 아니다 (D-019·D-020) | 리듀서 테스트 — `ADD_EXTRA_DIR('/')` 후 `extraDirs` 길이 0 · **`SET_CWD('/')` 후 `cwd` 불변**, 둘 다 거부 사유 상태가 세팅된다. ko/en 문구 leaf 실재. **렌더 하네스 불필요** — 사유를 리듀서 상태로 두어 순수 단언으로 내린다 | `CwdPanel.addDir`·`CwdButton` → `chatActions` → `chatReducer` | ⚠️ r2 가 참조 경로 축만 닫았다. **cwd 축 미구현** |
| AC26 | **cwd 가 루트면 가드 ws 가 되지 않는다** — 거부는 지점마다 다르게 끝난다 (D-021): `chat:send` 는 거부 · 손상된 세션행은 **프로젝트 기본 cwd 로 폴백**(턴은 계속 산다) · 가드는 **throw** 로 전제를 깬다 | 스키마 테스트 `cwd:'/'` 거부 · `resolveTurnCwd` 가 세션행 `'/'` 에서 `getCwd(project_id)` 를 돌려줌 · `resolveGuardRoots('/')` 가 throw. **`writeRoots[0]` 이 `/` 인 상태를 만들 수 없다** | `SendChatMessageSchema.cwd` → `resolveTurnCwd` → `resolveGuardRoots` | ❌ 현재 전부 무검증 — 실측 `writeRoots[0] === '/'` |

### AC 검증 주의사항

- **기존 테스트 재사용**: `turn-context.test.ts` 의 `describe('extraDirs 해석')` **6 `it()` 실재 확인**(AC14) · `modes.test.ts` 4케이스 실재 확인(AC17) · `git-parse.test.ts` 9케이스 실재 확인(AC2).
- **사람 실기 항목**: 컴포저 상단 행의 **시각 정렬**(칩 높이·반경·글리프)만 사람 몫이다 — D-011이 `chipSurface` 한 곳으로 모았으므로 *어느 클래스를 쓰는가* 는 순수 단언으로 내릴 수 있고, *눈에 어긋나 보이는가* 만 남는다. 나머지(목록 포함 여부·상태 파생·라벨)는 전부 순수 테스트다.
- **`동일 배열` 기준(AC11)**: 값 비교가 아니라 **참조 동일성**을 단언한다 — 두 곳이 각각 `[...extraDirs]` 로 복사해도 값 비교는 통과하지만 D-006의 드리프트 방지는 깨진다.
- **루트 판정 기준(AC12·AC25)**: 텍스트 루트 3형태(`/` · `X:\`·`X:/` · `\\srv\share`)를 거부한다. `/.` 같은 정규화 별칭은 텍스트 판정이 놓치므로 `resolveGuardRoots` 가 `path.resolve` **후** 잡는다(§10 2층 설계). AC12 는 앞 층을, AC25 는 사용자에게 보이는 결과를 단언한다 — 같은 규칙의 다른 축이다.
- **분모 변경**: AC 총수 **24 → 25**(AC25) → **26**(AC26). 라운드마다 분모가 달라졌으므로 이전 라운드 합계와 직접 비교하지 않는다.
- **AC 26건 — 분할 검토(§5 게이트)**: **분할하지 않는다.** 두 축(`extraDirs`·`cwd`)이 §10 에서 *하나의 불변식*을 공유하고 강제 지점 표가 두 축에 걸쳐 있어, 지금 가르면 그 표가 두 문서로 쪼개져 전수 대조가 불가능해진다. AC 증가분 2건은 전부 같은 불변식의 규범 정정이다.
- **루트 판정 기준(AC12·AC25·AC26)**: 두 축이 같은 SSOT(`isFilesystemRoot`)를 쓴다. 다른 것은 **거부 후 처리**뿐이다 — `extraDirs` 는 버리고, `cwd` 는 버릴 수 없어 폴백하거나 throw 한다(D-021).
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
| `extraDirs` 절대 경로 · 비루트 | `ExtraDirSchema` + `isFilesystemRoot` (`shared/absolute-path.ts`) | 칩 추가(리듀서) + IPC 스키마 + `resolveGuardRoots` + `parseExtraDirs` | **칩 추가 시점** · `chat:send` 검증 시점 · 가드 루트 해석 시점 · **세션행 읽기 시점** (**4**) | 상대경로는 main 프로세스 cwd 기준으로 풀린다. **루트는 모든 경로의 조상이라 `writeRoots` 에 오르면 0075 가드가 no-op 이 된다** — 실측 `resolveGuardRoots('/tmp/ws',['/']).writeRoots[1] === '/'`. **칩 추가 지점이 빠지면** 스키마 거부가 전송 전체를 `schema_validation_error`(`admission.ts:28`)로 죽이고 사용자는 원인을 모른 채 그 칩을 지울 때까지 막힌다. **현재 절대경로 3/4 · 루트 0/4** |
| `cwd` 비루트 | `isFilesystemRoot` (`shared/absolute-path.ts`) | `SET_CWD` 리듀서 + IPC 스키마 + `resolveTurnCwd` + `resolveGuardRoots` | 작업 경로 선택 시점 · `chat:send` 검증 시점 · 세션행 해석 시점 · 가드 ws 판정 (**4**) | **cwd 는 `writeRoots[0]` 이라 루트면 가드가 판정할 바깥이 아예 없다** — 실측 `resolveGuardRoots('/', []).writeRoots[0] === '/'`. `extraDirs` 와 달리 **버릴 수 없어** 지점마다 끝이 다르다(D-021): 선택 거부 · 세션행은 프로젝트 기본으로 폴백 · 가드는 throw. **현재 0/4** |
| `additionalDirectories` ↔ 가드 루트 동일 배열 | `claude.ts:343` 지역 배열 | 어댑터 | `query()` 옵션 조립 · 훅 생성 (**2**) | 옵션은 넓은데 가드는 좁거나 그 반대 — D-006 이 막으려는 드리프트. **현재 2/2 성립(참조 동일), 관측 장치 0** |
| 기본 권한 모드 | (신설) `shared/permission-mode.ts` 상수 | 렌더러 초기 상태 + main 미설정 조회 | 리듀서 초기값 · 컨트롤러 기본 인자 (**2**) | 칩과 main 이 서로 다른 모드를 진실로 삼는다. **현재 리터럴 2개 · SSOT 0** |
| 마이그레이션 목록 | `migrate.ts MIGRATIONS` | 픽스처 + 골든 목록 + 가드 스크립트 | 픽스처 DB 생성 (**4**) · 골든 단언 (**1**) · 사본 스캔 (**1**) | **A(즉시)** = 새 컬럼이 생성자 46문에 실리면 픽스처가 `new DbQueries(db)` 에서 즉사(0017 → 39건). **B(조용)** = 새 테이블이면 아무도 안 죽고 픽스처만 실제 스키마와 갈라진다(0013 → 3곳). **현재 사본 4** |
| `git` 채널 검증 실패 정책 | `handlers/git.ts` 등록부 | `handle()` | 등록 시점 (**3채널**) | 읽기가 `reject` 가 되면 저장소 아닌 폴더에서 컴포저가 깨진다 |

- **루트 판정은 2층이고 4지점은 중복이 아니다.** 칩 추가·스키마·세션행 읽기 지점은 **순수 텍스트 판정**(`isFilesystemRoot`)으로 `/`·`C:\`·`\\srv\share` 형태를 막는다 — 플랫폼 독립이라 Linux 러너와 windows CI 가 같은 답을 낸다(`isAbsolutePath` 와 같은 이유). 정규화해야만 드러나는 별칭(`/.` · `/a/..`)은 텍스트 판정이 놓치므로, **이미 `path.resolve` 를 하는 `resolveGuardRoots` 가 정규화 후 한 번 더 판정**한다. 앞 지점은 사용자에게 빨리 말하고, 뒤 지점은 무엇이 통과했든 가드를 지킨다 — 구현자는 한 지점으로 나머지를 갈음하지 않는다.
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
| `app/src/shared/absolute-path.ts` | 계약 | **`isFilesystemRoot` 신설**(D-019) — 텍스트 루트 3형태. `isAbsolutePath` 와 같은 파일·같은 플랫폼 독립 규칙 | 단위 |
| `app/src/renderer/…/reducer/chatReducer.ts` | 거부 지점 1 | `ADD_EXTRA_DIR` 이 루트를 거부하고 **사유 상태**를 세팅(AC25). 중복·cwd 자기 자신의 조용한 무시와 달리 사유가 남는다 | 순수 리듀서 |
| `app/src/renderer/…/components/CwdPanel.tsx` | 소비처 | 거부 사유를 행에 표시하고 다음 조작에서 지운다 | 컴포넌트(시각) |
| `app/src/renderer/…/i18n/resources/{ko,en}.ts` | 문구 | 루트 거부 사유 1키 | leaf 실재 단언 |
| `app/src/main/adapters/workspace-guard.ts` | 거부 지점 3 | `path.resolve` **후** 루트 판정 추가 — 별칭(`/.`)을 여기서 잡는다 | 단위 |
| `app/src/renderer/…/reducer/chatReducer.ts` | cwd 지점 1 | `SET_CWD` 가 루트를 거부하고 같은 사유 상태를 세팅. **두 dispatch 지점**(`setPendingCwd`·세션 복원)이 이 리듀서로 모인다 | 순수 리듀서 |
| `app/src/shared/protocol.ts` | cwd 지점 2 | `SendChatMessageSchema.cwd` 에 비루트 강제 | 스키마 단위 |
| `app/src/main/app/chat-turn/turn-context.ts` | cwd 지점 3 | `resolveTurnCwd` 가 루트 세션행/요청값을 `getCwd(projectId)` 로 폴백 | 순수 단위 |
| `app/src/main/adapters/workspace-guard.ts` | cwd 지점 4 | `ws` 가 루트면 **throw** — 도달 불가 전제를 조용한 가드 무력화 대신 소리내어 깬다 | 단위 |
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
| `extraDirs` 가 0075 가드를 넓힌다 | AC12 절대경로 + **비루트** 강제(D-019). **범위 정책은 여전히 하지 않는다** — 홈 밖 금지 같은 스코프 제한은 두지 않고 실제 폴더는 전부 허용한다. 루트만 배제하는 이유는 정책이 아니라 축퇴다: 루트가 `writeRoots` 에 오르면 가드가 판정할 바깥이 없어진다. **`cwd` 도 같은 축이다**(D-019 확장) — 오히려 `writeRoots[0]` 이라 더 직접적이다 |
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
- **r2(D-019·D-020)**: `app/src/shared/absolute-path.ts`(+`isFilesystemRoot`) · `app/src/main/adapters/workspace-guard.ts`(정규화 후 루트 판정) · `app/src/renderer/…/reducer/chatReducer.ts`(거부 + 사유 상태) · `…/components/CwdPanel.tsx`(사유 표시) · `…/i18n/resources/{ko,en}.ts`(사유 1키) · `app/src/main/app/chat-turn/turn-context.ts`(세션행 읽기)
- **r3(D-019 cwd 확장·D-021)**: `app/src/renderer/…/reducer/chatReducer.ts`(`SET_CWD` 거부) · `app/src/shared/protocol.ts`(`cwd` 비루트) · `app/src/main/app/chat-turn/turn-context.ts`(`resolveTurnCwd` 폴백) · `app/src/main/adapters/workspace-guard.ts`(`ws` throw) · `app/src/renderer/…/components/CwdButton.tsx`(사유 표시)
- **r2 파생 이슈(D1·D2·D4)**: `app/scripts/check-migrations-appendonly.test.mjs`(대상 집합 잠금) · `app/src/renderer/…/composer/branchChipState.ts`(`checkoutErrorView` seam) · `docs/IPC_CONTRACT.md`(§2.6-b `applied`)
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

- **동의 / 그대로 진행**: Part I 계약(D-001~D-018)과 §10 강제 지점 표를 그대로 수행했다. 소급 설계라 §7 `현재` 칸이 곧 작업 목록이었고, ❌ 15 · ⚠️ 4 를 전부 열어 닫았다.
- **이견 / 현실성 문제 — 2건**:
  1. **AC21 의 술어가 §7 주의사항과 충돌한다.** `rg "migrations/\d{4}[^']*\.sql\?raw" src/ -l` → `migrate.ts`·`migrate.test.ts` 만" 이 목표인데, 같은 절이 "`queries.test.ts` 의 `dbBefore0006()` 도 의도적 부분집합이므로 술어에서 제외한다" 고 적었다. 파일 단위 술어에서 그 둘은 동시에 참일 수 없다 — `queries.test.ts` 가 부분집합 import 를 남기면 목록에 계속 뜬다. **술어를 고치는 대신 부분집합을 옮겨** 목표 문장을 원문 그대로 성립시켰다(아래 §설계 대비 차이 2).
  2. **§11 이 지정한 `.test.tsx` 렌더 테스트는 신규 devDependency 없이 불가능하다.** 선례 실측 `rg -l "@testing-library" src/` → **0건**, `vitest.config.ts` 의 `include` 는 `src/**/*.test.ts`(=`.tsx` 미포함) · `environment: 'node'`(DOM 없음). §6 상 신규 의존성은 **보고만** 이고 `app/AGENTS.md §의존성 정책` 도 사용자 승인 필수라, 추가하지 않고 보고한다(아래 §설계 대비 차이 1).
- **ACTIVE Decision과 충돌하는 설계 발견**: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

> 검색 술어는 **불변식의 주어**로 잡았다(해법 이름이 아니라) — `isAbsolutePath` 로 세면 이미 고친 자리만 분모에 오른다.

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| 브랜치 이름 문자셋 | invoke · execFile 직전 (2) | **2/2** | `grep -rn "GitBranchNameSchema" src/ \| grep -v '\.test\.'` → `protocol.ts:201` 정의·`:211` invoke · `git-cli.ts:115` 실행부. `grep -n "run(cwd, \[" git-cli.ts` → 9지점 중 branch 를 싣는 것은 `:99`(stash 메시지)·`:140`(checkout) 둘뿐이고 둘 다 가드 뒤 | 없음 |
| `extraDirs` 절대 경로 | `chat:send` · 가드 루트 해석 (2) | **3/3** (§10 표 밖 1지점 신설) | `grep -rn "extraDirs\|additionalDirs" src/ --include=*.ts --include=*.tsx \| grep -v '\.test\.'` → 경로로 *해석* 하는 지점 3: `protocol.ts:87`(ExtraDirSchema) · `workspace-guard.ts:63`(filter) · **`turn-context.ts:69`(`parseExtraDirs` — DB 행 읽기)**. 나머지 히트는 전달·저장·상태 보관이라 해석 지점이 아니다 | 없음 |
| `additionalDirectories` 동일 배열 | 옵션 조립 · 훅 생성 (2) | **2/2** | `claude.ts:343` 지역 배열 → `:367` 옵션 · `:392` 훅. `claude.extra-dirs.test.ts` 가 `toBe`(참조 동일성)로 단언 — 값 비교가 아니다 | 없음 |
| 기본 권한 모드 | 리듀서 초기값 · 컨트롤러 기본 인자 (2) | **2/2** | `grep -rn "'auto_classified'" src/ --include=*.ts --include=*.tsx \| grep -v test` → 6건이 남지만 전부 타입 유니온·전수 배열·exhaustive switch·zod enum·메뉴 카탈로그다. **기본값 리터럴은 `permission-mode.ts:30` 하나** | 없음 |
| 마이그레이션 목록 | 픽스처 (4) · 골든 단언 (1) · 사본 스캔 (1) | **6/6** | 픽스처 4곳 → `applyMigrations(db)`. `grep -rlE "migrations/[0-9]{4}[^']*\.sql\?raw" src/` → `migrate.ts`·`migrate.test.ts` **2건**(AC21 목표 문장 원문). 골든 = `migrate.test.ts EXPECTED_MIGRATIONS`. 스캔 = `scripts/check-migrations-appendonly.mjs` → `no-copies ok: scanned 748 source files, 2 list owners` | 없음 |
| `git` 채널 검증 정책 | 채널 등록 (3) | **3/3** | `handlers/git.test.ts` — status/branches=fallback · checkout=reject, 그리고 문서 §2.6-b 행과 대조 | 없음 |

- **§10에 없는데 같은 불변식이 필요했던 지점 — 1건**: `app/chat-turn/turn-context.ts:69` `parseExtraDirs`. 세션행(`sessions.extra_dirs`)은 **IPC 스키마를 다시 타지 않는다** — 절대경로 검증이 없던 시절에 쓰인 행이 resume/continuity 로 되살아나면 그 값이 `TurnContext.extraDirs` → `claude.ts:343` → SDK 옵션 `additionalDirectories` 까지 흘러간다. workspace 가드는 이번에 걸러도 **SDK 자신의 스코프는 안 걸러져** D-006 이 막으려는 "두 스코프가 갈라짐" 이 정확히 일어난다. 같은 SSOT(`isAbsolutePath`)로 닫았다 → §10 `extraDirs` 행을 **(2) → (3)** 으로 정정 제안.
- **분모 검산**: §10 표 합계 = 2+2+2+2+(4+1+1)+3 = **17**. 신설 1 = **18**. 닫은 지점 **18/18**. (템플릿의 `N/14` 는 마지막 `git` 채널 행 3을 빠뜨린 값이다 — 정정 제안.)

## [구현자 기입] 이번 라운드 수정의 잠금

> 분모 = 이번 라운드가 고친 프로덕션 지점(신규 handoff 라 인용된 변이가 없다). 지점마다 결함을 심어 **어떤 테스트가 죽는지** 관측했다.

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| M1 `git-cli` 실행부 문자셋 검사 제거 | AC7 | `git-cli.test.ts` **6/18 실패** | ✅ 검출 |
| M2 같은 검사를 `resolveDirty` **뒤**(checkout 직전)로 이동 | AC7 배치 | `git-cli.test.ts` **6/18 실패** | ✅ 검출 — 순서까지 잠겼다 |
| M3 `applied` 를 결과에서 뺌 | AC9 | `git-cli.test.ts` **3/18 실패** | ✅ 검출 |
| M4 `discard` 가 `clean -fd` 로 미추적까지 지움 | AC5 | `git-cli.test.ts` **1/18 실패** | ✅ 검출 |
| M5 `ExtraDirSchema` 의 절대경로 refine 제거 | AC12 지점1 | `absolute-path.test.ts` **2/20 실패** | ✅ 검출 |
| M6 `resolveGuardRoots` 의 절대경로 filter 제거 | AC12 지점2 | `workspace-guard.extra-dirs.test.ts` **2/3 실패** | ✅ 검출 |
| M7 `parseExtraDirs` 를 옛 술어(`v.length > 0`)로 되돌림 | AC12 지점3(신설) | `turn-context.test.ts` **2/16 실패** | ✅ 검출 |
| M8 send 페이로드에서 `extraDirs` 누락 | AC10 | `chatStore.extraDirs.test.ts` **3/4 실패** | ✅ 검출 |
| M9 DB 가 빈 배열을 NULL 로 접지 않음 | AC13 | `queries.test.ts` **1/30 실패** | ✅ 검출 |
| M10 `gitStatus` 읽기 정책을 `reject` 로 | AC20 | `handlers/git.test.ts` **3/4 실패** | ✅ 검출 |
| M11 메뉴 항목 onClick 이 `onConfirm` 까지 부름 | AC6 | `BranchSwitchActions.test.ts` **1/6 실패** | ✅ 검출 |
| M12 `!status?.isRepo` 가드 제거 (저장소 아님인데 칩 렌더) | AC1 | `branchChipState.test.ts` **2/15 실패** | ✅ 검출 |
| M13 `snapshot.cwd === cwd` 비교 제거 (늦은 응답 수용) | 동시성 | `branchChipState.test.ts` **1/15 실패** | ✅ 검출 |
| M14 `showLandingCwdPanel` 기본값 `true` | AC16 | `CwdPanel.landing.test.ts` **1/5 실패** | ✅ 검출 |
| M15 세션 뷰(ChatTile)가 플래그를 켬 | AC16 | `CwdPanel.landing.test.ts` **1/5 실패** | ✅ 검출 |
| M16 Composer 의 `showLandingCwdPanel &&` 가드 제거 | AC16 | `CwdPanel.landing.test.ts` **1/5 실패** | ✅ 검출 |
| M17 `additionalDirectories` 를 훅에만 복사(`[...]`)해 전달 | AC11 | `claude.extra-dirs.test.ts` **2/3 실패** | ✅ 검출 |
| M18 `DEFAULT_PERMISSION_MODE` 를 `'plan'` 으로 | AC18 | **3파일 6케이스 동시 실패**(shared·renderer·main) | ✅ 검출 — "함께 빨개진다" 를 실측 |
| M19~M22 사본 스캔 4지점(.tsx·상대경로·동명파일·허용목록) | AC21 | 4건 전부 게이트 RED, 정상 트리는 GREEN | ✅ 검출 |
| M23 픽스처 4곳에서 `applyMigrations(db)` 삭제 | AC22 양성 | queries **26** · continuity **2** · builder **4** · fork **4** 실패 | ✅ 검출 |

- **심을 수 없던 지점**: AC9 의 renderer 마지막 홉(`error.applied` → 모달 JSX). 렌더 하네스가 없어 JSX→DOM 을 관측할 수 없다 — 결함을 심어도 죽일 테스트가 없다. AC9 를 ⚠️ 로 남긴 이유다.
- **적대 검사가 실제로 잡은 결함 2건**(테스트를 쓰는 도중 프로덕션 코드에서 발견):
  1. `toPosix` 가 `path.sep` 으로 잘라 **플랫폼 의존**이었다 — Linux 개발기와 windows-latest CI 가 같은 입력에 다른 판정을 냈다. 두 구분자를 항상 접도록 고쳤다.
  2. `isAbsolutePath` 의 UNC 루트가 뒤따르는 구분자를 먹지 않아 `\\server\share\x` 가 **전부 거부**됐다(첫 세그먼트가 늘 빈 것으로 보였다). 루트 길이에 구분자를 포함하고 회귀를 잠갔다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **있다.** 신규 i18n 키 3개(`branchAppliedStash`·`branchAppliedCommitWip`·`branchAppliedDiscard`)의 소비자는 `BranchChip` 오류 모달이고, `APPLIED_NOTICE_KEY` 가 해소 3종을 전수 매핑한다. ko/en 양쪽 실재 확인(각 1건) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | **"해소 성공 · checkout 실패"** 행 — 그 행이 달고 있던 ⚠️("변경이 어디로 갔는지 안 보인다")를 이번에 닫았다. 브랜치 이름 거부(AC7)는 새 행이 아니라 기존 "실패 → 사유 모달" 행에 들어간다 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | **아니다.** 이번에 만든 조기 반환(실행부 문자셋 거부)은 `reason:'error'` + 문구를 돌려주고 `checkoutOutcome` 이 `failed` 로 접어 모달을 띄운다 — 조용한 no-op 경로를 만들지 않았다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | **아니다.** `statusForCwd` 로 규칙을 떼어 M13(비교 제거)이 검출되는 것까지 확인했다 | — |
| **(추가)** 참조 경로가 조용히 사라지는가 | **가능하다.** `parseExtraDirs` 가 이제 상대경로 원소를 버린다 — 스키마 이전에 저장된 세션을 resume 하면 그 칩이 UI 없이 없어진다. 다만 랜딩에만 편집 표면이 있어(D-009) resume 화면에는 원래 이 행이 없고, 사용자가 보는 것은 "에이전트가 그 폴더를 못 읽음" 뿐이다 | 📝 파생 이슈 — 통지 여부는 제품 판단 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `sessions.extra_dirs` 를 읽는 `parseExtraDirs` 가 절대경로를 검사하지 않아, 스키마 이전 행이 resume 시 SDK `additionalDirectories` 까지 도달한다 | ✅ 선조치 + 📝 §10 `extraDirs` 행 (2)→(3) 정정 제안 | `turn-context.ts:69` · M7 로 검출 확인 |
| 2 | 새 게이트의 `toPosix` 가 `path.sep` 의존이라 Linux/Windows 판정이 갈린다 | ✅ 선조치 | 자기 적대 테스트가 red 로 잡음 |
| 3 | `isAbsolutePath` 가 UNC 경로를 전부 거부 | ✅ 선조치 | 자기 적대 테스트가 red 로 잡음 |
| 4 | **`/`(파일시스템 루트)는 절대 경로라 AC12 를 통과한다.** §10 `실패 의미` 칸이 "`/` 한 개면 `writeRoots` 가 루트를 덮어 0075 가드가 무력화된다" 를 적대 사례로 지목했는데, AC12 의 행동 단언("절대 경로만")은 그것을 막지 않는다 | ⚠️ 보고만 — 루트 거부는 사용자가 받는 결과를 바꾸는 **제품 판단**이라 단독 결정하지 않는다 | `isAbsolutePath('/')` → `true` · `resolveGuardRoots(ws, ['/'])` 는 `/` 를 writeRoot 로 올린다 |
| 5 | 렌더 테스트 하네스 부재(`@testing-library` 0건 · vitest node 환경 · include 가 `.ts` 만) | ⚠️ 보고만 — 신규 devDependency(`@testing-library/react`+`jsdom` 등)는 §6·`app/AGENTS.md` 상 사용자 승인 사항 | AC9 마지막 홉·AC16 이 ⚠️ 로 남은 직접 원인 |
| 6 | plan 템플릿의 `강제 지점 전수 \| N/14` 가 §10 표 실제 합계(17)와 어긋난다 — `git` 채널 행 3이 빠졌다 | 📝 정정 제안(본문은 실측 18/18 로 적음) | §10 표 6행 재합산 |
| 7 | §14 가 지적한 `git-cli.ts:7` 주석의 "주기적으로" ↔ 코드(주기 조회 없음) 불일치 | ✅ 선조치 — 주석 정정 | plan §14 "주석을 정정한다" 지시 |

### 설계 대비 명시적 차이

**차이 1 — §11 의 `.test.tsx` 렌더 테스트 2종을 도입하지 않았다.** 대신 (a) 순수 seam `branchChipState.ts` 를 떼어 컴포넌트가 부르는 그 함수를 단언하고, (b) 훅 없는 `BranchSwitchActions.tsx` 를 떼어 **반환된 엘리먼트 트리를 훑어 onClick 배선**을 단언했다. 이유는 신규 의존성 승인 사항(§6·`app/AGENTS.md`).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| **관측 범위** | 렌더 하네스는 JSX→DOM 까지 보지만 seam/트리-워크는 **거기서 멈춘다** — 컴포넌트가 seam 을 부르지 *않도록* 바꾸면(예: 라벨을 인라인 재계산) 트리-워크 밖의 회귀가 남는다 | AC1·AC6·AC8 은 M11·M12·M13 으로 검출을 실측했다. **AC9 마지막 홉과 AC16 은 이 축에서 못 닫아 ⚠️** 로 남겼다 |
| 만료 | 해당 없음 — 대체물은 상태를 캐시하지 않는다(순수 함수 + 1회 호출) | — |
| 공유 | 해당 없음 — 테스트마다 새 spy·새 트리를 만들고 전역 상태를 공유하지 않는다. `vi.mock` 은 파일 스코프 | `claude.extra-dirs.test.ts` 는 `capture()` 마다 `mockClear()` |
| 재진입 | **있다** — 훅 없는 컴포넌트를 직접 부르므로 `useState` 를 도로 넣으면 테스트가 "Invalid hook call" 로 죽는다(조용한 통과가 아니라 실패라 안전한 방향) | 실측: 훅을 쓰는 `ExtraDirChip` 을 같은 방식으로 부르면 `Cannot read properties of null (reading 'useContext')` |
| 다른 무효화 축 | 트리-워크는 `props` 를 가진 노드만 훑으므로 **문자열 자식·Fragment 로 감싼 구조 변경**에 눈이 멀 수 있다 | 그래서 확인 버튼을 `data-action="dirty-confirm"` 으로 앵커했다 — 클래스·순서 변경에 흔들리지 않는다 |

**차이 2 — `queries.test.ts` 의 마이그레이션 SQL 동작 테스트 2 describe 를 `migrate.test.ts` 로 옮겼다.** plan 은 "픽스처 4곳의 목록 사본 → `applyMigrations(db)`" 만 적었고 이설은 적지 않았다. 옮기지 않으면 AC21 의 목표 문장(`src/` 술어 결과 = 정본+골든 2건)이 성립할 수 없다(§설계 리뷰 이견 1). 행동 단언은 그대로 유지했다 — `0006` 이관·`0009` backfill 두 케이스가 같은 단언으로 새 파일에서 돈다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| **공유** | `migrate.test.ts` 가 이제 골든 목록 + 부분집합 픽스처를 **함께** 갖는다 — 이 파일 하나가 사본 스캔의 유일한 예외라, 여기에 현재 목록 사본을 새로 적으면 게이트가 못 잡는다 | 완화: 허용 목록을 **정확 경로 2건**으로 좁히고 M21(동명 파일 `src/main/features/x/migrate.ts`)로 `endsWith` 누수가 없음을 확인 |
| 만료 | 해당 없음 — 옮긴 목록은 과거에 고정된 부분집합이라 새 마이그레이션을 따라갈 필요가 없다 | `memDb(0001~0005)` · `memDb(0001~0008)` |
| 재진입 | 해당 없음 — `memDb()` 가 호출마다 새 `:memory:` DB 를 만든다 | queries 30건 · migrate 이설 후 전건 통과 |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] AC 자기보고

> 각 행에 **이번 턴에 재현한 관측**을 함께 적는다. 다시 찾지 못한 행은 ✅로 세지 않았다.

| # | 판정 | 재현 명령 / 관측 |
|---|---|---|
| AC1 | ✅ | `vitest run branchChipState.test.ts` — `isRepo:false`→`{visible:false}` · `branch:null`→`{visible:true,branch:null}`. M12 로 검출 확인 |
| AC2 | ✅ | `grep -c "  it(" git-parse.test.ts` → **9**. 전건 통과 |
| AC3 | ✅ | `git-cli.test.ts` "실제 checkout 이 일어나고…" — `gitStatus().branch`·`rev-parse --abbrev-ref HEAD` 둘 다 `feature` |
| AC4 | ✅ | 같은 파일 — 호출 전후 `git status --porcelain` **문자열 동일** + `{ok:false,reason:'dirty',from:'main'}` |
| AC5 | ✅ | 해소 3종 각각 미추적 파일 잔존(`?? untracked.txt`) + 추적 변경 소멸. M4 로 검출 확인 |
| AC6 | ✅ | `BranchSwitchActions.test.ts` — 메뉴 3항목 전부 클릭 후 `onConfirm` **0회**, 왼쪽 버튼에서 **1회**(`'discard'`). M11 로 검출 확인 |
| AC7 | ✅ | 실행부 직접 호출로 `-f`·`--`·`a..b`·`x.lock`·`--upload-pack=…`·`''` **6종 거부** + 트리·브랜치 불변. **2/2 지점** |
| AC8 | ✅ | `checkoutOutcome({reason:'error'})` → `{kind:'failed',message}`. `not-repo` 도 `failed` 로 접힌다 |
| AC9 | ⚠️ | main 절반 ✅ — `applied` 가 해소 3종 각각에 실려 오고 해소 없는 실패엔 키가 없다(M3 검출). **renderer 마지막 홉 미단언** — `error.applied` → 모달 JSX 는 렌더 하네스 부재로 결함을 심어도 죽일 테스트가 없다 |
| AC10 | ✅ | `chatStore.extraDirs.test.ts` — 추가/제거가 페이로드에 반영, 0개면 `not.toHaveProperty('extraDirs')`. M8 로 검출 확인 |
| AC11 | ✅ | `claude.extra-dirs.test.ts` — `expect(guardArg).toBe(option)` **참조 동일성**. M17(한쪽만 `[...]` 복사) 검출 |
| AC12 | ✅ | 스키마 `['refs']`·`['../x']` 거부 / `['/abs']` 통과 · 가드 루트가 상대 원소를 버림 · DB 읽기도 동일. **3/3 지점**(§10 표 2 + 신설 1) |
| AC13 | ✅ | `queries.test.ts` — `["/refs/a","/refs/b"]` 왕복 · 빈배열/null/미지정 전부 `NULL` · `listSessions` 도 같은 값 |
| AC14 | ✅ | `sed -n "/describe('extraDirs 해석'/,/^})/p" \| grep -c '  it('` → **8**(기존 6 + 신설 2). 전건 통과 |
| AC15 | ✅ | `chatReducer.extraDirs.test.ts` — `SET_CWD` 후 `[]` · 중복 추가 시 길이 1 **이자 동일 참조** · cwd 자기 자신 무시 |
| AC16 | ⚠️ | **호출부 스윕으로 대체**(렌더 부재 단언 아님) — 기본값 `false` · `<CwdPanel` 렌더 1곳이 플래그 뒤 · 랜딩 2페이지만 켬 · ChatTile 미전달. M14·M15·M16 셋 다 검출 |
| AC17 | ✅ | `grep -c "  it(" modes.test.ts` → **4** · `ko.ts:600 xhigh: { label: '엑스트라' … }` · `modes.ts:49 hidden: true`(dont_ask) |
| AC18 | ✅ | `DEFAULT_PERMISSION_MODE` 를 `'plan'` 으로 바꾸자 **3파일 6케이스 동시 red**(M18), 원복 시 23건 전건 통과. **2/2 지점이 한 상수를 읽는다** |
| AC19 | ✅ | `check-doc-inventory.mjs --check` → `generated doc ok (9 items, 79 channels)` + prose ok + links ok |
| AC20 | ✅ | `handlers/git.test.ts` 4케이스 — 등록부 정책(fallback·fallback·reject) ↔ 문서 §2.6-b 행 대조 + 폴백 값 형상. M10 검출 |
| AC21 | ✅ | `grep -rlE "migrations/[0-9]{4}[^']*\.sql\?raw" src/` → **`migrate.ts`·`migrate.test.ts` 2건**(목표 문장 원문). 게이트: `no-copies ok: scanned 748 source files, 2 list owners` |
| AC22 | ✅ | **양방향 실측** — 음성: 사본을 4가지 형태(.tsx·상대경로·동명파일·깊은 경로)로 되살리면 전부 게이트 RED. 양성: `applyMigrations(db)` 제거 시 queries **26** · continuity **2** · builder **4** · fork **4** 실패 |
| AC23 | ✅ | `npx eslint --no-fix ./src ./scripts` → **prettier 0건**(작업 전 15건: 브랜치 기인 7 + 이번 신규 7 + 기타 1). 남은 1 warning 은 `useTranscriptVirtualizer.ts` 의 `react-hooks/incompatible-library`(선재·prettier 아님·이 브랜치 무관) |
| AC24 | ⚠️ | **이 환경에서 못 돈다** — windows-latest 러너 필요. 브랜치는 `5e6fdcb`(CI 수정)를 이미 포함하고(`git merge-base --is-ancestor 5e6fdcb HEAD` → 참) 로컬 등가 게이트 5종이 전건 green 이다. 최종 판정은 CI/사람 몫(`app/AGENTS.md §제약 환경`) |

**합계 검산**: `✅ 21 · ⚠️ 3 · ❌ 0 = 총 24`. (AC 총수는 §7 표를 다시 세었다 — 24행, 이번 라운드에 분할·추가 없음.)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **app 35** = 신규 13(프로덕션 3 — `shared/absolute-path.ts`·`composer/branchChipState.ts`·`composer/BranchSwitchActions.tsx` + 테스트 10) + 수정 22. 여기에 handoff 산출물 2(`plan.md`·`INDEX.md`) = 총 **37** |
| 실행 명령 | `npm ci` · `npm run typecheck` · `npx eslint --no-fix ./src ./scripts` · `npm run lint`(--fix, AC23) · `npm test` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` |
| 관측한 게이트 산출 | **typecheck 3구성 전건 통과**(node·web·test, exit 0) · **lint `--no-fix` 0 error / 1 warning**(선재 `react-hooks/incompatible-library`, prettier **0**) · **vitest 226파일 / 2233케이스 전건 통과**(기준선 216/2138 → +10파일 +95케이스) · **scripts `node --test` 55/55**(기준선 49 → +6) · migrations 게이트 3검사 ok(`748 source files, 2 list owners`) · doc-inventory `9 items, 79 channels` ok |
| 강제 지점 전수 | **18/18** (§10 표 17 + 표 밖 신설 1) |
| AC 자기보고 | **21/24 ✅** (⚠️ 3 · ❌ 0) |
| 합계 검산 | `✅ 21 · ⚠️ 3 · ❌ 0 = 총 24` |
| 블로커 / 역질문 | **3건 — 전부 사용자 판단 사항.** ① 렌더 테스트 하네스(`@testing-library/react`+`jsdom`) 도입 여부 — AC9 마지막 홉·AC16 이 ⚠️ 로 남은 직접 원인이고 신규 devDependency라 단독 결정하지 않았다. ② `extraDirs` 에 `/`(파일시스템 루트)를 허용할 것인가 — §10 `실패 의미` 가 지목한 적대 사례인데 AC12 의 행동 단언은 막지 않는다. ③ resume 시 상대경로 참조 경로가 조용히 버려지는 것을 사용자에게 알릴 것인가 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**: 이전 라운드가 없다(r1, 소급 설계). 다만 **한 축이 이번 턴 안에서 두 번 열렸다** — "extraDirs 원소는 절대 경로만" 이 §10 표의 2지점을 닫은 뒤 전수 검색에서 **세 번째 지점**(`parseExtraDirs`, DB 행 읽기)을 드러냈다. 설계가 *입구* 2곳만 셌고 *DB 를 다시 읽는 자리* 를 세지 않았다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가**: §12 producer→consumer 도식이 `sessions.extra_dirs → resume/fork/handoff 재해석(D-007)` 을 명시적으로 그렸고 §10 의 SSOT 칸도 있었지만, **강제 지점 표는 그 되읽기 화살표를 지점으로 세지 않았다.** 도식에 있는 화살표가 §10 지점 수에 반영됐는지 교차하는 절차가 없다.
- **AC 술어가 자기 주의사항과 모순인 채로 READY 가 됐다**: AC21 의 `검증 수단`(파일 단위 `-l` 결과 = 2건)과 §7 주의사항(`queries.test.ts` 부분집합은 술어에서 제외)은 동시에 참일 수 없다. READY self-review 의 "각 AC가 행동 단언·검증 수단·도달 경로를 가진다" 는 셋의 **존재** 만 보고 술어와 예외의 **양립** 은 보지 않는다.
- **plan 템플릿의 분모가 §10 과 어긋난 채 배포됐다**: `강제 지점 전수 | N/14` ↔ §10 표 실제 합계 17. 템플릿 분모를 §10 에서 자동 유도하지 않으면 구현자가 남의 분모에 맞추게 된다.
- **적대 검사가 프로덕션 결함을 2건 잡았다**(테스트 작성 도중): `toPosix` 플랫폼 의존 · `isAbsolutePath` UNC 전면 거부. 둘 다 "장치에 눈이 있는가" 를 확인하려고 쓴 케이스에서 나왔지 기능 테스트에서 나오지 않았다.
- **반복해서 부딪히는 환경 한계**: (1) 렌더 하네스 부재 — 이 저장소의 renderer 테스트는 전부 순수 `.ts` 이고 컴포넌트 계약은 구조적으로 검증 불가. (2) windows-latest CI 를 로컬에서 재현할 수 없음(AC24). (3) `npm run lint` 는 2분 넘게 걸려 짧은 타임아웃에 잘린다.
- **현재 라운드 수**: **1**


---

# [구현자 기입] — r2

## [구현자 기입] 설계 리뷰 (r2)

- **동의 / 그대로 진행**: D-019·D-020 과 §10 의 4지점·2층 설계를 그대로 수행했다. 텍스트 층(칩 추가·스키마·세션행)과 정규화 층(`resolveGuardRoots`)의 역할 분담이 실제로 필요했다 — `/.`·`/a/..` 는 텍스트 층을 통과하고 정규화 층에서만 잡힌다(아래 전수표 관측).
- **이견 / 현실성 문제**: 없음. 다만 AC25 가 지정한 "사유를 리듀서 상태로" 는 렌더 하네스 없이 잠기는 유일한 배치였다 — 사유를 컴포넌트 지역 상태로 뒀다면 r1 의 AC9 와 같은 자리에서 또 막혔다.
- **ACTIVE Decision과 충돌하는 설계 발견**: 없음. D-019 의 "범위 정책이 아니라 축퇴 값 배제" 는 구현에서도 유지된다 — `/etc`·`/a/b/c` 는 계속 통과한다(스키마 테스트 2케이스).

## [구현자 기입] 강제 지점 전수 (§10 대조) — r2

> 검색 술어는 불변식의 주어(`경로를 받아 가드 루트·SDK 스코프가 되는 자리`)로 잡았다. 해법 이름(`isFilesystemRoot`)으로 세면 이미 고친 곳만 분모에 오른다.

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| `extraDirs` 절대 경로 · **비루트** | 칩 추가 · `chat:send` · 가드 루트 해석 · 세션행 읽기 (**4**) | **4/4** | `chatReducer.ts:638`(칩) · `protocol.ts:73`(스키마) · `workspace-guard.ts:68`(정규화 후) · `turn-context.ts:70`(세션행). 각 지점에 결함을 심어 R1~R5 전건 검출 | 없음 |
| 브랜치 이름 문자셋 | invoke · execFile 직전 (2) | **2/2** (r1 유지) | 변경 없음 — `git-cli.test.ts` 18케이스 전건 통과 | 없음 |
| `additionalDirectories` 동일 배열 | 옵션 · 훅 (2) | **2/2** (r1 유지) | `claude.extra-dirs.test.ts` 3케이스 `toBe` 참조 동일성 | 없음 |
| 기본 권한 모드 | 리듀서 · 컨트롤러 (2) | **2/2** (r1 유지) | 변경 없음 | 없음 |
| 마이그레이션 목록 | 픽스처 4 · 골든 1 · 사본 스캔 1 | **6/6** (r1 유지 + **스캔 자체를 잠금**) | `no-copies ok: scanned 750 source files, 2 list owners` · `collectSourceFiles` 4케이스 신설 | 없음 |
| `git` 채널 검증 정책 | 등록 (3) | **3/3** (r1 유지) | `handlers/git.test.ts` 4케이스 | 없음 |

- **§10에 없는데 같은 불변식이 필요했던 지점 — 1건 발견, 이번에 닫지 않았다**: **`cwd` 축**. §6 `보고만` 으로 올린다(아래).
- **분모 검산**: §10 표 합계 = 2+**4**+2+2+(4+1+1)+3 = **19**. 닫은 지점 **19/19**.

## [구현자 기입] 이번 라운드 수정의 잠금 — r2

> 분모 = 이번 라운드가 닫는 파생 이슈가 **인용한 변이**(D1·D2). D-019·D-020 은 신규 구현이라 고친 지점마다 심었다.

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| **D1 인용 변이** — `SOURCE_EXTENSIONS` 에서 `.tsx` 제거 (이슈가 `14/14 green` 이라 적은 그것) | D1 | scripts **3/18 실패**(이전 0) | ✅ 닫힘 |
| D1 형제축 — 디렉토리 재귀 제거 | D1 | scripts **2/18 실패** | ✅ |
| D1 형제축 — 경로 `/` 정규화 제거 | D1 | scripts **1/18 실패** | ✅ |
| **D2 인용 변이 (a)** — 안내 문단을 조립에서 제거 | D2 | 렌더러 chat **4/365 실패**(이전 0) | ✅ |
| **D2 인용 변이 (b)** — 그리는 분기 무력화 | D2 | 1차 시도에서 **0 실패** → `CheckoutErrorBody` 추출 후 **2/369 실패** | ✅ 닫힘(아래 §놓친 문제 2) |
| R1 리듀서 루트 거부 제거 | AC25 | `chatReducer.extraDirs` **4/14 실패** | ✅ |
| R2 거부는 하되 사유를 안 남김 | AC25(D-020) | `chatReducer.extraDirs` **4/14 실패** | ✅ |
| R3 스키마 루트 refine 제거 | AC12 | `absolute-path` **4/37 실패** | ✅ |
| R4 정규화 후 루트 필터 제거 | AC12 | `workspace-guard.extra-dirs` **2/6 실패** | ✅ |
| R5 세션행 루트 필터 제거 | §10 지점4 | `turn-context` **1/17 실패** | ✅ |
| R6 `isFilesystemRoot` 가 항상 false | SSOT | `absolute-path` **9/37 실패** | ✅ |

- **심을 수 없던 지점**: 없음. r1 의 잔여(AC9 마지막 홉)는 이번에 닫았다.

## [구현자 기입] Product/UX 파생 검토 — r2

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **있다.** `extraDirRejectRoot` 1키(ko/en 각 1건) → `CwdPanel.tsx:61` 이 `extraDirRejection === 'root'` 에서 렌더 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | **"＋에서 루트 폴더를 고름"** 행 — D3 정정 턴에 신설된 그 행이다 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | **아니다.** 리듀서가 사유를 남기고 행이 그것을 렌더한다. R2(사유 없이 거부만) 변이가 4케이스를 죽이므로 조용한 무시로 되돌아가면 게이트가 잡는다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 이번 라운드가 만든 비동기 경로 0 | — |
| **거부 사유가 언제 사라지는가** | 다음 성공 추가·제거·작업 경로 변경에서 리듀서가 지운다(4케이스 단언). 사유가 화면에 눌러붙어 옛 실패를 계속 말하지 않는다 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **`cwd` 축이 같은 불변식을 위반한다.** `CwdButton.tsx:38` 이 `CwdPanel.tsx:29` 와 **같은 `fileApi.pickDirectory()`** 를 쓰고, `SendChatMessageSchema.cwd` 는 `z.string().min(1)` 뿐이며, `resolveTurnCwd` 에도 검증이 없다. 실측 — `resolveGuardRoots('/', []).writeRoots[0] === '/'`. 즉 사용자가 **작업 경로**를 루트로 고르면 `extraDirs` 를 쓰지 않고도 0075 가드가 같은 방식으로 무력화되고, 이쪽이 **첫 번째** write 루트라 더 직접적이다 | ⚠️ **보고만** — cwd 는 참조 경로와 다른 제품 컨트롤이고 루트 금지는 사용자가 받는 결과를 바꾼다. D-019 의 문면은 `extraDirs` 로 한정돼 있어 구현자가 확장할 수 없다 | `CwdButton.tsx:38` · `protocol.ts:87` · `turn-context.ts:51` · 위 실측 |
| 2 | **조립만 떼는 것으로는 D2 가 닫히지 않았다.** `checkoutErrorLines` 추출 후 인용 변이 (a)는 4케이스를 죽였지만 (b)(그리는 분기 무력화)는 **369케이스 전건 통과**했다 — 조립을 잠가도 *그리는 쪽*은 여전히 지울 수 있다 | ✅ 선조치 — 훅 없는 `CheckoutErrorBody` 로 그리는 쪽까지 순수부로 내리고 엘리먼트 트리를 단언했다. 재측정 (b) **2/369 실패** | 검증자의 대응 방향은 seam 하나였고, 실측이 그것으로 부족함을 보였다 |
| 3 | 리듀서에 상태 필드를 더하면 `initialChatState` 와 세션 엔트리 시드가 함께 늘어난다 — r1 의 `chatStore.testHarness` 가 `initialChatState` 를 스프레드하므로 자동 승계된다 | ✅ 선조치 불필요 — 하네스가 `...initialChatState` 라 새 필드가 따라온다. 전체 스위트 2271케이스 통과로 확인 | `chatStore.testHarness.ts:31` |

### 설계 대비 명시적 차이 — r2

- plan §11 은 D2 대응으로 `checkoutErrorView(error, tr)` **하나**를 적었다. 실제로는 **둘로 갈랐다** — 조립 `checkoutErrorLines`(순수 `.ts`) + 그리기 `CheckoutErrorBody`(훅 없는 `.tsx`). 이유는 위 §놓친 문제 2 의 실측이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| **관측 범위** | 두 조각으로 갈라 각각 잠갔으므로 r1 보다 넓다. 남는 미검증은 **React 가 그 트리를 실제 DOM 에 마운트하는 것** 뿐 — 프레임워크 동작이지 이 코드의 로직이 아니다 | AC9 — (a) 4/365 · (b) 2/369 양쪽 검출 |
| 만료 | 해당 없음 — 순수 함수, 상태 캐시 없음 | — |
| 공유 | 해당 없음 — `CheckoutErrorBody` 는 `BranchChip` 만 쓴다(`grep -rn CheckoutErrorBody src/ --include=*.tsx` → 정의 1 · 소비 1) | — |
| 재진입 | **있다** — 훅을 도로 넣으면 직접 호출 테스트가 "Invalid hook call" 로 죽는다(조용한 통과가 아니라 실패라 안전한 방향) | r1 `BranchSwitchActions` 와 같은 성질 |
| 다른 무효화 축 | 트리 워크는 `props` 를 가진 노드만 훑으므로 Fragment·문자열 자식 구조 변경에 눈이 멀 수 있다 | 그래서 `data-surface="checkout-error-notice"`·`-detail` 로 앵커했다 |

## [구현자 기입] AC 자기보고 — r2

| # | 판정 | 재현 명령 / 관측 |
|---|---|---|
| AC9 | ✅ | **r1 ⚠️ → 닫힘.** 조립 (a) 4/365 · 그리기 (b) 2/369 양쪽 변이 검출. `CheckoutErrorBody.test.ts` 4케이스가 안내→원문 **순서**까지 단언 |
| AC12 | ✅ | **루트 축 신설분 닫힘.** 스키마가 `/`·`C:\`·`\\srv\share` 거부(3케이스) · 혼합 배열 거부 · `/etc`·`/a/b/c` 통과. 가드가 정규화 후 `/.`·`/a/..`·`/x/y/../..` 를 버림. **4/4 지점** |
| AC25 | ✅ | **신설.** `ADD_EXTRA_DIR('/')` → `extraDirs` 길이 0 **이자** `extraDirRejection === 'root'`(3루트 형태). 중복·cwd 자기 자신은 사유 없음. 사유가 다음 조작 3종에서 지워짐. ko/en leaf 각 1건 |
| AC16 | ⚠️ | **r1 그대로 — r2 범위 밖.** 렌더 하네스(신규 의존성) 미승인 상태가 변하지 않았다 |
| AC24 | ⚠️ | **이번 라운드 CI 미실행.** r1 head 는 green 이었고 로컬 등가 게이트는 전건 green 이나, r2 코드가 바뀌었으므로 windows 러너 재실행이 필요하다 |
| AC1~AC8 · AC10·AC11·AC13~AC15 · AC17~AC23 | ✅ | r1 판정 유지 — 전체 스위트 **227파일 2271케이스 전건 통과**로 회귀 없음 확인 |

**합계 검산**: `✅ 23 · ⚠️ 2 · ❌ 0 = 총 25`. (§7 표를 다시 세어 **25행** — D3 정정 턴의 AC25 신설로 분모가 24→25. r1 의 `/24` 와 직접 비교하지 않는다.)

## [구현자 기입] 구현 보고 — r2

| 항목 | 내용 |
|---|---|
| 변경 파일 | **app 18** = 신규 2(`CheckoutErrorBody.tsx` + 테스트) + 수정 16. 문서 1(`docs/IPC_CONTRACT.md`, D4) = 총 **19** |
| 실행 명령 | `npm run typecheck` · `npm run lint`(--fix) · `npx eslint --no-fix ./src ./scripts` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` |
| 관측한 게이트 산출 | **typecheck 3구성 전건 통과**(error 0) · **lint `--no-fix` 0 error / 1 warning**(선재 `react-hooks/incompatible-library`, prettier 0) · **vitest 227파일 / 2271케이스 전건 통과**(r1 226/2233 → +1파일 +38케이스) · **scripts 59/59**(r1 55 → +4) · migrations `no-copies ok: scanned 750 source files, 2 list owners` · doc-inventory `9 items, 79 channels` |
| 강제 지점 전수 | **19/19** (§10 표 합계 19 — extraDirs 행이 2→4 로 정정된 반영) |
| AC 자기보고 | **23/25 ✅** (⚠️ 2 · ❌ 0) |
| 합계 검산 | `✅ 23 · ⚠️ 2 · ❌ 0 = 총 25` |
| 블로커 / 역질문 | **2건.** ① **`cwd` 축** — 작업 경로를 루트로 고르면 같은 불변식이 첫 번째 write 루트에서 깨진다(§놓친 문제 1). D-019 를 cwd 로 확장할지는 제품 판단이다. ② **렌더 하네스** — AC16 이 여전히 ⚠️ 인 유일한 이유 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**: **예.** "가드 루트가 되는 경로는 루트가 아니다" 는 r1 의 "절대 경로만" 과 같은 축의 다음 지점이다. 그리고 그 축은 **아직 안 끝났다** — `cwd` 가 같은 불변식의 남은 지점이고, r1→r2 가 `extraDirs` 한 축만 따라간 것은 D3 이 그 축만 지목했기 때문이다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가**: §10 `extraDirs` 행의 `실패 의미` 가 `/` 를 지목했지만 **`extraDirs` 행 안에서만** 지목했다. 같은 실패가 `cwd` 로도 일어난다는 것은 어느 행도 적지 않았다 — §10 이 *계약별*로 나뉘어 있어 "여러 계약을 가로지르는 하나의 불변식" 을 담을 자리가 없다.
- **D2 는 검증자의 대응 방향 하나로 닫히지 않았다**: seam 추출 후에도 인용 변이 (b)가 369케이스를 통과했다. 파생 이슈의 `대응 방향` 을 그대로 수행하는 것과 그 AC 가 성립하는 것은 다르다는 사례가 이번 라운드에 실측으로 하나 더 생겼다.
- **반복해서 부딪히는 환경 한계**: (1) 렌더 하네스 부재 — AC16 이 3라운드째 같은 이유로 ⚠️. (2) `npm run lint` 가 2분을 넘겨 짧은 타임아웃에 잘린다(r1 과 동일).
- **현재 라운드 수**: **2**


---

# [구현자 기입] — r3 (D-019 cwd 축 확장)

## [구현자 기입] 설계 리뷰 (r3)

- **동의 / 그대로 진행**: D-021 의 "지점마다 끝이 다르다" 가 이번 구현의 핵심이었다. `extraDirs` 는 `.filter` 로 버리면 그만이지만 cwd 는 버리면 턴이 설 자리가 없다 — 폴백(세션행)·throw(가드)로 갈랐다.
- **이견 / 현실성 문제**: 없음. 다만 §11 이 `CwdButton.tsx`(사유 표시)를 변경 파일로 적었는데 **불필요했다** — 아래 §놓친 문제 1.
- **ACTIVE Decision과 충돌하는 설계 발견**: 없음. D-019 확장 후에도 "범위 정책이 아니라 축퇴 값 배제" 가 유지된다 — `/etc`·`/repo/app` 은 두 축 모두 통과한다(각 축 1케이스).

## [구현자 기입] 강제 지점 전수 (§10 대조) — r3

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| **`cwd` 비루트** | 작업 경로 선택 · `chat:send` · 세션행 해석 · 가드 ws (**4**) | **4/4** | `chatReducer.ts:632`(SET_CWD) · `protocol.ts:91`(스키마) · `turn-context.ts:56`(`usableCwd` 폴백) · `workspace-guard.ts:62`(throw). C1~C6 전건 검출 | 없음 |
| `extraDirs` 절대 경로 · 비루트 | 칩 추가 · `chat:send` · 가드 루트 · 세션행 (**4**) | **4/4** (r2 유지) | 변경 없음 — R1~R6 회귀 없음 | 없음 |
| 브랜치 이름 문자셋 | (2) | **2/2** (r1 유지) | 변경 없음 | 없음 |
| `additionalDirectories` 동일 배열 | (2) | **2/2** (r1 유지) | 변경 없음 | 없음 |
| 기본 권한 모드 | (2) | **2/2** (r1 유지) | 변경 없음 | 없음 |
| 마이그레이션 목록 | 픽스처 4 · 골든 1 · 스캔 1 | **6/6** (r2 유지) | 변경 없음 | 없음 |
| `git` 채널 검증 정책 | (3) | **3/3** (r1 유지) | 변경 없음 | 없음 |

- **§10에 없는데 같은 불변식이 필요했던 지점**: **0건.** 불변식("가드 루트가 되는 경로는 루트가 아니다")의 주어로 전수 검색 — `resolveGuardRoots` 인자가 되는 값은 `ws`(=cwd)와 `additionalDirs`(=extraDirs) 둘뿐이고(`grep -rn "resolveGuardRoots(\|makeWorkspaceGuardHook(" src/`), 둘 다 이번에 닫혔다. **이 축은 이제 끝났다.**
- **분모 검산**: §10 표 합계 = 2+4+**4**+2+2+(4+1+1)+3 = **23**. 닫은 지점 **23/23**.

## [구현자 기입] 이번 라운드 수정의 잠금 — r3

> r3 은 파생 이슈가 아니라 규범 확장이라 인용 변이가 없다 — 분모는 고친 지점이다. 지점마다 하나씩 심었다.

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| C1 `SET_CWD` 루트 거부 제거 | AC25(cwd 축) | `chatReducer.extraDirs` **5/20 실패** | ✅ |
| C2 거부는 하되 사유를 안 남김 | D-020 | `chatReducer.extraDirs` **4/20 실패** | ✅ |
| C3 스키마 `cwd` refine 제거 | AC26 | `absolute-path` **3/42 실패** | ✅ |
| C4 `usableCwd` 폴백 제거(루트를 그대로 씀) | AC26·D-021 | `turn-context` **4/23 실패** | ✅ |
| C5 가드 ws throw 제거 | AC26·D-021 | `workspace-guard.extra-dirs` **5/12 실패** | ✅ |
| C6 텍스트 층만 제거(플랫폼 의존으로 되돌림) | 2층 설계 | `workspace-guard.extra-dirs` **2/12 실패** | ✅ |

- **심을 수 없던 지점**: 없음.
- **테스트가 작성 도중 잡은 결함 1건**: 가드의 throw 를 `path.resolve` **후**에만 두었더니 `resolveGuardRoots('C:\\')` 가 Linux 에서 통과했다 — `path.resolve('C:\\')` 는 POSIX 에서 `<cwd>/C:\` 라 루트가 아니다. 같은 입력이 windows CI 에서만 걸리는 플랫폼 의존이라, `extraDirs` 와 같은 2층(원문 + 정규화)으로 고쳤다. C6 이 그 회귀를 잠근다.

## [구현자 기입] Product/UX 파생 검토 — r3

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **있다 — 신규 문구 0건이다.** 두 축이 `extraDirRejection` 한 상태를 공유하므로 r2 의 `extraDirRejectRoot` 1키를 그대로 쓴다(리듀서 테스트가 두 축의 사유가 같은 값임을 단언). 규칙이 하나라 문장도 하나다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | **2행 모두 이번 설계 턴에 신설됐다** — "작업 경로 버튼에서 루트를 고름" · "resume 인데 세션행 cwd 가 루트" | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | **아니다.** 선택 거부는 `CwdPanel` 의 사유 문장이 덮는다. 세션행 폴백은 **의도적으로 조용하다** — 턴은 정상 진행되고 작업 경로만 기본값으로 보인다(D-021). 이 조용함은 파생 이슈로 올린다(아래 §놓친 문제 2) | 📝 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 이번 라운드가 만든 비동기 경로 0 | — |
| **거부된 SET_CWD 가 참조 경로를 비우지 않는가** | **비우지 않는다.** cwd 가 안 바뀌었으므로 그 밑의 참조 경로도 그대로여야 한다 — 전용 케이스로 단언했다 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r3

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | §11 이 `CwdButton.tsx`(사유 표시)를 변경 대상으로 적었으나 **불필요했다.** `CwdButton` 은 `sessionStarted` 면 폴더를 *열기만* 하고(`CwdButton.tsx:34`) 고르는 경로는 `CwdPanel` 안의 한 곳뿐이다 — 그 행이 이미 사유를 렌더한다. 중복 UI 를 넣을 뻔했다 | ✅ 선조치(넣지 않음) + 📝 §11 행 정정 제안 | `grep -rn "<CwdButton" src/renderer` → 2곳, 그중 `ChatTitleBar` 는 `sessionStarted` |
| 2 | **세션행 폴백이 조용하다.** 스키마 이전에 루트로 저장된 세션을 resume 하면 작업 경로가 말없이 프로젝트 기본으로 바뀐다 — 사용자는 자기가 고른 폴더가 아닌 곳에서 에이전트가 도는 것을 보게 된다 | ⚠️ **보고만** — 통지 여부는 제품 판단이다. D-021 은 "폴백" 만 정했고 "알린다" 는 정하지 않았다. r1 의 같은 종류(참조 경로 상대경로 폐기 통지)와 묶어 결정하면 좋다 | `turn-context.ts:56` `usableCwd` |
| 3 | `SET_CWD` 는 dispatch 지점이 둘이다 — 사용자 선택(`setPendingCwd`)과 **부팅 시드**(`chatStore.ts:1248`, `sessionApi.cwd()` 의 앱 기본값). 리듀서에 가드를 두었으므로 둘 다 덮이지만, 부팅 시드가 루트면 사용자가 하지 않은 거부 사유가 뜬다 | ✅ 선조치 불필요 — 앱 기본 cwd 는 `userData/projects` 하위라 루트가 될 수 없다. **거부 방향이 안전한 쪽**이므로 균일한 가드를 유지했다 | `chatStore.ts:1248` · `infra/config/paths.ts` |

### 설계 대비 명시적 차이 — r3

- **없다.** §10 4지점·D-021 의 세 갈래 처리를 그대로 구현했다. 유일한 편차는 §11 의 `CwdButton.tsx` 를 만지지 않은 것인데, 그것은 설계가 지정한 *메커니즘* 이 아니라 *파일 목록* 의 과대 추정이다(§놓친 문제 1).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 순수 판정, 캐시 없음 | — |
| 공유 | **있다** — 두 축이 `extraDirRejection` **한 상태**를 공유한다. 참조 경로 거부 직후 작업 경로를 정상 선택하면 사유가 지워진다(`SET_CWD` 성공 경로가 `null` 로 덮음). 의도한 동작이며 "사유가 눌러붙지 않는다" 와 같은 방향 | AC25 — 사유 소거 4케이스가 두 축 모두를 덮는다 |
| 재진입 | 해당 없음 — 순수 리듀서 | — |
| 다른 무효화 축 | 가드의 throw 는 **되돌릴 수 없는 실패**다(폴백 없음). 앞 세 지점이 막으므로 도달 불가라는 전제에 기대며, 그 전제가 깨지면 턴이 죽는다 — 조용한 가드 무력화보다 낫다는 판단(D-021) | AC26 — C5 가 throw 제거를 5케이스로 검출 |

## [구현자 기입] AC 자기보고 — r3

| # | 판정 | 재현 명령 / 관측 |
|---|---|---|
| AC25 | ✅ | **확장 닫힘.** `SET_CWD('/'·'C:\\'·'\\\\srv\\share')` → `cwd` 불변 + `extraDirRejection==='root'`(3케이스). 두 축의 사유가 **같은 값**임을 단언. 거부된 SET_CWD 가 `extraDirs` 를 비우지 않음 |
| AC26 | ✅ | **신설 닫힘.** 스키마 `cwd:'/'` 거부(3형태) · `resolveTurnCwd` 가 세션행/요청 루트에서 `getCwd(projectId)` 폴백(4케이스) · `resolveGuardRoots('/'·'/.'·'/a/..')` throw. **`writeRoots[0]` 이 `/` 인 상태를 만들 수 없다** |
| AC12 | ✅ | r2 유지 — 회귀 없음 |
| AC9 | ✅ | r2 유지 |
| AC16 | ⚠️ | **r1 이래 그대로 — r3 범위 밖.** 렌더 하네스 미승인 |
| AC24 | ⚠️ | r3 CI 미실행. 로컬 등가 게이트 전건 green |
| AC1~AC8 · AC10·AC11·AC13~AC15 · AC17~AC23 | ✅ | 전체 스위트 전건 통과로 회귀 없음 확인 |

**합계 검산**: `✅ 24 · ⚠️ 2 · ❌ 0 = 총 26`. (§7 표 재측정 **26행** — AC26 신설로 25→26.)

## [구현자 기입] 구현 보고 — r3

| 항목 | 내용 |
|---|---|
| 변경 파일 | **app 8** = 수정 8(신규 0 — 두 축이 같은 SSOT·같은 상태·같은 문구를 쓴다). 문서 2(`plan.md`·`INDEX.md`)는 설계 커밋에 이미 있다 |
| 실행 명령 | `npm run typecheck` · `npm run lint`(--fix) · `npx eslint --no-fix ./src ./scripts` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · 게이트 2종 |
| 관측한 게이트 산출 | **typecheck 3구성 전건 통과**(`error TS` 0줄) · **lint `--no-fix` 0 error / 1 warning** 전체 · **변경 8파일 한정 0 problem**(prettier 0) · **vitest 227파일 / 2294케이스 전건 통과**(r2 227/2271 → +23케이스, 파일 수 동일 — 신규 테스트 파일 0) · **scripts 59/59** · migrations `no-copies ok: scanned 750 source files, 2 list owners` · doc-inventory links/prose ok. **게이트가 트리를 바꾸지 않았다**(`--fix` 후 변경분은 전부 자기 편집분) |
| 강제 지점 전수 | **23/23** (§10 표 합계 23 — `cwd` 행 4지점 신설 반영) |
| AC 자기보고 | **24/26 ✅** (⚠️ 2 · ❌ 0) |
| 합계 검산 | `✅ 24 · ⚠️ 2 · ❌ 0 = 총 26` |
| 블로커 / 역질문 | **2건.** ① **세션행 폴백의 조용함** — 루트로 저장된 세션 resume 시 작업 경로가 말없이 바뀐다(§놓친 문제 2). r1 의 참조 경로 폐기 통지와 같은 종류다. ② **렌더 하네스** — AC16 이 3라운드째 ⚠️ 인 유일한 이유 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r3)

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**: **예 — 그리고 이번에 그 축이 끝났다.** r1(절대 경로) → r2(`extraDirs` 루트) → r3(`cwd` 루트)는 전부 "가드 루트가 되는 경로" 하나의 축이다. 불변식의 주어로 전수 검색한 결과 `resolveGuardRoots` 의 인자는 둘뿐이고 둘 다 닫혔다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가**: r1·r2 의 §10 은 *계약별*로 행이 나뉘어 있어 `extraDirs` 행의 `실패 의미` 가 `/` 를 지목해도 그 지목이 `cwd` 행으로 번지지 않았다. **`cwd` 행 자체가 없었다** — 강제 지점 표가 "계약 → 지점" 구조라 "하나의 불변식 → 여러 계약" 을 담을 자리가 없다. r2 구현자가 §5 의 형제 축 전수 검색을 하지 않았다면 r3 은 열리지 않았을 것이다.
- **설계가 지정한 파일 목록이 실제보다 넓었다**: §11 의 `CwdButton.tsx` 는 만질 필요가 없었다. 파일 목록은 설계자의 추정이고 호출부 실측이 그것을 줄일 수 있다.
- **반복해서 부딪히는 환경 한계**: (1) 렌더 하네스 부재 — AC16 이 3라운드째 같은 이유. (2) `npm run lint` 2분 초과. (3) **플랫폼 의존 판정** — `path.resolve` 기반 검사가 Linux 개발기와 windows CI 에서 갈리는 문제가 r1(`toPosix`)·r3(`ws` throw) 두 번 나왔다.
- **현재 라운드 수**: **3** — 다음 라운드는 `handoff-review` 대상이다(3 초과 시).

---

## [검증자 기입] 파생 이슈

> r1 검증 = **FAIL**. 판정 원문은 [`verify.md`](verify.md). AC는 ✅22·⚠️2·❌0/24 · 강제 지점 18/18 ·
> windows CI green — FAIL 근거는 AC 점수가 아니라 아래 **두 미잠금**이다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **사본 스캔의 `대상 집합` 판정 지점이 커밋된 테스트로 잠기지 않았다.** `SOURCE_EXTENSIONS` 에서 `.tsx` 를 빼도 `node --test scripts/check-migrations-appendonly.test.mjs` **14/14 green** — D-018 이 요구한 재발 방지가 스스로 좁아져도 아무도 모른다 | AC22 · §10 `마이그레이션 목록` 행의 `사본 스캔 (1)` | `collectSourceFiles` 를 임시 디렉토리 픽스처로 도는 단위 테스트를 더한다. 확장자·재귀 두 축에 각각 결함을 심어 red 를 확인한다 | **r2 closed** — 인용 변이(`.tsx` 제거)가 scripts **3/18** 을 죽인다(이전 0). 형제축 2건(재귀·정규화)도 각각 2·1건 검출 |
| D2 | **AC9 의 "그 문구가 모달에 도달" 이 잠기지 않았다.** 모달의 `error?.applied` 문단 + import 를 지워 잔여물 진단 0까지 밀었을 때 `typecheck:web` exit 0 · 렌더러 chat **352/352 green** | AC9 검증 수단 후반절 | 렌더 하네스 없이도 대부분 닫힌다 — `checkoutErrorView(error, tr)` 순수 seam 으로 문구 조립과 순서(안내 먼저·원문 나중)를 떼고 `BranchChip` 이 그것을 렌더한다. 남는 미검증은 JSX→DOM 한 홉 | open |
| D3 | **`/`·`C:\`(파일시스템 루트)가 `extraDirs` 를 통과해 write 루트가 된다.** 실측 `isAbsolutePath('/')=true` · `resolveGuardRoots('/tmp/ws',['/']).writeRoots[1] === '/'` — §10 `실패 의미` 가 지목한 적대 상태가 그대로 재현된다 | §10 `extraDirs 절대 경로` 행 ↔ AC12 | **규범 정정 필요** — 루트 거부는 사용자가 받는 결과를 바꾼다. 설계자가 AC12 문면을 정하거나 §10 `실패 의미` 에서 그 사례를 내린다 | **규범 정정 완료 (2026-08-26)** — 사용자 결정으로 닫았다: 루트 **거부**, 거부는 **칩 추가 시점**에 사유와 함께. 산출 = D-019·D-020 신설 · AC12 문면 정정 · **AC25 신설** · §10 행 (2)→(4) · §17 리스크 행 정정. 남은 것은 구현이다(r2) |
| D4 | `IPC_CONTRACT.md §2.6-b` 의 `GitCheckoutResult` 서술이 이번에 추가된 `applied` 필드를 적지 않는다 | §15 문서 계약 | 문서 한 줄 추가. AC20 대조 테스트는 정책만 보므로 이 drift 를 잡지 못한다 | **r2 closed** — `IPC_CONTRACT.md:169` 에 `applied` 3값과 부분 실패 의미 + 실행부 재검사 서술 추가. AC20 4케이스 유지 |
