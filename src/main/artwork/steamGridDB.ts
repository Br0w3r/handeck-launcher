import axios from 'axios'

import type { ArtworkUrls, Game } from '../games/types'
import { getStore } from '../store'

/**
 * Cliente de la API de SteamGridDB (https://www.steamgriddb.com/api/v2).
 *
 * Resuelve, para un juego, la URL de una portada vertical (grid) y una imagen
 * hero. Para Steam se puede consultar directamente por appId; para el resto se
 * busca el juego por nombre y luego se piden sus imágenes.
 *
 * Requiere una API key gratuita (registro en steamgriddb.com). Orden de
 * resolución: variable de entorno STEAMGRIDDB_API_KEY → key personalizada en la
 * config → key por defecto que se distribuye con el launcher. Así el artwork
 * funciona "de fábrica" para todos, pero un usuario puede poner la suya.
 */

const API_BASE = 'https://www.steamgriddb.com/api/v2'
// Dimensiones verticales tipo PS5 preferidas para las portadas.
const GRID_DIMENSIONS = '600x900,342x482,660x930'

/**
 * Key por defecto embebida en el launcher (solo lectura de artwork, gratuita).
 * Cualquiera puede sobreescribirla con la suya desde Ajustes o la env var.
 * Nota: al distribuirse en el .exe es extraíble; es aceptable para una key de
 * artwork de solo lectura y con límite de tasa.
 */
export const DEFAULT_SGDB_API_KEY = '28698478e188bd0bf4a85c6863969e00'

export function getApiKey(): string {
  return (
    process.env['STEAMGRIDDB_API_KEY'] ||
    getStore().get('steamGridDbApiKey') ||
    DEFAULT_SGDB_API_KEY
  )
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0
}

interface SgdbListResponse {
  success: boolean
  data?: Array<{ url?: string }>
}

interface SgdbSearchResponse {
  success: boolean
  data?: Array<{ id: number }>
}

/** GET a la API con el header de autorización. */
async function sgdbGet<T>(path: string, key: string): Promise<T | null> {
  try {
    const res = await axios.get<T>(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 15_000
    })
    return res.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null
    console.warn(`[sgdb] Error en GET ${path}:`, err instanceof Error ? err.message : err)
    return null
  }
}

/** Devuelve la primera URL de imagen de un endpoint de lista (grids/heroes). */
async function firstImageUrl(path: string, key: string): Promise<string | null> {
  const data = await sgdbGet<SgdbListResponse>(path, key)
  return data?.success ? data.data?.[0]?.url ?? null : null
}

/** Busca el id interno de SteamGridDB para un juego por su nombre. */
async function searchGameId(title: string, key: string): Promise<number | null> {
  const path = `/search/autocomplete/${encodeURIComponent(title)}`
  const data = await sgdbGet<SgdbSearchResponse>(path, key)
  return data?.success ? data.data?.[0]?.id ?? null : null
}

/** Resuelve las URLs de artwork (grid + hero) para un juego. */
export async function resolveArtwork(game: Game): Promise<ArtworkUrls> {
  const key = getApiKey()
  if (!key) return { grid: null, hero: null }

  let grid: string | null = null
  let hero: string | null = null

  // Para Steam: intento directo por appId.
  if (game.platform === 'steam') {
    grid = await firstImageUrl(
      `/grids/steam/${game.id}?dimensions=${GRID_DIMENSIONS}&types=static`,
      key
    )
    hero = await firstImageUrl(`/heroes/steam/${game.id}`, key)
  }

  // Fallback (Epic, o Steam sin resultados): buscar por nombre.
  if (!grid || !hero) {
    const sgdbId = await searchGameId(game.title, key)
    if (sgdbId) {
      if (!grid) {
        grid = await firstImageUrl(
          `/grids/game/${sgdbId}?dimensions=${GRID_DIMENSIONS}&types=static`,
          key
        )
      }
      if (!hero) hero = await firstImageUrl(`/heroes/game/${sgdbId}`, key)
    }
  }

  return { grid, hero }
}
