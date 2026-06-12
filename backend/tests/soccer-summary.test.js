import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SoccerSummaryService } from '../src/services/SoccerSummaryService.js';

// Minimal hand-built fixtures. parseSummary is a pure function, so no live fetch
// is needed — we assert the curated shape directly. Home = 'H', Away = 'A'.
const header = {
  competitions: [{
    competitors: [
      { homeAway: 'home', team: { id: 'H', abbreviation: 'HOM', displayName: 'Home United' } },
      { homeAway: 'away', team: { id: 'A', abbreviation: 'AWY', displayName: 'Away City' } },
    ],
  }],
};

describe('SoccerSummaryService.parseSummary — venue', () => {
  test('formats "<fullName> · <city>" from gameInfo.venue', () => {
    const out = SoccerSummaryService.parseSummary({
      header,
      gameInfo: { venue: { fullName: 'Estadio Banorte', address: { city: 'Mexico City' } } },
    });
    assert.strictEqual(out.venue, 'Estadio Banorte · Mexico City');
  });

  test('venue is null when gameInfo.venue is absent', () => {
    const out = SoccerSummaryService.parseSummary({ header });
    assert.strictEqual(out.venue, null);
  });
});

describe('SoccerSummaryService.parseSummary — stats', () => {
  test('maps curated stats by team id, in order, with missing → ""', () => {
    const out = SoccerSummaryService.parseSummary({
      header,
      boxscore: {
        teams: [
          {
            team: { id: 'H' },
            statistics: [
              { name: 'possessionPct', displayValue: '55.2' },
              { name: 'totalShots', displayValue: '14' },
              // shotsOnTarget intentionally omitted → ''
              { name: 'wonCorners', displayValue: '6' },
              { name: 'foulsCommitted', displayValue: '12' },
              { name: 'yellowCards', displayValue: '1' },
              { name: 'redCards', displayValue: '0' },
            ],
          },
          {
            team: { id: 'A' },
            statistics: [
              { name: 'possessionPct', displayValue: '44.8' },
              { name: 'totalShots', displayValue: '9' },
              { name: 'shotsOnTarget', displayValue: '3' },
              { name: 'wonCorners', displayValue: '2' },
              { name: 'foulsCommitted', displayValue: '11' },
              { name: 'yellowCards', displayValue: '2' },
              { name: 'redCards', displayValue: '1' },
            ],
          },
        ],
      },
    });

    assert.deepStrictEqual(out.stats, [
      { label: 'Possession', home: '55.2', away: '44.8' },
      { label: 'Shots', home: '14', away: '9' },
      { label: 'Shots on target', home: '', away: '3' },
      { label: 'Corners', home: '6', away: '2' },
      { label: 'Fouls', home: '12', away: '11' },
      { label: 'Yellow cards', home: '1', away: '2' },
      { label: 'Red cards', home: '0', away: '1' },
    ]);
  });

  test('stats is [] when boxscore/teams absent', () => {
    const out = SoccerSummaryService.parseSummary({ header });
    assert.deepStrictEqual(out.stats, []);
  });
});

describe('SoccerSummaryService.parseSummary — lineups', () => {
  test('splits starters/subs, derives line, attaches goal/on/off marks by name', () => {
    const out = SoccerSummaryService.parseSummary({
      header,
      rosters: [
        {
          homeAway: 'home',
          formation: '4-3-3',
          roster: [
            {
              starter: true,
              jersey: '1',
              athlete: { displayName: 'Keeper One' },
              position: { abbreviation: 'G' },
            },
            {
              starter: true,
              jersey: '9',
              athlete: { displayName: 'Striker Nine' },
              position: { abbreviation: 'F' },
            },
            {
              subbedIn: true,
              jersey: '17',
              athlete: { displayName: 'Sub Seventeen' },
              position: { abbreviation: 'SUB' },
            },
          ],
        },
        {
          homeAway: 'away',
          formation: '4-4-2',
          roster: [
            {
              starter: true,
              jersey: '4',
              athlete: { displayName: 'Defender Four' },
              position: { abbreviation: 'D' },
            },
            {
              subbedIn: true,
              jersey: '20',
              athlete: { displayName: 'Sub Twenty' },
              position: { abbreviation: 'SUB' },
            },
          ],
        },
      ],
      keyEvents: [
        // Striker Nine scored at 9'
        { type: { text: 'Goal' }, clock: { displayValue: "9'" }, participants: [{ athlete: { displayName: 'Striker Nine' } }] },
        // Substitution at 56': Sub Seventeen ON, Striker Nine OFF
        {
          type: { text: 'Substitution' },
          clock: { displayValue: "56'" },
          participants: [
            { athlete: { displayName: 'Sub Seventeen' } },
            { athlete: { displayName: 'Striker Nine' } },
          ],
        },
      ],
    });

    const { home, away } = out.lineups;

    // Home team header from competitor
    assert.strictEqual(home.abbr, 'HOM');
    assert.strictEqual(home.name, 'Home United');
    assert.strictEqual(home.formation, '4-3-3');

    // starters split + line derivation
    assert.strictEqual(home.starters.length, 2);
    const keeper = home.starters.find((p) => p.name === 'Keeper One');
    const striker = home.starters.find((p) => p.name === 'Striker Nine');
    assert.strictEqual(keeper.line, 'GK');
    assert.strictEqual(keeper.num, '1');
    assert.strictEqual(striker.line, 'FWD');

    // subs split
    assert.strictEqual(home.subs.length, 1);
    assert.strictEqual(home.subs[0].name, 'Sub Seventeen');
    assert.strictEqual(home.subs[0].num, '17');

    // goal mark on the scorer
    assert.deepStrictEqual(
      striker.marks.filter((m) => m.kind === 'goal'),
      [{ kind: 'goal', min: "9'" }],
    );
    // OFF mark on the player who came off (a starter)
    assert.ok(striker.marks.some((m) => m.kind === 'off' && m.min === "56'"));
    // ON mark on the sub who came on
    assert.ok(home.subs[0].marks.some((m) => m.kind === 'on' && m.min === "56'"));

    // away line derivation: 'D' → DEF
    assert.strictEqual(away.starters[0].line, 'DEF');
    assert.strictEqual(away.subs.length, 1);
  });
});

describe('SoccerSummaryService._deriveLine — position bucketing', () => {
  const dl = (abbr) => SoccerSummaryService._deriveLine(abbr);

  test("'G' → 'GK'", () => assert.strictEqual(dl('G'), 'GK'));
  test("'CD-L' → 'DEF'", () => assert.strictEqual(dl('CD-L'), 'DEF'));
  test("'LB' → 'DEF'", () => assert.strictEqual(dl('LB'), 'DEF'));
  test("'DM' → 'MID'", () => assert.strictEqual(dl('DM'), 'MID'));
  test("'CM-R' → 'MID'", () => assert.strictEqual(dl('CM-R'), 'MID'));
  test("'LM' → 'MID'", () => assert.strictEqual(dl('LM'), 'MID'));
  test("'F' → 'FWD'", () => assert.strictEqual(dl('F'), 'FWD'));
  test("'RW' → 'FWD'", () => assert.strictEqual(dl('RW'), 'FWD'));
  test("unknown 'XYZ' → 'MID'", () => assert.strictEqual(dl('XYZ'), 'MID'));
});

describe('SoccerSummaryService.parseSummary — resilience', () => {
  test('parseSummary({}) returns a sparse-but-valid body without throwing', () => {
    const out = SoccerSummaryService.parseSummary({});
    assert.deepStrictEqual(out, { venue: null, stats: [], lineups: null });
  });

  test('parseSummary(null) does not throw', () => {
    const out = SoccerSummaryService.parseSummary(null);
    assert.deepStrictEqual(out, { venue: null, stats: [], lineups: null });
  });
});
