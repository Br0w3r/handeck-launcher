import './ControlHints.css'

export interface ControlHint {
  /** Etiqueta corta del botón: 'A', 'B', 'D-Pad', etc. */
  button: string
  /** Acción que representa: 'Jugar', 'Atrás'… */
  label: string
}

interface ControlHintsProps {
  hints: ControlHint[]
  /** Si no hay mando, se muestra un aviso para usar el teclado (dev). */
  connected: boolean
}

/**
 * Barra inferior con las pistas de control en pantalla (A=Jugar, B=Atrás, …).
 * Estilo tipo consola: se navega 100% con control.
 */
export function ControlHints({ hints, connected }: ControlHintsProps): JSX.Element {
  return (
    <div className="control-hints">
      {!connected && (
        <span className="control-hints__nogamepad">
          Sin mando · usa las flechas del teclado
        </span>
      )}
      {hints.map((hint) => (
        <span key={hint.button} className="control-hints__item">
          <span className="control-hints__button">{hint.button}</span>
          <span className="control-hints__label">{hint.label}</span>
        </span>
      ))}
    </div>
  )
}
