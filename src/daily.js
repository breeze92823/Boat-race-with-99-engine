// Daily Reward window (the reference's "Daily Reward!" popup) on the shared window shell
// (uiWindow.js), opened by the HUD's calendar button, and by itself shortly after joining when
// a day is ready (DAILY.autoOpen). Seven days (DAILY.days in config): six cards in a 3x2 grid
// and Day 7's big Axolotl Egg card on the right (below the grid in portrait).
// The calendar runs on the SERVER's UTC clock (backend daily.ts): each new UTC day the player
// plays unlocks the next day, unlocked days show Claim until claimed (they need not be
// consecutive), and once all 7 are claimed the next day starts over at Day 1. A claim asks the
// server (`claimDaily`) and the reward is granted only when it answers ok (`dailyResult`), so a
// changed device clock unlocks nothing. With no server configured at all the same rules run on
// the device clock for the page (like the rest of an offline session's progress).
// Wins / pets / the egg go through onReward (main.js); potions are counted with the gifts' ones.
import { DAILY, GIFTS } from './config.js'
import { petPortrait, petsState } from './pets.js'
import { giftsState } from './gifts.js'
import { hasServer, onNetMessage, sendNet } from './net.js'
import { anyWindowOpen, createWindow, replay } from './uiWindow.js'
import './daily.css' // after the shell's CSS
import { sfx } from './audio/index.js'
import { burst, centre } from './juice.js'

const INK = '#1d1a22'
const DAY_MS = 86_400_000
const RAINBOW = ['#ff3b3b', '#ffb21a', '#ffe14a', '#3ddc4a', '#2fb8ff', '#b05cff']

const ICONS = {
  // Calendar page with red rings and "31" (title badge, like the HUD's round button).
  calendar: `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
    <rect x="8" y="16" width="84" height="78" rx="12" fill="#fff"/><path d="M8 28a12 12 0 0 1 12-12h60a12 12 0 0 1 12 12v12H8z" fill="#ff3b3b"/></g>
    <path d="M30 6v20M70 6v20" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M30 8v16M70 8v16" stroke="#cfd6df" stroke-width="5" stroke-linecap="round"/>
    <text x="50" y="84" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="42" fill="${INK}">31</text></svg>`,
  // Gold cup with a red "1" (the Wins cards).
  trophy: `<svg viewBox="0 0 100 82" aria-hidden="true">
    <path d="M26 14 H9 v7 a17 17 0 0 0 20 17 M74 14 h17 v7 a17 17 0 0 1 -20 17" fill="none" stroke="${INK}" stroke-width="13"/>
    <path d="M26 14 H9 v7 a17 17 0 0 0 20 17 M74 14 h17 v7 a17 17 0 0 1 -20 17" fill="none" stroke="#ffb31a" stroke-width="5.5"/>
    <g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <path d="M22 5 H78 V26 C78 44 66 54 50 54 C34 54 22 44 22 26 Z" fill="#ffc21a"/>
      <path d="M43 53 H57 V64 H43 Z" fill="#f29a00"/><path d="M27 64 H73 L77 78 H23 Z" fill="#ffc21a"/></g>
    <path d="M29 11 V27 C29 37 33 43 38 46" fill="none" stroke="#fff3a0" stroke-width="5" stroke-linecap="round"/>
    <text x="52" y="38" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="25" fill="#e8462e" stroke="#9a2a12" stroke-width="1.2">1</text></svg>`,
  check: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#2fc74a" stroke="${INK}" stroke-width="7"/>
    <path d="M29 51l14 14 29-30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

// Round glass flask of coloured (or rainbow-banded) liquid with a big shine.
function potion(p, id) {
  const fill = p.rainbow ? `url(#${id})` : p.color
  const defs = p.rainbow
    ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${RAINBOW.map((c, i) => `<stop offset="${(i / (RAINBOW.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`
    : ''
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${defs}
  <rect x="58" y="4" width="20" height="20" rx="4" fill="#c8eeff" stroke="${INK}" stroke-width="5" transform="rotate(30 68 14)"/>
  <circle cx="48" cy="56" r="40" fill="#c8eeff" stroke="${INK}" stroke-width="5"/>
  <circle cx="48" cy="56" r="31" fill="${fill}"/>
  <path d="M21 60 a27 27 0 0 0 42 21" fill="none" stroke="${p.light}" stroke-width="6" stroke-linecap="round" opacity=".75"/>
  <ellipse cx="58" cy="37" rx="12" ry="8" fill="#fff" transform="rotate(30 58 37)"/>
  <circle cx="33" cy="42" r="4" fill="#fff" opacity=".85"/></svg>`
}

// Day 7's egg: a glowing orange egg on golden feathered wings, with sparkles.
function wingedEgg() {
  // Swept up from the shoulder to the tip, scalloped feathers along the lower edge.
  const wing = `<path d="M84 100 C68 66 42 40 8 28 C12 44 18 54 28 62 C16 62 8 68 4 78 C18 84 28 86 38 88 C26 92 20 100 18 110 C32 112 44 110 54 110 C46 116 44 124 46 134 C60 130 72 122 84 114 Z"
    fill="url(#dr-wing)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M30 62 C46 68 62 80 76 98 M38 88 C52 92 64 98 76 106 M54 110 C62 110 70 110 78 110" fill="none" stroke="#ffaa12" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M20 38 C42 46 60 62 72 80" fill="none" stroke="#fffbd0" stroke-width="4" stroke-linecap="round" opacity=".8"/>`
  const spark = (x, y, r) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="#fff"/>`
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><defs>
    <radialGradient id="dr-egg" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#ff7a1a"/><stop offset="1" stop-color="#d63a0a"/></radialGradient>
    <linearGradient id="dr-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7b0"/><stop offset=".55" stop-color="#ffd21a"/><stop offset="1" stop-color="#ff9a00"/></linearGradient></defs>
    ${wing}<g transform="matrix(-1 0 0 1 200 0)">${wing}</g>
    <path d="M100 46 C130 46 150 98 150 126 C150 156 128 176 100 176 C72 176 50 156 50 126 C50 98 70 46 100 46 Z" fill="url(#dr-egg)" stroke="${INK}" stroke-width="6"/>
    <path d="M96 66 L106 92 L92 108 L108 128" fill="none" stroke="#a82a06" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
    <ellipse cx="80" cy="84" rx="9" ry="17" fill="#fff" opacity=".55" transform="rotate(-22 80 84)"/>
    ${spark(146, 62, 14)}${spark(58, 150, 10)}${spark(160, 140, 8)}</svg>`
}

// The big card's title: rainbow-ish gradient text with a thick outline, fitted to the card.
const bigTitle = (title) => `<svg viewBox="0 0 340 86" aria-hidden="true"><defs><linearGradient id="dr-title" x1="0" y1="0" x2="0" y2="1">
  <stop offset=".1" stop-color="#e05cff"/><stop offset=".5" stop-color="#7a5cff"/><stop offset=".62" stop-color="#3ddc6a"/><stop offset=".95" stop-color="#b8ff3a"/></linearGradient></defs>
  <text x="170" y="70" text-anchor="middle" textLength="326" lengthAdjust="spacingAndGlyphs" font-family="Fredoka, sans-serif" font-weight="700" font-size="76"
    fill="url(#dr-title)" stroke="${INK}" stroke-width="9" stroke-linejoin="round" paint-order="stroke fill">${title}</text></svg>`

// The card's art + heading (everything but the Claim button / day label).
function cardArt(r, i) {
  if (r.type === 'egg')
    return `<span class="dr-bigtitle">${bigTitle(r.title)}</span><span class="dr-art dr-egg">${wingedEgg()}</span><span class="dr-n uiw-text">x${r.n}</span>`
  // The heading shrinks to fit the card like Roblox TextScaled.
  const fs = Math.min(40, 350 / r.title.length).toFixed(1)
  const art = r.type === 'pet' ? petPortrait(r.id) : r.type === 'potion' ? potion(GIFTS.potions[r.id], `dr-pot${i}`) : ICONS.trophy
  return `<span class="dr-title uiw-text" style="--fs:${fs}">${r.title}</span><span class="dr-art dr-${r.type}">${art}</span>`
}

const BODY = `
  <div class="dr-grid"></div>
  <div class="dr-foot">
    <span class="dr-timer uiw-text"></span>
    <span class="dr-note uiw-text">The date of reward update is based on UTC time</span>
  </div>`

// onReward(day) grants a Wins / pet / egg day (potions are counted here); onReadyCount(n) feeds
// the HUD calendar's dot; canAutoOpen() says whether popping the window open now is fine
// (not racing, no scene). Returns { open, close, toggle, isOpen, readyCount, state }.
export function createDaily({ onReward, onReadyCount, canAutoOpen } = {}) {
  const win = createWindow({ title: 'Daily Reward!', icon: ICONS.calendar, className: 'dr-window', onOpen: () => render() })
  win.body.innerHTML = BODY
  const grid = win.body.querySelector('.dr-grid')
  const timer = win.body.querySelector('.dr-timer')

  // unlocked = days unlocked this cycle; nextAt = the next UTC day (server ms); offset = server - device clock.
  const state = { unlocked: 0, claimed: [], nextAt: 0, offset: 0, known: false }
  let pending = -1 // the day a claim is waiting on the server for (shown as "...")
  let pendingTimer = 0
  const asked = new Set() // days claimed from this tab whose answer hasn't come yet
  let refreshSent = false
  const now = () => Date.now() + state.offset

  const cards = DAILY.days.map((r, i) => {
    const card = document.createElement('button')
    card.type = 'button'
    const last = i === DAILY.days.length - 1
    card.className = `dr-card t-${r.type}${last ? ' dr-big' : ''}`
    card.innerHTML = `${cardArt(r, i)}<span class="dr-btn uiw-text"></span><span class="dr-day uiw-text">Day ${i + 1}</span><span class="dr-check">${ICONS.check}</span>`
    card.addEventListener('click', () => claim(i))
    grid.append(card)
    return { card, btn: card.querySelector('.dr-btn'), shown: '' }
  })

  const status = (i) => (state.claimed.includes(i) ? 'claimed' : i === pending ? 'pending' : i < state.unlocked ? 'ready' : 'locked')

  function readyCount() {
    let n = 0
    for (let i = 0; i < DAILY.days.length; i++) if (status(i) === 'ready') n++
    return n
  }

  let lastCount = -1
  function notifyCount() {
    const n = readyCount()
    if (n !== lastCount) onReadyCount?.((lastCount = n))
  }

  function render() {
    DAILY.days.forEach((r, i) => {
      const c = cards[i]
      const st = status(i)
      if (st === c.shown) return
      c.shown = st
      for (const s of ['ready', 'pending', 'claimed', 'locked']) c.card.classList.toggle(s, s === st)
      c.btn.textContent = st === 'pending' ? '...' : 'Claim'
      c.card.setAttribute('aria-label', `Day ${i + 1}, ${r.title}: ${st === 'ready' ? 'claim' : st}`)
    })
    tick()
  }

  // --- Countdown + messages (footer left) ---------------------------------------------------
  let sayUntil = 0
  function say(text) {
    timer.textContent = text
    timer.classList.add('warn')
    replay(timer, 'shake')
    sayUntil = performance.now() + 2200
  }
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000))
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
  }
  function tick() {
    if (state.known && now() >= state.nextAt) nextDay()
    if (!win.isOpen() || performance.now() < sayUntil) return
    timer.classList.remove('warn')
    const days = DAILY.days.length
    let text = ''
    if (!state.known) text = hasServer() ? 'Connecting...' : ''
    else if (state.claimed.length >= days) text = `New rewards in ${clock(state.nextAt - now())}`
    else if (state.unlocked < days) text = `Day ${state.unlocked + 1} in ${clock(state.nextAt - now())}`
    else text = 'Claim your rewards!'
    if (timer.textContent !== text) timer.textContent = text
  }
  setInterval(tick, 1000)

  // A new UTC day started while playing: the server unlocks it (offline: the same rule here).
  function nextDay() {
    if (hasServer()) {
      if (!refreshSent) refreshSent = sendNet('dailyRefresh')
      return
    }
    const days = DAILY.days.length
    if (state.claimed.length >= days) {
      state.unlocked = 1
      state.claimed = []
    } else state.unlocked = Math.min(days, state.unlocked + 1)
    state.nextAt = (Math.floor(Date.now() / DAY_MS) + 1) * DAY_MS
    render()
    notifyCount()
  }

  // The calendar from the server (on join / identity change / a new day) or the offline start.
  let autoOpened = false
  function apply(m) {
    state.unlocked = Math.min(DAILY.days.length, Math.max(0, m.unlocked | 0))
    state.claimed = Array.isArray(m.claimed) ? m.claimed.filter((i) => Number.isInteger(i) && i >= 0 && i < state.unlocked) : []
    state.nextAt = Number.isFinite(m.nextAt) ? m.nextAt : 0
    state.offset = Number.isFinite(m.serverTime) ? m.serverTime - Date.now() : 0
    state.known = true
    refreshSent = false
    render()
    notifyCount()
    // Once per page: a day waiting to be claimed pops the window open (if nothing else is up).
    if (autoOpened || !DAILY.autoOpen || readyCount() === 0) return
    autoOpened = true
    setTimeout(() => {
      if (readyCount() > 0 && !anyWindowOpen() && canAutoOpen?.() !== false) win.open()
    }, DAILY.autoOpen * 1000)
  }

  onNetMessage('daily', apply)
  onNetMessage('dailyResult', (m) => {
    if (!m) return
    // A day this tab asked for (even one whose wait timed out) is granted when the answer is ok.
    const mine = asked.delete(m.day)
    if (m.day === pending) {
      clearTimeout(pendingTimer)
      pending = -1
    }
    if (m.unlocked !== undefined) apply(m)
    else render()
    if (!mine) return
    if (m.ok) return grant(m.day)
    replay(cards[m.day]?.card ?? timer, 'shake')
    say(m.reason === 'locked' ? 'Not unlocked yet!' : m.reason === 'save' ? "Couldn't save, try again!" : 'Still loading, try again!')
  })
  if (!hasServer()) apply({ unlocked: 1, claimed: [], nextAt: (Math.floor(Date.now() / DAY_MS) + 1) * DAY_MS })

  // Why a day can't be taken right now ('' = it can): pets need room in storage.
  function refuse(r) {
    const room = petsState.storage - petsState.pets.length
    if (r.type === 'pet' && room < 1) return 'Your pet storage is full!'
    if (r.type === 'egg' && room < r.n) return `Need ${r.n} free pet slots!`
    return ''
  }

  function claim(i) {
    const { card } = cards[i]
    const st = status(i)
    if (st === 'pending') return
    if (st !== 'ready') {
      replay(card, 'shake')
      if (st === 'locked') say(`Come back for Day ${i + 1}!`)
      return
    }
    const why = refuse(DAILY.days[i])
    if (why) {
      replay(card, 'shake')
      return say(why)
    }
    if (!hasServer()) {
      state.claimed.push(i)
      return grant(i)
    }
    if (pending >= 0 || !sendNet('claimDaily', { day: i })) {
      replay(card, 'shake')
      return say('Connecting to the server...')
    }
    pending = i
    asked.add(i)
    render()
    pendingTimer = setTimeout(() => {
      pending = -1
      render()
      say('No answer, try again!')
    }, 8000)
  }

  // The server said yes (or offline): hand the reward over.
  function grant(i) {
    const r = DAILY.days[i]
    const { card } = cards[i]
    render()
    notifyCount()
    if (r.type === 'egg') {
      win.close() // the hatch overlay plays over the game, not over this window
      return onReward?.(r)
    }
    if (r.type === 'potion') giftsState.potions[r.id] = (giftsState.potions[r.id] ?? 0) + 1
    else onReward?.(r)
    sfx.gift(r.type)
    burst(...centre(card), 'stars')
    replay(card, 'bump')
  }

  render()
  notifyCount()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, readyCount, state }
}
