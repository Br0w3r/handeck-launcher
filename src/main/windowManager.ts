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

// Cuando es true, cerrar la ventana sí cierra la app (lo activa "Salir" del tray).
// Mientras sea false, cerrar/ocultar sólo la manda a la bandeja del sistema.
let quitting = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setQuitting(value: boolean): void {
  quitting = value
}

export function isQuitting(): boolean {
  return quitting
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

  // Cerrar la ventana (X/Alt+F4) NO cierra la app: la esconde a la bandeja,
  // como un proceso en segundo plano. Sólo "Salir" del tray cierra de verdad.
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
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
 * Trae HanDeck al frente: lo muestra/enfoca, o lo recrea si fue destruido
 * (p.ej. durante un juego). Siempre deja la ventana visible.
 */
export function showWindow(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

/**
 * Alterna HanDeck como un botón "home": si está al frente lo ESCONDE a la
 * bandeja del sistema (fuera de la barra de tareas, proceso en segundo plano);
 * si está oculto/en segundo plano lo trae al frente. Lo usan el atajo global y
 * el botón físico (segunda instancia).
 */
export function toggleWindow(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  const atFront = win.isVisible() && !win.isMinimized() && win.isFocused()
  if (atFront) {
    win.hide() // a la bandeja: desaparece de la barra de tareas
  } else {
    showWindow()
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
