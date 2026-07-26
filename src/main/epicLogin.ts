import { BrowserWindow } from 'electron'

import { authCode, type AuthResult } from './epicAuth'
import { getMainWindow } from './windowManager'

/**
 * Login interactivo de Epic dentro del launcher (como Heroic Games Launcher).
 *
 * Abrimos la página de login oficial de Epic en una ventana propia. Al iniciar
 * sesión, Epic redirige a su endpoint de redirect que devuelve un JSON con el
 * `authorizationCode`. Lo leemos automáticamente de la página y se lo pasamos a
 * legendary — el usuario nunca copia ni pega nada.
 *
 * El clientId es el de legendary (el mismo que usa su flujo oficial).
 */

const CLIENT_ID = '34a02cf8f4414e29b15921876da36f9a'
const REDIRECT_ENDPOINT = `https://www.epicgames.com/id/api/redirect?clientId=${CLIENT_ID}&responseType=code`
const LOGIN_URL = `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(
  REDIRECT_ENDPOINT
)}`

/** Marca de la URL a la que Epic redirige tras el login (trae el JSON). */
const REDIRECT_MARKER = '/id/api/redirect'

export async function interactiveEpicLogin(): Promise<AuthResult> {
  const parent = getMainWindow() ?? undefined

  return new Promise<AuthResult>((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 760,
      parent,
      modal: Boolean(parent),
      show: false,
      autoHideMenuBar: true,
      title: 'Iniciar sesión en Epic Games',
      backgroundColor: '#0a0a0f',
      webPreferences: {
        // Sesión propia y persistente: la próxima vez el login es instantáneo.
        partition: 'persist:epic-login',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    let settled = false
    const finish = (result: AuthResult): void => {
      if (settled) return
      settled = true
      if (!win.isDestroyed()) win.close()
      resolve(result)
    }

    win.once('ready-to-show', () => win.show())

    // Permite los popups del login de Epic (2FA, "iniciar sesión con Google/
    // Apple", captcha…) como ventanas hijas en la misma sesión.
    win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))

    /** Intenta leer el authorizationCode de la página de redirect. */
    const tryCapture = async (): Promise<void> => {
      if (settled || win.isDestroyed()) return
      const url = win.webContents.getURL()
      if (!url.includes(REDIRECT_MARKER)) return

      let text = ''
      try {
        text = (await win.webContents.executeJavaScript(
          'document.body.innerText'
        )) as string
      } catch {
        return // la página aún no está lista; otro evento reintentará
      }

      let code: string | null = null
      try {
        const json = JSON.parse(text) as { authorizationCode?: string }
        code = json.authorizationCode ?? null
      } catch {
        return
      }
      if (!code) return

      // Ya tenemos el código: canjearlo con legendary.
      const result = await authCode(code)
      finish(result)
    }

    win.webContents.on('did-finish-load', () => void tryCapture())
    win.webContents.on('did-navigate', () => void tryCapture())
    win.webContents.on('did-redirect-navigation', () => void tryCapture())

    // Si el usuario cierra la ventana sin completar, lo tratamos como cancelación.
    win.on('closed', () => {
      if (!settled) {
        settled = true
        resolve({ ok: false, message: 'Inicio de sesión cancelado.' })
      }
    })

    void win.loadURL(LOGIN_URL)
  })
}
