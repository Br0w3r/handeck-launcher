# 🎮 HanDeck Launcher

Launcher de juegos tipo PS5 para handhelds Windows (MSI Claw 8 AI+, ROG Ally,
Legion Go). Detecta la biblioteca de Steam y Epic, verifica integridad y
actualizaciones antes de lanzar, y se navega 100% con control.

Stack: **Electron + React + TypeScript + Vite** (vía `electron-vite`).

## Scripts

```bash
npm run dev        # arranca el launcher en modo desarrollo (main + renderer)
npm run build      # compila main, preload y renderer a out/
npm run typecheck  # verifica tipos de main y renderer
npm run detect     # prueba la detección de juegos SIN abrir Electron
npm run icon       # regenera resources/icon.ico
npm run dist       # genera el instalador NSIS .exe en dist/ (Windows)
```

## Empaquetado (Paso 8)

El instalador `.exe` se genera con **electron-builder** (target NSIS, x64):

```bash
npm run dist    # → dist/HanDeck Launcher-Setup-<version>.exe
```

- `legendary.exe` se empaqueta automáticamente si lo colocas en
  `resources/bin/` (ver `resources/bin/README.md`).
- El instalador usa idiomas `es_ES` y `en_US` (es_MX rompe NSIS por tener la
  tabla de traducciones incompleta).

### CI — GitHub Actions

`.github/workflows/build.yml` compila el `.exe` en un runner **windows-latest**
al hacer push a `main`, al publicar un tag `vX.Y.Z`, o manualmente
(_workflow_dispatch_). El instalador queda como _artifact_ y, si es un tag, se
adjunta a una GitHub Release.

## Estado por pasos

- [x] **Paso 1** — Main process + detección de juegos Steam y Epic (sin UI)
- [x] **Paso 2** — IPC básico + React con lista de juegos en texto plano
- [x] **Paso 3** — `useGamepad` + navegación funcional
- [x] **Paso 4** — SteamGridDB + artwork (covers + hero)
- [x] **Paso 5** — UI PS5-like (carousel, hero, cards)
- [x] **Paso 6** — LaunchOverlay + flujo verify/launch
- [x] **Paso 7** — Ciclo de vida (destruir/recrear ventana al lanzar/cerrar juego)
- [x] **Paso 8** — electron-builder + empaquetado (NSIS) + CI en GitHub Actions

## Detección de juegos (Paso 1)

- **Steam** — `src/main/games/steamGames.ts`: localiza Steam, lee
  `libraryfolders.vdf` (soporta varios discos) y parsea los `appmanifest_*.acf`,
  devolviendo sólo los juegos con `StateFlags & 4` (completamente instalados).
- **Epic** — `src/main/games/epicGames.ts`: usa `legendary list-installed --json`
  y, como fallback, lee los manifests `.item` del Epic Games Launcher. Expone
  además `isLegendaryInstalled()` / `isLegendaryAuthenticated()`.

La detección es cross-platform para poder probarse en macOS/Linux durante el
desarrollo, aunque el objetivo de despliegue es Windows.

## Artwork (Paso 4) — API key de SteamGridDB

El artwork (portadas + heroes) se obtiene de [SteamGridDB](https://www.steamgriddb.com/),
que necesita una **API key gratuita** (regístrate y crea una key en tu perfil →
_Preferences → API_). El launcher la lee de:

1. La variable de entorno `STEAMGRIDDB_API_KEY`, o
2. La config persistente (`steamGridDbApiKey` en electron-store).

Sin key, la app funciona igual pero muestra un placeholder en vez de las portadas.

- `src/main/artwork/steamGridDB.ts` — resuelve grid + hero (por appId en Steam,
  por búsqueda de nombre en Epic).
- `src/main/artwork/artworkCache.ts` — descarga y cachea las imágenes en
  `userData/artwork-cache`; no re-descarga si ya existen.
- Las imágenes se sirven al renderer con el protocolo custom `handeck-art://`.
