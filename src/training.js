import './training.css'
import { Vector3 } from 'three'
import { TRAIN } from './config.js'
import { boosts } from './boosts.js'
import { ICONS } from './hudIcons.js'
import { sfx } from './audio/index.js'
import { burst, centre } from './juice.js'

// Training: the plaza's treadmill lanes (plaza.lanes) pay lightning. Standing
// on an unlocked lane (its `req` in Wins = the HUD's trophies) pays its `power`
// every TRAIN.tick s; AUTO TRAIN pays TRAIN.autoRate of the best unlocked lane
// anywhere (also mid-race). Both are times the train boost (boosts.js). Gains
// are whole bolts (fractions carry over) handed to onGain(n), which adds them to
// the rebirth energy = the HUD's bolt counter = race speed (main.js).
// Feedback: a "+N" bolt floats off the boat and the bolt counter bumps; driving
// onto a locked lane says what it needs; a lane unlocking says so.
// hud: { root, getStat }. plaza: { lanes, setUnlocked }.
export function createTraining({ hud, plaza, onGain }) {
  const lanes = plaza.lanes
  const isOpen = (l) => hud.getStat('trophies') >= l.req
  const boltRow = hud.root.querySelector('.stat-wins')
  const at = new Vector3()

  const toast = document.createElement('div')
  toast.className = 'train-toast'
  hud.root.append(toast)
  function say(html) {
    toast.innerHTML = html
    toast.classList.remove('show')
    void toast.offsetWidth
    toast.classList.add('show')
  }

  // "+N" bolt rising from (x, y) px.
  function popup(n, x, y) {
    const e = document.createElement('div')
    e.className = 'train-pop'
    e.innerHTML = `<span class="train-pop-bolt">${ICONS.bolt}</span><span class="grad train-pop-num"></span>`
    const num = e.lastChild
    num.textContent = num.dataset.t = `+${n}`
    e.style.left = `${x}px`
    e.style.top = `${y}px`
    e.style.animationDuration = `${TRAIN.popupSeconds}s`
    e.addEventListener('animationend', () => e.remove())
    hud.root.append(e)
    sfx.zap(n)
    if (boltRow) {
      boltRow.classList.remove('race-bump')
      void boltRow.offsetWidth
      boltRow.classList.add('race-bump')
    }
  }

  // The lane under the feet (x, z in its own frame inside the half extents, on top of it).
  function laneAt(p) {
    if (p.y < 0.4) return null
    for (const l of lanes) {
      const dx = p.x - l.x
      const dz = p.z - l.z
      const c = Math.cos(l.yaw)
      const s = Math.sin(l.yaw)
      if (Math.abs(dx * c - dz * s) < l.halfW && Math.abs(dx * s + dz * c) < l.halfL) return l
    }
    return null
  }

  let timer = 0
  let carry = 0
  let warned = null // the locked lane we already spoke about (until the player leaves it)
  let unlocked = -1 // lanes open at the last check; -1 = not checked yet
  let auto = false

  function refreshLocks() {
    let n = 0
    let newest = null
    for (const l of lanes) {
      if (isOpen(l)) {
        n++
        newest = l
      }
    }
    if (n === unlocked) return
    if (unlocked >= 0 && n > unlocked) {
      say(`New lane unlocked! <b>+${newest.power} Power</b>`)
      sfx.unlock()
      requestAnimationFrame(() => burst(...centre(toast), 'stars'))
    }
    unlocked = n
    plaza.setUnlocked(isOpen)
  }
  refreshLocks()

  return {
    setAuto(on) {
      auto = on
    },
    // p: the player's feet; camera: for the popup position; racing: no lane training mid-race.
    update(dt, p, camera, racing) {
      const lane = racing ? null : laneAt(p)
      if (lane && !isOpen(lane)) {
        if (warned !== lane) {
          say(`🔒 Need <b>${lane.reqText} Wins</b> to train here`)
          sfx.deny()
        }
        warned = lane
      } else warned = null

      timer += dt
      if (timer < TRAIN.tick) return
      timer %= TRAIN.tick
      refreshLocks()
      let rate = lane && isOpen(lane) ? lane.power : 0
      if (auto) {
        let best = 0
        for (const l of lanes) if (isOpen(l)) best = Math.max(best, l.power)
        rate = Math.max(rate, best * TRAIN.autoRate)
      }
      if (rate <= 0) return
      carry += rate * boosts().train
      const n = Math.floor(carry)
      if (n <= 0) return
      carry -= n
      onGain(n)
      at.set(p.x, p.y + 2.6, p.z).project(camera)
      popup(n, ((at.x + 1) / 2) * window.innerWidth, ((1 - at.y) / 2) * window.innerHeight)
    },
  }
}
