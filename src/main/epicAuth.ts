import { spawn } from 'node:child_process'

import { legendaryBin } from './paths'

/**
 * Operaciones de autenticación de Epic vía legendary, pensadas para manejarse
 * desde la UI de Ajustes (sin que el usuario toque la terminal).
 *
 * Tres caminos (legendary auth):
 *   --import           Importa la sesión del Epic Games Launcher oficial ya
 *                      instalado. Cero fricción: ideal para handheld.
 *   --code <código>    Login manual: el usuario abre el navegador, inicia sesión
 *                      y pega el authorizationCode.
 *   --delete           Cierra la sesión.
 */

export interface EpicStatus {
  installed: boolean
  authenticated: boolean
  /** Cuenta de Epic vinculada (email/usuario), o null si no hay sesión. */
  account: string | null
}

export interface AuthResult {
  ok: boolean
  /** Mensaje legible para mostrar en la UI (éxito o motivo del fallo). */
  message: string
}

interface RunResult {
  code: number
  stdout: string
  stderr: string
  spawnError: boolean
}

/** Ejecuta legendary de forma asíncrona y captura stdout/stderr. */
function runLegendary(args: string[], timeoutMs = 60_000): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(legendaryBin(), args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) child.kill()
    }, timeoutMs)

    child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()))

    child.on('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr, spawnError: true })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr, spawnError: false })
    })
  })
}

/** Estado actual: instalado, autenticado y cuenta vinculada. */
export async function getEpicStatus(): Promise<EpicStatus> {
  const res = await runLegendary(['status', '--json'], 30_000)
  if (res.spawnError) {
    return { installed: false, authenticated: false, account: null }
  }
  try {
    const status = JSON.parse(res.stdout) as { account?: string }
    const account = status.account && status.account !== '<not logged in>' ? status.account : null
    return { installed: true, authenticated: account !== null, account }
  } catch {
    // legendary respondió (está instalado) pero no pudimos parsear el estado.
    return { installed: true, authenticated: false, account: null }
  }
}

/** Importa la sesión del Epic Games Launcher oficial. */
export async function authImport(): Promise<AuthResult> {
  const res = await runLegendary(['auth', '--import'])
  if (res.spawnError) {
    return { ok: false, message: 'No se encontró legendary.' }
  }
  const out = `${res.stdout}\n${res.stderr}`.toLowerCase()
  if (out.includes('successfully logged in')) {
    return { ok: true, message: 'Sesión de Epic importada correctamente.' }
  }
  // legendary devuelve exit 0 aunque no haya sesión que importar; nos guiamos por
  // el texto. El caso típico: el Epic Launcher no tiene sesión en este usuario.
  if (
    out.includes('no egs login') ||
    out.includes('appdata path does not exist') ||
    out.includes('login manually') ||
    out.includes('unable to import')
  ) {
    return {
      ok: false,
      message:
        'El Epic Games Launcher no tiene sesión en esta PC. Usa "Iniciar sesión manualmente".'
    }
  }
  return { ok: false, message: 'No se pudo importar la sesión de Epic.' }
}

/**
 * Extrae el authorizationCode aunque el usuario pegue el JSON completo, el
 * código entre comillas o con espacios. Epic usa un hex de 32 caracteres.
 */
function extractAuthCode(raw: string): string {
  const fromJson = raw.match(/"?authorizationCode"?\s*[:=]?\s*"?([a-f0-9]{32})/i)
  if (fromJson) return fromJson[1]
  const hex = raw.match(/[a-f0-9]{32}/i)
  if (hex) return hex[0]
  return raw.trim()
}

/** Login manual con el authorizationCode que el usuario pega desde el navegador. */
export async function authCode(code: string): Promise<AuthResult> {
  const clean = extractAuthCode(code)
  if (!clean) return { ok: false, message: 'Pega el código de autorización.' }

  const res = await runLegendary(['auth', '--code', clean])
  if (res.spawnError) {
    return { ok: false, message: 'No se encontró legendary.' }
  }
  const out = `${res.stdout}\n${res.stderr}`.toLowerCase()
  if (res.code === 0 && out.includes('successfully logged in')) {
    return { ok: true, message: 'Sesión de Epic iniciada correctamente.' }
  }
  return {
    ok: false,
    message: 'Código inválido o expirado. Genera uno nuevo e inténtalo de nuevo.'
  }
}

/** Cierra la sesión de Epic (legendary auth --delete). */
export async function logout(): Promise<AuthResult> {
  const res = await runLegendary(['auth', '--delete'])
  if (res.spawnError) {
    return { ok: false, message: 'No se encontró legendary.' }
  }
  // --delete devuelve 0 tanto si había sesión como si no.
  return { ok: res.code === 0, message: 'Sesión de Epic cerrada.' }
}
