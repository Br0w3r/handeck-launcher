import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Game } from '../preload'
import { ActionMenu } from './components/ActionMenu/ActionMenu'
import { ControlHints, triggerLabels } from './components/ControlHints/ControlHints'
import { FilterTabs, type LibraryFilter } from './components/FilterTabs/FilterTabs'
import { GameCarousel } from './components/GameCarousel/GameCarousel'
import { GameHero } from './components/GameHero/GameHero'
import { LaunchOverlay } from './components/LaunchOverlay/LaunchOverlay'
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel'
import { gameKey, useArtwork } from './hooks/useArtwork'
import { useGamepad } from './hooks/useGamepad'
import { useGames } from './hooks/useGames'
import { useLaunch } from './hooks/useLaunch'
import { updateLabel, useUpdateStates } from './hooks/useUpdateStates'
import './styles/library.css'

/**
 * PASO 5: UI tipo PS5 — hero a pantalla completa del juego seleccionado, panel
 * de título/metadata arriba y carousel horizontal de cards abajo. La navegación
 * (Paso 3) y el artwork (Paso 4) se reutilizan; el flujo de lanzamiento real es
 * el Paso 6.
 */
export default function App(): JSX.Element {
  const { games, loading, error, reload } = useGames()
  const artwork = useArtwork(games)
  const launch = useLaunch()
  const [legendaryAuth, setLegendaryAuth] = useState<boolean | null>(null)
  const [justReturned, setJustReturned] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)

  const refreshLegendaryAuth = useCallback(() => {
    window.handeck
      ?.isLegendaryAuthenticated()
      .then(setLegendaryAuth)
      .catch(() => setLegendaryAuth(false))
  }, [])

  useEffect(() => {
    refreshLegendaryAuth()
  }, [refreshLegendaryAuth])

  // Al cerrar Ajustes: refrescar estado de Epic y recargar la biblioteca
  // (por si se acaba de conectar/desconectar la cuenta).
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    refreshLegendaryAuth()
    reload()
  }, [refreshLegendaryAuth, reload])

  // El juego se cerró y el launcher volvió (ventana recreada por el main).
  useEffect(() => {
    return window.handeck?.onGameClosed(() => {
      launch.dismiss()
      setJustReturned(true)
    })
  }, [launch])

  useEffect(() => {
    if (justReturned) {
      const t = setTimeout(() => setJustReturned(false), 4000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [justReturned])

  const launching = launch.game !== null

  const hasLibrary = !loading && !error && games.length > 0

  // Estado de actualización en vivo (fs.watch) — sólo cuando hay biblioteca.
  const updateStates = useUpdateStates(hasLibrary)

  // Filtro activo (se mueve con los gatillos): Instalados / Actualizaciones.
  const [filter, setFilter] = useState<LibraryFilter>('installed')

  // Lista visible según el filtro (sin importar la tienda):
  //  • Instalados     → todos, orden alfabético.
  //  • Actualizaciones → sólo los que se actualizan o están pendientes
  //    (actualizándose primero), orden alfabético dentro de cada grupo.
  const visibleGames = useMemo(() => {
    if (filter === 'updates') {
      return games
        .filter((g) => {
          const state = updateStates[gameKey(g)]?.updateState
          return state === 'updating' || state === 'update-pending'
        })
        .sort((a, b) => {
          const rank = (g: Game): number =>
            updateStates[gameKey(g)]?.updateState === 'updating' ? 0 : 1
          const diff = rank(a) - rank(b)
          return diff !== 0 ? diff : a.title.localeCompare(b.title)
        })
    }
    return [...games].sort((a, b) => a.title.localeCompare(b.title))
  }, [games, updateStates, filter])

  const handleConfirm = useCallback(
    (index: number) => {
      // Durante el overlay, A reintenta si hubo error; si no, ignora.
      if (launching) {
        if (launch.status === 'error') launch.retry()
        return
      }
      const game = visibleGames[index]
      if (game) launch.launch(game)
    },
    [visibleGames, launching, launch]
  )

  const handleBack = useCallback(() => {
    if (launching) launch.cancel()
  }, [launching, launch])

  const { selectedIndex, setSelectedIndex, connected, layout } = useGamepad({
    itemCount: visibleGames.length,
    onConfirm: handleConfirm,
    onBack: handleBack,
    onMenu: () => setSettingsOpen(true),
    // X abre el menú de acciones del juego enfocado (salvo durante un lanzamiento).
    onAction: () => {
      if (!launching) setActionMenuOpen(true)
    },
    // Gatillos: cambian de filtro (izq → Instalados, der → Actualizaciones).
    onTriggerLeft: () => setFilter('installed'),
    onTriggerRight: () => setFilter('updates'),
    // Con Ajustes o el menú de acciones abiertos, su propio useGamepad manda.
    enabled: !settingsOpen && !actionMenuOpen && hasLibrary
  })

  // Al cambiar de filtro, volver al primer juego de la lista.
  useEffect(() => {
    setSelectedIndex(0)
  }, [filter, setSelectedIndex])

  // Al arrancar el juego (running), cerrar el overlay tras un instante.
  // (En el Paso 7 esto se sustituye por destruir la ventana.)
  useEffect(() => {
    if (launch.status === 'running') {
      const t = setTimeout(launch.dismiss, 1400)
      return () => clearTimeout(t)
    }
    return undefined
  }, [launch.status, launch.dismiss])

  const selectedGame = visibleGames[selectedIndex]
  const selectedHero = selectedGame ? artwork[gameKey(selectedGame)]?.hero ?? null : null
  const selectedUpdate = selectedGame ? updateStates[gameKey(selectedGame)] : undefined

  const updatingCount = Object.values(updateStates).filter(
    (u) => u.updateState === 'updating'
  ).length
  const pendingCount = Object.values(updateStates).filter(
    (u) => u.updateState === 'update-pending'
  ).length

  const steamCount = games.filter((g) => g.platform === 'steam').length
  const epicCount = games.filter((g) => g.platform === 'epic').length
  const ubisoftCount = games.filter((g) => g.platform === 'ubisoft').length

  return (
    <div className="app">
      <GameHero heroUrl={selectedHero} />

      <button
        className="app__settings-btn"
        onClick={() => setSettingsOpen(true)}
        aria-label="Ajustes"
        title="Ajustes (Y)"
      >
        ⚙
      </button>

      {legendaryAuth === false && !settingsOpen && (
        <button
          className="app__toast app__toast--warning"
          onClick={() => setSettingsOpen(true)}
        >
          ⚠️ Conecta tu cuenta de Epic para verificar y lanzar sus juegos. Pulsa{' '}
          <strong>Y</strong> o abre <strong>Ajustes</strong>.
        </button>
      )}

      {justReturned && (
        <div className="app__toast app__toast--launch">👋 ¡Bienvenido de nuevo!</div>
      )}

      {hasLibrary && (
        <FilterTabs
          active={filter}
          counts={{ installed: games.length, updates: updatingCount + pendingCount }}
          layout={layout}
        />
      )}

      {loading && (
        <div className="app__overlay">
          <p className="app__status">Cargando biblioteca…</p>
        </div>
      )}

      {error && (
        <div className="app__overlay app__overlay--error">
          <p>Error al cargar la biblioteca: {error}</p>
          <button onClick={reload}>Reintentar</button>
        </div>
      )}

      {!loading && !error && games.length === 0 && (
        <div className="app__overlay">
          <p className="app__status">
            No se detectaron juegos instalados de Steam, Epic ni Ubisoft.
          </p>
        </div>
      )}

      {hasLibrary && selectedGame && (
        <>
          <div className="app__info">
            <p className="app__brand">HanDeck</p>
            <h1 className="app__title">{selectedGame.title}</h1>
            <div className="app__meta">
              <span className={`app__meta-badge app__meta-badge--${selectedGame.platform}`}>
                {selectedGame.platform}
              </span>
              <span>ID: {selectedGame.id}</span>
              {selectedUpdate && selectedUpdate.updateState !== 'ready' && (
                <span
                  className={`app__update-badge app__update-badge--${selectedUpdate.updateState}`}
                >
                  {updateLabel(selectedUpdate)}
                </span>
              )}
            </div>
          </div>

          <div className="app__count">
            <span>{games.length} juegos</span>
            <span className="app__count-dot">·</span>
            <span>{steamCount} Steam</span>
            <span className="app__count-dot">·</span>
            <span>{epicCount} Epic</span>
            {ubisoftCount > 0 && (
              <>
                <span className="app__count-dot">·</span>
                <span>{ubisoftCount} Ubisoft</span>
              </>
            )}
            {updatingCount > 0 && (
              <>
                <span className="app__count-dot">·</span>
                <span className="app__count-updating">{updatingCount} actualizando</span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span className="app__count-dot">·</span>
                <span className="app__count-pending">
                  {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
                </span>
              </>
            )}
          </div>

          <GameCarousel
            games={visibleGames}
            artwork={artwork}
            updateStates={updateStates}
            selectedIndex={selectedIndex}
          />
        </>
      )}

      {hasLibrary && filter === 'updates' && visibleGames.length === 0 && (
        <div className="app__overlay">
          <p className="app__status">
            No hay juegos actualizándose ni pendientes de actualizar. 🎉
          </p>
        </div>
      )}

      {launch.game && (
        <LaunchOverlay
          game={launch.game}
          status={launch.status}
          error={launch.error}
          onRetry={launch.retry}
          onCancel={launch.cancel}
        />
      )}

      {settingsOpen && <SettingsPanel onClose={closeSettings} />}

      {actionMenuOpen && selectedGame && (
        <ActionMenu
          game={selectedGame}
          update={selectedUpdate}
          onPlay={() => launch.launch(selectedGame)}
          onClose={() => setActionMenuOpen(false)}
        />
      )}

      <ControlHints
        connected={connected}
        layout={layout}
        hints={[
          {
            button: `${triggerLabels(layout).left}·${triggerLabels(layout).right}`,
            label: 'Filtro'
          },
          { button: '↔', label: 'Navegar' },
          { face: 'confirm', label: 'Jugar' },
          { face: 'options', label: 'Opciones' },
          { face: 'back', label: 'Atrás' },
          { face: 'menu', label: 'Ajustes' }
        ]}
      />
    </div>
  )
}
