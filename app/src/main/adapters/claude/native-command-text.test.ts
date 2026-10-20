import { describe, expect, it } from 'vitest'
import { nativeCommandText } from './native-command-text'

const envelope = (args?: string): string =>
  '<command-message>superpowers:using-superpowers</command-message>\n' +
  '<command-name>/superpowers:using-superpowers</command-name>' +
  (args === undefined ? '' : `\n<command-args>${args}</command-args>`)

describe('nativeCommandText', () => {
  it.each([undefined, '', '이 스킬이?', '첫 줄\n  <sample>x & y</sample>\n마지막 줄'])(
    'restores the slash command and preserves arguments %j',
    (args) => {
      expect(nativeCommandText(envelope(args))).toBe(
        '/superpowers:using-superpowers' + (args ? ` ${args}` : '')
      )
    }
  )
  it.each([
    '이 XML을 설명해: ' + envelope('args'),
    '```xml\n' + envelope('args') + '\n```',
    '<system-reminder>사용자 입력</system-reminder>',
    '<command-name>/sample</command-name>',
    envelope('args').replace('</command-args>', ''),
    envelope('args').replace('/superpowers:using-superpowers', '/other:command'),
    envelope('args') + '\n본문'
  ])('preserves ordinary, quoted and incomplete XML %j', (text) => {
    expect(nativeCommandText(text)).toBe(text)
  })
})
