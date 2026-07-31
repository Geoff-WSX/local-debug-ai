/**
 * 生成 LocalDebugAI 插件 Logo（纯 Node，无第三方依赖）
 * 设计：蓝色渐变圆角背景 + 白色「LD」字母 + 红色录制圆点
 * 输出：public/icons/icon{16,48,128}.png
 */
import { deflateSync } from 'zlib'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../public/icons')

// ===== 简易 PNG 编码器 =====
function crc32(buf) {
  let c, table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(width, height, rgba) {
  // 每行前加 filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return png
}

// ===== 绘制 =====
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const radius = size * 0.46 // 圆角半径

  // 颜色定义
  const gradientTop = [59, 130, 246]   // #3B82F6 蓝
  const gradientBottom = [37, 99, 235] // #2563EB 深蓝
  const white = [255, 255, 255]
  const red = [239, 68, 68]            // #EF4444 红

  function setPixel(x, y, r, g, b, a = 255) {
    const i = (y * size + x) * 4
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
  }

  // 圆角矩形内判断
  function inRoundRect(x, y) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false
    const dx = Math.max(Math.abs(x + 0.5 - cx) - (cx - radius), 0)
    const dy = Math.max(Math.abs(y + 0.5 - cx) - (cx - radius), 0)
    return dx * dx + dy * dy <= radius * radius
  }

  // 绘制渐变圆角背景
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1)
    const r = Math.round(gradientTop[0] + (gradientBottom[0] - gradientTop[0]) * t)
    const g = Math.round(gradientTop[1] + (gradientBottom[1] - gradientTop[1]) * t)
    const b = Math.round(gradientTop[2] + (gradientBottom[2] - gradientTop[2]) * t)
    for (let x = 0; x < size; x++) {
      if (inRoundRect(x, y)) {
        setPixel(x, y, r, g, b)
      }
    }
  }

  // 抗锯齿边缘（简单 2x 采样）
  // 用更大的画布绘制再缩放到目标尺寸，这里改为直接绘制「LD」矢量

  // 绘制字母 L（粗体矩形）
  const LThick = Math.max(2, Math.round(size * 0.12))
  const lX = Math.round(size * 0.20)
  const lTop = Math.round(size * 0.22)
  const lBottom = Math.round(size * 0.60)
  const lWidth = Math.round(size * 0.26)
  // L 竖线
  fillRect(lX, lTop, lWidth, lBottom - lTop, white)
  // L 横线
  fillRect(lX, lBottom - lWidth, lWidth + Math.round(size * 0.12), lWidth, white)

  // 绘制字母 D（粗体圆弧 + 竖线）
  const dX = Math.round(size * 0.50)
  const dTop = lTop
  const dBottom = lBottom
  const dWidth = Math.round(size * 0.30)
  // D 竖线
  fillRect(dX, dTop, lWidth, dBottom - dTop, white)
  // D 圆弧（用圆环近似）
  const arcCX = dX + dWidth - lWidth / 2
  const arcCY = (dTop + dBottom) / 2
  const arcRx = dWidth - lWidth / 2
  const arcRy = (dBottom - dTop) / 2 - lWidth / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < dX + lWidth) continue // 竖线已画
      // 椭圆到中心的归一化距离
      const nx = (x + 0.5 - arcCX) / arcRx
      const ny = (y + 0.5 - arcCY) / arcRy
      const dist = Math.sqrt(nx * nx + ny * ny)
      if (dist >= 0.88 && dist <= 1.12) {
        // 只保留右侧圆弧部分
        if (x + 0.5 >= arcCX) {
          setPixel(x, y, ...white)
        }
      }
    }
  }

  // 红色录制圆点（右下角）
  const dotR = Math.max(2, Math.round(size * 0.09))
  const dotX = Math.round(size * 0.82)
  const dotY = Math.round(size * 0.80)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - dotX
      const dy = y + 0.5 - dotY
      if (dx * dx + dy * dy <= dotR * dotR) {
        setPixel(x, y, ...red)
      }
    }
  }

  function fillRect(x0, y0, w, h, color) {
    for (let y = y0; y < y0 + h && y < size; y++) {
      for (let x = x0; x < x0 + w && x < size; x++) {
        if (x >= 0 && y >= 0) setPixel(x, y, ...color)
      }
    }
  }

  return encodePNG(size, size, px)
}

// 生成三种尺寸
mkdirSync(OUT_DIR, { recursive: true })
for (const size of [16, 48, 128]) {
  const png = drawIcon(size)
  const file = resolve(OUT_DIR, `icon${size}.png`)
  writeFileSync(file, png)
  console.log(`✓ 已生成 ${file} (${png.length} bytes)`)
}
