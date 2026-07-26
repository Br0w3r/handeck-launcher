import type { PadLayout } from '../../hooks/useGamepad'
import './ControlHints.css'

/** Botones de acción (cara del mando) que cambian de glifo según el control. */
export type FaceButton = 'confirm' | 'back' | 'options' | 'menu'

interface Glyph {
  symbol: string
  /** Clase de color del glifo (verde/rojo/… en Xbox, formas de color en PS). */
  className: string
}

/**
 * Glifos por familia de mando. Los índices de la Gamepad API son los mismos
 * (0 = abajo, 1 = derecha, 2 = izquierda, 3 = arriba); sólo cambia la etiqueta:
 * en un DualShock el botón de abajo es ✕, no "A".
 */
const GLYPHS: Record<PadLayout, Record<FaceButton, Glyph>> = {
  xbox: {
    confirm: { symbol: 'A', className: 'control-hints__button--xa' },
    back: { symbol: 'B', className: 'control-hints__button--xb' },
    options: { symbol: 'X', className: 'control-hints__button--xx' },
    menu: { symbol: 'Y', className: 'control-hints__button--xy' }
  },
  playstation: {
    confirm: { symbol: '✕', className: 'control-hints__button--ps-cross' },
    back: { symbol: '◯', className: 'control-hints__button--ps-circle' },
    options: { symbol: '▢', className: 'control-hints__button--ps-square' },
    menu: { symbol: '△', className: 'control-hints__button--ps-triangle' }
  }
}

/** Glifo del botón de acción según el mando (para footers de otros paneles). */
export function faceSymbol(layout: PadLayout, face: FaceButton): string {
  return GLYPHS[layout][face].symbol
}

/** Etiquetas de los gatillos según el mando (LT/RT en Xbox, L2/R2 en PS). */
export function triggerLabels(layout: PadLayout): { left: string; right: string } {
  return layout === 'playstation'
    ? { left: 'L2', right: 'R2' }
    : { left: 'LT', right: 'RT' }
}

export interface ControlHint {
  /** Botón de acción que se adapta al mando conectado (A/✕, B/◯, …). */
  face?: FaceButton
  /** Glifo literal, para lo que no depende del mando (p.ej. '↔' navegar). */
  button?: string
  /** Acción que representa: 'Jugar', 'Atrás'… */
  label: string
}

interface ControlHintsProps {
  hints: ControlHint[]
  /** Si no hay mando, se muestra un aviso para usar el teclado (dev). */
  connected: boolean
  /** Familia del mando conectado, para elegir los glifos. */
  layout: PadLayout
}

/**
 * Barra inferior con las pistas de control en pantalla. Los botones de acción se
 * muestran con el glifo del mando conectado (Xbox: A/B/X/Y; PlayStation:
 * ✕/◯/▢/△), para que no confundan a quien usa un DualShock.
 */
export function ControlHints({ hints, connected, layout }: ControlHintsProps): JSX.Element {
  return (
    <div className="control-hints">
      {!connected && (
        <span className="control-hints__nogamepad">
          Sin mando · usa las flechas del teclado
        </span>
      )}
      {hints.map((hint, i) => {
        const glyph = hint.face ? GLYPHS[layout][hint.face] : null
        return (
          <span key={hint.face ?? hint.button ?? i} className="control-hints__item">
            <span
              className={
                'control-hints__button' + (glyph ? ` ${glyph.className}` : '')
              }
            >
              {glyph ? glyph.symbol : hint.button}
            </span>
            <span className="control-hints__label">{hint.label}</span>
          </span>
        )
      })}
    </div>
  )
}
