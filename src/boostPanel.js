// "Boosts!" window (the HUD's three boost circles open it): where every boost
// comes from and what it adds up to, so the values in the Engine / Boats /
// Partner / Trails / Rebirth / Pets windows visibly mean something. One row per
// source (boosts.js), the pets' multiplier, a total row, and four summary
// tiles: race Wins multiplier, top speed, lucky-checkpoint chance, training.
import './boostPanel.css'
import { boosts, boostSources } from './boosts.js'
import { ICONS } from './hudIcons.js'
import { createWindow } from './uiWindow.js'

const ICON = `<svg viewBox="0 0 80 100" aria-hidden="true"><g stroke="#1d1a22" stroke-width="5" stroke-linejoin="round"><path d="M6 72 L40 44 L74 72 L74 92 L40 66 L6 92 Z" fill="#39bd5c"/><path d="M6 36 L40 6 L74 36 L74 56 L40 30 L6 56 Z" fill="#39bd5c"/></g></svg>`
const CLOVER = `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#3fdc5a" stroke="#1b1b2a" stroke-width="3.5"><circle cx="22" cy="22" r="12"/><circle cx="42" cy="22" r="12"/><circle cx="22" cy="42" r="12"/><circle cx="42" cy="42" r="12"/></g><path d="M32 34 40 60" stroke="#1b1b2a" stroke-width="6" stroke-linecap="round"/><path d="M32 34 40 60" stroke="#2fa84a" stroke-width="3" stroke-linecap="round"/></svg>`

// 1234 -> "1.2K" (the windows' short style).
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
function short(n) {
  let i = 0
  while (Math.abs(n) >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  return `${i === 0 ? Math.round(n) : Math.floor(n * 10) / 10}${SUFFIXES[i]}`
}
const pct = (n) => (n > 0 ? `+${short(n)}%` : '0')
const times = (k) => `x${k >= 100 ? short(k) : k.toFixed(2)}`

const COLS = [
  ['wins', 'Wins', ICONS.trophy],
  ['acc', 'Acc', ICONS.rocket],
  ['luck', 'Luck', CLOVER],
  ['train', 'Train', ICONS.bolt],
]

export function createBoostPanel() {
  const win = createWindow({ title: 'Boosts!', icon: ICON, className: 'bp-window', onOpen: () => render() })
  win.body.innerHTML = `<div class="uiw-box bp-box"><div class="bp-grid"></div></div><div class="bp-tiles"></div>`
  const grid = win.body.querySelector('.bp-grid')
  const tiles = win.body.querySelector('.bp-tiles')

  const cell = (cls, html) => `<div class="bp-cell ${cls}">${html}</div>`
  const textCell = (cls, value) => cell(cls, `<span class="uiw-text">${value}</span>`)

  function render() {
    const sources = boostSources()
    const b = boosts()
    let html = cell('bp-head bp-name', '')
    for (const [, label, icon] of COLS) html += cell('bp-head', `<span class="bp-icon">${icon}</span><span class="uiw-text">${label}</span>`)
    for (const s of sources) {
      html += textCell(`bp-name${s.wins || s.acc || s.luck || s.train ? '' : ' bp-empty'}`, s.name)
      for (const [key] of COLS) html += textCell(`bp-val ${key}${s[key] > 0 ? '' : ' bp-zero'}`, pct(s[key]))
    }
    html += textCell('bp-name', `Pets (${b.petCount})`) + textCell(`bp-val wins${b.pets > 1 ? '' : ' bp-zero'}`, b.pets > 1 ? times(b.pets) : '0') + textCell('bp-val bp-zero', '0').repeat(3)
    html += textCell('bp-name bp-total', 'Total')
    html += textCell('bp-val wins bp-total', times(b.wins))
    html += textCell('bp-val acc bp-total', pct((b.acc - 1) * 100))
    html += textCell('bp-val luck bp-total', pct(b.luck))
    html += textCell('bp-val train bp-total', pct((b.train - 1) * 100))
    grid.innerHTML = html

    const tile = (cls, icon, value, label) =>
      `<div class="bp-tile ${cls}"><span class="bp-tile-icon">${icon}</span><span class="uiw-text bp-tile-val">${value}</span><span class="uiw-text bp-tile-label">${label}</span></div>`
    tiles.innerHTML =
      tile('wins', ICONS.trophy, times(b.wins), 'Race Wins') +
      tile('acc', ICONS.rocket, b.speed > 1 ? `+${short((b.speed - 1) * 100)}%` : '+0%', 'Top Speed') +
      tile('luck', CLOVER, `${Math.round(b.lucky * 100)}%`, 'Lucky x2') +
      tile('train', ICONS.bolt, times(b.train), 'Training')
  }

  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen }
}
