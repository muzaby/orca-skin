import { z } from 'zod'
import type { RuntimeToolResult, RuntimeToolServer } from '../../../adapters/runtime-tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import { exportMailAttachment } from './attachment-export'
import { createMailSyncManager, type MailSyncManager } from './sync-manager'
import type { MailPluginOptions, Pop3SocketFactory } from './types'
import type { PluginAuth } from '../../../contracts/auth'
import { parseMailEndpoint } from './endpoint'
import { publicMailError } from './pop3/errors'

export const MAIL_TOOL_NAMES = ['mail_sync', 'mail_search', 'mail_getAttachment'] as const

// **Plugin 은 auth 자원 + 자기 옵션만 받는다** (0237 ΔV2 — D-048·D-055). 0237 r2 의 ctx 는
// `authId`·`password`·`root`·`socketFactory`·`reportCredentialRejected` 5필드였고 그중 auth 에서
// 온 것은 `authId` 하나였다 — 나머지 넷을 컴포지션 루트가 손으로 엮었다. 이제 `PluginAuth`
// 하나가 그 넷을 대신한다(`origin`·`secret()`·`reportAuthFailure()` + infra 기본값).
export type MailToolOptions = {
  readonly plugin: MailPluginOptions
  readonly now?: () => number
  /** 테스트 seam (D-058). */
  readonly socketFactory?: Pop3SocketFactory
  /** 테스트 seam (D-057). */
  readonly dataDir?: string
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

export function mailTools(auth: PluginAuth, options: MailToolOptions): RuntimeToolServer {
  const plugin = options.plugin
  // **연결 좌표는 선언 한 곳에서 온다** (D-054). 형식이 틀렸으면 조립에서 즉시 드러난다 —
  // 도구를 부를 때 알게 되면 안 된다.
  const endpoint = parseMailEndpoint(auth.origin)
  let managerPromise: Promise<MailSyncManager> | undefined
  const manager = (): Promise<MailSyncManager> => {
    managerPromise ??= createMailSyncManager({
      authId: auth.authId,
      endpoint,
      secret: () => auth.secret(),
      reportAuthFailure: () => auth.reportAuthFailure(),
      options: plugin,
      ...(options.socketFactory ? { socketFactory: options.socketFactory } : {}),
      ...(options.dataDir ? { dataDir: options.dataDir } : {}),
      ...(options.now ? { now: options.now } : {})
    })
    return managerPromise
  }

  // 종료 시 자원을 닫는다 (D-060). 도구가 한 번도 안 불렸으면 manager 자체가 없다 —
  // 그때 `manager()` 를 부르면 **닫으려고 DB 를 여는** 꼴이라 promise 유무로 가른다.
  const dispose = (): void => {
    if (!managerPromise) return
    void managerPromise.then((value) => value.close()).catch(() => undefined)
    managerPromise = undefined
  }

  return {
    dispose,
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
            const value = await (await manager()).sync(context?.getSignal())
            return result(value as unknown as Record<string, unknown>, 'error' in value)
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

export const createMailPlugin = mailTools
