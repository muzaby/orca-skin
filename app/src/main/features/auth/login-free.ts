// 로그인 프리 포트에는 store·vault·change callback이 없다. 요청 실패는 상태를 바꾸지 않는다.
import type { LoginFreeDefinition, LoginFreePluginAuth } from '../../contracts/auth'
import type { AuthenticatedFetchDeps, PreparedRequest } from '../../infra/net/transport'
import { ifPresent } from '../../../shared/obj'
import { AuthPolicyError } from './auth-policy-error'
import { checkLoginFreeRequest } from './policy'
import { followRedirects, toAuthenticatedResponse, withQuery } from './request-chain'

interface LoginFreeDeps {
  sender: AuthenticatedFetchDeps
  logger?: (event: string, data: Record<string, unknown>) => void
}

export function createLoginFreePluginAuth(
  definition: LoginFreeDefinition,
  deps: LoginFreeDeps
): LoginFreePluginAuth {
  return {
    authId: definition.id,
    label: definition.label,
    ...ifPresent('origin', definition.origin),
    snapshot: () => ({
      authId: definition.id,
      status: 'valid',
      verified: true,
      credentialRevision: 0
    }),
    async request(req, signal) {
      if (definition.origin === undefined) {
        throw new AuthPolicyError('origin_not_declared', definition.id)
      }
      if (!/^https?:\/\//.test(definition.origin)) {
        throw new Error('HTTP request requires an HTTP origin')
      }
      const url = withQuery(new URL(req.path, `${definition.origin}/`), req.query)
      const verdict = checkLoginFreeRequest({
        url,
        path: req.path,
        allowedOrigins: [definition.origin]
      })
      if (!verdict.ok) {
        deps.logger?.('auth.request.blocked', { authId: definition.id, reason: verdict.reason })
        throw new AuthPolicyError(verdict.reason, verdict.detail)
      }
      // 헤더를 그대로 복사한다. 앱 자격증명·쿠키의 주입이나 presentation은 없다.
      const prepared: PreparedRequest = {
        url,
        method: req.method ?? 'GET',
        headers: { ...req.headers },
        ...ifPresent('body', req.body)
      }
      return toAuthenticatedResponse(
        await followRedirects({
          prepared,
          options: {
            ...ifPresent('responseType', req.responseType),
            ...ifPresent('maxBytes', req.maxBytes)
          },
          allowedOrigins: [definition.origin],
          transport: (request, options) => deps.sender.send(request, signal, options),
          onBlocked: () => deps.logger?.('auth.request.redirect-blocked', { authId: definition.id })
        })
      )
    }
  }
}
