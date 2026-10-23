// Pets window (the reference's "Pets!" popup), built on the same window shell as
// the Rebirth window: title badge with an icon over the top-left corner, red X
// top-right, white body, buttons straddling the bottom edge. The header carries
// the help / lock / delete mode buttons and the equipped (1/3) + storage (1/100)
// counters; the body is the pet grid (equipped first, then strongest); the
// footer is Equip Best / Craft All / Unequip ALL.
// Tap a pet to equip / unequip it. Lock mode: taps lock pets (locked pets are
// never crafted or deleted). Delete mode: taps mark pets, the footer turns into
// Cancel / Delete (n). Craft All turns every PETS.craftCount identical pets into
// one of the next tier. State is saved by the server (snapshot / hydrate, net.js).
// The shell is uiWindow.js (shared with Rebirth / Boats); pets.css only styles the contents.
import { PETS } from './config.js'
import { createWindow, replay, uiButton } from './uiWindow.js'
import './pets.css' // after the shell's CSS
import { sfx } from './audio/index.js'
import { burst, centre } from './juice.js'

const INK = '#1d1a22'
const O = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`

const ICONS = {
  paw: `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="#2c2a33" stroke="${INK}" stroke-width="5">
    <ellipse cx="50" cy="66" rx="22" ry="19"/><ellipse cx="20" cy="44" rx="10" ry="13"/><ellipse cx="38" cy="24" rx="10" ry="13"/>
    <ellipse cx="62" cy="24" rx="10" ry="13"/><ellipse cx="80" cy="44" rx="10" ry="13"/></g>
    <g fill="#55525e"><ellipse cx="44" cy="60" rx="9" ry="6"/><ellipse cx="17" cy="40" rx="4" ry="5"/><ellipse cx="35" cy="20" rx="4" ry="5"/><ellipse cx="59" cy="20" rx="4" ry="5"/><ellipse cx="77" cy="40" rx="4" ry="5"/></g></svg>`,
  help: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M33 36a17 17 0 1 1 25 15c-5 3-8 6-8 12v3" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
    <path d="M33 36a17 17 0 1 1 25 15c-5 3-8 6-8 12v3" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>
    <circle cx="50" cy="84" r="11" fill="#fff" stroke="${INK}" stroke-width="5.5"/></svg>`,
  lock: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M30 46V34a20 20 0 0 1 40 0v12" fill="none" stroke="${INK}" stroke-width="19"/>
    <path d="M30 46V34a20 20 0 0 1 40 0v12" fill="none" stroke="#fff" stroke-width="9"/>
    <rect x="18" y="44" width="64" height="46" rx="8" fill="#ffc72a" stroke="${INK}" stroke-width="6"/>
    <rect x="24" y="50" width="52" height="10" rx="4" fill="#ffe27a"/><path d="M50 62v14" stroke="${INK}" stroke-width="9" stroke-linecap="round"/></svg>`,
  trash: `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
    <path d="M24 30h52l-5 60H29z" fill="#cfd6df"/><rect x="16" y="20" width="68" height="12" rx="5" fill="#e9eef3"/><path d="M40 20v-8h20v8" fill="none"/></g>
    <path d="M40 42v38M50 42v38M60 42v38" stroke="#8a95a3" stroke-width="5" stroke-linecap="round"/></svg>`,
  chest: `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="${INK}" stroke-width="5.5" stroke-linejoin="round">
    <path d="M12 44h76v42H12z" fill="#a8452b"/><path d="M12 44V32a14 14 0 0 1 14-14h48a14 14 0 0 1 14 14v12z" fill="#c4583a"/>
    <path d="M12 44h76" fill="none"/><path d="M28 18v68M72 18v68" fill="none" stroke-width="5"/>
    <rect x="40" y="36" width="20" height="20" rx="3" fill="#ffc72a"/></g><circle cx="50" cy="46" r="3.5" fill="${INK}"/></svg>`,
  plus: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 22v56M22 50h56" stroke="${INK}" stroke-width="26" stroke-linecap="round"/>
    <path d="M50 22v56M22 50h56" stroke="#fff" stroke-width="14" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#2fc74a" stroke="#fff" stroke-width="8"/>
    <path d="M29 51l14 14 29-30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  locked: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#ffb21a" stroke="#fff" stroke-width="8"/>
    <path d="M37 47v-7a13 13 0 0 1 26 0v7" fill="none" stroke="#fff" stroke-width="8"/><rect x="29" y="45" width="42" height="28" rx="5" fill="#fff"/></svg>`,
  mark: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#ff2e3e" stroke="#fff" stroke-width="8"/>
    <path d="M34 34l32 32M66 34L34 66" stroke="#fff" stroke-width="12" stroke-linecap="round"/></svg>`,
}

// --- Pet portraits ------------------------------------------------------------------
// Blocky "simulator" pets: one rounded cube body, big googly eyes and a per-kind
// set of ears / markings. Colours here, stats in config (PETS.kinds).
const LOOKS = {
  dog: { body: '#8b4a2b', dark: '#5a2c18', ears: 'floppy', nose: true },
  cat: { body: '#f2a541', dark: '#c46f1c', ears: 'pointy', inner: '#ffb0c4', whiskers: true },
  bunny: { body: '#f3ecf2', dark: '#d8c6d4', ears: 'long', inner: '#ffb0c4', nose: true },
  bear: { body: '#7a4b2a', dark: '#4e2d16', ears: 'round', muzzle: '#c99a6b', nose: true },
  fox: { body: '#ff7a1a', dark: '#c4500a', ears: 'pointy', inner: '#fff1e2', muzzle: '#fff1e2', nose: true },
  panda: { body: '#f6f6f6', dark: '#24222a', ears: 'round', patches: true, nose: true },
  dragon: { body: '#3fc45a', dark: '#23853a', ears: 'horns', belly: '#c8f27a', nostrils: true },
  // Online Gifts pets (gifts.js): a leafy bark demon and a black one in green fire.
  verdant: { body: '#6b3f22', dark: '#4a2914', wings: 'leaf', tuft: true, cheeks: true, mouth: true },
  greenfire: { body: '#1c2616', dark: '#0e140a', flames: true, glowEyes: true },
  // Daily Reward axolotls (daily.js): frilly gills either side of the head.
  axolotl: { body: '#ffa8d4', dark: '#e872ad', gills: '#ff4f9a', cheeks: true, mouth: true },
  blueAxolotl: { body: '#7fd2ff', dark: '#3d98e0', gills: '#2f6bff', cheeks: true, mouth: true },
  ghostAxolotl: { body: '#2c3a8e', dark: '#1a2463', gills: '#4fe0ff', belly: '#4a5cc4', mouth: true },
  sunAxolotl: { body: '#ffc21a', dark: '#e88a00', gills: '#ff4a1a', belly: '#fff07a', cheeks: true, mouth: true },
  // Spin wheel jackpot (spin.js): a ruby demon with dark bat wings.
  hugeDemon: { body: '#ff2a36', dark: '#9a1218', wings: 'bat', ears: 'horns', belly: '#ff8a90', mouth: true },
}

// The left half of a symmetric part plus its mirror image.
const mirrored = (s) => `${s}<g transform="matrix(-1 0 0 1 100 0)">${s}</g>`

const LEAF_WING = `<path d="M22 50 L3 20 L9 36 L0 42 L9 50 L1 60 L12 62 L20 70 Z" fill="#3fbf3a" ${O}/>
  <path d="M19 54 L7 30 M15 55 L5 46 M16 61 L7 59" fill="none" stroke="#237a1f" stroke-width="2.5" stroke-linecap="round"/>`
const BAT_WING = `<path d="M26 46 C16 30 6 24 0 16 C2 30 0 40 4 50 C8 46 12 48 12 54 C16 50 20 54 20 60 L28 58 Z" fill="#8a0f1a" ${O}/>
  <path d="M24 48 L5 24 M18 52 L4 40" fill="none" stroke="#5a0610" stroke-width="2.5" stroke-linecap="round"/>`
const GLOW_EYE =`<path d="M27 50 L45 56 L43 63 L28 59 Z" fill="#9dff3a" stroke="#0b1a06" stroke-width="2.5" stroke-linejoin="round"/>`

// Three rounded fronds per side, poking out from behind the head.
const gills = (c) => mirrored(`<g fill="${c}" ${O}><rect x="3" y="26" width="25" height="9" rx="4.5" transform="rotate(-28 27 30)"/>
  <rect x="0" y="40" width="26" height="9" rx="4.5"/><rect x="3" y="54" width="25" height="9" rx="4.5" transform="rotate(28 27 58)"/></g>`)

function behindBody(l) {
  let s = ''
  if (l.gills) s += gills(l.gills)
  if (l.flames)
    s += `<path d="M50 0 C56 10 66 6 64 18 C72 10 82 16 78 28 C90 22 98 36 90 46 C100 54 94 70 84 74 L16 74 C6 70 0 54 10 46 C2 36 10 22 22 28 C18 16 28 10 36 18 C34 6 44 10 50 0 Z" fill="#5cff2a" ${O}/>
      <path d="M50 12 C54 20 62 18 60 28 C70 24 76 32 72 40 C82 40 86 54 78 62 L22 62 C14 54 18 40 28 40 C24 32 30 24 40 28 C38 18 46 20 50 12 Z" fill="#c8ff5a"/>`
  if (l.wings === 'leaf') s += mirrored(LEAF_WING)
  if (l.wings === 'bat') s += mirrored(BAT_WING)
  if (l.tuft)
    s += `<path d="M32 34 L30 14 L40 24 L46 6 L52 22 L60 10 L62 26 L72 18 L68 34 Z" fill="#3fbf3a" ${O}/>
      <path d="M46 13 L48 30 M60 17 L58 30" stroke="#7ae05a" stroke-width="2.5" stroke-linecap="round"/>`
  return s
}

// The Eternal Star: a faceted pink star with angel wings and a little crown.
function starPortrait() {
  const wing = `<path d="M38 52 C26 40 12 34 4 14 C6 30 2 36 8 44 C2 46 4 54 12 56 C8 62 14 66 24 62 C22 68 30 70 38 62 Z" fill="#f6f2ff" ${O}/>
    <path d="M10 30 C18 40 26 46 36 52 M8 46 C18 50 26 54 36 56" fill="none" stroke="#c9b6f2" stroke-width="2.5" stroke-linecap="round"/>`
  const outer = [[50, 24], [82.3, 47.5], [70, 85.5], [30, 85.5], [17.7, 47.5]]
  const inner = [[58.8, 45.9], [64.3, 62.6], [50, 73], [35.7, 62.6], [41.2, 45.9]]
  const star = outer.flatMap((p, i) => [p, inner[i]]).map((p) => p.join(' ')).join(' L')
  const facets = outer.map((p, i) => `M50 58 L${p.join(' ')} L${inner[i].join(' ')} Z`).join(' ')
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="93" rx="26" ry="4" fill="#000" opacity=".18"/>
    ${mirrored(wing)}
    <path d="M${star} Z" fill="#e46cff"/>
    <path d="${facets}" fill="#b845e6"/>
    <path d="M50 31 L55 46 L50 52 L45 46 Z" fill="#fbc8ff"/>
    <path d="M${star} Z" fill="none" ${O}/>
    <path d="M38 26 L36 12 L44 18 L50 8 L56 18 L64 12 L62 26 Z" fill="#9b4dff" ${O}/>
    <circle cx="50" cy="19" r="2.6" fill="#ffd84a"/>
  </svg>`
}

function earsBehind(l) {
  if (l.ears === 'pointy')
    return `<path d="M22 40 L25 10 L46 32 Z" fill="${l.body}" ${O}/><path d="M78 40 L75 10 L54 32 Z" fill="${l.body}" ${O}/>
      <path d="M27 34 L28 18 L39 30 Z" fill="${l.inner}"/><path d="M73 34 L72 18 L61 30 Z" fill="${l.inner}"/>`
  if (l.ears === 'long')
    return `<ellipse cx="36" cy="18" rx="8" ry="18" fill="${l.body}" ${O}/><ellipse cx="64" cy="18" rx="8" ry="18" fill="${l.body}" ${O}/>
      <ellipse cx="36" cy="19" rx="3.5" ry="12" fill="${l.inner}"/><ellipse cx="64" cy="19" rx="3.5" ry="12" fill="${l.inner}"/>`
  if (l.ears === 'round')
    return `<circle cx="26" cy="31" r="10" fill="${l.dark}" ${O}/><circle cx="74" cy="31" r="10" fill="${l.dark}" ${O}/>`
  if (l.ears === 'horns')
    return `<path d="M28 34 L24 12 L40 30 Z" fill="#ffd84a" ${O}/><path d="M72 34 L76 12 L60 30 Z" fill="#ffd84a" ${O}/>
      <path d="M42 30 L46 20 L50 30 L54 20 L58 30 Z" fill="${l.dark}" ${O}/>`
  return ''
}

export function petPortrait(kind) {
  if (kind === 'star') return starPortrait()
  const l = LOOKS[kind] ?? LOOKS.dog
  const eye = (x) => `<ellipse cx="${x}" cy="54" rx="8.5" ry="9.5" fill="#fff" ${O}/><circle cx="${x + 1}" cy="57" r="4.6" fill="${INK}"/><circle cx="${x + 2.6}" cy="55" r="1.7" fill="#fff"/>`
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="93" rx="30" ry="4.5" fill="#000" opacity=".18"/>
    ${behindBody(l)}
    <rect x="28" y="80" width="13" height="12" rx="3" fill="${l.dark}" ${O}/><rect x="59" y="80" width="13" height="12" rx="3" fill="${l.dark}" ${O}/>
    ${earsBehind(l)}
    <rect x="19" y="30" width="62" height="56" rx="10" fill="${l.body}" ${O}/>
    <rect x="25" y="34" width="50" height="6" rx="3" fill="#fff" opacity=".28"/>
    ${l.belly ? `<rect x="34" y="64" width="32" height="18" rx="6" fill="${l.belly}"/>` : ''}
    ${l.muzzle ? `<ellipse cx="50" cy="71" rx="14" ry="9" fill="${l.muzzle}"/>` : ''}
    ${l.patches ? `<ellipse cx="37" cy="55" rx="11" ry="13" fill="${l.dark}" transform="rotate(20 37 55)"/><ellipse cx="63" cy="55" rx="11" ry="13" fill="${l.dark}" transform="rotate(-20 63 55)"/>` : ''}
    ${l.glowEyes ? `${mirrored(GLOW_EYE)}<path d="M40 73 L60 73" stroke="#6dff2e" stroke-width="3" stroke-linecap="round"/>` : `${eye(37)}${eye(61)}`}
    ${l.cheeks ? `<ellipse cx="29" cy="67" rx="5" ry="3" fill="#ff8fb0" opacity=".8"/><ellipse cx="71" cy="67" rx="5" ry="3" fill="#ff8fb0" opacity=".8"/>` : ''}
    ${l.mouth ? `<path d="M44 68 q3 3 6 0 q3 3 6 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` : ''}
    ${l.nose ? `<path d="M45 66h10l-5 5z" fill="${INK}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 71v3m-5 1q5 3 10 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>` : ''}
    ${l.nostrils ? `<circle cx="45" cy="70" r="2" fill="${INK}"/><circle cx="55" cy="70" r="2" fill="${INK}"/>` : ''}
    ${l.whiskers ? `<path d="M48 68h4l-2 2.5z" fill="#ff7aa0" stroke="${INK}" stroke-width="2"/><path d="M24 66h12M24 72l12-3M76 66H64M76 72l-12-3" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>` : ''}
    ${l.ears === 'floppy' ? `<rect x="9" y="30" width="15" height="31" rx="7" fill="${l.dark}" ${O} transform="rotate(14 16 45)"/><rect x="76" y="30" width="15" height="31" rx="7" fill="${l.dark}" ${O} transform="rotate(-14 84 45)"/>` : ''}
  </svg>`
}

// --- State ------------------------------------------------------------------------------
// pets: [{ uid, kind, tier, equipped, locked }]; slots / storage can grow (the + buttons).
export const petsState = { pets: [], slots: PETS.equipSlots, storage: PETS.storage, nextUid: 1 }

export const petMultiplier = (p) => (PETS.kinds[p.kind]?.mult ?? 1) * (PETS.tiers[p.tier]?.mult ?? 1)

// The equipped pets' combined boost: each adds its multiplier above 1 (one 1.1x pet = 1.1x).
export function petBoost() {
  let boost = 1
  for (const p of petsState.pets) if (p.equipped) boost += petMultiplier(p) - 1
  return boost
}

// 1.1 -> "1.1x", 2.5 -> "2.5x", 12 -> "12x", 1500 -> "1.5Kx".
export function formatMult(n) {
  if (n >= 1000) return `${Math.floor(n / 100) / 10}Kx`
  return `${n >= 100 ? Math.round(n) : Math.round(n * 100) / 100}x`
}

function newPet(kind, tier = 0) {
  return { uid: petsState.nextUid++, kind, tier, equipped: false, locked: false }
}

// The saved part (net.js; backend sanitize.ts): the pets without their per-session uids, the slots and storage.
export function snapshot() {
  const { pets, slots, storage } = petsState
  return { pets: pets.map(({ kind, tier, equipped, locked }) => ({ kind, tier, equipped, locked })), petSlots: slots, petStorage: storage }
}

// A loaded save over a fresh start (unknown kinds / tiers dropped). A save without pets is a new
// player: they get the starter pets.
function applySave(s) {
  petsState.slots = PETS.equipSlots
  petsState.storage = PETS.storage
  if (Number.isFinite(s.petSlots) && s.petSlots >= PETS.equipSlots) petsState.slots = Math.floor(s.petSlots)
  if (Number.isFinite(s.petStorage) && s.petStorage >= PETS.storage) petsState.storage = Math.floor(s.petStorage)
  if (!Array.isArray(s.pets)) {
    petsState.pets = PETS.starter.map((kind) => ({ ...newPet(kind), equipped: true }))
    return
  }
  petsState.pets = s.pets
    .filter((p) => p && PETS.kinds[p.kind] && PETS.tiers[p.tier])
    .map((p) => ({ ...newPet(p.kind, p.tier), equipped: p.equipped === true, locked: p.locked === true }))
}

// Header: mode buttons + counters riding the top border right of the title (a row at
// the top of the body on small screens, see pets.css).
const BODY = `
  <div class="pt-head">
    <div class="pt-tools">
      <button type="button" class="pt-tool pt-help" aria-label="Help">${ICONS.help}</button>
      <button type="button" class="pt-tool pt-lock" aria-label="Lock mode" aria-pressed="false">${ICONS.lock}</button>
      <button type="button" class="pt-tool pt-trash" aria-label="Delete mode" aria-pressed="false">${ICONS.trash}</button>
    </div>
    <div class="pt-counts">
      <span class="pt-count pt-count-equip"><span class="pt-count-icon">${ICONS.paw}</span><span class="uiw-text" data-pt="equipped"></span>
        <button type="button" class="pt-plus" aria-label="More pet slots">${ICONS.plus}</button></span>
      <span class="pt-count pt-count-storage"><span class="pt-count-icon">${ICONS.chest}</span><span class="uiw-text" data-pt="stored"></span>
        <button type="button" class="pt-plus" aria-label="More pet storage">${ICONS.plus}</button></span>
    </div>
  </div>
  <div class="pt-grid"></div>
  <div class="pt-empty">No pets yet! Hatch eggs to get some.</div>
  <div class="pt-hint uiw-text"></div>
  <div class="pt-help-card" hidden>
    <p>Tap a pet to <b>equip</b> it. Equipped pets boost your trophies.</p>
    <p><b>Craft All</b> turns ${PETS.craftCount} of the same pet into a stronger one.</p>
    <p><b>Lock</b> keeps a pet safe from crafting and deleting.</p>
  </div>`

// Builds the window. Returns { open, close, toggle, isOpen, addPet, boost, snapshot, hydrate }.
// actions: { onChange(boost) } fires whenever the equipped boost may have changed.
export function createPets(actions = {}) {
  applySave({}) // the starter pets until the server's save loads (hydrate)

  const win = createWindow({ title: 'Pets!', icon: ICONS.paw, className: 'pets-window', onOpen: reset })
  const { overlay, dialog, body } = win
  body.innerHTML = BODY

  const q = (s) => overlay.querySelector(s)
  const grid = q('.pt-grid')
  const hint = q('.pt-hint')
  const helpCard = q('.pt-help-card')
  const lockBtn = q('.pt-lock')
  const trashBtn = q('.pt-trash')
  const field = {}
  for (const el of overlay.querySelectorAll('[data-pt]')) field[el.dataset.pt] = el

  // Footer: straddles the bottom border, left-aligned like the reference.
  const craftBtn = uiButton('Craft All', 'blue', craftAll, 'pt-btn pt-craft')
  const deleteBtn = uiButton('Delete', 'red', deleteMarked, 'pt-btn pt-delete')
  const buttons = document.createElement('div')
  buttons.className = 'uiw-btns pt-buttons'
  buttons.append(
    uiButton('Equip Best', 'green', equipBest, 'pt-btn pt-best'),
    craftBtn,
    uiButton('Unequip ALL', 'orange', unequipAll, 'pt-btn pt-unequip'),
    uiButton('Cancel', 'blue', () => setMode('delete'), 'pt-btn pt-cancel'),
    deleteBtn,
  )
  dialog.append(buttons)

  let mode = 'equip' // 'equip' | 'lock' | 'delete'
  const marked = new Set() // uids picked for deletion

  const equippedCount = () => petsState.pets.reduce((n, p) => n + (p.equipped ? 1 : 0), 0)
  const sorted = () => [...petsState.pets].sort((a, b) => b.equipped - a.equipped || petMultiplier(b) - petMultiplier(a) || a.uid - b.uid)

  function changed() {
    render()
    actions.onChange?.(petBoost())
  }

  function render() {
    field.equipped.textContent = `${equippedCount()}/${petsState.slots}`
    field.stored.textContent = `${petsState.pets.length}/${petsState.storage}`
    dialog.dataset.mode = mode
    lockBtn.classList.toggle('on', mode === 'lock')
    lockBtn.setAttribute('aria-pressed', String(mode === 'lock'))
    trashBtn.classList.toggle('on', mode === 'delete')
    trashBtn.setAttribute('aria-pressed', String(mode === 'delete'))
    deleteBtn.textContent = `Delete (${marked.size})`
    hint.textContent = mode === 'lock' ? 'Tap pets to lock / unlock them' : mode === 'delete' ? 'Tap pets to delete' : ''
    q('.pt-empty').hidden = petsState.pets.length > 0

    grid.replaceChildren(
      ...sorted().map((p) => {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = `pt-pet t-${p.tier}`
        card.dataset.uid = p.uid
        card.classList.toggle('equipped', p.equipped)
        card.classList.toggle('locked', p.locked)
        card.classList.toggle('marked', marked.has(p.uid))
        const kind = PETS.kinds[p.kind]
        const tier = PETS.tiers[p.tier]
        card.setAttribute('aria-label', `${tier.name === 'Normal' ? '' : `${tier.name} `}${kind.name}, ${formatMult(petMultiplier(p))}${p.equipped ? ', equipped' : ''}`)
        card.innerHTML = `<span class="pt-pet-disc r-${kind.rarity}">${petPortrait(p.kind)}</span>
          <span class="pt-pet-mult uiw-text">${formatMult(petMultiplier(p))}</span>
          <span class="pt-badge pt-badge-equip">${ICONS.check}</span>
          <span class="pt-badge pt-badge-lock">${ICONS.locked}</span>
          <span class="pt-badge pt-badge-mark">${ICONS.mark}</span>`
        return card
      }),
    )
  }

  function setMode(next) {
    mode = mode === next ? 'equip' : next
    marked.clear()
    helpCard.hidden = true
    render()
  }

  function tapPet(card) {
    const p = petsState.pets.find((x) => x.uid === Number(card.dataset.uid))
    if (!p) return
    if (mode === 'lock') {
      p.locked = !p.locked
    } else if (mode === 'delete') {
      if (p.locked) return replay(card, 'shake')
      if (marked.has(p.uid)) marked.delete(p.uid)
      else marked.add(p.uid)
      return render()
    } else if (p.equipped) {
      p.equipped = false
    } else if (equippedCount() < petsState.slots) {
      p.equipped = true
    } else {
      replay(card, 'shake')
      return replay(q('.pt-count-equip'), 'shake')
    }
    changed()
    replay(grid.querySelector(`[data-uid="${p.uid}"]`), 'bump')
  }

  function equipBest() {
    const best = [...petsState.pets].sort((a, b) => petMultiplier(b) - petMultiplier(a)).slice(0, petsState.slots)
    for (const p of petsState.pets) p.equipped = best.includes(p)
    changed()
  }

  function unequipAll() {
    for (const p of petsState.pets) p.equipped = false
    changed()
  }

  // Every craftCount unlocked pets of one kind + tier become one pet of the next tier.
  // The new pet is equipped if any of its ingredients was.
  function craftAll() {
    let crafted = 0
    for (let tier = 0; tier < PETS.tiers.length - 1; tier++) {
      for (const kind of Object.keys(PETS.kinds)) {
        const group = petsState.pets.filter((p) => p.kind === kind && p.tier === tier && !p.locked)
        while (group.length >= PETS.craftCount) {
          const used = group.splice(0, PETS.craftCount)
          petsState.pets = petsState.pets.filter((p) => !used.includes(p))
          petsState.pets.push({ ...newPet(kind, tier + 1), equipped: used.some((p) => p.equipped) })
          crafted++
        }
      }
    }
    if (!crafted) return replay(craftBtn, 'shake')
    changed()
    sfx.craft()
    burst(...centre(craftBtn), 'stars')
  }

  function deleteMarked() {
    if (!marked.size) return replay(deleteBtn, 'shake')
    sfx.trash()
    petsState.pets = petsState.pets.filter((p) => !marked.has(p.uid))
    marked.clear()
    mode = 'equip'
    changed()
  }

  // Every open starts in equip mode with the help card shut.
  function reset() {
    mode = 'equip'
    marked.clear()
    helpCard.hidden = true
    render()
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.pt-pet')
    if (card) tapPet(card)
  })
  q('.pt-help').addEventListener('click', () => {
    helpCard.hidden = !helpCard.hidden
  })
  helpCard.addEventListener('click', () => (helpCard.hidden = true))
  lockBtn.addEventListener('click', () => setMode('lock'))
  trashBtn.addEventListener('click', () => setMode('delete'))
  // More slots / storage are store purchases (not built yet).
  for (const b of overlay.querySelectorAll('.pt-plus')) b.addEventListener('click', () => replay(b, 'bump'))

  // Eggs (eggs.js) and gifts hand pets in here. Returns false when storage is full.
  function addPet(kind, tier = 0) {
    if (!PETS.kinds[kind] || petsState.pets.length >= petsState.storage) return false
    petsState.pets.push(newPet(kind, tier))
    if (win.isOpen()) render()
    return true
  }

  // A save loaded from the server (net.js).
  function hydrate(doc) {
    applySave(doc)
    marked.clear()
    changed()
  }

  render()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, addPet, boost: petBoost, snapshot, hydrate }
}
