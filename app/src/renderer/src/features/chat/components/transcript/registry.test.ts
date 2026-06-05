import { describe, it, expect } from 'vitest'
import { toolRendererRegistry } from './registry'

describe('ToolRendererRegistry.resolve', () => {
  it('Bash/PowerShell → command', () => {
    expect(toolRendererRegistry.resolve('Bash').kind).toBe('command')
    expect(toolRendererRegistry.resolve('PowerShell').kind).toBe('command')
  })

  it('Write/Edit/MultiEdit → file_edit', () => {
    expect(toolRendererRegistry.resolve('Write').kind).toBe('file_edit')
    expect(toolRendererRegistry.resolve('Edit').kind).toBe('file_edit')
    expect(toolRendererRegistry.resolve('MultiEdit').kind).toBe('file_edit')
  })

  it('Read → file_read, AskUserQuestion → ask', () => {
    expect(toolRendererRegistry.resolve('Read').kind).toBe('file_read')
    expect(toolRendererRegistry.resolve('AskUserQuestion').kind).toBe('ask')
  })

  it('미지 도구 → generic 폴백', () => {
    expect(toolRendererRegistry.resolve('SomeUnknownTool').kind).toBe('generic')
    expect(toolRendererRegistry.resolve('mcp__foo__bar').kind).toBe('generic')
  })
})
