import { createElement, useLayoutEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { fakeComputeClient } from '../../../shared/compute/fakeClient.testfixture'
import { setComputeClient } from '../../../shared/compute/client'
import { useAttachments, type UseAttachments } from './useAttachments'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))

const hook = { value: undefined as unknown as UseAttachments }
function Probe({ session = 'session' }: { session?: string }): React.JSX.Element {
  const value = useAttachments()
  useLayoutEffect(() => {
    hook.value = value
  })
  return createElement('span', null, session)
}

afterEach(() => {
  setComputeClient(null)
  vi.unstubAllGlobals()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 fixture 반환값 추론.
function mount() {
  const compute = fakeComputeClient()
  const request = vi.spyOn(compute.client, 'request')
  setComputeClient(compute.client)
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const readAttachment = vi.fn(async (path: string) => {
    if (path.includes('unreadable')) throw Error('unreadable')
    return {
      mimeType: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2sAAAAASUVORK5CYII='
    }
  })
  const pickAttachments = vi.fn(async () => [
    { name: 'a.png', path: '/tmp/a.png', mimeType: 'image/png', sizeBytes: 10 },
    { name: 'a.png', path: '/tmp/b.png', mimeType: 'image/png', sizeBytes: 11 },
    { name: 'unreadable.png', path: '/tmp/unreadable.png', mimeType: 'image/png', sizeBytes: 12 },
    { name: 'notes.txt', path: '/tmp/notes.txt', mimeType: 'text/plain', sizeBytes: 13 }
  ])
  Object.assign(window, { oo: { files: { readAttachment, pickAttachments } } })
  dom.render(createElement(Probe, {}))
  return { dom, compute, request, readAttachment }
}

describe('composer attachment preview lifecycle', () => {
  it('AC20 restores each surviving image preview once without reading its source again', async () => {
    const { dom, compute, readAttachment } = mount()
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 4; i++) await Promise.resolve()
    }
    try {
      await hook.value.pickAttachments()
      expect(compute.requests).toHaveLength(2)
      const [removed, surviving] = hook.value.snapshot().views
      compute.rejectNext()
      compute.rejectNext()
      await flush()
      expect(hook.value.snapshot().views.every((view) => !view.previewDataUrl)).toBe(true)
      expect(compute.requests).toHaveLength(2)
      hook.value.removeAttachment(removed.id)
      compute.recover('compute')
      await flush()
      expect(compute.requests).toHaveLength(2)
      compute.recover('image')
      await flush()
      expect(compute.requests).toHaveLength(3)
      expect(compute.requests[2]).toMatchObject({ attachmentId: surviving.id })
      expect(readAttachment).toHaveBeenCalledTimes(3)
      compute.resolveNext({ thumbnail: 'data:image/jpeg;base64,RECOVERED' })
      await flush()
      expect(hook.value.snapshot().views[0].previewDataUrl).toBe('data:image/jpeg;base64,RECOVERED')
      compute.recover('image')
      await flush()
      expect(compute.requests).toHaveLength(3)
    } finally {
      dom.unmount()
    }
  })

  it('discards an older clipboard read even when the next draft has its own pictures', async () => {
    const { dom } = mount()
    let finish!: () => void
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:image/png;base64,cGFzdGU='
        onload?: () => void
        readAsDataURL(): void {
          finish = () => this.onload?.()
        }
      }
    )
    try {
      const event = {
        preventDefault: vi.fn(),
        clipboardData: { files: [new File(['old'], 'old.png', { type: 'image/png' })] }
      }
      hook.value.onPaste(event as unknown as Parameters<UseAttachments['onPaste']>[0])
      expect(event.preventDefault).toHaveBeenCalledOnce()
      expect(hook.value.resetIfUnchanged(hook.value.snapshot().items)).toBe(true)
      await hook.value.pickAttachments()
      const next = hook.value.snapshot()
      finish()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(hook.value.snapshot()).toEqual(next)
    } finally {
      dom.unmount()
    }
  })

  it('drops a late source read before scheduling and a cancelled result before publishing', async () => {
    const { dom, readAttachment, request } = mount()
    let finish!: (value: { mimeType: string; data: string }) => void
    readAttachment.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    try {
      await hook.value.pickAttachments()
      const [reading, scheduled] = hook.value.snapshot().views
      expect(request).toHaveBeenCalledTimes(1)
      hook.value.removeAttachment(reading.id)
      hook.value.removeAttachment(scheduled.id)
      dom.render(createElement(Probe, {}))
      const chips = hook.value.chips
      finish({ mimeType: 'image/png', data: 'AAAA' })
      await new Promise((resolve) => setTimeout(resolve, 0))
      dom.render(createElement(Probe, {}))
      expect(request).toHaveBeenCalledTimes(1)
      expect(hook.value.chips).toBe(chips)
    } finally {
      dom.unmount()
    }
  })

  it('reads each image source once and snapshots only prepared results without waiting', async () => {
    const { dom, compute, request, readAttachment } = mount()
    try {
      await hook.value.pickAttachments()
      await Promise.resolve()
      expect(readAttachment.mock.calls.map(([path]) => path)).toEqual([
        '/tmp/a.png',
        '/tmp/b.png',
        '/tmp/unreadable.png'
      ])
      expect(request.mock.calls).toHaveLength(2)
      expect(request.mock.calls[0]).toEqual([
        expect.objectContaining({ kind: 'imageThumb', data: expect.any(String), pixels: 1 }),
        { priority: 'background', cacheable: false }
      ])
      compute.resolveNext({ thumbnail: 'data:image/jpeg;base64,ONE' })
      await Promise.resolve()
      const { items, views } = hook.value.snapshot()
      expect(items.map((item) => item.name)).toEqual([
        'a.png',
        'a.png',
        'unreadable.png',
        'notes.txt'
      ])
      expect(views.map((view) => view.previewDataUrl)).toEqual([
        'data:image/jpeg;base64,ONE',
        undefined,
        undefined,
        undefined
      ])
      expect(new Set(views.map((view) => view.id)).size).toBe(4)
      expect(hook.value.resetIfUnchanged(items)).toBe(true)
      expect(hook.value.snapshot()).toEqual({ items: [], views: [] })
      expect(compute.cancelled).toEqual([compute.requests[1]])
    } finally {
      dom.unmount()
    }
  })

  it('keeps same-name attachment identities and their pending jobs across session changes', async () => {
    const { dom, compute } = mount()
    try {
      await hook.value.pickAttachments()
      const [removed, surviving] = hook.value.snapshot().views
      hook.value.removeAttachment(removed.id)
      compute.resolveNext({ thumbnail: 'data:image/jpeg;base64,SURVIVOR' })
      await Promise.resolve()
      expect(hook.value.snapshot().views[0]).toEqual({
        ...surviving,
        previewDataUrl: 'data:image/jpeg;base64,SURVIVOR'
      })
      await hook.value.pickAttachments()
      const current = hook.value.snapshot()
      const replacement = current.views.find(
        (view) => view.name === 'a.png' && view.id !== surviving.id
      )
      expect(replacement?.id).toBeDefined()
      expect(replacement?.id).not.toBe(removed.id)
      expect(replacement?.previewDataUrl).toBeUndefined()
      dom.render(createElement(Probe, { session: 'different' }))
      expect(hook.value.snapshot()).toEqual(current)
      expect(compute.cancelled).toEqual([compute.requests[0]])
      compute.resolveNext({ thumbnail: 'data:image/jpeg;base64,REPLACEMENT' })
      await Promise.resolve()
      expect(hook.value.snapshot().views.find((view) => view.id === replacement?.id)).toEqual({
        ...replacement,
        previewDataUrl: 'data:image/jpeg;base64,REPLACEMENT'
      })
      expect(hook.value.snapshot().views[0].previewDataUrl).toBe('data:image/jpeg;base64,SURVIVOR')
    } finally {
      dom.unmount()
    }
    expect(compute.cancelled).toEqual([compute.requests[0], compute.requests[3]])
  })
})
