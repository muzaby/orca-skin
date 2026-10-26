import { app, BrowserWindow } from 'electron'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const output = process.argv[2]
const profile = path.join(output, 'electron-profile')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.disableHardwareAcceleration()
const results = []
const delay = () => new Promise((resolve) => setTimeout(resolve, 200))
app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({
      width: 900,
      height: 680,
      show: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        devTools: false,
        backgroundThrottling: false
      }
    })
    win.webContents.on('console-message', (event) => {
      if (/Error/.test(event.message)) console.log(event.message)
    })
    const js = (code) => win.webContents.executeJavaScript(code)
    const key = async (keyCode) => {
      win.webContents.focus()
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode })
      if (keyCode === 'Return' || keyCode === 'Space')
        win.webContents.sendInputEvent({ type: 'char', keyCode: keyCode === 'Return' ? '\r' : ' ' })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode })
      await delay()
    }
    await win.loadFile(path.join(output, 'dist/index.html'))
    await delay()
    for (const theme of ['white', 'dark']) {
      for (const mode of ['project', 'agent']) {
        await js(
          `document.documentElement.dataset.theme='${theme}';window.renderFixture('${mode}','${mode === 'agent' ? 'loading' : 'ready'}')`
        )
        await delay()
        await js(
          `document.querySelector('${mode === 'project' ? '[data-component="landing-project-picker"]' : '[data-component="opencode-select"]'}').click()`
        )
        await delay()
        const metrics = await js(
          `(()=>{const menu=document.querySelector('[role="menu"]'),heading=document.querySelector('[data-menu-heading]'),spinner=document.querySelector('[data-agent-loading]');return {width:menu.getBoundingClientRect().width,rect:menu.getBoundingClientRect().toJSON(),titleRight:heading?.children[0].getBoundingClientRect().right,spinnerLeft:spinner?.getBoundingClientRect().left,animation:spinner?getComputedStyle(spinner.querySelector('svg')).animationName:null,focus:document.activeElement.getAttribute('aria-label')}})()`
        )
        results.push({ theme, mode, ...metrics })
        fs.writeFileSync(
          path.join(output, `${theme}-${mode}.png`),
          (await win.webContents.capturePage()).toPNG()
        )
        if (mode === 'project') {
          await js(`document.querySelector('[aria-label="프로젝트 검색"]').focus()`)
          await key('Down')
          assert.equal(await js(`document.activeElement.getAttribute('role')`), 'menuitemradio')
          await key('Return')
          assert.equal(
            await js(`document.activeElement.dataset.component`),
            'landing-project-picker',
            await js(`document.activeElement.outerHTML`)
          )
          assert.equal(await js(`!!document.querySelector('[role="menu"]')`), false)
          await key('Space')
          assert.equal(
            await js(`document.activeElement.getAttribute('aria-label')`),
            '프로젝트 검색'
          )
          await key('Tab')
          assert.equal(await js(`document.activeElement.id`), 'next')
          results.push({
            theme,
            keyboard: 'ArrowDown → Enter → trigger; Space → search; Tab → next'
          })
        }
      }
    }
    win.setSize(360, 680)
    await js(`window.renderFixture('agent','ready',true)`)
    await delay()
    // Existing open menu responds to content and viewport resize.
    if (!(await js(`!!document.querySelector('[role="menu"]')`)))
      await js(`document.querySelector('[data-component="opencode-select"]').click()`)
    await delay()
    results.push({
      narrow: await js(`document.querySelector('[role="menu"]').getBoundingClientRect().toJSON()`),
      checkRight: await js(
        `document.querySelector('[aria-checked="true"] svg').getBoundingClientRect().right`
      ),
      viewport: await js('innerWidth')
    })
    fs.writeFileSync(
      path.join(output, 'narrow-agent.png'),
      (await win.webContents.capturePage()).toPNG()
    )
    await win.webContents.debugger.attach('1.3')
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    })
    await js(`window.renderFixture('agent','loading',true)`)
    await delay()
    results.push({
      reducedMotion: await js(
        `getComputedStyle(document.querySelector('[data-agent-loading] svg')).animationName`
      )
    })
    assert(
      results
        .filter((r) => r.mode === 'agent')
        .every(
          (r) =>
            r.width < 180 &&
            r.spinnerLeft - r.titleRight > 0 &&
            r.spinnerLeft - r.titleRight < 12 &&
            r.animation === 'spin'
        )
    )
    assert(results.at(-2).narrow.right <= results.at(-2).viewport)
    assert(results.at(-2).checkRight <= results.at(-2).narrow.right)
    assert.equal(results.at(-1).reducedMotion, 'none')
    await js(`window.renderFixture('project')`)
    await delay()
    await js(`document.querySelector('[data-component="landing-project-picker"]').click()`)
    await delay()
    const narrowProject = await js(
      `document.querySelector('[role="menu"]').getBoundingClientRect().toJSON()`
    )
    assert(narrowProject.left >= 0 && narrowProject.right <= (await js('innerWidth')))
    fs.writeFileSync(
      path.join(output, 'narrow-project.png'),
      (await win.webContents.capturePage()).toPNG()
    )
    await key('Escape')
    assert.equal(await js(`document.activeElement.dataset.component`), 'landing-project-picker')
    results.push({ narrowProject, escapeFocus: 'trigger' })
    fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results))
    win.destroy()
    app.quit()
  })
  .catch((e) => {
    console.error(e)
    app.exit(1)
  })
