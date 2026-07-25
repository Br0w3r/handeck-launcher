import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolución del binario de legendary.
 *
 * Orden: 1) si la app está empaquetada y hay un legendary en resources/bin, se
 * usa esa ruta absoluta; 2) si no, se confía en el PATH del sistema.
 *
 * No importa 'electron' a propósito (process.resourcesPath es una propiedad que
 * Electron pone en el objeto global process), para que los módulos de detección
 * sigan siendo ejecutables con tsx (`npm run detect`) fuera de Electron.
 */
export function legendaryBin(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (typeof resourcesPath === 'string') {
    const binName = process.platform === 'win32' ? 'legendary.exe' : 'legendary'
    const bundled = join(resourcesPath, 'bin', binName)
    if (existsSync(bundled)) return bundled
  }
  return 'legendary'
}
