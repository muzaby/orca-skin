# Verify — 0244-theme-boot-settings-race

## 메타

| 항목 | 값 |
|---|---|
| slug | `0244-theme-boot-settings-race` |
| 검증자 | Claude Code |
| 일자 | 2026-10-01 |
| 대상 커밋/range | `89258bd..c8a87ee` (r1 `492d7d6` · r1.2 `c8a87ee`) · plan 메타만 바꾼 `553ab87` 포함 |
| 구현 전 plan 기준 | `89258bd` |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `89258bd:V1` |
| 라운드 | 1 |
| 상태 | **PASS** (기계 범위) — AC6 Windows 설치본 사람 실기 대기 |
| 자기 검증 여부 | 구현자 = 같은 에이전트(Claude, 다른 세션). §4에 구현 보고가 이름을 대지 않은 적대 축 8건을 넣었다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태`(READY → IMPL_DONE r1.2)와 `[구현자 기입]` 절만.
- **기준선이 diff로 성립하는가**: 예 — 설계 커밋 `89258bd` 가 구현 커밋과 분리돼 있다.
- Decision Ledger 변경: 없음 (`git diff 89258bd HEAD -- plan.md` 에 §3 hunk 0).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음.
- V node/pair·requiredness·§10·oracle 변경: 없음.
- 채점에 사용할 원 기준: `89258bd` 의 §7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 상속 V 없음 → Baseline V1 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01·R-02↔AT, SD-01↔ST-01, AR-01↔IT-01, MD-01↔UT-01 — 5 pair 전부 REQUIRED |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | INHERITED node 없음 |
| pair별 path·§10 전수·직접 oracle | 유효 | VP-02 EP-01 · VP-03 EP-02 · VP-04/05 EP-03 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 구조적 proxy(VP-02)·전수(VP-03)만 선택, 나머지는 직접 행동 oracle |
| `SUPERSEDED` pair의 AC·적대 증거 이관 | 해당 없음 | — |
| 현재 변경 산출물의 운영 gate·범위 | 유효(보완 기록) | §7-A 의 vitest 가 수정 디렉토리로 한정돼 renderer catch 레지스트리를 빠뜨렸다 — r1.2 가 이미 고쳤고 이번 검증은 전체 vitest 로 판정했다(§9). 판정에 필요한 계약 누락은 아니다 |

- V 도입 전 plan: 해당 없음.
- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | 재시작 시 저장 테마 적용 | `index.ts:304` `router.start()` → `bootstrap.ts:396` 동기 등록 → `index.ts:306` `createWindow` → `TweakProvider.load` |
| D-003 | 읽기만 창 전, 쓰기는 `register(ctx)` | `handlers/settings.ts:13-16` 읽기 · `:19` 쓰기(`settingsSet` 만) |
| D-004 | 실패 시 `whenReady` 뒤 1회 재시도 → `loadFailed` | `TweakProvider.tsx:84-89` 재시도 · `:104-111` 보고 |
| D-005 | `update:state`·`session:cwd` 비범위 | 코드 변경 0 확인 |

### end-to-end 흐름

```text
app.whenReady → router.start() 호출(동기 구간에서 settings:get 등록, 첫 await 에서 반환)
  → ipcMain.handle(bootWhenReady) → createWindow
  → renderer TweakProvider.load → settings:get ✓ → store.t → dataset.theme
      ↘ ✗ → bootApi.whenReady → settings:get → ✓ setState / ✗ reportError(loadFailed)
      ↘ whenReady reject → reportError(loadFailed), 2회차 읽기 없음
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 정상 | 부팅 실패면 `whenReady` reject → 보고, `BootFailureFrame` 이 앞에 뜬다(구현자 기입과 일치) |
| false success 가능성 | 없음 | 재시도 실패·부팅 실패 모두 `loadFailed` 토스트 — 조용한 기본값 경로 0 |
| partial failure/rollback | 해당 없음 | 읽기만 |
| Product/UX의 A가 아닌 B | 아니오 | 창 순서(0109)는 유지하고 읽기 등록만 앞당김 |
| 증상만 제거 | 아니오 | 원인(등록 전 읽기)을 제거하고, 복구 경로는 보조 |
| 최적화가 잃은 관측 | 해당 없음 | — |
| 출력/요청 worst-case | 상한 2회 | 재시도 1회 고정 — M10 으로 확인(§4) |

## 3. 역방향 탐색

`scan-surface.sh` 대신 diff 전수(8 코드 파일)를 직접 읽고 아래를 셌다.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 정상 | `registerSettingsReadHandler` production 호출 1건 `bootstrap.ts:396` |
| 테스트 전용 참조 | 정상 | 소스 스캔은 production `bootstrap.ts` 원문을 읽는다 · `misc-split` 은 production 모듈을 import |
| 형제 정책 비대칭 | 의도 | 쓰기는 스케줄러 필요로 후기 등록(D-003) |
| 신규 등록값의 기존 소비처 영향 | 무영향 | renderer `settingsApi.get(` 비테스트 호출 7곳 재열거 — 반환값 불변, 등록 시점만 앞당겨짐 |
| producer ↔ consumer 파생 불일치 | 없음 | `Settings` → `Tweaks` 8필드 투영 불변 |
| 동일 규칙 중복 구현 | SSOT 유지 | `CHANNELS.settingsGet` 등록 1건(`handlers/settings.ts:16`) |
| 문서 서술 | 정합 | `IPC_CONTRACT.md` 2행 · `overview.md §3.1` · `app/src/main/AGENTS.md` 이 코드 순서와 일치(`registerConnectionHandlers` `:490` < 첫 `await` `:527`) |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트: `TweakProvider.store.test.ts` "loads the settings projection…" 유지 · `misc-split` 25채널 케이스 갱신 확인.
- structural proxy만으로 semantic 목표를 통과시킨 AC: AC1 — 소스 위치 비교. 의미 층은 `index.ts:304-306` 호출 순서를 읽어 닫았다(동기 구간은 `router.start()` 호출 안에서 `createWindow` 전에 끝난다).
- **선택된 적대 증거 재측정**: 등록 3 + 인용 1 = 4건 중 검출 4 · 미검출 0 · 일반 hunk 자동 확장 0.
- **자리 미지정 등록 변이**: VP-02 ② "첫 `await` 뒤로 이동" → 자리 2곳(첫 `await` 문장 직후 · 구현자가 고른 `register(ctx)` 직전) 모두 red.
- **이전 라운드 대조**: 최초 검증 — 해당 없음. r1.2 인용 변이(M11)는 red 유지.
- **자기검증 분모**: 보고에 없던 축 8건(M2·M4·M5·M6·M7·M9·M10·M12) — 5 red · 3 green(D1~D3, 전부 NON_BLOCKING).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 `bootstrap.ts:396` 호출 삭제 | settings-early + misc-split | 구현자 red(2) | **red 2** | VP-02 등록 ① |
| M2 호출을 첫 `await` 문장 직후로 이동 | 같음 | 미실행 | **red 1** | VP-02 등록 ② 자리 1 · 자기축 |
| M2' 호출을 `register(ctx)` 직전으로 이동 | 같음 | 구현자 red(1) | **red 1** | VP-02 등록 ② 자리 2 |
| M3 쓰기 모듈에 `settingsGet` 재등록 | 같음 | 구현자 red(2) | **red 2** | VP-03 등록 |
| M4 bootstrap 에서 읽기 등록 2회(`register(ctx)` 직전 추가) | 같음 | 미실행 | green 4/4 | 자기축 — 같은 계약(EP-02 1회)을 다른 자리에서 깸 → D1 |
| M5 첫 `await` 앞에서 `setTimeout(…, 5000)` 지연 등록 | 같음 | 미실행 | green 4/4 | 자기축 — 구조적 proxy 한계 → D2 |
| M6 `whenReady` 대기 제거 | theme + 레지스트리 | 미실행 | **red 3** | 자기축 — EP-03 ① |
| M7 `whenReady` 뒤 `cancelled` 가드 제거 | 같음 | 미실행 | **red 1** | 자기축 — AC5 |
| M8 `reportError` 제거 | 같음 | 구현자 T36 내장 | **red 4** | EP-03 ③ |
| M9 바깥 catch 의 `cancelled` 가드 제거 | 같음 | 미실행 | green 213/213 | 자기축 — 해제 후 실패 분기 → D3 |
| M10 재시도 2회(3회 읽기) | 같음 | 미실행 | **red 4** | 자기축 — EP-03 ② 상한 |
| M11 레지스트리 EXCLUDE 행 삭제 | 같음 | r1 gate red | **red 1** | r1.2 인용 변이 |
| M12 재시도 성공 뒤 `setState` 생략 | 같음 | 미실행 | **red 1** | 자기축 — AC3 |

- 재현 방법: worktree `c8a87ee` 에서 변이마다 문자열 치환 → `vitest run <위 범위의 suite>` → `git checkout -- <파일>`. 실행 후 worktree status 비어 있음 확인(스크립트는 저장소에 남기지 않음).
- 동작 보존 추출 라운드: 아니오.
- 소거 변이 잔여물: M1·M8 은 unused import 를 남기지만 vitest 판정은 테스트 단언 red 이고 lint 를 돌리지 않았다 — 잔여물 부산물 아님.
- 형제 슬롯 맞바꿈: 해당 없음 — 형제 슬롯 없음.
- `N회` 관측 주체: `settingsApi.get` mock 호출 수(재시도 1회) · `ipcMain.handle` mock 등록 배열(채널 1회).
- 순서 관측: 소스 위치(AC1) · deferred `whenReady` 로 "부팅 전 재시도 없음"(AC3).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-04 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | store 4케이스 green · M6·M7·M8·M10·M12 red | `load()` → get ✗ → whenReady → get → setState/report / EP-03 3/3 |
| VP-03 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | `misc-split` 2케이스 · M3 red | 두 등록 함수 → `ipcMain.handle` / EP-02 2/2 |
| VP-02 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | settings-early 2케이스 · M1·M2·M2' red | `start()` 동기 구간 → `registerSettingsReadHandler(this.settings)` / EP-01 1/1 |
| VP-05 | R-02 ↔ AT-03..05 / AT | REQUIRED | PASS | VP-04 와 같은 4케이스 — AC 행동 판정 범위 | VP-04 와 같음 / EP-03 |
| VP-01 | R-01 ↔ AT-06 / AT | REQUIRED | PASS(기계 범위) — 실기 대기 | 순서 사슬 `index.ts:304`→`:306` 열람 + VP-02 · AC6 사람 실기 미수행 | EP-01·EP-02 |

- root `PAIR_FAIL`: 없음. 종속 `BLOCKED_BY`: 없음.
- 공유 증거: store 4케이스가 VP-04(모듈 불변식)와 VP-05(AC3~5 행동)를 함께 닫는다.
- 실행 범위: 최초 검증 — 유효 V REQUIRED 5 전건.

### AT / AC 세부와 합계

| AT / AC | 결과 | 검증 증거 |
|---|---|---|
| AT-01 / AC1 | ✅ | settings-early 2케이스 · M1/M2/M2' red |
| AT-02 / AC2 | ✅ | misc-split 2케이스(반환값 `toBe(snapshot)`·채널 집합) · M3 red |
| AT-03 / AC3 | ✅ | "retries once after main boot…" · M6·M12 red |
| AT-04 / AC4 | ✅ | "reports loadFailed…" 2케이스 · M8·M10 red |
| AT-05 / AC5 | ✅ | "stops the retry chain…" · M7 red (해제 후 실패 분기는 D3) |
| AT-06 / AC6 | ⚠️ | Windows 설치본 사람 실기 대기 |

- **합계 재측정**: `✅ 5 · ⚠️ 1 · ❌ 0 = 총 6` · 자기보고 같음 · 일치.
- **합계 사본 대조**: 본문 5/6 ↔ trailer `Criteria-Met: 5/6`(`492d7d6`·`c8a87ee`·`553ab87`) ↔ INDEX "✅5 · ⚠️1" — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-02 | EP-01 첫 `await` 전 등록 | 1 | `bootstrap.ts:396` < 첫 `await` `:527` (1/1) | PASS |
| VP-03 | EP-02 ① 읽기 모듈 등록 ② 쓰기 모듈 비등록 | 2 | `handlers/settings.ts:16` · `:19-` 에 `settingsGet` 0 (2/2) | PASS |
| VP-04 | EP-03 ① 대기 ② 1회 ③ 보고 | 3 | `TweakProvider.tsx:87` · `:89` · `:106` (3/3) | PASS |

- 구현자 라벨 표본: EP-03 ③ 을 `:109` 로 적었으나 실제 `reportError` 는 `:106` — 라벨 드리프트, 판정 무관.
- 표 밖 같은 불변식 지점: bootstrap 안 호출 횟수(D1) — 현재 1건이라 NON_BLOCKING.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | `eslint ./src ./scripts`(`--fix` 없이) 0 error · 1 warning(`useVirtualizer` — 변경 밖) |
| typecheck | PASS | node·web·test 3종 오류 0 |
| vitest 전체 | PASS | 600파일 pass · 1 skip · 5716 pass · 3 skip · 실패 0 |
| doc-inventory | PASS | generated ok · prose ok · links ok |
| trailer 파싱 | PASS | 4커밋 전부 키 반환(§11) |

## 6. 외부 포트 / 문서 계약

- 해당 없음 — Electron `ipcMain.handle` 1회 제약은 VP-03 이 mock 등록 배열로 닫는다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- 설정 채널 등록 지점: production 1건씩 (`rg CHANNELS.settingsGet src/main` 1 · `registerSettingsReadHandler(` 호출 1).
- 게이트 밖 즉시 호출자 재측정: `settingsApi.get(` 비테스트 호출 7줄 중 마운트 즉시·게이트 밖은 `TweakProvider`·`chatStore:1785` 2곳 — plan §8 "settings:get×2" 와 일치.
- 요청 상한: 성공 1회 · 실패 최대 2회 — M10 red 로 고정 확인.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AC6 | 등록 순서(소스)·`index.ts` 호출 순서(열람)·복구 경로(store) | 실제 electron 부팅에서 첫 프레임 테마 | Windows 설치본: 설정 → 다크 저장 → 종료 → 재실행 → 부팅 화면부터 다크인지 · 글자 크기/언어도 유지되는지 |

## 9. 게이트 재실행

- 실제 실행 명령(worktree `c8a87ee`, node_modules 심링크):
  - `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm run typecheck` · `npx eslint ./src ./scripts`
  - `npm rebuild better-sqlite3` → `ELECTRON_OVERRIDE_DIST_PATH=<빈 디렉토리> ./node_modules/.bin/vitest run`
  - `node scripts/check-doc-inventory.mjs --check`
- **관측한 실행 산출**: §5 운영 gate 표.
- `npm test` 미사용 — DB 동작 검증 불필요.
- 환경 기인 실패 분리: Node ABI 재빌드 전 전체 vitest 는 35파일·187케이스 red(`new Database(':memory:')` bindings) — 재빌드 후 0. 변경 무관.
- **게이트가 작업 트리를 바꿨는가**: 없음 — `--fix` 없이 eslint 를 돌렸고 worktree status 비어 있음.
- **잔여물**: worktree·mutation 스크립트는 scratchpad 에만 있고 worktree 는 제거했다. `app/node_modules` 의 better-sqlite3 는 Node ABI 로 남는다(미추적, 다음 `dev`/`build` 의 predev 가 재빌드).

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/관련 자동 테스트 | 에이전트 실행 — PASS |
| AC ↔ 코드/production path | AC1~5 1:1 대조 완료 |
| 레이어/계약/문서 형식·링크 | doc-inventory PASS · 문서 서술 코드와 일치 |
| AGENTS 위생 | `app/src/main/AGENTS.md` 1행 수정 — 비밀/변동 정보 없음, 부모 규칙 충돌 없음 |
| 제품 의도 / Open Question | 없음 |
| UI/UX 시각 | AC6 사람 실기 |
| 신규 의존성 / PR merge | 신규 의존성 0 · merge 는 사람 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 민감 패턴: 없음. 일회성 정보: 없음(0244 출처 표기는 기존 행 관례와 같음). 부모↔자식 충돌: 없음.

### INDEX 보드 정합성

- 갱신 전 상태 `impl/IMPL_DONE (r1.2)` · 다음 주체 Claude — 실제와 일치.
- 대상 커밋 좌표 기입: `89258bd`(V1) · `492d7d6`(r1) · `c8a87ee`(r1.2) — 3건 `git cat-file -t` = commit.
- 이번 갱신 비고 5줄 이내.
- PASS 이지만 AC6 사람 실기가 남아 행을 유지하고 다음 주체를 사람으로 둔다(0243 선례).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Status: designed|implemented` · `Verified-By: pending` — 허용값.
- 파싱: `89258bd`·`492d7d6`·`c8a87ee`·`553ab87` 모두 적힌 키를 그대로 반환.
- `553ab87` 은 plan 메타 1줄만 바꾼 커밋인데 `Status: implemented`·`Criteria-*` 를 실었다 — 같은 값이라 갈림은 없다(NON_BLOCKING, D4).
- 재구현 턴 7필드: r1·r1.2 모두 설계 리뷰·강제 지점 전수·잠금·Product/UX·잠재 문제·구현 보고·Review Signals 7절 존재.
- reference 이동/삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 등록 위치를 `start()` 첫 문장으로 | 타당 — §11 "인증 스택 앞" 범위 안, `legacy-migration` throw 전이라 더 안전 | — |
| `overview.md`·`app/src/main/AGENTS.md` 선조치 | 타당 — 코드와 일치하는 현재 상태 서술 | — |
| r1.2 레지스트리 행(EXCLUDE·TOAST T36) | 타당 — M11·M8 red | — |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | bootstrap 안에서 읽기 등록을 두 번 부르는 변이(M4)를 어떤 테스트도 잡지 않는다 | EP-02 형제 자리 — production 은 1건 | NON_BLOCKING | 기록 — 실제로 생기면 부팅이 즉시 throw 해 바로 드러난다 |
| D2 | 첫 `await` 앞 `setTimeout` 지연 등록(M5)이 소스 스캔을 통과한다 | VP-02 구조적 proxy 한계 | NON_BLOCKING | 기록 — plan 이 선택한 변이 ①② 밖 |
| D3 | 해제 뒤 재시도/부팅이 실패하는 분기의 `cancelled` 가드(M9)가 잠기지 않는다 | AC5 의 실패 분기 — production 코드에는 가드 존재 | NON_BLOCKING | 기록 — 다음에 이 파일을 만질 때 케이스 1개 추가 후보 |
| D4 | plan 메타만 바꾼 `553ab87` 이 구현 trailer(`Status: implemented`·`Criteria-*`)를 실었다 | 커밋 프로토콜 | NON_BLOCKING | 기록 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(최초 검증). r1.2 의 레지스트리 누락은 구현 턴 안에서 이미 닫혔다.
- 관련 plan 지침/AC: §7-A gate 가 vitest 를 수정 디렉토리로 한정했다 — 저장소 전역 위생 스위트가 범위 밖이었다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: better-sqlite3 ABI(Node 재빌드 필요) · electron 바이너리 미설치(`ELECTRON_OVERRIDE_DIST_PATH` 로 우회).

## 15. 결론

- 상태: **PASS** (기계 범위)
- pair 결과: REQUIRED 5 PASS(VP-01 은 기계 범위) · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision: D-001~D-005 충족(D-001 의 실기는 AC6)
- AC 충족: ✅5 · ⚠️1 · ❌0
- 현재 변경 운영 gate: lint·typecheck·vitest 전체·doc-inventory·trailer 전부 PASS
- NON_BLOCKING: D1~D4
- 남은 사람 확인: AC6 Windows 설치본 재시작 실기
- 다음 단계: 사람 실기 뒤 INDEX 행 archive 이동
