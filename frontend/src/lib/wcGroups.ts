// FIFA World Cup 2026 group assignments, drawn December 5 2024 in Miami Beach.
// Maps ESPN team abbreviation → group letter ('A'–'L'). Only group-stage games
// carry a wcGroup; knockout matches leave the field undefined.
// Update abbreviations here if ESPN's live feed uses different codes.
export const WC2026_GROUP: Readonly<Record<string, string>> = {
  // Group A
  MEX: 'A', ECU: 'A', BOL: 'A', JAM: 'A',
  // Group B
  CAN: 'B', URU: 'B', POR: 'B', HON: 'B',
  // Group C
  BRA: 'C', JPN: 'C', MAR: 'C', COD: 'C',
  // Group D
  USA: 'D', TUR: 'D', AUS: 'D', PAR: 'D',
  // Group E
  ESP: 'E', COL: 'E', CRC: 'E', CMR: 'E',
  // Group F
  ARG: 'F', POL: 'F', PER: 'F', NZL: 'F',
  // Group G
  FRA: 'G', SEN: 'G', SUI: 'G', KSA: 'G',
  // Group H
  GER: 'H', NED: 'H', KOR: 'H', UKR: 'H',
  // Group I
  ENG: 'I', SRB: 'I', SVK: 'I', RSA: 'I',
  // Group J
  BEL: 'J', SWE: 'J', CHI: 'J', PAN: 'J',
  // Group K
  CRO: 'K', ROU: 'K', EGY: 'K', CIV: 'K',
  // Group L
  IRN: 'L', NGA: 'L', IRQ: 'L', QAT: 'L',
};

/** Group letter for a team abbreviation, or undefined if unknown / not in group stage. */
export function teamGroup(abbr: string): string | undefined {
  return WC2026_GROUP[abbr];
}

/** Ordered group letters A–L for the filter dropdown. */
export const WC_GROUP_LETTERS: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
];
