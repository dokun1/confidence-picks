import { renderLayout, esc } from './layout.js';

const CELL = 'padding:6px 8px;border-bottom:1px solid #e7e5e4;font-size:13px;';
const HEAD = 'padding:6px 8px;border-bottom:2px solid #d6d3d1;font-size:12px;text-align:left;color:#57534e;';

function resultsTable(games) {
  const rows = games
    .map(
      (g) => `          <tr>
            <td style="${CELL}">${esc(g.awayAbbr)} @ ${esc(g.homeAbbr)}</td>
            <td style="${CELL}text-align:right;">${g.awayScore}–${g.homeScore}</td>
          </tr>`
    )
    .join('\n');
  return `        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
          <tr><th style="${HEAD}">Game</th><th style="${HEAD}text-align:right;">Final</th></tr>
${rows}
        </table>`;
}

function standingsTable(scoreboard, week) {
  const rows = scoreboard.users
    .map((u, i) => {
      const thisWeek = u.weekly.find((w) => w.week === week);
      return `          <tr>
            <td style="${CELL}width:28px;color:#78716c;">${i + 1}</td>
            <td style="${CELL}">${esc(u.name)}</td>
            <td style="${CELL}text-align:right;">${thisWeek ? thisWeek.points : 0}</td>
            <td style="${CELL}text-align:right;font-weight:600;">${u.totalPoints}</td>
          </tr>`;
    })
    .join('\n');
  return `        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
          <tr>
            <th style="${HEAD}"></th><th style="${HEAD}">Member</th>
            <th style="${HEAD}text-align:right;">Week</th><th style="${HEAD}text-align:right;">Total</th>
          </tr>
${rows}
        </table>`;
}

function weekTable(grid) {
  const rows = grid.rows
    .map(
      (r) => `          <tr>
            <td style="${CELL}">${esc(r.name)}</td>
            <td style="${CELL}text-align:right;">${r.picks.filter((p) => p.won === true).length}/${r.picks.length}</td>
            <td style="${CELL}text-align:right;font-weight:600;">${r.weekPoints}</td>
          </tr>`
    )
    .join('\n');
  return `        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
          <tr>
            <th style="${HEAD}">Member</th><th style="${HEAD}text-align:right;">Correct</th>
            <th style="${HEAD}text-align:right;">Points</th>
          </tr>
${rows}
        </table>`;
}

/**
 * The week in review, one email per group.
 *
 * Per group rather than consolidated because each carries a full pick table and
 * a leaderboard; stacking five of those in one message reads badly, and the
 * per-group unsubscribe link would become ambiguous.
 */
export function weeklySummary({ userName, groupName, week, grid, scoreboard, unsubscribeUrl, appUrl }) {
  const subject = `${groupName}: Week ${week} results`;

  const bodyHtml = `        <p style="margin:0 0 16px 0;">Hi ${esc(userName)}, here's how Week ${week} finished.</p>
        <h2 style="margin:0 0 8px 0;font-size:15px;color:#1c1917;">How everyone did</h2>
${weekTable(grid)}
        <h2 style="margin:0 0 8px 0;font-size:15px;color:#1c1917;">Standings</h2>
${standingsTable(scoreboard, week)}
        <h2 style="margin:0 0 8px 0;font-size:15px;color:#1c1917;">Results</h2>
${resultsTable(grid.games)}
        <p style="margin:0;"><a href="${appUrl}/groups" style="color:#1d4ed8;font-weight:600;">Open ${esc(groupName)}</a></p>`;

  const text = [
    `Hi ${userName}, here's how Week ${week} finished in ${groupName}.`,
    '',
    'How everyone did:',
    ...grid.rows.map(
      (r) =>
        `- ${r.name}: ${r.picks.filter((p) => p.won === true).length}/${r.picks.length} correct, ${r.weekPoints} pts`
    ),
    '',
    'Standings:',
    ...scoreboard.users.map((u, i) => `${i + 1}. ${u.name} — ${u.totalPoints} pts`),
    '',
    `${appUrl}/groups`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject,
    html: renderLayout({
      heading: `Week ${week} results`,
      bodyHtml,
      unsubscribeUrl,
      footerNote: `You get this because you turned on weekly summaries for ${groupName}.`,
    }),
    text,
  };
}
