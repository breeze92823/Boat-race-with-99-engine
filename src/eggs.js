import './eggs.css'
import { EGG_HATCH, INTERACT, PETS } from './config.js'
import { ICONS } from './hudIcons.js'
import { boosts } from './boosts.js'
import { eggOdds, rollEgg } from './hatch.js'
import { short } from './interact.js'
import { formatMult, petPortrait, petsState } from './pets.js'
import { createWindow, replay, uiButton } from './uiWindow.js'
import { sfx } from './audio/index.js'
import { burst, centre } from './juice.js'

// The egg window and hatching, after Kayak & Surf's eggs.js + hud/eggs.js, in the
// shared window shell. E at a stall egg (interact.js) opens its window: the egg,
// its Wins price and the Wins you have, every pet it holds with its odds and
// multiplier, and Open 1 (E) / Open N (R) / Auto (T, hatches again as each one
// ends). A hatch checks storage, then Wins, pays, rolls (hatch.js, luck from the
// boosts), adds the pets (pets.addPet) and plays the overlay: the eggs shake
// harder and harder, a flash, then the cards pop out (rays behind Rare and up,
// Golden/Rainbow tier, NEW! for a kind never seen before); a tap skips a phase.
// While the window is open the keys E / R / T are taken here before input.js
// (capture listener), so they don't respawn or open the Partner window.
// The window always shows the egg you are at: driving to another egg switches
// to it (Auto stops), driving off past EGG_HATCH.closeRange closes it, so E
// never pays for the egg you just drove away from.
// deps: { hud (getStat/setStat 'trophies'), pets (addPet), spots: shops.spots.eggs }.
const KEYS = { KeyE: 'one', KeyR: 'many', KeyT: 'auto' }
const INK = '#1d1a22'
const RAINBOW = ['#ff3b3b', '#ffe14a', '#3ddc4a', '#2fb8ff', '#b05cff']

// 12.5% / 5% / 0.4% / 1 in 2.5K
function formatChance(c) {
  const pct = c * 100
  if (pct >= 10) return `${pct.toFixed(1).replace(/\.0$/, '')}%`
  if (pct >= 0.01) return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`
  return `1 in ${short(Math.round(1 / c))}`
}

const cap = (s) => s[0].toUpperCase() + s.slice(1)

// Mixes a #rrggbb colour toward white (k > 0) or black (k < 0).
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}

// The egg as an SVG (its stall look: colour, spikes, rainbow bands). Gradient ids
// are unique per copy: a copy inside a hidden window must not break the others.
let artId = 0
function eggArt(egg) {
  const id = `eg${artId++}`
  const defs = egg.rainbow
    ? `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${RAINBOW.map((c, i) => `<stop offset="${i / (RAINBOW.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`
    : `<radialGradient id="${id}" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="${shade(egg.color, 0.55)}"/><stop offset="0.55" stop-color="${egg.color}"/><stop offset="1" stop-color="${shade(egg.color, -0.35)}"/></radialGradient>`
  let spikes = ''
  if (egg.spiky) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3
      const at = (r, da) => `${(50 + Math.cos(a + da) * r).toFixed(1)},${(68 + Math.sin(a + da) * r * 1.15).toFixed(1)}`
      spikes += `<polygon points="${at(38, -0.2)} ${at(56, 0)} ${at(38, 0.2)}" fill="${shade(egg.color, -0.2)}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`
    }
  }
  return `<svg viewBox="-12 -14 124 140" aria-hidden="true"><defs>${defs}</defs>${spikes}
<path d="M50 4C77 4 94 50 94 75C94 100 75 116 50 116C25 116 6 100 6 75C6 50 23 4 50 4Z" fill="url(#${id})" stroke="${INK}" stroke-width="4.5"/>
<ellipse cx="33" cy="38" rx="8" ry="15" fill="#fff" opacity="0.55" transform="rotate(-22 33 38)"/></svg>`
}

export function createEggs({ hud, pets, spots }) {
  const wins = () => hud.getStat('trophies')
  const seen = new Set() // kinds ever hatched (the NEW! tag), saved by the server (net.js)
  let spot = null // the spot whose window is open
  let auto = false
  let lastCount = 1
  let autoTimer = 0
  let hatch = null // { phase: 'shake' | 'reveal', timer, revealMs }

  // --- Window ---------------------------------------------------------------------------
  const win = createWindow({ title: 'Egg', className: 'eg-overlay', onClose })
  const titleEl = win.dialog.querySelector('.uiw-title h2')
  const iconEl = win.dialog.querySelector('.uiw-title-icon')
  win.body.innerHTML = `
<div class="eg-main">
  <div class="eg-side">
    <div class="eg-face"></div>
    <div class="eg-price uiw-text"><span class="eg-ico">${ICONS.trophy}</span><b></b></div>
    <div class="eg-have uiw-text"></div>
  </div>
  <div class="eg-box uiw-box"><div class="eg-grid"></div></div>
</div>
<div class="eg-toast uiw-text"></div>`
  const faceEl = win.body.querySelector('.eg-face')
  const priceEl = win.body.querySelector('.eg-price b')
  const haveEl = win.body.querySelector('.eg-have')
  const gridEl = win.body.querySelector('.eg-grid')
  const toastEl = win.body.querySelector('.eg-toast')
  const btns = document.createElement('div')
  btns.className = 'uiw-btns eg-btns'
  const oneBtn = uiButton('Open 1<kbd>E</kbd>', 'green', () => go(1, oneBtn))
  const manyBtn = uiButton(`Open ${EGG_HATCH.openMany}<kbd>R</kbd>`, 'green', () => go(EGG_HATCH.openMany, manyBtn))
  const autoBtn = uiButton('Auto<kbd>T</kbd>', 'blue', toggleAuto, 'eg-auto')
  btns.append(oneBtn, manyBtn, autoBtn)
  win.body.append(btns)

  // --- Hatch overlay ----------------------------------------------------------------------
  const hatchEl = document.createElement('div')
  hatchEl.className = 'eg-hatch'
  hatchEl.hidden = true
  hatchEl.innerHTML = '<div class="eg-flash"></div><div class="eg-row"></div><div class="eg-hint">Tap to skip</div>'
  const rowEl = hatchEl.querySelector('.eg-row')
  const flashEl = hatchEl.querySelector('.eg-flash')
  document.body.append(hatchEl)
  hatchEl.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    skip()
  })

  function show(s) {
    spot = s
    setAuto(false)
    lastCount = 1
    const egg = s.egg
    titleEl.textContent = egg.name
    iconEl.innerHTML = eggArt(egg)
    faceEl.innerHTML = eggArt(egg)
    priceEl.textContent = short(egg.price)
    gridEl.innerHTML = eggOdds(egg)
      .map(({ kind, chance }) => {
        const k = PETS.kinds[kind]
        return `<div class="eg-card"><div class="eg-disc r-${k.rarity}">${petPortrait(kind)}</div>
<b class="eg-card-name uiw-text">${k.name}</b><b class="eg-chance uiw-text">${formatChance(chance)}</b>
<span class="eg-mult uiw-text">${formatMult(k.mult)}</span></div>`
      })
      .join('')
    for (const p of petsState.pets) seen.add(p.kind) // owned already (starter, gifts) = not NEW
    paint()
  }

  // Wins on hand under the price (red when short) and the Auto toggle.
  let painted = ''
  function paint() {
    if (!spot) return
    const have = wins()
    const key = `${have}|${spot.egg.price}|${auto}`
    if (key === painted) return
    painted = key
    haveEl.textContent = `You have ${short(have)}`
    haveEl.classList.toggle('short', have < spot.egg.price)
    autoBtn.classList.toggle('on', auto)
    autoBtn.firstChild.textContent = auto ? 'Auto ON' : 'Auto'
  }

  function say(text) {
    toastEl.textContent = text
    replay(toastEl, 'show')
  }

  function onClose() {
    spot = null
    setAuto(false)
  }

  function setAuto(on) {
    auto = on
    clearTimeout(autoTimer)
    paint()
  }
  function toggleAuto() {
    if (!spot) return
    setAuto(!auto)
    if (auto && !hatch && !go(lastCount, autoBtn)) setAuto(false)
  }

  // Pays for and hatches `n` of the open egg; false (shaking `btn`, saying why) when it can't.
  function go(n, btn) {
    if (!spot || hatch) return false
    const egg = spot.egg
    const cost = egg.price * n
    const have = wins()
    let why = ''
    if (petsState.pets.length + n > petsState.storage) why = `Pets full! (${petsState.pets.length}/${petsState.storage})`
    else if (have < cost) why = `Need ${short(cost - have)} more Wins!`
    if (why) {
      replay(btn, 'shake')
      replay(priceEl.parentElement, 'shake')
      say(why)
      return false
    }
    hud.setStat('trophies', have - cost)
    lastCount = n
    const hatched = roll(egg, n)
    paint()
    play(hatched, egg, auto ? EGG_HATCH.time.auto : 1)
    return true
  }

  // Rolls `n` of `egg` (luck from the boosts) and adds the pets.
  function roll(egg, n) {
    for (const p of petsState.pets) seen.add(p.kind) // owned already = not NEW
    return rollEgg(egg, n, 1 + boosts().luck / 100).map(({ kind, tier }) => {
      const isNew = !seen.has(kind)
      seen.add(kind)
      pets.addPet(kind, tier)
      return { kind, tier, isNew }
    })
  }

  function play(hatched, egg, speed) {
    rowEl.innerHTML = hatched
      .map(({ kind, tier, isNew }, i) => {
        const k = PETS.kinds[kind]
        const tierName = tier ? `${PETS.tiers[tier].name} ` : ''
        return `<div class="eg-slot" style="--i:${i}">
  <div class="eg-egg">${eggArt(egg)}</div>
  <div class="eg-out${EGG_HATCH.rays.includes(k.rarity) ? ' has-rays' : ''} t-${tier}">
    <i class="eg-rays"></i>
    <div class="eg-disc r-${k.rarity}">${petPortrait(kind)}${isNew ? '<b class="eg-new">NEW!</b>' : ''}</div>
    <b class="eg-out-name" style="color:${EGG_HATCH.rarityColor[k.rarity] ?? '#fff'}">${k.name}</b>
    <span class="eg-out-rarity">${tierName}${cap(k.rarity)}</span>
    <span class="eg-out-mult">${formatMult(k.mult * (PETS.tiers[tier]?.mult ?? 1))} Wins</span>
  </div>
</div>`
      })
      .join('')
    const { shake, reveal } = EGG_HATCH.time
    hatchEl.style.setProperty('--shake', `${shake * speed}s`)
    hatchEl.classList.remove('reveal')
    hatchEl.hidden = false
    win.overlay.classList.add('eg-hatching')
    hatch = { phase: 'shake', timer: setTimeout(revealNow, shake * speed * 1000), revealMs: reveal * speed * 1000 }
    // Sound: the eggs rock on the counter, then crack open to a fanfare sized by the rarest pet.
    hatch.best = Math.max(...hatched.map(({ kind }) => Object.keys(EGG_HATCH.rarityColor).indexOf(PETS.kinds[kind].rarity)))
    sfx.eggWobble(shake * speed)
  }
  function revealNow() {
    if (!hatch) return
    clearTimeout(hatch.timer)
    hatch.phase = 'reveal'
    hatchEl.classList.add('reveal')
    replay(flashEl, 'go')
    sfx.eggCrack()
    sfx.reveal(hatch.best)
    burst(...centre(rowEl), hatch.best >= 3 ? 'big' : 'stars')
    hatch.timer = setTimeout(finish, hatch.revealMs)
  }
  // The overlay is over: Auto goes again a moment later while the window stays on that egg.
  function finish() {
    if (!hatch) return
    clearTimeout(hatch.timer)
    hatch = null
    hatchEl.hidden = true
    win.overlay.classList.remove('eg-hatching')
    paint()
    if (!auto || !spot) return
    const again = spot
    autoTimer = setTimeout(() => {
      if (auto && spot === again && !go(lastCount, autoBtn)) setAuto(false)
    }, EGG_HATCH.autoDelay * 1000)
  }
  function skip() {
    if (hatch?.phase === 'shake') revealNow()
    else finish()
  }

  // E / R / T while the window is open, before input.js sees them.
  window.addEventListener(
    'keydown',
    (e) => {
      const act = KEYS[e.code]
      if (!act || !win.isOpen() || e.target instanceof HTMLInputElement) return
      e.stopImmediatePropagation()
      e.preventDefault()
      if (e.repeat) return
      if (act === 'auto') toggleAuto()
      else if (hatch) {
        if (act === 'one') skip()
      } else go(act === 'one' ? 1 : EGG_HATCH.openMany, act === 'one' ? oneBtn : manyBtn)
    },
    true,
  )

  return {
    spots, // dev: __game.eggs.open(__game.eggs.spots[0])
    isOpen: win.isOpen,
    // The saved part (net.js; backend sanitize.ts) and a save loaded from the server.
    snapshot: () => ({ eggsSeen: [...seen] }),
    hydrate(doc) {
      seen.clear()
      if (Array.isArray(doc.eggsSeen)) for (const kind of doc.eggsSeen) if (PETS.kinds[kind]) seen.add(kind)
    },
    get hatching() {
      return !!hatch
    },
    // Hatches `n` of `egg` for free (the Daily Reward's Axolotl Egg) with the usual overlay.
    // False when pet storage can't take them; a hatch still playing is skipped to its end.
    hatchFree(egg, n) {
      if (petsState.pets.length + n > petsState.storage) return false
      if (hatch) finish()
      play(roll(egg, n), egg, 1)
      return true
    },
    // Opens the window on a stall egg spot ({ egg, x, y, z } from shops.spots.eggs).
    open(s) {
      show(s)
      win.open()
    },
    close: win.close,
    // pos: the player's feet, or null while racing / in the Trails scene (closes the window).
    update(pos) {
      if (!win.isOpen()) return
      if (!pos) return win.close()
      if (hatch) return
      let near = null
      let best = INTERACT.radius.egg
      for (const s of spots) {
        const d = Math.hypot(pos.x - s.x, pos.z - s.z)
        if (d < best) {
          best = d
          near = s
        }
      }
      if (near && near !== spot) show(near)
      else if (!near && Math.hypot(pos.x - spot.x, pos.z - spot.z) > EGG_HATCH.closeRange) win.close()
      else paint() // Wins may have changed (training, gifts)
    },
  }
}
