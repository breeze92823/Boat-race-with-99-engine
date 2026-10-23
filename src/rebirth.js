// Rebirth window (the reference's "Rebirth!" popup) on the shared window shell
// (uiWindow.js). A rebirth spends the energy (lightning) total and adds
// REBIRTH.boostPerRebirth % of permanent boost; auto rebirth fires whenever the
// energy reaches the cost. State is saved by the server (snapshot / hydrate, net.js).
// The energy is the player's lightning: the HUD's bolt counter and race speed
// (main.js mirrors it through onChange); a new player starts with REBIRTH.startEnergy.
// The HUD's Rebirth tile and the B key open it (main.js).
import './rebirth.css'
import { REBIRTH } from './config.js'
import { createWindow, replay, uiButton } from './uiWindow.js'
import { sfx } from './audio/index.js'
import { burst, flash } from './juice.js'

// Rebirth icon (shared with Chop-trees-for-treasure): public/ui/rebirth.png.
export const REBIRTH_ICON = `<img src="${import.meta.env.BASE_URL}ui/rebirth.png" alt="" draggable="false">`

const ICONS = {
  // Two stacked green chevrons (boost %).
  boost: `<svg viewBox="0 0 80 100" aria-hidden="true">
    <g stroke="#1d1a22" stroke-width="5" stroke-linejoin="round">
      <path d="M6 72 L40 44 L74 72 L74 92 L40 66 L6 92 Z" fill="#39bd5c"/>
      <path d="M6 36 L40 6 L74 36 L74 56 L40 30 L6 56 Z" fill="#39bd5c"/>
    </g>
    <path d="M10 70 L40 48 L70 70 L70 78 L40 56 L10 78 Z" fill="#85ea8d"/>
    <path d="M10 34 L40 10 L70 34 L70 42 L40 20 L10 42 Z" fill="#85ea8d"/>
  </svg>`,
  arrow: `<svg viewBox="0 0 104 46" aria-hidden="true">
    <defs><linearGradient id="rb-arrow-grad" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#ffb300"/><stop offset="0.55" stop-color="#ff6a00"/><stop offset="1" stop-color="#fc2105"/>
    </linearGradient></defs>
    <path d="M4 15 H64 V4 L100 23 L64 42 V31 H4 Z" fill="url(#rb-arrow-grad)" stroke="#3a1405" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M8 18 H66 V11" fill="none" stroke="#ffd36a" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
  </svg>`,
  bolt: `<svg viewBox="0 0 70 100" aria-hidden="true">
    <path d="M44 3 L8 56 H31 L20 97 L64 38 H41 L54 3 Z" fill="#28d2fd" stroke="#1d1a22" stroke-width="5" stroke-linejoin="round"/>
    <path d="M44 9 L16 51 H31 Z" fill="#9af0ff"/>
    <path d="M47 43 H56 L30 80 Z" fill="#75e8ff"/>
  </svg>`,
}

export const rebirthState = { rebirths: 0, energy: 0, auto: false }

export const rebirthCost = (n) => Math.round((REBIRTH.baseCost * REBIRTH.costGrowth ** n) / 10) * 10
export const rebirthBoost = (n) => n * REBIRTH.boostPerRebirth // percent

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

let onChange = null // fn(rebirthState) after every change (createRebirth's option)

// The saved part (net.js; backend sanitize.ts).
export const snapshot = () => ({ energy: rebirthState.energy, rebirths: rebirthState.rebirths, autoRebirth: rebirthState.auto })

// A loaded save over a fresh start (a new player has REBIRTH.startEnergy lightning).
function applySave(s) {
  rebirthState.rebirths = Number.isFinite(s.rebirths) && s.rebirths >= 0 ? Math.floor(s.rebirths) : 0
  rebirthState.energy = Number.isFinite(s.energy) && s.energy >= 0 ? s.energy : REBIRTH.startEnergy
  rebirthState.auto = s.autoRebirth === true
}

function changed() {
  onChange?.(rebirthState)
}

// One "icon + outlined pill" value; tone 'pink' | 'green'.
const stat = (key, tone, icon) =>
  `<div class="rb-stat"><span class="rb-pill"><span class="rb-val uiw-text ${tone}" data-rb="${key}"></span></span>` +
  `<span class="rb-icon ${tone}">${icon}</span></div>`
const arrow = `<span class="rb-arrow">${ICONS.arrow}</span>`

const BODY = `
  <div class="uiw-heading uiw-text rb-receive">You Receive:</div>
  <div class="uiw-box rb-box">
    <div class="rb-row">${stat('rebirths', 'pink', REBIRTH_ICON)}${arrow}${stat('nextRebirths', 'pink', REBIRTH_ICON)}</div>
    <div class="rb-row">${stat('boost', 'green', ICONS.boost)}${arrow}${stat('nextBoost', 'green', ICONS.boost)}</div>
  </div>
  <div class="uiw-heading uiw-text rb-need">You Need:</div>
  <div class="rb-bar">
    <div class="rb-bar-track"><div class="rb-bar-fill"></div></div>
    <span class="rb-bar-text uiw-text" data-rb="need"></span>
    <span class="rb-bolt">${ICONS.bolt}</span>
  </div>`

// Builds the window. Returns { open, close, toggle, isOpen, addEnergy, snapshot, hydrate }.
// options.onChange(state) runs now and after every change (energy, rebirths).
export function createRebirth(options = {}) {
  applySave({}) // a new player's state until the server's save loads (hydrate)
  onChange = options.onChange ?? null
  onChange?.(rebirthState)

  const win = createWindow({ title: 'Rebirth!', icon: REBIRTH_ICON, className: 'rb-window', onOpen: () => render() })
  win.body.innerHTML = BODY
  const bar = win.body.querySelector('.rb-bar')
  const fill = win.body.querySelector('.rb-bar-fill')
  const field = {}
  for (const el of win.body.querySelectorAll('[data-rb]')) field[el.dataset.rb] = el

  const autoBtn = uiButton('AUTO REBIRTH<br><span data-rb="auto">OFF</span>', 'red', toggleAuto, 'small-text rb-auto')
  field.auto = autoBtn.querySelector('[data-rb]')
  const buttons = document.createElement('div')
  buttons.className = 'uiw-btns rb-buttons'
  buttons.append(uiButton('Rebirth', 'green', rebirth), autoBtn)
  win.body.append(buttons)

  function render() {
    const { rebirths, energy, auto } = rebirthState
    const cost = rebirthCost(rebirths)
    field.rebirths.textContent = short(rebirths)
    field.nextRebirths.textContent = short(rebirths + 1)
    field.boost.textContent = `${short(rebirthBoost(rebirths))}%`
    field.nextBoost.textContent = `${short(rebirthBoost(rebirths + 1))}%`
    field.need.textContent = `${short(energy)} / ${short(cost)}`
    fill.style.width = `${Math.min(energy / cost, 1) * 100}%`
    field.auto.textContent = auto ? 'ON' : 'OFF'
    autoBtn.classList.toggle('green', auto)
    autoBtn.classList.toggle('red', !auto)
    autoBtn.setAttribute('aria-pressed', String(auto))
  }

  function rebirth() {
    const cost = rebirthCost(rebirthState.rebirths)
    if (rebirthState.energy < cost) {
      replay(bar, 'shake')
      return false
    }
    rebirthState.rebirths++
    rebirthState.energy = 0 // a rebirth spends everything
    sfx.rebirth() // swell, boom, chord, crowd (before the counter drops, so no purchase sound)
    setTimeout(() => {
      flash('gold')
      burst(window.innerWidth / 2, window.innerHeight / 2, 'big')
    }, 740) // on the boom
    changed()
    render()
    for (const el of win.body.querySelectorAll('.rb-val')) replay(el, 'bump')
    return true
  }

  function toggleAuto() {
    rebirthState.auto = !rebirthState.auto
    if (!(rebirthState.auto && rebirth())) {
      changed()
      render()
    }
  }

  // Energy comes from training (training.js) and gifts, and is spent by rebirths
  // and trail purchases (a negative amount); auto rebirth fires as soon as it is enough.
  function addEnergy(amount) {
    rebirthState.energy = Math.max(0, rebirthState.energy + amount)
    if (!(rebirthState.auto && rebirthState.energy >= rebirthCost(rebirthState.rebirths) && rebirth())) {
      changed()
      if (win.isOpen()) render()
    }
  }

  // A save loaded from the server (net.js).
  function hydrate(doc) {
    applySave(doc)
    changed()
    render()
  }

  render()
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, addEnergy, snapshot, hydrate }
}
