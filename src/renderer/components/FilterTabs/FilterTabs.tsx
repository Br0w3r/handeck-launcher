import type { PadLayout } from '../../hooks/useGamepad'
import { triggerLabels } from '../ControlHints/ControlHints'
import './FilterTabs.css'

/** Filtro activo de la biblioteca. */
export type LibraryFilter = 'installed' | 'updates'

interface FilterTabsProps {
  active: LibraryFilter
  /** Nº de juegos en cada filtro (para el contador de cada pestaña). */
  counts: { installed: number; updates: number }
  /** Familia del mando, para mostrar la etiqueta correcta de los gatillos. */
  layout: PadLayout
}

/**
 * Pestañas de filtro de la biblioteca, movibles con los gatillos del control
 * (LT/RT o L2/R2). Sólo muestra el estado; el cambio lo maneja App vía
 * onTriggerLeft/onTriggerRight de useGamepad.
 */
export function FilterTabs({ active, counts, layout }: FilterTabsProps): JSX.Element {
  const { left, right } = triggerLabels(layout)

  return (
    <div className="filter-tabs">
      <span className="filter-tabs__trigger">{left}</span>

      <div className="filter-tabs__group">
        <span
          className={
            'filter-tabs__tab' +
            (active === 'installed' ? ' filter-tabs__tab--active' : '')
          }
        >
          Instalados
          <span className="filter-tabs__count">{counts.installed}</span>
        </span>
        <span
          className={
            'filter-tabs__tab' +
            (active === 'updates' ? ' filter-tabs__tab--active' : '')
          }
        >
          Actualizaciones
          <span className="filter-tabs__count">{counts.updates}</span>
        </span>
      </div>

      <span className="filter-tabs__trigger">{right}</span>
    </div>
  )
}
