import { describe, expect, it } from 'vitest'
import { selectMailBody } from './body-selection'

describe('mail archive body selection', () => {
  it('converts inert HTML while keeping block, list, and table boundaries', () => {
    const selected = selectMailBody({
      html: [
        '<html><head><title>hidden title</title><style>.secret{display:none}</style></head><body>',
        '<script>document.body.innerText="SCRIPT-SENTINEL"</script>',
        '<div hidden>HIDDEN-SENTINEL</div><p>이전 일정 &amp; 승인</p>',
        '<ul><li>첫 번째</li><li>두 번째</li></ul>',
        '<table><tr><td>담당</td><td>완료</td></tr></table>',
        '<div style="display:none">CSS-HIDDEN-SENTINEL</div>',
        '<img src="https://example.test/pixel" onerror="alert(1)">',
        '</body></html>'
      ].join('')
    })

    expect(selected.bodyKind).toBe('html')
    expect(selected.bodyText).toContain('이전 일정 & 승인')
    expect(selected.bodyText).toContain('• 첫 번째')
    expect(selected.bodyText).toContain('• 두 번째')
    expect(selected.bodyText).toContain('담당')
    expect(selected.bodyText).toContain('완료')
    expect(selected.bodyText).not.toMatch(
      /hidden title|SCRIPT-SENTINEL|HIDDEN-SENTINEL|CSS-HIDDEN-SENTINEL/
    )
    expect(selected.bodyQualityFlags).toContain('html_converted')
    expect(selected.bodyQualityFlags).not.toContain('decode_suspect')
  })

  it('keeps plain as the searchable body and exposes differing HTML as an alternate', () => {
    const selected = selectMailBody({
      plainText: '서버 이전을 3월 2일로 제안합니다.',
      html: '<p>서버 이전을 3월 4일로 제안합니다.</p>'
    })

    expect(selected).toMatchObject({
      bodyText: '서버 이전을 3월 2일로 제안합니다.',
      bodyKind: 'plain',
      bodyAlternateText: '서버 이전을 3월 4일로 제안합니다.',
      bodyAlternateKind: 'html',
      bodyAlternateOmitted: false,
      bodySelectionReason: 'plain_preferred'
    })
    expect(selected.bodyQualityFlags).toContain('alternative_mismatch')
    expect(selected.bodyQualityFlags).toContain('html_converted')
  })

  it('does not create an alternate when plain and converted HTML differ only in whitespace', () => {
    const selected = selectMailBody({
      plainText: '서버 이전\n승인 완료',
      html: '<p>서버 이전</p><p>승인 완료</p>'
    })

    expect(selected.bodyText).toBe('서버 이전\n승인 완료')
    expect(selected.bodyAlternateText).toBeNull()
    expect(selected.bodyQualityFlags).not.toContain('alternative_mismatch')
  })

  it('preserves case-sensitive identifier changes between body alternatives', () => {
    const selected = selectMailBody({
      plainText: '문서번호 ABC-12',
      html: '<p>문서번호 abc-12</p>'
    })

    expect(selected.bodyAlternateText).toBe('문서번호 abc-12')
    expect(selected.bodyQualityFlags).toContain('alternative_mismatch')
  })

  it('preserves readable block boundaries in HTML-only mail', () => {
    const selected = selectMailBody({ html: '<p>첫 문단</p><p>둘째 문단</p>' })

    expect(selected.bodyText).toBe('첫 문단\n\n둘째 문단')
    expect(selected.bodySelectionReason).toBe('html_only')
  })

  it('keeps a lone plain body even when it looks like an HTML placeholder', () => {
    const selected = selectMailBody({ plainText: 'This message is best viewed in HTML.' })

    expect(selected).toMatchObject({ bodyKind: 'plain', bodySelectionReason: 'plain_preferred' })
  })

  it('uses HTML when plain is only a confirmed placeholder or replacement characters', () => {
    const placeholder = selectMailBody({
      plainText: 'This message is best viewed in HTML.',
      html: '<p>업무 내용을 확인해 주세요.</p>'
    })
    const broken = selectMailBody({
      plainText: '\uFFFD\uFFFD',
      html: '<p>복구 가능한 한글 본문</p>'
    })

    expect(placeholder).toMatchObject({
      bodyText: '업무 내용을 확인해 주세요.',
      bodyKind: 'html',
      bodySelectionReason: 'plain_placeholder_fallback'
    })
    expect(broken).toMatchObject({
      bodyText: '복구 가능한 한글 본문',
      bodyKind: 'html',
      bodySelectionReason: 'plain_unusable_fallback'
    })
    expect(broken.bodyQualityFlags).not.toContain('decode_suspect')
  })

  it('flags likely mojibake without treating normal English or code as suspect', () => {
    const suspect = selectMailBody({ plainText: 'FranÃ§ais �' })
    const normal = selectMailBody({ plainText: 'Hello, world! const status = "ready";' })

    expect(suspect.bodyQualityFlags).toContain('decode_suspect')
    expect(normal.bodyQualityFlags).not.toContain('decode_suspect')
    expect(normal.bodyText).toBe('Hello, world! const status = "ready";')
  })

  it('omits an over-limit body explicitly instead of silently truncating it', () => {
    const oversizedText = '가'.repeat(700_000)
    const selected = selectMailBody({ plainText: oversizedText })

    expect(selected.bodyText).toBe('')
    expect(selected.bodyKind).toBe('plain')
    expect(selected.bodySelectionReason).toBe('oversized')
    expect(selected.bodyQualityFlags).toContain('oversized')
  })

  it('omits an oversized alternate while preserving the selected searchable body', () => {
    const selected = selectMailBody({
      plainText: '승인 여부를 확인하세요.',
      html: `<p>${'x'.repeat(2 * 1024 * 1024)}</p>`
    })

    expect(selected.bodyText).toBe('승인 여부를 확인하세요.')
    expect(selected.bodyAlternateText).toBeNull()
    expect(selected.bodyAlternateKind).toBeNull()
    expect(selected.bodyAlternateOmitted).toBe(true)
    expect(selected.bodyQualityFlags).toContain('alternative_mismatch')
    expect(selected.bodyQualityFlags).toContain('oversized')
  })
})
