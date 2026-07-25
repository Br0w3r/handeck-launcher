# resources/bin — binarios empaquetados

Aquí va **`legendary.exe`** (Windows) para que se incluya dentro del instalador.
La app lo detecta automáticamente vía `legendaryBin()` en
`process.resourcesPath/bin/legendary.exe`, así que el usuario final **no necesita
instalar legendary por su cuenta**.

## Se descarga automáticamente

No se versiona en el repo (está en `.gitignore`). Se baja en cada build:

```bash
npm run fetch:legendary   # → resources/bin/legendary.exe (v fija en el script)
```

- `npm run dist` ya lo ejecuta antes de empaquetar.
- El CI (`.github/workflows/build.yml`) también lo baja antes de empaquetar.
- Versión fija en `scripts/fetch-legendary.mjs` (`LEGENDARY_VERSION`, o env var).

Releases oficiales: https://github.com/legendary-gl/legendary/releases

> legendary es GPL-3.0: se distribuye como ejecutable separado que la app invoca
> por subproceso (agregación, no enlace). Conviene incluir su licencia/atribución
> en el instalador final.
