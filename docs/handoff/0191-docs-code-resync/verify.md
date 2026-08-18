# Verify — 0191-docs-code-resync

> 라운드 1·2·3 판정 원문은 이 문서 하단 부록([r3](#부록--라운드-3-검증-fail-원문-보존) · [r2](#부록--라운드-2-검증-fail-원문-보존) · [r1](#부록--라운드-1-검증-fail-원문-보존))에 보존한다. 본문은 재서술하지 않고 링크한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0191-docs-code-resync` |
| 검증자 | Claude Code |
| 일자 | 2026-08-18 |
| 대상 커밋/range | `53538c2..3bf0f1e` (구현 `7f5638c` · 해시 기입 `3bf0f1e`) |
| 구현 전 plan 기준 | `53538c2` (r3 verify 커밋). 선행 review `3ba56cb` 은 `plan.md` 무변경 |
| 라운드 | 4 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증·review 모두 Claude Code — 자기 검증이다 |

## 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** `53538c2`(r3 verify) → `3ba56cb`(review Round 10, plan 무변경) → `7f5638c`(r4 구현) → `3bf0f1e`(해시 기입).

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다** — 메타 상태 1줄 · §10 계측층 항목 · §19 B 축 실재 테스트 · S5 추출 · `sort -u` · 버킷표 · 시제 게이트 신설 · r4 절 · F1~F3 상태.
- **그 변경이 승인된 범위인가: 그렇다.** `git diff 53538c2..HEAD -- plan.md` 의 hunk 헤더는 `8`·`221`·`338`·`382`·`390`·`736`·`774` 뿐이다. §19 세 축은 verify r3 §13 "처리 방향 제안" 의 ⓐⓑⓒ 원문이고 각 정정에 `[r4 개정 — 출처: verify r3 …]` provenance 가 붙어 있다.
- **AC 변경: 없음** — §7 AC 표(96~112행)·§3 Decision Ledger(31~48행)에 hunk 가 없다. 분모는 12 그대로다.
- Product/UX Contract(§1~§5) 변경: 없음.
- **AC13 미신설은 사용자 결정이다** — 구현자가 시제 축의 AC 승격을 물었고 사용자가 "§19 게이트로만" 을 골랐다(plan r4 «설계 리뷰»). 채점 분모를 늘리지 않는다.
- 채점에 사용할 원 기준: `53538c2` 의 §3 Decision Ledger · §7 AC1~AC12 · §10 강제 지점 표.

**계측을 고친 주체가 구현자다.** 세 축(B 경계 매칭 · S5 호출식 · 시제 필터)은 이번 라운드에 구현자가 만들었다. `handoff-verify §8` 에 따라 **재현이 아니라 엄격화 재측정**으로 판정한다 — 결과는 §3 이고, 이번 FAIL 이 그 자리다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 = `docs/` 전수 + app 하위 AGENTS | 두 축 모두 | r4 는 docs 5 + handoff 2. `AGENTS.md` 변경 0(`git show --stat 7f5638c`) |
| D-002 provider-runtime 은 경로·상태 문구만 | 절 구조 불변 | `^## ` **20개** — `1c9b260`(READY)부터 HEAD 까지 불변 |
| D-003 폐기 절 삭제 + ADR 링크 | 본문 소멸 | `system-prompt.md:77` = `## 2. 정적 정책 append — 미채택` · `:81` ADR-002 링크(대상 파일 실재) |
| D-004 guides 포함 | 3파일 | r4 는 guides 변경 0 — F1~F4 가 전부 `docs/arch`·`TRD`·`claude-code-spec` |
| D-005 "보고 따라할 수 있도록" | 명령이 실제로 돈다 | **검증자가 4종 전부 재실행**(§9). 산출이 구현 보고와 글자 그대로 같다 |
| D-006 OQ9 미결 | PRD 비범위 | `PRD.md` r4 diff **0** |
| D-007 루트 AGENTS 비범위 | 미변경 | 루트 `AGENTS.md` r4 diff **0** |

### end-to-end 흐름

```text
에이전트/배포자
  → docs/INDEX.md 라우팅
  → arch/*.md · guides/*.md · claude-code-spec.md
  → 인용 경로(A·B·C 3형태) · 인용 심볼(S1~S5) · 사이트의 시제
  → 실재/참이면 코드 도달 / 부재·거짓이면 조용한 오안내
```

**경로 축은 이번 라운드에 닫혔다.** 심볼 축은 게이트가 green 인데 **실재 테스트가 아직 substring** 이라 분모 자체가 좁다 — F1 이 경로 축에서 고친 바로 그 결함이 심볼 축에 남아 있고, 그 자리에서 거짓 단언 5건이 나온다(§3·§13).

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 조용하다 | 부재 인용은 예외를 던지지 않는다. 이 handoff 의 전제이고 불변 |
| false success 가능성 | **있다** | 심볼 실재 테스트 `grep -rnF` 가 substring — `ChatEvent` 가 `ingestChatEvent` 로 "실재" 판정된다(§3) |
| 〃 | **있다** | 시제 술어가 줄 단위라 **표 헤더에서 시제를 상속하는 행**을 못 본다(`:403`·`:409`) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | F1~F3 정정은 지시된 세 자리 그대로다. 세 문장 모두 코드 대조로 참(§6) |
| 증상만 제거하고 상태가 남았는가 | **부분적으로 그렇다** | F4 를 `claude-code-spec.md:103` 한 곳만 고쳤다 — 같은 파일 6사이트가 같은 거짓 단언을 유지하고, 그중 `:57` 은 고친 `:103` 과 **정면으로 모순**된다(§13 G2) |
| 이번 수정이 만든 새 표면 | **있다** | `:103` 이 도입한 `⛔` 는 같은 문서 각주 표기 범례(`✅`/`❌`/`⏳`) 밖이다. docs 전체에서 이 1곳뿐 |
| 출력/요청 worst-case 상한 | 해당 없음 | 코드 변경 0 |

## 3. 역방향 탐색

`handoff-verify §8` 이 요구하는 **엄격화 재측정**을 세 축에 걸었다. 두 축은 차집합이 비었고 한 축은 비지 않았다.

| 축 | 구현자 판정 기준 | 한 단계 엄격한 기준 | 재측정 | 차집합 |
|---|---|---|---|---|
| 경로 B | 접미사 경계 `(^\|/)p$` | + 백틱 인용의 `:행번호` 접미사형까지 추출 | 3사이트 추가 추출, 전부 실재 | **0** |
| 경로 C | 맨 파일명 `grep -qxF` | 〃 | 〃 | **0** |
| **심볼 실재** | `grep -rnF "$s"` = **substring** | `grep -rnwF "$s"` = **단어 경계** | 220 → **275사이트** | **+55** |
| ↳ 그중 시제 판정 대상 | 98 | 같은 술어를 strict 산출에 적용 | 98 → **118** | **+20** |

재현 명령(검증자 실행):

```bash
# plan §19 심볼 블록을 그대로 쓰되 실재 테스트 한 줄만 바꿔 두 벌을 만든다.
#   느슨(구현자 판정): hits=$(grep -rnF  "$s" $CORPUS 2>/dev/null)   → 220줄
#   엄격(검증자 판정): hits=$(grep -rnwF "$s" $CORPUS 2>/dev/null)   → 275줄
comm -13 <(sort /tmp/sym_F.txt) <(sort /tmp/sym_W.txt)   # 차집합 55줄
```

**차집합 55줄 중 결함 8건, 나머지는 개념어다.** `Screen`·`Tile`·`Slot`·`Delta`·`Pane`·`Router`·`Transcript` 등은 GLOSSARY/terms 의 개념어라 코드에 단독 심볼로 없는 것이 정상이다. 결함은 아래 두 무리다.

- **`ChatEvent` 11사이트** — 코드 실재 0. `grep -rnw ChatEvent app/src` 히트 3개가 전부 주석이고, 그중 `shared/protocol.ts:51` 이 "구 `ChatEventSchema` 는 `ChatEvent` 폐기와 함께 제거" 라 적는다. substring 이 `ingestChatEvent`(`chatStore.ts:562`)를 실재로 셌다. 11 중 **5사이트가 현재형 거짓 단언**(§13 G1), 나머지 6은 "구 …" 표기라 정상.
- **`AuthSpec` 5 · `pendingToolApproval` 2** — 각각 `AuthMethod`·`pendingToolApprovals` 로 개명/복수화됐고 substring 이 신 이름 안의 부분 문자열을 실재로 셌다(§13 G5·G6).

**표 헤더 시제 상속을 아무 축도 보지 않는다.** `provider-runtime.md:403`(`ChatEvent`)·`:409`(`detectError`)는 열 제목이 "**현행 코드 심볼**" 인 표의 행이다. 행 자체에는 `현행|현재|한다|이다|✅` 가 없어 시제 산출에 들어가지 않고, `:409` 는 심볼 산출에 **있었는데** `설계어휘·목표계약` 버킷에 들어가 통과했다 — 그 사이트에서는 설계어휘가 아니라 "현행" 단언이다.

**추출 축의 미기록 공백**: 맨 CamelCase 산문은 백틱도 `**bold**` 도 아니라 S1~S5 전부의 밖이다. `ClaudeCodeAdapter`(코드 0건)가 `claude-code-spec.md` **4사이트**에서 그 형태로 현재형 단언된다. §19 의 "넓히지 않은 축과 이유" 표에 이 축이 없다 — 넓히지 않기로 한 것이 아니라 보이지 않았다.

## 4. 기존 테스트 / semantic 검증 확인

- 코드 변경 0 이므로 코드 테스트는 인수 수단이 아니다(plan §11 «테스트 가능성»). 관측 수단은 grep 스윕과 guides 명령의 실제 실행이다.
- **적대 검사 3건은 유효했다.** 구현자가 `\b` 술어가 이 로케일에서 발화하지 않는 것을 발견해 산출을 47 → 98 로 늘린 것은 실제 성과다 — 검증자가 같은 술어로 돌려 **98 을 정확히 재현**했다.
- 다만 적대 검사는 **자기가 정의한 기준 안에서만** 결함을 심었다. 세 장치 모두 "이 장치가 보는 형태" 의 결함을 심었고, 장치가 애초에 보지 않는 형태(substring 실재·표 헤더 시제·맨 CamelCase)는 심어지지 않았다.

## 5. 요구사항 충족 매트릭스

| # | 검증자 재측정 | 판정 |
|---|---|---|
| AC1 | 경로 스윕 `A 0 / B 11 / C 9 = 20줄`, §19 예외표 12행과 1:1, 그 밖 0줄 | ✅ |
| AC2 | `grep -c ❌` → backend **4**(`:190`·`:201`·`:210`·`:212`) · frontend **3**(`:81`~`:83`) = **7행**, plan 열거와 동일 | ✅ |
| AC3 | `^## ` **20** (READY `1c9b260` ↔ HEAD 동일) · ③ 3곳의 새 인용 심볼·경로 전부 비주석 실재(§6) | ✅ |
| AC4 | 6패턴 각 **0파일**(`prepared-config`·`features/login/`·`SkillsPage`·`declarations/{sso,llm,service}`) | ✅ |
| AC5 | 비-test `.mjs` **6** = `app/AGENTS.md:144~150` 열거 6(헤더 `ensure-sqlite-abi` + 불릿 5) | ✅ |
| AC6 | `system-prompt.md:77` = `## 2. 정적 정책 append — 미채택` · `:81` ADR-002 링크, 대상 파일 실재 | ✅ |
| AC7 | §8.1 인용 `*.test.ts` **21종 · 부재 0**(추출 22 중 1은 `*.test.ts` 와일드카드 조각) · 명령 4종 실행(§9) | ✅ |
| AC8 | `closed-network-extensions.md:115` `app/deployment/auth-definitions.ts` = §1.1 트리 `:58` | ✅ |
| AC9 | `grep -rn disallowedTools app/src` = **0** · 가이드 미채택/보류 표기 유지 | ✅ |
| AC10 | `release-operations.md:12` ↔ `ci.yml:11~22` — `push[main]` · **`pull_request`** · `workflow_dispatch` · paths 동일 | ✅ |
| AC11 | `docs/INDEX.md:12`(`ARCHITECTURE.md`) · `:23`(`arch/frontend/overview.md`) | ✅ |
| AC12 | `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · exit 0 | ✅ |

**검산: ✅ 12 · ⚠️ 0 · ❌ 0 = 총 12.** 분모는 §7 의 AC1~AC12, 분할·추가 없음. 구현자 자기보고(12/12)와 일치하고 **본문·커밋 trailer 2개·INDEX 비고 세 사본이 모두 `12/12`** 다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| §10 계약 | 검증자 재측정 | 판정 |
|---|---|---|
| 수치를 본문에 쓰지 않는다 | `prose ok: no inventory counts restated in current-state docs` | ✅ |
| 상대 링크가 해석된다 | `links ok: every relative markdown link resolves` | ✅ |
| 인용 경로 실재 (A·B·C) | `0 / 11 / 9 = 20`, 예외표 1:1 | ✅ |
| 〃 **매칭 의미**(r4 신설) | `grep -qF` → `grep -qE "(^\|/)…$"` 확인. 엄격화(행번호 접미사)에도 차집합 **0** | ✅ **F1 닫힘** |
| 인용 심볼 실재 (S1~S5) | 220사이트/131심볼 **정확 재현**. 그러나 실재 테스트가 substring — 엄격화 차집합 **+55** | ⚠️ **전수 아님** |
| 〃 **판정 축(시제)**(r4 신설) | 98사이트 **정확 재현**. 부모 집합이 좁고, 술어가 줄 단위라 표 헤더 시제를 못 본다 | ⚠️ **전수 아님** |
| guides 절차 명령 실행 | 4종 전부 재실행, 산출 일치(§9) | ✅ |
| `arch/` 는 현재 상태만 서술 | r4 가 `docs/arch/` 에 더한 줄의 `0014`·`0015` 히트는 **변경 안 한 같은 줄의 기존 문구**(줄 중간 삽입이라 `+` 로 보인다). 신규 델타형 0 | ✅ |

**강제 지점 6/8.** 구현자 보고는 8/8 이고 여덟 행 모두 *재현* 되지만, r4 가 신설한 두 축은 §3 의 엄격화에서 차집합이 비지 않는다 — 재현은 검증이 아니다(`handoff-verify §8`).

**표에 없는데 같은 불변식이 필요한 지점: 있다.** `claude-code-spec.md` 의 "Orca 채택/미사용" 박스가 그 자리다(§13 G2) — 이 표는 심볼·경로·시제를 말하고, "채택 박스의 서술이 현재 실행 방식과 같은가" 는 어느 행도 묻지 않는다.

## 6. 외부 포트 / 문서 계약

**F1~F3 정정 세 건은 코드와 대조해 전부 정확하다.** 이번 라운드가 새로 쓴 산문이라 전건 확인했다.

| 정정 | 검증자 관측 | 판정 |
|---|---|---|
| F1 `state.md:105` `.ts`→`.tsx` | 실파일 `app/src/renderer/src/app/hooks/useSidebarSlots.tsx` 1개, `.ts` 는 0개. `layers.md:42` 와 동일 표기 | ✅ |
| F2-a `:274` ErrorClassifier | `infra/errors.ts:20` `ErrorClassifier` · `:32` `DEFAULT_RETRYABLE` · `:49` `makeClassifiedError` · `:57` `retryable ?? DEFAULT_RETRYABLE[category]`. 8 category | ✅ |
| 〃 두 경로 호출 | `adapters/claude.ts:214`(턴 `classifyError`) · `:455`(스트림) 가 `claudeErrorClassifier`(`error-classifier.ts:24`) 호출 | ✅ |
| F2-b `:346` AuthStore | `features/auth/store.ts:134` `class AuthStore` · `contracts/auth.ts:379` `AuthSecretReader` · 소비 2자리 `bootstrap.ts:325`(MCP `${BINDING}`)·`:447`(direct-credential) | ✅ |
| F2-c `:509` workspace-guard | `adapters/workspace-guard.ts:35`·`:53`·`:75`·`:116` 4 export 실재, `claude.ts:46` import + `:391` hook 주입 | ✅ |
| F3 `standardization.md:117` | 가리킨 `§5.2`(`:121`)의 구현 상태 `:146` 이 "disallowedTools 는 D1 사용자 확정 전이라 코드 주입 보류" — 형제와 대칭 | ✅ |
| F3 `TRD.md:387` | 가리킨 `§6.8`(`:344`)의 `:378` 이 "(0024 구현됨 / disallowedTools 보류)" | ✅ |

**단, F2 의 `§12 표` 포인터는 라벨과 어긋난다.** `:274` 가 "구 휴리스틱/enum 에서 이 포트로의 매핑은 §12 표에 있다" 로 보내는데, §12 의 열 제목은 "**현행 코드 심볼**" 이고 그 열의 `detectError`·`ChatEvent` 는 코드 0건이다(§13 G3).

## 7. 숫자 / 음성 기준 / 상한 재측정

| 구현자 보고 | 검증자 재측정 | 판정 |
|---|---|---|
| 경로 `0 / 11 / 9 = 20` | 동일. 20 = 예외표 12행이 덮는 줄 수와 1:1 | 일치 |
| 심볼 `220사이트 / 131심볼` | 동일(`wc -l` 220 · `cut -f2 \| sort -u` 131) | 일치 |
| 버킷 합 `63+75+58+10+10+4 = 220` | 산술 일치. future 버킷 **10사이트** 독립 재측정 일치, 비범위 버킷 4사이트 전부 `docs/PRD.md` | 일치 |
| 버킷 심볼 목록 | 표의 고유 백틱 토큰 125 − 약칭 2 − 경로 1 = 122, `+3`(`CLAUDE_CODE_*`) `+6`(`SDK*Message`) = **131** | 일치 |
| 시제 `98사이트` | 동일(같은 술어·같은 입력) | 일치 |
| r3→r4 delta `211 − 2 + 11 = 220` | 산술 일치 | 일치 |
| `disallowedTools` 전수 25사이트 | 코드 주입 0건 재확인. 정정 2곳 + 비결함 23 분류가 관측과 맞는다 | 일치 |
| AC7 인용 `21개 고유 문자열` | 추출 22 중 1은 와일드카드 조각 → 실질 21, 부재 0 | 일치 |

**자기보고 합계 축은 이번 라운드도 갈리지 않았다.** `12/12`·`8/8`·`220`·`98` 이 본문·trailer 2개·INDEX 비고에서 같은 값이다(0187 r1·0189 r1·0190 r1 이 어긋났던 축).

- 0건 게이트가 정당한 이력을 지우는가: 아니다. 경로 예외 12행은 전부 "구/폐기/외부/설계어휘" 사유가 같은 줄에 있다.
- 총량 임계가 제거 대상과 허용 대상을 섞는가: **섞는다** — `비범위 — 보고만` 버킷이 *결함 여부* 와 *수정 범위* 두 축을 한 라벨에 담는다(r3 O5 의 재관찰, 수정 불요).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

- 이번 라운드에서 사람에게 넘긴 순수 로직: **없다.** F1~F4 판정은 전부 grep/파일시스템으로 기계 확인했고 검증자가 재측정했다.
- 남는 사람 실기는 `closed-network-extensions.md §8.2` 의 사내 로그인 왕복 하나다(plan §19 명시, r1~r4 불변).
- **시제 판정은 육안이지만 사람 실기가 아니다** — 검증자가 118사이트를 직접 읽어 판정했고 그 결과가 §13 이다.

## 9. 게이트 재실행

`app/AGENTS.md` 의 ABI 가이드를 따랐다. `npm test` 는 쓰지 않았다(DB 동작 검증 불요). **exit code 가 아니라 산출을 적는다.**

| 명령 | 검증자가 관측한 산출 |
|---|---|
| `node scripts/check-doc-inventory.mjs --check` | `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · exit 0 |
| `npm run typecheck` | 하위 3개(`:node`·`:web`·`:test`) 전부 실행, **error 0줄** |
| `npm run lint` | `✖ 1 problem (0 errors, 1 warning)` — `react-hooks/incompatible-library` @ `useTranscriptVirtualizer.ts:22` |
| `./node_modules/.bin/vitest run src/main/features/{auth,gate,harnesses,plugins} src/main/app` | `Test Files 1 failed \| 40 passed (41)` · `Tests 506 passed (506)` |

- **환경 기인 실패 분리**: 실패 1파일 = `src/main/app/chat-turn.continuity.test.ts`, 서명 `Error: Electron failed to install correctly` @ `node_modules/electron/index.js:17`. r1~r4 동일 서명이고 코드 diff 0 이라 **이번 변경과 무관**.
- **게이트가 작업 트리를 바꿨는가: 아니다.** 네 명령 전후 `git status --short --untracked-files=all` 이 빈 출력이다. `npm run lint` 는 `--fix` 가 붙지만 수정 대상이 없었다.
- **검증자 명령이 남긴 잔여물**: 없다. 스윕 산출은 전부 `/tmp` 에 썼고 저장소에 미추적 파일이 생기지 않았다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

- 에이전트가 확인한 것: 경로·심볼 실재, 시제 판정 118사이트, AC 12건, 강제 지점 8행, 게이트 4종, INDEX/trailer/해시 정합.
- 사람이 결정할 것: **G2 의 처리 범위** — `claude-code-spec.md` 를 어디까지 현재화할지(6사이트 전부인지, `⛔` 방식인지, 문서 자체를 spec 미러 라우터로 축소할지)는 제품 문서 정책이다. §13 은 관측만 남긴다.
- 사람이 결정할 것: `disallowedTools` 채택 여부(D1) — r2~r4 동일, 미변경.

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 이번 라운드 `AGENTS.md` 변경 **0** — `git show --stat 7f5638c` 에 `AGENTS.md` 없음. 위생 검사 대상 없음.

### INDEX 보드 정합성

- 상태 `impl / IMPL_DONE (r4) / Claude(검증) / 7f5638c / 4` — plan 메타·구현 보고와 일치.
- 비고 **627자**(r3 815자에서 감소). r3 O4 가 지적한 증가 추세가 꺾였다.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer: `Agent: claude` · `Handoff: docs/handoff/0191-docs-code-resync/` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 허용값 안이고 두 커밋이 같다.
- 인용 해시 실재: `7f5638c` ✅ · `3ba56cb`(review Round 10) ✅ · `f9258f4`(r3) ✅. 죽은 좌표 없음.
- reference: r4 는 파일 이동/삭제 0.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 처리 | 검증자 판정 |
|---|---|
| F4 `claude-code-spec.md:103` 을 **선조치** | **경계는 맞고 범위가 부족하다.** 문장 정정이라 선조치가 맞다. 그러나 같은 파일 6사이트를 남겨 문서가 자기모순에 빠졌다(§13 G2) |
| `sort -u` 명시(O2) · `SDKUserMessageReplay` 명시(O1) | 타당. 재현자가 raw 를 보던 문제가 닫혔고 목록 누락도 닫혔다 |
| AC13 미신설을 **보고만** | 타당 — 사용자 결정이다. 다만 구현자 자신이 적은 "다음 라운드가 §19 를 안 돌리면 이 축은 사라진다" 가 그대로 남는다 |
| ADR 링크 교체·PRD·루트 AGENTS 를 **보고만** | 타당 — D-003·D-006·D-007 범위 밖. diff 0 으로 확인 |
| `adapters.md:55` 를 파생 이슈로 남김 | 타당. 검증자도 같은 판정 — 코드 샘플 주석이고 `:67` 이 같은 절에서 해소한다 |

**선조치 권한을 넘긴 것은 없다.** 제품 결정(D1 채택 여부·AC 승격·ADR 링크)은 전부 보고에 머물렀다.

## 13. [FAIL 시] 파생 이슈

- [ ] **G1** — **`ChatEvent` 5사이트가 없는 코드 심볼을 현재형으로 단언한다.** 실측: `grep -rnw ChatEvent app/src app/scripts` 히트 3개 전부 주석이고 `shared/protocol.ts:51` 이 "구 `ChatEventSchema` 는 `ChatEvent` 폐기와 함께 제거 — 와이어가 `NormalizedEvent` 로 전환됨" 이라 적는다. `grep -cw ChatEvent app/src/shared/ipc.ts` = **0**(문서가 인용하는 바로 그 위치). 거짓 사이트 — `provider-runtime.md:17`("실제 코드 심볼(`ChatEvent`…)은 변경하지 않는다") · `:25`(표 열 제목 "**현재 코드**") · `:35`("**현재는** … 두 `ChatEvent` 로 흐른다") · `:403`(§12 열 제목 "**현행 코드 심볼**", 위치 `src/shared/ipc.ts`) · `claude-code-spec.md:167`. 같은 문서 `:37`·`:61` 은 "구 `ChatEvent` 타입 완전 제거, PR #47" 이라 적어 **자기모순**이다(E1·F2 와 같은 형태). 게이트가 못 본 이유: §19 심볼 실재 테스트 `grep -rnF` 가 **substring** 이라 `ingestChatEvent`(`chatStore.ts:562`)를 실재로 세고 11사이트 전부가 분모에서 빠졌다 — **F1 이 경로 축에서 닫은 그 결함이 심볼 축에 그대로 있다.**
- [ ] **G2** — **F4 의 불변식이 1/7 사이트에만 적용됐다.** r4 는 `claude-code-spec.md:103` 을 `⛔ Orca 비적용`(SDK `query()` 인프로세스, `stream-json` 0건)으로 고쳤다. 같은 파일에서 같은 단언이 살아 있는 곳 — `:28`(표 "CLI(`claude -p`) … `child_process.spawn` 으로 매 턴 새 프로세스 / **✅ Phase 1 채택**") · `:57`(**✅ Orca v1 채택** — "ClaudeCodeAdapter 가 매 턴 `claude -p … --output-format stream-json …` 형식으로 `child_process.spawn` **한다**") · `:167` · `:302` · `:366`(**❌ Orca v1 미사용** — "ClaudeCodeAdapter 는 `-p <text>` 로만 전달**한다**") · `:399`("CLI `claude -p` + `child_process.spawn` 은 **폐기 예정**" — 이미 0건). 코드 실측: `claude.ts:12` 가 `@anthropic-ai/claude-agent-sdk` 를 import 하고 `:270`·`:345` 가 `query()` 를 부른다 · `grep -rn stream-json app/src` = **0** · `grep -rnw ClaudeCodeAdapter app/src` = **0**. **`:57` 은 고친 `:103` 과 정면 모순이다** — r4 이전에는 문서가 일관되게 틀렸고, r4 이후에는 §3 만 맞고 §0·§1 이 반대로 말한다.
- [ ] **G3** — **`provider-runtime.md §12` 의 "현행 코드 심볼" 열에 부재 심볼 2/11.** `ChatEvent` **0건** · `detectError` **0건**(나머지 9는 비주석 실재 3~62건). r4 의 F2 정정이 `:274` 에서 "구 휴리스틱/enum 에서 이 포트로의 매핑은 §12 표에 있다" 로 이 표를 가리키는데, 표는 자기 왼쪽 열을 *현행* 이라 부른다 — 포인터와 라벨이 서로 반대다. `detectError` 는 심볼 산출에 **있었고**(`ABSENT|detectError|:409`) `설계어휘·목표계약` 버킷에 들어가 통과했다 — 그 사이트에서는 설계어휘가 아니라 현행 단언이다.
- [ ] **G4** — **계측 두 축의 구조적 한계가 §19 에 기록되지 않았다.** ⓐ 심볼 실재 테스트가 substring(G1 의 원인, 엄격화 차집합 **+55사이트**) ⓑ 시제 술어가 **줄 단위**라 표 헤더에서 시제를 상속하는 행을 못 본다(`:403`·`:409`·`:25` 실증 — strict 산출에 있어도 시제 산출에는 없다) ⓒ 추출이 백틱·`**bold**` 만 봐서 **맨 CamelCase 산문**을 못 본다(`ClaudeCodeAdapter` 4사이트). §19 의 "넓히지 않은 축과 이유" 표에 ⓐⓑⓒ 가 없다 — 넓히지 않기로 판단한 것이 아니라 보이지 않았다.
- [ ] **G5** *(경미)* — `GLOSSARY.md:46` 이 "`AuthSpec` 이 소유한다" 로 현재형. 현재 이름은 `AuthMethod`(`contracts/auth.ts:152` 주석 "구 이름은 `AuthSpec` 이었다(0181)"). 같은 파일 `:33` 은 "**AuthMethod** (구 `AuthSpec`)" 로 올바르다 — **같은 문서 안의 비대칭**이다(F3 와 같은 형태). substring 이 `AuthSpecEntry` 류를 실재로 세어 통과.
- [ ] **G6** *(경미)* — `ux-domains.md:79`·`IPC_CONTRACT.md:442` 가 `pendingToolApproval`(단수)를 인용한다. 실제 필드는 **`pendingToolApprovals`**(복수, `ApprovalCard.tsx:46` 주석이 "큐(pendingToolApprovals)로 모델링" 이라 적는다). 단수형은 코드 0건이고 substring 이 복수형 안에서 통과시켰다.
- [ ] **G7** *(경미)* — r4 가 도입한 `⛔` 가 `claude-code-spec.md` 자기 범례 밖이다. 문서 상단 "각주 표기 범례" 는 `✅ Orca v1 채택` · `❌ Orca v1 미사용` · `⏳ Open Question` 3종이고, `⛔` 는 docs 전체에서 `:103` 한 곳뿐이다(`grep -rn ⛔ docs`). 범례에 등재하거나 기존 마커로 표현한다.

### 처리 방향 제안 (구현 턴 몫)

- **G1·G3·G5·G6 은 한 문장의 불변식이다** — "인용 심볼은 부분 문자열이 아니라 **단어 경계로** 실재해야 한다". F1 이 경로 축에 쓴 문장과 같다. §19 심볼 스윕의 `grep -rnF` 를 `grep -rnwF` 로 바꾸고, 늘어난 55사이트를 전건 분류·시제 판정한다.
- **G2 는 사이트 정정이 아니라 문서 단위 판정이다.** `claude-code-spec.md` 의 채택 박스 전수(✅/❌ 각 박스)를 현재 실행 방식과 대조한다. 어디까지 현재화할지는 §10 대로 사람 결정이다.
- **G4 는 §19 문서화다.** ⓐⓑⓒ 를 "넓힌 축" 이나 "넓히지 않은 축과 이유" 중 하나에 등재한다. 등재하지 않으면 다음 라운드가 같은 자리에서 다시 열린다.
- **G7 은 한 줄이다** — 범례에 `⛔` 를 추가하거나 `❌ Orca v1 미사용` 으로 통일한다.

### 파생 관찰 (수정 불요)

- **O1** 버킷표의 `SDK*Message`(6, `SDKUserMessageReplay` 포함) 괄호 주석 — 총계 131 은 맞지만 산술상 `(6)` 은 `SDKUserMessageReplay` 를 **뺀** 나머지 6종이다(그 토큰은 목록에 따로 있다). "포함" 을 빼면 정확해진다.
- **O2** `IPC_CONTRACT.md:45`·`:46` 의 `DiscardSession`·`StopSubagent` 는 코드 타입 0건이다(채널 상수 `chatDiscardSession`·`chatStopSubagent` 만 있다). 문서 규약(페이로드 이름)인지 드리프트인지 판정이 필요하나, **분류 대상에 들어온 적이 없다**는 사실이 G4-ⓐ 의 또 다른 증거다.
- **O3** `adapters.md §1.3` 의 절 제목이 `ClaudeCodeAdapter 호출 패턴` — 코드 0건 심볼이 절 제목이다. F3 정정이 이 절을 정본으로 가리킨다(포인터 자체는 유효, 내용이 disallowedTools 를 다룬다).
- **O4** r3 O5 재확인 — `비범위 — 보고만` 버킷이 *결함 여부* 와 *수정 범위* 두 축을 한 라벨에 담는다. `docs/PRD.md` 사이트는 실제로 7개이고 그중 3개는 `외부` 버킷에 있다(정상 분류).

## 14. Review Signals — 사실만

- **이전 라운드와 동일 증상: 그렇다. 다섯 라운드째 같은 문장이다** — "계측 정의가 불변식보다 좁다". r1 추출 · r2 분류 단위 · r3 실재 테스트(주석) · r4 verify 가 **실재 테스트의 매칭 의미(심볼 축)** · **술어의 적용 단위(줄 vs 표)** · **추출의 토큰 형태(맨 CamelCase)**.
- **선행 review 의 규칙은 발화했다.** review Round 10(`3ba56cb`)이 넣은 "고친 장치가 결함을 볼 수 있음을 먼저 보여라" 는 r4 에서 실제로 작동해 죽은 `\b` 술어를 잡았다(47→98). **이번에 실패한 것은 다른 조항이다** — `handoff-impl §5` 의 "지적을 불변식으로 올려 전수 적용" 이 F1(경로 축에서는 수행)에서 심볼 축으로 전이되지 않았고, F4(자기가 발견한 결함)에서는 전수 자체가 없었다.
- **자기가 발견한 결함일수록 전수가 약하다: 새 관측.** 외부 지적(F1~F3)은 전수를 돌렸고(F3 는 25사이트), 자기 계측이 낸 F4 는 1사이트에서 멈췄다.
- 사용자 결정 변경 근거: 없음. Ledger 무변경. AC13 미신설은 사용자가 고른 것이다.
- 자기보고 합계 축: **이번에도 갈림 없음** — 세 사본 일치(r3 과 동일).
- 반복되는 검증 환경 한계: electron 바이너리 1파일 — r1~r4 동일 서명.
- 현재 라운드 수: **4**. review 는 r4 직전에 수행됐다(Round 10). `docs/handoff/AGENTS.md` 의 *라운드 3 초과* 트리거는 다음 재구현에도 형식상 성립하지만, **Round 10 의 지침은 이번에 발화했으므로** 다시 돌린다면 대상은 "장치의 눈" 이 아니라 **"불변식의 전수 전개"** 다.

## 15. 결론

**FAIL (라운드 4).** AC 12건은 전부 재측정으로 충족되고 분모·합계가 세 사본에서 일치한다. F1~F3 정정 세 건은 코드 대조로 **전부 참**이고(§6), 게이트 4종 산출도 네 번째 세션에서 그대로 나온다. 경로 축은 엄격화에도 차집합 0 이라 이번 라운드에 닫혔다고 판정한다.

FAIL 사유는 AC 밖 4건이다. **G1** — 심볼 실재 테스트가 substring 이라 `ChatEvent` 11사이트가 분모에서 빠졌고 그중 5곳이 현재형 거짓 단언이다. `F1 이 경로 축에서 고친 결함이 심볼 축에 그대로 있다`. **G2** — F4 를 한 사이트만 고쳐 `claude-code-spec.md:57` 이 고친 `:103` 과 정면으로 모순된다. **G3** — §12 표의 "현행 코드 심볼" 열에 부재 심볼 2건, 그리고 F2 정정이 그 표를 정본으로 가리킨다. **G4** — 이 세 자리를 만든 계측 한계가 §19 에 기록되지 않았다.

다음 주체는 **Claude(재구현)** 다. G1 은 §19 심볼 스윕의 한 글자(`-F` → `-wF`)로 분모가 열리고, 늘어난 55사이트를 전건 판정하면 G3·G5·G6 이 같이 닫힌다. G2 의 범위는 사람 결정이다(§10).

---

## 부록 — 라운드 3 검증 (FAIL, 원문 보존)

> 아래는 `53538c2` 시점의 r3 verify 원문이다. 판정·관측을 보존하기 위해 그대로 두고, 제목 수준만 한 단계 낮췄다. 재서술하지 않는다.


### 메타

| 항목 | 값 |
|---|---|
| slug | `0191-docs-code-resync` |
| 검증자 | Claude Code |
| 일자 | 2026-08-18 |
| 대상 커밋/range | `cda6cad..bacecca` (구현 `f9258f4` · 해시 기입 `bacecca`) |
| 구현 전 plan 기준 | `cda6cad` (r2 verify 커밋) |
| 라운드 | 3 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증 모두 Claude Code — 자기 검증이다 |

### 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** `cda6cad`(r2 verify) → `f9258f4`(r3 구현) → `bacecca`(해시 기입)로 갈렸다.

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다** — 메타 상태 1줄 · §10 심볼 행 + 계측 3층 항목 · §19 심볼 블록 재작성 + 버킷표 + "넓히지 않은 축" 표 · r2 절 수치(E5) · r3 신규 절.
- **그 변경이 승인된 것인가: 그렇다.** 전부 verify r2 §13 "처리 방향 제안" 원문(`불변식을 사이트 단위로 다시 세운다` · `넓히지 않는다면 넓히지 않은 이유를 §19 에 적는다`)과 E5 가 지시한 범위다. 각 정정에 `[r3 개정/정정 — 출처: verify r2 …]` provenance 가 붙어 있다.
- **AC 변경: 없음** — `git diff cda6cad..f9258f4 -U0` 의 hunk 헤더가 11·217·223·377~396·525~540·618·761 뿐이고, §7 AC 표(96~112행)·§3 Decision Ledger(31~48행)에 hunk 가 없다.
- Product/UX Contract(§1~§5) 변경: 없음.
- 채점에 사용할 원 기준: `cda6cad` 의 §3 Decision Ledger · §7 AC1~AC12 · §10 강제 지점 표.

**게이트 정의가 구현자 손으로 바뀌었다는 사실은 §5·§7 에서 별도로 취급한다.** 계측을 넓히라고 지시한 것은 verify r2 지만, **넓힌 정의가 불변식을 덮는지**는 검증자가 다시 판정한다 — 이번 FAIL 두 건이 그 자리다(§13 F1·F2).

### 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 = `docs/` 전수 + app 하위 AGENTS | 두 축 모두 | r3 는 docs 15 + handoff 2. `AGENTS.md` 변경 0(`git show --stat f9258f4`) |
| D-002 provider-runtime 은 경로·상태 문구만 | 절 구조 불변 | `^## ` **20개** — `1c9b260`(READY)부터 HEAD 까지 7커밋 전부 20 |
| D-003 폐기 절 삭제 + ADR 링크 | 본문 소멸 | `system-prompt.md:77~81` = "미채택" 2줄 + `ADR-002` 링크(대상 파일 실재) |
| D-004 guides 포함 | 3파일 | r3 는 `closed-network-extensions.md` 1줄 |
| D-005 "보고 따라할 수 있도록" | 명령이 실제로 돈다 | **검증자가 3개 전부 재실행**(§9). 산출이 §8.1 각주와 글자 그대로 같다 |
| D-006 OQ9 미결 | PRD 비범위 | `PRD.md` r3 diff **0** — 고쳤다가 되돌린 사실을 구현자가 보고했다 |
| D-007 루트 AGENTS 비범위 | 미변경 | 루트 `AGENTS.md` r3 diff 0 |

### end-to-end 흐름

```text
에이전트/배포자
  → docs/INDEX.md 라우팅
  → arch/*.md · guides/*.md
  → 인용한 코드 경로(3형태) · 인용한 심볼(4축)
  → 실재하면 코드 도달 / 부재하면 조용한 오안내
```

경로 칸과 심볼 칸 모두 **게이트는 green 이다**. 이번 FAIL 은 그 아래 층이다 — 게이트의 *존재 테스트가 substring* 이고 *버킷이 사이트의 시제가 아니라 심볼의 정체*를 답한다(§3·§13).

### 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 조용하다 | 부재 인용은 예외를 던지지 않는다 |
| false success 가능성 | **있다** | `.ts` 인용이 `.tsx` 실파일 안에 substring 으로 포함돼 B 축을 통과한다(F1) |
| 〃 | **있다** | 사이트가 산출에 나와도 버킷이 `역사` 면 "현행" 이라 쓴 문장이 통과한다(F2) |
| Product/UX 가 요구한 A 대신 B | 아니다 | E1~E5 는 지시된 그대로 닫혔다(§5) |
| 로그/경고만 없애고 원인 상태를 남겼나 | 아니다 | 심볼 치환이 실제 코드 심볼을 가리킨다(19종 전부 비주석 실재 확인) |
| 구현자가 만든 새 표면을 스스로 검사했나 | **아니다** | r3 이 새로 쓴 `state.md:105` 가 없는 파일을 가리킨다(F1). r3 Review Signals 가 r2 에 대해 지목한 바로 그 패턴이다 |

### 3. 역방향 탐색

`scan-surface.sh` 대신 이번 변경의 성격(코드 0 · 문서 전용)에 맞춰 **계측 자체를 역방향으로 공격**했다. 세 축에서 게이트 밖 표면이 나왔다.

| 축 | 관측 | 결과 |
|---|---|---|
| B 축 실재 테스트의 매칭 의미 | `grep -qF "/${p#app/src/}"` = **substring**. 엄격 suffix 로 바꾸면 미스 **12**(느슨 11) | 차집합 1건 = **F1** |
| 심볼 버킷의 판정 축 | `ErrorCode` @ `provider-runtime.md:274` 가 산출에 **있고** `역사` 로 분류됐는데 문장은 "현행은 … 뿐" | **F2** |
| 심볼 추출의 토큰 형태 | 백틱 안이 호출식(`` `fn(` ``)이면 S1~S4 정규식 밖 — 범위 내 **16사이트** | F2 의 `detectError()` 가 그 안 |
| 외부 버킷이 흡수한 Orca 동작 주장 | `disallowedTools`(실제 SDK 옵션명)를 현재형 차단으로 쓰는 사이트 2곳 | **F3** |

- 변경 export 의 프로덕션 참조 0건 / 테스트 전용 심볼 / 형제 파일 정책 비대칭: **해당 없음**(코드 변경 0).
- 형제 문서 비대칭은 **있었다** — `adapters.md:67`·`security.md:91` 은 `disallowedTools 보류` 단서를 달고 `standardization.md:117`·`TRD.md:387` 은 달지 않는다(F3).

### 4. 기존 테스트 / semantic 검증 확인

- 이 handoff 는 코드 테스트를 인수 수단으로 쓰지 않는다(plan §7 주의사항). 인수 수단은 **grep 스윕 + 가이드 명령의 실제 실행**이다.
- 구현자 보고를 증거로 쓰지 않았다 — AC1~AC12 · 강제 지점 · 수치 6종 · 심볼 스윕 전량을 이번 턴에 재측정했다(§5·§7·§9).
- structural proxy 경계: "심볼이 코드에 있다"(구조)와 "이 문장의 단언이 참이다"(의미)를 갈라 판정했다. F2·F3 은 **구조는 통과하고 의미가 거짓**인 자리다.

### 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 인용 `src/**` 경로 전부 실재 | ✅ | §19 A/B/C 재실행 = **0 / 11 / 9**. 20사이트가 예외표 12행과 1:1, 그 밖 0줄 | 에이전트가 문서 경로를 연다 |
| AC2 | 출시 기능이 미구현으로 표기되지 않음 | ✅ | `arch/*/overview.md` 잔여 `❌` **7행**(190·201·210·212 / 81·82·83) = 열거와 동일 | 상태표를 읽는 세션 |
| AC3 | provider-runtime 경로·상태 문구 정정, 구조 불변 | ✅ | `^## ` **20** — READY 커밋부터 HEAD 까지 전부 20 | D-002 |
| AC4 | 삭제·이설 모듈명 미인용 | ✅ | 6패턴 각 **0파일** | `auth.md`·`layers.md` |
| AC5 | app AGENTS 레이아웃·스크립트가 실측과 일치 | ✅ | 비-test `.mjs` **6** = `app/AGENTS.md:144~150` 열거 6 · 수치는 본문에 없고 "`scripts/` 가 진실" | `app/` 작업 세션 |
| AC6 | 폐기 절 삭제 + ADR 링크 | ✅ | `system-prompt.md:77` 제목 "미채택" + `:79` 2줄 + `:81` ADR-002(파일 실재) | D-003 |
| AC7 | §8.1 회귀 테스트 실재 + 명령 3개 통과 | ✅ | 인용 `*.test.ts` **21개 고유 문자열 · 부재 0** · 명령 3개 **검증자 실행**(§9) | 배포자가 §8 을 실행 |
| AC8 | §8.2 1번 ↔ §1.1 동일 파일 | ✅ | §8.2-1 `app/deployment/auth-definitions.ts` = §1.1 트리 1행 | 배포자가 선언을 채운다 |
| AC9 | workspace 가이드가 정본을 밝히고 미채택 표기 | ✅ | 헤더가 `workspace-guard.ts` + 3함수 · 미채택 4곳 · `grep -rn disallowedTools app/src` = **0** | `guides/AGENTS.md` 규칙 |
| AC10 | release-operations 의 CI 트리거가 ci.yml 과 일치 | ✅ | `:12` = `ci.yml:11~22`(main push + 모든 PR + `workflow_dispatch`, paths 필터 동일) | 릴리스 담당자 |
| AC11 | INDEX 라우팅에 2행 | ✅ | `docs/INDEX.md:12`·`:23` | 새 세션 진입 |
| AC12 | 인벤토리 가드 3종 통과 | ✅ | 직접 실행 → 3항목 ok · exit 0 | CI |

- **합계 재측정**: `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12`. 분모는 §7 의 AC1~AC12, 분할·추가 없음.
- **합계 사본 대조**: 본문 `12/12` ↔ 커밋 `f9258f4`·`bacecca` trailer `Criteria-Met: 12/12` ↔ INDEX `자기보고 AC 12/12` — **세 사본 일치**. `8/8`·`211사이트/124심볼`·`미분류 0` 도 세 곳이 같다.
- **AC 12/12 인데 FAIL 이다.** 사유는 AC 밖이다 — 신규 결함 2건(F1·F2) + 미정정 1건(F3), 전부 §10 이 세운 불변식 안이다(§13).
- **AC9 와 F3 은 같은 관측을 반대로 쓴다.** `grep -rn disallowedTools app/src = 0` 이 AC9 를 통과시키고 동시에 `standardization.md:117`·`TRD.md:387` 을 거짓으로 만든다 — AC 가 한 문서만 물어서 생긴 공백이다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

**§10 계약은 6행이고 구현자 표는 8행이다.** 분모가 다르다 — 구현자가 "경로 실재" 를 A/B/C 로 3분할하고 §10 밖 항목(§8.1 인용 테스트)을 1행 더했으며, §10 6행 중 `arch/ 는 현재 상태만 서술` 행은 표에 없다.

| §10 계약 | plan 이 적은 강제 지점 | 검증자가 확인한 지점 | 결과 |
|---|---|---|---|
| 인용 경로 실재 | 범위 내 문서 + AGENTS 3종(A·B·C) | A **0줄** · B **11줄** · C **9줄**, 전부 예외표 | ✅ 재현 |
| 〃 (매칭 의미) | — | 엄격 suffix 로 재측정 = **12** | ❌ **F1** — 게이트가 1건을 구조적으로 못 본다 |
| 인용 심볼 실재 | 추출 4축 · 사이트 단위 전건 분류 | raw **215줄** → 고유 (심볼,사이트) **211** / 심볼 **124**, 버킷 미분류 **1**(O1) | ⚠️ 개수 재현 · **F2 로 판정 실패** |
| 수치 본문 미기재 | inventory prose | `prose ok` 재실행 | ✅ |
| 상대 링크 해석 | 동 links | `links ok` 재실행 | ✅ |
| guides 절차 실행 | §8.1 명령 3개 | **3/3 검증자 실행**(§9) | ✅ 재현 |
| `arch/` 는 현재 상태만 서술 | 사람 · 편집 시 | **구현자 표에 없다.** 검증자가 걸었다 — r3 이 `docs/arch/**` 에 더한 "구 X" 6줄 중 handoff 번호를 단 델타형은 `provider-runtime.md:29`("0062 개명") 1줄 | ⚠️ 주변 관례와 일관 — 수정 요구 아님(O3) |
| (§10 밖) §8.1 인용 테스트 실재 | 자기보고 21/21 | **21개 고유 문자열 · 부재 0** — r2 의 22 와의 차이는 세는 규칙(경로형·파일명형 중복) | ✅ |

- **표에 없는데 같은 불변식이 필요한 지점: 있다.** 호출식 인용(`` `fn(` ``) **16사이트**가 추출 밖이고(F2 의 `detectError()`), 외부 SDK 옵션명을 Orca 동작으로 쓰는 사이트가 버킷 판정을 우회한다(F3).

### 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `app/deployment/` 표면 | 이번 턴 계약 변경 0. §1.1 factory 표 5행이 실제 파일과 일치 | §8.2 1~3번이 §1.1 과 같은 파일을 지시 | ✅ |
| `closed-network-extensions.md` §8.1 | 인용 테스트 21개 전부 `find app/src` 히트 | 명령 3개 산출이 문서가 적은 통과 기준과 동일(§9) | ✅ |
| 에러 정규화 계약 | `ErrorClassifier` 포트 + `retryable` 이 `infra/errors.ts:21`·`:57` 에 실재 | **`provider-runtime.md:274` 가 "정규 분류기/`retryable` 없음" 이라 적는다** | ❌ **F2** |
| SDK 도구 차단 계약 | `disallowedTools` 는 실제 SDK 옵션 | **코드가 넘기지 않는데 `standardization.md:117`·`TRD.md:387` 이 "차단한다"** | ❌ **F3** |

### 7. 숫자 / 음성 기준 / 상한 재측정

**HEAD 상태 수치와 r3 이 정정한 시작 상태 수치가 모두 재현된다.**

| 값 | 자기보고 | 재측정 | 재현 방법 |
|---|---:|---:|---|
| HEAD A / B / C 산출 | 0 / 11 / 9 | **0 / 11 / 9** | plan §19 A·B·C 블록 원문 |
| 예외표 커버리지 | 12행 = 20사이트 | **12행 = 20사이트** | 산출과 표 1:1 대조 |
| 심볼 스윕 산출 | 211사이트 / 124심볼 | **고유 (심볼,사이트) 211 / 124** (raw 215줄, O2) | plan §19 심볼 블록 원문 |
| 버킷 사이트 합 | 58+71+59+9+10+4 = 211 | **합 성립** · 심볼 목록은 123/124 커버(O1) | 버킷 표 토큰을 산출에 매칭 |
| AC2 잔여 `❌` | 7행 | **7행** | `grep -n ❌ docs/arch/*/overview.md` |
| §8.1 인용 테스트 | 21 | **21 · 부재 0** | 백틱 `*.test.ts` 고유 문자열 |
| base B 산출 (E5) | 57 | **57** | `git archive 32723bf` 트리에 §19 B 블록 |
| base C 산출 (E5) | 15 | **15** | 같은 트리에 §19 C 블록 |
| B 축 고친 사이트 (E5) | 15 | **15** | base 비-layers 23 − 잔존 8(`decisions/004:3` 은 신규 줄) |
| C 축 고친 사이트 (E5) | 6 | **6** | base 15 − HEAD 9 |
| 경로 고친 총계 / 드러난 결함 (E5) | 21 / 22 | **21 / 22** | 15+6 · 21+심볼 5−지적 4 |
| 게이트 산출 | 41파일 중 40 · 506 케이스 | **동일** | §9 |
| **엄격 suffix B 미스** | — | **12**(느슨 11) | 같은 SCOPE 에 suffix 매칭 |
| **호출식 인용 사이트** | — | **16** | 백틱 `ident(` 추출 후 비주석 코퍼스 대조 |

- **내역 합 = 총계**: 성립한다(11+9=20=예외표 · 버킷 6개 합=211 · 15+6=21).
- **0건 게이트가 정당한 이력을 지웠는가**: 아니다. 20사이트 전부 사유와 함께 등재됐다.
- 총량/상한: 해당 없음(코드 변경 0).

### 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| §8.1 명령 3개 | **전부 실행 — 남은 것 없음**(§9) | 없음 | — |
| §8.2 배포 실기 | 파일명·절차 순서 정합(AC8) | 사내 로그인 왕복 | 폐쇄망에서 로그인 화면 → 메인 UI → 연결 탭 |
| 심볼 축 사이트 판정 | 211사이트 전건 + 호출식 16사이트 육안 | 없음 — 시제 판정은 문장 해석이라 기계로 못 넘긴다 | — |
| B 축 매칭 의미 | **기계로 회수**(suffix 재측정) | 없음 | 위 §7 |

"UI/electron 이라서" 로 넘긴 순수 로직 없음.

### 9. 게이트 재실행

`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 를 따랐다. `npm test` 는 쓰지 않았다 — DB 동작 검증이 필요 없는 문서 작업이고, 쓰면 ABI 를 Node 로 뒤집는다.

| 명령 | **관측한 산출**(exit code 아님) |
|---|---|
| `cd app && node scripts/check-doc-inventory.mjs --check` | `generated doc ok (9 items, 76 channels)` · `prose ok: no inventory counts restated in current-state docs` · `links ok: every relative markdown link resolves` |
| `cd app && npm run typecheck` | 하위 3개(`typecheck:node`·`:web`·`:test`) 전부 실행, **error 0줄** |
| `cd app && npm run lint` | `✖ 1 problem (0 errors, 1 warning)` — `react-hooks/incompatible-library` @ `useTranscriptVirtualizer.ts:22` |
| `cd app && ./node_modules/.bin/vitest run src/main/features/{auth,gate,harnesses,plugins} src/main/app` | `Test Files 1 failed \| 40 passed (41)` · `Tests 506 passed (506)` |

- **환경 기인 실패 분리**: 실패 1파일 = `src/main/app/chat-turn.continuity.test.ts`, 서명 `Error: Electron failed to install correctly` @ `node_modules/electron/index.js:17`. guides §8.1 3번 각주가 적은 예외와 글자 그대로 같다 — r2 검증 세션과 동일 산출.
- vitest exit code 는 1 이다. 가이드가 그 1건을 예외로 명시하므로 **판정은 green**.
- **게이트가 작업 트리를 바꿨는가**: 아니다. `npm run lint` 는 `eslint --cache --fix` 지만 실행 직후 `git status --short --untracked-files=all` **빈 출력**.
- **검증 중 명령이 남긴 잔여물**: 없음(추적 대상 기준). 스윕 원자료·`git archive` 추출본은 전부 세션 스크래치 디렉토리.

### 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| 인벤토리·lint·typecheck·scoped vitest | 에이전트 실행·산출 증거 확보 |
| AC ↔ 코드/production path | 에이전트 1:1 대조 완료(§5) |
| 경로·심볼 스윕 + 계측 3축 역공격 | 에이전트 정적 검증 완료(§3·§7) |
| F1·F2 의 문장 정정 방향 | 에이전트 판정 가능 — 구현 턴 몫 |
| F3 의 처리(문구 정정 vs `disallowedTools` 채택) | **문구 정정은 에이전트** · 채택 여부는 사람(D1 미결) |
| AC6 의 ADR 링크 대상 교체 | **사람 결정** — D-003 실현 방식 변경 |
| PRD §11 OQ9 · PRD 토큰명 | **사람 결정** — D-006 유지 |
| §8.2 사내 로그인 왕복 | **사람 실기** |

### 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- r3 의 `AGENTS.md` 변경: **0건**(`git show --stat f9258f4`·`bacecca` 에 AGENTS 파일 없음). 위생·부모/자식 충돌 판정 대상 없음.
- 새 `AGENTS.md`: 없음 — stub·루트 표 갱신 불요.

### INDEX 보드 정합성

- 진입 시점 상태: 단계 `impl` · 상태 `IMPL_DONE (r3)` · 다음 주체 `Claude(검증)` · 대상 커밋 `f9258f4` · 라운드 3 — **전부 실제와 일치**했다.
- 대상 커밋 해시 실재: `git cat-file -e f9258f4` ✓.
- **비고 959자** (r2 650자). 한 물리 줄이지만 렌더 기준 5줄을 넘는다 — 이번 검증 커밋에서 판정 + F1~F3 요지 + 링크로 줄인다(O4).
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- `f9258f4`·`bacecca` trailer: `Agent: claude` · `Handoff:` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 허용값 준수. trailer 블록 내부 빈 줄 없음.
- 인용 해시 실재: r3 절과 INDEX 가 인용한 해시는 `f9258f4` 뿐이고 실재한다(0190 D3 형 죽은 좌표 없음).
- 구현자가 새로 인용한 코드 좌표 표본 재확인: `shared/ipc.ts:255 export type Backend = 'claude'` ✓ · `features/chat/turn-coordinator.ts` ✓ · `features/sessions/session-registry.ts` ✓ · `adapters/streaming-input.ts` 의 `createSessionInputStream` ✓ · `ApprovalCard.tsx` ✓ · `deployer.ts` 의 `deploy()`/`DeployResult` ✓ — **표본 6/6 실재**. 치환 심볼 19종 전부 비주석 히트.
- 이동/삭제한 reference·script: 없음.

### 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 1 `terms.md:25` `Backend` 값 `'claude-code'`→`'claude'` | 타당 — `shared/ipc.ts:255` 와 일치 | 유지 |
| 선조치 2 `terms.md:28` `ClaudeCodeAdapter` 행 → `claude 어댑터`(`adapters/claude.ts`) | 타당 — 산출 타입 `NormalizedEvent` 도 코드와 일치 | 유지 |
| 선조치 3 `terms.md:89` `prompts/` 통합 서술 삭제 | 타당 — `prompts/policies` 잔존 인용 **0건** 재확인 | 유지 |
| 선조치 4 `state.md:70` `pendingDelta` 를 "구" 표기로 | 타당 — 같은 문서 `:47` 과 정합 | 유지 |
| 보고만 1·2 PRD 토큰명·어댑터명 | 타당 — §6 비범위(D-006). PRD diff 0 확인 | **사람 결정** |
| 보고만 3 AC6 의 ADR 링크 근거 | 타당 — r2 와 동일. 링크 교체는 D-003 실현 방식 변경 | **사람 결정** |
| 보고만 4·5·6 (루트 AGENTS · `ipc.ts:394` 주석 · OQ9) | 타당 — D-006·D-007 범위 밖 | 유지 |
| 설계 대비 차이: §11 밖 6파일 수정 | 타당 — 계측을 넓히면 같은 불변식이 그 파일에도 걸린다 | 유지 |
| 설계 대비 차이: 관측 범위 ≠ 수정 범위(PRD) | 타당 — 버킷 표에 `비범위` 행을 둔 처리가 맞다 | 유지(O5) |

무단 제품·AC 변경 없음. plan 본문 수정은 전부 verify r2 가 지시한 범위 안이다(§0).

### 13. [FAIL 시] 파생 이슈

- [ ] **F1** — `docs/arch/frontend/state.md:105` 가 없는 파일 `app/hooks/useSidebarSlots.ts` 를 인용한다. 실파일은 `app/src/renderer/src/app/hooks/useSidebarSlots.tsx`(**`.tsx`**)이고 같은 문서군 `layers.md:42` 는 `.tsx` 로 적는다. **이 줄은 r3 이 `newChatSlot`→`pinnedSlot` 정정하며 새로 쓴 줄이다.** 게이트가 못 본 이유: §19 B 축 실재 테스트 `grep -qF "/${p#app/src/}"` 가 **substring** 매칭이라 `.ts` 가 `.tsx` 안에 포함돼 통과한다 — 엄격 suffix 로 재측정하면 미스 **12**(느슨 11)이고 차집합이 정확히 이 1건이다.
- [ ] **F2** — `docs/arch/backend/provider-runtime.md:274` 가 거짓 "현재 코드 갭" 을 단언한다: "현행은 `detectError()`(`src/main/adapters/claude.ts`) 휴리스틱 … `ErrorCode` enum … 뿐 — **정규 분류기/`retryable` 없음**". 실측 — `detectError` **0건**(`app/src`·`app/scripts`) · `ErrorCode` 는 `shared/ipc.ts:315` **주석**에만("구 ErrorCode") · `claude.ts:22`·`:213`·`:455` 가 `claudeErrorClassifier`(`adapters/error-classifier.ts`) 를 쓰고 · `infra/errors.ts:21`·`:28`·`:57` 에 `ErrorClassifier` 포트 + `retryable` + `DEFAULT_RETRYABLE` 이 있다. 같은 문서 `:409` 는 `detectError` → `ErrorClassifier.classify`(8분류) 매핑이고 `backend/overview.md:214` 는 `ErrorClassifier` **활성** — **E1 과 같은 자기모순**이다. 게이트가 통과시킨 이유: 이 사이트는 산출에 **있었고**(`ErrorCode` @ `:274`, COMMENT_ONLY) `역사` 버킷에 들어갔다 — 버킷은 *심볼이 무엇인가*를, 불변식은 *이 사이트의 단언이 참인가*를 묻는다. 같은 줄의 `detectError()` 는 호출식이라 추출 밖이다(범위 내 16사이트).
- [ ] **F3** — `docs/arch/backend/standardization.md:117` 과 `docs/TRD.md:387` 이 "사용자 allow 규칙은 `disallowedTools` 로 **차단한다**" 를 **보류 단서 없이** 현재형으로 쓴다. 실측 `grep -rn disallowedTools app/src` = **0**(AC9 가 쓰는 바로 그 관측). 같은 문서 `:146` 은 "D1 사용자 확정 전이라 코드 주입 보류", `workspace-isolation-permissions.md` 는 "Orca 미채택". 형제 사이트 `adapters.md:67`·`security.md:91` 은 "(0024 구현됨 / disallowedTools 보류)" 단서를 달고 있어 **같은 범위 안에서 비대칭**이다. 버킷이 통과시킨 이유: `disallowedTools` 는 실제 SDK 옵션명이라 `외부` 다 — F2 와 같은 뿌리.

### 처리 방향 제안 (구현 턴 몫)

- F1·F2·F3 는 문장/경로 정정이다. 그러나 **정정만으로는 다음 라운드가 또 열린다** — 세 건 모두 게이트가 green 인 채로 남았다.
- 계측을 고친다면 세 자리다: ⓐ B 축 실재 테스트를 **suffix 매칭**으로, ⓑ 추출에 **호출식** 형태 추가, ⓒ 버킷 판정을 *심볼의 정체*가 아니라 **사이트의 시제**로(외부/역사 버킷이라도 문장이 "현행" 이면 결함).
- ⓒ 는 정규식으로 못 닫는다. 육안 판정을 줄이려면 **현재형 단정어(현행·이다·한다·차단한다)와 함께 등장하는 사이트만** 추려 그 부분집합을 전건 확인하는 형태가 현실적이다.
- **다음 재구현 전에 `handoff-review` 를 수행한다** — `docs/handoff/AGENTS.md` 의 "impl 라운드가 3을 초과" 트리거가 다음 라운드부터 성립하고, *같은/유사 실패 반복* 트리거는 이미 네 라운드째다.

### 파생 관찰 (수정 불요)

- **O1** 버킷 표 심볼 목록이 `SDKUserMessageReplay` 를 빠뜨린다(`SDK*Message`(6) 약칭이 못 덮음). 사이트 합계 71·총 211 은 맞고 목록만 1토큰 짧다 — plan 이 "다음 라운드는 이 집합을 diff" 라 했으므로 다음 회차에 오탐으로 뜬다.
- **O2** 심볼 스윕 raw 산출은 **215줄**이고 211 은 dedup 값(한 줄에 같은 심볼 2회 = 4줄). dedup 규칙이 §19 에 없어 재현자는 215 를 본다.
- **O3** §10 계약 6행 중 `arch/ 는 현재 상태만 서술` 이 구현자 `8/8` 표에 없다. 검증자가 걸었고 결과는 충족 — handoff 번호를 단 델타형은 `provider-runtime.md:29` 1줄뿐이며 주변 관례와 일관된다.
- **O4** INDEX 비고가 라운드마다 자란다(r2 650자 → r3 959자). 이번 커밋에서 줄인다.
- **O5** `비범위 — 보고만` 버킷 설명이 "전부 `docs/PRD.md` 사이트" 인데, PRD 사이트 2개(`node-pty` `:124`·`feat-pretty-ui` `:270`)는 `외부` 버킷에 있다. 결함이 아니므로 정상 분류다 — 버킷 라벨이 *결함 여부* 와 *수정 범위* 두 축을 섞는다.

### 14. Review Signals — 사실만

- **이전 라운드와 동일 증상: 그렇다. 네 라운드째 같은 문장이다** — "계측 정의가 불변식보다 좁다". r1 = 추출 정규식, r2 = 분류 단위, r3 = 실재 테스트(주석 줄), r3 검증 = **실재 테스트의 매칭 의미(substring)** + **분류 판단의 축** + **추출의 토큰 형태(호출식)**.
- **관련 plan 지침의 존재 여부: 있었다.** §10 이 r3 에 "계측은 세 층이 각각 좁아질 수 있다 — 추출·실재 테스트·분류 단위" 를 명문화했다. **그 문장을 쓴 라운드가 네 번째 층(매칭 의미)과 분류 판단에서 다시 좁았다.** 규칙을 적는 것이 적용을 보장하지 않는다는 관측이 세 번째다.
- **구현자가 자기 수정으로 만든 표면을 스스로 검사하지 않았다: 반복.** r3 Review Signals 가 r2 에 대해 이 사실을 적었고, 같은 라운드가 `state.md:105` 에서 되풀이했다(F1).
- 사용자 결정 변경 근거: 없음. Ledger 무변경.
- 자기보고 합계 축(0187 r1 · 0189 r1 · 0190 r1 · 0191 r1 D6 · r2 E5): **이번엔 갈림 없음** — 세 사본이 일치하고 시작 상태 수치도 재현된다.
- 반복되는 검증 환경 한계: electron 바이너리 1파일 — r1·r2·r3 동일 서명. `node_modules` 는 이번 세션에 있었다.
- 현재 라운드 수: **3**. `docs/handoff/AGENTS.md` 의 *라운드 3 초과* 트리거가 다음 재구현부터 성립한다.

### 15. 결론

**FAIL (라운드 3).** AC 12건은 전부 재측정으로 충족되고, r2 가 남긴 E1~E5 는 5건 모두 코드 대조로 닫혔다. 게이트 4종도 검증자가 직접 돌려 guides §8.1 이 약속한 산출(41파일 중 40 · 506 케이스 · 예외 1건)이 세 번째 세션에서 그대로 나왔다. 자기보고 수치는 이번에 세 사본이 일치하고 E5 정정값도 독립 재현된다.

FAIL 사유는 AC 밖이고 셋 다 **게이트가 green 인 채로 남은 자리**다. F1 은 r3 이 이번에 쓴 줄이 없는 파일을 가리키는데 B 축 실재 테스트가 substring 이라 통과했다. F2 는 스윕이 잡은 사이트가 `역사` 버킷에 들어가면서 "현행은 정규 분류기가 없다" 는 거짓 단언이 남았다 — 코드에는 `ErrorClassifier` 와 `retryable` 이 있고 같은 문서 `:409` 가 그것을 이미 적는다. F3 은 코드가 넘기지 않는 `disallowedTools` 를 두 문서가 현재형 차단으로 쓴다.

다음 주체는 **Claude(재구현)** 다. F1~F3 정정에 앞서 **`handoff-review` 를 먼저 수행한다** — 네 라운드 연속 같은 축이고, `docs/handoff/AGENTS.md` 의 *라운드 3 초과* 트리거가 다음 라운드부터 성립한다.

---

## 부록 — 라운드 2 검증 (FAIL, 원문 보존)

> 아래는 `cda6cad` 시점의 r2 verify 원문이다. 판정·관측을 보존하기 위해 그대로 두고, 제목 수준만 한 단계 낮췄다. 재서술하지 않는다.


### 메타

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

### 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** `32723bf`(r1 verify) → `7d8b2df`(r2 구현) → `6f8af81`(대상 커밋 해시 기입)로 갈렸다.

- 구현 커밋이 `plan.md` 를 변경했는가: **그렇다** — §7 주의사항 2줄 · §8 2줄 · §10 표 · §19 게이트 블록.
- **그 변경이 승인된 것인가: 그렇다.** 전부 verify r1 §13 **D6 의 "대응 방향"** 원문(`세 숫자를 실측으로 고치고 §19 스윕을 상대 경로까지 확장, 심볼 축을 §10 강제 지점 표에 정식 등재`)이 지시한 변경이고, 각 정정에 `[r2 정정 — 출처: verify r1 §7]` provenance 가 붙어 있다.
- **AC 변경: 없음** — §7 표의 AC1~AC12 행 원문 무변경(`git diff 32723bf..7d8b2df` 에서 표 본문 hunk 0).
- Decision Ledger 변경: 없음. Product/UX Contract(§1~§5) 변경: 없음.
- 사용자 결정 3건이 `[구현자 기입] 라운드 2` 에 신규 기재됐다(`layers.md §1-2` 삭제 · 스윕은 plan 유지 · `decisions/004` 상단 승계 노트). Ledger 의 D-001~D-007 과 충돌하지 않는다.
- 채점에 사용할 원 기준: `32723bf` 의 §3 Decision Ledger · §7 AC1~AC12 · §10 강제 지점 표(심볼 행 포함).

**기록해 두는 내부 불일치**: AC1 행의 검증 수단 칸은 여전히 `→ 출력 **0줄**` 인데, §19 완료 조건은 `A+B+C 산출이 예외 목록과 정확히 일치`다. 실제 산출은 20줄이라 두 문장이 문자 그대로는 어긋난다. D6 이 지시한 확장의 결과이고 §7 주의사항이 새 기준을 명시하므로 **후자를 채점 기준으로 삼았다**.

### 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 = `docs/` 전수 + app 하위 AGENTS | 두 축 모두 | r2 는 docs 18 + `app/src/main/AGENTS.md`(`git diff --stat`) |
| D-002 provider-runtime 은 경로·상태 문구만 | 절 구조 불변 | `^## ` **20개** — r1 과 동일 |
| D-003 폐기 절 삭제 + ADR 링크 | 본문 소멸 | `system-prompt.md:75~81` = "미채택" 3줄 + ADR-002 링크 |
| D-004 guides 포함 | 3파일 | r2 는 `closed-network-extensions.md` 2줄 추가 정정 |
| D-005 "보고 따라할 수 있도록" | 명령이 실제로 돈다 | **이번 턴 검증자가 3개 전부 재현**(§9) — r1 의 미재현이 닫혔다 |
| D-006 OQ9 미결 | PRD 비범위 | `PRD.md` r2 diff 0 |
| D-007 루트 AGENTS 비범위 | 미변경 | 루트 `AGENTS.md` r2 diff 0 |

#### end-to-end 흐름

```text
에이전트/배포자
  → docs/INDEX.md 라우팅
  → arch/*.md · guides/*.md
  → 인용한 코드 경로(3형태) · 인용한 심볼
  → 실재하면 코드 도달 / 부재하면 조용한 오안내
```

경로 칸은 이번에 닫혔다. **심볼 칸이 이번 FAIL 의 자리다** — 4사이트가 없는 심볼을 현재형으로 단언한다(§5·§13).

### 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 조용하다 | 부재 인용은 예외를 던지지 않는다. 독자가 자기 체크아웃을 의심한다 |
| false success 가능성 | **있다** | 심볼 게이트의 버킷이 **심볼 단위**라, 한 사이트의 "구/폐기" 표기가 다른 사이트의 현재형 단언을 통과시킨다(E1~E3) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 코드 변경 0 을 `git diff --stat` 으로 확인 |
| 증상만 제거하고 상태가 남았는가 | **부분적으로** | 계측을 넓혀 r1 잔여를 원인째 닫았으나, 넓힌 계측 자체가 다시 불변식보다 좁다 |
| 역사적 인용을 지워 게이트를 통과시켰는가 | 아니오 | 20사이트를 삭제 대신 §19 예외표에 사유와 함께 등재. `layers.md §1-2` 삭제는 사용자 결정 1 |
| 최적화가 관측을 없앴는가 | 해당 없음 | 문서 작업 |
| 출력/요청 상한 | 해당 없음 | 코드 변경 0 |

### 3. 역방향 탐색

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

### 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트: 없음(문서 전용). AC7 이 **가이드가 지시하는 명령 자체**를 대상으로 삼는다.
- structural proxy 만으로 semantic 목표를 통과시킨 지점: **심볼 축**. 목표는 "없는 심볼을 현재형으로 단언하지 않는다"인데 측정은 **심볼 47개의 버킷 배정**이다. 단언은 **사이트 67개**에 있으므로 한 심볼이 두 성격을 가지면 계측이 그것을 볼 수 없다.
- 구현자 자기보고를 증거로 쓰지 않았다 — AC1~AC12 · 강제 지점 8행 · 개수 5종을 이번 턴에 전부 재측정했다(§5·§7·§9).

### 5. 요구사항 충족 매트릭스

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

#### plan §10 강제 지점 표 — AC와 별개로 걷는다

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

### 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `app/deployment/` 표면 | 이번 턴 계약 변경 0. §1.1 factory 표 5행이 실제 파일과 일치 | §8.2 1~3번이 §1.1 과 같은 파일을 지시 | ✅ |
| `NormalizedHookSet` 계약(D5 정정) | `adapters/hooks.ts` 의 `NormalizedHook{Event,Context,Decision,Handler,Set}` 5종 전부 export 확인 | 문서 §3.2.2 표 9이벤트 = 코드 `NormalizedHookEvent` 9종 · §3.2.3 필드 = 코드 필드 1:1 | ✅ |
| `IPC_CONTRACT.md` 채널 계약 | `check-doc-inventory.mjs` 76채널 ok | `SetSessionPinnedSchema`/`SetProjectPinnedSchema` = `shared/protocol.ts:220`·`:240` 실재 | ✅ |
| `standardization.md` 배포 계층 SSOT | — | **`:7` 이 `StandardConformance`·`migrate-sources` 를 "코드에 반영됐다" 로 단언** | ❌ E1 |

### 7. 숫자 / 음성 기준 / 상한 재측정

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

### 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| §8.1 명령 3개 | **전부 실행 — 남은 것 없음**(§9) | 없음 | — |
| §8.2 배포 실기 | 파일명·절차 순서 정합(AC8) | 사내 로그인 왕복 | 폐쇄망에서 로그인 화면 → 메인 UI → 연결 탭 |
| 심볼 축 전건 분류 | 67사이트 육안 재분류 | 없음 — 판정은 문장 해석이고 기계로 못 넘긴다 | — |

"UI/electron 이라서" 로 넘긴 순수 로직 없음. r1 이 사람 실기로 넘겼던 게이트 3개는 이번에 기계 검증으로 회수했다.

### 9. 게이트 재실행

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

### 10. 검증 책임 분리 — 사람 vs 에이전트

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

### 11. Repository operation checks

#### AGENTS.md 위생 / 정합성

- r2 의 AGENTS 변경은 `app/src/main/AGENTS.md` 1줄(`settings-reactions.ts` 추가)뿐이다.
- 키/토큰/PW/이메일/IP 등 민감 패턴: **0건**.
- 일회성·변동성 운영정보 혼입: 없음.
- 부모 ↔ 자식 명령 충돌: 없음. 추가한 항목이 `app/AGENTS.md` 열거와 일치해 **r1 이 지적한 형제 비대칭이 해소**됐다.
- 새 `AGENTS.md`: 없음 — stub·루트 표 갱신 불요.

#### INDEX 보드 정합성

- 이번 턴 진입 시점 상태: 단계 `impl` · 상태 `IMPL_DONE` · 다음 주체 `Claude(검증)` · 대상 커밋 `7d8b2df` · 라운드 2 — **전부 실제와 일치**했다.
- 비고 **650자**, 상세를 `plan.md` 로 링크. 5줄 상한 준수.
- PASS archive 이동: 해당 없음(FAIL).

#### Commit / reference 정합성

- `7d8b2df`·`6f8af81` trailer: `Agent: claude` · `Handoff:` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 허용값 준수. trailer 블록 내부 빈 줄 없음.
- 인용 해시 실재: `7d8b2df` ✓ · `6f8af81` ✓. r1 이 보고한 "plan 커밋이 `Status: implemented`" 는 이번 range 밖이라 그대로 둔다.
- 구현자가 새로 인용한 코드 좌표 표본 재확인: `chatStore.ts:1243`(`chatApi.onEvent(ingestChatEvent)`) ✓ · `protocol.ts:220`/`:240` ✓ · `ExtensionsCatalogView` ✓ · `composer/ComposerDecorationLayer.tsx` ✓ · `DISABLED_HATCH_CLASS`(`shared/ui/mock.ts`) ✓ · `app/boot/steps.ts` 의 `landing-target` ✓ — **표본 6/6 실재**.
- 이동/삭제한 reference·script: 없음.

### 12. 구현자 코멘트 / 선조치 경계

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

### 13. [FAIL 시] 파생 이슈

- [ ] **E1** — `standardization.md:7` 상태 배너가 "`sources/dist` 분리 + `ExtensionDeployer` + `StandardConformance` + `migrate-sources` 가 **코드에 반영됐다**" 로 단언한다. 실측: `grep -rn StandardConformance app/src` = **0**, `migrate-sources`/`migrateSources` = **0**, `deployer.ts` 의 export 는 `DeployResult`·`deploy()` 뿐(`ExtensionDeployer` 는 헤더 주석 이름). **같은 문서 `:146` 이 "`StandardConformance` 는 아직 설계 단계이고 구현체가 없다 … 구현 완료로 읽지 말 것" 이라 적고, `terms.md:82` 도 "목표 계약이다" 로 적는다** — 문서의 첫 배너가 자기 본문 두 곳과 반대다.
- [ ] **E2** — `provider-runtime.md:29` 가 "2계층 모델(Tier A `OrcaCapabilities` / Tier B 얇은 `SessionAdapter`)" 을 현재형으로 쓴다. 이 줄이 링크하는 `adapters.md:71` = "구 `CapabilityBuilder`/`OrcaCapabilities` 개명(0062) — 현재 이름은 `ExtensionBuilder`/`TurnExtensions`". **r2 가 바로 이 줄을 편집해 `OrcaHookSet`→`NormalizedHookSet` 을 고치면서 같은 문장의 이 심볼을 남겼다.**
- [ ] **E3** — `ux-domains.md:81` 이 "ApprovalCard 가 Composer 입력창을 대체(**현** `PlanApprovalCard` 패턴 재사용)" 라 쓴다. 같은 문서 `:79` = "`PlanApprovalCard` → `features/chat/components/ApprovalCard.tsx` 일반화". r1 선조치 #3(제목↔본문 자기모순)과 같은 유형이 같은 파일에 남았다.
- [ ] **E4** — `persistence.md:116` 이 "IPC 이벤트 흐름(`InflightTurn` 상태 머신, runtime-ipc.md §1.1)을 통해 DB 에 실시간 persist" 라 쓴다. `grep -rn InflightTurn app/src` = **0**, 현재 구현은 `features/chat/turn-coordinator.ts:111 TurnCoordinator`. `runtime-ipc.md:10` 은 "구 '단일 inflight' 모델은 **폐기**됐다" 이고 §1.1 은 `InflightTurn` 을 정의하지 않는다. **`terms.md:40` 이 같은 이름을 용어표 항목으로 살려 두는데, `**bold**` 라 심볼 스윕(백틱 전용) 밖이다** — 함께 처리한다.
- [ ] **E5** — 자기보고 수치 5종이 재측정과 갈린다(§7 표): base C `19`→**15** · B 축 고친 수 `13`→**15** · C 축 `7`→**6** · 경로 총계 `20`→**21** · "드러난 결함" `21`→**22**(plan `[구현자 기입] 라운드 2` 와 INDEX 비고 두 곳). HEAD 상태 수치는 전부 일치하므로 **고칠 대상은 시작 상태·증분 서술뿐**이다. r1 D6 과 같은 축이다.

#### 처리 방향 제안 (구현 턴 몫)

- E1~E4 는 문장 정정이다. **불변식을 사이트 단위로 다시 세운다** — "한 심볼이 어느 버킷인가" 가 아니라 "이 사이트의 단언이 현재형인가".
- §19 심볼 블록을 `**bold**` 와 소문자-하이픈 식별자까지 넓힐지는 구현 턴 판단이나, 넓히지 않는다면 **넓히지 않은 이유를 §19 에 적는다**(계측 정의가 곧 불변식의 정의다 — plan §10 이 r2 에 스스로 쓴 문장).

#### 파생 관찰 (수정 불요)

- `adapters.md` 의 ts 펜스에서 `OrcaHookSet`→`NormalizedHookSet` 치환 후 주석 정렬이 어긋난다(`hooks: NormalizedHookSet                // …`). 외형뿐이다.
- AC1 행의 "출력 0줄" ↔ §19 "예외표와 일치" 문자 불일치(§0).
- AC6 의 ADR-002 링크가 `prompts/` 제거 근거를 담지 않는다 — 구현자 보고만 #1, 사람 결정 대기.
- `app/src/shared/ipc.ts:394` 주석의 `InteractionBroker` — 코드라 이번 범위 밖(코드 변경 0).

### 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상: 그렇다.** r1 FAIL 사유는 "계측 정의가 불변식보다 좁다"(정규식 형태 축)였고, r2 FAIL 사유는 같은 문장의 다른 형태다(버킷 단위 축 · 백틱 전용 축). **두 라운드가 같은 축에서 실패했다.**
- **관련 plan 지침의 존재 여부: 있었다.** plan §10 이 r2 에 "계측 정의가 곧 불변식의 정의가 되므로 정의를 좁게 잡으면 게이트 green 이 전수를 뜻하지 않는다" 를 명문화했다. **그 문장을 쓴 라운드가 같은 방식으로 다시 좁았다** — 규칙을 적는 것이 적용을 보장하지 않는다.
- 사용자 결정 변경 근거: 없음. Ledger 무변경. 이번 턴 사용자 결정 3건은 기존 ACTIVE 와 충돌 없음.
- 반복된 검증 환경 한계: **해소.** r1 은 `node_modules` 부재로 게이트 3개를 못 돌렸고 r2 검증 세션에는 있었다. 남은 한계는 electron 바이너리 1파일뿐이며 guides 가 그것을 문서화한다.
- 자기보고 합계 축(0187 r1 · 0189 r1 · 0190 r1 · 0191 r1 D6)의 재발: **사본 갈림은 없다**(세 사본 일치). **분모·증분이 실측과 갈린다**(E5).
- 현재 라운드 수: **2** (다음 재구현이 라운드 3). `docs/handoff/AGENTS.md` 의 review 트리거 중 *같은/유사 실패 반복* 은 성립하고 *라운드 3 초과* 는 아직 아니다 — 수행 여부는 사용자·`handoff-review` 판단이다.

### 15. 결론

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
