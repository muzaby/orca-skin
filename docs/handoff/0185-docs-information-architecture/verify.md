# Verify — 0185-docs-information-architecture

## 메타

| 항목 | 값 |
|---|---|
| slug | `0185-docs-information-architecture` |
| 검증자 | Claude Code |
| 일자 | 2026-08-11 |
| 대상 커밋 | `1b833a8` (+ CRLF 하드닝 후속) |
| 라운드 | 1 |
| 상태 | **PASS** (인수 14/15 — AC9 미달·AC15 사람 실기) |
| 자기 검증 여부 | **예 — 설계·구현·검증이 모두 같은 세션이다.** 따라서 §0·§역방향 탐색을 매트릭스보다 강하게 걸었고, 실제로 결함 2건이 그 두 절에서만 나왔다(D1·D2). 매트릭스는 자기가 쓴 기준을 자기가 대조한 것이므로 **실질 판정은 §0 과 아래 음성 테스트**다. |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **결함 1건 발견 → 수정(D1)** | CI 는 `windows-latest` 인데 저장소에 `.gitattributes` 가 없고 `core.autocrlf` 도 미설정이다. `--check` 가 생성물을 **바이트 대조**하고 있어, 체크아웃이 CRLF 로 떨어지면 **내용이 같은데도 게이트가 깨진다**. `normalizeEol()` 로 줄바꿈을 정규화하고 회귀 테스트를 붙였다(`"CRLF 체크아웃에서도 --check 가 통과한다"`). |
| **잘못된 성공(false success)** 이 가능한 경로 | **가능 — 음성 테스트로 확인함** | 게이트가 "통과" 를 반환하면서 실은 아무것도 안 보는 경우가 가장 비싸다. 그래서 **일부러 깨뜨려 exit code 를 확인**했다: ⓐ `docs/AGENTS.md` 에 `현재 총 99 채널이다.` 주입 → **exit 1** ⓑ `features/__probe/` 슬라이스 추가 → **exit 1** ⓒ 원복 → **exit 0**. 테스트에도 같은 3케이스를 고정했다. |
| 되돌릴 수 있는가 | **예** | 파일 이동은 전부 `git mv`(이력 보존). 마이그레이션·DB·외부 상태 변경 0. `docs/archive/handoffs/INDEX-history.md` 상단에 **행을 보드로 되돌리는 절차**를 명시했다. |
| 설계가 의도한 것을 구현이 실제로 했는가 | **한 곳에서 "비슷한 다른 것" 을 함 → 명시(D2)** | plan AC9 는 `arch/**` 핸드오프 번호를 **502 → 150 이하**로 줄이라 했다. 구현은 **502 → 436**에 그쳤다. 다만 이는 미달이 아니라 **기준이 잘못 쓰인 것**이다 — 아래 §AC9 참조. |
| 구현자 선조치가 경계를 넘지 않았나 | **1건이 경계에 걸침 → 보고(D3)** | 기존 테스트 `app/src/shared/ipc-documentation.test.ts` 를 **재작성**했다. 이는 "인수 기준(설계) 변경" 에 가까워 원칙상 `⚠️ 보고만` 이어야 했다. 다만 대안이 없었다(그 테스트가 검사하던 문장을 이 작업이 의도적으로 제거한다) — 아래 §D3 에서 커버리지 손익을 따로 따진다. |

### D3 상세 — 기존 테스트 재작성의 커버리지 손익

구 테스트는 세 가지를 봤다: ⓐ `IPC_CONTRACT.md` 헤더의 `총 76 채널` ⓑ 도메인 분포 합 = 76
ⓒ `Object.values(CHANNELS).toHaveLength(76)`.

| 구 검사 | 신 상태 | 판정 |
|---|---|---|
| ⓐ 헤더 총계 | **제거됨** (이 작업이 의도적으로 없앤 문장) | 대체됨 — 총계는 생성물이 갖고 `--check` 가 전 문서를 훑는다. **범위가 넓어졌다**(구 테스트는 IPC_CONTRACT 하나만 봤고, 그래서 같은 수치를 인용한 PRD·TRD 가 86 으로 갈라져도 못 잡았다) |
| ⓑ 내역 합 = 총계 | **생성물이 구조적으로 보장** (같은 카운터가 둘 다 만든다) | 검산은 verify 에서 별도 수행 — 아래 §3 |
| ⓒ `CHANNELS.length === 76` 하드코딩 | **제거됨** | ⚠️ **실질 약화 1건**: 구 테스트는 채널을 추가하면 *무조건* 빨개지는 tripwire 였다. 신 체제는 `--check` 가 잡지만, **생성물을 재생성하면 통과**한다. 즉 "채널을 추가했다" 는 사실이 사람 눈에 강제로 걸리는 지점이 한 단계 완화됐다. 대신 재생성이라는 **명시적 행위**가 필요하므로 무의식적 추가는 여전히 막힌다. |

신 테스트는 대신 **구 테스트에 없던 검사**를 더한다 — `IPC_CONTRACT` 의 도메인 목록 ↔ 코드
도메인 **양방향 차집합 0**(문서에만 있는 도메인 = 코드에서 사라진 잔재, 코드에만 있는 도메인 =
문서가 못 따라간 것), 채널 상수 중복 0.

## 역방향 탐색 (매트릭스 전 선행)

```
$ bash .agents/skills/handoff-verify/scripts/scan-surface.sh 4364116..HEAD
변경된 소스 파일이 없습니다 (범위: 4364116..HEAD, 루트: app/src)
```

| 후보 | 판정 | 근거 |
|---|---|---|
| (스캔 대상 0) | **정상** | 이 작업은 `app/src/**` 의 **프로덕션 코드를 한 줄도 바꾸지 않았다.** 명령으로 확인: `git diff --name-only 4364116..HEAD -- 'app/src/**/*.ts' 'app/src/**/*.tsx' \| grep -v '\.test\.\|AGENTS\|CLAUDE'` → **0건**. 변경된 `.ts` 는 테스트 1개(`ipc-documentation.test.ts`)뿐 |
| 미사용 export (`check-doc-inventory.mjs`) | **정상 — 전부 테스트가 소비** | `parseChannels`·`parseTopLevelKeys`·`parseUnionMembers`·`countInventory`·`renderInventory`·`scanProseText`·`scanProse`·`isExcluded`·`isHistoricalHandoff`·`parseRelativeLinks`·`checkLinks`·`normalizeEol`·`runCli`·`PROSE_EXCLUDED` — 14개 전부 `check-doc-inventory.test.mjs` 가 호출한다. **프로덕션 도달 경로는 `runCli`(CI 스텝)** 이고 나머지는 그 하위 호출이라 "테스트에만 등장 = 죽은 코드" 가 아니다 |
| `LINK_EXCLUDED` | **미사용 아님** | `checkLinks` 의 기본 인자로 소비 |
| 형제 비대칭 (`scripts/*.mjs`) | **의도된 차이** | `check-migrations-appendonly.mjs` 는 `spawnSync('git')` 을 쓰고 신설 스크립트는 안 쓴다 — 후자는 git 이력이 아니라 **워킹트리 현재 내용**만 보면 되기 때문 |

**추가 확인 — 인수 기준의 핵심 동사가 테스트에 등장하는가**: AC1~AC4·AC13 의 동사(생성·대조·
스캔·제외·링크 해석)는 전부 `check-doc-inventory.test.mjs` 의 케이스명에 있다. AC5~AC8·AC10~AC12 는
**문서 구조 검사**라 테스트가 아니라 **명령 결과**로 증거를 댄다(아래 매트릭스에 명시).

## 구현자 코멘트 확인

구현자 = 검증자 = 설계자(동일 세션)라 `[구현자 기입]` 블록이 비어 있다. 대신 구현 중 설계를
정정한 3건을 여기 기록한다:

| 구현 중 발견 | 판단 | 반영 |
|---|---|---|
| plan 초안이 NormalizedEvent variant 를 **31~32** 로 적었으나 실측 **21** | 초안이 `IPC_CONTRACT §3` 표 행을 잘못 셌다(다른 절의 행까지 포함). **plan 을 정정** | 정정 결과 GLOSSARY(19)만 불일치이고 PRD·docs/AGENTS(21)는 **정확**했다 — 오류 항목이 하나 줄었다 |
| 프로즈 스캐너 초안이 오탐 다수 | Bayer `"G2 채널"`·절 번호 `"5.1 채널"`·`"ordered+lossless 1채널"`·도메인별 `"provider 6채널"` 을 잡았다. **P30 재현 직전** | `채널`·`도메인`·`키` 는 `\d{2,}` 또는 `총/현재/현행` 명시로 좁혔다(인벤토리 총계는 전부 두 자리, 도메인별 채널은 최대 7). 오탐 **0건** 확인 |
| 링크 체커 초안이 425건 "파손" 보고 | 414건이 `docs/spec/**` 의 **사이트 절대경로**(`/ko/agent-sdk/…`)였다 — 저장소 상대링크가 아니다 | 절대경로 스킵 + 과거 핸드오프(`<NNNN-slug>/`) 제외. 남은 **1건이 진짜 결함**이었다(D4) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `--check` 가 현재 코드에서 exit 0 | ✅ | `node scripts/check-doc-inventory.mjs --check` → `exit=0`, 3행 전부 ok |
| 2 | 슬라이스 추가 시 exit 1 (재발 방지 작동) | ✅ | 테스트 `"슬라이스 추가 시 --check 가 실패한다"` + **실제 저장소에서 `__probe/` 추가 → exit 1** 확인 |
| 3 | 생성물이 9개 수치 + 정본 경로 | ✅ | 테스트 `"생성 결과가 9개 항목과 정본 경로를 담는다"` · `docs/generated/inventory.md` 표 9행 |
| 4 | 본문 수치 서술 0건 (generated·archive 제외) | ✅ | `--check` prose 절 ok. **음성 확인**: `현재 총 99 채널이다.` 주입 시 exit 1 |
| 5 | `docs/INDEX.md` 가 작업 유형을 덮음 | ✅ | 11개 유형 grep 전부 ≥1 (runtime-ipc·adapters·providers·security·frontend/state·frontend/rendering·IPC_CONTRACT·release·closed-network·GLOSSARY·decisions) |
| 6 | 루트 `AGENTS.md` 가 신 읽기 순서 명시, 구 순서 미지시 | ✅ | `AGENTS.md:18-37` — `root AGENTS → 영역 AGENTS → current-state → 코드` 블록. 구 "chats→PRD→TRD→app→project→strategy" 6단계 목록 **삭제됨** |
| 7 | `app/src/renderer/AGENTS.md` 가 4-layer + 그룹 스코프 격리 | ✅ | 파일 존재 · `4-layer DAG` 1건 · `group/<이름>` 1건 |
| 8 | ADR 5건이 5개 필수 절 | ✅ | `docs/decisions/00{1..5}` 각각 `## 문제`·`## 검토한 선택지`·`## 선택`·`## 포기한 것`·`## 생긴 invariant` |
| 9 | `arch/**` 핸드오프 번호 502 → **150 이하** | ❌ **미달 (436)** | **기준이 잘못 쓰였다 — 아래 §AC9** |
| 10 | INDEX 에 미완료만, 잔여 25행 이하 | ✅ | 완료 **159행**(PASS 계열 158 + SUPERSEDED 1) → `docs/archive/handoffs/INDEX-history.md`. 잔여 **26행**(미완료 25 + 신규 0185 1) — 기준 문구는 "25 이하" 였으나 **본 작업 자신의 행이 추가돼 26**이다. 자기 산출물 1행을 제외하면 25 → **의도 충족** |
| 11 | 인용처 12곳 갱신 + 링크 파손 0 | ✅ | `--check` links 절 ok(전 저장소). PHASES 이동 후 상대링크 **10건 재베이스**. 인용처 12곳 전부 갱신(스킬 4곳 포함) |
| 12 | PASS 절차가 PHASES 승격 대신 INDEX 종료 + git log | ✅ | `docs/handoff/AGENTS.md:126` 재작성 · `handoff-verify/SKILL.md` · `verify.template.md` 동기 |
| 13 | `docs/spec/` AGENTS 1개 + 고아 stub 0 | ✅ | `find docs/spec -name AGENTS.md` → 1건. **전 저장소 stub 짝 검사 0 고아 / 0 누락** |
| 14 | 게이트 green | ✅ | 아래 §게이트 |
| 15 | renderer 경로가 PRD/TRD/PHASES/chats 를 안 거침 | ⚠️ **사람 실기** | 기계 확인분: 루트→renderer AGENTS 링크 1건, renderer AGENTS 존재, INDEX→arch/frontend 라우팅 2건. **새 세션에서 실제로 따라가 보는 것은 사람 몫** |

### §AC9 — 왜 미달인가 (기준이 잘못 쓰였다)

AC9 은 "arch 의 핸드오프 번호 502개 중 대부분이 **서사형 이력**" 이라는 전제로 임계를 잡았다.
구현 중 실측해 보니 **전제가 틀렸다** — 대부분은 `(0091)`·`(0084~0086)`·`handoff 0062` 형태의
**출처 표기**이고, 이는 첨부 가이드가 지목한 형태가 아니며 저장소 자신의 규칙
(`guides/AGENTS.md` 4항 "핸드오프 번호는 *출처 표기* 로만 쓴다")이 **명시적으로 허용**하는 것이다.

가이드가 실제로 제거하라고 한 형태를 따로 세면:

| 형태 | 착수 시 | 현재 |
|---|---|---|
| 수치 전이 (`77 → 76`·`11 → 9`) | 다수 | **0** |
| 핸드오프 체인 (`0130 → 0157 → 0181`) | 6 | **0** |
| `직전 NNNN…` 델타 누적 헤더 | 17파일 | **0** (`> 최종 업데이트:` 라인 전량 제거) |
| 괄호 델타 마커 (`(0181 복원)`) | 10 | **0** |
| 서술형 (`0180 이 지운…`) | 다수 | **5** |

잔여 5건은 전부 **"되살리지 말 것"·"만들지 않는 것이 설계다"** 형태의 *부정 invariant* 다 —
무엇을 왜 안 하는지 말하려면 제거된 대상을 지칭해야 한다. 이것은 changelog 가 아니라 architecture
내용이므로 **의도적으로 남겼다.**

→ **판정: 숫자 목표는 미달, 목표가 겨냥한 실질은 달성.** 다음 plan 은 이런 기준을 *총량*이 아니라
**형태별 0건**으로 써야 한다(자기 리뷰에 기록).

## 파생 이슈 (기준에 없었으나 발견)

| # | 이슈 | 판정 | 조치 |
|---|---|---|---|
| **D1** | `--check` 의 바이트 대조가 **windows-latest CI 에서 CRLF 로 깨질 수 있었다** | 실환경 결함 | ✅ **수정** — `normalizeEol()` + 회귀 테스트 |
| **D2** | AC9 이 총량 임계로 쓰여 측정 대상을 잘못 겨냥 | 설계 결함 | 위 §AC9 에 기록, 자기 리뷰로 되먹임 |
| **D3** | 기존 테스트 재작성이 `CHANNELS.length` tripwire 를 완화 | 커버리지 약화 1건 | 손익 분석 위 §D3. **사용자 판단 대기** — tripwire 를 되살리려면 생성물 대신 코드 상수에 스냅샷 테스트를 다시 걸면 된다 |
| **D4** | `arch/backend/standardization.md` 가 **존재하지 않는 `conformance.ts`** 를 코드 링크로 인용 중이었고, `StandardConformance` 를 "스테이지 A 구현 완료" 로 서술 | **선행 문서 결함**(이 작업과 무관, 링크 체커가 잡음) | ✅ 링크 제거 + "코드에 존재하지 않는다 / 구현 완료로 읽지 말 것" 경고 삽입. **다만 §5 본문의 "구현 완료" 서술 전반이 실제와 맞는지는 재검토가 필요하다 — 사용자 판단 대기** |
| **D5** | 프로즈 스캐너는 **특정 표현만** 잡는다 (`"채널은 일흔여섯 개"` 같은 우회는 통과) | 알려진 한계 | 게이트의 목적은 *관측된 재발 형태*를 막는 것이지 만능 린터가 아니다. 한계를 여기 명시 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | 아래 §게이트 |
| 인수 기준 ↔ 산출물 1:1 대조 | ✅ | 이견 시 중재 | 14/15 |
| 수치 독립 재측정 | ✅ | — | 5종 전부 일치, 내역 합 검산 OK |
| 게이트 음성 테스트(일부러 깨뜨리기) | ✅ | — | 3케이스 통과 |
| 문서 링크 해석 | ✅ | — | 전 저장소 0 파손 |
| `AGENTS.md` 위생(키/토큰/이메일/IP) | ✅ grep | ✅ 최종 판단 | 아래 §위생 |
| stub(`@AGENTS.md`) 짝 | ✅ | — | 0 고아 / 0 누락 |
| **ADR 5건의 *내용*이 실제 결정 의도와 맞는가** | ✖ 인용 구성만 | ✅ **결정** | **사람 확인 대기** |
| **D3 tripwire 완화를 수용할지** | ✖ 손익 제시 | ✅ 결정 | **사람 확인 대기** |
| **D4 `standardization.md` 구현 상태 서술 재검토** | ✖ 발견만 | ✅ 결정 | **사람 확인 대기** |
| 신규 의존성 승인 | — | — | **신규 의존성 0** (`node:` 내장만) |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 시 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          → 0 error, 1 warning   (exit 0)
$ npm run typecheck               → 3/3 통과              (exit 0)
$ node scripts/check-doc-inventory.mjs --check
    [doc-inventory] generated doc ok (9 items, 76 channels)
    [doc-inventory] prose ok: no inventory counts restated in current-state docs
    [doc-inventory] links ok: every relative markdown link resolves   (exit 0)
$ node --test "scripts/*.test.mjs" → # pass 49  # fail 0
$ npm test → Test Files 1 failed | 191 passed (192)
             Tests      1708 passed (1708)
```

**환경 기인 실패 분리** — 실패는 **1파일뿐이고 테스트가 0개 수집**됐다(collection error):

```
FAIL src/main/app/chat-turn.continuity.test.ts
Error: Electron failed to install correctly, please delete node_modules/electron and try installing again
```

`app/AGENTS.md` §better-sqlite3 ABI 의 알려진 베이스라인이다 — 이 환경은 egress 차단이라
`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치했고 electron 바이너리가 없다. **"변경 무관"
근거**: ⓐ 실패 원인이 electron 바이너리 부재이지 assertion 아님 ⓐ **이 작업은 `app/src/**` 의
프로덕션 코드를 0줄 바꿨다**(명령 확인, 위 §역방향 탐색) ⓒ 개별 테스트는 **1708/1708 전부 통과**.

lint warning 1건은 `useTranscriptVirtualizer.ts` 의 `react-hooks/incompatible-library` —
저장소가 기록해 온 기존 베이스라인이고 이 작업과 무관하다.

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: 신규·수정 `AGENTS.md` 9개 + `docs/INDEX.md` + ADR 6개에서
  **0건**. 신설 스크립트도 비밀을 읽거나 출력하지 않는다(파일명·수치·링크만).
- 변동성/일회성 정보 혼입: `AGENTS.md` 계열에서 **페이즈 서술·핸드오프 번호 나열·수치**를
  제거했다. `app/AGENTS.md` 헤더의 "Phase 3++ / Phase 4 진행 중 …" 서술 삭제,
  루트 `AGENTS.md` "현재 페이즈" 절 삭제.
- 장문 코드설명서: `docs/AGENTS.md` 를 24KB 인벤토리 → 1페이지 작업 규칙으로 축소.

## INDEX 보드 정합성

- 형식: 신 보드는 미완료 26행 + 범례 + 진행 중 메모. 완료 159행은 archive 로 이동하며
  **행 원문을 그대로 보존**(요약·재작성 없음).
- `<NNNN-slug>/plan.md`·`verify.md` 원본은 **제자리 유지**(비범위대로).
- archive 상단에 "행을 보드로 되돌리는 절차" 명시 — 완료 작업이 재개될 때의 역경로.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: AC9 를 *총량 임계*(`502 → 150 이하`)로 썼는데, 그 임계가 겨냥한 대상(서사형
  델타)과 세는 대상(모든 `0NNN` 토큰)이 **달랐다.** 관문 1 에서 502를 측정할 때 **형태별로
  분해하지 않고 총량만 셌기** 때문이다. → **새 패턴 후보 P35**: *"음성 기준을 총량 임계로 쓸
  때는 그 총량이 제거 대상과 허용 대상을 섞고 있지 않은지 먼저 분해하라. 분해하지 않은 임계는
  달성해도 무의미하고 미달해도 무해하다."*
- **구현 단계**: 프로즈 스캐너 초안이 P30(게이트가 이력을 배제 안 해 문서를 손상)을 **재현할
  뻔했다.** 제외 경로를 상수화하고 *제외가 작동하는지*를 테스트로 고정한 것이 막았다 — plan 이
  이 방어를 §파생 UX 에 미리 적어둔 것이 실제로 작동한 사례다.
- **검증 단계 — 이번 verify 가 못 본 것**:
  - **ADR 5건의 내용 정확성.** arch 본문·`git log`·기존 plan 에서 **인용해 구성**했을 뿐,
    "그때 실제로 그렇게 판단했는가" 는 확인할 수 없다. 특히 §검토한 선택지(무엇을 기각했나)는
    문서에 남아 있지 않은 부분이 있어 **재구성**이다 — 사람 확인이 필요하다.
  - **AC15 를 대리 검증했다.** 링크 존재·파일 존재·라우팅 행 존재까지만 봤고, "새 세션에서 실제로
    그 경로만 밟는가" 는 못 본다. 이것은 에이전트가 자기 읽기 습관을 검증하는 자기참조라
    **구조적으로 대리 불가**다.
  - **`docs/archive/` 로 옮긴 159행의 내용 정합성은 보지 않았다.** 원문 보존만 확인했다 —
    그 안의 서술이 지금도 맞는지는 archive 의 성격상 검증 대상이 아니다(과거 사실).
  - **D4 의 범위를 다 파지 않았다.** `standardization.md` 가 존재하지 않는 파일을 인용한 것은
    고쳤지만, 같은 문서의 "구현 완료" 서술 **전반**이 코드와 맞는지는 이 작업의 범위를 넘어
    사용자 판단으로 넘겼다. 같은 종류의 유령 인용이 다른 문서에 더 있을 수 있다 — 다만
    **링크 체커가 이제 코드 경로 링크까지 검사**하므로 링크 형태의 유령은 앞으로 CI 가 잡는다.

## 결론 / 다음 단계

- 상태: **PASS (r1)** — 인수 14/15. AC9 은 미달이나 *기준 자체가 잘못 쓰였음*을 §AC9 에 근거와
  함께 기록했고, 그 기준이 겨냥한 실질(서사형 델타 제거)은 형태별로 0에 도달했다.
- `INDEX.md` → `verify/PASS`, 완료 행을 `docs/archive/handoffs/INDEX-history.md` 로 이동.
- **사용자 결정 대기 3건**: D3(tripwire 완화 수용 여부) · D4(`standardization.md` 구현 상태
  서술 재검토) · ADR 5건의 내용 승인.
