// Engine window (the reference's "Engine!" popup) on the shared window shell
// (uiWindow.js). Left: a blue panel with the selected engine's name and preview
// card in its card colour, the owned count, its boosts and one action button
// (Equip / Unequip, or a blue Wins-price button for a locked engine). Right: a
// scrolling 4-column grid of engine cards: the three gem engines (red, NEW), the
// Basic Engine, then the 30-engine ladder, one card colour per row of 4; locked
// cards show a padlock and their Wins price, the equipped one a green check.
// Only the Basic Engine is free; everything else is bought with Wins (the HUD's
// trophy counter). Tap a card to select it. The catalog is ENGINE in config.js;
// owned/equipped state is saved by the server (snapshot / hydrate, net.js). The
// HUD's Engine tile and the E key open it (main.js).
import './engine.css'
import { ENGINE } from './config.js'
import { ICONS as HUD_ICONS } from './hudIcons.js'
import { createWindow, replay, uiButton } from './uiWindow.js'

const INK = '#1d1a22'
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`

// Title badge: a white rocket with a red nose + fins and a blue porthole, nose up-right.
export const ENGINE_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(42 50 50)" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
  <path d="M38 78 Q50 104 62 78 Z" fill="#ffb31a"/><path d="M44 78 Q50 94 56 78 Z" fill="#fff36a" stroke="none"/>
  <path d="M34 56 L18 76 L36 76 Z M66 56 L82 76 L64 76 Z" fill="#ff3b3b"/>
  <path d="M50 4 Q70 22 66 78 H34 Q30 22 50 4 Z" fill="#f4f7fb"/>
  <path d="M50 4 Q61 13 64 28 H36 Q39 13 50 4 Z" fill="#ff3b3b"/>
  <circle cx="50" cy="46" r="9" fill="#3aa6ff"/>
  <path d="M46 70 H54" stroke="#ff3b3b" stroke-width="6"/></g>
  <circle cx="45" cy="42" r="3" fill="#fff" transform="rotate(42 50 50)"/>
</svg>`

const ICONS = {
  lock: `<svg viewBox="0 0 100 110" aria-hidden="true">
    <path d="M28 52V36a22 22 0 0 1 44 0v16" fill="none" stroke="${INK}" stroke-width="20"/>
    <path d="M28 52V36a22 22 0 0 1 44 0v16" fill="none" stroke="#3a3744" stroke-width="10"/>
    <rect x="12" y="46" width="76" height="58" rx="10" fill="#ffc21a" stroke="${INK}" stroke-width="7"/>
    <rect x="20" y="53" width="60" height="12" rx="5" fill="#ffe27a"/>
    <path d="M14 90 H86 V96 a8 8 0 0 1 -8 8 H22 a8 8 0 0 1 -8 -8 Z" fill="#e89a00"/>
    <circle cx="50" cy="74" r="8" fill="${INK}"/><path d="M50 76v14" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  </svg>`,
  check: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#2fc74a" stroke="#fff" stroke-width="8"/>
    <path d="M29 51l14 14 29-30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

// --- Engine art ----------------------------------------------------------------------
// Drawn nose-up in a 100x120 box, then tilted so the nose points up-left and the
// exhaust trails down-right, like the reference's cards.
function flame(color, x = 50, y = 80, w = 13) {
  return `<g opacity="0.85">
    <path d="M${x - w} ${y} Q${x - w - 8} ${y + 22} ${x - 4} ${y + 40} Q${x} ${y + 26} ${x - w * 0.3} ${y}Z" fill="${color}"/>
    <path d="M${x + w} ${y} Q${x + w + 8} ${y + 22} ${x + 4} ${y + 40} Q${x} ${y + 26} ${x + w * 0.3} ${y}Z" fill="${color}"/>
    <path d="M${x - w * 0.6} ${y} Q${x} ${y + 52} ${x + w * 0.6} ${y}Z" fill="${color}"/>
    <path d="M${x - w * 0.3} ${y} Q${x} ${y + 30} ${x + w * 0.3} ${y}Z" fill="#fff" opacity="0.8"/>
  </g>`
}

const ART = {
  rocket: (l) => `${flame(l.flame)}
    <path d="M38 54 L22 76 L38 74 Z M62 54 L78 76 L62 74 Z" fill="${l.fin}" ${O}/>
    <path d="M41 74 H59 L63 81 H37 Z" fill="#3c3f48" ${O}/>
    <rect x="37" y="26" width="26" height="50" rx="4" fill="${l.body}" ${O}/>
    ${l.camo ? `<g fill="${l.fin}" opacity="0.9"><ellipse cx="44" cy="40" rx="5" ry="7"/><ellipse cx="56" cy="58" rx="5" ry="6"/><ellipse cx="45" cy="66" rx="4" ry="4"/></g>
      <g fill="${l.band}"><ellipse cx="56" cy="34" rx="4" ry="5"/><ellipse cx="44" cy="54" rx="4" ry="4"/></g>` : ''}
    <rect x="37" y="34" width="26" height="8" fill="${l.band}" ${O}/>
    <rect x="37" y="56" width="26" height="8" fill="${l.band}" ${O}/>
    <path d="M37 28 Q37 9 50 2 Q63 9 63 28 Z" fill="${l.nose}" ${O}/>
    <rect x="41" y="28" width="4.5" height="44" rx="2" fill="#fff" opacity="0.35"/>
    <path d="M43 22 Q44 12 50 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`,
  missile: (l) => `${flame(l.flame, 50, 88, 9)}
    <path d="M43 70 L30 90 L43 86 Z M57 70 L70 90 L57 86 Z" fill="${l.fin}" ${O}/>
    <path d="M44 30 L36 40 L44 40 Z M56 30 L64 40 L56 40 Z" fill="${l.fin}" ${O}/>
    <rect x="43" y="16" width="14" height="72" rx="3" fill="${l.body}" ${O}/>
    <rect x="43" y="46" width="14" height="6" fill="${l.band}" ${O}/>
    ${l.checker ? `<path d="M43 56h7v7h-7zM50 63h7v7h-7zM43 70h7v7h-7zM50 77h7v7h-7z" fill="${l.band}"/>` : ''}
    <path d="M43 18 Q43 4 50 0 Q57 4 57 18 Z" fill="${l.nose}" ${O}/>
    <path d="M50 70 V96" stroke="${l.fin}" stroke-width="3" ${O}/>
    <rect x="46" y="20" width="3" height="64" rx="1.5" fill="#fff" opacity="0.35"/>`,
  jet: (l) => `${flame(l.flame, 50, 92, 8)}
    <path d="M50 22 L94 82 L58 78 Z M50 22 L6 82 L42 78 Z" fill="${l.fin}" ${O}/>
    <path d="M55 72 L72 98 L55 92 Z M45 72 L28 98 L45 92 Z" fill="${l.band}" ${O}/>
    <path d="M50 0 Q60 20 60 50 L58 92 H42 L40 50 Q40 20 50 0 Z" fill="${l.body}" ${O}/>
    <path d="M50 14 Q55 22 55 34 H45 Q45 22 50 14 Z" fill="#ff8a3a" ${O}/>
    <path d="M30 66 L50 40 M70 66 L50 40" stroke="${l.band}" stroke-width="2.5" fill="none"/>`,
  // A white starfighter: X wings with red tips, dark nose, twin blue exhausts.
  ship: (l) => `${flame(l.flame, 40, 86, 6)}${flame(l.flame, 60, 86, 6)}
    <path d="M44 52 L8 34 L6 42 L42 66 Z M56 52 L92 34 L94 42 L58 66 Z" fill="${l.body}" ${O}/>
    <path d="M44 62 L10 80 L14 86 L44 72 Z M56 62 L90 80 L86 86 L56 72 Z" fill="${l.body}" ${O}/>
    <path d="M8 34 L6 42 L16 47 L18 39 Z M92 34 L94 42 L84 47 L82 39 Z M10 80 L14 86 L22 81 L19 76 Z M90 80 L86 86 L78 81 L81 76 Z" fill="${l.fin}" ${O}/>
    <rect x="35" y="54" width="10" height="32" rx="3" fill="${l.band}" ${O}/>
    <rect x="55" y="54" width="10" height="32" rx="3" fill="${l.band}" ${O}/>
    <path d="M50 2 Q60 22 60 50 L58 86 H42 L40 50 Q40 22 50 2 Z" fill="${l.body}" ${O}/>
    <path d="M50 2 Q55 10 57 20 H43 Q45 10 50 2 Z" fill="${l.nose}" ${O}/>
    <path d="M50 26 Q55 32 55 42 H45 Q45 32 50 26 Z" fill="${l.band}" ${O}/>
    <path d="M44 60 H56 M44 70 H56" stroke="${l.fin}" stroke-width="3"/>`,
  // A satellite: a striped core, a dish on top and two long solar panels.
  satellite: (l) => {
    const panel = (x) => `<rect x="${x}" y="40" width="34" height="18" fill="${l.fin}" ${O}/>
      <path d="M${x + 8.5} 40v18M${x + 17} 40v18M${x + 25.5} 40v18M${x} 49h34" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>`
    return `${flame(l.flame, 50, 82, 8)}
    ${panel(-4)}${panel(70)}
    <path d="M30 49 H70" stroke="${INK}" stroke-width="5"/>
    <rect x="36" y="24" width="28" height="56" rx="8" fill="${l.body}" ${O}/>
    <path d="M36 40 H64 M36 62 H64" stroke="${l.band}" stroke-width="7"/>
    <rect x="36" y="24" width="28" height="56" rx="8" fill="none" ${O}/>
    <path d="M50 24 V14" stroke="${INK}" stroke-width="3"/>
    <path d="M36 14 Q50 -2 64 14 Z" fill="${l.nose}" ${O}/>
    <rect x="40" y="28" width="4" height="48" rx="2" fill="#fff" opacity="0.35"/>`
  },
}

function engineArt(look) {
  const l = { flame: '#ff9b2e', ...look }
  return `<svg viewBox="-12 -8 124 136" aria-hidden="true"><g transform="rotate(-32 50 60)">${ART[l.kind ?? 'rocket'](l)}</g></svg>`
}

// --- Catalog ---------------------------------------------------------------------------
// Rounds to 2 significant digits: 12500 -> 13000, 325000 -> 330000.
function sig2(n) {
  const p = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / p) * p
}

// A gem engine's Wins price: what a ladder engine with the same Wins boost would
// cost. Ladder engine k boosts wins by winsStep*(k+1) % and costs
// firstPrice*priceGrowth^(k-1), so price(w) = firstPrice*priceGrowth^(w/winsStep - 2).
function gemPrice(wins) {
  const { firstPrice, priceGrowth, winsStep } = ENGINE.ladder
  return sig2(firstPrice * priceGrowth ** (wins / winsStep - 2))
}

function buildCatalog() {
  const { starter, gems, gemTier, ladder } = ENGINE
  const list = gems.map((e) => ({ ...e, price: e.price ?? gemPrice(e.stats.wins), isNew: true, tier: gemTier }))
  list.push({ ...starter, price: 0, tier: ladder.tiers[0] })
  let price = ladder.firstPrice
  ladder.engines.forEach((e, i) => {
    const wins = ladder.winsStep * (i + 2)
    list.push({
      id: `ladder-${i}`,
      name: e.name,
      price,
      stats: { wins, acc: wins * 2, train: wins },
      look: { kind: 'rocket', ...e.look },
      tier: ladder.tiers[Math.min(Math.floor(i / 4), ladder.tiers.length - 1)],
    })
    price = sig2(price * ladder.priceGrowth)
  })
  return list
}

export const ENGINES = buildCatalog()
const byId = new Map(ENGINES.map((e) => [e.id, e]))

export const engineState = { owned: [ENGINE.starter.id], equipped: ENGINE.starter.id }

// The equipped engine's % boosts ({ wins, acc, train }), all 0 with none equipped.
export function engineBoost() {
  return byId.get(engineState.equipped)?.stats ?? { wins: 0, acc: 0, train: 0 }
}

// 950 -> "950", 2500 -> "2.5K", 24e21 -> "24Sx" (the reference's short style).
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']
function short(n) {
  n = Math.floor(n)
  let i = 0
  while (Math.abs(n) >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  if (i === 0) return String(n)
  // The epsilon undoes float drift from the divisions (3.6e28 -> 35.99999...).
  return `${n >= 100 ? Math.floor(n + 1e-6) : Math.floor(n * 10 + 1e-6) / 10}${SUFFIXES[i]}`
}

// The saved part (net.js; backend sanitize.ts): { engines: owned ids, engine: the equipped one, '' = none }.
export const snapshot = () => ({ engines: [...engineState.owned], engine: engineState.equipped ?? '' })

// A loaded save over a fresh start (the Basic Engine always owned, unknown ids dropped).
function applySave(s) {
  engineState.owned = [...new Set([ENGINE.starter.id, ...(Array.isArray(s.engines) ? s.engines.filter((id) => byId.has(id)) : [])])]
  engineState.equipped = ENGINE.starter.id
  if (s.engine === '') engineState.equipped = null
  else if (engineState.owned.includes(s.engine)) engineState.equipped = s.engine
}

const SIDE = `
  <div class="en-side">
    <div class="en-name uiw-text"></div>
    <div class="en-preview"><span class="en-art"></span><span class="en-count uiw-text"></span></div>
    <div class="en-stats">
      <div class="uiw-text" data-en="wins"></div>
      <div class="uiw-text" data-en="acc"></div>
      <div class="uiw-text" data-en="train"></div>
    </div>
  </div>
  <div class="en-grid" role="listbox" aria-label="Engines"></div>`

// wins: { get(), set(n) } for the Wins total (the HUD's trophy counter).
// Returns { open, close, toggle, isOpen, boost, item, acquire, nextUpgrade, snapshot, hydrate }.
export function createEngine({ wins } = {}) {
  let selected = engineState.equipped ?? ENGINE.starter.id

  const win = createWindow({ title: 'Engine!', icon: ENGINE_ICON, className: 'en-window', onOpen: () => render() })
  win.body.innerHTML = SIDE
  const side = win.body.querySelector('.en-side')
  const nameEl = side.querySelector('.en-name')
  const previewArt = side.querySelector('.en-art')
  const countEl = side.querySelector('.en-count')
  const field = {}
  for (const el of side.querySelectorAll('[data-en]')) field[el.dataset.en] = el
  const action = uiButton('Equip', 'green', onAction, 'en-action')
  side.append(action)
  const grid = win.body.querySelector('.en-grid')

  // One card per engine; art is built once, state classes flip in render().
  const cards = new Map()
  for (const e of ENGINES) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'en-card'
    card.style.setProperty('--tier', e.tier)
    card.setAttribute('role', 'option')
    card.setAttribute('aria-label', e.name)
    card.innerHTML =
      `<span class="en-art">${engineArt(e.look)}</span>` +
      `<span class="en-lock">${ICONS.lock}</span>` +
      (e.price ? `<span class="en-price"><span class="en-price-num uiw-text">${short(e.price)}</span><span class="en-price-icon">${HUD_ICONS.trophy}</span></span>` : '') +
      (e.isNew ? '<span class="en-new uiw-text">NEW</span>' : '') +
      `<span class="en-check">${ICONS.check}</span>`
    card.addEventListener('click', () => {
      selected = e.id
      render()
    })
    grid.append(card)
    cards.set(e.id, card)
  }

  const owns = (id) => engineState.owned.includes(id)

  // color: 'green' | 'yellow' | 'blue' (the price button).
  function setAction(html, color) {
    action.innerHTML = html
    action.classList.remove('green', 'red', 'yellow', 'blue')
    action.classList.add(color)
  }

  function render() {
    const e = byId.get(selected)
    const equipped = engineState.equipped === e.id
    side.style.setProperty('--tier', e.tier)
    side.classList.toggle('current', equipped) // the equipped engine's boosts show green
    nameEl.textContent = e.name
    nameEl.style.setProperty('--len', String(e.name.length))
    previewArt.innerHTML = engineArt(e.look)
    countEl.textContent = owns(e.id) ? '1/1' : '0/1'
    field.wins.textContent = `+${short(e.stats.wins)}% Wins`
    field.acc.textContent = `+${short(e.stats.acc)}% Acc`
    field.train.textContent = `+${short(e.stats.train)}% Train`
    if (equipped) setAction('Unequip', 'yellow')
    else if (owns(e.id)) setAction('Equip', 'green')
    else setAction(`<span class="en-action-icon">${HUD_ICONS.trophy}</span><span class="en-action-price">${short(e.price)}</span>`, 'blue')
    for (const [id, card] of cards) {
      card.classList.toggle('locked', !owns(id))
      card.classList.toggle('equipped', engineState.equipped === id)
      card.setAttribute('aria-selected', String(selected === id))
    }
  }

  function onAction() {
    const e = byId.get(selected)
    const card = cards.get(e.id)
    if (engineState.equipped === e.id) {
      engineState.equipped = null
    } else if (owns(e.id)) {
      engineState.equipped = e.id
    } else {
      const have = wins?.get() ?? 0
      if (have < e.price) {
        replay(action, 'shake')
        replay(card.querySelector('.en-price'), 'shake')
        return
      }
      wins.set(have - e.price)
      engineState.owned.push(e.id)
      engineState.equipped = e.id
    }
    render()
    replay(card, 'bump')
  }

  // Buys `id` if needed and equips it (unless equip is false), without the window
  // (the Engine Upgrade machine and the rocket pads).
  // Returns { done: 'bought' | 'equipped' | 'already' } or { need: Wins short }.
  function acquire(id, equip = true) {
    const e = byId.get(id)
    if (engineState.equipped === id) return { done: 'already' }
    let done = 'equipped'
    if (!owns(id)) {
      const have = wins?.get() ?? 0
      if (have < e.price) return { need: e.price - have }
      wins.set(have - e.price)
      engineState.owned.push(id)
      done = 'bought'
    }
    if (equip) engineState.equipped = id
    render()
    return { done }
  }

  const item = (id) => {
    const e = byId.get(id)
    return { name: e.name, price: e.price, owned: owns(id), equipped: engineState.equipped === id, stats: e.stats }
  }

  // The ladder engine one past the best one owned (the Engine Upgrade machine's offer), null at the top.
  function nextUpgrade() {
    const ladder = ENGINES.filter((e) => e.id === ENGINE.starter.id || e.id.startsWith('ladder-'))
    let best = 0
    ladder.forEach((e, i) => owns(e.id) && (best = i))
    return ladder[best + 1]?.id ?? null
  }

  // A save loaded from the server (net.js).
  function hydrate(doc) {
    applySave(doc)
    selected = engineState.equipped ?? ENGINE.starter.id
    render()
  }

  render()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, boost: engineBoost, item, acquire, nextUpgrade, snapshot, hydrate }
}
