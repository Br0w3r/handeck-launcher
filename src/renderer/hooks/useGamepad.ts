import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useGamepad — navegación con control vía la Gamepad API estándar (XInput).
 *
 * Funciona en cualquier handheld Windows (MSI Claw, ROG Ally, Legion Go) y con
 * mandos Xbox/PS por USB/BT. Incluye fallback de teclado (flechas/Enter/Esc)
 * para poder desarrollar y probar sin un mando conectado.
 *
 * Características (según LAUNCHER_CONTEXT.md):
 *  - Loop de polling con requestAnimationFrame.
 *  - Edge detection (pressed vs held) para no disparar en cada frame.
 *  - Repeat tipo teclado: primer input inmediato → initialDelay → repeatInterval.
 *  - Threshold/deadzone del joystick para evitar drift (default 0.5).
 */

/**
 * Familia de mando, para mostrar los glifos correctos (los índices de botón de
 * la Gamepad API son los mismos; sólo cambia la etiqueta que ve el usuario).
 */
export type PadLayout = 'xbox' | 'playstation'

/**
 * Detecta la familia del mando por su `id` (Gamepad API). Los DualShock/DualSense
 * de Sony reportan el vendor 054c; el resto (handhelds tipo Claw/Ally/Legion,
 * mandos Xbox, genéricos) se tratan como layout Xbox por defecto.
 */
export function detectLayout(id: string): PadLayout {
  const s = id.toLowerCase()
  if (
    s.includes('054c') ||
    s.includes('dualshock') ||
    s.includes('dualsense') ||
    s.includes('playstation')
  ) {
    return 'playstation'
  }
  return 'xbox'
}

/** Mapeo estándar de botones XInput. */
export const BUTTONS = {
  A: 0, // Confirmar / Jugar
  B: 1, // Cancelar / Atrás
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  HOME: 16
} as const

export interface UseGamepadOptions {
  /** Cantidad de elementos navegables (p.ej. juegos del carousel). */
  itemCount: number
  /** Se dispara con A / Enter sobre el índice seleccionado. */
  onConfirm?: (index: number) => void
  /** Se dispara con B / Escape. */
  onBack?: () => void
  /** Se dispara con Y / tecla "y" (p.ej. abrir Ajustes). */
  onMenu?: () => void
  /** Se dispara con X / tecla "x" (p.ej. abrir el menú de acciones del juego). */
  onAction?: () => void
  /** Gatillo/bumper izquierdo (LT/LB, teclas "q"/"["), p.ej. filtro anterior. */
  onTriggerLeft?: () => void
  /** Gatillo/bumper derecho (RT/RB, teclas "e"/"]"), p.ej. filtro siguiente. */
  onTriggerRight?: () => void
  /** Umbral del joystick para considerar movimiento (default 0.5). */
  deadzone?: number
  /** ms antes de empezar a repetir al mantener una dirección (default 400). */
  initialDelay?: number
  /** ms entre repeticiones mientras se mantiene (default 130). */
  repeatInterval?: number
  /** Si es false, no se escucha input (default true). */
  enabled?: boolean
}

export interface UseGamepadResult {
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  /** ¿Hay al menos un mando conectado? (para pistas de UI). */
  connected: boolean
  /** Familia del mando conectado, para mostrar los glifos correctos. */
  layout: PadLayout
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function useGamepad(options: UseGamepadOptions): UseGamepadResult {
  const {
    itemCount,
    onConfirm,
    onBack,
    onMenu,
    onAction,
    onTriggerLeft,
    onTriggerRight,
    deadzone = 0.5,
    initialDelay = 400,
    repeatInterval = 130,
    enabled = true
  } = options

  const [selectedIndex, setSelectedIndexState] = useState(0)
  const [connected, setConnected] = useState(false)
  const [layout, setLayout] = useState<PadLayout>('xbox')

  // Refs para que el loop de RAF vea siempre los valores frescos sin reiniciarse.
  const selectedIndexRef = useRef(0)
  const itemCountRef = useRef(itemCount)
  const onConfirmRef = useRef(onConfirm)
  const onBackRef = useRef(onBack)
  const onMenuRef = useRef(onMenu)
  const onActionRef = useRef(onAction)
  const onTriggerLeftRef = useRef(onTriggerLeft)
  const onTriggerRightRef = useRef(onTriggerRight)
  const deadzoneRef = useRef(deadzone)
  const initialDelayRef = useRef(initialDelay)
  const repeatIntervalRef = useRef(repeatInterval)

  useEffect(() => {
    itemCountRef.current = itemCount
  }, [itemCount])
  useEffect(() => {
    onConfirmRef.current = onConfirm
  }, [onConfirm])
  useEffect(() => {
    onBackRef.current = onBack
  }, [onBack])
  useEffect(() => {
    onMenuRef.current = onMenu
  }, [onMenu])
  useEffect(() => {
    onActionRef.current = onAction
  }, [onAction])
  useEffect(() => {
    onTriggerLeftRef.current = onTriggerLeft
  }, [onTriggerLeft])
  useEffect(() => {
    onTriggerRightRef.current = onTriggerRight
  }, [onTriggerRight])
  useEffect(() => {
    deadzoneRef.current = deadzone
    initialDelayRef.current = initialDelay
    repeatIntervalRef.current = repeatInterval
  }, [deadzone, initialDelay, repeatInterval])

  const setSelectedIndex = useCallback((index: number) => {
    const clamped = clamp(index, 0, Math.max(0, itemCountRef.current - 1))
    selectedIndexRef.current = clamped
    setSelectedIndexState(clamped)
  }, [])

  // Mantener el índice válido cuando cambia la cantidad de elementos.
  useEffect(() => {
    if (selectedIndexRef.current > itemCount - 1) {
      setSelectedIndex(Math.max(0, itemCount - 1))
    }
  }, [itemCount, setSelectedIndex])

  const move = useCallback(
    (dir: number) => {
      setSelectedIndex(selectedIndexRef.current + dir)
    },
    [setSelectedIndex]
  )

  // Refs para leer valores frescos dentro del loop/listeners sin re-adjuntarlos.
  const enabledRef = useRef(enabled)
  const moveRef = useRef(move)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])
  useEffect(() => {
    moveRef.current = move
  }, [move])

  // El efecto se monta UNA sola vez: adjunta listeners/RAF y luego se guarda por
  // enabledRef para activar/desactivar sin re-adjuntar (StrictMode-safe).
  useEffect(() => {
    let rafId = 0
    // Estado de repetición direccional.
    let heldDir = 0
    let nextRepeatAt = 0
    // Estado previo de botones para edge detection.
    const prevPressed: boolean[] = []

    const handleDirection = (dir: number, now: number): void => {
      if (dir === 0) {
        heldDir = 0
        return
      }
      if (dir !== heldDir) {
        moveRef.current(dir) // primer input: inmediato
        heldDir = dir
        nextRepeatAt = now + initialDelayRef.current
      } else if (now >= nextRepeatAt) {
        moveRef.current(dir) // repetición mientras se mantiene
        nextRepeatAt = now + repeatIntervalRef.current
      }
    }

    const handleButtonEdge = (
      pad: Gamepad,
      index: number,
      action: () => void
    ): void => {
      const pressed = pad.buttons[index]?.pressed ?? false
      if (pressed && !prevPressed[index]) action()
      prevPressed[index] = pressed
    }

    const poll = (now: number): void => {
      if (!enabledRef.current) {
        heldDir = 0
        rafId = requestAnimationFrame(poll)
        return
      }

      const pads = navigator.getGamepads?.() ?? []
      const pad = Array.from(pads).find((p): p is Gamepad => p !== null)

      if (pad) {
        const dz = deadzoneRef.current
        const axX = pad.axes[0] ?? 0
        const axY = pad.axes[1] ?? 0
        const next =
          (pad.buttons[BUTTONS.DPAD_DOWN]?.pressed ?? false) ||
          (pad.buttons[BUTTONS.DPAD_RIGHT]?.pressed ?? false) ||
          axY > dz ||
          axX > dz
        const prev =
          (pad.buttons[BUTTONS.DPAD_UP]?.pressed ?? false) ||
          (pad.buttons[BUTTONS.DPAD_LEFT]?.pressed ?? false) ||
          axY < -dz ||
          axX < -dz

        handleDirection(next ? 1 : prev ? -1 : 0, now)

        handleButtonEdge(pad, BUTTONS.A, () =>
          onConfirmRef.current?.(selectedIndexRef.current)
        )
        handleButtonEdge(pad, BUTTONS.B, () => onBackRef.current?.())
        handleButtonEdge(pad, BUTTONS.Y, () => onMenuRef.current?.())
        handleButtonEdge(pad, BUTTONS.X, () => onActionRef.current?.())
        // Gatillos (LT/RT) y bumpers (LB/RB): cambiar de filtro/pestaña.
        handleButtonEdge(pad, BUTTONS.LT, () => onTriggerLeftRef.current?.())
        handleButtonEdge(pad, BUTTONS.LB, () => onTriggerLeftRef.current?.())
        handleButtonEdge(pad, BUTTONS.RT, () => onTriggerRightRef.current?.())
        handleButtonEdge(pad, BUTTONS.RB, () => onTriggerRightRef.current?.())
      } else {
        heldDir = 0
      }

      rafId = requestAnimationFrame(poll)
    }

    rafId = requestAnimationFrame(poll)

    // Fallback de teclado para desarrollo.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!enabledRef.current) return
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          moveRef.current(1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          moveRef.current(-1)
          break
        case 'Enter':
          onConfirmRef.current?.(selectedIndexRef.current)
          break
        case 'Escape':
        case 'Backspace':
          onBackRef.current?.()
          break
        case 'y':
        case 'Y':
          onMenuRef.current?.()
          break
        case 'x':
        case 'X':
          onActionRef.current?.()
          break
        case 'q':
        case '[':
          onTriggerLeftRef.current?.()
          break
        case 'e':
        case ']':
          onTriggerRightRef.current?.()
          break
        default:
          break
      }
    }

    // Detecta la familia del primer mando conectado (para los glifos).
    const detectFromPads = (): void => {
      const pads = navigator.getGamepads?.() ?? []
      const pad = Array.from(pads).find((p): p is Gamepad => p !== null)
      if (pad) setLayout(detectLayout(pad.id))
    }

    const onConnect = (e: GamepadEvent): void => {
      setConnected(true)
      setLayout(detectLayout(e.gamepad.id))
    }
    const onDisconnect = (): void => {
      const pads = navigator.getGamepads?.() ?? []
      setConnected(Array.from(pads).some((p) => p !== null))
      detectFromPads()
    }

    // Estado inicial de conexión y layout.
    setConnected(Array.from(navigator.getGamepads?.() ?? []).some((p) => p !== null))
    detectFromPads()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
    // Montaje único: los valores dinámicos se leen vía refs (enabledRef/moveRef…).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { selectedIndex, setSelectedIndex, connected, layout }
}
