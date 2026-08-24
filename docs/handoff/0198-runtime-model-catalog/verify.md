# Verify — runtime-model-catalog

## 메타

| 항목 | 값 |
|---|---|
| slug | `0198-runtime-model-catalog` |
| 검증자 | Claude Code |
| 일자 | 2026-08-24 |
| 대상 커밋/range | `d479e7c..fb04047` (r1 `803bd50` + r2 `fb04047`) |
| 구현 전 plan 기준 | `d479e7c` (설계 갱신) |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude Code |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **예**. r1 `803bd50`이 `[구현자 기입]` 절을, r2 `fb04047`이 **규범 행**(D-002·D-003·AC2·AC3·§10 2행)을 바꾸고 **AC14를 신설**했다.
- **기준선이 diff로 성립하는가**: **부분**. 설계 커밋(`a5f06c4`·`d479e7c`)과 r1 구현은 갈라져 있으나, **r2의 규범 행 정정이 구현 산출과 같은 커밋(`fb04047`)에 들어 있다** — root `AGENTS.md`의 "설계 커밋은 구현 산출과 같은 커밋에 담지 않는다"에 어긋나며, r2 구간에서는 §0의 자기 증명 방지 장치가 작동하지 않는다.
- Decision Ledger 변경: D-002·D-003이 r2에서 재작성됐다. 방향은 **완화가 아니라 강화**다 — D-002는 "family 첫 일치"에서 "같은 family 항목 전부 보존"으로, D-003은 "alias=self"에서 "alias=`custom`·model=self"로 바뀌었고 AC14가 추가로 늘었다. 근거는 plan §2·§3의 "사용자 후속 결정"이다.
- AC 변경: AC2·AC3 재작성 + AC14 신설(분모 13 → 14). 자기 코드에 맞춘 완화는 관측되지 않는다.
- 채점에 사용할 원 기준: **현행 AC1~AC14 원문**. 변경이 요구를 넓히는 방향이라 r1 원 기준으로 채점해도 결과는 같다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | `availableModels: string[]`만 인정 | settings: `settings-entries.ts:51` → `availableModelsOf` ✅ · runtime: `runtime-catalog.ts:58` **guard 없음** ❌ |
| D-002 | 같은 family 복수 항목 전부 보존 | `normalizeAvailableModels` 모델명 기준 dedupe → 보존 ✅ |
| D-003 | family 표시 `custom` · 실행값 self | `modelKey = model ?? alias` (main·renderer 2사본) ✅ |
| D-004 | 정적·동적이 같은 정규화 규칙 | 분류·dedupe는 동일, **기본 선택은 갈린다** ❌ (§5 AC4) |
| D-005 | 인증 성공 → read-only 항목 생성 | `reconcile` → `entries` → `agent:list`, `readOnly:true` ✅ (mutation 거부는 우회 가능) |
| D-006 | `AuthRuntime.subscribe` 트리거, polling 없음 | `bootstrap.ts:382-395` + 부팅 catch-up `:496` ✅ |
| D-007 | 두 UI가 같은 `orca:agent:list` 소비 | `useAgents`·`useEngines` 모두 agentStore + `providerApi.onState` ✅ |
| D-008 | 로그인당 fetch 1회, 세션은 cache만 | `inFlight`+`resolvedRevision` 단일 비행 ✅ · `turn-setup.ts:54` cache read ✅ |

### end-to-end 흐름

```text
settings.json → parseClaudeModels → toAgentEnvironments ─┐
                                                          ├→ agent:list → agentStore → EngineCard / ModelMenu
AuthChange(verified) → reconcile → runtime.resolve 1회 ──┘                              ↓
                                                                          turn-setup(list, fetch 0) → modelNameForFamily → SDK
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 부분 결함 | augmenter가 배열이 아닌 값을 주면 예외 없이 **가짜 모델**이 생긴다(§5 AC1). |
| false success 가능성 | **있음** | `availableModels:'abc'` → `custom/a`·`custom/b`·`custom/c` 3항목이 두 UI에 노출된다. |
| partial failure/rollback | 정상 | resolve reject는 해당 contribution만 제거하고 settings entry는 건드리지 않는다(검증자 재현). |
| Product/UX의 A가 아닌 B를 구현했는가 | **있음** | AC10의 "사라진 선택 재화해"가 **선택이 살아 있는 세션 로드까지** 발동해 provider를 바꾼다(§5 AC10). |
| 증상만 제거하고 상태가 남았는가 | 아니오 | catalog는 메모리 파생 상태뿐이며 파일·DB 쓰기가 없다. |
| 최적화가 잃은 재검증 관측 | 아니오 | `credentialRevision` 변화마다 refetch하고 revoke가 `resolvedRevision`을 지운다. |
| 출력/요청 worst-case 상한 | 계산됨 | 출력 = settings 모델 + contribution별 `availableModels.length`. 요청 = 로그인 1회 × contribution 수, 세션/턴 추가 0. |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh d479e7c..fb04047
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공란. |
| 테스트 전용 참조 8건 | **범위 밖(기존)** | `harness-runtime.ts`·`runtime-config.ts`의 8심볼은 0188 배포 확장점이며 이번 diff가 만든 것이 아니다. |
| 형제 정책 비대칭 | 없음 | 스크립트 3 공란. |
| 신규 등록값의 기존 소비처 | **회귀 1건** | `modelKey` 의미 변경(alias → 모델명)이 세션 로드 화해 경로를 깬다(§5 AC10·AC12). |
| producer ↔ consumer 파생 불일치 | **있음** | 두 producer가 같은 배열에서 서로 다른 `isDefault`를 만든다(§5 AC4). |
| 동일 규칙 중복 구현 | 의도된 2사본 | `modelKey`가 main `models.ts:11`과 renderer `modelSelection.ts:10`에 있다. 프로세스 경계라 공유 불가, 두 구현은 동일 식이다. |
| 죽은 분기 | **있음** | `Composer.tsx:166` `providerKey && modelFamily == null` 분기는 도달 불가다 — 앞 분기가 항상 먼저 잡는다. |
| 배선됐으나 인스턴스 0 | 사실 기록 | `RUNTIME_MODEL_CONTRIBUTIONS = []`(`harness-runtime.ts:118`)이라 기본 배포에서 runtime catalog는 동면한다. `AUTH_INVALIDATED_HARNESS_KEYS = {}`와 같은 0188 배포 선언 패턴이라 결함으로 보지 않는다. |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 존재: `settings.test.ts`·`model-parser.test.ts`·`runtime-config.test.ts`·`auth-resume.test.ts` 모두 실재한다.
- 신규 테스트가 production 심볼을 부르는가: 예. `runtime-catalog.test.ts`는 `createRuntimeModelCatalog`를, `modelSelection.test.ts`는 `defaultSelection`/`selectionExists`를 직접 부른다 — 로컬 재구현 없음.
- **structural proxy만으로 통과한 AC**: AC13. `runtime-catalog.test.ts:86`은 `runtime.resolve(contribution)`를 두 번 직접 부르며, 실제 `resolveTurnProvider`나 세션 생성 경로를 지나지 않는다.
- **주장한 검증 수단이 없는 AC**: AC6·AC11이 말한 "auth-resume 배선 테스트"·"bootstrap 통합 테스트"가 **존재하지 않는다**. `grep -rn "runtimeModelCatalog|RUNTIME_MODEL_CONTRIBUTIONS" src --include=*.test.ts` → `runtime-catalog.test.ts` 단일 파일.
- `N회` 관측 주체: `vi.fn()` augmenter 호출 수로 단언한다 — 실제 fetch 주체와 일치한다.
- 순서 기준: `bootstrap.ts:382`(구독)이 `:425`(`authResume.run()`)보다 앞이다. 다만 `runtimeModelCatalogRef.current` 대입은 `:494`라 그 사이 이벤트는 catalog에 닿지 않으며, `:496`의 부팅 catch-up 루프가 그 창을 덮는다. **이 순서를 잠그는 테스트는 없다.**

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 정확한 배열만 인정, 비배열은 자동 모델 0 | ❌ | 검증자 재현: runtime 경계에 `availableModels:'abc'` → `custom/a·b·c` 3항목 생성 | settings ✅ / augmenter ❌ |
| AC2 | family 결정적 분류 + 같은 family 복수 보존 | ✅ | `available-models.test.ts` 3케이스 · 검증자 재현 `sonnet-a`·`sonnet-b` 동시 보존 | parser → catalog |
| AC3 | custom은 `custom` 분류 + 실제 모델명 병기 + self 실행 | ✅ | `ModelMenu.tsx:56,62` alias+model 2행 · `EngineModelList.tsx:18,21` · `modelNameForFamily(custom,'orca-private-v1')='orca-private-v1'` | catalog → UI → turn-setup |
| AC14 | env 항목 선행 → `availableModels` 배열 순서로 추가 | ✅ | 검증자 재현: `env-sonnet` → `claude-sonnet-4-5` → `claude-sonnet-4-6` 순서 일치 | settings env + availableModels |
| AC4 | 정적·동적이 같은 dedupe·분류·**기본 선택** 규칙 | ❌ | 같은 배열에서 runtime default=`claude-sonnet-4-5`, settings default=`claude-sonnet-4-6` | 두 producer → normalizer |
| AC5 | 인증 Harness LLM이 read-only로 등록 | ⚠️ | 등록 ✅(`runtime-catalog.test.ts`) · mutation 거부는 우회 가능(§5 강제 지점) · 기본 배포 인스턴스 0 | Auth → catalog → agent:list |
| AC6 | 수동·자동 로그인 각각 fetch 정확히 1회 | ⚠️ | catalog 내부 단일 비행은 실증 ✅ · **배선 테스트 부재** | authResume/login → reconcile |
| AC7 | revoke·expired·unauthorized·unavailable·실패 시 해당 entry만 제거 | ✅ | 코드 5전이 전건 도달 · 구현자 테스트 4/5 · **fetch 실패 제거는 검증자가 심어 확인** | AuthChange/failure → catalog |
| AC8 | 늦은 성공 폐기 + 재인증 새 fetch 1회 | ✅ | `runtime-catalog.test.ts:61,75` 두 케이스가 fence 제거 시 실패한다 | subscribe → fence |
| AC9 | Engine read-only 표시 + 액션 미제공 + IPC 거부 | ⚠️ | 배지·버튼 숨김 ✅(`EngineCard.tsx:20,34`) · ko/en 2언어 ✅ · **IPC 거부 우회 가능** · 두 테마 시각은 사람 실기 | agentStore → EngineCard |
| AC10 | Composer가 같은 집합 표시 + 사라진 선택 재화해 | ❌ | 재화해가 과잉 발동해 **세션 로드 시 provider가 바뀐다**(아래 D2) | agentStore → Composer |
| AC11 | 재시작 시 grant만으로 미노출, verified 후 1회 fetch | ⚠️ | 코드 경로 정합(`verified`는 비영속 + 부팅 catch-up) · **테스트 부재** | restore → authResume → catalog |
| AC12 | 기존 CRUD·기본 3 alias 동작 회귀 없음 | ❌ | env-only parser 경로는 기존 테스트 전건 통과 · **세션 로드 provider 전환이 회귀**(D2) | engine IPC → agent:list |
| AC13 | 세션 N·턴 M에서 fetch 증가 0 | ⚠️ | `turn-setup.ts:54`는 cache read ✅(코드) · 테스트는 `runtime.resolve` 직접 호출 프록시 | login → cache → turn |

- **합계 재측정**: `✅ 5 · ⚠️ 5 · ❌ 4 = 총 14`. 자기보고는 `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14` — 분모는 일치, **내역이 갈린다**.
- **합계 사본 대조**: 본문 14 ↔ 커밋 trailer `Criteria-Met: 13/14` ↔ INDEX 비고 "기계 AC 13/14" — 세 사본은 서로 일치하나 재측정과 다르다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| exact `availableModels` shape | settings load·runtime resolve (2) | settings `settings-entries.ts:51` ✅ · runtime `runtime-catalog.ts:58` **guard 없음** | **1/2** |
| family + model identity + self | materialize 2 · 선택/표시 2 (4) | parser · catalog · main `modelKey` · renderer `modelKey` | 4/4 |
| runtime entry의 Auth 파생성 | verified·revoke·expired·unauthorized·failure (5) | 판정 1분기(`!verified \|\| status!=='valid'`)가 4전이, `catch`가 5번째 | 5/5 (테스트 4/5) |
| 로그인당 fetch 1·세션 0 | login 1 · session create·turn setup 2 (3) | `bootstrap.ts:394` · `misc.ts:42` · `turn-setup.ts:54` 모두 cache read | 3/3 (배선 테스트 0/3) |
| read-only provenance | DTO·UI·add·update·delete·read (6) | 6지점 모두 존재하나 IPC 4지점이 **대소문자·공백 변형으로 우회** | **실효 2/6** |
| 두 UI 동일 snapshot | Engine·Composer (2) | `useEngines.ts:31` · `useAgents.ts:12` 둘 다 `onState → refreshAgents` | 2/2 |

- **분모 재측정**: 2+4+5+3+6+2 = **22**. 실효 닫힘 **17/22**. 구현자 r1 자기보고 `20/20`은 §10 2행이 r2에서 2→4로 늘기 전 분모이고, r2 보고(1/1·2/2·2/2·2/2)는 표와 다른 분해라 대조 불가다.
- 표에 없는데 같은 불변식이 필요한 지점: **기본 선택 규칙의 producer 간 동일성**. AC4가 요구하지만 §10에는 행이 없어 아무도 강제하지 않았다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RuntimeConfigAugmenter.resolve` → `availableModels?` | 타입 추가 ✅ typecheck 통과 | `undefined`=미제공 ✅ · `[]`=제거 ✅ · reject=제거 ✅ | **런타임 shape 강제 없음** — 타입만으로는 §10 1행을 닫지 못한다 |
| `RuntimeModelContribution` 선언 | 타입 ✅ | 기본 배포 `[]` — 실 인스턴스 0 | 가이드 §6-a에 절차 기록 ✅ |
| `docs/guides/closed-network-extensions.md` | 단계 표에 6-a 추가 | 로그인당 1회·세션 fetch 금지 명시 | ✅ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 관련 스위트 재측정: **16파일 / 110케이스 통과**(`harnesses`·`deployment`·`composer`·`engine`). 자기보고 r2 "5파일 39케이스"는 더 좁은 선택이다.
- 전체 스위트: **210파일 중 205 통과 · 5 실패 / 2072케이스 중 2030 통과 · 42 실패**.
- 실패 5파일 = `infra/db/{queries,migrate}` · `extensions/builder` · `orchestration/fork` · `app/chat-turn.continuity` — `app/AGENTS.md:135`의 알려진 ABI 베이스라인과 **정확히 일치**하며 전부 `Module did not self-register: better_sqlite3.node`다. 변경 무관.
- doc inventory 재측정: **9 items · 76 channels** — 자기보고와 일치.
- 출력 상한: `normalizeAvailableModels`는 입력 배열 길이를 넘지 않는다(dedupe만 감소). 요청 상한: contribution별 revision당 1회.
- 0건 기준: `RUNTIME_MODEL_CONTRIBUTIONS`가 비어 있어 runtime 축의 "0건"은 전수가 아니라 **미배포**를 뜻한다 — 그 사실을 통과 근거로 쓰지 않았다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Engine read-only 배지 | `canMutate` 분기·i18n ko/en 키 존재를 코드로 확인 | 두 테마에서 배지 대비와 버튼 부재 | 앱 실행 → 엔진 & 모델 → 라이트/다크 전환 |
| 로그인 → 카드 출현 | catalog 상태 기계는 주입 테스트로 전건 | 실제 Gate 로그인·revoke 왕복 | contribution을 선언한 폐쇄망 배포에서만 가능 |

- 사람에게 넘기지 않은 것: 분류·순서·선택 화해·fetch 횟수·read-only 판정은 모두 순수 함수로 기계 검증했다.

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(--fix 없이) · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check`.
- **관측한 실행 산출**: typecheck 3구성 전건 무출력 · eslint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 이번 diff 무관 기존 건) · vitest 210파일 2072케이스 · doc inventory 9 items·76 channels.
- `npm test` 미사용 — DB 동작 검증이 필요 없고 `pretest`가 ABI를 뒤집는다.
- 환경 기인 실패 분리 근거: §7의 5파일이 전부 `better_sqlite3.node` self-register 실패이며 `app/AGENTS.md`의 알려진 목록과 일치한다.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`가 `--fix`라 eslint를 직접 호출했고, 실행 후 `git status`는 공란이다.
- **검증 중 실행한 명령의 잔여물**: `npm ci`가 만든 `node_modules`(gitignore 대상)와 검증자가 심었다가 삭제한 임시 테스트 3벌. 실행 후 `git status --short` 공란을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 14건 1:1 대조 완료, 4건 미충족 |
| 계약/레이어/문서 링크 | 기계 검증 통과 |
| 제품 의도 | 아래 D1의 "기본 선택을 env가 갖는가 discovery가 갖는가"는 **사람 결정** 후보 |
| UI 시각 품질 | AC9 두 테마만 사람 실기 대기 |
| PR merge | 사람 승인 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 diff는 `AGENTS.md`를 바꾸지 않았다 — 해당 없음.

### INDEX 보드 정합성

- 상태 `impl/IMPL_DONE (r2)` · 다음 주체 `Claude (검증)` — 실제와 일치했다.
- 비고 4줄 — 5줄 이내 ✅.
- 대상 커밋 칸이 `803bd50`(r1) · **(r2 구현)** 으로 r2 해시가 비어 있다. 같은 커밋에서 자기 해시를 쓸 수 없는 제약이라 이번 검증 커밋에서 채운다.

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Status: implemented` · `Criteria-Met/Pending` · `Verified-By: pending` — 전부 허용값이다.
- **인용 해시 실재: 실패**. plan `[구현자 기입] 구현 보고`의 대상 커밋 `7fb771f`가 존재하지 않는다(`git cat-file -t 7fb771f` → `Not a valid object name`). 실제 r1은 `803bd50`이다.
- **커밋 type 오표기**: r1 `803bd50`은 production 20파일·신규 모듈 2개를 담은 기능 커밋인데 제목이 `docs(models):`다. `git log` 고고학이 이 라운드를 문서 커밋으로 읽는다.
- **설계·구현 동일 커밋**: r2 `fb04047`이 규범 행 정정과 구현을 함께 담았다(§0).
- reference/script 이동·삭제: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "§10 read-only는 3곳이 아니라 6곳" | **타당** — 실측 6지점 확인 | 분모 22로 재계산 |
| "선언 key 자체를 불변 read-only로 판정" | **타당** — `isReadOnly`가 인증 상태와 무관하다 | 다만 키 정규화 누락으로 실효가 깨진다(D4) |
| "catalog `onChange`에서 provider state 재push" | 타당 | `bootstrap.ts:492` 확인 |
| "기존 `HarnessRuntimeConfigService` cache와 결합" | 타당한 설계 대비 차이 | warm-cache 테스트로 뒷받침 |
| "custom 문자열이 SDK에 전달되지 않는다" | **타당** — `modelNameForFamily`가 model 우선 | ✅ |
| "AC 자기보고 13/14" | **불일치** — 재측정 ✅5·⚠️5·❌4 | §5 |

## 13. 파생 이슈

- [ ] **D1 — 두 producer의 기본 선택이 갈린다 (AC4)**. `parseClaudeModels`의 `byAlias = new Map(visible.map(m => [m.alias, m]))`(`model-parser.ts:97`)가 같은 alias에서 **마지막 항목**을 남겨, 자기 주석의 "노출 항목 중 첫 항목"과 반대로 동작한다. 같은 배열이 runtime에서는 `claude-sonnet-4-5`, settings에서는 `claude-sonnet-4-6`을 default로 만든다. env로 명시 구성한 모델이 discovery 항목에 default를 빼앗기는 것이 제품 의도인지 확인이 필요하다.
- [ ] **D2 — 세션 로드가 provider를 바꾼다 (AC10·AC12 회귀)**. `LOAD_SESSION`은 `providerKey`만 복원하고 `modelFamily`는 `initialChatState`의 `null`이다(`chatReducer.ts:666-672`). `modelKey`가 절대 `null`을 반환하지 않으므로 `selectionExists`는 이 상태에서 **항상 false**이고, `Composer.tsx:153` 분기가 `defaultSelection(agents, backend)` — 즉 **첫 supported provider** — 로 화해한다. 저장된 provider가 목록 첫 항목이 아니면 다음 턴이 다른 provider·credential로 나간다. `Composer.tsx:166`의 원래 분기는 이 때문에 도달 불가가 됐다.
- [ ] **D3 — runtime 경계에 exact-shape guard가 없다 (AC1 · §10 1행)**. `runtime-catalog.ts:58`이 `availableModelsOf` 없이 `config.availableModels ?? []`를 그대로 정규화한다. 문자열 `'abc'`는 문자 단위로 순회돼 `custom/a`·`custom/b`·`custom/c`를 만들고, `['sonnet-a', 7]`은 `raw.trim()` TypeError로 **유효 항목까지 통째로** 사라진다.
- [ ] **D4 — mutation 가드가 키 정규화 전 값을 본다 (§10 5행)**. `engine.ts`의 `assertMutable`은 add에서 `` `${req.engine}-${req.provider}` `` 원본을, update/delete/read에서 `req.key` 원본을 본다. 그러나 `settings-write.ts:40`의 `normalizeProvider`가 `trim().toLowerCase()`를 적용하므로 `provider:'Corp'`·`key:'claude-Corp'`는 가드를 통과한 뒤 `claude-corp` 디렉토리를 건드린다. 재현: `isReadOnly('claude-corp')=true` · `isReadOnly('claude-Corp')=false` · `providerKeyOf('claude','Corp')='claude-corp'`.
- [ ] **D5 — AC6·AC11·AC13이 주장한 배선 테스트가 없다**. catalog를 참조하는 테스트 파일은 `runtime-catalog.test.ts` 하나이며 contributions를 직접 주입한다. bootstrap 구독 순서, authResume 경유 1회 fetch, `resolveTurnProvider` 경유 fetch 0은 코드 읽기로만 확인했다.
- [ ] **D6 — fetch 실패 제거 경로에 테스트가 없다**. 검증자가 reject fixture를 심어 정상 동작을 확인했다(entry 제거·다른 entry 보존). 구현자 테스트 5건 중 reject 케이스는 없다.
- [ ] **D7 — 테스트 이름이 단언과 어긋난다**. `available-models.test.ts:26` "deterministically keeps **the first model per family**"인데 단언은 `sonnet-a`·`sonnet-b` 둘 다 보존이다. r1 이름이 r2 의미 변경 후 남았다.
- [ ] **D8 — `agent:list`가 key 충돌을 병합하지 않는다**. `misc.ts:42`가 settings entry와 runtime entry를 단순 concat하므로 같은 key가 양쪽에 있으면 두 행이 나오고 renderer의 `key={agent.key}`가 중복된다. D4를 닫으면 생성 경로는 막히지만 디스크에 이미 있는 디렉토리는 남는다.
- [ ] **D9 — 위생 2건**. `useEngines.ts:7-8`이 같은 모듈에서 두 줄로 import한다. `availableModels` 항목의 `[1m]` 접미사는 `stripOneMillion`을 지나지 않아 env 경로와 의미가 갈린다(모델명에 접미사가 남고 `oneMillionContext`는 false).
- [ ] **D10 — 좌표/커밋 위생 3건**. plan이 인용한 `7fb771f`가 실재하지 않는다 · r1 `803bd50`이 기능 커밋인데 제목이 `docs(models):`다 · r2 `fb04047`이 규범 행 정정과 구현을 한 커밋에 담았다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: r1의 verify가 없어 대조할 판정이 없다. r2는 사용자 피드백이 만든 라운드이지 verify/FAIL 후속이 아니다.
- 관련 plan 지침/AC의 존재 여부: D1은 AC4가, D2는 AC10·AC12가, D3은 AC1과 §10 1행이, D4는 §10 5행이 이미 요구했다 — 지침 부재가 아니라 **강제 지점 표를 AC와 별개로 걷지 않은 결과**다.
- 사용자 결정 변경 근거: D-002·D-003 재작성은 plan §3 갱신 메모에 "사용자 후속 결정"으로 기록돼 있다. 검증 범위 밖의 대화는 확인할 수 없다.
- 반복된 검증 환경 한계: GUI/X server 부재로 AC9 시각 확인은 이번에도 사람 몫이다. better-sqlite3 ABI로 DB 5스위트는 이번에도 red다.
- 현재 라운드: 2. 다음 재구현 후 라운드가 3을 넘으면 `handoff-review`를 먼저 수행한다.

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: D-002·D-003·D-005~D-008은 충족한다. **D-001과 D-004는 미충족**이다.
- AC 충족: `✅ 5 · ⚠️ 5 · ❌ 4 = 총 14`. 자기보고 13/14과 갈린다.
- 강제 지점: 재측정 분모 **22**, 실효 **17/22**. exact-shape 1/2와 read-only 실효 2/6이 미달이다.
- 기준 밖 결함: D2(세션 로드 provider 전환)는 AC 밖이 아니라 AC12 회귀이고, 이번 라운드에서 가장 사용자 영향이 크다.
- repository operation checks: INDEX·trailer 허용값은 정합, **인용 해시 1건 사망 · 커밋 type 1건 오표기 · 설계/구현 동일 커밋 1건**.
- 남은 사람 확인: AC9 두 테마 시각, D1의 기본 선택 주체 결정.
- 다음 단계: **Codex 재구현** — D1~D4를 먼저 닫고 D5~D6으로 관측을 채운다. D7~D10은 위생이다.
