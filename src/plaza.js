import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { PLAZA } from './config.js'
import { short } from './interact.js'
import { createEmitter } from './particles.js'
import { paintFade, paintFlag, paintLaneWater, paintText, paintWaterfall } from './textures.js'
import { buildCliff, buildPalm, fontReady, glow, label, neon, put, solidBox, solidPole, std } from './propkit.js'

// The training plaza at the back of the beach (+Z), laid out like the
// reference's south view from the spawn:
//  - two Train stations: a slate platform with yellow trim, six treadmill
//    lanes (glowing scrolling water, neon rails, SPEED boards with lock /
//    requirement tags) leaning toward the middle, a dark and a yellow
//    leaderboard behind them (Rebirth / Wins, Power / Playtime: the server's top
//    saved players, see setLeaderboard) and a big "Train" sign
//  - the VIP "City" portal on a dais in the middle,
//    under a glowing waterfall with light rays, mist and spray
//  - left (+X): the Golden Machine and the Index kiosk; right (-X): Forest
//    Relics and a treasure chest (the green boat further right is in the
//    west Boats stall, shops.js)
//  - red feather flags, and grass-capped rock cliffs with palms ringing it all
//  - particles (particles.js): waterfall mist + falling spray, sparkles around
//    the falls and portal, bubbles off every lane, golden motes at the VIP gate
// Glowing parts are HDR-bright (neon rails, waterfall, VIP gate) so the bloom
// pass makes them shine; without bloom they still read as saturated colour.
// Platforms and lanes are low enough to drive onto; everything else is solid.
const P = PLAZA

function canvasTexture(c, repeatX = 1, repeatY = 1) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 4
  return t
}

// A flat sign face with text on it (canvas sized to the text; '\n' for lines).
function textFace(text, color, bg, colors = null) {
  const t = paintText(text, { color, colors, bg, outline: null, font: '700 72px Fredoka, "Segoe UI Emoji", sans-serif', pad: 18 })
  return canvasTexture(t.canvas)
}

// Turn a prop so its front (+Z) faces a point on the ground.
const face = (obj, tx, tz) => (obj.rotation.y = Math.atan2(tx - obj.position.x, tz - obj.position.z))

// --- Waterfall, pool and VIP portal ------------------------------------------------------
function buildWaterfall(root, animated) {
  const W = P.waterfall
  const tex = canvasTexture(paintWaterfall(), 1.5, (W.height / W.width) * 0.6)
  const sheetMat = new MeshBasicMaterial({ map: tex, color: new Color('#ffffff').multiplyScalar(1.3), transparent: true, opacity: 0.95, side: DoubleSide })
  const sheet = put(root, new PlaneGeometry(W.width, W.height, 1, 1), sheetMat, W.x, W.height / 2, W.z, false)
  sheet.rotation.y = Math.PI // face the plaza (-Z)
  // A soft cyan halo behind the sheet, wider than it.
  const halo = put(root, new PlaneGeometry(W.width + 7, W.height + 2), glow('#38c8ff', 0.28), W.x, W.height / 2, W.z + 0.3, false)
  halo.rotation.y = Math.PI
  // White water at the lip and churning foam at the foot.
  put(root, new BoxGeometry(W.width + 0.6, 0.7, 1.2), neon('#e8fbff', 1.4), W.x, W.height - 0.2, W.z + 0.3, false)
  const foamMat = std('#ffffff', { emissive: '#d8f6ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.85 })
  const foam = []
  for (let i = 0; i < 7; i++) {
    const r = 1.2 + (i % 3) * 0.45
    foam.push(put(root, new SphereGeometry(r, 12, 8), foamMat, W.x - W.width / 2 + 0.8 + (i / 6) * (W.width - 1.6), 0.3, W.z - 1.2, false))
  }
  // Light rays fanning up from the foot of the falls.
  const fade = new CanvasTexture(paintFade('#bff0ff'))
  fade.colorSpace = SRGBColorSpace
  const rays = []
  for (let i = 0; i < 5; i++) {
    const mat = new MeshBasicMaterial({ map: fade, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
    const ray = put(root, new PlaneGeometry(2.2 + (i % 2) * 1.4, 14), mat, W.x - W.width / 2 + (i / 4) * W.width, 7, W.z - 2.2, false)
    ray.rotation.set(0, Math.PI, (i - 2) * 0.12)
    rays.push(ray)
  }
  // Pool in front of it.
  const pool = put(root, new CircleGeometry(8, 40), std('#2fb8ff', { emissive: '#1a8cff', emissiveIntensity: 0.8, roughness: 0.15 }), W.x, 0.04, W.z - 5, false)
  pool.rotation.x = -Math.PI / 2
  pool.scale.set(1, 0.6, 1)
  const ring = put(root, new TorusGeometry(8, 0.35, 8, 48), std('#b9a59a', { roughness: 0.9 }), W.x, 0.15, W.z - 5)
  ring.rotation.x = Math.PI / 2
  ring.scale.set(1, 0.6, 1)

  animated.push((t, dt) => {
    tex.offset.y += dt * 1.1
    foam.forEach((f, i) => f.scale.setScalar(1 + Math.sin(t * 4 + i * 1.3) * 0.12))
    rays.forEach((r, i) => (r.material.opacity = 0.14 + 0.1 * Math.sin(t * 1.3 + i * 1.7)))
    halo.material.opacity = 0.24 + Math.sin(t * 2) * 0.05
  })
}

function buildVip(root, animated) {
  const g = new Group()
  g.position.set(P.vip.x, 0, P.vip.z)
  root.add(g)
  const H = 1.0
  put(g, new BoxGeometry(9, H, 7), std('#d6e6ff', { roughness: 0.5 }), 0, H / 2, 0)
  put(g, new BoxGeometry(9.3, 0.18, 7.3), neon('#ffc21a', 2.2), 0, H + 0.02, 0)
  put(g, new BoxGeometry(5, 0.5, 1.6), std('#bcd3f5'), 0, 0.25, -4.2) // step
  solidBox(4.5, H / 2, 3.5, P.vip.x, H / 2, P.vip.z)

  // Arch portal: two pillars and a half-ring, with a glowing fill.
  const blue = std('#2a7bff', { emissive: '#1f6bff', emissiveIntensity: 0.9, roughness: 0.35 })
  const legH = 2.4
  const r = 2.6
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.8, legH, 0.8), blue, s * r, H + legH / 2, 0)
  put(g, new TorusGeometry(r, 0.42, 12, 32, Math.PI), blue, 0, H + legH, 0)
  const fill = new Shape()
  fill.moveTo(-r, 0)
  fill.lineTo(r, 0)
  fill.lineTo(r, legH)
  fill.absarc(0, legH, r, 0, Math.PI, false)
  fill.closePath()
  const portalMat = glow('#4fc8ff', 0.45)
  put(g, new ShapeGeometry(fill, 16), portalMat, 0, H, 0, false)

  // The "City" board over the arch: destination and what it takes to enter.
  const boardFace = std('#ffffff', { map: textFace('City\n● Rebirth: 10\n⚡ Power: 200', '#ffffff', '#14306e', ['#ffffff', '#ff6b6b', '#7fd8ff']), emissive: '#ffffff', emissiveIntensity: 0.25 })
  boardFace.emissiveMap = boardFace.map
  const frame = std('#2a7bff', { emissive: '#1f6bff', emissiveIntensity: 0.9 })
  put(g, new BoxGeometry(4.2, 2.7, 0.25), [frame, frame, frame, frame, frame, boardFace], 0, H + legH + r + 1.9, 0)
  put(g, new BoxGeometry(4.6, 3.1, 0.15), neon('#7fd8ff'), 0, H + legH + r + 1.9, 0.1)
  animated.push((t) => {
    portalMat.opacity = 0.4 + Math.sin(t * 2.2) * 0.08
  })
}

// --- Train stations ----------------------------------------------------------------------
// One treadmill lane in its own frame (+Z = the far end), placed in its
// station's frame: a dark base, glowing water belt, neon rails all round, and
// a SPEED board with its lock tag.
function buildLane(parent, x, z, spec, i, animated) {
  const L = P.lane
  const g = new Group()
  g.position.set(x, P.platform.height, z)
  parent.add(g)
  const color = spec.neon[i]
  put(g, new BoxGeometry(L.width + 0.3, 0.3, L.length + 0.3), std('#1c2133', { roughness: 0.6 }), 0, 0.15, 0)
  const water = canvasTexture(paintLaneWater(), 1, L.length / 2.7)
  const surface = put(g, new PlaneGeometry(L.width - 0.5, L.length - 0.4), std('#ffffff', { map: water, emissiveMap: water, emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.2 }), 0, 0.31, 0, false)
  surface.rotation.x = -Math.PI / 2
  surface.receiveShadow = true
  // Neon tube rails along both sides and across both ends.
  const rail = neon(color)
  const side = new CylinderGeometry(0.11, 0.11, L.length, 8)
  side.rotateX(Math.PI / 2)
  const end = new CylinderGeometry(0.11, 0.11, L.width, 8)
  end.rotateZ(Math.PI / 2)
  for (const s of [-1, 1]) {
    put(g, side, rail, s * (L.width / 2), 0.4, 0, false)
    put(g, end, rail, 0, 0.4, s * (L.length / 2), false)
  }
  // SPEED board (neon-edged) on two posts at the far end, lock tag above it.
  const dark = std('#15171d')
  const board = std('#ffffff', { map: textFace(`SPEED\n${spec.firstSpeed + i}`, '#ffffff', '#15171d') })
  const by = 1.35
  const bz = L.length / 2 + 0.35
  put(g, new BoxGeometry(2.4, 1.2, 0.12), [dark, dark, dark, dark, dark, board], 0, by, bz)
  put(g, new BoxGeometry(2.6, 1.4, 0.06), neon(color), 0, by, bz + 0.08, false)
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.12, by, 0.12), dark, s * 1.0, by / 2, bz + 0.1)
  const tagStyle = { outline: '#0b1020', font: '700 48px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 8 }
  const tag = label(`🔒 ${spec.req[i]} Required\n${spec.power[i]} Power`, 0.75, { ...tagStyle, colors: ['#7dff6a', '#ffffff'] })
  tag.position.set(0, by + 1.25, bz)
  g.add(tag)
  // Shown instead once the lane is unlocked (setUnlocked).
  const open = label(`⚡ ${spec.power[i]} Power`, 0.42, { ...tagStyle, color: '#7dff6a' })
  open.position.set(0, by + 1.05, bz)
  open.visible = false
  g.add(open)
  animated.push((t, dt) => (water.offset.y -= dt * 1.4))
  return { g, tag, open }
}

// "1.5B" -> 1.5e9, "+30" -> 30.
const amount = (text) => parseFloat(text.replace('+', '')) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[text.slice(-1)] ?? 1)

function buildTrain(root, animated, spec) {
  const { width: PW, depth: PD, height: PH } = P.platform
  const L = P.lane
  // The whole station is turned by its yaw, so the lanes stay a straight grid
  // on the platform and still lean toward the VIP.
  const g = new Group()
  g.position.set(spec.x, 0, spec.z)
  g.rotation.y = spec.yaw
  root.add(g)
  const cos = Math.cos(spec.yaw)
  const sin = Math.sin(spec.yaw)
  const world = (lx, lz) => [spec.x + lx * cos + lz * sin, spec.z - lx * sin + lz * cos]
  put(g, new BoxGeometry(PW, PH, PD), std('#3b4252', { roughness: 0.8 }), 0, PH / 2, 0)
  const trim = std('#ffc21a', { emissive: '#ffb000', emissiveIntensity: 0.9 })
  for (const s of [-1, 1]) {
    put(g, new BoxGeometry(PW + 0.3, 0.2, 0.35), trim, 0, PH, s * (PD / 2))
    put(g, new BoxGeometry(0.35, 0.2, PD + 0.3), trim, s * (PW / 2), PH, 0)
  }
  solidBox(PW / 2, PH / 2, PD / 2, spec.x, PH / 2, spec.z, spec.yaw)

  // Six lanes, two rows of three; driveable (a collider on top of each).
  const lanes = []
  L.rowZ.forEach((lz, row) => {
    L.colX.forEach((lx, col) => {
      const i = row * L.colX.length + col
      const { g: lane, tag, open } = buildLane(g, lx, lz, spec, i, animated)
      const [x, z] = world(lx, lz)
      solidBox((L.width + 0.3) / 2, 0.15, (L.length + 0.3) / 2, x, PH + 0.15, z, spec.yaw)
      // Training zone (training.js): world centre, yaw, half extents, unlock price and power.
      lanes.push({
        lane, color: spec.neon[i], tag, open,
        x, z, yaw: spec.yaw, halfW: L.width / 2, halfL: L.length / 2,
        req: amount(spec.req[i]), reqText: spec.req[i], power: amount(spec.power[i]),
      })
    })
  })

  // The two leaderboards behind the lanes (dark on screen-left = +X), and the Train sign.
  const styles = [
    { outer: '#252a36', x: 2.7, bg: '#0d1733', head: '#5fd0ff', row: '#1d4fd6', rowEdge: '#4f8bff', foot: '#9fc0ff', footStroke: '#000814' },
    { outer: '#ffd21a', x: -2.7, bg: '#ffd21a', head: '#d0306a', row: '#2a62ef', rowEdge: '#7fb0ff', foot: '#5a3a00', footStroke: '#fff2a8' },
  ]
  const boardZ = PD / 2 - 0.8
  const boards = spec.boards.map((stat, i) => {
    const st = styles[i]
    const def = P.leaderboards[stat]
    put(g, new BoxGeometry(4.8, 7, 0.5), std(st.outer, { roughness: 0.6 }), st.x, PH + 3.9, boardZ)
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 776
    const tex = canvasTexture(canvas)
    const edge = std(st.bg)
    const faceMat = std('#ffffff', { map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.7 })
    put(g, new BoxGeometry(4.1, 6.2, 0.1), [edge, edge, edge, edge, edge, faceMat], st.x, PH + 3.9, boardZ - 0.3)
    const t = label(def.title, 1.4, { color: def.color, outline: '#1a0a14', font: '700 64px Fredoka, "Segoe UI Emoji", sans-serif', outlineWidth: 10 })
    t.position.set(st.x, PH + 8.3, boardZ)
    g.add(t)
    const board = { stat, def, st, canvas, tex, key: '' }
    drawBoard(board, null, null, null)
    return board
  })
  const [bx, bz] = world(0, boardZ)
  solidBox(5.2, 3.5, 0.3, bx, PH + 3.9, bz, spec.yaw)
  const sign = label('Train', 2.4, { color: '#ffe14a', outline: '#3a2400', outlineWidth: 18 })
  sign.position.set(0, PH + 10.6, boardZ)
  g.add(sign)
  return { lanes, boards }
}

// --- Leaderboards --------------------------------------------------------------------------
// Each board's face is a canvas: RANK / NAME / stat header, PLAZA_ROWS rows (gold, silver, bronze
// ranks first) and the player's own line at the bottom. "Loading..." until the server answers.
const PLAZA_ROWS = 10
// Seconds -> "45m", "12h 5m", "3d 4h".
function duration(s) {
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d) return `${d}d ${h % 24}h`
  if (h) return `${h}h ${m % 60}m`
  return `${m}m`
}
const formatStat = (stat, v) => (stat === 'playtime' ? duration(v) : short(v))
const RANK_COLORS = ['#ffd84a', '#e4ecf5', '#ff9a4a']

// Fits text into maxW by shrinking the font (names can be long).
function fitText(ctx, text, x, y, maxW, size, align) {
  let px = size
  ctx.font = `700 ${px}px Fredoka, "Segoe UI Emoji", sans-serif`
  while (px > 12 && ctx.measureText(text).width > maxW) ctx.font = `700 ${--px}px Fredoka, "Segoe UI Emoji", sans-serif`
  ctx.textAlign = align
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
}

// rows: [{ name, value }] or null (not loaded); rank: this player's place or null; mine: their value.
function drawBoard(board, rows, rank, mine) {
  const key = JSON.stringify([rows, rank, mine])
  if (key === board.key) return
  board.key = key
  const { canvas, st, def, stat } = board
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  ctx.fillStyle = st.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#0a1030'
  const colX = [64, 230, 448]
  // Header.
  ctx.fillStyle = st.head
  fitText(ctx, 'RANK', colX[0], 40, 110, 30, 'center')
  fitText(ctx, 'NAME', colX[1], 40, 200, 30, 'center')
  fitText(ctx, def.column, colX[2], 40, 120, 30, 'center')
  // Rows.
  const top = 74
  const rowH = 60
  for (let i = 0; i < PLAZA_ROWS; i++) {
    const y = top + i * rowH
    ctx.fillStyle = st.row
    ctx.beginPath()
    ctx.roundRect(14, y + 4, W - 28, rowH - 10, 12)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = st.rowEdge
    ctx.stroke()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#0a1030'
    const r = rows?.[i]
    const cy = y + rowH / 2 - 1
    ctx.fillStyle = RANK_COLORS[i] ?? '#ffffff'
    fitText(ctx, `#${i + 1}`, colX[0], cy, 90, 28, 'center')
    ctx.fillStyle = '#ffffff'
    fitText(ctx, r ? r.name : rows ? '-' : '', colX[1], cy, 210, 26, 'center')
    fitText(ctx, r ? formatStat(stat, r.value) : '', colX[2], cy, 116, 26, 'center')
  }
  // The player's own line.
  const fy = top + PLAZA_ROWS * rowH + 34
  ctx.fillStyle = st.foot
  ctx.strokeStyle = st.footStroke
  ctx.lineWidth = 4
  if (!rows) {
    fitText(ctx, 'Loading...', W / 2, fy, W - 40, 32, 'center')
  } else {
    fitText(ctx, rank ? `Your Rank: #${rank}` : 'Your Rank: -', 30, fy, 250, 28, 'left')
    if (mine != null) fitText(ctx, formatStat(stat, mine), W - 30, fy, 200, 30, 'right')
  }
  board.tex.needsUpdate = true
}

// --- Kiosks and displays ------------------------------------------------------------------
function buildGolden(root, animated) {
  const g = new Group()
  g.position.set(P.golden.x, 0, P.golden.z)
  face(g, 0, 10)
  root.add(g)
  const gold = std('#ffc933', { metalness: 0.65, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.2 })
  const ring = put(g, new TorusGeometry(3, 0.14, 8, 48), neon('#ffb21a'), 0, 0.08, 0, false)
  ring.rotation.x = Math.PI / 2
  put(g, new BoxGeometry(3.2, 0.4, 2.4), std('#a8771a', { metalness: 0.5, roughness: 0.4 }), 0, 0.2, 0)
  put(g, new BoxGeometry(2.6, 3, 1.8), gold, 0, 1.9, 0)
  put(g, new BoxGeometry(1.8, 1.2, 0.06), std('#122a6a', { emissive: '#2a5cff', emissiveIntensity: 0.6 }), 0, 2.5, 0.92)
  put(g, new SphereGeometry(0.18, 12, 8), std('#e8262b', { emissive: '#e8262b', emissiveIntensity: 0.4 }), 0.6, 1.5, 0.95)
  put(g, new SphereGeometry(0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#bfe8ff', { transparent: true, opacity: 0.45, roughness: 0.05 }), 0, 3.4, 0)
  const nugget = put(g, new SphereGeometry(0.45, 12, 10), gold, 0, 3.75, 0)
  put(g, new CylinderGeometry(1, 1, 0.12, 24), gold, 0, 3.4, 0)
  const t = label('Golden Machine', 0.8, { color: '#ffe14a', outline: '#3a2400' })
  t.position.y = 5.8
  g.add(t)
  solidBox(1.6, 2, 1.2, P.golden.x, 2, P.golden.z, g.rotation.y)
  // Gold sparkles drifting round the machine.
  createEmitter(root, {
    boxes: [{ x: P.golden.x, y: 2.4, z: P.golden.z, sx: 2, sy: 2, sz: 2, color: '#ffd24a' }],
    count: 45, life: 2.4, velocity: [0, 0.6, 0], spread: [0.3, 0.3, 0.3],
    size: 0.45, intensity: 3, twinkle: 6, sprite: 'sparkle', seed: 81,
  })
  animated.push((time) => (nugget.rotation.y = time * 1.5))
}

function buildIndex(root) {
  const g = new Group()
  g.position.set(P.index.x, 0, P.index.z)
  face(g, 0, 10)
  root.add(g)
  put(g, new BoxGeometry(2.2, 3, 1.6), std('#2a5cff', { roughness: 0.45 }), 0, 1.5, 0)
  put(g, new BoxGeometry(1.6, 1.4, 0.06), std('#dff3ff', { emissive: '#9fdcff', emissiveIntensity: 0.5 }), 0, 1.9, 0.82)
  put(g, new CylinderGeometry(0.08, 0.08, 1.2), std('#c8cfdb'), 0, 3.6, 0)
  const disc = put(g, new CylinderGeometry(0.75, 0.75, 0.14, 28), std('#ffffff'), 0, 4.6, 0)
  disc.rotation.x = Math.PI / 2
  const star = label('★', 1.1, { color: '#ffc21a', outline: '#3a2400', outlineWidth: 8 })
  star.position.set(0, 4.6, 0.2)
  g.add(star)
  const t = label('Index', 0.7, { color: '#ffffff', outline: '#123a8a' })
  t.position.y = 5.9
  g.add(t)
  solidBox(1.1, 1.5, 0.8, P.index.x, 1.5, P.index.z, g.rotation.y)
}

function buildRelics(root, animated) {
  const g = new Group()
  g.position.set(P.relics.x, 0, P.relics.z)
  face(g, 0, 10)
  root.add(g)
  const purple = std('#8a3cff', { roughness: 0.45 })
  put(g, new BoxGeometry(4.6, 1.3, 2), purple, 0, 0.65, 0)
  put(g, new BoxGeometry(4.8, 0.16, 2.2), std('#f2e9ff'), 0, 1.36, 0)
  const q = std('#ffffff', { map: textFace('?', '#8a3cff', '#ffffff') })
  const box = put(g, new BoxGeometry(1.3, 1.3, 1.3), q, -0.8, 2.1, 0)
  const coin = put(g, new CylinderGeometry(0.55, 0.55, 0.14, 28), std('#ffc933', { metalness: 0.6, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.3 }), 1.2, 2.6, 0)
  coin.rotation.x = Math.PI / 2
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.2, 3.6, 0.2), purple, s * 2.2, 1.8, -0.9)
  put(g, new BoxGeometry(4.6, 0.6, 0.2), purple, 0, 3.6, -0.9)
  const t = label('Forest Relics', 0.8, { color: '#ffe14a', outline: '#3a2400' })
  t.position.y = 4.8
  g.add(t)
  solidBox(2.3, 1, 1, P.relics.x, 1, P.relics.z, g.rotation.y)
  animated.push((time) => {
    coin.rotation.z = time * 2
    box.position.y = 2.1 + Math.sin(time * 2) * 0.12
  })
}

function buildChest(root) {
  const g = new Group()
  g.position.set(P.chest.x, 0, P.chest.z)
  face(g, 0, 10)
  root.add(g)
  const red = std('#d8262b', { roughness: 0.5 })
  const gold = std('#ffc933', { metalness: 0.6, roughness: 0.3 })
  put(g, new BoxGeometry(1.9, 1.1, 1.2), red, 0, 0.55, 0)
  const lid = put(g, new CylinderGeometry(0.6, 0.6, 1.9, 16, 1, false, 0, Math.PI), red, 0, 1.1, 0)
  lid.rotation.z = Math.PI / 2
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.18, 1.2, 1.25), gold, s * 0.6, 0.6, 0)
  put(g, new BoxGeometry(0.3, 0.36, 0.1), gold, 0, 1.0, 0.62)
  solidBox(1, 0.8, 0.7, P.chest.x, 0.8, P.chest.z, g.rotation.y)
}

// Feather flags: a dark pole with a tall sail-shaped banner hanging off it.
// The banner lies in the pole's local XY plane, turned to face +-X.
function buildFlags(root) {
  const flagTex = new CanvasTexture(paintFlag())
  flagTex.colorSpace = SRGBColorSpace
  const pole = std('#2a2d35', { roughness: 0.5 })
  for (const [x, z, h] of P.flags) {
    const g = new Group()
    g.position.set(x, 0, z)
    g.rotation.y = Math.PI / 2
    root.add(g)
    put(g, new CylinderGeometry(0.13, 0.16, h, 10), pole, 0, h / 2, 0)
    const top = put(g, new TorusGeometry(1.0, 0.1, 6, 12, Math.PI / 2), pole, 1.0, h - 0.1, 0) // the bent tip that holds the sail out
    top.rotation.z = Math.PI / 2
    // Sail: straight along the pole, bulging out to ~2.2 m, rounded over the top.
    const w = 2.2
    const s = new Shape()
    s.moveTo(0, 1.4)
    s.lineTo(w * 0.8, 1.4)
    s.quadraticCurveTo(w * 1.05, h * 0.55, w * 0.95, h * 0.82)
    s.quadraticCurveTo(w * 0.8, h + 0.75, 0, h + 0.85)
    s.closePath()
    const geo = new ShapeGeometry(s, 12)
    // Normalise the shape-space UVs to 0..1 over the sail.
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (w * 1.05), (uv.getY(i) - 1.4) / (h - 0.55))
    put(g, geo, std('#ffffff', { map: flagTex, side: DoubleSide, roughness: 0.6 }), 0.12, 0, 0)
    solidPole(0.3, h, x, z)
  }
}

// --- Particles ----------------------------------------------------------------------------
function buildParticles(scene, lanes) {
  const W = P.waterfall
  // Mist billowing up and out from the foot of the falls.
  createEmitter(scene, {
    boxes: [{ x: W.x, y: 0.8, z: W.z - 1.5, sx: W.width / 2, sy: 0.4, sz: 0.8 }],
    count: 170, life: 2.6, velocity: [0, 1.8, -1.4], spread: [1.6, 0.8, 1.2], gravity: 0.4,
    size: 1.7, grow: 2.4, color: '#e0f7ff', intensity: 1.3, opacity: 0.3, seed: 11,
  })
  // Spray droplets falling down the face of the sheet.
  createEmitter(scene, {
    boxes: [{ x: W.x, y: W.height - 1, z: W.z - 0.6, sx: W.width / 2, sy: 0.6, sz: 0.3 }],
    count: 150, life: 2.6, velocity: [0, -4, -0.5], spread: [0.4, 1.2, 0.4], gravity: 6,
    size: 0.32, color: '#ffffff', intensity: 2.2, opacity: 0.8, seed: 12,
  })
  // Sparkles twinkling around the falls and the portal.
  createEmitter(scene, {
    boxes: [
      { x: W.x, y: 14, z: W.z - 2, sx: W.width / 2 + 3, sy: 12, sz: 1.5 },
      { x: P.vip.x, y: 6, z: P.vip.z - 2, sx: 6, sy: 4, sz: 3 },
    ],
    count: 90, life: 4.5, velocity: [0, 0.45, 0], spread: [0.25, 0.25, 0.25],
    size: 0.75, color: '#ffffff', intensity: 2.4, twinkle: 5, sprite: 'sparkle', seed: 13,
  })
  // Bubbles rising off every treadmill, tinted by its neon.
  const L = P.lane
  const at = new Vector3()
  createEmitter(scene, {
    boxes: lanes.map(({ lane, color }) => {
      lane.getWorldPosition(at)
      return { x: at.x, y: at.y + 0.5, z: at.z, sx: L.width / 2 - 0.5, sy: 0.1, sz: L.length / 2 - 0.6, color }
    }),
    count: 240, life: 1.8, velocity: [0, 1.3, 0], spread: [0.15, 0.4, 0.15],
    size: 0.3, intensity: 4, opacity: 0.9, twinkle: 4, seed: 15,
  })
}

export function createPlaza(scene) {
  const root = new Group()
  root.name = 'plaza'
  scene.add(root)
  const animated = [] // fn(elapsed, dt) per animated prop

  P.cliffs.forEach((c, i) => buildCliff(root, c, 20 + i * 7))
  buildWaterfall(root, animated)
  buildVip(root, animated)
  const trains = P.trains.map((spec) => buildTrain(root, animated, spec))
  const lanes = trains.flatMap((t) => t.lanes)
  const boards = trains.flatMap((t) => t.boards)
  let leaders = null // the server's last `leaderboard` { boards, ranks }
  let mine = {} // this player's live values per stat
  const redraw = () => boards.forEach((b) => drawBoard(b, leaders?.boards?.[b.stat] ?? null, leaders?.ranks?.[b.stat] ?? null, mine[b.stat] ?? null))
  fontReady.then(() => {
    for (const b of boards) b.key = '' // repaint in Fredoka
    redraw()
  })
  buildGolden(root, animated)
  buildIndex(root)
  buildRelics(root, animated)
  buildChest(root)
  buildFlags(root)
  P.palms.forEach(([x, z, y, h, lx, lz], i) => buildPalm(root, x, z, h, lx, lz, 300 + i, y))
  root.updateMatrixWorld(true)
  buildParticles(scene, lanes)

  return {
    lanes,
    // Swaps each lane's lock tag for its power tag once `isOpen(lane)`.
    setUnlocked(isOpen) {
      for (const l of lanes) {
        const on = isOpen(l)
        l.tag.visible = !on
        l.open.visible = on
      }
    },
    // The server's `leaderboard` message: { boards: { stat: [{ name, value }] }, ranks: { stat: n | null } }.
    setLeaderboard(data) {
      leaders = data
      redraw()
    },
    // This player's own values ({ rebirths, trophies, energy, playtime }) for the boards' bottom line.
    setMine(values) {
      mine = values
      redraw()
    },
    update(dt, elapsed) {
      for (const fn of animated) fn(elapsed, dt)
    },
  }
}
