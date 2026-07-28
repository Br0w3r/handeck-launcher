import { useMemo, useRef } from 'react'

import { useEpicAuth } from '../../hooks/useEpicAuth'
import { useGamepad } from '../../hooks/useGamepad'
import { useSettings } from '../../hooks/useSettings'
import { faceSymbol } from '../ControlHints/ControlHints'
import './SettingsPanel.css'

/**
 * Pantalla de Ajustes navegable con control.
 *
 * Se abre con Y / clic en el engranaje y se cierra con B / Escape. Arriba-abajo
 * mueve entre filas; A activa la fila enfocada. Secciones:
 *   • Cuenta Epic  — login interactivo (captura el código solo) o importar del
 *                    Epic Launcher; cerrar sesión.
 *   • Artwork      — API key opcional de SteamGridDB.
 *   • Lanzamiento  — verificar integridad / buscar actualizaciones al lanzar.
 */

interface SettingsPanelProps {
  onClose: () => void
}

/** Descriptor de una fila navegable con control. */
interface Row {
  key: string
  activate: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const epic = useEpicAuth()
  const { settings, update } = useSettings()

  const apiKeyRef = useRef<HTMLInputElement>(null)

  const authed = epic.status?.authenticated ?? false

  // Filas navegables (en el mismo orden en que se renderizan más abajo).
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = []
    // Mientras el estado carga (null) no exponemos fila de Epic, para no
    // mostrar por error el botón de iniciar sesión estando ya conectado.
    if (epic.status !== null) {
      if (authed) {
        list.push({ key: 'logout', activate: () => void epic.logout() })
      } else {
        list.push({ key: 'login', activate: () => void epic.login() })
      }
    }
    list.push({ key: 'apikey', activate: () => apiKeyRef.current?.focus() })
    list.push({
      key: 'verify',
      activate: () => void update({ verifyOnLaunch: !(settings?.verifyOnLaunch ?? true) })
    })
    list.push({
      key: 'updates',
      activate: () =>
        void update({ checkUpdatesOnLaunch: !(settings?.checkUpdatesOnLaunch ?? true) })
    })
    list.push({
      key: 'startup',
      activate: () => void update({ launchOnStartup: !(settings?.launchOnStartup ?? false) })
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, settings, epic])

  const { selectedIndex, layout } = useGamepad({
    itemCount: rows.length,
    onConfirm: (i) => rows[i]?.activate(),
    onBack: onClose,
    enabled: true
  })

  const selectedKey = rows[selectedIndex]?.key
  const rowClass = (key: string): string =>
    `settings__row${selectedKey === key ? ' settings__row--selected' : ''}`

  const account = epic.status?.account

  return (
    <div className="settings">
      <div className="settings__panel">
        <header className="settings__header">
          <h1 className="settings__title">Ajustes</h1>
          <button className="settings__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        {/* ── Cuenta Epic ──────────────────────────────────────────────── */}
        <section className="settings__section">
          <h2 className="settings__section-title">Cuenta Epic</h2>
          <p className="settings__status">
            {epic.status === null
              ? 'Comprobando…'
              : !epic.status.installed
                ? '⚠️ legendary no disponible'
                : epic.busy
                  ? 'Conectando…'
                  : authed
                    ? `✔ Conectado como ${account ?? 'cuenta de Epic'}`
                    : '○ Sin conectar'}
          </p>

          {epic.status === null ? null : authed ? (
            <button
              className={rowClass('logout')}
              onClick={() => void epic.logout()}
              disabled={epic.busy}
            >
              <span>Cerrar sesión de Epic</span>
            </button>
          ) : (
            <button
              className={rowClass('login')}
              onClick={() => void epic.login()}
              disabled={epic.busy}
            >
              <span>Iniciar sesión con Epic</span>
              <span className="settings__hint">Se conecta solo, sin copiar códigos</span>
            </button>
          )}

          {epic.result && (
            <p
              className={`settings__feedback settings__feedback--${
                epic.result.ok ? 'ok' : 'err'
              }`}
            >
              {epic.result.message}
            </p>
          )}
        </section>

        {/* ── Artwork ──────────────────────────────────────────────────── */}
        <section className="settings__section">
          <h2 className="settings__section-title">Artwork (SteamGridDB)</h2>
          <div className={rowClass('apikey')}>
            <input
              ref={apiKeyRef}
              className="settings__input"
              type="text"
              placeholder="API key propia (opcional — se usa una por defecto)"
              defaultValue={settings?.steamGridDbApiKey ?? ''}
              onBlur={(e) => void update({ steamGridDbApiKey: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
          </div>
          <p className="settings__hint">
            Déjalo vacío para usar la key incluida en el launcher.
          </p>
        </section>

        {/* ── Lanzamiento ──────────────────────────────────────────────── */}
        <section className="settings__section">
          <h2 className="settings__section-title">Al lanzar un juego</h2>
          <button
            className={rowClass('verify')}
            onClick={() => void update({ verifyOnLaunch: !(settings?.verifyOnLaunch ?? true) })}
          >
            <span>Verificar integridad de archivos</span>
            <span className="settings__toggle">
              {settings?.verifyOnLaunch ? 'Sí' : 'No'}
            </span>
          </button>
          <button
            className={rowClass('updates')}
            onClick={() =>
              void update({ checkUpdatesOnLaunch: !(settings?.checkUpdatesOnLaunch ?? true) })
            }
          >
            <span>Buscar actualizaciones</span>
            <span className="settings__toggle">
              {settings?.checkUpdatesOnLaunch ? 'Sí' : 'No'}
            </span>
          </button>
        </section>

        {/* ── Sistema ──────────────────────────────────────────────────── */}
        <section className="settings__section">
          <h2 className="settings__section-title">Sistema</h2>
          <button
            className={rowClass('startup')}
            onClick={() =>
              void update({ launchOnStartup: !(settings?.launchOnStartup ?? false) })
            }
          >
            <span>Abrir HanDeck al iniciar Windows</span>
            <span className="settings__toggle">
              {settings?.launchOnStartup ? 'Sí' : 'No'}
            </span>
          </button>
          <p className="settings__hint">
            Se abre solo al encender el equipo, junto a MSI Center M (que activa tu
            mando en modo gamepad — no lo desactives, HanDeck lo necesita).
          </p>
        </section>

        <footer className="settings__footer">
          <span>↕ Navegar</span>
          <span>{faceSymbol(layout, 'confirm')} Seleccionar</span>
          <span>{faceSymbol(layout, 'back')} Cerrar</span>
        </footer>
      </div>
    </div>
  )
}
