import { useCallback, useEffect, useState } from 'react'

import { ControlHints } from './components/ControlHints/ControlHints'
import { GameCarousel } from './components/GameCarousel/GameCarousel'
import { GameHero } from './components/GameHero/GameHero'
import { LaunchOverlay } from './components/LaunchOverlay/LaunchOverlay'
import { gameKey, useArtwork } from './hooks/useArtwork'
import { useGamepad } from './hooks/useGamepad'
import { useGames } from './hooks/useGames'
import { useLaunch } from './hooks/useLaunch'
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

  useEffect(() => {
    window.handeck
      ?.isLegendaryAuthenticated()
      .then(setLegendaryAuth)
      .catch(() => setLegendaryAuth(false))
  }, [])

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

  const handleConfirm = useCallback(
    (index: number) => {
      // Durante el overlay, A reintenta si hubo error; si no, ignora.
      if (launching) {
        if (launch.status === 'error') launch.retry()
        return
      }
      const game = games[index]
      if (game) launch.launch(game)
    },
    [games, launching, launch]
  )

  const handleBack = useCallback(() => {
    if (launching) launch.cancel()
  }, [launching, launch])

  const { selectedIndex, connected } = useGamepad({
    itemCount: games.length,
    onConfirm: handleConfirm,
    onBack: handleBack,
    enabled: !loading && !error && games.length > 0
  })

  // Al arrancar el juego (running), cerrar el overlay tras un instante.
  // (En el Paso 7 esto se sustituye por destruir la ventana.)
  useEffect(() => {
    if (launch.status === 'running') {
      const t = setTimeout(launch.dismiss, 1400)
      return () => clearTimeout(t)
    }
    return undefined
  }, [launch.status, launch.dismiss])

  const ready = !loading && !error && games.length > 0
  const selectedGame = games[selectedIndex]
  const selectedHero = selectedGame ? artwork[gameKey(selectedGame)]?.hero ?? null : null

  const steamCount = games.filter((g) => g.platform === 'steam').length
  const epicCount = games.filter((g) => g.platform === 'epic').length

  return (
    <div className="app">
      <GameHero heroUrl={selectedHero} />

      {legendaryAuth === false && (
        <div className="app__toast app__toast--warning">
          ⚠️ legendary no está instalado o sin cuenta de Epic. Ejecuta{' '}
          <code>legendary auth</code> para ver tus juegos de Epic.
        </div>
      )}

      {justReturned && (
        <div className="app__toast app__toast--launch">👋 ¡Bienvenido de nuevo!</div>
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
            No se detectaron juegos instalados de Steam ni Epic.
          </p>
        </div>
      )}

      {ready && selectedGame && (
        <>
          <div className="app__info">
            <p className="app__brand">HanDeck</p>
            <h1 className="app__title">{selectedGame.title}</h1>
            <div className="app__meta">
              <span className={`app__meta-badge app__meta-badge--${selectedGame.platform}`}>
                {selectedGame.platform}
              </span>
              <span>ID: {selectedGame.id}</span>
            </div>
          </div>

          <div className="app__count">
            {games.length} juegos · {steamCount} Steam · {epicCount} Epic
          </div>

          <GameCarousel games={games} artwork={artwork} selectedIndex={selectedIndex} />
        </>
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

      <ControlHints
        connected={connected}
        hints={[
          { button: '↔', label: 'Navegar' },
          { button: 'A', label: 'Jugar' },
          { button: 'B', label: 'Atrás' }
        ]}
      />
    </div>
  )
}
