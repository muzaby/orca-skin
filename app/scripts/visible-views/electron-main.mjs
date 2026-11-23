import { app, BrowserWindow, clipboard } from 'electron'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

async function main() {
  app.on('window-all-closed', () => {})
  await app.whenReady()
  const createWindow = () =>
    new BrowserWindow({
      width: 800,
      height: 600,
      show: true,
      webPreferences: { backgroundThrottling: false }
    })
  let window
  const read = (script) => window.webContents.executeJavaScript(script)
  async function until(script) {
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
      const value = await read(script)
      if (value) return value
      await delay(40)
    }
    throw Error(
      'timed out: ' +
        script +
        ' ' +
        JSON.stringify(
          await read(
            "({kind:location.hash,rows:document.querySelectorAll('[data-index]').length,first:document.body.innerText.slice(0,38),pending:document.querySelectorAll('[aria-busy]').length,timings:window.computeProbeTimings.slice(-15)})"
          )
        )
    )
  }
  try {
    for (const kind of ['code', 'markdown', 'diff', 'git-inline', 'git-split', 'work']) {
      window = createWindow()
      window.show()
      window.focus()
      window.webContents.focus()
      await window.loadURL(process.argv.at(-1) + '/#' + kind)
      const text = kind === 'markdown' ? 'Heading ' : 'const row'
      await until(`document.body.innerText.includes('${text}0')`)
      const count = () => read("document.querySelectorAll('[data-index]').length")
      assert.ok((await count()) < 150)
      window.focus()
      await until(
        kind === 'work'
          ? "document.querySelectorAll('[data-virtual-code]').length===2"
          : kind === 'markdown'
            ? "!!document.querySelector('h2') && !document.querySelector('[data-md-block-pending]')"
            : "Array.from(document.querySelectorAll('span[style]')).some(el=>el.style.color)"
      )
      await read(
        'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))'
      )
      const points = await read(`(()=>{
        const needle='${text}0'
        const element=Array.from(document.querySelectorAll('[data-virtual-text],pre,h2')).find(el=>el.textContent.startsWith(needle))
        const node=document.createTreeWalker(element,NodeFilter.SHOW_TEXT).nextNode()
        const range=document.createRange()
        range.setStart(node,1); range.setEnd(node,Math.min(4,node.length))
        const rect=range.getBoundingClientRect()
        return {x:Math.round(rect.right-0.15),left:Math.round(rect.left+0.15),y:Math.round(rect.top+rect.height/2)}
      })()`)
      const mouse = (type, x) =>
        window.webContents.sendInputEvent({
          type,
          x,
          y: points.y,
          button: 'left',
          clickCount: 1,
          ...(type === 'mouseMove' ? { modifiers: ['leftButtonDown'] } : {})
        })
      mouse('mouseDown', points.x)
      mouse('mouseMove', points.left)
      mouse('mouseUp', points.left)
      await delay(60)
      const selected = await read('getSelection().toString()')
      assert.ok(
        selected.length > 0,
        JSON.stringify({
          kind,
          points,
          hit: await read(
            'document.elementFromPoint(' + points.x + ',' + points.y + ')?.outerHTML.slice(0,240)'
          )
        })
      )
      const copy = () => {
        for (const type of ['keyDown', 'keyUp'])
          window.webContents.sendInputEvent({
            type,
            keyCode: 'C',
            modifiers: [process.platform === 'darwin' ? 'meta' : 'control']
          })
      }
      clipboard.writeText('unchanged')
      await read(
        "window.copyEvents=[];document.addEventListener('copy',()=>window.copyEvents.push(getSelection().toString()))"
      )
      copy()
      for (let i = 0; i < 50 && clipboard.readText() !== selected; i++) await delay(20)
      assert.equal(
        clipboard.readText(),
        selected,
        JSON.stringify(
          await read(
            '({selection:getSelection().toString(),copy:window.copyEvents,active:document.hasFocus()})'
          )
        )
      )
      clipboard.writeText('unchanged')
      await read(
        "window.scroller=Array.from(document.querySelectorAll('div')).find(el=>el.clientHeight && el.scrollHeight>el.clientHeight*2 && /auto|scroll/.test(getComputedStyle(el).overflowY)); scroller.scrollTop=scroller.scrollHeight"
      )
      // Markdown heading heights are measured after each window mounts.
      await until(
        `(scroller.scrollTop=scroller.scrollHeight,document.body.innerText.includes('${kind === 'work' ? 'response ' + text : text}5000'))`
      )
      assert.ok((await count()) < 150)
      assert.equal(await read('getSelection().toString()'), '')
      copy()
      await delay(50)
      assert.equal(clipboard.readText(), 'unchanged')
      if (kind === 'markdown')
        await until(
          "(scroller.scrollTop=scroller.scrollHeight,Array.from(document.querySelectorAll('h2')).some(el=>el.textContent==='Heading 5000'))"
        )
      else if (kind !== 'work')
        await until(
          "Array.from(document.querySelectorAll('span[style]')).some(el=>el.style.color && el.textContent.includes('const'))"
        )
      if (kind === 'git-inline') {
        await read('scroller.scrollTop=0')
        await until(
          "document.querySelector('[data-diff-requirement-add]') && document.body.innerText.includes('const row0')"
        )
        await read("document.querySelector('[data-diff-requirement-add]').click()")
        await until("!!document.querySelector('[data-diff-requirement-draft] textarea')")
        await read(
          "document.querySelector('textarea').focus(); scroller.scrollTop=scroller.scrollHeight"
        )
        await until(
          "document.body.innerText.includes('const row5000') && document.activeElement.tagName==='TEXTAREA'"
        )
        await read("document.querySelector('[data-jump]').click()")
        await until(
          "(()=>{const row=document.querySelector('[data-diff-requirement-marker=remote]');if(!row)return false;const r=row.getBoundingClientRect();return r.top>=0 && r.bottom<=scroller.clientHeight})()"
        )
        assert.ok((await count()) < 150)
      }
      console.log(
        kind,
        'first and final rows, bounded mounts, native copy and worker rendering passed'
      )
      window.destroy()
    }
    app.exit(0)
  } catch (err) {
    console.error(err)
    app.exit(1)
  }
}
void main().catch((err) => {
  console.error(err)
  app.exit(1)
})
