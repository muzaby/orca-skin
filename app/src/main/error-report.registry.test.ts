import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  calls,
  property,
  productionFiles,
  sourceTree,
  enclosingFunction,
  logs
} from '../shared/error-report-scan.testlib'
const sites = [
  {
    id: 'M1',
    file: 'index.ts',
    event: 'app.unhandled.rejection',
    title: 'unexpected',
    method: 'reportError'
  },
  {
    id: 'M2',
    file: 'index.ts',
    event: 'app.uncaught.exception',
    title: 'unexpected',
    method: 'reportError'
  },
  {
    id: 'M4',
    file: 'app/harnesses/claude/extensions.ts',
    event: 'mcp.server.skipped',
    title: 'mcpServerSkipped',
    method: 'reportError'
  },
  {
    id: 'M5',
    file: 'app/harnesses/claude/extensions.ts',
    event: 'extensions.deploy.warning',
    title: 'extensionsFailed',
    method: 'reportError'
  },
  {
    id: 'M6',
    file: 'app/data-host/bootstrap.ts',
    event: 'auth.persistence.unavailable',
    title: 'authPersistenceUnavailable',
    method: 'reportError'
  },
  {
    id: 'M7',
    file: 'app/data-host/bootstrap.ts',
    event: 'auth.oauth.persistence.unavailable',
    title: 'authPersistenceUnavailable',
    method: 'reportError'
  },
  {
    id: 'M8',
    file: 'app/data-host/bootstrap.ts',
    event: 'auth.declaration.rejected',
    title: 'authDeclarationRejected',
    method: 'reportError'
  },
  {
    id: 'M10',
    file: 'app/data-host/bootstrap.ts',
    event: 'scheduler.settings.failed',
    title: 'scheduledJobFailed',
    method: 'reportError'
  },
  {
    id: 'M11',
    file: 'app/boot-report.ts',
    event: 'boot.step.failed',
    title: 'bootStepDegraded',
    method: 'reportError'
  },
  {
    id: 'M12',
    file: 'app/updater.ts',
    event: 'update.loader.failed',
    title: 'updaterUnavailable',
    method: 'reportError'
  },
  {
    id: 'M13',
    file: 'features/scheduler/scheduler.ts',
    event: 'scheduler.job.failed',
    title: 'scheduledJobFailed',
    method: 'publishErrorReport'
  },
  {
    id: 'M14',
    file: 'features/harnesses/common/settings.ts',
    event: 'providers.settings.resolve-failed',
    title: 'configInvalid',
    method: 'reportError'
  },
  {
    id: 'M15',
    file: 'features/harnesses/common/settings.ts',
    event: 'providers.settings.parse-failed',
    title: 'configInvalid',
    method: 'reportError'
  },
  {
    id: 'M16',
    file: 'features/extensions/claude/user-skills.ts',
    event: 'extensions.plugin.wrapper-failed',
    title: 'extensionsFailed',
    method: 'reportError'
  },
  {
    id: 'M17',
    file: 'features/chat/turn-coordinator.ts',
    event: 'chat.turn-event.emit-failed',
    title: 'eventDeliveryFailed',
    method: 'reportError'
  },
  {
    id: 'M17b',
    file: 'app/chat-turn/index.ts',
    event: 'chat.turn-event.emit-failed',
    title: 'eventDeliveryFailed',
    method: 'reportError'
  },
  {
    id: 'M18',
    file: 'features/sessions/session-runtime.ts',
    event: 'engine.channel.retirement-observer.failed',
    title: 'engineInternal',
    method: 'reportError'
  },
  {
    id: 'M19',
    file: 'adapters/claude/settings.ts',
    event: 'providers.settings.parse-failed',
    title: 'configInvalid',
    method: 'reportError'
  },
  {
    id: 'M22',
    file: 'infra/config/oo-config.ts',
    event: 'config.orcinus-orca.invalid',
    title: 'configInvalid',
    method: 'publishErrorReport'
  },
  {
    id: 'M22',
    file: 'infra/config/oo-config.ts',
    event: 'config.orcinus-orca.load-failed',
    title: 'configInvalid',
    method: 'reportError'
  },
  {
    id: 'M23',
    file: 'infra/bus/index.ts',
    event: 'bus.listener.failed',
    title: 'eventDeliveryFailed',
    method: 'reportError'
  },
  {
    id: 'M24',
    file: 'adapters/opencode/v1/channel.ts',
    event: 'opencode.channel.abort.failed',
    title: 'engineInternal',
    method: 'reportError'
  },
  {
    id: 'M25',
    file: 'adapters/claude/native-settings-file.ts',
    event: 'claude.native-settings.skipped',
    title: 'configInvalid',
    method: 'reportError'
  }
]
const root = fileURLToPath(new URL('./', import.meta.url))
const read = (file: string): string => readFileSync(root + file, 'utf8')
// Preserve each call's slot, including same-title siblings whose events could be swapped.
const slots: Record<string, number> = {
  M1: 0,
  M2: 1,
  M4: 0,
  M5: 1,
  M6: 0,
  M7: 1,
  M8: 2,
  M10: 3,
  M11: 0,
  M12: 0,
  M13: 0,
  M14: 0,
  M15: 1,
  M16: 0,
  M17: 0,
  M17b: 0,
  M18: 0,
  M19: 0,
  M22: 0,
  M23: 0,
  M24: 0,
  M25: 0
}
function matchingCalls(site: (typeof sites)[number], text: string): ReturnType<typeof calls> {
  return calls(sourceTree(text), site.method).filter(
    (call, ordinal) =>
      ordinal === slots[site.id] &&
      property(call, 'title') === site.title &&
      (site.method === 'reportError'
        ? property(call, 'event') === site.event
        : logs(enclosingFunction(call), site.event).length > 0)
  )
}
function publishingFiles(extra?: [string, string]): string[] {
  const files = productionFiles(root).filter((file) => file !== 'infra/error-report/index.ts')
  const result = files.filter(
    (file) => calls(sourceTree(read(file)), 'publishErrorReport').length > 0
  )
  if (extra && calls(sourceTree(extra[1]), 'publishErrorReport').length) result.push(extra[0])
  return result.sort()
}

describe('main report site registry', () => {
  for (const site of sites) {
    it(site.id + ' ' + site.event, () =>
      expect(matchingCalls(site, read(site.file))).toHaveLength(1)
    )
    it('detects removed report ' + site.id + ' ' + site.event, () => {
      const text = read(site.file),
        source = sourceTree(text)
      const call = matchingCalls(site, text)[0]
      const mutant = text.slice(0, call.getStart(source)) + 'undefined' + text.slice(call.end)
      expect(matchingCalls(site, mutant)).toHaveLength(0)
    })
    if (site.method === 'publishErrorReport')
      it('detects missing companion log ' + site.id, () => {
        const text = read(site.file),
          source = sourceTree(text)
        const call = logs(enclosingFunction(matchingCalls(site, text)[0]), site.event)[0]
        expect(
          matchingCalls(
            site,
            text.slice(0, call.getStart(source)) + 'undefined' + text.slice(call.end)
          )
        ).toHaveLength(0)
      })
  }
  for (let a = 0; a < sites.length; a++)
    for (let b = a + 1; b < sites.length; b++) {
      const left = sites[a],
        right = sites[b]
      if (left.file !== right.file || left.method !== right.method) continue
      it('detects swapped main event slots ' + left.id + '/' + right.id, () => {
        const mutant = read(left.file)
          .replaceAll(left.event, '__swap__')
          .replaceAll(right.event, left.event)
          .replaceAll('__swap__', right.event)
        expect(matchingCalls(left, mutant)).toHaveLength(0)
        expect(matchingCalls(right, mutant)).toHaveLength(0)
      })
    }
  it('restricts unlogged publication to scheduler and aggregate config warnings', () => {
    expect(publishingFiles()).toEqual([
      'features/scheduler/scheduler.ts',
      'infra/config/oo-config.ts'
    ])
  })
  it('detects a third publisher file', () => {
    expect(
      publishingFiles(['infra/extra.ts', 'publishErrorReport({ title: "unexpected" })'])
    ).toContain('infra/extra.ts')
    expect(
      publishingFiles(['infra/extra.ts', 'publishErrorReport({ title: "unexpected" })'])
    ).not.toEqual(publishingFiles())
  })
  // 0324 — 창에 보내는 싱크와 오류 채널은 데이터 호스트 조립이, 로그 채널은 셸이 등록한다. 둘 다
  // 그 프로세스에서 보고가 나올 수 있는 첫 자리보다 앞이다.
  it('installs delivery in the data host before its first await and logging in the shell before global handlers', () => {
    const dataHost = read('app/data-host/bootstrap.ts')
    const start = dataHost.slice(dataHost.indexOf('async start():'))
    const firstAwait = start.indexOf('await this.')
    for (const call of ['installErrorReportSink()', 'registerErrorHandlers()']) {
      expect(start.indexOf(call)).toBeGreaterThan(0)
      expect(start.indexOf(call)).toBeLessThan(firstAwait)
      expect(dataHost.split(call)).toHaveLength(2)
    }
    const shell = read('index.ts')
    const logging = shell.indexOf('registerLogHandlers()')
    expect(logging).toBeGreaterThan(0)
    expect(logging).toBeLessThan(shell.indexOf("process.on('unhandledRejection'"))
    expect(logging).toBeLessThan(shell.indexOf('function createWindow('))
    // 두 호스트의 전역 예외는 진입점이 넘긴 구독으로 같은 보고 경로를 탄다.
    const hostProcess = read('app/host-process.ts')
    expect(hostProcess).toMatch(/deps\.onProcessError\?\.\(\(kind, error\) => \{\s*reportError\(/)
    for (const entry of ['app/data-host/entry.ts', 'app/agent-host/entry.ts']) {
      expect(read(entry)).toContain("process.on('unhandledRejection'")
      expect(read(entry)).toContain("process.on('uncaughtException'")
    }
  })
})
