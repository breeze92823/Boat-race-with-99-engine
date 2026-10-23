// The beach around the player, all synthesised:
//  - surf: each wave builds (the wash swells and brightens), breaks (a crash of
//    pink noise and a low thump), then runs back up the sand fizzing with tiny
//    foam bubbles; waves come every 6-12 s, louder the closer you are to the
//    shoreline (north, -Z) and panned to where the sea is from the camera
//  - the waterfall in the plaza: a positional roar (rumble + hiss) that grows as you drive toward it
//  - distant gulls by day, crickets at night
// One scheduler tick (every AUDIO.ambience.tick s) plans the next events ahead of
// the clock; update() moves the continuous levels every frame.
import { AUDIO, BEACH, COARSE_POINTER, PLAZA } from '../config.js'
import { A, onStart, ready } from './core.js'
import { bubble, burst, env, rnd, route } from './synth.js'

const M = AUDIO.ambience
const s = {
  ok: false,
  wave: null, // wash gain (wave envelope) + its filter
  waveFilter: null,
  shore: null, // proximity x pan for the surf
  shorePan: null,
  fizz: null,
  fall: null, // waterfall level + pan
  fallPan: null,
  nextWave: 0,
  nextGull: 0,
  crickets: [],
  night: false,
  racing: false,
  shoreK: 0.5, // 0..1 how close to the surf
  shoreSide: 0, // -1..1 where the sea is, from the camera
}

const filt = (type, f, q = 0.7) => {
  const b = A.ctx.createBiquadFilter()
  b.type = type
  b.frequency.value = f
  b.Q.value = q
  return b
}
const gain = (v) => {
  const g = A.ctx.createGain()
  g.gain.value = v
  return g
}
function loop(buf) {
  const src = A.ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.start(0, Math.random() * (buf.duration - 0.1))
  return src
}

onStart((ctx) => {
  const bus = A.amb
  // Surf chain: stereo pink -> lowpass (opens as a wave builds) -> wave envelope -> proximity -> pan.
  s.shorePan = ctx.createStereoPanner()
  s.shore = gain(0.5)
  s.shore.connect(s.shorePan).connect(bus)
  s.waveFilter = filt('lowpass', 400, 0.5)
  s.wave = gain(0.12)
  loop(A.noise.pinkStereo).connect(s.waveFilter).connect(s.wave).connect(s.shore)
  // Fizz: the receding foam, a high hiss under the bubbles.
  s.fizz = gain(0)
  loop(A.noise.pinkStereo).connect(filt('highpass', 3000, 0.5)).connect(s.fizz).connect(s.shore)
  // Waterfall: a heavy rumble + broadband hiss, positional.
  s.fallPan = ctx.createStereoPanner()
  s.fall = gain(0)
  s.fall.connect(s.fallPan).connect(bus)
  const roar = filt('bandpass', 1100, 0.35)
  loop(A.noise.pinkStereo).connect(roar).connect(gain(0.9)).connect(s.fall)
  loop(A.noise.brownStereo).connect(filt('lowpass', 220, 0.6)).connect(gain(1.2)).connect(s.fall)
  // Night crickets: each is a sine whose gain is pulsed into chirps by the scheduler.
  for (const [f, pan] of M.crickets) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const g = gain(0)
    o.connect(g)
    route(g, { bus, pan, verb: 0.25 })
    o.start()
    s.crickets.push({ g, next: 0, rate: rnd(0.55, 0.9) })
  }
  s.nextWave = ctx.currentTime + 1
  s.nextGull = ctx.currentTime + rnd(4, 10)
  s.ok = true
  setInterval(schedule, M.tick * 1000)
})

// One wave: build, break, run back up the sand.
function wave(t) {
  const build = rnd(1.8, 3)
  const back = rnd(3, 4.5)
  const peak = rnd(0.5, 0.75)
  const crash = t + build
  const g = s.wave.gain
  const f = s.waveFilter.frequency
  g.cancelScheduledValues(t)
  f.cancelScheduledValues(t)
  g.setValueAtTime(g.value, t)
  f.setValueAtTime(f.value, t)
  g.linearRampToValueAtTime(peak * 0.6, crash - 0.25)
  f.exponentialRampToValueAtTime(1300, crash - 0.25)
  g.linearRampToValueAtTime(peak, crash + 0.15)
  f.exponentialRampToValueAtTime(2600, crash + 0.15)
  g.linearRampToValueAtTime(0.12, crash + back)
  f.exponentialRampToValueAtTime(420, crash + back)
  // The break itself.
  const k = rnd(0.6, 1)
  burst({ t: crash - 0.05, noise: 'pink', f: 900, f2: 500, q: 0.5, a: 0.12, d: 1.4, gain: 0.35 * k, bus: s.shore })
  burst({ t: crash, noise: 'brown', type: 'lowpass', f: 260, q: 0.6, a: 0.05, d: 0.9, gain: 0.45 * k, bus: s.shore })
  // Foam fizzing as it runs back: hiss + sparse tiny bubbles.
  s.fizz.gain.cancelScheduledValues(crash + 0.2)
  env(s.fizz.gain, crash + 0.2, 0.5, 0.18 * k, back - 0.5)
  const n = Math.round(back * (COARSE_POINTER ? M.foamTouch : M.foam))
  for (let i = 0; i < n; i++) {
    const at = crash + 0.3 + Math.pow(Math.random(), 1.4) * back
    bubble({ t: at, f: rnd(2200, 6500), d: rnd(0.006, 0.02), gain: rnd(0.008, 0.025) * k, rise: rnd(0.2, 0.6), pan: rnd(-0.8, 0.8), bus: s.shore })
  }
  return crash + back * rnd(0.55, 0.9) // next wave starts while this one is still running back
}

// A herring gull's call far off: a few "kyow"s, each a raspy rise and fall through a nasal formant.
function gull(t) {
  const ctx = A.ctx
  const pan = rnd(-0.9, 0.9)
  const out = gain(rnd(0.5, 1) * M.gull)
  route(out, { bus: A.amb, pan, verb: 0.5 })
  const lp = filt('lowpass', 3800, 0.5) // distance takes the edge off
  lp.connect(out)
  const notes = 2 + Math.floor(Math.random() * 4)
  let at = t
  const base = rnd(1000, 1250)
  for (let i = 0; i < notes; i++) {
    const len = rnd(0.22, 0.34)
    const f0 = base * (1 - i * 0.03)
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f0 * 1.45, at + len * 0.3)
    o.frequency.exponentialRampToValueAtTime(f0 * 0.85, at + len)
    const rasp = ctx.createOscillator() // throat roughness
    rasp.frequency.value = rnd(55, 80)
    const raspDepth = gain(0.4)
    const amp = gain(1)
    rasp.connect(raspDepth).connect(amp.gain)
    const f1 = filt('bandpass', 2300, 3)
    const f2 = filt('bandpass', 1300, 4)
    const g = gain(0)
    o.connect(f1).connect(amp)
    o.connect(f2).connect(amp)
    amp.connect(g).connect(lp)
    env(g.gain, at, 0.03, 1, len - 0.03, 0)
    o.start(at)
    o.stop(at + len + 0.05)
    rasp.start(at)
    rasp.stop(at + len + 0.05)
    at += len + rnd(0.08, 0.16)
  }
}

// One cricket chirp: 3-5 pulses ~35 ms apart.
function chirp(c, t) {
  const pulses = 3 + Math.floor(Math.random() * 3)
  const g = c.g.gain
  for (let i = 0; i < pulses; i++) {
    const at = t + i * 0.036
    g.setValueAtTime(0, at)
    g.linearRampToValueAtTime(M.cricket, at + 0.004)
    g.linearRampToValueAtTime(0, at + 0.016)
  }
}

function schedule() {
  if (!s.ok || !ready()) return
  const t = A.ctx.currentTime
  const ahead = t + M.tick * 1.5
  if (s.nextWave < ahead) s.nextWave = wave(Math.max(t, s.nextWave))
  if (!s.night && !s.racing && s.nextGull < ahead) {
    gull(Math.max(t, s.nextGull))
    s.nextGull = t + rnd(...M.gullEvery)
  }
  if (s.night) {
    for (const c of s.crickets) {
      if (c.next < t) c.next = t + rnd(0, 0.3)
      while (c.next < ahead) {
        chirp(c, c.next)
        c.next += c.rate * rnd(0.9, 1.1)
      }
    }
  }
}

// listener: { x, z, rightX, rightZ } (camera position + its right vector on the ground);
// racing; night.
export function update(dt, st) {
  if (!s.ok) return
  const t = A.ctx.currentTime
  s.night = st.night
  s.racing = st.racing
  // Surf: close to the shoreline is loud; the sea is north (-Z) and, racing, all around.
  const near = st.racing ? 0.35 : Math.max(0.3, Math.min(1, 1 - (st.z - BEACH.front) / 110))
  const side = st.racing ? 0 : -st.rightZ // pan of the -Z direction
  s.shore.gain.setTargetAtTime(near, t, 0.4)
  s.shorePan.pan.setTargetAtTime(Math.max(-0.7, Math.min(0.7, side * 0.7)), t, 0.2)
  // Waterfall: inverse-distance with a floor so it never pops in; panned from the camera.
  const W = PLAZA.waterfall
  const dx = W.x - st.x
  const dz = W.z - st.z
  const d = Math.hypot(dx, dz)
  const fall = st.racing ? 0 : M.waterfall / (1 + Math.pow(d / M.waterfallNear, 2))
  s.fall.gain.setTargetAtTime(fall, t, 0.25)
  const pan = d > 0.1 ? (dx * st.rightX + dz * st.rightZ) / d : 0
  s.fallPan.pan.setTargetAtTime(pan * 0.8, t, 0.15)
}
