import { z } from 'zod'
import {
  jsonToolResult as result,
  type RuntimeToolResult,
  type RuntimeToolServer
} from '../../../adapters/runtime-tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import { exportMailAttachment } from './attachment-export'
import { createMailSyncManager, type MailSyncManager } from './sync-manager'
import type { MailPluginOptions, MailSyncResult } from './types'
import type { PluginAuth } from '../../../contracts/auth'
import { userDataPath } from '../../../infra/config/user-data-path'
import { createPop3Socket } from '../../../infra/net/pop3-socket'
import { mailSessionConfig } from './auth'
import { publicMailError } from './pop3/errors'

function errorResult(error: unknown): RuntimeToolResult {
  const normalized = publicMailError(error)
  return result({ error: normalized.code, message: normalized.message }, true)
}

export function mailTools(auth: PluginAuth, options: MailPluginOptions): RuntimeToolServer {
  // 좌표는 `auth.origin` 한 사본에서만 온다 — 옵션에 두 번째 사본이 없으므로 대조하지 않는다.
  // 형식이 깨진 origin 은 여기서 즉시 던져 서버 조립을 막는다.
  const session = mailSessionConfig(auth.origin, options)
  let inFlight: Promise<MailSyncResult> | undefined
  const withManager = async <T>(
    operation: (manager: MailSyncManager) => Promise<T>
  ): Promise<T> => {
    const manager = await createMailSyncManager({
      auth,
      options,
      session,
      socketFactory: createPop3Socket,
      root: await userDataPath()
    })
    try {
      return await operation(manager)
    } finally {
      manager.close()
    }
  }
  const sync = (signal?: AbortSignal): Promise<MailSyncResult> => {
    if (!inFlight) {
      inFlight = withManager((manager) => manager.sync(signal)).finally(() => {
        inFlight = undefined
      })
    }
    return inFlight
  }

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
            const value = await sync(context?.getSignal())
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
              (await withManager(async (manager) =>
                manager.search(query, limit)
              )) as unknown as Record<string, unknown>
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
            const attachment = await withManager((manager) =>
              manager.getAttachment(mailId, attachmentId)
            )
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
