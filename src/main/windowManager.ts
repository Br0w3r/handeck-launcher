import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'

/**
 * Gestión del ciclo de vida de la ventana.
 *
 * El patrón clave del launcher (ver LAUNCHER_CONTEXT.md): cuando un juego
 * arranca se DESTRUYE la BrowserWindow (libera el renderer de Chromium ~) pero
 * el main process sigue vivo; al cerrarse el juego se recrea la ventana en
 * ~300-500ms. Aquí se centraliza crear/destruir para reutilizarlo desde el
 * gameMonitor en pasos posteriores.
 */

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createWindow(): BrowserWindow {
  // El launcher arranca como un juego: pantalla completa, sin bordes.
  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    show: false,
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Los enlaces externos (si los hubiera) se abren fuera del launcher.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Carga el renderer: dev server de Vite en desarrollo, HTML compilado en prod.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/**
 * Trae HanDeck al frente: si la ventana existe la muestra/enfoca; si fue
 * destruida (p.ej. durante un juego) la recrea. Lo usa el atajo global y la
 * segunda instancia (al pulsar el botón/tecla asignada al launcher).
 */
export function summonWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}

/**
 * Destruye la ventana liberando el renderer, manteniendo vivo el main process.
 * Se usará al lanzar un juego (Paso 7).
 */
export function destroyWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
  mainWindow = null
}
