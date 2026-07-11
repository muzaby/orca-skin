// 영어 UI 카탈로그(0096). `typeof ko` 선언으로 ko 와의 키 패리티(누락/초과)를 컴파일 타임에
// 강제한다 — 새 키는 항상 ko.ts 에 먼저 추가하고 여기 번역을 채운다.

import type { ko } from './ko'

export const en: typeof ko = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    unlimited: 'Unlimited',
    unknown: 'Unknown',
    confirm: 'Confirm',
    delete: 'Delete',
    rename: 'Rename',
    more: 'More',
    copied: 'Copied',
    copyMessage: 'Copy message',
    copyCode: 'Copy code',
    editTitle: 'Edit title',
    newChat: 'New chat'
  },
  nav: {
    chat: '01 Chat',
    projects: '02 Projects',
    projectsBreadcrumb: 'Projects',
    engine: '03 Engine & Models',
    engineBreadcrumb: 'Settings · Engine & Models',
    skills: '04 Skills / MCP',
    skillsBreadcrumb: 'Settings · Skills & MCP',
    captures: '05 Capture History',
    capturesBreadcrumb: 'Capture History'
  },
  search: {
    placeholder: 'Search conversations…',
    inputAria: 'Search conversations',
    typeToSearch: 'Type to search',
    noMatches: 'No matching messages',
    noTitle: 'Untitled'
  },
  sessions: {
    deleteDialogTitle: 'Delete conversation',
    deleteDialogMessage: 'Delete this conversation?',
    menuAria: 'Session menu',
    renameAria: 'Edit session title'
  },
  errors: {
    category: {
      provider_connection_error: 'Backend connection error',
      auth_error: 'Authentication error',
      permission_denied: 'Permission denied',
      tool_execution_error: 'Tool execution error',
      stream_error: 'Stream error',
      capability_unsupported: 'Unsupported capability',
      schema_validation_error: 'Input validation error',
      user_cancelled: 'Cancelled by user'
    },
    turnError: 'Error: {{category}}',
    retryable: 'Retryable',
    transientHint: 'This may be a transient error. Try sending again.',
    retrying: 'Retry {{attempt}}/{{max}}',
    loginFailed: 'Login failed. Please try again.',
    updateDownloadFailed: 'Could not start the update download.',
    updateInstallFailed: 'Could not start the update installation.',
    agentListFailed: 'Failed to load the agent list',
    engineMutationFailed: 'Engine operation failed'
  },
  notify: {
    completeBody: 'The response is complete.'
  },
  chat: {
    titleBar: {
      renameAria: 'Edit conversation title',
      copyAll: 'Copy entire conversation',
      tilesButton: 'Right panel tiles',
      tilesHeader: 'Show tiles',
      roleUser: 'User'
    }
  },
  sidebar: {
    nav: {
      newChat: 'New chat',
      projects: 'Projects',
      engine: 'Engine & Models',
      skills: 'Skills & MCP'
    },
    recents: 'Recents',
    resizeAria: 'Resize sidebar'
  },
  userMenu: {
    settings: 'Settings',
    language: 'Language',
    displayLanguage: 'App display language'
  },
  header: {
    systemMenu: 'System menu',
    collapseSidebar: 'Collapse sidebar',
    search: 'Search',
    back: 'Back',
    forward: 'Forward',
    update: 'Update',
    version: 'Version',
    quit: 'Quit',
    versionModalAria: 'Orca version'
  },
  settings: {
    title: 'Settings',
    tabs: {
      general: 'General',
      usage: 'Usage'
    },
    providerNotFound: 'Provider not found.',
    general: {
      profile: 'Profile',
      accountInstructions: 'Account instructions',
      accountInstructionsDesc:
        'Instructions applied to every conversation. Persisted after saving; system prompt wiring will be provided later.',
      accountPlaceholder: 'e.g. Ask questions before giving a detailed explanation.',
      preferences: 'Preferences',
      appearance: 'Appearance',
      appearanceDesc: 'App color theme',
      themeWhite: 'White',
      themeDark: 'Dark',
      font: 'Font',
      fontDesc: 'Font applied across the app',
      fontSans: 'Sans-serif (Inter)',
      fontSerif: 'Serif (Source Serif)',
      fontMono: 'Mono (JetBrains Mono)',
      language: 'Language',
      languageDesc: 'Display language for the app UI and date formatting',
      scheduling: 'Periodic tasks',
      usageRecompute: 'Usage refresh',
      usageRecomputeDesc:
        'Recomputes usage aggregates on the saved schedule, only while the app is running.',
      usageRecomputeToggle: 'Periodic usage refresh',
      refreshInterval: 'Refresh interval',
      refreshIntervalDesc: 'Choose a cron expression or a preset.',
      presetHourly: 'Every hour',
      preset30m: 'Every 30 minutes',
      presetDaily9: 'Daily at 9 AM',
      presetCustom: 'Custom',
      cronAria: 'Usage refresh cron',
      notifications: 'Notifications',
      notifyComplete: 'Response complete',
      notifyCompleteDesc:
        'Get notified when the agent completes a response. (Shown only while the app window is inactive)',
      notifyCompleteToggle: 'Response complete notification'
    },
    usage: {
      title: 'Usage summary',
      descPrefix: "Like Claude Code's ",
      descSuffix:
        ', a summary of total cost, token usage (input/output/cache), and per-model breakdown is planned.',
      comingSoon: 'Coming soon',
      comingSoonDesc:
        'Per-provider usage and spending limits are available in the sub-items on the left.'
    }
  },
  usage: {
    weekly: 'Weekly',
    monthly: 'Monthly',
    pctUsed: '{{pct}}% used',
    loading: 'Loading usage information…',
    lastUpdated: 'Last updated',
    refreshAria: 'Refresh usage',
    usageLimit: 'Usage limits',
    limitSettings: 'Limit settings',
    monthlyLimit: 'Monthly usage limit',
    monthlyLimitDesc: 'Set the monthly spending limit for this provider',
    setLimitTitle: 'Set monthly spending limit — {{provider}}',
    setLimitDesc: 'Set a monthly spending limit.',
    limitInputAria: 'Monthly spending limit (USD)',
    appliesImmediately: 'This spending limit takes effect immediately.',
    setUnlimited: 'Set unlimited',
    setLimit: 'Set spending limit',
    backToUsage: 'Usage',
    contextWindow: 'Context window',
    openUsageSettingsAria: 'Open usage limit settings'
  }
}
