export declare const HERMETIC_REMOVE_PREFIXES: readonly string[]
export declare const HERMETIC_REMOVE_KEYS: readonly string[]
export declare const HERMETIC_GIT_IDENTITY: { readonly name: string; readonly email: string }
export declare const HERMETIC_GIT_CONFIG: string
export declare function isHostHarnessKey(key: string): boolean
export declare function hermeticTestEnv(input: {
  env: Record<string, string | undefined>
  root: string
  platform: string
}): { set: Record<string, string>; remove: string[] }
export declare function hermeticDirectories(set: Record<string, string>): string[]
