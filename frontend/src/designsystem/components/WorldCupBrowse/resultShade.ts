import type { ResultShade } from '../../../lib/wcGamesView';

// Result palette shared by the shaded result cards and the leaderboard chips.
// Inline hexes for the prototype; the real build would promote these to semantic
// tokens (e.g. --color-result-win/draw/partial/loss) so they theme + safelist.
// orange has no token yet, so it's a literal here.
const HEX: Record<ResultShade, string> = {
  win: '20,168,142',   // success
  draw: '245,197,24',  // amber
  partial: '249,115,22', // orange
  loss: '239,68,68',   // error
};

/** Subtle card tint (translucent so it reads in light and dark). */
export const SHADE_TINT: Record<ResultShade, { backgroundColor: string; borderColor: string }> = {
  win: { backgroundColor: `rgba(${HEX.win},0.13)`, borderColor: `rgba(${HEX.win},0.5)` },
  draw: { backgroundColor: `rgba(${HEX.draw},0.16)`, borderColor: `rgba(${HEX.draw},0.55)` },
  partial: { backgroundColor: `rgba(${HEX.partial},0.15)`, borderColor: `rgba(${HEX.partial},0.55)` },
  loss: { backgroundColor: `rgba(${HEX.loss},0.12)`, borderColor: `rgba(${HEX.loss},0.5)` },
};

/** Solid fill for leaderboard chips. */
export const SHADE_SOLID: Record<ResultShade, string> = {
  win: `rgb(${HEX.win})`,
  draw: `rgb(${HEX.draw})`,
  partial: `rgb(${HEX.partial})`,
  loss: `rgb(${HEX.loss})`,
};

export const SHADE_LABEL: Record<ResultShade, string> = {
  win: 'Win (3)', draw: 'Draw (2)', partial: 'Partial (1)', loss: 'Miss (0)',
};
