# ADR-003 — main 의 원격 요청은 Chromium `net` 스택으로만 나간다

## 문제

Node 의 전역 `fetch`(undici)는 **OS 프록시·PAC 설정과 OS 인증서 저장소를 보지 않는다.** 사내
프록시 뒤의 사설 CA 서버로 요청하면 실패하는데, 같은 URL 이 브라우저로는 열린다 — *"브라우저는
되는데 앱만 안 되는"* 증상이 정확히 여기서 나온다.

더 나쁜 것은 **로컬·개방망에서는 아무 문제 없이 통과한다**는 점이다. 개발 환경과 CI 가 전부
green 인데 사내망 사용자에게서만 실패한다.

## 검토한 선택지

| 안 | 내용 | 판단 |
|---|---|---|
| A. Node `fetch` + 프록시 설정 주입 | `HTTPS_PROXY` 등을 앱이 읽어 undici 에 전달 | 기각 — PAC 스크립트와 OS 인증서 저장소는 여전히 못 본다. 반쪽 해결 |
| B. 요청마다 판단 | 사내 도메인만 Chromium 으로 | 기각 — "사내인지" 를 매 호출부가 알아야 하고, 새 호출부가 생길 때마다 조용히 틀린다 |
| C. **Chromium `net` 스택 단일화** | main 의 모든 원격 요청을 Electron `net.fetch`/`net.request` 로 | **채택** |

## 선택

**main 프로세스는 Node 전역 `fetch` 를 쓰지 않는다.** 전역 `fetch(` 를 호출할 수 있는 파일은
`infra/net/net-fetch.ts` **하나**뿐이고, 소비자는 `typeof fetch` **포트로 주입받는다**.

이 규칙은 리뷰가 아니라 **테스트로 강제**한다 — 위반해도 로컬·개방망에서는 통과하므로 사람 눈에
띄지 않기 때문이다(`infra/net/no-node-fetch.test.ts` 가 `src/main/**` 전 `.ts` 를 훑는다).

## 포기한 것

- **표준 `fetch` 의 친숙함.** 새 호출부는 포트 주입을 받아야 하고, 그냥 `fetch` 를 부르면 실패한다.
- **테스트 편의.** Chromium 스택을 무는 파일은 `electron` 을 import 하므로 테스트가 직접
  import 하면 즉시 죽는다(`vitest.config.ts` 에 electron alias 없음). 그래서 판정·변환은
  **순수 모듈로 떼어 두고** 그 파일들은 배선만 한다.
- **웹 `fetch` 와 동일한 리다이렉트 의미론** — 아래 invariant 참조.

## 생긴 invariant

- **`infra/net/net-fetch.ts` 밖에서 전역 `fetch(` 호출 0건.** 메서드 호출(`ses.fetch(`·
  `this.deps.fetchImpl(`)은 위반이 아니다. 가드는 자기 정규식의 오탐/미탐도 함께 고정한다.
- **`fetchImpl` 에 기본값을 두지 않는다.** 기본값은 곧 **조용한 Node 스택 복귀**이고, 그 실패는
  사내망에서만 드러난다.
- **`redirect:'manual'` 은 Electron 에서 의미가 다르다.** 웹 fetch 는 3xx 를 돌려주지만
  Electron 은 **요청을 취소한다**(`followRedirect()` 를 동기 호출해야 이어진다). 3xx 를 직접
  받아야 하면 `net-request.ts` 의 `sendOnce` 를 쓴다. **리다이렉트 추종은 호출자가 한다** —
  홉마다 정책을 검사해야 하기 때문이다.
- Chromium 스택을 직접 무는 파일은 소수로 유지하고, 판정·변환 순수부(`net-response.ts` ·
  `browser-session-policy.ts`)를 분리해 테스트 가능하게 둔다.

## 관련

현재 구조·인벤토리: [`arch/backend/security.md`](../arch/backend/security.md) §1.8·§1.9 ·
작업 규칙: [`app/src/main/AGENTS.md`](../../app/src/main/AGENTS.md) §원격 요청
