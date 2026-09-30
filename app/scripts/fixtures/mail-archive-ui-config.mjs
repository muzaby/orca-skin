import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export function createMailUiConfig(appRoot, output, mutation) {
  return {
    main: {
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
        ...(mutation
          ? [
              {
                name: 'remove-settings-slot',
                enforce: 'pre',
                transform(code, id) {
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
