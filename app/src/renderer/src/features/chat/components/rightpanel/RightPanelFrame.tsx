import { useLayoutEffect, useRef, useState } from 'react'
import { useTweakContext } from '../../../../shared/theme/TweakProvider'
import { useReducedMotion } from '../../../../shared/hooks/useReducedMotion'
import {
  resizeSidePaneByKey,
  sidePaneBounds,
  startSidePaneDrag
} from '../../../../shared/hooks/sidePaneResize'
import { useI18n } from '../../../../shared/i18n'
import { ResizableSidePane } from '../../../../shared/ui/ResizableSidePane'
import { rightPanelPolicy } from '../../lib/panelTiles'
import { layerKey, type PanelEntry } from '../../lib/rightPanelStack'
import { framePhase, PANEL_TRANSITION_MS, targetWidth } from '../../lib/rightPanelFrameState'
import { closeArtifactViewer, useArtifactViewerStore } from '../../store/artifactViewerStore'
import { useChatSession, useChatStore } from '../../store/chatStore'
import { panelActions, connectPanelSettings, useRightPanelStore } from '../../store/rightPanelStore'
import { assistantRuntime } from '../../harnesses/registries/assistant'
import { harnessRightPanel } from '../../harnesses/registries/rightpanel'
import { TranscriptRuntimeProvider } from '../../harnesses/common/transcript/TranscriptRuntime'
import { ArtifactViewer } from '../../harnesses/common/rightpanel/ArtifactViewer'
import { focusPanelOrigin } from '../../harnesses/common/rightpanel/panelFocus'
import { PanelNavigationContext } from '../../harnesses/common/rightpanel/panelNavigation'

interface Props {
  projectName?: string | null
  projectPath?: string | null
  onExpandedChange?: (key: string, expanded: boolean) => void
}

export function RightPanelFrame({ onExpandedChange, ...header }: Props): React.JSX.Element {
  const { tr } = useI18n()
  const sessionKey = useChatStore((s) => s.activeKey)
  const kind = useChatSession((s) => s.agentKind)
  const backend = useChatSession((s) => s.backend)
  const search = useChatStore((s) => s.sessions[sessionKey]?.search?.seq)
  const { t, setTweak } = useTweakContext((t) => ({
    open: t.rightPanelOpen,
    widths: t.rightPanelWidths
  }))
  const { stack, session, direction, returnFocus, fallbackFocus } = useRightPanelStore()
  useLayoutEffect(
    () => connectPanelSettings((open) => setTweak('rightPanelOpen', open)),
    [setTweak]
  )
  useLayoutEffect(() => {
    panelActions.switchSession({ key: sessionKey, kind, backend }, t.open)
  }, [sessionKey, kind, backend, t.open])
  useLayoutEffect(() => () => closeArtifactViewer(sessionKey), [sessionKey])

  const ref = useRef<HTMLDivElement>(null)
  const activeLayer = useRef<HTMLDivElement>(null)
  const [hostWidth, setHostWidth] = useState(1200)
  useLayoutEffect(() => {
    const host = ref.current?.closest<HTMLElement>('[data-side-pane-host]')
    if (!host) return
    const measure = (): void => setHostWidth(host.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  const [drag, setDrag] = useState<number | null>(null)
  const cancel = useRef<(() => void) | undefined>(undefined)
  useLayoutEffect(() => () => cancel.current?.(), [kind, sessionKey, t.open])
  const width = drag ?? targetWidth(kind, t.widths, hostWidth)
  const bounds = sidePaneBounds(hostWidth)
  const saveWidth = (value: number): void => {
    if (value >= 320 && t.widths[kind] !== value)
      setTweak('rightPanelWidths', { ...t.widths, [kind]: value })
  }

  const current = session.key === sessionKey && session.kind === kind && session.backend === backend
  const top = current ? stack.at(-1) : undefined
  const key = top && layerKey(top)
  const reduced = useReducedMotion()
  // Preserve the outgoing subtree until the width/depth transition finishes. A session
  // switch discards its content immediately, even while an earlier transition is settling.
  const [previousMotion, setMotion] = useState(() => ({
    owner: sessionKey,
    key,
    entry: top,
    outgoing: undefined as PanelEntry | undefined,
    settled: true
  }))
  let motion = previousMotion
  if (previousMotion.owner !== sessionKey || previousMotion.key !== key) {
    motion = {
      owner: sessionKey,
      key,
      entry: top,
      outgoing:
        current && previousMotion.owner === sessionKey && !reduced
          ? previousMotion.entry
          : undefined,
      settled: reduced || !current
    }
    setMotion(motion)
  }
  if (motion.entry !== top) {
    motion = { ...motion, entry: top }
    setMotion(motion)
  }
  useLayoutEffect(() => {
    if (motion.settled) return
    const timer = window.setTimeout(
      () => setMotion((m) => (m === motion ? { ...m, settled: true, outgoing: undefined } : m)),
      reduced ? 0 : PANEL_TRANSITION_MS
    )
    return () => window.clearTimeout(timer)
  }, [motion, reduced])
  const [widthState, setWidthState] = useState({ open: t.open, settled: true, ready: true })
  if (widthState.open !== t.open)
    setWidthState({
      open: t.open,
      settled: reduced,
      // Let the first screen mount and the browser finish layout at zero width.
      // An interrupted closing transition reverses from its actual current size.
      ready: !t.open || reduced || !widthState.settled
    })
  useLayoutEffect(() => {
    if (widthState.settled || reduced) return
    if (!widthState.ready) {
      const frame = window.requestAnimationFrame(() =>
        setWidthState((state) => (state === widthState ? { ...state, ready: true } : state))
      )
      return () => window.cancelAnimationFrame(frame)
    }
    const timer = window.setTimeout(
      () => setWidthState((state) => (state === widthState ? { ...state, settled: true } : state)),
      PANEL_TRANSITION_MS
    )
    return () => window.clearTimeout(timer)
  }, [widthState, reduced])
  const displayed = t.open && (reduced || (widthState.open && widthState.ready))
  const phase = framePhase(t.open, widthState.open === t.open && widthState.settled, reduced)
  const entries = current ? [...stack] : []
  const outgoing = motion.outgoing && layerKey(motion.outgoing)
  if (current && motion.outgoing && !entries.some((e) => layerKey(e) === outgoing))
    entries.push(motion.outgoing)
  const selection = useArtifactViewerStore((s) => s.selection)
  const activeViewer = top?.kind === 'artifact' ? top.viewer : null
  // The catalogue also uses the viewer store. Only the active transcript layer
  // owns its matching selection. Keep changes in that layer when it is covered.
  useLayoutEffect(
    () =>
      useArtifactViewerStore.subscribe(({ selection: next }, previous) => {
        const layer = useRightPanelStore.getState().stack.at(-1)
        if (
          layer?.kind !== 'artifact' ||
          previous.selection !== layer.viewer ||
          next === previous.selection
        )
          return
        if (!next) {
          panelActions.back()
        } else if (
          next.sessionKey === layer.viewer.sessionKey &&
          next.artifact.publicationId === layer.viewer.artifact.publicationId
        ) {
          panelActions.updateDetail({ ...layer, viewer: next })
        }
      }),
    []
  )
  useLayoutEffect(() => {
    const live = useArtifactViewerStore.getState().selection
    if (activeViewer && live !== activeViewer) {
      useArtifactViewerStore.setState({ selection: activeViewer })
    } else if (!activeViewer && live?.sessionKey === sessionKey) {
      useArtifactViewerStore.setState({ selection: null })
    }
  }, [activeViewer, sessionKey])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  if (!t.open && expandedKey !== null) setExpandedKey(null)
  const displayKey = JSON.stringify([sessionKey, key])
  const expanded =
    !!top && (top.kind === 'artifact' ? !!selection?.expanded : expandedKey === displayKey)
  useLayoutEffect(() => {
    // Switching ordinary, unexpanded panels must not render the entire transcript
    // a second time just to publish another false expansion to its parent.
    if (!expanded) return
    onExpandedChange?.(sessionKey, true)
    return () => onExpandedChange?.(sessionKey, false)
  }, [onExpandedChange, expanded, sessionKey])
  const previousSearch = useRef(search)
  useLayoutEffect(() => {
    if (previousSearch.current !== search && search !== undefined) {
      setExpandedKey(null)
      if (activeViewer && expanded) panelActions.back()
    }
    previousSearch.current = search
  }, [search, activeViewer, expanded])
  useLayoutEffect(() => {
    if (focusPanelOrigin(returnFocus, fallbackFocus)) return
    if (top && direction !== 'session') {
      const layer = activeLayer.current
      const focus =
        layer?.querySelector<HTMLElement>('[data-panel-back]') ??
        layer?.querySelector<HTMLElement>('[data-panel-close]') ??
        layer?.querySelector<HTMLElement>('[data-behavior="viewer:close"]') ??
        layer
      focus?.focus({ preventScroll: true })
    }
  }, [sessionKey, key, direction, returnFocus, fallbackFocus]) // eslint-disable-line react-hooks/exhaustive-deps

  const module = harnessRightPanel(backend)
  const Screen = module.screen
  return (
    <div
      ref={ref}
      data-right-panel-frame=""
      data-phase={phase}
      inert={!top}
      aria-hidden={!top}
      style={{ width: displayed ? width : 0, opacity: displayed ? 1 : 0 }}
      className={
        'flex min-h-0 min-w-0 shrink-0 ' +
        (drag === null
          ? 'transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none'
          : '')
      }
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented || stack.length < 2) return
        const popups = e.currentTarget.ownerDocument.body.querySelectorAll(
          '[data-context="floating"], [role="dialog"][aria-modal="true"]'
        )
        if ([...popups].some((p) => !p.closest('[hidden], [inert], [aria-hidden="true"]'))) return
        e.preventDefault()
        e.stopPropagation()
        panelActions.back()
      }}
    >
      {entries.length > 0 && (
        <>
          {!expanded && (
            <div
              role="separator"
              aria-label={tr('chat.rightpanel.panelResizeAria')}
              aria-orientation="vertical"
              aria-valuenow={width}
              aria-valuemin={bounds.min}
              aria-valuemax={bounds.max}
              tabIndex={0}
              className="w-2 max-w-full shrink-0 cursor-col-resize touch-none select-none rounded-r4 ring-focus"
              onKeyDown={(e) => {
                const next = resizeSidePaneByKey(e.key, width, bounds)
                if (next !== undefined) {
                  e.preventDefault()
                  saveWidth(next)
                }
              }}
              onPointerDown={(e) => {
                if (!e.isPrimary || e.button !== 0) return
                e.preventDefault()
                cancel.current?.()
                let latest = width
                setDrag(width)
                cancel.current = startSidePaneDrag({
                  target: e.currentTarget,
                  // Preserve the grab offset inside the separator.
                  right: e.clientX + width,
                  pointerId: e.pointerId,
                  bounds,
                  onChange: (value) => {
                    latest = value
                    setDrag(value)
                  },
                  onFinish: () => {
                    cancel.current = undefined
                    setDrag(null)
                    saveWidth(latest)
                  }
                })
              }}
            />
          )}
          <ResizableSidePane expanded={expanded} lifecycleKey={displayKey} className="my-2 mr-2">
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
              <TranscriptRuntimeProvider value={assistantRuntime(backend)}>
                {entries.map((entry) => {
                  const id = layerKey(entry)
                  const active = id === key
                  const exit = !active && outgoing === id
                  const hidden = !active && !exit
                  const motionClass =
                    !reduced && !motion.settled && top && direction !== 'session'
                      ? active
                        ? direction === 'back'
                          ? 'panel-enter-back'
                          : 'panel-enter-forward'
                        : exit
                          ? direction === 'back'
                            ? 'panel-exit-back'
                            : 'panel-exit-forward'
                          : ''
                      : ''
                  return (
                    <div
                      ref={active ? activeLayer : undefined}
                      key={JSON.stringify([sessionKey, id])}
                      data-right-panel-layer={id}
                      data-work-panel-available={kind === 'work' && id === 'task' ? '' : undefined}
                      hidden={hidden}
                      inert={!active}
                      aria-hidden={!active}
                      tabIndex={-1}
                      className={
                        (hidden ? 'hidden' : 'flex') +
                        (active && direction === 'session'
                          ? ' motion-safe:animate-surface-in'
                          : '') +
                        ' absolute inset-0 min-h-0 min-w-0 flex-col outline-none [container-type:size] ' +
                        motionClass
                      }
                    >
                      <PanelNavigationContext.Provider
                        value={{
                          layer: entry,
                          active,
                          canGoBack: stack.length > 1 && active,
                          back: panelActions.back,
                          close: panelActions.close
                        }}
                      >
                        {entry.kind === 'artifact' ? (
                          <ArtifactViewer
                            selection={
                              selection?.artifact.publicationId ===
                              entry.viewer.artifact.publicationId
                                ? selection
                                : entry.viewer
                            }
                          />
                        ) : (
                          <Screen
                            {...header}
                            layer={entry}
                            configuration={module.configuration}
                            panelPolicy={rightPanelPolicy(kind, backend)}
                            expanded={active && expanded}
                            onToggleExpand={() => setExpandedKey(expanded ? null : displayKey)}
                          />
                        )}
                      </PanelNavigationContext.Provider>
                    </div>
                  )
                })}
              </TranscriptRuntimeProvider>
            </div>
          </ResizableSidePane>
        </>
      )}
    </div>
  )
}
