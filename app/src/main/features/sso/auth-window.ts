// SsoContext.openAuthWindow 구현 — 브라우저형 로그인 플로우(OAuth 변형 등)용 격리 창.
// 앱 세션과 쿠키가 섞이지 않도록 전용 'sso' 파티션을 쓰고, preload 없이
// contextIsolation/sandbox 를 강제한다. 외부 URL 로드는 이 창에 한정된 의도적 예외다
// (앱 본창의 setWindowOpenHandler 차단 정책은 불변 — docs/arch/backend/security.md).

import { BrowserWindow, session } from 'electron'
import type { SsoContext } from '../../contracts/sso'

const DEFAULT_TIMEOUT_MS = 300_000
const SSO_PARTITION = 'sso'

export const openSsoAuthWindow: SsoContext['openAuthWindow'] = (opts) =>
  new Promise((resolve, reject) => {
    const ses = session.fromPartition(SSO_PARTITION)
    const win = new BrowserWindow({
      width: opts.width ?? 480,
      height: opts.height ?? 640,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: SSO_PARTITION
      }
    })
    let settled = false
    const timer = setTimeout(
      () => fail(new Error('sso auth window timeout')),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    )
    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!win.isDestroyed()) win.destroy()
      reject(err)
    }
    const finish = (finalUrl: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void ses.cookies
        .get({})
        .then((cookies) =>
          resolve({
            finalUrl,
            cookies: cookies.map((c) => ({
              name: c.name,
              value: c.value,
              ...(c.domain !== undefined ? { domain: c.domain } : {})
            }))
          })
        )
        .catch(reject)
        .finally(() => {
          if (!win.isDestroyed()) win.destroy()
        })
    }
    const check = (url: string): void => {
      if (opts.isDone(url)) finish(url)
    }
    win.webContents.on('did-navigate', (_e, url) => check(url))
    win.webContents.on('will-redirect', (_e, url) => check(url))
    win.on('closed', () => fail(new Error('sso auth window closed by user')))
    void win
      .loadURL(opts.url)
      .catch((err) => fail(err instanceof Error ? err : new Error(String(err))))
  })
