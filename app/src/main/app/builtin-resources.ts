import { join } from 'node:path'

interface BuiltinResourcePathInput {
  isPackaged: boolean
  resourcesPath: string
  appPath: string
}

export function resolveBuiltinSkillsDir(input: BuiltinResourcePathInput): string {
  return input.isPackaged
    ? join(input.resourcesPath, 'builtin', 'skills')
    : join(input.appPath, 'resources', 'builtin', 'skills')
}
