import { app, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

/**
 * Auto-actualización vía electron-updater (provider github, ver publish en
 * electron-builder.config.js).
 *
 * Flujo: al arrancar comprueba si hay una versión nueva en las Releases; si la
 * hay, avisa al renderer (update:available). El usuario decide descargar
 * (update:download) y, al terminar, reiniciar e instalar (update:install).
 *
 * OJO: para repos PRIVADOS, la descarga desde la Release requiere token. Para
 * que el auto-update funcione en el equipo del usuario, el repo/releases deben
 * ser públicos (o usar un repo de releases público aparte).
 */

const { autoUpdater } = electronUpdater

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // cada hora

export function initAutoUpdater(getWindow: () => BrowserWindow | null): void {
  // Sólo tiene sentido en la app empaquetada.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false // descargamos sólo si el usuario acepta
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel: string, payload?: unknown): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  autoUpdater.on('update-available', (info) =>
    send('update:available', { version: info.version })
  )
  autoUpdater.on('update-not-available', () => send('update:none'))
  autoUpdater.on('download-progress', (p) =>
    send('update:progress', { percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    send('update:downloaded', { version: info.version })
  )
  autoUpdater.on('error', (err) =>
    send('update:error', { message: err instanceof Error ? err.message : String(err) })
  )

  void autoUpdater.checkForUpdates().catch(() => undefined)
  setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => undefined)
  }, CHECK_INTERVAL_MS)
}

export function checkForUpdates(): void {
  if (!app.isPackaged) return
  void autoUpdater.checkForUpdates().catch(() => undefined)
}

export function downloadUpdate(): void {
  void autoUpdater.downloadUpdate().catch(() => undefined)
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
