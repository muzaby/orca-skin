import type { Backend } from '../../shared/protocol';
import { ClaudeCodeAdapter } from './claude-code';
import { OpencodeAdapter } from './opencode';

export class AdapterRegistry {
  private active: Backend | null = null;
  private claudeCode = new ClaudeCodeAdapter();
  private opencode = new OpencodeAdapter();

  async detectInstalledBackends(): Promise<Backend[]> {
    const results = await Promise.all([
      this.claudeCode.isInstalled().then((ok) => (ok ? 'claude-code' : null)),
      this.opencode.isInstalled().then((ok) => (ok ? 'opencode' : null)),
    ]);
    return results.filter((b) => b !== null) as Backend[];
  }

  async initialize(): Promise<void> {
    const installed = await this.detectInstalledBackends();

    if (installed.length === 1) {
      this.active = installed[0];
    } else if (installed.length === 2) {
      // OQ7: Default backend when both installed — using first found for Phase 1
      this.active = installed[0];
    } else {
      this.active = null;
    }
  }

  getActive(): Backend | null {
    return this.active;
  }

  setActive(backend: Backend): void {
    this.active = backend;
  }

  getAdapter(backend: Backend) {
    switch (backend) {
      case 'claude-code':
        return this.claudeCode;
      case 'opencode':
        return this.opencode;
    }
  }
}

export const adapterRegistry = new AdapterRegistry();
