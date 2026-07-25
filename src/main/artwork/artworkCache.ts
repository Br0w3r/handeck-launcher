import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import axios from 'axios'
import { app } from 'electron'

import type { Game } from '../games/types'

/**
 * Cache local de imágenes descargadas de SteamGridDB.
 *
 * Las imágenes se guardan en app.getPath('userData')/artwork-cache y se sirven
 * al renderer mediante el protocolo custom `handeck-art://` (ver main/index.ts).
 * No se vuelve a descargar si el archivo ya existe.
 */

export type ArtworkType = 'grid' | 'hero'

/** Clave estable y segura para URLs/nombres de archivo a partir del juego. */
export function artworkKey(game: Game): string {
  return createHash('sha1').update(`${game.platform}:${game.id}`).digest('hex')
}

export function getCacheDir(): string {
  const dir = join(app.getPath('userData'), 'artwork-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Ruta absoluta del archivo cacheado para (clave, tipo). */
export function cachedFilePath(key: string, type: ArtworkType): string {
  return join(getCacheDir(), `${key}--${type}`)
}

/**
 * Descarga una imagen a la cache si aún no existe y devuelve su ruta local.
 * Devuelve null si la descarga falla.
 */
export async function cacheImage(
  key: string,
  type: ArtworkType,
  url: string
): Promise<string | null> {
  const filePath = cachedFilePath(key, type)
  if (existsSync(filePath)) return filePath

  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 20_000
    })
    writeFileSync(filePath, Buffer.from(res.data))
    return filePath
  } catch (err) {
    console.warn(`[artwork] No se pudo descargar ${url}:`, err instanceof Error ? err.message : err)
    return null
  }
}
