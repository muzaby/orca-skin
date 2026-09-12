# Verify — 0230-temp-scope

## 메타

| 항목 | 값 |
|---|---|
| slug | `0230-temp-scope` |
| 검증자 | Claude Code |
| 일자 | 2026-09-13 |
| 대상 커밋/range | `b57e392..53f7602` (구현 `53f7602`) |
| 구현 전 plan 기준 | `b57e392` (V2 설계) · 최초 설계 `3c23097` |
| V mode / 유효 V | Baseline V: V1 + V2 설계 정정 |
| 검증 기준 plan revision | `b57e392:V2` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다 — 설계·구현 Codex, 검증 Claude Code. §4의 자기검증 분모 규칙은 적용 대상이 아니다. |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예. `git show 53f7602 -- docs/handoff/0230-temp-scope/plan.md` = 3 hunk — 메타 `상태` 1줄, §10 표 뒤 빈 줄 1줄 삭제, `[구현자 기입]` 135줄 추가.
- **기준선이 diff로 성립하는가**: 예. 규범 행(Decision·AC·V node/pair·§10)은 설계 커밋 `3c23097`·`b57e392`에만 있고 구현 커밋에 없다.
- Decision Ledger 변경: 없음 (`D-01`~`D-06` 전건 설계 커밋 소유).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. AC1~AC6 원문은 `b57e392:docs/handoff/0230-temp-scope/plan.md §7`.
- V node/pair·requiredness·§10·oracle 변경: 없음. VP-01~VP-10 REQUIRED, EP-01~EP-06.
- 채점에 사용할 원 기준: `b57e392`의 §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 상속 기준 없음 → Baseline. V2는 `b57e392`의 별도 설계 커밋으로 D-06·VP-10·EP-06만 증분 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~06↔AT, SD-01↔ST, AR-01/AR-02↔IT, MD-01↔UT 4레벨 전부 REQUIRED |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | 기존 동작 회귀를 AC5/VP-05로 명시 흡수, 암묵 `NOT_REQUIRED` 없음 |
| pair별 path·§10 전수·직접 oracle | 유효 | 각 pair가 EP 번호와 production path를 가짐, 분모 20 명시 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 전 pair `not selected` + 이유(실제 반환값·파일·옵션 직접 관측) |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §19가 `app/AGENTS.md` ABI 중립 절차를 지정 |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음.
- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-01 | 공통 루트 = `resolve(tmpdir(), 'orcinus-orca')` | `infra/config/temp-path.ts:8` + `shared/product.ts:PRODUCT_SLUG` |
| D-02 | Code·Work 모두 같은 루트가 SDK·가드에 | `adapters/claude.ts:447` 단일 배열 → `additionalDirectories` + `makeWorkspaceGuardHook` |
| D-03 | 첨부·일반 출력·artifact 입력이 같은 루트 | `attachment-files.ts:7` · `artifacts/files.ts:167,207` · `files.ts:131` |
| D-04 | 사용자 cwd·extraDirs는 불변 | `claude.ts:447` `[...req.extraDirs, tempRoot, ...outputFiles]` — 원본 배열 미수정 |
| D-05 | 작성 주체 Codex | plan 메타·커밋 trailer `Agent: codex` |
| D-06 | `CLAUDE_CODE_TMPDIR`를 앱 루트로 고정 | `claude-adapt.ts:130~163` env·settings 두 채널, `claude.ts:323`(completion)·`494`(conversation) |

### end-to-end 흐름

```text
사용자 전송 → handleChatSend
  → prepareTemporaryFilesPath() (send.ts:331, 턴당 1회)
  → adaptExecutionConfig(..., getTemporaryFilesPath())  → options.env + --settings env
  → additionalDirectories(단일 배열) → SDK 파일도구 + PreToolUse 가드
  → SDK가 CLAUDE_CODE_TMPDIR 아래에 task 출력 생성
  → attachment/output/artifact reader가 같은 루트에서 읽기·수집
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | `prepareTemporaryFilesPath`가 부모 lstat·realpath로 링크 부모를 거부하고 `EEXIST`만 무시한다(`temp-path.ts:16,32`) |
| false success 가능성 | 없음 | mkdir 뒤 `plainDirectory`를 다시 통과시켜 realpath를 반환한다 |
| partial failure/rollback | 해당 없음 | 다중 저장소 쓰기 없음. 실패는 기존 턴 오류 경로로 전파 |
| Product/UX의 A가 아닌 B | 아니다 | 요구는 "자동 허용 범위 축소"이고 구현은 그 범위만 바꾼다. OS `TEMP/TMP/TMPDIR`·ACL·기존 파일 미변경 |
| 증상만 제거했는가 | 아니다 | 경로 상수가 아니라 `PRODUCT_SLUG` 자식으로 실제 루트를 옮겼다 |
| 최적화가 잃은 관측 | 없음 | 캐시·스캔 추가 없음 |
| 출력/요청 worst-case 상한 | 불변 | 첨부 32MiB·출력 상한 기존 값 유지 |
| **신규 관측** | NON_BLOCKING | `withHostTemporaryRoot(options.env ?? process.env, …)`가 준비된 env가 없을 때 `process.env`를 **명시 스냅샷**으로 복사한다. 이전에는 옵션 생략으로 SDK가 상속했다 — 조립 이후의 env 변경은 이번 query에 반영되지 않는다(D1) |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh b57e392..53f7602
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export (값·타입) | 0건 | 스크립트 출력 "(없음)" |
| 테스트 전용 참조 6건 | 정상 (오탐) | `adaptSettingSources`·`extractCompactSummary`·`makeClaudeHookCallback`·`toClaudeHookOutput`·`toContext`·`buildTurnContent` — 전부 **정의 파일 내부**에서 소비된다(스크립트가 정의 파일을 분모에서 제외). 예: `adaptSettingSources`는 `claude-adapt.ts:124`의 `adaptExecutionConfig`가 호출 |
| 형제 정책 비대칭 | 0건 | 스크립트 출력 "(없음)" |
| 신규 등록값의 기존 소비처 | 무영향 | `getTemporaryFilesPath` 소비처 전수 재측정 = production 7좌표(§7) |
| producer ↔ consumer 파생 불일치 | 없음 | 프롬프트 문구(`profiles.ts`·`send.ts`·`tool.ts`)와 실제 경로가 같은 `orcinus-orca` |
| 동일 규칙 중복 구현 | **1건, NON_BLOCKING** | 앱 임시 루트 생성이 세 곳에 있고 mode가 갈린다 — `temp-path.ts:30` `mkdir(mode:0o700)` ↔ `attachment-files.ts:prepareDirectory`·`files.ts:prepareOutputDirectory`의 `mkdir(recursive:true)`(기본 mode). 먼저 실행된 쪽이 mode를 정한다(D2) |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: 예. `temp-directory.test.ts`(3케이스)·`claude.extra-dirs.test.ts`(5)·`attachments.test.ts`·`input-files.test.ts`·`claude-adapt.test.ts`·`claude.executable-option.test.ts` 전건 실재.
- 핵심 입력/분기가 실제 실행됨: 예. `temp-directory.test.ts:17`은 `getTemporaryFilesPath()`의 실제 반환을 `resolve(tmpdir(), PRODUCT_SLUG)`와 비교하고, 주입 루트·junction 거부를 실제 파일시스템으로 판정한다.
- structural proxy만으로 통과시킨 AC: 없음. EP-05의 8-anchor 문서 probe만 문자열 검사이며 검증자가 §7에서 독립 재열거했다.
- **선택된 적대 증거 재측정** — 구현자 `이번 라운드 수정의 잠금` 4행 + 검증자 신설 2행 = 6건 중 검출 **6** · 미검출 **0** · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이므로 해당 없음.
- **자기검증 분모**: 해당 없음(구현자 ≠ 검증자). 그럼에도 구현 보고에 이름이 없던 축 2건(M-1·M-2)을 추가했다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-1 — `temp-path.ts:9`에서 `PRODUCT_SLUG` 인자 제거 | artifacts·attachments·extra-dirs·adapt 11파일 | 미실행 | **red** (3파일 8케이스) | 검증자 신설 · VP-01/03/09 |
| M-2 — `claude.ts:447`의 `getTemporaryFilesPath()` 항목 삭제 | claude.extra-dirs | 미실행 | **red** (3케이스) | 검증자 신설 · VP-02/08 |
| M-3 — conversation `adaptExecutionConfig`의 3번째 인자 제거 | executable-option·adapt·extra-dirs | 구현자 red | **red** (10케이스) | `VP-10 등록 변이`(Work query SDK tmp) |
| M-19 — completion `adaptExecutionConfig`의 3번째 인자 제거 | executable-option | 구현자 red | **red** (5케이스) | `VP-10 등록 변이`(Code query SDK tmp) |
| M-4 — alias 제거를 `toUpperCase()` 없이 정확 일치로 약화 | adapt·executable-option | 구현자 red | **red** (4케이스) | `D-06/EP-06 등록 변이`(대소문자 alias) |
| — settings/process env 권위 | adapt | 구현자 red | **red** — M-3·M-4가 `pins the host temp root in both channels without changing inherited OS temp or caller settings`를 함께 깬다 | `D-06/EP-06 등록 변이` |

- 동작 보존 추출 라운드인가: 아니오.
- 소거 변이의 잔여물 수렴: 해당 없음 — 6변이 모두 동작 단언에서 red이며 타입/lint 부산물에 기대지 않는다.
- 형제 슬롯 맞바꿈 변이: 해당 없음 — 이번 변경에 서로 다른 계약의 형제 슬롯이 없다.
- `N회` 기준의 실제 관측 주체: `chat-turn.runtime-tools.test.ts:351` `expect(tempPath.prepare).toHaveBeenCalledTimes(1)` — 주입 경계에서 실제 호출 횟수를 센다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-09 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | `temp-directory.test.ts` 3케이스 — 반환값·주입 루트·junction 부모 거부. M-1 red | temp-path → 경로 판정 / EP-01·03·04 |
| VP-08 | AR-01 ↔ IT-01 / IT | REQUIRED | **PASS** | `claude.extra-dirs.test.ts` "참조가 동일하다 — 값 복사본이 아니다". M-2 red | query 옵션 ↔ guard 훅 동일 객체 / EP-02 |
| VP-10 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | `claude.executable-option.test.ts` "pins SDK internal temp for code/work and completion". M-3·M-19·M-4 red | env·settings 두 채널 / EP-06 |
| VP-07 | SD-01 ↔ ST-01 / ST | REQUIRED | **PASS** | `attachments.test.ts` 실제 파일 복사 + `files.test.ts`/`input-files.test.ts` 수집·재읽기 | 턴 준비 → 파일 생성 → 수집 / EP-02~04 |
| VP-01~06 | R-01~06 ↔ AT-01~06 / AT | REQUIRED | **PASS** | 아래 AC 표 | §7 각 행 / EP-01~06 |
| VP-05 | (AC5 회귀) / AT | REQUIRED | **PASS** | adapters 관련 회귀 전건 통과, 전체 스위트 실패 0 | extraDirs 불변 / EP-02 |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: `claude.extra-dirs.test.ts`가 VP-02(AT)와 VP-08(IT)을 닫는다 — AT는 "부모·형제 자동 허용 안 됨"의 행동, IT는 배열 참조 동일성이라 판정 범위가 다르다.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED 10 pair 전건 + 운영 gate 전건.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 공통 루트가 OS 임시 폴더 아래 정확히 `orcinus-orca` | ✅ | `temp-directory.test.ts:17` 실제 반환 = `resolve(tmpdir(),PRODUCT_SLUG)`; `product.ts:15` 값 확인 | temp-path → 전 소비처 |
| AT-02 / AC2 | Code·Work 모두 rw, 부모·형제는 자동 허용 안 됨 | ✅ | `claude.extra-dirs.test.ts` "Code 요청도 앱 임시 루트를 공유 배열로 자동 허용한다" + "OS Temp 부모와 형제는 자동 허용하지 않는다" | claude.ts:447 배열 → 옵션·훅 |
| AT-03 / AC3 | 첨부·완성 파일이 새 루트에서 읽기·저장·수집 | ✅ | `attachments.test.ts` "stores attachments in the product child…" 실제 파일 I/O | attachment-files·files.ts |
| AT-04 / AC4 | artifact 임시 입력은 앱 루트만 자동 허용 | ✅ | `input-files.test.ts` 앱 루트 성공 / 부모·형제·junction 거부 | files.ts:131 |
| AT-05 / AC5 | 사용자 cwd·extraDirs·파일 무결성 유지 | ✅ | `req.extraDirs` 원본 미수정(`claude.ts:445` 스프레드), 전체 스위트 실패 0 | turn extraDirs → guard |
| AT-06 / AC6 | 프롬프트·문서가 새 경로를 설명하고 작성자는 Codex | ✅ | 8지점 독립 재열거(§7) 전건 일치 | profiles·send·tool·docs |

- **합계 재측정**: `✅ 6 · ⚠️ 0 · ❌ 0 = 총 6`(분모는 §7의 AC1~AC6을 직접 셈). 자기보고 `6/6` — 일치.
- **합계 사본 대조**: 본문 6 ↔ 커밋 trailer `Criteria-Met: 6/6` ↔ INDEX 비고 "AC 6/6" — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01·07·09 | 공통 루트 반환·안전 준비 | EP-01 (2) | 2/2 — `temp-path.ts:8`·`:25` | PASS |
| VP-02·08 | Code·Work SDK/가드 | EP-02 (4) | 4/4 — 2 프로필 × (`additionalDirectories`·`makeWorkspaceGuardHook`) 단일 배열 | PASS |
| VP-03·07 | 첨부·출력 준비·재읽기 | EP-03 (3) | 3/3 — `attachment-files.ts:7`·`files.ts:167`·`files.ts:207` | PASS |
| VP-04·09 | artifact 임시 입력 fallback | EP-04 (1) | 1/1 — `files.ts:131` | PASS |
| VP-06 | 문구·문서·상태 사본 | EP-05 (8) | 8/8 — Work profile·turn prompt·artifact instructions·artifact description·persistence.md·workspace-isolation-permissions.md·plan·INDEX | PASS |
| VP-02·03·10 | SDK tmp env·settings 우선순위 | EP-06 (2) | 2/2 — `claude-adapt.ts:158`(env)·`:161`(settings.env) | PASS |

- 전수 합계 독립 재측정: `2+4+3+1+8+2 = 20`. 자기보고 20/20 — 일치.
- 표에 없는데 같은 불변식이 필요한 지점: **1건** — `getTemporaryFilesPath()`의 신규 소비처 `app/chat-turn/background.ts:46`(0231이 추가). 0230의 EP 분모 시점 이후 생긴 좌표라 0230 pair에 귀속하지 않는다(NON_BLOCKING, 0231 EP-09 범위).
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| typecheck | `app/src/main` 변경 | **PASS** | `npm run typecheck` — node/web/test 3구성, error 0 |
| lint | 같음 | **PASS** | `eslint --no-cache ./src ./scripts`(--fix 없이) — error 0 · warning 1(기존 `useTranscriptVirtualizer`) |
| 관련 Vitest | 경로·어댑터·첨부·artifact 변경 | **PASS** | 전체 `vitest run --maxWorkers=4` 510파일·4745케이스 통과, 실패 0 |
| 문서 gate | `docs/arch`·`docs/guides` 변경 | **PASS** | `check-doc-inventory.mjs --check` — 9 items·98 channels, 상대 링크 전건 해석 |
| 저장소/버스 | plan·INDEX·커밋 | **PASS** | `git diff --check` 통과, trailer 5키 파싱 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `Options.additionalDirectories: string[]` | typecheck 통과 | 값만 바뀌고 배열 identity 계약 유지 | PASS |
| SDK `Options.env` / `--settings` env | typecheck 통과 | `CLAUDE_CODE_TMPDIR` 단일 권위 키, 원본 객체·`process.env` 미변형 | PASS |
| 공개 IPC | 변경 없음 | — | 해당 없음 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `getTemporaryFilesPath` production 소비처 재측정: 7좌표(`background.ts:46`·`attachment-files.ts:7`·`files.ts:131,167,207`·`claude.ts:447` + 정의). 0230 EP 분모는 이 중 6좌표(§5 표).
- 내역 합 = 총계: `2+4+3+1+8+2 = 20` — 자기보고와 일치.
- 0건 게이트의 정당한 예외 보존: EP-05 문서 probe의 `missing=0`을 문자열 검색이 아니라 8지점 개별 확인으로 대체 측정했다.
- 총량 임계: 신설 없음.
- 출력/요청 상한: 변경 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 경로·권한·env 조립 | 전부 — 실제 파일시스템 fixture와 실제 query 옵션 | 없음 | — |
| 실제 SDK가 앱 루트에 출력 생성 | 구현자의 Windows loopback 실기(SDK 0.3.267·CLI 2.1.267) 기록을 읽었고, main reader 경로는 이 환경에서 재실행 | 없음(추가 확인 불요) | 증거: [`sdk-evidence.md`](../0231-background-task-conformance/sdk-evidence.md) |

## 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run typecheck` · `./node_modules/.bin/eslint --no-cache ./src ./scripts` · `./node_modules/.bin/vitest run --maxWorkers=4` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-test-budgets.mjs`.
- **관측한 실행 산출**: typecheck 3구성 error 0 · eslint error 0/warning 1 · vitest 510파일 4745케이스 통과(1 skip 파일·3 skip 케이스) · scripts 116케이스 통과 · inventory 9 items·98 channels · migrations 27 · budgets 11 suites.
- `npm test`를 썼는가: 아니다. `pretest`를 우회해 `./node_modules/.bin/vitest`를 직접 호출했다(`app/AGENTS.md` ABI 가이드).
- 환경 기인 실패 분리: 최초 전체 실행의 red 7파일은 전부 `Electron failed to install correctly`(import 시점). `node node_modules/electron/install.js`로 바이너리를 설치한 뒤 같은 7파일 28케이스 전건 통과 — 변경 무관 환경 실패였다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`는 `--fix`라 트리를 쓰므로 쓰지 않고 `eslint`를 직접 호출했다.
- **검증 중 남긴 잔여물**: 없음. 변이 6건은 `git checkout --`로 복원했고 임시 probe 2파일은 삭제했다. `git status --short` 공백.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 완료 |
| AC ↔ production path | 1:1 대조 + 변이 6건 | — | 완료 |
| 문서 형식·링크 | inventory gate | — | 완료 |
| 제품 의도 | — | 결정 | D-01 철자·범위는 이미 사용자 확정 |

## 11. Repository operation checks

### AGENTS.md 위생

- `AGENTS.md` 변경 없음 — 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 이번 턴에 `verify` / `PASS` / `3c23097`·`b57e392`(설계) · `53f7602`(r1)로 갱신.
- 「다음 주체」 칸: `—` 하나.
- 대상 커밋 좌표 기입: `git cat-file -t 53f7602` = `commit`, `b57e392`·`3c23097` 동일 확인.
- 비고 5줄 이내: 예.
- PASS 시 archive 이동: 완료 — `docs/archive/handoffs/INDEX-history.md`로 이동.

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Handoff: docs/handoff/0230-temp-scope/` · `Status: implemented` · `Criteria-Met: 6/6` · `Verified-By: pending` — root `AGENTS.md` 표와 일치.
- trailer 파싱: `git log -1 --format='%(trailers:only=true)' 53f7602` = 5키 전건 반환.
- 인용 커밋 해시 실재: `3c23097`·`b57e392`·`53f7602` 전건 `commit`.
- reference/script 이동·삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "설계 대비 차이 없음 — V1 이후 발견한 SDK 경로는 별도 설계 V2에 먼저 반영" | 타당 | `b57e392`가 구현 `53f7602`보다 앞선 별도 커밋임을 확인 |
| 놓친 문제 #1·#2 선조치(`CLAUDE_CODE_TMPDIR` 고정·alias 제거) | 구현 세부 보완 | D-06·EP-06 범위 안, 변이로 잠금 확인 |
| 놓친 문제 #3 보고만(세션별 격리 아님) | 타당 | D-01·D-04 범위이며 `persistence.md`가 서술 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | 준비된 env가 없는 호출에서 `options.env`가 `process.env`의 **명시 스냅샷**이 된다(`claude-adapt.ts:158`). 이전에는 옵션 생략으로 SDK가 상속했다 | 비귀속 — AC·Decision·§10 어디에도 env 전달 방식 계약이 없다 | NON_BLOCKING | — | 기록. 조립 이후 env 변경이 필요해지면 새 결정 |
| D2 | 앱 임시 루트를 만드는 곳이 3곳이고 mode가 갈린다 — `temp-path.ts:30`은 `0o700`, `attachment-files.prepareDirectory`·`files.prepareOutputDirectory`는 기본 mode. 먼저 실행된 쪽이 mode를 정한다 | 비귀속 — mode를 정한 AC 없음 | NON_BLOCKING | — | 기록. Windows 대상에서는 부모 Temp가 이미 사용자별이라 현재 위험 낮음 |
| D3 | `getTemporaryFilesPath()` 소비처가 0231에서 1곳(`chat-turn/background.ts:46`) 늘었다 | 0231 EP-09 | NON_BLOCKING | — | 0231 verify에서 다룸 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(r1).
- 관련 plan 지침/AC의 존재 여부: 있었다 — V1이 SDK 내부 생성 경로를 열거하지 않아 구현자가 실기 후 별도 설계 V2(`b57e392`)로 D-06·VP-10·EP-06을 추가했다. 설계→구현 커밋 분리는 지켜졌다.
- 사용자 결정 변경 근거: `orckinus-orca` → `orcinus-orca` 철자 정정이 §2에 출처와 함께 남아 있다.
- 반복된 검증 환경 한계: 없음. 이 환경은 egress가 열려 있어 `npm ci`·electron 바이너리·better-sqlite3 Node ABI 빌드가 모두 성공했다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **10 PASS** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-01~D-06 전건 production path에서 확인
- AC 충족: ✅6 · ⚠️0 · ❌0 = 6/6 (자기보고와 일치)
- §10 강제 지점: 독립 재열거 **20/20** 일치
- 현재 변경 운영 gate: 5종 PASS
- NON_BLOCKING: 3건(D1~D3) · NEXT_HANDOFF: 없음
- repository operation checks: trailer 5키 파싱, 좌표 3건 실재, INDEX 갱신 완료
- 남은 사람 확인: 없음
- 다음 단계: INDEX 행을 archive history로 이동
