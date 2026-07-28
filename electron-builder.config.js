/**
 * Configuración de electron-builder — genera el instalador NSIS (.exe).
 *
 * legendary: si colocas `resources/bin/legendary.exe`, se empaqueta dentro de la
 * app (en process.resourcesPath/bin) y `legendaryBin()` lo usa automáticamente.
 * Si no, la app confía en que legendary esté en el PATH del sistema.
 */
module.exports = {
  appId: 'com.handeck.launcher',
  productName: 'HanDeck Launcher',
  copyright: 'Copyright © 2026 HanDeck',
  // Dónde publica electron-builder y desde dónde electron-updater busca updates.
  // (Genera latest.yml para el auto-update. Para repos privados, la descarga en
  // el equipo del usuario requiere que las Releases sean públicas.)
  publish: [
    {
      provider: 'github',
      owner: 'Br0w3r',
      repo: 'handeck-launcher',
      // Publicar el Release directamente (no como borrador) para que
      // electron-updater lo detecte sin pasos manuales.
      releaseType: 'release'
    }
  ],
  directories: {
    output: 'dist',
    buildResources: 'resources'
  },
  // Sólo patrones de EXCLUSIÓN: así electron-builder mantiene su inclusión por
  // defecto (out/, package.json y las dependencies de producción de node_modules)
  // y sólo quita lo que no debe ir en la app.
  files: [
    '!**/*.map',
    '!src/**',
    '!scripts/**',
    '!.github/**',
    '!**/{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
    '!**/{electron.vite.config.ts,vite.dev.config.mts}',
    '!**/{.gitignore,README.md,LAUNCHER_CONTEXT.md}'
  ],
  // legendary.exe (u otros binarios) van a resources/bin dentro de la app.
  extraResources: [
    {
      from: 'resources/bin',
      to: 'bin',
      filter: ['**/*']
    }
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.ico',
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    // NOTA: es_MX (lang 2058) tiene la tabla MUI de NSIS incompleta y rompe el
    // build ("MUI_TEXT_INSTALLING_TITLE is not set"). Usamos es_ES (español,
    // totalmente soportado) — la diferencia de texto para MX es mínima.
    installerLanguages: ['es_ES', 'en_US'],
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'HanDeck Launcher'
  }
}
