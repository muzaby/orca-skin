// 셸 서비스의 Electron 구현 (0324 EP-10). 셸 프로세스에서만 import 한다 — 호스트는 이 파일 대신
// `agent-host/shell-client.ts` 로 부탁한다. 판정·검증은 `services.ts` 가 끝낸 뒤라 여기는 배선만
// 갖는다. 창 id 는 그 창의 `webContents.id` 다(`infra/ipc/electron-transport.ts` 의 `ClientRef.id`).

import {
  BrowserWindow,
  Notification,
  dialog,
  safeStorage,
  shell,
  webContents,
  type OpenDialogOptions
} from 'electron'
import type { ShellServiceImpl } from '../../../shared/shell-services'
import { BrowserSessionStore } from '../../infra/browser-session'

function windowOf(clientId: number | null): BrowserWindow | null {
  if (clientId === null) return null
  const contents = webContents.fromId(clientId)
  if (!contents || contents.isDestroyed()) return null
  return BrowserWindow.fromWebContents(contents)
}

export function createElectronShellServices(): ShellServiceImpl {
  // 파티션 세션은 셸이 하나 갖는다 — 호스트는 그룹 이름으로 부탁한다.
  const sessions = new BrowserSessionStore()
  // 로그인 창마다 판정을 기다리는 이동(이동 순번 → 답).
  const verdicts = new Map<string, Map<number, (done: boolean) => void>>()
  return {
    'secrets.isAvailable': () => safeStorage.isEncryptionAvailable(),
    'secrets.encrypt': (plain) => safeStorage.encryptString(plain).toString('base64'),
    'secrets.decrypt': (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
    'dialog.showOpen': async ({ clientId, ...options }) => {
      const parent = windowOf(clientId)
      const opts: OpenDialogOptions = options
      const result = parent
        ? await dialog.showOpenDialog(parent, opts)
        : await dialog.showOpenDialog(opts)
      return { canceled: result.canceled, filePaths: result.filePaths }
    },
    'dialog.showSave': async ({ clientId, ...options }) => {
      const parent = windowOf(clientId)
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options)
      return result.filePath
        ? { canceled: result.canceled, filePath: result.filePath }
        : { canceled: result.canceled }
    },
    'external.openExternal': (url) => shell.openExternal(url),
    'external.openPath': (path) => shell.openPath(path),
    'external.showItemInFolder': (path) => shell.showItemInFolder(path),
    'external.trashItem': (path) => shell.trashItem(path),
    'notify.show': ({ clientId, title, body }) => {
      // 그 창이 포커스를 갖고 있으면 띄우지 않는다(지금 `handlers/misc.ts` 와 같은 판정).
      if (windowOf(clientId)?.isFocused()) return
      if (Notification.isSupported()) new Notification({ title, body }).show()
    },
    'session.register': (policy) => sessions.register(policy),
    'session.openLogin': async (group, { loginId, url, width, height, timeoutMs }, context) => {
      const handle = sessions.acquire(group)
      const pending = new Map<number, (done: boolean) => void>()
      verdicts.set(loginId, pending)
      let seq = 0
      try {
        return await sessions.openLoginWindow(handle, {
          url,
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          // 끝났는지는 요청한 호스트가 판정한다 — 답이 올 때까지 창은 그대로다.
          isDone: (navigated) =>
            new Promise<boolean>((resolve) => {
              const current = seq++
              pending.set(current, resolve)
              context.notifyLoginNavigated(loginId, current, navigated)
            })
        })
      } finally {
        verdicts.delete(loginId)
        for (const resolve of pending.values()) resolve(false)
      }
    },
    'session.loginVerdict': (loginId, seq, done) => {
      const pending = verdicts.get(loginId)
      const resolve = pending?.get(seq)
      if (!resolve) return
      pending!.delete(seq)
      resolve(done)
    },
    'session.send': (group, request, options) =>
      sessions.send(sessions.acquire(group), request, options),
    'session.clear': (group, options) => sessions.clear(sessions.acquire(group), options)
  }
}
