import { createElement, type ReactNode } from 'react'
import type { InstallResult } from '../shared/api/transport/install'
import { BridgeMissingScreen } from './BridgeMissingScreen'

// 창의 첫 요소 (0324 EP-29 ② · AC53) — preload 다리가 없으면(`missing`) 앱 대신 실패 화면이다. 앱은
// provider 가 첫 호출에서 `window.oo` 를 읽으므로 다리 없이 띄우면 트리 전체가 내려가 창이 빈다.
export function rootElement(install: InstallResult, app: ReactNode): ReactNode {
  return install === 'missing' ? createElement(BridgeMissingScreen) : app
}
