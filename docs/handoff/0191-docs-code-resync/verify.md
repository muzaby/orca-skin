# Verify — 0191-docs-code-resync

## 메타

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

## 0. 기준선 / plan 변경 확인

**기준선이 diff 로 성립한다.** `1c9b260`(설계) → `d102df9`(구현) → `c555849`(보고)로 커밋이 갈렸다.

- 구현 커밋이 `plan.md` 를 변경했는가: **아니다.** `git diff 1c9b260..d102df9 -- docs/handoff/` = 빈 출력.
- Decision Ledger 변경: 없음. `git diff 1c9b260..HEAD -- .../plan.md` 의 추가행이 전부 `[구현자 기입]` 이하다.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AC1~AC12 원문 그대로.
- 채점에 사용할 원 기준: `1c9b260` 의 §3 Decision Ledger · §7 AC1~AC12 · §10 강제 지점 표.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 = `docs/` 전수 + app 하위 AGENTS | 두 축 모두 수정됨 | 22파일 = docs 20 + `app/AGENTS.md` + `app/src/main/AGENTS.md` |
| D-002 provider-runtime 은 경로·상태 문구만 | 절 구조 불변 | `^## ` 20개 · 제목·줄번호까지 동일(§7) |
| D-003 폐기 절 삭제 + ADR 링크 | 본문 소멸 | `system-prompt.md §2` 43줄 → ADR-002 링크 |
| D-004 guides 포함 | 3파일 수정 | closed-network · workspace-isolation · release-operations |
| D-005 "보고 따라할 수 있도록" | 명령이 실제로 돈다 | §8.1 명령 3개 — 구현자 실행, 검증자 재현 불가(§9) |
| D-006 OQ9 미결 | PRD 비범위 | `PRD.md` 미변경 확인 |
| D-007 루트 AGENTS 비범위 | 미변경 | 루트 `AGENTS.md` diff 0 |

### end-to-end 흐름

```text
에이전트/배포자
  → docs/INDEX.md 라우팅
  → arch/*.md · guides/*.md
  → 인용한 코드 경로·심볼
  → 실재하면 코드 도달 / 부재하면 조용한 오안내
```

이 흐름의 마지막 칸이 이번 FAIL 의 자리다 — 스윕이 세는 형태의 경로는 0건이 됐고, 스윕 밖 형태에서 4건이 남았다(D1~D4).

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 조용하다 | 부재 경로는 예외를 던지지 않는다. 독자가 자기 체크아웃을 의심한다 |
| false success 가능성 | **있다** | §19 스윕이 0줄이어도 상대 경로 인용은 계측 밖이다(D2·D3·D4) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 요구는 "문서를 코드에 맞춘다", 코드 변경 0 을 diff 로 확인 |
| 증상만 제거하고 상태가 남았는가 | **부분적으로** | 스윕 20건은 원인까지 고쳤으나 같은 불변식의 다른 표면이 남았다 |
| 역사적 인용을 지워 게이트를 통과시켰는가 | 아니오 | 확장자를 떼 산문화한 지점 0. 20건 전부 현재 경로로 치환됐다 |
| 캐시/축소가 관측을 없앴는가 | 해당 없음 | 문서 작업 |

## 3. 역방향 탐색

`scan-surface.sh` 는 코드 diff 용이라 코드 변경 0 인 이번 range 에서 산출이 없다. 대신 **문서→코드 방향의 역방향 스윕 2종**을 직접 돌렸다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 백틱 `.ts`/`.tsx` 경로 중 어떤 base 로도 해석 안 되는 것 | **결함 3건** | `ux-domains.md:95`·`IPC_CONTRACT.md:445`·`system-prompt.md:106` (D2·D3·D4). 나머지는 파일명 단독 인용 또는 명시적 역사 서술 |
| 백틱 CamelCase 심볼 중 `app/src` 부재 | **결함 1군** | `OrcaHookSet`/`OrcaHookEvent`/`OrcaHookHandler`/`ORCA_TO_CLAUDE_EVENT` (D5). `RevertManager`·`OrcaCapabilities` 등 나머지는 목표 계약 또는 "구 …" 표기로 정상 |
| 폐기 파일명 `claude-code.ts` 잔존 | **결함 1건** | 범위 내 4건 중 3건은 "구 claude-code.ts", `provider-runtime.md:188` 만 현재형 (D1) |
| 형제 문서 정책 비대칭 | 경미 | `app/AGENTS.md` 는 `settings-reactions.ts` 를 열거, `app/src/main/AGENTS.md` 는 누락 |
| producer ↔ consumer 파생 불일치 | 발생 | 루트 `AGENTS.md`(`src/shared/i18n/ko.ts`) ↔ 이번에 고친 `TRD.md N2`(`app/src/renderer/src/shared/i18n/`)가 갈렸다 — D-007 로 의도된 범위 밖 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트: 없음(문서 전용). 대신 AC7 이 **가이드가 지시하는 명령 자체**를 대상으로 삼는다.
- structural proxy 만으로 semantic 목표를 통과시킨 AC: **AC1**. 목표는 "독자가 부재 파일로 안내받지 않는다"인데 측정은 `src/(main|renderer|shared|preload)/` 로 시작하는 경로만 센다. 그 정규식 밖에서 3건이 살아남았다(D2·D3·D4).
- 구현자 자기보고를 증거로 쓰지 않았다 — AC1~AC12 전부 이번 턴에 재측정했다(§5).

## 5. 요구사항 충족 매트릭스

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

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan 이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 인용 `src/**` 경로 실재 | 범위 내 문서 + AGENTS 3종 (스윕이 한 번에) | 스윕 대상 20/20 · 스윕 밖 표면 미포함 | ⚠️ 계측 정의가 불변식보다 좁다 |
| 수치 본문 미기재 | `check-doc-inventory.mjs` prose | 1/1 — `prose ok` 재실행 | ✅ |
| 상대 링크 해석 | 동 links | 1/1 — `links ok` 재실행 | ✅ |
| guides 절차 실행 | §8.1 명령 3개 | 0/3 재현 — 환경 제약(§9) | ⚠️ 구조 방증만 |
| §8.1 인용 테스트 실재 | 새 표 8행 | 20/20 + `confluence/*` 7파일 | ✅ 재측정 |
| renderer 보조 명령 | §8.1 각주 1건 | 2파일 실재 확인, 실행 불가 | ⚠️ |

- **표에 없는데 같은 불변식이 필요한 지점: 있다.** 구현자가 `[구현자 기입]` 에서 "인용 *심볼* 실재" 를 새 축으로 올리고 3심볼(`InteractionBroker`·`RevertManager`·`RISKY_TOOLS`)로 닫았다고 보고했다. **그 불변식이 전수로 닫히지 않았다** — D1·D5 가 같은 축에서 남았고, D2·D3·D4 는 경로 축의 같은 공백이다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `app/deployment/` 표면 (`AuthDefinition`·`AuthBinder`·`UsageFetcher`) | 이번 턴 계약 변경 0. §1.1 factory 표가 실제 파일 5개와 일치 | §8.2 절차가 §1.1 과 같은 파일을 지시 | ✅ |
| `IPC_CONTRACT.md` 채널 계약 | `check-doc-inventory.mjs` 76채널 ok | `prompts/plan-feedback.ts` 인용이 부재 경로 | ⚠️ D3 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **경로 부재 총계**: base 스윕 재실행 = **20줄** ✓ (plan 기재와 일치). HEAD = **0줄** ✓.
- **내역 합 ≠ 총계**: plan §8 검산이 `provider-runtime 11 + IPC_CONTRACT 2 + TRD 2 + backend/overview 1 + frontend/overview 1 + claude-code-spec 1` 로 적었다 — **합이 18 이다.** base 스윕 원본을 파일별로 재집계하면 provider-runtime 몫은 **13**(줄 26·98·143·202×3·217×2·254·274·407·408·525)이고 그때 합이 20 이 된다. AC3 의 "부재 11건 → 0건" 과 구현자의 "AC3 부재 11→0" 은 둘 다 이 잘못된 분자를 물려받았다.
- **AC2 잔여 `❌` 상태행**: plan §7 주의사항 **5종** · 구현자 보고 **6행** · 재측정 **7행** — backend `overview.md` 190(OpencodeAdapter)·201(Artifacts)·210(`options.hooks`)·212(Zustand persist) + frontend `overview.md` 81(멀티세션 UI)·82(단축키)·83(단절 배너). plan 이 빠뜨린 2행은 `options.hooks`·멀티세션 UI 다.
- **§8.1 스코프 테스트 파일 수**: `src/main/features/{auth,gate,harnesses,plugins}` + `src/main/app` = **41** (auth 11 · gate 1 · harnesses 5 · plugins 7 · app 17). 문서가 적은 "41파일 중 40 통과" 의 분모와 일치한다.
- **0건 게이트가 역사적 인용을 지웠는가**: 아니다. 확장자를 떼 산문화한 지점 0건 — 20건 전부 현재 경로로 치환됐고, `claude-code.ts` 3건은 "구 …" 표기로 이력을 남겼다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| §8.1 명령 3개 | 인용 테스트 20개 실재 · 스코프 파일 수 41 대조 | 명령 실행 산출 | `cd app && npm ci && npm run typecheck && npm run lint && ./node_modules/.bin/vitest run <5디렉토리>` |
| §8.2 배포 실기 | 파일명·절차 순서 정합 | 사내 로그인 왕복 | 폐쇄망에서 로그인 화면 → 메인 UI → 연결 탭 |

"UI/electron 이라서" 로 넘긴 순수 로직은 없다 — 이번 턴에서 넘긴 것은 의존성 설치가 필요한 명령 실행과 사내 네트워크뿐이다.

## 9. 게이트 재실행

- 실제 실행 명령: `node app/scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**(exit code 아님): `generated doc ok (9 items, 76 channels)` · `prose ok: no inventory counts restated in current-state docs` · `links ok: every relative markdown link resolves` — 3항목 전부 출력됨.
- **재현하지 못한 게이트**: `npm run typecheck` · `npm run lint` · scoped `vitest run`. **이 컨테이너에 `app/node_modules` 가 없다**(`ls app/node_modules` → No such file). 설치 없이는 셋 다 실행 불가라 구현자가 보고한 산출(`0 errors / 1 warning`, `41파일 중 40 통과 · 506 케이스`)을 독립 확인하지 못했다. 구조 방증만 남긴다 — 인용 테스트 20개 실재, 스코프 파일 수 41 일치. **이는 통과 증거가 아니다.**
- `npm test` 사용 여부: 사용하지 않았다. DB 동작 검증이 필요 없는 문서 작업이다.
- 환경 기인 실패 분리: 구현자가 보고한 실패 5파일은 better-sqlite3 네이티브 바인딩으로, `app/AGENTS.md` 기재 목록과 같다고 보고됐다. 검증자는 재실행하지 못해 이 분리를 확인하지 못했다.
- **게이트가 작업 트리를 바꿨는가**: 검증자가 실행한 명령은 `--check` 하나로 쓰기가 없다. `git status` 클린 유지. 다만 **guides §8.1 의 2번 명령이 `eslint --cache --fix` 다** — 배포자가 따라 하면 자기 소스가 조용히 수정된다(파생 관찰).
- 검증 중 명령이 남긴 잔여물: 없음.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| 인벤토리 가드 | 에이전트 실행·출력 증거 확보 |
| lint/typecheck/vitest | **미실행** — 의존성 부재(§9) |
| AC ↔ 코드/production path | 에이전트 1:1 대조 완료(§5) |
| 문서 형식·링크·경로·심볼 | 에이전트 정적 스윕 2종 완료(§3) |
| AGENTS 위생·부모/자식 모순 | 에이전트 스캔 완료(§11) |
| PRD §11 OQ9 | **사람 결정** — D-006 유지, 이번 턴 미결 |
| §8.2 사내 로그인 왕복 | **사람 실기** |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 키/토큰/PW/이메일/IP 등 민감 패턴: **0건** (`app/AGENTS.md`·`app/src/main/AGENTS.md` diff 전수).
- 일회성·변동성 운영정보 혼입: 없음. 오히려 "스크립트 3종/4종" 고정 수치를 열거로 바꿔 규칙 쪽으로 정렬했다.
- 부모 ↔ 자식 명령 충돌: 없음.
- 새 `AGENTS.md`: 없음 — stub·루트 표 갱신 불요.

### INDEX 보드 정합성

- 단계 `impl` · 상태 `IMPL_DONE` · 다음 주체 `Claude(검증)` · 대상 커밋 `d102df9` — 전부 실제와 일치했다.
- 비고 **636자** — 현행 보드 27행 중 두 번째로 짧고 상세를 `plan.md` 로 링크한다(0190 선례 13,190자). 5줄 상한 준수로 본다.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- `d102df9`·`c555849` trailer: `Agent: claude` · `Handoff:` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` — root `AGENTS.md` 허용값 준수.
- **plan 커밋 `1c9b260` 이 `Status: implemented`** 다. 설계만 담긴 커밋이 "구현됨" 을 말한다 — 허용값 표에 plan 단계 값이 없어 생긴 틈이다(보고만, 이번 FAIL 사유 아님).
- 인용 해시 실재: `d102df9` ✓.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

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

## 13. [FAIL 시] 파생 이슈

- [ ] **D1** — `provider-runtime.md:188` 이 현재형으로 폐기 파일명 `claude-code.ts` 를 쓰고 "매 턴 one-off `query()` 호출" 이라 적는다. 같은 문서 line 202 는 이번 턴에 "streaming input 으로 살아있는 `Query` 핸들 유지" 로 고쳐졌다 — 문서 내 자기모순. 실제 코드는 `adapters/claude.ts:346` `prompt: input.stream`. AC3 범위 안.
- [ ] **D2** — `ux-domains.md:95` 가 부재 파일 `features/skills/components/customize/SkillsCustomizeView.tsx` 를 인용한다. 해당 디렉토리 실제 파일 11개에 그 이름이 없다. 같은 심볼이 `layers.md:69`·`frontend/overview.md:76` 에도 있다.
- [ ] **D3** — `IPC_CONTRACT.md:445` 가 0062 에서 제거된 `prompts/` 를 가리킨다(`prompts/plan-feedback.ts`). 실제는 `adapters/plan-feedback.ts`. 채널 계약 SSOT 문서다.
- [ ] **D4** — `system-prompt.md:106` 이 현재 cwd 소유자로 부재 경로 `ipc/router.ts` 를 인용한다(핸들러는 `app/handlers/` 로 이설).
- [ ] **D5** — `adapters.md §3.2.5`(81·223·311~316)가 **"코드 진실 … 이미 구현·테스트된 코드다"** 로 `OrcaHookSet`·`OrcaHookEvent`·`OrcaHookHandler`·`ORCA_TO_CLAUDE_EVENT` 를 단언한다. `grep -rn OrcaHookSet app/src` = **0**. 실제는 `NormalizedHookSet`/`NormalizedHookEvent`/`NormalizedHookDecision`(`adapters/hooks.ts`) + `adaptHooks`(`claude-adapt.ts:120`). `provider-runtime.md:29`·`terms.md:30` 에도 같은 이름이 있다.
- [ ] **D6** — 자기보고 개수 3축이 어긋난다. ① AC2 잔여 `❌`: plan 5 · 구현자 6 · 재측정 **7**. ② plan §8 내역 합 18 ≠ 총계 20. ③ provider-runtime 몫 재측정 **13**(plan·구현자 모두 "11"). 재구현 시 세 숫자를 함께 고친다.

### 파생 관찰 (수정 불요, 판단만 남긴다)

- guides §8.1 의 2번 명령 `npm run lint` = `eslint --cache --fix` — 배포자의 작업 트리를 조용히 고친다. D-005("보고 따라할 수 있도록") 관점에서 부작용을 한 줄로 밝힐 가치가 있다.
- `app/src/main/AGENTS.md:29` app 열거에 `settings-reactions.ts` 누락(`app/AGENTS.md` 에는 있음).
- `decisions/002-feature-slice-boundaries.md` 본문이 `prompts/` 정적 정책 체인 제거를 다루지 않는다 — AC6 의 ADR 링크가 근거를 담지 못한다.
- 루트 `AGENTS.md`(`src/shared/i18n/ko.ts`) ↔ `TRD.md N2`(`app/src/renderer/src/shared/i18n/`)가 갈렸다. D-007 이 의도적으로 범위 밖에 뒀다.
- `app/src/shared/ipc.ts:394` 주석이 개명 전 `InteractionBroker` 를 쓴다 — 코드라 이번 범위 밖(코드 변경 0).

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 라운드 1 이라 없음. **다만 D6 의 합계 축은 0187 r1·0189 r1·0190 r1 과 같은 축이다** — 이번엔 사본 3곳이 서로 일치했고(개선) 분모 자체가 실측과 갈렸다.
- 관련 plan 지침/AC 의 존재 여부: **부분적으로 있었다.** §10 이 "경로 실재" 를 강제 지점으로 세웠고 구현자가 "심볼 실재" 를 추가로 올렸다. 두 축 모두 *전수 정의*가 없었다 — 스윕 정규식이 곧 정의가 되어 그 밖은 아무도 세지 않았다.
- 사용자 결정 변경 근거: 없음. Decision Ledger 무변경.
- 반복된 검증 환경 한계: **의존성 부재로 게이트 3개 미재현.** 0191 은 `npm ci` 가 되는 세션에서 구현됐고 검증 세션에는 `node_modules` 가 없다 — 구현/검증 환경이 갈리면 AC7 형 "명령 실행" AC 는 검증자가 재현할 수 없다.
- 현재 라운드 수: 1

## 15. 결론

**FAIL (라운드 1).** AC 12건 중 8건이 재측정으로 충족되고 4건이 ⚠️ 다. Product/UX 핵심 흐름의 큰 몫 — 스윕 대상 경로 20→0, guides §8 재작성, 상태 표기 8건 정정 — 은 코드 대조로 확인됐고 ACTIVE Decision 7건과 충돌이 없다. 그러나 이번 작업이 세운 불변식("문서가 인용한 경로·심볼이 실재한다")이 전수로 닫히지 않았고(D1~D5), 자기보고 개수가 실측과 갈린다(D6).

다음 주체는 **Claude(재구현)** 다. D1~D6 을 닫을 때 스윕 정규식을 상대 경로까지 넓히고, 심볼 축의 강제 지점을 §10 표에 정식으로 올린다.
