// Trails scene (the reference's "TRAILS" screen, opened by the HUD's Trail
// tile or L). Not a popup: the HUD folds down to its logo pill and round
// buttons, the boat is parked broadside in the sea with its trail streaming
// (stage(), driven from main.js), and the UI sits around it like the shot:
//   left   - gold "TRAILS" title, white panel with a scrolling 3-column grid of
//            round trail pictures (gold cards with art, Wins prices, darker
//            padlocked "Rebirth N" cards), Wins pill under it
//   right  - blue card: name, big picture, +% Wins / +% Acc, and Equip /
//            Unequip / the blue Wins price button
//   bottom - red Exit
// White is free; everything else is bought with Wins (the HUD counter), at a
// price set by its boosts (TRAILS.pricing). Tapping a card previews it on the
// boat; leaving puts the equipped one back. Catalog: TRAILS in config.js, the
// patterns in trailTextures.js; owned/equipped are saved by the server
// (snapshot / hydrate, net.js). Sizes are reference pixels x --tu (trails.css).
import './trails.css'
import { BOAT, CAMERA, TRAILS } from './config.js'
import { ICONS } from './hudIcons.js'
import { trailSwatch } from './trailTextures.js'
import { replay } from './uiWindow.js'
import { sfx } from './audio/index.js'

const INK = '#1d1a22'

const CHECK = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#2fc74a" stroke="#fff" stroke-width="9"/>
  <path d="M29 51l14 14 29-30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const LOCK = `<svg viewBox="0 0 100 110" aria-hidden="true">
  <path d="M28 52V36a22 22 0 0 1 44 0v16" fill="none" stroke="${INK}" stroke-width="20"/>
  <path d="M28 52V36a22 22 0 0 1 44 0v16" fill="none" stroke="#3a3744" stroke-width="10"/>
  <rect x="12" y="46" width="76" height="58" rx="10" fill="#ffc21a" stroke="${INK}" stroke-width="7"/>
  <rect x="20" y="53" width="60" height="12" rx="5" fill="#ffe27a"/>
  <path d="M14 90 H86 V96 a8 8 0 0 1 -8 8 H22 a8 8 0 0 1 -8 -8 Z" fill="#e89a00"/>
  <circle cx="50" cy="74" r="8" fill="${INK}"/><path d="M50 76v14" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
</svg>`

// --- Gold card art ---------------------------------------------------------------------
// Drawn as a glossy orb on the cards and as a full square in the info swatch.
const sparkle = (x, y, r) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff"/>`
const ghostShape = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-20 22V-2a20 20 0 0 1 40 0v24l-7-6-6 7-7-7-7 7-6-7z" fill="#eef2ff" opacity=".93"/>
    <path d="M-20 4q-12 2-16-6M20 4q12 2 16-6" stroke="#eef2ff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9"/>
    <ellipse cx="-7" cy="-2" rx="3.5" ry="5" fill="#3a0f9a"/><ellipse cx="7" cy="-2" rx="3.5" ry="5" fill="#3a0f9a"/>
    <ellipse cx="0" cy="9" rx="4" ry="5" fill="#3a0f9a"/></g>`
const ART = {
  ghost: {
    bg: `<radialGradient id="tr-ghost" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#c58bff"/><stop offset=".6" stop-color="#7a2cff"/><stop offset="1" stop-color="#3a0f9a"/></radialGradient>`,
    fill: 'url(#tr-ghost)',
    body: `${ghostShape(58, 42, 1)}${ghostShape(34, 70, 0.62)}${sparkle(80, 76, 5)}${sparkle(22, 26, 5)}${sparkle(84, 18, 4)}`,
  },
  wave: {
    bg: `<radialGradient id="tr-wave" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#2a1660"/><stop offset="1" stop-color="#0a0620"/></radialGradient>
      <linearGradient id="tr-beam" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7f9cff"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#ff5fe0"/></linearGradient>`,
    fill: 'url(#tr-wave)',
    body: `<path d="M16 86 26 70 22 66 40 52 36 46 54 36 50 30 70 22 66 18 86 10 74 30 78 32 60 44 64 48 46 60 50 64 30 76 34 80Z" fill="url(#tr-beam)" opacity=".95"/>
      <path d="M20 82 82 14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>${sparkle(80, 16, 7)}${sparkle(18, 84, 5)}`,
  },
  notes: {
    bg: `<radialGradient id="tr-notes" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#4f8bff"/><stop offset=".6" stop-color="#1f3fd6"/><stop offset="1" stop-color="#0d1a70"/></radialGradient>`,
    fill: 'url(#tr-notes)',
    body: `<path d="M38 80c-10 2-14-6-8-12s16-2 16 8l-6-56c-1-8 12-10 12-2 0 10-22 18-24 30-1 8 8 14 16 12s10-12 2-16-14 2-12 8" fill="none" stroke="#ff3a4a" stroke-width="5" stroke-linecap="round"/>
      <path d="M68 66V28l14 8" fill="none" stroke="#ffb31a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="62" cy="67" rx="8" ry="6" fill="#ffb31a"/>${sparkle(80, 80, 5)}${sparkle(24, 22, 5)}`,
  },
}
function art(name, square = false) {
  const a = ART[name]
  const shape = square ? `<rect width="100" height="100" fill="${a.fill}"/>` : `<circle cx="50" cy="50" r="46" fill="${a.fill}"/>`
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>${a.bg}</defs>${shape}${a.body}</svg>`
}

// 800 -> "800", 3000 -> "3K", 2.5e15 -> "2.5Qa" (the reference's short style).
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp']
function short(n) {
  let i = 0
  while (n >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  return i === 0 ? String(Math.floor(n)) : `${+n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)}${SUFFIXES[i]}`
}

// Wins price from the boosts: base * (average boost / benefit)^power, 2 significant digits.
function priceOf(t) {
  if (TRAILS.start.owned.includes(t.id)) return 0
  const { base, benefit, power } = TRAILS.pricing
  const p = base * ((t.stats.wins + t.stats.acc) / 2 / benefit) ** power
  const step = 10 ** (Math.floor(Math.log10(p)) - 1)
  return Math.round(p / step) * step
}

const CATALOG = TRAILS.list.map((t) => ({ ...t, price: priceOf(t) }))
const byId = new Map(CATALOG.map((t) => [t.id, t]))
export const trailById = (id) => byId.get(id) ?? null

export const trailState = { owned: new Set(TRAILS.start.owned), equipped: TRAILS.start.equipped }

// The saved part (net.js; backend sanitize.ts): { trails: owned ids, trail: the equipped one, '' = none }.
export const snapshot = () => ({ trails: [...trailState.owned], trail: trailState.equipped ?? '' })

// A loaded save over a fresh start (unknown ids dropped).
function applySave(s) {
  trailState.owned = new Set(TRAILS.start.owned)
  trailState.equipped = TRAILS.start.equipped
  if (Array.isArray(s.trails)) for (const id of s.trails) if (byId.has(id)) trailState.owned.add(id)
  if (s.trail === '') trailState.equipped = null
  else if (trailState.owned.has(s.trail)) trailState.equipped = s.trail
}

// The picture of a trail: gold-card art, its painted pattern, or its plain colour.
function picture(el, t, square) {
  const look = t.look
  el.style.setProperty('--c', look.color ?? 'transparent')
  el.style.backgroundImage = !look.art && look.texture ? `url(${trailSwatch(look.texture)})` : ''
  el.innerHTML = look.art ? art(look.art, square) : ''
  el.classList.toggle('art', !!look.art)
}

const gradText = (cls, value) => `<span class="tr-grad ${cls}" data-t="${value}">${value}</span>`

const MARKUP = `
  <div class="tr-left">
    <div class="tr-title">${gradText('tr-title-text', 'TRAILS')}</div>
    <div class="tr-panel"><div class="tr-grid" role="listbox" aria-label="Trails"></div></div>
    <div class="tr-wallet"><span class="tr-wallet-icon">${ICONS.bolt}</span>${gradText('tr-wallet-num', '0')}</div>
  </div>
  <aside class="tr-info">
    <div class="tr-card">
      <div class="tr-name tr-text"></div>
      <div class="tr-swatch"></div>
      <div class="tr-stats">${gradText('tr-stat', '')}${gradText('tr-stat', '')}</div>
      <div class="tr-hint tr-text"></div>
      <button type="button" class="tr-action tr-text"></button>
    </div>
  </aside>
  <button type="button" class="tr-exit tr-text">Exit</button>`

// wallet: { wins() -> number, spend(n) } (the HUD's Wins counter).
// rebirths() -> the player's rebirth count (gates the Rebirth N trails).
// onPreview(trail | null) shows a trail on the boat; onOpen / onClose bracket the scene.
// Returns { open, close, toggle, isOpen, stage, snapshot, hydrate }.
export function createTrails({ wallet, rebirths = () => 0, onPreview, onOpen, onClose }) {
  const root = document.createElement('div')
  root.className = 'tr-scene'
  root.hidden = true
  root.innerHTML = MARKUP
  document.body.append(root)
  const q = (sel) => root.querySelector(sel)
  const grid = q('.tr-grid')
  const walletNum = q('.tr-wallet-num')
  const nameEl = q('.tr-name')
  const swatch = q('.tr-swatch')
  const [winsEl, accEl] = root.querySelectorAll('.tr-stat')
  const hint = q('.tr-hint')
  const action = q('.tr-action')

  const setGrad = (e, value) => {
    e.textContent = value
    e.dataset.t = value
  }

  const owns = (t) => trailState.owned.has(t.id)
  const rebirthLocked = (t) => t.rebirth != null && !owns(t) && rebirths() < t.rebirth

  let selected = trailState.equipped ?? TRAILS.start.equipped
  const tiles = new Map()
  for (const t of CATALOG) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `tr-tile${t.gold ? ' gold' : ''}`
    b.setAttribute('role', 'option')
    b.setAttribute('aria-label', t.name)
    b.innerHTML =
      (t.gold ? `<span class="tr-ribbon">${gradText('tr-ribbon-text', 'LIMITED')}</span>` : '') +
      '<span class="tr-orb"></span>' +
      `<span class="tr-lock">${LOCK}</span>` +
      (t.rebirth != null ? `<span class="tr-req tr-text">Rebirth ${t.rebirth}</span>` : '') +
      (t.price ? `<span class="tr-price"><span class="tr-price-num tr-text">${short(t.price)}</span><span class="tr-price-icon">${ICONS.bolt}</span></span>` : '') +
      `<span class="tr-check">${CHECK}</span>`
    picture(b.querySelector('.tr-orb'), t, false)
    b.addEventListener('click', () => select(t.id))
    grid.append(b)
    tiles.set(t.id, b)
  }

  let hintTimer = 0
  function say(text) {
    hint.textContent = text
    hint.classList.add('show')
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => hint.classList.remove('show'), 1800)
  }

  function setAction(html, color) {
    action.innerHTML = html
    action.className = `tr-action tr-text ${color}`
  }

  function render() {
    const t = byId.get(selected)
    nameEl.textContent = t.name
    nameEl.style.setProperty('--fit', Math.min(1, 10 / t.name.length)) // long names shrink to fit the card
    picture(swatch, t, true)
    swatch.classList.toggle('has-art', !!t.look.art)
    setGrad(winsEl, `+${t.stats.wins}% Wins`)
    setGrad(accEl, `+${t.stats.acc}% Acc`)
    if (trailState.equipped === t.id) setAction('Unequip', 'yellow')
    else if (owns(t)) setAction('Equip', 'green')
    else setAction(`<span class="tr-cost"><span class="tr-cost-icon">${ICONS.bolt}</span>${short(t.price)}</span>`, 'blue')
    for (const [id, b] of tiles) {
      const tt = byId.get(id)
      b.classList.toggle('locked', rebirthLocked(tt))
      b.classList.toggle('owned', owns(tt))
      b.classList.toggle('equipped', trailState.equipped === id)
      b.classList.toggle('sel', id === selected)
      b.setAttribute('aria-selected', String(id === selected))
    }
    setGrad(walletNum, short(wallet.wins()))
  }

  function select(id) {
    selected = id
    hint.classList.remove('show')
    render()
    onPreview?.(byId.get(id))
    sfx.swish() // the new trail streams past
  }

  function onAction() {
    const t = byId.get(selected)
    const tile = tiles.get(t.id)
    if (trailState.equipped === t.id) {
      trailState.equipped = null
    } else if (owns(t)) {
      trailState.equipped = t.id
    } else if (rebirthLocked(t)) {
      replay(action, 'shake')
      return say(`Reach Rebirth ${t.rebirth}!`)
    } else {
      const have = wallet.wins()
      if (have < t.price) {
        replay(action, 'shake')
        return say(`Need ${short(t.price - have)} more Wins!`)
      }
      wallet.spend(t.price)
      trailState.owned.add(t.id)
      trailState.equipped = t.id
    }
    render()
    replay(tile.querySelector('.tr-check'), 'bump')
  }
  action.addEventListener('click', onAction)

  const isOpen = () => !root.hidden
  function open() {
    if (isOpen()) return
    selected = trailState.equipped ?? selected
    hint.classList.remove('show')
    render()
    onOpen?.()
    root.hidden = false
    document.body.classList.add('tr-open') // hides the touch joystick + buttons (trails.css)
    replay(root, 'tr-in')
    document.exitPointerLock?.() // the cursor has to be free to press the cards
    onPreview?.(byId.get(selected))
    requestAnimationFrame(() => tiles.get(selected)?.scrollIntoView({ block: 'nearest' }))
  }
  function close() {
    if (!isOpen()) return false
    sfx.sceneOut()
    root.hidden = true
    document.body.classList.remove('tr-open')
    onPreview?.(trailById(trailState.equipped))
    onClose?.()
    return true
  }
  q('.tr-exit').addEventListener('click', close)

  // Parks `boat` (the player's group) in the sea and frames it with `camera`:
  // broadside, centred on landscape screens, pulled back and raised above the
  // panels on portrait ones so the whole hull fits.
  const S = TRAILS.showcase
  const vl = Math.hypot(S.view[0], S.view[1])
  const vx = S.view[0] / vl
  const vz = S.view[1] / vl
  function stage(camera, boat) {
    boat.position.set(S.x, S.y, S.z)
    boat.rotation.set(0, Math.atan2(-vz, vx), 0) // nose toward the camera's right
    if (camera.fov !== CAMERA.fov) {
      camera.fov = CAMERA.fov
      camera.updateProjectionMatrix()
    }
    const portrait = camera.aspect < 1
    const halfV = Math.tan((camera.fov * Math.PI) / 360)
    const fit = BOAT.length / ((portrait ? S.portraitBoatWidth : S.boatWidth) * 2 * halfV * camera.aspect)
    const dist = Math.max(S.distance, fit)
    const ty = S.y + BOAT.deck + 0.3
    const lift = S.height * (dist / S.distance)
    camera.position.set(S.x - vx * dist, ty + lift, S.z - vz * dist)
    const raise = portrait ? S.portraitRaise * halfV * Math.hypot(dist, lift) : 0
    camera.lookAt(S.x, ty - raise, S.z)
  }

  // A save loaded from the server (net.js): the boat wears its equipped trail (unless the scene is
  // previewing one).
  function hydrate(doc) {
    applySave(doc)
    render()
    if (!isOpen()) onPreview?.(trailById(trailState.equipped))
  }

  return { open, close, toggle: () => (isOpen() ? close() : open()), isOpen, stage, snapshot, hydrate }
}
