import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, globalShortcut, net, protocol } from 'electron'

import { cachedFilePath, type ArtworkType } from './artwork/artworkCache'
import { detectGames, refreshEpicUpdates } from './games'
import { isMonitoring } from './gameMonitor'
import { registerIpcHandlers } from './ipc/handlers'
import { createTray, destroyTray } from './tray'
import { checkForUpdatesOnFocus, initAutoUpdater } from './updater'
import { pushUpdateStates, startUpdateWatcher } from './updateWatcher'
import {
  createWindow,
  getMainWindow,
  setQuitting,
  toggleWindow
} from './windowManager'

/**
 * Atajo global para traer HanDeck al frente desde cualquier lado. Asigna un
 * botón macro del Claw a esta combinación en MSI Center M (Key Mapping 2.0) y
 * ese botón abrirá el launcher — sin desinstalar nada.
 */
const SUMMON_HOTKEY = 'Control+Alt+H'

/**
 * Alterna HanDeck, PERO no mientras hay un juego corriendo: traer el launcher
 * encima de un juego en pantalla completa rompe su fullscreen (y al ocultarlo se
 * minimizaría el juego). Durante un juego el botón no hace nada; HanDeck vuelve
 * solo al cerrarse el juego.
 */
function toggleUnlessInGame(): void {
  if (isMonitoring()) return
  toggleWindow()
}

// Instancia única: si ya hay una corriendo, la segunda invocación (p.ej. al
// pulsar un botón que lanza el .exe) sólo trae al frente la existente.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', () => toggleUnlessInGame())

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
  // La segunda instancia sólo enfoca la existente (second-instance) y se cierra.
  if (!gotLock) return
  registerArtworkProtocol()
  logDetectedGames()
  registerIpcHandlers()
  const win = createWindow()
  // Auto-actualización del propio launcher (sólo en la app empaquetada).
  initAutoUpdater(getMainWindow)
  // Al volver al frente (salir de un juego, invocar desde la bandeja…) comprueba
  // si hay versión nueva, sin tener que cerrar y reabrir el launcher.
  win.on('focus', checkForUpdatesOnFocus)
  win.on('show', checkForUpdatesOnFocus)
  // Observa los manifests de Steam para reflejar las actualizaciones en vivo.
  startUpdateWatcher()

  // Comprueba updates pendientes de Epic (versión instalada vs última online vía
  // legendary) en segundo plano y refresca cada 30 min. Al terminar, empuja el
  // estado al renderer para que aparezca el badge sin recargar.
  void refreshEpicUpdates(pushUpdateStates)
  const EPIC_UPDATE_INTERVAL_MS = 30 * 60 * 1000
  setInterval(() => void refreshEpicUpdates(pushUpdateStates), EPIC_UPDATE_INTERVAL_MS)

  // Icono en la bandeja del sistema (para vivir en segundo plano al esconderse).
  createTray(() => {
    setQuitting(true)
    app.quit()
  })

  // Atajo global para alternar el launcher (mapea un botón a esta tecla).
  globalShortcut.register(SUMMON_HOTKEY, toggleUnlessInGame)

  app.on('activate', () => {
    // En macOS es habitual recrear la ventana al reactivar la app.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroyTray()
})

app.on('window-all-closed', () => {
  // Con icono en la bandeja del sistema, HanDeck sigue vivo en segundo plano
  // aunque no haya ventana visible (igual que MSI Center). También cubre el
  // ciclo de vida: al destruir la ventana durante un juego, el main sigue vivo
  // para recrearla al cerrar el juego. Sólo se cierra desde "Salir" del tray.
})
