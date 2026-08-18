# ADR-004 — 인증은 `Provider` 단일 축. 프로토콜이 아니라 *관계* 로 가른다

> **승계 (0188)**: 아래 본문은 **0181 결정 시점의 기록**이다. `contracts/provider.ts` 와 `Provider` 타입은 그 뒤
> `contracts/auth.ts` 의 `AuthDefinition` 으로 승계됐고 소비 슬롯(`kind`·`llm`·`tools`·`usage`)은 선언에서 빠졌다
> — 현재 구조는 [`../arch/backend/auth.md`](../arch/backend/auth.md) 가 갖는다. 단일 축이라는 **결정 자체는 유효하다**.

## 문제

앱 로그인(사내 SSO 게이트) · LLM 자격증명 · 사내 REST 서비스 연결은 서로 다른 것처럼 보인다.
그래서 초기 구조는 이들을 **프로토콜과 역할을 각각 1급 축으로** 세워 갈랐다 —
`AuthMethod` × `ConnectorRuntime` × `Binding` × `PluginHost`/`ConnectionRegistry`/`TransactionStore`.

문제는 양이 아니라 **축의 교차**였다. 네 축이 계약에 박혀 있어 한 축을 지워도 나머지가 서로를
붙들었고, 뺄셈으로 닫히지 않았다. 축이 교차하면 `acceptedMethods` 정합성 검사 ·
`validateCrossReferences` · binding cascade 같은 **참조 무결성 장치**가 따라붙는데, 그 장치들이
다시 축을 고정한다.

## 검토한 선택지

| 안 | 내용 | 판단 |
|---|---|---|
| A. 점진적 축소 | 기존 구조에서 안 쓰는 축부터 제거 | **시도했고 실패** — 1,600줄을 지워도 같은 불만이 반복됐다. 남은 복잡도가 양이 아니라 교차였기 때문 |
| B. 프로토콜을 1급 축으로 유지 | `api-key`/`oauth`/`session` 별 레지스트리 | 기각 — 무너진 구조가 정확히 이것이었다 |
| C. **전면 제거 후 관계 단일 축으로 재작성** | 1단계에서 전부 지우고, 2단계에서 `kind` 하나로 다시 세운다 | **채택** |

## 선택

**계약은 `contracts/provider.ts` 하나다.** `Provider{id, label, kind, origin, auth[]}` (+ `tools`/`llm`).

**`kind` 는 프로토콜이 아니라 관계다** — `gate`(앱 로그인) · `llm`(모델 게이트웨이) ·
`service`(사내 REST). 누가 누구를 상대하는가만 말하고, **프로토콜은 `AuthSpec` 안에 접혀 있다.**

`AuthSpec` 을 선언 **안에 인라인**으로 접은 것이 핵심이다. 별도 레지스트리를 id 로 참조하지
않으므로 **cross-reference 검증 자체가 성립하지 않는다** — 없앨 필요도 없이 사라진다.
런타임 검사는 둘뿐이다(중복 `id`, `origin` 형태). 형태 강제는 선언 배열의 `satisfies` 로
컴파일 타임에 한다.

앱 로그인·서비스 연결·LLM 자격증명은 **같은 채널 묶음·같은 GUI** 를 쓴다. 셋의 차이는
`ProviderInfo.kind` 뿐이고 별도 인증 인터페이스가 없다.

## 포기한 것

- **점진적 마이그레이션.** 1단계(제거)와 2단계(재작성) 사이에는 게이트가 없고 일부 도구가
  중단된 상태라 **배포 형상이 아니다.** 그 구간에 릴리스 태그를 만들지 않는다.
- **구 vault 키 형식 호환.** `authBinding:<id>:secret` 은 읽지 않는다 — 사용자에게 재로그인을
  요구하는 쪽을 택했다.
- **런타임 확장성.** 인증 provider 는 빌드 타임 선언이다(아래 invariant).

## 생긴 invariant

- **`Provider.id` 는 한 번 정하면 유지한다.** vault 네임스페이스(`provider:<id>:<authKind>`)이자
  `${BINDING:<id>}` 참조 대상이다. 바꾸면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다.
- **vault 키 형식 `provider:<id>:<authKind>` 유지** — 사용자 디스크에 남고 다음 버전이 읽는다.
- **게이트 선언이 0이면 통과.** 뒤집으면 기본 빌드가 영영 열리지 않는다.
- **미인증이면 `null`/드롭 — 빈 문자열로 치환하지 않는다.** 조용한 미인증 진행은 진단 불가능한
  실패가 된다.
- **런타임 동적 로딩 금지.** main 에서 임의 코드 실행 = 전권. 런타임 확장은 MCP 로, 인증
  provider·내장 도구는 빌드 타임으로.
- **배포가 고치는 파일은 한 묶음뿐이다.** (0188 이후 그 자리는 `app/deployment/`)

## 후속 (0188) — 관계 축은 남고, 소비 슬롯은 계약에서 나갔다

ADR 의 핵심 판단(**축의 교차를 피한다**, 참조가 없으면 무결성 검증도 없다)은 그대로다. 다만
0188 이 그 판단을 한 걸음 더 밀었다: `kind`·`llm`·`tools` 는 결국 **소비자의 분류를 인증 계약에
박아 둔 것**이었고, 소비 기능이 늘 때마다 계약이 자랐다. 그리고 `llm.envKey` 는 credential 한
값만 표현해 "OAuth 로 config API 를 불러 URL·모델·실행 token 을 한꺼번에 받는" 요구를 담지 못했다.

| ADR-004 시점 | 0188 이후 |
|---|---|
| `Provider{id,label,kind,origin,auth[],tools?,llm?}` | `AuthDefinition{id,label,origin,methods[],probe?}` — 소비 슬롯 없음 |
| `kind` 가 도메인 축 | gate membership 은 `app/deployment/gate-auth.ts` 의 **객체 참조 목록**. `ProviderKind` 는 renderer wire compat 로만 남는다 |
| `ProviderApi{request,materialize,token}` | `BoundAuth{authId,snapshot,request}` + trusted-main `AuthSecretReader{read}` |
| 배포가 고치는 파일 = `declarations/` 묶음 | 배포가 고치는 파일 = `app/deployment/` 묶음 (Auth 정의·gate membership·Harness augmenter·Plugin·Usage fetcher) |

**뒤집지 않은 것**: 인라인 `AuthMethod`(구 `AuthSpec`) · 게이트 선언 0이면 prod 통과 · 미인증은
`null`/드롭 · 런타임 동적 로딩 금지 · 하나의 계약 파일.

## 관련

현재 구조(등록·소비·게이트 진리표): [`arch/backend/auth.md`](../arch/backend/auth.md) ·
배포 절차: [`guides/closed-network-extensions.md`](../guides/closed-network-extensions.md) ·
노출 경계: [`arch/backend/security.md`](../arch/backend/security.md) §1.4-b ·
전송 스택 규칙: [ADR-003](003-electron-network-stack.md)

> ⚠️ 이름이 닮은 [`arch/backend/provider-runtime.md`](../arch/backend/provider-runtime.md) 는
> **다른 문서**다 — 그쪽은 *턴 이벤트 정규화 계층*(NormalizedEvent·PermissionBridge)이고,
> 이 ADR 은 *인증 대상 플랫폼*이다.
