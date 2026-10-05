import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { Options, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { PRODUCT_SLUG } from '../../shared/product'
import type { ExtractedAttachmentImage, ExtractedAttachmentText, TurnRequest } from './turn'

const { queryMock, setModel } = vi.hoisted(() => {
  const setModel = vi.fn<(model?: string) => Promise<void>>(async () => undefined)
  return {
    setModel,
    queryMock: vi.fn((args: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => {
      void args
      return {
        [Symbol.asyncIterator](): AsyncIterator<never> {
          return { next: async () => ({ done: true, value: undefined as never }) }
        },
        setModel,
        setPermissionMode: vi.fn(async () => {}),
        close: vi.fn()
      }
    })
  }
})
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'

const gateway = { ANTHROPIC_BASE_URL: 'https://llm.example.test' }
const base = (overrides: Partial<TurnRequest> = {}): TurnRequest => ({
  sessionId: null,
  text: 'initial',
  cwd: process.cwd(),
  env: {},
  extensions: { skills: [], hooks: { normalized: {} } },
  ...overrides
})
const textAttachment = (path: string): ExtractedAttachmentText => ({
  id: path,
  name: 'reference.md',
  mimeType: 'text/markdown',
  sourceKind: 'dialog',
  path
})
const image: ExtractedAttachmentImage = {
  id: 'image',
  name: 'screen.png',
  mimeType: 'image/png',
  sourceKind: 'clipboard',
  data: 'QUJD'
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

describe('0245 AC3 — all three execution model sites and model changes', () => {
  it('normalizes the spawn model without changing env, settings or the request identity', () => {
    const env = Object.freeze({ ...gateway, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '123456' })
    const req = base({ model: 'gw-opus-4.7', env })
    const live = new ClaudeAdapter().sendMessage(req)
    const options = queryMock.mock.calls[0][0].options
    expect(options.model).toBe('gw-opus-4.7[1m]')
    expect(options.env).toMatchObject(env)
    expect(options.env).not.toHaveProperty('CLAUDE_CODE_MAX_CONTEXT_TOKENS')
    expect(req.model).toBe('gw-opus-4.7')
    expect(env).toEqual({ ...gateway, CLAUDE_CODE_AUTO_COMPACT_WINDOW: '123456' })
    live.close()
  })

  it('resolves a different alias on every pushTurn before submitting the next content', async () => {
    const env = {
      ...gateway,
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'gw-opus-4.7',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'internal-llm'
    }
    const live = new ClaudeAdapter().sendMessage(base({ model: 'sonnet', env }))
    expect(queryMock.mock.calls[0][0].options.model).toBe('sonnet')
    await live.pushTurn!({ text: 'next', model: 'opus' })
    await live.pushTurn!({ text: 'back', model: 'sonnet' })
    expect(setModel.mock.calls).toEqual([['opus[1m]'], ['sonnet']])
    live.close()
  })

  it('resolves a different model for every LiveTurn.setModel control call', async () => {
    const live = new ClaudeAdapter().sendMessage(base({ model: 'internal-llm', env: gateway }))
    await live.setModel('gw-opus-4.7')
    await live.setModel('claude-opus-4-6')
    await live.setModel('gw-fable-5')
    expect(setModel.mock.calls).toEqual([
      ['gw-opus-4.7[1m]'],
      ['claude-opus-4-6'],
      ['gw-fable-5[1m]']
    ])
    live.close()
  })

  it('passes settings env and settings model into the same resolver at spawn and transition (EP-08)', async () => {
    const settings = {
      model: 'gw-fable-5',
      env: { ...gateway, ANTHROPIC_DEFAULT_OPUS_MODEL: 'gw-opus-4.7' }
    }
    const live = new ClaudeAdapter().sendMessage(
      base({
        env: undefined,
        providerSettings: {
          providerKey: 'test',
          provider: 'test',
          sourceRevision: 'test',
          settings
        }
      })
    )
    expect(queryMock.mock.calls[0][0].options.model).toBe('gw-fable-5[1m]')
    await live.setModel('opus')
    expect(setModel).toHaveBeenLastCalledWith('opus[1m]')
    expect(settings).toEqual({
      model: 'gw-fable-5',
      env: { ...gateway, ANTHROPIC_DEFAULT_OPUS_MODEL: 'gw-opus-4.7' }
    })
    live.close()
  })

  it('uses ANTHROPIC_MODEL from the prepared env before settings model (AC20)', () => {
    const live = new ClaudeAdapter().sendMessage(
      base({
        env: { ...gateway, ANTHROPIC_MODEL: 'gw-opus-4.7' },
        providerSettings: {
          providerKey: 'test',
          provider: 'test',
          sourceRevision: 'test',
          settings: { model: 'internal-llm' }
        }
      })
    )
    expect(queryMock.mock.calls[0][0].options.model).toBe('gw-opus-4.7[1m]')
    live.close()
  })

  it('preserves default-model delegation and injects no compact/window override', () => {
    const live = new ClaudeAdapter().sendMessage(base())
    const options = queryMock.mock.calls[0][0].options
    expect(options).not.toHaveProperty('model')
    expect(options.env).not.toHaveProperty('CLAUDE_CODE_AUTO_COMPACT_WINDOW')
    expect(options.env).not.toHaveProperty('CLAUDE_CODE_MAX_CONTEXT_TOKENS')
    live.close()
  })
})

describe('0245 AC21 — three actual query input paths', () => {
  for (const path of ['initial', 'prelude', 'pushTurn'] as const) {
    it(`${path} delegates text to CLI mentions after original image blocks`, async () => {
      const attachments = {
        text: path,
        attachmentTexts: [
          textAttachment('C:/Temp/Orca/first reference.md'),
          textAttachment('C:/Temp/Orca/second.txt')
        ],
        attachmentImages: [image]
      }
      const req = base({
        ...(path === 'initial' ? attachments : {}),
        ...(path === 'prelude'
          ? { preludes: [{ ...attachments, ids: ['prelude'], uuid: 'prelude', createdAt: 1 }] }
          : {})
      })
      const live = new ClaudeAdapter().sendMessage(req)
      const args = queryMock.mock.calls[0][0]
      const input = args.prompt[Symbol.asyncIterator]()
      if (path === 'pushTurn') await input.next()
      if (path === 'pushTurn')
        expect(await live.pushTurn!(attachments)).toEqual({ kind: 'accepted' })
      const message = (await input.next()).value as SDKUserMessage
      expect(message.message.content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
        {
          type: 'text',
          text: `${path}\n\n@"C:/Temp/Orca/first reference.md"\n@"C:/Temp/Orca/second.txt"`
        }
      ])
      expect(args.options.additionalDirectories).toContain(resolve(tmpdir(), PRODUCT_SLUG))
      live.close()
    })
  }
})
