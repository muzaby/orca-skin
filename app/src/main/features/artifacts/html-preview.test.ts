import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { artifactPreview } from './formats'
import { staticArtifactHtml } from './html-preview'

describe('static artifact HTML preview', () => {
  it('preserves the complete document presentation while keeping the original source separate', () => {
    const source =
      '<!doctype html><html lang="ko" dir="ltr" class="report" style="background:#123456"><head><title>원문</title><style>.report .paper { color: red }</style></head><body class="paper" style="margin:32px;display:grid"><h1>한글</h1></body></html>'
    const preview = artifactPreview('report.html', Buffer.from(source))
    expect(preview).toMatchObject({ state: 'ready', content: source })
    if (preview.state !== 'ready') throw new Error('preview unavailable')
    expect(preview.previewContent).toBeDefined()
    const $ = load(preview.previewContent!)
    expect($('html').attr()).toMatchObject({
      lang: 'ko',
      dir: 'ltr',
      class: 'report',
      style: 'background:#123456'
    })
    expect($('body').attr()).toMatchObject({ class: 'paper', style: 'margin:32px;display:grid' })
    expect($('style').last().text()).toBe('.report .paper { color: red }')
    expect($('title').text()).toBe('원문')
  })
  it('places document canvas defaults after CSP and before authored styles without overriding source', () => {
    const source =
      '<html style="background:navy;color:yellow"><head><style>html { background:ivory; color:maroon }</style></head><body>Document</body></html>'
    const preview = artifactPreview('report.html', Buffer.from(source))
    expect(preview).toMatchObject({ state: 'ready', content: source })
    if (preview.state !== 'ready') throw new Error('preview unavailable')
    const $ = load(preview.previewContent!)
    const children = $('head').children()
    expect(children.eq(0).attr('http-equiv')).toBe('Content-Security-Policy')
    expect(children.eq(1).is('style')).toBe(true)
    expect(children.eq(1).text()).toBe('html { color-scheme: light; color: black }')
    expect(children.eq(2).text()).toBe('html { background:ivory; color:maroon }')
    expect($('html').attr('style')).toBe('background:navy;color:yellow')
  })
  it('parses hostile full documents without fetching and removes executable, navigation and resource markup', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network'))
    try {
      const html = staticArtifactHtml(`<!doctype html><html onload="alert(1)"><head>
        <meta http-equiv="refresh" content="0;url=https://attacker.test/redirect">
        <base href="https://attacker.test/"><link rel="stylesheet" href="https://attacker.test/style.css">
        <script src="https://attacker.test/script.js">fetch('/secret')</script>
        <style>@import 'https://attacker.test/style.css'; body { background:url(https://attacker.test/css-image) }</style>
        </head><body background="https://attacker.test/background">
        <a href="https://attacker.test/navigation" target="_top" ping="https://attacker.test/ping">link</a>
        <form action="https://attacker.test/post"><button formaction="https://attacker.test/post" autofocus>submit</button></form>
        <img src="https://attacker.test/image" srcset="https://attacker.test/2x 2x" onerror="alert(1)">
        <iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe><object data="https://attacker.test/object"></object>
        <template><img src="https://attacker.test/template"></template><noscript><img src="https://attacker.test/noscript"></noscript>
        <svg><a xlink:href="https://attacker.test/svg">SVG link</a><animate attributeName="href" values="https://attacker.test"/><set attributeName="href" to="https://attacker.test"/></svg>
        <video poster="https://attacker.test/poster"><source src="https://attacker.test/video"></video>
        </body></html>`)
      const $ = load(html)
      expect(
        $('script,base,link,iframe,object,template,noscript,animate,set,video,source')
      ).toHaveLength(0)
      for (const element of $('*').toArray()) {
        if (!('attribs' in element)) continue
        expect(Object.keys(element.attribs).some((name) => /^on/iu.test(name))).toBe(false)
      }
      expect(
        $(
          '[href],[xlink\\:href],[action],[formaction],[target],[ping],[srcdoc],[srcset],[autofocus],[background],[poster],[src]'
        )
      ).toHaveLength(0)
      const policy = $('head').children().first()
      expect(policy.attr('http-equiv')).toBe('Content-Security-Policy')
      expect(policy.attr('content')).toContain("default-src 'none'")
      expect(policy.attr('content')).toContain("script-src 'none'")
      expect(policy.attr('content')).toContain("style-src 'unsafe-inline'")
      expect(policy.attr('content')).toContain('img-src data:')
      expect(policy.attr('content')).toContain("form-action 'none'")
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })
  it('allows supported data images while blocking arbitrary data URLs and non-image src attributes', () => {
    const html = staticArtifactHtml(
      '<img id="safe" src="data:image/png;base64,iVBORw0KGgo="><img id="svg" src="data:image/svg+xml,%3Csvg/%3E"><img id="html" src="data:text/html,%3Cscript%3Ealert(1)%3C/script%3E"><img id="bad" src="data:image/png;not-encoding,x"><input src="data:image/png;base64,iVBORw0KGgo=">'
    )
    const $ = load(html)
    expect($('#safe').attr('src')).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect($('#svg').attr('src')).toBe('data:image/svg+xml,%3Csvg/%3E')
    expect($('#html').attr('src')).toBeUndefined()
    expect($('#bad').attr('src')).toBeUndefined()
    expect($('input').attr('src')).toBeUndefined()
  })
})
