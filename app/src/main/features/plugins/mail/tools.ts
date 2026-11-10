import { z } from 'zod'
import { MAIL_GET_DEFAULT_CHARS, MAIL_GET_MAX_CHARS } from './body-window'
import { joinsRunningSync, normalizeSyncMode, type MailSyncMode } from './sync-mode'
import {
  jsonToolResult as result,
  type RuntimeToolResult,
  type RuntimeToolServer
} from '../../../adapters/common/runtime-tools'
import { authToolServerId } from '../../../adapters/common/runtime-tool-policy'
import { exportMailAttachment } from './attachment-export'
import { createMailSyncManager, type MailSyncManager } from './sync-manager'
import type { MailPluginOptions, MailSyncResult } from './types'
import type { PluginAuth } from '../../../contracts/auth'
import { userDataPath } from '../../../infra/config/user-data-path'
import { createPop3Socket } from '../../../infra/net/pop3-socket'
import { mailSessionConfig } from './auth'
import { publicMailError } from './pop3/errors'
import { Pop3Error } from './pop3/errors'

function errorResult(error: unknown): RuntimeToolResult {
  const normalized = publicMailError(error)
  return result({ error: normalized.code, message: normalized.message }, true)
}

export function mailTools(auth: PluginAuth, options: MailPluginOptions): RuntimeToolServer {
  // 좌표는 `auth.origin` 한 사본에서만 온다 — 옵션에 두 번째 사본이 없으므로 대조하지 않는다.
  // 형식이 깨진 origin 은 여기서 즉시 던져 서버 조립을 막는다.
  const session = mailSessionConfig(auth.origin, options)
  let inFlight:
    | {
        promise: Promise<MailSyncResult>
        controller: AbortController
        owners: number
        mode: MailSyncMode
      }
    | undefined
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
  const sync = (mode: MailSyncMode, signal?: AbortSignal): Promise<MailSyncResult> => {
    if (signal?.aborted) return Promise.reject(new Pop3Error('cancelled'))
    if (inFlight && (inFlight.controller.signal.aborted || !joinsRunningSync(inFlight.mode, mode)))
      return inFlight.promise.catch(() => undefined).then(() => sync(mode, signal))
    if (!inFlight) {
      const controller = new AbortController()
      const flight = {
        controller,
        mode,
        owners: 0,
        promise: undefined as unknown as Promise<MailSyncResult>
      }
      flight.promise = withManager((manager) =>
        manager.sync(controller.signal, undefined, mode)
      ).finally(() => {
        if (inFlight === flight) inFlight = undefined
      })
      inFlight = flight
    }
    const flight = inFlight
    flight.owners++
    return new Promise((resolve, reject) => {
      let settled = false
      const detach = (): boolean => {
        if (settled) return false
        settled = true
        signal?.removeEventListener('abort', abort)
        if (--flight.owners === 0) flight.controller.abort()
        return true
      }
      const abort = (): void => {
        if (detach()) reject(new Pop3Error('cancelled'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      flight.promise.then(
        (value) => {
          if (detach()) resolve(value)
        },
        (error: unknown) => {
          if (detach()) reject(error)
        }
      )
    })
  }

  return {
    descriptor: {
      executionScope: 'application',
      id: authToolServerId(auth.authId),
      connectorId: auth.authId,
      instructions:
        'Call mail_sync before mail_search when the cache may be stale. Synchronization defaults to incremental; use mode full only when the user requests a complete refresh or cached bodies are invalid. After mail_search, use mail_get for more body text and follow nextOffset until null. Use attachmentId values from mail_search or mail_get and call mail_getAttachment one attachment at a time; each attachment requires its own approval.',
      tools: [
        {
          name: 'mail_sync',
          description:
            'Synchronize the local POP3 cache (default mode: incremental). Use full only for a requested complete refresh or invalid cached bodies; full re-fetches retained server mail without deleting missing cached mail. This contacts the mail server.',
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
            'Copy one attachment identified by mailId and attachmentId into Orcinus orca temporary storage.',
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        },
        {
          name: 'mail_get',
          description: `Read cached mail body text in UTF-16 character windows (default ${MAIL_GET_DEFAULT_CHARS}, maximum ${MAIL_GET_MAX_CHARS}). Use after mail_search and follow nextOffset until null to read the complete body. Does not contact the mail server.`,
          annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
        }
      ]
    },
    implementations: [
      {
        name: 'mail_sync',
        inputSchema: { mode: z.enum(['incremental', 'full']).optional() },
        handler: async (input, context) => {
          try {
            const value = await sync(normalizeSyncMode(input.mode), context?.getSignal())
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
      },
      {
        name: 'mail_get',
        inputSchema: {
          mailId: z.string().min(1),
          offset: z.number().int().min(0).optional(),
          maxChars: z.number().int().min(1).max(MAIL_GET_MAX_CHARS).optional()
        },
        handler: async (input) => {
          try {
            const page = await withManager(async (manager) =>
              manager.getMail(
                typeof input.mailId === 'string' ? input.mailId : '',
                typeof input.offset === 'number' ? input.offset : undefined,
                typeof input.maxChars === 'number' ? input.maxChars : undefined
              )
            )
            if (!page) return result({ error: 'mail_not_found' }, true)
            return result(page as unknown as Record<string, unknown>)
          } catch (error) {
            return errorResult(error)
          }
        }
      }
    ]
  }
}
