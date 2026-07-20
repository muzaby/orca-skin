import { describe, expect, it } from 'vitest'
import { SSO_MODULE_REGISTRATION } from './index'
import { SSO_MODULE } from '../index'

describe('sso module registry', () => {
  it('registers no SSO module by default (fresh install = no login gate)', () => {
    expect(SSO_MODULE_REGISTRATION).toBeNull()
    expect(SSO_MODULE).toBeNull()
  })
})
