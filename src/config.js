// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'boat-race-with-99-engine' // slug registered on bloxity.io
export const GAME_TITLE = 'Boat Race with 99 Engine'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- Server (net.js) -----------------------------------------------------------
// The Colyseus server (../Boat-race-with-99-engine-backend) holds the only save: nothing is kept
// in the browser. Deployed builds (prod and the dev channel) always go through the Bloxity
// matchmaker (Legion.SDK.net.resolveEndpoint): a fixed socket URL would pin everyone to one pod.
// Only the local dev server (`npm run dev`) connects straight to a URL.
export const SERVER_URL = import.meta.env.DEV ? import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567' : ''
export const NET = {
  saveEvery: 5, // s: progress is sent at most this often (and when the tab hides or closes)
  retry: 2, // s before the first reconnect; doubles after each failed resolve/join...
  retryMax: 30, // ...up to this (the matchmaker can hold a cold start for ~45 s)
  rejoin: 1, // s before resolving again after the room closed (e.g. its pod is being replaced)
  raceEvery: 0.25, // s: this player's race distance is relayed to the others at most this often
  // Presence (remotePlayers.js): this player's pose goes out at most `poseHz` times a second
  // (skipped while it stands still); remote players ease toward their last pose (plus
  // speed x heading for the time since it came: dead reckoning) at `remoteLerp` 1/s. The nearest
  // `maxRemotes` (fewer on touch) are drawn within `remoteFade` m (racers further down the lane
  // within `raceFade`); pets, partner and trail only within `detailRange` m.
  poseHz: 10,
  remoteLerp: 10,
  predictMax: 0.4, // s of dead reckoning at most (a stalled sender stops instead of drifting off)
  remoteFade: 220,
  raceFade: 600,
  maxRemotes: 20,
  maxRemotesTouch: 10,
  detailRange: 90,
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
// The lobby beach (world.js): one convex sand slab. The shoreline sweeps from
// the start gate (front, -Z) back toward +Z on both wings, so the side barriers
// funnel toward the gate like the reference shot.
export const BEACH = {
  front: -46, // z of the shoreline at the start gate
  back: 90, // z of the back edge
  halfWidth: 75, // x extent of the wings
  wingZ: 24, // z of the shoreline at the far left/right ends
  gateEdge: 21.5, // half-width of the straight shoreline in front of the gate
  depth: 4, // slab thickness above the sea floor
  tile: 18, // m per sand texture tile
  fenceHeight: 3, // invisible wall around the sand so nobody drives into the sea
}
export const WATER = { level: -0.6, size: 1400, color: '#12a9e6', shallow: '#7ff0ff' }
export const SPAWN = { x: 0, y: 0.05, z: 8 }
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z, the start gate)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // wide capsule: it carries the boat

// --- Lobby props (lobby.js) ---------------------------------------------------
// Roblox-scale, measured off the reference shot: the gate is ~38 m wide and
// ~50 m ahead of the spawn. Positions are (x, z) in metres.
export const LOBBY = {
  gate: { z: -43.5, halfWidth: 19, postHeight: 18.5, bannerY: 14.2, bannerHeight: 5.3, padDepth: 4.6, arrowY: 22.5, arrowScale: 3, arrowSpacing: 10.5 },
  lane: { length: 160, buoySpacing: 1.9 }, // buoy ropes from the gate posts out to sea
  // Red chevron walls, each from its gate end to its far end. The left one follows
  // the shoreline; the right one runs straight back past the spawn, like the shot.
  barrier: {
    height: 2,
    lines: [
      { from: [-22.5, -43], to: [-62, 8] },
      // wall: metres of chevron wall from the gate end (default the whole line, 0 = none)
      { from: [23, -43], to: [20, 25], wall: 47, height: 3.2, walkway: true, statues: true },
    ],
  },
  walkway: { width: 3.2, height: 0.4, check: 1.6 }, // raised checkered pink strip with red sides; check = m per 2x2 tile
  statues: { at: [22, 28, 34, 40], scale: 1.05 }, // on the right walkway, m from the wall's gate end
  upgrade: { x: -20, z: -18, scale: 1.6 },
  rockets: [
    // engine: the ENGINE gem engine it sells (interact.js).
    { name: 'GALACTIC THRUSTER', engine: 'galactic', x: -25, z: -7, label: '#ff4fd8', body: '#f4f6fb', nose: '#e8262b', fin: '#2f7dff', stripe: '#e8262b' },
    { name: 'BLAZE DRIFT', engine: 'blaze', x: -16, z: -31, label: '#ff3b3b', body: '#1a1b22', nose: '#e8262b', fin: '#e8262b', stripe: '#ffffff' },
  ],
  rocketScale: 1.25,
  umbrella: { x: -31, z: -20, scale: 2.1 },
  palms: [
    // x, z, height, leanX, leanZ (the back of the beach has its own, in PLAZA)
    [-36, 0, 16, 0.5, -0.15],
    [-46, -6, 12, 0.2, -0.3],
    [25, -6, 15, -0.45, -0.15],
    [36, -14, 12, -0.25, -0.2],
    [52, 6, 11, -0.15, -0.3],
    [-50, 10, 14, 0.1, -0.2], // behind the boat stall (west view)
    [-34, -22, 12, -0.2, 0.2],
  ],
  colors: {
    banner: '#0c0d14',
    bannerFrame: '#3d8bff',
    pad: '#ffd21a',
    barrier: '#e0262b',
    walkway: '#ff5fa8',
    walkwayLight: '#ff86c0',
    buoyA: '#ff3030',
    buoyB: '#ffd21a',
    arrow: '#e81e1e',
  },
}

// Palm trees (propkit.js), shared by the lobby and the plaza.
export const PALM = { trunk: '#a8743f', leaf: '#3fae2c' }

// --- Training plaza at the back of the beach (plaza.js) ---------------------------
// The reference's south view: two Train stations either side of a VIP portal
// under a waterfall, ringed by grassy cliffs. Facing it (+Z), +X is screen-left.
export const PLAZA = {
  platform: { width: 20, depth: 24, height: 0.35 },
  // Each station: six treadmill lanes in a straight grid of two rows of three
  // (station frame: rowZ/colX are lane centres), the whole station turned
  // (yaw) so the lanes' far ends lean toward the VIP in the middle. Lanes are
  // ~2x the boat's length with 1.8 m aisles between columns and a 2.4 m
  // walkway between the rows (the front row's SPEED boards stand in it).
  // `neon` is each lane's glowing rail colour, listed front row first, left to
  // right as seen from the spawn; `req`/`power` are the lock tags over the
  // SPEED boards. The front edge stays behind the end of the right walkway
  // (LOBBY, ~(20, 25)) and the Eggs stall; the back clears the pool and cliffs.
  lane: { width: 4.2, length: 7.6, rowZ: [-6.5, 4.3], colX: [6.3, 0, -6.3] },
  trains: [
    {
      x: 20.5, z: 39, yaw: -0.15, firstSpeed: 1, tags: ['Rebirth', 'Wins'],
      neon: ['#2f8cff', '#33ff6a', '#2f8cff', '#ff3bd8', '#ff2a2a', '#2f8cff'],
      req: ['0', '1K', '5K', '35K', '400K', '1M'],
      power: ['+1', '+3', '+5', '+10', '+20', '+30'],
    },
    {
      x: -20.5, z: 39, yaw: 0.15, firstSpeed: 7, tags: ['Power', 'Speed'],
      neon: ['#e8f4ff', '#33ff6a', '#27e8ff', '#ff3bd8', '#ff2a2a', '#2f8cff'],
      req: ['4M', '15M', '50M', '300M', '1.5B', '5B'],
      power: ['+40', '+50', '+60', '+70', '+80', '+90'],
    },
  ],
  vip: { x: 0, z: 42 },
  waterfall: { x: 0, z: 53.6, width: 11, height: 32 },
  // Kiosks just outside the stations' outer edges.
  golden: { x: 39, z: 37 },
  index: { x: 36, z: 48 },
  relics: { x: -39, z: 40 },
  chest: { x: -36, z: 50 },
  // x, z, height: red feather flags. They face +-X, so the east view sees them
  // broadside and the south view edge-on (thin red/white stripes).
  flags: [[24, 19, 13], [44, 60, 16], [-36, 30, 13], [-50, 64, 16], [36, 31, 13], [33, 54, 13], [-20, 21, 12]],
  // x, z, width, depth, height, yaw
  cliffs: [
    [0, 64, 34, 16, 32, 0],
    [-30, 72, 32, 18, 27, 0.25],
    [30, 72, 32, 18, 25, -0.25],
    [-56, 52, 22, 40, 22, 0.55],
    [56, 52, 22, 40, 24, -0.55],
    [-68, 22, 16, 30, 18, 0.2],
    [68, 22, 16, 30, 16, -0.2],
    [-15, 56, 12, 8, 13, 0.1],
    [16, 56, 12, 8, 11, -0.1],
  ],
  // x, z, y (cliff top or 0), height, leanX, leanZ
  palms: [
    [-8, 62, 32, 11, -0.1, -0.2],
    [10, 67, 32, 12, 0.15, -0.15],
    [-24, 67, 27, 12, 0.2, -0.2],
    [-38, 74, 27, 11, 0, -0.2],
    [26, 68, 25, 12, -0.2, -0.2],
    [40, 75, 25, 11, 0, -0.2],
    [-50, 42, 22, 11, 0.3, -0.2],
    [-58, 60, 22, 10, 0.2, -0.1],
    [50, 40, 24, 12, -0.3, -0.2],
    [60, 62, 24, 10, -0.2, -0.1],
    [-15, 55, 13, 9, 0.1, -0.3],
    [16, 55, 11, 10, -0.1, -0.3],
    [38, 25, 0, 13, -0.3, -0.1],
    [-42, 32, 0, 12, 0.3, -0.1],
  ],
  rock: '#966a6c',
  rockDark: '#6c4a52',
  grass: '#43c03a',
  grassLight: '#7ae04c',
}

// --- Shop stalls (shops.js) ---------------------------------------------------------
// Either side of the spawn, fronts facing it: Eggs past the statue wall (east
// view, +X) and Boats on the west side (-X). Items are listed left to right as
// seen from the front.
export const SHOPS = {
  eggs: {
    x: 26,
    z: 12,
    yaw: -Math.PI / 2, // local +Z (the front) faces -X
    width: 19,
    depth: 7,
    // price: Wins (trophies) per hatch; pets: hatch odds by PETS kind (weights, any total).
    eggs: [
      { name: 'Sunny Egg', price: 30, color: '#ffd21a', pets: { dog: 55, cat: 35, bunny: 10 } },
      { name: 'Spiky Egg', price: 1e3, color: '#ffb21a', spiky: true, pets: { cat: 40, bunny: 35, bear: 20, fox: 5 } },
      { name: 'Jungle Egg', price: 20e3, color: '#3ddc4a', glow: 0.8, pets: { bunny: 30, bear: 40, fox: 25, panda: 5 } },
      { name: 'Rainbow Egg', price: 500e3, rainbow: true, pets: { fox: 50, panda: 40, dragon: 10 } },
    ],
  },
  boats: {
    x: -27,
    z: 12,
    yaw: Math.PI / 2, // front faces +X
    width: 21,
    depth: 7,
    boatScale: 1.3,
    boatAngle: 0.55, // rad each boat is turned from side-on toward the front
    boats: [
      // stat: the number under the name; fx: 'aura' (rising glow + sparkles) or 'fire'; glow: neon/particle colour
      // id: the BOATS catalog boat it sells (interact.js).
      { id: 'royalWave', name: 'ROYAL WAVE', kind: 'speedboat', color: '#2bd14a', labelColor: '#ff3b3b', bow: -1, stat: '1699', fx: 'aura', glow: '#3dff6a' },
      { id: 'viking', name: 'VIKING SHIP', kind: 'viking', color: '#ffb21a', labelColor: '#ff3b3b', bow: 1, stat: '90', fx: 'fire', glow: '#ff8a1a' },
    ],
  },
}

// --- Hub pads (hub.js) ----------------------------------------------------------------
// A glowing touch pad in front of each shop object; driving onto one opens its
// window (once per visit: leave the pad to re-arm it). `open` names the window
// main.js passes in; keep them on open sand (the pink walkway runs past the Eggs
// stall's front, x > 17). Pets = the Eggs stall, Boats = the Boats stall, Engine =
// the Engine Upgrade machine, Partner = the hero statues on the right walkway.
export const HUB = {
  radius: 2.6, // m: the pad's size and its trigger distance from the boat's centre
  beamHeight: 1.8, // m of glowing light wall round the rim
  labelY: 3.4,
  labelHeight: 1.3,
  pads: [
    { open: 'pets', name: 'PETS', x: 14.2, z: 12, color: '#ffd21a' },
    { open: 'boats', name: 'BOATS', x: -19.6, z: 12, color: '#3dff6a' },
    { open: 'engine', name: 'ENGINES', x: -15.6, z: -12.5, color: '#3ff0ff' },
    { open: 'partner', name: 'PARTNERS', x: 15.2, z: -12, color: '#ff5fd8' },
  ],
}

// --- Interact prompts (interact.js) ---------------------------------------------------
// Near a shop object, a prompt over it says what E (or a tap on the prompt) does:
// hatch an egg, buy / equip a display boat, rocket engine or statue partner,
// upgrade to the next ladder engine, or open a hub pad's window. The nearest
// object in range wins. Radii are m (ground distance) from the object's centre.
export const INTERACT = {
  radius: { egg: 9, boat: 8, upgrade: 6.5, rocket: 5, statue: 5 },
  toastSeconds: 1.8,
}

// --- Eggs and hatching (eggs.js, hatch.js) -----------------------------------------------
// E at a stall egg opens its window (the egg, its Wins price, every pet with its
// odds + multiplier, Open 1 / Open N / Auto); a hatch pays, rolls (SHOPS.eggs
// `pets` weights, then a tier at its chance x luck) and plays the overlay. Ported
// from Kayak & Surf's eggs.js / hatch.js.
export const EGG_HATCH = {
  closeRange: 13, // m: driving further than this from the open egg closes its window
  openMany: 3, // eggs per Open N
  autoDelay: 0.35, // s between Auto's hatches
  time: { shake: 1.6, reveal: 1.8, auto: 0.55 }, // s: eggs shaking, cards shown; Auto plays at x`auto`
  // [PETS.tiers index, chance per hatch], rarest first; each chance x luck (1 + the boosts' luck %).
  tiers: [
    [2, 1 / 1000], // Rainbow
    [1, 1 / 50], // Golden
  ],
  rays: ['rare', 'epic', 'legendary'], // rarities with light rays behind the revealed card
  rarityColor: { common: '#e4e8f0', uncommon: '#6ee36e', rare: '#59b8ff', epic: '#c77dff', legendary: '#ffc93a' },
}

// --- Boats window (boats.js) + catalog models (boatModels.js) ----------------------
// The whole boat inventory, in window order (4 per row), from the Boats reference
// shots. Every boat is bought with Wins (the HUD's trophy counter); only the
// Wooden Raft is free (price null). wins / luck / acc are % boosts, engines the
// rocket xN; `rarity` colours the tile, preview and name. The first two were
// Robux boats in the reference: their Wins price comes from where their stats
// land on the ladder (Viking Ship ~ between the 11B and 88B boats; Royal Wave
// beats Sailing Ship Big on every stat). `model` = colours/options for the
// builder named by `kind` (boatModels.js).
export const BOATS = {
  preloadDelayMs: 4000, // tile pictures start drawing this long after boot
  start: { owned: ['raft'], equipped: 'raft' },
  rarity: { premium: '#ff5b37', common: '#d4d4d4', uncommon: '#62d65c', rare: '#2ba8f4', epic: '#ec5fc0', legendary: '#ffc61f' },
  // Boat name colour on the blue card, per rarity.
  nameColor: { premium: '#ff5b37', common: '#e4e4e4', uncommon: '#7dff6a', rare: '#bfeaff', epic: '#ff9ce0', legendary: '#ffd52e' },
  list: [
    { id: 'viking', name: 'Viking Ship', kind: 'viking', rarity: 'premium', price: 50e9, wins: 300, luck: 60, acc: 300, engines: 5, model: { color: '#d42a1c', head: '#d42a1c', deck: '#6a3a1c', stripes: '#ffcf1f', mane: ['#ffcf1f'], shields: ['#ffcf1f', '#d42a1c'] } },
    { id: 'royalWave', name: 'Royal Wave', kind: 'speedboat', rarity: 'premium', price: 1e18, wins: 1200, luck: 150, acc: 800, engines: 8, model: { color: '#0d1f10', deck: '#1d5a26', engine: '#0d1f10', band: '#3dff4a', neon: '#3dff4a' } },
    { id: 'raft', name: 'Wooden Raft', kind: 'raft', rarity: 'common', price: null, wins: 10, luck: 5, acc: 20, engines: 1, model: { color: '#b07440' } },
    { id: 'canoe', name: 'Canadian Canoe', kind: 'canoe', rarity: 'common', price: 200, wins: 20, luck: 7, acc: 50, engines: 1, model: { color: '#ffc21a', inner: '#e3a40e', rim: '#ffd84a', seat: '#c98a0c' } },
    { id: 'rowboat', name: 'Rowboat', kind: 'rowboat', rarity: 'common', price: 1e3, wins: 30, luck: 9, acc: 70, engines: 1, model: { color: '#5f636b', inner: '#9ea3ab' } },
    { id: 'jetski', name: 'Jet Ski', kind: 'jetski', rarity: 'common', price: 5e3, wins: 45, luck: 12, acc: 95, engines: 2, model: { color: '#1d2f63', seat: '#c8262b' } },
    { id: 'armyDinghy', name: 'Army Dinghy', kind: 'dinghy', rarity: 'uncommon', price: 40e3, wins: 65, luck: 15, acc: 120, engines: 2, model: { tube: '#4c5a2c', floor: '#2b3419' } },
    { id: 'nightDinghy', name: 'Night Dinghy', kind: 'dinghy', rarity: 'uncommon', price: 320e3, wins: 90, luck: 19, acc: 150, engines: 2, model: { tube: '#26272d', floor: '#a8561a' } },
    { id: 'tealConsole', name: 'Teal Console', kind: 'console', rarity: 'uncommon', price: 2.6e6, wins: 120, luck: 24, acc: 185, engines: 3, model: { color: '#13857a', deck: '#0d5a52' } },
    { id: 'redSailboat', name: 'Red Sailboat', kind: 'sailboat', rarity: 'uncommon', price: 21e6, wins: 150, luck: 29, acc: 220, engines: 3, model: { color: '#b8242a', sail: '#2a2a33', deck: '#3a3a42' } },
    { id: 'navyCruiser', name: 'Navy Cruiser', kind: 'cruiser', rarity: 'rare', price: 170e6, wins: 185, luck: 34, acc: 260, engines: 3, model: { color: '#25335a', cabin: '#3b4a78' } },
    { id: 'tugboat', name: 'Tugboat', kind: 'tug', rarity: 'rare', price: 1.4e9, wins: 225, luck: 40, acc: 300, engines: 4, model: { color: '#b83a2c', cabin: '#f4f4f4' } },
    { id: 'woodenSailboat', name: 'Wooden Sailboat', kind: 'sailboat', rarity: 'rare', price: 11e9, wins: 270, luck: 46, acc: 340, engines: 4, model: { color: '#7a4a26', sail: '#8c8378', deck: '#a06a3a', masts: 2 } },
    { id: 'navyYacht', name: 'Navy Yacht', kind: 'cruiser', rarity: 'rare', price: 88e9, wins: 320, luck: 52, acc: 380, engines: 4, model: { color: '#24427e', cabin: '#1d3466', rail: '#cfd6e0' } },
    { id: 'steelSailer', name: 'Steel Sailer', kind: 'sailboat', rarity: 'epic', price: 700e9, wins: 375, luck: 58, acc: 420, engines: 5, model: { color: '#6c7079', sail: '#3c3f46', deck: '#8a8f98', cabin: '#55595f' } },
    { id: 'harborFerry', name: 'Harbor Ferry', kind: 'tug', rarity: 'epic', price: 5.6e12, wins: 430, luck: 63, acc: 455, engines: 5, model: { color: '#26272c', cabin: '#ffcc22', roof: '#2a2b30', decks: 2, tires: true } },
    { id: 'shadowYacht', name: 'Shadow Yacht', kind: 'cruiser', rarity: 'epic', price: 45e12, wins: 480, luck: 68, acc: 480, engines: 5, model: { color: '#3a3d45', cabin: '#2a2c33', rail: '#8a8f98' } },
    { id: 'pirateShip', name: 'Pirate Ship', kind: 'galleon', rarity: 'epic', price: 360e12, wins: 530, luck: 72, acc: 500, engines: 5, model: { color: '#5a3418', deck: '#7a4a24', sail: '#17171b', trim: '#3a2210', masts: 2, skull: true } },
    { id: 'blackGalleon', name: 'Black Galleon', kind: 'galleon', rarity: 'legendary', price: 2.9e15, wins: 565, luck: 76, acc: 515, engines: 6, model: { color: '#1e1f24', deck: '#3a2a1c', sail: '#232428', trim: '#d8a21a', masts: 3 } },
    { id: 'sailingShipBig', name: 'Sailing Ship Big', kind: 'galleon', rarity: 'legendary', price: 23e15, wins: 600, luck: 80, acc: 530, engines: 6, model: { color: '#8a5428', deck: '#b07a44', sail: '#2f9df0', trim: '#5a3418', masts: 3 } },
  ],
  thumb: { width: 256, height: 320, outline: 7, budgetMs: 12 }, // px of each rendered tile picture, ms of drawing per frame (boatThumbs.js)
}

// A small rocky islet with palms out at sea, seen past the stall in the east view.
export const ISLET = { x: 115, z: -40, rock: [0, 0, 28, 18, 18, 0.3], hill: { rx: 36, ry: 7, rz: 24 } }

// --- Player boat (boat.js) ------------------------------------------------------
export const BOAT = {
  length: 3.6, // m bow to stern
  beam: 1.15, // m wide
  deck: 0.32, // m the rider stands above the player's feet
  hull: '#ffc21a',
  hullDark: '#8a4b1c',
  cockpit: '#d9822b',
  engine: '#1d6b55',
  engineBand: '#8dff6a',
  flame: '#38d7ff',
  flameGlow: 3, // HDR multiplier on the engine flames when bloom is on (propkit neon)
  bobAmount: 0.05, // m idle bob
  bobFrequency: 1.6, // Hz
  pitchPerAccel: 0.012, // rad of nose-up per m/s^2 of acceleration
  rollPerTurn: 0.12, // rad of lean into a turn
  ease: 6, // 1/s the tilt eases
}

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 170, far: 650 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#1576f0',
    horizon: '#a9e2ff',
    sunColor: '#fff4de',
    // Sun + hemi + env together keep the pale sand (#eed39c) near its own tan;
    // much more and ACES washes it (and the props) out to grey-white.
    sunIntensity: 2.4,
    sunElevation: 55, // degrees above the horizon
    sunAzimuth: 35, // degrees, 0 = from +Z
    hemiSky: '#e4f2ff',
    hemiGround: '#d8c39a',
    hemiIntensity: 0.8,
    envIntensity: 0.45,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.95,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Rebirth (rebirth.js) -------------------------------------------------------
// A rebirth spends all energy (the lightning total) for a permanent boost.
export const REBIRTH = {
  baseCost: 400, // energy needed for the first rebirth
  costGrowth: 1.75, // each rebirth costs this much more than the one before
  boostPerRebirth: 10, // % boost gained per rebirth (training gains and race Wins, boosts.js)
  startEnergy: 121, // a new player's lightning (the reference's 121 -> top speed 145)
}

// --- Training (training.js) ------------------------------------------------------------
// Standing on an unlocked treadmill lane (PLAZA.trains: `req` Wins = trophies to
// unlock, `power` lightning per tick) trains: every `tick` s it pays that power x
// the train boost (boosts.js) in lightning, which is race speed (RACE.speedPerBolt)
// and rebirth energy (one counter, rebirth.js). AUTO TRAIN pays `autoRate` of the
// best unlocked lane anywhere, also mid-race. Driving onto a locked lane says what it needs.
export const TRAIN = {
  tick: 1,
  autoRate: 0.5,
  popupSeconds: 1.1, // the "+N" bolt floating off the boat
}

// --- Pets (pets.js) ----------------------------------------------------------------
// Equipped pets add their multiplier above 1 to the boost (one 1.1x pet = 1.1x).
export const PETS = {
  equipSlots: 3, // pets equipped at once (the "1/3" counter)
  storage: 100, // pets owned at most (the "1/100" counter)
  craftCount: 5, // identical pets that Craft All turns into one of the next tier
  starter: ['dog'], // a new player's pets (the first one is equipped)
  // Pet kinds: name, multiplier, rarity (the portrait disc colour). Looks live in pets.js.
  kinds: {
    dog: { name: 'Doggy', mult: 1.1, rarity: 'common' },
    cat: { name: 'Kitty', mult: 1.25, rarity: 'common' },
    bunny: { name: 'Bunny', mult: 1.5, rarity: 'uncommon' },
    bear: { name: 'Bear', mult: 2, rarity: 'uncommon' },
    fox: { name: 'Fox', mult: 3, rarity: 'rare' },
    panda: { name: 'Panda', mult: 5, rarity: 'epic' },
    dragon: { name: 'Dragon', mult: 10, rarity: 'legendary' },
    // Online Gifts rewards (gifts.js).
    verdant: { name: 'Verdant Demon', mult: 15, rarity: 'legendary' },
    greenfire: { name: 'Greenfire Demon', mult: 25, rarity: 'legendary' },
    star: { name: 'Eternal Star', mult: 60, rarity: 'legendary' },
    // Daily Reward pets (daily.js): Day 2's Ghost Axolotl and the Axolotl Egg's (DAILY.egg).
    axolotl: { name: 'Axolotl', mult: 4, rarity: 'rare' },
    blueAxolotl: { name: 'Blue Axolotl', mult: 8, rarity: 'epic' },
    ghostAxolotl: { name: 'Ghost Axolotl', mult: 12, rarity: 'legendary' },
    sunAxolotl: { name: 'Sun Axolotl', mult: 40, rarity: 'legendary' },
    // Spin wheel jackpot (spin.js): the wheel's "250% HUGE" = +250% boost.
    hugeDemon: { name: 'Huge Ruby Demon', mult: 3.5, rarity: 'legendary' },
  },
  // Craft tiers, in order; a tier multiplies the kind's multiplier.
  tiers: [
    { name: 'Normal', mult: 1 },
    { name: 'Golden', mult: 2.5 },
    { name: 'Rainbow', mult: 6 },
  ],
}

// --- Pets + partner in the world (companions.js) ----------------------------------------
// Equipped pets hover in these slots round the boat (boat frame: +Z = forward, metres; the
// first ones beside the stern, the rest further back and higher), bobbing `bob` m and swinging
// after turns (`turnLag` 1/s). The partner stands on the boat behind the rider.
export const COMPANIONS = {
  slots: [[-2.1, 0.9, -1.4], [2.1, 0.9, -1.4], [0, 1.4, -3.2], [-2.3, 1.4, -3.5], [2.3, 1.4, -3.5], [-1.2, 1.9, -4.8], [1.2, 1.9, -4.8], [0, 2.3, -5.6]],
  petScale: 0.95,
  hugeScale: 1.7, // 'huge…' pet kinds
  bob: 0.14,
  turnLag: 4,
  partnerScale: 0.8,
}

// --- Online Gifts (gifts.js) -------------------------------------------------------
// Play-time rewards. Order = grid order (4 per row). at = minutes online until the
// gift can be claimed; the clock only runs while the game is open and visible, and
// it starts over once every gift is claimed. type: 'bolt' | 'trophy' (n of them),
// 'pet' (id = PETS.kinds key) or 'potion' (id = GIFTS.potions key). card = card
// colour (grey by default), tag = the small rainbow text over a pet's name.
export const GIFTS = {
  list: [
    { at: 1, type: 'bolt', n: 10 },
    { at: 3, type: 'trophy', n: 10 },
    { at: 5, type: 'bolt', n: 30 },
    { at: 8, type: 'trophy', n: 50 },
    { at: 10, type: 'bolt', n: 100 },
    { at: 15, type: 'pet', id: 'verdant', card: 'yellow' },
    { at: 20, type: 'bolt', n: 150, card: 'blue' },
    { at: 25, type: 'potion', id: 'doubleWin', card: 'red' },
    { at: 30, type: 'pet', id: 'greenfire', card: 'yellow' },
    { at: 40, type: 'potion', id: 'superLuck', card: 'red' },
    { at: 50, type: 'potion', id: 'golden', card: 'purple' },
    { at: 60, type: 'pet', id: 'star', card: 'orange', tag: 'OP!' },
  ],
  // Potions are only counted for now (no potion effects yet). color = liquid.
  potions: {
    doubleWin: { name: 'Potion Double Win', color: '#e8262e', light: '#ff7a7a' },
    superLuck: { name: 'Potion Super Luck', color: '#2fbf4a', light: '#8ff0a0' },
    golden: { name: 'Potion Golden', color: '#ffb800', light: '#ffe88a' },
    rainbow: { name: 'Potion Rainbow', color: '#b05cff', light: '#ffe14a', rainbow: true }, // Daily Reward day 6
  },
}

// --- Daily Reward (daily.js) -------------------------------------------------------------
// A 7-day calendar on the server's UTC clock (backend daily.ts, DAILY_DAYS): each new UTC
// day the player plays unlocks the next day; unlocked days stay claimable (they need not be
// consecutive) and once all 7 are claimed the next day starts over at Day 1. Claims are
// decided by the server; the reward is granted when it says yes. type: 'trophy' (n Wins),
// 'pet' (id = PETS.kinds key), 'potion' (id = GIFTS.potions key, only counted like the
// gifts' ones), 'egg' (n free hatches of DAILY.egg). title = the card's heading; the last
// day is the big card on the right.
export const DAILY = {
  autoOpen: 2.5, // s after joining that a claimable reward pops the window open (0 = never)
  days: [
    { type: 'trophy', n: 30, title: '30 Wins' },
    { type: 'pet', id: 'ghostAxolotl', title: 'Ghost Axolotl' },
    { type: 'trophy', n: 5e3, title: '5K Wins' },
    { type: 'potion', id: 'golden', title: 'Golden Potion' },
    { type: 'trophy', n: 20e3, title: '20K Wins' },
    { type: 'potion', id: 'rainbow', title: 'Rainbow Potion' },
    { type: 'egg', n: 4, title: 'Axolotl Egg' },
  ],
  // Day 7's egg (hatched for free through eggs.js's overlay): hatch weights by PETS kind.
  egg: { name: 'Axolotl Egg', color: '#ff8a1a', pets: { axolotl: 60, blueAxolotl: 30, ghostAxolotl: 8, sunAxolotl: 2 } },
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.14, // radians above the horizon (low chase cam, like the reference)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
  sound_volume: { def: '0.8', type: 'number', min: 0, max: 1 }, // audio/core.js master level
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- HUD (hud.js) ------------------------------------------------------------
// Layout is authored in pixels of the 1920x992 reference screenshot and scaled
// by --u = clamp(min(w / design.w, h / design.h), minScale, maxScale).
export const HUD = {
  design: { w: 1920, h: 992 },
  minScale: 0.46,
  maxScale: 1.25,
  stats: { trophies: 433, wins: 121, gems: 0 }, // a new player's values; `wins` (lightning) mirrors the rebirth energy
  rollMs: 450, // a counter rolls to its new value over this long
  chatUnread: 3,
  dailyGems: 9,
  boosts: { friends: 0, playtime: 2 }, // percent shown bottom-left
  // Race distance milestones: one row per zoom level, the bottom row is the
  // finest (0..2K), then 2K..13K, then 13K..the finish (RACE.finish, 2.5M). `to` = distance at the
  // segment's right edge, `at` = that edge in reference pixels (bar spans
  // 438..1482, the bottom row starts at 462 after the player's head at 440).
  progress: [
    [
      { label: '30K', to: 30000, color: '#8f3dff', at: 560 },
      { label: '100K', to: 100000, color: '#b13dff', at: 760 },
      { label: '500K', to: 500000, color: '#d83dff', at: 1010 },
      { label: '1M', to: 1000000, color: '#ff3dd8', at: 1230 },
      { label: '2.5M', to: 2500000, color: '#ffd23d', at: 1482 },
    ],
    [
      { label: '3K', to: 3000, color: '#ffff00', at: 710 },
      { label: '7K', to: 7000, color: '#1a3cff', at: 1088 },
      { label: '13K', to: 13000, color: '#ff2a1a', at: 1482 },
    ],
    [
      { label: '3', to: 3, color: '#ff2a1a', at: 487 },
      { label: '4', to: 4, color: '#1a3cff', at: 528 },
      { label: '5', to: 5, color: '#2a62ff', at: 580 },
      { label: '10', to: 10, color: '#4dff7a', at: 650 },
      { label: '25', to: 25, color: '#6dffc9', at: 730 },
      { label: '50', to: 50, color: '#ff9ade', at: 830 },
      { label: '100', to: 100, color: '#3a3a3a', at: 945 },
      { label: '500', to: 500, color: '#ff9500', at: 1073 },
      { label: '1K', to: 1000, color: '#0a9a1a', at: 1250 },
      { label: '2K', to: 2000, color: '#ff38ff', at: 1482 },
    ],
  ],
  // Cartoon heads (head() in hudIcons) for remote racers until (or unless) their Bloxity
  // profile picture loads; each racer gets one picked from its session id.
  racerLooks: [
    { skin: '#a7adb5', hair: '#2a2a33', style: 'ears' },
    { skin: '#f4dccb', hair: '#1d1d24', style: 'long' },
    { skin: '#f6e3cf', hair: '#7a3e1a', style: 'short' },
    { skin: '#c98f5f', hair: '#1e7a3a', style: 'cap' },
    { skin: '#f2c79a', hair: '#5a2f12', style: 'short' },
    { skin: '#3a3a44', hair: '#141418', style: 'bald' },
  ],
}

// --- Race (race.js) ----------------------------------------------------------------
// Driving through the START gate starts a race: the boat drives itself down the
// buoy lane (A/D or the joystick steer inside it) until `duration` runs out or
// the player taps Leave. Speeds and distances are in studs; the world moves
// `metresPerStud` m per stud. Top speed = (baseSpeed + speedPerBolt * lightning)
// x the Acc speed boost (121 bolts -> 145 before boosts, like the reference). Past `cruiseZ` the boat stays put and the
// lane, sea and trail scroll instead (the sea is only WATER.size wide).
export const RACE = {
  baseSpeed: 24,
  speedPerBolt: 1,
  // Acc (engine x boat engines + boat + partner + trail, boosts.js) also raises top
  // speed: x (1 + accSpeed x acc %). 1 = a "+50% Acc" card is +50% speed; 0 = acceleration only.
  accSpeed: 1,
  // Luck (boat + partner) gives each checkpoint a chance of paying double ("LUCKY x2"):
  // luck / (luck + half), at most `max` (20% luck -> 9%, 200% -> 50%).
  luck: { half: 200, max: 0.75 },
  accelTime: 5, // s from 0 to top speed (shortened by the acc boost, boosts.js)
  metresPerStud: 0.35,
  cruiseZ: -130,
  // The race ends at the finish line (or on Leave): `finish` studs down the lane. A new player
  // tops out at 262 studs/s (145 x the starter gear's +81%), 341 with the tap boost held full,
  // so 2.5M studs is at least 2 h of racing (~2.65 h without tapping).
  finish: 2.5e6,
  steerSpeed: 12, // m/s sideways at full stick
  laneMargin: 3, // m kept clear of the ropes
  lane: { length: 700, buoySpacing: 1.9, stripe: 1.9 }, // race lane past the gate (replaces the lobby's ropes while racing)
  // Scenery streaming past the lane (raceScenery.js): set pieces built once and recycled. One comes
  // every `gap` m (random in the range, mostly alternating sides) from `first` m past the gate; each
  // appears `ahead` m in front of the boat (inside the fog) and is recycled `behind` m behind it. An
  // arch spans the lane every `archEvery` m from `archFirst`. Per kind: `weight` (how often it comes up),
  // `x` = distance from the lane's centre line (m, either side), `y` = height (balloons).
  // The start island slides away with the scroll and is hidden once `homeHide` m gone (past the fog).
  scenery: {
    first: 150,
    gap: [34, 60],
    ahead: 720,
    behind: 260,
    archFirst: 420,
    archEvery: 700,
    homeHide: 650,
    kinds: {
      island: { weight: 5, x: [72, 160] },
      stack: { weight: 3, x: [40, 95] },
      ship: { weight: 4, x: [44, 105] },
      lighthouse: { weight: 1.4, x: [42, 80] },
      balloon: { weight: 2, x: [22, 90], y: [30, 58] },
      duck: { weight: 1, x: [32, 60] },
      dolphins: { weight: 2.5, x: [25, 31] },
    },
    // Anchored ships: catalog boat id and length (m).
    ships: [['pirateShip', 30], ['blackGalleon', 34], ['sailingShipBig', 32], ['woodenSailboat', 18], ['harborFerry', 22], ['navyYacht', 20]],
    balloons: [['#ff3b3b', '#ffe11a'], ['#2f9df0', '#ffffff'], ['#a01aff', '#3ff0d0', '#ffb21a'], ['#22d34a', '#ffffff', '#ff4a1a']],
    rainbow: ['#ff2a2a', '#ff8a1a', '#ffe11a', '#22d34a', '#1a9cff', '#3a3cff', '#a01aff'],
  },
  // Chase cam: behind and above, looking a little down the lane.
  // `compact` (portrait, or under compactHeight px tall) looks further down so the boat sits above the speedometer.
  // `orbit`: drag (mouse, or the touch look zone) swings the cam around the boat at `pivot` m above
  // it; pitch is the boom's angle above the horizon, kept in min..max (min keeps it above the water).
  camera: { distance: 13, height: 5.2, lookAhead: 14, lookHeight: 0.6, fov: 72, speedFov: 14, follow: 8, compactHeight: 500, compact: { distance: 15, height: 6.5, lookHeight: -4.5 }, orbit: { pivot: 1.2, minPitch: 0.06, maxPitch: 1.2 } },
  // Checkpoints: pale see-through walls across the lane (the last one passed +
  // the next `ahead - 1` are drawn). Spacing is picked per race from the top
  // speed: the `steps` value nearest (in log) to topSpeed x `seconds`, so one
  // comes every ~7 s at any speed (145 -> every 1K, like the reference); the
  // `early` distances below that step come first. A regular checkpoint pays
  // floor(studs x step / 1M) Wins, at least 1 (9K with a 1K step -> +9, like the
  // reference; total ~ distance^2 / 2M whatever the step), an early one 1. The studs in that
  // formula stop growing at top speed x `paySeconds`, so past there every checkpoint pays the
  // same and Wins come in at a steady rate: 45 s matches the old 90 s races back to back
  // (Wins per hour ~ 45 x speed^2 x 3600 / 1M at any speed; a new player's 2.5M-stud race ~29K),
  // instead of growing with the square of a 2 h race's distance,
  // x the Wins boost (boosts.js): a trophy "+N" pops by the studs callout, `trophies` trophy icons
  // fly from the boat into the trophy counter (each adds its share as it lands)
  // and confetti rains down (`confetti` pieces, `confettiTouch` on touch screens).
  checkpoint: { early: [10, 25, 50, 100, 250, 500], seconds: 7, paySeconds: 45, steps: [100, 250, 500, 1e3, 2.5e3, 5e3, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6], ahead: 4, wallHeight: 36, color: '#e4fbff', opacity: 0.5 },
  reward: { trophies: [3, 7], flight: 1.15, stagger: 0.09, popup: 2.2, confetti: 70, confettiTouch: 36, colors: ['#ff2a2a', '#ffe11a', '#22d34a', '#1a3cff'] },
  gauge: ['#3ff0d0', '#5fe84a', '#d8f23a', '#ffb21a', '#ff4a1a', '#e81a3a', '#a01aff'], // speedometer arc, slow -> fast
  resultSeconds: 3.2, // how long the race result stays up
  // Tap to boost: every tap / click / Space / touch JUMP mid-race adds `perTap`
  // to a boost (capped at `max`) that fades by `decay` of itself per second, so
  // ~3 taps/s holds +15% and ~6 taps/s the full +30%. Speed = top-speed curve x (1 + boost).
  tap: { perTap: 0.04, max: 0.3, decay: 0.8 },
  // Personal best (saved by the server, net.js): a BEST flag on the distance bar, "NEW RECORD!"
  // when a race passes it, and `bonus` x that race's Wins (at least 1) on top.
  best: { bonus: 0.2 },
}

// --- Engines (engine.js) ----------------------------------------------------------
// The Engine window's catalog. Everything but the free Basic Engine is bought with
// Wins (the HUD's trophy counter). Grid order: the three gem engines (red NEW
// cards), the Basic Engine, then the 30-engine ladder, one card colour per row of 4.
// stats are % boosts: wins, acc (boat acceleration), train (training gains).
// look colours the card art: kind 'rocket' | 'missile' | 'jet' | 'ship' | 'satellite'.
export const ENGINE = {
  starter: {
    id: 'basic',
    name: 'Basic Engine',
    stats: { wins: 6, acc: 11, train: 6 },
    look: { kind: 'rocket', body: '#f4f7f6', band: '#2fd05a', nose: '#f4f7f6', fin: '#e2e8e6', flame: '#3fc8ff' },
  },
  // Gem engines cost what a ladder engine with the same Wins boost would cost
  // (gemPrice in engine.js): Galactic 200M, Blaze 1.9Qa and Cyan Volt, past the
  // top of the ladder, 36Oc. Set `price` on one to override.
  gemTier: '#ff5d3a',
  gems: [
    { id: 'galactic', name: 'Galactic Thruster', stats: { wins: 55, acc: 105, train: 55 }, look: { kind: 'rocket', body: '#f6f8fb', band: '#ff3b3b', nose: '#ff3b3b', fin: '#2f6bff', flame: '#ff4fd8' } },
    { id: 'blaze', name: 'Blaze Drift', stats: { wins: 105, acc: 205, train: 105 }, look: { kind: 'jet', body: '#1b1b20', band: '#ff2a2a', nose: '#ff2a2a', fin: '#26262c', flame: '#ffb02e' } },
    { id: 'cyanvolt', name: 'Cyan Volt', stats: { wins: 200, acc: 355, train: 200 }, look: { kind: 'ship', body: '#eef6ff', band: '#3aa6ff', nose: '#20242c', fin: '#e63a3a', flame: '#5fd8ff' } },
  ],
  // Ladder engine k (1..30): price = firstPrice * priceGrowth^(k-1), rounded to 2
  // significant digits (100, 500, 2.5K, 13K, ... 4.8Sx, 24Sx); wins and train
  // boosts = winsStep * (k+1) % (10% ... 155%), acc = twice that.
  ladder: {
    firstPrice: 100,
    priceGrowth: 5,
    winsStep: 5,
    tiers: ['#c9c9c9', '#69d36b', '#4cb6ff', '#ff6fc8', '#ff4a4a', '#ffc81a', '#a51cff'], // card colour per row of 4 (the last repeats)
    engines: [
      { name: 'Red Rocket', look: { body: '#2e2f38', band: '#ff4141', nose: '#f2f2f2', fin: '#8a1d1d' } },
      { name: 'Blue Rocket', look: { body: '#24304f', band: '#4f7dff', nose: '#c9d6ff', fin: '#1b2850' } },
      { name: 'Olive Rocket', look: { body: '#5e5a1e', band: '#c9b832', nose: '#d8cc5a', fin: '#403d12' } },
      { name: 'Violet Rocket', look: { body: '#2c2448', band: '#8a5cff', nose: '#b49aff', fin: '#1d1733' } },
      { name: 'Navy Booster', look: { body: '#1f2b4d', band: '#3d5aa8', nose: '#2b3c6d', fin: '#141d36' } },
      { name: 'Camo Booster', look: { body: '#5c5a3c', band: '#8b8a5a', nose: '#3e3d28', fin: '#2f2e1e', camo: true } },
      { name: 'Crimson Booster', look: { body: '#d9d6d6', band: '#d62b2b', nose: '#b51f1f', fin: '#7d1414' } },
      { name: 'Jade Booster', look: { body: '#2c3a33', band: '#2fae5d', nose: '#1f7a40', fin: '#1a2620' } },
      { name: 'Sky Thruster', look: { body: '#e8f6ff', band: '#38b4ff', nose: '#38b4ff', fin: '#1f78c4' } },
      { name: 'Frost Thruster', look: { body: '#d5f3ff', band: '#8ee7ff', nose: '#ffffff', fin: '#5cb8d8', flame: '#9af0ff' } },
      { name: 'Tidal Thruster', look: { body: '#0d4f78', band: '#20d1ff', nose: '#0a3350', fin: '#073049', flame: '#20d1ff' } },
      { name: 'Storm Thruster', look: { body: '#39405a', band: '#ffe03a', nose: '#ffe03a', fin: '#232838', flame: '#ffe96a' } },
      { name: 'Candy Drive', look: { body: '#ffffff', band: '#ff4fa8', nose: '#ff4fa8', fin: '#c4307a', flame: '#ff8fd0' } },
      { name: 'Nebula Drive', look: { body: '#3a1d63', band: '#d06bff', nose: '#ff8af3', fin: '#24103f', flame: '#e58aff' } },
      { name: 'Plasma Drive', look: { body: '#4a1a6e', band: '#ff4fd8', nose: '#ffffff', fin: '#2d0f45', flame: '#ff6af0' } },
      { name: 'Quasar Drive', look: { body: '#f4ecff', band: '#9b4dff', nose: '#c08bff', fin: '#6a2ad1', flame: '#c9a2ff' } },
      { name: 'Ember Jet', look: { kind: 'jet', body: '#3a2a26', band: '#ff7a2e', nose: '#ff7a2e', fin: '#5a3a30', flame: '#ffb02e' } },
      { name: 'Magma Jet', look: { kind: 'jet', body: '#2a1c1c', band: '#ffcf3a', nose: '#ff4a1a', fin: '#7a1f12', flame: '#ff6a2e' } },
      { name: 'Inferno Jet', look: { kind: 'jet', body: '#d9d6d6', band: '#d62b2b', nose: '#d62b2b', fin: '#9a1a1a', flame: '#ff8a2e' } },
      { name: 'Volcano Jet', look: { kind: 'jet', body: '#141414', band: '#ff3a1a', nose: '#ffcf3a', fin: '#3a1410', flame: '#ff5a1a' } },
      { name: 'Sun Missile', look: { kind: 'missile', body: '#6a1e18', band: '#ffcf3a', nose: '#9a2a20', fin: '#3a0f0c' } },
      { name: 'Bronze Missile', look: { kind: 'missile', body: '#7a4a2a', band: '#c98a4a', nose: '#3a2418', fin: '#4a2a18' } },
      { name: 'Checker Missile', look: { kind: 'missile', body: '#5a1a1a', band: '#f2f2f2', nose: '#2a2a2a', fin: '#1d1d1d', checker: true } },
      { name: 'Shadow Missile', look: { kind: 'missile', body: '#1d1d24', band: '#3a3a46', nose: '#2a2a33', fin: '#101015' } },
      { name: 'Rust Orbiter', look: { kind: 'satellite', body: '#8a3a2a', band: '#c96a4a', nose: '#e8e0d8', fin: '#4a1f18', flame: '#ffb07a' } },
      { name: 'Night Orbiter', look: { kind: 'satellite', body: '#1d1d24', band: '#3a3a46', nose: '#c9d1d9', fin: '#1f2b6d', flame: '#9ab8ff' } },
      { name: 'Bee Orbiter', look: { kind: 'satellite', body: '#ffcf1a', band: '#1d1d24', nose: '#e8e8e8', fin: '#2a4fb8', flame: '#ffe96a' } },
      { name: 'Void Orbiter', look: { kind: 'satellite', body: '#2a1446', band: '#5a2a8a', nose: '#3a2a55', fin: '#2a1a4a', flame: '#c9a2ff' } },
      { name: 'Horn Satellite', look: { kind: 'satellite', body: '#1d4a4a', band: '#2a2a33', nose: '#1d1d24', fin: '#1f2f6d', flame: '#7affe0' } },
      { name: 'Wave Point Thruster', look: { kind: 'satellite', body: '#f2f4f8', band: '#ff8fb0', nose: '#f2f4f8', fin: '#2f6bdc', flame: '#ffffff' } },
    ],
  },
}

// --- Partners (partner.js) ----------------------------------------------------------
// The Partner window's catalog, in grid order (rows of 4). Nothing is free: every
// partner is bought with Wins (the HUD's trophy counter). The first row are the
// premium partners (red NEW ribbon), priced by performance against the ladder
// below them (whose prices grow ~8x per step). stats are % boosts: wins, luck,
// acc (boat acceleration). tint colours the name in the side panel. look
// dresses the blocky portrait (partner.js): hair/hat, face, shirt pattern, colours.
export const PARTNER = {
  featured: 'hacker', // shown when the window opens
  partners: [
    // Premium row (the reference's Robux 49 / 699 / 1999 / 4999 partners).
    { id: 'jester', name: 'Jester', price: 85e9, isNew: true, tint: '#ff9ad5', stats: { wins: 120, luck: 80, acc: 115 }, look: { skin: '#fff1ea', hair: 'pigtails', hairColor: '#e9e4dc', tipA: '#ff5fa2', tipB: '#5fb8ff', face: 'clown', shirt: 'stripes', color: '#e8eef5', color2: '#d9263a', pants: '#2b3fa8', pants2: '#d9263a' } },
    { id: 'batman', name: 'Batman', price: 12e15, isNew: true, tint: '#ffd400', stats: { wins: 340, luck: 230, acc: 330 }, look: { hat: 'cowl', hatColor: '#26262e', shirt: 'emblem', color: '#33343d', color2: '#ffd23a', arms: '#26262e', pants: '#26262e', cape: '#1d1d23' } },
    { id: 'hacker', name: 'Hacker', price: 800e15, isNew: true, tint: '#f59dff', stats: { wins: 500, luck: 340, acc: 490 }, look: { skin: '#fff1ea', hair: 'pigtails', hairColor: '#f4f1ec', tipA: '#ff4f86', tipB: '#3f8bff', face: 'clown', shirt: 'stripes', color: '#f4f4f4', color2: '#e3263a', pants: '#e3263a', pants2: '#2846c8' } },
    { id: 'darkknight', name: 'Dark Knight', price: 80e18, isNew: true, tint: '#b9a7ff', stats: { wins: 750, luck: 510, acc: 730 }, look: { hat: 'cowl', hatColor: '#141418', shirt: 'armor', color: '#1d1d23', color2: '#4a4a55', arms: '#141418', pants: '#141418', cape: '#0e0e12' } },
    // Ladder.
    { id: 'prisoner', name: 'Prisoner', price: 100, tint: '#ffa31a', stats: { wins: 30, luck: 20, acc: 20 }, look: { hair: 'short', hairColor: '#6b3d1f', shirt: 'jumpsuit', color: '#ff8a1f', color2: '#fff', pants: '#ff8a1f' } },
    { id: 'police', name: 'Police', price: 2e3, tint: '#7fc4ff', stats: { wins: 35, luck: 25, acc: 25 }, look: { hat: 'police', hatColor: '#1d2c5e', shirt: 'police', color: '#2f63c8', color2: '#ffd23a', pants: '#1d2c5e' } },
    { id: 'courier', name: 'Courier', price: 80e3, tint: '#ffd400', stats: { wins: 45, luck: 30, acc: 30 }, look: { skin: '#ffd23a', hat: 'cap', hatColor: '#e3263a', shirt: 'bands', color: '#ffd23a', color2: '#1d1d23', arms: '#1d1d23', pants: '#1d1d23' } },
    { id: 'robber', name: 'Robber', price: 2.4e6, tint: '#d0d0d8', stats: { wins: 55, luck: 35, acc: 35 }, look: { hat: 'balaclava', hatColor: '#1d1d23', shirt: 'hoodie', color: '#2a2a31', color2: '#3d3d46', pants: '#1d1d23', bat: true } },
    { id: 'builder', name: 'Builder', price: 48e6, tint: '#ffc21a', stats: { wins: 65, luck: 40, acc: 45 }, look: { hat: 'hardhat', hatColor: '#c98a2a', face: 'shades', shirt: 'vest', color: '#2f4f86', color2: '#ff8a1f', pants: '#2b3550' } },
    { id: 'detective', name: 'Detective', price: 480e6, tint: '#e0b77a', stats: { wins: 75, luck: 50, acc: 55 }, look: { hair: 'swept', hairColor: '#1d1d23', shirt: 'jacket', color: '#b08a4a', color2: '#1d1d23', pants: '#2a2a31' } },
    { id: 'pinkmask', name: 'Pink Mask', price: 3.8e9, tint: '#ff7ab8', stats: { wins: 90, luck: 60, acc: 70 }, look: { hat: 'mask', hatColor: '#1d1d23', hood: '#e0337a', shirt: 'suit', color: '#e0337a', color2: '#b5205e', pants: '#e0337a' } },
    { id: 'soldier', name: 'Soldier', price: 30e9, tint: '#c7ccd4', stats: { wins: 110, luck: 70, acc: 85 }, look: { hair: 'short', hairColor: '#2a2a31', shirt: 'camo', color: '#8a8f96', color2: '#5d6168', pants: '#5d6168' } },
    { id: 'glitch', name: 'Glitch', price: 240e9, tint: '#5dff6a', stats: { wins: 130, luck: 85, acc: 105 }, look: { skin: '#123d18', hat: 'fedora', hatColor: '#0f3313', face: 'code', shirt: 'code', color: '#0f3313', color2: '#3dff5a', arms: '#0f3313', pants: '#0f3313' } },
    { id: 'superhero', name: 'Superhero', price: 1.9e12, tint: '#6fa8ff', stats: { wins: 160, luck: 105, acc: 130 }, look: { hair: 'swept', hairColor: '#15151a', shirt: 'hero', color: '#2456d6', color2: '#e3263a', pants: '#2456d6', cape: '#e3263a', armsUp: true } },
    { id: 'mechanic', name: 'Mechanic', price: 15e12, tint: '#ffd400', stats: { wins: 190, luck: 125, acc: 160 }, look: { skin: '#ffd23a', hat: 'cap', hatColor: '#d9263a', shirt: 'bands', color: '#2a2a31', color2: '#ffd23a', arms: '#ffd23a', pants: '#2a2a31' } },
    { id: 'bandit', name: 'Bandit', price: 120e12, tint: '#d0d0d8', stats: { wins: 230, luck: 150, acc: 195 }, look: { hat: 'balaclava', hatColor: '#141418', shirt: 'hoodie', color: '#1d1d23', color2: '#4a4a55', pants: '#141418', bat: true } },
    { id: 'foreman', name: 'Foreman', price: 1e15, tint: '#ffc21a', stats: { wins: 270, luck: 180, acc: 240 }, look: { hat: 'hardhat', hatColor: '#ffc21a', face: 'shades', shirt: 'vest', color: '#1f3a6b', color2: '#ffd400', pants: '#1d2c5e' } },
    { id: 'spy', name: 'Spy', price: 8e15, tint: '#e0b77a', stats: { wins: 330, luck: 220, acc: 300 }, look: { hair: 'swept', hairColor: '#1d1d23', face: 'shades', shirt: 'jacket', color: '#2a2a31', color2: '#d9263a', pants: '#1d1d23' } },
    { id: 'commander', name: 'Commander', price: 64e15, tint: '#ff7ab8', stats: { wins: 400, luck: 265, acc: 380 }, look: { hat: 'mask', hatColor: '#141418', hood: '#141418', shirt: 'suit', color: '#1d1d23', color2: '#e0337a', pants: '#1d1d23' } },
    { id: 'guard', name: 'Guard', price: 500e15, tint: '#f2b45a', stats: { wins: 480, luck: 320, acc: 470 }, look: { hair: 'short', hairColor: '#15151a', shirt: 'labcoat', color: '#f2f4f6', color2: '#8fd8d2', arms: '#f2f4f6', pants: '#8fd8d2', clipboard: true } },
  ],
}

// --- Trails (trails.js scene, trail.js ribbon) -------------------------------------
// The whole Trails catalog, in grid order (3 per row), as in the reference
// shots. White is free from the start; every other trail is bought with Wins.
// Its price comes from its benefit (pricing below), so a stronger trail always
// costs more: Red ~800, Orange ~3K ... Water Ripple ~2.5Qa, and the four gold
// "gem" cards (premium art, no rebirth needed) sit on the same curve by their
// boosts. rebirth: N = can only be bought from N rebirths on. stats are % boosts.
// look: the ribbon (trail.js) and card art: color tints it; texture names a
// painter in trailTextures.js (also used for the card + swatch picture); art
// names a card drawing in trails.js (gold cards); add = additive glow; width
// (m) and tile (m per texture repeat) override the ribbon defaults.
export const TRAILS = {
  start: { owned: ['white'], equipped: 'white' },
  // price = base * (average boost / benefit)^power, rounded to 2 significant digits.
  pricing: { base: 800, benefit: 60, power: 8.5 },
  list: [
    { id: 'ghost', name: 'Ghost', gold: true, stats: { wins: 5000, acc: 5000 }, look: { art: 'ghost', texture: 'wisps', add: true, width: 0.9, tile: 3.5 } },
    { id: 'magma', name: 'Magma', gold: true, stats: { wins: 3100, acc: 3000 }, look: { texture: 'magma' } },
    { id: 'soundWave', name: 'Sound Wave', gold: true, stats: { wins: 1750, acc: 1500 }, look: { art: 'wave', texture: 'soundwave', width: 0.75, tile: 3 } },
    { id: 'musicalNote', name: 'Musical Note', gold: true, stats: { wins: 850, acc: 900 }, look: { art: 'notes', texture: 'notes', width: 0.62, tile: 3.2 } },
    { id: 'white', name: 'White', stats: { wins: 50, acc: 50 }, look: { color: '#ffffff' } },
    { id: 'red', name: 'Red', stats: { wins: 60, acc: 60 }, look: { color: '#ff1414' } },
    { id: 'orange', name: 'Orange', stats: { wins: 70, acc: 70 }, look: { color: '#ff7c00' } },
    { id: 'olive', name: 'Olive', rebirth: 5, stats: { wins: 80, acc: 85 }, look: { color: '#d6c51a' } },
    { id: 'green', name: 'Green', rebirth: 5, stats: { wins: 90, acc: 95 }, look: { color: '#1bc41b' } },
    { id: 'teal', name: 'Teal', rebirth: 5, stats: { wins: 110, acc: 100 }, look: { color: '#16c9a0' } },
    { id: 'blue', name: 'Blue', rebirth: 10, stats: { wins: 120, acc: 130 }, look: { color: '#2140ff' } },
    { id: 'purple', name: 'Purple', rebirth: 10, stats: { wins: 140, acc: 145 }, look: { color: '#9a1cff' } },
    { id: 'sage', name: 'Sage', rebirth: 10, stats: { wins: 175, acc: 155 }, look: { color: '#8fd08a' } },
    { id: 'navy', name: 'Navy', rebirth: 15, stats: { wins: 180, acc: 200 }, look: { color: '#3048d0' } },
    { id: 'mauve', name: 'Mauve', rebirth: 15, stats: { wins: 220, acc: 220 }, look: { color: '#b85cc8' } },
    { id: 'circuit', name: 'Circuit', rebirth: 25, stats: { wins: 270, acc: 235 }, look: { texture: 'circuit' } },
    { id: 'rainbow', name: 'Rainbow', rebirth: 30, stats: { wins: 280, acc: 310 }, look: { texture: 'rainbow' } },
    { id: 'orbit', name: 'Orbit', rebirth: 30, stats: { wins: 340, acc: 350 }, look: { texture: 'orbit' } },
    { id: 'carpet', name: 'Royal Carpet', rebirth: 30, stats: { wins: 420, acc: 370 }, look: { texture: 'carpet' } },
    { id: 'matrix', name: 'Matrix', rebirth: 35, stats: { wins: 430, acc: 480 }, look: { texture: 'matrix' } },
    { id: 'paws', name: 'Paw Prints', rebirth: 35, stats: { wins: 520, acc: 530 }, look: { texture: 'paws' } },
    { id: 'runes', name: 'Ancient Runes', rebirth: 35, stats: { wins: 650, acc: 570 }, look: { texture: 'runes' } },
    { id: 'abyss', name: 'Abyss', rebirth: 40, stats: { wins: 660, acc: 750 }, look: { texture: 'abyss' } },
    { id: 'film', name: 'Film Reel', rebirth: 40, stats: { wins: 810, acc: 820 }, look: { texture: 'film' } },
    { id: 'honeycomb', name: 'Honeycomb', rebirth: 40, stats: { wins: 1010, acc: 880 }, look: { texture: 'honeycomb' } },
    { id: 'skeleton', name: 'Skeleton', rebirth: 45, stats: { wins: 1020, acc: 1150 }, look: { texture: 'skeleton' } },
    { id: 'bubbles', name: 'Bubbles', rebirth: 45, stats: { wins: 1250, acc: 1260 }, look: { texture: 'bubbles' } },
    { id: 'toxic', name: 'Toxic', rebirth: 45, stats: { wins: 1500, acc: 1400 }, look: { texture: 'toxic' } },
    { id: 'waterRipple', name: 'Water Ripple', rebirth: 50, stats: { wins: 1550, acc: 1840 }, look: { texture: 'ripple', add: true } },
  ],
  // The ribbon behind the boat (trail.js): a band fed from the stern that turns
  // to face the camera (upright seen from the side, flat on the water from
  // behind), fading out over its life. width/tile are the defaults per look.
  ribbon: { points: 72, life: 0.9, spacing: 0.35, width: 0.6, tile: 2.4, opacity: 0.95, height: 0.14, stern: 1.45 },
  // The scene's showcase: the boat parked in the sea off the east wing, broadside
  // to a low camera that looks back at the beach and cliffs (like the reference).
  // view = horizontal direction the camera looks; the boat faces the camera's right.
  showcase: { x: 57, z: -18.5, y: -0.72, view: [-0.795, 0.607], speed: 24, distance: 4.6, height: 0.95, boatWidth: 0.25, portraitBoatWidth: 0.62, portraitRaise: 0.3 },
}

// --- Audio (src/audio/) ---------------------------------------------------------------
// Everything is synthesised at runtime (no sound files). volume = default master
// level (the portal's sound_volume setting overrides it; M mutes, saved under storageKey).
export const AUDIO = {
  volume: 0.8,
  storageKey: 'boat-race-99.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.55, engine: 0.5 }, // per-bus levels before the master
  duck: 0.45, // world (ambience + engine) level while a menu window is open
  maxVoices: 48, // one-shot sounds at once before low-priority ones are skipped
  maxVoicesTouch: 24,
  // Generated impulse response: pre-delay s, early reflections [ms, gain], tail decay s (to -60 dB),
  // tail level, how fast the tail darkens, and the default send level.
  reverb: { seconds: 1.8, preDelay: 0.012, early: [[19, 0.5], [31, 0.35], [47, 0.28], [73, 0.2], [97, 0.12]], decay: 1.4, tail: 0.18, darken: 1.6, send: 0.9 },
  // The boat (audio/engine.js): rpm at idle / flat out, layer levels; idleLevel = mix level standing
  // still in the lobby, settle = racing level once the speed is steady, eased to over settleTime s.
  engine: { idle: 720, max: 4800, motor: 0.45, roar: 0.2, rumble: 0.1, wash: 0, spray: 0, slap: 0.2, sand: 0.06, idleLevel: 0.3, settle: 0.62, settleTime: 4 },
  // The beach (audio/ambience.js): scheduler tick s, layer levels, foam bubbles per second of a
  // receding wave, gull call gap range s, crickets [Hz, pan], waterfall level and the distance (m)
  // at which it is at half level.
  ambience: { tick: 0.25, foam: 16, foamTouch: 7, gull: 0.05, gullEvery: [14, 34], cricket: 0.025, crickets: [[4400, -0.6], [4750, 0.5], [5100, 0.1]], waterfall: 0.55, waterfallNear: 16 },
}

// --- UI juice (juice.js) -------------------------------------------------------------
// Particles per burst kind, the touch-screen scale on those counts, and how many grid
// cards cascade in when a window opens.
export const JUICE = { coins: 16, stars: 18, sparks: 12, big: 40, touchScale: 0.55, cascade: 28 }

// --- Spin wheel (spin.js) ---------------------------------------------------------------
// The server owns the spins and rolls every spin (backend spin.ts + constants.ts SPIN_*): keep
// freeEvery / cap and the wedge ids in step with it. One free spin every `freeEvery` minutes
// (real time, also offline) until `cap` are stored. Wedges clockwise from the pointer, each 72
// degrees; `chance` is only the label (the server's weights decide). Prize: type 'trophy' (n
// Wins), 'potion' (id = GIFTS.potions key, counted like the gift potions) or 'pet' (PETS kind).
export const SPIN = {
  freeEvery: 15,
  cap: 5,
  turns: 6, // full turns before it lands
  seconds: 5.2, // spin length
  timeout: 6, // s to wait for the server's answer
  wedges: [
    { id: 'doubleWins', chance: '35%', type: 'potion', potion: 'doubleWin', label: 'x2 WINS', color: '#ff6b6b', dark: '#d94848' },
    { id: 'wins50', chance: '25%', type: 'trophy', n: 50, label: '50 Wins', color: '#ffd84a', dark: '#e8b81c' },
    { id: 'luck', chance: '35%', type: 'potion', potion: 'superLuck', label: 'LUCK', color: '#4cd964', dark: '#2fb648' },
    { id: 'wins250', chance: '4.9%', type: 'trophy', n: 250, label: '250 Wins', color: '#a24cf0', dark: '#7f2fd0' },
    { id: 'hugePet', chance: '0.1%', type: 'pet', pet: 'hugeDemon', label: '250% HUGE', tag: 'OP', color: '#1f9cf0', dark: '#1478c8' },
  ],
}
