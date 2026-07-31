# Orca — 연구 기반 도입 검토

| 문서 | 내용 |
|---|---|
| [auth-plugin-platform-requirements-ko.md](auth-plugin-platform-requirements-ko.md) | **정본.** 앱 로그인·서비스 연결을 같은 lifecycle로 처리하는 인증 플러그인 플랫폼 요구명세, ADFS/WIA shared session, API key·Auth token·PAT, 보안·인수 기준 |
| [auth-broker-adoption-report-ko.md](auth-broker-adoption-report-ko.md) | OpenCode·goose·Hermes 비교를 Authentication Plugin Platform 관점으로 재해석한 Orca 목표 구조와 단계별 도입안. **요구명세와 충돌 시 요구명세 우선** |

## 2026-07-31 개정 (핸드오프 `0157` 착수 전 비판적 검토)

두 문서를 Orca 실제 코드와 대조해 3건을 수정했다. 초판을 인용하는 문서·계획이 있다면 개정본을 따른다.

| # | 개정 | 요지 |
|---|---|---|
| 1 | **AUTH-PLAT-008 스코프 축소** | Orca 는 LLM 백엔드·MCP 요청의 주체가 아니다(claude CLI 서브프로세스가 요청). "raw secret 이 argv·dist 에 없다" 는 달성 불가 → "Orca 소유·중개 경로 한정" + 잔여 노출 예외 표. 요구명세 §소비자 경계 |
| 2 | **AUTH-PLAT-011(격리 plugin-host) 폐기** | 확장의 축은 "선언형이냐 코드냐"가 아니라 **"빌드 타임 내장이냐 런타임 MCP 냐"**. 런타임 확장은 MCP 가 담당하므로 격리 host 가 방어할 대상이 없다. `contracts/sso.ts` 의 런타임 동적 로딩 금지는 **유지**. 요구명세 §확장 모델 |
| 3 | **ADFS 전제 표기** | Orca 에는 ADFS 코드가 없다(`SSO_MODULE_REGISTRATION = null`). 사용자의 별도 사내 앱 진술이며 **사용자 확인(2026-07-31)** 을 받은 전제로 표기 |

초판 누락 4건(transaction 내구성·동시성 / migration / safeStorage 읽기 정책 / 공수 비대칭)은
요구명세 §미비 보완 에 채웠다.

원본 비교 연구 3편(`../opencode/`·`../goose/`·`../hermes-agent/`)은 **수정하지 않았다** —
근거가 pinned commit permalink 로 고정돼 있고 한계를 스스로 적은 신뢰 자료다. 다만 셋 다
**LLM 모델 provider 인증**이며 서비스 커넥터 인증이 아니라는 도메인 차이를 감안해 읽는다.

