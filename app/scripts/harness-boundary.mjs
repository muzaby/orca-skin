import path from 'node:path'

// SDK 소스 종류를 구분하고 동적 import/require/re-export도 같은 경계로 검사한다.
export const harnessBoundary = {
  rules: {
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
          if (typeof node?.value !== 'string' || !node.value.startsWith('.')) return
          const target = path
            .resolve(path.dirname(context.filename), node.value)
            .replaceAll('\\', '/')
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
        return {
          ImportDeclaration: (node) => check(node.source),
          ExportNamedDeclaration: (node) => check(node.source),
          ExportAllDeclaration: (node) => check(node.source),
          ImportExpression: (node) => check(node.source),
          TSImportType: (node) => check(node.argument?.literal ?? node.argument),
          TSExternalModuleReference: (node) => check(node.expression),
          CallExpression: (node) => {
            if (node.callee.type === 'Identifier' && node.callee.name === 'require')
              check(node.arguments[0])
          }
        }
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
    }
  }
}
