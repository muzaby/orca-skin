import { expectTypeOf, it } from 'vitest'
import type { RouterContext } from '../context'
import type { registerBootHandlers } from './boot'
import type { registerCostHandlers } from './cost'
import type { registerEngineHandlers } from './engine'
import type { registerFilesHandlers } from './files'
import type { registerMcpHandlers } from './mcp'
import type { registerMiscHandlers } from './misc'
import type { registerProjectHandlers } from './project'
import type { registerSessionHandlers } from './session'
import type { registerSettingsHandlers } from './settings'
import type { registerSkillsHandlers } from './skills'
import type { registerUpdateHandlers } from './update'

// 타입 검사는 typecheck:test가 수행한다. Electron 모듈은 타입만 읽고 실제 로드하지 않는다.
it('handler parameters expose only the consumed composition properties', () => {
  expectTypeOf<keyof Parameters<typeof registerBootHandlers>[0]>().toEqualTypeOf<'getBootReport'>()
  expectTypeOf<keyof Parameters<typeof registerCostHandlers>[0]>().toEqualTypeOf<'cost'>()
  expectTypeOf<keyof Parameters<typeof registerUpdateHandlers>[0]>().toEqualTypeOf<'updates'>()
  expectTypeOf<keyof Parameters<typeof registerFilesHandlers>[0]>().toEqualTypeOf<'db' | 'getCwd'>()
  expectTypeOf<keyof Parameters<typeof registerProjectHandlers>[0]>().toEqualTypeOf<'db'>()
  expectTypeOf<keyof Parameters<typeof registerSessionHandlers>[0]>().toEqualTypeOf<
    'db' | 'settings' | 'getCwd'
  >()
  expectTypeOf<keyof Parameters<typeof registerSettingsHandlers>[0]>().toEqualTypeOf<
    'settings' | 'scheduler'
  >()
  expectTypeOf<keyof Parameters<typeof registerMcpHandlers>[0]>().toEqualTypeOf<
    'mcp' | 'deployExtensions'
  >()
  expectTypeOf<keyof Parameters<typeof registerSkillsHandlers>[0]>().toEqualTypeOf<
    'getSkills' | 'settings' | 'deployExtensions' | 'refreshSkills'
  >()
  expectTypeOf<keyof Parameters<typeof registerMiscHandlers>[0]>().toEqualTypeOf<
    'registry' | 'harnessSettings' | 'runtimeModelCatalog' | 'debugMock'
  >()
  expectTypeOf<keyof Parameters<typeof registerEngineHandlers>[0]>().toEqualTypeOf<
    'deployExtensions' | 'harnessSettings' | 'harnessRuntime' | 'runtimeModelCatalog'
  >()
  expectTypeOf<Extract<keyof RouterContext, 'auth' | 'gate'>>().toBeNever()
})
