// Type declarations for the untyped JS season helper (nflSeasonUtils.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so a .ts/.tsx import of
// this module would otherwise resolve to `any` and fail. Mirrors the
// groupsService.d.ts / authService.d.ts pattern.

/** Returns the NFL season year (the year the season started) for today's date. */
export function getCurrentNFLSeason(): number;
