// 셸 서비스 표 (0324 EP-10 · AR-08). 에이전트 호스트가 Electron 권한 작업을 셸에 부탁하는 요청의
// 이름·인자·결과다. 셸은 인자를 이 스키마로 검증한 뒤에만 Electron API 를 부른다. 경로·버전은
// 요청이 아니라 호스트 fork 인자다(§11 단계 4).

import { z } from 'zod'

const Text = z.string()
const Path = z.string().min(1)
// 대화상자·알림이 붙을 창. 없으면 창 없이 띄운다.
const ClientId = z.number().int().nullable()

const DialogFilter = z.object({ name: z.string(), extensions: z.array(z.string()) })
const OpenDialogOptions = z.object({
  clientId: ClientId,
  properties: z.array(
    z.enum(['openFile', 'openDirectory', 'multiSelections', 'createDirectory', 'showHiddenFiles'])
  ),
  filters: z.array(DialogFilter).optional(),
  defaultPath: z.string().optional()
})
const SaveDialogOptions = z.object({ clientId: ClientId, defaultPath: z.string().optional() })
const NotifyOptions = z.object({ clientId: ClientId, title: z.string(), body: z.string() })

// 파티션 세션(쿠키 jar·통합 인증) — 셸만 Electron `session` 을 연다. 그룹 이름은 호스트와 셸 사이에만
// 오가고 renderer 에는 나가지 않는다(호스트가 불투명 핸들로 바꿔 쓴다).
const SessionGroup = z.string().min(1)
const SessionPolicy = z.object({
  sessionGroup: SessionGroup,
  allowedOrigins: z.array(z.string()),
  allowIntegratedAuthDomains: z.array(z.string()).optional()
})
// 로그인 창 — 끝났는지는 호스트가 판정한다. 셸은 이동할 때마다 `login.navigated` 로 묻고
// `session.loginVerdict` 를 받는다.
const LoginWindowOptions = z.object({
  loginId: z.string().min(1),
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional()
})
const SessionRequest = z.object({
  url: z.string().url(),
  method: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  body: z.string().optional()
})
const SessionSendOptions = z.object({
  responseType: z.enum(['text', 'binary']).optional(),
  maxBytes: z.number().int().nonnegative().optional()
})
const SessionClear = z.object({ scope: z.enum(['origin', 'group']), origin: z.string().optional() })

// 요청 이름 → 인자 튜플.
export const SHELL_SERVICE_ARGS = {
  // 비밀 봉인·해제 — 암호문은 base64 문자열이다.
  'secrets.isAvailable': z.tuple([]),
  'secrets.encrypt': z.tuple([Text]),
  'secrets.decrypt': z.tuple([Text]),
  // 대화상자.
  'dialog.showOpen': z.tuple([OpenDialogOptions]),
  'dialog.showSave': z.tuple([SaveDialogOptions]),
  // 외부 열기.
  'external.openExternal': z.tuple([z.string().url()]),
  'external.openPath': z.tuple([Path]),
  'external.showItemInFolder': z.tuple([Path]),
  'external.trashItem': z.tuple([Path]),
  // 알림 — 그 창이 포커스를 갖고 있으면 띄우지 않는다(포커스 판정은 셸만 할 수 있다).
  'notify.show': z.tuple([NotifyOptions]),
  // 파티션 세션.
  'session.register': z.tuple([SessionPolicy]),
  'session.openLogin': z.tuple([SessionGroup, LoginWindowOptions]),
  'session.loginVerdict': z.tuple([z.string().min(1), z.number().int().nonnegative(), z.boolean()]),
  'session.send': z.tuple([SessionGroup, SessionRequest, SessionSendOptions.optional()]),
  'session.clear': z.tuple([SessionGroup, SessionClear])
} as const

// 셸 → 호스트 `wake` 의 원인. 원인마다 듣는 쪽이 다르다(창 포커스만 보는 재확인이 있다).
export const WAKE_REASONS = ['resume', 'unlock-screen', 'window-focus'] as const
export type WakeReason = (typeof WAKE_REASONS)[number]

export type ShellServiceName = keyof typeof SHELL_SERVICE_ARGS
export type ShellServiceArgs<N extends ShellServiceName> = z.infer<(typeof SHELL_SERVICE_ARGS)[N]>

export interface ShellServiceResults {
  'secrets.isAvailable': boolean
  'secrets.encrypt': string
  'secrets.decrypt': string
  'dialog.showOpen': { canceled: boolean; filePaths: string[] }
  'dialog.showSave': { canceled: boolean; filePath?: string }
  // 실패하면 오류 문장, 성공하면 빈 문자열(Electron `shell.openPath` 와 같다).
  'external.openPath': string
  'external.openExternal': void
  'external.showItemInFolder': void
  'external.trashItem': void
  'notify.show': void
  'session.register': void
  'session.openLogin': { finalUrl: string }
  'session.loginVerdict': void
  'session.send': {
    status: number
    headers: Record<string, string>
    body: string
    bodyBytes?: Uint8Array
  }
  'session.clear': void
}

// 셸 → 호스트 통지를 내야 하는 구현이 받는 맥락 — 그 요청을 보낸 호스트에게만 간다.
export interface ShellServiceContext {
  notifyLoginNavigated(loginId: string, seq: number, url: string): void
}

// 셸 쪽 구현 — 이름마다 하나.
export type ShellServiceImpl = {
  [N in ShellServiceName]: (
    ...args: [...ShellServiceArgs<N>, ShellServiceContext]
  ) => ShellServiceResults[N] | Promise<ShellServiceResults[N]>
}

export function isShellServiceName(name: string): name is ShellServiceName {
  return Object.prototype.hasOwnProperty.call(SHELL_SERVICE_ARGS, name)
}
