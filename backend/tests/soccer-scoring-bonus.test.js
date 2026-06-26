import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scoreKnockoutScoreBonus, aggregateUserScore, SCORING_VERSION } from '../src/services/SoccerScoringService.js';

const ko = (homeScore, awayScore, extra = {}) => ({
  stage: 'r16', status: 'FINAL', homeScore, awayScore,
  homeTeam: { id: 'H' }, awayTeam: { id: 'A' }, winnerTeamId: 'H', ...extra,
});
const pred = (h, a) => ({ predicted_home_score: h, predicted_away_score: a, picked_result: 'home' });

describe('scoreKnockoutScoreBonus (actual 3-2)', () => {
  const g = ko(3, 2);
  test('exact = 2', () => assert.equal(scoreKnockoutScoreBonus(pred(3, 2), g), 2));
  test('one off (3-3, 2-2, 4-2, 3-1) = 1', () => {
    for (const [h, a] of [[3,3],[2,2],[4,2],[3,1]]) assert.equal(scoreKnockoutScoreBonus(pred(h, a), g), 1, `${h}-${a}`);
  });
  test('mirror 2-3 = 1', () => assert.equal(scoreKnockoutScoreBonus(pred(2, 3), g), 1));
  test('both off / far (4-3, 2-1, 1-0) = 0', () => {
    for (const [h, a] of [[4,3],[2,1],[1,0]]) assert.equal(scoreKnockoutScoreBonus(pred(h, a), g), 0, `${h}-${a}`);
  });
});

describe('scoreKnockoutScoreBonus edge cases', () => {
  test('PK-game draw: exact 1-1 = 2, 2-1 = 1', () => {
    const g = ko(1, 1, { winnerTeamId: 'A' });
    assert.equal(scoreKnockoutScoreBonus(pred(1, 1), g), 2);
    assert.equal(scoreKnockoutScoreBonus(pred(2, 1), g), 1);
  });
  test('no prediction = 0', () => assert.equal(scoreKnockoutScoreBonus({ picked_result: 'home' }, ko(3, 2)), 0));
  test('group stage = 0', () => assert.equal(scoreKnockoutScoreBonus(pred(3, 2), { stage: 'group', status: 'FINAL', homeScore: 3, awayScore: 2 }), 0));
  test('not final = 0', () => assert.equal(scoreKnockoutScoreBonus(pred(3, 2), ko(0, 0, { status: 'SCHEDULED' })), 0));
});

describe('aggregateUserScore includes bonus_points', () => {
  test('advance correct (3) + exact score (2) = 5, bonus_points 2', () => {
    const row = aggregateUserScore([{ pick: pred(3, 2), game: ko(3, 2) }]);
    assert.equal(row.points, 5);
    assert.equal(row.bonus_points, 2);
  });
  test('bonus is awarded even when the advance pick is undecided (FINAL, no winnerTeamId)', () => {
    // FINAL knockout, level on-field score, advancer not yet resolved (winnerTeamId
    // null) → the advance pick scores nothing, but the score prediction (1-1 exact)
    // still earns its +2 bonus. Independent of winner resolution.
    const game = ko(1, 1, { winnerTeamId: null });
    const row = aggregateUserScore([{ pick: pred(1, 1), game }]);
    assert.equal(row.points, 2, 'only the +2 bonus, no advance points');
    assert.equal(row.bonus_points, 2);
    assert.equal(row.wins_correct, 0, 'undecided advance pick lands in no tiebreaker bucket');
    assert.equal(row.losses, 0);
  });
});

test('SCORING_VERSION is exported', () => assert.equal(typeof SCORING_VERSION, 'string'));
