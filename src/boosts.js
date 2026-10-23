import { BOATS, PARTNER, RACE } from './config.js'
import { ENGINES, engineBoost, engineState } from './engine.js'
import { partnerBoost, partnerState } from './partner.js'
import { petBoost, petsState } from './pets.js'
import { boatState } from './boats.js'
import { rebirthBoost, rebirthState } from './rebirth.js'
import { trailById, trailState } from './trails.js'

// Everything the player owns that has a value, wired into gameplay. Each
// equipped thing is a source of % stats (as its window shows them):
//   engine   wins / acc / train, times the boat's engine count ("x5" carries 5)
//   boat     wins / luck / acc
//   partner  wins / luck / acc
//   trail    wins / acc
//   rebirth  +REBIRTH.boostPerRebirth % per rebirth, to wins and train
//   pets     a multiplier on Wins (1 + each equipped pet's multiplier above 1)
// Combined (boosts()):
//   wins   race Wins: 1 + sum of wins %, times the pets' boost
//   acc    1 + sum of acc %: race acceleration, and top speed x (1 + RACE.accSpeed x acc %)
//   train  training lightning: 1 + sum of train %
//   luck   sum of luck %; `lucky` = luck / (luck + RACE.luck.half) (at most RACE.luck.max)
//          is each checkpoint's chance to pay double
// Read when a race starts / a training tick pays, so equipping something counts from the next one.
const boatById = new Map(BOATS.list.map((b) => [b.id, b]))
const engineById = new Map(ENGINES.map((e) => [e.id, e]))
const partnerById = new Map(PARTNER.partners.map((p) => [p.id, p]))

// [{ id, name, wins, acc, luck, train }] in %, one per source (zeros where it has none).
export function boostSources() {
  const boat = boatById.get(boatState.equipped)
  const count = boat?.engines ?? 1
  const engine = engineBoost()
  const partner = partnerBoost()
  const trail = trailById(trailState.equipped)
  const rebirth = rebirthBoost(rebirthState.rebirths)
  const row = (id, name, s = {}) => ({ id, name, wins: s.wins ?? 0, acc: s.acc ?? 0, luck: s.luck ?? 0, train: s.train ?? 0 })
  return [
    row('engine', `${engineById.get(engineState.equipped)?.name ?? 'No Engine'} x${count}`, {
      wins: engine.wins * count,
      acc: engine.acc * count,
      train: engine.train * count,
    }),
    row('boat', boat?.name ?? 'No Boat', boat),
    row('partner', partnerById.get(partnerState.equipped)?.name ?? 'No Partner', partner),
    row('trail', trail ? `${trail.name} Trail` : 'No Trail', trail?.stats),
    row('rebirth', `Rebirth x${rebirthState.rebirths}`, { wins: rebirth, train: rebirth }),
  ]
}

export function boosts() {
  let wins = 0
  let acc = 0
  let luck = 0
  let train = 0
  for (const s of boostSources()) {
    wins += s.wins
    acc += s.acc
    luck += s.luck
    train += s.train
  }
  const pets = petBoost()
  return {
    wins: (1 + wins / 100) * pets,
    acc: 1 + acc / 100,
    speed: 1 + (RACE.accSpeed * acc) / 100, // top speed multiplier
    train: 1 + train / 100,
    luck,
    lucky: Math.min(RACE.luck.max, luck / (luck + RACE.luck.half)),
    pets,
    petCount: petsState.pets.filter((p) => p.equipped).length,
  }
}
