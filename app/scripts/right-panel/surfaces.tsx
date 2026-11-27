import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { RouteSurface } from '@renderer/app/RouteSurface'
import { ROUTES } from '@renderer/shared/navigation'
import { Sidebar } from '@renderer/app/Sidebar'
import { BootScreen } from '@renderer/app/boot/BootScreen'
import { FullFrameShell } from '@renderer/app/FullFrameShell'
import { TweakProvider, useTweakContext } from '@renderer/shared/theme/TweakProvider'
import { ExtensionsCatalogView } from '@renderer/features/skills/components/customize/ExtensionsCatalogView'
import { SettingsModal } from '@renderer/features/settings/components/SettingsModal'
import { useSettingsModalStore } from '@renderer/features/settings/store/settingsModalStore'
import { FloatingPanel } from '@renderer/shared/ui/FloatingPanel'
import { DetailSidePane } from '@renderer/shared/ui/DetailSidePane'
import { ErrorToastHost } from '@renderer/shared/ui/ErrorToastHost'
import { errorToastStore } from '@renderer/shared/errors/errorToastStore'
import { SearchModal } from '@renderer/features/sessions/components/SearchModal'
import { AuthExpiredModal } from '@renderer/features/backend/harnesses/claude/components/AuthExpiredModal'
import { InstallerDialog } from '@renderer/features/backend/harnesses/claude/components/InstallerDialog'
import { GateLogin } from '@renderer/features/providers/components/GateLogin'
import { SchedulesScreen } from '@renderer/features/schedules/components/SchedulesScreen'
import { ArtifactsView } from '@renderer/features/artifacts/components/ArtifactsView'
import { Modal } from '@renderer/shared/ui/Modal'
import { Popover } from '@renderer/shared/ui/Popover'
import { Toggle } from '@renderer/shared/ui/Toggle'
import { ProjectsScreen } from '@renderer/features/projects/components/ProjectsScreen'
import { CollapsibleSection } from '@renderer/shared/ui/SidebarSection'

interface SurfaceMeasurement {
  first: Record<string, number>
  rows: Record<string, number>[]
  last: Record<string, number>
}

// Mount independent production owners after the transcript probe. Each sample reads
// the compositor's actual value, including an absent outgoing portal after cleanup.
export async function measureSurfaces(): Promise<
  { name: string; ok: boolean; [key: string]: unknown }[]
> {
  function SidebarProbe(): React.JSX.Element {
    const { t, setTweak } = useTweakContext((settings) => settings.sidebarCollapsed)
    return (
      <>
        <button data-toggle-sidebar="" onClick={() => setTweak('sidebarCollapsed', !t)}>
          toggle sidebar
        </button>
        <Sidebar projectsSlot={null} pinnedSlot={null} sessionsSlot={null} footerSlot={null} />
      </>
    )
  }

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;z-index:100;background:white'
  document.body.append(container)
  const root = createRoot(container)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const samples: { name: string; ok: boolean; [key: string]: unknown }[] = []
  const anchor = createRef<HTMLButtonElement>()
  const noop = (): void => {}
  const draw = (open: boolean): void =>
    flushSync(() =>
      root.render(
        <>
          {ROUTES.map((route, i) => (
            <div key={route.pattern} data-probe-route={i}>
              <RouteSurface route={open ? route : ROUTES[(i + 1) % ROUTES.length]}>
                {route.pattern}
              </RouteSurface>
            </div>
          ))}
          <button ref={anchor}>anchor</button>
          <Toggle on={open} label="probe-switch" onClick={noop} />
          <Popover open={open} onClose={noop} anchorRef={anchor} className="motion-probe-menu">
            menu
          </Popover>
          <Modal open={open} onClose={noop} ariaLabel="motion-probe-dialog">
            <input />
          </Modal>
          <ProjectsScreen
            projects={[]}
            loading={false}
            onOpenProject={noop}
            onCreate={async () => {}}
            onTogglePin={noop}
          />
          <div data-probe="schedules">
            <SchedulesScreen
              tasks={[]}
              loading={false}
              revision={0}
              projects={[]}
              pickers={{ project: () => null, execution: () => null }}
              onCreate={async () => {}}
              onUpdate={async () => {}}
              onDelete={noop}
              onSetEnabled={noop}
              onRunNow={noop}
              loadRuns={async () => []}
              onOpenSession={noop}
            />
          </div>
          <div data-probe="artifacts">
            <ArtifactsView onOpen={noop} onDeleted={noop} />
          </div>
          <TweakProvider>
            <SettingsModal />
            <MemoryRouter>
              <div data-probe="extensions">
                <ExtensionsCatalogView />
              </div>
              <div data-probe="sidebar">
                <SidebarProbe />
              </div>
            </MemoryRouter>
          </TweakProvider>
          <div data-probe="floating">
            <FloatingPanel title="debug">content</FloatingPanel>
          </div>
          <div data-probe="auth">
            <AuthExpiredModal open={open} onNewChat={noop} onDismiss={noop} />
          </div>
          <div data-probe="installer">
            <InstallerDialog open={open} onClose={noop} onComplete={noop} />
          </div>
          <div data-probe="toast">
            <ErrorToastHost onOpen={noop} />
          </div>
          {open && (
            <>
              <div data-probe="boot">
                <BootScreen />
              </div>
              <div data-probe="gate">
                <FullFrameShell screenLabel="login">
                  <GateLogin
                    providers={[]}
                    dailyRelogin={[]}
                    step={null}
                    busy={false}
                    onLogin={noop}
                    onSubmit={noop}
                  />
                </FullFrameShell>
              </div>
              <div data-probe="detail" data-side-pane-host="">
                <DetailSidePane
                  lifecycleKey="probe"
                  title="detail"
                  width={400}
                  expanded={false}
                  onWidthChange={noop}
                  onExpandedChange={noop}
                  onClose={noop}
                >
                  detail
                </DetailSidePane>
              </div>
              <div data-probe="search">
                <SearchModal onClose={noop} onChoose={async () => false} />
              </div>
            </>
          )}
          <CollapsibleSection
            label="probe disclosure"
            className="probe-disclosure"
            dataContext="probe-disclosure"
          >
            <p>visible</p>
            <p>section</p>
          </CollapsibleSection>
        </>
      )
    )
  const find = (selector: string): HTMLElement | null => document.querySelector(selector)
  const opacity = (selector: string): number => {
    const node = find(selector)
    return node ? Number(getComputedStyle(node).opacity) : 0
  }
  const raf = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve))
  const modal = '[data-surface-presence]:has(> [aria-label="motion-probe-dialog"])'
  const menu = '.motion-probe-menu'
  const metrics = (): Record<string, number> => ({
    ...Object.fromEntries(
      ROUTES.map((route, i) => [
        'route-' + route.pattern,
        opacity(`[data-probe-route="${i}"] [data-context="route-target"]`)
      ])
    ),
    modal: opacity(modal),
    menu: opacity(menu),
    thumb: parseFloat(getComputedStyle(container.querySelector('[role=switch] > span')!).left),
    catalog: opacity('[data-project-catalog] [role=tabpanel]'),
    schedule: opacity('[data-probe="schedules"] [role=tabpanel]'),
    artifact: opacity('[data-probe="artifacts"] [role=tabpanel]'),
    extension: opacity('[data-probe="extensions"] [role=tabpanel]'),
    settings: opacity('[data-settings-tab]'),
    sidebar: container.querySelector('[data-probe="sidebar"] aside')!.getBoundingClientRect().width,
    floating: opacity('[data-probe="floating"] > button'),
    auth: opacity('[data-probe="auth"] [data-surface-presence]'),
    installer: opacity('[data-probe="installer"] [data-surface-presence]'),
    boot: opacity('[data-probe="boot"] main'),
    gate: opacity('[data-probe="gate"] main'),
    login: opacity('[data-probe="gate"] main > div'),
    detail: opacity('[data-probe="detail"] section'),
    search: opacity('[data-probe="search"] [data-surface-presence]'),
    toast: opacity('[data-probe="toast"] [role=alert]'),
    disclosure: container
      .querySelector('.probe-disclosure [data-disclosure-content]')!
      .getBoundingClientRect().height
  })
  const collect = async (action: () => void): Promise<SurfaceMeasurement> => {
    await raf()
    const first = metrics()
    action()
    const rows = [metrics()]
    const start = performance.now()
    do {
      await raf()
      rows.push(metrics())
    } while (rows.length < 18 || performance.now() - start < 330)
    return { first, rows, last: rows.at(-1)! }
  }
  const record = (
    name: string,
    measurement: SurfaceMeasurement,
    field: string,
    end: number,
    from = measurement.first[field]
  ): void => {
    const { rows, last } = measurement
    const intermediate = rows.filter(
      (r) => r[field] > Math.min(from, end) + 0.01 && r[field] < Math.max(from, end) - 0.01
    ).length
    samples.push({
      name: 'surface-' + name,
      ok: Math.abs(last[field] - end) < 0.1 && (reduced ? intermediate === 0 : intermediate > 0),
      intermediate,
      frames: rows.length,
      min: Math.min(...rows.map((r) => r[field])),
      max: Math.max(...rows.map((r) => r[field])),
      start: from,
      end: last[field]
    })
  }
  try {
    draw(false)
    await raf()
    const show = await collect(() => {
      draw(true)
      flushSync(() =>
        errorToastStore.getState().push({ id: 'motion', origin: 'renderer', title: 'unexpected' })
      )
    })
    for (const route of ROUTES)
      record('route-' + route.pattern, show, 'route-' + route.pattern, 1, 0)
    for (const field of ['auth', 'installer', 'boot', 'gate', 'login', 'detail', 'search', 'toast'])
      record(field + '-open', show, field, 1)
    record('modal-open', show, 'modal', 1)
    record('popover-open', show, 'menu', 1)
    record('toggle', show, 'thumb', 14.5)
    const close = await collect(() => draw(false))
    record('modal-close', close, 'modal', 0)
    record('auth-close', close, 'auth', 0)
    record('installer-close', close, 'installer', 0)
    record('popover-close', close, 'menu', 0)
    const settings = await collect(() =>
      flushSync(() => useSettingsModalStore.getState().show('usage'))
    )
    record('settings-open', settings, 'settings', 1)
    const changeTab = await collect(() =>
      flushSync(() => useSettingsModalStore.getState().setTab('general'))
    )
    record('settings-tab', changeTab, 'settings', 1, 0)
    flushSync(() => useSettingsModalStore.getState().hide())
    const catalog = await collect(() =>
      flushSync(() => {
        for (const selector of [
          '[data-project-catalog]',
          '[data-probe="schedules"]',
          '[data-probe="artifacts"]',
          '[data-probe="extensions"]'
        ])
          container.querySelectorAll<HTMLButtonElement>(selector + ' [role=tab]')[1].click()
        container.querySelector<HTMLButtonElement>('[data-probe="floating"] button')!.click()
        container.querySelector<HTMLButtonElement>('[data-toggle-sidebar]')!.click()
      })
    )
    record('projects-tab', catalog, 'catalog', 1, 0)
    record('schedules-tab', catalog, 'schedule', 1, 0)
    record('artifacts-tab', catalog, 'artifact', 1, 0)
    record('extensions-tab', catalog, 'extension', 1, 0)
    record('floating-close', catalog, 'floating', 1)
    record(
      'sidebar-collapse',
      catalog,
      'sidebar',
      3.5 * parseFloat(getComputedStyle(document.documentElement).fontSize)
    )
    const collapse = await collect(() =>
      flushSync(() =>
        container.querySelector<HTMLButtonElement>('.probe-disclosure > button')!.click()
      )
    )
    record('disclosure-close', collapse, 'disclosure', 0)
    return samples
  } finally {
    useSettingsModalStore.getState().hide()
    errorToastStore.getState().dismiss('motion')
    root.unmount()
    container.remove()
  }
}
