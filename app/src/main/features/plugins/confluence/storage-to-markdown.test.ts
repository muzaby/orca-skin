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

  // 아래 묶음은 **날 `<img>` 로 들어앉은 첨부** (0168). 0164 이전에는 "참조 0개면 페이지 첨부를
  // 전부 받는" 폴백이 이 구멍을 가렸는데, 354ffc7 이 폴백을 지우면서 미검출 = 0건 다운로드가
  // 됐다(사용자 보고 2026-08-05).
  it('download 경로 img 를 첨부 참조로 인식한다', () => {
    const out = storageToMarkdown(
      '<p><img src="/download/attachments/12345/foo.png?version=1&amp;api=v2" /></p>'
    )
    expect(out.referencedAttachments).toEqual(['foo.png'])
    expect(out.markdown).toContain('![foo.png](assets/foo.png)')
  })

  it('data-linked-resource-default-alias 를 파일명으로 우선한다', () => {
    // 경로 세그먼트가 내부 이름이어도 Confluence 가 함께 싣는 원본 이름이 정확하다.
    const out = storageToMarkdown(
      '<p><img src="/download/attachments/12345/att99.png" ' +
        'data-linked-resource-default-alias="설계도.png" /></p>'
    )
    expect(out.referencedAttachments).toEqual(['설계도.png'])
    expect(out.markdown).toContain('assets/설계도.png')
  })

  it('thumbnails 경로도 첨부 참조다', () => {
    const out = storageToMarkdown('<p><img src="/download/thumbnails/12345/bar.png" /></p>')
    expect(out.referencedAttachments).toEqual(['bar.png'])
  })

  it('인코딩된 파일명을 디코드해 참조로 싣는다', () => {
    // REST 조회는 원본 이름으로 해야 하므로 여기서 풀어 둔다.
    const out = storageToMarkdown(
      '<p><img src="/download/attachments/1/%ED%85%8C%EC%8A%A4%ED%8A%B8.png" /></p>'
    )
    expect(out.referencedAttachments).toEqual(['테스트.png'])
  })

  it('인코딩이 깨진 세그먼트는 원문 그대로 쓴다 — 이름 하나로 페이지를 실패시키지 않는다', () => {
    const out = storageToMarkdown('<p><img src="/download/attachments/1/%E0%A4%A.png" /></p>')
    expect(out.referencedAttachments).toEqual(['%E0%A4%A.png'])
  })

  it('외부 절대 URL img 는 참조가 아니다', () => {
    const out = storageToMarkdown('<p><img src="https://cdn.example.invalid/x.png" /></p>')
    expect(out.referencedAttachments).toEqual([])
    expect(out.markdown).toContain('https://cdn.example.invalid/x.png')
  })

  it('download 경로 밖 host-relative img 는 참조가 아니다', () => {
    // 이모티콘·UI 리소스를 첨부로 오인하면 받지도 못할 이름이 실패 목록에 쌓인다.
    const out = storageToMarkdown('<p><img src="/images/icons/emoticons/smile.png" /></p>')
    expect(out.referencedAttachments).toEqual([])
    expect(out.markdown).toContain('/images/icons/emoticons/smile.png')
  })

  it('같은 첨부를 두 형식이 가리켜도 한 번만 센다', () => {
    // `ac:image` 가 만든 `assets/…` img 를 2차 승격하지 않는 것까지 함께 잠근다.
    const out = storageToMarkdown(
      '<ac:image><ri:attachment ri:filename="dup.png" /></ac:image>' +
        '<p><img src="/download/attachments/1/dup.png" /></p>'
    )
    expect(out.referencedAttachments).toEqual(['dup.png'])
  })

  it('alt 가 없으면 파일명을 쓴다', () => {
    const withAlt = storageToMarkdown(
      '<p><img src="/download/attachments/1/a.png" alt="회로도" /></p>'
    )
    expect(withAlt.markdown).toContain('![회로도](assets/a.png)')
    const without = storageToMarkdown('<p><img src="/download/attachments/1/a.png" alt="" /></p>')
    expect(without.markdown).toContain('![a.png](assets/a.png)')
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

// 0169 — 멘션은 `ri:page` 도 `ri:attachment` 도 아니라 라벨이 빈 문자열이 되고 통째로
// 사라졌다(사용자 보고 2026-08-05). 어느 분기도 빈 값을 돌려주지 않는 것이 이 묶음의 요점이다.
describe('storageToMarkdown — 멘션', () => {
  it('userkey 멘션을 자리표시자로 남기고 키를 모은다', () => {
    const out = storageToMarkdown(
      '<p>담당: <ac:link><ri:user ri:userkey="d3b07384d113edec49eaa6238ad5ff00" /></ac:link></p>'
    )
    expect(out.markdown).toContain('@{{user:d3b07384d113edec49eaa6238ad5ff00}}')
    expect(out.referencedUsers).toEqual(['d3b07384d113edec49eaa6238ad5ff00'])
  })

  it('username 이 있으면 조회 없이 그대로 쓴다', () => {
    const out = storageToMarkdown('<p><ac:link><ri:user ri:username="jsmith" /></ac:link></p>')
    expect(out.markdown).toContain('@jsmith')
    expect(out.referencedUsers).toEqual([])
  })

  it('멘션에 링크 본문이 있으면 그 텍스트를 쓴다', () => {
    const out = storageToMarkdown(
      '<p><ac:link><ri:user ri:userkey="abc" />' +
        '<ac:plain-text-link-body>홍길동 책임</ac:plain-text-link-body></ac:link></p>'
    )
    expect(out.markdown).toContain('홍길동 책임')
    expect(out.markdown).not.toContain('{{user:')
  })

  it('같은 사용자를 여러 번 멘션해도 키는 한 번만 모은다', () => {
    const out = storageToMarkdown(
      '<p><ac:link><ri:user ri:userkey="k1" /></ac:link></p>' +
        '<p><ac:link><ri:user ri:userkey="k1" /></ac:link>' +
        '<ac:link><ri:user ri:userkey="k2" /></ac:link></p>'
    )
    expect(out.referencedUsers).toEqual(['k1', 'k2'])
  })

  it('식별자가 하나도 없는 멘션도 지우지 않는다', () => {
    const out = storageToMarkdown('<p><ac:link><ri:user /></ac:link></p>')
    expect(out.markdown).toContain('@사용자')
  })

  it('페이지·첨부 링크는 종전대로 남는다 — 멘션 분기가 가로채지 않는다', () => {
    const out = storageToMarkdown(
      '<p><ac:link><ri:page ri:content-title="센서 스펙" /></ac:link></p>'
    )
    expect(out.markdown).toContain('센서 스펙')
    expect(out.referencedUsers).toEqual([])
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

  // 아래 세 케이스는 전부 **실제 Confluence 저장 형식** 이다. 위의 축약 fixture 만 있었기 때문에
  // 표가 원본 XML 로 새어 나가는 회귀(사용자 보고 2026-08-04)를 테스트가 잡지 못했다.
  // turndown-plugin-gfm 은 머리글 행이 없는 표를 `keep()` 으로 **HTML 그대로** 내보낸다.
  it('colgroup 이 붙은 표를 변환한다 — Confluence 가 거의 항상 붙인다', () => {
    const out = storageToMarkdown(
      '<table class="wrapped"><colgroup><col /><col /></colgroup><tbody>' +
        '<tr><th><p>항목</p></th><th><p>값</p></th></tr>' +
        '<tr><td><p>센서</p></td><td><p>OK</p></td></tr>' +
        '</tbody></table>'
    )
    expect(out.markdown).toContain('| 항목 | 값 |')
    expect(out.markdown).toContain('| 센서 | OK |')
    // 원본 XML 이 한 조각도 새어 나오지 않아야 한다.
    expect(out.markdown).not.toContain('<table')
    expect(out.markdown).not.toContain('<colgroup')
  })

  it('머리글 행이 없는 표는 첫 행을 머리글로 승격한다', () => {
    const out = storageToMarkdown(
      '<table class="relative-table"><colgroup><col /><col /></colgroup><tbody>' +
        '<tr><td><p>a</p></td><td><p>b</p></td></tr>' +
        '<tr><td><p>c</p></td><td><p>d</p></td></tr>' +
        '</tbody></table>'
    )
    // 승격하지 않으면 표 전체가 HTML 로 남는다 — 첫 행의 의미가 달라지는 쪽이 낫다.
    expect(out.markdown).toContain('| a | b |')
    expect(out.markdown).toContain('| --- | --- |')
    expect(out.markdown).toContain('| c | d |')
    expect(out.markdown).not.toContain('<td>')
  })

  it('셀 안 여러 문단을 <br> 로 잇는다 — 행을 끊지 않는다', () => {
    const out = storageToMarkdown(
      '<table><colgroup><col /></colgroup><tbody>' +
        '<tr><th><p>비고</p></th></tr>' +
        '<tr><td><p>첫 줄</p><p>둘째 줄</p></td></tr>' +
        '</tbody></table>'
    )
    expect(out.markdown).toContain('| 첫 줄<br>둘째 줄 |')
  })

  it('thead 를 쓰는 표도 그대로 변환한다', () => {
    const out = storageToMarkdown(
      '<table><thead><tr><th>h1</th><th>h2</th></tr></thead>' +
        '<tbody><tr><td>v1</td><td>v2</td></tr></tbody></table>'
    )
    expect(out.markdown).toContain('| h1 | h2 |')
    expect(out.markdown).toContain('| v1 | v2 |')
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
