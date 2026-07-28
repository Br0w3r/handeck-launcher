import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'

import { showWindow, toggleWindow } from './windowManager'

/**
 * Icono en la bandeja del sistema (área de notificaciones).
 *
 * Permite que HanDeck viva en segundo plano cuando se esconde (como MSI Center):
 * fuera de la barra de tareas, accesible desde el icono de la bandeja.
 */

let tray: Tray | null = null

function iconPath(): string {
  // Empaquetado: icon.ico junto a los recursos (extraResources). Dev: el del repo.
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(process.cwd(), 'resources', 'icon.ico')
}

export function createTray(onQuit: () => void): void {
  if (tray) return

  const image = nativeImage.createFromPath(iconPath())
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('HanDeck Launcher')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir HanDeck', click: () => showWindow() },
      { type: 'separator' },
      { label: 'Salir', click: onQuit }
    ])
  )
  // Clic en el icono de la bandeja: alterna mostrar/ocultar.
  tray.on('click', () => toggleWindow())
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
