import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const fixture = path.dirname(fileURLToPath(import.meta.url))
let repo = fixture
while (!fs.existsSync(path.join(repo,'app/package.json'))) {
  const parent = path.dirname(repo)
  if (parent === repo) throw Error('Repository app/package.json not found')
  repo = parent
}
const app = path.join(repo,'app')
const require = createRequire(path.join(app,'package.json'))
const cache = fs.mkdtempSync(path.join(app,'node_modules/.cache/orca/project-native-'))
const built = await require('esbuild').build({ absWorkingDir:repo, entryPoints:[path.join(fixture,fs.existsSync(path.join(fixture,'r2-project-native-browser.tsx')) ? 'r2-project-native-browser.tsx' : 'native-browser.tsx')], outfile:path.join(cache,'fixture.js'), bundle:true,format:'iife',platform:'browser',jsx:'automatic',minify:true,metafile:true,loader:{'.webp':'dataurl','.png':'dataurl','.svg':'dataurl'},nodePaths:[path.join(app,'node_modules')],define:{'process.env.NODE_ENV':'"production"','__APP_VERSION__':'"test"'},alias:{'@source':path.join(app,'src')} })
const assets=path.join(app,'out/renderer/assets');const styles=fs.readdirSync(assets).filter(n=>n.endsWith('.css'));if(styles.length!==1)throw Error('stylesheet');fs.cpSync(assets,path.join(cache,'assets'),{recursive:true})
const css=path.join(cache,'assets',styles[0]);const csp=fs.readFileSync(path.join(app,'src/renderer/index.html'),'utf8').match(/content="(default-src[^\"]*)"/)[1]
fs.writeFileSync(path.join(cache,'fixture.html'),`<!doctype html><html lang="ko" data-theme="white"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="${pathToFileURL(css).href}"><div id="root"></div><script src="fixture.js"></script></html>`)
fs.writeFileSync(path.join(cache,'manifest.json'),JSON.stringify({files:Object.fromEntries(Object.keys(built.metafile.inputs).filter(n=>n.startsWith('app/src/')).map(n=>[n,createHash('sha256').update(fs.readFileSync(path.join(repo,n))).digest('hex')]))},null,2))
console.log(JSON.stringify({cache}))
