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
    stop: 'Stop',
    add: 'Add',
    create: 'Create',
    count: '{{count}}',
    loading: 'Loading…',
    description: 'Description',
    noDescription: 'No description.',
    menu: 'Menu'
  },
  boot: {
    label: 'Booting',
    preparingSr: 'Preparing the app',
    errorTitle: 'A problem occurred while preparing the app.',
    retry: 'Retry boot'
  },
  cost: {
    approx: '~${{usd}}'
  },
  landing: {
    newChatGreeting: 'How can I help you?'
  },
  markdown: {
    imagePlaceholder: '[Image: {{label}}]'
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
    renameAria: 'Edit session title',
    empty: 'No saved conversations yet.'
  },
  skills: {
    listTitle: 'Skills',
    rail: { skills: 'Skills', mcp: 'MCP' },
    landing: {
      title: 'Customize',
      subtitle: 'Skills and MCP shape how Orca works with you.',
      mcpCardTitle: 'Connect MCP',
      mcpCardDesc: 'Let Orca read and write with the tools you already use.',
      skillCardTitle: 'Create a new skill',
      skillCardDesc: 'Teach Orca your processes, team norms, and expertise.'
    },
    list: {
      searchAria: 'Search',
      addAria: 'Add',
      off: 'Off',
      activeMcp: 'Active MCP',
      inactiveMcp: 'Inactive MCP'
    },
    view: { selectItem: 'Select an item.' },
    detail: {
      toggleAria: 'Enable {{name}}',
      tryInChat: 'Try in chat',
      openDefaultApp: 'Open in default app',
      showInFolder: 'Show in folder',
      remove: 'Remove',
      removing: 'Removing…',
      lastUpdated: 'Last updated',
      noBody: 'No body content.',
      markdownAria: 'Markdown',
      removeTitle: 'Remove skill',
      removeConfirmBody:
        'This removes the following folder from Orca skill sources. Confirm once more to continue.'
    },
    addMenu: {
      browse: 'Browse skills',
      create: 'Create skill',
      author: 'Write skill instructions',
      upload: 'Upload skill'
    },
    author: {
      title: 'Write skill instructions',
      name: 'Skill name',
      desc: 'Description',
      descPlaceholder: 'Generates a weekly status report from recent work.',
      instructions: 'Instructions',
      instructionsPlaceholder:
        'Summarize recent work into three sections: outcomes, blockers, and next steps...',
      saving: 'Saving…',
      failed: 'Failed to create the skill.'
    },
    upload: {
      title: 'Upload skill',
      dropHint: 'Drag and drop, or click to upload',
      requirements: 'File requirements',
      reqLine1: 'A .md or .skill file containing YAML frontmatter and skill instructions',
      reqLine2: 'The uploaded file is saved as SKILL.md in Orca skill sources',
      failed: 'Failed to upload the skill.'
    },
    customMcp: {
      title: 'Add MCP server',
      pasteHint: 'Paste a single MCP server JSON entry to merge it into Orca sources mcp.json.',
      adding: 'Adding…',
      failed: 'Failed to add the MCP server.',
      jsonObject: 'Enter a JSON object.',
      singleEntry: 'Enter exactly one MCP server entry.',
      nameFormat: 'Server names may only contain letters, digits, _ and -.',
      invalidConfig: 'The server configuration is invalid.'
    },
    mcpDetail: {
      active: 'Active',
      inactive: 'Inactive',
      enable: 'Enable',
      disable: 'Disable',
      configSummary: 'Configuration summary'
    },
    addServer: {
      titleAdd: 'Add MCP server',
      titleEdit: 'Edit MCP server',
      name: 'Name',
      namePlaceholder: 'e.g. github',
      nameFormatError: 'Only letters, digits, _ and - are allowed.',
      descOptional: 'Description (optional)',
      descPlaceholder: 'What tools this server provides',
      transport: 'Transport',
      stdioOption: 'stdio (local process)',
      httpOption: 'HTTP (streamable)',
      command: 'Command',
      commandPlaceholder: 'e.g. npx · python · node',
      args: 'Arguments (one per line)',
      authEnvName: 'Auth environment variable name (optional)',
      authEnvPlaceholder: 'e.g. GITHUB_TOKEN',
      authEnvPlaceholderHttp: 'e.g. API_TOKEN — leave empty to auto-generate',
      authKeyOptional: 'Auth key (optional)',
      authTokenOptional: 'Auth token (optional)',
      keepEmptyToPreserve: 'Leave empty to keep unchanged',
      encryptedNote: 'Stored securely with encryption'
    }
  },
  projects: {
    title: 'Projects',
    newProject: 'New project',
    blurb:
      'Projects group conversations into categories and automatically inject your system instructions into every new conversation in the project.',
    noInstructions: 'No instructions',
    emptyTitle: 'No projects yet',
    emptyDesc:
      'Create a project to keep related conversations in one place, with your instructions automatically applied to every new conversation.',
    createFirst: 'Create your first project',
    create: {
      title: 'New project',
      name: 'Name',
      namePlaceholder: 'e.g. cam-validation-v3',
      instructionsOptional: 'Instructions (optional)',
      instructionsPlaceholder:
        "Instructions that tailor Claude's responses to this project. e.g. Respond in Korean; use TypeScript for code examples."
    },
    editInstructions: {
      title: 'Edit instructions',
      body: 'Appended as a system prompt to every new message in <mono>{{name}}</mono>.',
      placeholder:
        'e.g. Respond in Korean; use TypeScript for code examples. Keep a concise validation-engineer tone.'
    },
    hero: {
      pin: 'Pin',
      pinAria: 'Pin project',
      menuAria: 'Project menu',
      editDetails: 'Edit details',
      updated: 'Updated'
    },
    filesCard: { title: 'Files', addTitle: 'Add file (coming soon)' },
    instructionsCard: { title: 'Instructions', editTitle: 'Edit instructions' },
    sessionsPanel: { title: 'Conversations in this project' },
    landingHeader: {
      navAria: 'Project navigation',
      backAria: 'Back to all projects',
      all: 'All projects'
    }
  },
  engine: {
    title: 'Engine & Models',
    subtitle: 'Provider settings environment',
    addEngine: 'Add engine',
    blurb:
      'The Composer model menu is built from the provider settings in <c>~/.config/orca/sources/settings</c>. After editing, the model menu refreshes without restarting the app.',
    emptyState: 'No providers registered. Use the Add engine button to create a claude provider.',
    deleteConfirm: 'Delete provider {{name}}?',
    readSettingsFailed: 'Failed to load the settings.',
    sdkDefaultModel: 'SDK default',
    provider: {
      anthropic: { label: 'Anthropic', desc: 'api.anthropic.com default' },
      bedrock: { label: 'Amazon Bedrock', desc: 'AWS credentials' },
      vertex: { label: 'Google Vertex AI', desc: 'GCP project' },
      custom: { label: 'Custom', desc: 'Manual setup, e.g. gateways' }
    },
    validation: {
      nameRequired: 'Enter a provider name.',
      nameFormat: 'Only letters, digits, _ and - are allowed.',
      jsonRequired: 'Enter the settings.json content.',
      jsonSyntaxAt: 'Invalid JSON — malformed around line {{line}}, character {{col}}.',
      jsonSyntax: 'Invalid JSON — {{reason}}',
      jsonSyntaxUnknown: 'Invalid JSON — unknown error',
      topLevelObject: 'The top level must be an object { … }.'
    },
    form: {
      titleEdit: 'Edit engine settings',
      titleAdd: 'Add engine',
      provider: 'Provider',
      providerName: 'Provider name',
      namePlaceholder: 'e.g. my-gateway',
      nameFixedHint: 'Fixed to the selected provider name. Choose ‘Custom’ to change it.',
      importTitle: 'Fills the body with the contents of ~/.claude/settings.json.',
      importButton: 'Import ~/.claude/settings.json',
      importNotFound: 'Could not find ~/.claude/settings.json.',
      importFailed: 'Failed to load ~/.claude/settings.json.',
      saveFailed: 'Failed to save.',
      jsonValid: '✓ Valid JSON.',
      envHint:
        'Put API keys, regions, etc. in the <c>env</c> block. Keeping secrets as <c>{{varToken}}</c> placeholders is recommended.',
      saving: 'Saving…',
      adding: 'Adding…',
      addAction: 'Add'
    }
  },
  backend: {
    installed: 'Installed',
    notInstalled: 'Install required',
    supportedTitle: 'Supported features: {{list}}',
    capability: {
      continue: 'Continue',
      resume: 'Resume',
      fork: 'Fork',
      abort: 'Abort',
      structuredOutput: 'Structured output'
    },
    installer: {
      title: 'Install Claude Code',
      cliRequired: 'The Claude Code CLI is required to use chat.',
      preparing: 'Preparing…',
      installing: 'Installing…',
      done: 'Done',
      start: 'Start installation',
      failedPrefix: 'Installation failed:',
      copyCommand: 'Copy command'
    },
    authExpired: {
      title: 'Claude Code authentication expired',
      body: 'Run the command below in a terminal, then start a new conversation.'
    }
  },
  update: {
    dialogTitle: 'Orca update',
    status: {
      idle: 'Waiting for update',
      checking: 'Checking for updates…',
      available: 'A new update is ready.',
      downloading: 'Downloading update…',
      ready: 'Download complete. Restart to install.',
      installing: 'Starting update installation…',
      error: 'Update error.'
    },
    statusFallback: 'Checking update status.',
    currentVersion: 'Current version',
    newVersion: 'New version',
    checkingShort: 'Checking',
    progress: 'Download progress',
    releaseNotes: 'Release notes',
    installBlockedFallback: 'A task is in progress — try again once it finishes.',
    later: 'Later',
    action: {
      ready: 'Restart to update',
      downloading: 'Downloading…',
      installing: 'Starting installation…',
      update: 'Update'
    },
    debug: { section: 'Update', dummy: 'Dummy update' }
  },
  debug: {
    title: 'Debug',
    mockMode: 'Mock mode',
    scenario: 'Scenario',
    contextUsage: 'Context usage',
    wireLog: 'Wire messages',
    themeSection: 'Theme',
    palette: 'Color palette',
    layoutSection: 'Layout',
    density: 'Density',
    densityCompact: 'Compact',
    densityNormal: 'Normal',
    densityComfortable: 'Comfortable',
    scenarios: {
      text_streaming: 'Text streaming',
      reasoning: 'Reasoning block',
      tool_calls: 'Tool calls',
      tool_approval: 'Tool approval',
      ask_question: 'User question',
      plan_review: 'Plan review',
      subagent_task: 'Subagent',
      subagent_task_child: 'Subagent child',
      subagent_task_aborted: 'Subagent aborted',
      subagent_task_multi: 'Multiple subagents',
      subagent_task_running: 'Subagent running',
      error: 'Error',
      full: 'Full'
    }
  },
  login: {
    title: 'Login',
    ssoSection: 'SSO login',
    bypass: 'Login bypass',
    devButton: 'SSO dev button',
    loggingIn: 'Signing in',
    ssoButton: 'Sign in with SSO'
  },
  camera: {
    title: 'Hardware control',
    exposure: 'Exposure',
    analogGain: 'Analog gain',
    digitalGain: 'Digital gain',
    qualityMetrics: 'Quality metrics',
    capture: 'Capture',
    sequence: 'Sequence',
    futureScopeTitle: 'Out of v1 scope — Future Scope (PRD §9)'
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
        'Per-provider usage and spending limits are available in the sub-items on the left.',
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
      cronAria: 'Usage refresh cron'
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
