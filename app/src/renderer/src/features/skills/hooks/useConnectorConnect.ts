// Connector 연결 모달의 진행 상태 (0160). 로직은 `lib/connectorConnect.ts` 가 갖고,
// 여기서는 React 상태 전이만 한다 — 훅은 typecheck 로, 로직은 lib 단위 테스트로 검증한다.

import { useCallback, useState } from 'react'
import { authApi, pluginApi } from '../../../shared/api/ipc'
import type { AuthFieldSpec, PluginConnectorInfo } from '../../../../../shared/ipc'
import {
  beginConnect,
  classifyConnectFailure,
  completeConnect,
  newConnectionId,
  type ConnectApi,
  type ConnectFailure
} from '../lib/connectorConnect'

const api: ConnectApi = {
  begin: (providerId, target) => authApi.begin(providerId, target),
  continueAuth: (transactionId, input) => authApi.continueAuth(transactionId, input),
  connect: (connectorId, bindingId) => pluginApi.connect(connectorId, bindingId)
}

export type ConnectPhase = 'idle' | 'collecting' | 'inflight' | 'done'

interface State {
  phase: ConnectPhase
  providerId: string | null
  transactionId: string | null
  fields: AuthFieldSpec[]
  failure: ConnectFailure | null
  failureMessage: string | null
}

export interface ConnectorConnectController extends State {
  // 인증 방식 선택 → 필드 선언 수신.
  choose(providerId: string): Promise<void>
  // 자격증명 제출 → binding 생성 → connector 연결. 성공하면 true.
  submit(input: Record<string, string>): Promise<boolean>
  reset(): void
}

const INITIAL: State = {
  phase: 'idle',
  providerId: null,
  transactionId: null,
  fields: [],
  failure: null,
  failureMessage: null
}

function failureState(providerId: string | null, error: unknown): State {
  return {
    ...INITIAL,
    providerId,
    failure: classifyConnectFailure(error),
    failureMessage: error instanceof Error ? error.message : null
  }
}

export function useConnectorConnect(
  connector: PluginConnectorInfo,
  onConnected: () => void
): ConnectorConnectController {
  const [state, setState] = useState<State>(INITIAL)
  // 모달을 열 때마다 새 연결 ID 를 만든다 — 중도 취소한 transaction 이
  // `(providerId, target)` 당 1건 제한에 걸리지 않게 한다.
  const [connectionId, setConnectionId] = useState(newConnectionId)

  const reset = useCallback(() => {
    setState(INITIAL)
    setConnectionId(newConnectionId())
  }, [])

  const choose = useCallback(
    async (providerId: string): Promise<void> => {
      setState({ ...INITIAL, phase: 'inflight', providerId })
      try {
        const begun = await beginConnect(api, providerId, connector.connectorId, connectionId)

        if (begun.kind === 'collect') {
          setState({
            ...INITIAL,
            phase: 'collecting',
            providerId,
            transactionId: begun.transactionId ?? null,
            fields: begun.fields ?? []
          })
          return
        }
        if (begun.kind === 'done' && begun.bindingId !== undefined) {
          // 입력 없이 끝나는 provider(브라우저 세션 등) — 곧바로 연결한다.
          await pluginApi.connect(connector.connectorId, begun.bindingId)
          setState({ ...INITIAL, phase: 'done', providerId })
          onConnected()
          return
        }
        setState({
          ...INITIAL,
          providerId,
          failure: 'invalid_credentials',
          failureMessage: begun.message ?? null
        })
      } catch (error) {
        setState(failureState(providerId, error))
      }
    },
    [connector.connectorId, connectionId, onConnected]
  )

  const submit = useCallback(
    async (input: Record<string, string>): Promise<boolean> => {
      const { transactionId, providerId } = state
      if (transactionId === null) return false

      setState((prev) => ({ ...prev, phase: 'inflight', failure: null, failureMessage: null }))
      try {
        const result = await completeConnect(api, connector.connectorId, transactionId, input)
        if (result.ok) {
          setState({ ...INITIAL, phase: 'done', providerId })
          onConnected()
          return true
        }
        // 실패해도 transaction 은 소모됐다 — 방식 선택부터 다시 하도록 필드를 비운다.
        setState({
          ...INITIAL,
          providerId,
          failure: result.failure,
          failureMessage: result.message ?? null
        })
        return false
      } catch (error) {
        setState(failureState(providerId, error))
        return false
      }
    },
    [connector.connectorId, onConnected, state]
  )

  return { ...state, choose, submit, reset }
}
