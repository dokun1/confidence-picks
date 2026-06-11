import { useEffect, useMemo, useState } from 'react';
import { getCurrentNFLSeason } from '../../lib/nflSeasonUtils.js';
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
 * The default is the newest season that actually has pick data — NOT the
 * current NFL season. During the offseason getCurrentNFLSeason() already
 * points at the upcoming (empty) season, which is exactly how old groups lost
 * their picks and scores; defaulting to the latest season with data keeps the
 * history visible while still offering the current season in the dropdown.
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
      setSeason(withData.length > 0 ? Math.max(...withData) : currentSeason);
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier, currentSeason]);

  return { options, season, setSeason, resolved };
}
