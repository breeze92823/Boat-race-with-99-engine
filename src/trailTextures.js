import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32 } from './textures.js'

// Canvas painters for the patterned trails (TRAILS looks in config.js). Each
// paints into (ctx, w, h, rand, strip): strip = the ribbon texture (256x64, u
// along the trail, tiles left-right, so shapes that cross an edge are drawn
// again on the other side), otherwise the square picture on the card and the
// info swatch. Painted once and cached; the ribbon tints `soft` with the
// trail's colour for the plain ones.
const STRIP_W = 256
const STRIP_H = 64
const SWATCH = 128
const TAU = Math.PI * 2

// fn(dx) at the three horizontal offsets that make a strip tile.
const wrap = (w, fn) => [-w, 0, w].forEach(fn)

function fill(ctx, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
}

// A soft round spot: `inner` (an rgba() colour) fading to the same colour at zero alpha
// (fading to transparent black would leave dark halos).
function blob(ctx, x, y, r, inner, outer = inner.replace(/,[^,]*\)$/, ',0)')) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

function hexPath(ctx, x, y, r) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

function note(ctx, x, y, s, color, kind) {
  ctx.fillStyle = ctx.strokeStyle = color
  ctx.lineWidth = s * 0.14
  ctx.lineCap = 'round'
  if (kind === 'clef') {
    // A treble-clef-ish swirl: a tall S with a loop.
    ctx.lineWidth = s * 0.16
    ctx.beginPath()
    ctx.moveTo(x + s * 0.05, y + s * 0.55)
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.5, x - s * 0.35, y - s * 0.05, x + s * 0.1, y - s * 0.02)
    ctx.bezierCurveTo(x + s * 0.5, y + s * 0.05, x + s * 0.35, y + s * 0.4, x, y + s * 0.3)
    ctx.moveTo(x + s * 0.05, y + s * 0.55)
    ctx.bezierCurveTo(x + s * 0.2, y - s * 0.2, x + s * 0.3, y - s * 0.6, x + s * 0.05, y - s * 0.62)
    ctx.bezierCurveTo(x - s * 0.15, y - s * 0.6, x - s * 0.1, y - s * 0.2, x + s * 0.12, y + s * 0.75)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x - s * 0.02, y + s * 0.8, s * 0.09, 0, TAU)
    ctx.fill()
    return
  }
  const head = (hx, hy) => {
    ctx.beginPath()
    ctx.ellipse(hx, hy, s * 0.17, s * 0.12, -0.4, 0, TAU)
    ctx.fill()
  }
  const stem = (hx, hy) => {
    ctx.beginPath()
    ctx.moveTo(hx + s * 0.15, hy)
    ctx.lineTo(hx + s * 0.15, hy - s * 0.6)
    ctx.stroke()
  }
  if (kind === 'pair') {
    head(x - s * 0.2, y + s * 0.25)
    head(x + s * 0.25, y + s * 0.15)
    stem(x - s * 0.2, y + s * 0.25)
    stem(x + s * 0.25, y + s * 0.15)
    ctx.lineWidth = s * 0.16
    ctx.beginPath()
    ctx.moveTo(x - s * 0.05, y - s * 0.35)
    ctx.lineTo(x + s * 0.4, y - s * 0.45)
    ctx.stroke()
    return
  }
  head(x, y + s * 0.25)
  stem(x, y + s * 0.25)
  ctx.beginPath()
  ctx.moveTo(x + s * 0.15, y - s * 0.35)
  ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.15, x + s * 0.35, y + s * 0.05)
  ctx.stroke()
}

function bone(ctx, x, y, len, a, r) {
  const dx = Math.cos(a) * len * 0.5
  const dy = Math.sin(a) * len * 0.5
  ctx.lineWidth = r * 1.1
  ctx.beginPath()
  ctx.moveTo(x - dx, y - dy)
  ctx.lineTo(x + dx, y + dy)
  ctx.stroke()
  for (const k of [-1, 1]) {
    const nx = Math.cos(a + Math.PI / 2) * r * 0.55
    const ny = Math.sin(a + Math.PI / 2) * r * 0.55
    for (const sgn of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + k * dx + sgn * nx, y + k * dy + sgn * ny, r * 0.62, 0, TAU)
      ctx.fill()
    }
  }
}

const PAINTERS = {
  // Plain trails: a white band with soft edges, tinted by the trail colour.
  soft(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.22, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.5, '#fff')
    g.addColorStop(0.78, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  },
  // Ghost: thin white wisps streaming back.
  wisps(ctx, w, h, rand) {
    ctx.strokeStyle = '#fff'
    ctx.shadowColor = '#e8f0ff'
    ctx.shadowBlur = 6
    ctx.lineCap = 'round'
    for (let i = 0; i < 9; i++) {
      const x = rand() * w
      const y = h * (0.25 + rand() * 0.5)
      const len = w * (0.12 + rand() * 0.28)
      const bend = (rand() - 0.5) * h * 0.25
      ctx.lineWidth = 1.5 + rand() * 3
      ctx.globalAlpha = 0.55 + rand() * 0.45
      wrap(w, (dx) => {
        ctx.beginPath()
        ctx.moveTo(x + dx, y)
        ctx.quadraticCurveTo(x + dx + len / 2, y + bend, x + dx + len, y)
        ctx.stroke()
      })
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  },
  magma(ctx, w, h, rand) {
    fill(ctx, w, h, '#ff8a12')
    const r = Math.min(w, h)
    // Bright molten pools, then dark cooled crust drifting on top (like the reference).
    for (let i = 0; i < (w * h) / 120; i++) {
      const x = rand() * w
      const y = rand() * h
      const s = r * (0.1 + rand() * 0.3)
      const hot = rand() < 0.55
      wrap(w, (dx) => blob(ctx, x + dx, y, s, hot ? 'rgba(255,236,90,0.95)' : 'rgba(255,90,0,0.9)'))
    }
    for (let i = 0; i < (w * h) / 420; i++) {
      const x = rand() * w
      const y = rand() * h
      const s = r * (0.06 + rand() * 0.16)
      wrap(w, (dx) => blob(ctx, x + dx, y, s, 'rgba(70,24,8,0.95)', 'rgba(120,40,8,0)'))
    }
  },
  // Sound Wave: a twisted pink beam with a white-hot core.
  soundwave(ctx, w, h) {
    const mid = h / 2
    const amp = h * 0.3
    const wave = (sign, k) => {
      ctx.beginPath()
      for (let x = 0; x <= w; x += 2) ctx.lineTo(x, mid + sign * amp * k * Math.sin((x / w) * TAU * 3))
    }
    ctx.shadowColor = '#ff4fd8'
    ctx.shadowBlur = 10
    ctx.fillStyle = 'rgba(255,90,210,0.45)'
    ctx.beginPath()
    for (let x = 0; x <= w; x += 2) ctx.lineTo(x, mid + amp * Math.sin((x / w) * TAU * 3))
    for (let x = w; x >= 0; x -= 2) ctx.lineTo(x, mid - amp * Math.sin((x / w) * TAU * 3))
    ctx.fill()
    ctx.strokeStyle = '#ff7ae6'
    ctx.lineWidth = 3
    wave(1, 1)
    ctx.stroke()
    wave(-1, 1)
    ctx.stroke()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 4
    wave(1, 0.25)
    ctx.stroke()
    ctx.shadowBlur = 0
  },
  // Musical Note: a stave of colourful notes.
  notes(ctx, w, h, rand) {
    const colors = ['#ffe23a', '#ff4a4a', '#7dff6a', '#fff27a', '#5fd0ff', '#ff4a4a']
    const kinds = ['eighth', 'clef', 'eighth', 'pair', 'eighth', 'clef']
    const step = w / kinds.length
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 2
    kinds.forEach((kind, i) => {
      const s = h * (kind === 'clef' ? 0.5 : 0.55)
      note(ctx, step * (i + 0.5) + (rand() - 0.5) * step * 0.3, h * 0.5, s, colors[i], kind)
    })
    ctx.shadowBlur = 0
  },
  circuit(ctx, w, h, rand) {
    fill(ctx, w, h, '#16331d')
    ctx.strokeStyle = '#cfeec4'
    ctx.fillStyle = '#cfeec4'
    ctx.lineWidth = Math.max(1.5, h / 30)
    const g = Math.max(8, Math.round(h / 6))
    for (let i = 0; i < (w * h) / 900; i++) {
      let x = Math.round((rand() * w) / g) * g
      let y = Math.round((rand() * h) / g) * g
      const pts = [[x, y]]
      for (let k = 0; k < 3; k++) {
        const dir = Math.floor(rand() * 4)
        const d = g * (1 + Math.floor(rand() * 3))
        x += dir === 0 ? d : dir === 1 ? -d : dir === 2 ? d * 0.7 : 0
        y += dir === 2 ? d * 0.7 : dir === 3 ? d : 0
        pts.push([x, y])
      }
      wrap(w, (dx) => {
        ctx.beginPath()
        pts.forEach(([px, py]) => ctx.lineTo(px + dx, py))
        ctx.stroke()
        for (const [px, py] of [pts[0], pts[pts.length - 1]]) {
          ctx.beginPath()
          ctx.arc(px + dx, py, ctx.lineWidth * 1.6, 0, TAU)
          ctx.fill()
        }
      })
    }
  },
  rainbow(ctx, w, h, rand, strip) {
    const colors = ['#e8262b', '#ff8a1a', '#ffe23a', '#3fbf3f', '#2f5fff', '#7a2cff']
    const n = colors.length
    colors.forEach((c, i) => {
      ctx.fillStyle = c
      if (strip) ctx.fillRect(0, (i / n) * h, w, h / n + 1)
      else ctx.fillRect((i / n) * w, 0, w / n + 1, h)
    })
    // Brushed streaks along the bands.
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let i = 0; i < 40; i++) {
      if (strip) ctx.fillRect(rand() * w, rand() * h, w * 0.2, 1)
      else ctx.fillRect(rand() * w, rand() * h, 1, h * 0.2)
    }
  },
  orbit(ctx, w, h) {
    fill(ctx, w, h, '#bfc2c9')
    const n = Math.max(1, Math.round(w / h))
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) / n) * w
      const cy = h / 2
      const s = Math.min(w / n, h)
      ctx.strokeStyle = '#3a7bff'
      ctx.lineWidth = s * 0.05
      ctx.beginPath()
      ctx.ellipse(cx, cy, s * 0.4, s * 0.1, 0, 0, TAU)
      ctx.stroke()
      ctx.strokeStyle = '#7a3cff'
      ctx.lineWidth = s * 0.045
      ctx.beginPath()
      ctx.moveTo(cx, cy - s * 0.45)
      ctx.lineTo(cx, cy + s * 0.45)
      ctx.stroke()
      ctx.fillStyle = '#7a3cff'
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.07, 0, TAU)
      ctx.fill()
    }
  },
  carpet(ctx, w, h) {
    fill(ctx, w, h, '#7d1616')
    ctx.strokeStyle = '#e0b04a'
    ctx.fillStyle = '#e0b04a'
    const s = Math.min(h, w)
    ctx.lineWidth = s * 0.03
    for (const y of [s * 0.08, h - s * 0.08]) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    const n = Math.max(1, Math.round(w / (s * 0.7)))
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) / n) * w
      const cy = h / 2
      const r = s * 0.3
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r * 0.8, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r * 0.8, cy)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.32, 0, TAU)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.1, 0, TAU)
      ctx.fill()
      for (const k of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(cx + (k * w) / n / 2, cy, r * 0.12, 0, TAU)
        ctx.fill()
      }
    }
  },
  matrix(ctx, w, h, rand) {
    fill(ctx, w, h, '#020a04')
    const size = Math.max(8, Math.round(Math.min(w, h) / 6))
    ctx.font = `bold ${size}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const chars = '01ABCDEFXZ7<>=*'
    for (let x = size / 2; x < w; x += size * 0.8) {
      const head = rand() * h
      for (let y = 0; y < h; y += size) {
        const k = 1 - (((head - y) / h + 1) % 1)
        ctx.fillStyle = `rgba(${k > 0.92 ? '200,255,210' : '43,255,90'},${0.25 + 0.75 * k})`
        ctx.fillText(chars[Math.floor(rand() * chars.length)], x, y)
      }
    }
  },
  paws(ctx, w, h, rand) {
    fill(ctx, w, h, '#231a29')
    ctx.fillStyle = '#b48ad6'
    const s = Math.min(w, h) * 0.32
    const n = Math.max(2, Math.round((w / h) * 2))
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w
      const y = h * (i % 2 ? 0.35 : 0.65)
      const a = (rand() - 0.5) * 0.8 + Math.PI / 2
      wrap(w, (dx) => {
        ctx.save()
        ctx.translate(x + dx, y)
        ctx.rotate(a)
        ctx.beginPath()
        ctx.ellipse(0, s * 0.15, s * 0.42, s * 0.34, 0, 0, TAU)
        ctx.fill()
        for (const [tx, ty] of [[-0.42, -0.32], [-0.15, -0.55], [0.15, -0.55], [0.42, -0.32]]) {
          ctx.beginPath()
          ctx.ellipse(tx * s, ty * s, s * 0.14, s * 0.18, 0, 0, TAU)
          ctx.fill()
        }
        ctx.restore()
      })
    }
  },
  runes(ctx, w, h, rand) {
    fill(ctx, w, h, '#a29e98')
    ctx.strokeStyle = '#7a4a20'
    ctx.lineCap = 'round'
    const c = Math.max(10, Math.round(Math.min(w, h) / 4))
    ctx.lineWidth = c * 0.12
    for (let y = c * 0.15; y < h - c * 0.5; y += c) {
      for (let x = c * 0.15; x < w - c * 0.5; x += c * 0.8) {
        ctx.beginPath()
        for (let k = 0; k < 3; k++) {
          const ax = x + rand() * c * 0.6
          const ay = y + rand() * c * 0.7
          if (rand() < 0.35) ctx.arc(ax, ay, c * 0.14, 0, TAU)
          else {
            ctx.moveTo(ax, ay)
            ctx.lineTo(x + rand() * c * 0.6, y + rand() * c * 0.7)
          }
        }
        ctx.stroke()
      }
    }
  },
  abyss(ctx, w, h, rand) {
    fill(ctx, w, h, '#0a2630')
    for (let i = 0; i < w * h * 0.35; i++) {
      ctx.fillStyle = rand() < 0.8 ? `rgba(47,138,154,${0.3 + rand() * 0.5})` : `rgba(110,210,225,${0.4 + rand() * 0.5})`
      ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1 + Math.floor(rand() * 2), 1)
    }
  },
  film(ctx, w, h, rand, strip) {
    fill(ctx, w, h, '#2b2b30')
    const r = Math.min(w, h)
    for (let i = 0; i < 18; i++) {
      const x = rand() * w
      const y = h * (0.3 + rand() * 0.4)
      wrap(w, (dx) => blob(ctx, x + dx, y, r * (0.15 + rand() * 0.25), 'rgba(235,235,240,0.55)'))
    }
    // Sprocket rows along the long edges (left/right on the square picture).
    const band = r * 0.16
    const hole = band * 0.5
    ctx.fillStyle = '#111'
    if (strip) {
      ctx.fillRect(0, 0, w, band)
      ctx.fillRect(0, h - band, w, band)
    } else {
      ctx.fillRect(0, 0, band, h)
      ctx.fillRect(w - band, 0, band, h)
    }
    ctx.fillStyle = '#e8e8ec'
    const len = strip ? w : h
    for (let t = hole * 0.5; t < len; t += hole * 2) {
      if (strip) {
        ctx.fillRect(t, (band - hole) / 2, hole, hole)
        ctx.fillRect(t, h - band + (band - hole) / 2, hole, hole)
      } else {
        ctx.fillRect((band - hole) / 2, t, hole, hole)
        ctx.fillRect(w - band + (band - hole) / 2, t, hole, hole)
      }
    }
  },
  honeycomb(ctx, w, h) {
    fill(ctx, w, h, '#1f5cc4')
    const per = Math.max(2, Math.round(w / 32))
    const r = w / (per * Math.sqrt(3))
    ctx.strokeStyle = '#e8c21a'
    ctx.lineWidth = r * 0.18
    for (let row = -1; row * r * 1.5 < h + r; row++) {
      for (let col = -1; col <= per; col++) {
        const x = col * r * Math.sqrt(3) + (row % 2 ? (r * Math.sqrt(3)) / 2 : 0)
        hexPath(ctx, x, row * r * 1.5, r * 0.82)
        ctx.stroke()
      }
    }
  },
  skeleton(ctx, w, h, rand) {
    fill(ctx, w, h, '#2a1416')
    ctx.strokeStyle = ctx.fillStyle = '#d8262b'
    ctx.lineCap = 'round'
    const s = Math.min(w, h)
    const n = Math.max(2, Math.round(w / (s * 0.6)))
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w
      const y = h * (0.35 + rand() * 0.3)
      const a = rand() * Math.PI
      wrap(w, (dx) => {
        bone(ctx, x + dx, y, s * 0.55, a, s * 0.06)
        // A bony hand: four finger bones fanning from a palm.
        for (let f = -1.5; f <= 1.5; f++) bone(ctx, x + dx + Math.cos(a + 0.3 * f) * s * 0.42, y + Math.sin(a + 0.3 * f) * s * 0.42, s * 0.2, a + 0.3 * f, s * 0.035)
      })
    }
  },
  bubbles(ctx, w, h, rand) {
    fill(ctx, w, h, '#5c1caa')
    const s = Math.min(w, h)
    for (let i = 0; i < (w * h) / 500; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = s * (0.05 + rand() * 0.14)
      wrap(w, (dx) => {
        ctx.strokeStyle = 'rgba(200,150,255,0.9)'
        ctx.lineWidth = Math.max(1, r * 0.14)
        ctx.beginPath()
        ctx.arc(x + dx, y, r, 0, TAU)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.beginPath()
        ctx.arc(x + dx - r * 0.35, y - r * 0.35, r * 0.2, 0, TAU)
        ctx.fill()
      })
    }
  },
  toxic(ctx, w, h, rand) {
    fill(ctx, w, h, '#4a1a8c')
    const s = Math.min(w, h)
    for (const color of ['#1ab8a0', '#6ad42a', '#2a8ad8']) {
      for (let c = 0; c < Math.max(2, w / 60); c++) {
        const cx = rand() * w
        const cy = rand() * h
        ctx.fillStyle = color
        for (let i = 0; i < 26; i++) {
          const a = rand() * TAU
          const d = rand() ** 1.5 * s * 0.4
          const r = s * (0.02 + rand() * 0.07)
          wrap(w, (dx) => {
            ctx.beginPath()
            ctx.arc(cx + dx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, TAU)
            ctx.fill()
          })
        }
      }
    }
  },
  // Water Ripple: light caustic lines on bright water (tiles in x by using whole periods).
  ripple(ctx, w, h) {
    const img = ctx.createImageData(w, h)
    const kx = TAU / w
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fy = (y / Math.min(w, h)) * TAU
        const n1 = Math.sin(x * kx * 2 + 1.4 * Math.sin(fy * 0.8 + Math.sin(x * kx)))
        const n2 = Math.sin(fy * 1.1 + 1.6 * Math.sin(x * kx * 2 + 0.7))
        const line = Math.max(1 - Math.abs(n1) / 0.4, 1 - Math.abs(n2) / 0.32, 0)
        const k = Math.min(1, line * 1.3)
        const i = (y * w + x) * 4
        img.data[i] = 70 + 185 * k
        img.data[i + 1] = 185 + 70 * k
        img.data[i + 2] = 240 + 15 * k
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  },
}

function paint(name, w, h, strip) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  PAINTERS[name](canvas.getContext('2d'), w, h, mulberry32(name.length * 97 + name.charCodeAt(0)), strip)
  return canvas
}

const textures = new Map()
const swatches = new Map()

// The ribbon texture for a painter name (repeats along the trail).
export function trailTexture(name) {
  if (!textures.has(name)) {
    const t = new CanvasTexture(paint(name, STRIP_W, STRIP_H, true))
    t.colorSpace = SRGBColorSpace
    t.wrapS = RepeatWrapping
    textures.set(name, t)
  }
  return textures.get(name)
}

// A square picture of the pattern (data URL) for the card + info swatch.
export function trailSwatch(name) {
  if (!swatches.has(name)) swatches.set(name, paint(name, SWATCH, SWATCH, false).toDataURL())
  return swatches.get(name)
}
