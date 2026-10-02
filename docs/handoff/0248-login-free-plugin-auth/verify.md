# Verify — 0248-login-free-plugin-auth

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0248-login-free-plugin-auth` |
| 검증자 | Claude Code |
| 일자 | 2026-10-02 |
| 대상 커밋/range | `f229c266..b512d5e4` |
| 구현 전 plan 기준 | `f229c266` (V1 READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `f229c266:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-18 의 AC20 라이트·다크 사람 실기 대기 |
| 자기 검증 여부 | 아니오 — 설계·검증 Claude, 구현 Codex. 그래도 보고에 없던 독립 축 X1~X6 을 더했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` READY→IMPL_DONE 1행과 `[구현자 기입]` 절만. `git diff f229c266 b512d5e4 -- plan.md`의 L1~L555 범위 `-` 행은 상태 1행뿐이다.
- 기준선이 diff로 성립하는가: 예 — 설계 `f229c266`와 구현 `b512d5e4`가 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair/§10/oracle 변경: 없음.
- 채점에 사용할 원 기준: `f229c266`의 D-001~D-017 · AC1~AC20 · VP-01~VP-18 · EP-01~EP-16 · M1~M13.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 신규 체계, 상속할 V 없음(§7-A) |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R 8·SD 1·AR 5·MD 3 → VP-01~18 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | INHERITED 없음. 기존 자격증명 경로는 R-07/VP-07(NEW)로 닫음 |
| pair별 path·§10 전수·직접 oracle | 유효 | 18행 모두 path·자리 수·oracle 기재 |
| 선택적 적대 증거·선택 이유 | 유효 | 구조·0건·N회·SSOT pair만 M1~M13 선택, VP-07·08·12·18은 직접 oracle 사유 |
| `SUPERSEDED` 이관 | 해당 없음 | D-007a·D-009a는 Decision만, pair 분해 없음 |
| 운영 gate·범위 | 유효 | lint·typecheck·비-DB vitest·boundary·inventory·trailer·CI |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-002·D-003 같은 경로 | 로그인 프리도 `createPluginBinding.sync` 하나 | `bindLoginFreePlugin`(`runtime.ts:242`) → `createLoginFreePluginAuth` → `plugins.ts:57` sync(분기 0) |
| D-004·D-016 격리 | 자격증명 binder·secretReader·게이트가 로그인 프리 id 미해석 | `tryBind`·`bind`·`secretReader`는 `registry.get`(자격증명 목록)만 조회. `getLoginFree`는 `bindLoginFreePlugin`·`bindForPlugin` 오류 메시지·`describe`에서만 |
| D-005·D-007 요청 | 플러그인 헤더 통과, 앱 주입 0, origin 고정 | `login-free.ts:46-60` 헤더 복사 → `checkLoginFreeRequest` → `followRedirects` → `createSender`(`credentials:'omit'`) |
| D-008 상태 전이 0 | snapshot 상수, 401/403 그대로 반환 | `login-free.ts`에 store·publish 의존 없음 |
| D-009 exe | `features/plugins/**` `child_process` 허용, runner import 금지 유지 | `eslint.config.mjs` 두 블록 분리 |
| D-010 카탈로그 | '기본 제공 · 인증 불필요', 액션 0, 주소 행 조건부 | `connectionInfo` `authScheme`·`origin ?? ''` → `providerRowMeta`·`providerAuthActionKind`·`ProviderDetail`·`CustomizeList` |
| D-011 계약만 | 기본 배포 `[]` | `LOGIN_FREE_DEFINITIONS = []`, `createPluginBindings` `[]` |
| D-013·D-014 | 공유 id 공간, origin 선택 | `registry.ts` 같은 `seen` + `origin !== undefined &&` |

```text
LOGIN_FREE_DEFINITIONS → bootstrap createAuthRuntime({loginFreeDefinitions})
  → AuthRegistry 두 목록 → bindLoginFreePlugin → createPluginBinding.sync → RuntimeToolRegistry
  → describe(scheme) → connectionInfo → ProviderInfo.authScheme → renderer 목록·상세·@
  → tool handler → request() → 정책·redirect 체인 → netFetch sender → 응답(상태 전이 0)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ✅ | origin 미선언 `AuthPolicyError('origin_not_declared')`, 비-HTTP `Error`, 정책 거부는 그 호출의 예외(전송 0) |
| false success 가능성 | ✅ 없음 | 401/403은 `ok:false`로 반환되고 가이드 handler는 `isError:!ok`(AC7 테스트) |
| partial failure/rollback | 해당 없음 | 로그인 프리는 영속 상태가 없다 |
| A 대신 B 구현 | ✅ 아님 | 별도 binder·상수 포트·같은 sync — D-003 그대로. union/`'none'` 안 미채택 |
| 증상만 제거 | ✅ 아님 | redirect 루프 추출 후 자격증명 홉 grant 재확인 유지(X5 red 4건) |
| URL 조립의 우회 | ✅ | `new URL(path, origin/)`가 외부 host로 해석돼도 `checkLoginFreeRequest`가 경로 판정 후 origin을 다시 본다(X3로 첫 판정을 끄면 absolute_path 2건 red) |
| 요청 worst-case | ✅ | 1 + 5홉(`MAX_REDIRECTS`), 응답 상한은 `maxBytes`(미지정=무제한, 기존 의미와 동일) |

## 3. 역방향 탐색

`scan-surface.sh`는 이 환경에 `rg`가 없어 실행 불가(`rg(ripgrep) 가 필요합니다`). 같은 질문을 `grep -rlF`로 대체했다.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `AuthRegistry.loginFree()` | 테스트 전용 | 비-테스트 참조 0(`registry.ts` 정의뿐), 소비는 `registry.test.ts:112`. plan §11이 지정한 메서드라 결함 아님 → D2 NON_BLOCKING |
| `MAX_REDIRECTS` export | 정상 | 정의 파일 내부에서만 사용. export 자체는 무해 |
| `bindLoginFreePlugin` production 호출 0 | 의도 | D-011 계약만 — 가상 배포 테스트가 경로를 덮는다(AC1·AC17) |
| 형제 정책 비대칭 | 의도 | 예약 헤더 검사는 자격증명 경로만(D-007). origin·redirect·홉 상한은 두 경로가 `request-chain.ts` 공유 |
| 신규 등록값의 기존 소비처 | 무영향 | `tryBind` 소비 5곳(`auth-resume.ts` 4 + `bootstrap.ts` 게이트 1)은 자격증명 목록 입력. 부팅 복원 입력은 `AUTH_DEFINITIONS`(`bootstrap.ts`) |
| producer ↔ consumer | 일치 | renderer는 `authScheme`만 본다(`providerRows.ts`·`providerAuthActionModel.ts`). `origin===''`은 주소 행 표시에만 사용 |
| 동일 규칙 중복 | SSOT 유지 | redirect 루프 1벌 — M13이 로그인 프리·자격증명·정책 3케이스를 함께 red |
| `features/plugins/**` lint 예외 범위 | 의도 | 기존 confluence·jira·mail 슬라이스도 같은 예외에 들어간다 — D-009가 디렉토리 단위로 정함 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 기존 케이스: 재실행 범위(B-main 19파일/342, B-rend 88)에 포함되어 green.
- structural proxy만으로 통과한 AC: 없음 — AC16 소스 스캔은 AC17 가이드 예제 실행과 짝, AC18 lint는 `lintText` 경로별 메시지.
- **선택된 적대 증거 재측정**: 등록 변이 17종을 자리별로 펼친 22자리 중 검출 22 · 미검출 0 · 일반 hunk 자동 확장 0. 기준선(변이 없음) B-main 342/342·B-rend 88/88 green.
- **자리 미지정 등록 변이**: M6·M7 → 순수 판정·목록·상세·액션 컴포넌트·상세→액션 props 자리마다 심음(아래 표).
- **이전 라운드 대조**: 최초 검증 — 해당 없음.
- **자기검증 분모**: 구현자 ≠ 검증자. 그래도 독립 축 X1~X6을 더했다.
- 실행: `node mut0248.mjs`(임시 스크립트, 저장소 밖) — 문자열 1회 치환 → 테스트 → 원복. 종료 후 `git status` clean.

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 sync에 `withCredential` 없는 포트 조기 return | MAIN | red 6 (AC1·2·3·7×2 + 기존 `valid 면 등록`) | VP-01 |
| M2 앱 `Authorization` 주입 | MAIN | red 3 (AC5×2·AC6 same-origin) | VP-02·11 |
| M2b 플러그인 헤더 값을 앱 값으로 교체(형제 맞바꿈) | MAIN | red 2 (AC5 통과·AC6 same-origin 헤더) | VP-02·11 |
| M3 로그인 프리만 홉 허용 origin 확장 | MAIN | red 1 (AC6 origin 밖 redirect) | VP-02·11 |
| M4 runtime 포트 래핑: 401/403 → expired + snapshot change | MAIN | red 4 (auth AC7×2 · deployment AC7×2) | VP-02·09·11 |
| M5a `tryBind`가 로그인 프리 id 해석 | MAIN | red 3 (AC4 binder·stale grant·gate unregistered) | VP-05·10 |
| M5b `bindForPlugin`이 로그인 프리 포트 반환 | MAIN | red 1 (AC9) | VP-05·10 |
| M5c requester registry가 로그인 프리 id 해석 | MAIN | red 2 (AC4 binder·stale grant) | VP-05·10 |
| M6-pure `providerRowMeta` 종류↔상태 키 맞바꿈 | REND | red 7 | VP-04·16 |
| M6-list 목록 detail에 statusKey | REND | red 1 (AC11 목록) | VP-04 |
| M6-detail 상세 종류 자리에 statusKey | REND | red 2 (AC12 origin 유/무) | VP-04 |
| M7-model 로그인 프리 → `'authenticate'` | REND | red 10 | VP-04·16 |
| M7-comp `ProviderAuthActions`의 `'none'` 분기 삭제 | REND | red 6 | VP-04 |
| M7-props 상세→액션 props를 `login-required`로 | REND | red 3 (AC12×2 + 기존 wiring) | VP-04 |
| M8 bootstrap `loginFreeDefinitions` 인자 삭제 | AC16 | red 1 | VP-06·13 |
| M8b 인자를 `[]`로 교체 | AC16 | red 1 | VP-06·13 |
| M9 plugins `child_process` 예외 삭제 | boundary | `# fail 1` | VP-03·14 |
| M10 예외를 `features/**`로 확장 | boundary | `# fail 4` | VP-03·14 |
| M11 runner import 블록에도 plugins 예외 | boundary | `# fail 2` | VP-03·14 |
| M12 로그인 프리 루프 전 `seen.clear()` | auth | red 1 (AC8) | VP-06·15 |
| M13 공유 루프 `checkRedirect` 무력화 | auth | red 3 (로그인 프리 AC6 · 자격증명 AC14 신규 · `policy.test` 기존) | VP-17 |
| X1 `LoginFreeDefinition.methods?: never`만 삭제 | typecheck | **green** (exit 0) | EP-08 자리 하나 미잠금 → D1 |
| X1b `methods?`·`probe?: never` 둘 다 삭제 | typecheck | TS error 1 | VP-05 |
| X2 wire `authScheme`를 `login-required` 고정 | MAIN | red 2 (AC10 origin 유/무) | VP-12 |
| X3 로그인 프리 첫 요청 판정 무력화 | MAIN | red 2 (AC6 absolute_path×2) | VP-02 EP-05 첫 자리 |
| X4 상세 주소 행 무조건 표시 | REND | red 1 (AC12 origin='') | VP-04 |
| X5 requester `beforeNextHop` 미배선(키 이름 변경) | auth | red 4 (기존 홉 사이 grant 케이스) | VP-07 — 추출이 동작을 보존함 |
| X6 `canManageAuth`에서 `authScheme` 조건 삭제 | REND | red 3 | VP-16 |

- 동작 보존 추출 라운드인가: 부분 — redirect 루프 추출(EP-06)은 동작 보존이라 hunk 되돌림은 근거로 쓰지 않았고, 대신 X5(새 배선 끊기)·M13(공유 판정 끄기)으로 쟀다.
- 형제 슬롯 맞바꿈: M2b(플러그인↔앱 헤더)·M6(종류↔상태)·M7-props(체계) 모두 red.
- `N회` 기준의 관측 주체(AC2): registry `add`/`remove` spy의 서버 id별 호출 수 + `subscribe` 수신 change — `expectAlwaysAvailable`.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|
| VP-15 | MD-01 ↔ UT-01 | PASS | `registry.test.ts` AC8 2케이스, M12 red | EP-09 2/2 |
| VP-17 | MD-02 ↔ UT-02 | PASS | AC6·AC14 신규, M13 두 경로 red | EP-05 앞 2 + EP-06 2 = 4/4 |
| VP-16 | MD-03 ↔ UT-03 | PASS | `providerRows.test`·`ProviderAuthActions.test`, M6·M7·X6 red | EP-11 순수 3/3 |
| VP-10 | AR-01 ↔ IT-01 | PASS | `login-free.test.ts` lifecycle 5케이스, M5a~c red | EP-07·09 |
| VP-11 | AR-02 ↔ IT-02 | PASS | 런타임 경유 request 11케이스, M2·M2b·M3·M4·X3 red | EP-04 3/3 · EP-05 3/3 · EP-06 2/2 |
| VP-12 | AR-03 ↔ IT-03 | PASS | AC10 `connectionState` 전 필드 `toEqual` 2행, X2 red | EP-10 2/2 |
| VP-13 | AR-04 ↔ IT-04 | PASS | AC15 production export 3종·AC16 스캔·AC17 factory, M8·M8b red | EP-12·13·14 4/4 |
| VP-14 | AR-05 ↔ IT-05 | PASS | boundary 12/12, M9~M11 red | EP-15 2/2 |
| VP-09 | SD-01 ↔ ST-01 | PASS | AC2 change cause 5건 수신 중 로그인 프리 add1/remove0, AC3 게이트 구간, M4 red | EP-01·03 |
| VP-01 | R-01 ↔ AT-01 | PASS | AC1~3, M1 red | EP-01·02 |
| VP-02 | R-02 ↔ AT-02 | PASS | AC5~7 (VP-11과 공유 증거) | EP-03·04·05 |
| VP-03 | R-03 ↔ AT-03 | PASS | AC18 (VP-14와 공유) | EP-15 |
| VP-04 | R-04 ↔ AT-04 | PASS | AC10~13 render·순수·mention, M6·M7·X4 red | EP-10·11 |
| VP-05 | R-05 ↔ AT-05 | PASS | AC4·AC9 런타임 + `@ts-expect-error` 4건(typecheck green), X1b red | EP-07·08 (X1 → D1) |
| VP-06 | R-06 ↔ AT-06 | PASS | AC8·15~17 | EP-09·12·13·14 |
| VP-07 | R-07 ↔ AT-07 | PASS | 기존 auth·plugins·renderer 케이스 green + AC14 신규, X5 red | EP-06 2/2 |
| VP-08 | R-08 ↔ AT-08 | PASS | 문서 6종 diff 대조 + inventory `generated/prose/links ok` | EP-16 8/8 |
| VP-18 | R-04 ↔ AT-09 | 사람 실기 대기 | 라벨·버튼·주소·tone은 AC11·12 render로 기계 검증 | 시각만 |

- root `PAIR_FAIL`: 없음. `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — REQUIRED 18 전건.

### AT / AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | 자격증명 둘 `none`인 채 첫 sync에 `public-api-tools` 존재, handler→`/health` 1회 전송 |
| AC2 | ✅ | commit·revoke·expired·commit·unauthorized 5 cause 수신, 로그인 프리 add 1·remove 0·snapshot change 0 |
| AC3 | ✅ | gate false→true→false 동안 로그인 프리 유지, `corp-sso-tools` false→true→false |
| AC4 | ✅ | `tryBind` null·`secretReader` null·`bind().request` `unknown_auth`·gate `unregistered`, 예전 영속 grant 입력에도 동일 |
| AC5 | ✅ | init `{method,body,headers:{},credentials:'omit',redirect:'manual',signal}` 등치, 플러그인 4헤더 등치 |
| AC6 | ✅ | absolute_path×2·origin 밖 next-hop 0·same-origin finalUrl·6회 상한·maxBytes text/binary·미선언/비-HTTP 전송 0 |
| AC7 | ✅ | 401/403 `ok:false`, snapshot·change·persistence·registry revision 불변, tool `isError:true` |
| AC8 | ✅ | 충돌·중복·invalid_id·invalid_origin `scheme:'login-free'` 거부, 거부된 자격증명 id는 예약 안 함 |
| AC9 | ✅ | 반대 binder·미등록 throw 3건, `'withCredential' in port` false, `PluginAuth` 대입 `@ts-expect-error` |
| AC10 | ✅ | origin 유/무 두 행 `toEqual`, 자격증명 행 `login-required` |
| AC11 | ✅ | 목록 detail `기본 제공`(`기본 제공 ·` 0), trailing `인증 불필요` |
| AC12 | ✅ | 액션 null·button 0·비활성 안내 0·도구 표시·`bg-good`·주소 행 origin 유무 |
| AC13 | ✅ | `pluginMention.test`·`useMentionAutocomplete.test` 로그인 프리 fixture 포함(B-rend green) |
| AC14 | ✅ | 기존 케이스 green + 신규 requester cross-origin next-hop 0·`redirect-blocked` 로그 |
| AC15 | ✅ | production `LOGIN_FREE_DEFINITIONS`·`createPluginBindings()`·`createConnectionSources()` 모두 `[]` |
| AC16 | ✅ | 스캔 + 음성 입력 7종, M8·M8b red |
| AC17 | ✅ | 가이드 §4 예제와 같은 `publicApiTools`·`recipePluginBindings(PluginDeploymentDeps)` 컴파일·실행 |
| AC18 | ✅ | boundary 12/12 |
| AC19 | ✅ | auth §1·§2·§3·§7·§9·§11, security §1.4-b 부근·§1.8·§1.10, 가이드 §0·§1.1·§4, IPC provider:list, GLOSSARY 4행, ADR-006 + README 목록. inventory green |
| AC20 | ⚠️ | 사람 실기 대기 |

- **합계 재측정**: `✅ 19 · ⚠️ 1 · ❌ 0 = 총 20`. 자기보고 19/20과 일치.
- **합계 사본 대조**: plan 본문 `✅ 19 · ⚠️ 1` ↔ trailer `Criteria-Met: 19/20` ↔ INDEX 비고 `AC ✅19/20` — 일치.

### pair별 plan §10 강제 지점 분모

| EP | plan 자리 | 코드 재확인 | 결과 |
|---|---|---|---|
| EP-01 snapshot 상수 | 1 | `login-free.ts` `snapshot()` — 호출마다 새 객체(변조 테스트 green) | 1/1 |
| EP-02 같은 sync | 1 | `plugins.ts` sync 분기 0 | 1/1 |
| EP-03 전이 0 | 2 | `LoginFreeDeps = {sender, logger?}` · `runtime.ts` publish 자리 4곳 모두 자격증명 store 경유 | 2/2 |
| EP-04 주입 0·통과 | 3 | 헤더 복사 · 정책에 헤더 검사 없음 · `credentials:'omit'` | 3/3 |
| EP-05 origin 고정 | 3 | 첫 요청 판정(X3) · 홉 판정(M3·M13) · 미선언/비-HTTP 거부 | 3/3 |
| EP-06 루프 SSOT | 2 | `followRedirects` 호출자 2(requester·login-free) | 2/2 |
| EP-07 binder 비해석 | 6 | `bind`/requester · `tryBind` · `bindForPlugin` · `secretReader` · `selectGateMembers` · 복원 입력 | 6/6 |
| EP-08 타입 비대입 | 3 | 3자리 존재. `methods?: never` 자리는 테스트가 단독으로 잠그지 않음(X1 green) | 3/3 구현 · D1 |
| EP-09 공유 id | 2 | 같은 `seen` · bootstrap 진단 `scheme` | 2/2 |
| EP-10 wire 생산 | 2 | `describe` scheme · `connectionInfo` | 2/2 |
| EP-11 wire 소비 | 6 | 순수 3 · 액션 컴포넌트 · 목록 detail · 상세 주소 | 6/6 |
| EP-12~14 | 1·2·1 | bootstrap 인자 · `[]` 2 · `Pick` 두 binder | 4/4 |
| EP-15 lint | 2 | 두 블록 | 2/2 |
| EP-16 문서 | 8 | 6문서 + plan·INDEX | 8/8 |

- 표 밖 필수 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| `npm run lint` | PASS | 0 error · 1 warning(`useTranscriptVirtualizer.ts:22`, 이번 diff 밖 기존) |
| `npm run typecheck` | PASS | node·web·test 3구성 exit 0, 진단 0 |
| 관련 비-DB vitest(plan gate 명령 + 구현자 추가 경로) | PASS (변경 범위) | 89파일/929케이스 중 896 pass · 28 skip · 5 fail. fail은 `mail.integration.test.ts`(파일 로드)·`settlement.integration.test.ts` 5케이스 — 둘 다 `new Database` 프레임 + `NODE_MODULE_VERSION 140 … requires 127` ABI 서명, 이번 커밋이 건드리지 않은 DB 스위트 |
| 변경 테스트 집중 재실행 | PASS | MAIN 19파일/342 · REND 88 케이스 green |
| `node --test scripts/git-boundary.test.mjs` | PASS | `# tests 12 # pass 12 # fail 0` |
| `check-doc-inventory --check` | PASS | generated(9 items, 100 channels)·prose·links ok |
| trailer | PASS | `b512d5e4` 6키 파싱(Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By) |
| CI | 미관측 | PR/CI는 이 턴 범위 밖 |

- 게이트가 트리를 바꿨는가: 아니오 — 실행 후 `git status` clean.
- 잔여물: 변이 스크립트는 저장소 밖 임시 파일.
- 구현자 보고 "929케이스 green"과 이번 5 fail의 차이: 실행 환경의 better-sqlite3 ABI 차이(위 서명). 변경 경로 판정에는 영향 없다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| 가이드 §4 로그인 프리 레시피 | 테스트의 `PUBLIC_API_PLUGIN`·`publicApiTools`·`recipePluginBindings`가 가이드 코드와 같은 식별자·형상, `PluginDeploymentDeps` 타입으로 typecheck | 가상 배포에서 등록·`/health` 요청·401 `isError` | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `followRedirects` 호출자 2 · `createLoginFreePluginAuth` 호출자 1(`runtime.ts`) · `bindLoginFreePlugin` 비-테스트 참조 = 계약·런타임·주석 예시뿐.
- AC5 0건 기준: 헤더 미지정 요청 init `headers: {}`(authorization·cookie 0), 지정 요청은 같은 4헤더 1회.
- 요청 상한: 첫 요청 + 5홉 = 6회(AC6 테스트 `toHaveBeenCalledTimes(6)`).

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AC20 | 라벨·버튼 0·도구 목록·주소 유무·`bg-good` 클래스(AC11·12 render) | 라이트·다크 테마 시각 | 로컬에서 `LOGIN_FREE_DEFINITIONS`·`createPluginBindings`에 가이드 §4 예제를 임시로 넣고(커밋 금지) `npm run dev` → 연결 탭 목록·상세, origin 생략 선언도 확인 |

## 9. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: `impl/IMPL_DONE`·다음 주체 Claude — 실제 상태와 일치. 대상 커밋 자리표시자 → `f229c266`(V1 설계)·`b512d5e4`(r1) 기입, 둘 다 `git cat-file -t` = commit.
- `[구현자 기입]` 7필드(설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생·놓친 잠재 문제·구현 보고·Review Signals) 전수 존재.
- 신규 ADR-006: `decisions/README.md` 목록 행 추가, `docs/INDEX.md` 라우팅 행 추가.

## 10. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `AuthPolicyError`를 `auth-policy-error.ts`로 분리하고 기존 경로 re-export | 타당 — 순환 회피, class identity 하나(두 경로 `name`·`reason` 단언 green) | 없음 |
| AC1 `none` 관측 강화·AC16 음성 입력 추가 | 타당 — 기준 강화, 완화 아님 | 없음 |

## 11. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `LoginFreeDefinition.methods?: never`만 지워도 typecheck green(X1). `probe?: never`가 `AuthDefinition` 타입 값은 막지만, `satisfies`·타입 주석 없이 `methods`를 가진 일반 객체 상수는 그 자리 없이 `LOGIN_FREE_DEFINITIONS`에 들어간다 | EP-08 · VP-05 — 코드는 계약대로 존재, 테스트 민감도만 부족 | NON_BLOCKING | 다음 auth 작업에서 `probe` 없는 `{…, methods: [...]}` 변수의 대입 `@ts-expect-error` 1건 추가 |
| D2 | `AuthRegistry.loginFree()`는 비-테스트 소비 0 | plan §11 지정 메서드 | NON_BLOCKING | 첫 실제 소비자가 생기거나 정리 작업에서 제거 판단 |
| D3 | `scan-surface.sh`가 `rg` 없으면 중단 | 검증 도구 환경 | NON_BLOCKING | 환경 한계 기록 |

## 12. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(최초).
- 관련 plan 지침/AC: AC4가 타입 상호 비대입을 요구했고 EP-08이 세 자리를 열거했으나 pair 적대 증거에는 타입 변이가 없었다(D1).
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: better-sqlite3 ABI 서명 DB 스위트 2파일, `rg` 부재로 surface 스크립트 미실행, Windows `execSync`가 `./node_modules/.bin/vitest`를 못 찾아 변이 1차 실행 무효(baseline 대조로 발견해 `node node_modules/vitest/vitest.mjs`로 재실행).

## 13. 결론

- 상태: **PASS (기계 범위)**.
- pair 결과: REQUIRED PASS 17 · 사람 실기 대기 1(VP-18) · PAIR_FAIL 0 · BLOCKED_BY 0.
- PLAN_GAP: 없음.
- Product/UX·ACTIVE Decision D-001~D-017: 충족.
- AC: ✅19 · ⚠️1 · ❌0.
- 운영 gate: lint·typecheck·변경 범위 vitest·boundary·inventory·trailer PASS. DB ABI 2파일은 환경 기준선.
- 등록 변이 22/22 red, 독립 X2~X6 red, X1 green → D1 NON_BLOCKING.
- 남은 사람 확인: AC20 라이트·다크 시각. archive 이동은 실기 뒤.
