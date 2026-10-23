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
      current = win
      shown = true
      clearTimeout(closing)
      overlay.classList.remove('closing')
      onOpen?.()
      overlay.hidden = false
      replay(dialog, 'pop')
      cardsIn(body)
      sfx.windowOpen()
      document.exitPointerLock?.() // the cursor has to be free to press the buttons
    },
    close() {
      if (!shown) return
      shown = false
      overlay.classList.add('closing') // juice.css: shrink + fade, then hidden
      closing = setTimeout(() => {
        overlay.hidden = true
        overlay.classList.remove('closing')
      }, 160)
      if (current === win) current = null
      onClose?.()
      sfx.windowClose()
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
