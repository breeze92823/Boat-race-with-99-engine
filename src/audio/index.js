// Game audio, the one import the rest of the game uses:
//   import { sfx, installAudio, updateAudio } from './audio/index.js'
// installAudio() once at boot (waits for the first gesture to start), then
// updateAudio(dt, state) every frame for the engine, hull and ambience, and
// sfx.<name>() for one-shots. Every button press anywhere gets its click here
// (one capture-phase listener), so menus need no wiring of their own; the
// result sounds (buy, deny, equip) come from uiWindow.replay and hud.setStat.
import { BEACH } from '../config.js'
import { A, installAudio as installCore, onStart, setDucked, setMuted, setVolume, isMuted, toggleMuted } from './core.js'
import * as sfx from './sfx.js'
import * as engine from './engine.js'
import * as ambience from './ambience.js'

export { sfx, setVolume, setMuted, isMuted, toggleMuted }
export const engineBlip = engine.blip
export const engineRev = engine.rev

let racing = false
// Presses on anything clickable: chunky menu buttons, grid cards, HUD buttons, touch buttons.
function onPress(e) {
  if (e.button > 0) return
  const b = e.target.closest?.('button, [role="button"]')
  if (!b || b.disabled) return
  const pan = Math.max(-0.6, Math.min(0.6, (e.clientX / window.innerWidth - 0.5) * 1.2)) // a press on the left sounds left
  if (b.classList.contains('touch-btn')) {
    if (!racing) sfx.click(pan) // mid-race JUMP is a boost tap, which has its own sound
  } else if (b.classList.contains('uiw-btn') || b.classList.contains('race-leave')) sfx.press(pan)
  else if (b.getAttribute('role') === 'option' || b.closest('[role="listbox"], .pt-grid, .gf-grid, .bt-grid')) sfx.tick(pan)
  else if (b.classList.contains('hud-auto')) sfx.toggle(!b.classList.contains('on'))
  else if (b.classList.contains('hud-slot')) sfx.holster()
  else sfx.click(pan)
}

export function installAudio() {
  installCore()
  // After the core's unlock listener (same phase, registered later), so the context exists.
  window.addEventListener('pointerdown', onPress, { capture: true, passive: true })
}

// Feedback hooks for the shared UI pieces (see uiWindow.replay, hud.setStat):
// they wait one task so a specific sound fired in the same handler wins.
export function feedback(kind, el) {
  setTimeout(() => {
    if (kind === 'shake') return sfx.deny()
    if (sfx.claimedRecently()) return
    if (kind === 'spend') return sfx.purchase()
    if (kind === 'bump') {
      if (el?.classList.contains('pt-pet')) return el.closest('[data-mode]')?.dataset.mode === 'lock' ? sfx.lock() : sfx.pop(el.classList.contains('equipped'))
      if (el?.classList.contains('pt-plus') || el?.classList.contains('rb-val')) return
      return sfx.equip()
    }
    if (kind === 'tr-in') return sfx.sceneIn()
  }, 0)
}

// Per-frame state from main.js:
// { camera, player: { x, y, z, vy, grounded }, speed (m/s), top (m/s), boost, moving (0..1),
//   racing, staging, windowOpen, night }
const prev = { x: 0, y: 0, z: 0, grounded: true, vy: 0, onWater: false, init: false }
let started = false
onStart(() => (started = true))
export function updateAudio(dt, st) {
  racing = st.racing
  if (!started || !A.ctx || A.ctx.state !== 'running') return
  const p = st.player
  const onWater = st.racing ? p.z < BEACH.front : false
  if (prev.init) {
    // The boat leaves the pad and slams into the sea.
    if (onWater && !prev.onWater) sfx.splash(1.3)
    if (!st.racing && !st.staging) {
      if (prev.grounded && !p.grounded && p.vy > 2) sfx.jump()
      if (!prev.grounded && p.grounded && prev.vy < -3) sfx.land(Math.min(1, -prev.vy / 18))
      if (Math.hypot(p.x - prev.x, p.z - prev.z) > 12) sfx.respawnFx() // teleported (respawn)
    }
  }
  prev.x = p.x
  prev.y = p.y
  prev.z = p.z
  prev.grounded = p.grounded
  prev.vy = p.vy
  prev.onWater = onWater
  prev.init = true

  setDucked(st.windowOpen)
  const e = st.camera.matrixWorld.elements // camera right vector = first column
  const rl = Math.hypot(e[0], e[2]) || 1
  engine.update(dt, {
    speed: st.speed,
    top: st.top,
    boost: st.boost,
    moving: st.moving,
    racing: st.racing,
    onWater: onWater || st.staging,
    visible: st.visible,
  })
  ambience.update(dt, {
    x: st.camera.position.x,
    z: st.camera.position.z,
    rightX: e[0] / rl,
    rightZ: e[2] / rl,
    racing: st.racing,
    night: st.night,
  })
}
