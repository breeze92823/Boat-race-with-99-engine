import { EGG_HATCH, PETS } from './config.js'

// Egg odds and rolls (config EGG_HATCH), after Kayak & Surf's hatch.js. An egg's
// `pets` are weights by PETS kind (any total); a hatch picks a kind by weight,
// then a tier: each of EGG_HATCH.tiers (rarest first) at its chance x luck, else
// Normal. Pure: eggs.js pays, checks storage and adds the pets.

// The egg's pets with their chance (0..1), likeliest first.
export function eggOdds(egg) {
  const entries = Object.entries(egg.pets).filter(([kind, w]) => PETS.kinds[kind] && w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  return entries.map(([kind, w]) => ({ kind, chance: w / total })).sort((a, b) => b.chance - a.chance)
}

function rollTier(luck) {
  for (const [tier, chance] of EGG_HATCH.tiers) if (Math.random() < chance * luck) return tier
  return 0
}

// `n` hatches of `egg`: [{ kind, tier }]. luck: a multiplier (1 = none).
export function rollEgg(egg, n = 1, luck = 1) {
  const list = eggOdds(egg)
  return Array.from({ length: n }, () => {
    let r = Math.random()
    const hit = list.find((e) => (r -= e.chance) < 0) ?? list[0] // float leftovers land on the likeliest
    return { kind: hit.kind, tier: rollTier(luck) }
  })
}
