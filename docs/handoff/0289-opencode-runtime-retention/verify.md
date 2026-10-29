# Verify — 0289-opencode-runtime-retention

## 메타

| 항목 | 값 |
|---|---|
| slug | `0289-opencode-runtime-retention` |
| 검증자 | Claude Code |
| 일자 | 2026-10-29 |
| 대상 커밋/range | `dbfb260..81153e2` (r1 `09eb1f9`·`f492ca6`, ΔV1 M1 `f6909b2`, M2 `ecd33b2`, 테스트 보완 `81153e2`) |
| 구현 전 plan 기준 | V1 `dbfb260`, ΔV1 `6923a64` |
| V mode / 유효 V | Baseline V1 + ΔV1 (D20: V1+ΔV1 동시 검증) |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC22(H1)·AC33(H2) 사람 실기 대기 |
| 자기 검증 여부 | 아니오 — 구현 codex, 테스트 보완 `f492ca6`·`81153e2`는 다른 Claude 세션. 그래도 보고에 없는 축 6건(X1~X7)을 넣었다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경은 메타 상태·`[구현자 기입]`뿐이다 — `git show 09eb1f9|f6909b2|ecd33b2 -- plan.md`의 `-` 줄은 메타 3행과 `미착수` 자리표시자뿐.
- 기준선은 diff로 성립한다. 설계(`dbfb260`, `69be56c`~`6923a64`, `Status: designed`)와 구현 커밋이 분리됐다.
- Decision·AC·V·§10(`enforcement.md`) 변경: 구현 커밋에서 0건. `enforcement.md`는 구현 커밋 stat에 없다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode | 유효 | V1@57c841b0 기준 ΔV1, SUPERSEDED pair 없음 |
| NEW/CHANGED ↔ REQUIRED | 유효 | ΔV1 NEW 11 node·CHANGED 2(R6·SD2) 각각 VP06·08·17~27 |
| INHERITED ↔ REGRESSION | 유효 | VP02·03·05·07·09·10 6 pair, 좌표 테스트명 재확인 |
| §10 자리 목록 | 유효 | `enforcement.md` 고정 124자리(V1 90 + ΔV1 34) ↔ 두 evidence 표 ID 양방향 차집합 ∅(D12~D23은 oracle ID라 제외) |
| 적대 증거 | 유효 | V1 M1~M4, ΔV1 M5~M12에 자리·이유 명시 |
| 운영 gate | 유효 | G0~G5 |

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D02~D04 | 마지막 소비자 후 90초 idle, 논리 해제 즉시 | `session-context.ts` idle → `instance-lifecycle.ts` dispose |
| D17·D28 | 첫 send 연결 대기 ≤2초, @언급은 정착까지, 해제 실패는 제출 차단 | `channel.ts:submit` → `mcp-control.ts:submit` → `waitBounded(…,2000)` |
| D19 | 입력 의도 전 MCP HTTP 0 | renderer `onInputIntent` → `composerCatalogState.intent()` → `composer-catalog-owner.ts:124` 역할 검사 → `lease.activate` |
| D26 | 전역 enabled MCP만 `{enabled:false}` 덮어쓰기 | `adapter.ts:client` `disabled` 맵 → `servers.acquire` |
| D25 | 토글 표시 불변 | `mcp-control.ts:preview` enabled=choices, canToggle=false |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | 없음 | 해제 실패 시 `apply()` throw → submit reject(D16c). 연결 실패는 `attempt.failure`로 보존·표시 |
| 무제한 대기 | 없음 | 비언급 대기 `waitBounded(...,2000)`, connect는 `AbortSignal.timeout(120_000)` |
| 늦은 연결의 재활성화 | 방어됨 | `applyChoices`가 off 처리 전 해당 attempt 정착을 기다림(`mcp-control.ts` "late successful connect" 주석 위치) |
| 관측 유실 | 없음 | 수동 read는 `[]`, 활성 후 `observation` revision으로 옛 status 폐기 |
| 결함 모드 | NON_BLOCKING | 해제 실패를 삼키면 submit이 무한 재시도(X2) — 테스트는 worker OOM으로만 red |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `PreparedMcpResources` `deps.prepare` | 죽은 인자 | `prepared-mcp-resources.ts:66` `owners ?? new …(deps.prepare)` — production은 owners를 늘 넘김. B15 1차 변이 동치의 원인 |
| `managedMcpReferences` 신규 getter | 정상 | `channel.ts` 멘션→id 매핑 유일 소비자 |
| `shared/plugin-mention.ts` SSOT | 정상 | renderer `pluginMention.ts`가 re-export, O23 왕복 |
| `composerModelStore` seed | 정상 | 같은 providerKey만, `stale:true`→Controls authoritative=false |

## 4. 테스트 / 고장 이력

- 인용 테스트명 134개 중 102개 문자열 일치, 나머지 32개는 `it.each` 템플릿명 — 변이 실행 출력에서 실제 이름으로 관측(예: `requests MCP once … on first paste intent`).
- **Linux 실행 주의**: `composer-preparation-service`·`adapter`·`adapter.persistent`·`adapter.instances` 테스트는 `C:/` fixture라 이 호스트에서 기준선 red다. `C:/`→`/tmp/lnx/`로 바꾼 미커밋 사본(`*.lnx.test.ts`)이 70케이스 중 69 green이 된 뒤 그 사본으로 변이를 쟀다. 원본으로 잰 B15·K16·K17 첫 실행은 기준선 red라 무효로 뺐다.
- 등록 변이 23자리 전부 재현, 덮개 회귀 0(이전 verify 없음).

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| M1-F3 | `runtime-entry.ts:88` | 호출 대체 | restartRevision → `snapshot.revision` | 잡음 1/3 | `managed-mcp-revision` opencode policy |
| M1-F4 | `chat-turn-continuation.ts:84` | 호출 대체 | 같음 | 잡음 1/3 | 같음 |
| M1-F5 | `respawn-inputs.ts:78` | 고정값 | 현재 값 → spawned 값 | 잡음 3/3 | 세 케이스 |
| M1-F7 | `session-runtime.ts:520` | 호출 대체 | spawn 기록 → total | 잡음 1/3 | opencode policy |
| M2-C3 | `composerCatalogState.ts:168` | 맞바꿈 | agents/models accept 대상 | 잡음 17/28 | `composer-promotion` 승격 케이스 |
| M2-C5 | `chatStore.ts:566` | 제거 | promoteComposer 조건 불성립 | 잡음 1/10 | preserves only the matching promoted catalog |
| M3-B15a | `composer-preparation.ts` `deps.prepare` | 호출 대체 | 별도 service acquire | **동치** | owners 인자가 deps.prepare를 대체 — §3 |
| M3-B15b | `composer-preparation.ts` resources owners | 호출 대체 | 별도 service `.owners('resources')` | 잡음 1/2 | shares targets … production assembly (lnx) |
| M4-H1/H2/H5 | `bootstrap.ts:870`·`515`·`924` | 제거 | warmup update/update/close | 잡음 2·2·1/5 | `bootstrap.opencode-warmup` |
| M5-J1 | `native-resources.ts` trace | 다른 값 | 원문 `error` 운반 | 잡음 1/5 | traces secret-free MCP status classes |
| M5-J2 | `server.ts:135` | 다른 값 | env 값 운반 | 잡음 1/35 | traces which profile components split … |
| M6-J1 | `diagnostics.ts` | 맞바꿈 | timeout↔refused | 잡음 2/6 | classifies MCP errors · native-resources |
| M7-J2 | `server.ts:132` | 뒤집기 | hit에도 발행 | 잡음 8/35 | traces … split |
| M7-J3 | `diagnostics.ts` config 구성요소 | 제거 | `OPENCODE_CONFIG_CONTENT` 제외 | 잡음 2/36 | 같음 |
| M8-K1off | `adapter.ts` disabled 맵 | 제거 | enabled 필터 제거 | 잡음 1/26 | projects disabled global MCP overrides (lnx) |
| M8-K1proj | 같음 | 다른 값 | project MCP 포함 | 잡음 1/26 | 같음 |
| M9-bound | `mcp-control.ts` waitBounded | 다른 값 | 2000→600000 | 잡음 3/11 | sends the first prompt within the bound 외 2 |
| M9-mention | 같음 | 빈 값 | 멘션 대기 `[]` | 잡음 3/11 | waits for an explicitly mentioned … ×2 외 1 |
| M10-K16 | `composer-catalog-owner.ts:124` | 제거 | resources 역할 검사 | 잡음 1/2 | shares targets … (lnx) |
| M10-K17 | `composer-preparation.ts` | 맞바꿈 | resources→catalog 역할 | 잡음 1/2 | 같음 |
| M11-K9 | `mcp-control.ts:preview` | 다른 값 | pending에 enabled=false | 잡음 2/30 | activates directories … · projects disabled … |
| M12-L1 | `server.ts:309` | 호출 대체 | 저장소 키 → 실행 profile 키 | 잡음 1/35 | reuses the database path … |
| X1 | `adapter.ts` managedMcpMentions | 제거 | `connected(id)` 교차 | 잡음 1/60 | projects disabled global MCP overrides |
| X2 | `mcp-control.ts:apply` | 제거 | 해제 실패 throw 삼킴 | 잡음(비정상) | assertion 아님 — 무한 재시도로 vitest worker 종료 |
| X3 | `ComposerInputController.tsx` onPaste | 제거 | 의도 신호 | 잡음 1/28 | first paste intent |
| X4 | `channel.ts` interrupt | 제거 | `admission.abort()` | 잡음 1/34 | handles cancelled admission |
| X5 | `mcp-control.ts:read` | 호출 대체 | 수동 read가 activate | 잡음 3/39 | passive HTTP 0 세 케이스 |
| X7 | `server.ts:313` | 제거 | existsSync 재검증 | 잡음 1/35 | reuses the database path … |

- 검산: 유효 시도 30 = 잡음 29 · 동치 1(B15a) · 못 잡음 0. 형제 슬롯 맞바꿈 M2-C3·M6·M10-K17 포함.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 직접 증거 |
|---|---|---|---|---|
| VP13~16, VP24~27 | UT | REQUIRED | PASS | `instance-retention`·`discovery-cache`·`diagnostics`·`mcp-connection`·`plugin-mention`·`composerCatalogState` 전부 green, M6·M9·M11 red |
| VP10~12, VP20~23 | IT | REQUIRED | PASS | `composer-preparation-service`(lnx)·`adapter`(lnx)·`server`·`native-resources`, M3·M5·M7·M8·M10·M12 red |
| VP07~09, VP19 | ST | REQUIRED/REGRESSION | PASS | `opencode-mcp-reconcile`·`bootstrap.opencode-warmup`·`server` 공유 profile, M4·M9 red |
| VP01~05, VP17·18 | AT | REQUIRED/REGRESSION | PASS | `session-resources.cancellation`·`composer-promotion`·`managed-mcp-revision`, M1·M2 red |
| VP06 | AT | REQUIRED | PASS(기계) / H1·H2 대기 | 기계 자리 59 green, 실제 GUI·타 PC 미실기 |

- §10 분모: 124자리 ID 양방향 차집합 ∅. 자리별 좌표는 구현 evidence 표를 출발점으로 쓰고 변이 자리 30곳은 위 표가 직접 재측정했다.
- AC 합계 재측정: ✅ 31 · ⚠️ 2(AC22·AC33) · ❌ 0 = 33. trailer `Criteria-Met: 31/33`(`ecd33b2`·`81153e2`)·INDEX 비고와 일치.

## 6. 게이트 (HEAD `81153e2`, Linux)

| Gate | 관측 | 판정 |
|---|---|---|
| typecheck | node/web/test exit 0 | PASS |
| lint | 0 error / 2 warning(기존 React Compiler), 실행 후 `git status` 변경 0 | PASS |
| doc inventory `--check` | generated·prose·links ok, exit 0 | PASS — 구현자 보고의 링크 10건 실패는 로컬 임시 checkout 탓, 여기선 재현 없음 |
| vitest 전체 | 865파일 8,035케이스: 309 fail(70파일) | 환경 — 아래 |
| 실패 70파일 재실행 | `npm rebuild better-sqlite3`(Node ABI)·electron 바이너리 설치 뒤 603케이스 중 21 fail / 8파일 | 전부 플랫폼: `C:/` fixture 4파일, `process.platform === 'win32'` 게이트(`claude/native-resources.ts:39`) 4파일 |
| 기준선 대조 | `8f4cf15`(0283 PASS)에서 같은 Claude·catalog 실패 15건 재현 | 변경 무관 |
| Windows CI | [run 40834862690](https://github.com/muzaby/orca-skin/actions/runs/40834862690), main `81153e2` success | PASS |
| trailer | 7커밋 `%(trailers:only=true)` 파싱 정상 | PASS |

## 7. 파생 이슈 이관

| # | 이슈 | 분류 |
|---|---|---|
| V1 | `PreparedMcpResources`의 `deps.prepare`가 production에서 쓰이지 않는다(B15a 동치) | NON_BLOCKING |
| V2 | 해제 실패를 삼키는 고장(X2)이 assertion이 아니라 worker OOM으로만 드러난다 — 시간 상한을 둔 직접 단언 권장 | NON_BLOCKING |
| V3 | 실제 CLI 만료 뒤 재기동 timeout(ΔI7)과 AC22/H1·AC33/H2 | 사람 실기 |

## Review Signals

- 첫 verify. 이전 고장 이력 없음.
- 반복 환경 한계: Linux에서 Windows 경로 fixture·win32 게이트 테스트가 red — 최종 판정은 Windows CI.
