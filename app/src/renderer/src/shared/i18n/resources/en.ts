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
    edit: 'Edit',
    rename: 'Rename',
    pin: 'Pin',
    unpin: 'Unpin',
    expand: 'Expand',
    collapse: 'Collapse',
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
    resumingLabel: 'Restoring connections',
    resumingSr: 'Restoring your connections',
    errorTitle: 'A problem occurred while preparing the app.',
    retry: 'Retry boot'
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
    plugins: '04 Plugins',
    pluginsBreadcrumb: 'Settings · Plugins',
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
    empty: 'No saved conversations yet.',
    projectEmpty:
      'No conversations in this project yet. Send your first message from the input above.'
  },
  window: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    close: 'Close window'
  },
  captures: {
    title: 'Capture history & AI analysis',
    body: 'Coming soon. Capture RAW retention, per-channel metrics, automated ColorChecker / SFR / \u0394E analysis, and Claude analysis comments arrive in a later phase.'
  },
  gate: {
    title: 'Sign in',
    subtitle: 'Sign in with your corporate account to continue.',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    resuming: 'Signing in automatically with the existing session…',
    chainProgress: 'Step {{index}} of {{total}} · {{label}}',
    noProviders:
      'No sign-in target is declared in this build. Use the bypass toggle in the debug panel.',
    debug: {
      section: 'Sign-in',
      bypass: 'Bypass sign-in',
      status: 'Gate: {{status}}',
      none: 'None (0 declared)',
      passed: 'Passed',
      blocked: 'Blocked'
    }
  },
  skills: {
    pageTitle: 'Plugins',
    rail: { skills: 'Skills', mcp: 'MCP', providers: 'Connections' },
    list: {
      addAria: 'Add'
    },
    table: {
      skill: 'Skill',
      mcp: 'MCP server',
      lastUpdated: 'Last updated',
      author: 'Author',
      status: 'Status',
      transport: 'Transport',
      user: 'User',
      noSkills: 'No registered skills.',
      noMcp: 'No registered MCP servers.',
      noProviders: 'No registered connections.',
      provider: 'Connection',
      providerAuth: 'Auth method'
    },
    groups: {
      activeMcp: 'Active MCP',
      inactiveMcp: 'Inactive MCP',
      gateProviders: 'App sign-in',
      llmProviders: 'Models',
      serviceProviders: 'Internal services'
    },
    provider: {
      status: {
        none: 'Not connected',
        valid: 'Connected',
        expired: 'Expired',
        unknown: 'Unavailable'
      },
      kind: {
        gate: 'App sign-in',
        llm: 'Model',
        service: 'Internal service'
      },
      connect: 'Connect',
      reauth: 'Re-authenticate',
      revoke: 'Disconnect',
      chooseMethod: 'Auth method',
      submit: 'Submit',
      openBrowser: 'Sign in with browser',
      codeLabel: 'Authorization code',
      codeHint: 'Paste the code you received in the browser.',
      connectedWith: 'Connected with {{method}}',
      expiresAt: 'Expires',
      origin: 'Address',
      id: 'Identifier',
      tools: 'Exposed tools',
      toolsInactive: 'Exposed to the model once connected.'
    },
    view: { selectItem: 'Select an item.', backAria: 'Back to {{section}} list' },
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
      plainTextAria: 'Plain text',
      removeTitle: 'Remove skill',
      removeConfirmBody:
        'This removes the following folder from Orca skill sources. Confirm once more to continue.'
    },
    addMenu: {
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
      bearerNote: 'Sent as an Authorization: Bearer header.',
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
    instructionsCard: {
      title: 'Instructions',
      editTitle: 'Edit instructions',
      emptyHint: 'Add instructions to tailor responses.'
    },
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
    card: { unsupportedAdapter: 'Unsupported adapter', readOnly: 'Read-only' },
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
    closeTweaks: 'Close tweaks',
    mockMode: 'Mock mode',
    scenario: 'Scenario',
    contextUsage: 'Context usage',
    log: 'Logs',
    themeSection: 'Theme',
    palette: 'Color palette',
    layoutSection: 'Layout',
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
      agent_task_board: 'Task board (TaskXXX)',
      error: 'Error',
      full: 'Full'
    }
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
    updateDownloadFailed: 'Could not start the update download.',
    updateInstallFailed: 'Could not start the update installation.',
    agentListFailed: 'Failed to load the agent list',
    engineMutationFailed: 'Engine operation failed'
  },
  notify: {
    completeBody: 'The response is complete.'
  },
  chat: {
    steer: {
      submitted: 'Sent',
      residualTitle: 'Response stopped · {{count}} awaiting delivery',
      residualBody:
        'Already-delivered messages may still run. To stop everything, discard the session. Any running background tasks will end too.',
      residualAction: 'Discard session'
    },
    worktreePrepare: {
      repo: 'Checking the repository…',
      base: 'Resolving the base commit…',
      branch: 'Naming the branch…',
      worktree: 'Creating the worktree…',
      session: 'Starting the session…'
    },
    activity: {
      preparing: 'Preparing the response…',
      waiting: 'Checking remaining work…',
      finishingSlow: 'Finishing is taking longer than expected…',
      queued: '{{count}} input(s) queued',
      deliveryPending: '{{count}} awaiting delivery confirmation',
      residual: '{{count}} awaiting delivery after stop',
      background: '{{count}} background task(s)',
      more: '{{count}} more'
    },
    titleBar: {
      renameAria: 'Edit conversation title',
      copyAll: 'Copy entire conversation',
      tilesButton: 'Right panel tiles',
      tilesHeader: 'Show tiles',
      roleUser: 'User'
    },
    transcript: {
      reasoning: 'Reasoning',
      structuredOutput: 'Structured output',
      incompleteResponse: 'The response was not completed',
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
    subagentNotice: {
      completed: 'Background task finished',
      failed: 'Background task failed',
      stopped: 'Background task stopped',
      agentLine: 'Agent "{{title}}" {{verb}}',
      took: 'took {{duration}}'
    },
    subagentTile: {
      status: {
        running: 'In progress',
        stopping: 'Stopping…',
        paused: 'Paused',
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
    taskTile: {
      status: {
        in_progress: 'In progress',
        stopping: 'Stopping…',
        paused: 'Paused',
        pending: 'Pending',
        completed: 'Completed',
        aborted: 'Stopped',
        failed: 'Failed'
      },
      detail: {
        status: 'Status',
        description: 'Description',
        blockedBy: 'Blocked by',
        elapsed: 'Elapsed',
        lastTool: 'Last tool',
        toolUses: 'Tool uses'
      },
      sections: {
        progress: 'Progress',
        output: 'Output',
        outputDesc: 'View and open files created during this work.',
        context: 'Context',
        contextDesc: 'Tracks the tools used and files referenced by this work.'
      },
      backToList: 'Back to list',
      headerTitle: 'Tasks',
      badgeAria: '{{count}} finished tasks not yet reviewed',
      backgroundBadge: 'background',
      blockedByValue: 'needs #{{ids}}',
      stoppedReason: 'Stopped by you',
      failedReason: 'The execution session ended',
      stopFailed: 'Could not stop the task',
      backgroundFailed: 'Could not move the task to the background',
      toBackground: 'To background',
      toBackgroundAria: 'Move {{description}} to the background',
      toBackgroundTitle: 'Moves this to the background. The task keeps running.',
      unsupported: 'The connected Claude Code does not support the task list tools.',
      unsupportedVersion: 'Installed version: {{version}}',
      noChildActivity: 'No child activity recorded for this task.',
      emptyDesc: 'Tasks Claude creates and background work it starts will appear here.',
      openDetailAria: 'Open details for {{description}}'
    },
    taskTool: {
      created: 'Created',
      updated: 'Updated',
      listed: 'Listed all',
      fetched: 'Fetched',
      removed: 'Removed',
      failed: 'Failed',
      subject: 'Subject',
      status: 'Status',
      count: '{{count}} items'
    },
    gitRow: {
      aria: 'Repository and changes',
      detached: 'detached HEAD',
      changesAria: '{{added}} lines added, {{removed}} lines removed',
      diffTitle: 'Open changes panel'
    },
    composer: {
      modes: {
        title: 'Mode',
        auto_classified: {
          label: 'Auto',
          desc: 'Claude handles permission decisions'
        },
        default: { label: 'Manual', desc: 'Always confirm before making changes' },
        accept_edits: {
          label: 'Accept edits automatically',
          desc: 'Auto-approve all file edits'
        },
        plan: {
          label: 'Plan',
          desc: 'Make a plan before making changes'
        },
        bypass: {
          label: 'Bypass permissions'
        },
        dont_ask: {
          label: "Don't ask",
          desc: 'Skips Orca approval prompts and follows the default auto-proceed policy.'
        },
        riskyConfirm: 'All approval gates will be disabled. Click once more to confirm.'
      },
      effort: {
        title: 'Effort',
        low: { label: 'Low', desc: 'Prioritizes fast responses.' },
        medium: { label: 'Medium', desc: 'Balances speed and thinking depth.' },
        high: { label: 'High', desc: 'Default. Works with sufficient thinking depth.' },
        xhigh: { label: 'Extra', desc: 'Thinks more deeply for complex tasks.' },
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
      placeholderProviderBoundary:
        "A different provider's model is selected — you can send after the current response completes",
      placeholderIdle: 'Type / to see skills.',
      inputAria: 'Message input',
      abortUnsupported: 'This backend does not support aborting',
      sendFeedback: 'Send feedback',
      sendFeedbackEnter: 'Send feedback (Enter)',
      send: 'Send',
      sendEnter: 'Send (Enter)',
      diffRequirementTrayAria: 'Diff requirements',
      diffRequirementTrayLabel: '{{count}} diff requirements',
      diffRequirementUnlocated: 'Relocate before sending',
      diffRequirementRemoveAria: 'Remove diff requirement: {{comment}}',
      permissionModeTitle: 'Permission mode',
      attachMenuTitle: 'More menu',
      modelSelectTitle: 'Select model',
      modelMenuTitle: 'Model',
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
      cwdOpenAria: 'Open working folder',
      cwdSelectAria: 'Select working folder',
      branchTitle: 'Starting branch',
      branchDetached: 'Detached HEAD',
      branchSearchPlaceholder: 'Search branches…',
      branchSwitchFailed: 'Could not switch branch.',
      branchAppliedStash: 'Your changes were stashed; the branch is unchanged.',
      branchAppliedCommitWip: 'Your changes were committed as WIP; the branch is unchanged.',
      branchAppliedDiscard: 'Your changes were discarded; the branch is unchanged.',
      branchDirtyAria: 'Handle uncommitted changes',
      branchDirtyMenuAria: 'How to handle changes',
      branchDirtyTitleSuffix: ' has uncommitted changes.',
      branchDirtyTargetSuffix: ' — handle them before switching.',
      branchDirtyStat: '{{files}} files changed',
      dirtyStash: 'Stash changes',
      dirtyCommitWip: 'Commit as WIP',
      dirtyDiscard: 'Discard changes',
      extraDirRejectRoot: 'The root folder cannot be added as a reference path.',
      extraDirAdd: 'Add another folder',
      worktreeIsolation: 'Worktree isolation',
      worktreeIsolationHelp:
        'Start the new session in a separate Git worktree. Uncommitted changes are not carried into it',
      extraDirRemoveAria: 'Remove reference folder {{name}}'
    },
    status: {
      warn: {
        pill: 'This conversation is getting long',
        detail: 'Details',
        title: 'The conversation is getting long',
        description: 'You can keep going, but a light cleanup will make it flow more smoothly.',
        length: 'On the long side',
        actionButton: 'Summarize the conversation'
      },
      danger: {
        pill: 'This conversation is very long — cleanup needed',
        detail: 'Details',
        title: 'The conversation is very long',
        description:
          'It is better to move to a new session (handoff) that inherits a summary. Everything so far will be kept.',
        length: 'Very long',
        actionButton: 'Continue via handoff'
      },
      lengthLabel: 'Conversation length',
      lengthValue: '{{used}}k/{{window}}k {{pct}}%',
      sessionCostLabel: 'Cost used in this session',
      sessionCostValue: '~${{usd}}',
      costDisclaimer:
        'The cost shown is an estimate and may differ slightly from the actual amount.',
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
      reviseBack: 'Back',
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
        task: 'Tasks',
        diff: 'Changes'
      },
      diffAllChanges: 'All changes',
      diffEmpty: 'No changes yet.',
      diffNotRepo: 'Not a Git repository.',
      diffFileLoading: 'Loading contents…',
      diffNotSynced: 'Shown when the turn finishes.',
      diffCollapsedNotice: 'Files are collapsed for large diffs. Select a file to expand it.',
      diffOpenFile: 'Reveal in file explorer',
      diffOpenFileAria: 'Reveal in file explorer: {{path}}',
      diffFileToggleAria: 'Expand or collapse {{path}}',
      diffFileBinary: 'Binary file — no preview available.',
      diffFileTooLarge: 'File is too large to preview.',
      diffFileUnavailable: 'No preview available.',
      diffSessionChanges: 'Changes',
      diffBaselineHead: 'current HEAD',
      diffBaselineNone: 'no baseline',
      diffSessionFilesTruncated: 'Session file list limited',
      diffComparisonTitle: 'Compare against',
      diffComparedWith: 'against {{base}}',
      diffCommitScope: 'Commits',
      diffShowFiles: 'Show files',
      diffCollapseAll: 'Collapse all files',
      diffExpandAll: 'Expand all files',
      diffSideBySide: 'Side by side',
      diffWrapLines: 'Wrap lines',
      diffHighlightWords: 'Highlight changed words',
      diffIgnoreWhitespace: 'Hide whitespace changes',
      diffViewSettings: 'Diff view settings',
      diffExpandPanel: 'Widen panel',
      diffShrinkPanel: 'Restore panel width',
      diffUnmodifiedLines: '{{count}} unmodified lines',
      diffNoSessionChange: 'No change against the session baseline.',
      diffPatchUnavailable: 'Could not load the changes. Refresh to try again.',
      diffContextLimited: 'Limited context — expansion stops at what was loaded.',
      diffExpandGap: 'Show {{count}} more above',
      diffRequirementAddAria: 'Add diff requirement: {{line}}',
      diffRequirementDraftPlaceholder: 'Requirement for this line…',
      diffRequirementDraftInputAria: 'Diff requirement content',
      diffRequirementDraftSubmit: 'Add',
      diffRequirementDraftCancel: 'Cancel',
      diffRequirementMarkerLabel: 'Requirement',
      closeTile: 'Close {{label}}',
      panelResizeAria: 'Resize right panel',
      rowResizeAria: 'Resize panel row',
      colResizeAria: 'Resize panel column',
      planCopy: 'Copy plan',
      planUnavailableTitle: 'Plan text unavailable',
      planUnavailableDesc:
        'The model did not send the plan. Review the conversation before approving.',
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
      plugins: 'Plugins'
    },
    recents: 'Recents',
    pinnedProjects: 'Projects',
    pinned: 'Pinned',
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
      density: 'Density',
      densityDesc: 'App-wide spacing and text size density',
      densityCompact: 'Compact',
      densityNormal: 'Normal',
      densityComfortable: 'Comfortable',
      notifications: 'Notifications',
      notifyComplete: 'Response complete',
      notifyCompleteDesc:
        'Get notified when the agent completes a response. (Shown only while the app window is inactive)',
      notifyCompleteToggle: 'Response complete notification',
      updates: 'Updates',
      updateAuto: 'Automatic check',
      updateAutoDesc:
        'Periodically check for new versions while the app is running. (The check on app start always runs)',
      updateAutoToggle: 'Automatic update check',
      updateInterval: 'Check interval',
      updateIntervalDesc: 'Checks run at this interval, measured from when the app started.',
      updateIntervalEvery_one: 'Every hour',
      updateIntervalEvery_other: 'Every {{count}} hours'
    },
    usage: {
      title: 'Usage summary',
      desc: 'Token usage (input/output/cache) over time and a per-model breakdown.',
      range7d: 'Last 7 days',
      range30d: 'Last 30 days',
      rangeAll: 'All time',
      totalTokens: 'total tokens',
      totalCost: 'Total cost',
      dailyTokens: 'Tokens per day',
      byModel: 'Usage by model',
      chartAria: 'Daily token usage chart',
      weeklyNote: 'Ranges longer than 90 days are shown as weekly totals.',
      modelBreakdown: 'Input {{input}} · Output {{output}} · Cache {{cache}} · {{cost}}',
      empty: 'No usage yet',
      emptyDesc: 'Token usage will appear here once you start chatting.'
    }
  },
  time: {
    justNow: 'just now',
    minutesAgo_one: '{{count}} minute ago',
    minutesAgo_other: '{{count}} minutes ago',
    hoursAgo_one: '{{count}} hour ago',
    hoursAgo_other: '{{count}} hours ago',
    daysAgo_one: '{{count}} day ago',
    daysAgo_other: '{{count}} days ago',
    yesterday: 'yesterday',
    resetsWeek: 'Resets ({{weekday}}) at 12:00 AM',
    resetsMonth: 'Resets ({{weekday}}) {{date}}'
  },
  usage: {
    weekly: 'Weekly',
    monthly: 'Monthly',
    pctUsed: '{{pct}}% used',
    estimateNote:
      'Usage shown is an estimate provided by the SDK. It may differ from actual token usage and billed amounts.',
    loading: 'Loading usage information…',
    lastUpdated: 'Last applied',
    refreshAria: 'Refresh usage',
    refreshFailed: 'Sync failed. Showing the last applied values.',
    usageLimit: 'Usage limits',
    limitSettings: 'Limit settings',
    monthlyLimit: 'Monthly usage limit',
    monthlyLimitDesc: 'Set the monthly spending limit for this provider',
    // 0186 — the remote usage fetcher's limit wins over the value set here.
    accountLimitApplied:
      'Account limit in effect (your value applies when no remote limit is reported)',
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
