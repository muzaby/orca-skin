// SDK 소스 종류를 구분하고 동적 import/require/re-export도 같은 경계로 검사한다.
export const harnessBoundary = {
  rules: {
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
