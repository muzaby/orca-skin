import { z } from 'zod'
import type { RuntimeToolResult, RuntimeToolServer } from '../../../adapters/runtime-tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import { exportMailAttachment } from './attachment-export'
import { createMailSyncManager, type MailSyncManager } from './sync-manager'
import type { MailPluginOptions } from './types'
import type { MailTransport } from './transport'
import { publicMailError } from './errors'
import { createPop3ReadSession } from './pop3/session'
import type { PluginAuth } from '../../../contracts/auth'

export const MAIL_TOOL_NAMES = ['mail_sync', 'mail_search', 'mail_getAttachment'] as const

// 도구 계층이 sync manager 에게 요구하는 전부. **`createMailToolServer` 의 주입 지점**이라
// 여기 없는 것은 도구 계층의 관심사가 아니다 — DB 도 소켓도 이 인터페이스 뒤에 있다.
export interface MailToolManagerPort {
  sync(signal?: AbortSignal): Promise<unknown>
  search(query: string, limit: number): unknown
  getAttachment(
    mailId: string,
    attachmentId: string
  ): Promise<{ filename: string; bytes: Uint8Array } | null | undefined>
}

export interface MailToolOptions {
  readonly now?: () => number
}

function result(value: Record<string, unknown>, isError = false): RuntimeToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
    structuredContent: value
  }
}

function errorResult(error: unknown): RuntimeToolResult {
  const normalized = publicMailError(error)
  return result({ error: normalized.code, message: normalized.message }, true)
}

// 조립 표면 (0237 ΔV2 — D-050). **auth 포트와 전송 의존이 인자로 갈린다** — POP3 는 HTTP 가
// 아니라 `PluginAuth.request` 를 쓸 수 없고(그것이 이 Plugin 이 예외인 이유다), 그래서 배포가
// 전송 한 벌을 따로 준다. 구 `MailPluginContext` 는 둘을 한 객체에 섞어 `authId` 와 `password`
// 가 같은 자리에 있었고, 그래서 "auth 로 되는 것" 과 "배포가 더 줘야 하는 것" 이 시그니처에서
// 구분되지 않았다.
export function mailTools(
  auth: PluginAuth,
  transport: MailTransport,
  options: MailPluginOptions,
  toolOptions: MailToolOptions = {}
): RuntimeToolServer {
  let managerPromise: Promise<MailSyncManager> | undefined
  const manager = (): Promise<MailSyncManager> => {
    managerPromise ??= createMailSyncManager({
      authId: auth.authId,
      credential: transport.credential,
      options,
      // **프로토콜 구현체를 고르는 유일한 자리다** (0237 D-056). 이번 구현은 POP3 1종이고,
      // 두 번째가 오면 여기서 고른다 — `sync-manager` 는 계속 포트만 안다.
      sessionFactory: createPop3ReadSession,
      socketFactory: transport.socketFactory,
      root: transport.root,
      ...(toolOptions.now ? { now: toolOptions.now } : {}),
      ...(transport.reportCredentialRejected
        ? { reportCredentialRejected: transport.reportCredentialRejected }
        : {})
    })
    return managerPromise
  }
  return createMailToolServer(auth, manager)
}

// 런타임을 주입받는 하위 표면 — confluence(`createConfluenceToolServer(auth, runtime)`)·
// jira(`createJiraToolServer(auth, service)`)와 같은 형상이다. 도구 계층(descriptor·handler)만
// 검증할 때 쓴다: DB 도 소켓도 열지 않는다.
export function createMailToolServer(
  auth: PluginAuth,
  manager: () => Promise<MailToolManagerPort>
): RuntimeToolServer {
  return {
    descriptor: {
      id: authToolServerId(auth.authId),
      connectorId: auth.authId,
      instructions:
        'Call mail_sync before mail_search when the cache may be stale. Use attachmentId values from mail_search and call mail_getAttachment one attachment at a time; each attachment requires its own approval.',
      tools: [
        {
          name: 'mail_sync',
          description:
            'Synchronize the local POP3 mail cache. This contacts the configured mail server.',
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        {
          name: 'mail_search',
          description: 'Search the local cached mail by sender, recipients, subject, or body.',
          annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
        },
        {
          name: 'mail_getAttachment',
          description:
            'Copy one attachment identified by mailId and attachmentId into Orca temporary storage.',
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        }
      ]
    },
    implementations: [
      {
        name: 'mail_sync',
        inputSchema: {},
        handler: async (_input, context) => {
          try {
            const value = (await (await manager()).sync(context?.getSignal())) as Record<
              string,
              unknown
            >
            return result(value, 'error' in value)
          } catch (error) {
            return errorResult(error)
          }
        }
      },
      {
        name: 'mail_search',
        inputSchema: {
          query: z.string().optional(),
          limit: z.number().int().min(1).max(50).optional()
        },
        handler: async (input) => {
          try {
            const query = typeof input.query === 'string' ? input.query : ''
            const limit = typeof input.limit === 'number' ? input.limit : 20
            return result(
              (await manager()).search(query, limit) as unknown as Record<string, unknown>
            )
          } catch (error) {
            return errorResult(error)
          }
        }
      },
      {
        name: 'mail_getAttachment',
        inputSchema: { mailId: z.string().min(1), attachmentId: z.string().min(1) },
        handler: async (input) => {
          try {
            const mailId = String(input.mailId ?? '')
            const attachmentId = String(input.attachmentId ?? '')
            if (!mailId || !attachmentId)
              return result(
                { error: 'invalid_input', message: 'mailId와 attachmentId가 필요합니다.' },
                true
              )
            const managerValue = await manager()
            const attachment = await managerValue.getAttachment(mailId, attachmentId)
            if (!attachment)
              return result(
                { error: 'attachment_not_found', message: '첨부파일을 찾을 수 없습니다.' },
                true
              )
            const exported = await exportMailAttachment(
              { root: undefined },
              auth.authId,
              attachment.filename,
              attachment.bytes
            )
            return result({
              filename: exported.filename,
              bytes: exported.bytes,
              savedPath: exported.savedPath
            })
          } catch (error) {
            return errorResult(error)
          }
        }
      }
    ]
  }
}
