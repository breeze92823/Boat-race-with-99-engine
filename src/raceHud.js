// In-race HUD pieces from the reference screenshot, added to the main HUD
// (hud.js) while a race runs (race.js):
//   - speedometer under the boat: rainbow arc, 0 / quarter / top-speed ticks,
//     white needle, current speed
//   - "↑ 770 Studs" distance callout to its upper right
//   - the red Leave button to its right
//     (Leave sits left of the gauge on touch, clear of JUMP/RUN/CAM)
//   - white speed streaks at the screen edges, stronger the faster you go
//   - the result card when the race ends
//   - "Top Speed 145 -> 236!" when a race starts faster than the last one (training paid off),
//     "NEW RECORD!" when the race passes the personal best
//   - "Next 🏆+9 at 9K" under the studs callout: the next checkpoint and its pay
//   - tap boost: "TAP!" inside the speedometer arc until you tap, then "+18%";
//     a boosted gauge glows and its needle shakes; every tap leaves a ripple
//   - the checkpoint reward: a trophy "+N" under the studs callout, trophies
//     flying from the boat into the trophy counter (which counts up as each
//     lands) and a burst of confetti
// Sizes are reference pixels times the HUD's --u; styles in race.css.
import './race.css'
import { COARSE_POINTER, RACE } from './config.js'
import { ICONS } from './hudIcons.js'
import { sfx } from './audio/index.js'
import { burst, centre, flash } from './juice.js'

function el(tag, className, html = '') {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (html) e.innerHTML = html
  return e
}
const text = (className, value) => {
  const e = el('span', `ol ${className}`)
  e.textContent = value
  return e
}

const O = 'stroke="#1b1b2a" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"'
const ARROW = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 58 34H42v26H22V34H6z" fill="#fff" ${O}/></svg>`

// Gauge geometry (viewBox units): centre, outer/inner radius of the arc.
const CX = 170
const CY = 172
const R1 = 150
const R0 = 104
const STEPS = 48

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (p, s) => (p >> s) & 255
  const c = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t)
  return `rgb(${c(16)},${c(8)},${c(0)})`
}
// Colour of the arc at f (0..1), through RACE.gauge.
function gaugeColor(f) {
  const g = RACE.gauge
  const x = Math.min(0.9999, Math.max(0, f)) * (g.length - 1)
  const i = Math.floor(x)
  return mix(g[i], g[i + 1], x - i)
}
const polar = (r, f) => {
  const a = Math.PI * (1 - f) // f 0 = left, 1 = right, over the top
  return [CX + Math.cos(a) * r, CY - Math.sin(a) * r]
}

function gaugeSvg() {
  let wedges = ''
  for (let i = 0; i < STEPS; i++) {
    const f0 = i / STEPS
    const f1 = (i + 1.04) / STEPS // a hair of overlap hides the seams
    const [ax, ay] = polar(R1, f0)
    const [bx, by] = polar(R1, Math.min(1, f1))
    const [cx, cy] = polar(R0, Math.min(1, f1))
    const [dx, dy] = polar(R0, f0)
    wedges += `<path d="M${ax} ${ay}L${bx} ${by}L${cx} ${cy}L${dx} ${dy}z" fill="${gaugeColor((i + 0.5) / STEPS)}"/>`
  }
  const outline = `<path d="M${CX - R1} ${CY}A${R1} ${R1} 0 0 1 ${CX + R1} ${CY}L${CX + R0} ${CY}A${R0} ${R0} 0 0 0 ${CX - R0} ${CY}z" fill="none" stroke="#1b1b2a" stroke-width="5" stroke-linejoin="round"/>`
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((f, i) => {
      const [x, y] = polar(R1 + 22, f)
      const anchor = f < 0.2 ? 'end' : f > 0.8 ? 'start' : 'middle'
      const dy = f === 0 || f === 1 ? 10 : 6
      return `<text class="g-tick" data-i="${i}" x="${x}" y="${y + dy}" text-anchor="${anchor}" fill="${gaugeColor(f)}">0</text>`
    })
    .join('')
  // The needle sits in a shaker group: CSS jitters the group, the needle's own transform turns it.
  const needle = `<g class="g-shake"><g class="g-needle" transform="rotate(180 ${CX} ${CY})"><path d="M${CX} ${CY - 11}L${CX + R1 - 8} ${CY}L${CX} ${CY + 11}z" fill="#fff" stroke="#1b1b2a" stroke-width="4" stroke-linejoin="round"/></g></g>`
  const speed = `<text class="g-speed" x="${CX}" y="${CY + 12}" text-anchor="middle">0</text>`
  const boost = `<text class="g-boost" x="${CX}" y="${CY - 56}" text-anchor="middle">TAP!</text>`
  return `<svg viewBox="0 0 340 200" aria-hidden="true">${wedges}${outline}${ticks}${boost}${needle}${speed}</svg>`
}

// 950 -> "950", 12345 -> "12.3K".
const short = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.floor(n)))
// Checkpoint distances: 250 -> "250", 2500 -> "2.5K", 9000 -> "9K".
const compact = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.floor(n)))

// hud: the main HUD (root, bottom, setTimer). onLeave: the Leave button.
export function createRaceHud(hud, { onLeave }) {
  const box = el('div', 'race-ui')

  const gauge = el('div', 'race-gauge', gaugeSvg())
  const needle = gauge.querySelector('.g-needle')
  const speedText = gauge.querySelector('.g-speed')
  const tickTexts = [...gauge.querySelectorAll('.g-tick')]
  const boostText = gauge.querySelector('.g-boost')

  const studs = el('div', 'race-studs')
  const studsText = text('studs-text', '0 Studs')
  studs.append(el('span', 'studs-arrow', ARROW), studsText)
  // Checkpoint reward: trophy + "+N" under the callout.
  const bonus = el('div', 'race-bonus')
  const bonusNum = el('span', 'grad bonus-num')
  const bonusLucky = text('bonus-lucky', 'LUCKY x2!') // Luck doubled this one
  bonus.append(el('span', 'bonus-trophy', ICONS.trophy), bonusNum, bonusLucky)
  bonus.style.animationDuration = `${RACE.reward.popup}s`
  studs.append(bonus)
  // The next checkpoint and what it pays.
  const next = el('div', 'race-next')
  const nextPay = el('span', 'grad next-pay')
  const nextAt = text('next-at', '')
  next.append(text('next-label', 'Next'), el('span', 'next-trophy', ICONS.trophy), nextPay, nextAt)
  studs.append(next)

  const leave = el('button', 'hud-btn race-leave')
  leave.type = 'button'
  leave.append(text('leave-text', 'Leave'))
  leave.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onLeave()
  })

  box.append(studs, gauge, leave)
  hud.bottom.prepend(box)

  // Speed streaks: thin white wedges fanning out from the middle of the screen.
  const lines = el('div', 'race-lines')
  // Mostly sideways (clockwise from +X, y down), away from the HUD rows top and bottom.
  const angles = [-162, -146, -128, -52, -34, -18, 4, 16, 32, 48, 132, 148, 164, 176]
  angles.forEach((angle, i) => {
    const s = el('span', 'race-line')
    s.style.setProperty('--a', `${angle}deg`)
    s.style.setProperty('--d', `${(i * 0.137) % 0.6}s`)
    s.style.setProperty('--len', `${16 + ((i * 53) % 20)}vmax`)
    lines.append(s)
  })
  document.body.append(lines)

  // Result card.
  const result = el('div', 'race-result')
  const resTitle = text('res-title', 'Race Over!')
  const resStuds = text('res-studs', '')
  const resWins = el('div', 'res-wins')
  const resWinsNum = text('res-wins-num', '')
  resWins.append(el('span', 'res-trophy', ICONS.trophy), resWinsNum)
  // New personal best: its bonus.
  const resBest = el('div', 'res-best')
  const resBestNum = el('span', 'grad res-best-num')
  resBest.append(text('res-best-label', 'NEW BEST!'), resBestNum)
  result.append(resTitle, resStuds, resWins, resBest)
  result.style.animationDuration = `${RACE.resultSeconds}s`
  hud.root.append(result)

  // Banner under the podium: speed-up (blue, bolt) or new record (gold, trophy).
  const faster = el('div', 'race-faster')
  const fasterIcon = el('span', 'faster-bolt')
  const fasterText = el('span', 'grad faster-text')
  faster.append(fasterIcon, fasterText)
  hud.root.append(faster)
  function banner(label, icon, gold) {
    fasterIcon.innerHTML = ICONS[icon]
    fasterText.textContent = fasterText.dataset.t = label
    faster.classList.toggle('gold', gold)
    replay(faster, 'show')
  }
  let resultTimer = 0

  let shownBoost = -1 // whole percent shown in the arc; 0 = "TAP!"
  let shownSpeed = -1
  let shownTop = -1
  let shownStuds = ''
  // --- Checkpoint reward ---------------------------------------------------------------
  const R = RACE.reward
  const statRow = hud.root.querySelector('.stat-trophies')
  const statIcon = statRow?.querySelector('.stat-icon') ?? statRow
  const unit = () => parseFloat(hud.root.style.getPropertyValue('--u')) || 1
  const replay = (e, cls) => {
    e.classList.remove(cls)
    void e.offsetWidth
    e.classList.add(cls)
  }
  const credit = (n) => {
    hud.setStat('trophies', hud.getStat('trophies') + n)
    if (statRow) replay(statRow, 'race-bump')
  }
  const at = (x, y, k) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k})`

  // One trophy: pops out of the boat, hangs a moment, then flies into the counter.
  function fly(share, x0, y0, delay, i = 0) {
    const e = el('span', 'race-fly', ICONS.trophy)
    hud.root.append(e)
    const r = statIcon.getBoundingClientRect()
    const x1 = r.left + r.width / 2
    const y1 = r.top + r.height / 2
    const u = unit()
    const sx = x0 + (Math.random() * 300 - 80) * u
    const sy = y0 - (30 + Math.random() * 170) * u
    const anim = e.animate(
      [
        { transform: at(x0, y0, 0.2), opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.3)' },
        { transform: at(sx, sy, 1.1), opacity: 1, offset: 0.25 },
        { transform: at(sx, sy - 12 * u, 1), opacity: 1, offset: 0.42, easing: 'cubic-bezier(.5,0,.8,.6)' },
        { transform: at(x1, y1, 0.62), opacity: 1 },
      ],
      { duration: R.flight * 1000, delay: delay * 1000, fill: 'backwards' },
    )
    anim.onfinish = () => {
      e.remove()
      credit(share)
      sfx.clink(i) // each landing rings a step higher
    }
    anim.oncancel = () => {
      e.remove()
      credit(share)
    }
  }

  // Coloured paper squares tumbling down the whole screen.
  function confetti() {
    const box = el('div', 'race-confetti')
    const n = COARSE_POINTER ? R.confettiTouch : R.confetti
    let longest = 0
    for (let i = 0; i < n; i++) {
      const c = el('span', 'confetti')
      const t = 1.8 + Math.random() * 1.4
      const d = Math.random() * 0.45
      longest = Math.max(longest, t + d)
      c.style.cssText = `left:${Math.random() * 100}%;top:${-8 + Math.random() * 38}%;background:${R.colors[i % R.colors.length]};--dx:${(Math.random() - 0.5) * 24}vw;--r:${(Math.random() - 0.5) * 1440}deg;--fx:${Math.random() * 720}deg;animation-duration:${t}s;animation-delay:${d}s`
      box.append(c)
    }
    hud.root.append(box)
    setTimeout(() => box.remove(), longest * 1000 + 100)
  }

  return {
    setRace(on) {
      hud.root.classList.toggle('racing', on)
      lines.classList.toggle('on', on)
      if (!on) {
        hud.setTimer(null)
        lines.style.setProperty('--speed', 0)
      }
    },
    // ms on the race clock, speed and top speed (studs/s), distance (studs), tap boost (0..RACE.tap.max).
    setInfo({ ms, speed, top, studs: d, boost = 0 }) {
      const pct = Math.round(boost * 100)
      if (pct !== shownBoost) {
        shownBoost = pct
        boostText.textContent = pct > 0 ? `+${pct}%` : 'TAP!'
        gauge.classList.toggle('tap-hint', pct === 0)
        gauge.classList.toggle('boosted', pct >= 5)
      }
      hud.setTimer(ms)
      const v = Math.round(speed)
      if (v !== shownSpeed) {
        speedText.textContent = shownSpeed = v
        const f = top > 0 ? Math.min(1, speed / top) : 0
        needle.setAttribute('transform', `rotate(${180 + f * 180} ${CX} ${CY})`)
      }
      const t = Math.round(top)
      if (t !== shownTop) {
        shownTop = t
        tickTexts.forEach((e, i) => (e.textContent = Math.round((t * i) / 4)))
      }
      const s = `${short(d)} Studs`
      if (s !== shownStuds) studsText.textContent = shownStuds = s
      lines.style.setProperty('--speed', Math.min(1, (speed * RACE.metresPerStud) / 32).toFixed(2))
    },
    // A tap at (x, y) px: a ripple there.
    tapAt(x, y) {
      const r = el('span', 'tap-ripple')
      r.style.left = `${x}px`
      r.style.top = `${y}px`
      r.addEventListener('animationend', () => r.remove())
      hud.root.append(r)
    },
    // A checkpoint paid `won` Wins (doubled by Luck when `lucky`); (x, y) = the boat on screen. The Wins are
    // added to the trophy counter as the trophies land.
    reward(won, x, y, lucky = false) {
      bonusNum.textContent = bonusNum.dataset.t = `+${short(won)}`
      bonus.classList.toggle('lucky', lucky)
      replay(bonus, 'show')
      confetti()
      sfx.checkpoint(lucky)
      if (lucky) burst(...centre(bonus), 'stars')
      const k = Math.min(R.trophies[1], Math.max(R.trophies[0], won))
      for (let i = 0; i < k; i++) {
        // Shares add up to `won` exactly; with more trophies than Wins some carry 0.
        const share = Math.floor(((i + 1) * won) / k) - Math.floor((i * won) / k)
        fly(share, x, y, i * R.stagger, i)
      }
    },
    speedUp(from, to) {
      banner(`Top Speed ${Math.round(from)} → ${Math.round(to)}!`, 'bolt', false)
      sfx.speedUp()
    },
    record() {
      banner('NEW RECORD!', 'trophy', true)
      sfx.record()
      flash('edge')
      burst(...centre(faster), 'stars')
    },
    // The next checkpoint: at (studs) pays `pay` Wins.
    setNext(at, pay) {
      nextPay.textContent = nextPay.dataset.t = `+${short(pay)}`
      nextAt.textContent = `at ${compact(at)}`
    },
    // bonus > 0: a new personal best, which paid that bonus.
    showResult(d, wins, bonus = 0) {
      resBest.style.display = bonus > 0 ? '' : 'none'
      sfx.finish(bonus > 0)
      if (bonus > 0) setTimeout(() => burst(...centre(result), 'big'), 900)
      resBestNum.textContent = resBestNum.dataset.t = `+${short(bonus)}`
      resStuds.textContent = `${short(d)} Studs`
      resWinsNum.textContent = `+${short(wins)}`
      result.classList.remove('show')
      void result.offsetWidth
      result.classList.add('show')
      clearTimeout(resultTimer)
      resultTimer = setTimeout(() => result.classList.remove('show'), RACE.resultSeconds * 1000)
    },
  }
}
