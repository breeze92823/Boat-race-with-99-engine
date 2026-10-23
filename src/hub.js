import { AdditiveBlending, CanvasTexture, CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, SRGBColorSpace, TorusGeometry } from 'three'
import { HUB } from './config.js'
import { createEmitter } from './particles.js'
import { paintFade, paintSoftDot } from './textures.js'
import { label, neon, put, std } from './propkit.js'
import { anyWindowOpen } from './uiWindow.js'
import { sfx } from './audio/index.js'

// Hub pads: a glowing touch pad in front of each shop object (HUB.pads). The
// boat driving onto one opens that object's window: the Eggs stall opens Pets,
// the Boats stall Boats, the Engine Upgrade machine Engine, the hero statues
// Partner. A pad fires once per visit (drive off to re-arm), and never while
// another window is open (it just counts as visited then), so closing a window
// on the pad does not pop it straight back up.
// windows: { [pad.open]: () => void }.
export function createHub(scene, windows) {
  const dotTex = new CanvasTexture(paintSoftDot(128))
  dotTex.colorSpace = SRGBColorSpace
  const R = HUB.radius
  const disc = new CircleGeometry(R, 40)
  const base = new CylinderGeometry(R + 0.2, R + 0.3, 0.08, 40)
  const baseMat = std('#1c2340', { roughness: 0.4 })
  const ring = new TorusGeometry(R, 0.16, 8, 48)
  const beam = new CylinderGeometry(R, R, HUB.beamHeight, 40, 1, true)
  const sparkles = []
  const pads = HUB.pads.map((spec, i) => {
    const g = new Group()
    g.position.set(spec.x, 0, spec.z)
    scene.add(g)
    const glowMat = new MeshBasicMaterial({ map: dotTex, color: spec.color, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false })
    put(g, base, baseMat, 0, 0.04, 0) // dark so the glow stands out on the pale sand
    const pool = put(g, disc, glowMat, 0, 0.09, 0, false)
    pool.rotation.x = -Math.PI / 2
    const rim = put(g, ring, neon(spec.color, 2.4), 0, 0.1, 0, false)
    rim.rotation.x = Math.PI / 2
    const inner = new Mesh(ring, rim.material)
    inner.rotation.x = Math.PI / 2
    inner.position.y = 0.1
    g.add(inner)
    // A short see-through light wall round the rim, so the flat pad reads from the low chase cam.
    const fade = new CanvasTexture(paintFade(spec.color))
    fade.colorSpace = SRGBColorSpace
    const beamMat = new MeshBasicMaterial({ map: fade, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false })
    put(g, beam, beamMat, 0, HUB.beamHeight / 2, 0, false)
    const tag = label(spec.name, HUB.labelHeight, { color: spec.color, outline: '#1a0a14', font: '700 64px Fredoka, sans-serif', outlineWidth: 10 })
    tag.position.y = HUB.labelY
    g.add(tag)
    sparkles.push({ x: spec.x, y: 0.6, z: spec.z, sx: R * 0.8, sy: 0.3, sz: R * 0.8, color: spec.color })
    return { spec, glowMat, beamMat, inner, tag, phase: i * 1.7, inside: false }
  })
  createEmitter(scene, {
    boxes: sparkles, count: 60, life: 1.8, velocity: [0, 1.2, 0], spread: [0.15, 0.3, 0.15],
    size: 0.35, intensity: 3, twinkle: 7, sprite: 'sparkle', seed: 81,
  })

  return {
    // pos: the player's feet, or null while the pads are off (racing, the Trails scene).
    update(elapsed, pos) {
      for (const p of pads) {
        const t = elapsed * 2.2 + p.phase
        p.glowMat.opacity = 0.5 + Math.sin(t) * 0.15
        p.beamMat.opacity = 0.42 + Math.sin(t) * 0.12
        const s = 0.35 + ((elapsed * 0.6 + p.phase) % 1) * 0.65 // a ring rippling out to the rim
        p.inner.scale.set(s, s, 1)
        p.tag.position.y = HUB.labelY + Math.sin(t) * 0.12
        const inside = !!pos && Math.hypot(pos.x - p.spec.x, pos.z - p.spec.z) < R
        if (inside && !p.inside && !anyWindowOpen()) {
          sfx.padEnter()
          windows[p.spec.open]?.()
        }
        p.inside = inside
      }
    },
  }
}
