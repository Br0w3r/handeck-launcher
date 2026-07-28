import type { UseAppUpdateResult } from '../../hooks/useAppUpdate'
import './UpdateBanner.css'

/**
 * Banner de auto-actualización del launcher (arriba, centrado). Aparece cuando
 * hay una versión nueva y guía: Descargar → progreso → Reiniciar e instalar.
 */
export function UpdateBanner({ update }: { update: UseAppUpdateResult }): JSX.Element | null {
  if (update.phase === 'idle') return null

  return (
    <div className="update-banner">
      {update.phase === 'available' && (
        <>
          <span className="update-banner__text">
            ⬆️ Actualización {update.version ? `v${update.version}` : ''} disponible
          </span>
          <button className="update-banner__btn" onClick={update.download}>
            Descargar
          </button>
          <button className="update-banner__btn update-banner__btn--ghost" onClick={update.dismiss}>
            Después
          </button>
        </>
      )}

      {update.phase === 'downloading' && (
        <>
          <span className="update-banner__text">Descargando actualización…</span>
          <div className="update-banner__progress">
            <div
              className="update-banner__progress-fill"
              style={{ width: `${update.percent}%` }}
            />
          </div>
          <span className="update-banner__percent">{update.percent}%</span>
        </>
      )}

      {update.phase === 'downloaded' && (
        <>
          <span className="update-banner__text">
            ✅ Actualización {update.version ? `v${update.version}` : ''} lista
          </span>
          <button className="update-banner__btn" onClick={update.install}>
            Reiniciar e instalar
          </button>
        </>
      )}
    </div>
  )
}
