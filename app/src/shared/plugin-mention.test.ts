import { expect, it } from 'vitest'
import { pluginMentionIds, pluginMentionToken } from './plugin-mention'
import { pluginMentionToken as rendererToken } from '../renderer/src/features/chat/lib/pluginMention'

it('parses plugin mention tokens identically to the renderer token format', () => {
  const ids = ['native', 'native docs', 'quote"\\name', '한글', 'line\nfeed']
  for (const id of ids) expect(rendererToken(id)).toBe(pluginMentionToken(id))
  expect(pluginMentionIds(ids.map(rendererToken).join(' '))).toEqual(ids)
  expect(
    pluginMentionIds('email@example.com prefix@native @native @native @"bad\\q" @"unfinished')
  ).toEqual(['native'])
})
