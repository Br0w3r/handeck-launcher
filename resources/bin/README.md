# resources/bin — binarios empaquetados

Coloca aquí **`legendary.exe`** (Windows) para que se incluya dentro del
instalador. La app lo detecta automáticamente vía `legendaryBin()` en
`process.resourcesPath/bin/legendary.exe`.

Descarga el `.exe` desde las releases oficiales:
https://github.com/derrod/legendary/releases

Si NO lo pones aquí, la app usará el `legendary` que esté en el PATH del sistema.
En ese caso, el usuario debe instalarlo (`pip install legendary-gl`) y autenticar
Epic la primera vez con `legendary auth`.

> Este README es sólo documentación; el `.exe` no se versiona en el repo.
