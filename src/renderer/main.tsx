import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import type { Game, LaunchProgress } from '../preload'
import './styles/global.css'

// Fallback SÓLO para desarrollo cuando el renderer se abre en un navegador normal
// (sin el preload de Electron). En Electron `window.handeck` ya existe, así que
// esto nunca se ejecuta ahí; en producción `import.meta.env.DEV` es false.
if (import.meta.env.DEV && !window.handeck) {
  const MOCK_GAMES: Game[] = [
    { id: '381210', title: 'Dead by Daylight', installPath: 'C:/Steam/DBD', platform: 'steam' },
    { id: '620', title: 'Portal 2', installPath: 'C:/Steam/Portal 2', platform: 'steam' },
    { id: '1091500', title: 'Cyberpunk 2077', installPath: 'C:/Steam/CP2077', platform: 'steam' },
    { id: 'Fortnite', title: 'Fortnite', installPath: 'C:/Epic/Fortnite', platform: 'epic' },
    { id: 'Rocket', title: 'Rocket League', installPath: 'C:/Epic/RL', platform: 'epic' }
  ]
  // Artwork simulado con SVG data-URI (autocontenido, sin red — el SteamGridDB
  // real sólo aplica dentro de Electron).
  const hue = (s: string): number =>
    [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  const svg = (label: string, w: number, h: number, s: string): string => {
    const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='hsl(${hue(s)},55%,32%)'/><text x='50%' y='50%' fill='white' font-family='sans-serif' font-size='${Math.round(w / 12)}' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`
    return `data:image/svg+xml,${encodeURIComponent(doc)}`
  }
  // Simulación del flujo de lanzamiento para probar el LaunchOverlay + ciclo de
  // vida (game:closed). En Electron real el juego corre y la ventana se recrea.
  let statusCb: ((p: LaunchProgress) => void) | null = null
  let gameClosedCb: (() => void) | null = null
  let launchCancelled = false
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

  window.handeck = {
    getGames: async () => MOCK_GAMES,
    isLegendaryAuthenticated: async () => true,
    getArtwork: async (game) => ({
      grid: svg(game.title, 300, 420, game.id),
      hero: svg(game.title, 1280, 720, game.id + 'h')
    }),
    launchGame: async (game) => {
      launchCancelled = false
      const seq: LaunchProgress['status'][] = [
        'checking-updates',
        'verifying',
        'repairing',
        'launching',
        'running'
      ]
      for (const status of seq) {
        await wait(900)
        if (launchCancelled) return
        statusCb?.({ gameId: game.id, status })
      }
      // Simula que el juego corrió un rato y luego se cerró (ciclo de vida).
      await wait(2000)
      if (!launchCancelled) gameClosedCb?.()
    },
    cancelLaunch: async () => {
      launchCancelled = true
    },
    onLaunchStatus: (cb) => {
      statusCb = cb
      return () => {
        statusCb = null
      }
    },
    onGameClosed: (cb) => {
      gameClosedCb = cb
      return () => {
        gameClosedCb = null
      }
    }
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
