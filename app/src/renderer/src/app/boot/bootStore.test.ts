import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bootActions, useBootStore } from './bootStore'

vi.mock('./steps', () => ({
  createBootSteps: vi.fn(() => [
    { id: 'landing-target', mandatory: true, timeoutMs: 10, run: vi.fn() },
    { id: 'backend', mandatory: false, timeoutMs: 10, run: vi.fn() }
  ]),
  runBootSteps: vi.fn(async (_steps, onEvent) => {
    onEvent({ id: 'landing-target', status: 'running' })
    onEvent({ id: 'landing-target', status: 'ok', durationMs: 1 })
    return { landingTarget: '/new' }
  })
}))

describe('bootStore', () => {
  beforeEach(() => {
    bootActions.reset()
  })

  it('runBoot 성공 시 ready 와 landingTarget 을 기록한다', async () => {
    await bootActions.runBoot()

    expect(useBootStore.getState().phase).toBe('ready')
    expect(useBootStore.getState().landingTarget).toBe('/new')
    expect(useBootStore.getState().steps[0]).toMatchObject({
      id: 'landing-target',
      status: 'ok',
      durationMs: 1
    })
  })

  it('reset 은 idle 로 되돌린다', async () => {
    await bootActions.runBoot()
    bootActions.reset()

    expect(useBootStore.getState()).toMatchObject({
      phase: 'idle',
      landingTarget: null,
      errorMessage: null
    })
  })
})
