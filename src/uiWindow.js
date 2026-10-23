// Shared popup window shell (styles in uiWindow.css), first built for the Rebirth
// window and reused by every menu window so they stay identical: blurred backdrop,
// white bordered frame, outlined title + icon on the top-left edge, tilted red X.
// The caller fills `body`. Only one window is open at a time; Esc closes it
// (main.js routes Esc through closeTopWindow before the portal menu).
// Opening whooshes in (sound + backdrop fade + cards cascading in), closing
// shrinks out; replay()'s shake / bump also play the deny / equip sounds.
import './uiWindow.css'
import { feedback, sfx } from './audio/index.js'
import { burst, cardsIn, centre } from './juice.js'

const CLOSE_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M30 30 L70 70 M70 30 L30 70" stroke="#3b0606" stroke-width="20" transform="translate(-3 5)"/>
  <path d="M30 30 L70 70 M70 30 L30 70" stroke="#fff" stroke-width="20"/>
</svg>`

let current = null // the open window, if any

// Restarts a one-shot CSS animation class ('pop', 'shake', 'bump').
export function replay(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
  feedback(cls, el)
  // Something just got equipped / claimed: sparks fly off it.
  if (cls === 'bump' && el.isConnected && !el.matches('.rb-val, .pt-plus')) burst(...centre(el), 'sparks')
}

// Closes the open window. Returns true if there was one (so Esc can stop there).
export function closeTopWindow() {
  if (!current) return false
  current.close()
  return true
}

export const anyWindowOpen = () => !!current

// Boxity's toolbar (setWindowReserved: the reserved areas from bloxity.onReservedAreas) sits
// over the top-left corner, over the whole top edge on narrow phones. An open window whose
// frame, title or X would reach under it is fitted into the screen below it instead
// (--uiw-top on its overlay, uiWindow.css). The chat feed under the toolbar is left out:
// clearing it too would leave a landscape phone almost no height for the window.
const TOOLBAR_GAP = 8 // px kept clear under the toolbar
let toolbar = null
export function setWindowReserved(areas) {
  toolbar = areas.find((a) => a.id === 'toolbar') ?? null
  if (current) fitClear(current)
}
window.addEventListener('resize', () => current && fitClear(current))

function fitClear({ overlay, dialog }) {
  overlay.style.removeProperty('--uiw-top')
  if (!toolbar || !toolbar.width || !toolbar.height) return
  // The frame plus what hangs off it, from offsets (the pop / close animations scale it).
  const x = dialog.offsetLeft
  const y = dialog.offsetTop
  const box = { left: x, top: y, right: x + dialog.offsetWidth, bottom: y + dialog.offsetHeight }
  for (const e of dialog.querySelectorAll(':scope > .uiw-title, :scope > .uiw-close')) {
    box.left = Math.min(box.left, x + e.offsetLeft)
    box.top = Math.min(box.top, y + e.offsetTop)
    box.right = Math.max(box.right, x + e.offsetLeft + e.offsetWidth)
  }
  const bottom = toolbar.top + toolbar.height
  const under = box.left < toolbar.left + toolbar.width && toolbar.left < box.right && box.top < bottom + TOOLBAR_GAP
  if (under) overlay.style.setProperty('--uiw-top', `${bottom + TOOLBAR_GAP}px`)
}

// A chunky game button. color: 'green' | 'red'. html may contain <br>.
export function uiButton(html, color, onClick, className = '') {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `uiw-btn uiw-text ${color} ${className}`.trim()
  b.innerHTML = html
  b.addEventListener('click', onClick)
  return b
}

// options: { title, icon (svg markup), className (added to the overlay; set
// --uiw-w / --uiw-h there for another size), onOpen, onClose }.
// Returns { overlay, dialog, body, open, close, toggle, isOpen }.
export function createWindow({ title, icon = '', className = '', onOpen, onClose } = {}) {
  const overlay = document.createElement('div')
  overlay.className = `uiw-overlay ${className}`.trim()
  overlay.hidden = true

  const dialog = document.createElement('div')
  dialog.className = 'uiw-dialog'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', title)

  const head = document.createElement('div')
  head.className = 'uiw-title'
  head.innerHTML = `<span class="uiw-title-icon">${icon}</span><h2 class="uiw-text"></h2>`
  head.querySelector('h2').textContent = title

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'uiw-close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.innerHTML = CLOSE_ICON

  const body = document.createElement('div')
  body.className = 'uiw-body'

  dialog.append(head, closeBtn, body)
  overlay.append(dialog)
  document.body.append(overlay)

  let shown = false
  let closing = 0 // timer that hides the overlay once its close animation has played
  const win = {
    overlay,
    dialog,
    body,
    isOpen: () => shown,
    open() {
      if (shown) return
      if (current && current !== win) current.close()
      // Sound first: the render + layout below can take a while on a phone, and the
      // whoosh should land with the press, not after it.
      sfx.windowOpen()
      current = win
      shown = true
      document.body.classList.add('uiw-open') // hud.css folds the HUD away on touch
      clearTimeout(closing)
      overlay.classList.remove('closing')
      onOpen?.()
      overlay.hidden = false
      fitClear(win)
      replay(dialog, 'pop')
      cardsIn(body)
      document.exitPointerLock?.() // the cursor has to be free to press the buttons
    },
    close() {
      if (!shown) return
      sfx.windowClose()
      shown = false
      overlay.classList.add('closing') // juice.css: shrink + fade, then hidden
      closing = setTimeout(() => {
        overlay.hidden = true
        overlay.classList.remove('closing')
      }, 160)
      if (current === win) current = null
      if (!current) document.body.classList.remove('uiw-open')
      onClose?.()
    },
    toggle: () => (win.isOpen() ? win.close() : win.open()),
  }

  closeBtn.addEventListener('click', win.close)
  // A tap on the world around the window closes it.
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) win.close()
  })
  return win
}
