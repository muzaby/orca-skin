import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { nativeOpenCodeData, nativeOpenCodeEnvironment } from './native-storage'

describe('OpenCode native environment', () => {
  it('preserves native storage paths while applying only runtime configuration', () => {
    const base = {
      HOME: '/native-home',
      USERPROFILE: '/native-profile',
      XDG_CONFIG_HOME: '/native-config',
      OPENCODE_DB: '/native.db'
    }
    const env = nativeOpenCodeEnvironment(
      { model: 'fixture/body' },
      { XDG_DATA_HOME: 'relative-data' },
      base
    )
    expect(env).toMatchObject({ ...base, XDG_DATA_HOME: 'relative-data' })
    expect(JSON.parse(env.OPENCODE_CONFIG_CONTENT!)).toEqual({
      model: 'fixture/body',
      share: 'disabled'
    })
    expect(base).not.toHaveProperty('OPENCODE_CONFIG_CONTENT')
  })
  it('resolves relative XDG exactly against the spawned native working directory', () => {
    expect(nativeOpenCodeData({ XDG_DATA_HOME: 'relative-data' }, '/workspace')).toBe(
      resolve('/workspace', 'relative-data', 'opencode')
    )
  })
})
