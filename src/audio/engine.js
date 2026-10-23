// The player's boat, as heard from the chase cam: a marine V8 under the
// thrusters, the jet roar of the four engines, and the hull in the water.
//
// The motor is a physical model in an AudioWorklet: each cylinder firing is a
// pressure pulse (sharp rise, exponential decay, combustion grit), fired with
// the uneven intervals and strengths of a cross-plane V8 (that unevenness is the
// "burble"), each bank into its own exhaust pipe (a damped comb filter), left and
// right. Pulses rise softly and the pipes are kept warm (low feedback, dark loop),
// and the revs drift a little on their own, so the note stays pleasant on a loop
// instead of buzzing. Outside the worklet: gentle saturation, a throttle lowpass
// (the muffler opening up) and a high shelf cut. Where AudioWorklet isn't
// available (old browsers, blocked blob: modules) two oscillators stand in.
// Mixing for a long listen: standing still the engine settles to a quiet purr;
// holding a steady speed in a race it eases back (AUDIO.engine.settle) and taps,
// boosts and the start rev bring it forward again.
// Layers on top: thruster roar (filtered noise rising with thrust), hull wash +
// spray + wave slaps on water, sand hiss on the beach.
import { AUDIO } from '../config.js'
import { A, onStart } from './core.js'
import { burst, rnd, saturation, tone } from './synth.js'

const E = AUDIO.engine

const WORKLET = `
class BoatEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 700, minValue: 200, maxValue: 9000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ]
  }
  constructor() {
    super()
    this.phase = 0
    this.fire = 0
    this.amp = 1
    this.env = 0
    this.n = 1e9 // samples since the last firing
    this.bank = 0
    // Two banks, two exhaust pipes of slightly different length: left and right, which
    // spreads the note and keeps it from sounding nasal like a single tube would.
    this.pipes = [{ buf: new Float32Array(4096), lp: 0 }, { buf: new Float32Array(4096), lp: 0 }]
    this.w = 0
    this.grit = 0
    this.dc = [0, 0]
    this.dcx = [0, 0]
    this.seed = 22222
    this.wander = 0
    this.wanderTo = 0
    this.wanderIn = 0
    // Cross-plane V8: firing gaps, strengths and banks are not even, and that is the burble.
    this.gap = [1.08, 0.92, 1.03, 0.97, 1.1, 0.9, 1.0, 1.0]
    this.str = [1.0, 0.84, 1.08, 0.92, 1.04, 0.82, 1.06, 0.95]
    this.side = [0, 1, 0, 0, 1, 0, 1, 1]
  }
  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 4294967296
  }
  process(inputs, outputs, params) {
    const L = outputs[0][0]
    const R = outputs[0][1] ?? L
    if (!L) return true
    const rpm = params.rpm[0]
    const load = params.load[0]
    // A real engine never holds an exact speed: it drifts a percent or so, slowly.
    if (--this.wanderIn <= 0) {
      this.wanderTo = (this.rand() * 2 - 1) * 0.014
      this.wanderIn = 40 + Math.floor(this.rand() * 80) // blocks (~0.1-0.3 s)
    }
    this.wander += (this.wanderTo - this.wander) * 0.02
    const fireHz = (rpm / 60) * 4 * (1 + this.wander) // 8 cylinders, 4-stroke: 4 firings per turn
    const attack = Math.round(sampleRate * 0.0012) // soft rise: no click, no buzz
    const tau = 0.0022 + 0.003 * (1 - load) * (900 / Math.max(rpm, 400))
    const decay = Math.exp(-1 / (sampleRate * tau))
    const D0 = Math.max(16, Math.min(3500, Math.round(sampleRate / (90 + rpm * 0.01))))
    const Ds = [D0, Math.round(D0 * 1.13)]
    const fb = 0.32 + 0.14 * load // low feedback: a warm pipe, not a ringing tube
    const gritK = 0.1 + 0.22 * load
    let env = this.env
    for (let i = 0; i < L.length; i++) {
      this.phase += fireHz / sampleRate / this.gap[this.fire]
      if (this.phase >= 1) {
        this.phase -= 1
        this.fire = (this.fire + 1) & 7
        this.bank = this.side[this.fire]
        this.amp = this.str[this.fire] * (0.88 + 0.24 * this.rand()) * (0.45 + 0.55 * load)
        this.n = 0
      }
      if (this.n < attack) {
        const x = Math.sin((Math.PI / 2) * (this.n / attack))
        env = x * x
      } else env *= decay
      this.n++
      this.grit += 0.12 * ((this.rand() * 2 - 1) - this.grit) // dull rumble of combustion, not hiss
      const pulse = this.amp * env * (1 + gritK * this.grit * 3)
      for (let b = 0; b < 2; b++) {
        const p = this.pipes[b]
        const delayed = p.buf[(this.w - Ds[b] + 4096) & 4095]
        p.lp += 0.2 * (delayed - p.lp) // each bounce loses its highs
        const y = (b === this.bank ? pulse : pulse * 0.25) + fb * p.lp
        p.buf[this.w] = y
        const o = y - this.dcx[b] + 0.995 * this.dc[b]
        this.dcx[b] = y
        this.dc[b] = o
      }
      this.w = (this.w + 1) & 4095
      L[i] = (this.dc[0] * 0.75 + this.dc[1] * 0.25) * 0.4
      R[i] = (this.dc[1] * 0.75 + this.dc[0] * 0.25) * 0.4
    }
    this.env = env
    return true
  }
}
registerProcessor('boat-engine', BoatEngine)
`

const s = {
  ok: false,
  rpm: null, // AudioParam-like setters
  load: null,
  shaper: null,
  tone: null,
  motor: null,
  roarGain: null,
  roarFilter: null,
  presence: 1, // mix level: eases to E.settle at a steady race speed, E.idleLevel standing still
  washGain: null,
  washFilter: null,
  sprayGain: null,
  sandGain: null,
  sandFilter: null,
  blip: 0, // tap boost rev that decays
  revAt: -1, // race start rev surge until this time
  slapAt: 0,
  rumbleGain: null,
}

function loop(kind, stereo = false) {
  const src = A.ctx.createBufferSource()
  src.buffer = stereo ? (kind === 'brown' ? A.noise.brownStereo : A.noise.pinkStereo) : A.noise[kind]
  src.loop = true
  src.start(0, Math.random() * (src.buffer.duration - 0.1))
  return src
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

async function motorSource(ctx) {
  try {
    if (!ctx.audioWorklet) throw new Error('no worklet')
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
    await ctx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    const node = new AudioWorkletNode(ctx, 'boat-engine', { outputChannelCount: [2] })
    return { node, rpm: node.parameters.get('rpm'), load: node.parameters.get('load') }
  } catch {
    // Fallback: a sawtooth at the firing rate plus a half-rate square for the lope.
    const out = gain(0.5)
    const a = ctx.createOscillator()
    a.type = 'sawtooth'
    const b = ctx.createOscillator()
    b.type = 'square'
    const bg = gain(0.4)
    a.connect(out)
    b.connect(bg).connect(out)
    a.start()
    b.start()
    const load = gain(0) // dummy param holder
    const rpm = {
      setTargetAtTime(v, t, k) {
        a.frequency.setTargetAtTime((v / 60) * 4, t, k)
        b.frequency.setTargetAtTime((v / 60) * 2, t, k)
      },
    }
    return { node: out, rpm, load: load.gain }
  }
}

onStart(async (ctx) => {
  const bus = A.engine
  // Motor chain: worklet -> saturation -> muffler lowpass -> level.
  const m = await motorSource(ctx)
  s.rpm = m.rpm
  s.load = m.load
  s.shaper = ctx.createWaveShaper()
  s.shaper.curve = saturation(1.4)
  s.shaper.oversample = '2x'
  s.tone = filt('lowpass', 500, 0.5)
  const body = filt('peaking', 110, 0.9)
  body.gain.value = 4 // chest of the exhaust note
  const soft = filt('highshelf', 2200, 0.7)
  soft.gain.value = -8 // no fizz up top: that is what tires the ear on a loop
  s.motor = gain(0)
  m.node.connect(s.shaper).connect(s.tone).connect(body).connect(soft).connect(s.motor).connect(bus)

  // Thruster roar: stereo pink noise, band-passed, rising with thrust.
  s.roarFilter = filt('bandpass', 300, 0.5)
  s.roarGain = gain(0)
  loop('pink', true).connect(s.roarFilter).connect(s.roarGain).connect(bus)
  const rumble = filt('lowpass', 140, 0.7)
  const rumbleGain = gain(0)
  loop('brown', true).connect(rumble).connect(rumbleGain).connect(bus)
  s.rumbleGain = rumbleGain

  // Hull: wash (mid noise), spray (high noise), both following speed on water.
  s.washFilter = filt('bandpass', 500, 0.5)
  s.washGain = gain(0)
  loop('pink', true).connect(s.washFilter).connect(s.washGain).connect(bus)
  const sprayFilter = filt('highpass', 2800, 0.5)
  s.sprayGain = gain(0)
  loop('white').connect(sprayFilter).connect(s.sprayGain).connect(bus)
  // Sand: a dry grainy hiss when the boat scrapes over the beach.
  s.sandFilter = filt('bandpass', 2200, 0.8)
  s.sandGain = gain(0)
  const grain = gain(1)
  loop('white').connect(s.sandFilter).connect(grain).connect(s.sandGain).connect(bus)
  // Grain: the hiss is chopped by a fast random-ish wobble so it reads as sand, not wind.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 23
  const lfoGain = gain(0.45)
  lfo.connect(lfoGain).connect(grain.gain)
  lfo.start()

  s.ok = true
})

// Tap boost: the throttle blips.
export function blip() {
  s.blip = Math.min(1, s.blip + 0.35)
}
// Race start: the motor screams up to full throttle for a moment.
export function rev() {
  if (A.ctx) s.revAt = A.ctx.currentTime + 1.2
}

const K = 0.06 // smoothing time constant for every continuous param (s)
// st: { speed (m/s), top (m/s, what counts as full speed), boost (0..0.3), onWater, moving (lobby
// joystick, 0..1), racing, staging, visible (the boat is on screen / near) }
export function update(dt, st) {
  if (!s.ok || !A.ctx) return
  const t = A.ctx.currentTime
  const f = Math.min(1, st.speed / Math.max(1, st.top))
  s.blip *= Math.exp(-4 * dt)
  const surge = t < s.revAt ? (s.revAt - t) / 1.2 : 0
  // Throttle: what the driver asks for. In the lobby, the stick; racing, flat out plus the taps.
  const throttle = Math.min(1, st.racing ? 0.75 + st.boost * 1.5 + s.blip * 0.4 + surge * 0.3 : Math.max(st.moving, f) * 0.9 + s.blip * 0.3)
  const rpm = E.idle + (E.max - E.idle) * Math.min(1, f * 0.72 + throttle * 0.2 + surge * 0.35 + s.blip * 0.12 + st.boost * 0.6)
  // Presence: racing at a steady speed the engine eases back so it never wears on the ear;
  // a tap, a boost or the start rev bring it forward. In the lobby, standing still = a quiet purr.
  const excite = Math.min(1, surge + s.blip * 1.5 + st.boost * 3)
  const goal = st.racing ? Math.max(E.settle, excite, 1 - f) : E.idleLevel + (1 - E.idleLevel) * Math.max(st.moving, f)
  s.presence += (goal - s.presence) * (1 - Math.exp(-dt / (goal > s.presence ? 0.15 : E.settleTime)))
  const level = (st.visible ? 1 : 0) * s.presence
  s.rpm.setTargetAtTime(rpm, t, K)
  s.load.setTargetAtTime(Math.min(1, 0.15 + throttle * 0.85), t, K)
  s.tone.frequency.setTargetAtTime(380 + throttle * 1400 + f * 500, t, K)
  s.motor.gain.setTargetAtTime(level * E.motor * (0.6 + 0.4 * throttle), t, K)
  const thrust = st.racing ? 0.4 + f * 0.6 + st.boost * 1.6 : Math.max(st.moving, f) * 0.45
  s.roarFilter.frequency.setTargetAtTime(200 + thrust * 700, t, K)
  s.roarGain.gain.setTargetAtTime(level * E.roar * thrust * thrust, t, K)
  s.rumbleGain.gain.setTargetAtTime(level * E.rumble * (0.3 + thrust), t, K)

  // Water vs sand under the hull.
  const v = st.speed
  const wet = st.onWater ? 1 : 0
  const w = Math.min(1, v / 40)
  s.washFilter.frequency.setTargetAtTime(380 + w * 1500, t, 0.1)
  s.washGain.gain.setTargetAtTime(level * wet * E.wash * Math.pow(w, 0.8), t, 0.1)
  s.sprayGain.gain.setTargetAtTime(level * wet * E.spray * w * w, t, 0.1)
  const sand = (1 - wet) * Math.min(1, v / 8) * (st.racing ? 0.4 : 1)
  s.sandFilter.frequency.setTargetAtTime(1600 + Math.min(1, v / 8) * 1400, t, 0.1)
  s.sandGain.gain.setTargetAtTime(level * E.sand * sand, t, 0.1)

  // Hull slapping through the chop: more and harder the faster we go.
  if (st.onWater && v > 6 && t > s.slapAt) {
    const k = Math.min(1, v / 50)
    burst({ t, noise: 'pink', type: 'lowpass', f: rnd(350, 700), q: 0.8, a: 0.004, d: rnd(0.06, 0.13), gain: E.slap * k * rnd(0.5, 1), bus: A.engine, pan: rnd(-0.3, 0.3) })
    tone({ t, f: rnd(70, 95), f2: 45, d: 0.08, gain: E.slap * 0.6 * k * rnd(0.5, 1), bus: A.engine })
    s.slapAt = t + rnd(0.18, 0.5) / (0.4 + k)
    if (Math.random() < 0.35) s.blip = Math.min(1, s.blip + 0.08) // the prop lifts out a moment: a little rev flutter
  }
}

