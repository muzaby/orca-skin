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
}

declare global {
  interface Window {
    orca: OrcaAPI;
  }
}
