# Verify — 0191-docs-code-resync

> 라운드 1 판정 원문은 이 문서 하단 [부록 — 라운드 1](#부록--라운드-1-검증-fail-원문-보존)에 보존한다. 본문은 재서술하지 않고 링크한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0191-docs-code-resync` |
| 검증자 | Claude Code |
| 일자 | 2026-08-18 |
| 대상 커밋/range | `32723bf..6f8af81` (구현 `7d8b2df` · 해시 기입 `6f8af81`) |
| 구현 전 plan 기준 | `32723bf` (r1 verify 커밋) |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증 모두 Claude Code — 자기 검증이다 |

## 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** `32723bf`(r1 verify) → `7d8b2df`(r2 구현) → `6f8af81`(대상 커밋 해시 기입)로 갈렸다.

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다** — §7 주의사항 2줄 · §8 2줄 · §10 표 · §19 게이트 블록.
- **그 변경이 승인된 것인가: 그렇다.** 전부 verify r1 §13 **D6 의 "대응 방향"** 원문(`세 숫자를 실측으로 고치고 §19 스윕을 상대 경로까지 확장, 심볼 축을 §10 강제 지점 표에 정식 등재`)이 지시한 변경이고, 각 정정에 `[r2 정정 — 출처: verify r1 §7]` provenance 가 붙어 있다.
- **AC 변경: 없음** — §7 표의 AC1~AC12 행 원문 무변경(`git diff 32723bf..7d8b2df` 에서 표 본문 hunk 0).
- Decision Ledger 변경: 없음. Product/UX Contract(§1~§5) 변경: 없음.
- 사용자 결정 3건이 `[구현자 기입] 라운드 2` 에 신규 기재됐다(`layers.md §1-2` 삭제 · 스윕은 plan 유지 · `decisions/004` 상단 승계 노트). Ledger 의 D-001~D-007 과 충돌하지 않는다.
- 채점에 사용할 원 기준: `32723bf` 의 §3 Decision Ledger · §7 AC1~AC12 · §10 강제 지점 표(심볼 행 포함).

**기록해 두는 내부 불일치**: AC1 행의 검증 수단 칸은 여전히 `→ 출력 **0줄**` 인데, §19 완료 조건은 `A+B+C 산출이 예외 목록과 정확히 일치`다. 실제 산출은 20줄이라 두 문장이 문자 그대로는 어긋난다. D6 이 지시한 확장의 결과이고 §7 주의사항이 새 기준을 명시하므로 **후자를 채점 기준으로 삼았다**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 = `docs/` 전수 + app 하위 AGENTS | 두 축 모두 | r2 는 docs 18 + `app/src/main/AGENTS.md`(`git diff --stat`) |
| D-002 provider-runtime 은 경로·상태 문구만 | 절 구조 불변 | `^## ` **20개** — r1 과 동일 |
| D-003 폐기 절 삭제 + ADR 링크 | 본문 소멸 | `system-prompt.md:75~81` = "미채택" 3줄 + ADR-002 링크 |
| D-004 guides 포함 | 3파일 | r2 는 `closed-network-extensions.md` 2줄 추가 정정 |
| D-005 "보고 따라할 수 있도록" | 명령이 실제로 돈다 | **이번 턴 검증자가 3개 전부 재현**(§9) — r1 의 미재현이 닫혔다 |
| D-006 OQ9 미결 | PRD 비범위 | `PRD.md` r2 diff 0 |
| D-007 루트 AGENTS 비범위 | 미변경 | 루트 `AGENTS.md` r2 diff 0 |

### end-to-end 흐름

```text
에이전트/배포자
  → docs/INDEX.md 라우팅
  → arch/*.md · guides/*.md
  → 인용한 코드 경로(3형태) · 인용한 심볼
  → 실재하면 코드 도달 / 부재하면 조용한 오안내
```

경로 칸은 이번에 닫혔다. **심볼 칸이 이번 FAIL 의 자리다** — 4사이트가 없는 심볼을 현재형으로 단언한다(§5·§13).

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 조용하다 | 부재 인용은 예외를 던지지 않는다. 독자가 자기 체크아웃을 의심한다 |
| false success 가능성 | **있다** | 심볼 게이트의 버킷이 **심볼 단위**라, 한 사이트의 "구/폐기" 표기가 다른 사이트의 현재형 단언을 통과시킨다(E1~E3) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 코드 변경 0 을 `git diff --stat` 으로 확인 |
| 증상만 제거하고 상태가 남았는가 | **부분적으로** | 계측을 넓혀 r1 잔여를 원인째 닫았으나, 넓힌 계측 자체가 다시 불변식보다 좁다 |
| 역사적 인용을 지워 게이트를 통과시켰는가 | 아니오 | 20사이트를 삭제 대신 §19 예외표에 사유와 함께 등재. `layers.md §1-2` 삭제는 사용자 결정 1 |
| 최적화가 관측을 없앴는가 | 해당 없음 | 문서 작업 |
| 출력/요청 상한 | 해당 없음 | 코드 변경 0 |

## 3. 역방향 탐색

`scan-surface.sh` 는 코드 diff 용이라 코드 변경 0 인 이번 range 에서 산출이 없다. 문서→코드 방향 스윕 3종(경로 A/B/C · 심볼)을 직접 재실행하고, **스윕 정의 밖 표면 2종**을 추가로 팠다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 백틱 경로 3형태(A·B·C) | **정상** | A 0 · B 11 · C 9 = §19 예외표 12행/20사이트와 정확히 일치, 그 밖 0줄 |
| 백틱 심볼 67사이트 | **결함 4건** | 사이트 단위 재분류 = 63 분류 / **4 미분류**(E1~E4) |
| **`:줄번호` 가 붙은 백틱 경로**(B/C 정규식 밖) | 정상 | 별도 스윕 작성 → 부재 0건. `claude.ts:346` 류가 전부 해석됨 |
| **`**bold**` 심볼**(백틱 아님, 심볼 스윕 밖) | **결함 1건** | `terms.md:40` `**InflightTurn**` — 코드 0건, `runtime-ipc.md:10` 이 "구 단일 inflight 모델은 폐기" (E4 동반) |
| 형제 문서 정책 비대칭 | 해소 | r1 이 지적한 `settings-reactions.ts` 누락을 `app/src/main/AGENTS.md` 에 추가 |
| producer ↔ consumer 파생 불일치 | **발생** | `standardization.md:7`(구현됨) ↔ 같은 문서 `:146`·`terms.md:82`(구현체 없음) — E1 |
| 동일 규칙 중복 구현 / SSOT drift | 유지 | 수치는 `generated/inventory.md` 단일. `prose ok` 재실행 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트: 없음(문서 전용). AC7 이 **가이드가 지시하는 명령 자체**를 대상으로 삼는다.
- structural proxy 만으로 semantic 목표를 통과시킨 지점: **심볼 축**. 목표는 "없는 심볼을 현재형으로 단언하지 않는다"인데 측정은 **심볼 47개의 버킷 배정**이다. 단언은 **사이트 67개**에 있으므로 한 심볼이 두 성격을 가지면 계측이 그것을 볼 수 없다.
- 구현자 자기보고를 증거로 쓰지 않았다 — AC1~AC12 · 강제 지점 8행 · 개수 5종을 이번 턴에 전부 재측정했다(§5·§7·§9).

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 인용 `src/**` 경로 전부 실재 | ✅ | §19 A/B/C 재실행 = **0 / 11 / 9**. 20사이트 전부 예외표 12행에 등재, 그 밖 **0줄** | 에이전트가 문서 경로를 연다 |
| AC2 | 출시 기능이 미구현으로 표기되지 않음 | ✅ | `arch/*/overview.md` 잔여 `❌` **7행** 실측 = r2 정정본과 동일(190·201·210·212 / 81·82·83) | 상태표를 읽는 세션 |
| AC3 | provider-runtime 경로·상태 문구 정정, 구조 불변 | ✅ | `^## ` **20개** 불변. `:188` ③ = `claude.ts:346 prompt: input.stream`(턴) · `:270`(1-shot) 코드와 일치 | D-002 |
| AC4 | 삭제·이설 모듈명 미인용 | ✅ | 6패턴(`prepared-config`·`features/login/`·`SkillsPage`·`declarations/{sso,llm,service}`) 각 **0건** | `auth.md`·`layers.md` |
| AC5 | app AGENTS 레이아웃·스크립트가 실측과 일치 | ✅ | 비-test `.mjs` **6** = `app/AGENTS.md:144~150` 열거 6 · `*.test.mjs` **6** | `app/` 작업 세션 |
| AC6 | 폐기 절 삭제 + ADR 링크 | ✅ | `system-prompt.md §2` = 3줄 "미채택" + `ADR-002` 링크 | D-003 |
| AC7 | §8.1 회귀 테스트 실재 + 명령 3개 통과 | ✅ | **3개 전부 검증자 실행**(§9). 인용 `*.test.ts` 재측정 **22개 · 부재 0** | 배포자가 §8 을 실행 |
| AC8 | §8.2 1번 ↔ §1.1 동일 파일 | ✅ | §8.2 1번 `app/deployment/auth-definitions.ts` = §1.1 트리 1행 | 배포자가 선언을 채운다 |
| AC9 | workspace 가이드가 정본을 밝히고 미채택 표기 | ✅ | 헤더가 `workspace-guard.ts` + 3함수 인용 · `disallowedTools` 미채택 4곳 · `grep -r disallowedTools app/src` = **0** | `guides/AGENTS.md` 규칙 |
| AC10 | release-operations 의 CI 트리거가 ci.yml 과 일치 | ✅ | `:12` "main push + 모든 PR(둘 다 `app/**`·`.github/workflows/**`) + `workflow_dispatch`" = `ci.yml:11~22` | 릴리스 담당자 |
| AC11 | INDEX 라우팅에 2행 | ✅ | `docs/INDEX.md:12`·`:23` | 새 세션 진입 |
| AC12 | 인벤토리 가드 3종 통과 | ✅ | 직접 실행 → `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · exit 0 | CI |

- **합계 재측정**: `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12`. 분모는 §7 의 AC1~AC12, 분할·추가 없음.
- **합계 사본 대조**: 본문 `12/12` ↔ 커밋 `7d8b2df`·`6f8af81` trailer `Criteria-Met: 12/12` ↔ INDEX 비고 `자기보고 AC 12/12` — **세 사본 일치**. r1 에 이어 0190 r1 형 갈림 재발 없음.
- **AC 12/12 인데 FAIL 이다.** 사유는 AC 밖이다 — §10 강제 지점 1행 불일치 + 기준 밖 결함 4건 + 자기보고 수치 5종 불일치(§7·§13).

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan 이 적은 강제 지점 | 검증자가 확인한 지점 | 결과 |
|---|---|---|---|
| 인용 경로 실재 (A 절대형) | 스윕이 한 번에 | 산출 **0줄** | ✅ 재현 |
| 인용 경로 실재 (B 상대형) | 〃 | 산출 **11줄**, 전부 예외표 | ✅ 재현 |
| 인용 경로 실재 (C 맨 파일명) | 〃 | 산출 **9줄**, 전부 예외표 | ✅ 재현 |
| **인용 심볼 실재** | 전건 4버킷 · 미분류 0 (자기보고 47/47) | **63/67 사이트** 분류 · **4 미분류** | ❌ **불일치** |
| 수치 본문 미기재 | inventory prose | `prose ok` 재실행 | ✅ |
| 상대 링크 해석 | 동 links | `links ok` 재실행 | ✅ |
| guides 절차 실행 | §8.1 명령 3개 | **3/3 검증자 실행**(§9) | ✅ 재현 |
| §8.1 인용 테스트 실재 | 표 8행 (자기보고 21/21) | **22/22 실재 · 부재 0** | ✅ (개수만 +1, §7) |

- **분모가 심볼(47)이 아니라 사이트(67)여야 한다.** 자기보고 `47/47` 은 *심볼이 어느 버킷에 속하는가*를 세고, 불변식은 *각 단언이 현재형인가*를 묻는다. 두 축이 갈리는 지점이 E1~E3 이다.
- 표에 없는데 같은 불변식이 필요한 지점: **있다.** `**bold**` 로 적힌 심볼은 백틱 전용 정규식 밖이다(`terms.md:40`). `migrate-sources` 처럼 소문자-하이픈 식별자도 CamelCase/CONST 정규식 밖이다(E1 의 세 번째 인용).

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `app/deployment/` 표면 | 이번 턴 계약 변경 0. §1.1 factory 표 5행이 실제 파일과 일치 | §8.2 1~3번이 §1.1 과 같은 파일을 지시 | ✅ |
| `NormalizedHookSet` 계약(D5 정정) | `adapters/hooks.ts` 의 `NormalizedHook{Event,Context,Decision,Handler,Set}` 5종 전부 export 확인 | 문서 §3.2.2 표 9이벤트 = 코드 `NormalizedHookEvent` 9종 · §3.2.3 필드 = 코드 필드 1:1 | ✅ |
| `IPC_CONTRACT.md` 채널 계약 | `check-doc-inventory.mjs` 76채널 ok | `SetSessionPinnedSchema`/`SetProjectPinnedSchema` = `shared/protocol.ts:220`·`:240` 실재 | ✅ |
| `standardization.md` 배포 계층 SSOT | — | **`:7` 이 `StandardConformance`·`migrate-sources` 를 "코드에 반영됐다" 로 단언** | ❌ E1 |

## 7. 숫자 / 음성 기준 / 상한 재측정

**최종 상태 수치는 전부 재현된다.** 시작 상태와 증분 수치는 갈린다.

| 값 | 자기보고 | 재측정 | 재현 방법 |
|---|---:|---:|---|
| HEAD A / B / C 산출 | 0 / 11 / 9 | **0 / 11 / 9** | plan §19 블록 원문 |
| 예외표 커버리지 | 12행 = 20사이트 | **12행 = 20사이트** | 산출과 표 1:1 대조 |
| 심볼 스윕 산출 | 67사이트 / 47심볼 | **67 / 47** | plan §19 심볼 블록 |
| 심볼 4버킷 합 | 25+9+13 = 47 | 합은 맞음 · **사이트 분류는 63/67** | 67사이트 전건 육안 재분류 |
| AC2 잔여 `❌` | 7행 | **7행** | `grep -n ❌ arch/*/overview.md` |
| provider-runtime 몫(base) | 13 | **13** | r1 §7 과 동일 |
| base B 산출 | 57 | **57** | `git archive 32723bf` 트리에 §19 B 블록 |
| `layers.md` 몫(B+C) | 34 | **34** | 같은 산출을 파일별 집계 |
| **base C 산출** | **19** | **15** | 같은 트리에 §19 C 블록 원문 |
| **B 축 고친 사이트** | **13** | **15** | base 비-layers 23 − 잔존 8 (`comm -23` 로 집합차) |
| **C 축 고친 사이트** | **7** | **6** | base 15 − HEAD 9 |
| **경로 고친 총계** | **20** | **21** | 15 + 6 |
| **"계측 확장이 드러낸 결함"** | **21** (plan·INDEX 비고) | **22** | 21 경로 − 지적 4(D1·D2·D3·D4) + 심볼 5 |
| §8.1 인용 테스트 | 21 | **22** | 예외 문구의 `chat-turn.continuity.test.ts` 포함 여부 차이. **부재 0 은 동일** |

- **내역 합 = 총계**: HEAD 축은 성립한다(11 + 9 = 20 = 예외표). base 축은 성립하지 않는다(위 4행).
- **0건 게이트가 정당한 이력을 지웠는가**: 아니다. 20사이트 전부 사유와 함께 등재됐고, 삭제된 `layers.md §1-2` 는 사용자 결정 1 이며 `:94` 가 `git log`(PR #29)로 안내한다.
- 총량/상한: 해당 없음(코드 변경 0).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| §8.1 명령 3개 | **전부 실행 — 남은 것 없음**(§9) | 없음 | — |
| §8.2 배포 실기 | 파일명·절차 순서 정합(AC8) | 사내 로그인 왕복 | 폐쇄망에서 로그인 화면 → 메인 UI → 연결 탭 |
| 심볼 축 전건 분류 | 67사이트 육안 재분류 | 없음 — 판정은 문장 해석이고 기계로 못 넘긴다 | — |

"UI/electron 이라서" 로 넘긴 순수 로직 없음. r1 이 사람 실기로 넘겼던 게이트 3개는 이번에 기계 검증으로 회수했다.

## 9. 게이트 재실행

`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 를 따랐다. `npm test` 는 쓰지 않았다 — DB 동작 검증이 필요 없는 문서 작업이고, 쓰면 ABI 를 Node 로 뒤집는다.

| 명령 | **관측한 산출**(exit code 아님) |
|---|---|
| `cd app && node scripts/check-doc-inventory.mjs --check` | 3항목 전부 출력: `generated doc ok (9 items, 76 channels)` · `prose ok: no inventory counts restated in current-state docs` · `links ok: every relative markdown link resolves` |
| `cd app && npm run typecheck` | 하위 3개(`typecheck:node`·`:web`·`:test`) 전부 실행, **error 0줄** |
| `cd app && npm run lint` | `✖ 1 problem (0 errors, 1 warning)` — `react-hooks/incompatible-library` @ `useTranscriptVirtualizer.ts:22`. 문서 변경과 무관한 기존 경고 |
| `cd app && ./node_modules/.bin/vitest run src/main/features/{auth,gate,harnesses,plugins} src/main/app` | `Test Files 1 failed \| 40 passed (41)` · `Tests 506 passed (506)` |

- **환경 기인 실패 분리**: 실패 1파일 = `src/main/app/chat-turn.continuity.test.ts`, 서명 `Error: Electron failed to install correctly` @ `node_modules/electron/index.js:17`. **guides §8.1 3번 각주가 적은 예외와 글자 그대로 같다**("41파일 중 40 통과 · 506 케이스 전부 통과, 실패 1건은 `Electron failed to install correctly`"). 문서가 배포자에게 약속한 통과 기준이 독립 세션에서 그대로 재현됐다 — D-005 의 semantic 목표가 실증됐다.
- vitest exit code 는 1 이다. 가이드가 그 1건을 예외로 명시하므로 **판정은 green** 이다.
- **게이트가 작업 트리를 바꿨는가**: 아니다. `npm run lint` 는 `eslint --cache --fix` 라 쓰기가 있으나 실행 직후 `git status --short` **빈 출력**. 검증자가 고친 코드를 검증자가 채점하는 자기증명 없음.
- **검증 중 명령이 남긴 잔여물**: `app/.eslintcache`(288KB, 이번 lint 가 생성). `app/.gitignore:59` 가 무시하므로 추적물 오염 없음. 그 밖 잔여물은 `/tmp` 스크래치뿐.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| 인벤토리 가드 | 에이전트 실행·산출 증거 확보 |
| lint / typecheck / scoped vitest | **에이전트 실행·산출 증거 확보** (r1 미실행 → r2 회수) |
| AC ↔ 코드/production path | 에이전트 1:1 대조 완료(§5) |
| 경로·심볼 스윕 + 정의 밖 2종 | 에이전트 정적 검증 완료(§3) |
| AGENTS 위생·부모/자식 모순 | 에이전트 스캔 완료(§11) |
| E1 의 처리 방향(문장 정정 vs 절 재작성) | 에이전트 판정 가능 — 구현 턴 몫 |
| AC6 의 ADR 링크 대상 교체 | **사람 결정** — D-003 실현 방식 변경 |
| PRD §11 OQ9 | **사람 결정** — D-006 유지 |
| §8.2 사내 로그인 왕복 | **사람 실기** |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- r2 의 AGENTS 변경은 `app/src/main/AGENTS.md` 1줄(`settings-reactions.ts` 추가)뿐이다.
- 키/토큰/PW/이메일/IP 등 민감 패턴: **0건**.
- 일회성·변동성 운영정보 혼입: 없음.
- 부모 ↔ 자식 명령 충돌: 없음. 추가한 항목이 `app/AGENTS.md` 열거와 일치해 **r1 이 지적한 형제 비대칭이 해소**됐다.
- 새 `AGENTS.md`: 없음 — stub·루트 표 갱신 불요.

### INDEX 보드 정합성

- 이번 턴 진입 시점 상태: 단계 `impl` · 상태 `IMPL_DONE` · 다음 주체 `Claude(검증)` · 대상 커밋 `7d8b2df` · 라운드 2 — **전부 실제와 일치**했다.
- 비고 **650자**, 상세를 `plan.md` 로 링크. 5줄 상한 준수.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- `7d8b2df`·`6f8af81` trailer: `Agent: claude` · `Handoff:` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 허용값 준수. trailer 블록 내부 빈 줄 없음.
- 인용 해시 실재: `7d8b2df` ✓ · `6f8af81` ✓. r1 이 보고한 "plan 커밋이 `Status: implemented`" 는 이번 range 밖이라 그대로 둔다.
- 구현자가 새로 인용한 코드 좌표 표본 재확인: `chatStore.ts:1243`(`chatApi.onEvent(ingestChatEvent)`) ✓ · `protocol.ts:220`/`:240` ✓ · `ExtensionsCatalogView` ✓ · `composer/ComposerDecorationLayer.tsx` ✓ · `DISABLED_HATCH_CLASS`(`shared/ui/mock.ts`) ✓ · `app/boot/steps.ts` 의 `landing-target` ✓ — **표본 6/6 실재**.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 1 `adapters.md:291` `{action:'block'}` → `{decision:'deny'}` | 타당 — `hooks.ts:38 NormalizedHookDecision` 형식과 일치 | 유지 |
| 선조치 2 `security.md:114` `features/sso/auth-window.ts` → `infra/browser-session.ts` | 타당 — base 스윕 B 축에 실재했고 HEAD 에서 사라졌다 | 유지 |
| 선조치 3 `system-prompt.md:130` branded 타입 단언 정정 | 타당 — `security.md:180` 이력 문단과 정합 | 유지 |
| 선조치 4 `app/src/main/AGENTS.md:29` 형제 비대칭 해소 | 타당 — r1 §13 파생 관찰의 직접 처리 | 유지 |
| 선조치 5 guides §8.1 2번에 `--fix` 부작용 명시 | 타당 — r1 §9 파생 관찰의 직접 처리. 검증자도 같은 부작용을 관측했다 | 유지 |
| 보고만 1 AC6 의 ADR 링크가 근거를 담지 못함 | 타당 — `grep -n "prompts/" decisions/002-*.md` = 0 재확인 | **사람 결정으로 이관** |
| 보고만 2·3·5 (루트 AGENTS · `ipc.ts:394` 주석 · OQ9) | 타당 — D-006·D-007 범위 밖 | 유지 |
| 보고만 4 `persistence.md:18` 은 AC2 측정면 밖 | 타당 — 측정면 정의를 §7 에 명시한 것이 옳다 | 유지 |

무단 제품·AC 변경 없음. plan 본문 수정은 전부 verify r1 D6 이 지시한 범위 안이다(§0).

## 13. [FAIL 시] 파생 이슈

- [ ] **E1** — `standardization.md:7` 상태 배너가 "`sources/dist` 분리 + `ExtensionDeployer` + `StandardConformance` + `migrate-sources` 가 **코드에 반영됐다**" 로 단언한다. 실측: `grep -rn StandardConformance app/src` = **0**, `migrate-sources`/`migrateSources` = **0**, `deployer.ts` 의 export 는 `DeployResult`·`deploy()` 뿐(`ExtensionDeployer` 는 헤더 주석 이름). **같은 문서 `:146` 이 "`StandardConformance` 는 아직 설계 단계이고 구현체가 없다 … 구현 완료로 읽지 말 것" 이라 적고, `terms.md:82` 도 "목표 계약이다" 로 적는다** — 문서의 첫 배너가 자기 본문 두 곳과 반대다.
- [ ] **E2** — `provider-runtime.md:29` 가 "2계층 모델(Tier A `OrcaCapabilities` / Tier B 얇은 `SessionAdapter`)" 을 현재형으로 쓴다. 이 줄이 링크하는 `adapters.md:71` = "구 `CapabilityBuilder`/`OrcaCapabilities` 개명(0062) — 현재 이름은 `ExtensionBuilder`/`TurnExtensions`". **r2 가 바로 이 줄을 편집해 `OrcaHookSet`→`NormalizedHookSet` 을 고치면서 같은 문장의 이 심볼을 남겼다.**
- [ ] **E3** — `ux-domains.md:81` 이 "ApprovalCard 가 Composer 입력창을 대체(**현** `PlanApprovalCard` 패턴 재사용)" 라 쓴다. 같은 문서 `:79` = "`PlanApprovalCard` → `features/chat/components/ApprovalCard.tsx` 일반화". r1 선조치 #3(제목↔본문 자기모순)과 같은 유형이 같은 파일에 남았다.
- [ ] **E4** — `persistence.md:116` 이 "IPC 이벤트 흐름(`InflightTurn` 상태 머신, runtime-ipc.md §1.1)을 통해 DB 에 실시간 persist" 라 쓴다. `grep -rn InflightTurn app/src` = **0**, 현재 구현은 `features/chat/turn-coordinator.ts:111 TurnCoordinator`. `runtime-ipc.md:10` 은 "구 '단일 inflight' 모델은 **폐기**됐다" 이고 §1.1 은 `InflightTurn` 을 정의하지 않는다. **`terms.md:40` 이 같은 이름을 용어표 항목으로 살려 두는데, `**bold**` 라 심볼 스윕(백틱 전용) 밖이다** — 함께 처리한다.
- [ ] **E5** — 자기보고 수치 5종이 재측정과 갈린다(§7 표): base C `19`→**15** · B 축 고친 수 `13`→**15** · C 축 `7`→**6** · 경로 총계 `20`→**21** · "드러난 결함" `21`→**22**(plan `[구현자 기입] 라운드 2` 와 INDEX 비고 두 곳). HEAD 상태 수치는 전부 일치하므로 **고칠 대상은 시작 상태·증분 서술뿐**이다. r1 D6 과 같은 축이다.

### 처리 방향 제안 (구현 턴 몫)

- E1~E4 는 문장 정정이다. **불변식을 사이트 단위로 다시 세운다** — "한 심볼이 어느 버킷인가" 가 아니라 "이 사이트의 단언이 현재형인가".
- §19 심볼 블록을 `**bold**` 와 소문자-하이픈 식별자까지 넓힐지는 구현 턴 판단이나, 넓히지 않는다면 **넓히지 않은 이유를 §19 에 적는다**(계측 정의가 곧 불변식의 정의다 — plan §10 이 r2 에 스스로 쓴 문장).

### 파생 관찰 (수정 불요)

- `adapters.md` 의 ts 펜스에서 `OrcaHookSet`→`NormalizedHookSet` 치환 후 주석 정렬이 어긋난다(`hooks: NormalizedHookSet                // …`). 외형뿐이다.
- AC1 행의 "출력 0줄" ↔ §19 "예외표와 일치" 문자 불일치(§0).
- AC6 의 ADR-002 링크가 `prompts/` 제거 근거를 담지 않는다 — 구현자 보고만 #1, 사람 결정 대기.
- `app/src/shared/ipc.ts:394` 주석의 `InteractionBroker` — 코드라 이번 범위 밖(코드 변경 0).

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상: 그렇다.** r1 FAIL 사유는 "계측 정의가 불변식보다 좁다"(정규식 형태 축)였고, r2 FAIL 사유는 같은 문장의 다른 형태다(버킷 단위 축 · 백틱 전용 축). **두 라운드가 같은 축에서 실패했다.**
- **관련 plan 지침의 존재 여부: 있었다.** plan §10 이 r2 에 "계측 정의가 곧 불변식의 정의가 되므로 정의를 좁게 잡으면 게이트 green 이 전수를 뜻하지 않는다" 를 명문화했다. **그 문장을 쓴 라운드가 같은 방식으로 다시 좁았다** — 규칙을 적는 것이 적용을 보장하지 않는다.
- 사용자 결정 변경 근거: 없음. Ledger 무변경. 이번 턴 사용자 결정 3건은 기존 ACTIVE 와 충돌 없음.
- 반복된 검증 환경 한계: **해소.** r1 은 `node_modules` 부재로 게이트 3개를 못 돌렸고 r2 검증 세션에는 있었다. 남은 한계는 electron 바이너리 1파일뿐이며 guides 가 그것을 문서화한다.
- 자기보고 합계 축(0187 r1 · 0189 r1 · 0190 r1 · 0191 r1 D6)의 재발: **사본 갈림은 없다**(세 사본 일치). **분모·증분이 실측과 갈린다**(E5).
- 현재 라운드 수: **2** (다음 재구현이 라운드 3). `docs/handoff/AGENTS.md` 의 review 트리거 중 *같은/유사 실패 반복* 은 성립하고 *라운드 3 초과* 는 아직 아니다 — 수행 여부는 사용자·`handoff-review` 판단이다.

## 15. 결론

**FAIL (라운드 2).** AC 12건 전부 재측정으로 충족되고, r1 이 남긴 D1~D6 은 6건 모두 코드 대조로 닫혔다. r1 의 최대 공백이던 게이트 3개도 이번엔 검증자가 직접 돌려 guides §8.1 이 약속한 산출(41파일 중 40 · 506 케이스 · 예외 1건)이 독립 세션에서 그대로 나왔다 — D-005 가 실증됐다.

FAIL 사유는 AC 밖이다. r2 가 §10 에 스스로 올린 **심볼 축 강제 지점이 "미분류 0" 으로 닫히지 않았다** — 버킷을 심볼(47)에 붙이고 단언은 사이트(67)에 있어 4사이트가 그대로 통과했다(E1~E4). E1 은 현재-상태 문서의 첫 배너가 자기 본문 두 곳과 반대로 말하는 형태라 독자에게 가장 위험하다. 여기에 자기보고 수치 5종이 재측정과 갈린다(E5).

다음 주체는 **Claude(재구현)** 다. E1~E5 를 닫을 때 불변식을 **사이트 단위**로 다시 세우고, 계측을 넓히지 않는 축이 있다면 그 사실을 §19 에 남긴다.

---

## 부록 — 라운드 1 검증 (FAIL, 원문 보존)

> 아래는 `32723bf` 시점의 r1 verify 원문이다. 판정·관측을 보존하기 위해 그대로 두고, 제목 수준만 한 단계 낮췄다. 재서술하지 않는다.


### 메타

| 항목 | 값 |
|---|---|
| slug | `0191-docs-code-resync` |
| 검증자 | Claude Code |
| 일자 | 2026-08-18 |
| 대상 커밋/range | `1c9b260..c555849` (구현 `d102df9` · 보고 `c555849`) |
| 구현 전 plan 기준 | `1c9b260` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증 모두 Claude Code — 자기 검증이다 |

### 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** `1c9b260`(설계) → `d102df9`(구현) → `c555849`(보고)로 커밋이 갈렸다.

- 구현 커밋이 `plan.md` 를 변경했는가: **아니다.** `git diff 1c9b260..d102df9 -- docs/handoff/` = 빈 출력.
- Decision Ledger 변경: 없음. `git diff 1c9b260..HEAD -- .../plan.md` 의 추가행이 전부 `[구현자 기입]` 이하다.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AC1~AC12 원문 그대로.
- 채점에 사용할 원 기준: `1c9b260` 의 §3 Decision Ledger · §7 AC1~AC12 · §10 강제 지점 표.

### 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 = `docs/` 전수 + app 하위 AGENTS | 두 축 모두 수정됨 | 22파일 = docs 20 + `app/AGENTS.md` + `app/src/main/AGENTS.md` |
| D-002 provider-runtime 은 경로·상태 문구만 | 절 구조 불변 | `^## ` 20개 · 제목·줄번호까지 동일(§7) |
| D-003 폐기 절 삭제 + ADR 링크 | 본문 소멸 | `system-prompt.md §2` 43줄 → ADR-002 링크 |
| D-004 guides 포함 | 3파일 수정 | closed-network · workspace-isolation · release-operations |
| D-005 "보고 따라할 수 있도록" | 명령이 실제로 돈다 | §8.1 명령 3개 — 구현자 실행, 검증자 재현 불가(§9) |
| D-006 OQ9 미결 | PRD 비범위 | `PRD.md` 미변경 확인 |
| D-007 루트 AGENTS 비범위 | 미변경 | 루트 `AGENTS.md` diff 0 |

#### end-to-end 흐름

```text
에이전트/배포자
  → docs/INDEX.md 라우팅
  → arch/*.md · guides/*.md
  → 인용한 코드 경로·심볼
  → 실재하면 코드 도달 / 부재하면 조용한 오안내
```

이 흐름의 마지막 칸이 이번 FAIL 의 자리다 — 스윕이 세는 형태의 경로는 0건이 됐고, 스윕 밖 형태에서 4건이 남았다(D1~D4).

### 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 조용하다 | 부재 경로는 예외를 던지지 않는다. 독자가 자기 체크아웃을 의심한다 |
| false success 가능성 | **있다** | §19 스윕이 0줄이어도 상대 경로 인용은 계측 밖이다(D2·D3·D4) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 요구는 "문서를 코드에 맞춘다", 코드 변경 0 을 diff 로 확인 |
| 증상만 제거하고 상태가 남았는가 | **부분적으로** | 스윕 20건은 원인까지 고쳤으나 같은 불변식의 다른 표면이 남았다 |
| 역사적 인용을 지워 게이트를 통과시켰는가 | 아니오 | 확장자를 떼 산문화한 지점 0. 20건 전부 현재 경로로 치환됐다 |
| 캐시/축소가 관측을 없앴는가 | 해당 없음 | 문서 작업 |

### 3. 역방향 탐색

`scan-surface.sh` 는 코드 diff 용이라 코드 변경 0 인 이번 range 에서 산출이 없다. 대신 **문서→코드 방향의 역방향 스윕 2종**을 직접 돌렸다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 백틱 `.ts`/`.tsx` 경로 중 어떤 base 로도 해석 안 되는 것 | **결함 3건** | `ux-domains.md:95`·`IPC_CONTRACT.md:445`·`system-prompt.md:106` (D2·D3·D4). 나머지는 파일명 단독 인용 또는 명시적 역사 서술 |
| 백틱 CamelCase 심볼 중 `app/src` 부재 | **결함 1군** | `OrcaHookSet`/`OrcaHookEvent`/`OrcaHookHandler`/`ORCA_TO_CLAUDE_EVENT` (D5). `RevertManager`·`OrcaCapabilities` 등 나머지는 목표 계약 또는 "구 …" 표기로 정상 |
| 폐기 파일명 `claude-code.ts` 잔존 | **결함 1건** | 범위 내 4건 중 3건은 "구 claude-code.ts", `provider-runtime.md:188` 만 현재형 (D1) |
| 형제 문서 정책 비대칭 | 경미 | `app/AGENTS.md` 는 `settings-reactions.ts` 를 열거, `app/src/main/AGENTS.md` 는 누락 |
| producer ↔ consumer 파생 불일치 | 발생 | 루트 `AGENTS.md`(`src/shared/i18n/ko.ts`) ↔ 이번에 고친 `TRD.md N2`(`app/src/renderer/src/shared/i18n/`)가 갈렸다 — D-007 로 의도된 범위 밖 |

### 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트: 없음(문서 전용). 대신 AC7 이 **가이드가 지시하는 명령 자체**를 대상으로 삼는다.
- structural proxy 만으로 semantic 목표를 통과시킨 AC: **AC1**. 목표는 "독자가 부재 파일로 안내받지 않는다"인데 측정은 `src/(main|renderer|shared|preload)/` 로 시작하는 경로만 센다. 그 정규식 밖에서 3건이 살아남았다(D2·D3·D4).
- 구현자 자기보고를 증거로 쓰지 않았다 — AC1~AC12 전부 이번 턴에 재측정했다(§5).

### 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 인용 `src/**` 경로 전부 실재 | ⚠️ | §19 스윕 base **20줄** → HEAD **0줄**(둘 다 재실행). 계측 밖에서 3건 잔존(D2·D3·D4) | 에이전트가 문서의 경로를 연다 |
| AC2 | 출시 기능이 미구현으로 표기되지 않음 | ⚠️ | 긍정 전환 8건 전부 코드 확인. 잔여 `❌` 개수 갈림(D6) | `arch/*/overview.md` 상태표 |
| AC3 | provider-runtime 경로·상태 문구 정정, 구조 불변 | ⚠️ | `^## ` **20개**, 제목·줄번호까지 동일. line 188 미정정(D1) | D-002 |
| AC4 | 삭제·이설 모듈명 미인용 | ✅ | `prepared-config` 0 · `features/login/` 0 · `SkillsPage` 0 · `declarations/{sso,llm,service}` 0 | `auth.md`·`layers.md` |
| AC5 | app AGENTS 레이아웃·스크립트가 실측과 일치 | ✅ | `scripts/` 비-test **6** = 열거 6 · `chat-turn/` **15파일** = 열거 15 · `features/` **12** 일치 | `app/` 작업 세션 |
| AC6 | 폐기 절 삭제 + ADR 링크 | ✅ | `system-prompt.md §2` 본문 43줄 제거, ADR-002 링크 잔존 | D-003 |
| AC7 | §8.1 회귀 테스트 실재 + 명령 3개 통과 | ✅ 구조 / ⚠️ 의미 | 인용 테스트 20개 + `confluence/*` 7파일 전부 `ls` 확인. 스코프 5디렉토리 테스트 파일 수 **41** = 문서 기재 "41파일". 명령 3개는 **재현 불가**(§9) | 배포자가 §8 을 실행 |
| AC8 | §8.2 1번 ↔ §1.1 동일 파일 | ✅ | 양쪽 모두 `app/deployment/` 기준. §8.2 3번이 §1.1 의 `connections.ts` 를 링크 | 배포자가 선언을 채운다 |
| AC9 | workspace 가이드가 정본을 밝히고 미채택 표기 | ✅ | `resolveGuardRoots`·`guardToolAccess`·`makeWorkspaceGuardHook` 실재 · `grep -r disallowedTools app/src` = **0** · 미채택 표기 4곳 | `guides/AGENTS.md` 규칙 |
| AC10 | release-operations 의 CI 트리거가 ci.yml 과 일치 | ✅ | `ci.yml` 에 `pull_request` + paths(`app/**`·`.github/workflows/**`) | 릴리스 담당자 |
| AC11 | INDEX 라우팅에 2행 추가 | ✅ | `ARCHITECTURE.md`·`arch/frontend/overview.md` 행 존재 | 새 세션 진입 |
| AC12 | 인벤토리 가드 3종 통과 | ✅ | `node scripts/check-doc-inventory.mjs --check` **직접 실행** → `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · exit 0 | CI |

- **합계 재측정**: `✅ 8 · ⚠️ 4 · ❌ 0 = 총 12`. 분모는 §7 의 AC1~AC12, 분할·추가 없음.
- **합계 사본 대조**: 구현자 자기보고 본문 `12/12` ↔ 커밋 `d102df9`·`c555849` trailer `Criteria-Met: 12/12` ↔ INDEX 비고 — **세 사본은 서로 일치한다**(0190 r1 의 갈림 재발 없음). 다만 검증 재측정은 `8✅/4⚠️` 로 자기보고와 다르다.

심볼 정정도 코드로 확인했다: `ApprovalBroker`(`features/approvals/broker.ts:34`) · `RevertManager` 부재(주석 1건뿐) · `RISKY_TOOLS`/`isRiskyTool`(`adapters/risky-tools.ts`) · `CLAUDE_DESCRIPTOR`(`adapters/descriptor.ts:21`) · `infra/settings-store.ts` · `features/approvals/coordinator.ts` 의 `orca:permission:setMode` 배선. AC2 긍정 전환도 전부 실재 확인 — `features/approvals/permission-mode-controller.ts` · `renderer/src/shared/i18n/` · `useTranscriptVirtualizer.ts` · `transcript/registry.ts` · `StructuredOutputCard.tsx` · `AskUserQuestionCard.tsx` · deps `recharts ^3.9.2`/`i18next ^26.3.6`/`react-i18next ^17.0.9`/`@tanstack/react-virtual ^3.14.6`.

#### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan 이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 인용 `src/**` 경로 실재 | 범위 내 문서 + AGENTS 3종 (스윕이 한 번에) | 스윕 대상 20/20 · 스윕 밖 표면 미포함 | ⚠️ 계측 정의가 불변식보다 좁다 |
| 수치 본문 미기재 | `check-doc-inventory.mjs` prose | 1/1 — `prose ok` 재실행 | ✅ |
| 상대 링크 해석 | 동 links | 1/1 — `links ok` 재실행 | ✅ |
| guides 절차 실행 | §8.1 명령 3개 | 0/3 재현 — 환경 제약(§9) | ⚠️ 구조 방증만 |
| §8.1 인용 테스트 실재 | 새 표 8행 | 20/20 + `confluence/*` 7파일 | ✅ 재측정 |
| renderer 보조 명령 | §8.1 각주 1건 | 2파일 실재 확인, 실행 불가 | ⚠️ |

- **표에 없는데 같은 불변식이 필요한 지점: 있다.** 구현자가 `[구현자 기입]` 에서 "인용 *심볼* 실재" 를 새 축으로 올리고 3심볼(`InteractionBroker`·`RevertManager`·`RISKY_TOOLS`)로 닫았다고 보고했다. **그 불변식이 전수로 닫히지 않았다** — D1·D5 가 같은 축에서 남았고, D2·D3·D4 는 경로 축의 같은 공백이다.

### 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `app/deployment/` 표면 (`AuthDefinition`·`AuthBinder`·`UsageFetcher`) | 이번 턴 계약 변경 0. §1.1 factory 표가 실제 파일 5개와 일치 | §8.2 절차가 §1.1 과 같은 파일을 지시 | ✅ |
| `IPC_CONTRACT.md` 채널 계약 | `check-doc-inventory.mjs` 76채널 ok | `prompts/plan-feedback.ts` 인용이 부재 경로 | ⚠️ D3 |

### 7. 숫자 / 음성 기준 / 상한 재측정

- **경로 부재 총계**: base 스윕 재실행 = **20줄** ✓ (plan 기재와 일치). HEAD = **0줄** ✓.
- **내역 합 ≠ 총계**: plan §8 검산이 `provider-runtime 11 + IPC_CONTRACT 2 + TRD 2 + backend/overview 1 + frontend/overview 1 + claude-code-spec 1` 로 적었다 — **합이 18 이다.** base 스윕 원본을 파일별로 재집계하면 provider-runtime 몫은 **13**(줄 26·98·143·202×3·217×2·254·274·407·408·525)이고 그때 합이 20 이 된다. AC3 의 "부재 11건 → 0건" 과 구현자의 "AC3 부재 11→0" 은 둘 다 이 잘못된 분자를 물려받았다.
- **AC2 잔여 `❌` 상태행**: plan §7 주의사항 **5종** · 구현자 보고 **6행** · 재측정 **7행** — backend `overview.md` 190(OpencodeAdapter)·201(Artifacts)·210(`options.hooks`)·212(Zustand persist) + frontend `overview.md` 81(멀티세션 UI)·82(단축키)·83(단절 배너). plan 이 빠뜨린 2행은 `options.hooks`·멀티세션 UI 다.
- **§8.1 스코프 테스트 파일 수**: `src/main/features/{auth,gate,harnesses,plugins}` + `src/main/app` = **41** (auth 11 · gate 1 · harnesses 5 · plugins 7 · app 17). 문서가 적은 "41파일 중 40 통과" 의 분모와 일치한다.
- **0건 게이트가 역사적 인용을 지웠는가**: 아니다. 확장자를 떼 산문화한 지점 0건 — 20건 전부 현재 경로로 치환됐고, `claude-code.ts` 3건은 "구 …" 표기로 이력을 남겼다.

### 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| §8.1 명령 3개 | 인용 테스트 20개 실재 · 스코프 파일 수 41 대조 | 명령 실행 산출 | `cd app && npm ci && npm run typecheck && npm run lint && ./node_modules/.bin/vitest run <5디렉토리>` |
| §8.2 배포 실기 | 파일명·절차 순서 정합 | 사내 로그인 왕복 | 폐쇄망에서 로그인 화면 → 메인 UI → 연결 탭 |

"UI/electron 이라서" 로 넘긴 순수 로직은 없다 — 이번 턴에서 넘긴 것은 의존성 설치가 필요한 명령 실행과 사내 네트워크뿐이다.

### 9. 게이트 재실행

- 실제 실행 명령: `node app/scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**(exit code 아님): `generated doc ok (9 items, 76 channels)` · `prose ok: no inventory counts restated in current-state docs` · `links ok: every relative markdown link resolves` — 3항목 전부 출력됨.
- **재현하지 못한 게이트**: `npm run typecheck` · `npm run lint` · scoped `vitest run`. **이 컨테이너에 `app/node_modules` 가 없다**(`ls app/node_modules` → No such file). 설치 없이는 셋 다 실행 불가라 구현자가 보고한 산출(`0 errors / 1 warning`, `41파일 중 40 통과 · 506 케이스`)을 독립 확인하지 못했다. 구조 방증만 남긴다 — 인용 테스트 20개 실재, 스코프 파일 수 41 일치. **이는 통과 증거가 아니다.**
- `npm test` 사용 여부: 사용하지 않았다. DB 동작 검증이 필요 없는 문서 작업이다.
- 환경 기인 실패 분리: 구현자가 보고한 실패 5파일은 better-sqlite3 네이티브 바인딩으로, `app/AGENTS.md` 기재 목록과 같다고 보고됐다. 검증자는 재실행하지 못해 이 분리를 확인하지 못했다.
- **게이트가 작업 트리를 바꿨는가**: 검증자가 실행한 명령은 `--check` 하나로 쓰기가 없다. `git status` 클린 유지. 다만 **guides §8.1 의 2번 명령이 `eslint --cache --fix` 다** — 배포자가 따라 하면 자기 소스가 조용히 수정된다(파생 관찰).
- 검증 중 명령이 남긴 잔여물: 없음.

### 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| 인벤토리 가드 | 에이전트 실행·출력 증거 확보 |
| lint/typecheck/vitest | **미실행** — 의존성 부재(§9) |
| AC ↔ 코드/production path | 에이전트 1:1 대조 완료(§5) |
| 문서 형식·링크·경로·심볼 | 에이전트 정적 스윕 2종 완료(§3) |
| AGENTS 위생·부모/자식 모순 | 에이전트 스캔 완료(§11) |
| PRD §11 OQ9 | **사람 결정** — D-006 유지, 이번 턴 미결 |
| §8.2 사내 로그인 왕복 | **사람 실기** |

### 11. Repository operation checks

#### AGENTS.md 위생 / 정합성

- 키/토큰/PW/이메일/IP 등 민감 패턴: **0건** (`app/AGENTS.md`·`app/src/main/AGENTS.md` diff 전수).
- 일회성·변동성 운영정보 혼입: 없음. 오히려 "스크립트 3종/4종" 고정 수치를 열거로 바꿔 규칙 쪽으로 정렬했다.
- 부모 ↔ 자식 명령 충돌: 없음.
- 새 `AGENTS.md`: 없음 — stub·루트 표 갱신 불요.

#### INDEX 보드 정합성

- 단계 `impl` · 상태 `IMPL_DONE` · 다음 주체 `Claude(검증)` · 대상 커밋 `d102df9` — 전부 실제와 일치했다.
- 비고 **636자** — 현행 보드 27행 중 두 번째로 짧고 상세를 `plan.md` 로 링크한다(0190 선례 13,190자). 5줄 상한 준수로 본다.
- PASS archive 이동: 해당 없음(FAIL).

#### Commit / reference 정합성

- `d102df9`·`c555849` trailer: `Agent: claude` · `Handoff:` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 허용값 준수.
- **plan 커밋 `1c9b260` 이 `Status: implemented`** 다. 설계만 담긴 커밋이 "구현됨" 을 말한다 — 허용값 표에 plan 단계 값이 없어 생긴 틈이다(보고만, 이번 FAIL 사유 아님).
- 인용 해시 실재: `d102df9` ✓.
- 이동/삭제한 reference·script: 없음.

### 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 `RevertManager` 코드 부재 → §5·§12 정정 | 타당 — `grep -rn RevertManager app/src` = 주석 1건 | 유지 |
| #2 `InteractionBroker` → `ApprovalBroker` 전량 치환 | 타당 — 범위 내 0건, `broker.ts:34` 확인 | 유지 |
| #3 제목↔본문 자기모순 2건 선조치 | 타당 — 같은 결함이 `provider-runtime.md:188` 에 남았다 | **D1** |
| #4 `ARCHITECTURE.md` 2행 추가 | 타당 — 디렉토리 대조 일치 | 유지 |
| #5 `app/AGENTS.md:135` 실측이 기재와 일치해 미변경 | 타당 — 설계 대비 차이를 명시한 것이 옳다 | 유지 |
| #6 루트 AGENTS i18n 경로 (D-007) | 타당하나 이제 `TRD.md N2` 와 갈렸다 | 파생 관찰 |
| #7 OQ9 보고만 (D-006) | 타당 — 단독 결정 금지 준수 | 유지 |

무단 제품·AC 변경 없음. 선조치 4건 모두 "구현 세부·명백한 오기" 범주로 권한 안이다.

### 13. [FAIL 시] 파생 이슈

- [ ] **D1** — `provider-runtime.md:188` 이 현재형으로 폐기 파일명 `claude-code.ts` 를 쓰고 "매 턴 one-off `query()` 호출" 이라 적는다. 같은 문서 line 202 는 이번 턴에 "streaming input 으로 살아있는 `Query` 핸들 유지" 로 고쳐졌다 — 문서 내 자기모순. 실제 코드는 `adapters/claude.ts:346` `prompt: input.stream`. AC3 범위 안.
- [ ] **D2** — `ux-domains.md:95` 가 부재 파일 `features/skills/components/customize/SkillsCustomizeView.tsx` 를 인용한다. 해당 디렉토리 실제 파일 11개에 그 이름이 없다. 같은 심볼이 `layers.md:69`·`frontend/overview.md:76` 에도 있다.
- [ ] **D3** — `IPC_CONTRACT.md:445` 가 0062 에서 제거된 `prompts/` 를 가리킨다(`prompts/plan-feedback.ts`). 실제는 `adapters/plan-feedback.ts`. 채널 계약 SSOT 문서다.
- [ ] **D4** — `system-prompt.md:106` 이 현재 cwd 소유자로 부재 경로 `ipc/router.ts` 를 인용한다(핸들러는 `app/handlers/` 로 이설).
- [ ] **D5** — `adapters.md §3.2.5`(81·223·311~316)가 **"코드 진실 … 이미 구현·테스트된 코드다"** 로 `OrcaHookSet`·`OrcaHookEvent`·`OrcaHookHandler`·`ORCA_TO_CLAUDE_EVENT` 를 단언한다. `grep -rn OrcaHookSet app/src` = **0**. 실제는 `NormalizedHookSet`/`NormalizedHookEvent`/`NormalizedHookDecision`(`adapters/hooks.ts`) + `adaptHooks`(`claude-adapt.ts:120`). `provider-runtime.md:29`·`terms.md:30` 에도 같은 이름이 있다.
- [ ] **D6** — 자기보고 개수 3축이 어긋난다. ① AC2 잔여 `❌`: plan 5 · 구현자 6 · 재측정 **7**. ② plan §8 내역 합 18 ≠ 총계 20. ③ provider-runtime 몫 재측정 **13**(plan·구현자 모두 "11"). 재구현 시 세 숫자를 함께 고친다.

#### 파생 관찰 (수정 불요, 판단만 남긴다)

- guides §8.1 의 2번 명령 `npm run lint` = `eslint --cache --fix` — 배포자의 작업 트리를 조용히 고친다. D-005("보고 따라할 수 있도록") 관점에서 부작용을 한 줄로 밝힐 가치가 있다.
- `app/src/main/AGENTS.md:29` app 열거에 `settings-reactions.ts` 누락(`app/AGENTS.md` 에는 있음).
- `decisions/002-feature-slice-boundaries.md` 본문이 `prompts/` 정적 정책 체인 제거를 다루지 않는다 — AC6 의 ADR 링크가 근거를 담지 못한다.
- 루트 `AGENTS.md`(`src/shared/i18n/ko.ts`) ↔ `TRD.md N2`(`app/src/renderer/src/shared/i18n/`)가 갈렸다. D-007 이 의도적으로 범위 밖에 뒀다.
- `app/src/shared/ipc.ts:394` 주석이 개명 전 `InteractionBroker` 를 쓴다 — 코드라 이번 범위 밖(코드 변경 0).

### 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 라운드 1 이라 없음. **다만 D6 의 합계 축은 0187 r1·0189 r1·0190 r1 과 같은 축이다** — 이번엔 사본 3곳이 서로 일치했고(개선) 분모 자체가 실측과 갈렸다.
- 관련 plan 지침/AC 의 존재 여부: **부분적으로 있었다.** §10 이 "경로 실재" 를 강제 지점으로 세웠고 구현자가 "심볼 실재" 를 추가로 올렸다. 두 축 모두 *전수 정의*가 없었다 — 스윕 정규식이 곧 정의가 되어 그 밖은 아무도 세지 않았다.
- 사용자 결정 변경 근거: 없음. Decision Ledger 무변경.
- 반복된 검증 환경 한계: **의존성 부재로 게이트 3개 미재현.** 0191 은 `npm ci` 가 되는 세션에서 구현됐고 검증 세션에는 `node_modules` 가 없다 — 구현/검증 환경이 갈리면 AC7 형 "명령 실행" AC 는 검증자가 재현할 수 없다.
- 현재 라운드 수: 1

### 15. 결론

**FAIL (라운드 1).** AC 12건 중 8건이 재측정으로 충족되고 4건이 ⚠️ 다. Product/UX 핵심 흐름의 큰 몫 — 스윕 대상 경로 20→0, guides §8 재작성, 상태 표기 8건 정정 — 은 코드 대조로 확인됐고 ACTIVE Decision 7건과 충돌이 없다. 그러나 이번 작업이 세운 불변식("문서가 인용한 경로·심볼이 실재한다")이 전수로 닫히지 않았고(D1~D5), 자기보고 개수가 실측과 갈린다(D6).

다음 주체는 **Claude(재구현)** 다. D1~D6 을 닫을 때 스윕 정규식을 상대 경로까지 넓히고, 심볼 축의 강제 지점을 §10 표에 정식으로 올린다.
