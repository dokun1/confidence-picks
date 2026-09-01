import { useEffect, useMemo, useState } from 'react';
import { getCurrentNFLSeason, isNFLSeasonUnderway } from '../../lib/nflSeasonUtils.js';
import { getPickSeasons } from '../../lib/picksService.js';

export interface SeasonOptions {
  /** Selectable seasons, newest first. Always contains the current NFL season. */
  options: number[];
  /** Selected season; null until the default resolves. */
  season: number | null;
  setSeason: (season: number) => void;
  /** True once the seasons fetch settled and a default season was chosen. */
  resolved: boolean;
}

/**
 * Resolve the group's selectable seasons and the default selection for the
 * Leaderboard and Picks tabs.
 *
 * Once the current season is under way (September-February) that season is the
 * default, even before anyone has picked — a group is a fresh slate each year,
 * so in Week 1 members should land on the new season rather than on last year's
 * final standings. The empty state explains the lack of points, and prior
 * seasons stay one dropdown click away.
 *
 * In the offseason (March-August) the current season exists on the calendar but
 * has no games and no picks. Defaulting to it there is exactly how old groups
 * used to look wiped, so out of season we fall back to the newest season that
 * actually has data.
 *
 * The seasons fetch is best-effort: on failure we fall back to the current
 * season so the tab still renders.
 */
export function useSeasonOptions(identifier: string): SeasonOptions {
  const currentSeason = useMemo(() => getCurrentNFLSeason(), []);
  const [options, setOptions] = useState<number[]>([currentSeason]);
  const [season, setSeason] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolved(false);
    setSeason(null);
    setOptions([currentSeason]);
    (async () => {
      let withData: number[] = [];
      try {
        const resp = await getPickSeasons(identifier);
        withData = Array.isArray(resp?.seasons) ? resp.seasons : [];
      } catch {
        // Best-effort: an error here must not blank the tab.
      }
      if (cancelled) return;
      const merged = [...new Set([currentSeason, ...withData])].sort((a, b) => b - a);
      setOptions(merged);
      const preferCurrent =
        withData.includes(currentSeason) || isNFLSeasonUnderway() || withData.length === 0;
      setSeason(preferCurrent ? currentSeason : Math.max(...withData));
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier, currentSeason]);

  return { options, season, setSeason, resolved };
}
