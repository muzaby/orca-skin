import { expect, it } from 'vitest'
import { ComposerCatalogError } from './composer-catalog-error'

it('retains only allowlisted stage, reason and HTTP status from hostile diagnostics', () => {
  const error = new Error('C:/private/settings.json secret-token', {
    cause: { status: 503, body: 'SECRET', headers: { authorization: 'SECRET' } }
  })
  expect(new ComposerCatalogError('plugins', error).failure).toEqual({
    stage: 'plugins',
    reason: 'http',
    httpStatus: 503
  })
  expect(JSON.stringify(new ComposerCatalogError('plugins', error))).not.toMatch(
    /SECRET|private|secret-token/
  )
  expect(
    new ComposerCatalogError('acquire', new DOMException('SECRET', 'TimeoutError')).failure.reason
  ).toBe('timeout')
  expect(
    new ComposerCatalogError('mcp', new DOMException('SECRET', 'AbortError')).failure.reason
  ).toBe('aborted')
  expect(
    new ComposerCatalogError('agents', { cause: { code: 'ECONNREFUSED' } }).failure.reason
  ).toBe('network')
  expect(
    new ComposerCatalogError('configuration', { status: '500 SECRET', code: 'SECRET' }).failure
  ).toEqual({ stage: 'configuration', reason: 'unavailable' })
})
