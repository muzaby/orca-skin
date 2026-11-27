const marker = '**완료**'
export function fixture(input) {
  if (input === 'B1') return '가나다 라마바 '.repeat(210000) + marker
  if (input === 'B2') {
    const wide = (s) => '|' + Array(600).fill(s).join('|') + '|\n'
    const body = [
      'p'.repeat(200) + '\n\n',
      '\n```ts\nlet n = 1\n```\n'.repeat(40),
      '|a|b|\n|-|-|\n' + '|c|d|\n'.repeat(2001),
      wide('a') + wide('-') + wide('b'),
      '- Item\n'.repeat(30000),
      'Note[^1]\n\n[^1]: footnote'
    ]
    body[0] = body[0].repeat(3000)
    const content = body.join('\n\n')
    return (
      content +
      '\n\n' +
      'x'.repeat(Math.max(0, 1024 * 1024 - content.length - marker.length - 4)) +
      '\n\n' +
      marker
    )
  }
  if (input === 'B3') return 'stream '.repeat(7200) + marker
  if (input === 'B4') return '`code` [link](https://example.org) '.repeat(12500) + marker
  if (input === 'B5')
    return (
      ('a '.repeat(8190) + '\n\n').repeat(2442).slice(0, 40000000 - marker.length - 2) +
      '\n\n' +
      marker
    )
  throw Error('Unknown input')
}

export const inputs = ['B1', 'B2', 'B3', 'B4', 'B5']
export const screens = ['claude-code', 'opencode-code']

// Locked §21-C corpus. An accidental fixture edit cannot change its own acceptance oracle.
export const bodyCorpora = {
  B1: {
    characters: 1680006,
    utf8Bytes: 4200010,
    bytes: 4200037,
    fixtureSha: '8003c5cb3a8b906f48c149fc4030f89b5988fa91a257d3bc59ee56eacc77d9a5'
  },
  B2: {
    characters: 1048576,
    utf8Bytes: 1048580,
    bytes: 1086789,
    fixtureSha: '6d931a9706ff708c6e067f2dd2ef41f8d7bd3c4a8934ea6dbcef63b6c2f1a43e'
  },
  B3: {
    characters: 50406,
    utf8Bytes: 50410,
    bytes: 50437,
    fixtureSha: 'add50904e2be0b6c2e6629d3ff3b47ffbea74249c2da6ad0e75575aeb1b7d10a'
  },
  B4: {
    characters: 437506,
    utf8Bytes: 437510,
    bytes: 437537,
    fixtureSha: 'af2c6f0d8ec9b84969c97c214b47497d00071fa6c84b24a26c636d74dc0cc396'
  },
  B5: {
    characters: 40000000,
    utf8Bytes: 40000004,
    bytes: 40004915,
    fixtureSha: '9a600ac2b684702093be61b119348815bed80d7de9d63a561b0aa26d24ebd817'
  }
}
