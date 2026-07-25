// Genera resources/icon.ico (256x256, PNG embebido) sin dependencias externas.
// Emblema: cuadrado redondeado oscuro con un triángulo de "play" azul PS.
//   node scripts/gen-icon.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const __dirname = dirname(fileURLToPath(import.meta.url))

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

// ── Rasterizar la imagen RGBA ──
const px = Buffer.alloc(SIZE * SIZE * 4)
const radius = 46
// Triángulo de play.
const ax = 100, ay = 74
const bx = 100, by = 182
const cx = 190, cy = 128
const area = (x1, y1, x2, y2, x3, y3) =>
  (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)
const inTriangle = (x, y) => {
  const d1 = area(x, y, ax, ay, bx, by)
  const d2 = area(x, y, bx, by, cx, cy)
  const d3 = area(x, y, cx, cy, ax, ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}
// Distancia a la esquina redondeada (para recortar el fondo).
const outsideRounded = (x, y) => {
  const rx = Math.min(x, SIZE - 1 - x)
  const ry = Math.min(y, SIZE - 1 - y)
  if (rx < radius && ry < radius) {
    const dx = radius - rx
    const dy = radius - ry
    return dx * dx + dy * dy > radius * radius
  }
  return false
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    if (outsideRounded(x, y)) {
      px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0 // transparente
      continue
    }
    if (inTriangle(x, y)) {
      px[i] = 0x1f // azul PlayStation con leve degradado vertical
      px[i + 1] = lerp(0x9e, 0x70, y / SIZE)
      px[i + 2] = 0xff
      px[i + 3] = 255
    } else {
      const t = y / SIZE // fondo degradado oscuro
      px[i] = lerp(0x18, 0x0a, t)
      px[i + 1] = lerp(0x18, 0x0a, t)
      px[i + 2] = lerp(0x2c, 0x0f, t)
      px[i + 3] = 255
    }
  }
}

// ── Codificar PNG ──
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
// Scanlines con filtro 0 (none).
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

// ── Envolver en ICO (con PNG embebido) ──
const dir = Buffer.alloc(6)
dir.writeUInt16LE(0, 0)
dir.writeUInt16LE(1, 2) // tipo icono
dir.writeUInt16LE(1, 4) // 1 imagen
const entry = Buffer.alloc(16)
entry[0] = 0 // 0 => 256
entry[1] = 0
entry[2] = 0 // paleta
entry[4] = 1 // planos
entry.writeUInt16LE(32, 6) // bpp
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(6 + 16, 12) // offset
const ico = Buffer.concat([dir, entry, png])

const out = join(__dirname, '..', 'resources', 'icon.ico')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, ico)
console.log(`icon.ico generado: ${ico.length} bytes (${SIZE}x${SIZE})`)
