// 한국어 UI 카탈로그 — i18n SSOT(0096). 키 구조가 곧 타입(`i18next.d.ts` 가 typeof ko 로
// t() 키를 강제). en.ts 는 `typeof ko` 로 선언해 양방향 키 패리티를 컴파일 타임에 보장한다.
// 값은 기존 하드코딩 문자열을 그대로 옮긴 것 — ko 표시 결과는 마이그레이션 전후 동일해야 한다.

export const ko = {
  common: {
    cancel: '취소',
    save: '저장',
    close: '닫기',
    unlimited: '무제한',
    unknown: '알 수 없음',
    confirm: '확인',
    delete: '삭제',
    rename: '이름 변경',
    more: '더 보기',
    copied: '복사됨',
    copyMessage: '메시지 복사',
    copyCode: '코드 복사',
    editTitle: '제목 편집',
    newChat: '새 대화'
  },
  nav: {
    chat: '01 채팅',
    projects: '02 프로젝트',
    projectsBreadcrumb: '프로젝트',
    engine: '03 엔진 & 모델',
    engineBreadcrumb: '설정 · 엔진 & 모델',
    skills: '04 Skills / MCP',
    skillsBreadcrumb: '설정 · Skills & MCP',
    captures: '05 캡처 히스토리',
    capturesBreadcrumb: '캡처 히스토리'
  },
  search: {
    placeholder: '대화 내용 검색…',
    inputAria: '대화 검색',
    typeToSearch: '검색어를 입력하세요',
    noMatches: '일치하는 메시지가 없습니다',
    noTitle: '제목 없음'
  },
  sessions: {
    deleteDialogTitle: '대화 삭제',
    deleteDialogMessage: '이 대화를 삭제하시겠습니까?',
    menuAria: '세션 메뉴',
    renameAria: '세션 제목 편집'
  },
  errors: {
    category: {
      provider_connection_error: '백엔드 연결 오류',
      auth_error: '인증 오류',
      permission_denied: '권한 거부',
      tool_execution_error: '도구 실행 오류',
      stream_error: '스트림 오류',
      capability_unsupported: '지원하지 않는 기능',
      schema_validation_error: '입력 검증 오류',
      user_cancelled: '사용자 취소'
    },
    turnError: '에러: {{category}}',
    retryable: '재시도 가능',
    transientHint: '일시적 오류일 수 있습니다. 다시 보내보세요.',
    retrying: '재시도 {{attempt}}/{{max}}',
    loginFailed: '로그인에 실패했습니다. 다시 시도해 주세요.',
    updateDownloadFailed: '업데이트 다운로드를 시작할 수 없습니다.',
    updateInstallFailed: '업데이트 설치를 시작할 수 없습니다.',
    agentListFailed: 'agent 목록을 불러오지 못했습니다',
    engineMutationFailed: 'engine 작업에 실패했습니다'
  },
  notify: {
    completeBody: '응답이 완료되었습니다.'
  },
  chat: {
    titleBar: {
      renameAria: '대화 제목 편집',
      copyAll: '전체 대화 복사',
      tilesButton: '우측 패널 타일',
      tilesHeader: '타일 표시',
      roleUser: '사용자'
    }
  },
  sidebar: {
    nav: {
      newChat: '새 대화',
      projects: '프로젝트',
      engine: '엔진 & 모델',
      skills: 'Skills & MCP'
    },
    recents: '최근 대화',
    resizeAria: '사이드바 폭 조절'
  },
  userMenu: {
    settings: '설정',
    language: '언어',
    displayLanguage: '앱 표시 언어'
  },
  header: {
    systemMenu: '시스템 메뉴',
    collapseSidebar: '사이드바 접기',
    search: '검색',
    back: '뒤로 가기',
    forward: '앞으로 가기',
    update: '업데이트',
    version: '버전',
    quit: '종료',
    versionModalAria: 'Orca 버전'
  },
  settings: {
    title: '설정',
    tabs: {
      general: '일반',
      usage: '사용량'
    },
    providerNotFound: 'provider 를 찾을 수 없습니다.',
    general: {
      profile: '프로필',
      accountInstructions: '계정 지침',
      accountInstructionsDesc:
        '모든 대화에 적용되는 지침입니다. 저장 후 영속되며, 시스템 프롬프트 배선은 추후 제공됩니다.',
      accountPlaceholder: '예: 자세한 설명을 하기 전에 질문을 해주세요.',
      preferences: '환경설정',
      appearance: '모양',
      appearanceDesc: '앱 색상 테마',
      themeWhite: '화이트',
      themeDark: '다크',
      font: '폰트',
      fontDesc: '앱 전체에 적용되는 글꼴',
      fontSans: '산세리프 (Inter)',
      fontSerif: '세리프 (Source Serif)',
      fontMono: '모노 (JetBrains Mono)',
      language: '언어',
      languageDesc: '앱 UI 와 날짜 표기에 적용되는 표시 언어',
      scheduling: '주기적 실행',
      usageRecompute: '사용량 새로고침',
      usageRecomputeDesc: '앱이 실행 중일 때만 저장된 주기에 따라 사용량 집계를 다시 계산합니다.',
      usageRecomputeToggle: '주기적 사용량 새로고침',
      refreshInterval: '새로고침 주기',
      refreshIntervalDesc: 'cron 표현식 또는 기본 프리셋을 선택하세요.',
      presetHourly: '매시간',
      preset30m: '30분마다',
      presetDaily9: '매일 오전 9시',
      presetCustom: '직접 입력',
      cronAria: '사용량 새로고침 cron',
      notifications: '알림',
      notifyComplete: '응답 완료',
      notifyCompleteDesc: 'Agent가 응답을 완료하면 알림을 받습니다. (앱 창이 비활성일 때만 표시)',
      notifyCompleteToggle: '응답 완료 알림'
    },
    usage: {
      title: '사용량 요약',
      descPrefix: 'Claude Code 의 ',
      descSuffix:
        ' 처럼 총 사용 비용, 토큰 사용량(입력·출력·캐시), 모델별 내역을 한눈에 볼 수 있는 요약을 제공할 예정입니다.',
      comingSoon: '추후 구현 예정',
      comingSoonDesc:
        'provider별 사용량 한도와 지출 한도 설정은 좌측 하위 항목에서 확인할 수 있습니다.'
    }
  },
  usage: {
    weekly: '주간',
    monthly: '월간',
    pctUsed: '{{pct}}% 사용됨',
    loading: '사용량 정보를 불러오는 중입니다…',
    lastUpdated: '마지막 업데이트',
    refreshAria: '사용량 새로고침',
    usageLimit: '사용량 한도',
    limitSettings: '한도 설정',
    monthlyLimit: '월간 사용 한도',
    monthlyLimitDesc: '이 provider 의 월 지출 한도를 설정합니다',
    setLimitTitle: '{{provider}} 월간 지출 한도 설정',
    setLimitDesc: '월별 지출 한도를 설정하세요.',
    limitInputAria: '월간 지출 한도 (USD)',
    appliesImmediately: '이 지출 한도는 즉시 적용됩니다.',
    setUnlimited: '무제한으로 설정',
    setLimit: '지출 한도 설정',
    backToUsage: '사용량',
    contextWindow: '컨텍스트 창',
    openUsageSettingsAria: '사용량 한도 설정 열기'
  }
}
