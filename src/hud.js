// The on-screen HUD, laid out after the reference screenshot (1920x992):
//   top-centre   - race timer, 1st/2nd/3rd podium under it
//   top-right    - round buttons (spin wheel, calendar)
//   left         - CLAIM! pill + grid of menu tiles (Rebirth, Pets, Boats, ...)
//   right        - trophies / wins, AUTO TRAIN / AUTO RACE, boosts
//   bottom       - the three-row race distance bar with every racer's head
// Everything is sized in reference pixels times --u (set on resize), so it keeps
// the reference proportions on any screen; hud.css adapts it for touch + portrait.
// The top-left corner is Boxity's (toolbar + chat feed): blocks slide down clear of it (setReserved).
import './hud.css'
import { clamp, HUD } from './config.js'
import { head, ICONS, RIBBON } from './hudIcons.js'
import { feedback } from './audio/index.js'
import { burst, lastPress } from './juice.js'

function el(tag, className, html = '') {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (html) e.innerHTML = html
  return e
}

// Outlined text (stroke drawn under the fill; see .ol in hud.css).
const text = (className, value) => {
  const e = el('span', `ol ${className}`)
  e.textContent = value
  return e
}

// Gradient-filled outlined text: the outline is a copy behind it (data-t).
function gradText(className, value) {
  const e = el('span', `grad ${className}`)
  setGradText(e, value)
  return e
}
function setGradText(e, value) {
  e.textContent = value
  e.dataset.t = value
}

// A HUD button. Fires on pointerdown like the touch controls (no click delay).
function button(className, html, fn) {
  const b = el('button', `hud-btn ${className}`, html)
  b.type = 'button'
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    b.classList.remove('pop')
    void b.offsetWidth // restart the press animation
    b.classList.add('pop')
    fn?.(b)
  })
  return b
}

const dot = () => el('span', 'hud-dot')

function tile(name, label, icon, fn, extra) {
  const b = button(`hud-tile tile-${name}`, `<span class="tile-icon">${icon}</span>`, fn)
  b.append(text('tile-label', label))
  if (extra) b.append(extra)
  return b
}

function formatTime(ms) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor(ms / 1000) % 60
  const r = Math.floor(ms) % 1000
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`
}

// actions: { claim, daily (the calendar), rebirth, pets, boats, engine, partner, trail,
// autoTrain(on), autoRace(on), boosts (the three boost circles) }, all optional; a menu
// tile calls the action named after it.
export function createHud(actions = {}) {
  const root = el('div', 'hud')
  const d = HUD.design

  // --- Timer --------------------------------------------------------------------------
  const timer = el('div', 'hud-timer')
  const timerText = text('timer-text', '00:00.000')
  timer.append(timerText)

  // --- Podium: the three racers furthest along, under the timer ------------------------
  // (in the DOM before the top row so the timer's panel covers the ribbons' tops)
  const podium = el('div', 'hud-podium')
  const medals = ['1st', '2nd', '3rd'].map((label, i) => {
    const m = el('div', `medal medal-${i + 1}`)
    const face = el('span', 'medal-face')
    m.append(el('span', 'medal-ribbon', RIBBON), face, gradText('medal-label', label))
    podium.append(m)
    return { m, face: { e: face, key: null } }
  })

  // --- Top-right round buttons -------------------------------------------------------------
  const tr = el('div', 'hud-tr')
  for (const [icon, badge, fn] of [
    ['wheel', true, actions.spin],
    ['calendar', true, actions.daily],
  ]) {
    const b = button(`hud-round round-${icon}`, ICONS[icon], fn)
    if (badge) b.append(dot())
    tr.append(b)
  }
  // The calendar (Daily Reward) shows its dot only while a day can be claimed (setDailyReady).
  const calendar = tr.querySelector('.round-calendar')
  // The wheel (Spin wheel) likewise, while a spin is ready (setSpinCount).
  const wheel = tr.querySelector('.round-wheel')

  // --- Left: CLAIM + tiles --------------------------------------------------------------------
  const left = el('div', 'hud-left')
  const claim = button('hud-claim', `<span class="claim-gift">${ICONS.gift}</span>`, actions.claim)
  const claimBadge = el('span', 'claim-badge')
  const claimCount = text('', '0')
  claimBadge.append(claimCount)
  claim.append(claimBadge, gradText('claim-text', 'CLAIM!'))
  const grid = el('div', 'hud-grid')
  grid.append(
    tile('rebirth', 'Rebirth', ICONS.rebirth, actions.rebirth),
    tile('pets', 'Pets', ICONS.pets, actions.pets),
    tile('boats', 'Boats', ICONS.boats, actions.boats),
    tile('engine', 'Engine', ICONS.engine, actions.engine),
    tile('partner', 'Partner', ICONS.partner, actions.partner),
    tile('trail', 'Trail', ICONS.trail, actions.trail),
  )
  left.append(claim, grid)

  // --- Right: stats, autos, boosts -------------------------------------------------------
  const right = el('div', 'hud-right')

  const stats = el('div', 'hud-stats')
  const statEls = {}
  for (const [key, icon] of [
    ['trophies', 'trophy'],
    ['wins', 'bolt'],
  ]) {
    const row = el('div', `hud-stat stat-${key}`)
    statEls[key] = gradText('stat-num', '0')
    row.append(statEls[key], el('span', 'stat-icon', ICONS[icon]))
    stats.append(row)
  }

  const autos = el('div', 'hud-autos')
  // fn(on) is told the new state. "AUTO " is its own span so touch screens can drop it
  // and show compact TRAIN / RACE tiles (hud.css).
  const auto = (label, icon, fn) => {
    const b = button('hud-auto', `<span class="auto-icon">${ICONS[icon]}</span>`, (btn) => {
      fn?.(btn.classList.toggle('on'))
    })
    const t = text('auto-label', label)
    t.prepend(el('span', 'auto-pre', 'AUTO '))
    b.append(t)
    return b
  }
  autos.append(auto('TRAIN', 'bolt', actions.autoTrain), auto('RACE', 'trophy', actions.autoRace))

  const boosts = el('div', 'hud-boosts')
  for (const [cls, icon, label] of [
    ['gold', 'trophy', 'x2'],
    ['blue', 'bolt', 'x2'],
    ['purple', 'paw', '+3'],
  ]) {
    const b = button(`hud-boost boost-${cls}`, `<span class="boost-icon">${ICONS[icon]}</span>`, actions.boosts)
    b.append(text('boost-label', label))
    boosts.append(b)
  }
  // Two groups so a short touch screen can put them side by side (hud.css).
  const rightA = el('div', 'right-a')
  const rightB = el('div', 'right-b')
  rightA.append(stats)
  rightB.append(autos, boosts)
  right.append(rightA, rightB)

  // --- Bottom: race distance bars ----------------------------------------------------------
  const bottom = el('div', 'hud-bottom')
  // Bars span 438..1482 px of the reference; segment edges come from HUD.progress.
  const barLeft = 438
  const barWidth = 1482 - barLeft
  const bars = el('div', 'hud-bars')
  HUD.progress.forEach((row, r) => {
    const rowEl = el('div', `bar-row bar-row-${r}`)
    let from = r === HUD.progress.length - 1 ? 462 : barLeft
    rowEl.style.marginLeft = `${((from - barLeft) / barWidth) * 100}%`
    const rowWidth = 1482 - from
    for (const seg of row) {
      const s = el('div', 'bar-seg')
      s.style.width = `${((seg.at - from) / rowWidth) * 100}%`
      s.style.background = seg.color
      s.append(text('bar-label', seg.label))
      rowEl.append(s)
      from = seg.at
    }
    bars.append(rowEl)
  })
  bars.firstChild.append(el('span', 'bar-gem', ICONS.gem))
  // Distance -> { row, x (reference px) }: the finest row that reaches it.
  // Each row starts where the one below ends (0 / 2K / 13K).
  const rows = HUD.progress.map((segs, r) => ({ r, x0: r === HUD.progress.length - 1 ? 440 : barLeft, segs, v0: 0 }))
  for (let r = rows.length - 2; r >= 0; r--) rows[r].v0 = rows[r + 1].segs.at(-1).to
  const locate = (distance) => {
    const d = Math.max(0, distance)
    const row = rows.findLast((w) => d <= w.segs.at(-1).to) ?? rows[0]
    let x = row.x0
    let v = row.v0
    for (const seg of row.segs) {
      if (d <= seg.to) return { row: row.r, x: x + ((d - v) / (seg.to - v)) * (seg.at - x) }
      x = seg.at
      v = seg.to
    }
    return { row: row.r, x }
  }
  const place = (e, distance) => {
    const { row, x } = locate(distance)
    e.style.left = `${((x - barLeft) / barWidth) * 100}%`
    e.style.setProperty('--row', row)
  }

  const racerEls = [] // other racers' heads ({ e, key } slots for paintFace), reused across setRacers calls
  const marker = el('div', 'bar-marker')
  const markerHead = { e: el('span', 'marker-head', ICONS.head), key: null }
  marker.append(el('span', 'marker-arrow'), markerHead.e)
  bars.append(marker) // after the racers' heads (setRacers inserts before it), so the player stays on top
  // The player's best distance (setBest): a white line on its row with a BEST tag (styled in race.css).
  const best = el('span', 'bar-best')
  best.style.display = 'none'
  bars.insertBefore(best, marker)

  bottom.append(bars)

  const top = el('div', 'hud-top')
  top.append(tr) // the race timer (`timer`) is kept off-screen: not shown in the HUD
  root.append(podium, top, left, right, bottom)
  document.body.appendChild(root)

  // --- Boxity's reserved areas (setReserved) ------------------------------------------------------
  // The portal draws its toolbar and chat feed over the top-left corner (the whole top edge on
  // narrow phones). Each block that would sit under them slides down until it clears them (CSS
  // `translate`, so its own positioning is untouched), and below any block above it that moved.
  // Re-laid out on resize, when a block changes size (podium shown, scene mode) and when the
  // HUD's or the page's classes change (portrait, touch-ui, uiw-open move blocks around).
  const RESERVED_GAP = 8 // px kept clear under a reserved area
  const avoiders = [tr, podium, left, right] // top to bottom: a moved block pushes the ones under it
  let reserved = []
  let layoutQueued = 0
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  function layoutReserved() {
    layoutQueued = 0
    for (const e of avoiders) e.style.translate = ''
    const blocks = reserved.map((a) => ({ left: a.left, right: a.left + a.width, top: a.top, bottom: a.top + a.height }))
    for (const e of avoiders) {
      const r = e.getBoundingClientRect()
      if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue // not shown (uiw-open hides all but the counters)
      let push = 0
      for (let moved = true; moved; ) {
        moved = false
        const box = { left: r.left, right: r.right, top: r.top + push, bottom: r.bottom + push }
        const hit = blocks.find((b) => overlaps(box, b))
        if (hit) {
          push = hit.bottom + RESERVED_GAP - r.top // always grows, so this ends
          moved = true
        }
      }
      if (push <= 0) continue
      e.style.translate = `0 ${push}px`
      blocks.push({ left: r.left, right: r.right, top: r.top + push, bottom: r.bottom + push })
    }
  }
  // Batched into one pass; a timeout rather than a frame so it also lands in a background tab.
  const relayout = () => {
    layoutQueued ||= setTimeout(layoutReserved)
  }
  const sized = new ResizeObserver(relayout)
  for (const e of avoiders) sized.observe(e)
  const classes = new MutationObserver(relayout)
  classes.observe(root, { attributes: true, attributeFilter: ['class'] })
  classes.observe(document.body, { attributes: true, attributeFilter: ['class'] })

  // --- Sizing ------------------------------------------------------------------------------------------
  function resize() {
    const vv = window.visualViewport
    const w = vv?.width ?? window.innerWidth
    const h = vv?.height ?? window.innerHeight
    const u = clamp(Math.min(w / d.w, h / d.h), HUD.minScale, HUD.maxScale)
    root.style.setProperty('--u', `${u}px`)
    root.classList.toggle('portrait', h > w)
    root.classList.toggle('short', h <= w && h < 500) // phone landscape
    relayout()
  }
  window.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('resize', resize)
  resize()

  // --- State ----------------------------------------------------------------------------------------------
  const state = { ...HUD.stats }
  const fmt = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${+(n / 1e3).toFixed(1)}K` : String(n))
  // Counters roll to their new value (and glow up / blink red when spent) instead of jumping;
  // spending trophies or lightning plays the purchase sound (audio feedback). Quiet while booting.
  const shownStat = {}
  const rolls = {}
  let rollFrame = 0
  let live = false
  setTimeout(() => (live = true), 1500)
  function roll(now) {
    rollFrame = 0
    for (const key of Object.keys(rolls)) {
      const r = rolls[key]
      const k = Math.min(1, (now - r.t0) / HUD.rollMs)
      shownStat[key] = r.from + (r.to - r.from) * (1 - (1 - k) ** 3)
      statEls[key] && setGradText(statEls[key], fmt(Math.round(shownStat[key])))
      if (k >= 1) delete rolls[key]
    }
    if (Object.keys(rolls).length) rollFrame = requestAnimationFrame(roll)
  }
  function setStat(key, value) {
    const old = state[key]
    state[key] = value
    if (!live || old === value || !Number.isFinite(old) || !Number.isFinite(value)) {
      delete rolls[key]
      shownStat[key] = value
      statEls[key] && setGradText(statEls[key], fmt(value))
      return
    }
    const row = statEls[key]?.parentElement
    if (!row) {
      shownStat[key] = value
      return
    }
    const cls = value > old ? 'gain' : 'spend'
    row.classList.remove('gain', 'spend')
    void row.offsetWidth
    row.classList.add(cls)
    if (cls === 'spend' && key !== 'gems') {
      feedback('spend')
      burst(lastPress().x, lastPress().y, 'coins') // coins pour out of the button that bought it
    }
    rolls[key] = { from: shownStat[key] ?? old, to: value, t0: performance.now() }
    if (!rollFrame) rollFrame = requestAnimationFrame(roll)
  }
  for (const key of Object.keys(state)) setStat(key, state[key])

  // A head in a slot ({ e, key }): the cartoon look ('player' = the player's own), swapped for the
  // Bloxity profile picture once it has loaded (kept on the cartoon if it fails). Repaints only
  // when the racer or picture changes, so a picture isn't reloaded every frame.
  function paintFace(slot, id, look, pfp) {
    const key = `${id}|${pfp}`
    if (slot.key === key) return
    slot.key = key
    slot.e.innerHTML = look === 'player' ? ICONS.head : look ? head(look) : ''
    if (!pfp) return
    const img = new Image()
    img.alt = ''
    img.className = 'racer-pfp'
    img.draggable = false
    img.onload = () => slot.key === key && slot.e.replaceChildren(img)
    img.src = pfp
  }

  // The podium shows the top three of the racers plus the player, by distance.
  let playerDistance = 0
  let playerPfp = ''
  let racers = []
  function refreshPodium() {
    const me = { id: 'me', distance: playerDistance, look: 'player', pfp: playerPfp }
    const ranked = [...racers, me].sort((a, b) => b.distance - a.distance)
    podium.classList.toggle('empty', racers.length === 0)
    medals.forEach((md, i) => {
      const r = ranked[i]
      md.m.style.visibility = r ? '' : 'hidden'
      if (r) paintFace(md.face, r.id, r.look, r.pfp || '')
    })
  }
  // The player's own Bloxity profile picture ('' = the cartoon head) for the bar marker and podium.
  function setPfp(url) {
    playerPfp = url || ''
    paintFace(markerHead, 'me', 'player', playerPfp)
    refreshPodium()
  }
  // Race distance in the same units as HUD.progress (0..the finish).
  function setDistance(d) {
    playerDistance = d
    place(marker, d)
    refreshPodium()
  }
  // [{ id, name, distance, look, pfp }] for everyone else racing (remote players, race.js).
  function setRacers(list) {
    racers = list
    while (racerEls.length < list.length) {
      const e = el('span', 'bar-racer')
      bars.insertBefore(e, marker)
      racerEls.push({ e, key: null })
    }
    racerEls.forEach((r, i) => {
      const racer = list[i]
      r.e.style.display = racer ? '' : 'none'
      if (!racer) return
      paintFace(r, racer.id ?? racer.name, racer.look, racer.pfp || '')
      r.e.title = racer.name ?? ''
      place(r.e, racer.distance)
    })
    refreshPodium()
  }
  setRacers([]) // remote players appear as they race (race.js)
  setPfp('')
  setDistance(0)

  const start = performance.now()
  let shown = ''
  let timerMs = null // set by setTimer (a race's own clock); null = time since load
  return {
    root,
    bottom, // race.js's widgets go in here, above the bars column
    setStat,
    getStat: (key) => state[key],
    // Gifts ready to claim (gifts.js); the badge hides at 0.
    setClaimCount(n) {
      claimCount.textContent = String(n)
      claimBadge.style.display = n > 0 ? '' : 'none'
      claim.classList.toggle('ready', n > 0) // wiggles for attention (juice.css)
    },
    // Daily Reward days ready to claim (daily.js): the calendar's dot + wiggle.
    setDailyReady(n) {
      calendar.classList.toggle('ready', n > 0)
    },
    // Spins ready on the Spin wheel (spin.js): the wheel's dot + wiggle.
    setSpinCount(n) {
      wheel.classList.toggle('ready', n > 0)
    },
    setDistance,
    setRacers,
    setPfp,
    // Personal best distance on the bar; 0 hides it.
    setBest(d) {
      best.style.display = d > 0 ? '' : 'none'
      if (d > 0) place(best, d)
    },
    // Scene mode (the Trails scene): only the round buttons stay.
    setScene: (on) => root.classList.toggle('scene', on),
    // Boxity's toolbar / chat rectangles ([{ left, top, width, height }], CSS px) to keep clear of.
    setReserved(areas) {
      reserved = areas
      relayout()
    },
    // Show this time (ms) on the timer instead of the time since load; null goes back.
    setTimer(ms) {
      timerMs = ms
    },
    update() {
      const t = formatTime(timerMs ?? performance.now() - start)
      if (t !== shown) timerText.textContent = shown = t
    },
  }
}
