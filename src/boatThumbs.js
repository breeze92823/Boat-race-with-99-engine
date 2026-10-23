import { Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { BOATS } from './config.js'
import { buildBoat, disposeBoat } from './boatModels.js'

// Tile pictures for the Boats window: each catalog boat rendered once, three-
// quarter view with the bow to the right, on a transparent background with a
// thick dark outline (like the reference's cut-out renders). One boat per
// animation frame on a small throwaway WebGL context, so the game never
// stalls; the context is released when the queue is empty. Results are blob
// URLs, cached by boat id.
const { width: W, height: H, outline: R } = BOATS.thumb
const urls = new Map() // id -> blob URL
const waiting = new Map() // id -> [callbacks]
const queue = []
let gl = null
let scene = null
let camera = null
let out = null
let running = false

function setup() {
  gl = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  gl.setPixelRatio(1)
  gl.setSize(W, H, false)
  gl.outputColorSpace = SRGBColorSpace
  gl.setClearColor(0x000000, 0)
  scene = new Scene()
  scene.add(new HemisphereLight('#ffffff', '#8a8f99', 2.4))
  const sun = new DirectionalLight('#ffffff', 2.2)
  sun.position.set(-4, 10, 6)
  scene.add(sun)
  camera = new PerspectiveCamera(26, W / H, 0.1, 200)
  out = document.createElement('canvas')
  out.width = W
  out.height = H
}

function teardown() {
  gl.dispose()
  gl.forceContextLoss()
  gl = scene = camera = null
}

const box = new Box3()
const size = new Vector3()
const view = new Vector3(-1, 0.62, 0.72).normalize() // camera direction from the boat: bow (+Z) points right
function render(id) {
  const boat = buildBoat(id)
  scene.add(boat)
  box.setFromObject(boat)
  box.getSize(size)
  // Framed on the hull's footprint (masts and prows may run off the top, as in the reference).
  const span = Math.max(size.z, size.x * 1.6)
  const tanHalfWidth = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
  const dist = (span * 0.5) / tanHalfWidth / 0.86
  const target = new Vector3((box.min.x + box.max.x) / 2, box.min.y + Math.min(size.y, span * 0.3) * 0.55, (box.min.z + box.max.z) / 2)
  camera.position.copy(target).addScaledVector(view, dist)
  camera.lookAt(target)
  gl.render(scene, camera)
  scene.remove(boat)
  disposeBoat(boat)

  // Outline: the silhouette stamped around a circle in ink, then the picture on top.
  const ctx = out.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ctx.drawImage(gl.domElement, Math.cos(a) * R, Math.sin(a) * R)
  }
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#16131c'
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(gl.domElement, 0, 0)
  return new Promise((resolve) => out.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : out.toDataURL())))
}

function finish(id, url) {
  urls.set(id, url)
  for (const fn of waiting.get(id) ?? []) fn(url)
  waiting.delete(id)
}

// Draws queued boats a few milliseconds per frame; the PNG encodes finish on their own.
async function pump() {
  running = true
  const pending = []
  while (queue.length) {
    await new Promise((r) => {
      requestAnimationFrame(r)
      setTimeout(r, 120) // rAF is paused in background tabs
    })
    const start = performance.now()
    while (queue.length && performance.now() - start < BOATS.thumb.budgetMs) {
      const id = queue.shift()
      if (urls.has(id) || pending.includes(id)) continue
      if (!gl) setup()
      pending.push(id)
      let job
      try {
        job = render(id)
      } catch (err) {
        console.warn('[boats] thumbnail failed', id, err)
        job = Promise.resolve('')
      }
      job.then((url) => {
        pending.splice(pending.indexOf(id), 1)
        finish(id, url)
      })
    }
  }
  if (gl) teardown()
  running = false
}

// Calls fn(url) once boat `id`'s picture is ready ('' if it could not be drawn).
// `first` puts it at the front of the queue.
export function boatThumb(id, fn, first = false) {
  if (urls.has(id)) return fn(urls.get(id))
  if (!waiting.has(id)) waiting.set(id, [])
  waiting.get(id).push(fn)
  const i = queue.indexOf(id)
  if (i >= 0 && first) queue.splice(i, 1)
  if (i < 0 || first) first ? queue.unshift(id) : queue.push(id)
  if (!running) pump()
}
