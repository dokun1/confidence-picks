import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ESPNService } from '../src/services/ESPNService.js';
import { MockESPNService } from '../src/mocks/MockESPNService.js';

const SOCCER_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

describe('ESPNService.fetchSoccerWeek', () => {
  let originalFetch;
  let lastUrl;

  beforeEach(() => {
    originalFetch = global.fetch;
    lastUrl = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Stub global.fetch to capture the requested URL and return a canned payload.
  const stubFetch = ({ ok = true, status = 200, body = { events: [] } } = {}) => {
    global.fetch = async (url) => {
      lastUrl = url;
      return {
        ok,
        status,
        json: async () => body
      };
    };
  };

  describe('URL construction', () => {
    test('builds the fifa.world scoreboard URL from the league slug', async () => {
      stubFetch();
      await ESPNService.fetchSoccerWeek('fifa.world', 'group');
      assert.ok(lastUrl.startsWith(SOCCER_SCOREBOARD), `URL should target the fifa.world scoreboard, got ${lastUrl}`);
    });

    // Known stage keys fetch by tournament date window (+ limit=200 so the group
    // slate clears ESPN's default 25-event cap) — the `?groups=` filter only
    // returns today's matches, so it can't serve a whole-stage fetch.
    test('maps a group stage key to its tournament date window', async () => {
      stubFetch();
      await ESPNService.fetchSoccerWeek('fifa.world', 'group');
      assert.strictEqual(lastUrl, `${SOCCER_SCOREBOARD}?dates=20260611-20260627&limit=200`);
    });

    test('maps knockout stage keys to their date windows', async () => {
      const expected = {
        r32: '20260628-20260703',
        r16: '20260704-20260707',
        qf: '20260709-20260711',
        sf: '20260714-20260715',
        third: '20260718-20260718',
        final: '20260719-20260719',
      };
      for (const [stage, dates] of Object.entries(expected)) {
        stubFetch();
        await ESPNService.fetchSoccerWeek('fifa.world', stage);
        assert.strictEqual(lastUrl, `${SOCCER_SCOREBOARD}?dates=${dates}&limit=200`, `${stage} should map to dates=${dates}`);
      }
    });

    test('passes a raw groups value through unchanged', async () => {
      stubFetch();
      await ESPNService.fetchSoccerWeek('fifa.world', '4');
      assert.strictEqual(lastUrl, `${SOCCER_SCOREBOARD}?groups=4`);
    });

    test('supports a date-keyed fetch alongside the groups filter', async () => {
      stubFetch();
      await ESPNService.fetchSoccerWeek('fifa.world', { stage: 'group', dates: '20260611' });
      assert.strictEqual(lastUrl, `${SOCCER_SCOREBOARD}?dates=20260611&groups=1`);
    });

    test('supports a date-only fetch with no group filter', async () => {
      stubFetch();
      await ESPNService.fetchSoccerWeek('fifa.world', { dates: '20260611' });
      assert.strictEqual(lastUrl, `${SOCCER_SCOREBOARD}?dates=20260611&limit=200`);
    });
  });

  describe('return shape', () => {
    test('returns the events array from the response body', async () => {
      const events = [{ id: '760601' }, { id: '760602' }];
      stubFetch({ body: { events } });
      const result = await ESPNService.fetchSoccerWeek('fifa.world', 'group');
      assert.deepStrictEqual(result, events);
    });

    test('returns an empty array when the body has no events', async () => {
      stubFetch({ body: {} });
      const result = await ESPNService.fetchSoccerWeek('fifa.world', 'group');
      assert.ok(Array.isArray(result), 'Should return an array');
      assert.strictEqual(result.length, 0, 'Should be empty when events is absent');
    });
  });

  describe('error propagation', () => {
    test('throws on a non-OK response, mirroring fetchGames', async () => {
      stubFetch({ ok: false, status: 503 });
      await assert.rejects(
        () => ESPNService.fetchSoccerWeek('fifa.world', 'group'),
        /ESPN API error: 503/
      );
    });

    test('rethrows a network/fetch failure', async () => {
      global.fetch = async () => { throw new Error('network down'); };
      await assert.rejects(
        () => ESPNService.fetchSoccerWeek('fifa.world', 'group'),
        /network down/
      );
    });
  });
});

describe('MockESPNService.fetchSoccerWeek', () => {
  beforeEach(() => {
    MockESPNService.reset();
  });

  afterEach(() => {
    MockESPNService.reset();
  });

  test('throws when the mock service is not enabled', async () => {
    await assert.rejects(
      () => MockESPNService.fetchSoccerWeek('fifa.world', 'group'),
      /not enabled/
    );
  });

  test('returns the world-cup group fixtures when enabled', async () => {
    MockESPNService.setEnabled(true);
    const matches = await MockESPNService.fetchSoccerWeek('fifa.world', 'group');
    assert.ok(Array.isArray(matches), 'Should return an array');
    assert.strictEqual(matches.length, 3, 'Group stage should have 3 fixtures');
    matches.forEach(m => {
      assert.strictEqual(m.competitions[0].stage, 'group', 'Fixtures should be tagged stage=group');
    });
  });

  test('returns the world-cup knockout fixtures for a knockout stage key', async () => {
    MockESPNService.setEnabled(true);
    const matches = await MockESPNService.fetchSoccerWeek('fifa.world', 'r16');
    assert.strictEqual(matches.length, 3, 'Knockout slate should have 3 fixtures');
    const knockoutStages = new Set(['r32', 'r16', 'qf', 'sf', 'third', 'final']);
    matches.forEach(m => {
      assert.ok(knockoutStages.has(m.competitions[0].stage), 'Fixtures should carry a knockout stage code');
    });
  });

  test('is a drop-in replacement: shares ESPNService.fetchSoccerWeek signature', () => {
    assert.strictEqual(typeof MockESPNService.fetchSoccerWeek, 'function');
    assert.strictEqual(MockESPNService.fetchSoccerWeek.length, ESPNService.fetchSoccerWeek.length,
      'Mock and real fetchSoccerWeek should accept the same arity');
  });
});
