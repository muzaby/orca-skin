import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, vi } from 'vitest'
import * as rows from './useVirtualRows'

// Render the caller through to TanStack. SSR needs neither layout nor a native database.
export function expectVirtualKeys(element: ReactElement, expected: readonly string[]): void {
  const hook = vi.spyOn(rows, 'useVirtualRows')
  try {
    renderToStaticMarkup(element)
    expect(hook).toHaveBeenCalledOnce()
    const { options } = hook.mock.results[0].value
    expect(options.count).toBe(expected.length)
    expect(Array.from({ length: options.count }, (_, index) => options.getItemKey(index))).toEqual(
      expected
    )
  } finally {
    hook.mockRestore()
  }
}
