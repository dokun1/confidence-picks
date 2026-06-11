import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MatchTimeline from './MatchTimeline';
import type { MatchEvent } from '../../../lib/types';

const EVENTS: MatchEvent[] = [
  { type: 'goal', minute: "9'", player: 'J. Quiñones', side: 'home', teamAbbr: 'MEX' },
  { type: 'yellow-card', minute: "17'", player: 'T. Mokoena', side: 'away', teamAbbr: 'RSA' },
  { type: 'red-card', minute: "49'", player: 'S. Sithole', side: 'away', teamAbbr: 'RSA' },
];

describe('MatchTimeline', () => {
  it('renders nothing when there are no events', () => {
    const { container } = render(<MatchTimeline events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the minute and player for every event', () => {
    render(<MatchTimeline events={EVENTS} />);
    for (const ev of EVENTS) {
      expect(screen.getByText(ev.minute)).toBeInTheDocument();
      expect(screen.getByText(ev.player)).toBeInTheDocument();
    }
  });

  it('renders a labelled glyph matching each event type', () => {
    render(<MatchTimeline events={EVENTS} />);
    expect(screen.getByTitle('Goal')).toBeInTheDocument();
    expect(screen.getByTitle('Yellow card')).toBeInTheDocument();
    expect(screen.getByTitle('Red card')).toBeInTheDocument();
  });

  it('places home events left of the minute and away events right of it', () => {
    render(<MatchTimeline events={EVENTS} />);
    // Each event contributes three grid cells: [home] [minute] [away]. A home
    // event fills the left cell (previous sibling of the minute); an away event
    // fills the right cell (next sibling).
    const homeMinute = screen.getByText("9'");
    expect(homeMinute.previousElementSibling?.textContent).toContain('J. Quiñones');

    const awayMinute = screen.getByText("17'");
    expect(awayMinute.nextElementSibling?.textContent).toContain('T. Mokoena');
  });

  it('keeps the glyph adjacent to the player name (no flex-fill gap)', () => {
    render(<MatchTimeline events={EVENTS} />);
    // The away player and its glyph live in the same flex group, so the player
    // span's immediate sibling is the glyph wrapper (titled) — not a spacer.
    const player = screen.getByText('T. Mokoena');
    expect(player.parentElement?.querySelector('[title="Yellow card"]')).not.toBeNull();
  });
});
