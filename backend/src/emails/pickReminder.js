import { renderLayout, esc } from './layout.js';

/**
 * "You have picks to make today."
 *
 * One email per user per Eastern day, covering every opted-in group where they
 * still owe a pick on today's slate — a member of five groups gets one message,
 * not five.
 */
export function pickReminder({ userName, groups, kickoffLabel, unsubscribeUrl, appUrl }) {
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  const noun = total === 1 ? 'pick' : 'picks';
  const subject = `You have ${total} ${noun} to make before ${kickoffLabel}`;

  const items = groups
    .map(
      (g) => `        <li style="margin:0 0 8px 0;">
          <a href="${appUrl}/games?groupId=${encodeURIComponent(g.identifier)}" style="color:#1d4ed8;font-weight:600;">${esc(g.name)}</a>
          — ${g.count} ${g.count === 1 ? 'pick' : 'picks'} left
        </li>`
    )
    .join('\n');

  const bodyHtml = `        <p style="margin:0 0 16px 0;">Hi ${esc(userName)}, today's games start at <strong>${esc(kickoffLabel)}</strong>.</p>
        <ul style="margin:0 0 16px 0;padding-left:20px;">
${items}
        </ul>
        <p style="margin:0;color:#78716c;">Picks lock at each game's kickoff.</p>`;

  const text = [
    `Hi ${userName}, today's games start at ${kickoffLabel}.`,
    '',
    ...groups.map(
      (g) =>
        `- ${g.name}: ${g.count} ${g.count === 1 ? 'pick' : 'picks'} left — ${appUrl}/games?groupId=${g.identifier}`
    ),
    '',
    "Picks lock at each game's kickoff.",
    '',
    '— Confidence Picks, weekly NFL confidence pools with your friends.',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject,
    html: renderLayout({
      heading: `${total} ${noun} to make today`,
      bodyHtml,
      unsubscribeUrl,
      footerNote: 'You get this because you turned on pick reminders for these groups.',
    }),
    text,
  };
}
