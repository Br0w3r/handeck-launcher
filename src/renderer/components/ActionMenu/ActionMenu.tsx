import { useMemo } from 'react'

import type { Game, UpdateInfo } from '../../../preload'
import { useGamepad } from '../../hooks/useGamepad'
import { updateLabel } from '../../hooks/useUpdateStates'
import { faceSymbol } from '../ControlHints/ControlHints'
import './ActionMenu.css'

/**
 * Menú de acciones del juego seleccionado, estilo consola. Se abre con X y se
 * navega arriba/abajo; A ejecuta, B cierra.
 *
 * Steam no permite pausar/reanudar una descarga concreta por API, pero sí estas
 * acciones vía el protocolo steam://. El truco: Steam descarga de una en una, así
 * que "Actualizar ahora" (steam://install/<id>) arranca ESTE juego y pausa
 * automáticamente el que estuviera descargando — justo el comportamiento de
 * "pausar una y empezar otra" que se busca. La pausa total / reordenar se hace en
 * el gestor de descargas de Steam.
 */

interface ActionMenuProps {
  game: Game
  update?: UpdateInfo
  /** Lanza el juego (reutiliza el flujo de A del carousel). */
  onPlay: () => void
  onClose: () => void
}

interface ActionItem {
  key: string
  icon: string
  label: string
  hint?: string
  run: () => void
}

export function ActionMenu({ game, update, onPlay, onClose }: ActionMenuProps): JSX.Element {
  const platform = game.platform
  const state = update?.updateState ?? 'ready'

  const steam = window.handeck?.steamAction
  const openStore = window.handeck?.openStoreGame

  const items = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = [
      {
        key: 'play',
        icon: '▶',
        label: 'Jugar',
        run: () => {
          onClose()
          onPlay()
        }
      }
    ]

    if (platform === 'steam') {
      const updateLabelText =
        state === 'updating'
          ? 'Priorizar esta descarga'
          : state === 'update-pending'
            ? 'Actualizar ahora'
            : 'Buscar actualización'
      const updateHint =
        state === 'ready'
          ? 'Steam comprobará si hay parche'
          : 'Steam pausa las demás y descarga esta'

      list.push(
        {
          key: 'update',
          icon: '⬇',
          label: updateLabelText,
          hint: updateHint,
          run: () => {
            void steam?.('update', game.id)
            onClose()
          }
        },
        {
          key: 'validate',
          icon: '✓',
          label: 'Verificar archivos',
          hint: 'Comprueba la integridad del juego',
          run: () => {
            void steam?.('validate', game.id)
            onClose()
          }
        },
        {
          key: 'downloads',
          icon: '≡',
          label: 'Gestor de descargas de Steam',
          hint: 'Pausar / reordenar toda la cola',
          run: () => {
            void steam?.('downloads')
            onClose()
          }
        },
        {
          key: 'store',
          icon: '🏷',
          label: 'Ver en la tienda',
          run: () => {
            void steam?.('store', game.id)
            onClose()
          }
        }
      )
    } else if (platform === 'epic') {
      const pending = state === 'update-pending'
      list.push({
        key: 'update',
        icon: pending ? '⬇' : '↗',
        label: pending ? 'Actualizar en Epic' : 'Gestionar en Epic',
        hint: pending
          ? 'Abre el Epic Launcher y aplica el parche'
          : 'Abre el Epic Launcher en este juego',
        run: () => {
          void openStore?.('epic', game.id)
          onClose()
        }
      })
    } else if (platform === 'ubisoft') {
      list.push({
        key: 'open',
        icon: '↗',
        label: 'Abrir en Ubisoft Connect',
        hint: 'Gestiona o actualiza el juego',
        run: () => {
          void openStore?.('ubisoft', game.id)
          onClose()
        }
      })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, platform, state])

  const { selectedIndex, layout } = useGamepad({
    itemCount: items.length,
    onConfirm: (i) => items[i]?.run(),
    onBack: onClose,
    enabled: true
  })

  return (
    <div className="action-menu" onClick={onClose}>
      <div className="action-menu__panel" onClick={(e) => e.stopPropagation()}>
        <header className="action-menu__header">
          <div className="action-menu__titles">
            <h2 className="action-menu__title">{game.title}</h2>
            <div className="action-menu__meta">
              <span
                className={`action-menu__badge action-menu__badge--${game.platform}`}
              >
                {game.platform}
              </span>
              {state !== 'ready' && (
                <span className={`action-menu__status action-menu__status--${state}`}>
                  {update ? updateLabel(update) : ''}
                </span>
              )}
            </div>
          </div>
        </header>

        <ul className="action-menu__list">
          {items.map((item, i) => (
            <li
              key={item.key}
              className={
                'action-menu__item' +
                (i === selectedIndex ? ' action-menu__item--selected' : '')
              }
              onClick={item.run}
            >
              <span className="action-menu__icon">{item.icon}</span>
              <span className="action-menu__labels">
                <span className="action-menu__label">{item.label}</span>
                {item.hint && <span className="action-menu__hint">{item.hint}</span>}
              </span>
            </li>
          ))}
        </ul>

        <footer className="action-menu__footer">
          <span>↕ Navegar</span>
          <span>{faceSymbol(layout, 'confirm')} Elegir</span>
          <span>{faceSymbol(layout, 'back')} Cerrar</span>
        </footer>
      </div>
    </div>
  )
}
