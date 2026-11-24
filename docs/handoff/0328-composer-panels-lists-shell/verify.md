# Verify — 0328-composer-panels-lists-shell

## Verify 1회째 — RETURN_TO_PLAN

**판정: RETURN_TO_PLAN.** 열거 원문을 어긴 이행 결함 2건(V-I8 칩 원본 data URL · V-V2 설치 로그 행 키)이 `BLOCKING`이다. 확장 창 안의 확장 후보 4건(폴더 통지 묶기·중복 제거·창 폴더 필터 · 세션 전환 때 첨부 삭제)은 `PLAN_GAP`이라 설계자가 먼저다. gate는 전부 통과했고 구현자 sweep 183건은 이번 재실행에서 전부 기대대로 났다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0328-composer-panels-lists-shell` |
| 검증자 | Claude Code (설계자 = 검증자 — plan validity는 자기 설계 감사다) |
| 일자 | 2026-11-24 |
| 대상 커밋/range | `7663064..d46d574` (r1.2 `feaf977` · r1.3 `ce87af7`·`d46d574`) + r1 `bca580a`(rev 5 이전). 전부 PR 브랜치 해시 — `main` 미병합 |
| 구현 전 plan 기준 | `7663064` (V1 rev 5). r1 `bca580a`는 rev 4 `e673ef2` 위 — rev 5는 r1의 PLAN_GAP 정정이다 |
| V mode / 유효 V | Baseline V: V1 rev 5 |
| 라운드 | 1 → 2 |
| 상태 | RETURN_TO_PLAN |
| 확장 창 | verify 1회째 — 창 안 |
| 독립 축(⑥) | 2축 · 시도 10 — (a) 구현자 등록 밖 형태 변이 4(I4·I8·I12·I13) (b) §10 VL ③ 목록별 행 키 자리 6(V1·V1h·V2~V5). 잡음 0 · 못 잡음 6 · 판정 불가 4(§4) |
| 열거 sweep(⑦) | 1회째 전수 대상. 구현자 명세 183건 재실행 = 기대 일치 183(red 182 · 동치 1) + 독립 10. **남긴 전수 잔여**: VL ③ `session.id`·`project.id`·`artifactFileId`·`task.id` — 유일한 직접 좌표가 `--host`(Electron ABI)인데 이 환경에서 Electron 헤더 다운로드가 프록시 403으로 막혔다(§9) |
| 발견 분류 | 이행 2 · 현재 0 · 확장 4(막음 4 / 후보 표 0) · 경계 0 · 비귀속 0 |
| 구현 주체·문맥 | Codex r1·r1.2·r1.3 (기록만) |

## 0. 기준선 / plan 변경 확인

| 검사 | 관측 |
|---|---|
| 구현 커밋의 plan 변경 | `git diff 7663064 HEAD -- plan.md`에서 설계자 영역은 메타 `다음 주체` 한 줄만 바뀌었다(상태 사본). Decision·AC·§10 변경 0 |
| 확장 창 | verify 1회째 — 확장 후보는 `PLAN_GAP` |

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | V1 rev 5, 상속 V 없음 |
| NEW ↔ REQUIRED pair · INHERITED ↔ REGRESSION | 유효 | pair 31(REQUIRED 28 · REGRESSION 3) |
| §10 자리 목록 | 유효 | 구현자 `r1.3-sites.tsv`의 14술어 재실행 결과와 plan 표 대조. VL ③ 여섯 목록은 표에 열거돼 있다 |
| 운영 gate | 유효 | §19 설계·구현 gate 열거 |
| 열거되지 않은 제품 동작 | **PLAN_GAP** | 세션 전환 때 첨부만 비우는 동작(§2 F-4)은 Part I·§13 어디에도 결과가 적혀 있지 않다 |

## 1. Product & UX / ACTIVE Decision 대조

| Decision | 기대 | 실제 production path · 관측 |
|---|---|---|
| D-009 | 썸네일 대기 없이 원본 송신, 준비된 미리보기만 | `ComposerInputController.submit` → `attachmentSnapshot()` → `submitComposerInput`(await 없음, `composerSubmit.ts:36-45`) → `onSend`. 일치 |
| D-010 | 레인·픽셀 검사·base64 복제 | `useAttachments.prepareThumbnail` → `computeClient().request({kind:'imageThumb'}, background, cacheable:false)` → `image` 레인 → `imageThumbnail`(헤더 검사 뒤 decode). R-W 판정으로 `image` 레인. 일치 |
| D-004a | data→창 폴더 통지 | `handlers/files.ts` observation → `folder-observations.ts` → `sender.send(filesFolderChanged)` → `useMentionAutocomplete` refresh. Windows는 메뉴가 열린 동안 경로 ID를 1초마다 stat한다(`d46d574`) — `files.list` 재조회가 아니고 변화 없으면 IPC 0이라 D-004a와 충돌하지 않는다 |
| D-011 | 본문/오버레이 ref 분리 · VL | `usePlanCommentGeometry`·`VirtualCatalogList`·`SidebarRows`·`InstallLog`. 행 키 자리는 §4 V-V2 |
| D-002 | 전송 스냅숏 원본·순서·최근 편집 보존 | 송신 스냅숏은 보존. 세션 전환 시 첨부만 사라짐(§2 F-4) |

## 2. 구현 결과 비판적 검토

| # | 질문·관찰 | 판정 | 근거 |
|---|---|---|---|
| F-1 | 썸네일 base64를 `String.fromCharCode(...bytes)` 펼침으로 만든다(`worker/imageThumb.ts:22`) — 인자 상한 | 문제 없음 | Chromium 워커 펼침 상한 60,000~80,000 사이 실측. 256×256 무작위 노이즈 JPEG q0.8 = 38,448바이트(최악에 가까운 입력) |
| F-2 | `usePanelSelection`(0327 소유)이 중첩 scope 제외를 얻었다 | 무영향 | scope 속성은 `SidebarRows.tsx:70`·`VirtualCatalogList.tsx:51`에만 있고 0327 패널(`DiffReview`·`ArtifactViewer`)의 조상이 아니다. `usePanelSelection.test.ts` ps1~ps17 green |
| F-3 | 폴더 감시 owner 수 상한 | 비귀속 | 창이 cwd를 주는 기존 신뢰 모델과 같다(`listDir`도 같은 입력) |
| F-4 | `useAttachments(sessionKey)`가 세션 전환 시 첨부·작업을 비운다(`useAttachments.ts:41-52`). 컴포저는 세션마다 다시 마운트되지 않아(`Composer.tsx:315` `key="composer-input"`) **초안 텍스트는 남고 첨부만 사라진다**. 변경 전에는 둘 다 남았다 | 확장 후보 → PLAN_GAP(사용자 결정) | `useAttachments.views.test.ts` ‘…retain jobs across session changes’가 비움을 단언한다. Part I에 이 결과가 없다 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 삭제된 `attachmentViews.ts`·`imageThumb.ts` 소비처 | 정상 | `rg -n "from '.*lib/(attachmentViews\|imageThumb)'" src` 0 |
| 새 채널 `filesFolderChanged` 등록 | 정상 | `ipc.ts`·`channel-owner.ts`(data)·`oo.ts` 구독·`IPC_CONTRACT.md` 갱신. `check-doc-inventory --check` 통과 |
| 테스트 전용 참조 | 없음 | 새 export(`createFolderObservations`·`imagePixelCount`·`VirtualCatalogList`)는 production 호출부가 있다 |

## 4. 고장 이력

구현자 명세 `evidence/r1.3-mutations.jsonl` 183건을 `xvfb-run … mutate.py`로 재실행했다 — 183/183 기대 일치(red 182 · Q20-symlink 동치 1), 원복 확인. Electron 오라클 4모드는 깨끗한 트리에서 exit 0·`verdict:true`였고, 모드마다 변이 1건씩 출력을 받아 red 사유가 판정 실패임을 확인했다(`late input replaced the new draft` · `install deadline terminal` · `replaced Markdown selection did not open` · EP10-root는 변이한 fallback 자체의 `ERR_FILE_NOT_FOUND`). 아래는 이번 verify가 새로 만든 행이다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 결과 | 잡은 테스트 / 근거 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|---|
| V-I8 | `AttachmentTray.tsx:20` | 다른 값 | `준비 중` inline 칩의 `previewUrl`에 원본 data URL | composer vitest 251 + `--interactions` | **못 잡음** | — | ⑦ EP2 ④ “칩(원본 data URL 금지)” | **이행** |
| V-V2 | `InstallLog.tsx:53-56` | 고정값 | 행 키 `${generation}:${offset}` → `index` | backend vitest + `--installer` | **못 잡음** | 재시작 때 같은 인덱스 키가 남아 마운트 알림·측정 캐시가 갈린다(동치 아님) | ⑦ VL ③ “로그 조각 = 실행 세대+시작 offset” | **이행** |
| V-V1 | `ProjectsScreen.tsx:154` | 고정값 | `keyOf` → 인덱스 | projects vitest + `--catalogs` + `--interactions` | 못 잡음(비-host) | `--host` 미실행 — 판정 불가 | ⑦ VL ③ | 잔여 |
| V-V1h·V3·V4·V5 | `ProjectsScreen.tsx:154` · `SidebarRows.tsx:64` · `ArtifactsView.tsx:213` · `SchedulesScreen.tsx:47` | 고정값 | 행 키 → 인덱스/비고유 값 | `--host` | 판정 불가 | 깨끗한 트리의 `--host`부터 Node ABI 127 better-sqlite3로 실패 | ⑦ VL ③ | 잔여(환경) |
| V-I4 | `folder-observations.ts:52` | 제거 | 사건 묶기 가드 `folder.timer ||` 제거 | folder-observations + composer-menu-query | 못 잡음 | Q20 4단계 2 “연속 사건을 묶고”는 §10 자리·F 단언에 없다 | ⑥ | 확장 |
| V-I12 | `folder-observations.ts:67` | 제거 | 같은 창·같은 scope 통지 중복 제거 무력화 | 같음 | 못 잡음 | F6은 다른 창 통지 0만 단언 | ⑥ | 확장 |
| V-I13 | `useMentionAutocomplete.ts:196` | 제거 | 통지 필터의 `change.relDir === dir` 제거 | useMentionAutocomplete + composer-menu-query | 못 잡음 | 같은 창의 다른 폴더 통지로 재조회 — F1 “통지 없이는 재조회 0”의 주어(이 폴더 통지)보다 넓은 입력이 없다 | ⑥ | 확장 |

## 5. V-pair closeout

| Pair | 결과 | 직접 증거 / 근거 |
|---|---|---|
| VP-20·21·22·23·30 (UT) | PASS | sweep EP2 헤더 13 · EP3 18 · Q20/Q28/Q30/EP5/EP7 · EP8 · VL-id/mount — 재실행 red |
| VP-16·18·19·25·27 (IT) | PASS | `composer-menu-query.integration` · `install-status` · `--shell` · `measure-stage-d.test.mjs` · 0327 회귀(`client.lanes`·`client.queue`·`usePanelSelection` 등) 전체 vitest green |
| VP-17 (IT) | **PAIR_FAIL** | V-I8 — EP2 ④ 칩 자리 |
| VP-13·15·24·26 (ST) | PASS | sweep EP2 수락·거부·IME · `--geometry` · `chatReducer.parts`·`chatStore` 비활성 세션 |
| VP-14 (ST) | **PAIR_FAIL** | V-I8 (EP2 전 자리) |
| VP-01·02a·02b·03·05·07~12·28 (AT) | PASS | 위 좌표 + Electron `--interactions`·`--geometry`·`--installer`·`--shell` exit 0 |
| VP-04·06 (AT) | PASS(비-host 범위) | `queries.test`·`scheduled-task-queries`·`SearchModal`·`RunHistoryPanel.interaction` green. `--host` 재생은 환경으로 미실행 |
| VP-29 (AT) | **PAIR_FAIL** | V-V2 · VL ③ 네 자리 잔여 |

### AC 합계

✅ 11 (AC1·2a·2b·3·5·7~12) · ⚠️ 2 (AC4·AC6 — `--host` 재생 미실행) · ❌ 2 (AC13 — V-I8, §14 “칩 표시에도 원본 data URL을 img로 주지 않아 예산 우회를 막는다” · AC14 — V-V2) = 15. 구현자 `Criteria-Met: 15/15`와 다르다.

## 9. 게이트 재실행 (`d46d574` 트리)

| Gate | 결과 |
|---|---|
| 가드 5종(migrations·doc-inventory --check·product-naming·test-budgets·ui-thread) | 전부 OK |
| `npm run typecheck` | exit 0 |
| `npx eslint ./src ./scripts`(`--fix` 없이) | 오류 0 · 경고 12, 트리 변화 0 |
| 파일 필터 없는 vitest | 10,773 중 통과 10,740 · 실패 22 · 생략 11. 실패 22는 `c7d2adf` worktree의 같은 9파일 실패 22와 양방향 차집합 ∅. 서명은 Linux의 Windows 경로(`expected '/home/…/C:/work' to be 'C:/work'`)이고 9파일 모두 0328 diff 밖 → 기준선 |
| `node --test scripts/*.test.mjs` | pass 1104 · fail 0 |
| `electron-vite build` · `smoke-hosts` · `smoke-preload` | build 0 · OK · OK(require electron뿐, 키 7) |
| Electron 진단 | `--interactions`·`--geometry`·`--installer`·`--shell` 0. `--host`는 Electron ABI 재빌드가 `electronjs.org` 프록시 403으로 막혀 미실행 |

## 11. Repository operation checks

| 검사 | 관측 |
|---|---|
| trailer | `bca580a`·`feaf977`·`ce87af7`·`d46d574` 모두 `Agent: codex`·`Status`·`Criteria-*`·`Verified-By: pending` 파싱 |
| `[구현자 기입]` 일곱 필드 | r1.3 일곱 필드 존재 |
| INDEX | 갱신 전 `impl/IMPL_DONE`·다음 주체 Claude — 실제와 일치. 이번 verify 커밋에서 `verify/RETURN_TO_PLAN`·라운드 2·다음 주체 Claude로 바꾼다 |
| 대상 커밋 좌표 | 전부 PR 브랜치 해시(`git cat-file -t` commit · `origin/main` 조상 아님) — `main` 병합 뒤 교정 |

## Review Signals — 사실만

- 독립 축 10 중 못 잡음 6. 같은 종류(목록별 열거 자리에 기본 변이가 없음)가 VL ③ 여섯 자리에 걸쳐 있다.
- 구현자 sweep은 공용 배선(`VL-id`·`VL-catalog-key`)을 변이했고 목록별 키 함수는 변이하지 않았다.
- 반복 환경 한계: Electron 헤더 egress 403으로 `--host` 미실행.
