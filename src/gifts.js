// Online Gifts window (the reference's "Online Gifts!" popup) on the shared window
// shell (uiWindow.js), opened by the HUD's CLAIM! pill or G. Twelve play-time
// rewards in a 4x3 grid (GIFTS.list in config): each card counts down the minutes
// online it still needs, then shows a green CLAIM!. Lightning / trophies / pets go
// through onReward (main.js), potions are only counted here (no potion effects yet).
// Once every gift is claimed the clock starts over.
// The clock only runs while the game is open and visible; it and the claims are
// saved by the server (snapshot / hydrate, net.js).
import { GIFTS, PETS } from './config.js'
import { petPortrait } from './pets.js'
import { createWindow, replay } from './uiWindow.js'
import './gifts.css' // after the shell's CSS
import { sfx } from './audio/index.js'
import { burst, centre } from './juice.js'

const INK = '#1d1a22'

const ICONS = {
  // Red present with a gold ribbon and bow (title badge).
  gift: `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
    <path d="M50 30 C40 8 16 6 19 21 C21 31 38 32 50 30 Z" fill="#ffc21a"/><path d="M50 30 C60 8 84 6 81 21 C79 31 62 32 50 30 Z" fill="#ffc21a"/>
    <rect x="14" y="46" width="72" height="48" rx="6" fill="#e3262e"/><rect x="8" y="29" width="84" height="20" rx="6" fill="#ff4a4f"/>
    <path d="M42 29 H58 V94 H42 Z" fill="#ffc21a"/></g>
    <rect x="15" y="33" width="22" height="5" rx="2.5" fill="#ff9da0"/><rect x="46" y="33" width="4" height="56" rx="2" fill="#ffe27a"/></svg>`,
  // Chunky rounded lightning bolt, light on the left, with a shine dot.
  bolt: `<svg viewBox="0 0 60 100" aria-hidden="true">
    <path d="M18 5 H50 L40 38 H55 L16 96 L23 58 H6 Z" fill="#3fb6ff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M20 9 H44 L34 40 L24 56 H11 Z" fill="#9fe8ff"/><path d="M42 42 H50 L22 84 Z" fill="#1f8dfa"/>
    <ellipse cx="30" cy="17" rx="5" ry="6.5" fill="#fff" transform="rotate(20 30 17)"/></svg>`,
  trophy: `<svg viewBox="0 0 100 82" aria-hidden="true">
    <path d="M26 14 H9 v7 a17 17 0 0 0 20 17 M74 14 h17 v7 a17 17 0 0 1 -20 17" fill="none" stroke="${INK}" stroke-width="13"/>
    <path d="M26 14 H9 v7 a17 17 0 0 0 20 17 M74 14 h17 v7 a17 17 0 0 1 -20 17" fill="none" stroke="#ffb31a" stroke-width="5.5"/>
    <g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <path d="M22 5 H78 V26 C78 44 66 54 50 54 C34 54 22 44 22 26 Z" fill="#ffc21a"/>
      <path d="M43 53 H57 V64 H43 Z" fill="#f29a00"/><path d="M27 64 H73 L77 78 H23 Z" fill="#ffc21a"/></g>
    <path d="M29 11 V27 C29 37 33 43 38 46" fill="none" stroke="#fff3a0" stroke-width="5" stroke-linecap="round"/>
    <text x="52" y="38" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="25" fill="#e8462e" stroke="#9a2a12" stroke-width="1.2">1</text></svg>`,
  // Happy face with closed eyes (footer note).
  smile: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" fill="#ffd23a" stroke="#d89a10" stroke-width="4"/>
    <path d="M27 45 q8 -10 16 0 M57 45 q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>
    <ellipse cx="24" cy="60" rx="8" ry="5" fill="#ff8f6a" opacity=".7"/><ellipse cx="76" cy="60" rx="8" ry="5" fill="#ff8f6a" opacity=".7"/>
    <path d="M34 61 q16 16 32 0 Z" fill="#8a2a1a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#2fc74a" stroke="${INK}" stroke-width="7"/>
    <path d="M29 51l14 14 29-30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

// Round glass flask (light ring) of coloured liquid with a big shine.
const potion = ({ color, light }) => `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="58" y="4" width="20" height="20" rx="4" fill="#c8eeff" stroke="${INK}" stroke-width="5" transform="rotate(30 68 14)"/>
  <circle cx="48" cy="56" r="40" fill="#c8eeff" stroke="${INK}" stroke-width="5"/>
  <circle cx="48" cy="56" r="31" fill="${color}"/>
  <path d="M21 60 a27 27 0 0 0 42 21" fill="none" stroke="${light}" stroke-width="6" stroke-linecap="round" opacity=".75"/>
  <ellipse cx="58" cy="37" rx="12" ry="8" fill="#fff" transform="rotate(30 58 37)"/>
  <circle cx="33" cy="42" r="4" fill="#fff" opacity=".85"/></svg>`

export const giftsState = { played: 0, claimed: [], potions: {} } // played = seconds online

const readyAt = (g) => g.at * 60

// The saved part (net.js; backend sanitize.ts): the clock in whole seconds, the claims, the potions.
export const snapshot = () => ({ giftTime: Math.floor(giftsState.played), giftsClaimed: [...giftsState.claimed], potions: { ...giftsState.potions } })

// A loaded save over a fresh start.
function applySave(s) {
  giftsState.played = Number.isFinite(s.giftTime) && s.giftTime >= 0 ? s.giftTime : 0
  giftsState.claimed = Array.isArray(s.giftsClaimed) ? s.giftsClaimed.filter((i) => Number.isInteger(i) && GIFTS.list[i]) : []
  giftsState.potions = {}
  if (s.potions && typeof s.potions === 'object')
    for (const id of Object.keys(GIFTS.potions)) if (Number.isFinite(s.potions[id])) giftsState.potions[id] = s.potions[id]
}

// 299 -> "04:59".
function clock(sec) {
  sec = Math.ceil(sec)
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

// The card's art + text (everything but the button).
function cardArt(g) {
  if (g.type === 'pet') {
    const name = PETS.kinds[g.id].name.split(' ').join('<br>')
    // Rainbow outlined tag ("OP!"), drawn as SVG text so the gradient fill keeps its outline.
    const tag = g.tag
      ? `<svg class="gf-tag" viewBox="0 0 90 46" aria-hidden="true"><defs><linearGradient id="gf-tag-${g.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".15" stop-color="#ffe600"/><stop offset=".4" stop-color="#45ff3a"/><stop offset=".62" stop-color="#18a8ff"/><stop offset=".85" stop-color="#ff2a5a"/></linearGradient></defs>
          <text x="45" y="38" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="42" fill="url(#gf-tag-${g.id})"
            stroke="${INK}" stroke-width="7" stroke-linejoin="round" paint-order="stroke fill">${g.tag}</text></svg>`
      : ''
    return `<span class="gf-pet">${petPortrait(g.id)}</span><span class="gf-name">${tag}<span class="uiw-text">${name}</span></span>`
  }
  if (g.type === 'potion') {
    const p = GIFTS.potions[g.id]
    // The title shrinks to fit the card like Roblox TextScaled (17 letters ~ 22 px, 13 ~ 29 px).
    const fs = Math.min(31, 380 / p.name.length).toFixed(1)
    return `<span class="gf-title uiw-text" style="--fs:${fs}">${p.name}</span>` +
      `<span class="gf-icon gf-potion">${potion(p)}</span><span class="gf-n gf-potion-n uiw-text">x1</span>`
  }
  return `<span class="gf-icon gf-${g.type}">${ICONS[g.type]}</span><span class="gf-n uiw-text">x${g.n}</span>`
}

const BODY = `
  <div class="gf-grid"></div>
  <div class="gf-foot">
    <div class="gf-note"><span class="gf-smile">${ICONS.smile}</span><span class="gf-note-text uiw-text"></span></div>
  </div>`
const NOTE = "We'll keep gifts for you offline"

// onReward(gift) grants a bolt / trophy / pet gift; returning false refuses it (e.g.
// pet storage full) and the gift stays. onReadyCount(n) feeds the HUD's CLAIM badge.
// Returns { open, close, toggle, isOpen, readyCount, addTime(seconds), snapshot, hydrate }.
export function createGifts({ onReward, onReadyCount } = {}) {
  const win = createWindow({ title: 'Online Gifts!', icon: ICONS.gift, className: 'gf-window', onOpen: () => render() })
  win.body.innerHTML = BODY
  const grid = win.body.querySelector('.gf-grid')
  const note = win.body.querySelector('.gf-note')
  const noteText = win.body.querySelector('.gf-note-text')
  noteText.textContent = NOTE

  const cards = GIFTS.list.map((g, i) => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = `gf-card c-${g.card ?? 'grey'} t-${g.type}`
    card.innerHTML = `${cardArt(g)}<span class="gf-claim uiw-text"></span><span class="gf-check">${ICONS.check}</span>`
    card.addEventListener('click', () => claim(i))
    grid.append(card)
    return { card, label: card.querySelector('.gf-claim'), shown: '' }
  })

  const isClaimed = (i) => giftsState.claimed.includes(i)
  const isReady = (i) => !isClaimed(i) && giftsState.played >= readyAt(GIFTS.list[i])

  function readyCount() {
    let n = 0
    for (let i = 0; i < GIFTS.list.length; i++) if (isReady(i)) n++
    return n
  }

  let lastCount = -1
  function notifyCount() {
    const n = readyCount()
    if (n !== lastCount) onReadyCount?.((lastCount = n))
  }

  function render() {
    GIFTS.list.forEach((g, i) => {
      const c = cards[i]
      const state = isClaimed(i) ? 'claimed' : isReady(i) ? 'ready' : 'wait'
      const text = state === 'claimed' ? 'CLAIMED' : state === 'ready' ? 'CLAIM!' : clock(readyAt(g) - giftsState.played)
      if (text === c.shown) return
      c.shown = text
      c.label.textContent = text
      c.card.classList.toggle('ready', state === 'ready')
      c.card.classList.toggle('claimed', state === 'claimed')
      c.card.setAttribute('aria-label', `${giftName(g)}: ${state === 'wait' ? `ready in ${text}` : text}`)
    })
  }

  function giftName(g) {
    if (g.type === 'pet') return PETS.kinds[g.id].name
    if (g.type === 'potion') return GIFTS.potions[g.id].name
    return `${g.n} ${g.type === 'bolt' ? 'lightning' : 'trophies'}`
  }

  let noteTimer = 0
  function say(text) {
    noteText.textContent = text
    note.classList.add('warn')
    replay(note, 'shake')
    clearTimeout(noteTimer)
    noteTimer = setTimeout(() => {
      noteText.textContent = NOTE
      note.classList.remove('warn')
    }, 2200)
  }

  function claim(i) {
    const g = GIFTS.list[i]
    const { card } = cards[i]
    if (!isReady(i)) return replay(card, 'shake')
    if (g.type === 'potion') giftsState.potions[g.id] = (giftsState.potions[g.id] ?? 0) + 1
    else if (onReward?.(g) === false) {
      replay(card, 'shake')
      return say(g.type === 'pet' ? 'Your pet storage is full!' : "Can't claim that right now!")
    }
    giftsState.claimed.push(i)
    // Everything claimed: a new round of gifts starts counting from zero.
    if (giftsState.claimed.length >= GIFTS.list.length) {
      giftsState.played = 0
      giftsState.claimed = []
    }
    render()
    notifyCount()
    sfx.gift(g.type) // paper torn, lid off, then what was inside
    burst(...centre(card), 'stars')
    replay(card, 'bump')
  }

  // The online clock: ticks while the page is visible (net.js saves it with the rest).
  let last = performance.now()
  function addTime(sec) {
    giftsState.played += sec
    if (win.isOpen()) render()
    notifyCount()
  }
  setInterval(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 5) // a sleeping / throttled tab does not count
    last = now
    if (document.hidden) return
    addTime(dt)
  }, 1000)

  // A save loaded from the server (net.js).
  function hydrate(doc) {
    applySave(doc)
    render()
    notifyCount()
  }

  render()
  notifyCount()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, readyCount, addTime, snapshot, hydrate }
}
