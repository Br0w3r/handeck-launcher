import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, net, protocol } from 'electron'

import { cachedFilePath, type ArtworkType } from './artwork/artworkCache'
import { detectGames } from './games'
import { isMonitoring } from './gameMonitor'
import { registerIpcHandlers } from './ipc/handlers'
import { createWindow } from './windowManager'

/**
 * Entry point del main process de Electron.
 *
 * PASO 4: además de la detección (Paso 1) y el IPC (Paso 2), registra el
 * protocolo custom handeck-art:// que sirve las imágenes cacheadas de artwork.
 */

// El esquema debe declararse como privilegiado ANTES de que la app esté lista.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'handeck-art',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function logDetectedGames(): void {
  const result = detectGames()

  console.log('\n──────────── HanDeck: detección de juegos ────────────')
  console.log(`legendary instalado:      ${result.legendaryInstalled ? 'sí' : 'no'}`)
  console.log(`legendary autenticado:    ${result.legendaryAuthenticated ? 'sí' : 'no'}`)
  console.log(`juegos detectados:        ${result.games.length}`)
  for (const game of result.games) {
    console.log(`  • [${game.platform}] ${game.title} (id: ${game.id})`)
    console.log(`      ↳ ${game.installPath}`)
  }
  console.log('──────────────────────────────────────────────────────\n')
}

/**
 * Sirve las imágenes cacheadas: handeck-art://<hash>/<grid|hero>.
 * El hostname es el hash del juego y el pathname el tipo de imagen.
 */
function registerArtworkProtocol(): void {
  protocol.handle('handeck-art', async (request) => {
    const url = new URL(request.url)
    const hash = url.hostname
    const type = url.pathname.replace(/^\//, '') as ArtworkType

    if ((type === 'grid' || type === 'hero') && /^[a-f0-9]{40}$/.test(hash)) {
      const filePath = cachedFilePath(hash, type)
      if (existsSync(filePath)) {
        return net.fetch(pathToFileURL(filePath).toString())
      }
    }
    return new Response('artwork not found', { status: 404 })
  })
}

app.whenReady().then(() => {
  registerArtworkProtocol()
  logDetectedGames()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    // En macOS es habitual recrear la ventana al reactivar la app.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // CLAVE del patrón de ciclo de vida: si estamos monitoreando un juego, la
  // ventana se destruyó a propósito y el main process debe seguir vivo para
  // recrearla al cerrar el juego. Sólo se cierra la app si NO hay monitoreo.
  if (isMonitoring()) return
  if (process.platform !== 'darwin') app.quit()
})
