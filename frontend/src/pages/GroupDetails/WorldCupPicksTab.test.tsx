import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorldCupPicksTab from './WorldCupPicksTab';
import type { WorldCupMatch, WorldCupStage } from '../../lib/types';

vi.mock('../../lib/worldCupService.js', () => ({
  getStageMatches: vi.fn(),
  submitWorldCupPicks: vi.fn(),
  getMyWorldCupPicks: vi.fn(),
  getUserWorldCupPicks: vi.fn(),
  submitUserWorldCupPicks: vi.fn(),
}));
vi.mock('../../lib/groupsService.js', () => ({
  getMyGroups: vi.fn(),
}));

import {
  getStageMatches,
  submitWorldCupPicks,
  getMyWorldCupPicks,
  getUserWorldCupPicks,
  submitUserWorldCupPicks,
} from '../../lib/worldCupService.js';
import { getMyGroups } from '../../lib/groupsService.js';
const mockGetStageMatches = vi.mocked(getStageMatches);
const mockSubmitPicks = vi.mocked(submitWorldCupPicks);
const mockGetMyWorldCupPicks = vi.mocked(getMyWorldCupPicks);
const mockGetUserWorldCupPicks = vi.mocked(getUserWorldCupPicks);
const mockSubmitUserPicks = vi.mocked(submitUserWorldCupPicks);
const mockGetMyGroups = vi.mocked(getMyGroups);

const mex = { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: '' };
const usa = { id: '2', name: 'United States', abbreviation: 'USA', logo: '' };
const can = { id: '3', name: 'Canada', abbreviation: 'CAN', logo: '' };
const arg = { id: '4', name: 'Argentina', abbreviation: 'ARG', logo: '' };

function match(overrides: Partial<WorldCupMatch>): WorldCupMatch {
  return {
    id: 0,
    stage: 'group',
    homeTeam: mex,
    awayTeam: usa,
    homeScore: 0,
    awayScore: 0,
    status: 'SCHEDULED',
    isKnockout: false,
    // Relative to now (tomorrow) so an upcoming match is always pre-kickoff and
    // pickable whenever the suite runs — kickoff-time locking is exercised
    // directly in MatchPickRow's own test.
    gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

const groupMatch = match({ id: 10, stage: 'group', homeTeam: mex, awayTeam: usa });
const r16Match = match({ id: 20, stage: 'r16', isKnockout: true, homeTeam: can, awayTeam: arg });

// Route every stage fetch to its matching subset so the tab flattens a known
// two-match tournament (one group, one knockout).
function stageResponder(matches: WorldCupMatch[]) {
  return (stage: WorldCupStage) => {
    const games = matches.filter((m) => m.stage === stage);
    return Promise.resolve({ games, count: games.length, cached: false });
  };
}

function renderTab(identifier = 'la-crew') {
  return render(<WorldCupPicksTab identifier={identifier} />);
}

// The flat browse list defaults to the "Needs pick" view, which HIDES games that
// are already picked or locked. Clicking the "All" chip forces every game to be
// visible so a card stays in the DOM after it's picked (needed by toggle /
// aria-pressed / hydration assertions).
function showAllGames() {
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
}

// Each game renders a MatchListCard whose subheader carries the full matchup
// ("Mexico vs United States"). There's no per-row testid in the flat list, so we
// locate a card by its home-team name and scope queries to it. The Draw button is
// the only ambiguous one (both cards have one); home/away abbrs are unique here.
function cardFor(homeName: string): HTMLElement {
  const label = screen.getByText(
    (_content, node) => node?.textContent?.startsWith(homeName + ' vs ') ?? false,
    { selector: 'span' },
  );
  // Climb to the card root: the nearest ancestor that also holds the pick buttons.
  let el: HTMLElement | null = label;
  while (el && within(el).queryAllByRole('button').length === 0) {
    el = el.parentElement;
  }
  if (!el) throw new Error(`No card found for ${homeName}`);
  return el;
}

// A game's three outcome buttons by accessible name (team abbreviation, or 'Draw').
// Scoped to the matching card so the shared 'Draw' label is unambiguous.
function pickButton(homeName: string, label: string): HTMLElement {
  return within(cardFor(homeName)).getByRole('button', { name: label });
}

describe('WorldCupPicksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStageMatches.mockImplementation(stageResponder([groupMatch, r16Match]));
    // Default: source group is the user's only WC group. Tests exercising the
    // dropdown re-mock with multiple groups.
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
    ] as any);
    // Default: no previously-saved picks. The hydration test below re-mocks.
    mockGetMyWorldCupPicks.mockResolvedValue({ picks: [] });
    // Default teammate picks + a permissive admin write for the person-selector
    // suite; individual tests override canEdit / the picks payload as needed.
    mockGetUserWorldCupPicks.mockResolvedValue({ picks: [], canEdit: true });
    mockSubmitUserPicks.mockResolvedValue({});
  });

  // Roster used by the person-selector suite: the signed-in caller (id 1) plus
  // two teammates. The standalone renderTab above passes none of this, so the
  // selector stays hidden and every pre-existing test is unaffected.
  const roster = [
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', pictureUrl: null },
    { id: 2, name: 'Bob Stone', email: 'bob@example.com', pictureUrl: null },
    { id: 3, name: 'Carol King', email: 'carol@example.com', pictureUrl: null },
  ];

  function renderWithPeople({ isAdmin = false } = {}) {
    return render(
      <WorldCupPicksTab
        identifier="la-crew"
        members={roster}
        currentUserId={1}
        isAdmin={isAdmin}
      />,
    );
  }

  // Open the person dropdown and choose a teammate by name.
  function pickPerson(name: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Choose whose picks to view or edit' }));
    fireEvent.click(screen.getByRole('radio', { name }));
  }

  it('shows the loading indicator while a stage fetch is in flight', async () => {
    // A never-resolving promise pins the tab in its loading state — and the
    // sticky submit bar must not render before any matches exist.
    mockGetStageMatches.mockReturnValue(new Promise<never>(() => {}));
    renderTab();
    expect(await screen.findByText('Loading matches…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Picks' })).not.toBeInTheDocument();
  });

  it('fetches every tournament stage and renders matches in the flat browse list', async () => {
    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });
    expect(mockGetStageMatches).toHaveBeenCalledTimes(7);

    // Both matchups render in the flat list (no per-stage <h2> sections anymore).
    expect(cardFor('Mexico')).toBeInTheDocument();
    expect(cardFor('Canada')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Group Stage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Round of 16' })).not.toBeInTheDocument();

    // The group game's card renders the three outcome buttons (Home / Draw / Away).
    expect(pickButton('Mexico', 'MEX')).toBeInTheDocument();
    expect(pickButton('Mexico', 'Draw')).toBeInTheDocument();
    expect(pickButton('Mexico', 'USA')).toBeInTheDocument();
  });

  it('shows an error state with a retry when a stage fetch fails', async () => {
    mockGetStageMatches.mockRejectedValue(new Error('boom'));
    renderTab();
    expect(await screen.findByText(/Failed to fetch matches/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows the empty state when no stage returns matches', async () => {
    mockGetStageMatches.mockResolvedValue({ games: [], count: 0, cached: false });
    renderTab();
    expect(await screen.findByText('No matches found for this tournament.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Picks' })).not.toBeInTheDocument();
  });

  it('renders the submit bar once matches load and keeps submit disabled until a pick is made', async () => {
    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });
    const submit = screen.getByRole('button', { name: 'Submit Picks' });
    expect(submit).toBeDisabled();
    expect(screen.getByText('0 picks selected')).toBeInTheDocument();

    fireEvent.click(pickButton('Mexico', 'MEX'));
    expect(submit).toBeEnabled();
    expect(screen.getByText('1 pick selected')).toBeInTheDocument();
  });

  it('submits selected picks and surfaces a success toast', async () => {
    mockSubmitPicks.mockResolvedValue({});
    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });

    fireEvent.click(pickButton('Mexico', 'MEX'));
    fireEvent.click(pickButton('Canada', 'CAN'));

    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));

    await waitFor(() =>
      expect(mockSubmitPicks).toHaveBeenCalledWith('la-crew', [
        { gameId: 10, pickedResult: 'home' },
        { gameId: 20, pickedResult: 'home' },
      ]),
    );
    expect(await screen.findByText('Picks saved')).toBeInTheDocument();
  });

  it('surfaces an error toast when the submit fails', async () => {
    mockSubmitPicks.mockRejectedValue(new Error('Server said no'));
    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });

    fireEvent.click(pickButton('Mexico', 'MEX'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));
    expect(await screen.findByText('Server said no')).toBeInTheDocument();
  });

  it('fans the same picks out to every selected World Cup group via the dropdown', async () => {
    // Three groups: two WC (source + another) + one NFL. The dropdown only
    // surfaces the two WC groups; ticking the non-source one fans-out to both.
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
      { id: 2, identifier: 'work-pool', name: 'Work Pool', poolType: 'world_cup_2026' },
      { id: 3, identifier: 'family-nfl', name: 'Family NFL', poolType: 'nfl_weekly' },
    ] as any);
    mockSubmitPicks.mockResolvedValue({});

    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });

    fireEvent.click(pickButton('Mexico', 'MEX'));

    // Open dropdown, tick the second WC group. The source 'la-crew' is
    // disabled-and-checked by SaveTargetsDropdown so we don't touch it.
    fireEvent.click(screen.getByRole('button', { name: 'Choose groups to save picks to' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Work Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit to 2' }));

    await waitFor(() => expect(mockSubmitPicks).toHaveBeenCalledTimes(2));
    const calledIdentifiers = mockSubmitPicks.mock.calls.map((c) => c[0]).sort();
    expect(calledIdentifiers).toEqual(['la-crew', 'work-pool']);
    expect(await screen.findByText('Picks saved to 2 groups')).toBeInTheDocument();
  });

  it('reports partial failure when some fan-out submits reject', async () => {
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
      { id: 2, identifier: 'work-pool', name: 'Work Pool', poolType: 'world_cup_2026' },
    ] as any);
    mockSubmitPicks.mockImplementation(async (groupId: string) => {
      if (groupId === 'work-pool') throw new Error('boom');
      return {};
    });

    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });

    fireEvent.click(pickButton('Mexico', 'MEX'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose groups to save picks to' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Work Pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit to 2' }));

    expect(await screen.findByText('Saved to 1/2 groups (1 failed)')).toBeInTheDocument();
  });

  it('hydrates the draft from previously-saved picks on mount', async () => {
    // The user already submitted Mexico-home for game 10. After a refresh the
    // tab must reflect that — the source of the bug was the draft initializing
    // to {} regardless of what the DB held for this user.
    mockGetMyWorldCupPicks.mockResolvedValue({
      picks: [{ gameId: 10, pickedResult: 'home' }],
    });
    mockSubmitPicks.mockResolvedValue({});

    renderTab();
    // Game 10 hydrates as already-picked, so the "Needs pick" default view hides
    // its card. The submit bar (always rendered once matches load) is what proves
    // the draft hydrated: wait for it to reflect the one saved pick.
    await screen.findByRole('button', { name: 'Submit Picks' });

    // The submit button should be enabled because the draft now has 1 pick,
    // and the pick count line reflects it.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit Picks' })).toBeEnabled(),
    );
    expect(screen.getByText('1 pick selected')).toBeInTheDocument();

    // Submitting without touching anything sends the hydrated pick verbatim.
    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));
    await waitFor(() =>
      expect(mockSubmitPicks).toHaveBeenCalledWith('la-crew', [
        { gameId: 10, pickedResult: 'home' },
      ]),
    );
  });

  it('re-seeds the fan-out targets when the identifier changes', async () => {
    // Both groups exist; the user starts on la-crew and adds work-pool as a
    // fan-out target. When the identifier prop switches to work-pool (deep-link
    // navigation without a remount), the stale la-crew selection must be
    // dropped — submitting should hit ONLY the new group.
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
      { id: 2, identifier: 'work-pool', name: 'Work Pool', poolType: 'world_cup_2026' },
    ] as any);
    mockSubmitPicks.mockResolvedValue({});

    const { rerender } = renderTab('la-crew');
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });

    fireEvent.click(pickButton('Mexico', 'MEX'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose groups to save picks to' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Work Pool' }));
    expect(screen.getByRole('button', { name: 'Submit to 2' })).toBeInTheDocument();

    rerender(<WorldCupPicksTab identifier="work-pool" />);

    // The selection collapsed back to just the (new) source group.
    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));
    await waitFor(() => expect(mockSubmitPicks).toHaveBeenCalledTimes(1));
    expect(mockSubmitPicks).toHaveBeenCalledWith('work-pool', [
      { gameId: 10, pickedResult: 'home' },
    ]);
  });

  it('toggles a pick off when the selected result is clicked again', async () => {
    renderTab();
    await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
      selector: 'span',
    });
    // Switch to "All" so the card stays in the DOM after it's picked — the
    // "Needs pick" default would hide it the instant it has a pick, making the
    // toggle-off click unreachable.
    showAllGames();

    fireEvent.click(pickButton('Mexico', 'MEX'));
    expect(screen.getByText('1 pick selected')).toBeInTheDocument();
    fireEvent.click(pickButton('Mexico', 'MEX'));
    expect(screen.getByText('0 picks selected')).toBeInTheDocument();
  });

  // The "Picking for" person selector: members can VIEW each other's picks,
  // nobody can change anyone else's, and admins can override anyone. Each test
  // asserts both the happy path and the guard that prevents an accidental pick
  // for the wrong person.
  describe('person selector (view teammates / admin override)', () => {
    it('hides the selector unless a roster and the caller are supplied', async () => {
      // The default renderTab passes no members/currentUserId — selector absent.
      renderTab();
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });
      expect(screen.queryByTestId('pick-person-selector')).not.toBeInTheDocument();
    });

    it('hides the selector for a solo group (only the caller)', async () => {
      render(
        <WorldCupPicksTab
          identifier="la-crew"
          members={[{ id: 1, name: 'Ada Lovelace', email: 'ada@example.com', pictureUrl: null }]}
          currentUserId={1}
          isAdmin={false}
        />,
      );
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });
      expect(screen.queryByTestId('pick-person-selector')).not.toBeInTheDocument();
    });

    it('shows the selector defaulting to the caller ("You") when a roster is supplied', async () => {
      renderWithPeople();
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });
      expect(screen.getByTestId('pick-person-selector')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Choose whose picks to view or edit' }),
      ).toHaveTextContent('Picking for: You');
      // Picking for yourself: no override/read-only banners, normal submit.
      expect(screen.queryByText(/Admin override/)).not.toBeInTheDocument();
      expect(screen.queryByText(/read-only/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit Picks' })).toBeInTheDocument();
    });

    it('lets a NON-admin VIEW a teammate read-only — picks load, but every control is locked', async () => {
      mockGetUserWorldCupPicks.mockResolvedValue({
        picks: [{ gameId: 10, pickedResult: 'away' }],
        canEdit: false,
      });
      renderWithPeople({ isAdmin: false });
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });

      pickPerson('Bob Stone');

      // Loaded Bob's picks via the per-user endpoint.
      await waitFor(() =>
        expect(mockGetUserWorldCupPicks).toHaveBeenCalledWith('la-crew', '2'),
      );

      // Read-only banner + no submit button anywhere.
      expect(await screen.findByText(/read-only/)).toBeInTheDocument();
      expect(screen.getByText('View only')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Submit Picks' })).not.toBeInTheDocument();

      // Bob's pick is away (USA) — picked games are hidden under the default
      // "Needs pick" view, so switch to "All" to inspect the card. Its away
      // button reflects the pick and stays disabled for the read-only viewer.
      showAllGames();
      const awayBtn = pickButton('Mexico', 'USA');
      expect(awayBtn).toHaveAttribute('aria-pressed', 'true');
      expect(awayBtn).toBeDisabled();
    });

    it('refuses to mutate a teammate draft when a non-admin clicks a (disabled) pick', async () => {
      mockGetUserWorldCupPicks.mockResolvedValue({ picks: [], canEdit: false });
      renderWithPeople({ isAdmin: false });
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });
      pickPerson('Bob Stone');
      await screen.findByText(/read-only/);

      // The card's controls are disabled, but force the click to prove the
      // handler is inert (Bob has no picks, so the unpicked card is visible).
      fireEvent.click(pickButton('Mexico', 'MEX'));

      // Still read-only, still no submit affordance, nothing submitted.
      expect(screen.getByText('View only')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save .*Picks/ })).not.toBeInTheDocument();
      expect(mockSubmitUserPicks).not.toHaveBeenCalled();
      expect(mockSubmitPicks).not.toHaveBeenCalled();
    });

    it('lets an ADMIN edit a teammate and submits via the per-user endpoint', async () => {
      renderWithPeople({ isAdmin: true });
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });

      pickPerson('Bob Stone');
      await waitFor(() =>
        expect(mockGetUserWorldCupPicks).toHaveBeenCalledWith('la-crew', '2'),
      );

      // Admin override banner + scoped save note + a personalised submit button.
      expect(await screen.findByText(/Admin override/)).toBeInTheDocument();
      expect(screen.getByText('Saved to this group only')).toBeInTheDocument();

      // Make a pick for Bob and save it.
      fireEvent.click(pickButton('Mexico', 'MEX'));
      const saveBtn = screen.getByRole('button', { name: "Save Bob's Picks" });
      expect(saveBtn).toBeEnabled();
      fireEvent.click(saveBtn);

      await waitFor(() =>
        expect(mockSubmitUserPicks).toHaveBeenCalledWith('la-crew', '2', [
          { gameId: 10, pickedResult: 'home' },
        ]),
      );
      // It used the per-user (admin) path, NOT the self/fan-out path.
      expect(mockSubmitPicks).not.toHaveBeenCalled();
      expect(await screen.findByText("Saved Bob's picks")).toBeInTheDocument();
    });

    it('does NOT fan out to other groups when an admin edits a teammate', async () => {
      mockGetMyGroups.mockResolvedValue([
        { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
        { id: 2, identifier: 'work-pool', name: 'Work Pool', poolType: 'world_cup_2026' },
      ] as any);
      renderWithPeople({ isAdmin: true });
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });

      // While picking for yourself the multi-group dropdown is present...
      expect(
        screen.getByRole('button', { name: 'Choose groups to save picks to' }),
      ).toBeInTheDocument();

      // ...switching to a teammate replaces it with the scoped note.
      pickPerson('Bob Stone');
      await screen.findByText(/Admin override/);
      expect(
        screen.queryByRole('button', { name: 'Choose groups to save picks to' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Saved to this group only')).toBeInTheDocument();
    });

    it('clears the in-progress draft when switching person so picks never bleed across members', async () => {
      // Admin drafts a pick for THEMSELVES, then switches to a teammate whose
      // saved picks are empty. The teammate view must start blank — the admin's
      // own Mexico pick must not carry over and get saved as the teammate's.
      mockGetUserWorldCupPicks.mockResolvedValue({ picks: [], canEdit: true });
      renderWithPeople({ isAdmin: true });
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });

      fireEvent.click(pickButton('Mexico', 'MEX'));
      expect(screen.getByText('1 pick selected')).toBeInTheDocument();

      pickPerson('Bob Stone');
      await screen.findByText(/Admin override/);

      // Draft reset to Bob's (empty) picks — the carried-over pick is gone. With
      // an empty draft the Mexico card is unpicked again and back in the default
      // "Needs pick" view, so its home button reads aria-pressed=false.
      expect(screen.getByText('0 picks selected')).toBeInTheDocument();
      expect(pickButton('Mexico', 'MEX')).toHaveAttribute('aria-pressed', 'false');
    });

    it('surfaces an error toast when an admin override submit fails', async () => {
      mockSubmitUserPicks.mockRejectedValue(new Error('Server said no'));
      renderWithPeople({ isAdmin: true });
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      });
      pickPerson('Bob Stone');
      await screen.findByText(/Admin override/);

      fireEvent.click(pickButton('Mexico', 'MEX'));
      fireEvent.click(screen.getByRole('button', { name: "Save Bob's Picks" }));
      expect(await screen.findByText('Server said no')).toBeInTheDocument();
    });
  });
});
