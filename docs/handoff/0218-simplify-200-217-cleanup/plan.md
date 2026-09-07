# Plan — 0218-simplify-200-217-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0218-simplify-200-217-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-09-07 |
| 매핑 | 0200~0217 계열 `/simplify` 정리 (선례 `0175`·`0187`·`0197`·`0199`) |
| 상태 | READY (설계=구현 동시 턴 — 비기능 작업은 Claude 가 직접 구현) |
| V | Baseline V (이 작업의 기준선을 새로 만든다) |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0200~0217 이 **새 스택 넷을 맨바닥에서 세우고 각각 2~4 회 덧칠했다** — git/worktree(0209→0210→0211), Task 패널(0204→0205→0212→0213), 컴포저 행(0201→0206), 스피너(0208→0216). 그 이음매에 같은 규칙의 사본과 렌더 낭비가 남았다.
- 완료 후 달라지는 것: 사용자가 보는 화면·문구·IPC 는 그대로이고, 갈라질 수 있던 규칙이 각각 한 자리로 모이며 diff 패널의 키 입력당 재계산이 사라진다.
- 성공을 사용자 관점 한 문장으로: **diff 패널에서 요구사항을 타이핑할 때 파일 트리가 다시 그려지지 않고, 그 밖의 모든 동작은 이전과 같다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 200~217` — 0200~0217 이 도입한 코드를 4관점(재사용·단순화·효율·altitude)으로 정리한다 | 라이브 세션 요청 (2026-09-07) |
| 명시 절차 | `/simplify` 정의가 **4개 리뷰 에이전트 병렬 기동**을 지시한다 — 그 스킬 호출이 곧 서브에이전트 사용 요청이다 | `.agents/skills` `/simplify` 정의 |
| 추론 의도 | "정리" = **동작 보존** 품질 개선. 렌더 DOM·클래스·a11y 속성·IPC 채널/스키마·i18n 문구는 불변 | `/simplify` 정의 + `0175`·`0187`·`0197`·`0199` 선례 |
| 추론 제약 | **성능은 유지가 하한이고 개선이 목표다** — 0187 이 같은 요구에서 명시 제약으로 받은 축이라 이번에도 상속한다 | `0187/plan.md §2` |
| 추론 의도 | 버그 사냥은 범위 밖(`/code-review` 몫). 다만 **규칙이 두 벌이라 갈릴 수 있는 지점**을 한 벌로 접는 것은 정리의 본체다 | `/simplify` 정의 |

## 3. Decision Ledger

| ID | 상태 | 결정 | 근거 |
|---|---|---|---|
| D-001 | ACTIVE | 리뷰 구간은 `1557460f..HEAD -- app/src` | `1557460f` 는 직전 `/simplify` handoff 0199 의 마지막 구현 커밋 — 그 이후가 0200~0217 에 대응한다 |
| D-002 | ACTIVE | 렌더 DOM·클래스 문자열·a11y 속성·IPC 채널/스키마·i18n 문구는 **불변** | 동작 보존이 `/simplify` 의 정의 |
| D-003 | ACTIVE | 성능 저하는 수용하지 않는다. 캐시를 도입하면 **무효화 지점을 함께 적는다** | 0187 상속 제약 + 무효화 없는 캐시는 최적화가 아니라 새 버그 |
| D-004 | ACTIVE | 테스트 삭제는 정리가 아니다. 단 **삭제된 production 심볼의 전용 테스트**는 함께 지운다 | `AGENTS.md §산출물 문장 규칙 5` (증거를 지우는 것은 회귀) |
| D-005 | ACTIVE | `needs_decision` 로 표시된 발견은 이번 범위 밖 — §17 에 이관 목록으로 남긴다 | 제품 동작·공개 계약 변경은 사용자 몫 (root `AGENTS.md §3`) |
| D-006 | ACTIVE | `TaskTileSections.tsx`(70줄 미참조)는 **손대지 않는다** | 0213 D-004 가 "숨김, 제거 아님"을 복귀 조건과 함께 기록했다 — 제품 결정이지 누락이 아니다 |
| D-007 | ACTIVE | `SUSPENDED_RIGHT_PANEL_TILES = []` 재suspend seam 도 **손대지 않는다** | 같은 이유 — `rightPanelTiles.ts` 가 seam 유지 근거를 자기 안에 적었다 |

### 갱신 메모

- 없음 (r1 설계).

## 4. 요구 비판적 검토

- **"최적화"를 문서 축소로 읽지 않는다.** 0200~0217 의 `plan.md`/`verify.md` 를 형식만 맞춰 일괄 재작성하는 것은 `AGENTS.md §신규 템플릿 적용 경계`와 `§산출물 문장 규칙 3`이 명시적으로 금지한다. 과거 산출물은 증거이므로 제자리 보존한다.
- **4관점 리뷰가 55건을 냈고 전부를 이번에 닫지 않는다.** 동작 보존이 증명 가능한 것만 넣고, 제품 판단이 필요한 6건은 §17 로 이관한다 — 한 번에 넣으면 회귀가 났을 때 원인 분리가 불가능하다.
- **성능 항목이 이번 묶음의 본체다.** 리뷰가 스피너(0208/0216)·`harness-config` env 레이어링·0202 카탈로그 무효화를 **clean 으로 판정**했으므로 낭비는 범위 전체가 아니라 diff 패널 한 곳에 몰려 있다.

## 5. 동작 / 사용자 흐름

변경 후에도 사용자 흐름은 **전부 동일**하다. 이 handoff 는 사용자 관측 동작을 바꾸지 않는다.

관측 가능한 유일한 차이는 **반응 속도**다 — diff 타일에서 요구사항 코멘트를 입력할 때 파일 트리·파일 섹션이 재계산되지 않는다.

### 상태와 전이

새 상태·전이 없음. 기존 상태의 **계산 시점**만 바뀐다(§9 TO-BE).

### 파생 UX / 엣지케이스

- `Composer` 의 diff 요구사항 스냅샷 캡처 시점이 render → submit 으로 이동한다. 값은 같고(§10 EP-07), 부수적으로 `SET_DIFF_REQUIREMENT_DRAFT` 가 revision 을 올린 뒤 Composer 가 리렌더되지 않아 생기던 **stale revision 이 사라진다**.

## 6. 범위 / 비범위

**범위 (28 항목, 3 workstream)**

| WS | 항목 | 근거 리뷰 |
|---|---|---|
| W1 성능 | P1~P7 | efficiency 1·2·5·6·7·8·9 |
| W2 한 자리로 | D1~D12 | reuse 3·4·5·6·8·9·10·13 · simplification 2·4·5·12·14 · altitude 9·11a |
| W3 altitude+사멸 | A1~A5 · X1~X6 | altitude 4·8·10·12·13 · simplification 1·3·6·16 |

**비범위**

- 0200~0217 의 `plan.md`/`verify.md` 문서 수정 (§4).
- `needs_decision` 6 건 (§17 이관).
- `FileDiffSection.tsx`(934줄·9 컴포넌트) 분해 — `renderer/AGENTS.md` 의 리뷰 신호를 넘지만 분해는 별도 설계가 필요하다.
- 버그 수정 (`/code-review` 몫).

## 7. Requirements / Acceptance — `R ↔ AT`

| ID | 요구 | 인수 조건 (AT) |
|---|---|---|
| R-01 | 동작 보존 | AT-01 `npm run lint` + `npm run typecheck` green |
| R-02 | 동작 보존 | AT-02 순수 vitest 스위트가 baseline 대비 **새 red 0** (baseline = 10 파일·56 테스트, 전부 better-sqlite3 ABI) |
| R-03 | 성능 유지·개선 | AT-03 P1 적용 후 `ChangedNavigationSidebar` 의 `useMemo` 가 `patch` 불변 시 재계산하지 않는다 — `diffSections` 참조 동일성 테스트로 잠근다 |
| R-04 | 규칙 단일화 | AT-04 §10 강제 지점 표의 각 지점이 전수 검색으로 1 곳임을 보인다 |
| R-05 | 사멸 코드 제거 | AT-05 X1~X6 의 심볼이 `app/src` 전수 검색에서 0 건 |

### AC 검증 주의사항

- AT-02 의 분모는 **차집합**이다 — baseline red 10 파일 목록을 고정하고 사후 red 집합에서 뺀다. 합계 비교는 반증할 수 없다.
- AT-03 은 구조적 proxy 다 — 참조 동일성만 본다. 결함을 심어(메모 제거) red 로 가는지 확인한다.

## 7-A. V / Trace Matrix

### Node registry

| Node | 레벨 | provenance | 내용 |
|---|---|---|---|
| MD-01 | Module | NEW | diff 패널 파생값은 입력이 불변이면 참조를 보존한다 |
| MD-02 | Module | NEW | 한 규칙은 한 모듈이 소유한다 (§10 강제 지점) |
| AR-01 | Arch | NEW | 사멸 심볼 제거 후 남은 소비자 0 |
| SD-01 | System | INHERITED | 0200~0217 이 세운 end-to-end 경로는 불변 |
| R-01 | Req | INHERITED | 사용자 관측 동작 불변 |

### Pair registry

| Pair | 노드 | 레벨 | requiredness | production path | 강제 지점 | oracle |
|---|---|---|---|---|---|---|
| VP-01 | MD-01↔UT | UT | REQUIRED | `receiveGitPatch → DiffReview → ChangedNavigationSidebar` | 3 (§10 EP-01~03) | `diffSections(patch)` 참조 동일성 단언 + 메모 제거 변이 |
| VP-02 | MD-02↔UT | UT | REQUIRED | 각 규칙 소유 모듈 | 9 (§10 EP-04~12) | 전수 검색 개수 + 사본 부활 변이 |
| VP-03 | AR-01↔IT | IT | REQUIRED | 빌드 그래프 | 6 (§10 EP-13~18) | `tsc` + 전수 검색 0 건 |
| VP-04 | SD-01↔ST | ST | REGRESSION | 전체 순수 스위트 | 0 (회귀 전용) | baseline 차집합 |
| VP-05 | R-01↔AT | AT | REGRESSION | 렌더 스위트 | 0 (회귀 전용) | 기존 render test 유지 |

### 현재 변경의 운영 gate

`cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run` (순수 스위트). `npm test` 는 쓰지 않는다 — ABI 를 Node 로 뒤집어 공유 `node_modules` 를 통해 메인 체크아웃의 `dev`/`build` 를 깨뜨린다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 전수 조사

리뷰 구간 `1557460f..HEAD -- app/src` = **398 파일 · +38,849/−1,781 · 코드 커밋 113**.

4개 병렬 리뷰 에이전트(reuse·simplification·efficiency·altitude)가 각각 독립 조사했고, **2개 이상 에이전트가 같은 지점을 지목한 항목이 14건**이다. 아래 관측은 전부 파일을 열어 재확인했다.

| 관측 | 좌표 |
|---|---|
| `escapeAttribute` 3벌 — 본문 바이트 동일, 파라미터 union 만 다름 | `adapters/attachment-prompt.ts:21` · `plan-feedback.ts:22` · `diff-requirements.ts:12` |
| `currentBranch` ≡ `resolveHeadRef` — 같은 명령·같은 `readOnly:true`·같은 기본값 | `infra/git/git-cli.ts:50` · `repository.ts:34` (`TIMEOUT_MS=10_000`·`MAX_BUFFER=4MB` = `runner.ts:37-38` 기본값) |
| `diffSections(patch)` 비메모 → 하류 `useMemo([sections])` **영구 미스** | `DiffReview.tsx:89` → `ChangedNavigationSidebar.tsx:37-45` |
| `reanchoredRequirements` 가 **전 파일** 줄 변환 후 1건만 읽음 | `chatReducer.ts:152` (`linesByPath.get(item.anchor.filePath)` 만 소비) |
| Task 타일이 transcript 를 **2회** fold | `TaskTileContent.tsx:30`·`:38` |
| `modeMenuOptions` 가 `coerceAutoPermissionMode` 규칙을 재구현 | `composer/modes.ts:60-66` vs `shared/permission-mode.ts:74-76` |
| worktree rollback 2벌 — 두 번째가 `rmdir` 누락 | `features/worktrees/service.ts:158-169`·`:192-200` |
| `gitSnapshotTriggerKey` ≡ `gitSnapshotRequestKey` | `composer/useGitSnapshot.ts:39`·`:49` |

### 수치 / 전칭 표현 검산

- baseline red = **10 파일 · 56 테스트** (2회 독립 실행 동일). 전부 main 프로세스 DB 로드 스위트, 원인은 `better_sqlite3.node` 의 `NODE_MODULE_VERSION 140`(Electron) vs 127(Node) — 변경과 무관.
- green = 353 파일 · 3392 테스트 · 7 skipped.
- 이번 변경 대상은 **전부 green 353 안**에 있다 → 새 red 는 전부 이번 변경 귀속.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

키 입력 1회 → `SET_DIFF_REQUIREMENT_DRAFT`(항상 새 state) → `DiffTileContent` 리렌더 → `new Set(expandedFiles)` + `requirements.filter()` 새 배열 → `DiffReview` 에서 `diffSections(patch)` 새 배열 → `ChangedNavigationSidebar` 의 `useMemo([sections])` 미스 → `buildChangedFileTree` + `visibleTreeRows` 전체 재구축 → 모든 `TreeRow` 리렌더.

동시에 규칙 사본이 각각 2~4 벌 존재한다(§8 표).

### TO-BE — 변경 후 목표 구조와 동작 경로

키 입력 1회 → `SET_DIFF_REQUIREMENT_DRAFT` → `DiffTileContent` 리렌더 → 세 파생값 모두 `useMemo` 히트(입력 불변) → `sections` 참조 보존 → `ChangedNavigationSidebar` 의 `useMemo` **히트** → 트리 재구축 없음.

각 규칙은 §10 이 지정한 한 모듈이 소유하고 나머지는 호출한다.

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE |
|---|---|---|
| diff 파생값 | 렌더마다 새 참조 | 입력 불변 시 참조 보존 |
| 재앵커링 | 전 파일 줄 변환 | 요구사항이 가리키는 파일만 |
| Task fold | 렌더당 2회 | 렌더당 1회 |
| 규칙 소유 | 2~4 벌 | 1 벌 + 호출 |

### 핵심 책임 분리

`diffLines.ts` = 줄 축 표기 소유 · `sessionChangesData.ts` = sha 표기 소유 · `shared/permission-mode.ts` = 모드 지원 규칙 소유 · `repository.ts` = git ref/oid 판정 소유 · `attachment-prompt.ts` = 프롬프트 속성 이스케이프 소유.

## 10. 계약 / 타입 / 강제 지점

| EP | 불변식 (주어 = 불변식, 해법 이름 아님) | 소유 모듈 | 검색 술어 |
|---|---|---|---|
| EP-01 | diff 섹션 파생은 `patch` 불변 시 참조를 보존한다 | `DiffReview.tsx` | `diffSections(` |
| EP-02 | 펼침 집합 파생은 `expandedFiles` 불변 시 참조를 보존한다 | `DiffTileContent.tsx` | `new Set(expandedFiles` |
| EP-03 | 비교범위 필터 파생은 입력 불변 시 참조를 보존한다 | `DiffTileContent.tsx` | `diffRequirementMatchesComparison` |
| EP-04 | 프롬프트 속성 이스케이프는 한 함수가 소유한다 | `adapters/attachment-prompt.ts` | `replace\(/&/g` |
| EP-05 | HEAD 브랜치 이름 판정은 한 함수가 소유한다 | `infra/git/repository.ts` | `symbolic-ref` |
| EP-06 | git OID 파싱 규칙은 한 함수가 소유한다 | `infra/git/repository.ts` | `0-9a-fA-F]{40,64}` |
| EP-07 | 스냅샷 요청 identity 계산은 한 함수가 소유한다 | `composer/useGitSnapshot.ts` | `JSON.stringify(\[cwd, sessionId\])` |
| EP-08 | 늦은 git 응답 판별은 한 술어가 소유한다 | `chatReducer.ts` | `gitSnapshotRequest` 비교 |
| EP-09 | 줄 축 표기(`+`/`-`)는 한 함수가 소유한다 | `lib/diffLines.ts` | `'removed'` + `oldLine` |
| EP-10 | 짧은 sha 표기는 한 함수가 소유한다 | `rightpanel/sessionChangesData.ts` | `slice(0, 7)` |
| EP-11 | 모드-모델 지원 규칙은 한 함수가 소유한다 | `shared/permission-mode.ts` | `isHaikuModel` |
| EP-12 | worktree 생성 롤백은 한 절차가 소유한다 | `features/worktrees/service.ts` | `deleteBranch` |
| EP-13 | `parseNameStatusZ` 소비자 0 | — | `parseNameStatusZ` |
| EP-14 | `TaskBoardKind` 소비자 0 | — | `TaskBoardKind` |
| EP-15 | `repoNameFromRoot` 소비자 0 | — | `repoNameFromRoot` |
| EP-16 | `applyNameStatus` 는 모듈 외부 소비자 0 | `git-diff-parse.ts` | `applyNameStatus` |
| EP-17 | `DiffSection.patch` 는 non-null | `diffComparison.ts` | `patch: .*null` |
| EP-18 | 상태 조회는 cwd 검증을 selector 가 한다 | `chatStore.ts` | `statusForCwd` |

## 11. 구현 설계

W1 → W2 → W3 순서로 배치 적용하고 **배치마다 gate 를 돌린다**. 배치 간 실패 귀속을 분리하기 위해서다.

### 테스트 가능성

- VP-01: `diffSections` 참조 동일성은 렌더 하네스 없이 순수 단언으로 잠근다.
- VP-02: 각 EP 는 `rg` 전수 개수로 센다 — 술어는 §10 의 검색 술어를 그대로 쓴다.
- VP-03: 삭제 심볼은 `rg` 0 건 + `tsc` 로 동시 확인한다.

## 12. End-to-end 영향

### producer → consumer

`escapeAttribute` 를 `attachment-prompt.ts` 에서 export → `plan-feedback.ts`·`diff-requirements.ts` 가 import. 파라미터 union 을 `string | number | boolean | null` 로 넓힌다 — `String(null)` = `"null"` 로 현재 `diff-requirements.ts` 출력과 동일하다.

### 부팅/등록/초기화 변경 시 기존 소비처

부팅·등록·초기화 경로는 건드리지 않는다.

## 13. Lifecycle / 오류 / 정리

worktree rollback 통합(D7)이 **두 번째 경로의 `rmdir` 누락을 함께 고친다** — 현재 `catch` 분기는 repo segment 디렉토리를 남긴다. 이는 사본 드리프트의 결과이므로 통합의 일부다.

## 14. 성능 / 상한 / 최적화

| 항목 | 무효화 지점 |
|---|---|
| P1 `diffSections` 메모 | `patch` 참조 — `receiveGitPatch` 가 새 generation 을 실을 때만 바뀐다 |
| P1 `expandedFiles` Set | `expandedFiles` 참조 |
| P1 요구사항 필터 | `requirements`·`comparison` 참조 |
| P5 `useNavSections` 1-entry 캐시 | `[byId, recentIds, pinnedProjectIds, projectSessionIds]` 4-튜플 참조 — 기존 `useMemo` deps 와 동일 |

새 캐시는 전부 **참조 동일성 기반**이라 별도 만료가 없다. 무한 성장 캐시는 도입하지 않는다.

## 15. 외부 구현 포트 / 문서 계약

없음.

## 16. 기존 결정·규칙과의 관계

- `renderer/AGENTS.md` 4-layer 방향·시맨틱 토큰 유지. 새 CSS 파일 없음.
- `main/AGENTS.md` 하향 DAG 유지 — D1 은 `adapters → adapters`, D2·D4·D5 는 `infra → infra`.
- 0202 카탈로그 무효화 범위는 건드리지 않는다.

## 17. 리스크 / 트레이드오프

**이관 (needs_decision — 이번 범위 밖)**

| 항목 | 이유 |
|---|---|
| git identity 메뉴의 중복 `gitApi.status` fetch (altitude 1 / efficiency 4) | 제거하면 4-phase `loading` 어포던스가 사라진다 — 화면이 바뀐다 |
| `executionCwdRecovered` → `spawnedCwd` 일반화 (altitude 2) | respawn 트리거를 넓힌다 |
| env 레이어 배열화 + `CLAUDE_CODE_*` 리터럴 이설 (altitude 3) | `inheritedHostManaged` 가 `settingsEnv` 비었을 때 `baseEnv` 를 **안 보는** 예외가 load-bearing (0200) |
| `openConfirmDialog` 수렴 (altitude 7) | DOM 이 달라진다 |
| `git-cli` gate 1-spawn 병합 (efficiency 3a) | `isRepo:true`+`root:null` 도달 가능 경로가 바뀔 수 있어 측정이 선행돼야 한다 |
| `FileDiffSection.tsx` 분해 | 별도 설계 |

**리스크**

- P2(`reanchoredRequirements` 축소)가 가장 미묘하다 — `linesByPath` 는 `get(item.anchor.filePath)` 로만 읽히고 미스는 `?? []` 로 접히므로 결과가 같지만, **비교 대상 축소가 결과를 바꾸지 않는지** 단언으로 잠근다.
- D14(타일 헤더 공용화)는 DOM 동일성이 핵심이라 클래스 문자열을 문자 단위로 옮긴다.

## 18. 영향 받는 파일 / 문서

`app/src/main/adapters/{attachment-prompt,plan-feedback,diff-requirements,claude-map}.ts` · `app/src/main/infra/git/{git-cli,repository,git-diff,git-diff-parse}.ts` · `app/src/main/features/worktrees/service.ts` · `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,store/chatStore.ts,lib/{diffLines,taskBoard}.ts,components/**}` · `app/src/renderer/src/features/sessions/hooks/useNavSections.ts` · 대응 테스트.

## 19. 게이트

| 게이트 | 명령 |
|---|---|
| lint | `cd app && npm run lint` |
| typecheck | `cd app && npm run typecheck` |
| 순수 테스트 | `cd app && ./node_modules/.bin/vitest run` |
| 전수 검색 | `rg` — §10 의 검색 술어별 개수 |

`npm test` 금지 (§7-A 운영 gate 사유).

## READY self-review

- [x] Decision 7건 전부 ACTIVE 이고 상충 없음
- [x] AC 5건이 각각 판정 가능한 oracle 을 가짐
- [x] V pair 5건이 레벨·경로·강제 지점·oracle 을 가짐
- [x] §10 강제 지점 18건이 **불변식 주어**로 서술됨 (해법 이름 아님)
- [x] baseline red 가 수치와 파일 목록으로 고정됨 (차집합 분모)
- [x] needs_decision 6건이 §17 로 이관됨

---

## [설계자 기입] r2 규범 정정

r1 은 계획 28 중 23 을 적용했다. r2 는 **잔여 중 실패 모드가 있는 4건 + verify 파생 I-05** 만 닫고, 순수 광택 7건(D13·D14·D15·A2·A6·P7·X5)은 범위에서 뺀다 — 독립 라운드를 세울 근거가 없고 그 파일을 다음에 건드리는 핸드오프에 얹는 편이 싸다.

### r2 Decision

| ID | 상태 | 결정 | 근거 |
|---|---|---|---|
| D-008 | ACTIVE | r2 범위 = D9 · A3 · A4 · A5 + I-05 | 각각 관측된 실패 모드를 갖는다(아래 §10 추가 행) |
| D-009 | ACTIVE | 광택 7건은 `NEXT_HANDOFF` 로 내린다 | 실패 모드가 없다. 라운드 비용이 이득보다 크다 |
| D-010 | ACTIVE | I-05(테스트 하네스 경쟁)를 r2 에 넣는다 | 게이트가 간헐 red 면 **이후 모든 라운드의 차집합 판정**이 같은 잡음을 안는다 — 측정 도구의 결함이라 코드 품질과 우선순위가 다르다 |

### r2 §10 강제 지점 추가

| EP | 불변식 (주어 = 불변식) | 소유 모듈 | 검색 술어 |
|---|---|---|---|
| EP-19 | 줄 축 표기(`+`/`-`)는 한 함수가 소유한다 | `lib/diffLines.ts` | `` `+${ `` + `newLine` |
| EP-20 | diff 타일의 소유 열 번호는 레이아웃 소유자가 정한다 | `lib/rightPanelLayout.ts` | `tiles.includes('diff')` |
| EP-21 | cwd 검증된 git 상태 읽기는 selector 가 소유한다 | `store/chatStore.ts` | `statusForCwd(` |
| EP-22 | 발신 앵커 정규화는 `send()` 진입에서 1회 한다 | `store/chatStore.ts` | `wireDiffRequirementAnchor` (`send` 내부) |
| EP-23 | 큐 획득 대기는 고정 시간이 아니라 획득 사실로 판정한다 | `infra/git/queue-entry.test.ts` | `setTimeout` (`whileQueueHeld` 내부) |

### r2 AC

| ID | 요구 | 인수 조건 |
|---|---|---|
| AC-r2-1 | 동작 보존 | lint 0 error + typecheck green |
| AC-r2-2 | 회귀 없음 | 차집합 새 red 0 (분모 = r1 이 고정한 baseline 10 파일) |
| AC-r2-3 | EP-19~23 각 1곳 | 전수 검색 재열거 |
| AC-r2-4 | I-05 해소 | `whileQueueHeld` 가 고정 대기를 쓰지 않는다 + 해당 스위트 반복 실행 green |
