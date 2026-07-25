// Descarga legendary.exe a resources/bin para que electron-builder lo empaquete.
// Se usa en el CI antes de empaquetar y localmente con `npm run fetch:legendary`.
//   node scripts/fetch-legendary.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Versión fija para builds reproducibles (bump manual cuando convenga).
const VERSION = process.env.LEGENDARY_VERSION || '0.20.34'
const url = `https://github.com/legendary-gl/legendary/releases/download/${VERSION}/legendary.exe`

const __dirname = dirname(fileURLToPath(import.meta.url))
const dest = join(__dirname, '..', 'resources', 'bin', 'legendary.exe')

console.log(`Descargando legendary ${VERSION}…`)
const res = await fetch(url)
if (!res.ok) {
  console.error(`❌ Fallo (${res.status}) al descargar ${url}`)
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, buf)
console.log(`✅ legendary.exe → ${dest} (${(buf.length / 1048576).toFixed(1)}MB)`)
