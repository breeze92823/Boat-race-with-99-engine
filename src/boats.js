// Boats window (the reference's "Boats!" popup) on the shared window shell
// (uiWindow.js): the selected boat's card on the left (name, picture, engine
// count, Wins / Luck / Acc boosts, Equip / blue Wins-price button; preview and
// name in the rarity colour) and the catalog grid on the right, 4 per row,
// coloured by rarity, locked ones padlocked with their Wins price. Every boat
// but the free Wooden Raft is bought with Wins (the HUD's trophy counter).
// Owned + equipped boats are saved by the server (snapshot / hydrate, net.js);
// equipping swaps the player's boat (main.js -> boat.setHull). The HUD's Boats
// tile opens it. Catalog: BOATS in config.js, models: boatModels.js.
import './boats.css'
import { BOATS } from './config.js'
import { boatById } from './boatModels.js'
import { boatThumb } from './boatThumbs.js'
import { ICONS } from './hudIcons.js'
import { createWindow, replay, uiButton } from './uiWindow.js'

const CHECK = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="28" fill="#2fd44a" stroke="#fff" stroke-width="5"/>
  <path d="M19 33l9 9 18-19" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

export const boatState = { owned: new Set(BOATS.start.owned), equipped: BOATS.start.equipped }

// 1000 -> "1K", 2.6e6 -> "2.6M", 1.4e9 -> "1.4B" (the reference's short style).
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
function short(n) {
  let i = 0
  while (n >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  return `${n >= 100 || i === 0 ? Math.floor(n) : Math.floor(n * 10) / 10}${SUFFIXES[i]}`
}

// The saved part (net.js; backend sanitize.ts): { boats: owned ids, boat: the equipped one }.
export const snapshot = () => ({ boats: [...boatState.owned], boat: boatState.equipped })

// A loaded save over a fresh start (unknown ids dropped, an unowned boat not equipped).
function applySave(s) {
  boatState.owned = new Set(BOATS.start.owned)
  boatState.equipped = BOATS.start.equipped
  if (Array.isArray(s.boats)) for (const id of s.boats) if (boatById(id)) boatState.owned.add(id)
  if (boatState.owned.has(s.boat)) boatState.equipped = s.boat
}

const BODY = `
  <aside class="bt-info">
    <div class="bt-name uiw-text"></div>
    <div class="bt-preview"><img class="bt-preview-pic" alt="" draggable="false"></div>
    <div class="bt-engines"><span class="bt-rocket">${ICONS.engine}</span><span class="uiw-text" data-bt="engines"></span></div>
    <div class="bt-stats">
      <div class="uiw-text wins" data-bt="wins"></div>
      <div class="uiw-text luck" data-bt="luck"></div>
      <div class="uiw-text acc" data-bt="acc"></div>
    </div>
    <div class="bt-action"><div class="bt-equipped uiw-text">Equipped</div></div>
    <div class="bt-hint uiw-text"></div>
  </aside>
  <div class="bt-grid"></div>`

// wallet: { wins() -> number, spend(n) } (the HUD's trophy counter = Wins).
// onEquip(id) is called after the equipped boat changes (and once at start).
// Returns { open, close, toggle, isOpen, item, acquire, snapshot, hydrate }.
export function createBoats({ wallet, onEquip }) {
  const win = createWindow({ title: 'Boats!', icon: ICONS.boats, className: 'bt-window', onOpen })
  win.body.innerHTML = BODY
  const q = (sel) => win.body.querySelector(sel)
  const field = {}
  for (const el of win.body.querySelectorAll('[data-bt]')) field[el.dataset.bt] = el
  const info = q('.bt-info')
  const name = q('.bt-name')
  const preview = q('.bt-preview-pic')
  const equippedText = q('.bt-equipped')
  const hint = q('.bt-hint')
  const action = uiButton('', 'green', act, 'bt-btn')
  q('.bt-action').append(action)

  let selected = boatState.equipped
  const tiles = new Map()
  const grid = q('.bt-grid')
  for (const b of BOATS.list) {
    const t = document.createElement('button')
    t.type = 'button'
    t.className = 'bt-tile'
    t.style.setProperty('--c', BOATS.rarity[b.rarity])
    t.setAttribute('aria-label', b.name)
    t.innerHTML =
      `<img class="bt-pic" alt="" draggable="false"><span class="bt-lock">${ICONS.relics}</span>` +
      `<span class="bt-price uiw-text">${b.price ? short(b.price) : ''}</span>` +
      `<span class="bt-cur">${ICONS.trophy}</span><span class="bt-check">${CHECK}</span>`
    t.addEventListener('click', () => select(b.id))
    grid.append(t)
    tiles.set(b.id, t)
  }

  let hintTimer = 0
  function say(text) {
    hint.textContent = text
    hint.classList.add('show')
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => hint.classList.remove('show'), 1800)
  }

  function setPicture(img, id, first = false) {
    img.classList.remove('ready')
    img.dataset.id = id
    boatThumb(
      id,
      (url) => {
        if (img.dataset.id !== id || !url) return
        img.src = url
        img.classList.add('ready')
      },
      first,
    )
  }

  function render() {
    const b = boatById(selected)
    const owned = boatState.owned.has(b.id)
    const equipped = boatState.equipped === b.id
    name.textContent = b.name
    info.style.setProperty('--rc', BOATS.rarity[b.rarity])
    info.style.setProperty('--nc', BOATS.nameColor[b.rarity])
    if (preview.dataset.id !== b.id) setPicture(preview, b.id, true)
    field.engines.textContent = `x${b.engines}`
    field.wins.textContent = `+${short(b.wins)}% Wins`
    field.luck.textContent = `+${short(b.luck)}% Luck`
    field.acc.textContent = `+${short(b.acc)}% Acc`
    equippedText.hidden = !equipped
    action.hidden = equipped
    if (!owned) action.innerHTML = `<span class="bt-cost"><span class="bt-cost-icon">${ICONS.trophy}</span><span>${short(b.price)}</span></span>`
    else action.textContent = 'Equip'
    action.classList.toggle('green', owned)
    action.classList.toggle('blue', !owned)
    for (const [id, t] of tiles) {
      t.classList.toggle('owned', boatState.owned.has(id))
      t.classList.toggle('equipped', boatState.equipped === id)
      t.classList.toggle('sel', id === selected)
    }
  }

  function select(id) {
    if (selected === id) return
    selected = id
    hint.classList.remove('show')
    render()
  }

  function equip(id) {
    boatState.equipped = id
    onEquip(id)
    render()
    replay(tiles.get(id).querySelector('.bt-check'), 'bump')
  }

  function act() {
    const r = acquire(selected)
    if (r.need) {
      replay(action, 'shake')
      say(`Need ${short(r.need)} more Wins!`)
    }
  }

  // Buys `id` if needed and equips it, without the window (the Boats stall's
  // display boats). Returns { done: 'bought' | 'equipped' | 'already' } or { need: Wins short }.
  function acquire(id) {
    const b = boatById(id)
    if (boatState.equipped === id) return { done: 'already' }
    if (boatState.owned.has(id)) {
      equip(id)
      return { done: 'equipped' }
    }
    const have = wallet.wins()
    if (have < b.price) return { need: b.price - have }
    wallet.spend(b.price)
    boatState.owned.add(id)
    equip(id)
    return { done: 'bought' }
  }

  const item = (id) => {
    const b = boatById(id)
    return { name: b.name, price: b.price ?? 0, owned: boatState.owned.has(id), equipped: boatState.equipped === id }
  }

  function onOpen() {
    selected = boatState.equipped
    hint.classList.remove('show')
    render()
    for (const [id, t] of tiles) {
      const img = t.querySelector('.bt-pic')
      if (img.dataset.id !== id) setPicture(img, id)
    }
    requestAnimationFrame(() => tiles.get(selected).scrollIntoView({ block: 'nearest' }))
  }

  onEquip(boatState.equipped)
  render()
  // Draw the tile pictures in the background soon after start, so the grid is ready on first open.
  setTimeout(() => {
    for (const b of BOATS.list) boatThumb(b.id, () => {})
  }, BOATS.preloadDelayMs)
  // A save loaded from the server (net.js): swap in its boats and ride the equipped one.
  function hydrate(doc) {
    applySave(doc)
    selected = boatState.equipped
    onEquip(boatState.equipped)
    render()
  }
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, item, acquire, snapshot, hydrate }
}
