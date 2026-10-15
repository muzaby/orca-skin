import path from 'node:path'

function importVisitors(check) {
  return {
    ImportDeclaration: (node) => check(node.source),
    ExportNamedDeclaration: (node) => check(node.source),
    ExportAllDeclaration: (node) => check(node.source),
    ImportExpression: (node) => check(node.source),
    TSImportType: (node) => check(node.argument?.literal ?? node.argument),
    TSExternalModuleReference: (node) => check(node.expression),
    CallExpression: (node) => {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        check(node.arguments[0])
      }
    }
  }
}

function resolveImport(filename, value) {
  if (typeof value !== 'string') return undefined
  if (value.startsWith('.')) {
    return path.resolve(path.dirname(filename), value).replaceAll('\\', '/')
  }
  if (value.startsWith('@renderer/')) {
    const source = filename.replaceAll('\\', '/')
    const root = source.match(/^(.*\/src\/renderer\/src)(?:\/|$)/)?.[1]
    if (root) return path.posix.normalize(`${root}/${value.slice('@renderer/'.length)}`)
  }
  return undefined
}

// 소유권은 이름 목록이 아닌 경로로 판정한다. 새로운 하네스에도 같은 경계가 적용된다.
function owner(file) {
  const match = file.match(
    /\/src\/(?:main\/adapters|main\/app\/harnesses|main\/features\/(?:harnesses|extensions)|shared\/harnesses|renderer\/src\/features\/[^/]+\/harnesses)\/([^/]+)(?:\/|$)/
  )
  if (match) {
    const name = match[1]
    if (name === 'common') return { kind: 'common' }
    if (name === 'registries') return { kind: 'composition' }
    // Root files are composition or neutral contracts, not implementation directories.
    if (
      /\.(?:ts|tsx)$/.test(name) ||
      /^(?:contracts|types|index|registry|catalog|presentation|configuration|fields|preferences)$/.test(
        name
      )
    ) {
      return /^(?:contracts|types)(?:\.(?:ts|tsx))?$/.test(name)
        ? { kind: 'contract' }
        : { kind: 'composition' }
    }
    return { kind: 'implementation', name }
  }
  if (/\/src\/renderer\/src\/features\/[^/]+\/common\//.test(file)) {
    return { kind: 'common' }
  }
  return undefined
}

// SDK 소스 종류를 구분하고 동적 import/require/re-export도 같은 경계로 검사한다.
export const harnessBoundary = {
  rules: {
    ownership: {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          sibling: 'Harness implementations cannot import another harness implementation.',
          common:
            'Common harness modules receive policies and slots; they cannot import harness implementations or their registries.'
        }
      },
      create(context) {
        const source = context.filename.replaceAll('\\', '/')
        const own = owner(source)
        return importVisitors((node) => {
          const target = resolveImport(context.filename, node?.value)
          if (!target) return
          const other = owner(target)
          if (
            own?.kind === 'common' &&
            (other?.kind === 'implementation' || other?.kind === 'composition')
          ) {
            context.report({ node, messageId: 'common' })
          } else if (
            own?.kind === 'implementation' &&
            other?.kind === 'implementation' &&
            own.name !== other.name
          ) {
            context.report({ node, messageId: 'sibling' })
          }
        })
      }
    },
    'version-boundary': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          version:
            'Consume OpenCode through its version-neutral entry point; version implementations cannot import another version.'
        }
      },
      create(context) {
        const source = context.filename.replaceAll('\\', '/')
        const version = (file) =>
          file.match(/^(.*\/(?:adapters|harnesses)\/opencode)\/(v\d+)(?:\/|$)/)
        const own = version(source)
        const check = (node) => {
          const target = resolveImport(context.filename, node?.value)
          if (!target) return
          const other = version(target)
          if (!other) return
          if (own?.[1] === other[1] && own?.[2] === other[2]) return
          if (
            !own &&
            path.posix.dirname(source) === other[1] &&
            ['index.ts', 'toolPresentation.ts'].includes(path.posix.basename(source))
          )
            return
          context.report({ node, messageId: 'version' })
        }
        return importVisitors(check)
      }
    },
    'sdk-version': {
      meta: {
        type: 'problem',
        schema: [],
        messages: { version: 'OpenCode SDK imports belong in adapters/opencode/v1.' }
      },
      create(context) {
        const check = (node) => {
          if (typeof node?.value === 'string' && /^@opencode-ai\/sdk(?:\/|$)/.test(node.value)) {
            context.report({ node, messageId: 'version' })
          }
        }
        return importVisitors(check)
      }
    }
  }
}
