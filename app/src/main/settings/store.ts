export interface Settings {
  theme?: 'light' | 'dark';
  density?: 'compact' | 'normal' | 'spacious';
  sidebarVisible?: boolean;
}

export class Store {
  private state: Settings = {};

  get(key: keyof Settings): any {
    return this.state[key];
  }

  set(key: keyof Settings, value: any): void {
    this.state[key] = value;
    // TODO Phase 2: Persist to electron-store (currently in-memory only)
  }
}

export const store = new Store();
