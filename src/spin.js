// Spin wheel (the reference's lucky-wheel popup) on the shared window shell, opened by the HUD's
// wheel round button or K. Frameless: the wheel itself is the window, red X on its top right,
// one green Spin (N) button under it (the reference's Robux x3 / x10 packs are left out).
// Five 72-degree wedges (SPIN.wedges, config): x2 Wins potion, 50 Wins, Luck potion, 250 Wins
// and the 0.1% HUGE pet.
// The server owns the spins and rolls every spin (backend spin.ts): it sends `spins`
// { spins, nextAt, serverTime } once the save has loaded, and answers each `spin` with
// `spinResult` { ok, id | reason, spins, nextAt, serverTime }. One free spin arrives every
// SPIN.freeEvery minutes (real time) until SPIN.cap are stored; this file only mirrors that clock
// for the countdown. The wheel then turns to the won wedge and the prize goes through onReward
// (main.js) when it stops, or at once if the window closes or the page hides mid-spin, so a
// spin the server has counted always pays out before net.js saves.
import { PETS, SPIN } from './config.js'
import { petPortrait, petsState } from './pets.js'
import { createWindow, replay, uiButton } from './uiWindow.js'
import { onNetMessage, sendNet } from './net.js'
import './spin.css' // after the shell's CSS
import { sfx } from './audio/index.js'
import { burst, centre, flash } from './juice.js'

const INK = '#1d1a22'
const C = 300 // wheel centre in its 600x600 viewBox
const R = 262 // wedge radius
const STEP = 360 / SPIN.wedges.length

// --- Art --------------------------------------------------------------------------------------
// Round glass flask of coloured liquid (the gift potions' look).
const flask = (color, light) => `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="58" y="4" width="20" height="20" rx="4" fill="#c8eeff" stroke="${INK}" stroke-width="5" transform="rotate(30 68 14)"/>
  <circle cx="48" cy="56" r="40" fill="#c8eeff" stroke="${INK}" stroke-width="5"/>
  <circle cx="48" cy="56" r="31" fill="${color}"/>
  <path d="M21 60 a27 27 0 0 0 42 21" fill="none" stroke="${light}" stroke-width="6" stroke-linecap="round" opacity=".75"/>
  <ellipse cx="58" cy="37" rx="12" ry="8" fill="#fff" transform="rotate(30 58 37)"/>
  <circle cx="33" cy="42" r="4" fill="#fff" opacity=".85"/></svg>`

// Gold "1" cup; `many` stacks a second one behind (the 250 Wins pile).
function trophy(many) {
  const cup = (dx, dy, s) => `<g transform="translate(${dx} ${dy}) scale(${s})">
    <path d="M26 14 H9 v7 a17 17 0 0 0 20 17 M74 14 h17 v7 a17 17 0 0 1 -20 17" fill="none" stroke="${INK}" stroke-width="13"/>
    <path d="M26 14 H9 v7 a17 17 0 0 0 20 17 M74 14 h17 v7 a17 17 0 0 1 -20 17" fill="none" stroke="#ffb31a" stroke-width="5.5"/>
    <g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <path d="M22 5 H78 V26 C78 44 66 54 50 54 C34 54 22 44 22 26 Z" fill="#ffc21a"/>
      <path d="M43 53 H57 V64 H43 Z" fill="#f29a00"/><path d="M27 64 H73 L77 78 H23 Z" fill="#ffc21a"/></g>
    <path d="M29 11 V27 C29 37 33 43 38 46" fill="none" stroke="#fff3a0" stroke-width="5" stroke-linecap="round"/>
    <text x="52" y="38" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="25" fill="#e8462e" stroke="#9a2a12" stroke-width="1.2">1</text></g>`
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${many ? cup(-6, 4, 0.78) + cup(28, 26, 0.78) : cup(0, 10, 1)}</svg>`
}

function prizeArt(w) {
  if (w.type === 'pet') return petPortrait(w.pet)
  if (w.type === 'potion') return w.potion === 'superLuck' ? flask('#2fbf4a', '#8ff0a0') : flask('#e8262e', '#ff7a7a')
  return trophy(w.n > 100)
}

// An SVG string placed as a size x size box centred on (x, y) inside the wheel's SVG.
const place = (svg, x, y, size) => svg.replace('<svg ', `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" `)

// Outlined wheel text (stroke painted under the fill).
const label = (text, y, size, fill = '#fff', extra = '') =>
  `<text x="${C}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" fill="${fill}" stroke="${INK}"
    stroke-width="${size * 0.22}" stroke-linejoin="round" paint-order="stroke fill" ${extra}>${text}</text>`

// One wedge drawn pointing straight up, then turned to its place: label on the rim, prize
// picture in the middle, odds towards the hub.
function wedgeSvg(w, i) {
  const a0 = (i * STEP * Math.PI) / 180
  const a1 = ((i + 1) * STEP * Math.PI) / 180
  const pt = (a) => `${(C + R * Math.sin(a)).toFixed(2)} ${(C - R * Math.cos(a)).toFixed(2)}`
  const pet = w.type === 'pet'
  const art = place(prizeArt(w), C, C - R * (pet ? 0.5 : 0.56), pet ? 118 : 104)
  const rim = pet
    ? label(w.label, C - R * 0.86, 30, 'url(#sw-gold)') + label(w.tag, C - R * 0.72, 40, '#ffe600')
    : label(w.label, C - R * 0.84, 34)
  return `<path d="M${C} ${C} L${pt(a0)} A${R} ${R} 0 0 1 ${pt(a1)} Z" fill="${w.color}"/>
    <path d="M${C} ${C} L${pt(a0)} A${R} ${R} 0 0 1 ${pt(a1)} Z" fill="url(#sw-shade)"/>
    <g transform="rotate(${i * STEP + STEP / 2} ${C} ${C})">${rim}${art}${label(w.chance, C - R * 0.24, 26)}</g>`
}

const WHEEL = `<svg class="sw-wheel" viewBox="0 0 600 600" aria-hidden="true">
  <defs>
    <radialGradient id="sw-shade"><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></radialGradient>
    <linearGradient id="sw-gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8a1a"/><stop offset=".5" stop-color="#ffd21a"/><stop offset="1" stop-color="#7dff3a"/></linearGradient>
  </defs>
  <rect x="52" y="52" width="496" height="496" rx="46" fill="#b9d6f7" stroke="#7aa6dc" stroke-width="6"/>
  <circle cx="${C}" cy="${C}" r="292" fill="#d8eaff" stroke="#8db6e6" stroke-width="6"/>
  <circle cx="${C}" cy="${C}" r="${R + 6}" fill="${INK}"/>
  <g class="sw-rot">
    ${SPIN.wedges.map(wedgeSvg).join('')}
    ${SPIN.wedges.map((_, i) => `<line x1="${C}" y1="${C}" x2="${C}" y2="${C - R}" stroke="${INK}" stroke-width="7" transform="rotate(${i * STEP} ${C} ${C})"/>`).join('')}
  </g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${INK}" stroke-width="8"/>
  <circle cx="${C}" cy="${C}" r="20" fill="#f4f8ff" stroke="${INK}" stroke-width="6"/>
</svg>`

const POINTER = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M10 14 Q50 2 90 14 L54 92 Q50 98 46 92 Z" fill="#e8262e" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M22 18 Q50 10 78 18 L56 40 H44 Z" fill="#ff6a6a"/></svg>`

const BODY = `
  <div class="sw-stage">
    ${WHEEL}
    <div class="sw-pointer">${POINTER}</div>
    <div class="sw-win" hidden><div class="sw-win-card"><span class="sw-win-icon"></span><span class="sw-win-text uiw-text"></span></div></div>
  </div>
  <div class="sw-foot"><div class="sw-note uiw-text"></div></div>`

// 754 s -> "12:34".
function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const prizeName = (w) =>
  w.type === 'pet' ? `HUGE ${PETS.kinds[w.pet].name}!` : w.type === 'potion' ? `${w.label === 'LUCK' ? 'Luck' : 'x2 Wins'} Potion!` : `+${w.n} Wins!`

// onReward(wedge) grants a prize; returning false refuses it (pet storage full). onCount(n) feeds
// the HUD wheel button's badge. Returns { open, close, toggle, isOpen, spins }.
export function createSpin({ onReward, onCount } = {}) {
  const win = createWindow({ title: 'Spin!', className: 'sw-window', onOpen: () => render(), onClose: () => finish() })
  win.body.innerHTML = BODY
  const rot = win.body.querySelector('.sw-rot')
  const pointer = win.body.querySelector('.sw-pointer')
  const winBox = win.body.querySelector('.sw-win')
  const winIcon = win.body.querySelector('.sw-win-icon')
  const winText = win.body.querySelector('.sw-win-text')
  const note = win.body.querySelector('.sw-note')
  const spinBtn = uiButton('Spin', 'green', () => spin(), 'sw-spin')
  note.before(spinBtn)

  // Server state (null until the save has loaded): spins, nextAt (server ms), offset = server - local clock.
  let state = null
  const serverNow = () => Date.now() + (state?.offset ?? 0)
  function take(m) {
    if (!m || !Number.isFinite(m.spins) || !Number.isFinite(m.nextAt)) return
    state = { spins: m.spins, nextAt: m.nextAt, offset: Number.isFinite(m.serverTime) ? m.serverTime - Date.now() : 0 }
  }
  // The server's free-spin clock (spin.ts accrue), for the countdown and the badge.
  function accrue() {
    if (!state) return
    const every = SPIN.freeEvery * 60e3
    const now = serverNow()
    while (state.spins < SPIN.cap && now >= state.nextAt) {
      state.spins++
      state.nextAt += every
    }
    if (state.spins >= SPIN.cap) state.nextAt = now + every
  }

  let angle = 0 // wheel turn, degrees clockwise
  let anim = 0 // rAF id while turning
  let waiting = 0 // timeout id while the server is asked
  let pending = null // a won wedge not granted yet
  let warnUntil = 0

  const busy = () => !!(anim || waiting)

  function render() {
    accrue()
    const n = state?.spins ?? 0
    spinBtn.innerHTML = `Spin (${n})`
    spinBtn.classList.toggle('off', !state || n < 1 || busy())
    spinBtn.setAttribute('aria-label', `Spin the wheel, ${n} spin${n === 1 ? '' : 's'} left`)
    if (performance.now() >= warnUntil) {
      note.classList.remove('warn')
      note.textContent = !state ? 'Connecting...' : n >= SPIN.cap ? 'Max free spins stored!' : `Free spin in ${clock(state.nextAt - serverNow())}`
    }
  }

  let lastCount = -1
  function notifyCount() {
    const n = state?.spins ?? 0
    if (n !== lastCount) onCount?.((lastCount = n))
  }

  function say(text) {
    note.textContent = text
    note.classList.add('warn')
    replay(note, 'shake')
    warnUntil = performance.now() + 2200
  }

  function setAngle(a) {
    angle = a
    rot.setAttribute('transform', `rotate(${a.toFixed(2)} ${C} ${C})`)
  }

  function spin() {
    if (busy()) return
    winBox.hidden = true
    if (!state) return replay(spinBtn, 'shake'), say("Can't reach the server yet!")
    accrue()
    if (state.spins < 1) return replay(spinBtn, 'shake'), say(`Next free spin in ${clock(state.nextAt - serverNow())}`)
    if (petsState.pets.length >= petsState.storage) return replay(spinBtn, 'shake'), say('Your pet storage is full!')
    if (!sendNet('spin')) return replay(spinBtn, 'shake'), say("Can't reach the server!")
    waiting = setTimeout(() => {
      waiting = 0
      say("The server didn't answer. Try again!")
      render()
    }, SPIN.timeout * 1000)
    render()
  }

  // The server's answer to `spin`.
  function onResult(m) {
    const wasWaiting = !!waiting
    clearTimeout(waiting)
    waiting = 0
    take(m)
    notifyCount()
    if (!m?.ok) {
      replay(spinBtn, 'shake')
      say(m?.reason === 'none' ? 'No spins left!' : "Can't spin right now!")
      return render()
    }
    const w = SPIN.wedges.find((x) => x.id === m.id)
    if (!w) return render()
    pending = w
    // Answered after the window closed or the wait gave up: the spin was used, so pay out now.
    if (!wasWaiting || !win.isOpen()) return settle(true)
    turnTo(SPIN.wedges.indexOf(w))
    render()
  }

  // Turn SPIN.turns times and stop with the pointer somewhere inside wedge i.
  function turnTo(i) {
    const jitter = (Math.random() - 0.5) * STEP * 0.7
    const target = i * STEP + STEP / 2 + jitter // wheel angle that must sit under the pointer
    const from = angle
    const to = from + SPIN.turns * 360 + ((((-target - from) % 360) + 360) % 360)
    const start = performance.now()
    let wedge = Math.floor(from / STEP)
    sfx.swish()
    const frame = (now) => {
      const t = Math.min(1, (now - start) / (SPIN.seconds * 1000))
      setAngle(from + (to - from) * (1 - Math.pow(1 - t, 4)))
      const at = Math.floor(angle / STEP)
      if (at !== wedge) {
        wedge = at
        sfx.tick()
        replay(pointer, 'flick')
      }
      if (t < 1) anim = requestAnimationFrame(frame)
      else {
        anim = 0
        settle()
      }
    }
    anim = requestAnimationFrame(frame)
  }

  // Grants the won prize (at the stop, or `quiet` when the window is gone).
  function settle(quiet = false) {
    const w = pending
    if (!w) return
    pending = null
    const ok = onReward?.(w) !== false
    render()
    if (quiet || !win.isOpen()) return
    if (!ok) return say('Your pet storage is full!')
    winIcon.innerHTML = prizeArt(w)
    winText.textContent = prizeName(w)
    winBox.hidden = false
    replay(winBox.firstElementChild, 'pop')
    sfx.gift(w.type)
    const [x, y] = centre(winBox.firstElementChild)
    if (w.type === 'pet') {
      flash('gold')
      burst(x, y, 'big')
    } else burst(x, y, w.n > 100 ? 'big' : 'stars')
  }

  // The window closed: snap to the end and pay out.
  function finish() {
    if (anim) {
      cancelAnimationFrame(anim)
      anim = 0
    }
    settle(true)
    winBox.hidden = true
  }
  winBox.addEventListener('pointerdown', () => (winBox.hidden = true))
  // A spin still turning when the page goes away pays out before net.js's save (registered after this).
  window.addEventListener('pagehide', finish)
  document.addEventListener('visibilitychange', () => document.hidden && finish())

  onNetMessage('spins', (m) => {
    take(m)
    render()
    notifyCount()
  })
  onNetMessage('spinResult', onResult)

  setInterval(() => {
    accrue()
    notifyCount()
    if (win.isOpen()) render()
  }, 1000)

  render()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, spins: () => state?.spins ?? 0 }
}
