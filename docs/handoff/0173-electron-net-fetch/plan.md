# Plan — 0173-electron-net-fetch

## 메타

| 항목 | 값 |
|---|---|
| slug | `0173-electron-net-fetch` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PR: 브랜치 `claude/multi-provider-login-chain-a97lf7` (0172 와 같은 브랜치 — 아래 §범위) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "혹시 node fetch 를 사용하는 코드가 있다면 모두 electron.net.fetch 로 변경해야 한다. 그렇게 하고 있는가?" | 라이브 세션 (2026-08-05) |
| 추론 의도 | "모두" = main 프로세스의 **원격 요청 전부**. renderer 는 이미 Chromium 스택이라 대상이 아니고, 자식 프로세스(claude CLI)의 자체 요청은 우리 코드가 아니다 (추론) | `vitest.config.ts`(node 환경) · renderer 는 `BrowserWindow` 안에서 실행 |

## Context (왜)

main 프로세스가 **Node(undici) 전역 `fetch`** 로 사내 서버에 요청하는 곳이 3곳 남아 있다. Node
스택과 Chromium 스택은 세 가지가 다르고, 셋 다 **폐쇄망 사내 배포에서 곧바로 장애**가 된다:

1. **시스템/사내 프록시를 무시한다** — Chromium 은 OS 프록시 설정·PAC 를 따르고 undici 는 안 따른다.
2. **OS 인증서 저장소를 안 본다** — 사내 사설 CA 로 서명된 Confluence 는 Node 자체 CA 번들에 없어
   인증서 검증에서 실패한다. *브라우저로는 열리는데 앱만 안 되는* 전형적 증상이 여기서 나온다.
3. **클라이언트 인증서·세션 설정이 안 붙는다.**

의도한 결과: main 의 원격 요청이 전부 Chromium 네트워크 스택을 타고, **다음 사람이 다시 전역
`fetch` 를 쓰면 테스트가 실패**한다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당** — 대상이 실재하고 3곳 전부 사내망 트래픽이다 | `authenticated-fetch.ts:105`(Confluence REST) · `broker.ts:718`(provider probe) · `external-usage-service.ts:39`(usage 보고서) |
| 이미 있는 것 아닌가 | **부분적으로 있다** — 저장소는 이 구분을 **이미 알고 있다**. `browser-session-store.ts:139` 는 `ses.fetch`, `index.ts:122` 는 `net.fetch` 를 쓴다. 인증·사용량 경로만 빠졌다 | 같은 파일들 |
| 더 작은 해법이 있는가 | **없다 — 다만 새 구조물도 필요 없다.** 세 지점 모두 **이미 주입 seam 이 있다**(`sender?`·`BrokerDeps`·`fetchImpl?`). 새 추상화를 만들지 않고 기본값만 바꾼다 | `broker.ts:105` · `external-usage-service.ts:39` |
| 인용 자료가 요구를 부풀리지 않았나 | **1차 출처 대조함** — `net.fetch(input, init)` 는 표준 `RequestInit` 을 받고 표준 `Response` 를 준다. 문서화된 제약은 `data:`/`blob:` 미지원 · `integrity` 무시 · **`.type`/`.url` 부정확** 3가지뿐이고, 우리 sender 는 `.url` 을 읽지 않는다 | `node_modules/electron/electron.d.ts:9960-9994`(실측) |
| 기존 채택 결정을 뒤집는가 | **아니오** — 오히려 미준수를 바로잡는다 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| main 의 전역 `fetch` 호출 **전수 3곳** (테스트 제외). axios·node-fetch·`http`/`https` 직접 사용 **0건**, renderer·preload 외부 fetch **0건** | `rg '\bfetch\(' src/main --glob '!*.test.ts'` (이번 세션 실측) |
| `net.fetch(input, init?: RequestInit & { bypassCustomProtocolHandlers?: boolean })` → `Promise<Response>`. 제약: `data:`/`blob:` 미지원 · `integrity` 무시 · `.type`/`.url` 부정확 | `node_modules/electron/electron.d.ts:9960-9994` |
| sender 는 `res.status`·`res.headers`·`res.text()`·`res.body.getReader()` 만 쓴다 — `.url` 미사용이라 위 제약에 걸리지 않는다 | `authenticated-fetch.ts:117-134, 151-182` |
| **`vitest.config.ts` 에 electron alias·mock 이 없다** → electron 을 무는 모듈을 테스트가 import 하면 즉시 죽는다. 지금도 `chat-turn.continuity.test.ts` 가 그 이유로 실패 중 | `app/vitest.config.ts` 전문 · P29 (`failure-patterns.md:541-552`) |
| `authenticated-fetch.test.ts` 는 `vi.stubGlobal('fetch', …)` + `createSender()` 로 9케이스를 돌린다 → 인자화하면 호출부만 고치면 된다 | `authenticated-fetch.test.ts:138-205` |
| broker·usage 테스트는 이미 fake 를 주입한다(`sender`·`fetchImpl`) → 영향 없음 | `broker.test.ts` 하네스 · `conformance.ts:84` |
| 이 앱은 `app://` 커스텀 프로토콜 핸들러를 등록한다 → 외부 요청이 자기 핸들러로 말려들지 않게 `bypassCustomProtocolHandlers` 를 켠다 | `index.ts:122` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `src/main/**`(테스트 제외)에 전역 `fetch(` 호출이 **`net-fetch.ts` 외 0건**이다 | `no-node-fetch.test.ts::"main 은 전역 fetch 를 쓰지 않는다"` | 위생 가드(CI·로컬 게이트) |
| 2 | `createSender` 는 **주입된 fetch 로만** 보낸다 — 스텁이 호출되고 전역 stub 은 호출되지 않는다 | `authenticated-fetch.test.ts::"주입된 fetch 로 보낸다"` | `bootstrap` → `AuthBroker.sender` → connector 요청 |
| 3 | `ctx.fetch` 가 주입 구현으로 나가면서 **미선언 origin 은 여전히 거부**한다 | `broker.test.ts::"ctx.fetch 는 주입 구현을 쓴다"` · `::"ctx.fetch 는 미선언 origin 을 거부한다"` | `handlers/auth` → `provider.begin/continue` → `static-credential` probe |
| 4 | `ExternalUsageService` 는 주입된 fetch 로 보고서를 받는다(주입 없으면 **타입 에러**로 막힌다) | `external-usage-service.test.ts` 기존 케이스 green + `npm run typecheck` | `scheduler` → `refreshAll` |
| 5 | `netFetch` 의 서명이 `typeof fetch` 와 호환된다(세 주입 지점이 같은 타입을 받는다) | `npm run typecheck` 3/3 | 전 경로 |
| 6 | 사내망에서 Confluence 검색·첨부 다운로드가 **프록시/사내 CA 환경에서 성공**한다 | **사람 실기** — Windows 사내망에서 `npm run dev` → 플러그인 탭 Confluence 연결 → `confluence_search` → `confluence_get_pages`(첨부 포함). 이 샌드박스는 Electron 바이너리가 없어 불가 | 실사용 경로 |

> AC5 는 런타임 동등성을 보장하지 않는다(타입만 본다). **런타임 판정은 AC6 사람 실기**다 —
> "테스트 green = 동작 확인" 으로 보고하지 않는다.

## 범위 / 비범위

- **범위**: main 의 원격 요청 3지점 + electron 경계 파일 + 위생 가드 + 문서.
- **비범위**:
  - **renderer/preload** — 이미 Chromium 스택이다.
  - **claude CLI 자식 프로세스의 자체 네트워크** — 우리 코드가 아니다.
  - **electron-updater** — 자체 스택을 쓰며 프록시 처리도 자체 소관(별건).
  - **프록시·인증서 설정 UI** — 이번은 스택 교체까지. OS 설정을 따르는 것이 목적이다.

| 미룬 항목 | 나중에 하면 더 비싼가 |
|---|---|
| electron-updater 프록시 | 아니오 — 독립 모듈이고 계약을 공유하지 않는다 |
| 프록시 수동 설정 UI | 아니오 — 스택을 옮겨야 OS 설정이 먹으므로 **이 작업이 선행**이다 |

## 의존 기술 / 전제

- `electron` `net` 모듈(이미 `index.ts` 가 사용 중). **신규 의존성 0.**
- 전제: `net.fetch` 는 `app.whenReady()` 이후에만 호출된다 — 세 지점 모두 요청 시점에 호출되고
  `Bootstrap.start()` 는 ready 이후다.

## 설계

### 1. electron 경계를 **파일로** 긋는다 (P29)

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `infra/auth/net-fetch.ts` | `import { net } from 'electron'` 를 갖는 **유일한** 파일. `netFetch: typeof fetch` 를 export | infra | **단위 테스트 없음(의도)** — electron 런타임 전용. 대신 *아무 테스트도 이 파일을 import 하지 않는 것* 이 불변식이고, 얇은 위임이라 로직이 없다 |
| `infra/auth/no-node-fetch.test.ts` | 위생 가드 — `src/main/**` 소스를 읽어 전역 `fetch(` 호출을 찾으면 실패 | infra(테스트) | 자기 자신이 테스트. `fs` 만 쓰고 electron 비의존 |

`bypassCustomProtocolHandlers: true` 를 켠다 — 이 앱은 `app://` 핸들러를 등록하므로 외부 API
요청이 자기 핸들러로 말려들 여지를 없앤다.

### 2. 세 지점을 주입으로 (기본값 제거 = fail-closed)

| 지점 | 변경 |
|---|---|
| `createSender()` | `createSender(fetchImpl: typeof fetch)` — **필수 인자**. 기본값을 남기면 주입을 빠뜨린 경로가 조용히 Node 스택으로 되돌아간다(지금 버그의 재발 경로 그 자체) |
| `BrokerDeps` | `fetchImpl: typeof fetch` **필수 필드** 추가 → `makeContext` 의 `ctx.fetch` 가 이것을 쓴다. **origin allowlist 검사는 감싸는 순서 그대로 유지** |
| `ExternalUsageService` | `fetchImpl?` 의 `?? fetch` 기본값 제거 → 필수 |
| `app/bootstrap.ts` | 세 곳에 `netFetch` 주입 (electron 경계 파일을 import 하는 유일한 곳) |

`BrokerDeps.fetchImpl` 을 필수로 두면 기존 테스트 하네스가 전부 컴파일 에러가 난다 — 그것이
의도다(주입 지점을 눈으로 확인하게 만든다). 테스트는 `async () => new Response(...)` 를 준다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| P29 — "electron 을 무는 모듈의 순수부는 **별도 파일**로 긋는다" | `failure-patterns.md:541-552` | §설계 1 "유일한 파일" | **준수** — 새 규칙이 아니라 기존 패턴의 적용 |
| infra 는 electron 을 의존해도 된다(`crypto.ts` safeStorage · `browser-session-store.ts` session) | `src/main/AGENTS.md` 레이어 표 | §설계 1 배치 | 유지 — `net-fetch.ts` 도 infra |
| "선언한 origin 밖으로는 못 나간다"(provider fetch 의 allowlist 강제) | `contracts/auth-plugin.ts:101` · `broker.ts` `makeContext` | §설계 2 "감싸는 순서 그대로 유지" | **유지** — 전송 구현만 바뀌고 검사는 그대로 |
| "인증은 명시 주입으로만 — 암묵적 쿠키 전송 금지"(`credentials:'omit'`) | `authenticated-fetch.ts:109-110` | §설계 2 | **유지** — `net.fetch` 는 기본 세션을 쓰므로 이 옵션이 **더** 중요해진다(기본 세션 쿠키가 실리면 안 된다) |
| 위생 규칙은 문서가 아니라 **기계로** 강제한다 | `scripts/check-migrations-appendonly.mjs` 선례 | §설계 1 위생 가드 | 승계 — 같은 방식으로 하나 더 |
| 신규 의존성은 사용자 승인 | `app/AGENTS.md` 의존성 정책 | §의존 기술 | 해당 없음(신규 0) |

## 파생 UX / 엣지케이스

- **`net.fetch` 는 `app.ready` 이후에만 동작한다.** 세 지점 모두 요청 시점 호출이라 안전하지만,
  누군가 모듈 로드 시점에 부르면 깨진다 — `net-fetch.ts` 주석에 못 박는다.
- **기본 세션 공유**: `net.fetch` 는 `session.defaultSession` 을 쓴다. connector 요청은
  `credentials:'omit'` 이라 쿠키가 실리지 않는다(기존 결정 유지). browser_session binding 은
  여전히 `ses.fetch`(전용 partition)로 나간다 — 두 경로가 섞이지 않는다.
- **오류 형상 변화 가능성**: 네트워크 실패 메시지 문자열이 undici 와 다르다. 코드가 메시지
  문자열로 분기하는 곳은 없다(실측 — `policyError`·`ResponseTooLargeError` 는 우리가 만든다).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| **이 환경에서 런타임 검증이 불가능하다**(Electron 바이너리 부재) | AC1~5 는 기계 검증, **AC6 만 사람 실기**로 명시 분리. "green = 동작 확인" 으로 보고하지 않는다 |
| `net.fetch` 의 `.url` 부정확 제약 | sender 는 `.url` 을 안 읽는다(실측). `browser-session-store.probe` 는 `res.url` 을 쓰지만 그건 `ses.fetch` 경로이고 `redirect:'manual'` 이라 원 URL 과 같다 — 이번 변경 대상 아님 |
| 위생 가드의 오탐(`.fetch(` 메서드 호출까지 잡음) | 정규식을 **전역 호출 형태만** 잡게 좁히고(선행 문자가 `.`·식별자면 제외), 가드 자신에 오탐/미탐 케이스 테스트를 붙인다 |

- 되돌리기 어려운 결정: 없음(주입 방향 전환이라 되돌릴 수 있다).

## 영향 받는 파일

- 신규: `app/src/main/infra/auth/net-fetch.ts` · `app/src/main/infra/auth/no-node-fetch.test.ts`
- 수정: `infra/auth/authenticated-fetch.ts`(+테스트) · `features/auth-platform/broker.ts`(+테스트) ·
  `features/auth-platform/conformance.ts` · `features/usage/external-usage-service.ts` · `app/bootstrap.ts`
- 문서: `docs/handoff/INDEX.md` · `app/src/main/AGENTS.md`

## 게이트

- `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`.
- 신규 테스트: 위생 가드 1건 + sender 주입 1건 + broker `ctx.fetch` 2건.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 원문 인용 + 추론 표기.
- [x] 자료조사 — 발견 7건 전부 `파일:라인`, **1차 출처(electron.d.ts) 직접 대조**.
- [x] 의존 기술 — 신규 의존성 0 명시.
- [x] 파생 UX — app.ready 시점·기본 세션 공유·오류 형상까지.
- [x] 리스크 — 환경 한계를 AC 분할로 처리.
- [x] 요구 비판적 검토 5질문 답변, 범위 축소 0("모두" 를 3곳 전부로 이행).
- [x] `검증 수단` 빈칸 0 (AC6 은 "사람 실기 + 실행 경로" 명시).
- [x] 부정형 기준 0 — AC1 은 "0건" 이라는 **측정 가능한 수치**다.
- [x] AC 상호 모순 없음 — AC1(가드)과 AC2~4(주입)는 서로 다른 층을 본다.
- [x] 수치 직접 측정 — 전역 fetch 3곳 · 테스트 9케이스 · electron.d.ts 라인 전부 이번 세션 grep.
- [x] 신규 모듈 테스트 방법 명시(`net-fetch.ts` 는 **의도적 무테스트** + 그 근거).
- [x] 전수 조사 N 수치 — fetch 3 · axios/http 0 · renderer 0.
- [x] 각 AC 에 프로덕션 도달 경로 기재.
- [x] "사람 실기" AC6 의 실행 경로가 비범위에 막히지 않는다.
- [x] 제약 필드 강제 지점 — origin allowlist 는 `makeContext` 가 계속 강제(§설계 2).
- [x] 미룬 항목 일방향 여부 답변(§범위 표).
- [x] 관문 4 — 기존 결정 표를 본문 완성 후 채웠고 인용 경로를 전부 열어 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의**: "새 구조물 없이 기본값만 뒤집는다" 가 맞았다. 세 지점 모두 이미 주입 seam 이 있어
  실제 코드 변경은 **4줄**(전송 호출부)이고 나머지는 배선·테스트다.
- **동의**: 기본값 제거(fail-closed)가 설계의 핵심이었다. 타입체커가 **주입 누락 7곳을 즉시**
  집어냈고(`broker.test.ts` 6 · `broker-restore.test.ts` 1 · usage 7), 그 목록이 곧 "원격으로
  나갈 수 있는 지점 전수" 였다. 기본값을 남겼다면 이 목록이 영원히 안 보였다.
- **이견 없음.**

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 위생 가드가 **측정력 0인 채로 통과**할 수 있다 — 경로가 틀려 파일을 하나도 안 읽거나, 정규식이 아무것도 안 잡아도 `[]` 는 `[]` 다 | ✅ 구현함 — ⓐ 가드 자신에 오탐/미탐 케이스 6건을 붙였고 ⓑ **실측으로 측정력을 증명**했다: 스캔 대상 **197 파일**, 변경 *전* `authenticated-fetch.ts` 를 **잡고**(true) 변경 *후* 는 **안 잡는다**(false) | `no-node-fetch.test.ts` · 실측 로그 |
| 2 | 주석·문자열 안의 `fetch(` 를 위반으로 오탐하면 규칙을 설명하는 문서 주석조차 못 쓴다 | ✅ 구현함 — `stripCommentsAndStrings` 로 주석·문자열을 먼저 지우고 검사한다(그 동작도 테스트로 고정) | 동상 |
| 3 | `Response` 생성자는 **204 에 본문을 허용하지 않는다** — 테스트 스텁이 `new Response('', {status:204})` 로 throw | ✅ 구현함 — `new Response(null, …)` 로 교정 | `authenticated-fetch.test.ts` |
| 4 | `net.fetch` 는 **기본 세션**을 쓴다 → 기본 세션 쿠키가 실릴 여지 | ✅ 확인함 — 기존 `credentials:'omit'` 이 그대로 남아 쿠키가 안 실린다. 스택 교체로 이 옵션의 중요도가 **올라간** 것이라 테스트로 고정했다(`::"주입 구현에 method·headers·body 와 정책 옵션을 그대로 넘긴다"` 가 `credentials`·`redirect` 를 단언) | `authenticated-fetch.test.ts` |
| 5 | `ExternalUsageService` 는 `fetchImpl` 을 **필수**로 바꾸면 기존 테스트 7곳이 깨진다 | ✅ 구현함 — 스위트 상단에 `stubFetch` 를 두고 주입. 원래 자기 fetch 를 주입하던 케이스(`ctx.fetch` 동일성 단언)는 **그대로 둬** 회귀 감시가 유지된다 | `external-usage-service.test.ts:88` |

## [구현자 기입] 구현 체크리스트

- [x] `infra/auth/net-fetch.ts` — electron 경계 파일 1개 (`bypassCustomProtocolHandlers` 포함)
- [x] `createSender(fetchImpl)` 필수 인자화
- [x] `BrokerDeps.fetchImpl` 필수 + `ctx.fetch` 가 주입 구현 사용 (origin 검사는 그 앞에 유지)
- [x] `ExternalUsageService.fetchImpl` 필수화(기본값 제거)
- [x] `bootstrap.ts` 3지점 `netFetch` 주입
- [x] 위생 가드 + 자기 검증 테스트
- [x] `src/main/AGENTS.md` 규칙 절 신설

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `infra/auth/net-fetch.ts`·`infra/auth/no-node-fetch.test.ts` / 수정 `infra/auth/authenticated-fetch.ts`(+테스트) · `features/auth-platform/broker.ts`(+테스트 2종) · `features/usage/external-usage-service.ts`(+테스트) · `app/bootstrap.ts` · `src/main/AGENTS.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint ✅ **0 error**(잔여 warning 1건은 기존 `useTranscriptVirtualizer`) · typecheck ✅ **3/3** · vitest ✅ **1975/1975** (0172 대비 +7) |
| 측정력 실측 | 위생 가드 스캔 **197 파일**; 변경 전 소스를 넣으면 **잡고**, 변경 후에는 **안 잡는다** |
| 알려진 환경 실패 | `chat-turn.continuity.test.ts` 1파일 — Electron 바이너리 부재(변경 무관, 0172 에서 `git stash` 로 확인 완료) |
| 블로커 / 역질문 | 없음. **AC6(사람 실기)만 미확인** — `net.fetch` 는 Electron 런타임 전용이고 이 샌드박스엔 바이너리가 없다 |
| 대상 커밋 | 아래 구현 커밋 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
