# Verify — 0184-provider-auth-verification-fixes

## 메타

| 항목 | 값 |
|---|---|
| slug | `0184-provider-auth-verification-fixes` |
| 검증자 | Claude Code |
| 일자 | 2026-08-11 |
| 대상 커밋 | `397d48b` · `2350a42` · `cc57477` · `8d32745` (base = `96fa437`) |
| 라운드 | 1 |
| 상태 | **PASS** (인수 23/24 — AC23 은 사람 실기 대기) |
| 자기 검증 여부 | **예 — 그리고 최악의 형태다.** 설계·구현·검증이 같은 에이전트일 뿐 아니라 **설계가 구현 뒤에 쓰였다**(사후 작성). 인수 기준이 코드를 보고 만들어졌으므로 "기준을 만족한다" 는 사실의 정보량이 평소보다 작다. 그래서 §0·§역방향 탐색에 비중을 옮기고, **거기서 나온 것만을 실질 판정으로 취급**했다. |

> **이 verify 가 스스로 인정하는 구조적 한계.** 인수 기준을 코드에서 역산했으므로 매트릭스
> 24/24 는 "설계 의도를 만족했다" 가 아니라 "코드가 자기 테스트를 통과했다" 에 가깝다. 실질
> 결론은 아래 §0 과 §역방향 탐색에서 나온 **파생 이슈 6건**이다.

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·동시 호출·종료 중·권한 거부) | **⚠️ 지연 2건 · 동시 호출 1건 발견** | ① 게이트 로그인 invoke 가 `sweepPlugins` 를 **await** 한다 — 서비스 provider N개 × 최대 15초가 로그인 응답에 직렬로 붙는다(`auth/login.ts:145-168, 268-272`). 현행 배포는 `SERVICE_PROVIDERS=[]` 라 N=0 이어서 실기에서 안 보였다 → **D1** ② 부팅 `resume` 은 `await` 하지 않아 부팅을 붙들지 않는다(설계대로, `app/bootstrap.ts:358-362`) ③ **동시 호출**: `resume` 의 probe 가 도는 동안 같은 provider 로 수동 로그인이 성공하면, 뒤늦게 도착한 probe 실패가 `markExpired` 로 그 성공을 강등시킨다(`reprobe` 가 await 뒤 `isVerified` 를 재확인하지 않는다) → **D6** |
| **잘못된 성공(false success)** 이 가능한 경로 | **핵심 경로는 막혔다. 잔여 1건은 의도된 것** | 막힌 것: ⓐ 기록만으로 게이트 통과(`verified` 도입) ⓑ 형식 검사만으로 "연결됨"(값형 probe) ⓒ **2xx 인데 IdP 로그인 폼**(`finalUrl` origin 복귀 대조 — 0157 D1 이 잡았던 바로 그 형태를 규칙째 승계, `auth/login.ts:222-228`) ⓓ `doneUrlPrefix` 도달만으로 성공 선언. **잔여**: `probe` 미선언 provider 는 확인 없이 통과한다(`probeOk` 조기 반환 = fail-open). 게이트는 등록 검사가 필수화해 막았고(`auth/registry.ts:74-82`), `service`·`llm` 은 하위호환을 위해 열어 뒀다 — 선언 레시피에 ⚠️ 경고가 있다(`declarations/service.ts:24-25`). **의도된 비대칭이고 근거가 코드에 적혀 있다** |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | **⚠️ 1건 되돌릴 수 없다** | grant 파일·vault 쓰기는 `settleGrant` 가 실패 시 `revoke` 로 되돌린다. **그러나 값형 재인증은 새 값을 *같은 vault 키*에 먼저 쓰므로 되돌림이 이전 값도 함께 지운다** — `IPC_CONTRACT` 의 재인증 보장("실패하면 이전 자격증명으로 계속 쓸 수 있다")과 정면으로 어긋난다 → **D2**(사용자 결정 OQ1). 마이그레이션 없음(`verified` 는 메모리, `stateSent` 는 선택 필드) |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **한 곳에서 갈렸다 — 그리고 그것이 이 핸드오프의 교훈이다** | `2350a42` 는 "값형은 왕복하지 않는다(vault 에 값이 있는 것이 곧 근거)" 로 구현했고, 같은 날 `cc57477` 이 "값형도 서버만 안다" 로 **정반대로** 뒤집었다. 두 결론 다 코드와 테스트를 갖췄고 각각 합리적이었다 — 설계 문서가 없어 *어느 쪽이 의도인지 판정할 기준이 없었다*. 최종 코드 기준으로는 후자만 남아 있다(전자의 테스트 `값형 게이트는 왕복 없이 로컬 근거로 통과한다` 는 현재 저장소에 없다 — `rg` 0건 확인) |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **7건 중 6건 정상, 1건은 경계선** | #1~#6 은 구현 세부·엣지케이스라 선조치 범위. **#7(문서 SSOT 마감)은 이 verify 가 발견해 같은 턴에 닫았다** — 검증자가 자기 발견을 자기가 고쳤으므로 독립성이 없다(§자기 리뷰). #8(재인증 소실)은 올바르게 `⚠️ 보고만` 으로 남겼다 |

## 역방향 탐색 (매트릭스 전 선행)

```bash
$ bash .agents/skills/handoff-verify/scripts/scan-surface.sh 96fa437..HEAD   # 대상 23 파일
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export `browser-session.ts :: pickPrincipal` | **오탐(정상)** | 같은 파일 154·212 행에서 쓴다(스크립트가 동일 파일 참조를 세지 않는다) |
| 테스트에만 등장 `confluence/tools.ts :: createConfluenceToolServer` | **오탐(정상)** | 같은 파일 `confluenceTools`(80행)가 호출한다 |
| 테스트에만 등장 `oauth.ts :: AUTHORIZATION_TTL_MS` · `base64Url` · `browser-session.ts :: normalizeExpiry` · `pickPath` · `confluenceToolServerId` · `CONFLUENCE_TOOL_NAMES` | **오탐(정상)** | 전부 동일 파일 내부 소비. 0184 가 만든 표면이 아니다 |
| **`confluence/tools.ts :: confluenceTools` (스크립트 미검출)** | **정상이지만 검증 한계로 기록** | 프로덕션 참조가 **주석 2건뿐**이다(`declarations/service.ts:26,42`) — `SERVICE_PROVIDERS=[]` 이므로 배포가 채우기 전에는 호출자가 0이다(0181 OQ3, 의도). **그래서 AC17(도구 컨텍스트 바인딩)의 프로덕션 경로는 기본 빌드에서 실행되지 않는다** — 회귀 테스트가 유일한 방어선이고, 실제 `unknown_provider` 해소는 선언이 채워진 폐쇄망 빌드에서만 실증된다 |
| 타입 전용 export 20종(`LoginDeps`·`GateInput`·`ProviderProbe` 등) | 정상 | 정의 파일 시그니처용 · 계약 타입 |
| 형제 파일 정책 비대칭 (`redirect:`·`credentials:`) | **0건** | 0157 D1 이 나온 자리라 특히 확인 — `redirect:'manual'` 은 `infra/net/transport.ts` 한 곳뿐이고 그 위에서 호출자가 홉을 돈다 |
| 인수 기준 핵심 동사가 테스트에 등장하는가 | ✅ 24/24 중 기계 검증 23건 전부 등장 | 인용한 케이스 이름 **29건을 `rg` 로 전수 대조**해 모두 존재 확인(누락 0). 반대로 폐기된 케이스 1건(`값형 게이트는 왕복 없이…`)은 0건임을 확인 |
| **`PendingAuthorization.stateSent` 의 영속 왕복** | **결함(경미) — D4** | `store-file.ts:84-97` 의 `parsePending` 이 `providerId`·`state`·`verifier`·`createdAt`·`redirectUri` 만 싣는다 → **`stateSent` 가 저장에서 유실**된다. 이 파일이 존재하는 이유가 "앱이 재시작돼도 콜백을 대조할 수 있게" 이므로, 필드가 그 왕복을 못 넘는 것은 계약 위반이다. 현재 무해한 이유: 유일한 소비자 `absorbCallback` 이 **같은 실행의 메모리 레코드**를 받고(`oauth-runner.ts:93,143,157`), `undefined` 는 `true` 로 접히므로(fail-closed) 최악이 "state 요구" 다 |
| `ProviderProbe.method` 의 실사용 | **미검증 — D5** | `probeOk` 가 전달은 하나(`auth/login.ts:216`) 테스트 케이스는 전부 기본 GET 이다. `method:'HEAD'` 분기는 아무도 밟지 않는다 |
| `ProviderFailureReason` 에 추가된 `probe_failed` 의 renderer 소비 | 정상(설계대로) | renderer 는 reason 으로 분기하지 않고 `mine.message` 를 그대로 띄운다(`ProviderDetail.tsx:223` · `GateLogin.tsx:42`). 기존 5개 reason 도 동일 — 비대칭 없음 |
| `gate/index.ts:31-38` 주석의 사용자 결정 문장 | **결함(문서) — D3** | "여기에 별도 검증 경로를 만들지 마라(사용자 결정 2026-08-11)" 가 **다음 커밋에서 폐기됐는데도** 그대로 남아 있다. 다음 설계자가 이 문장을 유효한 제약으로 읽는다 |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §1 — "F2 의 결론이 F3 에서 하루 만에 뒤집혔다. 설계 문서가 없었기 때문" | **타당.** 검증자도 같은 것을 §0 4행에서 독립적으로 짚었다. 이것이 "선 수정 후 작성" 이 실제로 잃은 것의 구체적 증거다 | §검증 자기 리뷰 · 사용자에게 보고 |
| 이견 §2 — "`sweepPlugins` 를 로그인 invoke 안에서 await 하는 것은 응답 지연" | **타당.** N=0 이라 실기에서 안 보였을 뿐 | **D1** 로 이관 |
| 선조치 ✅ #1 (세션 리다이렉트 allowlist 확장) | **경계 내(구현 세부).** 다만 *자격증명이 실린 요청의 허용 origin 을 넓히는* 변경이라 보안 인접이다 — 값형에는 넓히지 않는 비대칭에 근거가 코드에 있고(`api.ts:138-150`), 넓히는 대상이 **그 세션이 이미 선언한 allowlist** 로 한정돼 새 권한이 생기지 않는다. 승인 | 매트릭스 AC13 배경 |
| 선조치 ✅ #2 (커밋 → 확인 → 되돌림, 통지 억제) | 경계 내. 되돌림의 부작용은 D2 로 분리 | AC9·11 · **D2** |
| 선조치 ✅ #3 (`sweepPlugins` 순서 규칙) | 경계 내. 순서를 뒤집으면 회복 불가 강등이 되므로 오히려 필수 | AC19·20 |
| 선조치 ✅ #4~#6 (id 형상 검사 · probe 타임아웃 · `stateSent` fail-closed) | 경계 내 | AC16 · §0 · AC21 |
| 선조치 ✅ #7 (문서 SSOT 마감) | **경계 내이나 독립성 없음** — 검증자가 발견하고 검증자가 고쳤다. 사실을 매트릭스와 자기 리뷰에 명시한다 | AC24(주석 포함) |
| 선조치 ⚠️ #8 (재인증 실패 시 이전 자격증명 소실) | **올바른 판단.** 계약 문장을 바꾸는 것도, 되돌림 방식을 바꾸는 것도 제품 결정이다 | **D2 · 사용자 결정 대기** |

## 요구사항 충족 매트릭스

> 증거의 `테스트` 칸은 **이 세션에서 `rg` 로 존재를 확인하고 `vitest` 로 green 을 확인한** 케이스다.
> 구현 보고의 자기 신고를 증거로 쓰지 않았다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 복원만 된 grant 로는 게이트가 안 열린다 | ✅ | `gate/index.ts:61-64`(`status==='valid' && verified`) + `auth/store.ts:65-69`(restore 가 `verified.clear()`) / 테스트 `gate.test.ts::"복원됐지만 이번 실행에서 미확인인 grant 는 게이트를 열지 않는다"` · `login.test.ts::"재시작하면 세션 grant 가 valid 여도 확인은 풀린다 (로그인 화면이 다시 뜬다)"` |
| 2 | 로그인 성공 직후 확인 성립 | ✅ | `auth/store.ts:93-97`(`put` 이 `verified.add`) · `:84-86`(`markVerified`) / `login.test.ts::"로그인 성공 직후에는 확인이 성립한다"` |
| 3 | 해제·401 강등이 확인을 함께 푼다 | ✅ | `auth/store.ts:101-110, 127-136`(`revoke`·`markExpired` — **조기 반환보다 앞에서** 푼다) / `login.test.ts::"해제·401 강등은 확인을 함께 푼다"` |
| 4 | 멤버 하나만 미확인이어도 차단 | ✅ | `gate/index.ts:61-64`(`every`) / `gate.test.ts::"멤버 하나만 미확인이어도 차단된다"` |
| 5 | 부팅 시 살아 있는 쿠키면 창 없이 통과 | ✅ | `auth/login.ts:132-140` + `app/bootstrap.ts:358-362` / `login.test.ts::"probe 가 2xx 면 창 없이 자동 로그인으로 통과한다"` |
| 6 | 부팅 확인 실패 시 강등 + 로그인 화면 잔류 | ✅ | `auth/login.ts:180-184`(`reprobe` — 실패는 `markExpired`, grant 는 유지) / `login.test.ts::"probe 가 실패하면 강등하고 로그인 화면에 남는다"` |
| 7 | grant 없으면 probe 미발사 | ✅ | `auth/login.ts:171-177`(`restorable`) / `login.test.ts::"grant 가 없으면 probe 를 치지 않는다 — 처음부터 수동 로그인이다"` |
| 8 | 값형도 부팅 때 probe 확인 | ✅ | `auth/login.ts:119-131`(방식 분기 제거) / `login.test.ts::"값형도 부팅 때 probe 로 확인한다 — 서버가 거부하면 강등된다"` |
| 9 | 로그인 직후 probe 통과해야 `done` | ✅ | `auth/login.ts:255-275`(`settleGrant`) / `login.test.ts::"probe 가 통과해야 연결됨이 된다"` |
| 10 | 거부 시 같은 폼으로 복귀(사유 포함) | ✅ | `auth/login.ts:308-318` / `login.test.ts::"서버가 거부하면 연결되지 않고 같은 폼으로 돌아온다"` |
| 11 | 확인 전 renderer 무통지 | ✅ | `auth/login.ts:262`(`commit(..., false)`) + `:437-441` / `login.test.ts::"probe 가 끝나기 전에는 renderer 로 아무것도 쏘지 않는다"` |
| 12 | `probe` 미선언이면 왕복 없이 저장(미지정 케이스) | ✅ | `auth/login.ts:213-214`(조기 반환) / `login.test.ts::"probe 미선언이면 왕복 없이 현행대로 저장한다"` · `::"실행 통로가 없으면 확인을 건너뛴다 — 선언만으로 잠기지 않는다"` |
| 13 | 2xx 라도 IdP 잔류면 미인증 | ✅ | `auth/login.ts:222-228` + `auth/api.ts:101`(`finalUrl`) / `login.test.ts::"2xx 라도 체인이 IdP 에 머물면 미인증이다"` |
| 14 | 브라우저 세션도 같은 probe 로 확인 | ✅ | `auth/specs/browser-session.ts:79-82`(판정 제거 주석) + `auth/login.ts:351-355`(`absorb` 3분기 전부 `settleGrant` 경유) / `login.test.ts::"브라우저 세션 로그인도 probe 로 확인한다"` · `browser-session.test.ts::"창이 완료되면 session grant 를 만든다"` |
| 15 | `probe` 없는 게이트 선언은 등록 거부 | ✅ | `auth/registry.ts:74-82` / `registry.test.ts::"probe 없는 게이트는 거부하고 나머지는 등록한다"` |
| 16 | 케밥 소문자 아닌 id 거부 | ✅ | `auth/registry.ts:20-24, 58-64` / `registry.test.ts::"케밥 소문자가 아닌 id 는 거부한다"` |
| 17 | 도구 호출이 선언의 id 로 나간다 | ✅ (**프로덕션 경로는 배포 의존 — 위 역방향 탐색 참조**) | `service/index.ts:68-73`(`ctx` 합성) + `contracts/provider.ts:176-186` / `service/index.test.ts::"도구 호출이 선언의 id 로 나간다 (unknown_provider 회귀)"` · `::"컨텍스트를 선언으로부터 만든다 — id 를 다시 적을 자리가 없다"` |
| 18 | `list` 가 도구 완전 이름을 싣는다 | ✅ | `platform.ts:121-131`(`toolNames` = `mcp__<serverId>__<tool>`) + `service/index.ts:51-60` / `service/index.test.ts::"도구를 선언하지 않은 provider 는 조회에서 null 이다"`. **합성 규칙(`mcp__` 접두)의 단위 테스트는 없다** — `adapters/runtime-tool-policy.ts` 와의 일치는 코드 대조로만 확인(⚠️ 대리 검증) |
| 19 | 게이트 통과 후에만 플러그인 훑기 | ✅ | `auth/login.ts:145-168` / `login.test.ts::"게이트가 통과해야 플러그인을 훑는다 — 순서가 규칙이다"` · `::"게이트 통과 후 플러그인 상태를 갱신한다"` |
| 20 | 게이트 0개면 부팅 직후 훑기 | ✅ | 같은 함수(`every` 빈 배열) / `login.test.ts::"게이트 선언이 없으면 부팅 직후 바로 훑는다"` |
| 21 | state 전송 여부로 콜백 대조를 가른다 | ✅ | `oauth-runner.ts:61-76, 175-192` + `oauth.ts:28-34` / `oauth.test.ts::"state 를 보냈는데 안 돌아온 콜백은 거부한다"` · `::"state 없는 콜백으로 교환까지 간다"` · `::"loopback 분기에서도 같다"` |
| 22 | 보낸 적 없는 state 는 기록만 | ✅ | `oauth-runner.ts:186-190` / `oauth.test.ts::"보낸 적 없는 state 가 실려 오면 통과시키되 기록한다"` |
| 23 | 게이트 화면이 `resuming` 을 표시한다 | ⏳ **사람 실기 대기** | 코드 경로는 확인(`GateLogin.tsx:44-46,105-111` — 문구 + `busy={busy \|\| resuming}`), i18n 키 `gate.resuming` 이 **ko/en 양쪽에** 있다(`resources/ko.ts:89`·`en.ts:91`). **화면 실측은 electron 실행 불가로 미완** |
| 24 | 문서 SSOT 가 코드와 일치 | ✅ (**검증자가 발견하고 검증자가 닫았다 — 독립성 없음**) | 발견 시점에 **미충족 4건**: `IPC_CONTRACT.md` 의 ⓐ 게이트 통과 규칙이 `verified` 누락 ⓑ step 목록에 `resuming` 누락 ⓒ 재인증 보장이 현행 동작과 모순 · `arch/backend/providers.md` 의 ⓓ 모듈 인벤토리 **13건** 수치 드리프트 + `browser-session-policy` 설명 오기. 이 핸드오프 커밋에서 전부 반영. 재측정: `wc -l` 실측 대조 · `rg "verified\|resuming" docs/IPC_CONTRACT.md` 각 1건 이상 |

**충족 집계: 23/24** (기계 검증 23건 전부 ✅, AC23 은 사람 실기). `Criteria-Met` 산정에서 AC23 은 제외했다.

## 숫자 재측정 (SKILL.md §3)

| 인용 수치 | 문서 | 실측 | 판정 |
|---|---|---|---|
| IPC 채널 총계 | `IPC_CONTRACT.md §2` "총 76 채널" · `docs/AGENTS.md` "76 채널 · 22 도메인" | `rg -o "'orca:[a-zA-Z:]+'" src/shared/ipc.ts \| sort -u \| wc -l` = **76**, 도메인 접두 **22** | ✅ 일치(이번 변경은 채널을 더하지 않고 페이로드 타입 3곳만 바꿨다) |
| provider 스코프 테스트 | — | `vitest run src/main/features/providers` = **21 파일 / 314 케이스** | 신규 측정 |
| 전체 테스트 | 0183 verify 인용 "201 파일 1838" | 현재 **192 파일 / 1708 케이스** + scripts 28 | ⚠️ **승계 금지 확인** — 0183 의 수치는 그 시점 브랜치 값이고 현재와 다르다. 본 문서는 실측값만 쓴다 |
| `providers.md` 모듈 인벤토리 | 21개 파일 줄 수 | `wc -l` 실측 대조 → **13건 불일치**(예: `login.ts` 292→464, `browser-session-policy.ts` 137→36) | ❌→✅ 이번 커밋에서 교정. 그중 2건(`GateFrame.tsx` 142→87 · `providerRows.ts` 70→51)은 **이번 4커밋과 무관한 선행 드리프트**였다 |

## 검증 책임 분리 (사람 vs 에이전트) — **정본 표**

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | lint 0 error / 1 warning(베이스라인) · typecheck 3/3 · vitest 192파일 1708건 · scripts 28건 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인` + 케이스명 29건 전수 grep) | 이견 시 중재 | 23/24 |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | lint 통과(boundaries 규칙 포함) |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | IPC_CONTRACT·providers.md·가이드 갱신 확인 |
| AGENTS.md 위생(키/토큰/이메일/IP) 스캔 | ✅ grep 보고 | ✅ 맥락 최종 판단 | 아래 §위생 검토 |
| PHASES.md 형식 | ✅ | — | "현재 작업 중" 에 0184 블록 추가 |
| **제품 의도 부합** — 재인증 실패가 이전 자격증명을 지워도 되는가 | ✖ 옵션 제시 | ✅ 결정 | **D2 / OQ1 — 사람 결정 대기** |
| UI/UX 시각 검증 — `resuming` 문구·도구 목록·id 행 | ✖ | ✅ | **AC23 사람 확인 대기** |
| 실기 확인 — 재시작 시 자동 로그인 통과/실패, PAT 오입력 시 폼 복귀, 폐쇄망 도구 호출 | ✖ (electron 실행 불가) | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | **해당 없음(0건)** |
| 문서↔코드 모순(설계변경 vs 버그) | ✖ 옵션 제시 | ✅ 결정 | D2 는 사람에게, D3 은 명백한 stale 이라 에이전트 처리 대상 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm ci && npm run lint && npm run typecheck && npm test

lint       ✅ 0 error, 1 warning
           └ src/renderer/src/features/chat/hooks/useTranscriptVirtualizer.ts:22
             react-hooks/incompatible-library (TanStack Virtual) = 0102 베이스라인, 변경 무관
typecheck  ✅ typecheck:node / typecheck:web / typecheck:test 3/3
test       ✅ vitest  Test Files 192 passed (192) · Tests 1708 passed (1708)
           ✅ scripts  # tests 28 · # pass 28 · # fail 0
```

> **환경 기인 실패 분리**: 이번 실행은 **실패 0건**이라 분리할 대상이 없다. 단 최초 시도에서
> `node_modules` 부재로 lint/typecheck 가 exit 2 였다 — "환경 제약" 으로 접지 않고 `npm ci`
> 를 돌려 해소했다(SKILL.md §5 · 0150 의 `node_modules` 오판 재발 방지). better-sqlite3 ABI
> 베이스라인 실패도 나타나지 않았다.

## 위생 검토 (AGENTS.md 변경 시)

- 변경된 `AGENTS.md`: `app/src/main/AGENTS.md` (2행 — `cc57477`). 내용은 provider 판정 지점
  서술 갱신으로 **구조·규칙 서술** 범위 안이다.
- 키/토큰/이메일/IP 패턴 스캔: **0건**. 문서에 등장하는 호스트는 전부 `example.corp` 계열
  플레이스홀더(`declarations/sso.ts`·`service.ts` 주석 예제).
- 변동성/일회성 정보 혼입: 없음. 줄 수 인벤토리는 `arch/backend/providers.md`(변동성 허용
  문서)에 있고, 이번에 **"실측 기준일 + 갱신 규칙" 주석**을 붙여 다음 승계를 막았다.

## PHASES.md 정합성

- "현재 작업 중" 에 `0184` 블록 추가(0180~0183 과 같은 형식). 대상 커밋 4건 + 잔여 사람
  확인 항목 명시.
- 페이즈 표 승격은 하지 않는다 — 0180~0183 이 아직 `impl/IMPL_DONE` 이라 provider 재작성
  묶음 전체가 미승격 상태다. 0184 만 먼저 표로 올리면 이력이 어긋난다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계 — 이번 핸드오프의 근본 실패는 "설계가 없었다" 다.** 그 대가가 구체적으로 관측됐다:
  ① `2350a42` → `cc57477` 사이에서 **값형 확인 정책이 하루 만에 정반대로 뒤집혔다**. plan 의
  §자료조사 한 줄("만료를 로컬에서 아는 것은 `token` 뿐")이 있었다면 앞 단계에서 걸렸다.
  ② **사용자 결정이 커밋 메시지 안에서만 폐기됐다**(D3) — 결정을 담을 문서가 없으니 폐기도
  기록될 자리가 없었다. **다음 plan 을 위한 규칙: 커밋 본문에 "사용자 결정" 을 인용하려면 그
  결정이 사는 문서(plan §요구 비판적 검토)를 먼저 만든다. 커밋 메시지는 결정의 저장소가 아니다.**
- **구현 단계** — 선조치 경계는 대체로 지켰다(✅ 6 / ⚠️ 1 이 올바른 배분). 다만 **문서 SSOT
  동기화를 구현 턴이 아니라 검증 턴이 했다**. 저장소 규칙(`docs/AGENTS.md` 원칙 5: IPC 변경 시
  `IPC_CONTRACT.md` 동시 갱신)이 있는데도 4커밋 모두 빠뜨렸다 — **0182 가 "문서가 인수
  기준이다(AC10~14)" 로 세운 관행이 한 핸드오프 만에 새어 나갔다.**
- **검증 단계 — 이번 verify 가 못 본 것**:
  - **AC 를 코드에서 역산했다.** 매트릭스 23/24 는 독립 검증이 아니다. 실질 판정은 §0·역방향
    탐색의 **D1~D6** 이고, 그중 D1·D2·D6 은 인수 기준 어디에도 걸리지 않았다.
  - **AC24 를 검증자가 발견하고 검증자가 고쳤다.** 같은 턴 안의 자기 교정이라 "다음 라운드가
    확인한다" 는 안전망이 없다.
  - **런타임 실기 0건.** electron 실행 불가라 자동 로그인 통과/실패, `resuming` 표시, 폐쇄망
    도구 호출은 전부 정적 근거(코드 경로 + 단위 테스트)로 대리했다. **특히 AC17 은 기본
    빌드에 호출자가 없어**(선언 비어 있음) 회귀 테스트가 유일한 증거다.
  - **D6(동시 호출 강등)은 레이스라 기계 검증 불가.** UI 가 그 창을 막는다는 것까지만 확인했고
    (`GateLogin.tsx:111`), 도메인 계층에는 방어가 없다는 사실을 근거로 남긴다.

## [FAIL 시] 미충족 요구사항

해당 없음(PASS). **다만 파생 이슈 6건은 열려 있고, 그중 D2 는 사용자 결정을 기다린다.**

| # | 이슈 | 심각도 | 대응 방향 |
|---|---|---|---|
| D1 | 게이트 로그인 invoke 가 `sweepPlugins` 를 await → 서비스 provider N개 × 최대 15초 지연 | 중(현행 N=0) | 게이트 확정 후 비동기로 훑고 `onChange` 로 따라잡게 한다 |
| D2 | 재인증 probe 실패가 **이전 자격증명까지** 지운다 (`IPC_CONTRACT` 재인증 보장과 모순) | **높음 — 사용자 결정(OQ1)** | ⓐ 계약 문장 정정(임시 반영함) ⓑ 임시 vault 키로 확인 후 덮기 |
| D3 | `gate/index.ts:31-38` 이 **폐기된 사용자 결정**을 유효한 제약처럼 못 박고 있다 | 중(설계 오염) | 주석을 F2/F3 결과로 교체 |
| D4 | `parsePending` 이 `stateSent` 를 영속 왕복에서 떨어뜨린다 | 낮(현재 fail-closed) | 필드 추가 + 왕복 테스트 |
| D5 | `ProviderProbe.method` 분기 미검증 | 낮 | `method:'HEAD'` 케이스 1건 |
| D6 | 부팅 probe 와 수동 로그인이 겹치면 뒤늦은 실패가 성공을 강등시킬 수 있다 | 낮(UI 가 창을 좁힘) | `reprobe` 가 await 후 `isVerified` 재확인 |

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 23/24(AC23 사람 실기), 게이트 전량 green, 신규 의존성 0,
  IPC 채널 수 불변(76), 레이어 경계 위반 0.
- **다음 주체: 사람.** ① **OQ1 결정**(D2 — 재인증 실패 시 이전 자격증명) ② UI 시각 검증
  (`resuming` 문구 · provider id/도구 목록 행) ③ 실기 검증(재시작 자동 로그인 통과/실패 ·
  PAT 오입력 시 폼 복귀 · 폐쇄망 도구 호출이 `unknown_provider` 없이 도는가).
- D1·D3~D6 은 후속 핸드오프 대상(코드 변경을 동반하므로 이 문서에서 처리하지 않는다).
