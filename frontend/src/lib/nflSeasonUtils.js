/**
 * Utility functions for NFL season calculations
 */

/**
 * Get the current NFL season year based on the calendar date.
 * 
 * The NFL season runs from approximately September through early February of the following year.
 * This function returns the year in which the season started:
 * - From March through August: returns current year (offseason, next season hasn't started)
 * - From September through December: returns current year (season in progress)
 * - From January through February: returns previous year (still in previous season's playoffs/Super Bowl)
 * 
 * @returns {number} The NFL season year
 */
export function getCurrentNFLSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = January, 11 = December)
  
  // If we're in January or February, we're still in the previous year's season
  // (playoffs and Super Bowl happen in January/February)
  if (month === 0 || month === 1) {
    return year - 1;
  }
  
  // For all other months (March through December), use the current year
  return year;
}

/**
 * True when the NFL season returned by getCurrentNFLSeason() is actually under
 * way — September through February. March-August is the offseason, when the
 * "current" season exists on the calendar but has no games and no picks yet.
 *
 * Used to decide whether a group should land on the current season or on the
 * most recent season that has data.
 *
 * @param {Date} [now] injectable for tests
 * @returns {boolean}
 */
export function isNFLSeasonUnderway(now = new Date()) {
  const month = now.getMonth(); // 0-indexed
  // Sep(8)-Dec(11) = regular season; Jan(0)-Feb(1) = playoffs of that same season.
  return month >= 8 || month <= 1;
}
