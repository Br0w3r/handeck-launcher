/**
 * Prueba de detección de juegos SIN arrancar Electron.
 * Ejecuta:  npm run detect
 *
 * Sólo importa los módulos de detección (que son Node puro, sin dependencias de
 * Electron), por lo que se puede correr con tsx durante el desarrollo.
 */
import { detectGames } from '../src/main/games'

const result = detectGames()

console.log('\n──────────── HanDeck: detección de juegos ────────────')
console.log(`plataforma host:          ${process.platform}`)
console.log(`legendary instalado:      ${result.legendaryInstalled ? 'sí' : 'no'}`)
console.log(`legendary autenticado:    ${result.legendaryAuthenticated ? 'sí' : 'no'}`)
console.log(`juegos detectados:        ${result.games.length}`)
for (const game of result.games) {
  console.log(`  • [${game.platform}] ${game.title} (id: ${game.id})`)
  console.log(`      ↳ ${game.installPath}`)
  if (game.executableName) console.log(`      ↳ exe: ${game.executableName}`)
  if (game.updateState && game.updateState !== 'ready') {
    const pct =
      game.updateProgress != null ? ` (${Math.round(game.updateProgress * 100)}%)` : ''
    console.log(`      ↳ estado: ${game.updateState}${pct}`)
  }
}
console.log('──────────────────────────────────────────────────────\n')
