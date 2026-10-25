import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  catches,
  calls,
  property,
  productionFiles,
  sourceTree
} from '../../../../shared/error-report-scan.testlib'

interface Site {
  file: string
  ordinal: number
  line: number
  disposition: string
  id?: string
  event?: string
  title?: string
}
export const sites: Site[] = [
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 3,
    line: 1179,
    disposition: 'TOAST',
    id: 'T-last-cwd',
    event: 'chat.cwd-preference.save-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/settings/components/GeneralTab.tsx',
    ordinal: 0,
    line: 90,
    disposition: 'TOAST',
    id: 'T-harness-load',
    event: 'settings.harness.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/settings/components/GeneralTab.tsx',
    ordinal: 1,
    line: 109,
    disposition: 'TOAST',
    id: 'T-harness-save',
    event: 'settings.harness.save-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/skills/hooks/useNativeMcpCatalog.ts',
    ordinal: 0,
    line: 51,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/skills/hooks/useNativeMcpCatalog.ts',
    ordinal: 2,
    line: 132,
    disposition: 'TOAST',
    id: 'T-native-mcp-open',
    event: 'skills.native.open-failed',
    title: 'openFailed'
  },
  {
    file: 'features/skills/hooks/useNativeMcpCatalog.ts',
    ordinal: 1,
    line: 108,
    disposition: 'TOAST',
    id: 'T-native-toggle',
    event: 'skills.native.toggle-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/skills/components/customize/CatalogToggle.tsx',
    ordinal: 0,
    line: 25,
    disposition: 'TOAST',
    id: 'T-catalog-toggle',
    event: 'skills.catalog.toggle-failed',
    title: 'saveFailed'
  },
  // Owner subscription/cleanup has no user action; list failures have their own reporting path.
  {
    file: 'features/chat/lib/nativeResourceState.ts',
    ordinal: 0,
    line: 85,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/lib/nativeResourceState.ts',
    ordinal: 1,
    line: 91,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/harnesses/opencode/composer/composerCatalogState.ts',
    ordinal: 0,
    line: 107,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/harnesses/opencode/composer/composerCatalogState.ts',
    ordinal: 1,
    line: 128,
    disposition: 'CONSUMED'
  },
  { file: 'app/boot/bootStore.ts', ordinal: 0, line: 75, disposition: 'CONSUMED' },
  {
    file: 'app/boot/steps.ts',
    ordinal: 0,
    line: 167,
    disposition: 'TOAST',
    id: 'T1',
    event: 'boot.step.degraded',
    title: 'bootStepDegraded'
  },
  {
    file: 'app/hooks/useProjectCatalogSync.ts',
    ordinal: 0,
    line: 14,
    disposition: 'TOAST',
    id: 'T2',
    event: 'projects.refresh.failed',
    title: 'loadFailed'
  },
  {
    file: 'app/hooks/useProjectCatalogSync.ts',
    ordinal: 1,
    line: 15,
    disposition: 'TOAST',
    id: 'T3',
    event: 'sessions.project-load.failed',
    title: 'loadFailed'
  },
  { file: 'app/hooks/useProjectDeletion.ts', ordinal: 0, line: 32, disposition: 'CONSUMED' },
  {
    file: 'features/artifacts/store/artifactCatalogStore.ts',
    ordinal: 0,
    line: 39,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/artifacts/store/artifactCatalogStore.ts',
    ordinal: 1,
    line: 65,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/backend/harnesses/claude/components/InstallerDialog.tsx',
    ordinal: 0,
    line: 56,
    disposition: 'CONSUMED'
  },
  { file: 'features/backend/store/backendStore.ts', ordinal: 0, line: 29, disposition: 'EXCLUDE' },
  {
    file: 'features/chat/harnesses/common/composer/toolApproval.ts',
    ordinal: 0,
    line: 33,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/chat/components/ChatTitleBar.tsx',
    ordinal: 0,
    line: 118,
    disposition: 'TOAST',
    id: 'T9',
    event: 'clipboard.copy.failed',
    title: 'copyFailed'
  },
  {
    file: 'features/chat/harnesses/common/composer/BranchChip.tsx',
    ordinal: 0,
    line: 83,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/chat/harnesses/common/composer/BranchChip.tsx',
    ordinal: 1,
    line: 98,
    disposition: 'TOAST',
    id: 'T11',
    event: 'git.branch-status.failed',
    title: 'loadFailed'
  },
  {
    file: 'features/chat/harnesses/common/composer/BranchChip.tsx',
    ordinal: 2,
    line: 115,
    disposition: 'TOAST',
    id: 'T12',
    event: 'git.branch-list.failed',
    title: 'loadFailed'
  },
  {
    file: 'features/chat/harnesses/common/composer/BranchChip.tsx',
    ordinal: 3,
    line: 151,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/harnesses/common/composer/GitIdentityMenu.tsx',
    ordinal: 0,
    line: 48,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/harnesses/common/composer/useGitSnapshot.ts',
    ordinal: 0,
    line: 79,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/components/CwdButton.tsx',
    ordinal: 0,
    line: 47,
    disposition: 'TOAST',
    id: 'T10',
    event: 'files.cwd-action.failed',
    title: 'actionFailed'
  },
  {
    file: 'features/chat/harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx',
    ordinal: 0,
    line: 209,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/harnesses/common/rightpanel/DiffTileContent.tsx',
    ordinal: 0,
    line: 82,
    disposition: 'TOAST',
    id: 'T13',
    event: 'files.reveal.failed',
    title: 'openFailed'
  },
  {
    file: 'features/chat/hooks/useTaskContext.ts',
    ordinal: 0,
    line: 61,
    disposition: 'TOAST',
    id: 'T34',
    event: 'files.context-open.failed',
    title: 'openFailed'
  },
  {
    file: 'features/chat/harnesses/common/transcript/ForegroundShellActions.tsx',
    ordinal: 0,
    line: 82,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/harnesses/claude/transcript/tool-bodies/AskBody.tsx',
    ordinal: 0,
    line: 9,
    disposition: 'EXCLUDE'
  },
  { file: 'features/chat/format.ts', ordinal: 0, line: 8, disposition: 'EXCLUDE' },
  {
    file: 'features/chat/hooks/useArtifactViewerActions.ts',
    ordinal: 0,
    line: 47,
    disposition: 'TOAST',
    id: 'T35',
    event: 'artifacts.viewer-action.failed',
    title: 'actionFailed'
  },
  {
    file: 'features/chat/lib/nativeResourceState.ts',
    ordinal: 2,
    line: 125,
    disposition: 'TOAST',
    id: 'T38',
    event: 'chat.native-resources.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/chat/lib/nativeResourceState.ts',
    ordinal: 3,
    line: 175,
    disposition: 'TOAST',
    id: 'T39',
    event: 'chat.native-resources.open-failed',
    title: 'openFailed'
  },
  {
    file: 'features/chat/lib/nativeResourceState.ts',
    ordinal: 4,
    line: 211,
    disposition: 'TOAST',
    id: 'T40',
    event: 'chat.native-resources.control-failed',
    title: 'actionFailed'
  },
  { file: 'features/chat/hooks/useAttachments.ts', ordinal: 0, line: 57, disposition: 'EXCLUDE' },
  {
    file: 'features/chat/hooks/useAttachments.ts',
    ordinal: 1,
    line: 68,
    disposition: 'TOAST',
    id: 'T14',
    event: 'chat.attachment.pick-failed',
    title: 'attachFailed'
  },
  { file: 'features/chat/hooks/useAttachments.ts', ordinal: 2, line: 133, disposition: 'EXCLUDE' },
  { file: 'features/chat/hooks/useDiffSyntax.ts', ordinal: 0, line: 33, disposition: 'EXCLUDE' },
  {
    file: 'features/chat/hooks/useDirectoryPicker.ts',
    ordinal: 0,
    line: 79,
    disposition: 'CONSUMED'
  },
  { file: 'features/chat/hooks/useGitPatch.ts', ordinal: 0, line: 130, disposition: 'CONSUMED' },
  {
    file: 'features/chat/hooks/useMentionAutocomplete.ts',
    ordinal: 0,
    line: 55,
    disposition: 'TOAST',
    id: 'T15',
    event: 'chat.mention.providers-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/chat/hooks/useMentionAutocomplete.ts',
    ordinal: 1,
    line: 91,
    disposition: 'TOAST',
    id: 'T16',
    event: 'chat.mention.entries-failed',
    title: 'loadFailed'
  },
  { file: 'features/chat/lib/imageThumb.ts', ordinal: 0, line: 23, disposition: 'EXCLUDE' },
  { file: 'features/chat/lib/planCommentDom.ts', ordinal: 0, line: 67, disposition: 'EXCLUDE' },
  { file: 'features/chat/lib/planCommentDom.ts', ordinal: 1, line: 94, disposition: 'EXCLUDE' },
  { file: 'features/chat/lib/taskContext.ts', ordinal: 0, line: 44, disposition: 'EXCLUDE' },
  {
    file: 'features/chat/lib/workToolPresentation.ts',
    ordinal: 0,
    line: 35,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/chat/lib/workToolPresentation.ts',
    ordinal: 1,
    line: 172,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/chat/lib/workToolPresentation.ts',
    ordinal: 2,
    line: 229,
    disposition: 'EXCLUDE'
  },
  { file: 'features/chat/store/artifactStore.ts', ordinal: 0, line: 139, disposition: 'CONSUMED' },
  { file: 'features/chat/store/artifactStore.ts', ordinal: 1, line: 183, disposition: 'CONSUMED' },
  { file: 'features/chat/store/artifactStore.ts', ordinal: 2, line: 257, disposition: 'CONSUMED' },
  {
    file: 'features/chat/store/artifactViewerStore.ts',
    ordinal: 0,
    line: 40,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/store/artifactViewerStore.ts',
    ordinal: 1,
    line: 75,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/store/backgroundStore.ts',
    ordinal: 0,
    line: 170,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 0,
    line: 448,
    disposition: 'TOAST',
    id: 'T17',
    event: 'chat.new-send.rejected',
    title: 'sendFailed'
  },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 1,
    line: 978,
    disposition: 'TOAST',
    id: 'T18',
    event: 'chat.send.rejected',
    title: 'sendFailed'
  },
  { file: 'features/chat/store/chatStore.ts', ordinal: 2, line: 1011, disposition: 'CONSUMED' },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 4,
    line: 1115,
    disposition: 'TOAST',
    id: 'T19a',
    event: 'chat.steer-send-now.rejected',
    title: 'actionFailed'
  },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 5,
    line: 1085,
    disposition: 'TOAST',
    id: 'T19',
    event: 'chat.steer-cancel.rejected',
    title: 'actionFailed'
  },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 6,
    line: 1096,
    disposition: 'TOAST',
    id: 'T20',
    event: 'chat.session-discard.rejected',
    title: 'actionFailed'
  },
  { file: 'features/chat/store/chatStore.ts', ordinal: 7, line: 1133, disposition: 'CONSUMED' },
  { file: 'features/chat/store/chatStore.ts', ordinal: 8, line: 1153, disposition: 'CONSUMED' },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 9,
    line: 1407,
    disposition: 'TOAST',
    id: 'T21',
    event: 'chat.session-load.failed',
    title: 'sessionOpenFailed'
  },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 10,
    line: 1652,
    disposition: 'CONSUMED'
  },
  { file: 'features/chat/store/chatStore.ts', ordinal: 11, line: 1767, disposition: 'CONSUMED' },
  {
    file: 'features/chat/store/chatStore.ts',
    ordinal: 12,
    line: 1783,
    disposition: 'TOAST',
    id: 'T37',
    event: 'chat.harness-preference.save-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/debug/hooks/useDebugMock.ts',
    ordinal: 0,
    line: 25,
    disposition: 'TOAST',
    id: 'T22',
    event: 'debug.mock.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/debug/hooks/useDebugMock.ts',
    ordinal: 1,
    line: 36,
    disposition: 'TOAST',
    id: 'T23',
    event: 'debug.mock.save-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/engine/common/components/AgentEnvironmentView.tsx',
    ordinal: 0,
    line: 29,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/common/components/AgentEnvironmentView.tsx',
    ordinal: 1,
    line: 42,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/harnesses/opencode/ProviderForm.tsx',
    ordinal: 0,
    line: 1,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/harnesses/opencode/ProviderForm.tsx',
    ordinal: 1,
    line: 1,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/harnesses/opencode/v1/customProvider.ts',
    ordinal: 0,
    line: 1,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/engine/common/components/EngineFormModal.tsx',
    ordinal: 0,
    line: 91,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/common/components/EngineFormModal.tsx',
    ordinal: 1,
    line: 103,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/common/hooks/useEngines.ts',
    ordinal: 0,
    line: 38,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/engine/common/lib/providerCatalog.ts',
    ordinal: 0,
    line: 107,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/projects/components/EditInstructionsModal.tsx',
    ordinal: 0,
    line: 53,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/projects/store/projectsStore.ts',
    ordinal: 0,
    line: 26,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/providers/hooks/useProviderGate.ts',
    ordinal: 0,
    line: 41,
    disposition: 'TOAST',
    id: 'T24',
    event: 'providers.gate.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/providers/hooks/useProviderPrincipal.ts',
    ordinal: 0,
    line: 25,
    disposition: 'TOAST',
    id: 'T25',
    event: 'providers.principal.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/providers/store/bypassStore.ts',
    ordinal: 0,
    line: 32,
    disposition: 'TOAST',
    id: 'T26',
    event: 'providers.bypass.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/providers/store/bypassStore.ts',
    ordinal: 1,
    line: 45,
    disposition: 'TOAST',
    id: 'T27',
    event: 'providers.bypass.save-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/sessions/components/PinnedProjectsSection.tsx',
    ordinal: 0,
    line: 272,
    disposition: 'TOAST',
    id: 'T28',
    event: 'sessions.pinned-load.failed',
    title: 'loadFailed'
  },
  {
    file: 'features/sessions/components/ProjectSessionsPanel.tsx',
    ordinal: 0,
    line: 38,
    disposition: 'TOAST',
    id: 'T29',
    event: 'sessions.panel-load.failed',
    title: 'loadFailed'
  },
  {
    file: 'features/sessions/hooks/useProjectSessions.ts',
    ordinal: 0,
    line: 19,
    disposition: 'TOAST',
    id: 'T30',
    event: 'sessions.project-sessions.failed',
    title: 'loadFailed'
  },
  {
    file: 'features/sessions/store/sessionsStore.ts',
    ordinal: 0,
    line: 135,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/sessions/store/sessionsStore.ts',
    ordinal: 1,
    line: 213,
    disposition: 'EXCLUDE'
  },
  {
    file: 'features/settings/components/ProviderUsageTab.tsx',
    ordinal: 0,
    line: 78,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/settings/hooks/useUpdateCheckSetting.ts',
    ordinal: 0,
    line: 37,
    disposition: 'TOAST',
    id: 'T31',
    event: 'settings.update-check.save-failed',
    title: 'saveFailed'
  },
  {
    file: 'features/skills/components/customize/CustomMcpModal.tsx',
    ordinal: 0,
    line: 81,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/skills/components/customize/SkillAuthorModal.tsx',
    ordinal: 0,
    line: 37,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/skills/components/customize/SkillUploadModal.tsx',
    ordinal: 0,
    line: 25,
    disposition: 'CONSUMED'
  },
  {
    file: 'features/skills/hooks/useMcpServers.ts',
    ordinal: 0,
    line: 40,
    disposition: 'TOAST',
    id: 'T32',
    event: 'mcp.servers.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'features/skills/hooks/useProviders.ts',
    ordinal: 0,
    line: 40,
    disposition: 'TOAST',
    id: 'T33',
    event: 'skills.providers.load-failed',
    title: 'loadFailed'
  },
  { file: 'features/update/store/updateStore.ts', ordinal: 0, line: 83, disposition: 'CONSUMED' },
  { file: 'features/update/store/updateStore.ts', ordinal: 1, line: 120, disposition: 'CONSUMED' },
  { file: 'features/update/store/updateStore.ts', ordinal: 2, line: 146, disposition: 'CONSUMED' },
  { file: 'features/update/store/updateStore.ts', ordinal: 3, line: 158, disposition: 'CONSUMED' },
  {
    file: 'pages/ProjectLandingPage.tsx',
    ordinal: 0,
    line: 60,
    disposition: 'TOAST',
    id: 'T4',
    event: 'projects.retry.failed',
    title: 'loadFailed'
  },
  {
    file: 'shared/hooks/useSkills.ts',
    ordinal: 0,
    line: 13,
    disposition: 'TOAST',
    id: 'T5',
    event: 'skills.list.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'shared/stores/agentStore.ts',
    ordinal: 0,
    line: 27,
    disposition: 'TOAST',
    id: 'T6',
    event: 'agents.list.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'shared/theme/TweakProvider.tsx',
    ordinal: 0,
    line: 63,
    disposition: 'TOAST',
    id: 'T7',
    event: 'settings.tweak.save-failed',
    title: 'saveFailed'
  },
  // 0244 — 첫 설정 읽기 실패는 부팅 완료 뒤 한 번 더 읽는 폴백이다(보고하지 않는다). 재시도까지
  // 실패하면 바깥 catch 가 보고한다.
  { file: 'shared/theme/TweakProvider.tsx', ordinal: 1, line: 85, disposition: 'EXCLUDE' },
  {
    file: 'shared/theme/TweakProvider.tsx',
    ordinal: 2,
    line: 104,
    disposition: 'TOAST',
    id: 'T36',
    event: 'settings.tweak.load-failed',
    title: 'loadFailed'
  },
  {
    file: 'shared/ui/CopyIconButton.tsx',
    ordinal: 0,
    line: 23,
    disposition: 'TOAST',
    id: 'T8',
    event: 'clipboard.copy.failed',
    title: 'copyFailed'
  },
  { file: 'shared/ui/markdown/CodeBlock.tsx', ordinal: 0, line: 71, disposition: 'EXCLUDE' },
  { file: 'shared/ui/markdown/CodeBlock.tsx', ordinal: 1, line: 67, disposition: 'EXCLUDE' }
]
const root = fileURLToPath(new URL('../../', import.meta.url))
const read = (file: string): string => readFileSync(root + file, 'utf8')
function matches(site: Site, text: string): boolean {
  const body = catches(sourceTree(text, site.file))[site.ordinal]
  if (!body) return false
  const reports = calls(body, 'reportError')
  if (site.disposition !== 'TOAST') return reports.length === 0
  return (
    reports.length === 1 &&
    property(reports[0], 'event') === site.event &&
    property(reports[0], 'title') === site.title
  )
}
const silentPattern =
  /\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(undefined|null|\[\]|\{\s*\}|\{\s*\/\/[^\n]*\n\s*\})\s*\)/g
function silentMatches(file: string, text: string): string[] {
  return [...text.matchAll(silentPattern)].map((m) => file + ':' + m[0].replace(/\s+/g, ' '))
}
function expectedSilent(): string[] {
  return [
    'features/chat/hooks/useAttachments.ts:0',
    'features/chat/hooks/useAttachments.ts:2',
    'features/chat/hooks/useDiffSyntax.ts:0',
    'features/chat/lib/nativeResourceState.ts:0',
    'features/chat/lib/nativeResourceState.ts:1',
    'features/chat/harnesses/opencode/composer/composerCatalogState.ts:1',
    'shared/ui/markdown/CodeBlock.tsx:0'
  ]
    .map((key) => {
      const split = key.lastIndexOf(':')
      const file = key.slice(0, split)
      const ordinal = Number(key.slice(split + 1))
      const body = catches(sourceTree(read(file), file))[ordinal]
      return silentMatches(file, '.catch(' + body.getText() + ')')[0]
    })
    .sort()
}

describe('renderer report site registry', () => {
  for (const site of sites)
    it(site.disposition + ' ' + (site.id ?? site.file + ':' + site.line), () => {
      expect(matches(site, read(site.file))).toBe(true)
    })
  it('accounts for all baseline catches without a missing or extra ordinal', () => {
    const expected = sites.map((s) => s.file + ':' + s.ordinal).sort()
    const actual = [...new Set(sites.map((s) => s.file))]
      .flatMap((file) => catches(sourceTree(read(file), file)).map((_, i) => file + ':' + i))
      .sort()
    expect(actual.filter((s) => !expected.includes(s))).toEqual([])
    expect(expected.filter((s) => !actual.includes(s))).toEqual([])
  })
  it('rejects silent promise catches outside explicit fallback and owner cleanup sites', () => {
    const actual = productionFiles(root)
      .flatMap((file) => silentMatches(file, read(file)))
      .sort()
    expect(actual).toEqual(expectedSilent())
  })
  for (const site of sites.filter((s) => s.disposition === 'TOAST')) {
    it('detects removal of ' + site.id, () => {
      const text = read(site.file),
        source = sourceTree(text, site.file)
      const report = calls(catches(source)[site.ordinal], 'reportError')[0]
      const mutant = text.slice(0, report.getStart(source)) + 'undefined' + text.slice(report.end)
      expect(matches(site, mutant)).toBe(false)
    })
  }
  for (const site of sites.filter((s) => s.disposition !== 'TOAST')) {
    it('detects forbidden reporting in ' + site.file + ':' + site.line, () => {
      const text = read(site.file),
        source = sourceTree(text, site.file)
      const body = catches(source)[site.ordinal]
      const injected = body.getText().startsWith('catch')
        ? "catch (error) { reportError({ event: 'test.report.failed', title: 'unexpected', error }) }"
        : "(error) => { reportError({ event: 'test.report.failed', title: 'unexpected', error }) }"
      const mutant = text.slice(0, body.getStart(source)) + injected + text.slice(body.end)
      expect(matches(site, mutant)).toBe(false)
    })
  }
  // Check every same-file sibling pair; a file-wide string presence check misses these swaps.
  const toasted = sites.filter((s) => s.disposition === 'TOAST')
  const swaps: [Site, Site][] = []
  for (let a = 0; a < toasted.length; a++)
    for (let b = a + 1; b < toasted.length; b++) {
      if (toasted[a].file === toasted[b].file) swaps.push([toasted[a], toasted[b]])
    }
  swaps.push([toasted[0], toasted[1]])
  for (const [a, b] of swaps)
    it('detects swapped event slots ' + a.id + '/' + b.id, () => {
      const swapped = (text: string): string =>
        text
          .replaceAll(a.event!, '__swap__')
          .replaceAll(b.event!, a.event!)
          .replaceAll('__swap__', b.event!)
      expect(matches(a, swapped(read(a.file)))).toBe(false)
      expect(matches(b, swapped(read(b.file)))).toBe(false)
    })
  it('detects a new silent catch in an existing or a new production file', () => {
    expect(silentMatches('new.ts', 'task.catch(() => undefined)')).toHaveLength(1)
    const actual = productionFiles(root)
      .flatMap((file) => silentMatches(file, read(file)))
      .sort()
    expect(
      [...actual, ...silentMatches('new.ts', 'task.catch(() => undefined)')].sort()
    ).not.toEqual(expectedSilent())
  })
})
