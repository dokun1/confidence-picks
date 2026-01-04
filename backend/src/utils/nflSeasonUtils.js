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
