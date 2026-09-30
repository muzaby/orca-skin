import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export function createMailUiConfig(appRoot, output, mutation) {
  return {
    main: {
      plugins:
        mutation === 'empty-archive-factory'
          ? [
              {
                name: mutation,
                enforce: 'pre',
                transform(code, id) {
                  if (!id.replaceAll('\\', '/').endsWith('/mail-archive/plugin.ts')) return
                  const target = 'return server'
                  if (!code.includes(target))
                    throw new Error('Archive factory mutation target missing')
                  return code.replace(
                    target,
                    "return { descriptor: { id: 'orca_mail_archive', connectorId: 'orca_mail_archive', tools: [] }, implementations: [] }"
                  )
                }
              }
            ]
          : [],
      build: {
        outDir: join(output, 'main'),
        rollupOptions: { input: join(appRoot, 'scripts/fixtures/mail-archive-ui-main.ts') }
      }
    },
    preload: {
      build: {
        outDir: join(output, 'preload'),
        rollupOptions: { input: join(appRoot, 'src/preload/index.ts') }
      }
    },
    renderer: {
      root: join(appRoot, 'scripts/fixtures'),
      base: './',
      define: { __APP_VERSION__: JSON.stringify('ui-fixture') },
      plugins: [
        react(),
        tailwindcss(),
        ...(mutation && mutation !== 'empty-archive-factory'
          ? [
              {
                name: mutation,
                enforce: 'pre',
                transform(code, id) {
                  if (mutation === 'restore-eml-gui') {
                    if (
                      !id
                        .replaceAll('\\', '/')
                        .endsWith('/mail-archive/MailArchiveSourceManager.tsx')
                    )
                      return
                    const target = '<div className="flex flex-wrap gap-2">'
                    if (!code.includes(target)) throw new Error('EML GUI mutation target missing')
                    return code.replace(
                      target,
                      `${target}<button type="button">EML 폴더 추가</button>`
                    )
                  }
                  if (!id.replaceAll('\\', '/').endsWith('/app/SidebarUserButton.tsx')) return
                  const target =
                    '<SettingsModal mailArchiveSlot={<MailArchiveSettingsContent />} />'
                  if (!code.includes(target))
                    throw new Error('Settings slot mutation target missing')
                  return code.replace(target, '<SettingsModal />')
                }
              }
            ]
          : [])
      ],
      build: {
        outDir: join(output, 'renderer'),
        rollupOptions: { input: join(appRoot, 'scripts/fixtures/mail-archive-ui.html') }
      }
    }
  }
}
