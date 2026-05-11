export interface OrcaAPI {
  chat: {
    send: (payload: any) => Promise<{ ok?: boolean; error?: string }>;
    onEvent: (callback: (evt: any) => void) => void;
    cancel: (sessionId: string) => Promise<any>;
  };
  backend: {
    list: () => Promise<any>;
    select: (backend: string) => Promise<any>;
  };
  logger: {
    info: (msg: string) => Promise<{ ok?: boolean }>;
    debug: (msg: string) => Promise<{ ok?: boolean }>;
    warn: (msg: string) => Promise<{ ok?: boolean }>;
    error: (msg: string) => Promise<{ ok?: boolean }>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<{ ok?: boolean }>;
  };
}

declare global {
  interface Window {
    orca: OrcaAPI;
  }
}
