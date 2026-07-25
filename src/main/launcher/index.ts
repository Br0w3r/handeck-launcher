import { spawn, type ChildProcess } from 'node:child_process'

import type { Game, LaunchProgress, LaunchStatus } from '../games/types'
import { launchEpic } from './epicLauncher'
import { launchSteam } from './steamLauncher'

/**
 * Orquestador del flujo verify + launch. Delega en epicLauncher/steamLauncher y
 * gestiona el proceso hijo actual para poder cancelar. Replica la lógica de
 * referencia_dbd_launcher.py usando child_process.spawn en lugar de subprocess.
 */

export type LaunchEmit = (progress: Omit<LaunchProgress, 'gameId'>) => void

export interface LaunchContext {
  /** Emite un cambio de estado al renderer (ignora si ya se canceló). */
  emit: (status: LaunchStatus, extra?: { message?: string; error?: string }) => void
  isCancelled: () => boolean
  /** Ejecuta un comando y espera su salida (verify/repair/update). */
  run: (cmd: string, args: string[]) => Promise<{ code: number; output: string }>
  /** Lanza un comando desprendido sin esperar (el launch final del juego). */
  runDetached: (cmd: string, args: string[]) => void
  /** Espera ms (cancelable). */
  wait: (ms: number) => Promise<void>
}

interface ActiveLaunch {
  cancelled: boolean
  child: ChildProcess | null
  lastStatus: LaunchStatus
}

let active: ActiveLaunch | null = null

/** Cancela el lanzamiento en curso (mata el proceso hijo si lo hay). */
export function cancelLaunch(): void {
  if (active) {
    active.cancelled = true
    active.child?.kill()
    active.child = null
  }
}

/**
 * Ejecuta el flujo completo para un juego, emitiendo estados vía `emit`.
 * Cancela cualquier lanzamiento previo antes de empezar.
 * Devuelve true si el juego llegó a lanzarse (status 'running').
 */
export async function launchGame(game: Game, emit: LaunchEmit): Promise<boolean> {
  cancelLaunch()
  const state: ActiveLaunch = { cancelled: false, child: null, lastStatus: 'idle' }
  active = state

  const ctx: LaunchContext = {
    emit: (status, extra) => {
      state.lastStatus = status
      if (!state.cancelled) emit({ status, ...extra })
    },
    isCancelled: () => state.cancelled,
    run: (cmd, args) =>
      new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { windowsHide: true })
        state.child = child
        let output = ''
        child.stdout?.on('data', (d: Buffer) => (output += d.toString()))
        child.stderr?.on('data', (d: Buffer) => (output += d.toString()))
        child.on('error', reject)
        child.on('close', (code) => {
          if (state.child === child) state.child = null
          resolve({ code: code ?? -1, output })
        })
      }),
    runDetached: (cmd, args) => {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true })
      child.unref()
    },
    wait: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      })
  }

  try {
    if (game.platform === 'epic') {
      await launchEpic(game, ctx)
    } else {
      await launchSteam(game, ctx)
    }
  } catch (err) {
    if (!state.cancelled) {
      ctx.emit('error', { error: err instanceof Error ? err.message : String(err) })
    }
  } finally {
    if (active === state) active = null
  }

  return !state.cancelled && state.lastStatus === 'running'
}
