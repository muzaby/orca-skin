// storage XHTML → Markdown 변환 (0160). 이 모듈이 이번 작업의 핵심 산출물이라 케이스가 많다.
// 전부 문자열 in/out — 네트워크·fs 를 타지 않는다.

import { describe, expect, it } from 'vitest'
import { storageToMarkdown } from './storage-to-markdown'

describe('storageToMarkdown — 이미지', () => {
  it('ac:image 를 assets 상대 경로 img 로 바꾼다', () => {
    const out = storageToMarkdown(
      '<p>before</p><ac:image ac:alt="도면"><ri:attachment ri:filename="diagram.png" /></ac:image>'
    )
    expect(out.markdown).toContain('![도면](assets/diagram.png)')
    expect(out.referencedAttachments).toEqual(['diagram.png'])
  })

  it('참조된 첨부 이름을 수집한다 — 중복은 한 번만', () => {
    const out = storageToMarkdown(
      '<ac:image><ri:attachment ri:filename="a.png" /></ac:image>' +
        '<ac:image><ri:attachment ri:filename="b.png" /></ac:image>' +
        '<ac:image><ri:attachment ri:filename="a.png" /></ac:image>'
    )
    expect(out.referencedAttachments).toEqual(['a.png', 'b.png'])
  })

  it('외부 URL 이미지는 다운로드 대상이 아니다', () => {
    const out = storageToMarkdown(
      '<ac:image><ri:url ri:value="https://cdn.example.invalid/x.png" /></ac:image>'
    )
    expect(out.markdown).toContain('https://cdn.example.invalid/x.png')
    expect(out.referencedAttachments).toEqual([])
  })

  it('첨부 이름을 파일명 위생 규칙에 맞춰 링크한다', () => {
    // 원격이 준 이름이 경로를 품고 있어도 링크는 루트 안을 가리킨다.
    const out = storageToMarkdown(
      '<ac:image><ri:attachment ri:filename="../../etc/passwd" /></ac:image>'
    )
    expect(out.markdown).toContain('assets/__.._etc_passwd')
    // 다운로드 대상 목록에는 원본 이름이 남는다 — REST 조회는 원본 이름으로 해야 한다.
    expect(out.referencedAttachments).toEqual(['../../etc/passwd'])
  })
})

describe('storageToMarkdown — 매크로', () => {
  it('code 매크로를 언어 코드펜스로 변환한다', () => {
    const out = storageToMarkdown(
      '<ac:structured-macro ac:name="code">' +
        '<ac:parameter ac:name="language">python</ac:parameter>' +
        '<ac:plain-text-body>print("hi")</ac:plain-text-body>' +
        '</ac:structured-macro>'
    )
    expect(out.markdown).toContain('```python')
    expect(out.markdown).toContain('print("hi")')
    expect(out.unhandledMacros).toEqual([])
  })

  it('언어 파라미터가 없는 code 매크로도 코드펜스가 된다', () => {
    const out = storageToMarkdown(
      '<ac:structured-macro ac:name="code"><ac:plain-text-body>x=1</ac:plain-text-body></ac:structured-macro>'
    )
    expect(out.markdown).toContain('```')
    expect(out.markdown).toContain('x=1')
  })

  it('info/note/warning/tip 을 인용블록으로 변환한다', () => {
    for (const name of ['info', 'note', 'warning', 'tip']) {
      const out = storageToMarkdown(
        `<ac:structured-macro ac:name="${name}"><ac:rich-text-body><p>본문</p></ac:rich-text-body></ac:structured-macro>`
      )
      expect(out.markdown).toContain(`> **${name.toUpperCase()}**`)
      expect(out.markdown).toContain('본문')
      expect(out.unhandledMacros).toEqual([])
    }
  })

  it('미지원 매크로를 이름이 보이는 블록으로 남긴다', () => {
    const out = storageToMarkdown(
      '<ac:structured-macro ac:name="jira"><ac:rich-text-body><p>이슈 목록</p></ac:rich-text-body></ac:structured-macro>'
    )
    // 조용히 사라지지 않는다 — 무엇이 빠졌는지 사람이 본문에서 볼 수 있다.
    expect(out.markdown).toContain('macro: jira')
    expect(out.markdown).toContain('이슈 목록')
  })

  it('미지원 매크로 이름을 집계한다', () => {
    const out = storageToMarkdown(
      '<ac:structured-macro ac:name="jira" /><ac:structured-macro ac:name="toc" /><ac:structured-macro ac:name="jira" />'
    )
    expect(out.unhandledMacros.sort()).toEqual(['jira', 'toc'])
  })

  it('본문 컨테이너 태그를 내용으로 펼친다', () => {
    const out = storageToMarkdown(
      '<ac:layout><ac:layout-section><ac:layout-cell><p>셀 본문</p></ac:layout-cell></ac:layout-section></ac:layout>'
    )
    expect(out.markdown).toBe('셀 본문')
  })
})

describe('storageToMarkdown — GFM', () => {
  it('표를 GFM 표로 변환한다', () => {
    const out = storageToMarkdown(
      '<table><tbody>' +
        '<tr><th>이름</th><th>값</th></tr>' +
        '<tr><td>a</td><td>1</td></tr>' +
        '</tbody></table>'
    )
    expect(out.markdown).toContain('| 이름 | 값 |')
    expect(out.markdown).toContain('| a | 1 |')
  })

  it('취소선을 GFM 물결 문법으로 변환한다', () => {
    const out = storageToMarkdown('<p><s>지움</s></p>')
    // turndown-plugin-gfm 은 물결 **한 개**를 낸다(실측). GFM 은 `~x~`·`~~x~~` 를 모두 받는다.
    expect(out.markdown).toBe('~지움~')
  })

  it('제목·목록·강조를 변환한다', () => {
    const out = storageToMarkdown(
      '<h1>제목</h1><ul><li>하나</li><li>둘</li></ul><p><strong>굵게</strong></p>'
    )
    expect(out.markdown).toContain('# 제목')
    // turndown 은 항목 뒤 공백을 3칸으로 낸다 — 개수에 기대지 않고 구조만 본다.
    expect(out.markdown).toMatch(/^-\s+하나$/m)
    expect(out.markdown).toMatch(/^-\s+둘$/m)
    expect(out.markdown).toContain('**굵게**')
  })
})

describe('storageToMarkdown — 링크', () => {
  it('내부 페이지 링크를 제목 텍스트로 남긴다', () => {
    const out = storageToMarkdown('<ac:link><ri:page ri:content-title="설계 문서" /></ac:link>')
    // baseUrl·공간 키가 본문에 없어 URL 을 만들 수 없다 — 제목이라도 남긴다.
    expect(out.markdown).toContain('설계 문서')
  })

  it('링크 본문이 있으면 그것을 쓴다', () => {
    const out = storageToMarkdown(
      '<ac:link><ri:page ri:content-title="원제목" /><ac:plain-text-link-body>표시명</ac:plain-text-link-body></ac:link>'
    )
    expect(out.markdown).toContain('표시명')
  })

  it('일반 앵커는 Markdown 링크가 된다', () => {
    const out = storageToMarkdown('<p><a href="https://x.invalid/y">링크</a></p>')
    expect(out.markdown).toContain('[링크](https://x.invalid/y)')
  })
})

describe('storageToMarkdown — 견고성', () => {
  it('빈 본문은 빈 Markdown 을 준다', () => {
    const out = storageToMarkdown('')
    expect(out.markdown).toBe('')
    expect(out.referencedAttachments).toEqual([])
    expect(out.unhandledMacros).toEqual([])
  })

  it('xmlMode 로 파싱해 self-closing 네임스페이스 태그를 올바로 읽는다', () => {
    // HTML 파서였다면 <ri:attachment/> 가 컨테이너로 해석되어 뒤 문단을 삼킨다.
    const out = storageToMarkdown(
      '<ac:image><ri:attachment ri:filename="a.png" /></ac:image><p>뒤 문단</p>'
    )
    expect(out.referencedAttachments).toEqual(['a.png'])
    expect(out.markdown).toContain('뒤 문단')
  })

  it('중첩 매크로도 안쪽 내용을 잃지 않는다', () => {
    const out = storageToMarkdown(
      '<ac:structured-macro ac:name="expand"><ac:rich-text-body>' +
        '<ac:structured-macro ac:name="code"><ac:plain-text-body>inner</ac:plain-text-body></ac:structured-macro>' +
        '</ac:rich-text-body></ac:structured-macro>'
    )
    expect(out.markdown).toContain('inner')
    expect(out.unhandledMacros).toContain('expand')
  })
})
