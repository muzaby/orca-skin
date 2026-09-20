// `AuthDefinition.origin` → POP3 연결 좌표 (0237 ΔV2 — D-054).
//
// **연결 대상은 선언 한 곳에만 산다.** 0237 r2 는 Auth 선언의 `origin`(계정 식별용 가짜 HTTPS)
// 과 `MailPluginOptions.host`/`port`/`tls` 를 **두 사본**으로 들고 있었다. 두 값이 갈리면
// 도구는 모델에 보이는데 호출할 때마다 엉뚱한 서버로 붙는다 — 컴파일러도 등록 검사도 못 잡는다.
//
// endpoint 는 등록에서 형태가 강제되므로(`features/auth/registry.ts` `isBareEndpoint`) 여기서는
// scheme 해석만 한다. 순수 — vitest 대상이다.

export interface MailEndpoint {
  readonly host: string
  readonly port: number
  readonly tls: boolean
}

// scheme → 기본 포트·TLS. **평문 포트는 선언으로만 열린다** — 기본값이 아니다(D-025).
const SCHEMES: Readonly<Record<string, { port: number; tls: boolean }>> = {
  'pop3s:': { port: 995, tls: true },
  'pop3:': { port: 110, tls: false }
}

export class MailEndpointError extends Error {
  constructor(raw: string, detail: string) {
    // 호스트는 싣지 않는다 — 배포 진단에 필요한 것은 무엇이 틀렸는가이지 어디인가가 아니다.
    super(`메일 endpoint 를 해석할 수 없습니다 (${detail}): ${raw}`)
    this.name = 'MailEndpointError'
  }
}

export function parseMailEndpoint(raw: string): MailEndpoint {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new MailEndpointError(raw, 'URL 형식이 아닙니다')
  }
  const scheme = SCHEMES[url.protocol]
  if (!scheme) {
    throw new MailEndpointError(raw, `지원하지 않는 scheme 입니다 (pop3s: · pop3: 만 가능)`)
  }
  if (url.hostname === '') throw new MailEndpointError(raw, '호스트가 없습니다')
  return {
    host: url.hostname,
    // 명시 포트가 이긴다. 없으면 scheme 기본값 — `URL.port` 는 미지정일 때 빈 문자열이다.
    port: url.port === '' ? scheme.port : Number(url.port),
    tls: scheme.tls
  }
}
