// Partner window (the reference's "Partner!" popup) on the shared window shell
// (uiWindow.js), laid out like the Engine window. Left: a blue panel with the
// selected partner's name (in its tint), a big portrait, its boosts and one
// action button (Wins price / Equip / Unequip). Right: a scrolling 4-column grid
// of round portrait cards: the premium row (red NEW ribbon), then the ladder;
// locked cards show a padlock and their price, the equipped one a green check.
// Nothing is free: every partner is bought with Wins (the HUD's trophy counter).
// Tap a card to select it. The catalog is PARTNER in config.js; owned/equipped
// state is saved by the server (snapshot / hydrate, net.js). The HUD's Partner tile
// and the T key open it (main.js).
import './partner.css'
import { PARTNER } from './config.js'
import { ICONS as HUD_ICONS } from './hudIcons.js'
import { createWindow, replay, uiButton } from './uiWindow.js'

const INK = '#1d1a22'
const O = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`

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

// --- Portraits -----------------------------------------------------------------------
// A blocky Roblox-style figure (head, torso, arms, legs) standing in a dark disc:
// the body is clipped to the disc, the head rises above its top edge. viewBox
// 0 0 100 116, disc centre (50, 63), radius 46.5. Pieces are picked by `look`.

// Hair / headwear drawn behind the head (pigtails, hood, cowl ears).
function behindHead(l) {
  if (l.hair === 'pigtails')
    return `<g ${O}>
      <path d="M33 18 Q20 22 21 40 Q24 48 30 44 Q28 30 35 24 Z" fill="${l.hairColor}"/>
      <path d="M67 18 Q80 22 79 40 Q76 48 70 44 Q72 30 65 24 Z" fill="${l.hairColor}"/>
      <path d="M21.5 36 Q24 48 30 44 Q28.5 39 29 34 Z" fill="${l.tipA}"/>
      <path d="M78.5 36 Q76 48 70 44 Q71.5 39 71 34 Z" fill="${l.tipB}"/></g>`
  if (l.hat === 'mask' || l.hat === 'hood') return `<rect x="31" y="6" width="38" height="38" rx="10" fill="${l.hood ?? l.hatColor}" ${O}/>`
  if (l.hat === 'cowl')
    return `<path d="M36 14 L37 1 L44 11 Z M64 14 L63 1 L56 11 Z" fill="${l.hatColor}" ${O}/>`
  return ''
}

function face(l) {
  const eyes = `<ellipse cx="44" cy="25" rx="2" ry="3" fill="${INK}"/><ellipse cx="56" cy="25" rx="2" ry="3" fill="${INK}"/>`
  const smile = `<path d="M44 32 Q50 37 56 32" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
  if (l.face === 'clown')
    return `<path d="M41 22 L47 27 M47 22 L41 27" stroke="#4a5cff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>${eyes}
      <circle cx="40" cy="31" r="2.6" fill="#ff3b4f"/><circle cx="60" cy="31" r="2.6" fill="#ff3b4f"/>
      <path d="M44 32 Q50 38 56 32 Q50 35 44 32 Z" fill="#e3263a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`
  if (l.face === 'shades')
    return `<path d="M37 22 H63 V25 Q62 30 56.5 30 Q52 30 51 25 H49 Q48 30 43.5 30 Q38 30 37 25 Z" fill="${INK}"/>
      <path d="M40 24 h5" stroke="#6b7cff" stroke-width="1.5" stroke-linecap="round"/>${smile}`
  if (l.face === 'code')
    return `<rect x="40" y="22" width="7" height="4" fill="#3dff5a"/><rect x="53" y="22" width="7" height="4" fill="#3dff5a"/>
      <path d="M44 33 H56" stroke="#3dff5a" stroke-width="2" stroke-linecap="round"/>`
  if (l.face === 'goggles')
    return `<rect x="34" y="20" width="32" height="4" fill="#1d1d23"/><rect x="38" y="19" width="10" height="9" rx="3" fill="#8fe3ff" ${O}/>
      <rect x="52" y="19" width="10" height="9" rx="3" fill="#8fe3ff" ${O}/>${smile}`
  return eyes + smile
}

// Hair / headwear drawn over the head.
function overHead(l) {
  const c = l.hatColor
  switch (l.hat) {
    case 'cowl':
      return `<path d="M35 17 Q35 10 42 10 H58 Q65 10 65 17 V29 H35 Z" fill="${c}" ${O}/>
        <path d="M40 22 L47 24 L40 26 Z M60 22 L53 24 L60 26 Z" fill="#fff"/>`
    case 'balaclava':
    case 'hood':
      return `<path d="M35 17 Q35 10 42 10 H58 Q65 10 65 17 V33 Q65 40 58 40 H42 Q35 40 35 33 Z" fill="${c}" ${O}/>
        <rect x="38" y="20" width="24" height="9" rx="3" fill="${l.skin ?? '#f1c9a5'}" ${O}/>
        <ellipse cx="44" cy="24.5" rx="2" ry="2.6" fill="${INK}"/><ellipse cx="56" cy="24.5" rx="2" ry="2.6" fill="${INK}"/>`
    case 'mask':
      return `<rect x="35" y="10" width="30" height="30" rx="7" fill="${c}" ${O}/>
        <circle cx="50" cy="25" r="7" fill="none" stroke="#f4f4f4" stroke-width="2.6"/>`
    case 'police':
      return `<path d="M33 16 Q34 6 50 6 Q66 6 67 16 Z" fill="${c}" ${O}/><rect x="33" y="14" width="34" height="5" rx="1.5" fill="#111" ${O}/>
        <path d="M50 8 L53 11 L50 14 L47 11 Z" fill="#ffd23a" ${O}/>`
    case 'cap':
      return `<path d="M34 18 Q34 6 50 6 Q66 6 66 18 Z" fill="${c}" ${O}/><path d="M48 16 H74 Q74 21 66 21 H48 Z" fill="${c}" ${O}/>`
    case 'hardhat':
      return `<path d="M35 17 Q35 4 50 4 Q65 4 65 17 Z" fill="${c}" ${O}/><rect x="31" y="15" width="38" height="5" rx="2.5" fill="${c}" ${O}/>
        <path d="M48 5 V15" stroke="#fff" stroke-width="2" opacity=".5"/>`
    case 'helmet':
      return `<path d="M33 20 Q33 4 50 4 Q67 4 67 20 Z" fill="${c}" ${O}/><g fill="#26401c" opacity=".7"><circle cx="43" cy="11" r="2.5"/><circle cx="57" cy="14" r="3"/></g>`
    case 'fedora':
      return `<path d="M27 19 Q50 13 73 19 L70 22 Q50 17 30 22 Z" fill="${c}" ${O}/><path d="M36 17 L38 4 Q50 1 62 4 L64 17 Q50 14 36 17 Z" fill="${c}" ${O}/>
        <path d="M37 14 Q50 11 63 14" fill="none" stroke="#3dff5a" stroke-width="2.4"/>`
    case 'fire':
      return `<path d="M34 18 Q34 4 50 4 Q66 4 66 18 Z" fill="${c}" ${O}/><path d="M28 17 H72 L70 21 H30 Z" fill="${c}" ${O}/>
        <path d="M46 6 H54 V14 H46 Z" fill="#ffd23a" ${O}/>`
  }
  switch (l.hair) {
    case 'short':
      return `<path d="M34 20 Q33 8 45 8 H56 Q67 8 66 20 L63 15 Q55 13 46 14 L38 15 Z" fill="${l.hairColor}" ${O}/>`
    case 'swept':
      return `<path d="M34 22 Q31 6 48 6 Q62 5 67 13 L66 21 Q60 13 50 14 L38 15 Z" fill="${l.hairColor}" ${O}/>`
    case 'pigtails':
      return `<path d="M34 20 Q34 8 50 8 Q66 8 66 20 Q60 13 52 14 L50 17 L47 14 Q40 13 34 20 Z" fill="${l.hairColor}" ${O}/>`
  }
  return ''
}

// Pattern drawn on the torso (x 30..70, y 40..94).
function torso(l) {
  const c2 = l.color2
  switch (l.shirt) {
    case 'stripes':
      return `<g fill="${c2}"><rect x="30" y="47" width="40" height="5"/><rect x="30" y="58" width="40" height="5"/><rect x="30" y="69" width="40" height="5"/></g>
        <g fill="#1f2a6b"><rect x="30" y="52" width="40" height="2"/><rect x="30" y="63" width="40" height="2"/></g>
        <rect x="30" y="80" width="40" height="5" fill="#1d1d23"/><rect x="46" y="80" width="8" height="5" fill="#cfd3da"/>`
    case 'jumpsuit':
      return `<path d="M42 40 L50 50 L58 40 Z" fill="${c2}" ${O}/><rect x="55" y="54" width="9" height="7" rx="1" fill="none" stroke="#c4600a" stroke-width="1.6"/>
        <path d="M50 50 V94" stroke="#c4600a" stroke-width="1.6"/>`
    case 'police':
      return `<path d="M44 40 L50 46 L56 40 Z" fill="#cfe0ff" ${O}/><path d="M49 46 H51 L52 66 L50 69 L48 66 Z" fill="#1d2c5e"/>
        <path d="M60 50 L62 54 L66 54 L63 57 L64 61 L60 59 L56 61 L57 57 L54 54 L58 54 Z" fill="${c2}" ${O}/>
        <rect x="30" y="80" width="40" height="5" fill="#1d1d23"/>`
    case 'emblem':
      return `<rect x="30" y="80" width="40" height="5" fill="${c2}"/><ellipse cx="50" cy="55" rx="11" ry="6" fill="${c2}" ${O}/>
        <path d="M41 55 Q44 51 46 53 L48 51 L50 53 L52 51 L54 53 Q56 51 59 55 Q55 54 54 58 Q51 56 50 59 Q49 56 46 58 Q45 54 41 55 Z" fill="${INK}"/>`
    case 'armor':
      return `<path d="M34 46 H66 M34 60 H66 M50 46 V60" stroke="${c2}" stroke-width="2"/><path d="M40 70 L50 78 L60 70" fill="none" stroke="${c2}" stroke-width="2"/>
        <path d="M44 52 L50 49 L56 52 L50 55 Z" fill="#8a8a95"/>`
    case 'bands':
      return `<g fill="${c2}"><rect x="30" y="56" width="40" height="5"/><rect x="30" y="72" width="40" height="5"/></g>`
    case 'hoodie':
      return `<path d="M40 40 Q50 50 60 40" fill="none" stroke="${c2}" stroke-width="3"/><path d="M46 44 V54 M54 44 V54" stroke="#cfd3da" stroke-width="1.5"/>
        <path d="M37 70 H63 L60 82 H40 Z" fill="${c2}" ${O}/>`
    case 'vest':
      return `<path d="M30 40 H42 L46 94 H30 Z M70 40 H58 L54 94 H70 Z" fill="${c2}" ${O}/>
        <g fill="#e8eef5"><rect x="30" y="64" width="15" height="4"/><rect x="55" y="64" width="15" height="4"/></g>`
    case 'jacket':
      return `<path d="M44 40 H56 L54 94 H46 Z" fill="#f4f4f4"/><path d="M48 42 H52 L53 72 L50 76 L47 72 Z" fill="${c2}"/>
        <path d="M44 40 L48 54 L46 94 M56 40 L52 54 L54 94" fill="none" stroke="${INK}" stroke-width="1.6"/>`
    case 'suit':
      return `<path d="M50 40 V94" stroke="${c2}" stroke-width="3"/><rect x="30" y="80" width="40" height="4" fill="${c2}"/>`
    case 'camo':
      return `<g fill="${c2}"><ellipse cx="38" cy="50" rx="6" ry="4"/><ellipse cx="60" cy="58" rx="7" ry="4"/><ellipse cx="44" cy="72" rx="6" ry="5"/><ellipse cx="62" cy="84" rx="5" ry="4"/></g>
        <g fill="#3d4046" opacity=".55"><ellipse cx="54" cy="46" rx="4" ry="3"/><ellipse cx="36" cy="64" rx="4" ry="3"/><ellipse cx="56" cy="74" rx="4" ry="3"/></g>`
    case 'ninja':
      return `<path d="M30 40 L58 94 H66 L38 40 Z" fill="#2a2a31"/><rect x="30" y="74" width="40" height="5" fill="${c2}"/>`
    case 'hero':
      return `<path d="M40 48 H60 L63 53 L50 68 L37 53 Z" fill="#ffd23a" ${O}/><path d="M45 52 H55 Q46 55 54 58 Q50 62 46 60" fill="none" stroke="${c2}" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="30" y="80" width="40" height="5" fill="#ffd23a"/>`
    case 'labcoat':
      return `<path d="M43 40 L50 62 L57 40 Z" fill="${c2}" ${O}/><path d="M48 44 H52 L53 58 L50 62 L47 58 Z" fill="#3a3f4a"/>
        <path d="M43 40 L47 58 L50 94 M57 40 L53 58" fill="none" stroke="#b9c0c8" stroke-width="1.8"/>
        <rect x="56" y="64" width="9" height="8" rx="1" fill="none" stroke="#b9c0c8" stroke-width="1.6"/><path d="M59 66 V61" stroke="#3a7bd5" stroke-width="2" stroke-linecap="round"/>`
    case 'code':
      return codeMarks(c2, 33, 44, 34, 46)
  }
  return ''
}

// Green "falling code" dashes over a box (Glitch).
function codeMarks(c, x, y, w, h) {
  let out = ''
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 3; j++) {
      const dx = x + ((i * 5.3) % w)
      const dy = y + ((i * 13 + j * 17) % h)
      out += `<rect x="${dx.toFixed(1)}" y="${dy.toFixed(1)}" width="1.8" height="${3 + ((i + j) % 3) * 2}" fill="${c}" opacity="${0.55 + ((i * j) % 3) * 0.2}"/>`
    }
  return out
}

// Arms by the sides, or raised beside the head (armsUp: the Superhero pose).
function arms(l, fill) {
  if (l.armsUp)
    return `<rect x="17" y="8" width="13" height="40" rx="4" fill="${fill}" ${O} transform="rotate(-12 23 44)"/>
      <rect x="70" y="8" width="13" height="40" rx="4" fill="${fill}" ${O} transform="rotate(12 77 44)"/>
      <rect x="18" y="8" width="11" height="7" rx="2" fill="${l.skin}" transform="rotate(-12 23 44)"/>
      <rect x="71" y="8" width="11" height="7" rx="2" fill="${l.skin}" transform="rotate(12 77 44)"/>`
  return `<rect x="15" y="41" width="15" height="54" rx="4" fill="${fill}" ${O}/>
      <rect x="70" y="41" width="15" height="54" rx="4" fill="${fill}" ${O}/>
      ${l.shirt === 'stripes' ? `<g fill="${l.color2}"><rect x="16" y="52" width="13" height="5"/><rect x="71" y="52" width="13" height="5"/><rect x="16" y="66" width="13" height="5"/><rect x="71" y="66" width="13" height="5"/></g>` : ''}
      ${l.shirt === 'code' ? codeMarks(l.color2, 17, 46, 11, 44) + codeMarks(l.color2, 72, 48, 11, 42) : ''}
      <rect x="16" y="86" width="13" height="8" rx="2" fill="${l.skin}"/><rect x="71" y="86" width="13" height="8" rx="2" fill="${l.skin}"/>`
}

let clipIds = 0

export function partnerArt(look) {
  const l = { skin: '#f1c9a5', color: '#7a8190', color2: '#4a4f5c', pants: '#2b3550', ...look }
  const id = `pa-clip-${++clipIds}` // unique per svg: duplicate ids break when one copy is hidden
  return `<svg viewBox="0 0 100 116" aria-hidden="true">
    <defs><clipPath id="${id}"><circle cx="50" cy="63" r="45"/><rect width="100" height="63"/></clipPath></defs>
    <circle cx="50" cy="63" r="46.5" fill="#2c303c" stroke="#c9ced8" stroke-width="3"/>
    <g clip-path="url(#${id})">
      ${l.cape ? `<path d="M30 41 H70 L86 116 H14 Z" fill="${l.cape}" ${O}/>` : ''}
      <rect x="30" y="92" width="20" height="26" fill="${l.pants}" ${O}/>
      <rect x="50" y="92" width="20" height="26" fill="${l.pants2 ?? l.pants}" ${O}/>
      ${l.shirt === 'code' ? codeMarks(l.color2, 32, 96, 36, 16) : ''}
      ${arms(l, l.arms ?? l.color)}
      <rect x="30" y="40" width="40" height="54" rx="2" fill="${l.color}" ${O}/>
      ${torso(l)}
      <rect x="30" y="40" width="40" height="54" rx="2" fill="none" ${O}/>
      ${l.bat ? `<path d="M12 104 L26 60" stroke="#6b3d1f" stroke-width="5" stroke-linecap="round"/><path d="M14 98 L26 60" stroke="#9a5a2c" stroke-width="2.2" stroke-linecap="round"/>` : ''}
      ${l.clipboard ? `<g transform="rotate(-14 30 72)"><rect x="17" y="54" width="25" height="32" rx="2" fill="#d8c9a2" ${O}/>
        <rect x="24" y="51" width="11" height="6" rx="1.5" fill="#8a8f99" ${O}/><path d="M21 64 H38 M21 70 H38 M21 76 H33" stroke="#9a8a66" stroke-width="1.6"/></g>` : ''}
      ${behindHead(l)}
      <rect x="35" y="10" width="30" height="30" rx="7" fill="${l.skin}" ${O}/>
      <rect x="39" y="12" width="20" height="4" rx="2" fill="#fff" opacity=".25"/>
      ${l.hat === 'mask' || l.hat === 'balaclava' || l.hat === 'hood' ? '' : face(l)}
      ${overHead(l)}
    </g>
  </svg>`
}

// --- Catalog + state ---------------------------------------------------------------------
const PARTNERS = PARTNER.partners
const byId = new Map(PARTNERS.map((p) => [p.id, p]))

// A new player owns nothing; the first partner has to be bought with Wins too.
export const partnerState = { owned: [], equipped: null }

// The equipped partner's boosts in percent: { wins, luck, acc } (zeros with none).
export function partnerBoost() {
  return { wins: 0, luck: 0, acc: 0, ...byId.get(partnerState.equipped)?.stats }
}

// 950 -> "950", 1234 -> "1.2K", 30000 -> "30K" (the reference's short style).
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
function short(n) {
  n = Math.floor(n)
  let i = 0
  while (Math.abs(n) >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  if (i === 0) return String(n)
  return `${n >= 100 ? Math.floor(n) : Math.floor(n * 10) / 10}${SUFFIXES[i]}`
}

// The saved part (net.js; backend sanitize.ts): { partners: owned ids, partner: the equipped one, '' = none }.
export const snapshot = () => ({ partners: [...partnerState.owned], partner: partnerState.equipped ?? '' })

// A loaded save over a fresh start (owning none; unknown ids dropped).
function applySave(s) {
  partnerState.owned = Array.isArray(s.partners) ? [...new Set(s.partners.filter((id) => byId.has(id)))] : []
  partnerState.equipped = partnerState.owned.includes(s.partner) ? s.partner : null
}

const price = (p) => `<span class="pa-price-num uiw-text">${short(p.price)}</span><span class="pa-price-icon">${HUD_ICONS.trophy}</span>`

const SIDE = `
  <div class="pa-side">
    <div class="pa-name uiw-text"></div>
    <div class="pa-portrait"></div>
    <div class="pa-stats">
      <div class="uiw-text" data-pa="wins"></div>
      <div class="uiw-text" data-pa="luck"></div>
      <div class="uiw-text" data-pa="acc"></div>
    </div>
  </div>
  <div class="pa-grid" role="listbox" aria-label="Partners"></div>`

// wins: { get(), set(n) } for the Wins total (the HUD's trophy counter).
// Returns { open, close, toggle, isOpen, boost, item, acquire, snapshot, hydrate }.
export function createPartner({ wins } = {}) {
  let selected = PARTNER.featured

  const win = createWindow({ title: 'Partner!', icon: HUD_ICONS.partner, className: 'pa-window', onOpen: open })
  win.body.innerHTML = SIDE
  const side = win.body.querySelector('.pa-side')
  const nameEl = side.querySelector('.pa-name')
  const portrait = side.querySelector('.pa-portrait')
  const field = {}
  for (const el of side.querySelectorAll('[data-pa]')) field[el.dataset.pa] = el
  const action = uiButton('', 'blue', onAction, 'pa-action')
  side.append(action)
  const grid = win.body.querySelector('.pa-grid')

  // One card per partner; art is built once, state classes flip in render().
  const cards = new Map()
  for (const p of PARTNERS) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'pa-card'
    card.setAttribute('role', 'option')
    card.setAttribute('aria-label', p.name)
    card.innerHTML =
      `<span class="pa-art">${partnerArt(p.look)}</span>` +
      `<span class="pa-lock">${ICONS.lock}</span>` +
      `<span class="pa-price">${price(p)}</span>` +
      (p.isNew ? '<span class="pa-new"><span class="uiw-text">NEW</span></span>' : '') +
      `<span class="pa-check">${ICONS.check}</span>`
    card.addEventListener('click', () => {
      selected = p.id
      render()
    })
    grid.append(card)
    cards.set(p.id, card)
  }

  const owns = (id) => partnerState.owned.includes(id)

  // Every open shows the featured partner, scrolled to the top like the reference.
  function open() {
    selected = PARTNER.featured
    grid.scrollTop = 0
    render()
  }

  function setAction(html, color) {
    action.innerHTML = html
    action.classList.remove('green', 'yellow', 'blue')
    action.classList.add(color)
  }

  let shown = null // the partner whose portrait is drawn
  function render() {
    const p = byId.get(selected)
    if (shown !== p.id) {
      shown = p.id
      nameEl.textContent = p.name
      nameEl.style.color = p.tint
      portrait.innerHTML = partnerArt(p.look)
      field.wins.textContent = `+${short(p.stats.wins)}% Wins`
      field.luck.textContent = `+${short(p.stats.luck)}% Luck`
      field.acc.textContent = `+${short(p.stats.acc)}% Acc`
    }
    if (partnerState.equipped === p.id) setAction('Unequip', 'yellow')
    else if (owns(p.id)) setAction('Equip', 'green')
    else setAction(`<span class="pa-action-icon">${HUD_ICONS.trophy}</span><span>${short(p.price)}</span>`, 'blue')
    for (const [id, card] of cards) {
      card.classList.toggle('locked', !owns(id))
      card.classList.toggle('equipped', partnerState.equipped === id)
      card.classList.toggle('selected', selected === id)
      card.setAttribute('aria-selected', String(selected === id))
    }
  }

  function onAction() {
    const p = byId.get(selected)
    const card = cards.get(p.id)
    if (partnerState.equipped === p.id) {
      partnerState.equipped = null
    } else if (owns(p.id)) {
      partnerState.equipped = p.id
    } else {
      const have = wins?.get() ?? 0
      if (have < p.price) {
        replay(action, 'shake')
        replay(card.querySelector('.pa-price'), 'shake')
        return
      }
      wins.set(have - p.price)
      partnerState.owned.push(p.id)
      partnerState.equipped = p.id
    }
    render()
    replay(card, 'bump')
  }

  // Buys `id` if needed and equips it, without the window (the hero statues).
  // Returns { done: 'bought' | 'equipped' | 'already' } or { need: Wins short }.
  function acquire(id) {
    const p = byId.get(id)
    if (partnerState.equipped === id) return { done: 'already' }
    let done = 'equipped'
    if (!owns(id)) {
      const have = wins?.get() ?? 0
      if (have < p.price) return { need: p.price - have }
      wins.set(have - p.price)
      partnerState.owned.push(id)
      done = 'bought'
    }
    partnerState.equipped = id
    render()
    return { done }
  }

  const item = (id) => {
    const p = byId.get(id)
    return { name: p.name, price: p.price, owned: owns(id), equipped: partnerState.equipped === id }
  }

  // A save loaded from the server (net.js).
  function hydrate(doc) {
    applySave(doc)
    render()
  }

  render()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, boost: partnerBoost, item, acquire, snapshot, hydrate }
}
