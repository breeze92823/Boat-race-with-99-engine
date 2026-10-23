// Inline SVG icons for the HUD (hud.js), drawn in the reference's chunky
// "simulator" style: flat fills with a dark outline. Gradients use ids prefixed
// with the icon name so several icons can share one page.
const O = 'stroke="#1b1b2a" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"'
const svg = (body, box = '0 0 64 64') => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`

export const ICONS = {
  // --- Top-left system buttons -------------------------------------------------
  logo: svg('<g transform="rotate(15 32 32)"><rect x="12" y="12" width="40" height="40" rx="5" fill="#fff"/><rect x="27" y="27" width="10" height="10" rx="1.5" fill="#1d1f24"/></g>'),
  hamburger: svg('<path d="M14 20h36M14 32h36M14 44h36" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'),
  chat: svg(
    '<path d="M12 14h40a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H30l-9 8v-8h-9a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round"/><path d="M21 26h22M21 33h14" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>',
  ),

  // --- Top-right round buttons -------------------------------------------------
  crown: svg(`<path d="M10 46 7 18l14 12 11-18 11 18 14-12-3 28z" fill="#ffc21a" ${O}/><path d="M12 46h40v6H12z" fill="#f29a00" ${O}/><circle cx="32" cy="35" r="4" fill="#ff3b3b"/>`),
  map: svg(
    `<path d="m8 16 15-6 18 6 15-6v38l-15 6-18-6-15 6z" fill="#3fbf5a" ${O}/><path d="m23 10v38M41 16v38" stroke="#1b1b2a" stroke-width="3"/><path d="M8 34c8-2 10 4 15 2s8-6 18-2 9 2 15-1" fill="none" stroke="#3a9cff" stroke-width="5"/><circle cx="33" cy="25" r="4" fill="#ff3b3b"/>`,
  ),
  rocket: svg(
    `<path d="M46 10c6 0 8 2 8 8 0 9-8 18-18 24l-14-14c6-10 15-18 24-18z" fill="#fff" ${O}/><circle cx="42" cy="22" r="5" fill="#3a9cff" ${O}/><path d="m22 28-10 2-4 8 12-2zM36 42l-2 10-8 4 2-12z" fill="#ff5a3a" ${O}/><path d="M22 42c-6 0-10 4-12 12 8-2 12-6 12-12z" fill="#ffb31a" ${O}/>`,
  ),
  wheel: svg(
    '<defs><linearGradient id="wheel-a"><stop offset="0" stop-color="#ff3b3b"/><stop offset=".25" stop-color="#ffd21a"/><stop offset=".5" stop-color="#3fdc5a"/><stop offset=".75" stop-color="#2a8cff"/><stop offset="1" stop-color="#c13bff"/></linearGradient></defs><circle cx="32" cy="32" r="22" fill="none" stroke="url(#wheel-a)" stroke-width="16"/><circle cx="32" cy="32" r="30" fill="none" stroke="#1b1b2a" stroke-width="3"/><circle cx="32" cy="32" r="14" fill="#fff" stroke="#1b1b2a" stroke-width="3"/>',
  ),
  calendar: svg(
    `<rect x="9" y="12" width="46" height="42" rx="6" fill="#fff" ${O}/><path d="M9 18a6 6 0 0 1 6-6h34a6 6 0 0 1 6 6v8H9z" fill="#ff3b3b" ${O}/><path d="M20 7v10M44 7v10" stroke="#1b1b2a" stroke-width="5" stroke-linecap="round"/><text x="32" y="49" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="21" fill="#1b1b2a">31</text>`,
  ),
  gear: svg(
    '<path fill="#fff" d="M28 6h8l1.5 6.5a20 20 0 0 1 5.6 2.3l5.7-3.6 5.6 5.6-3.6 5.7a20 20 0 0 1 2.3 5.6L58 28v8l-6.5 1.5a20 20 0 0 1-2.3 5.6l3.6 5.7-5.6 5.6-5.7-3.6a20 20 0 0 1-5.6 2.3L36 58h-8l-1.5-6.5a20 20 0 0 1-5.6-2.3l-5.7 3.6-5.6-5.6 3.6-5.7a20 20 0 0 1-2.3-5.6L6 36v-8l6.5-1.5a20 20 0 0 1 2.3-5.6l-3.6-5.7 5.6-5.6 5.7 3.6a20 20 0 0 1 5.6-2.3z"/><circle cx="32" cy="32" r="8" fill="#3c3f48"/>',
  ),

  // --- Daily reward ("Once a Day") -----------------------------------------------
  dailyGift: svg(
    `<defs><linearGradient id="daily-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset=".35" stop-color="#3ad0ff"/><stop offset=".7" stop-color="#ffe14a"/><stop offset="1" stop-color="#ff5a5a"/></linearGradient></defs><rect x="8" y="26" width="48" height="32" rx="4" fill="url(#daily-a)" ${O}/><rect x="5" y="17" width="54" height="13" rx="4" fill="url(#daily-a)" ${O}/><path d="M27 17h10v41H27z" fill="#fff" ${O}/><path d="M32 17c-4-10-18-12-16-3 2 5 10 4 16 3zm0 0c4-10 18-12 16-3-2 5-10 4-16 3z" fill="#fff" ${O}/>`,
  ),

  // --- Left column ---------------------------------------------------------------
  gift: svg(
    `<rect x="9" y="28" width="46" height="30" rx="4" fill="#ffd21a" ${O}/><rect x="5" y="18" width="54" height="13" rx="4" fill="#b05cff" ${O}/><path d="M27 18h10v40H27z" fill="#ff4f8a" ${O}/><path d="M32 18c-4-10-18-12-16-3 2 5 10 4 16 3zm0 0c4-10 18-12 16-3-2 5-10 4-16 3z" fill="#ff4f8a" ${O}/>`,
  ),
  store: svg(
    `<rect x="11" y="28" width="42" height="28" fill="#4a7bff" ${O}/><rect x="24" y="36" width="16" height="20" fill="#9fd6ff" ${O}/><path d="M7 16h50l-3 14H10z" fill="#fff" ${O}/><path d="M17 16l-2 14M27 16l-1 14M37 16l1 14M47 16l2 14" stroke="#ff3b3b" stroke-width="6"/><path d="M7 16h50l-3 14H10z" fill="none" ${O}/><rect x="9" y="8" width="46" height="9" rx="3" fill="#ff3b3b" ${O}/>`,
  ),
  rebirth: `<img src="${import.meta.env.BASE_URL}ui/rebirth.png" alt="" draggable="false">`,
  pets: svg(
    `<ellipse cx="32" cy="42" rx="14" ry="12" fill="#2a2a33" ${O}/><ellipse cx="14" cy="28" rx="6" ry="8" fill="#2a2a33" ${O}/><ellipse cx="25" cy="17" rx="6" ry="8" fill="#2a2a33" ${O}/><ellipse cx="39" cy="17" rx="6" ry="8" fill="#2a2a33" ${O}/><ellipse cx="50" cy="28" rx="6" ry="8" fill="#2a2a33" ${O}/>`,
  ),
  boats: svg(
    `<path d="M5 36h54l-7 14H14z" fill="#ff3b3b" ${O}/><path d="M5 36h54l-2 5H7z" fill="#fff"/><path d="M14 36l6-14h22l8 14z" fill="#fff" ${O}/><path d="M24 25h14l4 8H21z" fill="#5ac8ff" ${O}/><path d="M4 55c6-3 10 3 16 0s10-3 16 0 10 3 16 0 8-2 10 0" fill="none" stroke="#3a9cff" stroke-width="4" stroke-linecap="round"/>`,
  ),
  engine: svg(
    `<path d="M32 4c10 8 13 20 11 34H21C19 24 22 12 32 4z" fill="#fff" ${O}/><path d="M32 4c5 4 8 9 9.5 15H22.5C24 13 27 8 32 4z" fill="#ff3b3b" ${O}/><circle cx="32" cy="27" r="5.5" fill="#3a9cff" ${O}/><path d="m21 30-9 12 10-1zM43 30l9 12-10-1z" fill="#ff3b3b" ${O}/><path d="M25 39c0 9 3 15 7 21 4-6 7-12 7-21z" fill="#ffb31a" ${O}/>`,
  ),
  partner: svg(`<circle cx="32" cy="32" r="26" fill="#1d1f24" ${O}/><circle cx="32" cy="32" r="21" fill="none" stroke="#ff2a4a" stroke-width="5"/><rect x="23" y="23" width="18" height="18" rx="2" fill="none" stroke="#fff" stroke-width="5"/>`),
  trail: svg(
    `<path d="M4 50C14 36 26 30 40 26" stroke="#ff3b3b" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M6 56C16 42 28 36 42 32" stroke="#ffd21a" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M10 60c10-12 22-18 34-21" stroke="#3a9cff" stroke-width="7" stroke-linecap="round" fill="none"/><ellipse cx="46" cy="27" rx="15" ry="13" fill="#ffd21a" ${O}/><circle cx="42" cy="24" r="4" fill="#fff" stroke="#1b1b2a" stroke-width="2.5"/><circle cx="52" cy="24" r="4" fill="#fff" stroke="#1b1b2a" stroke-width="2.5"/><circle cx="43" cy="25" r="1.8" fill="#1b1b2a"/><circle cx="53" cy="25" r="1.8" fill="#1b1b2a"/>`,
  ),
  relics: svg(
    `<path d="M20 30v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#1b1b2a" stroke-width="10"/><path d="M20 30v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#2a2a33" stroke-width="5"/><rect x="11" y="29" width="42" height="29" rx="5" fill="#ffc21a" ${O}/><circle cx="32" cy="41" r="4.5" fill="#1b1b2a"/><path d="M32 43v8" stroke="#1b1b2a" stroke-width="4" stroke-linecap="round"/>`,
  ),

  // --- Right column --------------------------------------------------------------
  season: svg(
    `<path d="M32 3l7 8 10-2 2 10 9 5-5 9 5 9-9 5-2 10-10-2-7 8-7-8-10 2-2-10-9-5 5-9-5-9 9-5 2-10 10 2z" fill="#ff9a1a" ${O}/><circle cx="32" cy="35" r="14" fill="#ffd21a" ${O}/><path d="m25 28 14 14M39 28 25 42" stroke="#ff5a1a" stroke-width="4" stroke-linecap="round"/>`,
  ),
  ready: svg(
    '<path d="M32 2l5 9 9-6 1 11 11-2-4 10 10 5-9 6 7 9-11 2 2 11-10-4-4 10-7-8-7 8-4-10-10 4 2-11-11-2 7-9-9-6 10-5-4-10 11 2 1-11 9 6z" fill="#111" stroke="#2a2a2a" stroke-width="2"/>',
  ),
  statue: svg(
    `<defs><linearGradient id="statue-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffc21a"/><stop offset="1" stop-color="#c47a00"/></linearGradient></defs><rect x="18" y="8" width="28" height="22" rx="6" fill="url(#statue-a)" ${O}/><rect x="15" y="30" width="34" height="22" rx="4" fill="url(#statue-a)" ${O}/><rect x="8" y="31" width="9" height="18" rx="3" fill="url(#statue-a)" ${O}/><rect x="47" y="31" width="9" height="18" rx="3" fill="url(#statue-a)" ${O}/><rect x="18" y="52" width="12" height="9" rx="2" fill="url(#statue-a)" ${O}/><rect x="34" y="52" width="12" height="9" rx="2" fill="url(#statue-a)" ${O}/><circle cx="26" cy="18" r="2.5" fill="#1b1b2a"/><circle cx="38" cy="18" r="2.5" fill="#1b1b2a"/><path d="M26 24q6 4 12 0" fill="none" stroke="#1b1b2a" stroke-width="2.5" stroke-linecap="round"/>`,
  ),
  trophy: svg(
    `<defs><linearGradient id="trophy-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe76a"/><stop offset="1" stop-color="#ff9a00"/></linearGradient></defs><path d="M17 12H6v6a12 12 0 0 0 13 12M47 12h11v6a12 12 0 0 1-13 12" fill="none" stroke="#1b1b2a" stroke-width="8"/><path d="M17 12H6v6a12 12 0 0 0 13 12M47 12h11v6a12 12 0 0 1-13 12" fill="none" stroke="#ffb31a" stroke-width="3.5"/><path d="M15 6h34v14c0 10-8 18-17 18S15 30 15 20z" fill="url(#trophy-a)" ${O}/><path d="M28 37h8v9h-8z" fill="#ffb31a" ${O}/><path d="M18 46h28v11H18z" fill="url(#trophy-a)" ${O}/><path d="M21 11v9c0 5 2 8 4 10" fill="none" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/>`,
  ),
  bolt: svg(
    `<defs><linearGradient id="bolt-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fe3ff"/><stop offset="1" stop-color="#1e6fff"/></linearGradient></defs><path d="M38 3 12 36h16l-6 25 30-36H35z" fill="url(#bolt-a)" ${O}/><path d="m35 10-14 20" stroke="#e6f8ff" stroke-width="3" stroke-linecap="round"/>`,
  ),
  gem: svg(
    `<defs><linearGradient id="gem-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3f4"/><stop offset=".5" stop-color="#ff3bd4"/><stop offset="1" stop-color="#a51fff"/></linearGradient></defs><path d="M16 10h32l12 14-28 32L4 24z" fill="url(#gem-a)" ${O}/><path d="M4 24h56M16 10l8 14 8-14 8 14 8-14M24 24l8 32 8-32" fill="none" stroke="#1b1b2a" stroke-width="2.5" stroke-linejoin="round"/><path d="m10 24 6-8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  ),
  paw: svg(
    `<ellipse cx="32" cy="42" rx="13" ry="11" fill="#e6c8ff" ${O}/><ellipse cx="15" cy="29" rx="5.5" ry="7" fill="#e6c8ff" ${O}/><ellipse cx="25" cy="18" rx="5.5" ry="7" fill="#e6c8ff" ${O}/><ellipse cx="39" cy="18" rx="5.5" ry="7" fill="#e6c8ff" ${O}/><ellipse cx="49" cy="29" rx="5.5" ry="7" fill="#e6c8ff" ${O}/>`,
  ),

  // --- Hotbar items --------------------------------------------------------------
  kayak: svg(
    `<path d="M3 38c10-10 40-14 58-6-8 10-42 14-58 6z" fill="#e8b21a" ${O}/><path d="M8 37c14-5 34-7 48-5" fill="none" stroke="#ffe27a" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="35" rx="10" ry="3.5" fill="#7a5200"/>`,
  ),
  engineItem: svg(
    `<g transform="rotate(-40 32 32)"><rect x="24" y="4" width="16" height="34" rx="8" fill="#e9fff0" ${O}/><path d="M24 14h16M24 22h16" stroke="#2fbf5a" stroke-width="5"/><path d="M26 38h12l3 8H23z" fill="#3c3f48" ${O}/><path d="M24 46c0 8 4 12 8 16 4-4 8-8 8-16z" fill="#4ad0ff" ${O}/></g>`,
  ),

  // --- Bottom-left boosts -----------------------------------------------------------
  friends: svg(
    `<circle cx="28" cy="34" r="22" fill="#ffd21a" ${O}/><circle cx="21" cy="30" r="3" fill="#1b1b2a"/><circle cx="35" cy="30" r="3" fill="#1b1b2a"/><path d="M19 39q9 8 18 0" fill="none" stroke="#1b1b2a" stroke-width="3.5" stroke-linecap="round"/><path d="M50 6v20M40 16h20" stroke="#1b1b2a" stroke-width="10" stroke-linecap="round"/><path d="M50 6v20M40 16h20" stroke="#3fdc5a" stroke-width="5" stroke-linecap="round"/>`,
  ),
  clock: svg(
    `<circle cx="32" cy="35" r="24" fill="#fff" stroke="#1b1b2a" stroke-width="4"/><path d="M32 35V11a24 24 0 0 1 24 24z" fill="#ff3b3b"/><circle cx="32" cy="35" r="24" fill="none" stroke="#1b1b2a" stroke-width="4"/><path d="M32 35V19M32 35l9 7" stroke="#1b1b2a" stroke-width="4" stroke-linecap="round"/><rect x="27" y="3" width="10" height="7" rx="2" fill="#1b1b2a"/>`,
  ),

  // Progress bar marker: the player's head.
  head: head(),
}

// A blocky avatar head for the distance bar and the podium. style: short | long
// (hair down the sides) | ears (furry, animal ears + muzzle) | cap | bald.
export function head({ skin = '#f2c79a', hair = '#7a4a22', style = 'short' } = {}) {
  const S = 'stroke="#1b1b2a" stroke-width="3" stroke-linejoin="round"'
  const back = style === 'long' ? `<path d="M7 30c0-16 10-24 25-24s25 8 25 24v28H7z" fill="${hair}" ${S}/>` : ''
  const ears = style === 'ears' ? `<path d="M13 24 9 2l19 12zM51 24l4-22-19 12z" fill="${hair}" ${S}/>` : ''
  const face = `<rect x="12" y="14" width="40" height="40" rx="10" fill="${skin}" ${S}/>`
  const top = {
    short: `<path d="M10 26c0-14 10-20 22-20s22 6 22 20c-6-6-14-8-22-8s-16 2-22 8z" fill="${hair}" ${S}/>`,
    long: `<path d="M10 28c0-14 10-21 22-21s22 7 22 21c-4-7-13-10-22-10S14 21 10 28z" fill="${hair}" ${S}/>`,
    ears: `<path d="M14 24c2-8 9-11 18-11s16 3 18 11c-5-3-11-4-18-4s-13 1-18 4z" fill="${hair}" ${S}/>`,
    cap: `<path d="M11 24c0-12 9-17 21-17s21 5 21 17zM40 21h18v6H40z" fill="${hair}" ${S}/>`,
    bald: '',
  }[style]
  const muzzle = style === 'ears' ? `<ellipse cx="32" cy="44" rx="10" ry="7" fill="#f4f4f4" ${S}/><circle cx="32" cy="40" r="2.5" fill="#1b1b2a"/>` : ''
  const mouth = style === 'ears' ? '' : '<path d="M25 43q7 5 14 0" fill="none" stroke="#1b1b2a" stroke-width="3" stroke-linecap="round"/>'
  return svg(`${back}${ears}${face}${top}${muzzle}<circle cx="25" cy="34" r="3" fill="#1b1b2a"/><circle cx="39" cy="34" r="3" fill="#1b1b2a"/>${mouth}`)
}

// Lanyard behind a podium medal (two straps meeting at the medal).
export const RIBBON = svg('<path d="M14 0h22l24 80H38z" fill="#c8102e"/><path d="M86 0H64L40 80h22z" fill="#e8243a"/><path d="M14 0h22l24 80H38zM86 0H64L40 80h22z" fill="none" stroke="#6e0a16" stroke-width="2"/>', '0 0 100 80')
