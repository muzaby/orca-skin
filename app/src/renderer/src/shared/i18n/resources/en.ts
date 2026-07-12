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
    copy: 'Copy',
    copyMessage: 'Copy message',
    copyCode: 'Copy code',
    editTitle: 'Edit title',
    newChat: 'New chat',
    running: 'Running',
    stop: 'Stop'
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
    },
    transcript: {
      loading: 'Loading conversation…',
      emptyPrompt: 'Send your first message to Claude Code.',
      lineageFork: 'This session was forked from <hl>‘{{label}}’</hl>',
      lineageHandoff: 'This session was handed off from <hl>‘{{label}}’</hl>',
      openParent: 'Open original',
      openParentTitle: 'Open the original session',
      forkBoundary: 'Forked here',
      compactAuto: 'Auto-compacted',
      compactManual: 'Previous conversation compacted',
      compactTokensRange: '{{pre}} → {{post}} tokens',
      compactTokensCompressed: '{{pre}} tokens compacted',
      forkHere: 'Fork from here'
    },
    toolMeta: {
      verb: {
        ran: 'Ran',
        created: 'Updated',
        edited: 'Edited',
        read: 'Read',
        used: 'Used',
        planned: 'Proposed plan',
        requested: 'Requested',
        delegated: 'Ran'
      },
      verbActive: {
        ran: 'Running',
        created: 'Updating',
        edited: 'Editing',
        read: 'Reading',
        used: 'Using',
        planned: 'Proposing a plan',
        requested: 'Asking',
        delegated: 'Running'
      },
      aborted: 'Aborted',
      planDescription: 'Proposed plan',
      unit: {
        command_one: '{{count}} command',
        command_other: '{{count}} commands',
        file_one: '{{count}} file',
        file_other: '{{count}} files',
        tool_one: '{{count}} tool',
        tool_other: '{{count}} tools',
        question_one: '{{count}} question',
        question_other: '{{count}} questions',
        agent_one: '{{count}} agent',
        agent_other: '{{count}} agents'
      },
      runningAgents_one: '{{count}} agent running',
      runningAgents_other: '{{count}} agents running',
      toolUses_one: '{{count}} tool use',
      toolUses_other: '{{count}} tool uses',
      durationSec: '{{s}}s',
      durationMinSec: '{{m}}m {{s}}s',
      tokens: '{{n}} tokens',
      tokensK: '{{n}}k tokens',
      agentFallback: 'Agent',
      agentStatus: {
        running: 'Agent running',
        completed: 'Agent completed',
        aborted: 'Agent aborted',
        failed: 'Agent failed'
      },
      subagentHeading: 'Subagent',
      subagentTypeLine: 'Type: {{type}}',
      openSubagentPanel: 'Open subagent panel'
    },
    subagentTile: {
      status: {
        running: 'In progress',
        completed: 'Completed',
        failed: 'Failed',
        aborted: 'Aborted'
      },
      backToList: 'Back to list',
      headerTitle: 'Background tasks',
      noChildActivity: 'No child activity recorded for this task.',
      emptyTitle: 'No background tasks',
      emptyDesc: 'Task tool calls will appear here when detected.',
      openTranscriptAria: 'View transcript for {{description}}',
      viewTranscript: 'View transcript'
    },
    composer: {
      modes: {
        plan: {
          label: 'Plan',
          desc: 'Read-only — explores and analyzes code, planning only (no edits).'
        },
        default: {
          label: 'Default',
          desc: 'Standard behavior — asks for confirmation on risky actions as they come up.'
        },
        accept_edits: {
          label: 'Accept edits',
          desc: 'Automatically accepts file edits (applied without confirmation).'
        },
        auto_classified: {
          label: 'Auto-classified',
          desc: 'The model classifies risk and auto-approves safe actions.'
        },
        dont_ask: {
          label: "Don't ask",
          desc: 'Skips Orca approval prompts and follows the default auto-proceed policy.'
        },
        bypass: {
          label: 'Bypass permissions',
          desc: 'Skips sandbox/approval permission checks as much as possible — very risky.'
        },
        riskyConfirm: 'All approval gates will be disabled. Click once more to confirm.'
      },
      effort: {
        low: { label: 'Low', desc: 'Prioritizes fast responses.' },
        medium: { label: 'Medium', desc: 'Balances speed and thinking depth.' },
        high: { label: 'High', desc: 'Default. Works with sufficient thinking depth.' },
        xhigh: { label: 'Very high', desc: 'Thinks more deeply for complex tasks.' },
        max: { label: 'Max', desc: 'Uses the deepest thinking budget.' }
      },
      handoffNoSession: 'No session to hand off',
      handoffWaitTurn: 'Try again after the response completes',
      handoffNeedMoreTurns: 'Available after the conversation progresses further',
      scrollToBottom: 'Scroll to bottom',
      concurrencyNoticeTitle: 'Another task is running in the same project.',
      concurrencyNoticeBody:
        'File conflicts are possible. Orca does not block the task; whether to run concurrently is up to you.',
      queuedNoticeTitle: 'Waiting for connection.',
      queuedNoticeBody:
        'This message will be sent in order as soon as the previous new chat session is ready.',
      backendTitle: 'Backend: {{label}}',
      placeholderFeedback: 'Send feedback… (Enter to send / Shift+Enter for newline)',
      placeholderIdle: 'Type / to see skills.',
      inputAria: 'Message input',
      abortUnsupported: 'This backend does not support aborting',
      sendFeedback: 'Send feedback',
      sendFeedbackEnter: 'Send feedback (Enter)',
      send: 'Send',
      sendEnter: 'Send (Enter)',
      permissionModeTitle: 'Permission mode',
      attachMenuTitle: 'More menu',
      modelSelectTitle: 'Select model',
      modelFallback: 'Model',
      effortTitle: 'Effort',
      contextTitle: 'Context ~{{used}}k / {{window}}k tokens · view usage',
      contextLimitNear: 'context limit approaching',
      contextUsageAria: 'Context usage: {{pct}}%',
      attach: 'Attach',
      attachRemoveAria: 'Remove attachment {{name}}',
      fileAutocompleteAria: 'File path autocomplete',
      loadingShort: 'Loading…',
      noMatches: 'No matching items',
      skillAutocompleteAria: 'Skill autocomplete',
      noModels: 'No models available.',
      sdkDefaultModel: 'SDK default',
      cwdOpenAria: 'Open working folder',
      cwdSelectAria: 'Select working folder'
    },
    status: {
      warn: {
        pill: 'This conversation is getting long',
        detail: 'Details',
        title: 'The conversation is getting long',
        description: 'You can keep going, but a light cleanup will make it flow more smoothly.',
        length: 'On the long side',
        usage: 'A bit above average',
        actionButton: 'Summarize the conversation',
        disclaimer: 'These figures are estimates and may differ slightly from reality.'
      },
      danger: {
        pill: 'This conversation is very long — cleanup needed',
        detail: 'Details',
        title: 'The conversation is very long',
        description:
          'It is better to move to a new session (handoff) that inherits a summary. Everything so far will be kept.',
        length: 'Very long',
        usage: 'On the high side',
        actionButton: 'Continue via handoff',
        disclaimer: 'These figures are estimates and may differ slightly from reality.'
      },
      lengthLabel: 'Conversation length',
      usageTodayLabel: "Today's usage",
      costTodayLabel: "Today's cost",
      handoffHint: 'Continue in a new session with a summary',
      compactHint: 'Compacts the current session history'
    },
    approval: {
      toolAria: 'Tool execution approval',
      toolRequest: 'Claude is requesting permission to run {{tool}}',
      deny: 'Deny',
      allowSessionTitle: 'Auto-allow the same tool for this session',
      allowSession: 'Allow for session',
      allow: 'Allow',
      planAria: 'Plan approval',
      planProposed: 'Claude proposed a plan',
      openPlan: 'Open plan',
      commentEditTitle: 'Edit comment',
      commentDelete: 'Delete comment',
      revisePlaceholder: 'Anything to add?',
      reviseInputAria: 'Revision suggestion',
      reviseFirst: 'Enter your revision suggestion first',
      reviseOpen: 'Revise…',
      revise: 'Revise',
      accept: 'Accept'
    },
    ask: {
      aria: 'Clarifying question',
      multiSelect: 'Multiple selections allowed',
      prevQuestion: 'Previous question',
      nextQuestion: 'Next question',
      skip: 'Skip',
      otherPlaceholder: 'Other — type your own…',
      otherInputAria: '{{header}} other free-form input',
      submit: 'Submit',
      next: 'Next'
    },
    rightpanel: {
      tiles: {
        plan: 'Plan',
        subagent: 'Background tasks',
        reserved1: 'Reserved 1',
        reserved2: 'Reserved 2'
      },
      closeTile: 'Close {{label}}',
      panelResizeAria: 'Resize right panel',
      rowResizeAria: 'Resize panel row',
      colResizeAria: 'Resize panel column',
      planCopy: 'Copy plan',
      planEmptyTitle: 'No plan yet',
      planEmptyDesc: 'It will appear here as Claude explores and builds a plan.',
      planSelectHint: 'Select text to leave feedback for Claude',
      reservedTitle: 'Reserved tile',
      reservedDesc: 'This area is reserved for an upcoming auxiliary panel feature.',
      commentViewAria: 'View comment',
      commentCreateAria: 'Write comment: {{quote}}',
      commentEditAria: 'Edit comment: {{quote}}',
      commentPlaceholder: 'Add a comment…',
      commentInputAria: 'Comment content',
      commentSubmit: 'Comment'
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
