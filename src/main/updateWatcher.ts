import { watch, type FSWatcher } from 'node:fs'

import { getUpdateStates } from './games'
import { getSteamappsDirs, getSteamDownloadingDirs } from './games/steamGames'
import { getMainWindow } from './windowManager'

/**
 * Observa los appmanifest_*.acf de Steam (y las carpetas `downloading/`) con
 * fs.watch y, cuando cambian, empuja el estado de actualización al renderer
 * (canal 'update-states:changed').
 *
 * Reemplaza al sondeo periódico: refresca justo cuando Steam escribe el manifest
 * o trabaja en una descarga, con menos coste. Vive en el main independientemente
 * de la ventana (que se destruye/recrea al lanzar juegos), así que sólo emite si
 * hay ventana.
 *
 * Por qué también observamos `downloading/`: durante la fase de validación Steam
 * NO reescribe el StateFlags del appmanifest (se queda en "pendiente"), pero sí
 * crea `steamapps/downloading/<appid>/` y escribe ahí los `depot_*.delta`. Vigilar
 * esa carpeta permite reflejar "Actualizando" en cuanto Steam arranca, sin
 * quedarse pegado en "pendiente".
 */

let watchers: FSWatcher[] = []
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let rearmTimer: ReturnType<typeof setTimeout> | null = null

/** Recalcula y envía el estado a la ventana actual (si existe). */
function emitUpdateStates(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send('update-states:changed', getUpdateStates())
  } catch (err) {
    console.warn('[update-watcher] No se pudo emitir el estado:', err)
  }
}

/**
 * Empuja el estado actual al renderer bajo demanda (p.ej. cuando termina un
 * refresco de updates de Epic en segundo plano).
 */
export function pushUpdateStates(): void {
  emitUpdateStates()
}

/** Agrupa ráfagas de eventos de fs.watch en un solo emit. */
function scheduleEmit(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(emitUpdateStates, 400)
}

/**
 * Re-arma los watchers poco después de que aparezca/desaparezca una carpeta
 * `downloading` (Steam la crea al empezar una descarga y la borra al terminar),
 * para engancharnos a ella o soltarla.
 */
function scheduleRearm(): void {
  if (rearmTimer) clearTimeout(rearmTimer)
  rearmTimer = setTimeout(startUpdateWatcher, 800)
}

/** Empieza a observar todas las carpetas relevantes. Idempotente. */
export function startUpdateWatcher(): void {
  stopUpdateWatcher()

  // 1) Carpetas steamapps: cambios en appmanifest_*.acf y aparición/desaparición
  //    de la carpeta `downloading` (que dispara un re-armado).
  for (const dir of getSteamappsDirs()) {
    try {
      const watcher = watch(dir, { persistent: false }, (_event, filename) => {
        const name = filename?.toString() ?? ''
        if (name.endsWith('.acf')) {
          scheduleEmit()
        } else if (name === 'downloading') {
          scheduleEmit()
          scheduleRearm()
        }
      })
      watcher.on('error', () => {
        /* fs.watch puede fallar en algunas unidades; lo ignoramos */
      })
      watchers.push(watcher)
    } catch (err) {
      console.warn(`[update-watcher] No se pudo observar ${dir}:`, err)
    }
  }

  // 2) Carpetas downloading/: cualquier cambio (crear downloading/<appid>,
  //    escribir/borrar depot_*.delta) refleja el arranque/fin de una descarga.
  for (const dir of getSteamDownloadingDirs()) {
    try {
      const watcher = watch(dir, { persistent: false }, () => scheduleEmit())
      watcher.on('error', () => {
        /* noop */
      })
      watchers.push(watcher)
    } catch (err) {
      console.warn(`[update-watcher] No se pudo observar ${dir}:`, err)
    }
  }
}

/** Detiene todos los watchers y limpia los timers. */
export function stopUpdateWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (rearmTimer) {
    clearTimeout(rearmTimer)
    rearmTimer = null
  }
  for (const watcher of watchers) {
    try {
      watcher.close()
    } catch {
      /* noop */
    }
  }
  watchers = []
}
