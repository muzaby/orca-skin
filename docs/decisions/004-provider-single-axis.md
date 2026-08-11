# ADR-004 — 인증은 `Provider` 단일 축. 프로토콜이 아니라 *관계* 로 가른다

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
- **배포가 고치는 파일은 `declarations/` 묶음뿐이다.**

## 관련

현재 구조(등록·소비·게이트 진리표): [`arch/backend/providers.md`](../arch/backend/providers.md) ·
배포 절차: [`guides/closed-network-extensions.md`](../guides/closed-network-extensions.md) ·
노출 경계: [`arch/backend/security.md`](../arch/backend/security.md) §1.4-b ·
전송 스택 규칙: [ADR-003](003-electron-network-stack.md)

> ⚠️ 이름이 닮은 [`arch/backend/provider-runtime.md`](../arch/backend/provider-runtime.md) 는
> **다른 문서**다 — 그쪽은 *턴 이벤트 정규화 계층*(NormalizedEvent·PermissionBridge)이고,
> 이 ADR 은 *인증 대상 플랫폼*이다.
