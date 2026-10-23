// UI "juice": small animations that make every press and reward feel good.
//  - press rings: a soft white ring where any button is pressed (outside races,
//    which have their own tap ripples)
//  - burst(x, y, kind): DOM particles flying out of a point: 'coins' (purchase),
//    'stars' (gifts, unlocks), 'sparks' (equip), 'big' (rebirth)
//  - flash(kind): a full-screen glow ('gold' record/rebirth, 'white')
//  - cardsIn(root): grid cards cascade in when a window opens
//  - lastPress(): where the last press happened (rewards burst from there)
// Pure DOM + WAAPI; fewer particles on touch screens. Styles in juice.css.
import './juice.css'
import { COARSE_POINTER, JUICE } from './config.js'

const layer = document.createElement('div')
layer.className = 'juice-layer'
document.body.append(layer)

const press = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
export const lastPress = () => press

let racing = false
export const setRacing = (on) => (racing = on)

window.addEventListener(
  'pointerdown',
  (e) => {
    press.x = e.clientX
    press.y = e.clientY
    if (racing || !e.target.closest?.('button, [role="button"]')) return
    const r = document.createElement('span')
    r.className = 'juice-ring'
    r.style.left = `${e.clientX}px`
    r.style.top = `${e.clientY}px`
    r.addEventListener('animationend', () => r.remove())
    layer.append(r)
  },
  { capture: true, passive: true },
)

const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5L7 14l-5.3-5 7.2-.9z" fill="currentColor" stroke="#1b1b2a" stroke-width="1.6" stroke-linejoin="round"/></svg>'
const COIN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffd21f" stroke="#1b1b2a" stroke-width="2"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#ff9d00" stroke-width="2"/><path d="M9 8.5l1.2 1" stroke="#fff6b0" stroke-width="2" stroke-linecap="round"/></svg>'
const KINDS = {
  coins: { n: JUICE.coins, html: COIN, size: [18, 30], speed: [220, 520], gravity: 900, life: 0.9, colors: null },
  stars: { n: JUICE.stars, html: STAR, size: [14, 28], speed: [180, 460], gravity: 500, life: 0.85, colors: ['#ffe14a', '#ffffff', '#5fe8ff', '#ff7ad9'] },
  sparks: { n: JUICE.sparks, html: null, size: [6, 11], speed: [140, 330], gravity: 200, life: 0.5, colors: ['#ffffff', '#b8ff5a', '#5fffb0'] },
  big: { n: JUICE.big, html: STAR, size: [18, 40], speed: [300, 900], gravity: 700, life: 1.3, colors: ['#ffe14a', '#ffffff', '#ffb21a', '#5fe8ff', '#ff7ad9'] },
}
const rnd = (lo, hi) => lo + Math.random() * (hi - lo)

// Particles out of (x, y) px.
export function burst(x, y, kind = 'stars') {
  const k = KINDS[kind] ?? KINDS.stars
  const n = Math.round(k.n * (COARSE_POINTER ? JUICE.touchScale : 1))
  for (let i = 0; i < n; i++) {
    const e = document.createElement('span')
    e.className = k.html ? 'juice-p' : 'juice-p dot'
    const size = rnd(...k.size)
    e.style.width = e.style.height = `${size}px`
    const color = k.colors ? k.colors[i % k.colors.length] : ''
    if (k.html) e.innerHTML = k.html
    else e.style.background = color
    e.style.color = color
    layer.append(e)
    const a = rnd(0, Math.PI * 2)
    const v = rnd(...k.speed)
    const vx = Math.cos(a) * v
    const vy = Math.sin(a) * v - v * 0.35 // a little upward bias
    const life = k.life * rnd(0.75, 1.15)
    const frames = []
    for (let f = 0; f <= 6; f++) {
      const t = (f / 6) * life
      const px = x + vx * t
      const py = y + vy * t + 0.5 * k.gravity * t * t
      const s = f === 0 ? 0.3 : f === 1 ? 1.15 : 1 - (f / 6) * 0.5
      frames.push({ transform: `translate(${px}px, ${py}px) translate(-50%, -50%) rotate(${(f / 6) * rnd(-400, 400)}deg) scale(${s})`, opacity: f < 4 ? 1 : 1 - (f - 3) / 3 })
    }
    const anim = e.animate(frames, { duration: life * 1000, easing: 'cubic-bezier(.15,.6,.4,1)', fill: 'forwards' })
    anim.onfinish = anim.oncancel = () => e.remove()
  }
}

// A full-screen glow that blooms and fades.
export function flash(kind = 'gold') {
  const f = document.createElement('div')
  f.className = `juice-flash ${kind}`
  f.addEventListener('animationend', () => f.remove())
  layer.append(f)
}

// Grid cards cascade in (window just opened): the first JUICE.cascade cards rise into place in turn.
export function cardsIn(root) {
  const cards = root.querySelectorAll('.pt-pet, .bt-tile, .gf-card, [role="option"]')
  const n = Math.min(cards.length, JUICE.cascade)
  // One forced layout for the whole batch (not one per card) to restart the animation.
  for (let i = 0; i < n; i++) cards[i].classList.remove('juice-in')
  void root.offsetWidth
  for (let i = 0; i < n; i++) {
    const c = cards[i]
    c.style.setProperty('--ji', i)
    c.classList.add('juice-in')
    c.addEventListener('animationend', () => c.classList.remove('juice-in'), { once: true })
  }
}

// Centre of an element (for bursts from a card or a counter).
export function centre(el) {
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}
