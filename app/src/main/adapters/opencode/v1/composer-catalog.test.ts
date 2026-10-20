import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { expect, it, vi } from 'vitest'
import { openCodeComposerCatalog } from './composer-catalog'
import { jsonResponse } from './adapter.testfixture'

it('reads plugin-resolved primary agents and variants from the live SDK without leaking options', async () => {
  const requests: Request[] = []
  const client = createOpencodeClient({
    baseUrl: 'http://fixture.test',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return new URL(request.url).pathname === '/agent'
        ? jsonResponse([
            {
              name: 'plugin-review',
              mode: 'primary',
              model: { providerID: 'team', modelID: 'fast' },
              variant: 'low',
              options: { secret: 'private' },
              prompt: 'private'
            },
            { name: 'both', mode: 'all' },
            { name: 'child', mode: 'subagent' },
            { name: 'hidden', mode: 'primary', hidden: true }
          ])
        : jsonResponse({
            all: [
              {
                id: 'team',
                key: 'private',
                models: {
                  fast: { id: 'fast', variants: { low: {}, high: { disabled: true } } },
                  plain: { id: 'plain', variants: {} }
                }
              }
            ],
            connected: ['team'],
            default: {}
          })
    }
  })
  expect(await openCodeComposerCatalog(client, 'C:/native-project')).toEqual({
    agents: [{ name: 'plugin-review', model: 'team/fast', variant: 'low' }, { name: 'both' }],
    models: [
      { id: 'team/fast', variants: ['low'] },
      { id: 'team/plain', variants: [] }
    ]
  })
  expect(requests.map((r) => new URL(r.url).searchParams.get('directory'))).toEqual([
    'C:/native-project',
    'C:/native-project'
  ])
})

it('distinguishes a successful empty catalog from an unavailable endpoint', async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse(new URL(new Request(input).url).pathname === '/agent' ? [] : { all: [] })
  )
  const client = createOpencodeClient({ baseUrl: 'http://fixture.test', fetch })
  expect(await openCodeComposerCatalog(client, '/repo')).toEqual({ agents: [], models: [] })
  fetch.mockRejectedValueOnce(new Error('offline'))
  await expect(openCodeComposerCatalog(client, '/repo')).rejects.toThrow()
})
