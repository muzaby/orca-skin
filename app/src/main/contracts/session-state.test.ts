import { describe, expect, it } from 'vitest'
import { SessionRuntimeStatus } from './session-state'

describe('SessionRuntimeStatus', () => {
  it('keeps abort cause separate from coarse state', () => {
    const st = new SessionRuntimeStatus()
    expect(st.state).toBe('cold')
    st.beginSend()
    expect(st.state).toBe('busy')
    st.markInterrupting('user_cancelled')
    expect(st.state).toBe('interrupting')
    expect(st.cancelled).toBe(true)
    expect(st.timedOut).toBe(false)
    st.beginSend()
    st.markInterrupting('stall')
    expect(st.timedOut).toBe(true)
  })
})
