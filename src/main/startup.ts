import { app } from 'electron'

/**
 * Arranque automático al iniciar sesión de Windows (login item).
 *
 * Usa la API nativa de Electron (escribe la entrada Run del registro en Windows).
 * Sólo se aplica en la app empaquetada: en desarrollo `process.execPath` es el
 * binario de Electron y no queremos ensuciar el arranque del equipo de dev.
 */

export function getLaunchOnStartup(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

export function setLaunchOnStartup(enabled: boolean): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: []
  })
}
