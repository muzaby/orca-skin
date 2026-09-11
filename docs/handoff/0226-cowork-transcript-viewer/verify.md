# Verify — 0226-cowork-transcript-viewer

## 메타

| 항목 | 값 |
|---|---|
| slug | `0226-cowork-transcript-viewer` |
| 검증자 | Claude Code |
| 일자 | 2026-09-10 |
| 대상 커밋/range | `69f94b7`(ΔV8 설계) · `b5583ed`·`bf2f17f`·`b03c1d2`(r7 구현) — range `69f94b7..b03c1d2` |
| 구현 전 plan 기준 | `69f94b7` (`feedback-plan-r7.md` READY 시점 — 현재는 [plan.md](plan.md) §19로 병합) |
| V mode / 유효 V | Baseline V1 + ΔV2~ΔV7 + **ΔV8**(이번 라운드 판정 범위) |
| 검증 기준 plan revision | `69f94b7:feedback-plan-r7.md` (D-37~39 · AC43~45 · VP83~88 · EP35~37) |
| 라운드 | 7 (구현) · **검증 1회차** |
| 상태 | **PASS** (ΔV8 pair 6 + 현재 변경 gate) |
| 자기 검증 여부 | 아니다 — 구현자 Codex, 검증자 Claude Code. 그럼에도 구현 보고에 없는 축 4건(native 소거 변이 2 · CI 기준선 재현 1 · Temp root 정션 probe 1)을 추가했다 |

**판정 범위 경고.** 이 문서는 **ΔV8만 독립 검증**한다. r1~r6은 검증 없이 "독립 verify pending 승계"로만
이어졌고, 각 Delta가 선행 pair를 `NOT_REQUIRED`로 선언했으므로 VP1~VP82는 이번 라운드에서 pair 단위로
닫지 않았다. 대신 전체 스위트·전체 gate를 재실행해 회귀 표면만 확인했다. **VP1~VP82의 제품 의도·시각
계약은 여전히 독립 검증되지 않은 상태다**(D5).

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **아니다.** `plan.md`는 설계 커밋 `69f94b7`에서 V mode 줄 1행만 바뀌었다(ΔV8 추가).
- 기준선이 diff로 성립하는가: **예.** 설계 `69f94b7`와 구현 `b5583ed` 이후가 갈려 있어 §0 자기 증명 방지 장치가 작동한다.
- Decision Ledger 변경: 없음. D-37~39는 설계 커밋에서 신설했고 구현 커밋은 손대지 않았다.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. AC43~45 원문이 설계 커밋 그대로다.
- V node/pair·requiredness·§10·oracle 변경: 없음. 구현 커밋의 문서 변경은 `impl-r7.md`·INDEX·`[구현자 기입]` 절뿐이다.
- 채점에 사용할 원 기준: `69f94b7`의 AC43~45 · VP83~88 · EP35~37.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 `cdc8175b`(r6)와 적용 순서가 적혀 유효 V 재구성이 된다 |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R43~45·AR11·MD11 전부 같은 레벨 REQUIRED pair를 갖는다 |
| 영향 INHERITED ↔ REGRESSION pair | 유효 | VP88이 R18·38 및 기존 게시/카탈로그 회귀를 잡는다 |
| pair별 path·§10 전수·직접 oracle | 유효 | 세 EP(3+5+4=12)와 각 pair의 production path가 코드에 실재한다 |
| 선택적 적대 증거·선택 이유 | 유효 | "실제 반환값·파일·DB·DOM 직접 관측"이라 변이 미선택이 정합하다 |
| 현재 변경 산출물의 gate·범위 | 유효 | 영향 Vitest·전체 Vitest·타입·ESLint/Prettier·native·build·inventory/budget/whitespace |

- V 도입 전 plan 여부: 해당 없음.
- root PLAN_GAP과 영향 pair: **없음.**
- 다만 node ID `MD11`이 ΔV6 VP76과 ΔV8 VP86에서 각각 NEW로 선언돼 같은 이름이 다른 모듈을 가리킨다 → D3(NON_BLOCKING).

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-37 | 프로젝트·스킬·MCP 상단 추가 버튼이 엔진 추가와 같은 토큰 | `ProjectsScreen.tsx:69` · `ExtensionsCatalogView.tsx:115` → 공통 `Button(primary/small/plus)` |
| D-38 | cwd/add-dir 밖의 OS Temp 파일을 게시 입력으로 허용 | tool handler → `ArtifactService.publish` → `readArtifactInput`(files.ts:129~143) |
| D-39 | 현재 CI의 4 suite 10 실패를 현재 계약으로 보정 | 네 테스트 파일의 기대값·mock을 현재 production 동작에 맞춤 |

### end-to-end 흐름 (D-38)

```text
모델의 publish_artifact 호출
  → tool.ts handler (cwd·extraDirs 주입)
  → service.publish → readArtifactInput
  → cwd/extraDirs 실체 확인 → 미포함이면 OS Temp root 실체·containment 확인
  → readStableFile → candidate·root 읽기 후 재검사
  → validateArtifactBytes → ArtifactFiles.prepare(관리 사본) → createPublication(세션 참조)
  → 영수증 {type, version, publicationId} + artifact.published 알림
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 정합 | Temp 부재는 `ENOENT/ENOTDIR → unsafe-path`, 읽기 중 교체는 `file-changed` |
| false success 가능성 | 없음(관측 범위 내) | M8(Temp 분기 무력화)에서 tool 통합 테스트가 red — 성공 경로가 실제 분기에 의존한다 |
| partial failure/rollback | 유지 | `prepare`의 `cleanup`·transaction 경계를 r7이 건드리지 않았다 |
| A가 아닌 B를 구현했는가 | 아니다 | 허용 확대가 게시 입력 1곳(`service.ts:202`)에만 걸린다 |
| 증상만 제거했는가 | 아니다 | 테스트 3건은 기대값 보정이고, 게시 실패는 원인(허용 root 누락)을 고쳤다 |
| 최적화가 잃은 재검증 | 없음 | Temp root도 읽기 후 `finalRoots` 재검사 분모에 들어간다(M2·M4가 red) |
| 요청/출력 worst-case 상한 | 불변 | 5 MiB 상한·`readStableFile` 경계가 그대로다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 69f94b7..b03c1d2
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 없음 | 값 export 후보 0, 타입 `PreparedArtifactFile`은 같은 파일 시그니처용 |
| 테스트 전용 참조 | 없음 | `readArtifactInput`의 production 소비처는 `service.ts:202` 단 1곳 |
| 형제 정책 비대칭 | **결함 후보** | 게시는 Temp root를 `realpath`만, 일반 출력은 `unredirectedDirectory`로 검사 → D1 |
| 신규 등록값의 기존 소비처 | 무영향 | 새 상수·레지스트리 값 없음 |
| producer ↔ consumer 파생 | 일치 | tool 설명 문구가 실제 허용 범위(OS Temp와 하위)와 같다 |
| 동일 규칙 중복 구현 | SSOT 유지 | Temp 경로는 `infra/config/temp-path.ts` 한 곳에서 온다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 4 suite 실존: 확인. `files.contextDirectory`·`attachments`·`composerRequirementWiring`·`workPanelSections`.
- 핵심 분기 실제 실행: 확인. Temp 정상 입력·형제·정션·비디렉터리·읽기 후 교체 5경로가 실행된다.
- structural proxy만으로 통과한 AC: 없음. 버튼은 클래스 존재가 아니라 실제 computed style을 비교한다.
- 선택된 적대 증거 재측정: plan이 변이를 선택하지 않았으므로 등록 변이 0. **검증자가 8종을 신설해 6 red · 2 green(green의 의미는 아래)**.
- 이전 라운드 대조: 이전 verify 라운드가 없어 red→green 덮개 회귀 판정 대상이 없다.
- 자기검증 분모: 구현자 ≠ 검증자. 그래도 보고에 없는 축 4건을 더했다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — Temp root의 `containsPath` 제거 | input-files | 미실행 | **red**(형제·정션 케이스) | VP86 신설 변이 |
| M2 — `finalRoots`를 `[cwd,...extraDirs]`로 되돌림 | input-files | 미실행 | **red**(root 사후 교체) | VP86 신설 변이 |
| M3 — Temp root `isDirectory` 검사 제거 | input-files | 미실행 | **red**(파일을 root로) | VP86 신설 변이 |
| M4 — Temp root를 사후 재검사 분모에서 제외 | input-files | 미실행 | **red** | 검증자 신설 축 |
| M7 — `containsPath` → `startsWith` 접두 비교 | input-files | 미실행 | **red**(`tmp-sibling`) | 판정 기준 엄격화 |
| M8 — Temp 분기 전체를 `unsafe-path`로 | service | 미실행 | **red**(tool 통합 2건) | VP85 신설 변이 |
| M9a·M9b — 두 버튼의 `variant`/`leadingIcon` 되돌림 | projects·skills unit | 미실행 | **green** | 단위 테스트에 잠금 없음 → D4 |
| N1 — 같은 되돌림 + native 재실행 | native fixture | 미실행 | **red**(12 check false) | VP83 실제 잠금 |
| N2 — 플러그인 버튼 되돌림 + native 재실행 | native fixture | 미실행 | **red**(6 check false 후 중단) | VP83 두 번째 지점 |

- 동작 보존 추출 라운드인가: 아니다. 동작 변경 라운드다.
- 소거 변이 잔여물 수렴: 해당 없음. red가 모두 단언 실패이지 진단 부산물이 아니다.
- 형제 슬롯 맞바꿈: N2가 스킬↔MCP 두 슬롯을 공유하는 한 버튼을 바꿔 두 표면이 함께 red가 된다.
- `N회` 기준: 해당 없음.
- 순서 기준: 해당 없음.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP86 | MD11 ↔ UT11 / UT | REQUIRED | **PASS** | `input-files.test.ts` 8건(win32 1 skip) + M1~M4·M7 red | files.ts:117~148 / EP36 3지점 |
| VP85 | AR11 ↔ IT11 / IT | REQUIRED | **PASS** | `service.test.ts` 실제 tool handler + SQLite, M8 red | tool.ts → service.ts:202 / EP36 2지점 |
| VP84 | R44 ↔ AT44 / AT | REQUIRED | **PASS** | Temp 직속·하위 게시, 원본 보존, 타 세션 `forbidden` | 게시 전 경로 / EP36 5/5 |
| VP83 | R43 ↔ AT43 / AT | REQUIRED | **PASS** | native 재실행 228/228 + N1·N2 red | 두 화면 상단 Button / EP35 3/3 |
| VP87 | R45 ↔ AT45 / AT | REQUIRED | **PASS** | r6 기준선에서 7 실패 재현 → 현재 50/50 · Windows CI success | 네 suite / EP37 4/4 |
| VP88 | INHERITED R18·38 ↔ AT18·38 / REGRESSION | REGRESSION | **PASS** | 전체 Vitest 4491 pass·0 fail, artifacts 8파일 73 pass | 일반 출력·게시 경계 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: native 1회 실행이 VP83의 세 표면을 닫는다. 판정 범위는 style·아이콘·메뉴/모달·키보드까지다.
- 이번 라운드 실행 범위: **ΔV8의 REQUIRED/REGRESSION 전건 + 현재 변경 gate 전건**. VP1~VP82는 각 Delta가 `NOT_REQUIRED`로 선언한 승계분이며 이번 라운드는 전체 스위트로 회귀 표면만 봤다.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT43 / AC43 | 세 상단 추가 버튼이 엔진 버튼과 같은 primary/small/plus | ✅ | native 228/228(두 테마·두 폭), N1·N2 red | 두 컴포넌트 → 공통 Button |
| AT44 / AC44 | cwd/add-dir 밖 실제 Temp 파일 게시, 형제·탈출 정션 거부 | ✅ | input-files 8건·service tool 통합 1건, M1~M8 | tool → service → files |
| AT45 / AC45 | CI 10 실패를 현재 계약으로 보정 | ✅ | r6 기준선 7/10 로컬 재현, 현재 50/50, Windows CI success | 네 테스트 파일 |

- **합계 재측정**: `✅ 3 · ⚠️ 0 · ❌ 0 = 총 3`. 자기보고 3/3과 **일치**.
- **합계 사본 대조**: 본문 3 ↔ `b03c1d2` trailer `Criteria-Met: 3/3` ↔ INDEX 비고 "AC43~45 자기확인 3/3" — **일치**.
- AC44의 Windows 짧은 경로 케이스는 Linux에서 skip이다. 같은 앱 트리의 Windows CI(run 34487744739)가 실행했다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약 | plan이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP83 | EP35 상단 추가 버튼 | 프로젝트·스킬·MCP (3) | 3/3 — 코드 지점은 2곳이고 `ExtensionsCatalogView` 한 버튼이 스킬·MCP 두 탭을 맡는다 | PASS |
| VP84~86 | EP36 Temp 게시 | root 해석·candidate 경계·stable read와 후검사·서비스 사본/세션·tool 입력/영수증 (5) | 5/5 — files.ts:131·139·144~148, service.ts:202~215, tool.ts:66 | PASS |
| VP87 | EP37 CI 보정 | 네 suite (4) | 4/4 — 각 파일에서 실패 원인과 수정 지점이 1:1 | PASS |

- 표 밖인데 같은 불변식이 필요한 지점: Temp root 자체가 정션일 때의 검사(→ D1, NON_BLOCKING). AC44 문구는 "Temp 밖 형제 및 **외부로 나가는** 정션"이라 root 재지정은 계약 위반이 아니다.
- "다른 게이트가 막는다"고 적은 행: 없음.
- 독립 재열거 합계 **12/12** — 자기보고(3/3·5/5·4/4)와 일치.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 결과 | 증거 / 범위 |
|---|---|---|---|
| typecheck (node·web·test) | main·renderer·테스트 타입 변경 | **PASS** | 3개 프로젝트, 진단 0줄 |
| ESLint 읽기 전용 | 변경 TS/TSX 10파일 | **PASS** | `--no-fix --max-warnings=0`, 출력 0줄, 트리 무변경 |
| 전체 Vitest (`npm test`) | DB·실파일 스위트 포함 | **PASS** | 477파일(476 pass·1 skip) / 4494 케이스(4491 pass·3 skip·0 fail) |
| Node script tests | 운영 스크립트 회귀 | **PASS** | 116/116 |
| doc inventory | `docs/arch` 2파일 수정 | **PASS** | 9 items·92 channels, 상대 링크 전건 해석 |
| migration append-only | DB 변경 없음 확인 | **PASS** | 26 migrations, dir == imports |
| test budget | 실-git 스위트 | **PASS** | 11 suites ok |
| electron-vite build | 렌더러·main 변경 | **PASS** | main·preload·renderer 산출, 기존 dynamic-import 경고 1건만 유지 |
| native UI (Electron) | 버튼 시각 계약 | **PASS** | 검증자 재실행 228/228 checks·28 screenshot·error·blocked·console 0 |
| diff whitespace | 산출물 | **PASS** | `git diff --check` 0 |
| 메시지 버스 | 설계/구현 커밋 분리·trailer | **PASS** | §11 참조 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `publish_artifact` tool 설명 | 스키마 변경 없음 | 설명이 실제 허용 범위(cwd·extraDirs·OS Temp와 하위)와 일치 | PASS |
| `docs/arch/backend/persistence.md` | — | 게시 입력 Temp 허용·resolver 출처 서술이 코드와 일치 | PASS |
| `docs/arch/backend/security.md` | — | 정션 거부·읽기 전후 root 재검사 서술이 M1·M2 관측과 일치 | PASS |
| IPC 계약 | 변경 없음 | 새 채널·DTO 없음 | 해당 없음 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 전체 Vitest: 본인 측정 **4491 pass·3 skip**. 보고는 4493 pass·1 skip이며 차이 2는 `it.runIf(win32)` 2건(`files.test.ts`·`input-files.test.ts`)이다. Windows에서 두 건이 실행되면 보고값과 같아진다 — **불일치 아님**.
- 파일 수: 477(=476 pass + 1 skip). `artifact-sdk-live.test.ts`가 `ORCA_ARTIFACT_LIVE` 미설정으로 파일째 skip이다.
- Node script tests: 116/116 — 보고와 일치. CI 로그도 `# pass 116`.
- CI 기준선 10 실패의 내역 합: 로컬에서 **7 재현**(composerRequirementWiring 6 + workPanelSections 1), 나머지 3(files.contextDirectory 1 + attachments 2)은 Windows canonical 경로 케이스다. 합 10 = 보고 내역과 일치.
- native check 수: 228 — 검증자 재실행 결과와 키 집합까지 동일(차집합 0).
- §10 전수: 12 — 독립 재열거 일치.
- artifacts 스위트: 8파일 73 pass·2 skip. 보고의 "영향 7파일 71/71"은 파일 선택 목록이 없어 그대로 재현하지 못했다 — 본인 측정값을 남긴다.
- 상한: 게시 5 MiB·일반 출력 상한 불변.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 버튼 시각 | Linux/Xvfb에서 production CSS·computed style 228 단언 재실행 | Windows 실물 창의 색·간격 인상 | Windows 빌드에서 프로젝트·플러그인 페이지 상단 버튼 확인 |
| Temp 게시 | 실파일·실 SQLite·실 tool handler 경로 | Windows `%LOCALAPPDATA%\Temp` 실제 게시 | Work 세션에서 Temp에 파일 생성 후 게시 요청 |
| Windows 짧은 경로 | CI(run 34487744739)가 실행 | 실사용 환경의 8.3 비활성 볼륨 | 필요 시 8.3 비활성 볼륨에서 게시 |
| r1~r6 UX 계약 | 전체 스위트 회귀만 | 화면 흐름 전반 | 아래 D5 참조 |

## 9. 게이트 재실행

- 실제 실행 명령:
  - `cd app && npm ci` → `npm test`(pretest가 better-sqlite3를 Node ABI로 전환)
  - `npm run typecheck` · `./node_modules/.bin/eslint --no-fix --max-warnings=0 <변경 10파일>`
  - `node scripts/check-doc-inventory.mjs --check` · `check-migrations-appendonly.mjs` · `check-test-budgets.mjs`
  - `npm run build`(prebuild가 Electron ABI 복원)
  - `node docs/.../r7-button-native-build.mjs` → `xvfb-run -a ./node_modules/.bin/electron .../r7-button-native-runner.cjs <cache> --no-sandbox`
- 관측한 실행 산출(exit code 아님): Vitest 477파일·4494케이스, script 116케이스, tsc 진단 0, ESLint 출력 0줄, native 228 check.
- `npm test`를 쓴 이유: `service.test.ts`가 실제 SQLite로 게시·소유권을 검증하므로 DB 실행이 필요하다. egress가 열려 있어 ABI 전환이 성공했다.
- 환경 기인 실패 분리: 해당 없음 — ABI·403 실패가 0이다.
- 게이트가 작업 트리를 바꿨는가: 없음. ESLint는 `--no-fix`로 돌렸고 매 변이 실험 후 `git status`가 비었다.
- 검증 중 실행한 명령의 잔여물: `app/out/`, `app/node_modules/.cache/orca/*` — 둘 다 `.gitignore` 대상이라 추적 트리에 남지 않는다.
- native 실행 차이: 검증자는 root 컨테이너라 `--no-sandbox`가 필요했고, 스타일시트를 fixture가 직접 컴파일했다(구현자는 `app/out`의 최종 CSS 사용). 체크 키 집합과 결과는 동일하다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 전건 PASS |
| AC ↔ production path | 1:1 대조 + 변이 | — | AC43~45 충족 |
| 레이어/문서 형식·링크 | inventory·budget·migration guard | — | PASS |
| AGENTS 위생 | 해당 변경 없음 | — | 해당 없음 |
| 제품 의도 / Open Question | 보조 | **결정** | 0223 Q-04는 이번 범위 밖 유지 |
| UI 시각 품질 | Linux native 재현 | **Windows 실기** | 대기 |
| 신규 의존성 / merge | 없음 확인 | **승인** | 대기 |

## 11. Repository operation checks

### INDEX 보드 정합성

- 상태·다음 주체·라운드: 이번 검증으로 `verify/PASS`·다음 주체 사람·라운드 7로 갱신했다.
- 대상 커밋 좌표: 검증자가 기입했다. `69f94b7`(ΔV8 설계) · `b5583ed`·`bf2f17f`·`b03c1d2`(r7) — `git cat-file -t` 전건 commit.
- 비고 5줄 이내: 유지.
- PASS 시 archive 이동: **하지 않는다.** 사람 실기와 r1~r6 미검증분(D5)이 남아 보드에 둔다(0224·0225 선례).

### Commit / reference 정합성

- trailer 허용값: 4커밋 모두 `Agent: codex` + 허용 `Status`. 설계 커밋에 `Criteria-*`·`Next-Action`이 없다 — 규약대로다.
- trailer 파싱: `git log -1 --format='%(trailers:only=true)'`가 4커밋에서 적힌 키를 그대로 돌려준다(0건 없음).
- 인용 해시 실재: `a89e6f89`·`fde5557d`·`5e53f4a5`·`73ac30a0`·`c02610ba`·`769cd454`·`b727adbb`·`cdc8175b`·`75322377` 전건 commit. **단 이들은 `origin/codex-cowork-transcript-viewer`에만 있고 `main`에는 내용만 같은 다른 SHA로 들어왔다** → D3.
- `[구현자 기입]` 7필드: `impl-r7.md`에 설계 리뷰·강제 지점 전수·이번 라운드 잠금·Product/UX 파생·놓친 잠재 문제·구현 보고·Review Signals **7/7** 존재. 산문으로 접힌 필드 0.
- reference/script: 이동·삭제 없음. `evidence/` 신규 파일의 상대 링크는 doc inventory가 전건 해석했다.
- CI 증거 대조(1차 출처): run **34487744739** = success, head `75322377`. 그 트리의 `app/`은 현재 HEAD와 **차이 0**. run **34465282903** = failure, head `cdc8175b`(r6). 둘 다 GitHub API로 직접 확인했다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "기존 service 테스트가 Temp를 extraDirs에 명시해 결함을 가렸다" | 타당 | 해당 hunk 확인. 보조 권한 제거 후 M8이 red가 된다 |
| "동기/비동기 realpath가 Windows 짧은 경로에서 다르다" | 타당 | 기대값이 production과 같은 async canonical을 쓴다 |
| "Temp를 무조건 root에 더하면 Temp 없는 환경의 cwd 게시가 깨진다" | 타당 | `keeps cwd and explicit directories usable when Temp does not exist`가 이를 잠근다 |
| "native hover 150ms 고정 대기를 Animation.finished로 보정" | 타당, 제품 코드 무변경 | 검증자 재실행도 같은 fixture로 228/228 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | Temp root **자체**가 정션이면 그 대상 폴더 전체가 게시 입력이 된다. 일반 출력은 같은 root를 `unredirectedDirectory`로 거부한다 | 비귀속(AC44는 "외부로 나가는" 정션만 거부) | NON_BLOCKING | — | 게시 root도 `unredirectedDirectory`로 맞추는 안을 다음 handoff 후보로 |
| D2 | 프로젝트 empty CTA 버튼만 `variant` 없이 남는다 | 설계가 명시 제외 | NON_BLOCKING | — | 기록만 |
| D3 | plan·impl이 인용한 기준선 해시가 `codex-cowork-transcript-viewer`에만 있다. 브랜치 삭제 시 다음 라운드 기준선이 끊긴다 | 운영 | NON_BLOCKING | — | 이후 문서는 `main` 좌표를 함께 적는다 |
| D4 | AC43의 기계 잠금은 native fixture뿐이다. 단위 테스트 되돌림(M9a·M9b)은 green | VP83의 선언된 oracle과 정합 | NON_BLOCKING | — | 버튼 계약 변경 라운드는 native 재실행이 필수 |
| D5 | r1~r6이 독립 검증 없이 승계됐다. `composerRequirementWiring` 6실패는 **r2(`b23d254`)**가 도입한 `useChatResponding` mock 누락이고 r6까지 red였다 | 운영 | NON_BLOCKING | — | 후속 라운드는 영향 스위트가 아니라 전체 Vitest를 gate로 |
| D6 | node ID `MD11`이 ΔV6 VP76·ΔV8 VP86에 중복 배정됐다 | 추적 | NON_BLOCKING | — | 다음 Delta에서 번호 재부여 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 이전 verify 라운드가 없다. 다만 CI red 보정이 D-34(r5)·D-39(r7) 두 번 반복됐다.
- 관련 plan 지침/AC의 존재: 있다. 각 Delta가 "영향 Vitest"를 gate로 적었고 전체 Vitest는 r7에서야 gate에 들어왔다.
- 사용자 결정 변경 근거: D-37~39 모두 사용자 명시 요구 인용이 있다.
- 반복된 검증 환경 한계: Windows 전용 케이스 2건은 Linux에서 실행 불가라 CI 결과에 의존한다.
- 사실 추가: 전체 스위트 red가 r2부터 r6까지 유지됐고, 각 라운드 보고는 영향 스위트 통과만 근거로 삼았다.

## 15. 결론

- 상태: **PASS** — ΔV8 범위.
- pair 결과: REQUIRED 5 PASS(VP83~87) · REGRESSION 1 PASS(VP88) · root PAIR_FAIL 0 · BLOCKED_BY 0.
- PLAN_GAP: 없음.
- Product/UX 및 ACTIVE Decision 충족: D-37·38·39 충족. 선행 ACTIVE 결정과의 충돌 0.
- AC 충족: ✅ 3 · ⚠️ 0 · ❌ 0 (AC43~45).
- 현재 변경 운영 gate: 11종 전건 PASS. 관측 산출은 §5·§9에 있다.
- NON_BLOCKING: D1~D6.
- repository operation checks: trailer·해시·INDEX·문서 링크 전건 확인. INDEX 좌표는 검증자가 기입했다.
- 남은 사람 확인: Windows 실기 2건(Temp 게시·버튼 시각)과 r1~r6 UX 계약.
- 다음 단계: 사람 실기 후 archive 이동. r1~r6의 독립 검증이 필요하면 별도 handoff로 연다.
