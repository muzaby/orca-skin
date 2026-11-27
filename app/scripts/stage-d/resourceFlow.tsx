import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { CustomizeList } from '@renderer/features/skills/components/customize/CustomizeList'
import { ModelMenu } from '@renderer/features/chat/components/composer/ModelMenu'
import type { SkillInfo } from '../../src/shared/ipc'
import { frame } from './domInput'
import appCss from '@renderer/styles/app.css?inline'

export async function measureResources(): Promise<unknown> {
  const owner = document.createElement('div')
  owner.style.cssText = 'position:fixed;inset:0;overflow:auto'
  document.body.append(owner)
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  const root = createRoot(owner)
  const skills: SkillInfo[] = Array.from({ length: 10000 }, (_, i) => ({
    name: 'resource-' + i,
    description: '',
    sourceId: i % 10 === 0 ? 'plugin:claude' : 'orcinus-orca',
    sourceLabel: 'fixture',
    enabled: true,
    sourceKind: 'orcinus-orca',
    canToggle: false,
    canRemove: false,
    skillPath: '',
    skillDir: ''
  }))
  let selected = ''
  let model: string | null = null
  try {
    const started = performance.now()
    flushSync(() =>
      root.render(
        <CustomizeList
          owner={{ current: owner }}
          tab="skills"
          skills={skills}
          mcpServers={[]}
          providers={[]}
          onSelect={(id) => {
            selected = id
          }}
        />
      )
    )
    const commitMs = performance.now() - started
    const committed = performance.now()
    await frame()
    await frame()
    const paintMs = performance.now() - committed
    const mounted = owner.querySelectorAll('[data-extensions-row]').length
    if (owner.querySelector('[data-extensions-row="plugin:claude/resource-0"]'))
      throw Error('native plugin skill in managed list')
    for (
      let tick = 0;
      tick < 25 && !owner.querySelector('[data-extensions-row="orcinus-orca/resource-9999"]');
      tick++
    ) {
      owner.scrollTop = owner.scrollHeight
      await frame()
    }
    const last = owner.querySelector<HTMLButtonElement>(
      '[data-extensions-row="orcinus-orca/resource-9999"] button'
    )
    last?.click()
    if (selected !== 'orcinus-orca/resource-9999') throw Error('resource selection')
    const models = Array.from({ length: 10 }, (_, i) => ({
      alias: 'custom',
      model: 'm' + i,
      isCustom: true,
      isDefault: false,
      oneMillionContext: false
    }))
    const agents = [{ key: 'fixture', adapter: 'claude', supported: true, models }]
    flushSync(() =>
      root.render(
        <ModelMenu
          agents={agents}
          sessionBackend="claude"
          selection={null}
          onPick={(choice) => {
            model = choice.modelFamily
          }}
        />
      )
    )
    const options = owner.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')
    options[8].click()
    if (model !== 'm8') throw Error('ninth model selection ' + model)
    return {
      input: skills.length,
      matched: 9000,
      mounted,
      commitMs,
      paintMs,
      last: model,
      resource: 'resource-9999'
    }
  } finally {
    root.unmount()
    style.remove()
    owner.remove()
  }
}
