// `window.oo` 설치 — renderer 전송층 (0324 D-058 · EP-27 · EP-29 ① · AC52 · AC53).
//
// preload 다리(`window.ooBridge`) 위에 두 호스트의 포트 클라이언트와 `window.oo` 를 만든다. 셸이 넘긴 호스트
// 포트는 preload 가 같은 창의 `window.postMessage` 로 넘기고(EP-26 ③) 여기서 받는다 — 페이지 메인 월드가
// 포트를 쥔다(B41). 셸은 연결 요청 전에는 포트를 보내지 않으므로 수신을 먼저 등록하고 연결을 요청한다(B44).

import type { OoBridge } from '../../../../../preload/index'
import { HOST_PORT_MESSAGE, type HostName } from '../../../../../shared/host-channels'
import { createHostPortClient, type ClientPort } from './host-port'
import { createOo, type HostLifecycleEvent, type OoApi } from './oo'

// `present` — `window.oo` 가 이미 있다(시각 픽스처, B45) · `missing` — 다리가 없다(preload 실패, D-059) ·
// `installed` — 다리 위에 만들었다.
export type InstallResult = 'installed' | 'present' | 'missing'

// 설치가 읽고 쓰는 창의 자리 — 테스트는 흉내 창을 넘긴다.
export interface OoWindow {
  oo?: OoApi
  ooBridge?: OoBridge
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

function wrapPort(port: MessagePort): ClientPort {
  return {
    postMessage: (message) => port.postMessage(message),
    onMessage: (listener) => {
      // `onmessage` 대입이 포트를 시작한다.
      port.onmessage = (event: MessageEvent) => listener(event.data)
    },
    close: () => port.close()
  }
}

export function installOo(win: OoWindow = window): InstallResult {
  if (win.oo) return 'present'
  const bridge = win.ooBridge
  if (!bridge) return 'missing'

  const hosts = {
    agent: createHostPortClient({
      host: 'agent',
      requestConnect: () => bridge.connectHost('agent')
    }),
    data: createHostPortClient({ host: 'data', requestConnect: () => bridge.connectHost('data') })
  }

  // 호스트 수명 통지 (AC29′·AC33′ · EP-27 ④) — 종료와, 죽었던 호스트의 새 포트만 알린다.
  const lifecycle = new Set<(event: HostLifecycleEvent) => void>()
  const seen: Record<HostName, boolean> = { agent: false, data: false }
  const lost: Record<HostName, boolean> = { agent: false, data: false }
  const emit = (event: HostLifecycleEvent): void => {
    for (const listener of [...lifecycle]) listener(event)
  }

  // 포트 수신 (EP-27 ②) — 이 창이 보낸 표지 메시지이고, 호스트가 에이전트·데이터이고, 포트가 하나일 때만 붙인다.
  // 다른 창(iframe)이 보낸 메시지는 `source` 가 다르다(B42).
  win.addEventListener('message', (event) => {
    if (event.source !== win) return
    const data = event.data as { type?: unknown; host?: unknown } | null
    if (data?.type !== HOST_PORT_MESSAGE) return
    const host = data.host
    if (host !== 'agent' && host !== 'data') return
    if (event.ports.length !== 1) return
    hosts[host].attachPort(wrapPort(event.ports[0]!))
    const reconnected = seen[host] && lost[host]
    seen[host] = true
    lost[host] = false
    if (reconnected) emit({ host, kind: 'reconnected' })
  })
  bridge.onHostExited((host) => {
    hosts[host].hostExited()
    lost[host] = true
    emit({ host, kind: 'exited' })
  })

  win.oo = createOo({
    bridge,
    hosts,
    onHostLifecycle: (handler) => {
      lifecycle.add(handler)
      return () => {
        lifecycle.delete(handler)
      }
    }
  })
  // 연결 순서 (EP-27 ③) — 수신을 등록한 뒤 이 문서의 두 호스트 포트를 요청한다. 새로 읽힌 문서는 옛 포트를
  // 갖고 있지 않다.
  bridge.connectHost('all')
  return 'installed'
}
