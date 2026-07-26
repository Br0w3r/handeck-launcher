import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolución del binario de legendary.
 *
 * Orden de búsqueda:
 *   1) App empaquetada: resources/bin/legendary(.exe) junto al .exe instalado
 *      (process.resourcesPath).
 *   2) Modo dev / tsx: resources/bin/legendary(.exe) dentro del repo
 *      (process.cwd()), donde lo deja `npm run fetch:legendary`.
 *   3) Fallback: el PATH del sistema.
 *
 * No importa 'electron' a propósito (process.resourcesPath es una propiedad que
 * Electron pone en el objeto global process), para que los módulos de detección
 * sigan siendo ejecutables con tsx (`npm run detect`) fuera de Electron.
 */
export function legendaryBin(): string {
  const binName = process.platform === 'win32' ? 'legendary.exe' : 'legendary'

  // 1) Empaquetado: junto a los recursos de la app instalada.
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (typeof resourcesPath === 'string') {
    const bundled = join(resourcesPath, 'bin', binName)
    if (existsSync(bundled)) return bundled
  }

  // 2) Dev: el binario descargado dentro del repo (resources/bin).
  const local = join(process.cwd(), 'resources', 'bin', binName)
  if (existsSync(local)) return local

  // 3) Confiar en el PATH del sistema.
  return 'legendary'
}
