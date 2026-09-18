import { test, describe } from 'node:test';
import assert from 'node:assert';
import { etDateKey, etHour } from '../src/utils/etTime.js';

// These conversions decide which games count as "today" and when the summary
// fires. Getting them wrong splits a Sunday slate across two days.

describe('Eastern-time bucketing', () => {
  test('a Sunday 8:20pm ET kickoff belongs to Sunday, not Monday UTC', () => {
    // 2026-09-20 20:20 EDT === 2026-09-21 00:20 UTC
    const d = new Date('2026-09-21T00:20:00Z');
    assert.strictEqual(etDateKey(d), '2026-09-20');
    assert.strictEqual(etHour(d), 20);
  });

  test('a Sunday 1pm ET kickoff is the same Sunday', () => {
    const d = new Date('2026-09-20T17:00:00Z');
    assert.strictEqual(etDateKey(d), '2026-09-20');
    assert.strictEqual(etHour(d), 13);
  });

  test('midnight ET reports hour 0, not 24', () => {
    const d = new Date('2026-09-20T04:00:00Z'); // 00:00 EDT
    assert.strictEqual(etHour(d), 0);
    assert.strictEqual(etDateKey(d), '2026-09-20');
  });

  test('handles standard time after the DST change', () => {
    const d = new Date('2026-12-07T01:00:00Z'); // 2026-12-06 20:00 EST
    assert.strictEqual(etDateKey(d), '2026-12-06');
    assert.strictEqual(etHour(d), 20);
  });

  test('accepts an ISO string as well as a Date', () => {
    assert.strictEqual(etDateKey('2026-09-21T00:20:00Z'), '2026-09-20');
    assert.strictEqual(etHour('2026-09-21T00:20:00Z'), 20);
  });

  test('8am ET is hour 8 in both DST and standard time', () => {
    assert.strictEqual(etHour(new Date('2026-09-22T12:00:00Z')), 8); // EDT
    assert.strictEqual(etHour(new Date('2026-12-08T13:00:00Z')), 8); // EST
  });
});
