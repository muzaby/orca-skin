import { useCallback, useEffect, useState } from 'react'
import type { RuntimeStatus } from '../../../../../shared/ipc'
import { runtimeApi } from '../../../shared/api/ipc'

interface UseRuntimeReturn {
  status: RuntimeStatus
  // 진행 로그 누적 (preparing 단계의 stdout/stderr 청크).
  log: string
  // 실패 후 재시도 또는 수동 준비 트리거.
  prepare: () => Promise<void>
}

// Python 런타임(uv 격리 인터프리터) 상태 구독 + 재시도 트리거.
// 마운트 시 현재 상태를 1회 조회하고, 이후 statusEvent 스트림으로 갱신한다.
export function useRuntime(): UseRuntimeReturn {
  const [status, setStatus] = useState<RuntimeStatus>({ stage: 'idle', ready: false })
  const [log, setLog] = useState('')

  useEffect(() => {
    let alive = true
    void runtimeApi.status().then((s) => {
      if (alive) setStatus(s)
    })
    const unsub = runtimeApi.onStatus((s) => {
      setStatus(s)
      // preparing 단계 로그 청크를 누적. stage 전이 라벨도 로그로 합류.
      if (s.log) setLog((prev) => prev + s.log)
      if (s.error) setLog((prev) => `${prev}\n[오류] ${s.error}`)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [])

  const prepare = useCallback(async (): Promise<void> => {
    setLog('')
    await runtimeApi.prepare()
  }, [])

  return { status, log, prepare }
}
